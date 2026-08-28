/**
 * Persian / Farsi (fa) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ IT SITS ABOVE THE NEURAL MACHINERY (the structural tagger / vowel restorer), which constrains what it may
 * emit: the tagger's source alphabet is 42 symbols of BARE Perso-Arabic — no harakat at all — so every
 * short-vowel diacritic emitted here would reach the model as <unk>. This file therefore emits only (a) plain
 * undiacritized Persian words and (b) ASCII digits. Where a number word is wanted it is left as DIGITS and handed
 * back to the engine's own number path, which uses the diacritized manifest table — the diacritics stay on the far
 * side of the tokenizer.
 *
 * ⚠ BOUNDARIES ARE EXPLICIT LOOKAROUNDS, NEVER `\b` — the ASCII definition of `\b` matches nothing against
 * Perso-Arabic script.
 *
 * ⚠ ZWNJ (U+200C) is a WORD-INTERNAL joiner in Persian (می‌رود, بچه‌ها). No rule here may split a word at one, so
 * every "not a letter" guard also excludes ZWNJ. The ordinal rule is the one place a ZWNJ is consumed, and only
 * between a digit run and the ordinal suffix (⟨1000‌ام⟩), which is not a word-internal position.
 *
 * ⚠ A SIGN PRECEDES THE NUMERAL IN LOGICAL ORDER but its word follows it, so the currency and plus rules MOVE
 * their word across the numeral rather than substituting in place. A rule that substitutes in place emits the
 * operand and operator inverted.
 *
 * Deliberately absent:
 *   · RANGES on the hyphen. Genuinely ambiguous rather than merely unhandled: some are ranges, some are SPORTS
 *     SCORES (Persian reads those with بر, not تا), and some are stored in BIDI-REVERSED logical order
 *     (⟨1539- 1469⟩ for the displayed 1469-1539), so a تا inserted by position would say "1539 to 1469". Nothing
 *     in the text separates the cases, and both numbers already reach the output as separate words.
 *   · FRACTIONS on the slash — the slash is overwhelmingly a word separator here (و/یا "and/or").
 *   · DOTTED ABBREVIATIONS — a dotted-abbreviation scan finds only ordinary words ending in that letter followed
 *     by the sentence period.
 */
import type { NumbersDef } from "../../core/numbers.ts";
import { persianNumberWords } from "./numbers.ts";
import { tr } from "../../core/provenance.ts";

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

