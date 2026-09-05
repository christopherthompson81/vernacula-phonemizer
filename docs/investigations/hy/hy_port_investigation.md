# hy (Eastern Armenian) TypeScript → C# port — investigation log

Target: `csharp/Vernacula.Phonemizer/Languages/Armenian/` mirroring `src/languages/armenian/`
(721 lines: `armenian.ts` 212, `normalize.ts` 498, `manifest.ts` 11).

## Run 1 — 2026-08-26, port + golden gate

Command: `dotnet run --project csharp/tools/parity -- hy`.
Question: does the straight port reproduce the 200 golden rows byte-for-byte?

Result: **200/200 OK, 0 differ**, first attempt. `Registry.cs` already carried `case "hy"`;
registration added to `Languages/Bootstrap.cs`; `ArmenianManifestIsFullyMapped` added to
`ManifestMappingTests`.

Implication: the golden is not a sufficient probe — it is 200 FLEURS rows with no marks, no
`՛`/`՞`, and (as Run 2 showed) no decimal-with-magnitude. Proceed to the corpus-wide differential.

## Run 2 — 2026-08-26, corpus-wide differential (first pass)

Corpus: FLEURS `hy_am` dev+test+train, **columns 3 AND 4** (raw and lowercased), plus every string in
`tools/corpus/mined/hy.jsonc`, deduplicated → 4,465 unique lines. Plus 298 hand probes, one per
`normalize.ts` arm and its adversarial neighbour → 4,763 lines. Both engines, **sync and async**.

Result: **8 lines differ.** All one root cause.

    input                  TS                                            C#
    2.095 մլրդ             jeɾku ɑmboʁd͡ʒ zəɾo innsun hinɡ miliɑɾd        jeɾku hɑzɑɾ innsun hinɡ
    1,234 x 5              mek ɑmboʁd͡ʒ jeɾkuhɑɾjuɾ jeɾesun t͡ʃʰoɾs ˈɛks   hɑzɑɾ jeɾkuhɑɾjuɾ jeɾesun t͡ʃʰoɾs
    159,681 մլրդ $         …ɑmboʁd͡ʒ… miliɑɾd dolɑɾ                       …hɑzɑɾ… dolɑɾ

Cause: **a capture-group index, mine.** Step 1c's optional trailer — the magnitude / `×` / `%`
discriminator that says "this `.`/`,` is a DECIMAL POINT, not a grouping mark" — is capture group 3.
I read `m.Groups[4]`, copying the group numbering of the neighbouring step-1b pattern (which does have
a separator capture). Group 4 never participates, so `Success` was always false, so every
`\d{1,3}[.,]\d{3}` followed by a magnitude was DE-GROUPED instead of read as a decimal: `2.095 մլրդ`
became 2095 and lost its `միլիարդ` entirely.

Invisible to the golden (0 of 200 rows carry the shape) and invisible to `dotnet test`.
Fixed; re-ran: **0 differ over 4,763 lines**.

Implication: the differential earns its cost on the first language it is run on. Keep going and read
the OUTPUT, not just the diff.

## Run 3 — 2026-08-26, reading the probe output for correctness

Question 1 of PORTING.md, asked of `normalize.ts` and `armenian.ts`: does the code do what its own
docstring promises? Three answers, one of them a shipped defect.

### 3a. DEFECT (fixed, TS first): `՛ ՜ ՞` are written INSIDE the Armenian word, and split it

Armenian does not postpose these three marks the way Latin punctuation does — it writes them over the
word's LAST VOWEL, i.e. between letters. The tokenizer's word class is Armenian letters, so each one
cut its word in two and the fragments were phonemized as separate words, epenthesis and all:

    կա՛մ     → kɑ mə          (correct: kɑm)      a schwa the language does not have
    ո՛չ      → vo t͡ʃʰə        (correct: vot͡ʃʰ)    the ⟨ո⟩→[vo] INITIAL glide fired on a fragment
    Տե՛ս     → te sə          (correct: tes)
    Ինչո՞ւ   → int͡ʃʰo ? və    (correct: int͡ʃʰu ?) the mark split the ⟨ու⟩ DIGRAPH as well, and the
                                                  question pause landed mid-word
    Ինչպե՞ս  → int͡ʃʰpe ? sə   (correct: int͡ʃʰpes ?)
    Արդյո՞ք  → ɑɾdjo ? kʰə     (correct: ɑɾdjokʰ ?)

Measured over the 4,465 corpus lines: `՛` on 54 lines / 94 occurrences, 32 of them between two
Armenian letters and every sampled one a genuine emphasis mark (կա՛մ, Խառնի՛ր, սեղմի՛ր, ո՛չ, լսե՛ք,
ուշադի՛ր, ստուգե՛ք, Տե՛ս, Հիշի՛ր). `՞` on 11 lines / 18 occurrences, 15 intra-word, every one an
interrogative. `՜` ×0 here. **The parity golden carries zero of all three** — only the corpus-wide
differential can see this.

