/**
 * Aksara Jawa (Hanacaraka) scanner for Javanese (jv) — the native Brahmic abugida front-end. Scans the script
 * (Unicode U+A980–U+A9DF) into the SAME `Seg[]` the Latin g2p produces, so the shared jv phonology (a→ɔ harmony,
 * closed-syllable laxing, final-⟨k⟩→ʔ, penult stress) in javanese.ts applies unchanged. The abugida model: a base
 * consonant carries an inherent /a/, replaced by a sandhangan vowel sign or suppressed by pangkon (virama); medial
 * signs (cakra -r-, pengkal -y-, keret -rə-) insert a glide/liquid; coda signs (cecak -ŋ, layar -r, wignyan -h)
 * close the syllable; taling + tarung = /o/. Because pepet vs taling and dental vs retroflex are written
 * distinctly, this input is MORE phonemic than the Latin. See docs/jv_native_bringup_investigation.md.
 */
import { loadManifest } from "../../core/loadManifest.ts";
import type { Seg } from "./javanese.ts";

interface AksaraDef {
    consonants: Record<string, string>;
    syllabic: Record<string, string>;
    independentVowels: Record<string, string>;
    vowelSigns: Record<string, string>;
    tarung: string;
    medials: Record<string, string>;
    keret: string;
    codas: Record<string, string>;
    virama: string;
    digits: Record<string, string>;
    pada: Record<string, string>;
}
const DEF = loadManifest<AksaraDef>(import.meta.url, "aksara.jsonc");

/** The vowel LETTER a sound maps to, for the phonology rules (laxing keys on i/u/o, a→ɔ on a; the rest are inert). */
const letterOf = (ph: string): string => ("aiou".includes(ph) ? ph : "e");

/** Any Aksara Jawa word letter (consonant, independent vowel, or syllabic) — for tokenising script runs. */
export const AKSARA_LETTER = /[\u{A984}-\u{A9B2}\u{A9BD}-\u{A9C0}\u{A981}-\u{A983}\u{A9B3}-\u{A9BC}]/u;
export const isAksaraDigit = (ch: string): boolean => DEF.digits[ch] !== undefined;
export const aksaraDigit = (ch: string): string => DEF.digits[ch] ?? "";
export const aksaraPada = (ch: string): string | undefined => DEF.pada[ch];

/** Scan one Aksara Jawa word into phoneme segments (consonant + inherent/sign vowel, medials, codas, virama). */
export function scanAksara(word: string): Seg[] {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    const segs: Seg[] = [];
    const pushC = (ipa: string): void => void segs.push({ ph: ipa, v: "" });
    const pushV = (ph: string): void => void segs.push({ ph, v: letterOf(ph) });
    const codas = (i: number): number => {
        while (i < n && DEF.codas[s[i]!] !== undefined) pushC(DEF.codas[s[i++]!]!);
        return i;
    };

    let i = 0;
    while (i < n) {
        const ch = s[i]!;
        if (DEF.consonants[ch] !== undefined) {
            // The aksara ꦲ "ha" is fundamentally the zero-onset VOWEL CARRIER — its [h] is silent in Javanese
            // (ꦲꦧꦁ = abang not *habang; ꦧꦲꦸ… = bau… not *bahu…). A real /h/ coda is written with wignyan (ꦃ).
            if (ch !== "ꦲ") pushC(DEF.consonants[ch]!);
            i++;
            // Medial signs (cakra/pengkal insert a consonant; keret inserts r + a pepet vowel).
            let keretVowel = false;
            while (i < n && (DEF.medials[s[i]!] !== undefined || s[i] === DEF.keret)) {
                if (s[i] === DEF.keret) {
                    pushC("r");
                    keretVowel = true;
                } else pushC(DEF.medials[s[i]!]!);
                i++;
            }
            // Vowel: pangkon suppresses it; keret already fixed ə; a sign replaces the inherent /a/; else inherent.
            if (keretVowel) pushV("ə");
            else if (s[i] === DEF.virama) i++;
            else if (DEF.vowelSigns[s[i]!] !== undefined) {
                let ph = DEF.vowelSigns[s[i]!]!;
                i++;
                if (ph === "e" && s[i] === DEF.tarung) {
                    ph = "o"; // taling + tarung = /o/
                    i++;
                } else if (s[i] === DEF.tarung) i++; // absorb a trailing tarung
                pushV(ph);
            } else if (s[i] === DEF.tarung) {
                pushV("o");
                i++;
            } else pushV("a"); // inherent vowel
            i = codas(i);
        } else if (DEF.syllabic[ch] !== undefined) {
            pushC(DEF.syllabic[ch]!); // pa-cerek rə / nga-lelet lə
            pushV("ə");
            i++;
            i = codas(i);
        } else if (DEF.independentVowels[ch] !== undefined) {
            pushV(DEF.independentVowels[ch]!);
            i++;
            i = codas(i);
        } else i++; // unknown / stray sign → skip
    }
    return segs;
}