/** Currency sign → its Persian word. `¥` is ین; the Japanese and Chinese currencies are not distinguished. */
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
     * Ordinal text. Persian derives it from the cardinal by suffixing the LAST word, with three irregularities:
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
        parts[parts.length - 1] = last === "سه" ? "سوم" : last.endsWith("ی") ? `${last}‌ام` : `${last}م`;  // ZWNJ
        return parts.join(" ");
    };

    /** Hour ⟨و⟩ minutes دقیقه; at :00 the minutes drop entirely. `written` is the text's OWN دقیقه when it wrote
     *  one — reused rather than duplicated. ⚠ At :00 it is handed back untouched instead of being swallowed with
     *  the minutes: this rule must not delete words the text already wrote. */
    const clock = (_m: string, h: string, min: string, written?: string): string =>
        Number(min) === 0
            ? `${Number(h)}${written ?? ""}`
            : `${Number(h)} ${VA} ${Number(min)}${written ?? " دقیقه"}`;

    return (input: string): string => {
        let s = input;

        // 1) DIGIT FOLD, first: every rule below, the engine's TOKEN and the shared symbol tier are all written
        //    against ASCII digits.
        s = tr(s, EASTERN_DIGIT, foldDigit);

        // 2) ARABIC SYMBOL CHARACTERS → ASCII. Must precede de-grouping/decimals (3, 6) so a natively-typed ٫/٬
        //    is seen by them, and precede percent (7) — a percentage written with the Arabic ٪ U+066A is in no
        //    tier's pattern and vanishes outright.
        s = tr(s, /٪/gu, "%").replace(/٫/gu, ".").replace(/٬/gu, ",");
        //    ⚠ THE ARABIC COMMA DOUBLES AS THE THOUSANDS SEPARATOR in Persian (19،500). Between digits it is a
        //    grouping mark, not punctuation; left alone it is a clause break, so "19،500 کیلومتر" reads as
        //    "nineteen … five hundred". ONLY the digit-flanked, exactly-3-digit-block case is folded — ⟨،⟩ as real
        //    punctuation is by far the commonest mark in Persian text and must stay untouched.
        s = tr(s, /(?<=\d)(?<!(?<![\d\.,])0)،(?=\d{3}(?!\d))/gu, ",");

        // 3) DIGIT DE-GROUPING. FIRST among the numeric rules: a grouping comma or period is otherwise read as
        //    clause punctuation — "1,000" → [ˈiːk , sˈefɾ] "one, zero".
        //    Both separators occur. The period form requires whole 3-digit blocks, which is what keeps it off
        //    genuine decimals ("3.50 متر") and off the "15.00 UTC" clock of step 5.
        s = tr(s, /(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d,])/gu,
            (_m, a: string, rest: string) => a + rest.replace(/,/gu, ""));
        s = tr(s, /(?<![\d.,])([1-9]\d{0,2})((?:\.\d{3})+)(?![\d.])/gu,
            (_m, a: string, rest: string) => a + rest.replace(/\./gu, ""));

        // 4) CLOCK. BEFORE any rule that reads a bare number, so 11:30 is not claimed piecewise. The colon is a
        //    clause mark in persian.jsonc, so "11:00" read as [iːjzˈadh , sˈefɾ] — a pause inside the time.
        //    Persian says the hour, ⟨و⟩, then the minutes plus دقیقه; at :00 the minutes are dropped entirely.
        //    ⚠ NO ساعت IS INSERTED — a clock is already introduced by one, and adding another is the duplicate
        //    -الساعة bug the Arabic clock rule shipped with. For the same reason the دقیقه is CONSUMED when the
        //    text already wrote one ("در ساعت 07:19 دقیقه صبح").
        //    Hour and minute are emitted as DIGITS, so the engine's own number path spells them (header).
        //    Lookarounds keep it off a longer digit run and off a comma-decimal sports time (2:11,60).
        s = tr(s, /(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?![.,]\d)(\s*دقیقه)?/gu, clock);

        // 5) THE DOTTED 24-HOUR CLOCK, but ONLY when anchored by a following UTC — H.MM is decimal-shaped, so
        //    nothing weaker may claim it. Must be settled BEFORE step 6, which would otherwise read it as
        //    "fifteen point zero zero".
        //    ⚠ Two capture groups only, so `clock` is called explicitly — passing it directly would bind
        //    String.replace's OFFSET argument to the written-دقیقه parameter.
        s = tr(s, /(?<![\d.,])([01]?\d|2[0-3])\.([0-5]\d)(?=\s*UTC(?![A-Za-z]))/gu,
            (m: string, h: string, min: string) => clock(m, h, min));

        // 5b) UNIT ABBREVIATIONS AND THEIR POWERS. Persian spells its units out, but a phonemizer is handed
        //     arbitrary text, and `5 km` reached the g2p as the cluster [ˈʊkm] while `5 km²` lost the quantity
        //     outright. No word is invented — every one is Persian's own spelled-out form.
        //     ⚠ LATIN KEYS ONLY, never the Perso-Arabic ones, and Persian is the reason that distinction exists:
        //     ckb measures `کم` and `سم` as unit abbreviations, and the SAME graphemes here are ordinary words —
        //     `کم` is the adjective "little/few", `سم` is "poison". A shared Perso-Arabic table would read dozens
        //     of ordinary Persian words as measurements.
        //     PLACED BEFORE THE DECIMAL RULE (6) AND AFTER DE-GROUPING (3), and both halves are forced. Step 6
        //     rewrites the dot as the word ممیز, so a rule after it sees `802 ممیز 1 1 m` and the `NOT_VERSION`
        //     guard has no dot left to reject — `802.11m` would read as metres. And before de-grouping,
        //     `19،500 km` would match only its last three digits.
        //     ⚠ THE EXPONENT ARM MUST PRECEDE THE PLAIN ONE, or the plain rule eats the unit and strands the `²`.
        const FA_UNIT: Readonly<Record<string, string>> = {
            km: "کیلومتر", cm: "سانتی‌متر", mm: "میلی‌متر", kg: "کیلوگرم", m: "متر",  // ZWNJ
        };
        const faUnits = Object.keys(FA_UNIT).sort((a, b) => b.length - a.length).join("|");
        //     ⚠ A DOTTED DESIGNATION IS NOT A QUANTITY: `802.11m` read as "802.11 metres". This is `NOT_VERSION`
        //     from core/normalizeSymbols.ts, and it has to guard on the WHOLE number rather than the adjacent
        //     digit — a lookbehind for "digit after a dot" would also reject a real `12.8 کم`. What separates
        //     them is the SPACE: a version glues its letter to the digits.
        const FA_NUM = "(?<![\\d.,])(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))(\\d[\\d.,]*)";
        s = tr(s, new RegExp(`${FA_NUM}\\s?(${faUnits})(?:\\s?([²³])|([23])(?![\\d\\p{L}]))`, "giu"),
            (_m, n: string, u: string, sup: string | undefined, ascii: string | undefined) =>
                `${n} ${FA_UNIT[u.toLowerCase()]!} ${(sup ?? ascii) === "³" || (sup ?? ascii) === "3" ? "مکعب" : "مربع"}`);
        //     RATES FIRST of the two arms, or the plain one consumes the numerator and strands the slash — which
        //     leaves `120 km/h` reading the denominator as the ENGLISH LETTER NAME [ˈeᶦt͡ʃ] and `133 m/s` as [ˈɛs].
        //     `بر` is "per", `ساعت` the hour, `ثانیه` the second.
        const FA_PER: Readonly<Record<string, string>> = { h: "ساعت", s: "ثانیه" };
        s = tr(s, new RegExp(`${FA_NUM}\\s?(${faUnits})\\s?/\\s?([hs])(?![\\p{L}\\p{M}\\d])`, "giu"),
            (_m, n: string, u: string, d: string) =>
                `${n} ${FA_UNIT[u.toLowerCase()]!} بر ${FA_PER[d.toLowerCase()]!}`);
        s = tr(s, new RegExp(`${FA_NUM}\\s?(${faUnits})(?![\\p{L}\\p{M}\\d])`, "giu"),
            (_m, n: string, u: string) => `${n} ${FA_UNIT[u.toLowerCase()]!}`);

        // 6) DECIMALS. AFTER de-grouping (3) and after both clock rules (4, 5), each of which would otherwise be
        //    mis-claimed by a decimal-shaped pattern. The period was a full CLAUSE BREAK: "1.5 میلیون" read as
        //    [ˈiːk . pˈand͡ʒ …] — a sentence boundary inside a number. Persian reads the separator as ممیز and the
        //    fractional part DIGIT BY DIGIT (6.34 → شش ممیز سه چهار), so the fraction is split into single digits
        //    here rather than handed to the number path as the integer 34.
        const decimalWord = (numbers as { decimalWord?: string }).decimalWord;
        if (decimalWord !== undefined)
            s = tr(s, /(?<![\d.,])(\d+)\.(\d+)(?![\d.,])/gu,
                (_m, int: string, frac: string) => `${int} ${decimalWord} ${[...frac].join(" ")}`);

        // 7) PERCENT. AFTER the digit fold (1) and the ٪→% fold (2). Persian writes the word AFTER the number —
        //    the same side as the sign — so nothing is reordered. The sign is in no group of the engine's TOKEN,
        //    so an unhandled percentage is silently DELETED: "80% از درآمد" read as a bare [hʃatˈaːd]. Done here
        //    rather than through the shared symbol tier because Persian has no count agreement for it to select,
        //    and the tier's percent pattern is ASCII-`%`-only anyway.
        s = tr(s, new RegExp(`(\\d)\\s?%${NOT_WORD}`, "gu"), `$1 درصد`);

        // 7b) CURRENCY. `$5` read as bare [pˈand͡ʒ] — the sign is in no group of the engine's TOKEN, so it was
        //     DELETED exactly as the percent signs were, and a dropped sign is worse than a wrong word because
        //     nothing in the output marks the loss.
        //     Done HERE rather than through the shared symbol tier for the reason step 7 gives: no count
        //     agreement, and the tier's currency guard is letter-bounded on both sides, which an RTL script with
        //     no space between sign and numeral would fight. ⚠ Unlike percent, this rule moves the word ACROSS
        //     the numeral — the sign precedes it in logical order, the word follows it.
        s = tr(s, new RegExp(`([$€£¥])\\s?(\\d[\\d.,]*)`, "gu"),
            (_m, sign: string, num: string) => `${num} ${CURRENCY[sign]!}`);

        // 7c) THE PLUS → به اضافه. Its noun اضافه is specifically ADDITION, where the near-synonym علاوه doubles
        //     as the discourse connective "moreover"; both are ordinary Persian and both read correctly here.
        //     ⚠ TWO ARMS, BECAUSE THE OFFSET IS STORED AS `1+` IN LOGICAL ORDER — the sign AFTER the digit, which
        //     is what the bidi reordering of a displayed `+1` leaves behind. A single arm replacing the sign in
        //     place produces *یک به اضافه* ("one plus"), operand and operator inverted. So the digit-first arm
        //     MOVES the word across the numeral, as the currency rule above does and for the same RTL reason.
        //     The digit-first arm requires NO digit after the sign, so an ordinary arithmetic `5+3` falls to the
        //     second arm and does not become *به اضافه ۵ ۳*.
        // 7e) THE MULTIPLICATION SIGN → ضربدر, and ASCII `x` alongside it. `6 × 6` read as *ʃˈeʃ ʃˈeʃ*, two
        //     numbers with the relation gone, and `6x6` read the `x` as the English LETTER NAME. `NxN` outnumbers
        //     `×` by roughly four to one, so the ASCII form is the one that matters. Digit-bounded on both sides
        //     so the `x` cannot claim a letter.
        s = tr(s, /(?<=[\d\u06f0-\u06f9])\s?(?:×|x)\s?(?=[\d\u06f0-\u06f9])/gu, " ضربدر ");
        s = tr(s, /(\d[\d.,]*)\s?\+(?!\s?\d)/gu, "به اضافه $1");
        s = tr(s, /\+\s?(?=\d)/gu, " به اضافه ");

        // 7c0) THE DEGREE SIGN. Persian spells its units out, so no abbreviation table was needed and `°` fell
        //      through with them: `20 °C` read *bist si* — the sign dropped and the C spoken as an English letter
        //      name. Persian puts the unit AFTER the number, so unlike Korean's 섭씨 this rule reorders nothing
        //      and cannot strand a sign to its left.
        s = tr(s, /(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 درجه سانتی‌گراد");  // ZWNJ
        s = tr(s, /(\d)\s?°\s?F(?![\p{L}\p{M}])/gui, "$1 درجه فارنهایت");
        s = tr(s, /(\d)\s?°/gu, "$1 درجه");

        // 7c1) THE MINUS AND ±, both dropped before, so `-5 °C` read as five degrees above zero.
        //      ⚠ PERSIAN SPLITS THE SIGN FROM THE OPERATION, as ko and vi do: منفی is the NEGATIVE sign while
        //      به اضافه / منها are the operators, and the plus rule above already uses the operator form. A sign
        //      directly before a digit is the negative-quantity case, so it takes منفی. ± pairs the two SIGN
        //      names, conjoined.
        s = tr(s, /±/gu, " مثبت و منفی ");
        //      ⚠ THE RANGE GUARD. Rejecting a sign with a space AFTER it catches a score like `26 - 00` but
        //      misses a range spaced only BEFORE the sign, which then reads as a subtraction. A digit anywhere to
        //      the left rejects the match: a negative quantity does not follow a number, a range does.
        s = tr(s, /(^|[\s(])[-−–](?=\d)/gu, (m0: string, pre: string, off: number, whole: string) =>
            /\d\s*$/u.test(whole.slice(0, off)) ? m0 : `${pre}منفی `);

        // 7c2) RELATIONAL AND DIVISION SIGNS.
        //      ⚠ THE COPULA IS FINAL, WHICH SPLITS THE FOUR SIGNS INTO TWO RULE SHAPES. Persian is SOV, so a
        //      comparative reading ends in است: `A < B` is «A کوچکتر از B است», with the verb after both
        //      operands — those two rules therefore CONSUME both operands, as in ja/ko/tr. The equality is
        //      genuinely infix, because برابر است با carries its copula in the MIDDLE ("is equal with"), so it
        //      substitutes between the operands like any European rule. Same for تقسیم بر.
        s = tr(s, /(\d+)\s?<\s?(\d+)/gu, "$1 کوچکتر از $2 است");
        s = tr(s, /(\d+)\s?>\s?(\d+)/gu, "$1 بزرگتر از $2 است");
        s = tr(s, /\s?=\s?/gu, " برابر است با ");
        s = tr(s, /\s?÷\s?/gu, " تقسیم بر ");

        // 7d) THE AMPERSAND → اند, AND IT IS THE ENGLISH WORD ON PURPOSE. `B&B` is an English term carried whole
        //     into Persian, and readers carry its conjunction with it rather than substituting Persian's own `و`
        //     — the same per-language split the fleet shows for this glyph, where yue reads native `和`, th
        //     native `และ`, uk native `та`, and ja borrows `アンド`.
        //     Renderable with no invented phonology: /a/, /n/ and /d/ are all ordinary Persian.
        //     Spaced on both sides because the neighbours are initialisms — joining them would make one token.
        s = tr(s, /&/gu, " اند ");

        // 8) ORDINALS. Persian writes the ordinal as the numeral plus ـم/ـام (قرن 16ام "the 16th century",
        //    sometimes across a ZWNJ: ⟨1000‌ام⟩). The suffix was tokenized apart and spoken as its own word
        //    [ʔˈam]; fused onto the cardinal's last word it is the ordinary ordinal (شانزدهم, هزارم). LAST, after
        //    every numeric rule, so a decimal or a clock can never be re-read as an ordinal.
        //    This is the one rule that emits number WORDS rather than digits, because the suffix has to attach to
        //    the final word; they are written undiacritized, so the short /o/ of ـُم is left to the same
        //    restoration layer that supplies every other short vowel in Persian text.
        //    ⚠ Only the ⟨ام⟩ spelling is matched. A bare ⟨م⟩ suffix is also legal Persian, but matching it would
        //    let the rule reach into ordinary digit+word sequences.
        s = tr(s, new RegExp(`(?<![\\d.,])(\\d+)\\u200C?ام${NOT_WORD}`, "gu"),  // ZWNJ
            (whole, digits: string) => {
                const n = Number(digits);
                if (!Number.isSafeInteger(n)) return whole;
                return ordinalText(n) ?? whole;
            });

        return s;
    };
}
