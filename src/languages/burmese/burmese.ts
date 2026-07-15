/**
 * Native Burmese / မြန်မာ (my) text phonemizer — canonical IPA, espeak-independent. Sino-Tibetan, the Mon-Burmese
 * abugida (Unicode U+1000–U+109F), stored in LOGICAL order (consonant-first). The g2p scans each syllable:
 * base consonant → optional MEDIALS (ျ/ြ palatalise velars ကျ→t͡ɕ, ွ adds -w-, ှ devoices sonorants မှ→m̥) →
 * the RIME, whose vowel quality depends on the CODA — open, NASAL (killed ŋ/ɲ/n/m or anusvara ံ → ɴ) or CHECKED
 * (killed k/s/t/p → ʔ): -i open→i, nasal→ɪɴ, checked→ɪʔ. Phase 1: SEGMENTAL — the four tones (low/high/creaky/
 * checked) are DEFERRED (the referee's tone diacritics fold in the shared backbone). See docs/my_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { clauseSink } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface BurmeseDef {
    consonants: Record<string, string>;
    independentVowels: Record<string, string>;
    vowelSigns: Record<string, string>;
    codaClass: Record<string, string>;
    rimeChart: Record<string, Record<string, string>>;
    voiceless: Record<string, string>;
    palatal: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<BurmeseDef>(import.meta.url, "burmese.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const VIRAMA = "်", // asat (kills the consonant → coda)
    ANUSVARA = "ံ",
    MEDIAL_Y = "ျ", MEDIAL_R = "ြ", MEDIAL_W = "ွ", MEDIAL_H = "ှ",
    E_SIGN = "ေ", AA_SIGN = "ာ", II_SIGN = "ိ", U_SIGN = "ု";
const isConsonant = (c: string): boolean => DEF.consonants[c] !== undefined;

/** Scan a Burmese word into IPA (per orthographic syllable; tones deferred). */
export function phonemizeWord(word: string): string {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    let out = "";
    let i = 0;

    while (i < n) {
        const ch = s[i]!;
        if (DEF.independentVowels[ch] !== undefined) {
            out += DEF.independentVowels[ch];
            i++;
            continue;
        }
        if (!isConsonant(ch)) {
            i++; // punctuation handled by text(); stray sign → skip
            continue;
        }
        // Stacked consonant: a consonant directly before the virama-stacker ္ (U+1039) is the silent upper member
        // of a Pali/Sanskrit conjunct (ကမ္ဘာ → the မ is silent, ဘ is the onset) — skip it and the stacker.
        if (s[i + 1] === "္") {
            i += 2;
            continue;
        }
        // Onset consonant.
        let onset = DEF.consonants[ch]!;
        i++;
        // Medials: ျ/ြ palatalise (velars → t͡ɕ) else add -j-; ွ labialises; ှ devoices the sonorant.
        let glide = "";
        let wMedial = false;
        while (i < n && [MEDIAL_Y, MEDIAL_R, MEDIAL_W, MEDIAL_H].includes(s[i]!)) {
            if (s[i] === MEDIAL_Y || s[i] === MEDIAL_R)
                onset = DEF.palatal[onset] ?? onset + "j";
            else if (s[i] === MEDIAL_W) wMedial = true;
            else if (s[i] === MEDIAL_H) onset = DEF.voiceless[onset] ?? onset;
            i++;
        }
        // Vowel signs → an abstract vowel KEY. Combos: ိ+ု = o, ေ+ာ = au (else the last sign, or inherent).
        const signs: string[] = [];
        while (i < n && DEF.vowelSigns[s[i]!] !== undefined) {
            signs.push(s[i]!);
            i++;
        }
        const has = (x: string): boolean => signs.includes(x);
        let vowel = "inherent";
        if (has(II_SIGN) && has(U_SIGN)) vowel = "o"; // ို
        else if (has(E_SIGN) && has(AA_SIGN)) vowel = "au"; // ⣟ော
        else if (signs.length) vowel = DEF.vowelSigns[signs[signs.length - 1]!]!;
        // The ⟨ွ⟩ medial with no vowel sign is the /u/ nucleus (ကွန်→kʊɴ/koʊɴ); with a vowel sign it's a -w- glide.
        // A /w/ onset (ဝ) or the ⟨ွ⟩ medial rounds the inherent-vowel rime (ဝန်→wʊɴ, ကွန်→kʊɴ); with a vowel
        // sign, ⟨ွ⟩ is a plain -w- glide.
        if (wMedial && vowel !== "inherent") glide = "w";
        if (vowel === "inherent" && (wMedial || onset === "w")) vowel = "wu";
        // Coda class: anusvara ံ (nasal 'anu'), a killed consonant (base + ်) → its class, else open.
        let coda = "open";
        if (s[i] === ANUSVARA) {
            coda = "anu";
            i++;
        } else if (isConsonant(s[i] ?? "") && s[i + 1] === VIRAMA) {
            coda = DEF.codaClass[s[i]!] ?? "t";
            i += 2;
        }
        // (An asat ် directly on a vowel — e.g. ော် — is a TONE/creaky marker, NOT a checked coda: ကျော်→t͡ɕɔ.)
        // Skip tone marks (visarga း, dot-below ့) and any stray combining sign — tones are Phase 2.
        while (i < n && !isConsonant(s[i]!) && DEF.independentVowels[s[i]!] === undefined && !CLAUSE_MARK[s[i]!])
            i++;

        // A bare open syllable (inherent vowel, no coda) that is NOT word-final is a MINOR syllable → reduced [ə].
        const minor =
            vowel === "inherent" && coda === "open" && i < n && isConsonant(s[i]!);
        const rime = minor
            ? "ə"
            : (DEF.rimeChart[coda]?.[vowel] ?? DEF.rimeChart["open"]![vowel] ?? "a");
        out += onset + glide + rime;
    }
    return out.normalize("NFC");
}

const TOKEN = /([က-႟꧰-꧹]+)|(\d+)|([။၊.?!,])/gu;

export type ForeignPhonemizer = (latin: string) => string;

class BurmesePhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        const { sink, finish } = clauseSink();
        let m: RegExpExecArray | null;
        const tok = new RegExp(TOKEN.source, "gu");
        while ((m = tok.exec(input))) {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : m[2]);
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        }
        void this.foreign;
        return finish();
    }
}

/** Build the Burmese phonemizer. */
export function createBurmese(foreign?: ForeignPhonemizer): Phonemizer {
    return new BurmesePhonemizer(foreign);
}
