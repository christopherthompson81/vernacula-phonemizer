/**
 * Xhosa / isiXhosa (xh) text normalization — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE NOUN-CLASS CONCORD IS DATA IN THE TEXT, NOT SOMETHING TO DERIVE. A numeral qualifying a noun takes a
 * concord agreeing with that noun's class, and Xhosa writes it explicitly, hyphenated onto the digits —
 * `ezingama-3000`, `eziyi-12.8`, `abayi-93%`, `ngo-1957`, `ku-100-200`. The engine drops the hyphen, emits
 * the prefix as its own word and then the cardinal, i.e. it reads exactly what is written. So every rule
 * below leaves its operand as DIGITS, both so the concord still lands on it and so the shared symbol tier can
 * still see number–unit adjacency.
 *
 * ⚠ THE CLOCK IS THE ONE RULE THAT NEEDS WORDS, and for the same reason: the minutes take the connective
 * `na-`, a BOUND morpheme that cannot be glued to a digit run. So step 8 converts both operands itself,
 * applies the fusion, and claims the a.m./p.m. marker and the timezone in the same match — after
 * words-ification nothing downstream can associate them with the time.
 *
 * ⚠ ⟨c⟩ IS A CLICK IN XHOSA ORTHOGRAPHY, which is why no scale name is emitted for a temperature: "Celsius"
 * spelled in Xhosa reads its C as [kǀ], and a bare `°C` did exactly that before.
 *
 * Deliberately not done:
 *   · NO DECIMAL-SEPARATOR WORD. None is attested in any source available here, so the rule removes the
 *     separator and reads the fractional digits one at a time. The point is not spoken — and it was not
 *     spoken before either, it was a full stop. A wrong high-traffic word is worse than a missing one.
 *   · NO ERA PHRASE AND NO LETTER NAMES. Both are refusals for want of a source, not for want of a seam:
 *     `core/initialisms.ts` needs a `letterName` table, and without one its `spellOut` returns undefined and
 *     the pass is a NO-OP, so wiring it would change nothing.
 */
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

/** The manifest's own connective series (`nanye` … `nethoba`): units 1–9 already have their na- form. */
const NA = MANIFEST.numbers.na;

/** Nguni vowel coalescence for the connective `na-` + a vowel-initial noun, read off the manifest's own `na`
 *  series: na+*ithoba* → *nethoba*, na+*isibhozo* → *nesibhozo* (a+i→e), na+*amashumi* → *namashumi* (a+a→a).
 *  a+u→o completes the standard three-way set. */
const COALESCE: Readonly<Record<string, string>> = { a: "a", e: "e", i: "e", o: "o", u: "o" };

/** Measure nouns. ⚠ `iimilimitha` is COMPOSED — Xhosa's own SI pattern (iikhilomitha, ziisentimitha,
 *  iimitha) applied to `mili-` — and is attested in no source. */
const UNIT_WORD: Readonly<Record<string, string>> = {
    km: "iikhilomitha", m: "iimitha", cm: "iisentimitha", mm: "iimilimitha",
    mi: "iimayile", kg: "iikhilogram",
};

/** Rate denominators. Both are single ATTESTED words meaning "per hour"/"per second" — *ngeyure*,
 *  *ngomzuzwana* — not an "A per B" composition, which is why rates are resolved locally at step 11 rather
 *  than through the shared tier's `unitPer`. */
const PER: Readonly<Record<string, string>> = { h: "ngeyure", u: "ngeyure", s: "ngomzuzwana" };

/** Currency, for the DECIMAL path only (an integer amount is the shared tier's — see xhosa.ts). ⚠ Keys must
 *  match the tier's declaration, or a decimal and an integer would read differently. */
const CUR_WORD: Readonly<Record<string, string>> = {
    "US$": "iidola zaseMelika", "AUD$": "iidola", "$": "iidola", "£": "iiponti", "¥": "iiyeni",
};

