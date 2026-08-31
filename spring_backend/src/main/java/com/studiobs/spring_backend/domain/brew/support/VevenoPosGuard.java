package com.studiobs.spring_backend.domain.brew.support;

import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.domain.brew.dto.PosSessionState;
import com.studiobs.spring_backend.domain.brew.repository.BrewPosDeviceRepository;
import com.studiobs.spring_backend.domain.brew.service.VevenoPosRedisService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class VevenoPosGuard {

    private final JwtTokenProvider jwtTokenProvider;
    private final VevenoPosRedisService posRedisService;
    private final BrewPosDeviceRepository posDeviceRepository;

    public boolean bind(String token) {
        try {
            String deviceId = jwtTokenProvider.getDeviceId(token);
            UUID storeId = jwtTokenProvider.getStoreId(token);
            PosSessionState session = posRedisService.getSession(deviceId);
            if (session == null
                    || !session.storeId().equals(storeId)
                    || !session.deviceId().equals(deviceId)) {
                return false;
            }
            if (!posDeviceRepository.existsByStoreIdAndDeviceId(storeId, deviceId)) {
                return false;
            }
            PosAccess.set(new PosAccess.Snapshot(
                    session.userId(),
                    storeId,
                    session.canEditStock(),
                    deviceId));
            return true;
        } catch (RuntimeException ex) {
            return false;
        }
    }
}
