// lovable-config.js — Integração direta Organic (sem Bridge)
// Configuração centralizada para todos os módulos Lovable
(function () {
  'use strict';

  const root = typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis);

  root.LovableConfig = Object.freeze({
    VERSION: '8.14',

    // Supabase
    SUPABASE_URL: 'https://ebyruchdswmkuynthiqi.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieXJ1Y2hkc3dta3V5bnRoaXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NDQyMzYsImV4cCI6MjA4NjEyMDIzNn0.fKuLCySRNC_YJzO4gNM5Um4WISneTiSyhhhJsW3Ho18',

    // Dashboard
    DASHBOARD_URL: 'https://organicbot.lovable.app',

    // Timings (ms)
    HEARTBEAT_INTERVAL: 5 * 60 * 1000,        // 5 min
    STATS_REPORT_INTERVAL: 5 * 60 * 1000,     // 5 min
    PROFILE_COLLECT_INTERVAL: 15 * 60 * 1000,  // 15 min
    COMMAND_POLL_INTERVAL: 45 * 1000,           // 45s
    RETRY_QUEUE_INTERVAL: 30 * 1000,            // 30s
    SCHEDULER_CHECK_INTERVAL: 30 * 1000,        // 30s
    LIVE_COUNTERS_INTERVAL: 30 * 1000,          // 30s — sync leve de contadores para dashboard
    QUEUE_SYNC_INTERVAL: 60 * 1000,             // 1 min
    SETTINGS_SYNC_INTERVAL: 2 * 60 * 1000,      // 2 min
    TOKEN_REFRESH_INTERVAL: 45 * 60 * 1000,     // 45 min

    // Limits
    RETRY_QUEUE_BATCH_SIZE: 10,
    RETRY_QUEUE_MAX_SIZE: 500,
    MAX_USERNAME_LENGTH: 30,
    QUEUE_FETCH_LIMIT: 50,

    // Safety Guard — Proteção contra ban (valores baseados nas normas do Instagram 2025/2026)
    // Default: "Conta Media" (3-12 meses) — perfil conservador e seguro
    SAFETY: {
      MAX_PER_HOUR: 12,           // Instagram permite ~10-20/hora — usamos 12 para margem
      MAX_PER_DAY: 80,            // Seguro: 80-100/dia para contas médias (era 100)
      MAX_PER_SESSION: 50,        // Limitar sessão para não concentrar ações (era 60)
      MAX_CONSECUTIVE_ERRORS: 3,  // Menos tolerância a erros
      MAX_CONSECUTIVE_BLOCKS: 1,  // 1 block = pausa imediata
      MAX_RATE_LIMITS: 1,         // 1 rate limit = pausa imediata
      ERROR_COOLDOWN_MINUTES: 25, // Cooldown mais longo para erros (era 20)
      BLOCK_COOLDOWN_MINUTES: 150,// 2.5 horas de pausa após block (era 2h)
      RATE_LIMIT_COOLDOWN_MINUTES: 90, // 1.5 hora após rate limit (era 1h)
      MIN_DELAY_SECONDS: 35,      // Intervalo mínimo entre ações (era 28)
      MAX_DELAY_SECONDS: 75,      // Intervalo máximo entre ações (era 60)
    },

    // Presets de segurança por idade da conta
    // Cada preset inclui: limites Lovable + timings nativos do Organic
    SAFETY_PRESETS: {
      nova: {
        label: 'Conta Nova (< 3 meses)',
        // Limites Lovable SafetyGuard — MUITO conservador
        // Contas novas são as mais vigiadas pelo Instagram.
        // Prioridade absoluta: NÃO tomar action block.
        MAX_PER_HOUR: 5,            // 5/hora max (menos previsível)
        MAX_PER_DAY: 25,            // 25/dia max — seguro para conta nova
        MAX_PER_SESSION: 15,        // Sessões curtas — comportamento humano
        MAX_CONSECUTIVE_ERRORS: 2,  // 2 erros = pausa
        MAX_CONSECUTIVE_BLOCKS: 1,  // 1 block = pausa imediata
        MAX_RATE_LIMITS: 1,         // 1 rate limit = pausa imediata
        ERROR_COOLDOWN_MINUTES: 45, // 45min cooldown após erro
        BLOCK_COOLDOWN_MINUTES: 300,// 5 horas após block (Instagram lembra)
        RATE_LIMIT_COOLDOWN_MINUTES: 150, // 2.5h após rate limit
        MIN_DELAY_SECONDS: 60,      // Min 60s entre ações
        MAX_DELAY_SECONDS: 150,     // Max 2.5min — parece humano
        // Timings nativos Organic (aplicados diretamente no DOM/gblOptions)
        ORGANIC: {
          timeDelay: 130000,                    // 130s entre ações
          timeDelayAfterSkip: 5000,             // 5s após pular
          useRandomTimeDelay: true,             // Ativar aleatoriedade
          percentRandomTimeDelay: 0.45,         // ±45% variação (mais humano)
          timeDelayAfterSoftRateLimit: 3000000, // 50 min após soft rate limit
          timeDelayAfterHardRateLimit: 18000000,// 5 horas após hard rate limit
          timeDelayAfter429RateLimit: 9000000,  // 2.5 horas após 429
          useTimeDelayAfterAdditionalInfo: true,
          timeDelayAfterAdditionalInfo: 5000,   // 5s após carregar info
          retriesAfterAdditionalInfo404: 2,     // Menos retries — menos suspeito
          maxPerEnabled: true,                  // Ativar limite de ações nativo
          maxPerActions: 25,                    // Alinhado com MAX_PER_DAY
          maxPerPeriod: 86400000,               // Por 24 horas
        },
      },
      media: {
        label: 'Conta Media (3-12 meses)',
        // Limites moderados — conta já tem alguma confiança
        MAX_PER_HOUR: 10,           // 10/hora — ritmo moderado
        MAX_PER_DAY: 60,            // 60/dia — seguro para conta média
        MAX_PER_SESSION: 35,        // Sessões médias
        MAX_CONSECUTIVE_ERRORS: 3,
        MAX_CONSECUTIVE_BLOCKS: 1,
        MAX_RATE_LIMITS: 1,
        ERROR_COOLDOWN_MINUTES: 30, // 30min
        BLOCK_COOLDOWN_MINUTES: 180,// 3h após block
        RATE_LIMIT_COOLDOWN_MINUTES: 90, // 1.5h
        MIN_DELAY_SECONDS: 40,      // Min 40s
        MAX_DELAY_SECONDS: 90,      // Max 1.5min
        // Timings nativos Organic
        ORGANIC: {
          timeDelay: 85000,                     // 85s entre ações
          timeDelayAfterSkip: 4000,             // 4s após pular
          useRandomTimeDelay: true,
          percentRandomTimeDelay: 0.35,         // ±35% variação
          timeDelayAfterSoftRateLimit: 2100000, // 35 min após soft rate limit
          timeDelayAfterHardRateLimit: 10800000,// 3 horas após hard rate limit
          timeDelayAfter429RateLimit: 5400000,  // 90 min após 429
          useTimeDelayAfterAdditionalInfo: true,
          timeDelayAfterAdditionalInfo: 3000,   // 3s
          retriesAfterAdditionalInfo404: 4,     // 4 retries
          maxPerEnabled: true,
          maxPerActions: 60,                    // Alinhado com MAX_PER_DAY
          maxPerPeriod: 86400000,
        },
      },
      madura: {
        label: 'Conta Madura (> 1 ano)',
        // Limites mais altos — conta tem trust score elevado
        // Ainda conservador vs. limites reais do Instagram
        MAX_PER_HOUR: 18,           // 18/hora — bom ritmo sem suspeita
        MAX_PER_DAY: 100,           // 100/dia — seguro para conta madura
        MAX_PER_SESSION: 55,        // Sessões mais longas ok
        MAX_CONSECUTIVE_ERRORS: 3,
        MAX_CONSECUTIVE_BLOCKS: 1,  // 1 block = pausa sempre
        MAX_RATE_LIMITS: 1,         // 1 rate limit = pausa sempre
        ERROR_COOLDOWN_MINUTES: 20, // 20min
        BLOCK_COOLDOWN_MINUTES: 120,// 2h
        RATE_LIMIT_COOLDOWN_MINUTES: 60, // 1h
        MIN_DELAY_SECONDS: 28,      // Min 28s
        MAX_DELAY_SECONDS: 65,      // Max ~1min
        // Timings nativos Organic
        ORGANIC: {
          timeDelay: 60000,                     // 60s entre ações
          timeDelayAfterSkip: 3000,             // 3s
          useRandomTimeDelay: true,
          percentRandomTimeDelay: 0.30,         // ±30% variação
          timeDelayAfterSoftRateLimit: 1500000, // 25 min
          timeDelayAfterHardRateLimit: 7200000, // 2 horas
          timeDelayAfter429RateLimit: 3600000,  // 60 min após 429
          useTimeDelayAfterAdditionalInfo: true,
          timeDelayAfterAdditionalInfo: 2000,
          retriesAfterAdditionalInfo404: 6,
          maxPerEnabled: true,
          maxPerActions: 100,                   // Alinhado com MAX_PER_DAY
          maxPerPeriod: 86400000,
        },
      },
    },

    // Instagram API
    IG_APP_ID: '936619743392459',
  });

  // Utilitário — sanitização de username
  root.LovableUtils = Object.freeze({
    sanitizeUsername(u) {
      if (!u) return null;
      return String(u).replace(/^@/, '').replace(/[^a-zA-Z0-9_.]/g, '').substring(0, root.LovableConfig.MAX_USERNAME_LENGTH || 30) || null;
    }
  });

  console.log(`[Lovable] Config v${root.LovableConfig.VERSION} carregado`);
})();
