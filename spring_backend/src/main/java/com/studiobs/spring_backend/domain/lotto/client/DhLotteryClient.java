package com.studiobs.spring_backend.domain.lotto.client;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * 동행복권 회차 조회 클라이언트.
 * <p>기존 6PICK(Firebase Functions) 구현과 동일하게
 * {@code /lt645/selectPstLt645Info.do?srchLtEpsd={round}} 엔드포인트를 사용한다.
 */
@Slf4j
@Component
public class DhLotteryClient {

    private static final String BASE_URL = "https://www.dhlottery.co.kr";
    private static final String PATH = "/lt645/selectPstLt645Info.do";

    private final RestClient restClient;

    public DhLotteryClient() {
        this.restClient = RestClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader(
                        "User-Agent",
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .defaultHeader("X-Requested-With", "XMLHttpRequest")
                .defaultHeader("Referer", "https://www.dhlottery.co.kr/gameResult.do?method=byWin")
                .build();
    }

    /**
     * 지정한 회차의 당첨번호를 조회한다.
     * 아직 발표 전(빈 목록)이거나 오류/파싱 실패 시 {@link Optional#empty()}.
     */
    public Optional<DhLotteryDrawResponse> fetchDraw(int round) {
        try {
            DhLotteryApiResponse res = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path(PATH)
                            .queryParam("srchLtEpsd", round)
                            .build())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(DhLotteryApiResponse.class);

            if (res == null
                    || res.resultCode() != null
                    || res.data() == null
                    || res.data().list() == null
                    || res.data().list().isEmpty()) {
                return Optional.empty();
            }

            return parseRow(round, res.data().list().get(0));
        } catch (Exception e) {
            log.warn("[LottoSync] {}회 동행복권 조회 실패: {}", round, e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<DhLotteryDrawResponse> parseRow(int requestedRound, DhLotteryApiResponse.Row row) {
        // 미발표 회차를 요청하면 엉뚱한 회차가 오지 않도록 회차 번호를 검증한다.
        if (row.round() == null || row.round() != requestedRound) {
            return Optional.empty();
        }

        List<Integer> mainNumbers = new ArrayList<>(List.of(
                nullToZero(row.no1()),
                nullToZero(row.no2()),
                nullToZero(row.no3()),
                nullToZero(row.no4()),
                nullToZero(row.no5()),
                nullToZero(row.no6())));
        if (mainNumbers.stream().anyMatch(n -> n < 1 || n > 45)) {
            return Optional.empty();
        }
        mainNumbers.sort(Integer::compareTo);

        Integer bonus = (row.bonusNumber() != null
                && row.bonusNumber() >= 1
                && row.bonusNumber() <= 45)
                ? row.bonusNumber()
                : null;
        Long firstPrizeAmount = (row.firstPrizeAmount() != null && row.firstPrizeAmount() > 0)
                ? row.firstPrizeAmount()
                : null;
        Integer firstPrizeWinnerCount =
                (row.firstPrizeWinnerCount() != null && row.firstPrizeWinnerCount() > 0)
                        ? row.firstPrizeWinnerCount()
                        : null;

        return Optional.of(new DhLotteryDrawResponse(
                requestedRound,
                mainNumbers,
                bonus,
                toIsoDate(row.drawDate()),
                firstPrizeAmount,
                firstPrizeWinnerCount));
    }

    /** "YYYYMMDD" → "YYYY-MM-DD" (형식이 아니면 null). */
    private String toIsoDate(String raw) {
        if (raw == null || raw.length() != 8) {
            return null;
        }
        return raw.substring(0, 4) + "-" + raw.substring(4, 6) + "-" + raw.substring(6, 8);
    }

    private int nullToZero(Integer value) {
        return value == null ? 0 : value;
    }
}
