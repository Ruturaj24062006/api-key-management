package com.credx.keyforge.repository;

import com.credx.keyforge.entity.OrganizationMembership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrganizationMembershipRepository extends JpaRepository<OrganizationMembership, String> {

    @Query("select m from OrganizationMembership m " +
            "join fetch m.organization " +
            "where m.user.id = :userId")
    List<OrganizationMembership> findAllByUserIdWithOrganization(@Param("userId") String userId);

    Optional<OrganizationMembership> findByUserIdAndOrganizationId(String userId, String organizationId);

    boolean existsByUserIdAndOrganizationId(String userId, String organizationId);

    List<OrganizationMembership> findAllByOrganizationId(String organizationId);
}
