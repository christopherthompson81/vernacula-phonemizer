/**
 * Aromanian (rup) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/rup.jsonc` — roa-rup.wikipedia, 1,492 paragraph segments, 27/36 cells.
 * ⚠ API-SOURCED, NOT DUMP-SOURCED: 1,000 random article intros plus a targeted `insource:` fill over a wiki
 * of 1,389 articles, so the artifact covers a large FRACTION of the whole encyclopedia but its `sample` is
 * not a frequency-representative stride. Counts below are over the 643 retained segments and are quoted as
 * what they are — instances in this artifact, not rates in the language.
 *
 * ⚠ THE HEADLINE: ALL FOUR CONVENTIONS ARE IN USE, AND ONE SENTENCE CARRIES TWO OF THEM.
 *
 *     "Ari unã populatsie di **206,235** (2004) shi unã suprafatsã di **111,2** km2"
 *          the COMMA GROUPS ─────┘                    the COMMA DECIMATES ──┘
 *
 *     "numirlu a populatsiiljei eara **22.834** (77%) Machidonj, **5.798** (**19,5%**) Turtsã"
 *          the DOT GROUPS ───────────┘                                        └── the COMMA DECIMATES
 *
 * Measured: dot+3 digits ×25 (ALL grouping — `2.601 m`, `52.360 bãnãtori`, `371.000 km2`), dot+1–2 ×9 (all
 * decimal or a dotted date), comma+3 ×8 (ALL grouping — `10,600,000 km²`, `869,709`, `4,154,200`), comma+1–2
 * ×12 (ALL decimal — `1,5 milionji`, `221,6 km²`, `56,70%`), and the SPACE groups too (×4, `216 061 bãn.`,
 * `21 000 000`). ⚠ So the codepoint settles nothing in EITHER direction, and the THREE-DIGIT TEST APPLIED
 * SYMMETRICALLY TO BOTH MARKS settles everything — the Papiamento mechanism, in a Romance language that
 * writes both of its neighbours' conventions at once.
 *
 * ⚠ AND THE DOTTED DATE MUST BE TAKEN FIRST. `23.12.1951`, `16.04.1959` are birth dates in the biography
 * stubs; two digits follow the first dot, so the decimal arm would claim them.
 *
 * ⚠ THE COLON IS NEVER A CLOCK — ×28, and every one is the population template's year-then-value
 * apposition: "Tu anlu 1992, cãsãbãlu avea 52.360 bãnãtori sh-tu 2001: 52.116". Twenty-eight instances,
 * zero times of day. No clock rule is written.
 *
 * ⚠ THE CORPUS GLOSSES ITS OWN PERCENT SIGN, ONCE: "tsi crishce pi **19,1 la sutã**" — the Aromanian phrase
 * (cf. Romanian *la sută*), in the same sentence type that elsewhere writes `%` (×14). `procentu` ×1 on the
 * wiki is the NOUN "a percentage" ("un procentu multu njicu dit populatsie"), not the unit after a figure.
 *
 * ⚠ AND THE ERA IS SPELLED OUT ON THE WIKI, BOTH HALVES: "Tu anlu 800 **ninti di Hristo**" ×2 and "anji
 * 50-70 **dupu Hristo**" ×1. Note the FORMS — `ninti` not `nãinti` (×34 against ×12) and `dupu` not `dupã`
 * (×56 against ×22) — so neither expansion is a construction from a parallel; both are quoted.
 *
 * ⚠ THREE WORDS SCORED AND WERE STILL WRONG (the Fula lesson, three times in one batch):
 *   · `gradi` ×2 — BOTH are `Gradi didactitsi`, teaching grades in an academic CV. No degree word exists
 *     here, so the three coordinate instances (`47°18′N`, `41°19′48″N`) stay unread.
 *   · `minus` ×2 — a Latin book title (`nec minus salutaris`) and a Romanian–Aromanian DICTIONARY line
 *     (`nghiosu = minus`). Not the arithmetic sign.
 *   · `kilometru` ×2 — both from the same glossary dump (`kilometru = kilometru`), never running text.
 *     Declared anyway, because a bilingual glossary entry IS a definitional attestation of the word and
 *     `metru` ×7 does occur in prose ("lungu di vãrã metru sh-giumitati"); said out loud rather than hidden.
 *
 * ⚠ `=` IS A DEFINITIONAL GLOSS ×17 — `giuvair = lucru mushat`, `Dies Dominus (l.lat.) = Dzuã-alu Dumidzã`,
 * `bãnedz ca tu grãdina alu Dumnidzã = ducu unã banã multu bunã`. The wiki carries Aromanian–Romanian
 * dictionary pages, and they are where most of this sign lives. Not one is an equation.
 *
 * SOURCING — every word emitted is a roa-rup.wikipedia TOKEN attestation whose examples were read, or a
 * phrase quoted from this artifact; see `tools/corpus/attest/rup.jsonc`.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
import { rewrite } from "../../core/provenance.ts";

/** ⚠ NEVER `\b` — Aromanian carries `ã â ľ ț ş ș ñ` and the digraph apostrophes, which `\b` treats as
 *  boundaries (trap 1/23). */
