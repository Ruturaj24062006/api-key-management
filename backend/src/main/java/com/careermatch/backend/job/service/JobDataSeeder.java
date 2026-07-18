package com.careermatch.backend.job.service;

import com.careermatch.backend.ai.service.EmbeddingService;
import com.careermatch.backend.auth.entity.User;
import com.careermatch.backend.auth.entity.UserRole;
import com.careermatch.backend.auth.repository.UserRepository;
import com.careermatch.backend.company.entity.Company;
import com.careermatch.backend.company.repository.CompanyRepository;
import com.careermatch.backend.job.entity.Job;
import com.careermatch.backend.job.entity.JobStatus;
import com.careermatch.backend.job.entity.JobType;
import com.careermatch.backend.job.repository.JobRepository;
import com.careermatch.backend.recruiter.entity.Recruiter;
import com.careermatch.backend.recruiter.repository.RecruiterRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class JobDataSeeder {

    private final JobRepository jobRepository;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final RecruiterRepository recruiterRepository;
    private final EmbeddingService embeddingService;
    private final PasswordEncoder passwordEncoder;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seedJobsOnStartup() {
        if (jobRepository.count() >= 5) {
            log.info("Job database already populated with {} jobs. Skipping seed.", jobRepository.count());
            return;
        }

        log.info("Seeding demo jobs into database...");

        // 1. Find or create default demo company
        Company company = companyRepository.findByNameIgnoreCase("Nexus Global Tech")
                .orElseGet(() -> companyRepository.save(Company.builder()
                        .name("Nexus Global Tech")
                        .industry("Information Technology & AI")
                        .domain("careermatch.com")
                        .websiteUrl("https://careermatch.ai")
                        .location("Bengaluru, India")
                        .description("Leading AI and Software Engineering solutions provider.")
                        .build()));

        // 2. Find or create default demo recruiter user
        User recruiterUser = userRepository.findByEmail("demo.recruiter@careermatch.com")
                .orElseGet(() -> userRepository.save(User.builder()
                        .id(UUID.randomUUID())
                        .email("demo.recruiter@careermatch.com")
                        .passwordHash(passwordEncoder.encode("RecruiterPass123!"))
                        .role(UserRole.ROLE_RECRUITER)
                        .isVerified(true)
                        .build()));

        Recruiter recruiter = recruiterRepository.findById(recruiterUser.getId())
                .orElseGet(() -> recruiterRepository.save(Recruiter.builder()
                        .user(recruiterUser)
                        .company(company)
                        .jobTitle("Talent Acquisition Lead")
                        .isVerified(true)
                        .build()));

        // 3. Define Demo Jobs
        List<JobSeedData> seedList = List.of(
                new JobSeedData(
                        "Senior Full Stack Java & Angular Engineer",
                        "We are seeking an experienced Full Stack Developer to build enterprise-scale web applications. You will work with Java 21, Spring Boot 3, Angular 17, and PostgreSQL.",
                        "Degree in CS or equivalent. Strong command over Java, REST APIs, TypeScript, Angular, and relational databases. Experience with microservices and Docker is a plus.",
                        "Bengaluru, KA (Hybrid)",
                        JobType.FULL_TIME,
                        "Mid-Senior (2-5 yrs)",
                        "₹14–22 LPA",
                        "Java, Spring Boot, Angular, TypeScript, PostgreSQL, REST API",
                        "Docker, Kubernetes, AWS, Microservices",
                        "HYBRID"
                ),
                new JobSeedData(
                        "Backend Developer (Spring Boot & Microservices)",
                        "Join our core platform team to build scalable microservices handling millions of API requests. Deep expertise in Java, Spring Data JPA, RabbitMQ, and Redis required.",
                        "B.Tech/B.E in Computer Science. Proven experience in designing distributed backend architectures, caching, and async messaging queues.",
                        "Remote (India)",
                        JobType.FULL_TIME,
                        "Mid Level (2-4 yrs)",
                        "₹16–25 LPA",
                        "Java, Spring Boot, Microservices, RabbitMQ, Redis, PostgreSQL",
                        "Kafka, Docker, AWS, CI/CD",
                        "REMOTE"
                ),
                new JobSeedData(
                        "Frontend Engineer (Angular & Modern UI/UX)",
                        "Looking for a passionate Frontend Developer to craft sleek, responsive, and glassmorphism-driven modern web dashboards using Angular, Signals, and CSS3.",
                        "Solid grasp of JavaScript/TypeScript, Angular 16+, RxJS, CSS Flexbox/Grid, and responsive UI performance optimization.",
                        "Hyderabad, TS",
                        JobType.FULL_TIME,
                        "Entry-Mid (1-3 yrs)",
                        "₹10–16 LPA",
                        "Angular, TypeScript, HTML5, CSS3, SCSS, RxJS, REST API",
                        "TailwindCSS, Webpack, Figma to Code",
                        "HYBRID"
                ),
                new JobSeedData(
                        "AI & Machine Learning Research Engineer",
                        "Architect next-generation AI agents, LLM integrations, vector search pipelines, and recommendation algorithms using Python, PyTorch, Groq, and pgvector.",
                        "Degree in Data Science/CS. Hands-on experience with LLMs, prompt engineering, RAG architectures, and dense vector embeddings.",
                        "Bengaluru, KA",
                        JobType.FULL_TIME,
                        "Entry-Mid (0-3 yrs)",
                        "₹18–30 LPA",
                        "Python, PyTorch, LLM, RAG, Vector Embeddings, Groq, FastAPI",
                        "LangChain, LlamaIndex, pgvector, Docker",
                        "ONSITE"
                ),
                new JobSeedData(
                        "DevOps & Cloud Infrastructure Engineer",
                        "Maintain high availability across our cloud infrastructure. You will manage Kubernetes clusters, CI/CD pipelines, AWS services, and Infrastructure as Code.",
                        "Strong background in Linux administration, Terraform, Docker container orchestration, and automated deployment pipelines.",
                        "Pune, MH",
                        JobType.FULL_TIME,
                        "Mid Level (2-4 yrs)",
                        "₹14–20 LPA",
                        "Docker, Kubernetes, Terraform, AWS, CI/CD, GitHub Actions, Linux",
                        "Ansible, Prometheus, Grafana, Python scripting",
                        "HYBRID"
                ),
                new JobSeedData(
                        "Data Analyst & Business Intelligence Specialist",
                        "Transform raw datasets into actionable executive insights. Build automated dashboards, SQL queries, and predictive ML models for decision-making.",
                        "Proficiency in SQL, Python, Power BI/Tableau, and statistical analysis. Strong communication skills.",
                        "Gurugram, HR",
                        JobType.FULL_TIME,
                        "Entry Level (0-2 yrs)",
                        "₹8–13 LPA",
                        "SQL, Python, Power BI, Tableau, Excel, Data Modeling",
                        "Pandas, Scikit-learn, BigQuery",
                        "HYBRID"
                )
        );

        for (JobSeedData data : seedList) {
            String fullContext = data.title + " " + data.description + " " + data.requirements + " " + data.requiredSkills;
            float[] vector = embeddingService.generateEmbedding(fullContext);

            Job job = Job.builder()
                    .company(company)
                    .recruiter(recruiter)
                    .title(data.title)
                    .description(data.description)
                    .requirements(data.requirements)
                    .location(data.location)
                    .jobType(data.jobType)
                    .experienceLevel(data.experienceLevel)
                    .salaryRange(data.salaryRange)
                    .requiredSkills(data.requiredSkills)
                    .preferredSkills(data.preferredSkills)
                    .workMode(data.workMode)
                    .sponsorshipAvailable(true)
                    .status(JobStatus.ACTIVE)
                    .embedding(vector)
                    .createdAt(LocalDateTime.now())
                    .deadline(LocalDateTime.now().plusDays(30))
                    .build();

            jobRepository.save(job);
        }

        log.info("Successfully seeded {} active demo jobs into database.", seedList.size());
    }

    private record JobSeedData(
            String title,
            String description,
            String requirements,
            String location,
            JobType jobType,
            String experienceLevel,
            String salaryRange,
            String requiredSkills,
            String preferredSkills,
            String workMode
    ) {}
}
