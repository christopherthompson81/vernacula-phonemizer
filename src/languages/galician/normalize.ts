/**
 * Galician (gl) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/gl.jsonc` (gl.wikipedia dump, 1,698,559 paragraph segments). Corpus-wide
 * counts for the classes this file claims: `ordinal-latin` 138,420 · `initialism` 363,812 · `abbrev` 266,494
 * · `ranges` 110,003 · `decimals` 77,321 · `ampersand` 65,637 · `signs` 41,113 · `dotted` 40,918 · `percent`
 * 20,076 · `fractions` 15,818 · `exponent` 12,013 · `signed-number` 12,163 · `units` 11,514 · `clock` 10,242
 * · `era-marker` 8,908 · `degrees` 2,415 · `currency` 1,403. Before this file existed the engine read
 * `35 %` as *tɾˈinta e θˈiŋko* (sign gone), `12,5 km` as *… kŋ* (the unit as a WORD), `0 °C` as *θˈeɾo k*,
 * `11:35` with the colon as a sentence break, and `2.4 GHz` as *vinte e catro* — the dot-decimal is the one
 * class that was not merely unread but read WRONG, because the tokenizer takes every `.` as a grouping mark.
 *
 * ⚠ THE PORTUGUESE SIBLING IS A HYPOTHESIS, NOT A SOURCE (playbook trap 55). Structurally this file is pt's;
 * lexically three of its words are wrong for Galician, and each was caught only by reading the examples:
 *   · `dividido entre` scores ×19 in 19 gl.wikipedia articles and every hit is "divided BETWEEN" in the
 *     geographic sense ("Yorkshire está dividido entre…"). The arithmetic word is `dividido por`, ×1 —
 *     "8593 dividido por 23 dá un cociente de 373". The count would have chosen the wrong word.
 *   · `igual a` ×1 is "as leis vinculan por igual a gobernantes", i.e. "equally to". The usable source is
 *     the article title itself: "O signo igual (=) é un símbolo matemático empregado para indicar a igualdade".
 *   · running Galician compares with `ca`, not `que` — `é maior ca` ×5, `é menor ca` ×8, `é maior que` ×0.
 *     But the SIGN has its own name and gl.wikipedia states it: "o signo > significa maior que (3 > 0) e <
 *     significa menor que (2 < 5)". So the notation reads `maior que` / `menor que` and the prose reads `ca`.
 * See docs/investigations/gl_normalization_investigation.md, run 2.
 *
 * ⚠ A CENTURY IS A CARDINAL, and it already works. `século XIX` reads *século dezanove* through the shared
 * `core/roman.ts` cardinal pass, which is the Ibero-Romance reading pt records from Ciberdúvidas. No
 * `romanOrdinals.ts` is wired for gl: the only context that genuinely needs an ordinal at any value is the
 * prenominal event name (`XL aniversario`), which this corpus does not attest, and inventing the trigger list
 * without one is trap 9 (a guard alternative with no attested instance is a misfire generator).
 *
 * VERIFICATION. The corpus diff over the artifact moves 234/463 utterances and takes DROP from **103 to 13**;
 * `mine.ts scan` takes eight DROP classes to three. `review.ts --lang gl` is green on every checklist item
 * except the artifact scan, and ⚠ THAT LINE STAYS RED ON PURPOSE — the lt / ak / ln stance, with all four
 * residuals read instance by instance rather than sampled:
 *   · `exponent` ×7 — every one a NEGATIVE or non-square power (`10⁻⁷`, `Pa⁻¹`, `cm⁻¹`, `10⁷`, `10³⁹`).
 *     `ao cadrado` is sourced ×13 and shipped; `ao cubo` scores **0** and `elevado a` ×1 is "foi elevado a
 *     cardeal", so the words those powers would need do not exist in any source this repo has. The class
 *     comes green the day one is sourced and not before.
 *   · `math-sign` ×4 — two ASCII arrows in an etymology ("ars -> arte", "téchne -> técnica"), one markup
 *     artifact (`**>Mathematical Algorithms`) and one gloss. None is Galician notation.
 *   · `minus` ×1 — `os mesmos -243- no 1646`, the footnote marker the sign rule deliberately excludes.
 *   · `iteration` ×1 — `金子 みすゞ`, the JAPANESE iteration mark inside a Japanese name. The Galician
 *     ídem sign 〃 is read (step 13); this is a different character in a different script.
 * RAW-LATIN `nd`/`ms`/`pp`/`ml` also survive, all four inside English-language bibliography entries.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { rewrite } from "../../core/provenance.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Galician masculine ordinals (standard RAG). The -ésimo series is not derivable from the cardinal
 * compositor (*vixésimo* contains no *vinte*), so this is authored ordinal data like pt's.
 *
 * ⚠ THE TABLE STOPS WHERE THE ATTESTATION STOPS. Every entry below is a gl.wikipedia TOKEN hit with the
 * examples read — `cuarto` ×94, `sexto` ×33, `sétimo` ×29, `oitavo` ×24, `noveno` ×20, `décimo` ×36,
 * `vixésimo` ×38, `trixésimo` ×34, `cuadraxésimo` ×50, `quincuaxésimo` ×37, `sexaxésimo` ×19,
 * `septuaxésimo` ×31, `octoxésimo` ×17, `nonaxésimo` ×9, `centésimo` ×47. `milésimo` scored **0**, so 1000
 * is not in range and neither is the hundreds series it would have implied — the Odia lesson, that a
 * derivation which looks regular is still a guess where no source records it. Nothing in this file reaches
 * above 100 anyway: the indicator rule is bounded there on corpus evidence, and no fraction denominator in
 * this corpus exceeds 9.
 */
