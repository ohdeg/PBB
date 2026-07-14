package com.studiobs.spring_backend.global.r2;

import com.studiobs.spring_backend.global.config.R2Properties;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;

@Service
@RequiredArgsConstructor
public class R2ConnectionVerifier {

    private final R2Properties r2Properties;
    private final ObjectProvider<S3Client> r2S3ClientProvider;

    public Map<String, Object> verify() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("enabled", r2Properties.enabled());
        result.put("bucket", r2Properties.bucket());
        result.put("endpoint", blankToNull(r2Properties.endpoint()));
        result.put("region", r2Properties.region());
        result.put("keyPrefix", r2Properties.keyPrefix());
        result.put("publicBaseUrl", blankToNull(r2Properties.publicBaseUrl()));
        result.put("accountIdConfigured", notBlank(r2Properties.accountId()));
        result.put("accessKeyConfigured", notBlank(r2Properties.accessKeyId()));
        result.put("secretConfigured", notBlank(r2Properties.secretAccessKey()));

        if (!r2Properties.enabled()) {
            result.put("ok", false);
            result.put("message", "app.r2.enabled=false 입니다. R2_ENABLED=true 로 켠 뒤 다시 확인하세요.");
            return result;
        }

        Optional<S3Client> client = Optional.ofNullable(r2S3ClientProvider.getIfAvailable());
        if (client.isEmpty()) {
            result.put("ok", false);
            result.put("message", "S3Client 빈이 없습니다. R2 설정값을 확인하세요.");
            return result;
        }

        try {
            client.get().headBucket(HeadBucketRequest.builder()
                    .bucket(r2Properties.bucket())
                    .build());
            result.put("ok", true);
            result.put("message", "R2 HeadBucket 성공 — 자격증명과 버킷 설정이 유효합니다.");
        } catch (Exception ex) {
            result.put("ok", false);
            result.put("message", "R2 연결 실패: " + ex.getMessage());
        }
        return result;
    }

    private boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private String blankToNull(String value) {
        return notBlank(value) ? value : null;
    }
}
