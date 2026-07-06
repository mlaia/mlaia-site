# Social Media Drafts — Week of July 6, 2026
**Blog post:** *Voice AI Grows Up: Engineering Production Speech Systems in 2026*
**URL:** https://www.mlaia.com/blog-voice-ai-production.html

---

## 1. LinkedIn Company Post (MLAIA page)

Voice AI crossed $22 billion this year, and 67% of the Fortune 500 now run it in production. The technology finally works — which means the interesting problems have moved.

The question is no longer "can a machine hold a phone conversation?" It's: can you hit sub-500ms response latency at 500 concurrent calls? Can your STT survive Hebrew-English code-switching on a noisy telephone line? Do your per-call economics actually hold at 50,000 interactions a day?

Our new post is a production engineering guide to exactly these questions:

— Cascaded (STT→LLM→TTS) vs speech-to-speech architectures, and when each one wins
— The anatomy of a 450ms latency budget, component by component
— Why an AI-handled call costs ~$0.40 vs $7–12 for a human agent — and where that $0.40 actually goes
— Whisper variants vs Deepgram vs Google vs Azure for production STT
— The Israeli voice AI ecosystem: Verbit, Hyro, Hi Auto, Voiceitt
— Hebrew's specific engineering challenges: code-switching, morphology, and the TTS quality gap

Read it here: https://www.mlaia.com/blog-voice-ai-production.html

#VoiceAI #SpeechRecognition #ConversationalAI #MachineLearning #IsraeliTech #EnterpriseAI #MLAIA #AudioAI #STT

---

## 2. Facebook Post (MLAIA page)

An AI-handled customer call now costs about $0.40. A human-handled one costs $7–12.

That gap is why 67% of Fortune 500 companies deployed voice AI this year — but the engineering behind a voice agent that actually feels natural is harder than the demos suggest. Humans notice a pause of half a second. Hebrew speakers switch to English mid-sentence. And the p99 latency is what your callers remember, not the average.

Our new post breaks down how production voice AI systems are actually built in 2026 — architectures, latency budgets, costs, and the Israeli companies leading the space.

👉 https://www.mlaia.com/blog-voice-ai-production.html

#AI #VoiceAI #MachineLearning #MLAIA

---

## 3. LinkedIn Personal Repost (Yochai Edlitz)

A voice AI demo and a voice AI production system are separated by about 300 milliseconds.

That's the difference between a response that feels like conversation and one that feels like talking to a machine. Human turn-taking runs at ~200ms. Users tolerate up to ~500ms. Beyond a second, they hang up.

Hitting that budget with a cascaded pipeline — STT, then LLM, then TTS — means every single stage has to stream: transcription starts before the caller finishes speaking, the LLM starts on partial transcripts, synthesis starts on the first sentence. Teams that discover this after building a request-response pipeline face a full re-architecture.

And that's just latency. In Israel, add Hebrew-English code-switching that breaks standard ASR models, a Hebrew TTS quality gap of roughly two generations behind English, and regulated industries where no audio can leave the building.

We wrote up the full production picture — architectures, the latency budget, the $0.40-per-call economics, the STT landscape, and the Israeli voice AI ecosystem (Verbit, Hyro, Hi Auto, Voiceitt):

https://www.mlaia.com/blog-voice-ai-production.html

#VoiceAI #ConversationalAI #MachineLearning #IsraeliTech #EnterpriseAI

---

## Notes for Posting

- Posting cadence suggestion: LinkedIn Company first (Monday morning IL time), Facebook within a few hours, Yochai's personal repost ~24 hours later for best feed exposure.
- All three posts intentionally avoid emojis except the Facebook arrow (per MLAIA's existing FB style).
- Hashtags kept tight on personal post (5 vs. 9 on the company post) — personal feeds reward less hashtag density.
