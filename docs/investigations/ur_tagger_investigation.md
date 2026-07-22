# Urdu structural tagger — short-vowel restoration investigation

Goal: port the Persian structural-tagger methodology (`faTagger.ts` + `train_tagger.py`)
to Urdu (ur), aimed **not** at ezafe/syntactic context (Urdu's ambiguity is lexical, not
syntactic — کتاب is always *kitāb*) but at generalizing **short-vowel quality on the OOV
tail** — the ~34% of production tokens the coverage lexicon misses and the g2p fills with
a blanket default `[ə]`.

Reusable infra (language-agnostic): the tagger runtime (`faTagger.ts` inference +
mask-argmax + word assembly), the trainer (`train_tagger.py`, whose aligner descends from
an `ur_align.py`), `export_tagger_onnx.py`, the `meta.json` `src`/`tags`/`charTags` format,
the consonant-consistency mask, int8 export.

Urdu-specific to build: the Hindi-phonology alignment inventory (retroflex ʈ ɖ ɽ, dental
t̪ d̪, breathy aspirates, ɦ, ں) from `urdu.jsonc`; the training corpus; the eval framing.

Env: training runs under `/home/chris/base/bin/python3` (torch 2.9.1+cu128, CUDA, onnxruntime
1.23 w/ quantization). System `python3` has a broken `~/.local` torch — do not use it.

Data on hand:
- `tools/arabic-restorer/silver.hindiurdu.tsv` — 8,593 (skeleton, `urd`, **IPA**) from kaikki
  Hindi entries carrying a real Urdu-spelling form; gold IPA from the hi g2p (Devanagari
  writes the vowels), harmonized aː→ɑː. Real spellings, not synthetic (synthetic
  transliteration "sank Punjabi"). Regenerable — `/tmp/hi_kaikki.jsonl` (158 MB) is present.
- `tools/arabic-restorer/harakat.ur.silver.tsv` — 5,304 (skeleton, `ur`, **vowelized Urdu**);
  needs g2p to become IPA.
- `tools/arabic-restorer/lexicon.ur.tsv` — 8,120 (skeleton, `ur`, vowelized Urdu).
- Referee: `tools/referee-eval/referees/ur.wikipron-urd-broad.tsv` — 7,709 human fully-voweled
  words. NON-CIRCULAR for the tagger (tagger trains on Hindi-derived + harakat silver, NOT
  wikipron). The shipped backbone eval (`ur.jsonc`) folds `[ɪʊ]→ə` and majhūl oː/eː quality —
  which is exactly what the tagger produces, so that eval is **blind to the tagger**. The
  tagger must be measured against wikipron with short-vowel quality **UNFOLDED**.

## Run 1 — 2026-07-22 — data pool + opportunity sizing

Question: (a) how many aligned (skeleton, IPA) word pairs can we assemble to train, and
(b) how much headroom does the tagger have — i.e. on wikipron gold, how often is a short
vowel actually ɪ/ʊ (not the default ə), and how often is a majhūl long vowel oː/uː vs the
default? If the gold is mostly plain ə anyway, the tagger has little to add; if it is rich
in ɪ/ʊ/quality distinctions, that is the opportunity the default-ə baseline forfeits.

**Finding — clear go.** Probe `tools/arabic-restorer/ur_tagger_probe.py`:

- **(a) training pool**: 8,593 (skeleton, IPA) pairs from the Hindi-derived silver (IPA
  direct, no g2p round-trip needed). Two more vowelized-Urdu sources (harakat 5,304 +
  lexicon 8,120) can be folded in via the g2p if we need more.
- **(b) opportunity is large.** On the 7,709 wikipron words there are 8,220 short-vowel
  slots: **ə 61% / ɪ 24% / ʊ 13%** — so the blanket-`[ə]` default is **wrong on 39%** of
  short-vowel decisions (every ɪ/ʊ). Majhūl long vowels compound it: **46%** of و-longs
  are actually uː (default oː misses), **29%** of ی-longs are eː (default iː misses). The
  tagger is aiming at a real, quantified forfeit — not a rounding error.
- **(c) clean held-out exists.** 3,577/6,296 wikipron skeletons (56%) appear in the training
  pool; excluding them by leakage guard leaves **2,719 OOV skeletons** as an honest
  generalization test — exactly the tail the coverage lexicon misses.

Eval framing decided: measure the tagger vs wikipron with short-vowel + majhūl quality
**UNFOLDED** (keep only the notation folds: geminate ː, ɾ→r, ʋ→v). Non-circular because the
tagger never sees wikipron. The shipped `ur.jsonc` backbone eval stays as-is (it measures a
different thing — the consonant+long-vowel skeleton).

## Run 2 — 2026-07-22 — Urdu aligner

Question: can the fa monotonic aligner, re-inventoried for Hindi phonology, align the
Hindi-derived IPA pool at a usable rate? (fa reached ~93% of words; masked the rest.)
Aspiration handled by giving ھ its own tag (ʰ/ʱ + following short vowel) so each char keeps
one consonant; short vowels ə/ɪ/ʊ attach to the preceding consonant's tag as in fa.

