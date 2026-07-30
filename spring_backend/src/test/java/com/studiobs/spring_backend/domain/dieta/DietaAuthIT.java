package com.studiobs.spring_backend.domain.dieta;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studiobs.spring_backend.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Anonymous 401 coverage for critical Dieta routes (same pattern as {@code BrewStoreAuthIT}).
 */
class DietaAuthIT extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void profile_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/dieta/profile"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void onboarding_requiresAuth() throws Exception {
        mockMvc.perform(post("/api/v1/dieta/onboarding")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void maintainMode_requiresAuth() throws Exception {
        mockMvc.perform(post("/api/v1/dieta/maintain-mode")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void checkInProposal_requiresAuth() throws Exception {
        mockMvc.perform(post("/api/v1/dieta/check-ins/proposal")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"%s\",\"weightKg\":70}".formatted(LocalDate.now())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mealQueue_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/dieta/meal-queue")
                        .param("loggedOn", LocalDate.now().toString()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void recipes_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/v1/dieta/recipes"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void analyzeRecipe_requiresAuth() throws Exception {
        mockMvc.perform(post("/api/v1/dieta/recipes/analyze")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loggedOn":"%s",
                                  "title":"된장찌개",
                                  "ingredients":["된장 30g"],
                                  "servings":2
                                }
                                """.formatted(LocalDate.now())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void addRecipeToDay_requiresAuth() throws Exception {
        mockMvc.perform(post("/api/v1/dieta/recipes/" + UUID.randomUUID() + "/add-to-day")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loggedOn":"%s","mealType":"LUNCH"}
                                """.formatted(LocalDate.now())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void finalizeMealQueue_requiresAuth() throws Exception {
        mockMvc.perform(post("/api/v1/dieta/meal-queue/finalize")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"%s\"}".formatted(LocalDate.now())))
                .andExpect(status().isUnauthorized());
    }
}
