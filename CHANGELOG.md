# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 26/11/2026

### Added
- **Devices by LAN address**, with a toggle from the dashboard.
- A **LAN guard**: 10/8, 172.16/12, 192.168/16, loopback and link-local are accepted; a public address or a
  hostname is **refused when typed**, with the reason.
- **Rules** of the form "when *event* happens after *time*, turn *device* on/off", evaluated locally.
- An **event engine** that fires at 22:30 for a 22:00 rule and does nothing at 21:30, saying why.
- Refusals: no name, no address, a duplicate address, a rule with no time or a nonsense time, a rule on a
  device that is not in the home, an event with no time.
- An unreadable home is reported and offered for export, never replaced with an empty one — an empty home
  looks like every device is gone.
- A failed save says **NOT SAVED** and leaves the home unchanged.
- PWA shell, CI (64 engine assertions + 19 in jsdom + page smoke), and the app-builder pipeline pinned to the
  canonical SHA for the EXE/APK/Linux release.

### Not built
- **mDNS discovery and real device control.** Both need sockets, and this app makes no network calls at all.
