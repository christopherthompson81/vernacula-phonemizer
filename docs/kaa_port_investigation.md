# Karakalpak (kaa) — C# port investigation

Chronological log of the runs behind the kaa port.

## Run 1 — 2026-08-30 ~13:30 — scope

    wc -l src/languages/karakalpak/*.ts
         96 karakalpak.ts · 237 normalize.ts · 62 numbers.ts   (395 total)

Three modules plus a 30-line manifest, the usual shape for a Kipchak Turkic, but the smallest in the
Turkic cluster: no shared-core change needed, no Roman policy, no initialism pass, no neural path.
`karakalpak.ts` owns the Turkish-style dotless-I casing (dotless capital ⟨I⟩→[ɯ] must lowercase to ⟨ı⟩,
not JS's dotted ⟨i⟩) and the oxytone stress that backs up over one onset consonant; `normalize.ts`
carries the pre-tokenizer pass with its signature refusals (the EM-DASH copula, the `+`-is-C++ digit
lookahead, the degree-gloss non-doubling); `numbers.ts` the Kipchak decimal with the ⟨eliw⟩ 50 and
⟨qırq⟩ 40 judgment calls.

`Registry.cs` already routes `case "kaa"` to `Create("karakalpak")`, and `csharp/goldens/kaa.tsv` (200
rows) exists, so the parity gate applies from the first run. The closest structural model read was
**Chuvash** (`Languages/Chuvash/`), and **Basque** for the digraph-table shape (`IReadOnlyList<string[]>`
in the jsonc, re-keyed to a whole-grapheme lookup — for two-letter keys that is exactly the TS test
`chars[i] === k[0] && chars[i+1] === k[1]`).

## Run 2 — 2026-08-30 ~13:50 — first build + parity

    dotnet build csharp/Vernacula.Phonemizer          clean after the two fixes below
    dotnet run --project csharp/tools/parity -- kaa   kaa  OK  200 rows

200/200 byte-identical on the first parity run. Two C#-only porting bugs were found and fixed before
the green run:

- **CS0136 — C# has no JS block scope for the enclosing block.** The TS `numberToWords` reuses `r`/`outp`
  in every branch; the last branch declares them at METHOD-BODY level, which encloses the `if` blocks
  above, and C# refuses a same-named local in a nested block regardless of source order. A minimal
  repro confirmed sibling blocks are legal (the `for`-loop intuition) but the enclosing-body declaration
  is what trips it. Fixed by renaming the final branch's locals to `rem`/`res` — the exact convention
  the Chuvash port used for the identical TS shape.
- **The digraph scan compared against the whole key, not the key's characters.** TS destructures
  `DIGRAPHS.find(([k]) => chars[i] === k[0] && chars[i+1] === k[1])` — `k` is the two-letter KEY and
  `k[0]`/`k[1]` its characters. The first C# draft compared `chars[i]` to `d[0]`, the WHOLE key string
  `"sh"`, so no digraph ever fired: `úsh` read *ˈysh*, `Ishan` *ɯsˈhɑn*. The gate did NOT catch it —
  the golden's 200 rows happened to carry no word where the digraph reading and the two-letter reading
  differ after stress — but the unit tests did (`úsh`→*ˈyʃ*, `Ishan`→*ɯˈʃɑn*). Fixed the Basque way:
  re-key the pair list to a `DIGRAPHS` lookup on the full grapheme (`c + nx`).

## Run 3 — 2026-08-30 ~13:55 — the tests, pinned to the reference

`KarakalpakTests.cs` is the portable half of `test/karakalpak.test.ts` — 29 cases across 12 theories
plus `KarakalpakManifestIsFullyMapped`: the written uvular series, the front vowels, the dotless-I
casing (all-caps and dotted-capital forms), the numerals (8 rows through the text path), the
normalizer's arms (em-dash copula, comma/dot dual role, percent case suffix, the `+` guard, the
degree gloss with the Cyrillic scale letter, era marker, magnitude abbreviations, two-token square
measures, the clock and its hour bound), and the whole pipeline.

    dotnet test --filter "FullyQualifiedName~Karakalpak"   30/30

Every expected value is the TypeScript engine's own output: the source file `test/karakalpak.test.ts`
passes in TS (13/13, re-run as part of this log), which is the pin.

## Run 4 — 2026-08-30 ~13:58 — does kaa have a FLEURS corpus? (measured, not assumed)

    ls /mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data/ | wc -l          → 102
    ls ... | grep -iE "^kaa|^kar"                                               → (none)
    sqlite: select fleurs from languages where code='kaa'                       → 1

**kaa genuinely has no FLEURS split** — Karakalpak is not one of the 102 FLEURS languages. ⚠ This is
the #1102 class in the REVERSE direction: the catalogue flag claims `fleurs = 1` and the directory
says otherwise. The golden was therefore built from the mined tier (`tools/corpus/mined/kaa.jsonc`),
which is what the generator does when the FLEURS directory is absent. PORTING.md's widening (1) is
unavailable in its usual form; the weight falls on the mined + attest corpora plus the off-golden
probes. The stale catalogue flag is recorded, not fixed here — it is a data file, not engine code, and
nothing consumes it (the generator checks the directory directly).

## Run 5 — 2026-08-30 ~14:05 — the corpus differential, mined + attest

The mined + attest corpora were extracted to **745 unique lines** (1,002 raw; deduplicated, empty
dropped) and run through all four entry points: TS sync, TS async, C# sync, C# async.

    async (the golden's mode):   0 of 745 differ
    sync:                         0 of 745 differ
    ts sync vs ts async:          0 differ (kaa is rule-based; no neural path)
    cs sync vs cs async:          0 differ

No embedded-foreignRun carve-out was needed: the Latin-script runs in the retained text (city names,
the `Rembrant` line, the `C++` tokens) read identically in sync and async on both engines.

## Run 6 — 2026-08-30 ~14:12 — off-golden probes, targeting the arm gaps

The corpus's own coverage of each `normalize.ts` arm was measured, not assumed. **0-instance in the
corpus** (and therefore untested by the 745-line differential): the DOTLESS magnitude abbreviations
(`21 mln jılı`), the dotted `km.kv.`, `US$`, the NBSP/NNBSP/thin-space de-grouping (the corpus groups
on plain spaces only), the U+2212 minus, the Latin ⟨C⟩ scale letter (the corpus writes Cyrillic С),
`b.e.sh.` at a SENTENCE END (the final-dot retention), the short `t-ra`, the units `t`/`sm`/`ga`/`kvt`
standing alone, every number above 10⁹ (the milliard path), the zero-hour clock, and NFD-decomposed
input. A **160-line** probe file was built to hit those gaps plus the adversarial neighbour each arm
must decline (`12,34`, `1234,567`, `179,332 mlrd`, `198.51.100.0`, `26.02.1994`, `24:00`,
`14882:2011`, `8:5`, `C++`, `C++11 (14882:2011)`, `A+B`, `6+90 mm`, `(-32-38 °C)`, `8C`, `20 °Cx`,
`8-12C`, `1-2-3`, `255.255.255.0/24`, `96%ind`, `96%ken`, the 2^53 boundary at
9007199254740991/…992/…993, and a 21-digit numeral for the per-digit fallback):

    160 probes × {sync, async}   0 differ, 0 throws

## Run 7 — 2026-08-30 ~14:14 — leak sweep

    C# outputs (sync + async, 745 corpus + 160 probes):  0 carry a raw ASCII digit or a symbol
    TS outputs (same lines):                             0

No un-phonemized digit or sign leaks into either engine's phoneme stream over the combined set.

## Run 8 — 2026-08-30 ~14:16 — the mechanical pattern diff

Every `JsRegex.Compile` pattern in the four new files was extracted and compared against every RegExp
the TypeScript uses (the dynamic ones — `NOT_LETTER_BEFORE`/`NOT_LETTER_AFTER` interpolations, the
`MAG_NEXT` template, the `LATIN_RUN` template — expanded through the same constants both engines
share):

    24 C# patterns (23 static + TOKEN); every one present verbatim in the TS pattern set
    The U+2212/U+2013/U+2014 spellings use \u escapes where the TS literals carry the characters —
    the same convention the Chuvash port uses, and both spellings compile to the identical class.

The two tables the port COULD have hand-copied (letters, digraphs) are not copied: both engines read
the shared `data/languages/karakalpak/karakalpak.jsonc`, so they cannot drift. The symbol-tier data
(`procent`, the currency keys with `US$` declared ahead of `$`, the units, `kvadrat`/`kub` at
`position: before`, `hám`, the `mıń` magnitude) is the one hand-transcribed table; the 745-line
differential exercises every declared key except the four standalone units, which the probes cover.

## Run 9 — 2026-08-30 ~14:18 — the numerals, walked rather than sampled

The compositor's whole reachable space was enumerated instead of sampled:

    every n in 0…999,999 plus the million and milliard decades
    BOTH ENGINES MATCH ON ALL 1,000,011 ROWS

## Run 10 — 2026-08-30 ~14:20 — the seam gates

    --provenance kaa   5707/5707 (100.0%)
    --ipaspans kaa     4923/4923 (100.0%), 0 wrong
    --poison kaa       0 sites (SUBSTRING 0, desync 0)

The zero SUBSTRING count is the one that matters for this port: the de-grouping callbacks strip their
separators with `JsRe.Replace` on the CAPTURED side (off the seam), exactly as the TS callback's bare
`rest.replace` is off `rewrite()` — and the poison run over the golden confirms no seam site in the
new normalizer was handed a substring.

## Run 11 — 2026-08-30 ~14:22 — the full gates

    dotnet test (full suite)                 4,485 pass, 0 fail   (30 Karakalpak + 1 manifest mapping)
    parity, fleet                            162 languages byte-identical, 31,564 rows, 0 differ, 0 BLOCKED
    build                                    0 errors (one pre-existing Marathi warning, untouched)
    TS suite                                 test/karakalpak.test.ts 13/13

TypeScript unchanged — both Run-2 bugs were C#-only porting errors, fixed in C# only per the
bidirectional policy.

## Run 12 — 2026-08-30 ~20:50 — rebase onto current main: the #1199 sweep caught this port

Main took three ports while this branch was in flight (kam, shi, and the #1199 lone-surrogate fix,
76 sites in 60 files). The rebase was clean, but the new
`LoneSurrogateTests.NoPublicSingleStringEntryPointThrowsOnALoneSurrogate` — a reflection sweep over
EVERY public single-string entry point in every language, which the pre-sweep tree had no equivalent
of — named exactly one site:

    entry points throwing on a lone surrogate:
    KarakalpakPhonemizer.PhonemizeWord

`PhonemizeWord`'s `word.Normalize(NormalizationForm.FormC)` is #1199's exact shape: JS `normalize`
never throws, .NET's refuses a lone surrogate, and the g2p is the per-word surface the tokenizer
usually keeps a surrogate half out of. The pipeline-string path (`Renormalize`) had already been fixed
in #1200, which is why `Phonemize()` itself did not throw — only the public word entry point did.
Fixed the way the sweep fixed its 76 sites: `Js.Normalize(word, NormalizationForm.FormC)`. For
well-formed input `Js.Normalize` is `s.Normalize(form)` verbatim, so the differentials re-ran and
stayed clean:

    corpus (745) sync AND async   0 differ
    numerals (1,000,011)          0 differ
    dotnet test                   4,614/4,614
    parity, fleet                 164 languages, 31,964 rows, 0 differ, 0 BLOCKED

TypeScript unchanged.

## Read for correctness — recorded, not fixed

- **The catalogue's `fleurs = 1` for kaa is stale.** Karakalpak is not in the 102-split FLEURS release
  and no `kaa_*` transcript directory exists; the generator's directory check is what the pipeline
  actually consults, so nothing misbehaves. A data-file correction belongs to the catalogue's own
  maintenance, not this port.
- **`8-12C` reads the ⟨C⟩ as [k], not "UNREAD" as the header says.** The header's claim is that no
  DEGREE reading is emitted (true — no scale word comes out), but the bare ⟨C⟩ then reaches the
  tokenizer as a one-letter word and the g2p's `latinPhone` fall-through reads it as [k] —
  `8-12C` → *sekiz, on eki k*. That is the engine's documented behaviour for any letter with no rule
  ("a letter with no rule still denotes a sound; dropping it deletes what the writer typed"), the same
  fall-through every Latin engine shares. The header's "left UNREAD" prose is imprecise rather than
  the code being wrong; both engines agree on the reading (probe line, 0 differ).
- **The percent-suffix set is the corpus's own and `ind`/`ken` are correctly declined.** `96%ind` and
  `96%ken` leave the suffix behind as a separate word (`procent ind`) rather than fusing it — the
  guard `(?![\p{L}\p{M}])` after the suffix class is doing its job, and the alternative `[ıi]n?`
  cannot match `in` inside `ind` without a following letter. Both engines agree.

---

# PR review (#1203)

## Run A — 2026-08-30 15:35 — **THE ONE DEFECT IS THE FILE THE PR DELETES**

The branch is up to date with main and its port is clean. The reviewable issue is not in the port: this
PR also deletes **`csharp/STATUS.md` (1,714 lines)**, with the note "the investigation docs and the code
cover it".

⚠ **THEY DO NOT.** Measured rather than assumed — every bold headline under the file's `## Filed, not
fixed` register, looked for anywhere under `docs/`:

    bold findings under "Filed, not fixed":  134
      found verbatim somewhere under docs/:   14
      NOT found anywhere under docs/:        120

and **14 investigation docs POINT AT the file** rather than reproducing it — `xh`, `chv`, `ht`, `lg`,
`rn`, `rup`, `bs`, `be`, `is`, `mag`, `mined_goldens`… Several say, in so many words, "the finding in
STATUS.md". Deleting it dangles those references and discards the content they defer to.

Examples of findings that exist ONLY there:

    · A LATIN-SCRIPT host never prewarms, so its delegated foreign words get the n-gram reading
    · pcm: an above-2⁵³ ordinal fallback that had never run
    · tl: `ika-N` moved the cardinal's stress
    · wuu: `string.Trim()` ≠ `String.prototype.trim`
    · Caret exponents drop fleet-wide
    · wuu `A&B` never reaches the letter-name rule

**Restored.** The file may well deserve to go — it is dated 2026-08-28 and the recent convention is that
ports do not update it (`is_port_investigation.md:117` records exactly that) — but retiring a
120-finding register is its own decision with its own migration, not a line item in a language port.

## Run B — 2026-08-30 15:40 — the mechanical pattern diff, in two halves

    TS literals: 20 (20 distinct)   C#: 23 static
    in TS, not in C#:  0
    in C#, not in TS:  3

All three are accounted for: two (`MAG_NEXT` de-grouping, `(\d)-j\s?\.`) are built with `new RegExp` on
the TS side and so are invisible to a literal scanner, and the third — `^\s*["»)']?\s*$` — is at
`normalize.ts:174`, where the scanner's regex-vs-division heuristic cannot see it.

⚠ **AND "0 TS-ONLY" DOES NOT PROVE THE DYNAMICS ARE PRESENT**, because the scanner never saw them. So the
13 TS dynamics were dumped by a RegExp-constructor hook and checked against the C#'s 34 compiled patterns
(reflection), after normalizing `\uXXXX` to the character:

    TS dynamic patterns NOT present in the C#:  0

⚠ The sentence-end literal is the shape where a stray `[` was once found in Faroese. Compared character
by character here: both engines carry `^\s*["»)']?\s*$` with flag `u`. Correct.

## Run C — 2026-08-30 15:45 — the differentials

One process per side, `clearForeignOov()` once, rows in order, code-unit transport.

    corpus (745 lines: 474 mined + 271 attest)          norm 0 · text 0
    generated haystack (546 lines)                       norm 0 · text 0
    numerals (0…200,000 exhaustive + the magnitude
              decades + a stride to 10⁹; 200,328)        0 differ

The g2p ENUMERATED over the alphabet the shared jsonc declares (32 letters + the two digraph
constituents), 1–3 letters, **plus the upper-case forms** — because the dotless-I casing is this port's
signature rule and a lower-case-only walk cannot reach it:

    45,329 words   0 differ

And the astral/surrogate walk, which is the class that found a defect in three of the last four ports:

    11,109 words   0 differ

⚠ **0, including the surrogate probes.** The PR states it fixed one `PhonemizeWord` site that the new
`LoneSurrogateTests` reflection sweep named after main took #1201. Confirmed: nothing throws.

## Run D — 2026-08-30 15:50 — the fuzz and the seam gates

    hostile fuzz (888 lines)   norm: 0 differ    text: 0 differ

⚠ **AND THE TIFINAGH RESIDUE IS GONE.** Every port reviewed before this one left 15–17 fuzz rows
differing on U+2D30–2D7F, because `shi` was unported (#1196). `shi` landed in #1202, so this is the first
port whose fuzz is clean on that class too.

A 1,291-row reference generated from the TypeScript over the corpus + haystack, swapped in for
`csharp/goldens/kaa.tsv`, both engines' gates run, golden restored:

    parity kaa                 1,291 rows OK, 0 differ
    parity --poison kaa        0 sites      provenance 33,761/33,761   IpaSpan 29,170/29,170
    provenance-poison.mts      0 sites      --full coverage: 33,761/33,761 and 29,170/29,170
    seam-parity.mts            kaa absent from the disagreement table (26 unported, down from 27)

The token counts match EXACTLY across the two engines.

    leak sweep   corpus 0/745 · haystack 0/546, on BOTH engines

## Run E — 2026-08-30 15:55 — the gates

    dotnet test (full suite)          4,614 pass, 0 fail
    parity (ALL goldens)              164 languages, 31,964 rows, 0 differ
