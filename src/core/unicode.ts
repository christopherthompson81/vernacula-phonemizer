/**
 * Notation-parsing PRIMITIVES for the native abugida path — pure Unicode/IPA facts about HOW to read
 * the string (which codepoints are vowels, modifiers, tie bars, digits; which block is a script). These
 * are code constants, NOT declarative data: they don't decide which phoneme is produced (that lives in
 * data/native/_shared/phonology.jsonc + the per-language JSONC) — they only classify characters while
 * tokenizing. Regexes that match a SET are built from the string lists here at the use site, so the list
 * is the single source and the pattern is derived from it. One obvious mirror target for the C# port.
 */

/** Combining diacritics block U+0300–U+036F (̀-ͯ): attach to the preceding base (nasal ◌̃, dental ◌̪). */
export const COMBINING_DIACRITICS = "̀-ͯ";

/** Tie bar U+0361 (͡): joins the two halves of an affricate (t͡ʃ, d͡ʑ) into one token. */
export const TIE_BAR = "͡";

/** IPA spacing modifiers that attach to the preceding unit: length ː ˑ, palatalization ʲ, aspiration ʰ,
 *  breathy ʱ, ejective ʼ. (Combined with {@link COMBINING_DIACRITICS} to form the tokenizer's MOD set.) */
export const ATTACHING_MODIFIERS = "ːˑʲʰʱʼ";

/** IPA vowel letters — the universal alphabet the stress tokenizer treats as syllable nuclei. A vowel is
 *  a vowel regardless of which language declares it, so this is a notation constant, not per-language data. */
export const IPA_VOWELS = "əaeiouɪʊɛɔɐæyøɘɤʌɯɵœɜɞʉɨɶ";

/** Primary / secondary stress marks (IPA). */
export const STRESS_PRIMARY = "ˈ";
export const STRESS_SECONDARY = "ˌ";

/** Devanagari block U+0900–U+097F (ऀ-ॿ) — script detection. */
export const DEVANAGARI_BLOCK = "ऀ-ॿ";

/** Word-forming Devanagari: letters + signs + vocalic extensions, EXCLUDING the digits (U+0966–096F)
 *  and the danda/punctuation — i.e. ऀ-ॣ (U+0900–0963) + ॲ-ॿ (U+0972–097F). Used to split text into
 *  word runs so a digit run breaks out as its own (number) token. */
export const DEVANAGARI_WORD = "ऀ-ॣॲ-ॿ";

/** Devanagari digits ०-९ → ASCII, for number parsing. The regex digit-class is built from these keys. */
export const DEVANAGARI_DIGITS: Record<string, string> = {
    "०": "0",
    "१": "1",
    "२": "2",
    "३": "3",
    "४": "4",
    "५": "5",
    "६": "6",
    "७": "7",
    "८": "8",
    "९": "9",
};

/** Word-forming Bengali (U+0980 block): letters + signs + matras + vocalic, EXCLUDING the digits
 *  (U+09E6–09EF) and punctuation — i.e. ঀ-ৣ (U+0980–09E3) + ৰ-৾ (U+09F0–09FE, ra/wa variants + signs).
 *  Bengali uses the shared danda । (U+0964) for clause punctuation, handled separately. */
export const BENGALI_WORD = "ঀ-ৣৰ-৾";

// Gujarati block (U+0A80–U+0AFF) minus the digit range — a word run.
export const GUJARATI_WORD = "઀-૥૰-૿";

/** Gujarati digits ૦-૯ → ASCII, for number parsing. */
export const GUJARATI_DIGITS: Record<string, string> = {
    "૦": "0",
    "૧": "1",
    "૨": "2",
    "૩": "3",
    "૪": "4",
    "૫": "5",
    "૬": "6",
    "૭": "7",
    "૮": "8",
    "૯": "9",
};

/** Bengali digits ০-৯ → ASCII, for number parsing. */
export const BENGALI_DIGITS: Record<string, string> = {
    "০": "0",
    "১": "1",
    "২": "2",
    "৩": "3",
    "৪": "4",
    "৫": "5",
    "৬": "6",
    "৭": "7",
    "৮": "8",
    "৯": "9",
};

/** Latin letters that have no combining-mark decomposition, so NFD alone cannot fold them. */
const LATIN_ATOMIC: Record<string, string> = {
    ø: "o", æ: "ae", œ: "oe", ß: "ss", ł: "l", đ: "d", ð: "d", þ: "th", ħ: "h", ı: "i", ŋ: "ng",
};

