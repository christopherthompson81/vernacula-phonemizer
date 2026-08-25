/**
 * Karakalpak (kaa) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/kaa.jsonc` — kaa.wikipedia dump, 63,415 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 25,547 · `year` 24,331 · `abbrev` 11,575 ·
 * `decimals` 5,443 · `ranges` 4,220 · `signs` 2,596 · `exponent` 2,486 · `dotted` 2,220 · `units` 1,943 ·
 * `clock` 1,773 · `percent` 1,542 · `ordinal-latin` 596 · `signed-number` 286 · `degrees` 251 ·
 * `fractions` 249 · `arithmetic` 242 · `currency` 121 · `rate` 93 · `era-marker` 30.
 *
 * ⚠ THE EM-DASH IS A COPULA AND READING IT AS A MINUS WOULD BE WRONG THIRTY TIMES. This corpus writes
 * Russian-calqued prose in which `—` stands in for the absent verb "to be", and it does so directly in
 * front of numbers:
 *
 *     Ortasha jas — 31,3                    Temirjollardıń uzınlıǵı — 3,9 mıń km
 *     Transport jolı uzınlıǵı — 2 mıń km    Afrikanıń dástúriy din wákilleri — 0,309%
 *
 * ⚠ AND ONE CLAUSE CARRIES BOTH MARKS: "yanvardıń ortasha temperaturası **— 2 °C den -3 °C ge shekem**" —
 * *the temperature IS from 2 °C to MINUS 3 °C*. The em-dash is the copula; the HYPHEN is the minus. The
 * fleet-standard sign class `[-−–]` is therefore already correct and must not be widened to `—` "for
 * symmetry": the one-character generalisation that looks harmless reads thirty "is" clauses as negatives.
 *
 * ⚠ THE COMMA GROUPS AND DECIMATES, AND SO DOES THE DOT — IN THE SAME SENTENCE. Papiamento split the two
 * conventions by article and Aragonese by figure type; this corpus mixes them inside one clause:
 *
 *     qazaqlar – 70,18% , ruslar 18,42%, ózbekler 3,29%, ukrainlar **1.36%**, uyǵırlar 1,48%
 *     biyikligi 33,02 sm diametri **46.99**sm          ← two measurements of one object
 *
 *     `,` DECIMAL   `18,7%` · `4,4°C` · `23,3 mlrd` |  `,` GROUPING  `$100,000` · `19,605,052` · `1,500 km`
 *     `.` DECIMAL   `1.36%` · `$1.65 milliard` · `9.25 million` · `391.04 milliard` · `0.0064 kilovatt-saat`
 *     `.` IP ADDRESS `198.51.100.0/24` · `255.255.255.0`   |  `.` DATE  `26.02.1994-j.`
 *
 * The three-digit test decides the comma. ⚠ The dot needs a different guard, because an IP address is four
 * dot-joined groups and a date is three: what identifies a decimal is that the run carries exactly ONE dot.
 *
 * ⚠ THE PERCENT SIGN TAKES A CASE SUFFIX, detached or attached, and the shared tier cannot see it —
 * `18,7% ke`, `50% ten 80% ke`, `14% i`, `7,84% ti`, `96%in`, `4%in`, `98% ke`. Claimed with the sign here,
 * before the tier, or the sign is read and the suffix is left behind as a bare syllable (`96%in` reads
 * *toqsan altı in* today). Same shape as Turkmen's `60%-ini`.
 *
 * ⚠ `+` IS THE NAME OF A PROGRAMMING LANGUAGE — about twenty of its twenty-five instances are `C++`,
 * `C++98`, `C++03`, `C++11`, `C++23`. ⚠ BUT IT IS STILL CLAIMABLE, and that is the round's most useful
 * guard: **`C++` never has a DIGIT after the plus**, while every real sign does (`+40+45 °C`, `+15+20°С
 * gradus`, `+15°С`). A digit lookahead separates them completely, and `plyus` ×14 is attested in exactly
 * this sense ("stavkasin plyus yamasa minus funttaǵi 3 pensqa", "50% plyus bir akciya").
 *
 * ⚠ AND `°С` IS SOMETIMES CYRILLIC. "Onı úy sharayatında **+15+20°С gradus** temperaturada saqlaǵan maqul"
 * writes U+0421 CYRILLIC CAPITAL ES, not U+0043. A Latin-only scale letter matches neither it nor the bare
 * `8-12C` this corpus also writes; both letters are in the class. ⚠ The BARE `C` of `8-12C` is left
 * UNREAD — it is one instance, and a rule matching a `C` after any digit would produce a reading wherever
 * a model number or a table label happens to end that way (trap 56). Recorded, not claimed.
 *
 * ⚠ THE DEGREE WORD IS BARE. `gradus` ×18 and the corpus never names the scale beside it — "Yanvar ayiniń
 * ortasha temparaturasi -5 gradus", "iyul ayinda bolsa +40 gradus". `Selsiy` scores ×1 (one sentence about
 * the Sun), so no Celsius word is emitted; `Farengeyt` is ABSENT.
 *
 * ⚠ NO DECIMAL WORD IS SOURCEABLE, so the separator is NEUTRALISED rather than spoken. `noqat` ×31 is a
 * MATERIAL POINT in the physics articles ("materiallıq noqat", "moddiy noqat hám moddiy noqatlar
 * sisteması") and, once, a CHICKPEA in a list of legumes. `pút` is ABSENT. The defect being fixed is the
 * false sentence break the mark produces mid-number, and dropping a mark beats speaking a word this corpus
 * cannot supply — the Punjabi choice, for the same reason.
 *
 * ⚠ `=` IS REFUSED FOR THE THIRD TIME ON THE SAME GROUNDS. `teń` ×104 is attested and is exactly "equal",
 * but POSTPOSITIONALLY — "10-12 metrge **teń**", "basıp ótken jolına **teń**" — and the shared tier can
 * only place a connective BETWEEN operands. chv and skr refused it for this reason before kaa did.
 *
 * SOURCING — every word emitted is a kaa.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/kaa.jsonc`.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";

/** ⚠ NEVER `\b` — Karakalpak Latin carries `á ó ú ı ń ǵ í`, which `\b` treats as boundaries (trap 1/23). */
/**
 * The shared SYMBOL tier. ⚠ THE SQUARE MEASURE WORD PRECEDES ITS UNIT, which is the opposite of every
 * Romance layer in this sweep and is what `position: "before"` is for: the corpus writes "9,065,000
 * **kvadrat kilometr**", "130 mıń **kvadrat kilometr**", "har **kvadrat kilometrge** 214 adam".
 *
 * `kilometr` ×36 · `metr` ×91 · `santimetr` ×24 · `millimetr` ×68 · `kilogramm` ×26 · `tonna` ×95 ·
 * `gektar` ×40 · `kilovatt` ×14 · `million` ×85 · `milliard` ×50 · `dollar` ×74 · `evro` ×46 ·
 * `procent` ×31 · `kvadrat` ×53 · `kub` ×43.
 *
 * ⚠ `procent` ×31 OVER `protsent` ×16 AND `payız` ×7, and the counts are not the whole argument: all three
 * are attested in the right slot, but `protsent`'s examples are ALL from one bond-market article
 * ("protsent stavkası") while `procent` appears across the geography, agriculture and economics articles
 * ("Dáninde 50-60 procent may bar", "8 procent may hám 40 procent belok").
 *
 * ⚠ `som` IS NOT DECLARED, and it is the round's Fula case: it scores ×14 and every hit is FOREIGN TEXT —
 * the Danish song title "Smuk som et stjerneskud", the Swedish "Som jag är", the Brazilian "Som Brasil".
 * Not one is the Uzbek currency. `manat` ×7 is real but the sign for it never appears here.
 *
 * ⚠ AND `US$` IS DECLARED AHEAD OF `$` — trap 64, for the third round running.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["procent"],
    currency: { "US$": ["dollar"], "$": ["dollar"], "€": ["evro"], "£": ["funt"] },
    units: {
        "km": ["kilometr"], "m": ["metr"], "sm": ["santimetr"], "mm": ["millimetr"],
        "kg": ["kilogramm"], "t": ["tonna"], "ga": ["gektar"], "kvt": ["kilovatt"],
    },
    exponentWords: { squared: ["kvadrat"], cubed: ["kub"], position: "before" },
    ampersand: "hám",
    // ⚠ `mıń` (thousand) IS DECLARED AS A MAGNITUDE BECAUSE IT SITS BETWEEN THE FIGURE AND THE UNIT, which
    // is where the tier's number-adjacency requirement would otherwise fail: "86,6 mıń km²", "3 mıń km ge
    // shekem", "2 mıń km den artıq", "36,7 mıń km", "83 mıń 858 km2". Twelve of the residual `km` leaks
    // after the first draft were this one shape. `mıń` ×163.
    magnitudes: ["mıń", "million", "milliard"],
});

/** Normalize one Karakalpak input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeKarakalpak(input: string): string {
    let s = input;

    // 1) THE PERCENT SIGN AND ITS CASE SUFFIX, TOGETHER AND BEFORE THE TIER — see the header. The tier
    //    reads the sign and stops; the suffix is a separate token by then and reaches the g2p as a bare
    //    syllable. Both spellings occur, attached (`96%in`) and detached (`50% ten`), and the suffix set is
    //    the corpus's own: `ke`/`ki`, `ten`/`tan`/`den`/`dan`, `ti`/`tı`, `i`/`ı`/`in`/`ın`.
    s = s.replace(/(\d)\s?%\s?(k[ei]|[td][ae]n|t[ıi]|[ıi]n?)(?![\p{L}\p{M}])/gu, "$1 procent$2");

    // 2) ⚠ THE TWO-TOKEN SQUARE MEASURES AND THE COMPOUND ENERGY UNIT, BEFORE THE TIER — and the ordering
    //    is the whole point. `m.kv.` and `km kv` are square metres and square kilometres written without a
    //    `²` anywhere, so the tier's exponent arm cannot reach them; and if the tier runs FIRST it rewrites
    //    the `m` of `8 m.kv.` to *metr* and leaves `.kv.` stranded, which is exactly what the first draft
    //    did. Same for `kvt/saat`, which is a kilowatt-HOUR (a product) and not a rate: "914 mln.
    //    kilovatt/saat", "9,5 mlrd. Kilovatt-saat" are how the corpus writes it out.
    // ⚠ AND THE MAGNITUDE ABBREVIATIONS BELONG HERE TOO, for the same ordering reason and one more: the
    //    DOT IS OPTIONAL in this corpus ("9,5 mln adam", "$205,539 mlrd (2018)" beside "21 mln. jılı",
    //    "23,3 mlrd. kvt/saat"), and `139,2 mln.ga` puts the unit straight after the dot. Expanded before
    //    the tier, that becomes "139,2 million ga" and the tier's magnitude arm can then reach `ga`.
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}mln\\s?\\.\\s?`, "gu"), "million ");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}mlrd\\s?\\.\\s?`, "gu"), "milliard ");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}mln${NOT_LETTER_AFTER}`, "gu"), "million");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}mlrd${NOT_LETTER_AFTER}`, "gu"), "milliard");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}m\\s?\\.\\s?kv\\s?\\.`, "gu"), "kvadrat metr");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}km\\s?\\.?\\s?kv\\s?\\.`, "gu"), "kvadrat kilometr");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}km\\s+kv${NOT_LETTER_AFTER}`, "gu"), "kvadrat kilometr");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}kvt\\s?[/\\-]\\s?saat`, "gu"), "kilovatt saat");

    // 3) THE SHARED SYMBOL TIER, as the Punjabi and Saraiki layers order it: its own numeral pattern reads
    //    `19,605,052` and `1.65` as ONE token, and steps 3 and 4 split precisely those.
    s = SYMBOLS(s);

    // 4) DE-GROUPING THE COMMA, by the three-digit test — `$100,000`, `19,605,052`, `1,500 km`,
    //    `18,500 fotovoltaik`, `1,810 mAch`, `1/1,000,000,000,000`. ⚠ THE WHOLE NUMBER AT ONCE (trap 63),
    //    and the trailing guard rejects a DIGIT and nothing else (trap 58).
    //    ⚠ AND A MAGNITUDE WORD AFTER THE GROUP MEANS IT IS A DECIMAL AFTER ALL. "$205,539 mlrd (2018)"
    //    and "JIÓ 179,332 mlrd. AQSh dolların" are $205.539 and $179.332 BILLION — three digits after the
    //    comma, so the three-digit test says "grouping" and is wrong, because *two hundred five thousand
    //    five hundred thirty-nine billion* is not a quantity anyone writes. The magnitude lookahead is
    //    what settles it; `19,605,052 akciyanı` and `$100,000 investiciyası` carry no magnitude and stay
    //    grouped.
    const MAG_NEXT = "(?!\\s?(?:mıń|million|milliard))";
    s = s.replace(new RegExp(`(?<!\\d)(?<![\\d][.,])(\\d{1,3})((?:,\\d{3})+)(?!\\d)${MAG_NEXT}`, "gu"),
        (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));
    //    …and the SPACE, which this corpus also uses — "Maydanı 1 098 581 km²", "9 686 AQSh dolları",
    //    "1/299 792 458 sekund ishinde". Same idiom, same trap-63 whole-number match.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));

    // 5) THE DECIMAL SEPARATORS, NEUTRALISED — see the header for why no word is spoken. What is left with
    //    a comma between digits is a decimal; what is left with a dot is a decimal ONLY IF THE RUN CARRIES
    //    EXACTLY ONE, which is the guard that keeps this off `198.51.100.0` and `26.02.1994`.
    s = s.replace(/(\d),(?=\d)/gu, "$1 ");
    s = s.replace(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu, "$1 $2");

    // 6) THE ERA MARKER. `b.e.sh.` is *biziń eramızǵa shekem* — "before our era" — and it was reaching the
    //    g2p as three letters with three false sentence breaks: "b . e . sh. 776-jılı". `biziń` ×22,
    //    `eramız` ×1 (thin, but it is the corpus's own phrase: "Biziń eramız basında"), `shekem` ×105.
    //    ⚠ THE FINAL DOT IS KEPT AT A SENTENCE END, or the pause is lost outright (trap 10).
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}b\\s?\\.\\s?e\\s?\\.\\s?sh\\s?\\.`, "giu"),
        (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? "biziń eramızǵa shekem." : "biziń eramızǵa shekem";
        });

    // 7) THE ABBREVIATIONS THIS CORPUS PUTS BESIDE ITS FIGURES. `mln.` and `mlrd.` are the Russian
    //    magnitude abbreviations and are ×14 and ×12 in the leak report — "21 mln. jılı", "23,3 mlrd.
    //    kvt/saat", "914 mln. kilovatt/saat". ⚠ `km kv` AND `m.kv.` ARE SQUARE MEASURES WRITTEN AS TWO
    //    TOKENS, which the tier's exponent arm cannot reach because there is no `²` anywhere: "23,2
    //    adam/1 km kv", "8 m.kv. maydan", "12 m.kv. maydan".
    //    …the year abbreviation, which this corpus writes with a hyphen and a dot: "26.02.1994-j. №367/XII"
    //    is *1994-jıl*. `jıl` ×202.
    s = s.replace(new RegExp(`(\\d)-j\\s?\\.`, "gu"), "$1 jıl");
    //    …and the HYPHEN-CUT abbreviation, which no dot rule can see: `t-rası` is *temperaturası*, in the
    //    chemistry articles ("Suyıqlanıw t-rası 323°, qaynaw t-rası 1403°").
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}t-r(ası|a)${NOT_LETTER_AFTER}`, "gu"), "temperatur$1");

    // 8) THE CLOCK. The colon is clause punctuation in karakalpak.ts, so `saat 8:00 de` read as *saat segiz
    //    , nol de* — a phrase break inside a time. The writer supplies `saat` ("saat 8:00 de", "saat
    //    12:13:05 de"), so the figures are left as FIGURES and only the colon is spent.
    //    ⚠ THE HOUR BOUND IS WHAT DECLINES THE STANDARD NUMBER: this corpus cites `ISO/IEC 14882:2024` and
    //    `C++11 (14882:2011)`, where the digits before the colon are five long.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?![\d:.,])/gu,
        (_m, h: string, mi: string, se?: string) => (se === undefined ? `${h} ${mi}` : `${h} ${mi} ${se}`));

    // 9) SIGNS. ⚠ THE PLUS IS CLAIMED AND THE DIGIT LOOKAHEAD IS THE WHOLE GUARD — see the header:
    //    `C++`, `C++98`, `C++11` never put a digit straight after the sign, and every real plus here does
    //    (`+40+45 °C`, `+15+20°С`). ⚠ AND THE SECOND SIGN OF A PAIR NEEDS THE `(?<=\d)` ARM, or
    //    `(-32-38 °C)` keeps only its first sign and the range rule below turns the rest into a list.
    //    ⚠ AND THE PAIRED ARM IS GATED ON A FOLLOWING DEGREE, because the corpus also writes two technical
    //    spans with a plus where Russian would write `÷` — "diametri 6+90 mm", "diametri 3+8 mm". Ungated,
    //    the rule reads a 6-to-90-millimetre range as *six plus ninety*: a defect that produces a READING,
    //    and one this layer would have INTRODUCED rather than inherited (trap 56).
    //    `plyus` ×14, `minus` ×6, both attested in the arithmetic sense ("plyus yamasa minus funttaǵi 3
    //    pensqa", "50% plyus bir akciya", "(minus belgisi)" — the corpus naming the character).
    s = s.replace(/(^|(?<!\d)[\s(])\+\s?(?=\d)/gu, "$1plyus ");
    s = s.replace(/(^|(?<!\d)[\s(])[-−–]\s?(?=\d)/gu, "$1minus ");
    //    …the paired second sign, which sits directly against the first number: `+40+45`, `-32-38`.
    s = s.replace(/(?<=\d)\+(?=\d{1,3}\s?(?:°|gradus))/gu, " plyus ");
    s = s.replace(/(?<=\d)-(?=\d{1,2}\s?(?:°|gradus))/gu, " minus ");

    // 10) DEGREES. ⚠ THE SCALE LETTER MAY BE CYRILLIC (see the header) and the sign may be MISSING
    //    altogether (`8-12C`). `gradus` ×18 is bare in this corpus — no scale word is emitted.
    //    ⚠ AND THE CORPUS GLOSSES ITS OWN SIGN, so the word is NOT emitted twice: "Onı úy sharayatında
    //    +15+20°С gradus temperaturada saqlaǵan maqul" writes the sign and the word together, and without
    //    the lookahead it reads *gradus gradus*. Same shape as Turkmen's `+11° gradus`.
    s = s.replace(/(\d)\s?°\s?[CС](?![\p{L}\p{M}])(?!\s*gradus)/gui, "$1 gradus");
    s = s.replace(/(\d)\s?°\s?[CС](?![\p{L}\p{M}])/gui, "$1");
    s = s.replace(/(\d)\s?°(?!\s*gradus)/gu, "$1 gradus ");
    s = s.replace(/(\d)\s?°/gu, "$1");

    // 11) RANGES. The dash was dropped and the endpoints fused — `500-600 mm`, `25-28°C`, `1858-1859
    //     jıllardaǵı`, `155-165 kún`, `178-380 santimetr`. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A
    //     CONNECTIVE: Karakalpak writes `X den Y ge shekem` and the corpus does so in full where it means
    //     it ("8°C dan 18°C ǵa shekem", "30 santimetrden 178 santimetr aralıǵında"), so imposing the
    //     connective on a bare dash would double a word the writer already chose or not.
    //     ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58), and an adjacent slash means a
    //     citation or an address rather than a span.
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
