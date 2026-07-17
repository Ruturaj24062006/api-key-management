package com.careermatch.backend.job.entity;

public enum JobStatus {
    DRAFT,
    ACTIVE,      // publicly visible, accepting applications
    PAUSED,      // temporarily hidden from search
    CLOSED       // permanently closed, no longer accepting
}
