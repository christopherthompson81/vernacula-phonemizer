# Sesotho (st) — C# port investigation

Chronological log of the runs behind the st port. st was picked as the next language by the queue's own
rule — descending speaker population among unported codes that have a golden: **14M (6M L1 + 8M L2)**, the
remaining half of the tie tn shared with it (`nso`, the third, carries the catalogue's ⛔ verdict).

⚠ **st AND tn ARE CLOSE SIBLINGS AND WERE PORTED BACK TO BACK, which is trap 55.** Nothing in this port was
carried across from the Setswana one: the probe list was written from st's own files, and every count below
was re-measured on st's own artifacts. The two engines share a SHAPE (a greedy longest-match scan over a
grapheme table) and nothing else — st's table has the ejectives and ⟨q⟩→[!], tn's does not; st owns the tier
call mid-pass, tn wraps it in two exported functions; the numeral systems are different constructions.

## Run 1 — 2026-08-27 13:25 — what is there to port?

    wc -l src/languages/sesotho/*.ts
        419 normalize.ts · 92 numbers.ts · 78 sesotho.ts = 589

No `manifest.ts` — the three modules each call `loadManifest` on the same jsonc. Ported as one `Manifest.cs`
holding the whole `SesothoDef`, which is also what `ManifestMappingTests` needs to diff the key set.

Everything imported is already ported (`Clauses`, `LatinPhones`, `HostWord`, `NormalizeSymbols`,
`LoadManifest`), so **no shared-core change was needed**, and `Registry.cs` already routed
`case "st": return Create("sesotho")`.

The interesting structure is that **`normalize.ts` OWNS THE SHARED-TIER CALL** (its step 9) rather than
being wrapped around it: ranges and the currency-glued magnitude letter must run before the tier (because
`unitPrefix` moves the noun in front of its number), and the decimal spell-out must run after it. Neither
the Xhosa nor the Chichewa order satisfies all three couplings.

Porting notes: `w.startsWith(key, i)` ports with the bound check FIRST; the three noun-class concord series
(`class4`/`class6`/`class8`) are three separate manifest tables on purpose and are kept that way; the
digit-by-digit fallback reproduces JS's `N.units[Number(d)] ?? d` including the non-digit fall-through.

**Parity: `dotnet run --project csharp/tools/parity -- st` → 200/200 byte-identical on the first run**,
0 differ, 0 BLOCKED. 200 unique texts.

## Run 2 — 2026-08-27 13:30 — the differential, and the one row that differs

st has **no FLEURS split** — checked rather than assumed, after mn's header turned out to be wrong (#1099,
#1102): the catalogue says `fleurs 0`, and the only Sotho-group transcript directory is `nso_za`. So
widening (1) is unavailable and the weight falls on the artifacts plus hand probes.

    .probe/st/all.txt = 758 unique lines
        459  tools/corpus/mined/st.jsonc + tools/corpus/attest/st.jsonc
        299  hand-built (.probe/st/gen_probes.mts) — one line per arm plus its adversarial neighbour
        200  the golden's own text
    × sync AND async = 1,516 comparisons

**Result: 1,514 identical, 0 wrong, 0 throws — and 2 BLOCKED** (one line, sync and async).

The blocked line carries an embedded GEORGIAN run:

    Ilia II (Segeorgia: ილია II), eo hape a fetoleloang e le Ilya kapa Elijah …
      TS   … sɛxɛɔrxiɑ , ilia pʼɛdi , …      the run is routed to the `ka` engine and READ
      C#   … sɛxɛɔrxiɑ , pʼɛdi , …           the run is dropped

`Registry.PortPending` for that row is **`[georgian]`** — measured with a probe that clears and reads the
set per line, not inferred. Georgian is unported, so this is the BLOCKED class the parity runner prints
separately, not a divergence. It is not in the golden (parity is 200/200 with nothing blocked).

A separate sweep of every output for a raw digit or symbol (`[0-9%$£€°º²³×=&]` or a capital) returns
**0 lines of 758**.

What the haystack contains:

| construct | mined+attest (459) | golden (200) |
|---|---|---|
| any digit | 329 | 144 |
| comma / period / space grouping | 33 / 9 / 22 | 12 / 4 / 8 |
| decimal dot / comma | 29 / 16 | 6 / 3 |
| percent | 18 | 3 |
| currency (any key) | 23 | 4 |
| currency-glued `m`/`bn` | 5 | **0** |
| unit key after a digit | 27 | 5 |
| exponent after a key | 10 | 2 |
| rate (`key` + `/h`) | 4 | **0** |
| dash range | 33 | 14 |
| `N:NN` | 10 | 3 |
| dotted capital run | 11 | 7 |
| dotted D.M.Y date | 2 | 2 |
| HTML entity | 8 | 1 |
| bare `&` | 6 | 2 |
| English ordinal suffix | 4 | 1 |
| degree sign | 6 | 2 |

The golden never exercises the currency-glued magnitude letter or the rate branch — the two steps whose
coupling the header argues hardest for — so both rest on the artifacts and the probes.

## Run 3 — 2026-08-27 13:35 — reading for correctness

**No finding.** Unusually for this sweep, every checkable count in `normalize.ts`'s header verifies exactly
against the artifact. Re-measured (the artifact stores each retained segment twice, in `hard` and `sample`,
so the raw counts halve):

| the header's claim | measured |
|---|---|
| 12 `R`+digit instances, ALL money | 12 — `R470 bilione`, `R2.3m`, `R30,000,000`, `R3,2 milione`, `R22.7 milione`, `R28.9 limilione` … no road numbers, no references |
| digit-adjacent `m` ×10: 7 metres + 3 currency-glued millions | 10 — `5,267 m`, `1,395 m`, `800 m`, `1500 m`, `2.00m`, `270 m`, `800 m` vs `R2.3m`, `£1.2m`, `R22.8m` |
| all 6 digit-adjacent `ha` are the Sesotho WORD | 6 — `sa 1994 ha mmuso`, `tse 15 le 64 ha ba na`, `ka 1905 ha`, `Ka 1969 ha`, `Mphalane 2010 ha`, `Phupu 2020 ha` |
| digit-adjacent `cm`/`mm` ×0 | 0 |
| `&` ×19, of which 8 are `&nbsp;` | 19 / 8 |
| 50 `N-N` shapes, the modal one a SEASON | 50, of which 28 non-ascending; 21 season-shaped (`2016-17` … `2022-23`) |
| every `N:NN` is a verse, a race time or a date | 13 — `1:10`/`1:11`/`1:14` (Genesis), then `2:04.23`, `1:56.72`, `4:08.01`, `5:58:53`, `3:31:28`, `2:27:48`, `2:25:28`, `16:01.76`, `1:58.85`, `1:55.45` |

Two things checked because they have been defects elsewhere, both clean:

  · **`NATIVE_CLASS` `[a-zšêô]` covers every one of the 43 grapheme keys** the table declares — a key
    outside the nativiser's class would make the g2p reject a genuine Sesotho word.
  · **`20²` → `20 2` is NOT the bare-exponent defect it looks like.** The header refuses a bare-exponent
    READING, and the output still spells the superscript as a digit — but that is `spacedBareExponent`, the
    shared FLOOR under every exponent refusal (#1041: leaving the mark meant the tokenizer dropped it and
    `10⁶` read as *ten* in 169 of 193 codes). `10⁻³¹` is correctly left alone by the negative-exponent
    decline. Checked in `core/normalizeSymbols.ts` rather than assumed from the output.

Questions 2 and 3 came back clean: all three manifest tables are reached (`graphemes`, `clausePunctuation`,
`numbers`, the last with all three concord series — `ManifestMappingTests` pins that structurally), and
`text()` → `phonemizeWord` is the single entry point.

## Run 4 — 2026-08-27 15:35 — the rebase, and the one thing that had to be re-confirmed rather than assumed

st filed no finding, so nothing of its own landed upstream and **`src/languages/sesotho/` is untouched by
every commit since the branch point** — verified by diff, not assumed. What the merge brings is three
shared-core changes that reach st: #1093's rate fix, #1095's large-numeral work and #1118's
`Js.ToLowerCase` repair.

⚠ **THE BLOCKED ROW HAD TO BE RE-MEASURED, NOT CARRIED FORWARD.** A row that is BLOCKED and a row that is
WRONG look identical in a diff, and the thing that distinguishes them — whether the target engine is ported
— is exactly the kind of fact that changes while a branch sits. Re-run: Georgian is still absent from
`Bootstrap.cs`, and `Registry.PortPending` for that row is still `[georgian]`. So the differential is
**1,514 identical, 0 wrong, 2 BLOCKED**, unchanged in substance.

⚠ And the pending probe was built in a directory of its OWN this time. On the first run it lived inside
`.probe/st/`, where the parent `probe.csproj`'s `**/*.cs` glob swallowed its `Main` and broke the sibling
build — the `.probe` hygiene hazard PORTING.md warns about, met from a new direction.

Re-gated against the three core changes:

    5 m/h                   dimitʰɑrɑ t͡sʼɛ ɬɑnɔ kʼɑ ɦɔrɑ    the rate still composes
    76s · 1 h · 100 l/h     still DECLINE — no half reading
    İ · İx · ẞ              agree

Differential re-run after the merge: **1,516 comparisons, 1,514 identical, 2 BLOCKED, 0 throws.**

## Recount

`la`, `mn` and `tn` merged first, so main is at 130 / 25,627 and this branch is **131 languages /
25,827 rows**.

## Gates

    csharp tests            2,152 pass (66 in SesothoTests.cs), 0 fail
    parity, st              200/200 byte-identical, 0 differ, 0 BLOCKED
    parity, fleet           131 languages, 25,827 rows, 0 differ, 0 BLOCKED
    differential            1,516 comparisons (sync + async) — 1,514 identical, 0 wrong, 2 BLOCKED on
                            `georgian`, RE-MEASURED after the merge rather than carried forward
    leak sweep              0 of 758 outputs carry a raw digit or symbol
    typescript              unchanged
