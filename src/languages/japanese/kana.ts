/**
 * Japanese kana → canonical IPA (Standard/Tokyo, narrow). Mora-based: gojūon + dakuten/handakuten + youon
 * (きゃ…) + sokuon (っ, gemination) + long vowels (ー, おう→o̞ː, えい→e̞ː) + moraic ん→ɴ. Katakana is folded to
 * hiragana first. Vowels: あ→ä い→i う→ɯᵝ え→e̞ お→o̞. Segmental only — pitch accent is a later phase.
 * See docs/investigations/ja_native_bringup_investigation.md.
 */

import { MANIFEST } from "./manifest.ts";

// Vowels (narrow Tokyo): centralized ä, compressed ɯᵝ, mid-lowered e̞/o̞. Lookup tables are DATA (japanese.jsonc).
const A = MANIFEST.vowels.a!,
    I = MANIFEST.vowels.i!,
    U = MANIFEST.vowels.u!,
    E = MANIFEST.vowels.e!,
    O = MANIFEST.vowels.o!;
const MORA = MANIFEST.mora; // single kana → IPA mora
const YOUON_ONSET = MANIFEST.youonOnset; // Ci + small ゃゅょ onset (already-palatal ɕ/t͡ɕ/d͡ʑ/ç take no ʲ)
const SMALL_Y = MANIFEST.smallY; // the small ゃゅょ vowel
const FOREIGN = MANIFEST.foreign; // extended (foreign-sound) katakana: base + small kana → onset + vowel
const VOWEL_KANA = MANIFEST.vowelKana; // vowel-continuation kana for same-vowel lengthening (を excluded)
const NASAL_ASSIM = MANIFEST.nasalAssimilation; // moraic ん → place-assimilated nasal by next onset

/** Fold katakana (and the long mark) to hiragana; leave everything else. */
function toHiragana(w: string): string {
    let out = "";
    for (const ch of w) {
        const c = ch.codePointAt(0)!;
        if (c >= 0x30a1 && c <= 0x30f6)
            out += String.fromCodePoint(c - 0x60); // カ → か
        else out += ch;
    }
    return out;
}

const isVowelChar = (ph: string): boolean =>
    ph === A || ph === I || ph === U || ph === E || ph === O;
/** The vowel phoneme a mora ends in (ɯᵝ/o̞/e̞ before their bases), or "" for ん/っ/onset-only. */
function vowelOf(ms: string): string {
    for (const v of [U, O, E, A, I]) if (ms.endsWith(v)) return v;
    return "";
}

/**
 * A run of kana → its list of MORAE (one array element per mora: a long vowel ː is its own mora, a moraic ん is
 * its own mora, a sokuon っ its own mora). `join("")` reconstructs the IPA. Keeping morae separate lets the pitch
 * pass place the downstep by index without re-parsing (our assimilated ん→n/m would be ambiguous in the string).
 * Returns null if the text isn't kana (so the caller can handle romaji/punctuation/unresolved kanji).
 */
