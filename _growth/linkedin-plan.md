# LinkedIn plan: 8 weeks, one post a week

Drafts for Yochai's personal LinkedIn. **Nothing here is scheduled or published.** Each post is also saved as an unscheduled draft in Typefully (account "Yochai Edlitz Ph.D"), titled `MLAIA LinkedIn W1` … `W8`.

Every post is built on one live page and makes only claims that page makes. Every link carries `?utm_source=linkedin&utm_medium=social` so the visits show up as LinkedIn in Analytics. When a link points to a section of a page, the UTM goes before the `#`.

## Schedule

The suggested slot is Tuesday morning, Israel time. Weeks 7 and 8 move past the holiday weeks.

| Week | Suggested date | Asset | Link |
|------|----------------|-------|------|
| 1 | Tue 10 Nov 2026 | Audio Lab: all six experiments | /audio-ai/lab/ |
| 2 | Tue 17 Nov | Lab experiment 04: bearing fault and envelope analysis | /audio-ai/lab/#vibration * |
| 3 | Tue 24 Nov | Clinical model validation | /medical-ai/clinical-model-validation/ |
| 4 | Tue 1 Dec | Demand forecasting for intermittent items | /predictive-intelligence/demand-forecasting/ |
| 5 | Tue 8 Dec | Lab experiment 05: sound event detection | /audio-ai/lab/#sound-events * |
| 6 | Tue 15 Dec | Prediction Explorer: SHAP is not causation | /predictive-intelligence/explorer/ |
| 7 | Tue 5 Jan 2027 | Lab experiment 06: speech enhancement | /audio-ai/lab/#spectral-subtraction * |
| 8 | Tue 12 Jan 2027 | Clinical data de-identification | /medical-ai/clinical-data-deidentification/ |

\* **Per-demo pages are pending.** The site design session is building a separate page for each lab demo. Until those pages are live, posts 2, 5 and 7 link to the lab hub with an anchor to the experiment. When a demo page goes live before its post date, swap in its URL (keep the UTM) in this file and in the Typefully draft.

The weeks alternate between the three practices: audio (1, 2, 5, 7), medical (3, 8) and forecasting and causal analysis (4, 6).

## Before posting each one

- Open the link and check that the page still says what the post says.
- Paste the URL into LinkedIn's Post Inspector (https://www.linkedin.com/post-inspector/) to check the preview card.
- Optional: LinkedIn tends to show posts with links to fewer people. If you prefer, move the link to the first comment. Typefully has a "first comment" setting for that.
- Stay around for the first hour to answer comments.

---

## Week 1: The Audio Lab

**Asset:** https://www.mlaia.com/audio-ai/lab/

> When I explain audio systems to product teams, the same six ideas come up again and again. So we built them as experiments you can run in a browser:
>
> 01 Filter a tone out of hiss and watch what a low-pass filter costs the signal
> 02 Steer a microphone array between two sources
> 03 Cancel a 180 Hz hum by tuning phase and amplitude
> 04 Find a bearing fault that the overall vibration level hides
> 05 Tune a sound-event detector, and see hits trade against false alarms
> 06 Clean a noisy recording with spectral subtraction, and hear where it starts to distort
>
> Every signal is synthetic and generated in your browser. Every number shown is computed from those signals. There's no microphone access and nothing is uploaded. Each experiment also says exactly what it models and what it leaves out.
>
> https://www.mlaia.com/audio-ai/lab/?utm_source=linkedin&utm_medium=social
>
> Corrections from people who do this for a living are welcome.
>
> #SignalProcessing #DSP #Acoustics #AudioAI

---

## Week 2: Bearing fault and envelope analysis

**Asset:** Lab experiment 04. Link to the per-demo page when it exists.

> An early bearing defect barely moves a machine's overall vibration level. If you alarm on RMS, you'll miss it.
>
> The defect is there, though. Each ball strikes it and rings a structural resonance, in our demo at 3 kHz. Band-pass around that resonance, take the envelope, then the spectrum of the envelope, and a line appears at the outer-race fault frequency, with its harmonics.
>
> With the bearing geometry and the shaft speed, you know where that line should be before you look. For the nine-ball bearing in the demo it's about 3.59 times shaft speed.
>
> That physics-first step is also what makes machine learning trustworthy here. Labelled faults are rare, so an anomaly model needs a baseline you can explain.
>
> Add the defect, raise it slowly, and watch which readout moves first:
>
> https://www.mlaia.com/audio-ai/lab/?utm_source=linkedin&utm_medium=social#vibration
>
> #PredictiveMaintenance #VibrationAnalysis #ConditionMonitoring #MachineLearning

---

## Week 3: Clinical model validation

**Asset:** https://www.mlaia.com/medical-ai/clinical-model-validation/

> Most clinical prediction models look better in development than they will in the clinic. Usually that comes from the evaluation, not the model.
>
> Four things we check first:
>
> 1. Leakage. Features recorded after the prediction time, or codes entered because of the diagnosis.
> 2. Splitting by record. Visits from one patient are correlated. Split by record and the model learns to recognise patients. Split by patient, and by site or time when the question is whether the model transfers.
> 3. Dataset shift. A new hospital brings different patients, devices and coding habits. Calibration often drifts first, and cross-validation on development data can't measure it.
> 4. Shortcuts. Markers of the hospital or device that happen to correlate with the outcome.
>
> In my own published work on type 2 diabetes risk scores (eLife, 2022), the scores were built on UK Biobank and validated externally on a separate health system's records. Validation like that runs through every project we take on.
>
> https://www.mlaia.com/medical-ai/clinical-model-validation/?utm_source=linkedin&utm_medium=social
>
> #MedicalAI #ClinicalAI #ModelValidation #DigitalHealth

