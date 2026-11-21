import { appendFileSync } from 'node:fs';
import { install } from './install.mjs';
import { main, nx } from './process.mjs';
import { options, selectProjects } from './select-projects.mjs';
import { selectedSites, writeSelection } from './production.mjs';
import { writeContainerSelection } from './containers.mjs';
import { writeSelectionSummary } from './selection-summary.mjs';

main(async () => {
  const selection = await selectProjects(options());
  if (process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && process.env.CI_SITES_ONLY === 'true') {
    selection.projects = selectedSites(selection.projects);
    selection.imageProjects = [];
    selection.reason += '; websites-only dispatch';
  }
  console.log(JSON.stringify(selection, null, 2));
  if (!selection.projects.length) {
    console.log('No affected projects; application installation, builds, and tests skipped.');
    writeContainerSelection([]);
    writeSelection([]);
    return;
  }
  try {
    writeSelectionSummary(selection, selection.projects);
  } catch (error) {
    console.warn(`Could not summarize the project selection: ${error.message}`);
  }
  install(selection.projects);
  nx(['run-many', '--targets=build,test', `--projects=${selection.projects.join(',')}`,
    '--parallel=2', '--outputStyle=static']);
  // Publish selection only after every selected project has passed its checks.
  writeContainerSelection(selection.imageProjects);
  writeSelection(selection.projects);
  // Lets a failed publication name the commit this run compared with.
  if (selection.base && process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `baseline=${selection.base}\n`);
});
