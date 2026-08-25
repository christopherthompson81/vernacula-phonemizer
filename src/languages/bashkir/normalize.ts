/**
 * Bashkir (ba) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/ba.jsonc` — ba.wikipedia dump, 618,078 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `year` 295,226 · `abbrev` 186,349 · `initialism` 143,342 · `ranges`
 * 69,035 · `dotted` 68,386 · `roman` 29,234 · `decimals` 24,214 · `signs` 13,034 · `ordinal-latin` 8,482 ·
 * `grouped` 6,392 · `percent` 5,897 · `exponent` 5,285 · `signed-number` 4,629 · `fractions` 4,120 ·
 * `era-marker` 3,605 · `degrees` 1,455 · `currency` 287.
 *
 * ⚠ THE DEFINING RULE OF THIS LANGUAGE IS THE SUFFIX ON THE FIGURE, exactly as the playbook's trap 14
 * predicts for a Turkic corpus, and it is what the whole of step 5 exists for:
 *
 *     1-се      → *бер се*        the ordinal suffix read as a separate word
 *     8:30-ҙа   → *һигеҙ , утыҙ ҙа*   …and the colon a clause pause on top of it
 *     100-ҙән   → *йөҙ ҙән*
 *     °C-тан    → the sign dropped and the suffix stranded
 *
 * ⚠ AND THE SUFFIX GOES ON THE UNIT AS OFTEN AS ON THE NUMERAL, which is not in trap 14's statement of the
 * shape: this corpus writes `+0,3 °C-тан (тауҙарҙа) +2,8 °C-ҡа тиклем` and `5°-ҡа тиклем` — a span whose
 * case marking sits on the DEGREE SIGN. Step 6 claims it there.
 *
 * ⚠ THE WRITER HAS ALREADY CHOSEN THE ALLOMORPH, so the rule only has to attach it (the Basque finding,
 * c1571ec). Bashkir case suffixes assimilate to the stem's final consonant and harmonise with its last
 * vowel — `йөҙ` takes `-ҙән`, `мең` takes `-гә`, `градус` takes `-тан` / `-ҡа` — and every one of those is
 * what the corpus actually typed. So the layer spells the numeral and GLUES the written suffix to the last
 * word rather than deriving a case ending it would have to get right unaided.
 *
 * ⚠ FOUR CLASSES ARE NOT WHAT THEY PATTERN-MATCH AS, each found by printing context (trap 2):
 *   · **The 98 "dot decimals" are almost all PERCENT-ENCODING**, not numbers: `[[#cite_note-.D0.9A.D0.9F…`
 *     is a URL-escaped wiki anchor, and `.D0.9A` alone supplies the `0.9` that tops the frequency table.
 *     The rest are a lens aperture (`f/0.7`), a page range (`6.5-66`) and a Russian date (`1.1У.44г.`).
 *     **Zero are decimals**, so — unlike Belarusian, whose 82 were mostly genuine — NO dot-decimal fold is
 *     written here. The comma decimal (×169) is the real one and the tokenizer is taught to span it.
 *   · **`г.` WITH A DOT is Russian год**, inside Russian-language passages (`с 1938 г.`, `в 1941 г.`,
 *     `М., 1988 г.`) — Bashkir writes `й.` for its own year. **`г` WITHOUT a dot is the gram** (`3,300 г`,
 *     `2,176 г`). The dot is the discriminator, which is why the gram is claimed locally in step 7 with an
 *     explicit `(?!\.)` rather than declared to the shared tier, whose trailing guard would eat both.
 *   · **`с.` is Russian *страниц*** in a bibliography (`80 с.`, `707 с.`, `65 с.`); the only Bashkir second
 *     is inside the rate `м³/с`. Declared as a rate denominator only, never as a unit.
 *   · **`=` is markup**: `a*a^{-1}=a^{-1}*a=e`, `\aleph_0=\hbar`, and a typo (`1996=2006`). One of the 17
 *     is a real equation (`рН = 6,4÷6,7`), so the rule is digit-gated. ⚠ And the `÷` in that same instance
 *     is a RANGE in the Russian convention ("pH from 6.4 to 6.7"), not a division — which is the whole of
 *     this corpus's `÷` evidence, so no division rule is written at all.
 *
 * SOURCING — every word below is a ba.wikipedia TOKEN attestation whose examples were read:
 *   `процент` ×206 ("процент ставкаларын", and its own article: "йөҙөнсө өлөштә процент ставкаларын")
 *   `градус` ×71 ("95 градус көнсығыш оҙонлоҡ" — with a figure, the exact slot)
 *   `Цельсий` ×36 ("әлеге ваҡытта ҡулланылған Цельсий градусы, Фаренгейт градусы" — ⚠ note the ORDER:
 *     Bashkir compounds it as *Цельсий градусы*, scale first, not *градус Цельсия*)
 *   `тигеҙ` ×350 — the equals reading, with a formula beside it: "квадрат яғының яртыһына тигеҙ: r = t/2"
 *   `тапҡыр` ×103 ("11 тапҡыр — Советтар Союзы Маршалы") — the multiplication word
 *   `минус` ×41 — «минус өс» тип атала, the sign spelled before a numeral
 *   `квадрат` ×165 (and the corpus's own "майҙаны 130 395 квадрат километр") · `куб` ×35
 *   `номер` ×31 · `доллар` ×221 · `евро` ×87 · `һум` ×142 ("Һум — Рәсәй Федерацияһының милли аҡсаһы")
 *   `беренсе` ×50 · `унынсы` ×29 · `егерменсе` ×21 · `меңенсе` ×26
 * ⚠ `плюс` ×48 is a FALSE attestation — every hit is the radio station «Европа Плюс». It ships anyway, as
 * the twin of the `минус` attestation and because this corpus writes `+18 °C` and `+0,3 °C` in its own
 * climate prose; the gap is recorded rather than papered over.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
import { numberToWords } from "./numbers.ts";

// ---------------------------------------------------------------------------------------------------
// ORDINALS — derived, not tabulated
// ---------------------------------------------------------------------------------------------------

/** The cardinal as words — the same composer the engine's number path uses. */
const cardinal = (n: number): string => numberToWords(n).join(" ");

