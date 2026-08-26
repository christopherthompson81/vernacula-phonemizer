# C# port — state as of 2026-08-25

Resume here. Read `PORTING.md` first; it is the contract and it has been amended five times — most recently to REVERSE the "keep comment text" rule.

## Done

| | |
|---|---|
| Scaffold | `Vernacula.Phonemizer` (net10.0) + xunit tests + `tools/parity`, solution wired |
| Core | **26 of 28** TS core modules ported, ~6,300 lines, `dotnet build` clean |
| `JsRegex.cs` | the pattern translator (407 lines) — **all** regexes route through it |
| `DataPath.cs` | resolves the shared root `data/` tree; mirrors `src/core/dataPath.ts` |
| `Registry.cs` | 859 lines, self-registration (`Registry.Register("thai", () => …)`); languages slot in without editing it |
| Goldens | 169 files in `csharp/goldens/` (100 FLEURS-text, 68 mined-corpus, 1 lexicon-only). ⚠ ASYNC-MODE output — the gate calls `PhonemizeAsync` |

## State

- **Core: 28/28 done.** The regex translator is differentially verified against Node (118,014 results, 0 diff).
- **Languages: 64 of 182**, plus the 5 accent variants — en, af, el, qu, ru, kl, mi, ceb, am, oc, bg,
  or, ast, umb, kn, hi, cmn, es, ar, arz, pt, bn, as, fr, ja, de, id, ms, ur, pa, fa, tg, th, mr, te, ha,
  tr, ta, sw, yue, vi, ko, jv, it, gu, pl, uk, ro, nl, hu, yo, my, ln, ps, ml, om, ig, sd, su, uz, ff, lo,
  zu, az — all **200/200**. 69 gated codes, 13,800 rows, 0 differ. ORDER IS DESCENDING SPEAKER POPULATION
  (user direction), from `tools/language-catalogue/languages.db`.
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
  `tools/gen_variant_golden.mts`: measured, the 7 Arabic dialects plus bho/rkt/grc read MSA-or-Hindi text
  0/25 identically to their base, so a variant golden pins something real. zsm/pbt/bgc read 25/25
  identically and a golden there would only restate the base file. See the investigation doc.
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
