"""Run on a GitHub-hosted runner, independently of the PBB deployment."""
import concurrent.futures
import json
import os
import sys
import time
from http.client import HTTPException
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.error import URLError
from urllib.request import Request, urlopen

TARGETS = {"웹": "https://app.pbbstudio.com/", "API": "https://api.pbbstudio.com/actuator/health"}


def healthy(name, url):
    try:
        with urlopen(Request(url, headers={"User-Agent": "PBB-uptime/1"}), timeout=8) as response:
            if response.status != 200:
                return False
            body = response.read(131072)
            if name == "API":
                return json.loads(body).get("status") == "UP"
            return b'id="root"' in body
    except (HTTPException, URLError, OSError, ValueError, AttributeError, EOFError):
        return False


def confirmed(probe, pause):
    for attempt in range(3):
        if probe():
            return True
        if attempt < 2:
            pause()
    return False


def transition(previous, current, notify):
    if current == previous:
        return False
    down = sorted(set(current) - set(previous))
    up = sorted(set(previous) - set(current))
    lines = (["중단: " + ", ".join(down)] if down else []) + (["복구: " + ", ".join(up)] if up else [])
    notify("PBB 서비스 상태 변경\n" + "\n".join(lines))
    return True


def send(message, webhook=None):
    data = json.dumps({"content": message, "allowed_mentions": {"parse": []}}).encode()
    try:
        parts = urlsplit(webhook or os.environ["PBB_DISCORD_WEBHOOK_URL"])
        if parts.scheme != "https" or parts.hostname != "discord.com" or not parts.path.startswith("/api/webhooks/"):
            raise ValueError("Unexpected webhook address")
        params = dict(parse_qsl(parts.query))
        params["wait"] = "true"
        url = urlunsplit(parts._replace(query=urlencode(params), fragment=""))
        req = Request(url, data=data, headers={"Content-Type": "application/json", "User-Agent": "PBB-uptime/1"})
        with urlopen(req, timeout=10) as response:
            if response.status != 200 or not json.load(response).get("id"):
                raise ValueError("Missing Discord acknowledgement")
    except (HTTPException, ValueError, OSError, AttributeError):
        # Never include the webhook URL or response body in Actions logs.
        raise RuntimeError("Discord delivery failed; check repository secret and channel") from None


def main(path):
    if not os.environ.get("PBB_DISCORD_WEBHOOK_URL"):
        sys.exit("Set the PBB_DISCORD_WEBHOOK_URL GitHub Actions secret first.")
    if "--test-notification" in sys.argv[2:]:
        send("PBB 외부 감시 테스트 · 장애 또는 복구 알림이 아닙니다.")
    previous = json.loads(path.read_text()) if path.exists() else []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        jobs = {k: pool.submit(confirmed, lambda n=k: healthy(n, TARGETS[n]), lambda: time.sleep(10))
                for k in TARGETS}
        current = sorted(k for k, job in jobs.items() if not job.result())
    changed = transition(previous, current, send)
    save = changed or not path.exists()
    if save:
        path.write_text(json.dumps(current))
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        print(f"save={'yes' if save else 'no'}", file=output)
    print("Unhealthy:", ", ".join(current) or "none")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
