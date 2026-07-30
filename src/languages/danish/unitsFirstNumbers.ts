/**
 * UNITS-FIRST Germanic number composition (the einundzwanzig shape) — the composer body, shared by four fleet
 * engines: Danish (enogtyve), Faroese (einogtjúgu), Luxembourgish (eenanzwanzeg) and Bavarian (oanazwånzg).
 *
 * `westernNumberWords` in src/core/numbers.ts cannot express this: it emits [tens, unit] in that order as separate
 * words, whereas these four fuse UNIT + connector + TENS into a single orthographic word. The only structural
 * differences between the four are (a) the connector (og / an~a / a), (b) whether a magnitude and its multiplier are
 * written open (Danish "to hundrede") or closed (German-style "zweehonnert"), and (c) whether magnitude groups are
 * chained with "og" (North Germanic) or bare juxtaposition (West Germanic). All three are parameters below; the
 * NUMBER WORDS themselves stay in each language's own data manifest.
 *
 * ⚠ HOUSING: this belongs in `src/core/numbers.ts` beside `westernNumberWords`/`indicNumberWords`. It lives here
 * only because src/core/ was off-limits while four number fan-out branches were in flight in parallel. Lift it to
 * core (and re-point the fo/lb/bar imports) when the fan-out lands. Nothing Danish-specific is in this file.
 */

export interface UnitsFirstDef {
    /** 0..19 spellings — the standalone / citation forms (index 0 = "zero"). */
    ones: string[];
    /** Round tens indexed by the TENS DIGIT: index 2 = 20 … index 9 = 90 (indices 0–1 unused). */
    tens: string[];
    /** Unit forms as they appear INSIDE a tens compound, indexed 1..9 (Danish en-, Faroese ein-, Bavarian oan-);
     *  omit to reuse `ones`. Individual holes fall back to `ones` too. */
    compoundOnes?: string[];
    /** The unit→tens linker, as a function of the two words it sits between so Luxembourgish can apply the
     *  Eifeler Rule (final -n retained before n/d/t/z/h + vowels, dropped otherwise). */
    connector: (unit: string, tensWord: string) => string;
    /** 10² — `one` is the spelling of a bare 100, `word` the one that follows a multiplier. */
    hundred: { one: string; word: string };
    /** 10³ — same shape as `hundred`. */
    thousand: { one: string; word: string };
    /** 10⁶ — `one` is the spelling of a bare million (Danish "en million"), `plural` follows a multiplier. */
    million: { one: string; plural: string };
    /** 10⁹ (short scale: milliard / Milliard). */
    billion: { one: string; plural: string };
    /** Between a multiplier and its hundred/thousand word: " " (Danish "to hundrede") or "" (Luxembourgish
     *  "zweehonnert"). */
    mulJoin: string;
    /** Between a hundreds word and its <100 remainder: " og " (Danish) or "" (Luxembourgish/Bavarian). */
    hundredRemJoin: string;
    /** Between whole magnitude groups: " og " (Danish/Faroese) or " " (Luxembourgish/Bavarian). */
    groupJoin: string;
}

const compoundOne = (d: UnitsFirstDef, u: number): string => d.compoundOnes?.[u] ?? d.ones[u]!;

/** 1 ≤ n < 100, units-first and fused into one word above 20 (enogtyve, eenanzwanzeg, oanazwånzg). */
function below100(n: number, d: UnitsFirstDef): string {
    if (n < 20) return d.ones[n]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    const tensWord = d.tens[t]!;
    if (u === 0) return tensWord;
    const unit = compoundOne(d, u);
    return `${unit}${d.connector(unit, tensWord)}${tensWord}`;
}

/** 1 ≤ n < 1000 (fem hundrede og femoghalvfjerds / fënnefhonnertfënnefafofzeg). */
function below1000(n: number, d: UnitsFirstDef): string {
    if (n < 100) return below100(n, d);
    const h = Math.floor(n / 100),
        r = n % 100;
    const hundred = h === 1 ? d.hundred.one : `${d.ones[h]}${d.mulJoin}${d.hundred.word}`;
    return r ? `${hundred}${d.hundredRemJoin}${below100(r, d)}` : hundred;
}

/** Non-negative integer (< 10¹²) → number words, largest magnitude first; larger / non-finite → digit-by-digit. */
export function unitsFirstNumberToWords(n: number, d: UnitsFirstDef): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...String(Math.abs(n))].map((c) => d.ones[Number(c)] ?? c).join(" ");
    if (n === 0) return d.ones[0]!;
    const parts: string[] = [];
    const bil = Math.floor(n / 1e9),
        mil = Math.floor((n % 1e9) / 1e6),
        th = Math.floor((n % 1e6) / 1000),
        r = n % 1000;
    if (bil) parts.push(bil === 1 ? d.billion.one : `${below1000(bil, d)} ${d.billion.plural}`);
    if (mil) parts.push(mil === 1 ? d.million.one : `${below1000(mil, d)} ${d.million.plural}`);
    if (th) parts.push(th === 1 ? d.thousand.one : `${below1000(th, d)}${d.mulJoin}${d.thousand.word}`);
    if (r) parts.push(below1000(r, d));
    return parts.join(d.groupJoin);
}
