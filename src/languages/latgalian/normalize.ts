/**
 * Latgalian (ltg) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/ltg.jsonc` — ltg.wikipedia dump, 3,444 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 1,374 · `year` 1,352 · `abbrev` 605 · `initialism` 352 ·
 * `ranges` 217 · `decimals` 197 · `units` 144 · `roman` 123 · `signs` 102 · `dotted` 89 · `percent` 75 ·
 * `grouped` 70 · `exponent` 62 · `signed-number` 28 · `clock` 27 · `ordinal-latin` 22 · `degrees` 18 ·
 * `ampersand` 15 · `arithmetic` 13 · `fractions` 12 · `ordinal-range` 7 · `era-marker` 3 · `rate` 2 ·
 * `currency` 1. Everything below counted over the artifact's 394 retained segments unless said otherwise.
 *
 * ⚠ THE SIBLING IS A HYPOTHESIS AND ITS UNIT TABLE IS A LANDMINE (playbook trap 55). Latvian is the obvious
 * template — `src/languages/latvian/normalize.ts` landed days before this — and porting its `UNITS` would
 * have read THIRTY-TWO YEARS as a weight. **⟨g.⟩ is this corpus's YEAR abbreviation** (*gods*), and it is
 * digit-adjacent in exactly the shape a gram key matches:
 *
 *     1577 g. — Ivana Borguo vodomi krīvu karapulki iznycynoj Dynaburgu
 *     Dzymuse 1935 g. apreļa 22 d.        2003/2004 g. sezonā        1983.g. pījimts Ministru Padūmis lāmums
 *
 * Measured: **`\d[\s.]?g\.` ×32** against **one** genuine gram in the whole retained text
 * (`svors — 650—800 g.`, a boules ball). Latvian declares `g` and is right to; Latgalian must not, and the
 * gram therefore stays unread. That single letter is the round's finding.
 *
 * ⚠ THE COMMA IS BOTH SEPARATORS, AND SO IS THE DOT — four conventions in 394 segments. The comma decimates
 * ×65 (`56,4°`, `9,21%`, `12,8 m`, `0,702804 latu`) and groups ×9 (`1,500 solu`, `548,000 cylvāku`,
 * `3,555 km2`, `450,295 km²` = Sweden, `2,300 km²`). The SPACE also groups ×29 (`83 871 km²`, `9 223 766
 * dzeivuotuojim`, `700 000 daļderu`). And the DOT decimates ×12 — `16.3 °C`, `−3.5 °C`, `5.2 °C`, `3.5%`,
 * `1.8 milijoni` — while also writing ×5 DATES (`07.02.1922.gods.`, `1858.07.01 — 1922.12.16`,
 * `17.12.1932`) and two VERSIONS (`HTML versija 4.01`, `XHTML 1.0`). The three-digit test decides the comma
 * and a one-dot-in-the-run test decides the dot.
 *
 * ⚠ AND THE THREE-DIGIT TEST IS WRONG TWICE, WHICH IS STATED RATHER THAN HIDDEN. `Iudiņbaseina pluots
 * 87,900 km² (33,900 mi²)` is Drīdzis lake's catchment; the lake's own surface is given as `753 ha` in the
 * same infobox, i.e. 7.53 km², so 87.9 km² is the quantity and 87,900 km² (bigger than Latvia) is not. The
 * pair is self-consistent under either reading — 87.9/2.59 = 33.9 and 87900/2.59 = 33900 — so nothing in
 * the string separates them. 7 grouping instances against these 2; the majority ships and the minority is
 * recorded.
 *
 * ⚠ THE COLON IS NEVER A CLOCK HERE. `\d:\d` occurs exactly ONCE in the retained text and it is a CURRENCY
 * RATIO — "atmejūt ekeju (ECU, European Currency Unit) pa kursam 1:1". A ported clock rule (ceb's bare
 * `\d{1,2}:\d{2}` is the fleet's usual shape) would have fixed nothing and read an exchange rate as a time.
 * No clock rule ships, and `clock` ×27 corpus-wide is the cell's own warning: its hard-set examples are
 * DOTTED DATES and EasyTimeline bar rows (`bar:1800 at: 832700 text: 0.83`), not times of day.
 *
 * ⚠ THE CORPUS GLOSSES ITS OWN DEGREE SIGN, in a sentence about the same fact as the symbolic one:
 *
 *     Vydyskuo temperatura janvara mienesī -7°C, juļa mienesī +17°C          ← the sign
 *     registrāta vysuzamuokuo temperatura (–43 gradi C) … vysuaugstuokuo (+36 gradi C)   ← the words
 *
 * so `gradi` (×4 corpus, ×6 wiki, every example a temperature) is the degree word, and the writer's own
 * bare ⟨C⟩ after it is read too — untouched it reaches the g2p as Latgalian /t͡s/, a plausible syllable no
 * leak class can see (playbook trap 56, the defect Latvian's ⟨C⟩ and Basque's `º` both reached).
 *
 * ⚠ THE SCALE NAME EXISTS AND IS A POSTPOSED PREPOSITIONAL PHRASE, which is why it is emitted by a LOCAL
 * rule and not through the tier's modifier slot: ltg.wikipedia writes `-9° pa Celseja skolai`,
 * `+18° pa Celseja skolai` and `+29,3 gradu pa Celseja skolai` — "on the Celsius scale". `Celsija` (the
 * Latvian genitive) is ×0; `Celseja` is ×3 in 2 articles. Nothing attests a `Celseja gradi` modifier.
 *
 * ⚠ THE SQUARE WORD WAS FOUND ONLY BY THE SLOT-SHAPED PROBE (playbook trap 40). `kvadratkilometri`,
 * `kvadratmetri`, `kvadrats`, `kvadratā`, `kubikmetri` are ALL ×0 on ltg.wikipedia; `kvadratkilometru` is
 * ×2 in 2 articles and is in exactly the slot — "kura pluots viņ nazcik kvadratkilometru", "vīns saskys
 * izlītoj apmāram 1 kvadratkilometru lelu pluotu". So the measure word is `kvadrat-` FUSED to the front,
 * `position: "compound"` as in Latvian, and it carries `km²` ×24 plus `km2` ×10. ⚠ `kvadrata` ×1 is the
 * SHAPE ("kvadrata forma ar četrim portikim") and is not this word — the trap-37 reading, checked.
 * The CUBE word is absent in every spelling and `³` is ×0, so nothing is declared and nothing is lost.
 *
 * ⚠ `=` IS FOURTEEN TIMES AND THE WORD IS THE SECOND REASON TO DECLINE IT. Five are EasyTimeline chart
 * markup the extraction left in (`PlotArea = left:50`, `ScaleMajor = unit:year`, `ScaleMinor = …`), two are
 * formula assignments (`x = log(1)`, `y = log(69971)`), one is an English sentence, three are currency
 * equivalences whose right operand is a WORD (`1 eura (EUR) = apmāram 0,702804 latu`), two are Gothic
 * numeral glosses (`𐌹𐌱 = 12`) and ONE is arithmetic (`26*26=676`). A digit gate would take three of
 * fourteen — and `vīnaids` ×3, the attested "equal", is an ADJECTIVE that takes its complement with `ar`
 * ("teik vīnaids ar breivuos krisšonys padreizīni"), which the tier's between-the-operands slot cannot
 * express. Same shape as chv's `тан`, kaa's `teń` and haw's `huinahelu`.
 *
 * ⚠ `*` IS CLAIMED AND `†`'s TWIN IS NOT — the guard is digits on BOTH sides. `26*26=676` is a product;
 * `Kalimahs (; * ap 310—305 g. p. Kr. …, † ap 240 g. p. Kr.)` is the BIOGRAPHICAL BIRTH ASTERISK, and it is
 * the other of the corpus's two. `reiz` ×1 corpus / ×1 wiki is the same sentence and is exactly this frame:
 * "diveju komandu kaitaunīkim 15 reiz 4 m pluota laukumeņā" — a 15-by-4-metre pitch. ⚠ `reizi`/`reizis` ×12
 * is the NOUN "time(s)" ("Div reizis par godu", "pyrmū reizi"), so only the bare form is the operator.
 *
 * ⚠ THE MINUS IS REFUSED AND IT COSTS, which is said rather than papered over. `mīnuss`, `mīnus` and `plyus`
 * are all ×0 on ltg.wikipedia; `plus` ×1 is inside an ENGLISH sentence on the IT-glossary page ("translates
 * common terms of IT (plus some Wikipedia specific ones)"); `plyusmuos` ×1 is *plūsma*, a flow. A minus
 * INVERTS its operand, so `-7°C` and `−3.5 °C` read as positive. Six instances, three encodings — ASCII
 * `-7%`, U+2212 `−3.5 °C`, and EN DASH `(–43 gradi C)` — and no word to read any of them with.
 *
 * ⚠ THE EM DASH IS A COPULA ×169 AND ONCE A MINUS, and the once is not claimable. "Vysuzamuokuo Daugpilī
 * registrātuo temperatura beja — 43° C" is −43 °C (the parallel article writes `(–43 gradi C)`), but the
 * same mark stands in for the absent verb in "Bolvi () — mīsts pūstumu Latgolā" and 160-odd others.
 * Widening the sign class to `—` for that one instance would read every one of them as a negative — the
 * Karakalpak finding, arriving from the other side.
 *
 * ⚠ THE RANGE DASH IS SPENT ON A PAUSE, NOT A CONNECTIVE. Latgalian writes the span as `nu X da Y` and this
 * corpus does so in full wherever it means it — "nu 16.3 °C … da 18.1 °C", "nu 535 da 727 mm", "nu 1920 da
 * 1945 godam", "nu 287 000 da 422 000", "nu 75 leidz 110 milijonim". Not one of the 53 attested spans
 * writes `da` WITHOUT its `nu`, so imposing the connective on a bare dash asserts a frame the corpus never
 * writes (playbook trap 9). haw and kaa reached the same conclusion on the same evidence shape.
 *
 * ⚠ THE ORDINAL PERIOD IS 139 SITES AND ITS ORDINAL IS NOT COMPOSED. Latgalian marks an ordinal with a
 * period after the figure and this engine has no ordinal series (`numbers.ts` is cardinals only, and
 * nothing in the tree attests one). What IS independent of that is that the period is not a full stop: it
 * was reading `Nu 1964. da 1968. godam` and `143.–153. lpp.` with a SENTENCE BREAK inside them. So the dot
 * is removed and the figure left cardinal — Latvian's measured half-measure, for the same reason and with
 * the same statement of what it costs. 139 sites take it; the 14 that must NOT be touched (a following
 * upper case or the end of input) are left alone, and two of those — `1789. Godā nūtyka`, `1. Godasymta
 * prīkš Krysta` — are ordinals with a CAPITALISED head noun that this guard correctly declines to claim.
 *
 * ⚠ THE ABBREVIATIONS THAT HIDE A CASE ARE LEFT RED, and each one reads as a plausible Latgalian syllable
 * today rather than as a visible leak: `g.` ×32 → [k], `gs.` ×20 → [ks], `lpp.` ×4 raw. `godu symts` is
 * attested in full ×17 but the corpus writes it in the GENITIVE (`da poš 20 godu symta`, `nu 17.-18.
 * godusymta`, `Da 13 godu symta`, `XX godusymta beigu`) and in the LOCATIVE (`15.–17. godu symtā`,
 * `XX godusymtā` ×2) in the same slot — 4 against 3, which is a coin flip, not a derivation. Expanding to
 * a citation form would put a real word in the wrong case (Latvian's argument for the same abbreviation).
 *
 * SOURCING — every word emitted is an ltg.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/ltg.jsonc`. ⚠ TWO OF THEM WERE WRONG ON THE FIRST READING AND THE EXAMPLES CAUGHT
 * BOTH: `grads` ×2 is the ACADEMIC degree in both hits ("bakalaura grads 1993, magistra grads 1996"), not
 * the temperature one; and `Kristus` ×4 is a Siberian punk band's song title ("Kristus iz pogolma") in
 * every hit, while the era phrase this layer needed is spelled `pyrma Krystus` — "Jezus Krystus … (pīdzims
 * 7-2 godā pyrma Krystus)", "II godusymtā pyrma Krystus", two articles. A word-first probe had the right
 * concept and the wrong spelling.
 */
