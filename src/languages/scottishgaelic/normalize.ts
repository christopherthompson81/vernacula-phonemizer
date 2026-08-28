import { tr } from "../../core/provenance.ts";
/**
 * Scottish Gaelic (gd) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/gd.jsonc` — gd.wikipedia dump, 49,150 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `abbrev` 8,307 · `initialism` 5,349 · `decimals` 4,163 ·
 * `ordinal-latin` 3,468 · `ranges` 3,521 · `units` 1,573 · `percent` 1,162 · `roman` 1,024 · `clock` 826 ·
 * `degrees` 358 · `exponent` 246 · `currency` 113.
 *
 * ⚠ THIS LANGUAGE WAS PICKED ON A PREDICTION AND THE PREDICTION FAILED, which is the most useful thing in
 * this file. The playbook's trap 14 names Celtic as where the mutation hazard bites next — Welsh's range
 * rule was wrong on 12 of its 18 corpus ranges because the connective `i` triggers soft mutation. Gaelic
 * has 3,521 ranges, so the same rule looked due. Reading them says otherwise: the `\d-\d` instances are
 * **ISO dates in BBC citations** (`BBC Naidheachdan 2016-12-31:`, `2019-05-06:`), **ISBNs**
 * (`3-89940-263-4`), and **football scores** (`6-0` ×7, `6-1` ×5, `5-0` ×4, `2-1` ×4). Not one is a
 * measurement span. **No range rule is written**, and a Welsh-shaped one would have been a pure misfire
 * generator (trap 9). The prediction was worth testing and the answer is no.
 *
 * ⚠ AND THE SEPARATOR CONVENTION IS THE ENGLISH ONE, which inverts everything the Iberian and Slavic
 * layers in this sweep assume. Gaelic writes the COMMA as the thousands separator and the DOT as the
 * decimal point — `6,000 duine`, `210,000`, `9,984,670 km²`, `130,161` against `0.94%`, `9.81`,
 * `−224.2 °C`, `3.2 daoine`. The engine read `6,000 duine` as *a sia , neoni neoni neoni* — a phrase break
 * plus three zeros. A layer copied from the language next door would have got both of them backwards.
 * (`32.976.026` also occurs, dot-grouped, so the three-digit test is applied to BOTH marks.)
 *
 * ⚠ THE ORDINAL SPLITS AROUND ITS NOUN, and that is this language's defining rule. Gaelic puts `deug` for
 * the teens AFTER the counted noun, so `19mh linn` is *an naoidheamh linn deug* — not *naoidheamh deug
 * linn*. The corpus writes `19mh linn`, `18mh linn`, `12na linn`, `11mh linn`, `6mh linn`, and
 * gd.wikipedia states the shape outright: "'S e an t-Samhain **an t-aona mìos deug** den bhliadhna"
 * ("November is the eleventh month of the year"). A rule that merely replaces the figure cannot produce
 * that — it has to consume the noun and put it back with `deug` behind it (trap 10).
 *
 * SOURCING — every word is a gd.wikipedia TOKEN attestation whose examples were read:
 *   `sa cheud` ×7/4 — "Tha a' Ghàidhlig aig **deich sa cheud** duine", "**10 sa cheud** dhiubh": the
 *     figure and the word in one phrase. (`ceudad` ×12 is the NOUN "percentage" — "an ceudad a b' àirde" —
 *     not the reading of the sign, so it is not what ships.)
 *   `not` ×19 — and the currency article NAMES THE SIGN: "Punnd Sasannach (**GB£**, “**not**”)".
 *   `ceàrnagach` ×26/20 — and the corpus GLOSSES ITS OWN ABBREVIATION in one sentence: "an fharsaingeachd
 *     de 551,695 **cilemeatair ceàrnagach (km²)**". That fixes the word AND its position, after the noun.
 *   `cilemeatair` ×35 · `meatair` ×42 · `cileagram` ×5 · `dolar` ×11 · `puing` ×38 ·
 *   `agus mar sin air adhart` ×12/10 (the `srl.` expansion) · the ordinals `ceathramh` ×22, `còigeamh` ×26,
 *   `siathamh` ×20, `seachdamh` ×21, `ochdamh` ×20, `naoidheamh` ×20, `deicheamh` ×20, `ficheadamh` ×12,
 *   `deug` ×27, and `chiad`/`dàrna`/`treas` in this corpus's own text.
 *
 * ⚠ FOUR CLASSES ARE REFUSED, each on a measurement rather than an omission:
 *   · **DEGREES.** The Gaelic word is `ceum`, and all 43 of its attestations are the ACADEMIC degree
 *     ("rinn e ceum ann am matamataig", "Thug e ceum bho Oilthigh Uppsala"). `ceum Celsius`, `ceumannan
 *     Celsius` and `ìre Celsius` all score **0**. That is the Fula `tere` shape exactly — a real word in
 *     the wrong sense — so the 358 degrees stay unread and visible to the RAWMARK gate rather than
 *     acquiring a reading that means "university degree Celsius".
 *   · **`×`.** The corpus's 10 are genuine arithmetic (`7 × ( 14 + 9 – 4) = (7 × 14) + …`, the distributive
 *     law) but `uiread` ×36, the plausible candidate, is "quantity/amount" in every hit ("'s e uiread
 *     neo-aithnichte" — an unknown quantity), not "times".
 *   · **`=`.** 50 instances, and they are WIKI HEADING MARKERS (`== Hallstatt agus La Tène ==`) and raw
 *     LaTeX (`y = r sin(φ) sin(θ)`). Zero are equations in Gaelic prose.
 *   · **INITIALISMS**, 5,349 corpus-wide and `BBC` ×27 in the retained text. `core/initialisms.ts` needs a
 *     letter-NAME table, which is an orthographic fact this repo has no source for here: espeak is not
 *     available in this checkout, and Gaelic has two competing traditions (the modern Roman-style names and
 *     the tree alphabet — ailm, beith, coll). Inventing one is the thing trap 16 says NOT to do while
 *     saying to check the seam. The seam exists; the data does not. Recorded rather than guessed.
 */

