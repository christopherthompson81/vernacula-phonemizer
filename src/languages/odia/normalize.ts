/**
 * Odia (or) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ ODIA DIGITS ୦-୯ ARE LIVE in real text (୨୦୦୮, ୧୪୦୦, ୬.୫, ୩:୨, ୩୫ମିମି), unlike several sibling Indic
 * languages where the lead fails and the inventory is ASCII throughout. `foldNativeDigits` runs in `text()`
 * BEFORE this pass, because every pattern below is written against ASCII digits; `number()` already folded
 * them for the bare-numeral path, so the fold changes no reading — it only lets these rules see them.
 *
 * ⚠ A LATIN `I` IS USED AS A DANDA in this orthography's running text. Unclaimed it reads as the ENGLISH
 * LETTER [ˈaᶦ] and the sentence break is lost — confidently wrong, not merely dropped.
 *
 * ⚠ NO `\b` ANYWHERE IN THIS FILE. It is ASCII-defined and matches nothing against Odia script, so every
 * boundary is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])` lookaround.
 *
 * SOURCING. Every Odia word emitted below is attested, and most are attested twice — corpus plus a
 * dictionary or referee. ⚠ ONE EXCEPTION IS FLAGGED AS SUCH: `ଡଲାର` (dollar) has no second witness, because
 * the available Odia dictionary predates the loan. It is kept on the strength of independent modern
 * usage, but it does not have the standing of the rest of this list.
 */
import { postposedSign } from "../../core/postposedSign.ts";
import { MANIFEST } from "./manifest.ts";
import { indicNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * The SHARED symbol tier, with Odia's data. Odia count nouns do not inflect after a numeral
 * (ଏକ ଡଲାର / ପାଞ୍ଚ ଡଲାର), so every `CountForms` here is a 1-element array. No `magnitudeConnective`:
 * Odia takes none — the corpus writes "2.3 ମିଲିୟନ୍ ଗ୍ୟାଲନ୍" and "10 ବିଲିଅନ୍ ଯୁରୋ" with nothing between.
 *
 * `US$` IS ITS OWN CURRENCY KEY. The corpus writes "US$14.7 ବିଲିଅନ୍", and with only `$` declared the
 * letter-code prefix was left stranded as a Latin run. The tier matches currency keys as an ALTERNATION
 * sorted longest-first, so declaring the multi-character key is the intended fix rather than a limitation.
 *
 * `unitPer: ପ୍ରତି` IS CORPUS-ORDERED, not guessed. Odia writes exactly the seam's "A per B" shape:
 * "ଏଗାର କିଲୋମିଟର ପ୍ରତି ଘଣ୍ଟା" and "ପ୍ରତି ସେକେଣ୍ଡରେ ପ୍ରାୟ 12.8 କିଲୋମିଟର" both occur. `h` and `s` are
 * `rateDenominators`, never standalone units — a bare `76s` must not become seventy-six seconds.
 *
 * `exponentWords` position is `before`: ବର୍ଗ is a SPACED PREFIX in Odia ("19,500 ବର୍ଗ କିଲୋମିଟର",
 * "3,850 ବର୍ଗ କିଲୋମିଟର" — corpus ×14), not a suffix and not fused. The corpus's `3136 mm2` was leaving
 * the ASCII 2 stranded to be read as the numeral ଦୁଇ.
 *
 * `mph` / `kph` are declared as WHOLE units with a multi-word expansion rather than composed through
 * `unitPer`, because they are written as one token with no slash for the rate machinery to find.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: MANIFEST.symbolTier.percent,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    rateDenominators: MANIFEST.symbolTier.rateDenominators,
    unitPer: MANIFEST.symbolTier.unitPer,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    magnitudes: MANIFEST.symbolTier.magnitudes,
    ampersand: MANIFEST.symbolTier.ampersand,
    multiply: MANIFEST.symbolTier.multiply,
});

