import { readFileSync } from 'node:fs';
import { run } from './process.mjs';

const git = (args) => run('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
const full = (reason) => ({ all: true, reason });

function commit(ref) {
  return git(['rev-parse', '--verify', `${ref}^{commit}`]);
}

function ensureCommit(sha) {
  try { return commit(sha); } catch {
    git(['fetch', '--no-tags', 'origin', sha]);
    return commit(sha);
  }
}

export async function lastSuccessfulPush(env, fetchImpl = fetch) {
  const url = new URL(
    `/repos/${env.GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs`,
    env.GITHUB_API_URL || 'https://api.github.com',
  );
  url.search = new URLSearchParams({ branch: 'main', event: 'push', status: 'success', per_page: '100' });
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`workflow history returned HTTP ${response.status}`);
  const { workflow_runs: runs } = await response.json();
  return runs.find((entry) => entry.event === 'push' && entry.head_branch === 'main'
    && entry.conclusion === 'success' && String(entry.id) !== env.GITHUB_RUN_ID)?.head_sha;
}

export async function baseline(options, env = process.env, services = {}) {
  const gitCommand = services.git ?? git;
  const resolveCommit = services.commit ?? commit;
  const ensure = services.ensureCommit ?? ensureCommit;
  if (options.all) return full('explicit full check');
  try {
    const head = resolveCommit(options.head ?? 'HEAD');
    if (options.base) {
      const base = resolveCommit(options.base);
      gitCommand(['merge-base', '--is-ancestor', base, head]);
      return { base, head, all: false, reason: 'explicit base and head' };
    }
    if (env.GITHUB_ACTIONS !== 'true') {
      const base = gitCommand(['merge-base', 'origin/main', head]);
      return { base, head, all: false, reason: 'local merge base with origin/main' };
    }
    if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') return full('manual workflow run');
    if (env.GITHUB_EVENT_NAME === 'pull_request') {
      const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
      const pr = event.pull_request;
      if (head !== pr.head.sha) return full('checkout does not match the PR head');
      const target = ensure(pr.base.sha);
      const base = gitCommand(['merge-base', target, head]);
      return { base, head, all: false, reason: `PR merge base with ${pr.base.ref}` };
    }
    if (env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === 'refs/heads/main') {
      const sha = await (services.lastSuccessfulPush ?? lastSuccessfulPush)(env);
      if (!sha) return full('no successful main push baseline');
      const base = ensure(sha);
      gitCommand(['merge-base', '--is-ancestor', base, head]);
      return { base, head, all: false, reason: 'last successful main push of ci.yml' };
    }
    return full('event has no supported baseline');
  } catch (error) {
    return full(`baseline unavailable or unusable: ${error.message}`);
  }
}
