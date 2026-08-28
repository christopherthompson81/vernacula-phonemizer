/**
 * Hindi (hi) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ MOST OF THE TIERS ARE ALREADY RIGHT AND ARE DELIBERATELY UNTOUCHED, which is worth stating because it
 * bounds what this file does: the Indic number compositor already reads लाख/करोड़ (100000 → एक लाख), the
 * number tokenizer already accepts BOTH the Western and the Indian comma grouping (9,000 and 1,00,000), the
 * decimal already reads as दशमलव, % and currency work through the shared symbol tier, the danda । is already
 * a clause mark, and embedded Latin runs are already delegated to English — which is the right reading for the
 * acronyms that occur, since AOL, PBS and DNA are said with English letter names.
 *
 * What is left is genuinely Hindi-specific: the ordinal suffixes, the Devanagari unit abbreviations, the
 * abbreviations, and the clock.
 *
 * ⚠ HINDI TEXT WRITES NUMBERS WITH ASCII DIGITS, not Devanagari ones, so no digit transliteration is needed
 * here — unlike the Perso-Arabic and Bengali engines, where the fold is load-bearing.
 */
import { MANIFEST } from "./manifest.ts";
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { postposedSign } from "../../core/postposedSign.ts";
import { rewrite } from "../../core/provenance.ts";

/**
 * ⚠ THESE TABLES ARE HINDI'S AND THEY SERVE THE WHOLE FAMILY, which is inherited behaviour and is now at
 * least VISIBLE. This normalizer is built per language (`makeHindiNormalizer(def.numbers, def)`), but the
 * ordinal data used to be a literal in this file, so awa/bho/mag/hne/mai have always read Hindi's ordinal
 * words. That is defensible for the REGULAR suffixes — वाँ/वीं/वें are pan-Hindi-belt — and an assumption
 * for the WORDS. It is kept as the DEFAULT rather than changed, because removing it would take the working
 * regular arm away from five languages; a family member that sources its own forms declares them in its
 * own jsonc and overrides this, which is now a one-line change instead of a fork.
 */
const DEFAULT_SUFFIXES = MANIFEST.ordinalSuffixes;

