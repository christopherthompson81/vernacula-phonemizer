/**
 * 一 (yī) and 不 (bù) tone sandhi — the two lexically-triggered sandhi that need the source character, so
 * they run on segmented tokens (not the toneless syllable path). Applied to bare single-char 一/不 only; the
 * phrase dictionary already bakes sandhi into multi-char entries. Mutates the tokens' tone digit in place.
 *
 *   不: base 4th tone; before a 4th tone → 2nd (不是 bú shì); elsewhere stays 4th (不好 bù hǎo).
 *   一: before a 4th tone → 2nd (一定 yídìng); before 1st/2nd/3rd → 4th (一天 yìtiān, 一起 yìqǐ);
 *       utterance-final or after 第 (ordinal 第一) → 1st (citation yī). Counting sequences keep 1st too,
 *       but that context isn't detectable from tone alone and is left as the productive-sandhi default.
 */
import type { Token } from "./segment.ts";

const toneOf = (py: string): number => {
    const m = /([1-5])$/.exec(py);
    return m ? Number(m[1]) : 5;
};
const setTone = (py: string, t: number): string =>
    py.replace(/[1-5]?$/, String(t));

export function applyYiBuSandhi(tokens: Token[]): void {
    for (let i = 0; i < tokens.length; i++) {
        const src = tokens[i]!.src;
        if (src !== "一" && src !== "不") continue;
        const next = tokens[i + 1];
        const nextTone = next ? toneOf(next.py) : 0; // 0 = no following syllable
        if (src === "不") {
            tokens[i]!.py = setTone(tokens[i]!.py, nextTone === 4 ? 2 : 4);
            continue;
        }
        // 一
        const ordinal = tokens[i - 1]?.src === "第";
        if (nextTone === 0 || ordinal)
            tokens[i]!.py = setTone(tokens[i]!.py, 1); // final / ordinal → yī
        else if (nextTone === 4)
            tokens[i]!.py = setTone(tokens[i]!.py, 2); // before 4th → yí
        else tokens[i]!.py = setTone(tokens[i]!.py, 4); // before 1/2/3 → yì
    }
}
