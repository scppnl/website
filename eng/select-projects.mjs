import { parseArgs } from 'node:util';
import { baseline } from './baseline.mjs';
import { isMain, main, nx } from './process.mjs';

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

export async function selectProjects(opts) {
  const selection = opts.files
    ? { all: false, reason: 'explicit changed files', files: opts.files }
    : await baseline(opts);
  const args = ['show', 'projects', '--json'];
  if (!selection.all) {
    args.push('--affected');
    if (selection.files) args.push(`--files=${selection.files.join(',')}`);
    else args.push(`--base=${selection.base}`, `--head=${selection.head}`);
  }
  const projects = JSON.parse(nx(args, { stdio: ['ignore', 'pipe', 'inherit'] })).sort();
  return { ...selection, projects };
}

if (isMain(import.meta.url)) main(async () => {
  console.log(JSON.stringify(await selectProjects(options()), null, 2));
});
