/**
 * Fula (ff) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ FULA TEXT CARRIES ENGLISH ORDINAL DIGITS — `1st`, `3rd`, `16th`, `190th` — in its own dates and
 * centuries, because the written register is heavily English-influenced (miliyon, biliyon, kilometre, hour).
 * The Fula ordinal is the cardinal plus `-aɓal`, with `gootal` suppletive for 1. Unhandled, the English
 * suffix reads as a bare word ("st", "th").
 *
 * ⚠ THE CLOCK MIXES THREE SYSTEMS in one corpus: `1:15 a.m.`, 24-hour `0230 UTC`, and the Fula time-of-day
 * word (`9:30 fajiri`). A rule that assumes one of them silently mishandles the others.
 *
 * ⚠ WHY THE NUMBER RULES RUN HERE AND NOT IN THE TOKENIZER. The ordinal's spoken words must be plain text so
 * the word path stresses them; the comma-thousands and dot-decimal stay DIGITS so the shared symbol tier can
 * still see the number adjacent to its unit or sign. The tier is composed AFTER this pass in fula.ts, and the
 * TOKEN swallows the separators.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { BILLION, MILLION, numberToWords } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Fula letter names — the standard Boko alphabet, per the UNESCO Bamako alphabet. A letter's name is the
 *  letter plus -a (ba, ca, da, fa …), which is the conventional way Fula spells an initial. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "ba", c: "ca", d: "da", e: "e", f: "fa", g: "ga", h: "ha", i: "i", j: "ja",
    k: "ka", l: "la", m: "ma", n: "na", o: "o", p: "pa", q: "ka", r: "ra", s: "sa", t: "ta",
    u: "u", v: "va", w: "wa", x: "eka", y: "ya", z: "za", "ɓ": "ɓa", "ɗ": "ɗa", "ŋ": "ŋa",
    "ɲ": "ɲa", "ƴ": "ƴa",
};

/** Fula phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableFula = makeUnreadableTest({
    vowels: /[aeiouɓɗŋɲƴ]/u,
    legalOnsets: new Set([
        "mb", "nd", "nj", "ng", "ny", "ƴ", "ɓ", "ɗ", "h", "j", "k", "l", "m", "n", "p", "r",
        "s", "t", "w", "y",
        "ch", "sh", "ts", "dy", "kw", "br", "gr", "pr", "tr", "sk", "fr", "st",
    ]),
    legalCodas: new Set([
        "b", "d", "f", "g", "h", "k", "l", "m", "n", "p", "r", "s", "t", "w", "y", "mb", "nd",
        "ng", "nj", "ny",
        "ks", "sk", "ns", "ms", "ls", "sh", "ll", "st", "ts",
    ]),
    // ONE phoneme each — see PhonotacticsData.digraphs.
    digraphs: new Set(["mb", "nd", "ng", "nj", "ny", "ch", "sh", "ɓ", "ɗ", "ƴ"]),
});

/** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["nasa", "eua"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l.toLowerCase()],
    acronymLetters: new Set([
        "mri", "oha", "acma", "rem", "us", "usa", "usaf", "fbi", "cia", "nsa", "faa", "bbc",
        "cnn", "cbs", "nba", "nfl", "nhl", "mlb", "mls", "gps", "dna", "hiv", "aids", "pdf", "dvd",
        "cd", "tv", "pc", "h5n1", "a1gp", "u.s.", "u.s", "un", "eu",
    ]),
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableFula,
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE FULA ORDINAL
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ordinal 1–9: the cardinal stem + -aɓal (gootal is SUPPLETIVE for 1; ɗiɗaɓal/tataɓal/nayaɓal attested
 *  by Omniglot; the 5–9 quinary stems joy-/jeeg-/jeeɗiɗ-/jeetat-/jeenay- are the same stems as the
 *  cardinals minus their final vowel). The corpus's English ordinal digits (1st, 16th, 190th) read
 *  through this. */
const ORD_1_9: Readonly<Record<number, string>> = {
    1: "gootal", 2: "ɗiɗaɓal", 3: "tataɓal", 4: "nayaɓal", 5: "joyaɓal",
    6: "jeegaɓal", 7: "jeeɗiɗaɓal", 8: "jeetataɓal", 9: "jeenayaɓal",
};

