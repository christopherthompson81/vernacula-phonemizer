/**
 * Pinyin → canonical IPA.
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
    /** third-tone sandhi rule (from cmn.jsonc → sandhi.thirdThird), as tone NUMBERS. */
    thirdToneSandhi: { from: number; before: number; to: number };
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

const SYLLABLE = /^([a-zü:]+?)([1-5])?$/i;

/** Split a pinyin token into its toneless base + tone digit (default 5 = neutral). */
function parseSyllable(token: string): Syllable {
    const m = SYLLABLE.exec(token);
    if (!m) return { base: token.toLowerCase(), tone: 5 };
    return {
        base: normalizeU(m[1]!.toLowerCase()),
        tone: m[2] ? Number(m[2]) : 5,
    };
}

/**
 * Third-tone sandhi over a syllable run: a 3rd tone immediately before another 3rd tone surfaces as 2nd
 * (你好 nǐ hǎo → ní hǎo). Applied left-to-right pairwise; the final 3rd tone in a run stays 3rd. Returns the
 * realized tone numbers (does not mutate input). The rule (3+3→2) is DATA — passed in from cmn.jsonc.
 */
export function applyThirdToneSandhi(
    tones: number[],
    rule: MandarinTables["thirdToneSandhi"],
): number[] {
    const out = tones.slice();
    for (let i = 0; i < out.length - 1; i++) {
        if (out[i] === rule.from && out[i + 1] === rule.before)
            out[i] = rule.to;
    }
    return out;
}

const WHITESPACE = /\s+/;

/**
 * ERHUA: a bare `r` (`r5`, `r`) is not a syllable but the rhotic suffix of the one before it — `yi1 dian3 r5`
 * is 一点儿, two syllables, the second rhotacized. It takes no slot in the tone sequence (so `dian3 r5 hao3`
 * still sandhis dian3 before hao3), and attaches between its host's segments and tone: `tiɛnr˨˩˦`. The rhotic
 * is DERIVED from the table, not typed: it is the syllable `er`'s own reading after its nucleus (`ər` → `r`),
 * so a change to `er` moves it too. An `r` with no syllable before it is the syllable `er` itself.
 */
const ERHUA = "r";

/**
 * The converter. `strict`: an unknown token makes the whole conversion fail (`null`) — the direct pinyin path
 * branches on that instead of checking first and converting second. Otherwise an unknown token is dropped.
 */
function convert(tables: MandarinTables, pinyin: string, strict: boolean): string | null {
    const { syllableIpa, tones, thirdToneSandhi } = tables;
    const tokens = pinyin.trim().split(WHITESPACE).filter(Boolean);
    if (tokens.length === 0) return "";
    const er = syllableIpa.get("er");
    const rhotic = er === undefined ? undefined : [...er].slice(1).join("");
    // Group each erhua token onto the token before it; the heads alone carry tones.
    const heads: { syl: Syllable; suffix: string }[] = [];
    for (const tok of tokens) {
        const syl = parseSyllable(tok);
        if (syl.base === ERHUA && rhotic !== undefined) {
            const host = heads[heads.length - 1];
            if (host !== undefined) host.suffix += rhotic;
            else heads.push({ syl: { base: "er", tone: syl.tone }, suffix: "" });
            continue;
        }
        if (strict && !syllableIpa.has(syl.base)) return null;
        heads.push({ syl, suffix: "" });
    }
    const realized = applyThirdToneSandhi(heads.map((h) => h.syl.tone), thirdToneSandhi);
    const out: string[] = [];
    for (let i = 0; i < heads.length; i++) {
        const seg = syllableIpa.get(heads[i]!.syl.base);
        // ⚠ AN UNKNOWN TOKEN IS DROPPED, NOT PASSED THROUGH. Passed through, it put TEXT into the phoneme
        // stream: a Han character with no reading (`𠮷野家` → `𠮷 jiɛ˨˩˦ t͡ɕiɑ˥˥`) or any unparseable token.
        // It still holds its slot in the tone sequence above, so it separates its neighbours for sandhi
        // exactly as the unread syllable does in speech (and an erhua suffix on it goes with it).
        if (seg === undefined) continue;
        out.push(seg + heads[i]!.suffix + (tones[String(realized[i]!)] ?? ""));
    }
    return out.join(" ");
}

/** Build the pinyin→IPA converter from the data tables. An unknown token is dropped. */
export function makePinyinToIpa(tables: MandarinTables): (pinyin: string) => string {
    return (pinyin) => convert(tables, pinyin, false)!;
}

/** The same converter, but `null` when any token is neither a syllable of the table nor erhua. */
export function makeStrictPinyinToIpa(tables: MandarinTables): (pinyin: string) => string | null {
    return (pinyin) => convert(tables, pinyin, true);
}
