# Hearth

A dashboard for the devices on your own network, and rules that fire on their events. **Every address is a
local-network address.**

- **Demo:** https://drsamonline.github.io/app-hearth/play/index.html
- **Landing page:** https://drsamonline.github.io/app-hearth/
- **Release:** https://github.com/drsamonline/app-hearth/releases/tag/app-latest
- **Plan row:** #32 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-hearth` (lead)
- **Licence:** PolyForm Noncommercial 1.0.0
- **Sponsor:** [github.com/sponsors/drsamonline](https://github.com/sponsors/drsamonline) — free, offline, no account

## Status

| | |
|---|---|
| **Built** | Devices by LAN address with a dashboard toggle; a LAN guard that refuses public addresses; rules of the form "when *event* after *time*, turn *device* on/off"; an event engine that fires at 22:30 and not at 21:30. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | **mDNS discovery and real device control.** Both need sockets, and this app makes no network calls at all — said on the page rather than shown as a "discovering…" spinner. |
| **Untested** | Any real device. The rules and the guard are exact; whether your hallway light speaks any of this is not something this app knows. |

## The spec's "done means", counted

| The spec says | The test |
|---|---|
| a device appears with its address and toggles from the dashboard | added at `192.168.1.20`, toggles on and off, says so each time |
| "motion after 22:00 turns on the hallway light" fires at **22:30** | `onEvent(motion, 22:30)` → 1 rule fired, light on |
| and **does not** fire at **21:30** | `onEvent(motion, 21:30)` → 0 fired, light off, and the app says a rule only fires at or after its own time |
| every request goes to a LAN address — zero outside | a public address is refused on entry; `allLocal()` is true for every home; and there is no `fetch`, `XMLHttpRequest`, `WebSocket` or beacon in the app at all |

## The guard is the promise

This app makes no network calls, so "zero requests reach any host outside the local network" is true by
construction. The guard is what makes it *stay* true: an address that is not private — `8.8.8.8`, a hostname,
even `172.32.0.1` — is refused when it is typed, with the reason.

| Accepted | Refused |
|---|---|
| 10/8 · 172.16/12 · 192.168/16 · 127.0.0.1 · 169.254/16 | everything else |

## What it will not do

- **Reach the internet.**
- **Accept a public address.**
- **Fire a rule early.**
- **Pretend to discover devices.**
- **Grow a second job.**

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | Every refusal names the field: name, address, duplicate, rule time, rule device, event time. |
| **No network** | Nothing changes; there is no network code. |
| **Storage full or unavailable** | **NOT SAVED**, home unchanged. |
| **Corrupt saved state** | Reported and offered for export, never replaced with an empty one. |

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 64 assertions
node tests/ui-tests.js        # the page in jsdom — 19 assertions
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 26/11/2026, all red: a public address accepted (4 failures), a rule firing before
its time (3), the rule ignoring the event name (1), `172.32` counted as local (1), a broken home starting
empty (4), and a toggle that does nothing (2).

## Layout

```
docs/index.html            landing page
docs/play/index.html       the app — devices, the toggle, the rules, the event
docs/play/app.js           DOM wiring: add, toggle, add a rule, report an event, export
docs/play/hearth-core.js   the engine — the LAN guard, devices, rules, evaluation, storage
docs/play/web-kit.js       vendored kit (unmodified)
docs/play/export-kit.js    vendored kit (unmodified)
tests/self-tests.js        engine suite (64)
tests/ui-tests.js          page suite (19, jsdom)
tests/page-smoke.js        shape on disk
PAGES.json                 landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **Addresses, not discovery.** With no mDNS, the honest input is the address a person can read off their router.
- **The guard lives in `addDevice`**, so there is no path into the home that skips it.
- **A rule fires at or after its time**, inclusive — 22:00 fires at 22:00, because a rule that skips its own minute is a bug people would report.
- **An event with no time is refused**, rather than defaulting to now: a rule engine that guesses the clock is a rule engine you cannot test.
- **An empty home is never substituted for a broken one**, because "every device is gone" is a worse message than "the file is unreadable".

## What is not built, and why

**mDNS discovery and real device control.** Both need sockets. What ships is the part that can be true
without them: the device list, the guard, and the rules — tested, and honest about what it does not do.
