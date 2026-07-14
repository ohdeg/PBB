package com.studiobs.spring_backend.domain.mail.service;

public interface MailService {

    void sendVerificationCode(String toEmail, String code);
}
