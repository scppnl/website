import { install } from './install.mjs';
import { main, nx } from './process.mjs';
import { options, selectProjects } from './select-projects.mjs';
import { writeSelection } from './production.mjs';

main(async () => {
  const selection = await selectProjects(options());
  console.log(JSON.stringify(selection, null, 2));
  if (!selection.projects.length) {
    console.log('No affected projects; application installation, builds, and tests skipped.');
    writeSelection([]);
    return;
  }
  install(selection.projects);
  nx(['run-many', '--targets=build,test', `--projects=${selection.projects.join(',')}`,
    '--parallel=2', '--outputStyle=static']);
  // Publish selection only after every selected project has passed its checks.
  writeSelection(selection.projects);
});
