import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMain, main, root, run } from './process.mjs';

export function dotnet(args) {
  const [action, ...paths] = args;
  if (!['restore', 'build', 'test'].includes(action) || !paths.length) {
    throw new Error('Usage: node eng/dotnet.mjs <restore|build|test> <project.csproj|solution.sln|solution.slnx> [...]');
  }
  // Validate all paths before starting any work. Never discover or restore an implicit solution.
  const resolved = paths.map((path) => {
    const absolute = resolve(root, path);
    if (!/\.(?:csproj|fsproj|vbproj|slnx?)$/i.test(absolute) || !existsSync(absolute)) {
      throw new Error(`Expected an existing .NET project or solution: ${path}`);
    }
    return absolute;
  });
  for (const path of resolved) {
    const flags = action === 'restore' ? [] : ['--configuration', 'Release', '--no-restore'];
    if (action === 'test') flags.push('--no-build');
    run('dotnet', [action, path, ...flags]);
  }
}

if (isMain(import.meta.url)) main(() => dotnet(process.argv.slice(2)));
