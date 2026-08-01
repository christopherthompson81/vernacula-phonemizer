/**
 * Azerbaijani (az) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the 1,919 unique cased az_az FLEURS utterances (column 3):
 *   `N-ci` ordinal suffix ×~250   (1767-ci ildə, 1978-ci ilin, 190-cı yerdə, 24-cü pillədə, 7-ci ən böyük)
 *   space-grouped thousands ×…    (400 000, 30 000, 330 000, 800 000, 40 000)
 *   comma decimals ×20            (6,5 / 1,2 / 3,50 / 2,8 / 2,3 — the comma is ALSO clause punctuation)
 *   percent ×11                   (30%-i, 100%, 3%-ni, 88%-ni — the -i/-ni are possessive suffixes)
 *   clocks ×21                    (12:00 GMT, 21:20, 23:35-ə)
 *   version dots ×…               (2.4Ghz, 5.0 Ghz, 802.11n/a/b/g)
 *   era markers ×2                (e.ə. / E.ə. = eramızdan əvvəl, BC)
 *   degrees ×2                    (+30°C, 35° longitude)
 *   units ×34 · rates ×7          (km, mm, km², mil, yard; km/s, km/saat, m/s, Mbit/s)
 *   currency ×2 · fractions ×3    (1000$, $14,7; 24½, 29¾, 1/5, 1/3)
 *   roman ×9                      (II Dünya Müharibəsi — World War II reads İkinci)
 *   initialisms ×135 · abbrev ×54 (ABŞ, BMT, GPS, MS, KNP, CEP; Dr., Corc V. Buş)
 *
 * THE `N-ci` ORDINAL — the corpus's defining form. Azerbaijani writes the ordinal as a numeral plus a
 * HARMONISED suffix: `7-ci`, `190-cı`, `24-cü`, `2010-cu`. The suffix agrees with the stem's last vowel in
 * four-way harmony, and the spoken form is the cardinal with `-ıncı/-inci/-uncu/-üncü` on its LAST word
 * (birinci, ikinci, üçüncü, dördüncü, onuncu, iyirminci …) — a vowel-final stem drops the linking vowel
 * (iki→ikinci, altı→altıncı). romanOrdinals.ts owns the harmony logic; this pass applies it to ARABIC
 * numerals with the written suffix.
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `1767-ci ildə`   → `mˈin jedːˈi jˈyz ɑɫtmˈɯʃ jedːˈi d͡ʒˈi ildˈæ`   cardinal + bare "ci" syllable
 *   `400 000`        → `dˈœɾd jˈyz sɯfˈɯɾ`       space-grouped thousands read as "dörd yüz sıfır"
 *   `12:00 GMT`      → `ˈon icˈi , sɯfˈɯɾ ɟmt`    the colon became a pause, GMT read as [ɟmt]
 *   `30%-i`          → `otˈuz ˈi`                  percent dropped, the possessive -i read as [i]
 *   `+30°C`          → `otˈuz d͡ʒ`                  plus dropped, °C read as [dʒ]
 *   `e.ə. 323-cü`    → `ˈe . ˈæ .`                 era marker letter-spelled
 *   `2.4Ghz`         → `icˈi . dˈœɾd ɟhz`          version dot → a phrase break
 *   `19500 km²`      → `… km dˈiɾ`                 squared unit raw
 *   `80 km (50 mil)` → `sæcsˈæn km ællˈi mˈil`     units raw
 *   `1000$`          → `mˈin`                      currency dropped
 *   `II Dünya Müharibəsi` → `icˈi …`               regnal Roman read as the cardinal
 *   `Corc V. Buş`    → `… v . bˈuʃ`                the initial dot left a break
 *   `Dr. Moll`       → `dɾ . mˈoɫɫ`                the abbreviation left a break
 *
 * WHY THE NUMBER RULES RUN HERE AND NOT IN THE TOKENIZER. The ordinal's spoken words must be plain text so
 * the word path stresses them; the de-grouped thousands, the comma decimal and the version dot stay DIGITS so
 * the shared symbol tier can still see the number adjacent to its unit/sign — the tier is composed AFTER this
 * pass in azerbaijani.ts, and the TOKEN swallows the separators (see azerbaijani.ts).
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

const VOWEL = /[aıeiəouöü]/u;
const VOWEL_LETTERS = "aıeiəouöü";

/** Four-way vowel harmony: the high vowel a suffix takes after each possible last stem vowel. */
const HIGH: Readonly<Record<string, string>> = {
    a: "ı", ı: "ı", e: "i", ə: "i", i: "i", o: "u", u: "u", ö: "ü", ü: "ü",
};

function lastVowelOf(w: string): string | undefined {
    for (let i = w.length - 1; i >= 0; i--) if (VOWEL.test(w[i]!)) return w[i]!;
    return undefined;
}

