package com.careermatch.backend.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class AdminCompanyResponse {
    private UUID id;
    private String name;
    private String industry;
    private String location;
    private String websiteUrl;
    private boolean verified;
}
