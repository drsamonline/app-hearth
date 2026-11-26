#!/usr/bin/env node
/* self-tests — Hearth. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin
 * Done-means: a device on the LAN appears with its address and toggles from the dashboard; the rule
 * 'motion after 22:00 turns on the hallway light' fires at 22:30 and NOT at 21:30; and every address is a
 * LAN address — zero outside the local network. */
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var H = require(path.join(ROOT, "docs", "play", "hearth-core.js"));
var passed = 0, failed = [], group = "";
function section(n) { group = n; }
function ok(n, c, d) { if (c) { passed++; return; } failed.push(group + " :: " + n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

function home() {
  var h = H.addDevice(H.emptyHome(), { name: "Hallway light", address: "192.168.1.20", kind: "light" }, 1).home;
  return h;
}

section("done means — a device appears with its address and toggles from the dashboard");
var h = home();
eq("the device is added", h.devices.length, 1);
eq("with its address", h.devices[0].address, "192.168.1.20");
eq("and it starts off", h.devices[0].on, false);
var on = H.toggle(h, h.devices[0].id, 2);
eq("toggling turns it on", on.device.on, true);
eq("and says so", on.says, "Hallway light is on.");
var off = H.toggle(on.home, h.devices[0].id, 3);
eq("toggling again turns it off", off.device.on, false);
eq("toggling a device that is not there is refused", H.toggle(h, "nope", 1).field, "id");

section("done means — motion after 22:00 fires at 22:30 and not at 21:30");
var rule = H.addRule(h, { event: "motion", after: "22:00", deviceId: h.devices[0].id });
eq("the rule is added", rule.ok, true);
eq("and reads as the spec words it", rule.says, "When motion happens after 22:00, turn the device on.");
h = rule.home;
var late = H.onEvent(h, { event: "motion", minutes: 22 * 60 + 30 }, 10);
eq("22:30 fires", late.count, 1);
eq("and the light is on", late.home.devices[0].on, true);
eq("naming the device", late.fired[0].device, "Hallway light");
ok("and the time", /22:30/.test(late.says), late.says);
var early = H.onEvent(h, { event: "motion", minutes: 21 * 60 + 30 }, 10);
eq("21:30 does not fire", early.count, 0);
eq("and the light stays off", early.home.devices[0].on, false);
ok("and says why", /only fires at or after its own time/.test(early.says), early.says);
eq("a different event does not fire it", H.onEvent(h, { event: "door", minutes: 23 * 60 }, 10).count, 0);
eq("exactly at the threshold fires", H.onEvent(h, { event: "motion", minutes: 22 * 60 }, 10).count, 1);

section("done means — every address is a LAN address, and a public one is refused");
["192.168.1.20", "10.0.0.5", "172.16.3.4", "172.31.255.1", "127.0.0.1", "169.254.1.1"].forEach(function (a) {
  eq(a + " is local", H.isLanAddress(a), true);
});
["8.8.8.8", "1.1.1.1", "172.32.0.1", "203.0.113.5", "example.com", "192.168.1", ""].forEach(function (a) {
  eq("\u201c" + a + "\u201d is not local", H.isLanAddress(a), false);
});
var pub = H.addDevice(h, { name: "Cloud thing", address: "8.8.8.8" }, 1);
eq("a public address is refused", pub.ok, false);
eq("with the field named", pub.field, "address");
ok("and says the dashboard reaches nothing outside", /reaches nothing outside your own network/.test(pub.reason), pub.reason);
eq("a hostname is refused too", H.addDevice(h, { name: "x", address: "example.com" }, 1).ok, false);
eq("every device in the home is local", H.allLocal(h).ok, true);
ok("and the app says so", /Every device is on the local network/.test(H.allLocal(h).says), H.allLocal(h).says);
ok("no network code at all", !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(read("docs/play/hearth-core.js") + read("docs/play/app.js")));
ok("the page forbids connections", /connect-src 'none'/.test(read("docs/play/index.html")));

section("bad input");
eq("a device with no name is refused", H.addDevice(H.emptyHome(), { address: "10.0.0.2" }, 1).field, "name");
eq("a device with no address is refused", H.addDevice(H.emptyHome(), { name: "x" }, 1).field, "address");
eq("the same address twice is refused", H.addDevice(home(), { name: "again", address: "192.168.1.20" }, 1).field, "address");
eq("a rule with no time is refused", H.addRule(h, { deviceId: h.devices[0].id }, 1).field, "after");
eq("a rule at a nonsense time is refused", H.addRule(h, { after: "25:00", deviceId: h.devices[0].id }, 1).field, "after");
eq("a rule on a device that is not there is refused", H.addRule(h, { after: "22:00", deviceId: "nope" }, 1).field, "deviceId");
eq("an event with no time is refused", H.onEvent(h, { event: "motion" }, 1).field, "minutes");

section("must-not — it must not grow a second job");
var core = read("docs/play/hearth-core.js");
ok("no camera, media or notification code", !/getUserMedia|MediaRecorder|Notification\(|speechSynthesis/i.test(core));
ok("no tags or folders", !/\b(tags|labels|folders)\s*[:=]/i.test(core));
ok("the engine says mDNS is not built", /mDNS DISCOVERY IS NOT BUILT/.test(core));

section("storage");
var bad = H.parseState("{ broken home");
eq("a broken home is reported", bad.ok, false);
eq("it is marked unreadable", bad.unreadable, true);
ok("it was not replaced with an empty one", /NOT replaced with an empty one/.test(bad.reason), bad.reason);
ok("and says why an empty home is worse", /every device is gone/.test(bad.reason), bad.reason);
eq("nothing saved yet is distinguished", H.parseState("").empty, true);
var round = H.parseState(H.serialize(rule.home));
eq("a home round-trips", round.home.devices.length, 1);
eq("with its rules", round.home.rules.length, 1);
var thrown = H.exportFile("home", { home: rule.home }, { when: "26/11/2026" }, function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; });
eq("a failed write is reported", thrown.ok, false);

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (x) { ok("script src resolves: " + x, fs.existsSync(path.join(ROOT, "docs", "play", x.replace(/^\.\//, "")))); });
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));
ok("the web manifest exists", fs.existsSync(path.join(ROOT, "docs", "play", "manifest.webmanifest")));

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("self-tests: " + passed + "/" + total + " assertions passed");
