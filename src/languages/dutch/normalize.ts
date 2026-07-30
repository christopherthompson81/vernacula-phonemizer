/**
 * Dutch (nl) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the 1,829 unique cased FLEURS nl_nl utterances (column 3):
 *   dot-grouped thousands ×33 · comma decimals ×16 · clock `H.MM` ×15 · clock `H:MM` ×5 (+3 that are NOT
 *   clocks, see below) · ordinals `Ne/Nde/Nste` ×33 · units (km/mm/cm/kg/mi/m) ×37 · `km/u`+`m/s` ×5 ·
 *   squared units (km² km2 mi2 mm2) ×8 · percent ×6 · currency ×3 ($ ×2, £ ×1) · degrees ×2 · `&` ×4 ·
 *   `+` ×2 · dotted abbreviations ×14 (etc. ×5, bijv. ×2, ca. ×1, dd. ×1, nr. ×1, jr. ×1, St. ×2, dr. ×1) ·
 *   multi-dot ×5 (v.Chr. ×2, n.Chr. ×1, e.d. ×1) · dotted capital runs ×4 (V.S., V.N., U.S., D. K.) ·
 *   all-caps runs ×146 (VS ×13, VN ×4, ADD ×4, MS/FBI/GMT/DNA/MRI/UTC ×3 each) · fractions ×1.
 *
 * THE BARE `N.` NON-RULE — the deliberate negative result. German writes its ordinal as a numeral plus a
 * bare PERIOD (`16. Jahrhundert`) and needed a detector for it. Dutch does NOT: tabulating every
 * `(?<![\d.])\d{1,4}\.(?!\d)` across nl_nl returns 26 hits and ALL TWENTY-SIX are sentence-final periods
 * ("…in 1979.", "…de jaren 20.", "…Fort Greely-pompstation 9."). Dutch writes the ordinal with a LETTER
 * suffix instead — `18e`, `15de`, `60ste` — which is unambiguous and needs no context at all. So German's
 * rule is deliberately NOT ported; porting it would have converted 26 sentence-final pauses into ordinals.
 * The check that matters, stated as the playbook asks: zero sentence-final pauses are lost, because no rule
 * here touches a digit followed by a bare period.
 *
 * THE SEPARATORS. Dutch, like German, groups thousands with a PERIOD and takes a COMMA decimal. The Dutch
 * engine had the same latent bug German did, one layer down: `dutch.ts`'s TOKEN was a bare `(\d+)`, so BOTH
 * separators fell through to `clausePunctuation` and `400.000` read as *vierhonderd . nul* — a phrase break
 * and a lost magnitude — while `6,5` read as *zes , vijf*. That defect is in the tokenizer, not in this
 * layer, so it is fixed where it lives (dutch.ts), not papered over here.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Dutch ordinals 1–19. The regular ending is the cardinal plus -de; `eerste`, `derde` and `achtste` are
 *  the three suppletive/assimilated forms. From 20 up the ending is -ste (twintigste, zestigste). */
const ORD_BELOW_20: readonly string[] = [
    "", "eerste", "tweede", "derde", "vierde", "vijfde", "zesde", "zevende", "achtste", "negende", "tiende",
    "elfde", "twaalfde", "dertiende", "veertiende", "vijftiende", "zestiende", "zeventiende", "achttiende",
    "negentiende",
];

/**
 * Integer → the Dutch ordinal word. Below 20 it is a table lookup. At or above 20 the ending is -ste, EXCEPT
 * that a sub-20 remainder carries its own small-ordinal form onto the end of the compound — 101e is
 * *honderdeerste*, 108e *honderdachtste*, 112e *honderdtwaalfde* — so the trailing cardinal is swapped for
 * the small ordinal when there is one. 21e (remainder 21 % 100 = 21) takes plain -ste: eenentwintigste.
 */
export function ordinalWord(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1) return undefined;
    if (n < 20) return ORD_BELOW_20[n];
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const r = n % 100;
    if (r >= 1 && r < 20) {
        const tail = MANIFEST.numbers.ones[r];
        if (tail !== undefined && card.endsWith(tail))
            return `${card.slice(0, -tail.length)}${ORD_BELOW_20[r]}`;
    }
    return `${card}ste`;
}