Fix, in `src/languages/armenian/normalize.ts` as step 0 (TS first, then goldens, then C#):
`՛`/`՜` inside a word are DELETED — they were already silent (`clausePunctuation` has no entry for
either), so this changes nothing but the word boundary. `՞` MOVES to the end of its word, where the
tokenizer reads it as the question pause it is. Letters required on BOTH sides, which is what keeps
the arc-minute out (`41°24՛`, ×9, digit-adjacent, still dropped) and what leaves `՝` — Armenian's real
inter-word pause, 1,096 instances, none intra-word — completely alone.

Goldens regenerated: **0 rows changed**, exactly as the zero-mark measurement predicted. `hyw` is
untouched: it passes no normalizer (trap 55), so the shared `makeArmenianEngine` is unaffected.
Test added to `test/armenian.test.ts` pinning all six readings plus both refusals.

### 3b. FILED, not fixed: step 7's own third exemplar is unreachable

`normalize.ts` step 7's header says it claims "`10 կմ-ից`, `2500 մ-ի`, **`1,6 միլիարդ մ²-ը`**,
`16.8կմ²-ը`". Its pattern's lead is `(\d\s?)` — a DIGIT immediately before the unit. In
`1,6 միլիարդ մ²-ը` the character before `մ²` is a space after `դ`, so the rule declines, the shared
tier matches the bare `մ²`, and the suffix is stranded as a free word:

    1,6 միլիարդ մ²-ը  →  mek ɑmboʁd͡ʒ vet͡sʰ miliɑɾd kʰɑrɑkusi metəɾ ə
                                                                  ^^ a bare vowel

which is precisely the failure step 10 exists to prevent for the percent sign. Corpus: 3
non-digit-adjacent instances (` հա-ի`, ` մ²-ը`) against 4 digit-adjacent ones. NOT fixed here —
widening the lead to any Armenian letter is the trap-38 exposure (an ordinary word ending in `մ` or
`հա` before a hyphen), and narrowing it to a magnitude/measure-word list is a measured decision on 3
instances that should not be made as a side effect of a port. Both engines reproduce it identically.

### 3c. FILED: a dead branch in step 1c

`head === "0" || trailer !== undefined ? m : …` — the pattern's head is `[1-9]\d{0,2}`, so `head`
can never be `"0"` and that disjunct never fires. The docstring's signal (b) ("integer part is `0` →
decimal") is nonetheless honoured, but by the pattern NOT MATCHING at all, which leaves `0,624 կմ²`
to step 13. Behaviour is correct; the branch is dead. Carried verbatim into C# with a note.

### 3d. Residual leaks, consistent with the TS's stated refusals — reported, not touched

  · a bare unit as a slash NUMERATOR (`կմ/ժ`, `մ/վ`, `կգ/մ³`) — 32 corpus instances. Step 7b claims
    the DENOMINATOR only, so `կմ` reaches the IPA as *kmə*.
  · slash denominators with no declared noun (`/ժ` hour, `/վ` second, `/լ` litre) — 29 instances.
    Sourcing them is the blocker, not code; and trap 54 refuses to invent the `per` relation.
  · `Մ.թ.ա.-ն` — the era marker's own attestation line in the header — leaves `-ն` as *nə*. ×0 in
    the corpus, so no evidence to act on.
  · initialisms (`ԽՍՀՄ` → *χshmə*) — the largest untreated class, blocked on sourcing the 38 Armenian
    letter names, exactly as `normalize.ts` already states.

## Run 4 — 2026-08-26, arm coverage of the differential

Question: what fraction of the 4,465-line corpus actually exercises the new code, per arm? (A clean
differential over a corpus that carries none of the construct proves nothing.)

    arm                    corpus lines   probe lines
    1a space grouping             54           10
    1b ≥2 dot/comma groups         6            2
    1c one dot/comma group        65           12
    2  dotted D.M.YYYY             3           10
    3  era marker                 28            8
    4  coordinate pair             2            5
    5  թ. / թթ.                   65            3
    5  քառ. / Սբ.                  8            2
    5  magnitude abbreviation     12            8
    6  ASCII exponent              4            6
    7  unit + bound suffix         4            8
    7b unit after / or measure    15            5
    8a ordinal range               7            2
    8b ordinal suffix            123           12
    8c case/article suffix       375           36
    9  range                     138           14
    10 percent + suffix           42            5
    11 degree                     10           12
    12 minus                      40           10
    13 decimal                   167           56
    14 fraction                    6            8
    tier: %                       64           11
    tier: currency                17            5
    tier: unit                   101           15

Every arm is reached by the corpus itself; the thinnest (coordinate pairs, dotted dates, ASCII
exponent, unit+suffix) are the ones the probes carry. 4,404 of 4,465 lines (98.6%) carry Armenian
script; 1,169 (26.2%) carry a digit and so reach the number path. No probe emitted an empty reading
and neither engine threw on any of the 4,778 lines.

## Gates at close

    dotnet run --project csharp/tools/parity -- hy   1 languages byte-identical, 0 differ (200 rows ok, 0 differ)
    dotnet run --project csharp/tools/parity        107 languages byte-identical, 0 differ (21096 rows ok, 0 differ)
                                                     — no BLOCKED line
    cd csharp && dotnet test                         Passed! Failed: 0, Passed: 1100
    npx vitest run                                   283 files, 5454 passed | 5 skipped

`hy` clears the last blocked dependency: `ug` and `he` each carry a corpus row with an embedded
Armenian run that the script router hands to the `armenian` engine, and both are now resolvable.
