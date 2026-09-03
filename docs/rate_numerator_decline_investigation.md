# The rate decline throws away the numerator (#1249)

`#1093` → `#1098` made an unreadable rate DECLINE rather than half-read, on the stated trade that "a half
reading is worse than a visible leak". `#1249` reported that in 45 languages the decline produces no visible
leak at all — the stranded `km` and `h` route to the English foreign reader and come back as letter names.
This log is the measurement that settled which way the trade actually runs.

## Run 1 — 2026-09-03 15:50 — does the report reproduce?

```
npx tsx repro.mts        # phonemizeAsync("160 km/h", …) and ("160 km", …) for am ka vi ja et ab
```

Question: is the reported failure the decline, or a data gap?

```
am  160 km/h -> məto sɨlsa ˈʊkm ˈeᶦt͡ʃ          am  160 km -> məto sɨlsa kilo metɨɾ
ka  160 km/h -> as samɔt͡sʰi kʼilɔmɛtʼɾi ˈeᶦt͡ʃ  ka  160 km -> as samɔt͡sʰi kʼilɔmɛtʼɾi
vi  160 km/h -> … ˈʊkm zˈəː˨˩                  vi  160 km -> … kˈi˧ lˈo˧ mˈɛ˧˥t̪
et  160 km/h -> sˈɑdɑ kˈuːskymːend km h        et  160 km -> sˈɑdɑ kˈuːskymːend kˈilomeːtrit
ja  12.8 km/秒 -> … kiɾo̞me̞ꜜːto̞ɾɯᵝ bʲo̞ꜜː      (the #1098 counter-example, correct)
```

Reproduces exactly. `am` reads `160 km` perfectly and reads `160 km/h` as letter names, so the loss is the
decline and not a missing unit noun. `vi`'s inversion is real: the denominator IS read (*giờ*) while the
numerator is declined.

## Run 2 — 2026-09-03 15:55 — the fleet, classified

```
npx tsx fleet.mts base.json "160 km/h" "160 km" "160 m³/s" "12.8 km/秒" "120mg/100ml"   # 193 codes
node classify.mjs base.json
```

Question: how large is each population, and is "Latin-script host" a usable discriminator for
"declining leaves a visible leak"?

| outcome for `160 km/h` | count |
|---|---|
| rate read in full | 88 |
| `km` leaks as raw ASCII — the intended visible leak | 35 |
| `km`/`h` voiced as English letter names | 34 |
| still the #1093 half reading (unit noun + letter name) | 5 |
| language does not read `160 km` either — out of scope | 17 |

Matches the issue's shape (its 45/34/5 differ only in where the out-of-scope line is drawn).

**Negative result, and the important one: script is NOT the discriminator.** `hmn` and `vi` are Latin-script
and land in the letter-name bucket, because their engines route unclaimed Latin to the English reader; `ltg`
and `pcm` are Latin-script and *phonemize* the residual (`km x`, `km et͡ʃ`), so their "visible leak" is not
visible either. Whether a decline leaves something a reader can see is a property of the host ENGINE's OOV
path, which `makeSymbolNormalizer` cannot see — it holds `SymbolData`, not a language code, at 279 call
sites. So a host-keyed guard was ruled out here rather than in review.

## Run 3 — 2026-09-03 16:00 — remove the guard and diff the fleet

```
# experimental: delete (?!\s?/\s?[A-Za-z]) and (?!(?<=[a-zA-Z])[23]\s?/\s?[A-Za-z]) from unitRe
npx tsx fleet.mts noguard.json …  &&  node diff.mjs base.json noguard.json
```

Question: what does the decline actually buy?

146 readings change, and **in every one of them the residue after the slash is character-for-character
what the decline left there**:

```
et   sˈɑdɑ kˈuːskymːend km h      →  sˈɑdɑ kˈuːskymːend kˈilomeːtrit h
ltg  sɨmts sʲæʒʲdʲæsʲmʲit km x    →  sɨmts sʲæʒʲdʲæsʲmʲit kʲilɔmʲætri x
pcm  wan … siksti km et͡ʃ          →  wan … siksti kilomita et͡ʃ
am   məto sɨlsa kʰˈeᶦəm ˈeᶦt͡ʃ     →  məto sɨlsa kilo metɨɾ ˈeᶦt͡ʃ
```

