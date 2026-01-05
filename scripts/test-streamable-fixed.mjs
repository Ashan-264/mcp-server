import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const origin = process.argv[2] || "http://localhost:3000";

async function main() {
  // Create transport with custom fetch that adds required headers
  const transport = new StreamableHTTPClientTransport(
    new URL(`${origin}/mcp`),
    {
      fetch: async (url, init) => {
        return fetch(url, {
          ...init,
          headers: {
            ...init.headers,
            Accept: "application/json, text/event-stream",
          },
        });
      },
    }
  );

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

  console.log("Connected!", client.getServerCapabilities());

  const result = await client.listTools();
  console.log("Available tools:", result);

  await client.close();
}

main().catch(console.error);
