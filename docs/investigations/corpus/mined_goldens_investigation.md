# Sourcing parity goldens from `tools/corpus/mined`

The C# port is gated on byte-identical goldens (`csharp/goldens/<code>.tsv`). `tools/gen_parity_goldens.mts`
sources them from the ASR alignment ledger's `read_text` (FLEURS languages), falling back to the module's
own lexicon headwords. **84 codes get neither and ship no golden at all** — which is now the binding
constraint on the porting queue, since every unported language above ~22M speakers is in that set.

Question: can `tools/corpus/mined/<code>.jsonc` supply the missing text?

## Run 1 — 2026-08-25 21:45

**Command.** Parsed every mined artifact with `src/core/jsonc.ts` and cross-referenced the 84 empty codes.

**What a mined artifact holds.** Per language: `hard` — a list of `{cell, text}` excerpts selected
ADVERSARIALLY to challenge the normalization layer; `sample` — a uniform deterministic stride, which the
header states is the language's real distribution when the source is a dump. Both are raw running text
from a Wikipedia dump, which is the same KIND of thing the ledger's `read_text` is.

**Finding.** 60 of the 84 have an artifact; 24 do not.

    with a mined artifact       60
    without                     24   en-GB en-IN es-419 fr-CA pt-BR (the 5 accent variants, which have
                                     their own generator), the Arabic dialects apc apd acm afb ayl ajp
                                     acw, plus zsm pbt mto smj nog quc naq rkt bho bgc hne grc

Sizes are ample: 52 of the 60 have `sample` = 200 and `hard` between 115 and 263. The tail is thin —
`cjy` has 36/13, `hsn` 40/42, `bal` 40/51, `hmn` 40/73, `hil` 40/93.

**Implication.** Enough text exists in principle. What is NOT yet established, and is what run 2 must
check before any of this is usable:
  1. code-switch notation — the generator SKIPS ledger rows carrying `{en:…}` because `phonemize()` would
     voice the braces literally. Does mined text carry the same notation, or any other markup?
  2. row length — `segmentMode: paragraph` for the dump-sourced artifacts. A paragraph is not a sentence.
  3. foreign runs into UNPORTED engines. The `su` golden already hit this: two mined lines carrying
     Armenian and Khmer are `Registry.PortPending`, blocked rather than wrong. At golden-generation time
     that is fine for TS, but it puts a cross-engine dependency into the gate.
  4. whether the engine actually answers on these rows at all.

## Run 2 — 2026-08-25 21:55

**Command.** Filtered the pool (20–400 chars, dedup, markup rejected), then measured the four risks from
run 1 against 23,214 candidate rows across the 60 codes, and trial-generated 10 of them.

**1. Code-switch notation: a non-issue.** ONE row in 23,214 carries brace notation, and it is not the
corpus's `{en:…}` — it is MediaWiki's `-{zh-cn:…}-` language-conversion markup in `wuu`. The generator's
existing skip rule is aimed at the ledger; mined text simply does not have the problem.

**2. Markup leakage: real but small, ~1.2%.** Residual MediaWiki syntax survives the miner:

    [[ or ]]   124  0.53%   eu: "…beste argizagi askorekin batera.]]"
    {{ or }}    13  0.06%   hyw
    = heading   13  0.06%   ba: "== Тәслим =="
    | table      7  0.03%   tn: "| currency = Zimbabwe Gold …"
    url          6  0.03%   cjy
    <tag>        2  0.01%   rup

Cheap to reject, and it should be rejected: a golden row is text the engine is MEANT to read.

**3. Length is the real difference from the ledger, and it matters.**

    existing goldens (22,800 rows)   median 124   p95 215   max  366   >500 chars: 0
    mined, unfiltered                median 199   p95 805   max 1200   >500 chars: 3,958

`segmentMode: paragraph` — these are paragraphs, not sentences. A 1,200-character golden row is a bad
reference artifact: when it differs you get an unlocalisable diff. Capping at 400 chars keeps the artifact
comparable to what exists and still leaves plenty of pool.

