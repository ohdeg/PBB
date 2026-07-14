package com.studiobs.spring_backend.global.config;

import java.net.URI;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration
public class R2ClientConfig {

    @Bean(destroyMethod = "close")
    @ConditionalOnProperty(prefix = "app.r2", name = "enabled", havingValue = "true")
    public S3Client r2S3Client(R2Properties properties) {
        validate(properties);

        return S3Client.builder()
                .endpointOverride(URI.create(properties.endpoint()))
                .region(Region.of(properties.region() == null || properties.region().isBlank()
                        ? "auto"
                        : properties.region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(
                                properties.accessKeyId(),
                                properties.secretAccessKey())))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();
    }

    private void validate(R2Properties properties) {
        if (isBlank(properties.endpoint())
                || isBlank(properties.accessKeyId())
                || isBlank(properties.secretAccessKey())
                || isBlank(properties.bucket())) {
            throw new IllegalStateException(
                    "app.r2.enabled=true 인데 endpoint/access-key-id/secret-access-key/bucket 이 비어 있습니다.");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