// ---------------------------------------------------------------------------------------------------
// ORDINALS
// ---------------------------------------------------------------------------------------------------

/**
 * Gaelic ordinals 1–20, attributive (the form that follows the article `an`/`am`/`a'`).
 * ⚠ THE TEENS ARE STORED AS THEIR HEAD ALONE. 11–19 are a CIRCUMFIX in Gaelic — the head goes before the
 * counted noun and `deug` after it — so the table holds `aonamh` for 11 and `dàrna` for 12, and step 4
 * supplies `deug` on the far side of the noun. Storing "aonamh deug" would produce *aonamh deug linn*,
 * which is the one thing the language does not say.
 */
const ORD_1_20: readonly string[] = [
    "", "chiad", "dàrna", "treas", "ceathramh", "còigeamh", "siathamh", "seachdamh", "ochdamh",
    "naoidheamh", "deicheamh",
    // 11–19: the head only; `deug` follows the noun.
    "aonamh", "dàrna", "treas", "ceathramh", "còigeamh", "siathamh", "seachdamh", "ochdamh", "naoidheamh",
    "ficheadamh",
];

/** True when `n` takes the postposed `deug` (11–19). */
const isTeen = (n: number): boolean => n >= 11 && n <= 19;

// ---------------------------------------------------------------------------------------------------
// ABBREVIATIONS
// ---------------------------------------------------------------------------------------------------

/**
 * Dotted abbreviations. `srl.` is *agus mar sin air adhart* ("and so on"), attested ×12 in 10 articles in
 * exactly that expanded form. `bh.` and `td.` are the ordinary bibliographic pair. ⚠ Kept SHORT on
 * purpose: a one-or-two-letter Gaelic word before a full stop is overwhelmingly an ordinary word ending a
 * sentence — the retained text's `\w{1,5}\.` matches are dominated by `ann.` ×15, `eile.` ×8, `sin.` ×8,
 * `linn.` ×7 — so a wide table would be claiming sentence ends, not abbreviations.
 */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    srl: "agus mar sin air adhart",
    td: "taobh-duilleige",
    bh: "bheachd",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

