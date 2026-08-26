# Porting Nigerian Pidgin (`pcm`) to C#, and what the off-golden probes found

`pcm` is the first port whose parity golden is MINED text rather than FLEURS — `csharp/goldens/pcm.tsv`
was generated from `tools/corpus/mined/pcm.jsonc`, which has no corpus-wide transcript behind it. So
`PORTING.md`'s widening (1), "run every FLEURS utterance through both engines", **does not exist for this
language**, and widening (2) — hand-built probes — had to carry the whole weight. This log is what those
probes covered and what they turned up.

## Run 1 — 2026-08-25 22:15 · first parity, before any probing

**Command.** `dotnet run --project csharp/tools/parity -- pcm`

**Finding.** 200/200 byte-identical on the first build. Full gate: 79 languages, 15,800 rows, 0 differ.

**Implication.** Exactly the situation `PORTING.md` warns about — the gate proves the engines AGREE and
says nothing about whether either is right, and a 200-row golden of Wikipedia paragraphs under-covers a
rule-dense normalizer. Everything below is off-golden.

## Run 2 — 2026-08-25 22:25 · the off-golden differential

**Command.** A scratch C# console referencing `csharp/Vernacula.Phonemizer` and a Node `.mts` fed the same
probe file, both emitting `text \t sync \t async` and diffed. Four probe sets:

| set | lines | what it reaches |
|---|---|---|
| mined + attest leftovers | 443 | every `sample`/`hard` row plus the attest words — the ~243 the golden did not consume |
| adversarial, hand-built | 164 | one line per arm of `normalize.ts` and of `TOKEN`, plus the neighbour each arm must decline |
| English dictionary words | 22,000 | every fifth headword of `g2p-dict.tsv`; **all 22,000 are `knownWord` hits**, so this is 22,000 passes through `nativise()` |
| synthetic g2p + numerals | 10,270 | every digraph × vowel, geminates, soft-⟨c⟩, out-of-inventory letters, an emoji, decomposed marks; random numerals, times, ordinals, currency/unit/percent shapes |

**32,877 lines, sync and async, 1 divergence** — a Sylheti-script row in the mined artifact that the script
router hands to the `sylheti` engine, which is not ported. `Registry.PortPending` reports `sylheti`, so it
reads as blocked, not wrong.

⚠ **AMENDED BY RUN 6.** "1 divergence" was true of these four sets and NOT true of the language: none of
them contained an `Object.prototype` key, and `constructor` is a real second divergence they could not
reach. The 22,000-word English slice is drawn from dict headwords, where `constructor`/`valueOf`/
`hasOwnProperty` do not appear, and no hand-built line thought to include one. A probe set is only ever
evidence about what is in it.

**⚠ What the haystack did NOT contain.** No FLEURS, and no corpus-wide differential is possible. Also: the
22,000-word English set is 100% dict hits, so it exercises `nativise()` exhaustively and the rule `scan()`
barely at all — the synthetic set and the mined rows are what cover `scan()`. And nothing here measures
pcm against an independent referee; there is none (no wikipron/epitran/kaikki pcm), so "agrees with Node"
is the only claim the differential makes.

## Run 3 — 2026-08-25 22:30 · DEFECT: the above-2^53 ordinal fallback was a dangling `else`

**Command.** From run 2's diff — the only content divergence in the whole set:

    9007199254740993rd item
      node  aitam
      C#    nɔmba nain ziɾo ziɾo sɛvin wan nain nain tu faiv fo sɛvin fo ziɾo nain nain tɾi aitam

**Raw finding.** The C# was right and the TypeScript was wrong, which is the reverse of the usual case, and
it took instrumenting `naija.ts` to see why. The branch was written brace-free:

```ts
if (Number.isSafeInteger(n))
    for (const wd of ordinalWords(n).split(" ")) if (wd) sink.emit(wd);
else { sink.emit(ORD.marker); … }
```

The `else` binds to the INNER `if (wd)`, not to the safety test. Above 2^53 the whole `for` is skipped and
nothing runs — the numeral is deleted from the reading outright. The comment directly above it says the
branch exists precisely so that "the ORDINAL fallback keeps the marker and reads the digits after it",
because "emitting the token is not a reading". It had never once run. The safe path was unaffected:
`ordinalWords` cannot yield an empty word, so `if (wd)` is always true there and the mis-bound `else`
never fired.

**Implication.** Docstring-vs-code, question 1 of `PORTING.md`'s three, and invisible to every gate: the
golden carries no numeral this large, and the C# reproduced the INTENDED behaviour (braces are mandatory in
the port's dialect), so the two engines disagreed only outside the golden. Fixed in TypeScript first with a
test pinning both the fallback and the unchanged safe path; **0 golden rows moved**; the C# already
implemented the fixed behaviour.

## Run 4 — 2026-08-25 22:38 · DEFECT: ⟨Thousand⟩ missing from the magnitude list

**Command.** Reading the symbol tier against the corpus it cites:

    grep -o -E '[$₦][\d.,]+\s*[Tt]housand' tools/corpus/mined/pcm.jsonc   →   $500 Thousand

