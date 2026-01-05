# Google OAuth2 Setup for User Authentication

## Step 1: Create OAuth2 Credentials in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `fine-jetty-475418-t4`
3. Go to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. Application type: **Desktop app**
6. Name: `MCP Server Desktop Client`
7. Click **CREATE**
8. **Download the JSON** or copy the Client ID and Client Secret

## Step 2: Get a Refresh Token

Run this script to get your refresh token:

```javascript
// save as get-refresh-token.mjs
import { google } from "googleapis";
import http from "http";
import { URL } from "url";

const CLIENT_ID = "YOUR_CLIENT_ID";
const CLIENT_SECRET = "YOUR_CLIENT_SECRET";
const REDIRECT_URI = "http://localhost:3000/oauth2callback";

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const scopes = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.file",
];

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
  prompt: "consent", // Force consent to get refresh token
});

console.log("Open this URL in your browser:");
console.log(url);
console.log("\nWaiting for authorization...");

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/oauth2callback")) {
    const qs = new URL(req.url, "http://localhost:3000").searchParams;
    const code = qs.get("code");

    res.end("Authorization successful! You can close this window.");

    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log("\n✅ Success! Add these to your .env.local:");
      console.log(`GOOGLE_CLIENT_ID="${CLIENT_ID}"`);
      console.log(`GOOGLE_CLIENT_SECRET="${CLIENT_SECRET}"`);
      console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);

      server.close();
      process.exit(0);
    } catch (error) {
      console.error("Error getting tokens:", error);
      server.close();
      process.exit(1);
    }
  }
});

server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
```

## Step 3: Run the Script

```bash
node get-refresh-token.mjs
```

1. Open the URL in your browser
2. Sign in with your Google account
3. Grant permissions
4. Copy the output values to `.env.local`

## Step 4: Update .env.local

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REFRESH_TOKEN="your-refresh-token"
GOOGLE_DRIVE_FOLDER_ID="1-4hSHd4gJoPKm3EEZfCuoP8hWJu_Xd0y"
```

## Done!

Now documents will be created in **your own Google Drive** using **your storage quota**, and you'll have full access to them.
