# Growth plan: valuable traffic from Google and AI assistants

Owner: the MLAIA SEO and growth coordinator session. Reviewed and updated every week; the changelog at the bottom records what changed and why. Sites: mlaia.com, nextdemand.ai, ultrabot.ai.

## 1. Goal

Not rankings for their own sake: **visitors who are likely to become customers**, measured as
key events per 100 sessions, by source. A key event is a contact CTA click, a WhatsApp click,
a demo click (talk.mlaia.com) or a first interaction with a lab demo. Rankings and AI citations
are the levers; the scorecard below is the result.

## 2. Weekly scorecard

Read every Monday from Search Console (both mlaia properties, NextDemand, Ultrabot), Bing
Webmaster Tools (Chrome, always with `siteUrl`), GA4 (mlaia `530669054`, Ultrabot `561722932`;
NextDemand's GA is not touched) and the AI-visibility tracker in `_growth/ai-visibility/`.

| Metric (28 days) | 2026-11-10 baseline | Target end Jan 2027 |
|---|---|---|
| mlaia Google clicks / impressions | 82 / 8,070 | 250 / 20,000 |
| mlaia Google AI-feature impressions (share) | 1,970 (24%) | 6,000 (30%) |
| mlaia GA4 sessions from AI assistants | 21 (ChatGPT 19, Gemini 2) | 80 |
| mlaia key events per 100 sessions | not yet measured (events ship this week) | 4 |
| mlaia queries at position 1–3 with CTR under 2% | 4 (tabular cluster) | 0 |
| mlaia pages indexed vs in sitemap | 71 in sitemap; 13 pending | all indexed |
| NextDemand Google clicks / position | 18 / 19.6 | 80 / under 12 |
| NextDemand AI-feature impressions | 306 | 1,000 |
| NextDemand pages "discovered, not indexed" | 6 | 0 |
| Ultrabot Google clicks / impressions | 0 / 142 | 30 / 1,500 |
| Ultrabot GA4 AI-assistant sessions | 0 | 10 |
| Bing impressions mlaia / Ultrabot | 101 / 12 | 600 / 150 |
| Tracker: prompts cited (of 13) ChatGPT / Perplexity / Gemini / Claude | not run yet (keys needed) | 7 / 7 / 7 / 7 |

## 3. Why these levers (what the data showed on 2026-11-10)

- The pages assistants cite and Google clicks are the ones that answer the title's question in the first paragraph with a measured number (tabular article, music AI post). Most other pages open with context.
- A quarter of Google impressions are already in AI Overviews and AI Mode; ChatGPT is mlaia's third traffic source. Assistant visibility is growing faster than classic rankings.
- ChatGPT searches through Bing's index, where mlaia is nearly invisible (101 impressions vs 8,070 on Google). Bing coverage is the gate to ChatGPT.
- Assistants corroborate across sources. Only mlaia.com and LinkedIn name MLAIA today; there is no third-party list to quote.
- NextDemand's AI exposure is one wiki page. Depth there compounds.
- Position 2 with zero clicks (tabular cluster) is a snippet problem, not a ranking problem.

## 4. Workstreams and checklist

Status marks: `[ ]` not started, `[~]` in progress (owner in brackets), `[x]` done (date), `[-]` dropped (reason).

### A. Answer-first pages (Google snippets and assistant citations)
- [x] Tabular article: query-matched title, answer-first description, FAQ (2026-11-09, PR #75)
- [~] Medical AI lab: six demos + hub answer-first, FAQ, updated dates [med-answer-first session]
- [~] Tabular article: TabNet, boosted-tree-framework and DNN-vs-GBDT question sections [tabular-causal session]
- [~] Causal lab: hub + five demos answer-first, FAQ [tabular-causal session]
- [ ] Audio lab: six demos + hub answer-first, FAQ (next week)
- [ ] Practice hubs (audio, medical, predictive, AI adoption): answer-first paragraph, FAQ, Organization sameAs
- [ ] Every content page: visible "Updated" date and dateModified kept in sync

### B. Win the clusters we already rank for
- [~] Sound event detection page + acoustic wiki page answer-first [sed-page session]
- [ ] Spare parts forecasting: mlaia guide hands off to a deep NextDemand page
- [ ] Brand CTR: homepage title leads with the name; Organization schema with LinkedIn sameAs; Google Business Profile video verification (Yochai)
- [ ] Daily Search Console indexing requests until the 13 new mlaia pages and 6 NextDemand pages are indexed

### C. Be in the indexes assistants use
- [x] Bing coverage checked (2026-11-10): 60 of 71 mlaia URLs indexed, last crawls late Sept to 24 Oct, sitemap copy had 58 URLs; sitemap resubmitted and accepted; IndexNow log shows all 71 URLs received. Ultrabot sitemap: 26 URLs, success.
- [ ] Bing URL Submission is unavailable for mlaia because the site is a read-only import from Search Console; verify mlaia.com directly in Bing (DNS CNAME at LiveDNS or meta tag; Yochai) to unlock URL Submission and faster crawl
- [ ] Re-check Bing index count weekly until the November pages appear
- [ ] Add PerplexityBot, OAI-SearchBot, Google-Extended explicitly to mlaia and Ultrabot robots.txt (NextDemand already has them)
- [ ] llms.txt: one-line answer per page, not only titles; keep current after every merge
- [ ] IndexNow after every merge (standing)

### D. Corroborating sources (entity and authority)
- [ ] Directory profiles with one consistent description: Clutch, GoodFirms, Crunchbase, Israeli startup directories (listings session has the list in `_growth/listings.md`)
- [ ] LinkedIn company page products and media complete (products submitted 2026-11-10; media by hand)
- [ ] Two guest pieces or interviews naming MLAIA with practice areas
- [ ] Public GitHub repo per benchmark (tabular done; next ones with each "we ran it" article)
- [ ] Answers on Cross Validated and relevant subreddits where a demo or article is the genuine answer
- [ ] "Israel AI consulting landscape" page listing real firms by specialty, MLAIA in its lane

### E. Original content assistants must cite ("we ran it")
- [x] TabPFN vs XGBoost benchmark + cost-sensitive thresholds (2026-11-08, PR #74)
- [ ] Audio: classical vs neural noise suppression on a public noisy-speech set
- [ ] Medical: calibration drift across prevalence on a public clinical dataset
- [ ] NextDemand: Croston vs SBA vs ML on a public intermittent-demand set
- [ ] One per month thereafter, each with scripts in the repo and a LinkedIn post

### F. NextDemand
- [~] Wiki depth (lumpy demand, ADI/CV², SBA/TSB, safety stock) + safety stock calculator [nextdemand-wiki session]
- [ ] Six "discovered, not indexed" pages: internal links + indexing requests
- [ ] Spare parts deep page (see B)

### G. Ultrabot (owned by the Ultrabot session; coordinator sends the brief)
- [ ] Three deep Hebrew pages: voice agent for clinics, for e-commerce, for municipalities
- [ ] "Agentic AI pilot to production" article extended with a measured case
- [ ] FAQ schema on all pages; Google Business Profile; indexing requests

### H. Measurement
- [~] GA4 events: whatsapp_click, lab_interaction, article_read, outbound clicks [traffic-events session]
- [ ] Mark key events in GA4 (contact_cta_click, whatsapp_click, demo_click, lab_interaction) after the events ship
- [ ] AI-visibility tracker merged (PR #76); API keys for OpenAI, Perplexity, Gemini (Yochai); add Claude as a fourth engine
- [ ] Weekly run of the tracker + scorecard update in this file

### I. Distribution
- [x] LinkedIn: 15 posts scheduled through 2027-01-12 (Tuesdays + Thursdays)
- [ ] Medical lab invitation post (text ready; Yochai posts as MLAIA and reshares)
- [ ] Each new "we ran it" article gets a post within a week of publishing

## 5. Weekly review ritual (Monday, about 30 minutes)

1. Read the scorecard sources; fill a new column in section 2 (keep the last 8 weeks).
2. For each metric that moved the wrong way, write one line in the changelog on the likely cause.
3. Run the tracker; for every prompt never cited in 3 weeks, schedule the matching page for an answer-first rewrite or a corroborating source.
4. Pull the Search Console query report for new zero-click queries at positions 1 to 7; add them to workstream B.
5. Update checklist states; start or re-brief the sessions for the week's items.
6. Post the week's note to Yochai with the three numbers: key events per 100 sessions, AI-assistant sessions, prompts cited.

## 6. Coordination rules

- Each workstream runs in its own session and worktree and ends in a PR; the coordinator merges only on Yochai's OK.
- The coordinator owns `sitemap.xml`, `llms.txt`, `feed.xml`, JSON-LD conventions and IndexNow; the design session owns `assets/site-shell.*` and page design; the Ultrabot session owns ultrabot.ai and talk.mlaia.com.
- Content rules apply to every session: no client names, no patent numbers, no client project details, no customer numbers; every figure traceable to a demo default, our own published run or a cited source.
- Generated pages are edited only through their generators (`_tools/lab-pages/*.py`, `_tools/audio-pages/render_audio.py`, `_tools/prediction-pages/`).

## Changelog

- 2026-11-10: Bing audit: delivery via IndexNow works, crawl is the bottleneck; URL Submission needs direct site verification.
- 2026-11-10: plan created from the first full reading of Search Console, Bing, GA4 and the generative-AI report. Five sessions started (A medical, A/B tabular + causal, B sound event detection, H GA4 events, F NextDemand). Tracker opened as PR #76.
