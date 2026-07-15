package com.studiobs.spring_backend.domain.dev.controller;

import com.studiobs.spring_backend.domain.auth.support.AccessTokenResolver;
import com.studiobs.spring_backend.domain.dev.dto.UpdateUserClassRequest;
import com.studiobs.spring_backend.domain.dev.service.DevAdminService;
import com.studiobs.spring_backend.domain.user.dto.UserResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dev")
@RequiredArgsConstructor
public class DevAdminController {

    private final DevAdminService devAdminService;
    private final AccessTokenResolver accessTokenResolver;

    @GetMapping("/users")
    @ResponseStatus(HttpStatus.OK)
    public List<UserResponse> searchUsers(
            HttpServletRequest request,
            @RequestParam(name = "q", defaultValue = "") String query
    ) {
        String actorEmail = accessTokenResolver.requireEmail(request);
        return devAdminService.searchUsers(actorEmail, query);
    }

    @PatchMapping("/users/class")
    @ResponseStatus(HttpStatus.OK)
    public UserResponse updateUserClass(
            HttpServletRequest request,
            @Valid @RequestBody UpdateUserClassRequest body
    ) {
        String actorEmail = accessTokenResolver.requireEmail(request);
        return devAdminService.updateUserClass(actorEmail, body.query(), body.userClass());
    }
}
