/**
 * Hausa (ha) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE PERCENT WORD PRECEDES THE NUMBER: Hausa's register is "kashi 80%" (kashi = portion), so this is a
 * PREPOSED reading, not the postposed one most of the fleet uses.
 *
 * ⚠ THE CLOCK MARKERS ARE HAUSA WORDS, not a.m./p.m.: `na safe` (morning) and `na yamma` (evening) attach to
 * a colon clock, and 24-hour forms arrive with a timezone instead (`12.00 GMT`). A rule that assumes one of
 * the three silently mishandles the others.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords as hausaNumber } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Hausa phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableHausa = makeUnreadableTest({
    vowels: new RegExp(`[${MANIFEST.phonotactics.vowels}]`, "u"),
    legalOnsets: new Set(MANIFEST.phonotactics.onsets),
    legalCodas: new Set(MANIFEST.phonotactics.codas),
});
/** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["opec", "un", "nasa", "aids", "laser", "covid"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => MANIFEST.letterNames[l.toLowerCase()],
    acronymLetters: new Set([
        "aol", "au", "pstn", "a1gp", "gps", "npws", "oha", "unaids", "ungu", "nc", "nsw", "xdr-tb",
        "h5n1", "dna", "hiv", "dvd", "cd", "tv", "pc", "pdf", "fbi", "cia", "nsa", "faa", "bbc",
        "cnn", "cbs", "nbc", "itv", "mri", "ms",
    ]),
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableHausa,
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Hausa input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeHausa(input: string): string {
    let s = input;

    // 1) HTML ENTITIES — the corpus's one `&amp;` reads "da" (and). FIRST, before the ampersand rule.
    s = s.replace(/&amp;/giu, " da ");

    // 2) ERA MARKERS — `1000 B.C.`, `10,000 BCE`. The corpus's B.C./BCE read "kafin haihuwar Yesu"
    //    (before the birth of Jesus). The corpus's ONE instance writes "1000 B.C.kafin zuwan" — the
    //    "kafin" (before) already follows, so B.C. is redundant there and is removed (else a double
    //    "kafin kafin"). The bare BCE cases expand.
    s = s.replace(/B\.?C\.?(?=\.?kafin)/giu, "");
    s = s.replace(/(?<![\p{L}\p{M}])B\.?C\.?E?\.?(?![\p{L}\p{M}])/giu, "kafin haihuwar Yesu");

    // 3) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
    //    `George W. Bush` — the W. suffix dot is a break. `Roe v. Wade` — the v. is a dotted lowercase.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));  // space, NBSP
    //    ⚠ `\p{Lu}`, NOT `[A-Z]`, which is the line above's class dropped to ASCII on the way past —
    //    the same trap as `[^\W\d_]`, in the spelling that looks least like a mistake. Six languages
    //    carried this line verbatim and every one of them has capitals outside ASCII; here it is
    //    Hausa's own hooked ⟨Ɓ Ɗ Ƙ⟩. The minimal pair, measured before the fix:
    //        "M. Bello"    → "M Bello"
    //        "M. Ɗanjuma" → unchanged   ← the dot survives as a spurious clause break
    s = s.replace(/(?<=\p{Lu})\.(?=\s+\p{Lu})/gu, "");
    // `v.` in a legal case name (Roe v. Wade) reads "da" (and). The v. sits between two NAMES, not two
    // initials, so match a word-boundary "v." with a capital following (Wade).
    s = s.replace(/(?<=\p{L})\s+v\.\s+(?=[A-Z])/gu, " da ");

    // 3b) CURRENCY PREFIXES — `US$14.7`, `US $ 30` (the corpus's US dollar glued AND spaced forms). The
    //     bare `$` is the tier's; the US prefix names the currency. AFTER the era markers.
    //     The word is `dala` — the corpus's own "dalar Amurka" and "biliyoyin dalolin Amurka" — not the
    //     English `dollar`, which is attested nowhere. Same fix as the tier's `$` entry in hausa.ts.
    s = s.replace(/(?<![\p{L}\p{M}])(?:US|uS)\s?\$\s?(?=\d)/giu, "dala ");

    // 4) RANGES and SCORES — `2-3 km`, `5-3`, `1644-1912`, `2-5`. Hausa reads these with "zuwa" (to)
    //     or just two numbers. The corpus's prose uses "daga X zuwa Y". A leading minus stays a sign.
    //     A DECIMAL range needs its own rule and has to come FIRST: the plain-range lookbehind `(?<![\d.,])`
    //     blocks a digit that follows a dot, so `4.2-3.9 miliyan` — the corpus's one decimal range — never
    //     matched, the decimal rule then turned each side into words, and the hyphen was dropped with no
    //     joiner at all (*huɗu maki biyu uku maki tara*).
    s = s.replace(/(?<![\d.,])(\d+\.\d+)\s*[-–]\s*(\d+\.\d+)(?![\d.])/gu, "$1 zuwa $2");
    s = s.replace(/(?<![\d.,])(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)(?![\d.])/gu, "$1 zuwa $2");

    // 5) CLOCK, in the COLON form. `8:46 na safe` → takwas da arba'in da shida na safe; `11:29` → goma
    //     sha ɗaya da ashirin da tara. The corpus's own "na safe"/"na yamma" (a.m./p.m.) stay. The
    //     English p.m./a.m. markers expand. NOT a sports time: a THIRD `\d.\d\d` field (4:41.30) means
    //     a pace. The marker is captured WITHOUT eating the space before it (the clock-glue trap).
    s = s.replace(/(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?:\s*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?))?/giu,
        (m0, h: string, min: string, ap: string) => {
            const hv = Number(h), mv = Number(min);
            if (hv > 23 || mv > 59) return m0;
            const head = mv === 0 ? hausaNumber(hv) : `${hausaNumber(hv)} da ${hausaNumber(mv)}`;
            const apLower = (ap ?? "").toLowerCase();
            const suffix = apLower.startsWith("p") ? " na yamma" : apLower.startsWith("a") ? " na safe" : "";
            return `${head}${suffix}`;
        });

    // 6) CLOCK, in the DOT form before a timezone — `12.00 GMT`, `15.00 UTC`. The dot is otherwise a
    //     decimal; a timezone after the two-digit minutes marks a clock.
    s = s.replace(/(?<![\d.,])(\d{1,2})\.(\d{2})\s*(UTC|GMT)/giu,
        (m0, h: string, min: string, tz: string) => {
            const hv = Number(h), mv = Number(min);
            const head = mv === 0 ? hausaNumber(hv) : `${hausaNumber(hv)} da ${hausaNumber(mv)}`;
            return `${head} ${tz}`;
        });

    // 7) VERSION DOTS and DOT DECIMALS — `1.1`, `1.5`, `2.8`, `12.8`, `Hoto na 1.1`, `2.8 miliyan`. The
    //     dot is a DECIMAL (the corpus follows English; thousands use COMMAS). Read "da rabi" (and a
    //     half) for a .5 fraction, "da kwata" for .25/.75, or the digit-by-digit "maki" (point). The
    //     corpus's only dot-decimals are 1.1, 1.5, 2.8, 12.8; "maki" is the Hausa word for "point".
    //     AFTER the clock.
    s = s.replace(/(?<![\d.,])(\d+\.\d+)\s?Ghz?(?![\p{L}\p{M}])/giu, "$1 gigahertz");
    // Longest-first alternation: km/h and m/s must win over the bare km/m.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)\s?(km\/h|m\/s|km\/u|mph|mil\/awa|km|m|kg|mm|cm)(?![\p{L}\p{M}])/giu,
        (m0, i: string, f: string, u: string) =>
            `${i} maki ${[...f].map((d) => hausaNumber(Number(d))).join(" ")} ${({ km: "kilomita", m: "mita", kg: "kilogram", mm: "milimita", cm: "santimita", "km/h": "kilomita a awa", "km/u": "kilomita a awa", "m/s": "mita a daƙiƙa", mph: "mil a awa", "mil/awa": "mil a awa" } as Record<string, string>)[u.toLowerCase()]!}`);
    // A VERSION LETTER after the fraction (802.11n) is a separate letter — emit it spaced.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?=[a-z](?![\p{L}\p{M}]))/giu,
        (m0, i: string, f: string) =>
            `${i} maki ${[...f].map((d) => hausaNumber(Number(d))).join(" ")} `);
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d.])/giu, (m0, i: string, f: string) =>
        `${i} maki ${[...f].map((d) => hausaNumber(Number(d))).join(" ")}`);

    // 7c) COMMA-DECIMALS — `12,5`. Hausa follows English (comma = thousands, dot = decimal), so a
    //     comma-decimal is corpus-absent — but it must not LEAK the comma as a clause pause. A comma
    //     followed by a THREE-digit group is thousands (6,387) and stays for the TOKEN; this claims
    //     only 1-2 digit fractions.
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (m0, i: string, f: string) =>
        `${i} maki ${[...f].map((d) => hausaNumber(Number(d))).join(" ")}`);

    // 8) FRACTIONS. `4/4` (the corpus's four-wheel drive) reads "hudu-hudu"; `inci 1/5` (one fifth of
    //     an inch) reads "ɗaya bisa biyar" (one over five). The corpus's two fractions are 4/4 and 1/5.
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) =>
        `${hausaNumber(Number(a))} bisa ${hausaNumber(Number(b))}`);

    // 9) DEGREES. `30°C` came out as the bare consonant [tʃ]; `35°W` is a LONGITUDE. "digiri" is the
    //     degree word. The compass letters N/S/E/W read their Hausa words.
    s = s.replace(/(\d)\s?[°º]\s?C(?![\p{L}\p{M}])/giu, "$1 digiri Celsius");
    s = s.replace(/(\d)\s?[°º]\s?F(?![\p{L}\p{M}])/giu, "$1 digiri Fahrenheit");
    s = s.replace(/(\d)\s?[°º]\s?([NSEW])(?![\p{L}\p{M}])/giu,
        (_m, d: string, c: string) =>
            `${d} digiri ${({ N: "arewa", S: "kudu", E: "gabas", W: "yamma" } as Record<string, string>)[c.toUpperCase()]!}`);
    s = s.replace(/(\d)\s?[°º](?![\p{L}\p{M}])/gu, "$1 digiri");

    // 10) RATES — `160km / h`, `480 km/h`, `133 m/s`, `300 mph`, `600Mbit/s`, `64 kph`, `100-200
    //     mil/awa`. The corpus's own prose "mil/awa" (miles per hour) is text; the unit/unit forms need
    //     "a awa" (per hour). AFTER the version-dot rule (12.8km has been claimed), BEFORE the tier.
    s = s.replace(/(?<!\d)(\d+)\s?(km|m|kg|mm|cm)\s*\/\s*(h|s|u)(?![\p{L}\p{M}])/giu,
        (m0, n: string, u: string, d: string) =>
            `${hausaNumber(Number(n))} ${({ km: "kilomita", m: "mita", kg: "kilogram", mm: "milimita", cm: "santimita" } as Record<string, string>)[u.toLowerCase()]!} a ${d.toLowerCase() === "h" || d.toLowerCase() === "u" ? "awa" : "daƙiƙa"}`);
    s = s.replace(/(?<!\d)(\d+)\s?(mph|kph|mil\/awa)(?![\p{L}\p{M}])/giu,
        (m0, n: string, u: string) =>
            `${hausaNumber(Number(n))} ${u.toLowerCase() === "kph" ? "kilomita" : "mil"} a awa`);
    s = s.replace(/(?<!\d)(\d+)\s?Mbit\/s(?![\p{L}\p{M}])/giu, (m0, n: string) =>
        `${hausaNumber(Number(n))} megabit a daƙiƙa`);

    // 10b) THE UNIT SYMBOL BEFORE ITS NUMERAL — `km 2-3`, and this is HAUSA'S OWN ORDER, not a typo.
    //     The shared tier fires only AFTER a numeral, so `mai nisan km 2-3 ya rufe shi` left `km` in the
    //     IPA as raw ASCII — the artifact's one genuine unit leak, and invisible to every gate but the
    //     raw-Latin one, since a Latin run in a Latin-script language looks like a word.
    //     ⚠ THE ORDER IS MEASURED, NOT ASSUMED. This artifact writes the SPELLED-OUT noun in exactly this
    //     position five times — `kilomita 1`, `kilomita 7` ×2, `kilomita 2` ×2 — against one abbreviated
    //     `km 2`. Hausa puts the measure noun in front of its count, and the corpus is consistent about it;
    //     the abbreviation is simply the one spelling the tier could not reach.
    //     ⚠ SO THE NUMBER IS LEFT WHERE IT STANDS and only the symbol is spelled out. Rewriting to
    //     `2-3 kilomita` would "fix" the leak by imposing the tier's digit-first order on a language whose
    //     own corpus writes the other one; the point is to say the noun, not to move the count.
    //     ⚠ MULTI-LETTER, VOWEL-FREE, EXACT CASE — trap 46 and `isBareUnitKey`'s argument. A bare `m`
    //     collides with far too much to claim on a following digit alone, and upper-case `KM`/`Cm` are
    //     mostly not units at all; both are ×0 here, so neither is guessed at.
    //     ⚠ AFTER THE RANGE STEP, which has already turned `2-3` into `2 zuwa 3`. Run before it and the
    //     lookahead would have to admit the hyphen and would then also match a compound designation.
    s = s.replace(/(?<![\p{L}\p{M}\p{Nd}])(km|kg|mm|cm)(?=\s\p{Nd})/gu,
        (_m, u: string) => ({ km: "kilomita", kg: "kilogram", mm: "milimita", cm: "santimita" })[u]!);

    // 11) SIGNS. `+30°C` — the plus was dropped. `&` → *da* (and). A TRUE minus (`-5`) reads "rashin";
    //     the corpus's `-\d` are all ranges/scores, now handled above. `%` → *kashi* (the tier's prefix).
    s = s.replace(/\+\s?(?=\d)/gu, " ƙari ");
    // ⚠ U+2212 IS IN THE CLASS AND THE ASCII HYPHEN'S GUARDS ARE UNCHANGED. The MINUS SIGN is a distinct
    // code point whose only Unicode meaning is the arithmetic operator, and it is not on any keyboard —
    // whoever typed it meant a minus. It is not attested in this language's mined corpus, which is why an
    // earlier sweep declined it as invention; the character's identity is the evidence, not the corpus, and
    // dropping a sign INVERTS the value it belongs to. The hyphen is the ambiguous one and keeps every
    // guard it had: leading position only, so a range (`1838−1917`) and a negative exponent (`10−19`) are
    // still refused by the lookbehind.
    s = s.replace(/(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])/gu, "rashin $1");
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(s?)(?![\p{L}\p{M}])/gu,
        (_m, a: string, b: string, pl: string) =>
            `${MANIFEST.letterNames[a.toLowerCase()] ?? a} da ${MANIFEST.letterNames[b.toLowerCase()] ?? b}${pl}`);
    s = s.replace(/\s&\s/gu, " da ");
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 daidai $2");
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 kasa da $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 fiye da $2");
    s = s.replace(/(\d)\s*×\s*(\d)/gu, "$1 sau $2");
    // A PERCENT after a DECIMAL — `3.5%`. The dot rule has converted the number to words by now, so the
    // tier's digit-adjacent kashi would miss it; claim the word-form percent here (the decimal-percent
    // leak). The bare-digit `%` is the tier's. NOT when "kashi" already precedes (the corpus writes
    // "kashi 3.5%" — adding another kashi would double it).
    s = s.replace(/(?<![kK]ashi\s+)([\p{L}\p{M}\d]+ maki [\p{L}\p{M} ]+?)\s*%\s*(?![\p{L}\p{M}])/gu, "kashi $1");

    // 12) INITIALISMS, LAST of the letter rules: it must run after the era markers (else B.C. → *ba.
    //     ca.*) and after the dotted-capital rule.
    s = normalizeInitialisms(s);

    // A padded replacement (` ƙari `, ` da `) doubles a space that was already there and can leave one at
    // an edge (`+30°C` → ` ƙari …`). SLOT-GAP is a defect class; this pass should not feed it.
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
