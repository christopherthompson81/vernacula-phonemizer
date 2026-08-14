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

/**
 * ARABIC-KEYBOARD LETTERFORMS AND THE ARABIC-LOANWORD SPELLINGS → their Shahmukhi equivalents.
 *
 * ⚠ EVERY ROW HERE IS A CHARACTER `silentCharsIn` CAUGHT PRODUCING NOTHING, and every one of them is an
 * ENCODING or SPELLING variant of a letter this scanner already reads — not a sound it has no rule for. Left
 * unfolded they matched no branch of the scan below and were skipped in silence:
 *
 *     pnb  ⟨ى⟩ U+0649 ×34   عوامى → əʋˈaːm, آبادى → aːbˈaːd̪, ذاتى → zˈaːt̪  — the final /iː/ of every
 *                           ـی-ending adjective, gone, because the writer typed the ARABIC alif maqṣūra
 *     skr  ⟨ك⟩ U+0643 ×5    شاكر → ʃˈaːɾ — the /k/ deleted outright (ک U+06A9 is the Shahmukhi kāf)
 *     skr  ⟨أ⟩ U+0623 ×8    أکثر → kˈəsəɾ — the initial vowel gone; Urdu-script writing seats no hamza on ا
 *     skr  ⟨ة⟩ ×9 ⟨ۃ⟩ ×7    السنة → ˈəlsən, السیاسۃ → ələsjˈaːs
 *
 * ⚠ AND ⟨ة⟩/⟨ۃ⟩ FOLD TO ⟨ہ⟩ HERE WHILE THE ARABIC ENGINE EXEMPTS THEM AS CORRECTLY SILENT — the same
 * character, the opposite verdict, because the languages differ. Arabic reads تāʾ marbūṭa as nothing in
 * pausal form (the /a/ is the fatḥa before it, which Arabic writes); Urdu-script writing has no fatḥa to
 * carry it and reads the letter ITSELF as final /a/ — السنۃ *as-sunna*, سورۃ *sūra* — which is exactly what
 * word-final ⟨ہ⟩ already does in this scanner.
 *
 * ⚠ NOT FOLDED: ⟨ڊ⟩ U+068A, reported ×4 in skr. All four occurrences are ONE sentence of one article, and
 * they disagree with each other — ⟨ڊے⟩ is transparently دے /d̪eː/ "of", while ⟨پچاڊھ⟩ wants a retroflex, and
 * the letter's own Sindhi value is the retroflex implosive /ɗ̢/ (Saraiki writes that ݙ). Four tokens from one
 * sentence do not source a phoneme, and a wrong reading is worse than a silence. Left reported.
 */
const LETTERFORM: Readonly<Record<string, string>> = {
    "ي": "ی", "ى": "ی", // Arabic yeh / alif maqṣūra → Urdu-script yeh
    "ك": "ک", // Arabic kāf → Shahmukhi kāf
    "أ": "ا", "إ": "ا", "ٱ": "ا", // hamza-seated alifs → bare alif
    "ة": "ہ", "ۃ": "ہ", // tāʾ marbūṭa (both encodings) → the gol he that already reads final /a/
};
const LETTERFORM_RE = new RegExp(`[${Object.keys(LETTERFORM).join("")}]`, "gu");

/**
 * The Arabic ADVERBIAL ENDING ⟨ـاً⟩ — the tanwīn's alif is a SEAT, not a long vowel.
 *
 * `silentCharsIn` reports ⟨ً⟩ ×32 in skr: تقریباً → t̪əqɾˈiːbaː, مثلاً → mˈəslaː, عموماً → əmˈoːmaː — the /n/
 * of *taqrīban*, *maslan*, *ʿumūman* deleted in every one. The cause is positional rather than missing data:
 * `harakat` in shahmukhi.jsonc has carried `"ً": "ən"` all along, but the scan only reads a mark that sits
 * directly on a CONSONANT, and in ⟨ـاً⟩ the mark sits on the alif. Dropping the alif puts the tanwīn back on
 * its consonant, where the existing table reads it — and drops the wrong long /aː/ at the same time, since
 * the ending is /-an/ and never /-aːn/. Word-final only: a medial ⟨اً⟩ is not this ending.
 */
 // ⚠ ⟨ی⟩ AND NOT ⟨ى⟩: this runs AFTER the letterform fold above, which has already unified the two.
const TANWIN_ALIF = /[ای]([ًٌٍ])$/u;

/**
 * ⚠ SHADDA BEFORE ITS VOWEL MARK — AND WITHOUT THIS, A GEMINATE THAT CARRIES A VOWEL IS NOT A GEMINATE.
 *
 * The consonant branch below reads the marks in a FIXED order — shadda, then one haraka — but the canonical
 * Unicode ordering is the opposite for the commonest case: a vowel mark has combining class 30 and the shadda
 * 33, so ⟨کَّ⟩ is stored ⟨ک⟩+fatḥa+shadda and real text arrives that way. The shadda test saw the fatḥa, fell
 * through, and the shadda was then skipped as an unknown diacritic — `مکَّہ` read *mˈəkəɦ*, losing both the
 * gemination AND the word-final [aː] (the ہ was no longer word-final for the branch that reads it). The same
 * bug, and the same one-line repair, as in `pashto.ts`; a no-op on the order the corpus usually writes.
 */
const SHADDA_AFTER_VOWEL = /([ً-ِٰ])ّ/gu;

/** Scan one Shahmukhi word into raw canonical Punjabi IPA (breathy markers, doubled geminates, inherent schwas)
 *  — the SAME shape the Gurmukhi g2p emits, for punjabi.ts's shared post-processing. */
export function scanShahmukhi(word: string): string {
    const s = [
        ...word.normalize("NFC")
            .replace(LETTERFORM_RE, (c) => LETTERFORM[c]!)
            .replace(TANWIN_ALIF, "$1")
            .replace(SHADDA_AFTER_VOWEL, "ّ$1"),
    ];
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
