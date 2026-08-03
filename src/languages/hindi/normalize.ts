/**
 * Hindi (hi) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Fourth language to get this treatment, and the first outside the Latin script. Most of the tiers were
 * ALREADY right and are deliberately untouched, which is worth stating because it shrinks what this file
 * has to do: the Indic number compositor already reads लाख/करोड़ (100000 → एक लाख), the number tokenizer
 * already accepts BOTH the Western and the Indian comma grouping (9,000 / 1,00,000 both correct),
 * decimals read as दशमलव, %/currency work through the shared symbol tier, the danda । is already a clause
 * mark, and embedded Latin runs are already delegated to English by the shared foreign-run pass — which is
 * the right reading for the acronyms that occur (AOL, PBS, DNA are said with English letter names).
 *
 * So what is left is genuinely Hindi-specific: its ordinal suffixes, its Devanagari unit abbreviations,
 * its abbreviations, and its clock.
 *
 * Measured over the hi_in FLEURS corpus (2,120 utterances): Devanagari unit abbreviations ×54
 * (किमी, मिमी, मीटर, किग्रा), ordinal suffixes ×35, डॉ ×27 (the most frequent abbreviation, and ×22 of
 * those are written WITHOUT the dot), बजे ×22, times h:mm ×18, ई.पू. ×3. Zero Devanagari DIGITS — the
 * corpus writes numbers with ASCII digits throughout — so no digit transliteration is needed here.
 */
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";

/**
 * Ordinal suffix → the gender/number it marks. Hindi writes the ordinal as the numeral plus this suffix
 * (16वीं), and the suffix itself carries the agreement, so it is read off the text rather than guessed.
 *   वाँ / वां  masculine singular      वीं  feminine        वें / वे  masculine plural / oblique
 */
const SUFFIX_FORM: Readonly<Record<string, 0 | 1 | 2>> = {
    "वाँ": 0, "वां": 0, "वा": 0,
    "वीं": 1, "वी": 1,
    "वें": 2, "वे": 2,
};

/**
 * Irregular ordinals, indexed [masculine, feminine, oblique]. 1–4 and 6 are suppletive; 5 (पाँचवाँ) and
 * everything from 7 up are regular — the cardinal plus the suffix.
 */
const IRREGULAR: Readonly<Record<number, readonly [string, string, string]>> = {
    1: ["पहला", "पहली", "पहले"],
    2: ["दूसरा", "दूसरी", "दूसरे"],
    3: ["तीसरा", "तीसरी", "तीसरे"],
    4: ["चौथा", "चौथी", "चौथे"],
    6: ["छठा", "छठी", "छठे"],
};

/**
 * Devanagari unit abbreviations → the full word. The existing symbol tier is keyed on the LATIN
 * abbreviations (km, cm, mm, kg), which is not what the corpus writes: it uses किमी ×10, मिमी ×5, मीटर,
 * किग्रा. Unexpanded, किमी was read as a word, [kˈɪmiː].
 */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "किमी": "किलोमीटर", "किमी/घंटा": "किलोमीटर प्रति घंटा", "किग्रा": "किलोग्राम",
    "सेमी": "सेंटीमीटर", "मिमी": "मिलीमीटर", "ग्रा": "ग्राम", "मि": "मिनट",
    "मी/से": "मीटर प्रति सेकंड",
};
const UNIT_ALT = Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length).join("|");

/**
 * Abbreviations. डॉ is the most frequent in the corpus and is usually written WITHOUT a dot (×22 of 27),
 * so the dot cannot be required. श्री and आदि are already ordinary words and need no expansion.
 */