**Finding.** `tools/arabic-restorer/ur_train_tagger.py align` reaches **95%** aligned
(8,235/8,593) after adding: dental `n̪` / retroflex `ɳ` / palatal `ɲ` nasal-place
assimilation to ن, gemination-as-doubling (ɾɾ, qq), and short `ɛ`/`ɔ` epenthetics (بحر
bɛɦɛɾ). The 5% residual is foreign-loanword spellings (moritania→ʈ, doctor→ɔː), correctly
masked. Aligner ready.

## Run 3 — 2026-07-22 — first tagger + the honest eval reframe

Trained the BiLSTM (emb 128, 2-layer bidir h256, consonant mask, 25 ep, ~seconds on CUDA).

**Eval trap caught first.** Scoring the tagger against wikipron gave 34% — but that is the
convention-confound the memory notes warn about: I trained on Hindi-g2p (canonical) IPA and
scored against wikipron, which uses a *different* notation (plain `n` for our `n̪`/`ɳ`/`ɲ`;
precomposed `õː` with tilde-before-length for our `oː̃`; doubled-token gemination). Per the
project principle **our canonical IPA is the notation every part uses** — so the honest eval
is *in-convention*: a held-out slice of the same Hindi-derived (canonical) gold, which is
exactly what our g2p would emit if the abjad wrote its vowels. wikipron is kept only as a
cross-convention lower-bound sanity number.

**Result — the short-vowel target FAILS; majhūl long vowels WIN.** In-convention dev, per
short-vowel *slot* (ə/ɪ/ʊ/ɛ/ɔ):

| pool | train | short-slot: tagger vs always-ə | majhūl-slot: tagger vs default oː/iː | per-word exact |
|---|---|---|---|---|
| Hindi silver only | 7,412 | **60.2% vs 62.9%** (loses) | **71.0% vs 62.4%** (+8.6) | 46.8 vs 52.4 |
| + harakat/lexicon silver | 9,016 | **63.8% vs 71.5%** (loses worse) | **72.0% vs 59.0%** (+13.0) | 45.9 vs 53.3 |

- **Short-vowel quality is unlearnable from the skeleton at this scale.** "Always guess ə"
  beats the tagger, and *doubling the data widened the gap* (the extra lexicon words are even
  more ə-dominant). Which of ə/ɪ/ʊ a skeleton takes is lexical (کشن kɪʃən vs the ə-prior),
  and 9k words can't out-predict the 61–72% majority class. This reproduces the repo's prior
  Urdu conclusion (the word-level neural was net-negative) and confirms the fa contrast: fa
  won on **context + HomoRich's 528k sentences**; Urdu has neither (ambiguity is lexical, and
  no HomoRich-equivalent exists — synthetic transliteration "sank Punjabi").
- **Majhūl long-vowel quality (و=oː/uː, ی=iː/eː) is a real, stable win (+8.6→+13pp).** That
  distinction *is* partly predictable from word shape, and the default (always oː/iː) is only
  59–62%. This is the one place the tagger adds value — but 72% absolute is still modest, and
  the residual is lexical.

**Implication / decision point.** The fa methodology does **not** transfer as a win for
Urdu's *main* problem (short-vowel quality) — that stays a lexicon job (the shipped coverage
lexicon for the 66% it covers; default-ə for the OOV tail). The only tractable tagger
contribution is majhūl long-vowel correction. Open levers: (a) a **majhūl-only hybrid** —
tagger corrects و/ی long-vowel quality, shorts stay default-ə (no short regression, +majhūl);
(b) a **majhūl lexicon** instead of a 3 MB model (majhūl is also lexical but lower-entropy — a
binary و→oː/uː choice per word); (c) accept the negative result and stop. Awaiting steer.

## Run 4 — 2026-07-22 — WHY it fails: signal-in-data vs architecture (+ homograph rate)

User pressed the right question: is the short-vowel failure (a) the signal isn't in the data
or (b) the BiLSTM captures it weakly — and noted a lexicon can't disambiguate homographs.
Two diagnostics settle it.

**1. Train vs dev fit (memorisation ceiling).** Same run, short-vowel slot accuracy:

  - TRAIN: **92.6%** (vs always-ə 68.6%) — the model fits its own words' shorts, +24pp over prior.
  - DEV:   **63.8%** (vs always-ə 71.5%) — on unseen skeletons it collapses below the prior.

  Textbook **memorisation-without-generalisation**: the architecture represents the patterns
  fine; they don't transfer across the OOV boundary. So it is **(a)** — but precisely: not
  "cross-script Hindi didn't help" (the data is fine, the model fits it), rather short-vowel
  quality is **intrinsically lexical / word-specific**, with near-zero sub-word regularity to
  generalise. A bigger net cannot transfer a signal that isn't there.

