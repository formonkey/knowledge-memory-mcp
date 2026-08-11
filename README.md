# Changes Memory MCP

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
- `list_changes`: lists project + global entries by default.
- `search_changes`: searches entries by free text, tags, or paths.
- `get_relevant_changes`: returns the most relevant project + global entries for a task.
- `get_change`: retrieves an exact entry by id from project + global memory.

Read tools and `add_local` accept `projectPath` to select the right project when a conversation touches multiple repositories.

## Run From GitHub

```sh
npx -y --package github:formonkey/knowledge-memory-mcp#main changes-memory-mcp
```

## Run From A Local Checkout

```sh
node /path/to/knowledge-memory-mcp/src/index.js
```

## Codex MCP Configuration

Use one global config in `~/.codex/config.toml`.

Recommended setup, directly from GitHub:

```toml
[mcp_servers.changes_memory]
command = "npx"
args = [
  "-y",
  "--package",
  "github:formonkey/knowledge-memory-mcp#main",
  "changes-memory-mcp"
]
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 60
default_tools_approval_mode = "auto"
```

Local checkout:

```toml
[mcp_servers.changes_memory]
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
[mcp_servers.changes_memory.env]
CHANGES_MEMORY_GLOBAL_PATH = "/Users/nigma/.codex/changes.md"
```

After changing the config, restart Codex so the MCP server is reloaded.

## Recommended Agent Instruction

Add a rule like this to global or repository instructions when you want agents to use this memory:

```md
Before implementing or reviewing changes, call `get_relevant_changes` on the `changes_memory` MCP server with a short summary of the task, then apply the retrieved criteria when they are still relevant.

When a conversation touches multiple projects, pass `projectPath` in tool calls to select the correct local memory.

Do not store memory on your own initiative. If the user confirms that a learning should be saved, use `add_local` for project-specific criteria and `add_global` only for criteria that apply across projects.
```

## Notes

- Persistence currently uses plain `changes.md` files, with no database or external index.
- Search is text-based with simple ranking. It is enough to start and easy to audit.
- The model can later evolve toward richer scopes, editable confirmations, and explicit `Before -> After` output.
