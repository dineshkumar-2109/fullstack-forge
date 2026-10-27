# 13 — Documentation and Repository Hygiene

## Required documentation as appropriate
- README: purpose, features, architecture overview, prerequisites, setup, run/test/build commands.
- `.env.example`: variable names and safe placeholders, with explanation of required values.
- API documentation: endpoints, schemas, authentication, errors, pagination, examples.
- Architecture decisions: major trade-offs and consequences.
- Operations docs: deployment, migrations, backups, rollback, alerts, runbooks.
- AI docs: data flows, provider/model configuration, prompt/versioning strategy, retrieval sources, evaluation, costs, and safety boundaries.

## Repository hygiene
- Respect `.gitignore` and do not commit generated secrets, local databases, build output, private uploads, or machine-specific files.
- Keep scripts repeatable and document prerequisites.
- Use consistent formatting and linting.
- Avoid giant README files; link to focused docs where appropriate.
- Keep sample data synthetic and safe.
- Update docs when behavior or configuration changes.

## Example README setup section
```md
## Local setup
1. Install the runtime and package manager versions listed in `.tool-versions` / `package.json`.
2. Copy `.env.example` to `.env` and fill in local values.
3. Install dependencies using the repository's package manager.
4. Run database migrations against a local development database.
5. Start the API and frontend using the documented commands.
6. Run lint, type checks, tests, and build before opening a pull request.
```
Adapt the commands to the actual repository; never invent scripts.
