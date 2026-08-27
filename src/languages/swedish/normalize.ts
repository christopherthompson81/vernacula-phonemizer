/**
 * Swedish (sv) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Swedish g2p
 * cannot already read into Swedish words the existing pipeline speaks. Pure text→text, no IPA. Runs inside
 * swedish.ts's `text()` BEFORE the shared symbol tier (`makeSymbolNormalizer`), so digits stay digits and
 * the tier can still see number–unit adjacency.
 *
 * MEASURED OVER THE FLEURS sv_se CORPUS, column 3 (the ORIGINAL cased text), 1,863 unique utterances:
 *
 *   `NNNN-tal(et)` century/decade   37   ← the largest defect, and specific to this language
 *   bare 4-digit 1100–1999          ~85  ← read in the FULL cardinal style, not in hundreds
 *   all-caps initialisms           168 instances / 92 distinct
 *   space-grouped thousands          37
 *   dotted abbreviations             29
 *   colon inflection `USA:s`         16
 *   period clock `HH.MM`             12   (colon clock `HH:MM`  7)
 *   English comma grouping            9
 *   numeric ranges                   11   (+ 5 hyphen SCORES that must NOT be claimed)
 *   ordinal colon `1:a` `37:e`        6
 *   sports/duration `4:41,30`         3   percent 3   currency 2   km² 2
 *   score `3:2`                       2   degrees 2   signs 2   ampersand 2   `x` 1
 *
 * ⚠ SWEDISH DOES NOT WRITE THE ORDINAL PERIOD, and this is the one thing a reader coming from
 * norwegian/normalize.ts or danish/normalize.ts must not assume. Counted over the same corpus:
 *
 *     digit + bare period                       44
 *     …followed by a lowercase word              0    ← the nb (134) / da (112) / de / lb rule
 *     …utterance-final                          39
 *     …followed by a capital                     4    (all four are sentence ends: `… Cuddeback, 21.
 *                                                      Cuddeback var förare.`, `… 4:41,30. Det var …`,
 *                                                      `… norr om 1770. De kan …`, `… 2021. Vissa …`)
 *
 * So the largest rule in every sibling is DELIBERATELY ABSENT here; Swedish writes the ordinal with the
 * COLON suffix instead (`1:a`, `3:e`, `37:e`). **The invariant, stated and measured:
 * ZERO utterance-final sentence pauses are lost, because no rule in this file matches a digit followed by a
 * bare period.** The clock rule requires two digits after the dot AND a legal minute value; the century
 * rule requires a hyphen; the year rule rewrites the digits and leaves the period untouched.
 *
 * ⚠ THE COLON HAS FIVE JOBS, all attested, and a clock rule keyed on a bare `:` misfires on four of them:
 *   inflection on an initialism 16 (`USA:s` ×8, `TV:n`, `Luno:n`, `II:s`) · clock 7 (`12:00`) ·
 *   ordinal suffix 5 (`1:a`, `37:e`) · sports time 3 (`4:41,30`) · score 2 (`3:2`) — plus the ordinary
 *   clause colon, which `clausePunctuation` already reads as a pause. What separates them is what follows:
 *   the clock has exactly two digits, the score one, the suffixes letters.
 *
 * ⚠ SWEDISH WRITES THE CLOCK WITH A PERIOD MORE OFTEN THAN WITH A COLON — 12 against 7 — which is the
 * opposite of the nb and da findings, where `HH.MM` turned out to be dates and a Wi-Fi standard and only
 * the colon form was claimed. The non-clock `d.dd` shapes here are `802.11` ×5 (three digits before the
 * dot, excluded by the `(?<!\d)\d{1,2}` anchor), `1.1` (a figure number — one digit after the dot) and
 * `09.02` inside the sports time `1:09.02` (which is why step 3 runs before step 4).
 *
 * ⚠ THE HUNDREDS READING IS UNCONDITIONAL FOR 1100–1999, with no context gate. English's normalize.ts
 * gates its pair-wise year on `in|of|since|…`; measured here, a Swedish marker list (`år|sedan|från|under|
 * mellan|` + month names) catches only 41 of the ~110 four-digit numbers in range, which would leave
 * `år 1945` reading *nittonhundrafyrtiofem* and `1945 och` reading *ettusenniohundrafyrtiofem* in the same
 * corpus — ⚠ the INCONSISTENCY is the tell. Going unconditional is safe here for a reason
 * specific to Swedish: the hundreds reading is idiomatic for a four-digit QUANTITY too (*sextonhundra
 * kilometer*, *tolvhundra skalbolag*), so the two shapes the gate would have protected — `1600 km` and
 * `1200 skalbolag`, the only non-year uses in range — are not errors under it. 2000+ is left alone: both
 * *tvåtusentjugo* and *tjugohundratjugo* are current, and the cardinal is what the engine already says.
 *
 * ⚠ FIVE HYPHENATED PAIRS ARE SCORES, NOT RANGES (`5-3-seger`, `26-0-seger`, `7–2.`, `21-20,`, `6-6.`)
 * against 11 genuine ranges. What separates them is the RIGHT edge: every real range is followed by `)` or
 * by a lowercase noun (`2-3 km`, `10–60 minuter`, `(1644-1912) styrkor`), and every score by a hyphen,
 * a period or a comma. A score already reads correctly as two bare cardinals (*fem tre*), so declining it
 * is not a gap.
 */