const ORD_UNITS = ["", "primeiro", "segundo", "terceiro", "cuarto", "quinto", "sexto", "sétimo", "oitavo", "noveno"];
const ORD_TENS = ["", "décimo", "vixésimo", "trixésimo", "cuadraxésimo", "quincuaxésimo",
    "sexaxésimo", "septuaxésimo", "octoxésimo", "nonaxésimo"];

/** Galician masculine ordinal, 1 … 100; `undefined` outside that (see the table's note). */
export function galicianOrdinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 100) return undefined;
    if (n === 100) return "centésimo";
    if (n < 10) return ORD_UNITS[n];
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? ORD_TENS[t] : `${ORD_TENS[t]} ${ORD_UNITS[u]}`; // décimo primeiro, vixésimo quinto
}

/** The feminine of a Galician ordinal: every element ends in -o and takes -a (vixésima primeira). */
function feminineOrdinal(masc: string): string {
    return rewrite(masc, /o(?=\s|$)/gu, "a");
}

/** Ordinal indicators above this read as CARDINALS — see step 5. */
const ORDINAL_INDICATOR_MAX = 100;

/**
 * Era markers. The artifact GLOSSES ITS OWN ABBREVIATION, which is the strongest source this repo has for
 * such a word: "os anos anteriores á época abrévianse a.C. para Antes de Cristo ou a. e. c. para antes da
 * Era común". `d.C.` is not glossed there but is attested (×12/10 articles) as *despois de Cristo* —
 * ⚠ `despois`, the Galician form, NOT the Portuguese `depois` this file's template carried.
 */
const ERA: readonly (readonly [RegExp, string])[] = [
    [/(?<![\p{L}\p{M}])a\.\s?e\.\s?c\.(?![\p{L}\p{M}])/giu, "antes da Era común"],
    [/(?<![\p{L}\p{M}])a\.\s?C\.(?![\p{L}\p{M}])/gu, "antes de Cristo"],
    [/(?<![\p{L}\p{M}])d\.\s?C\.(?![\p{L}\p{M}])/gu, "despois de Cristo"],
];

