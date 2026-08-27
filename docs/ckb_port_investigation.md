# Central Kurdish (ckb) — C# port investigation

Chronological log of the runs behind the ckb port and the two TypeScript fixes it sent back.
Corpus: FLEURS `ckb_iq` (4,348 rows, columns 3+4), `tools/corpus/mined/ckb.jsonc`, and the
ASR-alignment DB `/mnt/data/omnivoice_ipa/work/asr_align/align.sqlite` (3,040 ckb_iq utterances,
wav2vec2 in `phones` and allosaurus in `phones_allo_uni`). There is no `tools/corpus/attest/ckb.jsonc`.

## Run 1 — 2026-08-27 — what does the corpus actually contain?

Question: which of `normalize.ts`'s arms are exercised by real Kurdish text, and what does the scan
silently drop?

    .probe/ckb/audit.mts, .probe/ckb/attest.mts

Raw findings:

- **ZWNJ / tatweel**: 6 token types, 10 + 21 instances. **0** of them would hit `lexicon.tsv` if the
  strip were applied before the lookup, so the #1068 nativiser/lexicon seam is not live here (the
  lexicon is looked up on the UNSTRIPPED token while `scanWord` strips — a real ordering gap, with no
  reachable instance).
- **Silently dropped characters inside word tokens**: exactly one, `ء` ×4 — and all four are the same
  typo (`بەخءرایی` for `بەخێرایی`) duplicated across the train/lowercase columns. Not a class.
- **Arabic-keyboard letterforms** ك/ى/ي: 2,309 instances, all handled by step 0.
- **Latin runs**: 567 occurrences / 193 types. They are read by `core/clauses.ts`'s foreign handling,
  not by the engine's `foreign` constructor parameter — which is never read, as `registry.ts` already
  records for the nine factories in that class.
- **Space-grouped thousands**: 0. **Non-group commas** (`0,5`, `1,5`): 0. **U+2212**: 0. **Caret
  exponents**: 0. **Degree signs**: 0. So four known fleet shapes have zero attestation here.
- **LETTER-hyphen-DIGIT: 20**, and reading them rather than counting them is the finding — see Run 2.
- **Letter-PLUS-digit: 5**, all one sentence, `(UTC+1)`.

Implication: the two things worth chasing are the letter-adjacent hyphen and whatever the one-letter
word tokens do, because everything else the corpus reaches is already right.

## Run 2 — 2026-08-27 — the no-nucleus scan and the one-letter words

Question: after the bizroke lexicon, what still comes out with no vowel at all — the criterion the
module header itself uses for "impossible, not a variant"?

    .probe/ckb/scan.mts   → 849 occurrences / 67 types with no nucleus
    .probe/ckb/single.mts → every one-letter word token and its reading

    "و" 5848 → "u"      "ی" 405 → "j"      "ە" 14 → "a"     "م" 12 → "m"
    "ز" 6 → "z"         "ش" 4 → "ʃɪ"       "چ" 4 → "t͡ʃɪ"   (rest ≤2)

**⟨ی⟩ ×405 reads as a bare [j].** `scanWord` already special-cases the one-letter ⟨و⟩ with the argument
"a bare [w] is not pronounceable as a word" — and the same is true of the other matres lectionis, which
the fix did not reach. Reading the instances: every one is the detached IZAFE (`٢٤ ی ئەیلولی 1759 دا`,
`16ی ئەیلوول`, `4ی تەمموزی`, `80%ی داهاتی`, `هیسپەرۆنیچەس ی پێدراوە`) — one construction, 405 times.
The next one-letter token down is 14 instances of a fragment.

`sfɾ` ×43 is the third-largest no-nucleus type; that one is Run 5.

## Run 3 — 2026-08-27 — scoring ⟨ی⟩ against both recognizers

