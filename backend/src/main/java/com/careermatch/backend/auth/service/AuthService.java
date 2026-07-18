package com.careermatch.backend.auth.service;

import com.careermatch.backend.auth.dto.*;
import com.careermatch.backend.auth.entity.User;
import com.careermatch.backend.auth.entity.UserRole;
import com.careermatch.backend.auth.repository.UserRepository;
import com.careermatch.backend.company.entity.Company;
import com.careermatch.backend.company.repository.CompanyRepository;
import com.careermatch.backend.recruiter.entity.Recruiter;
import com.careermatch.backend.recruiter.repository.RecruiterRepository;
import com.careermatch.backend.security.JwtTokenProvider;
import com.careermatch.backend.student.entity.Student;
import com.careermatch.backend.student.repository.StudentRepository;
import com.careermatch.backend.exception.BadRequestException;
import com.careermatch.backend.exception.ResourceNotFoundException;
import com.careermatch.backend.util.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final StudentRepository studentRepository;
    private final RecruiterRepository recruiterRepository;
    private final CompanyRepository companyRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailService emailService;

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.anonKey}")
    private String supabaseAnonKey;

    @Transactional
    public String register(RegisterRequest request) {
        String email = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";
        if (userRepository.findByEmail(email).isPresent()) {
            throw new com.careermatch.backend.exception.EmailAlreadyExistsException("Email already exists.");
        }

        // 1. Sign up user in Supabase Auth if configured, or generate UUID
        String supabaseUserId = signupInSupabase(email, request.getPassword());
        UUID userId = UUID.fromString(supabaseUserId);

        // 2. Hash password & Save User in local PostgreSQL
        User user = User.builder()
                .id(userId)
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .isVerified(true)
                .build();

        User savedUser = userRepository.save(user);

        // 3. Initialize student or recruiter profile
        if (request.getRole() == UserRole.ROLE_STUDENT) {
            Student student = Student.builder()
                    .user(savedUser)
                    .firstName(request.getFirstName() != null ? request.getFirstName() : "Student")
                    .lastName(request.getLastName() != null ? request.getLastName() : "")
                    .profileCompletedPct(0)
                    .build();
            studentRepository.save(student);
        } else if (request.getRole() == UserRole.ROLE_RECRUITER) {
            Company company = null;
            if (request.getCompanyName() != null && !request.getCompanyName().isBlank()) {
                company = companyRepository.findByNameIgnoreCase(request.getCompanyName().trim())
                        .orElseGet(() -> companyRepository.save(
                                Company.builder()
                                        .name(request.getCompanyName().trim())
                                        .isVerified(false)
                                        .build()
                        ));
            }
            Recruiter recruiter = Recruiter.builder()
                    .user(savedUser)
                    .company(company)
                    .jobTitle(request.getJobTitle() != null ? request.getJobTitle() : "Recruiter")
                    .isVerified(false)
                    .build();
            recruiterRepository.save(recruiter);
        }

        log.info("Successfully registered user: {} with role: {}", savedUser.getEmail(), savedUser.getRole());
        return "Registration successful.";
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        String email = request.getEmail() != null ? request.getEmail().trim().toLowerCase() : "";

        // 1. Verify user exists
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new com.careermatch.backend.exception.AccountNotFoundException("Account not found."));

        // 2. Verify password hash
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new com.careermatch.backend.exception.InvalidCredentialsException("Incorrect email or password.");
        }

        // 3. Generate JWT Access & Refresh Token
        String accessToken = jwtTokenProvider.generateToken(user.getEmail(), user.getRole().name(), user.getId());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getEmail(), user.getRole().name(), user.getId());

        return LoginResponse.builder()
                .userId(user.getId())
                .role(user.getRole().name())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .build();
    }

    private String signupInSupabase(String email, String password) {
        if ("mock-anon-key".equals(supabaseAnonKey) || supabaseUrl.contains("your-project")) {
            log.warn("Supabase credentials not configured. Generating mock Supabase User ID.");
            return UUID.randomUUID().toString();
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", supabaseAnonKey);

            Map<String, String> body = Map.of("email", email, "password", password);
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);

            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<Map> response = restTemplate.postForEntity(supabaseUrl + "/auth/v1/signup", entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> respBody = response.getBody();
                if (respBody.containsKey("id")) {
                    return (String) respBody.get("id");
                } else if (respBody.containsKey("user")) {
                    Map<String, Object> userMap = (Map<String, Object>) respBody.get("user");
                    if (userMap != null && userMap.containsKey("id")) {
                        return (String) userMap.get("id");
                    }
                }
            }
            throw new RuntimeException("Could not find user ID in Supabase response");
        } catch (org.springframework.web.client.HttpClientErrorException e) {
            log.error("Failed to sign up in Supabase: {}", e.getResponseBodyAsString());
            throw new com.careermatch.backend.exception.EmailAlreadyExistsException("Email already exists.");
        } catch (Exception e) {
            log.error("Failed to sign up in Supabase: {}", e.getMessage());
            throw new BadRequestException("Registration failed: " + e.getMessage());
        }
    }

    private Map<String, Object> loginInSupabase(String email, String password) {
        if ("mock-anon-key".equals(supabaseAnonKey) || supabaseUrl.contains("your-project")) {
            log.warn("Supabase credentials not configured. Generating mock JWT tokens.");
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new BadRequestException("Invalid email or password"));

            // Check password hash match locally for mock fallback mode
            if (!passwordEncoder.matches(password, user.getPasswordHash())) {
                throw new BadRequestException("Invalid email or password");
            }
            
            UserDetails userDetails = new org.springframework.security.core.userdetails.User(
                    user.getEmail(),
                    "",
                    Collections.singletonList(new SimpleGrantedAuthority(user.getRole().name()))
            );
            String mockAccess = jwtTokenProvider.generateToken(userDetails);
            String mockRefresh = jwtTokenProvider.generateRefreshToken(userDetails);
            return Map.of("access_token", mockAccess, "refresh_token", mockRefresh);
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", supabaseAnonKey);

            Map<String, String> body = Map.of("email", email, "password", password);
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);

            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<Map> response = restTemplate.postForEntity(supabaseUrl + "/auth/v1/token?grant_type=password", entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map bodyMap = response.getBody();
                String access = (String) bodyMap.get("access_token");
                String refresh = (String) bodyMap.get("refresh_token");
                return Map.of("access_token", access, "refresh_token", refresh);
            }
            throw new RuntimeException("Empty response from Supabase Login API");
        } catch (Exception e) {
            log.error("Failed to login in Supabase: {}", e.getMessage());
            throw new BadRequestException("Invalid email or password (Supabase Auth)");
        }
    }

    @Transactional
    public LoginResponse loginWithGoogle(GoogleLoginRequest request) {
        // 1. Exchange Google ID Token with Supabase Auth for valid session tokens
        Map<String, Object> tokenData = loginWithGoogleInSupabase(request.getIdToken());
        String accessToken = (String) tokenData.get("access_token");
        String refreshToken = (String) tokenData.get("refresh_token");

        // Extract user details returned by Supabase
        Map<String, Object> userMap = (Map<String, Object>) tokenData.get("user");
        if (userMap == null) {
            throw new BadRequestException("Failed to retrieve user details from Google OAuth.");
        }
        String supabaseUserId = (String) userMap.get("id");
        String email = (String) userMap.get("email");
        UUID userId = UUID.fromString(supabaseUserId);

        // 2. Auto-register user locally if they don't already exist
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User newUser = User.builder()
                    .id(userId)
                    .email(email)
                    .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString())) // Random password hash
                    .role(UserRole.ROLE_STUDENT) // Default Google users to STUDENT role
                    .isVerified(true)
                    .build();
            User saved = userRepository.save(newUser);
            
            studentRepository.save(Student.builder()
                    .user(saved)
                    .firstName("Google")
                    .lastName("User")
                    .profileCompletedPct(0)
                    .build());
            log.info("Auto-registered new Google user locally: {}", email);
            return saved;
        });

        return LoginResponse.builder()
                .userId(user.getId())
                .role(user.getRole().name())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .build();
    }

    private Map<String, Object> loginWithGoogleInSupabase(String idToken) {
        if ("mock-anon-key".equals(supabaseAnonKey) || supabaseUrl.contains("your-project")) {
            log.warn("Supabase credentials not configured. Generating mock token data.");
            return Map.of(
                "access_token", "mock-access-token",
                "refresh_token", "mock-refresh-token",
                "user", Map.of(
                    "id", UUID.randomUUID().toString(),
                    "email", "google-student@careermatch.com"
                )
            );
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", supabaseAnonKey);

            Map<String, String> body = Map.of(
                "provider", "google",
                "token", idToken
            );
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);

            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<Map> response = restTemplate.postForEntity(
                supabaseUrl + "/auth/v1/token?grant_type=id_token",
                entity,
                Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }
            throw new RuntimeException("Empty response from Supabase token API");
        } catch (Exception e) {
            log.error("Failed Google login in Supabase: {}", e.getMessage());
            throw new BadRequestException("Google login failed: " + e.getMessage());
        }
    }

    @Transactional
    public LoginResponse refreshToken(RefreshTokenRequest request) {
        Map<String, Object> tokenData = refreshSupabaseToken(request.getRefreshToken());
        String accessToken = (String) tokenData.get("access_token");
        String refreshToken = (String) tokenData.get("refresh_token");

        String email = jwtTokenProvider.extractUsername(accessToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("User profile not found locally."));

        return LoginResponse.builder()
                .userId(user.getId())
                .role(user.getRole().name())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .build();
    }

    private Map<String, Object> refreshSupabaseToken(String refresh) {
        if ("mock-anon-key".equals(supabaseAnonKey) || supabaseUrl.contains("your-project")) {
            log.warn("Supabase credentials not configured. Mocking refresh token rotation.");
            String email = "student@careermatch.com";
            try {
                email = jwtTokenProvider.extractUsername(refresh);
            } catch (Exception e) {}
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new BadRequestException("Invalid refresh token"));
            
            UserDetails userDetails = new org.springframework.security.core.userdetails.User(
                    user.getEmail(),
                    "",
                    Collections.singletonList(new SimpleGrantedAuthority(user.getRole().name()))
            );
            String mockAccess = jwtTokenProvider.generateToken(userDetails);
            String mockRefresh = jwtTokenProvider.generateRefreshToken(userDetails);
            return Map.of("access_token", mockAccess, "refresh_token", mockRefresh);
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("apikey", supabaseAnonKey);

            Map<String, String> body = Map.of("refresh_token", refresh);
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);

            RestTemplate restTemplate = new RestTemplate();
            ResponseEntity<Map> response = restTemplate.postForEntity(supabaseUrl + "/auth/v1/token?grant_type=refresh_token", entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map bodyMap = response.getBody();
                String access = (String) bodyMap.get("access_token");
                String newRefresh = (String) bodyMap.get("refresh_token");
                return Map.of("access_token", access, "refresh_token", newRefresh);
            }
            throw new RuntimeException("Empty response from Supabase Refresh Token API");
        } catch (Exception e) {
            log.error("Failed to refresh token in Supabase: {}", e.getMessage());
            throw new BadRequestException("Invalid refresh token (Supabase Auth)");
        }
    }

    @Transactional
    public String forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("No user found with email " + request.getEmail()));

        String otp = String.format("%06d", new Random().nextInt(999999));
        user.setOtp(otp);
        user.setOtpExpiry(LocalDateTime.now().plusMinutes(15));
        userRepository.save(user);

        String html = "<p>Your password reset OTP is: <strong>" + otp + "</strong></p>" +
                "<p>Valid for 15 minutes.</p>";
        emailService.sendEmail(user.getEmail(), "Password Reset OTP - CareerMatch AI", html);

        return "OTP sent to your email. Valid for 15 minutes.";
    }

    @Transactional
    public String resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("No user found with email " + request.getEmail()));

        if (user.getOtp() == null || !user.getOtp().equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP");
        }

        if (user.getOtpExpiry() == null || user.getOtpExpiry().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("OTP has expired");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setOtp(null);
        user.setOtpExpiry(null);
        userRepository.save(user);

        return "Password reset successful.";
    }

    @Transactional
    public String verifyEmail(String token) {
        User user = userRepository.findByVerificationToken(token)
                .orElseThrow(() -> new BadRequestException("Invalid verification token"));

        user.setVerified(true);
        user.setVerificationToken(null);
        userRepository.save(user);

        return "Email verified successfully.";
    }
}
