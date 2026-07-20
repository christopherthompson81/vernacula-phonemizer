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

**Measured:** held-out MODERN eval (canonical IPA, verified on the *shipped int8 ONNX* with the same greedy decode
as `contextRestorer.ts`) — **85.3% per-word** (int8 ≈ fp32 84.8% ≈ torch 85.6%; quantization lossless). Context
beats a word-level baseline by **+21.9pp** on modern held-out (the modern analogue of the classical model's
+18.8pp), and beats the *previous* word-level default (`phonemizeFaNeural`, no context) by **+44.8pp** (33.5%→78.2%
per-word) — sentence context breaks the homograph/ezafe ceiling on modern text (بچه‌ها در خانه‌های بزرگ زندگی
می‌کنند → bat͡ʃehaː daɾ xaːnehaːjˈe bozorɡ zendeɡˈiː miːkonand), which is why it is the default.

**Limitations / guard:** greedy decode degenerates on ~0.2% of sentences (a runaway final token, e.g. ɾaft→ɾaftat…;
NOT a quantization artifact — fp32 is marginally worse). The default path guards against it: word-count mismatch, an
implausibly long token, or a repeated bigram → fall back PER-WORD to the word-level path; a lone-word clause (no
context to exploit) also uses the word-level path. So a malformed result never surfaces. The sync engine (C#-parity,
referee-eval) is untouched — this is a separate async path. See docs/investigations/fa_shortvowel_restoration_investigation.md.