/** Multi-dot abbreviations and era markers. Handled BEFORE the single-dot rule so no interior dot survives
 *  as a phrase break. `v.Chr.` ×2, `n.Chr.` ×1, `e.d.` ×1 are the corpus-attested ones; the rest are the
 *  standard, unambiguous Dutch dotted abbreviations (none occur in nl_nl, so they cost nothing there). */
const MULTI_DOT: readonly (readonly [string, string])[] = [
    ["v\\.\\s?Chr", "voor Christus"],
    ["n\\.\\s?Chr", "na Christus"],
    ["e\\.\\s?d", "en dergelijke"],
    ["o\\.\\s?a", "onder andere"],
    ["d\\.\\s?w\\.\\s?z", "dat wil zeggen"],
    ["m\\.\\s?a\\.\\s?w", "met andere woorden"],
    ["i\\.\\s?p\\.\\s?v", "in plaats van"],
    ["a\\.\\s?u\\.\\s?b", "alstublieft"],
    ["e\\.\\s?a", "en andere"],
];

/** Single-dot abbreviations → the spoken words. The dot is a phrase break otherwise, and the stem itself is
 *  usually unpronounceable: `bijv.` read as the word *bɛi̯f*, `nr.` as the cluster *nr*, `St.` as *st*. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    bijv: "bijvoorbeeld", bv: "bijvoorbeeld", etc: "etcetera", enz: "enzovoort", ca: "circa",
    dd: "de dato", nr: "nummer", jr: "junior", sr: "senior", st: "Sint", blz: "bladzijde",
    dr: "dokter", prof: "professor", ir: "ingenieur", drs: "doctorandus", mr: "meester",
    mln: "miljoen", mld: "miljard",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/**
 * Dutch letter NAMES, spelled the way the Dutch g2p reads them: a→aa /aː/, b→bee /beː/, f→ef /ɛf/,
 * g→gee /ɣeː/, h→haa /ɦaː/, i→ie /i/, q→kuu /ky/, u→uu /y/, w→wee /ʋeː/, x→iks /ɪks/, y→ij /ɛi̯/ (the
 * Dutch name for ⟨y⟩ is *Griekse ij*), z→zet /zɛt/. This is the standard Dutch alphabet, not a guess.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "aa", b: "bee", c: "see", d: "dee", e: "ee", f: "ef", g: "gee", h: "haa", i: "ie", j: "jee",
    k: "kaa", l: "el", m: "em", n: "en", o: "oo", p: "pee", q: "kuu", r: "er", s: "es", t: "tee",
    u: "uu", v: "vee", w: "wee", x: "iks", y: "ij", z: "zet",
};

/** Dutch phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableDutch = makeUnreadableTest({
    vowels: /[aeiouy]/u,
    legalOnsets: new Set([
        "bl", "br", "ch", "dr", "dw", "fl", "fr", "gl", "gr", "kl", "kn", "kr", "kw", "pl", "pr", "ps",
        "sc", "sch", "sf", "sj", "sl", "sm", "sn", "sp", "st", "sw", "th", "tj", "tr", "tw", "vl", "vr",
        "wr", "zw",
    ]),
    legalCodas: new Set([
        "ch", "ck", "cht", "ft", "ht", "kt", "ld", "lf", "lg", "lk", "lm", "lp", "ls", "lt", "mp", "ms",
        "mt", "nd", "ng", "nk", "ns", "nt", "pt", "rd", "rf", "rg", "rk", "rl", "rm", "rn", "rp", "rs",
        "rt", "sp", "st", "ts", "ks", "ps", "sk",
    ]),
});

const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);

/** Dutch has no pronunciation dictionary that records acronym readings (nl-stems.txt is a morphological
 *  stem list, not an attested-pronunciation table), so — as in German — the lexical facts live entirely in
 *  the manifest's `acronymLetters` and everything else falls to the OOV phonotactic rule. */
export function normalizeDutchInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded: () => false,
        isUnreadable: isUnreadableDutch,
    })(text);
}

