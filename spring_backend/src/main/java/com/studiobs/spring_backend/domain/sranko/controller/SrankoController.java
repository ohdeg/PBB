package com.studiobs.spring_backend.domain.sranko.controller;

import com.studiobs.spring_backend.domain.auth.support.AccessTokenResolver;
import com.studiobs.spring_backend.domain.sranko.client.VertexGeminiTryOnClient;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoCommentCreateRequest;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoCommentResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoLikeToggleResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoItemResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoItemUpsertRequest;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoLookCreateRequest;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoLookResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPostCreateRequest;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPostResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPredictResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPlaceSearchHit;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPrefsPatchRequest;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPrefsResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoFitCheckResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoTryOnRequest;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoTryOnResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoUploadResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoWeatherResponse;
import com.studiobs.spring_backend.domain.sranko.service.SrankoService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/sranko")
@RequiredArgsConstructor
public class SrankoController {

    private final SrankoService srankoService;
    private final AccessTokenResolver accessTokenResolver;

    @PostMapping(value = "/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public SrankoUploadResponse upload(
            HttpServletRequest request,
            @RequestParam String kind,
            @RequestParam("file") MultipartFile file
    ) {
        return srankoService.upload(accessTokenResolver.requireEmail(request), kind, file);
    }

    @DeleteMapping("/uploads")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUpload(
            HttpServletRequest request,
            @RequestParam String url
    ) {
        srankoService.deleteUpload(accessTokenResolver.requireEmail(request), url);
    }

    @GetMapping("/prefs")
    public SrankoPrefsResponse getPrefs(HttpServletRequest request) {
        return srankoService.getPrefs(accessTokenResolver.requireEmail(request));
    }

    @PatchMapping("/prefs")
    public SrankoPrefsResponse patchPrefs(
            HttpServletRequest request,
            @RequestBody SrankoPrefsPatchRequest body
    ) {
        return srankoService.patchPrefs(accessTokenResolver.requireEmail(request), body);
    }

    @GetMapping("/items")
    public List<SrankoItemResponse> listItems(HttpServletRequest request) {
        return srankoService.listItems(accessTokenResolver.requireEmail(request));
    }

    @PutMapping("/items")
    public SrankoItemResponse upsertItem(
            HttpServletRequest request,
            @Valid @RequestBody SrankoItemUpsertRequest body
    ) {
        return srankoService.upsertItem(accessTokenResolver.requireEmail(request), body);
    }

    @DeleteMapping("/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(HttpServletRequest request, @PathVariable UUID itemId) {
        srankoService.deleteItem(accessTokenResolver.requireEmail(request), itemId);
    }

    @GetMapping("/looks")
    public List<SrankoLookResponse> listLooks(HttpServletRequest request) {
        return srankoService.listLooks(accessTokenResolver.requireEmail(request));
    }

    @PostMapping("/looks")
    @ResponseStatus(HttpStatus.CREATED)
    public SrankoLookResponse createLook(
            HttpServletRequest request,
            @Valid @RequestBody SrankoLookCreateRequest body
    ) {
        return srankoService.createLook(accessTokenResolver.requireEmail(request), body);
    }

    @DeleteMapping("/looks/{lookId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLook(HttpServletRequest request, @PathVariable UUID lookId) {
        srankoService.deleteLook(accessTokenResolver.requireEmail(request), lookId);
    }

    @GetMapping("/posts")
    public List<SrankoPostResponse> listPosts(
            HttpServletRequest request,
            @RequestParam(defaultValue = "new") String sort
    ) {
        UUID viewerId = resolveUserId(accessTokenResolver.findEmail(request).orElse(null));
        return srankoService.listPosts(sort, viewerId);
    }

    @GetMapping("/posts/mine")
    public List<SrankoPostResponse> listMyPosts(HttpServletRequest request) {
        return srankoService.listMyPosts(accessTokenResolver.requireEmail(request));
    }

    @GetMapping("/posts/{postId}")
    public SrankoPostResponse getPost(HttpServletRequest request, @PathVariable UUID postId) {
        UUID viewerId = resolveUserId(accessTokenResolver.findEmail(request).orElse(null));
        return srankoService.getPost(postId, viewerId);
    }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    public SrankoPostResponse createPost(
            HttpServletRequest request,
            @Valid @RequestBody SrankoPostCreateRequest body
    ) {
        return srankoService.createPost(accessTokenResolver.requireEmail(request), body);
    }

    @DeleteMapping("/posts/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(HttpServletRequest request, @PathVariable UUID postId) {
        srankoService.deletePost(accessTokenResolver.requireEmail(request), postId);
    }

