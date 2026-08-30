# sl — C# port investigation

⚠ This port predates the per-language investigation-doc convention, so this file begins with its findings register rather than a run log.


---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

### From the sl port (2026-08-27) — ⚠ THE GOLDEN ITSELF WAS WRONG, and six more defects no golden can see

**sl (Slovenian, ~2.5M)** — 5 files, ~1,020 C# lines over a 1,587-line TS module, the largest normalizer in
this wave (1,068 lines). Gate **114 → 115 languages, 22,496 → 22,696 rows, 0 differ, 0 BLOCKED**; C# tests
1,320 → 1,333.

⚠ **THE FIRST PARITY RUN REPORTED 8/200 DIFFER, AND THE C# WAS RIGHT.** Running the TypeScript against the
same golden reported *the same eight rows*: `csharp/goldens/sl.tsv` had been stale since #1072 landed the
`loadTsvMap` fold a day earlier. That commit's own summary said "the goldens did not move and the parity
gate stayed at 0 differ", which was true only because **sl was unported, so nothing ran its golden.** The
reasoning behind the claim is the durable finding: "an alias is written only into a FREE slot, so no reading
the engine can already reach can change" is about LEXICON-RESOLVED readings, and a free slot is free
precisely because the word was an OOV MISS — whose fallback answer the goldens record. Slovene's fold adds
680 headwords, and eight golden rows moved off the penultimate fallback onto the lexicon
(`umrl`: *ˈumərl* → *umˈərl*). sv/nb/da/bal were re-checked the same way and are all 0 differ, because in
those four the fold repairs a broken agreement rather than adding entries. Corrected in `loadTsv.ts`'s
docstring, its C# counterpart, and Run 3 of `docs/investigations/nativiser_lexicon_seam_investigation.md`.
**A change that touches a lexicon must regenerate the goldens of every language reading it, PORTED OR NOT.**

⚠ **THE FOLD IS THE PORT'S ONE MANDATORY PIECE OF WIRING.** `stress.tsv` is the fleet's worst case: 1,252 of
37,340 keys are ə/ł kaikki respellings no Slovene input can spell. Both engines now dump a **byte-identical
38,020-key map** (37,340 file keys + 680 aliases), and the **102 shadowed pairs resolve identically** under
the unfolded-key-wins rule, whose tie-break needs the FILE'S row order — `LoadTsvMapV` gained the same
`fold` parameter its reference-type sibling already had. Pinned in `LexiconFoldTests`.

Fixed in TypeScript first with tests, goldens regenerated — **0 of 200 rows moved for all six**:

- **A 100× ERROR IN THE DECIMAL, the sr/hr/bs shape (#1076) in a fourth language that groups the same way.**
  Step 16 replaced the comma and left the fractional run as its own token, which the tokenizer reads with
  `Number()` — so `Number("001")` is 1 and `0,001 grama` read *nič vejica ena grama*, "zero point one gram".
  On top of the magnitude error it is a distinct-numbers violation: `1,05 km` and `1,5 km` read IDENTICALLY.
  The zeros are emitted as DIGITS, as in Serbian, because the number arm already reads a bare `0` as *nič*.
- ⚠ **`\p{Lu}` UNDER `/i` MATCHES A LOWERCASE LETTER, AND sl HAD TWO CAPITALISATION GUARDS BUILT ON IT.**
  Both were therefore absent, and both files state the guard as load-bearing:
    · the HONORIFIC rule ("expanded ONLY before a capitalised word, and that guard is not cosmetic" — `ga.`
      is the accusative pronoun *ga*) read `Vzel ga. je` as *Vzel gospa je*, the exact reading it was written
      to prevent;
    · the REGNAL rule claims "the intervening words must all be capitalised, so the shape … cannot match
      anything else" — and instead matched ORDINARY PROSE: `kralj je bil 12 let` → *dvanajsti let*,
      `cesar je umrl pri 40 letih` → *štirideseti letih*, `papež je bil star 78 let` →
      *oseminsedemdeseti let*, `poglavar je govoril 2 uri` → *drugi uri*. All four titles take a bare
      quantity like that in ordinary Slovene, so this is not an exotic false positive.
  Fixed by spelling the abbreviation's/title's own case into the class and dropping the flag. ⚠ **MEASURED
  COST, stated rather than hidden: 10 corpus lines change, and every one is FLEURS' all-lowercase column 4**
  (`ga. kirchner`, `dr. damadian`, `kraljica elizabeta 2`) — a transcript artifact, not Slovene text. The
  properly-cased column 3, which is what the goldens use, is untouched. ⚠ **`xhosa/normalize.ts:194` has the
  same shape** (`(?=[ ]\p{Lu})` under `giu`) and is NOT fixed here — see below.
- **The era marker's `i` flag ate a person's initials** — `N. Š.` is also two capital letters with stops, and
  this block runs BEFORE the dotted-capital-run rule, so `N. Š. Kovač je prišel` read *našega štetja. Kovač*:
  a name replaced by a date. Exactly the defect `croatian/normalize.ts` was fixed for in #1074, in a file
  that inherited the shape. All ELEVEN era instances in sl_si are lowercase, counted.
- **The degree rule TRUNCATED its count, so a decimal could never reach the fifth slot** — the Ukrainian #920
  shape. `slovenian.ts` declares that slot as "the genitive SINGULAR a decimal governs" and `counted()`
  indexes the same table the shared tier does, but `intOf` truncated first: one construction had three
  answers — `1,5 °C` → *stopinja* (nom.sg), `2,4 °C` → *stopinji* (DUAL), `0,5 °C` → *stopinje* — while
  `1,5 km` through the tier read the gen.sg *kilometra*.
- **`slCountForm` routed ZERO to the paucal**, the form for 3–4: `n <= 4` is true of 0, so `0 %` read *nič
  odstotki* and `0 km` *nič kilometri*. The shared `slavicCountForm`'s mod-10 arithmetic sends 0 to its
  many-slot, and Slovene takes the genitive plural (*nič odstotkov*). The kk `orthographic(0)` shape: a
  guard catching zero by accident. ×0 in sl_si, which writes no zero quantity at all.
- **Hygiene, no output change:** `slovenian.jsonc`'s header listed `EVA` among "the genuinely word-read ones
  … left to the g2p" while `acronymLetters` contains it — and the corpus's one instance is
  `dejavnost človeka zunaj plovila (EVA)`, an initialism. The data was right and the comment was not.

**Widenings.** Corpus-wide differential: 3,806 FLEURS `sl_si` lines (col 3+4), sync AND async, 0 differ, 0
throws. Off-golden probes: 325 hand-built lines (one per arm plus the adversarial neighbour each arm must
decline), × normalize, sync and async, 0 differ. Reachability swept: all 20 `acronymLetters` rows fire and
none is redundant (the shared OOV test would spell none of them); every `LETTER_NAME`, `DENOMINATOR`, `URA`,
`GOV_SLOT` and `COUNTED` row is reached. Coverage of the new code, measured not assumed: of 3,806 corpus
lines, 784 carry a digit, 187 an `N.` ordinal, 120 an all-caps run, 74 a colon/period clock, 60 a regnal
title, 52 a slash, 42 a period-grouped figure, 37 a unit key, 32 a numeral-initial compound, 30 a decimal
comma, 30 a dotted abbreviation, 24 a range dash, 10 an era marker, 8 a percent, 8 an exponent, 4 a degree
sign. **Currency signs and space-grouped thousands are ×0 in the corpus** — both are carried by the probes
only, and the currency table is declared on the strength of the spelled nouns.

**Found and NOT fixed — filed, with the count that decided it:**

- ⚠ **THE SHAPE IS A FLEET CLASS, AND ONE SITE REMAINS.** Swept `tools/extract_regexes.mts`'s pattern
  corpus for `\p{Lu}`/`\p{Ll}` inside an `i`-flagged pattern: after the two sl fixes, two were left; the xh
  port has since closed one, so the sweep now returns exactly ONE.
    · ~~**`xhosa/normalize.ts:194`**~~ — `(u?)Mnu\.?(?=[ \u00a0]\p{Lu})` under `giu`, the identical DEAD
      positive guard. Reported rather than fixed here, per trap 55; **verified and fixed by the xh port**,
      which found the report right about the guard and wrong about the repair — the `i` was also carrying
      the case-sensitive `(u?)` concord, so dropping the flag alone would have broken `UMnu.`. See the xh
      section below.
    · **`slovenian/normalize.ts`'s own `CLOCK_GOV`** — `[\p{Ll}\p{M}]+` under `iu`, the "ONE intervening
      adverb" slot, which therefore also admits a Capitalised word, so `do Ljubljane 15.00` takes the
      genitive slot the preposition governs rather than the ungoverned nominative. Left as it is: the
      preposition alternation needs the `i` for a sentence-initial *Ob*/*Med*, the effect is on the CASE
      SLOT rather than on which words are read, and ×0 in the corpus has an intervening capital.
  `german/normalize.ts:191` has the shape too but is built from a template and is not in the extracted
  corpus; there the `\p{Lu}` sits in a NEGATIVE lookbehind, so `/i` widens what the rule REFUSES — the
  conservative direction — and it is noted rather than filed.
- **`20 °Cx` glues the degree noun onto the letters** — *dvajset stˈɔpint͡sks*. The `(?![\p{L}\p{M}])` guard
  correctly declines the °C arm, and the BARE-degree arm then fires on the same digits. Identical to the su
  `25°Cölner` and lo `20 °Cx` findings; the repair is the same fleet decision, not an sl edit. ×0 attested.
- **`(0) c°` reads *nič t͡s*** — the scale letter is lost and the degree word never appears, the lo finding
  one bracket over. ×0 attested in sl_si.
- **A hyphen-suffixed numeral drops a leading zero**: `0830-ih` → *osemsto tridesetih*. Step 7 passes `raw`
  but `numberToWords` only consults it above 1e12, so the four-digit token goes through `Number()`. Same
  class as the decimal fix above; ×0 attested, and the shape only exists for clock hours written with a
  leading zero.
- **`UTC-5` keeps its hyphen** where `UTC+1` is read: step 11's timezone arm claims only the `+` (the
  corpus's one sign), and the g2p then drops the hyphen. ×0 attested. The cy/ga `GMT-00:43` shape.
- **`1000/2000` loses its slash** (fraction operands capped at 3 digits — the su finding, fleet-wide) and
  **a trillion reads digit-by-digit** (`numbers.ts` declares no magnitude above *milijarda*; needs a sourced
  Slovene *bilijon*, and the manifest's `magnitudes` block is the place for it).
- **`ordinalBase` accepts n < 1,000,000 but no caller can exceed four digits** — every ordinal rule's
  numeral group is `\d{1,4}`, so the 10⁴–10⁶ band of the compositor is unreachable. Inert, not wrong.
- **`53-50 km` is read as a SCORE** (*triinpetdeset proti petdeset*), because step 5a's discriminator is
  direction and a non-ascending two-digit pair is a score by construction. Documented design; recorded
  because a descending range is a real construction and the ht port filed the mirror case.
