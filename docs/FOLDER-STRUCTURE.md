# KeyForge — Folder Structure

## backend/

```
backend/
├── pom.xml                                Maven build, Spring Boot 3.3.x, Java 21
├── .env.example                           Sample env vars (DB, JWT secret, CORS, etc.)
└── src/main/
    ├── resources/
    │   └── application.yml                Spring config, reads from env vars with defaults
    └── java/com/credx/keyforge/
        ├── KeyforgeApplication.java       @SpringBootApplication entry point
        ├── config/
        │   └── DataSeeder.java            CommandLineRunner - seeds demo orgs/projects/keys/logs
        ├── entity/                        JPA entities (one class per table)
        │   ├── User.java
        │   ├── Organization.java
        │   ├── OrganizationMembership.java
        │   ├── Project.java
        │   ├── ApiKey.java
        │   ├── ApiKeyUsageLog.java
        │   ├── AuditLog.java
        │   └── Role.java / PlanTier.java / MembershipRole.java / Environment.java
        │       / ApiKeyStatus.java / Scope.java   (enums)
        ├── repository/                    Spring Data JPA interfaces
        │   ├── UserRepository.java
        │   ├── OrganizationRepository.java
        │   ├── OrganizationMembershipRepository.java
        │   ├── ProjectRepository.java
        │   ├── ApiKeyRepository.java
        │   ├── ApiKeyUsageLogRepository.java
        │   └── AuditLogRepository.java
        ├── dto/                           Request/response records, grouped by feature
        │   ├── auth/                      LoginRequest, RegisterRequest, AuthResponse
        │   ├── org/                       CreateOrganizationRequest, OrganizationResponse, ...
        │   ├── project/                   CreateProjectRequest, ProjectResponse, ...
        │   ├── apikey/                    CreateApiKeyRequest, ApiKeyResponse, ApiKeyCreatedResponse
        │   ├── usage/                     UsageLogResponse, UsageAnalyticsResponse, DashboardStatsResponse
        │   └── common/                    ApiErrorResponse (shared error shape)
        ├── service/                       Business logic layer
        │   ├── AuthService.java
        │   ├── OrganizationService.java
        │   ├── OrganizationAccessService.java   Central org-membership/role checks
        │   ├── ProjectService.java
        │   ├── ApiKeyService.java               Key CRUD, revoke; rotate() is a stub
        │   ├── ApiKeyValidationService.java      Resolves+validates a presented key, rate counting
        │   ├── UsageLoggingService.java          Writes ApiKeyUsageLog rows
        │   └── UsageAnalyticsService.java        Calls-per-day aggregation, dashboard stats
        ├── controller/                     REST controllers (thin, delegate to services)
        │   ├── AuthController.java
        │   ├── OrganizationController.java
        │   ├── ProjectController.java
        │   ├── ApiKeyController.java
        │   ├── UsageController.java
        │   ├── UsageLogController.java
        │   ├── DemoResourceController.java       The simulated "protected resource"
        │   ├── AdminController.java              Platform super-admin, mostly unimplemented
        │   └── ReportsController.java            Internal CSV export helper, unpaginated
        ├── security/
        │   ├── JwtService.java                   Sign/parse JWTs (jjwt)
        │   ├── AuthenticatedUser.java             UserDetails implementation from JWT claims
        │   ├── JwtAuthenticationFilter.java       Reads Authorization header, populates SecurityContext
        │   ├── CurrentUserProvider.java           Convenience accessor for "who is calling"
        │   └── SecurityConfig.java                Filter chain, CORS, route authorization rules
        ├── filter/
        │   └── ApiKeyAuthFilter.java              Guards /api/demo/protected-resource via X-API-Key
        ├── util/
        │   ├── ApiKeyGenerator.java               Generates+hashes keys; hash comparison lives here
        │   └── DateFormatUtil.java                Shared UTC day formatter
        └── exception/
            ├── GlobalExceptionHandler.java        @RestControllerAdvice, consistent error shape
            ├── ResourceNotFoundException.java
            ├── DuplicateResourceException.java
            ├── ForbiddenOperationException.java
            └── InvalidCredentialsException.java
```

## frontend/

```
frontend/
├── angular.json                           Angular 20 workspace config (application builder)
├── package.json                           Angular 20 deps, Material, RxJS
├── tsconfig*.json
└── src/
    ├── index.html
    ├── main.ts                            bootstrapApplication(App, appConfig)
    ├── styles.scss                        Global styles + shared utility classes (.kf-page, etc.)
    ├── environments/
    │   ├── environment.ts                 apiBaseUrl for local dev
    │   └── environment.prod.ts
    └── app/
        ├── app.ts                         Root standalone component (<router-outlet>)
        ├── app.config.ts                  providers: router, HttpClient+interceptors, animations
        ├── app.routes.ts                  Route table, lazy loadComponent everywhere
        ├── core/
        │   ├── models/                    TypeScript interfaces matching backend DTOs
        │   │   ├── user.model.ts
        │   │   ├── organization.model.ts
        │   │   ├── project.model.ts
        │   │   ├── api-key.model.ts
        │   │   ├── usage.model.ts
        │   │   └── api-error.model.ts
        │   ├── services/                  HttpClient-based API clients
        │   │   ├── auth.service.ts
        │   │   ├── organization.service.ts
        │   │   ├── project.service.ts
        │   │   ├── api-key.service.ts
        │   │   └── usage.service.ts
        │   ├── state/
        │   │   └── session-state.service.ts     Signals: current user, orgs, selected org
        │   ├── guards/
        │   │   ├── auth.guard.ts                authGuard / guestGuard (CanActivateFn)
        │   │   └── org-role.guard.ts             orgRoleGuard(allowedRoles) factory
        │   └── interceptors/
        │       └── auth.interceptor.ts           Attaches JWT, redirects to /login on 401
        ├── layout/
        │   ├── main-layout/                Sidenav + toolbar shell, loads orgs on init
        │   ├── topbar/                     Org switcher, user menu
        │   └── sidebar/                    Nav links
        ├── features/
        │   ├── auth/
        │   │   ├── login/
        │   │   └── register/
        │   ├── dashboard/                  Stat cards, polling live counter (signals + interval)
        │   ├── projects/
        │   │   ├── project-list/
        │   │   └── project-form-dialog/
        │   ├── api-keys/
        │   │   ├── api-key-list/           Table, pagination, create/revoke/rotate actions
        │   │   ├── create-api-key-dialog/  Scope checkboxes, expiry picker, rate limit input
        │   │   └── key-created-dialog/     One-time full-key reveal + copy-to-clipboard
        │   ├── analytics/                  Calls-per-day table + summary cards
        │   ├── audit-log/                  Placeholder shell (feature gap, see README)
        │   └── key-rotation/
        │       └── key-rotation-panel.component.ts   NOT routed - earlier draft, dead code
        └── shared/
            ├── components/
            │   ├── empty-state/
            │   └── loading-spinner/
            ├── pipes/
            │   └── mask-key.pipe.ts
            └── utils/
                └── format.utils.ts          Second, slightly different key-masking helper
```
