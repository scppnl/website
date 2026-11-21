import { appendFileSync } from 'node:fs';
import { nx } from './process.mjs';

const listed = 8;
const probed = 20;
const quiet = { stdio: ['ignore', 'pipe', 'inherit'] };

const code = (files) => files.map((file) => `\`${file}\``).join(', ');
const some = (files, count = listed) => `${code(files.slice(0, count))}${files.length > count ? `, and ${files.length - count} more` : ''}`;
const files = (count) => `${count} ${count === 1 ? 'file' : 'files'}`;
const isDocumentation = (file) => file.endsWith('.md');

// Explains why each API with a docker target was selected, so a surprising selection can
// be traced from the run summary. `roots` maps every affected project to its root and
// `affectedBy(file)` returns the projects one changed file selects.
export function describeSelection({ selection, containers, roots, affectedBy }) {
  const lines = ['## Project selection', ''];
  if (selection.all || !selection.base) {
    lines.push(`Every project was selected: ${selection.reason}.`, '');
    return lines.join('\n');
  }
  const changed = (selection.changed ?? []).filter((file) => !isDocumentation(file));
  lines.push(`Compared \`${selection.base}\` with \`${selection.head}\` (${selection.reason}); ${changed.length} changed files.`, '');
  if (!containers.length) return [...lines, 'No API images are affected.', ''].join('\n');

  const rootList = [...roots.values()];
  const outside = changed.filter((file) => !rootList.some((root) => file.startsWith(`${root}/`)));
  const probes = new Map(outside.slice(0, probed).map((file) => [file, affectedBy(file)]));
  lines.push('| API | Image | Selected by |', '| --- | --- | --- |');
  for (const name of containers) {
    const own = changed.filter((file) => file.startsWith(`${roots.get(name)}/`));
    const shared = [...probes].filter(([, selected]) => selected.includes(name)).map(([file]) => file);
    const reasons = [];
    const relative = own.map((file) => file.slice(roots.get(name).length + 1));
    if (own.length) reasons.push(`${files(own.length)} in \`${roots.get(name)}\`: ${some(relative, 3)}`);
    if (shared.length) reasons.push(`shared inputs: ${some(shared)}`);
    if (outside.length > probed) reasons.push(`${outside.length - probed} further files outside any project were not checked`);
    const image = selection.imageProjects?.includes(name)
      ? 'new version required' : 'not published: only CI files selected it';
    lines.push(`| ${name} | ${image} | ${reasons.join('; ') || 'unknown'} |`);
  }
  return [...lines, ''].join('\n');
}

export function writeSelectionSummary(selection, projects, output = process.env.GITHUB_STEP_SUMMARY) {
  if (!output) return;
  const roots = new Map();
  const containers = [];
  for (const name of projects) {
    const project = JSON.parse(nx(['show', 'project', name, '--json'], quiet));
    roots.set(name, project.root);
    if (project.targets?.docker) containers.push(name);
  }
  const affectedBy = (file) => JSON.parse(nx(['show', 'projects', '--json', '--affected', `--files=${file}`], quiet));
  appendFileSync(output, `${describeSelection({ selection, containers, roots, affectedBy })}\n`);
}