import { makeSymbolNormalizer, type CountForms } from "../../core/normalizeSymbols.ts";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";

/**
 * ⚠ NEVER `\b` — Latgalian carries `ā ē ī ō ū y č š ž ģ ķ ļ ņ`, which `\b` treats as boundaries
 * (playbook trap 1/23). The apostrophe is word-internal in the engine's own TOKEN class, so it is excluded
 * here too.
 */
/**
 * The East-Baltic count form, and it is NOT a new claim: `numbers.ts` already implements exactly this rule
 * as `agree()` for its own magnitude nouns (*tyukstūša* vs *tyukstūšys*). SINGULAR after a count ending in
 * …1 but not …11 — *21 procents*, *101 kilometrs* — and plural otherwise. A count with a fraction never
 * takes the singular, because `n % 10` of 21,5 is 1.5 and not 1, so the arithmetic handles it for free.
 */
const countForm = (n: number): number => (n % 10 === 1 && n % 100 !== 11 ? 0 : 1);

/** `[singular, plural]`, in the order `countForm` indexes them. */
const pair = (one: string, many: string): CountForms => [one, many];

/**
 * THE UNIT NOUNS. ⚠ EVERY ONE IS ATTESTED IN THE COUNTED SLOT ON ltg.wikipedia, and for four of the six the
 * attested form is the OBLIQUE plural rather than the nominative singular — which is the opposite direction
 * from Latvian's table and is why this could not be ported:
 *
 *     kilometri  3 tok / 3 arts   "2 kilometri iz PR nu Rogoukys" · "rūbežys gorums iraid 2705 kilometri"
 *     kilometru 11 tok /11 arts   "210 kilometru iz zīmeļvokorim" · "aptuveni 50 kilometru ottuolumā"
 *     metri      9 tok / 7 arts   "3—6 metri" · "Dzagužkolns (28 metri ajl.)" · "pasaceļ par 89 metri"
 *     metru      3 tok / 3 arts   "1—10 metru augšuok jiuru leidzīņa" · "ļeidz pot 3000 metru augstumu"
 *     ceņtimetru 2 tok / 2 arts   "da 150 ceņtimetru garuma" · "Augums 52-58 ceņtimetru augsts"
 *     hektaru    1 tok / 1 art    "Andryvs daboj 15 hektaru i suok patstuoveigas dorba gaitys"
 *     kilogrami  3 tok / 2 arts   "svors 30—65 kilogrami (rekords — 79 kilogrami)" · "vydyskai 3 kilogrami"
 *
 * ⚠ THE SINGULARS ARE THE REGULAR 1st-DECLENSION `-s`, AND THE PARADIGM IS ATTESTED IN THIS VERY SOURCING
 * RUN rather than assumed: `procents` ×2 and `procenti` ×1 are both attested, in the same slot, and are the
 * same declension as `kilometrs`/`kilometri`. That is the same move Latvian's table makes in mirror image
 * (it derives plurals from attested singulars); it is stated here because the singular slot is exercised
 * only by a count ending in …1 and this corpus contains none.
 *
 * ⚠ `mm` IS DECLARED NOWHERE AND THAT IS DELIBERATE. `milimetri` and `milimetru` are BOTH ×0 on
 * ltg.wikipedia, and composing *mili-* + the attested `metru` would be inventing a word. The corpus writes
 * `mm` ×2 (`650—700 mm godā`, `70,5—80,0 mm`); it stays raw Latin, where the leak gate can see it, which is
 * the right kind of failure. `mi` (`33,900 mi²`) and `t` are absent for the same reason.
 *
 * ⚠ AND `g` IS THE YEAR — see the file header. 32 against 1.
 */
