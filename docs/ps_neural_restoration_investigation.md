# Pashto neural short-vowel restoration — applying the Persian lessons

The Persian lessons (from `native_*` / the fa retrain): (1) silver labels mined under a short-vowel-COLLAPSING
fold made the neural under-vocalize → fix = fully-diacritized training data; (2) but the fa neural BAKE was
NET-NEGATIVE in production (confident errors, uncalibrated confidence) — a documented negative result.

Pashto's residual (bucketed in the ps-glide-nasal review) is dominated by unwritten short vowels + و-glide (~117
+ 102) — exactly what a diacritizer should restore. The shared multilingual neural (Urdu/Persian/Pashto/Punjabi)
was already retrained to encode short vowels (کتاب→کِتاب), but it is on the ASYNC path only — the sync shipped
`phonemizeWord` and the referee eval do NOT use it. Question: does the neural actually HELP Pashto, or is it
net-negative as for Persian?

## Findings — 2026-07-16

**The neural is NET-NEGATIVE for Pashto (measured), exactly as for Persian.** On the wikipron referee (ex
letter-names, 1306 words): SYNC lexicon+default 45.3% vs NEURAL diacritize+g2p 44.0%; on the OOV (non-lexicon)
subset a wash (sync 40.9% / neural 40.5%). The neural fixes some (drops a stray epenthetic ə, adds ŋ) but breaks
more via confident errors. And STRUCTURALLY it can only restore harakat (short vowels) — it cannot touch the
biggest residual, the و glide/vowel ambiguity (~117), which is not a diacritic.

**The value was in the DATA/lexicon layer, not the neural — the real Persian lesson.** The miner (invert_harakat.ts)
gave `fa` a TWO-PASS fold (FA_FULL_FOLD keeps short-vowel quality + dialect-normalizes; then the loose fold for
coverage) but `ps` used the LOOSE fold only — which collapses a/i/u/ɪ/ʊ→ə, so the g2p-inversion accepts a bare
default-ə for ANY short vowel and mines **under-diacritized** labels. Result: ps silver was **78% all-bare** (vs
fa's fixed 54%-with-harakat) — the exact bug Persian had.

**Fix: a `PS_FULL_FOLD` + ps two-pass mining** (keeps a/ə/i/u/o DISTINCT; folds only the dialect-invariant axes —
ښ ʂ/ç→ʃ, ږ ʐ→ʒ, retroflex ɻ→r, dental t̪/d̪, length/gemination). Re-mined:
- ps silver: 22% → **41%** diacritized (126→258 words encode short vowels), 585→623 labeled.
- ps LEXICON (the shipped COVERAGE layer, `src/languages/pashto/lexicon.tsv`): **113 → 232 entries** (21%→41%).
- SYNC eval (what actually ships + is evaluated): wikipron 44.9%→**45.7%**, kaikki 49.0%→**50.0%**.
- Two gold words are now restored to their referee-attested, linguistically-correct short vowels (the gold had
  the pre-restoration schwa placeholder): کتاب kət̪ɑb→**kit̪ɑb** (the Arabic loan kitāb, /i/), پښتو pəʂt̪o→**paʂt̪o**
  (Kandahari, consistent with our ʂ).

**DECISION: do NOT retrain/wire the neural.** The training env is available (RTX 3090), but (a) the neural is
net-negative on the sync eval and a wash on OOV, (b) it structurally can't fix the dominant و-glide class, (c) the
shared multilingual model risks fa/ur/pa. The durable win is the improved lexicon/silver DATA (which helps the
shipped sync path directly) — the part of the Persian work that actually moved the number. The retrained-neural
path stays a documented negative result (as for fa). The improved silver is committed and ready IF a future
retrain is warranted.
