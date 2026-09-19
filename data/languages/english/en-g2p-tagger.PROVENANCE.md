# `en-g2p-tagger.int8.onnx` provenance

A per-grapheme **BiLSTM** sequence-labeller that maps a bare OOV English word to canonical IPA — the neural **OOV** tier
for English (`phonemizeEnNeural`; inference in `englishTagger.ts`). It labels each **letter** with one **ARPABET-chunk**
tag in a SINGLE forward pass, then finishes the ARPABET the SAME way the sync n-gram path does — `enforceSinglePrimary`
+ `collapseGeminates` + `arpabetToIpa` (shared from `englishG2p.ts`), so a G2P word has no seam with the CMUdict
lexicon. Output length == input length → it cannot degenerate; a per-letter CONSONANT-consistency MASK (`charTags`)
keeps it from emitting an impossible tag; on an out-of-vocab letter it declines ("") and the word falls back to the
sync engine.

**Why a tagger, and why it replaces the n-gram.** English OOV is the classic hard G2P problem. The prior OOV path
(compound-split → morph → joint n-gram) is weak on the non-compositional tail (proper nouns, foreign/novel words), and
the noisy wikipron referee couldn't even measure it. On a CLEAN CMUdict 90/10 held-out
(11,748 words), the BiLSTM roughly HALVES the phone-error-rate:

| model (held-out, stress-independent phones) | WORD-exact | PHONE-accuracy (1−PER) |
|---|---|---|
| current pipeline (compound→morph→n-gram) | 42.7% | 81.8% |
| **BiLSTM tagger (this model)** | **71.5%** | **93.4%** (PER 6.6% vs 18.2% — 64% fewer phone errors) |

⚠ **RETRAINED 2026-09-19 ON THE MOBY-EXPANDED DICTIONARY (+15% data), AND THE HEADLINE IS THAT IT DID
NOT MOVE THE ORIGINAL POPULATION.** The dictionary went 117,483 → 135,308 rows between #1341 and this
run, almost entirely the Moby imports of #1344 and #1353. The md5 held-out split is deterministic, so
the old held-out population survives inside the new one exactly (n=11,748) and the two eras are
directly comparable:

| held-out population | stress-indep | incl. stress |
|---|---|---|
| words the old dictionary also had (n=11,748) | **71.4%** — baseline 71.5% | 66.4% |
| words added since, the Moby tail (n=1,780) | **65.7%** | 53.7% |

So the extra data taught the model nothing about the vocabulary it already handled, and cost it nothing
either. What it bought is the tail: the SHIPPED model before this run scored **56.3%** on those same
added words (they postdate it, so all 17,825 were unseen), against 65.7% here — about **+9 points on
the obscure/foreign/proper-noun vocabulary the OOV tier exists for**. That is the whole gain, and it is
narrow by construction.

⚠ **AND THE REFEREES AGREE, INCLUDING THE INDEPENDENT ONE**, which is what rules out the obvious
objection. The new training rows are MOBY-DERIVED, so a jump against the Moby OOV referee could be the
model learning that corpus's conventions rather than learning English. The wikipron primary has no such
relationship to them:

    wikipron primary (independent)   62.7% → 64.0%   (2531 → 2584)   symbol 90.8% → 91.3%
    Moby — the OOV tier              38.1% → 44.2%   (15,056 → 17,454)  symbol 85.6% → 87.4%
    Moby — words the dict carries    75.7%, unchanged — correct, the model is not consulted for them

+1.3pp on the independent referee is the largest single move it has recorded in this audit; the +6.1pp
on Moby-OOV is partly the circularity above and should not be read alone.

⚠ **55 GOLDEN LANGUAGES MOVED, 232 ROWS, AND NONE OF THEM IS ENGLISH-ONLY.** The English neural tagger
renders EMBEDDED English inside every other language's text, so retraining it moves Cherokee
(`Sundance`), Tibetan (`vasanta`) and Belarusian (`caro`) goldens too. Sampled before accepting: the
changes are majority repairs — `medicines` was reading as "medi-signs" (`mˈɛd̬ɪsˌaᶦnz` → `mˈɛd̬ɪsˌɪnz`),
`Aldwych` `ˈɔːɫdwɪk` → `ˈɔːɫdwɪt͡ʃ`, `panthera` and a dropped /ɡ/ in a compound both fixed.

