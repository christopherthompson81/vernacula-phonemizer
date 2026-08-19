/**
 * Native Central Kurdish / Sorani (ckb) text phonemizer — canonical IPA. Iranian (NW), written
 * in the SORANI Perso-Arabic alphabet. Unlike the Arabic/Persian/Urdu abjads, Sorani writes all the LONG vowels
 * (ا→aː, ێ→eː, ۆ→oː, وو→uː, ی→iː) + the short /a/ (ە); only the short /ɪ/ (bizroke) is unwritten (epenthetic in
 * clusters) → not emitted here, and folded in the eval.
 *
 * ⚠ IT IS NOW SUPPLIED BY A LEXICON (`lexicon.tsv`, 2,517 entries), NOT BY A RULE. Emitting it by rule was
 * tried first and is net negative at every quality; the numbers are kept below so it is not tried again. The cost of NOT emitting it is real and measurable: 634 corpus tokens across 54 word types
 * come out with NO NUCLEUS AT ALL (کرد *kɾd*, گشت *ɡʃt*, تر *tɾ*, من *mn*), 1.13% of the language, all of
 * them ordinary high-frequency words. Inserting one vowel after the first consonant removes every one of
 * them (1.13% → 0.00%). Against the audio, every quality is worse:
 *
 *     insert ɪ   52 closer / 500 further        insert e   160 / 392
 *     insert i  133 / 419                       insert ə   106 / 446
 *
 * ⚠ AND THE REFEREE CANNOT ARBITRATE, which is why the audio is the only witness: `ckb.jsonc` folds
 * `[əɪ] → ""` on both sides precisely because the bizroke "is not positionally predictable", so the eval is
 * blind to the change by construction — 922/972 and 977/1037 before and after, byte-identical.
 *
 * ⚠ THE REASON IT FAILS IS LEXICAL, NOT POSITIONAL. A single epenthesis models cluster-breaking, but many of
 * these words are ordinary multi-vowel words written with none of them: سفر is *safar*, and one inserted
 * vowel after the first consonant gives *sɪfɾ* — right about there being a vowel, wrong about how many and
 * which. The recognizer agrees the vowel is usually AUDIBLE (between the ⟨k⟩ and the rhotic of کرد it hears
 * something in 71% of instances) but reports it as `e` 32, `a` 26, `i` 9, `ə` 7 and nothing 29 — no single
 * quality to insert. This wants a coverage lexicon of the Pashto `harakatLexicon` kind, not a rule.
 *
 * ⚠ THE LEXICON MEASURES WORSE AGAINST THE AUDIO AND IS SHIPPED ANYWAY — 148 rows closer, 2,231 further.
 * That is the largest deliberate override in this repo, so the reasoning is spelled out:
 *
 *   · THREE INDEPENDENT HUMAN SOURCES AGREE THE VOWEL IS THERE, AND AGREE WHERE. AsoSoft (the lexicon's
 *     source), wikipron and kaikki: تر is *t ɪ ɾ*, من is *m ɪ n*, مردن is *m ə ɾ d ə n* (two vowels, the
 *     positions this lexicon gives), کوردستان is *k ʊ ɾ d ə s t aː n* (ours: kuɾdɪstaːn, same slot). They
 *     differ only on QUALITY — ɪ against ə — which is precisely why `ckb.jsonc` folds `[əɪ] → ""`.
 *   · THE RECOGNIZER UNDER-TRANSCRIBES THIS LANGUAGE. Its folded phone count is 0.929 of ours for ckb
 *     against 0.987 for de and 0.998 for fr, so it is short by ~7% before anything is added; adding a
 *     phone it does not emit is charged against us whether or not the phone is real.
 *   · AND THE OUTPUT WAS NOT A VARIANT, IT WAS IMPOSSIBLE. ملیۆن came out *mljoːn* and درووست *dɾust* —
 *     no nucleus, unsayable under any analysis. 1.13% → 0.19% of word tokens.
 *
 * The audio is one degraded witness against three human ones on a question — "does this word have a
 * vowel" — that is not a matter of reader variation. If a later run finds the ASR was right, the lexicon
 * is one file.
 *
 * ⚠ AND A LEXICON HERE MUST BE HOMOGRAPH-AWARE, which is the abjad's standing trap: a defectively-written
 * form can be several words, and a whole-word entry silently picks one. Sorani is BETTER placed than Arabic
 * or Persian for this — it writes ⟨و⟩ and ⟨ی⟩, so *Kurd* is کورد and distinct from *kird* کرد — but "better"
 * is not "safe", and the Pashto file already carries the shape of the failure: `کْړ` is sukun'd to no vowel
 * on purpose because that spelling's reading is genuinely contested. Any ckb lexicon needs the same
 * abstention mechanism — record the position, withhold the quality where the spelling is ambiguous — rather
 * than a bare spelling→pronunciation map. ⚠ NOT QUANTIFIED HERE: measuring how much of this class is
 * genuinely homographic needs word-aligned audio, and the proportional windowing available in this corpus
 * catches neighbouring words' vowels, so the per-spelling vowel distributions it produces are too noisy to
 * settle it. Stated as a design constraint, not as a finding. A left-to-right greedy scan (وو digraph, then single
 * letters) resolves the و/ی matres lectionis (glide [w]/[j] next to a vowel, else the vowel [u]/[iː]); ئ→ʔ is the
 * word-initial glottal onset; н→ŋ before a velar. Signatures: pharyngeals ħ/ʕ, velarised ڵ→ɫ, trill ڕ→r vs tap
 * ر→ɾ. Cardinals use the Iranian decimal compositor with the enclitic -u connective (numbers.ts).
 * Complements the Latin-script Kurmanji (kmr).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { renderNumber, spellDigits } from "../../core/numbers.ts";
import { iranianNumberWords, type CkbNumbersDef } from "./numbers.ts";

interface CkbDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    vowelLetters: readonly string[];
    numbers: CkbNumbersDef;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<CkbDef>(import.meta.url, "central-kurdish.jsonc");
const CONS = DEF.consonants;
const VOW = DEF.vowels;
const CLAUSE_MARK = DEF.clausePunctuation;
// Letters that carry a vowel (so an adjacent و/ی is a glide, not a syllabic vowel).
const VOWEL_LETTERS = new Set(DEF.vowelLetters);

/**
 * The BIZROKE lexicon — the unwritten short /ɪ/, which no rule derives (see the header). Every entry
 * differs from this engine's own rule output by inserted /ɪ/ and nothing else, so a hit changes only the
 * vowel and never the consonant skeleton.
 *
 * ⚠ APPLIED ON THE SHIPPED PATH ONLY, never inside `phonemizeWordRules`, which keeps the referee signal
 * non-circular the way `bengali.ts` and `pashto.ts` do. Here it also happens to be non-circular by source:
 * the lexicon is built from AsoSoft, and the referees are wikipron and kaikki.
 */
