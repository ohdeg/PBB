package com.studiobs.spring_backend.global.config;

import com.studiobs.spring_backend.domain.dieta.config.DietaGeminiProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({
        JwtProperties.class,
        CookieProperties.class,
        R2Properties.class,
        MailProperties.class,
        DietaGeminiProperties.class
})
public class AppPropertiesConfig {
}
