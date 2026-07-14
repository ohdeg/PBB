package com.studiobs.spring_backend.domain.mail.infra;

import com.studiobs.spring_backend.domain.mail.service.MailService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.mail.mock", havingValue = "false", matchIfMissing = true)
public class SmtpMailService implements MailService {

    private final JavaMailSender javaMailSender;

    @Override
    public void sendVerificationCode(String toEmail, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("[PBB] 이메일 인증 코드");
        message.setText("인증 코드: " + code + "\n유효 시간은 3분입니다.");
        javaMailSender.send(message);
    }
}
