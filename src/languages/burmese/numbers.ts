/**
 * Burmese (my) cardinal number → words.
 *
 * Burmese has a DISTINCT word for every power of ten from 10¹ to 10⁷ — ဆယ် 10, ရာ 100, ထောင် 1000,
 * သောင်း 10⁴, သိန်း 10⁵, သန်း 10⁶, ကုဋေ 10⁷ — so a number is read place by place as
 * `multiplier + place`, with no myriad grouping below 10⁷. Above 10⁷ the places repeat in increments of
 * 10⁷, which this composes recursively (10⁹ = တစ်ရာ ကုဋေ, "a hundred crore").
 *
 * Two rules the sources state explicitly, both implemented:
 *  1. A place word takes its CREAKY form when a nonzero remainder follows it, and its plain form when the
 *     number ends there: ဆယ် → ဆယ့်, ရာ → ရာ့, ထောင် → ထောင့်. Wikipedia: "shift from ဆယ် (low tone) to
 *     ဆယ့် (creaky tone), except in numbers divisible by ten", and the same for ထောင်/ထောင့် at 1000.
 *  2. The multiplier တစ် (one) IS spoken before ရာ and above (တစ်ရာ = 100, တစ်ထောင် = 1000) but is
 *     omitted at ဆယ်: "Ten to nineteen are almost always expressed without including တစ် (one)", so
 *     10 is ဆယ် and 11 is ဆယ့်တစ်, not *တစ်ဆယ့်တစ်.
 *
 * Sources: Wikipedia "Burmese numerals" (the place inventory, the increment rule, and both quoted tone
 * rules); Omniglot "Numbers in Burmese" (the 0–10 and tens lists, cross-checked). Every numeral word was
 * verified to phonemize through this engine standalone before being used here.
 *
 * VOICING — corrected note. An earlier version of this header called the voiceless place word an engine
 * gap, on the strength of Omniglot romanizing 90 ကိုးဆယ် as "koe-zeh". The gold contradicts that: wikipron
 * and kaikki both give 30 သုံးဆယ် as [θóʊɴsʰɛ̀], VOICELESS, after an open syllable where any systematic
 * rule would voice it — while 10 တစ်ဆယ် is [təzɛ̀], voiced. Burmese compound voicing is genuinely lexical,
 * not derivable, and the common numeral compounds are already covered by dictionary.tsv (တစ်ဆယ်, တစ်ရာ,
 * နှစ်ရာ …), so composed numerals match the gold as they stand. A systematic rule was implemented and
 * measured against the referee: every variant LOST ground (95.7% → 91.7% minor-syllable-only, → 81.2%
 * intervocalic-only, → 79.0% both), so it was reverted. See the my investigation doc.
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface BurmeseNumbers {
    zero: string;
    units: string[]; // index 1–9 (index 0 unused; zero is its own word)
    /** Place words 10¹…10⁷, each as [plain, creaky] — creaky when a remainder follows. */
    places: Array<[string, string]>;
    one: string; // တစ် — the multiplier for 1, spoken at ရာ and above but not at ဆယ်
}
const N = loadManifest<{ numbers: BurmeseNumbers }>(import.meta.url, "burmese.jsonc").numbers;

const CRORE = 10_000_000; // 10⁷ ကုဋေ — the place at which the series repeats

/**
 * Non-negative integer → the Burmese numeral as ONE orthographic word (no spaces). Burmese writes
 * numerals solid — တစ်ရာ, တစ်ထောင့်တစ်ရာ့ဆယ့်တစ် — and joining them here rather than emitting separate
 * tokens is what lets the engine segmenter and compound voicing apply across the joins: 100 renders
 * [təja˨] as a speaker says it, not [tɪʔ ja˨] as two isolated words.
 */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0) return String(n);
    if (n === 0) return N.zero;
    if (n >= CRORE) {
        // Above 10⁷ the places repeat: read the crore count, the place word, then the remainder.
        const crores = Math.floor(n / CRORE);
        const rest = n % CRORE;
        const place = N.places[6]!; // ကုဋေ
        return [numberToWords(crores), rest === 0 ? place[0] : place[1], rest === 0 ? "" : numberToWords(rest)]
            .filter((s) => s !== "")
            .join("");
    }
    const out: string[] = [];
    // Walk the places from 10⁶ down to 10¹, then the bare unit.
    for (let p = 6; p >= 1; p--) {
        const value = 10 ** p;
        const mult = Math.floor(n / value) % 10;
        if (mult === 0) continue;
        const place = N.places[p - 1]!;
        const rest = n % value;
        // The multiplier for 1 is dropped only at ဆယ် (10¹).
        if (!(mult === 1 && p === 1)) out.push(mult === 1 ? N.one : N.units[mult]!);
        out.push(rest === 0 ? place[0] : place[1]);
    }
    const unit = n % 10;
    if (unit !== 0) out.push(N.units[unit]!);
    return out.join("");
}
