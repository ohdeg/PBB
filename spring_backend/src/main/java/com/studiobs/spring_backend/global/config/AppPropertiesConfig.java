package com.studiobs.spring_backend.global.config;

import com.studiobs.spring_backend.domain.dieta.config.DietaGeminiProperties;
import com.studiobs.spring_backend.domain.sranko.config.SrankoMlProperties;
import com.studiobs.spring_backend.domain.sranko.config.SrankoTryOnProperties;
import com.studiobs.spring_backend.domain.sranko.config.SrankoVertexProperties;
import com.studiobs.spring_backend.domain.sranko.config.SrankoWeatherProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({
        JwtProperties.class,
        CookieProperties.class,
        R2Properties.class,
        MailProperties.class,
        DietaGeminiProperties.class,
        SrankoVertexProperties.class,
        SrankoMlProperties.class,
        SrankoWeatherProperties.class,
        SrankoTryOnProperties.class
})
public class AppPropertiesConfig {
}
