/**
 * Asturian (ast) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/ast.jsonc` — ast.wikipedia dump, **1,343,097 paragraph segments**, the
 * largest artifact in the fleet. Corpus-wide counts for the classes claimed here: `year` 577,546 ·
 * `letter-name` 267,970 · `initialism` 257,306 · `abbrev` 216,569 · `ordinal-latin` 103,191 ·
 * `roman` 88,304 · `ranges` 84,805 · `decimals` 71,505 · `signs` 40,944 · `dotted` 37,753 ·
 * `grouped` 34,726 · `units` 27,763 · `percent` 17,570 · `exponent` 10,224 · `fractions` 9,623 ·
 * `clock` 8,840 · `signed-number` 8,541 · `era-marker` 8,442 · `rate` 4,727 · `degrees` 3,186 ·
 * `currency` 2,703.
 *
 * ⚠ THE DEGREE SIGN AND THE MASCULINE ORDINAL INDICATOR ARE SWAPPED, IN BOTH DIRECTIONS. `°` U+00B0 and
 * `º` U+00BA render near-identically at text size, and this corpus uses each of them for the other's job:
 *
 *     º as a DEGREE   `23ºC` · `perriba de los 30º de media` · `ente los 43º y los 42º de llatitú norte
 *                      y los 4º y los 7º de llonxitú oeste` · `un ángulu de alredor de 60º`
 *     ° as an ORDINAL `1758 - James Monroe, **5° presidente** de los Estaos Xuníos`
 *     ° as a degree   `16°C` · `44,9 °C` · `88°23' S` · `6.9 °` · `pol meridianu de 20° E`
 *
 * So NEITHER CODEPOINT IDENTIFIES THE SENSE, a codepoint-keyed rule is wrong in both directions, and a
 * fold in either direction destroys the other reading. ⚠ THE DISCRIMINATOR IS WHAT FOLLOWS, and it is
 * written as an ALLOW-LIST rather than a guess: the sign is read as a degree before a scale letter, a
 * prime-bearing minute, a compass letter, end-of-clause, or one of the connectives this corpus actually
 * writes after a bare degree (`de`, `y`, `col`, `na`). Sixteen instances qualify. The one ordinal
 * (`5° presidente`) does NOT, and is left unread rather than being told to say *cinco graos presidente*
 * — a defect that produces a READING is the worst kind (trap 56), and the status quo already drops it.
 *
 * ⚠ THE DOT GROUPS AND THE COMMA DECIMATES — the Ibero-Romance convention: `171.057 falantes`, `150.644`,
 * `20.413`, `21.035 €`, `1.012.292 €`, `17.500£`, `504.645 km²` against `0,54%`, `44,9 °C`, `38,5 °C`,
 * `1,5 y 2,5 millones`. ⚠ And the SPACE groups too (`25 000 y 35 000`), while the DOT also DECIMATES when
 * fewer than three digits follow (`132.46 km`, `6.9 °`). The three-digit test decides the dot; the comma
 * is always a decimal.
 *
 * ⚠ THE ROMAN NUMERAL IS A MONTH. `Calendariu republicanu francés (24-X-1793 - 31-XII-1805)`,
 * `Calendariu suecu (1-III-1700 - "30-II"-1711)`, `Calendariu revolucionariu soviéticu (1-X-1929 - 1940)`
 * — the day-`ROMAN`-year form. Before this layer `24-X-1793` read the `X` as the LETTER (the shared roman
 * pass declines a lone numeral) and `1-III-1700` read `III` as the bare number three. Neither is a month.
 *
 * ⚠ THERE IS NO CENTURY POLICY, and the reason is sourcing rather than grammar. `sieglu XX` is ×32 in the
 * retained text and the corpus NEVER spells one out; on the wiki `vixésimu` scores ×1 against `décimu`
 * ×27. Spanish, Galician and Catalan all have such a policy in this repo and Asturian's would be built on
 * one attestation of its commonest form. The shared cardinal pass reads `sieglu XX` as *sieglu venti*,
 * which is wrong in the same way theirs was before they were given a policy — recorded, not guessed.
 *
 * ⚠ AND A DENTAL FORMULA IS NOT A FRACTION. "según la fórmula dentaria **I 3/3, C 0-1/0-1, P 3-4/3
 * M 3/3**" — Roman-letter tooth classes with slashed counts, in the mammal articles. No fraction rule is
 * written; the `C` and `M` in that string are exactly the letters a Roman pass looks at, and the `0-1`
 * exactly what a range rule looks at.
 *
 * SOURCING — every word emitted is an ast.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/ast.jsonc`.
 */

