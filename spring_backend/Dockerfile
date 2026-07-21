# syntax=docker/dockerfile:1

# ---- build stage ----
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

# Gradle wrapper + build scripts first (better layer caching)
COPY gradlew ./
COPY gradle ./gradle
COPY settings.gradle build.gradle ./
RUN chmod +x gradlew && ./gradlew --version --no-daemon

# Warm dependency cache (ignore failure when nothing to resolve yet)
RUN ./gradlew dependencies --no-daemon || true

# Application sources
COPY src ./src
RUN ./gradlew clean bootJar -x test --no-daemon

# ---- run stage ----
FROM eclipse-temurin:25-jre
WORKDIR /app

# Run as non-root
RUN useradd -r -u 1001 appuser
COPY --from=build /app/build/libs/*.jar app.jar
USER appuser

EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
