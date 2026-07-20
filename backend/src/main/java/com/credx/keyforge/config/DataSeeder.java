package com.credx.keyforge.config;

import com.credx.keyforge.entity.*;
import com.credx.keyforge.repository.*;
import com.credx.keyforge.util.ApiKeyGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Seeds a handful of realistic organizations/projects/keys/usage logs on
 * startup, but only when the users table is empty - so this is safe to leave
 * enabled in dev without duplicating data on every restart.
 *
 * Prefer seed-data/seed.sql for a deterministic, inspectable dataset (e.g.
 * for grading/demo purposes); this class exists so `mvn spring-boot:run`
 * against a fresh DB is immediately useful without running SQL by hand.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("null")
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final ProjectRepository projectRepository;
    private final ApiKeyRepository apiKeyRepository;
    private final ApiKeyUsageLogRepository usageLogRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final ApiKeyGenerator apiKeyGenerator;

    private final Random random = new Random(42);

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Data already present, skipping DataSeeder");
            return;
        }

        log.info("Seeding KeyForge demo data...");

        User admin = createUser("admin@credx.dev", "Platform Admin", Role.ADMIN);
        User alice = createUser("alice@acme.dev", "Alice Ferreira", Role.MEMBER);
        User bob = createUser("bob@acme.dev", "Bob Nakamura", Role.MEMBER);
        User carol = createUser("carol@northwind.dev", "Carol Singh", Role.MEMBER);

        Organization acme = createOrganization("Acme Corp", "acme-corp", PlanTier.PRO, alice);
        addMember(alice, acme, MembershipRole.OWNER);
        addMember(bob, acme, MembershipRole.MEMBER);

        Organization northwind = createOrganization("Northwind Traders", "northwind-traders", PlanTier.FREE, carol);
        addMember(carol, northwind, MembershipRole.OWNER);

        Project acmeApi = createProject(acme, "Acme Public API", "Customer-facing REST API", Environment.PRODUCTION);
        Project acmeInternal = createProject(acme, "Acme Internal Tools", "Internal admin tooling", Environment.STAGING);
        Project nwCatalog = createProject(northwind, "Catalog Service", "Product catalog microservice", Environment.DEVELOPMENT);

        ApiKey acmeApiProdKey = createApiKey(acmeApi, "Production Server Key",
                List.of(Scope.READ_USERS, Scope.WRITE_USERS, Scope.READ_BILLING), 120, null, ApiKeyStatus.ACTIVE);
        ApiKey acmeApiMobileKey = createApiKey(acmeApi, "Mobile App Key",
                List.of(Scope.READ_USERS, Scope.READ_PROJECTS), 60, Instant.now().plus(90, ChronoUnit.DAYS), ApiKeyStatus.ACTIVE);
        ApiKey acmeInternalKey = createApiKey(acmeInternal, "Internal Dashboard Key",
                List.of(Scope.READ_ANALYTICS, Scope.ADMIN_ALL), 30, null, ApiKeyStatus.REVOKED);
        ApiKey nwCatalogKey = createApiKey(nwCatalog, "Dev Testing Key",
                List.of(Scope.READ_PROJECTS, Scope.WRITE_PROJECTS), 20, Instant.now().minus(2, ChronoUnit.DAYS), ApiKeyStatus.EXPIRED);

        seedUsageLogs(acmeApiProdKey, 400);
        seedUsageLogs(acmeApiMobileKey, 150);
        seedUsageLogs(acmeInternalKey, 10);
        seedUsageLogs(nwCatalogKey, 30);

        log.info("Seed complete: {} users, {} orgs, {} projects, {} keys",
                userRepository.count(), organizationRepository.count(), projectRepository.count(), apiKeyRepository.count());
    }

    private User createUser(String email, String fullName, Role role) {
        User user = User.builder()
                .email(email)
                .fullName(fullName)
                .passwordHash(passwordEncoder.encode("Password123!"))
                .role(role)
                .build();
        return userRepository.save(user);
    }

    private Organization createOrganization(String name, String slug, PlanTier tier, User owner) {
        Organization org = Organization.builder()
                .name(name)
                .slug(slug)
                .planTier(tier)
                .owner(owner)
                .build();
        return organizationRepository.save(org);
    }

    private void addMember(User user, Organization org, MembershipRole role) {
        membershipRepository.save(OrganizationMembership.builder()
                .user(user)
                .organization(org)
                .role(role)
                .build());
    }

    private Project createProject(Organization org, String name, String description, Environment env) {
        Project project = Project.builder()
                .organization(org)
                .name(name)
                .description(description)
                .environment(env)
                .build();
        return projectRepository.save(project);
    }

    private ApiKey createApiKey(Project project, String name, List<Scope> scopes, int rateLimit,
                                 Instant expiresAt, ApiKeyStatus status) {
        ApiKeyGenerator.GeneratedKey generated = apiKeyGenerator.generate(project.getEnvironment());

        ApiKey apiKey = ApiKey.builder()
                .project(project)
                .name(name)
                .keyPrefix(generated.keyPrefix())
                .hashedKey(generated.hashedKey())
                .scopes(scopes)
                .status(status)
                .rateLimitPerMinute(rateLimit)
                .expiresAt(expiresAt)
                .currentWindowCount(0)
                .currentWindowStart(Instant.now())
                .lastUsedAt(status == ApiKeyStatus.ACTIVE ? Instant.now().minus(1, ChronoUnit.HOURS) : null)
                .build();

        apiKey = apiKeyRepository.save(apiKey);

        User owner = project.getOrganization().getOwner();
        AuditLog auditLog = AuditLog.builder()
                .organizationId(project.getOrganization().getId())
                .actorUserId(owner.getId())
                .actorEmail(owner.getEmail())
                .action(status == ApiKeyStatus.REVOKED ? "API_KEY_REVOKED" : "API_KEY_CREATED")
                .targetType("API_KEY")
                .targetId(apiKey.getId())
                .build();
        auditLogRepository.save(auditLog);

        log.info("Seeded key '{}' -> full key (dev only, would never be logged in prod): {}", name, generated.fullKey());
        return apiKey;
    }

    private void seedUsageLogs(ApiKey apiKey, int count) {
        String[] endpoints = {"/api/demo/protected-resource", "/v1/users", "/v1/users/me", "/v1/billing/invoices"};
        String[] methods = {"GET", "GET", "GET", "POST"};
        List<ApiKeyUsageLog> logs = new ArrayList<>(count);

        for (int i = 0; i < count; i++) {
            int daysAgo = random.nextInt(30);
            int endpointIdx = random.nextInt(endpoints.length);
            boolean isError = random.nextInt(20) == 0;

            ApiKeyUsageLog log = ApiKeyUsageLog.builder()
                    .apiKey(apiKey)
                    .endpoint(endpoints[endpointIdx])
                    .httpMethod(methods[endpointIdx])
                    .statusCode(isError ? (random.nextBoolean() ? 429 : 500) : 200)
                    .responseTimeMs((long) (50 + random.nextInt(400)))
                    .occurredAt(Instant.now().minus(daysAgo, ChronoUnit.DAYS).minusSeconds(random.nextInt(86400)))
                    .build();
            logs.add(log);
        }
        usageLogRepository.saveAll(logs);
    }
}
