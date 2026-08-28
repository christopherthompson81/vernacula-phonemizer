/**
 * Gujarati (gu) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ GUJARATI REUSES HINDI'S ENGINE (`makeNativeHindi`), AND THAT MAKES INHERITING HINDI'S SYMBOL WORDS A
 * SILENT DELETION rather than a wrong reading. Hindi's words are written in DEVANAGARI, which is not in
 * `core/unicode.ts`'s GUJARATI_WORD, so the tokenizer never emits them at all:
 *     "45%"          → [pˈistalis]          the percent word vanishes entirely
 *     "$45 મિલિયન"    → [pˈistalis mˈilijən]  so does the currency word
 *     "11:00 વાગતાજ"  → [ˈəɡijaɾ ʋˈaɡt̪ad͡ʒ]    Hindi's बजे vanishes, and :00 is dropped
 * Every symbol tier in this file therefore REPLACES an inherited Hindi one. Adding a Devanagari word here
 * does not degrade the reading — it produces no reading at all.
 *
 * ⚠ THE LARGEST DEFECT CLASS IS A DIGIT WITH AN ATTACHED GUJARATI SUFFIX (માં, ના, મી, થી, ની …), which is
 * ordinary Gujarati morphology and not an ordinal marker. Step 7 owns it.
 *
 * ⚠ ASCII `:` IS WRITTEN FOR THE VISARGA (પુન:, સંભવત:, ક્રમશ:), so a colon here is not always a clock.
 *
 * NEGATIVE RESULTS, recorded so they are not re-investigated: Gujarati text punctuates with the ASCII period
 * rather than the danda ।/॥, and the ZWJ/ZWNJ defect that bites Marathi does not occur.
 *
 * ⚠ SOURCING. Everything this file emits is attested in Gujarati text in the same function, EXCEPT a short
 * list taken as transparent international or arithmetic vocabulary: સેલ્સિયસ, ફેરનહીટ, સેન્ટીમીટર,
 * કિલોગ્રામ, રૂપિયા, ભાગ્યા, and દશાંશ (the exact cognate of the दशांश already shipped for Marathi).
 * A wrong word is worse than a dropped sign, so anything not in one of those two categories is omitted.
 */
import { MANIFEST } from "./manifest.ts";
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { postposedSign } from "../../core/postposedSign.ts";
import { tr } from "../../core/provenance.ts";

/**
 * Irregular ordinals, from the manifest. ⚠ INDEXED BY NUMBER IN CODE BUT BY STRING IN JSON — JSON keys
 * are always strings and JS coerces a numeric index on lookup, so the cast is where that asymmetry is
 * paid. The C# port cannot coerce and converts at the call site instead.
 */
const IRREGULAR = MANIFEST.irregularOrdinals as unknown as
    Readonly<Record<number, readonly [string, string, string, string]>>;

/** The written vowel of an ordinal suffix → the agreement slot it marks. Read off the text, never
 *  guessed: the suffix itself carries the gender/number in Gujarati (પંદરમી / પંદરમો / પંદરમા). */
const FORM: Readonly<Record<string, 0 | 1 | 2 | 3>> = { "ો": 0, "ી": 1, "ું": 2, "ા": 3, "ે": 3 };
/** The suppletive consonant each of 1-4/6 takes. 4's is થ, which is ALSO the ablative postposition થી —
 *  so `4થી` is ambiguous between "fourth" and "from four". The corpus contains no `4થી`, so the pairing
 *  is excluded at the call site (step 13) rather than resolved by guesswork. */
const IRREGULAR_CONSONANT: Readonly<Record<number, string>> = {
    1: "લ", 2: "જ", 3: "જ", 4: "થ", 6: "ઠ્ઠ",
};

/**
 * POSTPOSITIONS written ATTACHED to a numeral — the corpus's single largest defect class, 120 instances.
 * "1537માં" tokenized as a number plus a separate word and came out [… saɽˈət̪ɾis mˈã], a stressed stray
 * syllable, where the orthography says one word, સાડત્રીસમાં → [… saɽət̪ɾˈismã]. NO SPACED FORM is in
 * this list: a postposition written with a space genuinely IS a separate word and the engine already
 * stresses it correctly. `ને` is deliberately absent — it is also the colloquial "and", and the corpus's
 * "1 ને 6 જુલાઈએ" means "the 1st and the 6th". Longest first (માંથી must beat માં).
 */
