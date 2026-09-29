import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const origin = process.argv[2] || "http://localhost:3000/mcp";
const days = process.argv[3] ? parseInt(process.argv[3]) : 7;

async function main() {
  const transport = new SSEClientTransport(new URL(`${origin}/sse`));

  const client = new Client(
    {
      name: "oura-client",
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

  // Call the OURA stress/recovery tool
  console.log(
    `\n💍 Fetching OURA stress/recovery data for last ${days} days...`
  );
  const result = await client.callTool({
    name: "get_oura_stress_recovery",
    arguments: {
      days: days,
    },
  });

  console.log("\n✨ OURA Data:");
  console.log(result.content[0].text);

  await client.close();
  console.log("\n✓ Done!");
}

main().catch(console.error);
