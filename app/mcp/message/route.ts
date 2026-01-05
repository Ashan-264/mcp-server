import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { google } from "googleapis";

// StreamableHttp server
const handler = createMcpHandler(
  async (server) => {
    // Echo tool
    server.tool(
      "echo",
      "Echo a message",
      {
        message: z.string(),
      },
      async ({ message }) => ({
        content: [{ type: "text", text: `Tool echo: ${message}` }],
      })
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
          return {
            content: [
              {
                type: "text",
                text: "Error: GITHUB_TOKEN not configured in environment variables",
              },
            ],
            isError: true,
          };
        }

        try {
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
              },
            }
          );

          if (!response.ok) {
            const error = await response.text();
            return {
              content: [
                {
                  type: "text",
                  text: `GitHub API Error (${response.status}): ${error}`,
                },
              ],
              isError: true,
            };
          }

          const issues = await response.json();

          // Filter out pull requests (they appear in issues endpoint too)
          const actualIssues = issues.filter(
            (issue: any) => !issue.pull_request
          );

          if (actualIssues.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No open issues found in ${owner}/${repo}`,
                },
              ],
            };
          }

          // Format issues
          const formattedIssues = actualIssues.map((issue: any) => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            labels: issue.labels.map((label: any) => label.name),
            assignees: issue.assignees.map((assignee: any) => assignee.login),
            url: issue.html_url,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(formattedIssues, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching issues: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
        }
      }
    );

    // OURA Stress and Recovery tool
    server.tool(
      "get_oura_stress_recovery",
      "Get stress and recovery indicators from OURA for the last 7 days",
      {
        days: z
          .number()
          .optional()
          .describe("Number of days to retrieve (default: 7, max: 30)"),
      },
      async ({ days = 7 }) => {
        const token = process.env.OURA_API_TOKEN;

        if (!token) {
          return {
            content: [
              {
                type: "text",
                text: "Error: OURA_API_TOKEN not configured in environment variables",
              },
            ],
            isError: true,
          };
        }

        try {
          // Calculate date range (last N days)
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - Math.min(days, 30));

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
            return {
              content: [
                {
                  type: "text",
                  text: `OURA API Error (${response.status}): ${error}`,
                },
              ],
              isError: true,
            };
          }

          const data = await response.json();

          if (!data.data || data.data.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No stress/recovery data found for the last ${days} days`,
                },
              ],
            };
          }

          // Format the data
          const formattedData = data.data.map((entry: any) => ({
            date: entry.day,
            stress_high: entry.stress_high,
            recovery_high: entry.recovery_high,
            day_summary: entry.day_summary,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    period: `${formatDate(startDate)} to ${formatDate(
                      endDate
                    )}`,
                    total_days: formattedData.length,
                    data: formattedData,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching OURA data: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
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
        issueNumber: z.number().describe("Issue number"),
      },
      async ({ owner, repo, issueNumber }) => {
        const githubToken = process.env.GITHUB_TOKEN;
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        if (!githubToken) {
          return {
            content: [
              {
                type: "text",
                text: "Error: GITHUB_TOKEN not configured",
              },
            ],
            isError: true,
          };
        }

        if (!googleClientId || !googleClientSecret || !googleRefreshToken) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Google OAuth2 credentials not configured. Need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env.local",
              },
            ],
            isError: true,
          };
        }

        try {
          // Fetch issue details from GitHub
          const issueResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
            {
              headers: {
                Authorization: `Bearer ${githubToken}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
              },
            }
          );

          if (!issueResponse.ok) {
            const error = await issueResponse.text();
            return {
              content: [
                {
                  type: "text",
                  text: `GitHub API Error (${issueResponse.status}): ${error}`,
                },
              ],
              isError: true,
            };
          }

          const issue = await issueResponse.json();

          // Setup Google OAuth2 Client
          console.log("Setting up Google OAuth2...");
          const oauth2Client = new google.auth.OAuth2(
            googleClientId,
            googleClientSecret,
            "http://localhost" // Redirect URI (not used for refresh token flow)
          );

          // Set refresh token to get access tokens automatically
          oauth2Client.setCredentials({
            refresh_token: googleRefreshToken,
          });

          console.log("OAuth2 client configured with refresh token");

          const docs = google.docs({ version: "v1", auth: oauth2Client });
          const drive = google.drive({ version: "v3", auth: oauth2Client });

          // Create document title
          const docTitle = `${repo} - Issue #${issueNumber}: ${issue.title}`;

          console.log(`Creating document via Drive API: ${docTitle}`);
          console.log(`Using folder ID: ${folderId || "(none - root folder)"}`);
          console.log(`Using user's Google account (OAuth2)`);

          // Create the document using Drive API (which respects drive.file scope)
          let createResponse;
          try {
            console.log(`Attempting to create document...`);
            createResponse = await drive.files.create({
              requestBody: {
                name: docTitle,
                mimeType: "application/vnd.google-apps.document",
                ...(folderId && { parents: [folderId] }),
              },
              fields: "id",
              supportsAllDrives: true,
              supportsTeamDrives: true,
            });
            console.log(`Document creation API call succeeded`);
          } catch (createError) {
            console.error("Document creation failed:");
            console.error(createError.stack || createError);
            throw createError;
          }

          const documentId = createResponse.data.id;
          console.log(`Document created with ID: ${documentId}`);

          if (!documentId) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: Failed to create document",
                },
              ],
              isError: true,
            };
          }

          // Add content to the document
          await docs.documents.batchUpdate({
            documentId: documentId,
            requestBody: {
              requests: [
                {
                  insertText: {
                    location: {
                      index: 1,
                    },
                    text: `Issue Details: ${issue.html_url}\n`,
                  },
                },
              ],
            },
          });

          const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    document_id: documentId,
                    document_url: docUrl,
                    title: docTitle,
                    issue_url: issue.html_url,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error creating Google Doc: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
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
          return {
            content: [
              {
                type: "text",
                text: "Error: Google OAuth2 credentials not configured. Need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env.local",
              },
            ],
            isError: true,
          };
        }

        try {
          // Setup Google OAuth2 Client
          const oauth2Client = new google.auth.OAuth2(
            googleClientId,
            googleClientSecret,
            "http://localhost"
          );

          oauth2Client.setCredentials({
            refresh_token: googleRefreshToken,
          });

          const docs = google.docs({ version: "v1", auth: oauth2Client });

          // Get the document to find the end index
          const doc = await docs.documents.get({
            documentId: documentId,
          });

          if (!doc.data.body?.content) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: Could not read document content",
                },
              ],
              isError: true,
            };
          }

          // Find the last index in the document (end of content)
          const lastElement =
            doc.data.body.content[doc.data.body.content.length - 1];
          const endIndex = lastElement.endIndex ? lastElement.endIndex - 1 : 1;

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

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    document_id: documentId,
                    document_url: docUrl,
                    content_added: content,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error editing Google Doc: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
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
        issueNumber: z.number().describe("Issue number"),
        comment: z.string().describe("Comment text to add to the issue"),
      },
      async ({ owner, repo, issueNumber, comment }) => {
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
          return {
            content: [
              {
                type: "text",
                text: "Error: GITHUB_TOKEN not configured in environment variables",
              },
            ],
            isError: true,
          };
        }

        try {
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                body: comment,
              }),
            }
          );

          if (!response.ok) {
            const error = await response.text();
            return {
              content: [
                {
                  type: "text",
                  text: `GitHub API Error (${response.status}): ${error}`,
                },
              ],
              isError: true,
            };
          }

          const commentData = await response.json();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    comment_id: commentData.id,
                    comment_url: commentData.html_url,
                    issue_url: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
                    created_at: commentData.created_at,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error adding comment to GitHub issue: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
            isError: true,
          };
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
            "Get stress and recovery indicators from OURA for the last 7 days",
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
    basePath: "/mcp",
    verboseLogs: true,
    maxDuration: 60,
    disableSse: false,
    redisUrl: process.env.REDIS_URL,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
