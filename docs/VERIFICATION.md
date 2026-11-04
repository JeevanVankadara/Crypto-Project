# Verification performed

The implementation was checked against a real local MongoDB Community instance. No in-memory database substitute was used.

## Automated checks

`npm.cmd test` passed all 13 reported tests, with no failures or skipped tests. The suite includes:

- Correct file encryption/decryption and a different nonce for repeated encryption.
- Rejection of modified ciphertext, a wrong key, and a swapped file identity.
- Rejection of anonymous downloads, missing CSRF tokens, incorrect passwords, and object-valued login input.
- Ignoring a forged role/student ID supplied at login.
- Filtering lists by student ownership and faculty department.
- Exact original PDF bytes returned to the owner and permitted faculty.
- Denial of copied file IDs for the wrong student or faculty department.
- Faculty upload persistence in MongoDB and encrypted local storage.
- Denial of student uploads, cross-department uploads, non-PDF files, and files over 5 MB.
- Tampered-file rejection without releasing a PDF.
- Rejection of an unrelated request origin and invalidation of logged-out sessions.
- Persistence of files, keys, and sessions after restarting Express.

Tests use a uniquely named `academic_sharing_test_*` database and a temporary storage directory. The demo database is preserved.

## Manual browser checks

- CSE faculty signed in and saw the seeded grade sheets.
- Uploaded a fictional PDF as `Browser demo grade sheet`; it appeared in the list.
- Student B saw only their own sheet.
- Student B requested Student A's copied file ID and received an access denial.
- The denial appeared in Student B's activity log.
- Student B downloaded their own PDF successfully.
- Reviewed desktop and phone-sized layouts.
- Rendered and inspected the generated one-page sample grade sheet.

Re-running `npm.cmd run seed` preserved the four demo accounts and three existing records (two seeded sheets and the browser-uploaded example). `npm.cmd run inspect` confirmed ciphertext on disk and metadata in MongoDB without exposing secrets.

The portable MongoDB stop/start helpers were also exercised. All four accounts and three records survived a full database-process restart.

File storage was subsequently moved into the server project under `server-data/encrypted-files` and `server-data/sample-grade-sheets`. The matching encryption key and MongoDB engine files retain their existing AppData locations.

The saved [denied-access screenshot](screenshots/denied-access.jpg) shows an actual browser check. These checks verify the phase-2 baseline; they do not evaluate ABE or claim production readiness.
