#!/usr/bin/env node
/* ui-tests — the Hearth page in a real DOM (jsdom). SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin */
"use strict";
var fs = require("fs"), path = require("path"), { JSDOM } = require("jsdom");
var ROOT = path.join(__dirname, ".."), PLAY = path.join(ROOT, "docs", "play");
var passed = 0, failed = [];
function ok(n, c, d) { if (c) { passed++; return; } failed.push(n + (d ? " — " + d : "")); }
function eq(n, a, b) { ok(n, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function build(seed) {
  var dom = new JSDOM(fs.readFileSync(path.join(PLAY, "index.html"), "utf8"), { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; }; w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "hearth-core.js", "app.js"].forEach(function (f) { w.eval(fs.readFileSync(path.join(PLAY, f), "utf8")); });
  return dom;
}
var dom = build(null), w = dom.window, d = w.document, $ = function (id) { return d.getElementById(id); };
ok("the engine loaded", !!w.HearthCore);
ok("the LAN promise is on the page", /Every device is on the local network/.test($("lanNote").textContent), $("lanNote").textContent);

$("dName").value = "Hallway light"; $("dAddr").value = "192.168.1.20"; $("addBtn").click();
ok("the device is added", /added at 192\.168\.1\.20/.test($("status").textContent), $("status").textContent);
eq("one device on the dashboard", d.querySelectorAll("#deviceList li").length, 1);

$("dName").value = "Cloud"; $("dAddr").value = "8.8.8.8"; $("addBtn").click();
ok("a public address is refused", /reaches nothing outside/.test($("status").textContent), $("status").textContent);
eq("and nothing was added", d.querySelectorAll("#deviceList li").length, 1);

d.querySelector("#deviceList button").click();
ok("the device toggles from the dashboard", /Hallway light is on/.test($("status").textContent), $("status").textContent);
ok("and reads as on", /on/.test($("deviceList").textContent), $("deviceList").textContent);

$("rEvent").value = "motion"; $("rAfter").value = "22:00"; $("rDevice").value = "Hallway light"; $("ruleBtn").click();
ok("the rule is added", /When motion happens after 22:00/.test($("status").textContent), $("status").textContent);
eq("and listed", d.querySelectorAll("#ruleList li").length, 1);

$("evTime").value = "21:30"; $("fireBtn").click();
ok("21:30 fires nothing", /fired nothing/.test($("fireSays").textContent), $("fireSays").textContent);
$("evTime").value = "22:30"; $("fireBtn").click();
ok("22:30 fires the rule", /fired 1 rule/.test($("fireSays").textContent), $("fireSays").textContent);
ok("and the light is on", /Hallway light on/.test($("fireSays").textContent));

$("exportBtn").click();
ok("the home exports", /Wrote hearth-\d{4}-\d\d-\d\d\.json/.test($("ioNote").textContent), $("ioNote").textContent);
var saved = w.localStorage.getItem("hearth:home");
var dom2 = build({ "hearth:home": saved });
var d2 = dom2.window.document;
eq("the reload keeps the device", d2.querySelectorAll("#deviceList li").length, 1);
eq("and the rule", d2.querySelectorAll("#ruleList li").length, 1);

var dom3 = build({ "hearth:home": "{ broken home" });
var d3 = dom3.window.document;
ok("a broken home is reported", /cannot be read/.test(d3.getElementById("status").textContent));
ok("and not replaced with an empty one", /NOT replaced with an empty one/.test(d3.getElementById("status").textContent));

var dom4 = build(null), w4 = dom4.window, d4 = dom4.window.document;
Object.defineProperty(w4, "localStorage", { configurable: true, get: function () {
  return { getItem: function () { return null; }, setItem: function () { var e = new Error("q"); e.name = "QuotaExceededError"; throw e; }, removeItem: function () {}, clear: function () {} }; } });
d4.getElementById("dName").value = "x"; d4.getElementById("dAddr").value = "10.0.0.2"; d4.getElementById("addBtn").click();
ok("a failed save says NOT SAVED", /NOT SAVED:/.test(d4.getElementById("status").textContent), d4.getElementById("status").textContent);

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran."); process.exit(1); }
if (failed.length) { console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED"); failed.forEach(function (f) { console.error("  FAIL " + f); }); process.exit(1); }
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
