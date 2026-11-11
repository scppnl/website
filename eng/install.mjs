import { existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { isMain, main, npm, nx, root } from './process.mjs';

export function install(projects) {
  for (const name of projects) {
    const project = JSON.parse(nx(['show', 'project', name, '--json'], {
      stdio: ['ignore', 'pipe', 'inherit'],
    }));
    if (!project.metadata?.ci?.npm) continue;
    const directory = resolve(root, project.root);
    if (relative(root, directory).startsWith('..') || directory === root) {
      throw new Error(`Expected a separate npm project under the repository: ${name}`);
    }
    if (!existsSync(resolve(directory, 'package-lock.json'))) {
      throw new Error(`Missing package-lock.json for ${name}`);
    }
    console.log(`Installing locked dependencies for ${name}`);
    npm(['ci', '--no-audit', '--no-fund'], { cwd: directory });
  }
}

if (isMain(import.meta.url)) main(() => {
  const projects = process.argv.slice(2);
  install(projects.length ? projects : JSON.parse(nx(['show', 'projects', '--json'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  })));
});
