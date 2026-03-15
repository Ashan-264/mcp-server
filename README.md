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

- `app/mcp/route.ts` — main MCP server route (tools are defined here)
- `scripts/` — small Node.js clients and helpers to test the MCP server
  - `scripts/test-tool-call.mjs` — calls the `echo` tool
  - `scripts/test-github-issues.mjs` — calls `list_github_issues`
  - `scripts/test-add-comment.mjs` — calls `add_github_issue_comment`
  - `scripts/test-google-doc.mjs` — calls `create_google_doc_for_issue`
  - `scripts/test-edit-doc.mjs` — calls `edit_google_doc`
  - `scripts/test-oura.mjs` — calls `get_oura_stress_recovery`
  - `scripts/get-refresh-token.mjs` — generates a Google OAuth refresh token for `.env.local`

> Note: `app/mcp/sse/route.ts` and `app/mcp/message/route.ts` exist in the repo, but currently appear to be the same content as `app/mcp/route.ts` (same blob SHA). The canonical implementation is `app/mcp/route.ts`.

## Available MCP Tools

Defined in `app/mcp/route.ts`:

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

By default, Next.js runs on `http://localhost:3000`.

## Testing with the included sample clients

### List tools / connect

```bash
node scripts/test-client.mjs http://localhost:3000
```

### Call echo

```bash
node scripts/test-tool-call.mjs http://localhost:3000
```

### List GitHub issues

```bash
node scripts/test-github-issues.mjs http://localhost:3000 <owner> <repo>
# Example:
node scripts/test-github-issues.mjs http://localhost:3000 microsoft vscode
```

### Add a GitHub issue comment

```bash
node scripts/test-add-comment.mjs http://localhost:3000 <owner> <repo> <issue-number> "your comment"
```

### Create a Google Doc for an issue

```bash
node scripts/test-google-doc.mjs http://localhost:3000 <owner> <repo> <issue-number>
```

### Append to an existing Google Doc

```bash
node scripts/test-edit-doc.mjs http://localhost:3000 <document-id> "Text to append"
```

### Fetch Oura stress/recovery

```bash
node scripts/test-oura.mjs http://localhost:3000 7
```

## Deployment Notes (Vercel)

The existing README notes:
- SSE transport may require a Redis instance (`REDIS_URL`) and enabling SSE in the handler config.
- Consider enabling Vercel Fluid Compute for longer-running requests.

In `app/mcp/route.ts`, the MCP handler is configured with:
- `basePath: "/mcp"`
- `disableSse: false`
- `redisUrl: process.env.REDIS_URL`
- `maxDuration: 60`

## License

See `LICENSE`.
