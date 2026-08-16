/**
 * Chuvash (chv) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/chv.jsonc` — cv.wikipedia dump, 232,373 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `digit-run` 116,955 · `year` 97,463 · `abbrev` 52,203 ·
 * `initialism` 39,847 · `dotted` 28,642 · `ranges` 25,545 · `decimals` 10,743 · `roman` 7,191 ·
 * `clock` 5,453 · `exponent` 5,122 · `ordinal-latin` 3,799 · `signs` 3,342 · `grouped` 2,765 ·
 * `signed-number` 1,576 · `percent` 1,480 · `era-marker` 973 · `fractions` 759 · `rate` 412 ·
 * `degrees` 260 · `currency` 48 · `ordinal-range` 34 · `units` 17.
 *
 * ⚠ THE DEFINING DEFECT OF THIS LANGUAGE IS NOT IN THIS FILE, and it had to be fixed before any of the
 * rules below could be judged. cv.wikipedia writes its four special letters in the LATIN look-alike
 * codepoints — ⟨ă ĕ ç ü⟩ U+0103/0115/00E7/00FC — **4,936 times against 918** for the real Cyrillic
 * ⟨ӑ ӗ ҫ ӳ⟩, so the block-range tokenizer split 3,424 words and handed the strays to the English reader
 * (`çĕр` → *sˈɛp*, `пĕрремĕш` → five tokens). The rows now live in `core/unicode.ts`'s
 * `foldCyrillicConfusables`, which already ran for `chv` and simply had no entry for them; the measurement
 * that made a shared-table change safe is in `docs/investigations/chv_normalization_investigation.md`.
 *
 * ⚠ THE SECOND FINDING IS THAT THE RESEARCH WAS ALREADY DONE AND NOTHING CALLED IT. `numbers.ts` sources
 * and implements Chuvash's TWO NUMERAL SERIES — FULL/substantival (пӗрре, иккӗ, виҫҫӗ, пиллӗк) for
 * counting, SHORT/attributive (пӗр, ик, виҫ, пилӗк) before the thing counted — and its
 * `numberToWords(n, attr)` takes the flag. The engine passed `false` always, so `5 км` read *пиллӗк* and
 * `1 км` read *пӗрре* where Chuvash says *пилӗк километр* and *пӗр километр*. `spellAttributive` below is
 * the missing context, and it is the playbook's one allowed exception in its canonical shape: it runs
 * AFTER the symbol tier, so the unit is already a word by the time the numeral has to agree with it.
 *
 * ⚠ EVERY ONE OF THIS CORPUS'S 33 DEGREE SIGNS IS A TEMPERATURE — `−19 °C пуҫласа −4 °C таран`, `+26 °C`,
 * `-13°С`, `+18,7°С`, `-44 °C`, `-42 °С`, `+20°с`. Two rounds ago Tatar's ten were ALL angular and the
 * Celsius branch shipped as declared insurance; here the angular reading has no instance at all. Same
 * cell, same family, opposite answer — which is the argument for reading the instances rather than
 * porting the rule. ⚠ And the scale letter is written THREE ways, Latin ⟨C⟩, Cyrillic ⟨С⟩ and lowercase
 * Cyrillic ⟨с⟩, all of which render identically; a branch carrying only the Latin one leaves two thirds
 * of the class to `core/foreign.ts` and the English letter name.
 *
 * ⚠ THE ORDINAL HAS NO HARMONY, which is the Oghur/Kipchak split showing up exactly where trap 55 says to
 * look for it. Bashkir needs four allomorphs chosen by vowel harmony and rounding, Tatar two; Chuvash
 * suffixes an invariant **-мӗш** to the FULL numeral and that is the entire paradigm — пӗрре → пӗрремӗш,
 * виҫҫӗ → виҫҫӗмӗш, тӑваттӑ → тӑваттӑмӗш, ҫирӗм → ҫирӗммӗш. The corpus writes `5-мĕшĕ`, `22-мĕшĕнче`,
 * `1870-мĕш çулсем`, `3-мĕш космонавчĕ`.
 *
 * ⚠ AND THE ORDINAL RANGE PUTS THE SUFFIX ON THE SECOND ENDPOINT ONLY — `11-15-мĕшĕсенче`,
 * `1-5-мӗш класӗсенче`, `1 - 19-мĕшĕсенче`. Three hyphens, two of which are a range and one a suffix, and
 * the plain range rule cannot tell them apart. Claimed in step 5 before any range rule runs.
 *
 * ⚠ THE ERA MARKER'S EVIDENCE IS ASYMMETRIC, and step 1b is written to exactly that asymmetry. The
 * EXPANSION is well attested and glossed — `эраччен` ×29 ("Пирӗн эраччен VI ӗмӗрте", "пирӗн эраччен 530
 * ҫ.") and the century article's "пирĕн эрăччен I ĕмĕр хыççăн пирĕн эрăри I ĕмĕр пуçланать" — while the
 * ABBREVIATION is ONE clean instance (`п. эрч. 2040 тата 1783`) plus one the dump extraction mangled
 * (`530 п. эраччен. ҫ.`). So the pattern is written for the form that was actually seen and invents no
 * spacing variant (trap 9).
 *
 * SOURCING — every word emitted here is a cv.wikipedia TOKEN attestation whose examples were read; see
 * `tools/corpus/attest/chv.jsonc`.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords } from "./numbers.ts";

/** The cardinal as words, in the series the slot calls for. */
const cardinal = (n: number, attr = false): string => numberToWords(n, attr).join(" ");