const ABBREV: Readonly<Record<string, string>> = {
    "डॉ": "डॉक्टर", "प्रो": "प्रोफ़ेसर", "कु": "कुमारी", "श्रीमती": "श्रीमती",
    "सं": "संख्या", "पृ": "पृष्ठ", "अध्या": "अध्याय",
};
const ABBREV_ALT = Object.keys(ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Build the Hindi normalizer. Takes the numbers definition so the ordinal rule can compose the cardinal
 *  words it attaches its suffix to — the same data the engine's own number path uses. */
export function makeHindiNormalizer(numbers: NumbersDef): (text: string) => string {
    /** Integer → its Devanagari cardinal words, as the engine's number path would render them. */
    const cardinal = (n: number): string[] => indicNumberWords(n, numbers).map((w) => w ?? "");

    /**
     * The ordinal, agreeing with whatever the written suffix marked. Regular ordinals are the cardinal
     * with the suffix JOINED to its final word — सोलह + वीं is one word, सोलहवीं, and emitting them
     * separately is what made the suffix a stray syllable ([sˈoːləɦ ʋˈiː̃], "sixteen vee").
     */
    const ordinal = (n: number, form: 0 | 1 | 2, suffix: string): string | undefined => {
        const irr = IRREGULAR[n];
        if (irr !== undefined) return irr[form];
        const words = cardinal(n);
        if (words.length === 0 || words.some((w) => w === "")) return undefined;
        words[words.length - 1] = `${words[words.length - 1]}${suffix}`;
        return words.join(" ");
    };

    return (input: string): string => {
        let s = input;

        // 1) ERA MARKERS, before the abbreviation rule so the bare ई. is not claimed first. The dots were
        //    surviving as two phrase breaks ("356 ई.पू." → [ˈiː . pˈuː .]).
        //    NOTE ON BOUNDARIES, which cost a debugging round here: `\b` is defined on ASCII word
        //    characters, so it never matches before a Devanagari letter and every rule using it silently
        //    did nothing. Every boundary in this file is an explicit lookaround instead. (The same trap
        //    hit French, where `\b` found a boundary INSIDE `siècle` at the accent.)
        s = s.replace(/(?<![\p{L}\p{M}])ई\.?\s?स\.?\s?पू\.?/gu, "ईसा पूर्व");
        s = s.replace(/(?<![\p{L}\p{M}])ई\.?\s?पू\.?/gu, "ईसा पूर्व");

        // 2) ORDINAL SUFFIXES. The suffix is attached to the numeral in writing (16वीं) but was tokenized
        //    apart from it, so it was spoken as its own word. A space may intervene in the corpus.
        //
        //    THE TRAILING BOUNDARY IS LOAD-BEARING. Without it the suffix matched the START of an ordinary
        //    word: `10 वापस` became one glued token (*dasvāpas*) with a stress lost, and the same for वायु,
        //    वाहन and — in the eight languages that inherit this normalizer — वाजता, वादळे, वाईल्ड. The
        //    Marathi run measured 13 live corruptions of that shape in its own corpus. This is trap #1 in
        //    the playbook: never a bare match where a letter may follow.
        s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\s?(${Object.keys(SUFFIX_FORM).join("|")})(?![\\p{L}\\p{M}])`, "gu"),
            (whole, digits: string, suffix: string) =>
                ordinal(Number(digits), SUFFIX_FORM[suffix]!, suffix) ?? whole);

        // 3) ABBREVIATIONS. The dot is consumed when the sentence continues so it cannot become a phrase
        //    break; डॉ is matched with the dot OPTIONAL because that is how it is usually written.
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.?(\\s+)(?=[\\p{L}])`, "gu"),
            (_m, ab: string, sp: string) => `${ABBREV[ab]!}${sp}`);

        // 4) DEVANAGARI UNIT ABBREVIATIONS, after a number. Longest first so किमी/घंटा beats किमी.
        s = s.replace(new RegExp(`(\\d)\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
            (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`);

        // 5) DEGREES. The bare sign and the two scales; ° alone was dropped and °C read as a letter name.
        //    Case-insensitive: the corpus is lowercased, so "30° c" occurs and a case-sensitive rule left
        //    the scale letter behind as a stray syllable ([ɖˈɪɡɾiː sˈiː]).
        s = s.replace(/(\d)\s?°\s?C(?![\p{L}])/giu, "$1 डिग्री सेल्सियस");
        s = s.replace(/(\d)\s?°\s?F(?![\p{L}])/giu, "$1 डिग्री फ़ारेनहाइट");
        s = s.replace(/(\d)\s?°/gu, "$1 डिग्री");

        // 6) TIMES. The colon was becoming a PHRASE BREAK, and a :00 was read as शून्य ("eleven, zero
        //    o'clock"). Hindi says the full form "दस बजकर तीस मिनट" — which already contains बजे's sense,
        //    so a following बजे is consumed rather than left to produce "…मिनट बजे". At :00 the minutes
        //    drop out and a following बजे is exactly right ("ग्यारह बजे").
        s = s.replace(/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(\s*बजे)?/gu,
            (_m, h: string, min: string, baje?: string) => {
                const hw = cardinal(Number(h)).join(" ");
                if (Number(min) === 0) return `${hw}${baje ?? " बजे"}`;
                return `${hw} बजकर ${cardinal(Number(min)).join(" ")} मिनट`;
            });

        // 7) PLUS. `+ 30° c` is a real plus in the corpus, and धन is its attested sign word — see the
        //    ऋण citation in step 7b, which names धनात्मक and ऋणात्मक चिह्न as a pair.
        s = s.replace(/(\S)\+\s?(\d)/gu, "$1 धन $2");
        s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1धन $2");

        // 7b) MINUS — WHERE IT IS UNAMBIGUOUS, AND ONLY THERE.
        //
        //     This step used to be a documented REFUSAL, and the refusal was right about the rule it was
        //     refusing. Re-measured over the whole hi_in corpus for #586, its numbers hold exactly:
        //
        //       hyphen preceded by a DIGIT (a range: 25-30, 1000-1300, 100-200)   22   — never a negative
        //       hyphen preceded by a SPACE                                         1   — `चंद्रयान -1`
        //       hyphen at string start or after an opening bracket                 0
        //       real negative numbers                                             0
        //
        //     So the fleet's usual shape — `(^|[\s(])[-−–](\d)` — has one false positive here and no true
        //     ones, and `फ़ॉर्मूला-1` is a second: the character before its hyphen is a MATRA (ा, `\p{M}`),
        //     which `(?<!\p{L})` does not exclude. Both are designations, and reading them as "minus one" is
        //     worse than the silence.
        //
        //     WHAT ESCAPES THE OBJECTION IS RIGHT CONTEXT, not a better left guard — the same discrimination
        //     the Mandarin pass arrived at. A sign is unambiguous when it opens the string or a bracket, or
        //     when a DEGREE or PERCENT word follows the number; a designation never has one. And that is the
        //     case worth having: the corpus writes `+ 30° C से अधिक तापमान`, so the signed temperature is an
        //     attested shape here, and it is exactly the shape where dropping the sign INVERTS the meaning.
        //     `चंद्रयान -1` and `आस-पास` are untouched by both arms.
        //
        //     ऋण, from hi.wikipedia's पूर्णांक: "ऋणात्मक पूर्णांक = जिन संख्याओं के आगे ऋणात्मक चिह्न लगा हो
        //     … जैसे -१, -२" — the article glossing `-१` itself, with धनात्मक चिह्न as its counterpart. NOT
        //     sourced from a bare probe for ऋण, whose own attestations are the LOAN sense (अनर्जक ऋण,
        //     "non-performing loan"); that is the Fula trap, and the pair citation is what escapes it.
        //     माइनस, the loan word broadcasters use, did not attest in slot and is not used here.
        s = s.replace(/(^|[(\[（])\s?[-−–](\d)/gu, "$1ऋण $2");
        s = s.replace(/(?<![\p{L}\p{M}\p{Nd}-])[-−–](\d+(?:[.,]\d+)?)(?=\s?(?:°|℃|℉|डिग्री|%|प्रतिशत))/gu, "ऋण $1");

        // 7c) THE REMAINING SIGNS. Each word is cited; none is a guess.
        //
        //     COMPARATIVES REORDER, and that is why they are not a table like the rest. Hindi states the
        //     comparison POSTPOSITIONALLY — the standard comes first and से कम / से अधिक follows it — so
        //     `A < B` is "A, B से कम", not "A से कम B". The corpus shows the shape twice:
        //     "+ 30° C से अधिक तापमान" ("temperature above +30 °C") and "800,000 से ज़्यादा सैनिकों"
        //     ("more than 800,000 soldiers"). Emitting the western order would have been fluent nonsense.
        s = s.replace(/(\S+)\s*<\s*(\S+)/gu, "$1 $2 से कम");
        s = s.replace(/(\S+)\s*>\s*(\S+)/gu, "$1 $2 से अधिक");
        //     बराबर — corpus: "इस अभिमुखता अनुपात के लगभग बराबर" ("approximately equal to this aspect
        //     ratio"). Infix, which is the arithmetic reading (दस जमा दस बराबर बीस).
        s = s.replace(/\s?=\s?/gu, " बराबर ");
        //     गुणा and भाग — hi.wikipedia's अंकगणित names the four operations and ties each to its sign:
        //     "अंकगणित की मुख्य चार मूल प्रक्रियाएँ होती हैं जोड़ घटाना गुणा भाग", then "गुणा को x चिह्न से
        //     प्रदर्शित किया जाता है। उदाहरणः 2 x 4 = 8" and "भाग को / चिह्न से प्रदर्शित किया जाता है".
        //     `/` itself is NOT routed here — step 8 already reads it as the fraction बटा.
        s = s.replace(/\s?×\s?/gu, " गुणा ");
        s = s.replace(/\s?÷\s?/gu, " भाग ");
        //     ± takes the pair named in the पूर्णांक citation above, in its conventional order.
        s = s.replace(/±\s?/gu, "धन ऋण ");
        //     THE AMPERSAND, split the way the Mandarin pass split it: between LATIN letters it stays inside
        //     the run this engine already delegates to English (`AT&T`, `R&D` are English terms, and reading
        //     half of one in Hindi would be a code-switch mid-word); elsewhere it is और, which the corpus
        //     writes 36 times as the ordinary conjunction.
        s = s.replace(/(?<=[A-Za-z])\s?&\s?(?=[A-Za-z])/gu, " and ");
        s = s.replace(/\s?&\s?/gu, " और ");

        // 8) FRACTIONS. आधा and तिहाई are suppletive; the rest are "n बटा m", the ordinary spoken form.
        s = s.replace(/(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
            const num = Number(a), den = Number(b);
            if (num === 1 && den === 2) return "आधा";
            if (num === 1 && den === 4) return "चौथाई";
            if (den === 3) return `${cardinal(num).join(" ")} तिहाई`;
            const nw = cardinal(num).join(" "), dw = cardinal(den).join(" ");
            return nw === "" || dw === "" ? m0 : `${nw} बटा ${dw}`;
        });

        return s;
    };
}
