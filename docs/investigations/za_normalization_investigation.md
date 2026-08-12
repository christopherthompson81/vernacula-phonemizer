# za (Zhuang) text-normalization investigation

Worktree `norm/za`. Method: `docs/normalization_playbook.md`.

## Run 1 — 2026-08-11 20:05 — what does the engine already do, and what is the corpus?

**Commands**

```
ls src/languages/zhuang/
npx tsx tools/normalization/review.ts --lang za
npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/za.jsonc --lang za
npx tsx tools/normalization/sources.ts --lang za
npx tsx tools/referee-eval/eval.ts za
npx tsx tools/normalization/corpus-diff.ts emit --lang za --corpus mined:za --out …/za.before
```

**Question.** Which script does the `za` engine accept as front-end input, what does the mined
corpus contain, and what is the pre-change baseline for every gate?

**Raw findings.**

- `src/languages/zhuang/` already ships `zhuang.ts` (Latin g2p), `numbers.ts` (cardinals < 10⁶),
  `sawndip.ts` (Han→Latin reading dictionary, 2412 glyphs), `zhuang.jsonc`, `manifest.ts`.
  **Both scripts are accepted**: `TOKEN` in `zhuang.ts` has a Latin arm, a `\d+` arm, a CJK-ideograph
  arm routed through `sawndipToReadings`, and a clause-punctuation arm. There is **no `normalize.ts`**.
- The catalogued script pair is therefore real, but the FRONT-END input the mined corpus is written in
  is overwhelmingly **Latin** (Standard Zhuang 1982 orthography). Sawndip appears only as
  parenthetical glosses (`(Sawndip: 話僮)`) and as Han-script *Chinese* quotations (`Sawgun: 崇左市`) —
  i.e. Han in this corpus is mostly NOT Sawndip-to-be-read-as-Zhuang, it is a Chinese gloss.
- `review.ts --lang za` → `[FAIL] normalizer  src/languages/zhuang/normalize.ts missing`. It bails
  before printing readings, so no sign/probe output is available until the file exists.
- `mine.ts scan` baseline — **7 DROP classes, 45 instances**:

```
DROP percent    ×24
DROP exponent   ×6
DROP math-sign  ×5
DROP ampersand  ×3
DROP currency   ×3
DROP degree     ×2
DROP minus      ×2
```

- `sources.ts --lang za`: espeak does **not ship Zhuang at all**, so letter-names is `[NONE]` and the
  whole initialism seam is structurally blocked (playbook §"before you defer a class"). percent /
  currency / minus / equals / times / ampersand / exponent all `[chk?]` — sign occurs, nothing declared.
- `referee-eval za` baseline: wikipron zha_latn 1674/1682 folded (99.5%), symbol acc 99.8%;
  kaikki 1701/1709 folded (99.5%), symbol acc 99.8%. The residual classes are all g2p syllabification
  (`roegam`, `ndaundeiq`, `Sawndip`) — nothing normalization touches.
- `corpus-diff emit` baseline: 361 utterances → `za.before`.

**⚠ The artifact is CONTAMINATED, and the playbook predicted exactly this.** za.wikipedia is a small
wiki; `mine.ts` selects adversarially; so the pattern-rich paragraphs that dominate the hard-set are
imported German (the whole `Panzerkampfwagen IV` article) and English (Perlmutter, Liu Xiaobo, Book of
Mormon). Reading the hard-set by cell:

| cell | hard-set instances | in Zhuang? |
|---|---|---|
| `fractions` | 6 | 1 Zhuang (`ciemq 5/6 gijgvangj`), 3 German, 2 English |
| `ranges` | 8 | 3 Zhuang, 4 German ISBN, 1 English |
| `roman` | 8 | 2 Zhuang, 6 German (`Panzer IV`) |
| `dotted` | 8 | 2 Zhuang, 6 English/German |
| `currency` | 3 | **0 Zhuang** — all three English (`$500,000`, `$179,113`, `$15,000`) |
| `percent` | 8 | 8 Zhuang ✓ |
| `decimals` | 8 | 8 Zhuang ✓ |
| `year` / `digit-run` / `abbrev` / `latin-in-native` | — | Zhuang ✓ |

The artifact also records **no `command` field** (trap 32: it cannot be regenerated from the
repository) and `--source` records no language filter (`filter-by-language.py` was not run).

