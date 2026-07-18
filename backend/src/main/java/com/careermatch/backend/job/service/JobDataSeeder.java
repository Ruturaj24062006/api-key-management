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
        // Ensure Nexora Technologies Pvt. Ltd. company exists
        Company company = companyRepository.findByNameIgnoreCase("Nexora Technologies Pvt. Ltd.")
                .orElseGet(() -> companyRepository.save(Company.builder()
                        .name("Nexora Technologies Pvt. Ltd.")
                        .industry("Information Technology & Software")
                        .domain("nexoratech.example")
                        .websiteUrl("https://nexoratech.example")
                        .location("Hinjawadi, Pune, Maharashtra, India")
                        .description("Nexora Technologies is a technology-driven software company specializing in Artificial Intelligence, cloud computing, enterprise software, and data-driven solutions. We build scalable digital products that help businesses solve complex problems through innovative technology. Our team consists of engineers, designers, and researchers working together to create impactful solutions. We provide opportunities for students and professionals to work on real-world projects in AI/ML, full-stack development, cloud technologies, and data engineering.")
                        .build()));

        // Ensure Nexora recruiter user exists
        User recruiterUser = userRepository.findByEmail("hr@nexoratech.example")
                .orElseGet(() -> userRepository.save(User.builder()
                        .id(UUID.randomUUID())
                        .email("hr@nexoratech.example")
                        .passwordHash(passwordEncoder.encode("NexoraRecruiterPass123!"))
                        .role(UserRole.ROLE_RECRUITER)
                        .isVerified(true)
                        .build()));

        Recruiter recruiter = recruiterRepository.findById(recruiterUser.getId())
                .orElseGet(() -> recruiterRepository.save(Recruiter.builder()
                        .user(recruiterUser)
                        .company(company)
                        .jobTitle("HR & University Relations Manager")
                        .isVerified(true)
                        .build()));

        // Check if Nexora jobs already exist
        long nexoraJobCount = jobRepository.findAll().stream()
                .filter(j -> j.getCompany() != null && "Nexora Technologies Pvt. Ltd.".equalsIgnoreCase(j.getCompany().getName()))
                .count();

        if (nexoraJobCount >= 4) {
            log.info("Nexora Technologies jobs already present ({} jobs). Skipping duplicate seed.", nexoraJobCount);
            return;
        }

        log.info("Seeding Nexora Technologies Pvt. Ltd. jobs into database...");

        List<JobSeedData> seedList = List.of(
                new JobSeedData(
                        "AI & Machine Learning Solutions Engineer",
                        "Design and build next-generation Artificial Intelligence, LLM, and cloud-driven enterprise solutions at Nexora Technologies. Work with RAG workflows, vector search, and PyTorch models.",
                        "Degree in CS/IT/Data Science. Experience with Python, PyTorch, Vector Embeddings, LLM prompt engineering, and REST API development.",
                        "Hinjawadi, Pune, Maharashtra, India",
                        JobType.FULL_TIME,
                        "Entry-Mid (0-3 yrs)",
                        "₹14–22 LPA",
                        "Python, Artificial Intelligence, Machine Learning, PyTorch, RAG, Vector Search, LLM, FastAPI",
                        "Docker, LangChain, PostgreSQL, Cloud Computing",
                        "HYBRID"
                ),
                new JobSeedData(
                        "Full Stack Java & Angular Engineer",
                        "Build scalable enterprise web platforms for Nexora's clients. Develop microservices backends using Java 21 & Spring Boot 3, and rich frontend interfaces with Angular 17.",
                        "B.Tech/BE in CS/IT. Strong foundation in Java, Spring Boot, Angular, TypeScript, PostgreSQL, and RESTful API architecture.",
                        "Hinjawadi, Pune, Maharashtra, India",
                        JobType.FULL_TIME,
                        "Entry-Mid (1-3 yrs)",
                        "₹12–18 LPA",
                        "Java, Spring Boot, Angular, TypeScript, PostgreSQL, REST API, Microservices",
                        "Docker, Redis, RabbitMQ, TailwindCSS",
                        "HYBRID"
                ),
                new JobSeedData(
                        "Cloud & Data Engineering Specialist",
                        "Architect distributed data processing pipelines and manage cloud computing infrastructure on AWS for data-intensive enterprise applications.",
                        "Degree in CS or related field. Hands-on experience with SQL, Python, AWS cloud services, data modeling, and Docker containerization.",
                        "Hinjawadi, Pune, Maharashtra, India",
                        JobType.FULL_TIME,
                        "Mid Level (1-4 yrs)",
                        "₹15–24 LPA",
                        "Cloud Computing, Data Engineering, AWS, SQL, Python, Docker, Kubernetes, Data Modeling",
                        "Terraform, Kafka, Spark, Linux",
                        "HYBRID"
                ),
                new JobSeedData(
                        "Enterprise Frontend Software Developer",
                        "Craft modern, glassmorphism-driven responsive dashboards and user experiences for Nexora's AI and cloud SaaS products using Angular, TypeScript, and CSS3.",
                        "Solid understanding of JavaScript, TypeScript, Angular, RxJS, HTML5, CSS3, and UI performance optimization.",
                        "Hinjawadi, Pune, Maharashtra, India",
                        JobType.FULL_TIME,
                        "Entry Level (0-2 yrs)",
                        "₹10–15 LPA",
                        "Angular, TypeScript, HTML5, CSS3, JavaScript, UI/UX, RxJS, REST API",
                        "TailwindCSS, Webpack, Responsive Design",
                        "HYBRID"
                ),
                new JobSeedData(
                        "Software Development Engineer (Python & Microservices)",
                        "Develop high-throughput, asynchronous microservices and backend systems supporting Nexora's data-driven products.",
                        "Proficiency in Python, FastAPI, Django, PostgreSQL, microservices architecture, and API design.",
                        "Hinjawadi, Pune, Maharashtra, India",
                        JobType.FULL_TIME,
                        "Mid Level (2-4 yrs)",
                        "₹16–25 LPA",
                        "Python, FastAPI, Django, PostgreSQL, Microservices, Redis, Docker, REST API",
                        "RabbitMQ, AWS, CI/CD",
                        "REMOTE"
                )
        );

        for (JobSeedData data : seedList) {
            String fullContext = data.title + " " + data.description + " " + data.requirements + " " + data.requiredSkills + " Nexora Technologies Pune Hinjawadi";
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
                    .deadline(LocalDateTime.now().plusDays(45))
                    .build();

            jobRepository.save(job);
        }

        log.info("Successfully seeded {} jobs for Nexora Technologies Pvt. Ltd. into database.", seedList.size());
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
