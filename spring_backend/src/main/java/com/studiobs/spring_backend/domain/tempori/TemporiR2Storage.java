package com.studiobs.spring_backend.domain.tempori;

import com.studiobs.spring_backend.global.config.R2Properties;
import com.studiobs.spring_backend.global.exception.BusinessException;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.*;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Component
public class TemporiR2Storage implements TemporiPrivateStorage {
    private final String bucket;
    private final S3Client client;
    private final S3Presigner presigner;
    public TemporiR2Storage(R2Properties config, @Value("${tempori.r2-bucket:}") String bucket) {
        this.bucket=bucket;
        boolean configured=!blank(bucket) && !bucket.equals(config.bucket()) && !blank(config.endpoint()) && !blank(config.accessKeyId()) && !blank(config.secretAccessKey());
        if(!configured) { client=null; presigner=null; return; }
        var credentials=StaticCredentialsProvider.create(AwsBasicCredentials.create(config.accessKeyId(),config.secretAccessKey()));
        var service=S3Configuration.builder().pathStyleAccessEnabled(true).build();
        var region=Region.of(blank(config.region()) ? "auto" : config.region());
        client=S3Client.builder().endpointOverride(URI.create(config.endpoint())).region(region).credentialsProvider(credentials).serviceConfiguration(service)
                .overrideConfiguration(c -> c.apiCallTimeout(Duration.ofMinutes(2)).apiCallAttemptTimeout(Duration.ofSeconds(40))).build();
        presigner=S3Presigner.builder().endpointOverride(URI.create(config.endpoint())).region(region).credentialsProvider(credentials).serviceConfiguration(service).build();
    }
    private static boolean blank(String value) { return value==null || value.isBlank(); }
    public void requireAvailable() { if(client==null) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"TEMPORI_STORAGE_UNAVAILABLE","계정 보관함을 아직 사용할 수 없습니다. 이 기기의 원본은 유지됩니다."); }
    public void put(String key,byte[] bytes,String hash) {
        requireAvailable(); client.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType("application/octet-stream").metadata(Map.of("sha256",hash)).build(),RequestBody.fromBytes(bytes));
        var head=client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());
        if(head.contentLength()!=bytes.length || !hash.equals(head.metadata().get("sha256"))) throw new IllegalStateException("Score object verification failed");
    }
    public void delete(String key) { requireAvailable(); client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build()); }
    public Download download(String key) {
        requireAvailable(); Instant expiry=Instant.now().plusSeconds(300);
        String url=presigner.presignGetObject(GetObjectPresignRequest.builder().signatureDuration(Duration.ofMinutes(5))
                .getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(key).responseCacheControl("private, no-store").build()).build()).url().toString();
        return new Download(url,expiry);
    }
    @PreDestroy public void close() { if(client!=null) client.close(); if(presigner!=null) presigner.close(); }
}
