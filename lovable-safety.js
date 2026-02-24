// lovable-safety.js — Proteção contra rate limit e ban do Instagram
//
// Fluxo de prevenção:
// 1. canProceed() — Antes de cada ação (follow/unfollow/like), o Organic chama canProceed().
//    Se retornar allowed: false (cooldown, limite por hora/dia, calor alto, erros/blocks), a ação é adiada.
// 2. recordAction() — Após cada tentativa, o conteúdo chama recordAction({ success, type, details }).
//    Em 429/403/400 o LovableSync.onAction passa subtype 'rate_limit'/'soft_rate_limit'/'action_blocked'.
// 3. Calor diário (_dailyHeat) — Aumenta com rate limits, blocks e erros; reduz lentamente com ações bem-sucedidas.
// 4. Cooldown escalado — Após N rate limits/blocks/erros consecutivos, triggerCooldown(minutos) pausa o bot.
// 5. Limites por hora/dia/sessão — Ajustados por preset (nova/média/madura) e por calor (mais calor = limites menores).
// 6. Horário noturno (00:00–07:00) — Limite por hora reduzido a 50%.
//
(function () {
  'use strict';

  const log = (level, ...args) => window.LovableLogger ? window.LovableLogger[level]('Safety', ...args) : console[level === 'info' ? 'log' : level]('[Lovable:Safety]', ...args);
  const CFG = () => window.LovableConfig;

  window.LovableSafety = {

    // Estado
    consecutiveErrors: 0,
    consecutiveBlocks: 0,
    rateLimitHits: 0,
    cooldownUntil: 0,
    sessionActionCount: 0,
    hourlyActions: [],
    dailyActionCount: 0,
    dailyResetDate: null,
    isPaused: false,
    pauseReason: null,
    warmupDay: 0,

    // === NOVO: Sistema de Calor Diário ===
    // Rastreia a "temperatura" da conta ao longo do dia
    // Quanto mais rate limits/blocks, mais conservador o sistema fica
    _dailyHeat: 0,         // 0-100: nível de risco acumulado no dia
    _dailyHeatDate: null,  // Data do calor atual
    _cooldownEscalation: 0, // Multiplicador de cooldown (0 = normal, cada rate limit soma 1)
    _lastRateLimitTime: 0,  // Timestamp do último rate limit

    async init() {
      // Carregar limites customizados antes de tudo
      await this.loadCustomLimits();

      const stored = await chrome.storage.local.get([
        'safety_daily_count', 'safety_daily_date', 'safety_session_count',
        'safety_warmup_day', 'safety_cooldown_until',
        'safety_daily_heat', 'safety_daily_heat_date',
        'safety_cooldown_escalation', 'safety_last_rate_limit_time'
      ]);

      const today = new Date().toISOString().slice(0, 10);
      if (stored.safety_daily_date === today) {
        this.dailyActionCount = stored.safety_daily_count || 0;
      } else {
        this.dailyActionCount = 0;
      }
      this.dailyResetDate = today;
      this.sessionActionCount = stored.safety_session_count || 0;
      this.warmupDay = stored.safety_warmup_day || 0;
      this.cooldownUntil = stored.safety_cooldown_until || 0;

      // Restaurar calor diário
      if (stored.safety_daily_heat_date === today) {
        this._dailyHeat = stored.safety_daily_heat || 0;
        this._cooldownEscalation = stored.safety_cooldown_escalation || 0;
      } else {
        this._dailyHeat = 0;
        this._cooldownEscalation = 0;
      }
      this._dailyHeatDate = today;
      this._lastRateLimitTime = stored.safety_last_rate_limit_time || 0;

      if (this.cooldownUntil > Date.now()) {
        this.isPaused = true;
        this.pauseReason = 'cooldown ativo';
        const remainingMs = this.cooldownUntil - Date.now();
        const remaining = Math.round(remainingMs / 60000);
        log('warn', `Cooldown ativo — ${remaining} min restantes`);

        // Agendar auto-resume para quando o cooldown expirar
        // (restaura o setTimeout que se perde com reload da página)
        this._scheduleCooldownResume(remainingMs);
      }

      log('info', `SafetyGuard iniciado — Hoje: ${this.dailyActionCount} ações, Sessão: ${this.sessionActionCount}, Calor: ${this._dailyHeat}/100, Escalação: ${this._cooldownEscalation}x`);
      return true;
    },

    _saveTimer: null,
    _getSavePayload() {
      return {
        safety_daily_count: this.dailyActionCount,
        safety_daily_date: this.dailyResetDate,
        safety_session_count: this.sessionActionCount,
        safety_warmup_day: this.warmupDay,
        safety_cooldown_until: this.cooldownUntil,
        safety_daily_heat: this._dailyHeat,
        safety_daily_heat_date: this._dailyHeatDate,
        safety_cooldown_escalation: this._cooldownEscalation,
        safety_last_rate_limit_time: this._lastRateLimitTime,
      };
    },
    async save() {
      if (this._saveTimer) return;
      this._saveTimer = setTimeout(async () => {
        this._saveTimer = null;
        try {
          await chrome.storage.local.set(this._getSavePayload());
        } catch (e) { log('warn', 'save falhou:', e?.message || e); }
      }, 2000);
    },

    async saveNow() {
      if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
      try {
        await chrome.storage.local.set(this._getSavePayload());
      } catch (e) { log('warn', 'saveNow falhou:', e?.message || e); }
    },

    // ==========================================
    // VERIFICAR SE PODE EXECUTAR PRÓXIMA AÇÃO
    // ==========================================
    canProceed() {
      const limits = this._getEffectiveLimits();

      // Reset diário (incluindo calor)
      const today = new Date().toISOString().slice(0, 10);
      if (this.dailyResetDate !== today) {
        this.dailyActionCount = 0;
        this.dailyResetDate = today;
        // Resetar calor diário e escalação (novo dia = conta "esfriou")
        this._dailyHeat = 0;
        this._dailyHeatDate = today;
        this._cooldownEscalation = 0;
        this.save();
      }

      // 1. Cooldown ativo?
      if (this.cooldownUntil > Date.now()) {
        const remaining = Math.round((this.cooldownUntil - Date.now()) / 60000);
        return { allowed: false, reason: `Cooldown ativo (${remaining} min restantes)`, code: 'cooldown', unblockAt: this.cooldownUntil };
      }

      // 2. Calor diário crítico? (>= 80 = muito arriscado)
      if (this._dailyHeat >= 80) {
        return { allowed: false, reason: `Calor diário crítico (${this._dailyHeat}/100) — aguardando esfriar`, code: 'heat' };
      }

      // 3. Muitos erros consecutivos?
      if (this.consecutiveErrors >= limits.MAX_CONSECUTIVE_ERRORS) {
        this._addHeat(15, 'erros consecutivos');
        this.triggerCooldown(this._getEscalatedMinutes(limits.ERROR_COOLDOWN_MINUTES), 'Muitos erros consecutivos');
        return { allowed: false, reason: `${this.consecutiveErrors} erros seguidos — cooldown aplicado`, code: 'errors' };
      }

      // 4. Blocks detectados?
      if (this.consecutiveBlocks >= limits.MAX_CONSECUTIVE_BLOCKS) {
        this._addHeat(30, 'block detectado');
        this.triggerCooldown(this._getEscalatedMinutes(limits.BLOCK_COOLDOWN_MINUTES), 'Múltiplos bloqueios detectados');
        return { allowed: false, reason: `${this.consecutiveBlocks} bloqueios — cooldown aplicado`, code: 'blocks' };
      }

      // 5. Rate limits?
      if (this.rateLimitHits >= limits.MAX_RATE_LIMITS) {
        this._addHeat(25, 'rate limit');
        this.triggerCooldown(this._getEscalatedMinutes(limits.RATE_LIMIT_COOLDOWN_MINUTES), 'Rate limit do Instagram');
        return { allowed: false, reason: `Rate limit atingido — cooldown aplicado`, code: 'rate_limit' };
      }

      // 6. Verificação de horário (madrugada = mais restritivo)
      const hour = new Date().getHours();
      const isOffHours = hour >= 0 && hour < 7; // 00:00 - 06:59
      const hourlyLimit = isOffHours
        ? Math.floor(this.getHourlyLimit(limits) * 0.5) // 50% do limite de madrugada
        : this._getHeatAdjustedHourlyLimit(limits);

      // 7. Limite por hora? (bloqueia quando já atingiu o limite — próxima ação só após 1h da mais antiga)
      this.pruneHourlyActions();
      if (this.hourlyActions.length >= hourlyLimit) {
        const oldest = this.hourlyActions.length > 0 ? Math.min.apply(null, this.hourlyActions) : Date.now();
        const unblockAt = oldest + 3600000;
        return { allowed: false, reason: `Limite por hora atingido (${this.hourlyActions.length}/${hourlyLimit})`, code: 'hourly', unblockAt };
      }

      // 8. Limite por sessão?
      if (limits.MAX_PER_SESSION > 0 && this.sessionActionCount >= limits.MAX_PER_SESSION) {
        return { allowed: false, reason: `Limite por sessão atingido (${this.sessionActionCount}/${limits.MAX_PER_SESSION})`, code: 'session' };
      }

      // 9. Limite diário? (bloqueia até o próximo dia)
      const dailyLimit = this._getHeatAdjustedDailyLimit(limits);
      if (this.dailyActionCount >= dailyLimit) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return { allowed: false, reason: `Limite diário atingido (${this.dailyActionCount}/${dailyLimit})`, code: 'daily', unblockAt: tomorrow.getTime() };
      }

      return { allowed: true, heat: this._dailyHeat, isOffHours };
    },

    // ==========================================
    // REGISTRAR RESULTADO DE AÇÃO
    // ==========================================
    recordAction(result) {
      if (!result) return;
      const now = Date.now();

      if (result.success) {
        this.consecutiveErrors = 0;
        this.consecutiveBlocks = 0;
        this.rateLimitHits = 0;
        this.sessionActionCount++;
        this.dailyActionCount++;
        this.hourlyActions.push(now);

        // Ações bem-sucedidas esfriam lentamente o calor (max -1 por ação)
        if (this._dailyHeat > 0) {
          this._dailyHeat = Math.max(0, this._dailyHeat - 0.5);
        }
        this.save();
      } else {
        const details = result.details || {};
        const subtype = details.subtype || '';

        if (subtype === 'rate_limit' || result.type === 'rate_limit') {
          this.rateLimitHits++;
          this._cooldownEscalation++;
          this._lastRateLimitTime = now;
          this._addHeat(25, 'rate_limit');
          log('warn', `Rate limit #${this.rateLimitHits} (calor: ${this._dailyHeat}/100, escalação: ${this._cooldownEscalation}x)`);
        } else if (subtype === 'soft_rate_limit') {
          this.consecutiveErrors++;
          this._addHeat(10, 'soft_rate_limit');
          log('warn', `Soft rate limit 403 (calor: ${this._dailyHeat}/100)`);
        } else if (result.type === 'block' || subtype === 'action_blocked') {
          this.consecutiveBlocks++;
          this._cooldownEscalation += 2; // Blocks são mais graves
          this._addHeat(35, 'block');
          log('warn', `Block #${this.consecutiveBlocks} (calor: ${this._dailyHeat}/100)`);
        } else {
          this.consecutiveErrors++;
          this._addHeat(5, 'error');
        }
        this.save();
      }

      // Log periódico
      if (this.sessionActionCount % 25 === 0 && this.sessionActionCount > 0) {
        log('info', `Sessão: ${this.sessionActionCount} ações | Dia: ${this.dailyActionCount} | Calor: ${this._dailyHeat}/100 | Erros: ${this.consecutiveErrors}`);
      }
    },

    // ==========================================
    // COOLDOWN
    // ==========================================
    triggerCooldown(minutes, reason) {
      this.cooldownUntil = Date.now() + (minutes * 60 * 1000);
      this.isPaused = true;
      this.pauseReason = reason;
      this.saveNow();
      log('warn', `COOLDOWN ${minutes} min — ${reason}`);

      // Parar o bot Organic diretamente
      try {
        const btnStop = document.getElementById('btnStop') || document.getElementById('btnStop2');
        if (btnStop) btnStop.click();
      } catch (e) {
        log('warn', 'Falha ao parar bot durante cooldown:', e?.message || e);
      }

      // Notificar Supabase
      const sb = window.LovableSupabase;
      if (sb && sb.isConnected()) {
        sb.updateBotStatus(true, 'rate_limited');
        sb.logAction({
          type: 'error', target: null, success: false,
          details: { subtype: 'safety_cooldown', reason, cooldown_minutes: minutes, daily_count: this.dailyActionCount }
        });
      }

      // Auto-resume após cooldown
      this._scheduleCooldownResume(minutes * 60 * 1000);
    },

    // Agenda o auto-resume do cooldown (sobrevive a re-init)
    _cooldownResumeTimer: null,
    _scheduleCooldownResume(delayMs) {
      // Cancelar timer anterior se houver
      if (this._cooldownResumeTimer) {
        clearTimeout(this._cooldownResumeTimer);
        this._cooldownResumeTimer = null;
      }
      this._cooldownResumeTimer = setTimeout(() => {
        this._cooldownResumeTimer = null;
        this.isPaused = false;
        this.pauseReason = null;
        this.consecutiveErrors = 0;
        this.consecutiveBlocks = 0;
        this.rateLimitHits = 0;
        this.cooldownUntil = 0;
        // NÃO resetar _cooldownEscalation nem _dailyHeat aqui!
        // Eles persistem durante o dia todo para proteger a conta
        this.save();
        log('info', `Cooldown finalizado — pronto para continuar (calor: ${this._dailyHeat}/100, escalação: ${this._cooldownEscalation}x)`);
        const sb = window.LovableSupabase;
        if (sb && sb.isConnected()) {
          sb.updateBotStatus(true, 'online');
        }
      }, delayMs);
    },

    // ==========================================
    // WARMUP — Limites progressivos
    // ==========================================
    getHourlyLimit(limits) {
      if (this.warmupDay <= 0) return limits.MAX_PER_HOUR;
      const warmupPct = [0.30, 0.45, 0.60, 0.75, 0.85, 0.95, 1.0];
      const idx = Math.min(this.warmupDay - 1, warmupPct.length - 1);
      return Math.floor(limits.MAX_PER_HOUR * warmupPct[idx]);
    },

    getDailyLimit(limits) {
      if (this.warmupDay <= 0) return limits.MAX_PER_DAY;
      const warmupPct = [0.25, 0.40, 0.55, 0.70, 0.85, 0.95, 1.0];
      const idx = Math.min(this.warmupDay - 1, warmupPct.length - 1);
      return Math.floor(limits.MAX_PER_DAY * warmupPct[idx]);
    },

    setWarmupDay(day) {
      this.warmupDay = day;
      this.save();
      const limits = this._getEffectiveLimits();
      log('info', `Warmup dia ${day} — Limites: ${this.getHourlyLimit(limits)} /hora, ${this.getDailyLimit(limits)} /dia`);
    },

    // ==========================================
    // HELPERS
    // ==========================================
    pruneHourlyActions() {
      const oneHourAgo = Date.now() - 3600000;
      this.hourlyActions = this.hourlyActions.filter(t => t > oneHourAgo);
    },

    // Limites customizados pelo usuario (carregados do storage)
    _customLimits: null,
    _activePreset: 'nova', // Preset ativo: 'nova', 'media', 'madura'

    // Carrega limites customizados e preset do storage
    async loadCustomLimits() {
      const SESSION_UNLIMITED = 9999;
      try {
        const data = await chrome.storage.local.get(['lovable_safety_limits', 'lovable_safety_preset', 'lovable_auto_renew_session']);
        if (data.lovable_safety_preset) {
          this._activePreset = data.lovable_safety_preset;
        }
        if (!this.applyPreset(this._activePreset, false)) {
          log('warn', `Preset "${this._activePreset}" inválido — usando "media"`);
          this.applyPreset('media', false);
        }
        const autoRenew = data.lovable_auto_renew_session !== false;
        if (this._customLimits && data.lovable_safety_limits && typeof data.lovable_safety_limits === 'object') {
          const sl = data.lovable_safety_limits;
          const safeInt = (val, fallback) => { const n = parseInt(val, 10); return Number.isFinite(n) && n > 0 ? n : fallback; };
          if (sl.MAX_PER_HOUR) this._customLimits.MAX_PER_HOUR = safeInt(sl.MAX_PER_HOUR, this._customLimits.MAX_PER_HOUR);
          if (sl.MAX_PER_DAY) this._customLimits.MAX_PER_DAY = safeInt(sl.MAX_PER_DAY, this._customLimits.MAX_PER_DAY);
          this._customLimits.MAX_PER_SESSION = autoRenew ? SESSION_UNLIMITED : safeInt(sl.MAX_PER_SESSION, this._customLimits.MAX_PER_SESSION);
        } else if (this._customLimits && autoRenew) {
          this._customLimits.MAX_PER_SESSION = SESSION_UNLIMITED;
        }
        log('info', `Limites carregados (preset: ${this._activePreset}): ${JSON.stringify(this._customLimits)}`);
      } catch (e) {
        log('warn', 'Falha ao carregar limites customizados:', e?.message || e);
        if (!this._customLimits) {
          this.applyPreset('media', false);
        }
      }
    },

    // Aplica um preset de segurança
    applyPreset(presetName, persist) {
      const presets = CFG() && CFG().SAFETY_PRESETS ? CFG().SAFETY_PRESETS : {};
      const preset = presets[presetName];
      if (!preset) {
        log('warn', `Preset "${presetName}" não encontrado`);
        return false;
      }
      this._activePreset = presetName;
      this._customLimits = {
        MAX_PER_HOUR: preset.MAX_PER_HOUR,
        MAX_PER_DAY: preset.MAX_PER_DAY,
        MAX_PER_SESSION: preset.MAX_PER_SESSION,
        MAX_CONSECUTIVE_ERRORS: preset.MAX_CONSECUTIVE_ERRORS,
        MAX_CONSECUTIVE_BLOCKS: preset.MAX_CONSECUTIVE_BLOCKS,
        MAX_RATE_LIMITS: preset.MAX_RATE_LIMITS,
        ERROR_COOLDOWN_MINUTES: preset.ERROR_COOLDOWN_MINUTES,
        BLOCK_COOLDOWN_MINUTES: preset.BLOCK_COOLDOWN_MINUTES,
        RATE_LIMIT_COOLDOWN_MINUTES: preset.RATE_LIMIT_COOLDOWN_MINUTES,
        MIN_DELAY_SECONDS: preset.MIN_DELAY_SECONDS,
        MAX_DELAY_SECONDS: preset.MAX_DELAY_SECONDS,
      };
      if (persist !== false) {
        try {
          chrome.storage.local.set({
            lovable_safety_limits: this._customLimits,
            lovable_safety_preset: presetName
          });
        } catch (e) {}
      }
      log('info', `Preset "${presetName}" aplicado — ${this._customLimits.MAX_PER_HOUR}/hora, ${this._customLimits.MAX_PER_DAY}/dia, delay ${this._customLimits.MIN_DELAY_SECONDS}-${this._customLimits.MAX_DELAY_SECONDS}s`);
      return true;
    },

    // Retorna o preset ativo
    getActivePreset() {
      return this._activePreset || 'media';
    },

    // Retorna o delay recomendado entre ações (em ms)
    // PROGRESSIVO: aumenta quando perto dos limites ou com calor alto
    getRecommendedDelay() {
      const limits = this._getEffectiveLimits();
      let minMs = (limits.MIN_DELAY_SECONDS || 28) * 1000;
      let maxMs = (limits.MAX_DELAY_SECONDS || 60) * 1000;

      // 1. Fator de calor: quanto mais quente, mais lento
      //    calor 0 = 1x, calor 50 = 1.5x, calor 80 = 2.5x
      const heatFactor = 1 + (this._dailyHeat / 100) * 1.5;

      // 2. Fator de proximidade: quanto mais perto do limite horário, mais lento
      this.pruneHourlyActions();
      const hourlyLimit = this.getHourlyLimit(limits);
      const hourlyUsage = hourlyLimit > 0 ? this.hourlyActions.length / hourlyLimit : 0;
      // Quando >50% do limite usado, começar a desacelerar
      const proximityFactor = hourlyUsage > 0.5 ? 1 + (hourlyUsage - 0.5) * 2 : 1;

      // 3. Fator noturno: madrugada = 2x mais lento
      const hour = new Date().getHours();
      const nightFactor = (hour >= 0 && hour < 7) ? 2.0 : 1.0;

      // 4. Fator pós-cooldown: se acabou de sair de cooldown, ir devagar
      const postCooldownFactor = this._cooldownEscalation > 0 ? 1 + (this._cooldownEscalation * 0.3) : 1;

      const totalFactor = Math.max(heatFactor, proximityFactor) * nightFactor * postCooldownFactor;

      minMs = Math.round(minMs * totalFactor);
      maxMs = Math.round(maxMs * totalFactor);

      // Cap: nunca mais que 5 minutos entre ações
      maxMs = Math.min(maxMs, 300000);
      minMs = Math.min(minMs, maxMs);

      const delay = minMs + Math.floor(Math.random() * (maxMs - minMs));

      // Log se delay estiver muito elevado
      if (totalFactor > 1.5) {
        log('info', `Delay ajustado: ${Math.round(delay/1000)}s (fator: ${totalFactor.toFixed(1)}x — calor:${this._dailyHeat}, hora:${hourlyUsage.toFixed(1)}, noite:${nightFactor > 1}, esc:${this._cooldownEscalation})`);
      }

      return delay;
    },

    // Atualiza limites em tempo real (chamado pelo popup)
    updateLimits(newLimits) {
      if (!newLimits) return;
      // Começar com os valores explícitos do popup
      const safeInt = (val, fallback) => { const n = parseInt(val, 10); return Number.isFinite(n) ? n : fallback; };
      this._customLimits = {
        MAX_PER_HOUR: safeInt(newLimits.MAX_PER_HOUR, 15),
        MAX_PER_DAY: safeInt(newLimits.MAX_PER_DAY, 100),
        MAX_PER_SESSION: safeInt(newLimits.MAX_PER_SESSION, 60),
      };
      // Preencher campos restantes a partir do preset ativo (usa != null para aceitar 0)
      const presets = CFG() && CFG().SAFETY_PRESETS ? CFG().SAFETY_PRESETS : {};
      const activePreset = presets[this._activePreset] || {};
      const extraFields = [
        'ERROR_COOLDOWN_MINUTES', 'BLOCK_COOLDOWN_MINUTES', 'RATE_LIMIT_COOLDOWN_MINUTES',
        'MIN_DELAY_SECONDS', 'MAX_DELAY_SECONDS',
        'MAX_CONSECUTIVE_ERRORS', 'MAX_CONSECUTIVE_BLOCKS', 'MAX_RATE_LIMITS'
      ];
      for (const field of extraFields) {
        if (newLimits[field] != null) {
          this._customLimits[field] = newLimits[field];
        } else if (activePreset[field] != null) {
          this._customLimits[field] = activePreset[field];
        }
      }

      // Persistir no storage para sobreviver a reloads
      try { chrome.storage.local.set({ lovable_safety_limits: this._customLimits }); } catch (e) {}
      log('info', `Limites atualizados: ${this._customLimits.MAX_PER_HOUR}/hora, ${this._customLimits.MAX_PER_DAY}/dia, ${this._customLimits.MAX_PER_SESSION}/sessão`);
    },

    resetSession() {
      this.sessionActionCount = 0;
      this.consecutiveErrors = 0;
      this.consecutiveBlocks = 0;
      this.rateLimitHits = 0;
      this.hourlyActions = [];
      this.save();
      log('info', 'Sessão resetada');
    },

    // ==========================================
    // SISTEMA DE CALOR DIÁRIO
    // ==========================================
    _addHeat(amount, source) {
      const today = new Date().toISOString().slice(0, 10);
      if (this._dailyHeatDate !== today) {
        this._dailyHeat = 0;
        this._dailyHeatDate = today;
        this._cooldownEscalation = 0;
      }
      this._dailyHeat = Math.min(100, this._dailyHeat + amount);
      log('warn', `Calor +${amount} (${source}) → ${this._dailyHeat}/100`);
    },

    // Retorna minutos de cooldown escalados
    // Primeira ocorrência: base, segunda: base*1.5, terceira: base*2, etc.
    _getEscalatedMinutes(baseMinutes) {
      if (this._cooldownEscalation <= 1) return baseMinutes;
      // Escalar: 1x, 1.5x, 2x, 2.5x, 3x (max 3x)
      const multiplier = Math.min(3.0, 1 + (this._cooldownEscalation - 1) * 0.5);
      const escalated = Math.round(baseMinutes * multiplier);
      log('warn', `Cooldown escalado: ${baseMinutes} min → ${escalated} min (${multiplier.toFixed(1)}x, ocorrência #${this._cooldownEscalation})`);
      return escalated;
    },

    // Limite horário ajustado pelo calor
    _getHeatAdjustedHourlyLimit(limits) {
      const base = this.getHourlyLimit(limits);
      if (this._dailyHeat <= 20) return base; // Calor baixo, limite normal
      // Calor 20-80: reduzir progressivamente (até 50% do limite)
      const reduction = Math.min(0.5, (this._dailyHeat - 20) / 120); // 0 a 0.5
      return Math.max(3, Math.floor(base * (1 - reduction)));
    },

    // Limite diário ajustado pelo calor
    _getHeatAdjustedDailyLimit(limits) {
      const base = this.getDailyLimit(limits);
      if (this._dailyHeat <= 30) return base;
      const reduction = Math.min(0.4, (this._dailyHeat - 30) / 125); // 0 a 0.4
      return Math.max(10, Math.floor(base * (1 - reduction)));
    },

    getStats() {
      const limits = this._getEffectiveLimits();
      const hour = new Date().getHours();
      const isOffHours = hour >= 0 && hour < 7;
      const effectiveHourly = isOffHours
        ? Math.floor(this.getHourlyLimit(limits) * 0.5)
        : this._getHeatAdjustedHourlyLimit(limits);
      const atHourlyLimit = this.hourlyActions.length >= effectiveHourly && this.hourlyActions.length > 0;
      const dailyLimit = this._getHeatAdjustedDailyLimit(limits);
      const atDailyLimit = this.dailyActionCount >= dailyLimit;
      return {
        sessionActions: this.sessionActionCount,
        dailyActions: this.dailyActionCount,
        hourlyActions: this.hourlyActions.length,
        hourlyLimit: effectiveHourly,
        dailyLimit,
        sessionLimit: limits.MAX_PER_SESSION,
        consecutiveErrors: this.consecutiveErrors,
        consecutiveBlocks: this.consecutiveBlocks,
        rateLimitHits: this.rateLimitHits,
        isPaused: this.isPaused,
        pauseReason: this.pauseReason,
        cooldownRemaining: this.cooldownUntil > Date.now() ? Math.round((this.cooldownUntil - Date.now()) / 60000) : 0,
        cooldownUnblockAt: this.cooldownUntil > Date.now() ? this.cooldownUntil : 0,
        hourlyUnblockAt: atHourlyLimit ? Math.min.apply(null, this.hourlyActions) + 3600000 : 0,
        dailyUnblockAt: atDailyLimit ? (() => { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(0, 0, 0, 0); return t.getTime(); })() : 0,
        warmupDay: this.warmupDay,
        activePreset: this._activePreset || 'media',
        minDelay: limits.MIN_DELAY_SECONDS || 28,
        maxDelay: limits.MAX_DELAY_SECONDS || 60,
        dailyHeat: this._dailyHeat,
        cooldownEscalation: this._cooldownEscalation,
        isOffHours,
        recommendedDelay: Math.round(this.getRecommendedDelay() / 1000),
      };
    },

    _getEffectiveLimits() {
      // Prioridade: 1. customLimits (popup/preset) > 2. LovableConfig.SAFETY > 3. defaults base
      const base = {
        MAX_PER_HOUR: 12, MAX_PER_DAY: 80, MAX_PER_SESSION: 50,
        MAX_CONSECUTIVE_ERRORS: 3, MAX_CONSECUTIVE_BLOCKS: 1, MAX_RATE_LIMITS: 1,
        ERROR_COOLDOWN_MINUTES: 25, BLOCK_COOLDOWN_MINUTES: 150, RATE_LIMIT_COOLDOWN_MINUTES: 90,
        MIN_DELAY_SECONDS: 35, MAX_DELAY_SECONDS: 75,
      };
      const cfgSafety = (CFG() && CFG().SAFETY) ? CFG().SAFETY : {};
      // Config estático sobrescreve base, custom do user sobrescreve tudo
      // Usar Object.assign para merge correto — aceita valores 0 (truthy check ignorava 0)
      const merged = Object.assign({}, base, cfgSafety);
      if (this._customLimits) {
        // Copiar apenas campos numéricos definidos (não undefined/null)
        for (const key of Object.keys(base)) {
          if (this._customLimits[key] != null) {
            merged[key] = this._customLimits[key];
          }
        }
      }
      return merged;
    }
  };

  log('info', 'LovableSafety carregado');
})();
