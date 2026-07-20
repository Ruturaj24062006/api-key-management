package com.credx.keyforge.repository;

import com.credx.keyforge.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProjectRepository extends JpaRepository<Project, String> {

    List<Project> findAllByOrganizationId(String organizationId);

    @Query("select p from Project p join fetch p.organization where p.organization.id = :orgId")
    List<Project> findAllByOrganizationIdWithOrganization(@Param("orgId") String orgId);
}