const UNITS: Record<string, CountForms> = {
    km: pair("kilometrs", "kilometri"),
    m: pair("metrs", "metri"),
    cm: pair("ceņtimetrs", "ceņtimetri"),
    ha: pair("hektars", "hektari"),
    kg: pair("kilograms", "kilogrami"),
};

/**
 * The shared SYMBOL tier.
 *
 * `procents`/`procenti` — attested ×3 in the percent sense and in the counted slot ("atsateikūši 42,3 i
 * 41,7 procenti", "labtik leluoks procents daugpilīšu"); carries `%` ×52.
 *
 * `eura`/`euru` — 5 tok / 2 arts and 8 tok / 2 arts, and the article is the currency's own ("Eura (latvīšu:
 * eiro, eira; anglīšu: euro) irā Europys Savīneibys…", "1 eura (EUR) = apmāram 0,702804 latu (LVL)",
 * "610 milijardi euru"). ⚠ `$` IS NOT DECLARED: the sign is ×0 in the whole retained text, and while
 * `dolaru` ×3 is attested it is the genitive plural of a currency this corpus only ever names in words
 * ("32,7 triļjonim ASV dolaru"). A currency name is worth declaring only when its SIGN occurs.
 *
 * ⚠ `kvadrat` IS `compound` — see the header; `kvadratkilometru` is one word in both attestations, so
 * `after` would emit *kilometri kvadrat* and `before` *kvadrat kilometri*, neither of which is a word.
 *
 * `reiz` is declared for `×`/`x` as robustness — both are ×0 here, and the corpus's one product uses ASCII
 * `*`, which the tier does not match and step 6 below claims locally.
 *
 * `i` is the Latgalian conjunction and carries `&` ×6, every one a taxonomic authority pair
 * ("Caracal caracal poecilotis Thomas & Hinton, 1921", "Prionailurus planiceps, Vigors & Horsfield, 1827").
 * ⚠ The other six ampersands in this text are the HTML entity `&nbsp;`, which `core/markup.ts` has already
 * decoded to a space by the time this runs — verified through the whole pipeline, not assumed.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["procents", "procenti"],
    currency: { "€": ["eura", "euru"] },
    units: UNITS,
    exponentWords: { squared: ["kvadrat"], position: "compound" },
    multiply: { times: "reiz", by: "reiz" },
    ampersand: "i",
    /**
     * The magnitude forms this corpus and wiki actually write, so a figure separated from its unit or its
     * currency sign by one of them is still adjacent to it: `€151 miljonu viersejumu`, `610 milijardi euru`,
     * `32,7 triļjonim ASV dolaru`, `449,2 miļjoni cylvāku`, `1,3 miljardim cylvāku`, `~16 tyukstūšys`.
     * Latgalian declines these nouns, and declaring only a nominative is the defect Latvian's own list
     * records: the short form matches and strands the suffix.
     */
    magnitudes: [
        "miljardim", "milijardi", "milijonim", "triļjonim", "milijoni",
        "miljonu", "miļjoni", "miljoni", "tyukstūšys",
    ],
    countForm,
});