/**
 * The shared SYMBOL tier. `la sutã` is the corpus's own phrase (see the header); `metru` ×7, `kilometru` ×2,
 * `hectar` ×3, `milion` ×3 / `milioani` ×4, `miliardzã` ×2, `shi` ×140.
 *
 * ⚠ NO `exponentWords`. `patrat` and `pãtrat` are BOTH ×0 on this wiki, and `cubic` ×1 is architectural
 * ("volumenlu cubic tu formã di anclis bloc"), not a unit modifier — so `km²` ×2 and `km2` ×3 keep their
 * current reading rather than gaining a wrong one.
 *
 * ⚠ AND NO `currency`. The `currency` cell mined EMPTY, and the artifact's single sign-bearing segment is
 * keyboard-mash vandalism (`GGTGRYFF3RGTEEE3W23EU3IUWIQIUEU3UUE3U2U 22ND …`). A key declared on that is a
 * key declared on nothing.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["la sutã"],
    units: { "km": ["kilometru"], "m": ["metru"], "ha": ["hectar"] },
    ampersand: "shi",
    magnitudes: ["milion", "milioani", "miliardzã"],
});

/** Normalize one Aromanian input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeAromanian(input: string): string {
    let s = input;

    // 1) THE DOTTED DATE, FIRST — `23.12.1951`, `16.04.1959`, `18.11.1993` in the biography stubs. Three
    //    dot-joined runs, and the SECOND has two digits, so the decimal arm below would claim it and leave
    //    a stray sentence break. The dots become spaces; no date vocabulary is invented.
    s = rewrite(s, /(?<![\d.])(\d{1,4})((?:\.\d{1,4}){2,})(?!\d)(?!\.\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/\./gu, " "));

    // 2) THE SEPARATORS — ⚠ THE SAME TEST ON BOTH MARKS, because each does both jobs (see the header).
    //    Exactly three digits after the mark is a GROUP; one or two is a DECIMAL. Both are measured, in
    //    both directions, and one sentence carries a comma doing each.
    //    ⚠ THE WHOLE NUMBER AT ONCE, not one join per pass (trap 63), and the trailing guard rejects a
    //    DIGIT or a mark that continues the number — never a bare clause mark (trap 58).
    s = rewrite(s, /(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:[.,]\d{3})+)(?!\d)(?![.,]\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/[.,]/gu, ""));
    //    …and the SPACE, which this corpus also uses (`216 061 bãn.`, `170 000 di mãrchi`, `21 000 000`).
    s = rewrite(s, /(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)(?![.,]\d)/gu,  // space, NBSP, NNBSP, thin space
        (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space
    //    ⚠ AND WHAT IS LEFT WITH ONE OR TWO DIGITS IS A DECIMAL, spent rather than spoken: `virgulã` is ×0
    //    on this wiki and no other decimal-point candidate is attested, so the mark becomes a space. The
    //    defect being fixed is the false SENTENCE BREAK — `0.48%` read as *nulã . patrudzãts shi optu*.
    s = rewrite(s, /(?<![\d.,])(\d+)[.,](\d{1,2})(?!\d)(?![.,]\d)/gu, "$1 $2");

    // 3) THE EN/EM DASH SPAN, BEFORE THE ERA STEP — and the ordering is the point. This corpus writes
    //    `287 n.Hr. –212 d.Hr.` and `356 n. Hr. – 323 d.Hr.`, where the character to the LEFT of the dash
    //    is the abbreviation's dot, not a digit. Run after step 4 the dash has become a letter's neighbour
    //    (`…Hristo –212`) and no digit-anchored rule can see it, so the span is dropped and two eras fuse
    //    into one run. Matching `[.\d]` on the left, while the dot is still there, is what claims it.
    s = rewrite(s, /([.\d])\s?[–—]\s?(?=\d)/gu, "$1, ");

    // 3) THE ERA MARKERS, both spacings the corpus uses — `287 n.Hr. –212 d.Hr.`, `356 n. Hr. – 323 d.Hr.`,
    //    `17 d.Hr. - 69-71 d.Hr.`. They were reaching the g2p as bare letters with two false stops each.
    //    ⚠ BOTH EXPANSIONS ARE QUOTED, NOT CONSTRUCTED, and the forms matter: `ninti` (×34) not `nãinti`
    //    (×12), `dupu` (×56) not `dupã` (×22) — see the header.
    //    ⚠ THE FINAL DOT IS KEPT AT A SENTENCE END, or the pause is lost outright (trap 10).
    const era: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_LETTER_BEFORE}n\\s?\\.\\s?Hr\\s?\\.`, "gu"), "ninti di Hristo"],
        [new RegExp(`${NOT_LETTER_BEFORE}d\\s?\\.\\s?Hr\\s?\\.`, "gu"), "dupu Hristo"],
    ];
    for (const [re, word] of era)
        s = rewrite(s, re, (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 4) THE DOTTED ABBREVIATIONS this corpus writes beside its figures. `bãn.` is `bãnãtori` (×38, the
    //    commonest content word in the geography stubs — "216 061 bãn."), `nr.` is `numir` (×21, "Ledzea
    //    nr. 53/2013"), `gr.` is `grãtseascã` (×2, "Lingvistica (gr. γλωσσολογία)") and `dr.` is `doctor`
    //    (×5). Each was reaching the g2p as a consonant cluster plus a false sentence break.
    //    ⚠ `cca.` IS NOT CLAIMED — *circa* has no attested Aromanian expansion, and `etc.` is left because
    //    it is already read as a word.
    const abbrev: readonly (readonly [string, string])[] = [
        ["bãn", "bãnãtori"], ["nr", "numir"], ["gr", "grãtseascã"], ["dr", "doctor"],
    ];
    //    ⚠ THE GUARD IS A SENTENCE END, NOT A FOLLOWING WORD. The first version required a letter or digit
    //    after the dot and so declined the corpus's commonest instance outright — `216 061 bãn. (2002)`,
    //    where a BRACKET follows. Keeping the dot only when the clause actually ends is the same shape the
    //    era rule above uses, and it is right for the same reason (trap 10).
    for (const [ab, word] of abbrev)
        s = rewrite(s, new RegExp(`${NOT_LETTER_BEFORE}${ab}\\s?\\.`, "gu"),
            (m0: string, offset: number, full: string) => {
                const rest = full.slice(offset + m0.length);
                return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
            });

    // 5) ⚠ THE NUMERAL PARTICLE `di` SITS BETWEEN THE FIGURE AND THE UNIT, and the tier's adjacency
    //    requirement cannot bridge it. Aromanian writes both orders — `6650 km di la izvuri` (bare) and
    //    `largu 18 di km.di Tetova, 53 di km.di Scopia` (with the particle) — and only the first reaches
    //    the tier. Expanding the unit here leaves the particle exactly where the writer put it.
    s = rewrite(s, new RegExp(`(\\d+\\s+di\\s+)km${NOT_LETTER_AFTER}`, "gu"), "$1kilometru");

    // 6) THE SHARED SYMBOL TIER — `%` and the units. It must see the number still ADJACENT to its unit,
    //    which is why it runs after the separators (a grouped figure is one token by now) and before the
    //    range rule (which inserts a pause between the endpoints).
    s = SYMBOLS(s);

    // 7) RANGES. The dash was dropped and the endpoints fused — `1904 — 1905`, `700 – 1000 m`, `1911-1912`,
    //    `P.129-224`, `15-20Kg`. ⚠ ALL THREE DASHES DO IT HERE, which is why the class is `[-–—]` rather
    //    than the en/em pair alone: `1911-1912` and `15-20Kg` are hyphens and `1904 — 1905` is an em dash,
    //    in the same artifact.
    //    ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE: Aromanian writes `di X pãnã la Y` and the
    //    corpus does so in full where it means it ("pricura 6650 km di la izvuri … pãnã"), so imposing the
    //    connective on a bare dash would double a word the writer already chose or not.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58), and an adjacent slash means a legal
    //    citation (`nr. 53/2013`, `nr.21/98`) rather than a span.
    //    (the en/em arm ran at step 3, while the era dots were still in place — see there.)
    s = rewrite(s, /(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