import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

const HUNDRED = MANIFEST.numbers.hundred; // "hundra"
const THOUSAND = MANIFEST.numbers.thousand; // "tusen"

/**
 * ORDINALS 1–19, the irregular table. Every one is in the NST lexicon (`accent-stress.tsv`) except
 * `sextonde`, `sjuttonde` and `nittonde`, which are COMPOSED the way the attested `trettonde` /
 * `fjortonde` / `femtonde` are — cardinal + `-de` — rather than asserted. 20 and up is compositional
 * (see `ordinal`), which pins the rule's BRANCHES: a table whose branches the corpus does not exercise
 * is a table that is wrong where nobody looked.
 */
const ORD_1_19: readonly string[] = [
    "", "första", "andra", "tredje", "fjärde", "femte", "sjätte", "sjunde", "åttonde", "nionde",
    "tionde", "elfte", "tolfte", "trettonde", "fjortonde", "femtonde", "sextonde", "sjuttonde",
    "artonde", "nittonde",
];

/**
 * Swedish ordinal for 1 … 100, or undefined above it (the corpus's largest is `37:e`, and an unclaimed
 * form keeps its digits rather than getting a guessed ending).
 *
 * THREE BRANCHES, pinned separately in the tests: the irregular table below 20; the round tens, which are
 * the cardinal plus `-nde` (tjugo→tjugonde, trettio→trettionde, fyrtio→fyrtionde); and the tens-plus-unit
 * compound, which is the cardinal tens prefix plus the table form (trettio+sjunde = trettiosjunde). The
 * tens are read from the manifest's own cardinal table, so the ordinal cannot drift from the cardinal.
 */
export function ordinal(n: number): string | undefined {
    if (n < 1 || !Number.isInteger(n)) return undefined;
    if (n < 20) return ORD_1_19[n];
    if (n === 100) return `${HUNDRED}de`; // hundrade
    if (n > 99) return undefined;
    const tens = MANIFEST.numbers.tens[Math.floor(n / 10)]!;
    const unit = n % 10;
    return unit === 0 ? `${tens}nde` : `${tens}${ORD_1_19[unit]}`;
}

/**
 * A year in the HUNDREDS reading, as ONE compound word — the reading Swedish gives a four-digit year and
 * a four-digit round quantity alike: 1400 → *fjortonhundra*, 1945 → *nittonhundrafyrtiofem*, 1850 →
 * *artonhundrafemtio*. Composed from `numberToWords` plus the manifest's `hundra` / `tusen`, so it cannot
 * disagree with the cardinal compositor.
 *
 * THE 1000–1099 DECADE IS NOT `tiohundra`. Swedish calls the 11th century *tusentalet*, not
 * *tiohundratalet*, so that block takes `tusen` — the corpus's `1000-talet` ×2 is exactly this case, and
 * a naive floor(n/100) rule gets it wrong. Below 1000 the plain cardinal is already the hundreds form
 * (`800` → *åttahundra*). 2000 and up returns undefined; see the header.
 */
export function hundredsYear(n: number): string | undefined {
    if (!Number.isInteger(n)) return undefined;
    if (n >= 100 && n < 1000) return numberToWords(n); // åttahundra — one word already
    const rest = n % 100;
    const tail = rest ? numberToWords(rest) : "";
    if (n >= 1000 && n < 1100) return `${THOUSAND}${tail}`; // tusen, tusenfemtio
    if (n >= 1100 && n < 2000) return `${numberToWords(Math.floor(n / 100))}${HUNDRED}${tail}`;
    return undefined;
}

