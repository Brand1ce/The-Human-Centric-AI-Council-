// ════════════════════════════════════════════════════════════════════════
// Kyle & Co — Marketing KPIs Data Service
// Google Apps Script — paste this into script.google.com
//
// SETUP: See SCRIPT_SETUP.md in the apps-script/ folder for step-by-step.
// ════════════════════════════════════════════════════════════════════════

// ── Script Properties (set these in Project Settings → Script Properties) ──
// ML_API_KEY       : MailerLite API key (from MailerLite → Integrations → API)
// GA4_PROPERTY_ID  : numeric GA4 property ID (e.g. "123456789")
// SHEET_ID         : Google Sheet ID (the long ID from the sheet's URL)
// SHEET_URL        : full shareable URL of the sheet (shown to team as "Edit manual data")
// Q1_END_SUBS      : subscriber count on March 31 — enter once, never changes
// Q4_END_SUBS      : subscriber count on Dec 31 2025 — for QoQ reference

var PROPS = PropertiesService.getScriptProperties();

var ML_KEY        = PROPS.getProperty('ML_API_KEY');
var GA4_ID        = PROPS.getProperty('GA4_PROPERTY_ID');
var SHEET_ID      = PROPS.getProperty('SHEET_ID');
var Q1_END_SUBS   = parseInt(PROPS.getProperty('Q1_END_SUBS'))  || 0;

var Q2_START = '2026-04-01';
var YTD_START = '2026-01-01';

// ── Entry point (called when dashboard fetches the URL) ──────────────────
function doGet(e) {
  var data;
  try {
    data = buildData();
  } catch (err) {
    Logger.log('buildData error: ' + err);
    data = { error: err.toString(), lastUpdated: new Date().toISOString(), isDemo: false };
  }

  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function buildData() {
  var today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
  var errors = {};

  var email = {};
  try { email = getMailerLiteData(today); } catch(e) { errors.mailerlite = e.toString(); Logger.log('ML error: ' + e); }

  var web = {};
  try { web = getGA4Data(today); } catch(e) { errors.ga4 = e.toString(); Logger.log('GA4 error: ' + e); }

  var manual = {};
  try { manual = getManualData(); } catch(e) { errors.sheet = e.toString(); Logger.log('Sheet error: ' + e); }

  // Surface config issues as errors
  if (!ML_KEY)  errors.mailerlite = errors.mailerlite || 'ML_API_KEY not set in Script Properties';
  if (!GA4_ID)  errors.ga4        = errors.ga4        || 'GA4_PROPERTY_ID not set in Script Properties';
  if (!SHEET_ID) errors.sheet     = errors.sheet      || 'SHEET_ID not set in Script Properties';

  return {
    email: {
      totalSubscribers:    email.totalSubscribers    || null,
      netNewQ2:            manual.q2NewSubs           || null,
      qoqGrowth:           (manual.q2NewSubs && email.totalSubscribers)
                             ? (manual.q2NewSubs / (email.totalSubscribers - manual.q2NewSubs)) * 100
                             : null,
      avgOpenRate:         email.avgOpenRate         || null,
      broadcastCTOR:       email.broadcastCTOR       || null,
      practitionerPct:     manual.practitionerPct    || null,
      organicCount:        manual.organicCount        || null,
    },
    web: {
      blogViewsYTD:    web.blogViewsYTD    || null,
      liReferrals:     web.liReferrals     || null,
      reportDownloads: web.reportDownloads || null,
    },
    content: {
      contentShipped:  manual.contentShipped  || null,
    },
    milestones: {
      vendorImpactBriefs: manual.vendorImpactBriefs || 'tbd',
      advisoryInquiries:  manual.advisoryInquiries  || 'tbd',
      speaking:           manual.speaking           || 'tbd',
      podcast:            manual.podcast            || 'tbd',
    },
    _errors:     Object.keys(errors).length ? errors : undefined,
    lastUpdated: new Date().toISOString(),
    sheetUrl:    PROPS.getProperty('SHEET_URL') || '',
    isDemo:      false,
  };
}

// ── Diagnostic — run this in the editor to see exactly what's failing ──
function diagnose() {
  Logger.log('=== DIAGNOSTICS ===');
  Logger.log('ML_API_KEY set: '      + !!ML_KEY  + (ML_KEY  ? ' (length ' + ML_KEY.length  + ')' : ''));
  Logger.log('GA4_PROPERTY_ID set: ' + !!GA4_ID  + (GA4_ID  ? ' = ' + GA4_ID : ''));
  Logger.log('SHEET_ID set: '        + !!SHEET_ID + (SHEET_ID ? ' = ' + SHEET_ID : ''));
  Logger.log('Q1_END_SUBS: '         + Q1_END_SUBS);

  if (ML_KEY) {
    try {
      var res = UrlFetchApp.fetch('https://connect.mailerlite.com/api/subscribers?limit=1&filter[status]=active', {
        headers: { 'Authorization': 'Bearer ' + ML_KEY },
        muteHttpExceptions: true,
      });
      Logger.log('MailerLite response code: ' + res.getResponseCode());
      Logger.log('MailerLite body: ' + res.getContentText().substring(0, 300));
    } catch(e) { Logger.log('MailerLite exception: ' + e); }
  }

  if (GA4_ID) {
    try {
      var today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
      var token = ScriptApp.getOAuthToken();
      var url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + GA4_ID + ':runReport';
      var res = UrlFetchApp.fetch(url, {
        method: 'post',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        payload: JSON.stringify({ dateRanges: [{ startDate: '2026-01-01', endDate: today }], metrics: [{ name: 'sessions' }] }),
        muteHttpExceptions: true,
      });
      Logger.log('GA4 status: ' + res.getResponseCode());
      Logger.log('GA4 response: ' + res.getContentText().substring(0, 300));
    } catch(e) { Logger.log('GA4 exception: ' + e); }
  }
}

// ── Direct GA4 test — bypasses Advanced Service, calls API with raw OAuth token ──
// Run this to see the exact error from the API
function testGA4Direct() {
  var propId = PropertiesService.getScriptProperties().getProperty('GA4_PROPERTY_ID');
  var token  = ScriptApp.getOAuthToken();

  Logger.log('Property ID: ' + propId);
  Logger.log('Token length: ' + (token ? token.length : 'null'));

  var url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + propId + ':runReport';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'application/json',
    },
    payload: JSON.stringify({
      dateRanges: [{ startDate: '2026-01-01', endDate: '2026-06-08' }],
      metrics:    [{ name: 'sessions' }],
    }),
    muteHttpExceptions: true,
  });

  Logger.log('Status: '   + res.getResponseCode());
  Logger.log('Response: ' + res.getContentText().substring(0, 600));
}

