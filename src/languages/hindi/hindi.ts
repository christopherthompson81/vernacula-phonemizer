/**
 * Native Hindi text phonemizer — canonical IPA, espeak-independent. Assembles the generic abugida modules
 * (G2P + weight-stress + number compositor) with Hindi's self-describing JSONC definition (hindi.jsonc,
 * beside this file). No espeak rules/tables/dict/numbers.
 *
 * text() handles: Devanagari word runs, number runs (integer + Indian grouping + decimal), clause-
 * terminating punctuation → canonical inline pause marks, symbols (% → प्रतिशत, ₹ stripped), and embedded
 * Latin runs → an injected foreign (en) phonemizer.
 */
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { applyWeightStress } from "../../core/weightStress.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadSharedPhonology, type Phonology } from "../../core/phonology.ts";
import { deleteMedialSchwa } from "../../core/schwa.ts";
import {
    DEVANAGARI_DIGITS,
    DEVANAGARI_WORD,
    IPA_VOWELS,
} from "../../core/unicode.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { makeHindiNormalizer } from "./normalize.ts";

export interface HindiDef extends AbugidaDef {
    postRules: { from: string; to: string }[];
    finalRules: { from: string; to: string }[];
    numbers: NumbersDef;
    schwaDeletion: {
        deleteWordFinal?: boolean;
        retainInMonosyllable?: boolean;
        retainFinalAfterCluster?: boolean;
    };
    clausePunctuation: Record<string, string>;
    symbols?: Record<string, string>;
    stripSymbols?: string;
}

/** Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry. */
export type ForeignPhonemizer = (latin: string) => string;

const VOWEL_G = new RegExp(`[${IPA_VOWELS}]`, "g");

/** Does the coda (a word body with the final schwa already removed) end in a consonant CLUSTER or GEMINATE?
 *  Used by `retainFinalAfterCluster` (Marathi): the word-final inherent schwa is deleted after a single
 *  consonant (घर→ɡʱəɾ) but RETAINED to avoid a word-final cluster (अंक→əŋkə, महत्त्व→məɦət̪ːʋə, अन्न→ənːə).
 *  Affricates (t͡ʃ d͡ʒ t͡s d͡z) are ONE consonant (आज→aːd͡z deletes); a length mark ː is a geminate = heavy. */
export function heavyFinalCoda(body: string): boolean {
    // Geminate/long CONSONANT coda (क्क→kː) is heavy. Guard the ː to a consonant so a (structurally
    // unreachable, but defensive for future flag users) trailing long VOWEL isn't misread as a geminate.
    if (new RegExp(`[^${IPA_VOWELS}]ː$`).test(body)) return true;
    // Collapse affricates to a single placeholder BEFORE stripping the (combining) tie bar, so d͡z counts as 1.
    const collapsed = body
        .replace(/t͡ʃ|d͡ʒ|t͡s|d͡z/g, "Ç")
        .normalize("NFD")
        .replace(/[̀-ͯʰ-ʱːˈˌ]/g, ""); // drop combining marks, ʰ ʱ, ː, stress
    let n = 0;
    const chars = [...collapsed];
    for (let i = chars.length - 1; i >= 0; i--) {
        const c = chars[i]!;
        if (IPA_VOWELS.includes(c)) break;
        if (c.trim() !== "") n++;
    }
    return n >= 2;
}

/** The script's word-run char class + digit map — defaults to Devanagari (Hindi/Marathi); Gujarati etc. pass
 *  their own so the whole abugida orchestration (schwa deletion, weight stress, numbers) is reused as-is. */
export interface AbugidaScript {
    word: string;
    digits: Record<string, string>;
}

