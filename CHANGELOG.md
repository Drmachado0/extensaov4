
## v8.1.2 — 2026-02-22

### Extensão

**🔴 Bug crítico corrigido — `lovable-safety.js`**
- `loadCustomLimits()` não sobrescreve mais os limites customizados pelo usuário (sliders do popup) ao recarregar a página. Antes, todo reload de aba restaurava os valores padrão do preset.

**🟠 `backgroundscript.js`**
- Adicionado `chrome.runtime.onSuspend` listener: ao fechar o Chrome ou desativar a extensão, a conta é marcada como `bot_online=false` e `bot_status=offline` no Supabase imediatamente, em vez de aguardar expiração do heartbeat.
- Intervalo do `lovable-command-poll` aumentado de 45s para 60s (menos execuções no service worker).

**🟠 `lovable-supabase.js`**
- Heartbeat agora inclui `daily_heat`, `cooldown_remaining_minutes`, `cooldown_escalation` e `safety_preset` — visíveis no dashboard para diagnóstico remoto.
- Retry queue com TTL diferenciado por tabela: `action_log` expira em 3h, `session_stats` em 6h, demais em 24h.

**🟡 `lovable-config.js`**  
- `VERSION`: `2.6.0` → `2.7.0`

### Dashboard

**🔴 Bug crítico corrigido — `Actions.tsx`**
- A tabela `action_log` não possui coluna `user_id`. No modo "Todas as contas", a query usava `.eq("user_id", ...)` retornando sempre zero resultados. Corrigido para usar `.in("ig_account_id", ids)` baseado nas contas do usuário.
- Filtro de realtime também corrigido (não usa mais `user_id=eq.` que não existe na tabela).

**🔴 Presets sincronizados — `Extension.tsx` + `Settings.tsx`**
- `REFERENCE_PRESETS` e `DEFAULT_SAFETY_PRESETS` atualizados para refletir os valores reais da extensão (`lovable-config.js`). Antes exibiam limites até 2× maiores do que a extensão realmente aplica.
- `DEFAULTS` de Settings ajustado para corresponder ao preset "média" real.

**🟠 Indicador de saúde da conta — `Extension.tsx`**
- Cards de conta agora exibem barra de "Calor da conta" (0–100) e badge de cooldown ativo quando a extensão reporta esses dados no heartbeat.
- Preset ativo da extensão exibido no subtítulo do card.

**🟡 `Extension.tsx` — melhorias diversas**
- Threshold de "online" aumentado de 6min para 8min (evita piscar entre online/away com atrasos normais de rede).
- Threshold de "away" aumentado de 30min para 45min.
- `ZIP_URL` aponta agora para tag de release `v8.1.2` em vez da branch `main` (instável).
- Botão "Aplicar remotamente" em cada card de preset: envia comando `set_safety_preset` para a extensão via Supabase `bot_commands`, sem precisar abrir o popup.
# Changelog — Extensão Organic

## v8.1.1 — 2026-02-22

- **lovable-config.js** VERSION: `2.5.0` → `2.6.0`
- Versão alinhada com o dashboard para rastreabilidade
- Sem mudanças funcionais nesta versão da extensão

*Próximas melhorias planejadas: autenticação via Bridge Token (substituindo email/senha),
poll do popup enviado apenas para aba ativa, intervalo de command-poll aumentado para 60s.*
