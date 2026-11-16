# AI-assisted: written with Claude, reviewed by Angel Balderas.
"""
Submit the SMAP point request to NASA AppEEARS, watch it, and download its results.

    python scripts/appeears_request.py submit     sign in, send data/appeears-smap-request.json
    python scripts/appeears_request.py status     how far along the request is
    python scripts/appeears_request.py wait       check every minute, download when done
    python scripts/appeears_request.py download   fetch the result files into data/raw/
    python scripts/appeears_request.py login      renew the token without a new request

Needs Python 3.9 or newer and no package. Run it from the repo root.

Signing in: `submit` asks for the Earthdata Login username at the prompt and the password
without echo (getpass). Neither is stored. AppEEARS answers with a bearer token that lasts
about 48 hours; the token and the task id are kept in data/raw/appeears-session.json, which
Git ignores (.gitignore, "data/raw/"), so the other commands need no new sign-in. Nothing
here prints the token or the password. If AppEEARS answers 403, the token has expired: run
`login` to renew it.

Endpoints, from the AppEEARS API documentation (https://appeears.earthdatacloud.nasa.gov/api/):
POST /login (HTTP Basic, Content-Length 0) -> {token, expiration}; POST /task -> 202 {task_id,
status}; GET /status/{task_id} -> {status, progress}, or 303 to /task/{task_id} once done;
GET /bundle/{task_id} -> {files: [{file_id, file_name, file_size, file_type}]};
GET /bundle/{task_id}/{file_id} -> 302 to a presigned download link.
"""

from __future__ import annotations

import base64
import getpass
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://appeears.earthdatacloud.nasa.gov/api"
ROOT = Path(__file__).resolve().parent.parent
REQUEST_FILE = ROOT / "data" / "appeears-smap-request.json"
RAW_DIR = ROOT / "data" / "raw"
SESSION_FILE = RAW_DIR / "appeears-session.json"
TIMEOUT_S = 60
POLL_S = 60


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Stops urllib from following a redirect, so the Location header can be read."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def call(method, path, token=None, body=None, basic=None):
    """One request to the API. Returns (status, headers, parsed JSON or None)."""
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if basic:
        headers["Authorization"] = "Basic " + basic
    if body is not None:
        headers["Content-Type"] = "application/json"
    elif method == "POST":
        headers["Content-Length"] = "0"
    req = urllib.request.Request(API + path, data=body, method=method, headers=headers)
    try:
        with OPENER.open(req, timeout=TIMEOUT_S) as resp:
            raw = resp.read()
            status, hdrs = resp.status, dict(resp.headers)
    except urllib.error.HTTPError as err:
        raw = err.read()
        status, hdrs = err.code, dict(err.headers)
    parsed = None
    if raw:
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except ValueError:
            parsed = None
    return status, hdrs, parsed


def message_of(parsed):
    if isinstance(parsed, dict):
        for key in ("message", "error", "detail"):
            if isinstance(parsed.get(key), str):
                return parsed[key]
    return ""


def load_session():
    if not SESSION_FILE.exists():
        return {}
    with SESSION_FILE.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_session(session):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with SESSION_FILE.open("w", encoding="utf-8") as handle:
        json.dump(session, handle, indent=2)
    print("Session saved to data/raw/appeears-session.json (ignored by Git).")


def login():
    """Asks for the Earthdata Login at the prompt and returns the session with a fresh token."""
    print("NASA Earthdata Login. Nothing typed here is stored.")
    username = input("Username: ").strip()
    password = getpass.getpass("Password (not shown): ")
    if not username or not password:
        sys.exit("A username and a password are both needed.")
    basic = base64.b64encode((username + ":" + password).encode("utf-8")).decode("ascii")
    del password
    status, _, parsed = call("POST", "/login", basic=basic)
    del basic
    if status != 200 or not isinstance(parsed, dict) or "token" not in parsed:
        sys.exit(("Sign-in failed (HTTP %d). " % status + message_of(parsed)).strip())
    session = load_session()
    session["token"] = parsed["token"]
    session["expiration"] = parsed.get("expiration")
    print("Signed in. The token lasts until %s (UTC)." % session["expiration"])
    return session


def need_task(session):
    token = session.get("token")
    task_id = session.get("task_id")
    if not token or not task_id:
        sys.exit("No submitted request on this machine yet. Run: python scripts/appeears_request.py submit")
    return token, task_id


