# af-g2p-tagger.int8.onnx — provenance

**Artifact:** `src/languages/afrikaans/af-g2p-tagger.int8.onnx` (2.2 MB) + `af-g2p-tagger.meta.json` — the
neural OOV tier for Afrikaans. A per-grapheme BiLSTM tagger: char-embedding → 2-layer BiLSTM → per-position
head labelling each letter with an IPA CHUNK, served through the shared `core/structuralTagger.ts` contract.
Trained by `tools/afrikaans/train_af_bilstm.py`.

## Why af has one, and why only now

The rule engine reads ~87% of running-text tokens exactly, and the two shipped lexicons cover 86% of them
outright. The residual is the part rules cannot reach: **stress placement is 74.8% overall and falls to
40% at eight syllables**, and a perfect-stress oracle is worth **+1168 words (4.3pp)** on the 27k secondary
referee. That residual is *contextual*, not tabulable — the one class in this language where a model has
something to do that a rule does not.

It also had to wait for data. Earlier analysis (docs/afrikaans_stress_investigation.md, Run 9) found af had
**2,220 labelled pairs, and they were the eval referee** — below the repo's measured ~10k starvation line
*and* circular. Importing RCRL fixed both.

## Held-out results

**4,096** words held out by md5 of the word (90/10, the house policy). The aligner, vocabulary and model saw
only the 28,448-word train split.

⚠ **THE SPLIT MUST BE TAKEN BY GOLD PROVENANCE.** 223 of the held-out rows carry labels the vetting
*substituted from the rules* (the long vowels neither source can write). On those the rule engine scores
**100% by construction**, so a whole-set comparison flatters it — 65.5% instead of 63.5%, which is exactly
what #778's first draft reported. `af-g2p-data.tsv` now carries a `gold` column (`dict` | `rule`) so the
honest split is reproducible rather than reconstructed.

| held-out subset | | rule engine | **BiLSTM tagger** |
|---|---|---|---|
| **dictionary-gold — the honest comparison** | n=3,873 | 63.5% / 93.5% symbol | **93.0% / 99.0% symbol** |
| rule-substituted gold | n=223 | 100% *(by construction)* | 74.0% |
| whole set | n=4,096 | 65.5% | **92.0% / 98.8% symbol** |

⚠ **These are the PACKED-TRAINING numbers (2026-08-19).** The model shipped before that date was trained on
padded batches without `pack_padded_sequence`, so the BiLSTM's backward direction crossed the padding before
reaching each word's last grapheme while serving (batch=1) starts it cleanly there — damage concentrated at
the END of the word. Same split, same seed, same data: **90.5% → 92.0%** whole-set, 91.4% → 93.0% on
dictionary-gold (98.7% → 99.0% symbol). ⚠ The pre-fix baseline reproduced the historical 90.5% to the decimal,
which is what makes the pairing trustworthy — the difference is the packing and nothing else. That earlier
number was not a worse dataset or a worse architecture, it is this model trained through a plumbing bug. See
`tools/bilstm_training/tagger.py` and investigation Runs 41 and 43.

**An 81% relative reduction in word error** on the dictionary-gold rows (36.5% → 7.0%; it was 76% before the
packing fix). ⚠ The rule engine's number here is *lower* than its 79.5%
referee score because this split is dictionary-shaped — long, rare, Latinate words — which is exactly the
population the OOV tier serves.

## Training data

`tools/afrikaans/af-g2p-data.tsv` — **32,544 vetted pairs**, built by `tools/afrikaans/build_af_g2p_data.ts`
from the union of both open Afrikaans pronunciation dictionaries:

| source | entries | licence | contribution |
|---|---|---|---|
| RCRL Afrikaans Pronunciation Dictionary v1.4.1 (CTexT/NWU via ttslab/za_lex) | 27,428 | CC BY-SA 2.5 ZA | 27,385 |
| NCHLT-inlang Afrikaans (DAC / CSIR / NWU, via SADiLaR) | 15,094 | CC BY 3.0 | 5,159 |
| — rejected by vetting | | | 42 |