**4. The engine answers. This was the cheap risk and it is clean.** 10 codes across scripts, 200 rows
each: 0 threw, 1 empty (a `cjy` row), all under 1 second per language.

**5. ⚠ THE BINDING CONSTRAINT IS FOREIGN SCRIPT, and it is much bigger than for the ledger corpus.**
Mined text is Wikipedia, which cites Latin-script sources and names constantly. Rows containing a run in a
script foreign to the host:

    chv 150/200   cdo 113   wuu 100   gan 97   hak 87   syl 74   chr 73   sat 62 …
    only 8 of 60 codes have ZERO such rows

⚠ My first measurement of this was WRONG and overstated it ~5x — I called `readerFor` on every word run,
but the registry only consults it for runs the host's own tokenizer DECLINES. Basque came out "en:3935",
i.e. every Latin word in a Latin-script language. Re-measured on script-foreignness, which is the property
that actually routes.

Targets pulled in, and whether they are gated today:

    en✓ cmn✓ ru✓ ar✓ el✓ ja✓ bn✓ ko✓ ta✓ hi✓ pa✓ th✓ or✓ jv✓ su✓      16 of 20 already ported
    ka✗ syl✗ he✗ hy✗ bo✗                                              5 not

Excluding foreign-script rows entirely still leaves: **40 of 60 codes at a full 200 rows, 54 at ≥100,
56 at ≥60.** The thin tail is cjy (17 clean), hsn (42), hmn (52), bal (57).

**Decision for run 3.** Order CLEAN rows first, then the rest, up to N. Deterministic (no dependence on
what happens to be ported today, which must not leak into a reference artifact), it front-loads the
self-contained rows so a golden is gateable as early as possible, and the residual dependency gets
reported the same way the gate already reports it for the ledger-sourced goldens.

## Run 3 — 2026-08-25 22:20

**Command.** Implemented the tier in `tools/gen_parity_goldens.mts` (mined between the ledger and the
lexicon), regenerated, ran the gate.

    before   100 FLEURS +  9 lexicon-only = 109 goldens, 84 empty
    after    100 FLEURS + 68 mined + 1 lexicon-only = 169 goldens, 24 empty

**⚠ First implementation made 8 existing goldens THINNER, and one of them was gated.** `ar`, `qu`, `su`,
`la`, `si`, `st`, `tt`, `za` were all lexicon-only, and the mined tier REPLACED their headwords with
running text. `ar`'s mined pool yields only 82 usable rows, so it went 200 → 82: trading 118 rows of g2p
coverage for 82 of normalization coverage. The two kinds of row pin different things and a golden may hold
both, so the tier now tops up from the lexicon. All eight are back at 200 and no golden anywhere got
thinner. `ar`, `qu` and `su` are gated and all three still pass byte-identically on the new content.

**⚠ THE GATE IMMEDIATELY FOUND A REAL C# DEFECT — the whole point of the exercise, on the first run.**

`pnb` came up **188 of 200 rows differing**. It had been ported all along; it simply had no golden, so it
had never been gated. The differences are all restored short vowels — *bˈaːəs* for *bˈaːɪs*,
*t̪əd͡ʒˈaːɾət̪* for *t̪ɪd͡ʒˈaːɾət̪*, *məɦd̪ˈoːd̪* for *məɦd̪ˈuːd̪* — which is the signature of the
harakat pre-pass not running.

Cause: TS `neuralRegistry.ts` carries `pnb: (t) => phonemizeRiderNeural(t, "pa")`, because the registry
code and the rider's model token differ for Western Punjabi. The C# `NEURAL` table had no `pnb` row. Its
SYNC engine is served (same Punjabi engine, the scanner auto-detects Shahmukhi), so it did NOT report
port-pending — `PhonemizeAsync` silently served the sync reading. That is exactly the failure
`Bootstrap.cs` warns about in its own comment.

