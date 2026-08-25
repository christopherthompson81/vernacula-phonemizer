# The accent-variant gap in the C# port

## Run 1 — 2026-08-24 23:05

**Question.** `es-419` threw `port pending: spanish-419` during the Spanish lift. Is that one missing
language, or a category?

**Command.** Compare the TypeScript registry's `build` switch against the C# `Registry.Build` switch and the
set of factories any `RegisterSelf` actually registers.

**Finding (raw).** A category, and the routing was already there:

| code | C# `Build` case | factory registered |
|---|---|---|
| en-GB | ✅ `Create("english-gb")` | ❌ |
| en-IN | ✅ `Create("english-in")` | ❌ |
| es-419 | ✅ `Create("spanish-419")` | ❌ |
| fr-CA | ✅ `Create("french-ca")` | ❌ |
| pt-BR | ✅ `Create("portuguese-br")` | ❌ |

**⚠ AND THE PARITY GATE CANNOT SEE ANY OF IT.** The runner iterates `csharp/goldens/*.tsv`. No accent
variant has a golden, so no variant is ever requested, so none appears — the gate printed "55 languages
byte-identical" and said nothing about five codes the TypeScript supports and C# cannot build. The
`PortPending` reporting that does exist is narrower still: it names a key only when a GOLDEN-BEARING
language reached for it through the script router.

The failure is worse than an ordinary unported language because **the base language shows green**. A reader
sees `es OK 200 rows` and concludes the locale works.

## Run 2 — 2026-08-24 23:12

**Question.** Is a declarative `variantOf` mechanism the right fix?

**Finding (raw).** No — the five look like one category and are three:

| shape | variants | signature |
|---|---|---|
| IPA-only substitution | es-419, fr-CA, en-IN | `to<X>(ipa) → ipa` |
| substitution + word-level lexicon | en-GB | `toRP(genAm, word, lex)` + 5 TSV lexical sets |
| engine MODE | pt-BR | `createPortuguese("bp", openClose)` — EP→BP vowel reduction is not recoverable from EP output |

A `variantOf` key would cover three cleanly, strain on en-GB (which needs the word, not just the IPA), and
not reach pt-BR at all. That is the German `PREFIX_GUESS` shape in another key — a name that suggests one
list where there are really several. `PORTING.md`'s "one TS module = one C# file" already gives the right
answer, and the five TS modules are 44–95 lines each.

**Implication.** Port them as five small classes, not one abstraction. Start with the cheapest.

## Run 3 — 2026-08-24 23:20

**Command.** Port es-419 (44 lines of TS → one C# file, no data files) and replay this session's Spanish
probe.

**Finding (raw).** 324 C#-vs-Node readings identical, sync and async, **on first compile**, 0 threw. The
engine work was genuinely nil; the whole defect was a missing `RegisterSelf`.

## Run 4 — 2026-08-24 23:26

**Question.** A golden, so the gate covers it rather than a probe I ran once?

**Finding (raw).** `tools/gen_parity_goldens.mts` is referenced in the parity header but is NOT in the repo,
and the es_419 FLEURS split is not on this machine. Generated `csharp/goldens/es-419.tsv` from the **es
golden's own source text** through `phonemizeAsync` (goldens are async-mode output).

⚠ STATED PLAINLY: that pins C#↔TS parity for the variant, which is what a golden is for here. It is NOT a
claim of es_419 corpus coverage — the text is the es corpus. 184 of 200 rows differ from the es golden, and
folding θ→s / ʎ→ʝ over the es golden reproduces the es-419 one exactly, which is the expected relation.

Gate now reads **56 languages, 11,200 rows**.

## Run 5 — 2026-08-24 23:35

**Command.** Add an accent-variant census to the parity runner: name the five, build each, report.

```
accent variants: 1/5 build — es-419
⚠ NOT PORTED, and their base language IS: en-GB (variant of en), en-IN (variant of en),
  fr-CA (variant of fr), pt-BR (variant of pt)
```

An explicit five-entry list, the same call `Languages/Bootstrap.cs` makes and for the same stated reason:
"which variants exist?" stays one grep. A variant that later gains a golden is checked by the main loop as
well; the census only answers "does it exist at all".

## Result

es-419 ported and covered by the gate. The remaining four are named on every parity run instead of being
invisible. The C# test asserts the REGISTRATION, not just the substitution — verified by deregistering the
factory, which fails all four assertions.

56 languages / 11,200 rows / 0 differ; 396 C# tests, 5,049 TS tests.
