# Knowledge Memory MCP

Local MCP server for storing corrections, preferences, and reusable criteria across conversations, with a single Codex configuration and separate global + project memory files.

## What It Solves

- Stores user-approved corrections in a stable format.
- Lists, searches, and retrieves relevant criteria for new tasks.
- Helps agents avoid repeating mistakes when they consult this MCP before implementation or review.

## Memory Stores

By default, memory is stored in plain Markdown files:

```text
~/.codex/changes.md              # global memory
<project>/.codex/changes.md      # project memory
```

You can change this with CLI arguments or environment variables:

- `--project-path=/path/to/project`: default project when a tool call does not pass `projectPath`.
- `--global-path=/path/to/changes.md`: exact file path for global memory.
- `CHANGES_MEMORY_PROJECT_PATH`: equivalent to `--project-path`.
- `CHANGES_MEMORY_GLOBAL_PATH`: equivalent to `--global-path`.

Backward compatibility:

- `--memory-root` and `CHANGES_MEMORY_ROOT` still work as the default project path.
- `--memory-path` and `CHANGES_MEMORY_PATH` force an exact file path for the default project memory.

## MCP Tools

- `add_local`: stores a new correction or criterion in project memory.
- `add_global`: stores a cross-project criterion in global memory.
- `list_change_index`: lists a compact index of entries with id, title, store, kind, tags, and paths.
- `list_tag_catalog`: lists the recommended tag catalog for memory entries.
- `list_changes`: lists project + global entries by default.
- `search_changes`: searches entries by free text, tags, or paths.
- `get_relevant_changes`: returns the most relevant project + global entries for a task.
- `get_change`: retrieves an exact entry by id from project + global memory.

Read tools and `add_local` accept `projectPath` to select the right project when a conversation touches multiple repositories.

## Recommended Tags

Every `add_local` and `add_global` call must include `tags`. Prefer 2-5 tags from this catalog:

```text
api, backend, codex, components, config, database, docker, docs, frontend,
git, i18n, json, mcp, migration, mongo, naming, opensearch, performance,
security, styles, tests
```

Use `list_tag_catalog` when unsure which tags fit. Tags are what make `list_change_index` useful without loading full entries.

## Run From GitHub

```sh
npx -y --package github:formonkey/knowledge-memory-mcp#main knowledge-memory-mcp
```

## Run From A Local Checkout

```sh
node /path/to/knowledge-memory-mcp/src/index.js
```

## Codex MCP Configuration

Use one global config in `~/.codex/config.toml`.

GitHub shows a copy button on each fenced code block below, so users can copy each file or snippet directly.

Recommended setup, directly from GitHub:

```toml
[mcp_servers.knowledge_memory]
command = "npx"
args = [
  "-y",
  "--package",
  "github:formonkey/knowledge-memory-mcp#main",
  "knowledge-memory-mcp"
]
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 60
default_tools_approval_mode = "auto"
```

Local checkout:

```toml
[mcp_servers.knowledge_memory]
command = "node"
args = [
  "/absolute/path/to/knowledge-memory-mcp/src/index.js"
]
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 60
default_tools_approval_mode = "auto"
```

Environment-variable alternative:

```toml
[mcp_servers.knowledge_memory.env]
CHANGES_MEMORY_GLOBAL_PATH = "/Users/nigma/.codex/changes.md"
```

After changing the config, restart Codex so the MCP server is reloaded.

## Copy-Paste Codex Setup

This is the recommended setup when several Codex agents should share the same memory server.

GitHub renders a copy-to-clipboard button on every code block in this section.

Paste each block here:

```text
~/.codex/config.toml                                # one global MCP server config
<project>/.codex/agents/knowledge-reviewer.toml     # optional read-only reviewer agent
<project>/.agents/skills/knowledge-memory-review/SKILL.md  # optional reviewer skill
<project>/AGENTS.md                                 # optional project-wide agent rules
```

### 1. Global MCP config

Copy this into:

```text
~/.codex/config.toml
```

```toml
[mcp_servers.knowledge_memory]
command = "npx"
args = [
  "-y",
  "--package",
  "github:formonkey/knowledge-memory-mcp#main",
  "knowledge-memory-mcp"
]
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 60
default_tools_approval_mode = "auto"
```

Restart Codex after editing `~/.codex/config.toml`.

### 2. Project reviewer agent

Create this file inside any project that should use the reviewer:

```text
<project>/.codex/agents/knowledge-reviewer.toml
```

