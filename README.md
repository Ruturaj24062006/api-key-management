# NEXUS - Smart Job Matching Dashboard

A modern, AI-powered job matching and candidate discovery platform designed to align job seekers with relevant opportunities using semantic search, hybrid rank fusion, and interactive AI assistance.

---

## 👥 Team Details
- **Team Name**: the solver squad
- **Team Members**:
  - Ruturaj Ambure
  - Shantanu Gudmewar
  - Atharv Bhasar

---

## 🌐 Deployed Links
- **Frontend App**: [https://nexus-frontend.onrender.com](https://nexus-frontend.onrender.com)
- **Backend API**: [https://nexus-backend-56gy.onrender.com](https://nexus-backend-56gy.onrender.com)

---

## 🔑 Test Credentials & Authentication
You can log in using the pre-seeded recruiter account, or register a new account directly through the signup page.

### 🏢 Recruiter Account (Pre-Seeded)
- **Email**: `demo.recruiter@careermatch.com`
- **Password**: `RecruiterPass123!`
- **Role**: RECRUITER

### 🎓 Student & Recruiter Registration
- Navigate to the **Create Account** page (`/register`) to register fresh student or recruiter accounts.
- The registration flow allows you to choose your role, set your credentials, and automatically initializes your profile.

---

## 🛠️ Tech Stack & Architecture

### Frontend (Angular)
- **Framework**: Angular 17+ (using modern standalone components, Signals for state management, and Reactive Forms).
- **Styling**: Premium Glassmorphism UI styled with vanilla CSS, custom variables, micro-animations, and responsive grids.
- **SSO Integration**: Google One-Tap Sign-In / Google OAuth via Supabase Auth integration.

### Backend (Spring Boot)
- **Framework**: Spring Boot 3 with Spring Security & stateless JWT Authentication.
- **Database**: PostgreSQL with `pgvector` for storing and performing high-speed cosine similarity searches on embeddings.
- **Caching & Queues**: Redis for caching and RabbitMQ for asynchronous event publishing (e.g. background job-matching runs).
- **AI Pipelines**: Semantic resume parsing and match explanation using LLMs (Groq API, LlamaIndex/LangChain abstractions).
