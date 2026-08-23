/**
 * Shan (shn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/shn.jsonc` — shn.wikipedia dump, 43,435 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 21,431 · `year` 21,328 · `decimals` 1,967 ·
 * `grouped` 1,397 · `initialism` 791 · `ranges` 640 · `signs` 558 · `letter-name` 428 · `clock` 324 ·
 * `arithmetic` 200 · `dotted` 122 · `percent` 108 · `abbrev` 104 · `ampersand` 101 · `fractions` 94 ·
 * `era-marker` 28 · `degrees` 22 · `roman` 21 · `units` 17 · `currency` 7.
 *
 * ⚠ THIS LAYER IS SMALLER THAN THE FOUR BEFORE IT, ON PURPOSE. Four consecutive Turkic rounds produced
 * four rich layers because Turkic corpora are dense with suffixed figures and self-glossing prose. Shan's
 * artifact is dense with FIGURES and thin with WORDS FOR THEM, and the honest response is a short file
 * with its refusals written down rather than a long one built on plausible compounds.
 *
 * ⚠ THE SEPARATOR CONVENTION IS THE ENGLISH ONE — dot decimal, comma grouping: `4.54`, `365.2564 ဝၼ်း`,
 * `2.5`, `1.1 ၿီႇလီႇယၢၼ်ႇ` against `2,759 ထတ်း` (2,759 feet, beside `4300 ထတ်း` in the same sentence) and
 * `၉၂၄,၆၀၈ ၵေႃႉ`. That inverts every Turkic round in this sweep and matches Scottish Gaelic's.
 *
 * ⚠ AND THE ASCII DOT IS FREE TO BE A DECIMAL POINT, BECAUSE SHAN DOES NOT END SENTENCES WITH IT. The
 * terminator is `။` U+104B (×1,173 in the retained text) and the clause mark `၊` U+104A (×957); the Latin
 * full stop occurs only inside `B.C`, `A.D.` and decimals. Every other layer in this sweep had to weigh a
 * dot-decimal rule against the sentence-final dot it would eat — ba declined outright, tt found 17 of its
 * 18 were figure references. Here the question does not arise, and that is a fact about the script.
 *
 * ⚠ THE CORPUS WRITES THE SAME COORDINATE BOTH WAYS, which is the round's best piece of sourcing:
 *     "ၼႂ်းၵႄႈၵၢင် **19 ၻီႇၵရီႇ 45 မိၼိတ်ႉ** လႄႈ **20 ၻီႇၵရီႇ 25 မိၼိတ်ႉ N** ဢိၵ်ႇ **98 ၻီႇၵရီႇ 99 ၻီႇၵရီႇ E**"
 * against, elsewhere, `၁၈° ၀' လႄႈ ၁၉° ၅၅'၊ လွင်ႇၵျီႇတုတ်ႉဢွၵ်ႇ ၉၄° ၄၀'`. So `ၻီႇၵရီႇ` and `မိၼိတ်ႉ` are
 * not dictionary picks — the publication glosses its own notation. Same for the currency sign:
 * "50 လၢၼ်ႉ**ၻေႃႇလႃႇ**($50 million)".
 *
 * ⚠ AND THE ATTESTATION TOOL SUPPLIES NO PRECISION HERE, WHICH IT SAYS ITSELF. Shan has no word
 * boundaries, so `attest.ts` reports a SUBSTRING count and marks it `attested*`. `မွင်း` scores ×108 and
 * every returned example is the place name ဝဵင်းၶမွင်းသဵၵ်ႉ; `မၢၵ်ႉ` scores ×116 and is the given name
 * *Mark* and the shop *City Mart*; `ႁဵင်` matches inside ႁဵင်းၵၢတ်ႈ. The mined artifact — where a whole
 * sentence can be read — is the stronger source in this language, and it is what every word below rests on.
 *
 * ⚠ FOUR REFUSALS, EACH A MISSING WORD RATHER THAN A MISSING RULE:
 *   · **PERCENT (108 corpus-wide) is unread.** The obvious compound `ႁူဝ်ပၢၵ်ႇ` ("head-hundred") is the
 *     word for CENTURY, and this corpus glosses it in English to prove it — "ပီႁူဝ်ပၢၵ်ႇ 15 (**15th
 *     Century AD**)", "မွၵ်ႈပီႁူဝ်ပၢၵ်ႇ 6 (**6th Century AD**)". `ပုၼ်ႈႁူဝ်ပၢၵ်ႇ` and `ရာၶိုင်ႈ` score 0,
 *     and `ပႃႇသႅၼ်ႉ` ×5 came back with no readable example — which in an unspaced script is not evidence.
 *   · **The CELSIUS scale name is unread.** `70°C (158°F)` gets its `ၻီႇၵရီႇ` and loses the scale.
 *   · **The DECIMAL POINT has no name.** `မၢၵ်ႉ` is the name *Mark*. The fractional digits are read one at
 *     a time with no separator word — which is what a reader does anyway — instead of the SENTENCE BREAK
 *     the ASCII dot was producing.
 *   · **`B.C` is unread while `A.D` is claimed.** `ပီၶရိတ်ႉ` ("Christ year") is in this corpus's own prose
 *     ×several ("ၼႂ်းပီၶရိတ်ႉ 1054", "ပီၶရိတ်ႉ 1953 တေႃႇ 1956"); the negative compound is not, and three
 *     instances do not license inventing one. The asymmetry is the evidence's, not a shortcut.
 */
