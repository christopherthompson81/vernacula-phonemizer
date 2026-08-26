/**
 * Central Kurdish / Sorani (ckb) text normalization — the pre-tokenizer pass that rewrites everything the
 * Kurdish g2p cannot already read into Kurdish words the pipeline speaks. Pure text→text, no IPA. Runs
 * inside central-kurdish.ts's `text()`, before the tokenizer.
 *
 * ⚠ THE LANGUAGE'S OWN DIGITS PRODUCE AN EMPTY STRING WITHOUT THE FOLD. `٢٠٢٤` phonemizes to `""`, and so
 * does `١٠٠٠٠`. The cause is the tokenizer's letter class, `[ؠ-ۿ]` = U+0620–U+06FF, which CONTAINS the
 * Arabic-Indic digits U+0660–U+0669 — so a digit run is claimed by the LETTER branch and the word
 * phonemizer has nothing to say about it, while the `(\d+)` branch can never see it. The Arabic-Indic digits
 * are the MAJORITY system in Kurdish text, so this is most of the numerals in a document.
 * The fix is `foldNativeDigits` (core/unicode.ts) rather than a local table; its block-base arithmetic covers
 * the Extended Arabic-Indic range ۰-۹ too.
 *
 * ⚠ KURDISH USES THE ENGLISH NUMERIC CONVENTIONS, unlike its European neighbours in this tree: the comma is
 * the THOUSANDS separator (`30,000`) and the period is the DECIMAL point (`2.4`). Danish, Romanian, Bulgarian
 * and Norwegian are all the other way round, and reading `30,000` as a decimal turns thirty thousand into
 * "thirty point zero zero zero".
 *
 * ⚠ `802.11` IS A DESIGNATION, NOT A QUANTITY. The decimal rule accepts one or two fractional digits, so the
 * Wi-Fi standard's `.11` is claimed as a decimal — harmless, since it is spoken as a number either way —
 * while the three-digit `,000` grouping is not.
 *
 * ORDERING:
 *   · THE DIGIT FOLD IS FIRST. Every rule below counts digits, and none would match a native one.
 *   · DE-GROUPING before the decimal rule, or `30,000` is read as a fraction.
 */
import { foldNativeDigits } from "../../core/unicode.ts";

/** Relational and operator signs, read in every position — a dropped sign is inaudible. */
const RELATIONAL: [RegExp, string][] = [
    [/±/gu, " کۆ و لێدەرکراو "],
    [/=/gu, " یەکسانە بە "],
    [/</gu, " کەمتر لە "],
    [/>/gu, " زیاتر لە "],
    // ⚠ ASCII `x` TOO, not only `×`: `NxN` forms outnumber `×` roughly 85 to 20 across the corpora, and the
    // bare `x` was reaching the phoneme stream as its own LETTER NAME. Digit-bounded, so it cannot claim a letter.
    [/×|(?<=\p{Nd})[ \t]?x[ \t]?(?=\p{Nd})/gu, " لە "],
    [/÷/gu, " دابەش بە "],
];

/** Currency sign → the Kurdish word. */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "دۆلار", "€": "یۆرۆ", "£": "پاوەند", "¥": "یەن",
};

/**
 * ARABIC-KEYBOARD LETTERFORMS → the Sorani codepoints for the same letters.
 *
 * ⚠ AN ENCODING QUESTION, AND THE CORPUS SETTLES IT INSIDE SINGLE WORDS. Sorani writes /k/ as ⟨ک⟩ U+06A9 and
 * its yeh as ⟨ی⟩ U+06CC, but an Arabic keyboard produces ⟨ك⟩ U+0643 and ⟨ى⟩ U+0649, and neither is in
 * `central-kurdish.jsonc` — so `silentCharsIn` found them deleted, ⟨ك⟩ ×12 and ⟨ى⟩ ×3. The evidence needs no
 * outside source: the mined artifact writes BOTH FORMS IN THE SAME WORD — ⟨خولەکێك⟩ and ⟨تێكشکا⟩ each carry a
 * ک and a ك — against ⟨ک⟩ ×414 and ⟨ی⟩ ×704 elsewhere. `كەسێک → aseːk` was losing its initial /k/ outright.
 * ⟨ي⟩ U+064A is folded with them: same letter, same keyboard, and absent from the manifest for the same
 * reason.
 */
