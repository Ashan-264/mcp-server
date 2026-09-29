# MCP Server (Next.js)

An **MCP (Model Context Protocol) server** built with **Next.js** using the [`mcp-handler`](https://www.npmjs.com/package/mcp-handler) adapter. It exposes a set of MCP **tools** over HTTP (and optionally SSE) to integrate with clients that speak MCP.

This repo currently includes tools for:
- **GitHub Issues** (list open issues, add issue comments)
- **Google Docs** (create a doc for a GitHub issue, append content to an existing doc) via **Google OAuth2**
- **Oura Ring** (fetch stress/recovery indicators)
- A simple **echo** tool for testing

## Tech Stack

- Next.js (App Router) + TypeScript
- `mcp-handler` for wiring an MCP server into Next.js routes
- `zod` for tool argument schemas
- `googleapis` for Google Docs/Drive
- Optional: Redis (recommended/required for SSE transport in some deployments)

## Project Structure (key parts)

- `app/mcp/[transport]/route.ts` — main MCP server route (tools are defined here)
- `app/mcp/github-issues/[transport]/route.ts` — standalone GitHub Issues MCP server
- `scripts/` — small Node.js clients and helpers to test the MCP server
  - `scripts/test-tool-call.mjs` — calls the `echo` tool
  - `scripts/test-github-issues.mjs` — calls `list_github_issues`
  - `scripts/test-add-comment.mjs` — calls `add_github_issue_comment`
  - `scripts/test-google-doc.mjs` — calls `create_google_doc_for_issue`
  - `scripts/test-edit-doc.mjs` — calls `edit_google_doc`
  - `scripts/test-oura.mjs` — calls `get_oura_stress_recovery`
  - `scripts/get-refresh-token.mjs` — generates a Google OAuth refresh token for `.env.local`

### Endpoints

`mcp-handler` derives all three transport endpoints from `basePath`, and the
`[transport]` dynamic segment serves them from one file:

| Transport | Main server | GitHub Issues server |
| --- | --- | --- |
| Streamable HTTP | `/mcp/mcp` | `/mcp/github-issues/mcp` |
| SSE | `/mcp/sse` | `/mcp/github-issues/sse` |
| SSE messages | `/mcp/message` | `/mcp/github-issues/message` |

Streamable HTTP is the recommended transport and works with no extra services.
The SSE endpoints are only enabled when `REDIS_URL` is set — Redis relays
messages between the `/sse` and `/message` requests. Without it they return
`404 Not found`.

## Available MCP Tools

Defined in `app/mcp/[transport]/route.ts`:

### `echo`
**Args**
- `message` (string)

Returns the same message back.

---

### `list_github_issues`
Lists open issues for a given repository (filters out pull requests returned by the GitHub Issues endpoint).

**Args**
- `owner` (string) — GitHub user/org
- `repo` (string) — repository name

**Requires**
- `GITHUB_TOKEN`

---

### `add_github_issue_comment`
Adds a comment to a GitHub issue.

**Args**
- `owner` (string)
- `repo` (string)
- `issueNumber` (number)
- `comment` (string)

**Requires**
- `GITHUB_TOKEN`

---

### `get_oura_stress_recovery`
Fetches Oura stress/recovery indicators for the last N days (default 7, max 30).

**Args**
- `days` (number, optional)

**Requires**
- `OURA_API_TOKEN`

---

### `create_google_doc_for_issue`
Fetches a GitHub issue and creates a Google Doc titled like:  
`<repo> - Issue #<issueNumber>: <issue title>`

It uses Drive API to create the document (optionally in a folder), then writes initial content via Docs API.

**Args**
- `owner` (string)
- `repo` (string)
- `issueNumber` (number)

**Requires**
- `GITHUB_TOKEN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- Optional: `GOOGLE_DRIVE_FOLDER_ID`

---

### `edit_google_doc`
Appends text to the end of an existing Google Doc.

**Args**
- `documentId` (string)
- `content` (string)

**Requires**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

## Setup

### 1) Install dependencies

Using pnpm (recommended, per `package.json`):

```bash
pnpm install
```

### 2) Environment variables

Create `.env.local`:

```env
# GitHub
GITHUB_TOKEN="ghp_..."

# Oura
OURA_API_TOKEN="..."

# Google OAuth (Docs/Drive)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REFRESH_TOKEN="your-refresh-token"
GOOGLE_DRIVE_FOLDER_ID="optional-folder-id"

# Optional (SSE / deployment)
REDIS_URL="redis://..."
```

### 3) Google OAuth refresh token (if using Google tools)

Follow the guide in `GOOGLE_OAUTH_SETUP.md` or run:

```bash
node scripts/get-refresh-token.mjs
```

Then copy the printed values into `.env.local`.

### 4) Run the server

```bash
pnpm dev
```

By default, Next.js runs on `http://localhost:3000`, so the main MCP server is
mounted at `http://localhost:3000/mcp`.

## Testing with the included sample clients

Each script takes the **server base URL** (the `basePath`, not the transport
endpoint) as its first argument and appends the transport segment itself. All
arguments below match each script's default, so you can omit them when the
server is on port 3000.

### Streamable HTTP (no Redis required)

```bash
node scripts/test-streamable-fixed.mjs http://localhost:3000/mcp
node scripts/test-streamable-http-client.mjs http://localhost:3000/mcp
```

### SSE clients

> These use the SSE transport, so they need `REDIS_URL` set in `.env.local`.
> Without Redis the `/sse` endpoint returns `404 Not found`.

#### List tools / connect

```bash
node scripts/test-client.mjs http://localhost:3000/mcp
```

#### Call echo

```bash
node scripts/test-tool-call.mjs http://localhost:3000/mcp
```

#### List GitHub issues

```bash
node scripts/test-github-issues.mjs http://localhost:3000/mcp/github-issues <owner> <repo>
# Example:
node scripts/test-github-issues.mjs http://localhost:3000/mcp/github-issues microsoft vscode
```

#### Add a GitHub issue comment

```bash
node scripts/test-add-comment.mjs http://localhost:3000/mcp <owner> <repo> <issue-number> "your comment"
```

#### Create a Google Doc for an issue

```bash
node scripts/test-google-doc.mjs http://localhost:3000/mcp <owner> <repo> <issue-number>
```

#### Append to an existing Google Doc

```bash
node scripts/test-edit-doc.mjs http://localhost:3000/mcp <document-id> "Text to append"
```

#### Fetch Oura stress/recovery

```bash
node scripts/test-oura.mjs http://localhost:3000/mcp 7
```

## Deployment Notes (Vercel)

- The SSE transport requires a Redis instance (`REDIS_URL`); it is enabled
  automatically when that variable is set.
- Consider enabling Vercel Fluid Compute for longer-running requests.

In `app/mcp/[transport]/route.ts`, the MCP handler is configured with:
- `basePath: "/mcp"` (must match the directory holding the `[transport]` segment)
- `disableSse: !process.env.REDIS_URL`
- `redisUrl: process.env.REDIS_URL`
- `maxDuration: 60`

## License

See `LICENSE`.
