# Agent Instructions

## Purpose Of This File

`AGENTS.md` is guidance for Codex agents working inside this repository. It is not part of the MCP runtime and is not required by users who only consume the MCP through `npx`.

Its job is to tell agents how to use the `changes_memory` MCP consistently while editing, reviewing, or maintaining this repository.

## Objective

This workspace uses the `changes_memory` MCP to remember corrections, criteria, and recurring mistakes across conversations. Any agent that implements, reviews, or fixes work should consult and apply those criteria when they are still relevant.

## Shared Stores

Persistent memory lives in one store with global memory and per-project memory:

- `global/changes.md`: cross-project criteria.
- `projects/<project-key>/changes.md`: project-specific criteria.

Agents must not edit those files manually. Interaction must go through the `changes_memory` MCP.

## Mandatory `changes_memory` Usage

Before implementing, reviewing, or fixing code:

- Call `get_relevant_changes` with a short, concrete task summary.
- If you need to find a preference, recurring mistake, path, or specific concept, use `search_changes`.
- If you already know the exact change id, use `get_change`.
- When working with several projects in one conversation, pass `projectPath`, `projectKey`, or `project` to select the right project memory.

When the user corrects a pattern, recurring decision, or reusable criterion:

- Do not call `add_local` or `add_global` on your own initiative.
- Save a learning only if the user explicitly asks for it.
- Save after the correction, not before.
- Do not save temporary details or one-off task noise.
- Save only changes that can prevent future mistakes or improve consistency across conversations.

## Save Policy With User Validation

Required flow before `add_local` or `add_global`:

1. Finish the correction or collect the latest relevant changes.
2. Prepare a short proposal describing what should be saved.
3. Ask the user for explicit validation.
4. Only if the user confirms, call `add_local` for project memory or `add_global` for cross-project memory.

The agent must not treat a correction as implicit permission to persist memory.

## How To Record A Change

Use `add_local` for criteria specific to the current project. Use `add_global` only when the criterion is clearly reusable across projects.

Fill fields clearly and reuseably:

- `title`: short, direct criterion.
- `summary`: context of the mistake, correction, or preference.
- `requestedChange`: expected behavior from now on.
- `rationale`: why this change should apply.
- `kind`: use `preference`, `repo-convention`, `domain-fact`, or `anti-pattern`.
- `scope`: `add_local` uses project scope; `add_global` uses global scope.
- `tags`, `relatedPaths`, `before`, `after`, and `examples`: include them when they make the entry easier to retrieve and apply.

## References To Recent Fixes

When it is useful to refer to several recent corrections in a prompt, use short, readable, stable references inside the conversation, for example:

- `fix-a1`
- `fix-b2`
- `fix-c3`

Do not use opaque or long hashes unless necessary. The short reference only helps the user indicate which corrections should become memory; before calling `add_local` or `add_global`, reconstruct the proposal in clear language and ask for confirmation.

Example usage:

- `Save fix-a1 and fix-c3 to memory`
- `Prepare add_local with fix-b2, but show it to me first`

## Recommended Agent Flow

Default flow:

1. The implementation agent calls `get_relevant_changes` before touching code.
2. The implementation agent does the work while respecting those criteria.
3. The review agent reviews the code and checks the result against retrieved criteria and already learned rules.
4. If the review finds violations or a new reusable correction, it reports concrete adjustments to the implementation agent.
5. If a new generalizable learning appears, the agent may propose saving it, but it is recorded with `add_local` or `add_global` only if the user asks or explicitly confirms.

## Review Agent Role

The review agent is the consistency checkpoint:

- Check whether the code repeats previously corrected mistakes.
- Use `get_relevant_changes` and `search_changes` when the context requires it.
- Tell the implementation agent exactly what to adjust when discrepancies are found.
- Suggest that a correction may be worth saving, but never call `add_local` or `add_global` without an explicit user request or confirmation.

## Priority Rule

If a retrieved change conflicts with the current task:

- Prioritize the user's most recent explicit instruction.
- Briefly explain the conflict.
- Save a new change only if the corrected criterion becomes reusable.