/** ⚠ NEVER `\b` — Asturian carries `á é í ó ú ñ ḷ ḥ`, which `\b` treats as boundaries (trap 1/23). */
const NOT_BEFORE = "(?<![\\p{L}\\p{M}])";
const NOT_AFTER = "(?![\\p{L}\\p{M}])";

/** The Roman month numerals, 1–12, for the `24-X-1793` date form. Asturian month names, attested:
 *  `marzu` ×57, `xineru` ×34, `ochobre` ×27, `avientu` ×27 on ast.wikipedia. */
const MONTHS: readonly string[] = [
    "", "xineru", "febreru", "marzu", "abril", "mayu", "xunu",
    "xunetu", "agostu", "setiembre", "ochobre", "payares", "avientu",
];
const ROMAN_MONTH: Readonly<Record<string, number>> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
};

/**
 * What may follow a degree sign for it to BE a degree. See the header: neither codepoint identifies the
 * sense in this corpus, so the continuation does. Every entry is a shape the retained text writes after a
 * bare `°`/`º`: a scale letter, a compass letter, a prime-bearing minute, end-of-clause, or one of four
 * connectives (`de media`, `y los 42º`, `col planu`, `na escala`).
 */
const DEGREE_TAIL = "(?:\\s?[CF]|\\s?[NSEW]|\\s?\\d+\\s?[′']|\\s*(?:de|y|col|na)(?![\\p{L}\\p{M}])|\\s*[.,;:)»]|\\s*$)";