/** Single-dot abbreviations → the spoken words. `etc.` ×2 in the retained text; the rest are the ordinary
 *  Galician address/title set. The dot is otherwise a phrase break in the middle of a sentence. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    etc: "etcétera",
    dr: "doutor",
    dra: "doutora",
    sr: "señor",
    sra: "señora",
    prof: "profesor",
    vol: "volume",
    páx: "páxina",
    séc: "século",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).join("|");

/**
 * Galician letter names (RAG): a, be, ce, de, e, efe, gue, hache, i, iota, ka, ele, eme, ene, o, pe, cu,
 * erre, ese, te, u, uve, uve dobre, xis, i grego, zeta. Spelled through the g2p like any other word — and
 * ⚠ ⟨ñ⟩ needs one too, or the eñe in an all-caps run is dropped rather than spelled.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "be", c: "ce", d: "de", e: "e", f: "efe", g: "gue", h: "hache", i: "i", j: "iota",
    k: "ka", l: "ele", m: "eme", n: "ene", "ñ": "eñe", o: "o", p: "pe", q: "cu", r: "erre", s: "ese",
    t: "te", u: "u", v: "uve", w: "uve dobre", x: "xis", y: "i grego", z: "zeta",
};

/** Galician phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableGalician = makeUnreadableTest({
    vowels: /[aeiouáéíóúü]/u,
    legalOnsets: new Set([
        "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "ch", "ll", "rr", "nh", "qu", "gu",
    ]),
    // The word-internal codas Galician words actually contain (alto, arte, canto, este, disco, campo,
    // texto), not only the word-final ones — this set is what decides whether a caps run is SPELLED or
    // SAID. ⚠ It is not sufficient on its own: the corpus's `(CALTECH)` is still spelled letter by letter,
    // and correctly, because no Galician word ends in ⟨ch⟩ — the word is foreign at its right edge, which
    // is exactly what this test is for.
    legalCodas: new Set([
        "b", "c", "d", "l", "n", "r", "s", "x", "z", "ls", "ns", "rs", "is", "us", "ct", "cc", "st", "sc",
        "lt", "rt", "nt", "sk", "mp", "mb", "ks", "lc", "rc", "rd", "rn", "rm", "rl", "lg", "nd",
    ]),
});

/** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics, or readable but conventionally
 *  spelled. `ONU` and `OTAN` are said as words in Galician; `ISBN`, `PIB`, `ISO`, `SI` are in the corpus. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["onu", "otan", "unesco", "covid", "sida", "ovni", "láser", "radar"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l.toLowerCase()],
    // Spelled out despite being pronounceable — the corpus's own all-caps runs.
    acronymLetters: new Set(["isbn", "pib", "iso", "si", "eeuu", "ue", "cd", "dvd", "utc", "gmt", "pdf", "url"]),
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableGalician,
});

/** The decimal-point word, read from the manifest rather than spelled here — `12,5` and `48.26`
 *  must say the same thing, and the comma path already goes through `numbers.decimalConnector`. */
const DECIMAL_WORD = MANIFEST.numbers.decimalConnector;

