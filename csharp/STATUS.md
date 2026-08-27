# C# port — state as of 2026-08-26

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
- **Languages: 111 of 193 registry codes**, all **200/200** except where a golden is thinner
  (cjy 29, hsn 67 — those languages have no wikipedia and no FLEURS, so their goldens are what exists).
  **21,896 rows, 0 differ, 0 BLOCKED.** ORDER IS DESCENDING SPEAKER POPULATION (user direction), from
  `tools/language-catalogue/languages.db`.
  Ported: acm acw af afb ajp am apc apd ar ary arz as ast awa ayl az bg bho bn bs ca ceb cjy cmn cs de el en en-GB en-IN es es-419 fa ff fr fr-CA gan gu ha hak he hi hne hr hsn ht hu hy id ig it ja jv kk kl km kmr kn ko ln lo mad mai mg mi ml mr ms my nan ne nl nya oc om or pa pcm pl pnb ps pt pt-BR qu ro ru rw sd si skr sn so sr su sv sw syl ta te tg th tl tr ug uk umb ur uz vi wuu yo yue za zu.
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
- **su is the first LEXICON-ONLY golden to be gated with a second script.** `csharp/goldens/su.tsv` is a
  word list (no FLEURS text exists for Sundanese), so the corpus-wide differential is unavailable and the
  weight falls on off-golden probes: 269 adversarial lines + 471 lines lifted from `tools/corpus/mined/su.jsonc`,
  both sync and async, 0 diff. ⚠ The two mined lines that DO differ carry embedded Armenian and Khmer runs
  and are `Registry.PortPending: armenian, khmer` — blocked, not wrong.
- **sd is the second NEURAL language** (after af/fa): a per-letter BiLSTM restores the abjad's unwritten
  short vowels on OOV words. `Bootstrap.cs` installs the `NeuralRegistry` entry beside the sync engine, and
  `SindhiAsyncUsesTheTagger` pins that the async reading actually differs from the rule one.
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