---

## Week 4: Forecasting intermittent demand

**Asset:** https://www.mlaia.com/predictive-intelligence/demand-forecasting/

> Most items in a typical catalogue don't sell every week. Methods built for smooth demand treat the empty weeks as noise. For slow movers, the empty weeks are the pattern.
>
> That's where min/max rules and simple averages go wrong. Croston's method forecasts two things separately: the size of a demand when it happens, and the interval between demands. TSB goes further and updates the probability of demand every period, so it reacts when an item is going obsolete.
>
> Neither predicts which week the next order arrives. What they give you is a steady rate, and a range, to set reorder points and safety stock against.
>
> Before forecasting, we group items by how often they sell and how much order sizes vary, and each group gets methods suited to it.
>
> https://www.mlaia.com/predictive-intelligence/demand-forecasting/?utm_source=linkedin&utm_medium=social
>
> #DemandForecasting #SupplyChain #InventoryManagement #TimeSeries

---

## Week 5: Sound event detection

**Asset:** Lab experiment 05. Link to the per-demo page when it exists.

> The same threshold detector can look excellent or useless. What changes it is the feature it watches.
>
> In this experiment, the scene has eight targets (four knocks, four beeps) and two low-frequency rumbles that should not trigger anything. Watch broadband energy and the rumbles can cross the threshold. Watch 1–6 kHz band energy instead and the rumbles mostly fall outside what the detector sees.
>
> This is a classical energy detector, not a trained model. A learned detector replaces the feature and the threshold, but the trade-off between hits and false alarms doesn't go away. On a phone or a wearable, a cheap first stage like this often decides when the bigger model even runs.
>
> Lower the threshold until the false alarms start:
>
> https://www.mlaia.com/audio-ai/lab/?utm_source=linkedin&utm_medium=social#sound-events
>
> #EdgeAI #AudioAI #SoundEventDetection #EmbeddedML

---

## Week 6: Explanations are not causes

**Asset:** https://www.mlaia.com/predictive-intelligence/explorer/

> A churn model says a customer with fewer late payments is less likely to leave. Does that mean a payment reminder would keep them?
>
> Not necessarily. Changing a model input changes the prediction. It doesn't tell you what an intervention would do.
>
> SHAP values explain a model relative to its background data. They don't establish causes. To learn whether an action works you need an experiment, or a causal design with its assumptions stated.
>
> We built a small explorer on synthetic customers to show the difference. Pick a customer, read the SHAP contributions, change the profile, then move the decision threshold and watch false alarms trade against missed churners.
>
> https://www.mlaia.com/predictive-intelligence/explorer/?utm_source=linkedin&utm_medium=social
>
> #CausalInference #ExplainableAI #ChurnPrediction #DataScience

---

## Week 7: Speech enhancement and "musical noise"

**Asset:** Lab experiment 06. Link to the per-demo page when it exists.

> Spectral subtraction is one of the oldest noise-reduction methods, and still one of the best for teaching the trade-off.
>
> Estimate the noise spectrum from a stretch with no speech, subtract it from every frame, resynthesise. SNR goes up. Push the subtraction harder and SNR keeps rising, but the speech starts to distort and the leftover noise turns into "musical noise": short tonal blips.
>
> With fluctuating noise, the fixed estimate goes stale. That's where adaptive estimators and trained models earn their place.
>
> In the experiment you can hear the clean, noisy and enhanced versions, and see SNR and speech distortion measured side by side. The signal is speech-like and synthetic, not a recording.
>
> https://www.mlaia.com/audio-ai/lab/?utm_source=linkedin&utm_medium=social#spectral-subtraction
>
> #SpeechEnhancement #NoiseReduction #DSP #AudioAI

---

## Week 8: Clinical data de-identification

**Asset:** https://www.mlaia.com/medical-ai/clinical-data-deidentification/

> De-identified, pseudonymised, anonymous. The words are often used as if they meant the same thing. They don't, and the difference decides which rules apply to the data.
>
> • De-identified: identifiers removed or transformed so records aren't readily linked to a person. HIPAA describes two routes, Safe Harbor and Expert Determination.
> • Pseudonymised: identifiers replaced with codes, and whoever holds the key can still link back. Under the GDPR it is still personal data.
> • Anonymous: the bar is higher still.
>
> When we build a de-identification workflow for records, free-text notes or images, we measure two things: what it misses, and what it removes that the research needed. It can run inside the hospital's own environment.
>
> https://www.mlaia.com/medical-ai/clinical-data-deidentification/?utm_source=linkedin&utm_medium=social
>
> #HealthData #Privacy #MedicalAI #ClinicalResearch

---

## Content check

All eight posts were checked against the binding content rules:

- Each claim is taken from the linked live page.
- No client names, no customer IP, no patent numbers, no Kotleak, no road-noise or car-cabin detail.
- No NextDemand numbers or backtest results. Week 4 doesn't mention NextDemand at all.
- No TailorPath, and no AI agents or Ultrabot.
- Week 3 cites Yochai's own published paper (Edlitz & Segal, eLife 2022), which the medical pages already cite.
