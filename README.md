# Secure Academic Data Sharing Using Attribute-Based Encryption

**Implemented: baseline, real browser CP-ABE, comparison experiments, and demonstration/report documentation.**

The app is called **Academic Vault**. Faculty can upload individual grade-sheet PDFs. Students download only their own sheets; faculty download sheets within their department. Express checks every request, encrypts stored PDFs with AES-256-GCM, and decrypts approved downloads.

The normal approach keeps its AES key on the server. The ABE approach encrypts in the browser with a fresh AES key protected by FAME CP-ABE. Issued attribute keys control local decryption. Start with [the faculty demo guide](docs/PRESENTATION-GUIDE.md) and [the report](docs/PROJECT-REPORT.md).

## Stack

- Node.js 22+ and Express; local MongoDB Community with Mongoose.
- HTML, CSS, and browser JavaScript served by Express.
- Node's built-in crypto: AES-256-GCM for files and scrypt for passwords.
- HTTP-only session cookie; session records in MongoDB.
- Node tests against a real, isolated local MongoDB database.

## Start on this computer

Open PowerShell and run:

```powershell
cd "C:\Users\jeeva\OneDrive\Desktop\Crypto-project\Crypto-Project"
npm.cmd run db:start
npm.cmd start
```

Open **http://127.0.0.1:3000** and keep the terminal open. `Ctrl+C` stops Express. Run `db:start` again if MongoDB stops with the terminal; files persist after stopping.

Dependencies, MongoDB, demo accounts, and two sample records were set up during implementation. On another computer, follow the fresh setup below.

## Fresh setup on Windows

Install Node.js 22 or newer, open PowerShell in the project folder, and run:

```powershell
npm.cmd ci
npm.cmd run db:install
npm.cmd run db:start
npm.cmd run seed
npm.cmd run abe:install
npm.cmd run abe:build
npm.cmd run abe:setup
npm.cmd run benchmark
npm.cmd start
```

`db:install` downloads MongoDB Community 8.0.34 from MongoDB's official server, verifies its SHA-256 checksum, and extracts it under local AppData. It does not install a Windows service. `db:start` starts it hidden and binds it only to `127.0.0.1`. An already-running local MongoDB is reused and left unchanged.

If MongoDB Community is already installed, start its service or set `MONGOD_PATH` in `.env` to its `mongod.exe`. On Linux/macOS, install and run MongoDB normally, then use the same application and seed commands.

The `.env not found. Continuing without it.` message is normal: working defaults are provided. To change settings, copy `.env.example` to `.env`. `npm.cmd` avoids Windows PowerShell execution-policy problems.

## Demo accounts

Every demo account uses **`DemoGrades!2026`**. All names and grades are fictional.

| Account | Email | Access |
| --- | --- | --- |
| CSE faculty — Dr. Maya Rao | `faculty.cse@demo.local` | Upload for CSE students; download CSE sheets |
| Student A — Aarav Sharma | `student.a@demo.local` | Sheets for `23CS101` only |
| Student B — Meera Nair | `student.b@demo.local` | Sheets for `23CS102` only |
| ECE faculty — Dr. Arun Das | `faculty.ece@demo.local` | Cannot download CSE sheets |

Click a demo account on the login page, then **Sign in**. ECE faculty starts with an empty list because the demo has only CSE students.

## Five-minute check

1. Sign in as **CSE faculty**. The two seeded grade sheets should appear, along with any uploaded examples.
2. Download Student A's sheet. Expect a readable PDF.
3. Click **Copy ID** for Student A's sheet and sign out.
4. Sign in as **Student B**. Only Student B's sheet is listed.
5. Paste Student A's ID into **Try a grade-sheet ID** and click **Check & download**. Expect **Access denied**, with no PDF.
6. Open **Activity log** to see the denied request.
7. Sign in as **Student A** and try the same ID. It should download.

Read **[How to check](docs/HOW-TO-CHECK.md)** for upload testing, MongoDB inspection, and a faculty demo script.

## Storage locations

Grade-sheet files are stored inside this Express server project:

```text
C:\Users\jeeva\OneDrive\Desktop\Crypto-project\Crypto-Project\server-data\
  encrypted-files\         Encrypted grade sheets (.enc)
  sample-grade-sheets\      Readable fictional PDFs for testing uploads
```

The encryption key and MongoDB engine files remain in their existing local location:

