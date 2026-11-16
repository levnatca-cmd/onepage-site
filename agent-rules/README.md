# Project rules for coding agents

The root [AGENTS.md](../AGENTS.md) points here. The [Galaxy workflow](galaxy.md) covers scene and service changes. The [historical scene instructions](archive/three-scene-edit.md) are retained for reference.

## Before implementation

Run a premortem for every implementation plan before starting work.

1. Assume the implementation has failed and list the most likely failure modes.
2. For each failure mode, record probability, impact, how to detect it, and how to prevent it.
3. Convert high-risk failure modes into concrete QA checks and revise the plan to include them.
4. Verify those checks before marking the plan complete, or explicitly record any checks that are deferred.

Inspect the worktree before editing. Preserve existing user changes and keep implementation, verification, and generated output aligned. Use the root [repository guide](../README.md) to identify the owner of each generated file.

## Before delivery

Run the existing checks relevant to the change. When changing a public route, build pipeline, or file path, verify affected links and load the affected pages. Describe the checks that ran and any material gaps. Commit, push, or publish only when the user requests that action.