export function makeNativeHindi(
    def: HindiDef,
    phon: Phonology = loadSharedPhonology(),
    foreign?: ForeignPhonemizer,
    script: AbugidaScript = { word: DEVANAGARI_WORD, digits: DEVANAGARI_DIGITS },
    lexicon?: ReadonlyMap<string, string>,
) {
    const g2p = makeAbugidaG2P(def, phon);
    const DIGIT_CLASS = "0-9" + Object.keys(script.digits).join("");
    const CLAUSE_MARK = def.clausePunctuation; // Devanagari danda ।/॥ + ASCII → canonical pause (from hindi.jsonc)
    const post = def.postRules.map((r) => ({
        re: new RegExp(r.from, "gu"),
        to: r.to,
    }));
    const fin = def.finalRules.map((r) => ({
        re: new RegExp(r.from, "gu"),
        to: r.to,
    }));
    const symbols = def.symbols ?? {};
    const strip = def.stripSymbols ?? "";
    const symbolClass = [...Object.keys(symbols), ...strip].join("");
    const tokenRe = new RegExp(
        `([${script.word}]+)|([A-Za-z]+)|([${DIGIT_CLASS}]+(?:,[${DIGIT_CLASS}]+)*(?:\\.[${DIGIT_CLASS}]+)?)` +
            `|([।॥.?!,;:])${symbolClass ? `|([${symbolClass}])` : ""}`,
        "gu",
    );

    /** Pure RULE-ENGINE word→IPA (no lexicon) — the honest, non-circular signal used by the referee eval. */
    function wordRules(w: string): string {
        let x = g2p(w);
        for (const r of post) x = x.replace(r.re, r.to);
        const syls = (x.match(VOWEL_G) || []).length;
        if (
            def.schwaDeletion.deleteWordFinal &&
            !(def.schwaDeletion.retainInMonosyllable && syls <= 1) &&
            !(
                def.schwaDeletion.retainFinalAfterCluster &&
                /ə$/.test(x) &&
                heavyFinalCoda(x.slice(0, -1))
            )
        )
            x = x.replace(/ə$/, "");
        x = deleteMedialSchwa(x);
        for (const r of fin) x = x.replace(r.re, r.to);
        return applyWeightStress(x).normalize("NFC");
    }

    /** SHIPPED word→IPA: a whole-word lexicon override (for the proven-lexical schwa tail) then the rule engine. */
    function word(w: string): string {
        return lexicon?.get(w.normalize("NFC")) ?? wordRules(w);
    }

    const toAscii = (digits: string): string =>
        [...digits]
            .filter((d) => d !== ",")
            .map((d) => script.digits[d] ?? d)
            .join("");

    function number(digits: string): string {
        const ascii = toAscii(digits);
        const dot = ascii.indexOf(".");
        if (dot >= 0 && def.numbers.decimalWord) {
            const intN = Number(ascii.slice(0, dot) || "0");
            if (!Number.isSafeInteger(intN)) return ascii;
            const frac = [...ascii.slice(dot + 1)].map((d) =>
                word(def.numbers.units[Number(d)]!),
            );
            return [
                renderNumber(intN, def.numbers, word),
                word(def.numbers.decimalWord),
                ...frac,
            ].join(" ");
        }
        const n = Number(ascii);
        if (!Number.isSafeInteger(n)) return ascii;
        return renderNumber(n, def.numbers, word);
    }

    // #562 normalization: Hindi-specific rewrites (ordinal suffixes, Devanagari unit abbreviations,
    // abbreviations, clock, signs, fractions) BEFORE the shared symbol tier, whose unit keys are Latin.
    // Roman numerals need no ordering care: `hi` is not in the registry's ROMAN_NATIVE set, so the shared
    // pass has already run at the registry seam.
    const normalize = makeHindiNormalizer(def.numbers);

    function text(input: string): string {
        return assembleClauses(SYMBOLS(normalize(input)), tokenRe, (m, sink) => {
            if (m[1]) sink.emit(word(m[1]));
            else if (m[2]) sink.emit(foreign ? foreign(m[2]) : "");
            else if (m[3]) sink.emit(number(m[3]));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk) sink.pause(mk);
            } else if (m[5]) {
                if (!strip.includes(m[5]) && symbols[m[5]])
                    sink.emit(word(symbols[m[5]]!));
            }
        });
    }

    return { word, wordRules, number, text };
}

/** Load hindi.jsonc (beside this file) and build the Hindi phonemizer. `foreign` handles embedded Latin. */
// #562 symbol normalization — Hindi (प्रतिशत is invariant; units after the number).
const SYMBOLS = makeSymbolNormalizer({
    percent: ["प्रतिशत"],
    currency: { "$": ["डॉलर"], "€": ["यूरो"], "£": ["पाउंड"], "₹": ["रुपये"], "¥": ["येन"] },
    units: { km: ["किलोमीटर"], cm: ["सेंटीमीटर"], mm: ["मिलीमीटर"], kg: ["किलोग्राम"] },
});

export function createHindi(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "hindi.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}