/** ⚠ THE ORDINAL PERIOD, in four arms — see the header for why the ordinal itself is not composed.
 *  Each arm removes a dot that Latgalian orthography says is not a full stop, and nothing else. */
function ordinalPeriod(text: string): string {
    return (
        text
            // …before a DASH, and this arm MUST run before the range step or the first endpoint of
            // `143.–153. lpp.` keeps its dot and the range pattern never sees two bare figures. 14 sites:
            // `2007.–2008. godu`, `15.–17. godu symtā`, `9.—10.gs.`, `1797.—1813.`, `10.-12.g.s.`,
            // `30.-40.gadu presē`, `1900.-1919.`, `1923.—1925.g.`.
            .replace(/(?<![\d.,])(\d{1,4})\.(?=\s*[-–—]\s*\d)/gu, "$1")
            // …immediately before a COMMA, which a sentence-ending period never is: `2008., 2011. i 2014.
            // godā`, `procesūs 1936., 1937. i 1938.g.`. 2 sites.
            .replace(/(?<![\d.,])(\d{1,4})\.(?=,)/gu, "$1")
            /**
             * …and the main arm: whitespace-or-nothing plus a LOWER-CASE letter, 139 sites. A Latgalian
             * sentence does not continue in lower case, so the dot is an ordinal marker; a digit after it is
             * a decimal or a date and an upper-case letter after it is an ordinary boundary, and neither may
             * be touched.
             *
             * ⚠ THE GAP IS SUPPLIED WHEN THERE IS NONE. This corpus writes the abbreviation-tight form as
             * often as the spaced one — `1922.gods`, `115.panta`, `2.pusē`, `16.juņa`, `1903.godā`,
             * `1983.g.` — and a bare removal fuses the figure onto the word (*1922gods*), one token the
             * number path then cannot read at all. Same defect and same fix as Latvian's `nr.859`.
             */
            .replace(/(?<![\d.,])(\d{1,4})\.(\s*)(\p{Ll})/gu,
                (_m, fig: string, gap: string, next: string) => `${fig}${gap || " "}${next}`)
    );
}

