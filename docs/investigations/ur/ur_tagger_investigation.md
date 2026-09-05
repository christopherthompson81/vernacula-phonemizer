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

Env: training runs under `<local path>` (torch 2.9.1+cu128, CUDA, onnxruntime
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

## Run 12 — 2026-08-09 — re-opening the tagger: is the ceiling informational, or was it never tested at scale?

Question (user): can we source a **larger training corpus** for Urdu so that a BiLSTM OOV
tagger/restorer could possibly succeed? Runs 3–4 and 11 closed the tagger as an *information*
ceiling. Before sourcing, that closure deserved re-reading — and it does not survive it.

### The scaling evidence in Run 3 is confounded

Run 3 concluded "**doubling the data widened the gap**" from this pair of rows:

| pool | train | tagger short-slot | always-ə |
|---|---|---|---|
| Hindi silver only | 7,412 | 60.2% | 62.9% |
| + harakat/lexicon silver | 9,016 | 63.8% | **71.5%** |

**The always-ə prior moved 62.9% → 71.5% between those rows — so the DEV SET changed.**
`ur_train_tagger.py:129–131` shuffles the whole pool and takes `dev_set = aligned[:len//10]`,
so growing the pool re-draws the dev set. The two rows measure different populations and are
not a data-scaling experiment. Read within-row instead: the tagger went **60.2% → 63.8%
(+3.6pp)** for +21.6% data — the wrong sign for a saturation claim.

**And the train/dev gap is the classic starvation signature, not proof of absent signal.**
Run 4 read train 92.6% / dev 63.8% as "memorisation without generalisation ⇒ the signal isn't
there," but that argument was about *net size* ("a bigger net cannot transfer a signal that
isn't there"). A 29pp train–dev gap is equally the textbook symptom of **too few examples** —
which is exactly what more data fixes.

⚠ **The decisive fact: 9,016 pairs is BELOW this repo's own measured ~10k starvation line**
(`da-g2p-tagger.PROVENANCE.md`; the shipped `sd` tagger trains on 9,274). Urdu's tagger was
declared informationally impossible from a run below the line at which this repo declines to
draw conclusions at all. The negative may still be right — but it was never tested at scale.

### Sourcing: two romanization corpora, both non-Wiktionary

Neither was considered in Runs 1–11, which searched only *pronunciation* sources. **Roman Urdu
writes the vowels the abjad omits** — including the majhūl contrast (o/oo, e/ee) — so a
romanization lexicon is a short-vowel source.

| source | native types | licence | independent of? |
|---|---|---|---|
| **Dakshina** (Google Research) `ur/lexicons` | **30,000** | CC BY-SA 4.0 | Wiktionary ✓, CLE ✓ |
| **Aksharantar** (AI4Bharat) `urd.zip` | 648,894 | CC-BY / CC0 | see below |

Both fetched. Dakshina's tar is 2 GB and `ur/` sorts last; rather than stream it all, the tar
header chain was walked by HTTP range request (`/tmp/tarwalk.py`) to locate
`ur/lexicons/*.tsv` at byte 1,831,772,160 and fetch **2.6 MB** instead of 2 GB.
Format: `native⇥romanization⇥attestation_count`, **4.2 romanizations per word** from human
annotators (آؤ→aao 3, aaoo 1, aau 1 …).

### ⚠ Aksharantar's "699K Urdu pairs" is 96% mined, and the mined part LOSES to guessing ə

Its `source` field decomposes it, and the headline number does not survive:

| source | types | CLE overlap | slots | **label acc** | always-ə |
|---|---|---|---|---|---|
| IndicCorp (**mined**) | 620,010 | 801 | 856 | **52.5%** | **57.4%** |
| Dakshina (**re-distributed**) | 24,928 | 3,567 | 3,033 | 65.5% | 60.0% |
| AK-Uni/NEI/NEF + Existing (human) | 8,376 | 404 | 330 | **70.3%** | 60.3% |

- The **620k mined bulk scores BELOW the always-ə prior** — it is worse than not using it. 96%
  of the corpus is unusable for this purpose.
- Its human core **is Dakshina**, re-distributed *worse*: 93,744 pairs/24,928 types against
  Dakshina's own 127,201/30,000, i.e. attestations are sampled away, and the per-slot vote that
  denoises them (below) weakens with them — 65.5% here vs 70.6% from the Dakshina release.
- The genuinely new content is **8,376 human types** (AK-Uni/NEI/NEF/Existing), at the best
  label quality measured. Worth taking; it is 1.2% of the advertised size.

### Label quality, measured against CLE (independent of BOTH sources)

Scored at the short-vowel **choice** granularity (Run 10's register-fair metric), naive
romanization→vowel table, no tuning, DP-aligned vowel sequences:

| extraction | slots | label acc | always-ə |
|---|---|---|---|
| top-1 romanization, positional align | 4,047 | 62.7% | 59.8% |
| top-1, DP-aligned | 3,788 | 68.3% | 60.5% |
| **per-slot vote across all annotators, DP-aligned** | 3,790 | **70.6%** | **60.4%** |

**+10.2pp over the prior on an independent human referee**, and cross-annotator voting is worth
+2.3pp of it — crowd romanizers disagree precisely where the orthography is ambiguous (bare `a`
spells both ə and ɑː), so their disagreement is itself the denoiser. کشن→"kishan"(6) recovers
kɪʃən — the exact lexical case Run 4 named as unlearnable.

⚠ **These are NOISY labels, not gold.** ~70% label accuracy is *below* the 71.5% prior Run 3
measured on its own pool (different population, so not directly comparable — but the caution
stands): training on them cannot be assumed to beat always-ə. Whether unbiased-ish per-slot
noise averages out, or whether the systematic `a`=ə/ɑː confusion poisons it, is an empirical
question. The romanization is also a *spelling*, not a transcription — it must still be aligned
to the Perso-Arabic skeleton, and my probe aligned to CLE's IPA directly, which is easier.

### Pool arithmetic

| | types |
|---|---|
| current `lexicon-ipa.tsv` | 11,356 |
| Dakshina | 30,000 |
| + Aksharantar human, new vs Dakshina | +7,013 |
| **usable human-labelled union** | **37,013** |
| new vs current lexicon | 30,280 |
| **projected pool (union with current)** | **41,636** |

**4.6× the 9,016 pairs the negative result was measured on, and 4× the repo's starvation line** —
comparable to Afrikaans's 32.5k, which trains a shipped tagger at 91.4%.

### Implication for the next step

Sourcing is answered: **yes, decisively, and the data is on disk.** What is NOT answered is
whether it rescues the tagger, and two things must not be conflated — the pool is 4.6× larger,
but its labels are ~70% accurate where the existing 9k are gold-ish. The cheap decisive
experiment, which has never been run, is a **learning curve on a FIXED dev set** (the flaw in
Run 3): hold out a slice of the *existing gold* pool once, then train at 5k/10k/20k/40k with the
Dakshina-labelled data folded in, and watch whether dev tracks up or flattens. That distinguishes
"starved" from "no signal" in one afternoon and costs nothing but GPU minutes. **Negative results
so far stand unrevised** — this run reopens the question, it does not answer it.

**Not yet done:** the romanization→skeleton aligner (the probe aligned to CLE's IPA, the easier
task); majhūl extraction, which the romanization also carries (o/oo, e/ee) and which is the one
place Run 3 measured the tagger *winning* (+13pp); and licensing review — Dakshina is CC BY-SA
4.0, a §3 share-alike stratum artifact like RCRL/Lexique, so a derived model inherits.

## Run 13 — 2026-08-09 — the test Run 3 never ran: a FIXED-dev learning curve, and what it costs to feed it

Ran the experiment Run 12 identified. Two phases, one dev set, held fixed throughout
(`tools/perso-arabic/ur_learning_curve.py`, which imports Run 3-4's aligner and model verbatim so
the numbers stay comparable). Dev = a 1,001-word slice drawn ONCE from a deterministic order and
never redrawn; always-ə prior on it **69.4%**, default-majhūl prior 63.1%. 3 seeds per point.

### Phase A — gold pool only. Run 4's ceiling claim does not survive.

| train | short-slot (3 seeds) | Δ vs prior | majhūl | word-exact |
|---|---|---|---|---|
| 1,000 | 47.5% (±2.3) | −21.9 | 63.8% | 28.6% |
| 2,000 | 54.1% (±1.3) | −15.3 | 68.4% | 35.3% |
| 4,000 | 57.7% (±1.1) | −11.7 | 70.8% | 40.4% |
| 6,000 | 59.4% (±2.0) | −10.0 | 73.0% | 41.9% |
| **9,016** | **61.6% (±3.1)** | **−7.8** | **75.3%** | **44.2%** |

**Monotonic, ~+3.9pp per doubling, and still climbing at the top of the pool — no flattening.**
Run 4's "**neither data**, depth, nor context materially moves this — the ceiling is
informational" is **falsified as stated**: data moves it, steadily, and the run that declared the
ceiling sat below this repo's own ~10k starvation line. Naively extending the trend, parity with
the always-ə prior arrives around ~36k pairs — which is, to the pair, the scale Run 12 sourced.
(Majhūl confirms Run 3's one positive: already **+12.2pp over its prior** at 9k and still rising.)

### Phase B — feed it the sourced data. It gets WORSE.

Built `silver.dakshina.tsv` (36,328 pairs): our lexicon-free `phonemizeWordCore` supplies the
backbone, the cross-annotator-voted romanization overwrites vowel QUALITY at aligned slots
(13,364 slots changed). Validated against CLE first — the labels are real:

| reading of the same 4,408 CLE words | short-vowel acc |
|---|---|
| core backbone, default-ə | 51.4% |
| **+ romanization overwrite** | **63.4%** |
| always-ə prior | 59.7% |

**+12.0pp over the backbone, and above the prior.** Then, same fixed dev, gold + romanization:

| train | short-slot | Δ vs prior | majhūl | word-exact |
|---|---|---|---|---|
| 9,016 (gold only) | **61.6%** | −7.8 | 75.3% | 44.2% |
| 9,016 + 5,000 | 58.6% | −10.8 | 75.4% | 42.1% |
| 9,016 + 10,000 | 58.5% | −10.9 | 73.6% | 40.5% |
| 9,016 + 20,000 | 56.2% | −13.2 | 72.4% | 39.2% |
| 9,016 + 29,613 | 56.2% | −13.2 | 72.7% | 39.1% |
| 0 + 29,613 (roman only) | 51.9% | −17.5 | 66.7% | 33.5% |

**Monotonically worse the more of it you add — −5.4pp at full scale.** Trading cleanliness for
size does not rescue it either: rebuilding at `--min-agree 1.0` (unanimous annotators only,
9,970 pairs, label acc 73.3%) still gives 58.4% at +5,000 and 57.3% at +8,890. The model learns
the labels' noise faster than their signal, which is what training on ~63-73%-accurate labels
against a 69.4% prior should be expected to do.

### What this actually settles

The ceiling is **neither informational (Run 4) nor volumetric (Run 12's hope)** — it is a
**LABEL-QUALITY ceiling**, and that is a sharper and more useful statement than either:

- Gold pairs buy ~+3.9pp per doubling with no saturation in sight. **~9k gold is all that exists.**
- ~37k further human-labelled types exist, but they are *romanizations* — ~63% accurate against
  an independent referee, i.e. barely above the prior the tagger must beat. At that accuracy more
  of them is strictly harmful.
- So the tagger is blocked not by absent signal but by absent **gold**. Anything that raises label
  accuracy on the data we already have is worth more than any amount of what we can download.

**The tagger stays shelved — now for the right reason, and on a controlled comparison.**

### ⚠ The unshipped win this surfaced (NOT a tagger)

The romanization labels beat the default-ə backbone by **+12.0pp on exactly the OOV-tail
population** (51.4% → 63.4% on the same 4,408 words). Run 10 measured that tail — the words with
no kaikki entry, currently served by Hindi-fill/default-ə — at **50.3%**. So these 30,280
new-to-lexicon skeletons look like a **lexicon tier**, not training data: too noisy to *teach* a
model, comfortably better than what the tail gets today. That is the same shape as every other
tiering decision in this repo (`da`, `nb`, `fr`, `af`), and it needs no model at all.

⚠ Not yet validated as a shipped change, and three things must be checked before it is: it would
be a **third** lexicon tier under kaikki (80.6%) and Hindi, so precedence matters; CLE is our only
independent Urdu referee and Run 11 already declined to spend it as a *source* — this would spend
it as the *validator* of a source, which is weaker but not free; and Dakshina is **CC BY-SA 4.0**,
a §3 share-alike artifact (the RCRL/Lexique stratum), so a shipped lexicon inherits share-alike
and needs the per-file fence + NOTICE.md attribution.

**Artifacts:** `ur_learning_curve.py` (phases A/B), `ur_build_dakshina_labels.py`,
`ur_emit_core.ts`, `silver.dakshina.tsv`. `ur_train_tagger.py` left untouched — it is the
provenance for Runs 3-4 and its dev-slice flaw is now documented rather than silently patched.

## Run 14 — 2026-08-09 — HOW the romanization disagrees, and why no gating rescues it as training data

User asked the right follow-up to Run 13: find the *specific* way the data disagrees — maybe the
romanization needs to be used differently when moving to IPA. The overwrite preserves the
backbone's vowel COUNT, so gold↔backbone aligns once and the same indices score the overwritten
reading, letting every individual change be classed improved / degraded / both-wrong
(`tools/perso-arabic/ur_label_diagnostics.py`, scored on CLE).

### The disagreement is structured, and it is mostly MAJHŪL

| overwrite verdict | with majhūl (Run 13) | **short-vowel only** |
|---|---|---|
| improved | 888 (60.0%) | **540 (76.6%)** |
| degraded | 329 (22.2%) | **127 (18.0%)** |
| both-wrong | 263 (17.8%) | **38 (5.4%)** |

Top confusions on bad overwrites: **iː→eː 101, ɛː→eː 69, oː→ɔː 40, ɪ→eː 31, eː→ɛː 29, oː→uː 21,
iː→ɛː 18** — ~320 of ~590, against ~143 from the short branch (ə→ʊ 70, ə→ɪ 57, ʊ→ɪ 16).

**Roman spelling does not determine Urdu's majhūl contrast.** Bare ⟨e⟩ writes both iː and eː,
⟨o⟩ both oː and ɔː, and ⟨ai⟩ collides with a–i hiatus — so ی=iː~eː and و=oː~uː, the very
distinction Run 5 adopted an IPA lexicon to capture, is the one thing the romanizer blurs. The
short-vowel branch, by contrast, fires at **76.6% precision**. Position is uniformly favourable
(initial 537:157, final 261:128, medial 90:44), so there is no positional gate to find.

### Gating it does not rescue the training use — and the reason is arithmetic

Rebuilt short-only (36,328 pairs, 6,439 slots changed vs 13,364) and re-ran Phase B on the same
fixed dev:

| train | short-slot | majhūl | (Run 13, with majhūl) |
|---|---|---|---|
| 9,016 gold only | **61.6%** | **75.3%** | — |
| 9,016 + 5,000 | 58.2% | 72.7% | 58.6% / 75.4% |
| 9,016 + 30,089 | 55.6% | 68.6% | 56.2% / 72.7% |
| 0 + 30,089 | 52.3% | 64.7% | 51.9% / 66.7% |

Still monotonically worse — and **majhūl got WORSE, not better** (68.6% vs 72.7% at full scale):
with the branch gated, the majhūl labels simply echo the backbone's rule default, so the model is
now being taught the default it is supposed to beat. The gate traded one defect for another.

**The arithmetic is why, and it is not fixable by gating.** On the same words, the romanization
labels score **63.4%** where the always-ə prior scores **59.7%** — a margin of just **+3.7pp**.
Training data has to be *much* better than the prior the model must beat, and a +3.7pp margin is
nowhere near enough; the model reaches the labels' quality, which is below where it already was.
No re-mapping changes that, because the margin is a property of what a romanization *records*,
not of how we read it.

### ⚠ The honest correction to Run 13's write-up

Run 13 flagged the lexicon-tier use as the surfaced win. That still holds, but **gating majhūl is
the wrong default for it**, and Run 13's framing would have led there. For a *lexicon* what
matters is net correct slots, not precision: the majhūl branch adds **+348 improved against 202
degraded (net +146)** at only 45% precision. Short-only is the safer artifact (net +413, 76.6%
precision); with-majhūl is the higher-scoring one (net +559). That is a real trade — conservatism
vs yield — and it is the shipped-lexicon decision, not a measurement. `--with-majhul` restores
Run 13's behaviour; short-only is the default because this repo treats regressions as costlier
than foregone gains.

### Settled

- **As training labels the romanization is dead**, at any gating: its margin over the prior
  (+3.7pp) is too small to train against, and Runs 13-14 measured that at four scales and two
  cleanliness levels.
- **As a lexicon tier it is alive**: +12.0pp over the default-ə backbone (51.4%→63.4%) delivered
  by lookup on 30,280 new-to-lexicon skeletons, no generalization required — which is exactly the
  distinction the training experiment failed to bridge. A lookup needs only to be right; a
  training label has to be right *enough to teach*.
- The tagger stays shelved. The blocker is **gold**, and Run 12's search establishes there is none
  at Urdu scale.

## Run 15 — 2026-08-09 — a uniform bake-off of every findable Urdu word→IPA source

Runs 13-14 left a sharp criterion, so every candidate can now be judged by one number instead of
by inspection: **the margin over the always-ə prior**, scored on CLE (independent of Wiktionary,
Dakshina and all of these). Dakshina's +3.7pp was too thin to train on; the bar for *training*
data is a wide margin, the bar for a *lexicon tier* is merely beating our default-ə backbone
(51.4%). `score_candidate.py` applies it uniformly, folding notation only — never vowel quality.

| source | single-word entries | short-V acc | prior | **margin** | verdict |
|---|---|---|---|---|---|
| **humair025/urdu-g2p-dictionary** | **323,256** | **74.0%** | 58.9% | **+15.1** | clears the bar |
| Dakshina romanization (Run 13) | 30,000 | 63.4% | 59.7% | +3.7 | too thin to train |
| mahwizzzz/urdu-g2p | 30,107 | 52.9% | 59.9% | −7.0 | below prior |
| **espeak-ng `-v ur`** (GPL-3) | — | 52.1% | 59.0% | −6.8 | below prior |
| our default-ə backbone | — | 51.4% | 59.7% | −8.1 | (the thing to beat) |
| humair025/zuhri (28k) | 14,391 | 47.3% | 60.3% | −13.0 | below prior |
| neurlang/dataset urdu | 10,047 | 38.9% | 60.5% | −21.6 | below prior |

Also checked and set aside without scoring: `asadullah797/urdu-phoneme-dataset` is **audio +
utterance-level phone strings** (ASR data), so it would need forced alignment to yield a word
lexicon — the same work `build_cle_referee.ts` did for CLE, and a real future gold source rather
than a download; `krishnAbadikelA/*` and `mugezhang/*` `pair_hindi_urdu_ipa*` are sentence corpora
IPA-transcribed by **MMS**, i.e. model output, not a lexicon; `Humair332/Urdu-ONYX-Phonemes` ships
no data files. Run 8's rejections of zuhri and mahwizzzz are **confirmed on this uniform metric**
(Run 8 measured them by ad-hoc agreement; the margins above say the same thing more usefully).

### The one that clears it, and what it is not

`humair025/urdu-g2p-dictionary` — 634,981 entries, 323,256 of them single words. Three checks:

- **It is not a Wiktionary scrape.** Only 9,018 of its entries are in our kaikki-sourced lexicon.
  On CLE words **outside** that lexicon — the actual OOV tail, which Run 10 measured at ~50% — it
  scores **71.0% against a 56.2% prior**, where our backbone scores **48.4%**. It keeps its
  accuracy exactly where we need it.
- **It is not espeak-ng.** The card advertises espeak-ng as the *library's* OOV fallback, which
  raised the obvious worry. Scored directly, **espeak-ng `-v ur` gets 52.1% (−6.8pp)** — it does
  restore short vowels, but no better than chance against the prior — and the dictionary agrees
  with it on only **22.5%** of 5,121 shared words after notation folding. Different, and far
  better, than an espeak dump.
- **It is not our own rules**: 74.0% against our backbone's 51.4%.

⚠ **Provenance is undocumented.** The card states no method and its licence link
(`github.com/humair-m/urdu-g2p`) **404s**. The +15.1pp on an independent human corpus bounds the
quality from below whatever the origin, but it does **not** establish the entries are
human-authored; they may be some other model's output, in which case using them is distillation.

⚠ **Licence is NON-COMMERCIAL** (`license: other`, `license_name: non-commercial`). That is
stricter than anything in this repo. `LICENSES/PROVENANCE.md` §3 covers **share-alike**, and the
Afrikaans RCRL note records "Share-alike, **not** NonCommercial" as precisely what makes that
source shippable. **An NC source cannot ship here — and because this repo declares models to
inherit their training data's licence, a tagger trained on it cannot ship either.** So the
measurement below answers the research question; it does not hand us a deliverable.

## Run 16 — 2026-08-09 — Phase C: the dev set was the confound, and the tagger DOES generalise

Phase B (Runs 13-15) scored every model against a **Hindi-derived** dev set. Run 6 established
that Hindi and Urdu diverge systematically on Arabic-template loanwords (احساس Hindi eːɦsɑːs vs
Urdu ɪɦsɑːs) and Run 8 found the independent CLE corpus siding **Urdu-native ~2:1**. So Phase B
was penalising an Urdu-native-trained model for being RIGHT. Phase C removes the confound: train
with **every CLE word held out**, then score against **CLE** on the same short-vowel-choice metric
every candidate source was measured with.

| training data | vs CLE | always-ə | **margin** |
|---|---|---|---|
| gold 9,016 only | 59.6% | 59.0% | **+0.6** |
| HF labels 260,453 (CLE held out) | 66.4% | 58.9% | **+7.5** |
| **gold + HF labels** | **67.6%** | 58.9% | **+8.7** |

**The tagger generalises.** On words it has never seen it recovers 67.6% of a 74.0% teacher and
beats the prior by **+8.7pp**, judged by a referee independent of everything it trained on.

⚠ **The first row is the finding that matters most.** Our 9,016-pair "gold" pool scores **+0.6pp
— at the prior** — against an Urdu-native human referee. It is Hindi-convention data graded by a
Hindi-convention dev set: internally consistent, but not measuring Urdu. **Runs 3, 4 and 11 all
closed the tagger on exactly that pairing.** The "informational ceiling" was in substantial part
an artifact of the referee, not a property of the language.

### Scale vs label quality, separated

Two sources differ on both axes, so the big one was capped to the small one's size:

| labels | quality | n | gold+labels vs CLE |
|---|---|---|---|
| Dakshina (CC BY-SA 4.0) | 63.4% | 27,463 | **−1.0** |
| HF dict (NC) | 74.0% | 27,463 | **+5.0** |
| HF dict (NC) | 74.0% | 260,453 | **+8.7** |

At matched scale, **label quality is worth +6.0pp**; a 9.5× increase in scale at fixed quality is
worth a further **+3.7pp**. Quality is the larger lever, and it is the one Dakshina cannot buy:
at −1.0pp with its *entire* 30k pool spent, extrapolating the scale term would still leave it
around the prior. **The licence-clean source is not viable at any size.**

### Referee health (user asked, and it reframes every number above)

The verdict now rests entirely on CLE, so: **wikipron vs CLE agree 88.2%** on short-vowel choice
over a common 1,436-word set. Two independently-built human sources tracking each other that
closely IS the health certificate — a noisy referee could not do it. But it also means the
**ceiling is ~88%, not 100%** (CLE is *speech*, judged at word level; Run 9 catalogued the
residual — final-ہ length, ain-ʔ, bidirectional epenthesis, and 17.7% of wikipron types carry
>1 attested pronunciation). Every figure in Runs 12-16 should be read against 88%.

Re-scored on that one common set, with prior and difficulty held constant:

| | short-V acc | margin |
|---|---|---|
| wikipron — the other human referee (**ceiling**) | **88.2%** | +25.1 |
| humair025 HF dictionary | 80.2% | +17.1 |
| Dakshina romanization | 68.7% | +5.7 |
| *always-ə prior* | *63.0%* | — |
| **our default-ə backbone** | **55.2%** | **−7.8** |

⚠ **Our lexicon-free backbone is 7.8pp BELOW always-ə.** On OOV words the rule engine's schwa
placement is worse than guessing ə everywhere. That is the shipped OOV path, and it resets the
target: not 88%, but **beating 63.0%** — which we currently do not.

⚠ **Unaudited referee risk.** `build_cle_referee.ts:61-62` keeps the majority CISAMPA reading per
skeleton but **discards the count and the runner-up**, so a hapax carries the authority of a 50×
word. The source corpus is not on disk, so attestation stratification was not possible. The 88.2%
agreement bounds how bad this can be, but it is a real provenance gap in a referee now carrying
this much weight — worth fixing before CLE adjudicates anything further.

### Where this leaves Urdu

- The tagger is **viable** — +8.7pp over the prior on unseen words vs an independent human referee.
  Runs 3-4's negative does not survive a non-Hindi-convention evaluation.
- It is **not shippable**: the only source at the required label quality is **non-commercial**
  (PyPI `urdu-g2p` 2.0.1, "Commercial use of any kind is strictly prohibited", with a DATA NOTICE
  covering the dictionary; classifier `Other/Proprietary`), and this repo declares models to
  inherit their training data's licence. Its provenance is also undocumented, so training on it is
  distillation of an unknown system.
- The **licence-clean lever that remains** is not a model: the Dakshina lexicon tier, +12.0pp over
  the backbone on the OOV tail by lookup (Run 13), CC BY-SA 4.0, fits the §3 stratum.
- The **route to a shippable tagger** is a licence-clean source at ~74% label quality. The
  concrete candidate is `asadullah797/urdu-phoneme-dataset` — human-labelled ASR audio needing
  forced alignment, i.e. the work `build_cle_referee.ts` already did once for CLE.

### ⚠ Correction to the Dakshina lexicon-tier recommendation (same run, later measurement)

Runs 13 and 16 both pitch the Dakshina tier as "+12.0pp over the default-ə backbone". That is
true but it is measured against **the wrong baseline**, and Run 16's own common-set table is what
exposes it: the backbone scores **55.2% against an always-ə prior of 63.0%**. Beating a baseline
that is itself 7.8pp below "guess ə everywhere" is not the achievement it looks like.

Against the correct baseline the Dakshina tier is **68.7% vs 63.0% — +5.7pp**, not +12.0pp. Still
positive, still licence-clean, but less than half the headline, and a large part of the apparent
gain is recoverable by simply fixing the backbone's schwa placement instead — a rule change with
no new data, no share-alike fence and no lexicon tier at all. **That is the cheaper thing to try
first**, and it is the same lever for every OOV word rather than only the 30,280 Dakshina covers.

`silver.dakshina.tsv` is therefore NOT committed. It is regenerable in one command
(`ur_build_dakshina_labels.py`), the finding is recorded here, and adding a §3 share-alike fence
to carry a +5.7pp artifact of unproven value is not a trade worth making yet.

## Run 17 — 2026-08-09 — the "cheap rule fix" does not exist, and the metric that suggested it has a blind spot

Tried the schwa-placement fix Run 16's correction recommended. **It fails, the recommendation was
based on a flawed metric, and the correction itself over-corrected.** All three, in order.

### What the engine actually does

`g2p.ts:155-162` inserts a default [ə] after EVERY non-final consonant (maximal), then
`finalizeUrduIpa` applies `deleteMedialSchwa` — Ohala's **Hindi** VCəCV rule — to take some back.
Diagnosed against CLE: the backbone emits **only ə (100.0%)**, so it has no vowel-QUALITY errors
at all; its entire deficit is **placement**. Only 74.9% of words get the schwa count right
(13.3% too few, 9.4% too many). Two opposite error classes:

- **too many** — word-final CəC: آنکھ→ɑːn**ə**kʰ vs CLE ɑːnkʰ. Ohala cannot touch these (it needs
  a following vowel), so they survive.
- **too few** — medial VCəCV: آخری→ɑːxɾiː vs CLE ɑːx**ɪ**ɾiː; اتھارٹی→ət̪ʰɑːɾʈiː vs ət̪ʰɑːɾ**ɪ**ʈiː.
  Ohala deletes these; Urdu keeps them.

### Two candidate fixes, both measured

Dropping the final-cluster schwa: **worse** (46.0% vs 50.3%) — it fires everywhere, and the 9.4%
it fixes is swamped by the majority where that schwa is right.

Removing the Ohala deletion looked like a **win on two independent referees** — CLE 50.3→52.5
(+2.2pp), wikipron 55.7→57.6 (+1.9pp). So it was implemented and run against the actual eval:

| | primary (wikipron) | symbol | secondary (CLE) | symbol |
|---|---|---|---|---|
| ships today | **56.8%** | 87.4% | **59.4%** | 88.1% |
| Ohala deletion removed | **41.3%** | 85.2% | **43.3%** | 85.3% |

**−15.5pp word-exact.** Reverted; `src/` is clean and the eval is byte-identical to baseline
(4382/7709, 3364/5667).

### ⚠ Why the two metrics disagreed — the blind spot

The short-vowel-choice metric used throughout Runs 12-16 scores **only slots where the GOLD has a
short vowel**. A spurious inserted vowel aligns to nothing and therefore **costs nothing**. So the
metric sees only half of a placement change:

| | exact-count | **over-inserts** | under |
|---|---|---|---|
| core | 74.2% | **10.1%** | 15.7% |
| raw (no deletion) | 55.4% | **35.0%** | 9.6% |

Removing the deletion cut misses (15.7→9.6) while **tripling insertions (10.1→35.0)** — the metric
counted the first and ignored the second. Word-exact and symbol accuracy (phone-error-rate) see
both, which is why they inverted the verdict. **Any future placement claim must be checked on PER
or word-exact, never on the short-vowel-choice metric alone.**

⚠ **The source rankings in Run 16 SURVIVE this.** Over-insertion rates there are comparable —
wikipron 6.8%, HF dict 11.6%, our backbone 9.8% — so no source was flattered by the blind spot.
The flaw hit the *variant* comparison (where insertion rates differ 3.5×), not the *source* one.

### ⚠ Correcting the correction: the Dakshina tier is worth ~+13pp, not +5.7pp

The previous section rewrote "+12.0pp over the backbone" down to "+5.7pp over always-ə" and called
the backbone comparison the wrong baseline. **That over-corrected.** The always-ə prior is an
ORACLE: it presupposes knowing where CLE's short vowels fall, and scores 100% of the ə-slots for
free. No g2p has that — placement is most of the problem (this run: all of it). It is a useful
*ceiling* for an all-ə system, not an alternative anyone could implement.

The Dakshina overwrite **preserves the backbone's vowel count and position exactly** and changes
only quality, so backbone-vs-Dakshina is a genuine like-for-like: **55.2% → 68.7%, +13.5pp** on
the common set (+12.0pp on Run 13's). That is the honest number, and the original framing was
right. The "cheaper rule fix first" advice that replaced it is **withdrawn — it was tried here and
it does not exist**: the placement policy that ships is already better than both alternatives
tested, and the backbone has no quality errors left to fix, only placement ones that neither
candidate rule improves.

### Where this leaves the schwa question

Placement is a real weakness (25% of words get the count wrong) and it is worth ~8.6pp *if* solved
perfectly — but it is not reachable by a cheap rule. Both obvious rules are net-negative, and the
two error classes pull in opposite directions, which is what a genuinely lexical problem looks
like. This is the same wall Run 6 hit from the other side: 84% of misses differ by schwa MOVEMENT,
"no clean rule" (Run 9). **The lexicon tier, not a rule, remains the licence-clean lever.**

**Harness:** `ur_emit_raw.ts` (emits raw g2p + finished core so placement policies can be compared
offline without editing the engine).

## Run 18 — 2026-08-09 — sizing the lexicon tier on RUNNING TEXT (the type/token gap)

Urdu already ships a lexicon: `lexicon-ipa.tsv`, **11,356 entries** (Run 5/7 — kaikki-urd primary,
Hindi cross-script fill), consulted before the default-ə core. So the question is not "build a
lexicon" but "does the new data extend the one we have, and by how much where it matters".

⚠ **Urdu had no frequency list**, which is exactly what turned the Afrikaans lexicon decision
(af Run 20: a dictionary-shaped referee over-samples rare Latinate words; real text is short and
native). Fetched hermitdave FrequencyWords 2018 `ur_full` — **9,592 types / 262,138 tokens**.
⚠ Thin, and OpenSubtitles register (conversational); formal/technical Urdu would have a longer
tail, so the weighted numbers below are a LOWER bound on the tier's value for formal text.

### Coverage

| | running-text token coverage |
|---|---|
| current lexicon (11,356 types) | **76.6%** |
| + Dakshina tier (**29,649** new types) | **89.5%** (+13.0pp of all tokens) |
| still falling through to the default-ə core | 10.5% |

### Value on the SERVING path

Config A = ships today (curated → lexicon-ipa → core). Config B = A with a Dakshina tier inserted
above the core. Scored vs CLE, short-vowel choice:

| | unweighted | **frequency-weighted** |
|---|---|---|
| A — ships today | 65.8% | **80.9%** |
| B — + Dakshina tier | 72.2% | **82.1%** |
| delta | **+6.5pp** | **+1.3pp** |

It serves 2,431 of the 3,535 CLE words currently falling through to the core.

⚠ **Run 17's blind spot does NOT apply here**, and this is the one comparison in this file where
that is provable rather than assumed: the Dakshina overwrite preserves the backbone's vowel count
and position exactly, so A and B have **identical placement** and differ only in quality.
Insertions cannot differ between them, so the metric cannot be fooled.

### Verdict: real, but marginal — and the two numbers say different things

**+6.5pp on dictionary-shaped words, +1.3pp on running text.** The gap is the type/token effect:
the frequent words are already in the 11,356-entry lexicon, so the new tier mostly serves the
rare tail. For scale, the Afrikaans RCRL lexicon was justified by **≈10.5pp of ALL running-text
tokens** — this is +1.3pp, an order of magnitude less compelling.

Against that it costs: a 36k-entry shipped file, a **§3 share-alike fence** + NOTICE attribution
(Dakshina is CC BY-SA 4.0), and a third lexicon tier to reason about in precedence. **My reading
is that +1.3pp does not buy that**, with one exception worth stating: if the target is OOV/rare-word
quality — proper nouns, unusual text, TTS of formal register — then +6.5pp is the relevant figure
and the trade looks different. That is a product call, not a measurement.

**Cheap and uncontroversial regardless:** commit the frequency list as
`tools/referee-eval/freq/ur.txt` (the repo already ships `af.txt` from the same source under the
same licence) and turn on the frequency-weighted metric for ur. Every accuracy claim in this
investigation is dictionary-shaped without it, and Run 10's headline numbers would gain a
real-text counterpart — the 80.9% above is the first such figure Urdu has ever had.

### ⚠ Run 18 addendum — the committed `freq/ur.txt` is FILTERED; Run 18's figures used the raw list

Run 18 was computed on the raw hermitdave list (**9,592 types / 262,138 tokens**). The list
committed as `tools/referee-eval/freq/ur.txt` is filtered to letters-only, matching the shape of
the existing `nb.txt`/`af.txt`: **9,181 types / 246,155 tokens**. Two filters — 403 non-Urdu-script
types (Latin runs and Latin punctuation) and **8 Arabic-range punctuation types**. The second was
caught in review of #780: ⟨،⟩ and ⟨۔⟩ are ranks 2 and 4 by count, so a naive script-range filter
keeps them and they alone are 5.6% of the token mass.

The eval's frequency-weighted numbers are **unchanged** by the filter (66.3% / 79.6% before and
after) — only referee words receive a weight, and punctuation is never a referee word. But Run 18's
coverage figures (76.6% → 89.5%) and serving-path figures (80.9% → 82.1%, +1.3pp) were computed on
the raw list and are **not exactly reproducible from the committed artifact**; recomputed on the
filtered list they would shift slightly. The +1.3pp conclusion — that the tier is not worth a §3
fence — does not depend on that precision.
