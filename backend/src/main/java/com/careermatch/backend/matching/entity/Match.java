package com.careermatch.backend.matching.entity;

import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.student.entity.Student;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "matches", uniqueConstraints = {@UniqueConstraint(name = "uk_matches_student_job", columnNames = {"student_id", "job_id"})})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @Column(name = "dense_score")
    private Double denseScore;

    @Column(name = "sparse_score")
    private Double sparseScore;

    @Column(name = "score")
    private Double score;

    @Column(name = "composite_score")
    private Double compositeScore;


    @Column(name = "eligibility_status", nullable = false)
    @Builder.Default
    private boolean eligibilityStatus = false;

    @Column(name = "explanation", columnDefinition = "TEXT")
    private String explanation;

    @Column(name = "skill_gap", columnDefinition = "TEXT")
    private String skillGap;


    @Column(name = "career_insights", columnDefinition = "TEXT")
    private String careerInsights;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
