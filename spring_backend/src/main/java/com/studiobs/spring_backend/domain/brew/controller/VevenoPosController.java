package com.studiobs.spring_backend.domain.brew.controller;

import com.studiobs.spring_backend.domain.auth.support.AccessTokenResolver;
import com.studiobs.spring_backend.domain.brew.dto.PosApproveRequest;
import com.studiobs.spring_backend.domain.brew.dto.PosCreateSessionRequest;
import com.studiobs.spring_backend.domain.brew.dto.PosCreateSessionResponse;
import com.studiobs.spring_backend.domain.brew.dto.PosDeviceResponse;
import com.studiobs.spring_backend.domain.brew.dto.PosMeResponse;
import com.studiobs.spring_backend.domain.brew.dto.PosPollRequest;
import com.studiobs.spring_backend.domain.brew.dto.PosPollResponse;
import com.studiobs.spring_backend.domain.brew.dto.PosSecretRequest;
import com.studiobs.spring_backend.domain.brew.dto.PosTokenResponse;
import com.studiobs.spring_backend.domain.brew.service.VevenoPosService;
import com.studiobs.spring_backend.global.common.MessageResponse;
import com.studiobs.spring_backend.global.web.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/v1/brew", "/api/v1/veveno"})
@RequiredArgsConstructor
public class VevenoPosController {

    private final VevenoPosService vevenoPosService;
    private final AccessTokenResolver accessTokenResolver;

    @PostMapping("/pos/sessions")
    public PosCreateSessionResponse createSession(
            HttpServletRequest request,
            @Valid @RequestBody PosCreateSessionRequest body
    ) {
        return vevenoPosService.createPair(body.deviceId(), ClientIpResolver.resolve(request));
    }

    @PostMapping("/pos/sessions/poll")
    public PosPollResponse poll(@Valid @RequestBody PosPollRequest body) {
        return vevenoPosService.poll(body.pairs());
    }

    @PostMapping("/pos/sessions/{pairId}/claim")
    public PosTokenResponse claim(
            @PathVariable UUID pairId,
            @Valid @RequestBody PosSecretRequest body
    ) {
        return vevenoPosService.claim(pairId, body.secret());
    }

    @PostMapping("/pos/sessions/{pairId}/approve")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void approve(
            HttpServletRequest request,
            @PathVariable UUID pairId,
            @Valid @RequestBody PosApproveRequest body
    ) {
        vevenoPosService.approve(accessTokenResolver.requireEmail(request), pairId, body);
    }

    @GetMapping("/pos/session")
    public PosMeResponse me(HttpServletRequest request) {
        return vevenoPosService.me(bearer(request));
    }

    @PostMapping("/pos/session/extend")
    public PosTokenResponse extend(HttpServletRequest request) {
        return vevenoPosService.extend(accessTokenResolver.requireEmail(request));
    }

    @DeleteMapping("/pos/session")
    public MessageResponse logout() {
        vevenoPosService.logout();
        return new MessageResponse("POS 연결이 해제되었습니다.", "POS_LOGGED_OUT");
    }

    @GetMapping("/stores/{storeId}/pos-devices")
    public List<PosDeviceResponse> listDevices(
            HttpServletRequest request,
            @PathVariable UUID storeId
    ) {
        return vevenoPosService.listDevices(accessTokenResolver.requireEmail(request), storeId);
    }

    @DeleteMapping("/stores/{storeId}/pos-devices/{deviceId}")
    public MessageResponse revokeDevice(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @PathVariable UUID deviceId
    ) {
        vevenoPosService.revokeDevice(accessTokenResolver.requireEmail(request), storeId, deviceId);
        return new MessageResponse("POS 등록을 해제했습니다.", "POS_DEVICE_REVOKED");
    }

    private static String bearer(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            return "";
        }
        return header.substring("Bearer ".length()).trim();
    }
}