def submit(session):
    with REQUEST_FILE.open(encoding="utf-8") as handle:
        request = json.load(handle)
    points = len(request["params"]["coordinates"])
    layers = len(request["params"]["layers"])
    dates = request["params"]["dates"][0]
    print("Sending %s: %d points, %d layers, %s to %s."
          % (request["task_name"], points, layers, dates["startDate"], dates["endDate"]))
    body = json.dumps(request).encode("utf-8")
    status, _, parsed = call("POST", "/task", token=session["token"], body=body)
    if status not in (200, 201, 202) or not isinstance(parsed, dict) or "task_id" not in parsed:
        sys.exit(("AppEEARS did not accept the request (HTTP %d). " % status + message_of(parsed)).strip())
    session["task_id"] = parsed["task_id"]
    session["submitted"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    print("Accepted. Task id %s, status %s." % (session["task_id"], parsed.get("status")))
    print("It is also listed at https://appeears.earthdatacloud.nasa.gov/explore once signed in.")
    return session


def task_status(session):
    """Prints the task's state and returns it: pending, processing, done or error."""
    token, task_id = need_task(session)
    code, headers, parsed = call("GET", "/status/" + task_id, token=token)
    if code == 303 or (code == 200 and not isinstance(parsed, dict)):
        # Done: the API points at the task object. Read it for the final word.
        code, headers, parsed = call("GET", "/task/" + task_id, token=token)
    if code == 403:
        sys.exit("AppEEARS refused the token (HTTP 403). It has expired: run `login`.")
    if code != 200 or not isinstance(parsed, dict):
        sys.exit(("Could not read the status (HTTP %d). " % code + message_of(parsed)).strip())
    state = str(parsed.get("status", "unknown"))
    line = "Task %s: %s" % (task_id, state)
    progress = parsed.get("progress")
    if isinstance(progress, dict) and "summary" in progress:
        line += ", %s%% complete" % progress["summary"]
        for step in progress.get("details") or []:
            if isinstance(step, dict):
                line += "\n  %s: %s%%" % (step.get("step"), step.get("pct_complete"))
    summary = parsed.get("summary")
    if isinstance(summary, dict) and summary.get("empty"):
        line += "\n  No output: %s" % summary.get("description")
    print(line)
    return state


def download(session):
    token, task_id = need_task(session)
    code, _, parsed = call("GET", "/bundle/" + task_id, token=token)
    if code == 403:
        sys.exit("AppEEARS refused the token (HTTP 403). It has expired: run `login`.")
    if code != 200 or not isinstance(parsed, dict) or not isinstance(parsed.get("files"), list):
        sys.exit(("The result files are not listed yet (HTTP %d). " % code + message_of(parsed)).strip())
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    saved = []
    for entry in parsed["files"]:
        name = Path(str(entry.get("file_name", entry["file_id"]))).name
        target = RAW_DIR / name
        code, headers, _ = call("GET", "/bundle/%s/%s" % (task_id, entry["file_id"]), token=token)
        location = headers.get("Location") or headers.get("location")
        if code not in (301, 302, 303, 307, 308) or not location:
            sys.exit("Unexpected answer for %s (HTTP %d)." % (name, code))
        # The presigned link carries its own credentials: no bearer token goes with it.
        with urllib.request.urlopen(location, timeout=TIMEOUT_S * 10) as resp, target.open("wb") as out:
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                out.write(chunk)
        print("Saved data/raw/%s (%s bytes, type %s)." % (name, format(target.stat().st_size, ","), entry.get("file_type")))
        saved.append(target)
    csvs = [p for p in saved if p.suffix.lower() == ".csv"]
    if csvs:
        print("\nResults CSV: data/raw/%s" % csvs[0].name)
        print("Next: python scripts/build_county_json.py")
    return saved


def wait(session):
    while True:
        state = task_status(session)
        if state == "done":
            download(session)
            return
        if state == "error":
            sys.exit("AppEEARS reports an error for this task. Check it on the Explore page.")
        print("Checking again in %d s. Ctrl-C stops the watch; the task keeps running at NASA." % POLL_S)
        time.sleep(POLL_S)


def main(argv):
    command = argv[1] if len(argv) > 1 else "help"
    if command == "submit":
        session = login()
        session = submit(session)
        save_session(session)
        print("\nNext: python scripts/appeears_request.py wait")
    elif command == "login":
        save_session(login())
    elif command == "status":
        task_status(load_session())
    elif command == "wait":
        wait(load_session())
    elif command == "download":
        download(load_session())
    else:
        print(__doc__)
        sys.exit(0 if command == "help" else 2)


if __name__ == "__main__":
    main(sys.argv)