/**
 * The Chuvash ORDINAL — the FULL numeral plus an invariant **-мӗш**. No vowel harmony, no rounding, no
 * consonant assimilation: one suffix, every stem. That is the whole paradigm, and it is worth stating
 * plainly next to the ba/tt files, where the same function needs four allomorphs and a lenition rule.
 *
 * ⚠ THE STEM IS THE FULL SERIES, NOT THE ATTRIBUTIVE ONE, and the corpus settles it in a sentence that
 * spells a fraction out: "вĕсенчен **виççĕ тăваттăмĕш пайĕ** (71,8%)" — *тӑваттӑмӗш*, built on тӑваттӑ,
 * not on тӑват. Using the short series would give *тӑватмӗш*, which no source writes.
 */
export function ordinalOf(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 0) return undefined;
    const words = cardinal(n).split(" ");
    const last = words[words.length - 1];
    if (last === undefined || last === "") return undefined;
    words[words.length - 1] = `${last}мӗш`;
    return words.join(" ");
}

// ---------------------------------------------------------------------------------------------------
// INITIALISMS
// ---------------------------------------------------------------------------------------------------

/**
 * Chuvash letter NAMES. The alphabet is Russian Cyrillic plus ⟨ӑ ӗ ҫ ӳ⟩; the shared letters keep their
 * Russian names, which is how the alphabet is recited, and the four Chuvash-only letters are named by
 * their own sound. The corpus's caps runs are ЧР ×7 (the Chuvash Republic), ЧНИИ, АССР, РСФСР, СССР,
 * АПШ (the USA), ЧАССР, УТ — every one of which reached the g2p as a raw consonant cluster (`ЧР` → [t͡ɕr]).
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    а: "а", ӑ: "ӑ", б: "бэ", в: "вэ", г: "гэ", д: "дэ", е: "е", ё: "ё", ж: "жэ", з: "зэ",
    и: "и", й: "кӗске и", к: "ка", л: "эль", м: "эм", н: "эн", о: "о", п: "пэ", р: "эр",
    с: "эс", ҫ: "ҫе", т: "тэ", у: "у", ӳ: "ӳ", ф: "эф", х: "ха", ц: "цэ", ч: "че", ш: "ша",
    щ: "ща", ы: "ы", э: "э", ӗ: "ӗ", ю: "ю", я: "я",
};

/** Chuvash phonotactics, for the OOV rule in core/initialisms.ts. */
export const isUnreadableChuvash = makeUnreadableTest({
    vowels: /[аӑеёиоуӳыэӗюя]/u,
    legalOnsets: new Set([
        "бл", "бр", "гр", "гл", "др", "кр", "кл", "пл", "пр", "ст", "сп", "ск", "тр", "шк", "шт",
    ]),
    legalCodas: new Set([
        "кт", "нт", "нк", "рт", "рд", "рс", "лт", "лк", "ст", "шт", "рш", "мп", "нч", "рч", "рм",
    ]),
});

