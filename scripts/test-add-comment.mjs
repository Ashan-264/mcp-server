import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const args = process.argv.slice(2);
if (args.length < 4) {
  console.log(
    "Usage: node test-add-comment.mjs <mcp-url> <owner> <repo> <issue-number> [comment]"
  );
  console.log(
    "Example: node test-add-comment.mjs http://localhost:3000/mcp Ashan-264 FatigueSense 1 'Test comment'"
  );
  process.exit(1);
}

const [
  mcpUrl,
  owner,
  repo,
  issueNumberStr,
  comment = "Test comment added at " + new Date().toISOString(),
] = args;
const issueNumber = parseInt(issueNumberStr, 10);

if (isNaN(issueNumber)) {
  console.error("❌ Issue number must be a valid integer");
  process.exit(1);
}

async function main() {
  console.log("🔌 Connecting to MCP server...");
  const transport = new SSEClientTransport(new URL(`${mcpUrl}/sse`));
  const client = new Client(
    {
      name: "test-add-comment-client",
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

  await client.connect(transport);
  console.log("✓ Connected!\n");

  // List available tools
  const toolsList = await client.listTools();
  console.log(
    `📋 Available tools: ${toolsList.tools.map((t) => t.name).join(", ")}\n`
  );

  console.log(`💬 Adding comment to ${owner}/${repo}#${issueNumber}...`);
  console.log(`📄 Comment: "${comment}"\n`);

  try {
    const result = await client.callTool({
      name: "add_github_issue_comment",
      arguments: {
        owner,
        repo,
        issueNumber,
        comment,
      },
    });

    console.log("✨ Comment added successfully!");
    console.log(JSON.parse(result.content[0].text));
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  await client.close();
  console.log("\n✓ Done!");
}

main().catch(console.error);
