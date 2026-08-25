// Spaceships and Aliens P2P — WebRTC DataChannel
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
      try {
        var msg = JSON.parse(e.data);
        msg._peerId = peerId;
        _emit("message", msg);
      } catch (ex) {}
    };
    pc.oniceconnectionstatechange = function () {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        _emit("close", peerId);
      }
    };
  }

  function _waitIce(pc) {
    return new Promise(function (resolve) {
      if (pc.iceGatheringState === "complete") return resolve();
      var timer = setTimeout(function () { resolve(); }, 10000);
      pc.onicegatheringstatechange = function () {
        if (pc.iceGatheringState === "complete") { clearTimeout(timer); resolve(); }
      };
    });
  }

  // Convert hex fingerprint (with/without colons) to base64
  function _fpHexToB64(hex) {
    var clean = hex.replace(/:/g, "").replace(/\s/g, "");
    var bytes = new Uint8Array(clean.length / 2);
    for (var i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
    }
    var binary = "";
    for (var j = 0; j < bytes.length; j++) {
      binary += String.fromCharCode(bytes[j]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // Convert base64 fingerprint back to hex with colons
  function _fpB64ToHex(b64) {
    var safe = b64.replace(/-/g, "+").replace(/_/g, "/");
    while (safe.length % 4) safe += "=";
    var binary = atob(safe);
    var hex = "";
    for (var i = 0; i < binary.length; i++) {
      var h = binary.charCodeAt(i).toString(16);
      if (h.length < 2) h = "0" + h;
      hex += h.toUpperCase();
      if (i < binary.length - 1) hex += ":";
    }
    return hex;
  }

  // Encode a single ICE candidate line to compact form
  function _compactCandidate(candLine) {
    var parts = candLine.split(" ");
    // Format: foundation,component,protocol,priority,ip,port,type[,relAddr,relPort]
    // type: host -> h, srflx -> s, relay -> r
    var typ = parts[7]; // typ host/srflx/relay
    var t = typ === "srflx" ? "s" : typ === "relay" ? "r" : "h";
    var c = [parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], t];
    if (typ === "srflx" && parts[9] && parts[11]) {
      c.push(parts[9], parts[11]); // raddr, rport
    }
    return c.join(",");
  }

  // Decode compact candidate back to ICE line
  function _expandCandidate(compact) {
    var parts = compact.split(",");
    var foundation = parts[0];
    var component = parts[1];
    var protocol = parts[2];
    var priority = parts[3];
    var ip = parts[4];
    var port = parts[5];
    var t = parts[6];
    var typ = t === "s" ? "srflx" : t === "r" ? "relay" : "host";
    var line = foundation + " " + component + " " + protocol + " " + priority + " " + ip + " " + port + " typ " + typ;
    if (t === "s" && parts.length >= 9) {
      line += " raddr " + parts[7] + " rport " + parts[8];
    }
    return line;
  }

  // Extract compact SDP fields from raw SDP string
  function _buildCompact(sdp) {
    var lines = sdp.split("\r\n");
    var ufrag = "", pwd = "", fp = "", mid = "0", sessId = "", sctpPort = "5000";
    var candidates = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf("a=ice-ufrag:") === 0) ufrag = line.substring(12);
      else if (line.indexOf("a=ice-pwd:") === 0) pwd = line.substring(10);
      else if (line.indexOf("a=fingerprint:sha-256 ") === 0) fp = _fpHexToB64(line.substring(22));
      else if (line.indexOf("a=mid:") === 0) mid = line.substring(6);
      else if (line.indexOf("a=sctp-port:") === 0) sctpPort = line.substring(13);
      else if (line.indexOf("a=candidate:") === 0) candidates.push(_compactCandidate(line.substring(13)));
      else if (line.indexOf("o=-") === 0) {
        var m = /o=- (\d+)/.exec(line);
        if (m) sessId = m[1];
      }
    }
    return [ufrag, pwd, fp, mid, sessId, sctpPort].concat(candidates).join("|");
  }

  // Rebuild full SDP from compact string
  function _expandCompact(compactStr) {
    var parts = compactStr.split("|");
    var ufrag = parts[0];
    var pwd = parts[1];
    var fp = _fpB64ToHex(parts[2]);
    var mid = parts[3] || "0";
    var sessId = parts[4] || Date.now().toString();
    var sctpPort = parts[5] || "5000";
    var lines = [
      "v=0",
      "o=- " + sessId + " 2 IN IP4 127.0.0.1",
      "s=-",
      "t=0 0",
      "a=group:BUNDLE " + mid,
      "a=extmap-allow-mixed",
      "a=msid-semantic: WMS",
      "m=application " + sctpPort + " UDP/DTLS/SCTP webrtc-datachannel",
      "c=IN IP4 0.0.0.0",
      "a=ice-ufrag:" + ufrag,
      "a=ice-pwd:" + pwd,
      "a=ice-options:trickle",
      "a=fingerprint:sha-256 " + fp,
      "a=setup:actpass",
      "a=mid:" + mid,
      "a=sctp-port:" + sctpPort,
      "a=max-message-size:262144"
    ];
    for (var i = 6; i < parts.length; i++) {
      lines.push("a=candidate:" + _expandCandidate(parts[i]));
    }
    return lines.join("\r\n") + "\r\n";
  }

  function createOffer() {
    _role = "gm";
    var peerId = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    var pc = new RTCPeerConnection(ICE);
    var dc = pc.createDataChannel("sna");
    _setupDC(pc, dc, peerId);
    _peers[peerId] = pc;
    _dcs[peerId] = dc;
    return pc.createOffer()
      .then(function (offer) { return pc.setLocalDescription(offer); })
      .then(function () { return _waitIce(pc); })
      .then(function () {
        var sdp = pc.localDescription.sdp;
        return {
          peerId: peerId,
          offer: btoa(JSON.stringify(pc.localDescription)),
          compact: _buildCompact(sdp)
        };
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

  // Join via compact token (short QR-friendly format)
  function joinRoomCompact(compactStr) {
    _role = "player";
    var peerId = "gm";
    var pc = new RTCPeerConnection(ICE);
    _peers[peerId] = pc;
    pc.ondatachannel = function (e) {
      var dc = e.channel;
      _dcs[peerId] = dc;
      _setupDC(pc, dc, peerId);
    };
    var sdp = _expandCompact(compactStr);
    var desc = { type: "offer", sdp: sdp };
    return pc.setRemoteDescription(new RTCSessionDescription(desc))
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

  window.SnaP2P = {
    createOffer: createOffer,
    acceptAnswer: acceptAnswer,
    joinRoom: joinRoom,
    joinRoomCompact: joinRoomCompact,
    send: send,
    close: close,
    closePeer: closePeer,
    getRole: getRole,
    isOpen: isOpen,
    on: on,
    off: off,
  };
})();
