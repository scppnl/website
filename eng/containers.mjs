import { appendFileSync } from 'node:fs';
import { isMain, main, nx } from './process.mjs';

export function selectedContainers(projects) {
  return projects.filter((name) => {
    const project = JSON.parse(nx(['show', 'project', name, '--json'], {
      stdio: ['ignore', 'pipe', 'inherit'],
    }));
    return Boolean(project.targets?.docker);
  });
}

export function writeContainerSelection(projects, output = process.env.GITHUB_OUTPUT) {
  const containers = selectedContainers(projects);
  if (output) appendFileSync(output, `containers=${JSON.stringify(containers)}\n`);
}

if (isMain(import.meta.url)) main(() => {
  const projects = JSON.parse(process.env.CONTAINERS ?? 'null');
  if (!Array.isArray(projects) || projects.some(name => typeof name !== 'string'
    || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(name))) {
    throw new Error('Expected CONTAINERS to be a JSON array of Nx project names');
  }
  if (projects.length) nx(['run-many', '--target=docker', `--projects=${projects.join(',')}`,
    '--parallel=2', '--outputStyle=static']);
});
