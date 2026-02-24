# Organic Automator 8.1.1 for Instagram™

Extensão para Chrome/Edge (Manifest V3) que integra automação no Instagram (filas de follow/unfollow, curtir, stories, filtros, etc.) com o painel Lovable e o IG List Collector.

## Versão final — pronta para uso e teste

Esta versão foi revisada e ajustada para:

- **Sem bloqueio por trial/assinatura**: a extensão trata sempre como licenciada; não exibe "Subscribe Now" nem tela de compra.
- **Interface limpa**: mensagem de trial e link de subscribe removidos do cabeçalho.
- **Correções**: id duplicado em Settings (Removing and Blocking Options) corrigido; uso de `chrome.runtime.sendMessage` em vez da API deprecada.
- **Ícones**: incluídos ícones mínimos (16, 48, 128 px) para a extensão carregar corretamente.

### Revisão do sistema (correções e melhorias)

- **IG List Collector**: scroll corrigido (altura máxima da área rolável + roda do mouse); painel abre/fecha em sintonia com o popup e o bridge (classe `hidden` apenas); proteção contra elementos nulos em filtros e configurações.
- **Bridge (Organic ↔ Collector)**: abertura/fechamento do painel usa só a classe `hidden`, sem alterar `display`, evitando estado inconsistente.
- **Mensagens**: o collector escuta `OPEN_COLLECTOR` e `TOGGLE_COLLECTOR` além de `toggleCollector`, para o botão do popup funcionar corretamente.
- **UX**: barra de rolagem do painel com hover; `saveSettings` com checagens de elementos.

## Requisitos

- Navegador baseado em Chromium (Chrome, Edge, Brave, etc.)
- Conta no Instagram (logada no mesmo navegador)
- Para o painel Lovable: conta no dashboard (organicpublic.lovable.app)

## Instalação (modo desenvolvedor)

1. Abra o navegador e vá a:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
2. Ative **Modo do programador** (canto superior direito).
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta do projeto: `organic-v7.2-final - Copia`.
5. A extensão deve aparecer na barra de ferramentas (ícone do Organic).

Se aparecer erro por ícones, confirme que existem na pasta raiz:

- `icon_16.png`
- `icon_48.png`
- `icon_128.png`

(Se quiser ícones melhores, substitua por PNGs 16×16, 48×48 e 128×128.)

## Como usar

1. **Abrir o Instagram**  
   Acesse https://www.instagram.com e faça login.

2. **Abrir o Organic na página**  
   - Clique no ícone da extensão na barra de ferramentas para abrir o popup (Organic + Lovable).  
   - No popup, use **「Abrir Instagram + Organic」** para abrir/focar uma aba do Instagram e mostrar o painel do Organic na página.  
   - Ou use o atalho/ação configurada para alternar a visibilidade do painel.

3. **Fluxo básico**  
   - **Accounts Queue**: carregar contas (Load Accounts → ex.: Load Current Page's Followers, Load Likers, Load Queue, etc.).  
   - Ajustar **Filters** se quiser (seguidores, seguindo, ratio, etc.).  
   - Em **Process Queue** escolher a ação (Follow, Unfollow, Like Only, etc.) e clicar em **Process Queue**.  
   - Acompanhar o **Log** e o status no topo.

4. **Media Queue**  
   Para curtir publicações: carregar posts (Load Posts from Feed, Load This Post, etc.), depois **Like Media Queue Posts** ou ações equivalentes.

5. **Settings**  
   Configure tempos de espera, opções de follow/unfollow, colunas da fila, etc.

6. **Lovable (opcional)**  
   No popup, faça login no dashboard Lovable para sincronizar filas, limites de segurança e agendamento.

## Estrutura principal

| Item              | Descrição |
|-------------------|-----------|
| `manifest.json`   | Configuração da extensão (Manifest V3) |
| `organic.html`   | Markup do painel injetado no Instagram |
| `contentscript.js` | Lógica principal do Organic na página |
| `backgroundscript.js` | Service worker (mensagens, licença, abas) |
| `lovable-popup.html` / `lovable-popup.js` | Popup Organic + Lovable |
| `collector.js` / `collector.css` | IG List Collector |
| `organic-iglc-bridge.js` | Ponte entre Organic e Collector |
| `_locales/`      | Traduções (en, pt_BR, pt_PT, es) |

## Testes recomendados

1. Carregar a extensão em `chrome://extensions` e verificar que não há erros.
2. Abrir https://www.instagram.com e confirmar que o painel do Organic aparece ao usar o botão do popup.
3. Testar **Load** (ex.: Load Current Page's Followers) numa página de perfil.
4. Testar **Process Queue** com uma ação simples (ex.: Follow ou Like Only) com poucos itens.
5. Ver **Settings** e **Filters** e alterar opções para garantir que não há erros de consola.
6. Se usar Lovable: login no popup e verificar sincronização de fila/contadores.

## Sistema de segurança (prevenção de rate limit)

- **LovableSafety (Safety Guard)**: antes de cada ação (seguir, deixar de seguir, curtir), o Organic chama `canProceed()`. Se o limite por hora/dia, cooldown ou “calor” diário estiver ativo, a ação é adiada automaticamente.
- **429 / 403 / 400**: cada resposta de rate limit ou bloqueio é registrada em `recordAction()`; o calor sobe e, após N ocorrências, um cooldown escalado é aplicado (bot pausa).
- **403 (soft)** e **429**: tratados de forma distinta — 403 adiciona calor moderado; 429 conta como rate limit e pode disparar cooldown. Delay padrão após 429 aumentado para 2 min.
- **Delay entre ações**: quando o Safety Guard está ativo, o intervalo entre ações usa no mínimo o `getRecommendedDelay()` (que sobe com calor, proximidade do limite e horário noturno).
- **Presets (nova / média / madura)**: no popup, escolher o preset aplica limites e delays alinhados ao Safety Guard e ao Organic.

## Observações

- **Limites do Instagram**: use delays e filtros adequados para reduzir risco de bloqueios; as opções em Settings e o Safety Guard no Lovable ajudam.
- **Re-link Subscription**: a opção em Settings permanece disponível para quem tiver assinatura no site oficial; não é obrigatória para uso local.
- **Versão**: 7.2.0 (manifest); o popup Lovable pode mostrar outra versão (ex.: 2.5.0) referente ao painel.

---

**Organic Automator for Instagram™** — versão final revisada para uso e teste local.
