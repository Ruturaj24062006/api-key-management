-- Enable pgvector extension (Supabase supports this out of the box)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token VARCHAR(255),
    otp VARCHAR(10),
    otp_expiry TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 2. Companies Table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    website_url VARCHAR(255),
    description TEXT,
    logo_url VARCHAR(255),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 3. Recruiters Table
CREATE TABLE IF NOT EXISTS recruiters (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    job_title VARCHAR(255),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 4. Students Table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    bio TEXT,
    profile_completed_pct INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 5. Student Skills Table
CREATE TABLE IF NOT EXISTS student_skills (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    proficiency_level VARCHAR(50) NOT NULL DEFAULT 'INTERMEDIATE'
);

-- 6. Student Education Table
CREATE TABLE IF NOT EXISTS student_education (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    institution VARCHAR(255) NOT NULL,
    degree VARCHAR(255),
    field_of_study VARCHAR(255),
    gpa DOUBLE PRECISION,
    start_date DATE,
    end_date DATE
);

-- 7. Student Experience Table
CREATE TABLE IF NOT EXISTS student_experience (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE
);

-- 8. Student Projects Table
CREATE TABLE IF NOT EXISTS student_projects (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    repo_url VARCHAR(255),
    technologies VARCHAR(255)
);

-- 9. Student Certifications Table
CREATE TABLE IF NOT EXISTS student_certifications (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    issuing_organization VARCHAR(255),
    issue_date DATE,
    expiration_date DATE
);

-- 10. Resumes Table
CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    file_url VARCHAR(255) NOT NULL,
    parsed_text TEXT,
    extracted_json TEXT,
    embedding vector(384),
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 11. Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    recruiter_id UUID NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    location VARCHAR(255),
    job_type VARCHAR(50) NOT NULL,
    experience_level VARCHAR(50),
    salary_range VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    embedding vector(384),
    fts tsvector,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 12. Matches Table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    score DOUBLE PRECISION NOT NULL,
    raw_analysis TEXT,
    roadmap_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE (student_id, job_id)
);

-- 13. Applications Table
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
    cover_letter TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE (student_id, job_id)
);

-- 14. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'UNREAD',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- ==========================================
-- INDEXES & TRIGGERS FOR HYBRID SEARCH & PERFORMANCE
-- ==========================================

-- 1. Full-Text Search Vector Trigger on Jobs table
CREATE OR REPLACE FUNCTION jobs_tsvector_trigger() RETURNS trigger AS $$
begin
  new.fts :=
    to_tsvector('english', coalesce(new.title, '')) ||
    to_tsvector('english', coalesce(new.description, '')) ||
    to_tsvector('english', coalesce(new.requirements, ''));
  return new;
end
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_jobs_fts_update
BEFORE INSERT OR UPDATE ON jobs
FOR EACH ROW EXECUTE FUNCTION jobs_tsvector_trigger();

-- 2. GIN Index for Fast Keyword Full-Text Search
CREATE INDEX IF NOT EXISTS idx_jobs_fts ON jobs USING gin(fts);

-- 3. HNSW Vector Cosine Distance Indexes for pgvector (highly efficient search)
CREATE INDEX IF NOT EXISTS idx_jobs_embedding ON jobs USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_resumes_embedding ON resumes USING hnsw (embedding vector_cosine_ops);

-- 4. Foreign Key B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_recruiters_company ON recruiters(company_id);
CREATE INDEX IF NOT EXISTS idx_student_skills_student ON student_skills(student_id);
CREATE INDEX IF NOT EXISTS idx_student_edu_student ON student_education(student_id);
CREATE INDEX IF NOT EXISTS idx_student_exp_student ON student_experience(student_id);
CREATE INDEX IF NOT EXISTS idx_student_proj_student ON student_projects(student_id);
CREATE INDEX IF NOT EXISTS idx_resumes_student ON resumes(student_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter ON jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_matches_student ON matches(student_id);
CREATE INDEX IF NOT EXISTS idx_matches_job ON matches(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_student ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
