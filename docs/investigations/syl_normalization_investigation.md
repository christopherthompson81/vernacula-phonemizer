# syl (Sylheti) — text-normalization investigation

Branch `norm/syl`, in its own worktree. Method: `docs/normalization_playbook.md`.

## Run 1 — 2026-08-12 09:10 — what already exists

    ls src/languages/sylheti/ ; ls tools/corpus/mined/ | grep syl ; ls test | grep syl

Question: is step 0b (mine the artifact) already done, and what is the engine?

Raw finding: `tools/corpus/mined/syl.jsonc` EXISTS and is **dump-sourced**
(`syl.wikipedia.org dump (pages-articles, paragraphs)`, 1523 segments, `cellsCovered 23/35`), so its
`sample` tier is a real distribution. Engine `src/languages/sylheti/sylheti.ts` (82 lines) + manifest
`sylheti.jsonc`. `test/sylheti.test.ts` exists with 2 committed golden g2p tests. No `normalize.ts`.

Engine shape: `TOKEN = /([ꠀ-꠬]+)|(\d+)|([꠨꠩।.?!,])/gu`, `clausePunctuation` = `꠨ ꠩ । . ? ! ,`.

Implication: step 0b is done; go straight to reading the corpus. Note the TOKEN letter class
`[ꠀ-꠬]` is U+A800–U+A82C, which **contains** U+A828–U+A82B (the poetry marks ꠨ ꠩ ꠪ ꠫) — the word
alternative is first in the alternation, so a standalone poetry mark is claimed as a WORD and never
reaches the punctuation arm. Flagged for probing.

## Run 2 — 2026-08-12 09:25 — THE SCRIPT QUESTION (the brief's first hazard)

    python3 — count code blocks over every "text" value in tools/corpus/mined/syl.jsonc

Question: is the syl wiki dual-script (Syloti Nagri + Bengali-Assamese), as the brief warns?

Raw finding, over the artifact's 122 excerpt segments:

    SylotiNagri 35930 · Latin 1462 · ⁕(U+2055) 476 · BengaliDigit 463 · ASCIIdigit 271
    BengaliLetter 90 (8/122 segments) · Devanagari 25 · IndicNumberForms(U+A830) 0

Reading the 90 Bengali-letter instances one by one (they are the whole question):

    ়(nukta) 17 · ্ 6 · ৳ 5 · ব 5 · া 5 · ণ 4 · ূ 4 · ৷ 4 · র 4 · ল 3 · শ 3 · ঁ 2 · ৃ 2 …

and their contexts split cleanly into three, none of which is "the article is in Bengali script":

1. **Bengali marks typed INSIDE a Syloti Nagri word** — `ꠝূꠟ꠆ꠎꠝꠣꠘ`, `ꠙꠞꠤꠝꠣণꠦ`, `ꠛꠤꠛꠦꠌꠘꠣꠎ়`,
   `ꠀঁꠡ`, `ꠃৎꠙꠣꠖꠘ`, `ꠝ꠆ꠎꠣঙ꠆ꠉꠣꠘꠤꠎ`, `ꠟৌꠢ`, `ꠙ꠆ꠞꠜৃꠔꠤ`, `ꠗꠞ꠆ꠝꠣꠛꠟꠝ꠆ꠛꠤ৷`. These are typing slips
   from a Bengali keyboard, not a script choice.
2. **Genuine Bengali-script GLOSSES**, all inside a `꠪`-introduced language tag:
   `(ꠛꠦꠋꠉꠟꠤ ꠝꠣꠔꠖꠤ ꠪ বাংলাদেশ ꠨ ꠀꠋꠞꠦꠎ ꠝꠣꠔꠖꠤ ꠪ Bengal)` — Bengali quoted AS Bengali, one instance;
   plus one quoted Bengali sentence about scripture (`ঈশ্বরের`, `শাস্ত্র`, `বইগুলো`).
3. **`৳` U+09F3 BENGALI RUPEE SIGN ×5** — the taka sign, which is the currency sign of the language's
   own country and is not a "Bengali-script" fact at all.

Implication: **the syl wiki is a SYLOTI NAGRI corpus.** The Bengali-Assamese hazard is real but takes
the shape of (1) — stray Bengali marks that BREAK a Syloti word — not of a second orthography needing a
parallel rule set. A rule keyed on Syloti Nagri is therefore not silently a no-op here. Recorded as the
answer to the brief's ⚠, and (1) becomes a rule.

