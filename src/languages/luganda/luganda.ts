/**
 * Luganda / Oluganda (lg) phonemizer — Bantu (Great Lakes, JE15), the Latin orthography, canonical IPA,
 * The principal language of Uganda (~11M incl. L2). A greedy longest-match scan over the
 * grapheme table (manifest.ts) with two code rules: CONSONANT GEMINATION — a doubled consonant is a geminate
 * [Cː] (bbiri→bːiri) — and VOWEL LENGTHENING before a prenasalised consonant (Buganda→buɡaːnda). Signatures:
 * 5 vowels with DOUBLING = LENGTH; prenasalised consonants as single units (mb→ᵐb, nd→ⁿd, ng→ᵑɡ); ⟨ng'⟩→ŋ vs
 * ⟨ng⟩→ᵑɡ; ⟨ny⟩→ɲ; labialisation ⟨Cw⟩→Cʷ; the palatal STOPS ⟨c⟩=c, ⟨j⟩=ɟ; ⟨r⟩=ɾ. Tone (3-way H/L/falling) is
 * lexical + unwritten → DEFERRED. Cardinal numbers: numbers.ts (citation/counting series + the mu/na
 * connectives).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const VOWEL_LETTERS = new Set(MANIFEST.vowelLetters);
// ⟨ng'⟩/⟨ny⟩ + the syllabic-nasal prefix ⟨n'⟩ — must be matched BEFORE the general prenasalisation rule.
const SPECIAL = ["nng'", "ng'", "nny", "ny", "n'"];
// A nasal prenasalises a following obstruent (epitran's set): b p f v t d c j k g — NOT s z (left as n + C).
const PRENASAL = new Set(MANIFEST.prenasalisable);
// Multi-letter grapheme keys handled by the greedy step: labialisation ⟨Cw⟩ (2nd char w) + the vowel-length
// digraphs (two vowels). The prenasal digraphs (mb, nd…) are EXCLUDED — the prenasalisation rule handles them.
const OTHER_DIGRAPHS = GRAPHEME_KEYS.filter(
    (k) => k.length === 2 && (k[1] === "w" || (VOWEL_LETTERS.has(k[0]!) && VOWEL_LETTERS.has(k[1]!))),
);

/** Phonemize a single Luganda word to canonical IPA (segmental; gemination + prenasal lengthening; non-tonal here). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    let i = 0;
    while (i < w.length) {
        // 1. ⟨ng'⟩/⟨nny⟩/⟨ny⟩/⟨n'⟩ — before the prenasalisation rule (⟨ng'⟩ is ŋ, not ᵑ+g)
        const sp = SPECIAL.find((k) => w.startsWith(k, i));
        if (sp) { out += G[sp] ?? "ⁿ"; i += sp.length; continue; }
        const c = w[i]!;
        // 2. PRENASALISATION: ⟨n m⟩ + an obstruent → a place-assimilated superscript nasal; the obstruent is then
        //    scanned normally, so its labialisation (⟨dw⟩→dʷ) and gemination survive (ndw → ⁿdʷ).
        if ((c === "n" || c === "m") && PRENASAL.has(w[i + 1] ?? "")) {
            const x = w[i + 1]!;
            out += "bpfv".includes(x) ? "ᵐ" : "kg".includes(x) ? "ᵑ" : "ⁿ";
            i += 1;
            continue;
        }
        // 3. ⟨Cw⟩ labialisation + the vowel-length digraphs
        const dg = OTHER_DIGRAPHS.find((k) => w.startsWith(k, i));
        if (dg) { out += G[dg]!; i += 2; continue; }
        // 4. consonant gemination: a doubled consonant letter → geminate [Cː]
        if (!VOWEL_LETTERS.has(c) && w[i + 1] === c && G[c]) { out += G[c]! + "ː"; i += 2; continue; }
        // 5. single grapheme (or skip unknown)
        if (G[c]) out += G[c]!;
        i += 1;
    }
    // a vowel before a prenasalised consonant (superscript nasal ᵐ ⁿ ᵑ) is lengthened
    return out.replace(/([aeiou])(?=[ᵐⁿᵑ])/g, "$1ː");
}

// A word (Luganda letters incl. ŋ and the ⟨ng'⟩ apostrophe) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'’")})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 *
 * ⚠ ŋ IS DELIBERATELY ABSENT: the g2p has no rule for it, and drops it outright — listing it here
 * would promise a reading that does not exist. NATIVE_CLASS is a claim ABOUT THE G2P, and
 * `test/native-inventory.test.ts` measures it character by character rather than trusting it.
 */
const NATIVE_CLASS = "[a-z'’]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class LugandaPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1]).replace(/’/gu, "'")));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Luganda phonemizer (greedy g2p + gemination + the cardinal compositor; tone deferred). */
export function createLuganda(): Phonemizer {
    return new LugandaPhonemizer();
}
