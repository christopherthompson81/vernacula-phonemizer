import { tr } from "../../core/provenance.ts";
/**
 * Arabic (ar and its varieties) text normalization — the pre-tokenizer pass for what the engine's number
 * tokenizer and the shared symbol tier do not already handle. Pure text→text; no IPA.
 *
 * Arabic arrives with its punctuation already right — the Arabic comma ،, semicolon ؛ and question mark ؟ are
 * all clause marks, and Arabic-Indic digits already fold to ASCII in the number path — so what is left is
 * narrower than elsewhere.
 *
 * ⚠ THE ARABIC-SPECIFIC SYMBOL CHARACTERS ARE THE HEART OF THIS FILE. Unicode gives Arabic its own percent
 * sign ٪ U+066A, decimal separator ٫ U+066B and thousands separator ٬ U+066C, and every shared rule in the
 * fleet is written against the ASCII ones — so ٪ is DROPPED outright and a percentage simply vanishes.
 * Folding them to ASCII here means the shared tier and the number tokenizer both work unchanged, rather than
 * every downstream rule needing an Arabic branch.
 *
 * ⚠ A MEASUREMENT TRAP, recorded because it nearly produced a damaging rule: a naive abbreviation scan
 * reports `م.` and `د.` in the hundreds, which looks like the dominant abbreviation class. They are not
 * abbreviations at all — they are ordinary words ENDING in م or د followed by a sentence period (بداخلهم.
 * "inside them.", واحد. "one."). A table keyed on those letters would mangle every such sentence ending.
 * Arabic has essentially no dotted abbreviations, so this file has no abbreviation table.
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
 * Unit abbreviations → the full word, WRITTEN WITH HARAKAT.
 *
 * ⚠ EVERY WORD THIS FILE EMITS IS DIACRITIZED ON PURPOSE: the engine reads undiacritized Arabic as a bare
 * consonant skeleton, so an unvocalized emission comes out [drd͡ʒ] / [kjlwmtr] / [dqjq] rather than
 * [dˈarad͡ʒa] / [kiːluːmˈitr] / [daqˈiːqa]. That is a pre-existing limit of the OOV path for ordinary text,
 * but it is entirely avoidable for the words WE choose to insert. The one exception is في (step 7), which
 * carries its own mater lectionis and so needs no harakat.
 */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "كم": "كِيلُومِتْر", "سم": "سِنْتِيمِتْر", "مم": "مِلِّيمِتْر", "كجم": "كِيلُوجِرَام", "جم": "جِرَام",
    "كم/س": "كِيلُومِتْر فِي السَّاعَة",
};
const UNIT_ALT = Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length).join("|");

/**
 * PERSO-ARABIC LETTERFORM VARIANTS → the Arabic codepoint for the same letter.
 *
 * ⚠ THIS IS AN ENCODING QUESTION, NOT A PHONOLOGICAL ONE. ⟨ی⟩ U+06CC FARSI YEH and ⟨ي⟩ U+064A ARABIC YEH are
 * the same letter under two keyboard conventions, as are ⟨ک⟩ U+06A9 KEHEH and ⟨ك⟩ U+0643 KAF; Arabic writing
 * that has passed through a Persian or Urdu keyboard carries the eastern forms. Unfolded they matched no arm
 * of `TOKEN`, so they SPLIT their word: `silentCharsIn` reports arz ⟨ی⟩ ×24 in `separator` mode, and the
 * fragments then read as letter NAMES — `فین → fˈe nˈuːn` for في + ن.
 *
 * ⚠ AND IT MUST RUN BEFORE THE NEURAL DIACRITIZER, which is why it is exported. `diacritizer.ts` only counts
 * U+0620–U+064A / U+0671–U+06D3 as Arabic letters, so an unfolded ⟨ی⟩ makes its whole word unvocalizable —
 * folded, `فی` reaches the model as `في` and comes back `فِي` → [fiː].
 *
 * ⚠ ⟨ى⟩ U+0649 ALIF MAQSURA IS DELIBERATELY NOT HERE. It is a letter of Arabic in its own right with its own
 * g2p branch (word-final long /aː/, مصطفى), not a variant spelling of ⟨ي⟩ — folding it would silently rewrite
 * every native ـى ending. Its Urdu-script cousins are handled in those engines, where the fact differs.
 */
export function foldLetterforms(input: string): string {
    return input.replace(/ی/gu, "ي").replace(/ک/gu, "ك");
}

