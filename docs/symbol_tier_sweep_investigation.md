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

## Remaining

33 languages with an inline symbol tier: amharic, arabic, asturian, bengali, cantonese, cebuano, french,
german, greek, gujarati, hungarian, indonesian, japanese, javanese, kannada, korean, malayalam, mandarin,
marathi, occitan, odia, polish, punjabi, quechua, russian, swahili, tajik, tamil, telugu, thai, umbundu,
urdu, vietnamese.