/**
 * AN ABBREVIATION DOT IS SOMETIMES ALSO THE SENTENCE PERIOD, and consuming it loses the pause. Measured
 * over sv_se: **5 utterance-final pauses** were lost by the first draft, at `… tar tag i ens arm, etc.`,
 * `… storytelling, etc.)`, `… ost, tonfisk, etc.`, `… omkring 10 000 f.v.t.`, `… templet 323 f.Kr.` and
 * `… fram till ungefär år 1100 e.Kr.` — the same collision as the Slovak `N.` problem, approached from the
 * abbreviation side rather than the ordinal side, and the mechanism also seen in Polish's
 * `keepFinal`.
 *
 * ONLY SOME ABBREVIATIONS CAN END A SENTENCE, and which ones is a measurement, not a guess:
 *
 *     terminal (`etc.` `f.Kr.` `e.Kr.` `f.v.t.` `osv.`)   5 utterance-final, 0 before a mid-sentence capital
 *     introducer (`t.ex.` `dvs.` `kl.` `Jr.` `St.`)       0 utterance-final, 4 before a capital
 *                                                          (`t.ex. Camp David`, `dvs. Northern Rock`,
 *                                                           `St. Louis`, `t.ex. Pennsylvania Wilds`)
 *
 * So the "followed by a capital ⇒ sentence end" test is applied to the TERMINAL group only; applied to all
 * of them it would have invented four spurious mid-phrase breaks to save five real ones. A closing bracket
 * or quote between the dot and the end of the utterance is skipped, which is what `etc.)` needs.
 */
type KeepFinal = "terminal";
const TERMINAL: KeepFinal = "terminal";

/**
 * DOTTED ABBREVIATIONS, longest / multi-dot first — the interior dot is otherwise clause punctuation, so
 * `t.ex.` read as `t . ɛks .`: two bare consonants and two spurious sentence breaks mid-phrase. The dot
 * is CONSUMED. Counts are corpus instances; only attested abbreviations are listed, which is why the
 * `bl.a.` / `m.m.` / `ca.` / `nr.` that nb and da carry are absent here (0 instances each).
 *
 * `s.k.` is read as the uninflected `så kallad`, and that is knowingly approximate: Swedish agrees it with
 * its noun (`s.k. flikstup` is *så kallade*, `ett s.k. utmarkstillstånd* is *så kallat*), and the agreement
 * target is a following word this layer would have to parse. Two instances, both getting the right two
 * words and the wrong ending — against `s . k .`, which is two bare consonants and two sentence breaks.
 */
const ABBREV: readonly (readonly [RegExp, string, KeepFinal?])[] = [
    [/(?<![\p{L}\p{M}])f\.v\.t\./giu, "före vår tidräkning", TERMINAL], // 3
    [/(?<![\p{L}\p{M}])t\.o\.m\./giu, "till och med"], //        1
    // ⚠ CASE-INSENSITIVE, same reason as German's era rules: FLEURS lowercases, so `1000 f.kr` matched
    // nothing and reached the g2p as the cluster [kr].
    [/(?<![\p{L}\p{M}])f\.\s?Kr\./giu, "före Kristus", TERMINAL], //  3
    [/(?<![\p{L}\p{M}])e\.\s?Kr\./giu, "efter Kristus", TERMINAL], // 2
    [/(?<![\p{L}\p{M}])t\.\s?ex\./giu, "till exempel"], //       8
    [/(?<![\p{L}\p{M}])s\.\s?k\./giu, "så kallad"], //           2
    [/(?<![\p{L}\p{M}])dvs\.?/giu, "det vill säga"], //          2
    [/(?<![\p{L}\p{M}])osv\.?/giu, "och så vidare", TERMINAL], // 1
    [/(?<![\p{L}\p{M}])etc\./giu, "etcetera", TERMINAL], //     4 — the corpus itself spells the
    //                                                              expansion out once ("…i baren, etcetera")
    [/(?<![\p{L}\p{M}])fvt(?![\p{L}\p{M}])/gu, "före vår tidräkning"], // 1 — the undotted variant, so no dot to keep
    [/(?<![\p{L}\p{M}])kl\.\s*/giu, "klockan "], //              4, one of them `kl.12.00` with no space
    [/(?<![\p{L}\p{M}])Jr\./gu, "junior"], //                    3
    [/(?<![\p{L}\p{M}])St\.(?=\s+\p{Lu})/gu, "Sankt"], //        1 — only before a capital, so a
    //                                                              sentence-final `St.` keeps its pause
];

