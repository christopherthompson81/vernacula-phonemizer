/**
 * THE DEFECT CLASSES, in one place (#586) — what counts as a leak, what counts as a drop, and the
 * REDUNDANT-vs-DROP discrimination that separates a permissible drop from a real one.
 *
 * WHY THIS FILE EXISTS. These tables lived in three copies — `mine.ts scan`, `corpus-diff.ts emit` and
 * `coverage.ts` — and they had DRIFTED. The union of the three is strictly better than any one of them:
 *
 *   class        mine.ts        corpus-diff.ts   coverage.ts
 *   minus        [-−–]          [-−] only        absent
 *   math-sign    yes            BLIND            BLIND
 *   exponent     BLIND          BLIND            yes
 *   ampersand    BLIND          BLIND            yes
 *   iteration    BLIND          BLIND            yes
 *   ZERO-WIDTH   yes            absent           absent
 *
 * Read the third row twice. `corpus-diff.ts` is the gate whose own header calls it "the verification gate
 * that caught more real defects than any other check", and it could not see a dropped `&` or a dropped `²`
 * — which are the exact two defects #586 opens with (English, the first language ever treated, drops both).
 * Every language reviewed against that gate was reviewed with those two classes switched off.
 *
 * The drift was invisible because it was three files agreeing on the concept and disagreeing on the data.
 * That is the argument for the extraction: the tables are a SHARED FACT about the fleet, not a per-tool
 * setting, and the ISO-code work in #601 had to be applied to two of the three copies by hand.
 */

/** A LEAK is a character that SURVIVED into the IPA and should not have. */
export const LEAK_CLASSES: readonly (readonly [string, RegExp])[] = [
    // `\p{Nd}`, NOT `\d`: under the `u` flag `\d` is ASCII 0-9 and nothing else, so this class was blind to
    // a digit leak in every language that writes its own numerals — Burmese ၀-၉, Thai ๐-๙, Bengali ০-৯,
    // Khmer, Lao. Found while mining a Burmese hard-set (#585).
    ["DIGIT", /\p{Nd}/u],
    ["SLOT-GAP", /\s{2,}|^\s|\s$/u],
    // NOT `.,;:!?` — those are the CANONICAL inline pause marks every engine emits via clauseSink, so
    // including them flags every utterance and the check tells you nothing. What belongs here is a mark that
    // should have become one of those and did not: a native terminator, a symbol, or a non-ASCII digit.
    // U+00BA º and U+00AA ª are here because the Italian run found the class silently missing them: it had
    // `°` (U+00B0) only, so `dell'11º` → `undˈit͡ʃi º` passed the scan clean and was caught by probing.
    ["RAWMARK", /[…。、，％℃°ºª〜～・！？²³\p{Sc}।॥۔؟،؛]/u],
    ["ZERO-WIDTH", /[​-‍⁠﻿]/u],
];

/**
 * A DROP is a symbol that VANISHED — detected differentially: phonemize the sentence, then phonemize it again
 * with the symbol REPLACED BY A SPACE (see `withoutSymbol`; deleting it perturbs how its neighbours tokenize
 * and the test then credits the symbol for that), and compare. Identical readings prove it said nothing.
 *
 * THE UNION of what the three copies knew, with the widest form of each pattern kept:
 *   · `minus` keeps the EN DASH, which `corpus-diff.ts` was missing — a corpus writes `–5` as readily as `-5`
 *   · `math-sign`, `exponent`, `ampersand` and `iteration` are now visible to EVERY tool
 * `exponent` and `ampersand` in particular are the two #586 cites as having survived undetected through
 * thirty-seven languages because no gate could see them.
 */
