# How to check the project

## Start

In PowerShell inside the project folder, run `npm.cmd run db:start`, then `npm.cmd start`. Open http://127.0.0.1:3000. Leave this terminal open and use a second terminal for tests/inspection.

## 1. Faculty access

Click **CSE faculty**, then **Sign in**. You should see sheets for `23CS101` and `23CS102`, plus any uploaded examples. A `Browser demo grade sheet` record was added during interface verification. Download a sheet: it should be a readable PDF with fictional grades. The server approved your request and decrypted the stored file with its own AES key.

## 2. Student privacy

As faculty, click **Copy ID** next to `23CS101`. Sign out and sign in as **Student B**. Only `23CS102` should appear. Paste the copied ID into **Try a grade-sheet ID** and click **Check & download**. Expect **Access denied** and no PDF. Open **Activity log** to see the denial.

Sign in as **Student A** and try the same ID. It should succeed.

Tabs in one browser share a sign-in cookie. For the simplest demo, sign out before switching accounts. Use separate browser profiles/private windows if you need simultaneous users.

## 3. Department restriction

Sign in as **ECE faculty**. Its list is empty. Paste a CSE file ID into the access test. The server should deny it despite this account being faculty. The current rule permits all faculty in the sheet's department; it does not limit access to a particular course instructor.

## 4. Upload a new grade sheet

As **CSE faculty**, use **Add a grade sheet**:

1. Choose student `23CS101` or `23CS102`.
2. Enter a title such as `Semester 5 updated grade sheet`.
3. Choose semester `5`.
4. Select the corresponding fictional PDF from `server-data\sample-grade-sheets` inside the project folder.
5. Click **Encrypt & upload**.

Expect success and a new record. Sign in as the selected student to download it. Uploads create new records; they do not overwrite old sheets. The uploader must select the correct PDF: this prototype does not read the printed student name to check it against the selected account.

## 5. Inspect encrypted files

In your second terminal, run:

```powershell
npm.cmd run inspect
```

It prints metadata, file IDs, and storage paths without printing secrets. Open the project's `server-data\encrypted-files` folder. Files have random IDs and the `.enc` extension. In a text editor, you will see the format, nonce, authentication tag, and encoded ciphertext, not readable grades. The nonce and tag are public encryption parameters; the key remains in AppData.

`sample-grade-sheets` intentionally holds readable fictional PDFs for uploads. Downloaded PDFs are also readable after authorized decryption. Those are different from the encrypted storage files.

## 6. Inspect MongoDB

If MongoDB Compass is available, connect to `mongodb://127.0.0.1:27017` and open `academic_sharing_baseline`. Inspect `users`, `gradesheets`, `auditevents`, and `sessions`. Compass is optional: `npm.cmd run inspect` is enough for this demonstration.

Explain: "MongoDB holds the records describing each file. The encrypted PDF itself is on disk."

## 7. Restart and run tests

Stop Express with `Ctrl+C`, then run `npm.cmd start` again. The same files should remain downloadable. Sessions persist for up to two hours, so you may still be signed in.

Run `npm.cmd test`. It uses a real local MongoDB database with a unique test name, separate from demo data. All tests should pass. Tests cover denied direct requests, forged roles, upload validation, modified ciphertext, and app restarts. Use these isolated tests for tampering; do not damage your demo files.

## Explain the work to faculty

"We completed the grade-sheet scenario and the existing server-controlled approach. Faculty upload encrypted records; students get their own records; faculty access is restricted by department. MongoDB stores metadata and activity logs. The limitation is that the server holds the decryption key. Next we will add attribute-based encryption and compare its security behavior and performance with this baseline."

## Troubleshooting

| Message/problem | Action |
| --- | --- |
| `npm.ps1 cannot be loaded` | Use `npm.cmd` instead of `npm`. |
| `.env not found. Continuing without it.` | Normal: default configuration is being used. |
| MongoDB connection refused | Run `npm.cmd run db:start`; for a new installation, first run `npm.cmd run db:install`. |
| Missing demo accounts/records | Run `npm.cmd run seed`, then reload the page. |
| Port 3000 in use | Use or stop the already-running copy, or set `PORT=3001` in `.env`. |
| Session changed / CSRF error | Reload and sign in again. |
| Server key missing | Restore the original `server-secrets/secrets.json`. A replacement cannot decrypt old files. |
| Upload rejected | Choose a PDF under 5 MB and a student from the faculty member's department. |

Stop Express before running `npm.cmd run db:stop`. The MongoDB helper checks process ownership and refuses to stop an unrelated database process. Stored data is preserved.
