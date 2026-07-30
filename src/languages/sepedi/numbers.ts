/**
 * Sepedi / Northern Sotho (nso) cardinal number → words (space-separated; each word then runs through the g2p, so
 * the IPA stays consistent with the word engine).
 *
 * NUMERAL FORM CHOSEN — the CITATION / COUNTING series (tee, pedi, tharo, nne, hlano, tshela, šupa, seswai,
 * senyane), i.e. the list the UNISA Northern Sotho course has a speaker recite when counting aloud. Sepedi
 * numerals 1–5 are adjectival and take noun-class concord when they qualify a noun, so there is no class-neutral
 * numeral; a TTS handed a bare integer has no noun to agree with, which makes the counting series the only
 * defensible target.
 *
 * ⚠ NOT Sesotho. The sibling st compositor is deliberately NOT reused: the stems differ (nso tee/tshela/šupa/
 * seswai/senyane/lesome vs st nngwe/tshelela/supa/robedi/robong/leshome) and, more importantly, so does the
 * morphology — Northern Sotho writes 11–99 and 200–900 CONJUNCTIVELY as a single word with the bare numeral stem
 * glued to the magnitude noun (lesometee 11, masomepedi 20, makgolopedi 200), where Sesotho is fully disjunctive
 * and needs the motso/metso dummy noun plus cl.4/cl.6 concord.
 *
 * ON THE PER-MAGNITUDE CONCORD SERIES. In a disjunctive Bantu numeral each magnitude noun selects its own
 * concord series, and collapsing them is the classic bug. Northern Sotho's conjunctive compounds sidestep it:
 * the attested series are lesome+STEM (lesometee, lesomepedi …), masome+STEM (masomepedi, masometharo …) and
 * makgolo+STEM (makgolopedi, makgolotharo …) — the SAME bare stem in all three, with no concord prefix, because
 * the compound is a single word. Concord reappears only where Sepedi is disjunctive, i.e. the cl.8 magnitudes
 * dikete/dimilione/dibilione, which take the particle "tše"; that is a separate table (`class8`).
 *
 * Words + sources + the documented orthographic normalisations are data in sepedi.jsonc "numbers".
 */
import { loadManifest } from "../../core/loadManifest.ts";

/** The Sepedi cardinal number words (see sepedi.jsonc "numbers" for the cited sources). */
export interface SepediNumbers {
    zero: string;
    /** the counting/citation stems 1–9; also the glued multiplier in the conjunctive compounds. */
    units: string[];
    /** cl.8 concord stems, indices 2–9 (after dikete / dimilione / dibilione). */
    class8: string[];
    ten: string;
    /** the conjunctive teens head (lesome) — lesome+STEM = 11–19. */
    teenHead: string;
    /** the conjunctive tens head (masome) — masome+STEM = 20–90. */
    tensHead: string;
    hundredOne: string;
    /** the conjunctive hundreds head (makgolo) — makgolo+STEM = 200–900. */
    hundredsHead: string;
    thousandOne: string;
    thousands: string;
    millionOne: string;
    millions: string;
    billionOne: string;
    billions: string;
    /** the cl.8 concord particle (tše) between a cl.8 magnitude and its 2–9 multiplier. */
    class8Concord: string;
    /** the conjunction joining magnitude components (le). */
    and: string;
}

const N = loadManifest<{ numbers: SepediNumbers }>(import.meta.url, "sepedi.jsonc").numbers;

/** A cl.8 magnitude (dikete/dimilione/dibilione) + its multiplier: "tše" + cl.8 stem for 2–9, else recursive. */
function class8Multiple(head: string, k: number): string {
    return k >= 2 && k <= 9 ? `${head} ${N.class8Concord} ${N.class8[k]!}` : `${head} ${numberToWords(k)}`;
}

/** 1 ≤ n < 100 — the conjunctive teens/tens compound (one word), with the unit as a separate word after a tens. */
function below100(n: number): string {
    if (n < 10) return N.units[n]!;
    const t = Math.floor(n / 10);
    const u = n % 10;
    // 11–19 glue onto lesome as ONE word (lesometee); 10 itself is bare lesome.
    if (t === 1) return u === 0 ? N.ten : `${N.teenHead}${N.units[u]!}`;
    // 20–90 glue onto masome as ONE word (masomepedi); a following unit is its own word (Omniglot's hyphen).
    const tens = `${N.tensHead}${N.units[t]!}`;
    return u === 0 ? tens : `${tens} ${N.units[u]!}`;
}

/** A non-negative integer → space-separated Sepedi cardinal words. */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0)
        return [...String(Math.abs(n))].map((d) => (d === "0" ? N.zero : (N.units[Number(d)] ?? d))).join(" ");
    if (n === 0) return N.zero;
    const parts: string[] = [];
    const b = Math.floor(n / 1e9);
    if (b > 0) parts.push(b === 1 ? N.billionOne : class8Multiple(N.billions, b));
    const m = Math.floor((n % 1e9) / 1e6);
    if (m > 0) parts.push(m === 1 ? N.millionOne : class8Multiple(N.millions, m));
    const th = Math.floor((n % 1e6) / 1000);
    if (th > 0) parts.push(th === 1 ? N.thousandOne : class8Multiple(N.thousands, th));
    const h = Math.floor((n % 1000) / 100);
    if (h === 1) parts.push(N.hundredOne);
    else if (h > 1) parts.push(`${N.hundredsHead}${N.units[h]!}`);
    const r = n % 100;
    if (r > 0) parts.push(below100(r));
    return parts.join(` ${N.and} `);
}
