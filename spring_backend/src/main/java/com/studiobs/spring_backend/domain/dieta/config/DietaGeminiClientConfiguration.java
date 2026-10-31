package com.studiobs.spring_backend.domain.dieta.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class DietaGeminiClientConfiguration {
    @Bean
    RestClient dietaGeminiRestClient(DietaGeminiProperties properties) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(45_000);
        return RestClient.builder().baseUrl(properties.baseUrl()).requestFactory(factory).build();
    }
}
