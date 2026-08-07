/**
 * Native Abkhaz / аҧсуа бызшәа (ab) text phonemizer — canonical IPA
 *
 * Abkhaz is a NORTHWEST CAUCASIAN language (~190k, Abkhazia). It has ONE OF THE LARGEST CONSONANT INVENTORIES in the
 * world (~58, with LABIALIZED, PALATALIZED, PHARYNGEALIZED and EJECTIVE series) and only TWO phonemic vowels (⟨а⟩→[a],
 * ⟨ы⟩→[ə]).
 *
 * The Cyrillic alphabet writes the consonants with base letters + MODIFIER letters:
 *   ⚠ ⟨ь⟩ PALATALIZES to a dorsal+[ʲ] (гь→[ɡʲ], хь→[χʲ]), ⟨ә⟩ LABIALIZES (гә→[ɡʷ], шә→[ʃʷ]), ⟨'⟩ PHARYNGEALIZES (х'→[χˤ]).
 *   ⚠ THREE-WAY stops/affricates — voiced / aspirated / ejective: ⟨г қ к⟩→[ɡ kʰ kʼ], ⟨д ҭ т⟩→[d tʰ tʼ],
 *     ⟨б ҧ п⟩→[b pʰ pʼ], ⟨ӡ ц ҵ⟩→[d͡z t͡sʰ t͡sʼ], ⟨џ ч ҷ⟩→[d͡ʐ t͡ʃʰ t͡ʃʼ]; the uvular ⟨ҟ⟩→[qʼ], the pharyngeal ⟨ҳ⟩→[ħ].
 *
 * Numbers are VIGESIMAL (base-20) and composed by numbers.ts — 30 = ҩажәи жәаба (20+10), 40 = ҩынҩажәа (2×20),
 * 99 = ԥшьынҩажәи зеижә (4×20+19); the NON-HUMAN/abstract class series is used as the bare-numeral citation form.
 *
 * ⚠ THE REFEREE IS PARTLY CIRCULAR. wikipron abk_cyrl and kaikki Abkhaz both cover this language well, but much of
 * what they carry is the letter and digraph DEFINITIONS this engine is built from — so agreement with them is close
 * to reference-parity rather than independent confirmation. Their narrow transcriptions are also internally
 * inconsistent, which is why the tables below follow the corpus where the two disagree.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface AbkhazDef {
    clusters: Record<string, string>;
    base: Record<string, string>;
    modifiers: Record<string, string>;
}
const DEF = loadManifest<AbkhazDef>(import.meta.url, "abkhaz.jsonc");
// Letter tables (abkhaz.jsonc): base+modifier clusters, base letters, and the generic modifier fallbacks.
const CLUSTER = DEF.clusters;
const BASE = DEF.base;
const MODIFIER = DEF.modifiers;
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
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Abkhaz phonemizer (Cyrillic base+modifier scan; the NW-Caucasian consonant system). */
export function createAbkhaz(): Phonemizer {
    return new AbkhazPhonemizer();
}
