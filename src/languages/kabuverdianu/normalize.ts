/**
 * Kabuverdianu / kriolu (kea) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. FLEURS `kea_cv`, 3,945 rows deduplicated to **1,931 unique utterances** (FLEURS repeats each
 * sentence per speaker). There is NO mined artifact for kea, so every count below was measured by hand over
 * column 3 of the TSVs; see `docs/investigations/kea_normalization_investigation.md` for the commands.
 * Corpus-wide counts for the classes claimed here: `digit-run` 673 · `dot-in-number` 55 ·
 * `units` 45 (km ×78, mm ×26, m ×25, km/h ×24, kg ×8 digit-adjacent) · `slash` 24 · `percent` 21 ·
 * `colon` 20 · `comma-in-number` 17 · `dotted` 17 · `hyphen-range` 14 · `degree/ordinal sign` 13 ·
 * `era-marker` 11 · `currency-sign` 7 · `dash` 7 · `double-hyphen` 4 · `exponent` 3 · `math-sign` 2.
 *
 * ⚠ ONE ORTHOGRAPHY, NOT TWO — THE PAPIAMENTO PREDICTION DOES NOT TRANSFER. Papiamento carries Curaçaoan
 * phonological and Aruban etymological spelling in one corpus (205 segments against 102), and had to ship
 * Curaçaoan-spelled measure words into Aruban articles. Kabuverdianu is likewise written both in ALUPEC/
 * ALUPEK and in Portuguese-etymological spelling — and this corpus is **ALUPEC, categorically**:
 *
 *     ku ×427 | cu ×0     ki ×899 | qui ×0     kel ×284 | quel ×0     txeu ×175 | cheu ×0
 *     k ×7668 | c ×366    tx ×348 | ch ×99     -son ×713 (the reflex of -ção) | -ção ×0     ç ×1
 *
 * ⚠ AND THE ⟨c⟩ RESIDUE WAS READ RATHER THAN ASSUMED. Every lowercase-initial word containing ⟨c⟩ or ⟨ç⟩ is
 * **28 types / 39 tokens**, and all but four are foreign loans, Latin quotations or proper nouns —
 * `hockey`, `cella`, `civitas`, `cappuccino`, `cluster`, `podcasts`, `canyon`, `caucus`. The four genuine
 * etymological slips are `asisténcia` (which sits in the SAME utterance as `asisténsia`), `acordu`,
 * `caro`/`carro` and `octogonal`. So there is no orthography split to straddle, and every word emitted here
 * is spelled the one way the corpus spells everything else — a cost pap had to state and this round does not.
 *
 * ⚠ THE SEPARATORS: PAPIAMENTO'S STRUCTURAL FINDING REPRODUCES, WITH THE DOMINANCE INVERTED AND A PRICE.
 * Each of `.` and `,` both GROUPS and DECIMATES here too, but in pap the split was per-article and per-
 * orthography; here there is one orthography, the European convention dominates both marks, and the
 * American convention leaks in on figures carried untranslated from the shared FLEURS source set:
 *
 *     DOT   groups ×43   `783.562 kilómitrus kuadradu` · `1.000 libras` · `¥130.000` · `19.500 km²`
 *           decimates ×12 `2.2 milhon` · `152.4m` · `2.4Ghz` · `Figura 1.1` · `15.00 UTC` · `802.11a/b/g/n`
 *     COMMA decimates ×14 `14,7 mil milhon di dóla` · `6,5` · `12,8 km` · `3,50 m` · `2,8` · `1,5` ×3
 *           groups ×3     `Ku 17,000 ilhas pa skodje` · `kintu y sestu ku 2,220 y 2,207 pontus`
 *
 * ⚠ AND THE THREE-DIGIT TEST IS NOT FREE HERE, WHICH IT WAS IN PAPIAMENTO. pap could record that every
 * grouped instance had exactly three digits and every decimal one or two. kea has one counter-example:
 * `un staka di serka di 30 pes (**9,114 m**)` — 30 feet is 9.144 m, a decimal with a THREE-digit fraction.
 * Priced both ways: the symmetric test buys 3 correct groupings for 1 wrong decimal; testing the dot alone
 * buys 1 correct decimal for 3 wrong groupings. 3-for-1, so the symmetric test ships and the counter-example
 * is named rather than discovered later.
 *
 * ⚠ THE DEFECT THAT MOTIVATES THE WHOLE LAYER IS INVISIBLE TO DROP. Before this pass the grouping dot was
 * read as a FULL STOP: `783.562` → *setisˈẽtus oitˈẽtɐ tɾˈes **.** kiɲˈẽtus sɐsˈẽtɐ dˈos*, and `1.000
 * libras` → *ˈũ **.** zˈɛɾu lˈibɾɐs*, "one, zero pounds". 43 instances, and DROP/DIGIT/RAWMARK are all
 * silent on it because nothing is dropped and nothing survives.
 *
 * ⚠ THE COLON IS A CLOCK HERE, WHICH IS THE OPPOSITE OF PAPIAMENTO. pap has no clock rule because its one
 * digit-colon is the Curaçao flag's stripe ratio (`5:1:2`). kea has **20 colons and 17 are clocks** —
 * `11:20`, `9:30 óra lokal (0230 UTC)`, `06:30 y 07:30`, `07:19 ora lokal (21:19 GMT Sesta-Fera)`. The three
 * that are not are `un 2:2 (un grau di sigundu klasi inferior)`, a British degree classification, and
 * `rifiridu komu 3:2`, a ratio — and a two-digit MINUTE requirement declines both without a special case.
 *
 * ⚠ `º` U+00BA IS THE ORDINAL INDICATOR HERE, NOT A DEGREE-SIGN SUBSTITUTE — the third round in a row with a
 * confusable in this slot, and the first where it goes the other way. Aragonese and Asturian found `º`
 * standing in for `°`; of kea's **9 `º`, seven are the genuine masculine ordinal** (`37º país`, `1º dia di
 * mês`, `10º Izérsitu Italianu`, `1.000º selu`, `60º di tenpurada`, `1º y 3º rijimentus`), one is `Nº 11`,
 * and exactly one is a temperature — `un dia kenti na Santa Clara ku tenperatura na **90º**.`, which is also
 * the only one NOT followed by a letter. The real degree sign `°` is a separate ×2 (`35°W`, `+30°C`).
 *
 * ⚠ SOURCING: THERE IS NO WIKI, NO ESPEAK, AND A SEVEN-WORD REFEREE. `attest.ts --lang kea` exits 3 —
 * *kea.wikipedia.org does not respond as a wiki* (Kabuverdianu has no Wikipedia in mainspace); espeak-ng
 * ships `pt_list` and `crh_list` but no `kea_list`; and `tools/referee-eval/referees/kea.kaikki-anchors.tsv`
 * is seven words, none of them a unit or a currency. This is trap 51's floor with the floor removed. So the
 * haystack is the 1,931-utterance corpus and nothing else, and **every word below is a kea corpus token
 * whose surrounding prose was read**. ⚠ The lexifier is NOT a substitute: a Portuguese word attested in
 * Portuguese sources says nothing about Kabuverdianu (trap 55, and the ckb/fa keys of trap 38).
 *
 * ⚠ TWO SENSE TRAPS, both caught by reading rather than counting. `grau` ×4 is an ACADEMIC DEGREE in one
 * instance (`un 2:2 (un grau di sigundu klasi inferior)`) and "to a certain extent" in another; the two that
 * license it here are `apénas alguns grau a norti di ekuador` (latitude) and `na 90(F)-grau di kalor`
 * (temperature). And `libras` ×5 is the POUND WEIGHT (`un pesoa ki ta peza 200 libras (90kg)`) — only the
 * singular of `un libra Britániku (GBP)` is the currency, so the `£` key takes `libra`.
 *
 * ⚠ WHAT IS REFUSED, AND WHAT EACH REFUSAL COSTS (registered in `ACCEPTED_SIGN_SILENCE`, keyed `kea`):
 *   · `mm` ×26 and `kg` ×8 — `milímitru`, `kilograma`, `kilu`, `quilo` are all ×0 and there is no second
 *     source to ask. The corpus DOES attest the `-mitru` stem twice (`kilómitru`, `sentímitru`), so
 *     `milímitru` is a compositional near-certainty and is still a word nobody has written. Undeclared is
 *     NEUTRAL — the abbreviation reads exactly as it does today (trap 53's ak case, not its Igbo case).
 *   · Celsius / Fahrenheit — ×0 both, `sources.ts` says `[NONE] scale-names` independently. The degree WORD
 *     ships and the scale letter is left to the cardinal path, which is what Hawaiian does.
 *   · the compass letter in `35°W` — kea west is `oesti` ×7 and the corpus never writes `W` for it. This is
 *     the Aragonese `ueste` case pointing the other way (trap 55).
 *   · the decimal WORD — `vírgula` ×0, and `pontu` ×11 is a point of view, a sports point, or the full stop
 *     of a sentence (`pontu final des frazi`), never the separator. The mark is SPENT ON A SPACE.
 *   · `+` ×2 — `mais` ×0, and one of the two does not want a word anyway: `tenperaturas riba di +30°C`, where
 *     `riba di` already IS "above". `(UTC+1)` is the contentful one and is the stated price.
 *   · minus, `=`, `<`, `>`, `×`, `÷`, `±` — ×0 each. All 14 digit-flanked hyphens are ranges or scores.
 *   · `º` above 10 and every `ª` — see step 6.
 *
 * SOURCING TABLE — word, corpus count, and the example whose sense was read:
 *   `pur sentu` ×13 (`34 pur sentu di partisipantis`) · `dóla` ×5 (`un taxa di 30 dóla, ô 10 dóla`) ·
 *   `libra` ×2 (`un libra Britániku (GBP)`) · `kilómitru` ×4 (`50 kilómitru (31 milhas)`) · `métru` ×5
 *   (`100 métru di distánsia`) · `sentímitru` ×1 (`6 sentímitru di prisipitason`) · `milha` ×6 ·
 *   `kuadradu` ×6 (`783.562 kilómitrus kuadradu`) · `kúbikus` ×1 (`120--160 métrus kúbikus`, the shared
 *   FLEURS Luno sentence — trap 45) · `óra` ×16 · `sigundu` ×30 (`8 milhas pa sigundu`) · `grau` ×4 ·
 *   `númeru` ×27 (`riatoris Númeru 1 y 2`) · `milhon` ×25 · `mil` ×10 · `di` ×3983 · `y` ×1106 ·
 *   `meiu` ×19 · `tersu` ×4 · `kuartu` ×11 · `kintu` ×7 · priméru ×68 · sigundu ×30 · terseru ×5 ·
 *   sestu ×3 · sétimu ×2 · oitavu ×1 · nonu ×1 · désimu ×7 · `antis` ×49 · `dipôs` ×109 · `Kristu` ×1.
 */
