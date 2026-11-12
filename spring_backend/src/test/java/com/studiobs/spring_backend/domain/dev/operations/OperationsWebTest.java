package com.studiobs.spring_backend.domain.dev.operations;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerMapping;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OperationsWebTest {
    public void predict() {}

    @Test void seoulMidnightStartsANewDay() {
        assertThat(OperationsLog.day(Instant.parse("2026-11-12T14:59:59Z"))).isEqualTo("2026-11-12");
        assertThat(OperationsLog.day(Instant.parse("2026-11-12T15:00:00Z"))).isEqualTo("2026-11-13");
    }

    @Test void handlesServerFailuresOnlyAndPreservesResponseWhenStorageIsDown() throws Exception {
        var log = mock(OperationsLog.class);
        var interceptor = new OperationsWebConfig(log);
        var req = new MockHttpServletRequest();
        req.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/v1/sranko/ml/predict");
        var res = new MockHttpServletResponse();
        var handler = new HandlerMethod(this, getClass().getMethod("predict"));
        interceptor.preHandle(req, res, handler);
        res.setStatus(409);
        interceptor.afterCompletion(req,res,handler,null);
        verifyNoInteractions(log);
        res.setStatus(503);
        doThrow(new IllegalStateException()).when(log).error(any(),any(),anyInt(),any(),any());
        interceptor.afterCompletion(req,res,handler,null);
        verify(log).error(eq("Sranko"),eq("predict"),eq(503),any(),eq(res.getHeader("X-Request-Id")));
        assertThat(res.getStatus()).isEqualTo(503);
    }
}