/** Digit-grouping spaces: SI thin/narrow/no-break, and the ASCII space Galician also uses. */
const GROUP_SPACE = "    ";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Galician input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeGalician(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING with a space — FIRST, per the playbook: a grouping mark left in place is read as
    //    clause punctuation or splits the number token. The DOT form (1.500) is already handled by the
    //    tokenizer and is deliberately left alone here; the space form is not, and a number token cannot
    //    span a space. Twice, because `299 792 458` has two group boundaries and the first match consumes
    //    the space the second would need.
    s = rewrite(s, new RegExp(`(?<=\\d)(?<!(?<![\\d\\.,])0)[${GROUP_SPACE}](?=\\d{3}(?!\\d))`, "gu"), "");
    s = rewrite(s, new RegExp(`(?<=\\d)(?<!(?<![\\d\\.,])0)[${GROUP_SPACE}](?=\\d{3}(?!\\d))`, "gu"), "");
    s = rewrite(s, new RegExp(`[${GROUP_SPACE}]`, "gu"), " "); // the leftover no-break spaces are ordinary ones

    // 1) ERA MARKERS, before the abbreviation rule so the bare `a.`/`d.` is not claimed first, and before the
    //    dotted-capital rule so `a. C.` is not folded into an initialism. `a. e. c.` comes first because
    //    `a. C.`'s pattern would otherwise claim nothing of it but its own tail would be left dangling.
    //    ⚠ `a.C.`/`d.C.` are matched CASE-SENSITIVELY (no `i` flag) — a lowercase `d.c.` does not occur and
    //    the letter `C` is what distinguishes the era marker from an initial; `a. e. c.` is written lowercase.
    for (const [re, word] of ERA) s = rewrite(s, re, word);

    // 2) NÚMERO, only before a digit. `nº`/`n.º`/`Nº` ×3 in the retained text. The bare `no` is the
    //    contraction en+o and is everywhere in Galician, so it is deliberately NOT an alternative here —
    //    which is where pt's rule differs, and pt's `no` alternative would misfire on every Galician clause.
    s = rewrite(s, /(?<![\p{L}\p{M}])(?:n\.º|nº|n°|núm\.)\s?(?=\d)/giu, "número ");

    // 3) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass (step 14) reads them as LETTERS.
    //    ⚠ `\p{Lu}`, never `[A-Z]` — Galician's own ⟨Á É Í Ó Ú Ñ⟩ are capitals outside ASCII (trap 1/7).
    s = rewrite(s, /(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+/gu, (m0) => rewrite(m0, /[.\s]/gu, ""));  // space, NBSP
    //    A single initial before a surname: the dot is a break, not a full stop.
    s = rewrite(s, /(?<=\p{Lu})\.(?=\s+\p{Lu})/gu, "");

    // 4) SINGLE-DOT ABBREVIATIONS. Two branches: mid-sentence the dot is CONSUMED so it cannot become a
    //    phrase break; at a phrase end it is kept, because there it really is the sentence end.
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\d])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 5) ORDINAL INDICATORS — º (U+00BA) and ª (U+00AA), which were reaching the phoneme string as nothing
    //    at all (the tokenizer does not match them, so `1º` read as the bare cardinal *un*).
    //    ⚠ THE DIGIT RUN MUST SPAN THE GROUPING DOTS, and the DOTTED form `4.ª` occurs — a bare `\d+` would
    //    match the TAIL of `1.000º` and read *dous PONTO quingentésimo* on `2.500º`, which is pt's measured
    //    failure on the same shape. The grouped alternative therefore comes first.
    //    ⚠ AND ° (U+00B0) IS DELIBERATELY NOT ONE OF THEM — it is the degree sign, claimed by step 7.
    //
    //    ⚠ BOUNDED AT 100, AND THE BOUND IS THE EVIDENCE. Every genuine ordinal in this corpus is small
    //    (`1º`, `2ª`, `3º`, `5º`, `6ª`, `11º`, `28º` "o 28º do mundo", `29º`, `4.ª`), and every LARGE one is
    //    a kiln temperature typed with the ordinal indicator instead of the degree sign: "cócese a
    //    750-950º", "a temperaturas entre 400º e 1300º". Above the bound the indicator is STRIPPED and the
    //    cardinal stands — it loses the ordinality, which is honest lossiness, and it invents no
    //    morphology; reading those as *graos* was declined because three instances cannot license inventing
    //    a temperature on a genuine `o 1000º aniversario`. Recorded in the investigation doc, run 3.
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2}(?:\.\d{3})+|\d+)\.?(º|ª)(?![\p{L}\p{M}])/gu,
        (_m, digits: string, ind: string) => {
            const n = Number(rewrite(digits, /\./gu, ""));
            const masc = n <= ORDINAL_INDICATOR_MAX ? galicianOrdinal(n) : undefined;
            if (masc === undefined) return digits;
            return ind === "ª" ? feminineOrdinal(masc) : masc;
        });

    // 6) THE DOT DECIMAL, and it is the one class this layer had to fix rather than merely add. Galician
    //    writes the decimal with a COMMA and groups thousands with a dot, which is what `galician.ts`'s
    //    TOKEN already encodes — so an English-influenced dot decimal is not unread, it is read as a
    //    GROUPING mark and comes out multiplied: `48.26 km` was *catro mil oitocentos vinte e seis
    //    quilómetros* and `(11.1%)` was *cento once por cento*. The discriminator is the fraction's LENGTH,
    //    the same one Catalan uses: exactly three digits is a thousands group (`1.500`, `460.000`,
    //    `106.460.000` — all in this corpus), one or two is a decimal. `coma` is the manifest's own
    //    `decimalConnector`, already used for `12,5`.
    //    AFTER the ordinal rule, which has to see `4.ª` and `1.000º` with their dots intact, and after the
    //    abbreviation rules, whose dots follow letters. BEFORE the range rule, so `4.2-3.9` reads as a range
    //    of two decimals rather than a range starting mid-number.
    //    ⚠ KNOWN EXPOSURE, the same one ca records: a VERSION DESIGNATION has this shape too, so `802.11n`
    //    reads *oitocentos dous coma once …* and the shared tier's `NOT_VERSION` guard has no dot left to
    //    see by the time it runs. The `version-dot` cell is 396 corpus-wide against `decimals` at 77,321,
    //    and the decimal is the reading that is currently WRONG rather than merely odd.
    s = rewrite(s, /(?<![\d.,])(\d+)\.(\d{1,2})(?![\d.])/gu, `$1 ${DECIMAL_WORD} $2`);

    // 7) CURRENCY CODES → the bare sign, WHICH IS WHAT MAKES THE TIER'S DECLARED KEY REACHABLE. The
    //    initialism pass (step 11) runs after this file and would split `US$` into letter names, after which
    //    the tier's guard — the one that stops a key biting into a word — correctly refuses the `$` and the
    //    sign vanishes. `US$` ×6 in the retained text. Only where a NUMBER follows: a bare `US$` folded to a
    //    lone `$` would be dropped by the tokenizer, and silence is worse than the letters (pt's finding).
    s = rewrite(s, /(?<![\p{L}\p{M}])(?:US|AUD|CAD)\$(?=[ \u00a0]?\d)/gu, "$");  // space, NBSP
    //    R$ is the Brazilian real; the tier has no entry for the R and read it as a stray [ʁ].
    s = rewrite(s, /(?<![\p{L}\p{M}])R\$\s?(\d[\d.,]*)/gu, "$1 reais");

    // 8) DEGREES, BEFORE the unit tier so the bare sign is not left behind and before the sign rules so a
    //    negative temperature still finds its `°`. `graos` is sourced from the corpus's own gloss of the
    //    same figure: "un ángulo de 104,45 graos entre si" is the artifact's `104,45°` sentence written out.
    s = rewrite(s, /(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 graos Celsius");
    s = rewrite(s, /(\d)\s?°\s?F(?![\p{L}\p{M}])/gui, "$1 graos Fahrenheit");
    s = rewrite(s, /(\d)\s?°\s?([NSEO])(?![\p{L}\p{M}])/gu, (_m, d: string, c: string) =>
        `${d} graos ${({ N: "norte", S: "sur", E: "leste", O: "oeste" } as Record<string, string>)[c]!}`);
    s = rewrite(s, /(\d)\s?°/gu, "$1 graos");

    // 9) CLOCK, and the THREE-FIELD TIMESTAMP that is not one. This corpus's colon numerals are dominated by
    //    launch timestamps — `11:12:01`, `07:00:01`, `00:36:59`, and `69:08:20 horas`, which is an elapsed
    //    mission time and not a clock at all. Left alone the colon became a PAUSE inside the number.
    //    ⚠ THE THREE-FIELD FORM IS CLAIMED FIRST, or the two-field rule takes its head and strands the rest.
    //    Nothing is invented for it: the colons are spent on spaces, the playbook's `sports-time` reading
    //    (Kirundi's call), because this corpus never spells such a timestamp out.
    s = rewrite(s, /(?<![\d:])(\d{1,2}):([0-5]\d):([0-5]\d)(?![:\d])/gu, "$1 $2 $3");
    //    The real clock. `ás 11:35` → *ás once e trinta e cinco*; a `:00` minute is not read as *cero*.
    s = rewrite(s, /(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])/gu,
        (_m, h: string, min: string) => clockWords(Number(h), Number(min)));

    // 10) SIGNS.
    //    ⚠ ± IS A SINGLE CHARACTER (U+00B1), so no `+` rule can ever match inside it — it needs its own rule
    //    or the sign is dropped in silence. gl.wikipedia NAMES it: "O sinal máis-menos (±) é un símbolo
    //    matemático", so the reading is the language's own compound rather than two juxtaposed sign words.
    s = rewrite(s, /±/gu, " máis menos ");
    //    THE MINUS IS REAL IN THIS CORPUS, unlike Burmese's: `−5°C`, `−22°C`, `-1 °C`, `-2 °C`, `-1000`
    //    (a year), `(–287 a. C.)` — 7 genuine negatives, mostly temperatures. The `(?!\d*-)` excludes the
    //    footnote marker `os mesmos -243- no 1646`; `en 1929. -39.` is a residual misfire at one instance.
    s = rewrite(s, /(^|[\s(])[-−–](\d+(?:[.,]\d+)?)(?!\d*[-–])/gu, "$1menos $2");
    s = rewrite(s, /(\S)\+\s?(?=\d)/gu, "$1 máis ");
    s = rewrite(s, /(^|\s)\+\s?(?=\d)/gu, "$1máis ");
    //    RELATIONAL AND DIVISION SIGNS — ⚠ SEARCH FOR THE WORDS, NEVER FOR THE SIGN, and read the examples.
    //    gl.wikipedia's own articles name every one of these: "O signo igual (=) é un símbolo matemático
    //    empregado para indicar a igualdade"; "o signo > significa maior que (3 > 0) e < significa menor que
    //    (2 < 5)"; "8593 dividido por 23 dá un cociente de 373". See the header for the three sibling words
    //    that these replaced.
    //    ⚠ THE RELATIONAL OPERANDS ARE LETTERS AS OFTEN AS DIGITS, and a digits-only guard reported clean
    //    while dropping the sign: this corpus writes `n=1 no baleiro e n>1 na materia`, where the operand is
    //    the refractive index. A LETTER on either side is licensed by that instance and by nothing else —
    //    the `->` of an etymology ("ars -> arte") still has no letter to its left and stays untouched.
    s = rewrite(s, /\s?=\s?/gu, " igual a ");
    s = rewrite(s, /(?<=[\p{L}\p{Nd}])\s?<\s?(?=[\p{L}\p{Nd}])/gu, " menor que ");
    s = rewrite(s, /(?<=[\p{L}\p{Nd}])\s?>\s?(?=[\p{L}\p{Nd}])/gu, " maior que ");
    s = rewrite(s, /\s?÷\s?/gu, " dividido por ");

    // 11) FRACTIONS. Galician names 2 and 3 with NOUNS (*medio*, *terzo*) and everything from 4 up with the
    //     ordinal, pluralised above one — reading the bare ordinal gives *un terceiro* for 1/3.
    //     ⚠ THE DENOMINATOR IS BOUNDED AT TWELVE, and the bound is what separates a fraction from the three
    //     other things this corpus writes with a slash. `1/3`, `2/3`, `3/4`, `8/9` are fractions; `MARPOL
    //     73/78` is a treaty, `número 3/4` an issue and `7/8 anos` an age span. Without the bound the treaty
    //     read *setenta e tres septuaxésimo oitavos*, which is worse than the silent slash it replaced —
    //     a defect that produces a READING beats no reading only when the reading is right. Twelve is the
    //     ceiling of the denominators a language actually names; `num ≤ den` drops the rest of the treaty
    //     shapes. `número 3/4` and `7/8 anos` remain genuine misfires, as they are in pt: the notation is
    //     the same and nothing in the string tells them apart.
    //     ⚠ AND THE WORDS MUST NOT FUSE WITH WHAT FOLLOWS. `Ec=1/2mV²` has no space after the denominator,
    //     so the replacement landed glued to the next token — *mediomV²*, one eight-letter word, which also
    //     put the base past the shared tier's three-letter bare-exponent limit and took the `²` down with
    //     it. That second failure showed up as a `DROP exponent` in the corpus diff and in nothing else.
    s = rewrite(s, /(?<![\d/.,])(\d{1,2})\/(\d{1,2})(?![\d/.,])(\p{L})?/gu,
        (m0, a: string, b: string, tail: string | undefined) => {
            const num = Number(a), den = Number(b);
            if (den < 2 || den > 12 || num < 1 || num > den) return m0;
            const sep = tail === undefined ? "" : ` ${tail}`;
            if (den === 2) return `${num === 1 ? "medio" : `${numberToWords(num)} medios`}${sep}`;
            const noun = den === 3 ? "terzo" : galicianOrdinal(den);
            if (noun === undefined) return m0;
            return `${numberToWords(num)} ${num === 1 ? noun : `${noun}s`}${sep}`;
        });

    // 12) RANGES. A dash between two numbers is read `a` — years (`1824–1843`), page spans (`85-106`) and
    //     temperature spans (`400º e 1300º`'s written twin `750-950`). Left alone the dash was silent and
    //     the two numbers ran together.
    //     ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58): a lookahead carrying `\s` or a word
    //     boundary makes the rule decline at a full stop, and `de 1924–1999.` is exactly how this corpus
    //     ends a sentence. The guard is only that the right operand does not continue into another dash.
    //     AFTER the minus rule, which has already spent every dash that opens a negative.
    s = rewrite(s, /(?<=\d)\s?[-–—]\s?(?=\d)/gu, " a ");

    // 13) THE ÍDEM SIGN 〃, which this corpus does not merely contain but DEFINES: "O signo de ídem (〃) é un
    //     símbolo tipográfico que indica a repetición da palabra ou elemento que está na liña superior."
    //     The artifact names the character and gives its Galician name in the same sentence, which is the
    //     strongest kind of source this repo has. Its other use here is a price list — "Dous quilos de
    //     pementos … 2,70€ / Cinco 〃 〃 〃 … 6,75€" — where reading the repeated item is beyond this layer
    //     and the sign's own name is what a reader would say for it. Unhandled it was a silent drop ×3.
    s = rewrite(s, /〃/gu, " ídem ");

    // 14) INITIALISMS, LAST of the letter rules: after the era markers (else `dC` → *de ce*), after the
    //     dotted-capital fold that feeds it, and after the currency-code fold that must see `US$` intact.
    s = normalizeInitialisms(s);

    // A padded replacement (` máis `, ` a `) doubles a space that was already there. Harmless downstream
    // today because assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not
    // be the one producing candidates for it.
    return rewrite(s, /[^\S\n]{2,}/gu, " ");
}

/** An hour/minute pair → *once e trinta e cinco* / *once* at a round hour. `hora` is feminine but Galician
 *  `un` has no distinct feminine cardinal in the clock slot (*a unha* is the article, not the numeral), so
 *  the hour is the plain cardinal and the layer emits no noun it cannot source. */
function clockWords(h: number, min: number): string {
    return min === 0 ? numberToWords(h) : `${numberToWords(h)} e ${numberToWords(min)}`;
}
