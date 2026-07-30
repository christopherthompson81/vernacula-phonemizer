/**
 * Arabic (ar and its varieties) TEXT NORMALIZATION — the pre-tokenizer pass for what the engine's number
 * tokenizer and the shared symbol tier do not already handle. Pure text→text; no IPA.
 *
 * Seventh language. Arabic arrived with its punctuation already right — the Arabic comma ، (×1664 in the
 * corpus), semicolon ؛ and question mark ؟ are all clause marks, and Arabic-Indic digits already fold to
 * ASCII in the number path — so what is left is narrower than elsewhere.
 *
 * THE ARABIC-SPECIFIC SYMBOL CHARACTERS are the heart of this file. Unicode gives Arabic its own percent
 * sign ٪ U+066A, decimal separator ٫ U+066B and thousands separator ٬ U+066C, and every shared rule in the
 * fleet is written against the ASCII ones. So ٪ was DROPPED outright — a known-deferred defect, and the
 * corpus's one instance is "93٪ من السكان", where the percentage simply vanished. Folding them to their
 * ASCII equivalents here means the shared symbol tier and the number tokenizer both work unchanged, rather
 * than every downstream rule needing an Arabic branch.
 *
 * A MEASUREMENT TRAP worth recording, because it nearly produced a damaging rule: a naive abbreviation
 * scan reports `م.` 97 times and `د.` 3 times, which looks like the dominant abbreviation class. They are
 * not abbreviations at all — they are ordinary words ENDING in م or د followed by a sentence period
 * (بداخلهم. "inside them.", واحد. "one.", جرينلاند. "Greenland."). An abbreviation table keyed on those
 * letters would have mangled 100 ordinary sentence endings. Arabic has essentially no dotted abbreviations
 * in this corpus, so this file has no abbreviation table.
 */

/** Arabic-Indic digits, both the standard and the extended (Persian/Urdu) ranges. */
const ARABIC_DIGIT = /[٠-٩۰-۹]/gu;
const DIGIT = "0-9٠-٩۰-۹";

/** Arabic-Indic digit → ASCII. */
function foldDigit(c: string): string {
    const cp = c.codePointAt(0)!;
    if (cp >= 0x0660 && cp <= 0x0669) return String(cp - 0x0660); // ٠-٩
    if (cp >= 0x06f0 && cp <= 0x06f9) return String(cp - 0x06f0); // ۰-۹
    return c;
}

/**
 * Unit abbreviations → the full word, WRITTEN WITH HARAKAT. Every word this file emits is diacritized on
 * purpose: the engine reads undiacritized Arabic as a bare consonant skeleton, so an unvocalized emission
 * comes out as [drd͡ʒ] / [kjlwmtr] / [dqjq] rather than [dˈarad͡ʒa] / [kiːluːmˈitr] / [daqˈiːqa]. That is a
 * pre-existing limit of the OOV path for ordinary text, but it is entirely avoidable for the words WE
 * choose to insert.
 */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "كم": "كِيلُومِتْر", "سم": "سِنْتِيمِتْر", "مم": "مِلِّيمِتْر", "كجم": "كِيلُوجِرَام", "جم": "جِرَام",
    "كم/س": "كِيلُومِتْر فِي السَّاعَة",
};
const UNIT_ALT = Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length).join("|");

export function normalizeArabic(input: string): string {
    let s = input;

    // 1) ARABIC SYMBOL CHARACTERS → their ASCII equivalents, so every shared rule downstream applies. The
    //    percent sign is the known defect this fixes; the separators keep a natively-typed number readable.
    s = s.replace(/٪/gu, "%").replace(/٫/gu, ".").replace(/٬/gu, ",");

    // 2) UNIT ABBREVIATIONS after a number. Longest first so كم/س beats كم.
    s = s.replace(new RegExp(`([${DIGIT}])\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
        (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`);

    // 3) DEGREES. Case-insensitive, and the bare sign too. °C was falling through to the English reading
    //    of the letter C.
    s = s.replace(new RegExp(`([${DIGIT}])\\s?°\\s?C(?![\\p{L}])`, "giu"), "$1 دَرَجَة مِئَوِيَّة");
    s = s.replace(new RegExp(`([${DIGIT}])\\s?°\\s?F(?![\\p{L}])`, "giu"), "$1 دَرَجَة فَهْرَنْهَايْت");
    s = s.replace(new RegExp(`([${DIGIT}])\\s?°`, "gu"), "$1 دَرَجَة");

    // 4) CLOCK. The colon was a clause mark, so "11:00" became "eleven , zero" — a PAUSE plus a spurious
    //    صفر. The plain cardinal + دقيقة form used here is the register a TTS front end can produce without
    //    gender/definiteness agreement on the hour name.
    //
    //    الساعة is supplied ONLY when the text does not already have it. In this corpus it essentially
    //    always does ("في تمام الساعة 8:46", "حوالي الساعة 11:00"), and adding it unconditionally produced
    //    "الساعة الساعة" — a defect this rule introduced, caught by the corpus diff rather than by a probe.
    s = s.replace(new RegExp(`(الساعة\\s*)?(?<![${DIGIT}:])([${DIGIT}]{1,2}):([${DIGIT}]{2})(?![${DIGIT}:])`, "gu"),
        (whole, saa: string | undefined, h: string, min: string) => {
            const hv = Number([...h].map(foldDigit).join("")), mv = Number([...min].map(foldDigit).join(""));
            if (hv > 23 || mv > 59) return whole;
            const head = saa ?? "السَّاعَة ";
            return mv === 0 ? `${head}${hv}` : `${head}${hv} وَ ${mv} دَقِيقَة`;
        });

    // 5) SIGNS. Neither occurs in this corpus, but a dropped sign is silent content loss wherever it does.
    s = s.replace(new RegExp(`(^|[\\s(])[-−–]([${DIGIT}])`, "gu"), "$1نَاقِص $2");
    s = s.replace(new RegExp(`(\\S)\\+\\s?([${DIGIT}])`, "gu"), "$1 زَائِد $2");
    s = s.replace(new RegExp(`(^|\\s)\\+\\s?([${DIGIT}])`, "gu"), "$1زَائِد $2");

    // 6) FRACTIONS, as "numerator على denominator" — the plain spoken reading, which avoids the broken-plural
    //    forms (أخماس …) that a fully idiomatic rendering would need.
    s = s.replace(new RegExp(`(?<![${DIGIT}.,/])([${DIGIT}]{1,3})/([${DIGIT}]{1,3})(?![${DIGIT}/])`, "gu"),
        (_m, a: string, b: string) => `${a} عَلَى ${b}`);

    return s.replace(ARABIC_DIGIT, foldDigit);
}
