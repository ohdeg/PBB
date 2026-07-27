package com.studiobs.spring_backend.global.e2e;

import com.studiobs.spring_backend.domain.auth.consent.ConsentCatalog;
import com.studiobs.spring_backend.domain.user.service.UserService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Profile("e2e")
@RequiredArgsConstructor
public class E2eUserSeeder implements ApplicationRunner {

    private final UserService userService;

    @Value("${app.e2e.user-email:e2e@pbb.test}")
    private String email;

    @Value("${app.e2e.user-password:E2ePassw0rd!}")
    private String password;

    @Value("${app.e2e.user-nickname:e2euser}")
    private String nickname;

    @Override
    public void run(ApplicationArguments args) {
        String normalized = email.trim().toLowerCase();
        if (userService.existsByEmail(normalized)) {
            log.info("[e2e] demo user already exists: {}", normalized);
            return;
        }
        List<UserService.ConsentInput> consents = ConsentCatalog.activeItems().stream()
                .map(item -> new UserService.ConsentInput(
                        item.key(),
                        true,
                        item.version()))
                .toList();
        userService.register(normalized, nickname.trim(), password, consents);
        log.info("[e2e] seeded demo user: {}", normalized);
    }
}
