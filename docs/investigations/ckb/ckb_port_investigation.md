# Central Kurdish (ckb) — C# port investigation

Chronological log of the runs behind the ckb port and the two TypeScript fixes it sent back.
Corpus: FLEURS `ckb_iq` (4,348 rows, columns 3+4), `tools/corpus/mined/ckb.jsonc`, and the
ASR-alignment DB `$ASR_ALIGN_ROOT/work/asr_align/align.sqlite` (3,040 ckb_iq utterances,
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

---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

### From the ckb port (2026-08-27) — 200/200 first run

**ckb (Central Kurdish / Sorani, ~8M)** — 6 files, ~430 C# lines, gate **114 → 115 languages, 22,496 →
22,696 rows, 0 differ, 0 BLOCKED**. ⚠ **NO PERSO-ARABIC CORE WAS INVOLVED, and that was worth checking
rather than assuming**: ckb is a Perso-Arabic script but imports none of the shared abjad machinery — the
SORANI alphabet writes every long vowel and the short /a/, so there is no short-vowel wall to restore and
nothing in `Core/HarakatLexicon.cs` / `Core/RiderDiacritizer.cs` is reachable. It shares only `Clauses`,
`LoadManifest`, `LoadTsv`, `Numbers`, `Unicode`, `Foreign` and `StructuralTagger`, and the neural tier is
`CreateWordStructuralTagger` + `WordLevelNeuralPrepass` unchanged, as in sd/bn/af/fr. **The shared core
needed no change.**

Widenings: corpus-wide differential over **4,275 unique lines** (8,696 FLEURS `ckb_iq` col 3+4, 143 mined,
the 200 golden texts, 261 hand-built) × sync AND async = **8,550 comparisons, 0 differ, 0 throws**.
⚠ The corpus alone covers NONE of the degree sign, the currency signs, the relational signs, U+2212 or an
above-2⁵³ digit run — all five are 0 in FLEURS + mined and rest entirely on the hand-built lines. 3,292 of
the 4,275 lines read differently on the async path in both engines, so the tagger tier is live on both
sides rather than silently serving the sync reading.

Fixed in TypeScript first, with tests, goldens regenerated, then ported:

- ⚠ **A FIX WITH A STATED ARGUMENT DID NOT REACH THE SECOND CASE THE ARGUMENT COVERS.** `scanWord`
  special-cases the one-letter word ⟨و⟩ because "a bare [w] is not pronounceable as a word" — and Sorani
  has TWO matres lectionis. The one-letter ⟨ی⟩ is the detached IZAFE (`٢٤ ی ئەیلول` "the 24th OF
  September", `16ی ئەیلوول`, `80%ی داهات`) and read as a bare **[j]**, 405 times across the corpus; the
  next one-letter token down is 14 instances of a fragment, so it is one construction, not a tail.
  Measured exactly as the ⟨و⟩ note was (min of wav2vec2 and allosaurus, 151 affected rows): median
  0.3575 → 0.3558, mean 0.3849 → 0.3794, **72 closer / 1 further**. `i` and `iː` score IDENTICALLY —
  `fold` strips length — so the quality is decided on the language, and deletion again wins on rows
  (149/2) and loses on the mean, which is the ⟨و⟩ note's own connected-speech finding. **15 golden rows
  move.**
- ⚠ **AN ERA-SHAPED DISCRIMINATOR QUESTION, ANSWERED PER SIGN.** The signed-number rule admits a LETTER
  before the sign for `UTC+1`, and applied that to the minus as well. Reading the instances rather than
  counting them: the one letter-adjacent PLUS is `(UTC+1)`; all **20** letter-adjacent MINUSES are
  designations — `کۆڤید-19`, `نوێ-COVID-19`, `HJR-3`, `Il-76s`, `چانداریان-1` — and not one is a
  subtraction, so COVID-19 read *koːviːd kam noːzda*, "covid MINUS nineteen". Split into two arms; the
  minus takes the ordinary non-letter boundary. **0 golden rows move.** (Cf. kmr's digit guard and
  Serbian's case guard for the same class: the discriminator each corpus supports is different, and here
  it is the SIGN.)
- Hygiene: `normalize.ts`'s header claimed the decimal rule "accepts one or two fractional digits". It has
  no cap; the fractional part is read digit by digit either way, and it is the UNIT rule's `NOT_VERSION`
  guard that tells `802.11m` from a quantity.

**Found and NOT fixed:**

- ⚠ **THE ZERO NUMERAL HAS NO NUCLEUS, IT IS ALREADY IN THE GOLDEN, AND THE LEXICON IS THE WRONG PLACE
  FOR IT.** `سفر` reads *sfɾ* — the only word in the numbers table with no vowel — and it is not obscure:
  2 of the 200 golden rows carry it (`3.50 مەتر` → *seː xaːɫ peːnd͡ʒ **sfɾ** matɪɾ*), 43 occurrences
  corpus-wide, and every one of the 22 colon-clock instances routes through it. This is precisely the
  class the module header cites as "not a variant, IMPOSSIBLE" (ملیۆن → *mljoːn*). All three obvious
  fixes are closed: the AsoSoft builder's pair for سفر is *safar*, so the bizroke-only filter dropped the
  row on purpose and a whole-word entry would pick one reading of a genuine homograph; the tagger DOES
  read it *sɪfɪɾ* but the number path never consults the OOV resolver and `wordLevelNeuralPrepass` keys
  its map off words present in the TEXT, which a composed number word is not; and the manifest states
  "no hand IPA" for this table. It needs a NUMERAL-CONTEXT reading — the zero word is unambiguously
  *sifir* in a numeral — which is a design decision, not a port one.
- **The lexicon is looked up on the UNSTRIPPED token while the scan strips ZWNJ + tatweel**, so a headword
  whose corpus spelling carries either mark can never hit it. Measured: ×0 reachable in FLEURS + mined.
  `loadTsvMap`'s `fold` option (#1072) is the mechanism the day one appears.
- **A rate declines when its denominator is inflected**: `٨٣ کیلۆمەتر/کاتژمێرێك` — the
  `(?![\p{L}\p{M}\d])` guard rejects the ـێك suffix, the slash is then dropped, and the "per" is lost.
  ×2, plus `300میل/کاتژمێر` ×1 where میل is simply not in the numerator table. The `lo` degree shape:
  how far number–unit adjacency should stretch is a corpus argument.
- **`1 / 5` loses its slash** — ckb has no fraction rule at all. ×1, and inventing one on n=1 is #955.
- Shared shapes, ×0 attested here and already filed elsewhere: space-grouped thousands
  (`1 000 000` → *jak sfɾ sfɾ*), caret exponents (`10^6` → *da*), `25°Cx` gluing the letters onto the
  degree word, U+2212 between digits, and `007` → *ħawt* (`Number` drops leading zeros — the DECIMAL path
  is safe, because the fractional part never goes through `Number`).