/**
 * The Bashkir ORDINAL suffix, chosen by the last vowel of the cardinal's final word and by whether that
 * word ends in a vowel. Derived rather than tabulated, because the paradigm is regular and a table is
 * correct only where you looked (trap 8):
 *
 *     last vowel ө / о      → -өнсө / -онсо      (өс → өсөнсө, йөҙ → йөҙөнсө)
 *     last vowel а / ы / у  → -ынсы              (алтмыш → алтмышынсы, ун → унынсы, туҡһан → туҡһанынсы)
 *     last vowel ә / э / е / и / ү → -енсе       (бер → беренсе, биш → бишенсе, дүрт → дүртенсе)
 *     …and a VOWEL-final stem drops the linking vowel: ике → икенсе, алты → алтынсы, илле → илленсе.
 *
 * ⚠ LABIAL HARMONY IS NARROWER THAN THE VOWEL INVENTORY SUGGESTS, and getting that wrong is the one way
 * this rule can misfire: ⟨у⟩ and ⟨ү⟩ are rounded but do NOT round the suffix — `ун` is *унынсы*, not
 * *унонсо*, and `дүрт` is *дүртенсе*, not *дүртөнсө*. Only ⟨ө⟩ and ⟨о⟩ do. Every branch is exercised by an
 * attested form: -енсе (беренсе ×50, егерменсе ×21, меңенсе ×26, and дүртенсе in this corpus), -ынсы
 * (унынсы ×29), -өнсө (өсөнсө in this corpus). The -онсо branch has no cardinal that reaches it and is
 * written for completeness only.
 */
const ROUNDING = "өо";
const BACK = "аыу";
export function ordinalOf(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 0) return undefined;
    const words = cardinal(n).split(" ");
    const last = words[words.length - 1];
    if (last === undefined || last === "") return undefined;
    const vowels = [...last].filter((c) => "аәоөуүыиэе".includes(c));
    const v = vowels[vowels.length - 1];
    if (v === undefined) return undefined;
    const endsVowel = "аәоөуүыиэе".includes(last.at(-1)!);
    const suffix = ROUNDING.includes(v)
        ? (v === "ө" ? (endsVowel ? "нсө" : "өнсө") : endsVowel ? "нсо" : "онсо")
        : BACK.includes(v)
          ? (endsVowel ? "нсы" : "ынсы")
          : endsVowel ? "нсе" : "енсе";
    words[words.length - 1] = last + suffix;
    return words.join(" ");
}

// ---------------------------------------------------------------------------------------------------
// INITIALISMS
// ---------------------------------------------------------------------------------------------------

