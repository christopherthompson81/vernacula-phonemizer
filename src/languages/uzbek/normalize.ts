/**
 * Uzbek (uz) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED OVER THE 1,957 UNIQUE uz_uz FLEURS UTTERANCES (column 3, the cased one):
 *   ordinal `N-word` hyphen          ×452 (1978-yildagi, 190-oʻrin, 7-eng yirik, 16-noyabr, 15-asrda, 9-sonli …)
 *   space-grouped thousands          ×17  (800 000, 19 500, 330 000 — the number token cannot span a space)
 *   comma decimals                   ×18  (6,5 / 1,5 / 6,34 — the comma is ALSO clause punctuation)
 *   clocks                           ×18  (10:00, 11:35, 06:30, 12:00 GMT …)
 *   initialisms                      ×135 (AQSH, BMT, MS, GPS, OIV, NBA … — the whole corpus is Latin script)
 *   letter names / personal initials ×111 (T. rex, V. Bush, D. K. Arya …)
 *   percent ×4, currency ×2, era markers ×4, ranges ×20, rates ×12, fractions ×2, degrees ×1, signs ×8
 *
 * THE DEFINING RULE — `N-word` hyphen is the ORDINAL writing. This is the orthographic rule, sourced in
 * src/languages/uzbek/romanOrdinals.ts ("written with an ARABIC numeral it takes a hyphen for the suffix
 * (7-sinf, 1991-yilning 1-sentabri)"). So `1978-yil` is *ming toʻqqiz yuz yetmish sakkizinchi yil* — a
 * year, a century (15-asrda → oʻn beshinchi asrda), a date (16-noyabr → oʻn oltinchi noyabr), a rank
 * (190-oʻrin → bir yuz toʻqsoninchi oʻrin), a mark (1000-markasi → minginchi markasi) — every `N-word`
 * reads ordinal. BEFORE this pass the number read as a CARDINAL and the hyphen dropped: `1755-yildagi` →
 * *ming yetti yuz ellik besh yildagi*.
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `1755-yildagi` → `mˈiŋ jettˈi jˈuz ellˈik bˈeʃ jildaɡˈi`   cardinal year; should be … ellik beshinchi …
 *   `190-oʻrinni`  → `jˈuz toqsˈɒn orinnˈi`                    cardinal + bare "oʻrin"; should be toʻqsoninchi
 *   `6,5`          → `ɒltˈi , bˈeʃ`                            the comma became a COMMA PAUSE
 *   `19 500`       → `ˈon toqqˈiz bˈeʃ jˈuz`                    space-grouped thousands read as two numbers
 *   `10:00`        → `ˈon , nˈɒl`                              the colon became a COMMA PAUSE
 *   `m.a. 356`     → `m . ˈa .`                                era marker fragmented into bare letters
 *   `88%`          → `saksˈɒn sakkˈiz`                         % dropped outright
 *   `5$`           → `bˈeʃ`                                    currency dropped outright
 *   `BMT`          → `bmt`                                     a vowelless cluster; Uzbek says *be em te*
 *   `7–2`          → `jettˈi ikkˈi`                            range en-dash dropped (left as two numbers — see §ranges)
 *   `29¾`          → `jiɡirmˈa toqqˈiz ə`                      vulgar fraction left a stray ə
 *
 * THE ORDINAL SUFFIX. Cardinal + -nchi after a vowel / -inchi after a consonant, on the LAST word only:
 * `ming toʻqqiz yuz yetmish sakkiz` → `… sakkizinchi`. `ordinalWords` is shared with the engine via
 * numbers.ts. Only the last element of a compound takes it: 190 → bir yuz toʻqsoninchi.
 *
 * RANGES (`7–2`, `10–60`, `1469–1539`, `1995–96`): deliberately left, like Turkish. The en-dash is dropped
 * and the two numbers read bare, which is the natural score/range reading (*yetti ikki*); a connective
 * ("dan … gacha") would be wrong for the scores the corpus also contains. See the Turkish file's rationale.
 *
 * WHY THE NUMBER RULES RUN HERE AND NOT IN THE TOKENIZER. The ordinal's spoken words must be plain text so
 * the word path stresses them (no special-casing needed — Uzbek is final-stressed with ONE shape). The
 * de-grouped thousands and the decimal comma stay DIGITS so the shared symbol tier (`makeSymbolNormalizer`)
 * can still see the number adjacent to its unit/sign — the tier is composed AFTER this pass in uzbek.ts.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords, ordinalWords } from "./numbers.ts";
import { rewrite } from "../../core/provenance.ts";

/** A word character. UPPERCASE included: the hyphen-ordinal writing is orthographic, not case-bound, and a
 *  capitalized head is ordinary in dates and titles (`1-Mart`, `16-Noyabr`, `1.1-Rasmga`) — with a
 *  lowercase-only class those read as a CARDINAL with the hyphen dropped. */