export function normalizeChuvashInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        // Spelled out despite being pronounceable — the corpus's own runs.
        acronymLetters: new Set(["чр", "чнии", "асср", "рсфср", "ссср", "апш", "часср", "ссп", "ут"]),
        isRecorded: () => false,
        isUnreadable: isUnreadableChuvash,
    })(text);
}

// ---------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------

/** ⚠ EVERY BOUNDARY IN THIS FILE IS AN EXPLICIT LOOKAROUND, NEVER `\b` — `\b` is ASCII-defined and finds
 *  none against Cyrillic, which is how `core/initialisms.ts` was a total no-op for Russian (trap 1). */
const NOT_LETTER = "(?![\\p{L}\\p{M}])";
/** The Chuvash-Cyrillic letters a written suffix can be spelt with. */
const SFX = "[а-яёӑӗҫӳ]";
/** A Chuvash word, for the attributive pass and the fraction's `пай` guard. */
const WORD = "[а-яёӑӗҫӳА-ЯЁӐӖҪӲ]";

/**
 * Attach a written suffix to an ordinal figure. The suffix the writer typed is the TAIL of a longer word
 * — `22-мĕшĕнче` is *ҫирӗм иккӗмӗшӗнче*, the ordinal plus a possessive plus a locative — so the rule
 * derives the ordinal and splices on the OVERLAP with what was typed, appending only the remainder.
 */
function attachOrdinal(whole: string, digits: string, rawSuffix: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return whole;
    const ord = ordinalOf(n);
    if (ord === undefined) return whole;
    const suffix = rawSuffix.toLowerCase();
    for (let k = Math.min(ord.length, suffix.length); k >= 2; k--)
        if (ord.endsWith(suffix.slice(0, k))) return ord + suffix.slice(k);
    return whole;
}

