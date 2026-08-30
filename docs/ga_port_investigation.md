# Irish Gaelic (ga) — C# port investigation

Chronological log of the runs behind the ga port.

## Run 1 — 2026-08-30 11:40 — scope

    wc -l src/languages/irish/*.ts
        120 g2p.ts · 160 irish.ts · 31 manifest.ts · 371 normalize.ts · 114 numbers.ts   (796 total)

Five modules, the data manifest `data/languages/irish/irish.jsonc`, and a **7,578-line Connacht
pronunciation lexicon** (`data/languages/irish/lexicon.tsv`, lazily loaded). The load-bearing half is
the g2p: the BROAD/SLENDER axis, where every consonant's quality is set by its flanking vowel LETTERS
("caol le caol") and the velarized ⟨ˠ⟩ or palatalized ⟨ʲ⟩ form is emitted, with the vowel clusters a
separate longest-match lookup. Around it sit four passes in `irish.ts` — nasal assimilation, svarabhakti
epenthesis, the i-offglide, and first-syllable stress with unstressed short-vowel reduction.

`numbers.ts` is a bespoke compositor, not `westernNumberWords`: two numeral series (counting *ceathair*
vs attributive *ceithre*), the `a` particle, the h-prefix on the vowel-initial counting forms, and
initial mutation of the magnitude word (2–6 lenite, 7–10 eclipse). `normalize.ts` is the largest file
and carries twelve ordered steps, of which the Irish-specific ones are the `Nú` ordinal (with the
enclosed noun and the `t-` prefix), the `i.n.`/`r.n.` clock markers, the `A.D.`/`R.C.` eras, and the
`msu`/`km/u` rate denominators.

No shared-core change was needed. `Clauses`, `LoadManifest`, `LoadTsv`, `NormalizeSymbols`, `JsRegex`,
`HostWord`, `Initialisms`, `LatinPhones` and `Rewriter` are all ported, and `Registry.cs:417` already
routes `case "ga"` — the `Bootstrap.cs` registration was the only wiring missing. `csharp/goldens/ga.tsv`
(200 rows) exists, so the parity gate applied from the first run. Closest structural models read:
**Galician** (the most recent normalize-heavy port — its `Rewrite`/`JsRe.Replace` split is the shape
this one follows) and **Ewe** (the most recent port, for the layout).

`ga` HAS a FLEURS transcript (`ga_ie`, 1,948 unique sentences across dev/test/train), so PORTING.md's
widening (1) — the corpus-wide FLEURS differential — is available here, unlike the hil port.

## Run 2 — 2026-08-30 11:48 — first build + parity

    dotnet build csharp/Vernacula.Phonemizer            clean (only the pre-existing Marathi CS0108)
    dotnet run --project csharp/tools/parity -- ga      ga  OK  200 rows

200/200 byte-identical on the first parity run.

Three decisions worth recording, all made against the TypeScript rather than to a house style:

- **The g2p scan indexes UTF-16 CODE UNITS, deliberately.** The TS walks `w[i]` and `w.slice(i, i + 2)`
  on a JS string, which is code units, so an astral character arrives one surrogate half at a time and
  falls through the same branches on both sides. Spreading to code points here would be a divergence,
  not a fix — the lesson #1193 pinned for `afrikaans`/`georgian`.
- **`Manifest.Vowels`' INSERTION ORDER is load-bearing.** `G2p` sorts the cluster keys longest-first
  with `OrderByDescending`, which is a STABLE sort, matching JS's `Array.prototype.sort`; two keys of
  equal length keep the order the JSONC writes them in.
- **`Js.ToLowerCase`, not `ToLowerInvariant`**, per the #1116 rule.

## Run 3 — 2026-08-30 11:52 — the seam gates on the golden

    parity --poison ga        distinct poison sites: 0 (SUBSTRING 0, desync 0)
    parity --provenance ga    tokens 5791/5791 (100.0%)
    parity --ipaspans ga      tokens with IpaSpan 5322/5322 (100.0%), wrong 0

Clean — but the 200-row golden holds only **3 distinct texts** (it is heavily duplicated), so this
says very little. Re-run over a real corpus in Run 9.

## Run 4 — 2026-08-30 11:55 — the mechanical pattern diff

Every regex literal in `src/languages/irish/*.ts` extracted by a scanner, every
`JsRegex.Compile(...)` in the C# unescaped to its actual pattern string, and the two compared by
CODEPOINT and by FLAGS:

    TS literals: 67 (64 distinct)    C#: 66 (65 distinct)
    in TS, not in C#:  0
    in C#, not in TS:  1   →  /^[bcdfgmpt]/i

The single "extra" is an artifact of the TS scanner, not a real gap: `numbers.ts` writes it as
`return /^[bcdfgmpt]/i.test(w) ? …`, and the heuristic that separates a regex literal from a division
sign refuses a `/` whose preceding non-space character is alphanumeric — here the `n` of `return`.
Confirmed present in the TypeScript by grep. **Every pattern the port compiles is byte-identical to
its TypeScript counterpart, flags included.**

## Run 5 — 2026-08-30 11:57 — the mechanical table diff

Every hand-written table extracted from both sides as a map or a set of strings and compared:

    LETTER_NAME 26 · ORD_1_10 10 · UNIT_ORD 12 · TENS_ORD 13 · ECLIPSIS 6 · ECLIPSE 7
    WORD_ACRONYMS 11 · NOT_A_NOUN 32 · acronymLetters 27 · legalOnsets 40 · legalCodas 48
    digraphs 16 · SHORT 5 · BACK_V 2                                     — all identical

`legalCodas` lists `"nn"` TWICE in the TypeScript; both sides are sets, so both hold 48. The C# writes
it once.

The manifest itself needs no diff: both engines read the same `irish.jsonc`. `ManifestMappingTests`
gained `IrishManifestIsFullyMapped` — every key in the JSONC is consumed by the C# record.

The four remaining inline tables were read side by side: the decimal-unit map, the rate-unit map, the
compass map, and `ORD_UNIT_IN_COMPOUND` (`{...ORD_1_10, 1: "aonú", 2: "dóú"}`). All agree.

## Run 6 — 2026-08-30 12:00 — **THE DEFECT: a folded near-miss spoke the word "undefined"**

The decimal-unit rule's alternation is built from its own table's keys but the pattern carries `i`+`u`,
so JS's Unicode fold WIDENS it — `ſ` (U+017F LATIN SMALL LETTER LONG S) matches `s` — and a near-miss
can match while its key is absent from the table. The TypeScript asserted non-null and let
`String.replace` stringify the result. Measured, not reasoned:

    normalizeIrish("1.5 msu")  →  "1 pointe a cúig míle san uair"
    normalizeIrish("1.5 mſu")  →  "1 pointe a cúig undefined"      ← the word "undefined", spoken

This is exactly gl's #1122, in a language that had not been checked for it. It is a **defect producing
a READING**, so it is not a port-only concern: **both engines were corrected**, to refuse the whole
match. Pinned in both directions, in `test/irish.test.ts` and `IrishTests.cs`.

The three sibling sites were checked rather than assumed:

- **the rate-unit map** `(km|m|kg|mm|cm)` — no `s`, so `ſ` cannot reach it; `K` KELVIN does fold to
  `k`, but `"Kg".toLowerCase()` is `"kg"`, which IS a key. No miss branch. Left as an indexer.
- **the compass map** `[NSEW]` — `ſ` DOES match `S` under `i`+`u`, and the letter is upper-cased before
  the lookup. JS `"ſ".toUpperCase()` is `"S"`; .NET's `ToUpperInvariant` was **measured** to agree
  (U+017F → U+0053), so the fold resolves to the same word on both sides. Pinned as a test.
- **`LETTER_NAME`** — already `?? a` on both sides.

⚠ Also noted, NOT changed: in that same alternation `km` precedes `km\/u`, and `km` succeeds on
`12.8km/u` because the following `/` is not a letter — so the `km\/u` key is unreachable *there*. The
behaviour is identical in both engines and predates the port; recorded rather than silently "fixed".

## Run 7 — 2026-08-30 12:02 — the corpus differential

One process per side, `clearForeignOov()` once, rows IN ORDER, through `phonemizeAsync` — the shape
`tools/gen_parity_goldens.mts` uses. The C# side is an equivalent single-process driver.

Corpus: **2,165 unique lines** — 1,948 FLEURS `ga_ie` sentences (column 3, the RAW field, casing and
punctuation intact), 33 mined (`tools/corpus/mined/ga.jsonc`), 8 attest, 3 distinct golden texts, and
173 hand-built probes (one per normalize arm plus its adversarial neighbour, the g2p corners, the
number corners).

    C# text  vs TS text:   0 of 2,165 differ
    C# norm  vs TS norm:   0 of 2,165 differ      (the pre-pass alone — more sensitive; nothing
                                                   downstream can absorb a difference)

## Run 8 — 2026-08-30 12:05 — the g2p WALKED, not sampled

The g2p is a function of the scan position over an alphabet, so the space was enumerated rather than
sampled, at the WORD level in both engines.

**Full alphabet, 1–3 letters.** `a-z` + `áéíóú` + the apostrophe and hyphen `g2pWord` strips = 33
characters:

    33 + 33² + 33³ = 37,059 words     →  0 differ

**Class representatives, 4 and 5 letters.** One member per equivalence class the scan can distinguish —
both vowel qualities long and short (`a e i o á é í`), every lenition first element (`b c d f g m p s
t`), `h`, the liquids (`l n r`), and the apostrophe — 21 characters:

    21⁴ =   194,481 words             →  0 differ
    21⁵ = 4,084,101 words             →  0 differ

That covers exhaustively: every digraph and eclipsis adjacency, the word-final ⟨dh⟩/⟨gh⟩ deletion (which
needs length ≥ 3), the doubled-consonant branch, the longest-match cluster selection, `consonantSlender`'s
four arms including the onset-cluster scan and the coda fallback, svarabhakti, the offglide before both a
coda and an onset, the ⟨ng⟩ → ŋ assimilation with its final-ɡ absorption, and the stress + reduction pass.

**The lexicon, exhaustively.** All 7,572 keys, each also upper-cased and capitalised — 22,716 probes —
through BOTH entry points, which also pins `LoadTsv.LoadTsvMap`'s parse against the TS loader:

    phonemizeWord (lexicon first):    0 of 22,716 differ
    g2pWord       (rules only):       0 of 22,716 differ

**The composers, walked.** `numberToWords` over 0…200,000 exhaustively, plus every magnitude boundary
±2 and its first nine multiples, plus a stride to 10¹², plus the fallback arms (negative, fractional,
unsafe integer, non-numeric raw, `NaN`, `1e21`):

    326,324 number probes             →  0 differ

`ordinalWords` over 0…3,000 crossed with seven noun arguments (including the `NOT_A_NOUN` members and
the empty string), plus the magnitude boundaries and the out-of-range guards, with the C# `null`
rendered as JS's `String(undefined)` so the comparison is honest:

    21,126 ordinal probes             →  0 differ

**A generated haystack for the normalize arms** — each rule's shape crossed with its neighbours, so the
arm boundaries are walked rather than sampled: the `Nú` ordinal across five article forms × three noun
slots × 135 values, all 25 hours × 5 minute values × 8 marker spellings, the decimal grid × 13 unit
tails, the ranges across four dash spellings, the degree grid × 9 suffixes, the fractions 1–12 over ten
denominators, the rate grid, and the sign/era/initialism shapes both bare and in a sentence frame:

    4,055 generated lines, norm:      0 differ
    4,055 generated lines, text:      0 differ

## Run 9 — 2026-08-30 12:10 — the seam gates pointed at a REAL corpus

The golden holds 3 distinct texts, so the Run 3 gates were nearly blind. A 6,156-row reference was
generated **from the TypeScript engine** over the differential corpus + haystack and swapped in for
`csharp/goldens/ga.tsv`; both engines' gates were then run over it and the golden restored.

    parity ga                 6,156 rows OK, 0 differ    ← C# byte-identical to a TS-generated reference
    parity --poison ga        0 sites (SUBSTRING 0, desync 0)
    parity --provenance ga    tokens 72,956/72,956 (100.0%)
    parity --ipaspans ga      67,742/67,742 (100.0%), wrong 0

    tools/provenance-poison.mts ga            0 sites (SUBSTRING 0, desync 0)
    tools/provenance-coverage.mts ga --full   72,956/72,956 (100.0%)
    tools/ipa-span-coverage.mts ga --full     67,742/67,742 (100.0%), wrong 0

⚠ `--full` matters: `provenance-coverage.mts` strides to 8 rows by default and reported 62 tokens on
the same corpus. The token counts match EXACTLY across the two engines, which is the stronger reading
of the result than either percentage alone.

    tools/seam-parity.mts     ga absent from the disagreement table — TS `rewrite` count == C#
                              `Rewrite` count (22 of 137 ported languages disagree; this is not one)

Every `Rewrite` site in `Normalize.cs` is a genuine pipeline-string seam. The four inner calls whose
subject is a MATCHED RUN rather than the pipeline string — the `AD`/`BC` era inner replaces, the
dotted-capital mark strip — are spelled `JsRe.Replace`, and the poison gate confirms the split is right
rather than merely plausible. `Irish.cs`'s apostrophe/hyphen strip and `Numbers.cs`'s space collapse are
likewise `JsRe.Replace`: their subject is a word this engine composed, never the pipeline string.

## Run 10 — 2026-08-30 12:12 — leak sweep

No raw digit or symbol may survive into a reading:

    corpus   (2,165 rows)  TS: 0 · C#: 0
    haystack (4,055 rows)  TS: 0 · C#: 0

over `[0-9&%$€£¥°º±×÷<>=/¾½²³]`.

## Run 11 — 2026-08-30 12:07 — the full gates

    dotnet test (full suite)          4,281 pass, 0 fail   (46 Irish + 1 manifest mapping)
    parity (ALL goldens)              159 languages, 31,070 rows, 0 differ, 0 BLOCKED
    regex-diff                        124,812 probe results identical, 0 DIFFER, 0 threw
    npx vitest run (full suite)       290 files, 5,738 pass, 0 fail

158 → 159 languages and 30,870 → 31,070 rows, the +200 being the ga golden; nothing moved in the other
158. The TypeScript changed in exactly one place — the Run 6 defect — and its own suite covers it.

## Read for correctness — notes, nothing filed

- **g2p.ts — the docstring's promises are what the code does.** Word-initial eclipsis before everything
  (with `bhf` before `ng` before the two-letter table); the word-final ⟨dh⟩/⟨gh⟩ deletion, gated on
  `segs.length > 0` so a bare "dh" is not swallowed; the lenition digraphs; the doubled consonant; the
  longest-match vowel cluster with its ⟨eo⟩ no-glide flag; then the single consonants with
  `latinPhone` as the shared fallback and the ASCII-letter pass-through last. Every manifest table is
  REACHED: both quality maps, all nine lenition rows, all six eclipsis rows, every vowel-cluster key
  (the 5-letter walk enumerates all of them), all seven clause marks, and the whole `numbers` block.
- **normalize.ts — the twelve steps run in the documented order**, and three of the probes exist to hold
  that order still: the timezone hyphen ABOVE the clock (or the hyphen ends up between two letter runs
  and the g2p fuses them), the range rule's digit-anchored operands (or `1, -2` reads as a range), and
  the ordinal ABOVE the clock.
- **One faithful oddity, recorded rather than fixed.** `ordinalWords` composes 11–19 as
  `ORD_UNIT_IN_COMPOUND[n - 10]`, whose keys are 1–9 — the template would stringify `undefined` for a
  key outside that, but `n < 20` after `n <= 10` returned makes 11–19 the only reachable inputs. The C#
  uses an indexer, which would THROW rather than speak a word; the ordinal walk (Run 8, 0…3,000 × 7
  nouns) reaches every arm and neither engine takes that branch.
