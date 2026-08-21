package com.studiobs.spring_backend.global.config;

import com.studiobs.spring_backend.global.security.JwtAuthenticationFilter;
import java.util.Arrays;
import java.util.List;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.RegexRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter
    ) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) ->
                                response.sendError(HttpStatus.UNAUTHORIZED.value()))
                        .accessDeniedHandler((request, response, exception) ->
                                response.sendError(HttpStatus.FORBIDDEN.value())))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/actuator/health",
                                "/actuator/health/**",
                                "/actuator/info"
                        ).permitAll()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/auth/account").authenticated()
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/v1/auth/password/change/request",
                                "/api/v1/auth/password/change/verify"
                        ).authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/auth/password/change")
                                .authenticated()
                        .requestMatchers("/api/v1/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/config/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/sranko/posts/mine").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/sranko/posts").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/sranko/posts/*/comments").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/sranko/posts/*").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/sranko/posts/*/read").permitAll()
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/v1/lotto/draws",
                                "/api/v1/lotto/draws/latest",
                                "/api/v1/lotto/pattern-profiles",
                                "/api/v1/brew/stores/public",
                                "/api/v1/brew/stores/search",
                                "/api/v1/brew/stats",
                                "/api/v1/veveno/stores/public",
                                "/api/v1/veveno/stores/search",
                                "/api/v1/veveno/stats"
                        ).permitAll()
                        .requestMatchers(publicBrewStoreReadMatcher()).permitAll()
                        .requestMatchers(publicVevenoStoreReadMatcher()).permitAll()
                        .requestMatchers("/api/v1/dev/**").hasRole("DEV")
                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/v1/lotto/draws",
                                "/api/v1/lotto/draws/replace"
                        ).hasRole("DEV")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/lotto/draws/*")
                                .hasRole("DEV")
                        .requestMatchers("/api/v1/**").authenticated()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private static RegexRequestMatcher publicBrewStoreReadMatcher() {
        return publicStoreReadMatcher("brew");
    }

    private static RegexRequestMatcher publicVevenoStoreReadMatcher() {
        return publicStoreReadMatcher("veveno");
    }

    private static RegexRequestMatcher publicStoreReadMatcher(String apiSegment) {
        String uuid = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-"
                + "[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
        String pattern = "^/api/v1/" + apiSegment + "/(stores/" + uuid
                + "(?:/menus)?|menus/" + uuid + "/recipes)$";
        return new RegexRequestMatcher(pattern, HttpMethod.GET.name());
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
