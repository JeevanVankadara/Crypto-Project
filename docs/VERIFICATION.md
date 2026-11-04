# Verification

Verified on 5 November 2026 with a real local MongoDB instance.

- `npm.cmd test`: 17 reported tests passed, zero failures or skipped tests. Includes actual Node-hosted WASM ABE calls and Express/MongoDB integration.
- Go engine: five tests passed during the ABE build, covering round trips, policy denial, tampering, edited/mixed keys, authority mismatch and serialization.
- Browser: uploaded the synthetic Student A PDF through real browser encryption; Student B key failed to decrypt it; Student A key succeeded. Screenshot: `screenshots/abe-success.jpg`.
- Comparison: actual measured JSON loaded in the results page with timing and storage tables.
- Baseline: existing login, upload, access denial, storage and restart tests continue to pass.

The browser test changed keys while retaining the faculty login to isolate the cryptographic decision. Cross-account ciphertext retrieval and wrong-key rejection are also covered by the integration test.

Benchmark method and measured output are in `results/MEASURED-RESULTS.md`. These tests support the demonstrated behaviors; they are not a cryptographic audit, security proof or production certification.
