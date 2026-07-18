package com.careermatch.backend.auth.controller;

import com.careermatch.backend.auth.dto.*;
import com.careermatch.backend.auth.service.AuthService;
import com.careermatch.backend.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Endpoints for user register, login, verification, and password reset")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Register a new student or recruiter user")
    public ResponseEntity<ApiResponse<String>> register(@Valid @RequestBody RegisterRequest request) {
        String response = authService.register(request);
        return ResponseEntity.ok(ApiResponse.success(response, response));
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate local credentials and receive tokens")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Login successful", response));
    }


    @PostMapping("/refresh")
    @Operation(summary = "Refresh an access token using a refresh token")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        LoginResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.success("Token refreshed successfully", response));
    }

    @GetMapping("/verify-email")
    @Operation(summary = "Verify email registration token")
    public ResponseEntity<ApiResponse<String>> verifyEmail(@RequestParam("token") String token) {
        String response = authService.verifyEmail(token);
        return ResponseEntity.ok(ApiResponse.success(response, response));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Request password reset OTP")
    public ResponseEntity<ApiResponse<String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        String response = authService.forgotPassword(request);
        return ResponseEntity.ok(ApiResponse.success(response, response));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Submit new password with OTP code")
    public ResponseEntity<ApiResponse<String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        String response = authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success(response, response));
    }
}
