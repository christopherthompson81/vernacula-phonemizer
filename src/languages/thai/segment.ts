/**
 * Thai word segmentation — ported from espeak-ng-portable src/Normalize/scriptSegmentation.ts (our authored
 * front-end). DAG maximal-matching (fewest tokens) over the seg-words set, with word boundaries constrained to
 * TCC (Thai Character Cluster, PyThaiNLP/Theeramunkong) boundaries so a word never splits mid-cluster. Used to
 * split a corpus token that is actually a compound (ก็คือ → ก็ คือ). See docs/th_native_bringup_investigation.md.
 */
import { THAI_TCC_RE } from "./manifest.ts";
import { loadLines } from "../../core/loadTsv.ts";

/** Codepoint indices (1..n) at which a TCC cluster ENDS — the only LEGAL word-boundary
 *  positions for segmentThai, so a word is never split mid-cluster (เนี่ย stays whole). */
function thaiTccBoundaries(cs: readonly string[]): Set<number> {
    const bounds = new Set<number>();
    let p = 0;
    while (p < cs.length) {
        const m = THAI_TCC_RE.exec(cs.slice(p).join(""));
        p += m ? [...m[0]].length : 1;
        bounds.add(p);
    }
    return bounds;
}

/**
 * Segment a Thai run into words by DAG maximal-matching (FEWEST tokens) over `words`,
 * with word boundaries CONSTRAINED to TCC cluster boundaries (so a dictionary word can
 * neither start nor end mid-cluster, and the fallback never shatters a cluster). An
 * out-of-dictionary run coalesces into ONE token (graceful: the syllabifier then treats
 * it as an unsegmented word). See docs/investigation/thai_bringup_investigation.md Run 18-22.
 */
export function segmentThai(
    text: string,
    words: ReadonlySet<string>,
    maxLen: number,
): string[] {
    const cs = [...text];
    if (cs.length === 0) return [];
    return segmentByDag(cs, words, maxLen, thaiTccBoundaries(cs));
}
/** Shared DAG maximal-matching core for the spaceless-script segmenters: cover `cs` with the
 *  fewest dictionary words, with every word boundary required to be in `bound`; runs of
 *  out-of-dictionary clusters coalesce into one unknown token. */
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
        if (!isStart(i)) continue; //                     words start only at a cluster boundary
        for (let len = 1; len <= Math.min(maxLen, n - i); len++) {
            const j = i + len;
            if (!bound.has(j)) continue; //                 …and end only at a cluster boundary
            if (words.has(cs.slice(i, j).join("")) && dp[j]! + 1 < dp[i]!) {
                dp[i] = dp[j]! + 1;
                next[i] = j;
            }
        }
        if (dp[i] === Infinity) {
            //                       fallback: the single TCC cluster here
            let j = i + 1;
            while (j < n && !bound.has(j)) j++;
            dp[i] = dp[j]! + 1;
            next[i] = j;
        }
    }
    // Reconstruct; coalesce consecutive OUT-OF-DICTIONARY clusters into one unknown word.
    const out: string[] = [];
    for (let i = 0; i < n; ) {
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

// Load the seg-words set (beside this file) once; longest entry bounds the DAG scan.
let WORDS: { set: Set<string>; maxLen: number } | undefined;
function words(): { set: Set<string>; maxLen: number } {
    if (WORDS === undefined) {
        const set = new Set(
            loadLines(import.meta.url, "seg-words.txt", { optional: true })
                .map((l) => l.trim())
                .filter(Boolean),
        );
        // longest entry (code points) bounds the DAG scan; ≥1 so a single cluster always has room.
        const maxLen = Math.max(1, ...[...set].map((w) => [...w].length));
        WORDS = { set, maxLen };
    }
    return WORDS;
}

/** Segment a Thai token into words via the seg-words DAG (a single in-dictionary word comes back unchanged). */
export function segment(text: string): string[] {
    const { set, maxLen } = words();
    if (set.size === 0) return [text];
    return segmentThai(text, set, maxLen);
}
