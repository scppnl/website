import { parseArgs } from 'node:util';
import { baseline } from './baseline.mjs';
import { isMain, main, nx, run } from './process.mjs';

export function options(args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    all: { type: 'boolean', default: false },
    base: { type: 'string' },
    head: { type: 'string' },
    files: { type: 'string', multiple: true },
  } });
  if (values.all && (values.base || values.head || values.files)) {
    throw new Error('--all cannot be combined with --base, --head, or --files');
  }
  if (values.files && (values.base || values.head)) {
    throw new Error('--files cannot be combined with --base or --head');
  }
  return values;
}

// Changes that only affect how CI runs. They still select projects for build and
// test, but cannot change a published API image, so they never require a new image
// version. Everything else in nx.json's sharedGlobals (SDK, build properties, style
// rules, .dockerignore, the root solution) can change image contents.
const ciOnlyDirectories = ['eng/', '.github/'];
const ciOnlyFiles = new Set(['package.json', 'package-lock.json', 'nx.json', '.nvmrc', '.npmrc']);

export function affectsImages(file) {
  return !ciOnlyFiles.has(file) && !ciOnlyDirectories.some((directory) => file.startsWith(directory));
}

export function changedFiles(selection, git = run) {
  if (selection.files) return selection.files;
  // --no-renames lists both sides of a rename, so a moved file still selects its old project.
  return git('git', ['diff', '--name-only', '--no-renames', '-z', selection.base, selection.head],
    { stdio: ['ignore', 'pipe', 'inherit'] }).split('\0').filter(Boolean);
}

function affected(...flags) {
  return JSON.parse(nx(['show', 'projects', '--json', '--affected', ...flags],
    { stdio: ['ignore', 'pipe', 'inherit'] })).sort();
}

// `projects` are affected by any change and are built and tested. `imageProjects` are
// affected by changes that can alter a built image; callers keep those with a docker target.
export async function selectProjects(opts) {
  const selection = opts.files
    ? { all: false, reason: 'explicit changed files', files: opts.files }
    : await baseline(opts);
  if (selection.all) {
    const projects = JSON.parse(nx(['show', 'projects', '--json'], { stdio: ['ignore', 'pipe', 'inherit'] })).sort();
    return { ...selection, projects, imageProjects: projects };
  }
  const changed = changedFiles(selection);
  const projects = selection.files ? affected(`--files=${selection.files.join(',')}`)
    : affected(`--base=${selection.base}`, `--head=${selection.head}`);
  const imageFiles = changed.filter(affectsImages);
  const imageProjects = imageFiles.length ? affected(`--files=${imageFiles.join(',')}`) : [];
  return { ...selection, changed, projects, imageProjects };
}

if (isMain(import.meta.url)) main(async () => {
  console.log(JSON.stringify(await selectProjects(options()), null, 2));
});
