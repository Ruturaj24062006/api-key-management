package com.credx.keyforge.controller;

import com.credx.keyforge.dto.project.CreateProjectRequest;
import com.credx.keyforge.dto.project.ProjectResponse;
import com.credx.keyforge.dto.project.UpdateProjectRequest;
import com.credx.keyforge.security.CurrentUserProvider;
import com.credx.keyforge.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizations/{organizationId}/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;
    private final CurrentUserProvider currentUserProvider;

    @PostMapping
    public ResponseEntity<ProjectResponse> create(
            @PathVariable String organizationId,
            @Valid @RequestBody CreateProjectRequest request) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.status(HttpStatus.CREATED).body(
                projectService.createProject(userId, organizationId, request));
    }

    @GetMapping
    public ResponseEntity<List<ProjectResponse>> list(@PathVariable String organizationId) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(projectService.listProjects(userId, organizationId));
    }

    @GetMapping("/{projectId}")
    public ResponseEntity<ProjectResponse> get(
            @PathVariable String organizationId,
            @PathVariable String projectId) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(projectService.getProject(userId, organizationId, projectId));
    }

    @PutMapping("/{projectId}")
    public ResponseEntity<ProjectResponse> update(
            @PathVariable String organizationId,
            @PathVariable String projectId,
            @Valid @RequestBody UpdateProjectRequest request) {
        String userId = currentUserProvider.getUserId();
        return ResponseEntity.ok(projectService.updateProject(userId, organizationId, projectId, request));
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<Void> delete(
            @PathVariable String organizationId,
            @PathVariable String projectId) {
        String userId = currentUserProvider.getUserId();
        projectService.deleteProject(userId, organizationId, projectId);
        return ResponseEntity.noContent().build();
    }
}
