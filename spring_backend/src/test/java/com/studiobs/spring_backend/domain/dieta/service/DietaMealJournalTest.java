package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueDayResponse;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class DietaMealJournalTest {
    private DietaMealDay day(int offset,DietaMealJournal.Status status,String... sources) {
        var date=LocalDate.of(2026,11,12).minusDays(offset);
        var foods=Arrays.stream(sources).map(source->new DietaMealDay.Row("LUNCH","사과",null,source,null)).toList();
        return new DietaMealDay(date,DietaMealQueueDayResponse.empty(date),null,null,Map.of(),foods,null,false,
                status==null?Map.of():Map.of("LUNCH",status));
    }

    @Test void distinguishesNoFoodUnknownAndCompletion() {
        var empty=day(0,null);
        var skip=new DietaMealJournal.Change(DietaMealJournal.Status.SKIPPED,null);
        var complete=new DietaMealJournal.Change(DietaMealJournal.Status.COMPLETE,null);
        assertThatCode(()->DietaMealJournal.validate("LUNCH",skip,empty)).doesNotThrowAnyException();
        assertThatThrownBy(()->DietaMealJournal.validate("LUNCH",complete,empty)).hasMessageContaining("식사를 기록");
        assertThatThrownBy(()->DietaMealJournal.validate("LUNCH",skip,day(0,null,"unanalysed"))).hasMessageContaining("음식이 있는");
        assertThatThrownBy(()->DietaMealJournal.validate("SNACK",skip,empty)).hasMessageContaining("아침");
        assertThatCode(()->DietaMealJournal.validate("LUNCH",complete,day(0,null,"average"))).doesNotThrowAnyException();
        assertThatCode(()->DietaMealJournal.validate("LUNCH",skip,day(0,DietaMealJournal.Status.SKIPPED))).doesNotThrowAnyException();
        assertThatThrownBy(()->DietaMealJournal.validate("LUNCH",skip,day(0,DietaMealJournal.Status.UNKNOWN))).hasMessageContaining("변경");
    }

    @Test void comparesOnlyWhenBothThreeDayWindowsHaveTwoVerifiedDays() {
        var days=new ArrayList<DietaMealJournal.Day>();
        for (int i=0;i<7;i++) {
            var facts=new DietaMealJournal.Day();
            facts.record("LUNCH","사과");
            facts.analysedKcal=Map.of("LUNCH",i*100);
            days.add(facts);
        }
        days.get(0).estimates.add("LUNCH");
        assertThat(DietaMealJournal.summarize(days).get(1).trend()).isEqualTo(new DietaMealJournal.Trend(150,2,500,3));
        days.get(1).estimates.add("LUNCH");
        assertThat(DietaMealJournal.summarize(days).get(1).trend()).isNull();
    }

    @Test void rejectsAChangedSupplementBeforeItCanBeClaimed() {
        var item=new com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueItemDto("extra:b","DINNER","밥",null);
        var queue=new DietaMealQueueDayResponse(LocalDate.now(),"done",List.of(item),null,"SUPPLEMENT",1);
        assertThatThrownBy(()->DietaMealJournal.checkPreview(queue,List.of("extra:a"))).hasMessageContaining("변경");
        assertThatCode(()->DietaMealJournal.checkPreview(queue,List.of("extra:b"))).doesNotThrowAnyException();
    }

    @Test void separatesSourcesAndCountsFoodsOncePerRecordedDate() {
        var days=List.of(day(6,null,"recipe","recipe"),day(5,null,"analysed"),day(4,null,"average"),
                day(3,DietaMealJournal.Status.SKIPPED),day(2,DietaMealJournal.Status.UNKNOWN),day(1,null,"average","unanalysed"),day(0,null));
        var facts=days.stream().map(d->{
            var factsDay=new DietaMealJournal.Day();
            factsDay.statuses=d.mealStatuses();
            for (var row:d.foods()) {
                if ("average".equals(row.source())) factsDay.estimates.add(row.mealType());
                else factsDay.record(row.mealType(),"unanalysed".equals(row.source())?null:row.name());
            }
            return factsDay;
        }).toList();
        var lunch=DietaMealJournal.summarize(facts).get(1);
        assertThat(lunch.directDays()).isEqualTo(2);
        assertThat(lunch.estimatedDays()).isEqualTo(1);
        assertThat(lunch.mixedDays()).isEqualTo(1);
        assertThat(lunch.skippedDays()).isEqualTo(1);
        assertThat(lunch.unknownDays()).isEqualTo(1);
        assertThat(lunch.frequentFood()).isEqualTo("사과");
        assertThat(lunch.foodDays()).isEqualTo(2);
        assertThat(DietaMealJournal.summarize(facts.subList(0,3)).get(1).frequentFood()).isNull();
    }
}
