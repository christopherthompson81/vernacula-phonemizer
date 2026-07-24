/**
 * Danish (da) phonemizer — Standard rigsdansk, canonical IPA, espeak-independent. Danish is the DEEPEST European
 * orthography: stressed-vowel QUALITY, soft-d/g realisation, reduction, and stress are largely LEXICAL / not
 * recoverable from spelling by rule. So the primary path is a PRONUNCIATION LEXICON (da-lexicon.tsv, from the
 * Wiktionary data, normalised to canonical IPA); the rule g2p (phonemizeWordRules) is the OOV FALLBACK. The rule
 * engine is a left-to-right scan with Danish context rules (soft-d ⟨d⟩→ð intervocalic/final; af-→aw glide; coda
 * handling; final-⟨t⟩-after-vowel→d; -er/-et/-en/-el reductions; silent-h before j/v/…; ng→ŋ) + a first-syllable
 * (unstressed-prefix-aware) STRESS model. Length + STØD + aspiration are suprasegmental → not emitted (folded in the
 * referee eval, which measures the RULE engine — non-circular). See docs/investigations/da_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { taggerPhonemize } from "./tagger.ts";
import { MANIFEST } from "./manifest.ts";

const V = MANIFEST.vowels;
const C = MANIFEST.consonants;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const isV = (ch: string): boolean => ch !== "" && ch in V;

// Pronunciation lexicon (word → canonical IPA, from the Wiktionary data via tools/gen/build-da-lexicon.mts). The
// PRIMARY path: Danish vowel quality/reduction is unrecoverable by rule, so a known word is looked up here.
let LEX: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEX === undefined) LEX = loadTsvMap(import.meta.url, "da-lexicon.tsv", undefined, { optional: true });
    return LEX;
}

// Unstressed prefixes (Danish): stress falls on the following syllable (beˈɡønə, foˈʁsdɔ, undˈskyl).
const UNSTRESSED_PREFIX = /^(be|for|ge|und|er)[^aeiouyæøå]*[aeiouyæøå]/u;

interface Seg { ph: string; nuc: boolean; reduced?: boolean; stress?: boolean }

/** One Danish word → canonical IPA by RULE (the OOV fallback; segmental + a first-syllable / unstressed-prefix stress
 *  model, length/stød/aspiration folded). Exposed to the referee eval so the measurement is NON-CIRCULAR (not the
 *  lexicon). Builds a segment list, then places ONE primary stress on a FULL (non-reduced) nucleus. */
