# Danish (da) TypeScript → C# port — investigation log

Chronological. Each run records the command, the question it was meant to answer, the raw finding, and what
that implied for the next step. Negative results are kept.

Context: da is a NEURAL language (`danishNeural.ts` + `danishTagger.ts` install a per-grapheme BiLSTM beside
the sync engine) and its lexicon needs the #1068 `fold` at load. The gate is
`dotnet run --project csharp/tools/parity -- da` against `csharp/goldens/da.tsv`, which is ASYNC-mode output.

---

## Run 1 — 2026-08-27, before writing any C#

**Question.** Which of da's four lexicon keys the nativiser rewrites, and which of them clash?

**Command.** A `tsx -e` script over `nat` / `lexicon()` and the raw TSV.

**Raw finding.**

```
rows 37008
unfolded-unreachable: [ voilà→voila, genève→geneve, jón→jon, joão→joao ]
map size 37009
```

Only ONE alias lands (`joao`): `jon`, `voila` and `geneve` already exist in the file and WIN. `jón`/`jon`
and `voilà`/`voila` carry the SAME value; `genève` ʃeˈnɛv against `geneve` ʃeˈnɛːv do NOT — that pair is da's
single row in `test/lexicon-reachability.test.ts`'s shadowed ledger.

**Implication.** The C# `LoadTsvMap` must be handed `fold: Nat` and must iterate the FILE'S ROWS, not the
dictionary. Pinned in C# as `DanishLexiconIsLoadedThroughItsOwnNativiser`.

---

## Run 2 — 2026-08-27, reading `numbers.ts` against the fleet's #1059 shape

**Question.** Does da's number call site thread the token text, or re-derive the digits from the double?

**Command.** `phonemize("9007199254740993","da")` and `phonemize("12345678901234567890","da")` in Node.

