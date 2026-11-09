package com.studiobs.spring_backend.domain.dieta.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.studiobs.spring_backend.domain.dieta.dto.meal.*;
import com.studiobs.spring_backend.domain.dieta.repository.*;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;

class DietaQuickMealsTest {
    private final LocalDate day=LocalDate.of(2026,11,9);
    private final UUID user=UUID.randomUUID();
    private final DietaService dieta=mock(DietaService.class);
    private final String email="fixture@example.test";
    private final JsonMapper json=JsonMapper.builder().build();
    private final Map<String,String> rows=new HashMap<>();
    private final Map<UUID,DietaEntryStore.Favorite> saved=new LinkedHashMap<>();
    private final DietaEntryStore store=new DietaEntryStore(null,json) {
        @Override String raw(UUID user,LocalDate day,String key) {return rows.get(user+"/"+day+"/"+key);}
        @Override void write(UUID user,LocalDate day,String key,Object value) {
            rows.put(user+"/"+day+"/"+key,json.writeValueAsString(value));
        }
        @Override List<Estimate> estimates(UUID user,LocalDate start,LocalDate end) {return List.of();}
        @Override List<Favorite> favorites(UUID user) {return List.copyOf(saved.values());}
        @Override void saveFavorite(UUID user,UUID id,String name,List<Item> items) {saved.put(id,new Favorite(id,name,items));}
        @Override void useFavorite(UUID user,UUID id) {}
    };
    private final DietaQuickMeals meals;
    DietaQuickMealsTest() {
        doThrow(DietaEntryStore.invalid("날짜 범위")).when(dieta).checkEntryDay(user,day.minusDays(2),"UTC");
        var person=mock(User.class);
        when(person.getId()).thenReturn(user);
        when(dieta.requireUser(email)).thenReturn(person);
        meals=new DietaQuickMeals(dieta,store,mock(DietaRecipeRepository.class),mock(JdbcTemplate.class),json,
                mock(DietaIntakeLogRepository.class));
        when(dieta.currentQueue(eq(user),any())).thenAnswer(i->DietaMealQueueDayResponse.empty(i.getArgument(1)));
    }

    private void record(LocalDate source,String id) {
        when(dieta.currentQueue(user,source)).thenReturn(new DietaMealQueueDayResponse(source,"open",List.of(
                new DietaMealQueueItemDto(id,"LUNCH","밥",null)),null,"MAIN",1));
    }
    private DietaEntryStore.Edit edit(String action,String revision,UUID favorite) {
        return new DietaEntryStore.Edit(UUID.randomUUID(),revision,action,favorite,"평일 점심",List.of(
                new DietaEntryStore.Pick("food-1","DINNER","밥 반 공기",BigDecimal.ONE)),"DINNER",BigDecimal.ONE);
    }
    @Test void replayAfterSourceFinalizesReturnsSuccessAndNewKeyCannotCopyTheSameFoodTwice() {
        record(day.minusDays(1),"food-1");
        var first=edit("previous",meals.preview(email,day,"UTC").revision(),null);
        meals.apply(email,day,"UTC",first);
        record(day.minusDays(1),"base:food-1");
        meals.apply(email,day,"UTC",first);
        var repeat=edit("previous",meals.preview(email,day,"UTC").revision(),null);
        assertThatThrownBy(()->meals.apply(email,day,"UTC",repeat)).isInstanceOf(BusinessException.class);
        verify(dieta,times(1)).addMealQueueItem(email,new DietaMealQueueAddItemRequest(day,"DINNER","밥 반 공기"));
    }
    @Test void favoriteIsASnapshotAndCannotApplyOutsideTodayOrYesterday() {
        record(day,"food-1");
        meals.apply(email,day,"UTC",edit("saveFavorite",meals.preview(email,day,"UTC").revision(),null));
        var favorite=saved.values().iterator().next();
        assertThat(favorite.items().getFirst().text()).isEqualTo("밥 반 공기");
        when(dieta.currentQueue(user,day)).thenReturn(DietaMealQueueDayResponse.empty(day));
        var apply=edit("favorite",meals.preview(email,day,"UTC").revision(),favorite.id());
        meals.apply(email,day,"UTC",apply);
        verify(dieta).addMealQueueItem(email,new DietaMealQueueAddItemRequest(day,"DINNER","밥 반 공기"));
        assertThatThrownBy(()->meals.apply(email,day.minusDays(2),"UTC",apply)).isInstanceOf(BusinessException.class);
    }
}