const POSTPOSITION = ["માંથી", "માં", "નાં", "ના", "ની", "નું", "નો", "થી"]
    .sort((a, b) => b.length - a.length)
    .join("|");

/**
 * Gujarati DOTTED abbreviations that are not initialisms and must be claimed before the generic
 * dotted-initialism rule in step 5 would spell them out letter by letter.
 */
const DOTTED: Readonly<Record<string, string>> = {
    "કિ.મી.": "કિલોમીટર", "કી.મી.": "કિલોમીટર",
    "દા.ત.": "દાખલા તરીકે",
    "ફે.": "ફેરનહીટ",
};
const DOTTED_ALT = Object.keys(DOTTED)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/\./gu, "\\."))
    .join("|");

/**
 * The -તઃ / -નઃ adverbs and prefixes, written in this corpus with an ASCII colon for the visarga:
 * પુન: ×5 (પુન:સ્થાપિત, પુન:સ્થાપન, પુન:સર્જન, પુન: પ્રતિકૃતિ, પુન: પ્રાપ્ત), સંભવત: ×2, ક્રમશ: ×1,
 * અંત: ×1. A CLOSED LIST, not the pattern `ત:` — the corpus's "લાંચ: રુશવત" is the compound લાંચ-રુશવત
 * and its 40-odd genuine list colons ("કહ્યું: …", "છે: …") must stay the phrase break the manifest
 * maps them to. ⚠ The same over-counting trap any short unit key has in an abugida.
 */
const VISARGA_WORD = ["પુન", "સંભવત", "ક્રમશ", "અંત", "વિશેષત", "મુખ્યત", "સામાન્યત", "અંશત"].join("|");

/** Build the Gujarati normalizer. Takes the numbers definition so the ordinal and join rules compose
 *  their cardinals from the same data the engine's own number path uses. */
