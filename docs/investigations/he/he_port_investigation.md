# Hebrew (he) TypeScript → C# port — investigation log

The port itself is mechanical and lives in `csharp/Vernacula.Phonemizer/Languages/Hebrew/`. This log holds
the parts whose OUTPUT decided the next step: the numeral defects, the model-absent branch, and the FLEURS
sweep the normalization header said did not exist.

## Run 1 — 2026-08-26, the #1059 ledger entry

Question: is `he`'s place on `test/large-numeral-fidelity.test.ts`'s `ACCEPTED_LOSSY` list the MECHANICAL
class the issue names, or a missing digit-at-a-time arm?

`src/languages/hebrew/numbers.ts:81` read `String(n).split("")` at the overflow fallback, on a value the
caller had already produced with `Number(token)`. Both call sites in `numberToIpa` still held the token
string. Mechanical. Threaded `raw` through `integerWords(n, raw?)`, same shape as the 61 already-swept
modules, removed `he` from the ledger.

    npx vitest run test/large-numeral-fidelity.test.ts   → 4 passed
    npx tsx tools/gen_parity_goldens.mts he              → csharp/goldens/he.tsv UNCHANGED

Golden unchanged, because no golden row carries a ≥13-digit run (`grep -cE '[0-9]{13,}' → 0`). The fix is
latent-only, exactly as the issue predicts.

## Run 2 — 2026-08-26, `dotnet test` after the first C# build

    Failed  NumeralRangeTests.NoPortedLanguageThrowsOnAnyMagnitude
    ["he @ 10000000000: IndexOutOfRangeException"]

The C# test found a defect the TypeScript had too, and it is not an overflow case — it is 1e10. Probed the
TS directly:

    9000000      => "tiʃʔa miljon"
    10000000     THROWS TypeError: Cannot read properties of undefined (reading 'normalize')
    11000000     => "ʔaχat ʔesʁe miljon"
    10000000000  THROWS  (same)

`magnitude()`'s unit arm ran `mult <= 10` and indexed `N.unitsM[10]`. `unitsM` is the masculine units
**0-9**; `unitsM[10]` is `undefined`, the `!` assertion carried it into `compose().flat()`, and
`phonemizeWord(undefined)` threw. So `phonemize(n, "he")` died for every n in 10,000,000-10,999,999 and
10,000,000,000-10,999,999,999 — populations and budgets, not exotica. In C# the same index raises
`IndexOutOfRangeException`, which is why the port's test caught what nothing in the TS suite did.

Not an off-by-one to patch by widening `unitsM`: **there is no masculine ten in this data model by
construction** — `sub100`'s own `n === 10` arm ignores its `masc` parameter and returns the feminine
עֶשֶׂר. So ten routes to `sub1000` like every multiplier above it (`mult < 10`), giving *ʔeseʁ miljon*. That
is the same feminine leakage `numbers.ts`'s header already records for the 11-19 multipliers, and it needs
no number word `hebrew.jsonc` does not carry. Fixed TS-first with a test, golden regenerated (again
UNCHANGED — no golden row is in either range), then mirrored in C#.

`thousands()` has the same `k <= 10` shape and is CORRECT: `thousandsConstruct` has 11 entries and
`[10]` is עֲשֶׂרֶת. Only `magnitude` was wrong.

## Run 3 — 2026-08-26, the corpus-wide differential

Harness: `.probe/he/go.sh` (gitignored). Both engines, sync AND async, foreign-OOV memo cleared between
the two passes. FLEURS text taken from **columns 3 and 4**, sanity-checked that line 1 is a sentence.

| corpus | rows | sync differ | async differ |
|---|---|---|---|
| FLEURS `he_il` (unique texts) | 3,991 | 0 | 0 |
| mined `tools/corpus/mined/he.jsonc` | 373 | 1 | 1 |
| `he-lexicon.tsv` skeletons | 7,800 | 0 | 0 |
| `he-lexicon.tsv` niqqud readings | 7,800 | 0 | 0 |
| hand probes (one per normalize arm + its adversarial neighbour) | 282 | 0 | 0 |

The single mined row is **blocked, not wrong**: `אראס אוזביליז (בארמנית: Արազ Օզբիլիս; …)` embeds an
ARMENIAN run, the script router hands it to `hy`, and `hy` is not ported to C# — the run is dropped and
the row differs by exactly that span.

