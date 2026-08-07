/**
 * Catalan (ca) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE ORDINAL IS A NUMERAL PLUS A LETTER SUFFIX that agrees in gender and number — `7è`, `7a`, `1r`, `2n`,
 * `190a`. Left unhandled the suffix reads as a bare word ("sˈɛt ˈɛ"), so the rule has to consume it and pick
 * the agreeing form rather than merely strip it.
 *
 * ⚠ A ROMAN NUMERAL IN A CENTURY IS A CARDINAL IN CATALAN — `segle XVIII` is *divuit*, not an ordinal. That
 * is the opposite of Russian, Polish and Italian, and it is why ca is excluded from the shared ordinal path.
 *
 * ⚠ WHY THE NUMBER RULES RUN HERE AND NOT IN THE TOKENIZER. The ordinal's spoken words must be plain text so
 * the word path stresses them; the dot-thousands, the comma decimal and the version dot stay DIGITS so the
 * shared symbol tier can still see the number adjacent to its unit or sign. The tier is composed AFTER this
 * pass in catalan.ts, and the TOKEN swallows the separators.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Catalan ordinal words 1–10, masculine. Irregular below ten; the feminine is -a (primera, segona,
 *  tercera, quarta, cinquena, sisena, setena, vuitena, novena, desena). */
const ORD_MASC_1_10: readonly string[] = [
    "", "primer", "segon", "tercer", "quart", "cinquè", "sisè", "setè", "vuitè", "novè", "desè",
];
const ORD_FEM_1_10: readonly string[] = [
    "", "primera", "segona", "tercera", "quarta", "cinquena", "sisena", "setena", "vuitena", "novena", "desena",
];

/**
 * Integer → the Catalan ordinal (masculine or feminine). Below 10 the irregular table; from 10 up the
 * cardinal + -è / -ena on the LAST word (vint → vintè/vintena, quaranta → quarantè, vint-i-cinc →
 * vint-i-cinquè). Only the last element of a compound takes the ending.
 */
export function ordinalWords(n: number, fem = false): string | undefined {
    if (!Number.isSafeInteger(n) || n < 1) return undefined;
    if (n <= 10) return fem ? ORD_FEM_1_10[n] : ORD_MASC_1_10[n];
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const words = card.split(" ");
    let stem = words[words.length - 1]!;
    // The irregular under-ten stems stay when they end a compound: vint-i-un → vint-i-primer.
    const small = fem ? ORD_FEM_1_10 : ORD_MASC_1_10;
    if (n % 10 !== 0 && n % 10 < 10 && n % 100 > 10) {
        const u = n % 10;
        const tail = u < 10 ? ["", "un", "dos", "tres", "quatre", "cinc", "sis", "set", "vuit", "nou"][u]! : "";
        if (tail !== "" && card.endsWith(tail))
            return `${card.slice(0, -tail.length)}${small[u]}`;
    }
    // THE STEM LOSES ITS FINAL VOWEL before the ending: quaranta → quarantè/quarantena, noranta →
    // norantè/norantena, seixanta → seixantè. Appending straight to the cardinal gave *seixantaè* and
    // *cent norantaena*, which is both corpus instances of a tens ordinal (`60è`, `190a`). A final -ó
    // takes the -on- stem instead (milió → milionè).
    // …and a PLURAL HUNDREDS stem loses its -s: dos-cents → dos-centè, nou-cents → nou-centena. Only
    // `cents` — a bare `dos`/`tres` ending a compound keeps its s (102 → cent dosè), so this cannot be a
    // blanket strip. Found by enumerating the branch rather than the corpus, which writes no N00 ordinal.
    stem = stem.endsWith("ó") ? `${stem.slice(0, -1)}on`
        : stem === "cents" ? "cent"
        : stem.replace(/[ae]$/u, "");
    words[words.length - 1] = fem ? `${stem}ena` : `${stem}è`;
    return words.join(" ");
}

/** Multi-dot abbreviations and era markers. Handled BEFORE the single-dot rule so no interior dot survives
 *  as a phrase break. `dC` = després de Crist (AD), `aC` = abans de Crist (BC). */