export const DROPPABLE: readonly (readonly [string, RegExp])[] = [
    // U+066A ٪ is the Arabic-script sign and U+FF05 ％ the fullwidth one — both are ordinary typography in
    // their scripts, and the tier already accepts them (ar/ur/fa used to pre-fold ٪ locally).
    ["percent", /[%‰٪％]/gu],
    ["currency", /\p{Sc}/gu],
    ["degree", /[°℃℉]/gu],
    // Only where a digit FOLLOWS and no letter/digit precedes, so a compound hyphen (`Il-76`, `COVID-19`)
    // and a range (`5-3`) are not mistaken for a negative. Probe forms never merge two digits, so `-`/`+`
    // are judged on `5-`/`-5` and not on `5-5` → `55`.
    //
    // `\p{M}` IS IN THE GUARD, and leaving it out made this class blind across every abugida in the fleet.
    // A Devanagari word usually ends in a MATRA, not a bare consonant: the character before the hyphen in
    // `फ़ॉर्मूला-1` is ा (U+093E, `Mn`), so `(?<!\p{L})` passed and the scan reported a DROP on Formula-1 —
    // a designation whose hyphen is correctly silent.
    //
    // ⚠ THE SECOND LOOKBEHIND EXCLUDES A RANGE, and without it this class was measuring almost nothing it
    // claimed to. Resolved per hit across all 66 artifacts (docs/investigations/sign_reading_investigation.md),
    // the 15 dropped "minus" instances were 8 RANGES (`dem 10.-11.`, `(1418 -1450)`, `26 -00`, `1995 -96`,
    // `२०१७ -१७`, `1000 -1300`, `10મી -11મી`, `ngo-26 -00`), 4 DESIGNATIONS (`चंद्रयान -1` in hi/mr/ta,
    // `એચજેઆર -3`), 2 APPOSITION dashes (el's parenthetical `–12 χιλιόμετρα … Σιέμ Ριπ–`, my's
    // `(Koreans -၂သန်း)`) — and exactly ONE true negative.
    //
    // A dash BETWEEN TWO NUMBERS is never a minus, so that exclusion costs no recall: the window is
    // deliberately tight (a digit, then at most an ordinal suffix or an abbreviating dot, then at most one
    // space) rather than "a digit somewhere behind". Measured why — hi's one real negative is `०.३७२७१९
    // ख॰इ॰), -२.८८ परिमाण` (an astronomical magnitude), and a window wide enough to reach past `ख॰इ॰),`
    // swallows it. Under-excluding a range is a stray report; over-excluding deletes the only true positive
    // in the fleet.
    //
    // ⚠ A DESIGNATION AFTER A SPACE IS NOT DECIDABLE HERE and is deliberately still reported. `चंद्रयान -1`
    // and a real `-5 stupňů` are the same shape — word, space, dash, digit — so separating them needs a
    // lexicon, not a guard. Those hits want a per-language judgement; a quiet gate would be worse.
    //
    // Corrects this comment's own earlier claim that hi "contains no negative number at all" — it does, and
    // the sentence above is it. That claim was made from the two designation hits without resolving the rest.
    ["minus", /(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}[\p{L}\p{M}]{0,2}[.,]?[ \t]?)[-−–](?=\p{Nd})/gu],
    ["math-sign", /[+±×÷=<>]/gu],
    ["exponent", /[²³⁰¹⁴-⁹]/gu],
    ["ampersand", /[&＆]/gu],
    ["iteration", /[ๆ々〃ヽヾゝゞៗ]/gu],
];

/**
 * ISO codes that denote each currency sign.
 *
 * A CURRENCY IS ALSO NAMED BY ITS ISO CODE, which `contribution` cannot see: the code reads as spelled
 * letters, so the sign's own word is nowhere in the IPA and a correct drop still reports. Malay (#601)
 * writes `$45 juta AUD` — the sign and the code are the same currency stated twice, so saying it once is the
 * right reading and the deletion test cannot pass on it. Sign-keyed rather than a bare three-capitals shape,
 * because that shape is every other initialism in the corpus too.
 */
export const SIGN_CODES: Readonly<Record<string, string>> = {
    $: "USD|AUD|CAD|NZD|SGD|HKD|TWD|MXN|BRL|ARS|CLP|COP",
    "€": "EUR", "£": "GBP", "¥": "JPY|CNY|RMB", "₹": "INR", "₽": "RUB", "₩": "KRW", "₺": "TRY", "₪": "ILS",
};

/** Phonemize one probe string, or undefined if the engine throws on it. */
export type Say = (text: string) => string | undefined;

/**
 * The IPA tokens a symbol adds to a bare `5` — its own word, or [] if it says nothing at all.
 *
 * This is what separates a PERMISSIBLE drop from a defect. The Assamese corpus writes
 * `($১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ)`, which already says "American dollar", so the correct reading is
 * byte-identical with and without the sign and no correct rule can escape the deletion test there. Ask
 * instead whether the symbol's OWN WORD is in the reading: present → the meaning IS spoken → permissible;
 * absent → nothing says it → a real drop.
 *
 * Strictly narrower than "does the engine know this symbol anywhere": Xhosa reads a bare `$5` but swallowed
 * the `$` in `leUS$30`, and that one still reports. A symbol the engine never reads adds no tokens, so it can
 * never be downgraded.
 */