    @PostMapping("/posts/{postId}/read")
    public SrankoPostResponse bumpRead(
            HttpServletRequest request,
            @PathVariable UUID postId,
            @RequestHeader(value = "X-Sranko-Viewer", required = false) String viewerHeader
    ) {
        Optional<String> email = accessTokenResolver.findEmail(request);
        UUID viewerUserId = resolveUserId(email.orElse(null));
        String viewerKey = viewerUserId != null
                ? "user:" + viewerUserId
                : resolveAnonViewerKey(viewerHeader);
        return srankoService.bumpRead(postId, viewerKey, viewerUserId);
    }

    @PostMapping("/posts/{postId}/like")
    public SrankoLikeToggleResponse togglePostLike(
            HttpServletRequest request,
            @PathVariable UUID postId
    ) {
        return srankoService.togglePostLike(accessTokenResolver.requireEmail(request), postId);
    }

    @GetMapping("/posts/{postId}/comments")
    public List<SrankoCommentResponse> listComments(
            HttpServletRequest request,
            @PathVariable UUID postId
    ) {
        UUID viewerId = resolveUserId(accessTokenResolver.findEmail(request).orElse(null));
        return srankoService.listComments(postId, viewerId);
    }

    @PostMapping("/posts/{postId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public SrankoCommentResponse createComment(
            HttpServletRequest request,
            @PathVariable UUID postId,
            @Valid @RequestBody SrankoCommentCreateRequest body
    ) {
        return srankoService.createComment(
                accessTokenResolver.requireEmail(request),
                postId,
                body
        );
    }

    @DeleteMapping("/posts/{postId}/comments/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(
            HttpServletRequest request,
            @PathVariable UUID postId,
            @PathVariable UUID commentId
    ) {
        srankoService.deleteComment(
                accessTokenResolver.requireEmail(request),
                postId,
                commentId
        );
    }

    @PostMapping("/posts/{postId}/comments/{commentId}/like")
    public SrankoLikeToggleResponse toggleCommentLike(
            HttpServletRequest request,
            @PathVariable UUID postId,
            @PathVariable UUID commentId
    ) {
        return srankoService.toggleCommentLike(
                accessTokenResolver.requireEmail(request),
                postId,
                commentId
        );
    }

    private UUID resolveUserId(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        return srankoService.findUserIdByEmail(email).orElse(null);
    }

    private static String resolveAnonViewerKey(String header) {
        if (header != null) {
            String trimmed = header.trim();
            if (trimmed.length() >= 8 && trimmed.length() <= 80 && trimmed.matches("[A-Za-z0-9_-]+")) {
                return "anon:" + trimmed;
            }
        }
        return "anon:" + UUID.randomUUID();
    }

    @GetMapping(value = "/assets/default-person", produces = MediaType.IMAGE_PNG_VALUE)
    public byte[] defaultPerson(HttpServletRequest request) {
        String email = accessTokenResolver.requireEmail(request);
        String sex = srankoService.getPrefs(email).sex();
        return VertexGeminiTryOnClient.loadDefaultPerson(sex).bytes();
    }

    @GetMapping("/fit-check")
    public SrankoFitCheckResponse fitCheck(
            HttpServletRequest request,
            @RequestParam UUID itemId
    ) {
        return srankoService.fitCheck(accessTokenResolver.requireEmail(request), itemId);
    }

    @PostMapping("/ml/try-on")
    public SrankoTryOnResponse tryOn(
            HttpServletRequest request,
            @Valid @RequestBody SrankoTryOnRequest body
    ) {
        return srankoService.tryOn(accessTokenResolver.requireEmail(request), body);
    }

    @PostMapping(value = "/ml/predict", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SrankoPredictResponse predict(
            HttpServletRequest request,
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "false") boolean extractWornGarment,
            @RequestParam(required = false) String targetSlot
    ) {
        return srankoService.predictItem(
                accessTokenResolver.requireEmail(request),
                file,
                extractWornGarment,
                targetSlot
        );
    }

    @GetMapping("/weather")
    public SrankoWeatherResponse weather(
            HttpServletRequest request,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lon,
            @RequestParam(required = false) Double tempC
    ) {
        return srankoService.getWeather(accessTokenResolver.requireEmail(request), lat, lon, tempC);
    }

    @GetMapping("/places/search")
    public List<SrankoPlaceSearchHit> searchPlaces(
            HttpServletRequest request,
            @RequestParam String q
    ) {
        return srankoService.searchPlaces(accessTokenResolver.requireEmail(request), q);
    }
}
