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

## Remaining

22 languages with an inline symbol tier: amharic, arabic, asturian, bengali, cantonese, cebuano, french,
german, greek, gujarati, hungarian, indonesian, japanese, javanese, kannada, korean, malayalam, mandarin,
marathi, occitan, odia, polish, punjabi, quechua, russian, swahili, tajik, tamil, telugu, thai, umbundu,
urdu, vietnamese.
