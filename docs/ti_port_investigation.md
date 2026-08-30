# ti — C# port investigation

⚠ This port predates the per-language investigation-doc convention, so this file begins with its findings register rather than a run log.


---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

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
