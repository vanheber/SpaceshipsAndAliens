// WARP-Unit P2P Hub Client
// Proxies WarpP2P through a BroadcastChannel to p2p-hub.html,
// so page reloads don't kill WebRTC connections.

(function () {
  "use strict";
  if (typeof BroadcastChannel === "undefined" || typeof WarpP2P === "undefined") return;

  var bc = new BroadcastChannel("warp-p2p");
  var _reqId = 0;
  var _pending = {};
  var _listeners = {};
  var _role = null;
  var _open = false;
  var _hubWindow = null;

  function _sendCmd(cmd, payload, timeout) {
    var id = "r" + (++_reqId);
    return new Promise(function (resolve, reject) {
      _pending[id] = { resolve: resolve, reject: reject };
      bc.postMessage(Object.assign({ type: "p2p-cmd", cmd: cmd, id: id }, payload));
      var to = setTimeout(function () {
        if (_pending[id]) {
          delete _pending[id];
          reject(new Error("Timeout P2P hub"));
        }
      }, timeout || 15000);
      _pending[id]._to = to;
    });
  }

  function _clearPending() {
    Object.keys(_pending).forEach(function (id) {
      clearTimeout(_pending[id]._to);
      delete _pending[id];
    });
  }

  bc.onmessage = function (e) {
    var m = e.data;
    if (!m) return;
    if (m.type === "p2p-res") {
      var p = _pending[m.id];
      if (p) {
        clearTimeout(p._to);
        delete _pending[m.id];
        if (m.error) p.reject(new Error(m.error));
        else p.resolve(m);
      }
    } else if (m.type === "p2p-event") {
      if (m.event === "ready") {
        _open = true;
        if (_listeners["ready"]) _listeners["ready"].forEach(function (fn) { fn(m.peerId); });
      } else if (m.event === "close") {
        if (_listeners["close"]) _listeners["close"].forEach(function (fn) { fn(m.peerId); });
      } else if (m.event === "message") {
        if (_listeners["message"]) _listeners["message"].forEach(function (fn) { fn(m.data); });
      } else if (m.event === "pong") {
        _role = m.role;
        _open = !!m.open;
        var p = _pending["ping"];
        if (p) { clearTimeout(p._to); delete _pending["ping"]; p.resolve(true); }
      } else if (m.event === "closed") {
        _open = false;
        _role = null;
        _clearPending();
      }
    }
  };

  // Attempt to open hub window (must be called from user gesture)
  function _openHub() {
    if (_hubWindow && !_hubWindow.closed) return Promise.resolve(true);
    _hubWindow = window.open("p2p-hub.html", "warp-p2p-hub", "width=400,height=300");
    return new Promise(function (resolve) {
      if (!_hubWindow) { resolve(false); return; }
      // Wait for hub to signal back via first ping
      var check = setInterval(function () {
        if (_hubWindow.closed) { clearInterval(check); resolve(false); return; }
        pingHub().then(function (ok) { if (ok) { clearInterval(check); resolve(true); } });
      }, 300);
      setTimeout(function () { clearInterval(check); resolve(pingHub()); }, 3000);
    });
  }

  function pingHub() {
    var id = "ping";
    return new Promise(function (resolve) {
      var to = setTimeout(function () { resolve(false); }, 1000);
      _pending[id] = { resolve: function () { clearTimeout(to); resolve(true); }, reject: function () { clearTimeout(to); resolve(false); }, _to: to };
      bc.postMessage({ type: "p2p-cmd", cmd: "ping", id: id });
    });
  }

  // Override WarpP2P with hub proxy
  var _orig = {};
  ["createOffer", "acceptAnswer", "joinRoom", "joinRoomCompact", "send", "close", "closePeer", "getRole", "isOpen", "on", "off"].forEach(function (k) { _orig[k] = WarpP2P[k]; });

  // Partially apply: use hub if active, fallback to direct
  function _useHub() { return _hubWindow && !_hubWindow.closed; }

  WarpP2P._hubActive = false;

  WarpP2P.hubConnect = function () {
    if (_useHub()) return Promise.resolve(true);
    return _openHub().then(function (ok) {
      WarpP2P._hubActive = ok;
      return ok;
    });
  };

  WarpP2P.createOffer = function () {
    if (!_useHub()) return _orig.createOffer();
    return _sendCmd("createOffer", {}).then(function (r) {
      return { peerId: r.peerId, offer: r.offer, compact: r.compact };
    });
  };

  WarpP2P.acceptAnswer = function (peerId, answer) {
    if (!_useHub()) return _orig.acceptAnswer(peerId, answer);
    return _sendCmd("acceptAnswer", { peerId: peerId, answer: answer }).then(function () {});
  };

  WarpP2P.joinRoom = function (offer) {
    if (!_useHub()) return _orig.joinRoom(offer);
    return _sendCmd("joinRoom", { offer: offer }).then(function (r) { return r.answer; });
  };

  WarpP2P.joinRoomCompact = function (compact) {
    if (!_useHub()) return _orig.joinRoomCompact(compact);
    return _sendCmd("joinRoomCompact", { compact: compact }).then(function (r) { return r.answer; });
  };

  WarpP2P.send = function (peerId, data) {
    if (!_useHub()) return _orig.send(peerId, data);
    bc.postMessage({ type: "p2p-cmd", cmd: "send", peerId: peerId, data: data });
  };

  WarpP2P.close = function () {
    if (!_useHub()) return _orig.close();
    _sendCmd("close", {}).catch(function () {});
    _open = false;
    _role = null;
    _hubWindow = null;
  };

  WarpP2P.getRole = function () {
    if (!_useHub()) return _orig.getRole();
    return _role || _orig.getRole();
  };

  WarpP2P.isOpen = function () {
    if (!_useHub()) return _orig.isOpen();
    return _open || false;
  };

  WarpP2P.on = function (name, fn) {
    if (!_useHub()) return _orig.on(name, fn);
    if (!_listeners[name]) _listeners[name] = [];
    _listeners[name].push(fn);
  };

  WarpP2P.off = function (name, fn) {
    if (!_useHub()) _orig.off(name, fn);
    if (_listeners[name]) _listeners[name] = _listeners[name].filter(function (f) { return f !== fn; });
  };
})();