## Run 3 — 2026-08-12 09:35 — THE DIGIT QUESTION

    grep -n foldNativeDigits src/registry.ts ; probe phonemize("৫২৬ ꠎꠣꠔꠤ","syl")

Question: does syl need the explicit `toAscii` the brief cites from `ps` (commit fdab9b1)?

Raw finding: **no.** `registry.ts:331` folds native digits for every language except the `te` opt-out,
at the single dispatch point, and its own comment names `syl` as one of the seven engines whose digits
used to read as the empty string. Verified live: `৫২৬ ꠎꠣꠔꠤ` and `526 ꠎꠣꠔꠤ` both read
`ɸas ʃɔ sabːiʃ zat̪i`. Syloti Nagri has **no digit block of its own** (U+A800–A82F is letters and
poetry marks; U+A830–A83F is Common Indic Number Forms, ×0 in this corpus), so the corpus writes
Bengali digits (463) and ASCII (271) and both already work.

Implication: no digit fold in `normalize.ts`. But every rule I write must be keyed on `\p{Nd}`, never
`[0-9]` and never `\d` — the corpus is 63% Bengali-digit and a `\d` rule would silently cover a third
of it. (Trap: "a guard written for one writing system is blind in another".)

## Run 4 — 2026-08-12 09:50 — engine probes on the attested surface forms

    npx tsx <probe>.mts   (phonemize(form,"syl") over corpus-attested shapes)

Question: what does the engine actually produce today?

    "ꠘꠎꠞꠈꠣꠞꠣ ꠨ ꠜꠣꠃꠀꠁꠟ" → "nɔzɔɾxaɾa bauail"   ꠨ SWALLOWED, no pause
    "ꠉꠞꠝ ⁕ ꠙꠣꠘꠤ"          → "ɡɔɾɔm ɸani"        ⁕ dropped, no pause
    "ꠀꠍꠤꠟ꠫ ꠙ꠆ꠞꠝꠣꠘ"        → "asil ɸɾɔman"       ꠫ swallowed, no pause
    "ꠈꠟꠦꠎ ॥ ꠡꠛ"           → "xɔlez ʃɔb"         ॥ dropped, no pause
    "ꠀꠋꠞꠦꠎꠤ ꠪ Bengal"      → "aŋɾezi bˈɛŋɡəɫ"    ꠪ swallowed, no pause
    "ꠅꠁꠍꠤꠟ। ꠀꠝꠞ"          → "ɔisil . amɔɾ"      ।  OK (already declared)
    "১৮°ꠍꠦ."              → "aʈaɾɔ se ."        ° dropped; ꠍꠦ. read as a syllable + a PAUSE
    "-২৭৩.১৫°"            → "d̪ui ʃɔ t̪in ʃɔt̪ːɔɾ . ɸɔneɾɔ"   minus dropped, decimal → a PAUSE
    "১,০০,০০০"            → "ex , ʃunːo , ʃunːo"  grouping commas → pauses, number destroyed
    "১০০%"                → "ex ʃɔ"              % dropped
    "২৫ ꠝꠤ.ꠉ꠆ꠞꠣ."         → "ɸɔsiʃ mi . ɡɾa ."   abbreviation split into 3 pauses
    "ꠝূꠟ꠆ꠎꠝꠣꠘ"            → "mɔ lzɔman"          Bengali ূ splits the word in two
    "৳৫ ꠐꠦꠈꠣ"             → "ɸas ʈexa"           ৳ dropped (word present here — trap 12 REDUNDANT)
    "০ ꠒꠤꠉ꠆ꠞꠤ ꠇꠦꠟꠜꠤꠘ"     → "ʃunːo ɖiɡɾi xelbin" (control: the degree word phonemises fine)