**Implication for the next step.** The high-traffic, genuinely-Zhuang cells are `percent` (×47
corpus-wide, ×24 dropped), `decimals` (×172), `year` (×949), `digit-run` (×956), `grouped` (×85),
`ranges` (×34), `clock` (×65 — but see below), `abbrev` (×375). The `currency` cell is entirely
foreign text and must NOT be used to source a Zhuang currency word — that is the su.wikipedia lesson
(playbook §0b) in its purest form. Next: count each shape on the corpus with `count.ts`/grep, in the
Zhuang-only subset, before writing any rule.

## Run 2 — 2026-08-11 20:11 — get an uncontaminated corpus

**Commands**

```
curl -s -o zawiki.xml.bz2 https://dumps.wikimedia.org/zawiki/latest/zawiki-latest-pages-articles.xml.bz2
python3 tools/normalization/wikidump-to-text.py zawiki.xml.bz2 za_paras.txt
python3 <scratch>/zafilter.py za_paras.txt za.za.txt za.other.txt      # Zhuang vs English/German vote
```

**Question.** Run 1 showed the artifact's hard-set is mostly German and English. Can the contamination be
removed, and does removing it change the RULES or only the noise?

**Raw finding.** The dump is 1.5 MB and extracts to 7,328 paragraphs (the tool reports 3,131 "paragraphs
written"; the discrepancy is the per-worker counter, not the file). The function-word filter — Zhuang
markers against English AND German, because zawiki carries both — splits it:

```
  short                    3585  (48.9%)   < 30 chars
  za                       2929  (40.0%)
  undecidable               440  (6.0%)
  foreign/undecidable       374  (5.1%)
```

`tools/normalization/filter-by-language.py` has no `za` row, so this used a local copy of the same design
(function-word vote, target must strictly win) with a German arm added. **The filter validates itself on
words that cannot cross the boundary**: `nienz` 907 / `bi` 115 / `nyied` 288 / `hauh` 251 in the Zhuang
subset and **all four are ZERO** in the other 814; `ISBN` 0 vs 11; standalone romans 11 vs 169.

**It changed the rules, not the noise.** Per-class counts, Zhuang subset vs the rest:

| class | Zhuang (2,929) | foreign (814) | consequence |
|---|---:|---:|---|
| `%` after a digit | 68 | 4 | the top symbol rule |
| dot-decimal | 125 | 21 | **the decimal separator is the DOT** |
| comma-decimal | **1** | **25** | the comma is a GROUPING mark in Zhuang and a decimal mark in the German |
| comma-grouped | 73 | 6 | |
| `$` | **0** | 3 | **no currency rule is written** — the artifact's `currency` cell is English text |
| digit range | 28 | 11 | |
| standalone roman | 11 | 169 | |
| `nienz`/`bi`/`nyied`/`hauh` | 907/115/288/251 | 0/0/0/0 | the filter's own control |

**Implication.** Writing a de-grouping rule from the unfiltered artifact would have produced a
comma-DECIMAL rule for Zhuang and broken 73 grouped numbers, and a currency rule sourced from English
sentences. Everything downstream is measured on `za.za.txt`.

## Run 3 — 2026-08-11 20:20 — probe the engine on the attested shapes

**Command.** `phonemize(form, "za")` over 34 corpus-attested forms.

**Question.** What does the engine actually produce — the defect list, not an assumption about it.

**Raw findings** (the full list is reproduced in `src/languages/zhuang/normalize.ts`'s header):

- `ndeu。Gijgvangj` → **no pause at all**. `。` ×789, `、` ×2253, `，` ×1500, `：` ×486, `；` ×118,
  `？` ×24, `！` ×8 — none is in `clausePunctuation` or in `TOKEN`, so ~5,200 marks are silent. Biggest
  single defect in the language and it is pure data.
- `83.5%` → `peːt ɕiːp θaːm . haː tɯk` — the sign silent AND the decimal dot read as a **sentence break**.
- `1,130.81` → `ʔiːt , ʔiːt paːk θaːm ɕiːp . peːt ɕiːp ʔiːt` (“one, one hundred thirty. eighty-one”).
- `35 °C` → `…haː ɕ` — the scale letter as a bare consonant. `1.4 ik km²` → `…ʔiːk kʰm`. `810km2` →
  `…kʰm ŋeːiː`, the `2` read as the numeral *ngeih*. `-422m` → sign silent, `m` raw.
- `259BC` → `…koːuː pɕ` — **a vowel-less cluster**, ×10.
- `(Sawgun: 崇左市)` → `θaːɯkuːn ,` then nothing; `(Sawndip: 佈僮 Vahgun:壮族)` → `poː`. A Chinese gloss
  emitting an unrelated Zhuang syllable.
- `Elizabeth II` → *ngeih*, `Panzerkampfwagen IV` → *seiq*. **Romans are already resolved upstream** —
  za is not in `ROMAN_NATIVE`, so no roman rule is needed. Pinned in `test/za.test.ts` on `XV`.
- `hung¹ hei³` unchanged. Those superscripts are **jyutping tone numbers** in a Cantonese gloss, not
  exponents — the hazard `defects.ts` records for wuu/nan/cjy/hak/hsn. za is the sixth, and the first
  non-Sinitic one.

**Implication.** Rule order falls out: punctuation fold and gloss-strip first (they are the largest and
they feed everything), then era → de-group → units → degrees → percent → ranges → fractions → decimals.

## Run 4 — 2026-08-11 20:24 — source the words

**Commands.** greps over `za.za.txt` and `za_paras.txt`; `npx tsx tools/normalization/attest.ts --lang za
--words "faenh cih,faen cih,bak faenh cih,daengz,goengleix,bingzfueng goengleix,meix,gunghyenz,gaxgonq
gunghyenz,doh"`.

**Question.** Which readings can be sourced, and which must be refused?

**Raw findings.**

- **The fraction idiom is attested twice, in two articles, with the sense visible.**
  `Ninz ciemq le seizgan seiqvunz gaenh sam faenh cih it` (sleep takes nearly one third of a lifetime) and
  `cijmiz digiuz geij cien ik faen cih it caemq`. DENOMINATOR + `faenh cih` + NUMERATOR — the 分之
  construction. This is the keystone: it settles the fraction rule outright and it is what the percent word
  composes from.
- **`bak faenh cih` itself has ZERO direct hits.** It is `bak` (100 — the engine's own `numbers.hundred`,
  ×368 in corpus) + the attested connective. Shipped as *sourced arithmetic* (the Fula `e teemedere`
  shape), with the limit written into the rule's comment rather than hidden.
- **`daengz` ×310, and ×6 between two numerals** — `28 daengz 31 aen ngoenz`, `85 daengz 90%`,
  `35 °C daengz 39 °C`, `13 daengz 18 sigi`, `420 daengz 361 B.C.`. `attest.ts` → ×40 / 19 articles,
  first example a numeric range. The range connective needs no invention.
- **Units:** `goengleix` ×162, `bingzfueng goengleix` ×159 (the county-article area boilerplate), `meix`
  ×6, `leizmeix` ×1. Postposed; the squared word is a PREFIX on the noun, so `km²` is spelled as its own
  key (trap 44).
- **⚠ THE ERA MARKER WAS NEARLY LOST TO A HOMOGRAPH.** `gunghyenz` ×4 — two are 公园 "park"
  (`gyaeundei lumj aen gunghyenz nei`, `Bwzhaij Gunghyenz`) and two are 公元 "common era"
  (`gaxgonq gunghyenz 12 sigij` in the dump, `Gunghyenz gonq 202 bi` from `attest.ts`). Two independent
  hits, both PREPOSED. Trap 37: the bare count was a lead; the sense was the finding.
- **NEGATIVE — no degree word.** `doh` ×33 and all five `attest.ts` examples are the wrong sense:
  `faenbouh doh daengx siqgyaiq` ("throughout"), `cienz doh lajbiengz`, and `Yaenq Doh` = **India**.
  `dohraeuj` ×1 is the noun "temperature". `Sesi`/`Sipsi` ×0.
- **NEGATIVE — no decimal word.** `diemj` ×29 and every instance is another sense: `diemj daeng` (light a
  lamp), `diemj feiz`, `haj diemj hozbingz giva` (five points of a plan), `diemj cung` ×14 (o'clock).
- **NEGATIVE — no minus word**, and the corpus has three TRUE negatives (`dwg -422m`, `dwg -418m`,
  `gemj daengz -420m`, one article's Dead Sea elevations).
- **NEGATIVE — the arithmetic signs are all non-arithmetic.** Nine instances: three are the wiki's own
  stub articles NAMING the symbol (`Swngzfap dwg cungj suenqsoq, fouzhauh dwg "×", gezgoj dwg "giz"`), one
  is scientific notation, two join words, one is a stray `<`, and — found later, from the scan — the `=`
  instances are **EasyTimeline template debris** the dump extractor did not strip (`PlotArea = left:50`).
  The stubs do give the OPERATION nouns (`Gemjfap`, `Swngzfap`, `Cawzfap`) and the RESULT nouns
  (`ca`, `giz`, `sieng`) — neither is what a reader says between two operands (trap 35's जोड़/धन split).

**Implication.** Percent, fraction, range, units, era and ampersand (`caeuq` ×1636) ship. Degree is
consumed-but-unread (a downgrade from a wrong consonant to a silence). Decimal point, minus and the whole
math-sign cluster are refused, with minus deliberately left RED.

## Run 5 — 2026-08-11 20:25 — the number data disagrees with the corpus, and it is not this layer's fix

**Command.** `grep -oP '([A-Za-z\' ]{2,40})\((\d{1,7})\) dwg aen swhyienzsoq'` over the dump, then the same
values through `numberToWords`.

**Question.** The engine reads `1957 nienz` as a cardinal. Is any Zhuang number word attested to check it?

**Raw finding — 172 self-glossing natural-number stub articles**, i.e. the strongest attestation there is:

```
     n      corpus            numberToWords()
   100      Bak               it bak            a leading `it` the corpus does not write
   101      Bak lingz it      it bak it         and no `lingz` zero-filler
   180      Bak bat cib       it bak bet cib
     6      loeg (×125)       roek (×58)
     8      bat (×112)        bet (×28)
```

No spelled-out YEAR occurs anywhere (`cien gouj bak…` ×0), so the digit-by-digit-vs-cardinal question for
`1957 nienz` stays open and untouched.

**Implication — NOT CHANGED.** It rewrites every number in the language, it needs its own corpus diff and
its own sourcing argument (`roek`/`bet` are the Wuming standard forms the manifest is authored from; the
stub series may be one editor's dialect), and this layer emits DIGITS throughout, so nothing is built on
top of it. Recorded in the normalizer header so the measurement is re-runnable in one grep. Same for
`numbers.million: "fanh"`, which is declared, is 10⁴ not 10⁶, and is never read.

## Run 6 — 2026-08-11 20:31 — write, then diff the whole corpus

**Commands**

```
npx tsx tools/normalization/corpus-diff.ts emit --lang za --corpus mined:za --out …/za.after
npx tsx tools/normalization/corpus-diff.ts compare --before …/za.before --after …/za.after --corpus mined:za
```

**Raw finding.** `changed 223/361 (61.8%)`

```
  before  { DIGIT: 0, 'SLOT-GAP': 0, RAWMARK: 0, DROP: 41, THROW: 0 }
  after   { DIGIT: 0, 'SLOT-GAP': 0, RAWMARK: 0, DROP: 12, THROW: 0 }
```

Reading the changes token by token rather than trusting the counts: the `ɕ` of `°C` deleted; pauses
inserted wherever a CJK mark stood; `θaːɯntiːp ,` (the *Sawndip* gloss label) and the Han syllables
after it deleted; `paːk fan ɕiː` inserted before every percentage; `kʰm` → `koŋleːiː`; decimal `.`
pauses removed.

**One change is a trade, not a win, and it is recorded rather than buried.** `17,075,400` de-groups to
`17075400`, which exceeds `numbers.ts`'s `n < 1e6` guard and falls back to digit-by-digit
(`it caet lingz caet haj seiq lingz lingz`). Before, it read as three chunks separated by two spurious
pauses (`cib caet , caet cib haj , seiq bak`). Both are wrong; the new one has no false clause breaks and
is a recognizable convention. One instance.

## Run 7 — 2026-08-11 20:34 — the gate found a real bug the corpus could not

**Command.** `npx vitest run test/za.test.ts`

**Question.** Does the one-letter unit key `m` survive its adversarial neighbour?

**Raw finding.** `n("802.11m")` → **`802 1 1 meix`**. The first version of the unit rule carried only the
leading `(?<![\p{L}\p{M}\d.,])` lookbehind — which stops a match beginning *inside* a number, and
`802.11m` does not begin inside one, so the whole designation matched as an operand.

This is traps 28 and 46 arriving together, and the important part is that **the corpus was clean**:
digit-adjacent `m` is ×8 and every instance is a genuine metre, and there are zero dotted designations in
2,929 paragraphs. The count said the key was safe; the key was not safe. Fixed by lifting
`NOT_VERSION` verbatim from `core/normalizeSymbols.ts` — both halves, as its own comment insists. Pinned.

## Run 8 — 2026-08-11 20:37 — the gates

| gate | before | after |
|---|---|---|
| `npx vitest run` | 235 files, 3418 pass | **235 files, 3420 pass, 0 fail** |
| `npx tsc --noEmit` | clean | clean |
| `referee-eval za` (wikipron, primary) | 1674/1682 folded (99.5%), 99.8% symbol | **unchanged** |
| `referee-eval za` (kaikki, secondary) | 1701/1709 folded (99.5%), 99.8% symbol | **unchanged** |
| `corpus-diff` DROP | 41 | **12** |
| `corpus-diff` utterances changed | — | **223/361 (61.8%)** |
| `mine.ts scan` | 7 classes, 45 instances | **1 class, 2 instances** (+8 accepted) |
| `review.ts --lang za` | 1 FAIL (no normalizer) | **2 FAIL, both the deliberate `minus`** |

The referee eval is expected to be flat: it is a word-level g2p comparison and this layer touches only
symbols and punctuation. Its residual divergence classes are unchanged and are all syllabification
(`roegam`, `ndaundeiq`, `Sawndip`).

`mine.ts scan` after:

```
DROP minus              ×2   ← DELIBERATE, see below
ACCEPTED-CLASS math-sign ×5
ACCEPTED-CLASS currency  ×3
ACCEPTED exponent        ×3   (the jyutping tone numbers)
```

**`review.ts --lang za` stays RED on `minus`, and that is the correct outcome.** Omitting a plus is
lossless; omitting a minus INVERTS. The corpus's three true negatives are real, no Zhuang word for a
negative number is attested in any source, and an accepted silence would claim the drop is correct. `za`
is therefore deliberately absent from `ACCEPTED_SIGN_SILENCE`'s `minus` key — the same standing refusal
`ln` carries. The gate comes green the day the word is sourced, not before.

## Dead ends and things left undone

- **`tools/normalization/filter-by-language.py` was NOT given a `za` row and the artifact was NOT
  re-mined.** The filtered dump is what every count above rests on, but re-mining would have invalidated
  the `corpus-diff` baseline emitted before any edit (the before/after must use the same corpus), and the
  tool is shared with three sibling agents working in parallel. The recipe is recorded here instead:
  add a `za` row with the markers `dwg youq aen miz caeuq gij ndeu neix guh daengj bi nienz vunz lai ceiq
  boux cungj hix mbouj gvi ndaej doiq seiz ndaw`, add a German arm to `ENGLISH` (zawiki carries the whole
  `Panzerkampfwagen IV` article), then re-mine. **The artifact also records no `command` field**, so it
  cannot be regenerated from the repository at all — trap 32, unfixed here for the same reason.
- **Unbracketed Han runs are left unread-as-Chinese.** 226 of 1,439, all of them Chinese bibliographies
  and bare county lists, but nothing in the text marks them and that is also the shape genuine Sawndip
  prose arrives in (`za.text("gou 佲")` is pinned). Stated as a limit in the normalizer.
- **No clock rule.** Three colon-numerals in 2,929 paragraphs and only one is a clock; the others are
  ratios (`1:2982572220101`, `1:1`). Claiming the colon claims the ratios.
- **No initialisms.** `GDP` → [ktpʰ] stands. `sources.ts` reports `letter-names [NONE] espeak does not
  ship this language at all` — the fleet-wide sourcing block, not a coding one.
- **Dotted initials still make spurious pauses** — `H.G.Wells` → `k . ʔɯllθ`, `B.C.` when not preceded by
  a figure. Four instances; no Zhuang letter names exist to read them with, so expanding them is not
  available and the pauses are the lesser failure.
- **A first attempt to test "no raw letter reaches the IPA" with `/[a-zA-Z]/` was worthless** — this
  engine's IPA is full of ASCII letters (`k`, `p`, `m`, `l`), so the assertion fires on correct output.
  Replaced with a check on the specific tokens the defect produced (`kʰm`, bare `m`, bare `ɕ`), and the
  reason is in the test so nobody rewrites it the naive way.
