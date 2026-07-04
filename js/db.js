// WARP-Unit IndexedDB persistence
// Replaces localStorage (5MB limit) for P2P/serverless mode.
// ponytail: single object store, no versioning. Upgrade: migrations for schema changes.

(function () {
  "use strict";

  var DB_NAME = "warp-unit";
  var STORE_NAME = "state";
  var _db = null;

  function open() {
    if (_db) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = function (e) {
        _db = e.target.result;
        resolve();
      };
      req.onerror = function (e) {
        reject(e.target.error);
      };
    });
  }

  function _store(mode) {
    return _db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  }

  function get(key) {
    return new Promise(function (resolve, reject) {
      var req = _store("readonly").get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function set(key, value) {
    return new Promise(function (resolve, reject) {
      var req = _store("readwrite").put(value, key);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function remove(key) {
    return new Promise(function (resolve, reject) {
      var req = _store("readwrite").delete(key);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function keys() {
    return new Promise(function (resolve, reject) {
      var req = _store("readonly").getAllKeys();
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function close() {
    if (_db) { _db.close(); _db = null; }
  }

  window.WarpDB = {
    open: open,
    get: get,
    set: set,
    remove: remove,
    keys: keys,
    close: close,
  };
})();