/** Magnitude words, longest first. Shared with xhosa.ts's `magnitudes` and kept identical so the decimal and
 *  integer paths agree.
 *  ⚠ `million` is declared UNTRANSLATED because Xhosa text sometimes writes it that way (`2.2 million km2`).
 *  Without it the magnitude sits between the number and the unit, the tier's adjacency fails, and `km2`
 *  reaches the IPA as raw letters. */
export const MAGNITUDES: readonly string[] = [
    "yezigidi", "zezigidi", "izigidi", "bhiliyoni", "miliyoni", "million",
];
const MAG_ALT = [...MAGNITUDES].sort((a, b) => b.length - a.length).join("|");

/** Compass points for a bare degree — `35°W` is a LONGITUDE, not a temperature. */
const COMPASS: Readonly<Record<string, string>> = {
    N: "emantla", S: "emazantsi", E: "empuma", W: "entshona",
};

/** a.m./p.m. `emva kwemini` is literally *post meridiem*, so it is right for every p.m. hour rather than only
 *  the evening ones. */
const AM = "kusasa";
const PM = "emva kwemini";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** `na-` prefixed to a numeral's words, with the coalescence above. ⚠ Units 1–9 come from the manifest's own
 *  `na` series rather than being derived, because those forms are suppletive (`kunye` → `nanye`). */
function connective(n: number): string {
    if (n < 10) return NA[n] ?? numberToWords(n);
    const parts = numberToWords(n).split(" ");
    const head = parts[0]!;
    const v = COALESCE[head[0]!.toLowerCase()];
    parts[0] = v === undefined ? `na ${head}` : `n${v}${head.slice(1)}`;
    return parts.join(" ");
}

/** An hour and its minutes as Xhosa words. ⚠ `:00` emits the hour alone — the alternative is the manifest's
 *  zero word `iqanda` ("egg"), which is what `12.00 GMT` read before. */
function clockWords(h: number, m: number): string {
    return m === 0 ? numberToWords(h) : `${numberToWords(h)} ${connective(m)}`;
}

/** The digits of a fractional part, spaced so the number path speaks them one at a time. ⚠ Reading `34` as a
 *  number would say *amashumi amathathu nane* — "thirty-four" — which is a different quantity. */
const spell = (int: string, frac: string): string => `${int} ${[...frac].join(" ")}`;

/** Is a word appearing anywhere in the ~40 characters before this offset? The redundancy guard for
 *  `amaqondo`: a Celsius sentence often already says it (*amaqondo angaphezulu kwe +30°C*), and emitting it
 *  again would double the noun. */
