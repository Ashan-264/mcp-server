import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { google } from "googleapis";

interface GitHubLabel {
  name: string;
}

interface GitHubUser {
  login: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  body: string | null;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  user: GitHubUser | null;
  created_at: string;
  html_url: string;
  pull_request?: unknown;
}

interface OuraStressEntry {
  day: string;
  stress_high: number | null;
  recovery_high: number | null;
  day_summary: string | null;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const textError = (text: string) => ({
  content: [{ type: "text" as const, text }],
  isError: true,
});

const textResult = (text: string) => ({
  content: [{ type: "text" as const, text }],
});

const jsonResult = (value: unknown) => textResult(JSON.stringify(value, null, 2));

const githubHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "next.js-mcp-server",
});

// Builds an OAuth2 client from the refresh-token flow credentials.
function googleOAuthClient(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost" // Redirect URI (not used for the refresh token flow)
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

// Serves the MCP transports under /mcp: streamable HTTP at /mcp/mcp,
// SSE at /mcp/sse, and SSE messages at /mcp/message.
const handler = createMcpHandler(
  async (server) => {
    // Echo tool
    server.tool(
      "echo",
      "Echo a message",
      {
        message: z.string(),
      },
      async ({ message }) => textResult(`Tool echo: ${message}`)
    );

    // GitHub Issues tool
    server.tool(
      "list_github_issues",
      "List open issues from a GitHub repository",
      {
        owner: z.string().describe("GitHub username or organization"),
        repo: z.string().describe("Repository name"),
      },
      async ({ owner, repo }) => {
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
          return textError(
            "Error: GITHUB_TOKEN not configured in environment variables"
          );
        }

        try {
          const response = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(
              owner
            )}/${encodeURIComponent(repo)}/issues?state=open&per_page=100`,
            { headers: githubHeaders(token) }
          );

          if (!response.ok) {
            const error = await response.text();
            return textError(
              `GitHub API Error (${response.status}): ${error}`
            );
          }

          const issues: GitHubIssue[] = await response.json();

          // Filter out pull requests (they appear in issues endpoint too)
          const actualIssues = issues.filter((issue) => !issue.pull_request);

          if (actualIssues.length === 0) {
            return textResult(`No open issues found in ${owner}/${repo}`);
          }

          // Format issues
          const formattedIssues = actualIssues.map((issue) => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            labels: (issue.labels ?? []).map((label) => label.name),
            assignees: (issue.assignees ?? []).map(
              (assignee) => assignee.login
            ),
            url: issue.html_url,
          }));

          return jsonResult(formattedIssues);
        } catch (error) {
          return textError(`Error fetching issues: ${errorMessage(error)}`);
        }
      }
    );

    // OURA Stress and Recovery tool
    server.tool(
      "get_oura_stress_recovery",
      "Get stress and recovery indicators from OURA for the last N days",
      {
        days: z
          .number()
          .int()
          .min(1)
          .max(30)
          .optional()
          .describe("Number of days to retrieve (default: 7, max: 30)"),
      },
      async ({ days = 7 }) => {
        const token = process.env.OURA_API_TOKEN;

        if (!token) {
          return textError(
            "Error: OURA_API_TOKEN not configured in environment variables"
          );
        }

        try {
          // Calculate date range (last N days)
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          const formatDate = (date: Date) => date.toISOString().split("T")[0];

          const response = await fetch(
            `https://api.ouraring.com/v2/usercollection/daily_stress?start_date=${formatDate(
              startDate
            )}&end_date=${formatDate(endDate)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!response.ok) {
            const error = await response.text();
            return textError(`OURA API Error (${response.status}): ${error}`);
          }

          const data: { data?: OuraStressEntry[] } = await response.json();

          if (!data.data || data.data.length === 0) {
            return textResult(
              `No stress/recovery data found for the last ${days} days`
            );
          }

          // Format the data
          const formattedData = data.data.map((entry) => ({
            date: entry.day,
            stress_high: entry.stress_high,
            recovery_high: entry.recovery_high,
            day_summary: entry.day_summary,
          }));

          return jsonResult({
            period: `${formatDate(startDate)} to ${formatDate(endDate)}`,
            total_days: formattedData.length,
            data: formattedData,
          });
        } catch (error) {
          return textError(`Error fetching OURA data: ${errorMessage(error)}`);
        }
      }
    );

    // Create Google Doc for GitHub Issue
    server.tool(
      "create_google_doc_for_issue",
      "Create a Google Doc for a GitHub issue with repo and issue details",
      {
        owner: z.string().describe("GitHub username or organization"),
        repo: z.string().describe("Repository name"),
        issueNumber: z.number().int().positive().describe("Issue number"),
      },
      async ({ owner, repo, issueNumber }) => {
        const githubToken = process.env.GITHUB_TOKEN;
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        if (!githubToken) {
          return textError("Error: GITHUB_TOKEN not configured");
        }

        if (!googleClientId || !googleClientSecret || !googleRefreshToken) {
          return textError(
            "Error: Google OAuth2 credentials not configured. Need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env.local"
          );
        }

        try {
          // Fetch issue details from GitHub
          const issueResponse = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(
              owner
            )}/${encodeURIComponent(repo)}/issues/${issueNumber}`,
            { headers: githubHeaders(githubToken) }
          );

          if (!issueResponse.ok) {
            const error = await issueResponse.text();
            return textError(
              `GitHub API Error (${issueResponse.status}): ${error}`
            );
          }

          const issue: GitHubIssue = await issueResponse.json();

          const oauth2Client = googleOAuthClient(
            googleClientId,
            googleClientSecret,
            googleRefreshToken
          );

          const docs = google.docs({ version: "v1", auth: oauth2Client });
          const drive = google.drive({ version: "v3", auth: oauth2Client });

          // Create document title
          const docTitle = `${repo} - Issue #${issueNumber}: ${issue.title}`;

          // Create the document using Drive API (which respects drive.file scope)
          const createResponse = await drive.files.create({
            requestBody: {
              name: docTitle,
              mimeType: "application/vnd.google-apps.document",
              ...(folderId && { parents: [folderId] }),
            },
            fields: "id",
            supportsAllDrives: true,
          });

          const documentId = createResponse.data.id;

          if (!documentId) {
            return textError("Error: Failed to create document");
          }

          const labels = (issue.labels ?? []).map((label) => label.name);
          const assignees = (issue.assignees ?? []).map(
            (assignee) => assignee.login
          );

          // Write the repo and issue details into the new document.
          const docBody = [
            `${owner}/${repo} - Issue #${issue.number}`,
            issue.title,
            "",
            `State: ${issue.state}`,
            `Author: ${issue.user?.login ?? "unknown"}`,
            `Labels: ${labels.length ? labels.join(", ") : "none"}`,
            `Assignees: ${
              assignees.length ? assignees.join(", ") : "unassigned"
            }`,
            `Created: ${issue.created_at}`,
            `Issue Details: ${issue.html_url}`,
            "",
            "Description:",
            issue.body?.trim() || "(no description provided)",
            "",
          ].join("\n");

          await docs.documents.batchUpdate({
            documentId: documentId,
            requestBody: {
              requests: [
                {
                  insertText: {
                    location: {
                      index: 1,
                    },
                    text: docBody,
                  },
                },
              ],
            },
          });

          const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

          return jsonResult({
            success: true,
            document_id: documentId,
            document_url: docUrl,
            title: docTitle,
            issue_url: issue.html_url,
          });
        } catch (error) {
          return textError(
            `Error creating Google Doc: ${errorMessage(error)}`
          );
        }
      }
    );

    // Edit Google Doc
    server.tool(
      "edit_google_doc",
      "Append content to an existing Google Doc",
      {
        documentId: z
          .string()
          .describe("Google Doc ID (from the document URL)"),
        content: z.string().describe("Text content to append to the document"),
      },
      async ({ documentId, content }) => {
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;

        if (!googleClientId || !googleClientSecret || !googleRefreshToken) {
          return textError(
            "Error: Google OAuth2 credentials not configured. Need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env.local"
          );
        }

        try {
          const oauth2Client = googleOAuthClient(
            googleClientId,
            googleClientSecret,
            googleRefreshToken
          );

          const docs = google.docs({ version: "v1", auth: oauth2Client });

          // Get the document to find the end index
          const doc = await docs.documents.get({
            documentId: documentId,
          });

          const body = doc.data.body?.content;

          if (!body || body.length === 0) {
            return textError("Error: Could not read document content");
          }

          // Find the last insertable index in the document. The trailing
          // newline of the final segment is not a valid insertion point, so
          // step back one from the last element's endIndex.
          const lastElement = body[body.length - 1];
          const endIndex = lastElement.endIndex
            ? lastElement.endIndex - 1
            : 1;

          // Append content to the end
          await docs.documents.batchUpdate({
            documentId: documentId,
            requestBody: {
              requests: [
                {
                  insertText: {
                    location: {
                      index: endIndex,
                    },
                    text: `\n${content}`,
                  },
                },
              ],
            },
          });

          const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

          return jsonResult({
            success: true,
            document_id: documentId,
            document_url: docUrl,
            content_added: content,
          });
        } catch (error) {
          return textError(`Error editing Google Doc: ${errorMessage(error)}`);
        }
      }
    );

    // Add comment to GitHub Issue
    server.tool(
      "add_github_issue_comment",
      "Add a comment to a GitHub issue",
      {
        owner: z.string().describe("GitHub username or organization"),
        repo: z.string().describe("Repository name"),
        issueNumber: z.number().int().positive().describe("Issue number"),
        comment: z.string().describe("Comment text to add to the issue"),
      },
      async ({ owner, repo, issueNumber, comment }) => {
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
          return textError(
            "Error: GITHUB_TOKEN not configured in environment variables"
          );
        }

        try {
          const response = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(
              owner
            )}/${encodeURIComponent(repo)}/issues/${issueNumber}/comments`,
            {
              method: "POST",
              headers: {
                ...githubHeaders(token),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                body: comment,
              }),
            }
          );

          if (!response.ok) {
            const error = await response.text();
            return textError(
              `GitHub API Error (${response.status}): ${error}`
            );
          }

          const commentData: {
            id: number;
            html_url: string;
            created_at: string;
          } = await response.json();

          return jsonResult({
            success: true,
            comment_id: commentData.id,
            comment_url: commentData.html_url,
            issue_url: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
            created_at: commentData.created_at,
          });
        } catch (error) {
          return textError(
            `Error adding comment to GitHub issue: ${errorMessage(error)}`
          );
        }
      }
    );
  },
  {
    capabilities: {
      tools: {
        echo: {
          description: "Echo a message",
        },
        list_github_issues: {
          description: "List open issues from a GitHub repository",
        },
        get_oura_stress_recovery: {
          description:
            "Get stress and recovery indicators from OURA for the last N days",
        },
        create_google_doc_for_issue: {
          description:
            "Create a Google Doc for a GitHub issue with repo and issue details",
        },
        edit_google_doc: {
          description: "Append content to an existing Google Doc",
        },
        add_github_issue_comment: {
          description: "Add a comment to a GitHub issue",
        },
      },
    },
  },
  {
    // Must match the directory holding the [transport] segment.
    basePath: "/mcp",
    verboseLogs: true,
    maxDuration: 60,
    // The SSE transport requires Redis to relay messages between the
    // /sse and /message requests. Without it, mcp-handler throws
    // "redisUrl is required" as an unhandled rejection and takes the
    // process down, so only advertise SSE when Redis is configured.
    disableSse: !process.env.REDIS_URL,
    redisUrl: process.env.REDIS_URL,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
