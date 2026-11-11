import { install } from './install.mjs';
import { main, nx } from './process.mjs';
import { options, selectProjects } from './select-projects.mjs';

main(async () => {
  const selection = await selectProjects(options());
  console.log(JSON.stringify(selection, null, 2));
  if (!selection.projects.length) {
    console.log('No affected projects; application installation, builds, and tests skipped.');
    return;
  }
  install(selection.projects);
  nx(['run-many', '--targets=build,test', `--projects=${selection.projects.join(',')}`,
    '--parallel=2', '--outputStyle=static']);
});