const WORD = "[A-Za-zʻ'’‘`ʼ′]";
/** A number token the ordinal/dot/era rules rewrite (integers; decimals/grouping handled by the symbol tier). */
const DIGITS = "(\\d+(?:,\\d+)?)";

/** Uzbek letter names (26 letters + oʻ/gʻ/sh/ch/ng which never need spelling). The
 *  letter-name convention: consonant names end in the vowel of the letter's sound — be, de, ef, ge, ka, pe.
 *  c/w appear only in unadapted loans and take their Latin-style names. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "a", b: "be", c: "se", d: "de", e: "e", f: "ef", g: "ge", h: "ha", i: "i", j: "je",
    k: "ka", l: "el", m: "em", n: "en", o: "o", p: "pe", q: "qa", r: "er", s: "es", t: "te",
    u: "u", v: "ve", w: "ve", x: "xa", y: "ye", z: "ze",
};

/** Uzbek phonotactics, for the OOV rule in core/initialisms.ts. Uzbek natively avoids consonant clusters;
 *  the onsets/codas listed are what Russian/English loans brought in. */
const isUnreadableUzbek = makeUnreadableTest({
    vowels: /[aeiou]/u,
    legalOnsets: new Set([
        "bl", "br", "by", "dr", "dy", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "ky", "pl",
        "pr", "ps", "py", "sk", "sl", "sm", "sn", "sp", "st", "sv", "sy", "tr", "ts", "vy",
    ]),
    legalCodas: new Set([
        "ft", "kt", "ks", "lm", "lt", "nd", "ng", "nk", "nt", "pt", "rd", "rf", "rk", "rl",
        "rm", "rn", "rp", "rs", "rt", "sk", "st", "ts", "yk",
    ]),
});

/** Lexical: acronyms READ AS WORDS despite being unreadable by phonotactics — the pronunciation dictionary
 *  owns them. AQSH (Amerika Qoʻshma Shtatlari = USA) is the one the corpus needs: [aqʃ], one syllable. */
const WORD_ACRONYMS: ReadonlySet<string> = new Set(["aqsh", "nasa", "asus", "opec", "rem", "covid"]);

const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l.toLowerCase()],
    acronymLetters: new Set(["pa", "to", "oha", "aol"]),
    isRecorded: (w) => WORD_ACRONYMS.has(w),
    isUnreadable: isUnreadableUzbek,
});

/** Normalize one Uzbek input string. Pure text→text; ordered, and each ordering coupling is stated.
 *  Runs BEFORE the shared symbol tier (`makeSymbolNormalizer`) — see the file header. */
