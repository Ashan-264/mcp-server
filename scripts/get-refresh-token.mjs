import { google } from "googleapis";
import http from "http";
import { URL } from "url";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log("🔐 Google OAuth2 Refresh Token Generator\n");

  const CLIENT_ID = await question("Enter your Google Client ID: ");
  const CLIENT_SECRET = await question("Enter your Google Client Secret: ");

  const REDIRECT_URI = "http://localhost:3001/oauth2callback";

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID.trim(),
    CLIENT_SECRET.trim(),
    REDIRECT_URI
  );

  const scopes = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive.file",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  console.log("\n📋 Open this URL in your browser:");
  console.log(url);
  console.log("\n⏳ Waiting for authorization...\n");

  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith("/oauth2callback")) {
      const qs = new URL(req.url, "http://localhost:3001").searchParams;
      const code = qs.get("code");
      const authError = qs.get("error");

      // Consent denied, or Google redirected back without a code.
      if (authError || !code) {
        const reason = authError || "no authorization code was returned";
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1 style="color: #E53935;">❌ Authorization Failed</h1>
            <p>${reason}</p>
          </body>
        </html>
      `);
        console.error(`❌ Authorization failed: ${reason}`);
        server.close();
        rl.close();
        process.exit(1);
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1 style="color: #4CAF50;">✅ Authorization Successful!</h1>
            <p>You can close this window and return to the terminal.</p>
          </body>
        </html>
      `);

      try {
        const { tokens } = await oauth2Client.getToken(code);

        // Google only returns a refresh token on the first consent for a
        // client; without one the .env.local value would read "undefined".
        if (!tokens.refresh_token) {
          console.error(
            "❌ No refresh token returned. Revoke this app's access at " +
              "https://myaccount.google.com/permissions and run this script again."
          );
          server.close();
          rl.close();
          process.exit(1);
          return;
        }

        console.log("✅ Success! Add these to your .env.local:\n");
        console.log(`GOOGLE_CLIENT_ID="${CLIENT_ID.trim()}"`);
        console.log(`GOOGLE_CLIENT_SECRET="${CLIENT_SECRET.trim()}"`);
        console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
        console.log("\n");

        server.close();
        rl.close();
        process.exit(0);
      } catch (error) {
        console.error("❌ Error getting tokens:", error.message);
        server.close();
        rl.close();
        process.exit(1);
      }
    }
  });

  server.listen(3001, () => {
    console.log("🌐 Server listening on http://localhost:3001");
  });
}

main().catch((error) => {
  console.error("Error:", error);
  rl.close();
  process.exit(1);
});
