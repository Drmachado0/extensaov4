/** 
 * Copyright (C) Organic 2016-2023 - All Rights Reserved
 *
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Organic <organicautomator@gmail.com>, 2016-2023
 */

// =========================================================
// LOVABLE INTEGRATION — Background Tasks (Alarms & Messages)
// =========================================================

// Registrar alarms para tarefas periódicas do Lovable
chrome.alarms.create('lovable-token-refresh', { periodInMinutes: 45 });
chrome.alarms.create('lovable-command-poll', { periodInMinutes: 1 }); // 60 segundos (era 45s)
chrome.alarms.create('lovable-heartbeat', { periodInMinutes: 5 });

// Marcar conta como offline quando o service worker for suspenso (Chrome fechado,
// extensão desativada ou aba do Instagram fechada por tempo prolongado).
// Sem isso, o dashboard mostra a conta como "online" por até 5 min após o fechamento.
chrome.runtime.onSuspend.addListener(async function () {
    try {
        var stored = await chrome.storage.local.get(['sb_ig_account_id', 'sb_access_token']);
        if (!stored.sb_ig_account_id || !stored.sb_access_token) return;

        var SUPABASE_URL = 'https://ebyruchdswmkuynthiqi.supabase.co';
        var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieXJ1Y2hkc3dta3V5bnRoaXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NDQyMzYsImV4cCI6MjA4NjEyMDIzNn0.fKuLCySRNC_YJzO4gNM5Um4WISneTiSyhhhJsW3Ho18';

        await fetch(
            SUPABASE_URL + '/rest/v1/ig_accounts?id=eq.' + encodeURIComponent(stored.sb_ig_account_id),
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + stored.sb_access_token,
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ bot_online: false, bot_status: 'offline' })
            }
        );
        console.log('[Lovable:BG] Conta marcada offline no suspend');
    } catch (e) {
        // onSuspend tem tempo limitado — não bloquear com erros
        console.warn('[Lovable:BG] Falha ao marcar offline:', e?.message || e);
    }
});

// Token refresh no background (para quando content script não está ativo)
async function lovableRefreshTokenInBackground() {
    try {
        var stored = await chrome.storage.local.get(['sb_access_token', 'sb_refresh_token', 'sb_token_expires_at']);
        if (!stored.sb_access_token || !stored.sb_refresh_token) return false;

        // Verificar se token expira em menos de 10 minutos
        if (stored.sb_token_expires_at && Date.now() < (stored.sb_token_expires_at - 10 * 60 * 1000)) return false;

        var SUPABASE_URL = 'https://ebyruchdswmkuynthiqi.supabase.co';
        var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieXJ1Y2hkc3dta3V5bnRoaXFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NDQyMzYsImV4cCI6MjA4NjEyMDIzNn0.fKuLCySRNC_YJzO4gNM5Um4WISneTiSyhhhJsW3Ho18';

        var res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
            body: JSON.stringify({ refresh_token: stored.sb_refresh_token })
        });

        if (res.ok) {
            var data = await res.json();
            await chrome.storage.local.set({
                sb_access_token: data.access_token,
                sb_refresh_token: data.refresh_token,
                sb_token_expires_at: Date.now() + (data.expires_in * 1000)
            });
            console.log('[Lovable:BG] Token renovado com sucesso');
            return true;
        } else {
            console.warn('[Lovable:BG] Falha ao renovar token:', res.status);
            return false;
        }
    } catch (e) {
        console.warn('[Lovable:BG] Erro ao renovar token:', e?.message || e);
        return false;
    }
}

chrome.alarms.onAlarm.addListener(async function (alarm) {
    if (!alarm.name.startsWith('lovable-')) return;

    if (alarm.name === 'lovable-token-refresh') {
        // PRIMEIRO: renovar o token no background
        await lovableRefreshTokenInBackground();
        // DEPOIS: notificar as tabs com o token atualizado
        sendMessageToInstagramTabs({ type: 'TOKEN_UPDATED' });
        return;
    }

    var messageType = null;
    if (alarm.name === 'lovable-command-poll') {
        messageType = 'LOVABLE_POLL_COMMANDS';
    } else if (alarm.name === 'lovable-heartbeat') {
        messageType = 'LOVABLE_HEARTBEAT';
    }

    if (messageType) {
        sendMessageToInstagramTabs({ type: messageType });
    }
});

// =========================================================
// IG LIST COLLECTOR — Mensagens de controle do painel
// =========================================================

