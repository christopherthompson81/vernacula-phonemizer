/**
 * Estonian (et) phonemizer — eesti keel, Uralic (Finnic), Latin orthography, canonical IPA.
 * Estonian is nearly as phonemically transparent as its sibling Finnish at the SEGMENT level, so this is a greedy
 * grapheme scan + gemination (a doubled letter → [Cː]/[Vː]) + FIXED first-syllable stress (predictable → emitted).
 * ⟨b d g⟩ are the voiceless-lenis stops → plain b/d/ɡ (the referee's devoicing ring is BACKBONE-stripped); the 9
 * vowels incl. ⟨õ⟩→ɤ; NO n→ŋ before a velar (king→kinɡ). Palatalization + the Q2/Q3 half-long quantity grade are
 * only partially orthographic → not emitted, folded in the referee eval.
 */
import { digitIndex } from "../../core/numbers.ts";
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeEstonian, normalizeEstonianInitialisms } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teens: string[];
    tensSuffix: string;
    hundred: string;
    thousand: string;
    million: string;
    millions: string;
}
interface EstonianDef {
    graphemes: Record<string, string>;
    vowelLetters: readonly string[];
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<EstonianDef>(import.meta.url, "estonian.jsonc");
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const N = DEF.numbers;
const VOWEL_LETTERS = new Set(DEF.vowelLetters); // + accented loan vowels and loan ⟨y⟩ (→[i])

/** Phonemize a single Estonian word to canonical IPA (segmental + gemination + fixed first-syllable stress). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    const segs: { ph: string; vowel: boolean }[] = [];
    for (let i = 0; i < w.length; i++) {
        const c = w[i]!;
        const ph = G[c];
        if (ph === undefined) continue; // unknown char → skip
        const vowel = VOWEL_LETTERS.has(c);
        // A doubled letter → long: a double VOWEL is always long (aa→ɑː); a double CONSONANT is a geminate [Cː] only
        // after a vowel (a true geminate is intervocalic — a doubled consonant after another consonant is a compound
        // boundary CLUSTER, kesk+kool→keskkoːl, not a geminate).
        if (w[i + 1] === c && (vowel || segs[segs.length - 1]?.vowel)) {
            segs.push({ ph: ph + "ː", vowel });
            i += 1;
            continue;
        }
        segs.push({ ph, vowel });
    }
    // Fixed first-syllable primary stress: ˈ before the first vowel nucleus.
    const first = segs.findIndex((s) => s.vowel);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === first) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

// ── Numbers (decimal; Estonian) ───────────────────────────────────────────────
/** 0–99 → Estonian text. Tens are unit+kümmend (kakskümmend); 10=kümme, 11–19=teens (üksteist). */
function sub100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    if (n < 20) return N.teens[n - 11]!;
    const t = N.units[Math.floor(n / 10)]! + N.tensSuffix, u = n % 10;
    return u ? `${t} ${N.units[u]}` : t;
}
/** 1–999 → Estonian text. Hundreds are (unit+)sada (sada / kakssada) + the sub-hundred remainder. */
function sub1000(n: number): string {
    const h = Math.floor(n / 100), r = n % 100;
    if (h === 0) return sub100(r);
    const hw = (h === 1 ? "" : N.units[h]) + N.hundred;
    return r ? `${hw} ${sub100(r)}` : hw;
}
/** Non-negative integer (< 1e9) → space-separated Estonian cardinal words. */
function numberToText(n: number): string {
    if (n === 0) return N.units[0]!;
    const parts: string[] = [];
    const mil = Math.floor(n / 1_000_000);
    n %= 1_000_000;
    if (mil) parts.push(mil === 1 ? `${N.units[1]} ${N.million}` : `${sub1000(mil)} ${N.millions}`); // üks miljon
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(th === 1 ? N.thousand : `${sub1000(th)} ${N.thousand}`);
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n) || n >= 1e9)
        return [...digits].map((d) => phonemizeWord(N.units[digitIndex(d)] ?? d)).join(" "); // read digit-by-digit
    return numberToText(n).split(" ").filter(Boolean).map(phonemizeWord).join(" ");
}

// A word (Estonian Latin letters incl. õ ä ö ü + loan š ž z) / number / punctuation token.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zõäöüšžáéíóú]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

