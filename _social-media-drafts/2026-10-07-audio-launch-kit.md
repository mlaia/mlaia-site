# Audio practice launch kit — October 2026

Drafts for launching the audio hub, the four topic pages and the interactive lab.
Every claim here comes from the live pages. Don't add client names, results or numbers the site doesn't state.

Each page has its own share image. Paste the URL and LinkedIn, X and WhatsApp pick it up.
Check a preview first with LinkedIn's Post Inspector: https://www.linkedin.com/post-inspector/

## Suggested schedule

| When | Channel | Link |
|------|---------|------|
| Week 1, Tue | LinkedIn company page: practice launch | /audio-ai/ |
| Week 1, Wed | Hacker News "Show HN": the lab | /audio-ai/lab/ |
| Week 1, Thu | r/DSP: the lab | /audio-ai/lab/ |
| Week 2 | LinkedIn personal: beamforming | /audio-ai/beamforming-microphone-arrays/ |
| Week 3 | LinkedIn personal: noise reduction & ANC | /audio-ai/noise-reduction-anc/ |
| Week 4 | LinkedIn personal: on-device audio AI | /audio-ai/edge-audio-ai/ |
| Week 5 | LinkedIn personal: vibration analysis | /audio-ai/vibration-analysis/ |

Post on Hacker News on a weekday morning, US Eastern time. Stay around for the first two hours to answer comments.

---

## 1. LinkedIn company post — practice launch

Most audio products are decided before the first line of model code: by the microphones, the enclosure, the latency budget and the room.

That's why MLAIA's Audio & Acoustics practice works on the signal chain and the model together. We cover acoustic measurement, classical DSP, machine learning and deployment on real devices.

We've published four topic pages, each with technical figures computed from the physics:

→ Microphone arrays & beamforming: why aperture and spacing set the limits
→ Noise reduction & ANC: why active noise cancellation is a low-frequency tool
→ On-device audio AI: where the milliseconds and the milliwatts actually go
→ Vibration analysis: finding the bearing fault a raw spectrum hides

Plus an interactive lab where you can steer a microphone array and cancel a tone in your browser.

https://www.mlaia.com/audio-ai/

#AudioAI #DSP #SignalProcessing #Acoustics #EdgeAI #MachineLearning

---

## 2. Hacker News — Show HN

**Title** (80 characters max):

Show HN: Browser demos of noise filtering, beamforming and active noise control

**URL:** https://www.mlaia.com/audio-ai/lab/

**First comment** (post it yourself right after submitting):

I run a small ML consultancy that does audio and DSP work. These three ideas come up whenever we explain audio systems to product teams, so I built them as interactive demos:

1. Noise filtering: a tone buried in broadband hiss, a low-pass filter you can move, and a readout of input and output SNR.
2. Beamforming: a delay-and-sum array you can steer, with a control for the number of microphones, so you can see how the beam changes.
3. Active noise control: tune the phase and amplitude of an opposing tone and listen to how much cancellation you actually get.

Everything runs in the browser on synthetic signals, and each example is a four-second sample. There's no microphone access and nothing is uploaded.

The companion pages go deeper. One plots residual noise against frequency for anti-noise that arrives a few tens of microseconds late, which is the clearest explanation I know for why ANC works at low frequencies and fades above about a kilohertz: https://www.mlaia.com/audio-ai/noise-reduction-anc/

I'd welcome corrections from people who do this for a living, and suggestions for a fourth experiment.

---

## 3. Reddit — r/DSP

Check the subreddit's current rules on self-promotion before posting. Keep the affiliation line in.

**Title:** Interactive browser demos: low-pass filtering, delay-and-sum beamforming and ANC (synthetic signals)

**Body:**

I put together three small browser experiments for explaining DSP basics to product teams:

- **Noise filtering:** a tone in broadband noise, with an adjustable low-pass cutoff and input/output SNR readouts
- **Beamforming:** a steerable delay-and-sum array with an adjustable microphone count
- **Active noise control:** tune the phase and amplitude of an opposing tone and listen to the residual

They use synthetic audio only, with no mic access or uploads: https://www.mlaia.com/audio-ai/lab/

There are also write-ups with computed figures, such as grating lobes when spacing exceeds half a wavelength, and FxLMS / timing limits for ANC: https://www.mlaia.com/audio-ai/beamforming-microphone-arrays/

