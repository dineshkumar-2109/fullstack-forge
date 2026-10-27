#!/usr/bin/env python3
"""Create the .autobuild/ state directory for an autonomous build.

Usage:
    python3 init_state.py PROJECT_DIR [--goal "one-line product goal"]

Creates PROGRESS, DECISIONS, ASSUMPTIONS, BLOCKERS and BACKLOG files plus a screenshots
folder. Existing files are never overwritten, so it is safe to run again after a context
reset. Standard library only.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

PHASES = [
    "P0 Intake and orientation", "P1 Product spec (PRD.md)", "P2 Architecture and contracts (ARCHITECTURE.md)",
    "P3 Scaffold and walking skeleton (quality gate green)", "P4 Vertical slices (all must-have stories)",
    "P5 Self-verification (smoke + e2e + screenshots)", "P6 Hardening (red team, secrets, deps, reliability)",
    "P7 Ship-ready packaging (readiness audit ≥ 90)", "P8 Delivery report (DELIVERY.md)",
]


def files(goal: str, today: str) -> dict[str, str]:
    phases = "\n".join(f"- [ ] {p}" for p in PHASES)
    return {
        "PROGRESS.md": f"""# Progress

Goal: {goal or '(fill in from the request)'}
Started: {today}
Mode: (autonomous build | repository work)

## Current focus
- (what you are doing right now, one line)

## Phases
{phases}

## Stories
- [ ] S-01 ...

## Last known-good state
- Command: (e.g. `npm test` — 42 passed) at (time)

## Environment constraints
- (e.g. no Docker daemon; no outbound network except npm registry)

## Notes / hypotheses
""",
        "DECISIONS.md": """# Decisions

Format: ID — title / Context / Options / Decision / Reversibility / Source (user | repo | default | judgement)

""",
        "ASSUMPTIONS.md": """# Assumptions

Unverified facts the build relies on. Confidence: high | medium | low. Say how to correct each.

""",
        "BLOCKERS.md": """# Blockers and hard stops

Each entry: what is blocked, why it is a hard stop or unresolved failure, what the human must do
(exact env vars / accounts / decisions), and what fallback is in place meanwhile.

(none yet)
""",
        "BACKLOG.md": """# Backlog

Deferred scope and follow-ups. Format: B-### (priority) title — reason deferred.

""",
    }


def main(argv: list[str]) -> int:
    goal = ""
    args = []
    i = 0
    while i < len(argv):
        if argv[i] == "--goal" and i + 1 < len(argv):
            goal = argv[i + 1]; i += 2; continue
        args.append(argv[i]); i += 1
    root = Path(args[0] if args else ".").resolve()
    root.mkdir(parents=True, exist_ok=True)
    state = root / ".autobuild"
    (state / "screenshots").mkdir(parents=True, exist_ok=True)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for name, content in files(goal, today).items():
        path = state / name
        if path.exists():
            print(f"kept     {path}")
        else:
            path.write_text(content, encoding="utf-8")
            print(f"created  {path}")
    print("\nNext: write PRD.md (templates/prd.md) and ARCHITECTURE.md (templates/architecture.md) into .autobuild/.")
    return 0


if __name__ == "__main__":
    import signal
    if hasattr(signal, "SIGPIPE"):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # behave when piped into head/grep
    sys.exit(main(sys.argv[1:]))
