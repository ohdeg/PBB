package com.studiobs.spring_backend.domain.config.controller;

import com.studiobs.spring_backend.domain.config.dto.FeaturedAppResponse;
import com.studiobs.spring_backend.domain.config.service.AppConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/config")
@RequiredArgsConstructor
public class ConfigController {

    private final AppConfigService appConfigService;

    @GetMapping("/featured-app")
    @ResponseStatus(HttpStatus.OK)
    public FeaturedAppResponse getFeaturedApp() {
        return new FeaturedAppResponse(appConfigService.getFeaturedAppIds());
    }
}
