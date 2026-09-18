# Retraining the two English OOV models on the corrected dictionary

~2,000 dictionary corrections landed in #1334–#1338. Neither OOV model had seen any of them. This is the
measurement.

## Run 1 — 2026-09-18

### Which models, and the one that is NOT in scope

| model | trains on | role | stale? |
|---|---|---|---|
| `g2p-model.json` (3.3 MB) | raw `$CMUDICT` | OOV fallback — sync path, and any checkout without ONNX | yes, by construction |
| `en-g2p-tagger.int8.onnx` (2.4 MB) | **`g2p-dict.tsv`**, this repo's corrected dict | **primary** OOV path when ONNX loads | yes, but only because it is old |
| `pos-model.json` (2.9 MB) | UD-EWT | heteronym selection | **no** — it tags parts of speech, not pronunciations |

⚠ THE TWO OOV MODELS HAVE DIFFERENT TRAINING SOURCES and that is the whole shape of the problem. The
n-gram reads raw CMUdict, so the documented remedy is to feed it the curated dict instead. The BiLSTM
already reads the shipped dict — it needed nothing but a re-run.

### The corrections are class-wide, which is what a model generalises from

    458  LOT/THOUGHT        402  marry–merry        187  unstressed EH0
    115  the -ire rhyme      44  S→Z                 40  Latinate re-

### n-gram: trained on the corrected dict

`CMUDICT` was pointed at a CMUdict-format re-emission of `g2p-dict.tsv` (117,482 rows) rather than
upstream, and `--emit` given an explicit scratch directory. ⚠ `--emit` REGENERATES `g2p-dict.tsv` FROM ITS
INPUT, so in this configuration it must never be aimed at `data/` — it would be harmless here (the input
IS the corrected dict) and catastrophic in the old one.

A/B on the same held-out 10% of the shipped dict, same train-half dictionary, only the model differing:

    shipped    exact 5745/11748 (48.90%)   stress-independent 56.76%
    retrained  exact 5807/11748 (49.43%)   stress-independent 57.01%
      source C 21.6% → 21.6%   source M 72.1% → 72.1%   source N 47.0% → 47.9%

⚠ THE WHOLE GAIN IS IN SOURCE N, which is the correct signature: C and M decode through the DICTIONARY, so
only the n-gram tier can move when only the model changes. +62 words.

And the measurement that motivated this — curated rows whose OOV answer is still the UPSTREAM shape when
the word itself is held out:

    shipped    356 of 2,077   (N 313, M 22, C 21)
    retrained  158 of 2,077   (N 115, M 22, C 21)

