> The sections below describe the normal baseline. The completed ABE design is documented in PROJECT-REPORT.md and PRESENTATION-GUIDE.md.

# Database and storage

Default connection: `mongodb://127.0.0.1:27017/academic_sharing_baseline`. This is local MongoDB; the configuration rejects remote database hosts.

| Collection | Main fields | Purpose |
| --- | --- | --- |
| `users` | name, email, passwordHash, role, department, studentId | Identity and access attributes |
| `gradesheets` | fileId, studentId, department, semester, title, originalName, sizeBytes, uploadedBy, timestamps | Describes encrypted PDFs |
| `auditevents` | actorId, actorName, department, action, outcome, fileId, detail, timestamps | Records signed-in user actions |
| `sessions` | Session ID, session data, expiry | Persistent sign-in; expired records are removed by MongoDB |

Emails are unique. Student IDs are unique among student accounts. Each sheet has a unique random file UUID. Multiple sheets may belong to one student/semester to allow revised uploads. A seeded sheet has a `demoKey` so repeat seeding does not duplicate it.

Passwords are salted and hashed with scrypt. Hashes are excluded from normal queries and never returned by the API, but are stored in MongoDB for verification.

## File storage

The Express project's `server-data/encrypted-files/<fileId>.enc` contains the version, algorithm, nonce, authentication tag, and ciphertext. The key remains in `%LOCALAPPDATA%/SecureAcademicSharing/server-secrets/secrets.json`. The nonce/tag do not need to be secret. No user-provided filename determines the stored file path. The server-data folder is ignored by Git and is not publicly served by Express.

`gradesheets` contains student identifiers and descriptions, but no marks, plaintext PDF, or AES key. Metadata and sessions are readable to someone with local MongoDB access; file encryption does not encrypt these collections.

## MongoDB's own storage

The project's portable server uses `%LOCALAPPDATA%\SecureAcademicSharing\mongodb-data`. If you reuse an existing MongoDB service, its configured data directory is unchanged. Do not edit MongoDB's internal database files directly; use Compass or `npm.cmd run inspect`.

`APP_DATA_DIR` can change the application's file-storage root; the default is `server-data` inside the server project. This setting does not relocate the server key or MongoDB's engine files. Moving encrypted files requires retaining the corresponding server key. Pointing at a new empty directory does not migrate existing data automatically.

## Inspect

`npm.cmd run inspect` prints selected metadata and encrypted-file properties without exposing hashes, sessions, or keys. Alternatively, connect MongoDB Compass to `mongodb://127.0.0.1:27017` and open `academic_sharing_baseline`.

This educational setup binds MongoDB to loopback and uses no database authentication. Use fictional data. The server's possession of the AES key is an intentional baseline limitation to compare with ABE later.