export function phonemizeWordRules(word: string): string {
    const lw = word.toLowerCase();
    // ⟨af-⟩ prefix: ⟨f⟩ vocalises to the glide [w] (afbryde→awbʁyðə) — before any consonant except ⟨r⟩ (afrikansk).
    const afPrefix = /^af[bcdfghjklmnpqstvz]/u.test(lw) && lw[2] !== "r";
    const chars = [...lw];
    const n = chars.length;
    const segs: Seg[] = [];
    const C_ = (ph: string): void => { segs.push({ ph, nuc: false }); };
    const V_ = (ph: string, reduced = false): void => { segs.push({ ph, nuc: true, reduced }); };
    const hasNucleus = (): boolean => segs.some((s) => s.nuc); // a preceding vowel exists → not a monosyllable

    for (let i = 0; i < n; i++) {
        const c = chars[i]!;
        const prev = chars[i - 1] ?? "";
        const next = chars[i + 1] ?? "";
        const final = i === n - 1;

        // ── final-suffix reductions (only when a stressed nucleus already precedes — NOT on monosyllables den/der) ──
        if (hasNucleus() && c === "e" && next === "r" && i + 2 === n) { V_("ɐ", true); i++; continue; } // -er → ɐ
        if (hasNucleus() && c === "e" && next === "t" && i + 2 === n) { V_("ə", true); C_("ð"); i++; continue; } // -et → əð
        if (hasNucleus() && c === "e" && (next === "n" || next === "l") && i + 2 === n) { V_("ə", true); C_(C[next]!); i += 2; continue; } // -en/-el

        // ── clusters / silent letters ──
        if (c === "f" && i === 1 && afPrefix) { C_("w"); continue; } // af- prefix f → glide [w]
        if (c === "n" && next === "g") { C_("ŋ"); i++; continue; } // ng → ŋ
        if (c === "n" && next === "k") { C_("ŋ"); C_("k"); i++; continue; } // nk → ŋk
        if (c === "h" && (next === "j" || next === "v")) continue; // silent h before j/v
        if (c === "t" && next === "h") continue; // th → t (silent h)
        if (c === "d" && (prev === "n" || prev === "l")) continue; // silent d in nd/ld
        if (c === "g" && isV(prev) && final) continue; // MINED: final ⟨g⟩ after a vowel → silent (rolig→roli, dig→di)
        if (!isV(c) && next === c) continue; // doubled consonant → single

        // ── vowels ──
        if (isV(c)) {
            if (c === "e" && final) { V_("ə", true); continue; } // final unstressed ⟨e⟩ → schwa
            // MINED contextual vowel rules (from the aligned lexicon): ⟨i⟩→[e] before ⟨n⟩+consonant (ind→en,
            // -ning→neŋ), ⟨o⟩→[ʌ] before ⟨ld⟩ (hold→hʌl).
            const nn = chars[i + 2] ?? "";
            if (c === "i" && next === "n" && nn !== "" && !isV(nn)) { V_("e"); continue; }
            if (c === "o" && next === "l" && nn === "d") { V_("ʌ"); continue; }
            V_(V[c]!);
            continue;
        }

        // ── context consonants ──
        // soft d: ⟨d⟩ → ð only INTERVOCALICALLY or word-finally after a vowel; before a consonant it stays [d].
        if (c === "d") { C_(isV(prev) && (isV(next) || next === "") ? "ð" : "d"); continue; }
        if (c === "r") { C_("ʁ"); continue; } // ⟨r⟩ → uvular ʁ everywhere (folded ʁ~r in the eval)
        if (c === "t") { C_(final && isV(prev) ? "d" : "t"); continue; } // final ⟨t⟩ after a vowel → [d]
        if (c === "c") { C_("eiyæø".includes(next) ? "s" : "k"); continue; } // c soft/hard
        const cp = C[c];
        if (cp !== undefined) C_(cp); // else: unknown char → skip
    }

    // ── stress: place ONE primary ˈ on a FULL nucleus (never on a reduced ə/ɐ). Default first syllable; shift to the
    // syllable AFTER an unstressed prefix. Monosyllables carry no mark (the eval folds stress anyway). ──
    const nuclei = segs.filter((s) => s.nuc);
    if (nuclei.length >= 2) {
        const ord = UNSTRESSED_PREFIX.test(lw) ? 1 : 0;
        const target = nuclei[ord] && !nuclei[ord]!.reduced ? nuclei[ord]! : (nuclei.find((s) => !s.reduced) ?? null);
        if (target) target.stress = true;
    }
    return segs.map((s) => (s.stress ? "ˈ" : "") + s.ph).join("");
}

/** One Danish word → canonical IPA. THREE tiers for the deep orthography: (1) the LEXICON (known words, reference
 *  quality), (2) the perceptron TAGGER (OOV — recovers the context-conditioned vowel quality/reduction the rules miss:
 *  held-out 42.0% vs the rule engine's 25.8%, folded), (3) the RULE engine (fallback when the tagger model is absent). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    return lexicon().get(w) ?? taggerPhonemize(w) ?? phonemizeWordRules(w);
}

// A Danish word (Latin incl. æ ø å + accents) / number / punctuation token.
const TOKEN = /([a-zæøåéöäü]+)|(\d+)|([.!?…,;:])/giu;

class DanishPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // numbers deferred (Danish vigesimal compositor not yet authored)
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Danish phonemizer (lexicon → rule fallback + first-syllable stress; length/stød deferred). */
export function createDanish(): Phonemizer {
    return new DanishPhonemizer();
}
