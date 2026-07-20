package com.credx.keyforge.security;

import com.credx.keyforge.entity.Role;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * Lightweight principal built directly from JWT claims - we deliberately avoid
 * a DB round trip on every request just to populate Spring Security's context.
 * Org-membership-level authorization is still checked per-endpoint in the
 * service layer where the actual DB lookups happen.
 */
@Getter
public class AuthenticatedUser implements UserDetails {

    private final String userId;
    private final String email;
    private final Role role;

    public AuthenticatedUser(String userId, String email, Role role) {
        this.userId = userId;
        this.email = email;
        this.role = role;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return null;
    }

    @Override
    public String getUsername() {
        return email;
    }
}
