import { google } from "googleapis";
import { getGoogleAuth, ALL_GOOGLE_SCOPES } from "../lib/google/google-auth";
import { getDriveFolderId } from "../lib/sheet-config";

async function main() {
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  const drive = google.drive({ version: "v3", auth });
  const folderId = getDriveFolderId();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType)",
    pageSize: 20,
  });
  console.log(JSON.stringify(res.data.files, null, 2));
}

main().catch(console.error);