export function makeContribution(say: Say): (sym: string) => string[] {
    const memo = new Map<string, string[]>();
    return (sym: string): string[] => {
        const hit = memo.get(sym);
        if (hit !== undefined) return hit;
        let words: string[] = [];
        const bareRead = say("5");
        if (bareRead !== undefined) {
            const bare = new Set(bareRead.split(/\s+/u));
            for (const probe of [`5${sym}`, `${sym}5`]) {
                const read = say(probe);
                if (read === undefined) continue;
                const added = read.split(/\s+/u).filter((t) => t !== "" && !bare.has(t));
                if (added.length > 0) { words = added; break; }
            }
        }
        memo.set(sym, words);
        return words;
    };
}

/**
 * Is this drop PERMISSIBLE — i.e. does the sentence already say what the symbol means?
 *
 * Two ways it can: the symbol's own word is in the reading (the Assamese case above), or the sentence names
 * a currency by its ISO CODE and that code is itself spoken (the Malay case). The code must be spoken, or a
 * dropped code would license a dropped sign.
 */
export function isRedundant(
    sentence: string,
    ipa: string,
    symbols: readonly string[],
    contribution: (sym: string) => string[],
    say: Say,
): boolean {
    if (symbols.length === 0) return false;
    return symbols.every((sym) => {
        const words = contribution(sym);
        if (words.length > 0 && words.every((w) => ipa.includes(w))) return true;
        const alt = SIGN_CODES[sym];
        if (alt === undefined) return false;
        const code = new RegExp(`(?<![\\p{L}\\p{M}])(?:${alt})(?![\\p{L}\\p{M}])`, "u").exec(sentence)?.[0];
        if (code === undefined) return false;
        const spelled = say(code)?.split(/\s+/u).filter((t) => t !== "") ?? [];
        return spelled.length > 0 && spelled.every((t) => ipa.includes(t));
    });
}

/**
 * THE PROBE STRING for the differential test: the sentence with the symbol replaced by a SPACE.
 *
 * Exported because there are TWO differential loops, not one — `dropsIn` below tests every class against one
 * sentence, while `coverage.ts` iterates PER CLASS and stops at the first hit, which is deliberate (a class
 * whose instances sit late in the corpus is otherwise never tested; getting that wrong once took the fleet
 * count from 38 defective cells to 15). Those two shapes cannot share a loop, so they share this instead —
 * the alternative was the same one-character decision written in two files, which is exactly the drift this
 * module was extracted to end. It happened anyway: the space fix landed in `dropsIn` and `coverage.ts` kept
 * deleting, so the fleet count did not move until this was hoisted.
 *
 * WHY A SPACE AND NOT DELETION: see `dropsIn`.
 */
export const withoutSymbol = (sentence: string, re: RegExp): string => sentence.replace(re, " ");

/**
 * Run the differential drop test for one sentence.
 *
 * `re.lastIndex = 0` BEFORE EVERY `.test`: these regexes are `/g/` and shared across a whole corpus loop,
 * and `RegExp.prototype.test` ADVANCES lastIndex on a hit — so the next sentence resumed mid-string and the
 * one after that started over. Measured: `re.test(s1), re.test(s2), re.test(s1)` → true, false, true on the
 * same pattern. A scan was therefore skipping about half its candidate sentences, silently.
 */
export function dropsIn(
    sentence: string,
    ipa: string,
    say: Say,
    contribution: (sym: string) => string[],
): { klass: string; redundant: boolean }[] {
    const out: { klass: string; redundant: boolean }[] = [];
    for (const [klass, re] of DROPPABLE) {
        re.lastIndex = 0;
        if (!re.test(sentence)) continue;
        // SUBSTITUTE A SPACE, DO NOT DELETE. Deleting the symbol also changes how its NEIGHBOURS tokenize,
        // and the test then attributes that change to the symbol. This is the merge trap `review.ts` had in
        // its `A&B` probe, arriving from the other direction — in real corpus text, and worst in an
        // agglutinative language. Korean's own artifact writes `32℃에`, which reads as two tokens
        // (*sˈɐmsibi ˈe*); delete the ℃ and `32에` agglutinates into one (*sˈɐmsibie*), so the readings differ,
        // the test concluded the ℃ contributed, and `scan` reported ko as having NO DEFECTS while `20℃` read
        // as bare *isˈip̚*. Replacing the symbol with a space holds the token boundary still, so what is
        // compared is the symbol's own contribution and nothing else.
        const without = say(withoutSymbol(sentence, re));
        if (without === undefined || without !== ipa) continue;
        const symbols = [...new Set(sentence.match(re) ?? [])];
        out.push({ klass, redundant: isRedundant(sentence, ipa, symbols, contribution, say) });
    }
    return out;
}
