import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  html_url: string;
}

// GitHub Issues MCP Server
const handler = createMcpHandler(
  async (server) => {
    server.tool(
      "list_github_issues",
      "Get a list of open issues from a GitHub repository",
      {
        owner: z.string().describe("GitHub account/organization name"),
        repo: z.string().describe("Repository name"),
      },
      async ({ owner, repo }) => {
        const token = process.env.GITHUB_TOKEN;
        
        if (!token) {
          return {
            content: [
              {
                type: "text",
                text: "Error: GITHUB_TOKEN environment variable is not set",
              },
            ],
            isError: true,
          };
        }

        try {
          // Fetch open issues from GitHub API
          const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/issues?state=open`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "MCP-Server",
              },
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            return {
              content: [
                {
                  type: "text",
                  text: `GitHub API Error (${response.status}): ${errorText}`,
                },
              ],
              isError: true,
            };
          }

          const issues: GitHubIssue[] = await response.json();

          // Filter out pull requests (they appear in issues endpoint)
          const actualIssues = issues.filter(
            (issue) => !("pull_request" in issue)
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

          // Format the issues
          const issueList = actualIssues.map((issue) => {
            const labels = issue.labels.map((label) => label.name).join(", ");
            const assignees = issue.assignees
              .map((assignee) => assignee.login)
              .join(", ");

            return {
              number: issue.number,
              title: issue.title,
              state: issue.state,
              labels: labels || "none",
              assignees: assignees || "unassigned",
              url: issue.html_url,
            };
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    repository: `${owner}/${repo}`,
                    total_issues: issueList.length,
                    issues: issueList,
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
                text: `Error fetching issues: ${error instanceof Error ? error.message : String(error)}`,
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
        list_github_issues: {
          description: "Get a list of open issues from a GitHub repository",
        },
      },
    },
  },
  {
    basePath: "/mcp/github-issues",
    verboseLogs: true,
    maxDuration: 60,
    disableSse: false,
    redisUrl: process.env.REDIS_URL,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
