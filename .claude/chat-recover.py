#!/usr/bin/env python3
"""Recover and assemble Claude Code conversation transcripts from session JSONL files.

Usage:
    # List recent sessions for this project
    python scripts/chat-recover.py --list

    # Recover messages from the last 2 hours of a session
    python scripts/chat-recover.py --last 2h

    # Recover messages after a specific time
    python scripts/chat-recover.py --after "2026-03-05 14:00"

    # Search across sessions for a keyword
    python scripts/chat-recover.py --search "inventory decrement"

    # Recover a specific session by ID
    python scripts/chat-recover.py --session <uuid>

    # Show only messages before a compaction boundary
    python scripts/chat-recover.py --before-compaction

    # Show only resources accessed (files, URLs)
    python scripts/chat-recover.py --resources-only
"""

import argparse
import glob
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


# Where Claude Code stores session files for the current project
def find_project_dir():
    """Find the Claude Code project directory for the current working directory."""
    cwd = os.getcwd()
    slug = "-" + cwd.replace("/", "-")
    claude_dir = Path.home() / ".claude" / "projects" / slug
    if claude_dir.exists():
        return claude_dir
    # Try without leading dash
    slug_alt = cwd.replace("/", "-")
    claude_dir_alt = Path.home() / ".claude" / "projects" / slug_alt
    if claude_dir_alt.exists():
        return claude_dir_alt
    return None


def parse_duration(s):
    """Parse a duration like '2h', '30m', '1d' into a timedelta."""
    match = re.match(r"^(\d+)\s*([hmdHMD])$", s.strip())
    if not match:
        raise ValueError(f"Cannot parse duration: {s!r}. Use format like 2h, 30m, 1d")
    val, unit = int(match.group(1)), match.group(2).lower()
    if unit == "h":
        return timedelta(hours=val)
    elif unit == "m":
        return timedelta(minutes=val)
    elif unit == "d":
        return timedelta(days=val)
    raise ValueError(f"Unknown unit: {unit}")


def parse_search_terms(search):
    """Parse a search string into a list of lowercase terms.

    Supports comma-separated terms: "raspberry pi, print agent"
    Each term is stripped and lowercased. Any term matching counts as a hit.
    """
    return [t.strip().lower() for t in search.split(",") if t.strip()]


def any_term_matches(text, terms):
    """Return True if any search term appears in the text."""
    text_lower = text.lower()
    return any(term in text_lower for term in terms)


def first_term_match(text, terms):
    """Return (index, term) for the first matching term in text, or None."""
    text_lower = text.lower()
    for term in terms:
        idx = text_lower.find(term)
        if idx >= 0:
            return idx, term
    return None


def parse_timestamp(ts_str):
    """Parse an ISO 8601 timestamp from JSONL records."""
    if not ts_str:
        return None
    # Handle both 'Z' suffix and +00:00
    ts_str = ts_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(ts_str)
    except ValueError:
        return None