/** Letter-by-letter reading of an all-caps run, or undefined if any letter has no name. */
function spellCaps(run: string): string | undefined {
    const names = [...run.toLowerCase()].map((l) => LETTER_NAME[l]);
    return names.every((n) => n !== undefined) ? names.join(" ") : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Dutch input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeDutch(input: string): string {
    let s = input;

    // 1) ERA MARKERS and the MULTI-DOT abbreviations. FIRST, before the single-dot rule — otherwise the
    //    single-dot rule consumes `v.` / `e.` and leaves `Chr.` / `d.` behind as an interior phrase break.
    //    Also before step 2, whose capital-run rule would otherwise not see them but whose output would
    //    collide with `Chr.`.
    //    Two branches, as in step 3: the marker's FINAL dot is kept when the marker ends the string, where
    //    it really is the sentence period ("…dateren uit 5000 v.Chr." must keep its pause), and consumed
    //    otherwise ("rond 10.000 v.Chr. was neergestreken" must not gain one).
    for (const [body, word] of MULTI_DOT) {
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.(?=\\s*$)`, "giu"), `${word}.`);
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.`, "giu"), word);
    }

    // 2) DOTTED CAPITAL RUNS → a bare all-caps run, so the shared initialism pass (run later, from the
    //    engine) reads them as LETTERS. `V.S.` was *f . s .* — two unpronounceable stops and two spurious
    //    phrase breaks. Corpus: V.S., V.N., U.S., and the personal initials `D. K.` — 4 hits, no false
    //    positives (a sentence-final capital never matches, because two dotted capitals are required and
    //    the first is preceded by a letter inside a word like "VS.").
    //    BEFORE step 3, so `S.`/`K.` are never offered to the single-dot abbreviation rule.
    //    The pattern deliberately ENDS on a dot rather than allowing a trailing separator, so the space
    //    after the run survives — an earlier `(?:\p{Lu}\.\s?){2,}` swallowed it and glued "V.S. met" into
    //    the single token *VSmet*, which the initialism pass then could not see as a caps run at all.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));

    // 3) SINGLE-DOT ABBREVIATIONS. As in German, two branches: mid-sentence the dot is CONSUMED so it
    //    cannot become a phrase break; at a phrase end it is kept, because there it really is the sentence
    //    end (`…, etc.` ×3 of the 5).
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\d])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 4) ORDINALS — the Dutch form is a numeral plus a LETTER suffix (`18e` ×26, `15de`, `60ste`, `1e`),
    //    which is why no bare-`N.` detector is needed (see the file header). Every attested suffix is
    //    accepted and the word is recomputed from the number, so a spelling like `15de` (where standard
    //    Dutch is *vijftiende*) still comes out right. Was *achttien ee* / *vijftien de* / *zestig stee*.
    //    BEFORE the number tokenizer, and before step 5 so a digit run is not first claimed as a clock.
    s = s.replace(/(?<![\d,.])(\d{1,4})(?:ste[n]?|de[n]?|e)(?![\p{L}\p{M}])/gu, (m0, d: string) =>
        ordinalWord(Number(d)) ?? m0);

    // 5) CLOCK, in both written forms, BEFORE the number tokenizer sees the separator.
    //    (a) The COLON form. The guard `(?![:\d])` / `(?<![\d:])` is load-bearing and was found by reading
    //        the corpus: nl_nl contains `4:41:30`, `2:11:60` and `1:09:02`, which are SPORTS TIMES, not
    //        clocks. Without the guard the rule would claim `4:41` and restart inside the rest.
    //    (b) The DOT form, which Dutch writes far more often (×15 vs ×5): `12.00 uur`, `07.19 uur`,
    //        `21.19 GMT`. It must run before the thousands de-grouping in the tokenizer, and it is
    //        distinguishable because grouping blocks are exactly THREE digits while a minute is two, and
    //        because the hour is range-checked — `802.11` and `figuur 1.1` both fail it.
    //    An existing `uur` is CAPTURED and reused rather than appended, so the reading is never doubled.
    const clock = (h: string, min: string, uur?: string): string => {
        const head = `${numberToWords(Number(h))}${uur ?? " uur"}`;
        return Number(min) === 0 ? head : `${head} ${numberToWords(Number(min))}`;
    };
    s = s.replace(/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![:\d])(\s*uur)?/gu,
        (_m, h: string, min: string, uur?: string) => clock(h, min, uur));
    s = s.replace(/(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d.,:])(\s*uur)?/gu,
        (_m, h: string, min: string, uur?: string) => clock(h, min, uur));

    // 6) SQUARED UNITS, BEFORE the shared symbol tier. That tier matches a unit only when a NUMBER is
    //    adjacent and its unit alternation has no `²`, so `3.850 km²` would have matched bare `km` and
    //    orphaned the superscript. The corpus writes both `km²` and the superscript-lost `km2`/`mi2`/`mm2`.
    s = s.replace(/(\d)\s?(km|mi|cm|mm|m)[²2](?![\p{L}\p{M}\d])/gu, (_m, d: string, u: string) =>
        `${d} vierkante ${({ km: "kilometer", mi: "mijl", cm: "centimeter", mm: "millimeter", m: "meter" } as Record<string, string>)[u]!}`);

    // 7) COMPOUND UNITS the shared tier cannot express (it matches one token, not a ratio). Dutch writes
    //    `km/u` (×4), not `km/h`; `m/s` ×1; `mph` ×1 in a gloss. Measure nouns stay SINGULAR after a
    //    numeral in Dutch ("83 kilometer per uur"), so there is no count agreement to carry.
    s = s.replace(/(\d)\s?km\/[uh](?![\p{L}\p{M}])/gu, "$1 kilometer per uur");
    s = s.replace(/(\d)\s?m\/s(?![\p{L}\p{M}])/gu, "$1 meter per seconde");
    s = s.replace(/(\d)\s?mph(?![\p{L}\p{M}])/gu, "$1 mijl per uur");

    // 8) DEGREES. `0°C` came out as the bare consonant *s*; `35°W` dropped the sign and left a lone `W`.
    //    The compass letters are expanded only DIRECTLY after a degree sign, where they cannot be anything
    //    else. AFTER step 7 so `m/s` is already gone, and after the clock so no `°` rule sees a time.
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gu, "$1 graden Celsius");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/gu, "$1 graden Fahrenheit");
    s = s.replace(/(\d)\s?°\s?([NOZW])(?![\p{L}\p{M}])/gu, (_m, d: string, c: string) =>
        `${d} graden ${({ N: "noord", O: "oost", Z: "zuid", W: "west" } as Record<string, string>)[c]!}`);
    s = s.replace(/(\d)\s?°/gu, "$1 graden");

    // 9) SIGNS. `+` ×2 (`UTC+1`, `+30°C`) — both were dropped entirely. No true minus sign occurs in
    //    nl_nl: every `-\d` there is a score or a range (`6-6`, `22:00-23:00`), which Dutch reads as the
    //    two bare numbers, so NO minus rule is written — inventing one would have turned 14 scores into
    //    negatives. AFTER step 8, so `+30°C` has already become `+30 graden Celsius`.
    s = s.replace(/\+\s?(?=\d)/gu, " plus ");

    // 10) AMPERSAND → *en*, which is simply how Dutch reads it (×4, all silently dropped before). The
    //     tight `X&Y` form (`P&R`, `B&B`) is spelled with LETTER NAMES, because the shared initialism pass
    //     claims runs of two or more capitals and so cannot see a single letter either side of the `&`.
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(?![\p{L}\p{M}])/gu, (m0, a: string, b: string) => {
        const x = spellCaps(a), y = spellCaps(b);
        return x !== undefined && y !== undefined ? `${x} en ${y}` : m0;
    });
    s = s.replace(/\s&\s/gu, " en ");

    // 11) FRACTIONS (×1: `1/5 inch`). Dutch builds these on the ordinal: 1/5 → *een vijfde*, 3/4 → *drie
    //     vierde*, and 1/2 is the suppletive *een half*. The trailing guard keeps a date or a ratio chain
    //     (`1/5/2020`) out. LAST, so no earlier rule has to work around a slash.
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        if (den === 2) return num === 1 ? "een half" : `${numberToWords(num)} halve`;
        const ord = ordinalWord(den);
        return ord === undefined ? m0 : `${numberToWords(num)} ${ord}`;
    });

    return s;
}
