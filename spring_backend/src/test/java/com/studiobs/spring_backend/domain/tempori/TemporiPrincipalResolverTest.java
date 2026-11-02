package com.studiobs.spring_backend.domain.tempori;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
class TemporiPrincipalResolverTest {
    @Test void deletedAccountTokenCannotAccessNewAccountWithSameEmail() {
        var jwt=mock(JwtTokenProvider.class); var users=mock(UserRepository.class); var request=new MockHttpServletRequest(); request.addHeader("Authorization","Bearer test-token");
        UUID deleted=UUID.randomUUID(); when(jwt.isValid("test-token")).thenReturn(true); when(jwt.isAccessToken("test-token")).thenReturn(true); when(jwt.getUserId("test-token")).thenReturn(deleted); when(jwt.getEmail("test-token")).thenReturn("same@example.test");
        when(users.findById(deleted)).thenReturn(Optional.empty()); var other=mock(User.class); when(users.findByEmail("same@example.test")).thenReturn(Optional.of(other));
        assertEquals(401,assertThrows(BusinessException.class,()->new TemporiPrincipalResolver(jwt,users).requireOwner(request)).getStatus().value()); verify(users,never()).findByEmail(anyString());
    }
    @Test void rejectsMissingOrPosTokenBeforeUserLookup() {
        var jwt=mock(JwtTokenProvider.class); var users=mock(UserRepository.class); var resolver=new TemporiPrincipalResolver(jwt,users);
        assertThrows(BusinessException.class,()->resolver.requireOwner(new MockHttpServletRequest()));
        var request=new MockHttpServletRequest();request.addHeader("Authorization","Bearer pos");when(jwt.isValid("pos")).thenReturn(true);when(jwt.isAccessToken("pos")).thenReturn(false);
        assertThrows(BusinessException.class,()->resolver.requireOwner(request));verifyNoInteractions(users);
    }
}
