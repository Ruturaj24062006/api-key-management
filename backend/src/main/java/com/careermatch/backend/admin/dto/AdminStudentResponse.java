package com.careermatch.backend.admin.dto;

import lombok.Builder;
import lombok.Data;
import java.util.UUID;

@Data
@Builder
public class AdminStudentResponse {
    private UUID id;
    private String firstName;
    private String lastName;
    private String email;
    private boolean suspended;
}
