/**
 * Welsh number → words — the modern DECIMAL system (un deg un, dau ddeg pump), which is what
 * school, media and figure-reading Welsh use; the traditional vigesimal forms (un ar bymtheg …) are a
 * register choice deferred with the rest of that system. Replaces the digit-by-digit stub (25 → "dau
 * pump"), the same stub Irish had before its compositor.
 *
 * Every base word is attested in the wikipron NW referee: un dau dwy tri tair pedwar pedair pump pum
 * chwech chwe saith wyth naw deg cant chant mil fil miliwn (+ dim). The two unattested surface forms are
 * the regular SOFT mutations ddeg/gant, whose orthography the G2P reads deterministically (dd=ð, g=ɡ).
 *
 * The mutations implemented are the uncontroversial core:
 *   dau + soft:      dau ddeg, dau gant, dwy fil     tri + aspirate:  tri chant
 *   chwe + aspirate: chwe chant                      pump/chwech clip to pum/chwe before a noun
 *   mil is FEMININE: dwy fil, tair mil, pedair mil
 * saith/wyth + soft (saith gant) is register-variable and NOT applied — the unmutated form is standard.
 * Groups are juxtaposed without the "a" conjunction ("chwe chant pedwar deg pump"): figure-reading
 * style, which avoids the aspirate-after-a chain (a phedwar) that the referee cannot corroborate.
 */
import { MANIFEST } from "./manifest.ts";

const ONES = MANIFEST.numbers.ones; // dim, un, dau, tri, pedwar, pump, chwech, saith, wyth, naw, deg

// Clipped counting forms used BEFORE a noun (deg, cant, mil): pump → pum, chwech → chwe.
const CLIP: Record<string, string> = { pump: "pum", chwech: "chwe" };
// Feminine forms, required by mil: dau → dwy, tri → tair, pedwar → pedair.
const FEM: Record<string, string> = { dau: "dwy", tri: "tair", pedwar: "pedair" };
const soft = (w: string): string => (w === "deg" ? "ddeg" : w === "cant" ? "gant" : w === "mil" ? "fil" : w);
const aspirate = (w: string): string => (w === "cant" ? "chant" : w);

/** unit (2–9, clipped) + mutated noun, honouring gender: (3, "mil") → "tair mil"; (2, "cant") → "dau gant". */
function counted(u: number, noun: string): string {
    let w = CLIP[ONES[u]!] ?? ONES[u]!;
    if (noun === "mil" && FEM[w]) w = FEM[w]!;
    if (w === "dau" || w === "dwy") return `${w} ${soft(noun)}`;
    if (w === "tri" || w === "tair" || w === "chwe") return `${w} ${aspirate(noun)}`;
    return `${w} ${noun}`;
}

/** 1 ≤ n < 100, decimal style: 11 → "un deg un", 25 → "dau ddeg pump". */
function below100(n: number): string {
    if (n <= 10) return ONES[n]!;
    const t = Math.floor(n / 10), u = n % 10;
    const tens = t === 1 ? "un deg" : counted(t, "deg");
    return u === 0 ? tens : `${tens} ${ONES[u]!}`;
}

function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100), r = n % 100;
    const head = h === 1 ? "cant" : counted(h, "cant");
    return r === 0 ? head : `${head} ${below100(r)}`;
}

/** Non-negative integer → Welsh words; out of range → digit-by-digit (digits only). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) {
        return [...(raw ?? String(Math.abs(n)))].filter((c) => c >= "0" && c <= "9").map((d) => ONES[Number(d)]!).join(" ");
    }
    if (n === 0) return ONES[0]!; // dim
    if (n < 1000) return below1000(n);
    if (n < 1e6) {
        const th = Math.floor(n / 1000), r = n % 1000;
        const head = th === 1 ? "mil" : th <= 9 ? counted(th, "mil") : `${below1000(th)} mil`;
        return r === 0 ? head : `${head} ${below1000(r)}`;
    }
    const m = Math.floor(n / 1e6), r = n % 1e6;
    const head = m === 1 ? "miliwn" : `${below1000(m)} miliwn`;
    return r === 0 ? head : `${head} ${numberToWords(r)}`;
}