/** The ordinal of a CARDINAL WORD when it ends a compound: the cardinal stem (final vowel dropped) +
 *  -aɓal. Table for the unit/tens words the compositor emits; anything else is left untouched. */
const STEM_ORD: Readonly<Record<string, string>> = {
    goo: "gootal", ɗiɗi: "ɗiɗaɓal", tati: "tataɓal", nayi: "nayaɓal", joyi: "joyaɓal",
    jeegom: "jeegaɓal", jeeɗiɗi: "jeeɗiɗaɓal", jeetati: "jeetataɓal", jeenayi: "jeenayaɓal",
    sappo: "sappaɓal", noogaas: "noogaasaɓal", cappanɗe: "cappanɗaɓal", teemedere: "teemederaɓal",
    teemedde: "teemeddaɓal", ujundere: "ujunderaɓal", ujunaaje: "ujunajaɓal",
    // ⚠ DERIVED FROM THE COMPOSITOR'S OWN CONSTANTS, not hand-copied. These two rows previously read
    // `miliyon: "miliyonaɓal", milion: "milionaɓal"` while numbers.ts emitted `million` and `milyar`,
    // so neither key could ever match and `ordinalWords` returned undefined for exactly 1e6 and 1e9 —
    // the only magnitudes where the magnitude word is itself the LAST word (2e6 is `milionji ɗiɗi`, and
    // the multiplier carries the ordinal). Deriving them means a rename in numbers.ts cannot silently
    // recreate the dead rows. The stem rule is the documented one and needs no new orthography: these
    // loans are consonant-final, so there is no vowel to drop and the suffix simply attaches.
    [MILLION]: `${MILLION}aɓal`, [BILLION]: `${BILLION}aɓal`,
};

/**
 * Integer → the Fula ordinal: the cardinal with the LAST element's ordinal (sappo e jeegaɓal = 16th,
 * teemedere e cappanɗe jeenayaɓal = 190th). gootal is the suppletive 1st. Anything with a digit (out of
 * the compositor's range) → undefined.
 */
