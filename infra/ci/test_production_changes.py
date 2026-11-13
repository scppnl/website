import json
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import production_changes


ROOT = Path(__file__).resolve().parents[1]


class ProductionChangesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Michel Megens')
        self.git('config', 'user.email', 'mtm.megens@gmail.com')
        self.write('infra/billing-guard/budget.tf')
        self.write('infra/production/apis.tf')
        self.base = self.commit()
        self.mock = patch('production_changes.git', self.git)
        self.mock.start()
        self.addCleanup(self.mock.stop)

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.repo, stderr=subprocess.DEVNULL)

    def write(self, path, content='initial'):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)

    def commit(self):
        self.git('add', '.')
        self.git('commit', '-qm', 'test fixture')
        return self.git('rev-parse', 'HEAD').decode().strip()

    def push(self, before=None):
        return production_changes.production_changed('push', {
            'before': before or self.base,
            'after': self.git('rev-parse', 'HEAD').decode().strip(),
        })

    def test_billing_only_and_documentation_changes(self):
        self.write('infra/billing-guard/budget.tf', 'edited')
        self.write('infra/README.md')
        head = self.commit()
        self.assertFalse(self.push())
        self.assertFalse(production_changes.production_changed('pull_request', {
            'pull_request': {'base': {'sha': self.base}, 'head': {'sha': head}},
        }))

    def test_production_related_paths_and_mixed_changes(self):
        for path in ['infra/production/apis.tf', 'infra/modules/example/main.tf',
                     'infra/ci/plan-summary.py', '.github/workflows/terraform.yml']:
            with self.subTest(path=path):
                before = self.git('rev-parse', 'HEAD').decode().strip()
                self.write(path, 'changed')
                self.write('infra/billing-guard/budget.tf', path)
                self.commit()
                self.assertTrue(self.push(before))

    def test_deletions(self):
        self.git('rm', 'infra/production/apis.tf')
        self.commit()
        self.assertTrue(self.push())

    def test_renames_in_both_directions(self):
        self.git('mv', 'infra/production/apis.tf', 'infra/billing-guard/moved.tf')
        moved = self.commit()
        self.assertTrue(self.push())
        self.git('mv', 'infra/billing-guard/moved.tf', 'infra/production/apis.tf')
        self.commit()
        self.assertTrue(self.push(moved))

    def test_push_compares_all_commits(self):
        self.write('infra/production/apis.tf', 'production')
        self.commit()
        self.write('infra/billing-guard/budget.tf', 'billing')
        self.commit()
        self.assertTrue(self.push())

    def test_pr_ignores_changes_only_on_newer_base(self):
        self.git('checkout', '-qb', 'pr')
        self.write('infra/billing-guard/budget.tf', 'pr change')
        head = self.commit()
        self.git('checkout', '--detach', self.base)
        self.write('infra/production/apis.tf', 'base-only change')
        newer_base = self.commit()
        self.assertFalse(production_changes.production_changed('pull_request', {
            'pull_request': {'base': {'sha': newer_base}, 'head': {'sha': head}},
        }))

    def test_missing_history_fails(self):
        for missing in ['0' * 40, 'missing-ref']:
            with self.subTest(missing=missing), self.assertRaises(subprocess.CalledProcessError):
                self.push(missing)

    def test_manual_dispatch_does_not_need_a_diff(self):
        self.assertTrue(production_changes.production_changed('workflow_dispatch', {}))

    def test_cli_outputs_notice_and_fails_without_output_on_bad_history(self):
        script = ROOT / 'ci/production_changes.py'
        event = self.repo / 'event.json'
        output = self.repo / 'output'
        summary = self.repo / 'summary'
        env = dict(os.environ, GITHUB_EVENT_NAME='push', GITHUB_EVENT_PATH=str(event),
                   GITHUB_OUTPUT=str(output), GITHUB_STEP_SUMMARY=str(summary))
        event.write_text(json.dumps({'before': self.base, 'after': self.base}))
        result = subprocess.run(['python3', str(script)], cwd=self.repo, env=env, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(output.read_text(), 'production_changed=false\n')
        self.assertIn('approval, and apply are skipped', summary.read_text())
        output.unlink()
        event.write_text(json.dumps({'before': '0' * 40, 'after': self.base}))
        result = subprocess.run(['python3', str(script)], cwd=self.repo, env=env, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(output.exists())


class WorkflowPolicyTests(unittest.TestCase):
    def test_cloud_job_event_matrix(self):
        workflow = (ROOT.parent / '.github/workflows/terraform.yml').read_text()
        for job in ['plan', 'apply']:
            section = workflow.split(f'\n  {job}:\n', 1)[1].split('\n  apply:\n', 1)[0]
            condition = next(line.strip()[4:] for line in section.splitlines() if line.startswith('    if: '))
            self.assertIn('working-directory: infra/production', section)
            for changed in [False, True]:
                for event, ref, fork, expected_plan, expected_apply in [
                    ('pull_request', 'refs/pull/1/merge', False, True, False),
                    ('pull_request', 'refs/pull/2/merge', True, False, False),
                    ('push', 'refs/heads/main', False, False, True),
                    ('workflow_dispatch', 'refs/heads/main', False, False, True),
                    ('workflow_dispatch', 'refs/heads/feature', False, False, False),
                ]:
                    github = SimpleNamespace(event_name=event, ref=ref, repository='owner/repo',
                        event=SimpleNamespace(pull_request=SimpleNamespace(head=SimpleNamespace(
                            repo=SimpleNamespace(full_name='fork/repo' if fork else 'owner/repo')))))
                    needs = SimpleNamespace(checks=SimpleNamespace(outputs=SimpleNamespace(
                        production_changed=str(changed).lower())))
                    actual = eval(condition.replace('&&', ' and ').replace('||', ' or '),
                                  {'__builtins__': {}}, {'github': github, 'needs': needs})
                    self.assertEqual(actual, changed and (expected_plan if job == 'plan' else expected_apply),
                                     (job, changed, event, ref, fork))


if __name__ == '__main__':
    unittest.main()
