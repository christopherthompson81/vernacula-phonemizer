/**
 * Pinyin → canonical IPA (Phase 1: the pinyin input path).
 *
 * A tokenized pinyin string (`ni3 hao3`, `zhong1 guo2`) becomes canonical IPA: each syllable is looked up
 * in the toneless syllable→IPA table, third-tone sandhi is applied over the tone-number sequence, and the
 * Chao tone is appended at the syllable end. The table + tone system are DATA (syllable-ipa.tsv, cmn.jsonc);
 * this file is the engine (sandhi + assembly), so it ports cleanly and mirrors the Hindi/English split.
 */

export interface MandarinTables {
  /** toneless pinyin syllable → segmental IPA (with the ˈ nucleus mark, no tone). */
  syllableIpa: ReadonlyMap<string, string>;
  /** tone number ("1".."5") → Chao contour letters ("" for neutral). */
  tones: Record<string, string>;
}

/** One parsed pinyin syllable: its toneless base and its lexical tone (1–5; 5 = neutral). */
interface Syllable {
  base: string;
  tone: number;
}

/** Normalize ü spellings the table keys with ü: `lv`/`nv` → `lü`, trailing `u:` → `ü`. */
function normalizeU(base: string): string {
  if (base === "lv" || base === "nv") return base[0] + "ü";
  if (base === "lve" || base === "nve") return base[0] + "üe";
  return base.replace(/u:/g, "ü");
}

/** Split a pinyin token into its toneless base + tone digit (default 5 = neutral). */
function parseSyllable(token: string): Syllable {
  const m = /^([a-zü:]+?)([1-5])?$/i.exec(token);
  if (!m) return { base: token.toLowerCase(), tone: 5 };
  return { base: normalizeU(m[1]!.toLowerCase()), tone: m[2] ? Number(m[2]) : 5 };
}

/**
 * Third-tone sandhi over a syllable run: a 3rd tone immediately before another 3rd tone surfaces as 2nd
 * (你好 nǐ hǎo → ní hǎo). Applied left-to-right pairwise; the final 3rd tone in a run stays 3rd. Returns the
 * realized tone numbers (does not mutate input).
 */
export function applyThirdToneSandhi(tones: number[]): number[] {
  const out = tones.slice();
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i] === 3 && out[i + 1] === 3) out[i] = 2;
  }
  return out;
}

/** Build the pinyin→IPA converter from the data tables. */
export function makePinyinToIpa(tables: MandarinTables): (pinyin: string) => string {
  const { syllableIpa, tones } = tables;
  return function pinyinToIpa(pinyin: string): string {
    const tokens = pinyin.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return "";
    const syls = tokens.map(parseSyllable);
    const realized = applyThirdToneSandhi(syls.map((s) => s.tone));
    const out: string[] = [];
    for (let i = 0; i < syls.length; i++) {
      const seg = syllableIpa.get(syls[i]!.base);
      if (seg === undefined) { out.push(tokens[i]!); continue; } // unknown syllable: pass through
      out.push(seg + (tones[String(realized[i]!)] ?? ""));
    }
    return out.join(" ");
  };
}
