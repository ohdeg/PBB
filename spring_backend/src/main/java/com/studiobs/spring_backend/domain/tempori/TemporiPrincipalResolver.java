package com.studiobs.spring_backend.domain.tempori;
import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import com.studiobs.spring_backend.global.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
@Component @RequiredArgsConstructor
public class TemporiPrincipalResolver {
    private final JwtTokenProvider tokens;
    private final UserRepository users;
    public UUID requireOwner(HttpServletRequest request) {
        String header=request.getHeader("Authorization");
        try {
            if(header==null || !header.startsWith("Bearer ")) throw new IllegalArgumentException();
            String token=header.substring(7).trim();
            if(!tokens.isValid(token) || !tokens.isAccessToken(token)) throw new IllegalArgumentException();
            UUID id=tokens.getUserId(token);
            var user=users.findById(id).orElseThrow(IllegalArgumentException::new);
            if(!user.getEmail().equals(tokens.getEmail(token))) throw new IllegalArgumentException();
            return id;
        } catch(RuntimeException failure) { throw new BusinessException(HttpStatus.UNAUTHORIZED,"다시 로그인해 주세요."); }
    }
}
