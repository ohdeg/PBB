package com.studiobs.spring_backend.domain.lotto.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * 동행복권 회차 조회 원본 응답.
 * <p>GET https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd={round}
 * <p>{@code resultCode}가 null이면 정상, 미발표 회차는 {@code data.list}가 빈 배열로 온다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DhLotteryApiResponse(
        @JsonProperty("resultCode") String resultCode,
        @JsonProperty("resultMessage") String resultMessage,
        @JsonProperty("data") Data data
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Data(@JsonProperty("list") List<Row> list) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Row(
            @JsonProperty("ltEpsd") Integer round,
            @JsonProperty("tm1WnNo") Integer no1,
            @JsonProperty("tm2WnNo") Integer no2,
            @JsonProperty("tm3WnNo") Integer no3,
            @JsonProperty("tm4WnNo") Integer no4,
            @JsonProperty("tm5WnNo") Integer no5,
            @JsonProperty("tm6WnNo") Integer no6,
            @JsonProperty("bnsWnNo") Integer bonusNumber,
            @JsonProperty("ltRflYmd") String drawDate,
            @JsonProperty("rnk1WnAmt") Long firstPrizeAmount,
            @JsonProperty("rnk1WnNope") Integer firstPrizeWinnerCount
    ) {
    }
}
