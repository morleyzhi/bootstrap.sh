#!/usr/bin/env python3
"""Merge chrome/bookmarks.html into Chrome's bookmarks bar.

Adds any bookmark whose URL isn't already present; never removes anything.
Chrome must be closed (it rewrites the file on quit). Run via bootstrap.sh,
or standalone: python3 chrome/merge-bookmarks.py
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PROFILE = os.path.expanduser(
    "~/Library/Application Support/Google/Chrome/Default/Bookmarks"
)
PROFILE = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PROFILE

if PROFILE == DEFAULT_PROFILE and \
        subprocess.run(["pgrep", "-x", "Google Chrome"], capture_output=True).returncode == 0:
    sys.exit("Chrome is running — quit it first, or import chrome/bookmarks.html "
             "manually via chrome://bookmarks.")

html = open(os.path.join(HERE, "bookmarks.html")).read()
wanted = re.findall(r'<A HREF="([^"]+)">([^<]+)</A>', html)
if not wanted:
    sys.exit("No bookmarks found in bookmarks.html")

if not os.path.exists(PROFILE):
    sys.exit("No Chrome profile yet — open Chrome once, then re-run, or import "
             "chrome/bookmarks.html manually via chrome://bookmarks.")

def canon(url):
    return url.split("#")[0].rstrip("/")

data = json.load(open(PROFILE))
bar = data["roots"]["bookmark_bar"]["children"]
have = {canon(c["url"]) for c in bar if c.get("type") == "url"}

added = 0
next_id = 1000
for url, name in wanted:
    if canon(url) in have:
        continue
    next_id += 1
    bar.append({"id": str(next_id), "name": name, "type": "url", "url": url})
    added += 1

if added:
    data.pop("checksum", None)  # Chrome recomputes it on load
    json.dump(data, open(PROFILE, "w"), indent=3, ensure_ascii=False)
print(f"Bookmarks merged: {added} added, {len(wanted) - added} already present.")
