# ja: the first PhonemizeTrace in a process returns every InputSpan null (#1408)

Reported by a downstream consumer using the trace to segment non-spacing scripts. C# only; TypeScript is
correct cold and warm.

    COLD ja tokens=3  "科学者たちが" in=NULL   "発表しました" in=NULL   "。" in=NULL
    WARM ja tokens=3  "科学者たちが" in=[0,6)  "発表しました" in=[6,12)  "。" in=[12,13)

⚠ **THE WORST SHAPE A DEFECT CAN HAVE: IT IS CORRECT THE SECOND TIME YOU LOOK.** The consumer's segmenter
falls back to whitespace when it sees no spans, so the *first* Japanese document a process opened got one
"word" per sentence and every later one got real phrases.

## Run 1 — 2026-09-22 — the poison sink names it in one run

`Provenance` has an `OnPoison` diagnostic hook. Installing it and taking a stack trace:

    POISON  tracked="科学者たちが発表しました。"  got="れい"
      Provenance.StartTrack        Provenance.cs:179
      Rewriter.Rewrite             Rewriter.cs:40
      Japanese.Normalize.ToKatakana   Normalize.cs:20
      Japanese.Normalize..cctor()     Normalize.cs:25        ← the static constructor
      Japanese.Normalize.NormalizeJapanese  Normalize.cs:111

`Normalize`'s **static constructor** builds its digit-kana table with `ToKatakana("れい")`. A static
constructor runs **lazily, on first use**, and for that class first use is inside `NormalizeJapanese` —
*inside the traced window*. So it called `StartTrack("れい")` while the tracked string was the caller's
whole sentence; the mismatch rule correctly refused it and **poisoned** the mapping, and every
`InputSpan` came back null.

⚠ **AND `Provenance`'s OWN HEADER NAMES THIS EXACT HAZARD**, from a previous instance:

> the method is also how a **static constructor builds a lookup table** … `Initialisms` runs
> `CLASS_BRACKETS.Replace(…)` inside a static initializer … Every language had its own poisoned length,
> once per process, on the first cold trace.

That instance was fixed by replacing a length check with a content check, which stopped the mapping being
*wrong*. It did not stop the clobber, so the cost simply moved from a wrong answer to a withheld one.

### The fix is one line, and the other half of the port already had it

    TypeScript  normalize.ts:40   s.replace(/[ぁ-ゖ]/gu, …)          ← plain, untracked
    C# Japanese.cs:16             HIRAGANA_RANGE.Replace(s, …)       ← plain, untracked
    C# Normalize.cs:19            Rewrite(s, HIRAGANA_RANGE, …)      ← TRACKED  ⚠

Three copies of the same helper; **one of them went through the tracked seam**, and that is the whole
defect. Its only caller is the static table, so it never touches a pipeline string and has no business in
the seam at all.

## Run 2 — the gate, and why it cannot live in the test assembly

⚠ **I TRIED TO PUT IT THERE FIRST AND VERIFIED THAT IT DOES NOT WORK.** The defect is **once per
process**, so by the time any test in the shared assembly runs, another test has already warmed `ja`.
With the fix reverted, **both** of these PASSED inside `dotnet test`:

- a poison-sink sweep over all 189 languages;
- a direct "`ja`'s first trace carries its input spans" assertion.

A cold-process assertion needs a cold process. The check is `csharp/tools/trace-cold`, and the xunit test
spawns it — the same device `test/engb-sets-shard.test.ts` uses, for the same reason.

⚠ **ONE PROCESS STILL COVERS EVERY LANGUAGE**, which is what makes it affordable: each language's static
initializers run on *its* first trace, so all 189 cost **~13s together**. Proved by reverting the fix —
the tool then names `ja` and the string `れい`, and reports `ja` under "no input spans on the cold trace"
as well.

⚠ **AND THE TRACE HAD NO GATE AT ALL BEFORE THIS.** `check-goldens` and the parity harness compare IPA
STRINGS; `InputSpan`, `IpaSpan` and token boundaries are in neither. That is why a port divergence this
visible reached a downstream consumer before anything in the repo noticed.

## Run 3 — ⚠ AND THE FULL C# SUITE HAD BEEN RED SINCE MY OWN #1402, FOR THIRTEEN MERGES

Running `dotnet test csharp` — which I had not done once in this session, only ever with a `--filter` —
found `AsyncPrewarmsAnEmbeddedLatinRunFromACOLDMemo` failing:

    Expected: "ʔab mˈændæɡ zɨbl"
    Actual:   "ʔab mˈɑːndˌæɡ zɨbl"

It fails in isolation, so it is deterministic, not an ordering flake. Bisecting: already red at
`e26d3c34` (#1400's n-gram retrain) and at `c6e26698` (#1402's BiLSTM retrain) — **both merged earlier in
this session**. TypeScript produces the identical pair, so this was never a port divergence; it was a
stale hand-written expectation, exactly the rot that file's own neighbours are made of.

⚠ **AND THE RULE ALREADY EXISTED.** `CONTRIBUTING.md` says, in bold:

> **`dotnet test csharp` IS PART OF THE ROUTINE, NOT A PORTING-ONLY STEP** — and it was missing from this
> list until ten of its tests had quietly gone red.

`docs/investigations/csharp_test_rot_investigation.md` records that incident and the fix. **The rot
recurred because I did not follow a rule written after the last time it happened**, not because the rule
was missing. The gate list is right; my ritual was `npm test` + `check:goldens` + `check:en-gb-sets` +
parity, and the C# suite was never in it.

### And the discrimination in that test has narrowed, which is the thing to watch

Its comment explains that it needs a word the two OOV tiers read **differently**, and that after a
retrain a discriminating word can stop discriminating and leave the test "asserting nothing while still
passing". The two used to differ from the first vowel (`mˈændæɡ` against `mˈɑːndəɡ`); they now agree
through `mˈɑːnd` and differ only in the final syllable. Recorded in the test, with the instruction to
pick another of the six the #1341 sweep found when they converge entirely.

    C# suite 6,706 passed (first green run of this session) · trace-cold 189 languages, no poisons
