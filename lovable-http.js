// lovable-http.js — HTTP client com retry e timeout
(function () {
  'use strict';

  const root = typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis);

  const DEFAULT_TIMEOUT_MS = 15000;
  const DEFAULT_RETRIES = 1;
  const DEFAULT_RETRY_DELAY_MS = 500;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function shouldRetryResponse(res) {
    return res.status === 408 || res.status === 429 || res.status >= 500;
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const ms = Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchWithRetry(url, options, retryConfig) {
    const cfg = retryConfig || {};
    const retries = Number.isFinite(cfg.retries) ? cfg.retries : DEFAULT_RETRIES;
    const timeoutMs = Number.isFinite(cfg.timeoutMs) ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;
    const retryDelayMs = Number.isFinite(cfg.retryDelayMs) ? cfg.retryDelayMs : DEFAULT_RETRY_DELAY_MS;

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchWithTimeout(url, options, timeoutMs);
        if (res.ok || !shouldRetryResponse(res) || attempt === retries) return res;
      } catch (err) {
        lastError = err;
        if (attempt === retries) throw err;
      }
      await sleep(retryDelayMs * (attempt + 1));
    }
    throw lastError || new Error('fetchWithRetry: unexpected exit');
  }

  root.LovableHttp = Object.freeze({
    fetchWithTimeout,
    fetchWithRetry
  });
})();
