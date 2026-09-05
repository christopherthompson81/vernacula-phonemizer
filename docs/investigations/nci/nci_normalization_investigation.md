# Classical Nahuatl (nci) — text normalization investigation

Chronological. Each run states the command, the question it was meant to answer, the RAW finding, and what
that implied for the next step. Negative results and dead ends are kept — they are most of the value here.

The corpus is `tools/corpus/mined/nci.jsonc`, a dump-sourced artifact of the Nahuatl Wikipedia
(3,135 paragraph segments mined; 585 string leaves retained across `hard` + `sample`, 391 lines scanned by
`mine.ts`). It is a SMALL corpus and — as the round's first finding shows — it is not homogeneously
Nahuatl.

---

## Run 1 — 2026-08-16 — baseline: what the engine does today

    npx tsx tools/normalization/corpus-diff.ts emit --lang nci --corpus mined:nci --out /tmp/nci-base.json
    npx tsx tools/referee-eval/eval.ts nci
    npx tsx tools/normalization/mine.ts scan --in tools/corpus/mined/nci.jsonc --lang nci
    npx tsx tools/normalization/review.ts --lang nci

QUESTION: what is broken before a single line is written?

RAW:

    emitted 377 utterances → /tmp/nci-base.json

    referee: nci vs kaikki Classical Nahuatl (2329, HUMAN) — INDEPENDENT SECONDARY
      raw exact 51/2329 (2.2%) · folded backbone 2145/2329 (92.1%) · symbol accuracy 98.3%

    mine scan:
      DROP math-sign     ×21   DROP exponent ×15   DROP percent ×11   DROP ampersand ×9
      DROP degree        ×8    DROP minus    ×2    DROP currency ×1
      LEAK RAW-LATIN kg  ×6    km ×5   dm ×2   ll ×2   sg ×1   vn ×1

    review: [FAIL] normalizer — src/languages/nahuatl/normalize.ts missing

IMPLIED: `math-sign` at ×21 is by far the largest class and is the first thing to read instance by instance
— the fleet reflex would be to reach for `plus`/`equals` words. Everything else is small enough that the
whole corpus can be read exhaustively, which is what Run 2 does.

Direct probes of the shapes, before any code
(`npx tsx -e 'import { phonemize } from "./src/index.ts"; …'`):

    "Netech ye ixquichca (720 000) xihuitl."   -> … sentsontli iːpan kaʃtoːlli onsempoːwalli aʔtɬe ʃiwitɬ .
                                                  ⚠ "720" then "000" → *ahtle* ('nothing'). The space-grouped
                                                    number is read as TWO numerals plus a zero word.
    "huehcatlanyōtīca 45.9&nbsp;km."           -> … oːmpoːwalli ommaːkʷiːlli . tʃikʷnaːwi km .
                                                  ⚠ the decimal dot is a SENTENCE BREAK mid-quantity, the
                                                    `&nbsp;` entity vanishes, and `km` reaches the g2p raw.
    "Mētztli īyōllo 384,400 km ca."            -> … kaʃtoːlli onnaːppoːwalli onnaːwi , sentsontli km ka .
                                                  ⚠ the grouping comma is a clause pause: *384, 400*.
    "Ipal in tlahco itotonca cequi 17 °C."     -> … kaʃtoːlli omoːme k .
                                                  ⚠ the `°` is silent and the scale letter C reaches the IPA
                                                    as a bare [k].
    "īpan 12:14 hrs Tecolotlan"                -> … maʔtɬaːktɬi omoːme , maʔtɬaːktɬi onnaːwi ɾs tekolotɬan
                                                  ⚠ colon → clause pause inside a time; `hrs` → *ɾs*, since
                                                    nahuatl.ts correctly silences a word-initial ⟨h⟩.
    "mochihua in 78% ic ehecatehuiltic"        -> … eːʃpoːwalli onkaʃtoːlli omeːji ik eʔekatewiltik  (sign gone)
    "1.4×10²¹ kg"                              -> seː . naːwi maʔtɬaːktɬi kɡ  (× gone, ²¹ gone, kg raw)
    "$40 pesos tlen tomin"                     -> oːmpoːwalli pesos tɬen tomin  (sign gone — but see Run 5)
    "Cēmpōhualomēyi (cēm + pōhual + on + ēyi)" -> seːmpoːwalomeːji seːm poːwal on eːji  (the + silently gone)

---