/**
 * RELATIONAL AND OPERATOR SIGNS. **Zero instances in this corpus** — the whole non-alphanumeric inventory
 * is `. , " - ) ( : ; / – ” ? ! ' $ % ° ] [ + &`, with no `= < > × ÷ ± ≈`. They are read anyway, for the
 * reason nb and da give: a sign that is DROPPED is inaudible, and inaudible is the one outcome that cannot
 * be right for arbitrary input. None can misfire, since none of these characters is a Swedish letter.
 * Every word is in the NST lexicon (`lika`, `mindre`, `större`, `delat`, `gånger`, `cirka`, `plus`,
 * `minus`).
 */
const RELATIONAL: readonly (readonly [RegExp, string])[] = [
    [/±/gu, " plus minus "],
    [/≈/gu, " cirka lika med "],
    [/≤/gu, " mindre än eller lika med "],
    [/≥/gu, " större än eller lika med "],
    [/=/gu, " lika med "],
    [/</gu, " mindre än "],
    [/>/gu, " större än "],
    [/×/gu, " gånger "],
    [/÷/gu, " delat med "],
];

const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "be", c: "se", d: "de", e: "e", f: "eff", g: "gé", h: "hå", i: "i", j: "ji",
    k: "kå", l: "ell", m: "emm", n: "enn", o: "o", p: "pe", q: "ku", r: "err", s: "ess", t: "te",
    u: "u", v: "ve", w: "dubbel ve", x: "eks", y: "y", z: "säta", å: "å", ä: "ä", ö: "ö",
};

/** Swedish phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableSwedish = makeUnreadableTest({
    vowels: /[aeiouyåäöé]/u,
    legalOnsets: new Set([
        "bj", "bl", "br", "dj", "dr", "dv", "fj", "fl", "fr", "gj", "gl", "gn", "gr", "hj", "kj", "kl",
        "kn", "kr", "kv", "lj", "mj", "nj", "pl", "pr", "ps", "sc", "sf", "sj", "sk", "sl", "sm", "sn",
        "sp", "st", "sv", "tj", "tr", "tv", "vr",
    ]),
    legalCodas: new Set([
        "bb", "ck", "dd", "ff", "ft", "gg", "gn", "ht", "kk", "ks", "kt", "ld", "lf", "lg", "lk", "ll",
        "lm", "lp", "ls", "lt", "lv", "mm", "mp", "ms", "mt", "nd", "ng", "nk", "nn", "ns", "nt", "pp",
        "ps", "pt", "rd", "rg", "rk", "rl", "rm", "rn", "rp", "rr", "rs", "rt", "rv", "sk", "sp", "ss",
        "st", "tt", "ts",
        "gt", "bt", "mn", "vs", "sm", "ln", "ds", "gs", "lj", "ch", "vt",
    ]),
    // ONE phoneme each — see PhonotacticsData.digraphs.
    digraphs: new Set(["sj", "sk", "stj", "skj", "tj", "kj", "ng", "ch", "sh", "rs"]),
});

/**
 * LEXICAL: acronyms read letter-by-letter although their lowercase form is a pronounceable string, so the
 * OOV phonotactic rule cannot tell.
 */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(["usa", "os", "ai", "usoc"]);

/**
 * Swedish has no pronunciation dictionary that records ACRONYM readings — `accent-stress.tsv` is an
 * accent/stress table over ordinary words — so, as in German and Dutch, `isRecorded` is always false and
 * the lexical facts live entirely in ACRONYM_LETTERS above.
 *
 * ORDERING, verified end-to-end rather than asserted : this pass must run after the Roman-numeral
 * pass, or `XVI` is spelled EKS-VE-I. Swedish is NOT in `registry.ts`'s `ROMAN_NATIVE`, so `normalizeRomans`
 * wraps `engine.text()` and the numerals are already digits by the time this file sees them. A test pins
 * that through the real phonemizer with `XV`, whose letters would be unreadable if the order were wrong.
 * It must also run after ABBREVIATION expansion, or `f.Kr.` becomes EFF-KÅ-ERR.
 */
export function normalizeSwedishInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded: () => false,
        isUnreadable: isUnreadableSwedish,
    })(resolveColonInflection(text));
}

/**
 * THE SWEDISH COLON IS AN INFLECTIONAL JOINT (16 instances) — `USA:s` ×8, `FN:s`, `NASA:s`, `UNESCO:s`,
 * `USOC:s`, `NBA:s`, `TV:n`, `TT:n`, `Luno:n`. It marks a suffix on an abbreviation or a name, and it is
 * NOT a pause: `USA:s president` read as `ɵsˈɑː , s prɛsɪdˈɛnt` — a sentence-level break and then a bare
 * [s] with no vowel.
 */
