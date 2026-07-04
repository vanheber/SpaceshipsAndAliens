// WARP-Unit P2P — WebRTC DataChannel
// GM is the host. Players connect via manual SDP exchange (QR/clipboard).
// ponytail: STUN-only (no TURN), ceiling: symmetric NAT fails.
//           Upgrade: add free TURN (metered.ca) for relay fallback.

(function () {
  "use strict";

  var ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  var _peers = {};
  var _dcs = {};
  var _role = null;
  var _handlers = {};

  function _emit(name, data) {
    var fn = _handlers[name];
    if (fn) fn(data);
  }

  function _setupDC(pc, dc, peerId) {
    dc.onopen = function () { _emit("ready", peerId); };
    dc.onclose = function () { _emit("close", peerId); };
    dc.onmessage = function (e) {
      try { _emit("message", JSON.parse(e.data)); } catch (ex) {}
    };
    pc.oniceconnectionstatechange = function () {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        _emit("close", peerId);
      }
    };
  }

  function _waitIce(pc) {
    return new Promise(function (resolve) {
      if (pc.iceGatheringState === "complete") resolve();
      else pc.onicegatheringstatechange = function () {
        if (pc.iceGatheringState === "complete") resolve();
      };
    });
  }

  function createOffer() {
    _role = "gm";
    var peerId = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var pc = new RTCPeerConnection(ICE);
    var dc = pc.createDataChannel("warp");
    _setupDC(pc, dc, peerId);
    _peers[peerId] = pc;
    _dcs[peerId] = dc;
    return pc.createOffer()
      .then(function (offer) { return pc.setLocalDescription(offer); })
      .then(function () { return _waitIce(pc); })
      .then(function () {
        return { peerId: peerId, offer: btoa(JSON.stringify(pc.localDescription)) };
      });
  }

  function acceptAnswer(peerId, answerB64) {
    var pc = _peers[peerId];
    if (!pc) return Promise.reject(new Error("Unknown peer: " + peerId));
    var answer = JSON.parse(atob(answerB64));
    return pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  function joinRoom(offerB64) {
    _role = "player";
    var peerId = "gm";
    var pc = new RTCPeerConnection(ICE);
    _peers[peerId] = pc;
    pc.ondatachannel = function (e) {
      var dc = e.channel;
      _dcs[peerId] = dc;
      _setupDC(pc, dc, peerId);
    };
    var offer = JSON.parse(atob(offerB64));
    return pc.setRemoteDescription(new RTCSessionDescription(offer))
      .then(function () { return pc.createAnswer(); })
      .then(function (answer) { return pc.setLocalDescription(answer); })
      .then(function () { return _waitIce(pc); })
      .then(function () {
        return btoa(JSON.stringify(pc.localDescription));
      });
  }

  function send(peerId, data) {
    if (peerId) {
      var dc = _dcs[peerId];
      if (dc && dc.readyState === "open") dc.send(JSON.stringify(data));
    } else {
      Object.keys(_dcs).forEach(function (id) {
        var dc = _dcs[id];
        if (dc && dc.readyState === "open") dc.send(JSON.stringify(data));
      });
    }
  }

  function closePeer(peerId) {
    var dc = _dcs[peerId];
    var pc = _peers[peerId];
    if (dc) { dc.close(); delete _dcs[peerId]; }
    if (pc) { pc.close(); delete _peers[peerId]; }
  }

  function close() {
    Object.keys(_dcs).forEach(function (id) { closePeer(id); });
    _role = null;
  }

  function getRole() { return _role; }

  function on(name, fn) { _handlers[name] = fn; }
  function off(name) { delete _handlers[name]; }

  function isOpen() { return _dcs && Object.keys(_dcs).length > 0; }

  window.WarpP2P = {
    createOffer: createOffer,
    acceptAnswer: acceptAnswer,
    joinRoom: joinRoom,
    send: send,
    close: close,
    closePeer: closePeer,
    getRole: getRole,
    isOpen: isOpen,
    on: on,
    off: off,
  };
})();
