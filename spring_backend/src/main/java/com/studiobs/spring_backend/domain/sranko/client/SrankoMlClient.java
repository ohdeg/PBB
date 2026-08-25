package com.studiobs.spring_backend.domain.sranko.client;

import tools.jackson.databind.ObjectMapper;
import com.studiobs.spring_backend.domain.sranko.config.SrankoMlProperties;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Internal FastAPI Sranko ML client (classify + rembg + fit-warp).
 * Uses JDK HttpClient multipart so FastAPI always receives form field {@code file}.
 */
@Slf4j
@Component
public class SrankoMlClient {

    private final SrankoMlProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public SrankoMlClient(SrankoMlProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public boolean isAvailable() {
        return properties.isEnabled();
    }

    public FastApiPredictResult predict(byte[] imageBytes, String filename, String contentType) {
        return predict(imageBytes, filename, contentType, false, null, false);
    }

    public FastApiPredictResult predict(
            byte[] imageBytes,
            String filename,
            String contentType,
            boolean extractWornGarment,
            String targetSlot
    ) {
        return predict(imageBytes, filename, contentType, extractWornGarment, targetSlot, false);
    }

    public FastApiPredictResult predict(
            byte[] imageBytes,
            String filename,
            String contentType,
            boolean extractWornGarment,
            String targetSlot,
            boolean skipBackgroundRemoval
    ) {
        requireEnabled();

        String safeName = filename != null && !filename.isBlank() ? filename : "upload.jpg";
        String partType = contentType != null && contentType.startsWith("image/")
                ? contentType
                : "image/jpeg";
        String boundary = "----SrankoMl" + UUID.randomUUID().toString().replace("-", "");

        byte[] multipartBody;
        try {
            multipartBody = buildPredictMultipart(
                    boundary,
                    safeName,
                    partType,
                    imageBytes,
                    extractWornGarment,
                    targetSlot,
                    skipBackgroundRemoval
            );
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "ML 요청 본문을 만들 수 없습니다.");
        }

        URI uri = mlUri("/ml/predict");

        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(120))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(multipartBody))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int code = response.statusCode();
            String body = response.body() != null ? response.body() : "";
            if (code >= 400) {
                log.warn("[SrankoMl] predict HTTP {}: {}", code, body);
                throw new BusinessException(
                        HttpStatus.BAD_GATEWAY,
                        "옷 분류 서비스 오류(" + code + "): " + truncate(body, 300)
                );
            }
            FastApiPredictResult result = objectMapper.readValue(body, FastApiPredictResult.class);
            if (result == null) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "ML 응답이 비어 있습니다.");
            }
            return result;
        } catch (BusinessException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "옷 분류 서비스 호출이 중단되었습니다.");
        } catch (IOException ex) {
            log.warn("[SrankoMl] predict failed: {}", ex.getMessage());
            throw mlIoException(ex, "옷 분류");
        }
    }

    public FastApiRembgResult rembg(byte[] imageBytes, String filename, String contentType) {
        requireEnabled();
        if (imageBytes == null || imageBytes.length == 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지 파일이 비어 있습니다.");
        }

        String safeName = filename != null && !filename.isBlank() ? filename : "upload.jpg";
        String partType = contentType != null && contentType.startsWith("image/")
                ? contentType
                : "image/jpeg";
        String boundary = "----SrankoRembg" + UUID.randomUUID().toString().replace("-", "");

        byte[] multipartBody;
        try {
            multipartBody = buildSingleFileMultipart(boundary, "file", safeName, partType, imageBytes);
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "배경제거 요청 본문을 만들 수 없습니다.");
        }

        URI uri = mlUri("/ml/rembg");
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(120))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(multipartBody))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int code = response.statusCode();
            String body = response.body() != null ? response.body() : "";
            if (code >= 400) {
                log.warn("[SrankoMl] rembg HTTP {}: {}", code, body);
                throw new BusinessException(
                        HttpStatus.BAD_GATEWAY,
                        "배경제거 서비스 오류(" + code + "): " + truncate(body, 300)
                );
            }
            FastApiRembgResult result = objectMapper.readValue(body, FastApiRembgResult.class);
            if (result == null || result.imagePngBase64() == null || result.imagePngBase64().isBlank()) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "배경제거 결과가 비어 있습니다.");
            }
            return result;
        } catch (BusinessException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "배경제거 서비스 호출이 중단되었습니다.");
        } catch (IOException ex) {
            log.warn("[SrankoMl] rembg failed: {}", ex.getMessage());
            throw mlIoException(ex, "배경제거");
        }
    }

    /**
     * Deterministic 2D garment warp after Vertex VTO Stage1.
     *
     * @param vtoJpegBytes   Stage1 JPEG
     * @param personJpegBytes optional person photo for absdiff mask (may be null)
     * @param slot           TOP / OUTER / BOTTOM / DRESS / …
     * @param scaleX         horizontal scale from {@code SrankoFitAnalyzer}
     * @param scaleY         vertical scale
     */
    public FastApiFitWarpResult fitWarp(
            byte[] vtoJpegBytes,
            byte[] personJpegBytes,
            String slot,
            double scaleX,
            double scaleY
    ) {
        requireEnabled();
        if (vtoJpegBytes == null || vtoJpegBytes.length == 0) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "핏 워프 입력이 비어 있습니다.");
        }

        String boundary = "----SrankoFitWarp" + UUID.randomUUID().toString().replace("-", "");
        String safeSlot = slot != null && !slot.isBlank() ? slot.trim().toUpperCase(Locale.ROOT) : "TOP";

        byte[] multipartBody;
        try {
            multipartBody = buildFitWarpMultipart(
                    boundary,
                    vtoJpegBytes,
                    personJpegBytes,
                    safeSlot,
                    scaleX,
                    scaleY
            );
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "핏 워프 요청 본문을 만들 수 없습니다.");
        }

        URI uri = mlUri("/ml/fit-warp");
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(multipartBody))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int code = response.statusCode();
            String body = response.body() != null ? response.body() : "";
            if (code >= 400) {
                log.warn("[SrankoMl] fit-warp HTTP {}: {}", code, body);
                throw new BusinessException(
                        HttpStatus.BAD_GATEWAY,
                        "핏 워프 서비스 오류(" + code + "): " + truncate(body, 300)
                );
            }
            FastApiFitWarpResult result = objectMapper.readValue(body, FastApiFitWarpResult.class);
            if (result == null) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "핏 워프 응답이 비어 있습니다.");
            }
            return result;
        } catch (BusinessException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "핏 워프 서비스 호출이 중단되었습니다.");
        } catch (IOException ex) {
            log.warn("[SrankoMl] fit-warp failed: {}", ex.getMessage());
            throw mlIoException(ex, "핏 워프");
        }
    }

    private void requireEnabled() {
        if (!properties.isEnabled()) {
            throw new BusinessException(
                    HttpStatus.BAD_GATEWAY,
                    "슈란코 ML이 비활성화되어 있습니다. SRANKO_ML_ENABLED=true 를 확인하세요."
            );
        }
    }

    private URI mlUri(String path) {
        String base = properties.baseUrl().endsWith("/")
                ? properties.baseUrl().substring(0, properties.baseUrl().length() - 1)
                : properties.baseUrl();
        return URI.create(base + path);
    }

    private static BusinessException mlIoException(IOException ex, String label) {
        String detail = ex.getMessage() != null ? ex.getMessage() : "";
        if (detail.contains("Connection refused") || detail.contains("ConnectException")) {
            return new BusinessException(
                    HttpStatus.BAD_GATEWAY,
                    label + " 서비스(FastAPI :8000)에 연결할 수 없습니다. uvicorn이 실행 중인지 확인하세요."
            );
        }
        return new BusinessException(
                HttpStatus.BAD_GATEWAY,
                label + " 서비스 호출에 실패했습니다: " + detail
        );
    }

    private static byte[] buildPredictMultipart(
            String boundary,
            String filename,
            String contentType,
            byte[] fileBytes,
            boolean extractWornGarment,
            String targetSlot,
            boolean skipBackgroundRemoval
    ) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeFilePart(out, boundary, "file", filename, contentType, fileBytes);
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        writeTextPart(
                out,
                boundary,
                "extractWornGarment",
                Boolean.toString(extractWornGarment)
        );
        if (targetSlot != null && !targetSlot.isBlank()) {
            out.write("\r\n".getBytes(StandardCharsets.UTF_8));
            writeTextPart(out, boundary, "targetSlot", targetSlot);
        }
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        writeTextPart(
                out,
                boundary,
                "skipBackgroundRemoval",
                Boolean.toString(skipBackgroundRemoval)
        );
        out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private static byte[] buildSingleFileMultipart(
            String boundary,
            String fieldName,
            String filename,
            String contentType,
            byte[] fileBytes
    ) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeFilePart(out, boundary, fieldName, filename, contentType, fileBytes);
        out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private static byte[] buildFitWarpMultipart(
            String boundary,
            byte[] vtoJpegBytes,
            byte[] personJpegBytes,
            String slot,
            double scaleX,
            double scaleY
    ) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeFilePart(out, boundary, "vto", "vto.jpg", "image/jpeg", vtoJpegBytes);
        if (personJpegBytes != null && personJpegBytes.length > 0) {
            out.write("\r\n".getBytes(StandardCharsets.UTF_8));
            writeFilePart(out, boundary, "person", "person.jpg", "image/jpeg", personJpegBytes);
        }
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        writeTextPart(out, boundary, "slot", slot);
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        writeTextPart(out, boundary, "scaleX", Double.toString(scaleX));
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
        writeTextPart(out, boundary, "scaleY", Double.toString(scaleY));
        out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }

    private static void writeFilePart(
            ByteArrayOutputStream out,
            String boundary,
            String name,
            String filename,
            String contentType,
            byte[] fileBytes
    ) throws IOException {
        String preamble = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\""
                + name
                + "\"; filename=\""
                + filename.replace("\"", "")
                + "\"\r\n"
                + "Content-Type: " + contentType + "\r\n\r\n";
        out.write(preamble.getBytes(StandardCharsets.UTF_8));
        out.write(fileBytes);
    }

    private static void writeTextPart(
            ByteArrayOutputStream out,
            String boundary,
            String name,
            String value
    ) throws IOException {
        String part = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\""
                + name
                + "\"\r\n\r\n"
                + value;
        out.write(part.getBytes(StandardCharsets.UTF_8));
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max) + "…";
    }

    public record FastApiPredictResult(
            int classNum,
            String category1,
            String category2,
            String slot,
            String categoryCode,
            Integer warmth,
            String taxonomyGroup,
            boolean rejected,
            int width,
            int height,
            String imagePngBase64,
            Boolean garmentExtractionApplied,
            String extractionWarning
    ) {
        public byte[] decodedPng() {
            if (imagePngBase64 == null || imagePngBase64.isBlank()) {
                return new byte[0];
            }
            return Base64.getDecoder().decode(imagePngBase64);
        }
    }

    public record FastApiRembgResult(
            String imagePngBase64,
            int width,
            int height
    ) {
    }

    public record FastApiFitWarpResult(
            String imageJpegBase64,
            boolean warpApplied,
            int width,
            int height
    ) {
        public byte[] decodedJpeg() {
            if (imageJpegBase64 == null || imageJpegBase64.isBlank()) {
                return new byte[0];
            }
            return Base64.getDecoder().decode(imageJpegBase64);
        }
    }
}