**This is the finding the change rests on.** The guard never made the denominator more visible; the `h` is
exactly as present either way. It only deleted the numerator's reading. So the trade #1098 priced —
half a reading versus a visible leak — was not on offer: what it bought was a *smaller* reading of the same
leak.

Second, unlooked-for result: `160 m³/s` lost the POWER too, in 86 engines, because the guard rejected the
exponent branch and the group fell through to EMPTY — es read *m ˈal kˈuβo s* where it now reads
*mˈetɾos kˈuβikos s*. The ASCII twin is worse: `5 m2/s` read *five m two s*, the exponent claimed by the
NUMBER path and spoken.

Both #1098 counter-examples are untouched (`120mg/100ml` in every engine, `12.8 km/秒` in ja).

⚠ Correction, from Run 7: the "ga `12.8 km/秒` gained its kilometre" line first recorded here was
mis-attributed. That row moved on the BARE-unit arm, not on `unitRe` — `noguard.json` leaves it at `kmˠ` —
and it went back when the bare arm was reverted.

## Run 4 — 2026-09-03 16:05 — what the suite pinned

`npx vitest run` → 3 failures, all of them the old thesis rather than collateral:
`test/rate-half-reading.test.ts` (the #1098 pin), `test/maltese.test.ts` and `test/malagasy.test.ts` (two
per-language pins carrying explicit "if that guard ever lands, change this line" instructions from #1093).
Nothing else in 5,768 tests moved.

## Run 5 — 2026-09-03 16:15 — a better instrument, and the residual

The old test's instrument ("plain reading + a tail ≤4 chars") can only see half readings. The defect #1249
is about is the opposite shape, so the instrument was rewritten: ask whether the rate spells the SYMBOL out
— as a whitespace-delimited raw token, or as ENGLISH's reading of it (the letter names a non-Latin host
routes to) — where the plain form reads it as a word.

```
npx tsx probe3.mts   # 193 codes × 5 shapes, before and after
before: 383 code+shape pairs declining a numerator the language reads
after:  86        (no new pairs — the ledger is a strict subset)
```

**57 of the surviving 86 were one shape, `kg/m`, and a different route to the same defect.** Where the
denominator resolves to a DECLARED unit but the language has no `unitPer` word, the rate alternative matches
and the callback returns `whole` — "a rate needs both nouns and the connective; without any of them leave the
text alone rather than emit half a reading", the same trade written a second time. `et` shows the two routes
side by side: `5 kg/s` (whose `s` is not a unit key) read the kilogram, `5 kg/m` read *vˈiːs kɡ m*.

Fall through there as well — read the numerator, re-emit `whole` from the slash:

```
after the callback fix: 36 pairs, 15 codes (ak bal bm bo ee hmn ht ki lg ln lt mn mos nci ro)
```

Every survivor is an engine with a LOCAL unit table rather than a call to the shared tier — the shape a
language reaches for when its unit noun PRECEDES the number. Each hand-wrote its own trailing guard, the core
fix cannot reach them, and each is a per-file edit needing its own before/after. Recorded as
`ACCEPTED_DECLINE` in `test/rate-half-reading.test.ts`, keyed by code AND shape so it can only shrink.

## What did not get fixed, and why

- **`vi` came out fully right** — *mˈo˨˩ˀt̪ t͡ɕˈa˧m sˈa˧˥w mˈɨə˧j kˈi˧ lˈo˧ mˈɛ˧˥t̪ zˈəː˨˩*, since Vietnamese
  resolves `/h` → *giờ* in its own pass and only ever needed the tier to stop discarding the kilometre. The
  issue's headline inversion is closed.
- **`hmn` still reads letter names for both halves**, on its local unit table (below), not on the tier. A
  Latin-script host whose engine routes unclaimed Latin to the English reader is a `core/foreign.ts`
  question in any case, not a `normalizeSymbols` one.
