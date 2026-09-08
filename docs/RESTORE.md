# Restore the live gym on new accounts

**Full playbook for a new Cursor agent:** [NEW-ACCOUNT-CUTOVER.md](NEW-ACCOUNT-CUTOVER.md)

That file has the restore-kit file list, table counts, env vars, Google IDs, restore command, and smoke tests.

The dump itself is **not** in git. Copy `backups/prod-2026-09-07/` onto the new machine. A copy of the playbook also sits in that folder as `README-FOR-NEW-CURSOR.md`.

Refresh the dump on the old PC:

```powershell
npx tsx scripts/backup-prod-snapshot.ts
```
