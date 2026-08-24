# C# port — state as of 2026-08-24

Resume here. Read `PORTING.md` first; it is the contract and it has been amended five times — most recently to REVERSE the "keep comment text" rule.

## Done

| | |
|---|---|
| Scaffold | `Vernacula.Phonemizer` (net10.0) + xunit tests + `tools/parity`, solution wired |
| Core | **26 of 28** TS core modules ported, ~6,300 lines, `dotnet build` clean |
| `JsRegex.cs` | the pattern translator (407 lines) — **all** regexes route through it |
| `DataPath.cs` | resolves the shared root `data/` tree; mirrors `src/core/dataPath.ts` |
| `Registry.cs` | 859 lines, self-registration (`Registry.Register("thai", () => …)`); languages slot in without editing it |
| Goldens | 109 files in `csharp/goldens/` (100 FLEURS-text, 9 lexicon-only). ⚠ ASYNC-MODE output — the gate calls `PhonemizeAsync` |

## State

- **Core: 28/28 done.** The regex translator is differentially verified against Node (118,014 results, 0 diff).
- **Languages: 55 of 182** — en, af, el, qu, ru, kl, mi, ceb, am, oc, bg, or, ast, umb, kn, hi,
  cmn, es, ar, arz, pt, bn, as, fr, ja, de, id, ms, ur, pa, fa, tg, th, mr, te, ha, tr, ta, sw, yue, vi,
  ko, jv, it, gu, pl, uk, ro, nl, hu, yo, my, ln, ps, ml — all **200/200**. 11,000 rows, 0 differ. ORDER IS
  DESCENDING SPEAKER POPULATION (user direction), from `tools/language-catalogue/languages.db`: next om, uz,
  sd, su…
- **th is the first SPACELESS script.** `Core/Segment.cs`'s DAG maximal-matcher was already in place; Thai
  adds the TCC boundary constraint over it. The syllabifier is the largest single language file so far
  (716 TS lines) and its epitran-derived schwa rewrites are ORDER-DEPENDENT and NON-OVERLAPPING — see the
  ⚠ on rule 1, where the JS `filter` lookahead reads the PRE-filter array.
- **Every cross-engine dependency the goldens have is now satisfied** — the 65 self-contained goldens
  plus the 44 that route a foreign run to `en`/`ru`/`el` can all be gated as they land.
- `Languages/Bootstrap.cs` is the registration list: one line per ported language, plus the neural table.

## Next, in order

1. **Finish Core** (the two above), then `dotnet sln add csharp/tools/parity` — it is deliberately
   out of the solution so it cannot fail the build gate before the engine API exists.
