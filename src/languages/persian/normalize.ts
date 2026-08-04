/**
 * Persian / Farsi (fa) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * IT SITS ABOVE THE NEURAL MACHINERY (the structural tagger / vowel restorer), which constrains what it may emit:
 * the tagger's source alphabet (fa-tagger.meta.json) is 42 symbols of BARE Perso-Arabic — no harakat at all — so
 * every short-vowel diacritic this layer emitted would reach the model as <unk>. Therefore this file emits only
 * (a) plain undiacritized Persian words and (b) ASCII digits, both of which the existing pipeline already reads.
 * Where a number word is wanted it is left as DIGITS and handed back to the engine's own number path, which uses
 * the diacritized manifest table via the lexicon-free core — the diacritics stay on the far side of the tokenizer.
 *
 * MEASURED over the fa_ir FLEURS corpus, 1,856 unique utterances, column 3 (the cased original):
 *   digit runs ×591 · sentence period ×2081 · Arabic comma ×1691 · guillemets «» ×490 · ZWNJ ×3235
 *   comma-grouped numbers ×19 (ASCII) + ×4 (Arabic comma ⟨،⟩ used as the grouping mark) + ×1 (period-grouped)
 *   decimals ×18 · clock times ×14 · percent ×4 (2× ASCII %, 2× Arabic ٪) · ordinals (Nام) ×5
 *   hyphen between numbers ×11 · slash ×14 · Latin runs ×125 · ؛ ×42 · ؟ ×11
 *   Arabic-Indic digits ۰-۹ ×0 — Persian FLEURS is written entirely in ASCII digits (the fold is kept anyway,
 *   because ۰-۹ are ordinary in Persian typing and the engine's number path already folds them).
 *   Currency signs ×0, abbreviated units ×0, dotted abbreviations ×0, degree sign ×0 — see "NOT DONE" below.
 *
 * TWO DEFECTS WERE NOT IN THIS LAYER (playbook step 3) and are fixed where they live, both in Persian's own files:
 *   • the number COMPOSER was the Indic lakh/crore one → persian/numbers.ts + the persian.jsonc table (21 read as
 *     "یک بیست", 200 as "دو صد", 1,000,000 as "ده صد هزار", and no ⟨و⟩ anywhere);
 *   • the g2p DROPPED any harakat written after ⟨ه⟩, because the ⟨ه⟩ branch returns before the shared harakat
 *     consumption. That silently corrupted the number table itself: هِزار → [hzˈaːɾ], هَفت → [hfˈat], هَشتاد →
 *     [hʃatˈaːd] — i.e. every year from 1000 up. Fixed in persian.ts; zero of the 4,132 mined lexicon entries
 *     write a harakat after ⟨ه⟩, so no other word in the engine changed behaviour.
 *
 * BOUNDARIES ARE EXPLICIT LOOKAROUNDS, NEVER `\b` — the ASCII definition of `\b` matches nothing against
 * Perso-Arabic script (the trap that has now bitten six languages, including core/initialisms.ts itself).
 *
 * ZWNJ (U+200C, ×3235) is a WORD-INTERNAL joiner in Persian (می‌رود, بچه‌ها). No rule here may split a word at
 * one, so every "not a letter" guard also excludes ZWNJ; the ordinal rule is the one place a ZWNJ is consumed,
 * and only between a digit run and the ordinal suffix (⟨1000‌ام⟩), which is not a word-internal position.
 *
 * NOT DONE, deliberately, after measuring (negative results — see the commit message):
 *   • RANGES on the hyphen (×11). The corpus makes this genuinely ambiguous rather than merely unhandled: 6 are
 *     ranges (10-60 دقیقه, 120-160 متر, 1644-1912), 3 are SPORTS SCORES (5-3, 6-6, 26 - 00 — Persian reads those
 *     with بر, not تا), and 3 are stored in BIDI-REVERSED logical order (⟨1539- 1469⟩ for the displayed
 *     1469-1539, ⟨96-1995⟩ for 1995-96), so a تا inserted by position would say "1539 to 1469". Nothing in the
 *     text separates these cases, a wrong connective is worse than none, and both numbers already reach the
 *     output as separate words. Left alone.
 *   • FRACTIONS on the slash (×14): 13 are word separators (و/یا "and/or", جاکارتا/بومتهنگ) and exactly ONE is a
 *     fraction (1/5 اینچ). One instance does not justify a rule that would mis-fire on the other thirteen.
 *   • CURRENCY: no currency sign occurs at all (amounts are written out — دلار, یورو, ین, پوند). A sign table
 *     would be inventing data with nothing in the corpus to check it against.
 *   • UNIT ABBREVIATIONS: none. Units are spelled out (کیلومتر, میلی‌متر, درجه) in all 1,856 utterances.
 *   • ABBREVIATIONS: none. A dotted-abbreviation scan finds only ⟨د.⟩ and ⟨ک.⟩ ×1 each, and both are ordinary
 *     words ending in that letter followed by the sentence period — the same measurement trap Arabic recorded.
 *   • The lone ⟨+⟩ is "(1+ به‌وقت ساعت هماهنگ جهانی)" — UTC+1 with the sign stored after the digit by bidi, not a
 *     plus operator. One instance, and a sign rule would read it as "plus one".
 */
