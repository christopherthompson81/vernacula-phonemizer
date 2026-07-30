/**
 * Kazakh Roman-numeral reading. A century is read as an ORDINAL: `XIX ғасыр` is *он тоғызыншы ғасыр*; the
 * cardinal *он тоғыз ғасыр* means "nineteen centuries".
 *
 * SOURCES:
 *  - The ordinal (реттік сан) is the cardinal + -ыншы/-інші after a consonant, -ншы/-нші after a vowel, the
 *    pair chosen by back/front harmony, and the suffix attaches only to the LAST element of a compound.
 *  - The spelled century phrase is attested in running Kazakh text: "Он тоғызыншы ғасыр зерттеушілерінің
 *    жұмыстарындағы Кіші жүздің этнографиясы" and "…он тоғызыншы ғасыр зиялыларының…" (Kazakh academic article
 *    titles), plus the English–Kazakh dictionary gloss "great discoveries marked the 19th century — он
 *    тоғызыншы ғасыр ұлы жаңалықтардың ашылуымен белгілі". So the ordinal reading of `XIX ғасыр` is directly
 *    sourced, not inferred from the other Turkic languages.
 *
 * FORM: no gender, and the suffix does not vary by head noun, so one form serves every context including
 * regnal names. No agreement limitation.
 *
 * WHY TABLES AND NOT A RULE, unlike Azerbaijani and Uzbek — two reasons:
 *  1. The tens are irregular: 20 → *жиырмасыншы* (epenthetic -с-, not *жиырманшы*) and 40 → *қырқыншы*
 *     (қырық loses its second vowel). A pure suffixing rule gets both wrong.
 *  2. This language's `numbers` manifest holds PRE-PHONEMIZED IPA forms (`tˈoʁəz`, `ʒəjərmˈɑ`), not
 *     orthography — see kazakh.jsonc. The ordinal is emitted as a WORD into the text stream and phonemized by
 *     the Kazakh g2p, so it must be Cyrillic; the manifest cannot supply it. Hence the orthographic cardinal
 *     tens are restated here, and only here.
 */
import type { RomanPolicy } from "../../core/roman.ts";

/** 1–9 ordinals, Cyrillic orthography. */
const ORD_UNITS: readonly string[] = [
    "", "бірінші", "екінші", "үшінші", "төртінші", "бесінші", "алтыншы", "жетінші", "сегізінші", "тоғызыншы",
];

/** Whole tens — жиырмасыншы and қырқыншы are the irregular ones. */
const ORD_TENS: readonly string[] = [
    "", "оныншы", "жиырмасыншы", "отызыншы", "қырқыншы", "елуінші", "алпысыншы", "жетпісінші", "сексенінші",
    "тоқсаныншы",
];

/** Cardinal tens in ORTHOGRAPHY (kazakh.jsonc stores these as IPA, so they cannot be imported). */
const TENS_CARDINAL: readonly string[] = [
    "", "он", "жиырма", "отыз", "қырық", "елу", "алпыс", "жетпіс", "сексен", "тоқсан",
];

/**
 * Integer → Kazakh ordinal. Compounds put the tens in the CARDINAL and suffix only the unit: 19 → *он
 * тоғызыншы*, 21 → *жиырма бірінші*. `undefined` above 100 falls back to the cardinal.
 */
function ordinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 100) return undefined;
    if (n === 100) return "жүзінші";
    if (n < 10) return ORD_UNITS[n];
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? ORD_TENS[t] : `${TENS_CARDINAL[t]} ${ORD_UNITS[u]}`;
}

/**
 * Agglutinative, so unanchored at the end: `ғасыр` also matches ғасырда, ғасырдың, ғасырлар, ғасырға.
 * Covered: ғасыр (century), мыңжылдық (millennium), жылдық (annual/anniversary), съезд, конгресс, сынып
 * (school grade).
 */
const CONTEXT = /^(ғасыр|мыңжылдық|жылдық|съезд|конгресс|сынып)/iu;

/** This policy always supplies `ordinal`, which is optional on `RomanPolicy` — the intersection makes it
 *  REQUIRED here so tests can call it directly without a non-null assertion. */
type Policy = RomanPolicy & { ordinal(n: number): string | undefined };

export const ROMAN_POLICY: Policy = {
    ordinal,
    ordinalBefore: CONTEXT,
    ordinalAfter: CONTEXT,
};
