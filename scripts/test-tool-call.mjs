import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const origin = process.argv[2] || "http://localhost:3000/mcp";

async function main() {
  const transport = new SSEClientTransport(new URL(`${origin}/sse`));

  const client = new Client(
    {
      name: "example-client",
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

  console.log("Connecting to", origin);
  await client.connect(transport);

  console.log("✓ Connected!");

  // List available tools
  const tools = await client.listTools();
  console.log(
    "\n📋 Available tools:",
    tools.tools.map((t) => t.name).join(", ")
  );

  // Call the echo tool
  console.log("\n🔧 Calling echo tool with message: 'Hello from MCP!'");
  const result = await client.callTool({
    name: "echo",
    arguments: {
      message: "Hello from MCP!",
    },
  });

  console.log("\n✨ Tool response:");
  console.log(JSON.stringify(result, null, 2));

  await client.close();
  console.log("\n✓ Done!");
}

main().catch(console.error);
