# Large-integer reading defect — the fallback that was missing across the fleet

`Number.isSafeInteger(n)` is used, correctly, to refuse composing a numeral whose low digits the float has
already lost: `9007199254740993` arrives in JS as `…992`, so a composed reading would be confidently WRONG.
The guard is right. What was missing, in engine after engine, is the `else`.

Precedent: commit `49f9a08` on main fixed the seven Sinitic engines. Digit-at-a-time fallback, not BigInt —
these engines already read a year and a decimal tail digit-at-a-time, so the fallback needs no word the
language's data was never measured on, whereas inventing a higher magnitude register would trade a silent
drop for a confidently-wrong numeral. That commit named the rest of the fleet as unfixed. This is that work.

## Run 1 — 2026-08-11 21:00

**Command:** `npx tsx probe-bignum.scratch.mts` (after repointing its two hardcoded paths at the worktree —
the probe as handed over imported the MAIN checkout's `src/registry.ts`, so it would have measured the
wrong tree for every "after" run. Negative result worth keeping: an "after" number from the unedited probe
would have been the baseline again, four runs running.)

**Question:** does the handed-over baseline reproduce in this worktree?

**Raw finding:**

```
engines probed: 193 unreadable/err: 0 graceful: 135

*** SILENT DROP (number vanishes) ***
  ko ur id ms zsm ro tl sd jv mn my

--- raw digits leak into IPA ---
  hi bn as bpy pa pnb skr mr te fa it pcm ak sw gu kn ml or uz bg tk tt nog ba kaa crh chv rkt ckb
  bal bho mag bgc hne awa mai uk be hy hyw ky nb su ne ug syl
```

11 + 44 = 55 affected, exactly as briefed. Implication: proceed; Class A (drops) is the mandate, Class B
(leaks) is triage.

**Also noted:** `grep -rn isSafeInteger src/` returns ~170 call sites, and the large majority already
degrade gracefully — `readDigits(String(n))`, `digitByDigit(digits)`, `return digits`. So the fleet already
*has* the idiom; the 55 are the ones that lack it or whose `digits` return escapes into IPA unread.

## Run 2 — 2026-08-11 21:35

**Command:** the eleven Class A engines patched, then `npx tsx probe-bignum.scratch.mts` and a scratch
reader that prints `2^53+1`, `2^53+2` and `2^53−1` per engine.

**Question:** does each dropper now read, with digits that are ACTUALLY read rather than a constant?

**Raw finding:** `*** SILENT DROP *** (none)` — 11 → 0, graceful 135 → 146. Every one passes all three
traps: no raw digits, `2^53+1` ≠ `2^53+2` (so the fallback is not emitting a placeholder), and the unsafe
reading differs from the safe one (so the normal compositor is untouched).

```
ko  kuˈjɘŋjɘŋt͡ɕʰiɾiɭɡuɡuiosɐt͡ɕʰiɭsɐjɘŋɡuɡusɐm
ur  nˈəoː sˈɪfɾ sˈɪfɾ sˈɑːt̪ ˈeːk nˈəoː …
id  səmbˈilan nˈol nˈol tˈud͡ʒuh sˈatu …      (ms/zsm identical — they wrap this engine)
ro  ˈnowə ˈzero ˈzero ˈʃapte ˈunu …
tl  sijˈam sˈeɾo sˈeɾo pitˈo ʔisˈa …
sd  nˈəwə ɓˈʊɽiː ɓˈʊɽiː sˈət̪ə hˈɪkʊ …
jv  sˈɔŋɔ nˈɔl nˈɔl pˈit̪u sˈid͡ʒi …
mn  jes tʰeɡ tʰeɡ tɔɮɔː neɡ jes …
my  ko˥˩ θo˨ʊɴɲa˥ˀ θo˨ʊɴɲa˥ˀ kʰʊ˨ɴn̥ɪʔ tɪʔ …
```