/**
 * Fold Latin diacritics to the ASCII base letters an English-style lexicon and G2P are trained on:
 * café → cafe, naïve → naive, jalapeño → jalapeno, résumé → resume.
 *
 * Needed because a dictionary keyed on ASCII has no entry for the accented spelling — CMUdict has
 * `cafe`, `naive`, `jalapeno` and `resume` but none of their accented forms — so without folding, a
 * loanword either misses the lexicon or (worse) is split at the accent by an ASCII-only tokenizer.
 *
 * Lossy by design where the accent is the only distinction: résumé and resume fold together, so the
 * noun inherits the verb's reading. That is a documented conflation, and far better than the
 * alternative of mangling the word.
 */
export function foldLatinDiacritics(s: string): string {
    const stripped = s.normalize("NFD").replace(/\p{M}+/gu, "");
    return stripped.replace(/[øæœßłđðþħıŋ]/gu, (c) => LATIN_ATOMIC[c] ?? c);
}

/**
 * Decimal-digit block bases for every script this project supports. Unicode guarantees a decimal digit
 * block is ten contiguous codepoints in ascending value, so the fold below is arithmetic rather than a
 * per-script table of ten entries each.
 */
const NATIVE_DIGIT_BASES: readonly number[] = [
    0x0660, // Arabic-Indic
    0x06f0, // Extended Arabic-Indic (Persian, Urdu)
    0x0966, // Devanagari
    0x09e6, // Bengali
    0x0a66, // Gurmukhi
    0x0ae6, // Gujarati
    0x0b66, // Odia
    0x0be6, // Tamil
    0x0c66, // Telugu
    0x0ce6, // Kannada
    0x0d66, // Malayalam
    0x0de6, // Sinhala
    0x0e50, // Thai
    0x0ed0, // Lao
    0x0f20, // Tibetan
    0x1040, // Myanmar
    0x17e0, // Khmer
    0xff10, // Fullwidth
];

/**
 * Fold any script's own decimal digits to ASCII, so the number path can read them.
 *
 * WHY: an engine whose number token is `\d+` (ASCII-only, as JavaScript defines it) sees a numeral written
 * in the language's own digits as no token at all, and `assembleClauses` skips what the tokenizer declines
 * — so the number VANISHES. Auditing 21 scripts found six engines returning an EMPTY STRING for their own
 * numerals: Punjabi, Tamil, Telugu, Malayalam, Sinhala and Lao. Total content loss, silent.
 *
 * Applied per engine rather than fleet-wide at the registry, deliberately: Telugu's corpus uses ౦ (U+0C66,
 * its digit zero) as a HOMOGLYPH for ం (sunna) in 144 places, so a blanket fold ahead of Telugu's own
 * homoglyph rule would corrupt exactly the language that found the problem. Ordering has to stay the
 * language's decision.
 */
export function foldNativeDigits(s: string): string {
    return s.replace(/\p{Nd}/gu, (ch) => {
        const cp = ch.codePointAt(0)!;
        if (cp < 0x80) return ch; // already ASCII
        for (const base of NATIVE_DIGIT_BASES)
            if (cp >= base && cp <= base + 9) return String(cp - base);
        return ch; // a block we do not carry: leave it rather than guess
    });
}

/**
 * REPAIR DOUBLE-ENCODED UTF-8 — text whose bytes were UTF-8 but got decoded as Latin-1 and re-encoded, so
 * `\u00b2` arrives as `\u00c2\u00b2` and `\u00f1` as `\u00c3\u00b1`. Mojibake is one of the commonest real-world corruptions in
 * scraped text, and a phonemizer is handed arbitrary text.
 *
 * WHY THIS IS SAFE, measured rather than assumed. The signature is `\u00c2` or `\u00c3` followed by a UTF-8
 * CONTINUATION byte (U+0080–U+00BF) — a sequence that occurs in no natural orthography, because those code
 * points are C1 controls and punctuation that never follow a capital A-circumflex or A-tilde. Counted across
 * all 67 FLEURS corpora: **31 occurrences, every one of them in id_id, and zero anywhere else.** All 31 are
 * genuine corruption:
 *   `19.500 km\u00c2\u00b2` (should be km\u00b2) · `Las Ca\u00c3\u00b1itas` (Ca\u00f1itas) · `David Kl\u00c3\u00b6cker` (Kl\u00f6cker)
 * The `km\u00c2\u00b2` case cost four readings outright: `\u00c2` IS a letter, so the tier's trailing guard rejected the
 * unit match and `km` reached the IPA raw.
 *
 * THE ARITHMETIC IS EXACT, not a lookup table. UTF-8 `C2 XX` encodes U+0080–U+00BF, and for a lead byte of
 * C2 the code point EQUALS the trailing byte, so the repair is simply to drop the `\u00c2`. For `C3 XX` the code
 * point is the trailing byte plus 0x40, which is why the second arm shifts.
 *
 * ⚠ LOSSY MOJIBAKE CANNOT BE REPAIRED AND IS NOT ATTEMPTED. mr_in carries `\u00e2\u0080\ufffd` twice — a curly quote whose
 * third byte was already replaced with U+FFFD upstream, so the information is gone. Two instances in one
 * corpus, and guessing which quote it was would be invention.
 */