2. ~~Differential regex harness~~ **BUILT AND RUN — CLEAN.** `tools/extract_regexes.mts` +
   `csharp/tools/regex-diff/`. 2,314 distinct patterns × 51 probes = **118,014 assertions**, all
   identical to Node, 0 patterns refused. Re-run with:
   `npx tsx tools/extract_regexes.mts && dotnet run --project csharp/tools/regex-diff`
   ⚠ Probes are chosen for the DIALECT GAP, not for plausible text — an ordinary-word probe set
   would pass with the gap wide open. The first run found SEVEN real defects in JsRegex, all fixed
   and pinned in `Vernacula.Phonemizer.Tests/JsRegexDialectTests.cs` (28 tests):
     - **Simple case folding.** JS /iu folds `\u017F`→s, `\u0345`→ι, `\u1C80-\u1C88`→modern
       Cyrillic; .NET IgnoreCase does none of them. French, Portuguese, Mindong and Lingala
       tokenizers all dropped a long s. Fixed with a MEASURED table (94 divergent pairs of 2,408) —
       `tools/measure_case_folding.mts` regenerates the measurement, and `JsRegexFoldTests`
       re-derives the .NET half at test time so a runtime casing change fails loudly.
     - **...but only under /u.** Legacy /i refuses non-ASCII→ASCII folds; applying the fold on `i`
       alone regressed `scottishgaelic/numbers.ts`. The harness caught the regression immediately.
     - **`[^\S\n]`** (4 patterns) and **`\p{ASCII}`** were refused outright — both are now
       translated (.NET class subtraction, and the trivial range).
     - **Astral members in a class** (`[\u{20000}-\u{2a6df}]`, cmn/ja/Adlam) were refused; they now
       become surrogate-pair alternations.
     - **`[]` is not the empty set in .NET.** An astral-only class emitted `[]|alt`, which .NET
       reparsed into a class matching LONE SURROGATES — so `[\u{1E950}-\u{1E959}]` matched every
       neighbouring astral code point. Found by a unit test, not the harness: no probe carried Adlam.
     - **Code points vs code units.** .NET's `\p{L}` matches neither half of an astral letter and
       `[^x]` happily matches half of one. Categories now carry an astral half (built from
       `CharUnicodeInfo`, so it cannot drift from the BMP half), and every "any character except"
       construct takes a whole pair.
     - **A negated class body must be emitted VERBATIM.** Excluding surrogates by appending to the
       body turned `[^a-]` into `[^a-\uD800-\uDFFF]`, reading `a-\uD800` as a range. Found by review,
       not by the harness: no pattern in src/ has that shape.
     - **Two advance rules.** JS global iteration skips a code POINT after a zero-length match but a
       code UNIT after a failed attempt; `Regex.Matches` reproduces neither, so `JsRe` drives the
       loop. Verified against Node on `/(?<![\p{L}])/gu`, which really does report a position
       INSIDE a surrogate pair.
   ⚠ PERF INVARIANT: astral alternations carry a one-class lookahead guard. Without it
   `[\p{L}\p{M}]+` ran **372 ms where plain .NET ran 16 ms** — a 23x tax with correct output.
   Asserted structurally in `AstralBranchesAreGuarded`.

3. **Languages — five ported and gated, 1,000/1,000 rows byte-identical.**
     - **en (English)** — 2,100 lines, 9 files: CMUdict lexicon, POS perceptron, n-gram OOV G2P, ONNX
       BiLSTM tagger, ARPABET→IPA allophony, 663-line normalizer.
     - **ru (Russian)** — 1,003 lines, 6 files: lexical stress dictionary, palatalization/iotation/voicing
       g2p, the case-ending ordinal notation (`1970-х`), and the Roman-numeral ORDINAL policy a century
       needs. First run was already 200/200 — and it turned Quechua's two blocked rows green, which is the
       dependency diagnostic paying for itself.
     - **el (Greek)** — 839 lines, 4 files: a context-sensitive scan (velar palatalisation, γ-nasal
       digraphs, prenasalised stops, synizesis with its lexicon), the case/gender ordinal endings, Greek
       alphabetic numerals, and the Latin-initialism reading Greek gives in Greek letter names. 200/200
       first run. It closes the last cross-engine gap: `The word λόγος` now reads its Greek run.
     - **af (Afrikaans)** — 1,191 lines, 7 files, ONNX tagger + two lexicons + Germanic morphology.
     - **qu (Quechua)** — 587 lines, 4 files.
   Defects found so far, all in shared infrastructure or the loader rather than in a language's own logic:
     - **The parity gate set `InvariantGlobalization`**, making `string.Normalize` a SILENT NO-OP; the gate
       reported the ENGINE as broken (qu: 20 rows instead of 2). The engine now refuses to start that way.
     - **The bootstrap ran only on the sync path**, so the FIRST `PhonemizeAsync` per process served the
       rule reading. Cost af one row of 200.
     - **A manifest key the camelCase policy mangles deserializes to the type's DEFAULT.** English's
       ARPABET block is keyed `AH`/`ER`/`IY`/`UW`; none survived, so `virgin` read *vd͡ʒɪn*. 42 rows.
       `ManifestMappingTests` now diffs every ported manifest's key set against the round-tripped object.
     - **A golden can depend on ANOTHER language's engine** through the script router, which CATCHES the
       failure. The gate names those gaps — scoped to PORTED languages, because a run-wide list named all
       105 unported goldens and buried the two entries that meant anything.
     - **`[ModuleInitializer]` is the wrong registration mechanism** for a library (CA2255).

