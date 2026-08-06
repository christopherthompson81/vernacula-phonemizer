# `fr-g2p-tagger.int8.onnx` provenance

A per-grapheme **BiLSTM** sequence-labeller mapping a bare OOV French word → canonical IPA — the neural **OOV** tier for
French (`phonemizeFrNeural`; inference via the shared `createWordStructuralTagger` in `frenchTagger.ts`). It labels each
letter with one IPA-chunk tag in a SINGLE forward pass, replacing the rule g2p (`g2p.ts`) on words the Lexique 3.83
lexicon misses. Because French emits IPA directly and marks no lexical stress (the phrase-final accent is added at the
group level in `french.ts`), the tagger is a **thin wrapper over the shared factory with NO postprocess** — just a
lowercase+NFC preprocess. A per-letter consonant mask (`charTags`) keeps every output plausible; an out-of-vocab letter
(e.g. an elision apostrophe) declines ("") and the word falls back to the sync rule engine.

**Why a tagger.** French is a regular orthography, yet the hand-written rules leave real gains on the table. On a CLEAN
Lexique 90/10 held-out (12,586 words):

| model (held-out) | WORD-exact | symbol accuracy (1−PER) |
|---|---|---|
| rule g2p (`toIpa`) | 76.6% | 94.3% |
| **BiLSTM tagger (this model)** | **94.9%** | **99.1%** (PER 0.9% vs 5.7% — 84% fewer phone errors) |

The biggest rule gap it fixes is the **silent 3rd-person-plural `-ent`/`-aient` verb ending** the rules wrongly voice
as `[ɑ̃]` (the noun/adjective `-ent`=[ɑ̃] vs verb `-ent`=silent homograph, undecidable without morphology): the tagger
learns the silent form from Lexique (gribouillissent → …ˈi, not …isˈɑ̃). Also vowel quality (`œ~ø`, `ɛ~e~ə`) and
assimilation (absence → apsɑ̃s). **Caveat:** the held-out is Lexique-word-distributed (verb-heavy), so the `-ent` win
is amplified; real French OOV (proper nouns / foreign words) has fewer `-ent` verbs, so the real-target lift is likely
somewhat smaller than 76.6→94.9.

## Data + training

- **Corpus:** Lexique 3.83 (lexique.org; New/Pallier) — **CC BY-SA 4.0** (verified 2026-07-29: lexique.org's
  license statement + openlexicon's bundled LICENSE-CC-BY-SA4.0.txt for Lexique383) — `lexicon.tsv`, ~125k word→IPA forms (the same table the sync
  engine ships).
- **Alignment:** hard-EM many-to-{0,1,2} monotonic, parallelised (`tools/norwegian/nb_tagger_parallel.py`, `SEP=""` —
  French IPA is single-codepoint, nasal ɔ̃ = ɔ + combining tilde, so no separator needed).
- **Model:** char-embedding (64) → 2-layer BiLSTM (256, dropout 0.3) → per-position IPA-chunk tag head; cosine-LR.
  Trained on the FULL Lexique for the shipped weights. 43 chars, 81 tags.
- **Export:** `fr-g2p-tagger.int8.onnx` (dynamic-int8, 9.1MB fp32 → 2.3MB) + `fr-g2p-tagger.meta.json`
  (`src`/`tags`/`charTags`).

Reproduce: `FR_PRODUCTION=1 .venv/bin/python -u tools/french/fr_g2p_bilstm.py` then dynamic-int8 quantise.

`onnxruntime-node` is OPTIONAL/lazy → absent it (or the model), `createFrenchTagger()` resolves to `undefined` and
`phonemizeFrNeural` returns exactly the sync path (Lexique + rule g2p, no throw). Opt-in (import from `src/frNeural.ts`,
the bn/nb/en pattern); the sync engine is untouched.
