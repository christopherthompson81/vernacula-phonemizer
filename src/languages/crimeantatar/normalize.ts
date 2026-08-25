/**
 * Crimean Tatar (crh) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/crh.jsonc` — crh.wikipedia dump, 35,437 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `abbrev` 17,218 · `digit-run` 13,132 · `year` 13,109 ·
 * `ranges` 1,145 · `dotted` 623 · `decimals` 451 · `signs` 208 · `ordinal-latin` 157 · `units` 144 ·
 * `percent` 87 · `clock` 72 · `era-marker` 62 · `fractions` 54 · `degrees` 25 · `rate` 11 · `currency` 4.
 *
 * ⚠ EVERY DASH DOES TWO JOBS AND THE CODEPOINT SETTLES NOTHING. Karakalpak, treated one round earlier, had
 * a clean split — its em-dash was the copula and never the minus. This corpus has no such split:
 *
 *     `-` HYPHEN   MINUS `-6 °C`            RANGE `520-590 mm` · `63-68 %`
 *     `–` EN-DASH  MINUS `–1,8°C` · `–1,4°C`  RANGE `+3 – +4°C` · `1891 – 1938` · `+22 – +28°C`
 *     `—` EM-DASH  —                        RANGE `600—700 biñge`   COPULA `Yaltanıñ iklimi — Aq deñiz…`
 *
 * The discriminator is POSITION, and the fleet's existing guard already expresses it: a DIGIT before the
 * dash makes it a range, a non-digit before makes it a minus, and `(?<!\d)` declines `1891 – 1938` on its
 * own. ⚠ BUT THE FLEET'S STEP ORDER HAD TO BE INVERTED. Every other layer in this sweep runs SIGNS before
 * RANGES so a minus is not eaten by the span rule; here the ENDPOINTS THEMSELVES ARE SIGNED (`+3 – +4°C`,
 * `+22 – +28°C`), so ranges must run FIRST and must accept a sign in the lookahead, or the span is lost
 * the moment the first endpoint stops being a bare figure.
 *
 * ⚠ THE MINUS HAS A WORD AND THE PLUS DOES NOT, and the two refusals price out differently (trap 53). The
 * corpus glosses its own minus — "gecede **minus 16°С**-ge yaqın ve kündüz **minus 11°С**" and "araret
 * **minus derecege** alçaqlaşuvınıñ ihtimalı bar" — in the same climate articles that elsewhere write
 * `–1,8°C`. For the plus there is nothing: `plüs` ×5 is entirely RUSSIAN FILM TITLES ("Plüs odin", "Tri
 * plüs dva"), `artı` ×9 is the postposition "beyond/behind" (`deñiz artı departamentı`, `Evniñ artı
 * bağça`), and `eksi` is ABSENT. ⚠ A minus INVERTS its operand and a plus does not, so the asymmetric
 * outcome is the correct one rather than an untidy one: `+24°C` reads as twenty-four degrees either way.
 *
 * ⚠ THERE IS NO PERCENT WORD ON THE SURFACE AND ONE UNDERNEATH. `foiz`, `procent` and `protsent` are all
 * ABSENT from crh.wikipedia, and `yüzde` scores ×2 — one of them TURKISH text and the other the compound
 * "yüzde tırnaq yarası" (damage *on the surface*), so neither is this slot. `faiz` ×8 is, and the sentence
 * that proves it is in a geography article: "Meydanlığı – 10 biñ kvadrat km-ge yaqın (Ukraina
 * mendanlığından **1 faizden az**)" — *less than one percent of Ukraine's area*.
 *
 * ⚠ THE DEGREE WORD IS SOURCED FROM THE ARTIFACT, NOT THE WIKI BATCH. `derece` ×31 and not one wiki example
 * is a temperature: they are the knucklebone game's ranks, the medal classes ("III derece nişan") and the
 * intensifier "soñ derece". The slot attestations are the corpus's own — "araret minus **derecege**
 * alçaqlaşuvı" for the thermal sense, and the unit article for the angular one: "Daqqa … 1 **dereceniñ**
 * 1/60-ini de ifade ete", which in the same sentence also defines `saniye`, `daqqa` and `saat`.
 *
 * ⚠ THE TWO-SCRIPT PREDICTION HOLDS IN THE MARKUP, NOT THE PROSE. crh is written in Latin and Cyrillic, so
 * the Tatar/Papiamento shape was the obvious hypothesis; the retained text is Latin throughout, and what
 * the two scripts actually leave behind is MediaWiki's LANGUAGE-CONVERTER EXEMPTION SYNTAX — `-{H 2 O}-`,
 * `-{C}-`, `-{кыргыз тили, кыргызча}-`, `-{Afġānistān}-`, seventeen instances. `core/markup.ts` already
 * strips the delimiters and keeps the content, so this needed no rule. ⚠ The Cyrillic that IS present is
 * RUSSIAN BIBLIOGRAPHY ("Газета «Ленин байрагъы» от 22 февраля 1962 года") — except for one character: the
 * DEGREE SCALE LETTER. `+24°С` and `+4°С` use U+0421 CYRILLIC CAPITAL ES, exactly as Karakalpak's did.
 *
 * ⚠ `=` IS MARKUP ELEVEN TIMES OUT OF ELEVEN — eight EasyTimeline directives (`PlotArea =`,
 * `ScaleMajor =`, `ScaleMinor =`), two MediaWiki URL parameters (`preload=Template:Standard content for
 * new page`) and one section heading. Not one equation. The EasyTimeline sense recurs from Aragonese,
 * which makes chart markup a property of dump-sourced artifacts rather than a quirk of one wiki.
 *
 * ⚠ AND THERE IS EXACTLY ONE COLON BETWEEN DIGITS: `Belgesel, 00:17:00`, a documentary's RUNTIME, inside a
 * script-converter block. `clock` is 72 corpus-wide and zero times of day are here, so no clock rule.
 *
 * SOURCING — every word emitted is a crh.wikipedia TOKEN attestation whose examples were read, or (where
 * noted) a form the mined artifact itself supplies; see `tools/corpus/attest/crh.jsonc`.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";

/** ⚠ NEVER `\b` — Crimean Tatar carries `â ç ğ ı ñ ö ş ü`, which `\b` treats as boundaries (trap 1/23). */
/**
 * The shared SYMBOL tier. ⚠ THE SQUARE MEASURE WORD PRECEDES ITS UNIT, as in Karakalpak and unlike every
 * Romance layer here: "5 **kvadrat km** qaplağan", "565 biñ **kvadrat metri**", "10 biñ **kvadrat km**-ge
 * yaqın". ⚠ AND `biñ` IS DECLARED AS A MAGNITUDE because it sits BETWEEN the figure and the unit —
 * "dört biñ metr yükseklikte", "10 biñ kvadrat km" — which is where the tier's number-adjacency
 * requirement would otherwise fail. The same shape cost Karakalpak twelve unit leaks one round earlier.
 *
 * `kilometr` ×13 · `metr` ×13 · `santimetr` ×3 · `millimetr` ×1 · `kilogramm` ×1 · `saniye` ×7 ·
 * `million` ×19 · `milliard` ×19 · `biñ` ×20 · `dollar` ×17 · `kvadrat` ×14 · `kub` ×2 · `faiz` ×8 ·
 * `ve` ×64.
 *
 * ⚠ NO `€` KEY: `evro` is ABSENT from this wiki, and the sign does not occur in the artifact either. The
 * currency that does is the dollar, postposed as the corpus writes it — "18 milliard dollar", "36 milliard
 * dollar", "22,6 milliard dollar" — which is the tier's default.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["faiz"],
    currency: { "US$": ["dollar"], "$": ["dollar"] },
    units: {
        "km": ["kilometr"], "m": ["metr"], "sm": ["santimetr"], "mm": ["millimetr"],
        "kg": ["kilogramm"], "sn": ["saniye"],
    },
    exponentWords: { squared: ["kvadrat"], cubed: ["kub"], position: "before" },
    ampersand: "ve",
    magnitudes: ["biñ", "million", "milliard"],
});

/** Normalize one Crimean Tatar input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeCrimeanTatar(input: string): string {
    let s = input;

    // 1) THE PERCENT SIGN AND ITS CASE SUFFIX, TOGETHER AND BEFORE THE TIER. Turkic agglutination lands on
    //    the symbol through a hyphen here — "dünya okean yüzüniñ 0,7%-ine kele" — and the tier reads the
    //    sign and stops, leaving `ine` to reach the g2p as a bare syllable (it reads *ine* today).
    s = s.replace(/(\d)\s?%\s?-?\s?(\p{Ll}{1,4})(?![\p{L}\p{M}])/gu, "$1 faiz$2");

    // 2) ⚠ THE AUTHOR'S OWN SQUARE MEASURE, BEFORE THE TIER. When the corpus writes `kvadrat` itself the
    //    unit abbreviation is no longer adjacent to its number — "5 kvadrat km qaplağan", "10 biñ kvadrat
    //    km-ge yaqın" — and the tier's number-adjacency requirement cannot bridge the word the writer
    //    supplied. The exponent word is already there, so only the unit needs expanding.
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}kvadrat(\\s+)km${NOT_LETTER_AFTER}`, "gu"), "kvadrat$1kilometr");
    //    …and the RUSSIAN MAGNITUDE ABBREVIATIONS, which belong here for the same reason and carry an
    //    optional dot: "106,2 mln. km² meydanlıqqa", "$167,8 mlrd UMV bar edi". Expanded before the tier,
    //    `106,2 million km²` composes as a magnitude + unit + exponent in one match.
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}mln\\s?\\.\\s?`, "gu"), "million ");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}mlrd\\s?\\.\\s?`, "gu"), "milliard ");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}mln${NOT_LETTER_AFTER}`, "gu"), "million");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}mlrd${NOT_LETTER_AFTER}`, "gu"), "milliard");

    // 3) THE SHARED SYMBOL TIER, as the Punjabi/Saraiki/Karakalpak layers order it: its own numeral pattern
    //    reads `38.765` and `1,5` as ONE token, and steps 3 and 4 split precisely those.
    s = SYMBOLS(s);

    // 4) DE-GROUPING. ⚠ THE SPACE IS THE DOMINANT GROUPING MARK HERE — `14 125 adadan`, `30 300 000 km²`,
    //    `922 000 000 kişidir`, `2 500 000 km²`, `24 508 kişi`, `$ 1 580` — while the comma and the dot
    //    each group once and decimate everywhere else (`m.e. 36,000 senesine`, `$38.765` against
    //    `+24,6°C`, `1,5 million`, `5.9%`). The three-digit test decides all three marks.
    //    ⚠ THE WHOLE NUMBER AT ONCE (trap 63), and the trailing guard rejects a DIGIT and nothing else
    //    (trap 58).
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:[    ]\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/[    ]/gu, ""));
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:,\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:\.\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/\./gu, ""));

    // 5) THE DECIMAL SEPARATORS, NEUTRALISED. ⚠ NO DECIMAL WORD IS SOURCEABLE — `nokta` and `ülüş` are both
    //    ABSENT from this wiki — so the mark is spent rather than spoken, which is the Punjabi choice and
    //    the defect actually being fixed: `+24,6°C` reads as a phrase break mid-quantity today.
    s = s.replace(/(\d)[.,](?=\d)/gu, "$1 ");

    // 6) THE ERA MARKER. `m.e.` is *milâttan evel* and the corpus writes it out two paragraphs away —
    //    "Zemaneviy Alupka topraqlarında insannıñ yerleşmeleri **milâttan evel** VIII biñyıllıqta peyda
    //    oldı", "**milâttan evel** III asırda meydanğa kelgen" — beside `m.e. 753 senesi` abbreviated.
    //    ⚠ THE FINAL DOT IS KEPT AT A SENTENCE END, or the pause is lost outright (trap 10).
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}m\\s?\\.\\s?e\\s?\\.`, "gu"),
        (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? "milâttan evel." : "milâttan evel";
        });

    // 7) THE COORDINATE ABBREVIATIONS, which this corpus uses in one string and glosses in the same one:
    //    "O, 30° ve 46° **ş.e.** enlikleri ve 6° **ğ.b.** ve 36° **ş.b.** boyluqları arasında buluna" —
    //    the head nouns `enlikleri` and `boyluqları` are written right after the abbreviations they
    //    expand. ⚠ `şimaliy` ×33, `ğarbiy` ×23 and `şarqiy` ×31 are wiki attestations; `enlik` and
    //    `boyluq` score ZERO as bare tokens, and the forms this layer emits come from the artifact itself
    //    rather than from the batch — which is what that sentence is for.
    //    ⚠ AND THE HEAD NOUN IS EMITTED ONLY WHEN THE WRITER HAS NOT ALREADY WRITTEN IT. In that same
    //    sentence `ş.e.` is followed by `enlikleri` and `ş.b.` by `boyluqları`, so the full expansion
    //    would read *şimaliy enlik enlikleri* — the corpus glossing its own abbreviation, and the layer
    //    doubling it (the Turkmen `+11° gradus` shape).
    const coords: readonly (readonly [string, string, string])[] = [
        ["ş\\s?\\.\\s?e\\s?\\.", "şimaliy", "enlik"],
        ["c\\s?\\.\\s?e\\s?\\.", "cenübiy", "enlik"],
        ["ş\\s?\\.\\s?b\\s?\\.", "şarqiy", "boyluq"],
        ["ğ\\s?\\.\\s?b\\s?\\.", "ğarbiy", "boyluq"],
    ];
    for (const [pat, adj, noun] of coords)
        s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}${pat}(\\s*)(${noun}\\p{L}*)?`, "gu"),
            (_m, gap: string, head?: string) => (head === undefined ? `${adj} ${noun}${gap}` : `${adj}${gap}${head}`));

    // 8) RANGES — ⚠ AND THEY RUN BEFORE THE SIGNS, WHICH INVERTS THE FLEET ORDER. See the header: this
    //    corpus writes SIGNED endpoints (`+3 – +4°C`, `+22 – +28°C`), so the lookahead has to admit a sign
    //    and the rule has to fire while the endpoints are still bare figures.
    //    ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE: Crimean Tatar writes `X-den Y-ge qadar`
    //    and the corpus does so in full where it means it ("+23 °C-den +26 °C-ge qadar deñişe"), so
    //    imposing the connective on a bare dash would double a word the writer already chose or not.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58), and an adjacent slash means a
    //    citation (`m.e. 754/753 seneleri`) rather than a span.
    s = s.replace(/(\d)\s?[–—]\s?(?=[+-]?\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // 9) THE MINUS. ⚠ ONLY THE MINUS — see the header: no plus word survives the sourcing check, and a
    //    plus does not invert its operand, so the silence costs nothing. `(?<!\d)` is what leaves the
    //    ranges above alone; by this point they have already been spent anyway.
    s = s.replace(/(^|(?<!\d)[\s(])[-−–]\s?(\d)/gu, "$1minus $2");

    // 10) DEGREES. ⚠ THE SCALE LETTER MAY BE CYRILLIC (U+0421) and it MAY CARRY A CASE SUFFIX through a
    //    hyphen — "suv arareti +23 °C-den +26 °C-ge qadar deñişe", "minus 16°С-ge yaqın". The suffix
    //    belongs on `derece`, which is where it goes.
    // ⚠ THE LOWERCASE SCALE LETTER IS IN THE CLASS, NOT IN AN `i` FLAG. `\p{Ll}` below is the case SUFFIX
    //    and it is genuinely lowercase-only; under `i` that property folds and matches uppercase too, so
    //    the flag would silently widen the suffix capture while fixing the scale letter.
    s = s.replace(/(\d)\s?°\s?[CСcс]\s?-\s?(\p{Ll}{1,4})(?![\p{L}\p{M}])/gu, "$1 derece$2");
    s = s.replace(/(\d)\s?°\s?[CСcс](?![\p{L}\p{M}])/gu, "$1 derece");
    s = s.replace(/(\d)\s?°\s?-\s?(\p{Ll}{1,4})(?![\p{L}\p{M}])/gu, "$1 derece$2");
    s = s.replace(/(\d)\s?°/gu, "$1 derece ");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