## Run 2 — 2026-08-16 — the corpus is bilingual, and half the sign inventory belongs to the OTHER language

    node scratchpad/seg.mjs           # strip JSONC comments + trailing commas, walk the string leaves
    node scratchpad/scan.mjs '<regex>'   # print a ±60-char window around every match

QUESTION: for each sign class, what is every instance actually doing?

RAW — the full non-alphanumeric inventory of the retained text, by codepoint (over all 585 string
leaves; the per-class counts below are re-taken over the 410 UNIQUE segments, which is why a few are
smaller):

    ,  949   .  734   -  207   (  199   )  198   ]  142   [  139   :  109   "   96
    /   73   ;   53   +   24   &   19   %   17   ​ U+200B 15   =   13   °   12
    ⁻ U+207B 10   '    9   «    6   »    6   ’    6   ·    5   —    4   ×    4
    –    4   ?    3   #    3   ―    2   !    2   †    1   $    1   >    1   {,}  1

`<` ×0, `÷` ×0, `±` ×0 — those three signs do not occur at all.

⚠ **THE SINGLE LARGEST FINDING OF THE ROUND: `+` IS A MORPHEME BOUNDARY, NOT AN OPERATOR.** Of the 24 plus
signs, TWENTY-TWO are inside nah.wikipedia's own NUMERAL articles, which decompose a vigesimal word into its
morphemes and then state the digits:

    Cēmpōhualomēyi (cēm + pōhual + on + ēyi) ītōcā cē tlapōhualli auh mohcuiloa "23".
    Caxtōlonnāhui (caxtōl-li + on- + nāhui) ītōcā cē tlapōhualli auh moihcuiloa "19".
    Ōmpōhualmahtlāctli omōme (ōm + pōhual + mahtlāctli + om + ōme) … "52".
    Nāuhpōhualmahtlāctli omēyi (nāuh + pōhual + mahtlāctli + on + ēyi) … "93".

The remaining two are a Spanish chemistry infobox (`Estados de oxidación (óxido) +2`) and a decay-mode
column (`0,012% 8,125 h ε β + 0,854`). Not one plus in this corpus is an arithmetic operator in Nahuatl
prose. Reading it as a plus word would turn a morphological gloss into *cēm plus pōhual plus on plus ēyi* —
a defect that produces a READING (trap 56) and one this layer would have INTRODUCED.

⚠ **`=` IS A GLOSS SEPARATOR AND AN INFOBOX KEY.** ×12 over the unique segments: six are `TC= 647,096 K`, `PC= 22,0664MPa`,
`d=322kg/m³` (Spanish physics infobox key=value); three are `2, a, 12, 24 = mochīhualiztli: Nāhui
Tlapēuhcāyōtl` (a calendar table's label column); two are a GREEK gloss,
`(θανατοσ=miquiztli, Ερωσ=tlazohtlaliztli)`. Exactly ONE is an equation, and it is a definition of a
calendar unit: `1 Nēmontēmi = 5 nozo 6 Tōnalli`.

⚠ **`×` IS SCIENTIFIC NOTATION, FOUR TIMES OUT OF FOUR** — `1.4×10²¹ kg`, `5.1×10¹⁸ kg`,
`1,67262 × 10–27 kg`, `1,602 176 487(40) × 10-19 culombios`. The corpus also writes the same operation with
ASCII `x` (`>1,2 x 10¹⁵ a`, `2,144 x10⁶ a`, `7,61 x 10⁶ m⁻¹·Ω⁻¹`), always in the imported Spanish
infoboxes. The one `>` is that same `>1,2 x 10¹⁵`.

⚠ **THE `º` CONFUSABLE IS A SPANISH ORDINAL, NOT A DEGREE — the opposite direction from the last three
rounds.** `°` U+00B0 ×12 is the degree; `º` U+00BA MASCULINE ORDINAL INDICATOR ×3 is not:

    2º Potencial de ionización 5250,5 kJ/mol
    2º potencial de ionización 1757,1 kJ/mol
    3º potencial de ionización 14848,7 kJ/mol

Hawaiian's round widened its degree class to a confusable (`˚` U+02DA) and was right to. Doing the same
here reads *second ionization potential* as *two degrees*. The confusable is present and must be EXCLUDED.

⚠ **THE AMPERSAND NEVER JOINS TWO NAHUATL WORDS.** ×18, and every single one is either the literal HTML
entity `&nbsp;` (×10 — `25&nbsp;°C`, `133&nbsp;km`, `45.9&nbsp;km`) or a FOREIGN proper name: English band
credits (`Queen & David Bowie`, `Hope & Anchor`, `Blank & Jones`, `Jo & Co`), German publisher imprints
(`Schuster & Loeffler`, `Fretz & Wasmuth`), `Ward Lock & Co`, and the Spanish decay column `FE & α`. The
Nahuatl conjunction is abundantly attested (`ihuan` ×514, `īhuān` ×112 on nah.wikipedia) and is still the
wrong thing to emit — it would speak a Nahuatl word inside an English band name.

IMPLIED: the arithmetic classes are refusals, not gaps, and the argument is per-instance rather than
"×0". The `&nbsp;` entity, on the other hand, is pure markup residue with a real cost and is repairable.

---

## Run 3 — 2026-08-16 — the separators split by ARTICLE LANGUAGE, and the colon splits by ARITY

    node scratchpad/scan.mjs '\d[.,]\d+'
    node scratchpad/scan.mjs '\d{1,2}:\d{2}'
    node scratchpad/scan.mjs '\d\s?-\s?\d'

QUESTION: which mark groups, which decimates, and how many colons are actually clocks?

RAW — the three-digit test, run on both marks:

    `,` GROUPING (Nahuatl prose)   384,400 km · 3,746 km · 37,932,330 km² · 21,860,000,000 km³ ·
                                   1,500,000 · 2,600,000 · 222,297 · 100,000 · 18,980 · 1,000
    `.` DECIMAL  (Nahuatl prose)   1.72% · 1.74% · 0.04% · 96.5% · 99.86% · 45.9 km · 2.5 · 0.6 ·
                                   4567.9 · 4570.1 · 5.8 metro · 8.2 Mw · 7.1 Mw · 1.4×10²¹ · 5.1×10¹⁸
    `,` DECIMAL  (Spanish infobox) 647,096 K · 643,847 K · 22,0664MPa · 21,671MPa · 293,15 K · 0,012% ·
                                   8,125 h · 100,1 años · 3,47 E7 · 1,67262 × 10⁻²⁷ · 68,077% · 99,988%
    `,` CHAPTER,VERSE              Mt 20,29-34 · Mc 10,46-52 · Lc 18,35-45 · Mt 1,18-2,23 · Lc 3, 23-38
                                   (≈25 instances across the Gospel articles)
    ` ` GROUPING (Nahuatl prose)   1 000 000 · 5 000 000 · 720 000 · 480 000 · 128 000 · 149 600 000
    `.` NOT a decimal              ISBN 970-07-6492-3 has none, but `d=322kg/m³` and the ISO dates do

⚠ THE COMMA GROUPS IN NAHUATL AND DECIMATES IN SPANISH, and there is no orthographic feature separating
`647,096 K` (647.096 kelvin, water's critical temperature) from `384,400 km` (the lunar distance). Both are
one-to-three digits, a comma, and three digits. The three-digit test gets all ten Nahuatl groupings right
and misreads FIVE Spanish-infobox decimals whose fractional part happens to be three digits long
(`647,096 K`, `643,847 K`, `21,671MPa`, `8,125 h`, `1,602 176 487`). Declining the comma entirely would
instead misread all ten groupings, including `21,860,000,000 km³`. The test ships, with that cost stated.

⚠ AND THE SPACE IS A GROUPING MARK IN THE NAHUATL PROSE — which the baseline probe showed is the single
worst-reading class in the corpus, because `720 000` reads as *seven-hundred-twenty* followed by the
zero stopgap *ahtle*. The paleoanthropology articles use it throughout and GLOSS EVERY FIGURE with the
vigesimal words, which is what confirms the reading:

    nāuhpōhualxiquipilli īpan mahtlācxiquipilli (720 000)      4·160 000 + 10·8 000 = 720 000  ✓
    yēpōhualxiquipilli (480 000)                               3·160 000            = 480 000  ✓
    caxtōllioncenxiquipilli (128 000)                          16·8 000             = 128 000  ✓
    mācuīlpōhualxiquipilli īpan cempōhualxiquipilli nō mācuīlxiquipilli (1 000 000)
                                                800 000 + 160 000 + 5·8 000 = 1 000 000        ✓
    cenxiquipilli īpan mācuīltzontli (10000)                   8 000 + 5·400        =  10 000   ✓

That is an independent confirmation of `src/languages/nahuatl/numbers.ts`'s whole base-20 magnitude ladder,
found in running text rather than in Wiktionary. (One gloss disagrees: `centzonxiquipilli īpan
mācuīlpōhualxiquipilli (5 000 000)` sums to 4 000 000, so the corpus's own arithmetic is off by a
`pōhualxiquipilli` there. The compositor is right and the article is wrong; recorded, not acted on.)

⚠ **THE COLON IS A SCRIPTURE REFERENCE 14 TIMES AND A CLOCK 6 TIMES, AND ARITY SEPARATES THEM PERFECTLY.**

    CLOCKS (6)     4:00 hrs · 12:14 hrs · 12:02:50 nicān cāhuitl · 18:02:50 UTC ·
                   23:49:17 nicān cāhuitl (UTC-5) · 13:14:40 nicān cāhuitl (UTC-5)
    SCRIPTURE (14) Mateo 1:16 · Mateo 27:17 · Mateo 27:22 · Marcos 8:29 · Lucas 2:11 · Lucas 9:20 ·
                   Juan 1:41 · Lucas 1:26-38 · Lucas 2:1-19 · Juan 19:25-27 · Tlachiuhtli 1:14 ·
                   Mateo 1:18 · Lucas 1:27 · Tlahtohqueh 18:41-45

Every three-part `h:m:s` is a clock (4/4) and no verse reference has three parts; both two-part clocks
carry `hrs` and no verse reference does. An hour-bounded `H:MM` rule — the fleet standard — would read
`Marcos 8:29`, `Lucas 2:11`, `Lucas 9:20`, `Mateo 1:16`, `Juan 1:41`, `Mateo 1:18`, `Lucas 1:27`,
`Tlachiuhtli 1:14`, `Lucas 1:26`, `Lucas 2:1`, `Juan 19:25` and `Tlahtohqueh 18:41` as TIMES OF DAY.
Hawaiian escaped this because its wiki writes verses with U+02D0; this corpus writes them with the same
ASCII colon as its clocks, so the guard has to be the arity and the marker word.

⚠ THE HYPHEN BETWEEN DIGITS IS MOSTLY A CITATION, NOT A SPAN. ×52: about 25 are the verse ranges above,
4 are ISO dates (`(1962-10-05)`, `(1964-03-20)`), 3 are one ISBN (`970-07-6492-3`), 1 is an exponent minus
(`10-19 culombios`), 1 is a UTC offset (`UTC-5`). The genuine spans are the life-and-reign dates and two
measured ranges: `Itzcōātl (1427-1440)`, `(1867-1934)`, `(1494-1524/1525)`, `(98-117)`, `1765 - 1815`,
`18-22 Febrero`, `266-270 ilhuitl`, `21-35`. The fleet-standard trailing `(?!\s?-\s?\d)` chain guard
declines the ISO dates and the ISBN without further work; the `(?<![\d.,\-/])` head guard declines their
second and third joins.

The em- and en-dashes are NOT numeric copulas here: `—tlacatqui inic 1525—` and
`―yehica ipan inin teotlahcuilolli…―` are parentheticals, `"—Notecuiyoé, Tlācatlé…` is a quotation dash,
`(1934–1964)` is a life span, `1866 – Santiago de Compostela` separates a birth place from a death place,
and `10–27` is an exponent. So a `[–—]` between digits fires on exactly two instances, one of which is
inside the scientific-notation debris the layer refuses anyway.

IMPLIED: write the space-grouping rule (highest value in the corpus), the comma three-digit test, the
decimal dot; gate the clock on arity-or-`hrs`; keep the fleet range rule as-is.

---

## Run 4 — 2026-08-16 — nci.wikipedia.org is not a wiki; the attestation lives under `nah`

    npx tsx tools/normalization/attest.ts --lang nci --words "…"

RAW:

    nci.wikipedia.org does not respond as a wiki — a negative from here is NOT evidence.
    Pass --wiki <code> if this language's wiki is filed under a different code.

IMPLIED: a dead end that would have produced a whole page of false ×0 refusals if the tool had not said so.
The mined artifact's own header line says `source: nci.wikipedia.org dump` — that label is wrong; the
Nahuatl Wikipedia is `nah.wikipedia.org`. Every attestation below is `--wiki nah`. **Backlog item**, not
fixed here: `mine.ts` writes the ISO code into the source line without checking it resolves.

---

## Run 5 — 2026-08-16 — the measure vocabulary of this corpus is SPANISH, and the percent word does not exist

    npx tsx tools/normalization/attest.ts --lang nci --wiki nah --words \
      "porciento,porcentaje,ciento,grado,grados,kilometro,kilómetro,kilómetros,metro,metros,\
       centímetro,centímetros,hora,horas,cuadrado,cuadrados,cúbico,cúbicos,millones,millón,mil,\
       tomin,peso,pesos,īhuān,ihuan,kilogramo,kilogramos,gramo,minuto,minutos,segundo,segundos,\
       tlapōhualli,pōhualli"

QUESTION: which of the words a symbol tier would need actually exist, and in the slot needed?

RAW (token / articles / verdict), and THE EXAMPLES, which are the part that decided each one:

    porciento    0  absent  |  porcentaje  0  absent  |  ciento  0  absent
    grado        0  absent  |  grados      1  attested
    kilometro    1  attested | kilómetro   0  absent  |  kilómetros  1  attested
    metro        1  attested | metros      1  attested
    centímetro(s) 0 absent  |  kilogramo(s) 0 absent  |  gramo 0 absent
    cuadrado(s)  0  absent  |  cúbico(s)   0  absent
    hora         3  attested | horas       4  attested
    millones     9  attested | millón      0  absent  |  mil  5  attested
    tomin       14  attested | peso        4  attested | pesos 1 attested
    minutos      2  attested | segundos    1  attested
    ihuan      514  attested | īhuān     112  attested

⚠ **NO PERCENT WORD EXISTS ON THIS WIKI.** All three candidate spellings are ×0 — and `ciento` at ×0 rules
out the two-token Spanish `por ciento` as well, since its head noun would have to appear. Seventeen `%`
in the artifact (nine of them in Nahuatl prose: `78%`, `21%`, `1%`, `71%`, `96.5%`, `99.86%`, `1.74%`,
`1.72%`, `0.04%`) and nothing to read them with. The shared tier's `percent` field is OMITTED, which is
what it is for (the Tashelhit case in its own doc).

⚠ **`grados` ×1 IS A RICHTER MAGNITUDE, NOT A THERMOMETRIC DEGREE**, and that is the whole of the evidence:

    …zā tēpan ōcatca in 8.0 grados īpan octacatl Richter in tlein īpan miércoles ōquitzetzeloh…

It is nevertheless a MEASUREMENT-SCALE degree in Nahuatl-wiki prose, in the numeral-then-noun slot, and it
is the same word Spanish uses for `°C` — which matters because, as the rest of this run shows, this wiki's
measure nouns ARE Spanish. Shipped as the bare scale word with the scale letter left unread (the Karakalpak
`gradus` shape), and the single Richter example is stated in the header rather than smoothed over.

⚠ `hora` ×3 IS TWO SPANISH NOVEL TITLES AND ONE REAL HOUR — the film-title trap, caught by reading:

    …Premio de la Novela ESSO por La mala hora (1961)…        ← a García Márquez novel
    …Confabulario total, 1962 La hora de todos, 1954…          ← an Arreola collection
    …azo ya ipan matlactli hora in onecencahualoc inic omocac Misa…   ← "at about ten o'clock"

`horas` ×4 is likewise two-thirds foreign (`Con las horas contadas`, the Spanish gloss `horas-hombre`) with
two real countable hours in the Nahuatl YouTube article (`se billón horas`, `500 horas tlen contenido`).
Attested, thinly, in the right slot — enough to expand the `hrs` of `12:14 hrs`, which currently reads as
*ɾs*.

⚠ `kilometro` / `kilómetros` and `metro` / `metros` are each ×1 and each in the exact slot:

    …itech catqui chicuace kilometro ihuan ixelihuian…                 six kilometres
    …in ic 149 600 000 kilómetros cah auh ītlanēx nehnemi…             149 600 000 kilometres
    …Huel ahci ce ioctacayo inic 5.8 metro ihuan ce etiliztli…         5.8 metres
    …Quin caxtōlli minutos in ācuecueyōtl ōahcic īxquichica ēyi metros… three metres

⚠ AND THE MEASURE NOUNS THE CORPUS DOES NOT HAVE ARE THE MOST TELLING PART. `centímetro` ×0 against
8 instances of `cm` in the botany articles; `kilogramo`/`gramo` ×0 against 6 of `kg`; `cuadrado`/`cúbico`
×0 against the two genuine `km²` / `km³`. Those stay unread and are registered as gaps, not invented.

⚠ THE CURRENCY IS SELF-GLOSSED, IN SPANISH, IN ITS ONLY INSTANCE:

    Naman ipatiuh cetzin $40 pesos tlen tomin.

The writer has already written `pesos` — and `tomin`, the Nahuatl money word (`tomin` ×14, from Arabic
*ṯúmn* via Spanish, per nah.wikipedia's own article). Expanding `$` would say the noun twice. One instance,
declined.

⚠ AND SO IS THE FRACTION, THREE TIMES OUT OF THREE. The Moon article writes the figure and the Nahuatl
words together:

    Īdiámetro (3,746 km) īnnāhui cē (1/4) ītechpa in tlālticpactli īdiámetro          ¼
    ītlaīxpayo īmmahtlāctli oncē cē (1/11) (37,932,330 km²)                            1/11
    īvolumen cēqui īnōmpōhualli ommahtlāctli cē (1/50) (21,860,000,000 km³)            1/50

The idiom is `ī(n/m)-<denominator> cē` and it is derivable (īn- before a vowel or n-, īm- before m-), but
every instance is already spoken by the writer, so a rule would double it. Declined, with the idiom
recorded here for a corpus that one day writes a bare `1/4`.

IMPLIED: the tier's `percent`, `currency`, `exponentWords` and `ampersand` are all omitted. What remains
sourceable is `kilometro/kilómetros`, `metro/metros`, `grados`, `horas`.

---

## Run 6 — 2026-08-16 — the shared tier's optional space is what kept it out of this layer

    node scratchpad/scan.mjs '\d\s?m(?![\p{L}\p{M}])'

QUESTION: can `makeSymbolNormalizer` carry the two units that ARE sourceable?

RAW — every bare `m` after a digit in the retained text:

    GENUINE (5)  momātia ītzalan 0.6 īhuān 3 m.   ·  Momātia īxquichca 10 m īhuān xoxoctic
                 Momātia īxquichca 25 m           ·  Momātia 10 īxquichca 12 m
                 Momātia īxquichca 5 īxquichca 16 m
    NOT A METRE  180m Ta {Sin} >1,2 x 10¹⁵ a      ← tantalum-180m, an isomer label
                 The Memory of Trees US#9 (1995) 9.8m sales   ← 9.8 MILLION albums
                 A Day Without Rain US#2 (2000) 15m sales     ← 15 million
                 Velocidad del sonido 4970 m/s a 293,15 K (×3) ← a rate, no `s` noun to compose with

Every genuine metre has a SPACE before the `m`; not one of the three false ones does. The shared tier
matches `(NUM)\s?(unit)` — the space is OPTIONAL by design, and correctly so for the fleet — so declaring
`m` there reads *9.8 metros sales*: a defect that produces a reading, introduced by this layer (trap 56).
With `percent`, `currency`, `exponentWords` and `ampersand` all already omitted for want of a word, `units`
was the last field the tier would have carried, so the layer declares NO tier and writes the two unit rules
locally with the space the corpus's own data demands. `km` and `cm` never occur glued to a digit, so the
requirement costs nothing there.

IMPLIED: `src/languages/nahuatl/normalize.ts` imports nothing from `core/normalizeSymbols.ts`. Stated in
its header so the next reader does not "fix" it.

---

## Run 7 — 2026-08-16 — the era marker has four mutually inconsistent forms and no expansion

    node scratchpad/scan.mjs '(?<![\p{L}\p{M}])[\p{L}]{1,4}\.\s?[\p{L}]{1,4}\.'

QUESTION: is there a dotted era marker worth expanding, as `b.e.sh.` was for Karakalpak?

RAW — the era abbreviations in this corpus, all of them:

    …circa Xōpaniztli itech 7 a.X. ahnozo 5 a.X. xihuitl, itech Bethleem…
    …oahcihqueh in Anahuac ixquich in xihuitl 500 z. C. oquinpetonilihqueh…
    …achi ye iuhqui 42 xihuitl d.C. īhuān ōquichichinaquiltīlo… 67 xihuitl d.C.
    …Arpino, inic 3 … inic 106 a.T. - Formia, inic 7 … inic 43 z.T.) catca ce tepantlahtoani…

Four different abbreviations — `a.X.`, `z.C.`, `d.C.`, `a.T.`/`z.T.` — across eight instances, on a wiki
that has evidently never settled on one. `d.C.` is Spanish *después de Cristo*; the `a./z.` pair looks like
a Nahuatl calque (`achto` / `zatepan`) with two different second letters. No expansion of any of them is
attested as running text anywhere, and inventing the four-way spellout is exactly the coinage this round is
supposed to refuse. They are left as they are, with their false sentence breaks, and registered in the
backlog. The other dotted runs are foreign initialisms — `D.F.`, `J.K.`, `R.M.S.`, `P.S.`, `A.D.`.

IMPLIED: no era rule. This is a real, measured gap and it stays visible.

---

## Run 8 — 2026-08-16 — the layer, and what each rule was measured against

`src/languages/nahuatl/normalize.ts` ships eight steps, in this order:

1. zero-width strip — U+200B ×15, doubled after `uan ` throughout the machine-translated modern-Nahuatl
   articles (`uan ​​eli nopa ompa ueyi tlanemakaketl`), plus U+FEFF.
2. `&nbsp;` → space — ×10, the literal entity, which today reaches the g2p as the word *nbsp* and blocks
   the unit rules behind it (`133&nbsp;km`, `45.9&nbsp;km`).
3. space de-grouping, three-digit test — `1 000 000`, `720 000`, `149 600 000`.
4. comma de-grouping, three-digit test — `384,400`, `21,860,000,000`.
5. the decimal dot, neutralised — no decimal word is sourceable and none was sought beyond `punto`/`coma`
   (see Run 9); the defect being fixed is the false sentence break, the Punjabi/Karakalpak choice.
6. the clock, gated on arity-or-`hrs` — Run 3.
7. degrees, `°` only, `º` excluded — Run 2.
8. the two units, space-required — Run 6. Then the range hyphen and the `[–—]` pause.

---

## Run 9 — 2026-08-16 — a second attestation batch, for the words the refusals rest on

    npx tsx tools/normalization/attest.ts --lang nci --wiki nah --words \
      "menos,negativo,veces,igual,más,punto,coma,celsius,centígrados,fahrenheit,kelvin,por,hrs,…"

QUESTION: is any of the refused classes rescuable by a word this round has not tried?

RAW (token / articles / verdict), with the examples that decided each:

    menos 21 attested | negativo 0 | veces 0 | igual 1 attested | mas 34 attested
    punto 0 | coma 0 | celsius 0 | centigrados 0 | fahrenheit 0 | kelvin 0
    hrs 2 attested | cuadrada 0 | cubica 0 | billones 1 | billon 1 | segundo 0 | grado 0

    menos:  …Activo: Ni- mas el verbo menos vocal larga final o vocal inicial opcional: "Nitlalia"…
            …Objeto: Nech- mas el verbo menos vocal larga final o vocal inicial opcional…
            (all 21 hits, one Spanish grammar table in the Nahuatl-morphology article, one row per
             person and voice — the preposition *without*, describing a morphological subtraction)
    igual:  …Wikipedia caxtilcopa es la edicion en espanol de Wikipedia. Al igual que las versiones…
            (the ONE hit, and it is Spanish *just like*, not *equals* — the round's chickpea)
    mas:    …Mas negro que la noche (caxtillantlahtolcopa Achi tliltic in amo yohualli)…  ← a film title
    hrs:    the corpus's own two clock instances and nothing else

⚠ THE MINUS REFUSAL COSTS, and the price is stated rather than papered over: `-1° C`, `(-120 °C)` and
`(-2O°C)` are true negatives in the water and climate articles, and a dropped minus INVERTS them. There is
nothing to read them with. ⚠ `punto` ×0 and `coma` ×0 confirm the decimal mark must be NEUTRALISED rather
than spoken, and `celsius`/`centígrados`/`fahrenheit`/`kelvin` all ×0 confirm the degree word ships bare.

IMPLIED: eleven of the thirteen sign classes are refusals with a per-instance argument; `degrees` and
`exponent` are the two the probe does not report as dropped. Registered in `ACCEPTED_SIGN_SILENCE.nci`.

---

## Gates

    corpus-diff emit/compare  changed 67/377 (17.8%)
                              DROP 54 -> 45
                              DIGIT 0/0 · SLOT-GAP 0/0 · RAWMARK 0/0 · ZERO-WIDTH 0/0 ·
                              RAW-CAPS 0/0 · THROW 0/0     (before / after)

    review.ts --lang nci      [ ok ] sign classes    none dropped
                              [ ok ] clause-final    a trailing . or , loses no reading
                              [ ?? ] sourcing        "no percent/currency/decimal word declared"
                                     — not red, and it CANNOT be green here: the gate reads the
                                       percent and currency arms only, and this layer declares
                                       neither because neither word exists (Run 5). The four words it
                                       does emit — kilómetros, metros, grados, horas — are all in
                                       tools/corpus/attest/nci.jsonc with their examples read.
                              [ ok ] normalizer / wired into text() / tests / artifact tracked /
                                     artifact current / sign probes / spelling → g2p
                              [FAIL] artifact scan   residuals, each read and recorded:
                                     DROP exponent ×9 (Spanish isotope/electron-configuration
                                     superscripts) · LEAK kg ×6 · DROP minus ×2 · LEAK dm ×2 ·
                                     LEAK ll ×2 (an orthography article's paragraph about the
                                     digraph) · LEAK km ×1 (the km²/km³ pair, excluded on purpose) ·
                                     LEAK sg ×1 · LEAK vn ×1 (colonial Spanish, 1555) ·
                                     DROP degree ×1 (`Les n°1 de Nana Mouskouri` — the FRENCH NUMERO
                                     sign, which has no digit before it and is correctly untouched)

    referee-eval nci          wikipron nci_latn_broad (886, PRIMARY):  160/886 raw · 93.1% folded · 98.8% symbol
                              kaikki Classical Nahuatl (2329, SECONDARY): 51/2329 raw · 92.1% folded · 98.3% symbol
                              — byte-identical to the baseline. The layer touches text() only; the
                                referee scores phonemizeWord, so no movement is possible or wanted.

    npx tsc --noEmit          clean
    npx vitest run            4607 passed · 5 skipped · 1 FAILED
                              The one failure is `language catalogue > the derived normalization
                              column matches the repo`: adding a normalizer makes nci's cell in
                              tools/language-catalogue/catalogue.tsv stale by exactly one
                              ((none)=39, done=164 derived vs the file's 40/163). That file is
                              regenerated centrally and is explicitly out of scope for this round;
                              test/nahuatl.test.ts is 50/50 and every other file passes.

## Backlog surfaced, not fixed

- **`mine.ts` writes an unvalidated wiki host into the artifact header.** `tools/corpus/mined/nci.jsonc`
  says `source: nci.wikipedia.org dump`; there is no nci.wikipedia. `attest.ts` catches it at query time
  and says so, which is the only reason this round did not produce a page of false ×0 refusals — but the
  artifact's own provenance line is wrong.
- **The era marker, four ways.** `a.X.` / `z.C.` / `d.C.` / `a.T.`–`z.T.`, ×8, no attested expansion. Each
  leaves two false sentence breaks.
- **`cm` ×8, `dm` ×2, `kg` ×6 have no Nahuatl or corpus-Spanish noun** (`centímetro`, `kilogramo`, `gramo`
  all ×0 on nah.wikipedia). The botany articles are full of `cm`; a wiki that grows a metric vocabulary
  would unlock them.
- **`km²` ×1 and `km³` ×1 stay unread** — `cuadrado`/`cúbico` ×0. Two instances, both in the Moon article.
- **The fraction idiom `ī(n/m)-<denominator> cē`** is derivable from three self-glossed instances
  (`īnnāhui cē` ¼, `īmmahtlāctli oncē cē` 1/11, `īnōmpōhualli ommahtlāctli cē` 1/50) and is not implemented,
  because all three are already spoken by the writer.
- **The Spanish decimal comma inside the imported chemistry infoboxes** — five figures whose fractional
  part is exactly three digits (`647,096 K`, `643,847 K`, `21,671MPa`, `8,125 h`, `1,602 176 487`) are
  de-grouped by the three-digit test and read as large integers. Fixing it needs an article-language
  signal this layer does not have.
- **The corpus's own vigesimal arithmetic is wrong once**: `centzonxiquipilli īpan
  mācuīlpōhualxiquipilli (5 000 000)` sums to 4 000 000.
- **`ll`, `sg`, `vn` RAW-LATIN leaks** are not units at all — `ll.` heads an orthography article's
  paragraph about the digraph, `vn` is colonial Spanish `vn vocabulario` (1555), `sg` is a legal citation.
  No rule can or should touch them.