const MULTI_DOT: readonly (readonly [string, string])[] = [
    ["dC", "després de Crist"],
    ["aC", "abans de Crist"],
];

/** Single-dot abbreviations → the spoken words. `Dr.` = doctor; `etc.` = et cetera. The dot is a phrase
 *  break otherwise. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    "dr": "doctor",
    "etc": "etcètera",
};

/** Catalan letter names — the standard alphabet (a, be, ce, de, e, efa, ge, hac, i, jota, ca, ela, ema,
 *  ena, o, pe, cu, erra, essa, te, u, ve, ve doble, ics, i grega, zeta). The g2p spells them through
 *  itself. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "be", c: "ce", d: "de", e: "e", f: "efa", g: "ge", h: "hac", i: "i", j: "jota",
    k: "ca", l: "ela", m: "ema", n: "ena", o: "o", p: "pe", q: "cu", r: "erra", s: "essa", t: "te",
    u: "u", v: "ve", w: "ve doble", x: "ics", y: "i grega", z: "zeta",
};

/** Catalan phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableCatalan = makeUnreadableTest({
    vowels: /[aeiouàèéíòóú]/u,
    legalOnsets: new Set([
        "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "ps", "sk", "sl", "sm",
        "sn", "sp", "st", "tr", "ts",
    ]),
    legalCodas: new Set([
        "b", "bs", "cc", "ck", "ct", "ds", "ft", "ks", "kt", "lc", "ld", "lf", "lg", "lk", "ll",
        "lm", "lp", "ls", "lt", "mp", "ms", "mt", "nc", "nd", "ng", "nk", "ns", "nt", "nz", "ps",
        "pt", "rc", "rd", "rf", "rg", "rk", "rl", "rm", "rn", "rp", "rs", "rt", "sc", "sk", "sp",
        "ss", "st", "ts", "tz", "xt", "ny", "ll", "l·l",
    ]),
});

/** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["onu", "nato", "covid", "fifa", "opec", "unesco", "aids", "laser"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l.toLowerCase()],
    acronymLetters: new Set(["eua", "fbi", "nhk", "fic", "ns", "nsw", "irm", "rmn", "ocde", "bmt"]),
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableCatalan,
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Catalan input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeCatalan(input: string): string {
    let s = input;

    // 1) ERA MARKERS and MULTI-DOT ABBREVIATIONS. FIRST, before the single-dot rule — otherwise the
    //    single-dot rule consumes `d.`/`a.` and leaves `C` behind. `dC`/`aC` are undotted in the corpus.
    for (const [body, word] of MULTI_DOT) {
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${body}(?![\\p{L}\\p{M}])`, "giu"), word);
    }

    // 2) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
    //    `George W. Bush` — the W. suffix dot is a break.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));
    s = s.replace(/(?<=[A-Z])\.(?=\s+[A-Z])/gu, "");

    // 3) SINGLE-DOT ABBREVIATIONS. Two branches: mid-sentence the dot is CONSUMED so it cannot become a
    //    phrase break; at a phrase end it is kept.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(dr|etc)\\.(\\s+)(?=[\\p{L}\\d])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(dr|etc)\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 4) ORDINALS — the `Nè`/`Na`/`Nr`/`Nn`/`Nt`/`Nns` form. The suffix records the gender and the written
    //    ending: a feminine, r/n/t the irregular series (primer/segon/tercer/quart), è the -è series. The
    //    suffix must MATCH the spoken ordinal's final word, which rules out misfires on forms the language
    //    does not write (11r, 5t) — ⚠ a guard alternative with no attested instance is a misfire
    //    generator. Was *set è* / *set a* / *cent noranta a* / *quatre t*. BEFORE the clock rule so a digit
    //    run is not first claimed as a time.
    s = s.replace(/(?<![\d.,])(\d+)(è|a|r|n|ns|t)(?![\p{L}\p{M}])/giu, (m0, d: string, sfx: string) => {
        const n = Number(d);
        const fem = sfx.toLowerCase() === "a";
        const ord = ordinalWords(n, fem);
        if (ord === undefined) return m0;
        const last = ord.split(" ").pop()!;
        const m = sfx.toLowerCase();
        if (m === "r" && !(last === "primer" || last === "tercer")) return m0;
        if (m === "n" && last !== "segon") return m0;
        if (m === "ns" && last !== "segon") return m0;
        if (m === "t" && last !== "quart") return m0;
        if (m === "ns") return ord.replace(/ segon$/u, " segons");
        return ord;
    });

    // 4b) DECADES — `1920s`, `90s`. Without this the shared tier's `s` unit reads "1920 s" as *mil nou-cents
    //     vint segons* (nineteen-twenty SECONDS) — ⚠ an alphanumeric designation looks exactly like a range. The corpus writes `els anys
    //     1920s`. Drop the plural marker; the number itself is the decade.
    //     Narrowed to the DECADE shapes — a four-digit year or a bare tens (`1920s`, `90s`). Stripping the
    //     `s` from ANY number took the unit off a genuine `45s` (forty-five SECONDS), which the tier reads
    //     correctly once the plural marker is not in the way.
    s = s.replace(/(?<![\d.,])((?:1\d|20)\d{2}|\d0)s(?![\p{L}\p{M}])/giu, "$1");

    // 5) CLOCK, in the COLON form. The comma DECIMAL and the DOT version are handled elsewhere; the colon
    //    is clause punctuation and must be claimed here. `11:35 PM` → onze trenta-cinc PM; `06:30` → sis
    //    trenta. The 24h form with `h` (`10:00h`) and the AM/PM marker are consumed. NOT a sports time:
    //    a THIRD `\d.\d\d` field after the minutes (4:41.30) means the number is a pace, not a clock — the
    s = s.replace(/(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])\s*(h)?\s*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?)?/giu,
        (m0, h: string, min: string, hh: string, ap: string) => {
            const hv = Number(h), mv = Number(min);
            if (hv > 23 || mv > 59) return m0;
            const head = mv === 0 ? numberToWords(hv) : `${numberToWords(hv)} ${numberToWords(mv)}`;
            const suffix = ap !== undefined && ap !== "" ? ` ${ap.replace(/\./gu, "").toUpperCase()}` : "";
            return `${head}${suffix}`;
        });

    // 6) VERSION DOTS and DOT DECIMALS — `2.4 Ghz`, `5.0 Ghz`, `802.11a/b/g/n`, `1.5 milions`,
    //    `12.8 km`, `Figura 1.1`, `4.2-3.9`. The dot is the THOUSANDS separator when the fraction is THREE
    //    digits (1.400 = mil quatre-cents); a 1-2 digit fraction is a DECIMAL the English-influenced corpus
    //    writes with a dot. Read "punt" (point). AFTER the clock (8:30 has a two-digit minute and no letter
    //    after, but the clock rule has already claimed it).
    s = s.replace(/(?<![\d.,])(\d+)\.(\d{1,2})(?![\d.])/giu, "$1 punt $2");

    // 7) FRACTIONS. ¾/½ after a whole read "i tres quarts"/"i mig"; a unit fraction reads the denominator
    //    + "è" (ordinal): 1/5 → *un cinquè*. The vulgar-fraction glyphs were being dropped outright.
    s = s.replace(/(\d+)¾/gu, "$1 i tres quarts");
    s = s.replace(/(\d+)½/gu, "$1 i mig");
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        if (den === 2) return num === 1 ? "mig" : `${numberToWords(num)} mitjos`;
        // 3 and 4 have their own NOUNS (un terç, tres quarts) rather than the ordinal, and every
        // denominator pluralises above one: 2/3 dos terços, 3/4 tres quarts, 2/5 dos cinquens. Reading the
        // bare ordinal gave *un tercer* for 1/3 and *tres quart* for 3/4.
        const noun = den === 3 ? "terç" : den === 4 ? "quart" : ordinalWords(den, false);
        if (noun === undefined) return m0;
        const plural = den === 3 ? "terços" : den === 4 ? "quarts" : noun.replace(/è$/u, "ens");
        return `${numberToWords(num)} ${num === 1 ? noun : plural}`;
    });

    // 8) DEGREES. `30 °C` came out as the bare consonant [k]; `35 ºO` (longitude west) used the ORDINAL
    //    º (U+00BA) which the ° rule missed. `grau` is the degree word (plural graus).
    s = s.replace(/(\d)\s?[°º]\s?C(?![\p{L}\p{M}])/giu, "$1 graus Celsius");
    s = s.replace(/(\d)\s?[°º]\s?F(?![\p{L}\p{M}])/giu, "$1 graus Fahrenheit");
    //    The class must carry S as well as N/O/E — the map has "sud" but the class did not, so `35 ºS`
    //    left the º raw (a RAWMARK) and read the S as a letter.
    s = s.replace(/(\d)\s?[°º]\s?([NSOE])(?![\p{L}\p{M}])/giu, (_m, d: string, c: string) =>
        `${d} graus ${({ N: "nord", S: "sud", E: "est", O: "oest" } as Record<string, string>)[c.toUpperCase()]!}`);
    s = s.replace(/(\d)\s?[°º](?![\p{L}\p{M}])/gu, "$1 graus");

    // 9) GIGAHERTZ — the corpus's `2.4 Ghz`, `5.0 Ghz`. The version-dot rule has already split the number
    //    ("2.4" → "2 punt 4"); the Ghz unit reads gigahercis. AFTER the version rule, BEFORE the tier.
    s = s.replace(/(\d+(?: punt \d+)?)\s?Ghz?(?![\p{L}\p{M}])/giu, "$1 gigahercis");

    // 10) SIGNS. `UTC +1` — the plus was dropped. `&` → *i* (and), with a trailing plural `s` on the LAST
    //     letter name (`B&Bs` → be i bes — the corpus's only ampersand is the plural). A TRUE minus (`-5`)
    //     reads "menys"; the corpus's `-\d` are all ranges/scores (6-6, 11.000-22.500, 4.2-3.9) and stay as
    //     two bare numbers.
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, and ⚠ both are SIGN names rather than
    //    OPERATION names, which is what ± needs: it marks a TOLERANCE, not an addition.
    s = s.replace(/±/gu, " més menys ");
    s = s.replace(/\+\s?(?=\d)/gu, " més ");
    s = s.replace(/(?<![\p{L}\p{Nd}])-(\d+)(?!\s*[-\d])/gu, "menys $1");
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(s?)(?![\p{L}\p{M}])/gu,
        (_m, a: string, b: string, pl: string) =>
            `${LETTER_NAME[a.toLowerCase()] ?? a} i ${LETTER_NAME[b.toLowerCase()] ?? b}${pl}`);
    s = s.replace(/\s&\s/gu, " i ");
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 és igual a $2");
    // THE DIVISION SIGN, the one sign this file still dropped. ca.wikipedia's arithmetic prose uses the
    // participle in the slot — "21 = 16+4+1 +1 dividit per 8" — and FLEURS's parallel aspect-ratio sentence,
    // which performs a division aloud in 57 of its 67 languages, has the Catalan translator writing the gerund
    // of the same verb ("dividint per dotze"). Both are attested; the participle is the neutral sign reading,
    // since the gerund is inflected for its clause rather than for the notation.
    s = s.replace(/(\S)\s*÷\s*(\S)/gu, "$1 dividit per $2");
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 és menor que $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 és major que $2");
    s = s.replace(/(\d)\s*×\s*(\d)/gu, "$1 per $2");

    // 11) INITIALISMS, LAST of the letter rules: it must run after the era markers (else dC → *de ce*)
    //     and after the dotted-capital rule.
    s = normalizeInitialisms(s);

    // A padded replacement (` més `, ` i `) doubles a space that was already there — "UTC +1" became
    // "UTC  més 1". Harmless downstream today because assembleClauses collapses runs, but SLOT-GAP is a
    // defect class and this pass should not be the one producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
