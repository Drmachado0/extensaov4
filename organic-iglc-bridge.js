/**
 * Organic — Bridge Script
 * 
 * Este script conecta o IG List Collector ao Organic.
 * Carregado APÓS ambos os scripts, acessa as globais do Organic
 * (acctsQueue, arrayOfUsersToDiv, saveQueueToStorage, updateCount)
 * e expõe funções de ponte para o Collector (que roda dentro de uma IIFE).
 * 
 * Funções globais expostas:
 *   _iglcPushToOrganic(accounts)  — Injeta contas na fila do Organic
 *   _iglcTogglePanel()            — Abre/fecha o painel do Collector
 *   _iglcIsOrganicAvailable()     — Verifica se o Organic está carregado
 */

// ═══════════════════════════════════════════════════════
// BRIDGE: IG List Collector → Organic Queue
// ═══════════════════════════════════════════════════════

/**
 * Verifica se o Organic está carregado e pronto para receber contas.
 * @returns {boolean}
 */
function _iglcIsOrganicAvailable() {
  return (typeof acctsQueue !== 'undefined' && Array.isArray(acctsQueue) &&
          typeof arrayOfUsersToDiv === 'function');
}

/**
 * Injeta uma lista de contas diretamente na fila (acctsQueue) do Organic.
 * Chama arrayOfUsersToDiv() para renderizar, updateCount() para atualizar
 * o contador, e saveQueueToStorage() para persistir.
 * 
 * @param {Array} accounts — Array de objetos de conta (compatível com Organic)
 * @param {boolean} [replace=false] — Se true, substitui a fila inteira. Se false, adiciona ao final.
 * @returns {boolean} true se conseguiu injetar, false se Organic não disponível
 */
function _iglcPushToOrganic(accounts, replace) {
  if (!_iglcIsOrganicAvailable()) return false;
  if (!Array.isArray(accounts) || accounts.length === 0) return false;

  try {
    if (replace) {
      // Substituir a fila inteira
      acctsQueue.length = 0;
    }

    for (var i = 0; i < accounts.length; i++) {
      var acct = accounts[i];
      // Garantir estrutura mínima compatível com Organic
      if (!acct.username && !acct.id) continue;
      acctsQueue.push(acct);
    }

    // Renderizar a fila na UI do Organic
    if (typeof arrayOfUsersToDiv === 'function') {
      arrayOfUsersToDiv(acctsQueue, true);
    }

    // Atualizar o contador de contas
    if (typeof updateCount === 'function') {
      updateCount();
    }

    // Persistir no chrome.storage.local
    if (typeof saveQueueToStorage === 'function') {
      saveQueueToStorage();
    }

    // Log no console do Organic
    if (typeof printMessage === 'function') {
      printMessage('[IG List Collector] ' + accounts.length + ' contas carregadas na fila');
    }

    console.log('[IGLC Bridge] ' + accounts.length + ' contas injetadas na fila do Organic (total: ' + acctsQueue.length + ')');
    return true;
  } catch (e) {
    console.error('[IGLC Bridge] Erro ao injetar contas:', e);
    return false;
  }
}

/**
 * Abre ou fecha o painel do IG List Collector.
 * Usa apenas a classe "hidden" (CSS transform) para manter consistência com collector.js.
 */
function _iglcTogglePanel() {
  var panel = document.getElementById('igListCollectorPanel');
  if (panel) {
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  }
}

/**
 * Abre o painel do IG List Collector (sem toggle).
 */
function _iglcOpenPanel() {
  var panel = document.getElementById('igListCollectorPanel');
  if (panel) {
    panel.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════════════════
// INJEÇÃO DE BOTÃO NO ORGANIC
// ═══════════════════════════════════════════════════════

/**
 * Espera o Organic carregar e injeta um botão "IG List Collector"
 * no menu "Load Accounts" do Organic.
 */
function _iglcInjectOrganicButton() {
  var maxAttempts = 60;
  var attempts = 0;

  function tryInject() {
    attempts++;
    var btnLoadSaved = document.getElementById('btnLoadSavedQueue');
    if (!btnLoadSaved) {
      if (attempts < maxAttempts) {
        setTimeout(tryInject, 2000);
      }
      return;
    }

    // Verificar se já foi injetado
    if (document.getElementById('btnIGLCCollector')) return;

    // Criar botão
    var btn = document.createElement('div');
    btn.className = 'igBotInjectedButton flex7';
    btn.id = 'btnIGLCCollector';
    btn.title = 'Abrir o IG List Collector para coletar listas de seguidores/seguindo e carregar diretamente na fila do Organic';
    btn.textContent = '\uD83D\uDCCB IG List Collector';
    btn.style.cssText = 'background: linear-gradient(135deg, #6C5CE7, #A855F7); color: #fff; font-weight: 600; margin-top: 4px; border: none;';
    
    btn.addEventListener('click', function () {
      _iglcOpenPanel();
    });

    // Inserir após o botão "Load Queue"
    btnLoadSaved.parentNode.insertBefore(btn, btnLoadSaved.nextSibling);

    console.log('[IGLC Bridge] Botão "IG List Collector" injetado no Organic');
  }

  tryInject();
}

// ═══════════════════════════════════════════════════════
// LISTENER PARA MENSAGENS DO POPUP
// ═══════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === 'TOGGLE_COLLECTOR') {
    sendResponse({ ok: true });
    return true;
  }
  if (request.type === 'OPEN_COLLECTOR') {
    _iglcOpenPanel();
    sendResponse({ ok: true });
    return true;
  }
});

// ═══════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════

// Aguardar DOM estar pronto e injetar o botão no Organic
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _iglcInjectOrganicButton);
} else {
  // DOM já carregado, mas Organic pode ainda não ter injetado a UI.
  // Usar setTimeout para dar tempo ao Organic renderizar.
  setTimeout(_iglcInjectOrganicButton, 1000);
}

console.log('[IGLC Bridge] Bridge script carregado. Organic disponível:', _iglcIsOrganicAvailable());
