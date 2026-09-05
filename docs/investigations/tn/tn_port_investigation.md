# Setswana (tn) — C# port investigation

Chronological log of the runs behind the tn port. tn was picked as the next language by the queue's own
rule — descending speaker population among unported codes that have a golden: **14M (6M L1 + 8M L2)**, tied
with `st` and `nso`, and `nso` carries the catalogue's ⛔ verdict.

## Run 1 — 2026-08-27 13:00 — what is there to port?

    wc -l src/languages/setswana/*.ts
        35 manifest.ts · 373 normalize.ts · 42 numbers.ts · 202 setswana.ts = 652

Everything it imports is already ported — `Clauses`, `LatinPhones`, `HostWord`, `NormalizeSymbols`,
`LoadManifest` — so **no shared-core change was needed**, and `Registry.cs` already routed
`case "tn": return Create("setswana")`.

The engine is a pure greedy longest-match scan (Setswana is open CV, so there is no coda or syllabification
logic), and the whole of the interesting behaviour is in the two-pass normalizer around the shared symbol
tier: `NormalizeSetswanaPost(SYMBOLS(NormalizeSetswanaPre(input)))`.

Porting notes, all of which the contract already covers:

  · **The tier data is the port's bulk.** `unitPrefix` and `currencyPrefix` are both on, `unitPer` is `ka`,
    `rateDenominators` gate `h`/`s`, `exponentWords.position` is `before`, and there are deliberately no
    `magnitudes`. Every one of those switches exists in `SymbolData` already.
  · **`GRAPHEME_KEYS` is a length-descending sort of a JS `Object.keys`.** Ported as `OrderByDescending`,
    which is stable, over a `Dictionary` that keeps insertion order — so equal-length keys keep the
    manifest's own order, which is what the greedy scan depends on.
  · **The prefix test was reordered on purpose.** `w.startsWith(key, i)` ports as
    `i + key.Length <= w.Length && string.CompareOrdinal(...) == 0`, with the bound check FIRST so a
    trigraph key can never be compared past the end of a short tail.
  · **Regex literals vs template literals carry different NBSP spellings in the TS**, and the C# keeps each
    as the TS has it: the `new RegExp(\`…\`)` patterns get the literal characters the template produced, the
    `/…/` literals keep their ` ` escapes. Extracted programmatically, not retyped.
  · **The `≥10⁶` digit fallback reproduces a JS quirk on purpose.** `N.units[Number(d)]` on a non-digit
    yields `undefined`, which `join` renders as the empty string; the C# does that explicitly rather than
    relying on `(int)double.NaN`.

**Parity: `dotnet run --project csharp/tools/parity -- tn` → 200/200 byte-identical on the first run**,
0 differ, 0 BLOCKED. 200 unique texts, unlike mn's 103.

## Run 2 — 2026-08-27 13:10 — does tn have a FLEURS corpus? (⚠ asked because mn's header was wrong)

The mn port found that `normalize.ts` claimed no FLEURS for a language that has one (#1099), so this was
checked rather than assumed:

    ls /mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/ | grep -E '^(tn|st|nso)'  →  nso_za only
    sqlite: select fleurs from languages where code='tn'                                  →  0

**tn genuinely has no FLEURS split.** So PORTING.md's widening (1) is unavailable, and the weight falls on
the two corpus artifacts plus hand probes — the la situation, not the mn one.

⚠ **But the same check over the whole fleet found the mn defect is not isolated.** Cross-referencing every
`normalize.ts` that states a language has no FLEURS against the transcript directory:

| language | claim | reality |
|---|---|---|
| lingala (ln) | "THERE IS NO FLEURS FOR LINGALA" | `ln_cd`, 1,920 unique sentences |
| lithuanian (lt) | "There is no FLEURS corpus for Lithuanian" | `lt_lt`, 1,966 |
| luganda (lg) | "There is no FLEURS corpus for Luganda" | `lg_ug`, 1,875 |
| maltese (mt) | "There is no FLEURS corpus for Maltese" | `mt_mt`, 1,960 |
| pashto (ps) | "THERE IS NO FLEURS FOR PASHTO" | `ps_af`, 1,804 |
| sepedi (nso) | "no wikipron, no kaikki, no epitran, no espeak, no FLEURS" | `nso_za`, 1,758 |
| mongolian (mn) | "There is NO FLEURS corpus for Mongolian" | `mn_mn`, 1,991 — already #1099 |

Each was confirmed to be real text in the right language and script (column 3, per PORTING.md's trap).
**Hebrew's header records the same error being found and corrected once already** ("THIS HEADER USED TO OPEN
'THERE IS NO FLEURS FOR HEBREW', AND THAT IS NO LONGER TRUE — `he_il` landed"), which is what makes this a
class rather than a one-off: transcripts landed, and the per-language headers were never re-swept. Filed as
**#1102**.

## Run 3 — 2026-08-27 13:15 — the differential

    .probe/tn/all.txt = 838 unique lines
        478  tools/corpus/mined/tn.jsonc + tools/corpus/attest/tn.jsonc
        360  hand-built (.probe/tn/gen_probes.mts) — one line per arm plus its adversarial neighbour
        200  the golden's own text
    × sync AND async = 1,676 comparisons, TS (.probe/tn/probe.mts) vs C# (.probe/tn/probe.csproj)

**Result: 1,676 comparisons, 0 differ, 0 throws on either side, 0 BLOCKED.** A separate sweep of every
output for a raw digit or symbol (`[0-9%$£°º²³×=&]` or a capital) returns **0 lines of 838** — nothing the
normalizer claims leaks through as itself.

What the haystack actually contains:

| construct | mined+attest (478) | golden (200) |
|---|---|---|
| any digit | 338 | 135 |
| comma group | 36 | 8 |
| period group | 4 | 2 |
| space group | 12 | 3 |
| decimal dot | 66 | 16 |
| decimal comma | 3 | **0** |
| percent | 40 | 8 |
| currency `$`/`£`/`P`/`US$` | 27 | 4 |
| rand `R`+digit | 3 | 1 |
| magnitude suffix `bn`/`M`/`m` | 5 | **0** |
| degree sign | 11 | 4 |
| degree + scale letter | 8 | 3 |
| negative degree | 5 | 2 |
| unit key after a digit | 24 | 5 |
| rate (`key` + `/`) | 4 | 1 |
| exponent | 3 | 2 |
| clock `d:dd` | 18 | 6 |
| clock **with a marker** | 4 | **0** |
| dash range | 31 | 18 |
| English ordinal suffix | **0** | **0** |
| HTML entity | 13 | 1 |

So the golden alone never exercises the decimal comma, the currency magnitude suffix or the clock's only
matching branch. ⚠ **And the English-ordinal step (7) has ZERO instances in BOTH artifacts** — it is argued
from the artifact's corpus-wide `ordinal-latin: 6346` cell, not from the retained text, which is the same
practice the rest of that header uses explicitly. Stated so the probe list is understood to be carrying it
alone.

## Run 4 — 2026-08-27 13:20 — reading for correctness

**FINDING 1 — step 8's "ONE KNOWN LOSS" is TWO, and the second is quoted in the same file.**

`normalize.ts` step 8 records that a range whose unit follows the SECOND operand is lost, because the tier
has already rewritten `5 kg` by the time the range rule runs:

> ⚠ ONE KNOWN LOSS, recorded rather than guarded away: `bokete jwa 4 -5 kg` … one instance did not earn a
> third pass.

There is a second, in `tools/corpus/attest/tn.jsonc`:

    Selekanyo sa metsi ke 12-13 m3 ka motsotswana.
      → sɪlɪkaɲʊ sa mɪt͡si kɪ lɪsʊmɪ lɪ bʊbɪdi dikʰubikimitara di lɪ lɪsʊmɪ lɪ bʊrarʊ ka mʊt͡sʊt͡swana .
         …………………………………………"twelve"  "cubic-metres"      "thirteen"           "per second"

— and **that exact sentence is quoted in this same file**, in the `unitPer` comment, as the attestation for
`ka motsotswana`. Two points, not one: the instance count behind "did not earn a third pass" is wrong, and
the reading is worse than the "bare juxtaposition" the comment prices it at — the first operand is stranded
in front of the measure noun of the second, so `12-13 m3` reads as one quantity phrase with a loose number
in front of it rather than as two operands with a missing joiner. Filed as **#1104**, not fixed: it is a
TS-first change and it moves goldens.

**FINDING 2 — the manifest's own numbers note contradicts the code by two orders of magnitude.**
`setswana.jsonc` says "Thousands (dikete tse …) best-effort; **≥10⁴** degrades to digit-by-digit";
`numbers.ts` says ≥10⁶ and the code is `n >= 1e6`. Executed:

    10000    → dikɪtɪ t͡sɪ lɪsʊmɪ            (composed)
    100000   → dikɪtɪ t͡sɪ lɪk͡χʰʊlʊ         (composed)
    1000000  → bʊŋwɪ lɪfɪla ×6              (digit-by-digit)

The code and `numbers.ts` agree; the manifest comment is stale. Filed with #1104.

Questions 2 and 3 came back clean: all three manifest tables are reached (`graphemes`,
`clausePunctuation`, `numbers` — `ManifestMappingTests` pins that structurally), `NATIVE_CLASS` `[a-zšêô]`
covers every grapheme key the table declares (checked, since a key outside the nativiser's class would make
the g2p reject a genuine Setswana word), and `text()` → `phonemizeWord` is the single entry point.

## Run 5 — 2026-08-27 15:20 — both findings landed upstream, and neither moved a byte

#1102 (the fleet-wide "no FLEURS" sweep) landed as #1107, and #1104 (this port's two findings) landed with
the same commit family — **both as DOCUMENTATION**, which is the right outcome for what each of them was:

  · **#1104's count and price were corrected in the TS, and the repair deliberately was not made.** The
    header now says "TWO KNOWN LOSSES", names `12-13 m3 ka motsotswana` as the second, and replaces "the
    bare juxtaposition the engine already produced" with the measured reading — the first operand stranded
    in front of the second's measure noun. The objection to moving the range rule still stands, so a repair
    means the rule LEARNING TO SEE an already-rewritten second operand, against a count of two. Priced
    properly rather than fixed, which is what the issue asked for.
  · **The stale `≥10⁴` note in `setswana.jsonc` was corrected to `≥10⁶`**, matching the code.

⚠ **SO THERE IS NOTHING FOR THIS BRANCH TO FOLLOW IN CODE.** Both upstream changes are comments; the C#
carries neither stale claim (checked by grep, not assumed), `csharp/goldens/tn.tsv` is unchanged, and
parity is 200/200 before and after the merge.

What the merge DID bring is two shared-core changes that reach tn: #1093's rate fix (an unreadable rate
now DECLINES instead of half-reading) and #1095's large-numeral work. Re-gated against both:

    116 m³/s     dikʰubikimitara di lɪ … ka mʊt͡sʊt͡swana     the rate still composes
    100 l/h · 76s · 1 h                                        still DECLINE — no half reading
    İ · İx                                                      now agree, via #1118's `Js.ToLowerCase` fix

Differential re-run after the merge: **1,676 comparisons, 0 differ, 0 throws.**

## Recount

`la` (#1096) and `mn` (#1101) merged first, so main is at 129 / 25,427 and this branch is **130 languages /
25,627 rows**.

## Gates

    csharp tests            2,085 pass (78 in SetswanaTests.cs), 0 fail
    parity, tn              200/200 byte-identical, 0 differ, 0 BLOCKED — unchanged by the merge
    parity, fleet           130 languages, 25,627 rows, 0 differ, 0 BLOCKED
    differential            1,676 comparisons (sync + async), 0 differ, 0 throws — re-run after the merge
    leak sweep              0 of 838 outputs carry a raw digit or symbol
    typescript              unchanged