Diffing the two tables rather than patching the one symptom: TS declares 13 neural entries, C# had 7.
Missing were `ckb da nb he km pnb`. Five of those languages are unported, so their absence is correct by
the file's stated contract. `pnb` was the only real gap. C#-only fix; the TS is right.

    pnb after the fix: 200/200
    full gate: 71 languages, 14,200 rows, 0 differ   (was 69 / 13,800)

Newly gated: `ary` and `pnb` — both already implemented in C#, neither previously gateable.

**Spot-check.** The rows are ordinary running text and they exercise normalization, which is what the
lexicon tier never could: pcm `April 6 1965` → *epɾal siks wan tauzin nain hɔndɛd an siksti faiv*.

## Run 4 — 2026-08-25 22:30

**Determinism.** A reference artifact that is not reproducible is not a reference. Two consecutive full
generations are byte-identical across all 169 files. The pieces that could have drifted: the dedup `Set`
(insertion-ordered in JS), the "own script" mode (a tie would be resolved by `sort`, but the partition is
`filter`-based and stable), and `clearForeignOov()` per language, which the generator already did.

**Suites.** 5,402 TS tests; C# **650**, up from 530 — `NumeralRangeTests` derives its language set from
`csharp/goldens/*.tsv`, so the 60 new goldens brought 120 new assertions with them, all passing. That is
the intended coupling and it is why that test reads the directory instead of a list.

**The remaining 24, and they are not a mining problem I can solve here:**

    en-GB en-IN es-419 fr-CA pt-BR    the 5 accent variants — `tools/gen_variant_golden.mts` owns these
    apc apd acm afb ayl ajp acw       Arabic dialects, served through ARABIC_VARIETY; no mined artifact
    zsm pbt mto smj nog quc naq
    rkt bho bgc hne grc               no module TSV and no mined artifact — genuinely sourceless

Each of the 12 in the last group is served by another language's engine (zsm by Malay, pbt by Pashto,
bho/bgc/hne by the Hindi family) and has no text of its own.

⚠ **"Closing them means a mining run" — WHICH IS WRONG, and run 5 corrects it.**

## Outcome

    goldens                109  →  169
    codes with no golden    84  →   24
    gated                   69  →   71   (ary, pnb — both already ported, neither previously gateable)
    gate                 13,800 → 14,200 rows, 0 differ

The porting queue is no longer blocked on corpus sourcing for the top of the list: pcm (121M), tl (88M),
wuu (83M), pnb (66M) and 56 others now have a golden to be byte-identical to.


## Run 5 — 2026-08-25 22:45

Prompted by a correction: those 24 are likely low-resource codes that will not turn up minable artifacts
at all, so "needs a mining run" is the wrong diagnosis. Checked, and it is wrong — the mining route is
already EXHAUSTED, not un-attempted.

**Command.** Read the `// source:` line of all 92 mined artifacts, and checked `attest`/`mined`/`terms`
coverage for the 19 non-variant codes.

**Finding: the miner already went well past Wikipedia, and documented where the road ends.** Of 92
artifacts, 83 are `<code>.wikipedia.org dump`. The other nine are the interesting ones:

    Wp/hsn      "the only Xiang corpus that exists — there is no <code>.wikipedia"
    Wp/cjy      "the only Jin corpus that exists — there is no <code>.wikipedia"
    Wp/mww      "no Hmong Wikipedia exists at any code: hmn, mww and hnj all fail to resolve;
                 Wp/hnj does not exist and Wp/hmn is a one-page note saying hmn is a macrolanguage"
    Wp-bcc      "SOUTHERN Balochi, the only Southern corpus that exists (no Balochi Wikipedia
                 exists at any code)" — and filter-by-language dropped 37.4% as Persian or Urdu
    Wp/hil, ilo  incubator and small-wiki dumps
    FLEURS zu_za, FLEURS yue_hant_hk

So the miner already reaches into Wikimedia Incubator and records, per language, that no wiki exists.
Of the 19 remaining non-variant codes, exactly ONE (`bho`) has any corpus artifact at all (an `attest`
file, no mined). These are not waiting for someone to run the miner. **They lack a dump-scale written
corpus in their own code**, which is a sourcing problem of a different kind — and speaker count does not
predict it: `apd` is 32M, `apc` 30M, `zsm` 80M.