export function normalizeUzbek(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, first. Uzbek groups thousands with a SPACE (19 500, 800 000) — verified
    //    against the corpus — and marks the decimal with a COMMA. The space is otherwise a word boundary
    //    that splits the number. Two passes, because the groups overlap on the shared digit (783 562 948).
    //    A space is only grouping when the block is exactly three digits ("800 000" but not "3000 mil").
    for (let i = 0; i < 2; i++)
        s = rewrite(s, /(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))/gu, "");  // space, NBSP, NNBSP, thin space
    s = rewrite(s, /[ \u00a0\u202f\u2009]/gu, " ");  // space, NBSP, NNBSP, thin space

    // 1) ERA MARKERS, before the single-dot rules so the interior dots cannot survive as breaks. `m.a.` =
    //    miloddan avval (BC, ×4), `m.` = milodiy (AD, ×1). Each is claimed only before a number or another
    //    era-adjacent token; a bare `m.` in a name context is left alone.
    s = rewrite(s, /(?<![\p{L}\p{M}])m\.a\.(?=\s*(?:\d|milodiy|avval))/giu, "miloddan avval");
    s = rewrite(s, /(?<![\p{L}\p{M}])m\.a\.(?![\p{L}\p{M}])/giu, "miloddan avval");
    s = rewrite(s, /(?<![\p{L}\p{M}])m\.(?=\s*\d)/giu, "milodiy");

    // 2) DOTTED ABBREVIATIONS. `h.k.` = hokazo (etc., ×1), `mln.` = million (×1). The dot is consumed
    //    when the sentence continues; at a phrase end it stays. Boundaries are explicit lookarounds.
    //    "va h.k.)" already carries the va, so the expansion is the bare noun — see the corpus instance.
    s = rewrite(s, /(?<![\p{L}\p{M}])h\.k\.(?=\s+\p{L})/giu, "hokazo");
    s = rewrite(s, /(?<![\p{L}\p{M}])h\.k\.(?=\s*(?:[.,;:!?»)]|$))/giu, "hokazo.");
    s = rewrite(s, /(?<![\p{L}\p{M}])mln\.(?=\s+\p{L})/giu, "million");
    s = rewrite(s, /(?<![\p{L}\p{M}])mln\.(?=\s*(?:[.,;:!?»)]|$))/giu, "million.");

    // 3) CLOCK, before the symbol tier can see the separator. `10:00` → the hour alone (`:00` drops the
    //    minutes, as Uzbek says "soat oʻn"); `11:35` → "11 35" (hour space minute). Output stays DIGITS so
    //    the number path expands them. The corpus's "(TO)" timezone marker is left for the initialism pass.
    s = rewrite(s, /(?<![\d.,:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu, (_m: string, h: string, min: string) =>
        Number(min) === 0 ? h : `${h} ${min}`);

    // 4) VERSION DOTS, before the ordinal rule: `802.11n`, `1.1-rasmga`. The dot is neither a thousands
    //    separator (Uzbek groups with spaces) nor a decimal (comma), so `\d.\d` is a version number. Read
    //    "nuqta" (point). A following hyphen-word (a figure reference, `1.1-rasmga`) is consumed here so
    //    the ordinal rule cannot claim the trailing digit.
    s = rewrite(s, new RegExp(`(?<![\\d.,])(\\d+)\\.(\\d+)(?:-(${WORD}+))?(?!${WORD})`, "gu"),
        (_m: string, a: string, b: string, w?: string) => (w === undefined ? `${a} nuqta ${b}` : `${a} nuqta ${b} ${w}`));

    // 5) ORDINAL `N-word` — the defining rule (see the header). Every digit-hyphen-word reads the number
    //    as an ORDINAL and keeps the word. Exceptions, both measured in the corpus: `7-regbi` (rugby
    //    sevens — a sport name, read *yetti regbi*) and `2005-moliviy` (a fiscal-year compound, read
    //    cardinal). The regex is letter-bounded so `802.11n` (no hyphen) and `Super-G` (no digit) are
    //    untouched.
    s = rewrite(s, new RegExp(`${DIGITS}-(${WORD}+)(?!${WORD})`, "gu"),
        (_m: string, d: string, w: string): string => {
            if (w.toLowerCase().startsWith("regbi") || w.toLowerCase().startsWith("moliviy"))
                return `${numberToWords(Number(d.replace(",", ".")))} ${w}`;
            const ord = ordinalWords(Number(d.replace(",", ".")));
            return ord === undefined ? `${d} ${w}` : `${ord} ${w}`;
        });

    // 6) REGNAL ORDINALS. The shared Roman pass converts `Yelizaveta II` → `Yelizaveta 2` (its century
    //    policy only fires on asr/yuzyillik/…; a bare name gets the cardinal digit). The digit after a
    //    capitalized NAME is read as an ordinal — *Yelizaveta ikkinchi*, *Lealofi uchinchi*. The guard is
    //    the corpus's genitive, and ONLY that: every instance is followed by "ning" (of the …) or
    //    "hukmronligidan" (reign of …). A looser guard that also accepted a clause end read any
    //    "Capitalized N." as regnal — "Sahifa 12." became *Sahifa oʻn ikkinchi* — and bought nothing, since
    //    no corpus instance takes that shape. The rule declines on scores and percents ("Gingrich 32 foiz",
    //    "Betten 2,3 milliard", "Oxirgi 3 oy"), and the comma-guard keeps "Izmir 3,7 million" cardinal.
    s = rewrite(s, /(\p{Lu}\p{Ll}+\p{M}*)[ \u00a0](\d{1,2})(?![,\d])(?=[ \u00a0](?:ning|hukmron))/gu,  // space, NBSP
        (_m: string, name: string, d: string): string => {
            const n = Number(d);
            const ord = ordinalWords(n);
            return ord === undefined || n < 2 || n > 39 ? _m : `${name} ${ord}`;
        });

    // 7) FRACTIONS. ¾/½ after a whole read "va uch chorak" / "va yarim" (the corpus's "29¾ duymga 24½
    //    duym"); a slashed fraction reads DENOMINATOR-ablative + numerator, composed from the number words
    //    rather than a table (1/5 → beshdan bir, 3/4 → toʻrtdan uch — a numerator-1-only table read `3/4`
    //    as the bare cardinals *uch toʻrt*). 1/2 and 1/4 keep their idioms (yarim, chorak). The
    //    vulgar-fraction glyphs are not in any clause-punctuation map, so they were being dropped outright.
    s = rewrite(s, /(\d+)¾/gu, "$1 va uch chorak");
    s = rewrite(s, /(\d+)½/gu, "$1 va yarim");
    // The slash guards exclude a DATE (16/11/1978) and a further slash on either side, which a bare
    // digit-boundary guard let through — `1/5/2020` would have read *beshdan bir/2020*.
    s = rewrite(s, /(?<![\d.,/])(\d{1,2})\/(\d{1,2})(?![\d.,/])/gu, (_m: string, a: string, b: string) => {
        const num = Number(a),
            denom = Number(b);
        if (denom < 2 || num < 1 || num >= denom) return _m; // an improper/degenerate ratio is not a fraction
        if (num === 1 && denom === 2) return "yarim";
        if (num === 1 && denom === 4) return "chorak";
        return `${numberToWords(denom)}dan ${numberToWords(num)}`;
    });

    // 8) DEGREE, before the sign rule can strand the +. `30°C` → "30 daraja" (the corpus's own word for
    //    temperature; "daraja" ×57). The C is dropped as Uzbek says "oʻttiz daraja", not "Selsiy".
    s = rewrite(s, /(\d)\s?°\s?C(?![\p{L}\p{M}])/giu, "$1 daraja");
    // Fahrenheit is NAMED, since "daraja" alone would assert the corpus's Celsius default.
    s = rewrite(s, /(\d)\s?°\s?F(?![\p{L}\p{M}])/giu, "$1 daraja farengeyt");
    s = rewrite(s, /(\d)\s?°(?![\p{L}\p{M}])/gu, "$1 daraja");

    // 9) SIGNS. The corpus's `+30°C`, `(UTC+1)` and `B&B`; the sign classes from the review checklist are
    //    all probed. Uzbek: + = plyus, - = minus, & = va, = = teng, < = kichik, > = katta, × = karra.
    //    `A&B` reads the letters BY NAME (*be va be*) — the shared initialism pass cannot, a lone capital
    //    is not an all-caps run.
    // INFIX before POSTPOSED: with the postposed rule first, `2+2` lost its separator (→ "2 plyus2").
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it. It needs
    //    its own rule or the sign is dropped in silence; ordering against the `+` rule is free. The
    //    reading is this language's own two words juxtaposed, both taken from the plus and minus rules
    //    already in this file.
    s = rewrite(s, /±/gu, " plyus minus ");
    s = rewrite(s, /(\S)\+\s?(\d)/gu, "$1 plyus $2");    // UTC+1 → UTC plyus 1
    s = rewrite(s, /(\d)\s?\+/gu, "$1 plyus");           // postposed + (30+)
    s = rewrite(s, /(^|\s)\+\s?(\d)/gu, "$1plyus $2");   // +30 → plyus 30
    s = rewrite(s, /(?<![\p{L}\p{Nd}])[-−](?=\d)/gu, "minus ");
    s = rewrite(s, /([A-Za-z])&([A-Za-z])/g,
        (_m: string, a: string, b: string) => `${LETTER_NAME[a.toLowerCase()] ?? a} va ${LETTER_NAME[b.toLowerCase()] ?? b}`);
    s = rewrite(s, /&/gu, " va ");
    s = rewrite(s, /(\S)\s*=\s*(\S)/gu, "$1 teng $2");   // x = y → x teng y
    s = rewrite(s, /(\d)\s*<\s*(\d)/gu, "$1 kichik $2");
    s = rewrite(s, /(\d)\s*>\s*(\d)/gu, "$1 katta $2");
    s = rewrite(s, /(\d)\s*×\s*(\d)/gu, "$1 karra $2");
    s = rewrite(s, /(\d)\s*÷\s*(\d)/gu, "$1 boʻlish $2");

    // 9b) PERCENT with a POSSESSIVE SUFFIX — `93%i ulangan` = "its 93% are connected" → *toʻqson uch foizi
    //     ulangan*. The plain `N%` is left for the shared symbol tier (→ foiz); only the suffixed form is
    //     claimed here because the tier's regex cannot see past the trailing letter.
    // ⚠ `(?![\p{L}\p{M}])`, NOT `\b`. JS defines `\b` on ASCII `\w`, so the modifier letters Uzbek writes
    //    constantly — the ʻ of oʻ/gʻ — counted as a boundary and let the rule fire into them. See #949.
    s = rewrite(s, /(\d+)%i(?![\p{L}\p{M}])/gu, "$1 foizi");

    // 10) RATES, before the shared symbol tier: the corpus's own prose reads them PREFIXED ("soatiga 240
    //     kilometr", "soniyasiga 1,5 km") and the tier only emits "N kilometr soatiga"-shaped. km/s in the
    //     corpus means km per hour (s = soat; "40 mil/soat (64 km/s)" is 40 mph = 64 km/h), while m/s is
    //     metres per second ("133 m/s; 300 milya/soat" = 480 km/h). A case suffix travels with the
    //     denominator ("480 km/soatgacha" → soatiga … kilometrgacha, "160 km/soatga" → … kilometrga, "70
    //     km/s ga" → … kilometrga), and a RANGE reads "dan …" (35–40 mil/s → soatiga 35 dan 40 mil). The
    //     slash is consumed here so neither the unit nor the denominator is stranded.
    const rateSuffix = "(?:\\s?(ga|gacha|dan|da))?";
    s = rewrite(s, new RegExp(`(\\d+(?:,\\d+)?)[–-](\\d+(?:,\\d+)?)\\s?km\\s?\\/\\s?(?:soat|s|h)(?![\\p{L}\\p{M}])`, "giu"),
        "soatiga $1 dan $2 kilometr");
    s = rewrite(s, new RegExp(`(\\d+(?:,\\d+)?)[–-](\\d+(?:,\\d+)?)\\s?mil\\s?\\/\\s?(?:soat|s|h)(?![\\p{L}\\p{M}])`, "giu"),
        "soatiga $1 dan $2 mil");
    s = rewrite(s, new RegExp(`(\\d+(?:,\\d+)?)\\s?km\\s?\\/\\s?(?:soat|s|h)${rateSuffix}(?![\\p{L}\\p{M}])`, "giu"),
        (_m: string, n: string, sfx: string) => `soatiga ${n} kilometr${sfx ?? ""}`);
    s = rewrite(s, new RegExp(`(\\d+(?:,\\d+)?)\\s?mil\\s?\\/\\s?(?:soat|s|h)${rateSuffix}(?![\\p{L}\\p{M}])`, "giu"),
        (_m: string, n: string, sfx: string) => `soatiga ${n} mil${sfx ?? ""}`);
    s = rewrite(s, new RegExp(`(\\d+(?:,\\d+)?)\\s?milya\\s?\\/\\s?soat${rateSuffix}(?![\\p{L}\\p{M}])`, "giu"),
        (_m: string, n: string, sfx: string) => `soatiga ${n} milya${sfx ?? ""}`);
    s = rewrite(s, new RegExp(`(\\d+(?:,\\d+)?)\\s?m\\s?\\/\\s?s${rateSuffix}(?![\\p{L}\\p{M}])`, "giu"),
        (_m: string, n: string, sfx: string) => `soniyasiga ${n} metr${sfx ?? ""}`);
    // Gigahertz as the corpus writes it — `2,4 Gs va 5,0 Gs` (802.11n). Uzbek for GHz is gigagerts.
    s = rewrite(s, /(\d+(?:,\d+)?)\s?Gs\b(?![\p{L}\p{M}])/giu, "$1 gigagerts");

    // 10b) LONE PERSONAL INITIALS the shared pass cannot claim. The shared LONE_INITIAL fires only for a
    //     capital BETWEEN two capitalized words ("Jorj V. Bush"); "T. rex" and "N. Ueyn" are a capital +
    //     period before a LOWERCASE word, so the letter reached the g2p as a bare consonant plus a break.
    //     Claimed only when a LETTER follows the dot (a name or a word); "S. 42" — a period before a digit
    //     — stays a page reference. The shared pass still handles "D. K. Arya" (two initials) itself.
    s = rewrite(s, /(?<![\p{L}\p{M}])([A-Z])\.(?=[ \u00a0]+[A-Za-z])/gu, (_m: string, l: string) =>  // space, NBSP
        LETTER_NAME[l.toLowerCase()] ?? l);

    // 11) INITIALISMS, LAST of the letter rules: it must run after the era markers (else m.a. → *em a*)
    //     and after the abbreviations. AQSH stays the word [aqʃ]; BMT/MS/GPS spell out.
    s = normalizeInitialisms(s);

    return s;
}