**Raw finding.** `US$500 Thousand` read *faiv hɔndɛd dola tauzand* — "five hundred dollar thousand". This is
the exact stranded-magnitude shape the `magnitudes` comment documents for `₦200 Million`, one scale down,
and the instance is in the SAME corpus sentence as the `US$2 Million` that motivated the existing entry
(*"gif am moni wey pass 200 Million (US$2 Million). E giv 50 Million Naira (US$500 Thousand)"*).

**Sourcing.** No new word: ⟨Thousand⟩ is already in the corpus text and already nativises through the
English dict; declaring it only makes the tier HOP it. Counts: `Thousand` ×1, `thousand` ×0, `Million` ×6 /
`million` ×19, `Billion` ×2 / `billion` ×11. Both cases declared, because the alternation is
case-SENSITIVE and the two spellings are one word — the existing entry already declares both cases for the
other two scales. Fixed in TypeScript with a test; **0 golden rows moved**; mirrored into C#.

## Run 5 — 2026-08-25 22:40 · the corpus quote in `normalize.ts` was mis-cased

**Finding.** The ⟨bn⟩ docstring quotes its motivating instance as `N195.3BN … N150 BILLION`. The artifact
actually writes `N195.3bn … N150 billion`, lowercase in both halves. The pattern is deliberately
case-sensitive, so the mis-cased quote made it look as though the rule fails on the very instance it cites.
Prose only; re-cased in `normalize.ts` and in the test comment that copied it.

## Run 6 — 2026-08-25 23:00 · DEFECT: the lexicon lookup walked `Object.prototype`

**Command.** Self-review of the PR, then:

    phonemize("Constructor dey come", "pcm")
      →  function Object() { [native code] } dɛ kɔm

**Raw finding.** `DEF.lexicon` is a `JSON.parse` object, so `DEF.lexicon["constructor"]` resolves the
INHERITED `Object` constructor — a function, therefore `!== undefined`, therefore returned as the word's
reading and template-concatenated into the clause. `phonemize("constructor", "pcm")` returns the function
itself, not a string. This is JS source injected into the phoneme stream, not a wrong reading, and
⟨constructor⟩ is ordinary vocabulary in this corpus's construction and road-contract copy.

The C# has read it correctly all along — `Dictionary.TryGetValue` has no prototype chain — so **the two
engines disagreed on an ordinary English word and the gate could not see it**, which is the same shape as
run 3 with the sides swapped.

**Reachability, measured.** `phonemizeWord` is the only reachable site. `scan()`'s `c in DEF.consonants`
and `spellOut`'s `LETTER[c]` take single code points, and no prototype key is one character; the initialism
gate's lookup is restricted by `isInitialism` to vowel-less 2-6 letter runs. The gate was hardened anyway,
so that widening `isInitialism` cannot reintroduce the class.

Fixed with `Object.hasOwn` in the TypeScript, with a test. **0 golden rows moved.** Nineteen prototype-key
lines were added to the probe set and the differential re-run: still one divergence, still `sylheti`.

**⚠ NOT PCM-ONLY, AND NOT FIXED HERE.** Probing 54 codes for the same shape:

    pcm  constructor → function Object() { [native code] }
    nl   constructor → function Object() { [native code] }
    cy   constructor → function Object() { [native code] }
    sv   constructor → function Object() { [native code] }

`nl` is already ported, so that pair is diverged in `main` today. The root cause is shared —
`core/loadManifest.ts` hands every engine a prototype-bearing object — and the general fix (a
null-prototype or `Map` manifest) touches every language at once. That is a fleet-wide decision and a
separate change; recorded here with the reproduction rather than attempted inside a port PR.

## Not fixed, recorded

- **Caret exponents drop the exponent, fleet-wide.** `10^6` reads *ten* in pcm. The registry pre-pass folds
  `^6` to a real superscript ⁶ and no engine without `bareExponent`/`exponentWords` reads it. Measured the
  same on `ha` (*ɡˈo˥ma˩*), `yo`, `sw`, `id` — a shared-core gap, not a pcm one, and a fleet-wide decision.
- **`°C` is still dropped**, already recorded in `normalize.ts` and unchanged here — no degree word sourced.
- **`kg`, `ft`, `nm` still leak visibly.** Re-measured, not re-opened: `naija.ts` records the refusal and
  the ⟨fut⟩ trap (all four corpus hits are *fut-bola*, football) in full.
- **Indian-style grouping** `1,00,000` reads as three clauses. pcm's number class wants `,\d{3}`; the lakh
  grouping is not a pcm convention and no corpus instance exists.
- **The prototype-key class is fleet-wide** — `nl`, `cy`, `sv` reproduce run 6's defect, and `nl` is
  already ported, so that pair is diverged in `main` today. The root cause is `core/loadManifest.ts`
  handing every engine a prototype-bearing object; the general fix touches every language at once and is a
  fleet-wide decision, not a port PR's.
