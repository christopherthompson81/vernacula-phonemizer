# Symbol-tier sweep — investigation log

Prompted by an observation on Afrikaans: *"SYMBOLS: looks data shaped. Possibly other languages already
ported have a similar issue."*

## Run 1 — 2026-08-25 09:30 — the scale

**Command.** For every ported language, find the `makeSymbolNormalizer({…})` call and check whether its
manifest declares a `symbols` block.

**Finding (raw).** 44 ported languages call the shared tier. **6 read it from their manifest** (hindi,
italian, portuguese, spanish, ukrainian, yoruba — four of them lifted earlier in this session). **38 carry
it inline**, including German and Greek, whose *word* tables were lifted but whose symbol tiers were never
touched.

So the observation generalises, and the fleet is mid-migration in a way nothing was tracking: `signWords`
was rolled out as a manifest key across many languages, and the rest of the same tier stayed in code beside
it. Afrikaans is exactly that shape — `multiply` already reads `MANIFEST.signWords.times`, and the seven
keys around it are literals.

## Run 2 — the method: transliterate, do not extract

**⚠ THE COMMENTS ARE THE ASSET.** Each tier body carries the evidence for every declared unit — why a bare
`m` is declared, why ⟨V⟩ and ⟨W⟩ are capital (Volta, Watt, and the resolver is case-sensitive for one-letter
symbols), which hazards are bounded and unattested (`802.11m` reading "…elf METER"). A data-only extractor
would drop precisely the part that cannot be reconstructed.

A TS object literal is nearly JSONC already, so the transform is: quote the bare keys, keep every `//` line
where it sits. The evidence travels with the values it explains.

## Run 3 — 2026-08-25 09:55 — `komma`, and a fleet-wide inconsistency behind it

Prompted mid-run: *"komma too."*

**Finding (raw).** 35 languages declare a decimal word in their manifest. **Four passed it to the engine as
a bare literal**: afrikaans `komma`, asturian `coma`, occitan `virgula`, polish `przecinek`. The same fact
was manifest data in Dutch (`numbers.decimalWord`) and a string in the code next door in Afrikaans.

⚠ And on BOTH sides — the C# `Afrikaans.cs` had `PhonemizeWord("komma")` at the matching line. All four
languages, both engines, eight literals. Lifted together, since a `decimalWord` fix is one line per side.

⚠ The key is not in the same PLACE in every language: Afrikaans takes it at the top level, Dutch nests it
under `numbers`. The coupling test reads whichever exists rather than assuming a shape.

## Run 4 — four tooling defects, three caught by measurement

**1. A bare identifier is not data.** Turkish's tier had `units: UNITS`, referencing a local const. The
transliterator copied the identifier into the jsonc and produced invalid JSON — which surfaced only when the
manifest failed to load. The tool now refuses a bare-identifier value. ⚠ And `UNITS` has a SECOND consumer:
`UNIT_ALT`, which keys the apostrophe-suffix rule on the declared units rather than on `\p{L}+`. So the
binding stays, now pointing at the manifest — one source, two consumers.

**2. `percentPrefix` reached the jsonc and nothing wired it back.** Turkish and Hausa put the percent word
BEFORE the number (*yüzde elli*). The flag was transliterated correctly and omitted from the applier's
wiring list, so both languages silently reversed their word order — no error, no throw. **The probe caught
it**: `jyzdˈe ellˈi` → `ellˈi jyzdˈe`. Declared-but-unread, the same failure the it lift hit with `ordinals`.

**3. The C# applier dropped `Multiply`.** Its filter for "keep this in code" tested for `=>`, and
`Multiply = new MultiplyDef { … }` has none. Afrikaans lost it, and `4x4` read *fˈir ˈɛks fˈir* — "four EX
four", the letter name — instead of *fˈir kˈiər fˈir*. **The golden caught this one**, not the probe: it is
the one af golden row containing `4x4`.