Coverage check, because a clean differential over a corpus that lacks the construct proves nothing —
share of the 4,364 FLEURS+mined lines reaching each arm: proclitic-dash 13.8%, geresh digraph 9.2%,
ktiv-male ⟨וו⟩/⟨יי⟩ 59.2%, digit token 25.0%, comma-grouped 2.6%, gershayim acronym 2.1%, percent 1.1%,
clock colon 0.9%, glossed abbreviation 0.9%, degree 0.2%, currency 0.2%, superscript 0.1%. Two arms are
×0 in the corpus and are carried by the hand probes alone: **sof pasuq ׃** and **HTML entities**. The
7,800 lexicon skeletons all read DIFFERENTLY sync vs async (`ʃl` → `ʃel`, `ktɡvʁj` → `kateɡoʁja`), which
is the positive proof that the lexicon table is reached and matched, not merely loaded.

Three hand probes read empty on the sync path and one on the async path, all documented and asserted in
the existing tests: bare `ה` and `ע` (silent final he / dropped final ayin), and a bare maqaf `־`.

## Run 4 — 2026-08-26, the MODEL-ABSENT branch

`.probe/he/go_nomodel.sh` builds a mirrored data root with `he-tagger.*` removed, so
`createHebrewTagger()`/`CreateHebrewTagger()` return undefined/null in both engines.

    TS-vs-CS  hand    sync 0   async 0
    TS-vs-CS  fleurs  sync 0   async 0
    TS-vs-CS  mined   sync 1   async 1     ← the same Armenian row

`hebrewNeural.ts`'s contract is "with no model this returns exactly the sync path". Measured, it does NOT,
in EITHER engine, on 115 of 3,991 FLEURS rows and 48 of 373 mined rows — and the two engines disagree
about none of them. Every one of the 115 carries Latin (`grep -cP '[A-Za-z]'` over the differing lines →
115/115): the difference is `phonemizeAsync`'s English foreign-OOV **prewarm**, which reads an embedded
Latin run with the BiLSTM where the sync call reads it with the rule G2P (`ha aᶦ tʰˈiː` → `ha ˈɪt`). That
is `core/foreign.ts` behaviour shared by the whole fleet, above the Hebrew module, not a gap in it. The
module's own contract holds; the docstring is just narrower than it sounds.

## Run 5 — 2026-08-26, re-checking normalize.ts's refusals against FLEURS

`normalize.ts` opened **"⚠ THERE IS NO FLEURS FOR HEBREW"** and sourced every count from the 380 mined
segments. `he_il` exists (3,991 unique texts, files dated 2026-08-17) and the parity golden is drawn from
it, so the claim is stale — and every refusal in that header rests on it. Swept all of them
(`.probe/he/refusals.mts`):

| refusal | mined evidence | FLEURS `he_il` |
|---|---|---|
| no ₪ rule | ₪ ×0 | ₪ **×0** |
| no `%`-prefix arm | ×0 | **×0** |
| no dot-grouping arm | dot+3-digit ×1 (a decimal) | **×0** |
| no arc-minute word | `36°30′` ×2 | **×0** |
| no fraction rule | `D/D` ×11, 2 real fractions | `D/D` **×2**, both `1/5` inch in one sentence |
| no leading-minus rule | ×7, none negative | **×20, none negative** — all date ranges (`1894 - 1895`) |
| no range connective | en-dash ×38 | **×2**, one sentence |

Not one refusal is overturned; several are corroborated at 10× the sample. The live classes are the same
ones at FLEURS scale: proclitic-dash ×485, geresh digraph ×432, comma-grouped digits ×98. Header
corrected in place with these numbers; no rule changed, no golden moved.

One corpus artifact worth knowing about: FLEURS `he_il` writes the gershayim as a DOUBLED ASCII quote
(`5 מ""מ`), a CSV-escaping residue, so letter-flanked gershayim is ×0 there and the acronym arm never
fires on FLEURS. It declines cleanly (`מ""מ` matches neither arm) and both engines agree, so nothing is
broken — but FLEURS cannot be used to measure that arm.

## Findings filed, not fixed

**`hebrew.ts`'s `oovOverride` hook is dead.** `HebrewOovResolver` and the optional second parameter of
`HebrewPhonemizer.text` are documented as "Used by the async neural path (hebrewNeural.ts) to inject the
neural tagger's reading for UNVOCALIZED words". `hebrewNeural.ts` does not use it: it never builds the
sync engine at all, and its `sync()` fallback re-implements the same `assembleClauses` call without the
override. No caller anywhere in `src/`, `test/` or `tools/` passes a second argument. This is the
docstring-names-a-caller-that-does-not-exist shape, not a missing tier — the neural path does reach the
lexicon and the tagger by its own route — so nothing is silently unread, and removing the hook is a
behaviour-free cleanup somebody should make deliberately rather than as a side effect of a port. Ported
1:1 into C# (`Text(string, HebrewOovResolver?)`) so the two trees still diff mechanically.
