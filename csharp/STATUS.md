# C# port — state as of 2026-08-28

Resume here. Read `PORTING.md` first; it is the contract and it has been amended five times — most recently to REVERSE the "keep comment text" rule.

## Done

| | |
|---|---|
| Scaffold | `Vernacula.Phonemizer` (net10.0) + xunit tests + `tools/parity`, solution wired |
| Core | **26 of 28** TS core modules ported, ~6,300 lines, `dotnet build` clean |
| `JsRegex.cs` | the pattern translator (407 lines) — **all** regexes route through it |
| `DataPath.cs` | resolves the shared root `data/` tree; mirrors `src/core/dataPath.ts` |
| `Registry.cs` | 859 lines, self-registration (`Registry.Register("thai", () => …)`); languages slot in without editing it |
| Goldens | 185 files in `csharp/goldens/` — 100 FLEURS-text, 68 mined-corpus, 11 variant-derived, 5 accent variants, 1 lexicon-only. ⚠ ASYNC-MODE output — the gate calls `PhonemizeAsync`. ⚠ A VARIANT-DERIVED golden is rendered over its BASE language's text and pins C#↔TS parity only — it is not corpus coverage of the variant |

## State

- **Core: 28/28 done.** The regex translator is differentially verified against Node (118,014 results, 0 diff).
- **Languages: 136 of 193 registry codes**, all **200/200** except where a golden is thinner
  (cjy 29, hsn 67, ak 131 — those languages have no wikipedia and no FLEURS, or a thinner mined tier,
  so their goldens are what exists).
  **26,827 rows, 0 differ, 0 BLOCKED.** ORDER IS DESCENDING SPEAKER POPULATION (user direction), from
  `tools/language-catalogue/languages.db`.
  Ported: acm acw af afb ajp ak am apc apd ar ary arz as ast awa ayl az bar bg bho bm bn bo bs ca ceb cjy ckb cmn cs da de el en en-GB en-IN es es-419 fa ff fi fr fr-CA gan grc gu ha hak he hi hne hr hsn ht hu hy id ig it ja jv kk kl km kmr kn ko la lg ln lo mad mag mai mg mi ml mn mr ms my nan nb ne nl nso nya oc om or pa pcm pl pnb ps pt pt-BR qu rkt rn ro ru rw sd si skr sl sn so sr st su sv sw syl ta te tg th ti tl tn tr ug uk umb ur uz vi wo wuu xh yo yue za zu.
  ⚠ THE GATE NOW DISTINGUISHES **BLOCKED** FROM **WRONG**. A row whose embedded foreign run reaches an
  unported engine is counted and PRINTED separately, never as a diff — the verdict is per row and
  evidential (`Registry.ClearPortPending` is cleared before each row, because the set is process-wide and
  only grows). The count is 0 today: `he` was ported partly to clear syl's one blocked row, which it did.
  ⚠ `hy` IS PORTED, so the Armenian blocks in `ug`, `he` and `kmr` are cleared. `hyw` (Western Armenian) is
  a SEPARATE engine and still unported; no corpus row currently reaches it.
  ⚠ **THE QUEUE WAS BIFURCATED AND IS LARGELY UN-BIFURCATED AGAIN.** Every remaining language above ~22M
  speakers used to have NO GOLDEN, which made "no golden" the binding constraint on the port: a language
  with nothing to be byte-identical to cannot be ported at all. `tools/gen_parity_goldens.mts` now has a
  MINED TIER between the ledger and the lexicon fallback (see `docs/mined_goldens_investigation.md`), and
  the count went **109 goldens / 84 empty → 169 goldens / 24 empty**. pcm (121M), tl (88M), wuu (83M),
  pnb (66M) and 56 others are portable today. 169 goldens, 71 gated, so **98 unported languages already
  have one.** The 24 that remain are the 5 accent variants (own generator), 7 Arabic dialects, and 12
  codes served by another language's engine with no text of their own.
  ⚠ **THOSE 24 ARE NOT WAITING ON A MINING RUN — the mining route is already exhausted.** The miner
  reaches into Wikimedia Incubator and records per language where the road ends ("no Hmong Wikipedia
  exists at any code"; "no Balochi Wikipedia exists at any code"). Of the 19 non-variant codes exactly one
  has any corpus artifact. They lack a dump-scale written corpus IN THEIR OWN CODE, and speaker count does
  not predict it — apd is 32M, apc 30M, zsm 80M. Of the nine Arabic varieties, exactly the two with a
  Wikipedia (arz, ary) have mined text. What DOES work for 11 of them is the existing
  `tools/gen_variant_golden.mts`, and **11 of them now have one**: apc apd acm afb ayl ajp acw (over MSA),
  bho rkt hne (over Hindi), grc (over Modern Greek). All 11 pass byte-identically, and the seven dialects
  are distinct both from `ar` (105–121 rows of 200) and from EACH OTHER — closest pair apc/ajp at 15, the
  two halves of Levantine, which is the expected answer. zsm/pbt/bgc were SKIPPED: they read 25/25
  identically to their base, so a golden would only restate the base file and "it has a golden" would
  imply more than it delivers. **13 codes still have no golden.** See the investigation doc.
- **la's golden contains ZERO literal MACRONS**, and the macron is this engine's whole vowel-length system.
  `csharp/goldens/la.tsv` is MINED la.wikipedia prose, which is unmacronized, so the `long` table is reached
  in the gate only INDIRECTLY — through the number composer, whose output (`ūnus`, `mīlle`, `nōngentī`) is
  macronized by construction. Latin also has NO FLEURS SPLIT (it is a dead language), so widening (1) is
  unavailable in its usual form. The weight falls on the 493 mined strings + 422 hand probes: **1,830
  comparisons sync AND async, 0 differ, 0 throws**. `&c.`, currency, space-grouped numbers and the minus
  sign are likewise ZERO-instance in the golden and covered only by the probes. See
  `docs/la_port_investigation.md`, which also files the port's one reading finding — the word-final ⟨-Vm⟩
  rule nasalizes a diphthong OFFGLIDE (`Nicolaum` → *ˈnɪkɔɫaũ̯ː*), attested in golden row 43 and reproduced
  identically by both engines, so it is FILED (#1097), not fixed here.
- **mn's `normalize.ts` says Mongolian has NO FLEURS corpus, and it does** — `mn_mn` carries train+dev+test
  (3,982 unique lines) and `byid/mn_mn.tsv` 3,074 rows. That file argues its refusals from ONE source and says
  so explicitly, so the second corpus is not bookkeeping: on the CLOCK refusal the measurement inverts —
  15 of 15 distinct FLEURS sentences with a `d:dd` are times of day (18 instances), against the "would fix 2
  and claim 10" the mined artifact gave. Filed as #1099 and **since fixed upstream (#1113)**: the repair
  spends the COLON and emits no word, so it names no population and the "fix 2, claim 10" arithmetic — which
  prices a rule emitting `цаг` — does not apply to it. This branch carries it as step 3b.
  ⚠ mn's golden is also thinner than it looks — 200 rows, **103 unique texts**. The differential is
  **9,722 comparisons sync AND async, 0 differ, 0 throws**; currency, degrees, U+2212, Mongol bichig and the
  legacy ⟨ї⟩ codepage are ZERO-instance in BOTH the golden and FLEURS and rest on the mined artifact plus the
  hand probes. See `docs/mn_port_investigation.md`, which also files the stale core-defect claim at step 11
  (#1100 — the ASCII-liquid bug it calls live was fixed in `core/initialisms.ts`).
- **tn was picked by the queue's own rule** — highest speaker population (14M) among unported codes with a
  golden — and it has **no FLEURS**, checked rather than assumed after mn's header turned out to be wrong.
  The weight falls on the two corpus artifacts + 360 hand probes: **1,676 comparisons sync AND async, 0 differ,
  0 throws**, plus a leak sweep in which **0 of 838 outputs carry a raw digit or symbol**. The golden never
  exercises the decimal comma, the currency magnitude suffix or the clock's only matching branch, and the
  English-ordinal step is ×0 in BOTH artifacts (argued from the corpus-wide `ordinal-latin` cell, not the
  retained text). See `docs/tn_port_investigation.md`, which files step 8's "one known loss" as TWO (#1104 —
  the second is quoted in the same file's own `unitPer` comment).
  ⚠ **AND THE mn FLEURS DEFECT IS A CLASS, NOT A ONE-OFF.** Sweeping every `normalize.ts` that states its
  language has no FLEURS against the transcript directory: **ln, lt, lg, mt, ps, nso and mn all have one**
  (1,758–1,991 unique sentences each). `he`'s header records the same error being found and fixed once
  already, which is what makes it a class — transcripts landed and the headers were never re-swept (#1102).
- **st is the first port whose differential turns up a BLOCKED row rather than a clean sweep.** One mined
  line carries an embedded GEORGIAN run (`ილია`): TS reads it through the `ka` engine, C# drops it, and
  `Registry.PortPending` for that row is `[georgian]` — measured per line, not inferred. Georgian is unported,
  so this is BLOCKED, not wrong; it is not in the golden. **1,514 of 1,516 comparisons identical, 0 wrong,
  0 throws**, plus a leak sweep in which **0 of 758 outputs carry a raw digit or symbol**. st has no FLEURS
  (checked, not assumed) and the golden never exercises the currency-glued magnitude letter or the rate
  branch. ⚠ st and tn are CLOSE SIBLINGS ported back to back (trap 55): nothing was carried across, and every
  count in st's header was re-measured on st's own artifacts — all of them verify exactly.
  See `docs/st_port_investigation.md`.
- **nso is the port where the DIFFERENTIAL caught a bug the GOLDEN could not — and the numbers say why.**
  The TS unit pattern's separator class is `[ \u00a0\u202f\u2009]` as CHARACTERS (a template literal); written
  into C# through a shell heredoc the three non-ASCII members collapsed to plain spaces, so `1 kg` matched and
  `1\u00a0kg` did not. Measured with escape-only patterns: number+NBSP+unit is **×0 in the golden, ×0 in FLEURS
  and ×0 in the artifacts** — the only row in 4,265 that reaches the unit rule with a non-ASCII separator is
  ONE mined line writing `1&nbsp;kg`, which `core/markup.ts` decodes upstream. The gate was 200/200 with the
  bug live. Fixed, audited by CODE POINT across tn/st/mn as well, and pinned by a test verified to fail 5/5
  against the buggy class. ⚠ A literal NBSP typed into a heredoc — measurement scripts included — is the trap;
  spell the separators as escapes.
  ⚠ **AND nso IS THE SHARPEST INSTANCE OF #1102 YET.** Its `normalize.ts` declines a CLOCK rule saying "there
  is no instance to tabulate the marker distribution from", while `nso_za` carries 13 sentences / 16 instances,
  every one a time of day with an `am`/`pm`/`mesong` marker, each currently reading with a clause pause inside
  the time (`ka 11:35 pm` → *kʼa lesometʼee , masometʰaro ɬano pʼm*). `sepedi.ts`, two files away, cites those
  same FLEURS utterances as a referee that fixed a vowel defect (#1108). See `docs/nso_port_investigation.md`.
- **wo's separator classes were audited by CODE POINT before the first run**, because nso had just shipped a
  collapsed-NBSP bug there (#1109) — all of wo's are regex LITERALS in the TS, so the escapes carry through,
  and the audit found no all-ASCII-space class in any of the four new files. **8,118 comparisons sync AND
  async (3,312 FLEURS + 433 artifacts + 310 probes + the golden), 0 differ, 0 throws**; leak sweep 0 of 4,059.
  The golden exercises no degree, no dash range, no dotted era, no entity and no bare `&`, and the
  English-ordinal step is ×0 in ALL THREE sources.
  ⚠ **AND THE #1102 FAMILY APPEARS FROM A THIRD ANGLE.** wo's header never claims FLEURS is absent — it argues
  the CLOCK refusal from the mined corpus alone ("33 of 33 are SCRIPTURE REFERENCES … Zero clocks"). Over
  `wo_sn` the same shape is **8 of 8 a time of day**, four with an explicit `ci suba`/`ci ngoon`/`gmt` marker
  that no verse reference carries. The refusal's CONCLUSION survives (a bare-colon rule would still break 33
  to fix 8) but its premise does not, and a marker-keyed rule would fix 4 and claim 0 (#1111).
  See `docs/wo_port_investigation.md`.
- **fi's GOLDEN IS NEARLY BLIND TO ITS NORMALIZER, and that is measured rather than suspected.** Of the
  rules in `normalize.ts` plus the shared tier, **fourteen have ZERO golden coverage** — the ordinal range,
  dotted dates, the colon suffix on digits, the apostrophe genitive, every dotted abbreviation, degrees, the
  minus/plus, the relational signs, the ampersand, percent, currency, units, exponents and `×`. The gate
  proves the engines agree about 110 sentences of prose; everything else rests on the differential:
  **9,480 comparisons sync AND async (3,920 FLEURS + 430 artifacts + 385 probes + the golden), 0 differ,
  0 throws**, leak sweep 0 of 4,740.
  ⚠ **THE CLOCK'S MARKER GATE IS RIGHT AND ITS ADJACENCY IS TOO TIGHT** — FLEURS carries 37 clock instances
  and the `kello`/`klo` gate claims 29. The 8 it misses are a parenthetical UTC gloss, a range's second
  operand and a `Noin`-marked time, each inside a sentence where the rule already fired, each taking a
  SENTENCE BREAK mid-number. Widening looks free because the sports times are excluded by the TRAILING
  guard, not by the marker (#1114). See `docs/fi_port_investigation.md`.
- **su is the first LEXICON-ONLY golden to be gated with a second script.** `csharp/goldens/su.tsv` is a
  word list (no FLEURS text exists for Sundanese), so the corpus-wide differential is unavailable and the
  weight falls on off-golden probes: 269 adversarial lines + 471 lines lifted from `tools/corpus/mined/su.jsonc`,
  both sync and async, 0 diff. ⚠ The two mined lines that DO differ carry embedded Armenian and Khmer runs
  and are `Registry.PortPending: armenian, khmer` — blocked, not wrong.
- **sd is the second NEURAL language** (after af/fa): a per-letter BiLSTM restores the abjad's unwritten
  short vowels on OOV words. `Bootstrap.cs` installs the `NeuralRegistry` entry beside the sync engine, and
  `SindhiAsyncUsesTheTagger` pins that the async reading actually differs from the rule one.
- **nb is the third**, and the one where the tagger carries the most weight: 2,926 of 3,718 corpus lines read
  differently sync vs async, so a port registering only the sync engine would have missed almost every golden
  row rather than one. It is also the first port to need `LoadTsvMap`'s `fold` (#1068) — see the nb section.
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
   `csharp/tools/regex-diff/`. 2,310 distinct patterns × 51 shared probes PLUS probes DERIVED per
   pattern from the fold table = **124,586 assertions**, all identical to Node, 0 patterns refused.
   Re-run with:
   `npx tsx tools/extract_regexes.mts && dotnet run --project csharp/tools/regex-diff`
   ⚠ Probes are chosen for the DIALECT GAP, not for plausible text — an ordinary-word probe set
   would pass with the gap wide open. ⚠ AND THE SEAM PROBES ARE DERIVED, NOT AUTHORED. A curated set
   tests what someone thought of: this one carried an ISOLATED U+017F from its first run and still
   reported CLEAN on `\b` throughout, because that divergence lives at the SEAM between a long s and
   an ASCII letter (#1127). `derivedProbes` now reads `csharp/fold-pairs.json` — the same measured
   table `JsRegex` widens classes from — and emits, per pattern, the fold characters THAT PATTERN CAN
   REACH in every adjacency. It found #1129 on its first run. A new entry in the fold table becomes
   probe coverage with no edit to the extractor. The first run found SEVEN real defects in JsRegex, all fixed
   and pinned in `Vernacula.Phonemizer.Tests/JsRegexDialectTests.cs` (28 tests):
     - **Simple case folding.** JS /iu folds `\u017F`→s, `\u0345`→ι, `\u1C80-\u1C88`→modern
       Cyrillic; .NET IgnoreCase does none of them. French, Portuguese, Mindong and Lingala
       tokenizers all dropped a long s. Fixed with a MEASURED table (94 divergent pairs of 2,408) —
       `tools/measure_case_folding.mts` regenerates the measurement, and `JsRegexFoldTests`
       re-derives the .NET half at test time so a runtime casing change fails loudly.
     - **...but only under /u.** Legacy /i refuses non-ASCII→ASCII folds; applying the fold on `i`
       alone regressed `scottishgaelic/numbers.ts`. The harness caught the regression immediately.
     - **...and `/i` WITHOUT `/u` needs the opposite — NARROWING (#1129).** .NET's IgnoreCase
       equates U+212A KELVIN with `k`/`K`; JS legacy `/i` equates nothing non-ASCII onto ASCII. So
       `[a-z]` under `/i` matched a Kelvin sign in C# and not in Node. .NET cannot fold ASCII-only,
       and class subtraction runs AFTER folding (`[a-z-[\u212A]]` also removes k and K) — but the
       inline option scope `(?-i:…)` does work, so the atom is guarded from outside as
       `(?:(?!(?-i:\u212A))[a-z])`. ⚠ The GROUP is load-bearing: a bare `(?!…)k+` guards only the
       first k. Found by the derived probes below on their first run.
     - **...and the fold widens `\w` and `\b` too (#1127).** JS defines both over ASCII
       `[A-Za-z0-9_]` — except with `i` AND `u` set, where every character whose scf lands in that
       set joins it: exactly `\u017F` and `\u212A`. So JS sees NO boundary between a long s and a
       following ASCII letter, while .NET (whose `\w` is Unicode) did. French's name-initial rule
       read `ſt. Foo` as *té Foo*. ⚠ The harness had carried an ISOLATED `\u017F` probe from its first
       run and reported CLEAN throughout: a boundary defect needs the fold character ADJACENT TO an
       ASCII one, so the probe set now also carries `ſt. Foo`, `maſse Kg` and `aſ bK c` — written
       with U+017F and U+212A, which is the whole point of them.
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

### From the pcm/tl/wuu/bho batch (2026-08-25) — the first ports gated on MINED goldens

All four 200/200 on the first parity run. Gate **78 → 82 languages, 15,600 → 16,400 rows, 0 differ**;
C# tests 672 → 732. **pcm (121M), tl (88M) and wuu (83M) are the three largest languages in the fleet**,
and none of them had a golden a day earlier — they were unportable until the mined tier landed (#1022).

⚠ **THE DEFECT OF THIS BATCH RAN THE OTHER WAY: `Object.prototype`, and C# WAS ALREADY RIGHT.** Manifests
are indexed by TEXT, and `JSON.parse` returns objects that inherit `Object.prototype` — so
`specialWords["constructor"]` returned a FUNCTION. A `Dictionary` inherits nothing, so every one of these
was a TS-side bug and the fix moves TYPESCRIPT ONTO C#, the first time in the programme that direction has
been needed. Three agents hit it independently in three different tables:

    tl   #1026  specialWords → `w is not iterable` in tl/ceb/hil, `entry.cases is not iterable` in
                fr/fr-CA, `fin.replace is not a function` in nan, `seg.endsWith` in cdo. Fixed CENTRALLY:
                `parseJsonc` now applies a null prototype at the parse boundary, so all 184 manifests are
                safe at the source instead of at each call site.
    tl   #1026  ...and again in `loadJson`, the bare-`JSON.parse` sibling used for the 5.7 MB English
                models. `PosModel.tagdict["constructor"]` was a function, the `cached !== undefined` fast
                path fired, and the perceptron's prediction was silently replaced by the `?? "NN"`
                fallback — for all twelve prototype member names. C# always predicted.
    pcm  #1027  `DEF.lexicon["constructor"]` shipped `function Object() { [native code] } dɛ kɔm` into
                the phoneme stream.
    wuu  #1028  an inherited key was a valid RIME in wuu and yue: `phonemize("constructor1","wuu")`
                returned `"function Object() { [native code] }˥˧"`.

⚠ **THE GATE CANNOT SEE ANY OF IT** — no golden contains the word "constructor", and it is ordinary input
for exactly these languages (Tagalog and Naija code-switch with English constantly). Re-swept on `main`
after all four landed: **193 registry codes × 10 prototype keys, 0 hits**, and 810 cross-engine rows sync
and async, 0 differ. Issue #1030 filed the class as still-open with 11 engines affected; it was measured
before the rebase onto #1026 and is closed with that evidence. The remaining `loadJson` consumer,
`EnglishG2pModel.ngram`, is safe BY CONSTRUCTION — its keys are `${o}|${ctx}` and always contain a `|`.

Also fixed in this batch:

- **pcm: an above-2⁵³ ordinal fallback that had never run.** Brace-free `if (safe) for (…) if (wd) emit(wd);
  else {…}` binds the `else` to the INNER `if`, so above 2⁵³ the numeral was deleted:
  `9007199254740993rd item` → *aitam*. C# had the intended behaviour, so the engines disagreed only
  off-golden. Plus ⟨Thousand⟩ missing from the magnitude list (`US$500 Thousand` → *faiv hɔndɛd dola
  tauzand*, the stranded magnitude one scale below the documented `₦200 Million` case).
- **tl: `ika-N` moved the cardinal's stress**, provable from the repo's own data — `ika-4` → *ʔikaʔapˈat*
  while the same root one word later in `ika-104` → *ʔˈapat*. The prefix fuses onto the cardinal so the
  `stressPenult` root lookup missed. **2 golden rows moved** (the batch's only movement); the other 12
  `ika-N` rows are final-stressed roots and are byte-identical.
- **wuu: `string.Trim()` ≠ `String.prototype.trim`** (C#-only). .NET skips U+FEFF, JS strips it; .NET
  strips U+0085, JS does not. A BOM-prefixed Wugniu reading took the romanization path in Node and the
  ENGLISH FOREIGN READER in .NET. New `Js.Trim` shim. ⚠ 24 unaudited `.Trim()` call sites remain in the
  C# tree — each needs its own probe, and a blind sweep would be a behaviour change wearing a cleanup's
  clothes.
- **bho: six wrong claims in the shared manifest**, all header/comment text that would mislead the next
  reader — the file said "for Hindi (hi)", annotated ऐ/औ as *"Bhojpuri KEEPS the diphthong"* against ɛ/ɔ
  values `provenance` already retracts, and claimed ₹500 reads bare when it reads *pɑ̃t͡ʃ sɔ ɾupje*.
- **A repo gate that had been dead since the tree move.** `tools/check-manifest-headers.mjs` globbed
  `src/languages/**/*.jsonc`, but all 184 manifests live under `data/` — so it had exited 2
  unconditionally. Revived (#1029), and it immediately caught live header orphaning in `amharic.jsonc`.

⚠ **WHAT A MINED GOLDEN CANNOT DO, measured rather than assumed.** bho's golden is VARIANT-DERIVED from
Hindi text, and the agent counted its divergence triggers: ⟨ै⟩ 148/200, ⟨व⟩ 146, ⟨श⟩ 113, ⟨औ⟩ 107, ⟨ष⟩ 57,
⟨ण⟩ 39 — the grapheme layer is exercised hard, and all 200 rows differ from `hi.tsv`. But ⟨ऽ⟩ avagraha,
Bhojpuri's signature mark, is **0/200**, as is ₹. wuu's golden carries **2 astral code points in 200 rows**
while `dict.tsv` carries **260 astral keys** including 𠲎, an ordinary sentence-final particle. In both
cases the gap was the PROBE, not the language, and both agents synthesised the missing coverage. A mined
golden pins the common path well and says nothing about the rare one.

Found, not fixed, from this batch:

- **bho ⟨ऋ⟩/⟨ृ⟩ → ASCII `ri`** — an alveolar TRILL in a manifest whose only rhotic is ɾ (`कृष्ण` *krisn*
  beside `कर` *kəɾ*). Every sibling writes the tap.
- **bho ⟨अ⟩ ships [ʌ] while `inherentVowel` ships [ə]** — one phoneme, two symbols, and `provenance`'s
  declared inventory contains ʌ but not ə. **ʌ is in 99/200 golden rows**, so this is not obscure. Both
  need the 1622-pair grammar-mined referee, which is NOT in the repo (searched `tools/corpus/` and
  `/mnt/data`).
- **bho `बजकर` is unattested** (`tokenHits: 0`) yet the inherited Hindi clock rule emits it in 5/200 rows.
- **tl `numberStressIdx` strips `"ng"` from an /n/-final ligated root** — `sandaan` + `g` → `sandaang`,
  but the stripper removes two characters and recovers `sandaa`. Unreachable today (no /n/-final root is
  in `numbers.stressPenult`) and live the moment one is added.
- **Caret exponents drop fleet-wide** — `10^6` reads *ten* in pcm, ha, yo, sw and id. Shared-core.
- **wuu `A&B` never reaches the letter-name rule** — the symbol tier emits ` 搭 ` WITH SPACES, so the
  capitals are space-adjacent rather than Han-adjacent at step 14.

### From the ff/lo/zu/az batch (2026-08-25) — four ported, four agents, all 200/200 first run

⚠ Same caveat as the ledger below: the gate proves AGREEMENT. Every defect in this batch was found by
READING the source or by a purpose-built probe. **Not one was found by the gate**, and the two most
serious were invisible to the corpus differential as well.

Fixed in this batch (TS first, then C#, per the bidirectional policy):

- **ff — `Core/LatinPhones.cs` threw on half an astral letter.** A CORE defect, and the only C#-only one
  in the programme so far: Fula's g2p indexes UTF-16 code units, so an unmapped astral character reaches
  `LatinPhone` one surrogate at a time, and .NET's `Normalize` rejects an unpaired surrogate where JS
  returns it unchanged. `ArgumentException` on every Adlam line carrying an unmapped code point. The TS
  has no defect here (NFD is a no-op, `baseCh === c`, returns `undefined`), so there was no paired TS fix.
  No golden can move — the old behaviour was an exception.
  ⚠ **The corpus could not have found this.** FLEURS `ff_sn` plus `mined/ff.jsonc` plus `attest/ff.jsonc`
  hold **ZERO** code points in U+1E900–1E95F, measured not assumed. All 346 Adlam probe lines had to be
  synthesised from the tables in `fulaAdlam.ts`. This is the SECOND time an Adlam defect has escaped a
  differential for want of a probe carrying Adlam — see the `[]`-is-not-the-empty-set note above.
- **lo — the `Cຼ → Cl` onset branch was unreachable in both contexts where the ligature occurs.** The
  `[l]` was dropped and the leftovers re-scanned as EXTRA SYLLABLES. ⚠ That is an INSERTION, which a leak
  gate and a drop gate both miss by construction. Two arms: `reorder()` carried a cluster member across a
  leading vowel only for ⟨ຫ⟩ (`ເບຼຊິນ` "Brazil" → *beː˩.si˧˥n*; `ເກຼັກ` "Greek" → two syllables for one),
  and the coda lookahead claimed a coda-able consonant carrying the ligature (`ອະບຼາຮາມ` "Abraham" →
  *ʔa˧˥p̚.haː˧˥m*). The second arm hit `ກິໂລກຼາມ` — **the kg unit word `normalize.ts` itself ships** — so
  every "5 kg" read *ki˧˥.loː˥˨k̚.ma˧*. Four golden lines moved across three distinct texts, each a Cຼ loan
  recovering its `[l]`; the neighbours `ຫຼາຍ`/`ເຫຼັກ`/`ເວລາ` are pinned against disturbance.
- **zu — `kma` was a table row nothing reached.** `UNIT_WORD` declares `kma: "amakhilomitha"` with its
  corpus citation, and no pattern in the file spells `kma`; every alternation is `(km|mi|m|mm|cm|kg)` and
  the shared tier's key is `km`, letter-bounded. `1600 kma` → *kʼmˈaː* against `1600 km` →
  *amakʰilɔmˈiːtʰa*. Postposed like every other measure noun, and a preceding number is required: unlike
  `mph`/`kph`, `kma` is a MISSPELLING and could collide with a word. 0 golden rows moved.
- **az — five, all from reading, 0 golden rows moved.** (1) `X&Y` used JS `toLowerCase` rather than
  `azLower`, so dotless `I` folded to dotted `i` and `I&O` read *i və o* for *ı və o* — the same defect the
  initialism pass had already been fixed for, in an arm that was missed. (2) The era-marker
  end-of-string branch was DEAD: the idiom is Dutch's, where bodies omit their final dot and both branches
  append one, but these bodies carry their own, so the branch asked for `e.ə..` and a sentence ending
  "…məbəd e.ə." lost its terminal pause. (3) **`b.e.` read as BCE where it is the COMMON era**
  (*bizim eramız*) — every date it touched was three thousand years out; the corpus settles it with
  "(BE 1000-1300)", the Early Middle Ages. (4) `b.e.ə.` had no entry and `e.ə.` ate its tail, since a dot
  is not a letter and the lookbehind allowed it. (5) ⟨q⟩ and ⟨ğ⟩ had no letter name, and `spellOut`
  declines the WHOLE run if any letter is unnamed, so `HQ`→*hx*, `QVC`→*ɡvd͡ʒ* put raw ASCII in the
  phoneme stream.

⚠ **MOST OF THE "FOUND, NOT FIXED" LIST BELOW IS NOW FIXED** — see the ff/lo/zu/az follow-up section
after it. What survives is what needs SOURCING, and it is named there. The list is kept in full because
the evidence in each entry is what made the fix decidable.

Found, not fixed — all corpus-attested, both engines agreeing, no golden reaching them:

- **ff: `133m/s` reads *per hour*.** Rule 10's ternary is `d === "h" ? "gootel" : "gootel"` — two identical
  branches — so the declared `rateDenominators: { s: "sahaawa" }` is unreachable, and would compose wrong
  anyway (`unitPer` already contains "wakkati"). Corpus has one wind speed glossed three ways,
  `480 km/h (133m/s; 300mph)`. NOT FIXED: `gootel` is a noun-class concord agreeing with `wakkati`, and
  whether `sahaawa` takes it is a speaker's judgement.
- **ff: the 24h clock the docstring claims to handle has no rule.** Step 6 says "`0230 UTC` is handled here
  too"; every clock regex requires a colon, so the corpus's `9:30 fajiri (0230 UTC)` reads *two hundred and
  thirty*. n=1, and a bare `\d{4}` arm would also claim years.
- **ff: `STEM_ORD` keys `miliyon`/`milion` where `numbers.ts` emits `million`/`milyar`.** Two dead rows, and
  every ordinal ≥10⁶ falls through to the bare English suffix the header opens by saying the rule prevents.
  `milionaɓal` vs `millionaɓal` is an orthography question.
- **ff: the `¾`/`½` arms are unreachable** — `Unicode.FoldVulgarFractions` rewrites `1¾`→`1 3/4` upstream, so
  `1¾` reads *goo tati e nayi*, never the authored *goo e teemedere*. ×0 in corpus: two inert readings, not
  a mis-read.
- **lo: the degree rule loses its scale letter when the number is not directly adjacent, and the letter
  leaks as an ENGLISH LETTER NAME.** The mined corpus's own `(-4) - (0) c°` puts a bracket between digits
  and token, so `(0) c°` reads *suː˩n **sˈiː*** — "zero see", degree word gone. That is precisely the
  failure `normalize.ts` says the rule exists to prevent ("`20 °C` was reading as *saːw sˈiː*"), one bracket
  over. Related: the `(?![\p{L}])` guard is ineffective in its intended direction (`20 °Cx` declines arm 1
  but the bare-degree rule fires anyway) and in an unspaced script it rejects the ORDINARY case — trap 27,
  which this very file invokes for the symbol tier. The glued-to-Lao shape is ×0 in both haystacks.
- **zu: compound tone threading declines per-part lookup** — `phonemizeCompound` passes an explicit `""`, so
  a compound whose whole-word lookup misses leaves every part untoned. MEASURED before judging: 1,050
  compound tokens in the corpus, 29 with a part in `tone.tsv` while the whole word is not, and **27 of the
  29 are a concord prefix** (`isi`, `le`, `lezi`, `lo`, `lobu`) colliding with an unrelated headword, where
  toning would be WRONG. Only `kweNkosi`/`Nkosi` and `loMkhaya` are genuine misses. Current behaviour is the
  better trade — an instance of [[measure-dont-judge]].
- **zu: above 10⁹ the cardinal compositor repeats *izigidi***, because `zulu.jsonc` declares no word above
  *isigidi*. Needs sourced Zulu magnitude words.
- **zu: a stale comment over dead code.** Step 8c claims "`[+]?` is gone from both degree patterns"; it is
  still in the compass and bare-degree arms. Unreachable in practice, so a false comment over a vestige.
- **az: the SHARED Roman pass reads `Washington DC` as 600 in every language checked** — en *the six
  hundredth*, tr/az *altı yüz*, uz *oltı yuz*. `DC` is a canonical all-caps numeral appearing in text that
  is otherwise lowercase. A per-language `ROMAN_EXCLUSIONS` entry would paper over one language; the
  decision belongs in `core/roman.ts` and is therefore a FLEET call, not a port call.
- **az: a lone dotted initial** (`M. Bayramov`) correctly loses its dot, but the surviving single capital
  reads as bare [m] rather than the letter name *em* — the initialism pass needs a 2+ run. Shared shape,
  documented TS behaviour, not an az regression.

### The follow-up pass on those findings (2026-08-25) — nine fixed, five left to sourcing

Every entry below was fixed in TypeScript first with a test, goldens regenerated, then C#. **7 golden
rows move in total**, all one shape and all improvements. Full gate stayed 69 / 13,800 / 0 throughout.

- **`roman`: an all-caps abbreviation is not a numeral.** Reported as az reading `Washington DC` as 600.
  Neither an az bug nor a DC bug — the first instinct was to stoplist `DC`, which would have fixed the
  one token that happened to be reported. Counting instead: every all-caps canonical Roman numeral in the
  163 mined corpora that would convert, with contexts read. Below the genuine numerals (`II` ×657,
  `III` ×295, `IV` ×183 …) is a band of NINE tokens, 121 occurrences, **zero of them numbers** — DC, MV,
  MC, MD, CV, DV, LV, DX, CCC. `CV` mis-read loudest because it takes a preceding quantity: Somali
  `140 CV` read as `140 105`.
  ⚠ **English had the same hole from the other side and wider than reported.** Rule 7a accepts a
  Capitalized previous word as evidence, so every abbreviation after a name was a numeral: `Sony CD` →
  *the four hundredth*, `Detroit MI` → *the one thousand first*, plus `Boeing MD`, `Ocean Express MV`,
  `Honda CIV`, `Paris DX`. `cd` and `mi` were ALREADY in core's list; English simply was not consulting
  it. One list now, not two that drift. The stoplist applies only to the weak signal — a numbered-event
  noun still licenses a stoplisted token, so `Apollo XI` is 11 and `WrestleMania XL` is 40.
- **ff rates, ordinals and fractions** — all three of the dead tables. `/s` now DECLINES rather than
  asserting *per hour*; deleting the arm alone was not enough, because the shared tier then composed
  *e wakkati gootel sahaawa*, "per hour second". `unitPer` is now just the preposition and
  `rateDenominators` carries the noun plus its agreeing "one", which is what `per + dPhrase` can express.
  `STEM_ORD`'s magnitude keys are DERIVED from the compositor's constants so a rename cannot recreate the
  dead rows. The `¾` arm turned out to be worse than inert — `$1 e teemedere` is character-for-character
  the percent phrase, so `1¾` read as *one per hundred*.
- **ff/ha/ga: `1, -2` is a sign, not a range.** Open since before the om/uz batch. `(\d[\d,]*)` accepts
  `1,` — the SENTENCE comma — as a complete left operand, after which `\s*` reaches the minus. Same
  trailing-separator shape as #1015. Swept the fleet: exactly these three rules have it.
- **kk: a standalone zero was the empty string.** `UNIT_CARD[0]` is "" so a zero digit contributes no word
  positionally, but `orthographic(0)` returned that same empty string — so `00:43` read *қырық үш*, `0.5`
  read *нүкте бес*, and **`00:00` read as the empty string**. Restoring it exposed three more sites: the
  dot-clock-before-timezone rule emitted zero minutes (an existing test caught it), the case-suffix rule's
  `orthographic(n) === ""` out-of-range guard was catching zero by accident, and
  `denom === "сағат" ? "сағат" : "сағат"` — the Fula shape again, though CORRECT here.
  Separately, the dot-decimal rule rewrote its digits to words before the sign rule could find them, so
  `-1.5` read *бір нүкте бес*. The comma path never had it.
- **An initial may OPEN an utterance.** `LONE_INITIAL` required a preceding capitalised word, so
  `M. Bayramov` read `m . …` — a bare consonant and a stranded pause. Widening at `^` is safe because the
  documented false positive is a SENTENCE ending in a lone capital, and at the start there is no
  preceding sentence. 34 utterances across 18 corpora open with this shape and every one is a
  personal-name initial. **This is where the 7 golden rows move** — be, de ×2, es, it, lt, pl, all the
  same FLEURS sentence: `n . vˈaːyːnə` → `ɛn vˈaːyːnə`. Cyrillic `Н.` comes free.
- **cy/ga: a timezone-offset hyphen is a sign.** `GMT-00:43` fused into one word (*tˈidim*,
  *tʲˈeːn̪ˠɑːⁱdʲ*): the clock rule makes the digits words, the hyphen is then between two letter runs, and
  the g2p strips it. 10 corpus instances, 5 with a colon.
  ⚠ **FIXED PER-LANGUAGE, AND THE SHARED ATTEMPT FAILED FIRST — worth recording.** A boundary in the
  initialism pass broke three tests at once: **a hyphen between two letter runs is LOAD-BEARING.**
  Estonian attaches a case ending across it (`SKP-st` → *ess kaa peest*) while keeping a compound
  hyphenated but unspaced (`TGV-rongile`), a distinction it measured at 4 suffixes / 4 compounds;
  Mongolian does the same. Gating on a following digit does not rescue it either, because cy runs the
  initialism pass LAST — by then the digits are words. So it belongs before the clock rule, per language.
- **zu: the degree rules now hold the invariant step 8c claimed.** `[+]?` was gone from two of four
  patterns, not "both". Unreachable, so the readings were pinned first and are byte-identical.

**Left to sourcing, and these are the honest remainder:**

- **ff `133m/s`** — the concord form of "one" agreeing with `sahaawa`'s noun class. The corpus cannot
  settle it: all 16 `wakkati` instances are "time" in the general sense, not one a rate. `/s` declines.
- **ff's 24h clock** (n=1; a bare `\d{4}` arm would also claim years) and **`milionaɓal` vs
  `millionaɓal`** as an orthography question — sidestepped by deriving from the emitter, not answered.
- **lo's degree rule** loses its scale letter when the number is not adjacent (`(0) c°` → *suː˩n sˈiː*).
  Needs a corpus argument about how far number–unit adjacency should stretch; ×0 glued-to-Lao.
- **zu above 10⁹** repeats *izigidi* — needs sourced Zulu magnitude words. And **zu compound tone
  threading** stays as it is: 27 of its 29 candidates are concord prefixes where toning would be wrong.
- **kk's `orthographic` path loses three irregular readings** the manifest documents — *нөл* has ø,
  *жиырма* is final-stressed, *алпыс* has a clear l — so the restored zero reads [nˈɵl] where the digit
  reading is [nˈøɫ]. Pre-existing and shared by every orthographic-path word; closing it means teaching
  the g2p those three. Related: `1,05` and `1,5` read IDENTICALLY on both the comma and dot paths, a
  distinct-numbers violation whose fix needs Kazakh's convention for a leading-zero fraction.
- **cy/ga/az strip a lone initial's dot before the shared pass sees it**, so the `^` widening does not
  reach them; only `lt` and its ordering-peers benefit. Per-language rule ordering, not a shared fix.
- Still open from earlier: **`Washington DC` as an ORDINAL in languages with a roman policy** is now
  fixed, but **`az`'s lone dotted initial** reading bare [m] is the ordering case above; **°C with no
  sourced degree word** in pcm/za/ak; **U+2212 minus unsourced** for ak/bo/ltg/mos; **ha never reads the
  fractional part of a grouped decimal**.

⚠ **PROCESS, for the next fan-out: THE SCRATCHPAD IS SHARED BETWEEN AGENTS, NOT PER-AGENT.** Two of the
four agents collided in it. One had its probe `Program.cs` and `.csproj` overwritten mid-run by another
agent, repointing the project reference at a DIFFERENT WORKTREE — so its differential was silently
measuring someone else's build until it noticed. Any brief that tells an agent to build a scratch probe
project must also tell it to use a uniquely-named subdirectory and to re-verify the `.csproj` target
before trusting a number.

### From the hr port (2026-08-26) — ⚠ FOUR DEFECTS, AND NOT ONE MOVED A GOLDEN ROW

hr is a THIN module over the shared Serbian core (`PhonemizeWord`, `ForeignLetters`,
`NormalizeSerbianInitialisms`, `ComposeSlavicNumber`) and was 200/200 on its FIRST parity run, before any of
these were found. Every one came from READING, and every one is FIXED in both engines now — TS first, with
tests, goldens regenerated (0 rows changed, four times over).

- **⚠ A FIX DOES NOT PROPAGATE ALONG A SHARED CORE, AND THAT IS THE LESSON OF THIS PORT.** Three of the four
  are a sibling's finding that never crossed the module boundary, and in two cases the sibling's own comment
  CITES the Croatian corpus while leaving Croatian broken:
    · **#1059's `raw` threading.** `serbian/numbers.ts` takes the parameter; hr's and bs's one-line
      `numberToWords` wrappers DROPPED it and their call sites never passed a token, so both read
      `1000000000000000000000` as *jedan e dva jedan* — "1 e + 2 1", the ⟨e⟩ voiced as a vowel. ⚠ hr's caller
      also has a trap the others do not: it strips the thousands PERIODS and the decimal COMMA before
      `Number()`, so `raw` must be the STRIPPED string. Both fixed; `hr`/`bs` removed from
      `large-numeral-fidelity`'s ACCEPTED_LOSSY.
    · **The era marker's `i` flag.** `n.e.` is also two capital INITIALS with stops, and the era block runs
      BEFORE the dotted-capital-run rule, so `N. E. Kovač je došao` read *nove ere Kovač* — a name replaced by
      a date. serbian/normalize.ts fixed exactly this, and its comment reads "all eight era instances across
      the sr AND hr corpora are lowercase". hr kept `giu` anyway.
    · **The hyphen-suffix ordinal was DEAD IN RUNNING TEXT.** Its trailing guard was `(?![^\p{L}\p{M}]|.)`,
      whose `|.` arm rejects EVERY following character — "end of word" was silently "end of INPUT", so the
      rule only ever fired on an input that was nothing but the numeral, i.e. on its unit tests. The 50 lines
      of that shape in FLEURS hr_hr (`1480-ih, kada je…`, `tijekom 1990-ih bilo je`) read the CARDINAL plus a
      stray *ih*, the accusative clitic "them". bosnian/normalize.ts NOTICED this and declined to copy it, in
      a comment, without fixing the original.
- **hr's own: the rate preposition was not per denominator.** `unitPer: "na"` is right for ⟨h⟩ only because
  `sat` is syncretic in the accusative `na` governs; the feminine `sekunda` is not, so `1,5 km/s` and
  `133 m/s` — both written in this corpus — read *kilometara NA SEKUNDA*. `core/normalizeSymbols.ts` already
  takes a KEYED `unitPer` (added for Serbian's *u sekundi*), so the fix is data, not a forked rule.
- Hygiene, no output change: hr's `METAR` count-noun table was declared and consulted by nothing (Serbian's
  m/s rule is what reads it, and hr has none), and `makeSymbolNormalizer` was an unused import.
- ⚠ **STILL OPEN, ALL THREE STANDARDS AGREE ON THEM, AND EACH NEEDS A DECISION RATHER THAN A REWRITE:**
    · **`0,001 grama` reads *nula zarez jedan*** — a 100× error. The decimal comma becomes a word and the
      fractional tail is then re-tokenized, so `Number("001")` is 1 and the leading zeros are gone. sr/hr/bs.
    · **`1 000 000` reads *jedan nula nula*** — no space-grouping arm exists in any of the three (they group
      on periods), so a space-grouped figure is three numbers. Cf. the uz finding.
    · **`1,5 km` takes the genitive PLURAL where `2,5 km` takes the singular** — the shared tier's
      `slavicCountForm` reads the integer part, but a Croatian decimal governs the genitive singular whatever
      it is. The Ukrainian #920 shape, in a language that routes through the shared tier rather than around it.
    · **`1000/2000` loses its slash** (fraction operands capped at 3 digits, the su finding), **`2000. godine`
      keeps a spurious PAUSE** (`ordinalBase` declines a round thousand, documented in sr), **roman numerals
      above V before a lowercase noun read as words** (`VI. svjetski` → *vi svjetski*), **`SAD-u` strands its
      case suffix** after the nominative expansion, and **`1.234.567.890` degrades to digit-by-digit** for want
      of a sourced *milijarda*.
### From the bs port (2026-08-26) — four TS-side defects, and the golden moved ZERO rows for all four

bs is the second Serbo-Croatian standard in the C# tree: `Languages/Bosnian/` is 4 files and ~430 lines,
because `PhonemizeWord`, `ForeignLetters`, `ComposeSlavicNumber` and `NormalizeSerbianInitialisms` all come
from `Languages/Serbian/` unchanged. Gate **110 → 111 languages, 21,696 → 21,896 rows, 0 differ, 0 BLOCKED**;
200/200 on the first parity run, before any of the fixes below.

⚠ **THE WIDENINGS ARE WHERE THE PORT EARNED ITS KEEP, AND THE GOLDEN SAW NONE OF IT.** All four defects were
found by READING, all four are fixed in TypeScript first with tests, and `gen_parity_goldens.mts bs` moved
**0 of 200 rows** on each — the gate proves the engines agree and every one of these was a bug both engines
would have reproduced byte-for-byte forever. Corpus-wide differential: 3,952 FLEURS `bs_ba` lines (col 3+4)
× sync and async, 0 differ. Off-golden probes: 296 hand-built lines, one per arm plus the adversarial
neighbour each arm must decline, × both modes, 0 differ.

- ⚠ **A SHARED PRE-PASS CAN KILL A LANGUAGE'S OWN RULE, AND NO UNIT TEST IN THE LANGUAGE'S FILE CAN SEE IT.**
  `bs` was missing from `registry.ts`'s `VULGAR_FOLD_OPT_OUT`, so the shared fold rewrote `¾` to ` 3/4`
  twelve days before the Bosnian port was written — and bs has no general `n/m` fraction rule, so the slash
  was dropped and the corpus's parchment sentence read *dvadeset devet TRI ČETIRI inča*, "twenty-nine three
  four". Step 14 of `bosnian/normalize.ts`, whose reading is *i tri četvrtine*, had never once run.
  ⚠ **THE TEST FILE IS WHY IT SURVIVED**: every bs test built the engine with `createBosnian()` and called
  `.text()` directly, which bypasses every pre-pass `getPhonemizer` wraps around it. A rule can be green in
  its own suite and unreachable in the product. The new tests go through `phonemize()`.
  ⚠ The opt-out is a TRADE, stated here rather than hidden: bs now reads the two attested glyphs (`¾` `½`,
  the only ones in the corpus) with its own words, and DROPS the other sixteen, which the fold used to
  half-read. hr, ca, mk and six more already make the same trade; inventing *i jedna trećina* for a glyph
  with ×0 attestation is the Fula `tere` failure.
- ⚠ **#1059's `raw` THREADING DID NOT PROPAGATE TO THE STANDARDS THAT WRAP THE SHARED COMPOSITOR.**
  `serbian/numbers.ts` takes `raw` and `serbian.ts` passes it; `bosnian/numbers.ts` did not declare the
  parameter at all, so bs read `9007199254740993` as *…dva* (its NEIGHBOUR's answer — the double had already
  rounded) and `1e21` as *jedan e dva jedan*, four words for twenty-two digits. bs is removed from
  `large-numeral-fidelity.test.ts`'s `ACCEPTED_LOSSY`, which is the list that may only shrink. ⚠ **`hr` HAS
  THE SAME HOLE AND IS STILL ON THAT LIST** — its call site strips `.` and `,` before `Number()`, so its
  `raw` must be the STRIPPED string, not the token.
- ⚠ **THE ONE WORD-KEYED RULE IN A DIGRAPHIC LANGUAGE THAT HAD ONLY ONE SCRIPT.** `bosnian/normalize.ts`'s
  header states the invariant ("its absence would make this file a no-op on Cyrillic prose") and DOTTED_ALT,
  LICENSOR and the degree scale all hold it — the era marker did not. `п.н.е. у пожару` read as *p . n . e .*,
  four letter names and four phrase breaks. Serbian already ships both spellings, so nothing was invented.
- ⚠ **A COORDINATED ORDINAL PAIR IS ONE CONSTRUCTION AND WAS BEING READ AS TWO HALVES, ONE OF THEM WRONG.**
  Step 9 established that a licensed span makes BOTH endpoints ordinal and cited the longhand sentences
  (`u sezoni od 1995. do 1996. godine`, `u 2015. ili 2016. godini`) as its evidence — then claimed only the
  DASH form. The longhand ones fell to steps 10/11, which see one numeral at a time:
    · a NON-YEAR first conjunct is claimed by neither, so `10. i 11. stoljeća` read *deset . i jedanaestog
      stoljeća* — the cardinal-plus-spurious-clause-break that the whole file exists to remove. ×3 distinct
      corpus sentences, and the LICENSOR table cites two of them as its OWN evidence for `stoljeća` and
      `pukovniju`;
    · a YEAR first conjunct IS claimed, by step 11 — which only knows the ELIDED *godine* and so always
      emits f.gen. `u 2015. ili 2016. godini` read *petnaestE … šesnaestOJ*, one construction with two cases
      in it.
  Step 9b now claims `N. (i|ili|do) N. LICENSOR` as a unit, both scripts. The connectives are the three the
  corpus writes; an unlicensed follower and a round thousand are both refused.

**Found and NOT fixed — filed, with the count that decided it:**

- **A local rate rule and the shared tier disagree about a decimal count** — Ukrainian's #920 shape, in
  sr/hr/bs alike. `intOf` TRUNCATES, so bs's local `m/s` rule reads `1,5 m/s` as *metAR* (nom.sg) where the
  shared tier reads `1,5 km` as *kilometarA* (gen.pl, via `numValue`'s `int + 0.5`). ×0 decimals in the four
  attested rate shapes (`133 m/s`, `200 milja/sat`, `300 m/h`, `600Mbit/s`), and closing it moves sr and hr
  too, so it wants a Serbo-Croatian decision rather than a bs edit.
- **Space-grouped thousands are not de-grouped**: `1 000 km` reads *jedan nula kilometara* — a lost
  magnitude, and the tier's count form is right (`numValue` de-groups) while the tokenizer's number is not.
  ×0 in bs_ba across all four space characters; Bosnian groups with periods (×47). Adding the arm on zero
  attestation is the #955 invention trap.
- **A round thousand ordinal leaves a stranded pause**: `2000. godine` → *dvije hiljade . godine*.
  `ordinalBase` returns undefined by design (the fused *dvijehiljaditi* is a different word-formation), but
  the untouched text keeps a `.` that IS clause punctuation. ×2 in the corpus, and closing it needs the
  fused forms sourced.
- **`km³` is dropped silently while `km²` reads** (ig's finding, same shape): bs declares no cubed word
  because `³` is ×0 and the one cubic quantity is spelled out — but the MARK is then lost rather than left.
- **U+2212 between digits fuses a range**: `1838−1917` → two years with nothing between them. The range
  class is `[-–—]` and the minus class is `[-−–]`; ×0 U+2212 in bs_ba, so per #955 this is filed, not swept.
- **A triple coordination claims only its last pair** (`1. i 3. i 5. pukovniju`), and **`GMT-00:43`** loses
  its sign (the cy/ga finding). Both ×0.
### From the nb port (2026-08-27) — the third NEURAL language, 200/200 first run, FIVE TS-side defects

**nb (Norwegian Bokmål)** — 5 files, ~430 C# lines: an NST pronunciation lexicon (38k forms) over a
complementary-length rule g2p, plus a per-grapheme BiLSTM tagger reading the OOV tail. It is the third
tagger language after af and sd, and `NorwegianAsyncUsesTheTagger` pins that the async reading really
differs from the rule one (`dreinsystemene` → rules *ˈdɾeːɪnsʏstəmənə*, neural *ˈdɾæɪnsʏˌsteːmənə*). The
tagger is not a garnish here: **2,926 of the corpus's 3,718 lines read differently sync vs async**, which is
also why a port registering only the sync engine would have failed almost every golden row rather than one.

⚠ **THE #1068 FOLD IS PART OF THE PORT, NOT OF THE DATA.** `nb-lexicon.tsv` has 14 keys the engine's own
nativiser rewrites (`señor`, `malmö`, `göring`, `bogotá`, `reykjavík`, `värmland`, `fjällbacka` …), and the TS
`loadTsvMap` call passes `fold: (k) => nat(k)`. The C# `LoadTsvMap` had to pass it too — the two engines would
otherwise LOAD DIFFERENT LEXICONS and disagree on any row touching one of those words. All 14 resolve
identically in both engines, and the three value-CLASHES ledgered in `test/lexicon-reachability.test.ts`
(`á`→`a`, `fór`→`for`, `märta`→`marta`) resolve to the UNFOLDED row's value on both sides, as the precedence
rule requires. `NorwegianLexiconIsLoadedThroughItsOwnNativiser` pins it in C#; the ledger is unchanged at 3.

Widenings: FLEURS `nb_no` col 3+4, **3,718 lines × sync and async, 0 differ, 0 throws**, plus **238 off-golden
probe lines × both modes, 0 differ**. Coverage of the corpus, measured: 860 lines carry a digit, 117 an
ordinal dot, 40 `km`, 37 a range, 32 a decimal comma, 30 a colon clock, 29 a dotted abbreviation, 19 `ca.`,
14 a rate slash, 12 `mm`, 10 an era marker, 10 a percent, 8 an intra-word apostrophe, 6 `²`, 2 a currency
sign, 2 `°` — and **0 a `³`**, which is why the cubed finding below is filed rather than fixed.

Fixed in TypeScript first, with tests, goldens regenerated (**9 of 200 rows move**, all the `ca.` fix), then
ported. ⚠ **NOT ONE OF THE FIVE WAS VISIBLE TO THE GATE** — every one was found by reading the TS and by
probing, and the engines agreed byte-for-byte on all five wrong answers beforehand.

- ⚠ **THE MOST FREQUENT MEMBER OF THE ABBREVIATION TABLE WAS THE ONE MISSING FROM IT.** `ca.` occurs **21**
  times in nb_no — more than `osv.` 10, `kl.` 10, `nr.` 5, `dr.` 3, `bl.a.` 2, `dvs.` 1, every one of which
  was already declared. The word read correctly (the lexicon maps the token `ca`), so nothing looked wrong;
  it was the DOT that survived into `clausePunctuation`, which is precisely the defect that table's docstring
  says it exists to remove. `ca. én amerikansk cent` — **a line of the parity golden** — read *ˈsɪɾkɑ . ˈeːn*.
  This is where all 9 golden rows move.
- ⚠ **THE ERA MARKER WAS NOT MERELY UNREAD, IT WAS READ AS MONEY.** `f.Kr.` tokenized as `f` + `Kr`, and `kr`
  is the lexicon's own abbreviation for *kroner* — so `323 f.Kr. etter at…` read *ˈɛf . ˈkɾuːnəɾ .*, "eff
  kroner" plus two spurious clause breaks. 12 instances in four spellings (`f.Kr.`, `f.Kr`, `f.kr`, and once
  `f.Kr!`), with `e.Kr.`/`e.kr` for the common era. Both words of each expansion are in the NST lexicon. The
  trailing dot is optional and a trailing LETTER is refused, or `f. Kristian` would become *før Kristusistian*.
- ⚠ **THE CURRENCY NOUN FUSED WITH THE NEXT WORD, AND THE CORPUS SENTENCE THAT SHOWS IT ALSO SHOWS WHY IT
  WAS INVISIBLE.** `(\d[\d ]*)` is greedy over spaces with nothing after it to force a backtrack, so it
  swallowed the space SEPARATING the amount from the following word — and the noun was written where that
  space had been. `mellom ¥2500 og ¥130 000` read *ˈyːənɔɡ* for the first figure ("yenog", ONE token, and no
  longer a lexicon word so the vowel changed too) and correctly *ˈjɛn* for the second — because a COMMA
  followed it. Same construction, two answers, decided by the next character. All four signs had it.
- ⚠ **AN INTRA-WORD APOSTROPHE SPLIT THE WORD IN TWO** — the sv #1073 shape, measured on nb's own corpus
  rather than inherited: 8 instances, 4 types (`O'Shannessy`, `O'Flynn`, `l'Oyapock`, `President's`), every
  one arriving as two runs, separately phonemized and separately stressed (*ˈuː ʃɑnəsːʏ*, *ˈɛl ˈɔjɑpɔkː*).
  ⚠ The guard is a LOOKAHEAD, not a class member, and Norwegian is the language that proves why: the genitive
  of an s-final name is written with a TRAILING apostrophe (`Anders' bok`), which must keep declining, as
  must a closing quote (`sa 'nei'`). 0 golden rows reach any of it, and 0 NST headwords are spelled this way
  — the tokenizer is the only instrument that sees it.
- **`jr.` read as the bare onset cluster *jɾ*** plus the stranded stop — no vowel, so not even a word. ×3,
  every one the name suffix, and `junior` is in the lexicon. `sr.` was NOT added beside it (×0 — the #955
  invention), and `m.` (×2, `James m. flere`) stays out because it is genuinely ambiguous with a lone initial.

**Found and NOT fixed:**

- **`km³`/`cm³` are dropped silently while `km²` reads** — `100 km³` → *hʊndɾə çiːlʊmeːtəɾ*, the volume gone.
  ig's and bs's finding in a third language. `SQUARED` declares `m³` but neither cubed compound, and **`³` is
  ×0 in nb_no** (measured, not assumed), so *kubikkilometer* would be sourced on nothing.
- **`fahrenheit` and `kvadratcentimeter` are NOT in the NST lexicon**, against normalize.ts's header claim
  that "EVERY WORD EMITTED BELOW is in the NST lexicon … Checked before authoring, not assumed". Both take
  the rule path, and `fahrenheit` gets a spurious medial [h] (*ˈfɑhɾənhəɪt*) the engine has no silent-h rule
  to remove. ×0 °F in the corpus. Five ordinals (`sekstende`, `syttende`, `nittende`, `tjueførste`,
  `trettiende`, `trettiførste`) are missing for the same reason and read acceptably by rule.
- **nb SHIPS NO LETTER NAMES**, so an initialism reads as a bare consonant cluster: `Washington DC` → *ds*,
  `NPK` → *npk*, neither carrying a vowel or a stress mark. rw's shape; a data decision, not a port one.
- **`19:19:19` loses its third component to a clause break** (*nɪtn nɪtn , nɪtn*) — the so #1050 shape, ×0.
- **`20 °Cx` FUSES the degree word onto the following letters** (*ˈɡɾɑːdəɾsks*). The Celsius arm correctly
  declines on the trailing letter and the bare-degree arm then fires without leaving a boundary. ×0.
- Shared shapes already filed elsewhere: `(0) c°` loses its scale letter (lo); `VI. verdenskrig` reads the
  roman numeral as the Norwegian word *vi* plus a stranded pause (hr); `10^6` drops its caret (fleet);
  a period between digits stays and becomes clause punctuation (`802.11n`, `9.174 mi²`) — though that one is
  a DOCUMENTED decision, measured at 24 corpus instances of which exactly one is a clock.
### From the da port (2026-08-27) — 200/200 first run, four TS-side fixes, ONE golden row moved

**da (Danish, ~6M)** — 7 files, ~640 C# lines. The THIRD neural language after af/fa (sd, ckb since):
`DanishNeural.cs` + `DanishTagger.cs` install a per-grapheme BiLSTM beside the sync engine, and
`Bootstrap.cs` installs the `NeuralRegistry` entry with it. `DanishAsyncUsesTheTagger` pins that the async
reading differs from the rule one. Gate **114 → 115 languages, 22,496 → 22,696 rows, 0 differ, 0 BLOCKED**.
Widenings: the FLEURS `da_dk` differential is 3,756 lines (col 3+4) × normalize/sync/async = **11,268 rows,
0 differ**; off-golden probes are 184 + 95 hand-built lines (one per normalize arm plus the adversarial
neighbour, the four space characters against seven separator-bearing shapes, every g2p rule, the number
corners) × the same three modes, **0 differ, 0 throws**. Corpus coverage of the arms, measured not assumed:
746 lines carry a digit, 108 a dotted ordinal, 82 a period-grouped thousand, 46 `km`, 38 a dotted
abbreviation, 33 a span, 32 a decimal comma, 26 a colon clock, 18 a rate slash, 12 a currency sign, 8 a
percent, 4 a degree sign, 4 an exponent, 4 an ampersand — and **ZERO** relational signs, U+2212, infix `+`,
`NxN`, space-grouped thousands or >12-digit runs, so those arms rest on the probes alone.

⚠ **THE LEXICON IS LOADED THROUGH ITS OWN NATIVISER (#1068) AND THE PORT HAD TO PASS THE `fold`.** Four of
da-lexicon.tsv's 37,008 keys are unreachable through `text()`'s own fold (`joão`, `jón`, `voilà`, `genève`);
three of the four folded spellings are already in the file and WIN, one of them — `geneve` ʃeˈnɛːv against
`genève` ʃeˈnɛv — with a DIFFERENT value, which is da's single row in `lexicon-reachability`'s shadowed
ledger. `joão` is the one free slot. Pinned in C# by `DanishLexiconIsLoadedThroughItsOwnNativiser`.

Fixed in TypeScript first, each with a test, then ported:

- ⚠ **THE NEURAL PRE-PASS TOKENIZED AND KEYED DIFFERENTLY FROM THE ENGINE IT FEEDS, so the tagger tier was
  SKIPPED for every word the nativiser rewrites.** `danish.ts` hands `oovOverride` the NATIVISED spelling of
  a `LATIN_RUN` match (`nat(m[1])`); `danishNeural.ts` used a hand-listed letter class keyed by the RAW
  match. Both halves miss: an accented letter is a KEY MISS (`Galápagosøer` tagged under its own spelling
  while the engine asked for `Galapagosøer`, so it read the rule's *ɡˈalapaɡosøɐ* against the tagger's
  *ɡaˈlaːˀpaˌɡɐsˌøːˀɐ*), and a letter the list omits SPLITS the word (`Cañitas` tagged as `Ca` + `itas`, two
  readings nothing asks for). 21 distinct types / 22 tokens over FLEURS da_dk, and the tagger declines NONE
  of them once the fold has removed the out-of-vocab letter. Both files now derive the tokenizer and the key
  from `danish.ts`'s own exports. **1 golden row moved** — the only one of the four fixes that moves any.
  ⚠ The comment asserting the false premise was IN the file ("the pre-pass keys the tagged map by the raw
  match, which is what the sync engine hands `oovOverride`"): question 1 of the correctness lens, again.
- **#1059: the number call site dropped `raw`.** `danish.ts` called `numberToWords(Number(m[2]))` and
  `numbers.ts` did not declare the parameter, so the digit-at-a-time fallback — which exists *precisely
  because the double cannot be trusted* — read the rounded float back out. `9007199254740993` read as its
  neighbour `…992` and `12345678901234567890` ended *nul nul nul* against a written `890`. da is off
  `large-numeral-fidelity`'s ACCEPTED_LOSSY, the list that may only shrink. **0 golden rows** (the golden's
  longest digit run is 5). ⚠ `fo`, `lb` and `bar` share `unitsFirstNumbers.ts` and were STILL on that
  list when this entry was written — reported, not fixed here (separate bring-ups; trap 55). All three
  have since been threaded and removed from it; `bar`'s C# call site carries the same `raw` and the same
  two assertions.
- **The degree noun FUSED with the following letter — corpus-attested, ×2 distinct FLEURS sentences.** The
  scale-letter arms decline a letter RUN on purpose (`25°Cölner` is not Celsius) and the bare `(\d)\s*°`
  arm then left `grader` abutting it, so the compass bearing `35°V` (longitude west) became the one token
  `graderV` and read *ɡʁˈaðeʁv* — a plausible Danish-looking pseudo-word no leak class can see (trap 56)
  — where the space gives *ˈɡʁɑːðɐ ˈveːˀ*. ⚠ **The repair was ALREADY IN THIS FILE**, in step 12, for
  exactly this shape (`$110m` → *dˈolaʁm*); the degree arm simply never got it. **0 golden rows** (the
  golden carries no degree sign at all).
- **Four dead manifest keys, the #901 shape.** A sabotage sweep over `danish.jsonc` (each of its 132 string
  leaves corrupted in turn, against a probe of every letter × 8 shapes + every integer 0–120 + every ordinal
  1–31 + every clause mark) found `consonants.t`, `.d`, `.r` and `.c` unreached: those four letters are
  intercepted by context rules that carried a LITERAL COPY of the manifest's value, so both engines agreed
  about a value neither read. The default phone now comes from the manifest; only the context ALLOPHONES
  (ð, final-⟨t⟩ [d], soft-⟨c⟩ [s]) stay literal, which is what the manifest header already says. **0 golden
  rows**, and the re-run sweep is 26 → 22 unreached leaves, all 22 prose.

**Found and NOT fixed — filed, with the count that decided it:**

- **`km³` is dropped silently while `km²` reads** (ig's finding, third language). SQUARED declares `m³` but
  not `km³`, and the shared tier then claims the bare `km` and STRANDS the `³`, which the tokenizer drops:
  `5 km³` → *fem kilometer*. ×0 in da_dk (all 4 exponent instances are `km²`), so declaring *kubikkilometer*
  is the #955 invention trap even though it is compositional from two words already in the table.
- **An `h:mm:ss` stamp keeps a stranded colon.** The clock arm claims the first pair and leaves `:19`, which
  IS clause punctuation: `19:19:19` → *nitten nitten , nitten*. so's #1050 shape; ×0 in da_dk.
- **U+2212 between digits fuses a range** (`1838−1917` → two years, nothing between) and a spaced one is
  dropped (`2 − 2` → *to to*). The range class is `[-–—]`; ×0 U+2212 in da_dk, so #955 files it.
- **A second comma strands itself as CLAUSE PUNCTUATION.** `(\d+),(\d+)` claims the first pair only, so
  `12,345,678` → *tolv komma tre fire fem , seks hundrede og otteoghalvfjerds*. The file argues the Danish
  comma is purely decimal and the corpus agrees (×0 multi-comma numerals), so the shape is unreachable from
  real Danish — but it is one paste of English-grouped text away.
- **The ordinal arms disagree about a leading zero.** Step 8 keys `ORDINALS[String(Number(a))]` and steps
  9/10 key the raw digits, so `01.-02. maj` reads *første til anden* while `01. maj` is left as a cardinal
  plus a full stop. ×0 (the corpus's three `0N.` instances are all the period CLOCK the header declines on
  purpose), so this is an inconsistency rather than a live defect.
- **A three-term span claims only its last pair**: `1990-1995-2000` → *1990-1995 til 2000*, the first dash
  dropped outright. ×0. And **space-grouped thousands are not de-grouped** (`1 000 km` → *en nul
  kilometer*) — but the file's header DECLARES that decision, and it is right: ×0 across all four space
  characters in da_dk, which group with periods (×82).
- Hygiene, no output change: `normalize.ts` says its `percent` tier declaration "never fires" because the
  local rule claims every `%` — the local rule is `(\d+)\s*%` and does NOT claim a PREFIXED sign, so the
  tier is what reads `%50`. And `phonemizeWordRules`'s `lw[2] !== "r"` guard is redundant: the character
  class it guards already excludes ⟨r⟩.

### From the rw port (2026-08-26) — 200/200 first run, one TS fix, two filed

**rw (Kinyarwanda, ~12M)** — 4 files, ~470 C# lines: a greedy longest-match grapheme scan (the ⟨Cy⟩
palatalisation series), the shared Rwanda-Rundi cardinal compositor, and a 610-line normalizer that owns the
shared symbol-tier call from BOTH sides (de-grouping before it, the decimal spell-out after it). No FLEURS
corpus and no espeak backend exist for rw, so widening (1) is the 443-line mined artifact rather than a
transcript; the differential ran 849 lines (445 mined + 132 attest + 277 adversarial) plus 96 separator
probes, sync AND async, **0 differ, 0 throws**. Coverage of the new code, measured not assumed: 580 probe
lines carry a digit, 159 a decimal separator, 117 a unit key, 66 a span, 40 a percent, 33 a degree sign, 33
an exponent, 30 a colon time, 26 a currency key, 16 a dotted capital run.

Fixed in TypeScript first, with a test, then ported:

- **rw's number call site re-stringified the double instead of passing the token text** — the #1059 shape,
  and rw was on `large-numeral-fidelity`'s ACCEPTED_LOSSY list. `numberToWords(Number(m[2]))` dropped `raw`,
  so the digit-at-a-time fallback — which exists *precisely because the float cannot be trusted* — then read
  the float back out. `9007199254740993` read `…kʲenda kʲenda kabiɾi` (…992, the rounded value) and
  `12345678901234567890` read its last three digits as *zeɾu zeɾu zeɾu* against a written `890`. A
  confidently wrong quantity, not a drop, and the sibling engines that share this compositor's shape (shona,
  chichewa) already passed `raw`. **0 golden rows move** — the rw golden's longest digit run is 5.
  rw is now off ACCEPTED_LOSSY, which that test says may only shrink.

Found, not fixed — both corpus-attested, both engines agreeing, and the second needs a FLEET decision:

- **The `dogere` redundancy guard gives ONE CONSTRUCTION TWO ANSWERS.** `saidNear` reads the ±45-character
  window of the string `String.replace` handed the callback — the PRE-replacement one — so a sibling match in
  the SAME pass is invisible while one in a LATER pass is not. Measured on the corpus's own °C/(°F) glosses:
  `−27.2 °C (−17.0 °F)` says the noun twice (both figures negative, both claimed by arm 4a) while
  `−14.4 °C (6.1 °F)` says it once (the second figure falls to arm 4c, whose snapshot already carries the
  insertion). Same construction, two readings, decided by which arm claimed the first figure. `25.3°C na
  27.7°C` likewise emits `dogere selisiyusi` twice where the corpus's own spell-out
  (`dogere 22° na 35° z'amajyepfo`) writes the noun ONCE for two signs. ⚠ NOT FIXED, because the obvious
  blanket fix REGRESSES the coordinate arm: `2° 36′ 58″ S, 29° 44′ 34″ E` is 14 characters apart and the
  corpus repeats the noun per AXIS on purpose (`dogere 22°… (S) na dogere 16°… (E)`). A correct fix has to
  be per-arm — within-pass memory for the temperature arms, none for the coordinate arm — and it moves both
  of the golden's two degree-bearing rows on n=1 and n=5 evidence. Needs the decision, not the diff.
- **MAGNITUDE + NUMBER + CURRENCY is split down the middle, ×7 in the corpus.** rw writes the magnitude word
  BEFORE its figure (`miliyari 290 Frw`, `miliyoni 158$`, `miliyoni 20 $`, `miliyoni 2 Frw`, `miliyoni $800`,
  `miliyoni $440`, `miliyoni $247`) and `currencyPrefix` puts the currency phrase immediately before the
  number, so `miliyari 290 Frw` → *miliyari amafaranga y'u Rwanda 290* — the magnitude noun and its count
  separated by a four-word currency phrase. normalize.ts withholds `magnitudes` for a stated reason that is
  about the TIER'S CAPABILITY rather than the desired reading: "`magAlt` matches NUMBER-then-magnitude, so
  the hop can never fire". It cannot, and that is the defect — `core/normalizeSymbols.ts` has no
  magnitude-BEFORE-number arm at all. A per-language patch would paper over one language; this is the
  `roman`/`DC` shape, a fleet call on the shared tier. ⚠ And nya is the mirror case (NOUN+NUMBER+MAGNITUDE),
  so the tier is already known to meet at least three orders.
- Hygiene, no fix proposed: rw declines LETTER NAMES outright (no in-repo source, espeak ships no
  Kinyarwanda), and step 1's dotted-capital rule therefore FUSES a person's spaced initials into a pseudo-word
  — `P. W. Botha` → *pw botha*, `H. W. Bush` → *hw buʃ*, both corpus lines. The discriminator is clean (all 6
  abbreviation instances are UNSPACED — `U.R.S.S.`, `R.R.A`, `P.S.`, `D.C.`, `A.L.A.R.M.` — and both initial
  runs are SPACED), but with no letter-name table every available output is wrong, so the honest blocker is
  the sourcing gap the file already records.
- ⚠ **rn (Kirundi) CARRIES THE SAME NUMBER CALL-SITE DEFECT AND IS NOT FIXED HERE** — `kirundi.ts` also calls
  `numberToWords(Number(m[2]))` and `kirundi/numbers.ts` also drops `raw` on the way to the shared
  `composeRwandaRundi`. It is still on ACCEPTED_LOSSY. Reported rather than fixed, per trap 55: rn is a
  separate bring-up and a sibling is a hypothesis, not a source.

### From the om/uz/sd/su/ig batch (2026-08-25) — read while porting, both engines agree on every one

⚠ THE PARITY GATE CANNOT SEE ANY OF THESE. It proves the two engines AGREE; a bug both reproduce
byte-for-byte passes it forever. Every entry below is a TS-side fix owing a test and a golden regen.

- **Thousands de-grouping breaks past three groups — TWICE, in two unrelated languages.** ig's
  `12,345,678,901` leaves a comma stranded, which then reads as CLAUSE PUNCTUATION: one number becomes
  two with a pause. uz's space-grouped `1 000 000 000 soʻm` reads *mˈiŋ nˈɒl sˈom*. Both are the same
  two-pass non-overlapping shape and neither is language-specific — ⚠ **check the whole fleet before
  fixing either one.** A confidently wrong quantity, not a drop.
- **su: `0,001 gram` → *hˈid͡ʒi ɡram*, a 1000× error.** The comma arm takes `0,001` as a thousands group.
  A LEADING ZERO can never be one, so this is not the undecidable comma case the file documents. Found
  on the mined line that is itself `normalize.ts`'s own citation for its `mg` unit.
- **sd: an `i` flag dropped in flight.** `UNITS` declares `[/km/giu, …]` but the composing loop reads
  `re.source` and hard-codes `"gu"`. Every neighbouring rule is `giu`. `12 KM` → *kʰˈeᶦ ˈɛm*.
- **uz: the docstring and the table disagree about a key.** `uzbek.ts` says the tier claims `cm` and
  works its example on `6x6 cm`; the table declares `sm`. `5 cm` → *bˈeʃ km*, two bare consonants.
- **ig: `km³` is dropped silently** (`100 km³` → *otu naɾɪ kilomita*) while `km²` reads. The file's own
  SQUARED section argues against exactly that loss and its docstring claims the mark is left.
- **su: four more** — `1500 M.` fails the era arm on a clause-final dot (the `(?!\d)`-not-`(?![\d.,])`
  finding that file already records twice for its other arms); `I²C` fuses to one word against its
  docstring; `25°Cölner` glues the word on after the Celsius guard correctly declines; `1000/2000`
  loses its slash (fraction operands capped at 3 digits).
- **uz: a word-edge apostrophe becomes a glottal stop** (`'soʻz'` → *ʔsˈozʔ*). Oromo's scanner declines
  exactly this by design; the tutuq belgisi is never word-initial or word-final in Uzbek either.
- Hygiene, no output change: ig's `consonants["ṅ"]` is stored precomposed but `phonemizeWord` NFDs first,
  so the row is unreachable; ig's and su's `foreign` constructor params are never read on any branch.

### From the ht port (2026-08-26) — 200/200 first run; full log in `docs/ht_port_investigation.md`

⚠ **THE INTRA-WORD MARK CLASS IS LIVE IN ht, AND IT IS THE TYPOGRAPHIC APOSTROPHE, NOT THE ASCII ONE.**
Haitian writes `l'ap`, `n'ap`, `ki-sa`, `pa-t`, and the word arm already carried `"'-"` — measured over
mined + attest + the 200 golden texts, 73+46 intra-word U+0027 and 229+35 intra-word hyphens all read as
ONE token. **U+2019 did not**: 13 mined + 2 golden instances, every one an elision, and every one split at
the mark — `l’Hôpital` → *l hopital* against `l'Hôpital` → *lhopital*, a stranded [l] in front of the
noun. `core/clauses.ts`'s own `LATIN_RUN`/`FOREIGN_RUN` list U+2019 and ~20 sibling Latin engines do too;
ht simply missed it. Fixed TS-first (`"'-"` → `"'’-"`, and the same in `NATIVE_CLASS`), **2 golden rows
moved**, pinned in both suites as "the two spellings must read IDENTICALLY".
⚠ The second half of the Swedish fix (#1073) was NOT needed and that was checked, not assumed: `scan` has
no fall-through — an unnamed character is dropped, never passed into the IPA — so a leading or trailing
quote still reads as nothing (`’moun` → *mun*).

Found, not fixed:

- **A decimal glued to a letter reads its separator as a CLAUSE BREAK — ×8 attested.** Step 10's trailing
  `(?![\d\p{L}\p{M}])` is documented as keeping a dotted designation (`802.11a`) out; declining is not
  neutral, because the surviving `.`/`,` is then CLAUSE PUNCTUATION. `17.09m.` → *disɛt . nɛf m .*,
  `1.9pwen` → *ɛ̃ . nɛf pwɛ̃*, `442.7k` → *… kaɣãnde . sɛt k*, `802.11n` → *ɥit sã de . ɔ̃z n*. ⚠ **Two of
  the eight are `normalize.ts`'s OWN attestations** — `1 a 1,5m` and `50cm a 1,80m`, quoted twice in the
  file as the evidence for the `a` connective, read *ɛ̃ a ɛ̃ , sɛ̃k m*. 3 of the 12 corpus instances are
  genuine quantities, 5 are designations/DOIs, 2 are already rescued by the unit tier — and the current
  reading is wrong for ALL of them. NOT FIXED because the repair (read the separator as `vigil`) trades a
  bogus full stop for a bogus *vigil* in the designation half; that is a corpus call, not a port call.
  0 golden rows reach the shape.
- **A NON-ASCENDING span drops its unit entirely.** `53-50 km` → *sɛ̃kãntwa sɛ̃kãt km* against `50-53 km`
  → *… kilomɛt*. Step 5's `(?<!\d\s?[-–—]\s?)` on the single-operand arm is only ever REACHED when the
  span arm declined (a successful span rewrites the dash away), so its whole effect is to delete the unit
  in exactly that branch. ×0 attested — the `tl numberStressIdx` shape, live the moment one appears.
- **The `-eyen` ordinal band strands a bare *jɛm*** — the before-picture step 12 exists to fix, surviving
  wherever `ordinalTails` has no match: `20yèm` → *vɛ̃tjɛm* but `21yèm` → *vɛ̃tejɛ̃ jɛm*, and likewise 31,
  41, 81, 101, 0 and every magnitude. Needs a sourced Haitian ordinal for the decade+`eyen` band; all 22
  `ordinalTails` rows themselves ARE reached (checked by composing every band).
- Shared shapes, already filed for other languages: `2 − 2` reads *de de* (step 4b claims the LEADING
  U+2212 only, deliberately); `20 °Cx` → *vɛ̃ kks* and `(0) c°` → *zewo k* (the `lo` degree finding);
  `ISBN`/`US`/`X` read as Haitian words because espeak ships no Haitian Creole letter names.
- Hygiene, no output change: step 1's zero-width class was written with the four INVISIBLE characters, so
  the line read as an empty class. Escaped in both engines (the #931 rule).

### From the ckb port (2026-08-27) — 200/200 first run; full log in `docs/ckb_port_investigation.md`

**ckb (Central Kurdish / Sorani, ~8M)** — 6 files, ~430 C# lines, gate **114 → 115 languages, 22,496 →
22,696 rows, 0 differ, 0 BLOCKED**. ⚠ **NO PERSO-ARABIC CORE WAS INVOLVED, and that was worth checking
rather than assuming**: ckb is a Perso-Arabic script but imports none of the shared abjad machinery — the
SORANI alphabet writes every long vowel and the short /a/, so there is no short-vowel wall to restore and
nothing in `Core/HarakatLexicon.cs` / `Core/RiderDiacritizer.cs` is reachable. It shares only `Clauses`,
`LoadManifest`, `LoadTsv`, `Numbers`, `Unicode`, `Foreign` and `StructuralTagger`, and the neural tier is
`CreateWordStructuralTagger` + `WordLevelNeuralPrepass` unchanged, as in sd/bn/af/fr. **The shared core
needed no change.**

Widenings: corpus-wide differential over **4,275 unique lines** (8,696 FLEURS `ckb_iq` col 3+4, 143 mined,
the 200 golden texts, 261 hand-built) × sync AND async = **8,550 comparisons, 0 differ, 0 throws**.
⚠ The corpus alone covers NONE of the degree sign, the currency signs, the relational signs, U+2212 or an
above-2⁵³ digit run — all five are 0 in FLEURS + mined and rest entirely on the hand-built lines. 3,292 of
the 4,275 lines read differently on the async path in both engines, so the tagger tier is live on both
sides rather than silently serving the sync reading.

Fixed in TypeScript first, with tests, goldens regenerated, then ported:

- ⚠ **A FIX WITH A STATED ARGUMENT DID NOT REACH THE SECOND CASE THE ARGUMENT COVERS.** `scanWord`
  special-cases the one-letter word ⟨و⟩ because "a bare [w] is not pronounceable as a word" — and Sorani
  has TWO matres lectionis. The one-letter ⟨ی⟩ is the detached IZAFE (`٢٤ ی ئەیلول` "the 24th OF
  September", `16ی ئەیلوول`, `80%ی داهات`) and read as a bare **[j]**, 405 times across the corpus; the
  next one-letter token down is 14 instances of a fragment, so it is one construction, not a tail.
  Measured exactly as the ⟨و⟩ note was (min of wav2vec2 and allosaurus, 151 affected rows): median
  0.3575 → 0.3558, mean 0.3849 → 0.3794, **72 closer / 1 further**. `i` and `iː` score IDENTICALLY —
  `fold` strips length — so the quality is decided on the language, and deletion again wins on rows
  (149/2) and loses on the mean, which is the ⟨و⟩ note's own connected-speech finding. **15 golden rows
  move.**
- ⚠ **AN ERA-SHAPED DISCRIMINATOR QUESTION, ANSWERED PER SIGN.** The signed-number rule admits a LETTER
  before the sign for `UTC+1`, and applied that to the minus as well. Reading the instances rather than
  counting them: the one letter-adjacent PLUS is `(UTC+1)`; all **20** letter-adjacent MINUSES are
  designations — `کۆڤید-19`, `نوێ-COVID-19`, `HJR-3`, `Il-76s`, `چانداریان-1` — and not one is a
  subtraction, so COVID-19 read *koːviːd kam noːzda*, "covid MINUS nineteen". Split into two arms; the
  minus takes the ordinary non-letter boundary. **0 golden rows move.** (Cf. kmr's digit guard and
  Serbian's case guard for the same class: the discriminator each corpus supports is different, and here
  it is the SIGN.)
- Hygiene: `normalize.ts`'s header claimed the decimal rule "accepts one or two fractional digits". It has
  no cap; the fractional part is read digit by digit either way, and it is the UNIT rule's `NOT_VERSION`
  guard that tells `802.11m` from a quantity.

**Found and NOT fixed:**

- ⚠ **THE ZERO NUMERAL HAS NO NUCLEUS, IT IS ALREADY IN THE GOLDEN, AND THE LEXICON IS THE WRONG PLACE
  FOR IT.** `سفر` reads *sfɾ* — the only word in the numbers table with no vowel — and it is not obscure:
  2 of the 200 golden rows carry it (`3.50 مەتر` → *seː xaːɫ peːnd͡ʒ **sfɾ** matɪɾ*), 43 occurrences
  corpus-wide, and every one of the 22 colon-clock instances routes through it. This is precisely the
  class the module header cites as "not a variant, IMPOSSIBLE" (ملیۆن → *mljoːn*). All three obvious
  fixes are closed: the AsoSoft builder's pair for سفر is *safar*, so the bizroke-only filter dropped the
  row on purpose and a whole-word entry would pick one reading of a genuine homograph; the tagger DOES
  read it *sɪfɪɾ* but the number path never consults the OOV resolver and `wordLevelNeuralPrepass` keys
  its map off words present in the TEXT, which a composed number word is not; and the manifest states
  "no hand IPA" for this table. It needs a NUMERAL-CONTEXT reading — the zero word is unambiguously
  *sifir* in a numeral — which is a design decision, not a port one.
- **The lexicon is looked up on the UNSTRIPPED token while the scan strips ZWNJ + tatweel**, so a headword
  whose corpus spelling carries either mark can never hit it. Measured: ×0 reachable in FLEURS + mined.
  `loadTsvMap`'s `fold` option (#1072) is the mechanism the day one appears.
- **A rate declines when its denominator is inflected**: `٨٣ کیلۆمەتر/کاتژمێرێك` — the
  `(?![\p{L}\p{M}\d])` guard rejects the ـێك suffix, the slash is then dropped, and the "per" is lost.
  ×2, plus `300میل/کاتژمێر` ×1 where میل is simply not in the numerator table. The `lo` degree shape:
  how far number–unit adjacency should stretch is a corpus argument.
- **`1 / 5` loses its slash** — ckb has no fraction rule at all. ×1, and inventing one on n=1 is #955.
- Shared shapes, ×0 attested here and already filed elsewhere: space-grouped thousands
  (`1 000 000` → *jak sfɾ sfɾ*), caret exponents (`10^6` → *da*), `25°Cx` gluing the letters onto the
  degree word, U+2212 between digits, and `007` → *ħawt* (`Number` drops leading zeros — the DECIMAL path
  is safe, because the fractional part never goes through `Number`).

### From the xh port (2026-08-27) — the reported `\p{Lu}` guard was DEAD, and the `/i` was doing a second job

**xh (Xhosa / isiXhosa, ~8M L1)** — 4 files, ~470 C# lines over a 592-line TS module. It is the Nguni
sibling of `zu` and REUSES the ported `Zulu/G2p.cs` scan, `NguniLoans.cs` and `ZuluManifest` shape with its
own table (⟨rh⟩→[x], the Xhosa number words); the shared core needed no change. Gate **118 → 119 languages,
23,296 → 23,496 rows, 0 differ, 0 BLOCKED**; C# tests 1,360 → 1,385. **200/200 on the first parity run**,
before and after the fourth fix. Full log in `docs/xh_port_investigation.md`.

`createXhosa` takes TWO English hooks and both are live: `readAsEnglish` for an embedded Latin run, and a
PREDICATE asking whether the English LEXICON knows a word — the third of the three signals that decide
click-vs-foreign. ⚠ Those are different questions, and the C# already had the right one: `EnglishKnownWord`
is `KnownWord` (CMUdict + heteronyms, `string?`) and the registry threads `w => … is not null`, matching the
TS's `knownWord(w) !== undefined`. The engine's `KnownWord`/`CanPronounce` distinction would have widened
signal 2 onto every OOV word.

Fixed in TypeScript first with tests, goldens regenerated — **0 of 200 golden rows moved for all four**:

- ⚠ **THE `\p{Lu}`-UNDER-`/i` GUARD REPORTED BY THE sl PORT IS REAL, AND THE REPAIR IS NOT "DROP THE FLAG".**
  `(u?)Mnu\.?(?=[  ]\p{Lu})` under `giu`: the lookahead requires only a letter, so the honorific's
  "expanded ONLY before a capitalised name" guard requires nothing. Unlike Slovenian — where the identical
  shape made `ga.` fire on the accusative pronoun and the regnal rule match ordinary prose — **xh has no
  attested false positive**: all 10 corpus instances are honorific + name, and `mnu`/`umnu` is not a Xhosa
  word. ⚠ **But the `i` was doing a SECOND job the report could not see**: the corpus writes the concord
  three ways — `Mnu.`, `uMnu` and sentence-initial `UMnu.` — and `(u?)` is case-sensitive material under
  that flag, so dropping it alone would stop `UMnu. Costello` expanding, a regression in the properly-cased
  column. Fixed the sl way, by spelling the concord's own case into the class (`([uU]?)`). Measured cost,
  stated: 5 occurrences over 4 corpus lines change and **every one is FLEURS' all-lowercase column 4** — a
  transcript artifact. **The fleet sweep for this shape is now down to one site**, `slovenian`'s `CLOCK_GOV`,
  which that port filed deliberately.
- ⚠ **THE a.m./p.m. MARKER HAD NO RIGHT EDGE, AND `ama-` IS A NOUN-CLASS PREFIX.** Step 8's optional group
  `[  ]*([AaPp])\.?[Mm]\.?` ended wherever it liked, so ` Am` of the FOLLOWING WORD matched it:
  `9:30 amaXhosa` read *ithoba namashumi amathathu **kusasa**aXhosa* — the word destroyed and a spurious
  "in the morning" emitted; `14:00 Amabini` → *…kusasaabini*. `ama-` heads some of the commonest nouns in
  the language (*amaqondo, amashumi, amakhulu, amapolisa*), so the neighbour is ordinary text rather than an
  adversarial construction. ×0 attested, and trap 56 exactly: the pseudo-word it leaves is invisible to every
  leak and DROP class. Fixed with `(?![\p{L}\p{M}])`; `9:30 AM` and `10:30p.m.` still read.
- ⚠ **xh COMES OFF `ACCEPTED_LOSSY`, ON ITS OWN FILE'S EVIDENCE.** It was in the list's "NO FALLBACK AT ALL"
  class ("a per-language behaviour ADDITION … wants the language's own evidence"), and the compositor has no
  ceiling — it recurses through `izigidi` multipliers — so above 2⁵³ it composed right past the rounding and
  `…001` and `…009` both read *izigidi izigidi izigidi iwaka*. The evidence was in `normalize.ts`: `spell()`
  already reads a decimal's fractional part DIGIT AT A TIME through the same compositor, for the reason its
  docstring gives. The fallback emits the string that path already emits (`KU[d]`, and the manifest's `zero`
  for 0 — ⚠ `KU[0]` is the EMPTY STRING), so nothing is invented. ⚠ The call site passes the
  SEPARATOR-STRIPPED token by construction: step 4 de-groups the TEXT, so the `\d+` match is already clean.
  Its sibling `zu` has no such precedent in its own file and stays listed.
- ⚠ **A DECLINED CLOCK STRANDED ITS COLON, AND `:` IS DECLARED CLAUSE PUNCTUATION.** Step 8 refuses a sports
  time on purpose (`4: 41.30` is a pace, not 4:41), and the colon then reached the tokenizer as a PAUSE in
  the middle of a quantity. **8 occurrences across three constructions** — the two paces and the UK degree
  class `2:2 isidanga seklasi` — and not one surviving digit-colon-digit in the corpus is punctuation. The
  playbook's "safe branch strands a separator the tokenizer reads as clause punctuation", live. A colon with
  a digit on BOTH sides is dropped after the two clock rules have had their claim; nothing is invented,
  because the operands already read as bare numbers. `Umzekelo: 5 abantu` and `ngo-2007: kwathi` keep theirs.

**Widenings.** Corpus-wide differential over **3,047 unique lines** (3,018 FLEURS `xh_za` col 3+4, 134 mined,
95 golden texts) × sync AND async = **6,094 comparisons, 0 differ, 0 throws**, plus **184 off-golden probes**
(one per arm plus the adversarial neighbour each arm must decline, the g2p corners and the loan lexicon) ×
both modes = 368 more, 0 differ. ⚠ **sync and async are byte-identical for every corpus line, and that is
correct here**: xh has no tagger of its own and its embedded English hits the already-filed "a Latin-script
host never prewarms" path, so the foreign reader serves the n-gram reading in both modes. ⚠ The corpus
carries **ZERO** instances of the relational signs `= ≈ < >`, `÷`, U+2212, a caret exponent, the euro sign, a
16+-digit run, a comma decimal with a 3+ digit tail, a decimal range carrying a unit, or spaced personal
initials — all of those rest on the probe list alone. Literal-inventory audit: no control characters either
side, and every one-sided code point is explained (the C# writes U+00A0/202F/2009 literally where the TS
escapes them; the IPA letters appear only in TS comment text). Reachability: every `UNIT_WORD`, `PER`,
`CUR_WORD`, `COMPASS`, `MAGNITUDES`, `WORD_ACRONYMS` and `NGUNI_LETTER_NAME` row fires.

**Found and NOT fixed — filed, with the count that decided it:**

- **The compass arm is case-SENSITIVE while the Celsius arm one line above is `/i`**, so `35°w` matches
  neither: the degree sign is DROPPED and the `w` reaches the g2p as a bare [w] — the exact class step 12
  exists to prevent. ×1, and it is FLEURS' lowercased column 4; a longitude is written `35°W`. Widening the
  arm on the strength of a transcript artifact would also admit a bare one-letter `n`/`s`/`e`/`w` after a
  degree sign, which Xhosa's vowel-initial locatives make less far-fetched than it looks. Recorded instead.
- **`0230UTC` reads *amakhulu amabini amashumi amathathu*** — "two hundred and thirty". Two defects in one
  token, both deliberate elsewhere: `Number("0230")` drops the leading zero (the fleet's filed shape), and
  the all-caps rule's `\d` lookbehind leaves a digit-adjacent acronym alone, so `UTC` reaches the g2p raw as
  [ˈuːtʼkǀ] — a DENTAL CLICK, which is the reading the letter-name table was written to remove. ×1 line, and
  a compact `HHMM`+timezone rule invented on n=1 is #955. The same guard costs `I-JAS 39C Gripen`, where the
  `C` reads [kǀ]; ×1.
- **`20 °Cx` loses the sign and reads BOTH letters as clicks** (*…kǀkǁ*) — the su/lo/sl `°Cx` shape, and
  worse here because c and x are clicks. All three degree arms decline on the trailing letter. ×0 attested;
  the repair is the same fleet decision, not an xh edit.
- **`1 / 5` and `1/2` lose the slash** — xh has no fraction rule at all (the fleet-wide su finding). ×0.
- **The euro sign is declared NOWHERE** — not in the tier, not in `CUR_WORD` — so `€14.7` reads *ishumi nane
  isixhenxe* with the sign silently gone, while `$`/`£`/`¥` all read. ×0 attested, and the four declared
  words are corpus tokens; a fifth would be invention.
- **A decimal range carrying a unit loses its joiner**: `1.5-2.5 km` → *kunye kuhlanu kubini kuhlanu
  iikhilomitha*. Step 6's unit arm claims `2.5 km` before step 7 can see a decimal on the right of the dash —
  and step 7's own comment lists its couplings to steps 10 and 15 but not to 6. ×0 attested.
- **SPACED personal initials keep both dots**: `N. W. Wayne` → *n . w . wayne*, two sentence breaks and two
  bare letters. Step 2's dotted-run rule needs the capitals CONTIGUOUS and its glued-initial arm needs the
  next capital adhering, so a conventionally spaced pair matches neither. ×0 attested (the corpus's initials
  are all glued, `uN.Wayne`).
- **`802.11m` reads as a measurement** — *amakhulu asibhozo nambini kunye kunye iimitha* — because step 6's
  unit arm has no version guard. The ckb `NOT_VERSION` shape. ×0.
- **A version number keeps one dot as a pause**: `1.2.3` → *kunye kubini . kuthathu*; the decimal rule
  consumes the first dot and the scan resumes past it. ×0.
- **`100 200` fuses into one number** (*amawaka ikhulu amakhulu amabini*), the space-degrouping rule's known
  ambiguity — the blocks are exactly three digits, which is the only discriminator available. ×0 in this
  shape.
- ⚠ **`csharp/regex-corpus.jsonl` IS STALE — a shared artifact, not an xh one.** Re-extracting it produces a
  579-line diff in languages this port never touched: `zulu/normalize.ts` records `(\d{1,3})(,\d{3})+` where
  the source now reads `([1-9]\d{0,2})(,\d{3})+`, and it still carries the DOUBLED PLAIN SPACE classes that
  #925/#935 widened. Re-running `csharp/tools/regex-diff` from the checked-in copy therefore exercises
  patterns that no longer exist and misses the ones that do. Run over the FRESH extraction it is clean
  (**117,045 results identical, 0 differ, 0 refused**, xh's patterns included). Reverted rather than
  regenerated here — a 579-line refresh of a shared artifact does not belong in a language bring-up.
- **`COALESCE` has three dead keys** (`e`, `o`, `u`): `connective()` looks the table up on the first letter
  of a numeral head, and every head the compositor can produce begins with `i` or `a`. Inert, not wrong —
  the file says the three-way set is written for completeness — and recorded so nobody re-derives it.

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
- ⚠ **A CORPUS COUNT IS NOT EVIDENCE UNTIL THE INSTANCES ARE READ, and this is the second time.** U+2212
  occurs 279 times across the mined artifacts, which made a fleet-wide minus rule look well-founded. The
  instances say otherwise: 223 are a leading sign (`−173 °C`), 37 are spaced arithmetic, but the UNSPACED
  digit−digit ones are RANGES (`1838−1917`, `41−49`) and scientific notation (`×10−19`). A rule built on
  the count read a lifespan as a subtraction (#955). ⚠ The same check killed a 9-language sweep that
  looked free — adding U+2212 to an existing minus class costs one character, but the character has ZERO
  attestation in every one of those nine corpora, and adding it to a rule tailored to a language's actual
  orthography is invention. Cf. the Quechua `cm` row above: reading the count said "32 kilometres",
  reading the instances said 7 of them are centimetres.
- **Data lives in `data/`, owned by neither engine.** Both resolve the same keys. The generator
  tools under `tools/` write there too — that was a review catch, not something a test found.

### From the sl port (2026-08-27) — ⚠ THE GOLDEN ITSELF WAS WRONG, and six more defects no golden can see

**sl (Slovenian, ~2.5M)** — 5 files, ~1,020 C# lines over a 1,587-line TS module, the largest normalizer in
this wave (1,068 lines). Gate **114 → 115 languages, 22,496 → 22,696 rows, 0 differ, 0 BLOCKED**; C# tests
1,320 → 1,333.

⚠ **THE FIRST PARITY RUN REPORTED 8/200 DIFFER, AND THE C# WAS RIGHT.** Running the TypeScript against the
same golden reported *the same eight rows*: `csharp/goldens/sl.tsv` had been stale since #1072 landed the
`loadTsvMap` fold a day earlier. That commit's own summary said "the goldens did not move and the parity
gate stayed at 0 differ", which was true only because **sl was unported, so nothing ran its golden.** The
reasoning behind the claim is the durable finding: "an alias is written only into a FREE slot, so no reading
the engine can already reach can change" is about LEXICON-RESOLVED readings, and a free slot is free
precisely because the word was an OOV MISS — whose fallback answer the goldens record. Slovene's fold adds
680 headwords, and eight golden rows moved off the penultimate fallback onto the lexicon
(`umrl`: *ˈumərl* → *umˈərl*). sv/nb/da/bal were re-checked the same way and are all 0 differ, because in
those four the fold repairs a broken agreement rather than adding entries. Corrected in `loadTsv.ts`'s
docstring, its C# counterpart, and Run 3 of `docs/investigations/nativiser_lexicon_seam_investigation.md`.
**A change that touches a lexicon must regenerate the goldens of every language reading it, PORTED OR NOT.**

⚠ **THE FOLD IS THE PORT'S ONE MANDATORY PIECE OF WIRING.** `stress.tsv` is the fleet's worst case: 1,252 of
37,340 keys are ə/ł kaikki respellings no Slovene input can spell. Both engines now dump a **byte-identical
38,020-key map** (37,340 file keys + 680 aliases), and the **102 shadowed pairs resolve identically** under
the unfolded-key-wins rule, whose tie-break needs the FILE'S row order — `LoadTsvMapV` gained the same
`fold` parameter its reference-type sibling already had. Pinned in `LexiconFoldTests`.

Fixed in TypeScript first with tests, goldens regenerated — **0 of 200 rows moved for all six**:

- **A 100× ERROR IN THE DECIMAL, the sr/hr/bs shape (#1076) in a fourth language that groups the same way.**
  Step 16 replaced the comma and left the fractional run as its own token, which the tokenizer reads with
  `Number()` — so `Number("001")` is 1 and `0,001 grama` read *nič vejica ena grama*, "zero point one gram".
  On top of the magnitude error it is a distinct-numbers violation: `1,05 km` and `1,5 km` read IDENTICALLY.
  The zeros are emitted as DIGITS, as in Serbian, because the number arm already reads a bare `0` as *nič*.
- ⚠ **`\p{Lu}` UNDER `/i` MATCHES A LOWERCASE LETTER, AND sl HAD TWO CAPITALISATION GUARDS BUILT ON IT.**
  Both were therefore absent, and both files state the guard as load-bearing:
    · the HONORIFIC rule ("expanded ONLY before a capitalised word, and that guard is not cosmetic" — `ga.`
      is the accusative pronoun *ga*) read `Vzel ga. je` as *Vzel gospa je*, the exact reading it was written
      to prevent;
    · the REGNAL rule claims "the intervening words must all be capitalised, so the shape … cannot match
      anything else" — and instead matched ORDINARY PROSE: `kralj je bil 12 let` → *dvanajsti let*,
      `cesar je umrl pri 40 letih` → *štirideseti letih*, `papež je bil star 78 let` →
      *oseminsedemdeseti let*, `poglavar je govoril 2 uri` → *drugi uri*. All four titles take a bare
      quantity like that in ordinary Slovene, so this is not an exotic false positive.
  Fixed by spelling the abbreviation's/title's own case into the class and dropping the flag. ⚠ **MEASURED
  COST, stated rather than hidden: 10 corpus lines change, and every one is FLEURS' all-lowercase column 4**
  (`ga. kirchner`, `dr. damadian`, `kraljica elizabeta 2`) — a transcript artifact, not Slovene text. The
  properly-cased column 3, which is what the goldens use, is untouched. ⚠ **`xhosa/normalize.ts:194` has the
  same shape** (`(?=[ ]\p{Lu})` under `giu`) and is NOT fixed here — see below.
- **The era marker's `i` flag ate a person's initials** — `N. Š.` is also two capital letters with stops, and
  this block runs BEFORE the dotted-capital-run rule, so `N. Š. Kovač je prišel` read *našega štetja. Kovač*:
  a name replaced by a date. Exactly the defect `croatian/normalize.ts` was fixed for in #1074, in a file
  that inherited the shape. All ELEVEN era instances in sl_si are lowercase, counted.
- **The degree rule TRUNCATED its count, so a decimal could never reach the fifth slot** — the Ukrainian #920
  shape. `slovenian.ts` declares that slot as "the genitive SINGULAR a decimal governs" and `counted()`
  indexes the same table the shared tier does, but `intOf` truncated first: one construction had three
  answers — `1,5 °C` → *stopinja* (nom.sg), `2,4 °C` → *stopinji* (DUAL), `0,5 °C` → *stopinje* — while
  `1,5 km` through the tier read the gen.sg *kilometra*.
- **`slCountForm` routed ZERO to the paucal**, the form for 3–4: `n <= 4` is true of 0, so `0 %` read *nič
  odstotki* and `0 km` *nič kilometri*. The shared `slavicCountForm`'s mod-10 arithmetic sends 0 to its
  many-slot, and Slovene takes the genitive plural (*nič odstotkov*). The kk `orthographic(0)` shape: a
  guard catching zero by accident. ×0 in sl_si, which writes no zero quantity at all.
- **Hygiene, no output change:** `slovenian.jsonc`'s header listed `EVA` among "the genuinely word-read ones
  … left to the g2p" while `acronymLetters` contains it — and the corpus's one instance is
  `dejavnost človeka zunaj plovila (EVA)`, an initialism. The data was right and the comment was not.

**Widenings.** Corpus-wide differential: 3,806 FLEURS `sl_si` lines (col 3+4), sync AND async, 0 differ, 0
throws. Off-golden probes: 325 hand-built lines (one per arm plus the adversarial neighbour each arm must
decline), × normalize, sync and async, 0 differ. Reachability swept: all 20 `acronymLetters` rows fire and
none is redundant (the shared OOV test would spell none of them); every `LETTER_NAME`, `DENOMINATOR`, `URA`,
`GOV_SLOT` and `COUNTED` row is reached. Coverage of the new code, measured not assumed: of 3,806 corpus
lines, 784 carry a digit, 187 an `N.` ordinal, 120 an all-caps run, 74 a colon/period clock, 60 a regnal
title, 52 a slash, 42 a period-grouped figure, 37 a unit key, 32 a numeral-initial compound, 30 a decimal
comma, 30 a dotted abbreviation, 24 a range dash, 10 an era marker, 8 a percent, 8 an exponent, 4 a degree
sign. **Currency signs and space-grouped thousands are ×0 in the corpus** — both are carried by the probes
only, and the currency table is declared on the strength of the spelled nouns.

**Found and NOT fixed — filed, with the count that decided it:**

- ⚠ **THE SHAPE IS A FLEET CLASS, AND ONE SITE REMAINS.** Swept `tools/extract_regexes.mts`'s pattern
  corpus for `\p{Lu}`/`\p{Ll}` inside an `i`-flagged pattern: after the two sl fixes, two were left; the xh
  port has since closed one, so the sweep now returns exactly ONE.
    · ~~**`xhosa/normalize.ts:194`**~~ — `(u?)Mnu\.?(?=[ \u00a0]\p{Lu})` under `giu`, the identical DEAD
      positive guard. Reported rather than fixed here, per trap 55; **verified and fixed by the xh port**,
      which found the report right about the guard and wrong about the repair — the `i` was also carrying
      the case-sensitive `(u?)` concord, so dropping the flag alone would have broken `UMnu.`. See the xh
      section below.
    · **`slovenian/normalize.ts`'s own `CLOCK_GOV`** — `[\p{Ll}\p{M}]+` under `iu`, the "ONE intervening
      adverb" slot, which therefore also admits a Capitalised word, so `do Ljubljane 15.00` takes the
      genitive slot the preposition governs rather than the ungoverned nominative. Left as it is: the
      preposition alternation needs the `i` for a sentence-initial *Ob*/*Med*, the effect is on the CASE
      SLOT rather than on which words are read, and ×0 in the corpus has an intervening capital.
  `german/normalize.ts:191` has the shape too but is built from a template and is not in the extracted
  corpus; there the `\p{Lu}` sits in a NEGATIVE lookbehind, so `/i` widens what the rule REFUSES — the
  conservative direction — and it is noted rather than filed.
- **`20 °Cx` glues the degree noun onto the letters** — *dvajset stˈɔpint͡sks*. The `(?![\p{L}\p{M}])` guard
  correctly declines the °C arm, and the BARE-degree arm then fires on the same digits. Identical to the su
  `25°Cölner` and lo `20 °Cx` findings; the repair is the same fleet decision, not an sl edit. ×0 attested.
- **`(0) c°` reads *nič t͡s*** — the scale letter is lost and the degree word never appears, the lo finding
  one bracket over. ×0 attested in sl_si.
- **A hyphen-suffixed numeral drops a leading zero**: `0830-ih` → *osemsto tridesetih*. Step 7 passes `raw`
  but `numberToWords` only consults it above 1e12, so the four-digit token goes through `Number()`. Same
  class as the decimal fix above; ×0 attested, and the shape only exists for clock hours written with a
  leading zero.
- **`UTC-5` keeps its hyphen** where `UTC+1` is read: step 11's timezone arm claims only the `+` (the
  corpus's one sign), and the g2p then drops the hyphen. ×0 attested. The cy/ga `GMT-00:43` shape.
- **`1000/2000` loses its slash** (fraction operands capped at 3 digits — the su finding, fleet-wide) and
  **a trillion reads digit-by-digit** (`numbers.ts` declares no magnitude above *milijarda*; needs a sourced
  Slovene *bilijon*, and the manifest's `magnitudes` block is the place for it).
- **`ordinalBase` accepts n < 1,000,000 but no caller can exceed four digits** — every ordinal rule's
  numeral group is `\d{1,4}`, so the 10⁴–10⁶ band of the compositor is unreachable. Inert, not wrong.
- **`53-50 km` is read as a SCORE** (*triinpetdeset proti petdeset*), because step 5a's discriminator is
  direction and a non-ascending two-digit pair is a score by construction. Documented design; recorded
  because a descending range is a real construction and the ht port filed the mirror case.

### From the rkt port (2026-08-27) — 200/200 first run; full log in `docs/rkt_port_investigation.md`

**rkt (Rangpuri / KRNB, ~15M — the largest unported language)** — ONE 27-line C# file plus a `Bootstrap`
line. Gate **118 → 119 languages, 23,296 → 23,496 rows, 0 differ, 0 BLOCKED**; C# tests 1,358 → 1,381.
`rangpuri.ts` is 40 lines and composes `makeNativeHindi` with **no overrides, no lexicon, no script
override** — the thinnest composition in the family — so every KRNB fact is in `rangpuri.jsonc` and **the
shared Hindi core needed no change**. ⚠ Per trap 55 the ported siblings (bho, hne, mai, awa, mr, ne, gu)
were used only to confirm the COMPOSITION SHAPE; no rule, value or reasoning was borrowed from any of them.

⚠ **rkt HAS NO CORPUS AT ALL, AND ITS GOLDEN IS VARIANT-DERIVED.** No FLEURS split, no
`tools/corpus/mined/rkt.jsonc`, no `attest/`, no rkt.wikipedia, nothing under `/mnt/data`.
`csharp/goldens/rkt.tsv` is 200 rows of **HINDI FLEURS text** re-rendered by `tools/gen_variant_golden.mts`,
so 200/200 pins C#↔TS parity and says nothing about Rangpuri. Its one source is
`tools/referee-eval/referees/rkt.toulmin-rp.tsv` — 370 Deva→IPA pairs machine-extracted from a two-column
PDF, which the eval config itself annotates as ~15% alignment noise. All the weight is on the widenings:
**6,851 unique lines** (3,395 FLEURS `hi_in` cols 3+4, 1,427 Devanagari strings from six sibling mined
artifacts, the 200 golden texts, the 370 referee headwords, 1,717 hand-built) × sync AND async =
**13,702 comparisons, 13,700 identical, 0 throws, 2 BLOCKED** (one mined line carrying an embedded TIBETAN
run — `bo` is unported, so TS reads `ལ་དྭགས` and C# drops it).

⚠ **AND FOUR FLEET SHAPES ARE UNREACHABLE FROM ANY TEXT rkt CAN BE SHOWN**, measured not assumed: space-grouped
thousands **0**, `0,NNN` **0**, caret exponents **0** (and `10^6` READS here, unlike pcm/ha/yo/sw/id), digit
runs >15 **0**. They rest entirely on the hand-built lines. Avagraha is 214 in the corpora and **every one is
mai/mag** (`कऽ`, `करलऽ`) — 0 in the golden, 0 in FLEURS, 0 in the referee, and rkt sets no `retainOnAvagraha`.

**Reachability sweep** (sabotage each of 124 manifest leaves, re-render all 6,851 lines): **116 live, 8 dead,
and every dead one is a DECLARATIVE STRING** — the five `signs.*.effect` fields (which the manifest's own
anusvara note already says are not dispatched), `schwaDeletion.medialRule`, `numbers.grouping`, and
`nasalVowelsAreShort` (inert because rkt declares no long vowels at all). **No lexical table is unreached.**
⚠ `schwaDeletion.medialRule` and `numbers.grouping` are dead in **nine** Devanagari manifests and
`ManifestMappingTests` cannot see either: it diffs the TOP-LEVEL key set, and both parents are claimed whole.

**Fixed in TypeScript: NOTHING, and that is the honest outcome.** No defect was found in rkt's own 40 lines
or its manifest that any available source could adjudicate. The manifest's strongest claim was tested against
the referee and HOLDS: positional voiceless deaspiration is **24 of 25 word-initial keeping [ʰ], 0 of 9
elsewhere**; voiced-aspirate retention 29/29; deaffrication 11/11. Folded backbone 236/370 (63.8%), symbol
accuracy 86.8%, residual dominated by PDF extraction noise. ⚠ Path check: `phonemizeWord` (what the referee
eval scores) and the shipped `text()` path are the SAME function here — rkt passes no lexicon, so
`word === wordRules`. Not the `pa` shape.

**Found and NOT fixed:**

- ⚠ **THE 80 WORD HAS NO FINAL VOWEL AND IT IS IN THE GOLDEN.** `numbers.tens["80"]` is ⟨आइस⟩ → ***ˈais***,
  in 2 of the 200 golden rows (`80 प्रतिशत`, `380 मीटर`). Every other ten is a transparent respelling of the
  Bengali/KRNB form with ই written ⟨इ⟩ — बिस/বিশ, चाइलिस/চল্লিশ, षाइठ/ষাট, सत्तइर/সত্তর, नब्बइ/নব্বই — and
  on that pattern 80 আশি is ⟨आशि⟩ *aʃi*, not ⟨आइस⟩ with the sibilant and vowel transposed and the wrong
  sibilant letter. NOT FIXED: the referee has NO numerals, `rangpuri.ts` states "numbers deferred", and the
  change would move golden rows on a hypothesis. Needs a KRNB numeral source — which the module header
  already names as the missing thing.
- **21–99 read as two words** (`21` → *ˈek bˈis*, `56` → *sˈɔj pˈɔsas*): `numbers.compound` is `{}`, so
  `indicNumberWords` takes its documented unit-then-tens fallback. KRNB, like Bengali, has fused irregulars
  for the whole band. Same blocker.
- **छय (6) and सय (100) are HOMOPHONES here** — both *sɔj*, because छ→s lands on the phone सय already has,
  so `356` reads *t̪ˈin sˈɔj sˈɔj pˈɔsas*. A genuine consequence of the sourced deaffrication, not an error
  in it. Recorded because the reading looks like a bug and is not.
- ⚠ **THE GEMINATE postRule GIVES ONE CONSTRUCTION TWO ANSWERS, DECIDED BY PLACE.** Its LETTER class carries
  `ʰ?ʱ?` so घ्घ→*ɡʱː* and भ्भ→*bʱː*, but `t̪ d̪ ʈ ɖ d͡z` sit in the bare tail without it, so ध्ध, ढ्ढ and
  झ्झ keep two full segments. ×0 attested — Devanagari writes द्ध, ड्ढ, ज्झ, and all three of THOSE geminate
  correctly (`बुद्ध` → *bˈud̪ːʱ*). The LIVE half is the omission of **`ɾ`**: `ɽ` is in the class and `ɾ` is
  not, र्र is the 9th most frequent geminate in the Devanagari corpora at **67 instances**, and the golden
  itself carries the ungeminated pair (`दर्रा` → *d̪ˈɔɾɾa*). Whether a geminate tap should be `ɾː` has no rkt
  referee; व्व, य्य, ह्ह, ञ्ञ are in the same bucket.
- **A guard's safe branch strands a separator the tokenizer reads as CLAUSE PUNCTUATION.**
  `makeNativeHindi`'s number token carries a nested lookbehind so a grouping comma may not follow a lone zero
  — which correctly killed the su 1000× shape (`0,001` → *एक*). The residue is that the comma then falls to
  the clause arm: `0,001` reads ***ʃˈunj , ˈek***, one number becoming two with a pause. ×0 attested
  (Devanagari text writes the decimal point) and it reaches all **17** languages built from this maker, so it
  is a family decision, not a port one.
- **The leading-zero shape is LIVE but HARMLESS here, and reading the instances is what said so.** `007` →
  *sˈat̪*. All ~45 leading-zero runs in the Devanagari corpora are clock or date fields (`06:30`, `07:30`,
  `01-01-1923`, `08.11.1992`), one UTC offset and one ISBN — in every one, dropping the zero is the RIGHT
  reading. The 100× shape needs `0` plus a fraction and no rkt-reachable text has one. ⚠ The same check
  killed a second scare: five apparent comma-decimals (`9,86`, `82,40`, `1,18`…) are all clipped INDIAN LAKH
  GROUPS (`1,72,96,455`) the tokenizer joins correctly.
- **Checked and DECLINED as a defect**: `abugida.ts` emits a plain `h` for the visarga while all nine
  Devanagari manifests map ह to `ɦ` (125 instances; `क्रमशः` → *kɾˈɔmʃɔh*). The visarga is classically
  voiceless, so the split reads as deliberate. Recorded so the next reader does not re-open it.
- **Shared shapes confirmed live, already filed elsewhere**: `1 000` → *ˈek ʃˈunj*; `2 − 2` → *d̪ˈui d̪ˈui*;
  `25°Cx` → *… ɖˈiɡɾi ks*; `1500 ई.` → *… ˈi .* (the era arm handles only ई.पू./ई.स.पू.); `11:20:30` → two
  stranded colons as pauses.
- **Inherited Hindi words in KRNB sound**, which `rangpuri.ts` already flags and refuses to guess at: the
  clock (`11:20` → *ˈeɡaɾo bˈɔd͡zkɔɾ bˈis mˈinɔʈ*), the ordinals (`1ला` → *pˈɔɦla*, Hindi पहला), प्रतिशत, the
  unit words and the whole shared symbol tier. Confirmed reachable and confirmed unsourceable — the Toulmin
  list contains none of them.
### From the ti port (2026-08-27) — the SHARED Ge'ez core needed nothing, and the C# had a cold-memo hole

**ti (Tigrinya, ~9M)** — 2 files, 279 C# lines over a 483-line TS module trio, on top of the shared Ge'ez
core Amharic already uses (`manifest.ts` folds into the engine file, as am's did). Gate **118 → 119 languages, 23,296 → 23,496 rows, 0 differ, 0 BLOCKED**;
C# tests 1,358 → 1,369; TS tests 5,552 → 5,553 (one new `describe`, 8 assertions).

⚠ **THE SHARED CORE (`Core/Geez.cs`) WAS NOT TOUCHED, AND THAT IS THE FINDING, NOT AN OMISSION.** Tigrinya
keeps the laryngeals ⟨ሀ ሐ ኀ⟩ / ⟨አ ዐ⟩ and the labiovelars that Amharic has merged, so the first question was
which side of the seam each lives on. Every one of them is a per-CODEPOINT reading, and the core's only
per-codepoint step is `map().get(ch)` over the language's own `fidel.tsv` — `ሐ` is ħa in
`data/languages/tigrinya/fidel.tsv` and ha in Amharic's, and neither engine knows the difference. The two
things the core DOES own are shared Ethiosemitic phonotactics (the epenthetic-ɨ deletion, keyed on
`illegalCluster`) and the wordspace split, and neither is language-specific: `ʕ`/`ħ` are not in `NASAL` or
`FRICATIVE`'s stop-vs-fricative split in a way that differs by language, and the labiovelars classify by
their BASE code point (`kʼʷ` → `kʼ`) exactly as the core's own comment says. Measured rather than argued:
2,155 off-golden probe lines including **every one of the 311 fidel rows in four positions** (bare, onset,
medial, coda) plus 360 synthesised ɨ-cluster pairs, sync and async, 0 differ.

Fixed in TypeScript first with a test, golden regenerated:

- **THE COMMA IS A DECIMAL POINT IN ti, AND STEP 6'S OWN ARGUMENT SAYS SO IN REVERSE.** `normalize.ts`
  Run 8 established that ti groups with the period as well as the comma, and measured all five `\d\.\d{3}`
  instances to build the discriminator. The mirror question — is `\d,\d{1,2}` a decimal? — was never asked.
  Of the **67 `\d,\d` instances in the artifact, 62 are three-digit thousands groups and FIVE are decimals**
  (`2,5 ሜ.` ×2, `1,2 ሜ.`, `99,7%`, `A 2,2`), and every one emitted a CLAUSE PAUSE inside the number and read
  its fraction as a whole number: `2,5 ሜ.` → *kɨltə , ħamuʃtə me .* — "two, five metres". A confidently wrong
  quantity, not a drop. ⚠ **ZERO instances are a comma followed by four or more digits**, so "whatever step 6
  declined" and "a one-or-two-digit fraction" name the same five strings; step 10 is written as the former
  because that is the property that decides, and because the PERIOD arm has always behaved that way
  (`2010.2011` already read as a decimal). `0,001` is the su finding one step on — step 6's leading-zero
  guard is RIGHT to refuse it as a thousands group, and the comma it correctly declines to spend then read as
  punctuation, so the guard's safe branch stranded the separator. **3 of 200 golden rows moved; 4 of 323
  corpus lines; nothing else.** `1,741.980`, the one number in the artifact carrying both marks, is untouched
  — step 6 spends its comma first, so only one mark ever survives to step 10.
- **Hygiene, no output change: step 13 claimed the °-scale letter "stays dropped", and it is READ.** It is
  outside TOKEN's alphabet, but a Latin run never reaches TOKEN — the script router splits it out and hands
  it to the English reader, so `፭°C` reads *ħamuʃtə diɡɨɾi sˈiː*, "five degrees see". ×3 in the artifact. The
  comment now states the measured behaviour; which reading is better is a fleet question about unreadable
  Latin residue, and inventing ሴልሲየስ is the refusal Run 5 already made.

Fixed in C# — **the port's second core-level C#-only defect, after ff's `LatinPhones`**:

- ⚠ **`PhonemizeAsync` READ THE PREWARM SLOT BEFORE THE BOOTSTRAP FILLED IT, so the FIRST async call of every
  process skipped the foreign-English prewarm.** `if (lang != "en" && MixedLatin(text) && PrewarmForeignEnglish
  is not null)` ran ABOVE `Registry.EnsureLanguages()`, and that call is what installs
  `PrewarmForeignEnglish` — so on call #1 the slot was null and the embedded Latin words got the n-gram
  reading instead of the BiLSTM one. `ኣብ Wolaytta ዝብል` read *ʔab wˈʌleᶦt̬ˌeᶦ zɨbl* against Node's
  *ʔab woᶷlˈeᶦt̬ə zɨbl*. C#-only: the TS reaches `prewarmForeignEnglish` through a static import.
  ⚠ **INVISIBLE TO THE GATE, AND THE REASON IS THE SAME ONE THAT MADE IT SURVIVE 118 LANGUAGES**: the memo is
  process-wide, so row 2 onward warms it, and no golden's FIRST row happens to carry a Latin OOV word. **0 of
  23,496 rows moved when it was fixed** — it was found by a one-line differential against Node, on the first
  line of ti's own corpus. It is the same family as af's "the bootstrap ran only on the sync path", in the
  arm that fix did not cover. Pinned by `AsyncPrewarmsAnEmbeddedLatinRunFromACOLDMemo`.

**Widenings.** No FLEURS transcript exists for ti, so the golden is MINED and the corpus-wide differential is
only the 323 deduplicated lines of `tools/corpus/mined/ti.jsonc` — run in full, sync AND async, **0 differ, 0
throws**. Off-golden probes: **2,155 hand-and-table-built lines**, sync and async, 0 differ, 0 empty readings
among the reachable ones, 0 digits leaked into the IPA. Coverage of what the corpus does NOT exercise, stated
rather than assumed: the corpus has **0 kg, 0 bare `m`, 0 `€`/`£`, 0 `%`-prefix, 0 `ትሪልዮን` beside a sign, 0
Ge'ez numeral above ፻, 0 integer above 10⁵ and 0 Ethiopic-Extended code points** — all carried by the probes
only. A separate numeric sweep read **every integer 0–1,200 plus the scale boundaries to 10¹³**: every reading
is non-empty, vowel-bearing, digit-free and DISTINCT from its neighbour (the ckb vowel-less-zero class and the
"distinct numbers" property, both clean). ti's `number()` passes the TOKEN TEXT to its over-cap fallback, so
it is not on `ACCEPTED_LOSSY` and does not belong there.

**Found and NOT fixed — filed, with the count that decided it:**

- ⚠ **FOUR FIDEL ROWS NO INPUT CAN REACH, in ti AND in am.** `fidel.tsv` declares ⟨ⶓ ⶔ ⶕ ⶖ⟩ (U+2D93–2D96,
  the ŋʷ labiovelars) in **both** tables, but `TOKEN`'s letter class is `[ሀ-ፚ]` = U+1200–U+135A and Ethiopic
  Extended is a different block, so no character of it ever reaches `phonemizeWord` through `text()`. The zu
  `kma` shape. ⚠ **AND THE TWO PATHS DISAGREE**: the exported `phonemizeWord` — which `test/tigrinya.test.ts`
  calls — DOES read them, so the tested path and the shipped path are not the same path here. ×0 in the mined
  artifact, ×0 in `attest/ti.jsonc`, ×0 in the golden, and the series is missing its ʷa member, so widening
  the class would be inventing coverage. Reported rather than fixed, and NOT fixed in am (trap 55).
- **`ሜ.` reads as the letter-run *me*** — ×2, both `2,5 ሜ.` / `1,2 ሜ.`, i.e. both number-adjacent. The symbol
  tier declares `m: ["ሜተር"]` but keys it on the ASCII abbreviation, and step 4 deliberately leaves a
  single-dot abbreviation's TRAILING dot because that shape "is indistinguishable from a word plus a sentence
  period" — so the reading is *me* plus a spurious STOP. A fix needs that discriminator decided, and n=2.
- **A leading zero is dropped from a bare integer**: `007` → *ʃəwʕatə* (seven), `0830` → *ʃəmontə miʔɨtn
  səlasan* (eight hundred thirty). The sl `0830-ih` finding without the hyphen; ×0 attested, and both engines
  agree.
- **`መበል`-less `Nይ` above ten still emits the orphan syllable the step exists to remove**: `11ይ` →
  *ʕasəɾtə ħadə jɨ*, `0ይ` → *zeɾo jɨ*. The out-of-table branch is documented as "left alone", but "left alone"
  is the defect state, not a neutral one. ×0 attested (all 22 corpus instances are 1–10) and the fix needs an
  ordinal series above ten that the manifest does not have.
- **One SPACE-grouped figure, and ti has no space de-grouping**: `100,000 000 ኣቶማት` reads *miʔti ʃɨħ zeɾo* —
  "one hundred thousand zero atoms" for 100 million. ×1, and it is a MIXED comma+space figure; a `(\d) (?=\d{3})`
  rule would also merge an unspaced two-number list. The #935 fleet instrument is the right way to settle it.
- **Already-filed fleet classes that ti also carries**, each ×0–1 attested: the caret exponent drops
  (`10^6` → *ʕasəɾtə ʃɨdʃtə*), a fraction slash drops (`1000/2000` → *ʃɨħ kɨltə ʃɨħ*), and `°C`'s scale letter
  is read as an English letter name (above).
### From the mag port (2026-08-27) — 200/200 first run; full log in `docs/mag_port_investigation.md`

**mag (Magahi, ~13M)** — ONE new C# file (27 lines, the `Bhojpuri.cs` shape), one `Bootstrap` line, one
`ManifestMappingTests` fact; `Registry.cs` already carried `case "mag"`. Gate **118 → 119 languages, 23,296 →
23,496 rows, 0 differ, 0 BLOCKED**; C# tests 1,359 → 1,394, vitest +4.
⚠ **THE SHARED HINDI CORE NEEDED NO CHANGE** — mag is `makeNativeHindi(magahi.jsonc, …)` and reaches only
`Hindi`, `LoadManifest`, `PhonologyLoader` and `Registry.ReadAsEnglish`, all ported for `hi`.

⚠ **ITS GOLDEN IS THE MINED TIER OVER REAL MAGAHI, NOT A VARIANT RENDER** — and that was worth checking rather
than assuming, because bho's *is* Hindi text. `mag` is not a target in `gen_variant_golden.mts`, has no FLEURS
directory, and `gen_parity_goldens.mts` reports it as `0 FLEURS + 1 mined`. So 200/200 is corpus coverage of
the language. ⚠ **The cost of having no FLEURS is that the corpus-wide differential is 302 LINES, not
thousands** — the whole mined artifact plus the golden texts (the 200 golden rows are a subset and add none).
Off-golden probes carry more weight here than in a FLEURS language, and the run that mattered proved it.

Fixed in TypeScript first with tests, goldens regenerated, then ported:

- ⚠ **MAGAHI'S ORDINAL SUFFIX IS मा, AND HINDI'S INHERITED TABLE WAS 100% UNREACHABLE.**
  `makeHindiNormalizer` takes `own?.ordinalSuffixes ?? MANIFEST.ordinalSuffixes` and magahi.jsonc declared
  none, so mag used Hindi's वाँ/वीं/वें — which `hindi/normalize.ts`'s own header defends as "pan-Hindi-belt"
  and therefore safe for the family. Measured over mag's 302 lines: **15 `digit + मा`, ALL ordinals, and 0
  of वाँ/वीं/वें and 0 of ला/रा/था/ठा.** The suffix therefore fell through to the tokenizer as its own word,
  and मा is an ordinary Magahi word ("mother"), so the failure read as fluent nonsense rather than a gap:
  `१७मा शताब्दी` → *sˈət̪ɾəɦ **mˈɑ** sət̪ˈɑbd̪ime*, `१०मा बेर` → *d̪ˈəs **mˈɑ** bˈeɾ*. Now
  *sət̪ɾˈəɦmɑ sət̪ˈɑbd̪i* / *d̪ˈəsmɑ bˈeɾ*. **4 golden rows move.**
- ⚠ **AND THE FIRST DRAFT OF THAT FIX WAS A REGRESSION NO GOLDEN AND NO CORPUS DIFFERENTIAL COULD SEE.**
  `own?.x ?? MANIFEST.x` overrides **WHOLESALE**, so a block declaring only `{"मा": 0}` silently took Hindi's
  rows AND the entire suppletive arm away: `१६वीं सदी` went *solˈəɦbĩ sˈəd̪i* → *sˈoləɦ **bˈĩ** sˈəd̪i* and
  `१ला` went *pˈəɦlɑ* → *ˈek **lˈɑ*** — the same stray-syllable defect, traded from one spelling onto another.
  Both shapes are ×0 in the mag corpus, so only the hand-built probe list (one line per ARM, including the
  arms the corpus never uses) showed it. The shipped block repeats Hindi's rows verbatim and ADDS मा; both
  suites now pin the Hindi arms and their guards (`२था` is the past copula, not 2's suffix) so it cannot be
  narrowed again. **⚠ A PER-FILE FALLBACK IS AN OVERRIDE, NOT A MERGE — declaring one row of it deletes the
  rest, and the deletion is invisible wherever the deleted rows are unattested.**
- **Manifest hygiene, 0 output change — and it is the bho class recurring, which STATUS predicted.**
  magahi.jsonc was derived from bhojpuri.jsonc and **carries copies of claims that were RETRACTED in bho and
  left standing here**: the header still said *"Native canonical-IPA definition for **Hindi (hi)**"*, ⟨ऐ⟩ and
  ⟨औ⟩ still claimed *"Bhojpuri KEEPS the diphthong"* against their own ɛ/ɔ values, ⟨श⟩/⟨ष⟩ and the
  `finalRules` note attributed Bihari-core features to *"Bhojpuri"* in a Magahi file, `provenance` ended on
  the orphaned fragment *"→ ."*, and the numbers note still called the 21–99 table *"a bounded remaining
  authoring task"* when it is complete (72 rows, hindi.jsonc's byte for byte). ⚠ **Worst of the set: ⟨य⟩ was
  annotated "palatal approximant" and ⟨व⟩ "labiodental approximant" — the descriptions of the values this
  language exists to NOT have.** The header now separates the three mechanisms by which mag speaks Hindi words,
  as chhattisgarhi.jsonc does, and magahi.ts names the hardcoded normalizer words it inherits and cannot see
  (डिग्री, प्लस, ऋण, बराबर, गुणा, भाग, बटा/आधा, और, किमी→किलोमीटर, डॉ→डॉक्टर) beside the four it confirms.
- **`nasalVowelsAreShort` IS INERT IN MAGAHI, and the inherited note argued for it from a Hindi referee.** Its
  only effect is stripping a trailing ː, and no value in this manifest carries one — Magahi has no phonemic
  length. **Sabotage-verified: flipping it moves 0 of 302 corpus lines.** Stated rather than deleted.

**Found and NOT fixed:**

- ⚠ **THE GLIDE HARDENING IS CITED WORD-INITIALLY AND APPLIED IN EVERY POSITION — the whole of what makes mag
  a separate engine, and the implementation is 5× wider than its source.** magahi.ts, magahi.jsonc's
  `provenance` and test/magahi.test.ts all state Vinod Kumar 2026 §6.2 as *word-initial* व→[b] / य→[d͡ʒ]; the
  manifest implements it as a flat `consonants` map. Counted across the 302 lines: **व word-initial 481 vs
  1,178 elsewhere; य 182 vs 1,586** — ~81% of the applications are outside the cited position, on ordinary
  words (महाकाव्य → *məɦɑkˈɑbd͡ʒ*, पाण्डव → *pˈɑnɖəb*, भारतीय → *bʱˈɑɾt̪id͡ʒ*, कौरवके → *kɔɾˈəbke*). The
  engine COULD express the narrow rule (map व→w / य→j, add `^w`→b / `^j`→d͡ʒ `postRules`, which run per word),
  so this is a decision about the source and not a machinery limit. **NOT TAKEN because there is no instrument
  to take it with**: mag has no referee (`tools/referee-eval/langs` carries awa/bho/hne, not mag) and no FLEURS
  audio, and the change would move essentially every golden row on a coin flip. Both engines keep the current
  reading; it is now PINNED by `GlideHardeningIsNotPositional` in both suites so nobody who reads only the
  words "word-initial" can narrow it silently.
- **Three of the seven shared Hindi abbreviations can essentially never fire, and the stranded dot becomes a
  CLAUSE BREAK.** Step 3's context is `\.?(\s+)(?=[\p{L}])` — a LETTER must follow — but `सं` is "number",
  `पृ` is "page" and `अध्या` is "chapter", whose complement is a NUMERAL: `सं. १०` → *sˈə̃ **.** d̪ˈəs*,
  `पृ. २५` → *pɾˈi **.** pˈət͡ʃːis*. Both halves fail at once. ×0 attested in mag; it is hindi/normalize.ts's
  table and reaches eleven languages, so reported rather than repaired here (trap 55).
- **The abbreviation and unit tables are keyed on the ASCII dot and mag writes U+0970 ॰**, ×20 in corpus:
  `डॉ॰ बाबासाहेब` → *ɖˈɔ …* against `डॉ. …` → *ɖˈɔkʈəɾ …* (×3, plus `प्रो॰`), and `कि॰मी॰` → *kˈi mˈi* against
  `किमी` → *kˈilomiʈəɾ*. Two spellings of one abbreviation, one read and one not. Fleet-shaped (hi/mr/ne write
  ॰ too).
- **`किमी` is claimed only with an ADJACENT digit and no following letter — 8 of its 16 instances fail.**
  `वर्ग किमी` ×6 (the number is two words away) and `२०० किमीसे` / `६५० किमीमे` ×2 — **Magahi glues its
  postpositions, which is the feature the corpus is judged by**, so the trailing `(?![\p{L}\p{M}])` rejects
  exactly the normal orthography. All eight read the pseudo-word *kˈimi*/*kˈimise*, which is what UNIT_WORD's
  docstring says the table exists to prevent. The new ordinal rule has the identical exposure (`१०मासे` →
  *d̪ˈəs mˈɑse*, ×0). Widening either guard is a fleet decision.
- **km² reads two different wrong ways**: `५६,०१९ किमी²` drops the square entirely and `२,००,००० किमी२` reads
  it as a following number (*… kˈilomiʈəɾ d̪ˈo*). ×1 each — the shared exponent tier is keyed on LATIN unit
  keys, so a Devanagari unit never reaches it. The ig `km³` shape.
- **`२२°उ॰` → *ɖˈiɡɾiu*** — the bare-degree replacement `"$1 डिग्री"` has no trailing space and the next letter
  fuses onto the degree word. ⚠ **×1 ATTESTED, which is the first REAL corpus instance of a shape filed
  constructed for su (`25°Cölner`), lo and sl (`20 °Cx`).**
- **Twelve Vedic citations read as fractions.** `ऋ॰ १०/१३७/१-७` → *… sˈɛ̃n̪t̪is **bˈəʈɑ** ˈek sˈɑt̪*: step 8's
  leading `(?<![\d.,])` lets the match start mid-citation. 12 of the corpus's 14 slash-with-digits are this and
  the other 2 are seat pairs — **mag has ZERO true fractions**, so the rule is a net loss in this language. A
  corpus call on a shared rule.
- **`25/12सीट` → *pˈət͡ʃːis bˈəʈɑ **bɑɾˈəɦsiʈ*** — step 8's `(?![\d/])` admits a LETTER and the composed words
  fuse onto it: one pseudo-token with the stress of neither. ×1. Trap #1 of the file's own step 2, one step on.
- **`ऋ०` injects a spurious "zero"** — the abbreviation is written with DEVANAGARI DIGIT ZERO instead of ॰,
  `foldNativeDigits` makes it `0`, and the tokenizer reads a number: *ɾˈi **sˈund͡ʒ***. ×1. Its twin `ऋ॰` is
  dropped silently instead. A hazard of the shared fold.
- **A ratio reads as pause-separated numbers.** `३:३:२:१ के अनुपात` → *t̪ˈin , t̪ˈin , d̪ˈo , ˈek …*: the clock
  arm correctly declines and `clausePunctuation` then maps every `:` to a comma. ×1, and both of the corpus's
  digit-colon-digit instances are this shape — declining is not neutral (the `lo`/`ckb` class).
- **`0,001` strands its comma as CLAUSE PUNCTUATION** → *sˈund͡ʒ **,** ˈek*, the residue of the lone-`0`
  grouping guard in `hindi.ts`'s tokenizer (the ig/uz shape). ×0 attested, and the comma is a GROUPING mark in
  this orthography so `0,001` is not a well-formed Magahi decimal to begin with. `००७` → *sˈɑt̪* is the fleet
  `Number("007")` shape; the DECIMAL path is safe because `number()` maps the fractional run digit by digit.
- Shared shapes, ×0 here, filed elsewhere: `१०००/२०००` loses its slash, `१०^६` drops its caret, `(0) c°` loses
  the scale letter.
- Hygiene for the hi owner: `hindi/normalize.ts`'s header states *"HINDI TEXT WRITES NUMBERS WITH ASCII DIGITS
  … so no digit transliteration is needed here"*. True of hi; **false of mag, where 135 of 158 digit runs are
  Devanagari.** Nothing breaks — `registry.ts`'s `foldNativeDigits` runs first — but a reader of the shared file
  would conclude the family is ASCII-only.

**Widenings.** Corpus-wide differential over all **302 unique mag lines** (the whole mined artifact + the 200
golden texts, which are a subset) plus **208 hand-built probe lines**, × sync AND async = **1,020 comparisons,
0 differ, 0 throws**, 4 BLOCKED on `tibetan` from two lines carrying an embedded Tibetan run. 13 of the 510
lines read differently sync vs async in BOTH engines — all embedded Latin reaching English's BiLSTM; mag has no
neural tier of its own. ⚠ **Coverage of the probe-only arms, stated rather than assumed**: currency signs other
than ₹, space-grouped thousands, caret exponents, U+2212, ± ÷ × < >, `℃`/`℉`, a true fraction, a `:00` clock, an
above-2⁵³ digit run and every ASCII-dotted abbreviation are ×0 in the corpus and rest entirely on the probes.

### From the lg port (2026-08-28) — 200/200 first run; full log in `docs/lg_port_investigation.md`

Luganda has no shared symbol tier (the measure noun PRECEDES its number, and the tier can only postpose), so
all seven normalization steps are local. Parity **200/200 byte-identical on the first run**, 0 BLOCKED;
corpus-wide differential over FLEURS `lg_ug` + the mined artifact + probes = **4,488 lines × sync AND async
= 8,976 comparisons, 0 differ, 0 throws, 0 PortPending**, and 0 of 4,488 outputs carry a digit or an unread
symbol. (Re-run after rebasing onto #1134 — see `docs/lg_port_investigation.md` Run 5; the line count is not
comparable to the first run's 4,442, whose hand probes were in a gitignored `.probe/` that did not survive.)

⚠ **THE GOLDEN REACHES FIVE OF THE SEVEN STEPS.** Step 1 (the English ordinal suffix) is ×0 in it, and
step 3's SPACE and PERIOD arms are ×0 in it — the period arm, the one the TS itself calls "the risky one"
because a period-grouped thousand is indistinguishable from a three-place decimal, is ×0 in FLEURS as well
and rests on the mined artifact and the probes alone.

Three findings, all reproduced IDENTICALLY by both engines, so all three were FILED (#1131, #1132).
⚠ **THE FIRST IS NOW FIXED** — #1131 landed in the TypeScript as PR #1134 while this port was in review, and
this port implements the fixed behaviour (rebased; the grapheme row came free from the shared `data/` tree,
the `NATIVE_CLASS` and prenasalisation-trigger halves were ported). Kept here as the finding that produced it:

- **⟨ŋ⟩ did not "drop outright" — the shipped path folded it to ⟨n⟩ and spoke an alveolar geminate.**
  `luganda.ts`'s `NATIVE_CLASS` note is true of `phonemizeWord` and false of `text()`: a token outside the
  class goes through `makeNativiser`, whose `UNDECOMPOSABLE` table maps ŋ→n first. `ŋŋamba` reads *nːaːᵐba*
  where `ng'amba` reads *ŋaːᵐba*, and this language's own FLEURS line *"…mu ziseŋŋendo…"* reads
  *zisenːeːⁿdo*. 2 FLEURS lines and 4 mined lines carry a literal ⟨ŋ⟩; the golden carries 0. ⚠ AND THE
  REFEREE EVAL IMPORTS `phonemizeWord` DIRECTLY, so the 99.1% measures the path where the letter is dropped,
  not the path where it is spoken as [n] — question 3, exactly (filed as #1141).
  ⚠ The fix also had to add ⟨ŋ⟩ to the PRENASALISATION trigger, which the finding did not anticipate: while
  the letter folded to ⟨n⟩ it reached that rule, so ⟨ŋk⟩ read *ᵑk*, and the grapheme row alone took that away.
  **A fix that adds an orthographic row must ask what the fold was silently doing for that letter first.**
- **The ⟨ɡ⟩ (U+0261) entry in `prenasalisable` is a "defensive alias" that makes the reading worse, not
  better.** There is no ⟨ɡ⟩ grapheme row and the superscript choice tests the ASCII string `"kg"`, so
  `nɡa` → *ⁿa*: the alias fires the prenasal rule, picks the wrong place, and drops the consonant anyway.
  Without it the same input reads *na*. ×0 in every corpus measured — latent, not live.
- **The twelve prenasal digraph rows in the grapheme table are unreachable** (question 2). `OTHER_DIGRAPHS`
  filters length-2 keys to `k[1] === "w"` or vowel+vowel, deliberately and with a comment saying so, but the
  jsonc's own block comment claims the scanner tries "…+ Cw + prenasal + vowel digraphs → singles". Verified
  row by row that the code rule reproduces all twelve byte-identically, so **no behaviour is at stake**.
### From the rn port (2026-08-28) — 200/200 first run; full log in `docs/rn_port_investigation.md`

Kirundi shares Kinyarwanda's numeral COMPOSITOR and nothing else: `Kirundi/Numbers.cs` is a wrapper around
`Kinyarwanda.Numbers.ComposeRwandaRundi` with rn's own table, and every normalizer rule was taken from rn's
own corpus rather than from the sibling — the TS header lists seven that diverge, the load-bearing one being
SQUARED, where rw's `kare` is the Kirundi ADVERB "early" in all 20 of its rn.wikipedia hits.

⚠ **rn HAS NO FLEURS CORPUS**, so PORTING.md's corpus-wide differential does not exist for this language and
the probes carry it. Differential over the mined artifact + the golden + the referee wordlist + 176 hand
probes = **2,158 lines × sync AND async = 4,316 comparisons, 0 differ, 0 throws**; 0 of 2,158 outputs carry
a digit or an unread symbol. ⚠ **THE GOLDEN REACHES ONLY FOUR OF THE NINE STEPS** (1, 2, 4, 5c and 6d are
×0 in it, as is space grouping), and ⚠ **the 1,601-line referee list is a WORDLIST carrying one digit in
total** — it exercises the g2p broadly and the normalizer not at all, which is why it is counted separately
rather than folded into a headline number.

Three findings, all reproduced IDENTICALLY by both engines, so all three FILED (#1135, #1136, #1137):

- **A CUBE READS AS A SQUARE in two of rn's three exponent paths.** `normalize.ts` states "NO CUBE WORD IS
  DECLARED … the trap 51 floor", and the shared tier honours it — but steps 4 and 8 both carry `³` in the
  pattern and map every exponent to `SQUARED`. `km³ 517` → *ibirometero kwadarato 517* and `(233/km³)` →
  *kuri kirometero kwadarato*, while `517 km³` (the tier) refuses to name it. A dropped exponent is lossy; a
  cube ANNOUNCED as a square is false. The sibling layers refuse it explicitly (nso returns the whole
  match), so this is rn's own gap, not a fleet convention. ×0 in corpus — latent.
- **Step 3's space-grouping arm eats an ASCII exponent digit.** Step 4's comment anticipates `km2` and makes
  its space mandatory, but step 3 runs FIRST and matches `2 517` inside `km2 517` (the lookbehind is
  satisfied by the preceding `m`): → `km2517`, the figure reads as 2,517 instead of 517 and **`km` reaches
  the phoneme stream raw** — the very leak step 4 exists to close. ⚠ It generalises past units (`R2 500` →
  `R2500`). ×0 in corpus — latent.
- **The `US$` compound key cannot match any of the three shapes it was declared for**, and this one is
  **LIVE**. It claims `US$4,000` but not `US $ 4,000`, which is how all three corpus instances are written,
  so `US` still reaches the g2p as the word *us* — the second half of the defect the TS header's own table
  lists as broken. Pinned as it SHIPS in `KirundiTests` rather than as the header believes it reads.

Recorded, not filed: `kirundi.jsonc`'s `convention.affricates` still reads `⟨j⟩→ʒ`, Kinyarwanda's value,
contradicting the same file's header, its own grapheme table and the shipped reading (`jana` → *d͡ʒana*) —
on the single fact that distinguishes rn from rw. `convention` is metadata neither engine reads.