Question: is [iː] better than [j], measured the way the ⟨و⟩ note in the header was measured (min of
wav2vec2 and allosaurus over the folded backbone, `asr_align_report.fold`/`dist`)?

    .probe/ckb/render.mts (CKB_YI env override) + .probe/ckb/measure.py

    candidate      rows   closer / further      median            mean
    iː              151     72 / 1           0.3575 → 0.3558   0.3849 → 0.3794
    i               151     72 / 1           0.3575 → 0.3558   0.3849 → 0.3794
    delete          151    149 / 2           0.3575 → 0.3537   0.3849 → 0.3815

`i` and `iː` score IDENTICALLY — `fold` strips length, so the eval cannot arbitrate quality here, and
the length is decided on the language (the Sorani izafe is /î/, and non-glide ⟨ی⟩ already gives `iː`).
Deletion scores more rows closer on a WORSE MEAN — the same pattern the ⟨و⟩ note records, and the same
conclusion: that is the connected-speech reduction, and the standard form is what we emit.

Decision: **⟨ی⟩ alone → `iː`**. Fixed in TS with a test; 15 golden rows move.

## Run 4 — 2026-08-27 — the sign rule, decided per sign

Question: the sign arm admits a LETTER before the sign for `UTC+1`. Does the corpus support that for
the minus as well?

    .probe/ckb/ctx.mts '[\p{L}]\s?[-−]\s?\d'    → 20, ALL designations
    .probe/ckb/ctx.mts '[\p{L}]\s?\+\s?\d'      →  1 distinct sentence, `(UTC+1)`

    کۆڤید-19 · نوێ-COVID-19 · HJR-3 · Il-76s · چانداریان-1

`کۆڤید-19` read *koːviːd kam noːzda* — "covid MINUS nineteen". 20/20 against 0/20: the discriminator
this corpus supports is the SIGN, not a shared boundary. Fixed by splitting the arm — `+` keeps the
wide boundary, `-`/`−` takes `(?<![\d\p{L}\p{M}])`. 0 golden rows move (the shape is not in the sample).

Combined with Run 3, over all 3,040 aligned utterances: **81 closer / 1 further**, median 0.3680 →
0.3576, mean 0.3893 → 0.3836.

## Run 5 — 2026-08-27 — the zero numeral has no nucleus, and the lexicon cannot fix it

Question: `spellDigits` and `renderNumber(0)` both emit `سفر`. What does it read as?

    .probe/ckb/nums.mts — every word in the numbers table, rules and shipped

`سفر` → **`sfɾ`**, the ONLY number word with no nucleus (چل, ملیۆن and ملیار are covered by the
lexicon; the other 29 have written vowels). It is not obscure: it is **in 2 of the 200 golden rows**
already (`3.50 مەتر` → *seː xaːɫ peːnd͡ʒ **sfɾ** matɪɾ*), it is 43 occurrences across the corpus, and
every one of the 22 colon-clock instances (`11:00`, `12:00`) routes through it.

**NOT FIXED, and the reason is the header's own homograph trap.** Three routes, all closed:

1. *Add it to `lexicon.tsv`.* The lexicon is generated by `tools/central-kurdish/build_ckb_lexicon.py`
   from AsoSoft, whose pair for سفر is *safar* — which is why the builder's bizroke-only filter dropped
   the row (two inserted /a/, not one inserted /ɪ/), and why the build script quotes سفر as its example
   of the class. A whole-word entry would pick one reading of a genuine homograph.
2. *Let the tagger have it.* `phonemizeAsync("سفر")` does read *sɪfɪɾ* — but the number path never
   consults the OOV resolver (`number()` passes bare `phonemizeWord`), and even if it did,
   `wordLevelNeuralPrepass` keys its map off words present in the TEXT, and a composed number word is
   not. Closing this is an architecture change, not a port decision.
3. *Hand IPA in the manifest.* `central-kurdish.jsonc` states the opposite policy for this table:
   "canonical IPA is DERIVED by running them through the same g2p (no hand IPA)."

What it actually needs is a NUMERAL-CONTEXT reading — the zero word is unambiguously *sifir* in a
numeral and *safar* nowhere else in the digit path — i.e. either a per-context override slot on the
numbers table or the tagger reached from the number call site. Filed.