The Arabic cluster makes the point cleanly: of the nine Arabic varieties in the fleet, exactly the two
with a Wikipedia — `arz` and `ary` — have mined artifacts. The other seven have none, and dialect Arabic
is written in speech and social media rather than encyclopedically.

**A route that DOES exist for some of them, and it is already built.** `tools/gen_variant_golden.mts`
re-renders a base language's golden TEXT through a variant's engine. Its own header is careful about what
that buys: it pins C#↔TS parity for the variant, NOT coverage of the variant's own corpus. Measured on 25
rows per pair, asking whether the variant's reading actually DIFFERS from its base:

    apc apd acm afb ayl ajp acw  <- ar    0/25 identical   each dialect engine genuinely transforms MSA
    bho <- hi                             0/25 identical
    rkt <- hi                             0/25 identical
    grc <- el                             0/25 identical
    hne <- hi                             9/25 identical   partially distinct
    zsm <- ms, pbt <- ps, bgc <- hi      25/25 identical   a byte-duplicate of the base golden

0 threw in all 14 pairs. So a variant golden is worth generating for the 11 that differ — the 7 Arabic
dialects most of all, since running MSA text through a variety reader is exactly what those engines are
FOR. For `zsm`, `pbt` and `bgc` it would only restate the base file, and "it has a golden" would imply
more than it delivers.


## Run 6 — 2026-08-25 23:05

**Command.** Generated the 11 variant goldens run 5 identified as worth having, via the existing
`tools/gen_variant_golden.mts`; skipped `zsm`, `pbt` and `bgc`, which read 25/25 identically to their base
and whose golden would only restate the base file.

**Distinctness, re-measured at full scale.** Run 5's sample said 0/25 identical for the Arabic dialects,
which OVERSTATED it: that sample was the first 25 rows of `ar.tsv`, which are mined running text, while
the file also carries lexicon headwords from the top-up — single words that rarely show a dialect feature.
Over the whole 200:

    apc 121/200 differ from ar      bho 200/200 differ from hi
    ajp 121                         rkt 200
    ayl 116                         hne 158
    afb 109                         grc 200/200 differ from el
    apd 113
    acw 113
    acm 105

So roughly 53–60% of rows carry a dialect-distinguishing feature, not all of them. That is the honest
number and it is still plenty.

**The seven dialects are also distinct FROM EACH OTHER**, which is the check that matters if seven goldens
are to be worth seven files rather than one. Pairwise rows differing, of 200:

    apc/ajp  15   ← the closest pair by far, and the linguistically expected one:
                    North vs South Levantine
    acm/afb  46   apd/acm 65   afb/ayl 65   acm/acw 66   afb/acw 78
    everything else 82–116

**Result.** All 11 pass the gate byte-identically on the first run.

    gate      71 → 78 languages, 14,200 → 15,600 rows, 0 differ
    newly gated: acm acw afb ajp apc apd ayl — the seven Arabic dialects, all served through
                 C#'s ARABIC_VARIETY table and none previously gateable
    bho, rkt, hne, grc now have goldens but are not yet ported to C#
    C# tests  650 → 672        TS tests 5,402, unchanged

Re-running the 11 generations produces byte-identical files.

⚠ **WHAT THESE 11 GOLDENS DO NOT CLAIM.** The text is the BASE language's corpus — MSA for the seven
dialects, Hindi for bho/rkt/hne, Modern Greek for grc. They pin C#↔TS parity for the variant's engine over
that text. They are NOT coverage of the variant's own corpus, and nothing here should be read as saying
the variant has been corpus-verified. `gen_variant_golden.mts` states this about its own output and the
same caveat carries to these files. For the Arabic dialects the gap is narrowest — a variety reader over
MSA text is precisely what those engines are for — and widest for `grc`, where Modern Greek text is a
long way from what an Ancient Greek engine exists to read.
