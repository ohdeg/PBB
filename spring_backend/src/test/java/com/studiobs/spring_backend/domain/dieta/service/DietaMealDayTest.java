package com.studiobs.spring_backend.domain.dieta.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.studiobs.spring_backend.domain.dieta.dto.meal.*;
import com.studiobs.spring_backend.domain.dieta.entity.*;
import com.studiobs.spring_backend.domain.dieta.repository.*;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class DietaMealDayTest {
    private final UUID owner = UUID.randomUUID();
    private final String email = "history@example.test";
    private final LocalDate day = LocalDate.of(2024,2,29);
    private final DietaAnalysisStore analyses = mock();
    private final DietaEntryStore entries = mock();
    private final DietaIntakeLogRepository intakes = mock();
    private final DietaRecipeRepository recipes = mock();
    private final DietaMealQueueRedisService redis = mock();
    private final JsonMapper json = JsonMapper.builder().build();
    private final DietaService service;

    DietaMealDayTest() {
        UserService users = mock();
        User user = mock();
        when(user.getId()).thenReturn(owner);
        when(users.findByEmail(email)).thenReturn(Optional.of(user));
        DietaProfileRepository profiles = mock();
        when(profiles.findById(owner)).thenReturn(Optional.of(mock(DietaProfile.class)));
        when(analyses.schedule(owner)).thenReturn(DietaMealSchedule.disabled());
        when(redis.getOrEmpty(owner,day)).thenReturn(DietaMealQueueDayResponse.empty(day));
        service = new DietaService(entries,Clock.fixed(Instant.parse("2024-03-01T15:30:00Z"),ZoneOffset.UTC),
                analyses,users,profiles,null,null,null,null,intakes,recipes,redis,null,json,null,null);
    }

    @Test void combinesVerifiedFoodRecipeAndAverageWithoutCountingThemTwice() {
        var n = new MacroTotals(BigDecimal.TEN,BigDecimal.ZERO,BigDecimal.ZERO,40);
        var log = DietaIntakeLog.builder().loggedOn(day).carbG(BigDecimal.valueOf(20))
                .proteinG(BigDecimal.ZERO).fatG(BigDecimal.ZERO).kcal(80)
                .sourceMealsJson("""
                    {"queueTotals":{"carbG":10,"proteinG":0,"fatG":0,"kcal":40},
                     "meals":[{"mealType":"LUNCH","items":["쌀밥"]}]}
                    """).build();
        when(intakes.findByUserIdAndLoggedOn(owner,day)).thenReturn(Optional.of(log));
        when(entries.read(owner,day,"REFLECTED",DietaMealQueueItemDto[].class))
                .thenReturn(new DietaMealQueueItemDto[]{new DietaMealQueueItemDto("base:one","LUNCH","쌀밥",null)});
        when(entries.read(owner,day,"FOODS_V1",DietaFoodDetails.class)).thenReturn(new DietaFoodDetails(
                Map.of("one",List.of(new DietaFoodDetails.Food("쌀밥","30g",true,n)))));
        when(entries.items(eq(owner),eq(day),anyList())).thenReturn(List.of(
                new DietaMealQueueItemDto("extra:two","DINNER","추가 기록",null)));
        var recipe = DietaRecipe.builder().userId(owner).loggedOn(day).title("레시피")
                .recordKind("INTAKE").mealType("LUNCH").carbG(n.carbG()).proteinG(n.proteinG()).fatG(n.fatG()).kcal(40).build();
        org.springframework.test.util.ReflectionTestUtils.setField(recipe,"id",UUID.randomUUID());
        when(recipes.findByUserIdAndLoggedOnOrderByCreatedAtAsc(owner,day)).thenReturn(List.of(recipe));
        when(entries.estimates(owner,day,day)).thenReturn(List.of(new DietaEntryStore.Estimate(day,"BREAKFAST",n)));
        var result = service.mealDay(email,day,"Asia/Seoul");
        assertThat(result.intake().kcal()).isEqualTo(120);
        assertThat(result.mealTotals().get("LUNCH").kcal()).isEqualTo(80);
        assertThat(result.mealTotals()).doesNotContainKey("DINNER");
        assertThat(result.foods()).extracting(DietaMealDay.Row::source)
                .containsExactly("estimatedPortion","unanalysed","recipe","average");
        assertThat(result.completedStage()).isEqualTo("MAIN");
    }

    @Test void dayBoundsUseDeviceTimeAndPastReadsDoNotRequireEditPermission() {
        assertThat(service.mealDay(email,day,"Asia/Seoul").foods()).isEmpty();
        assertThatThrownBy(()->service.checkManualEntryDay(email,day,"Asia/Seoul")).isInstanceOf(BusinessException.class);
        assertThatCode(()->service.checkManualEntryDay(email,day,"UTC")).doesNotThrowAnyException();
        assertThatThrownBy(()->service.mealDay(email,day.plusDays(3),"Asia/Seoul")).isInstanceOf(BusinessException.class);
        assertThatThrownBy(()->service.mealDay("unknown@example.test",day,"UTC")).isInstanceOf(BusinessException.class);
        verify(entries,never()).write(any(),any(),any(),any());
    }
}