// ════════════════════════════════════════════════════════════════════════
// MailerLite
// ════════════════════════════════════════════════════════════════════════
function getMailerLiteData(today) {
  var headers = { 'Authorization': 'Bearer ' + ML_KEY, 'Content-Type': 'application/json' };
  var opts = { headers: headers, muteHttpExceptions: true };

  function ml(path) {
    var res = UrlFetchApp.fetch('https://connect.mailerlite.com/api' + path, opts);
    var code = res.getResponseCode();
    if (code !== 200) {
      var msg = 'MailerLite ' + code + ' on ' + path + ': ' + res.getContentText().substring(0, 200);
      Logger.log(msg);
      throw new Error(msg);
    }
    return JSON.parse(res.getContentText());
  }

  // 1. Total active subscribers
  var totalSubs = 0;
  var cursor = null;
  for (var page = 0; page < 20; page++) {
    var url = '/subscribers?filter[status]=active&limit=1000';
    if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
    var pageData = ml(url);
    if (!pageData || !pageData.data) break;
    totalSubs += pageData.data.length;
    cursor = pageData.meta && pageData.meta.next_cursor ? pageData.meta.next_cursor : null;
    if (!cursor) break;
  }
  if (totalSubs === 0) totalSubs = null;
  Logger.log('ML total active: ' + totalSubs);

  // netNewQ2 and qoqGrowth come from the manual Google Sheet
  // (MailerLite's subscribed_at is unreliable — gets reset on reimport/reconfirm)
  // Update q2_new_subs in the sheet from MailerLite's Audience Growth report
  var netNewQ2  = null;
  var qoqGrowth = null;

  // 4. Q2 broadcast campaigns — open rate & CTOR
  var campaignsData = ml('/campaigns?filter[status]=sent&sort=-sent_at&limit=10');
  var campaigns = (campaignsData && campaignsData.data) ? campaignsData.data : [];

  // filter to Q2 only — MailerLite uses scheduled_for, not sent_at
  var q2campaigns = campaigns.filter(function(c) {
    var d = c.scheduled_for || '';
    return d.substring(0, 10) >= Q2_START;
  });

  var avgOpenRate = null;
  var broadcastCTOR = null;

  if (q2campaigns.length > 0) {
    var sumOpens = 0, sumClicks = 0;
    q2campaigns.forEach(function(c) {
      var s = c.stats || {};
      var opens  = parseInt(s.opens_count)  || 0;
      var clicks = parseInt(s.clicks_count) || 0;
      sumOpens  += opens;
      sumClicks += clicks;
    });
    broadcastCTOR = sumOpens > 0 ? (sumClicks / sumOpens) * 100 : null;
    Logger.log('ML Q2 campaigns: ' + q2campaigns.length + ' | opens: ' + sumOpens + ' | clicks: ' + sumClicks + ' | CTOR: ' + broadcastCTOR);
  }

  return {
    totalSubscribers: totalSubs,
    netNewQ2:         netNewQ2,
    qoqGrowth:        qoqGrowth,
    avgOpenRate:      avgOpenRate,
    broadcastCTOR:    broadcastCTOR,
  };
}

