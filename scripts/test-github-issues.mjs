import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const origin = process.argv[2] || "http://localhost:3000/mcp/github-issues";
const owner = process.argv[3];
const repo = process.argv[4];

async function main() {
  if (!owner || !repo) {
    console.error(
      "Usage: node test-github-issues.mjs <base-url> <owner> <repo>"
    );
    console.error(
      "Example: node test-github-issues.mjs http://localhost:3000/mcp/github-issues microsoft vscode"
    );
    process.exit(1);
  }

  const transport = new SSEClientTransport(new URL(`${origin}/sse`));

  const client = new Client(
    {
      name: "github-issues-client",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
      },
    }
  );

  console.log("🔌 Connecting to MCP server...");
  await client.connect(transport);
  console.log("✓ Connected!");

  // List available tools
  const tools = await client.listTools();
  console.log(
    "\n📋 Available tools:",
    tools.tools.map((t) => t.name).join(", ")
  );

  // Call the GitHub issues tool
  console.log(`\n🔍 Fetching open issues from ${owner}/${repo}...`);
  const result = await client.callTool({
    name: "list_github_issues",
    arguments: {
      owner: owner,
      repo: repo,
    },
  });

  console.log("\n✨ Issues found:");
  console.log(result.content[0].text);

  await client.close();
  console.log("\n✓ Done!");
}

main().catch(console.error);
