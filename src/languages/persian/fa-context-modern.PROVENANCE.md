# `fa-context-modern.{enc,dec}.onnx` provenance

A char-level SENTENCE-level seq2seq (BiLSTM encoder + attention decoder) that maps a whole Persian ABJAD sentence to
canonical IPA — the **MODERN** context restorer. Same architecture as `fa-context-restorer` (the inference code in
`contextRestorer.ts` is shared; only the weights/vocab differ), but trained on modern prose instead of archaic
verse, so it does NOT hallucinate on everyday text. It is the **DEFAULT** modern path (`phonemizeFaNeural`, per
clause). Two int8 graphs, autoregressive; output is our canonical fa IPA.

**Training data:** [HomoRich](https://huggingface.co/datasets/MahtaFetrat/HomoRich-G2P-Persian) — **CC0**, ~528k
modern homograph-rich Persian sentences with grapheme→phoneme pronunciations. We train on the clean `Phoneme`
column (Grapheme→phoneme), which keeps the glottal onset (`?`→ʔ, 606579 vs 8) and encodes vowel length implicitly —
the convention that matches our fa. The `Mapped Phoneme` / `IPA Homograph Phoneme` columns use a *different*
convention (initial-ʔ dropped 30404/31497, explicit `ː`, `1`-tagged ezafe) and are **not** used — trusting the
anchor column would have flipped the ʔ convention. Phoneme→canonical-IPA is a deterministic char map
(`A→aː i→iː u→uː S→ʃ Z→ʒ C→t͡ʃ j→d͡ʒ y→j g→ɡ r→ɾ ?→ʔ`), verified against our own `getPhonemizer("fa")`. HomoRich
merges ق/غ→`q` (the Iranian phonemic merge); we **gheyn-condition** back to our fa's `q`/`ɣ` split (γ-only source
word → that word's `q→ɣ`; 99.2% of q-words are unambiguously ق- or غ-only). **ZWNJ→concatenate** (not space):
HomoRich writes می‌خوانم / کتاب‌ها as ONE phoneme word, so concatenating keeps word-counts aligned (recovers ~96% of
the 42% ZWNJ rows; 197k→404k pairs) AND matches the runtime, which strips ZWNJ before the model. 404k pairs, capped
to 250k for training, 90/10 split. Built by tools/fa-restoration/build_homorich_ipa.py +
export_modern_context_onnx.py (offline, GPU).

**Training (Run F/G):** warm-started from a teacher-forced base, then fine-tuned with SCHEDULED SAMPLING to cure
free-running EOS-failure degeneration (the model feeds its own predictions back during training so it learns to
recover instead of looping; loss stays anchored to the gold token). Two modes: per-token (independent substitution)
then ROLLOUT (sticky contiguous spans, `FA_SS_MODE=rollout`) which lets sustained loops form and be corrected —
rollout roughly halved the residual degeneration again. Model selection is on a FREE-RUNNING metric
(`score = per-word − 0.03·excess-words`), not teacher-forced val loss (which is blind to degeneration).

**Measured:** held-out MODERN eval (canonical IPA, verified on the *shipped int8 ONNX*, BEAM decode as in
`contextRestorer.ts`) — **90.5% per-word, 80.4% on the annotated homograph word** (int8 ≈ fp32 ≈ torch; quantization
lossless). Context beats the *previous* word-level default (`phonemizeFaNeural`, no context) by **+44.8pp**
(33.5%→78.2%) — sentence context breaks the homograph/ezafe ceiling on modern text (بچه‌ها در خانه‌های بزرگ زندگی
می‌کنند → bat͡ʃehaː daɾ xaːnehaːjˈe bozorɡ zendeɡˈiː miːkonand). End-to-end the deployed pipeline
(`phonemizeFaNeural`, beam + guard + length-chunker) reaches **90.5% per-word** with raw degeneration down to ~1.4%.

**Limitations / guard:** the char-level decoder still degenerates on ~1.4% of sentences (a runaway/looping tail,
mostly short imperative endings کن/بده and OOV proper names) — reduced ~5× from the pre-SS model but not eliminated
(an architectural floor). `contextRestorer.ts` uses BEAM decode; the default pipeline guards the residual: a
word-count mismatch falls back PER-WORD to the word-level path, a lone-word clause uses the word-level path, and
runs longer than the training sentence length (~120 chars) are chunked at word boundaries to stay in-distribution.
So a malformed result never surfaces. The sync engine (C#-parity, referee-eval) is untouched — this is a separate
async path. See docs/investigations/fa_shortvowel_restoration_investigation.md.
