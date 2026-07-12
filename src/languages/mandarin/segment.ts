/**
 * Hanzi → pinyin segmentation (Phase 2). Greedy longest-match against the phrase dictionary gives
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
 * Segment a run of code points into pinyin tokens. `synth[i]` marks a character synthesized from a number
 * (2024 → 二〇二四): such characters are still phonemized, but get no `src`, so word-level 一/不 sandhi never
 * fires on a spoken digit (三点一四 keeps citation 一). Quantity 一 sandhi (一百 → yì bǎi) is unaffected — it
 * comes from the phrase dictionary, not the token `src`.
 */
export function segment(chars: string[], t: PinyinTables, synth: boolean[] = []): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (!HAN.test(ch)) { out.push({ py: ch }); i++; continue; }
    // Greedy longest phrase starting at i.
    let matched = false;
    const maxLen = Math.min(t.maxPhrase, chars.length - i);
    for (let len = maxLen; len >= 2; len--) {
      const phrase = chars.slice(i, i + len).join("");
      const py = t.phrases.get(phrase);
      if (py !== undefined) { for (const p of py.split(" ")) out.push({ py: p }); i += len; matched = true; break; }
    }
    if (matched) continue;
    // Single-char fallback: most-common reading. Real input chars carry `src` (for 一/不/第 sandhi); a
    // synthesized number digit does not.
    const readings = t.chars.get(ch);
    out.push(synth[i] ? { py: readings ? readings[0]! : ch } : { py: readings ? readings[0]! : ch, src: ch });
    i++;
  }
  return out;
}