/**
 * Bashkir letter NAMES. The alphabet is Russian Cyrillic plus ⟨ә ө ү ҙ ҫ ң ғ ҡ һ⟩; the shared letters keep
 * their Russian names, which is how they are recited in Bashkir schools, and the nine Bashkir-only letters
 * take their own. The corpus's caps runs are АНК ×7, ЭТП ×6, СССР ×4, ТЭЦ ×4, АҠШ ×4 (the USA), РАН, НГДУ,
 * АССР, ГРЭС — every one of which reached the g2p as a raw consonant cluster (`СССР` → [sssɾ]).
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    а: "а", б: "бэ", в: "вэ", г: "гэ", ғ: "ғы", д: "дэ", ҙ: "ҙы", е: "е", ё: "ё", ж: "жэ", з: "зэ",
    и: "и", й: "ҡыҫҡа и", к: "ка", ҡ: "ҡы", л: "эль", м: "эм", н: "эн", ң: "ңы", о: "о", ө: "ө",
    п: "пэ", р: "эр", с: "эс", ҫ: "ҫы", т: "тэ", у: "у", ү: "ү", ф: "эф", х: "ха", һ: "һы",
    ц: "цэ", ч: "че", ш: "ша", щ: "ща", ы: "ы", э: "э", ә: "ә", ю: "ю", я: "я",
};

/** ⚠ EVERY BOUNDARY IN THIS FILE IS AN EXPLICIT LOOKAROUND, NEVER `\b` — `\b` is ASCII-defined and finds
 *  none against Cyrillic, which is how `core/initialisms.ts` was a total no-op for Russian (playbook
 *  trap 1). */

/** Bashkir phonotactics, for the OOV rule in core/initialisms.ts. */
export const isUnreadableBashkir = makeUnreadableTest({
    vowels: /[аәеёиоөуүыэюя]/u,
    legalOnsets: new Set([
        "бл", "бр", "гр", "гл", "др", "ҡр", "кр", "кл", "пл", "пр", "ст", "сп", "ск", "тр", "шк", "шт",
    ]),
    legalCodas: new Set([
        "ҡт", "кт", "нд", "нт", "ңҡ", "рт", "рҙ", "рҫ", "лт", "лд", "ст", "шт", "рш", "рҡ", "лҡ", "мб",
        "нс", "рс", "йҙ", "ҫт",
    ]),
});

export function normalizeBashkirInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        // Spelled out despite being pronounceable — the corpus's own runs.
        acronymLetters: new Set(["аҡш", "ссср", "асср", "ран", "анк", "этп", "тэц", "тэс", "грэс", "нгду", "аск", "ссо"]),
        isRecorded: () => false,
        isUnreadable: isUnreadableBashkir,
    })(text);
}

// ---------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------

/** The Bashkir-Cyrillic letters a written suffix can be spelt with. */
const SFX = "[а-яёәөүҙҫңғҡһ]";

