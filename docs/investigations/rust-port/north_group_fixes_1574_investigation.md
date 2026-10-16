# #1574 — fi/et/is/fo number and clock fixes

The Rust port of the north group (#1573) reproduced these TS defects for parity. This log covers fixing them
TS-first and mirroring the fixes to C# and Rust. All probes are synthetic. The hu `ſtb.` → "undefined" item is
out of scope here: it is part of the fleet-wide long-ſ fix.

## Run 1 — 2026-10-15 18:00 (reproduce each finding on main)

**Command.** `WT=<worktree> npx tsx <scratch>/p.mts <lang> <texts>`. This prints the language's normalizer
output and the public `phonemize` for each text.

**Raw finding.** Every item reproduces as the port docs recorded it.
- fi: `klo 6.30–7.30 välillä` normalizes to `klo 6 30–7.30 välillä`, so the second operand keeps a
  sentence break. `Arvot 1,2,3 ja 4.` normalizes to `Arvot 1 pilkku 2,3 ja 4.`. `Hän voitti 2. kerran.`
  normalizes to `toinen kerran`.
- et: `kell 22:08` normalizes to `kell 22 08` and is read as *kaksikümmend kaks kaheksa*. `kell 10:00` is
  read as *kümme null*.
- is: `123:45 var` normalizes to `123 45 var`. `klukkan 9:05` is read as *níu fimm*. `Um 100,000 manns`
  normalizes to `100 komma 0 0 0`. `Leikurinn fór 3-2` normalizes to `3 til 2`.
- fo: `kl. 14.30` normalizes to `klokkan 14,30`, a decimal. `23.4.2020` normalizes to `23,4.2020`, a decimal
  plus a sentence break. `12.10.20` normalizes to `12 10 20`, three cardinals.

**Implication.** Fix each one in its own normalizer.

## Run 2 — 2026-10-15 18:05 (measure the shapes before choosing rules)

**Question.** Does any corpus witness these shapes, and which reading does it want?

**Command.**
- Shape greps over the FLEURS transcripts on the external corpus drive, for fi_fi, et_ee, is_is, hu_hu, sv_se
  and nb_no.
- The same greps over `tools/corpus/mined/{fi,fo}.jsonc`.

**Raw finding.**
- `\d+(,\d+){2,}` comma lists: 0 in fi_fi, et_ee and is_is. Dashed clock ranges: 0 anywhere. Both shapes are
  latent, so the fixes rest on synthetic probes.
- `\d{1,3},\d{3}`: 0 in is_is (8 comma figures, all decimals). The comma-decimal siblings do have it, as hu 4
  (`100,000`, `2,250`, `11,000`, `22,500`), sv 9 and nb 5. All 18 are English thousands separators in
  translated text, and none is a three-place decimal. That evidence licenses Hungarian's de-grouping for is.
- is descending pairs: FLEURS is_is has two, and both are match scores. Its ascending pairs (year spans,
  `120–160`, `2–3`) are ranges.
- fo month names: all twelve (januar … desember) are attested in the mined fo corpus. Dotted dates and
  `kl. H.MM` occur 0 times there.

**Implication.**
- is: ranges become ascending-only, and an English-grouped thousand is de-grouped.
- fo: a date names its month in the corpus spelling.

## Run 3 — 2026-10-15 18:10 (TS fixes, probe by probe)

**Changes, and the probe results.**
- **fi, range arm:** the joiner may now be `ja` or a dash (`\s*[–—-]\s*`).
  - `klo 6.30–7.30 välillä` normalizes to `klo 6 30–7 30 välillä`, with no ` . ` in the IPA.
  - `klo 6.30–25.30` still declines as a whole.
- **fi, decimal comma:** `(?<!\d,\d*)(\d),(\d+)(?!\d)(?!,\d(?!\d\d(?!\d)))`.
  - `1,2,3` is now left as a list, and reads like `1, 2, 3`.
  - The first draft (`(?!\d|,\d)`) also changed `1,000,000`, from *1 pilkku 0 0 0, 000* to *1, 000, 000*.
    Both readings are wrong, and that shape is out of scope, so the guard now lets a following `,ddd`
    through and `1,000,000` keeps its old reading. The English-grouped thousand in fi is left for later.
- **et:** `clockMinutes` reads `08` as *null 8* and `00` as *null null*, mirroring fi's `minutes()`.
  `kell 7.05-ks` gives `kell 7 null 5-ks`. On main, `kell 7:00-ni` already reads its `00` as one *null* before
  `-ni`; now it reads *null null*.
- **is, clock:** the rule gains `(?<!\d)` on the left and the same minutes reading (`núll`). `123:45` is now
  left as written and reads with the colon's pause.
- **is, thousands:** a de-grouping rule for English-grouped thousands.
  - A per-comma loop copied from Hungarian failed on `5,000,000`: it read `5 komma 0 0 0 0 0 0`, because the
    guard `(?![\d]|,\d)` refuses every comma that another group follows. The Hungarian original has the
    same gap; it is outside this issue.
  - The rule was replaced with the whole-number form from fo step 2, and `5,000,000` now gives `5000000`.
    `0,500` and `1,2345` stay decimals.
- **is, range:** ascending only. `3-2` and `2-2` stay as written; `1990-1995` still becomes `til`.
- **fo, dotted date:** a new step 0. `23.4.2020` gives `23 apríl 2020` and `12.10.20` gives `12 oktober 20`.
  `23.59.60` has a middle field of 59, so it still reaches the time rule.
- **fo, clock:** a new step 0b, `(?<=(?:kl\.|klokkan)\s?)H.MM`. `kl. 14.30` gives `klokkan 14 30`, and `3.00 kr`
  is still the dollar decimal.

**Unrelated, on main and not changed here.**
- fo `23.59.60,` followed by a comma is read as a decimal: the time rule's tail `(?![\d.,])` rejects a
  clause comma.
- fo `kl.9.05` expands to `klokkan9` with no space.
- A capital `Kl.` is not expanded.

## Run 4 — 2026-10-15 18:20 (suites, goldens, guard checks)

**Command.** `npx vitest run test/{finnish,estonian,icelandic,faroese}.test.ts`, then
`npx tsx tools/check-goldens.mts`.

**Raw finding.**
- Two old pins recorded the dropped zero: et `kell 22:08 mõõdukas` → `kell 22 08 mõõdukas` and is `11:00` →
  `11 00`. Both were updated, along with their Rust replays.
- Goldens: 1 stale row, in fo. The row writes `klokkan 20.27.`, which read as *tjúgu komma tvey sjey* and now
  reads as the clock. That is the fix, so `fo.tsv` was regenerated with `--write fo`. Afterwards: 189
  languages, 0 stale.
- Guard checks, with each normalizer restored from origin/main:
  - TS: 10 of the 11 new tests fail. The one that passes is the unchanged `kell 22.30` control.
  - C#: 22 of the 32 new cases fail. The 10 that pass are controls whose behaviour is unchanged.
  - Rust: all four replay tests fail.
- Regex corpus regenerated: 146,442 probe results identical, 0 DIFFER.

**Deferred: fi `2. kerran` should read *toisen*.** The reading the head wants is clear: *kerran* is the
genitive, so the ordinal is *toisen*. The fix is not a rule, though. It needs the oblique ordinal paradigm,
which inflects every part of a compound (*kahdennenkymmenennen*), and it needs to know the head's case.
The file's header already notes that no in-repo source carries those forms. This is a feature to source,
not a guard to add, so it stays open on #1574.