4. **The bulk, in dependency order.** MEASURED over the 109 goldens, counting only runs whose script is
   not the language's own:
     - **65 goldens need no other engine** — bulk-portable in any order, gated immediately:
       `af ar ast az bs ca ceb cs cy da de en es et ff fi fr ga gl ha hr hu id ig is it jv kam kea kl la
       lb lg ln lt luo lv mi ms mt nb nl nso oc om pl pt ro ru si sk sl sn so st su sv sw tr tt uz vi wo
       xh yo za zu`
     - **40 need `en`** (non-Latin scripts with embedded Latin runs) · 3 need `ru` · 1 needs `el`
   `en`, `ru` and `el` are all ported, so EVERY cross-engine dependency the goldens have is satisfied.
   Nothing is blocked: the remaining 104 goldens can be ported and gated in any order.

5. **Goldens for the 84 uncovered codes.** `tools/gen_parity_goldens.mts` produced nothing for them
   — mostly regional variants (`en-GB`, `pt-BR`) and languages with no FLEURS text. Without a golden
   a language cannot be declared ported; find a text source or accept lexicon-only coverage.

6. **The remaining languages**, in dependency order, batched. 650 files / 111k lines / 180 directories.
   Import hubs first (hindi 10 dependents, serbian 8, sinitic 4, zulu/danish/bengali 3), each batch gated
   on its golden.

## Filed, not fixed

- **A LATIN-SCRIPT host never prewarms, so its delegated foreign words get the n-gram reading, not the
  BiLSTM one.** `phonemizeAsync`'s prewarm gate is on the text's SCRIPT MIX, and a Latin-script host
  (vi, mi, tr…) whose tokenizer declines a foreign Latin word still routes it to English — where the
  memo is empty. Surfaced while fixing the golden contamination: the old vi golden read
  `hesperonychus` as *hˌɛspɚənˈaᶦt͡ʃəs* (neural) only because another language had warmed the memo; the
  engine's own answer is the n-gram *ˈɛspɚˌoᶷnˌiːkəs*. Whether the gate SHOULD widen is a measurement,
  not a port decision, so both engines keep the current behaviour and this is recorded.

## ⚠ Things that will bite

- **`\d` is the single worst hazard**: 1,914 uses, JS ASCII-only vs .NET all-Unicode-digits, and the
  engine's native-digit architecture depends on the JS meaning. It is silent when wrong and lands
  hardest in the scripts we care most about. Never write a bare `\d` in a .NET pattern.
- **Goldens are the definition of done**, byte-identical. Not "close".
- ⚠ **Goldens are ASYNC-mode output** (`phonemizeAsync` → ONNX neural taggers). Comparing them
  against the sync engine reports 467 of 2,400 rows changed, all phantom. The C# parity runner must
  call the neural-capable path.
- ⚠ **Never regenerate goldens while the tree is moving.** The first set was generated *during* the
  `git mv` of 317 data files and came out half-and-half — silently, and it looked like a real
  regression in languages the branch never touched.
- **Fixes are bidirectional**: a bug found while porting is fixed in TypeScript FIRST (with a test),
  goldens regenerate, then C# implements the fixed behaviour. Never fix C# alone — a fix in one
  engine is a fork. Sites awaiting the TS half are marked `// ⚠ PAIRED-FIX PENDING:`.
- ⚠ **A MODEL SIDECAR IS DESERIALIZED BY THE MANIFEST OPTIONS**, so the camelCase policy mangles its keys
  the same way — and no manifest test covered `*.meta.json`. Persian's two seq2seq sidecars key the hidden
  size as capital `H`; it bound to 0 and ONNX rejected a zero-width hidden state. `ManifestMappingTests`
  now sweeps every sidecar in the data tree for a key the policy would rename.
