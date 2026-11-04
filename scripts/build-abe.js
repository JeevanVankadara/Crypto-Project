import { spawnSync } from 'node:child_process';
import { mkdir, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const go =
  process.env.GO_BINARY ||
  (process.platform === 'win32'
    ? path.join(
        process.env.LOCALAPPDATA,
        'SecureAcademicSharing',
        'tools',
        'go-sdk',
        'go',
        'bin',
        'go.exe',
      )
    : 'go');
function run(args, env = {}) {
  const result = spawnSync(go, args, {
    cwd: path.join(root, 'crypto-helper'),
    env: { ...process.env, ...env },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Go command failed: ${args.join(' ')}`);
}
await mkdir(path.join(root, '.tools'), { recursive: true });
await mkdir(path.join(root, 'public', 'abe'), { recursive: true });
run(['mod', 'download']);
run(['test', '-c', '-o', path.join(root, '.tools', 'engine.test.wasm'), './internal/engine'], {
  GOOS: 'js', GOARCH: 'wasm', CGO_ENABLED: '0',
});
run(['build', '-trimpath', '-o', path.join(root, '.tools', 'authority.wasm'), './cmd/native'], {
  GOOS: 'js',
  GOARCH: 'wasm',
  CGO_ENABLED: '0',
});
run(
  ['build', '-trimpath', '-o', path.join(root, 'public', 'abe', 'helper.wasm'), './cmd/browser'],
  { GOOS: 'js', GOARCH: 'wasm', CGO_ENABLED: '0' },
);
const info = spawnSync(go, ['env', 'GOROOT'], { encoding: 'utf8', windowsHide: true });
if (info.status !== 0) throw new Error('Unable to locate Go runtime.');
let runtime = path.join(info.stdout.trim(), 'lib', 'wasm', 'wasm_exec.js');
try {
  await access(runtime);
} catch {
  runtime = path.join(info.stdout.trim(), 'misc', 'wasm', 'wasm_exec.js');
}
await copyFile(runtime, path.join(root, 'public', 'abe', 'wasm_exec.js'));
await copyFile(runtime, path.join(root, '.tools', 'wasm_exec.js'));
await copyFile(
  path.join(path.dirname(runtime), 'wasm_exec_node.js'),
  path.join(root, '.tools', 'wasm_exec_node.js'),
);
await writeFileCompat();
const checks = spawnSync(process.execPath, [path.join(root, '.tools', 'wasm_exec_node.js'), path.join(root, '.tools', 'engine.test.wasm'), '-test.v'], {
  env: {}, stdio: 'inherit', windowsHide: true,
});
if (checks.error) throw checks.error;
if (checks.status !== 0) throw new Error('WebAssembly cryptographic tests failed.');
async function writeFileCompat() {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(root, '.tools', 'package.json'), '{"type":"commonjs"}');
}
console.log('Node-hosted authority helper and browser WebAssembly module built.');
