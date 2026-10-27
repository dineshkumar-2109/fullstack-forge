#!/usr/bin/env python3
"""Score a project's production readiness and list the gaps.

Usage:
    python3 readiness_audit.py PROJECT_DIR [--json] [--min-score 90]

Static checks across docs, configuration, quality, CI, containers, security, operations
and data. Each check has a weight; some are CRITICAL (any critical failure fails the audit
regardless of score). The audit is heuristic -- it proves the *presence* of production
mechanisms, not their correctness; tests and the smoke test prove behaviour.
Exit 0 when score >= min-score and no critical check failed.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from detect_stack import detect  # noqa: E402
from secret_scan import scan as secret_scan  # noqa: E402

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "dist", "build", ".next", "__pycache__", "coverage", ".autobuild", "target"}
CODE_SUFFIXES = {".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".go", ".rs", ".java", ".kt", ".cs", ".rb", ".php"}


def source_files(root: Path) -> list[Path]:
    files = []
    for p in root.rglob("*"):
        if p.is_file() and p.suffix in CODE_SUFFIXES and not (set(p.relative_to(root).parts) & SKIP_DIRS):
            files.append(p)
    return files


def corpus(files: list[Path]) -> str:
    chunks = []
    for p in files:
        try:
            chunks.append(p.read_text(encoding="utf-8", errors="replace")[:200_000])
        except OSError:
            pass
    return "\n".join(chunks)


def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def audit(root: Path) -> dict:
    info = detect(root)
    files = source_files(root)
    non_test = [p for p in files if not re.search(r"(^|/)(tests?|__tests__|e2e|spec)(/|$)|\.(test|spec)\.", str(p.relative_to(root)))]
    code = corpus(non_test)
    readme = read(root / "README.md")
    gitignore = read(root / ".gitignore")
    dockerfile = read(root / "Dockerfile")
    test_files = [p for p in files if re.search(r"(^|/)(tests?|__tests__|e2e)(/|$)|\.(test|spec)\.|(^|/)test_[^/]+\.py$", str(p.relative_to(root)))]
    secrets = secret_scan(root)
    uses_env = bool(re.search(r"process\.env|os\.environ|getenv\(|import\.meta\.env|env::var|System\.getenv", code))

    checks: list[tuple[str, str, int, bool, bool, str]] = []  # (category, name, weight, critical, passed, hint)

    def add(cat: str, name: str, weight: int, critical: bool, passed: bool, hint: str) -> None:
        checks.append((cat, name, weight, critical, bool(passed), hint))

    # Documentation
    add("Docs", "README.md exists", 5, True, bool(readme), "Add a README with purpose, quick start, scripts, env vars, deploy.")
    add("Docs", "README has setup/run instructions", 4, False, re.search(r"(?i)(quick ?start|getting started|setup|install|run locally)", readme), "Add a 'Quick start' section with ≤5 commands.")
    add("Docs", "README documents environment variables", 2, False, re.search(r"(?i)(environment|env var|\.env)", readme), "Document every env var (or point to .env.example).")
    add("Docs", "Operational docs (runbook/deploy)", 3, False, any((root / d).exists() for d in ("docs/runbook.md", "RUNBOOK.md", "docs/deploy.md", "docs/operations.md")) or re.search(r"(?i)(deploy|runbook)", readme), "Add docs/runbook.md: deploy, rollback, health, common incidents.")
    add("Docs", "CHANGELOG", 1, False, (root / "CHANGELOG.md").exists(), "Start a CHANGELOG.md.")

    # Configuration
    add("Config", ".env.example present (env is used)", 5, uses_env, (not uses_env) or info["env_example"], "Create .env.example with every variable and safe placeholders.")
    dep_dirs_ok = (("JavaScript/TypeScript" not in info["languages"] or "node_modules" in gitignore)
                   and ("Python" not in info["languages"] or any(x in gitignore for x in (".venv", "venv", "__pycache__"))))
    add("Config", ".gitignore ignores .env and deps", 4, True, bool(gitignore) and ".env" in gitignore and dep_dirs_ok, "Add .env, dependency dirs, build output, local DB files to .gitignore.")
    add("Config", "Lockfile committed", 5, True, info["lockfile_present"], "Commit the package manager lockfile for reproducible builds.")
    add("Config", "Runtime version pinned", 2, False, any((root / f).exists() for f in (".nvmrc", ".node-version", ".python-version", ".tool-versions", "rust-toolchain.toml", "go.mod")) or '"engines"' in read(root / "package.json") or "requires-python" in read(root / "pyproject.toml"), "Pin the runtime (.nvmrc / engines / .python-version).")
    add("Config", "Config validated at startup", 3, False, re.search(r"(?i)(missing required (env|config)|invalid (env|config)|loadConfig|parseEnv|BaseSettings|envSchema|z\.object\(.*env|validateConfig|requireEnv)", code), "Parse and validate env vars at startup; fail fast with a clear message.")

    # Quality
    add("Quality", "Automated tests exist", 8, True, len(test_files) > 0, "Add tests covering acceptance criteria and authorization rules.")
    add("Quality", "Meaningful test volume (≥5 test files or ≥20 tests)", 3, False, len(test_files) >= 5 or len(re.findall(r"\b(it|test)\s*\(|def test_", corpus(test_files))) >= 20, "Cover each story: happy path, validation, authz, not-found, conflict.")
    add("Quality", "Test command defined", 4, True, "test" in info["commands"], "Define a test script (npm test / pytest).")
    add("Quality", "Lint command defined", 3, False, "lint" in info["commands"], "Add a lint script.")
    add("Quality", "Typecheck defined (typed languages)", 3, False, "typecheck" in info["commands"] or not ({"JavaScript/TypeScript", "Python"} & set(info["languages"])), "Add tsc --noEmit / mypy / pyright.")

    # CI
    add("CI", "CI workflow present", 5, False, bool(info["ci"]), "Add CI running lint, typecheck, tests, build, audit (see assets/ci/).")
    ci_text = "\n".join(read(root / c) for c in info["ci"])
    add("CI", "CI runs tests", 3, False, re.search(r"(?i)(test|pytest)", ci_text), "Make CI run the test command.")

    # Container
    add("Container", "Dockerfile present", 4, False, bool(dockerfile), "Add a multi-stage Dockerfile (see assets/docker/).")
    add("Container", "Container runs as non-root", 3, False, (not dockerfile) or re.search(r"(?m)^\s*USER\s+(?!root\b)\S+", dockerfile), "Add a non-root USER to the final stage.")
    add("Container", "Container healthcheck", 2, False, (not dockerfile) or "HEALTHCHECK" in dockerfile or "healthcheck" in read(root / "docker-compose.yml"), "Add HEALTHCHECK hitting the health endpoint.")
    add("Container", ".dockerignore present", 2, False, (not dockerfile) or (root / ".dockerignore").exists(), "Add .dockerignore excluding .env, .git, node_modules, tests output.")

    # Security
    add("Security", "No secrets committed (secret scan clean)", 10, True, not secrets, f"secret_scan found {len(secrets)} issue(s): run scripts/secret_scan.py for details.")
    add("Security", "Security headers configured", 4, False, re.search(r"(?i)(helmet|content-security-policy|x-content-type-options|SecurityMiddleware|secure_headers)", code), "Set CSP, nosniff, Referrer-Policy, frame protection.")
    add("Security", "Rate limiting present", 4, False, re.search(r"(?i)(rate.?limit|ratelimit|throttl|slowapi|429)", code), "Rate limit auth and expensive endpoints.")
    add("Security", "Password hashing uses a slow KDF (if passwords exist)", 4, True,
        (not re.search(r"(?i)password", code)) or re.search(r"(?i)(argon2|bcrypt|scrypt|pbkdf2|passlib|make_password|hashPassword|Auth\.js|next-auth|lucia|better-auth|clerk|supabase|firebase)", code),
        "Hash passwords with Argon2id/scrypt/bcrypt via a maintained library.")
    add("Security", "Input validation library or schema", 3, False, re.search(r"(?i)(zod|yup|joi|valibot|pydantic|marshmallow|class-validator|ajv|validate\w*\(|schema)", code), "Validate all external input with schemas at the boundary.")
    add("Security", "No wildcard CORS with credentials", 3, True, not re.search(r"(?is)(access-control-allow-origin['\"]?\s*[:,]\s*['\"]\*['\"]).{0,300}credentials['\"]?\s*[:,]\s*true", code), "Never combine Access-Control-Allow-Origin: * with credentials.")

    # Operations
    add("Ops", "Health endpoint", 4, False, re.search(r"(?i)['\"/](healthz?|readyz|livez|health-check|status)['\"]", code), "Expose /healthz (liveness) and /readyz (dependencies).")
    add("Ops", "Structured logging", 3, False, re.search(r"(?i)(pino|winston|structlog|loguru|bunyan|zap|slog|logging\.getLogger|JSON\.stringify\(\s*\{[^}]*level)", code), "Use structured JSON logs with request IDs and redaction.")
    add("Ops", "Request/correlation IDs", 2, False, re.search(r"(?i)(request.?id|correlation.?id|x-request-id|trace.?id)", code), "Attach a request ID to every log line and error response.")
    add("Ops", "Graceful shutdown", 2, False, re.search(r"SIGTERM|lifespan|on_shutdown|beforeExit", code) or "next" in json.dumps(info["frameworks"]).lower(), "Handle SIGTERM: stop accepting, drain, close pools.")
    add("Ops", "Central error handling", 3, False, re.search(r"(?i)(errorHandler|error_handler|exception_handler|setErrorHandler|app\.use\(\s*\(err|onError|AppError|HTTPException)", code), "Map errors to a stable, non-leaky error envelope in one place.")

    # Data
    has_db = re.search(r"(?i)(prisma|drizzle|sqlalchemy|typeorm|sequelize|knex|mongoose|django\.db|sqlite|postgres|pg\.Pool|DatabaseSync|gorm)", code)
    add("Data", "Versioned migrations (if a DB is used)", 4, False, (not has_db) or bool(info["migrations"]) or (root / "prisma" / "migrations").exists(), "Use versioned migrations committed to the repo.")
    add("Data", "Seed script for local/dev", 1, False, (not has_db) or re.search(r"(?i)seed", json.dumps(info["scripts"])) or any(root.rglob("seed*")), "Add a seed script so the app is demoable instantly.")

    total = sum(c[2] for c in checks)
    earned = sum(c[2] for c in checks if c[4])
    score = round(100 * earned / total) if total else 0
    critical_failed = [c for c in checks if c[3] and not c[4]]
    return {
        "root": str(root), "score": score, "critical_failed": [c[1] for c in critical_failed],
        "checks": [{"category": c[0], "check": c[1], "weight": c[2], "critical": c[3], "passed": c[4], "hint": c[5]} for c in checks],
        "secret_findings": len(secrets),
    }


def main(argv: list[str]) -> int:
    args, min_score = [], 90
    i = 0
    while i < len(argv):
        if argv[i] == "--min-score":
            min_score = int(argv[i + 1]); i += 2; continue
        if not argv[i].startswith("--"):
            args.append(argv[i])
        i += 1
    root = Path(args[0] if args else ".").resolve()
    result = audit(root)
    ok = result["score"] >= min_score and not result["critical_failed"]
    result["passed"] = ok
    result["min_score"] = min_score
    if "--json" in argv:
        print(json.dumps(result, indent=2))
        return 0 if ok else 1
    print(f"Production readiness: {result['score']}/100  (target ≥ {min_score}, critical failures: {len(result['critical_failed'])})\n")
    cat = None
    for c in result["checks"]:
        if c["category"] != cat:
            cat = c["category"]
            print(f"{cat}")
        mark = "PASS" if c["passed"] else ("FAIL*" if c["critical"] else "FAIL ")
        print(f"  [{mark}] {c['check']}")
    gaps = [c for c in result["checks"] if not c["passed"]]
    if gaps:
        print("\nGaps to close (critical first):")
        for c in sorted(gaps, key=lambda c: (not c["critical"], -c["weight"])):
            print(f"  - {'[CRITICAL] ' if c['critical'] else ''}{c['check']}: {c['hint']}")
    print(f"\nAUDIT {'PASSED' if ok else 'FAILED'}  (* = critical)")
    return 0 if ok else 1


if __name__ == "__main__":
    import signal
    if hasattr(signal, "SIGPIPE"):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # behave when piped into head/grep
    sys.exit(main(sys.argv[1:]))
