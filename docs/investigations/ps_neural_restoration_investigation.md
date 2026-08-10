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

## Continuation — 2026-07-16 — the و-glide (verbal -ول) via g2p epenthesis + inverter glide options

The biggest remaining residual was the و glide/vowel ambiguity (~117), dominated by the verbal infinitive
**-ول = /awəl/** (استول→əstawəl, we read و→o→əstol). This is a DATA/mining problem, not a rule (word-final ول is
ambiguous: verb کول→kawəl vs noun پول→pul, so no blanket rule — it must be mined per-word against the referee).

Two coordinated changes let the miner reach the glide reading:
1. **g2p (engine): a glide before a consonant epenthesises ə** (کَول→kawəl, not kawl) — mirrors the consonant
   branch's INH insertion; the glide behaves like a coda consonant. Fires ONLY when و/ی is a genuine glide (after
   a vowel), so bare skeletons (و = long vowel) are unchanged → gold green.
2. **inverter: WAW_OPTS gains fatḥa/kasra** — a short vowel on the pre-و consonant makes the g2p read و as a glide
   [w]. The referee fold-match then disambiguates verb (glide, awəl) vs noun (long vowel, pul) PER WORD.

Re-mined: ps silver 623→647 labeled, shipped restoration lexicon 232→251 entries. **25/38 ول-final verbs now
match.** SYNC eval: wikipron 45.7%→**47.7%**, kaikki 50.0%→**52.8%**. Gold green; numbers unaffected; typecheck clean.

Remaining ceiling: multi-dialect ښ/ږ (~129, inherent), the و-glide words the referee attests with a form the g2p
can't reach (foreign/irregular), and short-vowel/epenthesis noise — the documented abjad + multi-dialect tail.

### Review fix — glide+cluster ambiguity made lexicon-correctable
The glide-epenthesis over-fired on glide+consonant-CLUSTER (ښایسته→ʂɑjəstə; the referee attests ʂɑjsta, no schwa),
and — worse — it wasn't lexicon-correctable (the ə was forced at the glide step). Fix: the epenthesis is SUPPRESSED
by a sukun on the post-glide consonant (ښایسْته→ʂɑjstə), so the distinction (راوستل WANTS the ə, ښایسته doesn't —
lexically ambiguous) is mineable/lexicon-correctable per word. The miner recovers the ښایسته class → wikipron
47.4%→47.7%, kaikki 52.4%→52.8%. The و-glide options are gated to ps in the shared miner (WAW_GLIDE_OPTS).

## Continuation 2 — 2026-07-16 — final -ی /ai/ diphthong (the g2p-unlock-then-mine pattern again)

The un-invertible analysis (answering "data-bound?") showed the ceiling is NOT mostly data-bound: only ~28 words
are the hard multi-dialect floor; the bulk are G2P-COVERAGE gaps that unlock a mining class each. The biggest was
final -ی → /ai/ (~89): the adjectival/-ay suffix (سړی saɽay) which our g2p read as the long vowel /iː/.

**g2p (engine):** a WORD-FINAL و/ی after a vowel is the DIPHTHONG offglide ʊ/ɪ (سړی→saɽaɪ, لوی→loɪ), not the
consonantal glide j/w (a medial glide, دنيا→dənjɑ, is unchanged). The referee's offglide ɪ folds to ə (matching
the fold), where our old glide j did not.
**inverter:** a consonant before a word-final ی gains a [BARE, FATHA] slot — bare→iː (long), fatḥa→the -ay
diphthong. Per-word mined vs the referee, so genuine /iː/ finals (اغزی→aɣzi) and -ay diphthongs (اغزَی→aɣzaɪ)
are disambiguated. (The و word-final diphthong is already covered by WAW_GLIDE_OPTS.)
**+ ɻ~ɽ fold:** ړ is our retroflex approximant ɻ (folded to r) but the referee writes the flap ɽ — same phoneme,
notation only. Extended the ɻ→r fold to [ɻɽ]→r; recovered the ړ words (سړی).

Result: shipped restoration lexicon 256→**327 entries**; SYNC eval wikipron 47.7%→**53.8%**, kaikki 52.8%→**60.8%**.
Gold + numbers unaffected; only ps changed. This confirms the diagnosis: Pashto is g2p-coverage-bound, not
data-bound — each g2p gap (‑ول glide, ‑ای diphthong) unlocks a class the existing mining then restores per-word.
The hard multi-dialect floor (~28 words, ~2%) remains.

## Continuation 3 — 2026-07-16 — medial و-glide (الوتل→alwətəl), the closer

The last sizable clean lever from the un-invertible analysis: the MEDIAL و-glide (~59), the الو- cousin of the
-ول suffix. Here و is a glide directly after a consonant (cluster lw), which the g2p never produced (it only
glides و after a vowel). Same g2p-unlock-then-mine pattern:
- g2p: an explicit-glide marker — a sukun on و/ی (وْ/یْ) → the consonantal glide w/j (a cluster onset, not a
  nucleus): الوْتل→alwətəl vs the bare long-vowel الوتل→alot̪əl. Consumes the sukun; epenthesis before a next
  consonant. Bare skeletons (no sukun) unaffected → gold green.
- inverter: a medial و between two consonants gets a [BARE, SUKUN] slot (long vowel vs glide), mined per-word.

Result: shipped restoration lexicon 326→**351**; SYNC eval wikipron 53.8%→**55.7%**, kaikki 60.8%→**63.0%**.

## Where Pashto stops — the honest ceiling

The high-value g2p levers (-ول glide, -ای diphthong, medial و-glide) are now SPENT. The remaining misses (~625)
are ~30% HARD data-bound — multi-dialect ښ/ږ (129, the referee spans ʂ~x~ç / ʐ~ɡ~ʝ; unfoldable without merging
خ/ګ) + letter-name referee artifacts (65) + dialect consonant variants (ف→p, ځ→z) — and the rest is a long tail
of small, increasingly-ambiguous reading disambiguations (word-initial و, و=u/o, epenthesis position) with steep
diminishing returns. The realistic ceiling on THIS referee is ~60-65%; the gap is REFEREE-bound (multi-dialect +
artifacts), not engine-bound. Pashto arc: 35.4%→55.7% wikipron / 63.0% kaikki, entirely via the data/engine
layer — the neural was never the lever (net-negative throughout, as for Persian).

## Data-source finding — 2026-07-16 — a DIALECT-CONSISTENT referee (breaks the multi-dialect "ceiling")

Asked whether more data / a literary reference could lift the ~30% multi-dialect ceiling. Findings:
- **kaikki Pashto TAGS the dialect** on every pronunciation (Kandahar/Northern/Peshawar/Southern/…) + tags the
  letter-name artifacts (letter/name/phoneme). So the "multi-dialect ceiling" is a REFEREE-AGGREGATION artifact,
  not the data: the aggregated referee marks us wrong for reading ښ as our Kandahari ʂ when it recorded the
  Peshawar x for that word. Filtering to the **Kandahari/Southern** slice (matching our ʂ/ʐ engine), excluding
  letter-names, gives **69.5%** vs 55.7% (multi-dialect wikipron) / 63.0% (aggregated kaikki) — ~13pp of the gap
  is dialect-mismatch penalty, NOT engine quality. (88/114 ښ/ږ words in the slice use ʂ/ʐ, matching us.)
  Wired as a dialect-consistent SECONDARY referee: `ps.kaikki-kandahari.tsv` (98 words).
- **NOT more data.** It's the same Wiktionary source, just dialect-tagged; the Kandahari slice is small (~139
  pairs). There is NO larger machine-readable Pashto IPA corpus — wikipron (~1400) + kaikki (~1650) is the
  ceiling; the Pashto NLP repos (nlpashto, pashto-text-dataset) are text/POS, no pronunciations. Pashto is
  genuinely under-resourced.
- **Literary references (descriptive, back the methodology):** MacKenzie, *A Standard Pashto* (1959) — the
  canonical standardization; the ښ/ږ are his dialect-diagnostic sounds (ṣ̌/ẓ̌ abstracting ʂ/x/ç). Penzl, *A
  Grammar of Pashto* (1955) — the standard phonology. Not datasets, but they legitimize grading a coherent
  single-dialect engine against a single dialect rather than the aggregated referee.

CONCLUSION: the remaining Pashto gap is METHODOLOGICAL (multi-dialect referee), not engine- or data-bound — the
true single-dialect quality is ~69%. The primary wikipron floor stays multi-dialect (not gamed); the Kandahari
secondary reports the fair number. This is the right place to STOP engine work.

## Run 4 — 2026-08-10 — the data hypothesis, tested with 25× the data and REFUTED

The 2026-07-16 conclusion ("do NOT retrain/wire the neural") was correct, and this run establishes that it was
correct for a *stronger* reason than the one recorded. The doc attributed the failure partly to data
starvation — ps silver was 770 rows, 78% all-bare, against a repo starvation line of ~10k pairs. That
hypothesis is now testable, because the doc's other claim turned out to be wrong.

**"There is NO larger machine-readable Pashto IPA corpus" was a tooling artifact.** espeak-ng ships
`dictsource/ps_list` — **82,583 word→pronunciation entries** (Hanif Rahman, updated April 2025), plus 1,513
lines of letter-to-sound rules and a 729-line phoneme table that declares an explicit `ipa` string for every
phoneme. It was missed because `tools/normalization/sources.ts` gates its espeak tier on `$ESPEAK_NG`, which
was unset, so it printed *"espeak does not ship this language at all."* A false negative about the
environment, not a fact about espeak. (The same false negative reached the ps NORMALIZATION commit, whose
initialism refusal cites it — `ps_list` opens with a full letter-name table.)

**Pipeline.** `tools/pashto/build_espeak_silver.py` converts ps_list to the miner's (word, lang, IPA) shape
using the phoneme table's own `ipa` declarations — exact, not reconstructed from the mnemonics (`Q` is ʁ and
`S.` is ʂ; neither is recoverable by eye). 81,259 rows mapped; 1,290 had an unmappable segment and were
dropped rather than guessed. `invert_harakat.ts` then gained a ps tranche and a `--shard=k/N` flag: the
search is a per-word brute force over up to 60,000 vocalizations, each a full g2p call, and it is
embarrassingly parallel — 16 shards turned ~50 minutes of projected serial work into a few minutes.

```
82,287 candidate rows → labeled 19,400 (23.6%) · miss 60,196 · capped 2,691
silver: 770 → 19,400 rows        (25×, and 55.3% now carry a harakat, against 22% before the 2026-07-16 fix)
```

**The tagger.** `tools/pashto/train_ps_harakat.py` — a per-grapheme BiLSTM that predicts HARAKAT rather than
IPA chunks, unlike every other tagger in this tree. That choice is what makes espeak usable: espeak disagrees
with our dialect on ږ (`موږ` → ʁ where our Kandahari engine reads ʐ), so an IPA tagger would import that
reading, while a harakat tagger takes only espeak's VOWEL PLACEMENT and leaves the consonants to our g2p —
which already encodes the glide epenthesis, the -ی diphthong and the sukun-marked medial glide that Runs 1–3
built. It also cannot mis-align: a combining mark already sits after its consonant, so no aligner is needed.
Trained on 17,574 words, held-out per-position accuracy 94.3% — which is near the 85.7% majority-class floor
and measures agreement with espeak, not Pashto.

**⚠ AND THE FIRST EVAL WAS WRONG, IN A WAY WORTH RECORDING.** It reported an "OOV" column that looked
devastating (tagger 4.8% vs sync 9.1%). But "OOV" as defined there meant *the inverter could not label this
word* — i.e. NO vowel assignment reproduces the reference under our g2p. That is a biased-hard subset by
construction, and it measures the wrong thing. The fair test is words that ARE reachable but were held out of
training, by the same md5 rule the trainer uses:

| bucket (ex letter-names) | n | BARE | SYNC | TAGGER |
|---|---:|---:|---:|---:|
| wikipron TRAIN | 809 | 55.4% | 81.7% | 76.9% |
| **wikipron HELDOUT** | **101** | **46.5%** | **79.2%** | **49.5%** |
| wikipron UNREACHABLE | 396 | 0.8% | 0.8% | 1.0% |
| kaikki TRAIN | 628 | 61.5% | 93.3% | 87.6% |
| **kaikki HELDOUT** | **75** | **58.7%** | **94.7%** | **57.3%** |
| kaikki UNREACHABLE | 352 | 2.3% | 2.3% | 2.3% |

**Verdict: the data hypothesis is refuted.** On reachable unseen words the tagger is +3.0pp on wikipron and
−1.4pp on kaikki against doing nothing — a wash. 25× the training data moved nothing, so the 2026-07-16
failure was never about volume.

**And the ceiling is now quantified rather than inferred.** 396/1,306 (30%) of wikipron and 352/1,055 (33%)
of kaikki are UNREACHABLE — the inverter searched up to 60,000 vocalizations per word and no vowel assignment
reproduces the reference. Those words fail on CONSONANTS, the multi-dialect ښ/ږ, which is exactly what Run 3's
Kandahari-slice finding predicted (69.5% on a dialect-consistent slice against 55.7% aggregated). **No
deterministic vowel restorer can satisfy this referee**, neural or otherwise, because a third of it is not a
vowel question at all. The tagger is NOT shipped; the trainer and `eval_ps_tagger.ts` stay as the
documented negative.

**What DID move: the lexicon** — the same conclusion Run 1 reached ("the value was in the DATA/lexicon layer").

```
src/languages/pashto/lexicon.tsv   351 → 10,723 non-identity rows
running-text token coverage       2.80% → 5.78%   (13.4M tokens of ps.wikipedia)
referee                           UNCHANGED at 55.7% / 83.8%
```

⚠ **The referee cannot see this win, and that is not a defect in the win.** The old 351 entries were mined
FROM wikipron, so they already covered the referee's words; the 10,372 new ones are words wikipron does not
contain. Running text is where they land. ⚠ And 5.78% is the honest number, not the 37.2% that espeak's raw
word list covers: the export drops IDENTITY rows, because a word our g2p already reads correctly needs no
lexicon entry. 5.78% is the share of running tokens whose reading the lexicon CHANGES.

⚠ **LICENSING — AN OWNER DECISION, NOT TAKEN HERE.** `ps_list` is GPL-3.0, so the shipped `lexicon.tsv` is
now derived from a GPL source. The repo has an exact precedent (`wu/dict.tsv`, 101k entries from rime-wugniu,
shipped under a per-file GPL-3.0 fence per `LICENSES/PROVENANCE.md` §4.3) and currently lists espeak-ng under
"consulted without shipping anything". Moving it requires a PROVENANCE entry and the owner's call.

## Run 5 — 2026-08-10 — the real problem: we were grading a variety against a MACROLANGUAGE

Runs 1–4 kept hitting the same wall from different directions and each time called it a "multi-dialect
ceiling". That framing was too soft. **ISO 639-3 `pus` is a MACROLANGUAGE** — members `pbt` (Southern /
Kandahari), `pbu` (Northern / Peshawar), `pst` (Central / Waziri) — and `pashto.ts` declares one variety in
its own header ("Dialect: ښ/ږ = Kandahari retroflex ʂ/ʐ"). So we ship a `pbt` engine and grade it against a
`pus` aggregate. The primary referee's filename says it: `ps.wikipron-**pus**-broad.tsv`.

**This repo already treats every other macrolanguage the other way.** Arabic (`ara`) ships as `ar` plus ten
dialect codes, Chinese (`zho`) as cmn/yue/nan/wuu/hak/cjy/gan/hsn, Malay as id/zsm, Punjabi/Lahnda as pa/pnb —
and `macrolanguage umbrella` is an explicit `rejection_reason` in the catalogue schema. Pashto is the sole
macrolanguage carried as a single code with an umbrella referee.

**Measured, on the primary (ex letter-names):**

```
242 words are spelled with ښ or ږ — the dialect-diagnostic letters
 the referee lists NO reading in our fold-class for  102 of them
`زموږ` appears TWICE, as `z m u ʝ` and as `z ə m u n ɡ`      — two varieties, one headword
`اوږه` carries TEN readings in one entry: wáʐa | wíʒa | óɡa | óʝa | úɡa | úʐa | éʒa | jéʒa | ó ɡa | úʝa
```

⚠ **The scorer credits ANY listed variant**, so a ten-variant entry is not the harm — `اوږه` includes `óʐa`
and we score it. The harm is entries that list only *other* varieties, and those our engine cannot win by
construction.

⚠ **AND THE OTHER SOURCE IS NO BETTER — I CHECKED THE ONE I HAD RECOMMENDED.** Run 4 introduced espeak-ng's
`ps_list` and I described it as dialect-consistent with our engine, on the strength of the phoneme table's
comment ("ښ in Pashto - retroflex fricative") and six sampled words. Counted properly across all 82,583
entries that is **wrong**:

```
ښ  (2,605 words with exactly one)   ʃ 54.7%  ·  ʂ 29.6%  ·  x 21.7%
ږ  (1,833 words with exactly one)   ʐ 40.5%  ·  ʁ 20.1%  ·  ɡ 16.6%  ·  ʒ 13.8%
```

The table DEFINES `S.` as retroflex; the DICTIONARY uses `S`, `S.` and `x` for that letter across different
words. A phoneme definition is not a dictionary property. So wikipron, kaikki AND espeak are all `pus`
aggregates: **the entire machine-readable resource base for Pashto is macrolanguage-shaped**, which is why
every previous run found a ~30% floor it could not explain away.

### The fix that is available now: a variety-consistent slice of the SAME source

`tools/pashto/build_pbt_referee.py` filters the primary to entries that answer in our variety.

⚠ **THE FILTER IS A VARIETY FILTER, NOT A DIFFICULTY FILTER, AND THAT DISTINCTION IS THE WHOLE POINT.** It
would be trivial and worthless to raise a score by dropping words the engine gets wrong. So a word with NO
ښ/ږ is kept unconditionally, whatever the engine does with it; a word with one is kept only where some
variant realizes it in the fold-class our engine emits. Nothing else about the word is consulted.

⚠ **AND THE TEST IS THE EVAL'S OWN FOLD, WHICH I GOT WRONG FIRST TIME.** `langs/ps.jsonc` already folds
[ʂç]→ʃ and ʐ→ʒ, so Kandahari ʂ, Central ç and plain ʃ are ALREADY one class to the grader. My first filter
required a literal ʂ/ʐ and therefore dropped 166 entries the engine could already score, reporting an
inflated 63.2%. What the fold genuinely cannot absorb is Northern `x` (ښ) and `ɡ`/`ʝ` (ږ) — folding those
would merge خ and ګ, which are real contrasts. Corrected, the filter tests exactly that.

**Result, and its validation:**

```
wikipron pus (aggregate, primary)   787/1414 = 55.7%   symbol 83.8%
wikipron pbt (Southern slice)       787/1312 = 60.0%   symbol 85.0%
```

⚠ **THE HIT COUNT IS IDENTICAL — 787 AND 787.** Every line the filter removes is one the engine scored zero
on, so the entire +4.3pp is denominator: the correction removes questions asked in another variety and
nothing else. That equality is the evidence the filter is honest; without it the number would be a claim.

**The primary deliberately stays the aggregate.** It is the floor and must not be gamed; the slice sits beside
it as a secondary, alongside the 95-row kaikki Kandahari slice it supersedes in size (1,312 vs 95) while
reproducing its direction (69.5% there, 60.0% here — the kaikki slice is smaller and easier).

### What this means for the engine, and what it does NOT license

- The honest quality of the shipped Pashto engine is **60.0%**, not 55.7%. The ~4pp was never engine quality.
- It does **not** license relabelling `ps` as `pbt` in the registry. `ps` should stay a first-class code
  (the catalogue's belt-language policy is explicit that tiering the implementation is fine and erasing the
  code is not), and users typing `ps` should keep getting a working phonemizer.
- It does **not** rescue the neural tier. Run 4's tagger was a wash on reachable held-out words (+3.0pp /
  −1.4pp) and that is unchanged by re-grading — the residual it failed on is the same residual.
- The remaining honest gap is still not fully decomposed: 396 wikipron words are unreachable by ANY vowel
  assignment and only 62 carry ښ/ږ, so the variety split accounts for the largest identified class and not
  the whole of it. The rest (ف→p, ځ→z, diphthong and epenthesis variation) is probably the same phenomenon
  and has not been counted. Recorded as open rather than claimed.

## Run 6 — 2026-08-10 — the catalogue now says what is true: `pus` is not an implementable language

Run 5 established the category error and worked around it with a variety-consistent referee. The owner's
call went further, and is the right one: **you cannot say "these phonemes are correct for this Pashto
orthography" without naming a variety**, so a measured implementation of `pus` cannot exist and the catalogue
must stop claiming one.

```
ps    Pashto (macrolanguage)          unimplemented   macrolanguage umbrella   (no verdict)
pbt   Pashto (Southern / Kandahari)   implemented     🟡   normalization done
pbu   Pashto (Northern / Peshawar)    unimplemented   data scarcity
pst   Pashto (Central / Waziri)       unimplemented   data scarcity
```

This is the treatment every other macrolanguage in the tree already gets — Arabic→dialects, Chinese→
cmn/yue/…, Kanuri→knc — and Pashto was the last one carried as a single code with an umbrella verdict.

- **`pbt` is now a registered code**, resolving to the same engine as `ps` (`registry.ts`, the `ms`/`zsm`
  fall-through shape). The verdict, the referee counts and the espeak/normalization facts moved to that row.
- **`ps` keeps resolving at runtime**, because it is what callers type. That is a labelled approximation, not
  a claim — the umbrella row carries no verdict and no normalization.
- **`pbu` and `pst` are blocked on a referee, not on rules.** The Northern delta is ~2 lines (ښ→x, ږ→ɡ) and
  cannot be folded into the Southern engine, because that would merge خ and ګ. What is missing is anything to
  verify it against: the revisit trigger is a Northern-consistent slice, cut from the same aggregate the way
  `build_pbt_referee.py` cuts the Southern one by inverting the diagnostic.

⚠ **A GATE CAUGHT THE INCOMPLETE CHANGE, which is worth recording.** Adding `pbt` to the registry failed
`test/manifest-script.test.ts` — *"no script declaration: pbt"*. Every registered code must declare a script
either in a manifest or in `MANIFESTLESS_SCRIPTS`, and an alias has no manifest of its own. The check exists
because the field has no runtime consumer that would fail on a missing entry, so nothing else would have
noticed. Added to the manifest-less table beside `ms`/`zsm`.

**What is still open**, and is not resolved by relabelling: the 396 wikipron words unreachable by any vowel
assignment are only 62 accounted for by ښ/ږ. The rest (ف→p, ځ→z, diphthong and epenthesis variation) is
plausibly the same variety phenomenon and has not been counted. Counting it is what would tell us whether
`pbt` at 60.0% is near its true ceiling or still has engine work in it.

## Run 7 — 2026-08-10 — decomposing the 396: whose words are they, and why can't vowels fix them?

Runs 4–6 left this open and it is the question that decides whether `pbt` at 60.0% is near its ceiling.
The 396 are the wikipron words (ex letter-names) where the inverter searched up to 60,000 harakat
vocalizations and NONE reproduced the reference. Classified by cause, most specific first, each word once:

| | n | % | cause |
|---|---:|---:|---|
| **VARIETY** | **180** | **45%** | **not pbt's words at all** |
| | 141 | 36% | the WAZIRI back-vowel shift — we read و as o/u, every reference has ə/e/i (`املوک` əmlok vs əmlək, `الوبالو` əlobɑlo vs ələbɑlə) → **pst** |
| | 34 | 9% | ښ/ږ read Northern x/ɡ or Central c (`خواږه` xojʒə vs xwɑɡə) → **pbu** / **pst** |
| | 5 | 1% | ف read as p (`فرانسه` fərɑnsə vs prɑnsə) — Pashto has no native /f/ |
| **ENGINE** | **107** | **27%** | **pbt's own g2p, fixable in principle** |
| | 86 | 22% | و/ی realized as a GLIDE by the reference where we read a vowel (`اورول` orol vs əərəwəl) — the Run 1/3 class, reopened |
| | 11 | 3% | homorganic n→ŋ over- or under-applied (`فرانس` fərɑnəs vs frɑŋs) |
| | 9 | 2% | residual و/ی glide-vs-vowel |
| | 1 | 0% | initial ا read short by us, long by the reference |
| **NOTATION** | 6 | 2% | the reference writes an initial ʔ we do not (`اسلام` əslɑm vs ʔəslɑm) — no phonemic initial-ʔ contrast in Pashto, so arguably a missing fold |
| **unclassified** | 103 | 26% | dominated by the FINAL -ی DIPHTHONG — see below |

**The unclassified bucket is mostly one thing, and it is engine-side.** Decoding the raw referee rows:
`امريکايی` is `a m r i k ɑ j a ɪ` and `اوسېدونکی` is `o s e d u ŋ k a ɪ` — the word-final `-ay` diphthong,
TWO segments, where our g2p emits a single ə. Run 2 built exactly this rule (a word-final و/ی after a vowel
is the offglide ʊ/ɪ) and it is not firing on these spellings (ـايی, ـکی). 52 of the 396 (13%) differ from a
reference in nothing but the final one or two segments, which is the signature.

⚠ **This corrects Run 5's estimate.** Run 5 said "only 62 of the 396 are accounted for by ښ/ږ" and left the
rest open. That undercounted the variety share badly: once the Waziri vowel shift is counted, **180 of 396
(45%) are other varieties' words**, not 62. The ښ/ږ consonant test was the wrong instrument — Waziri differs
from Kandahari in its VOWELS, so a consonant-keyed probe cannot see it.

### The answer to "do they belong to pbt"

**Roughly half do not.** 45% are pbu/pst words that a Southern engine is correct to read differently, and no
amount of engine work will win them — they belong on those rows as evidence, not on pbt's ledger. The other
~53% (engine + notation + the diphthong tail) IS pbt's, and it is concentrated in two classes that are
already understood:

- the **و/ی glide-vs-vowel** ambiguity, ~95 words across two buckets — Runs 1 and 3 opened this and closed
  the -ول and medial cases; the reference's `əwrəŋɡzeb` for `اورنګزېب` shows the initial/other positions are
  still open;
- the **final -ی diphthong** on ـايی/ـکی, ~50-100 words — Run 2's rule exists and does not reach these
  spellings.

So `pbt` is NOT at its ceiling. A realistic bound: closing both classes is worth up to ~150 words of the
1,312-word Southern referee, i.e. roughly **60.0% → 70%**, without touching the multi-dialect residual at
all. That is ordinary g2p work of the kind Runs 1–3 already did, and it is a better use of effort than
anything on the neural side — which Run 4 measured as a wash.