⚠ **313 → 115 on the n-gram tier, and the M/C residue is UNCHANGED at 43** — exactly as it should be.
Those are the morph and compound-seam gaps (`truths`' /θ/→/ðz/ allomorph, the `roommate` seam), which no
amount of retraining can reach because they are not the model's answer.

Referee unchanged at 60.0% / 65.2%, as expected: the referee's words are overwhelmingly IN the dictionary,
so the lexicon answers and the OOV model never runs.

### BiLSTM: the staleness was near-total

The tagger has no dictionary lookup — it is a pure char→ARPABET model, so it MEMORISES the dict it was
trained on. Asked for each of the 2,077 curated words:

    shipped weights   emits the CORRECTED reading    30      emits the UPSTREAM reading  2,035
    retrained         emits the CORRECTED reading 2,019      emits the UPSTREAM reading     42

⚠ 98% STALE, against the n-gram's 17%, and the asymmetry is structural rather than alarming: a curated
word is IN the dictionary, so at runtime the lexicon answers and the tagger is never asked. What the 2,035
measures is how far the model's *generalisation* sits from the corrected dictionary — which is what an
actually-OOV word in one of those classes inherits.

Held-out (the EN_FREQ split: train on the 40k frequency-common words, hold out the rare/proper-noun tail)
49.4% exact / 55.7% stress-independent on 77,482 words. ⚠ NOT COMPARABLE TO THE SHIPPED MODEL, which the
provenance says was "trained on the FULL CMUdict" — scoring it here measures memorisation of the test set.

### ⚠ THREE DEFECTS FOUND IN THE EXPORT PATH, AND THEY COMPOUND

1. **The production export wrote fp32 under the bare name.** `englishTagger.ts` loads
   `${basename}.int8.onnx`; the trainer wrote `${basename}.onnx` and stopped. A production run therefore
   left the shipped model untouched — the failure `tools/perso-arabic/export_onnx.py` records as "fr/en
   exporting fp32 while the int8 ships (Run 43)".
2. ⚠ **AND IT WAS WORSE THAN A NO-OP**, because `meta.json` IS read. The run overwrote it, leaving a NEW
   vocab beside OLD weights — a silently mismatched pair, not a harmless orphan.
3. **`dynamo=False` was missing.** The bn/sd exporters document why: the dynamo path specialises the
   sequence length to the dummy's, which breaks variable-length inference — i.e. every real word.

English was also the ONLY tagger language with no committed export script (`bengali/`, `hebrew/`,
`khmer/`, `sindhi/` each have one) and its provenance gave the quantise as a PROSE step — "then dynamic-int8
quantise…" with no command. A two-step recipe whose second step is a comment is a step that does not run.
Fixed by moving the quantise, the fp32 cleanup and a load-and-answer sanity check into the trainer, so the
documented one-liner is now the whole recipe.

Exported cleanly afterwards: 2,379,117 bytes (shipped: 2,380,666), 28 chars, 212 → 209 tags. The tag
inventory shrank because the corrected dictionary uses three fewer distinct ARPABET chunks.

### ⚠ THE BLAST RADIUS IS THE PROBLEM, NOT THE MODELS

    n-gram alone      13 languages, 140 golden rows
    both models       61 languages, 364 golden rows

The goldens are async-mode output, so the tagger reaches every language carrying Latin-script text. And
the churn is almost entirely TRANSLITERATED FOREIGN PROPER NOUNS routed through the English OOV path —
`Zhytomyr`, `Radviliskis`, `Muskoka`, `Chernihiv`, `Sosnowiec` — where gold and Moby have nothing to say
and neither reading is authoritative. Sampled by hand, the direction is genuinely mixed:

    Muskoka   mˌʌskəkʰˈɑː → mˌʌskˈoᶷkə     better   (/ˈmʌskoʊkə/)
    Ukraina   ʌkɹˈeᶦnə    → juːkɹˈeᶦnə     better   (the /juː/ onset)
    Chernihiv t͡ʃˌɝnɪhˈiːv → t͡ʃɚnˈaᶦv      worse
    ll        ɫ           → ˈɛlˌɛɫ         better   (a letter sequence, spelled)
    tt        tʰˈiː       → tʰˌiːtʰˈiː     better
    rr        ˌɑːɹˈɑːɹ    → ɹˈɝ            worse

⚠ `rr` LOOKED LIKE A CLASS AND IS NOT. In "pronounce r and rr differently" the old reading spelled the
letters and the new one says "rur", which reads as a regression in the letter-name path — but neither
model DECLINES these, they just guess, and on `ll` and `tt` the new model guesses better. One row's luck,
not a systematic loss.

### Shipped

Both models. The go/no-go criteria set before the run all passed, and the churn was accepted on the
reasoning that it sits in OOV guesses at transliterated proper nouns where neither reading is
authoritative, while the measurable gains are English-internal.

    curation gap        332 → 136 listed, 196 rows closed; M/C residue unchanged at 22/21
    KNOWN_GAPS          `collaborative` and `research` GONE — the two rows the remedy was named for
    tagger staleness    2,035 → 42 of 2,077 curated words emitting the pre-correction reading
    held-out (n-gram)   48.90% → 49.43% exact, entirely in source N
    en referee          60.0% → 60.1%      en-GB  48.7% (flat)
    goldens             61 languages, 364 rows regenerated
    parity              189 byte-identical — the C# engine loads the same ONNX and agrees

⚠ THE RE-RUN REPRODUCED EXACTLY (2,019 / 42 / 16), so `random.seed(0); torch.manual_seed(0)` at the top of
`main()` is enough for this pipeline despite cuDNN's nondeterministic LSTM backward.

### ⚠ THREE TESTS STOPPED TESTING WHAT THEY CLAIMED, AND THAT IS THE INTERESTING RESIDUE

None of these is a stale string. In each the EXAMPLE stopped being an example, which a blind expectation
update would have hidden:

  * `english-tagger-digraph.test.ts` pinned `Yenisei` for "the digraph keeps the stronger of the two
    marks". The new weights emit `eᶦ` + `iː` for its ⟨ei⟩ — two DIFFERENT phones — so the guard, which
    collapses a REPEATED one, never fires. ⚠ AND THE GUARD IS NOW NEARLY DEAD: swept over the 4,862 dict
    words with adjacent vowel LETTERS, on and off, it changes TWO. The retrained tagger learned not to
    double. Repointed at `hiaa` (ˌeᶦt͡ʃˌaᶦˌeᶦˈeᶦ → ˌeᶦt͡ʃˌaᶦˈeᶦ, primary kept), one of those two.
  * `LanguageBootstrapTests.AsyncPrewarmsAnEmbeddedLatinRunFromACOLDMemo` asserts the ASYNC path used the
    BiLSTM rather than the n-gram, so it needs a word the two tiers read DIFFERENTLY. ⚠ THEY HAVE
    CONVERGED — both now learn from the same corrected dictionary — and on `Wolaytta` they agree exactly,
    which would have left the test passing while asserting nothing. Swept 400 OOV tokens from the goldens:
    6 still discriminate. Repointed at `Maandag`.
    ⚠ The sync contrast added beside it needs its own `ClearForeignOov()`: the memo is PROCESS-WIDE, so
    without it the sync call reads back what the async call just warmed and passes for the wrong reason.
  * `minnan.test.ts` / `PortedEnginesAnswer` pinned `Ukraina-gí`, where the English half is an OOV guess
    that has now moved twice. It is `juːkɹˈeᶦnə`, which is the better reading; what those lines pin is the
    SPLIT, and that is unaffected.

### Closed on the way

`en_g2p_ngram.ts`'s own `collapseGeminates` had no vowel exemption while the shipped engine's does — it
changed 186 rows, 95 of them an adjacent identical VOWEL pair and 89 of those the `-erer` agentive, where
collapsing DELETES A SYLLABLE (`acquirer` → `acquire`). `english-tagger-digraph.test.ts` recorded it as
needing a retrain to close. ⚠ THE EMITTED MODEL WAS NEVER AFFECTED — that collapse runs in the tool's
SCORING path, not over the EM-aligned tables it ships — so what it skewed was the tool's own held-out
numbers, measured against a chain that does not ship. Fixed; the A/B above was run through the ENGINE's
`createEnglishG2p` and so was already on the shipping chain.
