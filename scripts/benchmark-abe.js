import { mkdir, writeFile } from 'node:fs/promises';
import { runCrypto } from './abe-helper.js';
const results = await runCrypto({ op: 'benchmark' });
await mkdir('public/results', { recursive: true });
await mkdir('docs/results', { recursive: true });
await writeFile('public/results/benchmark.json', JSON.stringify(results, null, 2));
const header =
  'input_bytes,policy_leaves,baseline_encrypt_mean_ms,abe_encrypt_mean_ms,baseline_decrypt_mean_ms,abe_decrypt_mean_ms,baseline_stored_bytes,abe_stored_bytes';
const csv = [
  header,
  ...results.rows.map((r) =>
    [
      r.inputBytes,
      r.policyLeaves,
      r.baselineEncrypt.meanMs,
      r.abeEncrypt.meanMs,
      r.baselineDecrypt.meanMs,
      r.abeDecrypt.meanMs,
      r.baselineStoredBytes,
      r.abeStoredBytes,
    ].join(','),
  ),
].join('\n');
await writeFile('docs/results/comparison.csv', csv + '\n');
const table = [
  '| Input | Policy leaves | Normal encrypt (ms) | ABE encrypt (ms) | Normal decrypt (ms) | ABE decrypt (ms) |',
  '| --- | --- | --- | --- | --- | --- |',
  ...results.rows.map(
    (r) =>
      `| ${r.inputBytes} bytes | ${r.policyLeaves} | ${r.baselineEncrypt.meanMs.toFixed(3)} | ${r.abeEncrypt.meanMs.toFixed(3)} | ${r.baselineDecrypt.meanMs.toFixed(3)} | ${r.abeDecrypt.meanMs.toFixed(3)} |`,
  ),
].join('\n');
await writeFile(
  'docs/results/MEASURED-RESULTS.md',
  `# Measured comparison\n\nMeasured at ${results.measuredAt} on ${results.os}/${results.architecture}, ${results.runtime}.\n\n${results.method}\n\n${table}\n\nABE adds computation and package size. The intended improvement is cryptographic access to copied files, not faster encryption. These measurements are specific to this machine and implementation; browser WebAssembly performance may differ.\n`,
);
console.table(
  results.rows.map((r) => ({
    bytes: r.inputBytes,
    attributes: r.policyLeaves,
    normalEncrypt: r.baselineEncrypt.meanMs.toFixed(3),
    abeEncrypt: r.abeEncrypt.meanMs.toFixed(3),
    normalDecrypt: r.baselineDecrypt.meanMs.toFixed(3),
    abeDecrypt: r.abeDecrypt.meanMs.toFixed(3),
  })),
);
