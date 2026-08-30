# hr — C# port investigation

⚠ This port predates the per-language investigation-doc convention, so this file begins with its findings register rather than a run log.


---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

### From the hr port (2026-08-26) — ⚠ FOUR DEFECTS, AND NOT ONE MOVED A GOLDEN ROW

hr is a THIN module over the shared Serbian core (`PhonemizeWord`, `ForeignLetters`,
`NormalizeSerbianInitialisms`, `ComposeSlavicNumber`) and was 200/200 on its FIRST parity run, before any of
these were found. Every one came from READING, and every one is FIXED in both engines now — TS first, with
tests, goldens regenerated (0 rows changed, four times over).

- **⚠ A FIX DOES NOT PROPAGATE ALONG A SHARED CORE, AND THAT IS THE LESSON OF THIS PORT.** Three of the four
  are a sibling's finding that never crossed the module boundary, and in two cases the sibling's own comment
  CITES the Croatian corpus while leaving Croatian broken:
    · **#1059's `raw` threading.** `serbian/numbers.ts` takes the parameter; hr's and bs's one-line
      `numberToWords` wrappers DROPPED it and their call sites never passed a token, so both read
      `1000000000000000000000` as *jedan e dva jedan* — "1 e + 2 1", the ⟨e⟩ voiced as a vowel. ⚠ hr's caller
      also has a trap the others do not: it strips the thousands PERIODS and the decimal COMMA before
      `Number()`, so `raw` must be the STRIPPED string. Both fixed; `hr`/`bs` removed from
      `large-numeral-fidelity`'s ACCEPTED_LOSSY.
    · **The era marker's `i` flag.** `n.e.` is also two capital INITIALS with stops, and the era block runs
      BEFORE the dotted-capital-run rule, so `N. E. Kovač je došao` read *nove ere Kovač* — a name replaced by
      a date. serbian/normalize.ts fixed exactly this, and its comment reads "all eight era instances across
      the sr AND hr corpora are lowercase". hr kept `giu` anyway.
    · **The hyphen-suffix ordinal was DEAD IN RUNNING TEXT.** Its trailing guard was `(?![^\p{L}\p{M}]|.)`,
      whose `|.` arm rejects EVERY following character — "end of word" was silently "end of INPUT", so the
      rule only ever fired on an input that was nothing but the numeral, i.e. on its unit tests. The 50 lines
      of that shape in FLEURS hr_hr (`1480-ih, kada je…`, `tijekom 1990-ih bilo je`) read the CARDINAL plus a
      stray *ih*, the accusative clitic "them". bosnian/normalize.ts NOTICED this and declined to copy it, in
      a comment, without fixing the original.
- **hr's own: the rate preposition was not per denominator.** `unitPer: "na"` is right for ⟨h⟩ only because
  `sat` is syncretic in the accusative `na` governs; the feminine `sekunda` is not, so `1,5 km/s` and
  `133 m/s` — both written in this corpus — read *kilometara NA SEKUNDA*. `core/normalizeSymbols.ts` already
  takes a KEYED `unitPer` (added for Serbian's *u sekundi*), so the fix is data, not a forked rule.
- Hygiene, no output change: hr's `METAR` count-noun table was declared and consulted by nothing (Serbian's
  m/s rule is what reads it, and hr has none), and `makeSymbolNormalizer` was an unused import.
- ⚠ **STILL OPEN, ALL THREE STANDARDS AGREE ON THEM, AND EACH NEEDS A DECISION RATHER THAN A REWRITE:**
    · **`0,001 grama` reads *nula zarez jedan*** — a 100× error. The decimal comma becomes a word and the
      fractional tail is then re-tokenized, so `Number("001")` is 1 and the leading zeros are gone. sr/hr/bs.
    · **`1 000 000` reads *jedan nula nula*** — no space-grouping arm exists in any of the three (they group
      on periods), so a space-grouped figure is three numbers. Cf. the uz finding.
    · **`1,5 km` takes the genitive PLURAL where `2,5 km` takes the singular** — the shared tier's
      `slavicCountForm` reads the integer part, but a Croatian decimal governs the genitive singular whatever
      it is. The Ukrainian #920 shape, in a language that routes through the shared tier rather than around it.
    · **`1000/2000` loses its slash** (fraction operands capped at 3 digits, the su finding), **`2000. godine`
      keeps a spurious PAUSE** (`ordinalBase` declines a round thousand, documented in sr), **roman numerals
      above V before a lowercase noun read as words** (`VI. svjetski` → *vi svjetski*), **`SAD-u` strands its
      case suffix** after the nominative expansion, and **`1.234.567.890` degrades to digit-by-digit** for want
      of a sourced *milijarda*.
