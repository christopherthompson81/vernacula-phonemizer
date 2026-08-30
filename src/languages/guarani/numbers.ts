/**
 * Paraguayan Guaraní (gn) cardinal number → words.
 *
 * ⚠ THIS IS THE 20th-CENTURY GUARANÍ NEOLOGISM SYSTEM (Decoud Larrosa), NOT the Spanish loan numerals that
 * dominate colloquial speech — and that is a deliberate choice a reader should not silently "fix".
 *
 * Pre-contact Guaraní had FOUR cardinals: peteĩ 1, mokõi 2, mbohapy 3, irundy 4. Everything above that is a
 * 20th-century academic coinage, and Estigarribia (A Grammar of Paraguayan Guarani, UCL Press 2020, §3.4.3)
 * is explicit that the system "is purely of academic use. In the colloquial language, Spanish numerals are in
 * common use beyond irundy '4'."
 *
 * ⚠ SO WHY NOT THE SPANISH LOANS? Because that route cannot be taken without INVENTING DATA:
 *   1. There is no attested Guaraní spelling of a Spanish numeral word. Written Guaraní sidesteps the question
 *      entirely by using ARABIC DIGITS — gn.wikipedia writes every year and date as digits and spells out no
 *      numeral at all.
 *   2. Guaraní does nativise Spanish proper nouns (Epáña, Méhiko, Arahentína), so respellings like *siéte or
 *      *véinte would be idiomatic in principle — but every one would be invented. Writing plain Spanish
 *      orthography instead is also unsourced, and a Guaraní-only g2p reads ⟨c⟩ as [k], so *cien* → [kien].
 *   3. The neologisms ARE documented in Guaraní orthography by two independent sources that agree
 *      form-for-form, and gn.wikipedia uses them for its own numeral article titles.
 *   4. The low neologisms are not dead: 6–12 are fully lexicalised in the everyday month and day names —
 *      jasypoteĩ June, jasypokõi July, jasypa October, arapokõi Saturday ('day seven'). A speaker who says
 *      *siete* for 7 still says jasypokõi for July.
 *
 * ⚠ WHAT A REVIEWER SHOULD KNOW: this reads as the ACADEMIC/WRITTEN register, not colloquial Paraguayan
 * speech. A Spanish-loan path is a legitimate future addition, but it needs a sourced respelling convention
 * first, plus a Spanish phonemizer for the numeral span.
 *
 * MORPHOLOGY — transparent and multiplicative, which is what makes it composable. `po` 5 < 'hand'; `pa` 10 <
 * apheresis of `opa` 'totality'; `sa` 100 < `rasa` 'very'; `su` 1000 < `guasu` 'big'. The building rule is to
 * delete a number's first syllable and combine it with po or pa:
 *   · combining (apheresised) unit stems: teĩ, kõi, 'apy, rundy — so 6 = po+teĩ, 11 = pa+teĩ, 13 = pa'apy
 *   · teens: `pa` + combining stem, FUSED (pateĩ 11 … paporundy 19)
 *   · round tens: full unit + `pa`, FUSED (mokõipa 20, popa 50, porundypa 90)
 *   · 21–99: tens + SPACE + full unit (mokõipa peteĩ 21)
 *   · hundreds: full unit + `sa`, FUSED (mokõisa 200 … porundysa 900)
 *   · ⚠ THE MULTIPLIER ONE IS DROPPED AT EVERY SCALE: 100 is `sa`, 1000 `su`, 10⁶ `sua` — never *peteĩsa.
 * The scale words compose multiplicatively, which is what makes the upper range reachable: 10⁷ = `pasua`
 * (pa × sua), 10⁸ = `sasua`. ⚠ 10⁴ = `pasu` and 10⁵ = `sasu` are DERIVED from that same rule rather than
 * directly attested — weakly corroborated, and the one place this table goes beyond its sources.
 *
 * SOURCES: Estigarribia (2020) §3.4.3 pp. 99–100 (open access) — the native 1–4 statement, the neologism
 * table, the building rule, the etymologies, and the "academic use" verdict; Wiktionary
 * `Module:number_list/data/gug`, which agrees form-for-form and fills in the tens 50–90 and hundreds 300–900;
 * gn.wikipedia `Ñemohenda:Papaha` and the `Sa`/`Su`/`Sua` articles.
 */

// Full (free) unit forms 0–10.
const UNITS = [
    "mba'eve", // 0 'nothing'
    "peteĩ", // 1 native
    "mokõi", // 2 native
    "mbohapy", // 3 native
    "irundy", // 4 native
    "po", // 5 < 'hand' — the first neologism
    "poteĩ", // 6 = po + teĩ
    "pokõi", // 7
    "poapy", // 8
    "porundy", // 9
    "pa", // 10 < opa 'totality'
];
// COMBINING (apheresised) unit stems 1–9, used after `pa` to build the teens: pa+teĩ = pateĩ 11, pa+'apy = pa'apy 13.
const COMBINING = ["", "teĩ", "kõi", "'apy", "rundy", "po", "poteĩ", "pokõi", "poapy", "porundy"];
const TEN = "pa";
const HUNDRED = "sa"; // < rasa 'very'
const THOUSAND = "su"; // < guasu 'big'
const MILLION = "sua"; // 10⁶; pa+sua = 10⁷, sa+sua = 10⁸ (Estigarribia's own table)

/** 0 ≤ n < 100. Teens FUSED (pateĩ), round tens FUSED (mokõipa), 21–99 tens + SPACE + full unit. */
function below100(n: number): string {
    if (n <= 10) return UNITS[n]!;
    if (n < 20) return TEN + COMBINING[n - 10]!; // pa + combining stem
    const t = Math.floor(n / 10),
        u = n % 10;
    const tens = UNITS[t]! + TEN; // mokõipa 20, porundypa 90
    return u === 0 ? tens : `${tens} ${UNITS[u]}`;
}

/** 1 ≤ n < 1000. Hundreds FUSED; the multiplier ONE is dropped (100 = sa, not *peteĩsa). */
function below1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return below100(n);
    const head = (h === 1 ? "" : UNITS[h]!) + HUNDRED;
    return r === 0 ? head : `${head} ${below100(r)}`;
}

/** 1 ≤ n < 10⁶. The multiplier fuses to `su`: su 1000 · mokõisu 2000 · pasu 10⁴ · sasu 10⁵. */
function below1e6(n: number): string {
    const th = Math.floor(n / 1000),
        r = n % 1000;
    if (th === 0) return below1000(n);
    const head = (th === 1 ? "" : below1000(th)) + THOUSAND;
    return r === 0 ? head : `${head} ${below1000(r)}`;
}

/** Read a digit string one digit at a time (the ≥10⁹ / unsafe-integer fallback). */
export function readDigits(digits: string): string {
    return [...digits].map((d) => UNITS[digitIndex(d)] ?? d).join(" ");
}

/**
 * Non-negative integer → Guaraní cardinal words in the Decoud Larrosa neologism system (see the header for why
 * this register and not the colloquial Spanish loans). ≥10⁹ or non-safe → digit-by-digit.
 */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) return readDigits(raw ?? String(n));
    if (n < 1e6) return below1e6(n);
    const m = Math.floor(n / 1e6),
        r = n % 1e6;
    const head = (m === 1 ? "" : below1000(m)) + MILLION; // sua · mokõisua · pasua 10⁷ · sasua 10⁸
    return r === 0 ? head : `${head} ${below1e6(r)}`;
}import { digitIndex } from "../../core/numbers.ts";

