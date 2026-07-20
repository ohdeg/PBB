package com.studiobs.spring_backend.domain.user.service;

import com.studiobs.spring_backend.domain.user.dto.UserResponse;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.entity.UserClass;
import com.studiobs.spring_backend.domain.user.entity.UserConsent;
import com.studiobs.spring_backend.domain.user.repository.UserConsentRepository;
import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserConsentRepository userConsentRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    @Transactional(readOnly = true)
    public boolean existsByNickname(String nickname) {
        return userRepository.existsByNickname(nickname);
    }

    @Transactional(readOnly = true)
    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    @Transactional(readOnly = true)
    public Optional<User> findById(UUID id) {
        return userRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<User> findByNickname(String nickname) {
        return userRepository.findByNickname(nickname);
    }

    @Transactional(readOnly = true)
    public List<User> searchByEmailOrNickname(String query) {
        String trimmed = query.trim();
        if (trimmed.isEmpty()) {
            return List.of();
        }
        return userRepository
                .findTop20ByEmailContainingIgnoreCaseOrNicknameContainingIgnoreCaseOrderByNicknameAsc(
                        trimmed,
                        trimmed
                );
    }

    @Transactional
    public UserResponse register(
            String email,
            String nickname,
            String rawPassword,
            List<ConsentInput> consents
    ) {
        User user = User.builder()
                .email(email)
                .nickname(nickname)
                .password(passwordEncoder.encode(rawPassword))
                .userClass(UserClass.FREE)
                .build();
        User saved = userRepository.save(user);

        List<UserConsent> consentEntities = consents.stream()
                .map(input -> UserConsent.builder()
                        .user(saved)
                        .consentKey(input.key())
                        .agreed(input.agreed())
                        .version(input.version())
                        .build())
                .toList();
        userConsentRepository.saveAll(consentEntities);

        return UserResponse.from(saved);
    }

    public boolean matchesPassword(User user, String rawPassword) {
        return passwordEncoder.matches(rawPassword, user.getPassword());
    }

    @Transactional
    public void updatePassword(User user, String rawPassword) {
        user.changePassword(passwordEncoder.encode(rawPassword));
        userRepository.save(user);
    }

    @Transactional
    public UserResponse updateUserClass(User user, UserClass userClass) {
        user.changeUserClass(userClass);
        return UserResponse.from(userRepository.save(user));
    }

    public record ConsentInput(String key, boolean agreed, String version) {
    }
}
