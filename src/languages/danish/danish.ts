/**
 * Danish (da) phonemizer — Standard rigsdansk, canonical IPA, espeak-independent. Danish is the DEEPEST European
 * orthography: stressed-vowel QUALITY, soft-d/g realisation, reduction, length, and stød are largely LEXICAL / not
 * recoverable from spelling by rule. So the primary path is a PRONUNCIATION LEXICON (da-lexicon.tsv, ~37k = the NST
 * lexicon ∩ the top-50k OpenSubtitles-da frequency head, Nasjonalbiblioteket / Språkbanken CC0 — the NARROW convention:
 * r-vocalisation ɐ, stop lenition, soft-d ð, length ː, stød ˀ); the neural BiLSTM tagger (async path, daNeural.ts,
 * trained on the full 199k NST) then the rule g2p
 * (phonemizeWordRules) are the OOV fallbacks. The rule engine is a left-to-right scan with Danish context rules
 * (soft-d ⟨d⟩→ð intervocalic/final; af-→aw glide; coda handling; final-⟨t⟩-after-vowel→d; -er/-et/-en/-el reductions;
 * silent-h before j/v/…; ng→ŋ) + a first-syllable (unstressed-prefix-aware) STRESS model; it folds length/stød/
 * aspiration (the referee eval measures THIS engine — non-circular). See docs/investigations/da_nst_ingest_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { normalizeDanish } from "./normalize.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const V = MANIFEST.vowels;
const C = MANIFEST.consonants;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const isV = (ch: string): boolean => ch !== "" && ch in V;

// Pronunciation lexicon (word → canonical IPA, ~37k = NST ∩ top-50k freq, via tools/danish/build_da_nst.py). The
// PRIMARY path: Danish vowel quality/reduction/length/stød is unrecoverable by rule, so a known word is looked up here.
let LEX: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEX === undefined) LEX = loadTsvMap(import.meta.url, "da-lexicon.tsv", undefined, { optional: true });
    return LEX;
}

/** The NST pronunciation lexicon (lowercased word → IPA). Exposed so the async neural path (daNeural.ts) can skip
 *  lexicon-covered words — they are served authoritatively by the sync lexicon path. */
export function danishLexicon(): Map<string, string> {
    return lexicon();
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

/** Per-call OOV resolver: the raw word (as tokenized, NOT lowercased) → IPA, or undefined to defer to the rule engine.
 *  Consulted BETWEEN the lexicon and the rule g2p (lexicon → oovOverride → rule); used only by the async neural path
 *  (daNeural.ts), which keys by the raw match so it can share the fleet `wordLevelNeuralPrepass` (nb/bn pattern). */
export type OovResolver = (word: string) => string | undefined;

/** One Danish word → canonical IPA. THREE tiers for the deep orthography: (1) the LEXICON (NST ∩ top-50k freq, ~37k
 *  known words at reference quality — the narrow convention: r-vocalisation, lenition, soft-d, length, stød), (2) the
 *  neural TAGGER via `oovOverride` (the BiLSTM, async path only — trained on the full 199k NST, ~96% symbol held-out), (3) the
 *  RULE engine (fallback when the tagger is absent OR declines). The old averaged-perceptron tier was dropped — it was
 *  trained on the small broad-convention lexicon and is superseded by the NST lexicon + BiLSTM. */
export function phonemizeWord(word: string, oovOverride?: OovResolver): string {
    const w = word.toLowerCase();
    return lexicon().get(w) ?? oovOverride?.(word) ?? phonemizeWordRules(word);
}

// A Danish word (Latin incl. æ ø å + loanword accents é ö ä ü ó è ã à) / number / punctuation token. The accent set
// must cover every letter that appears in a da-lexicon.tsv key, else that entry is unreachable and the word is split
// at the missing char (voilà → "voil"); it also feeds the neural WORD regex in daNeural.ts (keep the two in sync).
const TOKEN = /([a-zæøåéöäüóèãà]+)|(\d+)|([.!?…,;:])/giu;

class DanishPhonemizer implements Phonemizer {
    // `oovOverride` (neural path only, daNeural.ts) resolves OOV words between the lexicon and the rule g2p; the sync
    // path omits it, so behaviour is byte-identical to phonemize(text, "da").
    text(rawInput: string, oovOverride?: OovResolver): string {
        // #562: everything the g2p cannot read is rewritten to Danish words FIRST — see normalize.ts for
        // the ordered steps and, in particular, why Danish is NOT Norwegian (the period is a thousands
        // separator here, and there is no space grouping at all).
        return assembleClauses(normalizeDanish(rawInput), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1], oovOverride));
            // Numbers: the vigesimal/units-first compositor (numbers.ts) → each word through the same 3-tier g2p.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd, oovOverride));
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Danish phonemizer (NST lexicon → rule fallback). The returned `text` takes an optional per-call
 *  `oovOverride` (neural path only) injecting BiLSTM readings for OOV words; still assignable to Phonemizer. */
export function createDanish(): { text(input: string, oovOverride?: OovResolver): string } {
    return new DanishPhonemizer();
}
