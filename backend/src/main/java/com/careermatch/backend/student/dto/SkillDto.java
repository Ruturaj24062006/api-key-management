package com.careermatch.backend.student.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillDto {
    private String name;
    private String proficiencyLevel; // BEGINNER, INTERMEDIATE, ADVANCED
}
