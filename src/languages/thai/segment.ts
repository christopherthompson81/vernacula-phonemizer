/**
 * Thai word segmentation — ported from espeak-ng-portable src/Normalize/scriptSegmentation.ts (our authored
 * front-end). DAG maximal-matching (fewest tokens) over the seg-words set, with word boundaries constrained to
 * TCC (Thai Character Cluster, PyThaiNLP/Theeramunkong) boundaries so a word never splits mid-cluster. Used to
 * split a corpus token that is actually a compound (ก็คือ → ก็ คือ). See docs/investigations/th_native_bringup_investigation.md.
 */
import { THAI_TCC_RE } from "./manifest.ts";
import { segmentByDag, loadSegWords } from "../../core/segment.ts";

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

// Load the seg-words set (beside this file) once; longest entry bounds the DAG scan.
let WORDS: { set: Set<string>; maxLen: number } | undefined;
function words(): { set: Set<string>; maxLen: number } {
    return (WORDS ??= loadSegWords(import.meta.url));
}

/** Segment a Thai token into words via the seg-words DAG (a single in-dictionary word comes back unchanged). */
export function segment(text: string): string[] {
    const { set, maxLen } = words();
    if (set.size === 0) return [text];
    return segmentThai(text, set, maxLen);
}