// ════════════════════════════════════════════════════════════════════════
// GA4 — calls Analytics Data API v1beta directly via OAuth token
// (The Advanced Service is not needed — UrlFetchApp + ScriptApp.getOAuthToken works)
// ════════════════════════════════════════════════════════════════════════
function getGA4Data(today) {

  function ga4Report(payload) {
    var token = ScriptApp.getOAuthToken();
    var url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + GA4_ID + ':runReport';
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code !== 200) throw new Error('GA4 ' + code + ': ' + res.getContentText().substring(0, 300));
    return JSON.parse(res.getContentText());
  }

  function firstMetric(report) {
    try { return parseInt(report.rows[0].metricValues[0].value) || 0; } catch (e) { return 0; }
  }

  // ── Blog page views YTD ──────────────────────────────────────────────
  // ADJUST: change '/blog' to match your WordPress blog path if different
  var blogReport = ga4Report({
    dateRanges: [{ startDate: YTD_START, endDate: today }],
    metrics: [{ name: 'screenPageViews' }],
    dimensionFilter: {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'BEGINS_WITH', value: '/blog' },
      }
    }
  });
  var blogViewsYTD = blogReport ? firstMetric(blogReport) : null;

  // ── LinkedIn referral sessions Q2 ────────────────────────────────────
  var liReport = ga4Report({
    dateRanges: [{ startDate: Q2_START, endDate: today }],
    metrics: [{ name: 'sessions' }],
    dimensions: [{ name: 'sessionSource' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 50,
  });
  var liSessions = 0;
  if (liReport && liReport.rows) {
    liReport.rows.forEach(function(row) {
      var src = (row.dimensionValues[0].value || '').toLowerCase();
      if (src.indexOf('linkedin') >= 0 || src.indexOf('lnkd.in') >= 0) {
        liSessions += parseInt(row.metricValues[0].value) || 0;
      }
    });
  }

  // ── Report / resource downloads Q2 ──────────────────────────────────
  // Matches 'resource_cta_click' (custom event) AND 'file_download' (auto GA4 event)
  // ADJUST event names if your GA4 uses different names
  var dlReport = ga4Report({
    dateRanges: [{ startDate: Q2_START, endDate: today }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      orGroup: {
        expressions: [
          { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'resource_cta_click' } } },
          { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'file_download' } } },
        ]
      }
    }
  });
  var reportDownloads = dlReport ? firstMetric(dlReport) : null;

  return {
    blogViewsYTD:    blogViewsYTD,
    liReferrals:     liSessions,
    reportDownloads: reportDownloads,
  };
}

// ════════════════════════════════════════════════════════════════════════
// Manual data from Google Sheet
//
// Sheet name: "Manual Data"
// Column A: key (exactly as listed below), Column B: value
//
// Keys:
//   practitioner_pct     (number — e.g. 78)
//   organic_count        (integer — e.g. 1180, your current organic core subscriber count)
//   vendor_impact_briefs (status: on-track | in-progress | behind | done | tbd)
//   advisory_inquiries     (status)
//   speaking               (status)
//   podcast                (status)
// ════════════════════════════════════════════════════════════════════════
function getManualData() {
  var defaults = {
    practitionerPct: null, organicCount: null,
    vendorImpactBriefs: 'tbd', advisoryInquiries: 'tbd', speaking: 'tbd', podcast: 'tbd',
  };

  if (!SHEET_ID) return defaults;

  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Manual Data');
    if (!sheet) { Logger.log('Sheet "Manual Data" not found'); return defaults; }

    var rows = sheet.getDataRange().getValues();
    var map  = {};
    rows.forEach(function(row) {
      if (row[0]) map[String(row[0]).trim()] = row[1];
    });

    function num(key) { var v = parseFloat(map[key]); return isNaN(v) ? null : v; }
    function str(key) { return map[key] ? String(map[key]).trim().toLowerCase() : 'tbd'; }

    return {
      q2NewSubs:          num('q2_new_subs'),
      practitionerPct:    num('practitioner_pct'),
      organicCount:       num('organic_count'),
      vendorImpactBriefs: str('vendor_impact_briefs'),
      advisoryInquiries:  str('advisory_inquiries'),
      speaking:           str('speaking'),
      podcast:            str('podcast'),
    };
  } catch (err) {
    Logger.log('Error reading manual sheet: ' + err);
    return defaults;
  }
}