const NOT_LETTER = "(?![\\p{L}\\p{M}'’])";
const NOT_BEFORE = "(?<![\\p{L}\\p{M}'’])";
/** A Gaelic word, for the noun the teens ordinal has to reach across. */
const WORD = "[a-zàèìòùáéíóú][a-zàèìòùáéíóú'’-]*";

/** Normalize one Scottish Gaelic input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeScottishGaelic(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST — and ⚠ ON BOTH MARKS, because this corpus writes both. The COMMA is
    //    Gaelic's ordinary thousands separator (`6,000 duine`, `210,000`, `9,984,670 km²`, `130,161`) and
    //    the engine read it as a clause pause followed by bare zeros; `32.976.026` shows the dot form too.
    //    EXACTLY THREE DIGITS is the test, which is what leaves every decimal (`0.94`, `9.81`, `12.5`,
    //    `−224.2`) untouched for step 5 — all of them one or two places.
    //    Two passes each, because adjacent groups share the digit the first consumes.
    for (let i = 0; i < 3; i++) {
        s = tr(s, /(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))/gu, "");
        s = tr(s, /(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))/gu, "");
    }
    //    The SI space form, for completeness — it does not occur in the retained text.
    for (let i = 0; i < 2; i++) s = tr(s, /(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))/gu, "");  // space, NBSP, NNBSP, thin space

    // 1) DOTTED ABBREVIATIONS. The dot is consumed before a following word so it cannot become a phrase
    //    break; at a real sentence end it is kept.
    s = tr(s, new RegExp(`${NOT_BEFORE}(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\d(])`, "giu"),
        (m0, ab: string, sp: string) => {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own
            // keys but carries `i`+`u`, so JS's fold widens it and a near-miss matches while its
            // key is absent. The `!` here made `String.replace` stringify `undefined`.
            const w = DOTTED_ABBREV[ab.toLowerCase()];
            return w === undefined ? m0 : `${w}${sp}`;
        });
    s = tr(s, new RegExp(`${NOT_BEFORE}(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (m0, ab: string) => {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own
            // keys but carries `i`+`u`, so JS's fold widens it and a near-miss matches while its
            // key is absent. The `!` here made `String.replace` stringify `undefined`.
            const w = DOTTED_ABBREV[ab.toLowerCase()];
            return w === undefined ? m0 : `${w}.`;
        });

    // 2) ÀIREAMH. `no.` / `àir.` before a digit — the sign was dropped and the dot became a phrase break.
    s = tr(s, /(?<![\p{L}\p{M}])(?:no|àir)\.\s?(?=\d)/giu, "àireamh ");
    s = tr(s, /№\s?(?=\d)/gu, "àireamh ");

    // 3) THE DECADE. `1990s`, `1960s` — without this the trailing `s` is read as a bare consonant, and the
    //    shared tier's one-letter `s` would otherwise be a candidate for it. Gaelic names a decade by its
    //    figure, so the plural marker is simply dropped.
    s = tr(s, /(?<![\d.,])((?:1\d|20)\d0)s(?![\p{L}\p{M}])/gu, "$1");

    // 4) THE ORDINAL, AND ITS CIRCUMFIX. Written `19mh`, `18mh`, `12na`, `11mh`, `6mh`, `1d`, `3s` — the
    //    suffix is the TAIL OF THE FULL WORD (chiad → d, dàrna → na, treas → s, còigeamh → mh), so the
    //    rule derives the ordinal and keeps it only if it actually ENDS with what the writer typed. Left
    //    alone the suffix was spoken as a bare consonant (`19mh` → *…naoi deug v*).
    //
    //    ⚠ AND FOR 11–19 THE NOUN COMES IN THE MIDDLE. `19mh linn` is *an naoidheamh linn deug*, so the
    //    rule has to consume the following noun and re-emit it with `deug` behind it — a rule that merely
    //    replaces the figure cannot express this shape at all. gd.wikipedia states it: "'S e an t-Samhain
    //    an t-aona mìos deug den bhliadhna". With no noun to reach across (`an 19mh`), `deug` goes
    //    straight after the head, which is what a bare ordinal does.
    //    ⚠ THE NOUN IS RE-EMITTED VERBATIM (trap 10): it carries the article's lenition the writer already
    //    applied, and this layer must not touch morphology it did not choose.
    //    ⚠ THE SUFFIX MUST BE GLUED (or hyphen-attached), never merely adjacent. Allowing a space made
    //    `3 s` — a duration in seconds — match the ordinal `treas`, because *treas* does end in ⟨s⟩. The
    //    corpus writes every one of these glued (`19mh`, `12na`, `3s`, `1d`), so nothing is lost.
    s = tr(s, new RegExp(`(?<![\\d.,])(\\d{1,2})-?(mh|na|s|d)(?:(\\s+)(${WORD}))?${NOT_LETTER}`, "giu"),
        (whole, digits: string, rawSfx: string, gap: string | undefined, noun: string | undefined) => {
            const n = Number(digits);
            const head = n >= 1 && n <= 20 ? ORD_1_20[n] : undefined;
            if (head === undefined || !head.endsWith(rawSfx.toLowerCase())) return whole;
            const tail = noun === undefined ? "" : `${gap}${noun}`;
            return isTeen(n) ? `${head}${tail} deug` : `${head}${tail}`;
        });

    // 5) THE DOT DECIMAL. ⚠ THE DOT IS THE DECIMAL POINT HERE — the English convention, the opposite of
    //    every other layer written in this sweep — and step 0 has already taken the three-digit grouping
    //    case off the table, so what is left is a genuine fraction: `0.94%`, `9.81`, `12.5 km`, `3.2
    //    daoine`, `−224.2 °C`. The engine read the dot as a full stop, so `12.5 km` came out as two
    //    sentences.
    //    ⚠ `puing` IS THE LEXEME, NOT THE SLOT, and that distinction is recorded rather than hidden: it is
    //    attested ×38 as "point" in the mathematical domain this corpus uses it in ("na puingean a
    //    sgrìobhadh air a' chruinne", "am Puing Curie"), but no source shows a decimal being READ. That is
    //    the Igbo shape — a written corpus is the weakest evidence there is about how a symbol is spoken —
    //    not the Fula one, where the word itself was wrong.
    //    ⚠ THE FRACTION DIGITS ARE EMITTED AS DIGITS, not composed here: the engine's own number path
    //    reads a bare `5` through the same compositor and the same g2p, so this rule cannot invent a
    //    numeral form (playbook trap 20's constructive half — emitting digits is the right default, as
    //    long as you check what the downstream numeral rules do to them, and a single digit has no
    //    lenition or particle context to get wrong).
    s = tr(s, /(?<![\d.,])(\d+)\.(\d{1,2})(?![\d.\p{L}])/gu,
        (_m, int: string, frac: string) => `${int} puing ${[...frac].join(" ")}`);

    // 6) SIGNS. The corpus writes the true MINUS (U+2212) in `−224.2 °C` and `49 K (−224.2 °C)`.
    //    ⚠ ONLY THE MINUS. `plus`, `×` and `=` are all refused on measurements recorded in the header —
    //    `uiread` is "quantity" and not "times", and every `=` in this corpus is a wiki heading or LaTeX.
    //    Gaelic's minus is the English loan, which is what the arithmetic register uses.
    //    ⚠ THE ASCII HYPHEN IS INCLUDED BUT ONLY AFTER A NON-DIGIT. The corpus's genuine negatives are in
    //    its maths prose — the integers article's "{ ..., -3, -2, -1, 0, 1, 2, 3, ... }" and "√(-1)" — and
    //    they are written with a plain hyphen; the shapes that must NOT be claimed are a year span with a
    //    stray space (`1805 -1869`) and the glued scores and ISO dates, so the guard is a preceding space
    //    or paren that is not itself preceded by a digit.
    s = tr(s, /(^|(?<!\d)[\s(])[-−–](\d)/gu, "$1minus $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
