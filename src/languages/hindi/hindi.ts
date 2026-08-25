/**
 * Native Hindi text phonemizer — canonical IPA. Assembles the generic abugida modules
 * (G2P + weight-stress + number compositor) with Hindi's self-describing JSONC definition (hindi.jsonc,
 * beside this file).
 *
 * text() handles: Devanagari word runs, number runs (integer + Indian grouping + decimal), clause-
 * terminating punctuation → canonical inline pause marks, symbols (% → प्रतिशत, ₹ stripped), and embedded
 * Latin runs → an injected foreign (en) phonemizer.
 */
import { makeAbugidaG2P, type AbugidaDef } from "../../core/abugida.ts";
import { MANIFEST } from "./manifest.ts";
import type { CountForms } from "../../core/normalizeSymbols.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { applyWeightStress } from "../../core/weightStress.ts";
import { renderNumber, spellDigits, type NumbersDef } from "../../core/numbers.ts";
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
        /** ⚠ A word-final AVAGRAHA ⟨ऽ⟩ (U+093D) retains the inherent vowel it writes. See the note in
         *  wordRules — this is spelling-driven, so it overrides the deletion rule for that word alone.
         *  The SIGN itself comes from `AbugidaScript.avagraha`, since it differs per Brahmic block. */
        retainOnAvagraha?: boolean;
    };
    clausePunctuation: Record<string, string>;
    symbols?: Record<string, string>;
    stripSymbols?: string;
    /**
     * ⚠ THE SHARED SYMBOL TIER's data — NOT the same thing as `symbols` above, which is the BARE-SIGN → word
     * map this engine's own tokenizer reads. Optional because the three languages sharing this interface are
     * migrating one at a time.
     */
    symbolTier?: {
        percent?: CountForms;
        currency?: Record<string, CountForms>;
        units?: Record<string, CountForms>;
        rateDenominators?: Record<string, string>;
        unitPer?: string;
        magnitudes?: string[];
        magnitudeConnective?: string;
        ampersand?: string;
        multiply?: { times: string; by?: string };
        exponentWords?: { squared: CountForms; cubed: CountForms; position?: "before" | "after" };
        bareExponent?: { squared: string; cubed: string; power: string; negative: string };
    };
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
    /**
     * The script's AVAGRAHA sign, for `schwaDeletion.retainOnAvagraha`. ⚠ IT IS PER-SCRIPT, not a
     * constant: the Brahmic blocks are aligned so it sits at offset 0x3D in each — Devanagari ऽ U+093D,
     * Bengali ঽ U+09BD, Gujarati ઽ U+0ABD. Hard-coding the Devanagari one would make the flag silently
     * INERT for any language passing another block, with the manifest still reading as though it were on.
     */
    avagraha?: string;
}