import type { NumbersDef } from "../../core/numbers.ts";
import { persianNumberWords } from "./numbers.ts";

/** Persian-Indic digits ۰-۹ (U+06F0-U+06F9) — Persian's own block, NOT the Arabic-Indic ٠-٩ (U+0660) that
 *  Arabic uses. Both are folded, since either can be typed on a Persian keyboard layout. */
const EASTERN_DIGIT = /[۰-۹٠-٩]/gu;
function foldDigit(c: string): string {
    const cp = c.codePointAt(0)!;
    if (cp >= 0x06f0 && cp <= 0x06f9) return String(cp - 0x06f0); // ۰-۹ Extended Arabic-Indic (Persian/Urdu)
    if (cp >= 0x0660 && cp <= 0x0669) return String(cp - 0x0660); // ٠-٩ Arabic-Indic
    return c;
}

/** A Persian word continues across a ZWNJ, so "not followed by a letter" must exclude ZWNJ as well. */
const NOT_WORD = "(?![\\p{L}\\p{M}\\u200C])";

/** Currency sign → its Persian word, each attested in fa_ir under a token test (see step 7b). `¥` is ین; the
 *  Japanese and Chinese currencies are not distinguished in the corpus's single yen instance. */
const CURRENCY: Readonly<Record<string, string>> = {
    "$": "دلار", "€": "یورو", "£": "پوند", "¥": "ین",
};
/** Harakat + the connective marker: stripped from any word this layer writes into the TEXT (see the header). */
const HARAKAT_OR_MARK = /[ً-ْٰ\u{E000}]/gu;
/** ⟨و⟩ /o/, the connective, as ordinary text — read by the word path exactly like the ubiquitous conjunction. */
const VA = "و";

/** Build the Persian normalizer. Takes the numbers table so the one place a number WORD is needed (the ordinal)
 *  is spelled by the same compositor the engine's digit path uses — one spelling of "sixteenth", not two. */