**Raw finding.** `9007199254740993` and `9007199254740992` read IDENTICALLY (…*ˈtoːˀ*, the rounded
value's last digit), and `12345678901234567890` ends *ˈnɔl ˈnɔl ˈnɔl* against a written `890`.
`danish.ts` calls `numberToWords(Number(m[2]))`; `numbers.ts` never declared `raw`, although the shared
`unitsFirstNumberToWords` it wraps accepts one. da was on `large-numeral-fidelity`'s ACCEPTED_LOSSY.

**Implication.** Fixed TS-first (thread `raw` through both), test added, da removed from ACCEPTED_LOSSY
(the list that may only shrink). `gen_parity_goldens.mts da` moved **0 rows** — the golden's longest digit
run is 5, so the gate could never have seen this. ⚠ `fo`, `lb` and `bar` share the same composer and are
still on the list; reported, not touched (separate bring-ups, trap 55).

---

## Run 3 — 2026-08-27, first C# build and first gate

**Command.** `dotnet run --project csharp/tools/parity -- da`

**Raw finding.** `da OK 200 rows` — 200/200 on the first run, with the `NeuralRegistry` entry and the
`fold` in place from the start.

**Implication.** The gate is closed but proves only agreement. Everything below is the widening.

---

## Run 4 — 2026-08-27, corpus-wide differential

**Question.** Do the two engines agree off-golden, and is the tagger actually running?

**Command.** `cat …/fleurs_transcripts/data/da_dk/*.tsv | cut -f3,4 | tr '\t' '\n' | sort -u` → 3,756 lines
(first line verified to be a SENTENCE, not a WAV filename), then both engines in three modes
(normalize / sync / async).

**Raw finding.** 11,268 rows, **0 differ**. Of the 3,756 lines, **2,919 read differently in async than in
sync** — so the tagger is live on 78% of the corpus and C# matches Node on every one of them. Example:
`madretter` rule *mˈadʁetɐ* → tagger *ˈmaðˌʁɛdɐ*.

**Implication.** The tagger is wired, not silently falling back. Pinned as `DanishAsyncUsesTheTagger`.

---

## Run 5 — 2026-08-27, corpus coverage of the normalizer's arms

**Question.** Which arms did Run 4 actually exercise? A clean differential over a corpus that carries none
of a construct proves nothing about it.

**Raw finding** (of 3,756 lines): digit 746, dotted ordinal 108, period-grouped thousand 82, `km` 46, dotted
abbreviation 38, span 33, decimal comma 32, colon clock 26, rate slash 18, currency sign 12, percent 8,
degree 4, exponent 4, ampersand 4. **ZERO**: relational signs, U+2212, infix `+`, `NxN`, space-grouped
thousands, >12-digit runs, multi-comma numerals, `h:mm:ss`.

**Implication.** Those arms rest entirely on hand-built probes. Two probe files were written (184 + 95
lines), both run in all three modes: **0 differ, 0 throws**. The 95-line file includes the four space
characters (U+0020, NBSP, U+2009, U+202F) against seven separator-bearing shapes — the #925 sweep's shape.

---

## Run 6 — 2026-08-27, reading the normalize probe output

**Question.** Not "do the engines agree" but "IS this right?".

**Raw findings, from `norm` mode:**

| input | output | verdict |
|---|---|---|
| `0,001 gram` | `0 komma 0 0 1 gram` | correct — da does NOT have su's 1000× comma defect |
| `802.11a` | unchanged | correct — the `\d{3}` bound separates grouping from the technical shape |
| `35°V` | `35 graderV` | **DEFECT, corpus-attested ×2** |
| `20 °Celsius` | `20 graderCelsius` | same defect |
| `5 km³` | `5 kilometer³` → *fem kilometer* | the mark is dropped (ig's finding); ×0 |
| `19:19:19` | `19 19:19` → *nitten nitten , nitten* | stranded colon = clause punctuation; ×0 |
| `12,345,678` | `12 komma 3 4 5,678` | stranded comma = clause punctuation; ×0 |
| `01. maj` vs `01.-02. maj` | cardinal+dot vs `første til anden` | leading-zero inconsistency between arms; ×0 |
| `%50` | `50 procent` | the shared tier reads it — the file's claim that its `percent` declaration "never fires" is wrong |
| `1838−1917` | unchanged | U+2212 fuses a range; ×0 |
| `$110m` | `110 dollar m` | correct — step 12's trap-56 repair works |

**Implication.** `35°V` is the one with corpus attestation, and the repair it needs is ALREADY IN THE SAME
FILE — step 12 spaces the currency noun off a glued magnitude for exactly this reason. Fixed TS-first:

```
er registreret øst for 35°V.   before: … ɡʁˈaðeʁv .      after: … ˈɡʁɑːðɐ ˈveːˀ .
```

`gen_parity_goldens.mts da` moved **0 rows** (the golden carries no degree sign). Everything else in the
table is filed with its count, per #955 — the corpus does not contain the construct, and adding an arm on
zero attestation is invention.

---

## Run 7 — 2026-08-27, the tagger/engine tokenizer seam

**Question.** `danishNeural.ts` says "the pre-pass keys the tagged map by the raw match, which is what the
sync engine hands `oovOverride`". Is that true?

**Command.** For every LATIN_RUN token in the corpus, compare `nat(w)` with `w`, and compare the pre-pass's
`WORD = /[a-zæøåéöäüóèãà]+/giu` tokenization with the engine's.

**Raw finding.** It is NOT true — `danish.ts` hands `phonemizeWord(nat(m[1]), oovOverride)`, i.e. the
NATIVISED spelling. 30 of 77,167 Latin tokens are rewritten by `nat`; 24 of them the hand-listed `WORD`
class also splits. Of the 27 distinct types, 6 are lexicon-covered (no seam) and **21 reach the rule engine
where a tagger reading existed**:

```
Galápagosøer  rule ɡˈalapaɡosøɐ    tagger ɡaˈlaːˀpaˌɡɐsˌøːˀɐ
taínoer ×2    rule tˈainoɐ         tagger ˈtɑjˌnoːˀɐ
Guaraníerne   rule ɡˈuaʁanieʁnə    tagger ɡuɑˈʁɑːˀnjɐnə
Haldarsvík    rule hˈalaʁsvik      tagger ˈhaldɑːˌsviːɡ
Chişinău      rule khˈisinau       tagger ˈkiʃinɑw
Asunción      rule ˈasunsion       tagger asunˈʃɔːn
Cañitas       (split into `Ca` + `itas`, two readings nothing asks for)
…
```

The tagger declines NONE of them, because the fold has already removed the out-of-vocab letter.

**Implication.** A tier the file exists to install was skipped for 22 corpus tokens — the #901 "is every
table reached?" shape, with the false premise written down in the file. Fixed TS-first: `WORD` is now
`LATIN_RUN` and `key` is `nat`, both imported from `danish.ts` so the two tokenizers cannot drift again.
**1 golden row moved** (the `Galápagosøer` sentence) — the only golden movement in the whole port.

---

## Run 8 — 2026-08-27, manifest reachability by sabotage

**Question.** Does anything read every value `danish.jsonc` declares?

**Command.** `.probe/da/sabotage.mts` — corrupt each of the file's 132 string leaves in turn to `"ZQX"`,
re-run a probe in a fresh process, and report the leaves whose corruption changes NOTHING. The probe is
every letter × 8 shapes through `phonemizeWordRules`, every integer 0–120 plus the magnitudes, every ordinal
1–31, every clause mark, and one sentence. (Stating the probe's coverage first, per the ps lesson: a
reachability sweep measures the probe as much as the key.)

**Raw finding.** 26 unreached leaves, of which 22 are prose (`provenance`, the `convention` block, comment
text the crude scanner picks up) and **4 are real data**: `consonants.t`, `.d`, `.r`, `.c`. Those are
exactly the four letters intercepted by context rules before the `C[c]` fall-through — and each rule carried
a LITERAL COPY of the manifest's value, so both engines agreed about a value neither read.

**Implication.** Fixed TS-first: the DEFAULT phone of each of those four rules now comes from the manifest;
only the context ALLOPHONES (ð, final-⟨t⟩ [d], soft-⟨c⟩ [s]) stay literal, which is what the manifest's own
header already says ("d/g/r/h are overridden by context rules in g2p.ts"). **0 golden rows.** Re-running
the sweep: **26 → 22 unreached, all 22 prose.**

---

## Run 9 — 2026-08-27, literal-inventory audit

**Command.** Count non-ASCII control / format / space code points per file across `src/languages/danish/*.ts`
and `csharp/…/Languages/Danish/*.cs`.

**Raw finding.** Clean — no invisible character carries semantics in either tree (the #931 shape does not
apply here).

---

## Run 10 — 2026-08-27, final gates

```
npx vitest run                                   284 files, 5,532 passed, 5 skipped
dotnet test csharp/Vernacula.Phonemizer.Tests    1,310 passed, 0 failed
dotnet run --project csharp/tools/parity         115 languages byte-identical, 22,696 rows, 0 differ, 0 BLOCKED
dotnet run --project csharp/tools/parity -- da   200/200
.probe/da corpus differential (3,756 × 3 modes)  11,268 rows, 0 differ
.probe/da probes (184 + 95 lines × 3 modes)      837 rows, 0 differ, 0 throws
```

All three post-fix differentials were re-run after each TS fix landed and was ported, not only at the end.

---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

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