def parse_user_datetime(s):
    """Parse a user-provided datetime string, assuming local timezone."""
    for fmt in ["%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.replace(tzinfo=timezone.utc)  # Treat as UTC for simplicity
        except ValueError:
            continue
    raise ValueError(f"Cannot parse datetime: {s!r}. Use format like '2026-03-05 14:00'")


def list_sessions(project_dir, limit=20):
    """List recent sessions with metadata."""
    jsonl_files = sorted(
        glob.glob(str(project_dir / "*.jsonl")),
        key=os.path.getmtime,
        reverse=True,
    )

    sessions = []
    for fpath in jsonl_files[:limit]:
        session_id = Path(fpath).stem
        mtime = datetime.fromtimestamp(os.path.getmtime(fpath), tz=timezone.utc)
        size_kb = os.path.getsize(fpath) / 1024

        # Read first user message for context
        first_prompt = ""
        msg_count = 0
        compaction_count = 0
        first_ts = None
        last_ts = None

        with open(fpath, "r") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                ts = parse_timestamp(obj.get("timestamp"))
                if ts:
                    if first_ts is None:
                        first_ts = ts
                    last_ts = ts

                msg_type = obj.get("type", "")
                if msg_type in ("user", "assistant"):
                    msg_count += 1
                if msg_type == "system" and obj.get("subtype") == "compact_boundary":
                    compaction_count += 1
                if msg_type == "user" and not first_prompt:
                    content = obj.get("message", {}).get("content", "")
                    if isinstance(content, str) and content.strip():
                        first_prompt = content.strip()[:120]
                    elif isinstance(content, list):
                        for c in content:
                            if isinstance(c, dict) and c.get("type") == "text" and c.get("text", "").strip():
                                first_prompt = c["text"].strip()[:120]
                                break

        sessions.append(
            {
                "id": session_id,
                "mtime": mtime,
                "size_kb": size_kb,
                "first_prompt": first_prompt,
                "msg_count": msg_count,
                "compaction_count": compaction_count,
                "first_ts": first_ts,
                "last_ts": last_ts,
            }
        )

    return sessions


def extract_text_from_content(content):
    """Extract plain text from a message content field (string or content blocks)."""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        texts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    texts.append(block.get("text", ""))
        return "\n".join(texts).strip()
    return ""


def extract_tool_calls(content):
    """Extract tool call info from assistant content blocks."""
    calls = []
    if not isinstance(content, list):
        return calls
    for block in content:
        if isinstance(block, dict) and block.get("type") == "tool_use":
            name = block.get("name", "")
            inp = block.get("input", {})
            calls.append({"tool": name, "input": inp})
    return calls


def extract_resources(tool_calls):
    """Extract resource references (files, URLs) from tool calls."""
    resources = []
    for call in tool_calls:
        tool = call["tool"]
        inp = call["input"]
        if tool == "Read":
            resources.append(("file", inp.get("file_path", "")))
        elif tool == "Glob":
            resources.append(("glob", inp.get("pattern", "")))
        elif tool == "Grep":
            resources.append(("grep", f'{inp.get("pattern", "")} in {inp.get("path", ".")}'))
        elif tool == "WebFetch":
            resources.append(("url", inp.get("url", "")))
        elif tool == "WebSearch":
            resources.append(("search", inp.get("query", "")))
        elif tool == "Bash":
            cmd = inp.get("command", "")
            if cmd:
                resources.append(("bash", cmd[:200]))
    return resources


def parse_session(fpath, after=None, before=None, search=None, before_compaction=False):
    """Parse a session JSONL file and extract structured messages."""
    messages = []
    resources = []
    compaction_points = []

    with open(fpath, "r") as f:
        for line in f:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            msg_type = obj.get("type", "")
            ts = parse_timestamp(obj.get("timestamp"))

            # Track compaction boundaries
            if msg_type == "system" and obj.get("subtype") == "compact_boundary":
                meta = obj.get("compactMetadata", {})
                compaction_points.append(
                    {
                        "timestamp": ts,
                        "trigger": meta.get("trigger", "unknown"),
                        "pre_tokens": meta.get("preTokens", 0),
                    }
                )
                messages.append(
                    {
                        "type": "compaction",
                        "timestamp": ts,
                        "trigger": meta.get("trigger", "unknown"),
                        "pre_tokens": meta.get("preTokens", 0),
                    }
                )
                continue

            # Skip non-conversation types
            if msg_type not in ("user", "assistant"):
                continue

            msg = obj.get("message", {})
            content = msg.get("content", "")
            text = extract_text_from_content(content)
            tool_calls = extract_tool_calls(content)
            msg_resources = extract_resources(tool_calls)
            resources.extend(msg_resources)

            # Build message record
            record = {
                "type": msg_type,
                "timestamp": ts,
                "text": text,
                "tool_calls": [{"tool": tc["tool"], "input_summary": _summarize_input(tc)} for tc in tool_calls],
                "resources": msg_resources,
            }
            messages.append(record)

    # Apply filters
    if before_compaction and compaction_points:
        # Find the last compaction and return everything before it
        last_compact_ts = compaction_points[-1]["timestamp"]
        messages = [m for m in messages if m["timestamp"] and m["timestamp"] < last_compact_ts]
        resources = [r for m in messages for r in m.get("resources", [])]

    if after:
        messages = [m for m in messages if m.get("timestamp") and m["timestamp"] >= after]
    if before:
        messages = [m for m in messages if m.get("timestamp") and m["timestamp"] <= before]

    if search:
        terms = parse_search_terms(search)
        filtered = []
        for m in messages:
            if m["type"] == "compaction":
                filtered.append(m)
                continue
            text = m.get("text", "")
            tool_text = " ".join(tc.get("input_summary", "") for tc in m.get("tool_calls", []))
            if any_term_matches(text, terms) or any_term_matches(tool_text, terms):
                filtered.append(m)
        messages = filtered

    return messages, resources, compaction_points


def _summarize_input(tc):
    """Create a short summary of a tool call's input."""
    tool = tc["tool"]
    inp = tc["input"]
    if tool == "Read":
        return inp.get("file_path", "")
    elif tool == "Write":
        return inp.get("file_path", "")
    elif tool == "Edit":
        return inp.get("file_path", "")
    elif tool == "Glob":
        return inp.get("pattern", "")
    elif tool == "Grep":
        return f'{inp.get("pattern", "")} in {inp.get("path", ".")}'
    elif tool == "WebFetch":
        return inp.get("url", "")
    elif tool == "WebSearch":
        return inp.get("query", "")
    elif tool == "Bash":
        return inp.get("command", "")[:120]
    elif tool == "Agent":
        return inp.get("description", "") or inp.get("prompt", "")[:80]
    else:
        return json.dumps(inp)[:100]


def format_timestamp(ts):
    """Format a timestamp for display."""
    if ts is None:
        return "??:??"
    return ts.strftime("%H:%M:%S")


def format_transcript(messages, resources_only=False, compact=False):
    """Format messages as a readable transcript."""
    lines = []

    if resources_only:
        seen = set()
        for m in messages:
            for rtype, rval in m.get("resources", []):
                key = (rtype, rval)
                if key not in seen:
                    seen.add(key)
                    lines.append(f"[{rtype}] {rval}")
        return "\n".join(lines)

    for m in messages:
        ts = format_timestamp(m.get("timestamp"))

        if m["type"] == "compaction":
            lines.append(f"\n{'=' * 60}")
            lines.append(
                f"  AUTO-COMPACTION at {ts} (trigger: {m.get('trigger', '?')}, pre-tokens: {m.get('pre_tokens', '?')})"
            )
            lines.append(f"  Messages above this line were compacted out of context.")
            lines.append(f"{'=' * 60}\n")
            continue

        role = "USER" if m["type"] == "user" else "CLAUDE"
        text = m.get("text", "")
        tool_calls = m.get("tool_calls", [])

        if not text and not tool_calls:
            continue

        lines.append(f"[{ts}] {role}:")
        if text:
            if compact and len(text) > 500:
                lines.append(f"  {text[:500]}...")
            else:
                # Indent each line of multi-line text
                for tline in text.split("\n"):
                    lines.append(f"  {tline}")

        if tool_calls:
            for tc in tool_calls:
                summary = tc.get("input_summary", "")
                if compact and len(summary) > 150:
                    summary = summary[:150] + "..."
                lines.append(f"  -> {tc['tool']}: {summary}")

        lines.append("")

    return "\n".join(lines)


def search_across_sessions(project_dir, search_term, limit=5):
    """Search for a term across all sessions, return matching session IDs with context."""
    jsonl_files = sorted(
        glob.glob(str(project_dir / "*.jsonl")),
        key=os.path.getmtime,
        reverse=True,
    )

    results = []
    terms = parse_search_terms(search_term)

    for fpath in jsonl_files:
        session_id = Path(fpath).stem
        matches = 0
        first_match_text = ""
        session_ts = None

        with open(fpath, "r") as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                if obj.get("type") not in ("user", "assistant"):
                    continue

                ts = parse_timestamp(obj.get("timestamp"))
                if session_ts is None and ts:
                    session_ts = ts

                content = obj.get("message", {}).get("content", "")
                text = extract_text_from_content(content)
                if any_term_matches(text, terms):
                    matches += 1
                    if not first_match_text:
                        match = first_term_match(text, terms)
                        if match:
                            idx, term = match
                            start = max(0, idx - 40)
                            end = min(len(text), idx + len(term) + 40)
                            first_match_text = text[start:end].replace("\n", " ")

        if matches > 0:
            results.append(
                {
                    "session_id": session_id,
                    "matches": matches,
                    "context": first_match_text,
                    "timestamp": session_ts,
                    "mtime": datetime.fromtimestamp(os.path.getmtime(fpath), tz=timezone.utc),
                }
            )

        if len(results) >= limit:
            break

    return results


def find_most_recent_session(project_dir):
    """Find the most recently modified session JSONL file."""
    jsonl_files = sorted(
        glob.glob(str(project_dir / "*.jsonl")),
        key=os.path.getmtime,
        reverse=True,
    )
    # Skip the current session (it will be the most recent, but it's the recovery session)
    # The current session is identifiable because it's still being written to
    # Heuristic: if the most recent file was modified in the last 60 seconds, it's probably
    # the current session. Return the second most recent instead.
    now = datetime.now(tz=timezone.utc)
    for fpath in jsonl_files:
        mtime = datetime.fromtimestamp(os.path.getmtime(fpath), tz=timezone.utc)
        # If modified less than 2 minutes ago, it might be the current session
        # Skip it and try the next one
        if (now - mtime).total_seconds() < 120:
            continue
        return fpath
    # If all are recent (unlikely), just return the second one
    if len(jsonl_files) >= 2:
        return jsonl_files[1]
    return jsonl_files[0] if jsonl_files else None


def main():
    parser = argparse.ArgumentParser(
        description="Recover Claude Code conversation transcripts from session JSONL files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument("--list", action="store_true", help="List recent sessions")
    parser.add_argument("--session", type=str, help="Session UUID to recover")
    parser.add_argument("--last", type=str, help="Recover messages from the last N hours/minutes (e.g., 2h, 30m)")
    parser.add_argument("--after", type=str, help="Recover messages after this datetime (e.g., '2026-03-05 14:00')")
    parser.add_argument("--before", type=str, help="Recover messages before this datetime")
    parser.add_argument("--search", type=str, help="Search for keyword across sessions or within a session")
    parser.add_argument(
        "--before-compaction", action="store_true", help="Show only messages before the last auto-compaction"
    )
    parser.add_argument("--resources-only", action="store_true", help="Show only resource references (files, URLs)")
    parser.add_argument("--compact", action="store_true", help="Truncate long messages for overview")
    parser.add_argument("--project-dir", type=str, help="Override project directory path")
    parser.add_argument("--limit", type=int, default=20, help="Limit number of sessions to list")

    args = parser.parse_args()

    # Find project directory
    if args.project_dir:
        project_dir = Path(args.project_dir)
    else:
        project_dir = find_project_dir()

    if not project_dir or not project_dir.exists():
        print("ERROR: Could not find Claude Code project directory.", file=sys.stderr)
        print("Make sure you're running from within a project that has Claude Code sessions.", file=sys.stderr)
        sys.exit(1)

    # List mode
    if args.list:
        sessions = list_sessions(project_dir, limit=args.limit)
        if not sessions:
            print("No sessions found.")
            return

        print(f"Recent sessions in {project_dir}:\n")
        for s in sessions:
            compact_str = f" [{s['compaction_count']} compactions]" if s["compaction_count"] else ""
            ts_range = ""
            if s["first_ts"] and s["last_ts"]:
                ts_range = f" ({s['first_ts'].strftime('%m/%d %H:%M')} - {s['last_ts'].strftime('%H:%M')})"
            print(f"  {s['id']}")
            print(f"    {s['size_kb']:.0f}KB, {s['msg_count']} msgs{compact_str}{ts_range}")
            if s["first_prompt"]:
                print(f"    \"{s['first_prompt']}\"")
            print()
        return

    # Search across sessions mode (no --session specified)
    if args.search and not args.session and not args.last and not args.after:
        results = search_across_sessions(project_dir, args.search, limit=10)
        if not results:
            print(f"No sessions found matching '{args.search}'.")
            return

        print(f"Sessions matching '{args.search}':\n")
        for r in results:
            ts = r["mtime"].strftime("%m/%d %H:%M") if r["mtime"] else "?"
            print(f"  {r['session_id']}  ({ts}, {r['matches']} matches)")
            print(f"    ...{r['context']}...")
            print()
        return

    # Determine which session to recover
    session_path = None
    if args.session:
        # Direct session ID
        candidate = project_dir / f"{args.session}.jsonl"
        if not candidate.exists():
            # Try partial match
            matches = list(project_dir.glob(f"{args.session}*.jsonl"))
            if len(matches) == 1:
                candidate = matches[0]
            elif len(matches) > 1:
                print(f"Ambiguous session ID '{args.session}'. Matches:", file=sys.stderr)
                for m in matches:
                    print(f"  {m.stem}", file=sys.stderr)
                sys.exit(1)
            else:
                print(f"Session '{args.session}' not found.", file=sys.stderr)
                sys.exit(1)
        session_path = candidate
    else:
        # Default: most recent session (not the current one)
        session_path = find_most_recent_session(project_dir)
        if not session_path:
            print("No sessions found.", file=sys.stderr)
            sys.exit(1)

    # Parse time filters
    after_dt = None
    before_dt = None
    if args.last:
        delta = parse_duration(args.last)
        after_dt = datetime.now(tz=timezone.utc) - delta
    if args.after:
        after_dt = parse_user_datetime(args.after)
    if args.before:
        before_dt = parse_user_datetime(args.before)

    # Parse the session
    messages, resources, compaction_points = parse_session(
        session_path,
        after=after_dt,
        before=before_dt,
        search=args.search,
        before_compaction=args.before_compaction,
    )

    session_id = Path(session_path).stem

    # Header
    if not args.resources_only:
        print(f"Session: {session_id}")
        print(f"File: {session_path}")
        if compaction_points:
            print(f"Compaction points: {len(compaction_points)}")
            for cp in compaction_points:
                print(
                    f"  - {format_timestamp(cp['timestamp'])} (trigger: {cp['trigger']}, pre-tokens: {cp['pre_tokens']})"
                )
        print(f"Messages recovered: {sum(1 for m in messages if m['type'] in ('user', 'assistant'))}")
        print(f"Unique resources accessed: {len(set((r[0], r[1]) for r in resources))}")
        print("-" * 60)
        print()

    # Output
    output = format_transcript(
        messages,
        resources_only=args.resources_only,
        compact=args.compact,
    )
    print(output)


if __name__ == "__main__":
    main()
