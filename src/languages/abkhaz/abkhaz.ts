/**
 * Abkhaz (ab) phonemizer — canonical IPA. A longest-match scan over base+modifier Cyrillic: trigraph, then
 * base+modifier cluster, then base, with the ⟨у⟩/⟨и⟩ glide-vs-syllabic split handled here. Numbers are
 * VIGESIMAL and composed by numbers.ts. The letter tables, the vowel-letter set and the encyclopedic record
 * (the NW-Caucasian consonant system, the modifier letters, the referee-circularity caveat) live in
 * abkhaz.jsonc.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeAbkhaz } from "./normalize.ts";
import { numberToWords } from "./numbers.ts";

// Letter tables (abkhaz.jsonc): base+modifier clusters, base letters, and the generic modifier fallbacks.
const CLUSTER = MANIFEST.clusters;
const BASE = MANIFEST.base;
const MODIFIER = MANIFEST.modifiers;
// The vowel letters (abkhaz.jsonc) — the environment for the ⟨у⟩/⟨и⟩ glide-vs-syllabic rule below.
const VOWEL_LETTER = new Set(MANIFEST.vowelLetters);

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
            // ⚠ THE LEFT CONTEXT IS THE REALIZED PHONE, NOT THE LETTER. A first pass keyed both sides on
            // the LETTER set (у/и count as vowels), so any glide RUN came out nucleus-free: ⟨уу⟩ was
            // as[ww]ari, and patching only the identical-twin case left ⟨ауу⟩ → a[ww] and ⟨иу⟩ → [jw]
            // (адиуан read adjwan where the referee has adiwan). The rule that survives all of these:
            //   · LEFT: does the PREVIOUS EMITTED phone end in a vowel? (a realized glide is a consonant)
            //   · RIGHT: a vowel LETTER that is not itself ⟨у⟩/⟨и⟩ — an undecided glide is no context.
            // So a run alternates from its anchor: асууари→asuwari (referee asuwarij — its final j is the
            // referee's phonemic i=əj tail), адиуан→adiwan (=referee), ауу→awu, иаиууа→jajuwa.
            const leftV = /[aeiouə]$/u.test(out[out.length - 1] ?? "");
            const nxt = s[i + 1];
            const rightV = nxt !== undefined && nxt !== "у" && nxt !== "и" && VOWEL_LETTER.has(nxt);
            const adjV = leftV || rightV;
            out.push(c === "у" ? (adjV ? "w" : "u") : (adjV ? "j" : "i"));
            continue;
        }
        if (BASE[c] !== undefined) {
            let ph = BASE[c]!;
            // A base not in the CLUSTER table + a modifier → append the generic modifier IPA.
            // ⚠ NOT TWICE: ⟨ҩ⟩ is [ɥˤ] with the pharyngealizer already in the base value, so ⟨ҩ'⟩ must
            // consume the apostrophe WITHOUT appending — ɥˤˤ is not IPA.
            const mod = MODIFIER[s[i + 1] ?? ""];
            if (mod !== undefined) { if (!ph.endsWith(mod)) ph += mod; i++; }
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
        // ⚠ NORMALIZE BEFORE TOKENIZING — the layer's whole job is to turn what is not a word into words
        // the scan below can read, so it must run while the digits, dashes and dots are still there.
        return assembleClauses(normalizeAbkhaz(input.normalize("NFC")), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2]), m[2]).split(" "))
                    sink.emit(phonemizeWord(wd));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Abkhaz phonemizer (Cyrillic base+modifier scan; the NW-Caucasian consonant system). */
export function createAbkhaz(): Phonemizer {
    return new AbkhazPhonemizer();
}
