/**
 * Google `language-resources/bn` phone-code → our canonical Bengali IPA. Shared by build_google_consensus.ts (the
 * cross-source consensus lexicon) and build_tagger_data.ts (the neural-tagger training corpus) so the single
 * authoritative mapping lives in one place. Bengali c/ɟ are realized as affricates (t͡ʃ/d͡ʒ); Google's offglide
 * codes (i^ u^ e^ o^) fold to plain vowels; voiced aspirates are breathy (ʱ), হ is ɦ.
 */
export const GOOGLE_BN_PHONES: Record<string, string> = {
    O: "ɔ", a: "a", i: "i", u: "u", e: "e", E: "æ", o: "o", "i^": "i", "u^": "u", "e^": "e", "o^": "o",
    k: "k", kh: "kʰ", g: "ɡ", gh: "ɡʱ", N: "ŋ", c: "t͡ʃ", ch: "t͡ʃʰ", j: "d͡ʒ", jh: "d͡ʒʱ",
    T: "ʈ", Th: "ʈʰ", D: "ɖ", Dh: "ɖʱ", t: "t̪", th: "t̪ʰ", d: "d̪", dh: "d̪ʱ", n: "n", p: "p",
    f: "f", b: "b", bh: "bʱ", m: "m", r: "ɾ", l: "l", sh: "ʃ", s: "s", h: "ɦ",
};

/** A Google phone string (space-separated codes, `.` = syllable break) → our IPA, or `null` on an UNMAPPED phone
 *  (a future upstream refresh could add one) — never silently drop a segment. */
export function googleToIpa(t: string): string | null {
    const out: string[] = [];
    for (const x of t.split(/\s+/)) {
        if (x === ".") continue;
        if (!(x in GOOGLE_BN_PHONES)) return null;
        out.push(GOOGLE_BN_PHONES[x]!);
    }
    return out.join("");
}