import { MANIFEST } from "./manifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { NOT_LETTER_BEFORE } from "../../core/boundaries.ts";

/** ⚠ NEVER `\b` — Kabuverdianu carries `á é í ó ú â ê ô à è ò` and the ALUPEC apostrophe, which `\b` treats
 *  as boundaries (trap 1/23). Written as an explicit lookaround and reused, so the hazard is stated once. */
/**
 * The shared SYMBOL tier. Every form declared here is a kea CORPUS token read in slot — see the header;
 * there is no wiki and no espeak to fall back on.
 *
 * ⚠ THE UNIT TABLE IS DELIBERATELY INCOMPLETE. `mm` ×26 and `kg` ×8 are the corpus's second and fifth most
 * frequent digit-adjacent abbreviations and are ABSENT here, because no kea word for either exists in any
 * source this repo can reach. Declining leaves them reading exactly as they read today; inventing them would
 * be the failure this tree ranks worst.
 *
 * ⚠ ONE-LETTER KEY: `m` IS DECLARED AND `g` IS NOT. `m` is 25 digit-adjacent instances, every one a genuine
 * metre (`4892 m`, `3,50 m di largura`, `152.4m`, `15 métru`). The `802.11a/b/g/n` designations in this
 * corpus (×5) are exactly the trap-28/46 hazard, and the tier's `NOT_VERSION` guard handles them — which is
 * only true because this tier runs at step 1, BEFORE step 3 spends the version dot (trap 39/46: a guard that
 * needs a character cannot live downstream of the rule that rewrites it). `g` is left undeclared because
 * every digit-adjacent `g` in this corpus is `802.11g` or `2.4Ghz`, never a gram.
 *
 * ⚠ `AUD$` IS ITS OWN KEY (trap 64). The corpus writes `na dá más di AUD$45 milhon`, and the tier's
 * left-hand letter guard — correctly there to stop a bare `$` matching inside an identifier — declines a
 * composite mark outright. Without the compound key the sentence loses its currency noun silently and no
 * leak class sees it. `$` ×3 is the whole class here and one of the three is this shape.
 *
 * ⚠ THE RATE JOINER IS `pa`, NOT `pur`. Both are attested in the slot; `pa` wins on count — `pa óra` ×4
 * (`240 kilómitru pa óra`, `149 milhas pa óra`, `17.500 milhas pa ora`, `3.000 milhas pa ora`) and
 * `pa sigundu` ×2 (`8 milhas pa sigundu`, `1,5 kilómitru pa sigundu`) against `pur óra` ×1. Recorded because
 * `pur` is the joiner of `pur sentu` and the obvious guess.
 *
 * ⚠ THE MEASURE WORD FOLLOWS ITS UNIT and the forms are declared SINGULAR. The corpus writes both numbers
 * after a numeral (`50 kilómitru` and `783.562 kilómitrus`, `100 métru` and `83 métrus`), which is ordinary
 * for a creole with weak number agreement, so a single invariant form is the honest declaration rather than
 * a CountForms pair that would assert a rule the corpus does not keep.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["pur sentu"],
    currency: { "AUD$": ["dóla"], "$": ["dóla"], "£": ["libra"] },
    units: {
        km: ["kilómitru"], m: ["métru"], cm: ["sentímitru"], mi: ["milha"],
        mph: ["milha pa óra"],
    },
    unitPer: "pa",
    rateDenominators: { h: "óra", hr: "óra", s: "sigundu" },
    exponentWords: { squared: ["kuadradu"], cubed: ["kúbiku"], position: "after" },
    magnitudes: ["milhons", "milhon", "mil"],
    magnitudeConnective: "di",
    ampersand: "y",
});

/** Read from the manifest — see the jsonc, where the evidence lives. */
const ORDINAL = MANIFEST.ordinals;

