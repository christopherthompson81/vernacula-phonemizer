/**
 * Native Armenian text phonemizer — canonical IPA. Armenian is very nearly one letter ↔ one
 * phoneme, so this is a left-to-right greedy scan over a grapheme table with a few code rules: DIGRAPHS (⟨ու⟩→[u], and
 * for Western the ⟨յու⟩/⟨իւ⟩→[ʏ], ⟨յո⟩→[œ] sequences), the WORD-INITIAL glides ⟨ե⟩→[je], ⟨ո⟩→[vo], ⟨և⟩→[jev] (bare
 * [e]/[o]/[ev] elsewhere), the ligature ⟨և⟩→[ev], and schwa epenthesis in initial/final clusters.
 *
 * The engine is PARAMETERIZED by a manifest (`makeArmenianEngine`) so the two standards share it:
 *   - EASTERN (hy, armenian.jsonc) — the Yerevan standard; the classical three-way stops kept as voiced/voiceless/
 *     aspirated (բ պ փ = b p pʰ), tap ⟨ր⟩→ɾ vs trill ⟨ռ⟩→r.
 *   - WESTERN (hyw, westarmenian.ts / westarmenian.jsonc) — the CONSONANT SHIFT: classical voiced ⟨բ դ գ ձ ջ⟩ and
 *     classical aspirate ⟨փ թ ք ց չ⟩ MERGE to voiceless-aspirated [pʰ tʰ kʰ t͡sʰ t͡ʃʰ], while classical voiceless
 *     ⟨պ տ կ ծ ճ⟩ become VOICED [b d ɡ d͡z d͡ʒ]; the ⟨ր⟩/⟨ռ⟩ rhotics neutralise to a single tap [ɾ].
 *
 * Validated vs wikipron hye_armn_e (Eastern) / hye_armn_w (Western).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { renderNumber, spellDigits, westernNumberWords, type NumbersDef } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeArmenian } from "./normalize.ts";

export interface ArmenianDef {
    vowels: Record<string, string>;
    consonants: Record<string, string>;
    // Multi-character grapheme sequences resolved greedily (longest-first) BEFORE the single-letter map and the
    // word-initial glides. Always includes ⟨ու⟩→[u]; Western adds ⟨իւ⟩→[ʏ].
    digraphs: Record<string, string>;
    // Digraphs that apply ONLY after a consonant (the preceding emitted phoneme is not a vowel). Western ⟨յու⟩→[ʏ] is
    // front-rounded after a consonant (-ություն→[…utʰʏn]) but the glide [ju] word-initially / after a vowel
    // (յուղ→[juʁ], -այություն→[…ɑjutʰʏn]). Optional; Eastern has none.
    postConsonantDigraphs?: Record<string, string>;
    numbers: NumbersDef; // includes the optional `hundreds` field read by westernNumberWords
    clausePunctuation: Record<string, string>;
    /** Irregular ordinals; the regular suffix rule stays in normalize.ts. Shared with hyw. */
    irregularOrdinals: Record<string, string>;
}

const isVowelPh = (p: string): boolean => /[ɑeiouəʏœ]/u.test(p); // a phoneme that carries a vowel (je/vo/jev included)
const isSonorant = (p: string): boolean => /^[lmnɾrj]/u.test(p); // sonorants (for final-cluster sonority)

/**
 * Build a full Armenian engine (phonemizer + word g2p) from one dialect manifest.
 *
 * `pre` is the dialect's own text-normalization pass, applied to the raw input before tokenizing. It is a
 * PARAMETER rather than a fixed import because the two standards do not share one: hy's `normalize.ts` is
 * measured against hy's own corpus, and Western Armenian has neither a layer nor a mined artifact to
 * measure one against. A sibling is a hypothesis, not a source (trap 55) — so hyw passes nothing and its
 * reading is byte-identical to what it was.
 */
