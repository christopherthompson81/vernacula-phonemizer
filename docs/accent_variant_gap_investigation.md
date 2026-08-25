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

## Run 6 — 2026-08-25 01:40 — pt-BR, and the classification that was right about shape and wrong about cost

**Question.** Run 2 filed pt-BR as "engine MODE", the shape a `variantOf` key could not reach. Does that make
it expensive?

**Finding (raw).** No. The C# Portuguese engine already carried `dialect: "bp"` through `ToSegments`,
`Sibilants` and `Realize`, and `CreatePortuguese(string dialect = "ep", Func<string,string,string>? postWord)`
already took both arguments pt-BR supplies. `data/languages/portuguese-br/pt-br-openclose.tsv` (1,369 rows)
was already in the repo. The port is one 50-line file.

**Implication, worth stating because I made the wrong inference myself:** "it is a mode, not a substitution"
is a statement about SHAPE. It says a declarative variant key cannot express it. It says nothing about cost,
and reading cost off it was an assumption. 286 C#-vs-Node probe readings matched sync and async on first
compile.

## Run 7 — 2026-08-25 01:48 — the lexicon load, which the probe would not have witnessed

**Question.** The 286 readings matched — but does the open/close lexicon actually LOAD in C#, or did the
probe simply never touch it?

**⚠ THE FAILURE MODE IS SILENT.** `LoadTsvMap(optional: true)` returns an EMPTY map when the file is missing,
and the engine then answers with the rule-only reading — plausible IPA, in the right language, with the wrong
stressed vowel. Nothing throws.

**Command.** Probe the first ten lexicon entries through both engines, then break the filename in C# and
re-probe.

**Finding (raw).** `abacote` → `abakˈɔt͡ʃi` in both; with the filename broken, all ten readings change. So the
file is read AND is load-bearing. Pinned by a test asserting `abacote` carries [ɔ] — a target the rules do
not produce — and that the rule-only path (which the referee eval scores) does NOT carry the override.

## Run 8 — two vacuous assertions I wrote and caught

The first draft of the numeral test contained `Assert.Equal(x, x)` and a tautology
(`Assert.Contains("séc", … ? "séc" : "")`). Both passed by construction. Replaced with a test that can fail:
`XII aniversário` must not read like `12 aniversário` (which is what proves the Roman policy is registered
for the variant at all), and the two varieties must agree on word COUNT while differing in every word.

## Run 9 — 2026-08-25 02:15 — fr-CA, and a docstring that was wrong

**Command.** Port fr-CA (59 lines of TS, no data files) and replay a 53-line Québécois probe.

**Finding (raw).** 106 C#-vs-Node readings identical, sync and async, on first compile. No Roman policy is
registered and that is not an omission: `fr-CA` is in `ROMAN_NATIVE`, so the shared pass is skipped and
French resolves numerals in its own normalization, with more context. C#'s `ROMAN_NATIVE` already listed it.

**⚠ A DOC/CODE MISMATCH, found by writing the test from the COMMENT rather than from the behaviour.** The TS
header claimed the lengthening codas keep the vowel tense in *both* `dire→d͡ziʁ` and `musique→myzik`. The
first is right; the second is not — both engines say **myzɪk**, and they are correct to.

The lengthening set /ʁ v z ʒ/ is about the coda **after** the vowel. In *musique* the /z/ is an ONSET
*before* the /i/, and that /i/'s actual coda is /k/, which laxes like any other. The example was simply
mis-chosen; the rule never claimed it.

Fixed as a COMMENT in the TypeScript (no behaviour change — the 106 probe readings are byte-identical before
and after), mirrored in the C# header, and the test now asserts the corrected claim rather than the
documented one.

**Implication.** PORTING.md's correctness lens — "does the docstring match the code" — pays out when the port
test is written from the prose. Had I written it from the observed output, the wrong comment would have
survived the port intact.

**Sabotage:** deregistering fails 6/6; widening the affrication class to include back /u/ fails 1; swapping
the rule ORDER (laxing before affrication, which destroys the /i/ the affrication needs) fails 1.

## Run 10 — 2026-08-25 02:40 — en-IN, and the first variant whose ASYNC path is neural

**Command.** Port en-IN (72 lines of TS, no data files) and replay a 54-line GIE probe.

**Finding (raw).** 108 C#-vs-Node readings identical, sync AND async, on first compile. ⚠ This is a stronger
check than es-419, pt-BR or fr-CA got: `en` is a NEURAL language, so the async half runs the ONNX tagger and
then the delta on its output. The other three variants have rule-only bases where sync and async agree
trivially.

**⚠ THE DELTA IS APPLIED PER WORD, unlike the other two substitution variants.** es-419 and fr-CA wrap the
assembled utterance; en-IN threads its remap through English's `Text(input, wordTransform, oovOverride)`, so
the transform sees one word's IPA at a time. Wrapping the utterance instead would expose the delta to clause
punctuation and to whatever the assembler puts between words. Ported the same way and pinned by a test.

TWO ORDERING FACTS the port had to preserve, both now sabotage-verified:
- **Retroflexion runs BEFORE TH-stopping.** Reversed, the dental stops [t̪ʰ d̪] that TH-stopping creates get
  swept into [ʈ ɖ] by the retroflexion, collapsing *thin* into *tin* — the exact distinction GIE keeps by
  PLACE. Sabotage fails 1.
- **The affricate-tie guard `(?!U+0361)`** is what keeps *church* and *judge* at t͡ʃ / d͡ʒ. Without it they
  become ʈ͡ʃ / ɖ͡ʒ, which is not GIE and not any English. Sabotage fails 1.

## Result

es-419, pt-BR, fr-CA and en-IN ported and covered by the gate. The one that remains is named on every parity run instead
of being invisible:

```
accent variants: 4/5 build — en-IN, es-419, fr-CA, pt-BR
⚠ NOT PORTED, and their base language IS: en-GB (variant of en)
```

Both tests assert the REGISTRATION rather than the phonology (the goldens cover that), and pt-BR's also
asserts the LEXICON LOAD. Verified by deregistering the factory (4/4 fail) and by breaking the lexicon
filename (1/4 fails — the one written for it).

59 languages / 11,800 rows / 0 differ; 426 C# tests, 5,057 TS tests.

**Remaining: en-GB alone** — 95 lines plus five TSV lexical sets (bath, cloth, yod, palm, lotr) and a
transform that needs the WORD, not just the IPA. The only one of the five that was ever genuinely large, and
the only one a declarative `variantOf` key could not have expressed even in principle.
