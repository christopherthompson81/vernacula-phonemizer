/**
 * Japanese number + counter (助数詞) reading. After a number, a counter kanji fuses with euphonic sound changes:
 * gemination (促音便: 1→いっ, 6→ろっ, 8→はっ, 10→じゅっ before k/s/h counters), rendaku/handaku on h-initial
 * counters (本 3→ぼん / 1→いっぽん), and Sino number readings for 4/7/9 on some counters (4月→しがつ, 4時→よじ).
 * A few counters are wholly irregular (日: ついたち…はつか; 人: ひとり/ふたり). Built and validated against OpenJTalk
 * (BSD; the readings are linguistic facts). Feeds kana to kanaToIpa like the plain number path. See
 * docs/investigations/ja_native_bringup_investigation.md.
 */
import { numberToKana } from "./numbers.ts";

type Cls = "k" | "s" | "h" | "regular";
interface Counter {
    reading: string; // base kana
    cls: Cls;
    n4?: string; // ones-digit 4 reading override (よ/し); default よん
    n7?: string; // ones-digit 7 override (しち); default なな
    n9?: string; // ones-digit 9 override (く); default きゅう
    three?: string; // counter form after an ん-ending number (rendaku/handaku: 本→ぼん; 軒→げん; 分→ぷん; 足→ぞく)
    narrowThree?: boolean; // three applies to digit-3 (さん) ONLY, not せん (1000): 3階さんがい but 1000階せんかい
    four?: string; // counter form after よん (4) when it differs from the base (分→ぷん, 泊→ぱく; 本 stays ほん)
    irr?: Record<number, string>; // fully-irregular whole readings (人 1/2)
    table?: Record<number, string>; // wholly table-driven counter (日)
}

const H_TO_P: Record<string, string> = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ" };
const H_TO_B: Record<string, string> = { は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ" };
const pForm = (r: string): string => (H_TO_P[r[0]!] ?? r[0]!) + r.slice(1);
const bForm = (r: string): string => (H_TO_B[r[0]!] ?? r[0]!) + r.slice(1);

// 日 counter: irregular native readings 1–10, 14, 20, 24; others are Xにち (handled by the regular path).
const DAY: Record<number, string> = {
    1: "ついたち", 2: "ふつか", 3: "みっか", 4: "よっか", 5: "いつか", 6: "むいか", 7: "なのか",
    8: "ようか", 9: "ここのか", 10: "とおか", 14: "じゅうよっか", 20: "はつか", 24: "にじゅうよっか",
};

const COUNTERS: Record<string, Counter> = {
    月: { reading: "がつ", cls: "regular", n4: "し", n7: "しち", n9: "く" },
    時: { reading: "じ", cls: "regular", n4: "よ", n7: "しち", n9: "く" },
    円: { reading: "えん", cls: "regular", n4: "よ" },
    年: { reading: "ねん", cls: "regular", n4: "よ" },
    人: { reading: "にん", cls: "regular", n4: "よ", n7: "しち", irr: { 1: "ひとり", 2: "ふたり" } },
    日: { reading: "にち", cls: "regular", n7: "しち", n9: "く", table: DAY },
    分: { reading: "ふん", cls: "h", three: "ぷん", four: "ぷん" },
    本: { reading: "ほん", cls: "h" },
    匹: { reading: "ひき", cls: "h" },
    杯: { reading: "はい", cls: "h" },
    泊: { reading: "はく", cls: "h", three: "ぱく", four: "ぱく" },
    個: { reading: "こ", cls: "k" },
    回: { reading: "かい", cls: "k" },
    階: { reading: "かい", cls: "k", three: "がい", narrowThree: true },
    軒: { reading: "けん", cls: "k", three: "げん" },
    歳: { reading: "さい", cls: "s" },
    冊: { reading: "さつ", cls: "s" },
    足: { reading: "そく", cls: "s", three: "ぞく" },
    枚: { reading: "まい", cls: "regular" },
    番: { reading: "ばん", cls: "regular" },
    度: { reading: "ど", cls: "regular" },
    台: { reading: "だい", cls: "regular" },
    名: { reading: "めい", cls: "regular" },
    秒: { reading: "びょう", cls: "regular" },
    羽: { reading: "わ", cls: "regular" },
    頭: { reading: "とう", cls: "s" }, // gemination いっとう/じゅっとう (t-initial), but no ろく/ひゃく gem → s-class
    着: { reading: "ちゃく", cls: "s" },
    丁: { reading: "ちょう", cls: "s" },
};

export const isCounter = (ch: string): boolean => ch in COUNTERS;

/** number reading (numberToKana) but with the ONES digit's 4/7/9 replaced per the counter (4月→し, 4時→よ). */
function numWithOverride(n: number, c: Counter): string {
    const base = numberToKana(n);
    const ones = n % 10;
    const ov = ones === 4 ? c.n4 : ones === 7 ? c.n7 : ones === 9 ? c.n9 : undefined;
    if (ov === undefined) return base;
    const def = { 4: "よん", 7: "なな", 9: "きゅう" }[ones]!;
    return base.endsWith(def) ? base.slice(0, -def.length) + ov : base;
}

/**
 * n + counter → fused kana reading, or null if the kanji is not a known counter.
 */
export function readCounter(n: number, counter: string): string | null {
    const c = COUNTERS[counter];
    if (!c || !Number.isSafeInteger(n) || n < 0) return null;
    if (c.table?.[n] !== undefined) return c.table[n]!;
    if (c.irr?.[n] !== undefined) return c.irr[n]!;

    const num = numWithOverride(n, c);
    if (c.cls === "regular") return num + c.reading;

    // Euphony keys on the ENDING of the number reading (so 21本→にじゅういっぽん, 100本→ひゃっぽん all work).
    // Gemination: いち→いっ, はち→はっ, じゅう→じゅっ (all k/s/h); ろく→ろっ, and the ゃく-hundreds ひゃく/びゃく/ぴゃく
    // (100/300/600/800 → ひゃっ/びゃっ/ぴゃっ) (k/h, NOT s: 300頭→さんびゃくとう keeps ゃく).
    const geminate = (end: string, rep: string): string | null =>
        num.endsWith(end) ? num.slice(0, -end.length) + rep : null;
    let gem: string | null = null;
    for (const [end, rep] of [["いち", "いっ"], ["はち", "はっ"], ["じゅう", "じゅっ"]] as const)
        gem = gem ?? geminate(end, rep);
    if (c.cls !== "s")
        for (const [end, rep] of [["ろく", "ろっ"], ["ひゃく", "ひゃっ"], ["びゃく", "びゃっ"], ["ぴゃく", "ぴゃっ"]] as const)
            gem = gem ?? geminate(end, rep);

    if (gem !== null) return gem + (c.cls === "h" ? pForm(c.reading) : c.reading);
    // ん-ending numbers (さん=3, よん=4, せん=1000, …): h-counters take handaku/rendaku after ん.
    if (num.endsWith("ん")) {
        if (n % 10 === 4) return num + (c.four ?? c.reading); // 4本→よんほん, 4分→よんぷん
        if (c.cls === "h") return num + (c.three ?? bForm(c.reading)); // 3/1000本→さん/せんぼん, 3分→さんぷん
        if (c.three !== undefined && (!c.narrowThree || n % 10 === 3))
            return num + c.three; // 3軒→さんげん (broad); 3階→さんがい but 1000階→せんかい (narrow)
    }
    return num + c.reading;
}