export function makeArmenianEngine(def: ArmenianDef, pre: (s: string) => string = (s) => s) {
    const CLAUSE_MARK = def.clausePunctuation;
    const MAP: Record<string, string> = { ...def.consonants, ...def.vowels }; // vowels win the shared ⟨ո⟩ key (→o bare)
    // Digraph keys sorted longest-first so a 3-char sequence is tried before a 2-char one.
    const DIGRAPHS = Object.entries(def.digraphs).sort((a, b) => b[0].length - a[0].length);
    const POST_C_DIGRAPHS = Object.entries(def.postConsonantDigraphs ?? {}).sort((a, b) => b[0].length - a[0].length);
    // A valid complex ONSET: ⟨ս/շ⟩ + a stop that is the reflex of a classical voiceless-ish stop ⟨պ տ կ փ թ ք⟩ (սպ→sp
    // in Eastern, սպ→sb in Western). Derived from the manifest so it's dialect-correct; everything else needs a schwa.
    const ONSET_STOP = new Set(["պ", "տ", "կ", "փ", "թ", "ք"].map((g) => MAP[g]!));
    // A valid 2-consonant onset: ⟨ս/շ⟩+stop (սպ→sp/sb), OR any consonant + the glide ⟨յ⟩→[j] (Cj- is a licit onset,
    // գյափիկ→kʰjɑpʰiɡ not kʰəjɑpʰiɡ) — so neither takes a schwa.
    const validOnset2 = (a: string, b: string): boolean => ((a === "s" || a === "ʃ") && ONSET_STOP.has(b)) || b === "j";

    /** Armenian schwa epenthesis (Vaux 1998, simplified) — see the original notes; unchanged across dialects. */
    function epenthesize(out: string[]): void {
        // A word with NO vowel at all (a lone consonant letter cited by name, an abbreviation) takes a support [ə]:
        // ⟨Բ⟩→[bə] (Eastern) / [pʰə] (Western). Real words always have a vowel, so this only touches citations.
        if (out.length >= 1 && !out.some(isVowelPh)) { out.push("ə"); return; }
        let lv = -1;
        for (let i = out.length - 1; i >= 0; i--) if (isVowelPh(out[i]!)) { lv = i; break; }
        const last = out[out.length - 1]!;
        if (out.length - 1 - lv >= 2 && !isSonorant(out[out.length - 2]!) && isSonorant(last) && last !== "m") {
            out.splice(out.length - 1, 0, "ə");
        }
        let fv = out.length;
        for (let i = 0; i < out.length; i++) if (isVowelPh(out[i]!)) { fv = i; break; }
        if (fv >= 2) {
            if (validOnset2(out[0]!, out[1]!)) {
                if (fv > 2) out.splice(2, 0, "ə");
            } else {
                out.splice(1, 0, "ə");
            }
        }
    }

    /** One Armenian word → canonical IPA. */
    function phonemizeWord(word: string): string {
        const chars = [...word.toLowerCase()];
        const out: string[] = [];
        for (let i = 0; i < chars.length; i++) {
            const c = chars[i]!;
            const prevPh = out[out.length - 1];
            // POST-CONSONANT digraphs (Western ⟨յու⟩→ʏ) — only when the previous emitted phoneme is a consonant; else
            // the sequence falls through to the plain digraph/letter path (⟨յ⟩→j + ⟨ու⟩→u = [ju]).
            if (prevPh !== undefined && !isVowelPh(prevPh)) {
                const pc = POST_C_DIGRAPHS.find(([k]) => chars.slice(i, i + [...k].length).join("") === k);
                if (pc) { out.push(pc[1]); i += [...pc[0]].length - 1; continue; }
            }
            // DIGRAPHS (longest-first): ⟨ու⟩→u, and Western ⟨իւ⟩→ʏ — before the ո→vo/o rules.
            const dg = DIGRAPHS.find(([k]) => chars.slice(i, i + [...k].length).join("") === k);
            if (dg) {
                out.push(dg[1]);
                i += [...dg[0]].length - 1;
                continue;
            }
            // WORD-INITIAL glides: ⟨ե⟩→[je], ⟨ո⟩→[vo], ⟨և⟩→[jev]
            if (i === 0) {
                if (c === "ե") { out.push("je"); continue; }
                if (c === "ո") { out.push(chars[i + 1] === "վ" ? "o" : "vo"); continue; } // ո→[o] before ⟨վ⟩ (avoid *vov)
                if (c === "և") { out.push("jev"); continue; }
            }
            if (c === "և") { out.push("ev"); continue; } // ligature elsewhere → [ev] (Երևան→jeɾevɑn)
            const ph = MAP[c];
            if (ph !== undefined) out.push(ph);
            // else: unknown char (skip)
        }
        epenthesize(out);
        return out.join("");
    }

    function number(digits: string): string {
        const n = Number(digits);
        // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
        // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
        // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
        // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
        // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
        if (!Number.isSafeInteger(n)) return spellDigits(digits, def.numbers, phonemizeWord);
        return renderNumber(n, def.numbers, phonemizeWord, westernNumberWords);
    }

    // Armenian letters (U+0530–058F) + the ligature և; number; Armenian + ASCII punctuation.
    const TOKEN = /([Ա-Ֆա-ևև]+)|(\d+)|([.?!,;:…՝՞։])/gu;

    class ArmenianPhonemizer implements Phonemizer {
        text(input: string): string {
            return assembleClauses(pre(input), TOKEN, (m, sink) => {
                if (m[1]) sink.emit(phonemizeWord(m[1]));
                else if (m[2]) sink.emit(number(m[2]));
                else if (m[3]) {
                    const mk = CLAUSE_MARK[m[3]];
                    if (mk) sink.pause(mk);
                }
            });
        }
    }

    return { phonemizeWord, create: () => new ArmenianPhonemizer() };
}

