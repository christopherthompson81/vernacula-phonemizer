/**
 * Latvian (lv) grapheme→phoneme engine — Baltic, Latin script, canonical IPA, espeak-independent. Latvian writes
 * what Lithuanian leaves implicit, so the scan is largely direct: written palatals (ģ ķ ļ ņ → ɟ c ʎ ɲ), written
 * length (macron ā ē ī ū → aː eː iː uː). The context systems:
 *   - native ⟨o⟩ → the falling diphthong [uɔ̯] (loks→luɔ̯ks); loans keep [o] (lexical — see the investigation).
 *   - falling DIPHTHONGS: a short vowel immediately followed by ⟨i⟩/⟨u⟩ takes it as a non-syllabic offglide, but only
 *     for the real Latvian pairs (ai ei ui / au iu; maize→maizɛ, draugs→drauks); ⟨ie⟩ → [iɛ] (i is the nucleus).
 *   - ⟨v⟩ vocalizes to [w] in the coda (dievs→diɛws), stays [v] before a vowel (Latvija→latvija).
 *   - VOICING: regressive assimilation within obstruent clusters (draugs→drau̯ks, g→k before s); sonorants +
 *     ⟨v⟩/⟨j⟩ + the vowel offglides are transparent. n → ŋ before a velar.
 * Stress (fixed first-syllable) is applied in latvian.ts. See docs/investigations/lv_native_bringup_investigation.md.
 */
import { MANIFEST } from "./manifest.ts";

const V = MANIFEST.vowels;
const LV = MANIFEST.longVowels;
const C = MANIFEST.consonants;
const CDI = MANIFEST.consonantDigraphs;
const TO_VOICELESS = MANIFEST.voicing.toVoiceless;
const isVoiced = (p: string): boolean => p in TO_VOICELESS; // voiced obstruents key the devoicing map
const isVoiceless = (p: string): boolean => p in MANIFEST.voicing.toVoiced; // voiceless obstruents key the voicing map
const isVowelChar = (c: string): boolean => c !== "" && (c in V || c in LV || c === "o"); // ⟨o⟩ is special-cased, not in V
// The Latvian falling diphthongs — the only (short-vowel nucleus, ⟨i⟩/⟨u⟩ offglide) pairs (ai ei ui / au iu). A long
// vowel or any other pair (eu, ou, ii) is HIATUS, not a diphthong (neuzmanība → nɛuz…, ā+i → aːi).
const I_OFFGLIDE = new Set(["a", "ɛ", "u"]); // ai ei ui
const U_OFFGLIDE = new Set(["a", "i"]); // au iu

export interface Seg {
    ph: string;
    nucleus: boolean;
}

/** Scan Latvian orthography into IPA segments (digraphs + native-⟨o⟩ + diphthong offglides), before voicing. */
function scan(word: string): Seg[] {
    const w = [...word.toLowerCase()];
    const segs: Seg[] = [];
    const n = w.length;
    let i = 0;
    // Emit a SHORT vowel nucleus, then take a following ⟨i⟩/⟨u⟩ as a non-syllabic offglide ONLY when the pair is a
    // real Latvian diphthong (ai ei ui / au iu). The offglide is the plain vowel [i]/[u]; the referee's varied glide
    // notation (j~i̯~î, w~u̯~û) is reconciled by the eval folds (j→i, w→u).
    const vowel = (ph: string): void => {
        segs.push({ ph, nucleus: true });
        const nx = w[i + 1];
        if ((nx === "i" && I_OFFGLIDE.has(ph)) || (nx === "u" && U_OFFGLIDE.has(ph))) {
            segs.push({ ph: V[nx]!, nucleus: false });
            i += 1;
        }
    };
    while (i < n) {
        const c = w[i]!;
        const two = c + (w[i + 1] ?? "");
        if (two in CDI) { segs.push({ ph: CDI[two]!, nucleus: false }); i += 2; continue; }
        if (two === "ie") { segs.push({ ph: "i", nucleus: true }, { ph: "ɛ", nucleus: false }); i += 2; continue; }
        if (c in LV) { vowel(LV[c]!); i += 1; continue; }
        if (c === "o") { segs.push({ ph: "u", nucleus: true }, { ph: "ɔ̯", nucleus: false }); i += 1; continue; }
        if (c in V) { vowel(V[c]!); i += 1; continue; }
        // ⟨v⟩ vocalizes to [w] in the coda (before a consonant / word-final: dievs→diɛws) but is [v] before a vowel.
        if (c === "v") { segs.push({ ph: isVowelChar(w[i + 1] ?? "") ? "v" : "w", nucleus: false }); i += 1; continue; }
        if (c in C) { segs.push({ ph: C[c]!, nucleus: false }); i += 1; continue; }
        i += 1; // unknown → skip
    }
    return segs;
}

/** n → ŋ before a velar k/ɡ. */
function nasalAssim(segs: Seg[]): void {
    for (let i = 0; i < segs.length - 1; i++) {
        if (segs[i]!.ph === "n" && /^[kɡ]/.test(segs[i + 1]!.ph)) segs[i]!.ph = "ŋ";
    }
}

/** Regressive DEVOICING over obstruent clusters — a voiced obstruent devoices before a voiceless one (draugs→drau̯ks,
 *  g→k before s; dzelzs→dzɛls, z→s). Latvian does NOT apply the reverse (voiceless→voiced) across a boundary
 *  (atgriezt keeps [atɡ], not [adɡ]), so only the devoicing direction fires. Sonorants, ⟨v⟩/⟨j⟩, and the offglides are
 *  transparent; no word-final devoicing (draugs' devoicing is the regressive rule before the final -s). */
function applyVoicing(segs: Seg[]): void {
    for (let i = segs.length - 2; i >= 0; i--) {
        const p = segs[i]!.ph;
        if (isVoiced(p) && isVoiceless(segs[i + 1]!.ph)) segs[i]!.ph = TO_VOICELESS[p]!;
    }
}

/** Latvian word → IPA phoneme segments (scan + ŋ-assimilation + regressive voicing). Stress is added in latvian.ts. */
export function toSegments(word: string): Seg[] {
    const segs = scan(word);
    nasalAssim(segs);
    applyVoicing(segs);
    return segs;
}
