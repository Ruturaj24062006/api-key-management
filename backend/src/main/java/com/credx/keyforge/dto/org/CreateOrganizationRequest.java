package com.credx.keyforge.dto.org;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateOrganizationRequest(
        @NotBlank @Size(min = 2, max = 100) String name
) {
}
