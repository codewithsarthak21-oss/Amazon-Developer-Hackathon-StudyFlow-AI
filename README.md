# StudyFlow AI

StudyFlow AI is a student productivity prototype for the Amazon Developer Hackathon's Alexa+ track. It includes a React + TypeScript dashboard, a Node.js/TypeScript API, SQLite persistence, and a real Model Context Protocol (MCP) endpoint using Streamable HTTP.

> **Hackathon transparency:** This repository implements a self-hosted MCP server and a web-based study assistant. It is not an official Amazon Alexa+ integration, and the frontend's built-in chat is a deterministic demo assistant rather than a connected LLM. To demonstrate the MCP integration, use MCP Inspector to call the server tools. Before claiming an AI-agent integration, connect an actual model with tool calling and record it invoking these tools.

## Features

- Create, list, and complete study tasks.
- Persist tasks and study sessions in SQLite.
- View progress and estimated remaining study time.
- Generate a time-limited plan that prioritizes higher priority tasks and earlier deadlines.
- MCP tools exposed over stateless Streamable HTTP at `POST /mcp`.
- REST endpoints for the included dashboard.

## Requirements

- Node.js 20 or newer recommended
- npm 10 or newer

## Run locally

From the repository root:

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend health check: http://localhost:3001/api/health
- MCP endpoint: http://localhost:3001/mcp

The SQLite database is created automatically at `server/data/studyflow.sqlite` when the backend runs from the workspace. The data folder is ignored by Git.

### Run each service separately

```bash
npm --workspace server install
npm --workspace frontend install
npm run dev:server
```

In another terminal:

```bash
npm run dev:frontend
```

## MCP integration

The MCP server uses `@modelcontextprotocol/sdk` and the Streamable HTTP transport. Its stateless endpoint accepts JSON-RPC/MCP requests via `POST /mcp`.

Tools currently exposed:

- `create_task` — create and persist a task.
- `get_study_plan` — fetch a date's scheduled sessions and unfinished tasks.
- `complete_session` — mark a planned session completed.
- `get_progress` — summarize completion and remaining time.
- `replan_day` — generate a prioritized plan for the available time.
- `list_tasks` — list persisted tasks.
- `complete_task` — mark a task completed.

### Test the MCP server with MCP Inspector

Start the backend (`npm run dev:server`) first. In another terminal, run the Inspector using the command recommended by the official MCP documentation for your installed version. Configure a Streamable HTTP connection to:

```text
http://localhost:3001/mcp
```

Initialize the connection, list tools, then call `create_task` with a subject, topic, future deadline (`YYYY-MM-DD`), priority, and estimated duration. Call `list_tasks` or `get_progress` to confirm that data persisted. Refresh the StudyFlow dashboard to see the saved task.

Official docs: https://modelcontextprotocol.io/docs and https://github.com/modelcontextprotocol/typescript-sdk

## API reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health and MCP endpoint info |
| GET | `/api/tasks` | List tasks (`?includeCompleted=false` hides completed) |
| POST | `/api/tasks` | Create a task |
| POST | `/api/tasks/:id/complete` | Complete a task |
| GET | `/api/progress` | Completion summary |
| GET | `/api/plan?date=YYYY-MM-DD` | Get planned sessions and unfinished tasks |
| POST | `/api/replan` | Replan tasks for available minutes |
| POST | `/mcp` | MCP Streamable HTTP JSON-RPC endpoint |

Example task payload:

```json
{
  "subject": "Computer Networks",
  "topic": "OSI and TCP/IP layers",
  "deadline": "2026-10-24",
  "priority": "high",
  "estimatedMinutes": 45
}
```

## Build

```bash
npm run build
```

## Environment variables

- `PORT` — backend port (default `3001`).
- `DATA_DIR` — SQLite database directory (default `./data`, relative to the backend process working directory).
- `FRONTEND_ORIGIN` — optional comma-separated frontend origin allowlist. For local development, leave unset.
- `VITE_API_URL` — frontend API base URL (default `http://localhost:3001`). Set this to your deployed backend URL when deploying the frontend.

## Deployment notes

Deploy the frontend and backend separately if needed. Set `VITE_API_URL` to the backend's public URL before building the frontend, and set `FRONTEND_ORIGIN` to the frontend origin on the backend. Ensure your host provides persistent storage for SQLite, or replace SQLite with a managed database before scaling. Do not commit secrets or real student data.

## Current limitations / honest demo notes

- The chat interface recognizes a few demo intents; it does not yet use an LLM.
- The generated plan is a simple priority/deadline ordering heuristic, not an optimal scheduler.
- `complete_session` marks a session complete; task completion is a separate action.
- This is a hackathon starter implementation. Run tests, verify the installed MCP SDK version and current hackathon requirements, and record the actual MCP tool invocation in your demo video.

## License

MIT — see [LICENSE](LICENSE).
