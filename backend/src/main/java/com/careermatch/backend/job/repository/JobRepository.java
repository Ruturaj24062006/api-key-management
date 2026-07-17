package com.careermatch.backend.job.repository;

import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.job.entity.JobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface JobRepository extends JpaRepository<Job, UUID> {
    List<Job> findByCompanyId(UUID companyId);
    List<Job> findByStatus(JobStatus status);

    @Query(value = """
        WITH vector_search AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> cast(:queryVector as vector)) as rank
          FROM jobs
          WHERE status = 'ACTIVE' AND embedding IS NOT NULL
          ORDER BY embedding <=> cast(:queryVector as vector)
          LIMIT 100
        ),
        fts_search AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(fts, plainto_tsquery('english', :queryText)) DESC) as rank
          FROM jobs
          WHERE status = 'ACTIVE' AND fts @@ plainto_tsquery('english', :queryText)
          ORDER BY ts_rank(fts, plainto_tsquery('english', :queryText)) DESC
          LIMIT 100
        )
        SELECT j.*
        FROM vector_search v
        FULL OUTER JOIN fts_search f ON v.id = f.id
        JOIN jobs j ON j.id = COALESCE(v.id, f.id)
        ORDER BY (COALESCE(1.0 / (60.0 + v.rank), 0.0) + COALESCE(1.0 / (60.0 + f.rank), 0.0)) DESC
        LIMIT :limit
        """, nativeQuery = true)
    List<Job> searchHybrid(
        @Param("queryVector") float[] queryVector,
        @Param("queryText") String queryText,
        @Param("limit") int limit
    );
}
