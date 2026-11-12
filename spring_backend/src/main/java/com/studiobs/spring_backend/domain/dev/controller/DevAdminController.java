package com.studiobs.spring_backend.domain.dev.controller;

import com.studiobs.spring_backend.domain.auth.support.AccessTokenResolver;
import com.studiobs.spring_backend.domain.config.dto.FeaturedAppResponse;
import com.studiobs.spring_backend.domain.dev.dto.UpdateFeaturedAppRequest;
import com.studiobs.spring_backend.domain.dev.dto.UpdateUserClassRequest;
import com.studiobs.spring_backend.domain.dev.service.DevAdminService;
import com.studiobs.spring_backend.domain.user.dto.UserResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import com.studiobs.spring_backend.domain.dev.operations.OperationsLog;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

    @GetMapping("/operations/today")
    public ResponseEntity<OperationsLog.Today> today(
            HttpServletRequest request, @RequestParam(required = false) String cursor) {
        Long before = null;
        if (cursor != null) {
            try {
                before = Long.parseLong(cursor);
                if (before <= 0) throw new NumberFormatException();
            } catch (NumberFormatException invalid) {
                throw new com.studiobs.spring_backend.global.exception.BusinessException(HttpStatus.BAD_REQUEST, "잘못된 이력 커서입니다.");
            }
        }
        var result = devAdminService.today(accessTokenResolver.requireEmail(request), before);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore()).body(result);
    }

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

    @PutMapping("/featured-app")
    @ResponseStatus(HttpStatus.OK)
    public FeaturedAppResponse updateFeaturedApp(
            HttpServletRequest request,
            @Valid @RequestBody UpdateFeaturedAppRequest body
    ) {
        String actorEmail = accessTokenResolver.requireEmail(request);
        return new FeaturedAppResponse(devAdminService.updateFeaturedApps(actorEmail, body.appIds()));
    }
}
