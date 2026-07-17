/**
 * Native Yoruba / Èdè Yorùbá (yo) text phonemizer — canonical IPA, espeak-independent. Volta-Niger (Niger-Congo),
 * a highly PHONEMIC three-tone Latin orthography, so a near one-to-one rule-based g2p. Signature features: the
 * labial-velars ⟨gb⟩→ɡ͡b / ⟨p⟩→k͡p (no plain /p/), ⟨j⟩→d͡ʒ, ⟨ṣ⟩→ʃ, ⟨r⟩→ɾ; the dotted-below vowels ẹ→ɛ ọ→ɔ; NASAL
 * vowels from a coda ⟨n⟩ (ọn→ɔ̃; an onset n before a vowel stays n); syllabic nasals m̩/n̩; and THREE level tones
 * on each vowel/syllabic nasal — High=acute ˥, Mid=unmarked ˧, Low=grave ˩ (Chao letters). Ported from the
 * espeak-ng-portable authoring (epitran-validated). See docs/investigations/yo_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface YorubaDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    tones: { high: string; mid: string; low: string };
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<YorubaDef>(import.meta.url, "yoruba.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const DOT_BELOW = "̣", ACUTE = "́", GRAVE = "̀", MACRON = "̄";
const TONE_MARK = new Set([ACUTE, GRAVE, MACRON]);
const isVowelLetter = (c: string): boolean => "aeiou".includes(c);

interface Seg {
    ph: string;
    tone?: string; // Chao letter for a nucleus (vowel or syllabic nasal); undefined for a plain consonant
    nasal?: boolean; // a coda-n nasalises the vowel
}

/** One Yoruba word → canonical IPA (segments + level tones). */
export function phonemizeWord(word: string): string {
    const s = [...word.toLowerCase().normalize("NFD")];
    const n = s.length;
    const segs: Seg[] = [];
    const lastNucleus = (): Seg | undefined => {
        for (let k = segs.length - 1; k >= 0; k--)
            if (segs[k]!.tone !== undefined) return segs[k]!;
        return undefined;
    };

    for (let i = 0; i < n; ) {
        const c = s[i]!;
        // Base vowel + its combining marks (dot-below → ẹ/ọ, tone accent).
        if (isVowelLetter(c)) {
            let ipa = DEF.vowels[c]!;
            let tone = DEF.tones.mid;
            let dot = false;
            i++;
            while (i < n && (s[i] === DOT_BELOW || TONE_MARK.has(s[i]!))) {
                if (s[i] === DOT_BELOW) dot = true;
                else if (s[i] === ACUTE) tone = DEF.tones.high;
                else if (s[i] === GRAVE) tone = DEF.tones.low;
                i++;
            }
            if (dot) ipa = c === "e" ? "ɛ" : c === "o" ? "ɔ" : ipa;
            segs.push({ ph: ipa, tone });
            continue;
        }
        // ⟨n⟩: syllabic n̩ (before a tone mark), onset n (before a vowel), else a coda that nasalises the vowel.
        if (c === "n") {
            const nx = s[i + 1];
            if (nx !== undefined && TONE_MARK.has(nx)) {
                segs.push({ ph: "n̩", tone: nx === ACUTE ? DEF.tones.high : nx === GRAVE ? DEF.tones.low : DEF.tones.mid });
                i += 2;
            } else if (nx !== undefined && isVowelLetter(nx)) {
                segs.push({ ph: "n" }); // onset
                i++;
            } else {
                const v = lastNucleus();
                if (v) v.nasal = true; // coda → nasalise the preceding vowel
                i++;
            }
            continue;
        }
        // ⟨m⟩: syllabic m̩ before a tone mark, else a plain onset m.
        if (c === "m") {
            const nx = s[i + 1];
            if (nx !== undefined && TONE_MARK.has(nx)) {
                segs.push({ ph: "m̩", tone: nx === ACUTE ? DEF.tones.high : nx === GRAVE ? DEF.tones.low : DEF.tones.mid });
                i += 2;
            } else {
                segs.push({ ph: "m" });
                i++;
            }
            continue;
        }
        // ⟨gb⟩ digraph → ɡ͡b; ⟨gh⟩ → ɣ (dialectal / loan grapheme).
        if (c === "g" && s[i + 1] === "b") {
            segs.push({ ph: DEF.consonants["gb"]! });
            i += 2;
            continue;
        }
        if (c === "g" && s[i + 1] === "h") {
            segs.push({ ph: "ɣ" });
            i += 2;
            continue;
        }
        // ⟨w⟩ after a consonant onset, before a vowel → labialisation on that consonant (ẹgwa→ɛɡʷa).
        if (
            c === "w" &&
            segs.length > 0 &&
            segs[segs.length - 1]!.tone === undefined &&
            isVowelLetter(s[i + 1] ?? "")
        ) {
            segs[segs.length - 1]!.ph += "ʷ";
            i++;
            continue;
        }
        // ⟨s⟩ + dot-below → ʃ (ṣ).
        if (c === "s") {
            if (s[i + 1] === DOT_BELOW) {
                segs.push({ ph: "ʃ" });
                i += 2;
            } else {
                segs.push({ ph: "s" });
                i++;
            }
            continue;
        }
        if (c in DEF.consonants) {
            segs.push({ ph: DEF.consonants[c]! });
            i++;
            continue;
        }
        i++; // unknown / stray mark → skip
    }

    let out = "";
    for (const sg of segs)
        out += sg.tone !== undefined ? sg.ph + (sg.nasal ? "̃" : "") + sg.tone : sg.ph;
    return out.normalize("NFC");
}

// A Yoruba word = Latin letters (incl. precomposed accented + dotted) plus any combining marks.
const TOKEN = /([A-Za-zÀ-ɏḀ-ỿ̀-ͯ]+)|(\d+)|([.?!,;:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

class YorubaPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : m[2]);
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Yoruba phonemizer. */
export function createYoruba(foreign?: ForeignPhonemizer): Phonemizer {
    return new YorubaPhonemizer(foreign);
}
