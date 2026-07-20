package com.credx.keyforge.service;

import com.credx.keyforge.dto.auth.AuthResponse;
import com.credx.keyforge.dto.auth.LoginRequest;
import com.credx.keyforge.dto.auth.RegisterRequest;
import com.credx.keyforge.entity.MembershipRole;
import com.credx.keyforge.entity.Organization;
import com.credx.keyforge.entity.OrganizationMembership;
import com.credx.keyforge.entity.PlanTier;
import com.credx.keyforge.entity.Role;
import com.credx.keyforge.entity.User;
import com.credx.keyforge.exception.DuplicateResourceException;
import com.credx.keyforge.exception.InvalidCredentialsException;
import com.credx.keyforge.repository.OrganizationMembershipRepository;
import com.credx.keyforge.repository.OrganizationRepository;
import com.credx.keyforge.repository.UserRepository;
import com.credx.keyforge.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new DuplicateResourceException("An account with this email already exists");
        }

        User user = User.builder()
                .email(normalizedEmail)
                .fullName(request.fullName().trim())
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(Role.MEMBER)
                .build();

        user = userRepository.save(user);

        // Auto-create default organization for the new user in Supabase
        String slug = slugify(user.getFullName());
        if (organizationRepository.existsBySlug(slug)) {
            slug = slug + "-" + System.currentTimeMillis() % 10000;
        }

        Organization org = Organization.builder()
                .name(user.getFullName() + "'s Org")
                .slug(slug)
                .planTier(PlanTier.FREE)
                .owner(user)
                .build();
        org = organizationRepository.save(org);

        OrganizationMembership membership = OrganizationMembership.builder()
                .user(user)
                .organization(org)
                .role(MembershipRole.OWNER)
                .build();
        membershipRepository.save(membership);

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, user.getId(), user.getEmail(), user.getFullName(), user.getRole().name());
    }

    private String slugify(String name) {
        String slug = name.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return slug.isEmpty() ? "org" : slug;
    }

    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, user.getId(), user.getEmail(), user.getFullName(), user.getRole().name());
    }
}
