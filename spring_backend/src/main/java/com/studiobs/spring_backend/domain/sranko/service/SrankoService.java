package com.studiobs.spring_backend.domain.sranko.service;

import com.studiobs.spring_backend.domain.sranko.client.SrankoMlClient;
import com.studiobs.spring_backend.domain.sranko.client.VertexGeminiTryOnClient;
import com.studiobs.spring_backend.domain.sranko.client.WeatherApiClient;
import com.studiobs.spring_backend.domain.sranko.config.SrankoTryOnProperties;
import com.studiobs.spring_backend.domain.sranko.config.SrankoVertexProperties;
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
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPlaceDto;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPlaceSearchHit;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPrefsPatchRequest;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPrefsResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoFitCheckResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoTryOnRequest;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoTryOnResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoUploadResponse;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoWeatherResponse;
import com.studiobs.spring_backend.domain.sranko.entity.SrankoItem;
import com.studiobs.spring_backend.domain.sranko.entity.SrankoLook;
import com.studiobs.spring_backend.domain.sranko.entity.SrankoPost;
import com.studiobs.spring_backend.domain.sranko.entity.SrankoPostComment;
import com.studiobs.spring_backend.domain.sranko.entity.SrankoPostCommentLike;
import com.studiobs.spring_backend.domain.sranko.entity.SrankoPostLike;
import com.studiobs.spring_backend.domain.sranko.entity.SrankoPrefs;
import com.studiobs.spring_backend.domain.sranko.repository.SrankoItemRepository;
import com.studiobs.spring_backend.domain.sranko.repository.SrankoLookRepository;
import com.studiobs.spring_backend.domain.sranko.repository.SrankoPostCommentLikeRepository;
import com.studiobs.spring_backend.domain.sranko.repository.SrankoPostCommentRepository;
import com.studiobs.spring_backend.domain.sranko.repository.SrankoPostLikeRepository;
import com.studiobs.spring_backend.domain.sranko.repository.SrankoPostRepository;
import com.studiobs.spring_backend.domain.sranko.repository.SrankoPrefsRepository;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import com.studiobs.spring_backend.global.r2.R2StorageService;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Service
@RequiredArgsConstructor
public class SrankoService {

    private static final Set<String> UPLOAD_KINDS = Set.of("item", "look", "post", "tryon");
    private static final Set<String> WORN_GARMENT_SLOTS = Set.of("TOP", "BOTTOM", "OUTER", "DRESS");
    private static final Set<String> WARMTHLESS_SLOTS = Set.of("SHOES", "BAG", "HAT", "JEWELRY");
    private static final Map<String, Set<String>> SLOT_CATEGORIES = Map.of(
            "TOP", Set.of("민소매", "반팔", "긴팔", "셔츠", "후드", "맨투맨", "니트"),
            "BOTTOM", Set.of("반바지", "데님", "면바지", "슬랙스", "치마"),
            "OUTER", Set.of("자켓", "코트", "패딩", "외투"),
            "SHOES", Set.of("캐주얼", "운동화", "드레스슈즈", "부츠"),
            // DRESS slot = 원피스; categoryCode = sleeve style (legacy "원피스" → 긴팔)
            "DRESS", Set.of("민소매", "반팔", "긴팔"),
            "BAG", Set.of("토트", "숄더", "크로스", "백팩", "클러치"),
            "HAT", Set.of("캡", "비니", "버킷", "기타"),
            "JEWELRY", Set.of("목걸이", "귀걸이", "반지", "팔찌", "기타")
    );
    private static final Map<String, String> SLOT_DEFAULT_CATEGORY = Map.of(
            "TOP", "긴팔",
            "BOTTOM", "면바지",
            "OUTER", "자켓",
            "SHOES", "캐주얼",
            "DRESS", "긴팔",
            "BAG", "토트",
            "HAT", "캡",
            "JEWELRY", "목걸이"
    );
    private static final long MAX_UPLOAD_BYTES = 8L * 1024 * 1024;
    private static final Set<String> BODY_MEASUREMENT_KEYS = Set.of(
            "height",
            "weight",
            "shoulder",
            "chest",
            "waist",
            "hip",
            "armLength",
            "armCircumference",
            "torsoLength",
            "inseam",
            "thighCircumference",
            "legLength",
            "shoeSize"
    );
    private static final TypeReference<Map<String, String>> STRING_MAP =
            new TypeReference<>() {};
    private static final TypeReference<List<UUID>> UUID_LIST = new TypeReference<>() {};
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final TypeReference<List<SrankoPlaceDto>> PLACE_LIST = new TypeReference<>() {};
    private static final int POST_IMAGE_MAX = 10;
    private static final int MAX_FAVORITE_PLACES = 5;
    private static final int MAX_PLACE_LABEL = 40;

    private final UserService userService;
    private final UserRepository userRepository;
    private final SrankoPrefsRepository prefsRepository;
    private final SrankoItemRepository itemRepository;
    private final SrankoLookRepository lookRepository;
    private final SrankoPostRepository postRepository;
    private final SrankoPostLikeRepository postLikeRepository;
    private final SrankoPostCommentRepository postCommentRepository;
    private final SrankoPostCommentLikeRepository postCommentLikeRepository;
    private final SrankoPostViewDedupeService postViewDedupeService;
    private final VertexGeminiTryOnClient vertexGeminiTryOnClient;
    private final SrankoVertexProperties vertexProperties;
    private final SrankoTryOnProperties tryOnProperties;
    private final SrankoMlClient srankoMlClient;
    private final SrankoWeatherCacheService weatherCacheService;
    private final SrankoTryOnBodyCacheService tryOnBodyCacheService;
    private final SrankoTryOnEphemeralService tryOnEphemeralService;
    private final SrankoPlaceCatalogService placeCatalogService;
    private final WeatherApiClient weatherApiClient;
    private final R2StorageService r2StorageService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public SrankoPrefsResponse getPrefs(String email) {
        User user = requireUser(email);
        return prefsRepository.findById(user.getId())
                .map(prefs -> SrankoPrefsResponse.from(
                        prefs,
                        sanitizeBodyMeasurements(readStringMap(prefs.getBodyMeasurementsJson())),
                        readPlaces(prefs.getPlacesJson())
                ))
                .orElseGet(SrankoPrefsResponse::empty);
    }

