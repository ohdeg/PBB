package com.studiobs.spring_backend.domain.lotto.service;

import com.studiobs.spring_backend.domain.lotto.dto.LottoDrawResponse;
import com.studiobs.spring_backend.domain.lotto.dto.LottoUserPicksResponse;
import com.studiobs.spring_backend.domain.lotto.dto.ReplaceLottoDrawsRequest;
import com.studiobs.spring_backend.domain.lotto.dto.SaveLottoUserPicksRequest;
import com.studiobs.spring_backend.domain.lotto.dto.UpsertLottoDrawRequest;
import com.studiobs.spring_backend.domain.lotto.entity.LottoDraw;
import com.studiobs.spring_backend.domain.lotto.entity.LottoUserPick;
import com.studiobs.spring_backend.domain.lotto.repository.LottoDrawRepository;
import com.studiobs.spring_backend.domain.lotto.repository.LottoUserPickRepository;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LottoService {

    private static final int MAX_PICK_ITEMS_JSON_CHARS = 200_000;

    private final LottoDrawRepository drawRepository;
    private final LottoUserPickRepository pickRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<LottoDrawResponse> listDraws() {
        return drawRepository.findAllByOrderByRoundAsc().stream()
                .map(LottoDrawResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public LottoDrawResponse latestDraw() {
        return drawRepository.findTopByOrderByRoundDesc()
                .map(LottoDrawResponse::from)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "등록된 회차가 없습니다."));
    }

    @Transactional
    public LottoDrawResponse upsertDraw(String email, UpsertLottoDrawRequest request) {
        requireDev(email);
        return LottoDrawResponse.from(saveDrawEntity(request));
    }

    @Transactional
    public List<LottoDrawResponse> replaceDraws(String email, ReplaceLottoDrawsRequest request) {
        requireDev(email);

        Map<Integer, UpsertLottoDrawRequest> byRound = new LinkedHashMap<>();
        for (UpsertLottoDrawRequest item : request.draws()) {
            byRound.put(item.round(), item);
        }
        if (byRound.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "저장할 회차가 없습니다.");
        }

        drawRepository.deleteAllInBatch();
        drawRepository.flush();

        List<LottoDraw> entities = byRound.values().stream()
                .map(this::toNewEntity)
                .toList();
        return drawRepository.saveAll(entities).stream()
                .sorted(Comparator.comparing(LottoDraw::getRound))
                .map(LottoDrawResponse::from)
                .toList();
    }

    @Transactional
    public void deleteDraw(String email, int round) {
        requireDev(email);
        if (!drawRepository.existsById(round)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "회차를 찾을 수 없습니다.");
        }
        drawRepository.deleteById(round);
    }

    @Transactional(readOnly = true)
    public LottoUserPicksResponse getUserPicks(String email) {
        User user = requireUser(email);
        return pickRepository.findById(user.getId())
                .map(pick -> new LottoUserPicksResponse(pick.getTargetRound(), pick.getItems()))
                .orElseGet(() -> new LottoUserPicksResponse(null, "[]"));
    }

    @Transactional
    public LottoUserPicksResponse saveUserPicks(String email, SaveLottoUserPicksRequest request) {
        User user = requireUser(email);
        String itemsJson = request.itemsJson().trim();
        if (itemsJson.length() > MAX_PICK_ITEMS_JSON_CHARS) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "히스토리가 너무 큽니다.");
        }
        if (!itemsJson.startsWith("[")) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "itemsJson은 배열 JSON이어야 합니다.");
        }

        LottoUserPick pick = pickRepository.findById(user.getId())
                .map(existing -> {
                    existing.update(request.targetRound(), itemsJson);
                    return existing;
                })
                .orElseGet(() -> LottoUserPick.builder()
                        .userId(user.getId())
                        .targetRound(request.targetRound())
                        .items(itemsJson)
                        .build());

        LottoUserPick saved = pickRepository.save(pick);
        return new LottoUserPicksResponse(saved.getTargetRound(), saved.getItems());
    }

    @Transactional
    public void clearUserPicks(String email) {
        User user = requireUser(email);
        pickRepository.deleteById(user.getId());
    }

    private String normalizeMainNumbers(List<Integer> numbers) {
        if (numbers.size() != 6) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "본번호는 6개여야 합니다.");
        }
        Set<Integer> unique = new HashSet<>(numbers);
        if (unique.size() != 6) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "본번호는 서로 달라야 합니다.");
        }
        for (Integer n : numbers) {
            if (n == null || n < 1 || n > 45) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "번호는 1~45여야 합니다.");
            }
        }
        return numbers.stream().sorted().map(String::valueOf).collect(Collectors.joining(","));
    }

    private LottoDraw saveDrawEntity(UpsertLottoDrawRequest request) {
        String mainNumbers = normalizeMainNumbers(request.mainNumbers());
        if (request.bonusNumber() != null
                && request.mainNumbers().contains(request.bonusNumber())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "보너스 번호는 본번호와 겹칠 수 없습니다.");
        }

        LottoDraw draw = drawRepository.findById(request.round())
                .map(existing -> {
                    existing.update(
                            mainNumbers,
                            request.bonusNumber(),
                            request.drawDate(),
                            request.firstPrizeAmount(),
                            request.firstPrizeWinnerCount());
                    return existing;
                })
                .orElseGet(() -> toNewEntity(request));

        return drawRepository.save(draw);
    }

    private LottoDraw toNewEntity(UpsertLottoDrawRequest request) {
        String mainNumbers = normalizeMainNumbers(request.mainNumbers());
        if (request.bonusNumber() != null
                && request.mainNumbers().contains(request.bonusNumber())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "보너스 번호는 본번호와 겹칠 수 없습니다.");
        }
        return LottoDraw.builder()
                .round(request.round())
                .mainNumbers(mainNumbers)
                .bonusNumber(request.bonusNumber())
                .drawDate(request.drawDate())
                .firstPrizeAmount(request.firstPrizeAmount())
                .firstPrizeWinnerCount(request.firstPrizeWinnerCount())
                .build();
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }

    private void requireDev(String email) {
        User user = requireUser(email);
        if (!user.getUserClass().isDev()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "DEV 회원만 회차를 관리할 수 있습니다.");
        }
    }
}