/** Fraction denominators, 2–5 — the four the corpus attests IN THE FRACTION SENSE (`un tersu sta kubertu pa
 *  agu`, `un kintu ta trabadja na agrikultura`, `kuazi un kuartu ta trabadja na indústria`, `mudansa di
 *  kuartu pa meiu kilómetru`). 6 and up are ordinals in this corpus and never denominators, so they are not
 *  extrapolated (trap 8/13: a table is correct exactly where you looked). */
const DENOMINATOR: Readonly<Record<string, string>> = { 2: "meiu", 3: "tersu", 4: "kuartu", 5: "kintu" };

/** Normalize one Kabuverdianu input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeKabuverdianu(input: string): string {
    let s = input;

    // 1) THE SHARED SYMBOL TIER FIRST, for two reasons. Its own numeral pattern reads `783.562` and `14,7`
    //    as ONE token, and steps 2 and 3 are precisely what splits those; and its `NOT_VERSION` guard works
    //    by seeing the DOT, which step 3 spends (traps 39, 46).
    s = SYMBOLS(s);

    // 2) DE-GROUPING, BY THE THREE-DIGIT TEST ON BOTH MARKS — see the header. The dot groups 43 times and
    //    the comma 3; both conventions are in this one corpus and the codepoint settles nothing.
    //    ⚠ THE WHOLE NUMBER AT ONCE, not one join per pass (trap 63) — `5.000.000` is three groups and the
    //    per-join idiom re-anchors inside the remainder at four. ⚠ AND THE TRAILING GUARD REJECTS A DIGIT
    //    AND NOTHING ELSE (trap 58): a `(?![\d.,])` here would decline every clause-final figure, and this
    //    corpus ends sentences on `¥7.000.` and `3.980 milhas).`
    //    ⚠ THE PRICE, STATED: `30 pes (9,114 m)` is a DECIMAL with three fraction digits and is read here as
    //    9114. It is the corpus's only counter-example, against three correct groupings.
    //    ⚠ THE SPACE ARM IS ROBUSTNESS, NOT A REPAIR, AND IT IS LABELLED AS SUCH (trap 22). `\d[ ]\d{3}` is
    //    ×0 in kea_cv, so it changes NO corpus reading; it is here because `review.ts`'s probe `5 000` reads
    //    as *sˈĩŋku zˈɛɾu* without it, and because the guarded three-digit form cannot fuse two independent
    //    numbers the way a looser one would.
    const degroup = (mark: string) =>
        new RegExp(`(?<!\\d)(?<![\\d][.,])([1-9]\\d{0,2})((?:${mark}\\d{3})+)(?!\\d)`, "gu");
    s = s.replace(degroup("[ \\u00a0\\u202f\\u2009]"), (_m, head: string, rest: string) =>  // space, NBSP, NNBSP, thin space
        head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space
    s = s.replace(degroup("\\."), (_m, head: string, rest: string) => head + rest.replace(/\./gu, ""));
    s = s.replace(degroup(","), (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));

    // 3) WHAT IS LEFT BETWEEN TWO DIGITS IS SPENT ON A SPACE, NOT SPOKEN. ⚠ NO DECIMAL WORD IS SOURCEABLE:
    //    `vírgula` is ×0 and `pontu` ×11 is a point of view, a sports point, or the full stop of a sentence
    //    (`pontu final des frazi`) — never the separator. So the defect being fixed is the FALSE SENTENCE
    //    BREAK mid-quantity (`14,7` read *kɐtˈoɾzi , sˈeti*), exactly Hawaiian's position and for the same
    //    reason.
    //    ⚠ AND THAT IS WHY THE VERSION DOT NEEDS NO GUARD HERE. `802.11n` and `2.4Ghz` are spent the same
    //    way and neither reading gains or loses a word — the mark becomes a space in both, so the
    //    decimal-vs-designation distinction cannot change the output. It DOES matter one step earlier, which
    //    is why the tier is at step 1.
    s = s.replace(/(?<!\d)(\d+)[.,](\d+)(?!\d)/gu, "$1 $2");

    // 4) THE ERA MARKER, before any generic dotted-abbreviation handling. The corpus writes it four ways —
    //    `323 a.C.`, `1000 A.C.`, `400 D.C.`, `sékulu III a.C.` — ×11 in all. Composed from attested pieces
    //    (the Fula `e teemedere` move): `antis` ×49 and `dipôs` ×109 both take `di` + a noun in this corpus
    //    (`antis di Sigundu Géra Mundial`, `dipôs di géra`), and `Kristu` ×1 (`selebra risureison di
    //    Kristu`). ⚠ THE LEFT GUARD ALSO EXCLUDES A PRECEDING DOT, so `10.000 E.D.C.` — whose reading is not
    //    established — is left whole instead of being half-claimed as `E. dipôs di Kristu` (trap 10).
    //    ⚠ AND THE FINAL DOT IS KEPT AT A SENTENCE END, or the pause is lost with the abbreviation.
    const ERA: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`(?<![\\p{L}\\p{M}.])[aA]\\s?\\.\\s?[cC]\\s?\\.`, "gu"), "antis di Kristu"],
        [new RegExp(`(?<![\\p{L}\\p{M}.])[dD]\\s?\\.\\s?[cC]\\s?\\.`, "gu"), "dipôs di Kristu"],
    ];
    for (const [re, word] of ERA)
        s = s.replace(re, (m0: string, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)'”]?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 5) THE NUMBER SIGN. `kosmonauta Nº 11` ×1. `númeru` ×27 and one of them is exactly this slot —
    //    "riatoris Númeru 1 y 2 di se sentral di Shika fitxadu". Trap 36 records that № must NOT be folded
    //    to a Latin `No`, because that substitutes an English word for a dropped sign; it needs the
    //    language's own word, and kea has one. Guarded on a FOLLOWING DIGIT so a bare `Nº` cannot match.
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}N\\s?[º°]\\s?(?=\\d)`, "gu"), "númeru ");

    // 6) THE ORDINAL INDICATOR — before the degree step, which would otherwise claim it.
    //    ⚠ THIS IS THE ROUND'S CONFUSABLE, AND IT POINTS THE OPPOSITE WAY FROM THE LAST THREE. Aragonese
    //    and Asturian found `º` U+00BA standing in for the degree sign; here seven of nine `º` are the
    //    genuine masculine ordinal and only `90º` is a temperature. Before this step `1º dia di mês` read
    //    *ˈũ dˈiɐ dˈi mˈes* — "one day of month" — which is a READING, not garbage, and no counter sees it
    //    (trap 56).
    //    ⚠ TWO REFUSALS, BOTH MEASURED, BOTH LEAVING THE TEXT EXACTLY AS IT READS TODAY (trap 53's ak case):
    //      · VALUES ABOVE 10. The series is attested 1–10 and compositionally as `désimu priméru`,
    //        `désimu sestu`, `désimu oitavu`, `vijésimu kuartu`. `37º país`, `60º di tenpurada` and
    //        `1.000º selu` would need `trijésimu` / `sesajésimu` / `milésimu`, all ×0. Refused whole.
    //      · THE FEMININE `ª` ENTIRELY. kea DOES inflect the low ordinals — `Priméra Géra` ×6, `Sigunda
    //        Géra` ×8, `Terséra Klasi` ×1 — so this is not a creole-invariance argument, and it is a
    //        DIVERGENCE from the assumption a gender-blind rule would make. But the corpus's two `ª` are
    //        `7ª maior ilha` and `5ª lugar`, and `sétima` and `kinta` are ×0. Two instances, refused.
    //    A FOLLOWING LETTER is required, which is what separates `1º dia` / `3º rijimentus` / `10º
    //    Izérsitu` / `7ª maior` from the clause-final `tenperatura na 90º.` that step 7 reads as a degree.
    s = s.replace(/(?<![\d.,])(\d{1,2})\s?º(?=\s?[\p{L}])/gu,
        (m0: string, n: string) => (Number(n) >= 1 && Number(n) <= 10 ? ORDINAL[Number(n)]! : m0));

    // 7) DEGREES. `grau` ×4, and the two instances that license it are the two senses this step needs —
    //    `apénas alguns grau a norti di ekuador` (latitude) and `na 90(F)-grau di kalor` (temperature).
    //    ⚠ THE SCALE LETTER IS LEFT, DELIBERATELY. `Celsius` ×0, `Fahrenheit` ×0, `centígradu` ×0, and
    //    `sources.ts` reports `[NONE] scale-names` from its own haystack. Emitting the degree word is a gain
    //    (`+30°C é kumun` read as *tɾˈĩtɐ k ˈɛ kumˈũ*, a bare consonant where the quantity should be); naming
    //    a scale nobody has written would not be.
    //    ⚠ AND THE COMPASS LETTER IS LEFT TOO. `35°W` ×1 — kea west is `oesti` ×7 and this corpus never
    //    writes `W` for it, so a Hawaiian-style compass arm would be asserting an abbreviation the language
    //    does not use. That is the Aragonese `ueste` finding (trap 55) with the evidence pointing the other
    //    way: there, a ported `W` matched nothing; here, claiming one would invent a reading.
    //    ⚠ `º` REACHES THIS STEP ONLY WHEN NOT FOLLOWED BY A LETTER — the one temperature (`90º.`) — because
    //    step 6 has already taken the ordinals it can read and deliberately left `37º país`, `60º di
    //    tenpurada` and `1.000º selu` alone. ⚠ AND THE GUARD MUST LOOK PAST A SPACE: written `(?![\p{L}])`
    //    it passes on `37º país`, whose next character is a SPACE, and the step-6 refusal is then undone
    //    one line later — "trinta seti GRAU país". Measured on all three refused instances before and after.
    s = s.replace(/(\d)\s?°/gu, "$1 grau ");
    s = s.replace(/(\d)\s?º(?!\s?[\p{L}\p{M}])/gu, "$1 grau ");

    // 8) THE CLOCK — and this is the sharpest DIVERGENCE from Papiamento, which has no clock rule at all
    //    because its one digit-colon is the Curaçao flag's stripe ratio. **20 colons here and 17 are
    //    clocks**: `11:20`, `1:15 di sábadu di sedu`, `Izatamenti 8:46 di sedu`, `9:30 óra lokal (0230
    //    UTC)`, `06:30 y 07:30`, `07:19 ora lokal (21:19 GMT Sesta-Fera)`, `10:08 di noti`. Before this step
    //    every one of them broke its own sentence, because kabuverdianu.jsonc maps `:` → `,`.
    //    ⚠ THE TWO-DIGIT MINUTE IS THE WHOLE GUARD, and it needs no special case: the three non-clocks are
    //    `un 2:2 (un grau di sigundu klasi inferior)` — a British degree classification — and `rifiridu komu
    //    3:2`, a ratio, and both have a one-digit right operand.
    //    ⚠ THE HOUR WORD IS NOT ADDED: the writer supplies `óra` where it is meant (`9:30 óra lokal`,
    //    `11:00 óra`), so only the colon is spent, which is Hawaiian's choice for the same reason.
    //    ⚠ THE TRAILING GUARD REJECTS A DIGIT OR A CONTINUING COLON, NOT A DOT OR COMMA — trap 58, and this
    //    corpus supplies the instance that proves it: the fleet-standard `(?![\d:.,])` declines
    //    `**11:20**, pulísia pidi manifestantis`, which opens an utterance and is the very first clock in
    //    the corpus. What has to be excluded is a THIRD field continuing the time, and `(?![.,]\d)` is what
    //    tests that while letting a clause mark through.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?![.,]\d)/gu, "$1 $2");

    // 9) FRACTIONS. Two sources, ONE SHAPE, because of an upstream fold.
    //    · the corpus's own slashed instance — `Padron debe ser sufisientimenti prufundu, 5 mm (1/5
    //      polegadas)` — which read as *ˈũ sˈĩŋku*, "one five";
    //    · the VULGAR fractions in `ta midi 29¾ polegada pa 24½ polegada` (the Magna Carta, the universal
    //      FLEURS sentence), which decomposed into two bare cardinals — *vˈĩti nˈovi tɾˈes kuˈɐtu*,
    //      "twenty-nine three four inches".
    //    ⚠ AND THE SECOND NEVER REACHES A `¾` ARM, WHICH IS TRAP 39 ONE LEVEL UP: `core/unicode.ts` folds
    //    `¾` → ` 3/4` and `½` → ` 1/2` at the registry's dispatch point, BEFORE any engine's `text()`. A
    //    local `(\d)\s?¾` rule here type-checks, tests green when `normalizeKabuverdianu` is called
    //    directly, and is DEAD in the real pipeline. So the rule is written on the ASCII shape the fold
    //    produces and the numerator is left as DIGITS for the engine's own cardinal path to read.
    //    ⚠ THE DENOMINATORS ARE ONLY THE FOUR THE CORPUS ATTESTS IN THE FRACTION SENSE (see DENOMINATOR);
    //    6 and up appear in this corpus as ORDINALS and never as denominators, so they are refused whole
    //    rather than extrapolated from the ordinal table (trap 8: a table is correct where you looked).
    //    ⚠ AND THE RULE IS DIGIT-GATED ON BOTH SIDES, because 23 of the corpus's 24 slashes are between
    //    WORDS (`y/ô`, `di/pa`, `bilheti di ida/volta`, `Jakar/Bumthang`, `agu/árias`) or inside a rate the
    //    tier has already read.
    s = s.replace(/(?<![\d.,\/])(\d{1,2})\s?\/\s?([2-5])(?![\d\/])/gu,
        (_m, n: string, d: string) => `${n} ${DENOMINATOR[d]}`);

    // 10) RANGES. Before this step the dash was dropped and the endpoints FUSED with no pause at all —
    //     `1418 - 1450` read as one run of eight words, `2-3 km di jélu` as *dˈos tɾˈes*.
    //     ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE, which is pap's and haw's finding holding
    //     here: kea writes the span in full where it means it — `entri 06:30 y 07:30`, `100 a 250 métrus`,
    //     `3 a 5 pur sentu di tudu kriansas`, `entri ¥2.500 y ¥130.000` — so imposing a joiner on a bare
    //     dash would double a word the writer already chose or did not.
    //     ⚠ AND THE MARK IS THE ASCII HYPHEN AND A DOUBLED ASCII HYPHEN, NOT AN EN DASH — the one place
    //     pap's and haw's rule shape does NOT port. `–` ×1 and `—` ×6 in this corpus are every time
    //     PARENTHETICAL (`penas — farpas y bárbula — piskizadoris`), never between digits; the range marks
    //     are `-` ×14 and `--` ×4 (`120--160 métrus kúbikus`, `Guru Nanak (1469--1539)`, `di 7--2`,
    //     `desdi 1995--96`). A ported en-dash arm would match nothing and the doubled hyphen would be missed.
    //     ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — `dipôs (10-60 minotu).` is
    //     clause-final — and a chain of three or more hyphen-joined groups is an identifier, not a span.
    //     All 14 single-hyphen instances are ranges or scores; there is no negative number in this corpus.
    s = s.replace(/(\d)\s?--\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)/gu, "$1, $2");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
