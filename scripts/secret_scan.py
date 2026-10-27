#!/usr/bin/env python3
"""Scan a project for committed secrets.

Usage:
    python3 secret_scan.py PROJECT_DIR [--json]

Flags high-confidence credential patterns, private keys, real .env files, and suspicious
hard-coded secret assignments. Placeholders such as "replace-me", "changeme", "example",
"xxx", "<...>", "${VAR}" are ignored, as is any line containing `secret-scan:allow`.
Exit code 1 if anything is found. Standard library only. This is a safety net, not a
replacement for a dedicated scanner (gitleaks, trufflehog) in CI.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "dist", "build", ".next", "__pycache__", "coverage", ".autobuild", "target", ".turbo", ".cache"}
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".woff", ".woff2", ".ttf", ".mp4", ".lock", ".sqlite", ".db", ".pyc"}
MAX_BYTES = 1_000_000

PATTERNS = [
    ("Private key", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----")),
    ("AWS access key ID", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("GitHub token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b")),
    ("Stripe live key", re.compile(r"\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("OpenAI-style key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_\-]{32,}\b")),
    ("Anthropic key", re.compile(r"\bsk-ant-[A-Za-z0-9_\-]{20,}\b")),
    ("JWT", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")),
    ("Connection string with password", re.compile(r"\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)://[^\s:/@]+:([^\s@/]{6,})@")),
]
KEY = r"[A-Za-z0-9_]*(?:SECRET|PASSWORD|PASSWD|TOKEN|API_?KEY|PRIVATE_?KEY|ACCESS_?KEY)[A-Za-z0-9_]*"
# In code: a secret-named key assigned a quoted literal with no spaces, e.g. apiKey = "<16 random chars>".
QUOTED_ASSIGNMENT = re.compile(rf"""(?i)\b({KEY})["']?\s*[:=]\s*["']([^\s"']{{8,}})["']""")
# In config files (.env, .ini, .yml, .toml, .properties): KEY=value without quotes.
CONFIG_ASSIGNMENT = re.compile(rf"""(?i)^\s*(?:export\s+)?({KEY})\s*[:=]\s*["']?([^\s"'#]{{8,}})["']?\s*$""")
CONFIG_SUFFIXES = {".env", ".ini", ".yml", ".yaml", ".toml", ".properties", ".cfg", ".conf"}
PLACEHOLDER = re.compile(r"(?i)(replace|change.?me|example|placeholder|dummy|your[_-]|xxx+|\*\*\*|<[^>]+>|\$\{|\{\{|process\.env|os\.environ|getenv|env\(|test|fake|sample|local|dev|password$|secret$|redacted|none|null|undefined|todo)")


def is_placeholder(value: str) -> bool:
    return bool(PLACEHOLDER.search(value)) or len(set(value)) <= 3


def scan(root: Path) -> list[dict]:
    findings: list[dict] = []
    for path in root.rglob("*"):
        rel = path.relative_to(root)
        if set(rel.parts) & SKIP_DIRS or not path.is_file():
            continue
        name = path.name
        if name == ".env" or (name.startswith(".env.") and not any(s in name for s in ("example", "sample", "template", "test"))):
            findings.append({"file": str(rel), "line": 0, "type": "Real .env file present", "excerpt": "must not be committed — add to .gitignore"})
        if path.suffix.lower() in SKIP_SUFFIXES or path.stat().st_size > MAX_BYTES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            if "secret-scan:allow" in line:
                continue
            for label, pattern in PATTERNS:
                m = pattern.search(line)
                if m:
                    if label == "Connection string with password" and is_placeholder(m.group(1)):
                        continue
                    if label not in ("Private key", "Connection string with password") and is_placeholder(m.group(0)):
                        continue
                    findings.append({"file": str(rel), "line": lineno, "type": label, "excerpt": redact(line.strip())})
            is_config = path.suffix.lower() in CONFIG_SUFFIXES or name.startswith(".env")
            m = (CONFIG_ASSIGNMENT if is_config else QUOTED_ASSIGNMENT).search(line)
            if m and not is_placeholder(m.group(2)):
                findings.append({"file": str(rel), "line": lineno, "type": f"Hard-coded {m.group(1)}", "excerpt": redact(line.strip())})
    return findings


def redact(line: str) -> str:
    line = line[:160]
    return re.sub(r"([A-Za-z0-9_\-+/=]{6})[A-Za-z0-9_\-+/=]{6,}", r"\1…", line)


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    root = Path(args[0] if args else ".").resolve()
    findings = scan(root)
    if "--json" in argv:
        print(json.dumps({"root": str(root), "findings": findings}, indent=2))
    else:
        if not findings:
            print(f"secret_scan: no secrets found in {root}")
        for f in findings:
            print(f"{f['file']}:{f['line']}: {f['type']}: {f['excerpt']}")
        if findings:
            print(f"\nsecret_scan: {len(findings)} finding(s). Remove the secret, rotate it if it was ever real, and load it from the environment.")
    return 1 if findings else 0


if __name__ == "__main__":
    import signal
    if hasattr(signal, "SIGPIPE"):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # behave when piped into head/grep
    sys.exit(main(sys.argv[1:]))