```toml
name = "knowledge_reviewer"
description = "Read-only reviewer that checks code against knowledge_memory before and after implementation."
model = "gpt-5.5"
model_reasoning_effort = "high"
sandbox_mode = "read-only"

developer_instructions = """
You are a read-only knowledge reviewer for this repository.

Required MCP server:
- knowledge_memory

Available knowledge_memory tools:
- list_change_index
- list_tag_catalog
- get_change
- search_changes
- get_relevant_changes

Guardrails:
- Do not edit files.
- Do not run write, format, migration, install, or destructive commands.
- Do not call add_local or add_global.
- Do not save memory. If a new reusable rule is found, propose it to the main agent and wait for explicit user confirmation.
- Prefer compact reads: call list_change_index first, then retrieve only relevant entries with get_change, search_changes, or get_relevant_changes.
- When reviewing multiple projects, pass projectPath to knowledge_memory tool calls.

Review workflow:
1. Call list_change_index with projectPath when available.
2. Use tags from the index to decide which entries matter.
3. Retrieve only the relevant entries.
4. Review the current task or diff against those entries.
5. Report findings first, ordered by severity, with file and line references when available.
6. Include an explicit "Memory Checks" section listing which memory ids were applied or saying that no relevant entries were found.

Output format:
- Findings
- Memory Checks
- Open Questions
- Suggested Memory To Save, only if applicable and only as a proposal
"""
```

Notes:

- The reviewer workflow is fully embedded in `developer_instructions`, so this agent works even without an extra skill file.
- The important guardrail is `sandbox_mode = "read-only"` plus the explicit instruction not to use write tools.
- If your Codex version supports additional per-agent permission fields, keep this reviewer read-only.

### 3. Optional reviewer skill

Create this file if you want the same review workflow available as a reusable Codex skill in the project:

```text
<project>/.agents/skills/knowledge-memory-review/SKILL.md
```

```md
---
name: knowledge-memory-review
description: Review a task, plan, or diff against knowledge_memory using the compact memory index first.
---

# Knowledge Memory Review

Use this skill when reviewing implementation plans, diffs, bug fixes, or refactors against saved project and global memory.

## Required MCP Server

- `knowledge_memory`

## Read-Only Tools

- `list_change_index`
- `list_tag_catalog`
- `get_change`
- `search_changes`
- `get_relevant_changes`

## Guardrails

- Do not edit files.
- Do not run write, format, migration, install, or destructive commands.
- Do not call `add_local` or `add_global`.
- Do not save memory directly.
- If a new reusable rule should be saved, propose it and wait for explicit user confirmation.
- Prefer compact reads: call `list_change_index` first, then retrieve only the entries that look relevant.
- When reviewing several projects in one conversation, pass `projectPath` to memory tool calls.

## Workflow

1. Call `list_change_index` with `projectPath` when available.
2. Select candidate entries by tags, paths, title, and summary.
3. Retrieve only relevant entries with `get_change`, `search_changes`, or `get_relevant_changes`.
4. Review the task, plan, or diff against those entries.
5. Report findings first, ordered by severity, with file and line references when available.
6. Include a `Memory Checks` section listing the memory ids applied, or state that no relevant entries were found.
7. Include `Suggested Memory To Save` only when there is a reusable learning, and only as a proposal.
```

The `knowledge-reviewer.toml` agent above already contains these rules. This skill is useful for main agents or other reviewers that load repository skills.

### 4. Optional project AGENTS.md snippet

Copy this into a project's `AGENTS.md` if you want every agent in that repo to use memory:

```md
Before implementing, reviewing, or fixing code, use the `knowledge_memory` MCP.

Start with `list_change_index` to inspect the compact index. Use tags to decide which entries are relevant, then call `get_change`, `search_changes`, or `get_relevant_changes` only for those entries.

Use `add_local` only after explicit user confirmation for project-specific learnings.
Use `add_global` only after explicit user confirmation for cross-project learnings.
Every saved memory entry must include 2-5 tags from `list_tag_catalog`.

When a conversation touches multiple projects, pass `projectPath` to select the correct local memory file.
```

### 5. Example prompts

Use the reviewer before implementation:

```text
Ask knowledge_reviewer to inspect memory for this repo and review the planned change before I implement it.
```

Use the reviewer after implementation:

```text
Ask knowledge_reviewer to review this diff against knowledge_memory and report any repeated mistakes or missing conventions.
```

Save a local project rule:

```text
Save this as local memory: React components in this repo must use PascalCase file names and include the Component suffix. Tags: components, naming, frontend.
```

Save a global rule:

```text
Save this as global memory: Always check list_change_index before reading full memory entries. Tags: codex, mcp, performance.
```

## Recommended Agent Instruction

Add a rule like this to global or repository instructions when you want agents to use this memory:

```md
Before implementing or reviewing changes, call `list_change_index` on the `knowledge_memory` MCP server to inspect the compact index. Then call `get_change`, `search_changes`, or `get_relevant_changes` only for entries that look relevant.

When a conversation touches multiple projects, pass `projectPath` in tool calls to select the correct local memory.

Do not store memory on your own initiative. If the user confirms that a learning should be saved, use `add_local` for project-specific criteria and `add_global` only for criteria that apply across projects. Always include 2-5 tags from the catalog.
```

## Notes

- Persistence currently uses plain `changes.md` files, with no database or external index.
- Search is text-based with simple ranking. It is enough to start and easy to audit.
- The model can later evolve toward richer scopes, editable confirmations, and explicit `Before -> After` output.