**Three findings worth keeping, none of them predictable from the shape of the bug:**

1. **`ko`'s `""` IS AN API CONTRACT, not just a missing else.** Three call sites in `korean/normalize.ts`
   test `numberToWords(…) === ""` to mean "out of range — leave the digits for the number path", including
   rule 8's `w === "" ? m : w`. Changing the function's return would have silently changed all three. The
   fallback is therefore a SEPARATE exported `spellDigits`, applied at the number path's end, which is the
   very place normalize.ts was deferring to. Same reasoning applied per engine wherever the refusal value
   was observable by another caller.
2. **`my` returned `String(n)` — ASCII — and that is why it presented as a DROP and not a leak.** The
   Burmese g2p has no rules for Latin, so the "leaked" digits were swallowed downstream. Its fallback is
   also the one place the digit reading is SPACED where the composed path is solid: the solid join is
   load-bearing for compound voicing inside a numeral (တစ်+ရာ → [təja˨]), and fusing read-out digits would
   assert a voicing boundary no speaker articulates.
3. **`jv` had to be handed the ORIGINAL digit string, not the float.** Its `emitNumber` takes a `number`;
   by then the low digits are gone, and above 1e21 `String(n)` is exponential notation (`1e+21`), which a
   digit walker reads as "121". Both call sites now pass the source spelling — and the Aksara Jawa one
   passes its own transliterated digits, so a Javanese-script numeral degrades to Javanese-script digits.

## Run 3 — 2026-08-11 22:10

**Command:** Class B triage in three sweeps (renderNumber family → local-compositor family → the two
shared Indic makers), `npx tsc --noEmit` and `npx tsx probe-bignum.scratch.mts` after each.

**Question:** how many of the 44 leakers actually have digit words to read with — i.e. how many are a
missing `else` rather than missing DATA?

**Raw finding:** 44 → 4. Leak list is now `it pcm ak sw`. Sweep by sweep:

| sweep | engines | shape found |
|---|---|---|
| 1 | pa pnb skr fa or uz tk ckb bal uk be hy hyw ky nb ug syl | `renderNumber(n, DEF.numbers, word, composer)` with `return digits` — the digit words are `DEF.numbers.units`, already authored and already read by these engines' own decimal tails. Shared `spellDigits(digits, def, word)` added to `core/numbers.ts`. |
| 2 | te kn ml bg tt nog ba kaa crh chv su | a LOCAL compositor (`numberToWords`/`numberToText`/`toWords`) rather than `renderNumber`. Fallback calls THAT compositor once per digit — a one-digit number is a call the engine already answers, so it cannot invent a word. |
| 3 | hi bgc mr gu ne bho mag hne awa mai rkt (`hindi.ts`'s `makeNativeHindi`), bn as bpy (`bengali.ts`) | 14 of the 44 were TWO functions. Both already spelled a decimal tail out of `def.numbers.units[…]` on the very next line, which is the strongest possible evidence that digit-at-a-time needs no new data here. |

**Negative result / thing not done:** no engine in these three sweeps needed a word authored. Every one had
`units[0..9]`, and I checked for the trap first — `grep '"units": \[""'` finds fourteen manifests whose
zero slot is deliberately empty (the composed path never says a zero place), and NONE of them is in the
44. `my` is the only affected language with that shape and it reads its separate `N.zero`.

**Two judgement calls recorded rather than swept:**
- `bal`/`fa` pass an `encliticWord(...)` renderer to `renderNumber`. That wrapper only fires on a connective
  marker the COMPOSER appends between groups, so a lone digit never picks one up — the wrapper is kept in
  the fallback rather than bypassed, so the digit reading goes through the identical word renderer.
- `pa`/`or`/`te`/`kn`/`ml`/`fa` spell from the ASCII TRANSLITERATION (`toAscii(digits)`), not the raw token,
  so a Gurmukhi/Odia/Dravidian/Perso-Arabic digit run degrades through the same table the composer uses.

## Run 4 — 2026-08-11 22:25

**Command:** the last four leakers (`it pcm ak sw`) patched, then `npx tsx probe-bignum.scratch.mts`,
`npx tsc --noEmit`, `npx vitest run` (full suite).

**Question:** can the last four be fixed on their own words, and does anything in the fleet MOVE when the
fallback lands?

**Raw finding:**

```
engines probed: 193 unreadable/err: 0 graceful: 192

*** SILENT DROP (number vanishes) ***
  (none)

--- raw digits leak into IPA ---
  (none)
```

`Test Files 235 passed (235) | Tests 3452 passed | 5 skipped`. `tsc --noEmit` clean.

**NO GOLDEN CHANGED, and that is the expected result rather than a lucky one:** every edit is confined to
the `else` of an `isSafeInteger` guard, and no golden corpus contains an integer above 2^53 — which is
precisely why this defect survived to be found by a probe instead of by a diff.

**`pcm` needed a judgement the other three did not.** It has TWO number arms, and the ordinal one
(`5th`) had the same leak. `ordinalWords` is itself `marker + numberWords`, so the fallback keeps the
marker and reads the digits after it — the ordinal-ness survives and only the quantity is lost. Its
cardinal arm also silently dropped a DECIMAL TAIL along with the integer when the guard fired; the fallback
now reads the whole token, separator word included, which is the convention the safe branch already uses.

**One engine the probe cannot speak for, reported and NOT touched:** `ha` (Hausa) reads `""` for
`9007199254740991` — the SAFE integer. It has no number path at all, so it drops every number, not just
large ones. That is a different defect (missing feature, not a missing `else`) and out of this commit's
scope; recording it here so it is not rediscovered by the next probe.

## Run 5 — 2026-08-11 22:32

**Command:** `npx vitest run test/bignum-fallback.test.ts` — 116 regression tests, three assertions per
language plus two fleet-wide ones, in the style of the pair 49f9a08 added to `test/sinitic-core.test.ts`.

**Question:** do the tests encode the traps, and does anything fail that I have not understood?

**Raw finding:** one failure, and it was a real question rather than a broken test —

```
these engines read an unsafe integer identically and are not declared aliases: pa pnb skr
```

`pa`/`pnb` are the same engine by registry design, but `skr` is the NON-tonal Lahnda sibling and should not
be assumed identical. Checked instead of waved through: `ਘਰ` reads `kˈə˨˩ɾ` in pa/pnb and `ɡʱˈəɾ` in skr, so
the engines DO differ — but none of the ten digit words carries a voiced aspirate, so tonogenesis has
nothing to fire on and the digit strings coincide. `1234` also matches across all three on the COMPOSED
path, so this is a property of the shared number data and not something the fallback introduced. Declared
as a shared group with that evidence in the test, rather than the assertion being loosened.

**Implication:** done. 55 → 0 on both classes, and the "reads a CONSTANT" trap is covered — the pre-fix
behaviour of eleven of these engines was a constant (`""`), and an emptiness assertion alone would have
passed on a fallback that emitted one.

## Run 6 — 2026-08-11 22:45

**Command:** `npx vitest run` ×4 (full suite, back to back).

**Question:** the first full run AFTER adding the regression file reported `Test Files 1 failed | 235
passed (236)` / `Tests 1 failed | 3567 passed`, with no test name captured. Real regression or flake?

**Raw finding:** NOT REPRODUCIBLE. Three consecutive re-runs are green — `3568 passed | 5 skipped`, files
`236 passed (236)` — and the failing run is the one that took 119s against 52s for each clean run, with
`collect` at 1072s of CPU against ~450s. A timeout under load contention, not a behaviour change.

**Kept as a negative result rather than deleted**, because the honest state is "seen once, name unknown,
green four times since" and not "always green". If it recurs, the run duration is the thing to look at
first: same test totals (3573), so it is one test timing out and not one assertion changing its answer.
