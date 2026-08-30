# mag (Magahi) — TypeScript → C# port investigation

Running log. Chronological, one entry per run. Negative results kept.

**The language.** Magahi / मगही, ~13M speakers, Indo-Aryan (Bihari, Magadhan), Devanagari. `src/languages/
magahi/magahi.ts` is a 45-line wrapper: `makeNativeHindi(magahi.jsonc, sharedPhonology, foreign)`. Everything
that makes it Magahi is in the manifest; everything else is Hindi's, by three separate mechanisms.

---

## Run 1 — 2026-08-27 — what is the golden, and is it mag's own text?

**Question.** `csharp/goldens/mag.tsv` might be VARIANT-DERIVED (another language's text re-rendered), in which
case 200/200 pins C#↔TS parity and nothing about coverage.

**Command / finding.**

    grep -c mag tools/gen_variant_golden.mts        → 0 (mag is not a variant target)
    ls /mnt/data/omnivoice_ipa/corpus/fleurs_transcripts/data | grep mag   → nothing
    tools/corpus/mined/mag.jsonc                    → 897 segments, "mag.wikipedia.org
                                                       (random 400 + targeted insource: fill;
                                                        NO DUMP is published for this wiki)"

`tools/gen_parity_goldens.mts` reports `0 FLEURS + 1 mined + 0 lexicon-only` for mag. The golden's rows are
byte-for-byte the mined `sample`/`hard` texts, and they are unmistakably Magahi (हे / हलै / एगो / -के).

**Implication.** The golden IS corpus coverage of Magahi — better evidence than bho's, which is Hindi text.
But there is NO FLEURS transcript, so the corpus-wide differential of PORTING.md §(1) has only the mined
artifact to run on: **302 unique lines**, not thousands. Off-golden probes have to carry more than usual.

---

## Run 2 — 2026-08-27 — the port, and the first parity run

Three files: `Languages/Magahi/Magahi.cs` (27 lines, the same shape as `Bhojpuri.cs`), one line in
`Bootstrap.cs`, one `[Fact]` in `ManifestMappingTests`. `Registry.cs` already had `case "mag"`.

    dotnet run --project csharp/tools/parity -- mag   → mag OK 200 rows, 0 differ, 0 BLOCKED

**200/200 first run.** No shared-core change was needed: mag reaches `Hindi.MakeNativeHindi`, `LoadManifest`,
`PhonologyLoader`, `Registry.ReadAsEnglish` and nothing else, and all of those were ported for `hi`.

---

## Run 3 — 2026-08-27 — the corpus-wide differential

    npx tsx .probe/mag/lines.mts     → 302 unique lines (128 hard + 200 sample, deduped;
                                        the 200 golden texts are a SUBSET, adding 0)
    npx tsx .probe/mag/probe.mts .probe/mag/corpus.txt      (sync + async)
    VERNACULA_DATA_DIR=$PWD/data dotnet run --project .probe/mag/probe.csproj -- …

**604 comparisons, 2 differ, 0 throws.** Both differing rows are the SAME line and both are **BLOCKED, not
wrong**: it carries an embedded Tibetan run (`लद्दाख (लद्दाखी: ལ་དྭགས, …)`), TS routes it to the Tibetan
engine and reads *la˩ tʰaʔ˩*, C# has no Tibetan engine and `Registry.PortPending` records `tibetan`. The line
is not in the golden.

⚠ The probe project lives in `.probe/mag/` and its `.csproj` points at
`../../csharp/Vernacula.Phonemizer/Vernacula.Phonemizer.csproj` in THIS worktree — re-checked before any
number here was believed (PORTING.md's four-times-burned warning).

---

## Run 4 — 2026-08-27 — attestation scan: which constructs does mag actually write?

`.probe/mag/scan.mts <pattern>` over the 302 lines. Counts that decided later calls:

| shape | count | note |
|---|---|---|
| `digit + मा` | **15** | ALL ordinals. See Run 5. |
| `digit + वाँ\|वीं\|वें` | **0** | Hindi's inherited suffixes |
| `digit + ला\|रा\|था\|ठा` | **0** | Hindi's suppletive spellings |
| `digit [.,] digit` | 97 | |
| `digit %` | 42 | |
| `°\|º\|℃\|℉` | 7 | 3 of them coordinates |
| `digit : digit` | 2 | both the RATIO `३:३:२:१`, no clock |
| `+ ± × ÷ < > =` | 17 | |
| `[-−–] digit` not after a digit | 7 | ALL designations (`अधिनियम-१९७१`, `RJ-२७`, `जि-२०`, `MISN-0-145`) |
| `digit / digit` | 14 | **12 are Vedic citations**, 2 are seat pairs. Zero true fractions. |
| `॰` U+0970 | 20 | `डॉ॰`, `प्रो॰`, `कि॰मी॰`, `ऋ॰`, `ई॰`, `भा॰बि॰प्रा॰`, `ए॰टी॰एम्॰एस्॰` |
| `किमी` etc. after a digit, bare | 8 | of **16** total `किमी` |
| `किमी` + glued postposition | 2 | `किमीसे`, `किमीमे` |
| `वर्ग किमी` (number, वर्ग, unit) | 6 | |
| `डॉ\|प्रो\|…` + ASCII dot | **0** | the abbreviation rule's trigger is ×0 in mag |
| space-grouped thousands, currency signs other than ₹ | 0 | probe-only |

⚠ **135 of the 158 digit runs are DEVANAGARI**, so a `\d`-keyed normalizer would be blind to almost all of
them. It is not: `registry.ts`'s `foldPass` applies `foldNativeDigits` before the engine's tokenizer, and mag
is not in `FOLD_OPT_OUT`. Verified behaviourally — `५०%`, `३०°C`, `१०:३०`, `₹५००`, `१६वीं` all read the same
as their ASCII twins. (`hindi/normalize.ts`'s header claim that "Hindi text writes numbers with ASCII digits,
so no digit transliteration is needed here" is true of hi and false of mag, but the shared fold covers it.)

---

## Run 5 — 2026-08-27 — THE FINDING: Magahi's ordinal suffix is मा, and it was read as a word

`makeHindiNormalizer` takes `own?.ordinalSuffixes ?? MANIFEST.ordinalSuffixes`, and `magahi.jsonc` declared
none — so mag used HINDI's वाँ/वीं/वें. normalize.ts's own header defends that: *"defensible for the REGULAR
suffixes — वाँ/वीं/वें are pan-Hindi-belt"*.

**Measured, that is false here.** 15 `digit + मा`, 0 of everything Hindi declares. So the inherited table was
100% unreachable and the actual Magahi suffix fell through to the tokenizer as its own word:

    १७मा शताब्दी  →  sˈət̪ɾəɦ mˈɑ sət̪ˈɑbd̪ime      (before)
    १७मा शताब्दी  →  sət̪ɾˈəɦmɑ sət̪ˈɑbd̪i          (after)
    १०मा बेर      →  d̪ˈəs mˈɑ bˈeɾ  →  d̪ˈəsmɑ bˈeɾ

This is the exact defect step 2 exists to prevent (*"emitting them separately is what made the suffix a stray
syllable"*), and the stray is worse than usual because **मा is itself an ordinary Magahi word** ("mother") —
the corpus has one, `… स्थल मा भद्रकाली मन्दिर …`, so the failure produced fluent nonsense rather than a gap.

**Fixed TS-first** by declaring `ordinalSuffixes` in `magahi.jsonc`. Test in `test/magahi.test.ts`, goldens
regenerated: **4 of 200 rows move**, all of them a `मा` ordinal.

### Run 5a — the first draft of that block was a REGRESSION, and the probe caught it

`own?.x ?? MANIFEST.x` overrides **wholesale**. A block containing only `{"मा": 0}` therefore *removed*
Hindi's rows and the whole suppletive arm:

    १६वीं सदी  →  solˈəɦbĩ sˈəd̪i   became   sˈoləɦ bˈĩ sˈəd̪i     ← the same stray-syllable defect
    १ला        →  pˈəɦlɑ            became   ˈek lˈɑ

Both are ×0 in the mag corpus, so **no golden row and no corpus differential would ever have shown it** — it
was found by reading the off-golden probe list, which carries one line per arm. The shipped block repeats
Hindi's rows verbatim and ADDS मा; it is strictly additive, and both suites now pin the Hindi arms explicitly
so the next editor cannot narrow it again.

Only the regular arm is sourced. `suppletiveConsonants`/`vowelForms` keep Hindi's (they are the mechanism for
१ला/२रा, ×0 here but harmless and previously working). `irregularOrdinals` stays inherited: `१मा`…`६मा` are
×0, so no attested reading depends on Hindi's पहला/दूसरा appearing there.

---

## Run 6 — 2026-08-27 — the glide hardening is CITED word-initially and APPLIED everywhere

`.probe/mag/glide.mts`, counting positions across the 302 lines:

    व:  word-initial 481,  elsewhere 1178   (547 distinct word types)
    य:  word-initial 182,  elsewhere 1586   (686 distinct word types)

`magahi.ts`'s header, `magahi.jsonc`'s `provenance` and `test/magahi.test.ts` all state Vinod Kumar 2026 §6.2
as **word-initial** व→[b] / य→[d͡ʒ]. The manifest implements it as a flat `consonants` mapping, so it fires in
every position: **~81% of the rule's applications are outside the position the citation covers**, and not on
marginal words —

    महाकाव्य → məɦɑkˈɑbd͡ʒ      पाण्डव → pˈɑnɖəb      भारतीय → bʱˈɑɾt̪id͡ʒ
    कौरवके  → kɔɾˈəbke        मुख्यालय → mˈukʰd͡ʒɑləd͡ʒ

The engine *could* express the cited rule — map व→w / य→j and add `^w`→b, `^j`→d͡ʒ `postRules`, which are
applied per word — so this is a decision about the source, not a limitation of the machinery.

**NOT FIXED, and the reason is that there is no instrument.** mag has no referee (`tools/referee-eval/langs`
carries awa/bho/hne and no mag) and no FLEURS audio, so nothing here can score the two readings against each
other the way the ckb ⟨ی⟩ deletion was scored. The change would move essentially every golden row on a
coin-flip. Both engines keep the current behaviour; the discrepancy is now stated in `provenance`, in
`magahi.ts`, and PINNED by tests in both suites (`GlideHardeningIsNotPositional`) so it cannot be narrowed
silently by someone who reads only the word "word-initial".

---

## Run 7 — 2026-08-27 — the manifest's inherited claims, checked one at a time

The findings register (now `docs/csharp_port_findings_investigation.md`) records that bho had **six wrong claims** in its manifest. `magahi.jsonc` was derived from
`bhojpuri.jsonc` and **carries copies of several of them, which were retracted in bho and left standing here**
— which is the whole argument against a copied comment. All hygiene; 0 output change; verified by re-running
the 302-line differential after each edit.

| claim | verdict |
|---|---|
| header: *"Native canonical-IPA definition for **Hindi (hi)**"* | wrong language; it is the Hindi template's first line |
| `provenance` ending *"…grammar-anchored base → ."* | orphaned fragment |
| ⟨ऐ⟩ *"Bhojpuri KEEPS the diphthong [ai] (बैल→bail)"* | **contradicts its own value ɛ**; retracted in bho, copied here |
| ⟨औ⟩ *"Bhojpuri KEEPS the diphthong [au]"* | same |
| ⟨य⟩ *"palatal approximant"* | value is d͡ʒ — the note describes the one letter mag exists to differ on as unchanged |
| ⟨व⟩ *"labiodental approximant"* | value is b; the note is hindi.jsonc's ʋ description, two derivations back |
| ⟨श⟩/⟨ष⟩ *"**Bhojpuri** merges …"* | a Bihari-core feature both languages have, not an import, and this is not that file |
| `finalRules` *"**Bhojpuri** keeps intervocalic əɦə"* | same |
| numbers: *"the ~80 irregular 21-99 spellings are a bounded remaining authoring task"* | stale — `compound` is COMPLETE (72 rows), and they are hindi.jsonc's byte for byte |
| `anusvara` note *"Nasal vowels are short."* | contradicts `nasalVowelsAreShort: false` at the foot of the file |
| `nasalVowelsAreShort` header (WikiPron hin_deva, कांग्रेस→kãːŋ) | about a language that HAS vowel length |

⚠ **`nasalVowelsAreShort` IS INERT IN MAGAHI.** Its only effect is `out.replace(/ː$/, "")` on the nasalized
vowel, and no value in `independentVowels` or `vowelSigns` carries ː — Magahi has no phonemic length, and the
only ː the engine produces comes from the geminate `postRules`, which run AFTER g2p. **Sabotage-verified**:
flipping it to `true` moves **0 of 302** corpus lines. Kept at its value with the inertness stated, rather
than deleted, so the key stays declared if a length contrast is ever sourced.

Also documented in the header, following `chhattisgarhi.jsonc`'s model: the THREE separate mechanisms by
which mag speaks Hindi words, only one of which can be overridden from the manifest. `magahi.ts`'s
"NORMALIZER WORDS" section named four confirmed words (प्रतिशत, बजे, मिनट, ईसा पूर्व); it now also names the
much larger hardcoded set it inherits from `hindi/normalize.ts` and cannot see — डिग्री, प्लस, ऋण, बराबर,
गुणा, भाग, बटा/आधा/चौथाई/तिहाई, और, किमी→किलोमीटर, डॉ→डॉक्टर.

---

## Run 8 — 2026-08-27 — off-golden probes, and the final differential

`.probe/mag/probes.txt`: **208 hand-built lines**, one per arm of `hindi/normalize.ts` and the shared symbol
tier plus the adversarial neighbour each arm must decline, plus the g2p corners (avagraha verbs, nukta
letters, ॐ, ऋ, visarga, conjunct geminates) and the cross-script routing cases.

    302 corpus + 208 probes = 510 lines  ×  sync AND async  =  1,020 comparisons
    → 1,016 identical, 0 throws, 4 BLOCKED (2 lines carrying Tibetan), 0 DIFFER

13 of the 510 lines read differently sync vs async in both engines — all of them embedded Latin runs reaching
English's BiLSTM. mag itself has no neural tier, so this is the delegated reader and not a mag path.

**Coverage of the probe set, stated rather than assumed.** ×0 in the 302-line corpus and therefore carried by
the probes ALONE: currency signs other than ₹, space-grouped thousands, caret exponents, U+2212, the ± ÷ × <
> signs, `℃`/`℉`, a true fraction, a clock at `:00`, an above-2⁵³ digit run, and all of `डॉ`/`प्रो`/`कु`/
`श्रीमती`/`सं`/`पृ`/`अध्या` with an ASCII dot.

---

## Found and NOT fixed

Counted first, then read — every entry below carries the number that decided it.

- ⚠ **THE GLIDE HARDENING'S SCOPE.** Run 6. The headline finding; no instrument exists to settle it.
- **Three of the seven abbreviations can essentially never fire, and the leftover dot becomes a full stop.**
  Step 3's trailing context is `\.?(\s+)(?=[\p{L}])` — a LETTER must follow. But `सं` is "number", `पृ` is
  "page" and `अध्या` is "chapter", whose complement is a NUMERAL: `सं. १०` → *sˈə̃ **.** d̪ˈəs*, `पृ. २५` →
  *pɾˈi **.** pˈət͡ʃːis*. Both halves fail at once — the abbreviation is unexpanded AND the stranded dot reads
  as clause punctuation. ×0 attested in mag (the whole ASCII-dot trigger is ×0 here), but it is
  `hindi/normalize.ts`'s table and reaches eleven languages, so it is reported rather than repaired in a mag
  bring-up (trap 55).
- **The abbreviation and unit tables are keyed on the ASCII dot; mag writes U+0970 ॰.** `डॉ॰ बाबासाहेब` →
  *ɖˈɔ …* against `डॉ. बाबासाहेब` → *ɖˈɔkʈəɾ …*; likewise `प्रो॰`. ×4 attested. `कि॰मी॰` → *kˈi mˈi* against
  `किमी` → *kˈilomiʈəɾ*, ×1. Two spellings of one abbreviation, one read and one not. Fleet-shaped (`॰` is
  standard Devanagari for hi/mr/ne too), so not a mag edit.
- **`किमी` is only claimed when a digit is ADJACENT and no letter follows — 8 of its 16 instances fail.**
  `वर्ग किमी` ×6 (the number is two words away) and `२०० किमीसे` / `६५० किमीमे` ×2 (Magahi glues its
  postpositions — the feature the corpus is judged by). All eight read the pseudo-word *kˈimi* / *kˈimise*,
  which is precisely what UNIT_WORD's docstring says it exists to prevent. Widening either guard is a fleet
  decision; the ordinal rule has the identical exposure (`१०मासे` → *d̪ˈəs mˈɑse*, ×0).
- **km² reads two different wrong ways.** `५६,०१९ किमी²` drops the square entirely (*… kˈilomiʈəɾ*, no वर्ग)
  and `२,००,००० किमी२` reads it as a separate number (*… kˈilomiʈəɾ d̪ˈo*). ×1 each. The shared exponent tier
  is keyed on LATIN unit keys, so a Devanagari unit never reaches it. The ig `km³` shape.
- **`२२°उ॰` → *ɖˈiɡɾiu*** — the bare-degree replacement is `"$1 डिग्री"` with no trailing space, so the
  following letter fuses onto the degree word. ×1 **attested**, which is the first real corpus instance of a
  shape filed constructed for su (`25°Cölner`), lo and sl (`20 °Cx`).
- **Twelve Vedic citations read as fractions.** `ऋ॰ १०/१३७/१-७` → *… ˈek sˈɔ sˈɛ̃n̪t̪is **bˈəʈɑ** ˈek sˈɑt̪*.
  Step 8 claims `१३७/१` after the leading `(?<![\d.,])` lets it start mid-citation. 12 of the corpus's 14
  slash-with-digits are this shape and the other 2 are seat pairs (`17/8 सीट`) — mag has **zero** true
  fractions, so the whole rule is a net loss here. A corpus call on a shared rule, not a port call.
- **`25/12सीट` → *pˈət͡ʃːis bˈəʈɑ **bɑɾˈəɦsiʈ*** — step 8's `(?![\d/])` admits a LETTER, and the composed
  words then fuse onto it: one pseudo-token with the stress of neither word. ×1. Same "never a bare match
  where a letter may follow" class the file names as trap #1 for its own step 2.
- **`ऋ०` injects a spurious "zero".** The abbreviation is written with DEVANAGARI DIGIT ZERO instead of ॰;
  `foldNativeDigits` turns it into `0` and the tokenizer reads it as a number — *ɾˈi **sˈund͡ʒ***. ×1. Its
  twin `ऋ॰` is silently dropped instead. A hazard of the shared fold, not of mag.
- **A ratio reads as pause-separated numbers.** `३:३:२:१ के अनुपात` → *t̪ˈin , t̪ˈin , d̪ˈo , ˈek …* — the
  clock arm correctly declines (its `(?![\d:])` sees the next colon) and `clausePunctuation` then maps every
  `:` to a comma. ×1, and both colons in the corpus are this. The `lo`/`ckb` class: declining is not neutral.
- **`0,001` strands its comma as CLAUSE PUNCTUATION** → *sˈund͡ʒ **,** ˈek*. The tokenizer's `(?<!(?<![digit])
  0),` guard was added to stop `0,001` joining into *एक*; the residue is the ig/uz stranded-separator shape.
  ×0 attested in mag (`0,`-after-a-non-digit is ×0 in the corpus), and the comma is a GROUPING mark in this
  orthography, so `0,001` is not a well-formed Magahi decimal in the first place. Recorded, not repaired.
- **`००७` → *sˈɑt̪*** — `Number("007")`. The ckb/fleet leading-zero shape; the DECIMAL path is safe here
  because the fractional run never goes through `Number` (`number()` maps it digit by digit). ×0 attested.
- Shared shapes with ×0 attestation here, already filed elsewhere: `१०००/२०००` loses its slash (fraction
  operands capped at 3 digits), `१०^६` drops its caret, `(0) c°` loses the scale letter.
- Hygiene, no output change: `hindi/normalize.ts`'s header states *"HINDI TEXT WRITES NUMBERS WITH ASCII
  DIGITS, so no digit transliteration is needed here"*. True of hi; **false of mag**, where 135 of 158 digit
  runs are Devanagari. Nothing breaks — `registry.ts`'s `foldNativeDigits` covers it before the engine
  runs — but a reader of the shared file would conclude the family is ASCII-only. Left to the hi owner.

---

## Result

| | before | after |
|---|---|---|
| parity, mag | — | **200/200, 0 differ, 0 BLOCKED** |
| fleet | 118 languages / 23,296 rows | **119 languages / 23,496 rows, 0 differ, 0 BLOCKED** |
| vitest | 5,552 passed | **5,556 passed, 5 skipped** (+4, all in test/magahi.test.ts) |
| C# tests | 1,359 | **1,394 passed** (+35, MagahiTests.cs) |
| corpus + probe differential | — | 1,020 comparisons, 0 differ, 0 throws, 4 BLOCKED (Tibetan) |

---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

### From the mag port (2026-08-27) — 200/200 first run

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