// ── Campaign debug — run in editor to see what campaigns exist ────────
function debugCampaigns() {
  var opts = { headers: { 'Authorization': 'Bearer ' + ML_KEY }, muteHttpExceptions: true };
  var res = UrlFetchApp.fetch('https://connect.mailerlite.com/api/campaigns?filter[status]=sent&sort=-sent_at&limit=10', opts);
  Logger.log('Status: ' + res.getResponseCode());
  var body = JSON.parse(res.getContentText());
  if (body.data && body.data.length > 0) {
    Logger.log('=== Campaign top-level keys: ' + JSON.stringify(Object.keys(body.data[0])));
    body.data.forEach(function(c) {
      Logger.log('--- ' + c.name + ' | sent_at=' + c.sent_at + ' | scheduled_for=' + c.scheduled_for + ' | created_at=' + c.created_at + ' | updated_at=' + c.updated_at);
    });
  } else {
    Logger.log('No data: ' + JSON.stringify(body).substring(0, 300));
  }
}

// ── MailerLite debug — run in editor, check logs ─────────────────────
function debugML() {
  var opts = { headers: { 'Authorization': 'Bearer ' + ML_KEY }, muteHttpExceptions: true };
  var res = UrlFetchApp.fetch('https://connect.mailerlite.com/api/subscribers?limit=1&filter[status]=active', opts);
  Logger.log('Status: ' + res.getResponseCode());
  var body = JSON.parse(res.getContentText());
  Logger.log('meta: ' + JSON.stringify(body.meta));
  Logger.log('top-level keys: ' + Object.keys(body).join(', '));
}

// ── GA4 event inspector — run to see what events are tracked on your site ──
function debugGA4Events() {
  var token = ScriptApp.getOAuthToken();
  var url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + GA4_ID + ':runReport';

  // Top events site-wide (YTD)
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify({
      dateRanges: [{ startDate: '2026-01-01', endDate: '2026-12-31' }],
      dimensions: [{ name: 'eventName' }],
      metrics:    [{ name: 'eventCount' }],
      orderBys:   [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 30,
    }),
    muteHttpExceptions: true,
  });
  Logger.log('=== All GA4 events YTD ===');
  var body = JSON.parse(res.getContentText());
  if (body.rows) {
    body.rows.forEach(function(row) {
      Logger.log(row.dimensionValues[0].value + ': ' + row.metricValues[0].value);
    });
  } else {
    Logger.log(res.getContentText().substring(0, 400));
  }

  // Top pages by sessions (to identify LP path)
  var res2 = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify({
      dateRanges: [{ startDate: '2026-01-01', endDate: '2026-12-31' }],
      dimensions: [{ name: 'pagePath' }],
      metrics:    [{ name: 'sessions' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 20,
    }),
    muteHttpExceptions: true,
  });
  Logger.log('=== Top pages by sessions YTD ===');
  var body2 = JSON.parse(res2.getContentText());
  if (body2.rows) {
    body2.rows.forEach(function(row) {
      Logger.log(row.dimensionValues[0].value + ': ' + row.metricValues[0].value + ' sessions');
    });
  }
}

// ── Scheduled refresh (run daily via trigger) ─────────────────────────
// In Apps Script: Triggers → Add trigger → scheduledRefresh → Time-driven → Day timer
function scheduledRefresh() {
  try {
    var data = buildData();
    Logger.log('[scheduledRefresh] OK — subscribers: ' + (data.email && data.email.totalSubscribers));
  } catch (err) {
    Logger.log('[scheduledRefresh] ERROR: ' + err);
  }
}
