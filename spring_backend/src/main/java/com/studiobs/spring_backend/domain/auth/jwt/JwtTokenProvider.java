package com.studiobs.spring_backend.domain.auth.jwt;

import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.entity.UserClass;
import com.studiobs.spring_backend.global.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {

    private static final String CLAIM_TOKEN_TYPE = "type";
    private static final String TOKEN_TYPE_ACCESS = "access";
    private static final String TOKEN_TYPE_REFRESH = "refresh";
    private static final String TOKEN_TYPE_POS = "pos";
    private static final String CLAIM_USER_ID = "userId";
    private static final String CLAIM_NICKNAME = "nickname";
    private static final String CLAIM_USER_CLASS = "userClass";
    private static final String CLAIM_STORE_ID = "storeId";
    private static final String CLAIM_CAN_EDIT_STOCK = "canEditStock";
    private static final String CLAIM_DEVICE_ID = "deviceId";

    private final JwtProperties jwtProperties;
    private final SecretKey secretKey;

    public JwtTokenProvider(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
        this.secretKey = Keys.hmacShaKeyFor(
                jwtProperties.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(User user) {
        return createToken(user, TOKEN_TYPE_ACCESS, jwtProperties.accessTokenExpiry().toMillis());
    }

    public String createRefreshToken(User user) {
        return createToken(user, TOKEN_TYPE_REFRESH, jwtProperties.refreshTokenExpiry().toMillis());
    }

    public String createPosToken(User user, UUID storeId, boolean canEditStock, String deviceId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + jwtProperties.posTokenExpiry().toMillis());
        return Jwts.builder()
                .subject(user.getEmail())
                .claim(CLAIM_USER_ID, user.getId().toString())
                .claim(CLAIM_NICKNAME, user.getNickname())
                .claim(CLAIM_USER_CLASS, user.getUserClass().getValue())
                .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE_POS)
                .claim(CLAIM_STORE_ID, storeId.toString())
                .claim(CLAIM_CAN_EDIT_STOCK, canEditStock)
                .claim(CLAIM_DEVICE_ID, deviceId)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(secretKey)
                .compact();
    }

    public String getEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public UserClass getUserClass(String token) {
        return UserClass.from(parseClaims(token).get(CLAIM_USER_CLASS, String.class));
    }

    public boolean isAccessToken(String token) {
        return TOKEN_TYPE_ACCESS.equals(parseClaims(token).get(CLAIM_TOKEN_TYPE, String.class));
    }

    public boolean isRefreshToken(String token) {
        return TOKEN_TYPE_REFRESH.equals(parseClaims(token).get(CLAIM_TOKEN_TYPE, String.class));
    }

    public boolean isPosToken(String token) {
        return TOKEN_TYPE_POS.equals(parseClaims(token).get(CLAIM_TOKEN_TYPE, String.class));
    }

    public UUID getStoreId(String token) {
        return UUID.fromString(parseClaims(token).get(CLAIM_STORE_ID, String.class));
    }

    public String getDeviceId(String token) {
        return parseClaims(token).get(CLAIM_DEVICE_ID, String.class);
    }

    public Instant getExpiry(String token) {
        return parseClaims(token).getExpiration().toInstant();
    }

    public boolean isValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    private String createToken(User user, String tokenType, long expiryMillis) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expiryMillis);

        return Jwts.builder()
                .subject(user.getEmail())
                .claim(CLAIM_USER_ID, user.getId().toString())
                .claim(CLAIM_NICKNAME, user.getNickname())
                .claim(CLAIM_USER_CLASS, user.getUserClass().getValue())
                .claim(CLAIM_TOKEN_TYPE, tokenType)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(secretKey)
                .compact();
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
