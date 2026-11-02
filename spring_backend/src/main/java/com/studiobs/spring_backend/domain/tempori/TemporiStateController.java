package com.studiobs.spring_backend.domain.tempori;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/tempori/{scoreId}/state") @RequiredArgsConstructor
public class TemporiStateController {
    private final TemporiStateService service; private final TemporiPrincipalResolver tokens;
    @ModelAttribute void privateResponse(HttpServletResponse response) { response.setHeader("Cache-Control","private, no-store"); }
    @GetMapping public TemporiStateService.Listing list(HttpServletRequest r,@PathVariable String scoreId,@RequestParam(required=false) String cursor,@RequestParam(required=false) String documentKey) { return service.list(tokens.requireOwner(r),scoreId,cursor,documentKey); }
    @GetMapping("/{documentKey}") public TemporiStateService.Document get(HttpServletRequest r,@PathVariable String scoreId,@PathVariable String documentKey) { return service.get(tokens.requireOwner(r),scoreId,documentKey); }
    @PutMapping("/{documentKey}") public TemporiStateService.Document put(HttpServletRequest r,@PathVariable String scoreId,@PathVariable String documentKey,@RequestBody TemporiStateService.Write body) { return service.put(tokens.requireOwner(r),scoreId,documentKey,body); }
    @ExceptionHandler(TemporiStateService.StateConflict.class) ResponseEntity<TemporiStateService.Document> conflict(TemporiStateService.StateConflict error) { return ResponseEntity.status(409).header("Cache-Control","private, no-store").body(error.latest()); }
}
