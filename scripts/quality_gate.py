#!/usr/bin/env python3
"""Run a project's real quality checks and record honest results.

Usage:
    python3 quality_gate.py PROJECT_DIR [--only lint,test] [--skip build] [--timeout 900] [--install]

Uses detect_stack.py to find the format/lint/typecheck/test/build commands the project
defines, runs each in PROJECT_DIR, and records the real exit code, duration and output
tail. Writes PROJECT_DIR/.autobuild/quality-gate.md and quality-gate.json.
Exit code 0 only if every executed check passed AND at least one check ran.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from detect_stack import detect  # noqa: E402

ORDER = ["format", "lint", "typecheck", "test", "build"]


def parse_list(argv: list[str], flag: str) -> list[str]:
    if flag in argv:
        i = argv.index(flag)
        if i + 1 < len(argv):
            return [x.strip() for x in argv[i + 1].split(",") if x.strip()]
    return []


def parse_int(argv: list[str], flag: str, default: int) -> int:
    if flag in argv:
        i = argv.index(flag)
        if i + 1 < len(argv):
            return int(argv[i + 1])
    return default


def run(cmd: str, cwd: Path, timeout: int) -> dict:
    start = time.monotonic()
    try:
        proc = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=timeout,
                              env={**__import__("os").environ, "CI": "true", "FORCE_COLOR": "0"})
        code, output = proc.returncode, (proc.stdout or "") + (proc.stderr or "")
    except subprocess.TimeoutExpired as exc:
        code = 124
        output = ((exc.stdout or b"").decode(errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or ""))
        output += f"\n[quality_gate] TIMEOUT after {timeout}s"
    duration = round(time.monotonic() - start, 1)
    lines = output.strip().splitlines()
    return {"command": cmd, "exit_code": code, "status": "PASS" if code == 0 else "FAIL",
            "duration_s": duration, "output_tail": "\n".join(lines[-40:])}


def main(argv: list[str]) -> int:
    positional = []
    skip_next = False
    for a in argv:
        if skip_next:
            skip_next = False
            continue
        if a in ("--only", "--skip", "--timeout"):
            skip_next = True
            continue
        if not a.startswith("--"):
            positional.append(a)
    root = Path(positional[0] if positional else ".").resolve()
    only, skip = parse_list(argv, "--only"), parse_list(argv, "--skip")
    timeout = parse_int(argv, "--timeout", 900)

    info = detect(root)
    commands = info["commands"]
    results: list[dict] = []

    if "--install" in argv and commands.get("install"):
        print(f"[install] {commands['install']}")
        r = run(commands["install"], root, timeout)
        r["check"] = "install"
        results.append(r)
        if r["exit_code"] != 0:
            print(r["output_tail"])

    for kind in ORDER:
        if only and kind not in only:
            continue
        if kind in skip:
            results.append({"check": kind, "status": "SKIP", "command": commands.get(kind, "-"), "reason": "skipped by --skip"})
            continue
        cmd = commands.get(kind)
        if not cmd:
            results.append({"check": kind, "status": "N/A", "command": "-", "reason": "no command defined in project"})
            continue
        print(f"[{kind}] {cmd}", flush=True)
        r = run(cmd, root, timeout)
        r["check"] = kind
        results.append(r)
        print(f"  -> {r['status']} (exit {r['exit_code']}, {r['duration_s']}s)", flush=True)
        if r["status"] == "FAIL":
            print("  ---- output tail ----")
            print("  " + r["output_tail"].replace("\n", "\n  "))

    executed = [r for r in results if r["status"] in ("PASS", "FAIL")]
    failed = [r for r in executed if r["status"] == "FAIL"]
    ok = bool(executed) and not failed

    state = root / ".autobuild"
    state.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    (state / "quality-gate.json").write_text(json.dumps({"time": stamp, "ok": ok, "results": results}, indent=2))
    md = [f"# Quality gate — {stamp}", "", f"**Result: {'PASS' if ok else 'FAIL'}**", "",
          "| Check | Status | Command | Time |", "|---|---|---|---|"]
    for r in results:
        md.append(f"| {r['check']} | {r['status']} | `{r['command']}` | {r.get('duration_s', '-')}s |")
    missing = [r["check"] for r in results if r["status"] == "N/A"]
    if missing:
        md += ["", f"Not defined in project: {', '.join(missing)} — add these scripts for a complete gate."]
    for r in failed:
        md += ["", f"## {r['check']} failure", "```", r["output_tail"], "```"]
    (state / "quality-gate.md").write_text("\n".join(md) + "\n")

    print()
    print("\n".join(md[:6 + len(results)]))
    if not executed:
        print("\nNo checks were executed — the gate cannot pass without evidence.")
    print(f"\nReport written to {state / 'quality-gate.md'}")
    return 0 if ok else 1


if __name__ == "__main__":
    import signal
    if hasattr(signal, "SIGPIPE"):
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # behave when piped into head/grep
    sys.exit(main(sys.argv[1:]))
