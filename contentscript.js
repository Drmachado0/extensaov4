/** 
 * Copyright (C) Organic 2016-2023 - All Rights Reserved
 *
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Proprietary and confidential
 * Written by Organic <organicautomator@gmail.com>, 2016-2023
 */

var guidCookie = localStorage['gbUserGuid'];
var urlAcctInfo2 = 'https://www.instagram.com/';
var urlAcctInfo = 'https://i.instagram.com/api/v1/users/web_profile_info/?username=';
var urlAcctInfo3 = 'https://i.instagram.com/api/v1/users/${userid}/info/'; //has public_email

/*

SAVE USERNAME AND IP TO METADATA WHEN LOADING SUBSCRIPTION

Button hover states

- FILTERS
    connected_fb_page
    has_channel
    business_category_name
    highlight_reel_count
    last post date** - handle private accounts
    first post date**
    average posts per day?

- option to block client events

1) auto like when people comment your images
2) auto reply to comments (not sure if this is a must have feature tho).

make tour
video tour?  ttsreader.com

Add Google analytics

auto unfollow
schedule unfollowing
    - background page messaging

progress bars!
https://loading.io/progress/
https://kimmobrunfeldt.github.io/progressbar.js/

<meter
  min="0"
  max="100"
  low="25"
  high="75"
  optimum="80"
  value="50"
></meter>


6) Could you integrate a location based filtering system? For an example google coordinate paste + radius

button to clear already attempted or load as queue

Make quick "Unlike" or make sure to show user info for each pic.

Anyway you can randomize the post likes
My guess IG would spot you liking 1 post on every follow.
It would be nice if you could randomize likes and randomize frequency on this option.
For example every 3 to 10 (Random) follows like (1-5 posts) Random.

https://stackoverflow.com/questions/16758316/where-do-i-find-the-instagram-media-id-of-a-image

*/


var gblActionsQueue = [];

function prettyDate(dataString) {

    if (dataString == false) return '-';

    var d = new Date(dataString);
    //var datePart = d.toISOString().slice(0, 10);

    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');

    var datePart = year + '-' + month + '-' + day;

    // var timePart = d.toLocaleString([], {
    //     hour: '2-digit',
    //     minute: '2-digit'
    // });


    var timePart = d.getHours() + ':' + d.getMinutes();

    dataString = datePart + ' ' + timePart;
    return dataString;
}

function loadActionsQueue() {
    chrome.storage.local.get("gblActionsQueue", function(data) {
        if (typeof data.gblActionsQueue != 'undefined') {
            gblActionsQueue = data.gblActionsQueue;

            $('#tblScheduledActions').hide();
            $('#tblScheduledActions tbody').html('');


            for (var i = 0; i < gblActionsQueue.length; i++) {

                var tr = '<tr>';
                tr = tr + '<td>' + i + '</td>';
                tr = tr + '<td>' + gblActionsQueue[i].functionAlias + '</td>';
                tr = tr + '<td>' + gblActionsQueue[i].scheduledTime.replace('T', ' ') + '</td>';
                tr = tr + '<td>' + prettyDate(gblActionsQueue[i].ranAt) + '</td>';
                tr = tr + '<td>' + gblActionsQueue[i].repeatDaily + '</td>';
                tr = tr + '<td style="text-align: center;"><span class="minus-sign" data-scheduled-action="' + i + '">&minus;</span></td>';
                tr = tr + '</tr>';

                $('#tblScheduledActions tbody').append(tr);
                $('#tblScheduledActions').show();

            }


            $('#tblScheduledActions .minus-sign').click(function() {
                var pos = $(this).attr('data-scheduled-action');
                gblActionsQueue.splice(pos, 1);
                saveActionsQueue();
                setTimeout(loadActionsQueue, 100);
            })


        }
    });
}


function organicActionRunner() {

    var now = new Date();
    var nowTime = now.getTime();
    var nowDate = now.getDate();
    var yesterday = nowTime - (24 * 59 * 60 * 1000);
    var oneMinuteAgo = nowTime - 60000;

    $('#currentTime').html('Current Time: ' + prettyDate(nowTime));

    for (var i = 0; i < gblActionsQueue.length; i++) {


        if (gblActionsQueue[i].enabled == true) {

            var shouldRunNow = false;
            var ranToday = true;
            var scheduledTime = new Date(gblActionsQueue[i].scheduledTime).getTime();
            var scheduledDate = new Date(gblActionsQueue[i].scheduledTime).getDate();


            // hack the scheduled time to be today if the scheduled time date has past and it's a daily repeater
            if (scheduledDate < nowDate && gblActionsQueue[i].repeatDaily == true) {
                var daysAgo = nowDate - scheduledDate;
                scheduledTime = new Date(scheduledTime + (daysAgo * 86400000));
            }

            if (gblActionsQueue[i].ranAt < yesterday && gblActionsQueue[i].repeatDaily == true) {
                // it ran, but that was more than 24 hours ago
                ranToday = false;
            }

            if (gblActionsQueue[i].ranAt == false) {
                // it never ran
                ranToday = false;
            }

            // the scheduled time has past
            if (scheduledTime < nowTime && ranToday == false) {
                shouldRunNow = true;
            }

            // it's stale, organic wasn't running when the time came
            if (scheduledTime < oneMinuteAgo) {
                shouldRunNow = false;
            }


            if (shouldRunNow == true) {

                window[gblActionsQueue[i].functionName](arguments);
                gblActionsQueue[i].ranAt = nowTime;

                saveActionsQueue();
                setTimeout(loadActionsQueue, 100);
            }

        }
    }



}

function saveActionsQueue() {
    chrome.storage.local.set({
        gblActionsQueue: gblActionsQueue
    });
}

function btnAddScheduledAction() {

    // targetAccount
    // targetMedia
    // api endpoint
    // api method
    // nextfunction / callback

    // on failure delay all actions?


    // - result status code
    // - depends on other action?

    var yesterday = new Date(new Date().getTime() - (24 * 60 * 60 * 1000)).getTime();


    var action = {
        functionName: $('#scheduled_action_function_name').val(),
        functionAlias: $('#scheduled_action_function_name option:selected').text(),
        scheduledTime: $('#scheduled_action_scheduled_time').val(),
        ranAt: false,
        repeatDaily: $('#scheduled_action_repeat')[0].checked,
        enabled: true
    }


    gblActionsQueue.push(action);

    saveActionsQueue();

    setTimeout(loadActionsQueue, 100);
}

const igExternalVars = {
    "emptyProfilePicUrl": "44884218_345707102882519_2446069589734326272_n",
    "qsForConvenienceButtons": "._aacl._aaco._aacw._aacx._aad6._aade",
    "qsForProfilePageUsername": "a.x1i10hfl h2.x1lliihq"
}

var gblAcctsQueueGrid;
var gblCheckboxPlugin;

var instabot_install_date = 0; // set from background page
var instabot_free_trial_time = 0; // set from background page
var instabot_has_license = false;

var defaultFilterOptions = {
    applyFiltersAutomatically: true,
    followers: [0, 10000000],
    following: [0, 10000],
    followRatio: [-10000, 10000000],
    mutualFollowedBy: [0, 10000000],
    posts: [0, 100000],
    lastPosted: [0, 5000],
    private: true,
    non_private: true,
    verified: true,
    non_verified: true,
    follows_me: false,
    non_follows_me: true,
    followed_by_me: false,
    non_followed_by_me: true,
    external_url_contains: false,
    external_url_not_contains: false,
    external_url_contains_text: '',
    external_url_not_contains_text: '',
    is_business_account: true,
    non_is_business_account: true,
    is_joined_recently: true,
    non_is_joined_recently: true,
    connected_fb_page: true,
    non_connected_fb_page: true,
    bio_contains: false,
    bio_not_contains: false,
    bio_contains_text: '',
    bio_not_contains_text: '',
    no_profile_pic: true,
    profile_pic: true,
    business_category_name_contains: false,
    business_category_name_contains_text: '',
    business_category_name_not_contains: false,
    business_category_name_not_contains_text: ''
};


var gbDefaultColumns = [{
    "name": '✓',
    "data": 'id',
    "width": '40px',
    "formatter": '<input type="checkbox" id="cb_${cell}" value="${cell}" />',
    "visible": true,
}, {
    "name": 'Pic',
    "data": 'profile_pic_url',
    "formatter": '<label for="cb_${ig_id}"><img data-ig-userid="${ig_id}" data-src="${cell}" class="igBotQueueAcctProfilePicture"/></label>',
    "sort": false,
    "width": '62px',
    "visible": true
}, {
    "name": '@username',
    "data": 'username',
    "formatter": '<a href="https://www.instagram.com/${cell}" target="_blank">@${cell}</a>',
    "width": '165px',
    "visible": true
}, {
    "name": 'Full Name',
    "data": 'full_name',
    "width": '150px',
    "visible": true
}, {
    "name": 'Bio',
    "data": 'biography',
    "width": '300px',
    "visible": true
}, {
    "name": 'Clips',
    "data": 'has_clips',
    "width": '95px',
    "visible": true
}, {
    "name": 'Highlights',
    "data": 'highlight_reel_count',
    "width": '95px',
    "visible": true
}, {
    "name": 'Posts',
    "data": 'edge_owner_to_timeline_media.count',
    "width": '65px',
    "visible": true
}, {
    "name": 'Link In Bio',
    "data": 'external_url',
    "formatter": '<a href="${cell}" title="${cell}" target="_blank">${cell}</a>',
    "width": '250px',
    "visible": true
}, {
    "name": 'Followers',
    "data": 'edge_followed_by.count',
    "width": '90px',
    "visible": true
}, {
    "name": 'Following',
    "data": 'edge_follow.count',
    "width": '90px',
    "visible": true
}, {
    "name": 'Ratio',
    "data": 'followRatio',
    "width": '65px',
    "visible": true
}, {
    "name": 'Mutual',
    "data": 'edge_mutual_followed_by.count',
    "width": '70px',
    "visible": true,
    "numeric": true
}, {
    "name": 'Followed By Me',
    "data": 'followed_by_viewer',
    "width": '120px',
    "visible": true,
    "bool": true
}, {
    "name": 'Follows Me',
    "data": 'follows_viewer',
    "width": '95px',
    "visible": true,
    "bool": true
}, {
    "name": 'Requested',
    "data": 'requested_by_viewer',
    "width": '95px',
    "visible": true,
    "bool": true
}, {
    "name": 'Joined Recently',
    "data": 'is_joined_recently',
    "width": '100px',
    "visible": true,
    "bool": true
}, {
    "name": 'Private',
    "data": 'is_private',
    "width": '70px',
    "visible": true,
    "bool": true
}, {
    "name": 'Verified',
    "data": 'is_verified',
    "width": '70px',
    "visible": true,
    "bool": true
}, {
    "name": 'Business Category',
    "data": 'business_category_name',
    "width": '150px',
    "visible": true
}, {
    "name": 'Pronouns',
    "data": 'pronouns',
    "width": '90px',
    "visible": true
}, {
    "name": 'Last Posted',
    "data": 'lastPostDateInDays',
    "width": '100px',
    "visible": true
}, {
    "name": "Contact Phone Number",
    "data": "contact_phone_number",
    "visible": true
}, {
    "name": "Public Email",
    "data": "public_email",
    "visible": true
}, {
    "name": "Address Street",
    "data": "address_street",
    "visible": true
}, {
    "name": "City Name",
    "data": "city_name",
    "visible": true
}, {
    "name": "Zip",
    "data": "zip",
    "visible": true
}, {
    "name": "Latitude",
    "data": "latitude",
    "visible": true
}, {
    "name": "Longitude",
    "data": "longitude",
    "visible": true
}, {
    "name": "Primary Profile Link Type",
    "data": "primary_profile_link_type",
    "visible": false
}, {
    "name": "Show Fb Link On Profile",
    "data": "show_fb_link_on_profile",
    "visible": false
}, {
    "name": "Show Fb Page Link On Profile",
    "data": "show_fb_page_link_on_profile",
    "visible": false
}, {
    "name": "Can Hide Category",
    "data": "can_hide_category",
    "visible": false,
    "bool": true
}, {
    "name": "Smb Support Partner",
    "data": "smb_support_partner",
    "visible": false
}, {
    "name": "Current Catalog Id",
    "data": "current_catalog_id",
    "visible": false
}, {
    "name": "Mini Shop Seller Onboarding Status",
    "data": "mini_shop_seller_onboarding_status",
    "visible": false
}, {
    "name": "Account Category",
    "data": "account_category",
    "visible": false
}, {
    "name": "Can Add Fb Group Link On Profile",
    "data": "can_add_fb_group_link_on_profile",
    "visible": false,
    "bool": true
}, {
    "name": "Can Use Affiliate Partnership Messaging As Creator",
    "data": "can_use_affiliate_partnership_messaging_as_creator",
    "visible": false,
    "bool": true
}, {
    "name": "Can Use Affiliate Partnership Messaging As Brand",
    "data": "can_use_affiliate_partnership_messaging_as_brand",
    "visible": false
}, {
    "name": "Existing User Age Collection Enabled",
    "data": "existing_user_age_collection_enabled",
    "visible": false,
    "bool": true
}, {
    "name": "Feed Post Reshare Disabled",
    "data": "feed_post_reshare_disabled",
    "visible": false,
    "bool": true
}, {
    "name": "Has Public Tab Threads",
    "data": "has_public_tab_threads",
    "visible": false,
    "bool": true
}, {
    "name": "Highlight Reshare Disabled",
    "data": "highlight_reshare_disabled",
    "visible": false,
    "bool": true
}, {
    "name": "Include Direct Blacklist Status",
    "data": "include_direct_blacklist_status",
    "visible": false,
    "bool": true
}, {
    "name": "Is Direct Roll Call Enabled",
    "data": "is_direct_roll_call_enabled",
    "visible": false,
    "bool": true
}, {
    "name": "Pk",
    "data": "pk",
    "visible": false
}, {
    "name": "Pk Id",
    "data": "pk_id",
    "visible": false
}, {
    "name": "Profile Type",
    "data": "profile_type",
    "visible": false
}, {
    "name": "Show Ig App Switcher Badge",
    "data": "show_ig_app_switcher_badge",
    "visible": false,
    "bool": true
}, {
    "name": "Show Post Insights Entry Point",
    "data": "show_post_insights_entry_point",
    "visible": false,
    "bool": true
}, {
    "name": "Show Text Post App Badge",
    "data": "show_text_post_app_badge",
    "visible": false,
    "bool": true
}, {
    "name": "Show Text Post App Switcher Badge",
    "data": "show_text_post_app_switcher_badge",
    "visible": false,
    "bool": true
}, {
    "name": "Text Post App Joiner Number Label",
    "data": "text_post_app_joiner_number_label",
    "visible": false
}, {
    "name": "Third Party Downloads Enabled",
    "data": "third_party_downloads_enabled",
    "visible": false,
    "bool": true
}, {
    "name": "Is Profile Picture Expansion Enabled",
    "data": "is_profile_picture_expansion_enabled",
    "visible": false,
    "bool": true
}, {
    "name": "Is Opal Enabled",
    "data": "is_opal_enabled",
    "visible": false,
    "bool": true
}, {
    "name": "Can Hide Public Contacts",
    "data": "can_hide_public_contacts",
    "visible": false,
    "bool": true
}, {
    "name": "Is Category Tappable",
    "data": "is_category_tappable",
    "visible": false,
    "bool": true
}, {
    "name": "Is Eligible For Smb Support Flow",
    "data": "is_eligible_for_smb_support_flow",
    "visible": false,
    "bool": true
}, {
    "name": "Is Eligible For Lead Center",
    "data": "is_eligible_for_lead_center",
    "visible": false,
    "bool": true
}, {
    "name": "Lead Details App Id",
    "data": "lead_details_app_id",
    "visible": false,
    "bool": true
}, {
    "name": "Direct Messaging",
    "data": "direct_messaging",
    "visible": false
}, {
    "name": "Fb Page Call To Action Id",
    "data": "fb_page_call_to_action_id",
    "visible": false
}, {
    "name": "Displayed Action Button Partner",
    "data": "displayed_action_button_partner",
    "visible": false
}, {
    "name": "Smb Delivery Partner",
    "data": "smb_delivery_partner",
    "visible": false
}, {
    "name": "Smb Support Delivery Partner",
    "data": "smb_support_delivery_partner",
    "visible": false
}, {
    "name": "Displayed Action Button Type",
    "data": "displayed_action_button_type",
    "visible": false
}, {
    "name": "Is Call To Action Enabled",
    "data": "is_call_to_action_enabled",
    "visible": false,
    "bool": true
}, {
    "name": "Shopping Post Onboard Nux Type",
    "data": "shopping_post_onboard_nux_type",
    "visible": false
}, {
    "name": "Ads Incentive Expiration Date",
    "data": "ads_incentive_expiration_date",
    "visible": false
}, {
    "name": "Account Badges",
    "data": "account_badges",
    "visible": false
}, {
    "name": "Auto Expand Chaining",
    "data": "auto_expand_chaining",
    "visible": false
}, {
    "name": "Birthday Today Visibility For Viewer",
    "data": "birthday_today_visibility_for_viewer",
    "visible": false
}, {
    "name": "Can Use Branded Content Discovery As Brand",
    "data": "can_use_branded_content_discovery_as_brand",
    "visible": false
}, {
    "name": "Can Use Branded Content Discovery As Creator",
    "data": "can_use_branded_content_discovery_as_creator",
    "visible": false
}, {
    "name": "Remove Message Entrypoint",
    "data": "remove_message_entrypoint",
    "visible": false
}, {
    "name": "Is Eligible For Request Message",
    "data": "is_eligible_for_request_message",
    "visible": false,
    "bool": true
}, {
    "name": "Transparency Product Enabled",
    "data": "transparency_product_enabled",
    "visible": false,
    "bool": true
}, {
    "name": "Whatsapp Number",
    "data": "whatsapp_number",
    "visible": false
}, {
    "name": "Merchant Checkout Style",
    "data": "merchant_checkout_style",
    "visible": false
}, {
    "name": "Mutual Followers Count",
    "data": "mutual_followers_count",
    "visible": false
}, {
    "name": "Nametag",
    "data": "nametag",
    "visible": false
}, {
    "name": "Open External Url With In App Browser",
    "data": "open_external_url_with_in_app_browser",
    "visible": false,
    "bool": true
}, {
    "name": "Pinned Channels Info",
    "data": "pinned_channels_info",
    "visible": false
}, {
    "name": "Profile Context",
    "data": "profile_context",
    "visible": false
}, {
    "name": "Profile Context Facepile Users",
    "data": "profile_context_facepile_users",
    "visible": false
}, {
    "name": "Profile Context Links With User Ids",
    "data": "profile_context_links_with_user_ids",
    "visible": false
}, {
    "name": "Profile Context Mutual Follow Ids",
    "data": "profile_context_mutual_follow_ids",
    "visible": false
}, {
    "name": "Profile Pic Id",
    "data": "profile_pic_id",
    "visible": false
}, {
    "name": "Recon Features",
    "data": "recon_features",
    "visible": false
}, {
    "name": "Relevant News Regulation Locations",
    "data": "relevant_news_regulation_locations",
    "visible": false
}, {
    "name": "Seller Shoppable Feed Type",
    "data": "seller_shoppable_feed_type",
    "visible": false
}, {
    "name": "Show Shoppable Feed",
    "data": "show_shoppable_feed",
    "visible": false,
    "bool": true
}, {
    "name": "Text Post App Badge Label",
    "data": "text_post_app_badge_label",
    "visible": false
}, {
    "name": "Total Ar Effects",
    "data": "total_ar_effects",
    "visible": false
}, {
    "name": "Is Memorialized",
    "data": "is_memorialized",
    "visible": false
}, {
    "name": "Is Potential Business",
    "data": "is_potential_business",
    "visible": false,
    "bool": true
}, {
    "name": "Is Profile Broadcast Sharing Enabled",
    "data": "is_profile_broadcast_sharing_enabled",
    "visible": false,
    "bool": true
}, {
    "name": "Is Recon Ad Cta On Profile Eligible With Viewer",
    "data": "is_recon_ad_cta_on_profile_eligible_with_viewer",
    "visible": false,
    "bool": true
}, {
    "name": "Is Supervision Features Enabled",
    "data": "is_supervision_features_enabled",
    "visible": false,
    "bool": true
}, {
    "name": "Is Whatsapp Linked",
    "data": "is_whatsapp_linked",
    "visible": false,
    "bool": true
}, {
    "name": "Latest Besties Reel Media",
    "data": "latest_besties_reel_media",
    "visible": false
}, {
    "name": "Num Of Admined Pages",
    "data": "num_of_admined_pages",
    "visible": false
}, {
    "name": "Page Id",
    "data": "page_id",
    "visible": false
}, {
    "name": "Page Name",
    "data": "page_name",
    "visible": false
}, {
    "name": "Ads Page Id",
    "data": "ads_page_id",
    "visible": false
}, {
    "name": "Ads Page Name",
    "data": "ads_page_name",
    "visible": false
}, {
    "name": "Charity Profile Fundraiser Info",
    "data": "charity_profile_fundraiser_info",
    "visible": false
}, {
    "name": "Creator Shopping Info",
    "data": "creator_shopping_info",
    "visible": false
}, {
    "name": "Fan Club Info",
    "data": "fan_club_info",
    "visible": false
}, {
    "name": "Follow Friction Type",
    "data": "follow_friction_type",
    "visible": false
}, {
    "name": "Follower Count",
    "data": "follower_count",
    "visible": false
}, {
    "name": "Following Count",
    "data": "following_count",
    "visible": false
}, {
    "name": "Has Active Charity Business Profile Fundraiser",
    "data": "has_active_charity_business_profile_fundraiser",
    "visible": false,
    "bool": true
}, {
    "name": "Has Anonymous Profile Picture",
    "data": "has_anonymous_profile_picture",
    "visible": false,
    "bool": true
}, {
    "name": "Has Collab Collections",
    "data": "has_collab_collections",
    "visible": false,
    "bool": true
}, {
    "name": "Has Exclusive Feed Content",
    "data": "has_exclusive_feed_content",
    "visible": false,
    "bool": true
}, {
    "name": "Has Fan Club Subscriptions",
    "data": "has_fan_club_subscriptions",
    "visible": false,
    "bool": true
}, {
    "name": "Has Highlight Reels",
    "data": "has_highlight_reels",
    "visible": false,
    "bool": true
}, {
    "name": "Has Igtv Series",
    "data": "has_igtv_series",
    "visible": false,
    "bool": true
}, {
    "name": "Has Music On Profile",
    "data": "has_music_on_profile",
    "visible": false,
    "bool": true
}, {
    "name": "Has Private Collections",
    "data": "has_private_collections",
    "visible": false,
    "bool": true
}, {
    "name": "Has Videos",
    "data": "has_videos",
    "visible": false,
    "bool": true
}, {
    "name": "Hd Profile Pic Url Info",
    "data": "hd_profile_pic_url_info",
    "visible": false
}, {
    "name": "Hd Profile Pic Versions",
    "data": "hd_profile_pic_versions",
    "visible": false
}, {
    "name": "Interop Messaging User Fbid",
    "data": "interop_messaging_user_fbid",
    "visible": false
}, {
    "name": "Is Bestie",
    "data": "is_bestie",
    "visible": false,
    "bool": true
}, {
    "name": "Is Eligible For Diverse Owned Business Info",
    "data": "is_eligible_for_diverse_owned_business_info",
    "visible": false,
    "bool": true
}, {
    "name": "Is Eligible For Meta Verified Links In Reels",
    "data": "is_eligible_for_meta_verified_links_in_reels",
    "visible": false,
    "bool": true
}, {
    "name": "Is Eligible For Meta Verified Enhanced Link Sheet",
    "data": "is_eligible_for_meta_verified_enhanced_link_sheet",
    "visible": false,
    "bool": true
}, {
    "name": "Is Eligible To Display Diverse Owned Business Info",
    "data": "is_eligible_to_display_diverse_owned_business_info",
    "visible": false,
    "bool": true
}, {
    "name": "Is Facebook Onboarded Charity",
    "data": "is_facebook_onboarded_charity",
    "visible": false,
    "bool": true
}, {
    "name": "Is Favorite",
    "data": "is_favorite",
    "visible": false,
    "bool": true
}, {
    "name": "Is In Canada",
    "data": "is_in_canada",
    "visible": false,
    "bool": true
}, {
    "name": "Strong Id  ",
    "data": "strong_id__",
    "visible": false
}, {
    "name": "External Lynx Url",
    "data": "external_lynx_url",
    "visible": false
}, {
    "name": "Is Interest Account",
    "data": "is_interest_account",
    "visible": false,
    "bool": true
}, {
    "name": "Latest Reel Media",
    "data": "latest_reel_media",
    "visible": false
}, {
    "name": "Media Count",
    "data": "media_count",
    "visible": false
}, {
    "name": "Total Clips Count",
    "data": "total_clips_count",
    "visible": false
}, {
    "name": "Total Igtv Videos",
    "data": "total_igtv_videos",
    "visible": false
}, {
    "name": "Recs From Friends",
    "data": "recs_from_friends",
    "visible": false
}, {
    "name": "City Id",
    "data": "city_id",
    "visible": false
}, {
    "name": "Public Phone Country Code",
    "data": "public_phone_country_code",
    "visible": false
}, {
    "name": "Public Phone Number",
    "data": "public_phone_number",
    "visible": false
}, {
    "name": "Professional Conversion Suggested Account Type",
    "data": "professional_conversion_suggested_account_type",
    "visible": false
}, {
    "name": "Account Type",
    "data": "account_type",
    "visible": false
}, {
    "name": "Fbid V2",
    "data": "fbid_v2",
    "visible": false
}, {
    "name": "Is Profile Audio Call Enabled",
    "data": "is_profile_audio_call_enabled",
    "visible": false,
    "bool": true
}, {
    "name": "Instagram Location Id",
    "data": "instagram_location_id",
    "visible": false
}, {
    "name": "Is New To Instagram",
    "data": "is_new_to_instagram",
    "visible": false,
    "bool": true
}, {
    "name": "Is New To Instagram 30d",
    "data": "is_new_to_instagram_30d",
    "visible": false,
    "bool": true
}, {
    "name": "Is Secondary Account Creation",
    "data": "is_secondary_account_creation",
    "visible": false,
    "bool": true
}, {
    "name": "Category",
    "data": "category",
    "visible": false
}, {
    "name": "Category Id",
    "data": "category_id",
    "visible": false
}, {
    "name": "Is Business",
    "data": "is_business",
    "visible": false
}, {
    "name": "Language Code",
    "data": "languageCode",
    "visible": false
}, {
    "name": "Language %",
    "data": "languagePercentage",
    "visible": false
}, {
    "name": "Language #",
    "data": "languageCount",
    "visible": false
}, {
    "name": "Language",
    "data": "languageName",
    "visible": true
}];


var defaultOptions = {
    timeDelay: 180000,
    timeDelayAfterSoftRateLimit: 600000,
    timeDelayAfterHardRateLimit: 3600000,
    timeDelayAfter429RateLimit: 120000,
    timeDelayAfterAdditionalInfo: 2000,
    useTimeDelayAfterAdditionalInfo: false,
    retriesAfterAdditionalInfo404: 10,
    timeDelayAfterSkip: 0.5,
    useRandomTimeDelay: true,
    percentRandomTimeDelay: 0.5,
    followPrivateAccounts: true,
    limitQueue: true,
    maxAcctQueueLength: 50,
    maxMediaQueueLength: 50,
    paginationLimit: 100,
    mediapaginationLimit: 100,
    truncateStart: 0,
    dontUnFollowFollowers: true,
    dontUnFollowFilters: false,
    dontRemoveOrBlockFilters: false,
    dontUnFollowNonOrganic: true,
    unFollowFresh: false,
    unFollowIfOld: true,
    unFollowDelay: 259200000, // 259200000 = 3 days
    unFollowIfOlderThan: 2592000000, // 2592000000 = 30 days
    followLikeLatestPics: false,
    numberFollowLikeLatestPics: 1,
    filterOptions: defaultFilterOptions,
    ui: [],
    cbShowQueueOnScreen: true,
    cbRemoveUnusedColumns: false,
    showFollowingInQueue: true,
    showLikesInQueue: true,
    removeAccountsFromQueue: false,
    autoSaveQueue: false,
    showStamps: true,
    showProfilePicInQueue: true,
    showConvenienceButtons: true,
    loadQueueOnStartup: false,
    clickNotNow: false,
    followPeopleAlreadyAttempted: false,
    maxPerEnabled: false,
    maxPerActions: 50,
    maxPerPeriod: 86400000,
    getExtendedData: false,
    getLastPostDate: false,
    endcursors: [],
    queueColumns: gbDefaultColumns,
    MediaIncludeLikersCommentersTagged: false,
    SaveWhenWatchingReel: true,
    LikeWhenWatchingReel: true,
    lastTab: 'tab1',
    includePinnedPostForLikes: true,
    includePinnedPostForComments: true,
    // Comment System Options
    enableAutoComments: false,
    commentTemplates: null,
    customCommentTemplates: [],
    maxCommentsPerDay: 15,
    minCommentDelay: 240000,
    maxCommentDelay: 480000,
    commentOnlyFollowed: false,
    commentOnlyRecent: false,
    commentRecentHours: 720,
    avoidDuplicateComments: true,
    commentVariation: true,
    // Story Enhancement Options
    storyWatchDelay: 8000,
    storyCloseDelay: 3000,
    storySkipPrivateNotFollowed: true,
    storyFilterMinFollowers: 0,
    storyFilterMaxFollowers: 0,
    storyReplyEnabled: false,
    storyReplyTemplates: [
        "Love this! 🔥",
        "So cool! 😍",
        "Amazing! ✨",
        "Great story! 👏"
    ],
    storyReplyProbability: 0.2
};

var gblOptions = defaultOptions;

var gbl404attempt = 0;

var acctsQueue = [];
var theirFollowings = [];
var myFollowers = [];
var timeoutsQueue = [];
var alreadyLiking = false;

var acctsProcessed = [];
var acctsPreviouslyAttempted = [];
var acctsWhiteList = [];
var freeTrialInterval;

var scrollIntervalId;
var totalAvailableForQueue;

var loadedTheirFollowers = false;
var loadedTheirFollowings = false;
var loadedMyFollowers = false;
var loadedMyFollowings = false;

var user;
var currentProfilePage = false;

var todaysdate = new Date();
var today = todaysdate.getTime();

var mediaToLike = [];
var previousLikes = [];

var currentList = false;

var queueSplit = false;

var usernameCheckInterval;

var maxActionsDelayStartTime = 0;
var actionsTaken = 0;

let mediaForComments = [];
let accountIdsThatCommented = [];

// ========== COMMENT SYSTEM ==========
var commentTemplates = {
    generic: [
        "Amazing! 🔥",
        "Love this! ❤️",
        "Great content! 👏",
        "Incredible work! 🌟",
        "This is awesome! 💯",
        "So inspiring! ✨",
        "Beautiful! 😍",
        "Wow, love it! 🙌",
        "Keep it up! 💪",
        "Absolutely stunning! 🤩"
    ],
    engagement: [
        "This made my day! 😊",
        "Can't stop looking at this 👀",
        "You're so talented @{username}! 🎯",
        "Goals! 🎯🔥",
        "Need more of this content! 🙏"
    ],
    questions: [
        "Where is this? 📍",
        "How did you do this? 🤔",
        "What's the story behind this? 💭",
        "Any tips for beginners? 🙋",
        "What inspired you? 💡"
    ],
    emojis_pool: ["🔥","❤️","👏","🌟","💯","😍","🙌","✨","💪","🤩","🎯","💡","🙏","👀","😊"]
};

var commentsDoneToday = 0;
var commentsLog = [];
var lastCommentTime = 0;


let mediaForLikes = [];
let accountIdsThatLiked = [];

function waitForWinVars() {

    var sharedData = JSON.parse(localStorage.getItem('winvars'));

    if (sharedData) {

        if (sharedData.config && sharedData.config.viewer != null) {
            user = sharedData.config;
            gbInit();
        } else {
            waitForElement('script[type="application/json"]', document, gbInit, false);
        }

    } else {
        setTimeout(waitForWinVars, 10);
    }

}

function gbInit() {

    if (shouldLoadOrganicOnThisPage() == false) return false;

    localStorage.clear('winvars');


    injectControlsDiv();


    if (getBackgroundInfo() === false) {
        return false;
    }



    startUserNameFreshnessInterval();

    setInterval(monitorButtonConditions, 500);

    setInterval(organicActionRunner, 1000);


}

function getCookie(name) {
    let cookie = {};
    document.cookie.split(';').forEach(function(el) {
        let split = el.split('=');
        cookie[split[0].trim()] = split.slice(1).join("=");
    })
    return cookie[name];
}

function getCsrfFromCookie() {
    return getCookie('csrftoken');
}

function displayFreeTrialTimeLeft() {
    $('#h2FreeTrialTimeLeft').hide();
    clearInterval(freeTrialInterval);
}

function timeToDate(t) {
    var date = new Date(parseInt(t));
    return date.toString();
}

function printMessage(txt) {
    outputMessage(txt);
}

var _logSaveTimer = null;
var _mailtoTimer = null;
var _logLineCount = 0;

function outputMessage(txt) {

    var statusDiv = document.getElementById('igBotStatusDiv');
    var fakeConsole = document.getElementById('txtConsole');

    if (txt.trim() != '' && statusDiv) {
        txt = getTimeStamp() + ' - ' + txt;
        statusDiv.textContent = txt;
        displayWaitTimeHacky();
    }

    fakeConsole.textContent = fakeConsole.textContent + '\n' + txt;
    _logLineCount++;

    // Auto-trim log every 500 messages to prevent memory bloat
    if (_logLineCount > 500) {
        _logLineCount = 0;
        var lines = fakeConsole.textContent.split('\n');
        if (lines.length > 1500) {
            fakeConsole.textContent = lines.slice(-1000).join('\n');
        }
    }

    // Debounce storage write — batch at 2s
    if (_logSaveTimer) clearTimeout(_logSaveTimer);
    _logSaveTimer = setTimeout(function() {
        chrome.storage.local.set({
            organicLog: '' + document.getElementById('txtConsole').textContent.slice(-50000)
        }, function() {});
    }, 2000);

    scrollLog();

    // Debounce mailto update — heavy string op, batch at 5s
    if (_mailtoTimer) clearTimeout(_mailtoTimer);
    _mailtoTimer = setTimeout(includeLogInMailToLinks, 5000);

}

var _scrollLogTimer = null;
function scrollLog() {
    if (_scrollLogTimer) clearTimeout(_scrollLogTimer);
    _scrollLogTimer = setTimeout(function() {
        var fakeConsole = document.getElementById('txtConsole');
        if (document.activeElement.id !== 'txtConsole') {
            fakeConsole.scrollTop = fakeConsole.scrollHeight;
        }
    }, 150);
}

function includeLogInMailToLinks() {
    $('.organicEmailLink').attr('target', '_blank').attr('href', 'mailto:organicautomator@gmail.com?body=' + encodeURIComponent('\n\n------------------------------------------------------------------------------------------------------------------------------------\nPlease type your message above this line, include the log below for debugging:\n------------------------------------------------------------------------------------------------------------------------------------\n' + document.getElementById('txtConsole').textContent.slice(-20000)));
}

function trimLog() {
    var fakeConsole = document.getElementById('txtConsole');
    //fakeConsole.textContent = fakeConsole.textContent.slice(-100);

    var arrLines = fakeConsole.textContent.split('\n');
    arrLines = arrLines.slice(arrLines.length - 1000, arrLines.length);

    fakeConsole.textContent = arrLines.join('\n');

    outputMessage('Log trimmed');
}

var _waitTimeTimer = null;
function displayWaitTimeHacky() {
    // Cancel any existing chain to prevent stacking
    if (_waitTimeTimer) clearTimeout(_waitTimeTimer);

    var statusDiv = document.getElementById('igBotStatusDiv');

    var statusText = statusDiv.textContent;

    if (statusText.indexOf('Max actions exceeded') > -1) {
        statusDiv.textContent = getTimeStamp() + ' - ' + 'Max actions exceeded, waiting ' + millisecondsToHumanReadable(maxActionsDelayRemaining(), true)
        _waitTimeTimer = setTimeout(displayWaitTimeHacky, 1000);
        return false;
    }

    if (statusText.indexOf('waiting ') > -1 && statusText.indexOf(' seconds') > -1) {
        var secondsStart = statusText.indexOf('waiting ') + 8;
        var secondsEnd = statusText.indexOf(' second');
        var seconds = statusText.substring(secondsStart, secondsEnd);

        if (!isNaN(seconds) && (seconds - 1 > 0)) {
            statusDiv.textContent = statusDiv.textContent.replace('waiting ' + seconds + ' seconds', 'waiting ' + (Math.round((seconds - 1) * 100) / 100) + ' seconds');
            if (seconds - 1 > 1) {
                _waitTimeTimer = setTimeout(displayWaitTimeHacky, 1000);
            }
        }
    }

    if (statusText.indexOf('waiting ') > -1 && statusText.indexOf(' minute') > -1) {
        var secondsStart = statusText.indexOf('waiting ') + 8;
        var secondsEnd = statusText.indexOf(' minute');
        var minutes = statusText.substring(secondsStart, secondsEnd);

        if (!isNaN(minutes)) {
            seconds = minutes * 60;
            statusDiv.textContent = statusDiv.textContent.replace('waiting ' + minutes + ' minutes', 'waiting ' + (Math.round((seconds - 1) * 100) / 100) + ' seconds');
            if (seconds - 1 > 1) {
                _waitTimeTimer = setTimeout(displayWaitTimeHacky, 1000);
            }
        }
    }

}

function millisecondsToHumanReadable(ms, formatAsString) {

    var obj = {};
    var x = ms / 1000;
    obj.seconds = parseInt(x % 60);
    x /= 60;
    obj.minutes = parseInt(x % 60);
    x /= 60;
    obj.hours = parseInt(x % 24);
    x /= 24;
    obj.days = parseInt(x);

    if (formatAsString == false) {
        return obj;
    }

    return obj.days + ' days, ' + obj.hours + ' hours, ' + obj.minutes + ' minutes, ' + obj.seconds + ' seconds';

}

function zeroPad(digitcount, num) {
    for (var i = 0; i < digitcount; i++) {
        num = "0" + num;
    }

    return num.substr(-digitcount, digitcount);
}

function getTimeStamp() {
    var d = new Date();
    var meridium = '';
    var hours = d.getHours();

    // if (hours > 11) {
    //     meridium = ' pm';
    //     hours = hours - 12;
    // } else {
    //     meridium = ' am';
    // }

    // if (hours == 0) {
    //     meridium = ' pm';
    //     hours = 12;
    // }

    return (d.getFullYear() + '-' + zeroPad(2, d.getMonth() + 1)) + '-' + zeroPad(2, d.getDate()) + ' ' + zeroPad(2, d.getHours()) + ':' + zeroPad(2, d.getMinutes()) + ':' + zeroPad(2, d.getSeconds()) + meridium;
}

function containsObject(obj, list) {
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i].id === obj.id) {
            return true;
        }
    }

    return false;
}

function findAcctById(id, list, returnIndexOnly) {
    if (returnIndexOnly !== true) returnIndexOnly = false;
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i].id === id) {
            if (returnIndexOnly === true) return i;
            return list[i];
        }
    }
    return false;
}


function addNewConvenienceLinks(element) {

    if (gblOptions.showConvenienceButtons == false) return false;

    var $$this = $(element);

    if ($$this.children('div').length > 0) return false;
    if ($$this.parents('.Mr508').length > 0) return false;
    if ($$this.parents('.XQXOT').length > 0) return false;

    var username = $$this.text();

    $$this.after('<a class="igBotInjectedLinkWhitelist" href="javascript:void(0);" data-username="' + username + '">Whitelist</a> <a class="igBotInjectedLinkUnfollow" href="javascript:void(0);" data-username="' + username + '">Unfollow</a>');
    $$this.parents('.RqtMr').css({
        'max-width': 'initial'
    });

}


async function convenienceLinkUnfollowAcct(userName) {
    var acct = await getAdditionalDataForAcct({
        username: userName
    });
    quickUnfollowAcct(acct);
}

async function convenienceLinkWhitelistAcct(userName) {
    var acct = await getAdditionalDataForAcct({
        username: userName
    });
    if (addAcctToWhiteList(acct) === true) saveWhiteListToStorage();
    $('.igBotInjectedLinkWhitelist[data-username="' + acct.username + '"]').fadeOut();
    $('.igBotInjectedLinkUnfollow[data-username="' + acct.username + '"]').fadeOut();
}

function waitForTrue(variableNames, callback, args) {
    var allTrue = true;
    var waitingFor = 'waiting for ';
    for (var i = 0; i < variableNames.length; i++) {
        if (window[variableNames[i]] === false) {
            allTrue = false;
            waitingFor = waitingFor + variableNames[i] + ' ';
        } else {
            waitingFor = waitingFor.replace(variableNames[i], '');
        }
    }

    if (allTrue === true) {
        printMessage(chrome.i18n.getMessage('Done'));
        callback.apply(this, args);
    } else {
        timeoutsQueue.push(setTimeout(function() {
            waitForTrue(variableNames, callback, args);
        }, 1000));
    }

}

function waitForElement(query, parent, callback, reenable) {
    const observer = new MutationObserver((mutations, obs) => {
        var elementToObserve = document.querySelectorAll(query)[0];
        if (elementToObserve) {
            callback();

            if (reenable == true) {
                setTimeout(function() {
                    obs.observe(parent, {
                        childList: true,
                        subtree: true
                    });
                }, 1000);
            }

            obs.disconnect();
            return;
        }
    });

    observer.observe(parent, {
        childList: true,
        subtree: true
    });

}

function loadOptions() {
    chrome.storage.local.get("gblOptions", function(data) {
        if (typeof data.gblOptions != 'undefined') {
            gblOptions = data.gblOptions;

            if (typeof gblOptions.filterOptions == 'undefined') {
                gblOptions.filterOptions = defaultFilterOptions;
            }

            // for newly added options: set gblOptions.xxxx to default option if .xxxx wasn't in previously saved options
            for (var key in defaultOptions) {
                if (gblOptions.hasOwnProperty(key) === false) {
                    gblOptions[key] = defaultOptions[key];
                }
            }

            // for newly added filter options: set gblOptions.filterOptions.xxxx to default option if .xxxx wasn't in previously saved options
            for (var key in defaultFilterOptions) {
                if (gblOptions.filterOptions.hasOwnProperty(key) === false) {
                    gblOptions.filterOptions[key] = defaultFilterOptions[key];
                }
            }

            document.getElementById('textSecondsBetweenActions').value = gblOptions.timeDelay / 1000;
            document.getElementById('textSecondsAfterSkip').value = gblOptions.timeDelayAfterSkip / 1000;
            document.getElementById('textMinutesAfterSoftRateLimit').value = gblOptions.timeDelayAfterSoftRateLimit / 60000;
            document.getElementById('textMinutesAfter429RateLimit').value = gblOptions.timeDelayAfter429RateLimit / 60000;
            document.getElementById('textHoursAfterHardRateLimit').value = gblOptions.timeDelayAfterHardRateLimit / 3600000;
            document.getElementById('texttimeDelayAfterAdditionalInfo').value = gblOptions.timeDelayAfterAdditionalInfo / 1000;
            document.getElementById('textRetryAfterAdditionalInfo404').value = Number(gblOptions.retriesAfterAdditionalInfo404);
            document.getElementById('cbuseTimeDelayAfterAdditionalInfo').checked = gblOptions.useTimeDelayAfterAdditionalInfo;
            document.getElementById('cbRandomizeTimeDelay').checked = gblOptions.useRandomTimeDelay;
            document.getElementById('cbFollowPrivateAccounts').checked = gblOptions.followPrivateAccounts;
            document.getElementById('cbFilterNonPrivate').checked = gblOptions.filterOptions.non_private;
            document.getElementById('cbFilterVerified').checked = gblOptions.filterOptions.verified;
            document.getElementById('cbFilterNonVerified').checked = gblOptions.filterOptions.non_verified;
            document.getElementById('cbFilterBusiness').checked = gblOptions.filterOptions.is_business_account;
            document.getElementById('cbFilterNonBusiness').checked = gblOptions.filterOptions.non_is_business_account;
            document.getElementById('cbFilterJoinedRecently').checked = gblOptions.filterOptions.is_joined_recently;
            document.getElementById('cbFilterNonJoinedRecently').checked = gblOptions.filterOptions.non_is_joined_recently;
            document.getElementById('cbFollowsMe').checked = gblOptions.filterOptions.follows_me;
            document.getElementById('cbNonFollowsMe').checked = gblOptions.filterOptions.non_follows_me;
            document.getElementById('cbFollowedByMe').checked = gblOptions.filterOptions.followed_by_me;
            document.getElementById('cbNonFollowedByMe').checked = gblOptions.filterOptions.non_followed_by_me;
            document.getElementById('cbFilterNoProfilePic').checked = gblOptions.filterOptions.no_profile_pic;
            document.getElementById('cbFilterProfilePic').checked = gblOptions.filterOptions.profile_pic;
            document.getElementById('cbApplyFilterAutomatically').checked = gblOptions.filterOptions.applyFiltersAutomatically;
            document.getElementById('igBotPercentRandomTimeDelay').value = gblOptions.percentRandomTimeDelay * 200;
            document.getElementById('cbDontUnfollowFollowers').checked = gblOptions.dontUnFollowFollowers;
            document.getElementById('cbDontUnfollowNonOrganic').checked = gblOptions.dontUnFollowNonOrganic;
            document.getElementById('cbDontUnfollowFilters').checked = gblOptions.dontUnFollowFilters;
            document.getElementById('cbDontRemoveOrBlockFilters').checked = gblOptions.dontRemoveOrBlockFilters;
            document.getElementById('cbDontUnfollowFresh').checked = !gblOptions.unFollowFresh;
            document.getElementById('cbUnfollowOld').checked = gblOptions.unFollowIfOld;
            document.getElementById('textUnfollowNew').value = gblOptions.unFollowDelay / 86400000;
            document.getElementById('textUnfollowOld').value = gblOptions.unFollowIfOlderThan / 86400000;
            document.getElementById('cbLimitQueueSize').checked = gblOptions.limitQueue;
            document.getElementById('txtLimitQueueSize').value = gblOptions.maxAcctQueueLength;
            document.getElementById('cbLimitMediaQueueSize').checked = gblOptions.limitMediaQueue;
            document.getElementById('txtLimitMediaQueueSize').value = gblOptions.maxMediaQueueLength;
            document.getElementById('numberFollowLikeLatestPics').value = gblOptions.numberFollowLikeLatestPics || 1;
            document.getElementById('cbRemoveFromQueue').checked = gblOptions.removeAccountsFromQueue;
            document.getElementById('cbAutoSaveQueue').checked = gblOptions.autoSaveQueue;
            document.getElementById('cbShowStamps').checked = gblOptions.showStamps;
            document.getElementById('cbShowProfilePicInQueue').checked = gblOptions.showProfilePicInQueue;
            document.getElementById('cbConvenienceLinks').checked = gblOptions.showConvenienceButtons;
            document.getElementById('cbFollowAlreadyAttempted').checked = gblOptions.followPeopleAlreadyAttempted;
            document.getElementById('cbShowLikesInQueue').checked = gblOptions.showLikesInQueue;
            document.getElementById('cbShowQueueOnScreen').checked = gblOptions.cbShowQueueOnScreen;
            document.getElementById('cbRemoveUnusedColumns').checked = gblOptions.cbRemoveUnusedColumns;
            document.getElementById('cbClickNotNow').checked = gblOptions.clickNotNow;
            document.getElementById('cbLoadQueueOnStartup').checked = gblOptions.loadQueueOnStartup;
            document.getElementById('cbLimitActions').checked = gblOptions.maxPerEnabled;
            document.getElementById('textLimitActionsPer').value = gblOptions.maxPerActions;
            document.getElementById('textLimitActionsPerTime').value = gblOptions.maxPerPeriod / 3600000;
            document.getElementById('cbGetExtendedData').checked = gblOptions.getExtendedData;
            document.getElementById('cbGetLastPostDate').checked = gblOptions.getLastPostDate;
            document.getElementById('cbFilterBioContains').checked = gblOptions.filterOptions.bio_contains;
            document.getElementById('cbFilterBioNotContains').checked = gblOptions.filterOptions.bio_not_contains;
            document.getElementById('txtFilterBioContains').value = gblOptions.filterOptions.bio_contains_text;
            document.getElementById('txtFilterBioNotContains').value = gblOptions.filterOptions.bio_not_contains_text;
            document.getElementById('cbFilterExternalUrlContains').checked = gblOptions.filterOptions.external_url_contains;
            document.getElementById('cbFilterExternalUrlNotContains').checked = gblOptions.filterOptions.external_url_not_contains;
            document.getElementById('txtFilterExternalUrlContains').value = gblOptions.filterOptions.external_url_contains_text;
            document.getElementById('txtFilterExternalUrlNotContains').value = gblOptions.filterOptions.external_url_not_contains_text;
            document.getElementById('cbFilterBusinessCategoryNameContains').checked = gblOptions.filterOptions.business_category_name_contains;
            document.getElementById('cbFilterBusinessCategoryNameNotContains').checked = gblOptions.filterOptions.business_category_name_not_contains;
            document.getElementById('txtFilterBusinessCategoryNameContains').value = gblOptions.filterOptions.business_category_name_contains_text;
            document.getElementById('txtFilterBusinessCategoryNameNotContains').value = gblOptions.filterOptions.business_category_name_not_contains_text;
            document.getElementById('cbMediaIncludeLikersCommentersTagged').checked = gblOptions.MediaIncludeLikersCommentersTagged;
            document.getElementById('SaveWhenWatchingReel').checked = gblOptions.SaveWhenWatchingReel;
            document.getElementById('LikeWhenWatchingReel').checked = gblOptions.LikeWhenWatchingReel;
            document.getElementById('includeSuggestedPostsFromFeed').checked = gblOptions.includeSuggestedPostsFromFeed;
            document.getElementById('includePinnedPostForLikes').checked = gblOptions.includePinnedPostForLikes;
            document.getElementById('includePinnedPostForComments').checked = gblOptions.includePinnedPostForComments;

            // Comment System Options
            if (document.getElementById('cbEnableComments')) {
                document.getElementById('cbEnableComments').checked = gblOptions.enableAutoComments;
                document.getElementById('txtMaxCommentsPerDay').value = gblOptions.maxCommentsPerDay;
                document.getElementById('txtMinCommentDelay').value = (gblOptions.minCommentDelay / 1000);
                document.getElementById('txtMaxCommentDelay').value = (gblOptions.maxCommentDelay / 1000);
                document.getElementById('cbCommentOnlyRecent').checked = gblOptions.commentOnlyRecent;
                document.getElementById('txtCommentRecentHours').value = gblOptions.commentRecentHours;
                document.getElementById('cbAvoidDuplicateComments').checked = gblOptions.avoidDuplicateComments;
                document.getElementById('cbCommentVariation').checked = gblOptions.commentVariation;
                if (gblOptions.customCommentTemplates && gblOptions.customCommentTemplates.length > 0) {
                    document.getElementById('txtCustomCommentTemplates').value = gblOptions.customCommentTemplates.join('\n');
                }
                document.getElementById('commentsTodayMax').textContent = gblOptions.maxCommentsPerDay;
            }
            // Story Enhancement Options
            if (document.getElementById('cbStoryReplyEnabled')) {
                document.getElementById('cbStoryReplyEnabled').checked = gblOptions.storyReplyEnabled;
                document.getElementById('txtStoryReplyProbability').value = Math.round(gblOptions.storyReplyProbability * 100);
                if (document.getElementById('txtStoryReplyTemplates') && gblOptions.storyReplyTemplates) {
                    document.getElementById('txtStoryReplyTemplates').value = gblOptions.storyReplyTemplates.join('\n');
                }
            }
            loadCommentsLogFromStorage();

            $('#paginationLimit option:selected').attr("selected", null);
            $('#paginationLimit option[value="' + gblOptions.paginationLimit + '"]').attr("selected", "selected");
            $('#paginationLimit').trigger('change');

            $('li.' + gblOptions.lastTab + ' label').click();

            if (typeof gblOptions.ui == 'undefined' || gblOptions.ui.length == 0) {
                [...document.getElementsByTagName('details')].forEach((detailsEl) => {
                    detailsEl.setAttribute('open', true)
                });
            } else {
                gblOptions.ui.forEach((detailsOpt) => {
                    if (detailsOpt.open == true) {
                        var el = document.getElementById(detailsOpt.id);
                        if (el) el.setAttribute('open', true);
                    }
                });
            }

        }

        if (typeof gblOptions.filterOptions == 'undefined') {
            gblOptions.filterOptions = defaultFilterOptions;
        }

        if (typeof gblOptions.queueColumns == 'undefined') {
            gblOptions.queueColumns = gbDefaultColumns;
        }

        for (var i = 0; i < gbDefaultColumns.length; i++) {

            var hasObj = false;
            for (var j = 0; j < gblOptions.queueColumns.length; j++) {
                if (gblOptions.queueColumns[j].data == gbDefaultColumns[i].data) {
                    hasObj = true;

                    if (gbDefaultColumns[i].bool == true) {
                        gblOptions.queueColumns[j]["bool"] = true;
                    }

                }
            }

            if (hasObj == false) {
                gblOptions.queueColumns.push(gbDefaultColumns[i]);
            }

        }


        loadOptionsColumns();

        bindNoUiSliders();

        bindEvents();

    });
}


function loadOptionsColumns() {
    var queueColumnsOptions = document.getElementById('queueColumnsOptions');

    for (var i = 0; i < gblOptions.queueColumns.length; i++) {

        var qc = gblOptions.queueColumns[i];

        var vizString = '';
        var disabledString = '';

        if (qc.visible == true) vizString = ' checked="' + qc.visible + '"'
        if (qc.data == 'id' || qc.data == 'username') disabledString = ' disabled="disabled"'

        var columnCheckbox = elementFromString('<label for="cb_' + qc.data + '"><input type="checkbox" id="cb_' + qc.data + '"' + vizString + disabledString + '>' + qc.name + "</label>");

        queueColumnsOptions.appendChild(columnCheckbox);

    }
}

function elementFromString(string) {
    var div = document.createElement('DIV');
    div.innerHTML = string;
    return div.firstChild;
}


function setFilterIconOpacity() {
    if (gblOptions.filterOptions.applyFiltersAutomatically == true && $('#radioFollow').is(':checked') == true) {
        document.getElementById('iconFilter').style.opacity = 1;
    } else if (gblOptions.dontUnFollowFilters == true && $('#radioUnFollow').is(':checked') == true) {
        document.getElementById('iconFilter').style.opacity = 1;
    } else if (gblOptions.dontRemoveOrBlockFilters == true && ($('#radioRemoveFromFollowers').is(':checked') == true || $('#radioBlock').is(':checked') == true)) {
        document.getElementById('iconFilter').style.opacity = 1;
    } else {
        document.getElementById('iconFilter').style.opacity = 0.5;
    }
}

var _saveOptionsTimer = null;
function _debouncedSaveOptions() {
    if (_saveOptionsTimer) clearTimeout(_saveOptionsTimer);
    _saveOptionsTimer = setTimeout(saveOptions, 300);
}

function saveOptions() {

    gblOptions.filterOptions.applyFiltersAutomatically = document.getElementById('cbApplyFilterAutomatically').checked;
    gblOptions.filterOptions.private = document.getElementById('cbFollowPrivateAccounts').checked;
    gblOptions.filterOptions.non_private = document.getElementById('cbFilterNonPrivate').checked;
    gblOptions.filterOptions.verified = document.getElementById('cbFilterVerified').checked;
    gblOptions.filterOptions.non_verified = document.getElementById('cbFilterNonVerified').checked;
    gblOptions.filterOptions.follows_me = document.getElementById('cbFollowsMe').checked;
    gblOptions.filterOptions.non_follows_me = document.getElementById('cbNonFollowsMe').checked;
    gblOptions.filterOptions.followed_by_me = document.getElementById('cbFollowedByMe').checked;
    gblOptions.filterOptions.non_followed_by_me = document.getElementById('cbNonFollowedByMe').checked;
    gblOptions.filterOptions.is_joined_recently = document.getElementById('cbFilterJoinedRecently').checked;
    gblOptions.filterOptions.non_is_joined_recently = document.getElementById('cbFilterNonJoinedRecently').checked;
    gblOptions.filterOptions.is_business_account = document.getElementById('cbFilterBusiness').checked;
    gblOptions.filterOptions.non_is_business_account = document.getElementById('cbFilterNonBusiness').checked;
    gblOptions.filterOptions.bio_contains = document.getElementById('cbFilterBioContains').checked;
    gblOptions.filterOptions.bio_not_contains = document.getElementById('cbFilterBioNotContains').checked;
    gblOptions.filterOptions.bio_contains_text = document.getElementById('txtFilterBioContains').value;
    gblOptions.filterOptions.bio_not_contains_text = document.getElementById('txtFilterBioNotContains').value;
    gblOptions.filterOptions.external_url_contains = document.getElementById('cbFilterExternalUrlContains').checked;
    gblOptions.filterOptions.external_url_not_contains = document.getElementById('cbFilterExternalUrlNotContains').checked;
    gblOptions.filterOptions.external_url_contains_text = document.getElementById('txtFilterExternalUrlContains').value;
    gblOptions.filterOptions.external_url_not_contains_text = document.getElementById('txtFilterExternalUrlNotContains').value;
    gblOptions.filterOptions.no_profile_pic = document.getElementById('cbFilterNoProfilePic').checked;
    gblOptions.filterOptions.profile_pic = document.getElementById('cbFilterProfilePic').checked;
    gblOptions.filterOptions.business_category_name_contains = document.getElementById('cbFilterBusinessCategoryNameContains').checked;
    gblOptions.filterOptions.business_category_name_not_contains = document.getElementById('cbFilterBusinessCategoryNameNotContains').checked;
    gblOptions.filterOptions.business_category_name_contains_text = document.getElementById('txtFilterBusinessCategoryNameContains').value;
    gblOptions.filterOptions.business_category_name_not_contains_text = document.getElementById('txtFilterBusinessCategoryNameNotContains').value;


    var uiOptions = [];

    [...document.getElementsByTagName('details')].forEach((detailsEl) => {
        uiOptions.push({
            'id': detailsEl.id,
            'open': detailsEl.open ? true : false
        });
    });

    var filterOptions = gblOptions.filterOptions;
    var endcursors = gblOptions.endcursors;

    gblOptions.dontUnFollowFollowers = document.getElementById('cbDontUnfollowFollowers').checked;
    gblOptions.dontUnFollowNonOrganic = document.getElementById('cbDontUnfollowNonOrganic').checked;
    gblOptions.dontUnFollowFilters = document.getElementById('cbDontUnfollowFilters').checked;
    gblOptions.dontRemoveOrBlockFilters = document.getElementById('cbDontRemoveOrBlockFilters').checked;
    gblOptions.filterOptions = filterOptions;
    gblOptions.followPeopleAlreadyAttempted = document.getElementById('cbFollowAlreadyAttempted').checked;
    gblOptions.followPrivateAccounts = document.getElementById('cbFollowPrivateAccounts').checked;
    gblOptions.limitQueue = document.getElementById('cbLimitQueueSize').checked;
    gblOptions.limitMediaQueue = document.getElementById('cbLimitMediaQueueSize').checked;
    gblOptions.maxAcctQueueLength = parseInt(document.getElementById('txtLimitQueueSize').value);
    gblOptions.maxMediaQueueLength = parseInt(document.getElementById('txtLimitMediaQueueSize').value);
    gblOptions.numberFollowLikeLatestPics = document.getElementById('numberFollowLikeLatestPics').value;
    gblOptions.percentRandomTimeDelay = document.getElementById('igBotPercentRandomTimeDelay').value / 200;
    gblOptions.showLikesInQueue = document.getElementById('cbShowLikesInQueue').checked;
    gblOptions.clickNotNow = document.getElementById('cbClickNotNow').checked;
    gblOptions.loadQueueOnStartup = document.getElementById('cbLoadQueueOnStartup').checked;
    gblOptions.cbShowQueueOnScreen = document.getElementById('cbShowQueueOnScreen').checked;
    gblOptions.cbRemoveUnusedColumns = document.getElementById('cbRemoveUnusedColumns').checked;
    gblOptions.removeAccountsFromQueue = document.getElementById('cbRemoveFromQueue').checked;
    gblOptions.autoSaveQueue = document.getElementById('cbAutoSaveQueue').checked;
    gblOptions.showConvenienceButtons = document.getElementById('cbConvenienceLinks').checked;
    gblOptions.showStamps = document.getElementById('cbShowStamps').checked;
    gblOptions.showProfilePicInQueue = document.getElementById('cbShowProfilePicInQueue').checked;
    gblOptions.getExtendedData = document.getElementById('cbGetExtendedData').checked;
    gblOptions.getLastPostDate = document.getElementById('cbGetLastPostDate').checked;
    gblOptions.timeDelay = document.getElementById('textSecondsBetweenActions').value * 1000;
    gblOptions.timeDelayAfterHardRateLimit = document.getElementById('textHoursAfterHardRateLimit').value * 3600000;
    gblOptions.timeDelayAfterSkip = document.getElementById('textSecondsAfterSkip').value * 1000;
    gblOptions.timeDelayAfterSoftRateLimit = document.getElementById('textMinutesAfterSoftRateLimit').value * 60000;
    gblOptions.timeDelayAfter429RateLimit = document.getElementById('textMinutesAfter429RateLimit').value * 60000;
    gblOptions.timeDelayAfterAdditionalInfo = document.getElementById('texttimeDelayAfterAdditionalInfo').value * 1000;
    gblOptions.useTimeDelayAfterAdditionalInfo = document.getElementById('cbuseTimeDelayAfterAdditionalInfo').checked;
    gblOptions.retriesAfterAdditionalInfo404 = Number(document.getElementById('textRetryAfterAdditionalInfo404').value);
    gblOptions.ui = uiOptions;
    gblOptions.unFollowFresh = !document.getElementById('cbDontUnfollowFresh').checked;
    gblOptions.unFollowIfOld = document.getElementById('cbUnfollowOld').checked;
    gblOptions.unFollowDelay = parseInt(document.getElementById('textUnfollowNew').value) * 86400000;
    gblOptions.unFollowIfOlderThan = parseInt(document.getElementById('textUnfollowOld').value) * 86400000;
    gblOptions.useRandomTimeDelay = document.getElementById('cbRandomizeTimeDelay').checked;
    gblOptions.maxPerEnabled = document.getElementById('cbLimitActions').checked;
    gblOptions.maxPerActions = document.getElementById('textLimitActionsPer').value;
    gblOptions.maxPerPeriod = document.getElementById('textLimitActionsPerTime').value * 3600000;
    gblOptions.paginationLimit = $('#paginationLimit').val();
    gblOptions.mediapaginationLimit = $('#mediapaginationLimit').val();
    gblOptions.endcursors = endcursors;
    gblOptions.MediaIncludeLikersCommentersTagged = document.getElementById('cbMediaIncludeLikersCommentersTagged').checked;
    gblOptions.SaveWhenWatchingReel = document.getElementById('SaveWhenWatchingReel').checked;
    gblOptions.LikeWhenWatchingReel = document.getElementById('LikeWhenWatchingReel').checked;
    gblOptions.includeSuggestedPostsFromFeed = document.getElementById('includeSuggestedPostsFromFeed').checked;
    gblOptions.includePinnedPostForLikes = document.getElementById('includePinnedPostForLikes').checked;
    gblOptions.includePinnedPostForComments = document.getElementById('includePinnedPostForComments').checked;

    // Comment System Options
    if (document.getElementById('cbEnableComments')) {
        gblOptions.enableAutoComments = document.getElementById('cbEnableComments').checked;
        gblOptions.maxCommentsPerDay = parseInt(document.getElementById('txtMaxCommentsPerDay').value) || 20;
        gblOptions.minCommentDelay = (parseInt(document.getElementById('txtMinCommentDelay').value) || 180) * 1000;
        gblOptions.maxCommentDelay = (parseInt(document.getElementById('txtMaxCommentDelay').value) || 420) * 1000;
        gblOptions.commentOnlyRecent = document.getElementById('cbCommentOnlyRecent').checked;
        gblOptions.commentRecentHours = parseInt(document.getElementById('txtCommentRecentHours').value) || 48;
        gblOptions.avoidDuplicateComments = document.getElementById('cbAvoidDuplicateComments').checked;
        gblOptions.commentVariation = document.getElementById('cbCommentVariation').checked;
    }
    // Story Enhancement Options
    if (document.getElementById('cbStoryReplyEnabled')) {
        gblOptions.storyReplyEnabled = document.getElementById('cbStoryReplyEnabled').checked;
        gblOptions.storyReplyProbability = (parseInt(document.getElementById('txtStoryReplyProbability').value) || 20) / 100;
        if (document.getElementById('txtStoryReplyTemplates')) {
            var storyLines = document.getElementById('txtStoryReplyTemplates').value.split('\n').map(function(l){return l.trim();}).filter(function(l){return l.length > 0;});
            if (storyLines.length > 0) gblOptions.storyReplyTemplates = storyLines;
        }
    }


    document.querySelectorAll('#detailsQueueColumns input').forEach((cb) => {
        var columnDataName = cb.id.replace('cb_', '');
        var columnObjIndex = gblOptions.queueColumns.findIndex(item => item.data == columnDataName);

        gblOptions.queueColumns[columnObjIndex].visible = cb.checked;
    });

    chrome.storage.local.set({
        gblOptions: gblOptions
    });

    // setFilterIconOpacity();
}


function loadPreviousAttempts() {
    chrome.storage.local.get("acctsAttempted", function(data) {
        if (Array.isArray(data.acctsAttempted)) {
            acctsPreviouslyAttempted = data.acctsAttempted;
            printMessage(chrome.i18n.getMessage('PreviouslyAttempted', [acctsPreviouslyAttempted.length]));

            acctsPreviouslyAttempted = cleanAcctsForStorage(acctsPreviouslyAttempted);
            chrome.storage.local.set({
                acctsAttempted: acctsPreviouslyAttempted
            }, function() {});;
        }
    })
}



function cleanAcctsForStorage(queueToOptimize) {
    var previousBytes = bytesFromString(JSON.stringify(queueToOptimize));

    for (var i = 0; i < queueToOptimize.length; i++) {
        var a = queueToOptimize[i];
        if (a.edge_felix_video_timeline) delete queueToOptimize[i].edge_felix_video_timeline;
        if (a.edge_felix_combined_post_uploads) delete queueToOptimize[i].edge_felix_combined_post_uploads;
        if (a.edge_felix_combined_draft_uploads) delete queueToOptimize[i].edge_felix_combined_draft_uploads;
        if (a.edge_felix_drafts) delete queueToOptimize[i].edge_felix_drafts;
        if (a.edge_felix_pending_draft_uploads) delete queueToOptimize[i].edge_felix_pending_draft_uploads;
        if (a.edge_felix_pending_post_uploads) delete queueToOptimize[i].edge_felix_pending_post_uploads;
        if (a.edge_saved_media) delete queueToOptimize[i].edge_saved_media;
        if (a.edge_media_collections) delete queueToOptimize[i].edge_media_collections;
        if (a.edge_owner_to_timeline_media && a.edge_owner_to_timeline_media.edges) queueToOptimize[i].edge_owner_to_timeline_media.edges = [];
    }

    var nowBytes = bytesFromString(JSON.stringify(queueToOptimize));
    var savedBytes = previousBytes - nowBytes;

    if (savedBytes > 0) {
        printMessage('Cleaned up accounts for storage and performance (saved ' + formatBytes(savedBytes) + ')');
    }

    return queueToOptimize;
}

function bytesFromString(str) {
    var bytes = 0,
        len = str.length,
        codePoint, next, i;

    for (i = 0; i < len; i++) {
        codePoint = str.charCodeAt(i);

        // Lone surrogates cannot be passed to encodeURI
        if (codePoint >= 0xD800 && codePoint < 0xE000) {
            if (codePoint < 0xDC00 && i + 1 < len) {
                next = str.charCodeAt(i + 1);

                if (next >= 0xDC00 && next < 0xE000) {
                    bytes += 4;
                    i++;
                    continue;
                }
            }
        }

        bytes += (codePoint < 0x80 ? 1 : (codePoint < 0x800 ? 2 : 3));
    }

    return bytes;
}

function formatBytes(bytes, decimals) {
    if (bytes == 0) return '0 Bytes';
    var k = 1024,
        dm = decimals <= 0 ? 0 : decimals || 2,
        sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function loadPreviousLikes() {
    chrome.storage.local.get("previousLikes", function(data) {
        if (Array.isArray(data.previousLikes)) {
            previousLikes = data.previousLikes;
            printMessage(chrome.i18n.getMessage('PreviouslyLiked', [previousLikes.length]));
        }
    })
}

function savePreviousLikesToStorage() {
    chrome.storage.local.set({
        previousLikes: previousLikes
    });
}

function addAcctToWhiteList(acct) {
    var acctInWhiteList = findAcctById(acct.id, acctsWhiteList);
    if (acct !== false && acctInWhiteList == false) {
        acctsWhiteList.push(acct);
        printMessage(acct.username + chrome.i18n.getMessage('AddedToWhitelist'));
        return true;
    } else {
        printMessage(acct.username + chrome.i18n.getMessage('AlreadyOnWhitelist'));
        return false;
    }
}

function loadWhiteList() {
    chrome.storage.local.get("acctsWhiteList", function(data) {
        if (Array.isArray(data.acctsWhiteList)) {
            acctsWhiteList = data.acctsWhiteList;
            printMessage(chrome.i18n.getMessage('WhitelistLoaded', [acctsWhiteList.length]));
        }
    })
}

function saveWhiteListToStorage() {
    chrome.storage.local.set({
        acctsWhiteList: acctsWhiteList
    });
    printMessage(chrome.i18n.getMessage('WhitelistSavedLocal'));
}

function saveWhiteListToDisk() {
    saveText("organic-whitelist.txt", JSON.stringify(acctsWhiteList));
    printMessage(chrome.i18n.getMessage('WhitelistSavedFile'));
}

function saveWhiteListToStorageAndDisk() {
    saveWhiteListToStorage();
    saveWhiteListToDisk();
}

function saveText(filename, text) {
    var blob = new Blob([text], {
        type: "text/plain;charset=utf-8"
    });
    saveAs(blob, filename);
}

function viewWhiteList() {
    if (acctsWhiteList.length > 0) {

        dialog({
                yes: chrome.i18n.getMessage('WhitelistLoadFile'),
                no: chrome.i18n.getMessage('WhitelistLoadLocal'),
                question: chrome.i18n.getMessage('WhitelistLoadQuestion')
            },
            function() {
                openWhiteListFile()
            },
            function() {
                currentList = 'acctsWhiteList';
                arrayOfUsersToDiv(acctsWhiteList, true);
                $('#btnSaveWhiteList').show();
            });

    } else {
        openWhiteListFile();
    }
}

function openWhiteListFile() {
    var input = document.createElement("input");
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'text/plain,text/json,application/JSON');

    input.addEventListener("change", function() {
        if (this.files && this.files[0]) {
            var myFile = this.files[0];
            var reader = new FileReader();

            reader.addEventListener('load', function(e) {
                acctsWhiteList = JSON.parse(e.target.result);
                currentList = 'acctsWhiteList';
                arrayOfUsersToDiv(acctsWhiteList, true);
            });

            reader.readAsText(myFile);
        }
    });

    input.click();
}



function openQueueFile() {
    var input = document.createElement("input");
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'text/plain,text/json,application/JSON');

    input.addEventListener("change", function() {
        if (this.files && this.files[0]) {
            var myFile = this.files[0];
            var reader = new FileReader();

            reader.addEventListener('load', function(e) {
                var fileData = e.target.result;

                if (fileData.indexOf('relationships_follow_requests_sent') > -1) {
                    var fileJSON = JSON.parse(e.target.result);
                    var pendingArray = fileJSON.relationships_follow_requests_sent;

                    for (var i = 0; i < pendingArray.length; i++) {

                        if (pendingArray[i].string_list_data &&
                            pendingArray[i].string_list_data.length > 0 &&
                            pendingArray[i].string_list_data[0].value) {

                            acctsQueue.push({
                                "username": pendingArray[i].string_list_data[0].value
                            });
                        }
                    }

                    alert('Loaded partial queue from list of usernames.  Before Organic can use this queue, you will need to process the queue with Get More Data selected.');

                } else if (fileData.indexOf('{') > -1) {
                    // JSON
                    acctsQueue = JSON.parse(e.target.result);
                    currentList = 'acctsQueue';

                    if (acctsQueue.length > gblOptions.maxAcctQueueLength &&
                        gblOptions.limitQueue == true &&
                        window.confirm('Saved queue has ' + acctsQueue.length + ' accounts, limit to first ' + gblOptions.maxAcctQueueLength + ' accounts?')) {

                        truncateQueue();
                    }

                    acctsQueue = cleanAcctsForStorage(acctsQueue);

                } else if (fileData.indexOf(',') > -1 || fileData.indexOf('\n') > -1 || fileData.indexOf('\r') > -1) {
                    // file has newlines or commas but not {
                    // clean windows newlines, double newlines, replace newlines with comma, parse as csv
                    fileData = fileData.replace(/\r/g, '\n');
                    fileData = fileData.replace(/\n\n/g, '\n');
                    fileData = fileData.replace(/\n/g, ',');
                    fileData = fileData.replace(/,,/g, ',');

                    var arrr = fileData.split(',');
                    for (var i = 0; i < arrr.length; i++) {
                        acctsQueue.push({
                            "username": arrr[i]
                        });
                    }

                    alert('Loaded partial queue from list of usernames.  Before Organic can use this queue, you will need to process the queue with Get More Data selected.');
                } else {
                    alert("Error: Can't load queue file, are you sure this is a Organic queue?");
                }

                acctsQueue = fixAcctQueueCounts(acctsQueue);


                arrayOfUsersToDiv(acctsQueue, true);

            });

            reader.readAsText(myFile);
        }
    });

    input.click();
}



function loadSavedQueue() {
    chrome.storage.local.get("acctsQueue", function(data) {
        if (Array.isArray(data.acctsQueue)) {

            dialog({
                    no: chrome.i18n.getMessage('QueueLoadFile'),
                    yes: chrome.i18n.getMessage('QueueLoadLocal'),
                    question: chrome.i18n.getMessage('QueueLoadQuestion')
                },
                function() {
                    acctsQueue = data.acctsQueue;

                    if (acctsQueue.length > gblOptions.maxAcctQueueLength &&
                        gblOptions.limitQueue == true &&
                        window.confirm('Saved queue has ' + acctsQueue.length + ' accounts, limit to first ' + gblOptions.maxAcctQueueLength + ' accounts?')) {

                        truncateQueue();
                    }

                    arrayOfUsersToDiv(acctsQueue, true);

                    printMessage(chrome.i18n.getMessage('QueueLoaded', [acctsQueue.length]));
                },
                function() {
                    openQueueFile();
                })
        } else {
            openQueueFile();
        }
    });
}


function loadQueueFromLocal() {
    chrome.storage.local.get("acctsQueue", function(data) {
        if (Array.isArray(data.acctsQueue)) {

            acctsQueue = JSON.parse(JSON.stringify(data.acctsQueue));

            acctsQueue = fixAcctQueueCounts(acctsQueue);

            arrayOfUsersToDiv(acctsQueue, true);

            printMessage(chrome.i18n.getMessage('QueueLoaded', [acctsQueue.length]));
        }
    });
}


function fixAcctQueueCounts(q) {

    var newArr = [];

    for (var i = 0; i < q.length; i++) {

        var newq = q[i];

        // if (q[i]["edge_owner_to_timeline_media.count"]) {
        if (q[i]["edge_owner_to_timeline_media.count"]) {
            newq.edge_owner_to_timeline_media = {
                "count": q[i]["edge_owner_to_timeline_media.count"]
            }
            delete newq["edge_owner_to_timeline_media.count"];
        } else {
            newq.edge_owner_to_timeline_media = {
                "count": 0
            }

        }
        // }

        //  if (q[i]["edge_followed_by.count"]) {
        if (q[i]["edge_followed_by.count"]) {
            newq["edge_followed_by"] = {
                "count": q[i]["edge_followed_by.count"]
            }
            delete newq["edge_followed_by.count"]

        }
        //  }

        //   if (q[i]["edge_follow.count"]) {
        if (q[i]["edge_follow.count"]) {
            newq["edge_follow"] = {
                "count": q[i]["edge_follow.count"]
            }
            delete newq["edge_follow.count"]
        }
        //   }

        // if (q[i]["edge_mutual_followed_by.count"]) {
        if (q[i]["edge_mutual_followed_by.count"]) {
            newq["edge_mutual_followed_by"] = {
                "count": q[i]["edge_mutual_followed_by.count"]
            }
            delete newq["edge_mutual_followed_by.count"]
        } else {
            newq["edge_mutual_followed_by"] = {
                "count": 0
            }
        }
        // }

        newArr.push(JSON.parse(JSON.stringify(newq)))

    }


    return newArr;

}


function generateFileName() {
    var fileName = "organic";

    var endCursorsForThisPage = gblOptions.endcursors;

    endCursorsForThisPage = endCursorsForThisPage.filter(e => e.id === currentProfilePage.id);

    if (endCursorsForThisPage.length > 0) {
        var p = endCursorsForThisPage[endCursorsForThisPage.length - 1];
        fileName = fileName + '-' + p.username;
        fileName = fileName + '-' + p.action.replace('load', '').toLowerCase();
    } else {
        fileName = fileName + '-' + 'queue';
    }


    return fileName;
}

function saveQueueToDisk() {
    saveText(generateFileName() + ".txt", JSON.stringify(acctsQueue));
    printMessage(chrome.i18n.getMessage('QueueSavedFile'));
}

function saveQueueToStorage() {
    chrome.storage.local.set({
        acctsQueue: acctsQueue
    }, function() {
        printMessage(chrome.i18n.getMessage('QueueSavedLocal'));
    });
}

function saveQueueToStorageAndDisk() {
    saveQueueToStorage();
    saveQueueToDisk();
}



function initUnfollowMyFollowers() {
    if (acctsQueue.length === 0 && window.confirm('Queue empty, load your following and begin unfollowing?') === true) {
        ajaxGetAllMyFollowing('');
        waitForTrue(['loadedMyFollowings'], ajaxUnfollowAll, []);
    } else {
        ajaxUnfollowAll();
    }
}


async function ajaxLoadUsersMedia(after, loadAllMedia, callback, acct) {

    if (!acct) acct = currentProfilePage;

    if (typeof after != 'string') {
        after = '';
    } else {
        after = '%22after%22%3A%22' + after + '%22%2C';
    }

    const fetchMedia = await fetch("https://www.instagram.com/graphql/query", {
        "headers": {
            "accept": "*/*",
            "content-type": "application/x-www-form-urlencoded",
            "priority": "u=1, i",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-asbd-id": "129477",
            "x-csrftoken": getCsrfFromCookie(),
            "x-fb-friendly-name": "PolarisProfilePostsQuery",
            "x-ig-app-id": "936619743392459"
        },
        "referrer": "https://www.instagram.com/" + acct.username + "/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": "av=17841400482242408&__d=www&__user=0&__a=1&__req=7&__hs=20028.HYP%3Ainstagram_web_pkg.2.1..0.1&dpr=1&__ccg=EXCELLENT&__rev=1017870321&__s=xc4v6e%3Api17z8%3Awisy8l&__hsi=7432327050990328368&__csr=&__comet_req=7&jazoest=26364&__spin_r=1017870321&__spin_b=trunk&__spin_t=1730473490&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=PolarisProfilePostsQuery&variables=%7B" + after + "%22data%22%3A%7B%22count%22%3A12%2C%22include_relationship_info%22%3Atrue%2C%22latest_besties_reel_media%22%3Atrue%2C%22latest_reel_media%22%3Atrue%7D%2C%22username%22%3A%22" + acct.username + "%22%2C%22__relay_internal__pv__PolarisIsLoggedInrelayprovider%22%3Atrue%2C%22__relay_internal__pv__PolarisFeedShareMenurelayprovider%22%3Atrue%7D&server_timestamps=true&doc_id=8633614153419931",
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    });

    var jsonData = await fetchMedia.json();
    var r = jsonData.data.xdt_api__v1__feed__user_timeline_graphql_connection;

    r.acct = acct;
    callback(r);
}


async function ajaxLoadAllUsersCommenters(after) {


    if (typeof after != 'string') {
        after = '';
    } else {
        after = '%22after%22%3A%22' + after + '%22%2C';
    }

    const fetchMedia = await fetch("https://www.instagram.com/graphql/query", {
        "headers": {
            "accept": "*/*",
            "content-type": "application/x-www-form-urlencoded",
            "priority": "u=1, i",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-asbd-id": "129477",
            "x-csrftoken": getCsrfFromCookie(),
            "x-fb-friendly-name": "PolarisProfilePostsQuery",
            "x-ig-app-id": "936619743392459"
        },
        "referrer": "https://www.instagram.com/" + currentProfilePage.username + "/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": "av=17841400482242408&__d=www&__user=0&__a=1&__req=7&__hs=20028.HYP%3Ainstagram_web_pkg.2.1..0.1&dpr=1&__ccg=EXCELLENT&__rev=1017870321&__s=xc4v6e%3Api17z8%3Awisy8l&__hsi=7432327050990328368&__csr=&__comet_req=7&jazoest=26364&__spin_r=1017870321&__spin_b=trunk&__spin_t=1730473490&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=PolarisProfilePostsQuery&variables=%7B" + after + "%22data%22%3A%7B%22count%22%3A12%2C%22include_relationship_info%22%3Atrue%2C%22latest_besties_reel_media%22%3Atrue%2C%22latest_reel_media%22%3Atrue%7D%2C%22username%22%3A%22" + currentProfilePage.username + "%22%2C%22__relay_internal__pv__PolarisIsLoggedInrelayprovider%22%3Atrue%2C%22__relay_internal__pv__PolarisFeedShareMenurelayprovider%22%3Atrue%7D&server_timestamps=true&doc_id=8633614153419931",
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    });

    var jsonData = await fetchMedia.json();
    var r = jsonData.data.xdt_api__v1__feed__user_timeline_graphql_connection;

    loadCommentsForMedia(r);
}


async function loadMoreCommentsForMedia2(media, nextMinId) {

    return new Promise(async function(resolve, reject) {

        var url = "https://www.instagram.com/api/v1/media/" + media.id + "/comments/?can_support_threading=true&permalink_enabled=false";

        if (nextMinId && nextMinId !== 0) {
            url = url + '&min_id=' + encodeURIComponent(nextMinId);
        }

        const fetchComments = await fetch(url, {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9",
                "priority": "u=1, i",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-asbd-id": "129477",
                "x-csrftoken": getCsrfFromCookie(),
                "x-ig-app-id": "936619743392459",
                "x-requested-with": "XMLHttpRequest"
            },
            "referrer": "https://www.instagram.com/p/DB1UCFKuS8u/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors",
            "credentials": "include"
        });
        var jsonData = await fetchComments.json();
        var c = jsonData.comments;
        media.nextMinId = jsonData.next_min_id || 0;

        if (media.comments) {

        } else {
            media.comments = [];
        }

        for (var i = 0; i < c.length; i++) {
            media.comments.push(c[i]);
        }


        resolve(media);
    });

}

async function loadCommentsForMedia(r) {
    for (var i = 0; i < r.edges.length; i++) {

        var media = r.edges[i];

        if (gblOptions.includePinnedPostForComments == false && media.node.timeline_pinned_user_ids.length > 0) continue;

        var mediaWithComments = await loadMoreCommentsForMedia2(media.node);

        for (j = 0; j < (mediaWithComments.comment_count / 1); j++) {

            if (mediaWithComments.comment_count > 0 &&
                mediaWithComments.comments &&
                mediaWithComments.comments.length < mediaWithComments.comment_count &&
                mediaWithComments.nextMinId &&
                mediaWithComments.nextMinId !== 0) {

                mediaWithComments = await loadMoreCommentsForMedia2(mediaWithComments, mediaWithComments.nextMinId);

            } else {
                break;
            }

            var users = allNodes(mediaWithComments.comments, 'user');
            for (var k = 0; k < users.length; k++) {
                var u = users[k];
                acctsQueue.push(u);
            }

            acctsQueue = uniq(acctsQueue);

            mediaToLike.push(media.node);


            arrayOfUsersToDiv(acctsQueue, true);
            arrayOfMediaToDiv(mediaToLike, true);

            if ((gblOptions.limitQueue == true && acctsQueue.length > gblOptions.maxAcctQueueLength)) {
                printMessage(chrome.i18n.getMessage('Done') + chrome.i18n.getMessage('QueueLimitReached'));
                return false;
            }

        }

        outputMessage('Loaded ' + mediaWithComments.comments.length + '/' + mediaWithComments.comment_count + ' comments for post ' + (i + 1) + '/' + r.edges.length);

    }

    if ((gblOptions.limitQueue == true && acctsQueue.length > gblOptions.maxAcctQueueLength)) {
        arrayOfUsersToDiv(acctsQueue, true);
        printMessage(chrome.i18n.getMessage('Done') + chrome.i18n.getMessage('QueueLimitReached'));
        return false;
    }

    if (r.page_info.has_next_page == true) {
        outputMessage('waiting 2 seconds to load the next batch of posts for comments');
        timeoutsQueue.push(setTimeout(function() {
            ajaxLoadAllUsersCommenters(r.page_info.end_cursor);
        }, 2000));
    } else {
        printMessage(chrome.i18n.getMessage('Done'));
    }
}

async function ajaxLoadAllUsersLikers(after) {
    if (typeof after != 'string') {
        after = '';
    } else {
        after = '%22after%22%3A%22' + after + '%22%2C';
    }


    const fetchMedia = await fetch("https://www.instagram.com/graphql/query", {
        "headers": {
            "accept": "*/*",
            "content-type": "application/x-www-form-urlencoded",
            "priority": "u=1, i",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-asbd-id": "129477",
            "x-csrftoken": getCsrfFromCookie(),
            "x-fb-friendly-name": "PolarisProfilePostsQuery",
            "x-ig-app-id": "936619743392459"
        },
        "referrer": "https://www.instagram.com/" + currentProfilePage.username + "/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": "av=17841400482242408&__d=www&__user=0&__a=1&__req=7&__hs=20028.HYP%3Ainstagram_web_pkg.2.1..0.1&dpr=1&__ccg=EXCELLENT&__rev=1017870321&__s=xc4v6e%3Api17z8%3Awisy8l&__hsi=7432327050990328368&__csr=&__comet_req=7&jazoest=26364&__spin_r=1017870321&__spin_b=trunk&__spin_t=1730473490&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=PolarisProfilePostsQuery&variables=%7B" + after + "%22data%22%3A%7B%22count%22%3A12%2C%22include_relationship_info%22%3Atrue%2C%22latest_besties_reel_media%22%3Atrue%2C%22latest_reel_media%22%3Atrue%7D%2C%22username%22%3A%22" + currentProfilePage.username + "%22%2C%22__relay_internal__pv__PolarisIsLoggedInrelayprovider%22%3Atrue%2C%22__relay_internal__pv__PolarisFeedShareMenurelayprovider%22%3Atrue%7D&server_timestamps=true&doc_id=8633614153419931",
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    });

    var jsonData = await fetchMedia.json();
    var r = jsonData.data.xdt_api__v1__feed__user_timeline_graphql_connection;

    beginLoadLikesForMedia(r);

}


async function loadLikesForQueueMedia() {
    for (var j = 0; j < likers.length; j++) {
        if ((gblOptions.limitQueue == true && acctsQueue.length < gblOptions.maxAcctQueueLength) || gblOptions.limitQueue == false) {
            if (findAcctById(likers[j].id, acctsQueue) === false) {
                acctsQueue.push(likers[j]);
            }
        } else {

            arrayOfUsersToDiv(acctsQueue, true);
            arrayOfMediaToDiv(mediaToLike, true);

            printMessage(chrome.i18n.getMessage('Done') + chrome.i18n.getMessage('QueueLimitReached'));
            return false;
        }
    }
}


async function beginLoadLikesForMedia(r) {

    for (var i = 0; i < r.edges.length; i++) {
        var media = r.edges[i];

        if (gblOptions.includePinnedPostForLikes == false && media.node.timeline_pinned_user_ids.length > 0) continue;

        mediaToLike.push(media.node);

        let likers = await loadLikesForMedia(media);

        for (var j = 0; j < likers.length; j++) {
            if ((gblOptions.limitQueue == true && acctsQueue.length < gblOptions.maxAcctQueueLength) || gblOptions.limitQueue == false) {
                if (findAcctById(likers[j].id, acctsQueue) === false) {
                    acctsQueue.push(likers[j]);
                }
            } else {

                arrayOfUsersToDiv(acctsQueue, true);
                arrayOfMediaToDiv(mediaToLike, true);

                printMessage(chrome.i18n.getMessage('Done') + chrome.i18n.getMessage('QueueLimitReached'));
                return false;
            }
        }

    }

    arrayOfUsersToDiv(acctsQueue, false);
    arrayOfMediaToDiv(mediaToLike, false);

    if (r.page_info.has_next_page == true) {
        outputMessage('waiting 2 seconds to load more media for likes');
        timeoutsQueue.push(setTimeout(function() {
            ajaxLoadAllUsersLikers(r.page_info.end_cursor);
        }, 2000));
    } else {
        printMessage(chrome.i18n.getMessage('Done'));
    }
}

function loadLikesForMedia(media) {

    return new Promise(function(resolve, reject) {

        let retMedia = media;

        $.ajax({
                url: 'https://www.instagram.com/api/v1/media/' + media.node.id + '/likers/',
                method: 'GET',
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                    xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                    xhr.setRequestHeader('x-asbd-id', '129477');
                    xhr.setRequestHeader('x-ig-app-id', '936619743392459');
                },
                xhrFields: {
                    withCredentials: true
                }
            })
            .done(function(r) {

                let retLikers = [];

                if (r.users) {
                    for (var i = 0; i < r.users.length; i++) {
                        var a = r.users[i];
                        a['id'] = a.pk;
                        retLikers.push(a);
                    }

                    resolve(retLikers);
                }

            }).fail(function(f) {
                if (f.status == 429) {
                    printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(loadLikesForMedia(media));
                    }, gblOptions.timeDelayAfter429RateLimit));
                }
            });

    });
}

var extensionId = chrome.i18n.getMessage("@@extension_id");

function getLikersFromMediaArray() {
    let accountsThatLiked = [];

    for (var i = 0; i < mediaForLikes.length; i++) {
        var media = mediaForLikes[i];

        for (var j = 0; j < media.data.shortcode_media.edge_liked_by.edges.length; j++) {
            var like = media.data.shortcode_media.edge_liked_by.edges[j].node;
            if (typeof like == 'undefined') {
                like = media.data.shortcode_media.edge_liked_by.edges[j];
            }
            if (accountIdsThatLiked.indexOf(like.id) == -1) {
                accountIdsThatLiked.push(like.id);
                accountsThatLiked.push(like);
            }
        }
    }

    if (acctsQueue.length == 0) {
        acctsQueue = accountsThatLiked;
    } else {
        for (var i = 0; i < accountsThatLiked.length; i++) {
            if ((gblOptions.limitQueue == true && acctsQueue.length < gblOptions.maxAcctQueueLength) || gblOptions.limitQueue == false) {
                if (findAcctById(accountsThatLiked[i].id, acctsQueue) === false) {
                    acctsQueue.push(accountsThatLiked[i]);
                }
            } else {
                arrayOfUsersToDiv(accountsThatLiked, false);
                return false;
            }
        }
    }

    arrayOfUsersToDiv(accountsThatLiked, false);
}


function ajaxGetPendingFollowRequests(after) {

    alert('Sorry, but Instagram has disabled this feature :(\n\nYou can download your data from:\n\nhttps://www.instagram.com/download/request');
    return false;

    $('#btnLoadPendingRequests').addClass('pulsing');

    if (typeof after != 'string') {
        acctsQueue = [];
        after = '';
    }

    var url = 'https://www.instagram.com/accounts/access_tool/current_follow_requests?__a=1';

    if (after != '') {
        url = url + '&cursor=' + after;
    }

    $.ajax(url)
        .done(function(r) {
            var tmpQueue = [];

            var promises = [];

            $(r.data.data).each(function(edge) {

                var u = {
                    username: $(this)[0].text
                }

                var promise = new Promise(async function(resolve, reject) {
                    u = await getAdditionalDataForAcct(u);
                    acctsQueue.push(u);
                    tmpQueue.push(u);
                    resolve(u);
                });
                promises.push(promise);

            });

            var result = Promise.all(promises);

            result.then(function(data) {
                arrayOfUsersToDiv(tmpQueue, false);

                if (r.data.cursor && (acctsQueue.length < parseInt(gblOptions.maxAcctQueueLength) || gblOptions.limitQueue != true)) {
                    printMessage(chrome.i18n.getMessage('AccountsLoaded', [tmpQueue.length.toString(), acctsQueue.length.toString()]));
                    ajaxGetPendingFollowRequests(r.data.cursor);
                } else {
                    $('#btnLoadPendingRequests').removeClass('pulsing');
                    printMessage(chrome.i18n.getMessage('Done'));
                }

            })


        }).fail(function(f) {
            if (f.status == 429) {
                printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                timeoutsQueue.push(setTimeout(function() {
                    ajaxGetPendingFollowRequests(after);
                }, gblOptions.timeDelayAfter429RateLimit));
            }
        });


}


function ajaxGetAllUsersFollowers(after) {
    if (typeof after != 'string') {
        after = '';

        if (gblOptions.endcursors) {

            var endCursorsForThisPageAndAction = gblOptions.endcursors;
            endCursorsForThisPageAndAction = endCursorsForThisPageAndAction.filter(e => e.action === 'loadFollowers' && e.id === currentProfilePage.id);

            if (endCursorsForThisPageAndAction.length > 0) {
                if (window.confirm('Would you like to attempt to resume where you left off?')) {
                    var objEndCursor = endCursorsForThisPageAndAction[endCursorsForThisPageAndAction.length - 1];
                    after = objEndCursor.endcursor;
                    gblOptions.truncateStart = 0;
                }
            }

        }

    }

    if (after == '' && currentProfilePage.edge_followed_by.count > gblOptions.maxAcctQueueLength && gblOptions.limitQueue == true) {
        var promptAfter = window.prompt("Account has " + currentProfilePage.edge_followed_by.count + " followers, but your queue limit is set to " + gblOptions.maxAcctQueueLength + ". \n\n Enter follower number to begin at (0 is the most recent follower).", gblOptions.truncateStart);
        if (!isNaN(parseInt(promptAfter))) {
            gblOptions.truncateStart = parseInt(promptAfter);
        }
    }

    var jsonvars = {
        id: currentProfilePage.id,
        first: 48
    }

    if (after != '') {
        jsonvars.after = after;
    }

    var urljsonvars = JSON.stringify(jsonvars);

    //7dd9a7e2160524fd85f50317462cff9f
    var url = 'https://www.instagram.com/graphql/query/?query_hash=7dd9a7e2160524fd85f50317462cff9f&variables=' + encodeURIComponent(urljsonvars);

    $.ajax(url)
        .done(function(r) {

            var tmpQueue = [];

            $(r.data.user.edge_followed_by.edges).each(function(edge) {
                var u = $(this)[0].node;
                acctsQueue.push(u);
                tmpQueue.push(u);
            });

            printMessage(chrome.i18n.getMessage('AccountsLoaded', [tmpQueue.length, acctsQueue.length]));


            if (!gblOptions.endcursors) gblOptions['endcursors'] = [];

            var todaysdate = new Date();

            if (r.data.user.edge_followed_by.page_info.end_cursor) {
                gblOptions.endcursors.push({
                    id: currentProfilePage.id,
                    username: currentProfilePage.username,
                    action: 'loadFollowers',
                    endcursor: r.data.user.edge_followed_by.page_info.end_cursor,
                    time: todaysdate.getTime()
                });
                saveOptions();

            }

            if (r.data.user.edge_followed_by.page_info.has_next_page == true &&
                (acctsQueue.length < (parseInt(gblOptions.truncateStart) + parseInt(gblOptions.maxAcctQueueLength)) ||
                    gblOptions.limitQueue != true ||
                    currentProfilePage.edge_followed_by.count < parseInt(gblOptions.maxAcctQueueLength))
            ) {

                ajaxGetAllUsersFollowers(r.data.user.edge_followed_by.page_info.end_cursor);


            } else {

                truncateQueue(gblOptions.truncateStart);

                $('#btnProcessQueue').removeClass('pulsing');

                arrayOfUsersToDiv(acctsQueue, true);

                printMessage(chrome.i18n.getMessage('Done'));
                printMessage(' ');

            }


        }).fail(function(f) {
            if (f.status == 429) {
                printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                timeoutsQueue.push(setTimeout(function() {
                    ajaxGetAllUsersFollowers(after);
                }, gblOptions.timeDelayAfter429RateLimit));
            }
        });

}


function ajaxLoadFollowing(after) {

    if (typeof after != 'string') {
        // acctsQueue = [];
        after = '';


        if (gblOptions.endcursors) {

            var endCursorsForThisPageAndAction = gblOptions.endcursors;
            endCursorsForThisPageAndAction = endCursorsForThisPageAndAction.filter(e => e.action === 'loadFollowing' && e.id === currentProfilePage.id);

            if (endCursorsForThisPageAndAction.length > 0) {
                if (window.confirm('Would you like to attempt to resume where you left off?')) {
                    var objEndCursor = endCursorsForThisPageAndAction[endCursorsForThisPageAndAction.length - 1];
                    after = objEndCursor.endcursor;
                    gblOptions.truncateStart = 0;
                }
            }

        }

    }

    if (after == '' && currentProfilePage.edge_follow.count > gblOptions.maxAcctQueueLength && gblOptions.limitQueue == true) {
        var promptAfter = window.prompt("Account is following " + currentProfilePage.edge_follow.count + " accounts, but your queue limit is set to " + gblOptions.maxAcctQueueLength + ". \n\n Enter following number to begin at (0 is the most recent following).", gblOptions.truncateStart);
        if (!isNaN(parseInt(promptAfter))) {
            gblOptions.truncateStart = parseInt(promptAfter);
        }
    }

    var jsonvars = {
        id: currentProfilePage.id,
        first: 48
    }

    if (after != '') {
        jsonvars.after = after;
    }

    var urljsonvars = JSON.stringify(jsonvars);

    //58712303d941c6855d4e888c5f0cd22f
    var url = 'https://www.instagram.com/graphql/query/?query_hash=c56ee0ae1f89cdbd1c89e2bc6b8f3d18&variables=' + encodeURIComponent(urljsonvars);


    $.ajax(url)
        .done(function(r) {

            var tmpQueue = [];

            $(r.data.user.edge_follow.edges).each(function(edge) {
                var u = $(this)[0].node;
                acctsQueue.push(u);
                tmpQueue.push(u);
            });

            //arrayOfUsersToDiv(tmpQueue, false);

            printMessage(chrome.i18n.getMessage('AccountsLoaded', [tmpQueue.length, acctsQueue.length]));



            if (r.data.user.edge_follow.page_info.end_cursor) {
                var todaysdate = new Date();
                gblOptions.endcursors.push({
                    id: currentProfilePage.id,
                    username: currentProfilePage.username,
                    action: 'loadFollowing',
                    endcursor: r.data.user.edge_follow.page_info.end_cursor,
                    time: todaysdate.getTime()
                });
                saveOptions();
            }

            if (r.data.user.edge_follow.page_info.has_next_page == true &&
                (acctsQueue.length < (parseInt(gblOptions.truncateStart) + parseInt(gblOptions.maxAcctQueueLength)) ||
                    gblOptions.limitQueue != true ||
                    currentProfilePage.edge_follow.count < parseInt(gblOptions.maxAcctQueueLength))
            ) {
                ajaxLoadFollowing(r.data.user.edge_follow.page_info.end_cursor);

                if (!gblOptions.endcursors) gblOptions['endcursors'] = [];



            } else {
                truncateQueue(gblOptions.truncateStart);

                arrayOfUsersToDiv(acctsQueue, true);

                outputMessage(currentProfilePage.username + ' following loaded.  Count: ' + acctsQueue.length);
                printMessage(' ');

                loadedTheirFollowings = true;
            }

        });
}

function ajaxGetAllMyFollowing(after) {

    var jsonvars = {
        id: user.viewer.id,
        first: 48
    }

    if (after != '') {
        jsonvars.after = after;
    }

    var urljsonvars = JSON.stringify(jsonvars);

    var url = 'https://www.instagram.com/graphql/query/?query_hash=58712303d941c6855d4e888c5f0cd22f&variables=' + encodeURIComponent(urljsonvars);

    $.ajax(url)
        .done(function(r) {

            var tmpQueue = [];

            $(r.data.user.edge_follow.edges).each(function(edge) {
                var u = $(this)[0].node;
                acctsQueue.push(u);
                tmpQueue.push(u);
            });

            printMessage(chrome.i18n.getMessage('AccountsLoaded', [tmpQueue.length, acctsQueue.length]));

            if (r.data.user.edge_follow.page_info.has_next_page == true) {
                ajaxGetAllMyFollowing(r.data.user.edge_follow.page_info.end_cursor);
            } else {
                outputMessage('Your following loaded.  Count: ' + acctsQueue.length);
                printMessage(' ');

                loadedMyFollowings = true;
            }

        }).fail(function(f) {
            if (f.status == 429) {
                printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                timeoutsQueue.push(setTimeout(function() {
                    ajaxGetAllMyFollowing(after);
                }, gblOptions.timeDelayAfter429RateLimit));
            }
        });
}



function isAdditionalDataFullyLoaded(q) {
    for (var i = 0; i < q.length; i++) {
        if (!q[i].edge_followed_by) {
            return false;
        }
    }
    return true;
}


var extId = btoa('' + extensionId);

function sortQueue(q, property, asc) {

    var propertySplit = property.split('.');

    if (propertySplit.length === 1) {
        q.sort(function(a, b) {
            // non-numeric properties like username
            if (isNaN(a[property])) {
                if (asc == true) {
                    return a[property].localeCompare(b[property]);
                } else {
                    return b[property].localeCompare(a[property]);
                }
            }
            // numeric properties like followers
            if (asc == true) {
                return a[property] - b[property];
            } else {
                return b[property] - a[property];
            }
        });
    } else if (propertySplit.length === 2) {
        q.sort(function(a, b) {
            if (asc == true) {
                return a[propertySplit[0]][propertySplit[1]] - b[propertySplit[0]][propertySplit[1]];
            } else {
                return b[propertySplit[0]][propertySplit[1]] - a[propertySplit[0]][propertySplit[1]];
            }
        });
    }

    return q;
}



async function appendLastPostDateToAcct(a) {

    //  only hit server if filter is enabled or use is getting more data and wants it
    if (
        (gblOptions.filterOptions.lastPosted[0] < 1 && gblOptions.filterOptions.lastPosted[1] > 4999) ||
        (a.is_private == true && a.followed_by_viewer == false) ||
        (document.getElementById('radioGetMoreData').checked == true && gblOptions.getLastPostDate == false)
    ) {
        // a.lastPostDateInDays = 10;
        return a;
    }

    if (a.edge_owner_to_timeline_media.count > 0) {

        if (a.edge_owner_to_timeline_media.edges.length == 0) {
            a = await getTimelineForAcct(a);
        }

        var sortedMedia = sortQueue(a.edge_owner_to_timeline_media.edges, 'taken_at', false);
        var lastMediaDate = 0;
        if (sortedMedia.length > 0 && sortedMedia[0].taken_at != 'undefined') {
            lastMediaDate = sortedMedia[0].taken_at * 1000;
        }

        a.lastPostDate = lastMediaDate;

        var date1 = new Date(lastMediaDate);
        var date2 = new Date();
        var differenceInTime = date2.getTime() - date1.getTime();
        var differenceInDays = differenceInTime / (1000 * 3600 * 24);

        a.lastPostDateInDays = differenceInDays;


    } else {
        a.lastPostDateInDays = 6000;
    }

    return a;
}

function appendFollowersRatioToAcct(a) {
    if (a.edge_follow.count > 0 && a.edge_followed_by.count > 0) {
        a.followRatio = a.edge_followed_by.count / a.edge_follow.count;
    } else if (a.edge_followed_by.count > 0) {
        a.followRatio = a.edge_followed_by.count;
    } else {
        a.followRatio = 0;
    }

    return a;
}

function appendHasProfilePicToAcct(acct) {
    if (acct.profile_pic_url.indexOf(igExternalVars.emptyProfilePicUrl) > -1) {
        acct.has_profile_pic = 0;
    } else {
        acct.has_profile_pic = 1;
    }

    return acct;
}

function truncateQueue(start) {
    if (isNaN(parseInt(start))) start = 0;

    if (acctsQueue.length > gblOptions.maxAcctQueueLength && gblOptions.limitQueue != false) {
        var end = (start + gblOptions.maxAcctQueueLength);

        acctsQueue = acctsQueue.slice(start, end);

    }
}

async function arrayOfMediaToDiv(q, clearDiv) {

    if (typeof clearDiv == 'undefined') clearDiv = true;

    if (clearDiv === true) {
        var oldMediaTable = document.getElementById('gridjsMediaQueueWrapper');
        if (oldMediaTable && oldMediaTable.config && oldMediaTable.config.namespace) {
            $(oldMediaTable).trigger('destroy' + oldMediaTable.config.namespace);
        }
        $('#igBotMediaQueueContainer').children().remove();
    } else {
        $('#igBotMediaQueueContainer').children().not('.igBotQueueAcct').remove();
    }

    if (gblOptions.cbShowQueueOnScreen == false) {
        $('#igBotMediaQueueContainer').append('<div style="text-align:center;">You have turned off "Show queue on screen" in Settings.  Your queue is loaded in the background.</div>');
        return false;
    }


    $('#igBotMediaQueueContainer').append('<table id="gridjsMediaQueueWrapper"></table>');



    var columns = [{
        "name": '✓',
        "data": 'id',
        "width": '40px',
        "formatter": '<input type="checkbox" id="cb_${cell}" value="${cell}" />',
        "visible": true,
    }, {
        "name": "Media",
        "data": "image_versions2.candidates",
        "width": '150px',
        "visible": true
    }, {
        "name": '@username',
        "data": 'owner.username',
        "formatter": '<a href="https://www.instagram.com/${cell}" target="_blank">@${cell}</a>',
        "width": '125px',
        "visible": true
    }, {
        "name": "Caption",
        "data": "caption.text",
        "width": '200px',
        "visible": true
    }, {
        "name": "Date Taken",
        "data": "taken_at",
        "data2": "taken_at_timestamp",
        "width": '95px',
        "visible": true
    }, {
        "name": "Type",
        "data": "media_type",
        "data2": "__typename",
        "width": '95px',
        "visible": true
    }, {
        "name": "pk",
        "data": "pk",
        "width": '95px',
        "visible": false
    }, {
        "name": "id",
        "data": "id",
        "width": '95px',
        "visible": false
    }, {
        "name": "Comment Count",
        "data": "comment_count",
        "data2": "edge_media_preview_comment.count",
        "width": '95px',
        "visible": true
    }, {
        "name": "Like Count",
        "data": "like_count",
        "data2": "edge_media_preview_like.count",
        "width": '95px',
        "visible": true
    }];



    columns = columns.filter(e => e.visible !== false);


    var sb = '<thead><tr>';

    for (var i = 0; i < columns.length; i++) {
        sb = sb + '<th data-prop="' + columns[i].data + '" style="width:' + (columns[i].width || '60px') + ';">' + columns[i].name + '</th>';
    }

    sb = sb + '</tr></thead><tbody></tbody>';
    $('#gridjsMediaQueueWrapper').append(sb);

    for (var i = 0; i < q.length; i++) {
        sb = '<tr>';
        for (var j = 0; j < columns.length; j++) {


            if (columns[j].width) {
                sb = sb + '<td column-data="' + columns[j].data + '" style="width:' + columns[j].width + ';">';
            } else {
                sb = sb + '<td column-data="' + columns[j].data + '">';
            }

            if (columns[j].data) {

                var dataPropertyToUse = columns[j].data;

                if (columns[j].data2 && q[i].hasOwnProperty(columns[j].data2.split('.')[0])) {
                    dataPropertyToUse = columns[j].data2;

                }

                var props = dataPropertyToUse.split('.');

                if (props[1]) {
                    if (props[1] == 'candidates') {
                        if (q[i][props[0]] && q[i][props[0]][props[1]]) {
                            var candidates = q[i][props[0]][props[1]];
                            sb = sb + '<a href="https://www.instagram.com/p/' + (q[i].code || q[i].shortcode) + '" target="_blank"><img style="width:150px;" class="igBotMediaQueuePicture" data-img-id="' + q[i].id + '" src="' + candidates[0].url + '"></a></td>';
                        } else if (q[i].display_url) {
                            sb = sb + '<a href="https://www.instagram.com/p/' + (q[i].code || q[i].shortcode) + '" target="_blank"><img style="width:150px;" class="igBotMediaQueuePicture" data-img-id="' + q[i].id + '" src="' + q[i].display_url + '"></a></td>';
                        } else {
                            sb = sb + '</td>';
                        }
                    } else if (q[i][props[0]] && q[i][props[0]][props[1]]) {
                        if (columns[j].formatter) {
                            sb = sb + columns[j].formatter.replace(/\${ig_id}/g, q[i].id).replace(/\${cell}/g, q[i][props[0]][props[1]]) + '</td>';
                        } else {
                            sb = sb + q[i][props[0]][props[1]] + '</td>';
                        }
                    } else if (props[0] == 'caption') {
                        if (q[i].caption) {
                            sb = sb + q[i].caption + '</td>';
                        } else if (q[i].edge_media_to_caption && q[i].edge_media_to_caption.edges && q[i].edge_media_to_caption.edges.length > 0) {
                            sb = sb + q[i].edge_media_to_caption.edges[0].node.text + '</td>';
                        }

                    } else {
                        sb = sb + '-</td>';
                    }
                } else {
                    if (q[i][props[0]]) {
                        if (columns[j].formatter) {
                            sb = sb + columns[j].formatter.replace(/\${ig_id}/g, q[i].id).replace(/\${cell}/g, q[i][dataPropertyToUse]) + '</td>';
                        } else {

                            var dataString = (q[i][props[0]]);

                            if (props[0] == 'taken_at' || props[0] == 'taken_at_timestamp') {
                                var d = new Date(dataString * 1000);
                                var datePart = d.toISOString().slice(0, 10);
                                var timePart = d.toLocaleString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                                dataString = datePart + ' ' + timePart;
                            }

                            if (props[0] == '__typename' || props[0] == 'media_type') {
                                dataString = dataString.toString().replace('Graph', '').replace('2', 'Video').replace('8', 'Sidecar').replace('1', 'Image').replace('Sidecar', 'Slideshow');
                            }



                            sb = sb + dataString.toString() + '</td>';
                        }
                    } else {
                        sb = sb + '-</td>';
                    }
                }


            }
        }
        sb = sb + '</tr>';
        $('#gridjsMediaQueueWrapper tbody').append(sb);
    }


    $('#gridjsMediaQueueWrapper').tablesorter({

        // *** APPEARANCE ***
        // Add a theme - 'blackice', 'blue', 'dark', 'default', 'dropbox',
        // 'green', 'grey' or 'ice' stylesheets have all been loaded
        // to use 'bootstrap' or 'jui', you'll need to include 'uitheme'
        // in the widgets option - To modify the class names, extend from
        // themes variable. Look for '$.extend($.tablesorter.themes.jui'
        // at the bottom of this window
        // this option only adds a table class name 'tablesorter-{theme}'
        theme: 'blue',

        // fix the column widths
        widthFixed: true,

        // Show an indeterminate timer icon in the header when the table
        // is sorted or filtered
        showProcessing: true,

        // header layout template (HTML ok); {content} = innerHTML,
        // {icon} = <i/> (class from cssIcon)
        headerTemplate: '{content}{icon}',

        // return the modified template string
        onRenderTemplate: null, // function(index, template){ return template; },

        // called after each header cell is rendered, use index to target the column
        // customize header HTML
        onRenderHeader: function(index) {
            // the span wrapper is added by default
            $(this).find('div.tablesorter-header-inner').addClass('roundedCorners');
        },

        // *** FUNCTIONALITY ***
        // prevent text selection in header
        cancelSelection: true,

        // add tabindex to header for keyboard accessibility
        tabIndex: true,

        // other options: 'ddmmyyyy' & 'yyyymmdd'
        dateFormat: 'yyyymmdd',

        // The key used to select more than one column for multi-column
        // sorting.
        sortMultiSortKey: 'shiftKey',

        // key used to remove sorting on a column
        sortResetKey: 'ctrlKey',

        // false for German '1.234.567,89' or French '1 234 567,89'
        usNumberFormat: true,

        // If true, parsing of all table cell data will be delayed
        // until the user initializes a sort
        delayInit: false,

        // if true, server-side sorting should be performed because
        // client-side sorting will be disabled, but the ui and events
        // will still be used.
        serverSideSorting: false,

        // default setting to trigger a resort after an 'update',
        // 'addRows', 'updateCell', etc has completed
        resort: true,

        // *** SORT OPTIONS ***
        // These are detected by default,
        // but you can change or disable them
        // these can also be set using data-attributes or class names
        headers: {
            // set 'sorter : false' (no quotes) to disable the column
            0: {
                sorter: 'text'
            },
            1: {
                sorter: false
            },
        },

        // ignore case while sorting
        ignoreCase: true,

        // forces the user to have this/these column(s) sorted first
        sortForce: null,
        // initial sort order of the columns, example sortList: [[0,0],[1,0]],
        // [[columnIndex, sortDirection], ... ]
        // sortList: [
        //     [0, 0],
        //     [1, 0],
        //     [2, 0]
        // ],
        sortList: [],
        // default sort that is added to the end of the users sort
        // selection.
        sortAppend: null,

        // when sorting two rows with exactly the same content,
        // the original sort order is maintained
        sortStable: false,

        // starting sort direction 'asc' or 'desc'
        sortInitialOrder: 'asc',

        // Replace equivalent character (accented characters) to allow
        // for alphanumeric sorting
        sortLocaleCompare: false,

        // third click on the header will reset column to default - unsorted
        sortReset: true,

        // restart sort to 'sortInitialOrder' when clicking on previously
        // unsorted columns
        sortRestart: false,

        // sort empty cell to bottom, top, none, zero, emptyMax, emptyMin
        emptyTo: 'bottom',

        // sort strings in numerical column as max, min, top, bottom, zero
        stringTo: 'zero',

        // extract text from the table
        textExtraction: {
            0: function(node, table) {
                // this is how it is done by default
                return $(node).attr(table.config.textAttribute) ||
                    node.textContent ||
                    node.innerText ||
                    $(node).text() ||
                    '';
            },
            1: function(node) {
                return $(node).text();
            }
        },

        // data-attribute that contains alternate cell text
        // (used in default textExtraction function)
        textAttribute: 'data-text',

        // use custom text sorter
        // function(a,b){ return a.sort(b); } // basic sort
        textSorter: null,

        // choose overall numeric sorter
        // function(a, b, direction, maxColumnValue)
        numberSorter: null,

        // *** WIDGETS ***
        // apply widgets on tablesorter initialization
        initWidgets: true,

        // table class name template to match to include a widget
        widgetClass: 'widget-{name}',

        // include zebra and any other widgets, options:
        // 'columns', 'filter', 'stickyHeaders' & 'resizable'
        // 'uitheme' is another widget, but requires loading
        // a different skin and a jQuery UI theme.
        widgets: ['pager', 'stickyHeaders', 'storage', 'zebra', 'columns', 'filter'],

        widgetOptions: {

            // zebra widget: adding zebra striping, using content and
            // default styles - the ui css removes the background
            // from default even and odd class names included for this
            // demo to allow switching themes
            // [ 'even', 'odd' ]
            zebra: [
                'ui-widget-content even',
                'ui-state-default odd'
            ],

            // columns widget: change the default column class names
            // primary is the 1st column sorted, secondary is the 2nd, etc
            columns: [
                'primary',
                'secondary',
                'tertiary'
            ],

            // columns widget: If true, the class names from the columns
            // option will also be added to the table tfoot.
            columns_tfoot: true,

            // columns widget: If true, the class names from the columns
            // option will also be added to the table thead.
            columns_thead: true,

            // filter widget: If there are child rows in the table (rows with
            // class name from 'cssChildRow' option) and this option is true
            // and a match is found anywhere in the child row, then it will make
            // that row visible; default is false
            filter_childRows: false,

            // filter widget: If true, a filter will be added to the top of
            // each table column.
            filter_columnFilters: true,

            // filter widget: css class name added to the filter cell
            // (string or array)
            filter_cellFilter: '',

            // filter widget: css class name added to the filter row & each
            // input in the row (tablesorter-filter is ALWAYS added)
            filter_cssFilter: '',

            // filter widget: add a default column filter type
            // '~{query}' to make fuzzy searches default;
            // '{q1} AND {q2}' to make all searches use a logical AND.
            filter_defaultFilter: {},

            // filter widget: filters to exclude, per column
            filter_excludeFilter: {},

            // filter widget: jQuery selector string (or jQuery object)
            // of external filters
            filter_external: '',

            // filter widget: class added to filtered rows;
            // needed by pager plugin
            filter_filteredRow: 'filtered',

            // filter widget: add custom filter elements to the filter row
            filter_formatter: null,

            // filter widget: Customize the filter widget by adding a select
            // dropdown with content, custom options or custom filter functions
            // see http://goo.gl/HQQLW for more details
            filter_functions: null,

            // filter widget: hide filter row when table is empty
            filter_hideEmpty: true,

            // filter widget: Set this option to true to hide the filter row
            // initially. The rows is revealed by hovering over the filter
            // row or giving any filter input/select focus.
            filter_hideFilters: false,

            // filter widget: Set this option to false to keep the searches
            // case sensitive
            filter_ignoreCase: true,

            // filter widget: if true, search column content while the user
            // types (with a delay)
            filter_liveSearch: true,

            // filter widget: a header with a select dropdown & this class name
            // will only show available (visible) options within the drop down
            filter_onlyAvail: 'filter-onlyAvail',

            // filter widget: default placeholder text
            // (overridden by any header 'data-placeholder' setting)
            filter_placeholder: {
                search: '',
                select: ''
            },

            // filter widget: jQuery selector string of an element used to
            // reset the filters.
            filter_reset: null,

            // filter widget: Use the $.tablesorter.storage utility to save
            // the most recent filters
            filter_saveFilters: false,

            // filter widget: Delay in milliseconds before the filter widget
            // starts searching; This option prevents searching for every character
            // while typing and should make searching large tables faster.
            filter_searchDelay: 300,

            // filter widget: allow searching through already filtered rows in
            // special circumstances; will speed up searching in large tables if true
            filter_searchFiltered: true,

            // filter widget: include a function to return an array of values to be
            // added to the column filter select
            filter_selectSource: null,

            // filter widget: Set this option to true if filtering is performed on
            // the server-side.
            filter_serversideFiltering: false,

            // filter widget: Set this option to true to use the filter to find
            // text from the start of the column. So typing in 'a' will find
            // 'albert' but not 'frank', both have a's; default is false
            filter_startsWith: false,

            // filter widget: If true, ALL filter searches will only use parsed
            // data. To only use parsed data in specific columns, set this option
            // to false and add class name 'filter-parsed' to the header
            filter_useParsedData: false,

            // filter widget: data attribute in the header cell that contains
            // the default filter value
            filter_defaultAttrib: 'data-value',

            // filter widget: filter_selectSource array text left of the separator
            // is added to the option value, right into the option text
            filter_selectSourceSeparator: '|',

            // starting page of the pager (zero based index)
            pager_startPage: 0,

            // Number of visible rows - default is 10
            pager_size: gblOptions.mediapaginationLimit,

            // reset pager after filtering; set to desired page #
            // set to false to not change page at filter start
            pager_pageReset: 0,

            // output string - default is '{page}/{totalPages}';
            // possible variables:
            // {page}, {totalPages}, {startRow}, {endRow} and {totalRows}
            // pager_output: '{startRow} to {endRow} ({totalRows})',
            pager_output: '{startRow} - {endRow} / {filteredRows} ({totalRows})',

            // apply disabled classname to the pager arrows when the rows at
            // either extreme is visible - default is true
            pager_updateArrows: true,

            // Number of options to include in the pager number selector
            pager_maxOptionSize: 20,

            // Save pager page & size if the storage script is loaded
            // (requires $.tablesorter.storage in jquery.tablesorter.widgets.js)
            pager_savePages: true,

            // defines custom storage key
            pager_storageKey: 'tablesorter-media-pager',

            // if true, the table will remain the same height no matter how many
            // records are displayed. The space is made up by an empty
            // table row set to a height to compensate; default is false
            pager_fixedHeight: false,

            // count child rows towards the set page size?
            // (set true if it is a visible table row within the pager)
            // if true, child row(s) may not appear to be attached to its
            // parent row, may be split across pages or
            // may distort the table if rowspan or cellspans are included.
            pager_countChildRows: false,

            // remove rows from the table to speed up the sort of large tables.
            // setting this to false, only hides the non-visible rows; needed
            // if you plan to add/remove rows with the pager enabled.
            pager_removeRows: false,

            // css class names used by pager elements
            pager_css: {
                // class added to pager container
                container: 'tablesorter-pager',
                // error information row (don't include period at beginning)
                errorRow: 'tablesorter-errorRow',
                // class added to arrows @ extremes
                // (i.e. prev/first arrows "disabled" on first page)
                disabled: 'disabled'
            },

            // jQuery selectors
            pager_selectors: {
                // target the pager markup
                container: '.mediapager',
                // go to first page arrow
                first: '.first',
                // previous page arrow
                prev: '.prev',
                // next page arrow
                next: '.next',
                // go to last page arrow
                last: '.last',
                // go to page selector - select dropdown that sets the current page
                gotoPage: '.gotoPage',
                // location of where the "output" is displayed
                pageDisplay: '.pagedisplay',
                // page size selector - select dropdown that sets the "size" option
                pageSize: '.pagesize'
            },

            // Resizable widget: If this option is set to false, resized column
            // widths will not be saved. Previous saved values will be restored
            // on page reload
            resizable: true,

            // Resizable widget: If this option is set to true, a resizing anchor
            // will be included in the last column of the table
            resizable_addLastColumn: false,

            // Resizable widget: Set this option to the starting & reset header widths
            resizable_widths: [],

            // Resizable widget: Set this option to throttle the resizable events
            // set to true (5ms) or any number 0-10 range
            resizable_throttle: false,

            // saveSort widget: If this option is set to false, new sorts will
            // not be saved. Any previous saved sort will be restored on page
            // reload.
            saveSort: false,

            // stickyHeaders widget: extra class name added to the sticky header row
            stickyHeaders: '',

            // jQuery selector or object to attach sticky header to
            stickyHeaders_attachTo: '#igBotMediaQueueContainer',

            // jQuery selector or object to monitor horizontal scroll position
            // (defaults: xScroll > attachTo > window)
            stickyHeaders_xScroll: null,

            // jQuery selector or object to monitor vertical scroll position
            // (defaults: yScroll > attachTo > window)
            stickyHeaders_yScroll: null,

            // number or jquery selector targeting the position:fixed element
            stickyHeaders_offset: 0,

            // scroll table top into view after filtering
            stickyHeaders_filteredToTop: true,

            // added to table ID, if it exists
            stickyHeaders_cloneId: '-sticky',

            // trigger 'resize' event on headers
            stickyHeaders_addResizeEvent: true,

            // if false and a caption exist, it won't be included in the
            // sticky header
            stickyHeaders_includeCaption: true,

            // The zIndex of the stickyHeaders, allows the user to adjust this
            // to their needs
            stickyHeaders_zIndex: 2

        },

        // *** CALLBACKS ***
        // function called after tablesorter has completed initialization
        initialized: function() {

        }, // function (table) {}

        // *** extra css class names
        tableClass: '',
        cssAsc: '',
        cssDesc: '',
        cssNone: '',
        cssHeader: '',
        cssHeaderRow: '',
        // processing icon applied to header during sort/filter
        cssProcessing: '',

        // class name indiciating that a row is to be attached to the its parent
        cssChildRow: 'tablesorter-childRow',
        // if this class does not exist, the {icon} will not be added from
        // the headerTemplate
        cssIcon: 'tablesorter-icon',
        // class name added to the icon when there is no column sort
        cssIconNone: '',
        // class name added to the icon when the column has an ascending sort
        cssIconAsc: '',
        // class name added to the icon when the column has a descending sort
        cssIconDesc: '',
        // don't sort tbody with this class name
        // (only one class name allowed here!)
        cssInfoBlock: 'tablesorter-infoOnly',
        // class name added to table header which allows clicks to bubble up
        cssAllowClicks: 'tablesorter-allowClicks',
        // header row to ignore; cells within this row will not be added
        // to table.config.$headers
        cssIgnoreRow: 'tablesorter-ignoreRow',

        // *** SELECTORS ***
        // jQuery selectors used to find the header cells.
        selectorHeaders: '> thead th, > thead td',

        // jQuery selector of content within selectorHeaders
        // that is clickable to trigger a sort.
        selectorSort: 'th, td',

        // rows with this class name will be removed automatically
        // before updating the table cache - used by 'update',
        // 'addRows' and 'appendCache'
        selectorRemove: '.remove-me',

        // *** DEBUGING ***
        // send messages to console
        debug: false

    }).bind("sortEnd", function(e, t) {
        sortMediaQueueByTableSort();
        handleMediaCheckBoxes();
    });

    handleMediaCheckBoxes();
    handleImagePreload();

    if (clearDiv == true) {
        $('#mediapaginationLimit option:selected').attr("selected", null);
        $('#mediapaginationLimit option[value="' + gblOptions.mediapaginationLimit + '"]').attr("selected", "selected");
        $('#gridjsMediaQueueWrapper').trigger('pageSize', gblOptions.mediapaginationLimit);
    }

    $('#mediaqueueQuantityRow').show();
}



function handleImagePreload() {
    const images = document.querySelectorAll('#igBotQueueContainer img,#igBotMediaQueueContainer img');
    const config = {
        rootMargin: '0px 0px 50px 0px',
        threshold: 0
    };
    let loaded = 0;

    let observer = new IntersectionObserver(function(entries, self) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                preloadImage(entry.target);
                // Stop watching and load the image
                self.unobserve(entry.target);
            }
        });
    }, config);

    images.forEach(image => {

        $(image).off('click.hideOrganicOnOpenPost').on('click.hideOrganicOnOpenPost', function() {
            saveHiddenStatus(true);
        });


        if (image.hasAttribute('data-src')) {
            observer.observe(image);
        }
    });

    function preloadImage(img) {
        const src = img.getAttribute('data-src');
        if (!src) {
            return;
        }
        img.src = src;
        img.removeAttribute('data-src');
    }

}

function handleCheckBoxes(q) {

    let lastChecked;
    let boxes = [];

    function displaySelectedCount() {
        let boxCheckedCount = 0;
        boxes.forEach(box => {
            if (box.checked == true) boxCheckedCount++;
        });
        document.getElementById('igBotQueueSelectedCount').textContent = '' + boxCheckedCount + ' selected';
    }

    function selectAllCheckBoxes() {
        boxes.forEach(box => {
            if (document.getElementById(box.id).closest('tr').classList.contains('filtered') == false) box.checked = true;
            //box.checked = true;
        });
        displaySelectedCount();
    }

    function selectNoneCheckBoxes() {
        boxes.forEach(box => {
            box.checked = false;
        });
        displaySelectedCount();
    }

    function invertCheckBoxes() {
        boxes.forEach(box => box.checked = !box.checked);
        displaySelectedCount();
    }

    function removeSelected() {
        var useDefaultList = true;

        if (currentList == 'acctsWhiteList') {
            useDefaultList = false;
        }

        boxes.forEach(box => {
            if (box.checked) {
                if (useDefaultList == true) {
                    acctsQueue = acctsQueue.filter(u => u.id !== box.value);
                } else if (currentList == 'acctsWhiteList') {
                    acctsWhiteList = acctsWhiteList.filter(u => u.id !== box.value);
                }

                $('#' + box.value + '_container').remove();
            }
        });
        refreshBoxes();
        updateCount();
        displaySelectedCount();

        if (useDefaultList == true) {
            arrayOfUsersToDiv(acctsQueue, true);
        } else if (currentList == 'acctsWhiteList') {
            arrayOfUsersToDiv(acctsWhiteList, true);
        }
    }

    function addAcctsToWhiteList() {
        boxes.forEach(box => {
            if (box.checked) {
                var acct = findAcctById(box.value, acctsQueue);
                addAcctToWhiteList(acct);
            }
        });

        setTimeout(saveWhiteListToStorage, 2000);

        return true;
    }

    function checkIntermediateBoxes(first, second) {
        if (boxes.indexOf(first) > boxes.indexOf(second)) {
            [second, first] = [first, second];
        }
        intermediateBoxes(first, second).forEach(box => box.checked = true);
        displaySelectedCount();
    }

    function intermediateBoxes(start, end) {
        return boxes.filter((item, key) => {
            return boxes.indexOf(start) < key && key < boxes.indexOf(end);
        });
    }

    function changeBox(event) {
        if (event.shiftKey && this != lastChecked) {
            checkIntermediateBoxes(lastChecked, this);
        }
        lastChecked = this;
        displaySelectedCount();
    }

    function refreshBoxes() {
        boxes = Array.from(document.querySelectorAll('#gridjsAcctsQueueWrapper [type="checkbox"]'));
    }


    refreshBoxes();

    boxes.forEach(item => {
        $(item).off('click.changeBox').on('click.changeBox', changeBox);
    });

    $('#btnSelectAll').off('click.selectAllCheckBoxes').on('click.selectAllCheckBoxes', selectAllCheckBoxes);
    $('#btnSelectNone').off('click.selectNoneCheckBoxes').on('click.selectNoneCheckBoxes', selectNoneCheckBoxes);
    $('#btnInvertSelection').off('click.invertCheckBoxes').on('click.invertCheckBoxes', invertCheckBoxes);
    $('#btnRemoveSelected').off('click.removeSelected').on('click.removeSelected', removeSelected);
    $('#btnAddToWhiteList').off('click.addAcctsToWhiteList').on('click.addAcctsToWhiteList', addAcctsToWhiteList);
    $('#btnSaveWhiteList').off('click.saveWhiteListToStorageAndDisk').on('click.saveWhiteListToStorageAndDisk', saveWhiteListToStorageAndDisk);
    $('.close-icon').off('click.filterQueue').on('click.filterQueue', function() {
        setTimeout(filterQueue, 1);
    });
    //$('.igBotInjectedButton').off('click.displaySelectedCount').on('click.displaySelectedCount', displaySelectedCount);

    updateCount();
    displaySelectedCount();
}



function handleMediaCheckBoxes(q) {

    let lastChecked;
    let boxes = [];

    function displaySelectedCount() {
        let boxCheckedCount = 0;
        boxes.forEach(box => {
            if (box.checked == true) boxCheckedCount++;
        });
        document.getElementById('igBotmediaQueueSelectedCount').textContent = '' + boxCheckedCount + ' selected';

    }

    function selectAllCheckBoxes() {
        boxes.forEach(box => {
            if (document.getElementById(box.id).closest('tr').classList.contains('filtered') == false) box.checked = true;
            //box.checked = true;
        });
        displaySelectedCount();
    }

    function selectNoneCheckBoxes() {
        boxes.forEach(box => {
            box.checked = false;
        });
        displaySelectedCount();
    }

    function invertCheckBoxes() {
        boxes.forEach(box => box.checked = !box.checked);
        displaySelectedCount();
    }

    function removeSelected() {
        boxes.forEach(box => {
            if (box.checked) {
                mediaToLike = mediaToLike.filter(m => m.id !== box.value);
            }
        });

        refreshBoxes();
        updateCount();
        displaySelectedCount();

        arrayOfMediaToDiv(mediaToLike, true);
    }

    function checkIntermediateBoxes(first, second) {
        if (boxes.indexOf(first) > boxes.indexOf(second)) {
            [second, first] = [first, second];
        }
        intermediateBoxes(first, second).forEach(box => box.checked = true);
        displaySelectedCount();
    }

    function intermediateBoxes(start, end) {
        return boxes.filter((item, key) => {
            return boxes.indexOf(start) < key && key < boxes.indexOf(end);
        });
    }

    function changeBox(event) {
        if (event.shiftKey && this != lastChecked) {
            checkIntermediateBoxes(lastChecked, this);
        }
        lastChecked = this;
        displaySelectedCount();
    }

    function refreshBoxes() {
        boxes = Array.from(document.querySelectorAll('#gridjsMediaQueueWrapper [type="checkbox"]'));
    }

    refreshBoxes();

    boxes.forEach(item => {
        $(item).off('click.changeBox').on('click.changeBox', changeBox);
    });

    $('#btnMediaSelectAll').off('click.selectAllCheckBoxes').on('click.selectAllCheckBoxes', selectAllCheckBoxes);
    $('#btnMediaSelectNone').off('click.selectNoneCheckBoxes').on('click.selectNoneCheckBoxes', selectNoneCheckBoxes);
    $('#btnMediaInvertSelection').off('click.invertCheckBoxes').on('click.invertCheckBoxes', invertCheckBoxes);
    $('#btnMediaRemoveSelected').off('click.removeSelected').on('click.removeSelected', removeSelected);
    $('.close-icon').off('click.filterQueue').on('click.filterQueue', function() {
        setTimeout(filterQueue, 1);
    });

    updateCount();
    displaySelectedCount();
}



function alreadyAttempted(acct) {

    if (typeof acct == 'undefined') return false;

    for (var i = 0; i < acctsPreviouslyAttempted.length; i++) {
        if (acctsPreviouslyAttempted[i].id && acctsPreviouslyAttempted[i].id == acct.id) return acctsPreviouslyAttempted[i];
    }

    return false;
}

function addToAttempted(acct) {

    var acctCopy = acct;

    var d = new Date();
    acctCopy["followAttemptDate"] = '' + d.getTime();

    acctsPreviouslyAttempted.push(acctCopy);
    chrome.storage.local.set({
        acctsAttempted: acctsPreviouslyAttempted
    });
}

function ajaxFollowAllFollowings() {
    acctsQueue = theirFollowings;
    ajaxFollowAll();
}

function ajaxFollowAll() {
    if (acctsQueue.length == 0) {
        printMessage(chrome.i18n.getMessage('QueueEmpty'));
        $('#btnProcessQueue').removeClass('pulsing');


        if (document.getElementById('radioFollowAndLike').checked == true && mediaToLike.length > 0) {
            outputMessage('Loaded all media, beginning Likes...')
            likeAllMedia();
        }

        return false;
    }


    if (checkMaxActionsAndDelayIfNecessary(ajaxFollowAll) == false) {
        ajaxFollowUser(acctsQueue.shift());
    }
}

function removeAcctFromQueueDisplay(id, gray) {
    if (gray === true) {
        $('#igBotQueueContainer #' + id + '_container').css({
            'opacity': '.5'
        });
    } else {
        $('#igBotQueueContainer #' + id + '_container').fadeOut(300, function() {
            $(this).remove();
        });
    }
    updateCount();
}

function updateCount() {
    if (currentList === 'acctsWhiteList') {
        document.getElementById('igBotQueueCount').textContent = '' + acctsWhiteList.length + ' accounts';
    } else {
        document.getElementById('igBotQueueCount').textContent = '' + acctsQueue.length + ' accounts';
        document.getElementById('igBotmediaQueueCount').textContent = '' + mediaToLike.length + ' medias';
    }

    if (mediaToLike.length > 0) {
        $('#mediapaginationLimitDiv').show();
        $('#mediapaginationLimit option:selected').attr("selected", null);
        $('#mediapaginationLimit option[value="' + gblOptions.mediapaginationLimit + '"]').attr("selected", "selected");
    } else {
        $('#mediapaginationLimitDiv').hide();

    }

    if (acctsQueue.length > 0 || currentList == 'acctsWhiteList') {
        $('#paginationLimitDiv').show();
        $('#paginationLimit option:selected').attr("selected", null);
        $('#paginationLimit option[value="' + gblOptions.paginationLimit + '"]').attr("selected", "selected");

    } else {
        $('#paginationLimitDiv').hide();
    }
}

function addStamp(id, classname, text) {

    // if (gblOptions.removeAccountsFromQueue === true) {
    //     removeAcctFromQueueDisplay(id);
    //     return false;
    // }

    if (gblOptions.showStamps === true) {
        //$('#' + id + '_container label').append('<div class="stamp-div ' + classname + '">' + text + '</div>');
        $('img.igBotQueueAcctProfilePicture[data-ig-userid="' + id + '"],img.igBotMediaQueuePicture[data-img-id="' + id + '"]').parent().append('<div class="stamp-div ' + classname + '">' + text + '</div>');
        $('img.igBotQueueAcctProfilePicture[data-ig-userid="' + id + '"],img.igBotMediaQueuePicture[data-img-id="' + id + '"]').parent()[0].scrollIntoView();
        return true;
    }

    return false;

}

function getRandomizedTime(baseTime) {
    if (gblOptions.useRandomTimeDelay == true) {
        var minRandomTimeDelay = Math.max(0, baseTime - (baseTime * gblOptions.percentRandomTimeDelay));
        var maxRandomTimeDelay = baseTime + (baseTime * gblOptions.percentRandomTimeDelay);
        return getRandomInt(minRandomTimeDelay, maxRandomTimeDelay);
    }
    return baseTime;
}

function getNextActionDelayMs() {
    var base = getRandomizedTime(gblOptions.timeDelay);
    if (window.LovableSafety && typeof window.LovableSafety.getRecommendedDelay === 'function') {
        var recommended = window.LovableSafety.getRecommendedDelay();
        if (recommended > base) return recommended;
    }
    return base;
}

function usersMediaLoaded(r) {

    var numPicsToLike = parseInt(document.getElementById('numberFollowLikeLatestPics').value);

    if (r.acct && r.edges) {

        if (numPicsToLike > r.edges.length) {
            numPicsToLike = r.edges.length;
        }

    } else {
        numPicsToLike = 0;
    }

    for (var i = 0; i < numPicsToLike; i++) {
        var pieceOfMedia = r.edges[i].node;
        pieceOfMedia.owner = r.acct;
        mediaToLike.push(pieceOfMedia);
    }

    arrayOfMediaToDiv(mediaToLike, true);

    if (alreadyLiking == false) {
        likeAllMedia();
    }

}

function ajaxFollowUser(acct) {

    if (gblOptions.autoSaveQueue == true) {
        saveQueueToStorage();
    }


    var promises = [];
    let followable = true;

    if (!acct) {
        outputMessage('no account');
        return false;
    }

    var acctFromStorage = alreadyAttempted(acct);
    var waitTime = getRandomizedTime(gblOptions.timeDelayAfterSkip);
    var acctsQueueNextUsername = '';
    if (acctsQueue.length > 0) {
        acctsQueueNextUsername = acctsQueue[0].username;
    }

    if (gblOptions.followPeopleAlreadyAttempted === false && acctFromStorage !== false) {
        acctsProcessed.push(acct);
        outputMessage(acct.username + ' already attempted ' + timeToDate(acctFromStorage.followAttemptDate) + ': skipped; waiting  ' + (waitTime / 1000) + ' seconds to follow ' + acctsQueueNextUsername);
        addStamp(acct.id, 'stamp-div-grey', 'attempted');
        timeoutsQueue.push(setTimeout(ajaxFollowAll, waitTime));
        return false;
    } else if (acct.followed_by_viewer == true) {
        acctsProcessed.push(acct);
        outputMessage(acct.username + ' already being followed: skipped; waiting  ' + (waitTime / 1000) + ' seconds to follow ' + acctsQueueNextUsername);
        addStamp(acct.id, 'stamp-div-grey', 'followed');
        timeoutsQueue.push(setTimeout(ajaxFollowAll, waitTime));
        return false;
    } else if (acct.requested_by_viewer == true) {
        acctsProcessed.push(acct);
        outputMessage(acct.username + ' already requested: skipped; waiting  ' + (waitTime / 1000) + ' seconds to follow ' + acctsQueueNextUsername);
        addStamp(acct.id, 'stamp-div-grey', 'requested');
        timeoutsQueue.push(setTimeout(ajaxFollowAll, waitTime));
        return false;
    } else if (acct.is_private == true && gblOptions.followPrivateAccounts != true) {
        acctsProcessed.push(acct);
        outputMessage(acct.username + ' is private: skipped; waiting  ' + (waitTime / 1000) + ' seconds to follow ' + acctsQueueNextUsername);
        addStamp(acct.id, 'stamp-div-grey', 'private');
        timeoutsQueue.push(setTimeout(ajaxFollowAll, waitTime));
        return false;
    } else if (gblOptions.filterOptions.applyFiltersAutomatically == true) {
        promises.push(filterCriteriaMet(acct).then((met) => {
            if (met == false) {
                followable = false;
            }
        }));
    }

    Promise.all(promises).then(function() {

        if (followable === false) {
            acctsProcessed.push(acct);
            outputMessage(acct.username + ' did not match your filters: skipped; waiting  ' + (waitTime / 1000) + ' seconds to follow ' + acctsQueueNextUsername);

            if (acct.assumedDeleted) {
                addStamp(acct.id, 'stamp-div-red', '404');
            } else {
                addStamp(acct.id, 'stamp-div-grey', 'filtered');
            }

            if (noAcctsLeft()) return false;
            printMessage(' ');
            timeoutsQueue.push(setTimeout(ajaxFollowAll, waitTime));
            return false;
        }

        waitTime = getNextActionDelayMs();

        $.ajax({
                //url: 'https://www.instagram.com/web/friendships/' + acct.id + '/follow/',
                url: 'https://www.instagram.com/api/v1/friendships/create/' + acct.id + '/',
                method: 'POST',
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                    xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                    xhr.setRequestHeader('x-asbd-id', '129477');
                    xhr.setRequestHeader('x-ig-app-id', '936619743392459');
                },
                xhrFields: {
                    withCredentials: true
                }
            })
            .done(function() {

                acctsProcessed.push(acct);
                actionsTaken++;
                addStamp(acct.id, 'stamp-div-green', 'followed');
                addToAttempted(acct);

                // [Lovable] Hook direto: follow com sucesso
                if (window.LovableSync) try { window.LovableSync.onAction('follow', acct, true); } catch(e) {}

                outputMessage('Followed ' + acct.username + ' (' + acct.id + ') | ' + acctsProcessed.length + ' processed;  waiting  ' + (waitTime / 1000) + ' seconds to follow ' + acctsQueueNextUsername);
                timeoutsQueue.push(setTimeout(ajaxFollowAll, waitTime));

                if (document.getElementById('radioFollowAndLike').checked == true) {
                    ajaxLoadUsersMedia('', false, usersMediaLoaded, acct);
                }

            })
            .fail(function(data) {
                // [Lovable] Hook direto: follow com erro
                if (window.LovableSync) try { window.LovableSync.onAction('follow', acct, false, data.status); } catch(e) {}

                if (data.status !== 404) {
                    acctsQueue.unshift(acct);
                }

                if (data.status == 404) {
                    printMessage(acct.username + ' ' + chrome.i18n.getMessage('AccountNotFound404'));
                    addStamp(acct.id, 'stamp-div-red', '404');
                    timeoutsQueue.push(setTimeout(ajaxFollowAll, 1000));
                } else if (data.status == 403) {
                    printMessage(chrome.i18n.getMessage('RateLimitSoft', [(gblOptions.timeDelayAfterSoftRateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(ajaxFollowAll, gblOptions.timeDelayAfterSoftRateLimit));
                } else if (data.status == 400) {
                    if (data.responseJSON && data.responseJSON.message) {
                        if (data.responseJSON.feedback_title) {
                            outputMessage(data.responseJSON.feedback_title);
                        }

                        if (data.responseJSON.feedback_url) {
                            outputMessage(data.responseJSON.feedback_url);
                        }

                        if (data.responseJSON.feedback_message) {
                            if (data.responseJSON.feedback_message.indexOf('blocked') > -1) {
                                outputMessage('Message from Instagram (*NOT* Organic): ' + data.responseJSON.feedback_message);
                            }
                        }
                        // check if they are at the max
                        if (data.responseJSON.message.indexOf('max') > -1) {
                            $('#btnProcessQueue').removeClass('pulsing');
                            alert(data.responseJSON.message);
                            alert('If you have reached the maximum number of following, please note that pending follow requests on private accounts are counted by instagram as following.  You can see your pending requests by clicking the Load Pending Follow Requests button.');
                            return false;
                        }
                    }

                    printMessage(chrome.i18n.getMessage('RateLimitHard', [(gblOptions.timeDelayAfterHardRateLimit / 3600000)]));
                    timeoutsQueue.push(setTimeout(ajaxFollowAll, gblOptions.timeDelayAfterHardRateLimit));
                } else if (data.status == 429) {
                    printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(ajaxFollowAll, gblOptions.timeDelayAfter429RateLimit));
                } else {
                    outputMessage(data.status + ' error, trying again in 5 seconds');
                    timeoutsQueue.push(setTimeout(ajaxFollowAll, 5000));
                }
            });
    });
}


function ajaxLoadPostsFromHashtag(after) {

    if (typeof after != 'string') after = '';

    var hashtag = getHashtagFromUrl();

    if (hashtag == '') {
        outputMessage('Error - not on hashtag page');
        return false;
    }

    var count = 50;

    if (!isNaN(document.getElementById('txtLimitMediaQueueSize').value)) {
        count = document.getElementById('txtLimitMediaQueueSize').value;
    }


    document.getElementById('btnLikeHashtag').classList.add('pulsing');


    $.ajax({
            url: 'https://i.instagram.com/api/v1/tags/' + hashtag + '/sections/',
            data: after,
            method: 'POST',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                xhr.setRequestHeader('x-asbd-id', '129477');
                xhr.setRequestHeader('x-ig-app-id', '936619743392459');
            },
            xhrFields: {
                withCredentials: true
            }
        })
        .done(function(data) {

            if (data.more_available == true && (mediaToLike.length < parseInt(gblOptions.maxMediaQueueLength) || gblOptions.limitMediaQueue !== true)) {



                var medias = allNodes(data, 'media');
                for (var i = 0; i < medias.length; i++) {
                    mediaToLike.push(medias[i]);
                }

                mediaToLike = uniq(mediaToLike);

                printMessage('Loaded ' + mediaToLike.length + ' media out of ' + gblOptions.maxMediaQueueLength);

                outputMessage(mediaToLike.length + ' media out of ' + count + ' loaded to media queue')
                arrayOfMediaToDiv(mediaToLike, false);



                after = {
                    "max_id": data.next_max_id,
                    "page": data.next_page,
                    "next_media_ids": data.next_media_ids,
                    "tab": "recent",
                    "surface": "grid",
                    "include_persistent": 0
                }

                timeoutsQueue.push(setTimeout(function() {
                    ajaxLoadPostsFromHashtag(after);
                }, 500));

            } else {

                $('#btnLikeHashtag').removeClass('pulsing');

                arrayOfMediaToDiv(mediaToLike, true);
                printMessage(chrome.i18n.getMessage('Done'));

            }


        }).fail(function(f) {
            if (f.status == 429) {
                printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                timeoutsQueue.push(setTimeout(function() {
                    ajaxLoadPostsFromHashtag(after);
                }, gblOptions.timeDelayAfter429RateLimit));
            }
        });



}



function allNodes(obj, key, array) {
    array = array || [];
    if ('object' === typeof obj) {
        for (let k in obj) {
            if (k === key) {
                array.push(obj[k]);
            } else {
                allNodes(obj[k], key, array);
            }
        }
    }
    return array;
}

function uniq(arr) {


    const ids = arr.map(o => o.id)
    const filtered = arr.filter(({
        id
    }, index) => !ids.includes(id, index + 1))

    return filtered;

}


function getLocationFromUrl() {

    if (window.location.href.indexOf('/explore/locations/') == -1) {
        return '';
    }

    var tagFromUrl = window.location.href;
    tagFromUrl = tagFromUrl.replace('https://www.instagram.com/explore/locations/', '');
    tagFromUrl = tagFromUrl.slice(0, tagFromUrl.indexOf('/'));

    tagFromUrl = decodeURIComponent(tagFromUrl);

    return tagFromUrl;

}


function ajaxLoadPostsFromLocation(after) {

    var location = getLocationFromUrl();

    if (location == '') {
        outputMessage('Error - not on location page');
        return false;
    }

    $('#btnLoadLocationPosts').addClass('pulsing');


    if (!after.page) {
        printMessage('Loading media from location: ' + location);

        // the first request has a different URL and is a get request
        var url = 'https://www.instagram.com/api/v1/locations/web_info/?location_id=' + location + '&show_nearby=false';
        var method = 'GET';
        after = {};
    } else {
        var url = 'https://www.instagram.com/api/v1/locations/' + location + '/sections/';
        var method = 'POST';
    }

    $.ajax({
            url: url,
            data: after,
            method: method,
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                xhr.setRequestHeader('x-asbd-id', '129477');
                xhr.setRequestHeader('x-ig-app-id', '936619743392459');
            },
            xhrFields: {
                withCredentials: true
            }
        })
        .done(function(data) {

            var medias = allNodes(data, 'media');
            for (var i = 0; i < medias.length; i++) {
                mediaToLike.push(medias[i]);
            }

            mediaToLike = uniq(mediaToLike);

            printMessage('Loaded ' + mediaToLike.length + ' media out of ' + gblOptions.maxMediaQueueLength);

            arrayOfMediaToDiv(mediaToLike, false);

            // for first api call
            if (data.native_location_data && data.native_location_data.recent) {
                data = data.native_location_data.recent;
            }

            if (data.more_available == true && (mediaToLike.length < parseInt(gblOptions.maxMediaQueueLength) || gblOptions.limitMediaQueue !== true)) {

                after = {
                    "max_id": JSON.stringify(data.next_max_id),
                    "page": data.next_page,
                    "next_media_ids": JSON.stringify(data.next_media_ids),
                    "tab": "recent",
                    "surface": "grid",
                }

                timeoutsQueue.push(setTimeout(function() {
                    ajaxLoadPostsFromLocation(after);
                }, 200));
            } else {
                $('#btnLoadLocationPosts').removeClass('pulsing');

                printMessage(chrome.i18n.getMessage('Done'));
                printMessage(' ');
            }


        }).fail(function(f) {
            if (f.status == 429) {
                printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                timeoutsQueue.push(setTimeout(function() {
                    ajaxLoadPostsFromLocation(after);
                }, gblOptions.timeDelayAfter429RateLimit));
            }
        });

}



function LoadAccountsFromMedia() {

    if (mediaToLike.length == 0) {
        outputMessage('Error - no media loaded, please load media on the media queue tab');
        return false;
    }

    $('#btnLoadMediaPosters').addClass('pulsing');

    if (gblOptions.MediaIncludeLikersCommentersTagged == true) {
        var owners = allNodes(mediaToLike, 'owner');
        for (var i = 0; i < owners.length; i++) {
            var u = owners[i];

            if (u && u.pk) u.id = u.pk;
            if (u != null) acctsQueue.push(u);
        }

        var users = allNodes(mediaToLike, 'user');
        for (var i = 0; i < users.length; i++) {
            var u = users[i];
            if (u && u.pk) u.id = u.pk;
            if (u != null) acctsQueue.push(u);
        }
    } else {
        for (var i = 0; i < mediaToLike.length; i++) {
            if (mediaToLike[i].owner) {
                var u = mediaToLike[i].owner;
                if (u && u.pk) u.id = u.pk;
                if (u != null) acctsQueue.push(u);
            }
        }
    }


    acctsQueue = uniq(acctsQueue);


    // truncateQueue(gblOptions.truncateStart);


    arrayOfUsersToDiv(acctsQueue, true);

    $('#btnLoadMediaPosters').removeClass('pulsing');

    printMessage(chrome.i18n.getMessage('Done'));
    printMessage(' ');
}

async function ajaxLikeAllPostsFromFeed(after) {

    if (typeof after != 'string') {
        after = '';
    } else {
        after = '%22after%22%3A%22' + after + '%22%2C';
    }

    var count = '??';
    if (gblOptions.limitMediaQueue == true && !isNaN(document.getElementById('txtLimitMediaQueueSize').value)) {
        count = document.getElementById('txtLimitMediaQueueSize').value;
    }

    document.getElementById('btnLikeFeed').classList.add('pulsing');

    const fetchMedia = await fetch("https://www.instagram.com/graphql/query", {
        "headers": {
            "accept": "*/*",
            "content-type": "application/x-www-form-urlencoded",
            "priority": "u=1, i",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-asbd-id": "129477",
            "x-csrftoken": getCsrfFromCookie(),
            "x-fb-friendly-name": "PolarisProfilePostsQuery",
            "x-ig-app-id": "936619743392459"
        },
        "referrer": "https://www.instagram.com/",
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": "av=17841400482242408&__d=www&__user=0&__a=1&__req=t&__hs=20154.HYP%3Ainstagram_web_pkg.2.1...1&dpr=1&__ccg=EXCELLENT&__rev=1020686322&__s=0fq4up%3Aqwk9fx%3Aztxdzb&__hsi=7479118361645267327&__dyn=7xeUjG1mxu1syUbFp41twpUnwgU7SbzEdF8aUco2qwJxS0DU2wx609vCwjE1EE2Cw8G11wBz81s8hwGxu786a3a1YwBgao6C0Mo2iyo7u3ifK0EUjwGzEaE2iwNwmE2eUlwhEe87q0oa2-azqwt8d-2u2J0bS1LwTwKG1pg2fwxyo6O1FwlEcUed6goK2O4Xxui2qi7E5y4UrwHwGwa6bBK4o&__csr=goMB1hb2tRfdQwxbpLTSRvmhQB8jpqhWHA-BmnJkhQhrGRzGcUD9yV9p9oShAQ9GmUytfhAvAijVifBpaJ5AyummmqFGWABBypaJ4pohy49yVfCG8leoFA8Ahp8Kt4BleEK8x2UhAgyim8haBXDAWUF1J28jz8jVH-2lxCE01cu9FA9w2vVlhEkdV4vIwqwhQ0mO1axlwxGE2c81DxS1Aw39U1iU1-U1EE1ie26eg16C0wXwyxqfQAu5O2K4soTp83gyU421BU4JCg4a48ybxa5abwcR0d6mU5m0icgay9UCpwB2msg3K05Gcw06si0D80kDw&__hsdp=&__hblp=&__comet_req=7&fb_dtsg=NAcODTLMt5kxM-9MlWOVJnE0CiZb6vhOikbp1xwiOVjWF9npxxboJ3g%3A17843683126168011%3A1741209447&jazoest=26370&lsd=kulaA_fnsLsmyiVZWRxfLZ&__spin_r=1020686322&__spin_b=trunk&__spin_t=1741367942&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=PolarisFeedRootPaginationCachedQuery_subscribe&variables=%7B" + after + "%22before%22%3Anull%2C%22data%22%3A%7B%22device_id%22%3A%22E1F25225-A6AE-44CF-9EC8-932EC7E261CB%22%2C%22is_async_ads_double_request%22%3A%220%22%2C%22is_async_ads_in_headload_enabled%22%3A%220%22%2C%22is_async_ads_rti%22%3A%220%22%2C%22rti_delivery_backend%22%3A%220%22%7D%2C%22first%22%3A12%2C%22last%22%3Anull%2C%22variant%22%3A%22home%22%2C%22__relay_internal__pv__PolarisIsLoggedInrelayprovider%22%3Atrue%2C%22__relay_internal__pv__PolarisShareSheetV3relayprovider%22%3Afalse%7D&server_timestamps=true&doc_id=28982951317985068",
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
    });

    var jsonData = await fetchMedia.json();
    var r = jsonData.data.xdt_api__v1__feed__timeline__connection;

    if (r.edges) {
        for (var i = 0; i < r.edges.length; i++) {
            var mediaNode = r.edges[i].node.media;
            if (gblOptions.includeSuggestedPostsFromFeed == true || (mediaNode && mediaNode != null && mediaNode.owner && mediaNode.owner != null && mediaNode.owner.friendship_status && mediaNode.owner.friendship_status.following == true)) {
                if (mediaNode && mediaNode.id) mediaToLike.push(mediaNode);
            }
        }
        var hasNextPage = r.page_info.has_next_page;
        if (hasNextPage == true) {
            after = r.page_info.end_cursor;
        }
        arrayOfMediaToDiv(mediaToLike, false);
    } else {
        printMessage(' ');
        printMessage(' ');
        outputMessage('Error liking feed - please report to organicautomator@gmail.com');
        printMessage(' ');
        printMessage(' ');
    }

    if ((hasNextPage == true && after != '') && (gblOptions.limitMediaQueue == false || mediaToLike.length < gblOptions.maxMediaQueueLength)) {
        outputMessage(mediaToLike.length + ' media out of ' + count + ' loaded to media queue.')
        timeoutsQueue.push(setTimeout(function() {
            ajaxLikeAllPostsFromFeed(after);
        }, 500));
    } else {
        document.getElementById('btnLikeFeed').classList.remove('pulsing');
        printMessage('Done.');
    }


}

async function watchReels() {

    var reels = mediaToLike.filter(e => e.media_type == 2 || e.is_video == true);

    for (var i = 0; i < reels.length; i++) {

        reels[i].SaveWhenWatchingReel = gblOptions.SaveWhenWatchingReel;
        reels[i].LikeWhenWatchingReel = gblOptions.LikeWhenWatchingReel;

        var done = await watchReel(reels[i]);

        addStamp(reels[i].id, 'stamp-div-green', 'watched');

        if (timeoutsQueue.length == 0) break;

    }

}

function watchReel(reel) {

    return new Promise(function(resolve, reject) {

        chrome.runtime.sendMessage({
            "openReelTab": reel
        });

        timeoutsQueue.push(
            setTimeout(function() {
                resolve(true);
            }, ((reel.video_duration || 20) * 1000) + 5)
        );

    });

}

function likeAllMedia() {
    alreadyLiking = true;
    if (gblOptions.showLikesInQueue === true) {
        handleImagePreload();
        handleMediaCheckBoxes(mediaToLike);
    }

    if (mediaToLike.length == 0) {
        $('#btnLikeFeed,#btnLikeHashtag').removeClass('pulsing');
        alreadyLiking = false;
        return false;
    }

    var media = mediaToLike.shift();
    var id = media.id;

    for (var i = 0; i < previousLikes.length; i++) {
        if (id == previousLikes[i]) {
            outputMessage('Already liked, moving on...');
            addStamp(media.id, 'stamp-div-grey', 'skipped');

            timeoutsQueue.push(setTimeout(likeAllMedia, 1));
            return false;
        }
    }

    likeMedia(media);
}

function likeMedia(media) {

    var idToLike = media.id;

    if (media.pk) idToLike = media.pk;

    $.ajax({
            url: 'https://www.instagram.com/web/likes/' + idToLike + '/like/',
            method: 'POST',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                xhr.setRequestHeader('x-asbd-id', '129477');
                xhr.setRequestHeader('x-ig-app-id', '936619743392459');
            },
            xhrFields: {
                withCredentials: true
            }
        })
        .done(function() {
            previousLikes.push(media.id);

            savePreviousLikesToStorage();

            // [Lovable] Hook direto: like com sucesso
            if (window.LovableSync) try { window.LovableSync.onAction('like', media.user || {}, true); } catch(e) {}

            if (media.user && media.user.username) {
                outputMessage('Liked post for ' + media.user.username);
            } else {
                outputMessage('Liked post')
            }

            addStamp(media.id, 'stamp-div-green', 'liked');


            var waitTime = getNextActionDelayMs();

            if (mediaToLike.length > 0) {
                outputMessage('waiting  ' + (waitTime / 1000) + ' seconds to Like next');
                timeoutsQueue.push(setTimeout(likeAllMedia, waitTime));
                alreadyLiking = true;
            } else {
                alreadyLiking = false;
            }

        })
        .fail(function(data) {
            // [Lovable] Hook direto: like com erro
            if (window.LovableSync) try { window.LovableSync.onAction('like', media.user || {}, false, data.status); } catch(e) {}

            mediaToLike.unshift(media);
            if (data.status == 403) {
                printMessage(chrome.i18n.getMessage('RateLimitSoft', [(gblOptions.timeDelayAfterSoftRateLimit / 60000)]));
                timeoutsQueue.push(setTimeout(likeAllMedia, gblOptions.timeDelayAfterSoftRateLimit));
            } else if (data.status == 400) {
                printMessage(chrome.i18n.getMessage('RateLimitHard', [(gblOptions.timeDelayAfterHardRateLimit / 3600000)]));
                timeoutsQueue.push(setTimeout(likeAllMedia, gblOptions.timeDelayAfterHardRateLimit));
            } else if (data.status == 429) {
                printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                timeoutsQueue.push(setTimeout(likeAllMedia, gblOptions.timeDelayAfter429RateLimit));
            } else {
                outputMessage(data.status + ' error, trying again in 5 seconds');
                timeoutsQueue.push(setTimeout(likeAllMedia, 5000));
            }
        });
}

async function populateAllQueueUsersInfo(q) {
    for (var i = 0; i < q.length; i++) {
        q[i] = await getAdditionalDataForAcct(q[i]);

        var $$tr = $('#cb_' + q[i].id).parents('tr[role="row"]');

        for (const [key, value] of Object.entries(q[i])) {

            var cols = gbDefaultColumns;
            cols = cols.filter(c => c.data == key);

            var $$td = $$tr.children('td[column-data="' + key + '"]');
            if ($$td.html() == '' || $$td.text() == '-' || $$td.attr('column-data') == 'external_url') {
                $$td.text(value);
                if (cols[0] && cols[0].formatter && typeof value != 'undefined' && value != null) {
                    $$td.html(cols[0].formatter.replace(/\${ig_id}/g, q[i].id).replace(/\${cell}/g, value));
                }
            }
        }

        printMessage(chrome.i18n.getMessage('DataLoaded', [(i + 1), q.length]));
    }

    acctsQueue = q;

    if (window.confirm('Delete accounts which were not found?')) {
        var newq = q;
        newq = newq.filter(e => e.hasOwnProperty('assumedDeleted') == false);
        acctsQueue = newq;
    }

    arrayOfUsersToDiv(acctsQueue, true);

    if (window.confirm(chrome.i18n.getMessage('FinishedAdditionalData'))) {
        saveQueueToStorageAndDisk();
    }

    $('#btnProcessQueue').removeClass('pulsing');
}

function maxActionsExceeded() {
    if (gblOptions.maxPerEnabled == true && (actionsTaken >= gblOptions.maxPerActions)) {
        var todaysdate = new Date();
        maxActionsDelayStartTime = todaysdate.getTime();

        return true;
    }
    return false;
}

function maxActionsDelayRemaining() {
    var todaysdate = new Date();
    var today = todaysdate.getTime();
    var timeSinceActionsMaxed;
    timeSinceActionsMaxed = today - maxActionsDelayStartTime;

    return (gblOptions.maxPerPeriod - timeSinceActionsMaxed);
}

function checkMaxActionsAndDelayIfNecessary(callback) {
    if (maxActionsExceeded() && maxActionsDelayRemaining() > 0) {
        timeoutsQueue.push(setTimeout(callback, maxActionsDelayRemaining()));
        outputMessage('Max actions exceeded, waiting ' + millisecondsToHumanReadable(maxActionsDelayRemaining(), true));
        actionsTaken = 0;
        return true;
    }

    if (window.LovableSafety && typeof window.LovableSafety.canProceed === 'function') {
        var check = window.LovableSafety.canProceed();
        if (!check.allowed) {
            outputMessage('[Safety] ' + (check.reason || 'Pausado — aguardando'));
            var delayMs = 60000;
            if (check.unblockAt && check.unblockAt > Date.now()) {
                delayMs = Math.min(check.unblockAt - Date.now(), 600000);
            } else if (window.LovableSafety.cooldownUntil > Date.now()) {
                delayMs = Math.min(window.LovableSafety.cooldownUntil - Date.now(), 600000);
            }
            timeoutsQueue.push(setTimeout(callback, delayMs));
            return true;
        }
    }

    return false;
}


function ajaxRemoveOrBlockAll() {
    if (checkMaxActionsAndDelayIfNecessary(ajaxRemoveOrBlockAll) == false) {
        ajaxRemoveOrBlockAcct(acctsQueue.pop());
    }
}


function viewStories() {
    if (checkMaxActionsAndDelayIfNecessary(viewStories) == false) {
        viewStory(acctsQueue.pop());
    }
}

async function viewStory(acct) {

    acct = await getAdditionalDataForAcct(acct);

    // Filter: private not followed
    if (gblOptions.storySkipPrivateNotFollowed && acct.is_private === true && acct.followed_by_viewer === false) {
        addStamp(acct.id, 'stamp-div-grey', 'private');
        outputMessage('Skipping ' + acct.username + ' - private account');
        timeoutsQueue.push(setTimeout(viewStories, gblOptions.timeDelayAfterSkip));
        return false;
    }

    // Filter: min followers
    if (gblOptions.storyFilterMinFollowers > 0 && acct.edge_followed_by) {
        if (acct.edge_followed_by.count < gblOptions.storyFilterMinFollowers) {
            addStamp(acct.id, 'stamp-div-grey', 'filtered');
            outputMessage('Skipping ' + acct.username + ' - below min followers for stories');
            timeoutsQueue.push(setTimeout(viewStories, gblOptions.timeDelayAfterSkip));
            return false;
        }
    }

    // Filter: max followers
    if (gblOptions.storyFilterMaxFollowers > 0 && acct.edge_followed_by) {
        if (acct.edge_followed_by.count > gblOptions.storyFilterMaxFollowers) {
            addStamp(acct.id, 'stamp-div-grey', 'filtered');
            outputMessage('Skipping ' + acct.username + ' - above max followers for stories');
            timeoutsQueue.push(setTimeout(viewStories, gblOptions.timeDelayAfterSkip));
            return false;
        }
    }

    chrome.runtime.sendMessage({
        "openStoryTab": {
            "username": acct.username,
            "LikeWhenWatchingStory": document.getElementById('cbViewStoryLike').checked,
            "ReplyWhenWatchingStory": gblOptions.storyReplyEnabled,
            "ReplyTemplates": gblOptions.storyReplyTemplates,
            "ReplyProbability": gblOptions.storyReplyProbability,
            "acct": acct
        }
    });

    // closedStoryTab(acct);

}

function closedStoryTab(request) {

    var acct = request.acct;

    if (request.viewed == true) {
        addStamp(acct.id, 'stamp-div-green', 'Viewed Story');
        // [Lovable] Hook direto: story visualizado com sucesso
        if (window.LovableSync) try { window.LovableSync.onAction('story_view', acct, true); } catch(e) {}
    } else {
        addStamp(acct.id, 'stamp-div-grey', 'No Story');
        // [Lovable] Hook direto: sem story (não é erro, mas registrar)
        if (window.LovableSync) try { window.LovableSync.onAction('story_view', acct, false); } catch(e) {}
    }

    if (noAcctsLeft()) {
        return false;
    }

    if (gblOptions.autoSaveQueue == true) {
        saveQueueToStorage();
    }

    var waitTime = getNextActionDelayMs();

    outputMessage('waiting  ' + (waitTime / 1000) + ' seconds to view ' + acctsQueue[acctsQueue.length - 1].username + ' story');
    timeoutsQueue.push(setTimeout(viewStories, waitTime));
    return false;
}

// ========== AUTO COMMENT SYSTEM ==========

// ---- SAFETY ENGINE ----
var commentSafety = {
    // Thresholds
    WARMUP_COMMENTS: 3,           // First N comments use extra-long delays
    WARMUP_DELAY_MIN: 300000,     // 5 min between first 3 comments
    WARMUP_DELAY_MAX: 480000,     // 8 min
    REST_AFTER_COMMENTS: 8,       // Rest after every N comments
    REST_DURATION_MIN: 600000,    // 10 min rest
    REST_DURATION_MAX: 1200000,   // 20 min rest
    MAX_PER_ACCOUNT: 1,           // Max comments per account per session
    MAX_ERRORS_BEFORE_STOP: 3,    // Stop after N consecutive errors
    COOLDOWN_AFTER_400: 7200000,  // 2h after 400 error
    COOLDOWN_AFTER_429: 3600000,  // 1h after 429 error
    COOLDOWN_AFTER_403: 1800000,  // 30min after 403 error
    MIN_COMMENT_LENGTH: 4,        // Min comment chars
    MAX_IDENTICAL_RATIO: 0.5,     // Max ratio of identical comments in session

    // State
    consecutiveErrors: 0,
    commentsPerAccount: {},
    commentTextsUsed: [],
    sessionStartTime: 0,
    totalSessionComments: 0,
    isResting: false,
    blockCount: 0,               // How many times blocked this session

    reset: function() {
        this.consecutiveErrors = 0;
        this.commentsPerAccount = {};
        this.commentTextsUsed = [];
        this.sessionStartTime = Date.now();
        this.totalSessionComments = 0;
        this.isResting = false;
        this.blockCount = 0;
    },

    // Check if safe to comment on this account
    canCommentOnAccount: function(username) {
        if (!username) return { ok: false, reason: 'no_username' };
        var count = this.commentsPerAccount[username] || 0;
        if (count >= this.MAX_PER_ACCOUNT) {
            return { ok: false, reason: 'max_per_account', count: count };
        }
        return { ok: true };
    },

    // Record a comment was made
    recordComment: function(username, commentText) {
        this.commentsPerAccount[username] = (this.commentsPerAccount[username] || 0) + 1;
        this.commentTextsUsed.push(commentText);
        this.totalSessionComments++;
        this.consecutiveErrors = 0;
    },

    // Record an error
    recordError: function(status) {
        this.consecutiveErrors++;
        if (status === 400 || status === 403 || status === 429) {
            this.blockCount++;
        }
    },

    // Should we stop entirely?
    shouldStop: function() {
        if (this.consecutiveErrors >= this.MAX_ERRORS_BEFORE_STOP) {
            return { stop: true, reason: '🛑 ' + this.consecutiveErrors + ' consecutive errors. Stopping to protect your account.' };
        }
        if (this.blockCount >= 2) {
            return { stop: true, reason: '🛑 Blocked ' + this.blockCount + ' times this session. Stopping to avoid further restrictions.' };
        }
        return { stop: false };
    },

    // Should we rest now?
    shouldRest: function() {
        if (this.totalSessionComments > 0 && this.totalSessionComments % this.REST_AFTER_COMMENTS === 0) {
            return true;
        }
        return false;
    },

    // Get rest duration
    getRestDuration: function() {
        return Math.floor(Math.random() * (this.REST_DURATION_MAX - this.REST_DURATION_MIN)) + this.REST_DURATION_MIN;
    },

    // Get smart delay based on session state
    getSmartDelay: function() {
        // Warmup phase: extra long delays
        if (this.totalSessionComments < this.WARMUP_COMMENTS) {
            var delay = Math.floor(Math.random() * (this.WARMUP_DELAY_MAX - this.WARMUP_DELAY_MIN)) + this.WARMUP_DELAY_MIN;
            return { delay: delay, phase: 'warmup' };
        }

        // Normal phase: use configured delays with progressive increase
        var min = gblOptions.minCommentDelay || 180000;
        var max = gblOptions.maxCommentDelay || 420000;

        // Add 10% more delay per every 5 comments after warmup
        var progressMultiplier = 1 + (Math.floor(this.totalSessionComments / 5) * 0.1);
        progressMultiplier = Math.min(progressMultiplier, 2.0); // Cap at 2x

        min = Math.floor(min * progressMultiplier);
        max = Math.floor(max * progressMultiplier);

        // Add random jitter (±15%)
        var jitter = 1 + (Math.random() * 0.3 - 0.15);
        var delay = Math.floor((Math.random() * (max - min) + min) * jitter);

        return { delay: delay, phase: 'normal', multiplier: progressMultiplier.toFixed(1) };
    },

    // Get cooldown after error
    getCooldown: function(status) {
        // Progressive: each block makes it longer
        var multiplier = 1 + (this.blockCount * 0.5);
        if (status === 400) return Math.floor(this.COOLDOWN_AFTER_400 * multiplier);
        if (status === 429) return Math.floor(this.COOLDOWN_AFTER_429 * multiplier);
        if (status === 403) return Math.floor(this.COOLDOWN_AFTER_403 * multiplier);
        return 60000; // 1 min default
    },

    // Validate comment isn't too spammy
    validateComment: function(text) {
        if (!text || text.length < this.MIN_COMMENT_LENGTH) {
            return { ok: false, reason: 'too_short' };
        }
        // Check if this exact text was used too many times this session
        var sameCount = this.commentTextsUsed.filter(function(t) { return t === text; }).length;
        var total = this.commentTextsUsed.length || 1;
        if (sameCount > 0 && sameCount / total > this.MAX_IDENTICAL_RATIO) {
            return { ok: false, reason: 'too_repetitive' };
        }
        return { ok: true };
    },

    // Get session stats string
    getStats: function() {
        var elapsed = Math.round((Date.now() - this.sessionStartTime) / 60000);
        return '📊 Session: ' + this.totalSessionComments + ' comments in ' + elapsed + 'min, ' +
               Object.keys(this.commentsPerAccount).length + ' accounts, ' +
               this.blockCount + ' blocks';
    },

    // Activity log
    _logEntries: [],
    _currentPhase: 'idle', // idle, warmup, active, resting, blocked, done

    logEvent: function(msg) {
        var now = new Date();
        var time = ('0'+now.getHours()).slice(-2) + ':' + ('0'+now.getMinutes()).slice(-2) + ':' + ('0'+now.getSeconds()).slice(-2);
        this._logEntries.push({ time: time, msg: msg });
        if (this._logEntries.length > 30) this._logEntries.shift();
        this.updateUI();
    },

    setPhase: function(phase, detail) {
        this._currentPhase = phase;
        this._phaseDetail = detail || '';
        this.updateUI();
    },

    updateUI: function() {
        // Phase
        var phaseEl = document.getElementById('safetyPhase');
        var phaseIcon = document.getElementById('safetyPhaseIcon');
        var phaseText = document.getElementById('safetyPhaseText');
        var phaseDetail = document.getElementById('safetyPhaseDetail');
        if (!phaseEl) return; // Panel not visible

        phaseEl.className = 'safety-phase';
        switch(this._currentPhase) {
            case 'warmup':
                phaseEl.classList.add('phase-warmup');
                phaseIcon.textContent = '🔰';
                phaseText.textContent = 'WARMUP';
                phaseDetail.textContent = this._phaseDetail || (this.totalSessionComments + '/' + this.WARMUP_COMMENTS + ' warm');
                break;
            case 'active':
                phaseEl.classList.add('phase-active');
                phaseIcon.textContent = '🟢';
                phaseText.textContent = 'ACTIVE';
                phaseDetail.textContent = this._phaseDetail || 'Commenting safely';
                break;
            case 'resting':
                phaseEl.classList.add('phase-resting');
                phaseIcon.textContent = '😴';
                phaseText.textContent = 'RESTING';
                phaseDetail.textContent = this._phaseDetail || 'Safety pause';
                break;
            case 'blocked':
                phaseEl.classList.add('phase-blocked');
                phaseIcon.textContent = '🚫';
                phaseText.textContent = 'BLOCKED';
                phaseDetail.textContent = this._phaseDetail || 'Cooling down';
                break;
            case 'done':
                phaseEl.classList.add('phase-active');
                phaseIcon.textContent = '✅';
                phaseText.textContent = 'DONE';
                phaseDetail.textContent = this._phaseDetail || 'Session complete';
                break;
            default:
                phaseIcon.textContent = '⏸️';
                phaseText.textContent = 'IDLE';
                phaseDetail.textContent = 'Waiting to start';
        }

        // Session stats
        var el;
        el = document.getElementById('safetySessionCount');
        if (el) el.textContent = this.totalSessionComments;
        el = document.getElementById('safetyAccountsCount');
        if (el) el.textContent = Object.keys(this.commentsPerAccount).length;

        // Day stats
        el = document.getElementById('safetyDayCount');
        if (el) el.textContent = commentsDoneToday || 0;
        el = document.getElementById('safetyDayMax');
        if (el) el.textContent = gblOptions.maxCommentsPerDay || 15;

        // Bar fills
        var dayPct = ((commentsDoneToday || 0) / (gblOptions.maxCommentsPerDay || 15)) * 100;
        el = document.getElementById('safetyDayBar');
        if (el) {
            el.style.width = Math.min(dayPct, 100) + '%';
            el.className = 'safety-stat-fill' + (dayPct > 80 ? ' safety-fill-danger' : dayPct > 50 ? ' safety-fill-warning' : '');
        }

        var sessionPct = (this.totalSessionComments / (gblOptions.maxCommentsPerDay || 15)) * 100;
        el = document.getElementById('safetySessionBar');
        if (el) el.style.width = Math.min(sessionPct, 100) + '%';

        // Warmup
        el = document.getElementById('safetyWarmupStatus');
        if (el) el.textContent = Math.min(this.totalSessionComments, this.WARMUP_COMMENTS) + '/' + this.WARMUP_COMMENTS;
        el = document.getElementById('safetyWarmup');
        if (el) {
            el.className = 'safety-indicator' + (this.totalSessionComments < this.WARMUP_COMMENTS ? ' ind-warning' : '');
        }

        // Errors
        el = document.getElementById('safetyErrorsStatus');
        if (el) el.textContent = this.consecutiveErrors + '/' + this.MAX_ERRORS_BEFORE_STOP;
        el = document.getElementById('safetyErrors');
        if (el) {
            el.className = 'safety-indicator' + (this.consecutiveErrors >= 2 ? ' ind-danger' : this.consecutiveErrors >= 1 ? ' ind-warning' : '');
        }

        // Blocks
        el = document.getElementById('safetyBlocksStatus');
        if (el) el.textContent = this.blockCount + '/2';
        el = document.getElementById('safetyBlocks');
        if (el) {
            el.className = 'safety-indicator' + (this.blockCount >= 2 ? ' ind-danger' : this.blockCount >= 1 ? ' ind-warning' : '');
        }

        // Rest
        var nextRest = this.REST_AFTER_COMMENTS - (this.totalSessionComments % this.REST_AFTER_COMMENTS);
        el = document.getElementById('safetyRestStatus');
        if (el) el.textContent = 'in ' + nextRest;

        // Log
        var logEl = document.getElementById('safetyLog');
        if (logEl && this._logEntries.length > 0) {
            var html = '';
            for (var i = this._logEntries.length - 1; i >= Math.max(0, this._logEntries.length - 15); i--) {
                var entry = this._logEntries[i];
                html += '<div class="safety-log-entry"><span class="safety-log-time">' + entry.time + '</span>' + entry.msg + '</div>';
            }
            logEl.innerHTML = html;
        }

        // Hour counter (approximate from session data)
        var sessionMins = (Date.now() - this.sessionStartTime) / 60000;
        var hourCount = sessionMins <= 60 ? this.totalSessionComments : Math.round(this.totalSessionComments / (sessionMins / 60));
        el = document.getElementById('safetyHourCount');
        if (el) el.textContent = sessionMins <= 60 ? this.totalSessionComments : hourCount;
        el = document.getElementById('safetyHourMax');
        if (el) el.textContent = '-';

        var hourBar = document.getElementById('safetyHourBar');
        if (hourBar) {
            var hPct = (hourCount / 15) * 100; // rough estimate
            hourBar.style.width = Math.min(hPct, 100) + '%';
        }
    }
};

function getActiveCommentTemplates() {
    // If user has custom templates, use ONLY those (not mixed with defaults)
    if (gblOptions.customCommentTemplates && gblOptions.customCommentTemplates.length > 0) {
        return {
            custom: gblOptions.customCommentTemplates,
            emojis_pool: (gblOptions.commentTemplates || commentTemplates || {}).emojis_pool || ['🔥','❤️','👏','✨','💯','🙌','😍','💪','🎯','🚀','⭐','👀','💡','🌟','🤩']
        };
    }
    // Fallback to built-in templates
    if (gblOptions.commentTemplates) {
        return JSON.parse(JSON.stringify(gblOptions.commentTemplates));
    }
    return JSON.parse(JSON.stringify(commentTemplates));
}

function getRandomComment(media, acct) {
    var templates = getActiveCommentTemplates();
    var categories = Object.keys(templates).filter(function(k) { return k !== 'emojis_pool'; });

    if (categories.length === 0) {
        outputMessage('No comment templates available');
        return null;
    }

    var category = categories[Math.floor(Math.random() * categories.length)];
    var templateList = templates[category];

    if (!templateList || templateList.length === 0) return null;

    var template = templateList[Math.floor(Math.random() * templateList.length)];

    if (acct && acct.username) {
        template = template.replace(/\{username\}/g, acct.username);
    } else {
        template = template.replace(/@?\{username\}/g, '').trim();
    }

    if (gblOptions.commentVariation) {
        template = addCommentVariation(template, templates.emojis_pool || commentTemplates.emojis_pool);
    }

    return template;
}

function addCommentVariation(text, emojisPool) {
    if (text.includes('{emoji}')) {
        var emoji = emojisPool[Math.floor(Math.random() * emojisPool.length)];
        text = text.replace(/\{emoji\}/g, emoji);
    }

    if (Math.random() > 0.5) {
        var extraEmoji = emojisPool[Math.floor(Math.random() * emojisPool.length)];
        if (!text.endsWith(extraEmoji)) {
            text = text + ' ' + extraEmoji;
        }
    }

    if (Math.random() > 0.8 && text.length > 3) {
        text = text.charAt(0).toLowerCase() + text.slice(1);
    }

    return text;
}

function validateComment(text) {
    text = text.replace(/[\x00-\x1F\x7F]/g, '');
    if (text.length < 2) return null;
    if (text.length > 2200) text = text.substring(0, 2200);
    return text;
}

async function postComment(mediaId, commentText) {
    // Ensure we use the numerical media PK, not the full graphql id
    var mediaPk = String(mediaId).split('_')[0];

    if (!mediaPk || mediaPk === 'undefined' || mediaPk === 'null') {
        throw {status: 0, message: 'Invalid media ID: ' + mediaId};
    }

    var response = await fetch('https://www.instagram.com/api/v1/web/comments/' + mediaPk + '/add/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCsrfFromCookie(),
            'X-Instagram-AJAX': '1',
            'X-ASBD-ID': '129477',
            'X-IG-App-ID': '936619743392459',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: 'comment_text=' + encodeURIComponent(commentText),
        credentials: 'include'
    });

    // Any 2xx = success (comment was posted)
    if (response.ok) {
        var data = null;
        try {
            data = await response.json();
        } catch(e) {
            // Response wasn't JSON but comment was posted (2xx)
            data = { status: 'ok', _rawResponse: true };
        }
        return data;
    }

    // Error responses
    var errorBody = '';
    try { errorBody = await response.text(); } catch(e) {}
    var errorMsg = '';
    try { errorMsg = JSON.parse(errorBody).message || ''; } catch(e) {}

    throw {
        status: response.status,
        message: errorMsg || ('HTTP ' + response.status),
        responseText: errorBody
    };
}

function canCommentNow() {
    if (commentsDoneToday >= gblOptions.maxCommentsPerDay) {
        outputMessage('Daily comment limit reached (' + gblOptions.maxCommentsPerDay + '). Stopping comments.');
        return false;
    }
    var timeSinceLastComment = Date.now() - lastCommentTime;
    if (timeSinceLastComment < gblOptions.minCommentDelay) {
        return false;
    }
    return true;
}

function getCommentDelay() {
    var min = gblOptions.minCommentDelay;
    var max = gblOptions.maxCommentDelay;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shouldCommentOnMedia(media) {
    if (gblOptions.avoidDuplicateComments) {
        var mediaId = String(media.pk || media.id || '').split('_')[0];
        if (mediaId && commentsLog.includes(mediaId)) {
            return { ok: false, reason: 'duplicate' };
        }
    }
    if (gblOptions.commentOnlyRecent) {
        var takenAt = media.taken_at || media.taken_at_timestamp || 0;
        if (typeof takenAt === 'string') takenAt = new Date(takenAt).getTime() / 1000;
        if (takenAt > 0) {
            var postAge = (Date.now() / 1000) - takenAt;
            var maxAge = gblOptions.commentRecentHours * 3600;
            if (postAge > maxAge) {
                var daysOld = Math.round(postAge / 86400);
                return { ok: false, reason: 'too_old', daysOld: daysOld };
            }
        }
    }
    return { ok: true };
}

var _commentSkipStats = { duplicate: 0, too_old: 0, no_id: 0, total: 0 };

async function commentAllMedia() {
  try {
    // === FINISH CHECK ===
    if (mediaForComments.length === 0) {
        if (_commentSkipStats.total > 0 && commentsDoneToday === 0) {
            outputMessage('⚠️ All ' + _commentSkipStats.total + ' posts were skipped:');
            if (_commentSkipStats.duplicate > 0) outputMessage('   → ' + _commentSkipStats.duplicate + ' already commented');
            if (_commentSkipStats.too_old > 0) outputMessage('   → ' + _commentSkipStats.too_old + ' too old. Disable "Only recent posts" in settings.');
            if (_commentSkipStats.no_id > 0) outputMessage('   → ' + _commentSkipStats.no_id + ' had no media ID');
        } else {
            outputMessage('✅ Done! ' + commentsDoneToday + ' comments today.');
        }
        outputMessage(commentSafety.getStats());
        _commentSkipStats = { duplicate: 0, too_old: 0, no_id: 0, total: 0 };
        try { updateCommentStats(); } catch(e) {}
        $('#btnProcessQueue').removeClass('pulsing');
        return;
    }

    // === SAFETY: should we stop entirely? ===
    var stopCheck = commentSafety.shouldStop();
    if (stopCheck.stop) {
        outputMessage(stopCheck.reason);
        commentSafety.setPhase('blocked', 'Stopped: safety limit');
        commentSafety.logEvent('🛑 Auto-stopped: ' + stopCheck.reason.substring(0,40));
        outputMessage(commentSafety.getStats());
        _commentSkipStats = { duplicate: 0, too_old: 0, no_id: 0, total: 0 };
        try { updateCommentStats(); } catch(e) {}
        $('#btnProcessQueue').removeClass('pulsing');
        return;
    }

    // === DAILY LIMIT CHECK ===
    if (commentsDoneToday >= gblOptions.maxCommentsPerDay) {
        outputMessage('🛑 Daily limit reached (' + commentsDoneToday + '/' + gblOptions.maxCommentsPerDay + ').');
        commentSafety.setPhase('done', 'Daily limit reached');
        commentSafety.logEvent('🛑 Daily limit: ' + commentsDoneToday + '/' + gblOptions.maxCommentsPerDay);
        outputMessage(commentSafety.getStats());
        _commentSkipStats = { duplicate: 0, too_old: 0, no_id: 0, total: 0 };
        try { updateCommentStats(); } catch(e) {}
        $('#btnProcessQueue').removeClass('pulsing');
        return;
    }

    // === SAFETY: rest period? ===
    if (commentSafety.shouldRest()) {
        var restTime = commentSafety.getRestDuration();
        commentSafety.setPhase('resting', 'Pausing ' + Math.round(restTime / 60000) + 'min');
        commentSafety.logEvent('😴 Rest pause: ' + Math.round(restTime / 60000) + 'min');
        outputMessage('😴 Safety rest: pausing ' + Math.round(restTime / 60000) + ' min to avoid detection... (' + commentSafety.getStats() + ')');
        timeoutsQueue.push(setTimeout(commentAllMedia, restTime));
        return;
    }

    // === GET NEXT MEDIA ===
    var media = mediaForComments.shift();
    _commentSkipStats.total++;
    var mediaId = media.pk || media.id;

    if (!mediaId) {
        _commentSkipStats.no_id++;
        timeoutsQueue.push(setTimeout(commentAllMedia, 0));
        return;
    }

    // === SKIP CHECKS ===
    var check = shouldCommentOnMedia(media);
    if (check && !check.ok) {
        if (check.reason === 'duplicate') _commentSkipStats.duplicate++;
        else if (check.reason === 'too_old') _commentSkipStats.too_old++;
        try { addStamp(mediaId, 'stamp-div-grey', 'skip'); } catch(e) {}
        timeoutsQueue.push(setTimeout(commentAllMedia, 0));
        return;
    }

    var acct = media.user || media.owner || {};
    var username = acct.username || 'unknown';

    // === SAFETY: per-account limit ===
    var acctCheck = commentSafety.canCommentOnAccount(username);
    if (!acctCheck.ok) {
        // Silent skip — already commented on this account this session
        try { addStamp(mediaId, 'stamp-div-grey', 'limit'); } catch(e) {}
        timeoutsQueue.push(setTimeout(commentAllMedia, 0));
        return;
    }

    // === GENERATE COMMENT ===
    var comment = null;
    // Try up to 3 times to get a non-repetitive comment
    for (var attempt = 0; attempt < 3; attempt++) {
        comment = getRandomComment(media, acct);
        if (!comment) break;
        comment = validateComment(comment);
        if (!comment) continue;
        var safetyCheck = commentSafety.validateComment(comment);
        if (safetyCheck.ok) break;
        comment = null; // try again
    }

    if (!comment) {
        outputMessage('⚠️ No valid comment template. Add more templates for variety.');
        _commentSkipStats = { duplicate: 0, too_old: 0, no_id: 0, total: 0 };
        $('#btnProcessQueue').removeClass('pulsing');
        return;
    }

    // === PHASE INFO ===
    var phase = commentSafety.totalSessionComments < commentSafety.WARMUP_COMMENTS ? '🔰 WARMUP' : '🟢 NORMAL';
    outputMessage(phase + ' [' + commentsDoneToday + '/' + gblOptions.maxCommentsPerDay + '] @' + username + ': "' + comment.substring(0, 50) + '..."');
    commentSafety.logEvent('💬 Commenting @' + username);

    // === POST COMMENT ===
    try {
        await postComment(mediaId, comment);

        // Count
        commentsDoneToday++;
        lastCommentTime = Date.now();
        commentsLog.push(String(mediaId));
        actionsTaken++;
        commentSafety.recordComment(username, comment);
        commentSafety.logEvent('✅ @' + username + ' (' + commentsDoneToday + '/' + gblOptions.maxCommentsPerDay + ')');
        if (commentSafety.totalSessionComments >= commentSafety.WARMUP_COMMENTS) {
            commentSafety.setPhase('active', commentsDoneToday + '/' + gblOptions.maxCommentsPerDay + ' today');
        } else {
            commentSafety.setPhase('warmup', commentSafety.totalSessionComments + '/' + commentSafety.WARMUP_COMMENTS + ' warmup');
        }

        outputMessage('✅ @' + username + ' done! (' + commentsDoneToday + '/' + gblOptions.maxCommentsPerDay + ')');

        try { saveCommentsLogToStorage(); } catch(e) {}
        try { updateCommentStats(); } catch(e) {}
        try { addStamp(mediaId, 'stamp-div-green', 'commented'); } catch(e) {}
        try { if (window.LovableSync) window.LovableSync.onAction('comment', acct, true); } catch(e) {}

        // === SMART DELAY ===
        if (mediaForComments.length > 0) {
            var smart = commentSafety.getSmartDelay();
            var mins = (smart.delay / 60000).toFixed(1);
            commentSafety.logEvent('⏳ Wait ' + mins + 'min [' + smart.phase + ']');
            commentSafety.setPhase(
                smart.phase === 'warmup' ? 'warmup' : 'active',
                'Next in ' + mins + 'min'
            );
            outputMessage('⏳ Next in ' + mins + 'min [' + smart.phase + (smart.multiplier ? ' x' + smart.multiplier : '') + '] (' + mediaForComments.length + ' left)');
            timeoutsQueue.push(setTimeout(commentAllMedia, smart.delay));
        } else {
            outputMessage('🎉 All done! ' + commentsDoneToday + ' comments today.');
            commentSafety.setPhase('done', commentsDoneToday + ' comments');
            commentSafety.logEvent('🎉 Session complete: ' + commentsDoneToday + ' comments');
            outputMessage(commentSafety.getStats());
            _commentSkipStats = { duplicate: 0, too_old: 0, no_id: 0, total: 0 };
            $('#btnProcessQueue').removeClass('pulsing');
        }

    } catch(err) {
        try { if (window.LovableSync) window.LovableSync.onAction('comment', acct, false, err && err.status); } catch(e) {}

        mediaForComments.unshift(media);
        var errStatus = (err && err.status) || 0;
        var errDetail = (err && err.message) || String(err || 'Unknown');

        commentSafety.recordError(errStatus);
        commentSafety.logEvent('❌ Error ' + errStatus + ' on @' + username);
        commentSafety.setPhase('blocked', 'Cooldown after ' + errStatus);

        // Check if we should stop after this error
        var stopAfterErr = commentSafety.shouldStop();
        if (stopAfterErr.stop) {
            outputMessage(stopAfterErr.reason);
            outputMessage(commentSafety.getStats());
            _commentSkipStats = { duplicate: 0, too_old: 0, no_id: 0, total: 0 };
            $('#btnProcessQueue').removeClass('pulsing');
            return;
        }

        // Progressive cooldown based on error type and block count
        var cooldown = commentSafety.getCooldown(errStatus);
        var cooldownMin = Math.round(cooldown / 60000);

        if (errStatus === 400) {
            outputMessage('🚫 BLOCKED (400) on @' + username + '. Cooldown: ' + cooldownMin + 'min. (block #' + commentSafety.blockCount + ')');
        } else if (errStatus === 403) {
            outputMessage('🚫 Rate limit (403) on @' + username + '. Cooldown: ' + cooldownMin + 'min.');
        } else if (errStatus === 429) {
            outputMessage('🚫 Too many requests (429). Cooldown: ' + cooldownMin + 'min.');
        } else {
            outputMessage('❌ Error (' + errStatus + ') on @' + username + ': ' + errDetail + '. Cooldown: ' + cooldownMin + 'min.');
        }

        timeoutsQueue.push(setTimeout(commentAllMedia, cooldown));
    }

  } catch(fatalErr) {
    outputMessage('❌ FATAL: ' + (fatalErr.message || fatalErr) + '. Retrying 10s...');
    timeoutsQueue.push(setTimeout(commentAllMedia, 10000));
  }
}

async function initAutoComments() {
    // Auto-enable comments when user explicitly clicks Process with Auto Comment radio selected
    gblOptions.enableAutoComments = true;
    if (document.getElementById('cbEnableComments')) {
        document.getElementById('cbEnableComments').checked = true;
    }
    saveOptions();

    // Reset safety engine for new session
    commentSafety.reset();
    commentSafety.setPhase('warmup', 'Initializing...');
    commentSafety.logEvent('🚀 New session started');

    await loadCommentsLogFromStorage();

    // Clear comment history for this run — user clicked Process, they want to comment
    commentsLog = [];
    saveCommentsLogToStorage();
    _commentSkipStats = { duplicate: 0, too_old: 0, no_id: 0, total: 0 };

    mediaForComments = [];

    if (acctsQueue.length === 0) {
        outputMessage('⚠️ Queue is empty. Load accounts first, then process with Auto Comment.');
        $('#btnProcessQueue').removeClass('pulsing');
        return;
    }

    // Validate templates exist
    var testComment = getRandomComment(null, { username: 'test' });
    if (!testComment) {
        outputMessage('⚠️ No comment templates available. Add custom templates or reset to defaults.');
        $('#btnProcessQueue').removeClass('pulsing');
        return;
    }

    outputMessage('📝 Loading media from ' + acctsQueue.length + ' queued accounts for commenting...');

    var loadedCount = 0;
    var errorCount = 0;
    var totalAccts = Math.min(acctsQueue.length, 50); // limit to 50 accounts max

    for (var i = acctsQueue.length - 1; i >= 0 && mediaForComments.length < 50; i--) {
        var acct = acctsQueue[i];

        if (!acct || !acct.username) {
            continue;
        }

        try {
            outputMessage('Loading posts from @' + acct.username + '... (' + (acctsQueue.length - i) + '/' + totalAccts + ')');

            var mediaResult = await loadUserMediaForComments(acct);

            if (mediaResult && mediaResult.edges && mediaResult.edges.length > 0) {
                var addedCount = 0;
                for (var j = 0; j < mediaResult.edges.length && j < 3; j++) {
                    var node = mediaResult.edges[j].node || mediaResult.edges[j];
                    if (node) {
                        if (!node.pk && node.id) {
                            node.pk = String(node.id).split('_')[0];
                        }
                        node.user = acct;
                        node.owner = acct;
                        mediaForComments.push(node);
                        addedCount++;
                    }
                }
                loadedCount++;
                outputMessage('✅ Loaded ' + addedCount + ' posts from @' + acct.username +
                              ' (' + mediaForComments.length + ' total)');
            } else if (mediaResult && mediaResult.items && mediaResult.items.length > 0) {
                // Fallback: v1 API format uses 'items' instead of 'edges'
                var addedCount = 0;
                for (var j = 0; j < mediaResult.items.length && j < 3; j++) {
                    var item = mediaResult.items[j];
                    if (item) {
                        if (!item.pk && item.id) {
                            item.pk = String(item.id).split('_')[0];
                        }
                        item.user = acct;
                        item.owner = acct;
                        mediaForComments.push(item);
                        addedCount++;
                    }
                }
                loadedCount++;
                outputMessage('✅ Loaded ' + addedCount + ' posts from @' + acct.username +
                              ' (' + mediaForComments.length + ' total)');
            } else {
                outputMessage('⚠️ No posts found for @' + acct.username);
            }
        } catch(e) {
            errorCount++;
            var errMsg = e.message || e.status || 'unknown error';
            outputMessage('❌ Error loading @' + (acct.username || 'unknown') + ': ' + errMsg);
            // If we get rate limited, increase delay
            if (e.status === 429 || e.status === 403) {
                outputMessage('⏳ Rate limit detected. Waiting 30s before continuing...');
                await new Promise(function(r) { setTimeout(r, 30000); });
            }
        }

        // Delay between API calls to avoid rate limits
        if (i > 0 && mediaForComments.length < 50) {
            await new Promise(function(r) { setTimeout(r, 2500); });
        }
    }

    outputMessage('📊 Media loading complete: ' + loadedCount + ' accounts, ' +
                  mediaForComments.length + ' posts' +
                  (errorCount > 0 ? ', ' + errorCount + ' errors' : ''));

    if (mediaForComments.length > 0) {
        outputMessage('🚀 Starting comment process on ' + mediaForComments.length + ' posts...');
        outputMessage('🛡️ Safety: warmup ' + commentSafety.WARMUP_COMMENTS + ' comments (5-8min gaps), then progressive delays, rest every ' + commentSafety.REST_AFTER_COMMENTS + ' comments, max ' + commentSafety.MAX_PER_ACCOUNT + '/account');
        commentSafety.logEvent('📋 Queue: ' + mediaForComments.length + ' posts loaded');
        commentSafety.setPhase('warmup', '0/' + commentSafety.WARMUP_COMMENTS + ' warmup');
        commentAllMedia();
    } else {
        outputMessage('⚠️ No media found to comment on.');
        if (errorCount > 0) {
            outputMessage('💡 All media loads failed. Instagram may have rate limited you. Try again in a few minutes.');
        } else {
            outputMessage('💡 Make sure accounts have public posts and are loaded in the queue.');
        }
        $('#btnProcessQueue').removeClass('pulsing');
    }
}

// Robust media loader with multiple fallback approaches
async function loadUserMediaForComments(acct) {
    // Approach 1: GraphQL API (same as ajaxLoadUsersMedia)
    try {
        var result = await new Promise(function(resolve, reject) {
            var timeoutId = setTimeout(function() {
                reject(new Error('Timeout (15s)'));
            }, 15000);

            ajaxLoadUsersMedia('', false, function(r) {
                clearTimeout(timeoutId);
                resolve(r);
            }, acct).catch(function(err) {
                clearTimeout(timeoutId);
                reject(err);
            });
        });

        if (result && (result.edges || result.items)) {
            return result;
        }
    } catch(e) {
        outputMessage('GraphQL failed for @' + acct.username + ': ' + (e.message || 'error') + '. Trying fallback...');
    }

    // Approach 2: Direct profile page scrape
    try {
        var profileResp = await fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=' + acct.username, {
            headers: {
                'x-ig-app-id': '936619743392459',
                'x-csrftoken': getCsrfFromCookie(),
                'x-requested-with': 'XMLHttpRequest'
            },
            credentials: 'include'
        });

        if (!profileResp.ok) {
            throw { status: profileResp.status, message: 'HTTP ' + profileResp.status };
        }

        var profileData = await profileResp.json();
        var user = profileData.data && profileData.data.user;

        if (user && user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.edges) {
            return user.edge_owner_to_timeline_media;
        }
    } catch(e2) {
        outputMessage('Fallback also failed for @' + acct.username + ': ' + (e2.message || 'error'));
    }

    // Approach 3: Direct feed endpoint
    try {
        var userId = acct.id || acct.pk;
        if (userId) {
            var feedResp = await fetch('https://www.instagram.com/api/v1/feed/user/' + userId + '/?count=12', {
                headers: {
                    'x-ig-app-id': '936619743392459',
                    'x-csrftoken': getCsrfFromCookie(),
                    'x-requested-with': 'XMLHttpRequest'
                },
                credentials: 'include'
            });

            if (feedResp.ok) {
                var feedData = await feedResp.json();
                if (feedData.items && feedData.items.length > 0) {
                    return feedData;
                }
            }
        }
    } catch(e3) {
        // silently fall through
    }

    return null;
}

function saveCommentsLogToStorage() {
    chrome.storage.local.set({
        'organic_commentsLog': commentsLog,
        'organic_commentsDoneToday': commentsDoneToday,
        'organic_commentsDate': new Date().toDateString()
    });
}

function loadCommentsLogFromStorage() {
    return new Promise(function(resolve) {
        chrome.storage.local.get(
            ['organic_commentsLog', 'organic_commentsDoneToday', 'organic_commentsDate'],
            function(result) {
                var today = new Date().toDateString();
                if (result.organic_commentsDate === today) {
                    commentsLog = result.organic_commentsLog || [];
                    commentsDoneToday = result.organic_commentsDoneToday || 0;
                } else {
                    // New day — reset everything
                    commentsLog = [];
                    commentsDoneToday = 0;
                    saveCommentsLogToStorage();
                }

                // Migration: force-disable the 48h filter for users with old defaults
                if (gblOptions.commentRecentHours === 48 && gblOptions.commentOnlyRecent === true) {
                    gblOptions.commentOnlyRecent = false;
                    gblOptions.commentRecentHours = 720;
                    if (document.getElementById('cbCommentOnlyRecent')) {
                        document.getElementById('cbCommentOnlyRecent').checked = false;
                    }
                    if (document.getElementById('txtCommentRecentHours')) {
                        document.getElementById('txtCommentRecentHours').value = 720;
                    }
                    saveOptions();
                    outputMessage('📋 Comment filter updated: "Only recent posts" disabled (was 48h, now off).');
                }

                outputMessage('📋 Comment history: ' + commentsLog.length + ' posts commented today (' + commentsDoneToday + '/' + gblOptions.maxCommentsPerDay + ' limit).');
                updateCommentStats();
                resolve();
            }
        );
    });
}

function updateCommentStats() {
    if (document.getElementById('commentsTodayCount')) {
        document.getElementById('commentsTodayCount').textContent = commentsDoneToday;
    }
    if (document.getElementById('commentsTodayMax')) {
        document.getElementById('commentsTodayMax').textContent = gblOptions.maxCommentsPerDay;
    }
}

function ajaxUnfollowAll() {
    if (checkMaxActionsAndDelayIfNecessary(ajaxUnfollowAll) == false) {
        ajaxUnfollowAcct(acctsQueue.pop());
    }
}

function quickUnfollowAcct(acct) {
    $.ajax({
            url: 'https://www.instagram.com/web/friendships/' + acct.id + '/unfollow/',
            method: 'POST',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                xhr.setRequestHeader('x-asbd-id', '129477');
                xhr.setRequestHeader('x-ig-app-id', '936619743392459');
            },
            xhrFields: {
                withCredentials: true
            }
        })
        .done(function() {
            outputMessage('Unfollowed ' + acct.username + ' (' + acct.id + ') using button');
            $('.igBotInjectedLinkWhitelist[data-username="' + acct.username + '"]').parents('article').fadeOut();
        })
        .fail(function(data) {
            if (data.status == 403) {
                alert('soft rate limit encountered, failed to unfollow ' + acct.username);
            } else if (data.status == 400) {
                alert('hard rate limit encountered, failed to unfollow ' + acct.username);
            } else {
                alert('Error ' + data.status + ', failed to unfollow ' + acct.username);
            }
        })
}

function ajaxUnfollowAcct(acct) {
    if (gblOptions.autoSaveQueue == true) {
        saveQueueToStorage();
    }

    var promises = [];
    let unfollowable = true;

    var waitTime = getRandomizedTime(gblOptions.timeDelayAfterSkip);

    if (typeof acct == 'undefined') {
        noAcctsLeft();
        return false;
    }

    if (containsObject(acct, acctsWhiteList) == true) {
        outputMessage(acct.username + ' is whitelisted, skipping');
        addStamp(acct.id, 'stamp-div-grey', 'whitelisted');
        acctsProcessed.push(acct);
        setTimeout(ajaxUnfollowAll, 1);
        return false;
    }


    if (gblOptions.dontUnFollowNonOrganic === true) {
        var acctFromStorage = alreadyAttempted(acct);
        if (acctFromStorage === false) {
            outputMessage(acct.username + ' was followed outside of Organic, skipping');
            addStamp(acct.id, 'stamp-div-grey', 'non-organic');
            acctsProcessed.push(acct);
            setTimeout(ajaxUnfollowAll, 1);
            return false;
        }
    }

    if (gblOptions.dontUnFollowFilters == true || gblOptions.dontUnFollowFollowers == true || gblOptions.unFollowIfOld == true) {
        promises.push(filterCriteriaMetForUnfollowing(acct).then((met) => {
            if (met == false) {
                unfollowable = false;
            }
        }));
    }

    Promise.all(promises).then(function() {
        if (unfollowable === false) {
            acctsProcessed.push(acct);
            outputMessage(acct.username + ' skipped (matches your filters)');

            if (acct.assumedDeleted) {
                addStamp(acct.id, 'stamp-div-red', '404');

            } else {
                addStamp(acct.id, 'stamp-div-grey', 'matches filters');
            }


            if (noAcctsLeft()) {
                return false;
            } else {
                outputMessage('waiting  ' + (waitTime / 1000) + ' seconds to unfollow ' + acctsQueue[acctsQueue.length - 1].username);
                timeoutsQueue.push(setTimeout(ajaxUnfollowAll, waitTime));
                return false;
            }
        }

        waitTime = getNextActionDelayMs();

        $.ajax({
                //url: 'https://www.instagram.com/web/friendships/' + acct.id + '/unfollow/',
                url: 'https://www.instagram.com/api/v1/friendships/destroy/' + acct.id + '/',
                method: 'POST',
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                    xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                    xhr.setRequestHeader('x-asbd-id', '129477');
                    xhr.setRequestHeader('x-ig-app-id', '936619743392459');
                },
                xhrFields: {
                    withCredentials: true
                }
            })
            .done(function() {

                acctsProcessed.push(acct);
                actionsTaken++;
                addStamp(acct.id, 'stamp-div-green', 'unfollowed');

                // [Lovable] Hook direto: unfollow com sucesso
                if (window.LovableSync) try { window.LovableSync.onAction('unfollow', acct, true); } catch(e) {}

                outputMessage('Unfollowed ' + acct.username + ' (' + acct.id + ') | ' + acctsProcessed.length + ' processed, ' + acctsQueue.length + ' left to go');


                if (noAcctsLeft()) {
                    return false;
                } else {
                    outputMessage('waiting  ' + (waitTime / 1000) + ' seconds to unfollow ' + acctsQueue[acctsQueue.length - 1].username);
                    timeoutsQueue.push(setTimeout(ajaxUnfollowAll, waitTime));
                }

            })
            .fail(function(data) {
                // [Lovable] Hook direto: unfollow com erro
                if (window.LovableSync) try { window.LovableSync.onAction('unfollow', acct, false, data.status); } catch(e) {}

                if (data.status !== 404) {
                    acctsQueue.push(acct);
                }

                if (data.status == 404) {
                    printMessage(acct.username + ' ' + chrome.i18n.getMessage('AccountNotFound404'));
                    addStamp(acct.id, 'stamp-div-red', '404');
                    timeoutsQueue.push(setTimeout(ajaxUnfollowAll, 1000));
                } else if (data.status == 403) {
                    printMessage(chrome.i18n.getMessage('RateLimitSoft', [(gblOptions.timeDelayAfterSoftRateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(ajaxUnfollowAll, gblOptions.timeDelayAfterSoftRateLimit));
                } else if (data.status == 400) {
                    printMessage(chrome.i18n.getMessage('RateLimitHard', [(gblOptions.timeDelayAfterHardRateLimit / 3600000)]));
                    timeoutsQueue.push(setTimeout(ajaxUnfollowAll, gblOptions.timeDelayAfterHardRateLimit));
                } else if (data.status == 429) {
                    printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(ajaxUnfollowAll, gblOptions.timeDelayAfter429RateLimit));
                } else {
                    outputMessage(data.status + ' error, trying again in 5 seconds');
                    timeoutsQueue.push(setTimeout(ajaxUnfollowAll, 5000));
                }
            })
    });

}

function ajaxRemoveOrBlockAcct(acct) {
    if (gblOptions.autoSaveQueue == true) {
        saveQueueToStorage();
    }

    var promises = [];
    let removable = true;

    var waitTime = getRandomizedTime(gblOptions.timeDelayAfterSkip);

    if (typeof acct == 'undefined') {
        noAcctsLeft();
        return false;
    }

    if (containsObject(acct, acctsWhiteList) == true) {
        outputMessage(acct.username + ' is whitelisted, skipping');
        addStamp(acct.id, 'stamp-div-grey', 'whitelisted');
        acctsProcessed.push(acct);
        setTimeout(ajaxRemoveOrBlockAll, 1);
        return false;
    }

    if (gblOptions.dontRemoveOrBlockFilters == true) {
        promises.push(filterCriteriaMetForRemoveOrBlock(acct).then((met) => {
            if (met == false) {
                removable = false;
            }
        }));
    }

    Promise.all(promises).then(function() {

        var removeOrBlockEndpoint = '/remove_follower/';
        var removeOrBlockString = 'Remove';
        var removedOrBlockedString = 'Removed';


        if (document.getElementById('radioBlock').checked === true) {
            removeOrBlockEndpoint = '/block/';
            removeOrBlockString = 'Block'
            removedOrBlockedString = 'Blocked';
        }

        if (removable === false) {
            acctsProcessed.push(acct);

            outputMessage(acct.username + ' skipped (matches your filters)');
            addStamp(acct.id, 'stamp-div-grey', 'matches filters');


            if (noAcctsLeft()) {
                return false;
            } else {
                outputMessage('waiting  ' + (waitTime / 1000) + ' seconds to ' + removeOrBlockString + ' ' + acctsQueue[acctsQueue.length - 1].username);
                timeoutsQueue.push(setTimeout(ajaxRemoveOrBlockAll, waitTime));
                return false;
            }
        }

        waitTime = getNextActionDelayMs();

        $.ajax({
                url: 'https://www.instagram.com/web/friendships/' + acct.id + removeOrBlockEndpoint,
                method: 'POST',
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                    xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                    xhr.setRequestHeader('x-asbd-id', '129477');
                    xhr.setRequestHeader('x-ig-app-id', '936619743392459');
                },
                xhrFields: {
                    withCredentials: true
                }
            })
            .done(function() {
                acctsProcessed.push(acct);
                actionsTaken++;
                addStamp(acct.id, 'stamp-div-green', removedOrBlockedString);

                // [Lovable] Hook direto: remove/block com sucesso
                if (window.LovableSync) try { window.LovableSync.onAction(removedOrBlockedString.toLowerCase(), acct, true); } catch(e) {}

                outputMessage(removedOrBlockedString + ' ' + acct.username + ' (' + acct.id + ') | ' + acctsProcessed.length + ' processed, ' + acctsQueue.length + ' left to go');

                if (noAcctsLeft()) {
                    return false;
                } else {
                    outputMessage('waiting  ' + (waitTime / 1000) + ' seconds to ' + removeOrBlockString + ' ' + acctsQueue[acctsQueue.length - 1].username);
                    timeoutsQueue.push(setTimeout(ajaxRemoveOrBlockAll, waitTime));
                }

            })
            .fail(function(data) {
                acctsQueue.push(acct);

                // [Lovable] Hook direto: remove/block falhou
                if (window.LovableSync) try { window.LovableSync.onAction(removedOrBlockedString.toLowerCase(), acct, false, data.status); } catch(e) {}

                if (data.status == 403) {
                    printMessage(chrome.i18n.getMessage('RateLimitSoft', [(gblOptions.timeDelayAfterSoftRateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(ajaxRemoveOrBlockAll, gblOptions.timeDelayAfterSoftRateLimit));
                } else if (data.status == 400) {
                    printMessage(chrome.i18n.getMessage('RateLimitHard', [(gblOptions.timeDelayAfterHardRateLimit / 3600000)]));
                    timeoutsQueue.push(setTimeout(ajaxRemoveOrBlockAll, gblOptions.timeDelayAfterHardRateLimit));
                } else if (data.status == 429) {
                    printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(ajaxRemoveOrBlockAll, gblOptions.timeDelayAfter429RateLimit));
                } else {
                    outputMessage(data.status + ' error, trying again in 5 seconds');
                    timeoutsQueue.push(setTimeout(ajaxRemoveOrBlockAll, 5000));
                }
            })
    });

}

function noAcctsLeft() {
    if (acctsQueue.length === 0) {
        outputMessage('No accounts left!');
        $('#btnProcessQueue').removeClass('pulsing');
        return true;
    }
    return false;
}

function injectIcon() {
    var imgURL = chrome.runtime.getURL("icon_48.png");

    $('#instabotIcon').remove();

    $('body').prepend('<div id="instabotIcon" title="Hide or Show Organic"></div>');

    $('#instabotIcon').css({
        'top': '0px',
        'right': '0px',
        'background-image': 'url("' + imgURL + '")'
    }).click(toggleControlsDiv);
}

function injectVersionNumber() {
    document.getElementById('igBotExtensionVersion').textContent = chrome.runtime.getManifest().version;
    document.getElementById('h1OrganicHeading').textContent = 'Organic ' + chrome.runtime.getManifest().version + ' for Instagram™';
}

function hideControlsDiv(save) {

    $('#igBotInjectedContainer').hide();
    shakeInstabotIcon();

    if (save && save == false) return true;

    saveHiddenStatus(true);
}

function shakeInstabotIcon() {
    $('#instabotIcon').shake(50, 2, 8);
}

function toggleControlsDiv() {
    $('#igBotInjectedContainer').toggle({
        effect: "scale",
        direction: "both",
        origin: ["top", "center"],
        complete: function() {
            setTimeout(function() {
                var isVisible = $('#igBotInjectedContainer').is(":visible");
                saveHiddenStatus(!isVisible);
            }, 100);
        }
    });
}

function openControlsDiv() {
    var isVisible = $('#igBotInjectedContainer').is(":visible");
    if (isVisible == false) {
        toggleControlsDiv();
    }
}

function injectControlsDiv() {

    if (shouldLoadOrganicOnThisPage() == false) return false;

    $('#igBotInjectedContainer').remove();

    $.get(chrome.runtime.getURL('organic.html'), function(data) {
        $('body').prepend($.parseHTML(data));
        localizeExtension();

        chrome.storage.local.get("organicLog", function(data) {
            if (typeof data.organicLog != 'undefined') {
                var logFromStorage = data.organicLog;
                var fakeConsole = document.getElementById('txtConsole');
                fakeConsole.textContent = logFromStorage + '\n\n';
                fakeConsole.scrollTop = fakeConsole.scrollHeight;
                includeLogInMailToLinks();
            }
        });


        loadOptions();
        loadWhiteList();
        loadPreviousAttempts();
        injectVersionNumber();
        loadActionsQueue();


        ready(igExternalVars.qsForConvenienceButtons, function(element) {
            addNewConvenienceLinks(element);
        });
        getHiddenStatus(hiddenStatusCallback);


        setTimeout(function() {
            if (gblOptions.loadQueueOnStartup == true) {
                loadQueueFromLocal();
            }
        }, 1000);

    });
}

function localizeExtension() {
    $('#igBotInjectedContainer [localeMessage]').each(function() {
        var localeMessage = chrome.i18n.getMessage($(this).attr('localeMessage'));
        if (localeMessage.length > 0) {
            $(this).text(localeMessage);
        }
    });

    $('#igBotInjectedContainer [localeReplaceString]').each(function() {
        $(this).text($(this).text().replace($(this).attr('localeReplaceString'), chrome.i18n.getMessage($(this).attr('localeReplaceString').replace(/ /g, '_'))));
    });
}

function buildMessagesJson() {
    var jsonbuilder = '';

    $('#igBotInjectedContainer [localeMessage]').each(function() {
        var titlestr = '';
        if ($(this).attr('title')) {
            titlestr = ', "title": "' + $(this).attr('title') + '"';
        }
        var str2add = '"' + $(this).attr('localeMessage') + '": { "message": "' + $(this).html() + '"' + titlestr + '},'
        if (jsonbuilder.indexOf(str2add) == -1) jsonbuilder = jsonbuilder + str2add;

        if ($(this).html() == '') {
            alert($(this).attr('localeMessage'));
        }
    });
}

(function(win) {
    'use strict';

    var listeners = [],
        doc = win.document,
        MutationObserver = win.MutationObserver || win.WebKitMutationObserver,
        observer;

    function ready(selector, fn) {
        // Store the selector and callback to be monitored
        listeners.push({
            selector: selector,
            fn: fn
        });
        if (!observer) {
            // Watch for changes in the document
            observer = new MutationObserver(check);
            observer.observe(doc.documentElement, {
                childList: true,
                subtree: true
            });
        }
        // Check if the element is currently in the DOM
        check();
    }

    function check() {
        // Check the DOM for elements matching a stored selector
        for (var i = 0, len = listeners.length, listener, elements; i < len; i++) {
            listener = listeners[i];
            // Query for elements matching the specified selector
            elements = doc.querySelectorAll(listener.selector);
            for (var j = 0, jLen = elements.length, element; j < jLen; j++) {
                element = elements[j];
                // Make sure the callback isn't invoked with the
                // same element more than once
                if (!element.ready) {
                    element.ready = true;
                    // Invoke the callback with the element
                    listener.fn.call(element, element);
                }
            }
        }
    }

    // Expose `ready`
    win.ready = ready;

})(this);



function ajaxLikeAll() {
    if (noAcctsLeft() == false) {
        getUsersMedia(acctsQueue.shift());
    } else {
        outputMessage('Done loading media, beginning likes...');
        likeAllMedia();
    }
}

function getUsersMedia(acct) {

    var acctsQueueNextUsername = '';
    removeAcctFromQueueDisplay(acct.id, true);
    if (noAcctsLeft() === false) {
        acctsQueueNextUsername = acctsQueue[0].username;
    }

    ajaxLoadUsersMedia('', false, usersMediaLoaded, acct);

    var waitTime = getNextActionDelayMs();

    outputMessage('Adding media for ' + acct.username + ' (' + acct.id + ') to like queue;  waiting  ' + (waitTime / 1000) + ' seconds to process ' + acctsQueueNextUsername);

    timeoutsQueue.push(setTimeout(ajaxLikeAll, waitTime));
}

function initProcessQueue() {
    var todaysdate = new Date();
    maxActionsDelayStartTime = todaysdate.getTime();

    $('#btnProcessQueue').addClass('pulsing');

    if (document.getElementById('radioFollow').checked === true || document.getElementById('radioFollowAndLike').checked === true) {
        ajaxFollowAll();
    } else if (document.getElementById('radioUnFollow').checked === true) {
        initUnfollowMyFollowers();
    } else if (document.getElementById('radioLikeOnly').checked === true) {
        ajaxLikeAll();
    } else if (document.getElementById('radioBlock').checked === true || document.getElementById('radioRemoveFromFollowers').checked === true) {
        ajaxRemoveOrBlockAll();
    } else if (document.getElementById('radioGetMoreData').checked === true) {

        var safeDelaySeconds = 1;

        if (acctsQueue.length > 100) safeDelaySeconds = 2;
        if (acctsQueue.length > 500) safeDelaySeconds = 3;
        if (acctsQueue.length > 1000) safeDelaySeconds = 4;
        if (acctsQueue.length > 2000) safeDelaySeconds = 5;
        if (acctsQueue.length > 3000) safeDelaySeconds = 6;
        if (acctsQueue.length > 4000) safeDelaySeconds = 10;



        if (acctsQueue.length > 40 && (gblOptions.useTimeDelayAfterAdditionalInfo == false || document.getElementById('texttimeDelayAfterAdditionalInfo').value < safeDelaySeconds)) {

            dialog({
                no: "No",
                yes: "Yes",
                question: "WARNING: <br><br>Low or no delay set after loading data for each account. <br><br> Set " + safeDelaySeconds + " second delay?"
            }, function() {
                document.getElementById('cbuseTimeDelayAfterAdditionalInfo').checked = true;
                document.getElementById('texttimeDelayAfterAdditionalInfo').value = safeDelaySeconds;
                saveOptions();

                populateAllQueueUsersInfo(acctsQueue);

            }, function() {
                populateAllQueueUsersInfo(acctsQueue);
            })
        } else {
            populateAllQueueUsersInfo(acctsQueue);
        }



    } else if (document.getElementById('radioViewStory').checked === true) {
        viewStories();
    } else if (document.getElementById('radioAutoComment') && document.getElementById('radioAutoComment').checked === true) {
        initAutoComments();
    }
}

function bindEvents() {


    $('#btnAddScheduledAction').off('click.btnAddScheduledAction').on('click.btnAddScheduledAction', btnAddScheduledAction);

    $('#igBotInjectedContainer #btnProcessQueue').click(initProcessQueue);

    $('#igBotInjectedContainer input[type="checkbox"], #igBotInjectedContainer select').off('change.checkboxSaveOptions').on('change.checkboxSaveOptions', saveOptions);
    $('#igBotInjectedContainer input[type="text"],#igBotInjectedContainer input[type="number"]').bind('keyup input', _debouncedSaveOptions);
    $('details').off('toggle.detailsToggle').on('toggle.detailsToggle', saveOptions);

    $('#igBotInjectedContainer #btnStop,#igBotInjectedContainer #btnStop2').click(function() {
        for (var i = 0; i < timeoutsQueue.length; i++) {
            clearTimeout(timeoutsQueue[i]);
        }

        timeoutsQueue = [];

        $('#igBotInjectedContainer *').removeClass('pulsing');
        outputMessage('Stopped all pending actions');
    });

    $('#btnLoadAccountsFromMedia').off('click.LoadAccountsFromMedia').on('click.LoadAccountsFromMedia', LoadAccountsFromMedia);

    $('#igBotInjectedContainer #btnLikeFeed').click(ajaxLikeAllPostsFromFeed);

    $('#btnLikeMediaQueue').off('click.likeAllMedia').on('click.likeAllMedia', likeAllMedia);

    $('#btnLoadLocationPosts').off('click.ajaxLoadPostsFromLocation').on('click.ajaxLoadPostsFromLocation', ajaxLoadPostsFromLocation);

    $('#btnLoadPendingRequests').click(ajaxGetPendingFollowRequests);
    $('#btnLoadSavedQueue').click(loadSavedQueue);
    $('#btnViewWhiteList').click(viewWhiteList);
    $('#btnSaveQueueToStorage').click(saveQueueToStorageAndDisk);
    $('#btnExportQueue').click(exportQueue);


    if (getCurrentPageUsername() != '') {
        setCurrentPageUsername();
    } else {
        $('#igBotInjectedContainer #btnGetAllUsersFollowers').off('click.setCurrentPageUsername').on('click.setCurrentPageUsername', setCurrentPageUsername);
        $('#igBotInjectedContainer #btnGetAllUsersFollowing').off('click.setCurrentPageUsername').on('click.setCurrentPageUsername', setCurrentPageUsername);
    }

    setCurrentPageHashtag();


    $('#btnApplyFilter').off('click.ApplyFilter').on('click.ApplyFilter', function() {
        $('li.tab1').click();
        applyFiltersManually();
    });

    $('#btnFindSubscription').off('click.relinkSubscription').on('click.relinkSubscription', relinkSubscription);

    $('#igBotMediaQueueContainer').off('click.setCurrentList').on('click.setCurrentList', function() {
        currentList = 'mediaToLike';
    });
    $('#igBotQueueContainer').off('click.setCurrentList').on('click.setCurrentList', function() {
        if (currentList != 'acctsWhiteList') {
            currentList = 'acctsQueue';
        }
    });

    // Evitar que o dropdown do seletor de página/quantidade feche ao clicar — impede propagação para o document (ex.: Instagram)
    $('#igBotInjectedContainer').on('mousedown.pagerSelect click.pagerSelect', '.pager select.pagesize, .pager select.gotoPage, #paginationLimit, #mediapaginationLimit', function(e) {
        e.stopPropagation();
    });

    $(document).on('click.convenienceUnFollow', 'a.igBotInjectedLinkUnfollow', function() {
        $(this).off('click.convenienceUnFollow').css({
            "color": "white"
        }).append('<div class="igBotLoader"></div>');
        convenienceLinkUnfollowAcct($(this).attr('data-username'));
    });

    $(document).on('click.convenienceWhitelist', 'a.igBotInjectedLinkWhitelist', function() {
        $(this).off('click.convenienceWhitelist').css({
            "color": "white"
        }).append('<div class="igBotLoader"></div>');
        convenienceLinkWhitelistAcct($(this).attr('data-username'));
    });

    $('li.tab5').off('click.scrollLog').on('click.scrollLog', scrollLog);

    $('#btnTrimLog').click(trimLog);

    $('#btnWatchReels').off('click.watchReels').on('click.watchReels', watchReels);

    // Comment System UI Bindings
    $('#radioAutoComment').on('change', function() {
        if (this.checked) { $('#commentSettingsPanel').show(); } else { $('#commentSettingsPanel').hide(); }
    });

    // Show/hide comment settings when any radio changes
    $('input[name="queueAction"]').on('change', function() {
        if (document.getElementById('radioAutoComment') && document.getElementById('radioAutoComment').checked) {
            $('#commentSettingsPanel').show();
        } else {
            $('#commentSettingsPanel').hide();
        }
    });

    $('#btnSaveCommentTemplates').off('click.saveComments').on('click.saveComments', function() {
        var rawText = document.getElementById('txtCustomCommentTemplates').value;
        var lines = rawText.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        gblOptions.customCommentTemplates = lines;
        saveOptions();
        outputMessage('Saved ' + lines.length + ' custom comment templates.');
    });

    $('#btnPreviewComment').off('click.previewComment').on('click.previewComment', function() {
        var preview = getRandomComment(null, { username: 'example_user' });
        if (preview) {
            $('#commentPreviewText').text(preview);
            $('#commentPreviewBox').show();
        }
    });

    $('#btnResetCommentTemplates').off('click.resetComments').on('click.resetComments', function() {
        gblOptions.customCommentTemplates = [];
        gblOptions.commentTemplates = null;
        document.getElementById('txtCustomCommentTemplates').value = '';
        saveOptions();
        outputMessage('Comment templates reset to defaults.');
    });

    $('#btnClearCommentHistory').off('click.clearHistory').on('click.clearHistory', function() {
        commentsLog = [];
        commentsDoneToday = 0;
        saveCommentsLogToStorage();
        updateCommentStats();
        outputMessage('🗑️ Comment history cleared. All posts can be commented again.');
    });

    // Story reply templates save
    $('#btnSaveStoryReplyTemplates').off('click.saveStoryReply').on('click.saveStoryReply', function() {
        var rawText = document.getElementById('txtStoryReplyTemplates').value;
        var lines = rawText.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        gblOptions.storyReplyTemplates = lines;
        saveOptions();
        outputMessage('Saved ' + lines.length + ' story reply templates.');
    });

    $('#btnLoadThisPost').off('click.LoadThisPost').on('click.LoadThisPost', loadCurrentPostAsMedia);


    $('nav ul li').off('click.rememberTab').on('click.rememberTab', function() {
        gblOptions.lastTab = $(this).attr('class');
        saveOptions();
    });

}

function applyTooltips() {
    // Only apply tooltips to elements that haven't been tipped yet
    $('#igBotInjectedContainer *[title]:not(.ui-tooltip-content):not(.organic-tipped), #instabotIcon:not(.organic-tipped)').each(function() {
        $(this).tooltip({
            show: null,
            track: true,
            hide: null
        }).addClass('organic-tipped');
    });
}

async function applyFiltersManually() {

    if (isAdditionalDataFullyLoaded(acctsQueue) === false && acctsQueue.length > 50 && gblOptions.useTimeDelayAfterAdditionalInfo == false) {
        if (!window.confirm('Applying filters requires loading additional data about each account.\n\nLoading this data can trigger rate limits from instagram.\n\nYou should strongly consider setting a delay in the Settings.\n\nProceed with filtering anyway?')) {
            return false;
        }
    }

    for (let i = acctsQueue.length - 1; i > -1; i--) {
        if (await filterCriteriaMet(acctsQueue[i]) === false) {
            outputMessage(acctsQueue[i].username + ' removed from queue (did not match your filters)');
            addStamp(acctsQueue[i].id, 'stamp-div-grey', 'removed');
            acctsQueue.splice(i, 1);
        }
    }

    outputMessage('Filters applied.');
    // Atualizar a tabela para refletir a fila filtrada — assim o log e a lista na tela seguem a mesma ordem
    arrayOfUsersToDiv(acctsQueue, true);
    if (window.confirm('Filters applied.  Save queue now?')) saveQueueToStorageAndDisk();

}

function getExtendedDataInfoForAccount(a) {

    return new Promise(function(resolve, reject) {

        $.ajax({
                url: 'https://i.instagram.com/api/v1/users/' + a.id + '/info/',
                method: 'GET',
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                    xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                    xhr.setRequestHeader('x-asbd-id', '129477');
                    xhr.setRequestHeader('x-ig-app-id', '936619743392459');
                },
                xhrFields: {
                    withCredentials: true
                }
            })
            .done(function(r) {


                outputMessage('Loaded user info for ' + a.username + ' to get email address');

                for (var key in r.user) {
                    if (a.hasOwnProperty(key) === false) {
                        a[key] = r.user[key];
                    }
                }

                resolve(a);


            }).fail(function(data) {
                if (data.status == 403) {
                    printMessage(chrome.i18n.getMessage('RateLimitSoft', [(gblOptions.timeDelayAfterSoftRateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getExtendedDataInfoForAccount(a));
                    }, gblOptions.timeDelayAfterSoftRateLimit));
                } else if (data.status == 400) {
                    printMessage(chrome.i18n.getMessage('RateLimitHard', [(gblOptions.timeDelayAfterHardRateLimit / 3600000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getExtendedDataInfoForAccount(a));
                    }, gblOptions.timeDelayAfterHardRateLimit));
                } else if (data.status == 429) {
                    printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getExtendedDataInfoForAccount(a));
                    }, gblOptions.timeDelayAfter429RateLimit));
                } else if (data.status == 404) {
                    gbl404attempt++;
                    if (gbl404attempt < (gblOptions.retriesAfterAdditionalInfo404 + 1)) {
                        outputMessage('404 possible rate limit, retry in ' + (gblOptions.timeDelayAfterAdditionalInfo / 1000) + ' seconds (attempt ' + gbl404attempt + ' of ' + gblOptions.retriesAfterAdditionalInfo404 + ')');
                        timeoutsQueue.push(setTimeout(function() {
                            resolve(getExtendedDataInfoForAccount(a));
                        }, gblOptions.timeDelayAfterAdditionalInfo));
                        return false;
                    } else {
                        outputMessage('404 account ' + a.username + ' assumed  missing after ' + gblOptions.retriesAfterAdditionalInfo404 + ' attempts');
                        a.assumedDeleted = true;
                        gbl404attempt = 0
                        resolve(a);
                    }
                } else {
                    outputMessage('' + data.status + ' error, trying again in 5 seconds');
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getExtendedDataInfoForAccount(a));
                    }, 5000));
                }
                gbl404attempt = 0;
            });
    });
}



// should do this if Last Posted Filter is enabled or Like mode is enabled
function getTimelineForAcct(a) {

    return new Promise(function(resolve, reject) {

        $.ajax({
                url: 'https://www.instagram.com/api/v1/feed/user/' + a.username + '/username/?count=12',
                method: 'GET',
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                    xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                    xhr.setRequestHeader('x-asbd-id', '129477');
                    xhr.setRequestHeader('x-ig-app-id', '936619743392459');
                },
                xhrFields: {
                    withCredentials: true
                }
            })
            .done(function(r) {


                outputMessage('Loaded post data for ' + a.username + ' to determine last post date');

                a.edge_owner_to_timeline_media.edges = r.items;

                resolve(a);

            }).fail(function(data) {
                if (data.status == 403) {
                    printMessage(chrome.i18n.getMessage('RateLimitSoft', [(gblOptions.timeDelayAfterSoftRateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getTimelineForAcct(a));
                    }, gblOptions.timeDelayAfterSoftRateLimit));
                } else if (data.status == 400) {
                    printMessage(chrome.i18n.getMessage('RateLimitHard', [(gblOptions.timeDelayAfterHardRateLimit / 3600000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getTimelineForAcct(a));
                    }, gblOptions.timeDelayAfterHardRateLimit));
                } else if (data.status == 429) {
                    printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getTimelineForAcct(a));
                    }, gblOptions.timeDelayAfter429RateLimit));
                } else if (data.status == 404) {
                    gbl404attempt++;
                    if (gbl404attempt < (gblOptions.retriesAfterAdditionalInfo404 + 1)) {
                        outputMessage('404 possible rate limit, retry in ' + (gblOptions.timeDelayAfterAdditionalInfo / 1000) + ' seconds (attempt ' + gbl404attempt + ' of ' + gblOptions.retriesAfterAdditionalInfo404 + ')');
                        timeoutsQueue.push(setTimeout(function() {
                            resolve(getTimelineForAcct(a));
                        }, gblOptions.timeDelayAfterAdditionalInfo));
                        return false;
                    } else {
                        outputMessage('404 account ' + a.username + ' assumed  missing after ' + gblOptions.retriesAfterAdditionalInfo404 + ' attempts');
                        a.assumedDeleted = true;
                        gbl404attempt = 0
                        resolve(a);
                    }
                } else {
                    outputMessage('' + data.status + ' error, trying again in 5 seconds');
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getTimelineForAcct(a));
                    }, 5000));
                }
                gbl404attempt = 0;
            });
    });
}


function getAdditionalDataForAcct(a, urlprefix) {
    if (!urlprefix) urlprefix = urlAcctInfo;
    return new Promise(function(resolve, reject) {

        if (a.edge_followed_by || a["edge_followed_by.count"]) {
            a = appendFollowersRatioToAcct(a);
            a = appendLastPostDateToAcct(a);
            resolve(a);
            return a;
        }

        $.ajax({
                url: '' + urlprefix + a.username,
                method: 'GET',
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                    xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                    xhr.setRequestHeader('x-asbd-id', '129477');
                    xhr.setRequestHeader('x-ig-app-id', '936619743392459');
                },
                xhrFields: {
                    withCredentials: true
                }
            })
            .done(async function(r) {
                var u = extractJSONfromUserPageHTML(r);

                if (u == false) {
                    gbl404attempt++;
                    if (gbl404attempt < (gblOptions.retriesAfterAdditionalInfo404 + 1)) {
                        outputMessage('Could not load more info, retry in ' + (gblOptions.timeDelayAfterAdditionalInfo / 1000) + ' (attempt ' + gbl404attempt + ' of ' + gblOptions.retriesAfterAdditionalInfo404 + ')');
                        timeoutsQueue.push(setTimeout(function() {
                            resolve(getAdditionalDataForAcct(a));
                        }, gblOptions.timeDelayAfterAdditionalInfo));
                        return false;
                    } else {
                        outputMessage('Could not load more info, account assumed missing after ' + gblOptions.retriesAfterAdditionalInfo404 + ' attempts');
                        a.assumedDeleted = true;
                        gbl404attempt = 0;
                        resolve(a);
                        return false;
                    }

                }

                a = u;

                a = appendFollowersRatioToAcct(a);
                a = await appendLastPostDateToAcct(a);

                if (gblOptions.getExtendedData == true) {
                    a = await getExtendedDataInfoForAccount(a);
                }

                outputMessage('Loaded additional data for ' + a.username);

                if (gblOptions.useTimeDelayAfterAdditionalInfo == true) {
                    setTimeout(function() {
                        resolve(a);
                    }, gblOptions.timeDelayAfterAdditionalInfo);
                    printMessage(chrome.i18n.getMessage('TimeDelay', [(gblOptions.timeDelayAfterAdditionalInfo / 1000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(a);
                    }, gblOptions.timeDelayAfterAdditionalInfo));
                } else {
                    resolve(a);
                }

                gbl404attempt = 0;

            }).fail(function(data) {
                if (data.status == 403) {
                    printMessage(chrome.i18n.getMessage('RateLimitSoft', [(gblOptions.timeDelayAfterSoftRateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getAdditionalDataForAcct(a));
                    }, gblOptions.timeDelayAfterSoftRateLimit));
                } else if (data.status == 400) {
                    printMessage(chrome.i18n.getMessage('RateLimitHard', [(gblOptions.timeDelayAfterHardRateLimit / 3600000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getAdditionalDataForAcct(a));
                    }, gblOptions.timeDelayAfterHardRateLimit));
                } else if (data.status == 429) {
                    printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getAdditionalDataForAcct(a));
                    }, gblOptions.timeDelayAfter429RateLimit));
                } else if (data.status == 404) {
                    gbl404attempt++;
                    if (gbl404attempt < (gblOptions.retriesAfterAdditionalInfo404 + 1)) {
                        outputMessage('404 possible rate limit, retry in ' + (gblOptions.timeDelayAfterAdditionalInfo / 1000) + ' seconds (attempt ' + gbl404attempt + ' of ' + gblOptions.retriesAfterAdditionalInfo404 + ')');
                        timeoutsQueue.push(setTimeout(function() {
                            resolve(getAdditionalDataForAcct(a));
                        }, gblOptions.timeDelayAfterAdditionalInfo));
                        return false;
                    } else {
                        outputMessage('404 account ' + a.username + ' assumed  missing after ' + gblOptions.retriesAfterAdditionalInfo404 + ' attempts');
                        a.assumedDeleted = true;
                        gbl404attempt = 0
                        resolve(a);
                    }
                } else {
                    outputMessage('' + data.status + ' error, trying again in 5 seconds');
                    timeoutsQueue.push(setTimeout(function() {
                        resolve(getAdditionalDataForAcct(a));
                    }, 5000));
                }
                gbl404attempt = 0;
            });
    });
}


async function filterCriteriaMet(acct) {

    var filtered = false;

    if (acct.profile_pic_url && acct.profile_pic_url.indexOf(igExternalVars.emptyProfilePicUrl) > -1 && gblOptions.filterOptions.no_profile_pic == false) {
        outputMessage(acct.username + ' filtered - has no profile picture')
        filtered = true;
    }

    if (acct.profile_pic_url && acct.profile_pic_url.indexOf(igExternalVars.emptyProfilePicUrl) == -1 && gblOptions.filterOptions.profile_pic == false) {
        outputMessage(acct.username + ' filtered - has profile picture')
        filtered = true;
    }

    if (acct.followed_by_viewer == true && gblOptions.filterOptions.followed_by_me == false) {
        outputMessage(acct.username + ' filtered - account is followed by you')
        filtered = true;
    }

    if (acct.followed_by_viewer == false && gblOptions.filterOptions.non_followed_by_me == false) {
        outputMessage(acct.username + ' filtered - account is not followed by you')
        filtered = true;
    }

    if (acct.is_verified == true && gblOptions.filterOptions.verified == false) {
        outputMessage(acct.username + ' filtered - account is verified')
        filtered = true;
    }
    if (acct.is_verified == false && gblOptions.filterOptions.non_verified == false) {
        outputMessage(acct.username + ' filtered - account is not verified')
        filtered = true;
    }

    if (filtered === true) {
        return false;
    }

    if (!acct.edge_followed_by) acct = await getAdditionalDataForAcct(acct);

    if (acct.assumedDeleted) {
        outputMessage('Account may have been deleted');
        return false;
    }

    if (acct.edge_followed_by.count < gblOptions.filterOptions.followers[0]) {
        outputMessage(acct.username + ' filtered - too few followers')
        filtered = true;
    }
    if (acct.edge_followed_by.count > gblOptions.filterOptions.followers[1]) {
        outputMessage(acct.username + ' filtered - too many followers')
        filtered = true;
    }
    if (acct.edge_follow.count < gblOptions.filterOptions.following[0]) {
        outputMessage(acct.username + ' filtered - too few following')
        filtered = true;
    }
    if (acct.edge_follow.count > gblOptions.filterOptions.following[1]) {
        outputMessage(acct.username + ' filtered - too many following')
        filtered = true;
    }
    if (acct.edge_mutual_followed_by.count < gblOptions.filterOptions.mutualFollowedBy[0]) {
        outputMessage(acct.username + ' filtered - too few mutual followers')
        filtered = true;
    }
    if (acct.edge_mutual_followed_by.count > gblOptions.filterOptions.mutualFollowedBy[1]) {
        outputMessage(acct.username + ' filtered - too many mutual followers')
        filtered = true;
    }

    if (acct.followRatio < gblOptions.filterOptions.followRatio[0]) {
        outputMessage(acct.username + ' filtered - follow ratio too low')
        filtered = true;
    }
    if (acct.followRatio > gblOptions.filterOptions.followRatio[1]) {
        outputMessage(acct.username + ' filtered - follow ratio too high')
        filtered = true;
    }
    if (acct.edge_owner_to_timeline_media.count < gblOptions.filterOptions.posts[0]) {
        outputMessage(acct.username + ' filtered - too few posts')
        filtered = true;
    }
    if (acct.edge_owner_to_timeline_media.count > gblOptions.filterOptions.posts[1]) {
        outputMessage(acct.username + ' filtered - too many posts')
        filtered = true;
    }
    if (acct.lastPostDateInDays < gblOptions.filterOptions.lastPosted[0]) {
        outputMessage(acct.username + ' filtered - posted too recently')
        filtered = true;
    }

    // data doesn't exit properly for private accounts, so skip this filter if account is private
    if (acct.lastPostDateInDays > gblOptions.filterOptions.lastPosted[1] && (acct.is_private == false || acct.followed_by_viewer == true)) {
        outputMessage(acct.username + ' filtered - posted too long ago')
        filtered = true;
    }
    if (acct.is_private == true && gblOptions.filterOptions.private == false) {
        outputMessage(acct.username + ' filtered - account is private')
        filtered = true;
    }
    if (acct.is_private == false && gblOptions.filterOptions.non_private == false) {
        outputMessage(acct.username + ' filtered - account is public')
        filtered = true;
    }

    if (acct.follows_viewer == true && gblOptions.filterOptions.follows_me == false) {
        outputMessage(acct.username + ' filtered - account follows you')
        filtered = true;
    }
    if (acct.follows_viewer == false && gblOptions.filterOptions.non_follows_me == false) {
        outputMessage(acct.username + ' filtered - account does not follow you')
        filtered = true;
    }
    if (acct.is_business_account == true && gblOptions.filterOptions.is_business_account == false) {
        outputMessage(acct.username + ' filtered - account is a business account')
        filtered = true;
    }
    if (acct.is_business_account == false && gblOptions.filterOptions.non_is_business_account == false) {
        outputMessage(acct.username + ' filtered - account is not a business account')
        filtered = true;
    }
    if (acct.is_joined_recently == true && gblOptions.filterOptions.is_joined_recently == false) {
        outputMessage(acct.username + ' filtered - account joined recently')
        filtered = true;
    }
    if (acct.is_joined_recently == false && gblOptions.filterOptions.non_is_joined_recently == false) {
        outputMessage(acct.username + ' filtered - account did not join recently')
        filtered = true;
    }

    if (gblOptions.filterOptions.bio_contains == true) {
        var bioContains = false;

        if (acct.biography) {
            var bioContainsStrings = gblOptions.filterOptions.bio_contains_text.split(',');
            for (var i = 0; i < bioContainsStrings.length; i++) {
                if (acct.biography.toLowerCase().indexOf(bioContainsStrings[i].toLowerCase()) > -1) {
                    bioContains = true;
                }
            }
        }

        if (bioContains == false) {
            filtered = true;
            outputMessage(acct.username + ' filtered - bio does not contain ' + gblOptions.filterOptions.bio_contains_text);
        }
    }

    if (gblOptions.filterOptions.bio_not_contains == true) {
        var bioContains = false;

        if (acct.biography) {
            var bioContainsStrings = gblOptions.filterOptions.bio_not_contains_text.split(',');
            for (var i = 0; i < bioContainsStrings.length; i++) {
                if (acct.biography.toLowerCase().indexOf(bioContainsStrings[i].toLowerCase()) > -1) {
                    bioContains = true;
                    outputMessage(acct.username + ' filtered - bio contains ' + bioContainsStrings[i].toLowerCase());
                }
            }
        }

        if (bioContains == true) {
            filtered = true;
        }
    }


    if (gblOptions.filterOptions.external_url_contains == true) {
        var externalUrlContains = false;

        if (acct.external_url) {
            var externalUrlContainsStrings = gblOptions.filterOptions.external_url_contains_text.split(',');
            for (var i = 0; i < externalUrlContainsStrings.length; i++) {
                if (acct.external_url.toLowerCase().indexOf(externalUrlContainsStrings[i].toLowerCase()) > -1) {
                    externalUrlContains = true;
                }
            }
        }

        if (externalUrlContains == false) {
            filtered = true;
            outputMessage(acct.username + ' filtered - external url does not contain ' + gblOptions.filterOptions.external_url_contains_text);
        }
    }

    if (gblOptions.filterOptions.external_url_not_contains == true) {
        var externalUrlContains = false;

        if (acct.external_url) {
            var externalUrlNotContainsStrings = gblOptions.filterOptions.external_url_not_contains_text.split(',');
            for (var i = 0; i < externalUrlNotContainsStrings.length; i++) {
                if (acct.external_url.toLowerCase().indexOf(externalUrlNotContainsStrings[i].toLowerCase()) > -1) {
                    externalUrlContains = true;
                    outputMessage(acct.username + ' filtered - external url contains ' + externalUrlNotContainsStrings[i].toLowerCase());
                }
            }
        }

        if (externalUrlContains == true) {
            filtered = true;
        }
    }

    if (gblOptions.filterOptions.business_category_name_contains == true) {
        var BusinessCategoryNameContains = false;

        if (acct.business_category_name) {
            var businessCategoryNameContainsStrings = gblOptions.filterOptions.business_category_name_contains_text.split(',');
            for (var i = 0; i < businessCategoryNameContainsStrings.length; i++) {
                if (acct.business_category_name.toLowerCase().indexOf(businessCategoryNameContainsStrings[i].toLowerCase()) > -1) {
                    BusinessCategoryNameContains = true;
                }
            }
        }

        if (BusinessCategoryNameContains == false) {
            filtered = true;
            outputMessage(acct.username + ' filtered - business category name does not contain ' + gblOptions.filterOptions.business_category_name_contains_text);
        }
    }

    if (gblOptions.filterOptions.business_category_name_not_contains == true) {
        var BusinessCategoryNameContains = false;

        if (acct.business_category_name) {
            var businessCategoryNameContainsStrings = gblOptions.filterOptions.business_category_name_not_contains_text.split(',');
            for (var i = 0; i < businessCategoryNameContainsStrings.length; i++) {
                if (acct.business_category_name.toLowerCase().indexOf(businessCategoryNameContainsStrings[i].toLowerCase()) > -1) {
                    BusinessCategoryNameContains = true;
                    outputMessage(acct.username + ' filtered - business category name contains ' + businessCategoryNameContainsStrings[i].toLowerCase());
                }
            }
        }

        if (BusinessCategoryNameContains == true) {
            filtered = true;
        }
    }


    if (filtered === true) {
        return false;
    } else {
        return true;
    }

}

async function filterCriteriaMetForUnfollowing(acct) {

    if (gblOptions.unFollowFresh === false || gblOptions.dontUnFollowNonOrganic === true || gblOptions.unFollowIfOld === true) {
        var acctFromStorage = alreadyAttempted(acct);

        if (gblOptions.dontUnFollowNonOrganic === true && acctFromStorage === false) {
            outputMessage(acct.username + ' was followed outside of Organic, skipping');
            addStamp(acct.id, 'stamp-div-grey', 'non-organic');
            return false;
        }

        var timeSinceFollowed = today - acctFromStorage.followAttemptDate;

        if (acctFromStorage != false && acctFromStorage.followAttemptDate && gblOptions.unFollowFresh == false && timeSinceFollowed < gblOptions.unFollowDelay) {
            outputMessage(acct.username + ' was followed too recently to unfollow ' + millisecondsToHumanReadable(timeSinceFollowed, true));
            addStamp(acct.id, 'stamp-div-grey', 'too recent');
            return false;
        }
    }

    if (gblOptions.dontUnFollowFilters === true) {

        var filtered = false;

        if (acct.profile_pic_url.indexOf(igExternalVars.emptyProfilePicUrl) > -1 && gblOptions.filterOptions.no_profile_pic == false) {
            outputMessage(acct.username + ' filtered - has no profile picture')
            filtered = true;
        }

        if (acct.profile_pic_url.indexOf(igExternalVars.emptyProfilePicUrl) == -1 && gblOptions.filterOptions.profile_pic == false) {
            outputMessage(acct.username + ' filtered - has profile picture')
            filtered = true;
        }

        if (acct.is_verified == true && gblOptions.filterOptions.verified == false) {
            outputMessage(acct.username + ' filtered - account is verified')
            filtered = true;
        }
        if (acct.is_verified == false && gblOptions.filterOptions.non_verified == false) {
            outputMessage(acct.username + ' filtered - account is not verified')
            filtered = true;
        }
    }


    if (!acct.edge_followed_by) acct = await getAdditionalDataForAcct(acct);

    if (gblOptions.dontUnFollowFollowers === true) {
        if (acct.follows_viewer == true) {
            if (gblOptions.unFollowIfOld == true && timeSinceFollowed > gblOptions.unFollowIfOlderThan) {
                outputMessage(acct.username + ' was followed more than ' + millisecondsToHumanReadable(gblOptions.unFollowIfOlderThan, false).days + ' days ago, OK to unfollow')
                return true;
            } else {
                outputMessage(acct.username + ' is one of your followers, skipping');
                addStamp(acct.id, 'stamp-div-grey', 'follows you');
                return false;
            }
        }
    }


    if (acct.assumedDeleted) return false;

    if (gblOptions.dontUnFollowFilters === true) {

        if (acct.edge_followed_by.count < gblOptions.filterOptions.followers[0]) {
            outputMessage(acct.username + ' filtered - too few followers')
            filtered = true;
        }
        if (acct.edge_followed_by.count > gblOptions.filterOptions.followers[1]) {
            outputMessage(acct.username + ' filtered - too many followers')
            filtered = true;
        }
        if (acct.edge_follow.count < gblOptions.filterOptions.following[0]) {
            outputMessage(acct.username + ' filtered - too few following')
            filtered = true;
        }
        if (acct.edge_follow.count > gblOptions.filterOptions.following[1]) {
            outputMessage(acct.username + ' filtered - too many following')
            filtered = true;
        }
        if (acct.edge_mutual_followed_by.count < gblOptions.filterOptions.mutualFollowedBy[0]) {
            outputMessage(acct.username + ' filtered - too few mutual followers')
            filtered = true;
        }
        if (acct.edge_mutual_followed_by.count > gblOptions.filterOptions.mutualFollowedBy[1]) {
            outputMessage(acct.username + ' filtered - too many mutual followers')
            filtered = true;
        }
        if (acct.followRatio < gblOptions.filterOptions.followRatio[0]) {
            outputMessage(acct.username + ' filtered - follow ratio too low')
            filtered = true;
        }
        if (acct.followRatio > gblOptions.filterOptions.followRatio[1]) {
            outputMessage(acct.username + ' filtered - follow ratio too high')
            filtered = true;
        }
        if (acct.edge_owner_to_timeline_media.count < gblOptions.filterOptions.posts[0]) {
            outputMessage(acct.username + ' filtered - too few posts')
            filtered = true;
        }
        if (acct.edge_owner_to_timeline_media.count > gblOptions.filterOptions.posts[1]) {
            outputMessage(acct.username + ' filtered - too many posts')
            filtered = true;
        }
        if (acct.lastPostDateInDays < gblOptions.filterOptions.lastPosted[0]) {
            outputMessage(acct.username + ' filtered - posted too recently')
            filtered = true;
        }
        if (acct.lastPostDateInDays > gblOptions.filterOptions.lastPosted[1] && (acct.is_private == false || acct.followed_by_viewer == true)) {
            outputMessage(acct.username + ' filtered - posted too long ago')
            filtered = true;
        }
        if (acct.is_private == true && gblOptions.filterOptions.private == false) {
            outputMessage(acct.username + ' filtered - account is private')
            filtered = true;
        }
        if (acct.is_private == false && gblOptions.filterOptions.non_private == false) {
            outputMessage(acct.username + ' filtered - account is public')
            filtered = true;
        }
        if (acct.is_business_account == true && gblOptions.filterOptions.is_business_account == false) {
            outputMessage(acct.username + ' filtered - account is a business account')
            filtered = true;
        }
        if (acct.is_business_account == false && gblOptions.filterOptions.non_is_business_account == false) {
            outputMessage(acct.username + ' filtered - account is not a business account')
            filtered = true;
        }
        if (acct.is_joined_recently == true && gblOptions.filterOptions.is_joined_recently == false) {
            outputMessage(acct.username + ' filtered - account joined recently')
            filtered = true;
        }
        if (acct.is_joined_recently == false && gblOptions.filterOptions.non_is_joined_recently == false) {
            outputMessage(acct.username + ' filtered - account did not join recently')
            filtered = true;
        }

        if (gblOptions.filterOptions.bio_contains == true) {
            var bioContains = false;

            if (acct.biography) {
                var bioContainsStrings = gblOptions.filterOptions.bio_contains_text.split(',');
                for (var i = 0; i < bioContainsStrings.length; i++) {
                    if (acct.biography.toLowerCase().indexOf(bioContainsStrings[i].toLowerCase()) > -1) {
                        bioContains = true;
                    }
                }
            }

            if (bioContains == false) {
                filtered = true;
                outputMessage(acct.username + ' filtered - bio does not contain ' + gblOptions.filterOptions.bio_contains_text);
            }
        }

        if (gblOptions.filterOptions.bio_not_contains == true) {
            var bioContains = false;

            if (acct.biography) {
                var bioContainsStrings = gblOptions.filterOptions.bio_not_contains_text.split(',');
                for (var i = 0; i < bioContainsStrings.length; i++) {
                    if (acct.biography.toLowerCase().indexOf(bioContainsStrings[i].toLowerCase()) > -1) {
                        bioContains = true;
                        outputMessage(acct.username + ' filtered - bio contains ' + bioContainsStrings[i].toLowerCase());
                    }
                }
            }

            if (bioContains == true) {
                filtered = true;
            }
        }


        if (gblOptions.filterOptions.external_url_contains == true) {
            var externalUrlContains = false;

            if (acct.external_url) {
                var externalUrlContainsStrings = gblOptions.filterOptions.external_url_contains_text.split(',');
                for (var i = 0; i < externalUrlContainsStrings.length; i++) {
                    if (acct.external_url.toLowerCase().indexOf(externalUrlContainsStrings[i].toLowerCase()) > -1) {
                        externalUrlContains = true;
                    }
                }
            }

            if (externalUrlContains == false) {
                filtered = true;
                outputMessage(acct.username + ' filtered - external url does not contain ' + gblOptions.filterOptions.external_url_contains_text);
            }
        }

        if (gblOptions.filterOptions.external_url_not_contains == true) {
            var externalUrlContains = false;

            if (acct.external_url) {
                var externalUrlNotContainsStrings = gblOptions.filterOptions.external_url_not_contains_text.split(',');
                for (var i = 0; i < externalUrlNotContainsStrings.length; i++) {
                    if (acct.external_url.toLowerCase().indexOf(externalUrlNotContainsStrings[i].toLowerCase()) > -1) {
                        externalUrlContains = true;
                        outputMessage(acct.username + ' filtered - external url contains ' + externalUrlNotContainsStrings[i].toLowerCase());
                    }
                }
            }

            if (externalUrlContains == true) {
                filtered = true;
            }
        }


        if (gblOptions.filterOptions.business_category_name_contains == true) {
            var BusinessCategoryNameContains = false;

            if (acct.business_category_name) {
                var businessCategoryNameContainsStrings = gblOptions.filterOptions.business_category_name_contains_text.split(',');
                for (var i = 0; i < businessCategoryNameContainsStrings.length; i++) {
                    if (acct.business_category_name.toLowerCase().indexOf(businessCategoryNameContainsStrings[i].toLowerCase()) > -1) {
                        BusinessCategoryNameContains = true;
                    }
                }
            }

            if (BusinessCategoryNameContains == false) {
                filtered = true;
                outputMessage(acct.username + ' filtered - business category name does not contain ' + gblOptions.filterOptions.business_category_name_contains_text);
            }
        }

        if (gblOptions.filterOptions.business_category_name_not_contains == true) {
            var BusinessCategoryNameContains = false;

            if (acct.business_category_name) {
                var businessCategoryNameContainsStrings = gblOptions.filterOptions.business_category_name_not_contains_text.split(',');
                for (var i = 0; i < businessCategoryNameContainsStrings.length; i++) {
                    if (acct.business_category_name.toLowerCase().indexOf(businessCategoryNameContainsStrings[i].toLowerCase()) > -1) {
                        BusinessCategoryNameContains = true;
                        outputMessage(acct.username + ' filtered - business category name contains ' + businessCategoryNameContainsStrings[i].toLowerCase());
                    }
                }
            }

            if (BusinessCategoryNameContains == true) {
                filtered = true;
            }
        }


    }

    return filtered;

}

async function filterCriteriaMetForRemoveOrBlock(acct) {

    var filtered = false;

    if (acct.profile_pic_url.indexOf(igExternalVars.emptyProfilePicUrl) > -1 && gblOptions.filterOptions.no_profile_pic == false) {
        outputMessage(acct.username + ' filtered - has no profile picture')
        filtered = true;
    }

    if (acct.profile_pic_url.indexOf(igExternalVars.emptyProfilePicUrl) == -1 && gblOptions.filterOptions.profile_pic == false) {
        outputMessage(acct.username + ' filtered - has profile picture')
        filtered = true;
    }

    if (acct.followed_by_viewer == true && gblOptions.filterOptions.followed_by_me == false) {
        outputMessage(acct.username + ' filtered - account is followed by you')
        filtered = true;
    }

    if (acct.followed_by_viewer == false && gblOptions.filterOptions.non_followed_by_me == false) {
        outputMessage(acct.username + ' filtered - account is not followed by you')
        filtered = true;
    }

    if (acct.is_verified == true && gblOptions.filterOptions.verified == false) {
        outputMessage(acct.username + ' filtered - account is verified')
        filtered = true;
    }
    if (acct.is_verified == false && gblOptions.filterOptions.non_verified == false) {
        outputMessage(acct.username + ' filtered - account is not verified')
        filtered = true;
    }

    if (!acct.edge_followed_by) acct = await getAdditionalDataForAcct(acct);

    if (acct.assumedDeleted) return false;

    if (acct.edge_followed_by.count < gblOptions.filterOptions.followers[0]) {
        outputMessage(acct.username + ' filtered - too few followers')
        filtered = true;
    }
    if (acct.edge_followed_by.count > gblOptions.filterOptions.followers[1]) {
        outputMessage(acct.username + ' filtered - too many followers')
        filtered = true;
    }
    if (acct.edge_follow.count < gblOptions.filterOptions.following[0]) {
        outputMessage(acct.username + ' filtered - too few following')
        filtered = true;
    }
    if (acct.edge_follow.count > gblOptions.filterOptions.following[1]) {
        outputMessage(acct.username + ' filtered - too many following')
        filtered = true;
    }
    if (acct.edge_mutual_followed_by.count < gblOptions.filterOptions.mutualFollowedBy[0]) {
        outputMessage(acct.username + ' filtered - too few mutual followers')
        filtered = true;
    }
    if (acct.edge_mutual_followed_by.count > gblOptions.filterOptions.mutualFollowedBy[1]) {
        outputMessage(acct.username + ' filtered - too many mutual followers')
        filtered = true;
    }
    if (acct.followRatio < gblOptions.filterOptions.followRatio[0]) {
        outputMessage(acct.username + ' filtered - follow ratio too low')
        filtered = true;
    }
    if (acct.followRatio > gblOptions.filterOptions.followRatio[1]) {
        outputMessage(acct.username + ' filtered - follow ratio too high')
        filtered = true;
    }
    if (acct.edge_owner_to_timeline_media.count < gblOptions.filterOptions.posts[0]) {
        outputMessage(acct.username + ' filtered - too few posts')
        filtered = true;
    }
    if (acct.edge_owner_to_timeline_media.count > gblOptions.filterOptions.posts[1]) {
        outputMessage(acct.username + ' filtered - too many posts')
        filtered = true;
    }
    if (acct.lastPostDateInDays < gblOptions.filterOptions.lastPosted[0]) {
        outputMessage(acct.username + ' filtered - posted too recently')
        filtered = true;
    }
    if (acct.lastPostDateInDays > gblOptions.filterOptions.lastPosted[1] && (acct.is_private == false || acct.followed_by_viewer == true)) {
        outputMessage(acct.username + ' filtered - posted too long ago')
        filtered = true;
    }
    if (acct.is_private == true && gblOptions.filterOptions.private == false) {
        outputMessage(acct.username + ' filtered - account is private')
        filtered = true;
    }
    if (acct.is_private == false && gblOptions.filterOptions.non_private == false) {
        outputMessage(acct.username + ' filtered - account is public')
        filtered = true;
    }
    if (acct.is_business_account == true && gblOptions.filterOptions.is_business_account == false) {
        outputMessage(acct.username + ' filtered - account is a business account')
        filtered = true;
    }
    if (acct.is_business_account == false && gblOptions.filterOptions.non_is_business_account == false) {
        outputMessage(acct.username + ' filtered - account is not a business account')
        filtered = true;
    }
    if (acct.is_joined_recently == true && gblOptions.filterOptions.is_joined_recently == false) {
        outputMessage(acct.username + ' filtered - account joined recently')
        filtered = true;
    }
    if (acct.is_joined_recently == false && gblOptions.filterOptions.non_is_joined_recently == false) {
        outputMessage(acct.username + ' filtered - account did not join recently')
        filtered = true;
    }

    if (gblOptions.filterOptions.bio_contains == true) {
        var bioContains = false;

        if (acct.biography) {
            var bioContainsStrings = gblOptions.filterOptions.bio_contains_text.split(',');
            for (var i = 0; i < bioContainsStrings.length; i++) {
                if (acct.biography.toLowerCase().indexOf(bioContainsStrings[i].toLowerCase()) > -1) {
                    bioContains = true;
                }
            }
        }

        if (bioContains == false) {
            filtered = true;
            outputMessage(acct.username + ' filtered - bio does not contain ' + gblOptions.filterOptions.bio_contains_text);
        }
    }

    if (gblOptions.filterOptions.bio_not_contains == true) {
        var bioContains = false;

        if (acct.biography) {
            var bioContainsStrings = gblOptions.filterOptions.bio_not_contains_text.split(',');
            for (var i = 0; i < bioContainsStrings.length; i++) {
                if (acct.biography.toLowerCase().indexOf(bioContainsStrings[i].toLowerCase()) > -1) {
                    bioContains = true;
                    outputMessage(acct.username + ' filtered - bio contains ' + bioContainsStrings[i].toLowerCase());
                }
            }
        }

        if (bioContains == true) {
            filtered = true;
        }
    }

    if (gblOptions.filterOptions.external_url_contains == true) {
        var externalUrlContains = false;

        if (acct.external_url) {
            var externalUrlContainsStrings = gblOptions.filterOptions.external_url_contains_text.split(',');
            for (var i = 0; i < externalUrlContainsStrings.length; i++) {
                if (acct.external_url.toLowerCase().indexOf(externalUrlContainsStrings[i].toLowerCase()) > -1) {
                    externalUrlContains = true;
                }
            }
        }

        if (externalUrlContains == false) {
            filtered = true;
            outputMessage(acct.username + ' filtered - external url does not contain ' + gblOptions.filterOptions.external_url_contains_text);
        }
    }

    if (gblOptions.filterOptions.external_url_not_contains == true) {
        var externalUrlContains = false;

        if (acct.external_url) {
            var externalUrlContainsStrings = gblOptions.filterOptions.bio_not_contains_text.split(',');
            for (var i = 0; i < bioContainsStrings.length; i++) {
                if (acct.external_url.toLowerCase().indexOf(externalUrlContainsStrings[i].toLowerCase()) > -1) {
                    externalUrlContains = true;
                    outputMessage(acct.username + ' filtered - external url contains ' + externalUrlContainsStrings[i].toLowerCase());
                }
            }
        }

        if (externalUrlContains == true) {
            filtered = true;
        }
    }



    if (gblOptions.filterOptions.business_category_name_contains == true) {
        var BusinessCategoryNameContains = false;

        if (acct.business_category_name) {
            var businessCategoryNameContainsStrings = gblOptions.filterOptions.business_category_name_contains_text.split(',');
            for (var i = 0; i < businessCategoryNameContainsStrings.length; i++) {
                if (acct.business_category_name.toLowerCase().indexOf(businessCategoryNameContainsStrings[i].toLowerCase()) > -1) {
                    BusinessCategoryNameContains = true;
                }
            }
        }

        if (BusinessCategoryNameContains == false) {
            filtered = true;
            outputMessage(acct.username + ' filtered - business category name does not contain ' + gblOptions.filterOptions.business_category_name_contains_text);
        }
    }

    if (gblOptions.filterOptions.business_category_name_not_contains == true) {
        var BusinessCategoryNameContains = false;

        if (acct.business_category_name) {
            var businessCategoryNameContainsStrings = gblOptions.filterOptions.business_category_name_not_contains_text.split(',');
            for (var i = 0; i < businessCategoryNameContainsStrings.length; i++) {
                if (acct.business_category_name.toLowerCase().indexOf(businessCategoryNameContainsStrings[i].toLowerCase()) > -1) {
                    BusinessCategoryNameContains = true;
                    outputMessage(acct.username + ' filtered - business category name contains ' + businessCategoryNameContainsStrings[i].toLowerCase());
                }
            }
        }

        if (BusinessCategoryNameContains == true) {
            filtered = true;
        }
    }


    return filtered;

}


function bindNoUiSliders() {

    var sliderElements = ['followersSlider', 'followingSlider', 'followRatioSlider', 'mutualFollowedBySlider', 'postsSlider', 'lastPostedSlider'];

    for (var i = 0; i < sliderElements.length; i++) {

        var currentSlider = document.getElementById(sliderElements[i]);

        //hacky?
        var fromOptions = gblOptions.filterOptions[sliderElements[i].replace('Slider', '')];

        var dFO = defaultFilterOptions[sliderElements[i].replace('Slider', '')];

        if (sliderElements[i] == 'followRatioSlider') {
            noUiSlider.create(currentSlider, {
                start: fromOptions,
                range: {
                    'min': [dFO[0]],
                    '5%': [0],
                    '10%': [0.25],
                    '15%': [0.5],
                    '20%': [0.75],
                    '25%': [1],
                    '30%': [1.25],
                    '35%': [1.5],
                    '40%': [1.75],
                    '45%': [2],
                    '50%': [3],
                    '55%': [4],
                    'max': [dFO[1]]
                },
                //pips: { mode: 'values', values: [-7500, 0, 0.5,.75, 1,1.25,1.5,1.75,2,3,4, 10000], density: 10, stepped: true, format: wNumb({decimals:2}) },
                pips: {
                    mode: 'range',
                    density: 10,
                    stepped: true,
                    format: wNumb({
                        decimals: 2
                    })
                },
                connect: [false, true, false]
            });
        } else if (sliderElements[i] == 'followersSlider' || sliderElements[i] == 'mutualFollowedBySlider') {
            noUiSlider.create(currentSlider, {
                start: fromOptions,
                range: {
                    'min': [dFO[0]],
                    '5%': [10],
                    '20%': [100],
                    '50%': [5000],
                    '70%': [10000],
                    '80%': [100000],
                    '90%': [1000000],
                    'max': [dFO[1]]
                },
                //pips: { mode: 'values', values: [-7500, 0, 0.5,.75, 1,1.25,1.5,1.75,2,3,4, 10000], density: 10, stepped: true, format: wNumb({decimals:2}) },
                pips: {
                    mode: 'range',
                    density: 10,
                    stepped: true
                },
                connect: [false, true, false],
                format: wNumb({
                    decimals: 0
                })
            });

        } else {
            noUiSlider.create(currentSlider, {
                start: fromOptions,
                range: {
                    'min': [dFO[0]],
                    '5%': [10],
                    '20%': [100],
                    'max': [dFO[1]]
                },
                pips: {
                    mode: 'range',
                    density: 5
                },
                connect: [false, true, false],
                format: wNumb({
                    decimals: 0
                })
            });
        }

        currentSlider.noUiSlider.on('set', updateFilterOptions);


        function sp(event) {
            event.stopPropagation();
        }

        function setTooltipInputWidth(input) {
            input.style.width = ((input.value.length + 1) * 6) + 'px';
        }

        function makeTT(i, slider) {
            var tooltip = document.createElement('div'),
                input = document.createElement('input');

            // Add the input to the tooltip
            tooltip.className = 'noUi-tooltip';
            tooltip.appendChild(input);

            // On change, set the slider
            input.addEventListener('change', function() {
                var values = [null, null];
                values[i] = this.value;
                slider.noUiSlider.set(values)
                setTooltipInputWidth(this);
            });

            input.addEventListener('focus', function() {
                $(slider.tooltipInputs[0]).closest('.noUi-origin')[0].style.zIndex = 4;
                $(slider.tooltipInputs[1]).closest('.noUi-origin')[0].style.zIndex = 4;

                $(this).closest('.noUi-origin')[0].style.zIndex = 5;

            })

            // Catch all selections and make sure they don't reach the handle
            input.addEventListener('mousedown', sp);
            input.addEventListener('touchstart', sp);
            input.addEventListener('pointerdown', sp);
            input.addEventListener('MSPointerDown', sp);

            // Find the lower/upper slider handle and insert the tooltip
            slider.querySelector(i ? '.noUi-handle-upper' : '.noUi-handle-lower').appendChild(tooltip);

            return input;
        }

        // An 0/1 indexed array of input elements
        currentSlider.tooltipInputs = [makeTT(0, currentSlider), makeTT(1, currentSlider)];

        // When the slider changes, update the tooltip
        currentSlider.noUiSlider.on('update', function(values, handle) {
            this.target.tooltipInputs[handle].value = values[handle];
            setTooltipInputWidth(this.target.tooltipInputs[handle]);
        });

    }


    function updateFilterOptions() {
        for (var i = 0; i < sliderElements.length; i++) {
            var currentSlider = document.getElementById(sliderElements[i]);
            gblOptions.filterOptions[sliderElements[i].replace('Slider', '')] = currentSlider.noUiSlider.get().map(Number);
        }
        saveOptions();
    }

    function resetFilterSliders() {
        for (var i = 0; i < sliderElements.length; i++) {
            document.getElementById(sliderElements[i]).noUiSlider.reset();
        }
    }


    $('#btnResetFilter').click(resetFilterSliders);

}

function setCurrentPageUsername() {
    if (getCurrentPageUsername() != '') {
        $('#btnGetAllUsersFollowers')
            .removeClass('inactive')
            .text(chrome.i18n.getMessage('LoadCurrentFollowers', getCurrentPageUsername()))
            .off('click.ajaxGetAllUsersFollowers')
            .on('click.ajaxGetAllUsersFollowers', ajaxGetAllUsersFollowers);
        $('#btnGetAllUsersFollowing')
            .removeClass('inactive')
            .text(chrome.i18n.getMessage('LoadCurrentFollowing', getCurrentPageUsername()))
            .off('click.ajaxLoadFollowing')
            .on('click.ajaxLoadFollowing', ajaxLoadFollowing);

        $('#btnGetCommenters').removeClass('inactive')
            .text(chrome.i18n.getMessage('LoadCommenters', getCurrentPageUsername()))
            .off('click.getCommenters')
            .on('click.getCommenters', ajaxLoadAllUsersCommenters);

        $('#btnGetLikers')
            .removeClass('inactive')
            .text(chrome.i18n.getMessage('LoadLikers', getCurrentPageUsername()))
            .off('click.getLikers')
            .on('click.getLikers', ajaxLoadAllUsersLikers);

    } else {

        $('#igBotInjectedContainer #btnGetAllUsersFollowers,#igBotInjectedContainer #btnGetAllUsersFollowing').click(function() {
            outputMessage('Error: must be on an instagram user page (or try reloading).');
        }).addClass('inactive');
    }
}

function checkUsernameFreshness() {
    if ($(igExternalVars.qsForProfilePageUsername).text() != getCurrentPageUsername()) {
        ajaxGetCurrentPageUserInfo();
        return false;
    }
    return true;
}

function getCurrentPageUsername() {
    if (currentProfilePage != false && currentProfilePage) {
        return currentProfilePage.username;
    } else {
        ajaxGetCurrentPageUserInfo();
        return '';
    }
}

function getQueryParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function shortcodeToInstaID(Shortcode) {
    var char;
    var id = BigInt(0);
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    for (var i = 0; i < Shortcode.length; i++) {
        char = Shortcode[i];
        var mul = BigInt(BigInt(id) * BigInt(64));
        id = BigInt(BigInt(mul) + BigInt(alphabet.indexOf(char)));
    }

    var stringId = id.toString().replace('n', '');

    return stringId;
}


async function loadCurrentPostAsMedia() {

    var url = window.location.href;

    var shorty;

    if (url.indexOf('/p/') > 0) {
        shorty = url.substring(url.indexOf('/p/') + 3, url.length);
    } else if (url.indexOf('/reel/') > 0) {
        shorty = url.substring(url.indexOf('/reel/') + 6, url.length);
    } else {
        printMessage('Error: must be on post page');
        return false;
    }

    shorty = shorty.substring(0, shorty.indexOf('/'));


    var mediaId = shortcodeToInstaID(shorty);
    if (shorty.length > 15) {
        const response = await fetch(url);
        var HTML_String = await response.text();
        HTML_String = HTML_String.substring(HTML_String.indexOf('instagram://media?id=') + 21, HTML_String.length)
        mediaId = HTML_String.substring(0, HTML_String.indexOf('"'));
    }

    $.ajax({
            url: "https://www.instagram.com/api/v1/media/" + mediaId + "/info/",
            method: 'GET',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                xhr.setRequestHeader('x-asbd-id', '129477');
                xhr.setRequestHeader('x-ig-app-id', '936619743392459');
            },
            xhrFields: {
                withCredentials: true
            }
        })
        .done(function(r) {

            if (r && r.items && r.items[0]) {


                $.ajax({
                        url: "https://www.instagram.com/api/v1/media/" + mediaId + "/comments/?can_support_threading=true&permalink_enabled=false",
                        method: 'GET',
                        beforeSend: function(xhr) {
                            xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                            xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                            xhr.setRequestHeader('x-asbd-id', '129477');
                            xhr.setRequestHeader('x-ig-app-id', '936619743392459');
                        },
                        xhrFields: {
                            withCredentials: true
                        }
                    })
                    .done(function(c) {

                        r.items[0].comments = c.comments;

                        mediaToLike.push(r.items[0]);
                        arrayOfMediaToDiv(mediaToLike, true);
                        printMessage('Loaded media: ' + shorty);

                    });



            }

        }).fail(function(f) {
            if (f.status == 429) {
                printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                timeoutsQueue.push(setTimeout(loadCurrentPostAsMedia, gblOptions.timeDelayAfter429RateLimit));
            }
        });


}



async function getUserInfoFromGraphQL(username) {

    return new Promise(async function(resolve, reject) {


        const fetch1 = await fetch("https://www.instagram.com/graphql/query", {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9",
                "content-type": "application/x-www-form-urlencoded",
                "priority": "u=1, i",
                "sec-ch-prefers-color-scheme": "dark",
                "sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
                "sec-ch-ua-full-version-list": "\"Not A(Brand\";v=\"8.0.0.0\", \"Chromium\";v=\"132.0.6834.159\", \"Google Chrome\";v=\"132.0.6834.159\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-model": "\"\"",
                "sec-ch-ua-platform": "\"Linux\"",
                "sec-ch-ua-platform-version": "\"6.9.3\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-asbd-id": "359341",
                "x-bloks-version-id": "23752fb6fb4723f14bd2bdee662385d5f3ba28ce6d8f947ffffcf2a3d65d68d9",
                "x-csrftoken": "IKL8mnfOjDdCP68pjN3ri0mGwjMLu7oX",
                "x-fb-friendly-name": "PolarisProfilePostsQuery",
                "x-fb-lsd": "4siT1eZbAd-QxQohn6AUsd",
                "x-ig-app-id": "936619743392459"
            },
            "referrer": "https://www.instagram.com/" + username + "/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": "av=17841461843508115&__d=www&__user=0&__a=1&__req=8&__hs=20159.HYP%3Ainstagram_web_pkg.2.1...1&dpr=1&__ccg=EXCELLENT&__rev=1020831374&__s=sblxde%3Agvogj7%3A6ksx3t&__hsi=7481052854246233508&__dyn=7xe5WwlEnwn8K2Wmm1twpUnwgU7S6EeUaUco38w5ux609vCwjE1EE2Cw8G11wBw5Zx62G3i1ywOwa90Fw4Hw9O0Lbwae4UaEW2G0AEco5G0zEnwhE3Mw5NyES1Twoob82ZwrUdUbGw4mwr86C1mwrd6goK10xKi2K7E5y4UrwHwcObBxm&__csr=g_3cL2JihsigvTiui8F5JRQrHQCJrjLV8yquiGyk-KVuQiii_wHxox5rHGEWmBzrJd2ECi9gKErBGV8CVoO5-5oW699VpU6uq6bBCyUlzEdovAUdmWxa5oaU9U5R004KuwiU0NkwK0OU22w8O24kp2pE0A1wc-04i80kdw8il2Fo4LgN01gK1Dg2jcEgw48x6GiAhE22w3LQ01B_w1hW&__hsdp=&__hblp=&__comet_req=7&fb_dtsg=NAcPCmP-EEq_Rbc89EVRSm4BOrircFgwFKNR9tas_4ZL5FHDS4_QMcQ%3A17843708194158284%3A1741815227&jazoest=26075&lsd=4siT1eZbAd-QxQohn6AUsd&__spin_r=1020831374&__spin_b=trunk&__spin_t=1741818351&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=PolarisProfilePostsQuery&variables=%7B%22data%22%3A%7B%22count%22%3A12%2C%22include_reel_media_seen_timestamp%22%3Atrue%2C%22include_relationship_info%22%3Atrue%2C%22latest_besties_reel_media%22%3Atrue%2C%22latest_reel_media%22%3Atrue%7D%2C%22username%22%3A%22" + username + "%22%2C%22__relay_internal__pv__PolarisIsLoggedInrelayprovider%22%3Atrue%2C%22__relay_internal__pv__PolarisShareSheetV3relayprovider%22%3Atrue%7D&server_timestamps=true&doc_id=9507655305965624",
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        });

        const jsondata1 = await fetch1.json();

        const userid = jsondata1.data.xdt_api__v1__feed__user_timeline_graphql_connection.edges[0].node.owner.pk;



        const fetched = await fetch("https://www.instagram.com/graphql/query", {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9",
                "content-type": "application/x-www-form-urlencoded",
                "priority": "u=1, i",
                "sec-ch-prefers-color-scheme": "dark",
                "sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
                "sec-ch-ua-full-version-list": "\"Not A(Brand\";v=\"8.0.0.0\", \"Chromium\";v=\"132.0.6834.159\", \"Google Chrome\";v=\"132.0.6834.159\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-model": "\"\"",
                "sec-ch-ua-platform": "\"Linux\"",
                "sec-ch-ua-platform-version": "\"6.9.3\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-asbd-id": "359341",
                "x-bloks-version-id": "23752fb6fb4723f14bd2bdee662385d5f3ba28ce6d8f947ffffcf2a3d65d68d9",
                "x-csrftoken": "IKL8mnfOjDdCP68pjN3ri0mGwjMLu7oX",
                "x-fb-friendly-name": "PolarisProfilePageContentQuery",
                "x-fb-lsd": "4siT1eZbAd-QxQohn6AUsd",
                "x-ig-app-id": "936619743392459"
            },
            "referrer": "https://www.instagram.com/" + username + "/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": "av=17841461843508115&__d=www&__user=0&__a=1&__req=4&__hs=20159.HYP%3Ainstagram_web_pkg.2.1...1&dpr=1&__ccg=EXCELLENT&__rev=1020831374&__s=sblxde%3Agvogj7%3A6ksx3t&__hsi=7481052854246233508&__dyn=7xe5WwlEnwn8K2Wmm1twpUnwgU7S6EeUaUco38w5ux609vCwjE1EE2Cw8G11wBw5Zx62G3i1ywOwa90Fw4Hw9O0Lbwae4UaEW2G0AEco5G0zEnwhE3Mw5NyES1Twoob82ZwrUdUbGw4mwr86C1mwrd6goK10xKi2K7E5y4UrwHwcObBxm&__csr=g_3cL2JihsigvTiui8F5JRQrHQCJrjLV8yquiGyk-KVuQiii_wHxox5rHGEWmBzrJd2ECi9gKErBGV8CVoO5-5oW699VpU6uq6bBCyUlzEdovAUdmWxa5oaU9U5R004KuwiU0NkwK0OU22w8O24kp2pE0A1wc-04i80kdw8il2Fo4LgN01gK1Dg2jcEgw48x6GiAhE22w3LQ01B_w1hW&__hsdp=&__hblp=&__comet_req=7&fb_dtsg=NAcPCmP-EEq_Rbc89EVRSm4BOrircFgwFKNR9tas_4ZL5FHDS4_QMcQ%3A17843708194158284%3A1741815227&jazoest=26075&lsd=4siT1eZbAd-QxQohn6AUsd&__spin_r=1020831374&__spin_b=trunk&__spin_t=1741818351&fb_api_caller_class=RelayModern&fb_api_req_friendly_name=PolarisProfilePageContentQuery&variables=%7B%22id%22%3A%22" + userid + "%22%2C%22render_surface%22%3A%22PROFILE%22%7D&server_timestamps=true&doc_id=28812098038405011",
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        });

        const jsondata = await fetched.json();

        resolve(jsondata.data.user);
    });
}



function ajaxGetCurrentPageUserInfo(urlprefix) {

    if (!urlprefix) {
        urlprefix = urlAcctInfo;
    }

    var username = $(igExternalVars.qsForProfilePageUsername).text();
    if (username == '') username = window.location.pathname.split('/')[1];
    if (username == 'explore' || username == 'stories' || username === 'accounts' || username === 'direct' || username === 'reel') username = '';

    if (username == 'p') username = getQueryParameterByName('taken-by') || getUsernameFromPostHtml();

    if (username.indexOf('Edit Profile') > -1) username = username.replace('Edit Profile', '');

    if ((currentProfilePage == false && username != '') || (username != '' && currentProfilePage.username != username)) {



        $.ajax({
            url: '' + urlprefix + username,
            method: 'GET',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                xhr.setRequestHeader('x-asbd-id', '129477');
                xhr.setRequestHeader('x-ig-app-id', '936619743392459');
            },
            xhrFields: {
                withCredentials: true
            }
        }).fail(async function(err) {
            if (err.status === 429) {
                printMessage(chrome.i18n.getMessage('RateLimit429', [(gblOptions.timeDelayAfter429RateLimit / 60000)]));
                setTimeout(ajaxGetCurrentPageUserInfo, (gblOptions.timeDelayAfter429RateLimit / 60000));
                clearInterval(usernameCheckInterval);
            }

            if (err.status === 400) {
                clearInterval(usernameCheckInterval);

                currentProfilePage = await getUserInfoFromGraphQL(username);

                setCurrentPageUsername();
                startUserNameFreshnessInterval();
                outputMessage('Current profile: ' + username);

                outputMessage('Instagram has temporarily blocked you from the API which loads data about profiles. Using backup method... but you should really slow down');

            }


        }).done(function(data) {
            currentProfilePage = extractJSONfromUserPageHTML(data);

            if (currentProfilePage !== false) {
                setCurrentPageUsername();
                startUserNameFreshnessInterval();
                outputMessage('Current profile: ' + username);

            } else {
                //outputMessage('Error loading current user page');
                clearInterval(usernameCheckInterval);
                ajaxGetCurrentPageUserInfo(urlAcctInfo2);
            }


        });
    }
}

function getUsernameFromPostHtml() {
    return $('header._aaqw a.x1i10hfl:first').text();
}

function extractJSONfromUserPageHTML(data) {

    var pureJSON = data.data;
    if (pureJSON && pureJSON.user) {
        return pureJSON.user;
    }

    if (data && data.user) {
        var scriptSection = data.substring(data.indexOf('<script type="text/javascript">window._sharedData = ') + 52, data.indexOf(';</script>', data.indexOf('<script type="text/javascript">window._sharedData = ')));
        var scriptSectionAdditional = data.substring(data.indexOf('{', data.indexOf('<script type="text/javascript">window.__additionalDataLoaded(')), data.indexOf(');</script>', data.indexOf('<script type="text/javascript">window.__additionalDataLoaded(')));

        if (data.indexOf('<script type="text/javascript">window._sharedData = ') < 0 && data.indexOf('<script type="text/javascript">window.__additionalDataLoaded(') < 0) {
            return false;;
        }

        var jsondata = JSON.parse(scriptSection);
        if (jsondata && jsondata.entry_data && jsondata.entry_data.ProfilePage && jsondata.entry_data.ProfilePage.length > 0 && jsondata.entry_data.ProfilePage[0].hasOwnProperty('graphql')) {
            var user = jsondata.entry_data.ProfilePage[0].graphql.user;
            return user;
        }

        var jsondataAdditional = JSON.parse(scriptSectionAdditional);
        if (jsondataAdditional && jsondataAdditional.hasOwnProperty('graphql')) {
            var user = jsondataAdditional.graphql.user;
            return user;
        }
    }
    return false;

}


function setCurrentPageHashtag() {
    var hashtagFromUrl = getHashtagFromUrl();

    if (hashtagFromUrl != '') {

        $('#igBotInjectedContainer #btnLikeHashtag')
            .removeClass('inactive')
            .off('click.hashtagButtonError')
            .off('click.ajaxLoadPostsFromHashtag')
            .on('click.ajaxLoadPostsFromHashtag', ajaxLoadPostsFromHashtag)
            .text('Load Posts from #' + hashtagFromUrl);

    } else {


        $('#igBotInjectedContainer #btnLikeHashtag')
            .addClass('inactive')
            .off('click.ajaxLoadPostsFromHashtag')
            .off('click.hashtagButtonError')
            .on('click.hashtagButtonError', function() {
                outputMessage('Error: must be on an instagram hashtag page');
            });
    }
}



function setCurrentPageLocation() {
    var locationFromUrl = getLocationFromUrl();

    if (locationFromUrl != '') {

        $('#igBotInjectedContainer #btnLoadLocationPosts')
            .removeClass('inactive')
            .off('click.locationButtonError')
            .off('click.ajaxLoadPostsFromLocation')
            .on('click.ajaxLoadPostsFromLocation', ajaxLoadPostsFromLocation);


    } else {

        $('#igBotInjectedContainer #btnLoadLocationPosts')
            .addClass('inactive')
            .off('click.ajaxLoadPostsFromLocation')
            .off('click.locationButtonError')
            .on('click.locationButtonError', function() {
                outputMessage('Error: must be on an instagram location page');
            });
    }
}

function getHashtagFromUrl() {

    if ((window.location.href.indexOf('/explore/tags/') == -1) && (window.location.href.indexOf('/explore/search/keyword/?q=%23') == -1)) {
        return '';
    }

    var tagFromUrl = window.location.href;

    if (tagFromUrl.indexOf('/explore/tags/') > -1) {
        tagFromUrl = tagFromUrl.replace('https://www.instagram.com/explore/tags/', '');
        tagFromUrl = tagFromUrl.slice(0, tagFromUrl.indexOf('/'));
    }

    if (tagFromUrl.indexOf('/explore/search/keyword/?q=%23') > -1) {
        tagFromUrl = tagFromUrl.replace('https://www.instagram.com/explore/search/keyword/?q=%23', '');
    }

    tagFromUrl = decodeURIComponent(tagFromUrl);

    return tagFromUrl;
}


function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function saveHiddenStatus(hiddenStatus) {
    chrome.storage.sync.set({
        'igBotHidden': hiddenStatus
    });
}

function getHiddenStatus(callback) {

    chrome.storage.sync.get('igBotHidden', function(object) {

        var hiddenStatus = false;

        if (typeof object['igBotHidden'] != 'undefined') {
            hiddenStatus = object['igBotHidden'];
        } else {
            hiddenStatus = false;
        }

        callback(hiddenStatus);

    });

}

function hiddenStatusCallback(hiddenStatus) {
    if (hiddenStatus == true) {
        hideControlsDiv();
    } else {
        openControlsDiv();
    }
}


$.fn.shake = function shake(interval, distance, times) {
    interval = interval || 100;
    distance = distance || 10;
    times = times || 4;

    for (var iter = 0; iter < (times + 1); iter++) {
        //this.animate({ left: ((iter%2==0 ? distance : distance*-1))}, interval);
        this.animate({
            top: ((iter % 2 == 0 ? distance : distance * -1))
        }, interval);
        this.animate({
            top: ''
        }, interval);
    }
}

function userUpdateListener() {
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {

            // Mensagens com 'type' são do Lovable — deixar lovable-sync.js tratar
            if (request.type) return false;

            if (request.extension_updated) {
                waitForElement('li.tab6', document,
                    function() {
                        clickNotNow(true);
                        $('li.tab6 label').css({
                                'color': 'green'
                            }).click()
                            .delay(100).fadeOut().fadeIn('slow')
                            .delay(100).fadeOut().fadeIn('slow')
                            .delay(100).fadeOut().fadeIn('slow')
                            .delay(100).fadeOut().fadeIn('slow')
                            .delay(100).fadeOut().fadeIn('slow')
                            .delay(100).fadeOut().fadeIn('slow');
                    }, false);

            }

            if (request.clickSomething) {
                // TO DO, keep selectors here instead of sending "parent" request from backgroundscript
                if (request.clickViewStory) {

                    var tabId = request.tabId;

                    var intervalCloseWhenDone = setInterval(function() {

                        var currentUrl = window.location.href;

                        if (currentUrl.indexOf('/stories/') == -1) {
                            clearInterval(intervalCloseWhenDone);

                            chrome.runtime.sendMessage({
                                "closeStoryTab": {
                                    "tabId": tabId
                                }
                            });
                        }
                    }, 250);

                    var intervalClickViewStory = setInterval(function() {
                        var currentUrl = window.location.href;
                        var matchingElement = $('div[role="button"]:not(:has(svg))');

                        if (currentUrl.indexOf('/stories/') > -1 && matchingElement.length > 0) {
                            clearInterval(intervalClickViewStory);
                            matchingElement.click();

                            chrome.runtime.sendMessage({
                                "viewedStory": true
                            });
                            console.log('clicked view story');
                        }
                    }, 250);

                } else if (request.parent) {
                    $(request.clickSomething).parents(request.parent).click();
                    console.log('clicked  ' + request.clickSomething + ' parent');
                } else {
                    $(request.clickSomething).click();
                    console.log('clicked  ' + request.clickSomething);
                }

                return true;
            }

            if (request.closedStory) {
                closedStoryTab(request);
            }

            // Handle story reply from background script
            if (request.replyToStory) {
                var replyInput = document.querySelector('textarea[placeholder*="Send message"]') ||
                                 document.querySelector('input[placeholder*="Send message"]') ||
                                 document.querySelector('textarea[placeholder*="Reply"]') ||
                                 document.querySelector('textarea[placeholder*="Enviar mensagem"]') ||
                                 document.querySelector('textarea[placeholder*="Responder"]');

                if (replyInput) {
                    replyInput.focus();
                    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set ||
                                                  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    if (nativeInputValueSetter) {
                        nativeInputValueSetter.call(replyInput, request.replyText);
                    } else {
                        replyInput.value = request.replyText;
                    }
                    replyInput.dispatchEvent(new Event('input', { bubbles: true }));
                    replyInput.dispatchEvent(new Event('change', { bubbles: true }));

                    setTimeout(function() {
                        var sendBtn = document.querySelector('button[type="submit"]') ||
                                      document.querySelector('div[role="button"][tabindex="0"]');
                        if (sendBtn) {
                            sendBtn.click();
                            chrome.runtime.sendMessage({ viewedStory: true });
                        }
                    }, 1500);
                }
            }

            if (request.instabot_has_license) {
                instabot_has_license = request.instabot_has_license;

                if (request.igBotUser) {
                    localStorage['gbUserGuid'] = request.igBotUser.user_guid;
                    localStorage['gbFTover'] = false;

                    // ('set localStorage to licensed guid (has a license');
                }
            }

            if (request.instabot_install_date || request.instabot_free_trial_time) {
                instabot_install_date = request.instabot_install_date;
                instabot_free_trial_time = request.instabot_free_trial_time;
                clearInterval(freeTrialInterval);
                freeTrialInterval = setInterval(displayFreeTrialTimeLeft, 500);
            }

            if (request.igBotUser) {
                var guidStorage = request.igBotUser.user_guid;
                var ftOver = localStorage['gbFTover'];

                if (guidCookie) {
                    if (guidCookie !== guidStorage) {
                        chrome.runtime.sendMessage({
                            "guidCookie": guidCookie,
                            "ftOver": ftOver
                        });
                    }
                }

                if (ftOver == true && $('#iframePurchase').length == 0) {
                    $('#h2FreeTrialTimeLeft').hide();

                    chrome.runtime.sendMessage({
                        "ftOver": ftOver
                    });
                }

                if (window.location.href.indexOf('organicforfollowers.com') > -1 && window.location.href.indexOf('update_payment_info=true') > -1 && window.location.href.indexOf('guid') == -1) {
                    window.location.href = window.location.href + '&buyscreen=true&guid=' + guidStorage;
                }

            }

            if (request.openBuyScreen == true && request.igBotUser) {

                if (request.igBotUser.user_guid) {
                    var guid = request.igBotUser.user_guid;
                } else {
                    var guid = JSON.parse(request.igBotUser).user_guid;
                }

                // must make it so this is not set when clicking the subscribe now link
                localStorage['gbFTover'] = true;


                if (localStorage['gbUserGuid']) {
                    localStorage['gbUserGuid'] = guid;
                    //.log('set localStorage to guid (opening buy screen');
                }

                $('#iframePurchase').remove();
                $('#igBotMediaQueueContainer').hide();
                $('#igBotQueueContainer').hide().before('<iframe id="iframePurchase" src="https://www.organicforfollowers.com/?buyscreen=true&guid=' + guid + '"></iframe><div style="text-align:center; margin: 10px;">If there is an error above, please <a target="_blank" class="purchaseTextLink" href="https://www.organicforfollowers.com/?buyscreen=true&guid=' + guid + '">click here to Subscribe</a> or <a href="javascript:void(0);" id="aRelinkSubscription" class="purchaseTextLink">Re-Link your Subscription</a>.</div>');
                $('#aRelinkSubscription').off('click.showRelink').on('click.showRelink', showRelink);
                $('.igBotInjectedButton').off('click').addClass('disabled');
                $('li.tab1 label').click();
            }

            if (request.toggleOrganic == true) {
                toggleControlsDiv();
            }

            if (request.openOrganic == true) {
                openControlsDiv();
            }

            if (request.hideOrganic == true) {
                hideControlsDiv(false); // don't save the hidden status
            }

            sendResponse({
                response: 'beep beep'
            });
        }
    );
}


function getObjectWithKey(theObject, theKey) {
    var result = null;
    if (theObject instanceof Array) {
        for (var i = 0; i < theObject.length; i++) {
            result = getObjectWithKey(theObject[i], theKey);
            if (result) {
                break;
            }
        }
    } else {
        for (var prop in theObject) {
            if (prop == theKey) {
                //if(theObject[prop] == 1) {
                return theObject;
                // }
            }
            if (theObject[prop] instanceof Object || theObject[prop] instanceof Array) {
                result = getObjectWithKey(theObject[prop], theKey);
                if (result) {
                    break;
                }
            }
        }
    }
    return result;
}

function getObjectWithKeyAndValue(theObject, theKey, theValue) {
    var result = null;
    if (theObject instanceof Array) {
        for (var i = 0; i < theObject.length; i++) {
            result = getObjectWithKeyAndValue(theObject[i], theKey, theValue);
            if (result) {
                break;
            }
        }
    } else {
        for (var prop in theObject) {
            if (prop == theKey) {
                if (theObject[prop] == theValue) {

                    return theObject;
                }
            }
            if (theObject[prop] instanceof Object || theObject[prop] instanceof Array) {
                result = getObjectWithKeyAndValue(theObject[prop], theKey, theValue);
                if (result) {
                    break;
                }
            }
        }
    }
    return result;
}

function extractUserInfoFromScriptTags() {
    var scriptTags = document.getElementsByTagName('script');
    for (var i = 0; i < scriptTags.length; i++) {
        if (scriptTags[i].innerHTML.indexOf('"username":"') > -1) {
            var foundObject = getObjectWithKeyAndValue(JSON.parse(scriptTags[i].innerHTML), 'id', getCookie('ds_user_id'));
            if (foundObject && foundObject.username) {
                user = {
                    "csrf_token": getCookie('csrftoken'),
                    "viewer": foundObject,
                    "viewerId": foundObject.id
                }
                return true;
            }
        }
    }

    return false;
}


function getBackgroundInfo() {
    if (user && user.viewer && user.viewer.username != null) {
        // don't need to do anything
    } else {
        if (extractUserInfoFromScriptTags() === false) {
            outputMessage('Erro ao carregar conta. Verifique se esta logado no Instagram.');
            return false;
        }
    }

    var username = user.viewer.username;
    console.log('[Organic] getBackgroundInfo: carregando dados de @' + username);

    // Tentativa 1: API web_profile_info (método original)
    $.ajax({
            url: '' + urlAcctInfo + username,
            method: 'GET',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                xhr.setRequestHeader('x-instagram-ajax', '1010212815');
                xhr.setRequestHeader('x-asbd-id', '129477');
                xhr.setRequestHeader('x-ig-app-id', '936619743392459');
            },
            xhrFields: {
                withCredentials: true
            }
        })
        .done(function(r) {
            var u = extractJSONfromUserPageHTML(r);

            if (!u || !u.edge_followed_by) {
                console.warn('[Organic] web_profile_info retornou dados incompletos, tentando fallback...');
                getBackgroundInfoFallback(username);
                return;
            }

            outputMessage('Current IG User: ' + u.username);
            var statusDiv = document.getElementById('igBotStatusDiv');
            statusDiv.innerHTML = statusDiv.innerHTML.replace(u.username, '<a href="https://www.instagram.com/' + u.username + '/">' + u.username + '</a>');

            if (user && user.viewer) {
                user.viewer.edge_followed_by = { count: u.edge_followed_by.count };
                user.viewer.edge_follow = { count: u.edge_follow.count };
                if (u.edge_owner_to_timeline_media) user.viewer.edge_owner_to_timeline_media = { count: u.edge_owner_to_timeline_media.count };
            }
            chrome.runtime.sendMessage({
                "updatewanted": true,
                "ig_user": user.viewer,
                "ig_user_account_stats": {
                    "date": new Date().toUTCString(),
                    "followers": u.edge_followed_by.count,
                    "following": u.edge_follow.count,
                    "posts": u.edge_owner_to_timeline_media.count
                }
            });
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            console.warn('[Organic] web_profile_info falhou (status ' + (jqXHR ? jqXHR.status : '?') + '), tentando fallback...');
            getBackgroundInfoFallback(username);
        });
}

// Fallback: usar API /users/{id}/info/ quando web_profile_info falha
function getBackgroundInfoFallback(username) {
    // Tentar via ds_user_id cookie
    var dsMatch = document.cookie.match(/ds_user_id=([^;]+)/);
    var dsId = dsMatch ? dsMatch[1] : null;

    if (dsId) {
        console.log('[Organic] Fallback: tentando /users/' + dsId + '/info/');
        $.ajax({
            url: 'https://i.instagram.com/api/v1/users/' + dsId + '/info/',
            method: 'GET',
            beforeSend: function(xhr) {
                xhr.setRequestHeader('X-Csrftoken', getCsrfFromCookie());
                xhr.setRequestHeader('x-asbd-id', '129477');
                xhr.setRequestHeader('x-ig-app-id', '936619743392459');
            },
            xhrFields: { withCredentials: true }
        })
        .done(function(r) {
            if (r && r.user) {
                var u = r.user;
                outputMessage('Current profile: ' + (u.username || username));
                var statusDiv = document.getElementById('igBotStatusDiv');
                if (statusDiv) {
                    var uname = u.username || username;
                    statusDiv.innerHTML = statusDiv.innerHTML.replace(uname, '<a href="https://www.instagram.com/' + uname + '/">' + uname + '</a>');
                }
                if (user && user.viewer) {
                    user.viewer.edge_followed_by = { count: u.follower_count || 0 };
                    user.viewer.edge_follow = { count: u.following_count || 0 };
                    user.viewer.edge_owner_to_timeline_media = { count: u.media_count || 0 };
                }
                chrome.runtime.sendMessage({
                    "updatewanted": true,
                    "ig_user": user.viewer,
                    "ig_user_account_stats": {
                        "date": new Date().toUTCString(),
                        "followers": u.follower_count || 0,
                        "following": u.following_count || 0,
                        "posts": u.media_count || 0
                    }
                });
                console.log('[Organic] Fallback OK: @' + (u.username || username) + ' | ' + (u.follower_count || 0) + ' seguidores');
            } else {
                getBackgroundInfoMinimal(username);
            }
        })
        .fail(function(jqXHR) {
            console.warn('[Organic] Fallback /users/id/info/ falhou (status ' + (jqXHR ? jqXHR.status : '?') + ')');
            getBackgroundInfoMinimal(username);
        });
    } else {
        getBackgroundInfoMinimal(username);
    }
}

// Último recurso: usar os dados que já temos do user.viewer
function getBackgroundInfoMinimal(username) {
    console.log('[Organic] Usando dados mínimos do user.viewer para @' + username);
    outputMessage('Current profile: ' + username + ' (dados limitados)');
    var statusDiv = document.getElementById('igBotStatusDiv');
    if (statusDiv) {
        statusDiv.innerHTML = statusDiv.innerHTML.replace(username, '<a href="https://www.instagram.com/' + username + '/">' + username + '</a>');
    }

    var stats = {};
    if (user && user.viewer) {
        if (user.viewer.edge_followed_by) stats.followers = user.viewer.edge_followed_by.count;
        if (user.viewer.edge_follow) stats.following = user.viewer.edge_follow.count;
        if (user.viewer.edge_owner_to_timeline_media) stats.posts = user.viewer.edge_owner_to_timeline_media.count;
    }
    stats.date = new Date().toUTCString();

    chrome.runtime.sendMessage({
        "updatewanted": true,
        "ig_user": user.viewer,
        "ig_user_account_stats": stats
    });
}

function dialog(messages, yesCallback, noCallback) {

    $('#igBotDialogQuestion').html(messages.question);

    $('#btnDialogOK').text(messages.yes).off('click.dialogyes').on('click.dialogyes', function() {
        yesCallback();
        document.getElementById('igBotDialog').style.display = 'none'
    });
    $('#btnDialogCancel').text(messages.no).off('click.dialogcancel').on('click.dialogcancel', function() {
        noCallback();
        document.getElementById('igBotDialog').style.display = 'none'
    });

    document.getElementById('igBotDialog').style.display = 'block'
}

(function(global, factory) {
    if (typeof define === "function" && define.amd) {
        define([], factory);
    } else if (typeof exports !== "undefined") {
        factory();
    } else {
        var mod = {
            exports: {}
        };
        factory();
        global.FileSaver = mod.exports;
    }
})(this, function() {
    "use strict";

    /*
     * FileSaver.js
     * A saveAs() FileSaver implementation.
     *
     * By Eli Grey, http://eligrey.com
     *
     * License : https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md (MIT)
     * source  : http://purl.eligrey.com/github/FileSaver.js
     */
    // The one and only way of getting global scope in all environments
    // https://stackoverflow.com/q/3277182/1008999
    var _global = typeof window === 'object' && window.window === window ? window : typeof self === 'object' && self.self === self ? self : typeof global === 'object' && global.global === global ? global : void 0;

    function bom(blob, opts) {
        if (typeof opts === 'undefined') opts = {
            autoBom: false
        };
        else if (typeof opts !== 'object') {
            console.warn('Depricated: Expected third argument to be a object');
            opts = {
                autoBom: !opts
            };
        } // prepend BOM for UTF-8 XML and text/* types (including HTML)
        // note: your browser will automatically convert UTF-16 U+FEFF to EF BB BF

        if (opts.autoBom && (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i).test(blob.type)) {
            return new Blob([String.fromCharCode(0xFEFF), blob], {
                type: blob.type
            });
        }

        return blob;
    }

    function download(url, name, opts) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'blob';

        xhr.onload = function() {
            saveAs(xhr.response, name, opts);
        };

        xhr.onerror = function() {
            console.error('could not download file');
        };

        xhr.send();
    }

    function corsEnabled(url) {
        var xhr = new XMLHttpRequest(); // use sync to avoid popup blocker

        xhr.open('HEAD', url, false);
        xhr.send();
        return xhr.status >= 200 && xhr.status <= 299;
    } // `a.click()` doesn't work for all browsers (#465)


    function click(node) {
        try {
            node.dispatchEvent(new MouseEvent('click'));
        } catch (e) {
            var evt = document.createEvent('MouseEvents');
            evt.initMouseEvent('click', true, true, window, 0, 0, 0, 80, 20, false, false, false, false, 0, null);
            node.dispatchEvent(evt);
        }
    }

    var saveAs = _global.saveAs || ( // probably in some web worker
        typeof window !== 'object' || window !== _global ? function saveAs() {}
        /* noop */
        // Use download attribute first if possible (#193 Lumia mobile)
        :
        'download' in HTMLAnchorElement.prototype ? function saveAs(blob, name, opts) {
            var URL = _global.URL || _global.webkitURL;
            var a = document.createElement('a');
            name = name || blob.name || 'download';
            a.download = name;
            a.rel = 'noopener'; // tabnabbing
            // detect chrome extensions & packaged apps
            // a.target = '_blank'

            if (typeof blob === 'string') {
                // Support regular links
                a.href = blob;

                if (a.origin !== location.origin) {
                    corsEnabled(a.href) ? download(blob, name, opts) : click(a, a.target = '_blank');
                } else {
                    click(a);
                }
            } else {
                // Support blobs
                a.href = URL.createObjectURL(blob);
                setTimeout(function() {
                    URL.revokeObjectURL(a.href);
                }, 4E4); // 40s

                setTimeout(function() {
                    click(a);
                }, 0);
            }
        } // Use msSaveOrOpenBlob as a second approach
        :
        'msSaveOrOpenBlob' in navigator ? function saveAs(blob, name, opts) {
            name = name || blob.name || 'download';

            if (typeof blob === 'string') {
                if (corsEnabled(blob)) {
                    download(blob, name, opts);
                } else {
                    var a = document.createElement('a');
                    a.href = blob;
                    a.target = '_blank';
                    setTimeout(function() {
                        click(a);
                    });
                }
            } else {
                navigator.msSaveOrOpenBlob(bom(blob, opts), name);
            }
        } // Fallback to using FileReader and a popup
        :
        function saveAs(blob, name, opts, popup) {
            // Open a popup immediately do go around popup blocker
            // Mostly only avalible on user interaction and the fileReader is async so...
            popup = popup || open('', '_blank');

            if (popup) {
                popup.document.title = popup.document.body.innerText = 'downloading...';
            }

            if (typeof blob === 'string') return download(blob, name, opts);
            var force = blob.type === 'application/octet-stream';

            var isSafari = /constructor/i.test(_global.HTMLElement) || _global.safari;

            var isChromeIOS = /CriOS\/[\d]+/.test(navigator.userAgent);

            if ((isChromeIOS || force && isSafari) && typeof FileReader === 'object') {
                // Safari doesn't allow downloading of blob urls
                var reader = new FileReader();

                reader.onloadend = function() {
                    var url = reader.result;
                    url = isChromeIOS ? url : url.replace(/^data:[^;]*;/, 'data:attachment/file;');
                    if (popup) popup.location.href = url;
                    else location = url;
                    popup = null; // reverse-tabnabbing #460
                };

                reader.readAsDataURL(blob);
            } else {
                var URL = _global.URL || _global.webkitURL;
                var url = URL.createObjectURL(blob);
                if (popup) popup.location = url;
                else location.href = url;
                popup = null; // reverse-tabnabbing #460

                setTimeout(function() {
                    URL.revokeObjectURL(url);
                }, 4E4); // 40s
            }
        });
    _global.saveAs = saveAs.saveAs = saveAs;

    if (typeof module !== 'undefined') {
        module.exports = saveAs;
    }
});

var _lastMonitorUrl = '';
var _monitorTickCount = 0;

function monitorButtonConditions() {

    _monitorTickCount++;

    if (acctsQueue.length > 0 || currentList == 'acctsWhiteList') {
        $('.needsQueueAccts').removeClass('inactive');

        if (currentList == 'acctsWhiteList') {
            $('#btnSaveQueueToStorage, #btnExportQueue').hide();
            $('#btnSaveWhiteList').css({
                'display': 'flex'
            });
        } else {
            $('#btnSaveQueueToStorage, #btnExportQueue').css({
                'display': 'flex'
            });
            $('#btnSaveWhiteList').hide();
        }

        if ($('#igBotQueueContainer input:checked').length > 0) {
            $('.needsSelectedAccts').removeClass('inactive');
        } else {
            $('.needsSelectedAccts').addClass('inactive');
        }
    } else {
        $('#btnSaveQueueToStorage, #btnExportQueue').hide();
        $('.needsQueueAccts,.needsSelectedAccts').addClass('inactive');
        $('#queueQuantityRow').hide();
    }

    if (mediaToLike.length > 0) {
        $('.needsMedia').removeClass('inactive');

        if ($('#igBotMediaQueueContainer input:checked').length > 0) {
            $('.needsSelectedMedia').removeClass('inactive');
        } else {
            $('.needsSelectedMedia').addClass('inactive');
        }
    } else {
        $('.needsMedia,.needsSelectedMedia').addClass('inactive');
    }

    // URL-dependent checks — only when URL changes
    var currentUrl = window.location.href;
    if (currentUrl !== _lastMonitorUrl) {
        _lastMonitorUrl = currentUrl;

        if (currentUrl.indexOf("/p/") > -1 || currentUrl.indexOf("/reel/") > -1) {
            $('#btnLoadThisPost').removeClass('inactive');
        } else {
            $('#btnLoadThisPost').addClass('inactive');
        }

        setCurrentPageHashtag();
        setCurrentPageLocation();
    }

    if (timeoutsQueue.length > 0) {
        $('#btnStop,#igBotInjectedContainer #btnStop2').removeClass('inactive').show();
    } else {
        $('#btnStop,#igBotInjectedContainer #btnStop2').addClass('inactive').hide();
    }

    // Throttled tasks — run every ~3s (every 6th tick at 500ms)
    if (_monitorTickCount % 6 === 0) {
        clickNotNow();
    }

    // Apply tooltips periodically (every ~10s = every 20th tick at 500ms)
    if (_monitorTickCount % 20 === 0) {
        applyTooltips();
    }

}

function showRelink() {
    $('li.tab4 label').click();
    $('#relinkSubscription').attr('open', 'open');
}

function startUserNameFreshnessInterval() {
    clearInterval(usernameCheckInterval);
    usernameCheckInterval = setInterval(function() {

        if ($('#instabotIcon').length == 0) {
            injectIcon();
            shakeInstabotIcon();
        }

        if ($('#igBotInjectedContainer .pulsing').length > 0) {
            $('#instabotIcon').addClass('pulsing');
        } else {
            $('#instabotIcon').removeClass('pulsing');
        }

        checkUsernameFreshness();
    }, 2000);
}

function clickNotNow(override) {
    if (gblOptions.clickNotNow == true || override) {
        // Use native DOM instead of expensive jQuery :contains selector
        var buttons = document.querySelectorAll('button, div[role="button"]');
        for (var i = 0; i < buttons.length; i++) {
            var txt = buttons[i].textContent.trim();
            if (txt === 'Not Now' || txt === 'Not now') {
                outputMessage('Clicked "Not Now" on notifications/save question');
                buttons[i].click();
                break;
            }
        }
    }
}

function relinkSubscription() {
    $.post('https://www.organicforfollowers.com/find_subscription2.php', $('#formRelinkSubscription').serialize()).done(function(data) {
        if (data && data[0] && data[0].subscriptions && data[0].subscriptions.data && data[0].subscriptions.data.length > 0) {
            var guidFromServer = data[0].id;
            chrome.runtime.sendMessage({
                "guidCookie": guidFromServer
            }, function() {
                $('#resultFindSubscription').text('Subscription updated.  Please reload the page.');
            });
        } else {
            $('#resultFindSubscription').text('Cannot find subscription with that information.  Please contact organicautomator@gmail.com for assistance.');
        }

    });
}


async function arrayOfUsersToDiv(q, clearDiv) {

    if (typeof clearDiv == 'undefined') clearDiv = true;

    if (clearDiv === true) {
        // Destruir tablesorter/pager da tabela anterior para evitar handlers órfãos no .pager e falha na contagem/seleção de página
        var oldTable = document.getElementById('gridjsAcctsQueueWrapper');
        if (oldTable && oldTable.config && oldTable.config.namespace) {
            $(oldTable).trigger('destroy' + oldTable.config.namespace);
        }
        $('#igBotQueueContainer').children().remove();
    } else {
        $('#igBotQueueContainer').children().not('.igBotQueueAcct').remove();
    }

    if (gblOptions.cbRemoveUnusedColumns == true) {
        for (var i = 0; i < q.length; i++) {
            q[i] = removeAccountPropertiesByColumnCheckboxes(q[i]);
        }
    }

    if (gblOptions.cbShowQueueOnScreen == false) {
        $('#igBotQueueContainer').append('<div style="text-align:center;">You have turned off "Show queue on screen" in Settings.  Your queue is loaded in the background.</div>');
        return false;
    }


    $('#igBotQueueContainer').append('<table id="gridjsAcctsQueueWrapper"></table>');



    var columns = gblOptions.queueColumns;
    columns = columns.filter(e => e.visible !== false);


    var sb = '<thead><tr>';

    for (var i = 0; i < columns.length; i++) {
        sb = sb + '<th data-prop="' + columns[i].data + '" style="width:' + (columns[i].width || '60px') + ';">' + columns[i].name + '</th>';
    }

    sb = sb + '</tr></thead><tbody></tbody>';
    $('#gridjsAcctsQueueWrapper').append(sb);



    for (var i = 0; i < q.length; i++) {
        sb = '<tr>';
        for (var j = 0; j < columns.length; j++) {


            if (columns[j].width) {
                sb = sb + '<td column-data="' + columns[j].data + '" style="width:' + columns[j].width + ';">';
            } else {
                sb = sb + '<td column-data="' + columns[j].data + '">';
            }


            if (columns[j].data) {
                var props = columns[j].data.split('.');


                if (props[1] == 'count' && typeof q[i].edge_followed_by != 'object') {

                    if (q[i][columns[j].data]) {
                        sb = sb + q[i][columns[j].data] + '</td>';

                    } else {
                        sb = sb + '0</td>';

                    }


                } else if (props[1] && q[i].edge_followed_by) {
                    if (q[i][props[0]] && q[i][props[0]][props[1]]) {
                        sb = sb + q[i][props[0]][props[1]] + '</td>';
                    } else {
                        sb = sb + '-</td>';
                    }
                } else {

                    if (typeof q[i][props[0]] != 'undefined' && q[i][props[0]] !== null) {
                        if (columns[j].formatter) {
                            sb = sb + columns[j].formatter.replace(/\${ig_id}/g, q[i].id).replace(/\${cell}/g, q[i][columns[j].data]) + '</td>';
                        } else {

                            var dataString = q[i][props[0]];

                            if (columns[j].data == 'biography') {

                                var langString = dataString;

                                if (q[i].edge_owner_to_timeline_media && q[i].edge_owner_to_timeline_media.edges && q[i].edge_owner_to_timeline_media.edges.length > 0) {
                                    for (var ci = 0; ci < q[i].edge_owner_to_timeline_media.edges.length; ci++) {

                                        if (q[i].edge_owner_to_timeline_media.edges[ci] && q[i].edge_owner_to_timeline_media.edges[ci].caption && q[i].edge_owner_to_timeline_media.edges[ci].caption.text) {
                                            langString = langString + ' ' + q[i].edge_owner_to_timeline_media.edges[ci].caption.text;
                                        }

                                    }
                                }


                                q[i] = await detectLanguage(langString, q[i]);
                            }

                            if (typeof dataString === 'number' && dataString.toString().indexOf('.') > -1) {
                                dataString = dataString.toFixed(3);
                            }

                            if (columns[j].bool && dataString == '') {
                                dataString = 'false';
                            }



                            sb = sb + dataString + '</td>';
                        }
                    } else {
                        sb = sb + '-</td>';
                    }
                }


            }
        }
        sb = sb + '</tr>';
        $('#gridjsAcctsQueueWrapper tbody').append(sb);
    }


    $('#gridjsAcctsQueueWrapper').tablesorter({

        // *** APPEARANCE ***
        // Add a theme - 'blackice', 'blue', 'dark', 'default', 'dropbox',
        // 'green', 'grey' or 'ice' stylesheets have all been loaded
        // to use 'bootstrap' or 'jui', you'll need to include 'uitheme'
        // in the widgets option - To modify the class names, extend from
        // themes variable. Look for '$.extend($.tablesorter.themes.jui'
        // at the bottom of this window
        // this option only adds a table class name 'tablesorter-{theme}'
        theme: 'blue',

        // fix the column widths
        widthFixed: true,

        // Show an indeterminate timer icon in the header when the table
        // is sorted or filtered
        showProcessing: true,

        // header layout template (HTML ok); {content} = innerHTML,
        // {icon} = <i/> (class from cssIcon)
        headerTemplate: '{content}{icon}',

        // return the modified template string
        onRenderTemplate: null, // function(index, template){ return template; },

        // called after each header cell is rendered, use index to target the column
        // customize header HTML
        onRenderHeader: function(index) {
            // the span wrapper is added by default
            $(this).find('div.tablesorter-header-inner').addClass('roundedCorners');
        },

        // *** FUNCTIONALITY ***
        // prevent text selection in header
        cancelSelection: true,

        // add tabindex to header for keyboard accessibility
        tabIndex: true,

        // other options: 'ddmmyyyy' & 'yyyymmdd'
        dateFormat: 'yyyymmdd',

        // The key used to select more than one column for multi-column
        // sorting.
        sortMultiSortKey: 'shiftKey',

        // key used to remove sorting on a column
        sortResetKey: 'ctrlKey',

        // false for German '1.234.567,89' or French '1 234 567,89'
        usNumberFormat: true,

        // If true, parsing of all table cell data will be delayed
        // until the user initializes a sort
        delayInit: false,

        // if true, server-side sorting should be performed because
        // client-side sorting will be disabled, but the ui and events
        // will still be used.
        serverSideSorting: false,

        // default setting to trigger a resort after an 'update',
        // 'addRows', 'updateCell', etc has completed
        resort: true,

        // *** SORT OPTIONS ***
        // These are detected by default,
        // but you can change or disable them
        // these can also be set using data-attributes or class names
        headers: {
            // set 'sorter : false' (no quotes) to disable the column
            0: {
                sorter: 'text'
            },
            1: {
                sorter: false
            },
        },

        // ignore case while sorting
        ignoreCase: true,

        // forces the user to have this/these column(s) sorted first
        sortForce: null,
        // initial sort order of the columns, example sortList: [[0,0],[1,0]],
        // [[columnIndex, sortDirection], ... ]
        // sortList: [
        //     [0, 0],
        //     [1, 0],
        //     [2, 0]
        // ],
        sortList: [],
        // default sort that is added to the end of the users sort
        // selection.
        sortAppend: null,

        // when sorting two rows with exactly the same content,
        // the original sort order is maintained
        sortStable: false,

        // starting sort direction 'asc' or 'desc'
        sortInitialOrder: 'asc',

        // Replace equivalent character (accented characters) to allow
        // for alphanumeric sorting
        sortLocaleCompare: false,

        // third click on the header will reset column to default - unsorted
        sortReset: true,

        // restart sort to 'sortInitialOrder' when clicking on previously
        // unsorted columns
        sortRestart: false,

        // sort empty cell to bottom, top, none, zero, emptyMax, emptyMin
        emptyTo: 'bottom',

        // sort strings in numerical column as max, min, top, bottom, zero
        stringTo: 'zero',

        // extract text from the table
        textExtraction: {
            0: function(node, table) {
                // this is how it is done by default
                return $(node).attr(table.config.textAttribute) ||
                    node.textContent ||
                    node.innerText ||
                    $(node).text() ||
                    '';
            },
            1: function(node) {
                return $(node).text();
            }
        },

        // data-attribute that contains alternate cell text
        // (used in default textExtraction function)
        textAttribute: 'data-text',

        // use custom text sorter
        // function(a,b){ return a.sort(b); } // basic sort
        textSorter: null,

        // choose overall numeric sorter
        // function(a, b, direction, maxColumnValue)
        numberSorter: null,

        // *** WIDGETS ***
        // apply widgets on tablesorter initialization
        initWidgets: true,

        // table class name template to match to include a widget
        widgetClass: 'widget-{name}',

        // include zebra and any other widgets, options:
        // 'columns', 'filter', 'stickyHeaders' & 'resizable'
        // 'uitheme' is another widget, but requires loading
        // a different skin and a jQuery UI theme.
        widgets: ['pager', 'stickyHeaders', 'storage', 'zebra', 'columns', 'filter'],

        widgetOptions: {

            // zebra widget: adding zebra striping, using content and
            // default styles - the ui css removes the background
            // from default even and odd class names included for this
            // demo to allow switching themes
            // [ 'even', 'odd' ]
            zebra: [
                'ui-widget-content even',
                'ui-state-default odd'
            ],

            // columns widget: change the default column class names
            // primary is the 1st column sorted, secondary is the 2nd, etc
            columns: [
                'primary',
                'secondary',
                'tertiary'
            ],

            // columns widget: If true, the class names from the columns
            // option will also be added to the table tfoot.
            columns_tfoot: true,

            // columns widget: If true, the class names from the columns
            // option will also be added to the table thead.
            columns_thead: true,

            // filter widget: If there are child rows in the table (rows with
            // class name from 'cssChildRow' option) and this option is true
            // and a match is found anywhere in the child row, then it will make
            // that row visible; default is false
            filter_childRows: false,

            // filter widget: If true, a filter will be added to the top of
            // each table column.
            filter_columnFilters: true,

            // filter widget: css class name added to the filter cell
            // (string or array)
            filter_cellFilter: '',

            // filter widget: css class name added to the filter row & each
            // input in the row (tablesorter-filter is ALWAYS added)
            filter_cssFilter: '',

            // filter widget: add a default column filter type
            // '~{query}' to make fuzzy searches default;
            // '{q1} AND {q2}' to make all searches use a logical AND.
            filter_defaultFilter: {},

            // filter widget: filters to exclude, per column
            filter_excludeFilter: {},

            // filter widget: jQuery selector string (or jQuery object)
            // of external filters
            filter_external: '',

            // filter widget: class added to filtered rows;
            // needed by pager plugin
            filter_filteredRow: 'filtered',

            // filter widget: add custom filter elements to the filter row
            filter_formatter: null,

            // filter widget: Customize the filter widget by adding a select
            // dropdown with content, custom options or custom filter functions
            // see http://goo.gl/HQQLW for more details
            filter_functions: null,

            // filter widget: hide filter row when table is empty
            filter_hideEmpty: true,

            // filter widget: Set this option to true to hide the filter row
            // initially. The rows is revealed by hovering over the filter
            // row or giving any filter input/select focus.
            filter_hideFilters: false,

            // filter widget: Set this option to false to keep the searches
            // case sensitive
            filter_ignoreCase: true,

            // filter widget: if true, search column content while the user
            // types (with a delay)
            filter_liveSearch: true,

            // filter widget: a header with a select dropdown & this class name
            // will only show available (visible) options within the drop down
            filter_onlyAvail: 'filter-onlyAvail',

            // filter widget: default placeholder text
            // (overridden by any header 'data-placeholder' setting)
            filter_placeholder: {
                search: '',
                select: ''
            },

            // filter widget: jQuery selector string of an element used to
            // reset the filters.
            filter_reset: null,

            // filter widget: Use the $.tablesorter.storage utility to save
            // the most recent filters
            filter_saveFilters: false,

            // filter widget: Delay in milliseconds before the filter widget
            // starts searching; This option prevents searching for every character
            // while typing and should make searching large tables faster.
            filter_searchDelay: 300,

            // filter widget: allow searching through already filtered rows in
            // special circumstances; will speed up searching in large tables if true
            filter_searchFiltered: true,

            // filter widget: include a function to return an array of values to be
            // added to the column filter select
            filter_selectSource: null,

            // filter widget: Set this option to true if filtering is performed on
            // the server-side.
            filter_serversideFiltering: false,

            // filter widget: Set this option to true to use the filter to find
            // text from the start of the column. So typing in 'a' will find
            // 'albert' but not 'frank', both have a's; default is false
            filter_startsWith: false,

            // filter widget: If true, ALL filter searches will only use parsed
            // data. To only use parsed data in specific columns, set this option
            // to false and add class name 'filter-parsed' to the header
            filter_useParsedData: false,

            // filter widget: data attribute in the header cell that contains
            // the default filter value
            filter_defaultAttrib: 'data-value',

            // filter widget: filter_selectSource array text left of the separator
            // is added to the option value, right into the option text
            filter_selectSourceSeparator: '|',

            // starting page of the pager (zero based index)
            pager_startPage: 0,

            // Number of visible rows - default is 10
            pager_size: gblOptions.paginationLimit,

            // reset pager after filtering; set to desired page #
            // set to false to not change page at filter start
            pager_pageReset: 0,

            // output string - default is '{page}/{totalPages}';
            // possible variables:
            // {page}, {totalPages}, {startRow}, {endRow} and {totalRows}
            // pager_output: '{startRow} to {endRow} ({totalRows})',
            pager_output: '{startRow} - {endRow} / {filteredRows} ({totalRows})',

            // apply disabled classname to the pager arrows when the rows at
            // either extreme is visible - default is true
            pager_updateArrows: true,

            // Number of options to include in the pager number selector
            pager_maxOptionSize: 20,

            // Save pager page & size if the storage script is loaded
            // (requires $.tablesorter.storage in jquery.tablesorter.widgets.js)
            pager_savePages: true,

            // defines custom storage key
            pager_storageKey: 'tablesorter-pager',

            // if true, the table will remain the same height no matter how many
            // records are displayed. The space is made up by an empty
            // table row set to a height to compensate; default is false
            pager_fixedHeight: false,

            // count child rows towards the set page size?
            // (set true if it is a visible table row within the pager)
            // if true, child row(s) may not appear to be attached to its
            // parent row, may be split across pages or
            // may distort the table if rowspan or cellspans are included.
            pager_countChildRows: false,

            // remove rows from the table to speed up the sort of large tables.
            // setting this to false, only hides the non-visible rows; needed
            // if you plan to add/remove rows with the pager enabled.
            pager_removeRows: false,

            // css class names used by pager elements
            pager_css: {
                // class added to pager container
                container: 'tablesorter-pager',
                // error information row (don't include period at beginning)
                errorRow: 'tablesorter-errorRow',
                // class added to arrows @ extremes
                // (i.e. prev/first arrows "disabled" on first page)
                disabled: 'disabled'
            },

            // jQuery selectors
            pager_selectors: {
                // target the pager markup
                container: '.pager',
                // go to first page arrow
                first: '.first',
                // previous page arrow
                prev: '.prev',
                // next page arrow
                next: '.next',
                // go to last page arrow
                last: '.last',
                // go to page selector - select dropdown that sets the current page
                gotoPage: '.gotoPage',
                // location of where the "output" is displayed
                pageDisplay: '.pagedisplay',
                // page size selector - select dropdown that sets the "size" option
                pageSize: '.pagesize'
            },

            // Resizable widget: If this option is set to false, resized column
            // widths will not be saved. Previous saved values will be restored
            // on page reload
            resizable: true,

            // Resizable widget: If this option is set to true, a resizing anchor
            // will be included in the last column of the table
            resizable_addLastColumn: false,

            // Resizable widget: Set this option to the starting & reset header widths
            resizable_widths: [],

            // Resizable widget: Set this option to throttle the resizable events
            // set to true (5ms) or any number 0-10 range
            resizable_throttle: false,

            // saveSort widget: If this option is set to false, new sorts will
            // not be saved. Any previous saved sort will be restored on page
            // reload.
            saveSort: false,

            // stickyHeaders widget: extra class name added to the sticky header row
            stickyHeaders: '',

            // jQuery selector or object to attach sticky header to
            stickyHeaders_attachTo: '#igBotQueueContainer',

            // jQuery selector or object to monitor horizontal scroll position
            // (defaults: xScroll > attachTo > window)
            stickyHeaders_xScroll: null,

            // jQuery selector or object to monitor vertical scroll position
            // (defaults: yScroll > attachTo > window)
            stickyHeaders_yScroll: null,

            // number or jquery selector targeting the position:fixed element
            stickyHeaders_offset: 0,

            // scroll table top into view after filtering
            stickyHeaders_filteredToTop: true,

            // added to table ID, if it exists
            stickyHeaders_cloneId: '-sticky',

            // trigger 'resize' event on headers
            stickyHeaders_addResizeEvent: true,

            // if false and a caption exist, it won't be included in the
            // sticky header
            stickyHeaders_includeCaption: true,

            // The zIndex of the stickyHeaders, allows the user to adjust this
            // to their needs
            stickyHeaders_zIndex: 2

        },

        // *** CALLBACKS ***
        // function called after tablesorter has completed initialization
        initialized: function() {

        }, // function (table) {}

        // *** extra css class names
        tableClass: '',
        cssAsc: '',
        cssDesc: '',
        cssNone: '',
        cssHeader: '',
        cssHeaderRow: '',
        // processing icon applied to header during sort/filter
        cssProcessing: '',

        // class name indiciating that a row is to be attached to the its parent
        cssChildRow: 'tablesorter-childRow',
        // if this class does not exist, the {icon} will not be added from
        // the headerTemplate
        cssIcon: 'tablesorter-icon',
        // class name added to the icon when there is no column sort
        cssIconNone: '',
        // class name added to the icon when the column has an ascending sort
        cssIconAsc: '',
        // class name added to the icon when the column has a descending sort
        cssIconDesc: '',
        // don't sort tbody with this class name
        // (only one class name allowed here!)
        cssInfoBlock: 'tablesorter-infoOnly',
        // class name added to table header which allows clicks to bubble up
        cssAllowClicks: 'tablesorter-allowClicks',
        // header row to ignore; cells within this row will not be added
        // to table.config.$headers
        cssIgnoreRow: 'tablesorter-ignoreRow',

        // *** SELECTORS ***
        // jQuery selectors used to find the header cells.
        selectorHeaders: '> thead th, > thead td',

        // jQuery selector of content within selectorHeaders
        // that is clickable to trigger a sort.
        selectorSort: 'th, td',

        // rows with this class name will be removed automatically
        // before updating the table cache - used by 'update',
        // 'addRows' and 'appendCache'
        selectorRemove: '.remove-me',

        // *** DEBUGING ***
        // send messages to console
        debug: false

    }).bind("sortEnd", function(e, t) {
        sortQueueByTableSort();
        handleCheckBoxes();
    });



    handleCheckBoxes();
    handleImagePreload();

    if (clearDiv == true) {
        $('#paginationLimit option:selected').attr("selected", null);
        $('#paginationLimit option[value="' + gblOptions.paginationLimit + '"]').attr("selected", "selected");
        $('#gridjsAcctsQueueWrapper').trigger('pageSize', gblOptions.paginationLimit);
    }

    $('#queueQuantityRow').show();
}


function exportQueue() {

    saveText(generateFileName() + ".csv", exportToCsv(acctsQueue));

}

async function detectLanguage(dataString, a) {
    let langInfo = await chrome.i18n.detectLanguage(dataString);

    const languageNames = new Intl.DisplayNames(['en'], {
        type: 'language'
    });

    var highestPercentage = 0;

    a['languageCount'] = langInfo.languages.length;

    for (const lang of langInfo.languages) {

        if (lang.percentage > highestPercentage) {
            a['languageCode'] = lang.language;
            a['languageName'] = languageNames.of(lang.language);
            a['languagePercentage'] = lang.percentage;
        }

        highestPercentage = lang.percentage;
    }

    return a;

}


function removeAccountPropertiesByColumnCheckboxes(a) {
    var visibleColumns = gblOptions.queueColumns;
    visibleColumns = visibleColumns.filter(e => e.visible !== false);

    var acctCopy = {};

    for (var j = 0; j < visibleColumns.length; j++) {

        var props = visibleColumns[j].data.split('.');

        if (props[1] && a.edge_followed_by) {
            if (a[props[0]][props[1]]) {
                // acctCopy[visibleColumns[j].data] = a[props[0]][props[1]];
                acctCopy[props[0]] = {
                    [props[1]]: a[props[0]][props[1]]
                }
            }
        } else {
            if (a[visibleColumns[j].data]) {
                if (Array.isArray(a[visibleColumns[j].data]) == true) {
                    acctCopy[visibleColumns[j].data] = a[visibleColumns[j].data].join('/');

                } else {
                    acctCopy[visibleColumns[j].data] = a[visibleColumns[j].data];
                }
            } else {
                acctCopy[visibleColumns[j].data] = '';
            }
        }
    }

    return acctCopy;

}


function exportToCsv(q) {

    var items = [];

    var visibleColumns = gblOptions.queueColumns;
    visibleColumns = visibleColumns.filter(e => e.visible !== false);

    for (var i = 0; i < q.length; i++) {
        var acctCopy = removeAccountPropertiesByColumnCheckboxes(q[i]);

        items.push(acctCopy);

    }

    const header = Object.keys(items[0]);
    const headerString = header.join(',');
    // handle null or undefined values here
    const replacer = function(key, value) {
        return value === null ? '' : value
    }
    const rowItems = items.map((row) =>
        header
        .map((fieldName) => JSON.stringify(row[fieldName], replacer))
        .join(',')
    );
    // join header and body, and break into separate lines
    const csv = [headerString, ...rowItems].join('\r\n');
    return csv;
}

function sortQueueByTableSort() {
    var sortingArr = [];
    $('#gridjsAcctsQueueWrapper input[type="checkbox"]').each(function() {
        sortingArr.push($(this).val())
    });

    acctsQueue.sort(function(a, b) {
        return sortingArr.indexOf(a.id) - sortingArr.indexOf(b.id);
    });
}

function sortMediaQueueByTableSort() {
    var sortingArr = [];
    $('#gridjsMediaQueueWrapper input[type="checkbox"]').each(function() {
        sortingArr.push($(this).val())
    });

    mediaToLike.sort(function(a, b) {
        return sortingArr.indexOf(a.id) - sortingArr.indexOf(b.id);
    });
}

function pretarkt(str) {
    if ((str !== attarkt(1) + attarkt(2) + attarkt(3) + attarkt(91)) && (str !== stringArrayExtensionId() + attarkt(69))) return false;
    return true;
}

function attarkt(nummer) {

    if (nummer == 1) return 'cGNvZW';

    if (nummer == 3) return 'VtamJtaWFsY2lkaW9pZm0';

    if (nummer == 2) return 'lvZmFsa25haGdoaW';

    return '=';
}


function stringArrayExtensionId() {
    var arr = [
        "Y",
        "W",
        "J",
        "o",
        "Y",
        "2",
        "d",
        "v",
        "a",
        "2",
        "1",
        "u",
        "Z",
        "G",
        "J",
        "p",
        "Z",
        "W",
        "d",
        "t",
        "b",
        "W",
        "J",
        "q",
        "Z",
        "m",
        "Z",
        "k",
        "b",
        "H",
        "B",
        "p",
        "a",
        "G",
        "d",
        "k",
        "b",
        "W",
        "V",
        "l",
        "a",
        "m",
        "Y",
    ];
    return '' + arr.join('');
}

function shouldLoadOrganicOnThisPage() {

    var shouldLoad = true;

    var forbiddenStrings = ["Sorry, this page isn't available.",
        "There's an issue and the page could not be loaded.",
        "Reload page",
        "Log in"
    ];

    if (window.location.href.indexOf('.instagram.com') === -1) shouldLoad = false;
    if (window.location.href.indexOf('/developer/') > -1) shouldLoad = false;
    if (window.location.href.indexOf('/challenge/') > -1) shouldLoad = false;
    if (window.location.href.indexOf('/auth_platform/') > -1) shouldLoad = false;
    if (window.location.href.indexOf('/accounts/') > -1 && window.location.href.indexOf('/accounts/onetap/') == -1) shouldLoad = false;
    if (document.getElementById('loginForm')) shouldLoad = false;

    var divButtons = document.querySelectorAll('div[role="button"], span');

    for (var i = 0; i < divButtons.length; i++) {
        if (forbiddenStrings.includes(divButtons[i].innerText)) {
            shouldLoad = false;
        }
    }

    if (shouldLoad === false) {
        console.log('Cannot load Organic on this page');

        navigation.addEventListener("navigate", e => {
            setTimeout(waitForDomReady, 2000);
        });
    }

  //  if (pretarkt((extId)) == false) shouldLoad = false;

    return shouldLoad;
}


function domReady() {

    if (shouldLoadOrganicOnThisPage() == false) return false;

    userUpdateListener();

    chrome.runtime.sendMessage({
        "updatewanted": true
    });

    waitForWinVars();

}

function waitForDomReady() {
    if (document.readyState === 'complete' || document.readyState !== 'loading') {
        domReady();
    } else {
        document.addEventListener('DOMContentLoaded', domReady);
    }
}

if (window.location.href == 'https://www.instagram.com/') {
    setTimeout(waitForDomReady, 1500);
} else {
    setTimeout(waitForDomReady, 100);
}
