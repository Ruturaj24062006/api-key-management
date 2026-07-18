package com.careermatch.backend.auth.dto;

import com.careermatch.backend.auth.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @jakarta.validation.constraints.Pattern(
            regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#^()_+=\\-\\[\\]{}|;:',.<>?/`~])[A-Za-z\\d@$!%*?&#^()_+=\\-\\[\\]{}|;:',.<>?/`~]{8,}$",
            message = "Password must be at least 8 characters long, containing at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character"
    )
    private String password;

    @NotNull(message = "Role is required")
    private UserRole role;

    // Optional fields for profile initialization
    private String firstName;
    private String lastName;
    private String companyName;
    private String jobTitle;
}
