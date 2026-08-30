/**
 * Shona cardinal number → words (space-separated; each runs through the g2p). Shona counting uses gumi (10),
 * makumi (tens), zana/mazana (hundreds), chiuru/zviuru (thousands), miriyoni/bhiriyoni, joined with ne
 * ("and"). Covers 0 … <10¹²; larger / non-finite → digit-by-digit.
 *
 * ⚠ THE MAGNITUDE WORDS CARRY THEIR OWN NOUN-CLASS CONCORD, and this file used not to apply it. `makumi` and
 * `mazana` are class-6 nouns and `zviuru` is class 8, so the numeral counting them takes THAT class's prefix
 * whatever the phrase as a whole counts: `makumi maviri` (20), never *makumi piri*. Measured over the mined
 * artifact, the ma- form is written 20 times out of 20 after `makumi`/`mazana` and the bare stem never; the
 * zvi- forms are glossed against digits on sn.wikipedia (`makiromita ezvuruzvisere (8000km)`, `zviuru zvina`
 * = four thousand). See shona.jsonc's number header for the citations and for the OTHER concord slot — the
 * trailing unit, which agrees with the head noun and is therefore not computable here (playbook trap 14).
 *
 * ⚠ `churu` WAS THE THOUSAND WORD AND IT IS THE ANTHILL — 33 of 33 sn.wikipedia tokens are the mound. The
 * thousand is `chiuru`. Again, shona.jsonc.
 *
 * Numbers are unmeasured by the referee (epitran sna-Latn is word-only, and its list carries no numerals), so
 * the evidence for every form here is the corpus and sn.wikipedia rather than a gate.
 */
import { digitIndex } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";

const N = MANIFEST.numbers;

/** A magnitude noun plus its count: singular noun alone for one, else plural noun + the concorded numeral.
 *  `count` is the concord series for that noun's class — `unitsMa` for makumi/mazana, `unitsZvi` for zviuru. */
function magnitude(one: string, many: string, n: number, count: readonly string[]): string {
    if (n === 1) return one;
    // 2–9 have a concord form in the series; anything larger is itself a compound (`zviuru gumi` = 10,000,
    // `zviuru mazana maviri` = 200,000, both attested) and carries its concord internally.
    return `${many} ${count[n] ?? below1000(n)}`;
}

/** 1 ≤ n < 100. */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    const t = Math.floor(n / 10);
    const u = n % 10;
    const tens = magnitude(N.ten, N.tens, t, N.unitsMa);
    return u ? `${tens} ${N.and} ${N.units[u]}` : tens;
}

/** 1 ≤ n < 1000. */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundred = magnitude(N.hundred, N.hundreds, h, N.unitsMa);
    return r ? `${hundred} ${N.and} ${below100(r)}` : hundred;
}

/** 1 ≤ n < 10⁶. */
function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const thousand = magnitude(N.thousand, N.thousands, th, N.unitsZvi);
    return r ? `${thousand} ${N.and} ${below1000(r)}` : thousand;
}

/**
 * Non-negative integer (< 10¹²) → Shona words; larger / non-finite → digit-by-digit.
 *
 * ⚠ THE MILLION AND BILLION ARMS WERE ADDED BECAUSE THE NORMALIZATION LAYER EXPOSED THE GAP, which is the
 * ordinary way of things: before de-grouping existed, `1,606,000` was split into three separate numbers by
 * the clause-comma and never reached this function intact. De-grouped, it did — and fell straight through to
 * the digit-by-digit fallback. Eight of this corpus's grouped figures are ≥ 10⁶ (`431,257,698`,
 * `480,000,000`, `2,800,000`, `1,606,000`, `1,392,000`, `1,081,000`, `1,100,000`, `1,886,068`).
 * The words and the order both come from the corpus's own worked reading of 431,257,698 — see shona.jsonc.
 */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => N.units[digitIndex(d)] ?? d).join(" ");
    if (n === 0) return N.units[0]!;
    if (n < 1e6) return below1e6(n);
    // ⚠ THE COUNT OF A MAGNITUDE IS ITSELF A FULL NUMERAL and takes class-6 concord from the magnitude noun,
    // not class 8 — `mabhiriyoni maviri`, `mamiriyoni mazana mana`. Hence `unitsMa` on both arms.
    const scale = n >= 1e9 ? 1e9 : 1e6;
    const [one, many] = scale === 1e9 ? [N.billion, N.billions] : [N.million, N.millions];
    const head = Math.floor(n / scale);
    const r = n % scale;
    const big = head < 10 ? magnitude(one, many, head, N.unitsMa) : `${many} ${below1000(head)}`;
    return r ? `${big} ${N.and} ${numberToWords(r)}` : big;
}

/**
 * Re-cast a composed numeral so its FINAL stem carries the class-6 (ma-) concord — `piri` → `maviri`.
 *
 * ⚠ THIS IS PLAYBOOK TRAP 14's PRESCRIBED FIX, and it is why the caller is normalize.ts rather than the
 * tokenizer. Shona's measure and currency nouns are class 6 (`madhora`, `makiromita`, `maawa`, `matani`), and
 * the numeral counting them agrees: shonadictionary.com's own example sentence for `dhora` is *"Ndakabhadhara
 * MADHORA MAVIRI muchitoro"*, and the corpus writes `makore mashanu`, `mazuva matanhatu`, `masvondo matatu`.
 * A digit becomes words in the TOKENIZER, downstream of every rule in this layer, so the only way to make the
 * numeral agree is to convert the operand to WORDS inside the rule that knows which noun it follows.
 *
 * ⚠ ONLY THE FINAL STEM MOVES. A compound already carries its internal concord from `magnitude()` above —
 * `makumi maviri ne piri` needs only its last word changed, giving `makumi maviri ne maviri` (22), which is
 * the corpus's *"makumi maviri nemaviri (22)"* modulo the space Shona writes closed.
 * ⚠ ONE IS EXCLUDED. Class 6 is a PLURAL, so "one" beside it is a class mismatch the language solves by
 * switching to the class-5 singular noun (`dhora rimwe`, not *madhora rimwe*) — a noun change this layer
 * cannot make, so `motsi` is left alone rather than half-agreed.
 */
export function withClass6Concord(words: string): string {
    const parts = words.split(" ");
    const last = parts.length - 1;
    const k = N.units.indexOf(parts[last]!);
    if (k >= 2 && N.unitsMa[k]) parts[last] = N.unitsMa[k]!;
    return parts.join(" ");
}
