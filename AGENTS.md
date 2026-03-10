# AGENTS.md

This file is for AI coding agents working in this repository.

Use it together with:

- `README.md` for human-facing setup and usage
- `ARCHITECTURE.md` for detailed architecture, flows, and diagrams

## Task Completion Requirements

- Both `bun lint` and `bun typecheck` must pass before considering tasks completed.
- NEVER run `bun test`. Always use `bun run test` (runs Vitest).

## Project Snapshot

T3 Code is a Codex-first workspace for using coding agents against a real repository.

The current product shape is:

- a React web app in `apps/web`
- a Node.js WebSocket server in `apps/server`
- an Electron shell in `apps/desktop`
- a provider runtime layer that currently wraps `codex app-server`

This repository is a very early WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## How Users Experience The App

When deciding whether a change fits the system, optimize for this user story:

1. A user opens T3 Code against a local repository.
2. They create or select a project that maps to a workspace root.
3. They create a thread for a focused task.
4. They submit a prompt.
5. The provider session starts or resumes and streams work back live.
6. The UI may show approvals, structured user input requests, plans, terminal output, and diffs as the turn progresses.
7. The user can continue in the same thread, interrupt work, revert to checkpoints, or branch into follow-up work.

That means the app should feel like a persistent coding session with a visible control plane, not a stateless chatbot.

## Architectural Mental Model

Keep these boundaries intact when making changes:

- The server is the source of truth for runtime session state.
- The client renders projected state and dispatches commands; it should not invent authoritative provider state locally.
- Provider-specific behavior belongs behind the provider service and adapter boundaries.
- Contracts belong in `packages/contracts` only; do not add runtime logic there.
- Shared runtime helpers belong in explicit `packages/shared` subpaths, not a barrel export.

The highest-level flow is:

1. The UI dispatches a typed command over WebSocket RPC.
2. The server validates and persists orchestration events.
3. Projections update the read model.
4. Reactors trigger side effects such as provider execution or checkpoint work.
5. Provider runtime events are normalized and fed back into orchestration.
6. The UI rehydrates from snapshots and subscribes to domain-event pushes.

## Package Roles

- `apps/server`: Node.js WebSocket server. Serves the React app, routes RPC requests, owns orchestration, persistence, provider integration, Git, terminal, checkpoints, and attachments.
- `apps/web`: React/Vite UI. Owns session UX, conversation/event rendering, local UI state, and WebSocket transport.
- `apps/desktop`: Electron shell. Starts the backend process, loads the web app, and exposes desktop-native bridges.
- `packages/contracts`: Effect Schema schemas and TypeScript contracts for WebSocket protocol, orchestration commands/events, provider runtime, Git, terminal, and model/session types. Keep this package schema-only.
- `packages/shared`: Shared runtime utilities consumed by both server and web. Uses explicit subpath exports only.

## Maintainability Expectations

Long-term maintainability is a core priority.

- If you add functionality, look for shared logic that should be extracted instead of duplicated.
- Duplicate logic across multiple files is a code smell.
- Do not take shortcuts by adding local one-off logic when a shared abstraction is more appropriate.
- Do not bypass established architecture layers just because the nearest file is convenient.

## Orchestration And Provider Boundaries

Key locations:

- WebSocket request routing: `apps/server/src/wsServer.ts`
- Runtime layer composition: `apps/server/src/serverLayers.ts`
- Orchestration engine and reactors: `apps/server/src/orchestration/`
- Provider service and adapters: `apps/server/src/provider/`
- Codex runtime bridge: `apps/server/src/codexAppServerManager.ts`
- WebSocket transport in the client: `apps/web/src/wsTransport.ts`
- Native API WebSocket implementation: `apps/web/src/wsNativeApi.ts`
- Client state hydration and merging: `apps/web/src/store.ts`

Preserve the distinction between:

- orchestration commands and domain events
- read-model projection logic
- provider runtime ingestion
- side-effect reactors
- UI-only derived state

## Codex App Server (Important)

T3 Code is currently Codex-first. The server starts `codex app-server` over JSON-RPC stdio for provider sessions, then translates provider runtime activity into canonical orchestration events and WebSocket pushes.

How that shows up in this codebase:

- Session startup, resume, turn sending, approvals, and user-input responses are handled through the provider service and Codex adapter layers in `apps/server/src/provider/`.
- `apps/server/src/codexAppServerManager.ts` contains the lower-level Codex app-server process and JSON-RPC integration details.
- `apps/server/src/orchestration/` owns command dispatch, event persistence, projection, and runtime ingestion.
- `apps/server/src/wsServer.ts` exposes the transport surface the web app talks to.
- `apps/web/src/wsTransport.ts` and `apps/web/src/store.ts` are the main client-side entry points for snapshot hydration and live event updates.

Docs:

- Codex App Server docs: https://developers.openai.com/codex/sdk/#app-server

## What Not To Break

Be careful around these behaviors:

- reconnecting clients should be able to recover from server snapshots and pushed events
- partial streams should not corrupt thread/session state
- approvals and structured user-input requests must stay correlated to the right thread and turn
- session restarts should preserve predictable user-visible state
- runtime-mode and interaction-mode changes should stay explicit and traceable

## Documentation Expectations

When changing docs:

- keep `README.md` oriented toward setup, usage, and repo entry-point expectations
- keep `ARCHITECTURE.md` as the detailed system-design document
- keep `AGENTS.md` focused on implementation guidance for AI agents

If you change architecture or product flow materially, update the relevant docs together instead of letting them drift.

## Reference Repos

- Open-source Codex repo: https://github.com/openai/codex
- Codex-Monitor (Tauri, feature-complete, strong reference implementation): https://github.com/Dimillian/CodexMonitor

Use these as implementation references when designing protocol handling, UX flows, and operational safeguards.
