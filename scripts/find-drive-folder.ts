import { google } from "googleapis";
import { getGoogleAuth, ALL_GOOGLE_SCOPES } from "../lib/google/google-auth";

async function main() {
  const name = process.argv[2] ?? "Impackt1_App";
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  const drive = google.drive({ version: "v3", auth });
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: "files(id,name,parents,webViewLink)",
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  console.log(JSON.stringify(res.data.files, null, 2));
}

main().catch(console.error);