/**
 * Odia unit abbreviations → the full word, matched only AFTER a number. Longest first so କି.ମି. beats
 * ମି — ⚠ multi-dot abbreviations BEFORE single-dot ones, expressed as alternation
 * order (an interior dot that survives becomes a phrase break).
 *
 * Attested: କିମି ×2 (both in `160କିମି/ଘଣ୍ଟା`), ମିମି ×2, କି.ମି. ×1, କି.ଗ୍ରା. ×2. କି.ଗ୍ରା. maps to the
 * DOT-STRIPPED form, not to an expansion — see the header.
 */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "କି.ମି.": "କିଲୋମିଟର", "କି.ମି": "କିଲୋମିଟର", "କିମି": "କିଲୋମିଟର",
    "ମି.ମି.": "ମିଲିମିଟର", "ମି.ମି": "ମିଲିମିଟର", "ମିମି": "ମିଲିମିଟର",
    "କି.ଗ୍ରା.": "କିଗ୍ରା", "କି.ଗ୍ରା": "କିଗ୍ରା",
};
const UNIT_ALT = Object.keys(UNIT_WORD)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/\./gu, "\\."))
    .join("|");

/** Measure nouns that may stand either side of a rate slash. A CLOSED LIST on both sides, because only
 *  five of the corpus's fourteen Odia-to-Odia slashes are rates (see the header). */
const RATE_NUM = ["କିଲୋମିଟର", "ମିଲିମିଟର", "ମିଟର", "ମାଇଲ୍", "ମାଇଲ"];
const RATE_DEN = ["ଘଣ୍ଟା", "ସେକେଣ୍ଡ", "ମିନିଟ୍", "ମିନିଟ"];

/** Read from the manifest — LONGEST FIRST, and the order is load-bearing (see the jsonc). */
const ORDINAL_SUFFIXES = MANIFEST.ordinalSuffixes;

/** Build the Odia normalizer. Takes the numbers definition so the ordinal rule composes its cardinal
 *  from exactly the data the engine's own number path uses. */