**2. Homograph rate (`ur_homograph_probe.py`, wikipron).** Is the ambiguity homographic
(context can win) or lexical-fixed (lexicon is correct, OOV is a hard floor)?

  - 17% of skeletons are listed with >1 pron; only **7.3% of types** have a genuinely
    differing SHORT-vowel pattern — and inspection shows these are mostly **transcription
    variants**, not semantic homographs: آسان ['','ə'] (epenthetic schwa marked-or-not),
    احترام ['ə','ɪ','ɪə','ɪɪ'] (ehteraam~ehtiraam narrow-transcription), آخری ['','ɪ']
    (schwa-deletion). True semantic short-vowel homographs are rarer still. Majhūl homographs:
    **2.7%**.

**Conclusion (resolves the lexicon-vs-homograph tension).** Urdu short vowels are
**lexical-FIXED**, which cuts both ways: (i) a lexicon forfeits ~nothing to homographs (there
are ~none) — the general "lexicon can't do homographs" objection does not bite for Urdu; and
(ii) a context/sentence tagger has ~nothing to disambiguate — fa's winning lever is absent, and
the word-level experiment was *not* the limitation (a sentence model would add ~2-3%, not the
30pp gap). The OOV tail is a genuine **information floor**: unseen idiosyncratic vowels are
unknowable without having seen the word, and with no homograph structure context can't
reconstruct them. **Neither data, depth, nor context materially moves this — the ceiling is
informational.** The lone model niche is OOV **majhūl** long-vowel quality, which *does*
generalise (72% vs 59%) because oː/uː~iː/eː correlate with word shape. Net: the shipped
coverage-lexicon + default-ə is near the achievable ceiling for known vocab; the tagger is
not worth a 3 MB model for shorts, and only marginally for majhūl.

## Run 5 — 2026-07-22 — the shippable win: an IPA coverage lexicon (harakat retired for ur)

Since the vowels are lexical-FIXED (Run 4), a LEXICON is the principled tool — and the tagger
experiment already assembled the data. Pivot from the harakat lexicon to an **IPA** lexicon,
per two user steers: "our canonical IPA is what every part should use" and "harakat might be
the wrong tool for Urdu." Harakat is *actively* wrong here: it cannot encode majhūl (ی=iː~eː,
و=oː~uː) — the g2p only fakes it with adapted-word diacritics (`یَ→eː`) — whereas the
cross-script Hindi gold carries majhūl natively (Devanagari writes ई/ए, ऊ/ओ). IPA also drops
the fragile IPA→harakat inversion (the source is already IPA) and keeps the lexicon canonical
at rest.

Built `src/languages/urdu/lexicon-ipa.tsv` (**9,456** entries: 8,593 Hindi-derived, non-circular
+ 863 from the old harakat lexicon converted via g2p to fill the Perso-Arabic-register tail).
Canonical normalisation: strip stress (weight-stress applied at lookup), drop redundant
vowel-nasalisation before a full nasal consonant (ə̃nd̪→ənd̪, matching our own g2p and wikipron),
final ہ→short ɑ (Hindi cognate has long -ɑː), g→ɡ. `urdu.ts` now: writer harakat → respect;
else IPA-lexicon hit → canonical IPA + weight-stress; else default-ə core. Harakat lexicon
retired for ur (fa/ps/pa unchanged; `coverageLexicon()` feeds the neural rider's membership check).

**End-to-end vs wikipron (`ur_e2e_eval.ts`, quality UNFOLDED, only notation folded):**

| pipeline | exact-match |
|---|---|
| lexicon-free default-ə core (non-circular floor) | 35.1% |
| **IPA-lexicon pipeline** | **65.0%** |
| …on the non-circular expansion (Hindi-sourced, never in old lexicon) | **71.7%** |

Nearly **doubles** the non-circular exact-match (35→65%); the newly-covered words land at 71.7%
where the default gets ~all wrong. Coverage of wikipron types rose 27%→~88% (union of sources).
The residual gap is the established floor (genuine Hindi/Urdu register divergence شعر ʃeːr~ʃɪʔr,
wikipron transcription noise, the rare true homograph) — not addressable by more data. All 107
referee-eval + urdu tests pass; added a majhūl test case (نکیل eːl, کھجور uːɾ) that harakat could
not represent. **This is the Urdu deliverable — the tagger is shelved (negative, Runs 1–4); the
lexicon is the win (Run 5).**

**Review fixes (PR #400).** Adversarial review caught that the lexicon short-circuit bypassed
`phonemizeWordCore`'s post-g2p tail, so stored values shipped raw: the ̲ (U+0332) protection
mark leaked (221 entries), nasal assimilation n→m/ŋ was dropped (43), and word-initial آ was not
forced to ɑː (10). Fixed at the build tool by factoring the tail into a shared `finalizeUrduIpa`
(applied full to the harakat branch — raw g2p output with default schwas + ̲ marks — and as
̲-strip + nasal-assim only to the schwa-resolved Hindi gold, to avoid over-deleting a phonemic
schwa), plus an `initialMadda` invariant. All three defect counts → 0; e2e rose 62.3→**65.0%**.
