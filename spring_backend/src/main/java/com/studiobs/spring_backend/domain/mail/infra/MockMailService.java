package com.studiobs.spring_backend.domain.mail.infra;

import com.studiobs.spring_backend.domain.mail.service.MailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@ConditionalOnProperty(name = "app.mail.mock", havingValue = "true")
public class MockMailService implements MailService {

    @Override
    public void sendVerificationCode(String toEmail, String code) {
        log.info("[DEV MOCK MAIL] to={}, verificationCode={}", toEmail, code);
    }
}