export function kanaToMorae(word: string): string[] | null {
    const chars = [...toHiragana(word)];
    const morae: string[] = [];
    let i = 0;
    let lastVowel = ""; // trailing vowel of the current syllable (survives a ː, cleared by ん/っ)
    while (i < chars.length) {
        const c = chars[i]!,
            nx = chars[i + 1] ?? "";
        // Extended katakana (foreign sounds): base kana + small kana → onset + vowel (ファ→ɸä, チェ→t͡ɕe̞, ディ→di,
        // デュ→dʲɯᵝ). Keys carry the small 2nd kana, so a direct FOREIGN lookup can't shadow a normal mora sequence.
        if (FOREIGN[c + nx]) {
            const ms = FOREIGN[c + nx]!;
            morae.push(ms);
            lastVowel = vowelOf(ms);
            i += 2;
            continue;
        }
        // Youon: Ci + small ゃゅょ.
        if (YOUON_ONSET[c] && SMALL_Y[nx]) {
            const ms = YOUON_ONSET[c]! + SMALL_Y[nx]!;
            morae.push(ms);
            lastVowel = vowelOf(ms);
            i += 2;
            continue;
        }
        // Sokuon っ → geminate the next mora's first consonant (its own mora). Word-final / vowel-onset → glottal ʔ.
        if (c === "っ" || c === "ッ") {
            const next =
                SMALL_Y[chars[i + 2] ?? ""] && YOUON_ONSET[nx]
                    ? YOUON_ONSET[nx]! + SMALL_Y[chars[i + 2]!]!
                    : MORA[nx];
            morae.push(next && !isVowelChar(next[0]!) ? next[0]! : "ʔ");
            lastVowel = "";
            i++;
            continue;
        }
        // Long vowel mark ー → +1 mora (ː).
        if (c === "ー" || c === "ｰ") {
            if (morae.length) morae.push("ː");
            i++;
            continue;
        }
        const m = MORA[c];
        if (m === undefined) return null; // not kana → let the caller handle (romaji, punctuation, kanji)
        // Long-vowel coalescence, keyed on the CURRENT KANA (not the phoneme): the お+う / え+い digraphs (おう→o̞ː,
        // えい→e̞ː) and a vowel kana repeating the previous vowel (おお→o̞ː, いい→iː) all fold to a length mark. This
        // fires after a youon mora too — ː is the preferred long-vowel notation everywhere (じゅう→d͡ʑɯᵝː, きゅう→kʲɯᵝː,
        // きょう→kʲo̞ː), for canonical consistency (a doubled vowel and a ー-lengthened vowel are the same length).
        // A fold pushes a bare ː mora; stacking (けいい→ke̞ːː) works since lastVowel survives the ː. を is EXCLUDED from
        // the same-vowel rule (a distinct kana, near-always the particle): 語を→ɡo̞o̞, never ɡo̞ː.
        if (lastVowel !== "") {
            if (c === "う" && lastVowel === O) {
                morae.push("ː");
                i++;
                continue;
            } else if (c === "い" && lastVowel === E) {
                morae.push("ː");
                i++;
                continue;
            } else if (VOWEL_KANA[c] === lastVowel) {
                morae.push("ː");
                i++;
                continue;
            }
        }
        morae.push(m);
        lastVowel = vowelOf(m);
        i++;
    }
    return assimilateMoraicN(morae);
}

/**
 * Moraic ん assimilates to the FOLLOWING onset's place: n before coronals, ŋ before velars, m before labials,
 * else ɴ (before vowels/glides/fricatives or word-finally): こんにちは→ko̞nni…, にほんご→niho̞ŋɡo̞, さんぽ→sampo̞.
 *
 * Split out so it can run a second time over CONCATENATED segments: when a word is moraised per morpheme
 * (segmentsToMorae, #552), a ん ending one segment cannot see the next segment's onset, and 健康 けん|こう
 * came out ke̞ɴko̞ː instead of ke̞ŋko̞ː. Re-running over the joined morae fixes that, and is idempotent —
 * an already-assimilated mora is no longer "ɴ", so the loop skips it.
 */
export function assimilateMoraicN(morae: string[]): string[] {
    for (let k = 0; k < morae.length; k++) {
        if (morae[k] !== "ɴ") continue;
        const o = morae[k + 1]?.[0] ?? "";
        if (o === "") continue; // word-final ん stays ɴ (guard includes("") trap)
        for (const cls of NASAL_ASSIM)
            if (cls.onsets.includes(o)) {
                morae[k] = cls.nasal;
                break;
            }
    }
    return morae;
}

/** A run of kana → IPA. Returns null if the text isn't kana. */
export function kanaToIpa(word: string): string | null {
    const morae = kanaToMorae(word);
    return morae === null ? null : morae.join("");
}

/**
 * Morae for a word given as READING SEGMENTS (one per kanji reading; a literal-kana run is one segment).
 *
 * Long-vowel coalescence is confined to a segment, so the first vowel of one morpheme can never be absorbed
 * into the previous morpheme's length: 経営 けい|えい → ke̞ːe̞ː (not ke̞ːːː), 聖域 せい|いき → se̞ːiki (not
 * se̞ːːki), 子牛 こ|うし → ko̞ɯᵝɕi (not ko̞ːɕi). Issue #552.
 *
 * The mora COUNT is unchanged by this — a coalesced ː was already one mora — so accent-nucleus indices from
 * the pitch dictionary keep pointing at the same mora. Only the vowel QUALITY is corrected.
 *
 * Returns null if any segment is not kana, matching kanaToMorae's contract.
 */
export function segmentsToMorae(segments: readonly string[]): string[] | null {
    const out: string[] = [];
    for (const seg of segments) {
        if (seg === "") continue;
        const m = kanaToMorae(seg);
        if (m === null) return null;
        out.push(...m);
    }
    // Re-run place assimilation over the JOINED morae: a ん ending one segment could not see the next
    // segment's onset during per-segment conversion (健康 けん|こう → ke̞ɴko̞ː without this).
    return assimilateMoraicN(out);
}
