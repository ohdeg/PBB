package com.studiobs.spring_backend.domain.lotto.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.studiobs.spring_backend.domain.lotto.dto.LottoPatternProfileResponse;
import com.studiobs.spring_backend.domain.lotto.dto.LottoPatternProfilesResponse;
import com.studiobs.spring_backend.domain.lotto.entity.LottoDraw;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class LottoPatternLearnServiceTest {

    private final LottoPatternLearnService service = new LottoPatternLearnService();

    @Test
    @DisplayName("구간별 learnStrength 고정 비율 · 빈 표본 0")
    void learnStrengthByWindow() {
        assertThat(LottoPatternLearnService.learnStrength(0, "all")).isZero();
        assertThat(LottoPatternLearnService.learnStrength(10, "all")).isEqualTo(0.7);
        assertThat(LottoPatternLearnService.learnStrength(10, "52")).isEqualTo(0.6);
        assertThat(LottoPatternLearnService.learnStrength(10, "12")).isEqualTo(0.5);
        assertThat(LottoPatternLearnService.learnStrength(10, "8")).isEqualTo(0.4);
        assertThat(LottoPatternLearnService.learnStrength(10, "4")).isEqualTo(0.3);
    }

    @Test
    @DisplayName("4회 데이터에서 oddCount mode와 strength 0.3")
    void buildFourWeekProfile() {
        List<LottoDraw> draws = List.of(
                draw(1, "1,3,5,8,10,12"),
                draw(2, "1,3,7,9,11,14"),
                draw(3, "2,4,6,8,10,11"),
                draw(4, "1,3,5,10,20,22")
        );
        LottoPatternProfileResponse profile = service.buildOne(draws, "4");
        assertThat(profile).isNotNull();
        assertThat(profile.sampleSize()).isEqualTo(4);
        assertThat(profile.learnStrength()).isEqualTo(0.3);
        assertThat(profile.oddCount().mode()).isEqualTo(3);
    }

    @Test
    @DisplayName("빈 draws면 profiles 비어 있음")
    void emptyDraws() {
        LottoPatternProfilesResponse all = service.buildAll(List.of());
        assertThat(all.profiles()).isEmpty();
    }

    private static LottoDraw draw(int round, String mainNumbers) {
        return LottoDraw.builder()
                .round(round)
                .mainNumbers(mainNumbers)
                .build();
    }
}