/** Normalize one Bashkir input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeBashkir(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST — a grouping space is otherwise read as a separate number and every later
    //    rule needs the figure whole. `3 000 000` read as *өс нуль нуль*, "three zero zero", and the
    //    corpus's own `2 626 613-ө` and `1 042,4 мең` both depend on this running first. Two passes,
    //    because adjacent groups share the digit the first consumes.
    //    ⚠ THE WHOLE NUMBER IS MATCHED AT ONCE, NOT ONE JOIN PER PASS — playbook trap 63. The repeated
    //    two-digit join this sweep used at first is correct to THREE groups and silently wrong at four:
    //    the global scan resumes INSIDE the remainder and anchors on the last digit of the next group,
    //    so `80 239 800 000` became `80239 800000` — a well-formed numeral for a different quantity, and
    //    invisible to DIGIT, RAWMARK, DROP and the referee alike. ⚠ THE TRAILING GUARD REJECTS A DIGIT
    //    AND NOTHING ELSE: `(?![.,]\d)` looks right and costs `3 779,8` — a space-grouped integer with a
    //    decimal tail, which this corpus writes — while a bare `(?![\d.,])` declines every clause-final
    //    figure (trap 58). The separator here is a SPACE, and a decimal never has one before its
    //    fraction, so `(?!\d)` is the whole guard.
    s = s.replace(/(?<!\d)(?<![\d][.,])(\d{1,3})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)/gu,  // space, NBSP, NNBSP, thin space
        (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space
    s = s.replace(/[ \u00a0\u202f\u2009]/gu, " ");  // space, NBSP, NNBSP, thin space

    // 1) MULTI-DOT ABBREVIATIONS, before any single-dot rule. `б. э. т.` = *беҙҙең эраға тиклем* (BC) and
    //    `б. э.` = *беҙҙең эра*, both corpus-attested in the expanded form ("беҙҙең эраға тиклем 145—90
    //    йылдарҙа"); `һ. б.` = *һәм башҡалар*, the Bashkir "etc.", ×18 in the retained text and also
    //    spelled out there. The FINAL dot is kept at a sentence end, or the pause is lost outright.
    const multi: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_LETTER_BEFORE}б\\.\\s?э\\.\\s?т\\.`, "giu"), "беҙҙең эраға тиклем"],
        [new RegExp(`${NOT_LETTER_BEFORE}б\\.\\s?э\\.`, "giu"), "беҙҙең эра"],
        [new RegExp(`${NOT_LETTER_BEFORE}һ\\.\\s?б\\.`, "giu"), "һәм башҡалар"],
    ];
    for (const [re, word] of multi)
        s = s.replace(re, (m0, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 2) НОМЕР. The sign was dropped outright.
    s = s.replace(/№\s?(?=\d)/gu, "номер ");

    // 3) THE YEAR ABBREVIATION `й.` — Bashkir's own, written after a figure (`1991 й.`); it was reaching
    //    the g2p as the bare glide [j]. ⚠ `г.` is NOT given a Bashkir reading: every one of its instances
    //    is inside a Russian-language passage, where it is Russian *года* (see the header).
    s = s.replace(new RegExp(`(\\d)\\s?й\\.${NOT_LETTER_AFTER}`, "gu"), "$1 йыл");

    // 4) CLOCK, and the case suffix that may sit on it. The colon is clause punctuation in bashkir.ts, so
    //    `10:30` read as *ун , утыҙ* — a phrase break inside a time. ⚠ THE SUFFIX ATTACHES TO THE SPOKEN
    //    MINUTE, which is why the clock must be worded here rather than left as digits: `8:30-ҙа` is
    //    *һигеҙ утыҙҙа*, and gluing the written suffix to a DIGIT can never produce that (trap 14).
    //    Runs BEFORE the ordinal rule so a time is not first claimed as a numeral-plus-suffix.
    s = s.replace(new RegExp(`(?<![\\d:.,])([01]?\\d|2[0-4]):([0-5]\\d)(?![\\d:.,])(?:\\s?-\\s?(${SFX}{1,4})${NOT_LETTER_AFTER})?`, "gu"),
        (whole, h: string, min: string, sfx: string | undefined) => {
            const hv = Number(h), mv = Number(min);
            if (hv > 24) return whole;
            const head = cardinal(hv);
            const tail = mv === 0 ? "" : ` ${cardinal(mv)}`;
            const body = `${head}${tail}`;
            return sfx === undefined ? body : `${body}${sfx}`;
        });

    // 5) NUMERAL + WRITTEN SUFFIX — the class this language is defined by. Two different morphemes share
    //    one notation and the written letters tell them apart:
    //      · the ORDINAL — `1-се`, `6-сы`, `23-сө`, `50-се йылдар`, `159-сы урын`, `1774-се йылдың`. The
    //        suffix is the TAIL of the full word (*беренсе*, *алтмышынсы*, *егерме өсөнсө*), so the rule
    //        derives the ordinal and keeps it only if it actually ENDS with what the writer typed.
    //      · a CASE or POSSESSIVE suffix — `100-ҙән`, `0-дән`, `1 923 233-н`, `2 626 613-ө`, `1 172 287-һе`.
    //        There the writer chose the allomorph from the SPOKEN numeral, so gluing it to the spelled
    //        cardinal is exactly right: йөҙ + ҙән → *йөҙҙән*.
    //    The ordinal is tried FIRST and the `endsWith` guard is what makes the fallback safe — a suffix no
    //    ordinal produces falls through to the cardinal rather than inventing morphology.
    //    MUST run before the range rule (step 9), which would otherwise eat the hyphen.
    s = s.replace(new RegExp(`(?<![\\d.,/])(\\d+)\\s?-\\s?(${SFX}{1,5})${NOT_LETTER_AFTER}`, "gu"),
        (whole, digits: string, rawSuffix: string) => {
            const n = Number(digits);
            if (!Number.isSafeInteger(n)) return whole;
            const suffix = rawSuffix.toLowerCase();
            // ⚠ `-е` AND `-й` ARE RUSSIAN, NOT BASHKIR, and every one of the corpus's seven proves it:
            // `Издание 1-е`, `4-е изд.`, `2-е изд.` ×3, `2-й Украинский фронт`, `в 1990-е башкир…` —
            // all inside Russian-language passages, which this corpus carries in quantity (bibliographies,
            // archival citations, quoted decrees). Bashkir's own ordinal is -се/-сы/-сө and its possessive
            // is -ы/-е/-һы/-һе, so a BARE `-е` is formally possible here and simply never occurs. Gluing it
            // gave *туҡһане*, *икее* — a word in neither language.
            if (suffix === "е" || suffix === "й") return whole;
            // ⚠ THE ORDINAL BRANCH NEEDS TWO LETTERS, because a ONE-letter suffix is always the
            // possessive and `endsWith` cannot tell them apart: `613-ө` is *алты йөҙ ун өсө* ("613 of
            // them", the corpus's «2 626 613-ө ҡалала»), but *өсөнсө* also ends in ⟨ө⟩ and would win.
            // Every ordinal this corpus writes is ≥2 letters and starts with ⟨с⟩ or ⟨н⟩ (-се, -сы, -сө,
            // -нсы); every one-letter suffix in it is possessive (-ө, -ы, -һе is two but vowel-initial).
            const ord = suffix.length >= 2 ? ordinalOf(n) : undefined;
            if (ord !== undefined) {
                // ⚠ THE WRITTEN SUFFIX MAY CARRY A CASE ENDING PAST THE ORDINAL'S OWN TAIL. The corpus's
                // `Әхмәт III-сөнөң` is *өсөнсөнөң* — the ordinal *өсөнсө* plus a genitive — and a plain
                // `endsWith` test cannot see that, so it fell through to the glue path and produced
                // *өссөнөң*. Splice on the OVERLAP instead: find the longest prefix of the written suffix
                // that the ordinal already ends with, and append only what is left over. With no case
                // ending the overlap is the whole suffix and this reduces to the `endsWith` test.
                for (let k = Math.min(ord.length, suffix.length); k >= 2; k--)
                    if (ord.endsWith(suffix.slice(0, k))) return ord + suffix.slice(k);
            }
            const card = cardinal(n);
            if (card === "") return whole;
            // ⚠ A GLUED SUFFIX MUST BRING ITS OWN VOWEL unless the numeral ends in one, or the join is a
            // cluster no Bashkir word can carry. The corpus's `1 923 233-н` ("…-н ир-егеттәр тәшкил итә")
            // is the case: `өс` + `н` is *өсн*, which is not a word in any language — the writer's `-н` is
            // the accusative of a possessive form whose linking vowel they did not type. One instance,
            // and declining it leaves the figure read correctly with the morpheme unspoken, which beats
            // emitting an impossible syllable (trap 56: a defect that produces a READING is the worst kind).
            const hasVowel = [...suffix].some((c) => "аәоөуүыиэеёюя".includes(c));
            const stemVowelFinal = "аәоөуүыиэе".includes(card.at(-1)!);
            if (!hasVowel && !stemVowelFinal) return whole;
            return `${card}${suffix}`;
        });

    // 6) DEGREES, and ⚠ THE CASE SUFFIX SITS ON THE SIGN — `+0,3 °C-тан … +2,8 °C-ҡа тиклем`, `10° С-тан`,
    //    `5°-ҡа тиклем`. Both the Latin ⟨C⟩ and the Cyrillic ⟨С⟩ occur and they render identically, so the
    //    class must carry both or the Latin one falls to core/foreign.ts and is read as the ENGLISH letter
    //    name — which is what `+28 °C` was doing ([sˈiː]).
    //    ⚠ THE SCALE NAME IS DROPPED WHEN A SUFFIX FOLLOWS, deliberately: the sourced compound is *Цельсий
    //    градусы*, whose possessive -ы needs a linking -н- before a case ending that the writer did not
    //    type (they wrote `-тан`, the allomorph bare *градус* takes). Emitting `градустан` is what the
    //    writer's own choice implies; `Цельсий градусытан` is not a word. Honest lossiness, not an oversight.
    // ⚠ THE LOWERCASE SCALE LETTER GOES IN THE CLASS, NOT IN AN `i` FLAG — the suffix class beside it
    //    is genuinely lowercase-only, and `i` folds it so the flag would widen the suffix capture too.
    s = s.replace(new RegExp(`(\\d)\\s?°\\s?[CСcс]\\s?-\\s?(${SFX}{1,4})${NOT_LETTER_AFTER}`, "gu"), "$1 градус$2");
    s = s.replace(new RegExp(`(\\d)\\s?°\\s?-\\s?(${SFX}{1,4})${NOT_LETTER_AFTER}`, "gu"), "$1 градус$2");
    //    ⚠ AND THE CORPUS ALSO WRITES THE SIGN AFTER THE LETTER — `−41 С°`, `+35С°`, `0С° аҙағында`. That
    //    is a typo for `°С` and it is the only reason the degree class still reported after the rules above
    //    were in; claimed here on the same terms, letter first.
    s = s.replace(new RegExp(`(\\d)\\s?[CСcс]\\s?°\\s?-\\s?(${SFX}{1,4})${NOT_LETTER_AFTER}`, "gu"), "$1 градус$2");
    s = s.replace(/(\d)\s?[CС]\s?°(?![\p{L}\p{M}])/gui, "$1 Цельсий градусы");
    s = s.replace(/(\d)\s?°\s?[CС](?![\p{L}\p{M}])/gui, "$1 Цельсий градусы");
    s = s.replace(/(\d)\s?°\s?[FФ](?![\p{L}\p{M}])/gui, "$1 Фаренгейт градусы");
    //    ⚠ WITH A TRAILING SPACE, because the sign is written GLUED to letters this rule does not claim:
    //    `17—19 °Т` (degrees Turner, a dairy acidity unit) fused into *градуст*, one impossible word. The
    //    final space-collapse below removes the doubling in the ordinary case.
    s = s.replace(/(\d)\s?°/gu, "$1 градус ");

    // 7) THE GRAM, claimed HERE rather than declared to the shared tier — see the header. `3,300 г` and
    //    `2,176 г` are grams; `1938 г.` and `1988 г.` are Russian years, and the DOT is the only thing that
    //    separates them. The tier's trailing guard (`(?![\p{L}\p{M}])`) does not reject a dot, so declaring
    //    the key would have read every Russian year in the corpus as a weight.
    s = s.replace(/(\d+(?:,\d+)?)\s?г(?![\p{L}\p{M}.])/gu, "$1 грамм");

    // 8) SIGNS. This corpus's climate prose writes `+18 °C`, `+0,3 °C` and `−18 °C` — the true MINUS
    //    (U+2212) as well as the hyphen — and every one lost its sign.
    s = s.replace(/(^|[\s(])[-−–](\d)/gu, "$1минус $2");
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it.
    s = s.replace(/±/gu, " плюс минус ");
    s = s.replace(/(^|[\s(])\+\s?(\d)/gu, "$1плюс $2");
    //    `=` is DIGIT-GATED: 16 of the corpus's 17 are LaTeX, a Russian-text typo, or a formula the dump
    //    extraction left raw. `тигеҙ` ×350 is the reading, sourced from the geometry article beside its own
    //    formula ("квадрат яғының яртыһына тигеҙ: r = t/2"). ⚠ In careful Bashkir it governs the DATIVE
    //    (*яртыһына тигеҙ*) and this layer emits bare numerals; the nominative reading is the colloquial
    //    one and is what a reader says for `5 = 5`. No `÷` rule is written at all — the corpus's single
    //    instance (`6,4÷6,7`) is a RANGE in the Russian convention, not a division.
    s = s.replace(/(\d)\s?=\s?(?=\d)/gu, "$1 тигеҙ ");
    s = s.replace(/(\d)\s?×\s?(?=\d)/gu, "$1 тапҡыр ");

    // 9) NUMERIC RANGES. The dash was dropped outright and the endpoints fused into one run of words —
    //    `300—600 мм` read as *өс йөҙ алты йөҙ*. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A CONNECTIVE,
    //    and that is a measured refusal rather than a gap: Bashkir marks a span with case endings on BOTH
    //    operands (*өс йөҙҙән алты йөҙгә тиклем*), which needs an ablative and a dative this layer would
    //    have to derive unaided — the one thing the rest of this file is built to avoid doing. A pause
    //    separates the endpoints, invents no morpheme, and leaves the span audible as two figures. Kazakh
    //    takes the same shape (its rule normalises the dash and adds no word).
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — `Вегетация миҙгеле — 120—135 көн.`
    //    is how this corpus ends a sentence. Runs AFTER the ordinal and sign rules, which have already
    //    spent every hyphen that belongs to a suffix or opens a negative.
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,])(\d+)\s?-\s?(?=\d)/gu, "$1, ");

    // A padded replacement (` плюс минус `) doubles a space that was already there. Harmless downstream
    // because assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be
    // the one producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