/**
 * DEGREES — `°` ×25, and no confusable in this corpus: U+00BA º, U+02DA ˚ and U+2103 ℃ are all ×0, which
 * is worth recording because the three rounds before this one each found one in this slot.
 *
 * ⚠ THE SCALE ARM RUNS FIRST AND CONSUMES THE LETTER, because a bare ⟨C⟩ left behind reads as Latgalian
 * /t͡s/ — a plausible syllable, not audible garbage, so no leak class, no DROP and no referee can see it.
 * Both spacings occur (`-7°C` and `43° C`).
 *
 * ⚠ AND THE WRITER'S OWN GLOSS IS READ TOO. `(–43 gradi C)` ×4 has the degree word already spelled and a
 * bare ⟨C⟩ after it — no `°` anywhere — so the sign-keyed arms cannot reach it and the letter reached the
 * g2p in every instance. The `gradi` is re-emitted rather than doubled (playbook trap 12).
 */
function degrees(text: string): string {
    return (
        text
            // the writer's own `NN gradi C` — keep the word, spend the letter
            .replace(new RegExp(`(\\d[\\d.,]*\\s+gradi)\\s+C${NOT_LETTER_AFTER}`, "gu"), "$1 pa Celseja skolai")
            // `°C` / `° C` — the scale phrase is POSTPOSED and prepositional, which is why it is spelled
            // out here rather than declared as a tier modifier: "…temperatura … -9° pa Celseja skolai".
            .replace(new RegExp(`(\\d)\\s?°\\s?C${NOT_LETTER_AFTER}`, "gui"), "$1 gradi pa Celseja skolai")
            // …and the bare sign: `56,4°`, `9,6° augšuok horizonta`, and the coordinate `55° 53′ 0″ N`.
            // ⚠ THE LOOKAHEAD STOPS A DOUBLING where the sentence already writes the word.
            .replace(/(\d)\s?°(?!\s*gradi)/gu, "$1 gradi ")
            .replace(/(\d)\s?°/gu, "$1")
    );
}

