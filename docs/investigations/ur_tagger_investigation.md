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
- `tools/perso-arabic/silver.hindiurdu.tsv` — 8,593 (skeleton, `urd`, **IPA**) from kaikki
  Hindi entries carrying a real Urdu-spelling form; gold IPA from the hi g2p (Devanagari
  writes the vowels), harmonized aː→ɑː. Real spellings, not synthetic (synthetic
  transliteration "sank Punjabi"). Regenerable — `/tmp/hi_kaikki.jsonl` (158 MB) is present.
- `tools/perso-arabic/harakat.ur.silver.tsv` — 5,304 (skeleton, `ur`, **vowelized Urdu**);
  needs g2p to become IPA.
- `tools/perso-arabic/lexicon.ur.tsv` — 8,120 (skeleton, `ur`, vowelized Urdu).
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

**Finding — clear go.** Probe `tools/perso-arabic/ur_tagger_probe.py`:

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

**Finding.** `tools/perso-arabic/ur_train_tagger.py align` reaches **95%** aligned
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

## Run 6 — 2026-07-22 — anatomy of the remaining 28% (register divergence — a true but non-separable factor)

Goal: attack the covered-word miss tail (1,128 of 4,440 covered = 25% miss vs wikipron),
starting with Hindi/Urdu **register divergence** — "if a true factor" (user).

**Register divergence is real and systematic** (`ur_register_probe.py`): 296 misses (26% of all
misses) carry a Perso-Arabic-only consonant (ع ح ذ ض ظ ط ص ث ق). The pattern is textbook — Hindi
reads Arabic-template loanwords with eː/ə where Urdu takes the Arabic ɪ/ʊ (احساس eːɦsɑːs→ɪɦsɑːs)
and inserts epenthetic schwas in Arabic clusters Urdu keeps tight (حرف ɦərəf→ɦərf).

**But it is NOT cheaply/separately fixable — all three factors interplay** (validates the user's
framing):
- The old harakat lexicon (the would-be Urdu-native oracle) cleanly fixes only **14/296**
  (`ur_register_fix_probe.ts`) — its entries for these words are incomplete (احساس bare, احترام
  only a sukun; they never encoded the ɪ).
- Simple transforms (schwa-collapse, eː/ə→ɪ) fix only ~15%; 84% differ by schwa **movement**
  (احترام ours eːɦət̪rɑːm vs wiki eːɦt̪əɾɑːm) or by wikipron **free variation** (احترام has 4
  attested variants eː/ɪ × two schwa positions).

**Clean decomposition of ALL 1,128 covered misses** (by whether a wikipron variant shares our
consonant+long-vowel backbone):
- **52% (592) — short-vowel layer only**: right backbone, wrong ə/ɪ/ʊ quality/placement. Register
  divergence lives here, unified with general schwa-placement. Short-vowel quality is LEXICAL
  (Run 4) → fixable only by a better lexical short-vowel SOURCE, not a rule.
- **45% (515) — backbone divergence**: consonant/long-vowel differences = genuine Hindi/Urdu word
  divergence + majhūl + wikipron transcription noise (the irreducible floor).

