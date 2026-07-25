# Danish NST lexicon ingest — the data-scarcity fix (a convention upgrade)

The Danish OOV tier was capped by a tiny 7,476-word Wiktionary lexicon (data-starved BiLSTM → keep-the-perceptron,
per da_neural_oov_evaluation.md). The fix is data: the **NST Danish pronunciation lexicon** (Nasjonalbiblioteket /
Språkbanken `sbr-26`, `da_leksikon.tar.gz`), **CC0 / public domain**, ~238k entries, X-SAMPA, semicolon-separated
(field 0 = word, field 11 = transcription; carries compound + morphology fields), the same source + license as the
Norwegian NST lexicon already shipped for nb.

## Run 1 — 2026-07-25 — converter, un-starve measurement, convention decision

Built a Danish X-SAMPA→IPA converter (`tools/danish/build_da_nst.py`): stress `"`→ˈ / `%`→ˌ, syllable `$` dropped,
length `:`→ː, **stød `?`→ˀ**, the Danish phone set (`6`→ɐ r-vocalisation, `@`→ə, `R`→ʁ, `D`→ð soft-d, `A`→ɑ, `E`→ɛ,
`O`→ɔ, `Q`→ɒ, `2`→ø, `9`→œ, `s'`→ʃ); multi-word entries (`_`/`¤`/space) skipped. → **198,997 single-word IPA entries**
(27× the current 7,476).

