/**
 * Loads the Yoruba data manifest (yoruba.jsonc) once at module init and exposes it typed. Holds the context-free
 * hand-authored DATA — the orthography→IPA tables, the three tones, clause punctuation and the vigesimal cardinal
 * numbers; the ALGORITHM stays in code (yoruba.ts, numbers.ts).
 */
import { loadManifest } from "../../core/loadManifest.ts";

export interface YorubaManifest {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    tones: { high: string; mid: string; low: string };
    clausePunctuation: Record<string, string>;
    /** Symbol readings for normalize.ts. See yoruba.jsonc for the corpus count behind each. */
    symbols: {
        /** `sí` — a digit-flanked dash is a RANGE in Yoruba, never a minus. */
        range: string;
        /** ⚠ The percent is a CIRCUMFIX: `ìdá` NUMBER `nínú ọgọ́rùn-ún`. */
        percentBefore: string;
        percentAfter: string;
        /** `àti dásímà` — "and decimal"; the fraction that follows is read digit by digit. */
        decimalWord: string;
        and: string;
        /** The squared measure word, emitted AFTER the unit noun: `kìlómítà onígun mẹ́rin`. */
        squared: string;
        /** ⚠ Temperature is a CIRCUMFIX: `ìwọ̀n` before the number, the scale name after. */
        degree: string;
        /** Scale letter → its name, borrowed unchanged from English by this corpus. */
        scales: Record<string, string>;
        /** `lọ́nà` — the same multiplicative particle numbers.ts uses (`ẹgbẹ̀rún lọ́nà ogún` = 1000×20). */
        times: string;
    };
    /** Cardinal numbers — VIGESIMAL, with addition and subtraction. See yoruba.jsonc for the sourcing of each. */
    numbers: {
        zero: string;
        /** Free forms 1..10, for a numeral standing alone. Slot 0 is unused. */
        units: string[];
        /** Fusing forms 1..9, used at the front of a compound (mọ́kàn-, méjì-). Slot 0 unused. */
        front: string[];
        /** Tens 20..100: the free word, and the fused base that follows lé-/dín-. Keyed by the value. */
        tens: Record<string, { free: string; fused: string }>;
        /** The 11-14 suffix: unit + `lá`. */
        teen: string;
        /** 15 and 25 are irregular, and the irregular form is the commoner one. */
        fifteen: string;
        twentyFive: string;
        /** The additive infix (1-4 past a ten) and the subtractive one (5-9 toward the ten above). */
        add: string;
        subtract: string;
        /** Hundreds 100..900 — irregular words, not multiples. Slot 0 unused. */
        hundreds: string[];
        thousand: string;
        million: string;
        billion: string;
        /** ×1 after a thousand or above: `ẹgbẹ̀rún kan`. Hundreds take no such word. */
        multiplierOne: string;
        /** Multiplies a magnitude when the multiplier is above ten: `ẹgbẹ̀rún lọ́nà méjìlélọ́gbọ̀n`. */
        times: string;
        /** Joins a magnitude to its remainder: `irinwó ó lé ọgọ́rin` (480). */
        join: string;
    };
}

/** The consolidated hand-authored Yoruba data tables (see yoruba.jsonc). */
export const MANIFEST = loadManifest<YorubaManifest>(import.meta.url, "yoruba.jsonc");
