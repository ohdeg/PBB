package com.studiobs.spring_backend.domain.tempori;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
@RestController @RequestMapping("/api/v1/tempori") @RequiredArgsConstructor
public class TemporiController {
    private final TemporiCloudService service;
    private final TemporiPrincipalResolver tokens;
    @ModelAttribute void privateResponse(HttpServletResponse response) { response.setHeader("Cache-Control","private, no-store"); }
    @GetMapping public TemporiCloudService.ScoreList list(HttpServletRequest request,@RequestParam(required=false) String cursor) { return service.list(tokens.requireOwner(request),cursor); }
    @PostMapping(consumes="multipart/form-data") public TemporiCloudService.ScoreDto upload(HttpServletRequest request,@RequestHeader("Idempotency-Key") String key,@RequestParam MultipartFile file,@RequestParam String title,@RequestParam(required=false) String artist) { return service.upload(tokens.requireOwner(request),key,file,title,artist); }
    @GetMapping("/{id}") public TemporiCloudService.ScoreDto detail(HttpServletRequest request,@PathVariable String id) { return service.detail(tokens.requireOwner(request),id); }
    @PostMapping("/{id}/download-url") public TemporiPrivateStorage.Download download(HttpServletRequest request,@PathVariable String id) { return service.download(tokens.requireOwner(request),id); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.ACCEPTED) public void delete(HttpServletRequest request,@PathVariable String id) { service.delete(tokens.requireOwner(request),id); }
}
