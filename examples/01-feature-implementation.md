# Example — Implement a Feature Across the Stack

## Request
“Add a page where signed-in users can create and view their own projects.”

## Step 1: Acceptance criteria
- Signed-in user can create a project with a validated name.
- User can list only projects they are authorized to see.
- Empty, loading, success, and error states are visible.
- Requests from unauthenticated users are rejected.
- Changing a project ID never grants access to another user's project.
- Duplicate submissions and invalid names are handled.

## Step 2: Trace layers
```text
Browser form
  -> POST /api/projects
  -> authentication middleware
  -> request schema validation
  -> project use case
  -> repository scoped to authenticated user
  -> database constraint/transaction
  -> stable API response
  -> UI success/error state
```

## Step 3: Implementation notes
- Inspect current routing, auth, database model, UI patterns, and test commands first.
- Reuse the project's existing form and API client.
- Derive `ownerId` from the authenticated server identity, never from request JSON.
- Add integration tests for unauthenticated requests and cross-user reads.
- Add frontend tests for validation and server errors.

## Step 4: Verification report
List only commands actually executed. If the database is unavailable, state that integration tests were not run and why; do not claim full verification.
