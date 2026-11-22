<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ad594be4-174f-435c-942e-584686566e0f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install --legacy-peer-deps`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

The local desktop-style preview opens at `http://localhost:4173` by default.
Set `PORT=3000` if you specifically need the old port.

### Windows PowerShell

Run the command from this project folder. If PowerShell blocks `npm.ps1`, use
the Windows command shim instead:

```powershell
cd C:\Users\me403\Desktop\novyra-net
npm.cmd run dev
```

You can also double-click `start-dev.cmd` in the project folder.
