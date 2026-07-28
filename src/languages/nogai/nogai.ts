/**
 * Nogai (nog) phonemizer — ногай тили, Kipchak Turkic (Kipchak-Nogai / South-Kipchak, close to Kazakh/Karakalpak),
 * CYRILLIC script, ~90k (North Caucasus + Turkey). Canonical IPA, espeak-independent. A near-deterministic Cyrillic
 * grapheme scan — Nogai's orthography WRITES the uvulars (⟨къ⟩→[q], ⟨гъ⟩→[ʁ]) and the velar nasal (⟨нъ⟩→[ŋ]) as
 * DIGRAPHS, so — unlike Kazakh/Tatar, which infer ⟨к⟩→[q] from vowel harmony — ⟨к⟩ is always [k] and ⟨г⟩ always [ɡ]
 * (the Bashkir pattern, no harmony inference needed).
 *
 *   ★ DIGRAPHS (longest-match, two Cyrillic characters): the FRONT vowels ⟨аь⟩→[æ], ⟨оь⟩→[ø], ⟨уь⟩→[y] (soft-sign
 *     ь), and the back consonants ⟨гъ⟩→[ʁ], ⟨къ⟩→[q], ⟨нъ⟩→[ŋ] (hard-sign ъ), plus ⟨дж⟩→[d͡ʒ].
 *   ★ Simple vowels ⟨а е и о у ы э⟩→[a e i o u ɯ e]; ⟨ы⟩ is the back unrounded [ɯ]. Iotated ⟨я ю ё⟩→[ja ju jo] and
 *     word-initial / post-vocalic ⟨е⟩→[je]. ⟨ж⟩→[ʒ], ⟨ш⟩→[ʃ], ⟨ч⟩→[t͡ʃ], ⟨х⟩→[x], ⟨й⟩→[j].
 *   ★ ⟨в⟩ → [w] post-vocalically in a coda (сув→suw, тав→taw — the native Turkic /w/) but [v] as an onset (loans).
 *   ★ Word-final (oxytone) stress — the Turkic default.
 *
 * REFEREE-LIMITED (the st/umb/bal mold): Nogai has essentially no orthographic-IPA attestation (1 kaikki word,
 * туькен→tyken; no wikipron/epitran). The g2p is authored from documented Kipchak-Nogai phonology and corroborated
 * (coarsely, inventory-only) by the ASJP Nogai Swadesh list. See docs/investigations/nog_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";

// Plain (context-free) single-letter consonants. ⟨в⟩ (coda-w) and the digraphs are handled in the scan.
const CONS: Record<string, string> = {
    б: "b", г: "ɡ", д: "d", ж: "ʒ", з: "z", й: "j", к: "k", л: "l", м: "m", н: "n",
    п: "p", р: "r", с: "s", т: "t", ф: "f", х: "x", ц: "t͡s", ч: "t͡ʃ", ш: "ʃ", щ: "ʃː",
};
// Simple vowels → IPA. ⟨ы⟩ is the back unrounded [ɯ] (Kipchak); ⟨э⟩ merges with ⟨е⟩ → [e].
const VOWEL: Record<string, string> = { а: "a", о: "o", у: "u", ы: "ɯ", и: "i", е: "e", э: "e" };
// Iotated vowels → glide + vowel.
const IOTATED: Record<string, string> = { я: "ja", ю: "ju", ё: "jo" };
// Two-character digraphs (checked before the single-letter maps). Front vowels use the soft sign ь; the back
// consonants + velar nasal use the hard sign ъ; ⟨дж⟩ is two full letters.
// ⟨дж⟩ is NOT one of the 39 standard Nogai letters (Nogai keeps [j], written ⟨й⟩, where Kazakh/Karakalpak have ж) —
// it is a defensive mapping for the occasional loan д+ж adjacency, not a distinctive Nogai grapheme.
const DIGRAPH: Record<string, string> = {
    аь: "æ", оь: "ø", уь: "y", гъ: "ʁ", къ: "q", нъ: "ŋ", дж: "d͡ʒ",
};
const CYR_VOWEL = new Set(["а", "о", "у", "ы", "и", "е", "э", "я", "ю", "ё", "аь", "оь", "уь"]);
const IPA_VOWEL = new Set(["a", "æ", "o", "ø", "u", "y", "ɯ", "i", "e"]);
const STRESS_NASAL = new Set(["m", "n", "ŋ"]);

/** Sonority for maximal-onset stress: vowel 6, glide 5, liquid 4, nasal 3, fricative 2, affricate 1, stop 0. */
function sonority(seg: string): number {
    if ([...seg].some((c) => IPA_VOWEL.has(c))) return 6;
    if (seg === "j" || seg === "w") return 5;
    if (["l", "r"].includes(seg)) return 4;
    if (STRESS_NASAL.has(seg)) return 3;
    if (seg.includes("͡")) return 1;
    if (["f", "v", "s", "z", "ʃ", "ʒ", "x", "χ", "h", "ʁ", "ɣ"].includes(seg)) return 2;
    return 0;
}

