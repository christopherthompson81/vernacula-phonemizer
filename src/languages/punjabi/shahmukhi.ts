/**
 * Shahmukhi (Perso-Arabic) scanner for Punjabi (pa) — the native abjad front-end used in Pakistan (Gurmukhi is
 * used in India). Scans the script into the SAME raw canonical IPA the Gurmukhi abugida (core/abugida.ts) emits,
 * so the shared Punjabi phonology in punjabi.ts (gemination → length, inherent-schwa deletion, TONOGENESIS, weight
 * stress) applies UNCHANGED — one phonology, two scripts (the Aksara-Jawa pattern). Stored in logical order =
 * phonetic order, so RTL is a non-issue (as for Urdu/Arabic).
 *
 * The tonal crux carries through: the historical voiced-aspirate digraphs بھ گھ دھ ڈھ جھ emit the breathy MARKERS
 * bʱ/ɡʱ/d̪ʱ/ɖʱ/d͡ʒʱ, which punjabi.ts's tonogenesis de-aspirates + tones. Because the abjad omits short vowels, a
 * DEFAULT [ə] stands in between consonants (the shared restoration gap, as for Urdu). See shahmukhi.jsonc.
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface ShahmukhiDef {
    consonants: Record<string, string>;
    aspirateHe: string;
    aspirates: Record<string, string>;
    longVowels: Record<string, string>;
    harakat: Record<string, string>;
    sukun: string;
    shadda: string;
    nasalizers: string[];
    inherentVowel: string;
    digits: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

const DEF = loadManifest<ShahmukhiDef>(import.meta.url, "shahmukhi.jsonc");
const C = DEF.consonants;
const HE = DEF.aspirateHe;
const ASP = DEF.aspirates;
const HARAKAT = DEF.harakat;
const NASAL = new Set(DEF.nasalizers);
const INH = DEF.inherentVowel;
const ALIF = "ا",
    ALIF_MADDA = "آ",
    WAW = "و",
    YA = "ی",
    BARI_YE = "ے",
    HE_GOL = "ہ";

/** Any Shahmukhi word letter — Arabic block + Arabic Supplement (ݨ) + Arabic Extended-A (ࣇ). For tokenising. */
export const SHAHMUKHI_CLASS = "\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF";
export const SHAHMUKHI_WORD = new RegExp(`[${SHAHMUKHI_CLASS}]`, "u");
export const shahmukhiDigit = (ch: string): string | undefined => DEF.digits[ch];
export const shahmukhiPause = (ch: string): string | undefined =>
    DEF.clausePunctuation[ch];

const endsInVowel = (out: string): boolean => /[əaɑɪiʊueoɛɔ]ː?̃?$/u.test(out);

/** A vowel/glide letter that, standing alone after a consonant, is the syllable nucleus (long vowel). */
function longVowelAfterConsonant(ch: string): string | undefined {
    if (ch === ALIF || ch === ALIF_MADDA) return "aː";
    return ch === WAW || ch === YA || ch === BARI_YE ? DEF.longVowels[ch] : undefined;
}

/** Scan one Shahmukhi word into raw canonical Punjabi IPA (breathy markers, doubled geminates, inherent schwas)
 *  — the SAME shape the Gurmukhi g2p emits, for punjabi.ts's shared post-processing. */
