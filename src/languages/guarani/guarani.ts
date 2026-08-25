/**
 * Paraguayan Guaraní (gn) phonemizer — Avañe'ẽ, Tupian, Latin script (the achegety), canonical IPA,
 * Tupian. Near-phonemic: a longest-match scan over the prenasalized
 * prenasalized digraphs ⟨mb nd nt⟩→[ᵐb ⁿd ⁿt] (⟨ng⟩→plain [ŋ]), ⟨ch⟩→[ʃ], ⟨gu⟩→[w], then single graphemes — the 12-vowel system (⟨y⟩→[ɨ],
 * the six nasal vowels ⟨ã ẽ ĩ õ ũ ỹ⟩), ⟨g⟩→[ɰ], ⟨j⟩→[d͡ʒ], ⟨ñ⟩→[ɲ], ⟨'⟩ (puso)→[ʔ]. Stress is final-syllable
 * (oxytone) by default, overridden to an acute-accented vowel; a nasal vowel attracts it otherwise.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { normalizeGuarani } from "./normalize.ts";

export interface GuaraniDef {
    acuteVowels: readonly string[];
    nasalVowels: readonly string[];
    frontLetters: readonly string[];
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    /** The ordinal suffix, glued to the numeral. */
    ordinalSuffix: string;
}
const DEF = loadManifest<GuaraniDef>(import.meta.url, "guarani.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
// Marked vowel letters (guarani.jsonc): the acute marks STRESS, the tilde marks NASALITY.
const ACUTE = new Set(DEF.acuteVowels);
const NASAL = new Set(DEF.nasalVowels);
// The universal vowel letters PLUS Guaraní's nasal vowels. The nasals cannot live in core/ipa.ts: ⟨ã ẽ ĩ
// õ ũ⟩ are single NFC codepoints but ⟨ɨ̃⟩ is ⟨ɨ⟩ + a combining tilde, so the class is not a set of
// characters at all — it works only because this engine compares whole SEGMENTS rather than characters.
const VOWEL = new Set([...IPA_VOWEL, "ã", "ẽ", "ĩ", "õ", "ũ", "ɨ̃"]);

const FRONT = new Set(DEF.frontLetters); // ⟨gu⟩ is u-silent [ɰ] before a front OR central vowel
const GLIDE: Record<string, string> = { i: "j", u: "w", ɨ: "j" };
const GLIDE_OUT = new Set(["j", "w"]);

/**
 * ⟨g̃⟩ — THE ACHEGETY'S 33RD-ALPHABET LETTER THAT THIS ENGINE WAS DELETING, and the saltillo's sibling.
 *
 * `normalize.ts` fixed the PUSO ⟨ꞌ⟩ (×301) two batches ago; ⟨g̃⟩ is the other mark Guaraní writes that has
 * no precomposed codepoint, and it was missed. `silentCharsIn` reports it as U+0303 ×82, inert, 8 words:
 * `og̃uahẽ → owaˈhẽ`, `ág̃a → ˈaɰa`, `hag̃ua → haˈwa` — the tilde gone and the word read as though it had
 * been written with a plain ⟨g⟩.
 *
 * ⚠ THE DELETION HAPPENS IN THE NATIVISER, NOT THE SCAN, which is why it survived a reading of this file.
 * `makeNativiser` judges per CLUSTER: `g̃` is ⟨g⟩ + U+0303, that combining mark was absent from
 * `NATIVE_CLASS`, so the cluster failed `known()` and `foldLatinToBase` stripped the mark before
 * `phonemizeWord` ever saw it. The scan below could not have claimed a character that no longer existed.
 *
 * ⚠ THE VALUES, SOURCED, and note that they complete a FOUR-WAY paradigm this engine already had three
 * corners of. es.wikipedia's Guaraní consonant chart:
 *
 *     aproximante velar sonora ORAL      [ɰ]   ⟨g⟩      ← already read
 *     aproximante velar sonora NASAL     [ɰ̃]   ⟨g̃⟩      ← added here
 *     aproximante labiovelar sonora      [w]   ⟨gu⟩     ← already read
 *     aproximante labiovelar NASAL       [w̃]   ⟨g̃u⟩     ← added here
 *
 * and en.wikipedia's achegety list carries ⟨G̃⟩ as one of the 33 letters ("A, Ã, Ch, E, Ẽ, G, G̃, H, …").
 * ⚠ [ŋ] IS THE ATTESTED SIMPLIFICATION AND IS NOT USED: two learner-facing sources give ⟨g̃⟩ = [ŋ], but the
 * same sources give ⟨ng⟩ its own value, and this engine reads ⟨ng⟩ → [ŋ] — so taking [ŋ] would COLLAPSE two
 * distinct letters of the alphabet into one phone, which is the deletion again wearing a phone.
 *
 * ⚠ AND ⟨g̃u⟩ MATTERS MORE THAN ⟨g̃⟩ HERE: the two commonest corpus forms, `hag̃ua` and `og̃uahẽ`, are both
 * the DIGRAPH, so a bare-⟨g̃⟩ rule alone would still have mis-read them — as [ɰ̃u] rather than [w̃].
 *
 * ⚠ STRESS IS NOT TOUCHED. ⟨g̃⟩ is a nasal CONSONANT, and the "a nasal vowel attracts stress" rule below
 * reads written nasal VOWELS. Guaraní's nasal harmony does spread from it across the word, but that is a
 * separate rule with its own blocking conditions, and inventing it on the back of a grapheme fix is the
 * sort of guess this file's other notes refuse.
 */
const TILDE = "̃";

/** Phonemize one Guaraní word → canonical IPA: longest-match scan + ⟨gu⟩ context + glide formation + stress. */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase().replace(/[’ʼ]/gu, "'"); // normalise the puso apostrophe glyphs → U+0027
    const segs: string[] = [];
    // Per emitted vowel segment: its segment index + whether its source grapheme was acute-accented / nasal.
    const vseg: { at: number; acute: boolean; nasal: boolean }[] = [];
    let i = 0;
    outer: while (i < w.length) {
        // ⟨g̃⟩ AND ⟨g̃u⟩ — the NASAL counterparts of the two branches below, and a LETTER of the achegety in
        // their own right. FIRST, because ⟨g̃u⟩ has to be claimed before the plain ⟨gu⟩ test sees its ⟨g⟩.
        if (w[i] === "g" && w[i + 1] === TILDE) {
            const after = w[i + 2], vowelAt = w[i + 3];
            if (after === "u" && vowelAt !== undefined && G[vowelAt] !== undefined && VOWEL.has(G[vowelAt]!)) {
                segs.push(FRONT.has(vowelAt) ? "ɰ̃" : "w̃");
                i += 3;
                continue;
            }
            segs.push("ɰ̃");
            i += 2;
            continue;
        }
        // ⟨gu⟩ is Spanish-style: before a back vowel → [w] (gua→wa), before a front vowel → [ɰ] (gue→ɰe, u silent).
        if (w[i] === "g" && w[i + 1] === "u" && i + 2 < w.length && G[w[i + 2]!] !== undefined && VOWEL.has(G[w[i + 2]!]!)) {
            segs.push(FRONT.has(w[i + 2]!) ? "ɰ" : "w");
            i += 2;
            continue;
        }
        for (const key of ORDER) {
            if (w.startsWith(key, i)) {
                segs.push(DIGRAPHS[key]!);
                i += key.length;
                continue outer;
            }
        }
        const ch = w[i]!;
        const ph = G[ch];
        if (ph !== undefined) {
            if (VOWEL.has(ph)) vseg.push({ at: segs.length, acute: ACUTE.has(ch), nasal: NASAL.has(ch) });
            segs.push(ph);
        }
        i += 1;
    }
    // Stress nucleus: an acute-accented vowel, else the last nasal vowel (nasality attracts stress), else the final
    // vowel (oxytone). (A word-initial vowel's phonetic glottal onset is NOT emitted — the broad referee omits it.)
    const nucleus = vseg.length ? (vseg.find((v) => v.acute) ?? [...vseg].reverse().find((v) => v.nasal) ?? vseg[vseg.length - 1]!).at : -1;
    // Glide formation: a non-nucleus HIGH vowel (i/u/y) immediately before another vowel → a glide (j/w).
    for (const v of vseg) {
        if (v.at !== nucleus && GLIDE[segs[v.at]!] !== undefined && VOWEL.has(segs[v.at + 1] ?? "")) segs[v.at] = GLIDE[segs[v.at]!]!;
    }
    // Stress before the onset of the nuclear syllable: back up over the onset consonant, and over a preceding glide
    // too (a C+glide onset like ⟨ku⟩→[kw] is one syllable: kuéra→ˈkweɾa, not kˈweɾa).
    if (nucleus >= 0) {
        let at = nucleus;
        if (at > 0 && !VOWEL.has(segs[at - 1]!)) at--; // over the glide or onset consonant
        if (at > 0 && GLIDE_OUT.has(segs[at]!) && !VOWEL.has(segs[at - 1]!)) at--; // if that was a glide, over its consonant too
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

// A word (Guaraní achegety letters incl. the nasal/accented vowels + the puso ⟨'⟩) / number / punctuation. Numbers deferred.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’")})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
// ⚠ U+0303 IS IN THE CLASS, and it has to be: ⟨g̃⟩ has no precomposed form, so without the mark the
// nativiser folds the cluster to a bare ⟨g⟩ and the letter is gone before the g2p runs. See TILDE above.
const NATIVE_CLASS = "[a-zãẽĩõũỹáéíóúýñA-ZÃẼĨÕŨỸÁÉÍÓÚÝÑ'’̃]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class GuaraniPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts runs BEFORE tokenization — which is where the puso fold has to be, because two of the
        // three glyphs Guaraní writes it with (U+A78C saltillo, U+02BC) are outside this TOKEN class and
        // would otherwise be deleted or split the word before `phonemizeWord` could fold them.
        return assembleClauses(normalizeGuarani(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // ≤9 digits stays inside the attested range (< 10⁹); longer reads the raw digit string.
                const words = m[2].length <= 9 ? numberToWords(Number(m[2])) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Guaraní phonemizer (direct near-phonemic g2p + prenasalized digraphs + oxytone/accent stress). */
export function createGuarani(): Phonemizer {
    return new GuaraniPhonemizer();
}
