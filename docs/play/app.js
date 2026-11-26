/* app — the Hearth page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 · (c) 2026 Dr Sohil Momin
 * Wiring only: the LAN guard, the devices and the rules live in hearth-core.js. */
(function () {
  "use strict";
  var H = window.HearthCore;
  var $ = function (id) { return document.getElementById(id); };
  var K = "hearth:home";
  var state = { home: H.emptyHome(), unreadable: null };

  var els = {
    status: $("status"), lanNote: $("lanNote"), dName: $("dName"), dAddr: $("dAddr"), addBtn: $("addBtn"),
    deviceList: $("deviceList"), rEvent: $("rEvent"), rAfter: $("rAfter"), rDevice: $("rDevice"), deviceNames: $("deviceNames"),
    ruleBtn: $("ruleBtn"), ruleList: $("ruleList"), evTime: $("evTime"), fireBtn: $("fireBtn"), fireSays: $("fireSays"),
    exportBtn: $("exportBtn"), ioNote: $("ioNote")
  };

  function today() { var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function setStatus(k, m) { els.status.className = "status show " + k; els.status.textContent = m; }
  function node(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }

  function persist() {
    try { window.localStorage.setItem(K, H.serialize(state.home)); return true; }
    catch (e) { setStatus("bad", "NOT SAVED: " + (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") + ". The home on screen is unchanged."); return false; }
  }

  function render() {
    els.deviceList.textContent = "";
    if (!state.home.devices.length) els.deviceList.appendChild(node("li", null, "No device added yet."));
    state.home.devices.forEach(function (d) {
      var li = node("li", d.on ? "on" : "");
      var left = node("div", null, d.name);
      left.appendChild(node("span", "meta", d.address + " \u00b7 " + (d.on ? "on" : "off")));
      li.appendChild(left);
      var b = node("button", "small", d.on ? "Turn off" : "Turn on");
      b.addEventListener("click", function () {
        var out = H.toggle(state.home, d.id, Date.now());
        if (!out.ok) { setStatus("bad", out.reason); return; }
        state.home = out.home;
        var saved = persist();
        render();
        if (saved) setStatus("ok", out.says);
      });
      li.appendChild(b);
      els.deviceList.appendChild(li);
    });

    els.deviceNames.textContent = "";
    state.home.devices.forEach(function (d) { var o = document.createElement("option"); o.value = d.name; els.deviceNames.appendChild(o); });

    els.ruleList.textContent = "";
    if (!state.home.rules.length) els.ruleList.appendChild(node("li", null, "No rule yet."));
    state.home.rules.forEach(function (r) {
      var d = state.home.devices.filter(function (x) { return x.id === r.deviceId; })[0];
      var li = node("li");
      li.appendChild(node("div", null, "When " + r.event + " after " + r.afterLabel + ", turn " + (d ? d.name : "?") + " " + r.action));
      els.ruleList.appendChild(li);
    });

    var local = H.allLocal(state.home);
    els.lanNote.textContent = local.says + " Nothing outside your own network is ever reached — this app makes no network calls at all.";
  }

  function addDevice() {
    var out = H.addDevice(state.home, { name: els.dName.value, address: els.dAddr.value }, Date.now());
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.home = out.home;
    var saved = persist();
    els.dName.value = ""; els.dAddr.value = "";
    render();
    if (saved) setStatus("ok", out.says);
  }

  function addRule() {
    var name = els.rDevice.value.trim();
    var d = state.home.devices.filter(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })[0];
    if (!d) { setStatus("bad", "That is not a device in this home."); return; }
    var out = H.addRule(state.home, { event: els.rEvent.value, after: els.rAfter.value, deviceId: d.id });
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.home = out.home;
    var saved = persist();
    render();
    if (saved) setStatus("ok", out.says);
  }

  function fire() {
    var m = /^(\d{1,2}):(\d{2})$/.exec(els.evTime.value.trim());
    if (!m) { setStatus("bad", "The event time has to be HH:MM."); return; }
    var out = H.onEvent(state.home, { event: els.rEvent.value, minutes: Number(m[1]) * 60 + Number(m[2]) }, Date.now());
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.home = out.home;
    var saved = persist();
    render();
    els.fireSays.textContent = out.says;
    if (saved) setStatus(out.count ? "ok" : "warn", out.says);
  }

  function doExport() {
    var out = H.exportFile("home", { home: state.home }, { when: today() }, function (name, text, mime) {
      if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
      window.Export.save(name, text, mime); return true;
    });
    if (out.ok) { els.ioNote.textContent = "Wrote " + out.filename + "."; setStatus("ok", "Exported."); }
    else setStatus("bad", out.reason + ".");
  }

  els.addBtn.addEventListener("click", addDevice);
  els.ruleBtn.addEventListener("click", addRule);
  els.fireBtn.addEventListener("click", fire);
  els.exportBtn.addEventListener("click", doExport);

  var raw = null;
  try { raw = window.localStorage.getItem(K); } catch (e) { raw = null; }
  if (raw) {
    var parsed = H.parseState(raw);
    if (parsed.ok) state.home = parsed.home;
    else {
      state.unreadable = parsed;
      setStatus("bad", parsed.reason);
      var keep = node("button", "small", "Export the unreadable home");
      keep.addEventListener("click", function () {
        var out = H.exportFile("raw", parsed, { when: today() }, function (name, text, mime) {
          if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
          window.Export.save(name, text, mime); return true;
        });
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.ioNote.parentNode.insertBefore(keep, els.ioNote);
    }
  }

  render();
  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