**Un-starve measurement (the decisive one):** a BiLSTM trained on ~150k NST words scores **95.2% symbol / 72.1%
word** on held-out — vs **82.0% symbol** on the old 7.5k lexicon (≈ the perceptron's 80.9%, tied because starved). So
the "keep the perceptron" verdict was correct FOR THE OLD DATA and **flips with this corpus**: at 95.2% symbol the
Danish BiLSTM is now in the healthy range (fr 99%, en 92.6%). Data scarcity was the whole story.

**Convention decision (USER: NST narrow).** NST is more accurate Danish than the current broad/inconsistent Wiktionary
lexicon — it captures r-vocalisation (kærlig→kɛɐli), stop lenition (kat→kad, dansk→dansɡ), soft-d (hed→heð), and
length + **stød** (hus→huːˀs). Adopting NST is a convention UPGRADE (per the OmniVoice explicitness principle — stød +
length are distinctive). This is a re-bring-up: replace the lexicon (7.5k→199k narrow), a BiLSTM OOV tier (now
justified) REPLACES the perceptron, re-align the eval + tests to the narrow convention.

## Run 2 — 2026-07-25 — productionization (ship the lexicon + BiLSTM, drop the perceptron)

Wired the full NST re-bring-up:

- **Lexicon:** `da-lexicon.tsv` regenerated → **198,997 NST-narrow entries** (0 CR bytes). (Run 3 later trims this to
  the ~37k frequency head; the tagger keeps training on the full set.) Header credits NST/CC0.
- **BiLSTM (`tools/danish/da_bilstm.py`, `DA_PRODUCTION=1`):** honest 90/10 md5 held-out (19,831 words) =
  **73.4% word / 95.7% symbol** (vs the perceptron's ~45.5% word / 82.0% symbol on the old 7.5k — the un-starving
  reproduces at full scale). Full-lexicon retrain → `da-g2p-tagger.onnx` (31 chars, 478 tags), dynamic-int8 quantised
  to `da-g2p-tagger.int8.onnx` (9.9MB → **2.5MB**); fp32 gitignored, `.meta.json` shipped.
- **Serving:** `danishTagger.ts` (thin shared-factory wrapper, no postprocess) + `daNeural.ts` (async pre-pass, the
  bn/nb/en/fr pattern — tags OOV words, injects them as the sync engine's `oovOverride`, byte-identical on lexicon
  text). `danish.ts` rewired to three tiers (lexicon → `oovOverride` → rule) and the perceptron tier (`tagger.ts`,
  `da-g2p.tsv`) + 5 stale perceptron dev scripts deleted.
- **Verification:** tagger produces narrow output (`gribletop → ˈɡʁibləˌtɐb`, r-voc + lenition; Cyrillic → declines
  `""`); neural byte-identical to sync on lexicon text. `test/danish.test.ts` re-synced to NST-narrow golds (+ a
  narrow-signature test), `test/daNeural.test.ts` added. tsc clean, 6/6 da tests pass.
- **Eval floor UNCHANGED:** the referee-eval measures `phonemizeWordRules` (the rule, untouched) → **27.4% folded /
  75.5% symbol**, byte-identical to before. `da.jsonc` folds need no change (they normalise the broad rule vs the
  narrow referee; the rule still folds length/stød). The lexicon + BiLSTM are the accurate narrow surface; the rule
  remains the honest broad novel-word floor.

## Run 3 — 2026-07-25 — frequency-trim the shipping lexicon (the nb pattern), retrain on the full NST

Prompt (user): "da might suffer more from a trimmed lexicon because it's less phonemic?" — a real concern, since
Danish's OOV fallback is uniquely weak (rule 27.4% folded / 75.5% symbol vs nb 63.4%), so every word the lexicon
misses degrades harder than in Norwegian. Measured the trade-off before deciding.

**The measurement (decisive).** Top-50k OpenSubtitles-da (hermitdave FrequencyWords, CC BY-SA) ∩ NST = **37,008
words**; total token mass of the 50k list = 86.7M. Coverage:

- lexicon (top-50k ∩ NST, 37,008 words) serves **98.2% of real-text tokens**;
- **1.8%** are OOV *even with the full 199k lexicon* (NST simply lacks the word) → OOV either way;
- so trimmed and full are **byte-identical on the entire top-50k head**; the full lexicon adds coverage ONLY on
  rank>50k words, which are individually rare. The frequency-weighted cost of trimming is ~0 on the head, and the
  rare tail it exposes is recovered by the BiLSTM at 95.7% symbol (async) — the very tier we just un-starved.

**Decision (nb pattern).** Ship the **~37k frequency head** (`da-lexicon.tsv`, 0.9MB — ~7× smaller than the 6.1MB
full), train the tagger on the **full 199k NST** (`build_da_nst.py --train-out /tmp/da_train.tsv`; `da_bilstm.py`
reads `DA_LEX`). This matches `build_nb_data.py` exactly. The user's instinct (per-exposed-word, da loses more than nb)
is correct but frequency-diluted to near-zero, and the async tagger backstops the tail.

- **Variant refinement:** switched first-variant → **shortest NST variant** (nb-consistent; the running-speech form
  over the over-careful citation reading). Danish NST is 98.8% single-variant, so this touches only 813/199k words
  (0.4%) — none of the test golds. **Retrained** on the shortest-variant full set for exact reproducibility from the
  shipped lexicon: held-out **73.6% word / 95.7% symbol** (≡ the first-variant run — the refinement is immaterial; Run 4 later reshapes the variant choice, settling at 73.1),
  31 chars / 479 tags, requantised to int8.
- **Test re-sync:** `snurretop` (a rank>50k compound) is now OOV under the trim, so its narrow gold moved out of the
  lexicon test; replaced with `hjerte → ˈjɛɐdə` (a common word showing silent-h + r-vocalisation + lenition together).
  The neural test keeps `gribletop` as the OOV narrow-signature example. Eval floor still measures the untouched rule
  → **27.4% folded / 75.5% symbol**, unchanged.

## Run 4 — 2026-07-25 — 8-angle review fixes (stress normalisation + stød-preserving variant + tokenizer)

The 3-agent review (8 finder angles) surfaced two real correctness defects plus polish; fixed and re-verified:

- **Malformed OOV stress (confirmed empirically).** The tag alphabet embeds ˈ/ˌ but per-position argmax has no global
  stress constraint, so raw OOV readings carried zero / doubled (`ˈvanˌˌbyː`) / multiple (`ˈɔnɐˈdœɐˀ`) primaries — a
  probe over 896 OOV compounds found 3 zero, 1 multi, 6 adjacent-doubled. Norwegian guards this with `oneStress`;
  Danish had **no postprocess**. Fix: **promoted `oneStress` to the shared `core/structuralTagger.ts`** (parameterised
  by a fallback vowel class so nb stays byte-identical — nb passes its exact set; da passes one incl. ə/ɐ/ɒ) and wired
  it as the Danish tagger's postprocess. Re-probe: **0 / 0 / 0**. (Also resolves the reuse/altitude finding that da
  duplicated nb's normaliser.)
- **`shortest()` stripped stød/length (confirmed).** The char-length `min` systematically dropped the very stød ˀ /
  length ː the narrow convention exists for whenever a word had a stød-minimal-pair variant — **747 shipped words**
  affected. Fix: variant key = fewest **phonemic segments** (diacritics stripped — still drops the spelled-letter
  artifacts that add segments) then **most stød+length** (preserve the narrow marks). Recovers stød on **652** shipped
  words (`i`→ˈiːˀ, `sniger`→ˈsniːˀɐ, `brænder`→ˈbʁɛnˀɐ). Retrained on the reshaped full set: held-out **73.1% word /
  95.7% symbol** (the −0.5pp word-exact vs Run 3 is the stød-richer target being marginally harder to predict exactly;
  symbol unchanged — the right trade for correct data), 31 chars / 479 tags, requantised.
- **4 dead lexicon entries.** The TOKEN/WORD class `[a-zæøåéöäü]` omitted à/è/ó/ã, so `voilà`/`genève`/`jón`/`joão`
  were unreachable (split at the missing char: voilà→"voil"). Added those 4 accents to both regexes → the entries
  resolve (`voilà`→vwɑˈla).
- **Altitude/reuse:** routed `daNeural.ts` through the shared `wordLevelNeuralPrepass` (nb/bn pattern) instead of a
  hand-rolled loop, by having `phonemizeWord` consult `oovOverride` with the **raw** word (matching nb). Byte-identical
  on lexicon text; the sync path is untouched.
- **Trainer robustness:** `da_bilstm.load()` now `rstrip("\r\n")` (matches `read_nst`); the held-out report guards a
  zero-length split. Conventions angle: clean (CC BY-SA attribution present in the lexicon header + PROVENANCE).

Full suite green (1050/1050); nb byte-identical (10/10).

**Next:** Swedish (its ~800k NST lexicon is the same source/license — the same trim-ship + full-train shape).
