/* hearth-core — the engine behind Hearth.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: a dashboard for the devices on your own network, and rules that fire on their events.
 *
 * EVERY ADDRESS MUST BE A LAN ADDRESS. A public address is refused when it is entered, because a home
 * dashboard has no business reaching the internet — and this app makes no network calls at all, so the
 * guard is the whole of the promise rather than a check on something it does.
 *
 * mDNS DISCOVERY IS NOT BUILT: no multicast, no sockets. A device is added by typing its LAN address, and
 * the app says so instead of showing an empty "discovering…" list for ever.
 *
 * Rules are time-and-event conditions evaluated locally: "motion after 22:00 turns on the hallway light".
 *
 * Pure functions: no DOM, no network, no storage.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.HearthCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(mins) { var m = ((Math.round(mins) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }

  /* The private ranges: 10/8, 172.16/12, 192.168/16, plus loopback and link-local. Nothing else is a LAN
   * address, and nothing else is accepted. */
  function isLanAddress(text) {
    var host = clean(text).replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m) return false;
    var o = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (o.some(function (n) { return n > 255; })) return false;
    if (o[0] === 10) return true;
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
    if (o[0] === 192 && o[1] === 168) return true;
    if (o[0] === 127) return true;
    if (o[0] === 169 && o[1] === 254) return true;
    return false;
  }

  function emptyHome() { return { devices: [], rules: [] }; }

  function addDevice(home, input, now) {
    var name = clean(input && input.name);
    var address = clean(input && input.address);
    if (!name) return { ok: false, field: "name", reason: "a device needs a name" };
    if (!address) return { ok: false, field: "address", reason: "a device needs an address" };
    if (!isLanAddress(address)) {
      return { ok: false, field: "address", shown: address, reason: "\u201c" + address + "\u201d is not a local-network address. This dashboard reaches nothing outside your own network, so it is refused." };
    }
    var h = clone(home);
    if (h.devices.some(function (d) { return d.address === address; })) return { ok: false, field: "address", reason: "there is already a device at " + address };
    var d = { id: "d" + (h.devices.length + 1), name: name, address: address, kind: clean(input && input.kind) || "light", on: false, at: now || Date.now() };
    h.devices.push(d);
    return { ok: true, home: h, device: d, says: name + " added at " + address + "." };
  }

  function toggle(home, id, now) {
    var h = clone(home);
    var d = h.devices.filter(function (x) { return x.id === id; })[0];
    if (!d) return { ok: false, field: "id", reason: "there is no such device" };
    d.on = !d.on;
    d.at = now || Date.now();
    return { ok: true, home: h, device: d, says: d.name + " is " + (d.on ? "on" : "off") + "." };
  }

  /* A rule: when <event> happens after <time>, turn <device> on (or off). */
  function addRule(home, input) {
    var after = clean(input && input.after);
    var m = /^(\d{1,2}):(\d{2})$/.exec(after);
    if (!m) return { ok: false, field: "after", reason: "a rule needs a time (HH:MM)" };
    var minutes = Number(m[1]) * 60 + Number(m[2]);
    if (minutes > 1439) return { ok: false, field: "after", reason: "that is not a time on a clock" };
    var deviceId = clean(input && input.deviceId);
    var event = clean(input && input.event) || "motion";
    var h = clone(home);
    if (!h.devices.some(function (d) { return d.id === deviceId; })) return { ok: false, field: "deviceId", reason: "a rule has to act on a device in this home" };
    var rule = { id: "r" + (h.rules.length + 1), event: event, after: minutes, afterLabel: hhmm(minutes), deviceId: deviceId, action: clean(input && input.action) === "off" ? "off" : "on", enabled: true };
    h.rules.push(rule);
    return { ok: true, home: h, rule: rule, says: "When " + event + " happens after " + rule.afterLabel + ", turn the device " + rule.action + "." };
  }

  /* Evaluating an event: a rule fires only if the event matches AND the time is after its threshold. */
  function onEvent(home, input, now) {
    var event = clean(input && input.event) || "motion";
    var at = input && input.minutes != null ? Number(input.minutes) : null;
    if (at == null || isNaN(at)) return { ok: false, field: "minutes", reason: "an event needs a time of day, in minutes" };
    var h = clone(home);
    var fired = [];
    h.rules.forEach(function (r) {
      if (!r.enabled || r.event !== event) return;
      if (at < r.after) return;                       /* 21:30 does not fire a 22:00 rule */
      var d = h.devices.filter(function (x) { return x.id === r.deviceId; })[0];
      if (!d) return;
      d.on = r.action === "on";
      d.at = now || Date.now();
      fired.push({ ruleId: r.id, deviceId: d.id, device: d.name, action: r.action, after: r.afterLabel, at: hhmm(at) });
    });
    return {
      ok: true, home: h, fired: fired, count: fired.length,
      says: fired.length
        ? event + " at " + hhmm(at) + " fired " + fired.length + " rule(s): " + fired.map(function (f) { return f.device + " " + f.action; }).join(", ") + "."
        : event + " at " + hhmm(at) + " fired nothing. A rule only fires at or after its own time."
    };
  }

  function clone(home) {
    var h = home || emptyHome();
    return {
      devices: (h.devices || []).map(function (d) { return { id: d.id, name: d.name, address: d.address, kind: d.kind, on: !!d.on, at: d.at || 0 }; }),
      rules: (h.rules || []).map(function (r) { return { id: r.id, event: r.event, after: r.after, afterLabel: r.afterLabel, deviceId: r.deviceId, action: r.action, enabled: !!r.enabled }; })
    };
  }

  /* The promise, in one function: every address in the home is a LAN address. */
  function allLocal(home) {
    var bad = ((home && home.devices) || []).filter(function (d) { return !isLanAddress(d.address); });
    return { ok: bad.length === 0, bad: bad.map(function (d) { return d.address; }), says: bad.length ? bad.length + " device(s) are not on the local network." : "Every device is on the local network." };
  }

  function serialize(home) { return JSON.stringify({ version: VERSION, format: "hearth-1", home: clone(home) }, null, 2); }
  function parseState(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, empty: true, reason: "no device has been added on this device yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) { return { ok: false, unreadable: true, reason: "The saved home cannot be read. It was NOT replaced with an empty one \u2014 an empty home looks like every device is gone. Export it to keep it.", raw: raw }; }
    if (!data || !data.home || !Array.isArray(data.home.devices)) return { ok: false, unreadable: true, reason: "The saved file holds no home. Nothing was started over it; export it to keep it.", raw: raw };
    return { ok: true, home: clone(data.home), raw: raw };
  }
  function stamp(when) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || "")); return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated"; }
  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "application/json";
    if (what === "home") { name = "hearth-" + stamp(meta.when) + ".json"; body = serialize(payload.home); }
    else if (what === "raw") { name = "hearth-unreadable-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); mime = "text/plain;charset=utf-8"; }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return { version: VERSION, isLanAddress: isLanAddress, emptyHome: emptyHome, addDevice: addDevice,
    toggle: toggle, addRule: addRule, onEvent: onEvent, allLocal: allLocal, hhmm: hhmm,
    serialize: serialize, parseState: parseState, exportFile: exportFile };
});
