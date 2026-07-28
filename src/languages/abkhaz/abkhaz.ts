/**
 * Native Abkhaz / аҧсуа бызшәа (ab) text phonemizer — canonical IPA, espeak-independent. Abkhaz is a NORTHWEST
 * CAUCASIAN language (~190k, Abkhazia), the fleet's FIRST NW-Caucasian language. It has ONE OF THE LARGEST CONSONANT
 * INVENTORIES in the world (~58, with LABIALIZED, PALATALIZED, PHARYNGEALIZED and EJECTIVE series) and only TWO
 * phonemic vowels (⟨а⟩→[a], ⟨ы⟩→[ə]). The Cyrillic alphabet writes the consonants with base letters + MODIFIER letters:
 *   ★ ⟨ь⟩ PALATALIZES to a dorsal+[ʲ] (гь→[ɡʲ], хь→[χʲ]), ⟨ә⟩ LABIALIZES (гә→[ɡʷ], шә→[ʃʷ]), ⟨'⟩ PHARYNGEALIZES (х'→[χˤ]).
 *   ★ THREE-WAY stops/affricates — voiced / aspirated / ejective: ⟨г қ к⟩→[ɡ kʰ kʼ], ⟨д ҭ т⟩→[d tʰ tʼ],
 *     ⟨б ҧ п⟩→[b pʰ pʼ], ⟨ӡ ц ҵ⟩→[d͡z t͡sʰ t͡sʼ], ⟨џ ч ҷ⟩→[d͡ʐ t͡ʃʰ t͡ʃʼ]; the uvular ⟨ҟ⟩→[qʼ], the pharyngeal ⟨ҳ⟩→[ħ].
 *
 * 🔷 well-referenced (wikipron abk_cyrl broad + kaikki Abkhaz) BUT the referee is partly the letter/digraph DEFINITIONS
 * (near reference-parity), and its narrow transcriptions are internally inconsistent. See docs/investigations/ab_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";

// Base letter + MODIFIER (⟨ь⟩ palatal / ⟨ә⟩ labial / ⟨'⟩ pharyngeal) → the specific IPA cluster (from the Wiktionary
// letter-definitions). Longest-match: trigraphs (х'ә) before 2-char before base. Any base+ь/ә not here falls back to
// base+[ʲ]/[ʷ] (handled in code).
const CLUSTER: Record<string, string> = {
    "х'ә": "χˤʷ",
    // Palatalized DORSALS = dorsal + [ʲ] (NOT the devoiced palatal-place symbols of the wikipron letter-defs — the
    // 979-word corpus uses ɡʲ/kʼʲ/kʰʲ/χʲ, matching the already-correct ҟь→qʼʲ, ӷь→ʁʲ; ⟨г⟩ is voiced so гь can't be [c]).
    "гь": "ɡʲ", "гә": "ɡʷ", "дә": "dʷ", "жь": "ʒ", "жә": "ʒʷ", "кь": "kʼʲ", "кә": "kʼʷ", "тә": "tʷʼ",
    "хь": "χʲ", "хә": "χʷ", "ць": "t͡ɕʰ", "цә": "t͡ɕʷʰ", "шь": "ʃ", "шә": "ʃʷ", "ҙә": "ʑʷ",
    "қь": "kʰʲ", "қә": "kʷʰ", "ҟь": "qʼʲ", "ҟә": "qʼʷ", "ҭә": "tʷʰ", "ҳә": "ħʷ", "ҵь": "t͡ɕʼ", "ҵә": "t͡ɕʼʷ",
    "ӡь": "d͡ʑ", "ӡә": "d͡ʑʷ", "ӷь": "ʁʲ", "ӷә": "ʁʷ", "ҕь": "ʁʲ", "ҕә": "ʁʷ", "ҫә": "ɕʷ", "џь": "d͡ʒ",
    "чь": "t͡ɕʰ", "ҷь": "t͡ɕʼ", "х'": "χˤ",
};
// Base letters (single Cyrillic). The three-way stop/affricate series + the NW-Caucasian extras.
const BASE: Record<string, string> = {
    "а": "a", "б": "b", "в": "v", "г": "ɡ", "д": "d", "е": "e", "ж": "ʐ", "з": "z", "и": "i", "й": "j",
    "к": "kʼ", "л": "l", "м": "m", "н": "n", "о": "o", "п": "pʼ", "р": "r", "с": "s", "т": "tʼ", "у": "w",
    "ф": "f", "х": "χ", "ц": "t͡sʰ", "ч": "t͡ʃʰ", "ш": "ʂ", "ы": "ə", "э": "e", "ю": "ju", "я": "ja",
    "ҕ": "ʁ", "ӷ": "ʁ", "ҙ": "ʑ", "ӡ": "d͡z", "қ": "kʰ", "ӄ": "kʰ", "ҟ": "qʼ", "ҧ": "pʰ", "ԥ": "pʰ",
    "ҩ": "ɥ", "ҫ": "ɕ", "ҭ": "tʰ", "ҳ": "ħ", "ҵ": "t͡sʼ", "ҷ": "t͡ʃʼ", "ҽ": "t͡ʂʰ", "ҿ": "t͡ʂʼ", "џ": "d͡ʐ",
    // Extended / historical Abkhaz Cyrillic letters (older orthographies):
    "ԡ": "lʰ", "ԣ": "nʰ", "ԫ": "d͡ʒ", "ԭ": "d͡ʑ",
    "ꚁ": "dʷ", "ꚃ": "d͡ʑʷ", "ꚅ": "ʒʷ", "ꚇ": "t͡ʂʰ", "ꚉ": "d͡z", "ꚋ": "tʰ", "ꚍ": "tʷʰ", "ꚏ": "t͡ɕʷʰ",
    "ꚑ": "t͡sʼ", "ꚓ": "t͡ʃʼ", "ꚕ": "ħʷ", "ꚗ": "ʃʷ",
    // ⟨ъ⟩ hard sign dropped; ⟨ь⟩/⟨ә⟩ handled as modifiers below.
};
const MODIFIER: Record<string, string> = { "ь": "ʲ", "ә": "ʷ", "'": "ˤ" };
// The vowel letters (used for the ⟨у⟩/⟨и⟩ glide-vs-syllabic rule).
const VOWEL_LETTER = new Set([..."аыеоуи"]);

/** One Abkhaz word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // Normalize the curly apostrophe ’ (U+2019) to ASCII ' — the pharyngealizer ⟨х'⟩ (TOKEN admits both, but the
    // CLUSTER/MODIFIER keys use only ASCII '); real typographic Abkhaz text uses the curly form.
    const s = [...word.normalize("NFC").toLowerCase().replace(/’/gu, "'")];
    const out: string[] = [];
    for (let i = 0; i < s.length; i++) {
        const c3 = s.slice(i, i + 3).join("");
        const c2 = s.slice(i, i + 2).join("");
        if (CLUSTER[c3] !== undefined) { out.push(CLUSTER[c3]!); i += 2; continue; } // trigraph (х'ә)
        if (CLUSTER[c2] !== undefined) { out.push(CLUSTER[c2]!); i += 1; continue; } // base + modifier
        const c = s[i]!;
        // ⟨у⟩/⟨и⟩ are underlyingly the GLIDES /w j/: [w]/[j] next to a vowel, syllabic [u]/[i] between consonants /
        // word-finally (аи→aj, аԥсуа→apʰswa; but иҭабуп→itʰabup, амени→ameni).
        if (c === "у" || c === "и") {
            const adjV = (i > 0 && VOWEL_LETTER.has(s[i - 1]!)) || (i + 1 < s.length && VOWEL_LETTER.has(s[i + 1]!));
            out.push(c === "у" ? (adjV ? "w" : "u") : (adjV ? "j" : "i"));
            continue;
        }
        if (BASE[c] !== undefined) {
            let ph = BASE[c]!;
            // A base not in the CLUSTER table + a modifier → append the generic modifier IPA.
            const mod = MODIFIER[s[i + 1] ?? ""];
            if (mod !== undefined) { ph += mod; i++; }
            out.push(ph);
            continue;
        }
        // ⟨ъ ь ә '⟩ standing alone / stray marks: skip
    }
    return out.join("");
}

// Abkhaz Cyrillic (base + extended letters) + the ⟨'⟩ pharyngealizer. Word / number / punctuation.
const TOKEN = /([Ѐ-ӿԀ-ԯꚀ-ꚟꙀ-ꙟ'’]+)|(\d+)|([.?!,;:…])/gu;

class AbkhazPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input.normalize("NFC"), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Abkhaz phonemizer (Cyrillic base+modifier scan; the NW-Caucasian consonant system). */
export function createAbkhaz(): Phonemizer {
    return new AbkhazPhonemizer();
}