export function makeOdiaNormalizer(numbers: NumbersDef): (text: string) => string {
    /**
     * The ordinal: the cardinal with the suffix JOINED to its final word. Joining in the DIGITS is not
     * enough — the tokenizer splits a digit run from an adjacent Odia letter, so "18ଶ" still emitted the
     * suffix as its own stressed word. The cardinal therefore has to be composed here, which is why this
     * function takes `numbers`. Bails out (leaving the text alone) on any un-authored 21–99 gap rather
     * than gluing a suffix onto a "?" placeholder.
     */
    const ordinal = (n: number, suffix: string): string | undefined => {
        const words = indicNumberWords(n, numbers);
        if (words.length === 0 || words.some((w) => w === null || w === "")) return undefined;
        const out = words as string[];
        out[out.length - 1] = `${out[out.length - 1]}${suffix}`;
        return out.join(" ");
    };

    return (input: string): string => {
        // 1) THE SHARED SYMBOL TIER FIRST. It matches a sign only when a NUMBER is ADJACENT, and its own
        //    numeral pattern reads "19,500" / "14.7" as ONE token. Steps 5 and 7 below split exactly those
        //    into two tokens, so running them first would strand every sign on half a numeral. (This is
        //    units are resolved BEFORE decimals; here the sign tier precedes both.)
        let s = SYMBOLS(input);

        // 2) ODIA UNIT ABBREVIATIONS, only after a number — which is what keeps ordinary words out, and
        //    why no bare-syllable key is declared at all. Longest first (see UNIT_ALT). The trailing
        //    guard stops ମିମି biting into a longer word. Before step 4 so `160କିମି/ଘଣ୍ଟା` has a
        //    recognisable measure noun on the left of its slash by the time that rule runs.
        s = s.replace(new RegExp(`(\\d)\\s?(${UNIT_ALT})(?![\\p{L}\\p{M}])`, "gu"),
            (_m, d: string, u: string) => `${d} ${UNIT_WORD[u]!}`);

        // 3) LATIN DOTTED INITIALISMS — a.m., p.m., U.S., A.D. Every interior dot was surviving as a
        //    PHRASE BREAK ("07:19 a.m. ରେ" → two of them). The dots are stripped rather than expanded:
        //    the letters then reach the Latin/foreign path as one run, which is what they are.
        //    Two or more single letters, so `802.11a` (a digit on the left) cannot match.
        s = s.replace(/(?<![\p{L}\p{M}\d])([A-Za-z](?:\.[A-Za-z])+)\.?(?![\p{L}\p{M}])/gu,
            (_m, run: string) => run.replace(/\./gu, ""));

        // 4) RATE SLASH between two Odia measure nouns → ପ୍ରତି. Runs after step 2 so the abbreviated
        //    left-hand side has already become a full noun. Closed lists on BOTH sides: nine of the
        //    fourteen Odia-to-Odia slashes in this corpus are ଏବଂ/କିମ୍ବା and the like, and a blanket
        //    rule would read "and per or".
        s = s.replace(
            new RegExp(`(?<![\\p{L}\\p{M}])(${RATE_NUM.join("|")})\\s?/\\s?(${RATE_DEN.join("|")})(?![\\p{L}\\p{M}])`, "gu"),
            (_m, a: string, b: string) => `${a} ପ୍ରତି ${b}`);

        // 5) DIGIT DE-GROUPING, before anything else that reads punctuation. A grouping comma is otherwise
        //    claimed by `clausePunctuation` as a phrase break AND it truncates the numeral: "7,000" was
        //    read as [sˈat̪ɔ , sˈun̪jɔ] — "seven, zero" — because the tokenizer's number class carries no
        //    separators, so the trailing "000" became its own number, 0.
        //    Both groupings: Indian 2-2-3 (1,00,000) and Western 3-3 (5,000,000). A final 3-digit group is
        //    REQUIRED, which keeps a list separator ("1990, 1991" — a space follows) out of the match.
        //    Indian grouping is unattested in THIS corpus (0 instances) and is carried anyway: it costs
        //    one line and Indic sources write it.
        s = s.replace(/(?<![\d,])(\d{1,2}(?:,\d{2})+,\d{3})(?![\d,])/gu, (m) => m.replace(/,/gu, ""));
        s = s.replace(/(?<![\d,])(\d{1,3}(?:,\d{3})+)(?![\d,])/gu, (m) => m.replace(/,/gu, ""));

        // 6) ODIA DOT-ABBREVIATION LEFTOVERS whose expansion is not sourceable — କି.ଗ୍ରା. after a number
        //    is handled in step 2; this catches the standalone-with-trailing-dot shape so the final dot
        //    cannot survive as a break. Kept separate from step 2 so the "expand" and "merely de-dot"
        //    cases stay visibly different.
        s = s.replace(/(?<![\p{L}\p{M}])କି\.ଗ୍ରା\.?/gu, "କିଗ୍ରା");

        // 7) DECIMALS — after de-grouping (a grouped numeral may carry a decimal tail) and before the
        //    clock, so a stray dot cannot survive into a time match. The dot is NEUTRALISED, not spoken:
        //    there is no sourceable Odia spelling of the decimal-point word in this repo (see the header),
        //    and the defect being fixed is the SENTENCE BREAK the dot produced mid-number ("1.2 ମିଲିୟନ"
        //    → [ˈekɔ . d̪ˈui]). Dropping a sign beats speaking a word we cannot source.
        //    This also neutralises 802.11n, which was being read as a sentence boundary inside a standard's
        //    name; "802 11n" is not the right register but it is not a false full stop either.
        s = s.replace(/(\d)\.(?=\d)/gu, "$1 ");

        // 8) TIMES, before the ordinal rule so a bare-number rule cannot claim 11:30 first. The colon was
        //    becoming a COMMA PAUSE ("ten, zero"). Odia reads the clock as bare juxtaposition plus ଟା,
        //    which the corpus already writes ("ରାତି 11:35ଟା", "10:00ଟା - 11:00ଟା"), so the colon becomes a
        //    space. At :00 the minutes DROP OUT — otherwise "10:00ଟା" reads "ଦଶ ଶୂନ୍ୟ ଟା", ten zero —
        //    and the corpus's own bare form is then exactly what is left.
        //    THE TWO-DIGIT MINUTE GUARD IS LOAD-BEARING: the corpus also writes the ratio ୩:୨ (folded to
        //    3:2), which is not a time and does not match. The `(?<![\d:])` guard keeps the sports splits
        //    "4: 41.30" and "2: 11.60" out too — those write a SPACE after the colon, which `:([0-5]\d)`
        //    already rejects — ⚠ a clock rule that permits a following dot will claim a sports time.
        s = s.replace(/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/gu,
            (_m, h: string, min: string) => (Number(min) === 0 ? h : `${h} ${min}`));

        // 9) ORDINAL SUFFIXES. Written attached to the numeral (18ଶ, 1000ତମ) but tokenized apart from it,
        //    so the suffix was spoken as its own stressed word — 18ଶ came out [ˈɔʈʰɔɾɔ sˈɔ]. The suffix is
        //    JOINED to the cardinal's last word instead of being expanded into a distinct ordinal lexeme,
        //    and Odia's own orthography is the warrant: the corpus writes the fully spelled ordinal as ONE
        //    word, "ଚବିଶତମ ସ୍ଥାନ" (24th place). Joining to the DIGITS is not enough — the tokenizer splits
        //    a digit run from an adjacent Odia letter — so the cardinal is composed here (see `ordinal`).
        //    A space may intervene ("60 ତମ", "7 ମ" — corpus).
        //    KNOWN LIMIT, stated rather than papered over: this yields the transparent cardinal+suffix
        //    form, so 1ମ reads ଏକମ where the suppletive Odia ordinal is ପ୍ରଥମ. Authoring the suppletive
        //    1–4 forms is not sourceable here, and one stray syllable removed beats a wrong lexeme added.
        //    THE TRAILING BOUNDARY IS LOAD-BEARING. Without it the single-letter ଶ matches the START of an
        //    ordinary word; in particular "18ଶହ ଶତାବ୍ଦୀ" (×2) is ଶହ, the HUNDRED word, and must be left
        //    alone to read "eighteen hundred". `\b` cannot express this — see the header.
        s = s.replace(
            new RegExp(`(?<![\\d.,])(\\d+)\\s?(${ORDINAL_SUFFIXES.join("|")})(?![\\p{L}\\p{M}])`, "gu"),
            (whole, digits: string, suffix: string) => ordinal(Number(digits), suffix) ?? whole);

        // 10) ABBREVIATIONS. The DOT IS REQUIRED, and so is the visarga: ଡଃ / ଡାଃ are unambiguous, but a
        //     dot-optional rule would also fire on ordinary word-final ଡା. ଡାକ୍ତର is the corpus's own
        //     spelling (×7, plus the kaikki referee). ନଂ. → ନମ୍ବର, likewise corpus-attested (×6).
        s = s.replace(/(?<![\p{L}\p{M}])(?:ଡଃ|ଡାଃ)\.(\s*)(?=[\p{L}])/gu, (_m, sp: string) => `ଡାକ୍ତର${sp || " "}`);
        s = s.replace(/(?<![\p{L}\p{M}])ନଂ\.(\s*)(?=[\d\p{L}])/gu, (_m, sp: string) => `ନମ୍ବର${sp || " "}`);

        // 11) LATIN `I` USED AS A DANDA. Twenty-three of them, every one sentence-final after Odia text
        //     ("…ହୋଇଛି I", "…ପାଇଥିଲେI") — a keyboard artifact for ।, and the single worst defect by
        //     confidence: the Latin branch handed it to the foreign phonemizer and it was SPOKEN as the
        //     English pronoun [ˈaᶦ], while the sentence break vanished. The guard is only against other
        //     LATIN letters and digits, not against Odia ones, because the artifact is frequently glued
        //     to the preceding Odia word with no space. Zero non-danda standalone `I` in this corpus.
        //     Last, so no earlier rule (step 3's initialisms in particular) can be starved of it.
        s = s.replace(/(?<![A-Za-z\d])I(?![A-Za-z\d])/gu, "।");

        // 12) DEGREES. The bare sign was dropped outright. ଡିଗ୍ରୀ is the corpus's own spelling (×3,
        //     including "90(F)-ଡିଗ୍ରୀ" where the text writes the word itself). The corpus's single ° is
        //     the longitude "35°W", for which "35 ଡିଗ୍ରୀ W" is the right reading.
        s = s.replace(/(\d)\s?°/gu, "$1 ଡିଗ୍ରୀ");

        // 13) THE UTC OFFSET'S PLUS. The corpus's `ପ୍ରାୟ 11:00 (UTC+1)ରେ` dropped the sign, and unlike every
        //     other language in this batch THE AUDIO COULD NOT SUPPLY THE WORD — so this rule ships on
        //     TYPOLOGY, and says so rather than dressing an inference up as an attestation.
        //
        //     Both or_in speakers of the sentence SKIP THE WHOLE PARENTHETICAL. MMS-1b-all (`ory`):
        //       speaker A  `… ସ୍ଥାନୀୟ ସମୟ ପ୍ରାୟ 11:00 ଘ ରେ ଏହି …`   ← `ଘ`, the start of ଘଣ୍ଟା "hour", not UTC
        //       speaker B  `… ସ୍ଥାନୀୟ ସମୟ ପ୍ରାୟ 11:0t ରେ ଏହି …`     ← nothing at all
        //     That is the parenthetical-skip pattern the sweep met in ta, en, am, zu, mi, ne, sr, sw, yue and
        //     te: ordinary reader behaviour, and by the standing rule it is NEVER counted against a word. It
        //     also means the sign still needs a reading, because for TTS a typed character is content.
        //
        //     WHY ପ୍ଲସ୍ AND NOT THE NATIVE ଯୋଗ. Because the six Indic languages whose plus WAS resolved from
        //     audio in this sweep all borrow, unanimously and with no native-word counterexample: hi प्लस,
        //     ne प्लस, te ప్లస్, gu પ્લસ, kn ಪ್ಲಸ್, ml പ്ലസ്, ta பிளஸ். Seven independent recordings agreeing
        //     across four scripts is a strong prior for the eighth, and the alternative — ଯୋଗ, the
        //     mathematical noun "addition" — is the exact shape those recordings ruled out elsewhere (hi's
        //     first draft used धन and the audio corrected it to प्लस).
        //     ⚠ THIS IS THE WEAKEST-SOURCED CELL IN THE SWEEP. If or_in audio for another `+` ever turns up,
        //     check it against this string first.
        //     Digit-keyed on the right only: the offset is `UTC+1`, so the sign has a LETTER before it and a
        //     digit after, and a range or a compound hyphen cannot reach this arm.
        // THE MINUS AND ±. ⚠ MEASURED SAFE: every `-<digit>` in or_in is a range, score or closed
        //    designation, and there are ZERO instances of `word · space · hyphen · digit` — the one shape no
        //    guard can reject, and the one that made mr, nl, ta, gu, kn and yue decline this rule.
        //
        //    `ଋଣାତ୍ମକ` ×7 / 3 articles is the POLARITY word, attested on the number line beside its opposite
        //    `ଧନାତ୍ମକ` (positive), which is the sense a leading sign needs. The loan `ମାଇନସ` is ×0 here, and
        //    `ବିଯୋଗ` is the subtraction OPERATION. bn already reads its cognate `ঋণাত্মক` in exactly this slot,
        //    so the Indic treatment is consistent — and each was sourced from its own language.
        //
        //    Three guards: a digit immediately after the sign, a letter or digit immediately before, and a digit
        //    ANYWHERE to the left (the spaced range/score, which the fleet's usual guard misses).
        s = s.replace(/±/gu, " ପ୍ଲସ୍ ଋଣାତ୍ମକ ");
        s = s.replace(/(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)/gu, (m0: string, off: number, whole: string) =>
            /\d\s*$/u.test(whole.slice(0, off)) ? m0 : "ଋଣାତ୍ମକ ");
        s = s.replace(/\+(?=\d)/gu, " ପ୍ଲସ୍ ");

        // THE RELATIONAL AND DIVISION SIGNS, sourced ENTIRELY from or_in:
        //
        //   `ସମାନ`        ×41 token  "ଫର୍ମାଟ ସମାନ କିମ୍ବା ଏହି ପରିମାପ ଅନୁପାତର ଅତି ନିକଟତର" — EQUAL TO this ratio
        //   `ଠାରୁ କମ`      ×3 phrase  ·  `ଠାରୁ ଅଧିକ` ×16 phrase — both postposed
        //   `ଭାଗ`         ×9 token   the division word, cognate of hi's भाग
        //
        // ⚠ `ଭାଗ` IS A SUBSTRING TRAP TOO, like bn's ভাগ: ×9 token against ×60 SUBSTRING, inside ତଳଭାଗରେ ("in the
        // lower part") and similar compounds where it is the ordinary noun "part". The token count is the
        // evidence.
        //
        // The comparatives are POSTPOSITIONAL (ଠାରୁ follows the standard and fuses to it — ସବୁଠାରୁ ଅଧିକ), so they
        // use core/postposedSign.ts; an infix rule would read the comparison backwards.
        s = postposedSign(s, "<", "ଠାରୁ କମ");
        s = postposedSign(s, ">", "ଠାରୁ ଅଧିକ");
        s = s.replace(/\s?=\s?/gu, " ସମାନ ");
        s = s.replace(/\s?÷\s?/gu, " ଭାଗ ");

        return s;
    };
}
