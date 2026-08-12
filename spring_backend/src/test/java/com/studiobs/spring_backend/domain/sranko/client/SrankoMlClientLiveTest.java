package com.studiobs.spring_backend.domain.sranko.client;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.studiobs.spring_backend.domain.sranko.config.SrankoMlProperties;
import java.net.HttpURLConnection;
import java.net.URI;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class SrankoMlClientLiveTest {

    @Test
    void predict_reachesLiveFastApi() throws Exception {
        Assumptions.assumeTrue(isFastApiUp(), "FastAPI :8000 not running");

        byte[] jpeg = minimalJpeg();
        SrankoMlClient client = new SrankoMlClient(
                new SrankoMlProperties("http://127.0.0.1:8000", true),
                JsonMapper.builder().build()
        );

        SrankoMlClient.FastApiPredictResult result = client.predict(jpeg, "tiny.jpg", "image/jpeg");
        assertNotNull(result);
        assertTrue(result.classNum() >= 0);
        // solid 1x1 is usually rejected as 옷아님
        assertTrue(result.rejected() || result.imagePngBase64() != null);
        if (!result.rejected()) {
            assertFalse(result.decodedPng().length == 0);
        }
    }

    @Test
    void jackson_parsesFastApiRejectedJson() {
        String json = """
                {"classNum":9,"category1":"옷아님","category2":"옷아님","slot":null,"categoryCode":null,"warmth":null,"taxonomyGroup":"옷아님","rejected":true,"width":1,"height":1,"imagePngBase64":""}
                """;
        SrankoMlClient.FastApiPredictResult result = JsonMapper.builder().build()
                .readValue(json, SrankoMlClient.FastApiPredictResult.class);
        assertTrue(result.rejected());
        assertTrue(result.classNum() == 9);
    }

    private static boolean isFastApiUp() {
        try {
            HttpURLConnection conn = (HttpURLConnection) URI.create("http://127.0.0.1:8000/ml/health")
                    .toURL()
                    .openConnection();
            conn.setConnectTimeout(500);
            conn.setReadTimeout(500);
            return conn.getResponseCode() == 200;
        } catch (Exception ex) {
            return false;
        }
    }

    private static byte[] minimalJpeg() {
        return new byte[]{
                (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
                0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, (byte) 0xFF, (byte) 0xDB, 0x00, 0x43, 0x00,
                0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
                0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E,
                0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28,
                0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C,
                0x2E, 0x33, 0x34, 0x32, (byte) 0xFF, (byte) 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01,
                0x01, 0x01, 0x11, 0x00, (byte) 0xFF, (byte) 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01,
                0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02,
                0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, (byte) 0xFF, (byte) 0xDA, 0x00, 0x08,
                0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7F, (byte) 0xFF, (byte) 0xD9
        };
    }
}
