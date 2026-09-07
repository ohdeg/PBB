package com.studiobs.spring_backend.domain.brew.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.global.exception.BusinessException;
import com.studiobs.spring_backend.global.r2.R2StorageService;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class VevenoImageUrlsTest {

    @Mock
    private R2StorageService r2;

    @Test
    void resolve_omitsKeepsCurrent_andBlankClears() {
        UUID storeId = UUID.randomUUID();
        assertThat(VevenoImageUrls.resolve(r2, storeId, null, "https://cdn.example/a.jpg"))
                .isEqualTo("https://cdn.example/a.jpg");
        assertThat(VevenoImageUrls.resolve(r2, storeId, "", "https://cdn.example/a.jpg"))
                .isNull();
    }

    @Test
    void resolve_rejectsForeignPrefix() {
        UUID storeId = UUID.randomUUID();
        String url = "https://cdn.example/veveno/other/menus/x.jpg";
        when(r2.keyPrefix()).thenReturn("");
        when(r2.keyFromPublicUrl(url)).thenReturn(Optional.of("veveno/other/menus/x.jpg"));

        assertThatThrownBy(() -> VevenoImageUrls.resolve(r2, storeId, url, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("이 가게 이미지");
    }
}
