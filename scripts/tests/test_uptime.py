import unittest
from unittest.mock import Mock
from scripts.uptime import transition, confirmed

class UptimeTest(unittest.TestCase):
    def test_transient_failure_recovers_before_notification(self):
        probe = Mock(side_effect=[False, True])
        self.assertTrue(confirmed(probe, lambda: None))
        self.assertEqual(probe.call_count, 2)

    def test_transition_only_and_delivery_failure_is_retryable(self):
        notify = Mock()
        self.assertFalse(transition([], [], notify))
        self.assertTrue(transition([], ["API"], notify))
        self.assertFalse(transition(["API"], ["API"], notify))
        self.assertTrue(transition(["API"], [], notify))
        self.assertEqual(notify.call_count, 2)
        notify.side_effect = RuntimeError()
        with self.assertRaises(RuntimeError):
            transition([], ["API"], notify)

    def test_truncated_response_counts_as_failed_probe(self):
        from http.client import IncompleteRead
        from unittest.mock import patch
        from scripts.uptime import healthy
        with patch("scripts.uptime.urlopen", side_effect=IncompleteRead(b"")):
            self.assertFalse(healthy("API", "https://invalid.example/health"))

    def test_discord_requires_confirmed_message(self):
        from io import BytesIO
        from unittest.mock import patch
        from scripts.uptime import send
        fake = BytesIO(b'{"id":"42"}')
        fake.status = 200
        with patch("scripts.uptime.urlopen", return_value=fake) as post:
            send("test", "https://discord.com/api/webhooks/fake/test?thread_id=1")
            self.assertIn("thread_id=1&wait=true", post.call_args.args[0].full_url)
