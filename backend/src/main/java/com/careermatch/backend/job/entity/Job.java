package com.careermatch.backend.job.entity;

import com.careermatch.backend.company.entity.Company;
import com.careermatch.backend.recruiter.entity.Recruiter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "jobs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recruiter_id", nullable = false)
    private Recruiter recruiter;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(columnDefinition = "TEXT")
    private String requirements; // skills and qualifications details

    private String location;

    @Enumerated(EnumType.STRING)
    @Column(name = "job_type", nullable = false)
    private JobType jobType;

    @Column(name = "experience_level")
    private String experienceLevel;

    @Column(name = "salary_range")
    private String salaryRange;

    @Column(name = "required_skills", columnDefinition = "TEXT")
    private String requiredSkills; // comma-separated list

    @Column(name = "preferred_skills", columnDefinition = "TEXT")
    private String preferredSkills; // comma-separated list

    @Column(name = "work_mode")
    private String workMode; // REMOTE, HYBRID, ONSITE

    @Column(name = "education_level")
    private String educationLevel;

    @Column(name = "sponsorship_available")
    private Boolean sponsorshipAvailable;

    private String department;

    @Column(name = "gpa_cutoff")
    private Double gpaCutoff;

    private LocalDateTime deadline;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private JobStatus status = JobStatus.DRAFT;

    // Vector embedding for dense search (384 dimensions)
    @Column(name = "embedding", columnDefinition = "vector(384)")
    private float[] embedding;

    // Full-Text Search tsvector (auto-computed by PostgreSQL)
    @Column(name = "fts", columnDefinition = "tsvector", insertable = false, updatable = false)
    private String fts;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
