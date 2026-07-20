package com.credx.keyforge.dto.project;

import com.credx.keyforge.entity.Environment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateProjectRequest(
        @NotBlank @Size(min = 2, max = 100) String name,
        @Size(max = 1000) String description,
        @NotNull Environment environment
) {
}
