(function () {
  "use strict";

  // ── Palettes ──
  var P = {
    ship:   { floor: 0x4a5a6a, wall: 0x2a3a4a, accent: 0x6a8aaa },
    space:  { floor: 0x3a3a4a, wall: 0x1a1a2a, accent: 0x5a5a7a },
    rescue: { floor: 0x5a5a5a, wall: 0x3a3a3a, accent: 0xe87a2a },
    ruins:  { floor: 0x7a6b55, wall: 0x5a4a35, accent: 0xc4a77d },
    phenomenon: { floor: 0x4a2a6a, wall: 0x2a1a4a, accent: 0x8a5aba },
    danger: { floor: 0x5a4040, wall: 0x3a2525, accent: 0xcc4444 },
    jungle: { floor: 0x2d5a27, wall: 0x1a3d15, accent: 0x4caf50 },
    desert: { floor: 0xc2a050, wall: 0x8b7340, accent: 0xe6c87a },
    tundra: { floor: 0x7ab8d4, wall: 0x4a8099, accent: 0xa8d8ea },
    ocean:  { floor: 0x1a5276, wall: 0x0e3451, accent: 0x2980b9 },
    volcanic: { floor: 0x4a4a4a, wall: 0x2d2d2d, accent: 0xc0392b },
    crystalline: { floor: 0x8e44ad, wall: 0x5b2c6f, accent: 0xbb8fce },
    gasgiant: { floor: 0x6c3483, wall: 0x3d1f52, accent: 0xa569bd },
    default: { floor: 0x3a3f44, wall: 0x25292d, accent: 0x5a6068 }
  };

  var PLANET_KEYS = [
    { match: "deserto", key: "desert" },
    { match: "selva", key: "jungle" },
    { match: "bioluminescente", key: "jungle" },
    { match: "tundra", key: "tundra" },
    { match: "oceano", key: "ocean" },
    { match: "vulc", key: "volcanic" },
    { match: "cristal", key: "crystalline" },
    { match: "caverna", key: "ruins" },
    { match: "pântano", key: "jungle" },
    { match: "fúngico", key: "jungle" },
    { match: "ermo", key: "desert" },
    { match: "tempestade", key: "default" },
    { match: "cinzas", key: "volcanic" },
    { match: "gasoso", key: "gasgiant" },
    { match: "floresta", key: "jungle" }
  ];

  // ── Seeded RNG ──
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashCode(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  function lightenColor(hex, pct) {
    var r = (hex >> 16) & 0xff;
    var g = (hex >> 8) & 0xff;
    var b = hex & 0xff;
    r = Math.min(255, r + Math.floor((255 - r) * pct / 100));
    g = Math.min(255, g + Math.floor((255 - g) * pct / 100));
    b = Math.min(255, b + Math.floor((255 - b) * pct / 100));
    return (r << 16) | (g << 8) | b;
  }

  // ── Palette resolution ──
  function resolvePalette(planet, disc) {
    if (disc.encounterType === "ship") return P.ship;
    if (disc.encounterType === "space") return P.space;
    if (disc.encounterType === "rescue") return P.rescue;
    if (disc.categoryKey === "ruins") return P.ruins;
    if (disc.categoryKey === "phenomenon") return P.phenomenon;
    if (disc.categoryKey === "danger") return P.danger;
    if (planet && planet.type) {
      var t = planet.type.toLowerCase();
      for (var i = 0; i < PLANET_KEYS.length; i++) {
        if (t.indexOf(PLANET_KEYS[i].match) !== -1)
          return P[PLANET_KEYS[i].key];
      }
    }
    return P.default;
  }

  // ── Layout generation ──
  function generateLayout(seed, roomCount, palette) {
    var rng = mulberry32(seed);
    var GRID = Math.min(25, 11 + roomCount * 2);
    var HALF = (GRID - 1) / 2;
    var grid = new Uint8Array(GRID * GRID);
    var rooms = [];
    var isStructured = (palette === P.ship || palette === P.space || palette === P.rescue);

    // 1. Scatter rooms in disc
    var R = Math.sqrt(roomCount) * 3.5;
    for (var i = 0; i < roomCount; i++) {
      var t = rng();
      var w = t < 0.4 ? 3 + Math.floor(rng() * 2) : t < 0.8 ? 5 + Math.floor(rng() * 2) : 7 + Math.floor(rng() * 2);
      var h = t < 0.4 ? 3 + Math.floor(rng() * 2) : t < 0.8 ? 5 + Math.floor(rng() * 2) : 7 + Math.floor(rng() * 2);
      var sr = rng();
      var shape = isStructured
        ? (sr < 0.55 ? "rect" : sr < 0.85 ? "oct" : "ellipse")
        : (sr < 0.25 ? "rect" : sr < 0.50 ? "oct" : sr < 0.80 ? "ellipse" : "irregular");
      var ang = rng() * Math.PI * 2;
      var rad = R * Math.sqrt(rng());
      rooms.push({ id: i, cx: HALF + Math.cos(ang) * rad, cz: HALF + Math.sin(ang) * rad, w: w, h: h, shape: shape, type: "room", _prot: 0 });
    }
    rooms[0].cx = HALF; rooms[0].cz = HALF;
    if (isStructured) rooms[0].shape = "rect";

    // 2. Push-apart separation (100 iterations)
    var HW = rooms.map(function (r) { return r.w / 2; });
    var HH = rooms.map(function (r) { return r.h / 2; });
    var CX = rooms.map(function (r) { return r.cx; });
    var CZ = rooms.map(function (r) { return r.cz; });
    for (var iter = 0; iter < 100; iter++) {
      var moved = false;
      for (var i = 0; i < roomCount; i++) {
        for (var j = i + 1; j < roomCount; j++) {
          var ox = HW[i] + HW[j] + 2 - Math.abs(CX[i] - CX[j]);
          if (ox <= 0) continue;
          var oy = HH[i] + HH[j] + 2 - Math.abs(CZ[i] - CZ[j]);
          if (oy <= 0) continue;
          moved = true;
          if (ox < oy) { var s = CX[i] < CX[j] ? -1 : 1; CX[i] += s * ox * 0.5 + 0.5; CX[j] -= s * ox * 0.5 + 0.5; }
          else         { var s = CZ[i] < CZ[j] ? -1 : 1; CZ[i] += s * oy * 0.5 + 0.5; CZ[j] -= s * oy * 0.5 + 0.5; }
        }
      }
      if (!moved) break;
    }
    for (var i = 0; i < roomCount; i++) {
      var p = Math.max(rooms[i].w, rooms[i].h) / 2 + 1;
      rooms[i].cx = Math.max(p, Math.min(GRID - p - 1, CX[i]));
      rooms[i].cz = Math.max(p, Math.min(GRID - p - 1, CZ[i]));
    }

    // 3. Type: entrance = 0, boss = largest, rest = room
    var bossId = 0;
    for (var i = 1; i < roomCount; i++)
      if (rooms[i].w * rooms[i].h > rooms[bossId].w * rooms[bossId].h) bossId = i;
    rooms[0].type = "entrance";
    rooms[bossId].type = "boss";

    // 4. Stamp shapes into grid
    function stamp(r) {
      var rx = r.w / 2, ry = r.h / 2, cx = r.cx, cz = r.cz;
      var ch = Math.min(rx, ry) * 0.55;
      var irx2 = 1 / (rx * rx), iry2 = 1 / (ry * ry);
      var z0 = Math.max(0, Math.floor(cz - ry)), z1 = Math.min(GRID - 1, Math.ceil(cz + ry));
      var x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(GRID - 1, Math.ceil(cx + rx));
      for (var z = z0; z <= z1; z++) {
        var dz = z - cz, adz = Math.abs(dz);
        if (adz > ry) continue;
        for (var x = x0; x <= x1; x++) {
          var dx = x - cx, adx = Math.abs(dx);
          if (adx > rx) continue;
          var ok = false;
          if (r.shape === "rect") ok = true;
          else if (r.shape === "ellipse") ok = dx * dx * irx2 + dz * dz * iry2 <= 1;
          else if (r.shape === "oct") ok = (adx <= rx - ch || adz <= ry - ch) || (adx - (rx - ch)) + (adz - (ry - ch)) <= ch;
          else ok = true; // irregular = rect with protrusion below
          if (ok) grid[z * GRID + x] = 1;
        }
      }
      // irregular: add a small protrusion on a random side
      if (r.shape === "irregular" && r.w > 3 && r.h > 3) {
        var side = Math.floor(rng() * 4);
        var pw = 1 + Math.floor(rng() * 2), ph = 1 + Math.floor(rng() * 2);
        for (var pz = 0; pz < ph; pz++) for (var px = 0; px < pw; px++) {
          var sx = side === 0 ? cx - rx - pw + px + 0.5 : side === 1 ? cx + rx - 0.5 - px : cx + (px - Math.floor(pw / 2)) + 0.5;
          var sz = side === 2 ? cz - ry - ph + pz + 0.5 : side === 3 ? cz + ry - 0.5 - pz : cz + (pz - Math.floor(ph / 2)) + 0.5;
          var tx = Math.round(sx), tz = Math.round(sz);
          if (tx >= 0 && tx < GRID && tz >= 0 && tz < GRID && grid[tz * GRID + tx] === 0) grid[tz * GRID + tx] = 1;
        }
        r._prot = side + 1;
      }
    }
    for (var ri = 0; ri < rooms.length; ri++) stamp(rooms[ri]);

    // 5. Corridors (L-shaped, alternate bend order)
    function corridor(a, b) {
      var ax = Math.round(a.cx), az = Math.round(a.cz);
      var bx = Math.round(b.cx), bz = Math.round(b.cz);
      var cx0 = Math.min(ax, bx), cx1 = Math.max(ax, bx);
      var cz0 = Math.min(az, bz), cz1 = Math.max(az, bz);
      if (rng() < 0.5) {
        for (var x = cx0; x <= cx1; x++) if (grid[az * GRID + x] === 0) grid[az * GRID + x] = 1;
        for (var z = cz0; z <= cz1; z++) if (grid[z * GRID + bx] === 0) grid[z * GRID + bx] = 1;
      } else {
        for (var z = cz0; z <= cz1; z++) if (grid[z * GRID + ax] === 0) grid[z * GRID + ax] = 1;
        for (var x = cx0; x <= cx1; x++) if (grid[bz * GRID + x] === 0) grid[bz * GRID + x] = 1;
      }
    }
    for (var ri = 1; ri < rooms.length; ri++) corridor(rooms[0], rooms[ri]);

    // 6. Z-corridors (extra jog for natural)
    if (!isStructured) {
      for (var ri = 1; ri < rooms.length; ri += 2) {
        var r = rooms[ri];
        var jx = Math.round((r.cx + rooms[0].cx) / 2 + (rng() - 0.5) * 3);
        var jz = Math.round((r.cz + rooms[0].cz) / 2 + (rng() - 0.5) * 3);
        if (jx > 0 && jx < GRID - 1 && jz > 0 && jz < GRID - 1 && grid[jz * GRID + jx] === 0)
          grid[jz * GRID + jx] = 1;
      }
    }

    // 7. Walls (void adjacent to floor)
    var N4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var z = 0; z < GRID; z++) {
      for (var x = 0; x < GRID; x++) {
        if (grid[z * GRID + x] !== 1) continue;
        for (var ni = 0; ni < 4; ni++) {
          var nx = x + N4[ni][0], nz = z + N4[ni][1];
          if (nx < 0 || nx >= GRID || nz < 0 || nz >= GRID) continue;
          if (grid[nz * GRID + nx] === 0) grid[nz * GRID + nx] = 2;
        }
      }
    }

    // 8. Corner blocks (1×1 pillars at convex corners)
    for (var ri = 0; ri < rooms.length; ri++) {
      if (rng() > 0.5) continue;
      var r = rooms[ri];
      var rx = r.w / 2, ry = r.h / 2;
      var corners = [
        [Math.round(r.cx - Math.floor(rx)), Math.round(r.cz - Math.floor(ry))],
        [Math.round(r.cx + Math.floor(rx)), Math.round(r.cz - Math.floor(ry))],
        [Math.round(r.cx - Math.floor(rx)), Math.round(r.cz + Math.floor(ry))],
        [Math.round(r.cx + Math.floor(rx)), Math.round(r.cz + Math.floor(ry))]
      ];
      for (var ci = 0; ci < 4; ci++) {
        if (rng() > 0.4) continue;
        var xx = corners[ci][0], zz = corners[ci][1];
        if (xx < 1 || xx >= GRID - 1 || zz < 1 || zz >= GRID - 1 || grid[zz * GRID + xx] !== 0) continue;
        var fn = 0;
        for (var ni = 0; ni < 4; ni++) { var nx = xx + N4[ni][0], nz = zz + N4[ni][1]; if (grid[nz * GRID + nx] === 1) fn++; }
        if (fn === 2) grid[zz * GRID + xx] = 2;
      }
    }

    // 9. Assign props
    var props_pool = ["console", "terminal", "crystal", "pillar", "debris", "beacon"];
    for (var ri = 0; ri < rooms.length; ri++)
      rooms[ri].prop = pickProp(rooms[ri].type, palette, rng, props_pool);

    // 10. Elevation map (0 = normal, -1 = lowered, -2 = pit/hole)
    var elev = new Int8Array(GRID * GRID);
    var hasWater = (palette === P.ocean || palette === P.tundra);
    var hasPits = (palette === P.ruins || palette === P.ship || palette === P.volcanic || palette === P.desert || palette === P.crystalline);

    if (hasWater) {
      for (var ri = 0; ri < rooms.length; ri++) {
        if (rng() > 0.35) continue;
        var r = rooms[ri];
        var rx = Math.floor(r.w / 2) - 1, ry = Math.floor(r.h / 2) - 1;
        if (rx < 1 || ry < 1) continue;
        var wx = Math.round(r.cx) + (Math.floor(rng() * (rx * 2)) - rx);
        var wz = Math.round(r.cz) + (Math.floor(rng() * (ry * 2)) - ry);
        for (var dz = -1; dz <= 1; dz++) for (var dx = -1; dx <= 1; dx++) {
          var tx = wx + dx, tz = wz + dz;
          if (tx >= 0 && tx < GRID && tz >= 0 && tz < GRID && grid[tz * GRID + tx] === 1) {
            var eIdx = tz * GRID + tx;
            if (elev[eIdx] === 0) elev[eIdx] = -1;
          }
        }
      }
    }

    if (hasPits) {
      for (var ri = 0; ri < rooms.length; ri++) {
        if (rng() > 0.5) continue;
        var r = rooms[ri];
        var ox = Math.round(r.cx), oz = Math.round(r.cz);
        var pw = 2 + Math.floor(rng() * 2);
        var ph = 2 + Math.floor(rng() * 2);
        if (r.w < pw + 2 || r.h < ph + 2) continue;
        for (var dz = 0; dz < ph; dz++)
        for (var dx = 0; dx < pw; dx++) {
          var tx = ox - Math.floor(pw / 2) + dx, tz = oz - Math.floor(ph / 2) + dz;
          if (tx >= 0 && tx < GRID && tz >= 0 && tz < GRID && grid[tz * GRID + tx] === 1) {
            var eIdx = tz * GRID + tx;
            if (elev[eIdx] === 0) elev[eIdx] = -2;
          }
        }
      }
    }

    return { grid: grid, GRID: GRID, rooms: rooms, palette: palette, rng: rng,
             elev: elev, hasWater: hasWater, hasPits: hasPits };
  }

  function pickProp(roomType, palette, rng, pool) {
    if (palette === P.ship || palette === P.space) {
      if (roomType === "entrance") return "terminal";
      if (roomType === "boss") return "console";
      return rng() < 0.5 ? "console" : "terminal";
    }
    if (palette === P.rescue) return "beacon";
    if (palette === P.danger) return "debris";
    if (palette === P.ruins || palette === P.crystalline || palette === P.phenomenon) {
      if (roomType === "boss") return "crystal";
      return rng() < 0.4 ? "crystal" : "pillar";
    }
    // planet palettes
    if (roomType === "boss") return "crystal";
    return pool[Math.floor(rng() * pool.length)];
  }

  // ── Prop builders ──
  function buildConsole(palette) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.12, 0.45),
      new THREE.MeshStandardMaterial({ color: lightenColor(palette.wall, 15), roughness: 0.6 })
    );
    body.position.y = 0.06;
    g.add(body);
    var panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.02, 0.15),
      new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.4 })
    );
    panel.position.set(0, 0.16, -0.1);
    g.add(panel);
    var screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.22, 0.03),
      new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: 0.4, transparent: true, opacity: 0.8 })
    );
    screen.position.set(0, 0.32, -0.12);
    g.add(screen);
    var stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6),
      new THREE.MeshStandardMaterial({ color: palette.wall })
    );
    stand.position.set(0, 0.16, -0.12);
    g.add(stand);
    return g;
  }

  function buildTerminal(palette) {
    var g = new THREE.Group();
    var desk = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.06, 0.4),
      new THREE.MeshStandardMaterial({ color: lightenColor(palette.wall, 10), roughness: 0.7 })
    );
    desk.position.y = 0.03;
    g.add(desk);
    var mon = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.25, 0.04),
      new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: 0.5 })
    );
    mon.position.set(0, 0.25, -0.1);
    g.add(mon);
    var stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.03, 0.15, 6),
      new THREE.MeshStandardMaterial({ color: palette.wall })
    );
    stand.position.set(0, 0.12, -0.1);
    g.add(stand);
    var kb = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.02, 0.15),
      new THREE.MeshStandardMaterial({ color: lightenColor(palette.wall, 20) })
    );
    kb.position.set(0, 0.06, 0.08);
    g.add(kb);
    return g;
  }

  function buildPillar(palette) {
    var g = new THREE.Group();
    var base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.42, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.9 })
    );
    base.position.y = 0.05;
    g.add(base);
    var shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.9 })
    );
    shaft.position.y = 0.4;
    g.add(shaft);
    var cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.28, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.7 })
    );
    cap.position.y = 0.74;
    g.add(cap);
    var top = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 6),
      new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: 0.3 })
    );
    top.position.y = 0.82;
    g.add(top);
    return g;
  }

  function buildCrystal(palette, rng) {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: 0.25, transparent: true, opacity: 0.75 });
    for (var i = -1; i <= 1; i++) {
      for (var j = -1; j <= 1; j++) {
        if (i === 0 && j === 0) continue;
        if (rng() > 0.5) continue;
        var s = 0.5 + rng() * 0.8;
        var tip = new THREE.Mesh(new THREE.ConeGeometry(0.1 * s, 0.3 * s, 6), mat);
        tip.position.set(i * 0.15, 0.15 * s, j * 0.15);
        tip.rotation.set(rng() * 0.3, rng() * 6, rng() * 0.3);
        g.add(tip);
      }
    }
    var main = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 6), mat);
    main.position.y = 0.5;
    g.add(main);
    var base = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.2, 6),
      new THREE.MeshStandardMaterial({ color: palette.floor, flatShading: true })
    );
    base.rotation.x = Math.PI;
    base.position.y = 0.1;
    g.add(base);
    return g;
  }

  function buildDebris(palette, rng) {
    var g = new THREE.Group();
    var count = 2 + Math.floor(rng() * 3);
    for (var i = 0; i < count; i++) {
      var size = 0.12 + rng() * 0.25;
      var piece = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size, 0),
        new THREE.MeshStandardMaterial({ color: palette.wall, flatShading: true })
      );
      piece.position.set((rng() - 0.5) * 0.5, size * 0.4, (rng() - 0.5) * 0.5);
      piece.rotation.set(rng() * 6, rng() * 6, 0);
      g.add(piece);
    }
    return g;
  }

  function buildBeacon(palette) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: palette.wall })
    );
    pole.position.y = 0.3;
    g.add(pole);
    var light = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: 0.9 })
    );
    light.position.y = 0.66;
    g.add(light);
    var glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: 0.25, transparent: true, opacity: 0.3 })
    );
    glow.position.y = 0.66;
    g.add(glow);
    var base = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, 0.3),
      new THREE.MeshStandardMaterial({ color: palette.accent })
    );
    base.position.y = 0.03;
    g.add(base);
    return g;
  }

  // ── Chamfered box geometry (exato do threejs-procedural-dungeon) ──
  function chamferBox(w, h, d, ch) {
    var hw = w / 2, hd = d / 2;
    var iw = Math.max(0.01, hw - ch), id = Math.max(0.01, hd - ch), hb = Math.max(0.01, h - ch);
    var v = [];
    function q(a, b, c, e) {
      v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      v.push(a[0], a[1], a[2], c[0], c[1], c[2], e[0], e[1], e[2]);
    }
    var b0 = [-hw, 0, -hd], b1 = [hw, 0, -hd], b2 = [hw, 0, hd], b3 = [-hw, 0, hd];
    var m0 = [-hw, hb, -hd], m1 = [hw, hb, -hd], m2 = [hw, hb, hd], m3 = [-hw, hb, hd];
    var t0 = [-iw, h, -id], t1 = [iw, h, -id], t2 = [iw, h, id], t3 = [-iw, h, id];
    q(b1, b0, m0, m1); q(b3, b2, m2, m3); q(b2, b1, m1, m2); q(b0, b3, m3, m0);
    q(m1, m0, t0, t1); q(m3, m2, t2, t3); q(m2, m1, t1, t2); q(m0, m3, t3, t0);
    q(t0, t3, t2, t1); q(b0, b1, b2, b3);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    geo.computeVertexNormals();
    return geo;
  }

  // ── Active maps ──
  var activeMaps = {};

  // ── Three.js scene builder ──
  function buildMapScene(layout, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var GRID = layout.GRID;
    var HALF = (GRID - 1) / 2;
    var palette = layout.palette;
    var grid = layout.grid;

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(palette.wall, 0.0018);

    var pitch = 0.64, yaw = Math.PI / 4;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var f = new THREE.Vector3(cp * Math.sin(yaw), sp, cp * Math.cos(yaw));
    var camera = new THREE.OrthographicCamera(-GRID, GRID, GRID, -GRID, -400, 800);
    camera.position.set(0, 0, 0).copy(f).multiplyScalar(220);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0);
    var fit = GRID / (GRID * 0.62);
    camera.zoom = Math.min(2.2, Math.max(0.22, fit));
    camera.updateProjectionMatrix();

    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var size = (container.clientWidth || 320) | 0;
    renderer.setSize(size, size);
    container.appendChild(renderer.domElement);

    var hemi = new THREE.HemisphereLight(0x87CEEB, 0x3a2a1a, 0.35);
    scene.add(hemi);
    var dir = new THREE.DirectionalLight(0xffeedd, 1.2);
    dir.position.set(-GRID * 2, GRID * 1.5, GRID * 2);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.bias = -0.001;
    var shHalf = Math.ceil(GRID * 1.5);
    dir.shadow.camera.left = -shHalf;
    dir.shadow.camera.right = shHalf;
    dir.shadow.camera.top = shHalf;
    dir.shadow.camera.bottom = -shHalf;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = GRID * 8;
    dir.shadow.camera.updateProjectionMatrix();
    scene.add(dir);
    var fill = new THREE.DirectionalLight(0x8899bb, 0.2);
    fill.position.set(-GRID * 0.5, GRID * 0.3, GRID * 3);
    scene.add(fill);

    var floorGeo = chamferBox(0.98, 0.12, 0.98, 0.01);
    var wallGeo = chamferBox(0.98, 0.80, 0.98, 0.01);
    var floorMat = new THREE.MeshStandardMaterial({
      color: palette.floor, roughness: 0.85, side: THREE.DoubleSide
    });
    var wallMat = new THREE.MeshStandardMaterial({
      color: palette.wall, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide
    });
    var edgeGeo = new THREE.EdgesGeometry(wallGeo);
    var edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 });
    var waterMat = new THREE.MeshStandardMaterial({
      color: palette === P.tundra ? 0x88ccff : 0x2277aa,
      emissive: palette === P.tundra ? 0x4488cc : 0x114466,
      emissiveIntensity: 0.3,
      transparent: true, opacity: 0.55,
      roughness: 0.2, metalness: 0.4, side: THREE.DoubleSide
    });
    var pitWallMat = new THREE.MeshStandardMaterial({
      color: palette === P.volcanic ? 0x441100 : 0x000000,
      roughness: 1, metalness: 0, side: THREE.DoubleSide
    });
    var N4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    var elev = layout.elev || new Int8Array(GRID * GRID);

    // Step walls
    for (var z = 0; z < GRID; z++) for (var x = 0; x < GRID; x++) {
      var ei = z * GRID + x;
      if (grid[ei] !== 1 || elev[ei] >= 0) continue;
      for (var ni = 0; ni < 4; ni++) {
        var nx = x + N4[ni][0], nz = z + N4[ni][1];
        if (nx < 0 || nx >= GRID || nz < 0 || nz >= GRID) continue;
        var ni2 = nz * GRID + nx;
        if (grid[ni2] === 1 && elev[ni2] === 0) {
          var step = new THREE.Mesh(
            new THREE.BoxGeometry(N4[ni][0] !== 0 ? 0.05 : 0.98, 0.14, N4[ni][1] !== 0 ? 0.05 : 0.98),
            wallMat
          );
          step.position.set(x - HALF + N4[ni][0] * 0.5, 0.06, z - HALF + N4[ni][1] * 0.5);
          step.castShadow = true;
          scene.add(step);
        }
      }
    }

    for (var z = 0; z < GRID; z++) {
      for (var x = 0; x < GRID; x++) {
        var cell = grid[z * GRID + x];
        if (cell === 0) continue;
        var idx = z * GRID + x;
        var el = elev[idx];
        var px = x - HALF, pz = z - HALF;

        if (el === -2) {
          var pit = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 1.5, 0.9),
            pitWallMat
          );
          pit.position.set(px, -0.75, pz);
          pit.receiveShadow = true;
          scene.add(pit);
          continue;
        }

        var fy = el * 0.12;
        var fl = new THREE.Mesh(floorGeo, floorMat);
        fl.position.set(px, fy, pz);
        fl.receiveShadow = true;
        scene.add(fl);

        if (el === -1 && layout.hasWater) {
          var wa = new THREE.Mesh(
            new THREE.BoxGeometry(0.94, 0.02, 0.94),
            waterMat
          );
          wa.position.set(px, fy + 0.07, pz);
          wa.receiveShadow = true;
          scene.add(wa);
        }

        if (cell === 2) {
          var wl = new THREE.Mesh(wallGeo, wallMat);
          wl.position.set(px, 0.12, pz);
          wl.castShadow = true;
          wl.receiveShadow = true;
          scene.add(wl);
          var ln = new THREE.LineSegments(edgeGeo, edgeMat);
          ln.position.copy(wl.position);
          scene.add(ln);
        }
      }
    }

    var builders = {
      console: buildConsole, terminal: buildTerminal,
      pillar: buildPillar, crystal: buildCrystal,
      debris: buildDebris, beacon: buildBeacon
    };

    for (var ri = 0; ri < layout.rooms.length; ri++) {
      var room = layout.rooms[ri];
      var px = room.cx - HALF, pz = room.cz - HALF;
      var rcx = Math.round(room.cx), rcz = Math.round(room.cz);

      var noProp = elev[rcz * GRID + rcx] < 0;
      if (!noProp) {
        var builder = builders[room.prop] || buildPillar;
        var prop = builder(palette, layout.rng);
        prop.position.set(px, 0.12, pz);
        prop.rotation.y = layout.rng() * Math.PI * 2;
        prop.traverse(function (c) { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        scene.add(prop);
      }

      var markerMat = new THREE.MeshStandardMaterial({
        color: lightenColor(palette.floor, room.type === "boss" ? 30 : 15),
        emissive: palette.accent,
        emissiveIntensity: room.type === "boss" ? 0.35 : 0.1
      });
      var marker = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.015, 0.25), markerMat);
      marker.position.set(px, 0.125, pz);
      marker.receiveShadow = true;
      scene.add(marker);

      var pl = new THREE.PointLight(
        palette.accent,
        room.type === "boss" ? 0.5 : 0.25, 3.5
      );
      pl.position.set(px, 1.5, pz);
      scene.add(pl);
    }

    // ── Pan / Zoom controls ──
    var panX = 0, panZ = 0, userZoom = 1;
    var isDragging = false, lastX = 0, lastY = 0, lastPinchDist = 0;
    var minZoom = 0.3, maxZoom = 4;

    function updateCamera() {
      camera.position.set(panX, 0, panZ).addScaledVector(f, 220);
      camera.lookAt(panX, 0, panZ);
      camera.zoom = fit * userZoom;
      camera.updateProjectionMatrix();
    }

    function pixelToWorld(dx, dy) {
      var scale = (camera.right - camera.left) / renderer.domElement.clientWidth;
      var dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      var right = new THREE.Vector3();
      right.crossVectors(dir, camera.up).normalize();
      var up = new THREE.Vector3();
      up.crossVectors(right, dir).normalize();
      up.y = 0;
      if (up.lengthSq() > 0.0001) up.normalize();
      return {
        x: right.x * (-dx * scale) + up.x * (dy * scale),
        z: right.z * (-dx * scale) + up.z * (dy * scale)
      };
    }

    function onWheel(e) {
      e.preventDefault();
      userZoom = Math.max(minZoom, Math.min(maxZoom, userZoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      updateCamera();
      renderer.render(scene, camera);
    }

    function onDown(e) {
      if (e.touches && e.touches.length === 2) {
        lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        return;
      }
      isDragging = true;
      var pt = e.touches ? e.touches[0] : e;
      lastX = pt.clientX;
      lastY = pt.clientY;
      renderer.domElement.style.cursor = "grabbing";
    }

    function onMove(e) {
      if (e.touches && e.touches.length === 2) {
        e.preventDefault();
        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastPinchDist > 0) {
          userZoom = Math.max(minZoom, Math.min(maxZoom, userZoom * (dist / lastPinchDist)));
          updateCamera();
          renderer.render(scene, camera);
        }
        lastPinchDist = dist;
        return;
      }
      if (!isDragging) return;
      var pt = e.touches ? e.touches[0] : e;
      var dx = pt.clientX - lastX;
      var dy = pt.clientY - lastY;
      lastX = pt.clientX;
      lastY = pt.clientY;
      var d = pixelToWorld(dx, dy);
      panX += d.x;
      panZ += d.z;
      updateCamera();
      renderer.render(scene, camera);
    }

    function onUp() {
      lastPinchDist = 0;
      if (!isDragging) return;
      isDragging = false;
      renderer.domElement.style.cursor = "grab";
    }

    var cv = renderer.domElement;
    cv.style.cursor = "grab";
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    cv.addEventListener("touchstart", onDown, { passive: true });
    cv.addEventListener("touchmove", onMove, { passive: false });
    cv.addEventListener("touchend", onUp);
    cv.addEventListener("touchcancel", onUp);

    var mapData = {
      scene: scene, camera: camera, renderer: renderer,
      panX: panX, panZ: panZ, userZoom: userZoom,
      _geos: [floorGeo, wallGeo],
      _mats: [floorMat, wallMat],
      _updateCamera: updateCamera
    };

    renderer.render(scene, camera);

    var ro = new ResizeObserver(function () {
      var el = document.getElementById(containerId);
      if (!el || !activeMaps[containerId]) { ro.disconnect(); return; }
      var ns = (el.clientWidth || 320) | 0;
      var d = activeMaps[containerId];
      d.renderer.setSize(ns, ns);
      d.renderer.render(d.scene, d.camera);
    });
    ro.observe(container);
    mapData._ro = ro;

    activeMaps[containerId] = mapData;
  }

  // ── Public API ──
  window.buildDiscoveryMap = function (containerId, planet, disc) {
    var palette = resolvePalette(planet, disc);
    var seed = (disc.index + 1) * 31 + hashCode(planet ? planet.name : "");
    var roomCount = 3 + Math.abs(seed) % 6;
    var layout = generateLayout(seed, roomCount, palette);
    buildMapScene(layout, containerId);
  };

  window.disposeDiscoveryMap = function (containerId) {
    var m = activeMaps[containerId];
    if (!m) return;
    if (m._ro) m._ro.disconnect();
    if (m.renderer) {
      m.renderer.dispose();
      var gl = m.renderer.domElement;
      if (gl && gl.parentNode) gl.parentNode.removeChild(gl);
    }
    if (m.scene) {
      m.scene.traverse(function (o) {
        if (o.isMesh) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(function (mt) { mt.dispose(); });
            else o.material.dispose();
          }
        }
      });
    }
    delete activeMaps[containerId];
  };

  window._hashCode = hashCode;

  window.resolvePaletteKey = function (planet, disc) {
    if (disc.encounterType === "ship") return "ship";
    if (disc.encounterType === "space") return "space";
    if (disc.encounterType === "rescue") return "rescue";
    if (disc.categoryKey === "ruins") return "ruins";
    if (disc.categoryKey === "phenomenon") return "phenomenon";
    if (disc.categoryKey === "danger") return "danger";
    if (planet && planet.type) {
      var t = planet.type.toLowerCase();
      for (var i = 0; i < PLANET_KEYS.length; i++) {
        if (t.indexOf(PLANET_KEYS[i].match) !== -1)
          return PLANET_KEYS[i].key;
      }
    }
    return "default";
  };

  window.buildSharedMap = function (containerId, seed, roomCount, paletteKey) {
    var pal = P[paletteKey];
    if (!pal) pal = P.default;
    var layout = generateLayout(seed, roomCount, pal);
    buildMapScene(layout, containerId);
    return layout;
  };
})();