Disclosure: I run MLAIA, the consultancy that hosts these. I'd value feedback on anything that's wrong or oversimplified.

---

## 4. LinkedIn personal posts (Yochai)

### 4a. Beamforming

A common question from product teams: how many microphones do we need to "make the beam narrower"?

Usually the honest answer isn't "more microphones," because:

• Low-frequency directivity is set by the array's size relative to the wavelength. At 300 Hz the wavelength is over a metre, so a 6 cm array is close to omnidirectional across much of the speech band.
• Spacing wider than half a wavelength creates grating lobes: extra beams as strong as the one you wanted.
• Small-aperture superdirective designs look great in simulation, then amplify sensor noise and mismatch on real hardware.

I wrote up the trade-offs, with polar plots computed from the array geometry, plus how we approach array design, DOA and MVDR on real devices:

https://www.mlaia.com/audio-ai/beamforming-microphone-arrays/

#Beamforming #MicrophoneArrays #DSP #Acoustics #AudioEngineering

### 4b. Noise reduction & ANC

"Why does our ANC do almost nothing above 1 kHz?"

It's usually physics rather than a bug. Even if the anti-noise has exactly the right amplitude, arriving a few tens of microseconds late leaves a residual of 2·|sin(πfτ)|. That's deep cancellation at low frequencies, but only about 10 dB somewhere around 1–5 kHz, depending on the delay. Past 1/(6τ), the anti-noise makes things louder.

That's why the ear-tip seal and the enclosure handle the high band, and why the latency chain from ADC to driver matters more than the choice of adaptive filter.

The page covers speech enhancement, FxLMS, feedforward vs feedback ANC, and how we evaluate all of it:

https://www.mlaia.com/audio-ai/noise-reduction-anc/

#ANC #NoiseCancellation #SpeechEnhancement #DSP #Hearables

### 4c. On-device audio AI

When an audio model is "too slow" on a device, the model is often not where the time goes.

In a typical streaming pipeline, buffering the analysis window and smoothing decisions over a few hops can take more time than inference. Idle power, meanwhile, is set by whatever runs on every hop, which is why wake-word systems use a tiny always-on detector that wakes a bigger verifier only when needed.

We've deployed ML and deep-learning models on Android and iOS phones and on dedicated controllers for drones and earphones. This page covers what we measure and how we approach it:

https://www.mlaia.com/audio-ai/edge-audio-ai/

#EdgeAI #TinyML #KeywordSpotting #EmbeddedML #AudioAI

### 4d. Vibration analysis

An early bearing defect is easy to miss in a raw vibration spectrum. Shaft lines and structural resonances dominate it.

Band-pass around the resonance, demodulate, take the envelope spectrum, and the defect rate and its harmonics stand out. With a bearing's geometry and shaft speed, you can predict exactly where those lines should be.

That physics-first baseline is also what makes machine learning trustworthy here: when labelled faults are rare, you need to know what an anomaly model is reacting to, and what a false alarm costs.

Simulated example and approach:

https://www.mlaia.com/audio-ai/vibration-analysis/

#PredictiveMaintenance #VibrationAnalysis #ConditionMonitoring #MachineLearning

---

## 5. Clutch profile

**Tagline** (short):

Specialist AI consulting: audio, medical AI and prediction

**Company description:**

MLAIA is a specialist AI and data science consultancy based in Yavne, Israel, working with clients globally. It is led by Dr. Yochai Edlitz (Ph.D., Weizmann Institute).

We work across four practices:

- **Audio & acoustics:** acoustic measurement, classical DSP and machine learning engineered together, from microphones and vibration sensors to algorithms running on real devices. This covers microphone arrays and beamforming, noise reduction and active noise cancellation, and on-device audio AI.
- **Medical AI:** data science for clinical and medical data.
- **Prediction & causal analysis:** forecasting for bookings, revenue, churn and demand, and understanding what drives outcomes.
- **AI & automation:** conversational AI and automation connected to business workflows.

Our approach is to measure first, then model, then validate on the target hardware or data. We establish classical baselines before adding learned models, and agree success metrics with clients before development starts.

**Service lines to select:** Artificial Intelligence, Machine Learning, Data Science / Big Data Analytics, IoT Development (for the edge and vibration work).

**Website:** https://www.mlaia.com

Ask past clients for Clutch reviews. The Silentium testimonial already on the site is a natural first request.
