package com.studiobs.spring_backend.domain.brew.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class PosAccessTest {

    @AfterEach
    void tearDown() {
        PosAccess.clear();
    }

    @Test
    void requireBoundStore_matches() {
        UUID storeId = UUID.randomUUID();
        PosAccess.set(new PosAccess.Snapshot(UUID.randomUUID(), storeId, true, "dev"));
        PosAccess.requireBoundStore(storeId);
        assertThat(PosAccess.isPos()).isTrue();
    }

    @Test
    void requireBoundStore_rejectsOtherStore() {
        PosAccess.set(new PosAccess.Snapshot(
                UUID.randomUUID(), UUID.randomUUID(), false, "dev"));
        assertThatThrownBy(() -> PosAccess.requireBoundStore(UUID.randomUUID()))
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getCode())
                .isEqualTo("POS_STORE_MISMATCH");
    }

    @Test
    void forbidManagement_blocksPos() {
        PosAccess.set(new PosAccess.Snapshot(
                UUID.randomUUID(), UUID.randomUUID(), true, "dev"));
        assertThatThrownBy(PosAccess::forbidManagement)
                .isInstanceOf(BusinessException.class)
                .extracting(ex -> ((BusinessException) ex).getStatus())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }
}
