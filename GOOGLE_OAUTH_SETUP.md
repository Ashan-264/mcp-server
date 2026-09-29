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

The repo ships this script at `scripts/get-refresh-token.mjs`. It prompts for
your Client ID and Secret, opens a local callback server on port 3001 (port
3000 is left free for `next dev`), and prints the values for `.env.local`.

## Step 3: Run the Script

```bash
node scripts/get-refresh-token.mjs
```

1. Paste your Client ID and Client Secret when prompted
2. Open the printed URL in your browser
3. Sign in with your Google account and grant permissions
4. Copy the output values to `.env.local`

> The OAuth client's **Authorized redirect URI** must include
> `http://localhost:3001/oauth2callback`.

## Step 4: Update .env.local

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REFRESH_TOKEN="your-refresh-token"
GOOGLE_DRIVE_FOLDER_ID="1-4hSHd4gJoPKm3EEZfCuoP8hWJu_Xd0y"
```

## Done!

Now documents will be created in **your own Google Drive** using **your storage quota**, and you'll have full access to them.