/**
 * THE SHARED SYMBOL TIER. Estonian POSTPOSES every quantity noun — *84 000 ruutkilomeetrit*, *70 protsenti*,
 * *1790 dollarit* — which is the tier's default order, so the whole class is on the seam rather than
 * hand-written (playbook trap 47: local is right only when the tier CANNOT say it, and here it can).
 *
 * ⚠ THE COUNT FORMS ARE NOMINATIVE / PARTITIVE, which is Estonian's numeral agreement: *1 kilomeeter* but
 * *2 kilomeetrit*. The tier's default `countForm` (n===1 → first, else last) is exactly that split. Every
 * partitive here is attested — `kilomeetrit` ×3 and `meetrit` ×2 and `kilogrammi` ×1 and `dollarit` ×4 in
 * the corpus itself, `protsenti` ×76/20 · `eurot` ×93/12 · `naela` ×103/20 · `hektarit` ×101/20 ·
 * `sentimeetrit` ×35/19 · `millimeetrit` ×35/20 on the wiki — and espeak's `et_list` independently declares
 * `cm s'enti||m,e:trit`, `kg k,ilO1gr'amm`, `ha h'ek:tarit`, `% prots'ent:i`, `$ tol:larit`, `€ eurot`,
 * `£ nae:la`.
 *
 * ⚠ BARE `m` IS DECLARED, AND THE ONE-LETTER-KEY HAZARD (traps 28/46) WAS MEASURED FIRST. Digit-adjacent `m`
 * is ×22 in the retained text and TWENTY are genuine metres (`500 m merepinnast`, `(1996 m)`, `4x200 m`,
 * `4500 kuni 6000 m kõrgused`). The version-dot exposure the tier's `NOT_VERSION` guard exists for is intact
 * here, because Estonian's decimal separator is a COMMA and `normalize.ts` never spends a dot — so the guard's
 * evidence outlives this language's pass, unlike fa/ckb/af/ca (trap 39).
 * ⚠ THE TWO EXCEPTIONS ARE PRICED RATHER THAN HIDDEN. `632 m.a.j.` is an ERA MARKER and is consumed by
 * `normalize.ts` step 2 before the tier can see it — that ordering is the reason step 2 sits where it does.
 * The residue is `1 m. o.` and `12 m. o.` ×2, an NMR chemical-shift abbreviation (*miljondikosa*, i.e. ppm)
 * in one organic-chemistry paragraph, which now reads *meetrit*. Two instances of a specialist abbreviation
 * against twenty metres, and no source attests the expansion; recorded so it is not rediscovered as a bug.
 *
 * ⚠ NO `unitPer`, SO NO RATE — trap 47's first reason. Estonian does not say "A per B": the denominator goes
 * into the INESSIVE with no preposition at all (*kilomeetrit tunnis*, *meetrit sekundis*), and `unitPer` is
 * one invariant string. The corpus's rate shapes are `1000 $/kg`, `1,9 kg/ha`, `3–8 kcal/mol` and
 * `187,1 in/km²` — a currency, an agricultural rate, a chemistry unit and an ENGLISH numerator
 * (*inhabitants*) — not one of which a `km/h` key would reach. Declaring the two composed keys instead
 * (fi's move) would buy nothing here because neither is written.
 *
 * ⚠ NO `°C` ON THE TIER — `normalize.ts` step 9 owns it, because it also has to read the BARE `°` of a
 * latitude and an angle, which is the same word (*kraadi*) and no scale name.
 *
 * ⚠ NO `bareExponent`. `x³` and `sp³-hübridiseeritud` are the corpus's only bare powers, both inside one
 * chemistry paragraph, and the predicate form (*kuubis*, *astmes*) is a different word from the unit modifier
 * *kuup-* and is attested in no source here. The unit exponent is claimed; the predicate is not.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["protsent", "protsenti"],
    currency: {
        $: ["dollar", "dollarit"],
        "€": ["euro", "eurot"],
        "£": ["nael", "naela"],
    },
    units: {
        km: ["kilomeeter", "kilomeetrit"],
        cm: ["sentimeeter", "sentimeetrit"],
        mm: ["millimeeter", "millimeetrit"],
        kg: ["kilogramm", "kilogrammi"],
        ha: ["hektar", "hektarit"],
        m: ["meeter", "meetrit"],
    },
    // Estonian welds the measure word onto the FRONT as one compound — *ruutkilomeetrit*, *kuupmeetrit* —
    // which is `compound`, never `before` (that would give *ruut kilomeetrit*, two tokens). `kuupmeetrit` is
    // corpus-attested ×1 in exactly this slot (*"Maapealse osa maht on 200 kuupmeetrit"*), and
    // `ruutkilomeetrit` ×27/19 / `ruutmeetrit` ×37/18 on the wiki (*"Ülemjärv – 82 097 ruutkilomeetrit"*).
    exponentWords: { squared: ["ruut"], cubed: ["kuup"], position: "compound" },
    // The magnitude hop, for `120 koma 758 miljardit USA dollarit`. Estonian takes NO connective
    // (*viis miljonit dollarit*), so `magnitudeConnective` stays undefined. espeak declares `mln m'il^jonit`
    // and `mld m'il^jardit`; the corpus writes `miljardit` and `miljonit` in running text.
    magnitudes: ["miljon", "miljonit", "miljard", "miljardit", "biljon", "biljonit"],
    // ×4 in the retained text, every one between two proper names in a citation or a band credit
    // (`Smith & Wesson`, `McCartney & Wings`, `Karton, I., Rinne, J.-M., & Bachmann, T.`), all of which an
    // Estonian reader says *ja*. `ja` is the corpus's second-commonest token at ×497, and the tier spaces the
    // replacement on both sides so `B&B` cannot fuse into one token (the merge defect of traps 18/26).
    ampersand: "ja",
});

class EstonianPhonemizer implements Phonemizer {
    text(rawInput: string): string {
        const input = SYMBOLS(normalizeEstonianInitialisms(normalizeEstonian(rawInput)));
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Estonian phonemizer (greedy g2p + gemination + first-syllable stress + cardinal numbers). */
export function createEstonian(): Phonemizer {
    return new EstonianPhonemizer();
}
