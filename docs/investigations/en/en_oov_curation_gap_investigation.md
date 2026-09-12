# en: curated `g2p-dict.tsv` edits never reach the OOV path — how big is it, and what is actually broken?

Issue #1295, filed out of the #1294 review. `data/languages/english/g2p-model.json` is trained on upstream
CMUdict and `--emit` regenerates `g2p-dict.tsv` **from CMUdict**, so re-emitting would revert the curation
rather than propagate it. The issue's own first step: *size it before choosing a fix.*

## Run 1 — 2026-09-11 19:2x — the curated set is 20 words, and only 5 splits are live

The initial import (908fface) is byte-for-byte what `--emit` produces (verified #1260), so it stands in for
upstream:

```
git show 908fface:data/languages/english/g2p-dict.tsv > upstream.tsv
diff upstream.tsv data/languages/english/g2p-dict.tsv
```

22 edits across 7 commits, **20 distinct words** (`requiring` was edited twice — #1279 for the prefix, #1289
for the rime). For each, hold it out of the dict and ask the OOV path what it predicts:

```
                                                        source   verdict
associative   AH0 S OW1 S IY0 EY2 T IH0 V                  N      OTHER
backfiring    B AE1 K F AY2 R IH0 NG                       M      CURATED
beyond        B EY1 OW0 N D                                N      OTHER
collaborative K AH0 L AE1 B ER0 EY2 T IH0 V                N      UPSTREAM
cooperative   K OW0 AA1 P ER0 AH0 T IH0 V                  N      CURATED
deliberative  D IH0 L IH1 B ER0 AH0 T IH0 V                N      CURATED
inquiring     IH2 N K W AY1 R IH0 NG                       M      CURATED
required      R IH0 K W AY1 ER0 D                          M      CURATED
requires      R IH0 K W AY1 ER0 Z                          M      CURATED
requiring     R IH0 K W AY1 ER0 IH0 NG                     M      OTHER
research      R IY0 S ER1 CH                               N      UPSTREAM
rewiring      R IY0 W AY1 ER0 IH0 NG                       M      UPSTREAM
transpiring   T R AE0 N S P AY1 ER0 IH0 NG                 M      UPSTREAM
was           W AA1 Z                                      M      UPSTREAM
…
UPSTREAM 5    CURATED 6    OTHER 9
```

⚠ **The headline framing in the issue was too pessimistic.** Only **5 of 20** rows have a live split where
the OOV path actively predicts the pre-curation shape. 6 already agree, and 9 predict something that is
neither — ordinary OOV error, which is a g2p-accuracy question, not a curation-propagation one.

⚠ **AND CURATION DOES PROPAGATE — through morphology.** Every `CURATED` verdict on a morph row
(`backfiring`, `inquiring`, `required`, `requires`) got there because `morphDecode` looks its stem up in the
**shipped** dict, not in the model. The model is stale; the morph path reading it is not. That halves the
problem and changes which fix is worth building.

## Run 2 — 2026-09-11 19:3x — the morph path has its own defect, and it is the #1289 rule

`requiring` is marked OTHER above, and the reason matters: the OOV path returns
`R IH0 K W AY1 ER0 IH0 NG` — #1279's curated `IH0` prefix came through, and #1289's `ER0 → R` rime did not.
`morphDecode` ends in

```ts
return [...sp, ...allo(sp)];     // src/languages/english/englishG2p.ts:286
```

a bare concatenation, with no resyllabification at the join. So it reproduces the exact defect #1289 fixed,
on an OPEN class rather than 20 rows:

```
misfiring   M  M IH0 S F AY1 ER0 IH0 NG   ⚠      misfires   M  M IH0 S F AY1 ER0 Z     ✓
umpiring    M  AH1 M P AY2 ER0 IH0 NG     ⚠      refires    N  R IH0 F AY1 ER0 Z       ✓
attiring    M  AH0 T AY1 ER0 IH0 NG       ⚠      acquiries  N  AH0 K W AY1 ER0 IY0 Z   ⚠
```

The stems are CORRECT — `misfire M IH0 S F AY1 ER0` is a real word-final `/ɚ/`. Only the join is wrong, and
only before a vowel-initial allomorph: `misfires` (`Z`) is right, `misfiring` (`IH0 NG`) is not. That is
#1289's environment rule exactly.

## Run 3 — 2026-09-11 19:4x — deriving the condition from the dict's own attested pairs

The naive rule "`ER` before a vowel → `R`" is **wrong**: `water` + `ing` → `W AO1 T ER0 IH0 NG` is correct.
So rather than reason about it, tabulate every attested stem/derivative pair in the dict where the stem ends
in `ER` and the suffix begins with a vowel:

```
prev phone    keep ER    → R
C                 429        5        consonant before ER — effectively categorical
AY                  5       15
AW                 13        0
OW                  2        0
UW / EY              2        0
```

Conditioning on the preceding VOWEL gets `AY` at only 15:5. Conditioning on the stem's **spelling** is far
cleaner:

```
                  keep ER    → R
stem ends -ire          2       15
other stem            449        5
```

And both exception sets are fully accounted for:

- **`-ire` keeps ER (2):** `acquire → acquirer/acquirers  AH0 K W AY1 ER0 ER0` — the suffix allomorph is
  ITSELF `ER0`. Excluding an `ER`-initial allomorph makes the rule **15:0**.
- **other stems → R (5):** `recover → recovery R IH0 K AH1 V R IY0` and `rediscover → rediscovery` are
  **syncope** (the `ER0` deletes outright), a different process; `alfre`/`petre`/`petr` are spurious stem
  matches on name fragments.

⚠ **The five `AY`-but-not-`-ire` rows are the ones #1289 already adjudicated** — `friar → friary`,
`prior → priory` (the `-ary` nouns whose `ɚ` is a real nucleus, documented as correct) and
`spier → spiering` (the surname deliberately excluded). The spelling condition reproduces those decisions
for free instead of overriding them, which is the strongest evidence it is cut at the right joint.

**Rule adopted:** at the morph join, when the stem is spelled `-ire` and the allomorph begins with a vowel
that is not itself `ER`, rewrite the stem-final `ER*` to `R`. 15 attested supports, 0 counterexamples.

## Run 4 — 2026-09-11 19:5x — the rule, applied at the join, and what it moves

`morphDecode`'s `return [...sp, ...allo(sp)]` became `joinMorph(stem, sp, allo(sp))`, which rewrites a
stem-final `ER*` to `R` when the stem is spelled `-ire` and the allomorph starts with a vowel other than
`ER`. Scored by dumping the OOV decode of every dict word containing `ir`/`yr` (2,263 words), held out one
at a time, before and against after:

```
9 words changed, 9 now CORRECT against their dictionary entry, 0 regressions

acquiring    AH0 K W AY1 ER0 IH0 NG    →  AH0 K W AY1 R IH0 NG     ✓
conspiring   K AH0 N S P AY1 ER0 IH0 NG →  K AH0 N S P AY1 R IH0 NG ✓
hiring · hirings · requiring · rewiring · tiring · transpiring · wiring   ✓
```

and on the open class that motivated it — none of these is in the dict or the lexicon:

```
misfiring   M IH0 S F AY1 ER0 IH0 NG  →  M IH0 S F AY1 R IH0 NG
umpiring    AH1 M P AY2 ER0 IH0 NG    →  AH1 M P AY2 R IH0 NG
attiring    AH0 T AY1 ER0 IH0 NG      →  AH0 T AY1 R IH0 NG
misfires    M IH0 S F AY1 ER0 Z       →  (unchanged — /z/ is a consonant)
watering    W AO1 T ER0 IH0 NG        →  (unchanged — consonant stem)
```

⚠ **The held-out score is the wrong instrument here and says so plainly:** 5802/11748 (49.39%) before and
after, identical, because the rule touches no held-out word at all. Quoting it as "no regression" would be
quoting a measurement that never looked. The 9-word dict-wide diff above is the one that has resolution.

⚠ **`en_baseline.mts` IS BROKEN and has been since 908fface** — it reads `src/languages/english/g2p-dict.tsv`,
but the data moved to `data/` in that commit. It exits ENOENT. The held-out figure above was recomputed with
the same method against the right path. Not fixed here; noted so the next person does not trust it.

## Run 5 — 2026-09-11 20:0x — what is left, and gating it instead of retraining

Re-running the Run 1 probe after the join fix:

```
            UPSTREAM   CURATED   OTHER
before             5         6       9
after              3         9       8
```

`rewiring` and `transpiring` moved to CURATED, and `requiring` out of OTHER. The three that remain —
`collaborative`, `research`, `was` — are all reached by the **pure n-gram**, with no dict stem to inherit
from, so nothing short of the issue's option 1 (overlay) or 2 (retrain) would close them.

Neither is worth it for three words, and option 2 is actively destructive (it reverts the curation). So:
**option 3, made concrete.**

- `data/languages/english/g2p-curated.tsv` — the 20 hand corrections written down as
  `word · upstream · curated · issue`. Until now the curated layer existed only as a diff against a commit
  from months ago; this is the record that makes an accidental `--emit` recoverable instead of silent.
- `test/en-curation-gap.test.ts` — asserts (a) every curated row is still applied in the shipped dict, which
  is the first thing an `--emit` would break, and (b) no curated row falls back to the upstream shape on the
  OOV path beyond three named gaps, each carrying its reason. The waiver list is checked in BOTH directions:
  a gap that closes must be deleted, so the list cannot rot into a blanket exemption.

⚠ **What this does NOT do:** it does not make the model agree with the dict. It converts a silent,
unmeasured divergence into a list of three reviewed words — which is what the issue asked for as the first
step, and is where the evidence says to stop. Re-opening is justified when the curated set grows enough
that three becomes a dozen, or when an overlay is wanted for another reason; #1295 records both options and
the sizing they would start from.

## Run 6 — 2026-09-11 20:1x — the C# mirror, checked rather than assumed

`csharp/PORTING.md` makes the port's agreement the definition of done, and the join rule is engine code, so
it was mirrored into `csharp/…/English/EnglishG2p.cs` as `JoinMorph`. Verified by running the C# engine on
the probe words directly, not by inferring it from a green build:

```
                 C#                TS
misfiring    mɪsfˈaᶦɹɪŋ        mɪsfˈaᶦɹɪŋ     ✓ rule fires
umpiring     ˈʌmpaᶦɹɪŋ         ˈʌmpaᶦɹɪŋ      ✓
attiring     ətʰˈaᶦɹɪŋ         ətʰˈaᶦɹɪŋ      ✓
misfires     mɪsfˈaᶦɚz         mɪsfˈaᶦɚz      ✓ negative — /z/ is a consonant
watering     wˈɔːt̬ɚɪŋ          wˈɔːt̬ɚɪŋ       ✓ negative — consonant stem
spiering     spˈaᶦɚɪŋ          spˈaᶦɚɪŋ       ✓ negative — #1289's deliberate non-member
```

Byte-identical on all eight, negatives included. `dotnet test` 6,504 pass; `parity -- en en-GB en-IN` is
600/600 byte-identical; `check:goldens` is 0 stale, since none of the nine affected dict words appears in a
golden row — the same blind spot #1289 recorded for this class, and the reason the dict-wide diff in Run 4
had to be built by hand.
