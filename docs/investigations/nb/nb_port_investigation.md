# nb — C# port investigation

⚠ This port predates the per-language investigation-doc convention, so this file begins with its findings register rather than a run log.


---

## Findings from the C# port

> ⚠ **Migrated from `csharp/STATUS.md`**, which is retired. That file was a diary plus a state
> snapshot; the diary belongs here, and the state (what is ported, what is not) is answered by
> tooling — `dotnet run --project csharp/tools/parity -- --unported`. The text below is verbatim.

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
