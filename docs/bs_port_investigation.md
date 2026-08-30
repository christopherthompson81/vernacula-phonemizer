# bs — C# port investigation

⚠ This port predates the per-language investigation-doc convention, so this file begins with its findings register rather than a run log.


---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

### From the bs port (2026-08-26) — four TS-side defects, and the golden moved ZERO rows for all four

bs is the second Serbo-Croatian standard in the C# tree: `Languages/Bosnian/` is 4 files and ~430 lines,
because `PhonemizeWord`, `ForeignLetters`, `ComposeSlavicNumber` and `NormalizeSerbianInitialisms` all come
from `Languages/Serbian/` unchanged. Gate **110 → 111 languages, 21,696 → 21,896 rows, 0 differ, 0 BLOCKED**;
200/200 on the first parity run, before any of the fixes below.

⚠ **THE WIDENINGS ARE WHERE THE PORT EARNED ITS KEEP, AND THE GOLDEN SAW NONE OF IT.** All four defects were
found by READING, all four are fixed in TypeScript first with tests, and `gen_parity_goldens.mts bs` moved
**0 of 200 rows** on each — the gate proves the engines agree and every one of these was a bug both engines
would have reproduced byte-for-byte forever. Corpus-wide differential: 3,952 FLEURS `bs_ba` lines (col 3+4)
× sync and async, 0 differ. Off-golden probes: 296 hand-built lines, one per arm plus the adversarial
neighbour each arm must decline, × both modes, 0 differ.

- ⚠ **A SHARED PRE-PASS CAN KILL A LANGUAGE'S OWN RULE, AND NO UNIT TEST IN THE LANGUAGE'S FILE CAN SEE IT.**
  `bs` was missing from `registry.ts`'s `VULGAR_FOLD_OPT_OUT`, so the shared fold rewrote `¾` to ` 3/4`
  twelve days before the Bosnian port was written — and bs has no general `n/m` fraction rule, so the slash
  was dropped and the corpus's parchment sentence read *dvadeset devet TRI ČETIRI inča*, "twenty-nine three
  four". Step 14 of `bosnian/normalize.ts`, whose reading is *i tri četvrtine*, had never once run.
  ⚠ **THE TEST FILE IS WHY IT SURVIVED**: every bs test built the engine with `createBosnian()` and called
  `.text()` directly, which bypasses every pre-pass `getPhonemizer` wraps around it. A rule can be green in
  its own suite and unreachable in the product. The new tests go through `phonemize()`.
  ⚠ The opt-out is a TRADE, stated here rather than hidden: bs now reads the two attested glyphs (`¾` `½`,
  the only ones in the corpus) with its own words, and DROPS the other sixteen, which the fold used to
  half-read. hr, ca, mk and six more already make the same trade; inventing *i jedna trećina* for a glyph
  with ×0 attestation is the Fula `tere` failure.
- ⚠ **#1059's `raw` THREADING DID NOT PROPAGATE TO THE STANDARDS THAT WRAP THE SHARED COMPOSITOR.**
  `serbian/numbers.ts` takes `raw` and `serbian.ts` passes it; `bosnian/numbers.ts` did not declare the
  parameter at all, so bs read `9007199254740993` as *…dva* (its NEIGHBOUR's answer — the double had already
  rounded) and `1e21` as *jedan e dva jedan*, four words for twenty-two digits. bs is removed from
  `large-numeral-fidelity.test.ts`'s `ACCEPTED_LOSSY`, which is the list that may only shrink. ⚠ **`hr` HAS
  THE SAME HOLE AND IS STILL ON THAT LIST** — its call site strips `.` and `,` before `Number()`, so its
  `raw` must be the STRIPPED string, not the token.
- ⚠ **THE ONE WORD-KEYED RULE IN A DIGRAPHIC LANGUAGE THAT HAD ONLY ONE SCRIPT.** `bosnian/normalize.ts`'s
  header states the invariant ("its absence would make this file a no-op on Cyrillic prose") and DOTTED_ALT,
  LICENSOR and the degree scale all hold it — the era marker did not. `п.н.е. у пожару` read as *p . n . e .*,
  four letter names and four phrase breaks. Serbian already ships both spellings, so nothing was invented.
- ⚠ **A COORDINATED ORDINAL PAIR IS ONE CONSTRUCTION AND WAS BEING READ AS TWO HALVES, ONE OF THEM WRONG.**
  Step 9 established that a licensed span makes BOTH endpoints ordinal and cited the longhand sentences
  (`u sezoni od 1995. do 1996. godine`, `u 2015. ili 2016. godini`) as its evidence — then claimed only the
  DASH form. The longhand ones fell to steps 10/11, which see one numeral at a time:
    · a NON-YEAR first conjunct is claimed by neither, so `10. i 11. stoljeća` read *deset . i jedanaestog
      stoljeća* — the cardinal-plus-spurious-clause-break that the whole file exists to remove. ×3 distinct
      corpus sentences, and the LICENSOR table cites two of them as its OWN evidence for `stoljeća` and
      `pukovniju`;
    · a YEAR first conjunct IS claimed, by step 11 — which only knows the ELIDED *godine* and so always
      emits f.gen. `u 2015. ili 2016. godini` read *petnaestE … šesnaestOJ*, one construction with two cases
      in it.
  Step 9b now claims `N. (i|ili|do) N. LICENSOR` as a unit, both scripts. The connectives are the three the
  corpus writes; an unlicensed follower and a round thousand are both refused.

**Found and NOT fixed — filed, with the count that decided it:**

- **A local rate rule and the shared tier disagree about a decimal count** — Ukrainian's #920 shape, in
  sr/hr/bs alike. `intOf` TRUNCATES, so bs's local `m/s` rule reads `1,5 m/s` as *metAR* (nom.sg) where the
  shared tier reads `1,5 km` as *kilometarA* (gen.pl, via `numValue`'s `int + 0.5`). ×0 decimals in the four
  attested rate shapes (`133 m/s`, `200 milja/sat`, `300 m/h`, `600Mbit/s`), and closing it moves sr and hr
  too, so it wants a Serbo-Croatian decision rather than a bs edit.
- **Space-grouped thousands are not de-grouped**: `1 000 km` reads *jedan nula kilometara* — a lost
  magnitude, and the tier's count form is right (`numValue` de-groups) while the tokenizer's number is not.
  ×0 in bs_ba across all four space characters; Bosnian groups with periods (×47). Adding the arm on zero
  attestation is the #955 invention trap.
- **A round thousand ordinal leaves a stranded pause**: `2000. godine` → *dvije hiljade . godine*.
  `ordinalBase` returns undefined by design (the fused *dvijehiljaditi* is a different word-formation), but
  the untouched text keeps a `.` that IS clause punctuation. ×2 in the corpus, and closing it needs the
  fused forms sourced.
- **`km³` is dropped silently while `km²` reads** (ig's finding, same shape): bs declares no cubed word
  because `³` is ×0 and the one cubic quantity is spelled out — but the MARK is then lost rather than left.
- **U+2212 between digits fuses a range**: `1838−1917` → two years with nothing between them. The range
  class is `[-–—]` and the minus class is `[-−–]`; ×0 U+2212 in bs_ba, so per #955 this is filed, not swept.
- **A triple coordination claims only its last pair** (`1. i 3. i 5. pukovniju`), and **`GMT-00:43`** loses
  its sign (the cy/ga finding). Both ×0.