export function makeGujaratiNormalizer(numbers: NumbersDef): (text: string) => string {
    /** Integer → its Gujarati cardinal words, exactly as the engine's number path would render them. */
    const cardinal = (n: number): string[] => indicNumberWords(n, numbers).map((w) => w ?? "");
    const cardinalText = (n: number): string => cardinal(n).join(" ");

    /** Spell `digits` (possibly comma-grouped) and GLUE `suffix` to the final word — the whole point of
     *  the join: સાડત્રીસ + માં is one word in the orthography and must be one token here. */
    const glue = (digits: string, suffix: string): string | undefined => {
        const n = Number(digits.replace(/,/gu, ""));
        if (!Number.isSafeInteger(n)) return undefined;
        const words = cardinal(n);
        if (words.length === 0 || words.some((w) => w === "")) return undefined;
        words[words.length - 1] = `${words[words.length - 1]!}${suffix}`;
        return words.join(" ");
    };

    return (input: string): string => {
        let s = input;

        // 1) GUJARATI DIGITS ૦-૯ → ASCII. First, because every rule below — and the shared symbol tier,
        //    whose NUM is `\d+…` — is ASCII-defined.
        //    NEGATIVE RESULT, recorded because the lead was worth checking: this corpus contains only 11
        //    Gujarati digits, in TWO utterances, where Marathi's had 597. The Marathi finding does NOT
        //    generalise to Gujarati. The fold is kept anyway because it costs nothing (the engine's own
        //    number() already folds them, so this is loss-free) and because both instances happen to be
        //    exactly the forms steps 7 and 8 exist for: "રાત્રે ૧૦.૦૦-૧૧:૦૦" and "સવારે ૮.૪૬ વાગ્યે".
        s = tr(s, /[૦-૯]/gu, (d) => String(d.charCodeAt(0) - 0x0ae6));

        // 2) ASCII ':' written where a VISARGA ઃ was meant. Before the clock rules in step 7, which
        //    compete for the same character. GUJARATI_WORD ("઀-૥૰-૿") already covers U+0A83 ઃ, so the
        //    folded form is a single token; unfolded, પુન:સ્થાપિત was split into two words by a comma
        //    pause, [pˈun , st̪ʰˈapit̪].
        s = tr(s,
            new RegExp(`(?<![\\p{L}\\p{M}])(${VISARGA_WORD}):`, "gu"),
            "$1ઃ",
        );

        // 3) ERA MARKERS, before the dotted-initialism rule in step 5 (which would otherwise spell ઈ.સ.
        //    as two letter names) and before anything that reads a dot as a phrase break: "ઇ.સ. પૂર્વે"
        //    was producing two of them, [ˈi . sˈə . pˈuɾʋe]. Both ઇ and ઈ occur. પૂર્વે is already an
        //    ordinary word and needs no rewriting, so only the abbreviation itself is claimed — which is
        //    also what makes the bare "ઈ.સ. 1000-1300" case fall out for free. The expansion ઈસવીસન is
        //    the corpus's own spelling ("ઈસવીસન પૂર્વે 21 જુલાઈ, 356ના રોજ").
        s = tr(s, /(?<![\p{L}\p{M}])[ઇઈ]\.\s?સ\./gu, "ઈસવીસન");

        // 4) DOTTED ABBREVIATIONS that are not initialisms (કિ.મી., દા.ત., ફે.), before step 5 for the
        //    same reason. Longest key first.
        s = tr(s, new RegExp(`(?<![\\p{L}\\p{M}])(${DOTTED_ALT})`, "gu"), (_m, k: string) =>
            DOTTED[k]!);

        // 5) GUJARATI DOTTED INITIALISMS — યુ.એસ. ×7, યુ.એન., એફ.ટી.એ., એ.એફ.સી.એફ.ટી.એ. Each interior
        //    dot was surviving as a phrase break: "યુ.એસ." → [jˈu . ˈes .], a three-way split of one
        //    word. The letters are already the right reading (they are Gujarati transliterations of the
        //    English letter names), so all this has to do is drop the dots and keep the letters apart.
        //
        //    THE SHAPE IS EVIDENCE, NOT CAUTION. Components are capped at TWO codepoints and no space is
        //    permitted between them, because a laxer pattern would claim ordinary sentence-final periods
        //    ("…છે. તે…" is two short tokens either side of a dot). Run over the whole corpus, this
        //    pattern matches 18 times and every one of the 18 is a real abbreviation — zero false
        //    positives. The cost of the strictness is the one instance written with spaces,
        //    "(યુ. ટી. સી.+1)", which is left alone.
        s = tr(s, /(?:[઀-૿]{1,2}\.){2,}/gu, (m) =>
            `${m.slice(0, -1).split(".").join(" ")} `);

        // 6) SINGLE-DOT ABBREVIATIONS. ડો./ડૉ. ×6, always written with the dot, which is consumed so it
        //    cannot become a phrase break. ડૉક્ટર is the corpus's own spelling.
        s = tr(s, /(?<![\p{L}\p{M}])ડ[ોૉ]\.(\s+)(?=[\p{L}])/gu, "ડૉક્ટર$1");

        // 7) TIMES. Four rules, and the guards between them are the point.
        //    7a) The clock written with a DOT rather than a colon, which happens beside વાગ્યે / કલાકે
        //        ("સવારે ૮.૪૬ વાગ્યે", "રાત્રે ૧૦.૦૦-૧૧:૦૦"). Folded to a colon so 7d claims it; left
        //        alone it would be read by the decimal path added in this change as "આઠ દશાંશ ચાર છ".
        s = tr(s,
            /(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d.,])(?=\s?[-–]\s?\d{1,2}[:.]\d{2}|\s*(?:વાગ|કલાક))/gu,
            "$1:$2",
        );
        //    7b) SPORTS times mm:ss.hh — 4:41.30, 2:11.60, 1:09.02 (×3, all swimming/athletics, all
        //        followed by મિનિટ). These are NOT clocks. The inherited Hindi clock rule claimed them
        //        (its `(?![\d:])` permits a following dot) and produced [t͡ʃˈaɾ ˈekt̪alis . t̪ɾˈis] — a
        //        bogus clock plus a spurious phrase break. Dropping the colon leaves two plain numbers,
        //        which is the honest reading and which nothing downstream can re-claim.
        s = tr(s, /(?<![\d.,:])(\d{1,2}):(\d{2}\.\d{1,2})(?![\d:])/gu, "$1 $2");
        //    7c) h:mm:ss, which occurs once as "(શુક્રવારે 09: 19: 00 જીએમટી)". Before 7d so that 7d's
        //        `(?![\s\d.:])` cannot claim its first two fields.
        s = tr(s, /(?<![\d.,:])(\d{1,2}):\s?([0-5]\d):\s?([0-5]\d)(?![\d.,:])/gu, "$1 $2 $3");
        //    7d) The clock proper. A space after the colon is permitted — the corpus writes "1: 15",
        //        "07: 19".
        //
        //        THE READING IS DELIBERATELY MINIMAL. Hindi's inherited rule builds a full
        //        "H બજકર M મિનટ" phrase; Gujarati's equivalent construction would be "H વાગીને M મિનિટે",
        //        and વાગીને/મિનિટે appear NOWHERE in this corpus. Rather than invent the phrase, this rule
        //        fixes the two defects that are actually measurable — the colon became a phrase break, and
        //        a :00 was read as શૂન્ય — by removing the colon and, at :00 only, supplying the corpus's
        //        own વાગ્યે (×9). Every other word in the sentence survives, so "11:29 ની આસપાસ" reads
        //        "અગિયાર ઓગણત્રીસ ની આસપાસ" and "8:30 વાગ્યે" keeps its own વાગ્યે.
        //
        //        વાગ્યે is NOT supplied when the sentence already carries a clock word or a timezone
        //        after the time — "12:00 GMT વાગ્યે" and "11:00 (યુ. ટી. સી.+1) કલાકે" would otherwise
        //        each have said it twice.
        s = tr(s,
            /(?<![\d.,:])([01]?\d|2[0-3]):\s?([0-5]\d)(?![\d.:])/gu,
            (m, h: string, min: string, offset: number, whole: string) => {
                if (Number(min) !== 0) return `${h} ${min}`;
                const rest = whole.slice(offset + m.length, offset + m.length + 40);
                return /વાગ|કલાક|GMT|UTC|જીએમટી|યુટીસી|યુ\.?\s?ટી/u.test(rest) ? h : `${h} વાગ્યે`;
            },
        );

        // 8) DEGREES, before any rule that would separate the sign from its digit. ડિગ્રી, not Marathi's
        //    અંશ and not Hindi's inherited डिग्री: the corpus writes the word itself in exactly this
        //    function ("35 ડિગ્રી પશ્ચિમ", "90 (ફે.) - ડિગ્રી ગરમીમાં"), where its અંશ ×7 all mean
        //    "extent/portion" instead. The only ° in the corpus is "+30°C થી વધુ".
        // THE PLUS → પ્લસ, SOURCED FROM THE CORPUS'S OWN AUDIO. The sign was DROPPED, so `+30°C` read *ત્રીસ
        // ડિગ્રી* — thirty degrees, with nothing where the sign was — and `(યુ. ટી. સી.+1)` lost it too.
        // No text tier could give the word: concept.ts returns the BARE CHARACTER `+` as Gujarati's own label
        // for "plus sign", and prose writes the glyph. Decoded with facebook/wav2vec2-xlsr-53-espeak-cv-ft, a
        // PHONEME recognizer whose 392-token vocabulary holds no `+` and no digits, over gu_in/train:
        //   UTC+1  →  `… a r j uː t i s iː  p l a s v o n  k a l l a k …`   2 of 3 speakers
        //   +30°C  →  `… m a h i n ɔ o m a  p l a s  t r iː s d i ɡ r i …`  and
        //             `… m a h i n aʊ m a  p l a s  t r e s aʊ s s ɛ l ts i a s …`   BOTH speakers
        // ⚠ gu VOICES THE MEASUREMENT PLUS, 2 of 2 — unlike en, hi, vi, te, xh and am, which all omit it there,
        // and like ta and mi. So the reading habit genuinely splits across the fleet; it is not a universal.
        // પ્લસ reads plˈəs, matching the decode, so no new lexical data was needed.
        // BEFORE the degree rule — the ordering coupling zu's `[+]?` taught.
        s = tr(s, /(\S)\+\s?(?=\d)/gu, "$1 પ્લસ ");
        s = tr(s, /(^|\s)\+\s?(?=\d)/gu, "$1પ્લસ ");

        // 8b) THE RELATIONAL AND DIVISION SIGNS, and ±. Sourced from gu_in throughout — gu.wikipedia is
        //     thin here (`બરાબર`, `ભાગ્યા`, `વત્તા` are all ×0 in its arithmetic articles), so tier 2 is the
        //     whole of the evidence.
        //
        //     ⚠ THE COMPARATIVES ARE POSTPOSITIONAL and use core/postposedSign.ts: Gujarati puts કરતાં after the
        //     standard of comparison — "કીબોર્ડ કરતાં વધુ નવું" (newer than a keyboard) ×17,
        //     "ધાર્યા કરતાં ઓછું" (less than expected) ×2. Substituting between the operands would read the
        //     comparison backwards.
        //
        //     ⚠ THE DIVISION WORD COMES FROM FLEURS BEING A PARALLEL CORPUS. Its aspect-ratio sentence performs
        //     a division aloud in 57 of the 67 languages, and the Gujarati translator wrote
        //     "બાર દ્વારા વિભાજીત" — દ્વારા after the operand, then વિભાજીત — so this is postpositional too, and
        //     it is a recording of a human saying it rather than a register guess (×3).
        //
        //     ± pairs this file's own audio-sourced પ્લસ with માઈનસ, its loan counterpart, in the juxtaposed form
        //     every language that reads ± uses. The minus is the same loan: the corpus has no minus sign to
        //     decode, so the pairing rests on પ્લસ having been decoded from the audio directly above.
        // ⚠ SPACED ON BOTH SIDES. `/±\s?/` with an unspaced replacement FUSES the reading onto the preceding word:
        //    `તાપમાન±5` read *t̪apmanˈəpləs*, one token, with the stress of neither. The shared symbol tier's
        //    `ampersand` note records the same hazard for the same reason. Every other language that reads ± in this
        //    fleet uses the spaced form; these three did not, and gu/mr got it by copying hi.
        s = tr(s, /±/gu, " પ્લસ માઈનસ ");
        s = postposedSign(s, "<", "કરતાં ઓછું");
        s = postposedSign(s, ">", "કરતાં વધુ");
        s = postposedSign(s, "÷", "દ્વારા વિભાજીત");
        s = tr(s, /\s?=\s?/gu, " બરાબર ");

        s = tr(s, /(\d)\s?°\s?C(?![\p{L}\p{M}])/giu, "$1 ડિગ્રી સેલ્સિયસ");
        s = tr(s, /(\d)\s?°\s?F(?![\p{L}\p{M}])/giu, "$1 ડિગ્રી ફેરનહીટ");
        s = tr(s, /(\d)\s?°/gu, "$1 ડિગ્રી");

        // 9) TILDE. આશરે ("approximately") is the corpus's own word, ×5. Before step 13, which would
        //    otherwise leave the sign stranded against a spelled-out number.
        s = tr(s, /~\s?(?=\d)/gu, "આશરે ");

        // 10) (no step 10 — units, percent and currency are DATA, in gujarati.ts's symbol tier, which the
        //     engine runs AFTER this pass. That ordering is why step 13 must not eat a currency-adjacent
        //     numeral; see the guard there.)

        // 11) RANGES N-M → "N થી M". THE ASCENDING GUARD IS EVIDENCE, NOT CAUTION, and it reproduces the
        //     Marathi finding exactly. Of the 17 hyphenated number pairs here, 4 are sports results —
        //     5-3 (an ice-hockey win), 26 - 00 (a rugby scoreline), 6-6 (a tennis tie-break), 7-2 (a
        //     head-to-head record) — where "થી" ("from…to") is simply wrong and the silent hyphen the
        //     engine already produces is correct. Every one of those 4 is descending or equal, and 13 of
        //     the 13 genuine ranges (1644-1912, 1469-1539, 10-60 મિનિટ, 100-200 માઇલ/કલાક, 120-160,
        //     35-40, 56-64, 2-5 દિવસ, 1418 - 1450 …) are ascending. So the rule fires only when b > a:
        //     13 gained, 0 broken, 2 real ranges deliberately missed (1995-96, an abbreviated year span,
        //     and 4.2-3.9, a descending "million years ago" span). થી as the range connective is the
        //     corpus's own ("2 થી 3 મિલિયન", "10થી 15 લોકો", "100થી 250 મીટર" — 737 થી in all).
        s = tr(s,
            /(?<![\d.,])(\d+(?:\.\d+)?)\s?[-–—]\s?(\d+(?:\.\d+)?)(?![\d.,])/gu,
            (m, a: string, b: string) => (Number(b) > Number(a) ? `${a} થી ${b}` : m),
        );

        // 12) FRACTIONS. Only ONE of the corpus's three digit/digit forms is a fraction: "5 મીમી (1/5
        //     ઇંચ)". The other two are "293/4 ઇંચથી 241/2 ઇંચ" — mixed numbers, 29¾ and 24½, written
        //     without the space. Hence `num < den`, which admits 1/5 and refuses both of those; without
        //     it they would have become "બસો ત્રાણું ભાગ્યા ચાર". અડધો is corpus-attested; ભાગ્યા is the
        //     ordinary spoken division form (and replaces Hindi's inherited બટા-equivalent, which would
        //     have been emitted in Devanagari and so dropped outright).
        s = tr(s, /(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (m0, a: string, b: string) => {
            const num = Number(a), den = Number(b);
            if (num >= den) return m0;
            if (num === 1 && den === 2) return "અડધો";
            const nw = cardinalText(num), dw = cardinalText(den);
            return nw === "" || dw === "" ? m0 : `${nw} ભાગ્યા ${dw}`;
        });

        // 13) ORDINALS AND ATTACHED POSTPOSITIONS — one rule, because in Gujarati they are the same
        //     operation. The regular ordinal is the cardinal plus -મ- plus the agreeing vowel, and it is
        //     spelled as ONE word (પંદર + મી = પંદરમી); an attached postposition is likewise one word
        //     (સાડત્રીસ + માં = સાડત્રીસમાં). For every non-suppletive number the two are literally the
        //     same string, so "10માં સ્થાન" (10th place) and "1537માં" (in 1537) need no disambiguation
        //     at all — which is what makes a single join rule correct rather than a compromise.
        //
        //     13a) The SUPPLETIVE ordinals, first, because 1/2/3/4/6 are the only numbers for which the
        //          ordinal is not the cardinal. 4+થ is excluded: થી is also the ablative postposition and
        //          `4થી` would be ambiguous between "fourth" and "from four"; the corpus has no instance,
        //          so it is left to 13b (→ ચારથી) rather than resolved by guessing.
        s = tr(s,
            /(?<![\d.,])(\d)(લ|જ|થ|ઠ્ઠ)(ો|ી|ું|ા|ે)(?![\p{L}\p{M}])/gu,
            (m, d: string, cons: string, vowel: string) => {
                const n = Number(d);
                if (IRREGULAR_CONSONANT[n] !== cons) return m;
                if (n === 4 && cons === "થ" && vowel === "ી") return m;
                return IRREGULAR[n]![FORM[vowel]!];
            },
        );
        //     13b) The suppletive numbers written with the REGULAR -મ- suffix (1મી, 6ઠ્ઠ- aside). Not
        //          attested here — included because it is reachable and "એકમી" would be plainly wrong —
        //          and kept off the postposition path by requiring a bare vowel, never માં.
        s = tr(s,
            /(?<![\d.,])([12346])\s?મ(ો|ી|ું|ા|ે)(?![\p{L}\p{M}])/gu,
            (_m, d: string, vowel: string) => IRREGULAR[Number(d)]![FORM[vowel]!],
        );
        //     13c) The general join, for every other numeral. A SPACE is permitted only before the
        //          ordinal -મ- ("15 મી સદી" ×6, "11 મી, 12 મી, અને 13 મી સદી") — a postposition written
        //          with a space genuinely IS a separate word and already reads correctly.
        //
        //          THE TRAILING BOUNDARY IS THE WHOLE RULE. Without `(?![\p{L}\p{M}])` the મ- alternative
        //          matches the first character of મીટર, મીલીમીટર, મીમી, મિનિટ, મહિના and મુકામ — the same
        //          over-counting trap any short unit key has in an abugida, and live in this corpus at
        //          "35 મીલીમીટર", "83 મીટરની", "45 મિનિટમાં", "3 મહિનામાં".
        //
        //          THE CURRENCY LOOKBEHIND IS ALSO LOAD-BEARING, and it is an ORDERING coupling with the
        //          shared symbol tier rather than a boundary: the tier runs AFTER this pass and matches
        //          `SIGN NUM`, so spelling out the digits of "US$11,000થી" here would have destroyed the
        //          adjacency and dropped the currency word entirely. Left alone, the tier rewrites it to
        //          "11,000 ડોલરથી", which is the right Gujarati and needs no join.
        s = tr(s,
            new RegExp(
                `(?<![\\d.,$€£¥₹])(\\d+(?:,\\d+)*)(?:\\s?(મ[ોીાે]|મું)|(${POSTPOSITION}))(?![\\p{L}\\p{M}])`,
                "gu",
            ),
            (m, digits: string, ord: string | undefined, post: string | undefined) =>
                glue(digits, ord ?? post!) ?? m,
        );

        return s.replace(/ {2,}/gu, " ");
    };
}