let LEXICON: ReadonlyMap<string, string> | undefined;
const lexicon = (): ReadonlyMap<string, string> =>
    (LEXICON ??= loadTsvMap(import.meta.url, "lexicon.tsv", (v) => v, { optional: true }));

/** Whether the bizroke lexicon knows this word. ⚠ EXPORTED because absence is invisible in the output —
 *  a rule-derived word and a lexicon hit look identical, so an eval cannot otherwise separate them. */
export function bizrokeLexiconHas(word: string): boolean {
    return lexicon().has(word);
}

/** Pure RULE-ENGINE word→IPA (no lexicon): the honest signal for the referee eval. */
export function phonemizeWordRules(word: string): string {
    return scanWord(word);
}

/** Resolve an OOV word to IPA. Consulted BETWEEN the lexicon and the rule scan (lexicon → oovOverride →
 *  rules); used only by the async neural path (`centralKurdishNeural.ts`), so the sync engine is unchanged. */
export type OovResolver = (word: string) => string | undefined;

/** Phonemize a single Sorani word to canonical IPA. The bizroke comes from the lexicon (or, on the async
 *  path, the tagger); everything else from the scan. */
export function phonemizeWord(word: string, oov?: OovResolver): string {
    return lexicon().get(word) ?? oov?.(word) ?? scanWord(word);
}

function scanWord(word: string): string {
    const w = [...word.replace(/[‌ـ]/gu, "")]; // strip ZWNJ + tatweel
    const toks: string[] = [];
    for (let i = 0; i < w.length; i++) {
        const c = w[i]!;
        const prev = w[i - 1] ?? "";
        const nxt = w[i + 1] ?? "";
        if (c === "و" && nxt === "و") { toks.push("uː"); i++; continue; } // وو → uː
        if (CONS[c] !== undefined) { toks.push(CONS[c]!); continue; }
        if (VOW[c] !== undefined) { toks.push(VOW[c]!); continue; }
        if (c === "ئ") { if (i === 0) toks.push("ʔ"); continue; } // hamza carrier: glottal onset word-initially
        // Matres lectionis: و/ی are glides ([w]/[j]) word-initially or next to a written vowel, else the vowels [u]/[iː].
        const glide = i === 0 || VOWEL_LETTERS.has(prev) || VOWEL_LETTERS.has(nxt);
        if (c === "و") toks.push(glide ? "w" : "u");
        else if (c === "ی") toks.push(glide ? "j" : "iː");
    }
    // н → ŋ before a velar stop.
    for (let k = 0; k < toks.length - 1; k++)
        if (toks[k] === "n" && (toks[k + 1] === "k" || toks[k + 1] === "ɡ")) toks[k] = "ŋ";
    return toks.join("");
}

/** A run of ASCII digits → the spoken Sorani cardinal in canonical IPA (out-of-range integers pass through). */
function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
    // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
    if (!Number.isSafeInteger(n)) return spellDigits(digits, DEF.numbers, phonemizeWord);
    return renderNumber(n, DEF.numbers, phonemizeWord, iranianNumberWords);
}

// A word (Sorani Perso-Arabic letters, U+0600–U+06FF incl. ZWNJ) / number / punctuation token.
import { normalizeCentralKurdish } from "./normalize.ts";

const TOKEN = /([ؠ-ۿ‌]+)|(\d+)|([،؛؟.!?…,:])/gu;

export type ForeignPhonemizer = (latin: string) => string;

class CentralKurdishPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string, oovOverride?: OovResolver): string {
        // Everything the g2p cannot read is rewritten FIRST — see normalize.ts.
        // ⚠ MOST IMPORTANTLY THE ARABIC-INDIC DIGITS ARE FOLDED TO ASCII THERE. The letter class above is
        // U+0620–U+06FF, which CONTAINS U+0660–U+0669, so without the fold a native digit run is claimed by
        // the LETTER branch and read as an empty string — and those are the majority digit system in Kurdish.
        return assembleClauses(normalizeCentralKurdish(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1], oovOverride));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Central Kurdish (Sorani) phonemizer. `foreign` handles embedded Latin runs; numbers via numbers.ts. */
export function createCentralKurdish(foreign?: ForeignPhonemizer): Phonemizer {
    return new CentralKurdishPhonemizer(foreign);
}

/** Build the Central Kurdish engine with a per-call `oovOverride` hook (the async neural path). */
export function createCentralKurdishEngine(): { text: (input: string, oov?: OovResolver) => string } {
    return new CentralKurdishPhonemizer();
}
