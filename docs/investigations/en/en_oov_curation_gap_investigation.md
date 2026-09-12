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

## Run 7 — 2026-09-11 20:4x — the review kills the `ER`-allomorph carve-out

`/code-review high` on PR #1296 returned five findings. Two changed the code, and one of them undid a claim
made in Run 3.

**The `15:0` in Run 3 was wrong, and the carve-out it justified was wrong.** Run 3 excluded an `ER`-initial
allomorph "because both remaining exceptions are `acquire → acquirer`", implying nothing attested
resyllabifies there. The dict says otherwise:

```
enquire  IH0 N K W AY1 ER0   →  enquirer  IH0 N K W AY1 R ER0     resyllabifies
acquire  AH0 K W AY1 ER0     →  acquirer  AH0 K W AY1 ER0 ER0     does not
                                acquirers AH0 K W AY1 ER0 ER0 Z   does not
```

So the strict tally for that environment is **1 against 2 — a minority for the rule, not 15:0.** Stated
plainly because the error ran in the direction of the conclusion, which is the third time today.

The carve-out is dropped anyway, on grounds that do not depend on that tally:

1. The dict's surface shape for `-irer` is `AY1 R ER0` in `enquirer`, `inquirer` and `admirer` against
   `AY1 ER0 ER0` in `acquirer`/`acquirers` — **3:2** — and the minority spelling is a DOUBLED rhotic
   nucleus, which every unlisted word was inheriting:

```
   with the carve-out            without
   conspirer   kənspˈaᶦɚɚ        kənspˈaᶦɹɚ      ← matches enquirer/inquirer/admirer
   umpirer     ˈʌmpaᶦɚɚ          ˈʌmpaᶦɹɚ
   conspirers  kənspˈaᶦɚɚz       kənspˈaᶦɹɚz
```

2. `acquirer`/`acquirers` are **in the dict**, so the OOV path never reaches them. The carve-out protected
   two rows the dict already protects, and charged the open class for it.

**The cost, measured and not rounded off:** dropping it moves 3 dict rows — `enquirer` right,
`acquirer`/`acquirers` wrong — a held-out net of **−1**, on words production always answers from the dict.
No corpus row covers `-irer` (0 utterances for `-quirer`/`-mirer`/`-pirer`), so this rests on the dict alone
and is the clause to re-open if a recording ever lands.

## Run 8 — 2026-09-11 20:5x — three instruments that were not measuring what they claimed

The other three findings were all of one kind: a check that could not fail.

- **The negative control was inert.** `expect(phonemize("watering", "en")).toBe(…)` was the only guard
  against broadening the rule to "any `ER` before a vowel" — and `watering` is in BOTH the lexicon and the
  dict, so `knownWord` answers it and the morph join is never reached. It passed identically with the
  `-ire` condition deleted. Replaced with `rechartering`, `decluttering`, `unencumbering`, which are in
  neither file and do exercise the join.
- **The tool's own `morphDecode` was not moved with the rule.** `en_g2p_ngram.ts` kept
  `return [...sp, ...allo(sp)]`, so its `--morph` word accuracy — quoted as the engine's — was scoring a
  join the engine no longer uses. That makes Run 4's "identical before and after" unfalsifiable rather than
  reassuring: computed through that `morphDecode`, the number could not have moved whatever the rule did.
  Now shares the join and the manifest's vowel set.
- **A bare `--emit` writes to the wrong directory entirely.** `dir` defaults to
  `<cwd>/src/languages/english` — the pre-908fface location — so it never touches
  `data/languages/english/`; it deposits a ~3MB model and a dict where the engine never reads them and the
  package fence would ship them. The Run 5 warning said `--emit` "OVERWRITES g2p-dict.tsv", which pointed
  the next reader away from the real hazard. Corrected, and the stale default named. Same class as
  `en_baseline.mts`; neither path is fixed here.

And one waiver had the wrong reason: `was` is **not** a pure-n-gram row. It decodes through `morphDecode`
on the two-letter dict stem `wa` (`W AA1`) plus an `-s` allomorph, so a stem-side edit or a floor on stem
length would close it — no retraining needed. Run 1's own table prints `was … M`; the waiver comment
contradicted it and would have sent the next maintainer at the expensive fix for the cheap problem. Left
open deliberately (raising the minimum stem length reaches far past this word), but now for its real reason.
