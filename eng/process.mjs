import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const taskEnv = {
  ...process.env,
  NX_DAEMON: 'false',
  NX_NO_CLOUD: 'true',
  NX_TUI: 'false',
  NG_BUILD_MAX_WORKERS: process.env.NG_BUILD_MAX_WORKERS ?? '2',
};

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: taskEnv,
    stdio: 'inherit',
    encoding: 'utf8',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.signal ?? result.status})`);
  }
  return result.stdout?.trim();
}

export function nx(args, options = {}) {
  const directory = resolve(root, 'node_modules/nx');
  const { bin } = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  return run(process.execPath, [resolve(directory, bin.nx), ...args], options);
}

export function npm(args, options = {}) {
  // npm run provides the exact npm CLI, including on Windows.
  return process.env.npm_execpath
    ? run(process.execPath, [process.env.npm_execpath, ...args], options)
    : run(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, options);
}

export function isMain(url) {
  return process.argv[1] && fileURLToPath(url) === resolve(process.argv[1]);
}

export function main(action) {
  Promise.resolve().then(action).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