/** Normalize one Chuvash input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeChuvash(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST — a grouping space is otherwise read as a separate number and every
    //    later rule needs the figure whole. This corpus groups with a space: `1 032 343 çын`,
    //    `14 953 пин çын`, `388 678 çын`, `8 413 km²`, `12 235 km²`, `$10 000`. THREE passes, because
    //    adjacent groups share the digit the previous one consumes and `1 032 343` has two.
    //    ⚠ THE WHOLE NUMBER IS MATCHED AT ONCE, NOT ONE JOIN PER PASS — playbook trap 63. The repeated
    //    two-digit join this sweep used at first is correct to THREE groups and silently wrong at four:
    //    the global scan resumes INSIDE the remainder and anchors on the last digit of the next group,
    //    so `80 239 800 000` became `80239 800000` — a well-formed numeral for a different quantity, and
    //    invisible to DIGIT, RAWMARK, DROP and the referee alike. ⚠ THE TRAILING GUARD REJECTS A DIGIT
    //    AND NOTHING ELSE: `(?![.,]\d)` looks right and costs `3 779,8` — a space-grouped integer with a
    //    decimal tail, which this corpus writes — while a bare `(?![\d.,])` declines every clause-final
    //    figure (trap 58). The separator here is a SPACE, and a decimal never has one before its
    //    fraction, so `(?!\d)` is the whole guard.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:[    ]\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/[    ]/gu, ""));
    //    ⚠ AND THE SPACE GROUPS THE FRACTION TOO, SI-style — `1 мм²=0,000 001 м²`, the square-millimetre
    //    article. That is 0.000001, and the integer-side rule cannot reach it: its leading guard rejects a
    //    group sitting behind a decimal separator, correctly, because that is how `1.234 567` is kept from
    //    being read as grouping. The fractional side needs its own pass, anchored on the separator.
    s = s.replace(/([.,]\d{3})((?:[    ]\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/[    ]/gu, ""));
    s = s.replace(/[   ]/gu, " ");

    // 1) THE MAGNITUDE ABBREVIATIONS, before any single-dot rule — `1,3 млн. çын`, `143,8 млн. çын`,
    //    `$4,2 млрд`, `$1,915 трлн`. The dot is optional because the corpus writes both.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])млрд\\.?${NOT_LETTER}`, "giu"), "миллиард");
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])трлн\\.?${NOT_LETTER}`, "giu"), "триллион");
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])млн\\.?${NOT_LETTER}`, "giu"), "миллион");

    // 1b) THE ERA MARKER AND THE YEAR ABBREVIATION, which the corpus supplies together:
    //     "Вӑтам патшалӑх — Авалхи Египет кун-ҫулӗнчи **п. эрч.** 2040 тата 1783 …" gives the
    //     abbreviation, and the century article gives its expansion in full — "**пирĕн эрăччен** I ĕмĕр
    //     хыççăн **пирĕн эрăри** I ĕмĕр пуçланать" — with `эраччен` ×29 elsewhere ("**Пирӗн эраччен** VI
    //     ӗмӗрте", "**пирӗн эраччен** 530 ҫ."). ⚠ THE EVIDENCE IS ASYMMETRIC AND THAT IS SAID HERE: the
    //     EXPANSION is well attested and the ABBREVIATION is one clean instance plus one the dump
    //     extraction mangled (`530 п. эраччен. ҫ.`), so the pattern is written for exactly the form that
    //     was seen and no spacing variant is invented (trap 9).
    //     `ҫ.` / `ҫҫ.` after a figure are ҫул / ҫулсем — "пирӗн эраччен 530 ҫ.", "Афинара 550—530 ҫҫ.".
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])п\\.\\s?эрч\\.`, "giu"), "пирӗн эраччен");
    s = s.replace(new RegExp(`(\\d)\\s?ҫҫ\\.`, "gu"), "$1 ҫулсем");
    s = s.replace(new RegExp(`(\\d)\\s?ҫ\\.`, "gu"), "$1 ҫул");

    // 2) НОМЕР. The sign was dropped outright (`№ 4. – С. 61-63`).
    s = s.replace(/№\s?(?=\d)/gu, "номер ");

    // 3) CLOCK. The colon is clause punctuation in chuvash.ts, so `10:25:34` read as *вуннӑ , ҫирӗм пиллӗк
    //    , вӑтӑр тӑваттӑ* — two phrase breaks inside a timestamp. ⚠ EVERY ONE OF THIS CORPUS'S CLOCKS HAS
    //    THREE FIELDS (`23:59:60 UTC`, `10:25:34 вăхăтра`, `1:59:26 вахăтра`) — they are spaceflight and
    //    Pi-day timestamps, not times of day — so the three-field form is the one with evidence and the
    //    two-field form follows it for the ordinary case.
    //    ⚠ AND THE SECONDS FIELD REACHES 60, because one of the three is the LEAP SECOND itself:
    //    "1972, 23:59:60 UTC — пĕрремĕш хут тĕкел çул çеккунтине кĕртнĕ". A `[0-5]\d` seconds field is
    //    right for every clock in the world except the one this corpus was written to describe.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d):([0-5]\d|60)(?![\d:.,])/gu,
        (_m, h: string, mi: string, sec: string) =>
            `${cardinal(Number(h))} ${cardinal(Number(mi))} ${cardinal(Number(sec))}`);
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-4]):\s?([0-5]\d)(?![\d:.,])/gu, (_m, h: string, mi: string) => {
        const mv = Number(mi);
        return mv === 0 ? cardinal(Number(h)) : `${cardinal(Number(h))} ${cardinal(mv)}`;
    });

    // 4) THE FRACTION, and ⚠ IT IS CLAIMED ONLY WHERE `пай` FOLLOWS. The corpus spells its own reading
    //    out — "вĕсенчен **виççĕ тăваттăмĕш пайĕ** (71,8%)" — numerator in the FULL series, denominator as
    //    an ordinal, and the noun written. Its slashes are `4/5 пайĕ`, `1/3 пайĕ`, `1/2 пайĕн` … and then
    //    `3/14` (a Pi-day date), `1608/09 çулхи` (a year span), `1/15 çурт` and `57/1 ҫурт` (street
    //    addresses) and `№ 5 / 2002` (a citation). Requiring numerator < denominator ≤ 12 AND the noun
    //    takes all three real ones and refuses all six others — and the `пай` requirement is not a guess,
    //    it is the shape every attested instance has. A bare `4/5` is left alone for want of evidence.
    s = s.replace(new RegExp(`(?<![\\d.,/])(\\d{1,2})\\s?/\\s?(\\d{1,2})(?=\\s(?:пай|пая|пайĕ|пайӗ)${WORD}*)`, "gu"),
        (whole, num: string, den: string) => {
            const nv = Number(num), dv = Number(den);
            if (!(nv >= 1 && nv < dv && dv <= 12)) return whole;
            const ord = ordinalOf(dv);
            return ord === undefined ? whole : `${cardinal(nv)} ${ord}`;
        });

    // 5) THE ORDINAL RANGE, BEFORE the plain ordinal and BEFORE the range rule — `11-15-мĕшĕсенче`,
    //    `1-5-мӗш класӗсенче`, `1 - 19-мĕшĕсенче`. Three hyphens in one token, two of which open a range
    //    and one of which introduces the suffix; nothing downstream can tell them apart once either rule
    //    has spent a hyphen. The suffix is written ONCE, on the second endpoint, and belongs to both.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\s?-\\s?(\\d+)\\s?-\\s?(м[ĕӗ]ш${SFX}{0,8})${NOT_LETTER}`, "gu"),
        (whole, a: string, b: string, sfx: string) => {
            const first = attachOrdinal(whole, a, sfx);
            const second = attachOrdinal(whole, b, sfx);
            if (first === whole || second === whole) return whole;
            return `${first}, ${second}`;
        });

    // 6) NUMERAL + THE ORDINAL SUFFIX — `5-мĕшĕ`, `22-мĕшĕнче`, `1870-мĕш çулсем`, `3-мĕш космонавчĕ`,
    //    `25-мĕшĕнче`. ⚠ THE SUFFIX IS ONLY EVER `-мӗш` HERE, which is why the alternation is anchored on
    //    it rather than opened to any letter run: this corpus writes no case suffix directly on a figure
    //    (the writer types the ordinal and declines that), so an open alternation would have nothing to
    //    gain and every space-separated noun to lose.
    //    MUST run before the range rule (step 9), which would otherwise eat the hyphen.
    s = s.replace(new RegExp(`(?<![\\d.,/])(\\d+)\\s?-\\s?(м[ĕӗ]ш${SFX}{0,6})${NOT_LETTER}`, "gu"),
        (whole, digits: string, sfx: string) => attachOrdinal(whole, digits, sfx.replace(/ĕ/gu, "ӗ")));

    // 7) SIGNS. This corpus's climate prose writes the true MINUS (U+2212) as well as the hyphen, on both
    //    sides of the scale: `−19 °C`, `-13°С`, `+19 °C`, `+ 37°С` (spaced), `+20°с`.
    s = s.replace(/(^|(?<!\d)[\s(])[-−–](\d)/gu, "$1минус $2");
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it.
    s = s.replace(/±/gu, " плюс минус ");
    s = s.replace(/(^|[\s(])\+\s?(\d)/gu, "$1плюс $2");

    // 8) DEGREES — and here they are TEMPERATURES, all 33 of them. ⚠ THE SCALE LETTER IS WRITTEN THREE
    //    WAYS: Latin ⟨C⟩ (`−19 °C`), Cyrillic ⟨С⟩ (`-42 °С`) and lowercase Cyrillic ⟨с⟩ (`+20°с`). They
    //    render identically and only the codepoint tells them apart, so the class must carry all three or
    //    the Latin one falls to core/foreign.ts and is read as the ENGLISH letter name.
    //    ⚠ THE SCALE NAME FOLLOWS THE NOUN — *Цельси градусӗ*, the possessive compound, which is the same
    //    order Bashkir's corpus glosses and the opposite of the Russian *градус Цельсия*.
    s = s.replace(/(\d)\s?°\s?[CСс](?![\p{L}\p{M}])/gu, "$1 Цельси градусӗ");
    s = s.replace(/(\d)\s?°\s?[FФф](?![\p{L}\p{M}])/gu, "$1 Фаренгейт градусӗ");
    //    WITH A TRAILING SPACE, because the sign is written glued to letters this rule does not claim;
    //    the final space-collapse removes the doubling in the ordinary case.
    s = s.replace(/(\d)\s?°/gu, "$1 градус ");

    // 9) NUMERIC RANGES. The dash was dropped outright and the endpoints fused into one run of words —
    //    `1608—1609` read as one twelve-word number, `530-570 мм` as *пилӗҫ ҫӗр вӑтӑр…*. ⚠ THE DASH IS
    //    SPENT ON A PAUSE RATHER THAN A CONNECTIVE, the same measured refusal ba, kk and tt make: Chuvash
    //    marks a span with case endings on BOTH operands (*пиллӗк ҫӗр вӑтӑрран …ччен*), which needs an
    //    ablative and a terminative this layer would have to derive unaided.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — `– С. 61-63.` is how this corpus
    //    ends a citation. Runs AFTER the ordinal and sign rules, which have already spent every hyphen
    //    that belongs to a suffix or opens a negative.
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,])(\d+)\s?-\s?(?=\d)/gu, "$1, ");

    // A padded replacement (` плюс минус `) doubles a space that was already there. Harmless downstream
    // because assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be
    // the one producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}

/**
 * THE ATTRIBUTIVE NUMERAL — the pass that runs AFTER the symbol tier, and the reason it has to.
 *
 * Chuvash has two numeral series and `numbers.ts` has had both since it was written: FULL/substantival for
 * counting, SHORT/attributive before the thing counted. `numberToWords(n, attr)` takes the flag and the
 * engine passed `false` always, so `5 км` read *пиллӗк* and `1 км` read *пӗрре* where the language says
 * *пилӗк километр* and *пӗр километр*. The information the flag needs — is a noun coming? — does not exist
 * until the symbol tier has turned `км` into `километр`, which is why this is a separate pass composed
 * outside `normalizeChuvash` rather than another step inside it.
 *
 * ⚠ A DIGIT RUN STANDING ALONE KEEPS THE FULL SERIES, which is the whole point of there being two: a
 * numeral read out of context is the counting form. So the rule fires only on a figure IMMEDIATELY
 * followed by a Chuvash word, and a figure at a clause end, before punctuation, or before another figure
 * is left to the engine's substantival path untouched.
 *
 * ⚠ AND IT SPELLS RATHER THAN FLAGS, because the engine's number branch has no way to see what follows.
 * The words it emits are Chuvash orthography and go through the same `TOKEN` → g2p path as any other word
 * (the playbook's standing requirement); no IPA is written here.
 *
 * The honest cost: "immediately followed by a word" is a proxy for "modifies a noun". A numeral followed
 * by a verb or an adverb takes the short form under this rule and should not. That shape is rare in
 * running prose — the corpus's figures are followed by `çын`, `çул`, `км`, `мм`, `пин`, `процент`,
 * `ĕмĕр` — and the alternative is being wrong on every counted noun in the language.
 */
export function spellAttributive(input: string): string {
    return input.replace(new RegExp(`(?<![\\d.,:/-])(\\d+)(\\s)(?=${WORD})`, "gu"), (whole, digits: string, gap: string) => {
        const n = Number(digits);
        if (!Number.isSafeInteger(n)) return whole;
        return `${cardinal(n, true)}${gap}`;
    });
}
