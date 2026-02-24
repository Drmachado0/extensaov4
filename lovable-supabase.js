// lovable-supabase.js — Cliente Supabase integrado ao Organic (sem Bridge)
// Autenticação, logging de ações, queue management, commands, settings sync
(function () {
  'use strict';

  const CFG = () => window.LovableConfig;
  const log = (level, ...args) => window.LovableLogger ? window.LovableLogger[level]('Supabase', ...args) : console[level === 'info' ? 'log' : level]('[Lovable:Supabase]', ...args);
  const httpFetch = (url, options, retryCfg) => {
    if (window.LovableHttp && window.LovableHttp.fetchWithRetry) {
      return window.LovableHttp.fetchWithRetry(url, options, retryCfg);
    }
    return fetch(url, options);
  };

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const safeEq = (value) => encodeURIComponent(String(value ?? '').trim());
  const safeLimit = (value, fallback = 50, max = 200) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(n, max);
  };
  const buildUuidInFilter = (ids) => ids
    .map(id => String(id || '').trim())
    .filter(id => UUID_RE.test(id))
    .map(id => `"${id}"`)
    .join(',');

  window.LovableSupabase = {
    accessToken: null,
    refreshToken: null,
    userId: null,
    igAccountId: null,
    tokenExpiresAt: 0,
    retryQueue: [],
    retryTimer: null,
    lastWriteOk: true,
    writeCount: 0,
    writeErrors: 0,

    // ============================
    // INICIALIZAÇÃO
    // ============================
    async init() {
      const d = await chrome.storage.local.get([
        'sb_access_token', 'sb_refresh_token', 'sb_user_id',
        'sb_ig_account_id', 'sb_token_expires_at', 'lovable_retry_queue'
      ]);
      this.accessToken = d.sb_access_token || null;
      this.refreshToken = d.sb_refresh_token || null;
      this.userId = d.sb_user_id || null;
      this.igAccountId = d.sb_ig_account_id || null;
      this.tokenExpiresAt = d.sb_token_expires_at || 0;
      this.retryQueue = d.lovable_retry_queue || [];

      if (this.retryQueue.length > 0) {
        log('info', `Retry queue: ${this.retryQueue.length} pendentes`);
      }

      if (this.accessToken && this.isTokenExpiringSoon()) {
        await this.doRefreshToken();
      }

      if (this.isConnected() && !this.igAccountId) {
        await this.fetchIgAccountId();
      }

      this.startRetryProcessor();
      log('info', this.isConnected() ? 'Conectado ao Supabase' : 'Não conectado');
      return this.isConnected();
    },

    // ============================
    // AUTENTICAÇÃO
    // ============================
    async signIn(email, password) {
      const cfg = CFG();
      const res = await httpFetch(`${cfg.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': cfg.SUPABASE_KEY },
        body: JSON.stringify({ email, password })
      }, { timeoutMs: 15000, retries: 1, retryDelayMs: 600 });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error_description || err.msg || `Erro ${res.status}`);
      }

      const data = await res.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.userId = data.user.id;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

      await this.fetchIgAccountId();
      await this.save();
      log('info', 'Login realizado com sucesso');
      return true;
    },

    async fetchIgAccountId() {
      const cfg = CFG();
      try {
        const userId = safeEq(this.userId);
        const res = await httpFetch(
          `${cfg.SUPABASE_URL}/rest/v1/ig_accounts?user_id=eq.${userId}&is_active=eq.true&select=id,ig_username&limit=1`,
          { headers: this.headers() },
          { timeoutMs: 12000, retries: 1, retryDelayMs: 500 }
        );
        if (res.ok) {
          const acc = await res.json();
          if (acc.length > 0) {
            this.igAccountId = acc[0].id;
            await this.save();
            log('info', `Conta IG vinculada: ${acc[0].ig_username}`);
          }
        }
      } catch (e) {
        log('error', 'fetchIgAccount:', e);
      }
    },

    async doRefreshToken() {
      if (!this.refreshToken) return false;
      const cfg = CFG();
      try {
        const res = await httpFetch(`${cfg.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': cfg.SUPABASE_KEY },
          body: JSON.stringify({ refresh_token: this.refreshToken })
        }, { timeoutMs: 15000, retries: 1, retryDelayMs: 600 });

        if (!res.ok) {
          log('warn', 'Refresh token falhou:', res.status);
          if (res.status === 401 || res.status === 403) {
            log('error', 'Token inválido — forçando logout');
            await this.disconnect();
          }
          return false;
        }

        const d = await res.json();
        this.accessToken = d.access_token;
        this.refreshToken = d.refresh_token;
        this.tokenExpiresAt = Date.now() + (d.expires_in * 1000);
        await this.save();
        log('info', 'Token renovado');
        return true;
      } catch (e) {
        log('warn', 'Falha ao renovar token:', e?.message || e);
        return false;
      }
    },

    isTokenExpiringSoon() {
      return Date.now() > (this.tokenExpiresAt - 5 * 60 * 1000);
    },

    async ensureValidToken() {
      if (this.isTokenExpiringSoon()) {
        await this.doRefreshToken();
      }
    },

    isConnected() {
      return !!(this.accessToken && this.userId);
    },

    headers(prefer) {
      const cfg = CFG();
      return {
        'Content-Type': 'application/json',
        'apikey': cfg.SUPABASE_KEY,
        'Authorization': `Bearer ${this.accessToken}`,
        'Prefer': prefer || 'return=minimal'
      };
    },

    async save() {
      await chrome.storage.local.set({
        sb_access_token: this.accessToken,
        sb_refresh_token: this.refreshToken,
        sb_user_id: this.userId,
        sb_ig_account_id: this.igAccountId,
        sb_token_expires_at: this.tokenExpiresAt
      });
    },

    async disconnect() {
      this.accessToken = null;
      this.refreshToken = null;
      this.userId = null;
      this.igAccountId = null;
      this.tokenExpiresAt = 0;
      await chrome.storage.local.remove([
        'sb_access_token', 'sb_refresh_token', 'sb_user_id',
        'sb_ig_account_id', 'sb_token_expires_at'
      ]);
      log('info', 'Desconectado do Supabase');
    },

    // ============================
    // RETRY QUEUE
    // ============================
    startRetryProcessor() {
      if (this.retryTimer) clearInterval(this.retryTimer);
      const cfg = CFG();
      this.retryTimer = setInterval(() => this.processRetryQueue(), cfg.RETRY_QUEUE_INTERVAL);
    },

    async persistRetryQueue() {
      await chrome.storage.local.set({
        lovable_retry_queue: this.retryQueue,
        lovable_retry_queue_size: this.retryQueue.length
      });
    },

    async processRetryQueue() {
      if (!this.isConnected() || this.retryQueue.length === 0) return;
      await this.ensureValidToken();
      const cfg = CFG();
      const batch = this.retryQueue.splice(0, cfg.RETRY_QUEUE_BATCH_SIZE);

      // TTL por tabela: logs de ação expiram em 3h (irrelevantes depois disso),
      // dados de estado (ig_accounts, growth_stats) mantêm 24h
      const TABLE_TTL_MS = {
        action_log:    3 * 3600 * 1000,   // 3 horas
        session_stats: 6 * 3600 * 1000,   // 6 horas
        default:       24 * 3600 * 1000,  // 24 horas (ig_accounts, growth_stats, etc.)
      };

      for (const item of batch) {
        if (item.createdAt) {
          const ttl = TABLE_TTL_MS[item.table] ?? TABLE_TTL_MS.default;
          if (Date.now() - item.createdAt > ttl) continue; // expirado — descartar
        }
        try {
          const res = await httpFetch(item.url, {
            method: item.method,
            headers: this.headers(),
            body: JSON.stringify(item.body)
          }, { timeoutMs: 12000, retries: 1, retryDelayMs: 500 });

          if (res.ok) {
            this.writeCount++;
          } else {
            this.retryQueue.push(item);
          }
        } catch (e) {
          this.retryQueue.push(item);
        }
      }

      if (this.retryQueue.length > cfg.RETRY_QUEUE_MAX_SIZE) {
        this.retryQueue = this.retryQueue.slice(-cfg.RETRY_QUEUE_MAX_SIZE);
      }
      await this.persistRetryQueue();
    },

    // ============================
    // WRITE HELPERS
    // ============================
    async postWithRetry(table, body) {
      if (!this.isConnected()) return false;
      if (this.isInBackoff()) { log('debug', 'Skipping POST — backoff ativo'); return false; }
      await this.ensureValidToken();
      const cfg = CFG();
      const url = `${cfg.SUPABASE_URL}/rest/v1/${table}`;
      try {
        const res = await httpFetch(url, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body)
        }, { timeoutMs: 12000, retries: 1, retryDelayMs: 500 });

        if (res.ok) {
          this.writeCount++;
          this.lastWriteOk = true;
          this.recordApiSuccess();
          return true;
        }
        if (res.status === 429 || res.status >= 500) this.recordApiError();
        this.retryQueue.push({ url, method: 'POST', body, table, createdAt: Date.now() });
        this.writeErrors++;
        await this.persistRetryQueue();
        return false;
      } catch (e) {
        this.recordApiError();
        this.retryQueue.push({ url, method: 'POST', body, table, createdAt: Date.now() });
        this.writeErrors++;
        await this.persistRetryQueue();
        return false;
      }
    },

    async patchWithRetry(table, filter, body) {
      if (!this.isConnected()) return false;
      if (this.isInBackoff()) { log('debug', 'Skipping PATCH — backoff ativo'); return false; }
      await this.ensureValidToken();
      const cfg = CFG();
      try {
        const res = await httpFetch(
          `${cfg.SUPABASE_URL}/rest/v1/${table}?${filter}`,
          { method: 'PATCH', headers: this.headers(), body: JSON.stringify(body) },
          { timeoutMs: 12000, retries: 1, retryDelayMs: 500 }
        );
        if (res.ok) { this.writeCount++; this.recordApiSuccess(); return true; }
        if (res.status === 429 || res.status >= 500) this.recordApiError();
        this.writeErrors++;
        return false;
      } catch (e) {
        this.recordApiError();
        this.writeErrors++;
        return false;
      }
    },

    // ============================
    // LOG DE AÇÕES
    // ============================
    async logAction(actionData) {
      const body = {
        user_id: this.userId,
        action_type: actionData.type,
        target_username: actionData.target || null,
        target_url: actionData.url || null,
        status: actionData.success ? 'success' : 'failed',
        details: actionData.details || {},
        executed_at: new Date().toISOString()
      };
      if (this.igAccountId) body.ig_account_id = this.igAccountId;
      return this.postWithRetry('action_log', body);
    },

    // ============================
    // GROWTH STATS
    // ============================
    async reportGrowthStats(stats) {
      const body = {
        user_id: this.userId,
        followers_count: stats.followers || 0,
        following_count: stats.following || 0,
        posts_count: stats.posts || 0,
        recorded_at: new Date().toISOString()
      };
      if (this.igAccountId) body.ig_account_id = this.igAccountId;
      return this.postWithRetry('growth_stats', body);
    },

    // ============================
    // ATUALIZAR CONTA IG
    // ============================
    async updateIgAccount(accountData) {
      if (!this.igAccountId) return false;
      return this.patchWithRetry('ig_accounts', `id=eq.${safeEq(this.igAccountId)}`, {
        ig_username: accountData.username || undefined,
        followers_count: accountData.followers || 0,
        following_count: accountData.following || 0,
        posts_count: accountData.posts || 0,
        updated_at: new Date().toISOString()
      });
    },

    // ============================
    // STATUS DO BOT
    // ============================
    async updateBotStatus(isOnline, statusText, botMode) {
      if (!this.igAccountId) return false;
      const body = {
        bot_online: isOnline,
        bot_status: statusText || 'unknown',
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (botMode && botMode !== 'unknown') body.bot_mode = botMode;

      // Incluir dados de saúde da conta para diagnóstico remoto no dashboard
      const safety = window.LovableSafety;
      if (safety) {
        const cooldownMs = safety.cooldownUntil > Date.now() ? safety.cooldownUntil - Date.now() : 0;
        body.daily_heat = safety._dailyHeat ?? 0;
        body.cooldown_remaining_minutes = cooldownMs > 0 ? Math.round(cooldownMs / 60000) : 0;
        body.cooldown_escalation = safety._cooldownEscalation ?? 0;
        body.safety_preset = safety._activePreset || 'media';
      }

      return this.patchWithRetry('ig_accounts', `id=eq.${safeEq(this.igAccountId)}`, body);
    },

    // ============================
    // SESSION STATS
    // ============================
    async reportSessionStats(counters) {
      const body = {
        user_id: this.userId,
        follows_count: counters.follows || 0,
        unfollows_count: counters.unfollows || 0,
        likes_count: counters.likes || 0,
        comments_count: counters.comments || 0,
        blocks_count: counters.blocks || 0,
        skips_count: counters.skips || 0,
        errors_count: counters.errors || 0,
        session_start: counters.sessionStart,
        session_end: new Date().toISOString()
      };
      if (this.igAccountId) body.ig_account_id = this.igAccountId;
      return this.postWithRetry('session_stats', body);
    },

    // ============================
    // COMANDOS REMOTOS
    // ============================
    async fetchPendingCommands() {
      if (!this.isConnected() || !this.igAccountId) return [];
      await this.ensureValidToken();
      const cfg = CFG();
      try {
        const accountId = safeEq(this.igAccountId);
        const res = await httpFetch(
          `${cfg.SUPABASE_URL}/rest/v1/bot_commands?ig_account_id=eq.${accountId}&status=eq.pending&order=created_at.asc&limit=10`,
          { headers: this.headers('return=representation') },
          { timeoutMs: 12000, retries: 1, retryDelayMs: 500 }
        );
        if (!res.ok) return [];
        return await res.json();
      } catch (e) { return []; }
    },

    async markCommandExecuted(commandId, result) {
      if (!this.isConnected()) return false;
      return this.patchWithRetry('bot_commands', `id=eq.${safeEq(commandId)}`, {
        status: result.ok ? 'executed' : 'failed',
        result: result,
        executed_at: new Date().toISOString()
      });
    },

    // ============================
    // TARGET QUEUE
    // ============================
    async fetchTargetQueue(limit) {
      if (!this.isConnected() || !this.igAccountId) return [];
      await this.ensureValidToken();
      const cfg = CFG();
      const n = safeLimit(limit, cfg.QUEUE_FETCH_LIMIT, 200);
      try {
        const accountId = safeEq(this.igAccountId);
        const res = await httpFetch(
          `${cfg.SUPABASE_URL}/rest/v1/target_queue?ig_account_id=eq.${accountId}&status=eq.pending&order=priority.desc,created_at.asc&limit=${n}`,
          { headers: this.headers('return=representation') },
          { timeoutMs: 15000, retries: 1, retryDelayMs: 500 }
        );
        if (!res.ok) return [];
        return await res.json();
      } catch (e) {
        log('error', 'fetchTargetQueue:', e);
        return [];
      }
    },

    async markQueueItems(ids, status) {
      if (!this.isConnected() || ids.length === 0) return false;
      await this.ensureValidToken();
      const cfg = CFG();
      const idFilter = buildUuidInFilter(ids);
      if (!idFilter) return false;
      try {
        const res = await httpFetch(
          `${cfg.SUPABASE_URL}/rest/v1/target_queue?id=in.(${idFilter})`,
          {
            method: 'PATCH',
            headers: this.headers(),
            body: JSON.stringify({ status, processed_at: new Date().toISOString() })
          },
          { timeoutMs: 12000, retries: 1, retryDelayMs: 500 }
        );
        return res.ok;
      } catch (e) {
        log('warn', 'markQueueItems falhou:', e?.message || e);
        return false;
      }
    },

    async uploadScrapeResults(usernames, sourceAccount) {
      if (!this.isConnected() || !this.igAccountId || usernames.length === 0) return false;
      await this.ensureValidToken();
      const cfg = CFG();

      const rows = usernames.map(u => ({
        ig_account_id: this.igAccountId,
        username: u,
        source: `scrape:@${sourceAccount}`,
        status: 'pending'
      }));

      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        try {
          const res = await httpFetch(`${cfg.SUPABASE_URL}/rest/v1/target_queue`, {
            method: 'POST',
            headers: { ...this.headers(), 'Prefer': 'return=minimal,resolution=ignore-duplicates' },
            body: JSON.stringify(batch)
          }, { timeoutMs: 15000, retries: 1, retryDelayMs: 500 });
          if (res.ok) this.writeCount += batch.length;
        } catch (e) {
          log('error', 'uploadScrape batch falhou:', e);
        }
      }

      log('info', `${usernames.length} targets carregados de @${sourceAccount}`);
      return true;
    },

    // Versão enriquecida: inclui metadados do perfil (is_private, is_verified, profile_pic_url)
    // Usada por collect_followers / collect_following para sincronizar filtros do dashboard
    async uploadTargetsWithDetails(accounts, source, igAccountId) {
      if (!this.isConnected() || !igAccountId || !accounts.length) return false;
      await this.ensureValidToken();
      const cfg = CFG();

      const rows = accounts.map(a => ({
        ig_account_id: igAccountId,
        username: a.username,
        source: source || 'followers',
        status: 'pending',
        details: {
          is_private: a.is_private || false,
          is_verified: a.is_verified || false,
          profile_pic_url: a.profile_pic_url || ''
        }
      }));

      let uploaded = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        try {
          const res = await httpFetch(`${cfg.SUPABASE_URL}/rest/v1/target_queue`, {
            method: 'POST',
            headers: { ...this.headers(), 'Prefer': 'return=minimal,resolution=ignore-duplicates' },
            body: JSON.stringify(batch)
          }, { timeoutMs: 15000, retries: 1, retryDelayMs: 500 });
          if (res.ok) { this.writeCount += batch.length; uploaded += batch.length; }
        } catch (e) {
          log('error', 'uploadTargetsWithDetails batch falhou:', e);
        }
      }

      log('info', `${uploaded} targets com detalhes carregados (fonte: ${source})`);
      return uploaded > 0;
    },


    async fetchBotSettings() {
      if (!this.isConnected() || !this.igAccountId) return null;
      await this.ensureValidToken();
      const cfg = CFG();
      try {
        const accountId = safeEq(this.igAccountId);
        const res = await httpFetch(
          `${cfg.SUPABASE_URL}/rest/v1/ig_accounts?id=eq.${accountId}&select=bot_mode,likes_per_follow,delay_min,delay_max,max_actions_per_session,bot_schedule`,
          { headers: this.headers('return=representation') },
          { timeoutMs: 12000, retries: 1, retryDelayMs: 500 }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.length > 0 ? data[0] : null;
      } catch (e) { return null; }
    },

    async saveScheduleToDb(schedule) {
      if (!this.igAccountId) return false;
      return this.patchWithRetry('ig_accounts', `id=eq.${safeEq(this.igAccountId)}`, {
        bot_schedule: schedule,
        updated_at: new Date().toISOString()
      });
    },

    // ============================
    // SYNC DE SEGURANÇA → DASHBOARD
    // ============================
    async syncSafetyConfig(preset, limits, organicTimings) {
      if (!this.igAccountId) return false;
      const body = { updated_at: new Date().toISOString() };
      if (preset) body.safety_preset = preset;
      if (limits) body.safety_limits = limits;
      if (organicTimings) body.organic_timings = organicTimings;
      return this.patchWithRetry('ig_accounts', `id=eq.${safeEq(this.igAccountId)}`, body);
    },

    // ============================
    // SYNC DE CONTADORES LEVES (30s)
    // ============================
    async syncLiveCounters(statusText, schedulerProgress) {
      if (!this.isConnected() || !this.igAccountId) return false;
      await this.ensureValidToken();
      const body = {
        bot_status: statusText || 'unknown',
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (schedulerProgress) body.scheduler_progress = schedulerProgress;
      return this.patchWithRetry('ig_accounts', `id=eq.${safeEq(this.igAccountId)}`, body);
    },

    // ============================
    // FETCH SETTINGS ESTENDIDO (inclui novas colunas)
    // ============================
    async fetchBotSettingsExtended() {
      if (!this.isConnected() || !this.igAccountId) return null;
      await this.ensureValidToken();
      const cfg = CFG();
      try {
        const accountId = safeEq(this.igAccountId);
        const res = await httpFetch(
          `${cfg.SUPABASE_URL}/rest/v1/ig_accounts?id=eq.${accountId}&select=bot_mode,likes_per_follow,delay_min,delay_max,max_actions_per_session,bot_schedule,safety_preset,safety_limits,organic_timings,scheduler_progress,updated_at`,
          { headers: this.headers('return=representation') },
          { timeoutMs: 12000, retries: 1, retryDelayMs: 500 }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.length > 0 ? data[0] : null;
      } catch (e) { return null; }
    },

    // ============================
    // BACKOFF EXPONENCIAL
    // ============================
    _consecutiveApiErrors: 0,
    _backoffUntil: 0,

    isInBackoff() {
      if (this._backoffUntil > Date.now()) return true;
      return false;
    },

    recordApiSuccess() {
      this._consecutiveApiErrors = 0;
      this._backoffUntil = 0;
    },

    recordApiError() {
      this._consecutiveApiErrors++;
      // Backoff: 5s, 15s, 30s, 60s, 120s, max 5 min
      const delaySec = Math.min(300, 5 * Math.pow(2, this._consecutiveApiErrors - 1));
      this._backoffUntil = Date.now() + (delaySec * 1000);
      log('warn', `API error #${this._consecutiveApiErrors} — backoff ${delaySec}s`);
    }
  };

  log('info', 'LovableSupabase carregado');
})();