// Escutar mensagens do popup para abrir/fechar o Collector
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === 'TOGGLE_COLLECTOR' || request.type === 'OPEN_COLLECTOR') {
    // Encaminhar para todas as abas do Instagram
    sendMessageToInstagramTabs({ type: request.type });
    sendResponse({ ok: true });
    return true;
  }
});

// =========================================================
// ORGANIC ORIGINAL CODE
// =========================================================

var mainOrganicTabId = 0;
var lastStoryAcct;
var clickedViewStoryTabIds = [];


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

    if (request.follow) {

        var u = request.follow;

        chrome.tabs.create({
            url: "https://www.instagram.com/" + u.username
        }, function(tab) {
            var tabId = tab.id;
            chrome.tabs.onUpdated.addListener(function(tabId, info) {
                if (info.status === 'complete') {

                    setTimeout(function() {
                        chrome.tabs.sendMessage(tab.id, {
                            hideOrganic: true
                        });

                        chrome.tabs.sendMessage(tab.id, {
                            clickSomething: 'button div[dir="auto"]:contains("Follow")'
                        });
                    }, 3000);

                    setTimeout(function() {
                        chrome.tabs.remove(tab.id);
                    }, 20000);
                }
            });
        });
    }


    if (request.openReelTab) {

        var shortcode = request.openReelTab.code || request.openReelTab.shortcode;

        chrome.tabs.create({
            url: "https://www.instagram.com/p/" + shortcode
        }, function(tab) {


            var createdTabId = tab.id;

            chrome.tabs.onUpdated.addListener(function(tabId, info) {
                if (info.status === 'complete' && createdTabId === tabId) {
                    chrome.tabs.sendMessage(tabId, {
                        hideOrganic: true
                    });

                    setTimeout(function() {
                        chrome.tabs.sendMessage(tabId, {
                            hideOrganic: true
                        });
                    }, 3000);


                    if (request.openReelTab.LikeWhenWatchingReel == true) {
                        setTimeout(function() {
                            // click Like
                            chrome.tabs.sendMessage(tabId, {
                                clickSomething: 'svg[aria-label="Like"][width="24"]',
                                parent: 'div[role="button"]'

                            });
                        }, (((request.openReelTab.video_duration || 20) * 750)));
                    }


                    if (request.openReelTab.SaveWhenWatchingReel == true) {
                        setTimeout(function() {
                            // click Save
                            chrome.tabs.sendMessage(tabId, {
                                clickSomething: 'svg[aria-label="Save"]',
                                parent: 'div[role="button"]'
                            });
                        }, (((request.openReelTab.video_duration || 20) * 750) + 2000));
                    }


                    setTimeout(function() {
                        chrome.tabs.remove(tab.id);
                    }, (((request.openReelTab.video_duration || 20) * 1000) + 1000));
                }
            });



        });

    }


    if (request.closeStoryTab) {
        console.log(mainOrganicTabId + ' closing ' + lastStoryAcct.username);

        var hasStory = clickedViewStoryTabIds.includes(request.closeStoryTab.tabId);

        chrome.tabs.sendMessage(mainOrganicTabId, {
            "closedStory": true,
            "acct": lastStoryAcct,
            "tabId": request.closeStoryTab.tabId,
            "viewed": hasStory
        });

        chrome.tabs.remove(request.closeStoryTab.tabId);
    }

    if (request.openStoryTab) {

        mainOrganicTabId = sender.tab.id;
        lastStoryAcct = request.openStoryTab.acct;


        console.log(mainOrganicTabId + ' opening ' + lastStoryAcct.username);


        chrome.tabs.create({
            url: "https://www.instagram.com/stories/" + request.openStoryTab.username
        }, function(tab) {

            var createdTabId = tab.id;

            chrome.tabs.onUpdated.addListener(function(tabId, info) {
                if (info.status === 'complete' && createdTabId == tabId) {

                    chrome.tabs.sendMessage(tabId, {
                        hideOrganic: true
                    });

                    setTimeout(function() {
                        chrome.tabs.sendMessage(tabId, {
                            hideOrganic: true
                        });
                    }, 3000);

                    if (clickedViewStoryTabIds.includes(tabId) == false) {
                        setTimeout(function() {
                            chrome.tabs.sendMessage(tabId, {
                                clickViewStory: true,
                                clickSomething: true,
                                tabId: tabId
                            });
                        }, 1234);
                    }

                    if (request.openStoryTab.LikeWhenWatchingStory == true) {
                        setTimeout(function() {
                            // click Like
                            chrome.tabs.sendMessage(tabId, {
                                clickSomething: 'svg[aria-label="Like"][width="24"]',
                                parent: 'div[role="button"]'

                            });
                        }, 3000);
                    }

                    // Reply to story (random chance)
                    if (request.openStoryTab.ReplyWhenWatchingStory == true) {
                        var probability = request.openStoryTab.ReplyProbability || 0.2;
                        if (Math.random() < probability) {
                            setTimeout(function() {
                                var templates = request.openStoryTab.ReplyTemplates || [];
                                if (templates.length > 0) {
                                    var replyText = templates[Math.floor(Math.random() * templates.length)];
                                    chrome.tabs.sendMessage(tabId, {
                                        replyToStory: true,
                                        replyText: replyText
                                    });
                                }
                            }, 5000);
                        }
                    }

                }
            });
        });

        return true;

    }

    if (request.viewedStory) {
        var tabId = sender.tab.id;
        if (clickedViewStoryTabIds.includes(tabId) == false) {
            clickedViewStoryTabIds.push(tabId);
        }
    }


    if (request.updatewanted && request.updatewanted == true) {
        gblIgBotUser.init();
    }

    if (request.guidCookie) {
        gblIgBotUser.overrideGuid(request.guidCookie);
    }

    if (request.ftOver == "true") {
        gblIgBotUser.overrideFT();
    }


    if (request.ig_user) {
        gblIgBotUser.ig_users.push(request.ig_user);
        gblIgBotUser.ig_users = uniq(gblIgBotUser.ig_users);
        gblIgBotUser.current_ig_username = request.ig_user.username;

        if (request.ig_user_account_stats) {
            gblIgBotUser.account_growth_stats.push(request.ig_user_account_stats);
            gblIgBotUser.account_growth_stats = uniq(gblIgBotUser.account_growth_stats);
        }

        checkInstallDate();

        gblIgBotUser.saveToLocal();
        gblIgBotUser.saveToServer();
    }

    if (request.fnc == 'openBuyScreen') {
        openBuyScreen();
    }

    sendResponse();

    return true;

});