Implication: the largest defect by count is not a number rule at all — it is that the corpus's own
SENTENCE TERMINATOR is not declared. That is playbook step 3 ("check whether the defect is even in this
layer"): `⁕`/`॥`/`꠫`/`꠪` and the unreachable `꠨` belong in `sylheti.jsonc` + `TOKEN`, not in
`normalize.ts`.

## Run 5 — 2026-08-12 10:00 — corpus tabulation (excerpt tier, 122 segments)

Counts over the artifact's own text, with a `[0-9০-৯]` digit class (never `\d`):

    ⁕ 476 · ꠨ 226 · ꠪ 24 · ꠫ 6 · ꠩ 1 · । 9 · ॥ 8
    abbrev-dot(ꠀ-꠭ followed by .) 51 · decimals 26 · ranges 21 · grouped 13
    degree ° 13 · percent % 10 · taka ৳ 5 · × 6 · + 3 · = 37 · & 2 · &nbsp; 69
    Bengali-letter-in-word 90 · zero-width 15

Whole-corpus counts from the artifact's own `counts` block (1523 segments): `digit-run` 160,
`year` 158, `latin-in-native` 337, `ampersand` 103, `quote-letter` 51, `decimals` 25, `ranges` 25,
`initialism` 25, `signs` 29, `zero-width` 17, `abbrev` 15, `grouped` 9, `signed-number` 7,
`degrees` 4, `percent` 3, `currency` 1, `units` 0, `rate` 0, `exponent` 0.

READING THE INSTANCES rather than the counts (trap "a count is a lead"):

- **`꠨` is a COMMA, and the corpus says so in its own words.** One segment glosses the punctuation
  inventory outright: `ꠅꠞ ꠝꠣꠏꠈꠣꠘꠧ ꠇꠝꠣ (꠨) ꠀꠞ ꠖꠥꠁ ꠒꠦꠘ꠆ꠒꠣꠞ (॥)` — "…the COMMA (꠨) and the DOUBLE
  DANDA (॥)". Usage agrees: `(৪০%) ꠨ ꠇꠥꠟꠣꠃꠠꠣ (৩০%) ꠨ ꠀꠞ …`, `…ꠇꠥꠟ ꠨ ꠄꠝꠍꠤ ꠇꠟꠦꠎ ꠨ ꠇꠟꠇꠣꠔꠣ ꠞꠤꠙꠘ
  ꠇꠟꠦꠎ ॥` — a list of colleges, separated by ꠨ and TERMINATED by ॥. The manifest currently maps ꠨
  to `.` — wrong value AND unreachable.
- **`꠪` is a COLON** — every one of its 24 instances introduces a gloss: `ꠀꠋꠞꠦꠎꠤ ꠪ FIFA World Cup`,
  `ꠛꠦꠋꠉꠟꠤ ꠝꠣꠔꠖꠤ ꠪ বাংলাদেশ`, `IPA ꠪ [rɐˈsʲijə]`, `ꠝꠥꠖ꠆ꠞꠣ ꠙ꠆ꠞꠔꠤꠇ ꠪ ৳`.
- **`꠫` and `॥` are FULL STOPS** — `…ꠀꠍꠤꠟ꠫ ꠙ꠆ꠞꠝꠣꠘ ꠕꠣꠇꠤ…`, `…ꠟꠣꠇꠣꠘ꠫ ꠝꠣꠟꠣꠅꠤ,…`, and the college
  list above.
- **`=` ×37, `&` ×2, `×` most of 6 are NOT language text.** They are unstripped citation-template and
  URL residue: `|last1=Lawson |first1=Sarah |s2cid=144`, `lsi.php?volume=5-1&pages=463#page/1/mode/1up`,
  `|ꠜꠧꠟꠤꠃꠝ=69 |ꠙ꠆ꠞꠤꠡ꠆ꠑꠣ=80 97 |doi=10.1016/…`. The scan's `DROP math-sign ×15` and
  `FOREIGN ampersand ×2` are these. DECLINED as rules — writing an `=` reading for wikitext would be a
  rule about the mining, not about Sylheti.
- **`-` is a genuine NEGATIVE in the degree instances** — `ꠍꠦꠟꠍꠤꠀꠍ ꠁꠃꠘꠤꠐꠅ -২৭৩.১৫° ꠍꠦ. ꠀꠞ
  ꠚꠣꠞꠦꠘꠢꠣꠁꠐ ꠁꠃꠘꠤꠐꠅ -৪৫৯.৬৭° ꠚꠣ.` (absolute zero). Not a range, not a designation.
- **The degree SCALE NAMES are in the corpus in full**, which refutes `sources.ts`'s
  `[NONE] scale-names`: `০° ꠍꠦꠟꠍꠤꠀꠍ` ×5 and `১০০° ꠍꠦꠟꠍꠤꠀꠍ`, against the abbreviated `১৮°ꠍꠦ.` /
  `-৪৫৯.৬৭° ꠚꠣ.`; `ꠚꠣꠞꠦꠘꠢꠣꠁꠐ` in full beside its own `ꠚꠣ.`. The degree NOUN is likewise attested in
  the slot: `ꠔꠣꠚꠉꠔꠤꠛꠤꠖ꠆ꠖꠣꠔ ০ ꠒꠤꠉ꠆ꠞꠤ ꠇꠦꠟꠜꠤꠘ` — "0 DEGREES Kelvin".
- **The currency WORD is attested in the sign's own slot**: `ꠅꠁꠟꠦ ৳১ ꠨ ৳২ ꠀꠞ ৳৫ ꠐꠦꠈꠣꠞ ꠘꠧꠐ` and
  `৳১-ꠞ ꠜꠣꠉꠞ ꠜꠣꠉ`, in the article whose title is ꠐꠦꠈꠣ (`ꠐꠦꠈꠣ (ꠝꠥꠖ꠆ꠞꠣ ꠙ꠆ꠞꠔꠤꠇ ꠪ ৳ ॥ ꠛ꠆ꠎꠣꠋꠇ ꠇꠧꠒ ꠪
  BDT)` — "Taka (currency symbol: ৳, bank code: BDT)"). That sentence is also the trap-12 REDUNDANT
  shape and the trap-12 ISO-code shape at once.
- **Grouping is BOTH Indic and Western in this corpus**: `১,০০,০০০` (lakh grouping) and
  `২২,২২৪,২৮২` (Western), plus `১৯,৬০০`, `২,৬০০`, `৫০,০০০`, `৮,০০০`. De-grouping (delete the
  separator) is correct for both, because the composer is `indicNumberWords` and reads the whole
  integer.

Implication: the rule list, in the order the couplings force it, is now determined. Sourcing is
outstanding for exactly three words — percent, decimal point, minus — and those go to Run 6.

## Run 6 — 2026-08-12 10:20 — sourcing the three words the corpus lacks

    npx tsx tools/normalization/sources.ts --lang syl
    npx tsx tools/normalization/attest.ts --lang syl --words ꠡꠔꠣꠋꠡ,ꠡꠔꠈꠞꠣ,ꠙꠞ꠆ꠍꠦꠘ꠆ꠐ,ꠙꠣꠞꠍꠦꠘ꠆ꠐ,ꠖꠡꠝꠤꠇ,
        ꠝꠣꠁꠘꠣꠍ,ꠞꠤꠘꠣꠔ꠆ꠝꠇ,ꠐꠦꠈꠣ,ꠒꠤꠉ꠆ꠞꠤ,ꠍꠦꠟꠍꠤꠀꠍ,ꠚꠣꠞꠦꠘꠢꠣꠁꠐ     (default --limit; wiki code `syl` is correct)

Question: percent, decimal point and minus are in neither the corpus nor the referee — is there a source?

`sources.ts` first: `letter-names [NONE]` (espeak ships no Sylheti), `decimal-point [NONE]`,
`scale-names [NONE]`, `percent/currency/minus/equals/ampersand [chk?]`, `fraction-series [NONE]`.
Grep of the artifact and the 399-line wikipron referee for candidate spellings: ꠡꠔꠣꠋꠡ 0, ꠖꠡꠝꠤꠇ 0,
ꠝꠣꠁꠘꠣꠍ 0. So the wiki is the only remaining tier.

    word          token  arts  substr-only  verdict
    ꠡꠔꠣꠋꠡ         3      3     0            attested
    ꠡꠔꠈꠞꠣ         0      0     0            absent
    ꠙꠞ꠆ꠍꠦꠘ꠆ꠐ      0      0     0            absent
    ꠙꠣꠞꠍꠦꠘ꠆ꠐ      0      0     0            absent
    ꠖꠡꠝꠤꠇ         2      2     0            attested
    ꠝꠣꠁꠘꠣꠍ        0      0     0            absent
    ꠞꠤꠘꠣꠔ꠆ꠝꠇ      0      0     0            absent
    ꠐꠦꠈꠣ          16     8     0            attested
    ꠒꠤꠉ꠆ꠞꠤ        8      7     0            attested
    ꠍꠦꠟꠍꠤꠀꠍ       4      2     0            attested
    ꠚꠣꠞꠦꠘꠢꠣꠁꠐ     1      1     0            attested

READING THE EXAMPLES, which is the half the counts cannot do:

- **ꠖꠡꠝꠤꠇ is the strongest find and settles the decimal point.** One of its two articles puts it in the
  slot itself — `১০০ ꠉ꠆ꠞꠣꠝ ꠛꠦꠟꠚꠁꠔ … ৯ ꠖꠡꠝꠤꠇ ৭ ꠡꠞ꠆ꠇꠞꠣ`, "9 POINT 7 [grams] of sugar", digit-word-digit —
  and the other is definitional: `ꠖꠡꠝꠤꠇ ꠡꠁꠋꠇꠣ ꠚꠖ꠆ꠖꠔꠤꠔ ১০ ꠐꠣ ꠚꠔꠤꠇ ꠀꠍꠦ- ০, ১, ২, …`, "the DECIMAL number
  system has 10 digits". The second is exactly the shape the Igbo lesson says to look for when a symbol's
  spoken form is absent from running text.
- **ꠡꠔꠣꠋꠡ is a lead that survives two checks.** ⚠ TRAP 37 FIRST: the BARE count measures the wrong thing.
  Two of the three hits are the "portion/share" sense with no numeral (`ꠝꠥꠟ ꠜꠥꠈꠘ꠆ꠒꠞ ꠡꠔꠣꠋꠡ ꠅꠘ꠆ꠌꠟ`), so
  the COLLOCATION count is **1**, not 3: `1974 ꠡꠘꠞ ꠞꠤꠙꠥꠐ ꠅ ꠖꠦꠈꠣ ꠎꠣꠄ 4 ꠡꠔꠣꠋꠡ ꠙꠣꠀꠠꠤ ꠝꠣꠁ꠆ꠡꠦ …`
  ("the 1974 report says 4 PERCENT of hill people…"). ⚠ TRAP 34 SECOND, and this is the one the brief
  warns about for this language: is that sentence SYLHETI or quoted BENGALI? Checked on MORPHOLOGY, not
  script — it carries the Sylheti ablative ꠕꠘꠦ (`ꠍꠤꠟꠐ-ꠘꠣꠉꠞꠤꠕꠘꠦ`, where Bengali writes থেকে), the
  locative ꠅ and the verb form ꠝꠣꠔꠂꠘ. It is Sylheti. Every competing spelling I could construct is ×0.
  ⚠ STATED LIMIT: one collocation instance. Shipped, with that written into `normalize.ts` beside the word.
- **ꠐꠦꠈꠣ is definitive**, and it did not need the wiki: the corpus already has it in the sign's own slot
  (`৳১ ꠨ ৳২ ꠀꠞ ৳৫ ꠐꠦꠈꠣꠞ ꠘꠧꠐ`) and the wiki adds `ꠐꠦꠈꠣ (ꠝꠥꠖ꠆ꠞꠣ ꠙ꠆ꠞꠔꠤꠇ ꠪ ৳ ॥ ꠛ꠆ꠎꠣꠋꠇ ꠇꠧꠒ ꠪ BDT)` —
  "Taka (currency symbol: ৳; bank code: BDT)". Position settled by `৩০ ꠔꠘꠦ 600 ꠐꠦꠈꠣ`: numeral first.
- **ꠒꠤꠉ꠆ꠞꠤ ×8 IS TRAP 37 AGAIN AND THE LOSING SENSE WINS ON COUNT.** Six of the eight are the ACADEMIC
  degree (ꠒꠤꠉ꠆ꠞꠤ ꠇꠟꠦꠎ "Degree College", ꠒꠤꠉ꠆ꠞꠤ ꠙꠣꠡ ꠈꠞꠁꠘ "passed his degree"). The digit-adjacent
  collocation is 1 — the corpus's own `ꠎꠦꠈꠐꠣ ꠔꠣꠚꠉꠔꠤꠛꠤꠖ꠆ꠖꠣꠔ ০ ꠒꠤꠉ꠆ꠞꠤ ꠇꠦꠟꠜꠤꠘ ꠈꠅꠀ ꠅꠄ` — and it is the
  right sense. Shipped with the limit stated.
- **⚠ MINUS: NOTHING.** ꠝꠣꠁꠘꠣꠍ, ꠝꠣꠁꠘꠥꠍ, ꠞꠤꠘꠣꠔ꠆ꠝꠇ and ꠘꠦꠉꠦꠐꠤꠛ all 0/0. `insource:/ꠞꠤꠘ/` returns one
  hit, inside an article title. en.wiktionary has **no Sylheti entries at all** (fetched
  `Special:Search` for ꠡꠔꠣꠋꠡ — "no results matching the query"), and a web search for a Sylheti–English
  dictionary returns the SOAS project and no lexical data. A refusal resting on silence needs a
  dictionary check first (the Igbo lesson); the check ran and came back empty.

Implication: percent, decimal, currency, degree and both scale names are shipped with citations; the
MINUS is declined. That is the class where silence INVERTS, so it stays a RED gate rather than being
guessed at — the `ht`/`rw` stance, and trap 24's "do not fix the FAIL".

⚠ NEGATIVE RESULT WORTH KEEPING: `sources.ts` reports `[NONE] scale-names` for syl and is WRONG. Both
names are in the corpus in full, beside the abbreviations they expand (`০°–১০০° ꠍꠦꠟꠍꠤꠀꠍ` vs `১৮°ꠍꠦ.`;
`ꠚꠣꠞꠦꠘꠢꠣꠁꠐ ꠁꠃꠘꠤꠐꠅ -৪৫৯.৬৭° ꠚꠣ.` in one sentence). That check reads espeak and source code, and syl has
no espeak — the known false-negative shape its own header records for percent/currency.

## Run 7 — 2026-08-12 10:55 — reading every math sign before writing them off

    npx tsx <spans>.mts   (enumerate every DROPPABLE match in the artifact, with context)

Question: the scan says `DROP math-sign ×15`. My draft note said "all citation-template residue". Is it?

Raw finding: **NO, and the draft was wrong.** Enumerating all of them gives four kinds:

    31×  citation residue      |last1=Lawson · |s2cid=144496795 · |ꠜꠧꠟꠤꠃꠝ=69 · |doi=10.1016/…
     3×  ORTHOGRAPHIC          ꠏꠦꠝꠘ ꠔ+ꠤ=ꠔꠤ · ꠕ+ꠥ=ꠕꠥ · ꠝ+ꠦ=ꠝꠦ   ("for example ta + i = ti")
     3×  LANGUAGE DESCENT      ꠡꠋꠍꠇ꠆ꠞꠤꠔ > ꠝꠣꠉꠗꠤ (ꠝꠂꠕꠤꠟꠤ) > ꠍꠤꠟꠐꠤ > ꠛꠣꠋꠟꠣ
     4×  ACRONYM separator     ꠝꠦ×ꠅ×ꠍ · ꠀꠁ×ꠅ×ꠄꠍ    (+ the corpus glossing `×` itself as ꠎꠦꠉꠣꠔ)
     1×  a REAL equation       1 ꠒꠟꠣꠞ = 84 ꠐꠦꠇꠣ    (a currency conversion)
     1×  a Latin gloss         ꠟꠦꠐꠤꠘ: columba = ꠚꠣꠞꠧ

And the two `&` are both inside a LATIN run — a URL query (`lsi.php?volume=5-1&pages=463`) and an
English proper name (`Bangladesh B.M.H.M School & College`) — so Sylheti's own ꠀꠞ, which is everywhere in
this corpus, cannot go in either slot.

Implication: the refusal stands but the REASON changes, and one real equation exists. No Sylheti word for
any of these relations is attested, so all of them stay unread; the taxonomy above went into
`defects.ts` under `syl` rather than a one-line "residue" claim. This is the run that justified the trap
this playbook keeps repeating: a count is a lead, read the instances.

## Run 8 — 2026-08-12 11:15 — the range guard, measured

    python3 — classify every hyphen/dash between two numbers in the artifact by whether it ASCENDS

Question: can a numeric range be told from a football score without duplicating a whole rule?

    ASC ×16 — ১০-১৪ ꠍꠦ.ꠝꠤ. · ১২-২৬ ꠉ꠆ꠞꠣꠝ · ১৯,৬০০-২০,০০০ ꠛꠍꠞ · 1500-1650 ꠡꠘ · ১৯০৪-১৯৭১ ·
              ১৪৫০-১৫০০ ꠈ꠆ꠞꠤ: · ৩.৯-৫.৫ ꠁꠘꠌꠤ · ৩০-৩৫ ꠚꠥꠐ · ১.৫-১.৯৯ ꠟꠣꠈ …   ALL genuine ranges
    NOT ×5  — 3-3 ꠉꠂꠟꠦ (a drawn score) · 4-2 ꠛꠦꠛꠗꠣꠘꠦ (a won one) · volume=5-1&pages= (a URL) ·
              ১৫ ꠅꠇ꠆ꠐꠧꠛꠞ ১৯২৬ – ২৫ ꠎꠥꠘ ১৯৮৪ and ১৫ ꠀꠉꠡ꠆ꠐ, ১৯৪৫ -৩০ ꠒꠤꠡꠦꠝ꠆ꠛꠞ ২০২৫ (LIFESPANS,
              whose operands are a year and a day-of-month)   NONE is a range

16/16 kept, 5/5 rejected, on one property of the numbers themselves. ⚠ A DISCRIMINATOR I did NOT use:
"followed by a unit noun" — because `3-3 ꠉꠂꠟꠦ` has one (ꠉꠂꠟꠦ, "goals") and would have passed it.

Implication: the ascending guard ships. A score read as *t̪in t̪ɔne t̪in* would be confidently wrong,
which is the reading the guard exists to refuse. Note the two lifespans are rejected for the right
reason by accident of arithmetic — recorded so a future reader does not mistake it for design.

## Run 9 — 2026-08-12 11:30 — the dot tabulation (the German `N.` method)

    python3 — classify every `.` in the artifact by what precedes it

    after a Syloti letter   51   ꠍꠦ. · ꠚꠣ. · ꠝꠤ.ꠉ꠆ꠞꠣ. · ꠍꠦ.ꠝꠤ. · ꠝꠦ.ꠐꠘ · ꠇꠤ.ꠇ꠆ꠎꠣꠟꠧꠞꠤ · ꠐꠤ.ꠐꠤ. ·
                                 ꠄꠘ.ꠄꠁꠌ.ꠄꠍ · ꠒꠣ. ("Dr.") · ꠞ.
    a decimal (digit.digit)  26
    after Latin/ASCII        15   DOIs, .php, citation residue
    SENTENCE-FINAL            4   `… ꠈꠦꠁꠞ ꠅꠁꠛꠅ.` · `… ꠀꠍꠦ.` · `… ꠡꠘ꠆ꠣꠘ.` · one `ꠍꠦ.ꠝꠤ. ⁕`
                                 (the fourth is an abbreviation that happens to sit before a ⁕)

Question: can the abbreviation dot be claimed without deleting a sentence-final pause?

Implication: **only for a MULTI-DOT token.** A rule claiming any trailing dot after a short Syloti run
would have deleted three real pauses. So the rule is `(S+\.)+S+\.?` — an interior dot is unambiguous
(a sentence never ends with no space after the period), and the trailing dot is claimed only on a token
that already had an interior one. This is the playbook's "multi-dot abbreviations before single-dot"
coupling arriving as a SAFETY property rather than an ordering one. `ꠒꠣ.`, `ꠝꠦ.` and `ꠞ.` keep their
spurious pause; separating them from a sentence end needs evidence this corpus does not carry.

## Run 10 — 2026-08-12 12:05 — the gates, before and after

    npx vitest run · npx tsc --noEmit
    npx tsx tools/referee-eval/eval.ts syl
    corpus-diff emit --corpus mined:syl (before, from the untouched tree) / emit + compare (after)
    npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/syl.jsonc --lang syl
    npx tsx tools/normalization/review.ts --lang syl

| gate | before | after |
|---|---|---|
| `vitest run` | 3685 pass / 1 fail (catalogue, pre-existing stale) | **3698 pass, 0 fail (240/240 files)** |
| `tsc --noEmit` | clean | clean |
| referee `raw exact` | 209/398 (52.5%) | **209/398 (52.5%)** — unchanged |
| referee `folded backbone` | 311/398 (78.1%) | **311/398 (78.1%)** — unchanged |
| referee `symbol accuracy` | 93.1% | **93.1%** — unchanged |
| corpus-diff DROP | 24 | **17** |
| corpus-diff DIGIT / SLOT-GAP / RAWMARK / THROW | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| utterances changed | — | **266 / 298 (89.3%)** |
| `mine.ts scan` | DROP math-sign 15, degree 5, percent 5, minus 3, currency 1 | **DROP minus ×1** (+ ACCEPTED-CLASS math-sign 15, ACCEPTED minus 2, ACCEPTED-CLASS ampersand 2) |
| `review.ts` | 1 FAIL (no normalizer) | **2 FAIL, both the minus** |

⚠ THE REFEREE IS FLAT AND THAT IS THE EXPECTED RESULT, not a null one. `referee-eval` scores
`phonemizeWord` over a 398-word list; this whole change is in `text()`. A MOVE would have meant a
regression in the g2p, so flat is the reading to want. It is a real meter here and it was checked
before and after, which is what the brief asked.

⚠ 89.3% OF UTTERANCES CHANGED — a number that would be alarming anywhere else. It is the sentence
terminator: `⁕` is in 476 places in the excerpt tier and was previously read as nothing at all, so
almost every utterance gains at least one pause. Verified it is only that, by diffing the TOKEN
MULTISETS of every changed pair:

    LOST   nɔ ×8 · ʃunːo ×8 · ɸez ×7 · se ×5 · mi ×5 · mɔ ×5 · ɡɾa ×3 · ⟪DROP:degree⟫ ×4 · ⟪DROP:percent⟫ ×4
    GAINED d̪ɔʃmix ×22 · t̪ɔne ×17 · ɖiɡɾi ×13 · ʃɔt̪aŋɔʃ ×10 · ɦazaɾ ×10 · ʈexa ×4 · miɡɾa ×3 ·
           ɸeaɾa/ɸeaɾaɾ/ɸeaɾat̪e ×7 · selsias ×2 · faɾenɦaiʈ ×2 · lax ×2 · mulzɔman ×1

**Every LOST token is a word FRAGMENT being merged back into a word** — `mɔ`+`lzɔman` → `mulzɔman`,
`ɸez`+`ɾa` → `ɸeaɾa`, `mi`+`ɡɾa` → `miɡɾa`, `se` → `selsias`, and `ʃunːo ×8` is `১,০০,০০০` ceasing to
read as *ex , ʃunːo , ʃunːo* and becoming *ex lax*. **No word disappeared.**

⚠ THE TWO REMAINING `review.ts` FAILS ARE BOTH THE MINUS AND ARE DELIBERATE (trap 24). The scan's
`DROP minus ×1` is the absolute-zero sentence; `ACCEPTED_SILENT.syl` lists the other two hyphens
(`০°–১০০°`, a degree range, and `–5088`, a JSTOR page span) by identity so they stop reporting while
the real negative keeps reporting. Do not fix these.

## Run 11 — 2026-08-12 12:20 — what was NOT done, and why

- **`cells.ts` was NOT given a cell for the native sentence terminator.** ⁕ has no cell and the playbook
  says a defect that lacks one gets found once and missed everywhere. But `cells.ts` is a fleet file:
  adding a cell makes all ~67 committed artifacts STALE, and `review.ts` fails on a stale artifact, so
  it would break every other language in this batch. Flagged for the reviewer instead of edited — this
  is the "if your language genuinely needs a change in a shared file, stop and report it" rule. Note
  the defect itself is a `clausePunctuation` gap, i.e. playbook step 3, not a normalization cell.
- **Ordinals** — 1 instance (`২১ꠡ ꠡꠔꠈꠞ`), `ordinal-native` cell is 0. A lead, not a rule.
- **A units tier** — `units` 0 and `rate` 0 in the whole-corpus counts; the corpus writes native dotted
  abbreviations instead, which Run 9's rule handles without inventing a unit vocabulary.
- **`০°–১০০°`** keeps a silent dash: the range rule requires digits on both sides and these operands
  end in `°`. Listed in `ACCEPTED_SILENT` as correctly silent, since both temperatures are spoken.
- **`ꠒꠣ.` / `ꠝꠦ.` / `ꠞ.`** keep a spurious pause — see Run 9.
- **`১৯৭০-ꠞ`, `১১,০০০-ꠞꠅ`** — a hyphen carrying a genitive clitic. The clitic reads as its own token
  (*ɾɔ*) where the language fuses it. This is the trap-14/15 family and it is left alone: the corpus has
  three instances and the fix needs the numeral converted to words inside the rule, which is a bigger
  change than three sentences earn.