export function makeNativeHindi(
    def: HindiDef,
    phon: Phonology = loadSharedPhonology(),
    foreign?: ForeignPhonemizer,
    script: AbugidaScript = { word: DEVANAGARI_WORD, digits: DEVANAGARI_DIGITS, avagraha: "\u093D" },
    lexicon?: ReadonlyMap<string, string>,
    /**
     * PER-LANGUAGE OVERRIDES for the two things that are Hindi's LEXICAL choices rather than its engine.
     *
     * Nine languages reuse this engine, and until this parameter existed they also inherited Hindi's
     * normalizer and Hindi's symbol words — so Marathi spoke प्रतिशत, बजकर and मिनट, none of which are
     * Marathi. That is the same principle the acronym work settled one layer up: a lexical fact belongs in
     * the language's own data, not in shared machinery.
     *
     * Both default to Hindi's, so a language that supplies neither is byte-identical to before. Six of the
     * nine (bho, mai, mag, awa, hne, rkt) have no FLEURS corpus and so will never come through a
     * normalization batch; leaving them on the Hindi defaults is the honest outcome for them until
     * someone has evidence, and this parameter is how that evidence gets applied without touching Hindi.
     */
    overrides: {
        normalize?: (input: string) => string;
        symbols?: (input: string) => string;
    } = {},
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
        // ⚠ THE LATIN GROUP SPANS ALL OF LATIN, not just ASCII — `[A-Za-z]+` shredded every accented foreign name.
    // A diacritic ENDED the token, so the letter carrying it became an unclaimed gap read as an English LETTER
    // NAME and the rest of the word started over: `São Paulo` in Hindi read *ˈɛs ˈə ˈoᶷ pʰˈɔːloᶷ* — "ES ə O
    // Paulo". One word became three, none of them right.
    // ⚠ INVISIBLE TO EVERY GATE: no digit or raw mark survives and nothing VANISHES, so it is a WRONG-WORD
    // defect that neither the leak classes nor the differential DROP test can see.
    // Simpler than the identical fix in `id`, and for a structural reason: THIS group already means "foreign"
    // (its match goes straight to the injected reader), so widening it is the whole change. Indonesian's Latin
    // group is its NATIVE word group, so widening there also needed a native-vs-foreign decision.
    // `\p{M}` so a DECOMPOSED accent stays with its base instead of ending the token one character later.
    // ⚠ REACHES 17 LANGUAGES, every one that composes `makeNativeHindi`.
    `([${script.word}]+)|(\\p{Script=Latin}[\\p{Script=Latin}\\p{M}]*)|([${DIGIT_CLASS}]+(?:,[${DIGIT_CLASS}]+)*(?:\\.[${DIGIT_CLASS}]+)?)` +
            `|([।॥.?!,;:])${symbolClass ? `|([${symbolClass}])` : ""}`,
        "gu",
    );

    // ⚠ FAIL LOUDLY RATHER THAN SILENTLY DO NOTHING. A manifest asking for avagraha retention under a
    // script that has not declared its avagraha would read as though the rule were on while every final
    // schwa still deleted — the failure mode this codebase keeps turning up. Cheap, and only reachable
    // through misconfiguration.
    const retainOnAvagraha = def.schwaDeletion.retainOnAvagraha === true;
    if (retainOnAvagraha && script.avagraha === undefined)
        throw new Error("schwaDeletion.retainOnAvagraha is set but this script declares no `avagraha` sign");

    /** Pure RULE-ENGINE word→IPA (no lexicon) — the honest, non-circular signal used by the referee eval. */
    function wordRules(w: string): string {
        let x = g2p(w);
        // ⚠ THE AVAGRAHA ⟨ऽ⟩ IS READ FROM THE SPELLING, NOT THE PHONES. In Bhojpuri it WRITES the final
        // inherent vowel that would otherwise delete (करऽ kʌrʌ vs कर kʌr, दऽ dʌ, देखऽ dekʰʌ) — an
        // orthographic instruction to retain, so it is the one retain-condition that cannot be decided
        // from `x`: g2p drops the character, leaving nothing downstream to test. Verified against the
        // grammar-mined referee, where every one of its 31 avagraha forms keeps the vowel.
        const avagraha = retainOnAvagraha && w.endsWith(script.avagraha!);
        for (const r of post) x = x.replace(r.re, r.to);
        const syls = (x.match(VOWEL_G) || []).length;
        if (
            def.schwaDeletion.deleteWordFinal &&
            !avagraha &&
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
        // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA, in every engine built from
        // this maker — hi bgc mr gu ne bho mag hne awa mai rkt, one bug reaching eleven languages.
        // `isSafeInteger` is right to refuse to COMPOSE (the float has already lost the low digits) but the
        // refusal returned the digit string, and no g2p here reads Latin digits. Digit-at-a-time out of
        // `def.numbers.units` is exactly what the decimal tail on the line below already does, so the
        // fallback needs no word these languages' data was never measured on. See core/numbers.ts
        // `spellDigits`: above 2^53 the reading is a digit string, not a quantity.
            const intN = Number(ascii.slice(0, dot) || "0");
            const head = Number.isSafeInteger(intN)
                ? renderNumber(intN, def.numbers, word)
                : spellDigits(ascii.slice(0, dot), def.numbers, word);
            const frac = [...ascii.slice(dot + 1)].map((d) =>
                word(def.numbers.units[Number(d)]!),
            );
            return [head, word(def.numbers.decimalWord), ...frac].join(" ");
        }
        const n = Number(ascii);
        if (!Number.isSafeInteger(n)) return spellDigits(ascii, def.numbers, word);
        return renderNumber(n, def.numbers, word);
    }

    // ⚠ THE HINDI-SPECIFIC REWRITES RUN BEFORE THE SHARED SYMBOL TIER, whose unit keys are LATIN — ordinal
    // suffixes, Devanagari unit abbreviations, abbreviations, clock, signs, fractions.
    // Roman numerals need no ordering care: `hi` is not in the registry's ROMAN_NATIVE set, so the shared
    // pass has already run at the registry seam.
    const normalize = overrides.normalize ?? makeHindiNormalizer(def.numbers);
    const symbolTier = overrides.symbols ?? SYMBOLS;

    function text(input: string): string {
        return assembleClauses(symbolTier(normalize(input)), tokenRe, (m, sink) => {
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
// प्रतिशत is invariant, and the units follow the number.
/** ⚠ NON-NULL: hindi.jsonc declares `symbolTier`; the field is optional on the SHARED HindiDef
 *  because hi/mr/gu are migrating one at a time. */
const SYM = MANIFEST.symbolTier!;

const SYMBOLS = makeSymbolNormalizer({
    percent: SYM.percent,
    currency: SYM.currency,
    units: SYM.units,
    exponentWords: SYM.exponentWords,
    bareExponent: SYM.bareExponent,
    multiply: SYM.multiply,
});

export function createHindi(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    return makeNativeHindi(
        MANIFEST,
        loadSharedPhonology(),
        foreign,
    );
}