⚠ **~31k is the CEILING for this language.** The third open dictionary, **Lwazi Afrikaans** (4,998,
CC BY 2.5 ZA), was checked and adds **zero** headwords — every one is already in RCRL. There is no
nb/da-scale (199k NST) Afrikaans resource and searching will not produce one. For scale: the repo's measured
starvation line is ~10k pairs and the shipped Sindhi tagger trains on 9,274, so af sits mid-fleet — above sd,
below bn's ~60k.

⚠ **The two sources are NOT independent** — 96.6% identical on their 9,871-word overlap, same NWU/CSIR
lineage (NCHLT was "created using existing resources, then verified by language practitioners"). That is
fine for TRAINING, where the value is coverage, and disqualifying for REFEREEING, which is why NCHLT is not
wired as a referee. See `tools/afrikaans/nchlt_afr.PROVENANCE.md`.

Every pair is **vetted against `phonemizeWordRules`** by the same rules the shipped lexicon uses — the
dictionary wins on lexical knowledge, the engine wins on systematic phonology (final devoicing, schwa
epenthesis in /rm, lm/, dropped onsets, implausible rows).

⚠ **ONE DIVERGENCE FROM THE LEXICON'S VETTING, and it matters.** For the long vowels neither source can
write (ɛː œː yː …) the shipped lexicon DROPS the entry; the training set **substitutes the rule output**
instead. Dropping them here was a defect: it removed ⟨ê û î⟩ from the character vocabulary entirely, so
the tagger declined on them (safe but inert), and left ⟨uu⟩ HALF-learned — ⟨u⟩ is in vocab, so the model
did not decline and emitted `natuurlik` → *natœœrlək* for natyːrlək. The rules derive that length
deterministically from the spelling, so for exactly this class they are the authority and the model should
be taught it. Caught by the af frequency list (Run 20), not by the held-out split.
⚠ The substitution is still subject to the plausibility guard: without it, four loanwords whose rule output
is flatly wrong (`blues` blyːəs, `judo` jyːdu, `duvet`, `buys`) became training labels.

## Convention

⚠ **No stress marks in the tag alphabet**, unlike the Norwegian tagger. af emits no stress by convention;
the stress information lives in the VOWEL QUALITY (reduction + open/closed length), which is what the model
learns. Keeping ˈ would also have meant training on RCRL alone, since NCHLT has none.

## Serving

Precedence in the async path (`afrikaansNeural.ts`): **curated `af-lexicon.tsv` → `af-rcrl-lexicon.tsv` →
tagger → rules.** The tagger sits below the dictionaries because they are exact where they apply, and above
the rules because on the words neither covers it is far better. It is injected as the sync engine's
`oovOverride`, so tokenizer, numbers, normalization and clause assembly stay byte-identical to
`phonemize(text, "af")` — **only OOV word readings change**, and the sync path is untouched.

`onnxruntime-node` is optional: absent it or the model, `createAfrikaansTagger()` resolves to `undefined`
and the async entry returns exactly the sync path.

## Hyperparameters (provenance — the committed graph was trained at these)

`hid=256`, `batch=256`, `log_every=5`, 40 epochs, 8 EM alignment iterations, `SEP=""` (single-codepoint IPA
chunks), seed 0. Exported at opset 17, then `quantize_dynamic` to QUInt8 — 8.7 MB fp32 → **2.2 MB**.

## Licence

The weights reproduce licensed pronunciation data, so they are declared **CC-BY-SA-inheriting** and fenced
like the data — the same treatment as `french/fr-g2p-tagger.int8.onnx` (Lexique). RCRL's share-alike term
governs the combination; NCHLT's CC BY 3.0 is attribution-only and compatible. Attribution for both is in
NOTICE.md.
