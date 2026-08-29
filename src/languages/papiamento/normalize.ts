import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
import { rewrite } from "../../core/provenance.ts";
/**
 * Papiamento (pap) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/pap.jsonc` — pap.wikipedia dump, 31,099 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 14,763 · `year` 14,742 · `abbrev` 5,825 ·
 * `ordinal-latin` 2,330 · `decimals` 1,951 · `ranges` 1,514 · `dotted` 759 · `signs` 627 · `units` 564 ·
 * `percent` 364 · `clock` 233 · `fractions` 165 · `degrees` 98 · `era-marker` 71 · `currency` 56.
 *
 * ⚠ TWO OFFICIAL ORTHOGRAPHIES, BOTH CURRENT, BOTH IN THIS CORPUS — the prediction this round was picked
 * to test, and it holds. Curaçao and Bonaire write PHONOLOGICALLY (`ku`, `-shon`, `i`, `k-`) and Aruba
 * writes ETYMOLOGICALLY (`cu`, `-cion`, `y`, `c-`), and pap.wikipedia carries both, article by article:
 *
 *     Curaçaoan  "Segun Senso 2023, 24,6% di e poblashon ta konsistí di migrantenan di promé generashon"
 *     Aruban     "Na Aruba e dollar Mericano ta acepta casi tur caminda. E florin cu e dollar ta mara"
 *
 * Measured over the retained text: **205 segments are Curaçaoan-marked, 102 Aruban-marked, and 8 carry
 * both**. `-shon` ×246 against `-cion` ×135, `ku` ×344 against `cu` ×207, `i` ×461 against `y` ×256.
 *
 * ⚠ AND THE PRACTICAL CONSEQUENCE IS IN THE SEPARATORS, where the two norms bring their source
 * conventions with them:
 *
 *     Curaçaoan / Dutch    DOT groups     `130.627 habitante` · `158.006 residente` · `2.754.000 km²`
 *                          COMMA decimates `24,6%`
 *     Aruban / American    COMMA groups   `1,290 km di kosta` · `1,016` · `52,000 km2`
 *                          DOT decimates  `27.3°C`
 *
 * So EACH MARK BOTH GROUPS AND DECIMATES in the same artifact, and the codepoint settles nothing. ⚠ What
 * settles it is the THREE-DIGIT TEST APPLIED SYMMETRICALLY: every grouped instance in the corpus has
 * exactly three digits after the mark and every decimal has one or two. The rule runs the same test on
 * both marks and then folds whatever is left onto the comma the engine's number branch reads.
 *
 * ⚠ THE VOCABULARY, HOWEVER, EXISTS IN ONLY ONE NORM. `porshento` ×28 and `kuadrá` ×23 are attested;
 * their Aruban spellings `porcento` and `cuadrado` score **zero** on the same wiki. So the measure words
 * this layer emits are Curaçaoan, and a reader of an Aruban-orthography article gets a Curaçaoan-spelled
 * one. That is a real cost, it is small, and it is stated rather than discovered later.
 *
 * ⚠ THERE IS NO CLOCK RULE. `clock` is 233 corpus-wide and the retained text's colon instance is a FLAG
 * PROPORTION — "E strepinan horizontal tin un proporshon di **5:1:2**" — beside the flag's fractions
 * (`1/6 i 2/9 di e haltura`). A clock rule would read the Curaçao flag's stripe ratio as five past one
 * (trap 9). `ora` ×58 is attested and the corpus writes it as a word where it means an hour.
 *
 * SOURCING — every word emitted is a pap.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/pap.jsonc`.
 */

/** ⚠ NEVER `\b` — Papiamento carries `á é í ó ú ñ ò è ù`, which `\b` treats as boundaries (trap 1/23). */
/** Normalize one Papiamento input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizePapiamento(input: string): string {
    let s = input;

    // 1) THE SEPARATORS, and ⚠ THE SAME TEST IS RUN ON BOTH MARKS — see the header. Each of `.` and `,`
    //    both groups and decimates in this corpus, following the orthography of the article it is in, so
    //    the codepoint settles nothing and the THREE-DIGIT TEST settles everything: every grouped
    //    instance has exactly three digits after the mark (`130.627`, `2.754.000`, `1,290`, `52,000`) and
    //    every decimal has one or two (`24,6%`, `27.3°C`).
    //    ⚠ THE WHOLE NUMBER AT ONCE, not one join per pass (trap 63); the trailing guard rejects a DIGIT
    //    and nothing else, or every clause-final figure is declined (trap 58).
    s = rewrite(s, /(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)/gu,  // space, NBSP, NNBSP, thin space
        (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space
    s = rewrite(s, /(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/\./gu, ""));
    s = rewrite(s, /(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));
    //    …and what is left with one or two digits after a DOT is a decimal, folded onto the comma.
    s = rewrite(s, /(?<!\d)(\d+)\.(\d{1,2})(?!\d)/gu, "$1,$2");

    // 2) THE ERA MARKER, in the Aruban spelling the corpus writes — "Hipocrates (460 a.C.–370 a.C.),
    //    Sorano de Efeso (98–138 d.C.) y Galeno (129–216 d.C.)". `antes` ×26, `despues` ×133,
    //    `Cristo` ×21 on pap.wikipedia. The final dot is kept at a sentence end (trap 10).
    const multi: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_LETTER_BEFORE}a\\s?\\.\\s?C\\s?\\.`, "gu"), "antes di Cristo"],
        [new RegExp(`${NOT_LETTER_BEFORE}d\\s?\\.\\s?C\\s?\\.`, "gu"), "despues di Cristo"],
    ];
    for (const [re, word] of multi)
        s = rewrite(s, re, (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 3) SIGNS, before the range rule spends the hyphen.
    s = rewrite(s, /(^|(?<!\d)[\s(])[-−–]\s?(\d)/gu, "$1menos $2");

    // 4) DEGREES — both senses are here, as in Turkmen and Shan: the coordinates (`46° 37' W`,
    //    `10° nort di e ekuator i 84° wèst`, `longitut 180°`), an interior angle (`kada ángulo di e strea
    //    ta 36°`) and the temperatures (`entre 24 i 36°C`, `27.3°C`, `te 32°C`). `grado` ×41 /
    //    `gradonan` ×4, `Celsius` ×10.
    s = rewrite(s, /(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 grado Celsius");
    s = rewrite(s, /(\d)\s?°\s?F(?![\p{L}\p{M}])/gui, "$1 grado Fahrenheit");
    s = rewrite(s, /(\d)\s?°\s?(\d+)\s?[′']/gu, "$1 grado $2 minüt ");
    s = rewrite(s, /(\d)\s?°/gu, "$1 grado ");

    // 5) RANGES. The dash was dropped and the endpoints fused — `98–138 d.C.` read as one run, `129–216`
    //    likewise. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE: Papiamento writes `entre X i
    //    Y` and the corpus does so in full where it means it ("ta varia entre 24 i 36°C"), so imposing
    //    the connective on a bare dash would double a word the writer already chose or not.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58), and a chain of three or more
    //    hyphen-joined groups is an identifier rather than a span.
    s = rewrite(s, /(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = rewrite(s, /(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return rewrite(s, /[^\S\n]{2,}/gu, " "); // the pipeline string: a collapse that does not report desyncs every later offset
}