const LETTERFORM: Readonly<Record<string, string>> = { "ك": "ک", "ى": "ی", "ي": "ی" };
const LETTERFORM_RE = new RegExp(`[${Object.keys(LETTERFORM).join("")}]`, "gu");

export function normalizeCentralKurdish(input: string): string {
    // 0) THE ARABIC LETTERFORMS, before anything reads a word — a rule keyed on a Sorani spelling would
    //    otherwise miss every instance typed the Arabic way.
    input = input.replace(LETTERFORM_RE, (c) => LETTERFORM[c]!);

    // 1) FOLD THE NATIVE DIGITS FIRST — see the header. Without this every rule below is blind to the
    //    majority of the text's digits, and the engine reads them as an empty string.
    let t = foldNativeDigits(input);

    // 2) COMMA-GROUPED THOUSANDS, before the decimal rule. Kurdish follows the ENGLISH convention, so the
    //    comma is a GROUPING mark and reading it as a decimal turns `30,000` into "thirty point zero zero
    //    zero".
    let prev: string;
    do {
        prev = t;
        t = t.replace(/(?<=\d)[,،](?=\d{3}(?!\d))/gu, "");
    } while (t !== prev);

    // 2b) LATIN UNIT ALIASES AND THEIR POWERS. No new vocabulary — a second KEY onto the words step 6b
    //     already declares, because `5 km` reaches the g2p as the cluster [ˈʊkm] while `5 کم` reads correctly.
    //     A Latin `m` key is safe here, unlike the Arabic-script `م`, because the Latin runs in Kurdish text
    //     are designations (`4Ghz`, `1a`, `1b`) and never a bare `m`.
    //     ⚠ THIS RUNS BEFORE THE DECIMAL RULE (3), and the ordering is FORCED rather than tidy: step 3
    //     replaces the dot with the WORD خاڵ, so a rule placed after it sees `802 خاڵ 1 1 m` and the
    //     `NOT_VERSION` guard below has no dot left to recognise — `802.11m` reads as metres.
    //     ⚠ BUT AFTER DE-GROUPING (2), or `19،500 km` matches only its last three digits.
    //     ⚠ THE EXPONENT ARM MUST COME FIRST, or the plain rule below consumes the unit and strands the `²`.
    //     Both measure words FOLLOW the noun: دووجا (squared), سێجا (cubed).
    const CKB_UNIT: Readonly<Record<string, string>> = {
        km: "کیلۆمەتر", cm: "سانتیمەتر", mm: "میلیمەتر", m: "مەتر",
    };
    const ckbUnits = Object.keys(CKB_UNIT).sort((a, b) => b.length - a.length).join("|");
    //     A DOTTED DESIGNATION IS NOT A QUANTITY (`802.11m`) — `NOT_VERSION` from the shared tier, guarding
    //     the WHOLE number, because a lookbehind on the adjacent digit would also reject `12.8 کم` above.
    const CKB_NUM = "(?<![\\d.,])(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))(\\d[\\d.,]*)";
    t = t.replace(new RegExp(`${CKB_NUM}\\s*(${ckbUnits})(?:\\s?([²³])|([23])(?![\\d\\p{L}]))`, "giu"),
        (_m, n: string, u: string, sup: string | undefined, ascii: string | undefined) =>
            `${n} ${CKB_UNIT[u.toLowerCase()]!} ${(sup ?? ascii) === "³" || (sup ?? ascii) === "3" ? "سێجا" : "دووجا"}`);
    //     ⚠ RATES BEFORE THE PLAIN ARM, or that arm consumes the numerator and strands the slash, leaving
    //     `120 km/h` to read the denominator as the ENGLISH LETTER NAME [ˈeᶦt͡ʃ] and `133 m/s` as [ˈɛs].
    //     `لە` is the "per", `کاتژمێر` the hour, `چرکە` the second. A PERSO-ARABIC denominator against a slash
    //     (`مەتر/چرکە`) is claimed too — otherwise the slash is silently dropped.
    const CKB_PER: Readonly<Record<string, string>> = {
        h: "کاتژمێر", s: "چرکە", "کاتژمێر": "کاتژمێر", "چرکە": "چرکە",
    };
    const ckbPer = Object.keys(CKB_PER).sort((a, b) => b.length - a.length).join("|");
    t = t.replace(new RegExp(`${CKB_NUM}\\s*(${ckbUnits})\\s*/\\s*(${ckbPer})(?![\\p{L}\\p{M}\\d])`, "giu"),
        (_m, n: string, u: string, d: string) =>
            `${n} ${CKB_UNIT[u.toLowerCase()]!} لە ${CKB_PER[d.toLowerCase()]!}`);
    //     …and the PERSO-ARABIC numerator, which the corpus writes as `کم/کاتژمێر` and `مەتر/چرکە`.
    //     ⚠ THE ABBREVIATION MUST BE ACCEPTED HERE, NOT JUST THE SPELLED WORD. This block sits at step 2b,
    //     above the decimal rule, while the Perso-Arabic unit expansion is step 6b further DOWN — so at this
    //     point `کم` has not become `کیلۆمەتر` yet, and an arm matching only the spelled forms silently misses
    //     `کم/کاتژمێر`.
    const CKB_NUMER: Readonly<Record<string, string>> = {
        "کم": "کیلۆمەتر", "کیلۆمەتر": "کیلۆمەتر", "مەتر": "مەتر", "سم": "سانتیمەتر",
    };
    const ckbNumer = Object.keys(CKB_NUMER).sort((a, b) => b.length - a.length).join("|");
    t = t.replace(new RegExp(`(\\d[\\d.,]*)\\s*(${ckbNumer})\\s*/\\s*(${ckbPer})(?![\\p{L}\\p{M}\\d])`, "gu"),
        (_m, n: string, u: string, d: string) => `${n} ${CKB_NUMER[u]!} لە ${CKB_PER[d]!}`);
    t = t.replace(new RegExp(`${CKB_NUM}\\s*(${ckbUnits})(?![\\p{L}\\p{M}\\d])`, "giu"),
        (_m, n: string, u: string) => `${n} ${CKB_UNIT[u.toLowerCase()]!}`);

    // 3) DECIMAL POINT (47) — again the English convention. The period is clause punctuation, so `2.4`
    //    read as "two" + a SENTENCE BREAK + "four". Fractional part spoken digit by digit.
    t = t.replace(/(\d+)\.(\d+)/gu, (_m, whole: string, frac: string) =>
        `${whole} خاڵ ${[...frac].join(" ")}`);

    // 4) CLOCK, COLON FORM (25). The colon was reaching clausePunctuation as a COMMA PAUSE, so `11:00`
    //    read as "یانزە , سفر".
    t = t.replace(/(\d{1,2}):(\d{2})(?!\d)/gu, "$1 $2");

    // 5) PERCENT (5) → `لە سەدا` ("out of a hundred"), the construction the corpus writes out (11).
    //    Kurdish PREPOSES it, unlike every other language in this sequence: `لە سەدا ٢٥`, not `٢٥ لە سەدا`.
    //    BOTH PLACEMENTS of the sign are claimed. The corpus writes `٨٨%` five times and `%٨٨` once —
    //    the sign-first form is the Arabic-script convention and a rule anchored only on the digit-first
    //    shape leaves it silent. The READING is preposed either way.
    t = t.replace(/(\d+)\s*%/gu, "لە سەدا $1");
    t = t.replace(/%\s*(\d+)/gu, "لە سەدا $1");

    // 6) DEGREES. `پلە` is the word (90 in the corpus); the scale letter would otherwise reach the Latin
    //    fallback and be read as an English letter name.
    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    t = t.replace(/(\d)\s*°\s*C(?!\p{L})/giu, "$1 پلەی سەلیزی");
    t = t.replace(/(\d)\s*°\s*F(?!\p{L})/giu, "$1 پلەی فەهرەنهایت");
    t = t.replace(/(\d)\s*°/gu, "$1 پلە");

    // 6b) UNIT ABBREVIATIONS. `19500 کم` read the abbreviation as raw letters — the `ˈʊkm` shape found
    //     fleet-wide — and the corpus writes them 32 times, EVERY ONE after a numeral:
    //
    //       کم ×30  "پارکەکە 19500 کم دووجا دایپۆشیوە"  ·  "بە نزیکەی 12.8 کم یان 8 میل"
    //       سم ×2   "فیلمی کامێرای شێوە مامناوەندی 6 بە 6 سم بەکاردەهێنن"
    //
    //     A NUMERAL MUST PRECEDE, and that guard is the whole safety of this rule rather than a nicety. The
    //     Persian pass measured the same two graphemes and found the opposite: `کم` occurs 63 times in fa_ir
    //     and NEVER after a numeral, because there it is the adjective "little/few" ("اصطکاک کم است" — friction
    //     is low), and `سم` ×5 is "poison". An unguarded table would read 68 ordinary Persian words as units.
    //     In ckb both are 30/30 and 2/2 after a numeral, so the guard costs nothing here and is load-bearing
    //     for anyone copying the table.
    //
    //     The words are the corpus's own spelled-out forms (کیلۆمەتر ×33, and سانتیمەتر from the same source
    //     as `سم`'s expansion). The exponent needs no rule: the corpus already writes it as the WORD دووجا
    //     after the unit ("کم دووجا"), so expanding the abbreviation leaves "کیلۆمەتر دووجا" intact.
    //     `م` and `کگ` are NOT declared — `م` is a one-letter key in a script where it is a very common
    //     letter, and `کگ` occurs zero times.
    t = t.replace(/(\d)\s*کم(?![\p{L}\p{M}])/gu, "$1 کیلۆمەتر");
    t = t.replace(/(\d)\s*سم(?![\p{L}\p{M}])/gu, "$1 سانتیمەتر");
    // 7) RANGES (34). Spoken `بۆ` ("to"), which is an ordinary word in the corpus (2057).
    t = t.replace(/(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)/gu, "$1 بۆ $2");

    // 8) CURRENCY, both placements — the corpus writes none, but a phonemizer is handed arbitrary text.
    for (const [sign, word] of Object.entries(CURRENCY)) {
        const esc = sign.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        t = t.replace(new RegExp(`${esc}\\s*(\\d+)`, "gu"), `$1 ${word}`);
        t = t.replace(new RegExp(`(\\d+)\\s*${esc}`, "gu"), `$1 ${word}`);
    }

    // 9) SIGNED NUMBERS — a sign PREFIXED to a number, `UTC+1` (2 instances). The boundary here must
    //    admit a LETTER before the sign, unlike the European languages where that shape is a hyphenated
    //    compound: a timezone offset is written directly against its abbreviation.
    //    The replacement carries a LEADING space: the sign sits directly against the abbreviation
    //    (`UTC+1`), so without it the word fuses on as `UTCکۆ`. The trailing collapse tidies the double.
    t = t.replace(/(?<![\d])([-−+])(\d+)/gu, (_m, sign: string, n: string) =>
        ` ${sign === "+" ? "کۆ" : "کەم"} ${n}`);

    // 10) ARITHMETIC AND RELATIONAL SIGNS — infix between digits is where arithmetic lives; the relational
    //    signs are read in every position, because a dropped sign is inaudible.
    t = t.replace(/(\d)\s*\+\s*(\d)/gu, "$1 کۆ $2");
    for (const [re, word] of RELATIONAL) t = t.replace(re, word);

    // 11) AMPERSAND → و ("and"), which is the commonest word in the corpus (32,622).
    t = t.replace(/\s*[&＆]\s*/gu, " و ");

    // The insertions above pad with spaces so a sign never fuses with its neighbours; collapse the runs.
    return t.replace(/[ \t]{2,}/gu, " ");
}