    @Transactional
    public SrankoPrefsResponse patchPrefs(String email, SrankoPrefsPatchRequest body) {
        User user = requireUser(email);
        SrankoPrefs prefs = prefsRepository.findById(user.getId())
                .orElseGet(() -> SrankoPrefs.builder()
                        .userId(user.getId())
                        .tryOnConsent(false)
                        .bodyMeasurementsJson("{}")
                        .placesJson("[]")
                        .build());

        String bodyJson = null;
        if (body.bodyMeasurements() != null) {
            bodyJson = writeJson(sanitizeBodyMeasurements(body.bodyMeasurements()));
        }
        String placesJson = null;
        if (body.places() != null) {
            placesJson = writeJson(sanitizePlaces(body.places()));
        }
        if (body.sex() != null && !body.sex().isBlank()) {
            String upper = body.sex().trim().toUpperCase(Locale.ROOT);
            if (!"M".equals(upper) && !"F".equals(upper)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "성별은 M 또는 F여야 합니다.");
            }
        }
        prefs.patch(
                body.tryOnConsent(),
                body.sex(),
                bodyJson,
                placesJson
        );
        SrankoPrefs saved = prefsRepository.save(prefs);
        return SrankoPrefsResponse.from(
                saved,
                sanitizeBodyMeasurements(readStringMap(saved.getBodyMeasurementsJson())),
                readPlaces(saved.getPlacesJson())
        );
    }

    @Transactional
    public SrankoUploadResponse upload(String email, String kindRaw, MultipartFile file) {
        User user = requireUser(email);
        r2StorageService.requireEnabled();
        String kind = kindRaw == null ? "" : kindRaw.trim().toLowerCase(Locale.ROOT);
        if (!UPLOAD_KINDS.contains(kind)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "업로드 kind가 올바르지 않습니다.");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지 파일이 비어 있습니다.");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지는 8MB 이하여야 합니다.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지 파일만 업로드할 수 있습니다.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지를 읽을 수 없습니다.");
        }

        String ext = contentType.toLowerCase(Locale.ROOT).contains("png") ? "png" : "jpg";
        String objectKey = r2StorageService.keyPrefix()
                + "sranko/"
                + user.getId()
                + "/"
                + kind
                + "/"
                + UUID.randomUUID()
                + "."
                + ext;
        String url = r2StorageService.putObject(objectKey, bytes, contentType);
        if ("tryon".equals(kind)) {
            tryOnEphemeralService.schedule(objectKey);
        }

        return new SrankoUploadResponse(url, objectKey, kind);
    }

    public void deleteUpload(String email, String publicUrl) {
        User user = requireUser(email);
        if (publicUrl == null || publicUrl.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "삭제할 이미지 URL이 비어 있습니다.");
        }
        String expectedPrefix = r2StorageService.keyPrefix() + "sranko/" + user.getId() + "/";
        var key = r2StorageService.keyFromPublicUrl(publicUrl.trim());
        if (key.isEmpty() || !key.get().startsWith(expectedPrefix)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "본인 업로드만 삭제할 수 있습니다.");
        }
        tryOnEphemeralService.cancel(key.get());
        r2StorageService.deleteByPublicUrl(publicUrl.trim());
    }

    public SrankoPredictResponse predictItem(String email, MultipartFile file) {
        return predictItem(email, file, false, null);
    }

    public SrankoPredictResponse predictItem(
            String email,
            MultipartFile file,
            boolean extractWornGarment,
            String targetSlot
    ) {
        requireUser(email);
        String normalizedTarget = targetSlot == null
                ? null
                : targetSlot.trim().toUpperCase(Locale.ROOT);
        if (extractWornGarment && !WORN_GARMENT_SLOTS.contains(normalizedTarget)) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "착용 사진 추출 시 종류는 TOP, BOTTOM, OUTER, DRESS 중 하나여야 합니다."
            );
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지 파일이 비어 있습니다.");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지는 8MB 이하여야 합니다.");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지를 읽을 수 없습니다.");
        }

        var ml = srankoMlClient.predict(
                bytes,
                file.getOriginalFilename(),
                file.getContentType(),
                extractWornGarment,
                normalizedTarget
        );
        if (extractWornGarment && !Boolean.TRUE.equals(ml.garmentExtractionApplied())) {
            String warning = ml.extractionWarning() == null || ml.extractionWarning().isBlank()
                    ? "착용 사진에서 옷을 안전하게 추출하지 못했습니다. 다른 사진을 사용해 주세요."
                    : ml.extractionWarning();
            return new SrankoPredictResponse(
                    null,
                    null,
                    normalizedTarget,
                    SLOT_DEFAULT_CATEGORY.get(normalizedTarget),
                    3,
                    ml.taxonomyGroup(),
                    ml.classNum(),
                    ml.category1(),
                    ml.category2(),
                    false,
                    ml.width(),
                    ml.height(),
                    false,
                    warning
            );
        }
        if (ml.rejected()) {
            return new SrankoPredictResponse(
                    null,
                    null,
                    null,
                    null,
                    null,
                    ml.taxonomyGroup(),
                    ml.classNum(),
                    ml.category1(),
                    ml.category2(),
                    true,
                    ml.width(),
                    ml.height(),
                    Boolean.TRUE.equals(ml.garmentExtractionApplied()),
                    ml.extractionWarning()
            );
        }
        String pngBase64 = ml.imagePngBase64();
        if (pngBase64 == null || pngBase64.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "배경제거 결과가 비어 있습니다.");
        }
        String responseSlot = extractWornGarment ? normalizedTarget : ml.slot();
        String responseCategory = ml.categoryCode();
        if (extractWornGarment
                && !SLOT_CATEGORIES.get(normalizedTarget).contains(responseCategory)) {
            responseCategory = SLOT_DEFAULT_CATEGORY.get(normalizedTarget);
        }
        return new SrankoPredictResponse(
                null,
                pngBase64,
                responseSlot,
                responseCategory,
                ml.warmth(),
                ml.taxonomyGroup(),
                ml.classNum(),
                ml.category1(),
                ml.category2(),
                false,
                ml.width(),
                ml.height(),
                Boolean.TRUE.equals(ml.garmentExtractionApplied()),
                ml.extractionWarning()
        );
    }

    @Transactional(readOnly = true)
    public List<SrankoItemResponse> listItems(String email) {
        User user = requireUser(email);
        return itemRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toItemResponse)
                .toList();
    }

    @Transactional
    public SrankoItemResponse upsertItem(String email, SrankoItemUpsertRequest body) {
        User user = requireUser(email);
        requireHttpUrl(body.imageUrl());
        String slot = body.slot() != null ? body.slot().trim().toUpperCase(Locale.ROOT) : "";
        Integer warmth = WARMTHLESS_SLOTS.contains(slot) ? null : normalizeWarmth(body.warmth());
        String measurementsJson = writeJson(
                body.measurements() != null ? body.measurements() : Map.of()
        );

        String categoryCode = normalizeCategoryCode(slot, body.categoryCode());

        if (body.id() != null) {
            SrankoItem existing = itemRepository.findByIdAndUserId(body.id(), user.getId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "아이템을 찾을 수 없습니다."));
            String previous = existing.getImageUrl();
            boolean imageChanged = !previous.equals(body.imageUrl());
            existing.update(
                    slot,
                    categoryCode,
                    warmth,
                    body.name().trim(),
                    body.imageUrl(),
                    measurementsJson
            );
            SrankoItem saved = itemRepository.save(existing);
            if (imageChanged) {
                r2StorageService.deleteByPublicUrl(previous);
            }
            return toItemResponse(saved);
        }

        SrankoItem created = SrankoItem.builder()
                .userId(user.getId())
                .slot(slot)
                .categoryCode(categoryCode)
                .warmth(warmth)
                .name(body.name().trim())
                .imageUrl(body.imageUrl())
                .measurementsJson(measurementsJson)
                .build();
        return toItemResponse(itemRepository.save(created));
    }

    @Transactional
    public void deleteItem(String email, UUID itemId) {
        User user = requireUser(email);
        SrankoItem item = itemRepository.findByIdAndUserId(itemId, user.getId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "아이템을 찾을 수 없습니다."));
        String url = item.getImageUrl();
        itemRepository.delete(item);
        r2StorageService.deleteByPublicUrl(url);
    }

    @Transactional(readOnly = true)
    public List<SrankoLookResponse> listLooks(String email) {
        User user = requireUser(email);
        return lookRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::toLookResponse)
                .toList();
    }

    @Transactional
    public SrankoLookResponse createLook(String email, SrankoLookCreateRequest body) {
        User user = requireUser(email);
        requireHttpUrl(body.imageUrl());
        String imageUrl = promoteTryOnImageIfNeeded(user, body.imageUrl().trim());
        List<UUID> itemIds = body.itemIds() != null ? body.itemIds() : List.of();
        SrankoLook look = SrankoLook.builder()
                .userId(user.getId())
                .name(body.name().trim())
                .imageUrl(imageUrl)
                .itemIdsJson(writeJson(itemIds))
                .source(body.source())
                .build();
        return toLookResponse(lookRepository.save(look));
    }

    @Transactional
    public void deleteLook(String email, UUID lookId) {
        User user = requireUser(email);
        SrankoLook look = lookRepository.findByIdAndUserId(lookId, user.getId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "룩을 찾을 수 없습니다."));
        String url = look.getImageUrl();
        lookRepository.delete(look);
        r2StorageService.deleteByPublicUrl(url);
    }

    @Transactional(readOnly = true)
    public List<SrankoPostResponse> listPosts(String sort, UUID viewerUserId) {
        List<SrankoPost> posts = "view".equalsIgnoreCase(sort)
                ? postRepository.findAllByOrderByReadCountDescCreatedAtDesc()
                : postRepository.findAllByOrderByCreatedAtDesc();
        return mapPosts(posts, viewerUserId);
    }

    @Transactional(readOnly = true)
    public List<SrankoPostResponse> listMyPosts(String email) {
        User user = requireUser(email);
        return mapPosts(
                postRepository.findByAuthorUserIdOrderByCreatedAtDesc(user.getId()),
                user.getId()
        );
    }

    @Transactional(readOnly = true)
    public SrankoPostResponse getPost(UUID postId, UUID viewerUserId) {
        SrankoPost post = postRepository.findById(postId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        return toPostResponse(post, viewerUserId, null);
    }

    @Transactional
    public SrankoPostResponse createPost(String email, SrankoPostCreateRequest body) {
        User user = requireUser(email);
        List<String> imageUrls = normalizeIncomingPostImageUrls(body.imageUrls());
        SrankoPost post = SrankoPost.builder()
                .authorUserId(user.getId())
                .subject(body.subject().trim())
                .content(body.content().trim())
                .imageUrl(imageUrls.get(0))
                .imageUrlsJson(writeJson(imageUrls))
                .build();
        return toPostResponse(postRepository.save(post), user.getId(), null);
    }

    @Transactional
    public void deletePost(String email, UUID postId) {
        User user = requireUser(email);
        SrankoPost post = postRepository.findById(postId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        if (!post.getAuthorUserId().equals(user.getId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "본인 게시글만 삭제할 수 있습니다.");
        }
        List<String> urls = resolvePostImageUrls(post);
        postRepository.delete(post);
        for (String url : urls) {
            r2StorageService.deleteByPublicUrl(url);
        }
    }

    @Transactional
    public SrankoPostResponse bumpRead(UUID postId, String viewerKey, UUID viewerUserId) {
        if (!postRepository.existsById(postId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.");
        }
        boolean counted = postViewDedupeService.tryAcquire(postId, viewerKey);
        if (counted) {
            postRepository.incrementReadCount(postId);
        }
        SrankoPost post = postRepository.findById(postId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        return toPostResponse(post, viewerUserId, counted);
    }

    @Transactional
    public SrankoLikeToggleResponse togglePostLike(String email, UUID postId) {
        User user = requireUser(email);
        if (!postRepository.existsById(postId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.");
        }
        boolean liked;
        if (postLikeRepository.existsByPostIdAndUserId(postId, user.getId())) {
            postLikeRepository.deleteByPostIdAndUserId(postId, user.getId());
            postRepository.decrementLikeCount(postId);
            liked = false;
        } else {
            postLikeRepository.save(SrankoPostLike.builder()
                    .postId(postId)
                    .userId(user.getId())
                    .build());
            postRepository.incrementLikeCount(postId);
            liked = true;
        }
        SrankoPost post = postRepository.findById(postId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        return new SrankoLikeToggleResponse(post.getLikeCount(), liked);
    }

    @Transactional(readOnly = true)
    public List<SrankoCommentResponse> listComments(UUID postId, UUID viewerUserId) {
        if (!postRepository.existsById(postId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.");
        }
        List<SrankoPostComment> comments = postCommentRepository.findByPostIdOrderByCreatedAtAsc(postId);
        return mapComments(comments, viewerUserId);
    }

    @Transactional
    public SrankoCommentResponse createComment(
            String email,
            UUID postId,
            SrankoCommentCreateRequest body
    ) {
        User user = requireUser(email);
        if (!postRepository.existsById(postId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.");
        }
        UUID parentId = body.parentId();
        if (parentId != null) {
            SrankoPostComment parent = postCommentRepository.findById(parentId)
                    .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "부모 댓글을 찾을 수 없습니다."));
            if (!parent.getPostId().equals(postId)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "부모 댓글이 이 게시글에 속하지 않습니다.");
            }
            if (parent.getParentId() != null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "대댓글에는 답글을 달 수 없습니다.");
            }
        }
        String text = body.body() != null ? body.body().trim() : "";
        if (text.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "댓글 내용이 비어 있습니다.");
        }
        SrankoPostComment saved = postCommentRepository.save(SrankoPostComment.builder()
                .postId(postId)
                .authorUserId(user.getId())
                .parentId(parentId)
                .body(text)
                .build());
        postRepository.incrementCommentCount(postId);
        return SrankoCommentResponse.from(saved, user.getNickname(), false);
    }

    @Transactional
    public void deleteComment(String email, UUID postId, UUID commentId) {
        User user = requireUser(email);
        SrankoPost post = postRepository.findById(postId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
        SrankoPostComment comment = postCommentRepository.findById(commentId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."));
        if (!comment.getPostId().equals(postId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "댓글이 이 게시글에 속하지 않습니다.");
        }
        boolean isAuthor = comment.getAuthorUserId().equals(user.getId());
        boolean isPostAuthor = post.getAuthorUserId().equals(user.getId());
        if (!isAuthor && !isPostAuthor) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "댓글을 삭제할 권한이 없습니다.");
        }
        long removeCount = comment.getParentId() == null
                ? postCommentRepository.countSubtree(postId, commentId)
                : 1L;
        postCommentRepository.delete(comment);
        if (removeCount > 0) {
            postRepository.decrementCommentCount(postId, (int) Math.min(removeCount, Integer.MAX_VALUE));
        }
    }

    @Transactional
    public SrankoLikeToggleResponse toggleCommentLike(String email, UUID postId, UUID commentId) {
        User user = requireUser(email);
        SrankoPostComment comment = postCommentRepository.findById(commentId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."));
        if (!comment.getPostId().equals(postId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "댓글이 이 게시글에 속하지 않습니다.");
        }
        boolean liked;
        if (postCommentLikeRepository.existsByCommentIdAndUserId(commentId, user.getId())) {
            postCommentLikeRepository.deleteByCommentIdAndUserId(commentId, user.getId());
            postCommentRepository.decrementLikeCount(commentId);
            liked = false;
        } else {
            postCommentLikeRepository.save(SrankoPostCommentLike.builder()
                    .commentId(commentId)
                    .userId(user.getId())
                    .build());
            postCommentRepository.incrementLikeCount(commentId);
            liked = true;
        }
        SrankoPostComment refreshed = postCommentRepository.findById(commentId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."));
        return new SrankoLikeToggleResponse(refreshed.getLikeCount(), liked);
    }

    @Transactional
    public SrankoTryOnResponse tryOn(String email, SrankoTryOnRequest body) {
        User user = requireUser(email);
        SrankoPrefs prefs = prefsRepository.findById(user.getId())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.BAD_REQUEST,
                        "입어보기 이용 동의가 필요합니다."
                ));
        if (!prefs.isTryOnConsent()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "입어보기 AI(Vertex) 이용에 동의해 주세요.");
        }

        List<ResolvedGarment> garments = resolveTryOnGarments(user.getId(), body);
        if (garments.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "입어볼 의류를 선택해 주세요.");
        }

        boolean liveConfigured = vertexProperties.isLiveConfigured();
        Map<String, String> bodyMeasurements =
                sanitizeBodyMeasurements(readStringMap(prefs.getBodyMeasurementsJson()));
        boolean hasBodyMeasurements = !bodyMeasurements.isEmpty();
        // Always dress classpath mannequin (prefs.sex); no person photo path.
        String dressPersonUrl = null;

        log.info(
                "[SrankoTryOn] start skipFit={} hasBody={} garments={} slots={} mannequinSex={} "
                        + "fitOverrides={} liveConfigured={} model={}",
                Boolean.TRUE.equals(body.skipFit()),
                hasBodyMeasurements,
                garments.size(),
                garments.stream().map(ResolvedGarment::slot).toList(),
                prefs.resolvedSex(),
                body.fitByItemId() != null ? body.fitByItemId().size() : 0,
                liveConfigured,
                vertexProperties.tryOnModel()
        );

        String fit;
        Boolean muchTooSmall;
        List<SrankoFitAnalyzer.Fit> fitsPerGarment = new ArrayList<>(garments.size());
        Double primaryDelta = null;
        Double primaryBody = null;

        if (hasBodyMeasurements) {
            boolean anyMuchTooSmall = false;
            for (ResolvedGarment g : garments) {
                SrankoFitAnalyzer.FitResult fr = SrankoFitAnalyzer.analyze(
                        g.slot(),
                        bodyMeasurements,
                        g.measurements()
                );
                fitsPerGarment.add(fr.fit());
                if (fr.muchTooSmall()) {
                    anyMuchTooSmall = true;
                }
                if (primaryDelta == null && fr.primaryDeltaCm() != null) {
                    primaryDelta = fr.primaryDeltaCm();
                    primaryBody = fr.primaryBodyCm();
                }
            }
            SrankoFitAnalyzer.Fit overall = SrankoFitAnalyzer.aggregateFit(fitsPerGarment);
            fit = overall.wireValue();
            muchTooSmall = anyMuchTooSmall;
            log.info(
                    "[SrankoTryOn] analyze fit={} muchTooSmall={} garments={}",
                    fit,
                    muchTooSmall,
                    garments.size()
            );
        } else {
            for (ResolvedGarment g : garments) {
                fitsPerGarment.add(resolveManualFit(body.fitByItemId(), g.id()));
            }
            SrankoFitAnalyzer.Fit overall = SrankoFitAnalyzer.aggregateFit(fitsPerGarment);
            fit = overall.wireValue();
            muchTooSmall = false;
            log.info(
                    "[SrankoTryOn] manualFit fit={} perGarment={} garments={}",
                    fit,
                    fitsPerGarment.stream().map(SrankoFitAnalyzer.Fit::wireValue).toList(),
                    garments.size()
            );
        }

        SrankoFitAnalyzer.Fit overallFit = SrankoFitAnalyzer.aggregateFit(fitsPerGarment);
        boolean stub = !liveConfigured;
        byte[] jpegBytes;
        if (SrankoTryOnBatches.shouldMultiPass(garments.size())) {
            jpegBytes = runMultiPassTryOn(
                    user.getId(),
                    dressPersonUrl,
                    prefs.resolvedSex(),
                    garments,
                    fitsPerGarment,
                    overallFit,
                    false
            );
        } else if (garments.size() == 1) {
            String promptEnglish = SrankoFitAnalyzer.buildTryOnPrompt(
                    fitsPerGarment.get(0),
                    primaryDelta,
                    primaryBody,
                    garments.get(0).slot(),
                    false,
                    garments.get(0).measurements(),
                    prefs.resolvedSex()
            );
            log.info("[SrankoTryOn] single-pass promptChars={}", promptEnglish.length());
            jpegBytes = vertexGeminiTryOnClient.tryOn(
                    dressPersonUrl,
                    toGarmentInputs(garments),
                    promptEnglish,
                    prefs.resolvedSex()
            ).jpegBytes();
        } else {
            String promptEnglish = buildTryOnPromptForGarments(
                    garments,
                    fitsPerGarment,
                    overallFit,
                    false,
                    false,
                    prefs.resolvedSex()
            );
            log.info("[SrankoTryOn] single-pass promptChars={}", promptEnglish.length());
            jpegBytes = vertexGeminiTryOnClient.tryOn(
                    dressPersonUrl,
                    toGarmentInputs(garments),
                    promptEnglish,
                    prefs.resolvedSex()
            ).jpegBytes();
        }
        log.info(
                "[SrankoTryOn] gemini done mode={} jpegBytes={}",
                stub ? "stub" : "live",
                jpegBytes.length
        );

        String objectKey = r2StorageService.keyPrefix()
                + "sranko/"
                + user.getId()
                + "/tryon/"
                + UUID.randomUUID()
                + ".jpg";
        String url = r2StorageService.putObject(objectKey, jpegBytes, "image/jpeg");
        tryOnEphemeralService.schedule(objectKey);
        log.info(
                "[SrankoTryOn] r2 done keySuffix={} url={} geminiApplied={} ephemeralScheduled={}",
                objectKey.length() > 24 ? objectKey.substring(objectKey.length() - 24) : objectKey,
                truncateForLog(url, 80),
                true,
                tryOnProperties.ephemeralCleanupEnabled()
        );
        return new SrankoTryOnResponse(
                url,
                stub,
                fit,
                muchTooSmall,
                null,
                true
        );
    }

    /**
     * Multi-pass when ≥4 garments: body → accessories (HAT/SHOES) → rest.
     * Empty batches skipped. Body JPEG cached in Redis (15m) for accessory re-runs.
     */
    private byte[] runMultiPassTryOn(
            UUID userId,
            String personImageUrl,
            String sex,
            List<ResolvedGarment> garments,
            List<SrankoFitAnalyzer.Fit> fitsPerGarment,
            SrankoFitAnalyzer.Fit overallFit,
            boolean appearanceOnly
    ) {
        SrankoTryOnBatches.Batches<ResolvedGarment> batches =
                SrankoTryOnBatches.partition(garments, ResolvedGarment::slot);
        if (batches.bodyEmpty()) {
            log.info("[SrankoTryOn] multi-pass fallback: empty body batch → single call");
            String prompt = buildTryOnPromptForGarments(
                    garments, fitsPerGarment, overallFit, appearanceOnly, false, sex);
            return vertexGeminiTryOnClient.tryOn(
                    personImageUrl,
                    toGarmentInputs(garments),
                    prompt,
                    sex
            ).jpegBytes();
        }

        List<SrankoFitAnalyzer.Fit> bodyFits = fitsForBatch(garments, fitsPerGarment, batches.body());
        String personSource = (personImageUrl == null || personImageUrl.isBlank())
                ? "default:" + (sex != null ? sex : "M")
                : personImageUrl.trim();
        List<String> bodyIds = batches.body().stream()
                .map(g -> (g.id() != null ? g.id().toString() : "url") + "@" + g.imageUrl())
                .toList();
        String cacheKey = SrankoTryOnBodyCacheService.buildKey(
                userId,
                personSource,
                bodyIds,
                overallFit != null ? overallFit.wireValue() : "regular",
                sex
        );

        byte[] current;
        Optional<byte[]> cachedBody = tryOnBodyCacheService.get(cacheKey);
        if (cachedBody.isPresent()) {
            current = cachedBody.get();
            log.info("[SrankoTryOn] multi-pass body cache hit jpegBytes={}", current.length);
        } else {
            String bodyPrompt = buildTryOnPromptForGarments(
                    batches.body(), bodyFits, overallFit, appearanceOnly, false, sex);
            log.info(
                    "[SrankoTryOn] multi-pass body slots={} promptChars={}",
                    batches.body().stream().map(ResolvedGarment::slot).toList(),
                    bodyPrompt.length()
            );
            current = vertexGeminiTryOnClient.tryOn(
                    personImageUrl,
                    toGarmentInputs(batches.body()),
                    bodyPrompt,
                    sex
            ).jpegBytes();
            tryOnBodyCacheService.put(cacheKey, current);
        }

        String personForNext = jpegToDataUrl(current);

        if (!batches.accessoriesEmpty()) {
            List<SrankoFitAnalyzer.Fit> accFits =
                    fitsForBatch(garments, fitsPerGarment, batches.accessories());
            String accPrompt = buildTryOnPromptForGarments(
                    batches.accessories(), accFits, overallFit, appearanceOnly, true, sex);
            log.info(
                    "[SrankoTryOn] multi-pass accessories slots={} promptChars={}",
                    batches.accessories().stream().map(ResolvedGarment::slot).toList(),
                    accPrompt.length()
            );
            current = vertexGeminiTryOnClient.tryOn(
                    personForNext,
                    toGarmentInputs(batches.accessories()),
                    accPrompt,
                    sex
            ).jpegBytes();
            personForNext = jpegToDataUrl(current);
        } else {
            log.info("[SrankoTryOn] multi-pass skip accessories (empty)");
        }

        if (!batches.restEmpty()) {
            List<SrankoFitAnalyzer.Fit> restFits =
                    fitsForBatch(garments, fitsPerGarment, batches.rest());
            String restPrompt = buildTryOnPromptForGarments(
                    batches.rest(), restFits, overallFit, appearanceOnly, true, sex);
            log.info(
                    "[SrankoTryOn] multi-pass rest slots={} promptChars={}",
                    batches.rest().stream().map(ResolvedGarment::slot).toList(),
                    restPrompt.length()
            );
            current = vertexGeminiTryOnClient.tryOn(
                    personForNext,
                    toGarmentInputs(batches.rest()),
                    restPrompt,
                    sex
            ).jpegBytes();
        } else {
            log.info("[SrankoTryOn] multi-pass skip rest (empty)");
        }

        return current;
    }

    private static List<SrankoFitAnalyzer.Fit> fitsForBatch(
            List<ResolvedGarment> all,
            List<SrankoFitAnalyzer.Fit> fitsAll,
            List<ResolvedGarment> batch
    ) {
        List<SrankoFitAnalyzer.Fit> out = new ArrayList<>(batch.size());
        for (ResolvedGarment g : batch) {
            int idx = all.indexOf(g);
            if (idx >= 0 && idx < fitsAll.size() && fitsAll.get(idx) != null) {
                out.add(fitsAll.get(idx));
            } else {
                out.add(SrankoFitAnalyzer.Fit.REGULAR);
            }
        }
        return out;
    }

    private static String buildTryOnPromptForGarments(
            List<ResolvedGarment> batch,
            List<SrankoFitAnalyzer.Fit> fitsPerGarment,
            SrankoFitAnalyzer.Fit overallFit,
            boolean appearanceOnly,
            boolean followUp,
            String sex
    ) {
        List<String> slots = batch.stream().map(ResolvedGarment::slot).toList();
        List<Map<String, String>> sizes = batch.stream().map(ResolvedGarment::measurements).toList();
        if (batch.size() == 1 && !followUp) {
            SrankoFitAnalyzer.Fit fit = fitsPerGarment.isEmpty()
                    ? overallFit
                    : fitsPerGarment.get(0);
            return SrankoFitAnalyzer.buildTryOnPrompt(
                    fit,
                    null,
                    null,
                    batch.get(0).slot(),
                    appearanceOnly,
                    batch.get(0).measurements(),
                    sex
            );
        }
        if (followUp) {
            return SrankoFitAnalyzer.buildFollowUpTryOnPrompt(
                    slots,
                    fitsPerGarment,
                    overallFit,
                    appearanceOnly,
                    sizes,
                    sex
            );
        }
        return SrankoFitAnalyzer.buildMultiTryOnPrompt(
                slots,
                fitsPerGarment,
                overallFit,
                appearanceOnly,
                sizes,
                sex
        );
    }

    private static List<VertexGeminiTryOnClient.GarmentInput> toGarmentInputs(
            List<ResolvedGarment> garments
    ) {
        return garments.stream()
                .map(g -> new VertexGeminiTryOnClient.GarmentInput(g.imageUrl(), g.slot()))
                .toList();
    }

    private static String jpegToDataUrl(byte[] jpegBytes) {
        return "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(jpegBytes);
    }

    private static SrankoFitAnalyzer.Fit resolveManualFit(Map<String, String> fitByItemId, UUID itemId) {
        if (itemId != null && fitByItemId != null) {
            String raw = fitByItemId.get(itemId.toString());
            if (raw == null || raw.isBlank()) {
                // also try without dashes if client sent compact UUID
                raw = fitByItemId.get(itemId.toString().replace("-", ""));
            }
            SrankoFitAnalyzer.Fit parsed = parseFitWire(raw);
            if (parsed != null) {
                return parsed;
            }
        }
        return SrankoFitAnalyzer.Fit.REGULAR;
    }

    private static SrankoFitAnalyzer.Fit parseFitWire(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String v = raw.trim().toLowerCase(Locale.ROOT);
        return switch (v) {
            case "slim" -> SrankoFitAnalyzer.Fit.SLIM;
            case "loose", "over", "oversized" -> SrankoFitAnalyzer.Fit.LOOSE;
            case "regular", "ok", "normal" -> SrankoFitAnalyzer.Fit.REGULAR;
            default -> null;
        };
    }

    private record ResolvedGarment(
            UUID id,
            String imageUrl,
            String slot,
            Map<String, String> measurements
    ) {
    }

    private static final Set<String> TRY_ON_SLOTS =
            Set.of("TOP", "BOTTOM", "OUTER", "DRESS", "HAT", "SHOES");
    private static final List<String> TRY_ON_SLOT_ORDER =
            List.of("OUTER", "TOP", "BOTTOM", "DRESS", "HAT", "SHOES");

    private List<ResolvedGarment> resolveTryOnGarments(UUID userId, SrankoTryOnRequest body) {
        List<UUID> ids = new ArrayList<>();
        if (body.itemIds() != null) {
            for (UUID id : body.itemIds()) {
                if (id != null && !ids.contains(id)) {
                    ids.add(id);
                }
            }
        }
        if (ids.isEmpty() && body.itemId() != null) {
            ids.add(body.itemId());
        }

        if (!ids.isEmpty()) {
            if (ids.size() > 5) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "룩 입어보기는 최대 5개까지 선택할 수 있습니다.");
            }
            List<SrankoItem> items = new ArrayList<>();
            Set<String> seenSlots = new HashSet<>();
            for (UUID id : ids) {
                SrankoItem item = itemRepository.findByIdAndUserId(id, userId)
                        .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "아이템을 찾을 수 없습니다."));
                String slot = item.getSlot() != null ? item.getSlot().trim().toUpperCase(Locale.ROOT) : "";
                if (!TRY_ON_SLOTS.contains(slot)) {
                    throw new BusinessException(
                            HttpStatus.BAD_REQUEST,
                            "룩 입어보기는 상의·하의·아우터·원피스·모자·신발만 지원합니다."
                    );
                }
                if (!seenSlots.add(slot)) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "같은 종류의 옷은 하나만 선택할 수 있습니다.");
                }
                items.add(item);
            }
            boolean hasDress = seenSlots.contains("DRESS");
            boolean hasTopBottom = seenSlots.contains("TOP") || seenSlots.contains("BOTTOM");
            if (hasDress && hasTopBottom) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "원피스와 상의·하의는 함께 입을 수 없습니다.");
            }
            items.sort(Comparator.comparingInt(item -> {
                String slot = item.getSlot() != null ? item.getSlot().trim().toUpperCase(Locale.ROOT) : "";
                int idx = TRY_ON_SLOT_ORDER.indexOf(slot);
                return idx < 0 ? 99 : idx;
            }));
            List<ResolvedGarment> out = new ArrayList<>(items.size());
            for (SrankoItem item : items) {
                String slot = item.getSlot() != null ? item.getSlot().trim().toUpperCase(Locale.ROOT) : "";
                requireHttpUrl(item.getImageUrl());
                out.add(new ResolvedGarment(
                        item.getId(),
                        item.getImageUrl(),
                        slot,
                        readStringMap(item.getMeasurementsJson())
                ));
            }
            return out;
        }

        if (body.garmentImageUrl() == null || body.garmentImageUrl().isBlank()) {
            return List.of();
        }
        requireHttpUrl(body.garmentImageUrl());
        return List.of(new ResolvedGarment(
                body.itemId(),
                body.garmentImageUrl().trim(),
                "",
                Map.of()
        ));
    }

    /**
     * Pre-try-on fit preview: prefs body measurements vs closet item garment measurements.
     */
    @Transactional(readOnly = true)
    public SrankoFitCheckResponse fitCheck(String email, UUID itemId) {
        User user = requireUser(email);
        Map<String, String> bodyMeasurements = prefsRepository.findById(user.getId())
                .map(prefs -> sanitizeBodyMeasurements(readStringMap(prefs.getBodyMeasurementsJson())))
                .orElseGet(Map::of);
        SrankoItem item = itemRepository.findByIdAndUserId(itemId, user.getId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "아이템을 찾을 수 없습니다."));
        String slot = item.getSlot() != null ? item.getSlot() : "";
        String categoryCode = normalizeCategoryCode(slot, item.getCategoryCode());
        Map<String, String> garmentMeasurements = readStringMap(item.getMeasurementsJson());
        SrankoFitAnalyzer.FitResult result =
                SrankoFitAnalyzer.analyze(slot, bodyMeasurements, garmentMeasurements);
        List<SrankoFitCheckResponse.Part> parts =
                SrankoFitAnalyzer.partComparisons(
                                slot, categoryCode, bodyMeasurements, garmentMeasurements)
                        .stream()
                        .map(part -> new SrankoFitCheckResponse.Part(
                                part.key(),
                                part.bodyCm(),
                                part.garmentCm(),
                                part.deltaCm(),
                                part.band().wireValue()
                        ))
                        .toList();
        return new SrankoFitCheckResponse(
                result.fit().wireValue(),
                result.muchTooSmall(),
                result.skipStage2(),
                parts
        );
    }

    /**
     * Current weather + next 12 hours from local now for lat/lon (Redis cache),
     * or synthetic weather when only {@code tempC} is supplied (location denied).
     */
    @Transactional(readOnly = true)
    public SrankoWeatherResponse getWeather(String email, Double lat, Double lon, Double tempC) {
        requireUser(email);
        return resolveWeather(lat, lon, tempC);
    }

    @Transactional(readOnly = true)
    public List<SrankoPlaceSearchHit> searchPlaces(String email, String query) {
        requireUser(email);
        List<SrankoPlaceSearchHit> local = placeCatalogService.search(query);
        List<SrankoPlaceSearchHit> remote;
        try {
            remote = weatherApiClient.searchPlaces(query);
        } catch (BusinessException ex) {
            log.warn("[SrankoPlaces] WeatherAPI search fallback skipped: {}", ex.getMessage());
            remote = List.of();
        }
        if (local.isEmpty()) {
            return remote;
        }
        if (remote.isEmpty()) {
            return local;
        }
        List<SrankoPlaceSearchHit> merged = new ArrayList<>(local);
        for (SrankoPlaceSearchHit hit : remote) {
            if (merged.size() >= 8) {
                break;
            }
            boolean duplicate = merged.stream().anyMatch(existing ->
                    Math.abs(existing.lat() - hit.lat()) < 0.03
                            && Math.abs(existing.lon() - hit.lon()) < 0.03);
            if (!duplicate) {
                merged.add(hit);
            }
        }
        return List.copyOf(merged);
    }

    private SrankoWeatherResponse resolveWeather(Double lat, Double lon, Double tempC) {
        boolean hasCoords = lat != null && lon != null;
        if (hasCoords) {
            validateCoords(lat, lon);
            SrankoWeatherResponse live = weatherCacheService.getOrFetch(lat, lon);
            if (tempC != null) {
                return new SrankoWeatherResponse(
                        live.condition(),
                        live.conditionCode(),
                        tempC,
                        live.humidity(),
                        live.windKph(),
                        live.cached(),
                        true,
                        live.hourly() != null ? live.hourly() : List.of()
                );
            }
            return live;
        }
        if (tempC != null) {
            return SrankoWeatherResponse.manual(tempC);
        }
        throw new BusinessException(
                HttpStatus.BAD_REQUEST,
                "위치(lat, lon) 또는 수동 온도(tempC)가 필요합니다."
        );
    }

    private static void validateCoords(double lat, double lon) {
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "위도·경도가 올바르지 않습니다.");
        }
    }

    private List<SrankoPostResponse> mapPosts(List<SrankoPost> posts, UUID viewerUserId) {
        if (posts.isEmpty()) {
            return List.of();
        }
        List<UUID> authorIds = posts.stream().map(SrankoPost::getAuthorUserId).distinct().toList();
        Map<UUID, String> nicknames = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname, (a, b) -> a, HashMap::new));
        Set<UUID> liked = Set.of();
        if (viewerUserId != null) {
            List<UUID> postIds = posts.stream().map(SrankoPost::getId).toList();
            liked = new HashSet<>(postLikeRepository.findPostIdsByUserIdAndPostIdIn(viewerUserId, postIds));
        }
        Set<UUID> likedFinal = liked;
        return posts.stream()
                .map(p -> SrankoPostResponse.from(
                        p,
                        resolvePostImageUrls(p),
                        nicknames.getOrDefault(p.getAuthorUserId(), "알 수 없음"),
                        likedFinal.contains(p.getId()),
                        null
                ))
                .toList();
    }

    private List<SrankoCommentResponse> mapComments(List<SrankoPostComment> comments, UUID viewerUserId) {
        if (comments.isEmpty()) {
            return List.of();
        }
        List<UUID> authorIds = comments.stream().map(SrankoPostComment::getAuthorUserId).distinct().toList();
        Map<UUID, String> nicknames = userRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(User::getId, User::getNickname, (a, b) -> a, HashMap::new));
        Set<UUID> liked = Set.of();
        if (viewerUserId != null) {
            List<UUID> commentIds = comments.stream().map(SrankoPostComment::getId).toList();
            liked = new HashSet<>(
                    postCommentLikeRepository.findCommentIdsByUserIdAndCommentIdIn(viewerUserId, commentIds)
            );
        }
        Set<UUID> likedFinal = liked;
        return comments.stream()
                .map(c -> SrankoCommentResponse.from(
                        c,
                        nicknames.getOrDefault(c.getAuthorUserId(), "알 수 없음"),
                        likedFinal.contains(c.getId())
                ))
                .toList();
    }

    private SrankoPostResponse toPostResponse(SrankoPost post, UUID viewerUserId, Boolean viewCounted) {
        String nickname = userRepository.findById(post.getAuthorUserId())
                .map(User::getNickname)
                .orElse("알 수 없음");
        boolean likedByMe = viewerUserId != null
                && postLikeRepository.existsByPostIdAndUserId(post.getId(), viewerUserId);
        return SrankoPostResponse.from(post, resolvePostImageUrls(post), nickname, likedByMe, viewCounted);
    }

    private List<String> normalizeIncomingPostImageUrls(List<String> raw) {
        if (raw == null || raw.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지를 1장 이상 올려 주세요.");
        }
        if (raw.size() > POST_IMAGE_MAX) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지는 최대 " + POST_IMAGE_MAX + "장까지입니다.");
        }
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String url : raw) {
            if (url == null || url.isBlank()) {
                continue;
            }
            String trimmed = url.trim();
            requireHttpUrl(trimmed);
            unique.add(trimmed);
        }
        if (unique.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지를 1장 이상 올려 주세요.");
        }
        if (unique.size() > POST_IMAGE_MAX) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지는 최대 " + POST_IMAGE_MAX + "장까지입니다.");
        }
        return List.copyOf(unique);
    }

    private List<String> resolvePostImageUrls(SrankoPost post) {
        List<String> fromJson = readStringList(post.getImageUrlsJson());
        if (!fromJson.isEmpty()) {
            return fromJson;
        }
        if (post.getImageUrl() != null && !post.getImageUrl().isBlank()) {
            return List.of(post.getImageUrl());
        }
        return List.of();
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<String> list = objectMapper.readValue(json, STRING_LIST);
            if (list == null || list.isEmpty()) {
                return List.of();
            }
            return list.stream()
                    .filter(s -> s != null && !s.isBlank())
                    .map(String::trim)
                    .toList();
        } catch (JacksonException ex) {
            return List.of();
        }
    }

    private SrankoItemResponse toItemResponse(SrankoItem item) {
        String slot = item.getSlot() != null ? item.getSlot() : "";
        String category = normalizeCategoryCode(slot, item.getCategoryCode());
        // Surface normalized DRESS sleeve codes (legacy "원피스" → 긴팔) without rewriting DB here.
        return new SrankoItemResponse(
                item.getId(),
                slot,
                category,
                item.getWarmth(),
                item.getName(),
                item.getImageUrl(),
                readStringMap(item.getMeasurementsJson()),
                item.getCreatedAt()
        );
    }

    /**
     * Validates/normalizes {@code categoryCode} for the slot. DRESS legacy {@code 원피스} → {@code 긴팔}.
     */
    static String normalizeCategoryCode(String slot, String categoryCode) {
        String normalizedSlot = slot != null ? slot.trim().toUpperCase(Locale.ROOT) : "";
        Set<String> allowed = SLOT_CATEGORIES.get(normalizedSlot);
        String trimmed = categoryCode != null ? categoryCode.trim() : "";
        if (allowed == null) {
            return trimmed;
        }
        if ("DRESS".equals(normalizedSlot) && ("원피스".equals(trimmed) || trimmed.isEmpty())) {
            return SLOT_DEFAULT_CATEGORY.get("DRESS");
        }
        if (allowed.contains(trimmed)) {
            return trimmed;
        }
        return SLOT_DEFAULT_CATEGORY.getOrDefault(normalizedSlot, trimmed);
    }

    private SrankoLookResponse toLookResponse(SrankoLook look) {
        return SrankoLookResponse.from(look, readUuidList(look.getItemIdsJson()));
    }

    /**
     * Looks that still point at {@code …/tryon/…} would break when ephemeral TTL deletes the object.
     * Copy to {@code looks/}, cancel TTL, delete the try-on object.
     */
    private String promoteTryOnImageIfNeeded(User user, String imageUrl) {
        Optional<String> keyOpt = r2StorageService.keyFromPublicUrl(imageUrl);
        if (keyOpt.isEmpty()) {
            return imageUrl;
        }
        String tryonPrefix = r2StorageService.keyPrefix() + "sranko/" + user.getId() + "/tryon/";
        String key = keyOpt.get();
        if (!key.startsWith(tryonPrefix)) {
            return imageUrl;
        }
        byte[] bytes = r2StorageService.getObjectBytes(key);
        String lookKey = r2StorageService.keyPrefix()
                + "sranko/"
                + user.getId()
                + "/looks/"
                + UUID.randomUUID()
                + ".jpg";
        String lookUrl = r2StorageService.putObject(lookKey, bytes, "image/jpeg");
        tryOnEphemeralService.cancel(key);
        r2StorageService.deleteByKey(key);
        log.info(
                "[SrankoLook] promoted tryon→looks keySuffix={}",
                key.length() > 24 ? key.substring(key.length() - 24) : key
        );
        return lookUrl;
    }

    private void requireHttpUrl(String url) {
        if (!R2StorageService.isHttpUrl(url)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지 URL이 올바르지 않습니다.");
        }
        if (url.length() > 512) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지 URL이 너무 깁니다.");
        }
    }

    private static String truncateForLog(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max) + "...";
    }

    /** Warmth 1–5 or null (shoes / unset). User-confirmed values are future training GT. */
    private Integer normalizeWarmth(Integer warmth) {
        if (warmth == null) {
            return null;
        }
        if (warmth < 1 || warmth > 5) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "따뜻함(warmth)은 1–5 또는 비워야 합니다.");
        }
        return warmth;
    }

    private List<SrankoPlaceDto> readPlaces(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<SrankoPlaceDto> raw = objectMapper.readValue(json, PLACE_LIST);
            return sanitizePlaces(raw);
        } catch (Exception ex) {
            log.warn("[SrankoPlaces] parse failed: {}", ex.getMessage());
            return List.of();
        }
    }

    private List<SrankoPlaceDto> sanitizePlaces(List<SrankoPlaceDto> raw) {
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        List<SrankoPlaceDto> out = new ArrayList<>();
        boolean hasHome = false;
        boolean hasWork = false;
        int favorites = 0;
        for (SrankoPlaceDto place : raw) {
            if (place == null) {
                continue;
            }
            String kind = place.kind() != null ? place.kind().trim().toUpperCase(Locale.ROOT) : "";
            if (!"HOME".equals(kind) && !"WORK".equals(kind) && !"FAVORITE".equals(kind)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "장소 종류는 HOME·WORK·FAVORITE만 가능합니다.");
            }
            if ("HOME".equals(kind)) {
                if (hasHome) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "집은 하나만 등록할 수 있습니다.");
                }
                hasHome = true;
            } else if ("WORK".equals(kind)) {
                if (hasWork) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "회사는 하나만 등록할 수 있습니다.");
                }
                hasWork = true;
            } else {
                favorites++;
                if (favorites > MAX_FAVORITE_PLACES) {
                    throw new BusinessException(
                            HttpStatus.BAD_REQUEST,
                            "즐겨찾기는 최대 " + MAX_FAVORITE_PLACES + "곳까지 등록할 수 있습니다."
                    );
                }
            }
            validateCoords(place.lat(), place.lon());
            String label = place.label() != null ? place.label().trim() : "";
            if (label.isEmpty()) {
                label = switch (kind) {
                    case "HOME" -> "집";
                    case "WORK" -> "회사";
                    default -> "즐겨찾기";
                };
            }
            if (label.length() > MAX_PLACE_LABEL) {
                label = label.substring(0, MAX_PLACE_LABEL);
            }
            String id = place.id() != null && !place.id().isBlank()
                    ? place.id().trim()
                    : UUID.randomUUID().toString();
            String query = place.query() != null && !place.query().isBlank()
                    ? place.query().trim()
                    : null;
            if (query != null && query.length() > 120) {
                query = query.substring(0, 120);
            }
            out.add(new SrankoPlaceDto(id, label, kind, place.lat(), place.lon(), query));
        }
        return List.copyOf(out);
    }

    private Map<String, String> sanitizeBodyMeasurements(Map<String, String> raw) {
        if (raw == null || raw.isEmpty()) {
            return Map.of();
        }
        Map<String, String> cleaned = new HashMap<>();
        for (Map.Entry<String, String> entry : raw.entrySet()) {
            String key = entry.getKey();
            if (key == null || !BODY_MEASUREMENT_KEYS.contains(key)) {
                continue;
            }
            String value = entry.getValue();
            if (value == null) {
                continue;
            }
            String trimmed = value.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            if (trimmed.length() > 32) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "치수 값이 너무 깁니다.");
            }
            cleaned.put(key, trimmed);
        }
        return cleaned;
    }

    private Map<String, String> readStringMap(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            Map<String, String> map = objectMapper.readValue(json, STRING_MAP);
            return map != null ? map : Collections.emptyMap();
        } catch (JacksonException ex) {
            return Collections.emptyMap();
        }
    }

    private List<UUID> readUuidList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            List<UUID> list = objectMapper.readValue(json, UUID_LIST);
            return list != null ? list : List.of();
        } catch (JacksonException ex) {
            return List.of();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "JSON을 직렬화할 수 없습니다.");
        }
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }

    public Optional<UUID> findUserIdByEmail(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return userService.findByEmail(email.trim().toLowerCase()).map(User::getId);
    }
}
