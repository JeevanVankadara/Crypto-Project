# Presenting the project to faculty

## The explanation to say first

“Our project protects individual student grade sheets. We implemented two approaches using Express, Node.js and local MongoDB. In the normal approach, the server checks permission and decrypts the file. In our proposed approach, the browser encrypts the grade sheet and only an issued key with matching attributes can decrypt it.”

Attribute means a verified property: student ID, department, or faculty role. ABE is like a lock with a rule. The authority gives each person a cryptographic key containing their verified attributes. Typing or editing an attribute name does not create a valid key.

Example rule: `student_23cs101 OR (role_faculty AND dept_cse)`.
Say: “Student 23CS101 can read this sheet, or someone who is both faculty and in CSE.” Student B and ECE faculty do not match.

## Prepare before the demonstration

1. In the project terminal run `npm.cmd run db:start`, then `npm.cmd start`. Keep the terminal open.
2. Open http://127.0.0.1:3000. All demo passwords are `DemoGrades!2026`.
3. Have the sample PDF ready: `server-data/sample-grade-sheets/23CS101-semester-5.pdf` under the project.
4. Have the issued keys ready in `C:\Users\jeeva\AppData\Local\SecureAcademicSharing\abe-user-keys`.
5. Never show or distribute `abe-authority/master.json`. Use only the user key files in the demo.

## Demonstration order (5–7 minutes)

1. **Problem (30 seconds):** “Student A's grades must not be readable by Student B.”
2. **Normal approach (1 minute):** Log in as Student A, download their baseline PDF, copy its ID, sign out and log in as Student B. Try A's ID. The server denies access. Explain that this approach does work, but the server holds the decryption key and must be trusted.
3. **Our approach (1 minute):** Log in as CSE faculty (`faculty.cse@demo.local`). Open Our ABE approach. Select 23CS101, enter a title and semester, select the sample PDF and click Encrypt locally & upload. Point to the policy. Encryption happens before upload.
4. **Matching key (1 minute):** Choose `student-a.key.json` in Attribute key. Click Decrypt PDF. The browser downloads a readable PDF. You can also use `faculty-cse.key.json`.
5. **Wrong key (1 minute):** Choose `student-b.key.json` and click the same Decrypt PDF button. It fails even though the server sends the encrypted package. This deliberately keeps the login unchanged to isolate the effect of the key. Explain that key possession, not the current login label, controls decryption.
6. **Optional copied-ID demonstration:** Copy the ABE file ID. Switch account, sign out on the normal page, sign in as Student B, return to ABE, load B's key, paste the ID and click Fetch & decrypt locally. The encrypted package is available but the PDF cannot be decrypted. Baseline IDs and ABE IDs are separate.
7. **Optional saved-file demonstration:** Download Encrypted package. Select that `.abe.json` under Open a package from your computer. Try B's key, then A's. No upload is needed for this local package operation; load the application/public parameters first.
8. **Results (1 minute):** Open Results & presentation. Show measured times and stored package sizes. Say: “We gained cryptographic access control at the cost of extra computation and key management.”
9. **Limits (30 seconds):** “This is a research prototype on one laptop. We trust the authority and client. Revocation and separate secure client distribution are future work.”

## Normal versus proposed approach

| Point | Normal approach | Our ABE approach |
| --- | --- | --- |
| Rule enforcement | Express checks saved roles and IDs | A valid attribute key must satisfy the encrypted policy |
| PDF encryption/decryption | Server | Browser |
| Storage server holds file decryption key | Yes | No ABE user/master keys are loaded by Express |
| Copied ciphertext alone readable | No | No |
| Consequence of obtaining the normal server AES key | Baseline files can be decrypted | That baseline key cannot decrypt ABE files |
| Overhead | Low | Higher computation, larger packages, authority/key distribution |

The limitation of trusting the server means its administrator/software and decryption key must remain trustworthy. A compromised server/key can reveal baseline PDFs. Do not say the baseline has no encryption or that copying its ciphertext alone reveals grades.

## Likely questions

**Why a website?** It demonstrates the complete workflow: login, encrypt, store, retrieve, decrypt and compare. The cryptographic access rule is the project contribution; the website makes it visible.

**Why AES and ABE together?** AES encrypts the whole PDF efficiently. ABE protects the small, fresh AES key using the policy.

**Where are files and database?** Encrypted files are in the server project's `server-data/abe-encrypted-files`; local MongoDB stores user profiles and file metadata, not plaintext PDF contents. Metadata includes student ID/title and is not confidential under this design.

**Can a user edit their attributes?** Editing JSON labels does not generate the required mathematical key components. The trusted authority issues keys after checking identities.

**Can the server ever steal a key?** Express normally receives no private key. However, a malicious server could serve modified browser JavaScript that steals a key when imported. This demo is not protection from a fully malicious application server or compromised laptop.

**What if someone shares a valid key?** Its holder can use its access. Keep keys private. The four keys being together on one laptop is for demonstration only.

**Can access be revoked?** Not for previously issued keys and existing downloaded packages in this implementation. Key rotation/re-encryption and a revocation design are future work. Previously downloaded plaintext cannot be recalled.

**What is new here?** The integration of an existing FAME CP-ABE scheme with grade-sheet policies, browser processing, separated authority commands and measured baseline comparison. We did not invent FAME or prove a new encryption scheme.

## Suggested slide order

1. Title, team names and grade-sheet problem.
2. Existing system and its trust limitation.
3. Proposed policy and example attributes.
4. Architecture: authority → user keys; browser → encrypted files → storage; MongoDB → metadata.
5. Live demo of matching and wrong keys.
6. Actual comparison results from `docs/results/MEASURED-RESULTS.md`.
7. Contribution, limitations and future scope.
8. References.
