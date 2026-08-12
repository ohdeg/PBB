package com.studiobs.spring_backend.domain.sranko.client;

import com.google.auth.oauth2.GoogleCredentials;
import com.studiobs.spring_backend.domain.sranko.config.SrankoVertexProperties;
import com.studiobs.spring_backend.domain.sranko.service.SrankoFitAnalyzer;
import com.studiobs.spring_backend.global.exception.BusinessException;
import com.studiobs.spring_backend.global.r2.R2StorageService;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.URLConnection;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.imageio.ImageIO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Single-call Gemini virtual try-on: person image + one or more garment images + English prompt.
 * Live when {@link SrankoVertexProperties#isLiveConfigured()}; otherwise a deterministic stub.
 * Default model {@code gemini-2.5-flash-image} ({@code SRANKO_VERTEX_MODEL} / legacy {@code fit-model}).
 */
@Slf4j
@Component
public class VertexGeminiTryOnClient {

    private static final String CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

    private final SrankoVertexProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public VertexGeminiTryOnClient(SrankoVertexProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public static final String DEFAULT_PERSON_CLASSPATH = "sranko/default-person.png";
    public static final String DEFAULT_PERSON_FEMALE_CLASSPATH = "sranko/default-person-female.png";

    public record TryOnImage(byte[] jpegBytes) {
    }

    /** One garment product image with optional slot label for the prompt (TOP, BOTTOM, …). */
    public record GarmentInput(String imageUrl, String slot) {
    }

    public TryOnImage tryOn(String personImageUrl, String garmentImageUrl, String promptEnglish) {
        return tryOn(personImageUrl, List.of(new GarmentInput(garmentImageUrl, null)), promptEnglish, "M");
    }

    public TryOnImage tryOn(
            String personImageUrl,
            List<GarmentInput> garments,
            String promptEnglish
    ) {
        return tryOn(personImageUrl, garments, promptEnglish, "M");
    }

    public TryOnImage tryOn(
            String personImageUrl,
            List<GarmentInput> garments,
            String promptEnglish,
            String sex
    ) {
        if (promptEnglish == null || promptEnglish.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "입어보기 프롬프트가 비어 있습니다.");
        }
        if (garments == null || garments.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "의류 이미지가 필요합니다.");
        }
        try {
            ImagePayload person = resolvePerson(personImageUrl, sex);
            boolean defaultPerson = personImageUrl == null || personImageUrl.isBlank();
            String classpath = defaultPersonClasspath(sex);
            log.info(
                    "[SrankoGeminiTryOn] personSource={} personUrl={} sex={}",
                    defaultPerson ? "default-mannequin" : "url",
                    defaultPerson ? classpath : truncate(personImageUrl, 96),
                    resolvedSex(sex)
            );
            List<ImagePayload> garmentPayloads = new ArrayList<>(garments.size());
            List<String> slotLabels = new ArrayList<>(garments.size());
            for (GarmentInput g : garments) {
                if (g == null || g.imageUrl() == null || g.imageUrl().isBlank()) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "의류 이미지가 비어 있습니다.");
                }
                garmentPayloads.add(loadImageBytes(g.imageUrl()));
                slotLabels.add(g.slot() != null && !g.slot().isBlank()
                        ? g.slot().trim().toUpperCase(Locale.ROOT)
                        : "GARMENT");
            }
            if (properties.isLiveConfigured()) {
                return liveTryOn(person, garmentPayloads, slotLabels, promptEnglish);
            }
            log.info(
                    "[SrankoGeminiTryOn] stub garments={} slots={} promptChars={}",
                    garmentPayloads.size(),
                    slotLabels,
                    promptEnglish.trim().length()
            );
            log.info("[SrankoGeminiTryOn] prompt BEGIN\n{}\n[SrankoGeminiTryOn] prompt END", promptEnglish.trim());
            return stubTryOn(person, garmentPayloads);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("[SrankoGeminiTryOn] prepare failed: {}", ex.getMessage());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Vertex Gemini 입어보기에 실패했습니다.");
        }
    }

    /** Classpath default mannequin for prefs sex (try-on is mannequin-only). */
    public static ImagePayload loadDefaultPerson() {
        return loadDefaultPerson("M");
    }

    public static ImagePayload loadDefaultPerson(String sex) {
        String classpath = defaultPersonClasspath(sex);
        try {
            ClassPathResource resource = new ClassPathResource(classpath);
            if (!resource.exists() && "F".equals(resolvedSex(sex))) {
                log.warn("[SrankoGeminiTryOn] female mannequin missing; falling back to male");
                resource = new ClassPathResource(DEFAULT_PERSON_CLASSPATH);
                classpath = DEFAULT_PERSON_CLASSPATH;
            }
            if (!resource.exists()) {
                throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "기본 마네킹 이미지를 찾을 수 없습니다.");
            }
            try (InputStream in = resource.getInputStream()) {
                byte[] bytes = in.readAllBytes();
                if (bytes.length == 0) {
                    throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "기본 마네킹 이미지가 비어 있습니다.");
                }
                String mime = classpath.endsWith(".png") ? "image/png" : "image/jpeg";
                return new ImagePayload(bytes, mime);
            }
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("[SrankoGeminiTryOn] default person load failed: {}", ex.getMessage());
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "기본 마네킹 이미지를 읽지 못했습니다.");
        }
    }

    private ImagePayload resolvePerson(String personImageUrl, String sex) throws Exception {
        if (personImageUrl == null || personImageUrl.isBlank()) {
            return loadDefaultPerson(sex);
        }
        return loadImageBytes(personImageUrl);
    }

    static String defaultPersonClasspath(String sex) {
        return "F".equals(resolvedSex(sex))
                ? DEFAULT_PERSON_FEMALE_CLASSPATH
                : DEFAULT_PERSON_CLASSPATH;
    }

    static String resolvedSex(String sex) {
        return "F".equalsIgnoreCase(sex != null ? sex.trim() : "") ? "F" : "M";
    }

    TryOnImage liveTryOn(
            ImagePayload person,
            List<ImagePayload> garments,
            List<String> slotLabels,
            String promptEnglish
    ) {
        try {
            List<Object> parts = new ArrayList<>();
            parts.add(Map.of("text", promptEnglish.trim()));
            parts.add(Map.of("text", "Image 1 — person (keep identity, body, pose):"));
            parts.add(inlineImagePart(person));
            for (int i = 0; i < garments.size(); i++) {
                String slot = slotLabels.get(i);
                parts.add(Map.of(
                        "text",
                        "Image " + (i + 2) + " — " + slot
                                + " garment product (match design/coverage exactly):"
                ));
                parts.add(inlineImagePart(garments.get(i)));
            }

            Map<String, Object> content = new LinkedHashMap<>();
            content.put("role", "user");
            content.put("parts", parts);

            Map<String, Object> generationConfig = new LinkedHashMap<>();
            generationConfig.put("responseModalities", List.of("TEXT", "IMAGE"));
            // Portrait 3:4 (taller than wide) for try-on lookbook shots.
            generationConfig.put("imageConfig", Map.of("aspectRatio", "3:4"));

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("contents", List.of(content));
            body.put("generationConfig", generationConfig);

            String endpoint = generateContentEndpoint();
            String accessToken = accessToken();
            String json = objectMapper.writeValueAsString(body);

            log.info(
                    "[SrankoGeminiTryOn] request model={} project={} location={} garments={} "
                            + "personBytes={} personMime={} garmentBytes={} slots={} promptChars={}",
                    properties.tryOnModel(),
                    abbreviateId(properties.projectId()),
                    properties.location(),
                    garments.size(),
                    person.bytes().length,
                    person.contentType(),
                    garments.stream().map(g -> g.bytes().length).toList(),
                    slotLabels,
                    promptEnglish.trim().length()
            );
            log.info("[SrankoGeminiTryOn] prompt BEGIN\n{}\n[SrankoGeminiTryOn] prompt END", promptEnglish.trim());


            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(120))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int code = response.statusCode();
            String responseBody = response.body() != null ? response.body() : "";
            if (code >= 400) {
                log.warn("[SrankoGeminiTryOn] HTTP {}: {}", code, truncate(responseBody, 400));
                throw new BusinessException(
                        HttpStatus.BAD_GATEWAY,
                        "Vertex Gemini 입어보기 호출에 실패했습니다 (" + code + ")."
                );
            }
            TryOnImage result = parseGenerateContentResponse(responseBody);
            log.info(
                    "[SrankoGeminiTryOn] success HTTP={} jpegBytes={}",
                    code,
                    result.jpegBytes().length
            );
            return result;
        } catch (BusinessException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.warn("[SrankoGeminiTryOn] call interrupted");
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Vertex Gemini 입어보기 호출이 중단되었습니다.");
        } catch (Exception ex) {
            log.warn("[SrankoGeminiTryOn] failed: {}", ex.getMessage());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Vertex Gemini 입어보기에 실패했습니다.");
        }
    }

    TryOnImage stubTryOn(ImagePayload personPayload, List<ImagePayload> garments) {
        log.info("[SrankoGeminiTryOn] using stub garments={}", garments.size());
        try {
            BufferedImage person = decodeBufferedImage(personPayload.bytes());

            // Fixed portrait 3:4 (width:height).
            int width = 540;
            int height = 720;

            BufferedImage out = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = out.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.setColor(new Color(0xE8, 0xEE, 0xF4));
                g.fillRect(0, 0, width, height);

                double personScale = Math.min(
                        width / (double) person.getWidth(),
                        height / (double) person.getHeight()
                );
                int pW = Math.max(1, (int) Math.round(person.getWidth() * personScale));
                int pH = Math.max(1, (int) Math.round(person.getHeight() * personScale));
                int pX = (width - pW) / 2;
                int pY = (height - pH) / 2;
                g.drawImage(person, pX, pY, pW, pH, null);

                int count = garments.size();
                for (int i = 0; i < count; i++) {
                    BufferedImage garment = decodeBufferedImage(garments.get(i).bytes());
                    float scale = count == 1 ? 0.42f : 0.28f;
                    int gW = Math.round(width * scale);
                    int gH = Math.round((garment.getHeight() / (float) garment.getWidth()) * gW);
                    int gX = (width - gW) / 2 + Math.round((i - (count - 1) / 2f) * width * 0.08f);
                    int gY = Math.round(height * (0.22f + i * 0.06f));
                    g.setComposite(java.awt.AlphaComposite.getInstance(java.awt.AlphaComposite.SRC_OVER, 0.92f));
                    g.drawImage(garment, gX, gY, gW, gH, null);
                }
                g.setComposite(java.awt.AlphaComposite.SrcOver);

                g.setColor(new Color(0x1A, 0x2A, 0x3A, 180));
                g.fillRoundRect(16, height - 48, Math.min(300, width - 32), 28, 8, 8);
                g.setColor(Color.WHITE);
                g.drawString("PROTO · Gemini look stub ×" + count, 22, height - 25);
            } finally {
                g.dispose();
            }
            return new TryOnImage(encodeJpeg(out));
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("[SrankoGeminiTryOn] stub failed: {}", ex.getMessage());
            throw new BusinessException(HttpStatus.BAD_REQUEST, "입어보기 이미지 합성에 실패했습니다.");
        }
    }

    private static Map<String, Object> inlineImagePart(ImagePayload payload) {
        Map<String, Object> inlineData = new LinkedHashMap<>();
        inlineData.put("mimeType", payload.contentType());
        inlineData.put("data", Base64.getEncoder().encodeToString(payload.bytes()));
        return Map.of("inlineData", inlineData);
    }

    private TryOnImage parseGenerateContentResponse(String json) throws Exception {
        JsonNode root = objectMapper.readTree(json);
        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Vertex Gemini 응답에 candidates가 없습니다.");
        }
        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Vertex Gemini 응답에 parts가 없습니다.");
        }

        String b64 = null;
        String mime = null;
        for (JsonNode part : parts) {
            JsonNode inline = firstPresent(part, "inlineData", "inline_data");
            if (inline == null || inline.isMissingNode() || inline.isNull()) {
                continue;
            }
            String data = textOrNull(firstPresent(inline, "data"));
            if (data == null || data.isBlank()) {
                continue;
            }
            b64 = data;
            mime = textOrNull(firstPresent(inline, "mimeType", "mime_type"));
        }
        if (b64 == null || b64.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Vertex Gemini 응답에 이미지가 없습니다.");
        }
        byte[] raw = Base64.getDecoder().decode(b64);
        return new TryOnImage(ensureJpeg(raw, mime));
    }

    private static JsonNode firstPresent(JsonNode parent, String... fieldNames) {
        if (parent == null || parent.isMissingNode() || parent.isNull()) {
            return null;
        }
        for (String name : fieldNames) {
            JsonNode child = parent.get(name);
            if (child != null && !child.isMissingNode() && !child.isNull()) {
                return child;
            }
        }
        return null;
    }

    private String generateContentEndpoint() {
        return generateContentEndpoint(properties.tryOnModel());
    }

    private String generateContentEndpoint(String model) {
        String location = properties.location();
        String projectId = properties.projectId().trim();
        String resolved = model != null && !model.isBlank() ? model.trim() : properties.tryOnModel();
        return "https://" + location + "-aiplatform.googleapis.com/v1/projects/"
                + projectId
                + "/locations/"
                + location
                + "/publishers/google/models/"
                + resolved
                + ":generateContent";
    }

    private static String accessToken() throws Exception {
        GoogleCredentials credentials = GoogleCredentials.getApplicationDefault()
                .createScoped(CLOUD_PLATFORM_SCOPE);
        credentials.refreshIfExpired();
        if (credentials.getAccessToken() == null || credentials.getAccessToken().getTokenValue() == null) {
            throw new BusinessException(
                    HttpStatus.BAD_GATEWAY,
                    "Google ADC 액세스 토큰을 가져오지 못했습니다. gcloud auth application-default login 을 확인하세요."
            );
        }
        return credentials.getAccessToken().getTokenValue();
    }

    public record ImagePayload(byte[] bytes, String contentType) {
    }

    static ImagePayload loadImageBytes(String source) throws Exception {
        if (source == null || source.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지가 비어 있습니다.");
        }
        String trimmed = source.trim();
        if (R2StorageService.isHttpUrl(trimmed)) {
            URLConnection connection = URI.create(trimmed).toURL().openConnection();
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(30_000);
            String contentType = connection.getContentType();
            try (InputStream in = connection.getInputStream()) {
                byte[] bytes = in.readAllBytes();
                if (bytes.length == 0) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지를 읽을 수 없습니다.");
                }
                return new ImagePayload(bytes, normalizeMime(contentType, bytes));
            }
        }
        if (trimmed.startsWith("data:")) {
            int comma = trimmed.indexOf(',');
            if (comma < 0) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지를 읽을 수 없습니다.");
            }
            String meta = trimmed.substring(5, comma);
            String mime = "image/jpeg";
            int semi = meta.indexOf(';');
            if (semi > 0) {
                mime = meta.substring(0, semi).trim();
            } else if (!meta.isBlank()) {
                mime = meta.trim();
            }
            byte[] bytes = Base64.getDecoder().decode(trimmed.substring(comma + 1));
            if (bytes.length == 0) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지를 읽을 수 없습니다.");
            }
            return new ImagePayload(bytes, normalizeMime(mime, bytes));
        }
        throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지 URL이 올바르지 않습니다.");
    }

    private static String normalizeMime(String contentType, byte[] bytes) {
        if (contentType != null) {
            String mime = contentType.split(";", 2)[0].trim().toLowerCase();
            if (mime.startsWith("image/")) {
                return mime;
            }
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47) {
            return "image/png";
        }
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        return "image/jpeg";
    }

    private static byte[] ensureJpeg(byte[] imageBytes, String mimeType) throws Exception {
        String mime = mimeType != null ? mimeType.toLowerCase() : "";
        if (mime.contains("jpeg") || mime.contains("jpg")) {
            return imageBytes;
        }
        return encodeJpeg(decodeBufferedImage(imageBytes));
    }

    private static BufferedImage decodeBufferedImage(byte[] bytes) throws Exception {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
        if (image == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지를 읽을 수 없습니다.");
        }
        return image;
    }

    private static byte[] encodeJpeg(BufferedImage image) throws Exception {
        BufferedImage rgb = image;
        if (image.getType() != BufferedImage.TYPE_INT_RGB) {
            rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgb.createGraphics();
            try {
                g.setColor(Color.WHITE);
                g.fillRect(0, 0, image.getWidth(), image.getHeight());
                g.drawImage(image, 0, 0, null);
            } finally {
                g.dispose();
            }
        }
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        if (!ImageIO.write(rgb, "jpg", baos)) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "결과 이미지를 인코딩할 수 없습니다.");
        }
        return baos.toByteArray();
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String text = node.asText();
        return text != null && !text.isBlank() ? text : null;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max) + "...";
    }

    private static String abbreviateId(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 8) {
            return trimmed;
        }
        return trimmed.substring(0, 4) + "…" + trimmed.substring(trimmed.length() - 2);
    }
}
