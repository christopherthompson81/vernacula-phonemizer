# The C# suite's ten red tests — all stale expectations, no port defect

`dotnet test csharp` had ten failing test methods. This is the diagnosis.

## Run 1 — 2026-09-18

### The question, and why it is not "which C# code is wrong"

The parity gate reports **189 languages byte-identical, 36,495 rows, 0 differ**. So the two engines agree
everywhere the goldens look. Either these ten sit outside the goldens and the C# genuinely diverges, or the
C# is right and its own test expectations are stale. The discriminator is cheap: run the same input through
the TYPESCRIPT engine and see which side it lands on.

    en     "report"                   ts=ɹᵻpʰˈɔːɹt                      → C#-actual
    en-GB  "report"                   ts=ɹᵻpʰˈɔːt                       → C#-actual
    en     "Rev. 3"                   ts=ɹᵻvˈɪʒn̩ θɹˈiː                 → C#-actual
    en     "Coffee, tea, or water."   ts=kʰˈɔːfi , tʰˈiː , ɔːɹ wˈɔːt̬ɚ . → C#-actual
    en     "palled"                   ts=pʰˈɔːɫd                        → C#-actual
    nan    "Washington"               ts=wˈɔːʃɪŋtən                     → C#-actual
    en     "Monday to Friday"         ts=mˈʌndˌeᶦ tʰuː fɹˈaᶦdˌeᶦ        → C#-actual
    en     "max 40 characters"        ts=… kʰˈɛɹəktɚz                   → C#-actual
    en     "enrolment"                ts=ɪnɹˈoᶷɫmənt                    → C#-actual
    en     "a 25 µM solution"         ts=… mˈaᶦkɹoᶷmˌoᶷlɚ …             → C#-actual

⚠ **TEN OF TEN: THE C# ENGINE IS RIGHT AND THE C# TEST IS STALE.** There is no port defect here at all.
Every one of these is a DATA change — a dictionary row the TypeScript side corrected in an earlier PR,
each with a recorded reason in `g2p-curated.tsv`:

    characters   K AE1 R AH0 K T ER0 Z → K EH1 …   marry–merry merger (#1336)
    coffee       K AA1 F IY0 → K AO1 F IY0        LOT/THOUGHT alignment (#1334)
    pall         P AA1 L → P AO1 L                LOT/THOUGHT alignment (#1334)
    washington   W AA1 SH … → W AO1 SH …          LOT/THOUGHT alignment (#1334)
    report       R IY0 P AO1 R T → R IH0 …        Latinate re- reduces (gold + Moby + MW)
    monday       the weekday set unified on EY2   (#1334)
    enrolment    the unstressed en- prefix → ɪn-  (#1334)
    molar        M OW1 L AH0 R → M OW1 L ER0      AH0-R written for ɚ (this branch)

### ⚠ WHY THEY ROTTED, WHICH IS THE PART WORTH FIXING

Two holes, and they compound:

1. **`dotnet test csharp` was not in CONTRIBUTING.md's gate list.** That file did not mention C# at all —
   no `dotnet`, no `csharp`, nothing. The routine was `npm run typecheck` + `npm test`, so a contributor
   changing a dictionary row had no reason to run the C# suite and no instruction saying to.

2. **PORTING.md's bidirectional procedure has a no-op step for data-only fixes.** It reads: the fix lands
   in TypeScript with a test → the goldens are regenerated → *"the C# implements the FIXED behaviour and
   the parity gate closes over the new goldens."* For a dictionary row the C# implements NOTHING — there is
   no code change to make. Parity stays green because the goldens moved with the engine. Nothing in the
   procedure points at `csharp/Vernacula.Phonemizer.Tests`, which hardcodes IPA strings and is the only
   thing that breaks.

⚠ AND THE PARITY GATE CANNOT COVER THIS, BY CONSTRUCTION. It proves the two ENGINES agree over the golden
corpus. The C# suite's expectations are a separate, hand-written corpus that no gate compares against
anything. A stale one is invisible until someone runs the suite.

Fixed by adding `dotnet test csharp` to CONTRIBUTING.md's gate list with the reason, and a fourth step to
PORTING.md's procedure naming the data-only case explicitly.

### ⚠ ONE OF THE TEN WAS MINE, AND I HAD REPORTED THE OPPOSITE

`EnglishMicroUnitTests.TheCapitalsAreDifferentUnits` is the twin of the `µM is micromolar` test I updated
when `molar` was corrected on this branch. I updated three such twins (`thirty`) and missed this one, then
reported "back to main's baseline, no new failures".

That claim came from comparing failing-test names with

    grep -oP '(?<=    Vernacula\.Phonemizer\.Tests\.)[A-Za-z0-9_.]+(?=\()'

— and the trailing `(?=\()` requires a parameter list, so it silently dropped every `[Fact]`. Three of the
ten failures are parameterless, including mine. The comparison looked thorough and was measuring a subset.
The corrected extraction anchors on xUnit's own output prefix instead and keeps all of them.

### Not done

Each expectation was updated WITH ITS REASON rather than re-recorded, mirroring the comment its TypeScript
twin already carries — `csharp/tools/check-goldens` warns that re-recording a row is how a real defect
survives weeks of green gates (#1283), and the same applies here. Two lines that were a test's whole point
are noted as no longer being so: `report` was the "tell" in `AnOnsetRSurvivesTheReducedVowel` (a vowel that
resolved to `i`, showing the guard had not touched it) and is now `ᵻ` for an unrelated reason, so
`greedier` carries that job; the `or` coordinator test's `coffee` vowel was always incidental to it.

    dotnet test csharp: 6,687 passed, 0 failed
