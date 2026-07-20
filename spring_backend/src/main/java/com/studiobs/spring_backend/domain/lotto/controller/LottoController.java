package com.studiobs.spring_backend.domain.lotto.controller;

import com.studiobs.spring_backend.domain.auth.support.AccessTokenResolver;
import com.studiobs.spring_backend.domain.lotto.dto.LottoDrawResponse;
import com.studiobs.spring_backend.domain.lotto.dto.LottoUserPicksResponse;
import com.studiobs.spring_backend.domain.lotto.dto.ReplaceLottoDrawsRequest;
import com.studiobs.spring_backend.domain.lotto.dto.SaveLottoUserPicksRequest;
import com.studiobs.spring_backend.domain.lotto.dto.UpsertLottoDrawRequest;
import com.studiobs.spring_backend.domain.lotto.service.LottoService;
import com.studiobs.spring_backend.global.common.MessageResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/lotto")
@RequiredArgsConstructor
public class LottoController {

    private final LottoService lottoService;
    private final AccessTokenResolver accessTokenResolver;

    @GetMapping("/draws")
    public List<LottoDrawResponse> listDraws() {
        return lottoService.listDraws();
    }

    @GetMapping("/draws/latest")
    public LottoDrawResponse latestDraw() {
        return lottoService.latestDraw();
    }

    @PutMapping("/draws")
    public LottoDrawResponse upsertDraw(
            HttpServletRequest request,
            @Valid @RequestBody UpsertLottoDrawRequest body
    ) {
        return lottoService.upsertDraw(accessTokenResolver.requireEmail(request), body);
    }

    @PutMapping("/draws/replace")
    public List<LottoDrawResponse> replaceDraws(
            HttpServletRequest request,
            @Valid @RequestBody ReplaceLottoDrawsRequest body
    ) {
        return lottoService.replaceDraws(accessTokenResolver.requireEmail(request), body);
    }

    @DeleteMapping("/draws/{round}")
    public MessageResponse deleteDraw(HttpServletRequest request, @PathVariable int round) {
        lottoService.deleteDraw(accessTokenResolver.requireEmail(request), round);
        return new MessageResponse("회차가 삭제되었습니다.");
    }

    @GetMapping("/picks")
    public LottoUserPicksResponse getPicks(HttpServletRequest request) {
        return lottoService.getUserPicks(accessTokenResolver.requireEmail(request));
    }

    @PutMapping("/picks")
    public LottoUserPicksResponse savePicks(
            HttpServletRequest request,
            @Valid @RequestBody SaveLottoUserPicksRequest body
    ) {
        return lottoService.saveUserPicks(accessTokenResolver.requireEmail(request), body);
    }

    @DeleteMapping("/picks")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearPicks(HttpServletRequest request) {
        lottoService.clearUserPicks(accessTokenResolver.requireEmail(request));
    }

    @PostMapping("/picks/clear")
    public MessageResponse clearPicksMessage(HttpServletRequest request) {
        lottoService.clearUserPicks(accessTokenResolver.requireEmail(request));
        return new MessageResponse("히스토리를 비웠습니다.");
    }
}
