import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMain, main, npm, root } from './process.mjs';

export const accountId = '92f5552d0543ddca6c17f012ab294a9f';
export const sites = [
  { project: 'frontpage-association', worker: 'scpp-association', assets: 'dist/client', route: '/speltakken' },
  { project: 'frontpage-foundation', worker: 'scpp-foundation', assets: 'dist/frontpage-foundation/browser', route: '/gebouw' },
].map(site => ({ ...site, directory: `src/apps/${site.project}`,
  url: `https://${site.worker}.de-wildert-penp.workers.dev` }));

export function siteFor(project) {
  const site = sites.find(site => site.project === project);
  if (!site) throw new Error(`Unregistered production website: ${project}`);
  return site;
}

export function selectedSites(projects) {
  return sites.filter(site => projects.includes(site.project)).map(site => site.project);
}

export function writeSelection(projects, output = process.env.GITHUB_OUTPUT) {
  if (output) appendFileSync(output, `sites=${JSON.stringify(selectedSites(projects))}\n`);
}

export function validateDeployment(site, env = process.env) {
  if (!env.CLOUDFLARE_API_TOKEN?.trim()) throw new Error('Set the production environment secret CLOUDFLARE_API_TOKEN');
  if (env.CLOUDFLARE_ACCOUNT_ID !== accountId) throw new Error(`Set production CLOUDFLARE_ACCOUNT_ID to ${accountId}`);
  if (!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '')) throw new Error('Expected the checked-out GitHub commit SHA');
  const config = JSON.parse(readFileSync(resolve(root, site.directory, 'wrangler.json'), 'utf8'));
  if (config.name !== site.worker || config.assets?.directory !== site.assets) {
    throw new Error(`Production target does not match wrangler.json for ${site.project}`);
  }
}

if (isMain(import.meta.url)) main(() => {
  const [command, project] = process.argv.slice(2);
  const site = siteFor(project);
  if (command === 'site') {
    if (!process.env.GITHUB_OUTPUT) throw new Error('Expected GITHUB_OUTPUT');
    appendFileSync(process.env.GITHUB_OUTPUT,
      `directory=${site.directory}\nassets=${site.directory}/${site.assets}\nurl=${site.url}\nworker=${site.worker}\n`);
  } else if (command === 'deploy') {
    validateDeployment(site);
    npm(['exec', '--no', '--', 'wrangler', 'deploy', '--message', `GitHub ${process.env.GITHUB_SHA}`],
      { cwd: resolve(root, site.directory) });
  } else {
    throw new Error('Usage: node eng/production.mjs site|deploy <project>');
  }
});