var gblIgBotUser = {
    user_guid: undefined,
    install_date: new Date().toUTCString(),
    instabot_install_date: undefined,
    ig_users: [],
    licenses: {},
    actions: [{
        date: '',
        action: ''
    }],
    account_growth_stats: [],
    options: {},
    //      whitelist: [],
    //      savedQueue: [{ name: 'q1',date:datetime,queue:[]},{ name: 'q1',date:datetime,queue:[]}]
    init: async function() {

        runWinVarsScript();

        this.user_guid = await this.getPref('organic_user_guid');

        if (!this.user_guid || this.user_guid == false) {
            this.user_guid = this.uuidGenerator();
            this.setPref('organic_user_guid', this.user_guid);
        }

        //checkInstallDate();

    },
    overrideGuid: function(newGuid) {
        this.user_guid = newGuid;
        this.setPref('organic_user_guid', this.user_guid);
    },
    overrideFT: function() {
        this.instabot_free_trial_time = 0;
        openBuyScreen();
    },
    uuidGenerator: function() {
        var S4 = function() {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        };
        return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
    },
    getPref: async function(name) {
        return new Promise(function(resolve) {
            chrome.storage.local.get(name, function(value) {
                if (Object.keys(value).length > 0) {
                    resolve(value[name]);
                } else {
                    resolve(false);
                }
            });
        });
    },
    setPref: async function(name, value) {
        chrome.storage.local.set({
            [name]: value
        }, function() {});
    },
    saveToLocal: function() {
        chrome.storage.local.set({
            'igBotUser': JSON.stringify(gblIgBotUser)
        }, function() {});
    },
    saveToServer: function() {
        for (var i = 0; i < this.ig_users.length; i++) {
            fetch("https://www.organicforfollowers.com/igBotUser/", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'user_guid': this.user_guid,
                    'ig_username': this.current_ig_username,
                    'install_date': this.install_date,
                    'instabot_install_date': this.instabot_install_date
                })
            });
        }
    }
};


var instabot_free_trial_time = 259200000; // 129600000 = 36 hours, 259200000 = 72 hours, 604800000=7 days, 1296000000 = 14 days, 2592000000 = 30 days
var first_run = false;
var todaysdate = new Date();
var today = todaysdate.getTime();
var timeSinceInstall;

// Nota: O popup Lovable agora é o default_popup da extensão.
// O clique no ícone abre o popup automaticamente.
// Para abrir/toggle o Organic no Instagram, usar o atalho de teclado ou 
// o popup envia mensagem para a tab ativa.

