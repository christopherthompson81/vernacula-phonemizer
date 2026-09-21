# Run 2 — 2026-09-21 — retraining the n-gram again, and what the retrain exposed

~2,000 further corrections landed between #1341 and #1399 (the Moby import, the stress block, the
`-ed` adjectives, the prefix vowel, the yod/velar rows). The n-gram had seen none of them.

## The recipe, unchanged from Run 1

    awk -F'\t' '!/^#/ && NF>=2 {print $1" "$2}' data/languages/english/g2p-dict.tsv > curated-cmudict.dict
    CMUDICT=curated-cmudict.dict EN_FREQ=data/languages/english/g2p-common.txt \
      npx tsx tools/english/en_g2p_ngram.ts --comp --morph --emit <scratch>

⚠ `--emit` REGENERATES `g2p-dict.tsv` AND `g2p-common.txt` FROM ITS INPUT, and its own `[a-z]+`/length
filters drop 20 of our 135,312 rows — so it emits 135,292. **Only `g2p-model.json` is copied into
`data/`.** Aiming `--emit` at `data/` would silently shrink the dictionary by 20 words.

## The A/B, on the same words with only the model differing

    held-out (1-in-24 of the dict, 5,638 words, each held out of the DICTIONARY not out of training)

                       shipped      retrained
      exact            45.53%       47.37%      +104 words
      stress-indep.    54.93%       56.86%
      source C         24.33%       24.33%      \  identical — these decode through the
      source M         70.08%       70.08%      /  DICTIONARY, so only N can move
      source N         42.75%       46.28%      the entire gain
      ≤4 letters       54.97%       57.85%
      5–8              46.12%       47.13%
      9+               42.39%       45.62%

⚠ **C AND M BEING BYTE-IDENTICAL IS THE CHECK, NOT A CURIOSITY.** It is what proves the A/B isolated
the model: a change that moved them would mean the harness was measuring something else too. Same
signature as Run 1.

## Curation gaps: 70 closed, 16 opened

    live gaps   253 → 199      source N 170 → 116;  M 26 → 26;  C 57 → 57
    STRUCTURAL_GAP  173 → 116

⚠ **AND FIVE ROWS THAT PROMISED "CLOSES ON A RETRAIN" DID NOT CLOSE.** The claim was written four
separate times in `en-curation-gap.test.ts`, inherited from #1341's `collaborative`, and was never
testable until the retrain ran. `gaea`, `mainz`, `piazza` and `cham` want a LOANWORD spelling rule
(⟨g⟩ = /d͡ʒ/, ⟨z⟩/⟨zz⟩ = /ts/, ⟨ch⟩ = /k/) that the dictionary has no majority for — the Italian
`-zz-` class splits 41 to 67 — so there is nothing to generalise FROM whatever the model trains on.
`destabilize` is the same. **A retrain absorbs a row whose shape is already the majority somewhere in
the training data; it cannot invent one.**

⚠ And `basle` closed — a row `STRUCTURAL_GAP`'s own comment calls orthography "no rule can reach". No
RULE can; a model trained on the corrected dictionary evidently can.

## Three OOV readings moved, and each one taught something different

⚠ **`km` DECODED TO BARE LETTERS.** `K AH1 M` under the shipped model, `K M` under the retrained one —
and the #1386 unsayable-output net requires `w.length >= 3`, so nothing rescued a 2-letter vowelless
decode. **The class is pre-existing and large**: 350 two-letter tokens already decoded without a
nucleus under the OLD model. Widening the net to `>= 2` makes `km` read `kʰˌeᶜˈɛm` and broke nothing.
⚠ **AND THAT WIDENING BROKE PARITY**, because it went into the TypeScript and not the C# twin: 5
languages, 7 rows, `Ch.` spelled out on one side and not the other. The gate caught it.

⚠ **`COVID` IS A WORD CMUdict PREDATES.** Both models invent it — `koᶷvˈiːd` shipped, `kʰˈɑːvɪd`
retrained — and a REPORTED MISREADING was pinned to whichever the model happened to say, so it moves
every retrain. gold has `kˈOvˌɪd`. A dictionary row makes it independent of the model, which is what a
reported misreading should be.

⚠ **`Ir` IS THE OPPOSITE CASE AND MUST NOT GET A ROW.** Its pinned value was never a reading of
anything — the test's claim is that `Ir` is NOT expanded to "infrared", and the phones are whatever
the g2p invents. Updated, with a comment saying so.

## Goldens: 214 rows across 17 languages

All English OOV proper nouns inside other-language text — `Bhumibol`, `Kính`, `Waseca`, `Adulyadej`.
Regenerated on the held-out evidence, which measures this exact population (9+ letters, 42.4% →
45.6%). ⚠ `check-goldens --write` REFUSES to run with `--jobs`, because writing from a delegated
engine re-records the goldens from something that is not the engine. Single-process.

## en-GB lexical sets: flat headline, 59-to-0 product

The sets are built through `phonemizeWordRules`, which uses this model for OOV words, so 197
memberships moved (bath +21/−22, cloth +21/−13, yod +57/−25, palm +27/−22, lotr −1).

    en-GB headline   52.9% / 87.0%   before and after — UNCHANGED

⚠ **AND THE HEADLINE IS BLIND HERE, WHICH IS WHY #1381's RULE IS TO DIFF THE PRODUCT.** On the 197
words whose membership moved:

    before   HIT 17   MISS 180
    after    HIT 76   MISS 121
             MISS → HIT  59        HIT → MISS  0

59 words of 76,284 is 0.077% and rounds away. The rebuild is strictly positive and the headline
cannot see it.
⚠ A first count said `HIT → MISS 1`; that was my own label line leaking into the word list.

## Gates

    suite 6,147 · C# 6,697 · goldens 189/36,495/0 stale · parity 189 byte-identical
    en referee: wikipron 64.0% / epitran 44.3% / moby-lexicon 76.7% — all unchanged, as in Run 1:
    the referee's words are overwhelmingly IN the dictionary, so the lexicon answers and the OOV
    model never runs.

## NOT in scope, and it should be next

The **BiLSTM** (`en-g2p-tagger.int8.onnx`) is the PRIMARY OOV path when ONNX loads; the n-gram is the
fallback. It already reads the shipped dict, so it needs only a re-run — but it needs torch and an
export step, and Run 1 measured it at 98% stale against 17% for the n-gram. Everything above is the
FALLBACK path only.
