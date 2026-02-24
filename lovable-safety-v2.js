// lovable-safety-v2.js — Sistema de Proteção Inteligente v2
//
// MODELO: "Orçamento de Risco Dinâmico"
// - Orçamento diário ponderado por tipo de ação
// - Modos operacionais: silent / balanced / active
// - Termômetro de risco (0-100) visível na UI
// - Cooldowns proporcionais por incidente (escala ao longo do dia)
// - Janela de horário ativo configurável pelo usuário
// - Compatível com canProceed() / recordAction() / getStats()
//
(function () {
  'use strict';

  const log = (level, ...args) =>
    window.LovableLogger
      ? window.LovableLogger[level]('Safety', ...args)
      : console[level === 'info' ? 'log' : level]('[Safety]', ...args);

  const ACTION_WEIGHTS = {
    follow: 1.5, unfollow: 1.2, like: 0.6,
    comment: 2.0, story: 0.4, default: 1.0,
  };

  const OPERATION_MODES = {
    silent:   { label: '🐢 Silencioso',  budgetMultiplier: 0.5, riskThreshold: 25, cooldownMultiplier: 2.0, delayMultiplier: 2.5 },
    balanced: { label: '⚖️ Equilibrado', budgetMultiplier: 1.0, riskThreshold: 55, cooldownMultiplier: 1.0, delayMultiplier: 1.0 },
    active:   { label: '🚀 Ativo',       budgetMultiplier: 1.6, riskThreshold: 75, cooldownMultiplier: 0.7, delayMultiplier: 0.7 },
  };

  const PROFILE_BUDGETS = {
    nova:   { dailyBudget: 35,  minDelaySec: 55, maxDelaySec: 140 },
    media:  { dailyBudget: 80,  minDelaySec: 35, maxDelaySec: 90  },
    madura: { dailyBudget: 150, minDelaySec: 22, maxDelaySec: 60  },
  };

  // Cooldown proporcional: escala por número de ocorrências no dia [1ª,2ª,3ª,4ª+] em minutos
  const COOLDOWN_MATRIX = {
    rate_limit: [20, 45, 90, 180],
    soft_limit: [10, 25, 50,  90],
    block:      [45,120,240, 480],
    error:      [ 5, 15, 30,  60],
  };

  window.LovableSafety = {
    _profile: 'media',
    _mode: 'balanced',
    _activeWindow: { start: 8, end: 23 },
    _dailyBudgetUsed: 0,
    _dailyBudgetMax: 80,
    _dailyResetDate: null,
    _incidents: { rate_limit:0, soft_limit:0, block:0, error:0 },
    _incidentsDate: null,
    _riskScore: 0,
    _riskDate: null,
    cooldownUntil: 0,
    isPaused: false,
    pauseReason: null,
    _cooldownResumeTimer: null,
    sessionActionCount: 0,
    hourlyActions: [],

    // Compatibilidade com código antigo que usa estes campos
    consecutiveErrors: 0,
    consecutiveBlocks: 0,
    rateLimitHits: 0,
    dailyActionCount: 0,
    warmupDay: 0,

    async init() {
      const today = new Date().toISOString().slice(0, 10);
      const stored = await chrome.storage.local.get([
        'sv2_profile','sv2_mode','sv2_window',
        'sv2_budget_used','sv2_budget_date',
        'sv2_incidents','sv2_incidents_date',
        'sv2_risk','sv2_risk_date',
        'sv2_cooldown_until',
        'sv2_session_count','sv2_hourly_actions',
      ]);

      this._profile = stored.sv2_profile || 'media';
      this._mode    = stored.sv2_mode    || 'balanced';
      if (stored.sv2_window) this._activeWindow = stored.sv2_window;

      this._dailyBudgetUsed = stored.sv2_budget_date === today ? (stored.sv2_budget_used || 0) : 0;
      this._dailyResetDate  = today;
      this._dailyBudgetMax  = this._calcMaxBudget();

      this._incidents = stored.sv2_incidents_date === today
        ? (stored.sv2_incidents || { rate_limit:0, soft_limit:0, block:0, error:0 })
        : { rate_limit:0, soft_limit:0, block:0, error:0 };
      this._incidentsDate = today;

      this._riskScore = stored.sv2_risk_date === today ? (stored.sv2_risk || 0) : 0;
      this._riskDate  = today;

      this.cooldownUntil      = stored.sv2_cooldown_until || 0;
      this.sessionActionCount = stored.sv2_session_count  || 0;
      this.hourlyActions      = (stored.sv2_hourly_actions || []).filter(t => t > Date.now() - 3600000);
      this.dailyActionCount   = Math.round(this._dailyBudgetUsed);

      if (this.cooldownUntil > Date.now()) {
        this.isPaused    = true;
        this.pauseReason = 'cooldown';
        this._scheduleCooldownResume(this.cooldownUntil - Date.now());
        log('warn', `Cooldown ativo: ${Math.round((this.cooldownUntil - Date.now())/60000)} min`);
      }

      log('info', `Safety v2 — perfil:${this._profile} modo:${this._mode} orçamento:${Math.round(this._dailyBudgetUsed)}/${this._dailyBudgetMax} risco:${Math.round(this._riskScore)}/100`);
      return true;
    },

    canProceed(actionType = 'default') {
      this._checkDayReset();

      if (this.cooldownUntil > Date.now()) {
        const rem = Math.round((this.cooldownUntil - Date.now()) / 60000);
        return { allowed:false, reason:`Em pausa (${rem} min restantes)`, code:'cooldown', unblockAt:this.cooldownUntil };
      }

      const hour = new Date().getHours();
      if (!this._isInActiveWindow(hour)) {
        return {
          allowed: false,
          reason: `Fora do horário ativo (${this._activeWindow.start}h–${this._activeWindow.end}h)`,
          code: 'window',
          unblockAt: this._nextWindowStart(hour),
        };
      }

      const mode = OPERATION_MODES[this._mode] || OPERATION_MODES.balanced;
      if (this._riskScore >= mode.riskThreshold) {
        return { allowed:false, reason:`Risco elevado (${Math.round(this._riskScore)}/100) — aguardando reduzir`, code:'risk' };
      }

      const weight = ACTION_WEIGHTS[actionType] || ACTION_WEIGHTS.default;
      if (this._dailyBudgetUsed + weight > this._dailyBudgetMax) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(this._activeWindow.start, 0, 0, 0);
        return {
          allowed: false,
          reason: `Orçamento do dia esgotado (${Math.round(this._dailyBudgetUsed)}/${this._dailyBudgetMax})`,
          code: 'budget',
          unblockAt: tomorrow.getTime(),
        };
      }

      this._pruneHourly();
      const maxPerHour = Math.ceil(this._dailyBudgetMax * 0.4);
      if (this.hourlyActions.length >= maxPerHour) {
        const oldest = Math.min.apply(null, this.hourlyActions);
        return {
          allowed: false,
          reason: `Ritmo horário atingido (${this.hourlyActions.length}/${maxPerHour})`,
          code: 'hourly',
          unblockAt: oldest + 3600000,
        };
      }

      return { allowed:true, riskScore:this._riskScore, budgetLeft:Math.round(this._dailyBudgetMax - this._dailyBudgetUsed) };
    },

    recordAction(result) {
      if (!result) return;
      const { success, type = 'default', details = {} } = result;
      const weight = ACTION_WEIGHTS[type] || ACTION_WEIGHTS.default;

      if (success) {
        this._dailyBudgetUsed += weight;
        this.dailyActionCount  = Math.round(this._dailyBudgetUsed);
        this.sessionActionCount++;
        this.hourlyActions.push(Date.now());
        this._riskScore = Math.max(0, this._riskScore - 0.8);
        this.consecutiveErrors = 0;
        this.consecutiveBlocks = 0;
        this.rateLimitHits = 0;
        this.save();
        return;
      }

      const subtype = details.subtype || '';
      let incType = 'error';

      if (subtype === 'rate_limit' || subtype === 'hard_rate_limit') {
        incType = 'rate_limit'; this._addRisk(30, 'rate limit'); this.rateLimitHits++;
      } else if (subtype === 'soft_rate_limit') {
        incType = 'soft_limit'; this._addRisk(15, 'soft limit'); this.consecutiveErrors++;
      } else if (subtype === 'action_blocked' || type === 'block') {
        incType = 'block'; this._addRisk(45, 'block'); this.consecutiveBlocks++;
      } else {
        this._addRisk(8, 'error'); this.consecutiveErrors++;
      }

      this._incidents[incType]++;
      const count = this._incidents[incType];
      const coolMin = this._getCooldownMinutes(incType, count);
      if (coolMin > 0) this.triggerCooldown(coolMin, `${incType} #${count}`);
      this.save();
    },

    triggerCooldown(minutes, reason) {
      this.cooldownUntil = Date.now() + minutes * 60000;
      this.isPaused = true;
      this.pauseReason = reason;
      this.saveNow();
      log('warn', `COOLDOWN ${minutes}min — ${reason}`);
      try { const b = document.getElementById('btnStop') || document.getElementById('btnStop2'); if(b) b.click(); } catch(e){}
      try {
        const sb = window.LovableSupabase;
        if (sb && sb.isConnected()) {
          sb.updateBotStatus(true, 'rate_limited');
          sb.logAction({ type:'error', target:null, success:false,
            details:{ subtype:'safety_cooldown', reason, cooldown_minutes:minutes }});
        }
      } catch(e){}
      this._scheduleCooldownResume(minutes * 60000);
    },

    _scheduleCooldownResume(delayMs) {
      if (this._cooldownResumeTimer) clearTimeout(this._cooldownResumeTimer);
      this._cooldownResumeTimer = setTimeout(() => {
        this._cooldownResumeTimer = null;
        this.isPaused = false; this.pauseReason = null; this.cooldownUntil = 0;
        this.consecutiveErrors = 0; this.consecutiveBlocks = 0; this.rateLimitHits = 0;
        this.save();
        log('info', `Cooldown encerrado — risco: ${Math.round(this._riskScore)}/100`);
        try { const sb = window.LovableSupabase; if(sb && sb.isConnected()) sb.updateBotStatus(true,'online'); } catch(e){}
      }, delayMs);
    },

    setProfile(profile) {
      if (!PROFILE_BUDGETS[profile]) return false;
      this._profile = profile;
      this._dailyBudgetMax = this._calcMaxBudget();
      try { chrome.storage.local.set({ sv2_profile: profile }); } catch(e){}
      log('info', `Perfil: ${profile} — orçamento: ${this._dailyBudgetMax}`);
      return true;
    },

    setMode(mode) {
      if (!OPERATION_MODES[mode]) return false;
      this._mode = mode;
      this._dailyBudgetMax = this._calcMaxBudget();
      try { chrome.storage.local.set({ sv2_mode: mode }); } catch(e){}
      log('info', `Modo: ${mode} — orçamento: ${this._dailyBudgetMax}`);
      return true;
    },

    setActiveWindow(start, end) {
      if (start < 0 || end > 24 || start >= end) return false;
      this._activeWindow = { start, end };
      try { chrome.storage.local.set({ sv2_window: this._activeWindow }); } catch(e){}
      log('info', `Janela ativa: ${start}h–${end}h`);
      return true;
    },

    // Compatibilidade com código antigo que chama applyPreset / updateLimits
    applyPreset(presetName, persist) {
      return this.setProfile(presetName);
    },
    updateLimits(newLimits) {
      // Não mais necessário no v2 — mantido para compatibilidade
      log('info', 'updateLimits chamado (no-op no v2)');
    },
    getActivePreset() { return this._profile; },

    getRecommendedDelay() {
      const profile = PROFILE_BUDGETS[this._profile] || PROFILE_BUDGETS.media;
      const mode    = OPERATION_MODES[this._mode]    || OPERATION_MODES.balanced;
      let minMs = profile.minDelaySec * 1000;
      let maxMs = profile.maxDelaySec * 1000;
      const riskFactor   = 1 + (this._riskScore / 100) * 2.0;
      const budgetUsage  = this._dailyBudgetMax > 0 ? this._dailyBudgetUsed / this._dailyBudgetMax : 0;
      const budgetFactor = budgetUsage > 0.7 ? 1 + (budgetUsage - 0.7) * 3 : 1;
      const total = Math.max(riskFactor, budgetFactor) * mode.delayMultiplier;
      minMs = Math.round(minMs * total);
      maxMs = Math.min(Math.round(maxMs * total), 300000);
      minMs = Math.min(minMs, maxMs);
      return minMs + Math.floor(Math.random() * (maxMs - minMs));
    },

    getStats() {
      this._pruneHourly();
      const mode       = OPERATION_MODES[this._mode] || OPERATION_MODES.balanced;
      const maxPerHour = Math.ceil(this._dailyBudgetMax * 0.4);
      const hour       = new Date().getHours();
      const inWindow   = this._isInActiveWindow(hour);
      const budgetPct  = this._dailyBudgetMax > 0
        ? Math.min(100, Math.round(this._dailyBudgetUsed / this._dailyBudgetMax * 100)) : 0;

      // Calcular cooldownUnblockAt para compatibilidade com popup antigo
      const now = Date.now();
      const hourlyOldest = this.hourlyActions.length > 0 ? Math.min.apply(null, this.hourlyActions) : 0;
      const atHourlyLimit = this.hourlyActions.length >= maxPerHour;
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(0,0,0,0);

      return {
        // v2 campos
        budgetUsed:    Math.round(this._dailyBudgetUsed * 10) / 10,
        budgetMax:     this._dailyBudgetMax,
        budgetPct,
        riskScore:     Math.round(this._riskScore),
        riskThreshold: mode.riskThreshold,
        riskLabel:     this._getRiskLabel(),
        riskColor:     this._getRiskColor(),
        inActiveWindow: inWindow,
        activeWindow:   this._activeWindow,
        hourlyActions:  this.hourlyActions.length,
        hourlyLimit:    maxPerHour,
        sessionActions: this.sessionActionCount,
        incidents:      { ...this._incidents },
        isPaused:       this.isPaused,
        pauseReason:    this.pauseReason,
        cooldownRemaining:  this.cooldownUntil > now ? Math.round((this.cooldownUntil - now) / 60000) : 0,
        cooldownUnblockAt:  this.cooldownUntil > now ? this.cooldownUntil : 0,
        hourlyUnblockAt:    atHourlyLimit && hourlyOldest ? hourlyOldest + 3600000 : 0,
        dailyUnblockAt:     budgetPct >= 100 ? tomorrow.getTime() : 0,
        profile:        this._profile,
        mode:           this._mode,
        modeLabel:      mode.label,
        recommendedDelaySec: Math.round(this.getRecommendedDelay() / 1000),
        // Campos de compatibilidade v1
        activePreset:       this._profile,
        dailyActions:       Math.round(this._dailyBudgetUsed),
        dailyLimit:         this._dailyBudgetMax,
        consecutiveErrors:  this.consecutiveErrors,
        consecutiveBlocks:  this.consecutiveBlocks,
        rateLimitHits:      this.rateLimitHits,
        warmupDay:          0,
        isOffHours:         !inWindow,
        minDelay:           Math.round((PROFILE_BUDGETS[this._profile]||PROFILE_BUDGETS.media).minDelaySec),
        maxDelay:           Math.round((PROFILE_BUDGETS[this._profile]||PROFILE_BUDGETS.media).maxDelaySec),
        dailyHeat:          Math.round(this._riskScore),
        cooldownEscalation: this._incidents.rate_limit + this._incidents.block,
      };
    },

    resetSession() {
      this.sessionActionCount = 0;
      this.hourlyActions = [];
      this.consecutiveErrors = 0;
      this.consecutiveBlocks = 0;
      this.rateLimitHits = 0;
      this.save();
    },

    _calcMaxBudget() {
      const p = PROFILE_BUDGETS[this._profile] || PROFILE_BUDGETS.media;
      const m = OPERATION_MODES[this._mode]    || OPERATION_MODES.balanced;
      return Math.round(p.dailyBudget * m.budgetMultiplier);
    },
    _addRisk(amount, src) {
      this._riskScore = Math.min(100, this._riskScore + amount);
      log('warn', `Risco +${amount} (${src}) → ${Math.round(this._riskScore)}/100`);
    },
    _getCooldownMinutes(type, count) {
      const matrix = COOLDOWN_MATRIX[type] || COOLDOWN_MATRIX.error;
      const idx    = Math.min(count - 1, matrix.length - 1);
      const mode   = OPERATION_MODES[this._mode] || OPERATION_MODES.balanced;
      return Math.round(matrix[idx] * mode.cooldownMultiplier);
    },
    _isInActiveWindow(hour) { return hour >= this._activeWindow.start && hour < this._activeWindow.end; },
    _nextWindowStart(hour) {
      const d = new Date();
      if (hour < this._activeWindow.start) { d.setHours(this._activeWindow.start,0,0,0); }
      else { d.setDate(d.getDate()+1); d.setHours(this._activeWindow.start,0,0,0); }
      return d.getTime();
    },
    _pruneHourly() { this.hourlyActions = this.hourlyActions.filter(t => t > Date.now()-3600000); },
    _checkDayReset() {
      const today = new Date().toISOString().slice(0,10);
      if (this._dailyResetDate !== today) {
        this._dailyBudgetUsed = 0; this._dailyResetDate = today;
        this._riskScore = 0;       this._riskDate = today;
        this._incidents = { rate_limit:0, soft_limit:0, block:0, error:0 };
        this._incidentsDate = today;
        this.dailyActionCount = 0;
        this.save();
      }
    },
    _getRiskLabel() {
      const r = this._riskScore;
      if (r < 20) return 'Seguro';
      if (r < 45) return 'Moderado';
      if (r < 70) return 'Elevado';
      return 'Crítico';
    },
    _getRiskColor() {
      const r = this._riskScore;
      if (r < 20) return '#00B894';
      if (r < 45) return '#FDCB6E';
      if (r < 70) return '#E17055';
      return '#D63031';
    },

    _saveTimer: null,
    save() {
      if (this._saveTimer) return;
      this._saveTimer = setTimeout(async () => {
        this._saveTimer = null;
        try { await chrome.storage.local.set(this._getPayload()); } catch(e){}
      }, 2000);
    },
    async saveNow() {
      if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
      try { await chrome.storage.local.set(this._getPayload()); } catch(e){}
    },
    _getPayload() {
      return {
        sv2_profile: this._profile, sv2_mode: this._mode, sv2_window: this._activeWindow,
        sv2_budget_used: this._dailyBudgetUsed, sv2_budget_date: this._dailyResetDate,
        sv2_incidents: this._incidents, sv2_incidents_date: this._incidentsDate,
        sv2_risk: this._riskScore, sv2_risk_date: this._riskDate,
        sv2_cooldown_until: this.cooldownUntil,
        sv2_session_count: this.sessionActionCount,
        sv2_hourly_actions: this.hourlyActions.slice(-200),
      };
    },
  };

  log('info', 'LovableSafety v2 carregado');
})();
