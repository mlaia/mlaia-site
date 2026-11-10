# AI-engine visibility tracker

Weekly check of how often ChatGPT, Perplexity and Gemini cite mlaia.com,
nextdemand.ai and ultrabot.ai, plus the traffic those assistants actually send.

## What is in here

| File | Purpose |
|---|---|
| `prompts.json` | 13 fixed prompts (6 MLAIA, 4 NextDemand, 3 Ultrabot) and the domains/names that count as a hit. Keep the set stable so weeks are comparable; add prompts at the end. |
| `check.py` | Asks each engine every prompt and records `cited` (our domain in the citation list), `mentioned` (brand or domain in the answer text) and the citation rank. Writes `results/<date>.json` and appends `log.csv`. |
| `ga4_ai_referrals.py` | Pulls sessions whose medium is `ai-assistant` or whose source is a known assistant domain, per GA4 property, and appends `ga4_log.csv`. |
| `manual_readings.csv` | Numbers that have no API path for us yet (Search Console generative-AI report, hand-read GA4), one row per reading. |

## Weekly routine (about 10 minutes)

1. Engines. With the keys exported, run:

       python3 _growth/ai-visibility/check.py

   Engines without a key are skipped. Keys: `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY`.
   Models default to `gpt-5`, `sonar`, `gemini-2.5-flash`; override with `OPENAI_MODEL`, `PERPLEXITY_MODEL`, `GEMINI_MODEL` if a name is retired.
   Cost per run is a few cents per engine. Answers change run to run, so read trends over weeks, not single runs.

2. GA4 referrals:

       python3 _growth/ai-visibility/ga4_ai_referrals.py

   Needs Application Default Credentials with the `analytics.readonly` scope (command in the script docstring). NextDemand's property is intentionally excluded.

3. Search Console generative-AI report (no API yet). Read "Total impressions" and the top pages for each property and add rows to `manual_readings.csv`:
   - https://search.google.com/search-console/performance/search-analytics/ai?resource_id=https%3A%2F%2Fwww.mlaia.com%2F&num_of_days=28
   - https://search.google.com/search-console/performance/search-analytics/ai?resource_id=https%3A%2F%2Fnextdemand.ai%2F&num_of_days=28
   - https://search.google.com/search-console/performance/search-analytics/ai?resource_id=sc-domain%3Aultrabot.ai&num_of_days=28

4. Compare with the previous week: citation rate per brand per engine from `log.csv`, AI sessions share from `ga4_log.csv`, AI-feature impression share from `manual_readings.csv`.

## What to do with the results

- A prompt that is never cited but matches a page we have: improve that page's first paragraph so it answers the prompt directly, and add the question to its FAQ structured data.
- A prompt cited by one engine and not another: usually freshness or crawl access; check robots and `llms.txt` list the page.
- Rising AI-feature impressions with flat clicks is normal; the GA4 referral count is the number that shows whether the citations turn into visits.

## Baseline (2026-11-10)

- Google AI features: mlaia 1,970 of 8,070 impressions (24%), NextDemand 306 of 1,290 (24%), Ultrabot 28 of 142.
- GA4 mlaia, 28 days: ChatGPT 19 sessions of 99 (third source after direct and Google), Gemini 2. Ultrabot: none yet.
- Engine citation rates: not yet measured (no API keys in place when this was set up).
