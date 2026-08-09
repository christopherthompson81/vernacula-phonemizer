# af-g2p-tagger.int8.onnx — provenance

**Artifact:** `src/languages/afrikaans/af-g2p-tagger.int8.onnx` (2.2 MB) + `af-g2p-tagger.meta.json` — the
neural OOV tier for Afrikaans. A per-grapheme BiLSTM tagger: char-embedding → 2-layer BiLSTM → per-position
head labelling each letter with an IPA CHUNK, served through the shared `core/structuralTagger.ts` contract.
Trained by `tools/afrikaans/train_af_bilstm.py`.

## Why af has one, and why only now

The rule engine reads ~87% of running-text tokens exactly, and the two shipped lexicons cover 86% of them
outright. The residual is the part rules cannot reach: **stress placement is 72.6% overall and collapses to
36% at eight syllables**, and a perfect-stress oracle is worth **+1189 words (4.3pp)** on the 27k secondary
referee. That residual is *contextual*, not tabulable — the one class in this language where a model has
something to do that a rule does not.

It also had to wait for data. Earlier analysis (docs/afrikaans_stress_investigation.md, Run 9) found af had
**2,220 labelled pairs, and they were the eval referee** — below the repo's measured ~10k starvation line
*and* circular. Importing RCRL fixed both.

## Held-out results

3,921 words held out by md5 of the word (90/10, the house policy). The aligner, vocabulary and model saw
only the 27,303-word train split.

| | word-exact | symbol accuracy |
|---|---|---|
| rule engine (`phonemizeWordRules`) | 64.0% | 93.6% |
| **BiLSTM tagger** | **91.8%** | **98.8%** |

A **77% relative reduction in word error**. ⚠ The rule engine's number here is *lower* than its 79.5%
referee score because this split is dictionary-shaped — long, rare, Latinate words — which is exactly the
population the OOV tier serves.

## Training data

`tools/afrikaans/af-g2p-data.tsv` — **31,224 vetted pairs**, built by `tools/afrikaans/build_af_g2p_data.ts`
from the union of both open Afrikaans pronunciation dictionaries:

| source | entries | licence | contribution |
|---|---|---|---|
| RCRL Afrikaans Pronunciation Dictionary v1.4.1 (CTexT/NWU via ttslab/za_lex) | 27,428 | CC BY-SA 2.5 ZA | 26,369 |
| NCHLT-inlang Afrikaans (DAC / CSIR / NWU, via SADiLaR) | 15,094 | CC BY 3.0 | 4,855 |
| — rejected by vetting | | | 1,671 |

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
dictionary wins on lexical knowledge, the engine wins on systematic phonology (final devoicing, the long
vowels neither source can write, schwa epenthesis in /rm, lm/, dropped onsets, implausible rows).

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