/** Longest-first alternation, with the regex metacharacters escaped. */
const alt = (keys: string[]): string => keys.sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");


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
export function makeHindiNormalizer(
    numbers: NumbersDef,
    /** The LANGUAGE's own ordinal data, when it declares any; Hindi's is the default. */
    own?: { irregularOrdinals?: Record<string, readonly string[]>; ordinalSuffixes?: typeof DEFAULT_SUFFIXES },
): (text: string) => string {
    const IRREGULAR_L = (own?.irregularOrdinals ?? MANIFEST.irregularOrdinals) as unknown as
        Readonly<Record<number, readonly [string, string, string]>>;
    const ORD_SUF = own?.ordinalSuffixes ?? DEFAULT_SUFFIXES;
    const SUFFIX_FORM: Readonly<Record<string, 0 | 1 | 2>> = ORD_SUF?.regular ?? {};
    const SUPPLETIVE_CONS: Readonly<Record<string, string>> = ORD_SUF?.suppletiveConsonants ?? {};
    const VOWEL_FORM: Readonly<Record<string, 0 | 1 | 2>> = ORD_SUF?.vowelForms ?? {};
    /** Integer → its Devanagari cardinal words, as the engine's number path would render them. */
    const cardinal = (n: number): string[] => indicNumberWords(n, numbers).map((w) => w ?? "");

    /**
     * The ordinal, agreeing with whatever the written suffix marked. Regular ordinals are the cardinal
     * with the suffix JOINED to its final word — सोलह + वीं is one word, सोलहवीं, and emitting them
     * separately is what made the suffix a stray syllable ([sˈoːləɦ ʋˈiː̃], "sixteen vee").
     */
    const ordinal = (n: number, form: 0 | 1 | 2, suffix: string): string | undefined => {
        const irr = IRREGULAR_L[n];
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
        s = rewrite(s, /(?<![\p{L}\p{M}])ई\.?\s?स\.?\s?पू\.?/gu, "ईसा पूर्व");
        s = rewrite(s, /(?<![\p{L}\p{M}])ई\.?\s?पू\.?/gu, "ईसा पूर्व");

        // 2) ORDINAL SUFFIXES. The suffix is attached to the numeral in writing (16वीं) but was tokenized
        //    apart from it, so it was spoken as its own word. A space may intervene in the corpus.
        //
        //    THE TRAILING BOUNDARY IS LOAD-BEARING. Without it the suffix matched the START of an ordinary
        //    word: `10 वापस` became one glued token (*dasvāpas*) with a stress lost, and the same for वायु,
        //    वाहन and — in the eight languages that inherit this normalizer — वाजता, वादळे, वाईल्ड. The
        //    Marathi run measured 13 live corruptions of that shape in its own corpus. This is trap #1 in
        //    ⚠ never a bare match where a letter may follow.
        //    ⚠ BOTH ARMS ARE SKIPPED WHEN THE LANGUAGE DECLARES NO SUFFIXES. This normalizer is shared, and
        //    a family member that has not sourced its own ordinal orthography must get NO rule rather than
        //    Hindi's — an empty alternation would otherwise compile to `()` and match everywhere.
        if (Object.keys(SUFFIX_FORM).length > 0)
            s = rewrite(s, new RegExp(`(?<![\\d.,])(\\d+)\\s?(${alt(Object.keys(SUFFIX_FORM))})(?![\\p{L}\\p{M}])`, "gu"),
                (whole, digits: string, suffix: string) =>
                    ordinal(Number(digits), SUFFIX_FORM[suffix]!, suffix) ?? whole);

        // 2b) THE SUPPLETIVE SPELLINGS — `1ला`, `2रा`, `4था`, `6ठा`, which are ordinary Hindi orthography
        //     and which step 2 never reached, so `1ला` read as the CARDINAL plus a stranded syllable
        //     (*ˈeːk lˈaː*) while `1वाँ` was correct all along. The words were already in `irregularOrdinals`;
        //     only the trigger was missing.
        //     ⚠ THREE GUARDS, AND THE MIDDLE ONE IS THE LOAD-BEARING ONE:
        //       · GLUED, never `\s?` — `था`/`थी` are the past copula, so `2 था` is "there were 2" and a
        //         spaced match would misread a very common shape. A copula is always its own word.
        //       · THE CONSONANT MUST BE THAT NUMBER'S OWN, so `2था` cannot match on 4's consonant.
        //       · the trailing letter-boundary, so `2राज्य` ("2 states") is not claimed as `2रा` + ज्य.
        if (Object.keys(SUPPLETIVE_CONS).length > 0)
            s = rewrite(s,
                new RegExp(`(?<![\\d.,])(\\d)(${alt([...new Set(Object.values(SUPPLETIVE_CONS))])})`
                    + `(${alt(Object.keys(VOWEL_FORM))})(?![\\p{L}\\p{M}])`, "gu"),
                (whole, d: string, cons: string, vowel: string) => {
                    if (SUPPLETIVE_CONS[d] !== cons) return whole;
                    return IRREGULAR_L[Number(d)]?.[VOWEL_FORM[vowel]!] ?? whole;
                },
            );

        // 3) ABBREVIATIONS. The dot is consumed when the sentence continues so it cannot become a phrase
        //    break; डॉ is matched with the dot OPTIONAL because that is how it is usually written.
        s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.?(\\s+)(?=[\\p{L}])`, "gu"),
            (_m, ab: string, sp: string) => `${ABBREV[ab]!}${sp}`);

        // 4) DEVANAGARI UNIT ABBREVIATIONS, after a number. Longest first so किमी/घंटा beats किमी.
        s = rewrite(s, new RegExp(`(\\d)\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
            (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`);

        // 5) DEGREES. The bare sign and the two scales; ° alone was dropped and °C read as a letter name.
        //    Case-insensitive: the corpus is lowercased, so "30° c" occurs and a case-sensitive rule left
        //    the scale letter behind as a stray syllable ([ɖˈɪɡɾiː sˈiː]).
        //
        //    5a) COORDINATES FIRST, because the degree rules below would eat the ° and strand the minutes
        //        mark. Found by the Wikipedia gap-fill, which is the only tier that carries coordinates:
        //          मुरादाबाद ज़िला २८°२१´ से २८°१६´ उत्तरी अक्षांश व ७८°४´ से ७९º पूर्वी देशांतर
        //          गैरसैण तहसील में ३०º ०५' अक्षांश और ७९º १८' देशांतर
        //        Three separate leaks in two sentences: `´` (U+00B4), `'` (ASCII) and `″`-less minutes, plus
        //        `º` — U+00BA MASCULINE ORDINAL INDICATOR standing in for the degree sign, exactly the
        //        substitution the Italian run found in `dell'11º`. The minutes mark is claimed ONLY after a
        //        degree, because a bare `'` is an apostrophe or a quote elsewhere (the quote-letter cell).
        s = rewrite(s, /(\d)\s?[°º]\s?(\d+)\s?[´′'](?:\s?(\d+)\s?[″"])?/gu,
            (_m, deg: string, min: string, sec?: string) =>
                `${deg} डिग्री ${min} मिनट${sec === undefined ? "" : ` ${sec} सेकंड`}`);
        //    `[°º]` in every arm below, for the same U+00BA substitution.
        //
        //    5b) ℃ AND ℉ ARE SINGLE CODE POINTS (U+2103, U+2109) and matched nothing here, so `20℃` read as
        //        bare *bˈiːs* — the whole unit silently gone, not merely the sign. They are in the RAWMARK
        //        leak class precisely because they are easy to miss this way. Found while reviewing this
        //        change: step 7b's lookahead named them as if they were handled, and they were not.
        s = rewrite(s, /(\d)\s?℃/gu, "$1 डिग्री सेल्सियस");
        s = rewrite(s, /(\d)\s?℉/gu, "$1 डिग्री फ़ारेनहाइट");
        s = rewrite(s, /(\d)\s?[°º]\s?C(?![\p{L}])/giu, "$1 डिग्री सेल्सियस");
        s = rewrite(s, /(\d)\s?[°º]\s?F(?![\p{L}])/giu, "$1 डिग्री फ़ारेनहाइट");
        s = rewrite(s, /(\d)\s?[°º]/gu, "$1 डिग्री");

        // 6) TIMES. The colon was becoming a PHRASE BREAK, and a :00 was read as शून्य ("eleven, zero
        //    o'clock"). Hindi says the full form "दस बजकर तीस मिनट" — which already contains बजे's sense,
        //    so a following बजे is consumed rather than left to produce "…मिनट बजे". At :00 the minutes
        //    drop out and a following बजे is exactly right ("ग्यारह बजे").
        s = rewrite(s, /(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(\s*बजे)?/gu,
            (_m, h: string, min: string, baje?: string) => {
                const hw = cardinal(Number(h)).join(" ");
                if (Number(min) === 0) return `${hw}${baje ?? " बजे"}`;
                return `${hw} बजकर ${cardinal(Number(min)).join(" ")} मिनट`;
            });

        // 7) PLUS — REWRITTEN FROM THE CORPUS'S OWN AUDIO, which contradicted this rule twice.
        //
        //    This step used to read EVERY `+` as धन, sourced from the same hi.wikipedia पूर्णांक article cited
        //    in step 7b, which names धनात्मक चिह्न and ऋणात्मक चिह्न as a pair. That citation is sound for what
        //    it says — it is the NAME OF THE SIGN in a mathematics article — and it is the wrong register for
        //    what a reader says out loud. Trap 37 one level deeper than usual: not a word with two senses, but
        //    a correctly-sourced word from the wrong register.
        //
        //    FLEURS ships audio aligned to every transcript, so the sign's own sentences have recordings of
        //    people reading them. Four utterances over hi_in/train, IndicConformer 600m (ONNX):
        //
        //      यूटीसी + 1   → "…स्थानीय समय यूटीसी प्लस एक पर…"  /  "…यूटीसी प्लस वन पर…"   ← प्लस, not धन
        //      + 30° C      → "…गर्मियों के महीनों में तीस डिग्री सेल्सियस से अधिक…"        ← NOTHING, both speakers
        //
        //    ⚠ A READER IS NOT A FAITHFUL RENDERER OF THE TEXT, so the SPEAKER COUNT is the evidence, not the
        //    transcript. This corpus demonstrates the hazard directly: the third ta speaker of the same UTC
        //    sentence skipped `(UTC+1)` entirely. Both hi claims here are 2-of-2 — two independent speakers
        //    agreeing per shape, which is why they are strong enough to overturn a shipped rule. The silence
        //    finding in particular could not rest on one speaker, since one reader omitting a sign is exactly
        //    what unfaithful reading looks like; two doing it in the same slot is a reading convention.
        //
        //    WHAT THE AUDIO CHANGES, AND WHAT IT DOES NOT. It fixes the WORD: प्लस, the loan, is what both
        //    speakers say in the slot; धन is what the sign is CALLED. That is a register error in the old
        //    citation and the audio is the right tier to catch it.
        //
        //    ⚠ IT DOES NOT MAKE THE SIGN SILENT, and the temptation to conclude that was the trap here. Both
        //    speakers omitted the `+` before the temperature, and for a TTS target that is a REFEREE signal,
        //    not a licence: a reader who skips a character the author explicitly wrote is telling us about
        //    reading habits, not about content we may delete. An author who types `+30 °C` chose to mark the
        //    sign, and voicing it is the faithful rendering. So both arms below read it.
        //
        //    The omission is still worth recording, because it explains WHY it is safe either way, and the
        //    old comment got this backwards by borrowing 7b's argument: OMITTING A PLUS IS LOSSLESS AND
        //    OMITTING A MINUS INVERTS. `+30°` and `30°` are the same temperature; `-30°` and `30°` are not.
        //    That asymmetry is why speakers drop one and not the other — and why 7b's "dropping the sign
        //    INVERTS the meaning" is true of the minus and MUST NOT be recycled to justify the plus.
        //
        //    Both arms, so the sign is read glued to a label (`यूटीसी + 1`) or opening the quantity.
        s = rewrite(s, /(\S)\+\s?(\d)/gu, "$1 प्लस $2");
        s = rewrite(s, /(^|\s)\+\s?(\d)/gu, "$1प्लस $2");

        // 7b) MINUS — WHERE IT IS UNAMBIGUOUS, AND ONLY THERE.
        //
        //     This step used to be a documented REFUSAL, and the refusal was right about the rule it was
        //     refusing. Re-measured over the whole hi_in corpus, its numbers hold exactly:
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
        //     A DEGREE WORD, AND NOT A PERCENT. The lookahead began as `°|डिग्री|%|प्रतिशत`, and the
        //     Wikipedia gap-fill (see the hybrid artifact) killed the percent arm with two real sentences:
        //     hi writes a census figure as `कोच (३१,३८१ -९८.५३% हिंदू)` — "Koch (31,381 – 98.53% Hindu)",
        //     where the dash is a SEPARATOR introducing the percentage, not a sign. With `%` in the lookahead
        //     that read as "31,381 MINUS 98.53 percent". Its spaced twin `साक्षरता - ६१%` escaped only by
        //     accident, because the digits are not adjacent to the dash. A negative percentage is plausible
        //     but unattested here; a dash-introduced one is attested twice, so degrees only.
        s = rewrite(s, /(^|[(\[（])\s?[-−–](\d)/gu, "$1ऋण $2");
        s = rewrite(s, /(?<![\p{L}\p{M}\p{Nd}-])[-−–](\d+(?:[.,]\d+)?)(?=\s?(?:°|℃|℉|डिग्री))/gu, "ऋण $1");
        //     A THIRD ARM: A MINUS BEFORE A **DECIMAL**. This is the fleet's ONLY true negative number, and it
        //     was reading as positive — `०.३७२७१९ ख॰इ॰), -२.८८ परिमाण` (an astronomical magnitude) came out
        //     *do dashamlav aath aath*, sign gone. The degree arm above could not reach it: it requires a
        //     DEGREE word after the number, and परिमाण is not one. Adding परिमाण to that lookahead would fix
        //     one sentence and teach nothing; the general property is better.
        //
        //     WHY A DECIMAL IS THE RIGHT DISCRIMINATOR. Every false positive this class suffers is an INTEGER:
        //     a designation (`चंद्रयान -1`, `फ़ॉर्मूला-1`), a score, a year range (`२०१७ -१७`). None of those is
        //     ever written with a fractional part, so `-N.NN` is essentially never a designation.
        //
        //     ⚠ THE ONE COUNTEREXAMPLE IS THE ONE THIS FILE ALREADY DOCUMENTS, and it is why the range guard is
        //     repeated here rather than trusted to the class above: hi writes a census figure as
        //     `कोच (३१,३८१ -९८.५३% हिंदू)` — "Koch (31,381 – 98.53% Hindu)" — where the dash INTRODUCES the
        //     percentage and is not a sign, and that IS a decimal. It is excluded because a digit precedes the
        //     dash (`३१,३८१ -`), the same shape `defects.ts`'s minus guard now excludes fleet-wide. Verified on
        //     both: `-२.८८ परिमाण` reads ऋण and `-९८.५३%` stays silent.
        s = rewrite(s,
            /(?<![\p{L}\p{M}\p{Nd}-])(?<!\p{Nd}[\p{L}\p{M}]{0,2}[.,]?[ \t]?)[-−–](\d+[.,]\d+)(?![\d.,])/gu,
            "ऋण $1",
        );

        // 7c) THE REMAINING SIGNS. Each word is cited; none is a guess.
        //
        //     COMPARATIVES REORDER, and that is why they are not a table like the rest. Hindi states the
        //     comparison POSTPOSITIONALLY — the standard comes first and से कम / से अधिक follows it — so
        //     `A < B` is "A, B से कम", not "A से कम B". The corpus shows the shape twice:
        //     "+ 30° C से अधिक तापमान" ("temperature above +30 °C") and "800,000 से ज़्यादा सैनिकों"
        //     ("more than 800,000 soldiers"). Emitting the western order would have been fluent nonsense.
        //
        //     THE MECHANISM MOVED TO core/postposedSign.ts, because mr/gu/ta and the verb-final
        //     languages ja/ko/fa all need the same rewrite and its two non-obvious parts — keeping trailing
        //     punctuation off the operand, and the catch-all second pass that stops a chained comparison from
        //     going silent — are exactly the sort of thing that decays when copied. Both were defects found
        //     here first; the shared module records them.
        s = postposedSign(s, "<", "से कम");
        s = postposedSign(s, ">", "से अधिक");
        //     बराबर — corpus: "इस अभिमुखता अनुपात के लगभग बराबर" ("approximately equal to this aspect
        //     ratio"). Infix, which is the arithmetic reading (दस जमा दस बराबर बीस).
        s = rewrite(s, /\s?=\s?/gu, " बराबर ");
        //     गुणा and भाग — hi.wikipedia's अंकगणित names the four operations and ties each to its sign:
        //     "अंकगणित की मुख्य चार मूल प्रक्रियाएँ होती हैं जोड़ घटाना गुणा भाग", then "गुणा को x चिह्न से
        //     प्रदर्शित किया जाता है। उदाहरणः 2 x 4 = 8" and "भाग को / चिह्न से प्रदर्शित किया जाता है".
        //     `/` itself is NOT routed here — step 8 already reads it as the fraction बटा.
        s = rewrite(s, /\s?×\s?/gu, " गुणा ");
        s = rewrite(s, /\s?÷\s?/gu, " भाग ");
        //     ± takes the pair named in the पूर्णांक citation above, in its conventional order.
        // ⚠ SPACED ON BOTH SIDES. `/±\s?/` with an unspaced replacement FUSES the reading onto the preceding word:
        //    `तापमान±5` read *t̪aːpmˈaːnd̪ʱən*, one token, with the stress of neither. The shared symbol tier's
        //    `ampersand` note records the same hazard for the same reason. Every other language that reads ± in this
        //    fleet uses the spaced form; these three did not, and gu/mr got it by copying hi.
        s = rewrite(s, /±/gu, " धन ऋण ");
        //     THE AMPERSAND, split the way the Mandarin pass split it: between LATIN letters it stays inside
        //     the run this engine already delegates to English (`AT&T`, `R&D` are English terms, and reading
        //     half of one in Hindi would be a code-switch mid-word); elsewhere it is और, which the corpus
        //     writes 36 times as the ordinary conjunction.
        s = rewrite(s, /(?<=[A-Za-z])\s?&\s?(?=[A-Za-z])/gu, " and ");
        s = rewrite(s, /\s?&\s?/gu, " और ");

        // 8) FRACTIONS. आधा and तिहाई are suppletive; the rest are "n बटा m", the ordinary spoken form.
        s = rewrite(s, /(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
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
