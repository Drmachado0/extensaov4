-- ============================================================
-- GrowBot + Lovable — Schema SQL para Supabase
-- Execute este script no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Tabela de contas Instagram vinculadas
CREATE TABLE IF NOT EXISTS ig_accounts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_username     TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT true,

  -- Estatísticas do perfil
  followers_count BIGINT DEFAULT 0,
  following_count BIGINT DEFAULT 0,
  posts_count     BIGINT DEFAULT 0,

  -- Status do bot
  bot_online      BOOLEAN DEFAULT false,
  bot_status      TEXT DEFAULT 'idle',
  bot_mode        TEXT DEFAULT 'follow',
  last_heartbeat  TIMESTAMPTZ,

  -- Configurações do bot
  likes_per_follow        INT DEFAULT 0,
  delay_min               INT DEFAULT 25,
  delay_max               INT DEFAULT 45,
  max_actions_per_session  INT DEFAULT 200,
  bot_schedule            JSONB DEFAULT '{}',

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Índice para buscar conta ativa por user_id
CREATE INDEX IF NOT EXISTS idx_ig_accounts_user_active ON ig_accounts(user_id, is_active);

-- 2. Tabela de log de ações (follow, unfollow, like, block, etc.)
CREATE TABLE IF NOT EXISTS action_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_account_id   UUID REFERENCES ig_accounts(id) ON DELETE SET NULL,
  action_type     TEXT NOT NULL,       -- 'follow', 'unfollow', 'like', 'block', 'remove', 'story_view'
  target_username TEXT,
  target_url      TEXT,
  status          TEXT DEFAULT 'success',  -- 'success', 'error', 'skipped'
  details         TEXT,
  executed_at     TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas de relatório
CREATE INDEX IF NOT EXISTS idx_action_log_user ON action_log(user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_type ON action_log(action_type, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_account ON action_log(ig_account_id, executed_at DESC);

-- 3. Tabela de estatísticas de crescimento (snapshots periódicos)
CREATE TABLE IF NOT EXISTS growth_stats (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_account_id   UUID REFERENCES ig_accounts(id) ON DELETE SET NULL,
  followers_count BIGINT DEFAULT 0,
  following_count BIGINT DEFAULT 0,
  posts_count     BIGINT DEFAULT 0,
  recorded_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_stats_user ON growth_stats(user_id, recorded_at DESC);

-- 4. Tabela de estatísticas de sessão
CREATE TABLE IF NOT EXISTS session_stats (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_account_id   UUID REFERENCES ig_accounts(id) ON DELETE SET NULL,
  follows_count   INT DEFAULT 0,
  unfollows_count INT DEFAULT 0,
  likes_count     INT DEFAULT 0,
  comments_count  INT DEFAULT 0,
  blocks_count    INT DEFAULT 0,
  skips_count     INT DEFAULT 0,
  errors_count    INT DEFAULT 0,
  session_start   TIMESTAMPTZ,
  session_end     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_session_stats_user ON session_stats(user_id, session_start DESC);

-- 5. Tabela de comandos remotos (dashboard → extensão)
CREATE TABLE IF NOT EXISTS bot_commands (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ig_account_id   UUID NOT NULL REFERENCES ig_accounts(id) ON DELETE CASCADE,
  command         TEXT NOT NULL,           -- 'start', 'stop', 'set_mode', 'scrape', 'load_queue'
  payload         JSONB DEFAULT '{}',
  status          TEXT DEFAULT 'pending',  -- 'pending', 'executed', 'failed'
  result          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  executed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bot_commands_pending ON bot_commands(ig_account_id, status) WHERE status = 'pending';

-- 6. Tabela de fila de alvos (contas para seguir/interagir)
CREATE TABLE IF NOT EXISTS target_queue (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ig_account_id   UUID NOT NULL REFERENCES ig_accounts(id) ON DELETE CASCADE,
  username        TEXT NOT NULL,
  source          TEXT DEFAULT 'manual',   -- 'manual', 'scrape', 'import', 'dashboard'
  status          TEXT DEFAULT 'pending',  -- 'pending', 'processing', 'done', 'failed'
  priority        INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_target_queue_pending ON target_queue(ig_account_id, status, priority DESC, created_at ASC) WHERE status = 'pending';

-- ============================================================
-- Row Level Security (RLS) — Cada user só vê seus próprios dados
-- ============================================================

ALTER TABLE ig_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_stats   ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_stats  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_commands   ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_queue   ENABLE ROW LEVEL SECURITY;

-- ig_accounts: user só vê suas contas
CREATE POLICY "Users manage own ig_accounts" ON ig_accounts
  FOR ALL USING (auth.uid() = user_id);

-- action_log: user só vê seus logs
CREATE POLICY "Users manage own action_log" ON action_log
  FOR ALL USING (auth.uid() = user_id);

-- growth_stats: user só vê suas stats
CREATE POLICY "Users manage own growth_stats" ON growth_stats
  FOR ALL USING (auth.uid() = user_id);

-- session_stats: user só vê suas sessões
CREATE POLICY "Users manage own session_stats" ON session_stats
  FOR ALL USING (auth.uid() = user_id);

-- bot_commands: user vê comandos de suas contas
CREATE POLICY "Users manage own bot_commands" ON bot_commands
  FOR ALL USING (
    ig_account_id IN (SELECT id FROM ig_accounts WHERE user_id = auth.uid())
  );

-- target_queue: user vê fila de suas contas
CREATE POLICY "Users manage own target_queue" ON target_queue
  FOR ALL USING (
    ig_account_id IN (SELECT id FROM ig_accounts WHERE user_id = auth.uid())
  );

-- ============================================================
-- Trigger para atualizar updated_at automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ig_accounts_updated_at
  BEFORE UPDATE ON ig_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- MIGRAÇÃO v2.5 — Novas colunas para sincronização avançada
-- Executar após a criação inicial (idempotente)
-- ============================================================

-- Preset de segurança ativo (nova / media / madura)
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS safety_preset TEXT DEFAULT 'media';

-- Limites customizados de segurança (MAX_PER_HOUR, MAX_PER_DAY, MAX_PER_SESSION, etc.)
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS safety_limits JSONB DEFAULT '{}';

-- Timings nativos do GrowBot (delay, randomização, rate limit handling)
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS growbot_timings JSONB DEFAULT '{}';

-- Progresso diário do scheduler (date, follows, likes, unfollows feitos hoje)
ALTER TABLE ig_accounts ADD COLUMN IF NOT EXISTS scheduler_progress JSONB DEFAULT '{}';
