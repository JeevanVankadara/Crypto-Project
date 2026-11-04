import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export const helperPath = path.join(root, '.tools', 'authority.wasm');
// Secrets travel through stdin, never command-line arguments or logs.
export function runCrypto(request) {
  return new Promise((resolve, reject) => {
    // Go's WASM argument/environment area is small. No inherited environment
    // variables are needed by this self-contained cryptography process.
    const child = spawn(
      process.execPath,
      [path.join(root, '.tools', 'wasm_exec_node.js'), helperPath],
      { env: {}, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let output = '';
    let errors = '';
    const timer = setTimeout(
      () => {
        child.kill();
        reject(new Error('ABE operation timed out.'));
      },
      request.op === 'benchmark' ? 240000 : 60000,
    );
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      errors += data;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0)
        return reject(new Error(`ABE helper failed (${code}). ${errors.slice(0, 200)}`));
      try {
        const value = JSON.parse(output);
        if (value.error) throw new Error(value.error);
        resolve(value.result);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(request) + '\n');
  });
}
