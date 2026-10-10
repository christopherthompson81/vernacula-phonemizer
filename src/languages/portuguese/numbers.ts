/**
 * Portuguese number → words (European convention). Space-separated words with the "e" connector. Covers
 * 0 … <10⁹. Decimals read "vírgula" + digits (handled by the caller).
 */

import { MANIFEST } from "./manifest.ts";

// Number words are authored DATA — consolidated in portuguese.jsonc; the "e"-connector compositor is the algorithm.
const N = MANIFEST.numbers;
const TENS = N.tens,
    HUNDREDS = N.hundreds;
const E = N.connector; // "e"

/** The two varieties: European (`ep`) and Brazilian (`bp`). The one dialect type for the whole engine. */
export type Dialect = "ep" | "bp";

/**
 * THE NUMBER TOKEN: dot = thousands (1.500), comma = decimal (3,14), and a dot after a lone 0 is not a group
 * (`0.5` is *zero . cinco*). ONE SOURCE for the tokenizer (portuguese.ts TOKEN) and for every normalize.ts
 * rule that has to agree with what the tokenizer will say — the degree count reads the same digits.
 */
export const NUMBER_TOKEN = /\d+(?:(?<!(?<!\d)0)\.\d+)*(?:,\d+)?/u;

/** A number token → its integer digits (thousands dots removed) and its decimal digits, if any. */
export function splitNumberToken(tok: string): { intDigits: string; frac: string | undefined } {
    const [intRaw, frac] = tok.split(",");
    return { intDigits: intRaw!.replace(/\./g, ""), frac };
}
// The only EP/BP difference in the number words: the "dez-a-" teens 16/17/19 are "dez-e-" in Brazil.
const SMALL_BP: Record<number, string> = {
    16: "dezesseis",
    17: "dezessete",
    19: "dezenove",
};
const small = (i: number, dialect: Dialect): string =>
    (dialect === "bp" ? SMALL_BP[i] : undefined) ?? N.small[i]!;

/** 0 ≤ n < 100 */
function below100(n: number, dialect: Dialect): string {
    if (n < 20) return small(n, dialect);
    const t = Math.floor(n / 10),
        u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]} ${E} ${small(u, dialect)}`;
}

/** 1 ≤ n < 1000 */
function below1000(n: number, dialect: Dialect): string {
    if (n < 100) return below100(n, dialect);
    if (n === 100) return N.hundredExact;
    const h = Math.floor(n / 100),
        r = n % 100;
    return r ? `${HUNDREDS[h]} ${E} ${below100(r, dialect)}` : HUNDREDS[h]!;
}

/** Non-negative integer (< 10⁹) → Portuguese words (`dialect`: the Brazilian teens for "bp"); larger /
 *  non-finite → digit-by-digit.
 *  ⚠ `dialect` HAS NO DEFAULT, on purpose: a defaulted dialect let the clock and fraction rules call this
 *  without one, and pt-BR read *dezasseis horas e dezassete* (#1463). Every caller has to choose. */
export function numberToWords(n: number, dialect: Dialect, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9)
        return [...(raw ?? String(Math.abs(n)))]
            .map((d) => small(Number(d), dialect) ?? d)
            .join(" ");
    if (n < 1000) return below1000(n, dialect);
    if (n < 1e6) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        const thousand =
            th === 1 ? N.thousand : `${below1000(th, dialect)} ${N.thousand}`;
        if (r === 0) return thousand;
        // "e" before the remainder when it is < 100 or a round hundred (mil e duzentos, mil e vinte)
        return r < 100 || r % 100 === 0
            ? `${thousand} ${E} ${below1000(r, dialect)}`
            : `${thousand} ${below1000(r, dialect)}`;
    }
    const m = Math.floor(n / 1e6),
        r = n % 1e6;
    const million =
        m === 1
            ? `${small(1, dialect)} ${N.million}`
            : `${below1000(m, dialect)} ${N.millionPlural}`;
    if (r === 0) return million;
    // "e" before a remainder that is < 100 or "round" (milhão e um, milhão e cem, milhão e quinhentos mil)
    return r < 100 || r % 100 === 0
        ? `${million} ${E} ${numberToWords(r, dialect)}`
        : `${million} ${numberToWords(r, dialect)}`;
}
