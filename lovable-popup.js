// lovable-popup.js — Popup do Organic (integração direta)
document.addEventListener('DOMContentLoaded', async () => {
  const cfg = window.LovableConfig || {};
  const SB = cfg.SUPABASE_URL || 'https://ebyruchdswmkuynthiqi.supabase.co';
  const KEY = cfg.SUPABASE_KEY || '';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const POLL_ACTIVE = 3000;
  const POLL_HIDDEN = 10000;

  const fetchHttp = (url, options, retryCfg) => {
    if (window.LovableHttp && window.LovableHttp.fetchWithRetry) {
      return window.LovableHttp.fetchWithRetry(url, options, retryCfg);
    }
    return fetch(url, options);
  };

  const sanitizeUsername = (value) => {
    if (window.LovableUtils) return window.LovableUtils.sanitizeUsername(value);
    return String(value || '').replace(/^@/, '').replace(/[^a-zA-Z0-9_.]/g, '').substring(0, 30);
  };

  let pollTimer = null;
  let pollRunning = false;

  // Versão
  try {
    const manifest = chrome.runtime.getManifest();
    document.getElementById('verDisplay').textContent = 'v' + manifest.version;
  } catch (e) {}

  // Refs DOM
  const d1=document.getElementById('d1'),v1=document.getElementById('v1');
  const d2=document.getElementById('d2'),v2=document.getElementById('v2');
  const d3=document.getElementById('d3'),v3=document.getElementById('v3');
  const viewOn=document.getElementById('on'),viewOff=document.getElementById('off');
  const ue=document.getElementById('ue');
  const iE=document.getElementById('iE'),iP=document.getElementById('iP');
  const btnIn=document.getElementById('bI'),btnOut=document.getElementById('bO');
  const btnReset=document.getElementById('bR'),btnDash=document.getElementById('bD');
  const btnProfile=document.getElementById('btnProfile');
  const mg=document.getElementById('mg'),syncInfo=document.getElementById('syncInfo');
  const pavatar=document.getElementById('pavatar'),pname=document.getElementById('pname');
  const psub=document.getElementById('psub');
  const pfollowers=document.getElementById('pfollowers'),pfollowing=document.getElementById('pfollowing');
  const pposts=document.getElementById('pposts');
  const mRate=document.getElementById('mRate'),mTotal=document.getElementById('mTotal');
  const mQueue=document.getElementById('mQueue');
  const btnStart=document.getElementById('btnStart'),btnStop=document.getElementById('btnStop');
  const modeOpts=document.querySelectorAll('.mode-opt');
  const gbStatusText=document.getElementById('gbStatusText');
  const scrapeUser=document.getElementById('scrapeUser');   // Pode ser null (seção removida)
  const scrapeMax=document.getElementById('scrapeMax');     // Pode ser null
  const btnScrape=document.getElementById('btnScrape');     // Pode ser null
  const scrapeProgress=document.getElementById('scrapeProgress'); // Pode ser null
  const btnSyncQueue=document.getElementById('btnSyncQueue');

  const btnOpenIG = document.getElementById('btnOpenIG');
  const btnOpenCollector = document.getElementById('btnOpenCollector');
  const likeCount = document.getElementById('likeCount');
  const likeCountRow = document.getElementById('likeCountRow');
  const d4 = document.getElementById('d4');
  const v4 = document.getElementById('v4');
  const schedMini = document.getElementById('schedMini');
  const schedMiniText = document.getElementById('schedMiniText');
  const schedMiniFill = document.getElementById('schedMiniFill');
  const syncWrites = document.getElementById('syncWrites');
  const syncErrors = document.getElementById('syncErrors');
  const syncErrDot = document.getElementById('syncErrDot');
  const syncRetryInfo = document.getElementById('syncRetryInfo');
  const syncRetry = document.getElementById('syncRetry');
  let currentMode = 'seguir_curtir';

  // Presets de segurança — lidos diretamente do config para evitar divergência
  // O lovable-config.js é carregado antes deste script no popup HTML
  const SAFETY_PRESETS = (window.LovableConfig && window.LovableConfig.SAFETY_PRESETS)
    ? Object.fromEntries(
        Object.entries(window.LovableConfig.SAFETY_PRESETS).map(([k, v]) => [k, {
          label: v.label,
          MAX_PER_HOUR: v.MAX_PER_HOUR,
          MAX_PER_DAY: v.MAX_PER_DAY,
          MAX_PER_SESSION: v.MAX_PER_SESSION,
          info: k === 'nova'
            ? 'Ultra-conservador. Contas novas são as mais vigiadas pelo Instagram. Prioridade: evitar action block a todo custo.'
            : k === 'media'
            ? 'Limites moderados para contas com 3-12 meses. Ritmo seguro baseado nas normas do Instagram 2025/2026.'
            : 'Limites mais altos para contas estabelecidas (>1 ano). Ainda conservador para manter a conta segura.'
        }])
      )
    : {
      nova:   { label: 'Conta Nova (< 3 meses)',   MAX_PER_HOUR: 5,  MAX_PER_DAY: 25,  MAX_PER_SESSION: 15, info: 'Ultra-conservador. Contas novas são as mais vigiadas pelo Instagram. Prioridade: evitar action block a todo custo.' },
      media:  { label: 'Conta Media (3-12 meses)', MAX_PER_HOUR: 10, MAX_PER_DAY: 60,  MAX_PER_SESSION: 35, info: 'Limites moderados para contas com 3-12 meses. Ritmo seguro baseado nas normas do Instagram 2025/2026.' },
      madura: { label: 'Conta Madura (> 1 ano)',   MAX_PER_HOUR: 18, MAX_PER_DAY: 100, MAX_PER_SESSION: 55, info: 'Limites mais altos para contas estabelecidas (>1 ano). Ainda conservador para manter a conta segura.' },
    };
  let activePreset = 'nova';

  // Carregar email salvo
  const draft = await chrome.storage.local.get('draft_email');
  if (draft.draft_email) iE.value = draft.draft_email;
  let _draftTimer = null;
  iE.addEventListener('input', () => {
    if (_draftTimer) clearTimeout(_draftTimer);
    _draftTimer = setTimeout(() => chrome.storage.local.set({ draft_email: iE.value }), 400);
  });

  // Estado inicial
  const s = await chrome.storage.local.get(null);
  if (s.sb_access_token && s.sb_user_id) {
    loggedIn(s);
    // Mostrar safety section sempre quando logado (presets configuráveis sem Instagram aberto)
    const safetySection = document.getElementById('safetySection');
    if (safetySection) safetySection.style.display = 'block';
  } else {
    loggedOut();
  }

  // ===== SAFETY GUARD v2 — Inicialização =====
  const sv2ModeInfo_texts = {
    silent:   'Máxima proteção. Metade do orçamento normal. Pausa quando risco ≥ 25/100.',
    balanced: 'Balanceia produtividade e segurança. Orçamento normal. Pausa quando risco ≥ 55/100.',
    active:   '60% mais ações. Cooldowns mais curtos. Pausa apenas quando risco ≥ 75/100.',
  };

  function sv2BuildHourOptions(selectEl, selected) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    for (let h = 0; h <= 24; h++) {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = String(h).padStart(2,'0') + ':00';
      if (h === selected) opt.selected = true;
      selectEl.appendChild(opt);
    }
  }

  // Inicializar selects de horário
  sv2BuildHourOptions(document.getElementById('sv2WinStart'), 8);
  sv2BuildHourOptions(document.getElementById('sv2WinEnd'), 23);

  // Presets de conta
  document.querySelectorAll('.safety-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (!preset) return;
      document.querySelectorAll('.safety-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chrome.storage.local.set({ sv2_profile: preset });
      sendToIg('SET_SAFETY_PROFILE', { profile: preset }, () => {});
    });
  });

  // Modos operacionais
  document.querySelectorAll('.sv2-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (!mode) return;
      document.querySelectorAll('.sv2-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const infoEl = document.getElementById('sv2ModeInfo');
      if (infoEl) infoEl.textContent = sv2ModeInfo_texts[mode] || '';
      chrome.storage.local.set({ sv2_mode: mode });
      sendToIg('SET_SAFETY_MODE', { mode }, () => {});
      sv2UpdateThresholdMark(mode);
    });
  });

  // Salvar janela de horário
  const sv2WinSave = document.getElementById('sv2WinSave');
  if (sv2WinSave) {
    sv2WinSave.addEventListener('click', () => {
      const start = parseInt(document.getElementById('sv2WinStart')?.value || 8, 10);
      const end   = parseInt(document.getElementById('sv2WinEnd')?.value   || 23, 10);
      const hintEl = document.getElementById('sv2WindowHint');
      if (start >= end) {
        if (hintEl) { hintEl.textContent = '⚠️ Início deve ser antes do fim.'; hintEl.style.color='#E17055'; }
        return;
      }
      sendToIg('SET_SAFETY_WINDOW', { start, end }, (r) => {
        if (hintEl) {
          hintEl.textContent = `✓ Janela salva: ${String(start).padStart(2,'0')}h–${String(end).padStart(2,'0')}h`;
          hintEl.style.color = '#00B894';
        }
        chrome.storage.local.set({ sv2_window: { start, end } });
      });
    });
  }

  function sv2UpdateThresholdMark(mode) {
    const marks = { silent:25, balanced:55, active:75 };
    const pct = marks[mode] || 55;
    const mark = document.getElementById('sv2ThermMark');
    const label = document.getElementById('sv2ThermMarkLabel');
    if (mark) mark.style.left = pct + '%';
    if (label) label.textContent = 'limite: ' + pct;
  }

  // Carregar configuração salva do sv2
  try {
    const sv2data = await chrome.storage.local.get(['sv2_profile','sv2_mode','sv2_window']);
    const sv2profile = sv2data.sv2_profile || 'media';
    const sv2mode    = sv2data.sv2_mode    || 'balanced';
    const sv2win     = sv2data.sv2_window  || { start:8, end:23 };
    document.querySelectorAll('.safety-preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === sv2profile));
    document.querySelectorAll('.sv2-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === sv2mode));
    const sv2mi = document.getElementById('sv2ModeInfo');
    if (sv2mi) sv2mi.textContent = sv2ModeInfo_texts[sv2mode] || '';
    sv2BuildHourOptions(document.getElementById('sv2WinStart'), sv2win.start);
    sv2BuildHourOptions(document.getElementById('sv2WinEnd'),   sv2win.end);
    sv2UpdateThresholdMark(sv2mode);
  } catch(e){}

  
  // ===== SAFETY GUARD v2 — Função de atualização da UI =====
  function sv2UpdateSafetyUI(sf) {
    if (!sf) return;

    // Termômetro de risco
    const thermFill = document.getElementById('sv2ThermFill');
    const riskLabel = document.getElementById('sv2RiskLabel');
    const riskPct   = document.getElementById('sv2RiskPct');
    const r = sf.riskScore || 0;
    const rColor = sf.riskColor || (r < 20 ? '#00B894' : r < 45 ? '#FDCB6E' : r < 70 ? '#E17055' : '#D63031');
    const rLabel = sf.riskLabel || (r < 20 ? 'Seguro' : r < 45 ? 'Moderado' : r < 70 ? 'Elevado' : 'Crítico');
    const rEmoji = r < 20 ? '🟢' : r < 45 ? '🟡' : r < 70 ? '🟠' : '🔴';
    if (thermFill) { thermFill.style.width = Math.min(100,r) + '%'; thermFill.style.background = rColor; }
    if (riskLabel) { riskLabel.textContent = rEmoji + ' Risco ' + rLabel; riskLabel.style.color = rColor; }
    if (riskPct)   riskPct.textContent = r + '/100';

    // Marcador de limiar
    if (sf.mode) sv2UpdateThresholdMark(sf.mode);

    // Cooldown
    const cdBar  = document.getElementById('sv2CooldownBar');
    const cdText = document.getElementById('sv2CooldownText');
    const cdReason = document.getElementById('sv2CooldownReason');
    const hasCd = (sf.cooldownRemaining || 0) > 0;
    if (cdBar) cdBar.style.display = hasCd ? 'flex' : 'none';
    if (hasCd && cdText)   cdText.textContent = 'Pausa de segurança: ' + sf.cooldownRemaining + ' min';
    if (hasCd && cdReason && sf.pauseReason) cdReason.textContent = '(' + sf.pauseReason + ')';

    // Incidentes do dia
    const inc = sf.incidents || {};
    const incEl = document.getElementById('sv2Incidents');
    const hasInc = (inc.block||0) > 0 || (inc.rate_limit||0) > 0 || (inc.soft_limit||0) > 0;
    if (incEl) incEl.style.display = hasInc ? 'flex' : 'none';
    const ibEl = document.getElementById('sv2IncBlocks');
    const irEl = document.getElementById('sv2IncRate');
    const isEl = document.getElementById('sv2IncSoft');
    if (ibEl) ibEl.textContent = (inc.block||0) + ' block';
    if (irEl) irEl.textContent = (inc.rate_limit||0) + ' rate';
    if (isEl) isEl.textContent = (inc.soft_limit||0) + ' soft';

    // Orçamento
    const budUsed = document.getElementById('sv2BudgetUsed');
    const budMax  = document.getElementById('sv2BudgetMax');
    const budFill = document.getElementById('sv2BudgetFill');
    const budHint = document.getElementById('sv2BudgetHint');
    if (budUsed) budUsed.textContent = sf.budgetUsed || 0;
    if (budMax)  budMax.textContent  = sf.budgetMax  || 0;
    if (budFill) {
      const pct = sf.budgetPct || 0;
      budFill.style.width = pct + '%';
      budFill.style.background = pct < 60 ? '#00B894' : pct < 85 ? '#FDCB6E' : '#D63031';
    }
    if (budHint && sf.activeWindow) {
      const { start, end } = sf.activeWindow;
      const hoursActive = end - start;
      const rate = hoursActive > 0 ? Math.round((sf.budgetMax||0) / hoursActive * 10) / 10 : 0;
      const left = Math.max(0, (sf.budgetMax||0) - (sf.budgetUsed||0));
      if (sf.inActiveWindow) {
        budHint.textContent = 'Ritmo ideal: ~' + rate + ' pts/hora | Restam ' + Math.round(left) + ' pts hoje';
      } else {
        budHint.textContent = 'Fora do horário ativo (' + String(start).padStart(2,'0') + 'h–' + String(end).padStart(2,'0') + 'h)';
      }
    }

    // Janela de horário — status
    const winStatus = document.getElementById('sv2WindowStatus');
    if (winStatus) {
      winStatus.textContent = sf.inActiveWindow ? '🟢 Ativo agora' : '⚫ Fora do horário';
      winStatus.style.color  = sf.inActiveWindow ? '#00B894' : '#888';
    }
    if (sf.activeWindow) {
      sv2BuildHourOptions(document.getElementById('sv2WinStart'), sf.activeWindow.start);
      sv2BuildHourOptions(document.getElementById('sv2WinEnd'),   sf.activeWindow.end);
    }

    // Perfil e modo ativos
    if (sf.profile) {
      document.querySelectorAll('.safety-preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === sf.profile));
    }
    if (sf.mode) {
      document.querySelectorAll('.sv2-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === sf.mode));
      const mi = document.getElementById('sv2ModeInfo');
      if (mi) mi.textContent = sv2ModeInfo_texts[sf.mode] || '';
    }

    // Timer de desbloqueio (compatibilidade com lógica de cooldown)
    const now = Date.now();
    const candidates = [sf.cooldownUnblockAt, sf.hourlyUnblockAt, sf.dailyUnblockAt].filter(Boolean);
    const nextUnblock = candidates.filter(t => t > now).sort((a,b) => a-b)[0];
    if (cdBar && hasCd && nextUnblock) {
      // Atualizar texto do cooldown com countdown regressivo
      if (!window._sv2UnblockTick) {
        window._sv2UnblockTick = setInterval(() => {
          const rem = Math.max(0, nextUnblock - Date.now());
          const cdBarEl = document.getElementById('sv2CooldownBar');
          const cdTextEl = document.getElementById('sv2CooldownText');
          if (rem <= 0) {
            clearInterval(window._sv2UnblockTick);
            window._sv2UnblockTick = null;
            if (cdBarEl) cdBarEl.style.display = 'none';
            return;
          }
          const h = Math.floor(rem/3600000);
          const m = Math.floor((rem%3600000)/60000);
          const s = Math.floor((rem%60000)/1000);
          let txt = 'Pausa de segurança: ';
          if (h > 0) txt += h + 'h ' + m + 'min';
          else if (m > 0) txt += m + ' min ' + s + 's';
          else txt += s + 's';
          if (cdTextEl) cdTextEl.textContent = txt;
        }, 1000);
      }
    } else if (window._sv2UnblockTick && !hasCd) {
      clearInterval(window._sv2UnblockTick);
      window._sv2UnblockTick = null;
    }
  }

  startPolling();

  // ===== ABRIR / MINIMIZAR ORGANIC =====
  btnOpenIG.addEventListener('click', () => {
    chrome.tabs.query({ url: '*://*.instagram.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const tabId = tabs[0].id;
        const winId = tabs[0].windowId;
        // Enviar toggle ANTES de mudar foco (popup fecha ao perder foco)
        chrome.tabs.sendMessage(tabId, { toggleOrganic: true }, () => {
          // Após confirmar envio, ativar a aba e focar janela
          chrome.tabs.update(tabId, { active: true });
          chrome.windows.update(winId, { focused: true });
        });
      } else {
        // Aba nova: abrir e ABRIR Organic (primeira vez)
        chrome.tabs.create({ url: 'https://www.instagram.com/' }, (newTab) => {
          let cleaned = false;
          const listener = (tabId, info) => {
            if (tabId === newTab.id && info.status === 'complete') {
              cleanup();
              setTimeout(() => {
                chrome.tabs.sendMessage(newTab.id, { openOrganic: true });
              }, 2000);
            }
          };
          const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            chrome.tabs.onUpdated.removeListener(listener);
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(cleanup, 30000);
        });
      }
    });
  });

  // ===== ABRIR / MINIMIZAR IG LIST COLLECTOR (toggle) =====
  if (btnOpenCollector) {
    btnOpenCollector.addEventListener('click', () => {
      chrome.tabs.query({ url: '*://*.instagram.com/*' }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const tabId = tabs[0].id;
          const winId = tabs[0].windowId;
          chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_COLLECTOR' }, () => {
            chrome.tabs.update(tabId, { active: true });
            chrome.windows.update(winId, { focused: true });
          });
        } else {
          chrome.tabs.create({ url: 'https://www.instagram.com/' }, (newTab) => {
            let cleaned = false;
            const listener = (tabId, info) => {
              if (tabId === newTab.id && info.status === 'complete') {
                cleanup();
                setTimeout(() => {
                  chrome.tabs.sendMessage(newTab.id, { type: 'TOGGLE_COLLECTOR' });
                }, 3000);
              }
            };
            const cleanup = () => {
              if (cleaned) return;
              cleaned = true;
              chrome.tabs.onUpdated.removeListener(listener);
            };
            chrome.tabs.onUpdated.addListener(listener);
            setTimeout(cleanup, 30000);
          });
        }
      });
    });
  }

  // ===== LOGIN =====
  btnIn.addEventListener('click', async () => {
    const email = iE.value.trim(), pass = iP.value.trim();
    if (!email) return showMsg('Preencha o email', 'er');
    if (!pass) return showMsg('Preencha a senha', 'er');
    if (email.length > 254 || !EMAIL_RE.test(email)) return showMsg('Email invalido', 'er');
    if (pass.length < 6 || pass.length > 128) return showMsg('Senha invalida (6-128 caracteres)', 'er');

    btnIn.disabled = true; btnIn.innerHTML = '<span class="sp"></span> Entrando...';
    try {
      const r = await fetchHttp(`${SB}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': KEY },
        body: JSON.stringify({ email, password: pass })
      }, { timeoutMs: 15000, retries: 1, retryDelayMs: 600 });

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        let m = e.error_description || e.msg || 'Erro ' + r.status;
        if (m.includes('Invalid login')) m = 'Email ou senha incorretos';
        throw new Error(m);
      }

      const a = await r.json();
      let igId = null, igUser = null;

      try {
        const userId = encodeURIComponent(String(a.user.id || '').trim());
        const ig = await fetchHttp(`${SB}/rest/v1/ig_accounts?user_id=eq.${userId}&is_active=eq.true&select=id,ig_username&limit=1`, {
          headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + a.access_token }
        }, { timeoutMs: 12000, retries: 1, retryDelayMs: 500 });
        if (ig.ok) {
          const acc = await ig.json();
          if (acc.length) { igId = acc[0].id; igUser = acc[0].ig_username; }
        }
      } catch (e) { console.debug('[Popup] Falha ao carregar ig_account:', e?.message || e); }

      await chrome.storage.local.set({
        sb_access_token: a.access_token, sb_refresh_token: a.refresh_token,
        sb_user_id: a.user.id, sb_user_email: email, sb_ig_account_id: igId,
        sb_token_expires_at: Date.now() + (a.expires_in * 1000),
        lovable_counters: { follows: 0, unfollows: 0, likes: 0, comments: 0, blocks: 0, skips: 0, errors: 0 },
        lovable_session_start: new Date().toISOString(),
        lovable_ig_username: igUser
      });
      await chrome.storage.local.remove(['draft_email']);

      notify('TOKEN_UPDATED');
      showMsg('Conectado!', 'ok');
      const nd = await chrome.storage.local.get(null);
      loggedIn(nd);
    } catch (e) {
      showMsg(e.message, 'er');
    } finally {
      btnIn.disabled = false; btnIn.innerHTML = 'Entrar';
    }
  });

  // ===== LOGOUT =====
  btnOut.addEventListener('click', async () => {
    notify('LOGOUT');
    await chrome.storage.local.remove([
      'sb_access_token', 'sb_refresh_token', 'sb_user_id', 'sb_user_email',
      'sb_ig_account_id', 'sb_token_expires_at', 'lovable_counters',
      'lovable_session_start', 'lovable_last_profile', 'lovable_ig_username',
      'lovable_retry_queue'
    ]);
    loggedOut();
    showMsg('Desconectado', 'in');
  });

  // ===== RESET =====
  btnReset.addEventListener('click', async () => {
    const c = { follows: 0, unfollows: 0, likes: 0, comments: 0, blocks: 0, skips: 0, errors: 0 };
    await chrome.storage.local.set({
      lovable_counters: c,
      lovable_session_start: new Date().toISOString()
    });
    upC(c);
    mRate.textContent = '0'; mTotal.textContent = '0';
    notify('RESET_COUNTERS');
    showMsg('Sessao resetada', 'ok');
  });

  // ===== PERFIL =====
  btnProfile.addEventListener('click', () => {
    btnProfile.disabled = true; btnProfile.textContent = '...';
    sendToIg('FORCE_PROFILE_UPDATE', {}, (r) => {
      btnProfile.disabled = false; btnProfile.textContent = 'Atualizar Perfil';
      if (r && r.ok && r.profile) { updateProfileCard(r.profile); showMsg('Perfil atualizado!', 'ok'); }
      else showMsg('Abra o Instagram com Organic', 'in');
    });
  });

  // ===== DASHBOARD (deep-link com conta) =====
  btnDash.addEventListener('click', async () => {
    const baseUrl = cfg.DASHBOARD_URL || 'https://organicpublic.lovable.app';
    let url = baseUrl;
    try {
      const d = await chrome.storage.local.get('lovable_ig_username');
      if (d.lovable_ig_username) {
        url = `${baseUrl}/dashboard?account=${encodeURIComponent(d.lovable_ig_username)}`;
      }
    } catch (e) { /* usar URL base */ }
    chrome.tabs.create({ url });
  });
  iP.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnIn.click(); });

  // ===== MODE =====
  function updateLikeRowVisibility(mode) {
    if (likeCountRow) {
      likeCountRow.style.display = (mode === 'seguir_curtir') ? 'flex' : 'none';
    }
    var commentPanel = document.getElementById('commentModePanel');
    if (commentPanel) {
      commentPanel.style.display = (mode === 'comentar') ? 'block' : 'none';
    }
  }
  updateLikeRowVisibility(currentMode);

  modeOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      const mode = opt.dataset.mode;
      if (!mode) return;
      modeOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      currentMode = mode;
      updateLikeRowVisibility(mode);
      sendToIg('BOT_SET_MODE', { mode }, (r) => {
        if (r && r.ok) showMsg('Modo: ' + opt.querySelector('.mode-name').textContent, 'ok');
        else showMsg(r?.error || 'Falha. Organic aberto?', 'er');
      });
    });
  });

  // ===== LIKE COUNT =====
  if (likeCount) {
    likeCount.addEventListener('change', () => {
      const count = parseInt(likeCount.value) || 1;
      sendToIg('BOT_SET_LIKES', { count }, (r) => {
        if (r && r.ok) showMsg('Likes/follow: ' + count, 'ok');
      });
    });
  }

  // ===== COMMENT SETTINGS (POPUP) =====
  var btnSavePopupComments = document.getElementById('btnSavePopupComments');
  if (btnSavePopupComments) {
    btnSavePopupComments.addEventListener('click', function() {
      var maxComments = parseInt(document.getElementById('popupMaxComments').value) || 20;
      var delay = parseInt(document.getElementById('popupCommentDelay').value) || 180;
      var onlyRecent = document.getElementById('popupCommentRecent').checked;
      var variation = document.getElementById('popupCommentVariation').checked;
      var rawTemplates = document.getElementById('popupCommentTemplates').value;
      var templates = rawTemplates.split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length > 0;});

      sendToIg('BOT_SET_COMMENT_CONFIG', {
        enableAutoComments: true,
        maxCommentsPerDay: maxComments,
        minCommentDelay: delay * 1000,
        maxCommentDelay: (delay + 240) * 1000,
        commentOnlyRecent: onlyRecent,
        commentVariation: variation,
        customCommentTemplates: templates
      }, function(r) {
        var msg = document.getElementById('popupCommentSaveMsg');
        if (msg) { msg.textContent = 'Salvo!'; msg.style.opacity = '1'; setTimeout(function(){ msg.style.opacity = '0'; }, 2000); }
        if (r && r.ok) showMsg('Config de comentarios salva!', 'ok');
        else showMsg(r && r.error ? r.error : 'Falha. Organic aberto?', 'er');
      });
    });
  }

  // Load comment stats from storage
  chrome.storage.local.get(['organic_commentsDoneToday','organic_commentsDate'], function(d) {
    if (d.organic_commentsDate === new Date().toDateString()) {
      var el = document.getElementById('popupCommentsToday');
      if (el) el.textContent = d.organic_commentsDoneToday || 0;
    }
  });

  // Load saved comment config from gblOptions
  chrome.storage.local.get('gblOptions', function(d) {
    var opts = d.gblOptions || {};
    if (opts.customCommentTemplates && opts.customCommentTemplates.length > 0) {
      var el = document.getElementById('popupCommentTemplates');
      if (el) el.value = opts.customCommentTemplates.join('\n');
    }
    if (opts.maxCommentsPerDay) {
      var el = document.getElementById('popupMaxComments');
      if (el) el.value = opts.maxCommentsPerDay;
    }
    if (opts.minCommentDelay) {
      var el = document.getElementById('popupCommentDelay');
      if (el) el.value = Math.round(opts.minCommentDelay / 1000);
    }
    if (typeof opts.commentOnlyRecent !== 'undefined') {
      var el = document.getElementById('popupCommentRecent');
      if (el) el.checked = opts.commentOnlyRecent;
    }
    if (typeof opts.commentVariation !== 'undefined') {
      var el = document.getElementById('popupCommentVariation');
      if (el) el.checked = opts.commentVariation;
    }
  });

  // ===== START/STOP =====
  btnStart.addEventListener('click', () => {
    btnStart.disabled = true; btnStart.textContent = 'Iniciando...';
    sendToIg('BOT_START', {}, (r) => {
      btnStart.disabled = false; btnStart.textContent = 'Processar Fila';
      if (r && r.ok) showMsg('Fila iniciada!', 'ok');
      else showMsg(r?.error || 'Abra o Instagram com Organic', 'er');
    });
  });

  btnStop.addEventListener('click', () => {
    btnStop.disabled = true; btnStop.textContent = 'Parando...';
    sendToIg('BOT_STOP', {}, (r) => {
      btnStop.disabled = false; btnStop.textContent = 'Parar';
      if (r && r.ok) showMsg('Bot parado', 'ok');
      else showMsg(r?.error || 'Abra o Instagram com Organic', 'er');
    });
  });

  // ===== SYNC QUEUE =====
  btnSyncQueue.addEventListener('click', () => {
    btnSyncQueue.disabled = true; btnSyncQueue.textContent = '...';
    sendToIg('FORCE_QUEUE_SYNC', {}, (r) => {
      btnSyncQueue.disabled = false; btnSyncQueue.textContent = 'Sync Queue';
      if (r && r.ok) showMsg(`${r.injected || 0} targets sincronizados`, 'ok');
      else showMsg(r?.error || 'Sync falhou', 'er');
    });
  });

  // ===== SCRAPE (seção pode estar removida da UI) =====
  if (btnScrape) {
    btnScrape.addEventListener('click', () => {
      const rawUsername = (scrapeUser?.value || '').trim().replace(/\s/g, '');
      const username = sanitizeUsername(rawUsername);
      if (!username || username.length < 2) { showMsg('Digite o @perfil_alvo', 'er'); if (scrapeUser) scrapeUser.focus(); return; }
      const maxCount = Math.min(200, Math.max(1, parseInt(scrapeMax?.value, 10) || 100));

      btnScrape.disabled = true; btnScrape.innerHTML = '<span class="sp"></span> Buscando...';
      if (scrapeProgress) scrapeProgress.textContent = `Buscando seguidores de @${username}...`;

      sendToIg('BOT_SCRAPE', { username, max_count: maxCount }, (r) => {
        btnScrape.disabled = false; btnScrape.innerHTML = 'Buscar e Carregar na Fila';
        if (r && r.ok) {
          if (scrapeProgress) { scrapeProgress.textContent = `${r.count} seguidores encontrados de @${r.source}`; scrapeProgress.style.color = '#00B894'; }
          showMsg(`${r.count} seguidores carregados!`, 'ok');
        } else {
          if (scrapeProgress) { scrapeProgress.textContent = (r?.error || 'Falha. Abra o Instagram com Organic.'); scrapeProgress.style.color = '#E17055'; }
          showMsg(r?.error || 'Erro ao buscar seguidores', 'er');
        }
      });
    });
  }

  if (scrapeUser) scrapeUser.addEventListener('keydown', (e) => { if (e.key === 'Enter' && btnScrape) btnScrape.click(); });


    // ===== CALENDARIO SEMANAL =====
  const SCHED_DAYS = [
    { key: 'mon', label: 'SEG', fullLabel: 'Segunda' },
    { key: 'tue', label: 'TER', fullLabel: 'Terça' },
    { key: 'wed', label: 'QUA', fullLabel: 'Quarta' },
    { key: 'thu', label: 'QUI', fullLabel: 'Quinta' },
    { key: 'fri', label: 'SEX', fullLabel: 'Sexta' },
    { key: 'sat', label: 'SAB', fullLabel: 'Sábado' },
    { key: 'sun', label: 'DOM', fullLabel: 'Domingo' },
  ];
  const SCHED_MODES = [
    { value: 'seguir', label: 'Seguir' },
    { value: 'seguir_curtir', label: 'Follow+Like' },
    { value: 'curtir', label: 'Curtir' },
    { value: 'deixar_seguir', label: 'Unfollow' },
    { value: 'ver_story', label: 'Story' },
    { value: 'comentar', label: 'Comentar' },
    { value: 'obter_dados', label: 'Dados' },
  ];
  const JS_DAY_MAP = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
  const todayKey = JS_DAY_MAP[new Date().getDay()];

  const schedDaysContainer = document.getElementById('schedDays');
  const schedBody = document.getElementById('schedBody');
  const schedChevron = document.getElementById('schedChevron');
  const schedHeaderBtn = document.getElementById('schedHeaderBtn');
  const schedMasterToggle = document.getElementById('schedMasterToggle');
  const schedSaveBtn = document.getElementById('schedSaveBtn');
  const schedSaveMsg = document.getElementById('schedSaveMsg');
  const schedStatus = document.getElementById('schedStatus');

  // Defaults — Valores seguros baseados no preset "Conta Media"
  function schedDefaultDay() {
    return { active: false, start: '09:00', stop: '17:00', follows: 30, likes: 15, mode: 'seguir_curtir' };
  }
  function schedDefaultConfig() {
    const days = {};
    SCHED_DAYS.forEach(d => { days[d.key] = schedDefaultDay(); });
    return { enabled: false, days };
  }

  let schedConfig = schedDefaultConfig();

  // Renderizar os 7 dias
  function schedRender() {
    schedDaysContainer.innerHTML = '';
    SCHED_DAYS.forEach(dayInfo => {
      const dc = schedConfig.days[dayInfo.key] || schedDefaultDay();
      const isToday = dayInfo.key === todayKey;
      const dayEl = document.createElement('div');
      dayEl.className = 'sched-day' + (dc.active ? ' active' : '') + (isToday ? ' today' : '');
      dayEl.dataset.key = dayInfo.key;

      dayEl.innerHTML = `
        <div class="sched-day-head">
          <div class="sched-day-toggle ${dc.active ? 'on' : ''}" data-day="${dayInfo.key}" title="Ativar ${dayInfo.fullLabel}"></div>
          <span class="sched-day-name ${dc.active ? '' : 'inactive'}">${dayInfo.label}${isToday ? '*' : ''}</span>
          <div class="sched-time-group">
            <input type="time" class="sched-time-input" data-field="start" data-day="${dayInfo.key}" value="${dc.start}" ${dc.active ? '' : 'disabled'} />
            <span class="sched-time-sep">—</span>
            <input type="time" class="sched-time-input" data-field="stop" data-day="${dayInfo.key}" value="${dc.stop}" ${dc.active ? '' : 'disabled'} />
          </div>
        </div>
        <div class="sched-day-detail">
          <div class="sched-target" title="Meta de follows para ${dayInfo.fullLabel}">
            <span class="sched-target-icon">+</span>
            <input type="number" class="sched-target-input" data-field="follows" data-day="${dayInfo.key}" value="${dc.follows}" min="0" max="200" ${dc.active ? '' : 'disabled'} />
            <span class="sched-target-label">follows</span>
          </div>
          <div class="sched-target" title="Meta de likes para ${dayInfo.fullLabel}">
            <span class="sched-target-icon">&hearts;</span>
            <input type="number" class="sched-target-input" data-field="likes" data-day="${dayInfo.key}" value="${dc.likes}" min="0" max="200" ${dc.active ? '' : 'disabled'} />
            <span class="sched-target-label">likes</span>
          </div>
          <select class="sched-mode-select" data-field="mode" data-day="${dayInfo.key}" ${dc.active ? '' : 'disabled'}>
            ${SCHED_MODES.map(m => `<option value="${m.value}" ${dc.mode === m.value ? 'selected' : ''}>${m.label}</option>`).join('')}
          </select>
        </div>
      `;
      schedDaysContainer.appendChild(dayEl);
    });

    // Attach day toggle events
    schedDaysContainer.querySelectorAll('.sched-day-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const key = toggle.dataset.day;
        schedConfig.days[key].active = !schedConfig.days[key].active;
        schedRender();
      });
    });

    // Attach input change events
    schedDaysContainer.querySelectorAll('[data-field][data-day]').forEach(el => {
      el.addEventListener('change', () => {
        const key = el.dataset.day;
        const field = el.dataset.field;
        if (field === 'follows' || field === 'likes') {
          schedConfig.days[key][field] = Math.max(0, Math.min(200, parseInt(el.value, 10) || 0));
          el.value = schedConfig.days[key][field];
        } else if (field === 'start' || field === 'stop') {
          schedConfig.days[key][field] = el.value;
        } else if (field === 'mode') {
          schedConfig.days[key][field] = el.value;
        }
      });
    });

    // Update master toggle visual
    if (schedMasterToggle) {
      schedMasterToggle.classList.toggle('on', schedConfig.enabled);
    }
    // Update status text
    if (schedStatus) {
      const activeDays = SCHED_DAYS.filter(d => schedConfig.days[d.key]?.active).length;
      if (schedConfig.enabled && activeDays > 0) {
        schedStatus.textContent = 'Ativo · ' + activeDays + ' dia' + (activeDays > 1 ? 's' : '');
        schedStatus.className = 'sched-status active';
      } else {
        schedStatus.textContent = schedConfig.enabled ? 'Sem dias ativos' : 'Desativado';
        schedStatus.className = 'sched-status';
      }
    }
  }

  // Toggle abrir/fechar
  if (schedHeaderBtn) {
    schedHeaderBtn.addEventListener('click', (e) => {
      // Não fechar se clicou no master toggle
      if (e.target.closest('.sched-master-toggle')) return;
      schedBody.classList.toggle('open');
      schedChevron.classList.toggle('open');
    });
  }

  // Master toggle (ativar/desativar scheduler globalmente)
  if (schedMasterToggle) {
    schedMasterToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      schedConfig.enabled = !schedConfig.enabled;
      schedMasterToggle.classList.toggle('on', schedConfig.enabled);
      schedRender();
    });
  }

  // Salvar agenda
  if (schedSaveBtn) {
    schedSaveBtn.addEventListener('click', async () => {
      // Coletar valores atuais dos inputs (caso não tenham disparado change)
      schedDaysContainer.querySelectorAll('[data-field][data-day]').forEach(el => {
        const key = el.dataset.day;
        const field = el.dataset.field;
        if (!schedConfig.days[key]) return;
        if (field === 'follows' || field === 'likes') {
          schedConfig.days[key][field] = Math.max(0, Math.min(200, parseInt(el.value, 10) || 0));
        } else if (field === 'start' || field === 'stop') {
          schedConfig.days[key][field] = el.value;
        } else if (field === 'mode') {
          schedConfig.days[key][field] = el.value;
        }
      });

      // Validar horários: start deve ser anterior a stop nos dias ativos
      const invalidDays = [];
      SCHED_DAYS.forEach(d => {
        const dc = schedConfig.days[d.key];
        if (dc && dc.active && dc.start && dc.stop) {
          const [sh, sm] = dc.start.split(':').map(Number);
          const [eh, em] = dc.stop.split(':').map(Number);
          if ((sh * 60 + (sm || 0)) >= (eh * 60 + (em || 0))) {
            invalidDays.push(d.label);
          }
        }
      });
      if (invalidDays.length > 0) {
        showMsg(`Horário inválido em: ${invalidDays.join(', ')} (início >= fim)`, 'er');
        return;
      }

      // Salvar no storage
      await chrome.storage.local.set({ lovable_schedule: schedConfig });

      // Enviar para o content script
      sendToIg('SCHEDULE_UPDATE', { schedule: schedConfig }, (r) => {
        if (schedSaveMsg) {
          schedSaveMsg.textContent = (r && r.ok) ? 'Agenda salva!' : 'Salvo localmente';
          schedSaveMsg.classList.add('show');
          setTimeout(() => schedSaveMsg.classList.remove('show'), 2500);
        }
      });
    });
  }

  // Carregar agenda salva
  async function schedLoad() {
    try {
      const data = await chrome.storage.local.get('lovable_schedule');
      if (data.lovable_schedule && data.lovable_schedule.days) {
        // Mesclar com defaults para garantir campos completos
        const loaded = data.lovable_schedule;
        schedConfig.enabled = loaded.enabled || false;
        SCHED_DAYS.forEach(d => {
          const saved = loaded.days?.[d.key];
          if (saved) {
            const def = schedDefaultDay();
            schedConfig.days[d.key] = {
              active: saved.active || false,
              start: saved.start || def.start,
              stop: saved.stop || def.stop,
              follows: typeof saved.follows === 'number' ? saved.follows : def.follows,
              likes: typeof saved.likes === 'number' ? saved.likes : def.likes,
              mode: saved.mode || def.mode
            };
          }
        });
      }
    } catch (e) {}
    schedRender();
  }

  schedLoad();

  // ===== UI HELPERS =====
  function loggedIn(d) {
    viewOff.classList.add('hidden'); viewOn.classList.remove('hidden');
    d1.className = 'dt g'; v1.textContent = 'Conectado';
    ue.textContent = d.sb_user_email || '--';
    if (d.lovable_counters) upC(d.lovable_counters);
    if (d.lovable_last_profile) updateProfileCard(d.lovable_last_profile);
    if (d.lovable_ig_username && !d.lovable_last_profile) {
      pname.textContent = '@' + d.lovable_ig_username;
      pavatar.textContent = d.lovable_ig_username[0].toUpperCase();
      const pcardIgLink = document.getElementById('pcardIgLink');
      if (pcardIgLink) pcardIgLink.href = 'https://instagram.com/' + d.lovable_ig_username;
    }
    // Mostrar safety section (presets configuráveis mesmo sem IG aberto)
    const ss = document.getElementById('safetySection');
    if (ss) ss.style.display = 'block';
  }

  function loggedOut() {
    viewOn.classList.add('hidden'); viewOff.classList.remove('hidden');
    d1.className = 'dt r'; v1.textContent = 'Desconectado';
    d3.className = 'dt x'; v3.textContent = 'Inativo';
  }

  function updateProfileCard(p) {
    if (!p) return;
    pname.textContent = '@' + (p.username || '--');
    pavatar.textContent = (p.username || '?')[0].toUpperCase();
    pfollowers.textContent = formatNum(p.followers);
    pfollowing.textContent = formatNum(p.following);
    pposts.textContent = formatNum(p.posts);
    const psubText = document.getElementById('psubText');
    if (psubText) psubText.textContent = 'Instagram';
    // Update IG link
    const pcardIgLink = document.getElementById('pcardIgLink');
    if (pcardIgLink && p.username) pcardIgLink.href = 'https://instagram.com/' + p.username;
  }

  function upC(c) {
    document.getElementById('cF').textContent = c.follows || 0;
    document.getElementById('cU').textContent = c.unfollows || 0;
    document.getElementById('cL').textContent = c.likes || 0;
    document.getElementById('cS').textContent = c.skips || 0;
    document.getElementById('cE').textContent = c.errors || 0;
    document.getElementById('cB').textContent = c.blocks || 0;
    mTotal.textContent = (c.follows || 0) + (c.unfollows || 0) + (c.likes || 0);
  }

  function formatNum(n) {
    if (!n) return '0';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  // v7.2 — Profile card status
  function updateCardStatus(state) {
    const dot = document.getElementById('pcardDot');
    const banner = document.getElementById('pcardBanner');
    const badge = document.getElementById('pcardBadge');
    const sub = document.getElementById('psub');
    const subPing = document.getElementById('psubPing');
    if (!dot || !banner || !badge) return;
    // Reset
    dot.className = 'pcard-online-dot';
    banner.className = 'pcard-banner';
    badge.className = 'pcard-badge';
    if (sub) sub.className = 'pcard-sub';
    if (subPing) subPing.style.display = 'none';
    if (state === 'processing' || state === 'active') {
      dot.classList.add('online');
      banner.classList.add('online');
      badge.classList.add('processing');
      badge.textContent = state === 'processing' ? 'Processando' : 'Ativo';
      if (sub) sub.classList.add('online');
      if (subPing) subPing.style.display = 'inline-flex';
    } else if (state === 'paused') {
      dot.classList.add('online');
      banner.classList.add('online');
      badge.classList.add('paused');
      badge.textContent = 'Pausado';
    } else {
      badge.classList.add('offline');
      badge.textContent = 'Offline';
    }
  }

  function timeAgo(iso) {
    const d = Date.now() - new Date(iso).getTime();
    const m = Math.floor(d / 6e4);
    if (m < 1) return 'agora';
    if (m < 60) return m + 'min';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h';
    return Math.floor(h / 24) + 'd';
  }

  function showMsg(t, tp) {
    mg.textContent = t; mg.className = 'msg ' + tp;
    setTimeout(() => { mg.className = 'msg'; }, 5000);
  }

  function sendToIg(type, data, callback) {
    chrome.tabs.query({ active: true, currentWindow: true, url: '*://*.instagram.com/*' }, (activeTabs) => {
      if (activeTabs && activeTabs.length) return _sendToTab(activeTabs[0], type, data, callback);
      chrome.tabs.query({ url: '*://*.instagram.com/*' }, (allTabs) => {
        if (!allTabs || !allTabs.length) { if (callback) callback(null); return; }
        _sendToTab(allTabs[0], type, data, callback);
      });
    });
  }

  function _sendToTab(tab, type, data, callback) {
    chrome.tabs.sendMessage(tab.id, { type, ...data }, (r) => {
      if (chrome.runtime.lastError) { if (callback) callback(null); return; }
      if (callback) callback(r);
    });
  }

  async function checkStatus() {
    const d = await chrome.storage.local.get(['lovable_counters', 'lovable_last_profile']);
    if (d.lovable_counters) upC(d.lovable_counters);
    if (d.lovable_last_profile) updateProfileCard(d.lovable_last_profile);

    try {
      // Buscar aba ativa do Instagram, ou qualquer aba do Instagram se não houver ativa
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true, url: '*://*.instagram.com/*' });
      if (!tab) {
        const allIgTabs = await chrome.tabs.query({ url: '*://*.instagram.com/*' });
        tab = allIgTabs[0] || null;
      }
      if (!tab) {
        d2.className = 'dt r'; v2.textContent = 'Instagram nao aberto';
        d3.className = 'dt x'; v3.textContent = 'Inativo';
        updateCardStatus('offline');
        return;
      }

      const _rttStart = performance.now();
      chrome.tabs.sendMessage(tab.id, { type: 'GET_LOVABLE_STATUS' }, (r) => {
        const lastErr = chrome.runtime.lastError;
        if (lastErr || !r) {
          // Se o erro contém "beep beep" ou "Could not establish connection", o listener não está respondendo
          const errMsg = lastErr ? lastErr.message : 'Sem resposta';
          console.log('[Lovable:Popup] Falha ao obter status:', errMsg);
          d2.className = 'dt y'; v2.textContent = 'Inicializando...';
          if (d4) { d4.className = 'dt x'; v4.textContent = '--'; }
          return;
        }

        // Latência
        const rttMs = Math.round(performance.now() - _rttStart);
        if (d4 && v4) {
          if (rttMs < 100) { d4.className = 'dt g'; v4.textContent = rttMs + 'ms'; }
          else if (rttMs < 500) { d4.className = 'dt y'; v4.textContent = rttMs + 'ms'; }
          else { d4.className = 'dt r'; v4.textContent = rttMs + 'ms (Lento)'; }
        }

        d2.className = r.organicDetected ? 'dt g' : 'dt y';
        v2.textContent = r.organicDetected ? (r.isProcessing ? 'Processando' : 'Ativo') : 'Aguardando Organic';
        // v7.2 card status
        if (r.organicDetected) updateCardStatus(r.isProcessing ? 'processing' : 'active');
        else updateCardStatus('offline');

        if (r.connected && r.organicDetected) { d3.className = 'dt g'; v3.textContent = 'Sincronizando'; }
        else if (r.connected) { d3.className = 'dt y'; v3.textContent = 'Aguardando Organic'; }
        else { d3.className = 'dt x'; v3.textContent = 'Nao conectado'; }

        if (r.counters) upC(r.counters);
        mRate.textContent = r.actionsPerHour || 0;
        mQueue.textContent = r.retryQueueSize || 0;
        if (r.lastProfile) updateProfileCard(r.lastProfile);

        if (r.igUsername && pname.textContent === '@--') {
          pname.textContent = '@' + r.igUsername;
          pavatar.textContent = r.igUsername[0].toUpperCase();
          const pcardIgLink = document.getElementById('pcardIgLink');
          if (pcardIgLink) pcardIgLink.href = 'https://instagram.com/' + r.igUsername;
        }

        // Bot status
        gbStatusText.textContent = r.organicDetected
          ? (r.isProcessing ? 'Processando...' : 'Aguardando')
          : 'Organic nao detectado';

        // Mode sync
        if (r.currentMode && r.currentMode !== 'unknown') {
          currentMode = r.currentMode;
          modeOpts.forEach(o => o.classList.toggle('active', o.dataset.mode === r.currentMode));
          updateLikeRowVisibility(r.currentMode);
        }

        // Safety Guard v2
        if (r.safety) {
          const sf = r.safety;
          const safetySection = document.getElementById('safetySection');
          if (safetySection) safetySection.style.display = 'block';
          sv2UpdateSafetyUI(sf);
        }

                if (r.lastSyncTime) {
          syncInfo.textContent = 'Ultima sync: ' + timeAgo(r.lastSyncTime);
          // Detalhes de sync
          if (syncWrites) syncWrites.textContent = (r.writeCount || 0) + ' escritas';
          if (r.writeErrors && r.writeErrors > 0) {
            if (syncErrors) syncErrors.textContent = r.writeErrors + ' erros';
            if (syncErrDot) syncErrDot.style.display = '';
          } else {
            if (syncErrors) syncErrors.textContent = '';
            if (syncErrDot) syncErrDot.style.display = 'none';
          }
          if (r.retryQueueSize && r.retryQueueSize > 0) {
            if (syncRetryInfo) syncRetryInfo.style.display = '';
            if (syncRetry) syncRetry.textContent = r.retryQueueSize + ' retry';
          } else {
            if (syncRetryInfo) syncRetryInfo.style.display = 'none';
          }
        }


        // Mini-barra scheduler (abaixo do header)
        if (schedMini) {
          if (r.scheduleEnabled && r.scheduleTodayConfig?.active && r.scheduleDaily) {
            const todayCfg = r.scheduleTodayConfig;
            const daily = r.scheduleDaily;
            const mode = todayCfg.mode || 'seguir_curtir';
            const isUnfollow = (mode === 'deixar_seguir');
            let done, target, label;
            if (isUnfollow) {
              done = daily.unfollows || 0;
              target = todayCfg.follows || 0;
              label = `Unfollow: ${done}/${target}`;
            } else {
              done = (daily.follows || 0) + (daily.likes || 0);
              target = (todayCfg.follows || 0) + (todayCfg.likes || 0);
              label = `${daily.follows || 0}/${todayCfg.follows || 0}F + ${daily.likes || 0}/${todayCfg.likes || 0}L`;
            }
            schedMini.style.display = 'flex';
            if (schedMiniText) schedMiniText.textContent = label;
            const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
            if (schedMiniFill) schedMiniFill.style.width = pct + '%';
          } else {
            schedMini.style.display = 'none';
          }
        }

        // Atualizar status do scheduler no calendário
        if (schedStatus) {
          if (r.scheduleEnabled) {
            const todayCfg = r.scheduleTodayConfig;
            const daily = r.scheduleDaily;
            if (todayCfg && todayCfg.active && daily) {
              const mode = todayCfg.mode || 'seguir_curtir';
              const isUnfollowMode = (mode === 'deixar_seguir');
              if (isUnfollowMode) {
                const uDone = daily.unfollows || 0;
                const uTarget = todayCfg.follows || 0; // meta de follows usada como meta de unfollows
                schedStatus.textContent = `Hoje: ${uDone}/${uTarget}U`;
                schedStatus.className = 'sched-status active';
              } else {
                const fDone = daily.follows || 0;
                const lDone = daily.likes || 0;
                const fTarget = todayCfg.follows || 0;
                const lTarget = todayCfg.likes || 0;
                schedStatus.textContent = `Hoje: ${fDone}/${fTarget}F · ${lDone}/${lTarget}L`;
                schedStatus.className = 'sched-status active';
              }
            } else {
              schedStatus.textContent = 'Ativo · Dia sem agendamento';
              schedStatus.className = 'sched-status';
            }
          }
        }
      });
    } catch (e) {
      console.debug('[Popup] checkStatus falhou:', e?.message || e);
    }
  }

  function notify(type) {
    chrome.tabs.query({ url: '*://*.instagram.com/*' }, (tabs) => {
      for (const t of tabs) chrome.tabs.sendMessage(t.id, { type }).catch(() => {});
    });
  }

  async function runPoll() {
    if (pollRunning) return;
    pollRunning = true;
    try { await checkStatus(); } finally {
      pollRunning = false;
      schedulePoll();
    }
  }

  function schedulePoll() {
    if (pollTimer) clearTimeout(pollTimer);
    const delay = document.hidden ? POLL_HIDDEN : POLL_ACTIVE;
    pollTimer = setTimeout(runPoll, delay);
  }

  function startPolling() {
    runPoll();
    document.addEventListener('visibilitychange', schedulePoll);
  }
});