/** Is an emitted IPA segment a vowel (or vowel-bearing)? Used for the coda-⟨в⟩, ⟨е⟩-iotation, and stress tests. */
const isVowelSeg = (s: string | undefined): boolean => s !== undefined && [...s].some((c) => IPA_VOWEL.has(c));

/** Phonemize one Nogai (Cyrillic) word → canonical IPA: digraph-aware grapheme scan + word-final stress. */
export function phonemizeWord(word: string): string {
    const chars = [...word.normalize("NFC").toLowerCase()];
    const segs: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]!;
        const pair = ch + (chars[i + 1] ?? "");
        if (DIGRAPH[pair] !== undefined) {
            segs.push(DIGRAPH[pair]!);
            i++; // consumed the second character
            continue;
        }
        // ⟨в⟩ → [w] in a post-vocalic coda (before a consonant or word-final): сув→suw, тав→taw; else [v] (onset/loan).
        // The "previous vowel" test reads the last EMITTED segment (not the raw prior char), so a front-vowel DIGRAPH
        // ⟨аь оь уь⟩ — whose second char is the soft sign ь — still counts as the preceding vowel.
        if (ch === "в") {
            const nx = chars[i + 1];
            const coda = nx === undefined || !CYR_VOWEL.has(nx);
            segs.push(isVowelSeg(segs[segs.length - 1]) && coda ? "w" : "v");
            continue;
        }
        // word-initial / post-vocalic ⟨е⟩ → [je]; after a consonant → [e]. Uses the last emitted segment so a preceding
        // front-vowel digraph counts as a vowel too.
        if (ch === "е") {
            segs.push(segs.length === 0 || isVowelSeg(segs[segs.length - 1]) ? "je" : "e");
            continue;
        }
        if (CONS[ch] !== undefined) segs.push(CONS[ch]!);
        else if (IOTATED[ch] !== undefined) segs.push(IOTATED[ch]!);
        else if (VOWEL[ch] !== undefined) segs.push(VOWEL[ch]!);
        else if (ch === "ъ") segs.push("ʔ"); // a stray hard sign (not part of гъ/къ/нъ) — glottal / hiatus
        // ь (a stray soft sign, not part of аь/оь/уь): loan palatalization — dropped
    }
    // Word-final (oxytone) stress — the Turkic default: ˈ before the maximal onset of the last vowel's syllable
    // (native Nogai has no onset clusters; loans do). Same algorithm as the Tatar/Turkmen scans.
    const vidx = segs.map((s, idx) => (isVowelSeg(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        let at = vidx[vidx.length - 1]!;
        if (at > 0 && !isVowelSeg(segs[at - 1]!)) at--; // the immediate onset consonant
        while (at > 0 && !isVowelSeg(segs[at - 1]!)) {
            const p = segs[at - 1]!,
                l = segs[at]!;
            const obstruentLiquid = sonority(p) <= 2 && sonority(l) >= 4;
            const sibilantStop = ["s", "ʃ"].includes(p) && sonority(l) <= 1;
            if (!(obstruentLiquid || sibilantStop)) break;
            at--;
        }
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

// A word (Cyrillic letters) / number / punctuation token. Numbers deferred.
const TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.!?…,;:])/gu;

class NogaiPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred (digits passed through)
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Nogai phonemizer (digraph-aware Cyrillic g2p + final stress). */
export function createNogai(): Phonemizer {
    return new NogaiPhonemizer();
}
