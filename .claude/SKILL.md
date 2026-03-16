Recover a conversation that was lost to auto-compaction or context overflow, then resume working on it.

**Arguments:** $ARGUMENTS (a time interval like "2h" or "30m", OR a keyword/subject like "inventory decrement", OR a session UUID)

## Step 0: Find the script

Look for `chat-recover.py` in the repo. Try `scripts/chat-recover.py` first, then search with Glob for `**/chat-recover.py`. If it is not found anywhere, tell the user: "chat-recover.py was not found in this repo. It should be placed somewhere in the tree (commonly `scripts/chat-recover.py`)." and stop.

## Step 1: Recover the transcript

Determine what the user wants to recover based on $ARGUMENTS:

- **Time interval** (e.g., "2h", "30m", "1d"): Run `python <path-to-chat-recover.py> --last <interval>`
- **Keyword/subject** (e.g., "inventory", "label page"): First run `python <path-to-chat-recover.py> --search "<keyword>"` to find matching sessions, then recover the most relevant one with `python <path-to-chat-recover.py> --session <uuid>`
- **Session UUID**: Run `python <path-to-chat-recover.py> --session <uuid>`
- **"before compaction"** or **"pre-compact"**: Run `python <path-to-chat-recover.py> --before-compaction`
- **No arguments**: Run `python <path-to-chat-recover.py> --before-compaction` (the most common recovery case)

If the output exceeds what the Bash tool can capture, use `--after` or `--before` to recover in time-windowed chunks.

Also run with `--resources-only` to get the list of files and URLs accessed during the conversation.

## Step 2: Show the recovered transcript to the user

Present the full recovered transcript to the user. This is the entire point — the user needs to see the actual conversation to confirm it is the right one and to restore their own context. Show all user and Claude messages with timestamps.

Before the transcript, provide a brief topic summary for each segment of the conversation (segments are separated by compaction boundaries or natural topic shifts). Example: "The conversation covers two segments: (1) 14:00-14:32 — debugging the Shopify webhook timeout, (2) 14:33-15:10 — planning the inventory cache feature."

After the transcript, also present:
- The list of files and URLs accessed during the conversation
- The location of any compaction boundaries

## Step 3: Confirm with the user

Ask the user: "Is this the conversation you wanted to recover?" with options:
- **Yes, continue** — proceed to Step 4
- **Refine search** — go back to Step 1 with different parameters
- **Show a different time range** — recover a different portion of the session

## Step 4: Propose next steps

Based on the recovered conversation content, identify:
1. What was being worked on (the task or discussion topic)
2. What state the work was in (planning, mid-implementation, debugging, reviewing)
3. What the logical next step would be

Present this as: "Based on the recovered conversation, you were [doing X]. The last action was [Y]. I propose to [Z]."

Wait for the user to confirm or redirect before proceeding.

## Step 5: Continue working

Once the user confirms, proceed with the proposed work. You now have the full context of what was discussed — treat it as if the conversation had never been interrupted.
