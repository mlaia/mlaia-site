# Valuable traffic on mlaia.com

Internal note (the `_growth/` folder is not served by GitHub Pages). Last updated 2026-11-10.

## Definition

A visit is valuable when the visitor does at least one of these:

1. **Contacts us**: clicks the contact CTA, sends the inquiry form, or opens the WhatsApp link (`wa.me/972524846282`, the only WhatsApp number on the site).
2. **Uses a demo**: opens talk.mlaia.com, or touches a control in the audio lab, the medical lab or the causal lab.
3. **Reads an article deeply**: stays on an article page for 45 seconds or more and scrolls past 60% of it.

Everything else (a bounce, a skim, a crawler) is traffic, not valuable traffic. The share of sessions that reach one of these actions, by source, is the number the growth programme is judged on.

## Events

GA4 property "MLAIA Website", measurement id G-1T3R1HL53V. GA loads only after analytics consent, so every event below is consent-gated. Each fires at most once per page view and carries `page_path` (pathname only, never a query string) and nothing personal.

| Event | Sent by | Fires when |
|---|---|---|
| `contact_cta_click` | `site-shell.js` / `practice.js` | A link to `#contact` is clicked. |
| `generate_lead` | `site-shell.js` / `practice.js` | The inquiry form is sent successfully. |
| `demo_click` | `site-shell.js` / `practice.js` | A link to talk.mlaia.com is clicked. |
| `demo_ask` | `practice.js` | The AI Agents question box is submitted on the homepage. |
| `whatsapp_click` | `analytics-events.js` | A link to wa.me is clicked. |
| `lab_interaction` | `analytics-events.js` | First input, change or button click inside a `.lab-experiment` / `.lab-controls` block. Params: `lab` = audio, medical or causal (from the path); `demo` = the page slug, or the experiment section id on a lab hub page. |
| `article_read` | `analytics-events.js` | A page with an `<article>` has been scrolled past 60% and the visitor has been on it for at least 45 seconds. |
| `outbound_github_click` | `analytics-events.js` | A link to github.com/mlaia is clicked. |
| `linkedin_click` | `analytics-events.js` | A link to linkedin.com is clicked. |

`analytics-events.js` is inserted by `site-shell.js` on every page that carries the shell, only when the stored consent allows analytics or when consent is given during the visit.

## Key events to mark in GA4 (Admin → Events, toggle "Mark as key event")

Done by hand in the GA4 interface, not by code:

- `contact_cta_click`
- `whatsapp_click`
- `demo_click`
- `lab_interaction`

`generate_lead` is already a recommended GA4 event name and should stay marked too. Do not mark `article_read`, `outbound_github_click` or `linkedin_click` as key events: they are engagement signals, and marking them would inflate the conversion rate.

## The three weekly numbers

Reported every Monday for the previous full week, with the same week a year earlier when available.

1. **Key events per 100 sessions, by source.** Explore → free form; rows = session source / medium (plus the `utm_source` of LinkedIn posts); metrics = sessions, key events; derived = key events ÷ sessions × 100. This is the valuable-traffic rate. Sources with fewer than 20 sessions are grouped as "other".
2. **AI-assistant sessions.** Sessions whose source is an AI assistant (chatgpt.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com, and the GA4 "generative AI" channel where available). Report the count, its share of all sessions, and its key-events-per-100 rate from number 1.
3. **Engaged sessions on practice pages.** Engaged sessions (GA4's definition: 10 seconds or more, a key event, or two or more page views) where the landing page or any page in the session is under `/audio-ai/`, `/medical-ai/`, `/predictive-intelligence/` or `/ai-adoption/` (and their `/lab/` subpages). Report the count and the engagement rate for those pages against the site average.

A week is good when number 1 rises for the sources we invest in (organic search, LinkedIn, AI assistants) without the total session count falling.