/**
 * THE ERA MARKER — `p. Kr.` ×3 (`ap 310—305 g. p. Kr. Kirenē`, `† ap 240 g. p. Kr.`, `Ap 290 g. p. Kr.`).
 * Untouched it read as two letter-fragments and two false sentence breaks inside one phrase.
 *
 * `pyrma Krystus` is ltg.wikipedia's own words for it, in two independent articles: "Jezus Krystus …
 * (pīdzims 7-2 godā pyrma Krystus, nūmyrs 30-33 godā)" and "kuru sarokstu sataiseja Aņtipatris nu Sidona
 * II godusymtā pyrma Krystus". `pyrma` is 14 tok / 12 arts, `Krystus` 20 tok / 12 arts. ⚠ The corpus's own
 * variant is `prīkš Krysta` (`1. Godasymta prīkš Krysta`, ×1) — both are real; the two-article one ships.
 *
 * ⚠ THE FINAL PERIOD IS KEPT AT A SENTENCE END, or the pause is lost outright (playbook trap 10, and the
 * mirror of the defect this step exists to fix).
 */
function eraMarker(text: string): string {
    return text.replace(new RegExp(`${NOT_LETTER_BEFORE}p\\s?\\.\\s?Kr\\s?\\.`, "gu"),
        (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) || /^\s+\p{Lu}/u.test(rest)
                ? "pyrma Krystus."
                : "pyrma Krystus";
        });
}

