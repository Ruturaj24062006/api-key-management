package com.credx.keyforge.service;

import com.credx.keyforge.dto.project.CreateProjectRequest;
import com.credx.keyforge.dto.project.ProjectResponse;
import com.credx.keyforge.dto.project.UpdateProjectRequest;
import com.credx.keyforge.entity.ApiKeyStatus;
import com.credx.keyforge.entity.MembershipRole;
import com.credx.keyforge.entity.Organization;
import com.credx.keyforge.entity.Project;
import com.credx.keyforge.exception.ResourceNotFoundException;
import com.credx.keyforge.repository.OrganizationRepository;
import com.credx.keyforge.repository.ProjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationAccessService accessService;

    @Transactional
    public ProjectResponse createProject(String userId, String organizationId, CreateProjectRequest request) {
        accessService.requireRole(userId, organizationId, MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.MEMBER);

        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization not found"));

        Project project = Project.builder()
                .organization(org)
                .name(request.name().trim())
                .description(request.description())
                .environment(request.environment())
                .build();
        project = projectRepository.save(project);

        return toResponse(project);
    }

    public List<ProjectResponse> listProjects(String userId, String organizationId) {
        accessService.requireMembership(userId, organizationId);
        return projectRepository.findAllByOrganizationId(organizationId).stream()
                .map(this::toResponse)
                .toList();
    }

    public ProjectResponse getProject(String userId, String organizationId, String projectId) {
        accessService.requireMembership(userId, organizationId);
        Project project = findProjectInOrg(organizationId, projectId);
        return toResponse(project);
    }

    @Transactional
    public ProjectResponse updateProject(String userId, String organizationId, String projectId, UpdateProjectRequest request) {
        accessService.requireRole(userId, organizationId, MembershipRole.OWNER, MembershipRole.ADMIN);

        Project project = findProjectInOrg(organizationId, projectId);
        project.setName(request.name().trim());
        project.setDescription(request.description());
        project.setEnvironment(request.environment());

        return toResponse(project);
    }

    @Transactional
    public void deleteProject(String userId, String organizationId, String projectId) {
        accessService.requireRole(userId, organizationId, MembershipRole.OWNER);
        Project project = findProjectInOrg(organizationId, projectId);
        projectRepository.delete(project);
    }

    private Project findProjectInOrg(String organizationId, String projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        if (!project.getOrganization().getId().equals(organizationId)) {
            throw new ResourceNotFoundException("Project not found");
        }
        return project;
    }

    private ProjectResponse toResponse(Project project) {
        long activeKeys = project.getApiKeys() == null ? 0 :
                project.getApiKeys().stream().filter(k -> k.getStatus() == ApiKeyStatus.ACTIVE).count();

        return new ProjectResponse(
                project.getId(),
                project.getOrganization().getId(),
                project.getName(),
                project.getDescription(),
                project.getEnvironment(),
                activeKeys,
                project.getCreatedAt());
    }
}
