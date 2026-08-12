package com.studiobs.spring_backend.domain.sranko.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SrankoPlaceCatalogServiceTest {

    @Test
    void scorePrefersExactAndPrefix() {
        assertThat(SrankoPlaceCatalogService.score("서울", "서울")).isEqualTo(100);
        assertThat(SrankoPlaceCatalogService.score("강남", "강남구")).isEqualTo(80);
        assertThat(SrankoPlaceCatalogService.score("서울", "서울중구")).isEqualTo(80);
        assertThat(SrankoPlaceCatalogService.score("중구", "서울중구")).isEqualTo(50);
        assertThat(SrankoPlaceCatalogService.score("paris", "paris")).isEqualTo(100);
        assertThat(SrankoPlaceCatalogService.score("xyz", "paris")).isZero();
    }
}