/** The Latgalian normalization pre-pass. The numbered order below is LOAD-BEARING. */
export function normalizeLatgalian(input: string): string {
    let s = input;

    // 1) THE ERA MARKER, before any other rule spends one of its four periods.
    s = eraMarker(s);

    // 2) THE TWO "AND OTHERS" ABBREVIATIONS, for the same reason — their dots are the same dots. `ct.` ×4
    //    is this corpus's own (`Pizānu i ct.`, `keiši, vīki i ct.`, `etnografejis i ct. kursus`) and `u.c.`
    //    ×3 is the Latvian shorthand the same writers reach for (`„Rīgai 800” u.c.`). `cyti` is 22 tok /
    //    19 arts and appears in exactly this frame — "1,1% boltkrīvi i 5,0% cyti", "3,13% cyti".
    //    ⚠ CASE-SENSITIVE, and Latvian's review found out why: personal INITIAL PAIRS are everywhere in
    //    this corpus (`O. Rupaiņs`, `I. Klekere`, `R. K. Aggarwal`, `J. B. Fischer`), and a case-insensitive
    //    `u.c.` would introduce a surname. ⚠ AND THE SENTENCE-FINAL DOT IS KEPT, as for the era marker.
    const others = (m0: string, offset: number, full: string, word: string): string => {
        const rest = full.slice(offset + m0.length);
        return /^\s*["»)']?\s*$/u.test(rest) || /^\s+\p{Lu}/u.test(rest) ? `${word}.` : word;
    };
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}u\\.c\\.`, "gu"),
        (m0, off: number, full: string) => others(m0, off, full, "i cyti"));
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}ct\\.`, "gu"),
        (m0, off: number, full: string) => others(m0, off, full, "cyti"));

    // 3) THE ORDINAL PERIOD — above the range step (see `ordinalPeriod`'s first arm) and above everything
    //    that consumes a dot.
    s = ordinalPeriod(s);

    // 4) DE-GROUPING, BOTH MARKS, BEFORE THE TIER — the tier's own `NUM` reads `1,500` and `83 871` as one
    //    token, and a figure that is still grouped when the unit rule fires is the wrong quantity.
    //    ⚠ THE WHOLE NUMBER AT ONCE (playbook trap 63): a repeated two-digit join de-groups three groups
    //    correctly and four groups into a different number, and this corpus writes `9 223 766`.
    //    ⚠ AND THE TRAILING GUARD REJECTS A DIGIT AND NOTHING ELSE (playbook trap 58) — `(?![\d.,])` would
    //    decline `700 000.` at the end of a sentence and lose the whole grouping.
    //    The SPACE first: `83 871 km²`, `9 223 766 dzeivuotuojim`, `700 000 daļderu`, `11 858 puslopys`.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)/gu,  // space, NBSP, NNBSP, thin space
        (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space
    //    …then the COMMA, by the three-digit test: `1,500 solu`, `548,000 cylvāku`, `3,555 km2`,
    //    `450,295 km²`, `2,300 km²`. The `(?!\d)` after the run is what leaves `0,702804` and `55,883333`
    //    alone — a fourth digit after the group means the comma was a decimal all along.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:,\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));

    // 5) THE MAGNITUDE ABBREVIATIONS, before the tier so its magnitude hop can see them: `Ledzīvotāju
    //    Austrejas - 8,9 mil.`, `runoj vydyskai … 400 mln. ļaužu`. Both read as bare syllables today.
    //    ⚠ A PRECEDING DIGIT IS REQUIRED, because `mil` and `mln` unguarded are a fragment of any word.
    s = s.replace(/(?<=\d)(\s*)(?:mln|mil)\s?\./gu, (_m, gap: string) => `${gap || " "}milijoni`);

    // 6) THE PRODUCT SIGN — digits on BOTH sides, which is the whole guard (see the header: the corpus's
    //    other asterisk is the biographical birth mark, `* ap 310—305 g. p. Kr.`).
    s = s.replace(/(?<=\d)\s?\*\s?(?=\d)/gu, " reiz ");

    // 7) THE APPROXIMATION SIGN — `apmāram 15% (~16 tyukstūšys)`. `apmāram` is 27 tok / 20 arts and the
    //    corpus uses it directly before a figure in the same sentence as the sign ("apmāram 15%", "apmāram
    //    0,702804 latu", "apmāram 200 milijonim").
    s = s.replace(/[~≈]\s*(?=[\d])/gu, "apmāram ");

    // 8) THE SHARED SYMBOL TIER — percent, currency, units, the squared exponent, magnitudes, `&`, `×`.
    //    Ordered as the Hawaiian and Karakalpak layers order it: its own numeral pattern reads `12,8` as
    //    ONE token and step 10 splits precisely those.
    s = SYMBOLS(s);

    // 9) DEGREES, after the tier (nothing in the tier touches `°`) and before the decimal step, which would
    //    otherwise have split `56,4°` away from its sign.
    s = degrees(s);

    // 10) THE DECIMAL SEPARATORS, NEUTRALISED RATHER THAN SPOKEN, and running LAST because the tier matches
    //     `12,8 m` and `9,21%` as one figure-plus-symbol.
    //     ⚠ NO DECIMAL WORD IS SOURCEABLE. `komats` and `komata` are ×0 on ltg.wikipedia, and `punkts` — the
    //     obvious second candidate at 18 tok / 12 arts — is a FACILITY in every single example: `feļčeru
    //     punkts` (a paramedic post), `turizma informacejis punkts`, `dzeļžaceļa rūbežkontrolis punkts`,
    //     `vysuaugstais punkts` (the highest point of a district). That is Zulu's `amaphuzu` exactly. The
    //     defect being fixed is the false sentence break the mark produces mid-quantity; dropping a mark
    //     beats speaking a word this language's sources cannot supply.
    //     The COMMA first — what is left with a comma between digits after step 4 is a decimal.
    //     ⚠ EVERY LEADING ZERO IN THE FRACTION IS SPOKEN SEPARATELY. This is the Basque defect, found in
    //     review there and prevented in Latvian: handing the fraction to the number path whole makes `5,09`
    //     and `5,9` identical, because the tokenizer reads `09` as nine — the quantity wrong by a factor of
    //     ten, in perfectly well-formed text, invisible to every gate. `0,702804` and `27°22'00,4"` are the
    //     shapes here.
    //     ⚠ AND THE TRAILING GUARD REJECTS A DIGIT AND NOTHING ELSE (playbook trap 58): `(?![\d.,])` would
    //     decline `beja 3,5.` at the end of a sentence and put the pause back inside the number.
    s = s.replace(/(?<![\d.,])(\d+),(\d+)(?!\d)/gu, (_m, head: string, frac: string) => {
        const zeros = /^0*/u.exec(frac)![0];
        const rest = frac.slice(zeros.length);
        return [head, ...zeros, ...(rest === "" ? [] : [rest])].join(" ");
    });
    //     …then the DOT, and ONLY IF THE RUN CARRIES EXACTLY ONE. That guard is what declines the five
    //     dotted DATES this corpus writes — `07.02.1922`, `1858.07.01`, `1922.12.16`, `17.12.1932`,
    //     `18.02.2004` — which have two dots each and must not be read as decimals.
    s = s.replace(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu, "$1 $2");

    // 11) RANGES. The dash was dropped outright and the endpoints fused — `650—700 mm`, `54—57% dīnys`,
    //     `33-40%`, `1966-1970`, `30—50 m`, `0,6-0,8 cm`. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A
    //     CONNECTIVE (see the header): this corpus writes `nu X da Y` in full wherever it means it, so
    //     imposing `da` on a bare dash claims a frame it never writes.
    //     ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (playbook trap 58), and an adjacent slash means
    //     a season or a standard number (`2003/2004 g.`, `ISO 639/2`) rather than a span.
    //     ⚠ RUNS AFTER THE DECIMAL STEP, so `0,6-0,8 cm` is already `0 6-0 8 cm` and the hyphen still sits
    //     between two digits — the endpoints are split either way, and running it earlier would have let
    //     the ASCII arm's `(?<![\d.,])` guard reject the decimal second endpoint outright.
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,\-/])(\d+)\s?-\s?(\d+)(?![\d/])(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
