/**
 * Paraguayan Guaraní (gn) cardinal number → words. **SYSTEM: the 20th-century GUARANÍ NEOLOGISM system (the
 * Decoud Larrosa series), NOT the Spanish loan numerals that dominate colloquial speech.** This is the most
 * contested choice in this batch, so the reasoning and the counter-evidence are both set out in full.
 *
 * ★★ THE SITUATION. Pre-contact Guaraní had **four** cardinals. Estigarribia, *A Grammar of Paraguayan Guarani*
 *   (UCL Press 2020), §3.4.3, p. 99, verbatim:
 *       "Before contact with Spanish, Guarani had four cardinal numerals: peteĩ '1', mokõi '2', mbohapy '3' and
 *        irundy '4'. In the twentieth century, several complementary academic systems were created to extend the
 *        numeral set. The one I present briefly here is usually attributed to Professor Reinaldo Decoud Larrosa."
 *   Two corrections to the common account fall out of that: the native set is **1–4, not 1–5** (`po` '5', from
 *   'hand', is already the first neologism), and the system is Decoud Larrosa's, not the Academia de la Lengua
 *   Guaraní's — no Academia primary document was found.
 *   And the neologisms are explicitly NOT colloquial speech. Estigarribia, immediately after his table (p. 100):
 *       "As of today, this system is purely of academic use. In the colloquial language, Spanish numerals are in
 *        common use beyond irundy '4'."
 *   Gómez Rendón, "Grammatical Borrowing in Paraguayan Guarani" (in Matras & Sakel eds., Mouton 2007, pp. 523–550)
 *   agrees: "The presence of Spanish numerals in Paraguayan Guaraní is massive… efforts have been conducted to
 *   expand the system on the basis of neologisms, but their actual use by the speaking community is reduced to
 *   writing." Omniglot says the same.
 *
 * ★★ WHY WE STILL IMPLEMENT THE NEOLOGISMS. The brief's instruction is to prefer the borrowed system where that is
 *   what speakers use — but for Guaraní that route is **not implementable without inventing data**, and the
 *   research is unambiguous on why:
 *     1. **There is no attested Guaraní spelling of a Spanish numeral word.** Written Guaraní sidesteps the
 *        question entirely by using ARABIC DIGITS. gn.wikipedia's `1811` article writes every year and date as
 *        digits (`[[1811]]`, `[[1969]]`, `[[17 jasyteĩ]]`) and spells out no numeral at all; Estigarribia's own
 *        corpus example does the same (`ohupyty amo 14.200 sua dólar`). So the orthographic question is dodged in
 *        practice, not answered.
 *     2. Guaraní *does* nativise Spanish proper nouns (`Epáña`, `Méhiko`, `Arahentína`), so respellings like
 *        *siéte / *véinte / *miyõ would be idiomatic in principle — but every one of them would be **my
 *        invention**, and this repo does not ship invented forms. Writing plain Spanish orthography instead would
 *        also be unsourced convention, and would be phonemized by a Guaraní-only g2p (⟨c⟩→[k], so *cien* → [kien]),
 *        i.e. wrong anyway.
 *     3. The neologism series, by contrast, **is** documented in Guaraní orthography by two independent strong
 *        sources that agree form-for-form: Estigarribia's table (p. 100) and Wiktionary's
 *        `Module:number_list/data/gug`. It is also what Guaraní Wikipedia uses for its own numeral article titles
 *        (`Ñemohenda:Papaha` contains Peteĩ, Mokõi … Pa, Pateĩ … Sa, Su, Sua).
 *     4. And the low neologisms are demonstrably NOT dead: 6–12 are fully lexicalised in the everyday month and
 *        day names — `jasypoteĩ` June, `jasypokõi` July, `jasypa` October, `jasypateĩ` November, `arapokõi`
 *        Saturday ('day seven'). A speaker who says *siete* for 7 still says jasypokõi for July.
 *   So: the neologisms are the only option that is both in Guaraní orthography and attested. **A reviewer should
 *   know that this reads as the academic/written register, not as colloquial Paraguayan speech**; a Spanish-loan
 *   path would be a legitimate future addition, but it needs a sourced respelling convention first, and a Spanish
 *   phonemizer for the numeral span.
 *
 * ★ MORPHOLOGY — the system is transparent and multiplicative, which is what makes it composable.
 *   Etymologies (Estigarribia p. 99): `po` 5 < 'hand'; `pa` 10 < apheresis of `opa` 'end, totality'; `sa` 100 <
 *   `rasa` 'very'; `su` 1000 < `guasu` 'big'. The building rule, verbatim: "The rest of the numbers are obtained
 *   by deleting the first syllable of a number and combining it with po and pa."
 *     - COMBINING (apheresised) unit stems: teĩ, kõi, 'apy, rundy → so 6 = po+teĩ, 7 = po+kõi, 11 = pa+teĩ,
 *       13 = pa+'apy → `pa'apy`.
 *     - teens: `pa` + combining stem, FUSED (pateĩ 11 … paporundy 19).
 *     - round tens: full unit + `pa`, FUSED (mokõipa 20, popa 50, poteĩpa 60, porundypa 90).
 *     - 21–99: tens + SPACE + full unit (`mokõipa peteĩ` 21).
 *     - hundreds: full unit + `sa`, FUSED (mokõisa 200 … porundysa 900).
 *     - the multiplier ONE IS DROPPED at every scale: 100 is `sa`, 1000 `su`, 10⁶ `sua` — never *peteĩsa.
 *   The scale words compose multiplicatively, which is how the upper range is reachable at all: Estigarribia's own
 *   table gives 10⁷ = `pasua` (pa × sua) and 10⁸ = `sasua` (sa × sua). The identical pattern one scale down
 *   yields 10⁴ = `pasu` and 10⁵ = `sasu` — and those two forms are independently (if weakly) corroborated by a
 *   languagesandnumbers.com snippet. So the "undocumented 10 000–999 999 band" the research flagged is in fact
 *   derivable from the strong source's own multiplicative rule, and that is what is implemented here.
 *
 * ★ SOURCES
 *   - **Estigarribia (2020), *A Grammar of Paraguayan Guarani*, UCL Press, §3.4.3, pp. 99–100** (open access) —
 *     the native 1–4 statement, the neologism table, the building rule, the etymologies, and the "purely of
 *     academic use" verdict. The primary source throughout.
 *   - **Wiktionary `Module:number_list/data/gug`** — agrees with Estigarribia form-for-form and fills in the tens
 *     50–90 (popa, poteĩpa, pokõipa, poapypa, porundypa) and the hundreds 300–900.
 *   - **gn.wikipedia.org** — `Ñemohenda:Papaha` (26 numeral articles); `Sa` ("pa jey pa" = 'ten times ten'), `Su`,
 *     `Sua` (glossed against Spanish cien/mil/millón); the `1811` and `Jasy` articles for the digits-in-prose
 *     convention.
 *   - Gómez Rendón (2007) and Omniglot for the colloquial-Spanish counter-evidence.
 *   - **Weak provenance, flagged**: languagesandnumbers.com could not be fetched; its rule text and the
 *     `mokõisu`/`pasu`/`sasu` forms reached us only via search-index quotation.
 *
 * ★ ZERO = `mba'eve` ('nothing'), which is what every source gives. Wiktionary also lists `papa'ỹ`, and
 *   gn.wikipedia's own numeral overview writes `0: Mba'eve-Papa'ỹ` and titles the article `Mba'eve (papaha)`.
 *   `mba'eve` is generated; the others are accept-only.
 *
 * SIMPLIFICATIONS / KNOWN GAPS (flagged, none invented):
 *   - **The cross-scale JOIN is rule-extended, not attested.** No source spells out 101 or 234. This composer
 *     juxtaposes with a space, exactly as the attested `mokõipa peteĩ` 21 does — so 101 = `sa peteĩ`, 234 =
 *     `mokõisa mbohapypa irundy`. That is the obvious reading of an additive system, but it is an inference.
 *   - 13 is `pa'apy` (Estigarribia + Wiktionary + Omniglot). gn.wikipedia titles it `Pahapy`; not generated.
 *   - ATTESTED RANGE / FALLBACK: 0 … 10⁹−1. `sua` (10⁶) takes a multiplier of 1–999, which reaches 999 999 999.
 *     At 10⁹ and above there is no attested or derivable next scale word (Estigarribia's table stops at `sasua`
 *     10⁸), so this falls back to DIGIT-BY-DIGIT — as it also does for any non-safe integer.
 *   - Ordinals (suffix `-ha`, placed after the head noun) are out of scope here.
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
    return [...digits].map((d) => UNITS[Number(d)] ?? d).join(" ");
}

/**
 * Non-negative integer → Guaraní cardinal words in the Decoud Larrosa neologism system (see the header for why
 * this register and not the colloquial Spanish loans). ≥10⁹ or non-safe → digit-by-digit.
 */
export function numberToWords(n: number): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e9) return readDigits(String(n));
    if (n < 1e6) return below1e6(n);
    const m = Math.floor(n / 1e6),
        r = n % 1e6;
    const head = (m === 1 ? "" : below1000(m)) + MILLION; // sua · mokõisua · pasua 10⁷ · sasua 10⁸
    return r === 0 ? head : `${head} ${below1e6(r)}`;
}
