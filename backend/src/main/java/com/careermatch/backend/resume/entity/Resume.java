package com.careermatch.backend.resume.entity;

import com.careermatch.backend.student.entity.Student;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "resumes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Resume {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    @ToString.Exclude
    private Student student;

    @Column(name = "file_url", nullable = false)
    private String fileUrl;

    @Column(name = "parsed_text", columnDefinition = "TEXT")
    private String parsedText;

    // We store the Groq-extracted JSON profile as string mapping to JSONB
    @Column(name = "extracted_json", columnDefinition = "jsonb")
    private String extractedJson;

    @Column(name = "processing_status")
    private String processingStatus;

    // Vector embedding for dense search (384 dimensions)
    @Convert(converter = com.careermatch.backend.common.converter.PgVectorConverter.class)
    @Column(name = "embedding", columnDefinition = "vector(384)")
    private float[] embedding;

    @Column(name = "is_current", nullable = false)
    @Builder.Default
    private boolean isCurrent = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
