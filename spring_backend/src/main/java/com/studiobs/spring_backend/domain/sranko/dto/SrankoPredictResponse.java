package com.studiobs.spring_backend.domain.sranko.dto;

public record SrankoPredictResponse(
        String imageUrl,
        String imagePngBase64,
        String slot,
        String categoryCode,
        Integer warmth,
        String taxonomyGroup,
        int classNum,
        String category1,
        String category2,
        boolean rejected,
        int width,
        int height,
        boolean garmentExtractionApplied,
        String extractionWarning
) {
}
