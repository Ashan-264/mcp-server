import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const origin = process.argv[2] || "http://localhost:3000";
const owner = process.argv[3];
const repo = process.argv[4];
const issueNumber = process.argv[5];

async function main() {
  if (!owner || !repo || !issueNumber) {
    console.error(
      "Usage: node test-google-doc.mjs <base-url> <owner> <repo> <issue-number>"
    );
    console.error(
      "Example: node test-google-doc.mjs http://localhost:3000/mcp Ashan-264 FatigueSense 1"
    );
    process.exit(1);
  }

  const transport = new SSEClientTransport(new URL(`${origin}/sse`));

  const client = new Client(
    {
      name: "google-doc-client",
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

  // Create Google Doc for issue
  console.log(
    `\n📝 Creating Google Doc for ${owner}/${repo} issue #${issueNumber}...`
  );
  const result = await client.callTool({
    name: "create_google_doc_for_issue",
    arguments: {
      owner: owner,
      repo: repo,
      issueNumber: parseInt(issueNumber),
    },
  });

  console.log("\n✨ Result:");
  console.log(result.content[0].text);

  await client.close();
  console.log("\n✓ Done!");
}

main().catch(console.error);
