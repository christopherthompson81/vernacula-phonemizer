/**
 * Native Amharic / አማርኛ (am) text phonemizer — canonical IPA, espeak-independent. Ethiopian Semitic, written in
 * the Ge'ez/Fidäl SYLLABARY-abugida: each codepoint is a whole CV syllable (the vowel is baked into the glyph),
 * so the g2p is a flat lookup (fidel.tsv, one Ethiopic codepoint → its CV) rather than a Brahmic matra/virama
 * engine. Two features are UNWRITTEN: GEMINATION (phonemic but unmarked — rendered single, folded vs the referee)
 * and the 6th-order vowel [ɨ], which is epenthetic and DELETED word-finally (ሁለት→hulət) and before a vowel.
 * Ejectives kʼ tʼ t͡ʃʼ pʼ t͡sʼ. See docs/am_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teenPrefix: string;
    tens: Record<string, string>;
    hundred: string;
    thousand: string;
}
interface AmharicDef {
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<AmharicDef>(import.meta.url, "amharic.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

let FIDEL: Map<string, string> | undefined;
function fidel(): Map<string, string> {
    return (FIDEL ??= loadTsvMap(import.meta.url, "fidel.tsv"));
}

const VOWEL = "əuiaeɨo";
const VOWELS = new Set([...VOWEL]);
const isVowel = (c: string | undefined): boolean => c !== undefined && VOWELS.has(c);

/**
 * Delete the epenthetic 6th-order [ɨ] where the surrounding consonants form a LEGAL cluster; keep it where deleting
 * would create an illegal one. Amharic [ɨ] (sadis) is inserted to break clusters, so on the surface it survives
 * only where needed: (a) KEPT word-initially (ɨɡɨɾ 'foot'); (b) KEPT if deleting it would leave a WORD-FINAL
 * consonant cluster of ≥3 — an illegal complex coda (አምስት→amɨst, since 'mst#' is illegal; but MEDIALLY the cluster
 * resyllabifies, so አምስተኛ→amstəɲa keeps NO ɨ); (c) KEPT before a truly-illegal 2-cluster — anything before /ɾ/
 * (ɡɨɾ, bɨɾ) or a nasal + a non-coronal/nasal (nɨɲ, nɨɡ, mɨn). Processed RIGHT-TO-LEFT so an earlier ɨ sees the
 * clusters a later deletion already created.
 */
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
const isVowelTok = (t: string | undefined): boolean => t !== undefined && t.length === 1 && VOWELS.has(t);

function deleteEpenthetic(s: string): string {
    const p = toPhonemes(s);
    for (let i = p.length - 1; i >= 0; i--) {
        if (p[i] !== "ɨ") continue;
        if (p.slice(0, i).every((c) => c === "" || !isVowelTok(c))) continue; // word-initial ɨ is kept
        const wordFinal = !p.slice(i + 1).some(isVowelTok); // no vowel follows → word-final cluster
        let left = 0;
        for (let j = i - 1; j >= 0 && !isVowelTok(p[j]); j--) if (p[j] !== "") left++;
        let right = 0;
        for (let j = i + 1; j < p.length && !isVowelTok(p[j]); j++) if (p[j] !== "") right++;
        if (wordFinal && left + right >= 3) continue; // deleting → illegal ≥3 complex coda → keep
        const prev = p.slice(0, i).reverse().find((c) => c !== "" && !isVowelTok(c));
        const next = p.slice(i + 1).find((c) => c !== "" && !isVowelTok(c));
        if (illegalCluster(prev, next)) continue; // deleting would abut a truly-illegal 2-cluster → keep
        p[i] = "";
    }
    return p.join("");
}
const NASAL = new Set([..."mnɲŋ"]);
const FRICATIVE = new Set([..."szʃʒfh"]);
/** Is the 2-consonant sequence c1·c2 an illegal Amharic cluster that an epenthetic ɨ must break? Nasal + a
 *  homorganic stop (nb, nd, nɡ) is LEGAL; a fricative + ɾ (sɾ) is LEGAL; only a STOP + ɾ and nasal + nasal break. */
function illegalCluster(c1: string | undefined, c2: string | undefined): boolean {
    if (c1 === undefined || c2 === undefined) return false;
    if (c2 === "ɾ" && !FRICATIVE.has(c1)) return true; // stop + ɾ (ɡɨɾ, bɨɾ); fricative + ɾ (sɾ) is fine
    if (NASAL.has(c1) && NASAL.has(c2)) return true; // nasal + nasal (nɨɲ, mɨn)
    return false;
}

/** One Amharic word → canonical IPA: fidel→CV lookup + 6th-order ɨ deletion. */
export function phonemizeWord(word: string): string {
    // The Ethiopic wordspace ፡ (and any space) is a word boundary — phonemize each part independently.
    if (/[፡\s]/u.test(word))
        return word.split(/[፡\s]+/u).filter(Boolean).map(phonemizeWord).join(" ");
    let out = "";
    for (const ch of word.normalize("NFC")) out += fidel().get(ch) ?? "";
    return deleteEpenthetic(out).normalize("NFC");
}

// ── Numbers (decimal; Amharic) ────────────────────────────────────────────────
function numberToText(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n === 10) return NUM.ten;
    if (n < 20) return `${NUM.teenPrefix} ${NUM.units[n - 10]}`;
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return NUM.tens[String(t)]! + (u ? ` ${NUM.units[u]}` : "");
    }
    if (n < 1000) {
        const h = Math.floor(n / 100), r = n % 100;
        return `${h > 1 ? NUM.units[h] + " " : ""}${NUM.hundred}${r ? " " + numberToText(r) : ""}`;
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), r = n % 1000;
        return `${th > 1 ? numberToText(th) + " " : ""}${NUM.thousand}${r ? " " + numberToText(r) : ""}`;
    }
    return String(n);
}
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return numberToText(n).split(" ").map(phonemizeWord).join(" ");
}

// Ethiopic letters (U+1200–U+135A, incl. combining marks) · Arabic digits · Ethiopic + ASCII punctuation.
const TOKEN = /([ሀ-ፚ]+)|(\d+)|([።፣፤፥፦፧፨.?!,;:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

class AmharicPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Amharic phonemizer. `foreign` handles embedded Latin runs. */
export function createAmharic(foreign?: ForeignPhonemizer): Phonemizer {
    return new AmharicPhonemizer(foreign);
}
