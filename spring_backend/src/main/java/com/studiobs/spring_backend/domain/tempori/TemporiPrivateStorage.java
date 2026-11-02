package com.studiobs.spring_backend.domain.tempori;
import java.time.Instant;
public interface TemporiPrivateStorage {
    void requireAvailable();
    void put(String key, byte[] bytes, String hash);
    void delete(String key);
    Download download(String key);
    record Download(String url, Instant expiresAt) {}
}
