import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { describeSelection } from './selection-summary.mjs';
import { root } from './process.mjs';

const roots = new Map([['booking-api', 'src/foundation/booking-api'], ['contact-api', 'src/shared/contact-api']]);
const base = { base: 'a'.repeat(40), head: 'b'.repeat(40), reason: 'last successful main push of ci.yml' };

test('explains which changed files selected each API and whether an image is needed', () => {
  const calls = [];
  const text = describeSelection({
    selection: { ...base, imageProjects: ['booking-api'], changed: [
      'src/foundation/booking-api/src/Program.cs', 'src/foundation/booking-api/README.md',
      'eng/frontend.mjs', 'Directory.Build.props', 'infra/production/apis.tf'] },
    containers: ['booking-api', 'contact-api'], roots,
    affectedBy: (file) => {
      calls.push(file);
      return file === 'infra/production/apis.tf' ? [] : file === 'Directory.Build.props'
        ? ['booking-api', 'contact-api'] : ['booking-api', 'contact-api', 'frontpage-foundation'];
    },
  });
  assert.match(text, new RegExp(`Compared \`${base.base}\` with \`${base.head}\``));
  assert.match(text, /4 changed files/, 'documentation is not counted');
  assert.match(text, /\| booking-api \| new version required \| 1 file in `src\/foundation\/booking-api`: `src\/Program\.cs`; shared inputs: `eng\/frontend\.mjs`, `Directory\.Build\.props` \|/);
  assert.match(text, /\| contact-api \| not published: only CI files selected it \| shared inputs: `eng\/frontend\.mjs`, `Directory\.Build\.props` \|/);
  assert.ok(!text.includes('apis.tf` ,') && !/shared inputs:[^|]*apis\.tf/.test(text), 'files that select nothing are not blamed');
  assert.ok(!calls.includes('src/foundation/booking-api/src/Program.cs'), 'project files need no query');
});

test('summaries stay short for large changes and for full or API-free selections', () => {
  const many = Array.from({ length: 30 }, (_, index) => `tools/file-${index}.txt`);
  const text = describeSelection({ selection: { ...base, imageProjects: [], changed: many },
    containers: ['contact-api'], roots, affectedBy: () => ['contact-api'] });
  assert.match(text, /and 12 more/);
  assert.match(describeSelection({ selection: { ...base, imageProjects: [], changed: Array.from({ length: 5 }, (_, i) => `src/shared/contact-api/f${i}.cs`) },
    containers: ['contact-api'], roots, affectedBy: () => [] }), /5 files in `src\/shared\/contact-api`: `f0\.cs`, `f1\.cs`, `f2\.cs`, and 2 more/);
  assert.match(text, /10 further files outside any project were not checked/);
  assert.match(describeSelection({ selection: { all: true, reason: 'manual workflow run' }, containers: [], roots, affectedBy: () => [] }),
    /Every project was selected: manual workflow run/);
  assert.match(describeSelection({ selection: { ...base, changed: ['src/apps/x/a.ts'] }, containers: [], roots, affectedBy: () => [] }),
    /No API images are affected/);
});

test('the workflow passes the compared baseline to image publication', () => {
  const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
  assert.match(workflow, /baseline: \$\{\{ steps\.ci\.outputs\.baseline \}\}/);
  const publish = workflow.split('- name: Publish versioned API images\n')[1].split('- name:')[0];
  assert.match(publish, /CI_BASELINE: \$\{\{ needs\.check\.outputs\.baseline \}\}/);
});
