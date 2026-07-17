/**
 * Native Sindhi (sd) text phonemizer — canonical IPA, espeak-independent. Perso-Arabic (Sindhi) ABJAD → the
 * consonant + LONG-vowel skeleton (incl. the signature IMPLOSIVES ٻɓ ڏɗ ڄʄ ڳɠ and the retroflex series) via a
 * rule g2p; SHORT vowels are usually UNWRITTEN, so a default [ə] stands in (the abjad wall, as for Urdu — folded in
 * the referee eval). ھ aspirates the sonorants + ج/گ (جھ→d͡ʒʰ); و/ي are long vowels after a consonant, glides
 * elsewhere. See docs/sd_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface SindhiDef {
    consonants: Record<string, string>;
    aspirateWithHe: Record<string, string>;
    longVowels: Record<string, string>;
    glides: Record<string, string>;
    harakat: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<SindhiDef>(import.meta.url, "sindhi.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

export type ForeignPhonemizer = (latin: string) => string;

const HE = "ھ";
const NOON_GHUNNA = "ں"; // nasalization
const isConsonant = (c: string): boolean => c in DEF.consonants;
const isVowelLetter = (c: string): boolean => c in DEF.longVowels;

/** Scan a Sindhi (Perso-Arabic) word → IPA. Consonants + long vowels are recoverable; short vowels default to [ə]. */
function scan(word: string): string {
    const s = [...word];
    const out: string[] = [];
    let prevNucleus = false; // was the last emitted unit a vowel nucleus?
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        // harakat → explicit short vowel
        if (DEF.harakat[c]) {
            out.push(DEF.harakat[c]!);
            prevNucleus = true;
            i++;
            continue;
        }
        // ں → nasalize the preceding vowel
        if (c === NOON_GHUNNA) {
            if (prevNucleus) out[out.length - 1] += "̃";
            i++;
            continue;
        }
        // long-vowel / glide letters: a long vowel after a consonant, a glide word-initially or in hiatus
        if (isVowelLetter(c)) {
            if (out.length === 0) {
                // word-initial vowel carrier: آ (madda) is [aː]; bare ا is a short [ə] carrier; و/ي → glide
                out.push(c === "آ" ? "aː" : c === "ا" ? "ə" : (DEF.glides[c] ?? DEF.longVowels[c]!));
                prevNucleus = c === "و" || c === "ي" || c === "ی" || c === "ے" ? false : true;
            } else if (prevNucleus) {
                out.push(DEF.glides[c] ?? DEF.longVowels[c]!);
                prevNucleus = false;
            } else {
                out.push(DEF.longVowels[c]!);
                prevNucleus = true;
            }
            i++;
            continue;
        }
        // ئ/ؤ are hamza SEATS (not a glottal stop): they carry a hiatus vowel — emit nothing but break the glide so
        // a following ي/و is read as a full vowel (آئينو→aːiːnoː, not aːjnoː).
        if (c === "ئ" || c === "ؤ") {
            prevNucleus = false;
            i++;
            continue;
        }
        // ع is usually SILENT / a vowel modifier in Sindhi (تعليم→t̪əliːm), not a full [ʔ] — skip it.
        if (c === "ع") {
            i++;
            continue;
        }
        // word-final ه/ہ/ح is a silent vowel-carrier (ٻه→ɓə, روح→ruh→ru), not [h]
        if ((c === "ه" || c === "ہ" || c === "ح") && i === s.length - 1) {
            i++;
            continue;
        }
        // consonants; ھ OR ه after ج/گ/a sonorant → aspiration (Sindhi uses both do-chashmi ھ and ه)
        if (isConsonant(c)) {
            if ((s[i + 1] === HE || s[i + 1] === "ه") && DEF.aspirateWithHe[c]) {
                out.push(DEF.aspirateWithHe[c]!);
                i += 2;
            } else {
                out.push(DEF.consonants[c]!);
                i++;
            }
            prevNucleus = false;
            // insert a default short [ə] when no vowel is written before the next consonant / word-end (abjad).
            const nx = s[i] ?? "";
            if (nx === "" || (isConsonant(nx) && !(nx === HE))) {
                out.push("ə");
                prevNucleus = true;
            }
            continue;
        }
        i++; // unknown → skip
    }
    return out.join("");
}

/** One Sindhi word → canonical IPA. */
export function phonemizeWord(word: string): string {
    // homorganic nasal assimilation, across the unwritten short vowel (n·ə·C): before a velar → ŋ (انگ→əŋɡ),
    // labial → m (انب→əmb), retroflex → ɳ (آنڊو→aːɳɖo), palatal → ɲ (پنج→pəɲd͡ʒ).
    return scan(word)
        .replace(/n(?=ə?(?:kʰ|[kɡxɠ]))/gu, "ŋ")
        .replace(/n(?=ə?[bpɓ])/gu, "m")
        .replace(/n(?=ə?[ʈɖɳɽ])/gu, "ɳ")
        .replace(/n(?=ə?(?:d͡ʒ|t͡ʃ|ʄ))/gu, "ɲ")
        .normalize("NFC");
}

const SD_WORD = "ء-ٟٮ-ۿ";
const TOKEN = new RegExp(`([${SD_WORD}]+)|(\\d+)|([۔؟،؛.?,])`, "gu");

class SindhiPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : "");
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Sindhi phonemizer. */
export function createSindhi(): Phonemizer {
    return new SindhiPhonemizer();
}
