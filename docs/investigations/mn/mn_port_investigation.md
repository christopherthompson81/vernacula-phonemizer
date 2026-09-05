# Mongolian (mn) — C# port investigation

Chronological log of the runs behind the mn port.

## Run 1 — 2026-08-27 12:30 — what is there to port?

Question: how much of mn is its own code, and does anything in the shared core have to move?

    wc -l src/languages/mongolian/*.ts
        83 g2p.ts · 38 manifest.ts · 40 mongolBichig.ts · 122 mongolian.ts · 745 normalize.ts · 66 numbers.ts = 1,094

Six modules, and `normalize.ts` is two thirds of it. Everything it imports is already ported —
`Clauses`, `LoadManifest`, `Boundaries`, and `Initialisms` (`MakeInitialismNormalizer` +
`MakeUnreadableTest`, already wired by ru/tg/uz and five others) — so **no shared-core change was needed**,
and `Registry.cs` already routed `case "mn": return Create("mongolian")`.

Three porting hazards actually present here:

  · **`Seg` IS MUTATED IN PLACE.** `mongolian.ts` writes `raw[i].ph = "ŋ"` for the final-⟨н⟩ rule, the
    soft-sign fronting writes back into `segs[k].ph`, and the final devoicing writes `last.ph`. Ported as a
    **class, not a struct** — a value type would compile clean and silently drop all three writes.
  · **Invisible literals.** The TOKEN class carries the Mongol-bichig block, the free-variation selectors,
    ZWNJ/ZWJ and NNBSP; the bound-morpheme test is `/^[-­]/u` (hyphen *and* SOFT HYPHEN); `MAG`, the
    unit pattern and the space-grouping arm carry NBSP/NNBSP/thin space. Every one of those pattern strings
    was extracted from the TypeScript **programmatically** and substituted into the C# rather than retyped.
  · **A JS `replace` callback that reads `offset` and the whole string.** The currency step's redundancy
    window is `whole.slice(off, off + 40)` truncated at the first clause terminator; ported by freezing the
    subject string before each `Replace` and slicing it by `m.Index`, with JS's clamping `slice` reproduced
    explicitly.

**Parity: `dotnet run --project csharp/tools/parity -- mn` → 200/200 byte-identical on the first run**,
0 differ, 0 BLOCKED.

## Run 2 — 2026-08-27 12:40 — ⚠ mn HAS a FLEURS transcript, and `normalize.ts` says it does not

Question: PORTING.md's widening (1) is the corpus-wide FLEURS differential. `normalize.ts`'s header opens
with "⚠ THE SOURCING SITUATION, STATED PLAINLY. There is NO FLEURS corpus for Mongolian." Is that true?

    ls /mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/ | grep mn   →  mn_mn
    ls /mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/mn_mn/       →  train.tsv dev.tsv test.tsv
    cut -f3,4 …/{train,dev,test}.tsv | tr '\t' '\n' | sort -u | wc -l      →  3,982

**It is not true.** `mn_mn` exists with all three splits, and the sanity check PORTING.md asks for passes —
the first line of the extracted list is a SENTENCE, not a WAV filename (column 3, not column 2). There is
also `/mnt/data/omnivoice_ipa/work/phonemized_vernacula/byid/mn_mn.tsv`, 3,074 rows.

That is not bookkeeping. `normalize.ts` argues its refusals from **one** source ("attest.ts against
mn.wikipedia — WHICH IS THE WIKI THE ARTIFACT WAS MINED FROM, so that is a bigger sample of ONE source and
never two"), and a second, genuinely independent corpus was available the whole time. Filed as **#1099**;
see Run 4 for the refusal whose measurement actually inverts on it.

⚠ **And the golden is thinner than 200 rows suggests**: `csharp/goldens/mn.tsv` has 200 rows but only
**103 unique texts** — the mined-tier sample repeats.

## Run 3 — 2026-08-27 12:45 — the differential

    .probe/mn/all.txt = 4,861 unique lines
        3,982  FLEURS mn_mn train+dev+test, columns 3+4
          483  tools/corpus/mined/mn.jsonc + tools/corpus/attest/mn.jsonc
          395  hand-built (.probe/mn/gen_probes.mts) — one line per arm plus its adversarial neighbour
          103  the golden's own unique text
    × sync AND async = 9,722 comparisons, TS (.probe/mn/probe.mts) vs C# (.probe/mn/probe.csproj)

**Result: 9,722 comparisons, 0 differ, 0 throws on either side, 0 BLOCKED.**

What the haystack actually contains, measured rather than assumed (distinct lines carrying each construct):

| construct | FLEURS (3,982) | mined+attest (483) | golden (103) |
|---|---|---|---|
| any digit | 830 | 337 | 29 |
| grouped, comma+3 | 60 | 35 | 3 |
| grouped, space+3 | 1 | 3 | **0** |
| decimal dot | 16 | 67 | **0** |
| decimal comma | 24 | 15 | 3 |
| ordinal `-р` | 66 | 51 | 2 |
| percent sign | 6 | 31 | 1 |
| percent + case suffix | 4 | 9 | 1 |
| currency `$`/`€` | **0** | 16 | **0** |
| degree sign | **0** | 10 | **0** |
| unit key after a digit | 58 | 58 | 1 |
| minus-hyphen before a digit | 4 | 12 | **0** |
| U+2212 | **0** | 1 | **0** |
| clock `d:dd` | 30 | 2 | 1 |
| personal initial | 5 | 20 | 1 |
| abbreviation dot | 23 | 20 | 1 |
| all-caps run | 80 | 75 | 5 |
| Mongol bichig | **0** | 1 | **0** |
| legacy ⟨ї⟩/⟨ѳ⟩ | **0** | 1 | **0** |
| ⟨ъ⟩ + iotated (the glide) | 14 | 9 | 1 |

So the golden alone exercises NONE of the currency, degree, minus, decimal-dot, space-grouping, bichig or
legacy-codepage arms, and FLEURS adds nothing for currency, degrees, U+2212, bichig or ⟨ї⟩ either — those
five rest entirely on the mined artifact and the hand probes. Stated rather than left implied.

## Run 4 — 2026-08-27 12:50 — reading for correctness, and what the second corpus overturns

**FINDING 1 — the CLOCK refusal's measurement inverts on the corpus that was not consulted.**

`normalize.ts` declines a clock rule and prices the decision explicitly:

> six are SPORTS TIMES with their result noun already in front … four are census brackets … and only TWO
> are a time of day — and both already carry `цагт` after them, so the hour noun is not missing. A
> `\d{1,2}:\d{2}` rule would fix 2 and claim 10.

Measured over FLEURS mn_mn (punctuation-normalised distinct sentences):

    15 distinct sentences carry a d:dd clock — 18 instances
    15 of 15 carry a цаг / минут context word — every one is a TIME OF DAY
    0 sports times, 0 census brackets

    11:20 цагт · 1:15 цагт · 10:08 цагт · 11:35 цаг · 11:00 цаг · 12:00 цагт · 07:19-д · 09:19-д
    8:46 минутад · 8:30-д · 10:00-11:00 цагт · 11:29 цагийн орчимд · 06:30-с 07:30 цагийн хооронд

And the cost is not neutral, because `:` is `clausePunctuation` — every one currently reads with a
**spurious clause pause inside a single time expression**:

    Бямба гарагийн шөнийн 1:15 цагт …   →  … ʃɵniːŋ neɡ , arwəŋ tʰaf t͡sʰaɢtʰ …
    Өглөөний яг 8:46 минутад …          →  ɵɡɮɵːniː jaɢ naim , tɵt͡ʃʰəŋ t͡sʊrɢaː minʊtʰət …

The refusal may still be right — the minute word after a colon is unattested and the hour noun genuinely is
already written — but "would fix 2 and claim 10" is a count from one corpus, and on the other it is 18 for
18. Filed with #1099 rather than fixed: it moves goldens, and the fix is TS-first.

**FINDING 2 — the step-11 comment describes a core defect that has since been FIXED, and still says it is
live.** `normalize.ts` states that `makeUnreadableTest`'s signal 2 "breaks a 3+ consonant run only when the
run contains an ASCII `[lr]`… it is switched OFF for the whole script", and that `ХӨГЖЛИЙН` "is spelled out
as *хэ ө гэ жэ эл и хагас и эн* … a false positive shipping today". `core/initialisms.ts` now exports
`LIQUIDS = /[lrлр]/u` with its own note about the fix, and the C# core mirrors it. Executed:

    phonemize("ХӨГЖЛИЙН хөтөлбөр", "mn")  →  xɵɡt͡ʃɮiːŋ xɵtʰɵɮpɵr

— read as a word. The claim is stale in both directions (the defect and its named instance). Filed as
**#1100**. ⚠ NO TYPESCRIPT WAS CHANGED BY THIS PORT.

Questions 2 and 3 of PORTING.md's reading came back clean: every table `mongolian.jsonc` declares is
reached (vowels, longVowels, diphthongs, consonants, backVowels, letterNames, acronymLetters,
clausePunctuation, numbers — `ManifestMappingTests` pins that structurally), and `text()` → `phonemizeWord`
is the single entry point, so the golden, the eval and the shipped path are the same path.

## Run 5 — 2026-08-27 15:05 — both findings landed upstream, and the branch follows them

#1099 and #1100, the two findings this port filed, were both fixed in the TypeScript while the port was in
review (#1113 and #1107), and #1099 moved two rows of `csharp/goldens/mn.tsv`.

⚠ **THE FIX IS NARROWER THAN THE RULE THE REFUSAL PRICED, WHICH IS WHY IT COULD LAND AT ALL.** The issue
argued the clock refusal's premise was corpus-scoped; the fix does not add a clock rule. It spends the
COLON on a space and emits no word:

    /(?<![\d:])(\d{1,2})((?::\d{2})+)(?![\d])/gu   →  head + rest.replace(/:/gu, " ")

Because it names no population, it does not have to tell a clock from a race time from a census bracket —
so the "would fix 2 and claim 10" arithmetic, which prices a rule that emits `цаг`, does not apply to it.
The word is still refused. Ported as step 3b, after de-grouping and before every numeric step, exactly as
the TS has it:

    1:15 цагт      neɡ , arwəŋ tʰaf t͡sʰaɢtʰ   →  neɡ arwəŋ tʰaf t͡sʰaɢtʰ     the phrase break is gone
    8:46 минутад   naim , tɵt͡ʃʰəŋ …           →  naim tɵt͡ʃʰəŋ t͡sʊrɢaː minʊtʰət
    4:39:51.79     the WHOLE run is spent, not just the first colon
    0-14: 40.8%    keeps its pause — a colon followed by a SPACE is untouched

#1100 was documentation only (the stale ASCII-liquid claim) and needed no C# change; #1102's header
correction landed with it.

Re-gated after the merge: **parity mn 200/200 against the NEW golden**, and the differential re-run against
the fixed engine is **9,722 comparisons, 0 differ, 0 throws**.

⚠ **AND A CASE-FOLDING PROBE FOUND A LIVE CORE GAP — #1116, not introduced here.** Seven adversarial lines
(`ſ`, `İ`, `ẞ`, and the Cyrillic/Latin scale letters) diverge on two: `Js.ToLowerCase` does not apply JS's
length-changing SpecialCasing for U+0130, so

    Phonemize("İ",  "mn")   TS ˈaᶦ    C# I
    Phonemize("İх", "mn")   TS ˈiːks  C# Ix

— the C# emits the capital letter itself, a RAW-LATIN leak. mn reaches it through the public path where wo
could not (no nativiser shields a Latin run inside Cyrillic). It is ×0 in all 4,861 haystack lines, which is
why the corpus differential is clean. Reported on #1116 with the blast radius measured (6 of 185 goldens
carry U+0130, all Turkic); NOT fixed here, because a Core change with fleet-wide reach should not land as a
side effect of one language's port.

## Gates

    csharp tests            1,992 pass (86 in MongolianTests.cs), 0 fail
    parity, mn              200/200 byte-identical against the POST-#1113 golden, 0 differ, 0 BLOCKED
    parity, fleet           129 languages, 25,427 rows, 0 differ, 0 BLOCKED
    differential            9,722 comparisons (sync + async), 0 differ, 0 throws — re-run after the merge
    case-folding probe      2 of 7 lines diverge on the KNOWN core gap #1116, ×0 in the haystack
    typescript              unchanged by this branch (#1099/#1100 landed separately)