function resolveColonInflection(text: string): string {
    return text.replace(
        /(?<![\p{L}\p{M}])(\p{L}[\p{L}\p{M}]*):(s|n)(?![\p{L}\p{M}])/gu,
        (_m, head: string, suf: string) => {
            const glued = `${head}${suf}`; // the colon deleted — a word, an inflected name, or a fallback
            if (!/^\p{Lu}{2,}$/u.test(head)) return glued;
            const lower = head.toLowerCase();
            if (!ACRONYM_LETTERS.has(lower) && !isUnreadableSwedish(lower)) return glued;
            const names = [...lower].map((l) => LETTER_NAME[l]);
            return names.every((n) => n !== undefined) ? `${names.join(" ")}${suf}` : glued;
        },
    );
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A clock's minute field, spoken as its own numeral — but `00` as two zeros (*noll noll*), which is what
 *  Swedish says, rather than the single *noll* a bare `Number("00")` would give. */
const minutes = (mm: string): string => (mm === "00" ? "0 0" : mm);

/** Is `h:mm` / `h.mm` a legal wall-clock reading? Cheap, and it is what keeps the period form away from an
 *  English-style decimal (`1.75`) and from a version string. */
const isClock = (h: string, mm: string): boolean => Number(h) < 24 && Number(mm) < 60;

export function normalizeSwedish(input: string): string {
    let t = input;
    let prev: string;

    // 1) SPACE-GROUPED THOUSANDS (37), FIRST — a space is a token boundary, so `1 400 människor` reached
    //    the number path as two numerals and read *ett fyrahundra*, `5 000 000` as *fem noll noll*, and
    //    `24 000` as *tjugofyra noll*. Includes NBSP and the narrow NBSP, which is what a typesetter
    //    emits. It must precede the century and year rules (steps 9–10) so `1 400 människor` and
    //    `1400-talet` get the SAME hundreds reading — the inconsistency to avoid.
    do {
        prev = t;
        t = t.replace(/(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))/gu, "");  // space, NBSP, NNBSP, thin space
    } while (t !== prev);

    // 2) ENGLISH-STYLE COMMA GROUPING (9) — before anything reads the comma as a decimal point, which is
    //    what `swedish.ts`'s TOKEN does: `23,764 kvadratkilometer` read *tjugotre komma sju sex fyra*.
    //    Exactly three digits and no more. Safe here because Swedish writes ZERO genuine three-place
    //    decimals in this corpus — the nine hits are the km²/sq-mi gloss (`783,562`, `300,948`, `755,688`,
    //    `291,773`, `23,764`, `9,174`) and three NASCAR points totals (`2,243`, `2,220`, `2,207`), which
    //    read as 2243/2220/2207 and were the ones that looked like real decimals until the sentence was
    //    read. The genuine decimal comma needs no rule at all: TOKEN already reads `12,8` as *tolv komma
    //    åtta*.
    do {
        prev = t;
        t = t.replace(/(?<=\d)(?<!(?<![\d\.,])0)[,](?=\d{3}(?!\d))/gu, "");
    } while (t !== prev);

    // 3) SPORTS / DURATION TIME `M:SS,hh` (3) — `4:41,30`, `2:11,60`, `1:09.02`. NOT a clock: a third
    //    field means minutes-and-seconds. The colon was clause punctuation, so `4:41,30` read *fyra ,
    //    fyrtioett komma tre noll* with a sentence break inside a time. The colon becomes a space and an
    //    English decimal point becomes the Swedish comma, so TOKEN reads the seconds as one decimal
    //    numeral. FIRST of the three time rules: `1:09.02` contains `09.02`, which step 4 would otherwise
    //    claim as a clock (the Russian and Indonesian defects, from the other direction).
    t = t.replace(/(?<![\d:,])(\d{1,2}):(\d{2})[.,](\d{1,2})(?!\d)/gu, "$1 $2,$3");

    // 4) CLOCK, PERIOD FORM `HH.MM` (12) — the form Swedish writes MORE often (see the header). TOKEN's
    //    `\d+(?:[.,]\d+)?` claimed it as a DECIMAL, so `kl. 20.30` read *tjugo komma tre noll*. Anchored
    //    `(?<!\d)\d{1,2}` so `802.11` ×5 cannot match, `\d{2}(?!\d)` so `1.1` and a three-place decimal
    //    cannot, and gated on a legal hour/minute so an English-style `1.75` cannot. The RANGE form is
    //    claimed first: after the single-clock rewrite there are no dots left for a range rule to see, and
    //    `Mellan 22.00–23.00 MDT` is followed by a capital, so step 13's lowercase guard would decline it.
    t = t.replace(
        /(?<![\d:,])(?<!\.\d)(\d{1,2})\.(\d{2})\s*[-–—]\s*(\d{1,2})\.(\d{2})(?!\d)/gu,
        (m, h1: string, m1: string, h2: string, m2: string) =>
            isClock(h1, m1) && isClock(h2, m2)
                ? `${h1} ${minutes(m1)} till ${h2} ${minutes(m2)}`
                : m,
    );
    t = t.replace(/(?<![\d:,])(?<!\.\d)(\d{1,2})\.(\d{2})(?![\d.])/gu, (m, h: string, mm: string) =>
        isClock(h, mm) ? `${h} ${minutes(mm)}` : m);

    // 5) CLOCK, COLON FORM `HH:MM` (7). The colon is `,` in clausePunctuation, so `klockan 12:00` read
    //    *klockan tolv , noll* — a pause inside the time. Two digits of minutes is what separates it from
    //    the score in step 6 and from the `N:a` ordinal in step 8.
    t = t.replace(/(?<![\d:,])(\d{1,2}):(\d{2})(?![\d.,])/gu, (m, h: string, mm: string) =>
        isClock(h, mm) ? `${h} ${minutes(mm)}` : m);

    // 6) SCORE `N:N` (2) — `betyget 2:2`, `vara 3:2.`. AFTER the clock, which has two minute digits and
    //    would otherwise be eaten by this looser pattern. Only the pause is wrong; two bare cardinals
    //    (*tre två*) is how a Swedish score is read, so the colon is simply removed.
    t = t.replace(/(?<![\d:.,])(\d{1,2}):(\d{1,2})(?![\d\p{L}])/gu, "$1 $2");

    // 7) DOTTED ABBREVIATIONS (29), multi-dot before single-dot — else the interior dot survives as a
    //    phrase break. AFTER the clock rules so `kl. 20.30` and `kl.12.00` still have their times intact
    //    (the `kl.` pattern eats the following space, which is what makes the no-space variant work), and
    //    BEFORE the initialism pass, or `f.Kr.` is spelled EFF-KÅ-ERR.
    for (const [re, word, keepFinal] of ABBREV)
        t = t.replace(re, (m: string, ...rest: unknown[]) => {
            if (keepFinal === undefined || !m.endsWith(".")) return word;
            const at = rest[rest.length - 2] as number;
            const whole = rest[rest.length - 1] as string;
            const after = whole.slice(at + m.length).replace(/^["”'’)\]]+/u, "");
            return after.trim() === "" || /^\s+["“(]?\p{Lu}/u.test(after) ? `${word}.` : word;
        });

    // 8) ORDINAL COLON `N:a` / `N:e` (5) and the two other suffixes the corpus glues to a numeral with a
    //    colon. This is the Swedish ordinal — there is no `N.` form here (see the header) — and it read as
    //    a cardinal, a sentence break and a letter name: `1:a januari` → `ɛtː , ɑː janɵˈɑːrɪ`.
    //      `:a` / `:e`  ordinal        1:a ×2, 3:e, 7:e, 37:e   → första, tredje, sjunde, trettiosjunde
    //      `:s`         ordinal + -s   `Elizabeth II:s` ×1      → andras (the regnal genitive; the Roman
    //                                                             pass upstream has already made it `2:s`)
    //      `:or`        cardinal + -or `Il-76:or` ×1            → sjuttiosexor
    //    The suffix letter carries no information Swedish does not already have — `:a` appears on första /
    //    andra because those END in -a — so the table decides, not the written suffix. An unclaimable
    //    number (>100) keeps its digits and its colon rather than getting a guessed ending.
    t = t.replace(/(?<![\d:.,])(\d{1,3}):(a|e|s|or)(?![\p{L}\p{M}])/gu, (m, n: string, suf: string) => {
        if (suf === "or") return `${numberToWords(Number(n), n)}or`;
        const ord = ordinal(Number(n));
        return ord === undefined ? m : suf === "s" ? `${ord}s` : ord;
    });

    // 9) CENTURY / DECADE `NNNN-tal…` (37) — the largest defect in the language, and three defects in one:
    //    `1400-talet` read `ˈɛ̀tːɵsɛn fˈỳːrahɵndra tˈɑːlɛt`, i.e. the FULL cardinal style where Swedish
    //    reads a year in hundreds, three words where Swedish has one compound, and the hyphen dropped
    //    rather than fused. Covers `-tal`, `-talet` and the longer compounds the corpus writes
    //    (`1700-talsmarknaden`). BEFORE step 10, which would otherwise reword the digits and leave the
    //    hyphen behind, and AFTER step 1, so the space-grouped `1 000-talet` is `1000-talet` by now.
    //    The RANGE form is claimed first (`1100-1200-talet` ×1): its left endpoint has no `-tal` of its
    //    own, so the single rule would strand it and step 13 would decline it (the right operand is
    //    followed by a hyphen, not a lowercase noun).
    t = t.replace(
        /(?<![\d.,:])(\d{3,4})-(\d{3,4})-(tal\p{L}*)/gu,
        (m, a: string, b: string, tail: string) => {
            const first = hundredsYear(Number(a)), second = hundredsYear(Number(b));
            return first !== undefined && second !== undefined ? `${first} till ${second}${tail}` : m;
        },
    );
    t = t.replace(/(?<![\d.,:])(\d{3,4})-(tal\p{L}*)/gu, (m, y: string, tail: string) => {
        const word = hundredsYear(Number(y));
        return word === undefined ? m : `${word}${tail}`;
    });

    // 10) RANGES (11). A dash between numerals is spoken `till`, and it was dropped outright, so
    //     `2-3 km tjock` read *två tre kilometer*. The RIGHT-EDGE guard is what excludes the five SCORES
    //     (see the header): a real range is followed by `)` or by a lowercase word. The operand class ends
    //     in a digit so a trailing clause comma cannot be eaten, and admits an interior comma so
    //     the decimal range `4,2-3,9 miljoner` is one match rather than two.
    //
    //     THE GUARD IS A BLACKLIST, NOT A WHITELIST, and that is the second version. The first accepted a
    //     range only when `)` or a lowercase word followed, which claimed all 11 corpus ranges and declined
    //     all 5 scores — and also declined `1990-1995` standing alone, which `normalization/review.ts` puts
    //     in front of you for exactly this reason. Every score is followed by a hyphen (a third operand or
    //     `-seger`), a period or a comma, so rejecting those three and accepting everything else keeps the
    //     11/5 split and reads the bare range too. `(?!\d)` heads the class because without it the right
    //     operand backtracks: on `21-20,` the two-digit match fails the comma test, and a one-digit match
    //     would then succeed and read *tjugoett till två noll*.
    //
    //     BEFORE THE YEAR RULE (step 11), and this was a live bug in the first draft: `(1469 - 1539).` and
    //     `(1644-1912) styrkor` came out as two hundreds-years with NO connective, because by the time the
    //     range rule ran its operands were words and there were no digits left to match. Everything that
    //     needs to see a bare digit run has to precede step 11.
    t = t.replace(
        /(?<![-–—\d])(\d[\d,]*\d|\d)\s*[-–—]\s*(\d[\d,]*\d|\d)(?![\d\-–—.,])/gu,
        "$1 till $2",
    );

    // 11) BARE FOUR-DIGIT 1100–1999 → THE HUNDREDS READING (~85 instances). `1945` read
    //     *ettusenniohundrafyrtiofem*; Swedish says *nittonhundrafyrtiofem*. Unconditional, with no
    //     context gate — see the header for why a marker list is the wrong shape here and what the two
    //     non-year numbers in range do under this rule.
    //
    //     THE LOOKAHEAD IS THE SENTENCE-PERIOD GUARD. `(?!\.\d)` rather than `(?![.…])`: a following
    //     period is only disqualifying if a digit follows it (a version string, a decimal), so
    //     `… norr om 1770. De kan …` is still claimed AND still keeps its full stop — the rule rewrites
    //     the digits and never touches the mark. That is the whole of "zero sentence-final pauses lost"
    //     for this file; nothing else here matches a digit before a bare period.
    //
    //     NO HYPHEN GUARD, deliberately. An earlier draft excluded a neighbouring `-`, which killed every
    //     year range; the `-tal` compounds are already consumed by step 9 and the corpus's other
    //     digit-hyphen compounds (`64-årige`, `2001-tiden`, `1-diabetes`) are all outside 1100–1999.
    //
    //     ⚠ BUT IT DOES DECLINE A NUMBER THE SYMBOL TIER STILL HAS TO SEE, and this was the one regression
    //     the corpus diff would have caught if the probe had not: converting an operand to words destroys
    //     the number–unit ADJACENCY `makeSymbolNormalizer` matches on (and step 4's "units before
    //     decimals" coupling). `1 300 km av Trans-Alaska…` and `en 1600 km lång väg` came out as
    //     *trettonhundra* / *sextonhundra* followed by a BARE [km] — the unit silently lost, which is worse
    //     than the un-idiomatic *ettusen trehundra kilometer* it replaced. Two utterances, both measured, and
    //     the alternative (claim the unit here, as Welsh must) would duplicate the tier for two sentences.
    //     So the numeral keeps its cardinal reading whenever a tier-claimed abbreviation follows.
    //
    //     TIER_CLAIMS IS COUPLED TO `swedish.ts`'s `makeSymbolNormalizer` DECLARATION and cannot be derived
    //     from it without a circular import, so a test asserts EVERY declared unit still speaks after a
    //     four-digit numeral in range; adding a unit there without adding it here breaks that test rather
    //     than silently dropping the unit.
    //
    //     ⚠ AND IT HAD ALREADY DRIFTED ONCE. `ghz` and `mbit` were added to the tier after this list was
    //     written and not added here, so `1200 GHz` read *tolvhundra* + the cluster [ɡhs] and `1200 Mbit/s`
    //     *tolvhundra* + [mbiːt s] — exactly the regression the paragraph above exists to prevent. The one
    //     test that guarded the coupling only covered `km`, so nothing failed. ⚠ THEY ARE SPELLED
    //     CASE-INSENSITIVELY and the others are not: the corpus writes `GHz` / `Mbit` cased and `km` / `m`
    //     lowercase, and widening the whole group to `/i` would newly decline `1500 M` — a behaviour change
    //     with no evidence behind it — so only the two cased keys carry classes.
    t = t.replace(/(?<![\d.,:\p{L}])(1[1-9]\d\d)(?![\d,:])(?!\.\d)(?!\p{L})(?!\s*(?:%|[$€£°²³]|(?:km|cm|mm|kg|[Gg][Hh][Zz]|[Mm][Bb][Ii][Tt]|m)(?![\p{L}\p{M}])))/gu, (m, y: string) =>
        hundredsYear(Number(y)) ?? m);

    // 12) DEGREES (2), BEFORE any rule that could claim the scale letter — `+30°C` read as *trettio* plus
    //     a bare [k], the sign and the degree both silently gone, and `35°V` as *trettiofem* plus a bare
    //     [v]. `°V` is a LONGITUDE (väst), not a temperature scale; it is the corpus's only compass
    //     instance, and N / S / Ö are deliberately not added (0 instances each — see the PR).
    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    t = t.replace(/(\d)\s*°\s*C(?![\p{L}\p{M}])/gui, "$1 grader celsius");
    t = t.replace(/(\d)\s*°\s*F(?![\p{L}\p{M}])/gui, "$1 grader fahrenheit");
    t = t.replace(/(\d)\s*°\s*V(?![\p{L}\p{M}])/gu, "$1 grader väst");
    t = t.replace(/(\d)\s*°/gu, "$1 grader");

    // 13) `x` AS MULTIPLICATION (1) — `75,6 cm x 62,2` read the letter as [ks]. Requires spaces on both
    //     sides and a digit after, so a hyphenated or word-internal x is untouched; lowercase only, so a
    //     capital `X` in a name is not claimed. `×` itself is handled with the other signs in step 15.
    t = t.replace(/(?<=[\d\p{L}])\s+x\s+(?=\d)/gu, " gånger ");

    // 14) SIGNED NUMBERS (2). `+30°C` — a plus PREFIXED to a number, dropped outright; and `UTC+1`, where
    //     the sign sits between a LETTER and a digit so the boundary-guarded prefix pattern cannot see it.
    //     Two positions, two patterns, both attested. AFTER the ranges so a range's dash is already gone.
    t = t.replace(/(?<![\p{L}\p{M}\d])([-−+])(\d)/gu, (_m, sign: string, d: string) =>
        `${sign === "+" ? "plus" : "minus"} ${d}`);
    t = t.replace(/(?<=[\p{L}\p{M}])\+(?=\d)/gu, " plus ");
    t = t.replace(/(\d)\s*\+\s*(\d)/gu, "$1 plus $2");

    // 15) RELATIONAL AND OPERATOR SIGNS — none occurs here; read anyway, because a dropped sign is
    //     inaudible. See RELATIONAL.
    for (const [re, word] of RELATIONAL) t = t.replace(re, word);

    // 16) AMPERSAND (2) — `bed & breakfasts`, `College of Arts & Sciences`. Dropped outright today, so the
    //     two sides ran together with no separation at all. Both instances sit inside an English phrase;
    //     `och` is still strictly better than silence, the same argument nb and da
    //     made for the same shape.
    t = t.replace(/\s*[&＆]\s*/gu, " och ");

    // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
    return t.replace(/[ \t]{2,}/gu, " ");
}
