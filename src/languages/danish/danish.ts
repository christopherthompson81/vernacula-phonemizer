/**
 * Danish (da) phonemizer — Standard rigsdansk, canonical IPA. Danish is the DEEPEST European
 * orthography: stressed-vowel QUALITY, soft-d/g realisation, reduction, length, and stød are largely LEXICAL / not
 * recoverable from spelling by rule. So the primary path is a PRONUNCIATION LEXICON (da-lexicon.tsv, ~37k = the NST
 * lexicon ∩ the top-50k OpenSubtitles-da frequency head, Nasjonalbiblioteket / Språkbanken CC0 — the NARROW convention:
 * r-vocalisation ɐ, stop lenition, soft-d ð, length ː, stød ˀ); the neural BiLSTM tagger (async path, daNeural.ts,
 * trained on the full 199k NST) then the rule g2p
 * (phonemizeWordRules) are the OOV fallbacks. The rule engine is a left-to-right scan with Danish context rules
 * (soft-d ⟨d⟩→ð intervocalic/final; af-→aw glide; coda handling; final-⟨t⟩-after-vowel→d; -er/-et/-en/-el reductions;
 * silent-h before j/v/…; ng→ŋ) + a first-syllable (unstressed-prefix-aware) STRESS model; it folds length/stød/
 * aspiration (the referee eval measures THIS engine — non-circular).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
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
/** ⚠ EXPORTED FOR `test/lexicon-reachability.test.ts` — see swedish.ts. */
export function lexicon(): Map<string, string> {
    if (LEX === undefined) LEX = loadTsvMap(import.meta.url, "da-lexicon.tsv", undefined,
        // ⚠ #1068: alias each key to its nativised spelling — `text()` folds before it looks up. 4 keys.
        { optional: true, fold: (k) => nat(k) });
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

        // ── context consonants. ⚠ THE DEFAULT PHONE COMES FROM THE MANIFEST, not from a literal: these four
        // letters never reach the `C[c]` fall-through below, so a literal copy here made `consonants.t`,
        // `.d`, `.r` and `.c` DEAD KEYS that both engines agreed about (the #901 shape — a sabotage sweep
        // over danish.jsonc found all four). Only the CONTEXT ALLOPHONES stay literal; the manifest header
        // says so ("d/g/r/h are overridden by context rules in g2p.ts"). ──
        // soft d: ⟨d⟩ → ð only INTERVOCALICALLY or word-finally after a vowel; before a consonant it stays [d].
        if (c === "d") { C_(isV(prev) && (isV(next) || next === "") ? "ð" : C[c]!); continue; }
        if (c === "r") { C_(C[c]!); continue; } // ⟨r⟩ → uvular ʁ everywhere (folded ʁ~r in the eval)
        if (c === "t") { C_(final && isV(prev) ? "d" : C[c]!); continue; } // final ⟨t⟩ after a vowel → [d]
        if (c === "c") { C_("eiyæø".includes(next) ? "s" : C[c]!); continue; } // c soft/hard
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

/** One Danish word → canonical IPA. ⚠ THREE TIERS, because the orthography is deep: (1) the LEXICON (~37k known
 *  words at reference quality, in the narrow convention — r-vocalisation, lenition, soft-d, length, stød), (2) the
 *  neural TAGGER via `oovOverride` (async path only), (3) the RULE engine, which is the fallback when the tagger
 *  is absent OR declines. */
export function phonemizeWord(word: string, oovOverride?: OovResolver): string {
    const w = word.toLowerCase();
    return lexicon().get(w) ?? oovOverride?.(word) ?? phonemizeWordRules(word);
}

// A Danish word (any Latin run) / number / punctuation token. LATIN_RUN rather than a hand-listed alphabet,
// so no lexicon key can be split at a letter the list forgot (voilà → "voil"); the INVENTORY question is
// `nat` below, which is a different question (see core/hostWord.ts).
// ⚠ danishNeural.ts's pre-pass MUST TOKENIZE AND KEY THE SAME WAY — it imports this module's `DA_WORD` and
// `nat` rather than restating them, because a hand-listed copy drifted and silently skipped the tagger tier
// for every word the nativiser rewrites. See the ⚠ on `WORD` there. ⚠ IT IMPORTS `DA_WORD`, NOT core's
// `LATIN_RUN`: once this arm claimed the medial apostrophe the two stopped being the same regex, and
// importing the shared one would have re-opened the drift that was just closed.
/**
 * ⚠ THE WORD ARM CARRIES A MEDIAL APOSTROPHE, and in Danish that is native orthography rather than a
 * borrowing. `LATIN_RUN` stops at `'`, so the run split and each half was phonemized as its own word:
 *
 *     FN's    → ˈɛfˌɛn ˈɛs      the genitive -s read as the LETTER NAME "S"
 *     DNA'et  → deːɛˈnaːˀ ˈɛd   the definite article read as a separate word
 *     Haiti's → haˈiti ˈɛs
 *
 * 31 instances / 17 distinct types in FLEURS `da_dk` — `USA's`, `FN's`, `DNA'et`, `REM'er` are Danish's own
 * abbreviation-plus-suffix forms, the rest foreign names and possessives. Zero in the parity golden.
 * ⚠ THE GUARD IS A LOOKAHEAD, not a character class: the apostrophe must be FOLLOWED BY A LETTER to belong
 * to the word, or a closing quote joins (`sagde 'nej'` → the token `nej'`) and the s-final genitive
 * `Anders'` stops declining. Same shape as sv (#1073) and nb.
 *
 * ⚠ AND IT DECLINES AFTER TWO CAPITALS, WHICH sv AND nb DID NOT NEED. Danish's own forms attach the suffix
 * to an ABBREVIATION, and that abbreviation is read as LETTER NAMES — joining the run destroys the reading
 * instead of repairing it: `FN's` became the single vowel-less token *fns* where splitting gives
 * *ˈɛfˌɛn ˈɛs*, and `DNA'et` became *dnˈaəð*. So the join is refused when two capitals precede the mark.
 * That is exactly the line the corpus draws: of the 17 distinct types, the seven that want the initialism
 * path (`USA's FN's DNA'et REM'er USOC's UNESCO's AOL's`) all have ≥2 capitals before the apostrophe, and
 * the ten that want joining (`Haiti's Xi'an Io's O'Brien O'Shannessy People's King's Women's Children's
 * President's`) all have at most one — `O'` is a single capital, `Xi` and `Io` are capital-then-lowercase.
 * ⚠ The suffix on a declined form is still its own token (`FN` + `s`), which is what it was before this
 * change; making the genitive attach to a letter-name run is a separate question this does not answer.
 */
const DA_LETTER = "(?!\\p{Nd})[\\p{Script=Latin}]";
export const DA_WORD =
    `${DA_LETTER}(?:${DA_LETTER}|\\p{M}|(?<![A-ZÆØÅ]{2})['\u2019](?=${DA_LETTER}))*`;
// ⚠ `gu`, NOT `giu`, AND THE FLAG IS LOAD-BEARING NOW. Under `/i` a character class is case-insensitive,
// so `[A-ZÆØÅ]` in the apostrophe guard above matched LOWERCASE too and declined `Haiti's` along with
// `FN's` — the same `\p{Lu}`-under-`/i` trap the sl port found two guards built on. The `i` was vestigial
// for every other arm here (`\p{Script=Latin}`, `\d`, and a punctuation class carry no case), so dropping
// it costs nothing and is what lets the guard mean what it says.
const TOKEN = new RegExp(`(${DA_WORD})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where the
 * SCRIPT boundary falls, while this one decides whether the g2p has rules for these letters.
 *
 * ⚠ IT IS NARROWER THAN THE TOKEN CLASS ON PURPOSE. ó è ã à are absent, because the g2p has no rule for them
 * and DROPS them outright — listing them here would promise a rule that does not exist. A word-level fold hides
 * that mismatch (a word containing one is rejected whole, so everything gets folded and the letter comes out
 * readable by accident); judging each character on its own exposes it instead. `NATIVE_CLASS` is a claim about
 * the G2P, and `test/native-inventory.test.ts` measures it rather than trusting it.
 */
const NATIVE_CLASS = "[a-zæøåéöäü]";
/** ⚠ EXPORTED FOR `test/lexicon-reachability.test.ts`, which asserts that every key in this engine's
 *  lexicons survives its own fold. A key the fold rewrites can never be matched from `text()`, and both
 *  engines agree on the miss, so the parity gate cannot see it (#1068). */
export const nat = makeNativiser(NATIVE_CLASS, "iu");

class DanishPhonemizer implements Phonemizer {
    // `oovOverride` (neural path only, daNeural.ts) resolves OOV words between the lexicon and the rule g2p; the sync
    // path omits it, so behaviour is byte-identical to phonemize(text, "da").
    text(rawInput: string, oovOverride?: OovResolver): string {
        // Everything the g2p cannot read is rewritten to Danish words FIRST — see normalize.ts for the ordered
        // steps and, in particular, ⚠ why Danish is NOT Norwegian: the period is a thousands separator here, and
        // there is no space grouping at all.
        return assembleClauses(normalizeDanish(rawInput), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1]), oovOverride));
            // Numbers: the vigesimal/units-first compositor (numbers.ts) → each word through the same 3-tier g2p.
            else if (m[2]) for (const wd of numberToWords(Number(m[2]), m[2]).split(" ")) sink.emit(phonemizeWord(wd, oovOverride));
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Danish phonemizer (NST lexicon → rule fallback). The returned `text` takes an optional per-call
 *  `oovOverride` (neural path only) injecting BiLSTM readings for OOV words; still assignable to Phonemizer. */
export function createDanish(): { text(input: string, oovOverride?: OovResolver): string } {
    return new DanishPhonemizer();
}