export function makePersianNormalizer(numbers: NumbersDef): (text: string) => string {
    /** Cardinal as plain running text: the compositor's words, connective marker → ⟨و⟩, harakat stripped. */
    const cardinalText = (n: number): string | undefined => {
        const parts = persianNumberWords(n, numbers);
        if (parts.some((w) => w === null || w === "")) return undefined;
        return parts
            .map((w) => (w!.endsWith("\u{E000}") ? `${w!.slice(0, -1)} ${VA}` : w!))
            .join(" ")
            .replace(HARAKAT_OR_MARK, "");
    };

    /**
     * Ordinal text. Persian derives it from the cardinal by suffixing the LAST word, with three well-established
     * adjustments, all of which the corpus's own five ordinals happen to avoid (16، 14، 11، 10، 1000 are all
     * regular) — they are here so the rule cannot emit a wrong word on input the corpus does not happen to show:
     *   • 1st is the suppletive اول (avval), not *یکم-as-a-standalone;
     *   • a final ⟨سه⟩ becomes ⟨سوم⟩ (3rd, 23rd …) — plain suffixation would give ⟨سهم⟩, a different word;
     *   • after a final ⟨ی⟩ the suffix is written ⟨ام⟩ behind a ZWNJ (30th = سی‌ام), the standard orthography.
     * Everything else is the bare ⟨م⟩: شانزده→شانزدهم, هزار→هزارم, بیست و یک→بیست و یکم.
     */
    const ordinalText = (n: number): string | undefined => {
        if (n === 1) return "اول";
        const w = cardinalText(n);
        if (w === undefined) return undefined;
        const parts = w.split(" ");
        const last = parts[parts.length - 1]!;
        parts[parts.length - 1] = last === "سه" ? "سوم" : last.endsWith("ی") ? `${last}‌ام` : `${last}م`;
        return parts.join(" ");
    };

    /** Hour ⟨و⟩ minutes دقیقه; at :00 the minutes drop entirely. `written` is the text's OWN دقیقه when it wrote
     *  one — reused rather than duplicated. At :00 it is handed back untouched instead of being swallowed with
     *  the minutes: that combination does not occur in the corpus, and this rule must not delete written words. */
    const clock = (_m: string, h: string, min: string, written?: string): string =>
        Number(min) === 0
            ? `${Number(h)}${written ?? ""}`
            : `${Number(h)} ${VA} ${Number(min)}${written ?? " دقیقه"}`;

    return (input: string): string => {
        let s = input;

        // 1) DIGIT FOLD, first: every rule below, the engine's TOKEN and the shared symbol tier are all written
        //    against ASCII digits. (Zero occurrences in this corpus; kept because Persian typing produces ۰-۹
        //    freely and the engine's own number path already folds them.)
        s = s.replace(EASTERN_DIGIT, foldDigit);

        // 2) ARABIC SYMBOL CHARACTERS → ASCII. Must precede de-grouping/decimals (3, 6) so a natively-typed ٫/٬
        //    is seen by them, and precede percent (7) — 2 of this corpus's 4 percentages are written with the
        //    Arabic ٪ U+066A, which is in no tier's pattern and vanished outright.
        s = s.replace(/٪/gu, "%").replace(/٫/gu, ".").replace(/٬/gu, ",");
        //    The ARABIC COMMA doubles as the THOUSANDS separator in Persian (19،500 — ×4 here). Between digits it
        //    is a grouping mark, not punctuation; left alone it was a clause break, so "19،500 کیلومتر" read as
        //    "nineteen … five hundred". ONLY the digit-flanked, exactly-3-digit-block case is folded — ⟨،⟩ as
        //    real punctuation (×1691, the corpus's commonest mark after the period) is untouched.
        s = s.replace(/(\d)،(\d{3})(?!\d)/gu, "$1,$2");

        // 3) DIGIT DE-GROUPING. FIRST among the numeric rules (the standing ordering coupling): a grouping comma
        //    or period is otherwise read as clause punctuation, which is exactly what happened —
        //    "1,000" → [ˈiːk , sˈefɾ] "one, zero"; "5,000,000" → [pˈand͡ʒ , sˈefɾ , sˈefɾ].
        //    Both separators are attested (comma ×19, period ×1: "104.500 بشکه" = 104,500 barrels). The period
        //    form requires whole 3-digit blocks, which is what keeps it off the genuine decimals ("3.50 متر") and
        //    off the "15.00 UTC" clock of step 5.
        s = s.replace(/(?<![\d.,])(\d{1,3})((?:,\d{3})+)(?![\d,])/gu,
            (_m, a: string, rest: string) => a + rest.replace(/,/gu, ""));
        s = s.replace(/(?<![\d.,])(\d{1,3})((?:\.\d{3})+)(?![\d.])/gu,
            (_m, a: string, rest: string) => a + rest.replace(/\./gu, ""));

        // 4) CLOCK. BEFORE any rule that reads a bare number (the standing "times before units" coupling): 11:30
        //    must not be claimed piecewise. The colon is a clause mark in persian.jsonc, so "11:00" read as
        //    [iːjzˈadh , sˈefɾ] — "eleven, zero", with a pause inside the time. Persian says the hour, ⟨و⟩, then
        //    the minutes plus دقیقه (6:30 → شش و سی دقیقه); at :00 the minutes are dropped entirely.
        //    NO ساعت is inserted: all 14 corpus clocks already carry one ("ساعت 11:00", "ساعت‌های 06:30 و 07:30"),
        //    and adding another is precisely the duplicate-الساعة bug the Arabic clock rule shipped with.
        //    Hour and minute are emitted as DIGITS, so the engine's own number path spells them (header).
        //    Lookarounds keep it off a longer digit run and off a comma-decimal sports time (2:11,60).
        //    AND the دقیقه is CONSUMED when the text already wrote one — 3 of the 14 corpus clocks do
        //    ("در ساعت 07:19 دقیقه صبح", "در 1:15 دقیقه بعدازظهر"), and appending a second is the same
        //    duplicate-unit bug as the Arabic clock's second الساعة, just one word further along.
        s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?![.,]\d)(\s*دقیقه)?/gu, clock);

        // 5) THE DOTTED 24-HOUR CLOCK, but ONLY when anchored by a following UTC. This corpus writes exactly one
        //    ("(15.00 UTC)"), and it is the single case where H.MM is a clock rather than a decimal. It must be
        //    settled BEFORE step 6, which would otherwise read it as "fifteen point zero zero". Anchored rather
        //    than general precisely because H.MM is decimal-shaped: nothing weaker may claim it.
        //    Two capture groups only, so `clock` is called explicitly — passing it directly would bind
        //    String.replace's OFFSET argument to the written-دقیقه parameter.
        s = s.replace(/(?<![\d.,])([01]?\d|2[0-3])\.([0-5]\d)(?=\s*UTC(?![A-Za-z]))/gu,
            (m: string, h: string, min: string) => clock(m, h, min));

        // 3b) UNIT ABBREVIATIONS AND THEIR POWERS (#586). The header above records that this corpus writes NO
        //     unit abbreviation, and that is still true — but `5 km` was reaching the g2p as the cluster [ˈʊkm]
        //     and `5 km²` lost the quantity outright, and a phonemizer is handed arbitrary text (the argument
        //     step 7b already makes for the currency signs this corpus also lacks). No word is invented: every
        //     one is this corpus's own spelled-out form, and this is the richest unit inventory in the sweep.
        //
        //       کیلومتر ×65  "این پارک 19،500 کیلومتر مربع مساحت دارد"    متر ×45   "ارتفاع 4892 متر"
        //       میلی‌متر ×10  "56 در 56 میلی‌متر نگاتیو"                    کیلوگرم ×4 "200 پوند (90 کیلوگرم)"
        //       سانتی‌متر ×3  "6 در 6 سانتی‌متر"
        //       مربع ×32 / کیلومتر مربع ×16   ← squared, POSTPOSED
        //       مکعب  ×3 / متر مکعب      ×3   ← cubed,   POSTPOSED  "120-160 متر مکعب سوخت داشت"
        //
        //     ⚠ LATIN KEYS ONLY, never the Perso-Arabic ones, and this language is the reason that distinction
        //     exists: the ckb pass measured `کم` and `سم` as unit abbreviations there, and the SAME graphemes
        //     here are ordinary words — `کم` ×63, never once after a numeral, is the adjective "little/few"
        //     ("اصطکاک کم است"), and `سم` ×5 is "poison". A shared Perso-Arabic table would read 68 ordinary
        //     Persian words as measurements. The Latin run after a digit here is `4x`, `5N`, `UTC` — no bare `m`.
        //     PLACED BEFORE THE DECIMAL RULE (6) AND AFTER DE-GROUPING (3), and both halves of that are
        //     forced. Step 6 rewrites the dot as the word ممیز, so a rule sitting after it sees
        //     `802 ممیز 1 1 m` and the `NOT_VERSION` guard has no dot left to reject — `802.11m` read as
        //     metres. And before de-grouping, `19،500 km` would match only its last three digits.
        //     THE EXPONENT ARM MUST PRECEDE THE PLAIN ONE, or the plain rule eats the unit and strands the `²`.
        const FA_UNIT: Readonly<Record<string, string>> = {
            km: "کیلومتر", cm: "سانتی‌متر", mm: "میلی‌متر", kg: "کیلوگرم", m: "متر",
        };
        const faUnits = Object.keys(FA_UNIT).sort((a, b) => b.length - a.length).join("|");
        //     A DOTTED DESIGNATION IS NOT A QUANTITY: `802.11m` read as "802.11 metres". This is
        //     `NOT_VERSION` from core/normalizeSymbols.ts, and it has to guard on the WHOLE number rather
        //     than the adjacent digit — a lookbehind for "digit after a dot" would also reject this corpus's
        //     real `12.8 کم`. What separates them is the SPACE: a version glues its letter to the digits.
        const FA_NUM = "(?<![\\d.,])(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))(\\d[\\d.,]*)";
        s = s.replace(new RegExp(`${FA_NUM}\\s?(${faUnits})(?:\\s?([²³])|([23])(?![\\d\\p{L}]))`, "giu"),
            (_m, n: string, u: string, sup: string | undefined, ascii: string | undefined) =>
                `${n} ${FA_UNIT[u.toLowerCase()]!} ${(sup ?? ascii) === "³" || (sup ?? ascii) === "3" ? "مکعب" : "مربع"}`);
        //     RATES FIRST of the two arms, or the plain one consumes the numerator and strands the slash —
        //     which is what left `120 km/h` reading the denominator as the ENGLISH LETTER NAME [ˈeᶦt͡ʃ] and
        //     `133 m/s` as [ˈɛs]. The construction is the corpus's own, spelled out in its rate sentence:
        //     "480 کیلومتر بر ساعت (133 متر بر ثانیه؛ 300 مایل بر ساعت)" — `بر` is "per", `ساعت` the hour,
        //     `ثانیه` the second.
        const FA_PER: Readonly<Record<string, string>> = { h: "ساعت", s: "ثانیه" };
        s = s.replace(new RegExp(`${FA_NUM}\\s?(${faUnits})\\s?/\\s?([hs])(?![\\p{L}\\p{M}\\d])`, "giu"),
            (_m, n: string, u: string, d: string) =>
                `${n} ${FA_UNIT[u.toLowerCase()]!} بر ${FA_PER[d.toLowerCase()]!}`);
        s = s.replace(new RegExp(`${FA_NUM}\\s?(${faUnits})(?![\\p{L}\\p{M}\\d])`, "giu"),
            (_m, n: string, u: string) => `${n} ${FA_UNIT[u.toLowerCase()]!}`);

        // 6) DECIMALS. AFTER de-grouping (3) and after both clock rules (4, 5), each of which would otherwise be
        //    mis-claimed by a decimal-shaped pattern. The period was a full CLAUSE BREAK: "1.5 میلیون" read as
        //    [ˈiːk . pˈand͡ʒ …] — a sentence boundary inside a number. Persian reads the separator as ممیز and the
        //    fractional part DIGIT BY DIGIT (6.34 → شش ممیز سه چهار), so the fraction is split into single digits
        //    here rather than handed to the number path as the integer 34.
        const decimalWord = (numbers as { decimalWord?: string }).decimalWord;
        if (decimalWord !== undefined)
            s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d.,])/gu,
                (_m, int: string, frac: string) => `${int} ${decimalWord} ${[...frac].join(" ")}`);

        // 7) PERCENT. AFTER the digit fold (1) and the ٪→% fold (2). Persian writes the word AFTER the number
        //    (هشتاد درصد) — the same side as the sign — and the corpus supplies the word itself: درصد occurs
        //    spelled out ×16 alongside the 4 signed forms, so this is read off the data, not invented. The sign
        //    is in no group of the engine's TOKEN, so all four percentages were silently DELETED: "80% از درآمد"
        //    read as a bare [hʃatˈaːd]. Done here rather than through the shared symbol tier because Persian's
        //    only datum for that tier is this one word and it has no count agreement to select — and because the
        //    tier's percent pattern is ASCII-`%`-only anyway (see the core note in the commit message).
        s = s.replace(new RegExp(`(\\d)\\s?%${NOT_WORD}`, "gu"), `$1 درصد`);

        // 7b) CURRENCY (#584). `$5` read as bare [pˈand͡ʒ] — the sign is in no group of the engine's TOKEN, so
        //     it was DELETED exactly as the percent signs were, and a dropped sign is worse than a wrong word
        //     because nothing in the output marks the loss. fa_ir contains ZERO `$` against 18 `%`, so the
        //     corpus-driven gate that caught the percent could not reach this one — but the WORDS are in that
        //     same corpus, spelled out and against a numeral, which is the slot this rule emits into:
        //
        //       دلار ×18  "میلیاردها دلار آمریکا"        پوند ×16  "پوند فالکلند (FKP)"
        //       ین   ×4   "بین 2500 تا 130،000 ین"       یورو ×3   "10 میلیارد یورو (14.7 میلیارد دلار"
        //
        //     TOKEN-matched, and that mattered: a substring count for ین returns 7790 because it is inside این
        //     ("this") and همین — the same trap that made hu's font read 211 for a word occurring 10 times.
        //
        //     Done HERE rather than through the shared symbol tier, for the reason step 7 gives for percent:
        //     Persian has no count agreement for the selector to choose from, and the tier's currency guard is
        //     letter-bounded on both sides, which an RTL script with no space between sign and numeral would
        //     fight. The sign PRECEDES the number in logical order and the word FOLLOWS it, so unlike percent
        //     this rule moves the reading across the numeral.
        s = s.replace(new RegExp(`([$€£¥])\\s?(\\d[\\d.,]*)`, "gu"),
            (_m, sign: string, num: string) => `${num} ${CURRENCY[sign]!}`);

        // 7b) THE PLUS → به اضافه, SOURCED FROM THE CORPUS'S OWN AUDIO — and this is the one language in the
        //     batch where the speakers disagreed on the WORD rather than on whether to say it.
        //     The corpus writes the offset RTL as `(1+ به‌وقت ساعت هماهنگ جهانی)` and the sign was DROPPED.
        //     No text tier could supply the word: `به اضافه` and `به علاوه` are both ×0 in the corpus AND ×0 in
        //     the wiki; the only wiki hit for any candidate is `بعلاوه`, and its example is the DISCOURSE
        //     connective — "بعلاوه، این تعریف …" ("moreover, this definition …") — which is trap 37, not the
        //     operator. `مثبت` ×17 is the adjective "positive", also not the operator.
        //
        //     Decoded with facebook/wav2vec2-xlsr-53-espeak-cv-ft (a PHONEME recognizer: 392 tokens, no `+`, no
        //     digits), all three fa_ir speakers of the sentence:
        //       `… b eː z ɑ f eː  j e k …`        →  به اضافه یک   (be ezāfe yek)
        //       `… b ɛ a l ɑ v e j e  j e k …`    →  به علاوهٔ یک   (be alāve-ye yek)
        //       `… m a h a l l iː  j e k  s ɑ a t …`  →  no plus word at all
        //     ⚠ WHETHER THOSE ARE REALLY TWO WORDS WAS CHALLENGED, AND THE CHALLENGE WAS RIGHT TO MAKE. The two
        //     candidates are the same syllable shape — be + V-CVː-CV — differing in exactly two segments, and
        //     /f/~/v/ differ only in voicing while /z/~/l/ are both voiced continuants. At this decode quality
        //     that is close to a minimal pair, so "two forms" could equally have been one word decoded twice
        //     with noise. A phone string alone could not settle it.
        //     ⚠ SETTLED BY A SECOND MODALITY. MMS-1b-all (`fas` adapter) transcribes to Persian SCRIPT, and the
        //     consonant identity is the tell — اضافه carries ض, علاوه carries ع:
        //       speaker 1  `… به وقت محلی  به اضف۱  به وقت ساعت …`   ← ض  → به اضافه
        //       speaker 3  `… به وقت محلی  بعه۱     به وقت ساعت …`   ← ع  → بعلاوه / به علاوه
        //       speaker 2  `… به وقت محلی  ۱ ساعت   به وقت ساعت …`   ← no plus word, as the phones showed
        //     Both are truncated, but they pick DIFFERENT letters for the two speakers, matching the split the
        //     phoneme model showed. Note this is the exact INVERSE of the tier's usual caution: a text ASR is
        //     the wrong tool for "is there a sign here" because it emits the glyph, and the right tool for
        //     "which word is this" because it emits orthography.
        //     ⚠ TWO ATTESTED FORMS, ONE SPEAKER EACH, so the choice between them is STATED, not measured. Both
        //     are ordinary Persian and both read correctly here (bˈe ʔazaːfˈe / bˈe ʔalaːvˈe). `به اضافه` is
        //     preferred because its noun اضافه is specifically ADDITION, whereas علاوه doubles as the discourse
        //     "moreover" — the very sense the wiki's only hit shows. If that argument is ever judged too thin,
        //     swap the string; the evidence supports either equally.
        //     The sign PRECEDES the numeral in logical order, so this moves the word across it, exactly as the
        //     currency rule above does and for the same RTL reason.
        //     ⚠ TWO ARMS, BECAUSE THIS CORPUS STORES THE OFFSET AS `1+` IN LOGICAL ORDER — the sign AFTER the
        //     digit, which is what the bidi reordering of a `+1` leaves behind. A single arm that replaced the
        //     sign in place produced *یک به اضافه* ("one plus"), the operand and operator inverted, when all
        //     three speakers say *به اضافه یک*. So the digit-first arm MOVES the word across the numeral, the
        //     same correction fa's currency rule above documents for the same RTL reason.
        //     The digit-first arm requires NO digit after the sign, so an ordinary arithmetic `5+3` is left to
        //     the second arm and does not become *به اضافه ۵ ۳*.
        // 7e) THE MULTIPLICATION SIGN → ضربدر, and ASCII `x` alongside it. Persian had NO reading for the sign:
        //     `6 × 6` read as *ʃˈeʃ ʃˈeʃ*, two numbers with the relation gone, and `6x6` read the `x` as the
        //     English LETTER NAME. `NxN` outnumbers `×` roughly 85 to 20 across the corpora, so the ASCII form is
        //     the one that matters. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus attestation — fa's artifact
        //     has no instance, and the sweep's plausible hits elsewhere were homographs of prepositions.
        //     Digit-bounded on both sides so the `x` cannot claim a letter.
        s = s.replace(/(?<=[\d\u06f0-\u06f9])\s?(?:×|x)\s?(?=[\d\u06f0-\u06f9])/gu, " ضربدر ");
        s = s.replace(/(\d[\d.,]*)\s?\+(?!\s?\d)/gu, "به اضافه $1");
        s = s.replace(/\+\s?(?=\d)/gu, " به اضافه ");

        // 7d) THE AMPERSAND → اند, AND IT IS THE ENGLISH WORD ON PURPOSE. The corpus's `که B&B ها به عمدتا`
        //     dropped the sign: *kˈe bˈiː bˈiː hˈaː*, the two initialisms adjacent with nothing between.
        //     Absent from the text by construction, so audio again — and here BOTH fa_ir speakers of the
        //     sentence agree, which is the cleanest attestation in this batch.
        //       wav2vec2-xlsr-53-espeak-cv-ft, speaker A:  `h ɑ b eː  b iː a n b iː  d a r p ɑ j ɑ n …`
        //                                       speaker B:  `x ɑ b e  b i a n d b iː  d a r p ɑ j ɑ n …`
        //     `b iː a n (d) b iː` is *bī and bī*. Speaker B's /d/ is explicit; A's is elided before the /b/,
        //     which is ordinary connected speech and not a competing form.
        //     ⚠ MMS ALONE WOULD HAVE READ AS A DROP. Its `fas` transcript of speaker A omits the span entirely
        //     and of speaker B renders it `هاب بینبی` — floated to the head of the sentence and looking like a
        //     false start. The phones show it is neither. Two instruments, and the phone recogniser is the one
        //     that answers this question, as fa's own plus rule above records.
        //
        //     WHY NOT `و`, the Persian conjunction. Because that is not what is said. `B&B` is an English term
        //     carried whole into Persian, and both readers carry its conjunction with it — the same
        //     per-language split the fleet already shows for this glyph, where yue reads native `和`, th native
        //     `และ`, uk native `та`, and ja borrows `アンド`. Attestation per language, not a fleet default.
        //     Renderable, unlike mi's plus: /a/, /n/ and /d/ are all ordinary Persian, so اند reads as "and"
        //     with no invented phonology.
        //     Spaced on both sides because the neighbours are initialisms — joining them would make one token.
        s = s.replace(/&/gu, " اند ");

        // 8) ORDINALS. Persian writes the ordinal as the numeral plus ـم/ـام (قرن 16ام "the 16th century" — ×5
        //    here, one of them across a ZWNJ: ⟨1000‌ام⟩). The suffix was tokenized apart and spoken as its own
        //    word [ʔˈam]; fused onto the cardinal's last word it is the ordinary ordinal (شانزدهم, هزارم). LAST,
        //    after every numeric rule, so a decimal or a clock can never be re-read as an ordinal.
        //    This is the one rule that emits number WORDS rather than digits, because the suffix has to attach to
        //    the final word; they are written undiacritized, so the short /o/ of ـُم is left to the same
        //    restoration layer that supplies every other short vowel in Persian text (the deferred gap 🟠).
        //    Only the attested ⟨ام⟩ spelling is matched. A bare ⟨م⟩ suffix is also legal Persian but does not occur
        //    here, and matching it would let the rule reach into ordinary digit+word sequences (trap 2).
        s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\u200C?ام${NOT_WORD}`, "gu"),
            (whole, digits: string) => {
                const n = Number(digits);
                if (!Number.isSafeInteger(n)) return whole;
                return ordinalText(n) ?? whole;
            });

        return s;
    };
}
