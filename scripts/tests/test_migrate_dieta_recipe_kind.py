"""Wrapper contract tests using a fake Docker executable; never contact a DB."""
import json
import os
from pathlib import Path
import pty
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'migrate-dieta-recipe-kind.sh'


class MigrationWrapperTest(unittest.TestCase):
    def run_wrapper(self, mode='ok', args=None, terminal=True):
        with tempfile.TemporaryDirectory(prefix='dieta-wrapper-') as directory:
            root = Path(directory)
            docker = root / 'docker'
            log = root / 'calls.jsonl'
            docker.write_text('''#!/usr/bin/python3
import json, sys
from pathlib import Path
args = sys.argv[1:]
with Path(__file__).with_name('calls.jsonl').open('a') as out:
    out.write(json.dumps(args) + '\\n')
mode = Path(__file__).with_name('mode').read_text()
if 'mktemp' in args:
    print('/tmp/pbb-dieta-record-kind.ABC12345')
elif args[0] == 'cp' and mode == 'copy_fail':
    sys.exit(43)
elif 'mysql --no-defaults' in ' '.join(args):
    sys.exit(42 if mode == 'sql_fail' else 0)
''')
            docker.chmod(0o755)
            (root / 'mode').write_text(mode)
            command = ['/bin/bash', str(SCRIPT), *(args or ['baseball-mysql', 'baseball_db', 'baseball_user'])]
            env = {'PATH': str(root) + ':/usr/bin:/bin'}
            if terminal:
                master, slave = pty.openpty()
                try:
                    result = subprocess.run(command, stdin=slave, stdout=slave, stderr=slave,
                                            env=env, timeout=10)
                finally:
                    os.close(slave)
                    os.close(master)
            else:
                result = subprocess.run(command, input='', capture_output=True, text=True,
                                        env=env, timeout=10)
            calls = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
            return result.returncode, calls

    def test_success_uses_prompt_and_batch_stdin_then_cleans_temp_sql(self):
        code, calls = self.run_wrapper()
        self.assertEqual(code, 0)
        sql = next(call for call in calls if 'mysql --no-defaults' in ' '.join(call))
        self.assertIn('env', sql)
        self.assertIn('-i', sql)
        self.assertIn('MYSQL_TEST_LOGIN_FILE=/dev/null', sql)
        command = next(arg for arg in sql if 'mysql --no-defaults' in arg)
        self.assertIn('--password', command)
        self.assertNotIn('--password=', command)
        self.assertIn('--batch', command)
        self.assertIn('--skip-reconnect', command)
        self.assertIn('< "$3"', command)
        self.assertEqual(calls[-1], ['exec', 'baseball-mysql', 'rm', '-f', '--', '/tmp/pbb-dieta-record-kind.ABC12345'])

    def test_sql_failure_is_preserved_and_temp_sql_is_cleaned(self):
        code, calls = self.run_wrapper('sql_fail')
        self.assertEqual(code, 42)
        self.assertIn('rm', calls[-1])

    def test_copy_failure_stops_before_sql_and_cleans_temp_sql(self):
        code, calls = self.run_wrapper('copy_fail')
        self.assertEqual(code, 43)
        self.assertFalse(any('mysql --no-defaults' in ' '.join(call) for call in calls))
        self.assertIn('rm', calls[-1])

    def test_invalid_container_is_rejected_before_docker(self):
        code, calls = self.run_wrapper(args=['--privileged', 'baseball_db', 'user'])
        self.assertNotEqual(code, 0)
        self.assertEqual(calls, [])

    def test_no_terminal_is_rejected_before_docker(self):
        code, calls = self.run_wrapper(terminal=False)
        self.assertNotEqual(code, 0)
        self.assertEqual(calls, [])


if __name__ == '__main__':
    unittest.main()
