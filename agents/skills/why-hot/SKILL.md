---
name: why-hot
description: Diagnose why a Mac is hot or its fans are running by executing the local why-hot system-load script. Use when the user asks what is heating the Mac, which app uses CPU, or whether Chrome is causing high load.
---

# Diagnose Mac heat

Run `~/bin/why-hot` and report the processes above its CPU threshold.

Use the script's relative labels and core counts. Treat 100% CPU as one full logical core. If the script flags Chrome, tell the user to press Shift+Esc in Chrome and sort its Task Manager by CPU to identify the tab or extension. Do not claim that a Chrome renderer PID identifies a tab URL.

Use `~/bin/why-hot <percent>` when the user supplies a CPU threshold. The default is 50%.

Do not stop processes unless the user asks. If the script is missing, state that `~/bin/why-hot` must be installed.
