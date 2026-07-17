package com.careermatch.backend.application.repository;

import com.careermatch.backend.application.entity.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, UUID> {
    List<Application> findByStudentId(UUID studentId);
    List<Application> findByJobId(UUID jobId);
    Optional<Application> findByStudentIdAndJobId(UUID studentId, UUID jobId);
    List<Application> findByJobIdIn(List<UUID> jobIds);
}
