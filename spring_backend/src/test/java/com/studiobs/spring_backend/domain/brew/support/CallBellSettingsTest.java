package com.studiobs.spring_backend.domain.brew.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CallBellSettingsTest {

    @Test
    void parsePlainPhrase() {
        CallBellSettings settings = CallBellSettings.parse("  픽업하세요  ");
        assertThat(settings.phrase()).isEqualTo("픽업하세요");
        assertThat(settings.rate()).isNull();
    }

    @Test
    void roundTripJson() {
        String stored = CallBellSettings.fromRequest("나왔습니다", 1.2, 0.8, null).toStorage();
        CallBellSettings parsed = CallBellSettings.parse(stored);
        assertThat(parsed.phrase()).isEqualTo("나왔습니다");
        assertThat(parsed.rate()).isEqualTo(1.2);
        assertThat(parsed.pitch()).isEqualTo(0.8);
        assertThat(parsed.style()).isNull();
        assertThat(stored).doesNotContain("voice");
    }

    @Test
    void persistsChimeStyleWithoutPhrase() {
        String stored = CallBellSettings.fromRequest("  ", null, null, "chime").toStorage();
        CallBellSettings parsed = CallBellSettings.parse(stored);
        assertThat(stored).contains("chime");
        assertThat(parsed.style()).isEqualTo("chime");
        assertThat(parsed.phrase()).isNull();
    }

    @Test
    void ignoresLegacyVoice() {
        CallBellSettings parsed = CallBellSettings.parse(
                "{\"phrase\":\"나왔습니다\",\"voice\":\"Yuna\",\"rate\":1.2,\"pitch\":0.8}");
        assertThat(parsed.phrase()).isEqualTo("나왔습니다");
        assertThat(parsed.rate()).isEqualTo(1.2);
        assertThat(parsed.pitch()).isEqualTo(0.8);
        assertThat(parsed.toStorage()).doesNotContain("voice");
    }

    @Test
    void emptyBecomesNullStorage() {
        assertThat(CallBellSettings.fromRequest("  ", null, null, null).toStorage()).isNull();
    }
}
