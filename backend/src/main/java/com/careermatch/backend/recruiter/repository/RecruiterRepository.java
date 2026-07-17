package com.careermatch.backend.recruiter.repository;

import com.careermatch.backend.recruiter.entity.Recruiter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RecruiterRepository extends JpaRepository<Recruiter, UUID> {
    List<Recruiter> findByCompanyId(UUID companyId);
}
