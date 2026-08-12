package com.studiobs.spring_backend.global.r2;

import com.studiobs.spring_backend.global.config.R2Properties;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.net.URI;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Slf4j
@Service
@RequiredArgsConstructor
public class R2StorageService {

    private final R2Properties r2Properties;
    private final ObjectProvider<S3Client> r2S3ClientProvider;

    public boolean isEnabled() {
        return r2Properties.enabled() && r2S3ClientProvider.getIfAvailable() != null;
    }

    public void requireEnabled() {
        if (!isEnabled()) {
            throw new BusinessException(
                    HttpStatus.BAD_GATEWAY,
                    "이미지 저장소(R2)가 비활성화되어 있습니다. R2_ENABLED=true 와 자격증명을 확인하세요."
            );
        }
    }

    /**
     * @return public URL for the uploaded object
     */
    public String putObject(String objectKey, byte[] bytes, String contentType) {
        requireEnabled();
        S3Client client = requireClient();
        String key = normalizeKey(objectKey);
        try {
            client.putObject(
                    PutObjectRequest.builder()
                            .bucket(r2Properties.bucket())
                            .key(key)
                            .contentType(contentType != null ? contentType : "application/octet-stream")
                            .build(),
                    RequestBody.fromBytes(bytes)
            );
            return publicUrl(key);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("[R2] putObject failed key={}: {}", key, ex.getMessage());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "이미지 업로드에 실패했습니다.");
        }
    }

    public void deleteByPublicUrl(String publicUrl) {
        if (!isEnabled() || publicUrl == null || publicUrl.isBlank()) {
            return;
        }
        Optional<String> key = keyFromPublicUrl(publicUrl);
        if (key.isEmpty()) {
            return;
        }
        deleteByKey(key.get());
    }

    public void deleteByKey(String objectKey) {
        if (!isEnabled() || objectKey == null || objectKey.isBlank()) {
            return;
        }
        String key = normalizeKey(objectKey);
        try {
            requireClient().deleteObject(DeleteObjectRequest.builder()
                    .bucket(r2Properties.bucket())
                    .key(key)
                    .build());
        } catch (Exception ex) {
            log.warn("[R2] delete failed key={}: {}", key, ex.getMessage());
        }
    }

    /** Read object bytes (e.g. promote try-on → looks). */
    public byte[] getObjectBytes(String objectKey) {
        requireEnabled();
        String key = normalizeKey(objectKey);
        try {
            ResponseBytes<GetObjectResponse> response = requireClient().getObjectAsBytes(
                    GetObjectRequest.builder()
                            .bucket(r2Properties.bucket())
                            .key(key)
                            .build()
            );
            byte[] bytes = response.asByteArray();
            if (bytes == null || bytes.length == 0) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "이미지를 읽을 수 없습니다.");
            }
            return bytes;
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("[R2] getObject failed key={}: {}", key, ex.getMessage());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "이미지를 읽을 수 없습니다.");
        }
    }

    public Optional<String> keyFromPublicUrl(String publicUrl) {
        String base = blankToNull(r2Properties.publicBaseUrl());
        if (base == null || publicUrl == null) {
            return Optional.empty();
        }
        String normalizedBase = trimTrailingSlash(base);
        if (!publicUrl.startsWith(normalizedBase + "/") && !publicUrl.equals(normalizedBase)) {
            return Optional.empty();
        }
        String key = publicUrl.substring(normalizedBase.length());
        if (key.startsWith("/")) {
            key = key.substring(1);
        }
        return key.isBlank() ? Optional.empty() : Optional.of(key);
    }

    public String publicUrl(String objectKey) {
        String base = blankToNull(r2Properties.publicBaseUrl());
        if (base == null) {
            throw new BusinessException(
                    HttpStatus.BAD_GATEWAY,
                    "R2_PUBLIC_BASE_URL 이 비어 있습니다. 공개 URL을 설정해 주세요."
            );
        }
        return trimTrailingSlash(base) + "/" + normalizeKey(objectKey);
    }

    public String keyPrefix() {
        String prefix = r2Properties.keyPrefix();
        if (prefix == null || prefix.isBlank()) {
            return "";
        }
        return prefix.endsWith("/") ? prefix : prefix + "/";
    }

    private S3Client requireClient() {
        S3Client client = r2S3ClientProvider.getIfAvailable();
        if (client == null) {
            throw new BusinessException(
                    HttpStatus.BAD_GATEWAY,
                    "R2 클라이언트를 사용할 수 없습니다. R2_ENABLED=true 와 자격증명을 확인하세요."
            );
        }
        return client;
    }

    private String normalizeKey(String objectKey) {
        String key = objectKey.startsWith("/") ? objectKey.substring(1) : objectKey;
        if (key.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "잘못된 저장 키입니다.");
        }
        return key;
    }

    private static String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    /** True when URL looks like http(s) we can fetch for try-on. */
    public static boolean isHttpUrl(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(value.trim());
            String scheme = uri.getScheme();
            return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
        } catch (Exception ex) {
            return false;
        }
    }
}