## Run 6 — 2026-08-27 — the port, and the two widenings

C# under `csharp/Vernacula.Phonemizer/Languages/CentralKurdish/` — 6 files, ~430 lines. Nothing in the
shared Perso-Arabic core was needed or changed: ckb imports none of it (`clauses`, `loadManifest`,
`loadTsv`, `numbers`, `unicode`, `foreign`, `structuralTagger` only), and the neural tier reuses
`Core/StructuralTagger.cs` — `CreateWordStructuralTagger` + `WordLevelNeuralPrepass` — exactly as
sd/bn/af/fr do.

- **Parity: 200/200 byte-identical on the first run.** Fleet 115 languages / 22,696 rows / 0 differ /
  0 BLOCKED.
- **Widening 1, the corpus-wide differential**: 4,275 unique lines (8,696 FLEURS col 3+4, 143 mined,
  the 200 golden texts, 261 hand-built) × sync AND async = **8,550 comparisons, 0 differ, 0 throws**.
- **Widening 2, off-golden probes**: the 261 hand lines are one per arm of `normalize.ts` plus the
  adversarial neighbour each arm must decline. Coverage of the probe set, measured not assumed:

      a digit 545 · native digit 455 · Arabic letterform 870 · grouping comma 33 · decimal 34 ·
      colon clock 19 · percent 13 · degree sign 10 · Latin unit key 32 · Perso-Arabic unit key 35 ·
      rate slash 24 · exponent 13 · range dash 20 · signed 25 · currency 9 · relational/arith 14 ·
      ampersand 2 · one-letter ⟨و⟩ 1,877 · one-letter ⟨ی⟩ 104 · وو digraph 2,436 · ئ 2,892 ·
      ن-before-velar 1,106 · ZWNJ/tatweel 17 · Latin run 223 · above-2⁵³ digit run 2

  ⚠ The corpus alone would NOT have covered the degree sign (0 in FLEURS + mined), the currency signs
  (0), the relational signs (0), U+2212 (0) or an above-2⁵³ digit run (0). All of those rest entirely
  on the hand-built lines.
- 3,292 of the 4,275 lines read DIFFERENTLY on the async path in both engines, so the tagger tier is
  live and identically wired on both sides — not a sync reading served twice.

## Found, not fixed

- **`سفر` has no nucleus** — Run 5, with the three closed routes.
- **The lexicon is looked up on the UNSTRIPPED token while the scan strips ZWNJ + tatweel.** A headword
  whose corpus spelling carries either mark can never hit the lexicon. ×0 reachable today (Run 1), and
  the `loadTsvMap` `fold` option (#1072) is the mechanism if an instance ever appears.
- **A rate declines when its denominator carries an inflection**: `٨٣ کیلۆمەتر/کاتژمێرێك` and
  `٧٠ کیلۆمەتر/کاتژمێرێك` — the `(?![\p{L}\p{M}\d])` guard rejects the ـێك suffix, the slash is then
  dropped by the tokenizer, and the "per" is lost. ×2. `300میل/کاتژمێر` loses it too, for a different
  reason: میل is not in `CKB_NUMER`. ×1. Closing either needs a decision about how far the guard should
  stretch, which is the `lo` degree finding's shape.
- **`1 / 5` (a fraction) loses its slash** — ckb has no fraction rule at all, so `1 / 5 ئینچ` reads
  *jak peːnd͡ʒ*. ×1 in the corpus, and inventing a fraction reading on n=1 is the #955 trap.
- Shared shapes with ×0 attestation here, all already filed for other languages: space-grouped
  thousands (`1 000 000` → *jak sfɾ sfɾ*), caret exponents (`10^6` → *da*), `25°Cx` gluing the letters
  onto the degree word, U+2212 between digits.
- **`007` reads *ħawt`*** — `Number("007")` drops the leading zeros. Fleet-wide shape; the DECIMAL path
  is safe here because the fractional part is read digit by digit, never through `Number`.