**4. An insertion that ate a closing brace.** Extending four C# manifest classes with `s[:j-1] + field +
s[j:]` dropped the `}` at `j-1`. Caught by the compiler, unlike the three above.

## Run 5 — two more test assertions wrong on correct data

- Comparing a stress-stripped WORD against a sentence that still carried its stress mark — `kɔma` vs
  `kˈɔma`. Strip both sides.
- Assuming `decimalWord` sits at the top level in every language; Dutch nests it.

## Result — batch 1 of the symbol sweep

`af`, `nl`, `tr`, `ha`, `mi` symbol tiers lifted verbatim, comments included; `decimalWord` lifted for `af`,
`ast`, `oc`, `pl` on both sides. `mi` gained the `manifest.ts` it lacked (its tier lives in normalize.ts
while its `DEF` lived in maori.ts — importing across would have been a cycle).

0 probe readings moved for any of the nine. Parity 60 languages / 12,000 rows / 0 differ; 459 C# tests,
5,129 TS tests.

## Batch 2 — ast, oc, umb, ko, ceb — 2026-08-25 10:20

**⚠ `4x4` IS NOW IN EVERY PROBE, because batch 1's worst bug was one no probe covered.** Dropping `Multiply`
made Afrikaans read `4x4` as *fˈir ˈɛks fˈir* — "four EX four", the letter name — and only the single `4x4`
row in the af GOLDEN caught it. ASCII ⟨x⟩ between digits is the case a symbol-tier port loses most quietly,
because the output stays plausible. Both the probes and the coupling test now carry it, and the test is
verified by dropping `Multiply` again.

**The C# applier is fixed at the source too.** Its keep-in-code filter required `=>` on the line, which is
why `Multiply = new MultiplyDef { … }` fell through. It now keeps any key whose value is not a manifest
reference.

**Two more languages needed a `manifest.ts`** for the reason Māori did: the symbol tier lives in normalize.ts
while `DEF` lives in the engine file, so importing across would be a cycle. `ceb` joined `mi`, `jv` and `it`
in that group.

**0 of 36 probe readings moved** across the five, sync and async; C# matches Node in both.

## Batch 3 — de, el, pl, hu, ru, fr — 2026-08-25 10:50

The European group, and the first batch where the tiers carry real per-language machinery: Polish keeps
`plCountForm` (its count agreement is NOT Russian's — a numeral ending in "jeden" takes the genitive plural)
and Russian keeps `slavicCountForm`. Both are code and stayed in code; only the tables moved.

**Polish's `units` was a cross-file export.** `normalize.ts` declared `export const UNITS` and `polish.ts`
imported it purely to hand to the tier — one consumer, one direction, and a table living in the wrong file
to reach the manifest. Moved into `symbols.units` and the export dropped.

**0 of 57 probe readings moved** across the six, sync and async; C# matches Node in both.

### ⚠ Two mistakes of my own, one caught by the compiler and one by a test

**Auto-detecting the C# class name grabbed the wrong class.** The helper picked the FIRST `*Manifest|*Def`
in each file, which for Greek, Polish, Hungarian and Russian is a nested helper (`GreekNumbersDef`,
`AdjectiveStressDef`) rather than the top-level manifest. Four `Symbols` properties landed on the wrong type.
The compiler caught it; naming the class explicitly is the fix, and the same shape bit the letterNames sweep
earlier — auto-detection by regex over a file with several classes is not worth the keystrokes it saves.

**And the batch's generic unit assertion was wrong about count agreement.** It compared the reading against
`units.km[0]`, the SINGULAR — but `5 km` takes the PLURAL in Greek (χιλιόμετρα), so a correct reading failed.
The honest assertion is that the reading contains ANY declared form, because which one is right is exactly
the language-specific fact the tier exists to encode.

## Batch 4 — bn, gu, kn, ml, or, pa — 2026-08-25 11:30 — the Indic group, and a name that was already taken

**⚠ `symbols` WAS ALREADY IN USE, AND IT MEANS SOMETHING ELSE.** Every abugida manifest declares
`symbols` as the BARE-SIGN → word map the engine's own tokenizer reads — `{"%": "प्रतिशत"}`, with `₹`
stripped. The shared tier's data is a different table read by a different pass, so filing both under one
name would be the `PREFIX_GUESS` shape. Here it also simply would not compile. Lifted as **`symbolTier`**.

**⚠ AND THAT CORRECTS AN EARLIER COUNT IN THIS DOCUMENT.** Run 1 reported "6 languages already read the tier
from their manifest" by looking for `"symbols"` in the jsonc — which for the Indic languages matched the SIGN
MAP. Hindi and Yoruba both still have inline tiers, so the real figure was **4** (uk, es, pt, it) and the
remaining count was two higher than stated throughout batches 1–3.

**Five languages needed a `manifest.ts` or a module-level `DEF`**, all for the same reason and all found the
same way — the tier lives in normalize.ts while the manifest was loaded in the engine file, or loaded lazily
inside a factory. bn, gu, pa (TS) and bn, pa (C#) got one; `or` joined it, jv, mi and ceb.

**0 of 37 probe readings moved.** C# matches Node in both modes.

### ⚠ Three tooling defects, and the third is the one worth remembering

**1. Indentation is not structure.** `bengali.ts` declares its tier inside a function, so some keys sit at 4
spaces and others at 8. Preserving that put top-level keys at two depths in the jsonc and broke every tool
that finds them by indentation. The transliterator now re-indents from BRACE DEPTH.

**2. A non-literal value is code, not data.** The guard added in batch 1 only caught an UPPERCASE identifier
and missed `units: def.unitWords ?? BENGALI_UNITS` — a manifest OVERRIDE with a built-in fallback. It was
copied into the jsonc and surfaced only when the manifest failed to parse. The rule is now: a literal starts
with a quote, brace, bracket, digit or boolean; anything else stays in the .ts.

**3. ⚠ AND THE SAME EXPRESSION WAS SILENTLY DROPPED ON THE C# SIDE.** The C# applier kept a hand-list of
three key names (`Multiply`, `Ampersand`, `CountForm`) and dropped everything else it was not wiring — so
Bengali's `Units = def.UnitWords ?? BENGALI_UNITS` vanished and `25 km²` read *pɔ̃t͡ʃiʃ ˈʊkm* instead of
*pɔ̃t͡ʃiʃ bɔɾɡo kilomiʈaɾ*: the unit gone, the raw letters spoken, on the C# side ONLY. The probe caught it.
The applier now keeps EVERY key the manifest is not taking over, rather than three named ones.

That is the second time this sweep that a hand-list in the tooling silently dropped a key, and both times the
loss was invisible to the compiler and visible only in a reading.

## Batch 5 — yue, ja, cmn, th, vi — 2026-08-25 12:10 — the unspaced scripts, and one name fleet-wide

**`unspacedScript` is the `percentPrefix` shape again**, and it was probed as such rather than trusted. The
tier's boundary guards assume spaces between words; Chinese, Japanese and Thai have none, so without the flag
the ORDINARY case is the one the guard rejects and `為$500` drops its currency sign outright. Every probe in
this batch is written UNSPACED, because spaced input cannot tell the difference. Verified by dropping the
flag from Cantonese and watching the test fail.

**⚠ AND THE KEY NAME WAS UNIFIED ACROSS THE WHOLE SWEEP.** Batch 4 had to call the Indic block `symbolTier`
because `symbols` was already the abugida sign map. Leaving batches 1–3 on `symbols` would have meant the
same table under two names depending on the language — the split this sweep exists to remove. All 31
manifests now use `symbolTier`, and `symbols` means one thing everywhere: the bare-sign map.

### ⚠ Three more tooling defects, two of them mine twice over

**1. "Keep every key" kept the wrong lines.** The batch-4 fix told the C# applier to keep any key the
manifest was not taking over — matched on line SHAPE, so it also kept the INNER lines of a multi-line nested
initializer. Japanese's `ExponentWords = new ExponentWordsDef { Squared = …, Cubed = …, Position = … }`
produced three bogus top-level assignments to fields `SymbolData` does not have. The compiler caught it; the
filter now tracks BRACE DEPTH and keeps depth-1 keys only.

**2. A blanket rename over `test/` hit languages outside the sweep.** `abkhaz` and two shared test files use
`symbols` for their own purposes and were rewritten. Reverted. This is the third blanket-identifier rename in
this project to overreach — the `\p{L}` corruption in #950 was the first.

**3. ⚠ AND THE SAME RENAME CORRUPTED THE TEST THAT DOCUMENTS THE DISTINCTION.** The Indic coupling test
deliberately asserts that `symbols` — the SIGN MAP — has single-character keys. The rename rewrote it to
`symbolTier`, so the test that exists to keep the two tables apart began asserting they were the same one,
and failed. Restored with the reason recorded in the assertion itself.

**Verification of the rename specifically:** all 27 previously-lifted languages re-probed after it, 0 moved,
plus a C# spot check on one language per earlier batch.

## Batch 6 — hi, ur, ta, te, id (and mr, which needed nothing) — 2026-08-25 12:50

**⚠ MARATHI CAME OUT EMPTY, AND THAT WAS THE RIGHT ANSWER.** Every key in its tier is an expression reading
`DEF.percent`, `DEF.currency`, `DEF.units`, `DEF.multiply`, `DEF.ampersand` — its symbol data was already
lifted in #953, under TOP-LEVEL keys rather than a `symbolTier` block. The transliterator correctly rejected
all five as code, leaving an empty block, and the honest move was to REVERT Marathi entirely rather than add
a `symbolTier: {}` to make the shape uniform.

The invariant worth holding is not "every language has the same key". It is that **no language reads a
hard-coded table** — and Marathi already didn't. The coupling test records the three routes the `HindiDef`
family took rather than flattening them.

**⚠ AND THE RENAME HIT THE WRONG KEY IN HINDI.** `hindi.jsonc` has BOTH tables: the sign map
`"symbols": { "%": "प्रतिशत" }` near the top, and the tier appended at the end. A first-occurrence
`.replace(..., 1)` renamed the SIGN MAP to `symbolTier` and left the tier as `symbols`, so the tier loaded
as `{}` and `50% लोग` lost its percent word, `$50` its currency, `4x4` its multiply, `25 km²` its unit — four
readings gone at once. The probe caught it. Hindi was the only language in the sweep with both tables in one
file, which is exactly why a positional rename was the wrong tool.

**Two more languages needed a module-level manifest** — hi (TS and C#) — because the tier is built once at
module scope while the manifest was loaded per call inside the factory.

**0 of 39 probe readings moved.** C# matches Node in both modes.

## Batch 7 — am, ar, jv, qu, sw, tg, yo — 2026-08-25 11:00

The last seven in the ported set. Probes: 100 lines across the seven, each covering every key its language
declares, plus a `4x4` line and a rate line. **0 readings moved**, both modes, and C# matches Node on all
fourteen runs.

**⚠ THE HAND-WRITTEN KEY LIST WAS THE BUG, THREE TIMES OVER, AND IT IS NOW DERIVED.** Both appliers (TS and
C#) carried a literal list of tier key names that predated three `SymbolData` fields. Swahili declares two of
them — `currencyPrefix` and `unitPrefix` — so the lift would have moved both flags into `swahili.jsonc` and
then wired back neither: the data present, nothing reading it, and *dola 30* / *kilomita 19* quietly becoming
*30 dola* / *19 kilomita*. That is the batch-1 `percentPrefix` failure repeating on a wider surface. Both
scripts now read the field list out of `SymbolData` itself, and the TS interface is emitted as
`Required<Pick<SymbolData, …>>` rather than a hand-typed shape — a hand-typed one would also have made
`cubed` required (Yoruba declares no cube word) and `position` a bare string (Amharic splits it per power).

**⚠ THE LITERAL-VALUE GUARD FAILED ON SINGLE-LINE OBJECTS.** `_is_literal` stripped quoted strings and then
looked for a surviving identifier — but an object's own BARE KEYS survive that strip, so
`currency: { $: [...] }` and `units: { km: [...] }` were misfiled as code. Multi-line tables had been passing
only by accident: the check read the key's line alone, which for them is just `{`. The guard now takes the
value to its matching bracket and strips comments, strings, and object keys before looking.

**⚠ A KEPT KEY MUST BE KEPT WHOLE (C#).** The depth-tracking filter kept only the LINE a top-level key sits
on, so Yoruba's `ExponentWords = new ExponentWordsDef` — which stays in code because it reads a different
manifest table — lost its initializer body and the file stopped compiling. Balance alone is not the end of an
entry either: that line is already balanced. The entry ends at its trailing comma.

**⚠ YORUBA'S TIER `percent`/`percentPrefix` WERE DEAD, AND THE SABOTAGE SWEEP IS WHAT PROVED IT.** Wrecking
`percentPrefix` moved zero readings. Yoruba's percent is a CIRCUMFIX (`ìdá 84 nínú ọgọ́rùn-ún`) and
`percentPrefix` can only move ONE word to the front, so `normalize.ts` rule 3 consumes every `%` before the
tier ever runs. Both were REMOVED, on both sides, rather than left as documentation: a tier field read by
nothing is a false statement about where the language's percent word comes from. Second genuinely dead key
the sweep has found, after Italian's `ordinals`.

**Four other zeros were probe gaps, not dead keys** — qu `magnitudes` (needs a currency sign to hop with, and
the probe spelled the magnitude in text), tg `unitPer`/`rateDenominators` (the probe wrote `дар соат` in
words rather than `км/соат`), tg `magnitudes`. Extended the probes; all four moved. Every key in all seven
languages is now proven live.

**Coupling tests: `unitPer` was live and untested.** Unwiring it in the code broke nothing, because nothing
in the test file read a rate. The sabotage sweep and the coupling test answer different questions — one asks
whether the data is reachable, the other whether a refactor can drop it in silence — and a key can pass the
first while failing the second. Added a rate assertion for the four languages that declare one (jv, sw, tg,
yo); each verified by unwiring the code, not the data.

Amharic and Swahili gained a `manifest.ts` so the tests can read the tables without importing the engine.

## Remaining

**None in the ported set.** Re-grepped all 60 C#-ported languages for a `makeSymbolNormalizer({...})` holding
any literal top-level value: zero hits. This is the check that caught the premature "complete" claim in the
letterNames sweep, and it is the claim being made here — not a running tally.

Roughly 90 UNPORTED languages still declare their tier inline (hiligaynon, sinhala, estonian, finnish, czech,
… ). That is deliberate and out of scope: the sweep exists so the C# port and the TypeScript cannot drift on
hand-authored data, and a language with no C# side has nothing to drift from. Those lift when they port.
