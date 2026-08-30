# ht (Haitian Creole) TypeScript → C# port — investigation log

Target: `csharp/Vernacula.Phonemizer/Languages/Haitian/` mirroring `src/languages/haitian/`
(738 lines: `haitian.ts` 117, `normalize.ts` 501, `numbers.ts` 109, `manifest.ts` 11).

## Run 1 — 2026-08-26, port + golden gate

Command: `dotnet run --project csharp/tools/parity -- ht`.
Question: does the straight port reproduce the 200 golden rows byte-for-byte?

Result: **200/200 OK, 0 differ, 0 BLOCKED**, first attempt. `Registry.cs` already carried `case "ht"`;
registration added to `Languages/Bootstrap.cs`; `HaitianManifestIsFullyMapped` and
`HaitianNumbersManifestIsFullyMapped` added to `ManifestMappingTests` (the jsonc is read by TWO
independent types, mirroring the TS module split, so each is asserted against the whole file with the
other's keys listed as metadata).

Implication: the golden is a MINED golden over 200 ht.wikipedia paragraphs. It exercises the g2p and the
common normalizer arms hard, but says nothing about the rare ones. Proceed to the differential.

## Run 2 — 2026-08-26, the intra-word apostrophe and hyphen (the brief's question)

Question: Haitian writes `l'ap`, `n'ap`, `ki-sa`, `pa-t`. Does the word arm stop at either mark, splitting
the word the way Swedish's did in #1073?

Measured, not assumed — over `tools/corpus/mined/ht.jsonc` + `tools/corpus/attest/ht.jsonc` + the 200
golden texts:

| mark | intra-word count | reading |
|---|---|---|
| U+0027 `'` | 73 mined + 46 in the golden texts | **one token** — `l'ap` → *lap*, `d'Alain` → *dalain*, `Louverture's` → *luveɣtuɣes* |
| `-` | 229 mined + 35 in the golden texts | **one token** — `ki-sa` → *kisa*, `pa-t` → *pat*, `politically-engaged` → *politikaljɛ̃ɡaɡed* |
| U+2019 `’` | 13 mined + 2 in the golden texts | **SPLIT** — `l’Hôpital` → *l hopital*, `d’Haïti` → *d haiti* |

So the answer is: the class the brief named IS live in ht, but on the TYPOGRAPHIC apostrophe only.
`hostWordRun(["Latin"], "'-")` never listed U+2019, while `core/clauses.ts`'s own `LATIN_RUN` and
`FOREIGN_RUN` both do, and ~20 sibling Latin engines list it beside U+0027 (kl, kea, qu, sn, so, lg, …).
One construction, two spellings, two readings — and the split leaves a **stranded [l] / [d] in front of
the noun**, which is the defect shape, not merely an inconsistency.

Instances read rather than counted: all 13 are elisions (`d’un`, `d’Amérique`, `d’informatique`, `qu’il`,
`l’innocence`, `d’Haïti`, `L’autoportrait`), and one of them is a Haitian PLACE NAME the corpus glosses
itself — `Mòn Lopital (Morne l’Hôpital)`.

⚠ **THE SECOND HALF OF THE SWEDISH FIX IS NOT NEEDED HERE, and that was checked rather than assumed.**
Swedish needed a `medialOnly`-plus-lookahead guard because its g2p passes an unread character through into
the IPA. `haitian.ts`'s `scan` has no fall-through: `const ph = G[c]; if (ph !== undefined && ph !== "")`
drops any character `graphemes` does not name. Probed both ways round — `’moun yo` → *mun jo* and
`moun’ yo` → *mun jo*, byte-identical to the U+0027 spellings, before and after the widening.

**Fixed, TypeScript first (`src/languages/haitian/haitian.ts`), then goldens, then C#:**

    hostWordRun(["Latin"], "'-")  →  hostWordRun(["Latin"], "'’-")
    NATIVE_CLASS "[a-zèòéàA-ZÈÒÉÀ'-]"  →  "[a-zèòéàA-ZÈÒÉÀ'’-]"

Before / after, on the golden's own two rows:

    d’Haïti          d haiti          →  dhaiti
    L’autoportrait   l autopoɣtɣait   →  lautopoɣtɣait

**2 golden rows moved** (rows 9 and 182), both this shape. Pinned in `test/haitian.test.ts` (the ASCII and
typographic spellings must produce IDENTICAL output) and in `csharp/…Tests/HaitianTests.cs`.

## Run 3 — 2026-08-26, the differential

There is **no FLEURS for Haitian Creole**, so widening (1) of PORTING.md is unavailable and the weight
falls on the mined artifacts plus hand probes.

* 571 unique lines from `tools/corpus/mined/ht.jsonc` + `tools/corpus/attest/ht.jsonc`
* 265 adversarial probes — one per `normalize.ts` arm plus the neighbour each arm must decline, every
  number band the LSP table names, and the g2p corners (nasal contexts, `Vnn`, digraphs, ⟨r⟩→[w],
  degemination, both apostrophes, the hyphen, an astral character, a LONE SURROGATE, combining marks)
* 102 further probes for the accented forms the first set missed (`20yèm`, `km/èdtan`, `°C`) and the
  crash corners (empty string, bare `$`/`%`/`°`, `9007199254740993yèm`, 24-digit runs)

938 lines, **sync and async, both engines: 0 differ**, before and after the U+2019 fix.

⚠ **What fraction of the corpus reaches the new code:** all 571 lines run the g2p and the clause
assembler; 13 lines carry the U+2019 the fix is about; 0 lines carry an astral code point outside the two
that route to a Han engine, so the lone-surrogate and astral probes are synthetic (no crash in .NET —
`scan` indexes UTF-16 code units exactly as the JS does, and the unmapped half is dropped rather than
handed to `Normalize`).

## Run 4 — 2026-08-26, reading for defects the gate cannot see

Both engines agree byte-for-byte on every item below, so no gate could ever fire on one. See the register below
for the summary; the measurements are here.

### A decimal glued to a letter reads its separator as a CLAUSE BREAK — ×8 attested, NOT FIXED

`normalize.ts` step 10's trailing guard is `(?![\d\p{L}\p{M}])`, documented as keeping "a dotted
designation (`802.11a`) out". Declining is not neutral: the `.` or `,` survives to the tokenizer, whose
punctuation arm turns it into a full stop or a comma pause. One number becomes two utterances.

    17.09m.        →  disɛt . nɛf m .            (an athletics distance, mined)
    1.9pwen        →  ɛ̃ . nɛf pwɛ̃                (a basketball statistic, mined)
    442.7k disip   →  kat sã kaɣãnde . sɛt k     (a follower count, mined)
    8.5x11         →  ɥit . sɛ̃k ks ɔ̃z            (a page size, mined)
    802.11n        →  ɥit sã de . ɔ̃z n
    1 a 1,5m       →  ɛ̃ a ɛ̃ , sɛ̃k m              ← THE FILE'S OWN ATTESTATION for the `a` connective
    50cm a 1,80m   →  … a ɛ̃ , katɣevɛ̃ m          ← likewise

⚠ The last two are quoted verbatim in `normalize.ts` twice (step 5's span paragraph and RANGE's
connective paragraph) as the corpus evidence for rules the file DOES ship — and they misread.

Counted over mined + attest + the golden texts: `\d[.,]\d+[letter]` ×12. Two are already rescued by the
unit tier (`1.00mm`, `7.5cm` — `mm` and `cm` are declared keys), 3 are genuine quantities glued to a
non-key (`17.09m`, `1.9pwen`, `442.7k`), 5 are designations or URL residue (`8.5x11`, four
`doi:10.1075/…`). **The current reading is wrong for all 8** — the guard does not leave a designation
alone, it inserts a sentence boundary into it.

NOT FIXED: the repair is a designations-vs-quantities judgement. Reading the separator as `vigil` fixes
the 3 quantities and replaces a bogus full stop with a bogus *vigil* in the 5 designations; the third
option — keep declining but suppress the pause — needs a mechanism neither engine has. **0 golden rows
reach the shape**, so it is cheap to land once the call is made. Related and NOT independently fixable:
`m` is deliberately excluded from `UNITS` (the file's own `107 m jou lane` counter-example), so `17.09m`
cannot be rescued the way `7.5cm` is.

### A NON-ASCENDING span drops its unit entirely — ×0 attested, NOT FIXED

Step 5's single-operand arm carries `(?<!\d\s?[-–—]\s?)`, so it declines the second operand of a dash
span. That guard is only ever REACHED when the span arm has already declined (when the span arm fires it
rewrites the dash away), and non-ascending pairs are exactly what the span arm declines:

    50-53 km  →  sɛ̃kãt a sɛ̃kãntwa kilomɛt      (ascending: the unit is read)
    53-50 km  →  sɛ̃kãntwa sɛ̃kãt km             (descending: the unit is GONE)

×0 in either artifact (`\d+\s?[-–—]\s?\d+\s?(?:km|cm|mm|kg)` descending). Unreachable today, live the
moment one appears — the `tl numberStressIdx` shape, filed for the same reason.

### The `-eyen` ordinal band strands a bare *jɛm* — the very defect step 12 exists to fix

`ordinalWord` declines when no tail matches, which is the documented behaviour for the `-en` band, but the
raw suffix then reads as its own word:

    20yèm  →  vɛ̃tjɛm            (claimed)
    21yèm  →  vɛ̃tejɛ̃ jɛm        (declined — *ven* plus a separate *jɛm*, step 12's own before-picture)
    81yèm  →  katɣevenɛ̃ jɛm
    101yèm →  sã ɛ̃ jɛm
    0yèm   →  zewo jɛm
    1000000yèm → ɛ̃ miljɔ̃ jɛm

NOT FIXED: `venteyen` + `yèm` is unsourced, and `ordinalTails` is a sourced table. Needs a Haitian
ordinal for the `-eyen` decade band. All 22 `ordinalTails` rows ARE reached (checked by composing every
band); this is the gap between them.

### Smaller, all pre-existing and all shared shapes

* `2 − 2 fè zewo` → *de de* — U+2212 in SPACED arithmetic is silent (step 4b claims the LEADING sign only,
  deliberately). An operator dropped, not mis-read.
* `20 °Cx` → *vɛ̃ kks* and `(0) c°` → *zewo k* — the degree sign vanishes when a letter follows or when the
  number is not adjacent. Identical to the `lo` finding already filed in `docs/csharp_port_findings_investigation.md`.
* `ISBN`, `US`, `X` read as Haitian WORDS (*isbn*, *us*, *ks*) because ht has no `letterName` table —
  espeak ships no Haitian Creole. The fleet-wide sourcing block `normalize.ts` already records.

### Hygiene, no output change

`normalize.ts` step 1's zero-width class was written
with the four characters written literally, so the line reads as an empty class. Escaped to `/[\u200b\u200c\u200d\ufeff]/` in both
engines — the #931 rule. Verified byte-identical over all 938 differential lines afterwards.

---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

### From the ht port (2026-08-26) — 200/200 first run

⚠ **THE INTRA-WORD MARK CLASS IS LIVE IN ht, AND IT IS THE TYPOGRAPHIC APOSTROPHE, NOT THE ASCII ONE.**
Haitian writes `l'ap`, `n'ap`, `ki-sa`, `pa-t`, and the word arm already carried `"'-"` — measured over
mined + attest + the 200 golden texts, 73+46 intra-word U+0027 and 229+35 intra-word hyphens all read as
ONE token. **U+2019 did not**: 13 mined + 2 golden instances, every one an elision, and every one split at
the mark — `l’Hôpital` → *l hopital* against `l'Hôpital` → *lhopital*, a stranded [l] in front of the
noun. `core/clauses.ts`'s own `LATIN_RUN`/`FOREIGN_RUN` list U+2019 and ~20 sibling Latin engines do too;
ht simply missed it. Fixed TS-first (`"'-"` → `"'’-"`, and the same in `NATIVE_CLASS`), **2 golden rows
moved**, pinned in both suites as "the two spellings must read IDENTICALLY".
⚠ The second half of the Swedish fix (#1073) was NOT needed and that was checked, not assumed: `scan` has
no fall-through — an unnamed character is dropped, never passed into the IPA — so a leading or trailing
quote still reads as nothing (`’moun` → *mun*).

Found, not fixed:

- **A decimal glued to a letter reads its separator as a CLAUSE BREAK — ×8 attested.** Step 10's trailing
  `(?![\d\p{L}\p{M}])` is documented as keeping a dotted designation (`802.11a`) out; declining is not
  neutral, because the surviving `.`/`,` is then CLAUSE PUNCTUATION. `17.09m.` → *disɛt . nɛf m .*,
  `1.9pwen` → *ɛ̃ . nɛf pwɛ̃*, `442.7k` → *… kaɣãnde . sɛt k*, `802.11n` → *ɥit sã de . ɔ̃z n*. ⚠ **Two of
  the eight are `normalize.ts`'s OWN attestations** — `1 a 1,5m` and `50cm a 1,80m`, quoted twice in the
  file as the evidence for the `a` connective, read *ɛ̃ a ɛ̃ , sɛ̃k m*. 3 of the 12 corpus instances are
  genuine quantities, 5 are designations/DOIs, 2 are already rescued by the unit tier — and the current
  reading is wrong for ALL of them. NOT FIXED because the repair (read the separator as `vigil`) trades a
  bogus full stop for a bogus *vigil* in the designation half; that is a corpus call, not a port call.
  0 golden rows reach the shape.
- **A NON-ASCENDING span drops its unit entirely.** `53-50 km` → *sɛ̃kãntwa sɛ̃kãt km* against `50-53 km`
  → *… kilomɛt*. Step 5's `(?<!\d\s?[-–—]\s?)` on the single-operand arm is only ever REACHED when the
  span arm declined (a successful span rewrites the dash away), so its whole effect is to delete the unit
  in exactly that branch. ×0 attested — the `tl numberStressIdx` shape, live the moment one appears.
- **The `-eyen` ordinal band strands a bare *jɛm*** — the before-picture step 12 exists to fix, surviving
  wherever `ordinalTails` has no match: `20yèm` → *vɛ̃tjɛm* but `21yèm` → *vɛ̃tejɛ̃ jɛm*, and likewise 31,
  41, 81, 101, 0 and every magnitude. Needs a sourced Haitian ordinal for the decade+`eyen` band; all 22
  `ordinalTails` rows themselves ARE reached (checked by composing every band).
- Shared shapes, already filed for other languages: `2 − 2` reads *de de* (step 4b claims the LEADING
  U+2212 only, deliberately); `20 °Cx` → *vɛ̃ kks* and `(0) c°` → *zewo k* (the `lo` degree finding);
  `ISBN`/`US`/`X` read as Haitian words because espeak ships no Haitian Creole letter names.
- Hygiene, no output change: step 1's zero-width class was written with the four INVISIBLE characters, so
  the line read as an empty class. Escaped in both engines (the #931 rule).
