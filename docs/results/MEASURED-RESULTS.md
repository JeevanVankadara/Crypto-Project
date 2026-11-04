# Measured comparison

Measured at 2026-11-04T19:14:46Z on js/wasm, go1.27.3.

Both algorithms measured in the same Go WebAssembly runtime hosted in Node.js. Baseline is AES-256-GCM with an already-held server key; ABE is FAME protecting a fresh AES-256-GCM key. Timings exclude disk, MongoDB, network, helper startup and outer JSON encoding. These are crypto-core comparisons, not website response times. Seven repetitions after two warmups; synthetic random payloads.

| Input | Policy leaves | Normal encrypt (ms) | ABE encrypt (ms) | Normal decrypt (ms) | ABE decrypt (ms) |
| --- | --- | --- | --- | --- | --- |
| 1024 bytes | 3 | 0.127 | 394.579 | 0.058 | 232.548 |
| 102400 bytes | 3 | 4.095 | 274.245 | 3.940 | 169.206 |
| 1048576 bytes | 3 | 34.872 | 304.556 | 35.483 | 195.230 |
| 1024 bytes | 5 | 0.105 | 630.130 | 0.041 | 173.347 |
| 1024 bytes | 9 | 0.099 | 1497.915 | 0.034 | 155.638 |

ABE adds computation and package size. The intended improvement is cryptographic access to copied files, not faster encryption. These measurements are specific to this machine and implementation; browser WebAssembly performance may differ.
