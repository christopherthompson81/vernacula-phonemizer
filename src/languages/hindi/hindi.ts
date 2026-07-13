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

export interface HindiDef extends AbugidaDef {
    postRules: { from: string; to: string }[];
    finalRules: { from: string; to: string }[];
    numbers: NumbersDef;
    schwaDeletion: {
        deleteWordFinal?: boolean;
        retainInMonosyllable?: boolean;
    };
    clausePunctuation: Record<string, string>;
    symbols?: Record<string, string>;
    stripSymbols?: string;
}

/** Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry. */
export type ForeignPhonemizer = (latin: string) => string;

const VOWEL_G = new RegExp(`[${IPA_VOWELS}]`, "g");
const DIGIT_CLASS = "0-9" + Object.keys(DEVANAGARI_DIGITS).join("");

export function makeNativeHindi(
    def: HindiDef,
    phon: Phonology = loadSharedPhonology(),
    foreign?: ForeignPhonemizer,
) {
    const g2p = makeAbugidaG2P(def, phon);
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
        `([${DEVANAGARI_WORD}]+)|([A-Za-z]+)|([${DIGIT_CLASS}]+(?:,[${DIGIT_CLASS}]+)*(?:\\.[${DIGIT_CLASS}]+)?)` +
            `|([।॥.?!,;:])${symbolClass ? `|([${symbolClass}])` : ""}`,
        "gu",
    );

    function word(w: string): string {
        let x = g2p(w);
        for (const r of post) x = x.replace(r.re, r.to);
        const syls = (x.match(VOWEL_G) || []).length;
        if (
            def.schwaDeletion.deleteWordFinal &&
            !(def.schwaDeletion.retainInMonosyllable && syls <= 1)
        )
            x = x.replace(/ə$/, "");
        x = deleteMedialSchwa(x);
        for (const r of fin) x = x.replace(r.re, r.to);
        return applyWeightStress(x).normalize("NFC");
    }

    const toAscii = (digits: string): string =>
        [...digits]
            .filter((d) => d !== ",")
            .map((d) => DEVANAGARI_DIGITS[d] ?? d)
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

    function text(input: string): string {
        let out = "";
        let pending: string | null = null;
        const emit = (ipa: string): void => {
            if (ipa === "") return;
            if (out === "") out = ipa;
            else if (pending !== null) {
                out += ` ${pending} ${ipa}`;
                pending = null;
            } else out += ` ${ipa}`;
        };
        let m: RegExpExecArray | null;
        while ((m = tokenRe.exec(input)) !== null) {
            if (m[1]) emit(word(m[1]));
            else if (m[2]) emit(foreign ? foreign(m[2]) : "");
            else if (m[3]) emit(number(m[3]));
            else if (m[4]) {
                const mk = CLAUSE_MARK[m[4]];
                if (mk && out !== "") pending = mk;
            } else if (m[5]) {
                if (!strip.includes(m[5]) && symbols[m[5]])
                    emit(word(symbols[m[5]]!));
            }
        }
        if (pending !== null && out !== "") out += ` ${pending}`;
        return out;
    }

    return { word, number, text };
}

/** Load hindi.jsonc (beside this file) and build the Hindi phonemizer. `foreign` handles embedded Latin. */
export function createHindi(foreign?: ForeignPhonemizer): {
    text(input: string): string;
} {
    return makeNativeHindi(
        loadManifest<HindiDef>(import.meta.url, "hindi.jsonc"),
        loadSharedPhonology(),
        foreign,
    );
}
