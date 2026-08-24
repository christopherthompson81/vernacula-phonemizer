/**
 * Kazakh (kk) phonemizer — canonical IPA. Rule-based g2p (g2p.ts) + Kazakh stress algorithm: default stress
 * is the LAST syllable, but scanning nuclei left-to-right from the second, the first "unstressed" vowel moves
 * stress to the syllable BEFORE it. The only unstressed vowel is ə (ы, and the ə of и=əj) — so a reduced ы
 * between full vowels pulls stress leftward (бойынша→bˈojənʃɑ) while words with no reduced vowel take final
 * stress (Санат→sɑnˈɑt). text() tokenizes words / numbers / punctuation.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToIpa } from "./numbers.ts";
import { normalizeKazakh } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

// Any Kazakh vowel/glide letter (from the manifest's vowel + glide tables) — its absence means an abbreviation.
const VOWEL_OR_GLIDE = new RegExp(
    `[${Object.keys(MANIFEST.vowels).join("")}${Object.keys(MANIFEST.glides).join("")}]`,
    "u",
);
const FRONT_VOWEL = new RegExp(`[${MANIFEST.frontVowels}]`, "u"); // vowel harmony: presence lightens dark ɫ → l

/** One Kazakh word → canonical IPA with a single primary-stress mark (STRESSPOSN_1RU). */
export function phonemizeWord(word: string): string {
    // Consonant-only token (abbreviation / letter sequence). Final stress (км→kəmˈə, РФ→rəfˈə, ж→ʒˈə).
    if (!VOWEL_OR_GLIDE.test(word.toLowerCase())) {
        const cons = toSegments(word).map((s) => s.ph);
        if (cons.length === 0) return "";
        return cons
            .map((c, i) => (i === cons.length - 1 ? `${c}ˈə` : `${c}ə`))
            .join(""); // stress the final ə
    }
    const segs = toSegments(word);
    // Initial-cluster epenthesis: Kazakh phonotactics break a word-initial run of ≥3 TRUE consonants with a schwa
    // after the first (стратегия→sətrɑteɡəjja, скрипка→səkrəjpkɑ). Glides w/j (у/й) are vowel-like and don't count
    // (туралы→twrɑɫə, клуб→kɫwb).
    const isCons = (s: { ph: string; nucleus: boolean }): boolean =>
        !s.nucleus && s.ph !== "w" && s.ph !== "j";
    if (
        segs.length >= 3 &&
        isCons(segs[0]!) &&
        isCons(segs[1]!) &&
        isCons(segs[2]!)
    ) {
        segs.splice(1, 0, { ph: "ə", nucleus: true });
    }
    const nucIdx = segs
        .map((s, i) => (s.nucleus ? i : -1))
        .filter((i) => i >= 0);
    if (nucIdx.length === 0) return segs.map((s) => s.ph).join("");
    // STRESSPOSN_1RU: default = last nucleus; the first ə (unstressed) at position ≥1 moves stress to the one before it.
    let stressNuc = nucIdx.length - 1;
    for (let k = 1; k < nucIdx.length; k++) {
        if (segs[nucIdx[k]!]!.ph === "ə") {
            stressNuc = k - 1;
            break;
        }
    }
    const stressIdx = nucIdx[stressNuc]!;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += segs[i]!.ph;
    }
    // Vowel harmony: a token with any front vowel [eɵʏɪæ] lightens ALL its dark ɫ → l (тіл→tɪl, Солтүстік→soltʏstɪk);
    // a pure back-harmony word keeps ɫ (климаты→kɫəjmɑtə).
    if (FRONT_VOWEL.test(out)) out = out.replace(/ɫ/gu, "l");
    return out;
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
// Kazakh Cyrillic words / numbers / punctuation. ⚠ The corpus groups thousands with SPACES (17 000,
// 5 000 000) and writes decimals with COMMAS (2,3); the TOKEN swallows both so the tier can see the number.
const TOKEN = /([Ѐ-ӿ]+)|(\d{1,3}(?:[ \u00a0\u202f\u2009]\d{3})+(?:,\d+)?|\d+,\d+|\d+)|([.!?…,;:])/gu;

// symbol normalization — Kazakh: пайыз (percent), CYRILLIC unit abbreviations (the corpus writes
// км/кг, not km/kg — the same trap as Russian). Kept in the ENGINE file so the review tool's sourcing
// check can see the words.
export const SYMBOLS = makeSymbolNormalizer({
    // `&` was DROPPED outright: the corpus's `B&B` and `Arts & Sciences` lost the sign.
    // `және` ×561 in this corpus. The tier spaces it on both sides, because `B&B` is two
    // initialisms and joining them would make one token.
    // `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "есе" },
    ampersand: "және",
    percent: ["пайыз"],
    currency: { "$": ["доллар"], "€": ["еуро"], "¥": ["йен"], "£": ["фунт"] },
    // LATIN KEYS TOO. The words below were already right; only the Cyrillic abbreviations were
    // declared, and the corpus writes the LATIN ones — so `5 km` read as *bˈes ˈʊkm*, the abbreviation
    // reaching the phoneme sink while `5 км` read correctly. Same words, two spellings of the key.
    // Verified in kk_kz: километр ×7 "жеті километр қашықтықта", метр ×10, сантиметр ×2.
    units: { "км": ["километр"], km: ["километр"], "кг": ["килограмм"], kg: ["килограмм"],
        "м": ["метр"], m: ["метр"], "мм": ["миллиметр"], mm: ["миллиметр"],
        "см": ["сантиметр"], cm: ["сантиметр"] },
    // `шаршы километр` ×8 and `текше метр` ×2, both word-first. The measure word does NOT inflect: the
    // corpus's `2,2 миллион шаршы километріне` carries the dative on the HEAD noun and leaves шаршы alone,
    // which is what an agglutinative language does and why one form suffices here.
    exponentWords: { squared: ["шаршы"], cubed: ["текше"], position: "before" },
});

class KazakhPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's case-suffix/ordinal/era steps need
        // the number and its suffix still adjacent, which the tier would break.
        return assembleClauses(SYMBOLS(normalizeKazakh(input)), TOKEN, (m, sink) => {
            // camelCase compound (proper-noun abbreviations like ҚазМұнайГаз) splits on internal capitals.
            if (m[1])
                for (const part of m[1].split(/(?<=\p{Ll})(?=\p{Lu})/u))
                    sink.emit(phonemizeWord(part));
            else if (m[2])
                for (const ipa of numberToIpa(Number(m[2].replace(/ /gu, ""))).split(" "))
                    sink.emit(ipa); // numbers are pre-phonemized
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}
export function createKazakh(): Phonemizer {
    return new KazakhPhonemizer();
}
