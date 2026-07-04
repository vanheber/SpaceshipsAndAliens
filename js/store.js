// WARP-Unit Shared State Store
// Single source of truth for all pages.
// Phase 1: localStorage backend.
// Phase 2: fetch() backend with polling.

(function () {
  "use strict";

  var KEY = "warp-unit-state";

  var DEFAULTS = {
    campaignName: "",
    robots: {},
    npcs: [5, 5, 5],
    fear: 0,
    mothership: {
      sup: { current: 10, max: 20 },
      fuel: { current: 10, max: 10 },
      ammo: { current: 10, max: 10 },
      defense: { current: 20, max: 20 },
    },
    ship400i: {
      sup: { current: 4, max: 8 },
      fuel: { current: 6, max: 6 },
      ammo: { current: 4, max: 4 },
      defense: { current: 8, max: 8 },
    },
    activeRobot: null,
    isDroneMode: false,
    pendingActions: [],
  };

  var _state = null;
  var _prevState = null;
  var _subs = [];
  var _mode = "local";
  var _remoteOpts = null;
  var _readyPromise = null;

  function deepClone(obj) {
    if (obj == null) return obj;
    return JSON.parse(JSON.stringify(obj));
  }

  function deepMerge(base, overlay) {
    var out = deepClone(base);
    for (var k in overlay) {
      if (!overlay.hasOwnProperty(k)) continue;
      if (
        overlay[k] !== null &&
        typeof overlay[k] === "object" &&
        !Array.isArray(overlay[k]) &&
        base[k] !== null &&
        typeof base[k] === "object" &&
        !Array.isArray(base[k])
      ) {
        out[k] = deepMerge(base[k], overlay[k]);
      } else {
        out[k] = deepClone(overlay[k]);
      }
    }
    return out;
  }

  function _get(path) {
    if (!path) return deepClone(_state);
    var parts = path.split(".");
    var cur = _state;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return typeof cur === "object" && cur !== null ? deepClone(cur) : cur;
  }

  function _set(path, value) {
    if (_mode === "p2p" && !(_remoteOpts && _remoteOpts.role === "gm")) {
      _prevState = deepClone(_state);
    }
    var parts = path.split(".");
    var cur = _state;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in cur) || typeof cur[parts[i]] !== "object" || cur[parts[i]] === null)
        cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = deepClone(value);

    if (_mode === "p2p") {
      _p2pSave(path);
    } else {
      _saveLocal();
    }
    _broadcast();
    _notify(_state);
  }

  function _saveLocal() {
    localStorage.setItem(KEY, JSON.stringify(_state));
  }

  function _broadcast() {
    if (typeof WarpP2P !== "undefined" && WarpP2P.getRole() === "gm") {
      WarpP2P.send(null, {
        type: "sync",
        state: _state,
        sessions: _state.sessions,
        messages: _state.messages,
        pendingActions: _state.pendingActions,
      });
    }
  }

  function _notify(state) {
    var s = deepClone(state);
    for (var i = 0; i < _subs.length; i++) {
      try { _subs[i](s); } catch (e) {}
    }
    window.dispatchEvent(new CustomEvent("warp-state-changed", { detail: s }));
  }

  function _loadFromStorage() {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        _state = deepMerge(DEFAULTS, parsed);
      } catch (e) {
        _state = deepClone(DEFAULTS);
      }
    } else {
      _state = deepClone(DEFAULTS);
    }
  }

  function _p2pSave(path) {
    if (!_remoteOpts || typeof WarpP2P === "undefined") return;
    if (_remoteOpts.role === "gm") return;
    // Player: detect energy delta, send request to GM
    var robotId = null;
    if (path && path.indexOf("robots.") === 0) {
      robotId = path.split(".").slice(1).join(".");
    } else if (path === "robots" && _state.activeRobot) {
      robotId = _state.activeRobot;
    }
    if (robotId && _prevState) {
      var delta = (_state.robots[robotId] || 0) - (_prevState.robots[robotId] || 0);
      if (delta !== 0) {
        WarpP2P.send("gm", { type: "request", robotId: robotId, amount: delta });
      }
    }
  }

  function _migrate() {
    var robots = {};
    var npcs = [5, 5, 5];
    var fear = 0;
    var mothership = null;
    var ship400i = null;
    var activeRobot = null;
    var isDroneMode = false;

    if (localStorage.getItem(KEY)) return;

    try {
      var rawMission = localStorage.getItem("warp-unit-mission");
      if (rawMission) {
        var m = JSON.parse(rawMission);
        if (m.robots && typeof m.robots === "object") {
          Object.keys(m.robots).forEach(function (k) { robots[k] = m.robots[k]; });
        }
        if (Array.isArray(m.npcs)) npcs = m.npcs;
        if (typeof m.fear === "number") fear = m.fear;
      }
    } catch (e) {}

    try {
      var rawMs = localStorage.getItem("warp-unit-mothership");
      if (rawMs) mothership = JSON.parse(rawMs);
    } catch (e) {}
    try {
      var raw400i = localStorage.getItem("warp-unit-400i");
      if (raw400i) ship400i = JSON.parse(raw400i);
    } catch (e) {}
    try {
      var rawCat = localStorage.getItem("warp-unit-catalog");
      if (rawCat) {
        var c = JSON.parse(rawCat);
        if (c.robotId) {
          activeRobot = c.robotId;
          if (robots[c.robotId] == null) robots[c.robotId] = c.activeEnergy;
          else if (typeof c.activeEnergy === "number") robots[c.robotId] = c.activeEnergy;
        }
        if (typeof c.isDroneMode === "boolean") isDroneMode = c.isDroneMode;
      }
    } catch (e) {}

    _state = deepClone(DEFAULTS);
    _state.robots = robots;
    _state.npcs = npcs;
    _state.fear = fear;
    _state.activeRobot = activeRobot;
    _state.isDroneMode = isDroneMode;
    if (mothership) _state.mothership = deepMerge(DEFAULTS.mothership, mothership);
    if (ship400i) _state.ship400i = deepMerge(DEFAULTS.ship400i, ship400i);

    _saveLocal();
    _notify(_state);

    ["warp-unit-mission", "warp-unit-mothership", "warp-unit-400i", "warp-unit-catalog"].forEach(function (k) {
      localStorage.removeItem(k);
    });
  }

  window.addEventListener("storage", function (e) {
    if (e.key !== KEY || !e.newValue) return;
    if (_mode !== "local") return;
    try {
      var incoming = JSON.parse(e.newValue);
      _state = deepMerge(DEFAULTS, incoming);
      _notify(_state);
    } catch (ex) {}
  });

  window.WarpStore = {
    mode: _mode,

    init: function (opts) {
      opts = opts || {};
      _mode = opts.mode || "local";
      window.WarpStore.mode = _mode;

      if (_mode === "local") {
        _migrate();
        _loadFromStorage();
        _notify(_state);
        return;
      }

      if (_mode === "p2p") {
        _remoteOpts = opts;
        _state = deepClone(DEFAULTS);
        if (opts.role === "gm") {
          _migrate();
          _loadFromStorage();
          _notify(_state);
          _readyPromise = Promise.resolve();
          if (typeof WarpP2P !== "undefined") {
            WarpP2P.on("message", function (msg) {
              if (msg.type === "request") {
                _state.pendingActions = _state.pendingActions || [];
                _state.pendingActions.push({
                  id: "req-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                  type: "energyIncrement",
                  robotId: msg.robotId,
                  amount: msg.amount,
                  requestedAt: new Date().toISOString(),
                });
                _saveLocal();
                _broadcast();
                _notify(_state);
              } else if (msg.type === "chat") {
                _state.messages = _state.messages || [];
                _state.messages.push({
                  id: "msg-" + Date.now().toString(36),
                  from: msg.from,
                  to: msg.to,
                  text: msg.text,
                  sentAt: new Date().toISOString(),
                  read: false,
                });
                _saveLocal();
                _broadcast();
                _notify(_state);
              }
            });
          }
        } else {
          var _p2pSynced = false;
          _readyPromise = new Promise(function (r) { _p2pSynced = r; });
          var synced = false;
          if (typeof WarpP2P !== "undefined") {
            WarpP2P.on("message", function (msg) {
              if (msg.type === "sync") {
                if (msg.state) _state = deepMerge(_state, msg.state);
                if (Array.isArray(msg.sessions)) _state.sessions = msg.sessions;
                if (Array.isArray(msg.messages)) _state.messages = msg.messages;
                if (Array.isArray(msg.pendingActions)) _state.pendingActions = msg.pendingActions;
                _notify(_state);
                if (!synced) { synced = true; _p2pSynced(); }
              }
            });
          }
        }
      }
    },

    get: _get,
    set: _set,
    ready: function () { return _readyPromise || Promise.resolve(); },
    getAll: function () { return deepClone(_state); },

    subscribe: function (fn) {
      if (typeof fn !== "function") return function () {};
      _subs.push(fn);
      return function () {
        var idx = _subs.indexOf(fn);
        if (idx >= 0) _subs.splice(idx, 1);
      };
    },

    clear: function () {
      _state = deepClone(DEFAULTS);
      if (_mode === "local") {
        _saveLocal();
        localStorage.removeItem(KEY);
      }
      _notify(_state);
    },

    resetRobots: function (robotDataArray) {
      var robots = {};
      for (var i = 0; i < robotDataArray.length; i++) {
        robots[robotDataArray[i].id] = robotDataArray[i].startingEnergy;
      }
      _state.robots = robots;
      _state.fear = 0;
      _state.npcs = [5, 5, 5];
      _saveLocal();
      _notify(_state);
    },

    getPendingActions: function () {
      return deepClone(_state.pendingActions || []);
    },

    getSessions: function () {
      return deepClone(_state.sessions || []);
    },

    getActiveSession: function () {
      var sessions = _state.sessions || [];
      for (var i = 0; i < sessions.length; i++) {
        if (!sessions[i].endedAt) return deepClone(sessions[i]);
      }
      return null;
    },

    getMessages: function (recipientId) {
      var all = _state.messages || [];
      if (!recipientId) return deepClone(all);
      return deepClone(all.filter(function (m) { return m.to === recipientId; }));
    },

    sendMessage: function (fromId, toId, text) {
      if (_mode === "local" && typeof WarpP2P !== "undefined" && WarpP2P.isOpen() && WarpP2P.getRole() === "gm") {
        _state.messages = _state.messages || [];
        _state.messages.push({ id: "msg-" + Date.now().toString(36), from: fromId, to: toId, text: text, sentAt: new Date().toISOString(), read: false });
        _saveLocal();
        _broadcast();
        _notify(_state);
        return;
      }
      if (_mode === "p2p" && _remoteOpts.role !== "gm") {
        if (typeof WarpP2P !== "undefined") WarpP2P.send("gm", { type: "chat", from: fromId, to: toId, text: text });
      }
    },

    dismissMessage: function (messageId) {
      if (_mode === "local" && typeof WarpP2P !== "undefined" && WarpP2P.isOpen() && WarpP2P.getRole() === "gm") {
        _state.messages = (_state.messages || []).filter(function (m) { return m.id !== messageId; });
        _saveLocal();
        _broadcast();
        _notify(_state);
      }
    },

    addLogEntry: function (sessionId, text) {
      if (_mode === "local" && typeof WarpP2P !== "undefined" && WarpP2P.isOpen() && WarpP2P.getRole() === "gm") {
        var sessions = _state.sessions || [];
        for (var i = 0; i < sessions.length; i++) {
          if (sessions[i].id === sessionId && !sessions[i].endedAt) {
            sessions[i].log = sessions[i].log || [];
            sessions[i].log.push({ time: ("0" + new Date().getHours()).slice(-2) + ":" + ("0" + new Date().getMinutes()).slice(-2), text: text });
            _state.sessions = sessions;
            break;
          }
        }
        _saveLocal();
        _broadcast();
        _notify(_state);
      }
    },

    getRemoteOpts: function () {
      return _remoteOpts ? deepClone(_remoteOpts) : null;
    },

    destroy: function () {
      _remoteOpts = null;
      _mode = "local";
      window.WarpStore.mode = _mode;
    },
  };
})();
