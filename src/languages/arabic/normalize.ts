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
    // ⚠ ± IS THIS LANGUAGE'S OWN TWO WORDS, juxtaposed — zero new sourcing (#654). Both halves are lifted from
    //    the plus and minus rules already in this file, so nothing is invented. The FORM is the one every
    //    language that already read ± uses (bg/da/is/nb/ro/sv all juxtapose with no conjunction; English is the
    //    outlier that needs "or", and it already has its own rule). Runs BEFORE the + rule: ± is a single
    //    character, so the + rule cannot see it, and putting it first keeps the sign audible either way.
    s = s.replace(/±/gu, " زَائِد نَاقِص ");
    s = s.replace(new RegExp(`(\\S)\\+\\s?([${DIGIT}])`, "gu"), "$1 زَائِد $2");
    s = s.replace(new RegExp(`(^|\\s)\\+\\s?([${DIGIT}])`, "gu"), "$1زَائِد $2");

    // 5aa) RELATIONAL AND DIVISION SIGNS (#654). The register source states the mapping outright — ar.wikipedia's
    //      division article writes «يُرمز إلى القسمة بالعلامة ÷» ("division is denoted by the sign ÷") and then
    //      glosses the equality directly: «إذا كان جداء b و c يساوي a, أي a = b × c». The words in the slot,
    //      beside the very signs this rule reads.
    //
    //        يساوي      ×38 token / 9 articles — "فالناتج يساوي 2", "فإن المعدل يساوي 2000"
    //        أصغر من    "البسط أصغر من المقام" (numerator smaller than denominator), "أصغر من 16 عامًا"
    //        أكبر من    "عدد طبيعي أكبر من 1" (a natural number greater than 1)
    //        مقسوم على  "مجموع عددين مقسوم على أكبرهما يساوي خارج قسمة …"
    //
    //      ⚠ AND THE CORPUS'S OWN `أكبر من` ×10 IS THE PARTITIVE, NOT THE COMPARATIVE — "مجموعة أكبر من الأماكن
    //      الصغيرة" is "a LARGER SET OF small places", where مِن marks the partitive rather than the standard of
    //      comparison. Arabic writes both with the same two words, exactly as Italian does with `maggiore di`,
    //      so the tier-2 phrase count cannot separate them and the register quotes are what settle it. The
    //      equality word is absent from ar_eg altogether (×0 token / ×0 substring).
    //
    //      ⚠ FULLY DIACRITIZED, like every other word this file emits. The engine reads short vowels from the
    //      text, so an undiacritized يساوي would be read off its consonant skeleton.
    s = s.replace(/\s?=\s?/gu, " يُسَاوِي ");
    s = s.replace(/\s?<\s?/gu, " أَصْغَر مِن ");
    s = s.replace(/\s?>\s?/gu, " أَكْبَر مِن ");
    s = s.replace(/\s?÷\s?/gu, " مَقْسُوم عَلَى ");

    // 5b) THE DIMENSION `×` → في, SOURCED FROM THE CORPUS'S OWN AUDIO. The corpus writes it twice, both times
    //     as a MEASUREMENT and not a multiplication: `مقاس 35 مم (36× 24 مم نيجاتيف)` and the manuscript's
    //     `ذات مقاسات 29¾ بوصة × 24½ بوصة`. Before this the sign was dropped, so "36 by 24 mm" read as two
    //     bare numbers with nothing between them.
    //
    //     ⚠ THE WORD COULD NOT BE SOURCED FROM TEXT, and في is exactly why: probed against prose it returns
    //     thousands of hits, every one the locative preposition ("in the north", "in Jordan") — trap 37 (the bare modifier is never the attestation) with
    //     an overwhelming wrong-sense majority. The dimension sense is invisible in writing because writing
    //     uses the glyph. What settles it is the FLEURS recording of the sentence, where the slot is audibly
    //     filled: Cohere renders `…خمسة وثلاثين ملليمتر ستة وثلاثين في أربعة وعشرين ملليمتر…`, and Qwen3-ASR
    //     independently gives the same ف-initial function word in the same slot. One speaker, two decoders —
    //     which settles the TRANSCRIPTION, not speaker variation; the second instance sits in ar's `test`
    //     split, whose audio this corpus does not carry.
    //
    //     Keyed on the FOLLOWING digit only, deliberately. The dimension `×` is NOT reliably digit-flanked —
    //     in `29¾ بوصة × 24½ بوصة` the left neighbour is a unit WORD and the numbers carry vulgar fractions,
    //     so the `(\d)\s*×\s*(\d)` shape that Czech uses misses it outright.
    // ⚠ ASCII `x` TOO: `NxN` outnumbers `×` roughly 85 to 20 in the corpora and the bare `x` was read as its
    // own LETTER NAME. Digit-bounded on both sides so it cannot claim a letter.
    s = s.replace(new RegExp(`\\s*(?:×|(?<=[${DIGIT}])x)\\s*(?=[${DIGIT}])`, "gu"), " في ");

    // 6) FRACTIONS, as "numerator على denominator" — the plain spoken reading, which avoids the broken-plural
    //    forms (أخماس …) that a fully idiomatic rendering would need.
    s = s.replace(new RegExp(`(?<![${DIGIT}.,/])([${DIGIT}]{1,3})/([${DIGIT}]{1,3})(?![${DIGIT}/])`, "gu"),
        (_m, a: string, b: string) => `${a} عَلَى ${b}`);

    return s.replace(ARABIC_DIGIT, foldDigit);
}