/** The WRITTEN ordinal suffix (ci/cı/cu/cü) → the harmony class it implies. The written suffix's own vowel
 *  is the class the SPOKEN suffix must take (dörd → -üncü, iyirmi → -inci). */
const WRITTEN_CLASS: Readonly<Record<string, "ı" | "i" | "u" | "ü">> = {
    cı: "ı", ci: "i", cu: "u", cü: "ü",
};

/**
 * Integer → the Azerbaijani ORDINAL, i.e. the cardinal with the ordinal suffix on its LAST word: 18 → `on
 * səkkizinci`, 190 → `yüz doxsanıncı`, 24 → `iyirmi dördüncü`, 1000 → `mininci`. The suffix is
 * -(I)ncI under four-way harmony — -ncI after a vowel-final stem (iki → ikinci, altı → altıncı), -IncI
 * after a consonant (beş → beşinci, on → onuncu, yüz → yüzüncü, doxsan → doxsanıncı). `dörd` ends in a
 * voiced consonant that stays (dördüncü).
 */
export function ordinalWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 0) return undefined;
    const card = numberToWords(n);
    if (card === "" || /\d/u.test(card)) return undefined;
    const words = card.split(" ");
    const stem = words[words.length - 1]!;
    const v = lastVowelOf(stem);
    if (v === undefined) return undefined;
    const h = HIGH[v]!;
    words[words.length - 1] = VOWEL.test(stem[stem.length - 1]!) ? `${stem}nc${h}` : `${stem}${h}nc${h}`;
    return words.join(" ");
}

/** Multi-dot abbreviations and era markers. Handled BEFORE the single-dot rule so no interior dot survives
 *  as a phrase break. `e.ə.` = eramızdan əvvəl (BC); `b.e.` = bizim eradan əvvəl (BC variant); `b.e.` also
 *  covers the corpus's `BE` (before era). */
const MULTI_DOT: readonly (readonly [string, string])[] = [
    ["e\\.\\s?ə\\.", "eramızdan əvvəl"],
    ["E\\.\\s?ə\\.", "eramızdan əvvəl"],
    ["b\\.\\s?e\\.", "bizim eradan əvvəl"],
    ["\\bBE(?=\\s+\\d)", "bizim eradan əvvəl"],
];

/** Single-dot abbreviations → the spoken words. `Dr.` = Doktor, `Şək.` = şəkil (figure). The dot is a phrase
 *  break otherwise. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    "dr": "Doktor",
    "prof": "Professor",
    "şək": "şəkil",
};

/** Azerbaijani letter names — the standard alphabet (a, be, ce, çe, de, e, ə, fe, ge, he, xı, ı, i, je,
 *  ke, el, em, en, o, ö, pe, er, se, şe, te, u, ü, ve, ye, ze). The g2p spells them through itself. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "be", c: "ce", ç: "çe", d: "de", e: "e", ə: "ə", f: "fe", g: "ge", h: "he",
    x: "xı", ı: "ı", i: "i", j: "je", k: "ke", l: "el", m: "em", n: "en", o: "o", ö: "ö",
    p: "pe", r: "er", s: "se", ş: "şe", t: "te", u: "u", ü: "ü", v: "ve", y: "ye", z: "ze",
};

/** Azerbaijani phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?). */
export const isUnreadableAzerbaijani = makeUnreadableTest({
    vowels: /[aıeiəouöü]/u,
    legalOnsets: new Set([
        "bl", "br", "dr", "dv", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "pl", "pr", "ps", "sk",
        "sl", "sm", "sn", "sp", "st", "sv", "tr", "ts", "tv", "xl", "xm", "xn", "xs",
    ]),
    legalCodas: new Set([
        "ft", "kt", "ks", "ld", "lf", "lk", "lm", "lp", "ls", "lt", "mp", "ms", "mt", "nd", "ng",
        "nk", "ns", "nt", "pt", "rd", "rf", "rk", "rl", "rm", "rn", "rp", "rs", "rt", "sk", "sp",
        "st", "ts", "xt",
    ]),
});

/** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics. ABŞ (Amerika Birləşmiş
 *  Ştatları) is the corpus's dominant one — [ɑbʃ], one syllable, like NASA. GPS, BMT, MS, KNP, CEP are
 *  letter-spelled. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["abş", "nasa", "unecso", "aol", "covid", "fiba", "opec", "rem"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l.toLowerCase()],
    acronymLetters: new Set(["bmt", "gps", "ms", "knp", "cep", "mt", "mri", "dnt", "ftb", "cctv", "dvd", "pbs", "utc", "gmt"]),
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableAzerbaijani,
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Azerbaijani input string. Pure text→text. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeAzerbaijani(input: string): string {
    let s = input;

    // 1) ERA MARKERS and MULTI-DOT ABBREVIATIONS. FIRST, before the single-dot rule — otherwise the
    //    single-dot rule consumes `e.`/`b.` and leaves `ə.`/`e.` behind as an interior phrase break.
    //    Also before the dotted-capital rule, so `E.ə.` is not offered to it.
    for (const [body, word] of MULTI_DOT) {
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.(?=\\s*$)`, "giu"), `${word}.`);
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${body}`, "giu"), word);
    }

    // 2) DOTTED CAPITAL RUNS → a bare all-caps run, so the initialism pass reads them as LETTERS.
    //    `Corc V. Buş` — the W.-style initial dot is a break.
    s = s.replace(/(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+/gu, (m0) => m0.replace(/[.\s]/gu, ""));
    s = s.replace(/(?<=[A-Z])\.(?=\s+[A-Z])/gu, "");

    // 3) SINGLE-DOT ABBREVIATIONS. Two branches: mid-sentence the dot is CONSUMED so it cannot become a
    //    phrase break; at a phrase end it is kept. `Şək.` (şəkil, figure) is the corpus's abbreviation.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(dr|prof|şək)\\.(\\s+)(?=[\\p{L}\\d])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(dr|prof|şək)\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 4) ORDINALS — the `N-ci` form. The written suffix (ci/cı/cu/cü) implies the harmony class; the spoken
    //    suffix is the cardinal's last word with -ıncı/-inci/-uncu/-üncü. Was *səkkiz d͡ʒi* / *yüz doxsan
    //    d͡ʒı* / *iyirmi dörd d͡ʒü*. BEFORE the clock rule so a digit run is not first claimed as a time.
    s = s.replace(/(?<![\d.,])(\d+)-(cı|ci|cu|cü)(?![\p{L}\p{M}])/giu, (m0, d: string, c: string) =>
        ordinalWords(Number(d)) ?? m0);

    // 5) SPACE-GROUPED THOUSANDS. Azerbaijani groups thousands with a SPACE (400 000, 30 000). Two passes,
    //    because the groups overlap on the shared digit. AFTER the ordinal (no `N-ci` has a space).
    for (let i = 0; i < 2; i++)
        s = s.replace(/(\d)[  ](\d{3})(?!\d)/gu, "$1$2");

    // 6) CLOCK, in the COLON form. The comma DECIMAL and the DOT version are handled elsewhere; the colon
    //    is clause punctuation and must be claimed here. `12:00 GMT` → saat on iki GMT; `21:20` → iyirmi
    //    bir iyirmi; `23:35-ə` → the clock with a dative suffix.
    s = s.replace(/(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:\d])(\s*)([-əa]?)/giu, (m0, h: string, min: string, sp: string, sfx: string) => {
        const hv = Number(h), mv = Number(min);
        if (hv > 23 || mv > 59) return m0;
        const head = mv === 0 ? numberToWords(hv) : `${numberToWords(hv)} ${numberToWords(mv)}`;
        return `${head}${sp}${sfx}`;
    });

    // 7) VERSION DOTS — `2.4Ghz`, `5.0 Ghz`, `802.11n`, and the figure reference `Şək. 1.1`. The comma is
    //    the decimal; a DOT-decimal followed by a unit (Ghz/GHz), a version letter (n), or a phrase boundary
    //    with a SHORT fraction (1-2 digits — a figure number) is a version. Read "nöqtə" (point). AFTER the
    //    clock (8:30 has a two-digit minute and no letter after). A 3+ digit fraction (`1.234`) stays a
    //    grouping the corpus never writes with a dot.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d{1,2})(?=\s*(?:[a-zA-Zçğəıiöşüx]|[)»]|$))/giu, "$1 nöqtə $2");
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)\s?(?=[a-zA-Zçğəıiöşüx]|GHz?)/giu, "$1 nöqtə $2");

    // 8) RATES — the corpus's own prose reads them PREFIXED ("saatda 40 mil", "saniyədə 1,5 km"), exactly
    //    as Turkish. The shared tier only emits "N kilometr saatda"-shaped, so the `/unit` forms are
    //    claimed here BEFORE the tier: km/saat & km/h → "saatda N kilometr", m/s → "saniyədə N metr",
    //    mil/saat → "saatda N mil". The slash is consumed so neither the unit nor the denominator strands.
    s = s.replace(/(\d+(?:,\d+)?)\s?km\s?\/\s?(?:saat|h|s)(?![\p{L}\p{M}])/giu, "saatda $1 kilometr");
    s = s.replace(/(\d+(?:,\d+)?)\s?mil\s?\/\s?(?:saat|h|s)(?![\p{L}\p{M}])/giu, "saatda $1 mil");
    s = s.replace(/(\d+(?:,\d+)?)\s?m\s?\/\s?s(?![\p{L}\p{M}])/giu, "saniyədə $1 metr");
    s = s.replace(/(\d+(?:,\d+)?)\s?yard\s?\/\s?m(?![\p{L}\p{M}])/giu, "metrdə $1 yard");
    s = s.replace(/(\d+(?:,\d+)?)\s?Mbit\s?\/\s?s(?![\p{L}\p{M}])/giu, "saniyədə $1 meqabit");
    // Gigahertz as the corpus writes it — `2.4Ghz`, `5.0 Ghz`, and `802.11n` (its speed). Azerbaijani for
    // GHz is giqahers.
    s = s.replace(/(\d+(?:,\d+)?)\s?Ghz?\b(?![\p{L}\p{M}])/giu, "$1 giqahers");

    // 9) PERCENT with a POSSESSIVE SUFFIX — `30%-i`, `3%-ni`, `88%-ni` ("its 30%"). The corpus's faiz
    //    noun takes the suffix directly (faizi, faizini). The shared tier's `N%` → "N faiz" cannot see
    //    past the trailing letter, and would double a spelled "faiz". The suffixed form is fully spelled
    //    here (no % remains); the bare `N%` is left for the tier.
    s = s.replace(/(\d+)%(-?(?:n?[iuə]))\b/gu, (_m, d: string, sfx: string) =>
        `${d} faiz${sfx.replace(/^-/u, "")}`);

    // 10) DEGREES. `+30°C` came out as the bare consonant [dʒ]; `35°` dropped the sign. The scale letters are
    //     expanded only DIRECTLY after a degree sign. `dərəcə` is the corpus's own word ("90 dərəcə farenheyt").
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/giu, "$1 dərəcə selsi");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/giu, "$1 dərəcə farenheyt");
    s = s.replace(/(\d)\s?°(?![\p{L}\p{M}])/gu, "$1 dərəcə");

    // 11) SIGNS. `+30°C` — the plus was dropped. `&` → *və* (and). A TRUE minus (`-5`) reads "mənfi"; the
    //     corpus's `-\d` are all ranges/scores (1-3, 10-60, 6-6, 25-30) and stay as two bare numbers.
    s = s.replace(/\+\s?(?=\d)/gu, " üstəgəl ");
    s = s.replace(/(?<![\p{L}\p{Nd}])-(\d+)(?!\s*[-\d])/gu, "mənfi $1");
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(?![\p{L}\p{M}])/gu, (_m, a: string, b: string) =>
        `${LETTER_NAME[a.toLowerCase()] ?? a} və ${LETTER_NAME[b.toLowerCase()] ?? b}`);
    s = s.replace(/\s&\s/gu, " və ");
    s = s.replace(/(\S)\s*=\s*(\S)/gu, "$1 bərabərdir $2");
    s = s.replace(/(\d)\s*<\s*(\d)/gu, "$1 kiçikdir $2");
    s = s.replace(/(\d)\s*>\s*(\d)/gu, "$1 böyükdür $2");
    s = s.replace(/(\d)\s*×\s*(\d)/gu, "$1 vur $2");

    // 12) FRACTIONS (×3: 24½, 29¾, 1/5, 1/3). Azerbaijani builds these on the ordinal: 1/5 → *beşdə bir*
    //     (locative of the denominator + numerator), ½ → yarım, ¾ → üçdə dörd. LAST, so no earlier rule
    //     has to work around a slash.
    s = s.replace(/(\d+)½/gu, "$1 yarım");
    s = s.replace(/(\d+)¾/gu, "$1 üçdə dörd");
    s = s.replace(/(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
        const num = Number(a), den = Number(b);
        if (den === 2) return num === 1 ? "yarım" : `${numberToWords(num)} yarım`;
        const dw = numberToWords(den);
        return dw === "" ? m0 : `${dw}də ${numberToWords(num)}`;
    });

    // 13) REGNAL `II` — `II Dünya Müharibəsi` (World War II). The shared Roman pass converts II → 2 before
    //     the engine; the digit before Dünya Müharibəsi reads as an ORDINAL (İkinci), matching the corpus's
    //     own "İkinci Dünya Müharibəsində".
    s = s.replace(/(\d{1,2})\s+Dünya Müharibəsi/gu, (m0, d: string) => {
        const ord = ordinalWords(Number(d));
        return ord === undefined ? m0 : `${ord} Dünya Müharibəsi`;
    });

    // 14) INITIALISMS, LAST of the letter rules: it must run after the era markers (else e.ə. → *e ə*)
    //     and after the dotted-capital rule.
    s = normalizeInitialisms(s);

    return s;
}