/** Normalize one Asturian input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeAsturian(input: string): string {
    let s = input;

    // 1) SEPARATORS. ⚠ THREE CONVENTIONS IN ONE CORPUS — see the header. The DOT groups when exactly three
    //    digits follow it and decimates otherwise; the COMMA always decimates; the SPACE groups.
    //    ⚠ THE WHOLE NUMBER IS MATCHED AT ONCE, not one join per pass (trap 63), and the trailing guard
    //    rejects a DIGIT and nothing else, or every clause-final figure is declined (trap 58).
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:[    ]\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/[    ]/gu, ""));
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:\.\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/\./gu, ""));

    //    ⚠ AND WHAT IS LEFT CARRYING A DOT IS A DECIMAL. Once the three-digit groups are joined, the only
    //    dots between digits are the short ones (`132.46 km`, `6.9 °`, `2.5`), so they fold to the comma
    //    the engine's number branch reads. Doing it in the other order would turn every grouped figure
    //    into a decimal.
    s = s.replace(/(?<!\d)(\d+)\.(\d+)(?!\d)/gu, "$1,$2");

    // 2) THE ERA MARKER. `e.C.` = *enantes de Cristu* and `d.C.` = *dempués de Cristu*, written in the
    //    retained text as "Ente los años 1200 e.C. y 800 e.C.", "dende'l Neolíticu (6000 - 3000 e. C.)",
    //    "del añu 996 d. C." — both spacings. They were reaching the g2p letter-by-letter with two false
    //    clause pauses each. The final dot is kept at a sentence end (trap 10).
    const multi: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_BEFORE}e\\s?\\.\\s?C\\s?\\.`, "gu"), "enantes de Cristu"],
        [new RegExp(`${NOT_BEFORE}d\\s?\\.\\s?C\\s?\\.`, "gu"), "dempués de Cristu"],
    ];
    for (const [re, word] of multi)
        s = s.replace(re, (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 3) THE ROMAN-MONTH DATE, before any range rule spends its hyphens. `24-X-1793`, `31-XII-1805`,
    //    `1-III-1700`, `1-X-1929`. ⚠ THE ROMAN NUMERAL HERE IS BOUNDED AT 12 AND MUST BE, because that is
    //    the whole of what distinguishes a month from the year it sits between — and the shared roman
    //    pass has already declined the lone `X`, which is why the letter was reaching the g2p as [ʃ].
    s = s.replace(new RegExp(`${NOT_BEFORE}(\\d{1,2})\\s?-\\s?(I{1,3}|IV|V|VI{1,3}|IX|XI{0,2})\\s?-\\s?(\\d{3,4})${NOT_AFTER}`, "gu"),
        (whole, day: string, roman: string, year: string) => {
            const m = ROMAN_MONTH[roman];
            return m === undefined ? whole : `${day} de ${MONTHS[m]} de ${year}`;
        });

    // 3b) …AND THE SAME DATE ONCE THE SHARED ROMAN PASS HAS ALREADY EATEN IT. `core/roman.ts` runs at
    //     `romanPass` in registry.ts, BEFORE this layer, and it converts a multi-letter numeral while
    //     declining a lone one — so `1-III-1700` arrives here as `1-3-1700` while `24-X-1793` arrives
    //     intact. Both are the same date form and both are claimed; the month bound of 12 is what keeps
    //     this off an ordinary hyphen-joined trio, and the 3-or-4-digit year is what keeps it off a
    //     dental formula's `0-1/0-1`.
    s = s.replace(new RegExp(`${NOT_BEFORE}(\\d{1,2})\\s?-\\s?(\\d{1,2})\\s?-\\s?(\\d{3,4})${NOT_AFTER}`, "gu"),
        (whole, day: string, mon: string, year: string) => {
            const m = Number(mon);
            return m >= 1 && m <= 12 ? `${day} de ${MONTHS[m]} de ${year}` : whole;
        });

    // 4) THE CLOCK. The colon is clause punctuation in asturian.ts, so `23:40 h.` read as *ventitrés ,
    //    cuarenta* — a phrase break inside a time. The corpus writes the hour word after it ("A les 23:40
    //    h. del día 14", "Fúndese a les 2:20 h del 15 d'abril"), so the figures are left as FIGURES and
    //    only the colon is spent; `hores` ×151 is attested but the writer has already supplied `h`.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d)(?![\d:.,])/gu, "$1 $2");

    // 5) DEGREES — and the allow-listed continuation is the whole of the rule. See the header: `°` and `º`
    //    are used for each other's job in this corpus, so the sign is read as a degree only before one of
    //    the shapes that follows a real degree here, and the lone ordinal (`5° presidente`) falls through
    //    unread rather than becoming *cinco graos presidente*.
    s = s.replace(/(\d)\s?[°º]\s?([CF])(?![\p{L}\p{M}])/gui,
        (_m, d: string, scale: string) => `${d} graos ${scale.toUpperCase() === "C" ? "Celsius" : "Fahrenheit"}`);
    s = s.replace(/(\d)\s?[°º]\s?(\d+)\s?[′']/gu, "$1 graos $2 minutos ");
    s = s.replace(new RegExp(`(\\d)\\s?[°º](?=${DEGREE_TAIL})`, "gu"), "$1 graos ");

    // 6) SIGNS. The minus INVERTS; the corpus's `-` before a figure is otherwise a range or a date, both
    //    of which are claimed above and below.
    s = s.replace(/(^|(?<!\d)[\s(])[-−–]\s?(\d)/gu, "$1menos $2");

    // 7) RANGES. The dash was dropped and the endpoints fused — `6000 - 3000 e. C.` read as one run.
    //    ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE: Asturian writes `ente X y M` and the
    //    corpus does so in full where it means it ("ente 25 000 y 35 000", "ente los 43º y los 42º"), so
    //    imposing the connective on a bare dash would double a word the writer already chose or not.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58), and ⚠ a chain of three or more
    //    hyphen-joined groups is an identifier, not a span (the `0-1/0-1` of a dental formula, an ISBN).
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    //    ⚠ AND THE SLASH IS PART OF THE GUARD, not just the hyphen: the dental formula writes `C 0-1/0-1`,
    //    where each `0-1` is a hyphenated pair flanked by a slash. Blocking on an adjacent `/` on either
    //    side is what keeps the range rule out of it; blocking only on a following hyphen was not enough,
    //    and the test caught the reading *C cero, uno barra cero, uno*.
    s = s.replace(/(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