/**
 * The bytes 0x80–0x9F have no Latin-1 characters, so a mis-decode of them goes through CP1252 instead — and
 * that is what makes the THREE-byte case look different from the two-byte one. `â€\u201c` is not
 * `\u00e2 + \u0080 + \u0093`; it is `\u00e2 + \u20ac + \u201c`, because CP1252 maps 0x80 to the euro sign and
 * 0x93 to a curly quote. An earlier pass measured the 3-byte signature as ZERO across all 67 corpora by
 * searching for the Latin-1 form, which does not occur — the CP1252 form occurs 16 times.
 */
const CP1252_BACK = new Map<number, number>([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86],
    [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
    [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95],
    [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
    [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

/** The byte a mis-decoded character came from: its CP1252 slot, or its own value in the Latin-1 range. */
function sourceByte(c: string): number | undefined {
    const o = c.codePointAt(0)!;
    const m = CP1252_BACK.get(o);
    if (m !== undefined) return m;
    return o >= 0x80 && o <= 0xff ? o : undefined;
}

export function repairDoubleEncoded(s: string): string {
    // The lead bytes the arms below can repair. This must stay in step with them: it was `[\u00c2\u00c3\u00e2]`
    // when the two-byte arms were C2/C3-only, and widening the arm to C5 without widening this fast path left
    // `\u00c4\u00b0zmir` returning EARLY and unrepaired \u2014 the fix silently did nothing.
    if (!/[\u00c2-\u00c5\u00e2]/u.test(s)) return s;
    return s
        // THREE-BYTE first, or the two-byte arms below would eat its lead. `E2 XX YY` encodes U+0800–U+FFFF;
        // the lead nibble of 0xE2 is 2, so the code point is 0x2000 plus the two continuation payloads — which
        // is why every hit here is a dash, quote or ellipsis. Measured: 16 occurrences, all in id_id
        // (`â€“` → `–`, `â€”` → `—`), zero in the other 66 corpora.
        // LOSSY RESIDUE, where the third byte did not survive to be decoded — and the intended character is
        // still IDENTIFIABLE, which is the only reason this arm is allowed to guess. `â€` alone is `E2 80`, the
        // first two bytes of a General Punctuation character (U+2000–U+206F), so whatever is missing was
        // punctuation: a quote, a dash or a space. That bounds the damage — every candidate is either a clause
        // mark or silent in this engine, so choosing wrongly among them cannot produce a wrong WORD, whereas
        // leaving the sequence alone leaves a `€` that `\p{Sc}` reads as a PHANTOM CURRENCY. mr's
        // `currency DROP` was exactly that: a euro sign inside a broken quote, in a sentence with no money in it.
        //
        // ⚠ U+FFFD IS A FINGERPRINT, NOT NOISE. Of the E2 80 xx third bytes, only 0x81/0x8D/0x8F/0x90/0x9D are
        // unmapped in CP1252 and so become the replacement character — and among those, `E2 80 9D` is `”`, the
        // closing double quote, which is overwhelmingly the most frequent in running text. So `â€` + U+FFFD → `”`.
        // ⚠ THE PAIRING IS CORROBORATED ACROSS LANGUAGES, which is what settles the opening quote — FLEURS
        // translates ONE English set, so the same sentence exists elsewhere with its bytes intact:
        //   en  `For example, “learning” and “socialization” are suggested as important motivations …`
        //   hi  `उदाहरण के लिए, “लर्निंग” और “सोशलाइजेशन” को इंटरनेट …`
        //   mr  `उदाहरणार्थ, â€इलर्निंगâ€� आणि â€समाजीकरणâ€� ला इंटरनेट …`
        // Both siblings write U+201C/U+201D, so the residue before a letter is an OPENING quote, not a dash.
        // Measured: the sequence occurs in exactly two corpora, id_id (42) and mr_in (24), and nowhere else.
        .replace(/\u00e2[\s\S]{2}/gu, (m) => {
            const b2 = sourceByte(m[1]!), b3 = sourceByte(m[2]!);
            if (b2 === undefined || b3 === undefined) return m;
            if (b2 < 0x80 || b2 > 0xbf || b3 < 0x80 || b3 > 0xbf) return m;
            return String.fromCodePoint(((0xe2 & 0x0f) << 12) | ((b2 - 0x80) << 6) | (b3 - 0x80));
        })
        // ⚠ AFTER the three-byte pass, NOT BEFORE — the review caught this and my reasoning had been wrong.
        // I argued these arms were safe ahead of it because the well-formed third characters (U+201C for `–`,
        // U+201D for `—`) are punctuation and so could not match `[\p{L}\p{M}]`. True for those two, false in
        // general: `“` is `E2 80 9C` whose third byte 0x9C maps to `œ` — A LETTER — so the opening-quote arm
        // matched `â€` and stranded the `œ`, turning `â€œ` into `“œ`. Ordering after the full decode removes the
        // whole class of interception, which is why it is the right fix rather than widening the guard.
        .replace(/\u00e2\u20ac\ufffd/gu, "\u201d")
        .replace(/\u00e2\u20ac(?=[\p{L}\p{M}\s]|$)/gu, "\u201c")
        // TWO-BYTE, as the GENERAL formula rather than one arm per lead byte. `C2` and `C3` were special-cased
        // here for a while, and the case that showed why that was wrong is `\u00c4\u00b0zmir` \u2014 the mojibake of `\u0130`
        // (U+0130), whose UTF-8 is `C4 B0`. A lead byte of C4 was outside both arms, so the sequence survived
        // to the tier as `\u00c4` + `\u00b0` \u2014 AND `\u00b0` IS A DEGREE SIGN, so the audit reported a `degree` DROP on a
        // sentence about the population of a Turkish city. A phantom degree, exactly as `\u00e2\u20ac`'s stranded euro
        // was a phantom currency. The lesson repeats: half-repaired mojibake does not merely fail to read, it
        // MANUFACTURES a symbol for a later pass to reason about.
        //
        // `cp = ((lead & 0x1f) << 6) | (b2 & 0x3f)` is the UTF-8 definition, and it subsumes what the two arms
        // said: for C2 it returns b2 unchanged (hence "drop the \u00c2") and for C3 it returns b2 + 0x40 (hence the
        // shift). Extending to C4/C5 reaches Latin Extended-A \u2014 the Turkish, Polish and Baltic letters.
        //
        // BOUNDED BY MEASUREMENT, on the same standard as the arms above. `[C4C5]` + a continuation byte occurs
        // **twice across all 67 corpora, both `\u00c4\u00b0` in id_id**, and the next range up, `[C6-CF]`, occurs ZERO
        // times \u2014 so stopping at C5 costs nothing and every character this newly repairs is a real one.
        .replace(/([\u00c2-\u00c5])([\u0080-\u00bf])/gu, (_m, lead: string, c: string) =>
            String.fromCodePoint(((lead.codePointAt(0)! & 0x1f) << 6) | (c.codePointAt(0)! & 0x3f)));
}

/**
 * SQUARED DEGREE SIGNS → their two-character equivalents: ℃ → `°C`, ℉ → `°F`.
 *
 * WHY A FOLD RATHER THAN A RULE PER LANGUAGE. U+2103 and U+2109 are single code points that mean exactly what
 * `°C` and `°F` mean, and 52 of the 65 languages with a mined artifact ALREADY read `°C` correctly while
 * dropping `℃` — the whole unit, not just the sign: `20℃` came out as bare *twenty*. Folding is therefore the
 * only change that closes 52 languages at once, and it needs no new word in any of them. 13 already handled
 * both, because they had written the ℃ arm out by hand (bg ckb cmn da en hi is ja my nb ro sd sv); folding is
 * idempotent, so those stay as they are.
 *
 * ⚠ NOT `NFKC`, AND THIS IS THE WHOLE REASON THE LIST IS CURATED. Blanket compatibility normalisation looks
 * like the general answer and is measurably destructive here. Counting every compatibility character in the
 * corpora:
 *
 *   ²  → "2"     in 46 corpora   — would erase every exponent reading the tier composes
 *   …  → "..."   in 18 corpora   — one ellipsis becomes THREE clause breaks
 *   ¾  → "3⁄4"   in 35 corpora
 *   য় ড় ਸ਼ ਜ਼ ଡ଼ ज़ …           — nukta letters in five Indic scripts, recomposed differently
 *   ，（）：；                    — fullwidth punctuation the CJK layers claim deliberately
 *
 * ⚠ № IS DELIBERATELY EXCLUDED, though it is the same kind of character. NFKC gives `No`, and Bulgarian —
 * which writes it 21 times ("космонавт № 11") — says *номер*. Folding it would replace a dropped symbol with
 * an English word read by a Bulgarian g2p, which is the confidently-wrong outcome this tree ranks below
 * silence. It needs a per-language WORD, not a fold.
 *
 * The CJK squared units (㎞ ㎡ ㎥ ㎏ ㎜ ㎝ ㎢ ㏊) are omitted for a duller reason: zero occurrences in any
 * corpus, and each would need the language to declare that unit anyway.
 */
/**
 * VULGAR FRACTIONS → the ASCII `n/m` every language's fraction rule already matches.
 *
 * MEASURED FIRST, because the shape of the fix follows from it: 36 of the 67 artifacts contain a vulgar
 * fraction, **every one of them the same universal sentence** — the manuscript's `(measuring 29¾ inches × 24½
 * inches)` — and **27 of the 36 DROP it**, reading `29¾` as bare *twenty-nine*. Nine already handle it
 * (az ca el ga hr kn mk te uz). One sentence, twenty-seven languages, so this is a fold and not twenty-seven
 * vocabularies: each language then speaks it with the fraction machinery it already has.
 *
 * ⚠ NOT NFKC, for the reason `foldSquaredDegrees` gives at length — and here specifically because NFKC maps
 * `¾` to `3⁄4` with U+2044 FRACTION SLASH, which no language's fraction rule matches. The fold has to be ASCII
 * `/` to reach that machinery at all, which is why the compatibility mapping is not the answer even for the one
 * character where it looks closest.
 *
 * ⚠ A SPACE IS INSERTED AFTER A DIGIT, and without it the fold makes things worse rather than better. These are
 * MIXED numbers: `29¾` means twenty-nine and three quarters, so a bare substitution yields `293/4`, which
 * Gujarati's fraction rule already refuses by design — its comment records `293/4 and 241/2 are MIXED NUMBERS …
 * so `num < den` refuses them rather than saying "two hundred ninety-three divided by four"`. That refusal is
 * correct given `293/4`; the space is what makes the input honest. gu therefore goes from a documented refusal
 * to a reading, with no change to gu.
 *
 * ⚠ WHAT THIS DOES NOT SUPPLY is the "and" of *twenty-nine AND three quarters*, which is a per-language word in
 * a per-language position. The fold gets the fraction SPOKEN; joining it to the integer idiomatically is a
 * separate change, and th's own recording shows the reader saying the fraction as a unit
 * (`s e s a m s ʊ n s iː` = เศษสามส่วนสี่) rather than as an addition.
 */
const VULGAR: Readonly<Record<string, string>> = {
    "¼": "1/4", "½": "1/2", "¾": "3/4", "⅐": "1/7", "⅑": "1/9", "⅒": "1/10",
    "⅓": "1/3", "⅔": "2/3", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
    "⅙": "1/6", "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};
const VULGAR_RE = new RegExp(`[${Object.keys(VULGAR).join("")}]`, "gu");

/** Vulgar fraction characters → ASCII `n/m`, spaced off a preceding digit so a mixed number stays two terms. */
export function foldVulgarFractions(s: string): string {
    if (!VULGAR_RE.test(s)) return s;
    VULGAR_RE.lastIndex = 0;
    return s.replace(VULGAR_RE, (c, off: number, full: string) =>
        (/\d/u.test(full[off - 1] ?? "") ? " " : "") + VULGAR[c]!);
}

export function foldSquaredDegrees(s: string): string {
    return s.replace(/℃/gu, "\u00b0C").replace(/℉/gu, "\u00b0F");
}
