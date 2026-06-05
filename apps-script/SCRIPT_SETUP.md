# Marketing Dashboard — One-Time Setup

Total time: ~20 minutes. You only do this once.

---

## Step 1 — Create the Google Sheet (manual data)

1. Create a new Google Sheet and name it **Marketing KPIs — Manual Data**
2. Rename the first tab to `Manual Data`
3. Add these rows exactly (Column A = key, Column B = your current value):

| Column A (key)           | Column B (value)     |
|--------------------------|----------------------|
| lp_conversion            | 12.4                 |
| blog_to_sub_conversion   | 1.1                  |
| practitioner_pct         | 76                   |
| organic_growth_pct       | 68                   |
| content_shipped          | 8                    |
| li_posts_per_week        | 2.8                  |
| vendor_impact_briefs     | in-progress          |
| advisory_inquiries       | on-track             |
| speaking                 | tbd                  |
| podcast                  | tbd                  |

**Status values:** `on-track` · `in-progress` · `behind` · `done` · `tbd`

4. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**THIS_PART**`/edit`

5. Copy the shareable link: Share → Anyone with link → Copy

---

## Step 2 — Create the Apps Script

1. Go to [script.google.com](https://script.google.com) → **New project**
2. Name it: `Marketing KPIs Data`
3. Delete all existing code in `Code.gs`
4. Paste the entire contents of `marketing-data.js` (from this folder)
5. Save (Cmd+S)

---

## Step 3 — Add your API keys (Script Properties)

In the Apps Script editor: **Project Settings (gear icon) → Script Properties → Add row**

| Property         | Value                                               |
|------------------|-----------------------------------------------------|
| `ML_API_KEY`     | MailerLite → Integrations → API → Copy your key    |
| `GA4_PROPERTY_ID`| GA4 → Admin → Property Settings → Property ID      |
| `SHEET_ID`       | The Sheet ID from Step 1                            |
| `SHEET_URL`      | The shareable link from Step 1                      |
| `Q1_END_SUBS`    | Your subscriber count as of March 31, 2026          |

---

## Step 4 — Enable GA4 access

In the Apps Script editor:
1. Left sidebar → **Services** (+ icon)
2. Find **Google Analytics Data API** → Add
3. This lets the script read your GA4 data

---

## Step 5 — Test it

1. In the editor, select function `buildData` from the dropdown → **Run**
2. Click **View → Logs** — you should see subscriber count and no errors
3. If you see a GA4 error, check that the GA4 Property ID is numeric (not "G-XXXXXXXX")

---

## Step 6 — Deploy as a web app

1. **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone** (this is safe — it only reads data, no API keys exposed)
5. Click **Deploy** → copy the web app URL

---

## Step 7 — Connect the dashboard

Open `marketing-dashboard.html` in a text editor. Near the bottom, find:

```javascript
var SCRIPT_URL = '';
```

Replace with:

```javascript
var SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
```

Save the file, commit, and push — the dashboard will now show live data.

---

## Step 8 — Set up auto-refresh (optional but recommended)

In the Apps Script editor:
1. Left sidebar → **Triggers** (clock icon)
2. **Add trigger**
3. Function: `scheduledRefresh`
4. Event source: **Time-driven**
5. Type: **Day timer** → 7am–8am

This refreshes the data cache daily so the dashboard loads instantly.

---

## Adjustments you may need

**Blog path in GA4** — if your blog isn't at `/blog/...` in GA4, edit line ~95 in `marketing-data.js`:
```javascript
value: '/blog'   // change to match your WordPress blog path
```

**Report download event name** — if you track downloads differently in GA4, edit lines ~109–113.

**MailerLite campaign type** — if you also want to include automation emails in CTOR, remove `&filter[type]=regular` from the campaigns API call.

---

## Updating manual data

Tell the team: bookmark the Google Sheet. Update the numbers in **Column B** — the dashboard reflects changes on next refresh (or click Refresh on the dashboard).