export function normalizeArabic(input: string): string {
    let s = foldLetterforms(input);

    // 1) ARABIC SYMBOL CHARACTERS → their ASCII equivalents, so every shared rule downstream applies.
    s = tr(s, /٪/gu, "%").replace(/٫/gu, ".").replace(/٬/gu, ",");

    // 2) UNIT ABBREVIATIONS after a number. Longest first so كم/س beats كم.
    s = tr(s, new RegExp(`([${DIGIT}])\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
        (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`);

    // 3) DEGREES. Case-insensitive, and the bare sign too — without the C/F arms, `°C` falls through to the
    //    English reading of the letter C.
    s = tr(s, new RegExp(`([${DIGIT}])\\s?°\\s?C(?![\\p{L}])`, "giu"), "$1 دَرَجَة مِئَوِيَّة");
    s = tr(s, new RegExp(`([${DIGIT}])\\s?°\\s?F(?![\\p{L}])`, "giu"), "$1 دَرَجَة فَهْرَنْهَايْت");
    s = tr(s, new RegExp(`([${DIGIT}])\\s?°`, "gu"), "$1 دَرَجَة");

    // 4) CLOCK. The colon is a clause mark, so "11:00" becomes "eleven , zero" — a PAUSE plus a spurious صفر.
    //    The plain cardinal + دقيقة form is the register a TTS front end can produce without gender or
    //    definiteness agreement on the hour name.
    //    ⚠ الساعة IS SUPPLIED ONLY WHEN THE TEXT DOES NOT ALREADY HAVE IT — and it nearly always does ("في تمام
    //    الساعة 8:46"). Adding it unconditionally gives "الساعة الساعة".
    s = tr(s, new RegExp(`(الساعة\\s*)?(?<![${DIGIT}:])([${DIGIT}]{1,2}):([${DIGIT}]{2})(?![${DIGIT}:])`, "gu"),
        (whole, saa: string | undefined, h: string, min: string) => {
            const hv = Number([...h].map(foldDigit).join("")), mv = Number([...min].map(foldDigit).join(""));
            if (hv > 23 || mv > 59) return whole;
            const head = saa ?? "السَّاعَة ";
            return mv === 0 ? `${head}${hv}` : `${head}${hv} وَ ${mv} دَقِيقَة`;
        });

    // 5) SIGNS. A dropped sign is silent content loss, so these are read whether or not a given corpus has
    //    an instance.
    s = tr(s, new RegExp(`(^|[\\s(])[-−–]([${DIGIT}])`, "gu"), "$1نَاقِص $2");
    // ⚠ ± IS THE TWO SIGN WORDS JUXTAPOSED, with no conjunction. It needs its OWN rule: ± is a single
    //    character (U+00B1), not a `+`, so no `+` rule can match inside it and the sign would otherwise
    //    be dropped in silence.
    s = tr(s, /±/gu, " زَائِد نَاقِص ");
    s = tr(s, new RegExp(`(\\S)\\+\\s?([${DIGIT}])`, "gu"), "$1 زَائِد $2");
    s = tr(s, new RegExp(`(^|\\s)\\+\\s?([${DIGIT}])`, "gu"), "$1زَائِد $2");

    // 6) RELATIONAL AND DIVISION SIGNS, all four infix.
    //    ⚠ `أكبر من` IS A HOMOGRAPH TRAP: in running prose it is overwhelmingly the PARTITIVE, not the
    //    comparative — "مجموعة أكبر من الأماكن الصغيرة" is "a LARGER SET OF small places", where مِن marks the
    //    partitive rather than the standard of comparison. Arabic writes both with the same two words, exactly
    //    as Italian does with `maggiore di`, so a phrase count cannot separate them; the mathematical register
    //    is what settles the reading.
    s = tr(s, /\s?=\s?/gu, " يُسَاوِي ");
    s = tr(s, /\s?<\s?/gu, " أَصْغَر مِن ");
    s = tr(s, /\s?>\s?/gu, " أَكْبَر مِن ");
    s = tr(s, /\s?÷\s?/gu, " مَقْسُوم عَلَى ");

    // 7) THE DIMENSION `×` → في. Arabic writes this sign as a MEASUREMENT rather than a multiplication
    //    (`مقاس 35 مم (36× 24 مم نيجاتيف)`), and unread it is dropped, so "36 by 24 mm" reads as two bare
    //    numbers with nothing between them.
    //    ⚠ في IS A HOMOGRAPH of the locative preposition, so no text count can source it — writing uses the
    //    glyph and never spells the dimension sense out.
    //    ⚠ KEYED ON THE FOLLOWING DIGIT ONLY, deliberately: the dimension `×` is NOT reliably digit-flanked.
    //    In `29¾ بوصة × 24½ بوصة` the left neighbour is a unit WORD and the numbers carry vulgar fractions, so
    //    a `(\d)\s*×\s*(\d)` shape misses it outright.
    //    ⚠ ASCII `x` TOO, since `NxN` is the commoner written form and a bare `x` is read as its own LETTER
    //    NAME. That arm alone is digit-bounded on both sides, so it cannot claim a letter.
    s = tr(s, new RegExp(`\\s*(?:×|(?<=[${DIGIT}])x)\\s*(?=[${DIGIT}])`, "gu"), " في ");

    // 8) FRACTIONS, as "numerator على denominator" — the plain spoken reading, which avoids the broken-plural
    //    forms (أخماس …) a fully idiomatic rendering would need.
    s = tr(s, new RegExp(`(?<![${DIGIT}.,/])([${DIGIT}]{1,3})/([${DIGIT}]{1,3})(?![${DIGIT}/])`, "gu"),
        (_m, a: string, b: string) => `${a} عَلَى ${b}`);

    return s.replace(ARABIC_DIGIT, foldDigit);
}
