/**
 * Kazakh (kk) phonemizer — canonical IPA, espeak-independent. Rule-based g2p (g2p.ts) + espeak's Kazakh stress
 * algorithm (STRESSPOSN_1RU): default stress is the LAST syllable, but scanning nuclei left-to-right from the
 * second, the first "unstressed" vowel moves stress to the syllable BEFORE it. The only unstressed vowel is ə
 * (ы, and the ə of и=əj) — so a reduced ы between full vowels pulls stress leftward (бойынша→bˈojənʃɑ) while
 * words with no reduced vowel take final stress (Санат→sɑnˈɑt). text() tokenizes words / numbers / punctuation.
 * See docs/investigations/kk_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { toSegments } from "./g2p.ts";
import { numberToIpa } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

// Any Kazakh vowel/glide letter (from the manifest's vowel + glide tables) — its absence means an abbreviation.
const VOWEL_OR_GLIDE = new RegExp(
    `[${Object.keys(MANIFEST.vowels).join("")}${Object.keys(MANIFEST.glides).join("")}]`,
    "u",
);
const FRONT_VOWEL = new RegExp(`[${MANIFEST.frontVowels}]`, "u"); // vowel harmony: presence lightens dark ɫ → l

/** One Kazakh word → canonical IPA with a single primary-stress mark (STRESSPOSN_1RU). */
export function phonemizeWord(word: string): string {
    // Consonant-only token (abbreviation / letter sequence): espeak spells each letter by name — a consonant's
    // name is Cə (kk_list). Final stress (км→kəmˈə, РФ→rəfˈə, ж→ʒˈə).
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
const TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.!?…,;:])/gu;

// #562 symbol normalization — Kazakh: пайыз (percent), CYRILLIC unit abbreviations (the corpus writes
// км/кг, not km/kg — the same trap as Russian).
const SYMBOLS = makeSymbolNormalizer({
    percent: ["пайыз"],
    currency: { "$": ["доллар"] },
    units: { "км": ["километр"], "кг": ["килограмм"] },
});

class KazakhPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(SYMBOLS(input), TOKEN, (m, sink) => {
            // camelCase compound (proper-noun abbreviations like ҚазМұнайГаз) splits on internal capitals.
            if (m[1])
                for (const part of m[1].split(/(?<=\p{Ll})(?=\p{Lu})/u))
                    sink.emit(phonemizeWord(part));
            else if (m[2])
                for (const ipa of numberToIpa(Number(m[2])).split(" "))
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