- ⚠ **AN ORT BOOL TENSOR CANNOT BE BUILT FROM `byte[]` BY INFERENCE.** `CreateTensorValueFromMemory` reads
  the element type off the array and hands ORT a uint8 tensor, which the graph rejects; the element type
  has to be stated. `new ort.Tensor("bool", Uint8Array)` in JS does state it. The first bool mask in the
  port is Persian's seq2seq encoder mask.
- ⚠ **THE PARITY GATE MEASURES ONE PATH.** Both defects above were invisible to it: the fa golden runs the
  TAGGER, and the seq2seq (classical context restorer + word-level OOV restorer) is only reachable
  off-golden. Six off-golden probe modes against Node found them — normalize, sync, neural, classical
  context, modern context, and the tagger-absent fallback (run with the tagger files removed from a copy
  of `data/`).
- ⚠ **`"abc".includes("")` IS TRUE IN BOTH LANGUAGES, AND THE GUARD C# INVITES YOU TO ADD IS THE BUG.**
  Three languages now: German (four rules), Swahili (word-final ⟨w⟩ labialization), Italian (word-final
  ⟨s⟩ voicing — 18 golden rows, `james` → *jˈamez*). Every one is a `next ?? ""` handed to a membership
  test, where JS returns TRUE at end of word and the reading depends on it. `.NET Contains("")` is true
  too, so the FAITHFUL port is the bare call; adding `c != ""` looks defensive and silently deletes a rule.
