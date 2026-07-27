package com.studiobs.spring_backend.global.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.entity.UserClass;
import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import com.studiobs.spring_backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

class SecurityAuthorizationIT extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void publicEndpoint_allowsAnonymous() throws Exception {
        mockMvc.perform(get("/api/v1/lotto/draws"))
                .andExpect(status().isOk());
    }

    @Test
    void healthEndpoint_allowsAnonymous() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }

    @Test
    void infoEndpoint_allowsAnonymous() throws Exception {
        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isOk());
    }

    @Test
    void authenticatedEndpoint_rejectsAnonymous() throws Exception {
        mockMvc.perform(delete("/api/v1/auth/account")
                        .contentType("application/json")
                        .content("{\"password\":\"Passw0rd!\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void devEndpoint_rejectsFreeUser() throws Exception {
        User freeUser = saveUser(UserClass.FREE);

        mockMvc.perform(get("/api/v1/dev/users")
                        .header(HttpHeaders.AUTHORIZATION, bearer(freeUser)))
                .andExpect(status().isForbidden());
    }

    @Test
    void devEndpoint_allowsDevUser() throws Exception {
        User devUser = saveUser(UserClass.DEV);

        mockMvc.perform(get("/api/v1/dev/users")
                        .param("q", "")
                        .header(HttpHeaders.AUTHORIZATION, bearer(devUser)))
                .andExpect(status().isOk());
    }

    private User saveUser(UserClass userClass) {
        String suffix = Long.toUnsignedString(System.nanoTime());
        return userRepository.save(User.builder()
                .email(userClass.getValue() + "_" + suffix + "@example.com")
                .password("unused")
                .nickname(userClass.getValue() + suffix.substring(Math.max(0, suffix.length() - 8)))
                .userClass(userClass)
                .build());
    }

    private String bearer(User user) {
        return "Bearer " + jwtTokenProvider.createAccessToken(user);
    }
}
