package com.studiobs.spring_backend.global.r2;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 로컬에서 R2 설정이 유효한지 확인할 때 사용.
 * GET http://localhost:8080/api/v1/dev/r2/check
 */
@RestController
@RequestMapping("/api/v1/dev/r2")
@Profile("dev")
@RequiredArgsConstructor
public class R2CheckController {

    private final R2ConnectionVerifier r2ConnectionVerifier;

    @GetMapping("/check")
    public Map<String, Object> check() {
        return r2ConnectionVerifier.verify();
    }
}
