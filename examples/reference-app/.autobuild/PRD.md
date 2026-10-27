# PRD — Tasklane

## Problem
Freelancers and small-project owners juggle tasks across notes apps and spreadsheets. Heavy tools
(Jira, Asana) are overkill; plain lists lose structure. They want projects with a clear "what's next".

## Primary user
An individual (not a team) managing 2–15 personal or client projects, on desktop and phone.

## Core loop
Open app → pick project → add task / move task to Doing or Done → see what's open and what's late.

## Activation moment
Within 60 seconds of signing up: one project with one task created.

## Scope
**Must**
- S-01 Sign up / sign in / sign out with email + password
- S-02 Create, rename, delete projects (unique names per user)
- S-03 Add tasks with optional due date; overdue tasks are highlighted
- S-04 Move tasks through To do → Doing → Done; filter by status
- S-05 Security baseline: users can only ever see/change their own data
- S-06 Export all my data; delete my account and all data
**Should** (deferred → BACKLOG): password reset (needs email provider), task reordering, search, dark-mode toggle
**Won't (this build)**: teams/sharing, comments, attachments, notifications, mobile apps

## Acceptance criteria (abridged — every line has an automated test)
- S-01: Given a new email and a ≥10-char password, sign-up returns 201, sets an HttpOnly SameSite=Lax cookie, and lands on /app. Invalid email/short password → field errors. Duplicate email (any case) → 409 on `email`. Wrong password and unknown email → identical 401.
- S-02: Name 1–80 chars, trimmed; duplicate name (case-insensitive) for the same user → 409; another user may reuse it. Deleting a project deletes its tasks.
- S-03: Title 1–200 chars; dueOn must be a real calendar date or null; defaults to status `todo`.
- S-04: Status change uses the version the client saw; a stale version → 409 and no overwrite. Filter shows only matching tasks.
- S-05: For every resource route, another user receives 404 and nothing changes; unknown body fields are rejected; cross-origin writes → 403; brute-force sign-in → 429.
- S-06: Export returns user, projects, tasks without secrets; deletion requires the password and removes every row owned by the user.

## Non-functional
p95 < 300 ms on seed data · WCAG 2.2 AA basics · responsive from 360 px · no PII in logs ·
single-instance deployment with a persistent volume · zero runtime dependencies (environment constraint, see D-001).
