package com.studiobs.spring_backend.domain.sranko.client;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class SrankoMlClientMultipartTest {

    @Test
    void predictMultipart_forwardsWornGarmentOptions() throws Exception {
        String body = multipart(true, "OUTER");

        assertTrue(body.contains("name=\"extractWornGarment\"\r\n\r\ntrue"));
        assertTrue(body.contains("name=\"targetSlot\"\r\n\r\nOUTER"));
        assertTrue(body.contains("name=\"file\"; filename=\"look.jpg\""));
    }

    @Test
    void predictMultipart_keepsNormalFlowBackwardCompatible() throws Exception {
        String body = multipart(false, null);

        assertTrue(body.contains("name=\"extractWornGarment\"\r\n\r\nfalse"));
        assertFalse(body.contains("name=\"targetSlot\""));
    }

    private static String multipart(boolean extract, String targetSlot) throws Exception {
        Method method = SrankoMlClient.class.getDeclaredMethod(
                "buildPredictMultipart",
                String.class,
                String.class,
                String.class,
                byte[].class,
                boolean.class,
                String.class
        );
        method.setAccessible(true);
        byte[] bytes = (byte[]) method.invoke(
                null,
                "test-boundary",
                "look.jpg",
                "image/jpeg",
                new byte[]{1, 2, 3},
                extract,
                targetSlot
        );
        return new String(bytes, StandardCharsets.ISO_8859_1);
    }
}