function saidBefore(full: string, offset: number, word: string): boolean {
    return full.slice(Math.max(0, offset - 40), offset).includes(word);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Xhosa input string. Steps are ORDER-DEPENDENT; each states its coupling. */
/**
 * ENGLISH LETTER NAMES SPELLED IN NGUNI ORTHOGRAPHY, for reading initialisms.
 *
 * ⚠ WHY THIS EXISTS AND WHY IT IS SPELLED, NOT TRANSCRIBED. c, q and x are CLICK letters, so an acronym
 * reaching the g2p raw is confidently wrong rather than merely mute — `UTC` read [ˈuːtʼkǀ], a word ending
 * in a dental click, and `PBS` read [pʼɓs]. The header's refusal ("no letter names, for want of a source")
 * left that in place. The source question is answerable in one direction: acronyms in isiZulu/isiXhosa are
 * English borrowings, kept in capitals, and read with the English letter names — so what is needed is not
 * an indigenous letter-name series but the English one, ADAPTED. Writing each name in Nguni orthography
 * and letting this language's own g2p read it is what produces the adaptation, rather than splicing in
 * American English phonology (which the OmniVoice ASR probe measured readers as NOT doing).
 *
 * ⚠ EVERY SPELLING AVOIDS c, q AND x, or it would reintroduce the exact click bug it exists to fix — hence
 * `si` for C, `khyu` for Q, `eksi` for X. And aspirated `bh/ph/th/kh` rather than bare `b/p/t/k`, because
 * bare b is the IMPLOSIVE /ɓ/ and bare p/t/k are ejective; English letter names have the pulmonic ones.
 * Verified through this engine — all 26 render click-free: b→b̤ˈiː, c→sˈiː, q→kʰjˈuː, x→ˈɛːkʼsi,
 * w→d̤ab̤ulˈiːju, h→ɛjˈiːt͡ʃʼi.
 */
const NGUNI_LETTER_NAME: Readonly<Record<string, string>> = {
    A: "eyi", B: "bhi", C: "si", D: "di", E: "i", F: "efu", G: "ji", H: "eyitshi", I: "ayi",
    J: "jeyi", K: "kheyi", L: "eli", M: "emu", N: "eni", O: "o", P: "phi", Q: "khyu", R: "a",
    S: "esi", T: "thi", U: "yu", V: "vi", W: "dabhuliyu", X: "eksi", Y: "wayi", Z: "zedi",
};

/**
 * All-caps runs → letter names. Gated on the text containing lowercase, since an all-caps DOCUMENT carries
 * no initialism signal (core/initialisms.ts makes the same exemption). Flanked by neither letter nor digit,
 * which leaves mixed alphanumeric codes alone.
 *
 * ⚠ THE LOOKBEHIND MUST ALLOW A LOWERCASE LETTER, unlike the general rule: Nguni glues its concord to the
 * borrowed acronym (`i-PBS`, `weNPWS`, `kwiTV`), so requiring a non-letter on the left would decline exactly
 * the forms this language writes. A concord followed by capitals is the normal shape here.
 */
/** Acronyms said as WORDS, not letters — the same exemption core/initialisms.ts keeps for every other
 *  language that wires this. COVID is /ˈkoʊvɪd/, never C-O-V-I-D, and `i-COVID-19` proved it. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set([
    "covid", "nato", "fifa", "opec", "unesco", "unicef", "aids", "laser", "sars", "eskom", "sadc",
]);

function spellNguniInitialisms(s: string): string {
    if (!/\p{Ll}/u.test(s) && /\s/u.test(s.trim())) return s;
    // ⚠ `$` in the trailing guard: `US$`/`AUD$` are MULTI-CHARACTER CURRENCY KEYS owned by the ENGINE
    // tier (zulu.ts/xhosa.ts), not by this pass. Spelling `US` here strips the tier's key and the
    // amount loses its "amadola" — which is exactly what happened before this guard.
    return s.replace(/(?<![\p{Lu}\p{M}\d])[A-Z]{2,6}(?![\p{L}\p{M}\d$])/gu, (run) =>
        WORD_ACRONYMS.has(run.toLowerCase()) ? run : [...run].map((c) => NGUNI_LETTER_NAME[c] ?? c).join(" "));
}

export function normalizeXhosa(input: string): string {
    let s = input;

    // 1) HTML ENTITY, then the bare ampersand → `kunye` ("and"). The entity must go first or `&amp;` becomes
    //    "kunye amp ;".
    s = s.replace(/&amp;/giu, "&").replace(/&/gu, " kunye ");

    // 2) DOTTED CAPITAL RUNS → the bare letters, BEFORE anything else reads an interior dot as a phrase
    //    break (multi-dot abbreviations before single-dot).
    //    ⚠ THE FINAL DOT IS KEPT WHEN THE SENTENCE VISIBLY ENDS, or a trailing `…yase U.S.` loses its
    //    sentence break. Three cases, disambiguated by what follows: a letter with NO space is a glued word
    //    (`U.S.Geological` → "US Geological"); a space then a capital, or end of input, is a sentence end
    //    (keep the dot); anything else is mid-sentence (drop it).
    s = s.replace(/(?<![\p{L}\p{M}])(?:\p{Lu}\.){2,}/gu, (run, off: number, full: string) => {
        const letters = run.replace(/\./gu, "");
        const rest = full.slice(off + run.length);
        if (/^[\p{L}\p{M}]/u.test(rest)) return `${letters} `; // glued next word
        return rest === "" || /^[  ]+\p{Lu}/u.test(rest) ? `${letters}.` : letters;
    });
    //    `U.S House` — one dot, so the run above cannot claim it.
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})\.(\p{Lu})(?![\p{L}\p{M}])/gu, "$1$2");
    //    A personal initial glued to the name, where the dot was reading as a full stop.
    //    ⚠ THE LOOKBEHIND EXCLUDES ONLY AN UPPERCASE LETTER, not any letter: Xhosa glues its subject prefix
    //    on the front (`uN.Wayne`), so the `(?<![\p{L}\p{M}])` guard core/initialisms.ts uses declines it.
    //    The dangerous shape — a sentence ending in a lone capital before a new one — is still excluded,
    //    because the lookahead requires the next capital to be GLUED to the dot with no space.
    s = s.replace(/(?<![\p{Lu}\p{M}])(\p{Lu})\.(?=\p{Lu}\p{Ll})/gu, "$1 ");

    // 3) ABBREVIATIONS. `Mnu.` → `Mnumzana`, requiring a following capitalised name so the token cannot be
    //    claimed inside anything else. `Jr.` has no Xhosa reading to give it, so only its DOT is removed, and
    //    only when a lowercase word follows — i.e. when the sentence visibly continues. `St.` is deliberately
    //    untouched: it is an English place name (St James Gate).
    s = s.replace(/(?<![\p{L}\p{M}])(u?)Mnu\.?(?=[  ]\p{Lu})/giu, "$1Mnumzana");
    s = s.replace(/(?<![\p{L}\p{M}])Jr\.(?=[  ]\p{Ll})/gu, "Jr");
    // `njl.` / `njll.` is *njalonjalo* ("et cetera") — corpus: `izinto zokuthutha, njll.`, previously
    // the cluster [ɲd͡ʒ̤l] plus a leaked break. Dot optional: FLEURS strips it.
    s = s.replace(/(?<![\p{L}\p{M}])njll?\.?(?![\p{L}\p{M}])/giu, "njalonjalo");

    // 4) THOUSANDS DE-GROUPING, before anything else numeric: the grouping comma reads as clause punctuation
    //    and the tail as a separate number, so `11,000` ends in *iqanda* ("egg"). Exactly three digits per
    //    block, which keeps a decimal comma (`2,3 miliyoni`) and a date comma (`Novemba 26,2008` — a
    //    FOUR-digit tail) out of this rule.
    //    ⚠ THE TRAILING GUARD IS `(?![\d]|,\d)`, NOT `(?![\d.,])`. With the wider guard a grouped number
    //    followed by a CLAUSE comma or a sentence period declines to de-group, and the leftover comma is then
    //    read as a decimal separator by step 6 — `¥130,000,` comes out "one hundred and thirty zero zero zero
    //    yen". The guard only needs to stop a PARTIAL grouped match (`1,234` inside `1,234,5`), i.e. `,\d`.
    s = s.replace(/(?<![\d.,])(\d{1,3})(?:,\d{3})+(?![\d]|,\d)/gu, (whole) => whole.replace(/,/gu, ""));
    //    SPACE grouping. The shared tier's `NUM` understands it but the TOKEN does not, so `6 500` reads
    //    "six five hundred". Blocks of exactly three digits, or "30 9" would fuse two unrelated numbers.
    s = s.replace(/(?<![\d.,])(\d{1,3})((?:[  ]\d{3})+)(?![\d])/gu,
        (whole) => whole.replace(/[  ]/gu, ""));

    // 5) THE CURRENCY SIGN, PRISED OFF ITS CONCORD PREFIX. ⚠ The shared tier is letter-bounded on the left,
    //    deliberately, so a sign written INSIDE a word cannot match — and Xhosa glues its concord straight
    //    onto the sign (`leUS$30`, `i$10`), so both signs are silently swallowed. A compound key cannot fix
    //    `i$`, because `i` is a Xhosa noun prefix and not a currency code, so the split belongs here and the
    //    compound key (`US$`) belongs in the tier. Also joins the spaced code form `US $ 14.7`. BEFORE step
    //    6, which needs to know which sign it is looking at.
    //    ⚠ THE SPLIT MUST RUN BEFORE THE JOIN. The other way round the join is silently undone: the split's
    //    lookbehind is any letter, so it fires again on the `S` of a freshly joined `US$` and re-inserts the
    //    space, leaving `i-US $14.7` for the tier to match as a bare `$`.
    s = s.replace(/(?<=[\p{L}\p{M}])(?=(?:US|AUD)?[$£¥€][  ]?\d)/gu, " ");
    s = s.replace(/(?<![\p{L}\p{M}])(US|AUD)[  ]+(?=[$£¥€][  ]?\d)/gu, "$1");

    // 6) A DECIMAL CARRYING A CURRENCY SIGN OR A UNIT must claim it here. Step 15 turns `14.7` into `14 7`,
    //    which destroys the number adjacency the shared tier matches on, so `US$ 14.7 yezigidi` would read
    //    *14 iidola zaseMelika 7 yezigidi* — the noun inside the number.
    //    ⚠ A COMMA IS A DECIMAL SEPARATOR ONLY WITH A 1–2 DIGIT TAIL, the same discipline step 15 uses:
    //    without it these two rules eat a grouped thousand that step 4 declined.
    const decimal = (sep: string, frac: string): boolean => sep === "." || frac.length <= 2;
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}])(US\\$|AUD\\$|[$£¥])[  ]?(\\d+)([.,])(\\d+)((?:[  ](?:${MAG_ALT}))?)`, "gu"),
        (whole, sym: string, int: string, sep: string, frac: string, mag: string) =>
            decimal(sep, frac)
                ? `${spell(int, frac)}${mag} ${CUR_WORD[sym] ?? ""}`.replace(/[  ]+$/u, "")
                : whole);
    s = s.replace(/(?<![\d.,])(\d+)([.,])(\d+)[  ]?(km|mm|cm|kg|mi|m)(?![\p{L}\p{M}'’ʼ])/gu,
        (whole, int: string, sep: string, frac: string, u: string) =>
            decimal(sep, frac) ? `${spell(int, frac)} ${UNIT_WORD[u]!}` : whole);

    // 7) A DECIMAL RANGE, before the plain range rule (step 10) and before step 15. ⚠ The plain rule's
    //    lookbehind blocks a digit that follows a dot, so a decimal span matches nothing there, and step 15
    //    would then spell both sides out with the hyphen dropped and no joiner at all.
    //    NOT ascending-gated: a decimal pair is never a score, and the attested span counts backwards in time
    //    (4.2 to 3.9 million years ago).
    s = s.replace(/(?<![\d.,])(\d+\.\d+)[  ]?[-–][  ]?(\d+\.\d+)(?![\d.])/gu, "$1 ukuya ku $2");

    // 8) THE CLOCK, colon form — the one rule that must produce WORDS (see the header). A clock is sometimes
    //    written with a SPACE after the colon (`10: 00`), hence `[  ]?`.
    //    ⚠ A SPORTS TIME IS NOT A CLOCK: `4: 41.30` is a pace, and the trailing `(?![:.\d])` is what declines
    //    it — a third field.
    //    The a.m./p.m. marker is consumed in the SAME match, because after words-ification nothing downstream
    //    can associate it with the time, and its own dots were two more sentence breaks.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):[  ]?([0-5]\d)(?![:.\d])(?:[  ]*([AaPp])\.?[Mm]\.?)?/gu,
        (whole, h: string, m: string, ap: string | undefined) => {
            const hv = Number(h), mv = Number(m);
            if (hv > 23 || mv > 59) return whole;
            const marker = ap === undefined ? "" : ap.toLowerCase() === "p" ? ` ${PM}` : ` ${AM}`;
            return `${clockWords(hv, mv)}${marker}`;
        });

    // 9) THE CLOCK, DOT form before a timezone — `12.00 GMT`. The dot is otherwise a decimal; a two-digit
    //    minute field plus a timezone name is what marks it as a time. BEFORE step 15, which would otherwise
    //    read `15.00` as *ishumi nanhlanu iqanda iqanda*.
    s = s.replace(/(?<![\d.,])(\d{1,2})\.([0-5]\d)(?![.\d])[  ]*(UTC|GMT)/gu,
        (whole, h: string, m: string, tz: string) => {
            const hv = Number(h);
            return hv > 23 ? whole : `${clockWords(hv, Number(m))} ${tz}`;
        });

    // 10) RANGES → `ukuya ku` ("going to"). ⚠ ASCENDING ONLY: a non-ascending `N-N` is a score (`5-3`,
    //     `26 - 00`) or a season (`1995-96`), which read as a bare juxtaposition and must keep it.
    //     Both operands stay DIGITS, so a following unit is still adjacent for step 11 and for the tier
    //     (`56-64 km/h`). AFTER de-grouping, so a grouped endpoint is already one run of digits.
    s = s.replace(/(?<![\d.,])(\d+)[  ]?[-–][  ]?(\d+)(?![\d.,])/gu,
        (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} ukuya ku ${b}` : whole));

    // 11) RATES, resolved locally rather than through the tier's `unitPer` — see `PER`. Covers the glued,
    //     spaced and spaced-slash spellings (`160km/h`, `480 km/h`, `83 km / h`) plus `mph` and `kph`.
    //     Numbers stay DIGITS. BEFORE step 15, which would break the adjacency.
    s = s.replace(/(?<![\d.,])(\d+)[  ]?(km|mi|m)[  ]*\/[  ]*(h|u|s)(?![\p{L}\p{M}])/giu,
        (whole, n: string, u: string, d: string) => {
            const head = UNIT_WORD[u.toLowerCase()], per = PER[d.toLowerCase()];
            return head === undefined || per === undefined ? whole : `${n} ${head} ${per}`;
        });
    s = s.replace(/(?<![\d.,])(\d+)[  ]?(mph|kph)(?![\p{L}\p{M}])/giu,
        (_m, n: string, u: string) =>
            `${n} ${u.toLowerCase() === "kph" ? UNIT_WORD["km"]! : UNIT_WORD["mi"]!} ${PER["h"]!}`);

    // 12) DEGREES — `+30°C` (temperature) and `35°W` (a longitude). The ° was dropped and the scale letter
    //     read as a phoneme, `C` coming out as the CLICK [kǀ]. No scale name is emitted; see the header.
    //     ⚠ THE DEGREE NOUN IS SUPPRESSED WHEN THE CLAUSE ALREADY CARRIES IT — *amaqondo angaphezulu kwe
    //     +30°C* would otherwise double it.
    //     `F` is claimed alongside `C` even though Fahrenheit is unattested here: without it, `30°F` falls
    //     through every branch (the bare-degree rule's trailing guard rejects a letter) and loses the ° while
    //     the F reaches the g2p raw.
    //     THE SIGN IS CLAIMED HERE TOO, because the ° rewrite separates it from its digits and step 14's
    //     leading arm requires a DIGIT after the sign — `+amaqondo 30` would not match.
    //     ⚠ THE SIGN CAPTURE IS LETTER-GUARDED, and it has to be: Xhosa's concord hyphen looks exactly like a
    //     minus. Unguarded, `kwi-30°C` — an ordinary Xhosa spelling — reads *kwi thabatha amaqondo 30*, "in
    //     minus thirty degrees".
    //     BEFORE step 13, which needs the digits intact.
    s = s.replace(/(?<![\p{L}\p{M}\d])([+-])?(\d+)[  ]?°[  ]?[CF](?![\p{L}\p{M}])/gu,
        (_m, sign: string | undefined, n: string, off: number, full: string) => {
            const body = saidBefore(full, off, "maqondo") ? n : `amaqondo ${n}`;
            if (sign === "+") return `plas ${body}`;
            return sign === "-" ? `thabatha ${body}` : body;
        });
    s = s.replace(/(\d+)[  ]?°[  ]?([NSEW])(?![\p{L}\p{M}])/gu, (_m, n: string, c: string, off: number, full: string) =>
        `${saidBefore(full, off, "maqondo") ? n : `amaqondo ${n}`} ${COMPASS[c]!}`);
    s = s.replace(/(\d+)[  ]?[°º](?![\p{L}\p{M}])/gu, (_m, n: string, off: number, full: string) =>
        saidBefore(full, off, "maqondo") ? n : `amaqondo ${n}`);

    // 13) THE ENGLISH ORDINAL SUFFIX (`15th`, `17th-century`). Such a form already carries its Xhosa concord
    //     in the text — *ngesenturi ye 16th* — so the Latin suffix is redundant orthography, and it was
    //     reaching the phoneme stream as a bare [tʰ]. Stripping it is the whole fix; no ordinal morphology is
    //     invented, because Xhosa's is written and is written here. Case-insensitive.
    s = s.replace(/(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1");

    // 14) RELATIONAL AND ARITHMETIC SIGNS. A dropped sign is INAUDIBLE — the one outcome that cannot be
    //     right — so these are read even where the corpus has no instance. AFTER step 10, so no range dash
    //     reaches here.
    //     ⚠ THE TWO SIGNED-NUMBER GUARDS ARE MEASURED, not stylistic:
    //     · `+` is read only BETWEEN two operands (`UTC+1`, `4+4`). A LEADING `+` on a temperature is a
    //       positivity marker, usually redundant with the sentence's own *angaphezulu* ("above"), and step 12
    //       has already claimed that shape.
    //     · `-` is read only where it cannot be a compound hyphen or a stray dash: nothing alphanumeric
    //       before it, AND not a space that itself follows a word. `ebhudla kangange -40 mph` renders "winds
    //       blowing at 40 mph", so reading that hyphen as *thabatha* would be confidently wrong.
    s = s.replace(/[  ]*[=≈][  ]*/gu, " lilingana ne ");
    s = s.replace(/[  ]*<[  ]*/gu, " ngaphantsi kuna ");
    s = s.replace(/[  ]*>[  ]*/gu, " ngaphezulu kuna ");
    s = s.replace(/(\d)[  ]*×[  ]*(?=\d)/gu, "$1 phindaphinda ");
    s = s.replace(/[  ]*÷[  ]*/gu, " yahlula ");
    //     ⚠ `+` BETWEEN OPERANDS IS `plas`, NOT `dibanisa`. `dibanisa` is the dictionary's ADDITION OPERATOR
    //     and a correct gloss of the symbol; it is not what a reader says in `UTC+1`, which takes the English
    //     loan. Spelled `plas` and not `plus` because this orthography is phonemic and the attested vowel is
    //     [a] — `plus` would read pʼlˈuːs. The conventional isiXhosa spelling of the loan is unsourced; this
    //     one is chosen to reproduce the phones.
    s = s.replace(/(?<=[\p{L}\d])\+(?=\d)/gu, " plas ");
    s = s.replace(/(?<![\p{L}\p{M}\d])\+[  ]?(?=\d)/gu, "plas ");
    s = s.replace(/(?<![\p{L}\p{M}\d])(?<![\p{L}\p{M}][  ])[-−](?=\d)/gu, "thabatha ");

    // 15) DECIMALS, LAST of the numeric rules — steps 6 to 12 all need the number intact. The dot was
    //     reaching `clausePunctuation` and becoming a SENTENCE BREAK inside a number. NO separator word is
    //     emitted; see the header.
    //     The comma arm is restricted to a 1–2 digit tail so a date comma (`Novemba 26,2008`) cannot be
    //     swallowed.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d])/gu, (_m, int: string, frac: string) => spell(int, frac));
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (_m, int: string, frac: string) => spell(int, frac));

    // INITIALISMS LAST. Every rule above owns capitals of its own — `US$`, `°C`, `B.C.`, `sq mi` — and
    // spelling them out first would take those away, which is exactly what happened when this ran early.
    s = spellNguniInitialisms(s);

    // ⚠ A padded replacement (` kunye `, `letters `) doubles a space that was already there and can leave one
    // at an edge. SLOT-GAP is a corpus-diff defect class; this pass must not feed it.
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
