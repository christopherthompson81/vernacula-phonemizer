# Kirundi (rn) — C# port investigation

Chronological log of the runs behind the rn port. rn was picked by the queue's own rule — highest speaker
population among unported codes with a golden: **11M**, ahead of ilo (10M) and the 9M band.

## Run 1 — 2026-08-28 07:10 — what is there to port?

    wc -l src/languages/kirundi/*.ts
        84 kirundi.ts · 24 manifest.ts · 667 normalize.ts · 29 numbers.ts = 804

No shared-core change was needed, and **the compositor was already ported**: rn shares Kinyarwanda's numeral
system, so `numbers.ts` is a 3-line wrapper around `composeRwandaRundi` and `manifest.ts` reuses rw's
`RwandaRundiNumbers` type. The C# mirrors that exactly — `Kirundi/Numbers.cs` calls
`Kinyarwanda.Numbers.ComposeRwandaRundi` with rn's own table. `Registry.cs` already routed
`case "rn": return Create("kirundi")`.

⚠ **AND THAT IS THE ONLY THING rn SHARES WITH rw.** The TS header is emphatic that Kinyarwanda is not a
source for Kirundi, and lists seven normalizer rules that diverge after re-measurement — the one that
matters most being SQUARED, where rw's `kare` is the Kirundi ADVERB "early" (20 hits / 15 articles on
rn.wikipedia, every one adverbial) and rn's word is `kwadarato`. Porting rw's table unmeasured would have
read every area figure as "early kilometres". Nothing was inherited from the sibling file; every pattern was
taken from rn's own.

⚠ **THIS FILE OWNS THE SHARED-TIER CALL**, which the port has to reproduce as a SEQUENCE rather than a
wrapper: de-grouping must run before the tier (rn's whole `version-dot` cell is grouped thousands glued to
an abbreviation, which `NOT_VERSION` refuses) and the decimal spell-out after it. Nine steps, the tier at 7.

⚠ **THE SEPARATOR CLASSES WERE AUDITED BY CODE POINT BEFORE THE FIRST RUN** (the nso lesson, #1109), and
every one in the C# is written as an ESCAPE rather than a literal character — a literal NBSP in C# source is
invisible to review and to every corpus line but one.

⚠ **`saidNear` READS THE PRE-REPLACEMENT STRING**, as JS's `replace` callback argument does, so each of the
nine passes snapshots `s` before its own `Replace`. ⚠ rn does NOT carry rw's `INSERTED` sentinel — rw needed
it because its five degree arms had to hide their own emissions from a later arm's guard; rn's TS has no
such marker, so the C# reproduces the plain behaviour rather than importing the sibling's fix.

**Parity: `dotnet run --project csharp/tools/parity -- rn` → 200/200 byte-identical on the first run**,
0 differ, 0 BLOCKED.

## Run 2 — 2026-08-28 07:20 — the widenings, and what is NOT available

⚠ **rn HAS NO FLEURS CORPUS** — the catalogue says `fleurs 0` and there is no `rn` transcript directory — so
PORTING.md's widening (1), the corpus-wide differential, **does not exist for this language**. Stated rather
than left as a gap: the weight falls entirely on widening (2), the off-golden probes, plus the two artifacts
that do exist.

    .probe/rn/all.txt = 2,158 unique lines
        1,601  tools/referee-eval/referees/rn.epitran-run-latn.tsv, column 1 (the referee WORDLIST)
          390  tools/corpus/mined/rn.jsonc + tools/corpus/attest/rn.jsonc
          200  the golden's own unique text
          176  hand-built off-golden probes (.probe/rn/probes.txt)
    × sync AND async = 4,316 comparisons

**Result: 4,316 comparisons, 0 differ, 0 throws, 0 BLOCKED**, sync output equals async on every row (rn has
no neural path), and a sweep of every C# output for a raw digit or a `$ € £ % ² ³ ° / &` returns **0 lines
of 2,158**.

What the haystack contains, per source — and the honest reading of it:

| step | construct | mined+attest (390) | golden (200) | referee (1,601) | probes (176) |
|---|---|---|---|---|---|
| 1 | dotted capital run | 6 | **0** | **0** | 8 |
| 2 | dotted `d.m.yyyy` date | 1 | **0** | **0** | 7 |
| 3 | comma grouping | 21 | 7 | **0** | 15 |
| 3 | period grouping | 21 | 3 | **0** | 7 |
| 3 | space grouping | 5 | **0** | **0** | 5 |
| 4 | unit before its number | 3 | **0** | **0** | 6 |
| 5b | slash span | 8 | 6 | **0** | 8 |
| 5c | dash span | 9 | **0** | **0** | 13 |
| 6 | degree sign | 7 | 6 | **0** | 16 |
| 6d/7 | percent | 15 | **0** | **0** | 6 |
| 7 | currency sign | 3 | 1 | **0** | 6 |
| 8 | bare denominator | 5 | 1 | **0** | 4 |
| 8b | `N:NN` colon | 3 | 1 | **0** | 5 |
| 9 | decimal | 6 | 2 | **0** | 15 |

⚠ **THE GOLDEN REACHES ONLY FOUR OF THE NINE STEPS.** Steps 1, 2, 4, 5c and 6d are ×0 in it, and so is
space grouping. ⚠ **AND THE 1,601-LINE REFEREE LIST IS A WORDLIST — it carries ONE digit in total**, so it
exercises the g2p broadly and the normalizer not at all. Counting it toward "2,158 lines" would overstate
the coverage badly; it is listed separately for that reason. Five of the nine steps rest on the mined
artifact and the hand probes, and two of those (the dotted date at ×1, unit-before-number at ×3) rest on
counts small enough that the probes are doing the real work.

## Run 3 — 2026-08-28 07:32 — the whole-fleet gate

`dotnet run --project csharp/tools/parity` → **135 languages byte-identical, 26,627 rows ok, 0 differ, 0
BLOCKED**; `dotnet test` → **2,566 passed, 0 failed** (84 new `KirundiTests` cases + the
`KirundiManifestIsFullyMapped` structural check).

## Run 4 — 2026-08-28 07:34 — reading for correctness

Three findings. All are reproduced IDENTICALLY by both engines, so all three are FILED rather than fixed
here (PORTING.md: the fix lands in the TypeScript first, with a test and regenerated goldens).

### FINDING 1 (#1135) — a CUBE reads as a SQUARE in two of rn's three exponent paths

`normalize.ts` states the refusal plainly:

> ⚠ NO CUBE WORD IS DECLARED. `m³` and `km³` are ×0 in rn and no Kirundi cube word is attested — the trap 51
> floor, recorded rather than guessed.

The tier honours it. **The two LOCAL arms do not.** Step 4 (unit-before-number) and step 8 (bare
denominator) both put `³` in the pattern's alternation and then map *every* exponent to `SQUARED`:

```ts
(_m, key, exp?) => (exp === undefined ? noun : `${noun} ${SQUARED}`)
```

So one construction reads three different ways in one language, depending only on where the number sits:

    km³ 517       → ibirometero kwadarato 517        step 4  — a CUBE stated as a SQUARE
    (233/km³)     → kuri kirometero kwadarato        step 8  — the same
    517 km³       → ibirometero³ 517                 the tier — refuses to name it (and strands the ³)

A dropped exponent is a lossy reading; a cube ANNOUNCED as a square is a false one, and it is the trap-53
shape the playbook names — half a reading is not a reading. The sibling layers refuse it explicitly
(`sepedi/normalize.ts`: *"no cube word exists for nso"*, returning the whole match), so this is not a fleet
convention, it is rn's own gap. **×0 in the corpus, so latent** — but the guard costs one comparison and the
file already argued for it in prose.

### FINDING 2 (#1136) — step 3's space-grouping arm eats an ASCII exponent digit, and `km` then leaks raw

Step 4's own comment anticipates the ASCII exponent:

> ⚠ THE KEY IS BOUNDED ON BOTH SIDES and the SPACE IS MANDATORY … The unspaced shape means something else
> entirely — `km2` is `km²` with an ASCII exponent — and an optional space would let this rule read that `2`
> as the unit's NUMBER.

The mandatory space does hold. What the comment does not anticipate is that **step 3 runs first** and its
space-grouped-thousands arm matches `2 517` inside `km2 517` — head `2`, block `517`, and the lookbehind
`(?<![\d.,])` is satisfied because the preceding character is `m`:

    km2 517  →  km2517  →  *km ibihumbi bibiri na amajana atanu na icumi na indwi*

The exponent digit is glued onto the number, the figure is read as 2,517 instead of 517, and `km` reaches
the phoneme stream RAW — which is the very leak step 4 exists to close. Same for `km3 517`. Also ×0 in the
corpus (all four corpus instances write the superscript), so latent; the fix is a letter-boundary guard on
the grouping head, and it belongs in the TS with a test. ⚠ AND IT GENERALISES PAST UNITS — the lookbehind
admits any preceding LETTER, so `R2 500` → `R2500` too.

### FINDING 3 (#1137) — the `US$` compound key cannot match any of the three shapes it was declared for

`normalize.ts` says:

> Both the bare `$` and the compound `US$` key are declared, because the corpus writes `US $ 4,000`,
> `US $ 7.34` and `US $ 0.18` with the country prefix

The compound key matches `US$4,000` and `US$ 4,000`. It does **not** match `US $ 4,000` — the space between
`US` and the sign — and that is how **all three** of rn's corpus instances are written:

    US $ 4,000   → US amadorari 4000      the `US` survives as a word
    US$4,000     → amadorari 4000         the shape the key was written for — ×0 in this corpus

The TS header's own "what was broken" table lists `US $ 4,000 → us kane , zeɾu` — "sign dropped, and `US`
read as the word *us*". Half of that defect is fixed (the sign is now read); the other half is still
shipping, and the file believes it is not. This is the only one of the three findings that is **LIVE rather
than latent** — 3 of 3 corpus instances — and it is pinned as it SHIPS in `KirundiTests`, with the note, so
the port does not quietly bless it.

### Recorded, not filed — the manifest's stale `convention` block

`kirundi.jsonc`'s `convention.affricates` reads `⟨c⟩→t͡ʃ, ⟨j⟩→ʒ, ⟨sh⟩→ʃ` — Kinyarwanda's value for ⟨j⟩,
contradicting the same file's header ("ONE confident delta: ⟨j⟩ → d͡ʒ"), its own grapheme table (`"j":
"d͡ʒ"`) and the shipped reading (`jana` → *d͡ʒana*, verified). Above the number block a second leftover reads
"Cardinal number words (Kinyarwanda) … makumi abiri = 20", naming the fused rw form that rn's corrected
comment two lines below explicitly rejects. `convention` is metadata neither engine reads, so nothing is at
stake in the output — but it is the one place a reader looks up the rw/rn difference, and on that question
it currently gives the wrong answer twice.

## Verdict

    parity rn               200/200 byte-identical, 0 BLOCKED — first run
    parity fleet            135 languages, 26,627 rows, 0 differ
    differential            4,316 comparisons (sync + async), 0 differ, 0 throws
    dotnet test             2,566 passed, 0 failed
    leak sweep              0 of 2,158 outputs carry a digit or an unread symbol
    findings                3, all reproduced identically by both engines → FILED (#1135, #1136, #1137)
    ⚠ NO FLEURS             widening (1) is unavailable for rn; the probes carry it, and the golden
                            reaches only four of the nine normalizer steps