import { foldNativeDigits } from "../../core/unicode.ts";

/** ⚠ EVERY BOUNDARY HERE IS AN EXPLICIT LOOKAROUND, NEVER `\b` — `\b` is ASCII-defined and sees no
 *  Myanmar-block letter as a word character at all (trap 1). */
const NOT_LETTER = "(?![\\p{L}\\p{M}])";

/** Normalize one Shan input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeShan(input: string): string {
    // 0) NATIVE DIGITS FIRST, and ⚠ THIS LAYER FOLDS THEM ITSELF rather than relying on the engine's own
    //    fold. `shan.ts` folds at the top of `text()` — i.e. AFTER this pass — so a rule written here
    //    against ASCII digits would miss `၉၂၄,၆၀၈ ၵေႃႉ` and `၇၀၅၄.၃၇` entirely. 195 native digits in the
    //    retained text. The engine folds again over a string that no longer has any, which costs nothing.
    let s = foldNativeDigits(input);

    // 1) DE-GROUPING. Shan groups with a COMMA (`2,759 ထတ်း`, `၉၂၄,၆၀၈ ၵေႃႉ`, `18,000 တေႃႇလႃႇ`), and the
    //    tokenizer read it as a clause pause — *သွင် , ၸဵတ်းပၢၵ်ႇႁႃႈသိပ်းၵဝ်ႈ*, a phrase break inside a
    //    quantity. TWO passes, because adjacent groups share the digit the first consumes.
    //    ⚠ THE WHOLE NUMBER IS MATCHED AT ONCE, NOT ONE JOIN PER PASS — playbook trap 63. The repeated
    //    two-digit join this sweep used at first is correct to THREE groups and silently wrong at four:
    //    the global scan resumes INSIDE the remainder and anchors on the last digit of the next group,
    //    so `80 239 800 000` became `80239 800000` — a well-formed numeral for a different quantity, and
    //    invisible to DIGIT, RAWMARK, DROP and the referee alike. ⚠ THE TRAILING GUARD REJECTS A DIGIT
    //    AND NOTHING ELSE: `(?![.,]\d)` looks right and costs `3 779,8` — a space-grouped integer with a
    //    decimal tail, which this corpus writes — while a bare `(?![\d.,])` declines every clause-final
    //    figure (trap 58). The separator here is a SPACE, and a decimal never has one before its
    //    fraction, so `(?!\d)` is the whole guard.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:,\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));
    //    …and the no-break space, which this corpus also uses between a figure and its magnitude.
    s = s.replace(/[    ]/gu, " ");

    // 2) THE ERA MARKER, written in LATIN letters inside Shan text — `A.D 649-729`, `(1434 A.D.)`,
    //    `A.D 739`, `ထိုင်မႃး A.D 748`. It was reaching `core/foreign.ts` and reading as the English
    //    letter names. `ပီၶရိတ်ႉ` is this corpus's own word for the era ("ၼႂ်းပီၶရိတ်ႉ 1054",
    //    "ပီၶရိတ်ႉ 1953 တေႃႇ 1956", "ပီၵေႃးၸႃႇ 1320 ပီၶရိတ်ႉ 1950").
    //    ⚠ `B.C` IS NOT CLAIMED — see the header. Three instances do not license inventing a compound.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])A\\.?\\s?D\\.?${NOT_LETTER}`, "gu"), "ပီၶရိတ်ႉ");

    // 3) THE CLOCK. The colon is clause punctuation in shan.ts, so `5:23` read as *ႁႃႈ , သၢဝ်းသၢမ်* — a
    //    phrase break inside a time, and `09:00 – 10:00 မူင်း` took two of them. The corpus writes the
    //    hour word after the figure — `10:00 မူင်း`, `(5:23)မွင်း`, `ဝၢႆးဝၼ်း (1) မွင်း`, `1 မူင်းၶိုင်ႈ`,
    //    `ယၢမ်းမူင်း` — so the reading is *H မူင်း MM မိၼိတ်ႉ*, with the minute dropped when it is zero.
    //    ⚠ THE FIGURES ARE LEFT AS FIGURES. The engine's number path already composes them correctly and
    //    this file has no business duplicating `numberToShanWords` (trap 6: whichever side of the seam a
    //    word is on, it must still pass through the g2p — and a digit run already does).
    //    ⚠ AND THE WORD MUST NOT BE DOUBLED WHERE THE CORPUS ALREADY WROTE IT. `09:00 – 10:00 မူင်း` puts
    //    one မူင်း after the whole span, so an unguarded rule emitted it twice on the second endpoint —
    //    the same shape Turkmen's `+11° gradus` produced. Both spellings are guarded, because this corpus
    //    writes မူင်း and မွင်း in roughly equal measure.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d)(?![\d:.,])(?!\s*[မ][ူွ]င်း)/gu, (_m, h: string, mi: string) =>
        Number(mi) === 0 ? `${h} မူင်း` : `${h} မူင်း ${mi} မိၼိတ်ႉ`);
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d)(?![\d:.,])(?=\s*[မ][ူွ]င်း)/gu, (_m, h: string, mi: string) =>
        Number(mi) === 0 ? `${h} ` : `${h} မူင်း ${mi} မိၼိတ်ႉ `);

    // 4) DEGREES, and here the class is BOTH angular and thermal — `၁၈° ၀'`, `၉၄° ၄၀'`, `22°N`,
    //    `33-38°N`, `106°-109° E` alongside `70°C (158°F)`. The COORDINATE pair is claimed first so the
    //    prime is not stranded once the degree rule has spent the sign.
    //    ⚠ THE SCALE NAME IS NOT EMITTED, deliberately: no Shan word for Celsius is attested (see the
    //    header), and `70 ၻီႇၵရီႇ` loses the scale while `70 ၻီႇၵရီႇ` plus an invented compound would
    //    lose the reader's trust. The ⟨C⟩ and ⟨F⟩ are consumed rather than left to be read as English
    //    letter names, which is what they were doing.
    s = s.replace(/(\d)\s?°\s?(\d+)\s?['′]/gu, "$1 ၻီႇၵရီႇ $2 မိၼိတ်ႉ ");
    s = s.replace(/(\d)\s?°\s?[CF](?![\p{L}\p{M}])/gui, "$1 ၻီႇၵရီႇ ");
    s = s.replace(/(\d)\s?°/gu, "$1 ၻီႇၵရီႇ ");

    // 5) THE COUNTRY-PREFIXED CURRENCY SIGN — `US$70`, `US$50`, `US$30 ပီႇလီႇယႅၼ်ႇ`, `AU$10.6million`.
    //    The shared tier matches `$` but not `US$`, so the prefix was left to the foreign reader and the
    //    sign dropped. Stripped here to the bare sign the tier does claim; the country is a Latin run and
    //    reads as English either way, which is what this corpus's own `(Amoy)`, `(Xiamen)` glosses do too.
    s = s.replace(/(?<![\p{L}\p{M}])(?:US|AU|CA|NZ|HK|SG)\s?(?=[$])/gu, "");

    // 5b) THE PLUS-MINUS SIGN gets a PAUSE, not a word. `4.5672 ± 0.0006 ၿီႇလီႇယၢၼ်ႇပီ` is the corpus's
    //     one instance and no Shan reading of ± is attested; dropping it outright ran the value and its
    //     tolerance together into one ten-digit string. A pause keeps them apart and invents nothing.
    s = s.replace(/\s?±\s?/gu, ", ");

    // 6) NUMERIC RANGES. The dash was dropped outright and the endpoints fused — `1122-249` read as one
    //    run of words, `400-500` as *သီႇပၢၵ်ႇႁႃႈပၢၵ်ႇ*. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A
    //    CONNECTIVE, the same measured refusal ba, kk, tt, chv and tk make.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — `ဢမ်ႇယွမ်းမွၵ်ႈ 400-500 ။` is how
    //    this corpus ends a sentence.
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,])(\d+)\s?-\s?(?=\d)/gu, "$1, ");
    //    THE SLASH GETS THE SAME TREATMENT. This corpus's slashes are D/M/Y dates (`10/1/1990`,
    //    `9-18/5/1962`) and a paired measurement (`2299/925 လၵ်း`), never a fraction — so a pause keeps
    //    the fields apart and invents nothing, and no fraction rule is written at all.
    s = s.replace(/(?<![\d.,])(\d+)\s?\/\s?(?=\d)/gu, "$1, ");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
