package com.careermatch.backend.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class AdminRecruiterResponse {
    private UUID id;
    private String email;
    private String jobTitle;
    private String companyName;
    private boolean suspended;
    private boolean verified;
}
