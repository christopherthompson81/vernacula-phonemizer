# tg (Tajik) — text-normalization investigation

Tajik is **Persian in Cyrillic**. Two precedent families apply and they disagree, so every rule below records
which family it came from and what re-measurement said about it.

Standing constraints established before any rule was written:

- **No FLEURS corpus.** The only running text is `tools/corpus/mined/tg.jsonc` — a *dump-sourced* artifact,
  237,973 segments counted, 455 segments retained (255 hard + 200 sample). `corpus-diff` runs as
  `--corpus mined:tg`.
- **A referee DOES exist**, contrary to the brief: `tools/referee-eval/referees/tg.wikipron-tgk-cyrl-{broad,narrow}.tsv`
  and `tg.epitran-tgk-Cyrl.tsv`, 3,245 words. It is a **word-list** referee — it contains no digits, no symbols
  and no punctuation, so for this layer it is a **tripwire** (did I break the g2p?) and never a meter.

## Run 1 — 2026-08-13 09:20 — what evidence exists at all

    npx tsx tools/normalization/review.ts --lang tg
    npx tsx tools/normalization/sources.ts --lang tg
    npx tsx tools/referee-eval/eval.ts tg
    npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/tg.jsonc --lang tg
    npx tsx tools/normalization/corpus-diff.ts emit --lang tg --corpus mined:tg --out <scratch>/tg.before

**Question.** Which gates are real meters for tg and which are only tripwires?

**Raw findings.**

    review.ts   [FAIL] normalizer  src/languages/tajik/normalize.ts missing      — 1 FAILING, nothing else runs
    referee     broad  (human, primary)  folded backbone 3183/3245 (98.1%)  symbol acc 99.7%
                narrow (human)           2965/3243 (91.4%)                  98.7%
                epitran (programmatic)   2741/3245 (84.5%)                  95.8%
    scan        DROP percent ×38 · exponent ×24 · math-sign ×21 · currency ×16 · degree ×15 · minus ×11
                DROP ampersand ×3 · LEAK RAW-LATIN nm ×1 · FOREIGN ampersand ×4 / degree ×1 / math-sign ×1
                REDUNDANT currency ×1
    sources.ts  espeak does NOT ship tg at all → letter-names [NONE], decimal-point [NONE], fraction-series [NONE]
                percent/currency/unit/minus/equals/times/ampersand/plus/exponent all [chk?]
                corpus writes after a number: км×65 мм×27 м×14 кг×8 gb×7 см×6
    emit        454 utterances baseline

**Implication.** The meters are `mine.ts scan` (differential, over the artifact), `corpus-diff` (before/after over
the same 454 lines) and `review.ts`. The referee is a tripwire only. `sources.ts` is unusually poor here: espeak
ships no Tajik, so the *entire* letter-name / decimal-word / fraction-series axis has no in-repo source and must
come from the corpus, the wiki (`attest.ts`) or nowhere.

## Run 2 — 2026-08-13 09:40 — is the corpus even Tajik? (trap 34, at corpus scale)

**Question.** `bal` was 37.4% Persian/Urdu and `bar` 24% German. tg.wikipedia is Cyrillic and so is Russian —
the contamination would be invisible. What is the rate, and *where does it land*?