- **The 15 local-table engines.** See above.
- **The Cyrillic ⟨/с⟩ residual (ab, ba)** is unchanged: this guard was ASCII-only and never covered it.
  `0,6км/км²` phonemized *anolʲ fba kʼm kʼm* before and *anolʲ fba kʼilometʼra kʼm* now — the same `kʼm`,
  one more word read.

## Run 6 — 2026-09-03 16:45 — review pass

Three things the sweep did not catch, found reading the diff back:

1. **The tail was not re-emitted verbatim.** `\s?` sits on BOTH sides of the slash in the pattern, so cutting
   the fall-through at `whole.indexOf("/")` swallowed the space before it: `5 kg / m` came back as
   `5 kilogram/ m`. A rule that CONSUMES text puts it back. Cut at the trailing `\s` instead —
   `Js.IsJsWhiteSpace` on the C# side, not `char.IsWhiteSpace`, since the TS cuts with `/\s$/u` and the two
   sets differ in both directions (U+FEFF, U+0085).
2. **Two doc blocks on `resolveUnitSymbol` still stated the old policy** ("every caller must then leave the
   text ALONE rather than emit half a reading"). The rule now depends on WHICH half failed: an unresolvable
   HEAD leaves the text alone (there is no reading to give), an unresolvable DENOMINATOR reads the numerator.
3. **`csharp/regex-corpus.jsonl` went stale** — the `/\s$/u` literal added in (1) is an extracted pattern.
   Re-extracted; one row added, none dropped.

And one claim that was asserted rather than checked, which is the caution #1095 exists for: "the survivors
are the engines that keep a local unit table". Verified per code — fourteen of the fifteen never call
`makeSymbolNormalizer` at all, and `nci` calls it without `units`, stating so in its own header and keeping
a hand-written rule whose lookahead spells out its own `/` on its own corpus evidence (`segundo` ×0). The
claim holds for each, not most.

Re-measured after all three: `160 km/h` 60 codes changed, `160 m³/s` 86, `12.8 km/秒` 1 — identical to Run 3,
and no reading anywhere gained a letter-name spelling it did not have.

## Run 7 — 2026-09-03 17:10 — the bare-unit arm goes back, and why the two arms now disagree

A review pass caught what Runs 1–6 did not probe: the same guard was taken off `makeBareUnitNormalizer`,
whose matches have **no numeral in front of them**, and every measurement in this log is of a *rate with a
quantity*. Probed directly:

```
mm/dd/yyyy  ->  millimetre/dd/yyyy      a date-format placeholder; `mm` is not a millimetre
mg/kg       ->  milligram/kg            a RATIO of two readable units
km/h        ->  kilometre/h             the case the widening was for
```

Both losses are real and neither is in scope of the sweep:

- `mm/dd/yyyy` is a confident error produced out of a string with no quantity in it at all. `dd/mm/yyyy`
  survives only by accident of the lookbehind, which is not a rule.
- `mg/kg` is the half reading **in its pure form** — both halves readable, this arm's own lookbehind
  forbidding the second, so it reads one and abandons the other. The counted arm does not have this failure:
  with a numeral it composes both halves through `unitPer`, or reads the numerator and strands a denominator
  that has no noun at all.

So the trailing `/` goes back on the bare arm and comes off only the counted one. **That is a deliberate
disagreement between two arms this file has previously insisted must agree,** and the reason is that they
answer different questions: the counted arm's numerator is underwritten by a numeral, and the only thing
after its slash is a denominator with no word behind it. Neither premise holds for a bare key.

Reverting also closes the two documentation findings the review raised, which were consequences of the same
widening rather than separate defects: `src/languages/haitian/normalize.ts:110`'s invariant ("`9 km/h` must
never read `9 kilomèt` with a stranded `/h`") holds again — `km/h` declines in ht, ak, bm, ln, om, nso, mos,
bal, ee — and the sentence eleven callers copy to describe the shared guards ("never beside a numeral, a
rate slash or an exponent") is true again without editing eleven files.

Re-measured after the revert: `160 km/h` 60 codes changed, `160 m³/s` 86, and the ACCEPTED_DECLINE ledger is
byte-identical at 36 pairs. The counted arm — the whole of #1249 — is untouched by giving the bare one back.
