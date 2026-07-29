/**
 * Persian↔Tajik cross-script alignment — derive Persian short-vowel pronunciations from Tajik cognates.
 *
 * Persian (abjad) omits short vowels; Tajik (Cyrillic) writes them. This tool transliterates a Tajik word to a
 * Persian consonant+long-vowel SKELETON (collapsing the Arabic letter classes Tajik merged: س ص ث / ز ذ ض ظ / ت ط
 * / ه ح), matches it to a real Persian word, and derives the Persian IPA from the Tajik pronunciation (remapping
 * the Persian/Tajik divergences: Tajik ɔ→Persian ɒ [ā], the majhul merger ɵ→u, в→w, and a word-initial ʔ).
 *
 * VALIDATION (run against tools/persian/fa-abjad-ipa-gold.tsv): the derived Persian IPA matches fa's own
 * human gold on aligned cognates at ~71% (full, short vowels) / ~83% (skeleton). So Tajik is a viable Persian
 * pronunciation ORACLE — WHEN the alignment is right.
 *
 * CAVEAT (measured): word-level SKELETON alignment is many-to-one (a Persian skeleton matches several Tajik
 * cognates), so picking a cognate by frequency mis-selects (آخر 'last' → ахёр not охир). That makes a
 * coverage-extension corpus SILVER (~71% est.), not gold. Real PARALLEL TEXT (same classical work in both
 * scripts) removes the ambiguity (positional alignment) AND gives the CONTEXT a homograph/ezafe model needs.
 *
 *   npx tsx tools/persian/tajik-align.ts   # prints the fa-gold validation
 *
 * See docs/investigations/fa_shortvowel_restoration_investigation.md.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { phonemizeWord as tg } from "../../src/languages/tajik/tajik.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Collapse the Arabic letter classes Tajik merged, so a tg-transliteration can match the real fa spelling.
const NORM: Record<string, string> = { "ص": "س", "ث": "س", "ذ": "ز", "ض": "ز", "ظ": "ز", "ط": "ت", "ح": "ه", "آ": "ا", "ي": "ی", "ك": "ک", "ٔ": "", "ء": "ع", "أ": "ا", "إ": "ا", "ؤ": "و" };
const norm = (w: string): string => [...w.replace(/[ً-ْـ]/gu, "")].map((c) => NORM[c] ?? c).join("");

// Tajik Cyrillic → Persian abjad skeleton (consonants + WRITTEN long vowels о/и/у→ا/ی/و; short а/е omitted).
const CB: Record<string, string> = { "б": "ب", "п": "پ", "т": "ت", "ҷ": "ج", "ч": "چ", "х": "خ", "д": "د", "ж": "ژ", "з": "ز", "р": "ر", "с": "س", "ш": "ش", "ғ": "غ", "ф": "ف", "қ": "ق", "к": "ک", "г": "گ", "л": "ل", "м": "م", "н": "ن", "ъ": "ع", "й": "ی", "в": "و", "ҳ": "ه" };
const CV: Record<string, string> = { "о": "ا", "и": "ی", "ӣ": "ی", "у": "و", "ӯ": "و" };
const VINIT = new Set(["а", "о", "и", "ӣ", "у", "ӯ", "е", "э"]);
export function translitToSkeleton(cyr: string): string {
    const cs = [...cyr.toLowerCase()];
    let out = cs.length && VINIT.has(cs[0]!) ? "ا" : ""; // word-initial vowel → alef
    for (const c of cs) out += CB[c] ?? CV[c] ?? "";
    return norm(out);
}

/** Tajik canonical IPA → Persian IPA: ɔ→ɒ (ā), majhul ɵ→u, в=v→w, ʁ→ɣ, and a word-initial glottal ʔ. */
export function tajikIpaToPersian(cyr: string): string {
    let x = tg(cyr).replace(/[ˈˌ]/gu, "").replace(/ɔ/gu, "ɒ").replace(/ɵ/gu, "u").replace(/ʁ/gu, "ɣ").replace(/v/gu, "w");
    if (/^[aeiouɒæ]/u.test(x)) x = "ʔ" + x;
    return x;
}

function main(): void {
    const gold = new Map<string, string[]>();
    for (const l of readFileSync(join(HERE, "fa-abjad-ipa-gold.tsv"), "utf8").split("\n")) {
        if (!l.trim() || l.startsWith("#")) continue;
        const [w, ...ipas] = l.split("\t");
        gold.set(w!, ipas);
    }
    const faBySkel = new Map<string, string[]>();
    for (const w of gold.keys()) {
        const k = norm(w);
        (faBySkel.get(k) ?? faBySkel.set(k, []).get(k)!).push(w);
    }
    const skel = (s: string): string => s.replace(/[ˈˌ͡ː]/gu, "").replace(/[̀-ͯ]/gu, "").replace(/ɾ/gu, "r").replace(/χ/gu, "x").replace(/ɒ/gu, "a").replace(/q/gu, "ɣ");
    const shortNeutral = (s: string): string => skel(s).replace(/[eoiuæ]/gu, "a");

    // Validate on the tg wikipron wordlist (its Cyrillic keys) against the fa gold.
    const tgWords = readFileSync(join(HERE, "..", "referee-eval", "referees", "tg.wikipron-tgk-cyrl-broad.tsv"), "utf8")
        .split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.split("\t")[0]!);
    let matched = 0, full = 0, sk = 0;
    for (const w of tgWords) {
        const cands = faBySkel.get(translitToSkeleton(w));
        if (!cands) continue;
        matched++;
        const p = tajikIpaToPersian(w);
        const refs = gold.get(cands[0]!)!;
        if (refs.some((r) => skel(r) === skel(p))) full++;
        if (refs.some((r) => shortNeutral(r) === shortNeutral(p))) sk++;
    }
    console.log(`aligned tg→fa cognates: ${matched}`);
    console.log(`  derived Persian IPA == fa gold (FULL, short vowels): ${full} (${((100 * full) / matched).toFixed(1)}%)`);
    console.log(`  == fa gold (SKELETON only): ${sk} (${((100 * sk) / matched).toFixed(1)}%)`);
}
// Run the validation only when invoked directly (importers reuse the exported translit/remap helpers).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) main();