export function scanShahmukhi(word: string): string {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    let out = "";
    let i = 0;

    // Word-initial vowel carrier (alif): آ→aː; ا+و→oː, ا+ی/ے→eː; bare ا → short ə carrier.
    if (s[0] === ALIF_MADDA) {
        out += "aː";
        i = 1;
    } else if (s[0] === ALIF) {
        if (s[1] === WAW) {
            out += "oː";
            i = 2;
        } else if (s[1] === YA || s[1] === BARI_YE) {
            out += "eː";
            i = 2;
        } else {
            out += "ə";
            i = 1;
        }
    }

    while (i < n) {
        const ch = s[i]!;
        // Nasalizer → nasalize the preceding vowel.
        if (NASAL.has(ch)) {
            if (!/̃$/.test(out) && endsInVowel(out)) out += "̃";
            i++;
            continue;
        }
        // Word-final گول ہ after a consonant realizes as the final [aː] vowel (the -ā ending); elsewhere it is [ɦ]
        // (Punjabi keeps ɦ — the intervocalic-ہ → tone merger is deferred, as on the Gurmukhi side).
        if (ch === HE_GOL) {
            if (i === n - 1 && out && !endsInVowel(out)) out += "aː";
            else out += "ɦ";
            i++;
            continue;
        }
        // Hamza seats carry a vowel in hiatus; ئ→iː, ؤ→oː, absorbing a directly-following ی/و.
        if (ch === "ئ" || ch === "ؤ") {
            out += ch === "ئ" ? "iː" : "oː";
            i++;
            if ((ch === "ئ" && s[i] === YA) || (ch === "ؤ" && s[i] === WAW)) i++;
            continue;
        }
        // Post-vocalic و/ی → glide (کوئی→koːiː's hiatus); after a consonant → the long-vowel nucleus (بو→boː);
        // ے (bari ye) → /eː/; medial ا → aː. Word-INITIAL و/ی fall through to the consonant branch (a consonant
        // glide that carries an inherent vowel: وڈّا→ʋəɖːaː, یار→jaːɾ), so the vowel-after logic applies.
        const postVocGlide = (ch === WAW || ch === YA) && out !== "";
        if (postVocGlide || ch === BARI_YE || ch === ALIF || ch === ALIF_MADDA) {
            if (ch === BARI_YE) out += "eː";
            else if (endsInVowel(out)) out += ch === WAW ? "ʋ" : ch === YA ? "j" : "aː";
            else out += longVowelAfterConsonant(ch) ?? "aː";
            i++;
            continue;
        }
        // Consonant (incl. a word-initial و/ی consonant glide).
        if (ch in C || ch === WAW || ch === YA) {
            let ph = C[ch] ?? (ch === WAW ? "ʋ" : "j");
            i++;
            // Aspiration: C + ھ → aspirated / breathy (only aspirable consonants; else ھ is a plain [ɦ]).
            if (s[i] === HE && ASP[ph]) {
                ph = ASP[ph]!;
                i++;
            }
            // Shadda → gemination: double the consonant (→ length in the shared reorder, as Gurmukhi addak).
            if (s[i] === DEF.shadda) {
                ph += ph;
                i++;
            }
            out += ph;
            // Vowel after the consonant.
            const hk = s[i] !== undefined ? HARAKAT[s[i]!] : undefined;
            if (s[i] === DEF.sukun) {
                i++; // explicit no-vowel
            } else if (hk !== undefined) {
                out += hk;
                i++;
                // harakat + a matching long-vowel letter lengthens to the HIGH long vowel: kasra+ی→iː, damma+و→uː
                // (the explicit diacritic disambiguates the letter — bare ی/و default to iː/oː; damma+waw pins uː,
                // e.g. Urdu/Punjabi پُورا pūrā). This is the diacritic the Gurmukhi sister-script supplies as gold.
                if ((hk === "ɪ" && s[i] === YA) || (hk === "ʊ" && s[i] === WAW)) {
                    out = out.slice(0, -hk.length) + (s[i] === YA ? "iː" : "uː");
                    i++;
                }
            } else {
                // ی/و before ANOTHER vowel letter is a glide (نیا→nəjaː), not a long vowel.
                const glideNext =
                    (s[i] === YA || s[i] === WAW) &&
                    longVowelAfterConsonant(s[i + 1] ?? "") !== undefined;
                const lv = glideNext ? undefined : longVowelAfterConsonant(s[i] ?? "");
                if (lv !== undefined) {
                    out += lv;
                    i++;
                } else if (glideNext) {
                    out += s[i] === YA ? "j" : "ʋ"; // glide; the following letter is the nucleus
                    i++;
                } else if (
                    i < n &&
                    !NASAL.has(s[i]!) &&
                    !(s[i] === HE_GOL && i === n - 1) // word-final ہ is the [aː] vowel, not a coda needing ə
                ) {
                    out += INH; // no written vowel, more letters follow → the abjad's omitted SHORT vowel: [ə]
                }
                // word-final consonant with no written vowel → no vowel (skeleton coda).
            }
            continue;
        }
        // hamza / unknown diacritic → skip.
        i++;
    }
    return out.normalize("NFC");
}