**Sourcing blocker for the 52%.** An independent Urdu short-vowel source is needed (non-circular).
On disk: the Hindi kaikki "sounds" are Hindi phonology (`/ʋɪʃ.ʋə/` — same as ours, not
independent); no Urdu kaikki dump present; Persian (`/tmp/fa_kaikki.jsonl`) is independent but uses
e- where Urdu has ɪ- (imperfect). So the fix needs either (a) fetching an Urdu Wiktionary/kaikki
dump (independent → non-circular), or (b) using wikipron as a lexicon SOURCE (circular for the
wikipron eval, but consistent with the repo's existing lexicon+lexicon-free-backbone pattern),
or (c) the Perso-Arabic subset from Persian, accepting the e/ɪ imperfection. **Awaiting steer on
the source before building.**

## Run 7 — 2026-07-22 — the independent source is high-quality but too small

User chose the clean path: fetch the independent Urdu Wiktionary (kaikki-urd) extraction. Fetched
`/tmp/ur_kaikki.jsonl` (10,278 entries, 32 MB). The IPA is exactly what we want — human Urdu with
the correct Arabic-template short vowels (امام ɪmɑːm, اسلام ɪslɑːm, مؤذن mʊəzzɪn) — and INDEPENDENT
of wikipron.

**First extraction had a REGEX BUG (corrected).** The harakat-strip `[ؐ-ًؚ-ٰٟۖ-ۭـ]` spans
U+0610–U+064B, which **includes the base Arabic letters** (ا=U+0627, م=U+0645) — so it ate the
letters, leaving garbled/empty skeletons (امام → ""). That made kaikki-urd *look* tiny (885) and
useless (fixed 2). Fixed by using the canonical narrow strip from `core/harakatLexicon.ts`
(`stripHarakat`, U+064B–U+0652 + U+0670). NOTE: `build_hindi_urdu.ts` carries the same wide regex —
it happened to survive because Devanagari drives that pipeline, but it should be corrected too.

**Corrected: kaikki-urd is LARGE and fixes the tail** (`build_kaikki_urd.ts`): **6,387 skeletons**,
overlaps 6,190 wikipron types at **98%**, **fixes 1,057/1,128 (94%) of our covered-misses**, and
adds **1,795** new-to-lexicon words that are in wikipron.

**But it is NOT independent of wikipron.** Both kaikki and WikiPron scrape en.wiktionary — the 98%
agreement is *shared provenance*, not corroboration. So this is exactly the **wikipron-as-source**
path (chosen by the user), via a cleaner structured parse — correct for the product, but the
wikipron eval is circular for kaikki-sourced entries. The genuine **non-circular** headline stays
the **Hindi cross-script** derivation (independent of Wiktionary): 71.7% on the Hindi-sourced
expansion. Plan: prefer kaikki-urd (Urdu-native, best short vowels) → Hindi (majhūl + independent
fill) → harakat → default; report the Hindi-only non-circular number as the honest measure and
label the full (kaikki-corrected) wikipron score as same-source.

Built: lexicon-ipa.tsv **11,356** entries (kaikki 6,387 + Hindi 4,958 + harakat 11). End-to-end vs wikipron:
full pipeline **95.4%** (CIRCULAR — kaikki is Wiktionary), lexicon-free floor 35.1%, **NON-CIRCULAR Hindi
cross-script derivation 77.1%** (measured directly, independent of Wiktionary).

## Run 8 — 2026-07-22 — the search for an INDEPENDENT referee (epitran ✗, HF ✗, CLE ✓)

The 95.4% is circular; we needed a non-Wiktionary source WITH short vowels to corroborate. Swept the options:

- **epitran urd-Arab** (rule-based, independent): DROPS unwritten short vowels entirely (احساس→ɑːhsɑːs, علم→lm) —
  a rule g2p can't restore lexical vowels (Run 4), so zero signal on the layer we care about. ✗
- **HF datasets** (outside the usual pattern, could be independent): `Zuhri` (humairmunirawn/UrduG2P, 14k) — LLM-
  generated, only 43% short-vowel agreement, real errors → ✗. `mahwizzzz/urdu-g2p` (30k) — independent (3% raw-
  identical) and 71% agreement, BUT a non-Urdu inventory (ʂ/ɟ/c for s/d͡ʒ/t͡ʃ) and frequent vowel-drops (طالبان→
  taːlbaːn) → too noisy to trust. ✗
- **CLE Lahore "Phonetically Rich Urdu Speech Corpus"** — HUMAN read-speech, CISAMPA-transcribed, CC-licensed,
  fully independent of Wiktionary. Word-aligned Arabic↔CISAMPA (## bounds) → **5,679-word** lexicon
  (`build_cle_referee.ts` → `ur.cle-speech.tsv`). ✓

**CLE corroborates the whole approach** (after fixing a short-vowel-extractor bug that appended ə for every
consonant): **87% short-vowel / 75% full-IPA** agreement with wikipron (vs mahwizzzz's noisy 71%). vs our shipped
kaikki readings: **84%**. And on the register fixes (kaikki-vs-Hindi disagreements), the independent human corpus
sides **kaikki 55% / Hindi 30%** — ~2:1 that the fixes are right. This is the non-circular validation we lacked;
wired as the **secondary referee** in `ur.jsonc`, closing its own "no independent diacritized-Urdu referee" gap.

**Bottom line for ur:** IPA coverage lexicon (kaikki-primary, Hindi-independent-fill), 95.4% vs wikipron with a
77.1% non-circular Hindi backbone and an **87% independent CLE corroboration**. The BiLSTM tagger stays shelved
(Runs 1–4); the lexicon + independent referee are the deliverable.

## Run 9 — 2026-07-22 — mining the referee misses (multi-referee method)

With two referees (wikipron + independent CLE), mine where **both agree against us** =
strong real-error signal (`ur_referee_mine.py`). Key methodological catch: matching CLE
against *any* wikipron variant inflated the signal (173 candidates) via free variation;
using wikipron's **majority** reading is the honest filter (93 candidates).

Buckets of the 93: ain-ʔ 44, majhūl/long 25, short-vowel 15, consonant 8. Reading them, the
result is mostly **validation, not bugs**:
- **Free variation dominates.** Final-ہ length: wikipron 304 short ɑ / 131 long ɑː, CLE ~all
  long — the referees disagree with *each other*; our short ɑ matches wikipron's majority.
  ain-ʔ: wikipron keeps the glottal 75% of the time, CLE drops it — again our marking tracks
  wikipron's majority. Neither is our error.
- **Homographs** (علم *ilm*/*alam*, بری *barī*/*burī*) — the two sources pick different senses
  of an unvoweled skeleton; neither wrong.
- **Bidirectional epenthesis** — we add ə in some Arabic clusters (جشن d͡ʒəʃən), the referees add
  it in others (منشی mʊnəʃiː) → no clean rule.
- **A few genuine lexical errors** (گوشت→ɡoːʃ drops the final ت; فون fuːn should be foːn) — lone
  kaikki-entry mistakes, not systematic; spot-fixable but low value.

The one real *decision* surfaced: the **ain-ʔ convention** — we render ع as a glottal stop; both
referees (and actual Urdu) often drop it. Dropping matches CLE + human pronunciation; keeping
matches wikipron's 75% majority + the explicitness principle. Judgment call, not a clear bug.
**Net: the multi-referee mining validated the lexicon — no large systematic defect remains.**

## Run 10 — 2026-07-22 — honest independent accuracy (correcting the circular/mislabeled numbers)

Prompted by the right question: 56.8% is the lexicon-FREE backbone vs wikipron — a config that
ships nowhere. So measure the DEPLOYED pipeline (`phonemizeWord`) against an INDEPENDENT referee.
This surfaced two corrections to earlier claims:

1. **The 95.4% (shipped vs wikipron) is CIRCULAR** — wikipron and our kaikki source both scrape
   Wiktionary, so it is not a real accuracy.
2. **The "87% CLE" was mislabeled** — that was CLE-vs-wikipron (both Wiktionary-family), NOT the
   shipped pipeline vs CLE.

**Metric granularity is the crux.** Full-word-exact `phonemizeWord` vs CLE is only ~40% — but CLE
is a *speech* corpus (records speaker epenthesis/reduction/placement), so full-word-exact
unfairly penalizes realization, not lexical error. Reconciling notation buys only ~4pp (raw 35.6
→ +notation 36.1 → +convention[ain,final-ہ] 39.4 → +majhūl 49.2 → +short-V 59.5) — proving the
disagreement is CONTENT, not notation. The register-FAIR metric is **short-vowel CHOICE** (which
ə/ɪ/ʊ each syllable takes, abstracting placement):

| shipped `phonemizeWord` vs CLE (independent) | short-vowel choice |
|---|---|
| **kaikki (Wiktionary)-covered core** | **80.6%** |
| Hindi-fill / default-ə OOV tail | 50.3% |
| overall | ~60% |

So the honest independent picture: the Wiktionary-covered core restores short vowels **80.6%**
correctly per an independent human referee (non-circular); the Hindi/OOV tail (50%) drags the
overall to ~60%. Neither referee is "wrong" — for covered words they agree ~80% on lexical
content; the apparent conflict was full-word-exact (wrong metric for speech-vs-citation) + the
weak OOV tail. Maturity row corrected to these numbers; the 56.8% referee-eval floor stays as the
lexicon-free backbone regression guard (fine for that, not the deployment accuracy).

## Run 11 — 2026-07-22 — two levers for the residual, both declined (tested, not assumed)

Revisit: would a tagger help short vowels on the residual, and would CLE-as-source help?

**Tagger — no (re-confirmed, information ceiling).** The residual IS the OOV/tail boundary,
which is exactly where Run 4 showed the tagger fails: short-vowel quality has ~0 mutual
information with the skeleton (dev 63.8% < the 71.5% always-ə prior — worse than guessing ə),
and more data widened the gap (Run 3). The tagger's one win was majhūl (+13pp, word-shape signal)
— long vowels, not short, and we already declined the 3 MB model for it.

**CLE-as-source — prototyped, marginal, declined.** CLE has 3,535 words new to the lexicon, ALL
in the weak Hindi-fill/OOV tail (a real mix: inflections پہاڑوں, loanwords انجکشن/انشورنس,
proper nouns). But: (1) only **14** overlap wikipron, so ~3,520 are OUTSIDE Wiktionary and
independently unvalidatable (CLE would be their sole authority); on the 14 checkable, CLE beats
current +7pp — too thin to extrapolate. (2) CLE is a SPEECH corpus → importing it seeds the
citation lexicon with realization artifacts. (3) It spends our ONLY independent referee (the
80.6%-core corroboration) to buy unvalidatable coverage. Net negative — keep CLE as the referee.

**Close:** both levers tested and declined. The residual (Hindi/OOV tail, ~50% short-vowel
choice) stands as a genuine information floor — not an engineering gap. The Urdu deliverable is
the kaikki-primary IPA lexicon (80.6% independent on its covered core) + the CLE independent
referee; the tagger and CLE-as-source are documented negatives.
