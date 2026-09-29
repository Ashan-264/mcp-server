import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const origin = process.argv[2] || "http://localhost:3000/mcp";

async function main() {
  // Create transport with custom fetch that adds required headers
  const transport = new StreamableHTTPClientTransport(
    new URL(`${origin}/mcp`),
    {
      fetch: async (url, init) => {
        // init.headers may be a Headers instance, a string[][], or a plain
        // object. Spreading a Headers instance yields {} and silently drops
        // every header, so normalize through Headers instead.
        const headers = new Headers(init?.headers);
        headers.set("Accept", "application/json, text/event-stream");
        return fetch(url, { ...init, headers });
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