/**
 * The shared SYMBOL tier for EASTERN Armenian only. Every word here is sourced in the header of
 * `normalize.ts`, with the sense read; the counts are from `tools/corpus/mined/hy.jsonc`.
 *
 * WHY THE TIER RATHER THAN LOCAL RULES (trap 47's test — can the tier say it?). Armenian postposes the
 * percent word, the currency noun and the unit noun after an INVARIANT numeral (`83 տոկոս` and
 * `95 տոկոսը` take the same form; `5 մետր`, `2500 մետր`), so one CountForms entry each is the whole of the
 * agreement, and the magnitude hop `159,681 մլրդ $` → *…միլիարդ դոլար* is exactly what the tier composes.
 * The two shapes it CANNOT reach — a bound suffix on the unit, and the ASCII exponent — are claimed in
 * `normalize.ts` steps 5 and 6, which run first.
 */
const SYMBOLS = makeSymbolNormalizer({
    // `տոկոս` ×11 in the corpus, every one postposed after a figure and no competing sense.
    percent: ["տոկոս"],
    // ⚠ ONLY THE SIGNS THIS CORPUS WRITES (trap 12): `$` ×30 and `€` ×1. The Armenian dram's own sign `֏`
    // is ×0, so `դրամ` is deliberately not declared — and its bare corpus count of 3 is a trap-37 lead
    // anyway (մետաղադրամներ "coins", դրամատիկական "dramatic").
    currency: { "$": ["դոլար"], "€": ["եվրո"] },
    // The magnitude abbreviations are expanded to these spellings in normalize.ts step 4, so by the time
    // the tier runs `$2.81 տրլն` reads as `տրիլիոն` and the hop can match it.
    // ⚠ `հազար` IS IN THE LIST although it is also the engine's own thousand-word, and the reason is the
    // UNIT path, not the currency one: `magnitudes` gates the tier's connective hop in BOTH consumers, and
    // hy writes `65 հազար ՀԱ` and `1,4 հազար ԿՄ²` — where without it the magnitude stands between the
    // number and its unit, the adjacency guard declines, and `հա`/`կմ` reach the IPA raw. (The playbook's
    // "one declaration, two consumers" note, arriving from the other direction: Italian withheld the field
    // to protect the currency reading and silently broke the unit one.)
    magnitudes: ["միլիոն", "միլիարդ", "տրիլիոն", "հազար"],
    // ⚠ `գ` (gram) IS NOT DECLARED: this corpus writes `գ.` for ԳՅՈՒՂ, "village". See normalize.ts.
    // The one-letter key `մ` IS declared — digit-adjacent `մ` is ×20 in the retained corpus and every one
    // is a metre, and hy writes NO dotted versions at all (10 `\d+\.\d+`+letter shapes, all decimals), so
    // trap 46's `802.11m` exposure does not exist here.
    units: {
        "կմ": ["կիլոմետր"], "սմ": ["սանտիմետր"], "մմ": ["միլիմետր"],
        "կգ": ["կիլոգրամ"], "հա": ["հեկտար"], "դմ": ["դեցիմետր"], "մ": ["մետր"],
        // The LATIN abbreviations, which hy.wikipedia's own definitional articles name as the
        // international form of the same Armenian word — "Քառակուսի կիլոմետր (կմ², km², քառ. կմ)",
        // "Սանտիմետր (հայերեն հապավումը. սմ; միջազգայինը. cm)", "Կիլոգրամ (նշանակումը՝ կգ, kg)" — and
        // which the corpus does use (`800-2000 mm`, ×2). ⚠ LATIN `m` IS NOT AMONG THEM: a one-letter Latin
        // key after a digit is the `Il-76s` exposure, and hy writes its metres as ⟨մ⟩ anyway (×20).
        km: ["կիլոմետր"], cm: ["սանտիմետր"], mm: ["միլիմետր"], kg: ["կիլոգրամ"],
    },
    // BEFORE the noun, in both sources: `55 խորանարդ կիլոմետր` (corpus) and hy.wikipedia's own definitional
    // "Քառակուսի կիլոմետր (կմ², km², քառ. կմ), մակերեսի չափման միավոր".
    exponentWords: { squared: ["քառակուսի"], cubed: ["խորանարդ"], position: "before" },
});

// EASTERN Armenian (hy) — the default export path, loaded from armenian.jsonc.
// ⚠ normalize FIRST, then the tier. normalize's ordinal, suffix and era steps need the number and its
// written suffix still adjacent, which the tier would break; and its unit+suffix step (6) has to claim
// `10 կմ-ից` before the tier matches the bare `կմ` and leaves the suffix stranded as a free word.
const eastern = makeArmenianEngine(
    loadManifest<ArmenianDef>(import.meta.url, "armenian.jsonc"),
    (s) => SYMBOLS(normalizeArmenian(s)),
);

/** One Eastern Armenian word → canonical IPA. */
export const phonemizeWord = eastern.phonemizeWord;

/** Build the Eastern Armenian phonemizer. */
export function createArmenian(): Phonemizer {
    return eastern.create();
}
