// lovable-logger.js — Logging estruturado para integração Lovable
(function () {
  'use strict';

  const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
  let currentLevel = LEVELS.info;
  const CONSOLE_FN = { debug: 'debug', info: 'log', warn: 'warn', error: 'error' };

  function normalizeLevel(level) {
    if (!level) return null;
    const key = String(level).toLowerCase().trim();
    return Object.prototype.hasOwnProperty.call(LEVELS, key) ? key : null;
  }

  function write(level, mod, args) {
    const normalized = normalizeLevel(level);
    if (!normalized) return;
    if (currentLevel > LEVELS[normalized]) return;
    const ts = new Date().toISOString();
    const fn = CONSOLE_FN[normalized] || 'log';
    const prefix = `[${ts}] [Lovable:${mod}] [${normalized.toUpperCase()}]`;
    console[fn](prefix, ...args);
  }

  function bootstrapLevelFromStorage() {
    try {
      if (!chrome || !chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.get(['lovable_log_level'], (data) => {
        if (chrome.runtime && chrome.runtime.lastError) return;
        const normalized = normalizeLevel(data?.lovable_log_level);
        if (normalized) currentLevel = LEVELS[normalized];
      });
      if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== 'local' || !changes.lovable_log_level) return;
          const normalized = normalizeLevel(changes.lovable_log_level.newValue);
          if (normalized) currentLevel = LEVELS[normalized];
        });
      }
    } catch (e) {
      console.debug('[Lovable:Logger] Falha ao carregar nível:', e?.message || e);
    }
  }

  window.LovableLogger = {
    setLevel(level) {
      const normalized = normalizeLevel(level);
      if (normalized) currentLevel = LEVELS[normalized];
    },
    debug(mod, ...args) { write('debug', mod, args); },
    info(mod, ...args) { write('info', mod, args); },
    warn(mod, ...args) { write('warn', mod, args); },
    error(mod, ...args) { write('error', mod, args); }
  };

  bootstrapLevelFromStorage();
})();