**Command.** A function-word discriminator over the artifact's 455 retained segments (Tajik `ва аз дар ки ба аст
бо ин …` vs Russian `и в на с по из для что как был …` vs English), scored per segment.

**Raw finding.**

    tg 404 (88.8%) · ru 32 (7.0%) · en 3 (0.7%) · undecided 16 (3.5%)

and the Russian is **not spread evenly** — it is bibliography. Reading the cells:

    dotted      8/8 hard instances are RUSSIAN citation blocks:  `М., 1997` `Д., 2003` `Прошин Н. И., … М., 1964`
    era-marker  3/8 Russian:  `Новая российская энциклопедия. Т. 2. М., 2005`  `XV—XVII вв.`
    currency    2/8 Russian:  `В 2005 корпорация продала 9,17 млн. …  $193,5 млрд.`

**Implication — and it is the single most important finding of this run.** The `dotted` cell carries 13,693
corpus occurrences and it is the cell a Cyrillic normalizer would most naturally mine for abbreviations. Its
evidence is **Russian**: `М.` (Moscow), `Т.` (том), `с.` (страница), `вв.` (века), `изд.`, `ред.`. Writing a
Tajik abbreviation rule from that table is exactly the ht/`pwen` and bar/`Euro` failure. **No rule in this layer
is sourced from the `dotted` cell.** What survives re-measurement is recorded per rule below.

## Run 3 — 2026-08-13 10:05 — the token class, and the character that DOES split a Tajik word

**Question.** `bal` lost a letter outside the token class in 38.9% of paragraphs and `ti` lost 910 pauses to
one character. Tajik has six letters Russian does not — ғ ӣ қ ӯ ҳ ҷ. Does the class admit them?

**Command.** Every one of the 35 Tajik letters, upper and lower, probed BOUND INSIDE A WORD (`бо<X>ор`) and
alone; flagged if the reading gained a space (a split) or came back empty.

**Raw finding.**

    letters probed: 70   defective: 0
    alphabet →  abvɡʁdejɔʒzijijkqlmnɔprstuɵfχht͡ʃd͡ʒʃʔejujˈa   (identical for the capital run)

`TOKEN = /([Ѐ-ӿ]+)|…/` is U+0400–U+04FF, and every Tajik letter is inside it: ғ U+0493, қ U+049B, ҳ U+04B3,
ҷ U+04B7, ӣ U+04E3, ӯ U+04EF. **The warned failure does not occur through the alphabet.**

**But it occurs through a character that is not a letter.** Counted over the artifact:

    SOFT HYPHEN U+00AD        57 occurrences, 14/456 segments
      …splitting a WORD       54 occurrences, 13/456 segments  (2.9% of the corpus)

    "Осиёи Мар­ка­зӣ"     →  ɔsijɔjˈi mˈar kˈa zˈi        three words, three stresses
    "Ҷум­ҳурии Узбекистон" →  d͡ʒˈum hurijˈi uzbekistˈɔn
    "тақ­дим намуд"        →  tˈaq dˈim namˈud

A soft hyphen is an invisible discretionary break carried in from the wiki's print-derived text. It is not in
the token class, so `[Ѐ-ӿ]+` stops at it — exactly the `bal` shape, one class of character over. **Step 0 of
the layer strips it.** ZWNJ (7 occurrences) is left alone: every instance is inside a Perso-Arabic run
(`استان‌های`), which the script router hands to another engine.

## Run 4 — 2026-08-13 10:30 — probing the engine on every attested form

**Question.** Playbook step 2 — what does the engine actually produce, not what do I assume.

**Command.** 46 forms lifted verbatim from the artifact, through `getPhonemizer("tg").text`.

**Raw finding** (the defects, with the artifact counts beside them; occ / segments out of 456):

| form | reading now | what is wrong | count |
|---|---|---|---:|
| `2,2 млн тонна` | `dˈu , dˈu mln tɔnnˈa` | decimal comma is a **clause pause**; `млн` is a consonant cluster | 242 / 82 |
| `70 000 нафар` | `haftˈɔd sˈifr nafˈar` | "seventy zero" — space-grouping splits the number | 42 / 24 |
| `5 781 203 нафар` | `pˈand͡ʒ haftsadˈu haʃtɔdˈu jˈak dusadˈu sˈe` | three numbers | ″ |
| `1992—1997` | two bare numbers, no connective, **no pause** | the em dash vanishes | 63 / 46 |
| `10-15 %` | `dˈah pɔnzdˈah` | hyphen range + percent both dropped | 68 / 37 |
| `26,5 %` | `bistˈu ʃˈaʃ , pˈand͡ʒ` | percent DROPPED | 97 / 38 |
| `ММД-ро` | `mmd rˈɔ` | vowel-less cluster + the bound suffix as its own word | 158 / 87 |
| `$193,5 млрд` | `sadˈu navadˈu sˈe , pˈand͡ʒ mlrd` | currency dropped, magnitude a cluster | 22 / 16 |
| `1 161 км` | `jˈak sadˈu ʃastˈu jˈak km` | `км` is the cluster [km] | 163 / 61 |
| `24,751 km2` | `… ˈʊkm dˈu` | LATIN `km` through the English foreign fallback — trap 38 | — |
| `1.01.2017` | `jˈak . jˈak . dˈu hazɔrˈu habdˈah` | a date read as **three clauses** | 16 / 9 |
| `с.1924` | `s . hazɔrˈu…` | bare consonant + a spurious pause | 9 / 3 |
| `ҷойи 1-ум` | `d͡ʒɔjˈi jˈak ˈum` | the ordinal ending as a separate word | 28 / 19 |
| `38° арзи шимолӣ` | degree dropped | | 45 / 16 |
| `14,1°С-ро` | `t͡ʃɔrdˈah , jˈak s rˈɔ` | Cyrillic С → bare `s`; `+22,2 °C` → Latin C as English *sˈiː* | 35 / 12 |
| `соати 15:39:37` | `pɔnzdˈah , siˈu nˈɵh , siˈu hˈaft` | a clock read as **three clauses** | 11 / 8 |
| `Осиёи Мар­ка­зӣ` | 3 words | soft hyphen (Run 3) | 54 / 13 |

**And one defect that is NOT in this layer.** `numberWords` in `tajik.ts` has no milliard:

    1000000000  →  "sˈad milliˈɔn"      (сад миллион — one HUNDRED million, 10× low)
    1234567890  →  "sadˈu siˈu t͡ʃˈɔr milliɔnˈu …"   (134 million)

`three(1000)` indexes `N.units[10]`, which is `undefined`; the string becomes `"undefinedсад"` and the g2p
skips the Latin letters, so the wrong number is emitted **silently, with no marker of any kind**. Playbook
step 3 — fix it where it lives. `миллиард` is attested ×123/20 articles and ×12 in the artifact.

## Run 5 — 2026-08-13 11:10 — sourcing every word the layer would emit

espeak ships no Tajik, so `sources.ts` has nothing to offer for letter names, the decimal word or the
fraction series. Everything below is `attest.ts` against tg.wikipedia (recorded in
`tools/corpus/attest/tg.jsonc`), the artifact, `concept.ts`/Wikidata, or a CirrusSearch `insource:` REGEX
count (article counts, run by hand where a phrase probe could not be expressed).

**⚠ The phrase probe lied first, and the regex is what caught it.** `insource:"% фоиз"` returns 541 and
`insource:"фоиз"` returns 541 — identical, because the analyzer strips `%`, so the "collocation" probe was
just the bare-word probe wearing a costume. Only `insource:/…/` sees the sign.

### What survived, and from which precedent family

| slot | word | evidence | family |
|---|---|---|---|
| `%` | **дарсад** | artifact ×19 in 11 segments (vs фоиз ×3 in 3); wiki `/[0-9] дарсад/` **303** articles vs `/[0-9] фоиз/` 248; and TWO segments write the sign AND the word together — `аз 45 % дарсад ба 66 %`, `23,1% дарсад` | **Persian** (درصد) |
| unit `км м см мм кг т га` | километр метр сантиметр миллиметр килограмм тонна гектар | all attested ×37–144; `/[0-9] метр/` 10,041 articles | Russian *abbreviation*, Persian/international *word* |
| `км²` `м²` | **километри мураббаъ** / **метри мураббаъ** | the tg.wikipedia article's own opening line: *«Километри мураббаъ (км², км кв., англ. km²) — воҳиди ченаки масоҳат»* — definitional, and it names the abbreviation | Persian/Arabic (مربع) |
| `км³` `м³` | **километри мукааб** / **метри мукааб** | same article: *«километри мукааб — km³»*; мукааб ×32/19, метри мукааб ×28/17 | Persian/Arabic (مکعب) |
| `°` | **дараҷа** | `/[0-9] дараҷа/` 122 articles | shared |
| `°C` | **дараҷаи Селсий** | ×3 in one article, in the slot: *«аз 0 дараҷаи Селсий то — 15 дараҷаи Селсий … аз 25 дараҷаи Селсий то 40 дараҷа»* | Russian calque |
| `$` | доллар (×109/19) | *«1 доллар = 100 сент»*; сомонӣ ×70/12 for the national currency | shared |
| range dash | **то** | `/[0-9] то [0-9]/` 3,238 articles against `/[0-9]—[0-9]/` 5,273 — the same relation, spelled | Persian |
| `млн` `млрд` | миллион / миллиард | ×20 / ×12 in the artifact, both spelled out beside the abbreviation | Russian abbreviation, international word |
| `с.NNNN` | **соли** | the artifact alternates them in one sentence: *«С.1924 нахустин амбулатория ва соли 1925 якумин беморхона»* | Tajik |
| `ва ғ.` | ва ғайра | ғайра ×246/18 | Persian/Arabic |
| `диг.` | дигар | 8/8 artifact instances are `ва диг.` | Tajik |
| ordinal `N-ум/-юм` | якум дуюм сеюм чорум панҷум … садум сиюм | all attested ×14–42; `/[0-9]-ум/` 3,675 articles, `/[0-9]-юм/` 793, `/[0-9]-уми/` 1,660 | **Persian** |
| letter names | а бе ве ге ғе де … и дароз, и кӯтоҳ, аломати сакта | en.wikipedia's Tajik-alphabet name column, corroborated on tg.wikipedia itself: `и дароз` in *Қоидаҳои имлои забони тоҷикӣ*, `аломати сакта` in *Апостроф* | Tajik |
| rate `/` | **дар** | *«зичии аҳолӣ … нафар дар километри квадратӣ»* beside the corpus's own `нафар/км²` (×10/10) | Tajik |

### What did NOT survive re-measurement, with counts

- **`фоиз` for `%`.** Genuinely attested (×71/17, Wikidata's own tg label for Q11229 *percent* is фоиз) and
  it LOSES on every slot-specific measure. Recorded here rather than dropped, because a future reader will
  find it and wonder. This is the closest call in the layer.
- **THE DECIMAL SEPARATOR HAS NO WORD, and this is a sense refusal, not a silence.** Five candidates, each
  attested with a *different* meaning, and each **zero** between two digits over the whole wiki:

        бутун    ×16/10   "адади бутун" = an INTEGER (and a runway surface)   /[0-9] бутун [0-9]/  = 0
        нуқта    ×40/19   the FULL STOP, and "нуқтаи аҳолинишин" a settlement /[0-9] нуқта [0-9]/  = 0
        вергул   ×13/7    the COMMA as a written mark, defined as such        /[0-9] вергул [0-9]/ = 0
        мумайиз  ×1/1     a court ASSESSOR ("ба ҳайси мумайиз дар санҷишҳои судӣ") — Persian ممیز, wrong sense in tg
        аъшорӣ   ×0                                                            absent outright

  This is the highest-traffic single decision in the layer (242 occurrences, 18% of segments) and the answer
  is that **no word is available**. The layer therefore removes the spurious *pause* and leaves the two
  number groups adjacent — merely missing, never confidently wrong.
- **`манфӣ` for the minus.** Attested ×37/20 and the sense fails: "ҷонишини манфӣ" (negative PRONOUN, a
  grammar term), "иттилооти манфӣ" (negative information), and **Манфӣ a Libyan politician's surname**. The
  sign rules are declined on their own evidence in Run 7.
- **`ҷамъ` for `+`.** Attested ×29/20, every instance "ҷамъ намудан" = *to collect/gather*; Wikidata gives it
  as the OPERATION *addition*, which is trap 37's wrong-register shape. Declined.
- **Every Russian abbreviation in the `dotted` cell** — `М.` ×26, `Т.` ×7, `А.` ×22, `В.` ×17, `Б.` ×11,
  `т.` (том), `вв.`, `изд.` They are frequent, they are Cyrillic, they sit in Tajik articles, and they are
  RUSSIAN (Run 2). No rule touches them.

## Run 6 — 2026-08-13 12:40 — the layer, and the ordering couplings it forced

Written as `src/languages/tajik/normalize.ts` plus `manifest.ts` (extracted: the engine imports the
normalizer, and the normalizer needs the manifest at module init — re-exporting it from `tajik.ts` was an
import CYCLE that failed at load time with *Cannot access 'MANIFEST' before initialization*, not at any gate).

**Order, and why each position is not free:**

| # | rule | must run… |
|---|---|---|
| 0 | strip U+00AD, `&nbsp;` | FIRST — every later rule matches literals across the break, and `&nbsp;` would otherwise be read by the ampersand tier as "ва nbsp" |
| 1 | space-grouped thousands | before the range rule (a grouping space otherwise makes two operands) and before the tier |
| 2 | `с.NNNN`→соли, `диг.`, `ва ғ.`, млн/млрд/ҳаз | before any single-dot handling |
| 3 | dotted D.MM.YYYY dates | BEFORE the range rule, or `05.01.1952—08.09.2001` is a numeric range |
| 4 | digit`:`digit → space | before the tier |
| 5 | ordinals `N-ум/-юм` | BEFORE the range rule (`1-ум` looks like a hyphen range) and before the generic enclitic rule |
| 6 | `%-и` / `N-ро` enclitics | ⚠ BEFORE the tier — the tier emits `дарсад` and would strand the `-и` (trap 14) |
| 7 | ranges → `то` | after 3 and 5, which own a dash of their own |
| 8 | spaced dash → pause | after 7, so a numeric range has already taken its dash |
| 9 | degrees, density rate, then `SYMBOLS()` | the tier needs number-sign ADJACENCY and the raw decimal comma |
| 10 | fractions | after the rate rules, which own a slash |
| 11 | decimal comma/dot → space | LAST of the number rules — it destroys the tier's adjacency |
| 12 | `=` → баробар аст ба | anywhere after 11 |

Two positions came out of the corpus rather than from the template: the ordinal must precede the range
(`1-ум`), and the enclitic must precede the tier (`60,1%-и` → *дарсади*, not *дарсад* + a stranded *и*).

## Run 7 — 2026-08-13 13:15 — the gates, before and after

    npx tsx tools/normalization/corpus-diff.ts emit/compare --lang tg --corpus mined:tg
    npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/tg.jsonc --lang tg
    npx tsx tools/referee-eval/eval.ts tg
    npx vitest run ; npx tsc --noEmit

| gate | before | after | what it can actually measure |
|---|---|---|---|
| corpus-diff (mined:tg, 454) | — | **351/454 changed (77.3%)**, DROP **106 → 26**, THROW 0 | a real METER — both sides read the same lines |
| scan `percent` | 38 | **1** | meter |
| scan `exponent` | 24 | **0** | meter |
| scan `currency` | 16 | **1** | meter |
| scan `degree` | 15 | **0** | meter |
| scan `ampersand` | 3 | **0** | meter |
| scan `math-sign` | 21 | **2** (+12 ACCEPTED-CLASS) | meter |
| scan `minus` | 11 | **11** | meter — deliberately unmoved, see below |
| scan RAW-LATIN | 1 | 1 | meter |
| referee broad / narrow / epitran | 98.1 / 91.4 / 84.5 | **98.1 / 91.4 / 84.5** | **TRIPWIRE ONLY** — a WORD list with no digit, sign or punctuation in it. Byte-identical is the pass condition, not an improvement target |
| `review.ts` | 1 FAIL (no normalizer) | 2 FAIL (`sign classes`: minus, equals; `artifact scan`) | checklist |
| `vitest` | 3970 pass | 3979 pass (9 new tg tests) | regression net |
| catalogue | tg = (none) | tg = **done** | derived |

**The trap-4 check, run explicitly because step 8 adds pauses and step 11 removes them:**

    total pause marks  before 3582  after 3430  (delta -152)
    sentence-FINAL period lost on: 0 lines
    final period GAINED on: 0 lines

The net −152 is the 242 decimal commas and 16 dotted dates losing their false breaks against the 280 spaced
dashes gaining a real one (minus those that became ranges). **No sentence-final pause was lost.**

**Sample tier, 132 of 200 changed, read by hand.** The dominant change is the copula dash finally producing
a pause (`Париж () — шаҳр ва пойтахти Фаронса` → *parˈiʒ **,** ʃˈahr…*), which was 280 occurrences of
silence. Two incidental wins worth recording: the `INITIAL_RUN` pass now reads Russian bibliographic
initials as letter names (`Колесник Л. В.` → *lˈe vˈe*, was `l . v` with two spurious pauses), and
`ҶХШБ` → *ҷе хе ше бе*, was the cluster `d͡ʒχʃb`. One reading changed for a reason worth naming: `Тоҷикистон
— 141 400 км²` was reading its population as *шаш нӯҳсаду сию як сесаду ҳафтоду ду* (three numbers) and is
now *шаш миллиону нӯҳсаду сию як ҳазору сесаду ҳафтоду ду*.

**And one defect the scan found only after the first fix landed.** The density rate rule was written for
`нафар/км²`, the form the artifact showed. Re-scanning reported the same `exponent` drop once more, on
`5914,4 тан/км²` — the identical construction with the other word for "person". A cell can hide behind
itself; the noun is a capture now, not a literal.

## Run 8 — 2026-08-13 13:50 — what stays RED, and why that is the correct state

`review.ts --lang tg` ends on 2 FAIL and both are trap 24.

- **`minus` — a real, unclosed defect.** Tajik writes genuine negative temperatures (`ҳарорати миёнаи моҳи
  январ -4`, `-9`, `-7,8 °C`, `–26°С`). The word is not available: `манфӣ` ×37/20 is attested and means the
  grammatical NEGATIVE (ҷонишини манфӣ, a negative pronoun), "negative information", and is a Libyan
  politician's surname. And the SHAPE is ambiguous in the same corpus — `мардҳо −71,3, занҳо −76,2` is an
  apposition dash, `аз ҷумла тиҷоратӣ –19,3 ҳазор км` a list dash, and one article writes the minus AS an em
  dash (`аз 0 дараҷаи Селсий то — 15`). Claiming one claims the other. Omitting a minus INVERTS where
  omitting a plus is lossless, so no reading ships and the gate stays red.
- **`equals` — a guard, not a refusal.** It IS read: `1 доллар = 100 сент` → *як доллар баробар аст ба сад
  сент*, from the corpus's own «Як километри мураббаъ баробар аст ба:». The rule requires a Cyrillic or digit
  operand on BOTH sides, so `review.ts`'s synthetic `x = y` reports DROPPED — and correctly, because the
  artifact's Latin-operand instances are optics formulae (`D = ℓlgI 0 /I = k λ ℓ`) and EasyTimeline markup
  (`ScaleMinor = gridcolor:lightgrey`). It is therefore NOT in `ACCEPTED_SIGN_SILENCE`: that table is for
  refused classes, and using it here would silence a real Cyrillic regression.

Class-refused in `defects.ts` with their evidence: `plus` (×17, seven measurement pluses on temperatures and
ten designations — no arithmetic plus exists; `ҷамъ` fails on register), `plus-minus` (×0), `divide` (×0),
`less-than` (×0), `greater-than` (×1, and it is a historical-linguistics derivation arrow in an etymology,
not a comparison), `times` (×2, both the badminton court's dimensions; no operator word is sourceable — and
`ба` in that same sentence means "against", not "by").

**The four residual scan lines, read one by one:**

    DROP math-sign ×2   the optics formula `D = ℓlgI 0 /I = k λ ℓ` — Latin and Greek operands, excluded by design
    DROP percent   ×1   `экв%` — the sign follows a WORD, not a number, so the tier correctly declines it
    DROP currency  ×1   `$2.6 миллион доллари амрикоӣ` — a trap-12 PERMISSIBLE drop: the tier suppresses the
                        sign because the sentence already says доллари, and the differential cannot see that
    LEAK RAW-LATIN ×1   `nm` inside an English phone-spec run (`FHD + 1080x2400 … ~393 ppi`)

None of the four is a per-instance escape-hatch case worth pinning, so **tg is deliberately NOT added to
`ACCEPTED_SILENT` or to `test/accepted-silent.test.ts`** — every refusal it has is class-level, which is the
hmn stance.

## Run 9 — 2026-08-13 14:05 — declined, with counts

- **`шим.` ×5 and `ш.` ×5.** No discriminator. `шим.` is шимол or шимолӣ depending on the phrase
  (`ноҳияҳои шим.` vs `минтақаҳои шим. ғарбӣ`); `ш.` is шаҳри in `ш.Хоруғ`, шарқӣ in a coordinate and шамсӣ
  in `1362 ш.`, a Hijri-solar year.
- **The enclitic after an abbreviation or an initialism** — `ММД-ро`, `3 000 км-ро`, `15 км²-ро`, 4 + 4
  occurrences. It stays a separate token. Gluing it would fuse it into a caps run the initialism pass must
  still see, or into a unit key the tier must still match.
- **Bare `г` (gram)** — one instance (`2,8—3,0 г/л`) and the key is one letter that is also the Russian
  abbreviation `г.` = *год*. Left undeclared; the cost is one reading.
- **`М. Т. А. В. Б.` and the rest of the Russian bibliographic block** — the Run-2 finding. Frequent,
  Cyrillic, in Tajik articles, and Russian.
- **The arc-minute/second `′ ″`** — `290° 22'`, 2 occurrences. The degree is now read; the minute is not.

**One measured cost, stated rather than hidden.** Declaring the one-letter unit key `м` (trap 46) makes the
artifact's `1362 ш. / 1983 м.` — a Hijri/Gregorian year pair inside a Persian book citation — read `м` as
*метр*. One instance in 456 segments, against `/[0-9] метр/` at 10,041 articles. The Russian citation blocks
are untouched because the tier matches only after a NUMBER and `М., 1964` never has one.
