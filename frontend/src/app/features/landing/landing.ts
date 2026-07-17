import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navbar } from '../../shared/components/navbar/navbar';
import { Footer } from '../../shared/components/footer/footer';
import { JobCard, JobCardSkill } from '../../shared/components/job-card/job-card';

interface LandingTestimonial {
  quote: string;
  name: string;
  role: string;
  avatarLetter: string;
}

interface LandingFeatureRow {
  title: string;
  traditional: string;
  nexus: string;
}

@Component({
  selector: 'app-landing',
  imports: [NgFor, RouterLink, Navbar, Footer, JobCard],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class Landing {
  // Testimonials content
  protected readonly testimonials: LandingTestimonial[] = [
    {
      quote: "For the first time, I understood exactly why I was getting rejected. I fixed two key skills on my resume and landed an interview at Google in 2 weeks.",
      name: "Alex Chen",
      role: "M.S. in Computer Science",
      avatarLetter: "A"
    },
    {
      quote: "As an international student, sponsorship transparency is a lifesaver. NEXUS saved me hundreds of hours of wasted job applications.",
      name: "Priya Patel",
      role: "Software Engineering Graduate",
      avatarLetter: "P"
    },
    {
      quote: "NEXUS is like having a former recruiter look over your resume and give you the answers before you even click submit. Indispensable.",
      name: "Marcus Thorne",
      role: "Senior Backend Developer",
      avatarLetter: "M"
    }
  ];

  // Comparison table feature list
  protected readonly comparisonTable: LandingFeatureRow[] = [
    {
      title: "Match Transparency",
      traditional: "Binary Match / Black Box",
      nexus: "Detailed % Score Breakdown"
    },
    {
      title: "Sponsorship Indexing",
      traditional: "Hidden or Manual Filter",
      nexus: "Instant Smart Sponsor Filter"
    },
    {
      title: "Resume Relevance",
      traditional: "Static PDF Keyword Match",
      nexus: "Multi-Dimensional Vector Profile"
    },
    {
      title: "Developer Feedback",
      traditional: "None / Ghosted",
      nexus: "Real-time Skill Gap Roadmaps"
    }
  ];

  // Mock skills array for the demo JobCard
  protected readonly demoJobSkills: JobCardSkill[] = [
    { name: 'Java', matched: true },
    { name: 'Spring Boot', matched: true },
    { name: 'PostgreSQL', matched: true },
    { name: 'RabbitMQ', matched: true },
    { name: 'Redis', matched: true },
    { name: 'Docker', matched: true },
    { name: 'Kubernetes', matched: false }
  ];
}