export function ordinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1 || n >= 1e12) return undefined;
    if (n <= 9) return ORD_1_9[n];
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const words = card.split(" ");
    const last = words[words.length - 1]!;
    const ord = STEM_ORD[last];
    if (ord === undefined) return undefined;
    words[words.length - 1] = ord;
    return words.join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Fula input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeFula(input: string): string {
    let s = input;

    // 1) HTML ENTITIES — the corpus's one `&amp;` reads "e" (and). FIRST, before the ampersand rule.
    s = s.replace(/&amp;/giu, " e ");

    // 1b) CURRENCY PREFIXES — `AUD$45`, `uS$14.7` (the corpus's Australian/US dollar glued forms). The
    //     bare `$` is the tier's; the glued prefix names the country. AFTER &amp;, BEFORE the number rules.
    s = s.replace(/(?<![\p{L}\p{M}])AUD\$?(?=\s?\d)/giu, "dollar Awstraliya ");
    s = s.replace(/(?<![\p{L}\p{M}])(?:US|uS)\$?(?=\s?\d)/giu, "dollar Amerik ");

    // 2) ERA MARKERS — `1000B.C.` (before Christ). The corpus's B.C. is attached to the year. Read the
    //    year, then "ɓawo jibineede Iisaa" (before the birth of Christ) — or the simpler Fula "ɓawo".
    //    The referee lacks an era word; "ɓawo" (before) is corpus-attested and unambiguous here.
    s = s.replace(/(?<!\d)(\d[\d,]*)B\.?C\.?(?![\p{L}\p{M}])/giu, "$1 ɓawo");

    // 3) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
    //    `George W. Bush` — the W. suffix dot is a break.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));  // space, NBSP
    //    ⚠ `\p{Lu}`, NOT `[A-Z]`, which is the line above's class dropped to ASCII on the way past —
    //    the same trap as `[^\W\d_]`, in the spelling that looks least like a mistake. Six languages
    //    carried this line verbatim and every one of them has capitals outside ASCII; here it is
    //    Fula's own ⟨Ɓ Ɗ Ŋ Ƴ⟩. The minimal pair, measured before the fix:
    //        "A. Boyi"  → "A Boyi"
    //        "A. Ɓoyi"  → unchanged   ← the dot survives as a spurious clause break
    s = s.replace(/(?<=\p{Lu})\.(?=\s+\p{Lu})/gu, "");

    // 4) ORDINALS — the `Nst`/`Nnd`/`Nrd`/`Nth` English ordinal form (the corpus's dates/centuries).
    //    Read the Fula ordinal. BEFORE the clock rule so a digit run is not first claimed as a time.
    s = s.replace(/(?<![\d.,])(\d[\d,]*)(st|nd|rd|th)(?![\p{L}\p{M}])/giu, (m0, d: string, sfx: string) => {
        const n = Number(d.replace(/,/gu, ""));
        if (!Number.isFinite(n) || n < 1) return m0;
        const ord = ordinalWords(n);
        return ord === undefined ? m0 : ord;
    });

    // 5) RANGES and SCORES — `7-2`, `5-3`, `1995-96`, `1644-1912`, `2-3km`. Fula reads these with
    //    `haa` (up to) — the corpus's own infix joiner, 12 instances of it ("haa wakkati gulɗum", "haa
    //    dou"). NOT `hakkunde`: that word is attested too, but as a PREPOSITION taking both operands —
    //    the corpus writes "hakkunde India be Pakistan" (between X and Y), never "X hakkunde Y", so an
    //    infix `N hakkunde M` is the wrong construction for all twelve of the corpus's ranges.
    //    A leading minus stays a sign (handled later).
    // ⚠ EACH OPERAND MUST END ON A DIGIT. `(\d[\d,]*)` also accepts a trailing separator, so in
    //    `1, -2` the left operand matched `1,` — the sentence comma — and `\s*` then reached the minus
    //    and read a RANGE where the text has a negative number: *one, up to two*. Same trailing-separator shape as
    //    the tokenizer bug closed in #1015. With the operand anchored on a digit, `\s*` can no longer
    //    straddle the comma and the rule declines, leaving the sign rule to claim `-2`.
    s = s.replace(/(?<![\d.,])(\d(?:[\d,]*\d)?)\s*[-–]\s*(\d(?:[\d,]*\d)?)(?![\d.])/gu, "$1 haa $2");

    // 5b) GLUED CLOCK SUFFIX — `11:00nje` (the Fula locative -nje "at"; the corpus's only glued
    //     instance). The suffix is a separate word, not glued to the time; spaced out so the clock rule
    //     reads the time, then "nje" follows. ONLY the attested -nje (⚠ no unattested guard
    //     alternatives — -na/-ni/-nde never occur glued to a time in this corpus).
    s = s.replace(/(?<![\d.,])(\d{1,2}):(\d{2})(nje)(?![\p{L}\p{M}])/giu, "$1:$2 $3");

    // 6) CLOCK, in the COLON form. `1:15 a.m.` → goo e sappo e joyi a.m.; `9:30 fajiri` → … fajiri.
    //    The 24h `0230 UTC` is handled here too (a leading 0 makes it a 4-digit time). The a.m./p.m.
    //    marker expands to the Fula time-of-day: `fajiri` (dawn) is corpus-attested ×4, and `kikiiɗe`
    //    (afternoon/evening) — carried here as a STATED ASSUMPTION, because it appears in neither
    //    the corpus nor the epitran referee's word list — is now ATTESTED on ff.wikipedia, in exactly this
    //    slot: "yiite ngee yani ko hedde waktu 23ɓo kikiiɗe" ("the fire fell at about hour 23 kikiiɗe"),
    //    a clock time with the marker attached. Three corpus clocks depended on the assumption; the wiki
    //    tier did not exist when this rule was written, and it settles the question. NOT a sports
    //    time: a THIRD `\d.\d\d` field (4:41.30) means a pace. The trailing marker is captured WITHOUT
    //    eating the space before a following word (trap: a bare `\s*` glued "tati fajiri" → "tatifajiri").
    s = s.replace(/(?<![\d:,])(\d{1,2}):(\d{2})(?![:.\d])(?:\s*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?))?/giu,
        (m0, h: string, min: string, ap: string) => {
            const hv = Number(h), mv = Number(min);
            if (hv > 23 || mv > 59) return m0;
            const head = mv === 0 ? numberToWords(hv) : `${numberToWords(hv)} e ${numberToWords(mv)}`;
            const apLower = (ap ?? "").toLowerCase();
            const suffix = apLower.startsWith("p") ? " kikiiɗe" : apLower.startsWith("a") ? " fajiri" : "";
            return `${head}${suffix}`;
        });

    // 6b) CLOCK, in the DOT form before a timezone — `15.00 UTC`. The dot is otherwise a decimal;
    //     a timezone after the two-digit minutes marks a clock.
    s = s.replace(/(?<![\d.,])(\d{1,2})\.(\d{2})\s*(UTC|GMT)/giu,
        (m0, h: string, min: string, tz: string) => {
            const hv = Number(h), mv = Number(min);
            const head = mv === 0 ? numberToWords(hv) : `${numberToWords(hv)} e ${numberToWords(mv)}`;
            return `${head} ${tz}`;
        });

    // 7) VERSION DOTS and DOT DECIMALS — `1.5 million`, `3.50`, `2.3`, `12.8km`, `802.11n`, `2.4Ghz`.
    //    The dot is a DECIMAL (the corpus follows English; thousands use COMMAS). Read "toɓɓere" (dot —
    //    the Fula word for a point/spot), the fraction digit-by-digit. GIGAHERTZ is claimed FIRST on the
    //    raw digits, because this rule converts the fraction to WORDS the Ghz rule can no longer see.
    //    AFTER the clock.
    s = s.replace(/(?<![\d.,])(\d+\.\d+)\s?Ghz?(?![\p{L}\p{M}])/giu, "$1 gigahertz");
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)\s?(km|m|kg|mm|cm|mph|kph)(?![\p{L}\p{M}])/giu,
        (m0, i: string, f: string, u: string) =>
            `${i} toɓɓere ${[...f].map((d) => numberToWords(Number(d))).join(" ")} ${({ km: "kilometre", m: "metre", kg: "kilogram", mm: "milimeta", cm: "santimeta", mph: "miles e wakkati gootel", kph: "kilometre e wakkati gootel" } as Record<string, string>)[u.toLowerCase()]!}`);
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d.])/giu, (m0, i: string, f: string) =>
        `${i} toɓɓere ${[...f].map((d) => numberToWords(Number(d))).join(" ")}`);

    // 7c) COMMA-DECIMALS — `12,5`. Fula follows English (comma = thousands, dot = decimal), so a
    //     comma-decimal is corpus-absent — but it must not LEAK the comma as a clause pause. A comma
    //     followed by a THREE-digit group is thousands (2,243) and stays for the TOKEN; this claims
    //     only 1-2 digit fractions.
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (m0, i: string, f: string) =>
        `${i} toɓɓere ${[...f].map((d) => numberToWords(Number(d))).join(" ")}`);

    // 8) FRACTIONS. `1/5 inch` → *goo e joyi* (the corpus's one fraction, read as a ratio).
    //    ⚠ THE ¾/½ ARMS ARE GONE, and removing them is a fix rather than a tidy-up. They were dead in the
    //    pipeline — `Unicode.foldVulgarFractions` rewrites `1¾`→`1 3/4` before this pass runs, so the
    //    ratio arm above already handles them and gives *goo tati e nayi*, the same reading the corpus's
    //    only attested fraction gets. But they were still reachable through the exported `normalizeFula`,
    //    and what they produced there was wrong: `$1 e teemedere` is character-for-character the PERCENT
    //    phrase built two steps below, so `1¾` read as *one per hundred*. The ½ arm's `hecci` is ×0 in
    //    both corpora — unsourced as well as unreachable. Two authored readings, one wrong and one
    //    unsourced, standing in front of a correct upstream fold.
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) =>
        `${numberToWords(Number(a), a)} e ${numberToWords(Number(b), b)}`);

    // 9) DEGREES. `30°C` came out as the bare consonant [tʃ]. `digiri` is the degree word.
    s = s.replace(/(\d)\s?[°º]\s?C(?![\p{L}\p{M}])/giu, "$1 digiri Celsius");
    s = s.replace(/(\d)\s?[°º]\s?F(?![\p{L}\p{M}])/giu, "$1 digiri Fahrenheit");
    s = s.replace(/(\d)\s?[°º](?![\p{L}\p{M}])/gu, "$1 digiri");

    // 10) RATES — `160km/h`, `133m/s`, `480 km/h`, `300mph`, `64kph`. The corpus's "miles per hour"
    //     is already text; the unit/unit forms need "e wakkati gootel" (in one hour). The corpus also
    //     writes the TYPO `16okm/h` for 160km/h (the "o" is a stray 0-letter). mph/kph are handled here
    //     (glued to the number). AFTER the version-dot rule (12.8km has already been claimed), BEFORE
    //     the tier.
    //     ⚠ ONLY `/h`. This arm used to claim `(h|s)` and choose the trailing word with
    //     `d === "h" ? "gootel" : "gootel"` — two identical branches, so `133m/s` (a real corpus line,
    //     `480 km/h (133m/s; 300mph)`, one wind speed glossed three ways) asserted *per hour*. `gootel`
    //     agrees with `wakkati`'s noun class and the form for `sahaawa` is unsourced; see fula.ts.
    s = s.replace(/(?<!\d)(\d+)\s?(km|m|kg|mm|cm)\s*\/\s*(h)(?![\p{L}\p{M}])/giu,
        (m0, n: string, u: string) =>
            `${numberToWords(Number(n), n)} ${({ km: "kilometre", m: "metre", kg: "kilogram", mm: "milimeta", cm: "santimeta" } as Record<string, string>)[u.toLowerCase()]!} e wakkati gootel`);
    s = s.replace(/(?<!\d)(\d+)\s?(mph|kph)(?![\p{L}\p{M}])/giu,
        (m0, n: string, u: string) =>
            `${numberToWords(Number(n), n)} ${u.toLowerCase() === "mph" ? "miles e wakkati gootel" : "kilometre e wakkati gootel"}`);
    s = s.replace(/(?<!\d)(\d+)o\s?(km\/h)(?![\p{L}\p{M}])/giu,
        (m0, n: string, u: string) =>
            `${numberToWords(Number(n), n)} kilometre e wakkati gootel`);

    // 11) GIGAHERTZ — handled in step 7 on the raw digits (before the fraction becomes words).

    // 12) SIGNS. `4×4` — the × reads "je" (with/and, the corpus's conjunction). `&` → *e* (and).
    //     A TRUE minus (`-5`) reads "usta" (to reduce, corpus ×7): the corpus has ZERO leading minuses —
    //     verified with this rule's own guard — so no reading depends on the choice, and an attested word
    //     that means "reduce" beats an unattested one. `=` reads "fota" (to be equal, corpus ×2 in exactly
    //     that sense: "ɗum fotan be …"). `%` reads *e teemedere* (in a hundred), composed from two attested
    //     pieces rather than asserted as one — see the header's SOURCING note. The percent rule also has to
    //     catch the WORD form, since by this point the dot rule has turned `3.5%` into words.
    s = s.replace(/\+\s?(?=\d)/gu, " e gooto ");
    // ⚠ U+2212 IS IN THE CLASS AND THE ASCII HYPHEN'S GUARDS ARE UNCHANGED. The MINUS SIGN is a distinct
    // code point whose only Unicode meaning is the arithmetic operator, and it is not on any keyboard —
    // whoever typed it meant a minus. It is not attested in this language's mined corpus, which is why an
    // earlier sweep declined it as invention; the character's identity is the evidence, not the corpus, and
    // dropping a sign INVERTS the value it belongs to. The hyphen is the ambiguous one and keeps every
    // guard it had: leading position only, so a range (`1838−1917`) and a negative exponent (`10−19`) are
    // still refused by the lookbehind.
    s = s.replace(/(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])/gu, "usta $1");
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(s?)(?![\p{L}\p{M}])/gu,
        (_m, a: string, b: string, pl: string) =>
            `${LETTER_NAME[a.toLowerCase()] ?? a} e ${LETTER_NAME[b.toLowerCase()] ?? b}${pl}`);
    s = s.replace(/\s&\s/gu, " e ");
    s = s.replace(/(\d)\s*×\s*(\d)/gu, "$1 je $2");
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 fota $2");
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 famɗi $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 ɓuri $2");
    s = s.replace(/(\d+(?: toɓɓere [\p{L}\p{M}]+)+|[\p{L}\p{M}]+ toɓɓere [\p{L}\p{M}]+|\d+)\s*%\s*(?![\p{L}\p{M}])/gu, "$1 e teemedere");

    // 13) INITIALISMS, LAST of the letter rules: it must run after the era markers (else B.C. → *ba.
    //     ca.*) and after the dotted-capital rule.
    s = normalizeInitialisms(s);

    return s;
}
