package com.studiobs.spring_backend.domain.dieta;

import com.studiobs.spring_backend.domain.dieta.client.GeminiMealClient;
import com.studiobs.spring_backend.domain.dieta.config.DietaGeminiProperties;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealResponse;
import java.math.BigDecimal;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import tools.jackson.databind.ObjectMapper;

/** Controlled external-analysis fixture. Never available in production. */
@TestConfiguration
public class DietaGeminiTestConfiguration {
    @Bean
    @Primary
    GeminiMealClient fixtureGeminiClient(ObjectMapper mapper) {
        return new GeminiMealClient(new DietaGeminiProperties("", null, null), mapper, org.springframework.web.client.RestClient.create()) {
            @Override
            public DietaGeminiMealResponse analyze(DietaGeminiMealRequest request) {
                org.assertj.core.api.Assertions.assertThat(
                        org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
                return new DietaGeminiMealResponse(1, request.loggedOn(),
                        new DietaGeminiMealResponse.Totals(new BigDecimal("20"), new BigDecimal("25"),
                                new BigDecimal("10"), 270), "분석 결과");
            }
        };
    }
}
