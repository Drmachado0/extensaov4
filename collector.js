/**
 * IG List Collector v1.3 (Integrado ao Organic)
 * Módulo de coleta de listas do Instagram
 * Exporta diretamente para a fila do Organic via bridge
 * 
 * v1.3 — Integração Organic + List Reader/Organizer + security fixes
 */

(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════
  let panelVisible = false;
  let collecting = false;
  let paused = false;
  let acctsQueue = [];
  let currentProfilePage = null;
  let user = null;
  let collectType = "";
  let rateLimitCountdown = 0;
  let rateLimitTimer = null;
  let totalEstimated = 0;
  let startTime = 0;
  let pagesLoaded = 0;
  let profileDetectAttempts = 0;

  // Reader state
  let readerData = [];
  let readerFiltered = [];
  let readerPage = 0;
  const READER_PAGE_SIZE = 50;
  let readerSort = { field: "username", dir: "asc" };
  let readerSearch = "";
  let readerTypeFilter = "all";
  let readerFileName = "";
  let currentView = "collector";

  const ITEMS_PER_PAGE = 48;

  let settings = {
    delayBetweenRequests: 2000,
    delayAfter429: 120000,
    delayAfter403: 600000,
    maxRetries: 5,
    autoExportOnDone: false,
    exportFormat: "json",
    maxAccounts: 0,
    notifyDesktop: true,
    notifySound: true,
    notifyEmail: false,
    notifyEmailAddress: "",
    notifyWebhook: false,
    notifyWebhookUrl: "",
    autoSendOrganic: true,
  };

  var filters = {
    removePrivate: false,
    removePublic: false,
    removeVerified: false,
    removeNonVerified: false,
    removeNoProfilePic: false,
    removeNoPosts: false,
    usernameContains: "",
    usernameNotContains: "",
    fullnameContains: "",
    fullnameNotContains: "",
    followersMin: 0,
    followersMax: 0,
    followingMin: 0,
    followingMax: 0,
    removeDuplicates: true,
  };

  var preFilterCount = 0;

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════
  function getCsrfToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : "";
  }

  function logTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
  }

  function log(msg, type = "info") {
    const logEl = document.getElementById("iglc-log");
    if (!logEl) return;
    const entry = document.createElement("div");
    entry.className = "iglc-log-entry " + type;
    entry.innerHTML = '<span class="iglc-log-time">' + logTime() + "</span>" + escapeHtml(msg);
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
    while (logEl.children.length > 200) logEl.removeChild(logEl.firstChild);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatNumber(n) {
    if (n == null) return "?";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return h + "h " + (m % 60) + "m";
    if (m > 0) return m + "m " + (s % 60) + "s";
    return s + "s";
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getProfileFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/^\/([^\/]+)\/?$/);
    if (match && !["explore", "reels", "stories", "direct", "accounts", "p", "tv", "lite"].includes(match[1])) {
      return match[1];
    }
    return null;
  }

  function getHashtagFromUrl() {
    const match = window.location.pathname.match(/\/explore\/tags\/([^\/]+)/);
    return match ? match[1] : "";
  }

  function getLocationFromUrl() {
    const match = window.location.pathname.match(/\/explore\/locations\/([^\/]+)/);
    return match ? match[1] : "";
  }

  function parseCompactNumber(text) {
    if (!text) return 0;
    text = text.replace(/,/g, ".").trim().toLowerCase();
    if (text.includes("m") && !text.includes("mil")) {
      return Math.round(parseFloat(text.replace(/[^0-9.,]/g, "").replace(",", ".")) * 1000000);
    }
    if (text.includes("k") || text.includes("mil")) {
      return Math.round(parseFloat(text.replace(/[^0-9.,]/g, "").replace(",", ".")) * 1000);
    }
    const cleaned = text.replace(/[^0-9]/g, "");
    return parseInt(cleaned) || 0;
  }

  // ═══════════════════════════════════════════════════════
  // PROFILE DETECTION — ZERO API CALLS
  // ═══════════════════════════════════════════════════════

  function deepFind(obj, predicate, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 15) return null;
    if (predicate(obj)) return obj;
    if (obj && typeof obj === "object") {
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        try {
          var result = deepFind(obj[keys[i]], predicate, depth + 1);
          if (result) return result;
        } catch (e) {}
      }
    }
    return null;
  }

  function normalizeProfileData(raw, username) {
    var profile = {
      id: String(raw.id || raw.pk || ""),
      username: raw.username || username,
      full_name: raw.full_name || "",
      profile_pic_url: raw.profile_pic_url || raw.profile_pic_url_hd || "",
      profile_pic_url_hd: raw.profile_pic_url_hd || raw.profile_pic_url || "",
      is_verified: !!raw.is_verified,
      is_private: !!raw.is_private,
      edge_followed_by: raw.edge_followed_by || { count: raw.follower_count || 0 },
      edge_follow: raw.edge_follow || { count: raw.following_count || 0 },
    };
    if (typeof profile.edge_followed_by === "number") profile.edge_followed_by = { count: profile.edge_followed_by };
    if (typeof profile.edge_follow === "number") profile.edge_follow = { count: profile.edge_follow };
    return profile;
  }

  // Strategy 1: Extract from embedded <script type="application/json"> tags
  function tryExtractFromPageScripts(username) {
    try {
      var scripts = document.querySelectorAll('script[type="application/json"]');
      for (var s = 0; s < scripts.length; s++) {
        try {
          var raw = scripts[s].textContent;
          if (!raw || raw.indexOf(username) === -1) continue;
          var data = JSON.parse(raw);
          var profile = deepFind(data, function (obj) {
            return obj && typeof obj === "object" && obj.username === username && (obj.edge_followed_by || obj.follower_count) && (obj.id || obj.pk);
          });
          if (profile) return normalizeProfileData(profile, username);
        } catch (e) {}
      }

      // Also try plain script tags
      var allScripts = document.querySelectorAll("script:not([src])");
      for (var s2 = 0; s2 < allScripts.length; s2++) {
        try {
          var raw2 = allScripts[s2].textContent;
          if (!raw2 || raw2.indexOf(username) === -1) continue;
          if (raw2.indexOf("edge_followed_by") === -1 && raw2.indexOf("follower_count") === -1) continue;
          // Try to find user_id pattern
          var idMatch = raw2.match(/"user_id"\s*:\s*"(\d+)"/);
          var pkMatch = raw2.match(/"pk"\s*:\s*"?(\d+)"?/);
          var followerMatch = raw2.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
          var followingMatch = raw2.match(/"edge_follow"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
          var followerMatch2 = raw2.match(/"follower_count"\s*:\s*(\d+)/);
          var followingMatch2 = raw2.match(/"following_count"\s*:\s*(\d+)/);
          
          var userId = (idMatch && idMatch[1]) || (pkMatch && pkMatch[1]) || "";
          var followers = (followerMatch && parseInt(followerMatch[1])) || (followerMatch2 && parseInt(followerMatch2[1])) || 0;
          var following = (followingMatch && parseInt(followingMatch[1])) || (followingMatch2 && parseInt(followingMatch2[1])) || 0;
          
          if (userId || followers > 0) {
            return {
              id: userId,
              username: username,
              full_name: "",
              profile_pic_url: "",
              profile_pic_url_hd: "",
              is_verified: false,
              is_private: false,
              edge_followed_by: { count: followers },
              edge_follow: { count: following },
              _source: "script_regex",
            };
          }
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  // Strategy 2: Extract from _sharedData (via winvars.js localStorage)
  function tryExtractFromSharedData(username) {
    try {
      var raw = localStorage.getItem("winvars");
      if (!raw) return null;
      var sharedData = JSON.parse(raw);
      if (sharedData.config && sharedData.config.viewer) user = sharedData.config.viewer;
      if (sharedData.entry_data && sharedData.entry_data.ProfilePage) {
        var profilePage = sharedData.entry_data.ProfilePage[0];
        if (profilePage && profilePage.graphql && profilePage.graphql.user) {
          var u = profilePage.graphql.user;
          if (u.username === username) return normalizeProfileData(u, username);
        }
      }
    } catch (e) {}
    return null;
  }

  // Strategy 3: Scrape from visible DOM elements (zero API calls)
  function tryExtractFromDOM(username) {
    try {
      var followers = null, following = null, fullName = "", profilePic = "";
      var isVerified = false, isPrivate = false, userId = null;

      // Meta tags
      var metaDesc = document.querySelector('meta[property="og:description"]');
      if (metaDesc) {
        var desc = metaDesc.content || "";
        var fMatch = desc.match(/([\d,.]+[KkMm]?)\s*(Followers|seguidores|Seguidores)/i);
        var gMatch = desc.match(/([\d,.]+[KkMm]?)\s*(Following|seguindo|Seguindo)/i);
        if (fMatch) followers = parseCompactNumber(fMatch[1]);
        if (gMatch) following = parseCompactNumber(gMatch[1]);
      }

      // Stat links
      var statLinks = document.querySelectorAll('a[href*="/followers"], a[href*="/following"]');
      for (var i = 0; i < statLinks.length; i++) {
        var link = statLinks[i];
        var text = link.textContent || "";
        var titleAttr = link.title || "";
        var href = link.getAttribute("href") || "";
        if (href.indexOf("/followers") > -1) {
          if (titleAttr) followers = parseCompactNumber(titleAttr);
          else { var num = text.match(/([\d,.]+[KkMm]?)/); if (num) followers = parseCompactNumber(num[1]); }
        }
        if (href.indexOf("/following") > -1) {
          if (titleAttr) following = parseCompactNumber(titleAttr);
          else { var num2 = text.match(/([\d,.]+[KkMm]?)/); if (num2) following = parseCompactNumber(num2[1]); }
        }
      }

      // Stat items in header
      if (followers === null || following === null) {
        var statItems = document.querySelectorAll("header ul li, header section ul li");
        for (var j = 0; j < statItems.length; j++) {
          var itemText = statItems[j].textContent || "";
          if (itemText.match(/follower|seguidor/i) && followers === null) {
            var n1 = itemText.match(/([\d,.]+[KkMm]?)/);
            if (n1) followers = parseCompactNumber(n1[1]);
          }
          if (itemText.match(/following|seguindo/i) && following === null) {
            var n2 = itemText.match(/([\d,.]+[KkMm]?)/);
            if (n2) following = parseCompactNumber(n2[1]);
          }
        }
      }

      // Profile pic
      var picEl = document.querySelector('header img');
      if (picEl) profilePic = picEl.src;

      // Full name from page title
      var pageTitle = document.title || "";
      if (pageTitle.indexOf("(") > -1) {
        var ftMatch = pageTitle.match(/^(.+?)\s*\(/);
        if (ftMatch) fullName = ftMatch[1].trim();
      }

      // Verified badge
      isVerified = !!document.querySelector('header svg[aria-label="Verified"], header [title="Verified"]');

      // Private
      var bodyText = document.body.innerText || "";
      isPrivate = bodyText.indexOf("This account is private") > -1 || bodyText.indexOf("Esta conta é privada") > -1 || bodyText.indexOf("esta conta é privada") > -1;

      // User ID from page source
      var pageSource = document.documentElement.innerHTML;
      var idM1 = pageSource.match(/"profilePage_(\d+)"/);
      if (idM1) userId = idM1[1];
      if (!userId) { var idM2 = pageSource.match(/"user_id"\s*:\s*"(\d+)"/); if (idM2) userId = idM2[1]; }
      if (!userId) { var idM3 = pageSource.match(/"owner"\s*:\s*\{\s*"id"\s*:\s*"(\d+)"/); if (idM3) userId = idM3[1]; }

      if (followers !== null || following !== null || userId) {
        return {
          id: userId || "",
          username: username,
          full_name: fullName,
          profile_pic_url: profilePic,
          profile_pic_url_hd: profilePic,
          is_verified: isVerified,
          is_private: isPrivate,
          edge_followed_by: { count: followers || 0 },
          edge_follow: { count: following || 0 },
          _source: "dom",
        };
      }
    } catch (e) {}
    return null;
  }

  // Strategy 4: API call (ONLY when user explicitly clicks)
  async function tryFetchFromAPI(username) {
    try {
      var url = "https://i.instagram.com/api/v1/users/web_profile_info/?username=" + username;
      var resp = await fetch(url, {
        headers: { "x-ig-app-id": "936619743392459", "x-requested-with": "XMLHttpRequest" },
        credentials: "include",
      });
      if (resp.status === 429 || resp.status === 403) {
        log("API rate limited (" + resp.status + "). Use dados da página ou aguarde.", "warn");
        return null;
      }
      if (!resp.ok) {
        log("API retornou " + resp.status, "warn");
        return null;
      }
      var data = await resp.json();
      return data.data.user;
    } catch (e) { return null; }
  }

  // Main detection — NO API calls
  async function detectProfile() {
    var username = getProfileFromUrl();
    if (!username) {
      updateProfileDisplay(null);
      return;
    }

    profileDetectAttempts++;
    log("Detectando @" + username + " via página (sem API)...", "info");

    // Strategy 1
    var profile = tryExtractFromPageScripts(username);
    if (profile) {
      log("Perfil via page scripts: @" + profile.username + (profile.id ? " (ID:" + profile.id + ")" : ""), "success");
      currentProfilePage = profile;
      updateProfileDisplay(profile);
      return;
    }

    // Strategy 2
    profile = tryExtractFromSharedData(username);
    if (profile) {
      log("Perfil via sharedData: @" + profile.username, "success");
      currentProfilePage = profile;
      updateProfileDisplay(profile);
      return;
    }

    // Strategy 3
    profile = tryExtractFromDOM(username);
    if (profile) {
      var src = profile.id ? "DOM (ID:" + profile.id + ")" : "DOM (sem ID)";
      log("Perfil via " + src + ": @" + profile.username, profile.id ? "success" : "warn");
      currentProfilePage = profile;
      updateProfileDisplay(profile);
      return;
    }

    // If page might not be fully loaded yet, retry once after delay
    if (profileDetectAttempts <= 2) {
      log("Página pode não estar carregada. Tentando novamente em 2s...", "info");
      setTimeout(detectProfile, 2000);
      return;
    }

    log("Não detectado da página. Use API (1 req) ou Manual.", "warn");
    updateProfileDisplay(null, username);
  }

  async function refreshProfileFromAPI() {
    var username = getProfileFromUrl();
    if (!username) { log("Navegue até um perfil.", "warn"); return; }
    log("Buscando @" + username + " via API...", "info");
    var profile = await tryFetchFromAPI(username);
    if (profile) {
      log("Perfil via API: @" + profile.username + " (ID:" + profile.id + ")", "success");
      currentProfilePage = profile;
      updateProfileDisplay(profile);
    } else {
      log("API indisponível. Tente mais tarde ou use Manual.", "error");
    }
  }

  function manualProfileEntry() {
    var input = prompt("Digite username (e opcionalmente ID):\nExemplo: neymarjr\nOu: neymarjr,12345678");
    if (!input) return;
    var parts = input.split(",");
    var username = parts[0].trim().replace("@", "");
    var id = parts[1] ? parts[1].trim() : "";
    currentProfilePage = {
      id: id, username: username, full_name: "", profile_pic_url: "", profile_pic_url_hd: "",
      is_verified: false, is_private: false,
      edge_followed_by: { count: 0 }, edge_follow: { count: 0 }, _manual: true,
    };
    log("Perfil manual: @" + username + (id ? " (ID:" + id + ")" : " (sem ID)"), "info");
    updateProfileDisplay(currentProfilePage);
  }

  async function ensureProfileId(profile) {
    if (profile.id) return profile;
    log("Buscando ID de @" + profile.username + " via API...", "info");
    var apiProfile = await tryFetchFromAPI(profile.username);
    if (apiProfile) {
      Object.assign(profile, apiProfile);
      updateProfileDisplay(profile);
      return profile;
    }
    throw new Error("Não foi possível obter ID. API em rate limit. Tente mais tarde ou use entrada Manual com ID.");
  }

  // ═══════════════════════════════════════════════════════
  // INSTAGRAM API — COLLECTION ENDPOINTS
  // ═══════════════════════════════════════════════════════
  async function fetchFollowersPage(userId, after) {
    var vars = { id: userId, first: ITEMS_PER_PAGE };
    if (after) vars.after = after;
    var url = "https://www.instagram.com/graphql/query/?query_hash=7dd9a7e2160524fd85f50317462cff9f&variables=" + encodeURIComponent(JSON.stringify(vars));
    var resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) { var err = new Error("HTTP " + resp.status); err.status = resp.status; throw err; }
    var data = await resp.json();
    return data.data.user.edge_followed_by;
  }

  async function fetchFollowingPage(userId, after) {
    var vars = { id: userId, first: ITEMS_PER_PAGE };
    if (after) vars.after = after;
    var url = "https://www.instagram.com/graphql/query/?query_hash=c56ee0ae1f89cdbd1c89e2bc6b8f3d18&variables=" + encodeURIComponent(JSON.stringify(vars));
    var resp = await fetch(url, { credentials: "include" });
    if (!resp.ok) { var err = new Error("HTTP " + resp.status); err.status = resp.status; throw err; }
    var data = await resp.json();
    return data.data.user.edge_follow;
  }

  async function fetchHashtagPosts(hashtag, maxId) {
    var body = new URLSearchParams();
    if (maxId) body.append("max_id", maxId);
    body.append("tab", "recent");
    var resp = await fetch("https://i.instagram.com/api/v1/tags/" + hashtag + "/sections/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Csrftoken": getCsrfToken(), "x-ig-app-id": "936619743392459" },
      credentials: "include", body: body.toString(),
    });
    if (!resp.ok) { var err = new Error("HTTP " + resp.status); err.status = resp.status; throw err; }
    return await resp.json();
  }

  async function fetchLocationPosts(locationId, maxId) {
    var body = new URLSearchParams();
    if (maxId) body.append("max_id", maxId);
    body.append("tab", "recent");
    var resp = await fetch("https://www.instagram.com/api/v1/locations/" + locationId + "/sections/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Csrftoken": getCsrfToken(), "x-ig-app-id": "936619743392459" },
      credentials: "include", body: body.toString(),
    });
    if (!resp.ok) { var err = new Error("HTTP " + resp.status); err.status = resp.status; throw err; }
    return await resp.json();
  }

  async function fetchPostLikers(mediaId) {
    var resp = await fetch("https://www.instagram.com/api/v1/media/" + mediaId + "/likers/", {
      headers: { "x-ig-app-id": "936619743392459", "x-requested-with": "XMLHttpRequest" },
      credentials: "include",
    });
    if (!resp.ok) { var err = new Error("HTTP " + resp.status); err.status = resp.status; throw err; }
    return await resp.json();
  }

  // ═══════════════════════════════════════════════════════
  // COLLECTION LOGIC
  // ═══════════════════════════════════════════════════════
  async function collectEdge(type) {
    if (!currentProfilePage) return;
    try { currentProfilePage = await ensureProfileId(currentProfilePage); } catch (err) { log(err.message, "error"); return; }
    var isFollowers = type === "followers";
    collectType = type; collecting = true; paused = false; acctsQueue = []; pagesLoaded = 0;
    totalEstimated = isFollowers ? currentProfilePage.edge_followed_by.count : currentProfilePage.edge_follow.count;
    startTime = Date.now();
    updateUI(); setStatus("collecting");
    log("Iniciando coleta de " + (isFollowers ? "seguidores" : "seguidos") + " de @" + currentProfilePage.username + " (" + formatNumber(totalEstimated) + " estimados)", "info");
    var cursor = ""; var retries = 0;
    while (collecting && !paused) {
      try {
        var result = isFollowers
          ? await fetchFollowersPage(currentProfilePage.id, cursor)
          : await fetchFollowingPage(currentProfilePage.id, cursor);
        var edges = result.edges || [];
        for (var i = 0; i < edges.length; i++) acctsQueue.push(edges[i].node);
        pagesLoaded++; updateProgress();
        log("+" + edges.length + " contas (total: " + acctsQueue.length + ")", "success");
        retries = 0;
        if (settings.maxAccounts > 0 && acctsQueue.length >= settings.maxAccounts) { log("Limite atingido", "warn"); break; }
        if (!result.page_info.has_next_page || !result.page_info.end_cursor) break;
        cursor = result.page_info.end_cursor;
        await delay(settings.delayBetweenRequests + Math.random() * 1000);
      } catch (err) {
        retries++;
        if (err.status === 429) { log("Rate limit 429! Aguardando " + (settings.delayAfter429/1000) + "s...", "warn"); await handleRateLimit(settings.delayAfter429); }
        else if (err.status === 403) { log("Rate limit 403! Aguardando " + (settings.delayAfter403/1000) + "s...", "warn"); await handleRateLimit(settings.delayAfter403); }
        else { log("Erro: " + err.message, "error"); if (retries >= settings.maxRetries) { log("Max tentativas", "error"); break; } await delay(5000); }
      }
    }
    finishCollection();
  }

  async function collectFromHashtag(hashtag) {
    collectType = "hashtag"; collecting = true; paused = false; acctsQueue = []; pagesLoaded = 0;
    totalEstimated = 0; startTime = Date.now();
    updateUI(); setStatus("collecting");
    log("Coletando contas da hashtag #" + hashtag, "info");
    var nextMaxId = ""; var retries = 0; var seenUsers = new Set();
    while (collecting && !paused) {
      try {
        var data = await fetchHashtagPosts(hashtag, nextMaxId);
        var sections = data.sections || []; var newCount = 0;
        for (var s = 0; s < sections.length; s++) {
          var medias = (sections[s].layout_content && sections[s].layout_content.medias) || [];
          for (var m = 0; m < medias.length; m++) {
            var media = medias[m].media || medias[m];
            if (media.user) {
              var uid = String(media.user.pk || media.user.id);
              if (!seenUsers.has(uid)) {
                seenUsers.add(uid);
                acctsQueue.push({ id: uid, username: media.user.username, full_name: media.user.full_name || "", profile_pic_url: media.user.profile_pic_url || "", is_private: media.user.is_private || false, is_verified: media.user.is_verified || false });
                newCount++;
              }
            }
            if (media.id || media.pk) {
              try {
                var likers = await fetchPostLikers(media.id || media.pk);
                var lusers = likers.users || [];
                for (var l = 0; l < lusers.length; l++) {
                  if (!seenUsers.has(String(lusers[l].pk))) {
                    seenUsers.add(String(lusers[l].pk));
                    acctsQueue.push({ id: String(lusers[l].pk), username: lusers[l].username, full_name: lusers[l].full_name || "", profile_pic_url: lusers[l].profile_pic_url || "", is_private: lusers[l].is_private || false, is_verified: lusers[l].is_verified || false });
                    newCount++;
                  }
                }
                await delay(settings.delayBetweenRequests / 2);
              } catch (e) {}
            }
          }
        }
        pagesLoaded++; updateProgress();
        log("+" + newCount + " contas (total: " + acctsQueue.length + ")", "success");
        retries = 0;
        if (settings.maxAccounts > 0 && acctsQueue.length >= settings.maxAccounts) break;
        if (!data.more_available || !data.next_max_id) break;
        nextMaxId = data.next_max_id;
        await delay(settings.delayBetweenRequests + Math.random() * 1000);
      } catch (err) {
        retries++;
        if (err.status === 429 || err.status === 403) { var wt = err.status === 429 ? settings.delayAfter429 : settings.delayAfter403; log("Rate limit " + err.status + "! Aguardando " + (wt/1000) + "s...", "warn"); await handleRateLimit(wt); }
        else { log("Erro: " + err.message, "error"); if (retries >= settings.maxRetries) break; await delay(5000); }
      }
    }
    finishCollection();
  }

  async function collectFromLocation(locationId) {
    collectType = "location"; collecting = true; paused = false; acctsQueue = []; pagesLoaded = 0;
    totalEstimated = 0; startTime = Date.now();
    updateUI(); setStatus("collecting");
    log("Coletando contas da localização " + locationId, "info");
    var nextMaxId = ""; var retries = 0; var seenUsers = new Set();
    while (collecting && !paused) {
      try {
        var data = await fetchLocationPosts(locationId, nextMaxId);
        var sections = data.sections || []; var newCount = 0;
        for (var s = 0; s < sections.length; s++) {
          var medias = (sections[s].layout_content && sections[s].layout_content.medias) || [];
          for (var m = 0; m < medias.length; m++) {
            var media = medias[m].media || medias[m];
            if (media.user) {
              var uid = String(media.user.pk || media.user.id);
              if (!seenUsers.has(uid)) {
                seenUsers.add(uid);
                acctsQueue.push({ id: uid, username: media.user.username, full_name: media.user.full_name || "", profile_pic_url: media.user.profile_pic_url || "", is_private: media.user.is_private || false, is_verified: media.user.is_verified || false });
                newCount++;
              }
            }
          }
        }
        pagesLoaded++; updateProgress();
        log("+" + newCount + " contas (total: " + acctsQueue.length + ")", "success");
        retries = 0;
        if (settings.maxAccounts > 0 && acctsQueue.length >= settings.maxAccounts) break;
        if (!data.more_available || !data.next_max_id) break;
        nextMaxId = data.next_max_id;
        await delay(settings.delayBetweenRequests + Math.random() * 1000);
      } catch (err) {
        retries++;
        if (err.status === 429 || err.status === 403) { var wt = err.status === 429 ? settings.delayAfter429 : settings.delayAfter403; log("Rate limit " + err.status + "!", "warn"); await handleRateLimit(wt); }
        else { log("Erro: " + err.message, "error"); if (retries >= settings.maxRetries) break; await delay(5000); }
      }
    }
    finishCollection();
  }

  // ═══════════════════════════════════════════════════════
  // RATE LIMIT HANDLING
  // ═══════════════════════════════════════════════════════
  async function handleRateLimit(waitMs) {
    setStatus("paused");
    var progressBar = document.querySelector(".iglc-progress-bar-fill");
    if (progressBar) progressBar.classList.add("rate-limited");
    var banner = document.getElementById("iglc-rate-limit-banner");
    if (banner) banner.classList.add("visible");
    rateLimitCountdown = waitMs;
    var countdownEl = document.getElementById("iglc-countdown");
    var startWait = Date.now();
    return new Promise(function (resolve) {
      rateLimitTimer = setInterval(function () {
        var elapsed = Date.now() - startWait;
        var remaining = Math.max(0, waitMs - elapsed);
        rateLimitCountdown = remaining;
        if (countdownEl) countdownEl.textContent = formatDuration(remaining);
        if (remaining <= 0 || !collecting) {
          clearInterval(rateLimitTimer); rateLimitTimer = null;
          if (banner) banner.classList.remove("visible");
          if (progressBar) progressBar.classList.remove("rate-limited");
          if (collecting) setStatus("collecting");
          resolve();
        }
      }, 1000);
    });
  }

  function finishCollection() {
    collecting = false; paused = false; setStatus("done");
    log("Coleta finalizada! Total: " + acctsQueue.length + " contas", "success");
    updateUI();
    if (settings.autoExportOnDone && acctsQueue.length > 0) exportList(settings.exportFormat);
    notifyCollectionComplete();
    chrome.storage.local.set({ iglc_lastQueue: acctsQueue, iglc_lastCollectType: collectType, iglc_lastDate: new Date().toISOString() });
    // Auto-enviar para o Organic se habilitado e disponível
    if (settings.autoSendOrganic && acctsQueue.length > 0) {
      if (typeof _iglcPushToOrganic === "function" && typeof _iglcIsOrganicAvailable === "function" && _iglcIsOrganicAvailable()) {
        var sent = _iglcPushToOrganic(acctsQueue);
        if (sent) {
          log("Auto-enviado para o Organic! " + acctsQueue.length + " contas na fila", "success");
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // NOTIFICATION SYSTEM
  // ═══════════════════════════════════════════════════════
  function getCollectionSummary() {
    var profile = currentProfilePage ? "@" + currentProfilePage.username : "desconhecido";
    var tipoLabel = { followers: "Seguidores", following: "Seguindo", hashtag: "Hashtag", location: "Localização" };
    var tipo = tipoLabel[collectType] || collectType;
    var elapsed = Date.now() - startTime;
    return {
      profile: profile,
      type: tipo,
      typeRaw: collectType,
      count: acctsQueue.length,
      pages: pagesLoaded,
      elapsed: elapsed,
      elapsedFormatted: formatDuration(elapsed),
      date: new Date().toLocaleString("pt-BR"),
      timestamp: new Date().toISOString()
    };
  }

  function notifyCollectionComplete() {
    var summary = getCollectionSummary();
    if (settings.notifyDesktop) sendDesktopNotification(summary);
    if (settings.notifySound) playSoundAlert();
    flashTabTitle(summary);
    if (settings.notifyEmail && settings.notifyEmailAddress) sendEmailNotification(summary);
    if (settings.notifyWebhook && settings.notifyWebhookUrl) sendWebhookNotification(summary);
  }

  function sendDesktopNotification(summary) {
    try {
      if (Notification.permission === "granted") {
        new Notification("IG List Collector - Coleta Finalizada!", {
          body: summary.count + " contas coletadas de " + summary.profile + "\n" +
                summary.type + " | " + summary.elapsedFormatted,
          icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✅</text></svg>",
          tag: "iglc-done",
          requireInteraction: true
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(function (perm) {
          if (perm === "granted") sendDesktopNotification(summary);
        });
      }
    } catch (e) {}
  }

  function playSoundAlert() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var now = ctx.currentTime;

      // Nota 1: C5
      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.connect(gain1); gain1.connect(ctx.destination);
      osc1.type = "sine";
      osc1.frequency.value = 523.25;
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc1.start(now); osc1.stop(now + 0.2);

      // Nota 2: E5
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.value = 659.25;
      gain2.gain.setValueAtTime(0.25, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc2.start(now + 0.2); osc2.stop(now + 0.4);

      // Nota 3: G5 (mais longa)
      var osc3 = ctx.createOscillator();
      var gain3 = ctx.createGain();
      osc3.connect(gain3); gain3.connect(ctx.destination);
      osc3.type = "sine";
      osc3.frequency.value = 783.99;
      gain3.gain.setValueAtTime(0.3, now + 0.4);
      gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc3.start(now + 0.4); osc3.stop(now + 0.8);

      setTimeout(function () { ctx.close(); }, 1000);
    } catch (e) {}
  }

  var _titleFlashInterval = null;
  function flashTabTitle(summary) {
    if (_titleFlashInterval) clearInterval(_titleFlashInterval);
    var original = document.title;
    var flash = "✅ " + summary.count + " contas coletadas!";
    var count = 0;
    _titleFlashInterval = setInterval(function () {
      document.title = count % 2 === 0 ? flash : original;
      count++;
      if (count > 12 || !document.hidden) {
        clearInterval(_titleFlashInterval);
        _titleFlashInterval = null;
        document.title = original;
      }
    }, 1500);
  }

  function sendEmailNotification(summary) {
    var subject = "IG List Collector - Coleta Finalizada (" + summary.count + " contas)";
    var body = "Coleta finalizada com sucesso!\n\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n" +
      "Perfil: " + summary.profile + "\n" +
      "Tipo: " + summary.type + "\n" +
      "Total coletado: " + summary.count + " contas\n" +
      "Páginas carregadas: " + summary.pages + "\n" +
      "Tempo total: " + summary.elapsedFormatted + "\n" +
      "Data: " + summary.date + "\n" +
      "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "Abra o IG List Collector para exportar ou organizar a lista.\n\n" +
      "— IG List Collector v1.2";
    var mailtoUrl = "mailto:" + encodeURIComponent(settings.notifyEmailAddress) +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    var a = document.createElement("a");
    a.href = mailtoUrl;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); }, 200);
    log("Email preparado para " + settings.notifyEmailAddress, "success");
  }

  function sendWebhookNotification(summary) {
    var payload = {
      event: "collection_complete",
      profile: summary.profile,
      type: summary.typeRaw,
      count: summary.count,
      pages: summary.pages,
      duration_ms: summary.elapsed,
      duration: summary.elapsedFormatted,
      timestamp: summary.timestamp,
      source: "IG List Collector v1.2"
    };
    fetch(settings.notifyWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "no-cors"
    }).then(function () {
      log("Webhook enviado para " + settings.notifyWebhookUrl, "success");
    }).catch(function (e) {
      log("Erro no webhook: " + e.message, "error");
    });
  }

  function requestNotifPermission() {
    try {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission().then(function (p) {
          log("Permissão de notificação: " + p, p === "granted" ? "success" : "warn");
        });
      }
    } catch (e) {}
  }

  function stopCollection() {
    collecting = false; paused = false;
    if (rateLimitTimer) { clearInterval(rateLimitTimer); rateLimitTimer = null; }
    var banner = document.getElementById("iglc-rate-limit-banner");
    if (banner) banner.classList.remove("visible");
    setStatus("done"); log("Coleta interrompida", "warn"); updateUI();
  }

  // ═══════════════════════════════════════════════════════
  // FILTERS
  // ═══════════════════════════════════════════════════════
  function readFiltersFromUI() {
    filters.removePrivate = document.getElementById("iglc-f-remove-private").checked;
    filters.removePublic = document.getElementById("iglc-f-remove-public").checked;
    filters.removeVerified = document.getElementById("iglc-f-remove-verified").checked;
    filters.removeNonVerified = document.getElementById("iglc-f-remove-nonverified").checked;
    filters.removeNoProfilePic = document.getElementById("iglc-f-remove-nopic").checked;
    filters.removeDuplicates = document.getElementById("iglc-f-remove-dupes").checked;
    filters.usernameContains = document.getElementById("iglc-f-username-contains").value.trim();
    filters.usernameNotContains = document.getElementById("iglc-f-username-not-contains").value.trim();
    filters.fullnameContains = document.getElementById("iglc-f-fullname-contains").value.trim();
    filters.fullnameNotContains = document.getElementById("iglc-f-fullname-not-contains").value.trim();
    filters.followersMin = parseInt(document.getElementById("iglc-f-followers-min").value) || 0;
    filters.followersMax = parseInt(document.getElementById("iglc-f-followers-max").value) || 0;
    filters.followingMin = parseInt(document.getElementById("iglc-f-following-min").value) || 0;
    filters.followingMax = parseInt(document.getElementById("iglc-f-following-max").value) || 0;
    chrome.storage.local.set({ iglc_filters: filters });
  }

  function loadFilters() {
    chrome.storage.local.get("iglc_filters", function (data) {
      if (data.iglc_filters) {
        Object.assign(filters, data.iglc_filters);
        var el;
        el = document.getElementById("iglc-f-remove-private"); if (el) el.checked = filters.removePrivate;
        el = document.getElementById("iglc-f-remove-public"); if (el) el.checked = filters.removePublic;
        el = document.getElementById("iglc-f-remove-verified"); if (el) el.checked = filters.removeVerified;
        el = document.getElementById("iglc-f-remove-nonverified"); if (el) el.checked = filters.removeNonVerified;
        el = document.getElementById("iglc-f-remove-nopic"); if (el) el.checked = filters.removeNoProfilePic;
        el = document.getElementById("iglc-f-remove-dupes"); if (el) el.checked = filters.removeDuplicates;
        el = document.getElementById("iglc-f-username-contains"); if (el) el.value = filters.usernameContains;
        el = document.getElementById("iglc-f-username-not-contains"); if (el) el.value = filters.usernameNotContains;
        el = document.getElementById("iglc-f-fullname-contains"); if (el) el.value = filters.fullnameContains;
        el = document.getElementById("iglc-f-fullname-not-contains"); if (el) el.value = filters.fullnameNotContains;
        el = document.getElementById("iglc-f-followers-min"); if (el) el.value = filters.followersMin;
        el = document.getElementById("iglc-f-followers-max"); if (el) el.value = filters.followersMax;
        el = document.getElementById("iglc-f-following-min"); if (el) el.value = filters.followingMin;
        el = document.getElementById("iglc-f-following-max"); if (el) el.value = filters.followingMax;
      }
    });
  }

  function matchesKeywords(text, keywords) {
    if (!keywords) return false;
    var kws = keywords.split(",").map(function(k) { return k.trim().toLowerCase(); }).filter(function(k) { return k; });
    if (kws.length === 0) return false;
    var lower = (text || "").toLowerCase();
    for (var i = 0; i < kws.length; i++) {
      if (lower.indexOf(kws[i]) > -1) return true;
    }
    return false;
  }

  function applyFilters() {
    readFiltersFromUI();
    preFilterCount = acctsQueue.length;
    var removed = { priv: 0, pub: 0, ver: 0, nver: 0, nopic: 0, dupes: 0, ucontains: 0, unotcontains: 0, fncontains: 0, fnnotcontains: 0, fmin: 0, fmax: 0, gmin: 0, gmax: 0 };
    var result = [];
    var seenIds = new Set();
    var seenUsernames = new Set();

    for (var i = 0; i < acctsQueue.length; i++) {
      var a = acctsQueue[i];
      // Duplicates
      if (filters.removeDuplicates) {
        var key = a.id ? String(a.id) : (a.username || "").toLowerCase();
        var ukey = (a.username || "").toLowerCase();
        if (seenIds.has(key) || seenUsernames.has(ukey)) { removed.dupes++; continue; }
        seenIds.add(key);
        seenUsernames.add(ukey);
      }

      // Private / Public
      if (filters.removePrivate && a.is_private === true) { removed.priv++; continue; }
      if (filters.removePublic && a.is_private === false) { removed.pub++; continue; }

      // Verified
      if (filters.removeVerified && a.is_verified === true) { removed.ver++; continue; }
      if (filters.removeNonVerified && a.is_verified === false) { removed.nver++; continue; }

      // No profile pic
      if (filters.removeNoProfilePic) {
        var pic = a.profile_pic_url || "";
        if (!pic || pic.indexOf("default") > -1 || pic.indexOf("44884218_345707102882519") > -1 || pic.indexOf("anon") > -1) {
          removed.nopic++; continue;
        }
      }

      // Username contains (keep only if matches)
      if (filters.usernameContains && !matchesKeywords(a.username, filters.usernameContains)) {
        removed.ucontains++; continue;
      }

      // Username NOT contains (remove if matches)
      if (filters.usernameNotContains && matchesKeywords(a.username, filters.usernameNotContains)) {
        removed.unotcontains++; continue;
      }

      // Full name contains
      if (filters.fullnameContains && !matchesKeywords(a.full_name, filters.fullnameContains)) {
        removed.fncontains++; continue;
      }

      // Full name NOT contains
      if (filters.fullnameNotContains && matchesKeywords(a.full_name, filters.fullnameNotContains)) {
        removed.fnnotcontains++; continue;
      }

      // Followers min/max (only if data exists)
      var fc = a.edge_followed_by ? a.edge_followed_by.count : (a.follower_count || null);
      if (fc !== null && fc !== undefined) {
        if (filters.followersMin > 0 && fc < filters.followersMin) { removed.fmin++; continue; }
        if (filters.followersMax > 0 && fc > filters.followersMax) { removed.fmax++; continue; }
      }

      // Following min/max (only if data exists)
      var gc = a.edge_follow ? a.edge_follow.count : (a.following_count || null);
      if (gc !== null && gc !== undefined) {
        if (filters.followingMin > 0 && gc < filters.followingMin) { removed.gmin++; continue; }
        if (filters.followingMax > 0 && gc > filters.followingMax) { removed.gmax++; continue; }
      }

      result.push(a);
    }

    var totalRemoved = preFilterCount - result.length;
    acctsQueue = result;

    // Build detail log
    var details = [];
    if (removed.dupes > 0) details.push(removed.dupes + " duplicadas");
    if (removed.priv > 0) details.push(removed.priv + " privadas");
    if (removed.pub > 0) details.push(removed.pub + " públicas");
    if (removed.ver > 0) details.push(removed.ver + " verificadas");
    if (removed.nver > 0) details.push(removed.nver + " não-verificadas");
    if (removed.nopic > 0) details.push(removed.nopic + " sem foto");
    if (removed.ucontains > 0) details.push(removed.ucontains + " username s/ keyword");
    if (removed.unotcontains > 0) details.push(removed.unotcontains + " username c/ keyword");
    if (removed.fncontains > 0) details.push(removed.fncontains + " nome s/ keyword");
    if (removed.fnnotcontains > 0) details.push(removed.fnnotcontains + " nome c/ keyword");
    if (removed.fmin > 0) details.push(removed.fmin + " poucos seguidores");
    if (removed.fmax > 0) details.push(removed.fmax + " muitos seguidores");
    if (removed.gmin > 0) details.push(removed.gmin + " poucos seguindo");
    if (removed.gmax > 0) details.push(removed.gmax + " muitos seguindo");

    var detailStr = details.length > 0 ? " (" + details.join(", ") + ")" : "";
    log("Filtros aplicados: " + preFilterCount + " → " + acctsQueue.length + " contas. Removidas: " + totalRemoved + detailStr, totalRemoved > 0 ? "success" : "info");

    updateFilterStats();
    updateUI();
    chrome.storage.local.set({ iglc_lastQueue: acctsQueue });
  }

  function updateFilterStats() {
    var el = document.getElementById("iglc-filter-stats");
    if (el && preFilterCount > 0) {
      var removed = preFilterCount - acctsQueue.length;
      el.textContent = preFilterCount + " → " + acctsQueue.length + " (−" + removed + ")";
      el.style.color = removed > 0 ? "#f85149" : "#3fb950";
    } else if (el) {
      el.textContent = "";
    }
  }

  function resetFilters() {
    var checkboxes = ["iglc-f-remove-private", "iglc-f-remove-public", "iglc-f-remove-verified", "iglc-f-remove-nonverified", "iglc-f-remove-nopic"];
    for (var i = 0; i < checkboxes.length; i++) {
      var el = document.getElementById(checkboxes[i]);
      if (el) el.checked = false;
    }
    var el2 = document.getElementById("iglc-f-remove-dupes"); if (el2) el2.checked = true;
    var texts = ["iglc-f-username-contains", "iglc-f-username-not-contains", "iglc-f-fullname-contains", "iglc-f-fullname-not-contains"];
    for (var j = 0; j < texts.length; j++) {
      var el3 = document.getElementById(texts[j]);
      if (el3) el3.value = "";
    }
    var nums = ["iglc-f-followers-min", "iglc-f-followers-max", "iglc-f-following-min", "iglc-f-following-max"];
    for (var k = 0; k < nums.length; k++) {
      var el4 = document.getElementById(nums[k]);
      if (el4) el4.value = "0";
    }
    var el5 = document.getElementById("iglc-filter-stats"); if (el5) el5.textContent = "";
    readFiltersFromUI();
    log("Filtros resetados", "info");
  }

  // ═══════════════════════════════════════════════════════
  // EXPORT / IMPORT
  // ═══════════════════════════════════════════════════════
  function exportList(format) {
    if (!format) format = "json";
    if (acctsQueue.length === 0) { log("Nenhuma conta!", "warn"); return; }
    var ts = new Date().toISOString().slice(0, 16).replace(/[:-]/g, "");
    var pn = currentProfilePage ? currentProfilePage.username : "unknown";
    var src = collectType || "list";
    if (format === "json") {
      var blob = new Blob([JSON.stringify(acctsQueue, null, 2)], { type: "application/json;charset=utf-8" });
      var fn = "iglc_" + pn + "_" + src + "_" + acctsQueue.length + "_" + ts + ".json";
      downloadBlob(blob, fn); log("Exportado: " + fn, "success");
    } else if (format === "csv") {
      var csv = convertToCSV(acctsQueue);
      var blob2 = new Blob([csv], { type: "text/csv;charset=utf-8" });
      var fn2 = "iglc_" + pn + "_" + src + "_" + acctsQueue.length + "_" + ts + ".csv";
      downloadBlob(blob2, fn2); log("Exportado: " + fn2, "success");
    } else if (format === "txt") {
      var txt = acctsQueue.map(function(a) { return a.username; }).join("\n");
      var blob3 = new Blob([txt], { type: "text/plain;charset=utf-8" });
      var fn3 = "iglc_" + pn + "_" + src + "_" + acctsQueue.length + "_" + ts + ".txt";
      downloadBlob(blob3, fn3); log("Exportado: " + fn3, "success");
    }
  }

  function convertToCSV(data) {
    if (data.length === 0) return "";
    var keys = ["id", "username", "full_name", "is_private", "is_verified", "profile_pic_url"];
    var header = keys.join(",");
    var rows = data.map(function(row) { return keys.map(function(k) { return JSON.stringify(row[k] != null ? row[k] : ""); }).join(","); });
    return [header].concat(rows).join("\r\n");
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  function importList() {
    var input = document.createElement("input"); input.type = "file"; input.accept = ".json,.txt,.csv";
    input.addEventListener("change", function () {
      if (!this.files || !this.files[0]) return;
      var reader = new FileReader();
      reader.addEventListener("load", function (e) {
        var data = e.target.result;
        try {
          if (data.trim().charAt(0) === "[" || data.trim().charAt(0) === "{") {
            var parsed = JSON.parse(data);
            acctsQueue = Array.isArray(parsed) ? parsed : [parsed];
          } else {
            var cleaned = data.replace(/\r/g, "\n").replace(/,/g, "\n");
            var usernames = cleaned.split("\n").filter(function(u) { return u.trim(); });
            acctsQueue = usernames.map(function(u) { return { username: u.trim() }; });
          }
          log("Importado: " + acctsQueue.length + " contas", "success");
          updateUI();
        } catch (err) { log("Erro ao importar: " + err.message, "error"); }
      });
      reader.readAsText(this.files[0]);
    });
    input.click();
  }

  // ═══════════════════════════════════════════════════════
  // LIST READER / ORGANIZER
  // ═══════════════════════════════════════════════════════

  function switchView(view) {
    currentView = view;
    var collectorView = document.getElementById("iglc-view-collector");
    var readerView = document.getElementById("iglc-view-reader");
    var tabCollector = document.getElementById("iglc-tab-collector");
    var tabReader = document.getElementById("iglc-tab-reader");
    if (!collectorView || !readerView) return;
    if (view === "reader") {
      collectorView.style.display = "none";
      readerView.style.display = "block";
      tabCollector.classList.remove("active");
      tabReader.classList.add("active");
    } else {
      collectorView.style.display = "block";
      readerView.style.display = "none";
      tabCollector.classList.add("active");
      tabReader.classList.remove("active");
    }
  }

  function openListReader() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", function () {
      if (!this.files || !this.files[0]) return;
      readerFileName = this.files[0].name;
      var fr = new FileReader();
      fr.addEventListener("load", function (e) {
        try {
          var data = JSON.parse(e.target.result);
          readerData = Array.isArray(data) ? data : [data];
          readerFiltered = readerData.slice();
          readerPage = 0;
          readerSearch = "";
          readerTypeFilter = "all";
          readerSort = { field: "username", dir: "asc" };
          switchView("reader");
          readerShowControls();
          renderReaderStats();
          readerApplySort();
          renderReaderTable();
          log("Leitor: " + readerData.length + " contas carregadas de " + readerFileName, "success");
        } catch (err) {
          log("Erro ao carregar JSON: " + err.message, "error");
        }
      });
      fr.readAsText(this.files[0]);
    });
    input.click();
  }

  function readerShowControls() {
    var ids = ["iglc-reader-controls-section", "iglc-reader-table-section", "iglc-reader-actions-section"];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.style.display = "block";
    }
  }

  function readerApplyFilters() {
    var searchEl = document.getElementById("iglc-reader-search");
    var typeEl = document.getElementById("iglc-reader-type-filter");
    readerSearch = searchEl ? searchEl.value.toLowerCase().trim() : "";
    readerTypeFilter = typeEl ? typeEl.value : "all";
    readerFiltered = readerData.filter(function (a) {
      if (readerSearch) {
        var uname = (a.username || "").toLowerCase();
        var fname = (a.full_name || "").toLowerCase();
        if (uname.indexOf(readerSearch) === -1 && fname.indexOf(readerSearch) === -1) return false;
      }
      if (readerTypeFilter === "public" && a.is_private !== false) return false;
      if (readerTypeFilter === "private" && a.is_private !== true) return false;
      if (readerTypeFilter === "verified" && a.is_verified !== true) return false;
      if (readerTypeFilter === "nopic") {
        var pic = a.profile_pic_url || "";
        if (pic && pic.indexOf("default") === -1 && pic.indexOf("anon") === -1 && pic.indexOf("44884218_345707102882519") === -1) return false;
      }
      return true;
    });
    readerApplySort();
    readerPage = 0;
    renderReaderStats();
    renderReaderTable();
  }

  function readerApplySort() {
    var field = readerSort.field;
    var dir = readerSort.dir === "asc" ? 1 : -1;
    readerFiltered.sort(function (a, b) {
      var va = a[field] != null ? a[field] : "";
      var vb = b[field] != null ? b[field] : "";
      if (typeof va === "boolean") { va = va ? 1 : 0; vb = vb ? 1 : 0; }
      if (typeof va === "string") { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function readerSortBy(field) {
    if (readerSort.field === field) {
      readerSort.dir = readerSort.dir === "asc" ? "desc" : "asc";
    } else {
      readerSort.field = field;
      readerSort.dir = "asc";
    }
    readerApplySort();
    readerPage = 0;
    renderReaderTable();
  }

  function isDefaultPic(pic) {
    return !pic || pic.indexOf("default") > -1 || pic.indexOf("anon") > -1 || pic.indexOf("44884218_345707102882519") > -1;
  }

  function renderReaderStats() {
    var statsEl = document.getElementById("iglc-reader-stats");
    if (!statsEl) return;
    var total = readerData.length;
    var pubCount = 0, privCount = 0, verCount = 0, nopicCount = 0;
    for (var i = 0; i < readerData.length; i++) {
      if (readerData[i].is_private) privCount++; else pubCount++;
      if (readerData[i].is_verified) verCount++;
      if (isDefaultPic(readerData[i].profile_pic_url)) nopicCount++;
    }
    var pubPct = total > 0 ? ((pubCount / total) * 100).toFixed(1) : "0";
    var privPct = total > 0 ? ((privCount / total) * 100).toFixed(1) : "0";
    var verPct = total > 0 ? ((verCount / total) * 100).toFixed(1) : "0";
    var nopicPct = total > 0 ? ((nopicCount / total) * 100).toFixed(1) : "0";
    var filteredNote = readerFiltered.length !== total
      ? '<div class="iglc-reader-stat-filtered">Mostrando: ' + formatNumber(readerFiltered.length) + " de " + formatNumber(total) + "</div>"
      : "";
    statsEl.innerHTML =
      '<div class="iglc-reader-stat-header">' +
        '<div class="iglc-reader-stat-total">' + formatNumber(total) + "</div>" +
        '<div class="iglc-reader-stat-label">contas carregadas</div>' +
        '<div class="iglc-reader-stat-file">' + escapeHtml(readerFileName) + "</div>" +
      "</div>" +
      '<div class="iglc-reader-stat-grid">' +
        '<div class="iglc-reader-stat-item"><span class="iglc-stat-icon pub">👤</span><span>' + formatNumber(pubCount) + " públicas</span><span class=\"iglc-reader-stat-pct\">" + pubPct + "%</span></div>" +
        '<div class="iglc-reader-stat-item"><span class="iglc-stat-icon priv">🔒</span><span>' + formatNumber(privCount) + " privadas</span><span class=\"iglc-reader-stat-pct\">" + privPct + "%</span></div>" +
        '<div class="iglc-reader-stat-item"><span class="iglc-stat-icon ver">✓</span><span>' + formatNumber(verCount) + " verificadas</span><span class=\"iglc-reader-stat-pct\">" + verPct + "%</span></div>" +
        '<div class="iglc-reader-stat-item"><span class="iglc-stat-icon nopic">🚫</span><span>' + formatNumber(nopicCount) + " sem foto</span><span class=\"iglc-reader-stat-pct\">" + nopicPct + "%</span></div>" +
      "</div>" + filteredNote;
  }

  function renderReaderTable() {
    var tableEl = document.getElementById("iglc-reader-table");
    var pagEl = document.getElementById("iglc-reader-pagination");
    if (!tableEl) return;
    if (readerFiltered.length === 0) {
      tableEl.innerHTML = '<div class="iglc-reader-empty">Nenhuma conta encontrada</div>';
      if (pagEl) pagEl.innerHTML = "";
      return;
    }
    var totalPages = Math.ceil(readerFiltered.length / READER_PAGE_SIZE);
    if (readerPage >= totalPages) readerPage = totalPages - 1;
    if (readerPage < 0) readerPage = 0;
    var start = readerPage * READER_PAGE_SIZE;
    var end = Math.min(start + READER_PAGE_SIZE, readerFiltered.length);
    var pageItems = readerFiltered.slice(start, end);
    var sortInd = function (f) {
      if (readerSort.field !== f) return "";
      return readerSort.dir === "asc" ? " ▲" : " ▼";
    };
    var html =
      '<div class="iglc-reader-table-header">' +
        '<div class="iglc-reader-th" data-field="username" style="flex:2;">Username' + sortInd("username") + "</div>" +
        '<div class="iglc-reader-th" data-field="full_name" style="flex:2;">Nome' + sortInd("full_name") + "</div>" +
        '<div class="iglc-reader-th" data-field="is_private" style="flex:1;">Tipo' + sortInd("is_private") + "</div>" +
      "</div>";
    for (var i = 0; i < pageItems.length; i++) {
      var a = pageItems[i];
      var pic = a.profile_pic_url || "";
      var picH = isDefaultPic(pic)
        ? '<div class="iglc-reader-avatar-placeholder">' + escapeHtml((a.username || "?").charAt(0).toUpperCase()) + "</div>"
        : '<img class="iglc-reader-avatar" src="' + escapeHtml(pic) + '" alt="" loading="lazy">';
      var badges = "";
      if (a.is_verified) badges += '<span class="iglc-badge ver" title="Verificada">✓</span>';
      if (a.is_private) badges += '<span class="iglc-badge priv" title="Privada">🔒</span>';
      else badges += '<span class="iglc-badge pub" title="Pública">👤</span>';
      html +=
        '<div class="iglc-reader-row">' +
          '<div class="iglc-reader-cell" style="flex:2;display:flex;align-items:center;gap:8px;">' + picH + '<span class="iglc-reader-username">' + escapeHtml(a.username || "") + "</span></div>" +
          '<div class="iglc-reader-cell" style="flex:2;">' + escapeHtml(a.full_name || "") + "</div>" +
          '<div class="iglc-reader-cell" style="flex:1;">' + badges + "</div>" +
        "</div>";
    }
    tableEl.innerHTML = html;
    var headers = tableEl.querySelectorAll(".iglc-reader-th");
    for (var h = 0; h < headers.length; h++) {
      (function (header) {
        header.addEventListener("click", function () { readerSortBy(header.dataset.field); });
      })(headers[h]);
    }
    if (pagEl) {
      if (totalPages <= 1) {
        pagEl.innerHTML = '<span class="iglc-reader-page-info">' + formatNumber(readerFiltered.length) + " contas</span>";
      } else {
        pagEl.innerHTML =
          '<button class="iglc-btn" id="iglc-reader-prev"' + (readerPage <= 0 ? " disabled" : "") + ">◀</button>" +
          '<span class="iglc-reader-page-info">Página ' + (readerPage + 1) + " de " + totalPages + " (" + formatNumber(readerFiltered.length) + " contas)</span>" +
          '<button class="iglc-btn" id="iglc-reader-next"' + (readerPage >= totalPages - 1 ? " disabled" : "") + ">▶</button>";
        var prev = document.getElementById("iglc-reader-prev");
        var next = document.getElementById("iglc-reader-next");
        if (prev) prev.addEventListener("click", function () { readerPage--; renderReaderTable(); });
        if (next) next.addEventListener("click", function () { readerPage++; renderReaderTable(); });
      }
    }
  }

  function readerRemoveDuplicates() {
    var seenIds = new Set();
    var seenUsernames = new Set();
    var unique = [];
    var removed = 0;
    for (var i = 0; i < readerData.length; i++) {
      var a = readerData[i];
      var key = a.id ? String(a.id) : (a.username || "").toLowerCase();
      var ukey = (a.username || "").toLowerCase();
      if (seenIds.has(key) || seenUsernames.has(ukey)) { removed++; continue; }
      seenIds.add(key);
      seenUsernames.add(ukey);
      unique.push(a);
    }
    readerData = unique;
    readerApplyFilters();
    log("Leitor: " + removed + " duplicatas removidas. Restam " + readerData.length, removed > 0 ? "success" : "info");
  }

  function readerSplitExport() {
    if (readerFiltered.length === 0) { log("Nenhuma conta para dividir", "warn"); return; }
    var partsStr = prompt("Em quantas partes dividir a lista? (Ex: 5)");
    if (!partsStr) return;
    var parts = parseInt(partsStr);
    if (!parts || parts < 2) { log("Numero invalido (minimo 2)", "warn"); return; }
    var chunkSize = Math.ceil(readerFiltered.length / parts);
    var baseName = readerFileName.replace(".json", "") || "list";
    for (var p = 0; p < parts; p++) {
      var chunk = readerFiltered.slice(p * chunkSize, (p + 1) * chunkSize);
      if (chunk.length === 0) continue;
      var blob = new Blob([JSON.stringify(chunk, null, 2)], { type: "application/json;charset=utf-8" });
      downloadBlob(blob, baseName + "_parte" + (p + 1) + "de" + parts + "_" + chunk.length + ".json");
    }
    log("Lista dividida em " + parts + " partes com ~" + chunkSize + " contas cada", "success");
  }

  function readerExportFiltered(format) {
    if (readerFiltered.length === 0) { log("Nenhuma conta para exportar", "warn"); return; }
    var ts = new Date().toISOString().slice(0, 16).replace(/[:-]/g, "");
    var baseName = readerFileName.replace(".json", "") || "list";
    if (format === "json") {
      var blob = new Blob([JSON.stringify(readerFiltered, null, 2)], { type: "application/json;charset=utf-8" });
      downloadBlob(blob, baseName + "_filtrado_" + readerFiltered.length + "_" + ts + ".json");
    } else if (format === "csv") {
      var csv = convertToCSV(readerFiltered);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), baseName + "_filtrado_" + readerFiltered.length + "_" + ts + ".csv");
    } else if (format === "txt") {
      var txt = readerFiltered.map(function (a) { return a.username; }).join("\n");
      downloadBlob(new Blob([txt], { type: "text/plain;charset=utf-8" }), baseName + "_filtrado_" + readerFiltered.length + "_" + ts + ".txt");
    }
    log("Leitor: exportado " + readerFiltered.length + " contas (" + format.toUpperCase() + ")", "success");
  }

  function readerSendToQueue() {
    if (readerFiltered.length === 0) { log("Nenhuma conta para enviar", "warn"); return; }
    // Tentar enviar diretamente para o Organic via bridge
    if (typeof _iglcPushToOrganic === "function" && typeof _iglcIsOrganicAvailable === "function" && _iglcIsOrganicAvailable()) {
      var sent = _iglcPushToOrganic(readerFiltered);
      if (sent) {
        log("Enviado para o Organic! " + readerFiltered.length + " contas na fila", "success");
        switchView("collector");
        return;
      }
    }
    // Fallback: fila local do Collector
    acctsQueue = readerFiltered.slice();
    updateUI();
    switchView("collector");
    log("Leitor: " + acctsQueue.length + " contas na fila local (Organic nao detectado)", "warn");
  }

  function readerMergeFile() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", function () {
      if (!this.files || !this.files[0]) return;
      var fr = new FileReader();
      fr.addEventListener("load", function (e) {
        try {
          var data = JSON.parse(e.target.result);
          var newItems = Array.isArray(data) ? data : [data];
          readerData = readerData.concat(newItems);
          readerApplyFilters();
          log("Leitor: +" + newItems.length + " contas mescladas (total: " + readerData.length + ")", "success");
        } catch (err) {
          log("Erro ao mesclar: " + err.message, "error");
        }
      });
      fr.readAsText(this.files[0]);
    });
    input.click();
  }

  // ═══════════════════════════════════════════════════════
  // UI
  // ═══════════════════════════════════════════════════════
  function createPanel() {
    if (document.getElementById("igListCollectorPanel")) return;
    var panel = document.createElement("div");
    panel.id = "igListCollectorPanel";
    panel.className = "hidden";
    panel.innerHTML = '\
      <div class="iglc-header">\
        <button class="iglc-close-btn" id="iglc-close-btn" title="Fechar ou minimizar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>\
        <h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> IG List Collector</h2>\
      </div>\
      <div class="iglc-tabs">\
        <button class="iglc-tab active" id="iglc-tab-collector">Coletor</button>\
        <button class="iglc-tab" id="iglc-tab-reader">📖 Leitor de Lista</button>\
      </div>\
      <div class="iglc-body">\
        <div id="iglc-view-collector">\
        <div class="iglc-section">\
          <div class="iglc-section-title">Perfil Atual</div>\
          <div class="iglc-profile-info" id="iglc-profile-info"><div style="color:#8b949e; font-size:12px;">Navegue até um perfil do Instagram</div></div>\
          <div style="display:flex; gap:6px; margin-top:8px;">\
            <button class="iglc-btn" id="iglc-btn-refresh" style="flex:1; font-size:11px; padding:6px 8px;" title="Re-detectar da página (sem API)">↻ Re-detectar</button>\
            <button class="iglc-btn" id="iglc-btn-api-refresh" style="flex:1; font-size:11px; padding:6px 8px;" title="Buscar via API (1 request)">🌐 API (1 req)</button>\
            <button class="iglc-btn" id="iglc-btn-manual" style="flex:1; font-size:11px; padding:6px 8px;" title="Digitar perfil manualmente">✏ Manual</button>\
          </div>\
        </div>\
        <div class="iglc-section">\
          <div class="iglc-section-title">Coletar</div>\
          <div class="iglc-actions">\
            <button class="iglc-btn primary" id="iglc-btn-followers" disabled>👥 Seguidores</button>\
            <button class="iglc-btn primary" id="iglc-btn-following" disabled>➕ Seguindo</button>\
            <button class="iglc-btn" id="iglc-btn-hashtag"># Hashtag</button>\
            <button class="iglc-btn" id="iglc-btn-location">📍 Localização</button>\
            <button class="iglc-btn danger full-width" id="iglc-btn-stop" style="display:none;">⏹ Parar Coleta</button>\
          </div>\
        </div>\
        <div id="iglc-rate-limit-banner" class="iglc-rate-limit-banner">\
          <span>⏰ Rate limit — retomando em <span class="iglc-countdown" id="iglc-countdown">0:00</span></span>\
        </div>\
        <div class="iglc-section">\
          <div class="iglc-progress-container" id="iglc-progress">\
            <div class="iglc-progress-header">\
              <span class="iglc-status" id="iglc-status"><span class="iglc-status-dot"></span><span id="iglc-status-text">Pronto</span></span>\
              <span class="iglc-progress-count" id="iglc-progress-count">0</span>\
            </div>\
            <div class="iglc-progress-bar-bg"><div class="iglc-progress-bar-fill" id="iglc-progress-bar"></div></div>\
            <div class="iglc-progress-eta" id="iglc-progress-eta"></div>\
          </div>\
        </div>\
        <div class="iglc-section">\
          <div class="iglc-section-title">Fila Coletada</div>\
          <div class="iglc-queue-summary">\
            <div><div class="iglc-queue-number" id="iglc-queue-count">0</div><div class="iglc-queue-label">contas na fila</div></div>\
            <div class="iglc-export-group">\
              <button class="iglc-btn success" id="iglc-btn-export-json" disabled>JSON</button>\
              <button class="iglc-btn success" id="iglc-btn-export-csv" disabled>CSV</button>\
              <button class="iglc-btn success" id="iglc-btn-export-txt" disabled>TXT</button>\
            </div>\
          </div>\
        </div>\
        <div class="iglc-section"><div class="iglc-actions">\
          <button class="iglc-btn" id="iglc-btn-import">📥 Importar Lista</button>\
          <button class="iglc-btn danger" id="iglc-btn-clear">🗑 Limpar Fila</button>\
        </div></div>\
        <div class="iglc-divider"></div>\
        <div class="iglc-section">\
          <div class="iglc-section-title iglc-collapsible" id="iglc-filter-toggle">\
            <span>🔍 Filtros</span>\
            <span style="display:flex;align-items:center;gap:8px;"><span class="iglc-filter-stats" id="iglc-filter-stats"></span><span class="iglc-chevron" id="iglc-filter-chevron">▸</span></span>\
          </div>\
          <div class="iglc-filter-panel" id="iglc-filter-panel" style="display:none;">\
            <div class="iglc-filter-group">\
              <div class="iglc-filter-group-title">Tipo de Conta</div>\
              <label class="iglc-checkbox"><input type="checkbox" id="iglc-f-remove-private"> Remover contas privadas</label>\
              <label class="iglc-checkbox"><input type="checkbox" id="iglc-f-remove-public"> Remover contas públicas</label>\
              <label class="iglc-checkbox"><input type="checkbox" id="iglc-f-remove-verified"> Remover verificadas</label>\
              <label class="iglc-checkbox"><input type="checkbox" id="iglc-f-remove-nonverified"> Remover não-verificadas</label>\
              <label class="iglc-checkbox"><input type="checkbox" id="iglc-f-remove-nopic"> Remover sem foto de perfil</label>\
              <label class="iglc-checkbox"><input type="checkbox" id="iglc-f-remove-dupes" checked> Remover duplicadas</label>\
            </div>\
            <div class="iglc-filter-group">\
              <div class="iglc-filter-group-title">Username</div>\
              <div class="iglc-settings-row"><label>Contém (manter):</label><input type="text" class="iglc-input iglc-input-wide" id="iglc-f-username-contains" placeholder="keyword1, keyword2..."></div>\
              <div class="iglc-settings-row"><label>Não contém (remover):</label><input type="text" class="iglc-input iglc-input-wide" id="iglc-f-username-not-contains" placeholder="bot, spam, shop..."></div>\
            </div>\
            <div class="iglc-filter-group">\
              <div class="iglc-filter-group-title">Nome Completo</div>\
              <div class="iglc-settings-row"><label>Contém (manter):</label><input type="text" class="iglc-input iglc-input-wide" id="iglc-f-fullname-contains" placeholder="keyword1, keyword2..."></div>\
              <div class="iglc-settings-row"><label>Não contém (remover):</label><input type="text" class="iglc-input iglc-input-wide" id="iglc-f-fullname-not-contains" placeholder="promo, ads..."></div>\
            </div>\
            <div class="iglc-filter-group">\
              <div class="iglc-filter-group-title">Seguidores (se disponível)</div>\
              <div class="iglc-settings-row-inline">\
                <label>Min:</label><input type="number" class="iglc-input iglc-input-sm" id="iglc-f-followers-min" value="0" min="0">\
                <label>Max:</label><input type="number" class="iglc-input iglc-input-sm" id="iglc-f-followers-max" value="0" min="0">\
              </div>\
              <div class="iglc-filter-hint">0 = ignorar. Só filtra contas com dados de seguidores.</div>\
            </div>\
            <div class="iglc-filter-group">\
              <div class="iglc-filter-group-title">Seguindo (se disponível)</div>\
              <div class="iglc-settings-row-inline">\
                <label>Min:</label><input type="number" class="iglc-input iglc-input-sm" id="iglc-f-following-min" value="0" min="0">\
                <label>Max:</label><input type="number" class="iglc-input iglc-input-sm" id="iglc-f-following-max" value="0" min="0">\
              </div>\
              <div class="iglc-filter-hint">0 = ignorar. Só filtra contas com dados de seguindo.</div>\
            </div>\
            <div class="iglc-filter-actions">\
              <button class="iglc-btn primary" id="iglc-btn-apply-filters" style="flex:2;">🔍 Aplicar Filtros</button>\
              <button class="iglc-btn" id="iglc-btn-reset-filters" style="flex:1;">↻ Resetar</button>\
            </div>\
            <div class="iglc-filter-hint" style="margin-top:6px;">⚠ Filtros são irreversíveis! Exporte antes se quiser manter a lista original.</div>\
          </div>\
        </div>\
        <div class="iglc-divider"></div>\
        <div class="iglc-section">\
          <div class="iglc-section-title">Configurações</div>\
          <div class="iglc-settings-row"><label>Delay entre req. (s)</label><input type="number" class="iglc-input" id="iglc-set-delay" value="2" min="0.5" step="0.5"></div>\
          <div class="iglc-settings-row"><label>Espera após 429 (s)</label><input type="number" class="iglc-input" id="iglc-set-429" value="120" min="10" step="10"></div>\
          <div class="iglc-settings-row"><label>Espera após 403 (s)</label><input type="number" class="iglc-input" id="iglc-set-403" value="600" min="30" step="30"></div>\
          <div class="iglc-settings-row"><label>Limite contas (0=∞)</label><input type="number" class="iglc-input" id="iglc-set-max" value="0" min="0" step="100"></div>\
          <label class="iglc-checkbox"><input type="checkbox" id="iglc-set-autoexport"> Auto-exportar ao finalizar</label>\
          <div class="iglc-divider" style="margin:8px 0;"></div>\
          <div class="iglc-section-title" style="margin-top:0;color:#A855F7;">Integração Organic</div>\
          <label class="iglc-checkbox"><input type="checkbox" id="iglc-set-autosend-organic" checked> Auto-enviar para o Organic ao finalizar</label>\
          <button class="iglc-btn iglc-btn-sm" id="iglc-btn-send-organic" style="margin-top:4px;background:linear-gradient(135deg,#6C5CE7,#A855F7);width:100%;">Enviar Fila Atual para o Organic</button>\
          <div class="iglc-settings-row" style="margin-top:4px;"><label>Formato</label><select class="iglc-select" id="iglc-set-format"><option value="json" selected>JSON (Organic)</option><option value="csv">CSV</option><option value="txt">TXT</option></select></div>\
          <div class="iglc-divider" style="margin:10px 0;"></div>\
          <div class="iglc-section-title" style="margin-top:0;">Notificações ao Finalizar</div>\
          <label class="iglc-checkbox"><input type="checkbox" id="iglc-set-notify-desktop" checked> Notificação Desktop</label>\
          <label class="iglc-checkbox"><input type="checkbox" id="iglc-set-notify-sound" checked> Alerta Sonoro</label>\
          <label class="iglc-checkbox"><input type="checkbox" id="iglc-set-notify-email"> Abrir Email com resumo</label>\
          <div class="iglc-settings-row iglc-notify-detail" id="iglc-email-row" style="display:none;"><label>Email:</label><input type="email" class="iglc-input iglc-input-wide" id="iglc-set-email" placeholder="seu@email.com"></div>\
          <label class="iglc-checkbox"><input type="checkbox" id="iglc-set-notify-webhook"> Enviar Webhook</label>\
          <div class="iglc-settings-row iglc-notify-detail" id="iglc-webhook-row" style="display:none;"><label>URL:</label><input type="url" class="iglc-input iglc-input-wide" id="iglc-set-webhook-url" placeholder="https://hooks.zapier.com/..."></div>\
        </div>\
        <div class="iglc-divider"></div>\
        <div class="iglc-section"><div class="iglc-section-title">Log</div><div class="iglc-log" id="iglc-log"><div class="iglc-log-entry info"><span class="iglc-log-time">' + logTime() + '</span>v1.3 — Scroll, bridge e revisão</div></div></div>\
        <div class="iglc-section"><div class="iglc-info-box"><strong>Dica:</strong> Use em uma <strong>conta auxiliar</strong> para coletar. Exporte JSON e importe no <strong>Organic</strong> (Load Saved Queue) na conta principal.</div></div>\
        </div>\
        <div id="iglc-view-reader" style="display:none;">\
          <div class="iglc-section">\
            <div id="iglc-reader-stats" class="iglc-reader-stats">\
              <div class="iglc-reader-placeholder">\
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#30363d" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>\
                <div style="color:#8b949e;font-size:13px;">Carregue um arquivo .json para organizar</div>\
                <button class="iglc-btn primary" id="iglc-reader-load-initial">📂 Carregar JSON</button>\
              </div>\
            </div>\
          </div>\
          <div class="iglc-section" id="iglc-reader-controls-section" style="display:none;">\
            <div class="iglc-reader-controls">\
              <input type="text" class="iglc-input iglc-reader-search-input" id="iglc-reader-search" placeholder="Buscar username ou nome...">\
              <select class="iglc-select" id="iglc-reader-type-filter">\
                <option value="all">Todos</option>\
                <option value="public">Públicos</option>\
                <option value="private">Privados</option>\
                <option value="verified">Verificados</option>\
                <option value="nopic">Sem Foto</option>\
              </select>\
            </div>\
          </div>\
          <div class="iglc-section" id="iglc-reader-table-section" style="display:none;">\
            <div id="iglc-reader-table" class="iglc-reader-table"></div>\
            <div id="iglc-reader-pagination" class="iglc-reader-pagination"></div>\
          </div>\
          <div class="iglc-section" id="iglc-reader-actions-section" style="display:none;">\
            <div class="iglc-section-title">Exportar Filtrado</div>\
            <div class="iglc-export-group" style="margin-bottom:8px;">\
              <button class="iglc-btn success" id="iglc-reader-export-json">JSON</button>\
              <button class="iglc-btn success" id="iglc-reader-export-csv">CSV</button>\
              <button class="iglc-btn success" id="iglc-reader-export-txt">TXT</button>\
            </div>\
            <div class="iglc-actions">\
              <button class="iglc-btn" id="iglc-reader-split">✂ Dividir em Partes</button>\
              <button class="iglc-btn" id="iglc-reader-dedup">🔄 Remover Duplicatas</button>\
              <button class="iglc-btn primary" id="iglc-reader-to-queue" style="background:linear-gradient(135deg,#6C5CE7,#A855F7);">📋 Enviar para o Organic</button>\
              <button class="iglc-btn" id="iglc-reader-merge">📂 Mesclar Lista</button>\
              <button class="iglc-btn" id="iglc-reader-load-another">📂 Carregar Outro</button>\
            </div>\
          </div>\
        </div>\
      </div>';
    document.body.appendChild(panel);
    bindEvents();
    loadSettings();
  }

  function bindEvents() {
    var bodyEl = document.querySelector("#igListCollectorPanel .iglc-body");
    if (bodyEl) {
      bodyEl.addEventListener("wheel", function(e) {
        var el = bodyEl;
        var atTop = el.scrollTop <= 0;
        var atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 2;
        if (e.deltaY < 0 && atTop) return;
        if (e.deltaY > 0 && atBottom) return;
        e.preventDefault();
        el.scrollTop += e.deltaY;
      }, { passive: false });
    }
    document.getElementById("iglc-close-btn").addEventListener("click", togglePanel);
    document.getElementById("iglc-btn-followers").addEventListener("click", function() { collectEdge("followers"); });
    document.getElementById("iglc-btn-following").addEventListener("click", function() { collectEdge("following"); });
    document.getElementById("iglc-btn-stop").addEventListener("click", stopCollection);
    document.getElementById("iglc-btn-refresh").addEventListener("click", function() { profileDetectAttempts = 0; detectProfile(); });
    document.getElementById("iglc-btn-api-refresh").addEventListener("click", refreshProfileFromAPI);
    document.getElementById("iglc-btn-manual").addEventListener("click", manualProfileEntry);
    document.getElementById("iglc-btn-hashtag").addEventListener("click", function () {
      var ht = getHashtagFromUrl();
      if (ht) { collectFromHashtag(ht); } else { var inp = prompt("Hashtag (sem #):"); if (inp) collectFromHashtag(inp.replace("#", "").trim()); }
    });
    document.getElementById("iglc-btn-location").addEventListener("click", function () {
      var loc = getLocationFromUrl();
      if (loc) { collectFromLocation(loc); } else { var inp = prompt("ID da localização:"); if (inp) collectFromLocation(inp.trim()); }
    });
    document.getElementById("iglc-btn-export-json").addEventListener("click", function() { exportList("json"); });
    document.getElementById("iglc-btn-export-csv").addEventListener("click", function() { exportList("csv"); });
    document.getElementById("iglc-btn-export-txt").addEventListener("click", function() { exportList("txt"); });
    document.getElementById("iglc-btn-import").addEventListener("click", importList);
    document.getElementById("iglc-btn-clear").addEventListener("click", function () { if (confirm("Limpar fila?")) { acctsQueue = []; updateUI(); log("Fila limpa", "info"); } });
    ["iglc-set-delay", "iglc-set-429", "iglc-set-403", "iglc-set-max"].forEach(function(id) { document.getElementById(id).addEventListener("change", saveSettings); });
    document.getElementById("iglc-set-autoexport").addEventListener("change", saveSettings);
    document.getElementById("iglc-set-autosend-organic").addEventListener("change", saveSettings);
    document.getElementById("iglc-btn-send-organic").addEventListener("click", function () {
      if (acctsQueue.length === 0) { log("Nenhuma conta na fila para enviar", "warn"); return; }
      if (typeof _iglcPushToOrganic === "function" && typeof _iglcIsOrganicAvailable === "function" && _iglcIsOrganicAvailable()) {
        var sent = _iglcPushToOrganic(acctsQueue);
        if (sent) { log("Enviado para o Organic! " + acctsQueue.length + " contas", "success"); }
        else { log("Erro ao enviar para o Organic", "error"); }
      } else {
        log("Organic nao detectado. Abra o Organic e recarregue a pagina.", "warn");
      }
    });
    document.getElementById("iglc-set-format").addEventListener("change", saveSettings);
    document.getElementById("iglc-set-notify-desktop").addEventListener("change", saveSettings);
    document.getElementById("iglc-set-notify-sound").addEventListener("change", saveSettings);
    document.getElementById("iglc-set-notify-email").addEventListener("change", saveSettings);
    document.getElementById("iglc-set-email").addEventListener("change", saveSettings);
    document.getElementById("iglc-set-notify-webhook").addEventListener("change", saveSettings);
    document.getElementById("iglc-set-webhook-url").addEventListener("change", saveSettings);

    // Filter events
    var filterToggle = document.getElementById("iglc-filter-toggle");
    var filterPanel = document.getElementById("iglc-filter-panel");
    var filterChevron = document.getElementById("iglc-filter-chevron");
    if (filterToggle && filterPanel && filterChevron) {
      filterToggle.addEventListener("click", function() {
        if (filterPanel.style.display === "none") {
          filterPanel.style.display = "block";
          filterChevron.textContent = "▾";
        } else {
          filterPanel.style.display = "none";
          filterChevron.textContent = "▸";
        }
      });
    }
    var btnApply = document.getElementById("iglc-btn-apply-filters"); if (btnApply) btnApply.addEventListener("click", applyFilters);
    var btnReset = document.getElementById("iglc-btn-reset-filters"); if (btnReset) btnReset.addEventListener("click", resetFilters);

    // Reader events
    document.getElementById("iglc-tab-collector").addEventListener("click", function () { switchView("collector"); });
    document.getElementById("iglc-tab-reader").addEventListener("click", function () { switchView("reader"); });
    document.getElementById("iglc-reader-load-initial").addEventListener("click", openListReader);
    document.getElementById("iglc-reader-search").addEventListener("input", readerApplyFilters);
    document.getElementById("iglc-reader-type-filter").addEventListener("change", readerApplyFilters);
    document.getElementById("iglc-reader-export-json").addEventListener("click", function () { readerExportFiltered("json"); });
    document.getElementById("iglc-reader-export-csv").addEventListener("click", function () { readerExportFiltered("csv"); });
    document.getElementById("iglc-reader-export-txt").addEventListener("click", function () { readerExportFiltered("txt"); });
    document.getElementById("iglc-reader-split").addEventListener("click", readerSplitExport);
    document.getElementById("iglc-reader-dedup").addEventListener("click", readerRemoveDuplicates);
    document.getElementById("iglc-reader-to-queue").addEventListener("click", readerSendToQueue);
    document.getElementById("iglc-reader-merge").addEventListener("click", readerMergeFile);
    document.getElementById("iglc-reader-load-another").addEventListener("click", openListReader);
  }

  function saveSettings() {
    var el = function (id) { return document.getElementById(id); };
    var d = el("iglc-set-delay"); var d429 = el("iglc-set-429"); var d403 = el("iglc-set-403"); var mx = el("iglc-set-max");
    if (d) settings.delayBetweenRequests = parseFloat(d.value) * 1000;
    if (d429) settings.delayAfter429 = parseFloat(d429.value) * 1000;
    if (d403) settings.delayAfter403 = parseFloat(d403.value) * 1000;
    if (mx) settings.maxAccounts = parseInt(mx.value, 10) || 0;
    var ae = el("iglc-set-autoexport"); if (ae) settings.autoExportOnDone = ae.checked;
    var asg = el("iglc-set-autosend-organic"); if (asg) settings.autoSendOrganic = asg.checked;
    var fmt = el("iglc-set-format"); if (fmt) settings.exportFormat = fmt.value;
    var nd = el("iglc-set-notify-desktop"); if (nd) settings.notifyDesktop = nd.checked;
    var ns = el("iglc-set-notify-sound"); if (ns) settings.notifySound = ns.checked;
    var ne = el("iglc-set-notify-email"); if (ne) settings.notifyEmail = ne.checked;
    var em = el("iglc-set-email"); if (em) settings.notifyEmailAddress = (em.value || "").trim();
    var nw = el("iglc-set-notify-webhook"); if (nw) settings.notifyWebhook = nw.checked;
    var wu = el("iglc-set-webhook-url"); if (wu) settings.notifyWebhookUrl = (wu.value || "").trim();
    var emailRow = document.getElementById("iglc-email-row");
    if (emailRow) emailRow.style.display = settings.notifyEmail ? "" : "none";
    var webhookRow = document.getElementById("iglc-webhook-row");
    if (webhookRow) webhookRow.style.display = settings.notifyWebhook ? "" : "none";
    if (settings.notifyDesktop) requestNotifPermission();
    chrome.storage.local.set({ iglc_settings: settings });
  }

  function loadSettings() {
    chrome.storage.local.get("iglc_settings", function (data) {
      if (data.iglc_settings) {
        Object.assign(settings, data.iglc_settings);
        document.getElementById("iglc-set-delay").value = settings.delayBetweenRequests / 1000;
        document.getElementById("iglc-set-429").value = settings.delayAfter429 / 1000;
        document.getElementById("iglc-set-403").value = settings.delayAfter403 / 1000;
        document.getElementById("iglc-set-max").value = settings.maxAccounts;
        document.getElementById("iglc-set-autoexport").checked = settings.autoExportOnDone;
        var asgEl = document.getElementById("iglc-set-autosend-organic");
        if (asgEl) asgEl.checked = settings.autoSendOrganic !== false;
        document.getElementById("iglc-set-format").value = settings.exportFormat;
        var ndEl = document.getElementById("iglc-set-notify-desktop");
        if (ndEl) ndEl.checked = settings.notifyDesktop !== false;
        var nsEl = document.getElementById("iglc-set-notify-sound");
        if (nsEl) nsEl.checked = settings.notifySound !== false;
        var neEl = document.getElementById("iglc-set-notify-email");
        if (neEl) neEl.checked = settings.notifyEmail;
        var emEl = document.getElementById("iglc-set-email");
        if (emEl) emEl.value = settings.notifyEmailAddress || "";
        var emailRow = document.getElementById("iglc-email-row");
        if (emailRow) emailRow.style.display = settings.notifyEmail ? "" : "none";
        var nwEl = document.getElementById("iglc-set-notify-webhook");
        if (nwEl) nwEl.checked = settings.notifyWebhook;
        var wuEl = document.getElementById("iglc-set-webhook-url");
        if (wuEl) wuEl.value = settings.notifyWebhookUrl || "";
        var webhookRow = document.getElementById("iglc-webhook-row");
        if (webhookRow) webhookRow.style.display = settings.notifyWebhook ? "" : "none";
      }
    });
    chrome.storage.local.get("iglc_lastQueue", function (data) {
      if (data.iglc_lastQueue && data.iglc_lastQueue.length > 0) {
        acctsQueue = data.iglc_lastQueue;
        updateUI();
        log("Fila anterior: " + acctsQueue.length + " contas", "info");
      }
    });
    loadFilters();
  }

  function updateProfileDisplay(profile, fallbackUsername) {
    var container = document.getElementById("iglc-profile-info");
    var btnF = document.getElementById("iglc-btn-followers");
    var btnG = document.getElementById("iglc-btn-following");
    if (!container) return;
    if (!profile) {
      if (fallbackUsername) {
        container.innerHTML = '<div style="color:#e3b341; font-size:12px;">@' + escapeHtml(fallbackUsername) + ' na URL mas sem dados da página.<br>Use <b>API (1 req)</b> ou <b>Manual</b>.</div>';
      } else {
        container.innerHTML = '<div style="color:#8b949e; font-size:12px;">Navegue até um perfil do Instagram</div>';
      }
      if (btnF) btnF.disabled = true;
      if (btnG) btnG.disabled = true;
      return;
    }
    var idWarn = profile.id ? "" : '<div style="color:#e3b341; font-size:10px; margin-top:4px;">⚠ Sem ID — será buscado via API ao iniciar coleta</div>';
    var safeUser = escapeHtml(profile.username);
    var picHtml = profile.profile_pic_url
      ? '<img class="iglc-profile-pic" src="' + escapeHtml(profile.profile_pic_url_hd || profile.profile_pic_url) + '" alt="' + safeUser + '">'
      : '<div class="iglc-profile-pic" style="background:#21262d; display:flex; align-items:center; justify-content:center; color:#58a6ff; font-size:18px; font-weight:700;">' + safeUser.charAt(0).toUpperCase() + '</div>';
    container.innerHTML = picHtml + '<div class="iglc-profile-details"><div class="iglc-profile-username">@' + safeUser + (profile.is_verified ? " ✓" : "") + (profile.is_private ? " 🔒" : "") + '</div><div class="iglc-profile-stats"><div><span>' + formatNumber(profile.edge_followed_by.count) + '</span> seguidores</div><div><span>' + formatNumber(profile.edge_follow.count) + '</span> seguindo</div></div>' + idWarn + '</div>';
    if (btnF) btnF.disabled = collecting;
    if (btnG) btnG.disabled = collecting;
  }

  function updateProgress() {
    var pc = document.getElementById("iglc-progress");
    var pb = document.getElementById("iglc-progress-bar");
    var cnt = document.getElementById("iglc-progress-count");
    var eta = document.getElementById("iglc-progress-eta");
    if (pc) pc.classList.add("active");
    if (cnt) cnt.textContent = formatNumber(acctsQueue.length);
    if (totalEstimated > 0 && pb) { pb.style.width = Math.min(100, (acctsQueue.length / totalEstimated) * 100) + "%"; }
    else if (pb) { pb.style.width = Math.min(95, pagesLoaded * 5) + "%"; }
    if (eta && acctsQueue.length > 0 && totalEstimated > 0) {
      var elapsed = Date.now() - startTime;
      var rate = acctsQueue.length / elapsed;
      var remaining = totalEstimated - acctsQueue.length;
      if (remaining > 0 && rate > 0) { eta.textContent = "ETA: ~" + formatDuration(remaining / rate); }
      else { eta.textContent = ""; }
    }
  }

  function updateUI() {
    var qc = document.getElementById("iglc-queue-count");
    if (qc) qc.textContent = acctsQueue.length;
    var has = acctsQueue.length > 0;
    var bj = document.getElementById("iglc-btn-export-json");
    var bc = document.getElementById("iglc-btn-export-csv");
    var bt = document.getElementById("iglc-btn-export-txt");
    if (bj) bj.disabled = !has;
    if (bc) bc.disabled = !has;
    if (bt) bt.disabled = !has;
    var stop = document.getElementById("iglc-btn-stop");
    var bf = document.getElementById("iglc-btn-followers");
    var bg = document.getElementById("iglc-btn-following");
    var bh = document.getElementById("iglc-btn-hashtag");
    var bl = document.getElementById("iglc-btn-location");
    if (collecting) {
      if (stop) stop.style.display = "";
      if (bf) bf.style.display = "none"; if (bg) bg.style.display = "none";
      if (bh) bh.style.display = "none"; if (bl) bl.style.display = "none";
    } else {
      if (stop) stop.style.display = "none";
      if (bf) bf.style.display = ""; if (bg) bg.style.display = "";
      if (bh) bh.style.display = ""; if (bl) bl.style.display = "";
      if (currentProfilePage) { if (bf) bf.disabled = false; if (bg) bg.disabled = false; }
    }
  }

  function setStatus(status) {
    var el = document.getElementById("iglc-status");
    var txt = document.getElementById("iglc-status-text");
    if (!el || !txt) return;
    el.className = "iglc-status " + status;
    var labels = { collecting: "Coletando...", paused: "Rate Limit", done: "Concluído", error: "Erro" };
    txt.textContent = labels[status] || status;
  }

  function togglePanel() {
    var panel = document.getElementById("igListCollectorPanel");
    if (!panel) return;
    panelVisible = !panelVisible;
    if (panelVisible) {
      panel.classList.remove("hidden");
      if (!collecting) { profileDetectAttempts = 0; detectProfile(); }
    } else { panel.classList.add("hidden"); }
  }

  // URL change detection
  var lastUrl = location.href;
  var urlObserver = new MutationObserver(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (panelVisible && !collecting) { profileDetectAttempts = 0; setTimeout(detectProfile, 1200); }
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Message handling (popup/bridge envia type: OPEN_COLLECTOR ou TOGGLE_COLLECTOR)
  chrome.runtime.onMessage.addListener(function (request) {
    if (request.toggleCollector || request.type === "TOGGLE_COLLECTOR") {
      if (!document.getElementById("igListCollectorPanel")) createPanel();
      togglePanel();
      return;
    }
    if (request.type === "OPEN_COLLECTOR") {
      if (!document.getElementById("igListCollectorPanel")) createPanel();
      var panel = document.getElementById("igListCollectorPanel");
      if (panel && panel.classList.contains("hidden")) {
        panelVisible = true;
        panel.classList.remove("hidden");
        if (!collecting) { profileDetectAttempts = 0; detectProfile(); }
      }
    }
  });

  // Auto-create (hidden) — ZERO API calls
  if (window.location.hostname.indexOf("instagram.com") > -1) {
    setTimeout(function () { createPanel(); }, 2000);
  }
})();
