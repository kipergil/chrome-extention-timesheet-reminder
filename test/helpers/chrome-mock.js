/**
 * Minimal in-memory chrome.* API mock for unit tests.
 *
 * Only implements the subset of the extension APIs the codebase actually
 * uses (storage.local, storage.onChanged, alarms, runtime, tabs). Install it
 * on globalThis.chrome BEFORE dynamically importing any source module that
 * touches chrome.* - several modules (background-worker.js) register
 * listeners at module top-level.
 */
export function createChromeMock({ tabs = [{ id: 1 }] } = {}) {
  const store = {};
  const changeListeners = [];
  const alarms = new Map();
  const alarmListeners = [];
  const messageListeners = [];
  const installedListeners = [];
  const startupListeners = [];
  const sentTabMessages = [];
  const createdTabs = [];

  function notifyChange(changes) {
    if (Object.keys(changes).length === 0) {
      return;
    }
    changeListeners.forEach((fn) => fn(changes, 'local'));
  }

  const chrome = {
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          if (keys === null || keys === undefined) {
            Object.assign(result, store);
          } else if (Array.isArray(keys)) {
            keys.forEach((key) => {
              if (key in store) result[key] = store[key];
            });
          } else if (typeof keys === 'string') {
            if (keys in store) result[keys] = store[keys];
          } else if (typeof keys === 'object') {
            Object.keys(keys).forEach((key) => {
              result[key] = key in store ? store[key] : keys[key];
            });
          }
          callback(result);
        },
        set(values, callback) {
          const changes = {};
          Object.entries(values).forEach(([key, newValue]) => {
            changes[key] = { oldValue: store[key], newValue };
            store[key] = newValue;
          });
          notifyChange(changes);
          if (callback) callback();
        },
        clear(callback) {
          Object.keys(store).forEach((key) => delete store[key]);
          if (callback) callback();
        }
      },
      onChanged: {
        addListener(fn) {
          changeListeners.push(fn);
        }
      }
    },
    alarms: {
      create(name, alarmInfo) {
        alarms.set(name, alarmInfo);
      },
      clear(name, callback) {
        const existed = alarms.delete(name);
        if (callback) callback(existed);
      },
      onAlarm: {
        addListener(fn) {
          alarmListeners.push(fn);
        }
      }
    },
    runtime: {
      onInstalled: {
        addListener(fn) {
          installedListeners.push(fn);
        }
      },
      onStartup: {
        addListener(fn) {
          startupListeners.push(fn);
        }
      },
      onMessage: {
        addListener(fn) {
          messageListeners.push(fn);
        }
      },
      sendMessage() {
        return Promise.resolve();
      },
      getURL(path) {
        return `chrome-extension://mock-extension-id/${path}`;
      },
      lastError: undefined
    },
    tabs: {
      query(queryInfo, callback) {
        callback(tabs);
      },
      sendMessage(tabId, message) {
        sentTabMessages.push({ tabId, message });
        return Promise.resolve({ status: 'popup_shown' });
      },
      create(createProperties, callback) {
        const tab = { id: 999, ...createProperties };
        createdTabs.push(tab);
        if (callback) callback(tab);
        return tab;
      }
    },

    // --- test-only helpers below (not part of the real chrome API) ---
    _test: {
      store,
      alarms,
      sentTabMessages,
      createdTabs,
      getAlarm(name) {
        return alarms.get(name);
      },
      fireAlarm(name) {
        return alarmListeners.map((fn) => fn({ name }));
      },
      triggerInstalled() {
        return installedListeners.map((fn) => fn());
      },
      triggerStartup() {
        return startupListeners.map((fn) => fn());
      },
      /**
       * Simulates chrome.runtime.sendMessage from a content/popup script into
       * the background worker's onMessage listener, resolving with whatever
       * the listener passes to sendResponse.
       */
      sendMessage(message, sender = {}) {
        return new Promise((resolve) => {
          let responded = false;
          const sendResponse = (response) => {
            responded = true;
            resolve(response);
          };

          let willRespondAsync = false;
          messageListeners.forEach((fn) => {
            const result = fn(message, sender, sendResponse);
            if (result === true) willRespondAsync = true;
          });

          if (!willRespondAsync && !responded) {
            resolve(undefined);
          }
        });
      }
    }
  };

  return chrome;
}

/**
 * Drains pending microtasks. Several of background-worker.js's event
 * listeners (onAlarm, onInstalled) kick off promise chains without
 * returning/awaiting them, so tests can't just `await` the listener call -
 * they need to give the underlying chain a chance to settle first.
 */
export async function flushAsync(ticks = 30) {
  for (let i = 0; i < ticks; i += 1) {
    await Promise.resolve();
  }
}