- ⚠ **A COMPOSITION EXCLUSION DECOMPOSED IN SOURCE IS A TOTAL, DISGUISED FAILURE — TWICE NOW.** Bengali
  ড়/য় (#891, 400 rows) and Devanagari क़/य़ (mr, 200 rows). NFC cannot repair either; inside a regex class
  the extra character inverts a range and the type initializer throws, so the gate blames the engine.
  `LanguageInitializationTests` now builds EVERY golden-bearing language and phonemizes its first row, so
  a type-init fault fails one named test instead of 200 anonymous rows. ⚠ The obvious guard — banning
  decomposed exclusions outright — is WRONG: the TypeScript carries 94 on purpose.
- ⚠ **A MAPPED MANIFEST KEY IS NOT A READ ONE.** `ManifestMappingTests` proves a C# property CONSUMES each
  key; it cannot see a property nothing then reads. tg declared `numbers.and` and both engines carried their
  own literal copy of its value instead — agreeing, so no gate could fire. Reachability is a READING
  question (#901), which is what the correctness lens in `PORTING.md` is for.
- ⚠ **A LOCAL RULE AND THE SHARED TIER CAN DISAGREE ABOUT THE SAME SENTENCE.** Ukrainian declares a FOURTH
  count form for the shared symbol tier (the genitive singular a decimal governs, `1,5 км` → *кілометра*),
  and the three unit rules it keeps locally — м, м/с, ° — each reached that slot a different wrong way: the
  metre rule TRUNCATED the count (1,5 → *метр*, 0,5 → *метрів*, two answers for one construction) and the
  degree rule read the FRACTIONAL digits as its count (`2,4 °` matched the `4`). Both engines agreed
  perfectly, and no golden row reaches any of the three, so only reading the two layers against each other
  found it (#920). When a language keeps a unit out of the shared tier, the agreement it declared there is
  the specification the local rule owes.
- ⚠ **A CHARACTER CLASS CAN BE A DUPLICATE AND LOOK LIKE A PAIR.** A separator class written with two U+0020
  characters is one space written twice, so a NON-BREAKING space walks straight past it. 296 sites across 44
  normalizers, swept in #925 (nl first, in #924); a guard test on each side now fails on the shape, verified by
  sabotage. No golden moves — the corpora's NBSPs do not sit in those slots — but constructed input showed real
  repairs: nb read `1<NBSP>000` as *one zero*, zu lost a magnitude, sw read `1000<NBSP>BC` as a cluster.
- ⚠ **MEASURE A FLEET PROPERTY BEHAVIOURALLY, NOT BY READING SOURCE.** #935 asked how many engines group a
  numeral only on an ASCII space. A source scan said ~5; running every engine against the four space
  characters said **57 of 192** — a rule can be narrow in a shape the scan does not model (a unit lookbehind, a
  tokenizer alternative, a `GROUP_SPACE` constant). After widening them all it is 1, and that one (bo) differs
  in PAUSES rather than digits. The same instrument then licensed dropping the `&nbsp;`→ASCII fold that had
  been working around the defect since before the port.
- ⚠ **A STALE `PAIRED-FIX PENDING` MARKER IS A FORK THAT DOCUMENTS ITSELF AS FIDELITY.** The shared symbol
  tier's C# side kept the doubled class under a marker saying the fix belonged in the TypeScript — where it had
  landed already, in #877. The parity gate cannot see such a fork (no golden groups with a NBSP); a SEPARATOR
  DIFFERENTIAL over every ported language did, with sw reading `1<NBSP>000 km` unit-postposed against the TS's
  prefixed form. When a marker's TS half lands, the marker is the thing to grep for.
- ⚠ **AN INVISIBLE CHARACTER CAN BE THE WHOLE SEMANTICS OF A LINE.** Burmese's segmentation guard joins its
  two syllable sequences on U+0001 so the comparison is of the SEQUENCE and not of the concatenated text; the
  character was written literally, so the file reads as `join("")` and the port faithfully copied what it could
  see. Neither the 200 golden rows nor 24,402 off-golden probes distinguish the two — the LITERAL-INVENTORY
  AUDIT did, by counting code points per file. Escaped in both engines now (#931). Run the audit on every port,
  and read a control character as a design decision rather than noise.
- ⚠ **A REACHABILITY SWEEP MEASURES THE PROBE AS MUCH AS THE KEY.** Sabotaging each manifest value in turn and
  re-running a probe is now the standard correctness lens (it found #922, #937, #939) — but the FIRST ps sweep
  reported four dead keys that were merely unprobed: the 40/80 tens and the 22-29 compounds, none of which the
  30-shape probe reached. Widening to every integer 0-120 left exactly one real corpse. State the probe's
  coverage before believing its silence.
- ⚠ **A COMMENT COPIED INTO THE PORT IS NOT A SECOND WITNESS.** PORTING.md originally said to carry TS comment
  text verbatim, and 54 languages later that was 18,857 comment lines — 36% of the C# tree, Quechua at 352
  comment lines over 84 of code. None of it is evidence the TypeScript does not already hold, and all of it is
  a second place a TS-first fix has to land. The rule is now inverted (see PORTING.md "Comments"): a 2-4 line
  header pointing at the TS module, and inline comments ONLY where their absence would let an editor "improve"
  the port into a divergence. ⚠ The nine files where the C# is the ONLY home for its reasoning — DataPath,
  Foreign, LoadManifest, LoadTsv, Onnx, Geez, NormalizeSymbols, Unicode, Registry — were held out of the
  mechanical sweep by hand; a pointer to a TS file that never had the answer is worse than the bloat.
- ⚠ **A SILENT `undefined` ON ONE SIDE IS A THROW ON THE OTHER, AND THAT ASYMMETRY IS THE INSTRUMENT.** The
  shared Dravidian composer sent the CRORE count to a function contracted for 1-999; above 10^10 it indexed
  `units[10]`, which JS renders as an empty string and `join` swallows, so 10^10, 10^12 and 10^15 all read
  as "hundred crore" with a leading space — one wrong answer for three quantities, in kn, ml AND te, with
  no error and no golden row to catch it. The C# indexer throws, so three off-golden probes announced it
  (#943). Chase every throw the port produces even where the TS "works".
- **Data lives in `data/`, owned by neither engine.** Both resolve the same keys. The generator
  tools under `tools/` write there too — that was a review catch, not something a test found.
