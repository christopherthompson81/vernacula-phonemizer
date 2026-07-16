/**
 * Urdu (ur) grapheme→phoneme engine — Perso-Arabic abjad → canonical IPA (Hindi phoneme inventory). Urdu is
 * stored in logical order = phonetic order, so RTL is a non-issue (as for Arabic). Handles: consonant letters,
 * aspiration (C + ھ → Cʰ/Cʱ), long vowels written with ا/آ/و/ی/ے, short vowels from harakat WHEN present,
 * shadda gemination, ں nasalization, and — for the usual undiacritized text — a DEFAULT short vowel [ə]
 * between consonants (the crude stand-in for the deferred short-vowel-restoration subsystem).
 */
import { loadManifest } from "../../core/loadManifest.ts";

interface UrduDef {
    consonants: Record<string, string>;
    aspirateHe: string;
    aspirates: Record<string, string>;
    longVowels: Record<string, string>;
    glides: Record<string, string>;
    harakat: Record<string, string>;
    sukun: string;
    shadda: string;
    nasalizers: string[];
    inherentVowel: string;
}

const DEF = loadManifest<UrduDef>(import.meta.url, "urdu.jsonc");
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

const isVowelPh = (ph: string): boolean => /[əaɑɪiʊueoɛɔ]/.test(ph);
/** True when the output so far ENDS in a vowel (ignoring a trailing length ː / nasal ̃). */
const endsInVowel = (out: string): boolean => /[əaɑɪiʊueoɛɔ]ː?̃?$/u.test(out);

/** A short-vowel letter/glide that, standing alone, is a syllable nucleus rather than a consonant. */
function longVowelAfterConsonant(ch: string): string | undefined {
    if (ch === ALIF || ch === ALIF_MADDA) return "ɑː";
    if (ch === WAW) return "oː";
    if (ch === YA) return "iː";
    if (ch === BARI_YE) return "eː";
    return undefined;
}

/** Urdu word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const s = [...word.normalize("NFC")];
    const n = s.length;
    let out = "";
    let i = 0;

    // Word-initial vowel carrier (alif): آ→ɑː; ا+و→oː, ا+ی→eː, ا+ے→eː; bare ا → short ə carrier.
    if (s[0] === ALIF_MADDA) {
        out += "ɑː";
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
        // Word-final ہ after a consonant realizes as the [ɑ] vowel (بارہ→bɑːɾɑ, آئینہ→ɑːiːnɑ); elsewhere it is [ɦ].
        if (ch === HE_GOL) {
            const atEnd = i === n - 1;
            if (atEnd && out && !endsInVowel(out)) out += "ɑ";
            else out += "ɦ";
            i++;
            continue;
        }
        // Hamza seats ئ/ؤ carry a vowel in hiatus (بھائی→bʱɑːiː, کوئی→koːiː): emit the vowel and absorb a
        // directly-following ی/و (ئی = one iː). ء (bare hamza) → glottal/hiatus, skipped in the coda.
        if (ch === "ئ" || ch === "ؤ") {
            out += ch === "ئ" ? "iː" : "oː";
            i++;
            if ((ch === "ئ" && s[i] === YA) || (ch === "ؤ" && s[i] === WAW)) i++;
            continue;
        }
        // Standalone glide/vowel letters after a vowel (hiatus) → glide; after a consonant → long vowel.
        if (ch === WAW || ch === YA || ch === BARI_YE || ch === ALIF || ch === ALIF_MADDA) {
            const prevVowel = endsInVowel(out);
            if (ch === BARI_YE) out += "eː";
            else if (prevVowel) out += ch === WAW ? "ʋ" : ch === YA ? "j" : ch === ALIF || ch === ALIF_MADDA ? "ɑː" : "";
            else out += longVowelAfterConsonant(ch) ?? "";
            i++;
            continue;
        }
        // Consonant.
        if (ch in C) {
            let ph = C[ch]!;
            i++;
            // Aspiration: C + ھ → aspirated (only for aspirable consonants; else ھ is a plain [ɦ]).
            if (s[i] === HE && ASP[ph]) {
                ph = ASP[ph]!;
                i++;
            }
            // Shadda → gemination (length on the consonant).
            if (s[i] === DEF.shadda) {
                ph += "ː";
                i++;
            }
            out += ph;
            // Vowel after the consonant.
            const hk = s[i] !== undefined ? HARAKAT[s[i]!] : undefined;
            if (s[i] === DEF.sukun) {
                i++; // explicit no-vowel
            } else if (hk !== undefined) {
                // An EXPLICITLY-WRITTEN fatḥa (= /ə/) must survive medial schwa-deletion, which only elides the
                // g2p's UNwritten default schwa. Mark it (ə + U+0332) so deleteMedialSchwa (targets bare "ə") skips
                // it; urdu.ts strips the mark. Without this, a written vowel gets deleted and no vocalization can
                // reproduce e.g. کَرَنو → kəɾənoː (the cap on inversion for tri-consonantal words).
                out += hk === "ə" ? "ə̲" : hk;
                i++;
                // harakat + a matching long-vowel letter lengthens to the HIGH long vowel: kasra+ی→iː, damma+و→uː
                // (the explicit diacritic pins the letter — bare ی/و default to iː/oː; damma+waw = uː, e.g. آلُو ɑːluː,
                // آرزُو ɑːrzuː). Without this, medial و can only surface as oː and no vocalization reaches the ū words.
                if ((hk === "ɪ" && s[i] === YA) || (hk === "ʊ" && s[i] === WAW)) {
                    out = out.slice(0, -hk.length) + (s[i] === YA ? "iː" : "uː");
                    i++;
                }
            } else {
                // ی/و before ANOTHER vowel letter is a glide (دنیا→d̪ʊnjɑ, not d̪əniːɑ), not a long vowel.
                const glideNext =
                    (s[i] === YA || s[i] === WAW) &&
                    longVowelAfterConsonant(s[i + 1] ?? "") !== undefined;
                const lv = glideNext ? undefined : longVowelAfterConsonant(s[i] ?? "");
                if (lv !== undefined) {
                    // یَ (ya + fatḥa) → eː in our ADAPTED-WORD convention (bare ی = iː). The diacritic encodes the
                    // iː/eː distinction standard harakat lacks — the g2p reads it and the model learns which words
                    // take it, exactly as damma+waw encodes uː. Output is a diacritized word in OUR scheme.
                    if (s[i] === YA && s[i + 1] === "َ") { out += "eː"; i += 2; }
                    else { out += lv; i++; }
                } else if (glideNext) {
                    out += s[i] === YA ? "j" : "ʋ"; // glide; the following vowel letter provides the nucleus
                    i++;
                } else if (
                    i < n &&
                    !NASAL.has(s[i]!) &&
                    !(s[i] === HE_GOL && i === n - 1) // word-final ہ is the [ɑ] vowel, not a coda needing ə
                ) {
                    // No written vowel and more letters follow → the abjad's omitted SHORT vowel: default [ə].
                    out += INH;
                }
                // word-final consonant with no written vowel → no vowel (skeleton coda).
            }
            continue;
        }
        // hamza carriers / unknown diacritic → skip.
        i++;
    }
    return out.normalize("NFC");
}
