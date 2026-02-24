// lovable-sync.js — Módulo principal de sincronização Organic <-> Lovable
// Hooks diretos nas funções do Organic, sem observação de DOM
// Roda como content script APÓS contentscript.js
(function () {
  'use strict';

  const log = (level, ...args) => window.LovableLogger ? window.LovableLogger[level]('Sync', ...args) : console[level === 'info' ? 'log' : level]('[Lovable:Sync]', ...args);
  const CFG = () => window.LovableConfig;

  // =============================================
  // ESTADO INTERNO
  // =============================================
  const state = {
    initialized: false,
    sessionStart: new Date().toISOString(),
    counters: { follows: 0, unfollows: 0, likes: 0, comments: 0, blocks: 0, skips: 0, errors: 0 },
    lastHeartbeat: 0,
    lastProfileCollect: 0,
    lastQueueSync: 0,
    lastSettingsSync: 0,
    lastStatsReport: 0,
    currentMode: 'unknown',
    isProcessing: false,
    igUsername: null,
    igProfile: null,
    timers: {},
    // Mapa username → target_queue id (para marcar como done/skipped após ação)
    queueIdMap: {},
    // Agendamento
    schedule: null,
    scheduleLastAction: null,
    // Metas diárias do scheduler (rastrear ações realizadas hoje por tipo)
    scheduleDaily: { date: null, follows: 0, likes: 0, unfollows: 0 },
  };

  // =============================================
  // INICIALIZAÇÃO
  // =============================================
  window.LovableSync = {

    async init() {
      if (state.initialized) return;

      // Só inicializar em páginas do Instagram
      if (!window.location.hostname.includes('instagram.com')) return;

      console.log('%c[Lovable] Inicializando integração...', 'color: #A855F7; font-weight: bold; font-size: 14px');
      console.log('[Lovable] Organic container:', !!document.getElementById('igBotInjectedContainer'));
      console.log('[Lovable] gblOptions:', typeof gblOptions !== 'undefined' ? 'disponivel' : 'NAO ENCONTRADO');
      log('info', 'Inicializando integração Lovable...');

      // Inicializar módulos
      const sb = window.LovableSupabase;
      const safety = window.LovableSafety;

      if (sb) await sb.init();
      if (safety) await safety.init();

      // Carregar contadores salvos
      const stored = await chrome.storage.local.get([
        'lovable_counters', 'lovable_session_start', 'lovable_ig_username',
        'lovable_last_profile', 'lovable_schedule', 'lovable_schedule_daily'
      ]);
      if (stored.lovable_counters) state.counters = stored.lovable_counters;
      if (stored.lovable_session_start) state.sessionStart = stored.lovable_session_start;
      if (stored.lovable_ig_username) state.igUsername = stored.lovable_ig_username;
      if (stored.lovable_last_profile) state.igProfile = stored.lovable_last_profile;
      if (stored.lovable_schedule) state.schedule = stored.lovable_schedule;

      // Carregar metas diárias do scheduler (resetar se mudou o dia)
      const today = new Date().toISOString().slice(0, 10);
      if (stored.lovable_schedule_daily && stored.lovable_schedule_daily.date === today) {
        state.scheduleDaily = stored.lovable_schedule_daily;
      } else {
        state.scheduleDaily = { date: today, follows: 0, likes: 0, unfollows: 0 };
        chrome.storage.local.set({ lovable_schedule_daily: state.scheduleDaily });
      }

      // Instalar hooks nas funções do Organic
      this.installHooks();

      // Aplicar timings de proteção do Organic nativo baseado no preset salvo
      try {
        const presetData = await chrome.storage.local.get('lovable_safety_preset');
        const activePreset = presetData.lovable_safety_preset || 'media';
        // Esperar um pouco para o Organic ter carregado seus campos DOM
        setTimeout(() => {
          if (document.getElementById('textSecondsBetweenActions')) {
            this.applyOrganicTimings(activePreset);
            log('info', `Proteção Organic nativa aplicada (preset: ${activePreset})`);
          } else {
            log('warn', 'Campos de timing do Organic não encontrados — tentando novamente em 5s');
            setTimeout(() => this.applyOrganicTimings(activePreset), 5000);
          }
        }, 2000);
      } catch (e) {
        log('warn', 'Falha ao aplicar timings iniciais:', e?.message || e);
      }

      // Listener de mensagens já instalado na inicialização rápida (fora do init)

      // Iniciar timers periódicos
      this.startPeriodicTasks();

      // Coletar perfil: tentativa rápida + retry com mais tempo
      setTimeout(() => this.collectProfile(), 3000);
      setTimeout(() => {
        if (!state.igProfile || typeof state.igProfile.followers !== 'number') {
          log('info', 'Retry collectProfile — tentativa 2 (8s)');
          this.collectProfile();
        }
      }, 8000);
      setTimeout(() => {
        if (!state.igProfile || typeof state.igProfile.followers !== 'number') {
          log('info', 'Retry collectProfile — tentativa 3 (20s)');
          this.collectProfile();
        }
      }, 20000);

      // Heartbeat inicial
      setTimeout(() => this.sendHeartbeat(), 10000);

      state.initialized = true;
      console.log('%c[Lovable] Inicialização COMPLETA!', 'color: #00B894; font-weight: bold; font-size: 14px');
      console.log('[Lovable] Supabase conectado:', sb ? sb.isConnected() : false);
      console.log('[Lovable] Safety Guard:', !!safety);
      console.log('[Lovable] Username:', state.igUsername || 'nao detectado ainda');
      log('info', 'Integração Lovable inicializada com sucesso');

      // Notificar que estamos online
      if (sb && sb.isConnected()) {
        sb.updateBotStatus(true, 'online');
      }
    },

    // =============================================
    // HOOKS NAS FUNÇÕES DO ORGANIC
    // =============================================
    installHooks() {
      const self = this;
      console.log('[Lovable] Instalando hooks...');

      // ---- Hook: outputMessage ----
      // Captura TODAS as mensagens de log do Organic
      if (typeof outputMessage === 'function') {
        const origOutputMessage = outputMessage;
        window._origOutputMessage = origOutputMessage;
        try {
          const newOutputMessage = function (txt) {
            origOutputMessage.call(this, txt);
            try { self.parseLogLine(txt); } catch (e) {}
          };
          if (typeof window.outputMessage !== 'undefined') {
            window.outputMessage = newOutputMessage;
            console.log('[Lovable] ✓ Hook em outputMessage instalado');
          }
        } catch (e) {
          console.warn('[Lovable] ✗ Falha ao hookear outputMessage:', e?.message);
        }
      } else {
        console.log('[Lovable] outputMessage ainda não definida, usando observer');
      }

      // SEMPRE instalar observer como fallback confiável
      this._setupConsoleObserver();

      // ---- Hook: statusDiv (detectar username quando Organic o encontra) ----
      this._setupStatusDivObserver();

      log('info', 'Hooks instalados');
    },

    // Observer na statusDiv — captura username assim que Organic o coloca lá
    _setupStatusDivObserver() {
      const self = this;
      let retries = 0;
      const checkStatusDiv = () => {
        const statusDiv = document.getElementById('igBotStatusDiv');
        if (statusDiv) {
          // Verificar se já tem username
          const existing = statusDiv.textContent || '';
          const existingMatch = existing.match(/Current\s+(?:IG\s+User|profile):\s*(\S+)/i);
          if (existingMatch && existingMatch[1] && !state.igUsername) {
            state.igUsername = existingMatch[1];
            console.log('[Lovable] ✓ Username detectado na statusDiv existente: ' + state.igUsername);
            self.collectProfile();
          }

          // Observer para mudanças futuras
          const observer = new MutationObserver(() => {
            const text = statusDiv.textContent || '';
            const m = text.match(/Current\s+(?:IG\s+User|profile):\s*(\S+)/i);
            if (m && m[1] && m[1] !== state.igUsername) {
              state.igUsername = m[1];
              console.log('[Lovable] ✓ Username atualizado na statusDiv: ' + state.igUsername);
              self.collectProfile();
            }
            // Também verificar link
            const link = statusDiv.querySelector('a[href*="instagram.com/"]');
            if (link && !state.igUsername) {
              const lm = link.href.match(/instagram\.com\/([^/]+)/);
              if (lm && lm[1]) {
                state.igUsername = lm[1];
                console.log('[Lovable] ✓ Username via link na statusDiv: ' + state.igUsername);
                self.collectProfile();
              }
            }
          });
          observer.observe(statusDiv, { childList: true, characterData: true, subtree: true });
          console.log('[Lovable] ✓ StatusDiv observer ativo');
        } else {
          retries++;
          if (retries <= 30) { // Tentar por 60 segundos
            setTimeout(checkStatusDiv, 2000);
          }
        }
      };
      checkStatusDiv();
    },

    // Observer no txtConsole como método confiável de captura de logs
    _setupConsoleObserver() {
      const self = this;
      let retries = 0;
      const checkConsole = () => {
        const consoleEl = document.getElementById('txtConsole');
        if (consoleEl) {
          let lastText = consoleEl.textContent || '';
          const observer = new MutationObserver(() => {
            const newText = consoleEl.textContent || '';
            if (newText !== lastText) {
              const newLines = newText.substring(lastText.length).trim().split('\n');
              newLines.forEach(line => {
                if (line.trim()) self.parseLogLine(line.trim());
              });
              lastText = newText;
            }
          });
          observer.observe(consoleEl, { childList: true, characterData: true, subtree: true });
          console.log('[Lovable] ✓ Console observer ativo');
        } else {
          retries++;
          if (retries <= 30) {
            setTimeout(checkConsole, 2000);
          }
        }
      };
      checkConsole();
    },

    // =============================================
    // PARSER DE LOG — Detecta ações a partir do texto
    // =============================================
    parseLogLine(txt) {
      if (!txt || typeof txt !== 'string') return;

      // Remover timestamp do início (formato: "HH:MM:SS - ")
      const cleaned = txt.replace(/^\d{1,2}:\d{2}:\d{2}\s*-\s*/, '').trim();
      if (!cleaned) return;

      const sb = window.LovableSupabase;
      const safety = window.LovableSafety;

      // ---- FOLLOW ----
      let match = cleaned.match(/^Followed\s+(\S+)\s+\((\d+)\)/i);
      if (match) {
        const username = match[1];
        state.counters.follows++;
        this._trackScheduleAction('follow');
        this.saveCounters();
        // Marcar target como "done" no Supabase (sincronizar com dashboard)
        this.markTargetProcessed(username, 'done');
        // Evitar duplicação se onAction já registrou este follow
        if (!this._wasRecentlyHandled('follow')) {
          if (safety) safety.recordAction({ success: true, type: 'follow' });
          if (sb && sb.isConnected()) sb.logAction({ type: 'follow', target: username, success: true });
        }
        log('debug', `Follow: ${username}`);
        return;
      }

      // ---- UNFOLLOW ----
      match = cleaned.match(/^Unfollowed\s+(\S+)\s+\((\d+)\)/i);
      if (match) {
        const username = match[1];
        state.counters.unfollows++;
        this._trackScheduleAction('unfollow');
        this.saveCounters();
        // Marcar target como "done" no Supabase
        this.markTargetProcessed(username, 'done');
        if (!this._wasRecentlyHandled('unfollow')) {
          if (safety) safety.recordAction({ success: true, type: 'unfollow' });
          if (sb && sb.isConnected()) sb.logAction({ type: 'unfollow', target: username, success: true });
        }
        log('debug', `Unfollow: ${username}`);
        return;
      }

      // ---- LIKE ----
      match = cleaned.match(/^Liked\s+post(?:\s+for\s+(\S+))?/i);
      if (match) {
        const username = match[1] || null;
        state.counters.likes++;
        this._trackScheduleAction('like');
        this.saveCounters();
        if (!this._wasRecentlyHandled('like')) {
          if (safety) safety.recordAction({ success: true, type: 'like' });
          if (sb && sb.isConnected()) sb.logAction({ type: 'like', target: username, success: true });
        }
        log('debug', `Like: ${username || 'post'}`);
        return;
      }

      // ---- BLOCK/REMOVE ----
      match = cleaned.match(/^(Blocked|Removed)\s+(\S+)\s+\((\d+)\)/i);
      if (match) {
        const action = match[1].toLowerCase();
        const username = match[2];
        state.counters.blocks++;
        this.saveCounters();
        if (!this._wasRecentlyHandled(action)) {
          if (safety) safety.recordAction({ success: true, type: action });
          if (sb && sb.isConnected()) sb.logAction({ type: action, target: username, success: true });
        }
        log('debug', `${action}: ${username}`);
        return;
      }

      // ---- STORY VIEW ----
      match = cleaned.match(/^Viewed\s+story\s+for\s+(\S+)/i);
      if (match) {
        const username = match[1];
        state.counters.likes++; // Contar como like/view
        this._trackScheduleAction('story_view');
        this.saveCounters();
        if (!this._wasRecentlyHandled('story_view')) {
          if (sb && sb.isConnected()) sb.logAction({ type: 'story_view', target: username, success: true });
        }
        return;
      }

      // ---- SKIPS ----
      if (cleaned.match(/already\s+(attempted|being\s+followed|requested)|is\s+private.*skipped|did\s+not\s+match\s+your\s+filters|is\s+whitelisted/i)) {
        state.counters.skips++;
        this.saveCounters();
        return;
      }

      // ---- RATE LIMITS / ERRORS ----
      // Detectar os 3 tipos de rate limit do Organic com severidades diferentes:
      // 1. Hard rate limit (status 400 → "rate limit from instagram, waiting X hours")
      if (cleaned.match(/rate\s*limit.*waiting\s+[\d.]+\s*hour/i)) {
        state.counters.errors++;
        this.saveCounters();
        log('warn', `HARD rate limit detectado: ${cleaned}`);
        if (safety) safety.recordAction({ success: false, type: 'rate_limit', details: { subtype: 'hard_rate_limit' } });
        if (sb && sb.isConnected()) {
          sb.logAction({ type: 'error', target: null, success: false, details: { subtype: 'hard_rate_limit', message: cleaned } });
        }
        return;
      }

      // 2. 429 rate limit ("429 rate limit from instagram, waiting X minutes")
      if (cleaned.match(/429\s*rate\s*limit|Too\s+many\s+requests/i)) {
        state.counters.errors++;
        this.saveCounters();
        log('warn', `429 rate limit detectado: ${cleaned}`);
        if (safety) safety.recordAction({ success: false, type: 'rate_limit', details: { subtype: 'rate_limit_429' } });
        if (sb && sb.isConnected()) {
          sb.logAction({ type: 'error', target: null, success: false, details: { subtype: 'rate_limit_429', message: cleaned } });
        }
        return;
      }

      // 3. Soft rate limit (403 → "(soft) 403 soft limit")
      if (cleaned.match(/soft.*limit|403.*limit|rate\s*limit.*waiting\s+[\d.]+\s*min/i)) {
        state.counters.errors++;
        this.saveCounters();
        log('warn', `Soft rate limit detectado: ${cleaned}`);
        // Soft limit é menos grave — registrar como erro, não como rate_limit completo
        if (safety) safety.recordAction({ success: false, type: 'error', details: { subtype: 'soft_rate_limit' } });
        if (sb && sb.isConnected()) {
          sb.logAction({ type: 'error', target: null, success: false, details: { subtype: 'soft_rate_limit', message: cleaned } });
        }
        return;
      }

      // 4. Rate limit genérico (qualquer menção a rate limit não capturada acima)
      if (cleaned.match(/rate\s*limit|429/i)) {
        state.counters.errors++;
        this.saveCounters();
        if (safety) safety.recordAction({ success: false, type: 'rate_limit', details: { subtype: 'rate_limit' } });
        if (sb && sb.isConnected()) {
          sb.logAction({ type: 'error', target: null, success: false, details: { subtype: 'rate_limit', message: cleaned } });
        }
        return;
      }

      if (cleaned.match(/blocked|feedback_message.*blocked/i) && !cleaned.match(/^(Blocked|Removed)/)) {
        state.counters.errors++;
        this.saveCounters();
        if (safety) safety.recordAction({ success: false, type: 'block', details: { subtype: 'action_blocked' } });
        if (sb && sb.isConnected()) {
          sb.logAction({ type: 'error', target: null, success: false, details: { subtype: 'action_blocked', message: cleaned } });
        }
        return;
      }

      if (cleaned.match(/error.*trying\s+again|403|400.*rate/i)) {
        state.counters.errors++;
        this.saveCounters();
        if (safety) safety.recordAction({ success: false, type: 'error' });
        return;
      }

      // ---- DETECÇÃO DE PERFIL via log ----
      match = cleaned.match(/^Current\s+(?:IG\s+User|profile):\s*(\S+)/i);
      if (match && match[1]) {
        const detectedUser = match[1];
        if (detectedUser !== state.igUsername) {
          state.igUsername = detectedUser;
          chrome.storage.local.set({ lovable_ig_username: detectedUser });
          log('info', `Perfil detectado via log: @${detectedUser}`);
          // Forçar coleta de dados do perfil com o novo username
          setTimeout(() => this.collectProfile(), 2000);
        }
        return;
      }
    },

    // =============================================
    // MARCAR TARGET COMO PROCESSADO NO SUPABASE
    // =============================================
    // Chamado após follow/unfollow/etc. bem-sucedido para sincronizar status com dashboard
    async markTargetProcessed(username, status) {
      if (!username) return;
      const queueId = state.queueIdMap[username];
      if (!queueId) return; // Target não veio do dashboard (ex: fila manual do Organic)
      try {
        const sb = window.LovableSupabase;
        if (sb && sb.isConnected()) {
          await sb.markQueueItems([queueId], status || 'done');
          log('debug', `Target "${username}" marcado como "${status}" no Supabase`);
        }
        // Remover do mapa após processamento
        delete state.queueIdMap[username];
      } catch (e) {
        log('warn', `Falha ao marcar target "${username}" como "${status}":`, e?.message);
      }
    },


    _saveTimer: null,
    saveCounters() {
      if (this._saveTimer) return;
      this._saveTimer = setTimeout(async () => {
        this._saveTimer = null;
        await chrome.storage.local.set({
          lovable_counters: state.counters,
          lovable_session_start: state.sessionStart,
          lovable_schedule_daily: state.scheduleDaily
        });
      }, 2000);
    },

    // Incrementar meta diária do scheduler
    _trackScheduleAction(type) {
      const today = new Date().toISOString().slice(0, 10);
      if (state.scheduleDaily.date !== today) {
        state.scheduleDaily = { date: today, follows: 0, likes: 0, unfollows: 0 };
      }
      if (type === 'follow') state.scheduleDaily.follows++;
      else if (type === 'like' || type === 'story_view') state.scheduleDaily.likes++;
      else if (type === 'unfollow') state.scheduleDaily.unfollows++;
    },

    // =============================================
    // COLETAR PERFIL DO INSTAGRAM
    // =============================================
    // Helper: pegar CSRF token do cookie (igual ao Organic original)
    _getCsrf() {
      try {
        const match = document.cookie.match(/csrftoken=([^;]+)/);
        return match ? match[1] : '';
      } catch (e) { return ''; }
    },

    // Helper: pegar ds_user_id do cookie
    _getDsUserId() {
      try {
        const match = document.cookie.match(/ds_user_id=([^;]+)/);
        return match ? match[1] : '';
      } catch (e) { return ''; }
    },

    // Rate limiter para chamadas à API do Instagram
    // Impede chamadas simultâneas e muito frequentes
    _lastIgApiCall: 0,
    _igApiLock: false,
    async _waitForApiSlot(minGapMs) {
      const gap = minGapMs || 3000; // mínimo 3s entre chamadas API
      // Aguardar lock (outra chamada em andamento)
      let waitAttempts = 0;
      while (this._igApiLock && waitAttempts < 30) {
        await new Promise(r => setTimeout(r, 1000));
        waitAttempts++;
      }
      // Aguardar gap mínimo desde última chamada
      const elapsed = Date.now() - this._lastIgApiCall;
      if (elapsed < gap) {
        await new Promise(r => setTimeout(r, gap - elapsed));
      }
      this._igApiLock = true;
      this._lastIgApiCall = Date.now();
    },
    _releaseApiSlot() {
      this._igApiLock = false;
      this._lastIgApiCall = Date.now();
    },

    _collectProfileRunning: false,
    async collectProfile() {
      // IMPORTANTE: Este método NÃO faz chamadas API ao Instagram!
      // Usa APENAS dados já disponíveis localmente (variáveis, DOM, cookies, storage)
      // para evitar rate limits. O Organic já faz suas próprias chamadas.
      if (this._collectProfileRunning) return;
      this._collectProfileRunning = true;
      const P = (msg) => console.log('%c[Lovable:Profile] ' + msg, 'color: #E84393');
      try {
        let username = state.igUsername || null;
        P('Coletando perfil (sem chamadas API)...');

        // =============================================
        // FASE 1: Obter o username (apenas dados locais)
        // =============================================

        // 1A: Via variável global "user" do Organic
        if (!username) {
          try {
            if (typeof user !== 'undefined' && user && user.viewer && user.viewer.username) {
              username = user.viewer.username;
              P('✓ Username via user.viewer: ' + username);
            }
          } catch (e) {}
        }

        // 1B: Via statusDiv do Organic (link ou texto)
        if (!username) {
          try {
            const statusDiv = document.getElementById('igBotStatusDiv');
            if (statusDiv) {
              const link = statusDiv.querySelector('a[href*="instagram.com/"]');
              if (link) {
                const m = link.href.match(/instagram\.com\/([^/]+)/);
                if (m && m[1]) { username = m[1]; P('✓ Username via statusDiv link: ' + username); }
              }
              if (!username) {
                const text = statusDiv.textContent;
                const m = text.match(/Current\s+(?:IG\s+User|profile):\s*(\S+)/i);
                if (m && m[1]) { username = m[1]; P('✓ Username via statusDiv text: ' + username); }
              }
            }
          } catch (e) {}
        }

        // 1C: Via txtConsole do Organic
        if (!username) {
          try {
            const consoleEl = document.getElementById('txtConsole');
            if (consoleEl) {
              const text = consoleEl.textContent || '';
              const matches = text.match(/Current\s+(?:IG\s+User|profile):\s*(\S+)/gi);
              if (matches && matches.length > 0) {
                const parsed = matches[matches.length - 1].match(/Current\s+(?:IG\s+User|profile):\s*(\S+)/i);
                if (parsed && parsed[1]) { username = parsed[1]; P('✓ Username via txtConsole: ' + username); }
              }
            }
          } catch (e) {}
        }

        // 1D: Via cookie ds_user_id (apenas ler o cookie, SEM chamada API)
        if (!username) {
          try {
            const dsMatch = document.cookie.match(/ds_user_id=([^;]+)/);
            if (dsMatch && dsMatch[1]) {
              P('ds_user_id encontrado: ' + dsMatch[1] + ' (sem username ainda)');
            }
          } catch (e) {}
        }

        if (username) {
          state.igUsername = username;
          P('Username: ' + username);
        } else {
          P('Username não detectado ainda — aguardando Organic carregar');
        }

        // =============================================
        // FASE 2: Obter dados do perfil (apenas dados locais)
        // =============================================

        // 2A: Via variável global "user" do Organic
        if (!state.igProfile || typeof state.igProfile.followers !== 'number') {
          try {
            if (typeof user !== 'undefined' && user && user.viewer) {
              const v = user.viewer;
              if (v.edge_followed_by) {
                state.igProfile = {
                  username: v.username || username,
                  full_name: v.full_name || '',
                  followers: v.edge_followed_by?.count || 0,
                  following: v.edge_follow?.count || 0,
                  posts: v.edge_owner_to_timeline_media?.count || 0
                };
                P('✓ Profile data via user.viewer');
              }
            }
          } catch (e) {}
        }

        // 2B: Via chrome.storage (dados salvos de sessões anteriores)
        if (username && (!state.igProfile || typeof state.igProfile.followers !== 'number')) {
          try {
            const stored = await chrome.storage.local.get('lovable_last_profile');
            if (stored.lovable_last_profile && stored.lovable_last_profile.username === username) {
              state.igProfile = stored.lovable_last_profile;
              P('✓ Profile data via storage (sessão anterior)');
            }
          } catch (e) {}
        }

        // =============================================
        // FASE 3: Salvar e sincronizar
        // =============================================
        if (state.igUsername) {
          if (!state.igProfile) {
            state.igProfile = { username: state.igUsername };
          }
          await chrome.storage.local.set({
            lovable_ig_username: state.igUsername,
            lovable_last_profile: state.igProfile
          });

          const sb = window.LovableSupabase;
          if (sb && sb.isConnected()) {
            sb.updateIgAccount(state.igProfile);
          }

          if (state.igProfile.followers != null) {
            P('✓ @' + state.igUsername + ' | ' + state.igProfile.followers + ' seguidores');
          } else {
            P('✓ @' + state.igUsername + ' (aguardando dados completos do Organic)');
          }
        }
      } catch (e) {
        console.error('[Lovable:Profile] Erro:', e?.message);
      } finally {
        this._collectProfileRunning = false;
      }
    },

    // =============================================
    // HEARTBEAT
    // =============================================
    async sendHeartbeat() {
      const sb = window.LovableSupabase;
      if (!sb || !sb.isConnected()) return;

      // Determinar modo atual pelos radio buttons reais do Organic
      try {
        if (document.getElementById('radioFollow')?.checked) state.currentMode = 'seguir';
        else if (document.getElementById('radioFollowAndLike')?.checked) state.currentMode = 'seguir_curtir';
        else if (document.getElementById('radioLikeOnly')?.checked) state.currentMode = 'curtir';
        else if (document.getElementById('radioUnFollow')?.checked) state.currentMode = 'deixar_seguir';
        else if (document.getElementById('radioRemoveFromFollowers')?.checked) state.currentMode = 'remover';
        else if (document.getElementById('radioBlock')?.checked) state.currentMode = 'bloquear';
        else if (document.getElementById('radioViewStory')?.checked) state.currentMode = 'ver_story';
        else if (document.getElementById('radioGetMoreData')?.checked) state.currentMode = 'obter_dados';
      } catch (e) { /* ignorar */ }

      // Determinar se está processando
      try {
        const btnProcess = document.getElementById('btnProcessQueue');
        state.isProcessing = btnProcess ? btnProcess.classList.contains('pulsing') : false;
      } catch (e) { /* ignorar */ }

      const status = state.isProcessing ? 'processing' : 'online';
      await sb.updateBotStatus(true, status, state.currentMode);

      // Heartbeat enriquecido: safety preset, scheduler progress, likes per follow
      try {
        const presetData = await chrome.storage.local.get('lovable_safety_preset');
        const activePreset = presetData.lovable_safety_preset || 'media';
        const enrichedBody = {
          safety_preset: activePreset,
          scheduler_progress: state.scheduleDaily || {},
          updated_at: new Date().toISOString()
        };
        // Incluir likes_per_follow se disponível
        try {
          const likeInput = document.getElementById('numberFollowLikeLatestPics');
          if (likeInput) enrichedBody.likes_per_follow = parseInt(likeInput.value) || 0;
        } catch (e) { /* ignorar */ }
        const safeEq = (v) => encodeURIComponent(String(v ?? '').trim());
        sb.patchWithRetry('ig_accounts', `id=eq.${safeEq(sb.igAccountId)}`, enrichedBody);
      } catch (e) {
        log('debug', 'Heartbeat enriquecido falhou:', e?.message || e);
      }

      state.lastHeartbeat = Date.now();
      log('debug', `Heartbeat: ${status} | modo: ${state.currentMode}`);
    },

    // =============================================
    // SYNC DE QUEUE DO SUPABASE -> ORGANIC
    // =============================================
    async syncQueueFromSupabase() {
      const sb = window.LovableSupabase;
      if (!sb || !sb.isConnected()) return { ok: false, error: 'Não conectado' };

      try {
        const targets = await sb.fetchTargetQueue();
        if (targets.length === 0) {
          log('debug', 'Nenhum target pendente no Supabase');
          return { ok: true, injected: 0 };
        }

        // Verificar se acctsQueue existe (Organic carregado)
        if (typeof acctsQueue === 'undefined') {
          log('warn', 'acctsQueue não disponível - Organic não carregado');
          return { ok: false, error: 'Organic não carregado' };
        }

        const injectedIds = [];
        const injectedUsernames = [];

        // ── Passo 1: Limpar do acctsQueue itens que foram skipped/done no dashboard ──
        // (usuário clicou "Pular" ou "Limpar Fila" no dashboard enquanto extensão estava ativa)
        try {
          const trackedUsernames = Object.keys(state.queueIdMap);
          if (trackedUsernames.length > 0 && typeof acctsQueue !== 'undefined') {
            // Os targets recém buscados têm status "pending" — qualquer username rastreado
            // que NÃO apareça nos targets pendentes foi skipped/done externamente
            const pendingUsernames = new Set(targets.map(t => (window.LovableUtils
              ? window.LovableUtils.sanitizeUsername(t.username)
              : t.username).toLowerCase()));
            const removedUsernames = trackedUsernames.filter(u => !pendingUsernames.has(u.toLowerCase()));
            if (removedUsernames.length > 0) {
              const before = acctsQueue.length;
              for (let i = acctsQueue.length - 1; i >= 0; i--) {
                if (removedUsernames.includes((acctsQueue[i].username || '').toLowerCase())) {
                  acctsQueue.splice(i, 1);
                }
              }
              for (const uname of removedUsernames) delete state.queueIdMap[uname];
              if (acctsQueue.length !== before) {
                log('info', `Queue cleanup: ${before - acctsQueue.length} target(s) removidos (não estão mais pendentes no dashboard)`);
                try { if (typeof arrayOfUsersToDiv === 'function') arrayOfUsersToDiv(acctsQueue, true); } catch (e) {}
                try { if (typeof saveQueueToStorage === 'function') saveQueueToStorage(); } catch (e) {}
              }
            }
          }
        } catch (cleanupErr) {
          log('warn', 'Queue cleanup falhou:', cleanupErr?.message);
        }

        // ── Passo 2: Injetar novos targets pendentes ──
        for (const target of targets) {
          const username = window.LovableUtils ? window.LovableUtils.sanitizeUsername(target.username) : target.username;
          if (!username) continue;

          // Registrar no mapa SEMPRE para poder marcar como "done" depois
          state.queueIdMap[username] = target.id;

          // Verificar se já está na fila local do Organic
          const alreadyInQueue = acctsQueue.some(a => a.username === username);
          if (alreadyInQueue) {
            injectedIds.push(target.id);
            continue;
          }

          // Criar objeto de conta mínimo compatível com Organic
          // O Organic busca dados adicionais via getAdditionalDataForAcct() ao processar
          const acctObj = {
            username: username,
            id: null,
            full_name: '',
            _fromLovable: true,
            _lovableQueueId: target.id
          };

          acctsQueue.push(acctObj);
          injectedIds.push(target.id);
          injectedUsernames.push(username);
        }

        // Marcar como injetados no Supabase
        if (injectedIds.length > 0) {
          await sb.markQueueItems(injectedIds, 'injected');
        }

        // Atualizar a tabela visual do Organic
        if (injectedUsernames.length > 0 && typeof arrayOfUsersToDiv === 'function') {
          try { arrayOfUsersToDiv(acctsQueue, true); } catch (e) { /* ignorar */ }
        }
        // Persistir fila no storage do Organic
        if (injectedUsernames.length > 0 && typeof saveQueueToStorage === 'function') {
          try { saveQueueToStorage(); } catch (e) {}
        }

        log('info', `Queue sync: ${injectedUsernames.length} targets injetados de ${targets.length} pendentes (mapa: ${Object.keys(state.queueIdMap).length})`);
        state.lastQueueSync = Date.now();
        return { ok: true, injected: injectedUsernames.length };
      } catch (e) {
        log('error', 'syncQueueFromSupabase falhou:', e);
        return { ok: false, error: e?.message || 'Erro desconhecido' };
      }
    },

    // =============================================
    // SYNC DE SETTINGS DO SUPABASE -> ORGANIC
    // =============================================
    // Timestamp da última settings aplicada do dashboard (para change detection)
    _lastSettingsUpdatedAt: null,

    async syncSettingsFromSupabase() {
      const sb = window.LovableSupabase;
      if (!sb || !sb.isConnected()) return;

      try {
        // Usar fetch estendido para incluir novas colunas
        const settings = sb.fetchBotSettingsExtended
          ? await sb.fetchBotSettingsExtended()
          : await sb.fetchBotSettings();
        if (!settings) return;

        // Change detection: só aplicar se updated_at mudou (evitar loops)
        if (settings.updated_at && settings.updated_at === this._lastSettingsUpdatedAt) {
          log('debug', 'Settings sem alteração — pulando');
          return;
        }
        this._lastSettingsUpdatedAt = settings.updated_at || null;

        // Aplicar modo (se definido pelo dashboard)
        if (settings.bot_mode && settings.bot_mode !== state.currentMode) {
          this.applyMode(settings.bot_mode);
        }

        // Aplicar delays no Organic nativo
        if (typeof gblOptions !== 'undefined') {
          if (settings.delay_min && settings.delay_max) {
            gblOptions.timeDelay = settings.delay_min * 1000;
          }
          const sessionLimit = settings.max_actions_per_session;
          if (sessionLimit != null && sessionLimit > 0) {
            gblOptions.maxPerActions = sessionLimit;
            gblOptions.maxPerEnabled = true;
          }
          if (sessionLimit >= 9999) {
            await chrome.storage.local.set({ lovable_auto_renew_session: true });
          }
        }

        // Aplicar likes_per_follow do dashboard
        if (typeof settings.likes_per_follow === 'number') {
          try {
            const likeInput = document.getElementById('numberFollowLikeLatestPics');
            if (likeInput) {
              likeInput.value = settings.likes_per_follow;
              likeInput.dispatchEvent(new Event('input'));
            }
          } catch (e) { /* silencioso */ }
        }

        // Aplicar safety_preset do dashboard (se diferente do local)
        if (settings.safety_preset) {
          const localPresetData = await chrome.storage.local.get('lovable_safety_preset');
          const localPreset = localPresetData.lovable_safety_preset || 'media';
          if (settings.safety_preset !== localPreset) {
            const safety = window.LovableSafety;
            if (safety && safety.applyPreset) {
              safety.applyPreset(settings.safety_preset, true);
              this.applyOrganicTimings(settings.safety_preset);
              await chrome.storage.local.set({ lovable_safety_preset: settings.safety_preset });
              log('info', `Preset sincronizado do dashboard: ${settings.safety_preset}`);
            }
          }
        }

        // Aplicar safety_limits do dashboard (se definidos e diferentes)
        if (settings.safety_limits && typeof settings.safety_limits === 'object') {
          const sl = settings.safety_limits;
          if (sl.MAX_PER_HOUR || sl.MAX_PER_DAY || sl.MAX_PER_SESSION) {
            const safety = window.LovableSafety;
            if (safety && safety.updateLimits) {
              safety.updateLimits(sl);
              await chrome.storage.local.set({ lovable_safety_limits: sl });
              if (sl.MAX_PER_SESSION >= 9999) {
                await chrome.storage.local.set({ lovable_auto_renew_session: true });
              }
              log('info', 'Limites de segurança sincronizados do dashboard');
            }
          }
        }

        // Aplicar agendamento
        if (settings.bot_schedule && typeof settings.bot_schedule === 'object' && settings.bot_schedule.days) {
          state.schedule = settings.bot_schedule;
          await chrome.storage.local.set({ lovable_schedule: state.schedule });
        }

        state.lastSettingsSync = Date.now();
        log('debug', 'Settings sincronizadas do Supabase');
      } catch (e) {
        log('warn', 'syncSettings falhou:', e?.message || e);
      }
    },

    // =============================================
    // APLICAR MODO NO ORGANIC
    // =============================================
    applyMode(mode) {
      try {
        const modeMap = {
          'seguir': 'radioFollow',
          'seguir_curtir': 'radioFollowAndLike',
          'curtir': 'radioLikeOnly',
          'deixar_seguir': 'radioUnFollow',
          'remover': 'radioRemoveFromFollowers',
          'bloquear': 'radioBlock',
          'ver_story': 'radioViewStory',
          'comentar': 'radioAutoComment',
          'obter_dados': 'radioGetMoreData'
        };
        const radioId = modeMap[mode];
        if (radioId) {
          const radio = document.getElementById(radioId);
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
            state.currentMode = mode;
            log('info', `Modo aplicado: ${mode}`);
          }
        }
      } catch (e) {
        log('warn', 'Falha ao aplicar modo:', e?.message || e);
      }
    },

    // =============================================
    // EXECUTAR COMANDO REMOTO
    // =============================================
    async executeCommand(command) {
      const sb = window.LovableSupabase;
      let result = { ok: false, error: 'Comando desconhecido' };

      try {
        switch (command.command || command.command_type || command.type) {
          case 'start':
          case 'BOT_START': {
            const btn = document.getElementById('btnProcessQueue');
            if (btn && !btn.classList.contains('pulsing')) {
              btn.click();
              result = { ok: true, message: 'Bot iniciado' };
            } else if (btn && btn.classList.contains('pulsing')) {
              result = { ok: true, message: 'Bot já está processando' };
            } else {
              result = { ok: false, error: 'Botão de processar não encontrado' };
            }
            break;
          }

          case 'stop':
          case 'BOT_STOP': {
            // Botões reais do Organic: #btnStop e #btnStop2
            const btn = document.getElementById('btnStop') || document.getElementById('btnStop2');
            if (btn) {
              btn.click();
              result = { ok: true, message: 'Bot parado' };
            } else {
              // Fallback: parar via Organic internals
              if (typeof timeoutsQueue !== 'undefined') {
                timeoutsQueue.forEach(t => clearTimeout(t));
                timeoutsQueue.length = 0;
                try { document.querySelectorAll('#igBotInjectedContainer .pulsing').forEach(el => el.classList.remove('pulsing')); } catch(e) {}
                result = { ok: true, message: 'Bot parado (timeouts limpos)' };
              } else {
                result = { ok: false, error: 'Botão de parar não encontrado' };
              }
            }
            break;
          }

          case 'set_mode':
          case 'BOT_SET_MODE': {
            const mode = command.payload?.mode || command.mode;
            if (mode) {
              this.applyMode(mode);
              result = { ok: true, message: `Modo: ${mode}` };
            } else {
              result = { ok: false, error: 'Modo não especificado' };
            }
            break;
          }

          case 'BOT_SET_COMMENT_CONFIG': {
            try {
              const cfg = command.payload || command;
              if (typeof gblOptions !== 'undefined') {
                if (cfg.enableAutoComments !== undefined) gblOptions.enableAutoComments = cfg.enableAutoComments;
                if (cfg.maxCommentsPerDay !== undefined) gblOptions.maxCommentsPerDay = cfg.maxCommentsPerDay;
                if (cfg.minCommentDelay !== undefined) gblOptions.minCommentDelay = cfg.minCommentDelay;
                if (cfg.maxCommentDelay !== undefined) gblOptions.maxCommentDelay = cfg.maxCommentDelay;
                if (cfg.commentOnlyRecent !== undefined) gblOptions.commentOnlyRecent = cfg.commentOnlyRecent;
                if (cfg.commentVariation !== undefined) gblOptions.commentVariation = cfg.commentVariation;
                if (cfg.customCommentTemplates !== undefined) gblOptions.customCommentTemplates = cfg.customCommentTemplates;

                // Update UI checkboxes if they exist
                const cbEnable = document.getElementById('cbEnableComments');
                if (cbEnable) cbEnable.checked = gblOptions.enableAutoComments;
                const txtMax = document.getElementById('txtMaxCommentsPerDay');
                if (txtMax) txtMax.value = gblOptions.maxCommentsPerDay;
                const txtMinDelay = document.getElementById('txtMinCommentDelay');
                if (txtMinDelay) txtMinDelay.value = (gblOptions.minCommentDelay / 1000);
                const txtMaxDelay = document.getElementById('txtMaxCommentDelay');
                if (txtMaxDelay) txtMaxDelay.value = (gblOptions.maxCommentDelay / 1000);
                const cbRecent = document.getElementById('cbCommentOnlyRecent');
                if (cbRecent) cbRecent.checked = gblOptions.commentOnlyRecent;
                const cbVar = document.getElementById('cbCommentVariation');
                if (cbVar) cbVar.checked = gblOptions.commentVariation;
                const txtTemplates = document.getElementById('txtCustomCommentTemplates');
                if (txtTemplates && gblOptions.customCommentTemplates) {
                  txtTemplates.value = gblOptions.customCommentTemplates.join('\n');
                }

                // Save options via Organic
                if (typeof saveOptions === 'function') saveOptions();

                result = { ok: true, message: 'Configuração de comentários salva' };
              } else {
                result = { ok: false, error: 'gblOptions não disponível' };
              }
            } catch (e) {
              result = { ok: false, error: e?.message || 'Erro ao configurar comentários' };
            }
            break;
          }

          case 'sync_queue':
          case 'inject_queue':
          case 'FORCE_QUEUE_SYNC': {
            result = await this.syncQueueFromSupabase();
            break;
          }

          case 'collect_followers': {
            // Coletar seguidores da conta bot atual e inserir na target_queue
            result = await this.collectFollowersOrFollowing('followers', command.params || command.payload || {});
            break;
          }

          case 'collect_following': {
            // Coletar contas que o bot está seguindo e inserir na target_queue
            result = await this.collectFollowersOrFollowing('following', command.params || command.payload || {});
            break;
          }

          case 'collect_hashtag': {
            const hashtag = (command.params || command.payload || {}).hashtag || command.hashtag;
            if (!hashtag) { result = { ok: false, error: 'Hashtag não especificada' }; break; }
            result = await this.collectFromHashtag(hashtag.replace(/^#/, ''));
            break;
          }

          case 'collect_location': {
            const location = (command.params || command.payload || {}).location || command.location;
            if (!location) { result = { ok: false, error: 'Localização não especificada' }; break; }
            result = await this.collectFromLocation(location);
            break;
          }

          case 'collect_via_api': {
            // Forçar re-detecção do perfil e sync de settings via API
            await this.collectProfile();
            await this.syncSettingsFromSupabase();
            result = await this.syncQueueFromSupabase();
            result.message = 'Perfil re-detectado e fila sincronizada via API';
            break;
          }

          case 'BOT_LOAD_QUEUE': {
            // Clicar no botão de carregar contas do Organic (Load Followers)
            try {
              const btnLoad = document.getElementById('btnLoadFollowers') ||
                              document.querySelector('#igBotInjectedContainer .igBotInjectedButton[id*="Load"]');
              if (btnLoad) {
                btnLoad.click();
                result = { ok: true, message: 'Carregamento de contas iniciado' };
              } else {
                // Fallback: tentar o primeiro botão de load que encontrar
                const loadBtns = document.querySelectorAll('#igBotInjectedContainer .igBotInjectedButton');
                let found = false;
                loadBtns.forEach(btn => {
                  if (!found && (btn.textContent.includes('Load') || btn.textContent.includes('Carregar'))) {
                    btn.click();
                    found = true;
                  }
                });
                result = found ? { ok: true, message: 'Carregamento iniciado' } : { ok: false, error: 'Botão de carregar não encontrado' };
              }
            } catch (e) {
              result = { ok: false, error: e?.message || 'Erro ao carregar contas' };
            }
            break;
          }

          case 'sync_settings': {
            await this.syncSettingsFromSupabase();
            result = { ok: true, message: 'Settings sincronizadas' };
            break;
          }

          case 'set_safety_preset': {
            const presetName = command.payload?.preset || command.preset;
            if (presetName) {
              const safety = window.LovableSafety;
              const SESSION_UNLIMITED = 9999;
              const autoRenewData = await chrome.storage.local.get('lovable_auto_renew_session');
              const autoRenew = autoRenewData.lovable_auto_renew_session !== false;
              if (safety && safety.applyPreset) {
                safety.applyPreset(presetName, true);
                if (autoRenew && safety.updateLimits && safety._customLimits) {
                  safety.updateLimits({
                    MAX_PER_HOUR: safety._customLimits.MAX_PER_HOUR,
                    MAX_PER_DAY: safety._customLimits.MAX_PER_DAY,
                    MAX_PER_SESSION: SESSION_UNLIMITED
                  });
                }
              }
              this.applyOrganicTimings(presetName);
              await chrome.storage.local.set({ lovable_safety_preset: presetName });
              const cfgPresets = window.LovableConfig?.SAFETY_PRESETS;
              const presetInfo = cfgPresets ? cfgPresets[presetName] : null;
              if (presetInfo) {
                const limits = {
                  MAX_PER_HOUR: presetInfo.MAX_PER_HOUR,
                  MAX_PER_DAY: presetInfo.MAX_PER_DAY,
                  MAX_PER_SESSION: autoRenew ? SESSION_UNLIMITED : presetInfo.MAX_PER_SESSION
                };
                await chrome.storage.local.set({ lovable_safety_limits: limits });
              }
              result = { ok: true, message: `Preset aplicado: ${presetName}` };
              log('info', `Preset aplicado via comando remoto: ${presetName}`);
            } else {
              result = { ok: false, error: 'Preset não especificado' };
            }
            break;
          }

          case 'set_safety_limits': {
            const limits = command.payload || {};
            const safety = window.LovableSafety;
            if (safety && safety.updateLimits && (limits.MAX_PER_HOUR || limits.MAX_PER_DAY || limits.MAX_PER_SESSION)) {
              safety.updateLimits(limits);
              await chrome.storage.local.set({ lovable_safety_limits: limits });
              result = { ok: true, message: 'Limites atualizados' };
            } else {
              result = { ok: false, error: 'Limites inválidos' };
            }
            break;
          }

          case 'scrape':
          case 'BOT_SCRAPE': {
            const username = command.payload?.username || command.username;
            const maxCount = command.payload?.max_count || command.max_count || 200;
            if (username) {
              result = await this.scrapeFollowers(username, maxCount);
            } else {
              result = { ok: false, error: 'Username não especificado' };
            }
            break;
          }

          case 'collect_profile':
          case 'FORCE_PROFILE_UPDATE': {
            await this.collectProfile();
            result = { ok: true, profile: state.igProfile };
            break;
          }

          default:
            log('warn', `Comando desconhecido: ${command.command || command.command_type || command.type}`);
        }
      } catch (e) {
        result = { ok: false, error: e?.message || 'Erro ao executar comando' };
      }

      // Marcar comando como executado
      if (sb && sb.isConnected() && command.id) {
        await sb.markCommandExecuted(command.id, result);
      }

      return result;
    },

    // =============================================
    // SCRAPE DE SEGUIDORES
    // =============================================
    async scrapeFollowers(username, maxCount) {
      const sb = window.LovableSupabase;
      const safety = window.LovableSafety;
      log('info', `Scraping seguidores de @${username} (max: ${maxCount})`);

      // Verificar se safety permite (evitar scrape durante cooldown/rate limit)
      if (safety) {
        const check = safety.canProceed();
        if (!check.allowed) {
          return { ok: false, error: `Safety bloqueou scrape: ${check.reason}` };
        }
      }

      try {
        await this._waitForApiSlot(5000); // Gap maior (5s) para scrape
        // Buscar userId primeiro
        const profileRes = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
          headers: {
            'x-ig-app-id': '936619743392459',
            'x-requested-with': 'XMLHttpRequest'
          },
          credentials: 'include'
        });

        if (profileRes.status === 429) {
          if (safety) safety.recordAction({ success: false, type: 'rate_limit', details: { subtype: 'rate_limit' } });
          return { ok: false, error: 'Rate limit do Instagram — tente mais tarde' };
        }
        if (!profileRes.ok) {
          return { ok: false, error: `Perfil @${username} não encontrado (${profileRes.status})` };
        }

        const profileData = await profileRes.json();
        const userId = profileData.data?.user?.id;
        if (!userId) return { ok: false, error: 'ID do usuário não encontrado' };

        const followers = [];
        let after = '';
        let hasNext = true;

        while (hasNext && followers.length < maxCount) {
          // Verificar safety a cada página
          if (safety) {
            const check = safety.canProceed();
            if (!check.allowed) {
              log('warn', `Scrape interrompido pelo Safety: ${check.reason}`);
              break;
            }
          }

          await this._waitForApiSlot(5000); // Gap maior entre páginas
          const url = `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=50&max_id=${after}`;
          const res = await fetch(url, {
            headers: {
              'x-ig-app-id': '936619743392459',
              'x-requested-with': 'XMLHttpRequest'
            },
            credentials: 'include'
          });

          if (res.status === 429) {
            log('warn', `Scrape: rate limit em ${followers.length} seguidores`);
            if (safety) safety.recordAction({ success: false, type: 'rate_limit', details: { subtype: 'rate_limit' } });
            break;
          }
          if (!res.ok) {
            log('warn', `Scrape parou em ${followers.length} seguidores (status ${res.status})`);
            break;
          }

          const data = await res.json();
          if (data.users) {
            for (const user of data.users) {
              if (followers.length >= maxCount) break;
              followers.push(user.username);
            }
          }

          hasNext = !!data.next_max_id;
          after = data.next_max_id || '';

          // Delay longo entre páginas para evitar rate limit (3-6s)
          await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
        }

        // Upload para Supabase
        if (followers.length > 0 && sb && sb.isConnected()) {
          await sb.uploadScrapeResults(followers, username);
        }

        log('info', `Scrape concluído: ${followers.length} seguidores de @${username}`);
        this._releaseApiSlot();
        return { ok: true, count: followers.length, source: username, followers };
      } catch (e) {
        this._releaseApiSlot();
        log('error', 'Scrape falhou:', e);
        return { ok: false, error: e?.message || 'Erro no scrape' };
      }
    },

    // =============================================
    // COLETAR SEGUIDORES / SEGUINDO DA CONTA BOT
    // =============================================
    async collectFollowersOrFollowing(type, opts) {
      const sb = window.LovableSupabase;
      const safety = window.LovableSafety;
      const maxCount = opts.max_count || 500;

      if (safety) {
        const check = safety.canProceed();
        if (!check.allowed) return { ok: false, error: `Safety bloqueou coleta: ${check.reason}` };
      }

      // Obter user_id da conta bot (do cookie ds_user_id)
      const dsMatch = document.cookie.match(/ds_user_id=([^;]+)/);
      const userId = dsMatch ? dsMatch[1] : null;
      if (!userId) return { ok: false, error: 'user_id do bot não encontrado. Verifique se está logado no Instagram.' };

      log('info', `Coletando ${type} da conta bot (userId: ${userId}, max: ${maxCount})...`);

      try {
        const collected = [];
        let afterCursor = '';
        let hasNext = true;

        while (hasNext && collected.length < maxCount) {
          if (safety) {
            const check = safety.canProceed();
            if (!check.allowed) { log('warn', `Coleta interrompida: ${check.reason}`); break; }
          }

          await this._waitForApiSlot(4000);
          const endpoint = type === 'followers'
            ? `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=50${afterCursor ? '&max_id=' + afterCursor : ''}`
            : `https://www.instagram.com/api/v1/friendships/${userId}/following/?count=50${afterCursor ? '&max_id=' + afterCursor : ''}`;

          const res = await fetch(endpoint, {
            headers: { 'x-ig-app-id': '936619743392459', 'x-requested-with': 'XMLHttpRequest' },
            credentials: 'include'
          });

          if (res.status === 429) {
            if (safety) safety.recordAction({ success: false, type: 'rate_limit', details: { subtype: 'rate_limit_429' } });
            log('warn', `Rate limit durante coleta de ${type} em ${collected.length} usuários`);
            break;
          }
          if (!res.ok) { log('warn', `Coleta de ${type} parou com status ${res.status}`); break; }

          const data = await res.json();
          for (const u of (data.users || [])) {
            if (collected.length >= maxCount) break;
            collected.push({
              username: u.username,
              is_private: u.is_private || false,
              is_verified: u.is_verified || false,
              profile_pic_url: u.profile_pic_url || ''
            });
          }

          hasNext = !!data.next_max_id;
          afterCursor = data.next_max_id || '';
          await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
        }

        this._releaseApiSlot();

        if (collected.length > 0 && sb && sb.isConnected()) {
          await sb.uploadTargetsWithDetails(collected, type, sb.igAccountId);
        }

        log('info', `Coleta de ${type} concluída: ${collected.length} usuários`);
        return { ok: true, count: collected.length, source: type };
      } catch (e) {
        this._releaseApiSlot();
        log('error', `Coleta de ${type} falhou:`, e);
        return { ok: false, error: e?.message || 'Erro na coleta' };
      }
    },

    // =============================================
    // COLETAR USUÁRIOS POR HASHTAG
    // =============================================
    async collectFromHashtag(hashtag) {
      const sb = window.LovableSupabase;
      log('info', `Coletando usuários da hashtag #${hashtag}...`);
      try {
        await this._waitForApiSlot(4000);
        // Buscar posts recentes da hashtag via API do Instagram
        const searchRes = await fetch(
          `https://www.instagram.com/api/v1/tags/web_info/?tag_name=${encodeURIComponent(hashtag)}`,
          { headers: { 'x-ig-app-id': '936619743392459', 'x-requested-with': 'XMLHttpRequest' }, credentials: 'include' }
        );
        this._releaseApiSlot();

        if (searchRes.status === 429) return { ok: false, error: 'Rate limit — tente novamente mais tarde' };
        if (!searchRes.ok) return { ok: false, error: `Hashtag #${hashtag} não encontrada (${searchRes.status})` };

        const tagData = await searchRes.json();
        const sections = tagData?.data?.top?.sections || tagData?.data?.recent?.sections || [];
        const usernames = new Set();

        for (const section of sections) {
          for (const item of (section.layout_content?.medias || [])) {
            const user = item.media?.user;
            if (user?.username) usernames.add(user.username);
            if (usernames.size >= 200) break;
          }
          if (usernames.size >= 200) break;
        }

        const collected = Array.from(usernames);
        if (collected.length > 0 && sb && sb.isConnected()) {
          await sb.uploadScrapeResults(collected, `hashtag:${hashtag}`);
        }

        log('info', `Hashtag #${hashtag}: ${collected.length} usuários coletados`);
        return { ok: true, count: collected.length, source: `hashtag:${hashtag}` };
      } catch (e) {
        this._releaseApiSlot();
        log('error', `Coleta de hashtag #${hashtag} falhou:`, e);
        return { ok: false, error: e?.message || 'Erro na coleta' };
      }
    },

    // =============================================
    // COLETAR USUÁRIOS POR LOCALIZAÇÃO
    // =============================================
    async collectFromLocation(locationQuery) {
      const sb = window.LovableSupabase;
      log('info', `Coletando usuários da localização "${locationQuery}"...`);
      try {
        await this._waitForApiSlot(4000);
        // Buscar location_id via search
        const searchRes = await fetch(
          `https://www.instagram.com/api/v1/fbsearch/places/?query=${encodeURIComponent(locationQuery)}&count=5`,
          { headers: { 'x-ig-app-id': '936619743392459', 'x-requested-with': 'XMLHttpRequest' }, credentials: 'include' }
        );
        this._releaseApiSlot();

        if (!searchRes.ok) return { ok: false, error: `Localização "${locationQuery}" não encontrada (${searchRes.status})` };

        const searchData = await searchRes.json();
        const place = searchData?.items?.[0];
        if (!place) return { ok: false, error: `Nenhum local encontrado para "${locationQuery}"` };

        const locationId = place.location?.pk || place.place?.location?.pk;
        if (!locationId) return { ok: false, error: 'ID da localização não encontrado' };

        await this._waitForApiSlot(4000);
        const mediaRes = await fetch(
          `https://www.instagram.com/api/v1/locations/${locationId}/sections/?max_id=&tab=recent`,
          { method: 'POST', headers: { 'x-ig-app-id': '936619743392459', 'x-requested-with': 'XMLHttpRequest', 'content-type': 'application/x-www-form-urlencoded' }, body: 'tab=recent&max_id=', credentials: 'include' }
        );
        this._releaseApiSlot();

        if (!mediaRes.ok) return { ok: false, error: `Erro ao buscar posts da localização (${mediaRes.status})` };

        const mediaData = await mediaRes.json();
        const usernames = new Set();

        for (const section of (mediaData?.sections || [])) {
          for (const item of (section.layout_content?.medias || [])) {
            const user = item.media?.user;
            if (user?.username) usernames.add(user.username);
            if (usernames.size >= 150) break;
          }
          if (usernames.size >= 150) break;
        }

        const collected = Array.from(usernames);
        if (collected.length > 0 && sb && sb.isConnected()) {
          await sb.uploadScrapeResults(collected, `location:${locationQuery}`);
        }

        log('info', `Localização "${locationQuery}": ${collected.length} usuários coletados`);
        return { ok: true, count: collected.length, source: `location:${locationQuery}` };
      } catch (e) {
        this._releaseApiSlot();
        log('error', `Coleta de localização falhou:`, e);
        return { ok: false, error: e?.message || 'Erro na coleta' };
      }
    },

    // =============================================
    // POLLING DE COMANDOS
    // =============================================
    async pollCommands() {
      const sb = window.LovableSupabase;
      if (!sb || !sb.isConnected()) return;

      try {
        const commands = await sb.fetchPendingCommands();
        for (const cmd of commands) {
          log('info', `Executando comando: ${cmd.command || cmd.command_type}`);
          await this.executeCommand(cmd);
        }
      } catch (e) {
        log('warn', 'pollCommands falhou:', e?.message || e);
      }
    },

    // =============================================
    // AGENDAMENTO (SCHEDULER)
    // =============================================
    checkSchedule() {
      if (!state.schedule || !state.schedule.enabled) return;

      const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const now = state.schedule.timezone ? this._getNowInTimezone(state.schedule.timezone) : new Date();
      const dayKey = dayKeys[now.getDay()];
      const dayConfig = state.schedule.days?.[dayKey];

      // Reset diário dos contadores do scheduler
      const today = now.toISOString ? new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      if (state.scheduleDaily.date !== today) {
        state.scheduleDaily = { date: today, follows: 0, likes: 0, unfollows: 0 };
        chrome.storage.local.set({ lovable_schedule_daily: state.scheduleDaily });
        log('info', 'Scheduler: Contadores diários resetados para novo dia');
      }

      // Dia inativo
      if (!dayConfig || !dayConfig.active) {
        if (state.scheduleLastAction !== 'stop') this._scheduleStop('Dia inativo no agendamento');
        return;
      }

      // Verificar horário
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = this._parseTime(dayConfig.start);
      const stopMinutes = this._parseTime(dayConfig.stop);

      if (startMinutes === null || stopMinutes === null) return;

      // Fora do horário
      if (currentMinutes < startMinutes || currentMinutes >= stopMinutes) {
        if (state.scheduleLastAction !== 'stop') {
          this._scheduleStop('Fora do horário (' + dayConfig.start + '-' + dayConfig.stop + ')');
        }
        return;
      }

      // Dentro do horário — verificar metas
      const followTarget = dayConfig.follows || 0;
      const likeTarget = dayConfig.likes || 0;
      const followsDone = state.scheduleDaily.follows || 0;
      const likesDone = state.scheduleDaily.likes || 0;
      const unfollowsDone = state.scheduleDaily.unfollows || 0;

      // Verificar metas por tipo (considerar modo do dia)
      const mode = dayConfig.mode || 'seguir_curtir';
      const isUnfollowMode = (mode === 'deixar_seguir');
      const isFollowMode = (mode === 'seguir' || mode === 'seguir_curtir');
      const isLikeMode = (mode === 'curtir' || mode === 'seguir_curtir');

      // Metas atingidas?
      let allTargetsMet = false;
      const hasTargets = followTarget > 0 || likeTarget > 0;

      if (hasTargets) {
        if (isUnfollowMode) {
          // No modo unfollow, usar meta de follows como meta de unfollows
          allTargetsMet = followTarget > 0 ? unfollowsDone >= followTarget : true;
        } else {
          const followsMet = followTarget > 0 ? followsDone >= followTarget : true;
          const likesMet = likeTarget > 0 ? likesDone >= likeTarget : true;
          allTargetsMet = followsMet && likesMet;
        }
      }

      if (allTargetsMet && hasTargets) {
        if (state.scheduleLastAction !== 'stop') {
          const metaStr = isUnfollowMode
            ? `${unfollowsDone}/${followTarget} unfollows`
            : `${followsDone}/${followTarget} follows, ${likesDone}/${likeTarget} likes`;
          this._scheduleStop(`Metas atingidas (${metaStr})`);
        }
        return;
      }

      // Aplicar o modo do dia (se diferente do atual)
      if (dayConfig.mode && dayConfig.mode !== state.currentMode) {
        this.applyMode(dayConfig.mode);
        log('info', `Scheduler: Modo alterado para "${dayConfig.mode}" (configurado para ${dayKey})`);
      }

      // Iniciar se necessário
      if (state.scheduleLastAction !== 'start') {
        this._scheduleStart(`Horário agendado ${dayConfig.start}-${dayConfig.stop} | Meta: ${followTarget}F / ${likeTarget}L`);
      }
    },

    _scheduleStart(reason) {
      const btn = document.getElementById('btnProcessQueue');
      if (btn && !btn.classList.contains('pulsing')) {
        btn.click();
        state.scheduleLastAction = 'start';
        log('info', `Scheduler: Bot iniciado — ${reason}`);
      } else {
        state.scheduleLastAction = 'start';
      }
    },

    _scheduleStop(reason) {
      const btn = document.getElementById('btnStop') || document.getElementById('btnStop2');
      if (btn) {
        btn.click();
        state.scheduleLastAction = 'stop';
        log('info', `Scheduler: Bot parado — ${reason}`);
      } else {
        state.scheduleLastAction = 'stop';
      }
    },

    _getNowInTimezone(tz) {
      try {
        const str = new Date().toLocaleString('en-US', { timeZone: tz });
        return new Date(str);
      } catch (e) { return new Date(); }
    },

    _parseTime(timeStr) {
      if (!timeStr || typeof timeStr !== 'string') return null;
      const parts = timeStr.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1] || '0', 10);
      if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
      return h * 60 + m;
    },

    // =============================================
    // REPORT DE STATS PERIÓDICO
    // =============================================
    async reportStats() {
      const sb = window.LovableSupabase;
      if (!sb || !sb.isConnected()) return;

      await sb.reportSessionStats({
        ...state.counters,
        sessionStart: state.sessionStart
      });
      state.lastStatsReport = Date.now();
    },

    // =============================================
    // TAREFAS PERIÓDICAS
    // =============================================
    startPeriodicTasks() {
      const cfg = CFG();

      // Heartbeat (5 min)
      state.timers.heartbeat = setInterval(() => this.sendHeartbeat(), cfg.HEARTBEAT_INTERVAL);

      // Profile collection (15 min)
      state.timers.profile = setInterval(() => this.collectProfile(), cfg.PROFILE_COLLECT_INTERVAL);

      // Command polling (45 seg)
      state.timers.commands = setInterval(() => this.pollCommands(), cfg.COMMAND_POLL_INTERVAL);

      // Queue sync (1 min)
      state.timers.queue = setInterval(() => this.syncQueueFromSupabase(), cfg.QUEUE_SYNC_INTERVAL);

      // Settings sync (2 min)
      state.timers.settings = setInterval(() => this.syncSettingsFromSupabase(), cfg.SETTINGS_SYNC_INTERVAL);

      // Stats report (5 min)
      state.timers.stats = setInterval(() => this.reportStats(), cfg.STATS_REPORT_INTERVAL);

      // Scheduler check (30 seg)
      state.timers.scheduler = setInterval(() => this.checkSchedule(), cfg.SCHEDULER_CHECK_INTERVAL);

      // Live counters sync (30 seg) — sync leve de contadores para dashboard em tempo real
      state.timers.liveCounters = setInterval(() => this.syncLiveCounters(), cfg.LIVE_COUNTERS_INTERVAL || 30000);

      log('info', 'Tarefas periódicas iniciadas');
    },

    // =============================================
    // SYNC LEVE DE CONTADORES (cada 30s)
    // =============================================
    async syncLiveCounters() {
      const sb = window.LovableSupabase;
      if (!sb || !sb.isConnected() || !sb.igAccountId) return;

      const statusText = state.isProcessing ? 'processing' : 'online';
      await sb.syncLiveCounters(statusText, state.scheduleDaily);
    },

    // =============================================
    // APLICAR TIMINGS NATIVOS DO ORGANIC
    // Configura os campos DOM e gblOptions para proteção dupla
    // =============================================
    applyOrganicTimings(presetName) {
      const cfg = window.LovableConfig;
      if (!cfg || !cfg.SAFETY_PRESETS) {
        log('warn', 'SAFETY_PRESETS não encontrado na config');
        return false;
      }

      const preset = cfg.SAFETY_PRESETS[presetName];
      if (!preset || !preset.ORGANIC) {
        log('warn', `Preset "${presetName}" ou ORGANIC timings não encontrado`);
        return false;
      }

      const gb = preset.ORGANIC;
      const applied = [];

      try {
        // 1. Tempo entre ações (follow/unfollow/like) — campo mais importante
        const elDelay = document.getElementById('textSecondsBetweenActions');
        if (elDelay) {
          elDelay.value = gb.timeDelay / 1000; // Converter ms para segundos
          applied.push(`delay=${gb.timeDelay / 1000}s`);
        }

        // 2. Tempo após pular
        const elSkip = document.getElementById('textSecondsAfterSkip');
        if (elSkip) {
          elSkip.value = gb.timeDelayAfterSkip / 1000;
          applied.push(`skip=${gb.timeDelayAfterSkip / 1000}s`);
        }

        // 3. Randomização de tempo
        const elRandom = document.getElementById('cbRandomizeTimeDelay');
        if (elRandom) elRandom.checked = gb.useRandomTimeDelay;
        const elRandPct = document.getElementById('igBotPercentRandomTimeDelay');
        if (elRandPct) elRandPct.value = gb.percentRandomTimeDelay * 200; // Converter de fração para %

        // 4. Retry após soft rate limit
        const elSoftRate = document.getElementById('textMinutesAfterSoftRateLimit');
        if (elSoftRate) {
          elSoftRate.value = gb.timeDelayAfterSoftRateLimit / 60000;
          applied.push(`softRL=${gb.timeDelayAfterSoftRateLimit / 60000}min`);
        }

        // 5. Retry após hard rate limit
        const elHardRate = document.getElementById('textHoursAfterHardRateLimit');
        if (elHardRate) {
          elHardRate.value = gb.timeDelayAfterHardRateLimit / 3600000;
          applied.push(`hardRL=${gb.timeDelayAfterHardRateLimit / 3600000}h`);
        }

        // 6. Retry após 429
        const el429 = document.getElementById('textMinutesAfter429RateLimit');
        if (el429) {
          el429.value = gb.timeDelayAfter429RateLimit / 60000;
          applied.push(`429=${gb.timeDelayAfter429RateLimit / 60000}min`);
        }

        // 7. Delay após carregar info adicional
        const elAddInfo = document.getElementById('cbuseTimeDelayAfterAdditionalInfo');
        if (elAddInfo) elAddInfo.checked = gb.useTimeDelayAfterAdditionalInfo;
        const elAddInfoDelay = document.getElementById('texttimeDelayAfterAdditionalInfo');
        if (elAddInfoDelay) elAddInfoDelay.value = gb.timeDelayAfterAdditionalInfo / 1000;

        // 8. Retries após 404
        const el404 = document.getElementById('textRetryAfterAdditionalInfo404');
        if (el404) el404.value = gb.retriesAfterAdditionalInfo404;

        // 9. Limite de ações nativo (última camada de proteção)
        const elLimitCb = document.getElementById('cbLimitActions');
        if (elLimitCb) elLimitCb.checked = gb.maxPerEnabled;
        const elLimitActions = document.getElementById('textLimitActionsPer');
        if (elLimitActions) {
          elLimitActions.value = gb.maxPerActions;
          applied.push(`maxActions=${gb.maxPerActions}/24h`);
        }
        const elLimitTime = document.getElementById('textLimitActionsPerTime');
        if (elLimitTime) elLimitTime.value = gb.maxPerPeriod / 3600000;

        // 10. Atualizar gblOptions diretamente (variável global do Organic)
        if (typeof gblOptions !== 'undefined') {
          gblOptions.timeDelay = gb.timeDelay;
          gblOptions.timeDelayAfterSkip = gb.timeDelayAfterSkip;
          gblOptions.useRandomTimeDelay = gb.useRandomTimeDelay;
          gblOptions.percentRandomTimeDelay = gb.percentRandomTimeDelay;
          gblOptions.timeDelayAfterSoftRateLimit = gb.timeDelayAfterSoftRateLimit;
          gblOptions.timeDelayAfterHardRateLimit = gb.timeDelayAfterHardRateLimit;
          gblOptions.timeDelayAfter429RateLimit = gb.timeDelayAfter429RateLimit;
          gblOptions.useTimeDelayAfterAdditionalInfo = gb.useTimeDelayAfterAdditionalInfo;
          gblOptions.timeDelayAfterAdditionalInfo = gb.timeDelayAfterAdditionalInfo;
          gblOptions.retriesAfterAdditionalInfo404 = gb.retriesAfterAdditionalInfo404;
          gblOptions.maxPerEnabled = gb.maxPerEnabled;
          gblOptions.maxPerActions = gb.maxPerActions;
          gblOptions.maxPerPeriod = gb.maxPerPeriod;

          // NOTA: NÃO chamar saveOptions() pois ela relê TODOS os inputs do DOM
          // e pode corromper settings não-timing se o Organic não carregou tudo ainda.
          // Salvar apenas gblOptions direto no storage.
          try { chrome.storage.local.set({ gblOptions: gblOptions }); } catch (e) {}
          applied.push('storage');
        }

        log('info', `Organic timings aplicados (${presetName}): ${applied.join(', ')}`);
        return true;

      } catch (e) {
        log('warn', `Erro ao aplicar Organic timings: ${e?.message || e}`);
        return false;
      }
    },

    // =============================================
    // LISTENER DE MENSAGENS (Chrome Extension)
    // =============================================
    installMessageListener() {
      const self = this;

      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // Mensagens do popup ou background
        if (!request.type) return false;

        console.log('[Lovable] Mensagem recebida:', request.type);

        switch (request.type) {
          case 'GET_LOVABLE_STATUS': {
            const sb = window.LovableSupabase;
            const safety = window.LovableSafety;
            sendResponse({
              connected: sb ? sb.isConnected() : false,
              organicDetected: !!document.getElementById('igBotInjectedContainer'),
              isProcessing: state.isProcessing,
              currentMode: state.currentMode,
              igUsername: state.igUsername,
              lastProfile: state.igProfile,
              counters: state.counters,
              actionsPerHour: safety ? safety.hourlyActions.length : 0,
              retryQueueSize: sb ? sb.retryQueue.length : 0,
              writeCount: sb ? sb.writeCount : 0,
              writeErrors: sb ? sb.writeErrors : 0,
              lastSyncTime: new Date().toISOString(),
              safety: safety ? safety.getStats() : null,
              version: window.LovableConfig ? window.LovableConfig.VERSION : 'unknown',
              scheduleEnabled: state.schedule?.enabled || false,
              scheduleDaily: state.scheduleDaily,
              scheduleTodayConfig: (() => {
                if (!state.schedule?.days) return null;
                const dk = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
                return state.schedule.days[dk] || null;
              })(),
              // Timings nativos do Organic (para exibir no popup)
              organicTimings: (() => {
                try {
                  if (typeof gblOptions === 'undefined') return null;
                  return {
                    delaySeconds: gblOptions.timeDelay / 1000,
                    skipSeconds: gblOptions.timeDelayAfterSkip / 1000,
                    randomEnabled: gblOptions.useRandomTimeDelay,
                    softRateLimitMin: gblOptions.timeDelayAfterSoftRateLimit / 60000,
                    hardRateLimitHours: gblOptions.timeDelayAfterHardRateLimit / 3600000,
                    limit429Min: gblOptions.timeDelayAfter429RateLimit / 60000,
                    maxPerEnabled: gblOptions.maxPerEnabled,
                    maxPerActions: gblOptions.maxPerActions,
                  };
                } catch (e) { return null; }
              })(),
              // Backoff info
              apiBackoff: sb ? sb.isInBackoff() : false,
            });
            return true;
          }

          case 'BOT_START':
          case 'BOT_STOP':
          case 'BOT_SET_MODE':
          case 'BOT_SET_COMMENT_CONFIG':
          case 'BOT_SCRAPE':
          case 'BOT_LOAD_QUEUE':
          case 'FORCE_QUEUE_SYNC':
          case 'FORCE_PROFILE_UPDATE':
          case 'inject_queue':
          case 'collect_followers':
          case 'collect_following':
          case 'collect_hashtag':
          case 'collect_location':
          case 'collect_via_api': {
            self.executeCommand({ ...request, type: request.type }).then(result => {
              sendResponse(result);
            }).catch(err => {
              sendResponse({ ok: false, error: err?.message || 'Erro interno' });
            });
            return true; // Manter canal aberto para resposta assíncrona
          }

          case 'BOT_SET_LIKES': {
            try {
              const count = parseInt(request.count) || 1;
              // Input real do Organic: numberFollowLikeLatestPics
              const input = document.getElementById('numberFollowLikeLatestPics');
              if (input) {
                input.value = count;
                input.dispatchEvent(new Event('input'));
              }
              // Persistir likes_per_follow no Supabase
              const sbLikes = window.LovableSupabase;
              if (sbLikes && sbLikes.isConnected() && sbLikes.igAccountId) {
                const safeEqLikes = (v) => encodeURIComponent(String(v ?? '').trim());
                sbLikes.patchWithRetry('ig_accounts', `id=eq.${safeEqLikes(sbLikes.igAccountId)}`, {
                  likes_per_follow: count,
                  updated_at: new Date().toISOString()
                });
              }
              sendResponse({ ok: true });
            } catch (e) {
              sendResponse({ ok: false, error: e?.message });
            }
            return true;
          }

          case 'SCHEDULE_UPDATE': {
            state.schedule = request.schedule;
            chrome.storage.local.set({ lovable_schedule: state.schedule });
            const sb = window.LovableSupabase;
            if (sb && sb.isConnected()) {
              sb.saveScheduleToDb(state.schedule);
            }
            sendResponse({ ok: true });
            return true;
          }

          case 'UPDATE_SAFETY_LIMITS': {
            const safety = window.LovableSafety;
            if (safety && safety.updateLimits) {
              safety.updateLimits(request);
              // maxPerActions: usar MAX_PER_SESSION (pode ser 9999 = ilimitado) ou MAX_PER_DAY como fallback
              try {
                if (typeof gblOptions !== 'undefined') {
                  const sessionVal = request.MAX_PER_SESSION || request.MAX_PER_DAY;
                  gblOptions.maxPerActions = sessionVal > 0 ? sessionVal : request.MAX_PER_DAY || 9999;
                  gblOptions.maxPerEnabled = true;
                  const elLimitActions = document.getElementById('textLimitActionsPer');
                  const elLimitCb = document.getElementById('cbLimitActions');
                  if (elLimitActions) elLimitActions.value = gblOptions.maxPerActions;
                  if (elLimitCb) elLimitCb.checked = true;
                  try { chrome.storage.local.set({ gblOptions: gblOptions }); } catch (e) {}
                }
              } catch (e) { /* silencioso */ }
              // Sincronizar limites customizados com o dashboard
              const sbLimits = window.LovableSupabase;
              if (sbLimits && sbLimits.isConnected()) {
                sbLimits.syncSafetyConfig(null, {
                  MAX_PER_HOUR: request.MAX_PER_HOUR,
                  MAX_PER_DAY: request.MAX_PER_DAY,
                  MAX_PER_SESSION: request.MAX_PER_SESSION
                }, null);
              }
              sendResponse({ ok: true });
            } else {
              sendResponse({ ok: false, error: 'SafetyGuard não disponível' });
            }
            return true;
          }

          case 'APPLY_SAFETY_PRESET': {
            const safety = window.LovableSafety;
            if (!safety || !safety.applyPreset) {
              sendResponse({ ok: false, error: 'SafetyGuard não disponível' });
              return true;
            }
            const SESSION_UNLIMITED = 9999;
            chrome.storage.local.get(['lovable_auto_renew_session'], (data) => {
              const autoRenew = data.lovable_auto_renew_session !== false;
              const ok = safety.applyPreset(request.preset, true);
              if (autoRenew && safety._customLimits && safety.updateLimits) {
                safety.updateLimits({
                  MAX_PER_HOUR: safety._customLimits.MAX_PER_HOUR,
                  MAX_PER_DAY: safety._customLimits.MAX_PER_DAY,
                  MAX_PER_SESSION: SESSION_UNLIMITED
                });
              }
              const gbOk = self.applyOrganicTimings(request.preset);
              if (typeof gblOptions !== 'undefined') {
                gblOptions.maxPerActions = autoRenew ? SESSION_UNLIMITED : (safety._customLimits?.MAX_PER_SESSION || 60);
                gblOptions.maxPerEnabled = true;
                try { chrome.storage.local.set({ gblOptions: gblOptions }); } catch (e) {}
              }
              const sbSync = window.LovableSupabase;
              if (sbSync && sbSync.isConnected()) {
                const cfgPresets = window.LovableConfig?.SAFETY_PRESETS;
                const presetData = cfgPresets ? cfgPresets[request.preset] : null;
                const limits = presetData ? {
                  MAX_PER_HOUR: presetData.MAX_PER_HOUR,
                  MAX_PER_DAY: presetData.MAX_PER_DAY,
                  MAX_PER_SESSION: autoRenew ? SESSION_UNLIMITED : presetData.MAX_PER_SESSION
                } : null;
                const gbTimings = presetData?.ORGANIC || null;
                sbSync.syncSafetyConfig(request.preset, limits, gbTimings);
              }
              sendResponse({ ok, organicTimings: gbOk });
            });
            return true;
          }


          case 'SET_SAFETY_PROFILE': {
            const safety = window.LovableSafety;
            if (safety && safety.setProfile) {
              safety.setProfile(request.profile);
              sendResponse({ ok: true });
            } else {
              sendResponse({ ok: false, error: 'SafetyGuard v2 não disponível' });
            }
            return true;
          }

          case 'SET_SAFETY_MODE': {
            const safety = window.LovableSafety;
            if (safety && safety.setMode) {
              safety.setMode(request.mode);
              sendResponse({ ok: true });
            } else {
              sendResponse({ ok: false, error: 'SafetyGuard v2 não disponível' });
            }
            return true;
          }

          case 'SET_SAFETY_WINDOW': {
            const safety = window.LovableSafety;
            if (safety && safety.setActiveWindow) {
              safety.setActiveWindow(request.start, request.end);
              sendResponse({ ok: true });
            } else {
              sendResponse({ ok: false, error: 'SafetyGuard v2 não disponível' });
            }
            return true;
          }

          case 'GET_SAFETY_STATS': {
            const safety = window.LovableSafety;
            sendResponse({ ok: true, stats: safety ? safety.getStats() : null });
            return true;
          }

          case 'TOKEN_UPDATED': {
            const sb = window.LovableSupabase;
            if (sb) sb.init();
            sendResponse({ ok: true });
            return true;
          }

          case 'LOGOUT': {
            const sb = window.LovableSupabase;
            if (sb) sb.disconnect();
            sendResponse({ ok: true });
            return true;
          }

          case 'RESET_COUNTERS': {
            state.counters = { follows: 0, unfollows: 0, likes: 0, comments: 0, blocks: 0, skips: 0, errors: 0 };
            state.sessionStart = new Date().toISOString();
            self.saveCounters();
            const safety = window.LovableSafety;
            if (safety) safety.resetSession();
            sendResponse({ ok: true });
            return true;
          }

          case 'LOVABLE_POLL_COMMANDS': {
            self.pollCommands();
            sendResponse({ ok: true });
            return true;
          }

          case 'LOVABLE_HEARTBEAT': {
            self.sendHeartbeat();
            sendResponse({ ok: true });
            return true;
          }

          case 'BOT_DEBUG': {
            // Scan DOM elements for debugging
            const elements = [];
            try {
              const buttons = document.querySelectorAll('#igBotInjectedContainer button, #igBotInjectedContainer input[type="radio"]');
              buttons.forEach(el => {
                elements.push({
                  tag: el.tagName.toLowerCase(),
                  id: el.id || '',
                  text: el.textContent?.trim().substring(0, 50) || '',
                  classes: el.className || '',
                  type: el.type || ''
                });
              });
            } catch (e) { /* ignorar */ }
            sendResponse({ ok: true, elements });
            return true;
          }
        }

        return false;
      });

      log('info', 'Message listener instalado');
    },

    // =============================================
    // GETTERS (acesso ao estado)
    // =============================================
    getState() {
      return { ...state };
    },

    getCounters() {
      return { ...state.counters };
    },

    // Tracking para evitar logging duplicado entre onAction e parseLogLine
    _recentActions: [],
    _markActionHandled(type) {
      this._recentActions.push({ type, time: Date.now() });
      // Manter só os últimos 5 segundos
      const cutoff = Date.now() - 5000;
      this._recentActions = this._recentActions.filter(a => a.time > cutoff);
    },
    _wasRecentlyHandled(type) {
      const cutoff = Date.now() - 3000;
      return this._recentActions.some(a => a.type === type && a.time > cutoff);
    },

    // API pública para hooks diretos (chamada de contentscript.js modificado)
    onAction(type, acct, success, errorStatus) {
      const sb = window.LovableSupabase;
      const safety = window.LovableSafety;
      const username = typeof acct === 'string' ? acct : acct?.username;

      // Marcar como já tratado para evitar duplicação com parseLogLine
      this._markActionHandled(type);

      if (success) {
        if (safety) safety.recordAction({ success: true, type });
        if (sb && sb.isConnected()) {
          sb.logAction({ type, target: username, success: true });
        }
        // Marcar target como "done" no Supabase (sincronizar com dashboard)
        if (username && (type === 'follow' || type === 'unfollow' || type === 'like')) {
          this.markTargetProcessed(username, 'done');
        }
      } else {
        const subtype = (errorStatus === 429) ? 'rate_limit' : (errorStatus === 403) ? 'soft_rate_limit' : (errorStatus === 400 ? 'action_blocked' : 'error');
        if (safety) safety.recordAction({ success: false, type, details: { subtype } });
        if (sb && sb.isConnected()) {
          sb.logAction({ type, target: username, success: false, details: { subtype, status: errorStatus } });
        }
      }
    }
  };

  // =============================================
  // AUTO-INICIALIZAÇÃO
  // =============================================

  // PASSO 1: Instalar o message listener IMEDIATAMENTE
  // (permite o popup comunicar com o content script mesmo antes do init completo)
  if (window.location.hostname.includes('instagram.com')) {
    console.log('%c[Lovable] Content script carregado — instalando listener de mensagens', 'color: #A855F7; font-weight: bold');
    window.LovableSync.installMessageListener();
  }

  // PASSO 2: Aguardar Organic carregar, depois inicializar o resto
  function waitAndInit() {
    if (!window.location.hostname.includes('instagram.com')) return;

    const MAX_ATTEMPTS = 90; // 3 minutos máximo
    let attempts = 0;

    function isOrganicReady() {
      return !!document.getElementById('igBotInjectedContainer');
    }

    function tryInit() {
      attempts++;
      if (isOrganicReady()) {
        console.log('%c[Lovable] Organic detectado após ' + attempts + ' tentativa(s). Inicializando...', 'color: #00B894; font-weight: bold');
        window.LovableSync.init();
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        console.warn('[Lovable] Organic não detectado após ' + MAX_ATTEMPTS + ' tentativas. Inicializando com funcionalidade limitada...');
        window.LovableSync.init();
        return;
      }
      // Log a cada 10 tentativas (20 segundos)
      if (attempts % 10 === 0) {
        console.log('[Lovable] Aguardando Organic... tentativa ' + attempts + '/' + MAX_ATTEMPTS +
          ' | container=' + !!document.getElementById('igBotInjectedContainer') +
          ' | gblOptions=' + (typeof gblOptions !== 'undefined'));
      }
      setTimeout(tryInit, 2000);
    }

    // Iniciar verificação após breve delay
    setTimeout(tryInit, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndInit);
  } else {
    waitAndInit();
  }
})();
