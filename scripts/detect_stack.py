#!/usr/bin/env python3
"""Detect a project's stack and the commands to validate it.

Usage:
    python3 detect_stack.py PROJECT_DIR [--json]

Looks at manifests, lockfiles, config files, CI and containers and reports:
languages, package manager, frameworks, and the format/lint/typecheck/test/build
commands that the quality gate should run. Only commands that the project actually
defines (or tools whose config is present) are reported -- nothing is invented.
Standard library only.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "dist", "build", ".next", "__pycache__", ".autobuild", "target", "coverage"}

JS_FRAMEWORKS = {
    "next": "Next.js", "react": "React", "vue": "Vue", "nuxt": "Nuxt", "@angular/core": "Angular",
    "svelte": "Svelte", "@sveltejs/kit": "SvelteKit", "astro": "Astro", "express": "Express",
    "fastify": "Fastify", "hono": "Hono", "@nestjs/core": "NestJS", "prisma": "Prisma",
    "@prisma/client": "Prisma", "drizzle-orm": "Drizzle", "vite": "Vite", "tailwindcss": "Tailwind CSS",
    "vitest": "Vitest", "jest": "Jest", "@playwright/test": "Playwright", "zod": "Zod",
}
PY_FRAMEWORKS = {
    "fastapi": "FastAPI", "django": "Django", "flask": "Flask", "sqlalchemy": "SQLAlchemy",
    "alembic": "Alembic", "pydantic": "Pydantic", "pytest": "pytest", "celery": "Celery",
    "ruff": "Ruff", "mypy": "mypy", "langchain": "LangChain", "openai": "OpenAI SDK", "anthropic": "Anthropic SDK",
}


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def js_package_manager(root: Path, pkg: dict) -> str:
    declared = str(pkg.get("packageManager", ""))
    for name in ("pnpm", "yarn", "bun", "npm"):
        if declared.startswith(name):
            return name
    if (root / "pnpm-lock.yaml").exists():
        return "pnpm"
    if (root / "yarn.lock").exists():
        return "yarn"
    if (root / "bun.lockb").exists() or (root / "bun.lock").exists():
        return "bun"
    return "npm"


def run_script_cmd(pm: str, script: str) -> str:
    if pm == "npm":
        return "npm test" if script == "test" else f"npm run {script}"
    return f"{pm} {script}" if pm != "yarn" else f"yarn {script}"


def first_script(scripts: dict, names: list[str]) -> str | None:
    for name in names:
        if name in scripts:
            return name
    return None


def detect_node(root: Path, out: dict) -> None:
    pkg_path = root / "package.json"
    if not pkg_path.exists():
        return
    try:
        pkg = json.loads(read(pkg_path) or "{}")
    except json.JSONDecodeError as exc:
        out["warnings"].append(f"package.json is not valid JSON: {exc}")
        return
    pm = js_package_manager(root, pkg)
    out["languages"].append("JavaScript/TypeScript")
    out["package_managers"].append(pm)
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    out["frameworks"] += sorted({label for key, label in JS_FRAMEWORKS.items() if key in deps})
    if (root / "tsconfig.json").exists():
        out["frameworks"].append("TypeScript")
    lock = {"npm": "package-lock.json", "pnpm": "pnpm-lock.yaml", "yarn": "yarn.lock", "bun": "bun.lockb"}[pm]
    out["lockfile_present"] = out["lockfile_present"] or (root / lock).exists() or (root / "bun.lock").exists()
    scripts = pkg.get("scripts", {}) or {}
    out["scripts"].update({k: v for k, v in scripts.items()})
    install = {"npm": "npm ci" if (root / "package-lock.json").exists() else "npm install",
               "pnpm": "pnpm install --frozen-lockfile", "yarn": "yarn install --frozen-lockfile", "bun": "bun install"}[pm]
    out["commands"].setdefault("install", install)
    mapping = {
        "format": ["format:check", "fmt:check", "prettier:check"],
        "lint": ["lint"],
        "typecheck": ["typecheck", "type-check", "tsc", "check-types", "types"],
        "test": ["test", "test:unit", "test:ci"],
        "build": ["build"],
        "e2e": ["test:e2e", "e2e"],
    }
    for kind, names in mapping.items():
        name = first_script(scripts, names)
        if name and not (kind == "test" and "no test specified" in scripts.get(name, "")):
            out["commands"].setdefault(kind, run_script_cmd(pm, name))
    if "typecheck" not in out["commands"] and (root / "tsconfig.json").exists() and "typescript" in deps:
        out["commands"]["typecheck"] = "npx tsc --noEmit"
    if "start" in scripts:
        out["run"] = run_script_cmd(pm, "start")
    elif "dev" in scripts:
        out["run"] = run_script_cmd(pm, "dev")


def detect_python(root: Path, out: dict) -> None:
    pyproject = read(root / "pyproject.toml")
    reqs = "".join(read(p) for p in root.glob("requirements*.txt"))
    if not (pyproject or reqs or (root / "setup.py").exists()):
        return
    out["languages"].append("Python")
    text = (pyproject + "\n" + reqs).lower()
    if (root / "uv.lock").exists():
        pm, prefix = "uv", "uv run "
    elif (root / "poetry.lock").exists():
        pm, prefix = "poetry", "poetry run "
    else:
        pm, prefix = "pip", ""
    out["package_managers"].append(pm)
    out["lockfile_present"] = out["lockfile_present"] or any((root / f).exists() for f in ("uv.lock", "poetry.lock", "requirements.lock")) or bool(reqs and "==" in reqs)
    out["frameworks"] += sorted({label for key, label in PY_FRAMEWORKS.items() if re.search(rf"\b{re.escape(key)}\b", text)})
    out["commands"].setdefault("install", {"uv": "uv sync", "poetry": "poetry install", "pip": "pip install -r requirements.txt" if reqs else "pip install -e ."}[pm])
    if "ruff" in text or (root / "ruff.toml").exists() or "[tool.ruff" in pyproject:
        out["commands"].setdefault("format", f"{prefix}ruff format --check .")
        out["commands"].setdefault("lint", f"{prefix}ruff check .")
    elif "flake8" in text:
        out["commands"].setdefault("lint", f"{prefix}flake8")
    if "mypy" in text or "[tool.mypy" in pyproject:
        out["commands"].setdefault("typecheck", f"{prefix}mypy .")
    elif "pyright" in text:
        out["commands"].setdefault("typecheck", f"{prefix}pyright")
    if "pytest" in text or (root / "pytest.ini").exists() or (root / "tests").is_dir():
        out["commands"].setdefault("test", f"{prefix}pytest -q")


def detect_other(root: Path, out: dict) -> None:
    if (root / "go.mod").exists():
        out["languages"].append("Go")
        out["commands"].setdefault("format", "test -z \"$(gofmt -l .)\"")
        out["commands"].setdefault("lint", "go vet ./...")
        out["commands"].setdefault("test", "go test ./...")
        out["commands"].setdefault("build", "go build ./...")
        out["lockfile_present"] = out["lockfile_present"] or (root / "go.sum").exists()
    if (root / "Cargo.toml").exists():
        out["languages"].append("Rust")
        out["commands"].setdefault("format", "cargo fmt --check")
        out["commands"].setdefault("lint", "cargo clippy -- -D warnings")
        out["commands"].setdefault("test", "cargo test")
        out["commands"].setdefault("build", "cargo build --release")
        out["lockfile_present"] = out["lockfile_present"] or (root / "Cargo.lock").exists()
    if (root / "pom.xml").exists():
        out["languages"].append("Java (Maven)")
        out["commands"].setdefault("test", "mvn -B test")
        out["commands"].setdefault("build", "mvn -B package -DskipTests")
    if (root / "build.gradle").exists() or (root / "build.gradle.kts").exists():
        out["languages"].append("JVM (Gradle)")
        wrapper = "./gradlew" if (root / "gradlew").exists() else "gradle"
        out["commands"].setdefault("test", f"{wrapper} test")
        out["commands"].setdefault("build", f"{wrapper} build -x test")
    if any(root.glob("*.csproj")) or any(root.glob("*.sln")):
        out["languages"].append(".NET")
        out["commands"].setdefault("build", "dotnet build")
        out["commands"].setdefault("test", "dotnet test")
    makefile = read(root / "Makefile")
    if makefile:
        targets = set(re.findall(r"^([A-Za-z0-9_-]+):", makefile, re.M))
        out["make_targets"] = sorted(targets)
        for kind in ("lint", "test", "build", "typecheck", "format"):
            if kind in targets:
                out["commands"].setdefault(kind, f"make {kind}")


def detect_infra(root: Path, out: dict) -> None:
    out["docker"] = {
        "dockerfile": (root / "Dockerfile").exists() or any(root.glob("Dockerfile.*")),
        "compose": any((root / n).exists() for n in ("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml")),
        "dockerignore": (root / ".dockerignore").exists(),
    }
    ci = []
    if (root / ".github" / "workflows").is_dir():
        ci += [f".github/workflows/{p.name}" for p in (root / ".github" / "workflows").glob("*.y*ml")]
    for name in (".gitlab-ci.yml", ".circleci/config.yml", "azure-pipelines.yml", "Jenkinsfile", "bitbucket-pipelines.yml"):
        if (root / name).exists():
            ci.append(name)
    out["ci"] = ci
    out["instructions"] = [n for n in ("AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md", "README.md", ".cursorrules") if (root / n).exists()]
    out["env_example"] = any((root / n).exists() for n in (".env.example", ".env.sample", ".env.template"))
    out["migrations"] = [str(p.relative_to(root)) for p in root.rglob("*") if p.is_dir() and p.name in {"migrations", "alembic", "drizzle"} and not (set(p.relative_to(root).parts) & SKIP_DIRS)][:5]
    out["git"] = (root / ".git").exists()


def count_files(root: Path) -> int:
    n = 0
    for p in root.rglob("*"):
        if p.is_file() and not (set(p.relative_to(root).parts) & SKIP_DIRS):
            n += 1
            if n > 5000:
                break
    return n


def detect(root: Path) -> dict:
    out: dict = {"root": str(root), "languages": [], "package_managers": [], "frameworks": [], "scripts": {},
                 "commands": {}, "lockfile_present": False, "warnings": [], "run": None}
    detect_node(root, out)
    detect_python(root, out)
    detect_other(root, out)
    detect_infra(root, out)
    out["frameworks"] = sorted(set(out["frameworks"]))
    out["file_count"] = count_files(root)
    out["mode_hint"] = "greenfield" if out["file_count"] < 5 and not out["languages"] else "repository"
    if not out["commands"].get("test") and out["languages"]:
        out["warnings"].append("No test command detected -- add one (the quality gate needs it).")
    return out


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    root = Path(args[0] if args else ".").resolve()
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 2
    info = detect(root)
    if "--json" in argv:
        print(json.dumps(info, indent=2))
        return 0
    print(f"Project: {info['root']}  ({info['file_count']} files, mode hint: {info['mode_hint']})")
    print(f"Languages:        {', '.join(info['languages']) or '-'}")
    print(f"Package managers: {', '.join(info['package_managers']) or '-'}  lockfile: {'yes' if info['lockfile_present'] else 'NO'}")
    print(f"Frameworks/tools: {', '.join(info['frameworks']) or '-'}")
    print(f"Instructions:     {', '.join(info['instructions']) or '-'}")
    print(f"CI:               {', '.join(info['ci']) or '-'}")
    print(f"Docker:           {info['docker']}")
    print(f"Migrations:       {', '.join(info['migrations']) or '-'}")
    print(f"Run command:      {info['run'] or '-'}")
    print("Validation commands:")
    for kind in ("install", "format", "lint", "typecheck", "test", "build", "e2e"):
        print(f"  {kind:<10} {info['commands'].get(kind, '- (not detected)')}")
    for w in info["warnings"]:
        print(f"WARNING: {w}")
    return 0


if __name__ == "__main__":
    import signal
    if hasattr(signal, "SIGPIPE"):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # behave when piped into head/grep
    sys.exit(main(sys.argv[1:]))
