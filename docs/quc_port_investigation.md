# K'iche' (quc) — C# port investigation

Chronological log of the runs behind the quc port.

## Run 1 — 2026-08-30 15:20 — scope

    wc -l src/languages/kiche/*.ts
         80 kiche.ts · 37 normalize.ts · 83 numbers.ts

The smallest shape the port has met: a longest-match grapheme scan (the ejective/aspirated series
lives in `kiche.jsonc`), a normalizer that is a single shared-core call, and a vigesimal composer
whose only context is the three score bases. `Registry.cs` already routes `case "quc": return
Create("kichee")` — only the factory was missing.

    ⚠ NO GOLDEN EXISTS, AND THE CORPUS-SOURCING GENERATOR CANNOT MAKE ONE.

No FLEURS split (`/mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/` has no quc), no mined
artifact (`tools/corpus/mined/` is empty of quc), no TSV under `data/languages/kiche/` (only
`kiche.jsonc`), and `kiche.ts` does not name the code `"quc"` — so `gen_parity_goldens.mts`'s
lexicon tier returns `[]` and the generator skips the language. The only K'iche' text in this
repository is the 127 human headwords of the English-Wiktionary referee
(`tools/referee-eval/referees/quc.wiktionary-kiche.tsv`), the same source the TypeScript engine was
brought up against (`docs/investigations/quc_native_bringup_investigation.md`).

⚠ **THE HAZARD LIST, WRITTEN BEFORE ANY CODE.** Each of these is a place where the C# spelling of a
JS idiom silently means something else:

  * `word.normalize("NFC").toLowerCase()` — `toLowerCase`, not `toLocaleLowerCase`: the C# side must
    be `Js.ToLowerCase` (the 28 code points `ToLowerInvariant` misses, #1116), applied AFTER the NFC.
  * `/\s/u` and `/\s+/u` — the ECMAScript WhiteSpace ∪ LineTerminator set (U+00A0, U+1680,
    U+2000–200A, U+2028/2029, U+202F, U+205F, U+3000 …), NOT `char.IsWhiteSpace` in either
    direction. The split must also `.map(phonemizeWord)` — a port that splits and joins without the
    recursion returns the input unchanged.
  * the longest-first `ORDER` is a STABLE sort: `chʼ` and `ch` are both two characters and only
    their declaration order in `kiche.jsonc` keeps `chʼa` from mis-reading as `ch` + `ʼa`.
  * `G[w[i]]` indexes by UTF-16 code unit. The token class is Latin + the apostrophe glyphs + `-`,
    all BMP, so unit iteration is equivalent to the C# `CompareOrdinal` bound-tested scan — but by
    the alphabet, not by accident.
  * `numberToWords(Number(m[2]), m[2])` — the RAW TOKEN goes along, because above 2^53 the double
    has already lost its low digits; and `[...String(...)]` spreads by CODE POINT, not UTF-16 unit.
  * the digit arm filters `c >= "0" && c <= "9"` on the spread string — in C# that is a first-code-
    unit compare on `Js.CodePoints`, which must not become a `char`-typed assumption.
  * the apostrophe normalisation (`/['’`]/gu` → ʼ) runs BEFORE the scan, so the glottalized units
    match — the order is NFC → lowercase → glyph fold.

## Run 2 — 2026-08-30 15:40 — the golden: the referee's headwords, not a corpus

`tools/gen_quc_golden.mts` (the `gen_variant_golden.mts` shape, with `clearForeignOov()` first)
renders the 127 referee headwords in referee order, plus two of the same words in the ASCII
apostrophe the referee never uses (`k'iche'`, `q'o` — the glyph-fold arm pinned in the golden
itself), plus 46 numerals covering every composer arm: 0–20, the score+unit joins (21, 42, 61, 81),
the band tops (99, 399, 3999), the base switches (40, 60, 80, 100), the `q'o'` multiples (400, 800,
1000 = `kaq'o' lajk'al`), the ≥4000 digit-by-digit fallback (4000, 5000, 9999, 12345, 100000), and
`9007199254740993` = 2^53+1, which exercises the raw-token arm.

    npx tsx tools/gen_quc_golden.mts     csharp/goldens/quc.tsv: 175 rows
    (second run, diffed)                 byte-identical

⚠ SO THE GOLDEN IS THE REFEREE'S HEADWORDS AND A NUMERAL LIST, NOT A CORPUS. There is no FLEURS
text and no mined artifact for K'iche' in this repository, so the corpus-wide differential the
contract asks for is UNAVAILABLE for this language, and the off-golden probes of run 4 carry the
weight instead. The file is a parity pin over the 175 strings, not coverage of a K'iche' corpus.

## Run 3 — 2026-08-30 16:00 — build, tests, parity

    dotnet build csharp/Vernacula.Phonemizer.Tests      clean (1 pre-existing warning: Marathi CS0108)
    dotnet test --filter FullyQualifiedName~Kiche       46/47 pass — ONE REAL BUG, FOUND BY THE TEST
    dotnet run --project csharp/tools/parity -- quc    quc  OK  175 rows   (first gate run after the fix)

The one bug: the first draft split a multi-word phrase and joined the parts WITHOUT mapping them
back through `phonemizeWord` (the TS `.map(phonemizeWord)`), so `"abäj tew"` came back as the
input unchanged. The xunit suite caught it (`AMultiWordPhraseGetsOneStressPerWord`); the gate was
run only after the fix. 47/47 after.

    npx vitest run test/kiche.test.ts                  29/29 (TS side untouched, still green)

## Run 4 — 2026-08-30 16:05 — the off-golden probes, where the corpus would have been

`.probe/quc/probes.txt` — 49 lines, one per arm the golden does not carry — through BOTH engines
(TS `phonemizeAsync` via `.probe/quc/ts_async.mts`, C# sync AND async via `.probe/quc/Program.cs`):

  * clause punctuation: `. , ! ? … ;` and the COLON, which TOKEN does not claim
  * separator hygiene: all four claimed shapes (`1.234.567`, `1,234,567`, `12.5`, `1.23.45`,
    `5–7`) and the ambiguous single group `1.234` left alone
  * the numbers the normalizer does not claim: `-5`, `10 000`, `Q100`, `100%`, `100.`, `21, 40`,
    the 20-digit `99999999999999999999` (raw-token arm)
  * the apostrophe matrix: `K'ICHE'`, `k’iche’`, `k\`iche\``, `k'icheʼ`
  * the nativiser: `señal`, `Française`, `Oğuz`/`OĞUZ` (the fold to the base), and `İstanbul` —
    U+0130 is one of the 28 code points `Js.ToLowerCase` must map and `ToLowerInvariant` does not
  * stress edges: one vowel (`a`), two vowels (`ae`, the `at = nucleus` branch), `ay`
  * longest-match: `chʼchʼa` (the ejective unit must win over `ch` + `ʼ` on every repetition)
  * unicode whitespace inside a phrase (NBSP, tab), a decomposed combining mark (`a` + U+0301 + `b`
    against its precomposed twin), stray glyphs (`-`, `ʼ`, `` ` ``, `tew-`)
  * foreign names read by this engine: `Dios`, `Santiago de Guatemala`

    49/49 byte-identical TS ↔ C# (async), and C# sync == C# async on every row (quc is not neural)

## Run 5 — 2026-08-30 16:10 — the mechanical audits

    dotnet run --project csharp/tools/parity -- --poison quc
        distinct poison sites: 0 (SUBSTRING 0, desync 0)
        (expected: kiche's normalizer makes no Rewrite call at all — one SeparatorHygiene call)

    npx tsx tools/seam-parity.mts
        kiche   TS 0 · C# 0 · gap 0 · rawTS 0 · rawC# 0

    .probe/quc/patterns.mts   (the gn throwaway, retargeted)
        ws · wsRun · apostrophe — byte-identical after escape resolution
        tokenSplice  ['’ʼ`-]  identical
        tokenStatics + flags  identical, the spliced hole being hostWordRun with the same arguments

    dotnet run --project csharp/tools/parity -- --provenance quc   tokens 227/227 (100.0%) mapped
    dotnet run --project csharp/tools/parity -- --ipaspans quc     spans 227/227 (100.0%), 0 wrong

## Run 6 — 2026-08-30 16:12 — the full gates

    dotnet test (full suite)      4,633 pass · 0 fail   (47 of them quc, incl. the manifest-mapping fact)
    npx vitest run test/kiche.test.ts                 29/29

No correction was needed between the port and the gate: the 175-row golden was byte-identical on
the first run, and the 49-probe differential stayed at 0 differ. The hazard list in run 1 is what
kept it that way — the only thing found in the whole port was the missing `.map` in the
multi-word split, and it was the test suite, not the gate, that found it: the xunit expectation ran
before the first parity run, and the gate (which does carry `abäj tew` in the golden) was run only
after the fix.

⚠ **WHAT THIS PORT DOES NOT DO:** it does not touch `csharp/STATUS.md`, and by the time it merges
there is nothing to touch. That file was a dated snapshot ("as of 2026-08-28") whose count table had
not been updated since; #1205 retired it — the findings register moved into the investigation docs,
and the state it also carried is now asked of the engine:

    dotnet run --project csharp/tools/parity -- --unported

⚠ AND THAT FLAG IS WHY `quc` IS WORTH PORTING NOW. It reports the five codes that had NO GOLDEN, which
is the state that makes a language unportable — there is nothing to be byte-identical to. `quc` was one
of them; `tools/gen_quc_golden.mts` is what removes it from that list.

---

# PR review (#1204)

## Run A — 2026-08-30 16:10 — rebase, and the golden's provenance

Rebased onto main (1 behind: #1205, which retired `csharp/STATUS.md`). Build clean, `quc` 175/175.

⚠ **THE FIRST THING TO CHECK ON A HAND-ROLLED GOLDEN IS THAT IT REPRODUCES.** A generator nobody re-runs
is a golden nobody can regenerate after a legitimate TS change:

    npx tsx tools/gen_quc_golden.mts   →  byte-for-byte identical to the committed csharp/goldens/quc.tsv

175 rows, 175 distinct texts. The provenance claim in the header is accurate: 127 referee headwords + 2
ASCII-apostrophe spellings + 46 numerals, rendered through `phonemizeAsync` per the goldens' convention.
It is a **parity pin, not corpus coverage** — and it is what takes `quc` off the "NO GOLDEN" list, which
is the state that makes a language unportable at all.

## Run B — 2026-08-30 16:15 — patterns and the read

    TS literals: 3 (3 distinct)   C#: 3 (3 distinct)
    in TS, not in C#: 0     in C#, not in TS: 0

The two grapheme tables are shared via `kiche.jsonc`, so they cannot drift; `ORDER` is
`OrderByDescending(k => k.Length)` against the TS's `sort((a,b) => b.length - a.length)` — both stable.

Read for correctness, three things checked rather than assumed:

- **`Js.Normalize` from the start.** The raw word is NFC'd before the scan, which is #1199's shape; this
  port never had the defect.
- **The bounds test precedes `CompareOrdinal`.** `CompareOrdinal(w, i, key, 0, len)` with a length past the
  end compares only what is there, so testing afterwards is too late — the C# comment says so and the code
  does it.
- **The multi-word branch uses the untrimmed `word` on the non-split path**, matching the TS, which trims
  only for the whitespace TEST.

## Run C — 2026-08-30 16:25 — the walks, which carry the weight here

⚠ **THERE IS NO CORPUS.** No FLEURS split, no mined artifact, no TSV — so PORTING.md's corpus-wide
differential is UNAVAILABLE and the walks are the evidence.

    full alphabet (41 chars: letters + unit constituents + all three apostrophe glyphs), 1–3   70,643   0 differ
    16 class representatives, 4 letters + the MULTI-WORD branch                                65,558   0 differ
    astral + both surrogate halves × the letters, 1–3                                          11,109   0 differ
    the vigesimal composer, EXHAUSTIVE over 0…4,000 plus the fallback arms                      4,018   0 differ
    adversarial fuzz, 972 hostile lines                                        norm 0 · text 0

The multi-word rows are in the 4-letter walk on purpose: the split RECURSES per word, and no single-token
walk reaches it. That is the branch whose missing `.map(phonemizeWord)` the PR's own xunit suite caught.

The composer walk is exhaustive over its whole documented range rather than sampled, because the three
score bases (⟨winaq⟩, ⟨kʼal⟩, ⟨muchʼ⟩) and the ⟨qʼo⟩ multiples change over at values a sample can miss.

## Run D — 2026-08-30 16:35 — **the seam corpus builder crashed, and the first gate run was on a stump**

The first golden-swap reference came out at **271 rows** and the gates passed over it. That was wrong: the
builder had thrown `UnicodeEncodeError: surrogates not allowed` part-way through writing, because the fuzz
lines it was folding in contain lone surrogates and a `.tsv` is UTF-8. It had already written 271 rows, so
everything downstream looked green.

⚠ **THE SAME CLASS THAT HAS NOW BITTEN THIS HARNESS THREE TIMES** (#1193's UTF-8 file, #1195's JSON
string, this). Rebuilt with an explicit well-formedness filter — the surrogate class is covered by the
code-unit-transport fuzz, and a golden-swap reference is text:

    parity quc                 71,786 rows OK, 0 differ
    parity --poison quc        0 sites      provenance 74,520/74,520   IpaSpan 73,806/73,806
    provenance-poison.mts      0 sites      --full coverage: 74,520/74,520 and 73,806/73,806
    seam-parity.mts            quc absent from the disagreement table

The token counts match EXACTLY across the two engines. The normalizer makes no `Rewrite` call at all —
it is one `SeparatorHygiene` call — so poison 0 is expected rather than earned, and is recorded as such.

    leak sweep   fuzz 0/972, on BOTH engines

## Run E — 2026-08-30 16:40 — the stale note, corrected

The port doc explained that it deliberately left `csharp/STATUS.md` alone because "a sibling branch
removes the file entirely". That branch has merged (#1205), so the paragraph described a file that no
longer exists. Rewritten to point at what replaced it — and at the fact that `--unported` is what names
the codes with NO GOLDEN, which is the state `tools/gen_quc_golden.mts` exists to remove.

    parity --unported (after this port)   193 codes · 168 ported · 25 UNPORTED
                                          quc is gone from the list; 4 codes still have no golden

## Run F — 2026-08-30 16:45 — the gates

    dotnet test (full suite)          4,663 pass, 0 fail
    parity (ALL goldens)              165 languages, 32,139 rows, 0 differ
