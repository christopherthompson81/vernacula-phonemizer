/**
 * Haitian Creole cardinal number → words (IPN orthography). Emits SPACE-separated words so each element reads
 * through the haitian.ts g2p. Covers 0 … <10¹²; larger / unsafe values read digit-by-digit.
 *
 * SOURCE for the numeral table (haitian.jsonc `numbers`): "HAITIAN CREOLE — Language Specific Peculiarities
 * Document", LDC2017S03 §8.1–8.2 (a complete 0–99 table + the magnitudes, citing Valdman et al. 2007), with 0–79
 * cross-checked against en.wikibooks.org/wiki/Haitian_Creole/Numbers.
 *
 * ⚠ THE FRENCH VIGESIMAL RESIDUE — the reason this is Pattern B and not a data table. Haitian inherited
 *   Metropolitan French's base-20 seam at 70/80/90 and did NOT regularise it to the Belgian/Swiss ⟨septante /
 *   octante / nonante⟩:
 *     70–79  ⟨swasann⟩ + the TEEN  — swasanndis (60+10), swasannonz (60+11) … swasanndiznèf (60+19)
 *     80     ⟨katreven⟩            — kat × ven, "four twenties"
 *     81     ⟨katrevenen⟩          — irregular: plain ⟨en⟩, not the ⟨eyen⟩ the true decades take
 *     82–89  ⟨katreven⟩ + the UNIT — katrevende, katreventwa … katrevennèf
 *     90–99  ⟨katreven⟩ + the TEEN — katrevendis (4×20+10), katrevenonz … katrevendiznèf
 *   So 70 and 90 are not decades at all: they are a decade/score plus a TEEN, and the tens digit of 7 and 9 never
 *   surfaces. No `tens` table keyed by the round value can express that, which rules out `westernNumberWords`.
 *
 * ⚠ THE DECADE STEM ALTERNATION (20–60) is the second reason. Each decade has three shapes, and which one appears
 *   is selected by the FOLLOWING unit:
 *     bare (no unit)   ven, trant, karant, senkant, swasant
 *     + unit 1         the ⟨t⟩ stem + ⟨eyen⟩          — venteyen, tranteyen, swasanteyen
 *     + units 2–7      the ⟨nn⟩ stem + the unit        — vennde, trannsenk, swasannsis
 *     + units 8, 9     the ⟨t⟩ stem + the unit         — ventuit, trantnèf, swasantuit
 *   The ⟨nn⟩ spelling is not decorative: haitian.ts reads ⟨Vnn⟩ as "nasalise the vowel AND keep an [n]", so
 *   ⟨vennde⟩ is [vɛ̃nde] while a hypothetical *⟨vende⟩ would be [vãde] — wrong vowel and no [n].
 */
import { digitIndex } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface HaitianNumbersDef {
    numbers: {
        ones: string[];
        teens: string[];
        decades: { bare: string; t: string; nn: string }[];
        one: string;
        sixtyTen: string;
        fourScore: string;
        fourScoreOne: string;
        hundred: string;
        thousand: string;
        million: { one: string; word: string };
        billion: { one: string; word: string };
        tenElided: string;
    };
}
// Loaded independently of haitian.ts's own manifest read (haitian.ts imports THIS module — reaching back for a
// shared `DEF` would be an import cycle). The manifest is a small JSONC parsed once at module init.
const N = loadManifest<HaitianNumbersDef>(import.meta.url, "haitian.jsonc").numbers;
const ONES = N.ones,
    TEENS = N.teens;

/** 20 ≤ n < 70 — a true decade plus the stem alternation described above. */
function decade(n: number): string {
    const d = N.decades[Math.floor(n / 10) - 2]!,
        u = n % 10;
    if (u === 0) return d.bare;
    if (u === 1) return `${d.t}${N.one}`; // venteyen, tranteyen, karanteyen, senkanteyen, swasanteyen
    if (u >= 8) return `${d.t}${ONES[u]}`; // ventuit, trantnèf — the ⟨t⟩ stem before 8/9
    return `${d.nn}${ONES[u]}`; // vennde … swasannsèt — the ⟨nn⟩ stem before 2–7
}

/** 0 ≤ n < 100. 70–99 are the VIGESIMAL band: 60+teen, and 4×20 (+unit / +teen). */
function below100(n: number): string {
    if (n < 10) return ONES[n]!;
    if (n < 20) return TEENS[n - 10]!;
    if (n < 70) return decade(n);
    if (n < 80) return `${N.sixtyTen}${TEENS[n - 70]}`; // swasanndis … swasanndiznèf (60 + 10..19)
    if (n === 81) return N.fourScoreOne; // katrevenen — irregular, not *katreveneyen
    if (n < 90) return n === 80 ? N.fourScore : `${N.fourScore}${ONES[n - 80]}`; // katreven (+ unit)
    return `${N.fourScore}${TEENS[n - 90]}`; // katrevendis … katrevendiznèf (4×20 + 10..19)
}

/** 1 ≤ n < 1000. ⟨san⟩ takes a plain multiplier and no connector (200 de san, 101 san en). */
function below1000(n: number): string {
    if (n < 100) return below100(n);
    const h = Math.floor(n / 100),
        r = n % 100;
    const head = h === 1 ? N.hundred : `${ONES[h]} ${N.hundred}`;
    return r ? `${head} ${below100(r)}` : head;
}

/** ⟨dis⟩ (10) elides its ⟨s⟩ before a magnitude noun — LSP "di mil" (10,000), "di milyon" (10 million). */
function elideTen(words: string): string {
    return words === TEENS[0] ? N.tenElided : words;
}

/** 1 ≤ n < 10⁶. ⟨mil⟩ is invariable and drops its "en" (1000 mil, 2000 de mil, 10,000 di mil, 100,000 san mil). */
function below1e6(n: number): string {
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000),
        r = n % 1000;
    const thousand = th === 1 ? N.thousand : `${elideTen(below1000(th))} ${N.thousand}`;
    return r ? `${thousand} ${below1000(r)}` : thousand;
}

/** Non-negative integer → Haitian Creole words. Out-of-range / unsafe values read digit-by-digit (never empty). */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12)
        return [...(raw ?? String(Math.abs(n)))].map((d) => ONES[digitIndex(d)] ?? d).join(" ");
    if (n === 0) return ONES[0]!; // zewo
    if (n < 1e6) return below1e6(n);
    // ⟨milyon⟩ / ⟨milya⟩ are NOUNS and keep their "en" (LSP: en milyon, en milya) — unlike the bare ⟨mil⟩.
    const sc = n < 1e9 ? { value: 1e6, ...N.million } : { value: 1e9, ...N.billion };
    const q = Math.floor(n / sc.value),
        r = n % sc.value;
    const head = q === 1 ? sc.one : `${elideTen(below1e6(q))} ${sc.word}`;
    return r ? `${head} ${numberToWords(r)}` : head;
}
