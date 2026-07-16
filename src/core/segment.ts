/**
 * Shared DAG maximal-matching core for the SPACELESS-script segmenters (Thai, Burmese, …). Covers a code-point
 * run with the FEWEST dictionary words, with every word boundary required to be in `bound` (the language's legal
 * boundary positions — Thai TCC clusters, Burmese syllable starts — so a word never begins or ends mid-cluster).
 * Runs of out-of-dictionary clusters coalesce into ONE unknown token (graceful: the caller phonemizes it whole).
 */

import { loadLines } from "./loadTsv.ts";

/** Load a `seg-words.txt` beside `metaUrl` (one word per line, `#` comments skipped) into a set + its longest
 *  entry (which bounds the DAG scan). Shared by the spaceless-script segmenters. `reduce` (not Math.max(...spread))
 *  so a ~65k-entry set can't blow the call-argument limit. */
export function loadSegWords(metaUrl: string): { set: Set<string>; maxLen: number } {
    const set = new Set(loadLines(metaUrl, "seg-words.txt", { optional: true }).map((l) => l.trim()).filter(Boolean));
    const maxLen = [...set].reduce((m, w) => Math.max(m, [...w].length), 1);
    return { set, maxLen };
}

/** Cover `cs` with the fewest dictionary `words`, boundaries constrained to `bound`; OOV runs coalesce to one token. */
export function segmentByDag(
    cs: readonly string[],
    words: ReadonlySet<string>,
    maxLen: number,
    bound: Set<number>,
): string[] {
    const n = cs.length;
    if (n === 0) return [];
    const isStart = (i: number): boolean => i === 0 || bound.has(i);
    const dp = new Array<number>(n + 1).fill(Infinity);
    const next = new Array<number>(n + 1).fill(-1);
    dp[n] = 0;
    for (let i = n - 1; i >= 0; i--) {
        if (!isStart(i)) continue; //                     words start only at a boundary
        for (let len = 1; len <= Math.min(maxLen, n - i); len++) {
            const j = i + len;
            if (!bound.has(j)) continue; //                 …and end only at a boundary
            if (words.has(cs.slice(i, j).join("")) && dp[j]! + 1 < dp[i]!) {
                dp[i] = dp[j]! + 1;
                next[i] = j;
            }
        }
        if (dp[i] === Infinity) {
            //                       fallback: the single cluster here (advance to the next boundary)
            let j = i + 1;
            while (j < n && !bound.has(j)) j++;
            dp[i] = dp[j]! + 1;
            next[i] = j;
        }
    }
    // Reconstruct; coalesce consecutive OUT-OF-DICTIONARY clusters into one unknown word.
    const out: string[] = [];
    for (let i = 0; i < n;) {
        const j = next[i]!;
        if (!words.has(cs.slice(i, j).join(""))) {
            let k = j;
            while (k < n) {
                const nk = next[k]!;
                if (words.has(cs.slice(k, nk).join(""))) break;
                k = nk;
            }
            out.push(cs.slice(i, k).join(""));
            i = k;
        } else {
            out.push(cs.slice(i, j).join(""));
            i = j;
        }
    }
    return out;
}
