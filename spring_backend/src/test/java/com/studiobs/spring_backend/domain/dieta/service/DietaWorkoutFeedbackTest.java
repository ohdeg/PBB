package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.*;
import com.studiobs.spring_backend.domain.dieta.dto.meal.*;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class DietaWorkoutFeedbackTest {
    DietaWorkout row(Integer minutes,Integer kcal) {
        return new DietaWorkout(UUID.randomUUID(),"웨이트",minutes,kcal,"direct",null);
    }
    @Test void sumsOnlyEnteredFieldsAndKeepsExplicitZeros() {
        assertThat(DietaWorkoutTotals.of(List.of(row(50,250),row(20,null)))).isEqualTo(new DietaWorkoutTotals(70,250));
        assertThat(DietaWorkoutTotals.of(List.of(row(null,null),row(0,null)))).isEqualTo(new DietaWorkoutTotals(0,null));
        assertThat(DietaWorkoutTotals.of(List.of(row(null,0)))).isEqualTo(new DietaWorkoutTotals(null,0));
        assertThat(DietaWorkoutTotals.of(List.of())).isEqualTo(new DietaWorkoutTotals(null,null));
    }
    @Test void rejectsDuplicateIdsSourceCopiesAndOverflow() {
        var first=row(1,0);
        assertThatThrownBy(()->DietaWorkoutTotals.of(List.of(first,first))).isInstanceOf(RuntimeException.class);
        var copied=new DietaWorkout(UUID.randomUUID(),"수영",20,null,"copied",first.id());
        var duplicateCopy=new DietaWorkout(UUID.randomUUID(),"수영",20,null,"copied",first.id());
        assertThatThrownBy(()->DietaWorkoutTotals.of(List.of(copied,duplicateCopy))).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(()->DietaWorkoutTotals.of(List.of(first,row(Integer.MAX_VALUE,0)))).isInstanceOf(RuntimeException.class);
    }

    private final LocalDate date=LocalDate.of(2026,11,12);
    private final MacroTotals n=new MacroTotals(BigDecimal.TEN,BigDecimal.ONE,BigDecimal.ZERO,150);
    private DietaMealDay day(List<DietaMealDay.Row> foods) {
        var totals=new HashMap<String,MacroTotals>();
        for(var food:foods) totals.merge(food.mealType(),food.nutrition(),MacroTotals::plus);
        var intake=new DietaIntakeLogResponse(null,date,n.carbG(),n.proteinG(),n.fatG(),150*foods.size(),null,null,false,Map.of());
        var queue=new DietaMealQueueDayResponse(date,"done",List.of(new DietaMealQueueItemDto("base:a","DINNER","피자 2조각",null)),null);
        return new DietaMealDay(date,queue,intake,"MAIN",totals,foods,null,false,Map.of());
    }
    @Test void savingTheSameListTwiceIsIdempotentAndOlderWritersCannotReplaceIt() {
        var json=JsonMapper.builder().build();
        var payloads=new HashMap<String,String>();
        var store=new DietaEntryStore(null,json) {
            @Override String raw(UUID owner,LocalDate day,String key) { return payloads.get(key); }
            @Override void write(UUID owner,LocalDate day,String key,Object value) { payloads.put(key,json.writeValueAsString(value)); }
        };
        var repository=mock(com.studiobs.spring_backend.domain.dieta.repository.DietaActivityLogRepository.class);
        var profile=mock(com.studiobs.spring_backend.domain.dieta.entity.DietaProfile.class);
        var user=mock(com.studiobs.spring_backend.domain.user.entity.User.class);
        UUID owner=UUID.randomUUID();
        when(user.getId()).thenReturn(owner);
        var service=spy(new DietaService(store,null,null,null,null,null,repository,null,null,null,null,null,null,json,null,null));
        doReturn(user).when(service).requireUser("test");
        doReturn(profile).when(service).requireProfile(owner);
        doNothing().when(service).checkEntryDay(owner,date,"UTC");
        var log=com.studiobs.spring_backend.domain.dieta.entity.DietaActivityLog.builder().userId(owner).loggedOn(date).build();
        when(repository.findByUserIdAndLoggedOn(owner,date)).thenReturn(Optional.of(log));
        when(repository.save(log)).thenAnswer(call->{
            org.springframework.test.util.ReflectionTestUtils.setField(log,"id",UUID.randomUUID());
            return log;
        });
        var workouts=List.of(row(50,250),row(20,null));
        var request=new DietaActivityUpsertRequest(date,null,null,null,true,null,null,null,null,Set.of(),"empty",null,"UTC",workouts);
        var first=service.upsertActivity("test",request);
        assertThat(first.workouts()).isEqualTo(workouts);
        assertThat(first.durationMin()).isEqualTo(70);
        assertThat(first.missingExerciseKcal()).isEqualTo(1);
        assertThat(first.activityKcal()).isEqualTo(250);
        assertThat(service.upsertActivity("test",request)).isEqualTo(first);
        verify(repository,times(1)).save(log);
        var old=new DietaActivityUpsertRequest(date,null,3,null,true,null,null,null,null,null,null,null,"UTC",null);
        assertThatThrownBy(()->service.upsertActivity("test",old)).hasMessageContaining("변경");
        var stale=new DietaActivityUpsertRequest(date,null,null,null,true,null,null,null,null,Set.of(),"empty",null,"UTC",List.of());
        assertThatThrownBy(()->service.upsertActivity("test",stale)).hasMessageContaining("변경");
        var remove=new DietaActivityUpsertRequest(date,null,null,null,true,null,null,null,null,Set.of(),first.revision(),null,"UTC",List.of());
        var empty=service.upsertActivity("test",remove);
        assertThat(empty.workouts()).isEmpty();
        assertThat(empty.durationMin()).isNull();
        assertThat(empty.exerciseKcal()).isNull();
    }

    @Test void usesRecordedPortionsAndRejectsAnUnrelatedProteinHint() {
        var dinner=new DietaMealDay.Row("DINNER","피자","2조각","analysed",n);
        var bad=JsonMapper.builder().build().readTree("[{\"kind\":\"protein\",\"entryId\":\"unknown\",\"mealType\":\"DINNER\"}]");
        var result=DietaFeedback.create(day(List.of(dinner)),1700,Map.of(),bad,new DietaFoodDetails(Map.of()),"v1",null);
        assertThat(result.dayReview()).contains("저녁만","1550 kcal");
        assertThat(result.meals().get("DINNER")).contains("한 조각당 약 75 kcal");
        var estimated=new DietaMealDay.Row("DINNER","피자","2조각","estimatedPortion",n);
        assertThat(DietaFeedback.create(day(List.of(estimated)),1700,Map.of(),null,null,"v1",null)
                .meals().get("DINNER")).contains("약 2조각").doesNotContain("한 조각당");
    }
    @Test void comparesThreePriorDaysAndExcludesEstimates() {
        var dinner=new DietaMealDay.Row("DINNER","밥",null,"recipe",n);
        var lunch=new DietaMealDay.Row("LUNCH","평균 추정",null,"average",n);
        var snapshot=day(List.of(lunch,dinner));
        var three=DietaFeedback.create(snapshot,500,Map.of("DINNER",List.of(80,90,100)),null,null,"v1",null);
        assertThat(three.dayReview()).contains("레시피 1건 포함.", "3일", "60 kcal 높았어요");
        assertThat(three.comparableKcal()).containsOnlyKeys("DINNER");
        assertThat(three.meals().get("LUNCH")).contains("추정치");
        assertThat(DietaFeedback.create(snapshot,500,Map.of("DINNER",List.of(80,90)),null,null,"v1",null)
                .dayReview()).doesNotContain("평균");
    }
}
