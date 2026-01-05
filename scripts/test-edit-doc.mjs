import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log(
    "Usage: node test-edit-doc.mjs <mcp-url> <document-id> [content]"
  );
  console.log(
    "Example: node test-edit-doc.mjs http://localhost:3000/mcp abc123def456 'New content to add'"
  );
  process.exit(1);
}

const [
  mcpUrl,
  documentId,
  content = "Test content added at " + new Date().toISOString(),
] = args;

async function main() {
  console.log("🔌 Connecting to MCP server...");
  const transport = new SSEClientTransport(new URL(`${mcpUrl}/sse`));
  const client = new Client(
    {
      name: "test-edit-doc-client",
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

  console.log(`📝 Editing document: ${documentId}...`);
  console.log(`📄 Content to add: "${content}"\n`);

  try {
    const result = await client.callTool({
      name: "edit_google_doc",
      arguments: {
        documentId,
        content,
      },
    });

    console.log("✨ Document edited successfully!");
    console.log(JSON.parse(result.content[0].text));
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  await client.close();
  console.log("\n✓ Done!");
}

main().catch(console.error);