```text
C:\Users\jeeva\AppData\Local\SecureAcademicSharing\
  server-secrets\           AES key and session-signing secret
  mongodb-data\            MongoDB's own storage files
  mongodb.log              Database process log
  tools\                   Portable MongoDB installation
```

The database is **`academic_sharing_baseline`** at **`mongodb://127.0.0.1:27017`**. Collections: `users`, `gradesheets`, `abegradesheets`, `auditevents`, `sessions`. Grades/PDF contents are stored in encrypted files, not in these collections. Metadata is not ABE-encrypted.

Keep the AppData `server-secrets/secrets.json`: it is needed to decrypt existing files. The application refuses to silently replace a missing key when encrypted records exist. `server-data/` is ignored by Git and is not served as a public static folder. Downloads still require authorization.

## File organization

```text
public/                 Browser HTML, CSS, and JavaScript
src/
  config.js             Runtime paths, port, local MongoDB URI
  db.js                 Database connection
  models/               User, GradeSheet, AuditEvent schemas
  middleware/           Login, faculty, and CSRF checks
  routes/               Authentication and grade-sheet API endpoints
  security/             Access rules, encryption, passwords, server keys
  services/             File storage and audit events
  app.js                Connects Express middleware and routes
  server.js             Starts/stops the web server
scripts/                MongoDB setup, demo seeding, inspection
tests/                  Encryption and MongoDB integration tests
docs/                   Explanations and testing walkthrough
instructions/           Original faculty instructions
```

Start with **[Architecture](docs/ARCHITECTURE.md)**, then `src/security/access.js` and `src/routes/grade-sheets.js`. See **[Database details](docs/DATABASE.md)** for the collections and storage design.

## Useful commands

```powershell
npm.cmd run seed       # Add missing demo users/sheets; preserve existing uploads
npm.cmd run inspect    # Show metadata and storage properties without printing keys
npm.cmd test           # Use a separate, temporary local MongoDB test database
npm.cmd run dev        # Restart Express automatically after backend edits
npm.cmd run format     # Format the source consistently for readability
```

Seeding is repeatable. It does not reset existing passwords or remove records. Tests use unique `academic_sharing_test_*` databases and remove only their own database and temporary storage.

## Current limitations

- This is a local educational prototype with synthetic data and known demo passwords.
- Server checks protect direct download requests; modifying the interface or supplying a forged role does not grant access.
- The server has one AES key, with a fresh nonce per file. A compromised server/key can expose all files. A changed trusted database record can also affect permissions.
- MongoDB metadata and sessions are readable by a local database administrator. This loopback-only demo has no MongoDB authentication.
- Authorized users can retain downloaded PDFs. There is no revocation, self-registration, or cloud deployment. ABE key issuance is a separate administrator command.
- PDF validation checks size, MIME type, and header/footer. It is not a full PDF parser or malware scanner.

The full ABE walkthrough is in [HOW-TO-CHECK](docs/HOW-TO-CHECK.md). The implementation is an educational prototype using GoFE research software, not production-grade cryptography.

## ABE workspace and storage

Open http://127.0.0.1:3000/abe.html after signing in. Comparison charts and the presentation outline are at http://127.0.0.1:3000/comparison.html.

- `server-data/abe-encrypted-files/`: encrypted `.abe.json` grade sheets.
- `server-data/abe/public.json`: public encryption parameters.
- `%LOCALAPPDATA%/SecureAcademicSharing/abe-user-keys/`: issued demo user keys, loaded manually in the browser.
- `%LOCALAPPDATA%/SecureAcademicSharing/abe-authority/master.json`: trusted authority secret; never distribute this file.
- `crypto-helper/`: pinned GoFE FAME implementation wrapper and cryptographic tests.
- `public/abe/`: browser worker, WebAssembly build, and interface.
- `docs/results/`: measured CSV and explanation; `public/results/benchmark.json`: raw results.

`abe:build` creates Go WebAssembly modules. The offline authority runs in Node.js using the approved WASM helper; the web server never invokes key issuance. Keep all original keys: replacing them will make old packages inaccessible. Go is needed only to build; Node runs the authority helper.

This one-laptop demo separates roles logically, not by operating-system permissions. The authority, browser/device, and delivered JavaScript must be trusted. A server that replaces client JavaScript could steal imported keys. Metadata is public. Changing an account role does not revoke an already-issued private key.