⚠ **RETRAINED 2026-08-19 WITH PACKED SEQUENCES — the largest gain in the fleet (+3.1pp).** Training ran the
BiLSTM over padded batches without `pack_padded_sequence`, so its backward direction crossed the padding
before reaching each word's last letter, while serving (`englishNeural.ts`) is batch=1 and unpadded. The damage
lands at the END of the word, and English concentrates two things there that this tag alphabet must get right:
the suffix that determines STRESS placement, and the final-consonant/vowel-reduction pattern. Same CMUdict
90/10 split, same seed:

| | unpacked training | **packed training** |
|---|---|---|
| WORD-exact, stress-independent | 68.4% | **71.5%** |
| WORD-exact, including stress | 63.2% | **66.3%** |
| phone accuracy (1−PER) | 92.6% | **93.4%** |

⚠ The pre-fix baseline reproduced the historical 68.4% exactly, so the delta is the packing and nothing else.
See `tools/bilstm_training/tagger.py` and investigation Runs 41 and 43.

Concretely it reads proper nouns the n-gram mangles: Zelensky → zəlɛnski (n-gram: …aɪzɪlɛnski). Precedence is
lexicon → heteronym → possessive → **tagger** → n-gram (the tagger only fires on genuinely-OOV alpha words; dict text
is byte-identical to `phonemize(text, "en")`).

## Data + training

- **Corpus:** CMUdict (public domain) — `g2p-dict.tsv`, 117,479 ascii-alpha word→ARPABET entries (the same lexicon the
  sync engine ships).
- **Alignment:** hard-EM many-to-{0,1,2} monotonic (grapheme → 0/1/2 ARPABET phones), parallelised across cores
  (`tools/norwegian/nb_tagger_parallel.py::align_parallel`, with `SEP=" "` so a 2-phone chunk keeps its ARPABET token
  boundary — ⟨x⟩ → `K S`, not `KS`).
- **Model:** char-embedding (64) → 2-layer BiLSTM (hidden 256, dropout 0.3) → per-position ARPABET-chunk tag head;
  cosine-LR (2e-3→0). Trained on the FULL CMUdict for the shipped weights. 28 chars, 212 tags.
- **Export:** `en-g2p-tagger.int8.onnx` (dynamic-int8 quantised, 9.4MB fp32 → 2.4MB) + `en-g2p-tagger.meta.json`
  (`src` letter→id, `tags` id→ARPABET-chunk, `charTags` id→permitted tag-ids = the mask).

Reproduce:

```bash
EN_PRODUCTION=1 EN_FREQ=data/languages/english/g2p-common.txt \
  .venv/bin/python -u tools/english/en_g2p_bilstm.py   # held-out report + full train + int8 export
```

⚠ THE QUANTISE USED TO BE A PROSE STEP HERE AND IS NOW IN THE SCRIPT, because a two-step recipe whose
second step is a comment is a step that does not get run. The exporter wrote fp32 under the bare name
`en-g2p-tagger.onnx` while the runtime loads `en-g2p-tagger.int8.onnx`, so a production run left the
shipped model untouched — and, worse, still overwrote `meta.json`, which IS read, leaving a new vocab
beside old weights. English was also the only tagger language with no committed export script at all;
`bengali/`, `hebrew/`, `khmer/` and `sindhi/` each have one.

⚠ AND THE TRAINING SOURCE IS THIS REPO'S OWN `g2p-dict.tsv`, NOT RAW CMUdict — it always was (`load()`
reads the shipped dict), which means a retrain absorbs every correction in `g2p-curated.tsv` for free.
The weights shipped before 2026-09-18 predate ~2,000 of them: asked for the 2,077 curated words, the old
model emitted the PRE-CORRECTION reading for 2,035 of them.

`onnxruntime-node` is an OPTIONAL dependency, imported lazily; absent it (or the model), `createEnglishTagger()`
resolves to `undefined` and `phonemizeEnNeural` returns exactly the sync path (CMUdict + n-gram, no throw). This is a
SEPARATE async path; the sync engine is untouched. See
 (Runs 3, 6-7).
