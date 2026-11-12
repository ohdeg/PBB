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
    void dietaProfile_rejectsAnonymous() throws Exception {
        mockMvc.perform(get("/api/v1/dieta/profile"))
                .andExpect(status().isUnauthorized());
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

    @Test
    void operationalDataRequiresCurrentDevRoleAndNeverCaches() throws Exception {
        var dev = saveUser(UserClass.DEV);
        String token = bearer(dev);
        String path = "/api/v1/dev/operations/today";
        mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
        mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string(
                        "Cache-Control", "no-store"));
        mockMvc.perform(get(path).param("cursor", "bad").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isBadRequest());
        dev.changeUserClass(UserClass.FREE);
        userRepository.saveAndFlush(dev);
        mockMvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().isForbidden());
    }

    @Test
    void adminClassChangeAddsOneAuditForActualChangeOnly() throws Exception {
        var actor = saveUser(UserClass.DEV);
        var target = saveUser(UserClass.FREE);
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/v1/dev/users/class")
                            .header(HttpHeaders.AUTHORIZATION, bearer(actor)).contentType("application/json")
                            .content("{\"query\":\"" + target.getNickname() + "\",\"userClass\":\"dev\"}"))
                    .andExpect(status().isOk());
        }
        var auditIds = org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath(
                "$.changes[?(@.target == '" + target.getId() + "' && @.before == 'FREE' && @.after == 'DEV')].id");
        mockMvc.perform(get("/api/v1/dev/operations/today").header(HttpHeaders.AUTHORIZATION, bearer(actor)))
                .andExpect(status().isOk()).andExpect(auditIds.value(org.hamcrest.Matchers.hasSize(1)));
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
