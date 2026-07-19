/**
 * Shared Ge'ez / Fidäl engine — for the Ethiosemitic languages written in the Ethiopic SYLLABARY-abugida (Amharic
 * `am`, Tigrinya `ti`). Each codepoint is a whole CV syllable (the vowel is baked into the glyph), so the g2p is a
 * flat fidel→CV lookup rather than a Brahmic matra/virama engine. Two features are UNWRITTEN in the script and
 * handled here: GEMINATION (phonemic but unmarked — left single, folded vs the referee) and the 6th-order vowel
 * [ɨ] (sadis), which is EPENTHETIC — inserted to break illegal clusters — and so is deleted on the surface
 * wherever the surrounding consonants form a legal cluster. The per-language differences (which fidel a codepoint
 * maps to — e.g. Tigrinya keeps the pharyngeals ħ/ʕ that Amharic merged to h/ʔ) live entirely in each language's
 * fidel.tsv; the epenthesis phonotactics are shared Ethiosemitic.
 */
import { loadTsvMap } from "./loadTsv.ts";

const VOWEL = "əuiaeɨoɐæ";
const VOWELS = new Set([...VOWEL]);
/** A phoneme token is a VOWEL if its BASE code point is one (so a modifier-bearing token like 'aː' still counts). */
const isVowelTok = (t: string | undefined): boolean => t !== undefined && VOWELS.has([...t][0] ?? "");

/** Split an IPA string into PHONEME tokens: an affricate (X͡Y) + any trailing modifiers (ʼ ʷ ʰ ̥ ː) count as ONE
 *  consonant, so cluster counting isn't fooled by the multi-codepoint spellings (d͡ʒ is one C, not three). */
function toPhonemes(s: string): string[] {
    const a = [...s];
    const out: string[] = [];
    for (let i = 0; i < a.length; i++) {
        let t = a[i]!;
        if (a[i + 1] === "͡") { t += a[i + 1]! + (a[i + 2] ?? ""); i += 2; } // affricate base ͡ base
        while (a[i + 1] !== undefined && "ʼʷʰ̥ː".includes(a[i + 1]!)) t += a[++i]!; // trailing modifiers
        out.push(t);
    }
    return out;
}

const NASAL = new Set([..."mnɲŋ"]);
const FRICATIVE = new Set([..."szʃʒfhħ"]);
/** Is the consonant sequence c1·c2 an illegal Ethiosemitic cluster that an epenthetic ɨ must break? Keyed on each
 *  token's BASE code point (so labialized sʷ/mʷ classify by s/m). Nasal + a homorganic stop (nb, nd, nɡ) is LEGAL;
 *  a fricative + ɾ (sɾ) is LEGAL; only a STOP + ɾ and nasal + nasal break. */
function illegalCluster(c1: string, c2: string): boolean {
    const b1 = [...c1][0]!, b2 = [...c2][0]!;
    if (b2 === "ɾ" && !FRICATIVE.has(b1)) return true; // stop + ɾ (ɡɨɾ, bɨɾ); fricative + ɾ (sɾ) is fine
    if (NASAL.has(b1) && NASAL.has(b2)) return true; // nasal + nasal (nɨɲ, mɨn)
    return false;
}

/**
 * Delete the epenthetic 6th-order [ɨ] where the surrounding consonants form a LEGAL cluster; keep it where deleting
 * would create an illegal one. The sadis [ɨ] is inserted to break clusters, so on the surface it survives only
 * where needed: (a) KEPT word-initially (ɨɡɨɾ 'foot'); (b) KEPT if deleting it would leave a WORD-FINAL consonant
 * cluster of ≥3 — an illegal complex coda (አምስት→amɨst, since 'mst#' is illegal; but MEDIALLY the cluster
 * resyllabifies, so አምስተኛ→amstəɲa keeps NO ɨ); (c) KEPT where deleting would abut a truly-illegal 2-cluster — a
 * STOP + /ɾ/ (ɡɨɾ, bɨɾ; a fricative + ɾ like sɾ is legal) or a nasal + nasal (nɨɲ, mɨn). Processed RIGHT-TO-LEFT so
 * an earlier ɨ sees the clusters a later deletion already created.
 */
export function deleteEpenthetic(s: string): string {
    const p = toPhonemes(s);
    const isCons = (t: string | undefined): boolean => t !== undefined && t !== "" && !isVowelTok(t);
    for (let i = p.length - 1; i >= 0; i--) {
        if (p[i] !== "ɨ") continue;
        if (p.slice(0, i).every((c) => c === "" || !isVowelTok(c))) continue; // word-initial ɨ is kept
        const wordFinal = !p.slice(i + 1).some(isVowelTok); // no vowel follows → word-final cluster
        let left = 0;
        for (let j = i - 1; j >= 0 && !isVowelTok(p[j]); j--) if (p[j] !== "") left++;
        let right = 0;
        for (let j = i + 1; j < p.length && !isVowelTok(p[j]); j++) if (p[j] !== "") right++;
        if (wordFinal && left + right >= 3) continue; // deleting → illegal ≥3 complex coda → keep
        // The IMMEDIATE non-empty neighbours become adjacent when the ɨ is deleted; a cluster forms only if BOTH
        // are consonants (a vowel on either side means no cluster — nothing to break).
        const prev = [...p.slice(0, i)].reverse().find((c) => c !== "");
        const next = p.slice(i + 1).find((c) => c !== "");
        if (isCons(prev) && isCons(next) && illegalCluster(prev!, next!)) continue; // deleting → illegal 2-cluster → keep
        p[i] = "";
    }
    return p.join("");
}

/** Build a fidel→CV word phonemizer for a Ge'ez-script language: `import.meta.url` + the fidel TSV filename. The
 *  Ethiopic wordspace ፡ (and any whitespace) is a word boundary — each part is phonemized independently. */
export function makeGeezG2P(metaUrl: string, fidelFile: string): (word: string) => string {
    let fidel: Map<string, string> | undefined;
    const map = (): Map<string, string> => (fidel ??= loadTsvMap(metaUrl, fidelFile));
    const word = (w: string): string => {
        if (/[፡\s]/u.test(w)) return w.split(/[፡\s]+/u).filter(Boolean).map(word).join(" ");
        let out = "";
        for (const ch of w.normalize("NFC")) out += map().get(ch) ?? "";
        return deleteEpenthetic(out).normalize("NFC");
    };
    return word;
}