// Fallback: Se o popup não estiver configurado, manter comportamento original
// (este listener não será chamado quando default_popup está ativo)
chrome.action.onClicked.addListener(function(tab) {
    chrome.tabs.query({
        url: ["https://www.instagram.com/", "https://www.instagram.com/*"],
        currentWindow: true
    }, tabs => {
        if (tabs.length === 0) {
            chrome.tabs.create({
                url: 'https://www.instagram.com/'
            }, function(tab) {
                chrome.tabs.sendMessage(tab.id, {
                    "openOrganic": true,
                    igBotUser: gblIgBotUser
                });
            });
        } else {
            var toggled = false;
            for (var i = 0; i < tabs.length; i++) {
                if (tabs[i].active === true) {
                    toggled = true;
                    chrome.tabs.sendMessage(tabs[i].id, {
                        "toggleOrganic": true,
                        igBotUser: gblIgBotUser
                    });
                }
            }
            if (toggled === false) {
                chrome.tabs.update(tabs[0].id, {
                    active: true
                });
                chrome.tabs.sendMessage(tabs[0].id, {
                    "openOrganic": true,
                    igBotUser: gblIgBotUser
                });
            }
        }
    });
});


chrome.runtime.onInstalled.addListener(installedOrUpdated);

function installedOrUpdated() {
    gblIgBotUser.init();

    chrome.tabs.create({
        url: "https://www.instagram.com"
    }, function(tab) {

        setTimeout(function() {
            sendMessageToInstagramTabs({
                "extension_updated": true
            });
        }, 5000);

    });
}

function runWinVarsScript() {
    chrome.tabs.query({
        url: ["https://www.instagram.com/*", "https://www.instagram.com/"]
    }, tabs => {
        for (var i = 0; i < tabs.length; i++) {
            var igTabId = tabs[i].id;
            chrome.scripting.executeScript({
                    target: {
                        tabId: igTabId
                    },
                    files: ['winvars.js'],
                    world: 'MAIN'
                },
                function() {});
        }
    });
}


async function checkInstallDate() {

    var installDate = await gblIgBotUser.getPref('instabot_install_date');

    if (installDate == false) {
        first_run = true;
        installDate = '' + today;
        gblIgBotUser.setPref('instabot_install_date', installDate);
    }

    gblIgBotUser.instabot_install_date = installDate;

    // string -> int -> date -> UTCString for python
    gblIgBotUser.install_date = new Date(+installDate).toUTCString();
    timeSinceInstall = today - installDate;
    checkLicenseOnServer();

}

function sendMessageToInstagramTabs(message) {
    chrome.tabs.query({
        url: ["https://www.instagram.com/", "https://www.instagram.com/*", "https://www.organicforfollowers.com/*"]
    }, function(tabs) {
        //if (tabs.length == 0) return false;
        for (var i = 0; i < tabs.length; i++) {
            chrome.tabs.sendMessage(tabs[i].id, message).then(response => {
                // console.log("Message from the content script:");
                // console.log(response.response);
            }).catch(function() {
                // console.log('error when: ' + message);
                // console.log(message);
            });
        }
    });
}


function onError(error) {
    //console.error(`Error: ${error}`);
}

function checkLicenseOnServer() {
    var url = 'https://www.organicforfollowers.com/check_subscription.php?guid=' + gblIgBotUser.user_guid + '&ign=' + btoa(gblIgBotUser.current_ig_username);
    console.log(url);
    fetch(url, {
            method: 'GET'
        })
        .then(response => response.text())
        .then(function(data) {
            console.log(data);

            if (parseInt(data) == 1) {
                allLicensesFetched(1, {
                    "organic_license": 1
                });
            } else if (parseInt(data) == 2) {
                allLicensesFetched(2, {});
            } else {
                allLicensesFetched(1, {});
            }

        });
}

function allLicensesFetched(count, licenses) {
    // Sempre tratar como licenciado para uso local/teste (sem bloqueio de trial ou subscribe)
    sendMessageToInstagramTabs({
        "instabot_install_date": gblIgBotUser.instabot_install_date,
        "instabot_free_trial_time": instabot_free_trial_time,
        "instabot_has_license": true,
        igBotUser: gblIgBotUser
    });

    gblIgBotUser.licenses = licenses || {};
    gblIgBotUser.saveToLocal();
}


function openBuyScreen() {
    //console.log(gblIgBotUser);
    sendMessageToInstagramTabs({
        "openBuyScreen": true,
        igBotUser: gblIgBotUser,
        "instabot_free_trial_time": instabot_free_trial_time
    });
}


function uniq(ar) {
    return Array.from(new Set(ar.map(JSON.stringify))).map(JSON.parse);
}