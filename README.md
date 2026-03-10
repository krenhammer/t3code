# T3 Code

T3 Code is a Codex-first workspace for running coding agents against a real project. It combines a React UI, a Node.js WebSocket server, and a provider runtime that currently wraps `codex app-server`.

## What You Can Expect

T3 Code is meant to feel like a persistent coding session, not a disposable chat box.

- Connect a real local repository as a project.
- Start focused threads inside that project.
- Send prompts and watch provider work stream back live.
- Approve or reject actions when the runtime asks.
- Inspect plans, diffs, checkpoints, and terminal activity as the turn unfolds.
- Reconnect without losing the server-side view of what the session is doing.

The project is still very early. Expect rough edges.

## Quick Start

> [!WARNING]
> T3 Code currently expects [Codex CLI](https://github.com/openai/codex) to be installed and authenticated.

Run the app:

```bash
npx t3
```

For local development:

```bash
bun run dev
```

Useful commands:

```bash
# server only
bun run dev:server

# web app only
bun run dev:web

# desktop shell
bun run dev:desktop

# production build
bun run build
```

## How People Use It

A typical session looks like this:

1. Open T3 Code against a repository.
2. Create or select a project rooted at that workspace.
3. Start a thread for a concrete task.
4. Send a prompt.
5. Watch the agent stream work, ask for approvals if needed, and return conversation output plus diffs and activity.
6. Iterate in the same thread, switch modes, or branch into follow-up work.

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md): system design, package boundaries, runtime flows, and Mermaid diagrams.
- [AGENTS.md](./AGENTS.md): instructions for AI coding agents working in this repository, including architectural guidance and implementation constraints.
- [CONTRIBUTING.md](./CONTRIBUTING.md): contribution context and process.

## Development Notes

The repo is optimized around:

- performance first
- reliability first
- predictable behavior during reconnects, session restarts, and partial streams

## Support

- Releases: [github.com/pingdotgg/t3code/releases](https://github.com/pingdotgg/t3code/releases)
- Discord: [discord.gg/jn4EGJjrvv](https://discord.gg/jn4EGJjrvv)
