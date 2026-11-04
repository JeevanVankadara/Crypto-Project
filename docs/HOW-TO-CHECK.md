# ABE check in simple steps

For the complete demonstration, follow [PRESENTATION-GUIDE.md](PRESENTATION-GUIDE.md).

1. Start MongoDB with `npm.cmd run db:start`, then run `npm.cmd start`.
2. Open http://127.0.0.1:3000 and sign in as CSE faculty. Password: `DemoGrades!2026`.
3. Open Our ABE approach. Select Student A, enter a title, select semester 5 and the sample PDF from `server-data/sample-grade-sheets`.
4. Click Encrypt locally & upload. Expect an encrypted-upload success message and a new record.
5. Choose `C:\Users\jeeva\AppData\Local\SecureAcademicSharing\abe-user-keys\student-a.key.json` in Attribute key. Click Decrypt PDF. Expect success and a readable PDF download.
6. Load `student-b.key.json` from the same folder and try that record. Expect decryption failure. Try `faculty-cse.key.json` for success or `faculty-ece.key.json` for failure.
7. Click Forget key when done. Reloading or leaving the page also forgets the in-memory key.
8. Open http://127.0.0.1:3000/comparison.html for measured charts and the faculty demonstration outline.

## Where to look

- ABE encrypted files: `C:\Users\jeeva\OneDrive\Desktop\Crypto-project\Crypto-Project\server-data\abe-encrypted-files`.
- Normal encrypted files: the sibling `encrypted-files` folder.
- Sample PDFs: the sibling `sample-grade-sheets` folder. These are intentionally readable fictional examples.
- MongoDB: `mongodb://127.0.0.1:27017`, database `academic_sharing_baseline`. Inspect `users`, `gradesheets`, `abegradesheets`, `auditevents`, `sessions` in MongoDB Compass.
- MongoDB physical files: `C:\Users\jeeva\AppData\Local\SecureAcademicSharing\mongodb-data`.
- Private keys: AppData `SecureAcademicSharing/abe-user-keys`; authority secret: `abe-authority/master.json`. Never put secrets in the publicly served `public` folder.

ABE package JSON contains public policy information, encrypted key material and encrypted PDF bytes. It should not contain readable grades. The web server logs ciphertext transfers; it does not know whether local decryption succeeded.

## Reproduce checks and results

With local MongoDB running: `npm.cmd test` runs 17 Node tests including real ABE integration. `npm.cmd run abe:build` runs the Go cryptographic tests and builds the modules. `npm.cmd run benchmark` regenerates the comparison data; reload the comparison page afterward.

## Troubleshooting

- Site unavailable: run the two start commands and keep the terminal open.
- Database connection refused: run `npm.cmd run db:start` again.
- ABE not initialized: after `seed` and `abe:build`, run `npm.cmd run abe:setup`.
- Missing WebAssembly: run `npm.cmd run abe:build`, then reload the page.
- “Load your issued attribute key first”: select a user `.key.json` file again after navigation.
- Decryption failure: use the correct user's original issued key and the unmodified package. Do not regenerate authority keys to fix old files.
- Switch account: click Switch account, then Sign out on the normal page and log in again.

All grade sheets and identities in the demo are synthetic. This prototype is not ready for real university records.
