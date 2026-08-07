/**
 * Hanzi → pinyin segmentation. Greedy longest-match against the phrase dictionary gives
 * polyphone disambiguation (银行 → yín háng, not yín xíng); characters not covered by a phrase fall back to
 * their most-common single-char reading. Non-Han characters pass through untouched (numbers / punctuation /
 * Latin are handled downstream). Output is a list of `base+tone` pinyin tokens (+ raw pass-through tokens)
 * ready for the pinyin→IPA path.
 */

export interface PinyinTables {
    /** Hanzi char → its readings (base+tone), most-common first. */
    chars: ReadonlyMap<string, string[]>;
    /** multi-char phrase → its space-separated base+tone pinyin tokens. */
    phrases: ReadonlyMap<string, string>;
    /** longest phrase key length (in code points) — the greedy-match window. */
    maxPhrase: number;
}

const HAN = /\p{Script=Han}/u;

/** One segmented token: its `base+tone` pinyin, and (for single-char emissions) the source character so
 *  downstream sandhi can special-case 一/不/第. Phrase-dict tokens carry no `src` (their tones are baked). */
export interface Token {
    py: string;
    src?: string;
}

/**
 * Segment a run of code points into pinyin tokens. `exempt[i]` marks a character that must not drive word
 * sandhi — a spoken digit synthesized from a number (三点一四, 2024) — so it gets no `src` and word-level
 * 一/不 sandhi never fires on it. Quantity 一 (一千 → yì qiān) is NOT exempt and sandhis normally.
 */
export function segment(
    chars: string[],
    t: PinyinTables,
    exempt: boolean[] = [],
): Token[] {
    const out: Token[] = [];
    let i = 0;
    while (i < chars.length) {
        const ch = chars[i]!;
        if (!HAN.test(ch)) {
            out.push({ py: ch });
            i++;
            continue;
        }
        // Ordinal 一: after 第, force 一 to a single-char token so its citation (第一 → dì yī) survives instead of
        // being swallowed by a greedy 一X phrase (第一个 must not read the 一个 → yí gè sandhi).
        if (ch === "一" && out[out.length - 1]?.src === "第") {
            const r = t.chars.get("一");
            out.push({ py: r ? r[0]! : "一", src: "一" });
            i++;
            continue;
        }
        // Greedy longest phrase starting at i.
        let matched = false;
        const maxLen = Math.min(t.maxPhrase, chars.length - i);
        for (let len = maxLen; len >= 2; len--) {
            const phrase = chars.slice(i, i + len).join("");
            const py = t.phrases.get(phrase);
            if (py !== undefined) {
                for (const p of py.split(" ")) out.push({ py: p });
                i += len;
                matched = true;
                break;
            }
        }
        if (matched) continue;
        // Single-char fallback: most-common reading. Real input chars carry `src` (for 一/不/第 sandhi); a
        // sandhi-exempt spoken digit does not.
        const readings = t.chars.get(ch);
        out.push(
            exempt[i]
                ? { py: readings ? readings[0]! : ch }
                : { py: readings ? readings[0]! : ch, src: ch },
        );
        i++;
    }
    return out;
}
