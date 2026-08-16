/**
 * Tatar (tt) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/tt.jsonc` — tt.wikipedia dump, 1,014,015 paragraph segments. Corpus-wide
 * counts for the classes claimed here: `year` 291,616 · `abbrev` 144,661 · `initialism` 168,019 ·
 * `ranges` 54,709 · `dotted` 44,941 · `decimals` 33,800 · `signs` 22,701 · `roman` 18,850 ·
 * `ordinal-latin` 11,012 · `percent` 11,110 · `clock` 7,894 · `grouped` 4,252 · `era-marker` 2,805 ·
 * `signed-number` 2,792 · `exponent` 2,611 · `degrees` 717 · `rate` 687 · `units` 374 · `currency` 143.
 *
 * ⚠ THIS LANGUAGE IS WRITTEN IN TWO ORTHOGRAPHIES AND THE HARD-SET LIES ABOUT WHICH ONE. tt.wikipedia
 * carries a large body of Zamanälif (Latin) articles, and because those are the old hand-written ones
 * they are dense with figures and signs — so the ADVERSARIAL tier reads 63% Latin while the uniform
 * stride reads 95% Cyrillic. This layer is written for the Cyrillic, and the Latin is a recorded refusal
 * rather than an oversight: `tatar.ts` is a Cyrillic grapheme scan, so Zamanälif already falls to
 * `core/foreign.ts` and is read as English (`yöz` → [jts], `AQŞ` → [ˈʌks]). An ordinal rule for
 * `1922. yılda` would drop correct Tatar number words into a sentence whose every other word is garbage.
 *
 * ⚠ THE SUFFIX ON THE FIGURE IS THE DEFINING CLASS, as in Bashkir — but TATAR WRITES IT FOUR WAYS AND
 * BASHKIR WRITES IT ONE. `ba` is hyphenated with near-total consistency (`1-се`); this corpus's retained
 * text has all of:
 *
 *     hyphenated   3-нче · 4-нче · 2009-нчы · 19-ынчы · 2000-гә · 22:30-га · 9:51:13-тә
 *     SPACED       1 нче президенты · 1917 нче елда · 1930 нчы елга · 1914 – 1917 нче елларда
 *     GLUED        2005нченең · 13:23:58дә
 *     long form    19-ынчы гасырда   (the linking vowel typed out)
 *
 * A rule shaped like Bashkir's gets the spaced variant right by accident and misses the glued one
 * entirely. Both are claimed here — and claiming the SPACED one is why the suffix alternation below is a
 * CLOSED SET rather than `SFX{1,5}`: a bare space between a figure and a Cyrillic word is otherwise the
 * commonest shape in the language (`2010 елда`, `294 км`, `4 мең`), and an open alternation would eat the
 * noun. Bashkir could afford the open set because its hyphen made the boundary unambiguous.
 *
 * ⚠ NOT ONE `°` IN THIS CORPUS IS A TEMPERATURE. All ten are angular or geographic — `90°
 * äyländerelgän` (a rotation), `0° Гринвич меридианы`, `360° panoramic`, `46°22′ N`, and four latitudes
 * (`66°30'`, `81°49'`, `77°43'`, `41°11'ында`). So the rule that carries this class is the
 * DEGREE-AND-MINUTE pair, not a Celsius reading; the `°C` branch ships as insurance, is letter-gated and
 * cannot misfire, and is recorded here as unattested rather than being allowed to look measured.
 *
 * ⚠ AND THE CASE SUFFIX ATTACHES ACROSS THE ABBREVIATION'S FINAL DOT — `т.к.нең 66°30'`, `т.к. нең
 * 81°49'`, `т. к. нең 77°43'`, `к.к.нең 41°11'ында`, `кч. оз. ның 19°38'`. Those are *төньяк киңлек* /
 * *көньяк киңлек* / *көнчыгыш озынлык* with a genitive hanging off the abbreviation in three spacings,
 * and `41°11'ында` puts a locative on the PRIME. **No rule is written for them.** Russian `т.к.` is *так
 * как*, this corpus demonstrably carries Russian prose in quantity, and five instances of a Tatar reading
 * against an unmeasured count of the Russian one is not a licence (trap 9). The prime rule below does
 * claim the figure, which is the part that was silently dropped.
 *
 * ⚠ THERE IS NO FRACTION RULE, and that is a count, not an omission. Every `\d+/\d+` in the retained text
 * is something else: `ПБУ 19/02` (a Russian accounting standard), `Октябрьский городок, 1/66` (a street
 * address, ×2) and `2010/11 уку елында` (an academic year). A `x/y` → *y-тән x* rule would have read all
 * four wrong and none right.
 *
 * ⚠ THE BIBLIOGRAPHY IS RUSSIAN, in quantity — `Учеб. для вузов.-4-е изд., испр.,-М,:`, `т. 5. — М.:
 * „Советская энциклопедия“`, `№ 5. С. 49-52`, `15 000 экз.`, `г.Казань`. Same finding as ba's `г.` =
 * *года*, and it is why `-е` and `-й` are excluded from the suffix set below: Tatar's own ordinal never
 * ends in a bare `-е`, and Russian's `4-е изд.` does.
 *
 * SOURCING — the words emitted here, with the sense read in tt.wikipedia's own text; see
 * `tools/corpus/attest/tt.jsonc`.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { numberToWords } from "./numbers.ts";

// ---------------------------------------------------------------------------------------------------
// ORDINALS — derived, not tabulated
// ---------------------------------------------------------------------------------------------------

/** The cardinal as words — the same composer the engine's number path uses. */
const cardinal = (n: number): string => numberToWords(n).join(" ");

const VOWELS = "аәоөуүыиэеёюя";
/** ⟨ә ө ү е и э⟩ — the FRONT series that selects the -енче/-нче allomorph. */
const FRONT = "әөүеиэ";

/**
 * The Tatar ORDINAL suffix, chosen by the last vowel of the cardinal's final word and by whether that
 * word ends in a vowel. Derived rather than tabulated — the paradigm is fully regular and a table is
 * correct only where you looked (trap 8):
 *
 *     consonant-final, back vowel   → -ынчы    тугыз → тугызынчы · алтмыш → алтмышынчы · ун → унынчы
 *     consonant-final, front vowel  → -енче    бер → беренче · биш → бишенче · йөз → йөзенче
 *     vowel-final, back vowel       → -нчы     алты → алтынчы
 *     vowel-final, front vowel      → -нче     ике → икенче · егерме → егерменче · илле → илленче
 *
 * ⚠ THE DIFFERENCE FROM THE SIBLING IS LABIAL HARMONY, AND TATAR HAS NONE HERE. Bashkir rounds the
 * suffix after ⟨ө о⟩ (`өс` → *өсөнсө*, `йөҙ` → *йөҙөнсө*); Tatar does not — `өч` is *өченче* and `йөз` is
 * *йөзенче*. Porting ba's `ROUNDING` set across would have produced *өчөнчө* and *йөзөнчө* for the two
 * commonest low ordinals in the language. The closest sibling is a hypothesis (trap 55).
 *
 * ⚠ AND ONE STEM LENITES. A stem-final ⟨к⟩ voices to ⟨г⟩ before the vowel-initial suffix, which is a
 * general Tatar process and which exactly one numeral reaches: `кырык` → *кырыгынчы*, not *кырыкынчы*.
 * Written as the process rather than as a special case, because that is what it is.
 */
export function ordinalOf(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 0) return undefined;
    const words = cardinal(n).split(" ");
    let last = words[words.length - 1];
    if (last === undefined || last === "") return undefined;
    const vowels = [...last].filter((c) => VOWELS.includes(c));
    const v = vowels[vowels.length - 1];
    if (v === undefined) return undefined;
    const front = FRONT.includes(v);
    const endsVowel = VOWELS.includes(last.at(-1)!);
    if (!endsVowel && last.endsWith("к")) last = `${last.slice(0, -1)}г`;
    const suffix = endsVowel ? (front ? "нче" : "нчы") : front ? "енче" : "ынчы";
    words[words.length - 1] = last + suffix;
    return words.join(" ");
}

/**
 * The CASE and POSSESSIVE endings a writer glues to a figure, as a CLOSED SET — the one structural
 * departure from the Bashkir rule and the reason this layer can also claim the SPACED variant.
 *
 * Tatar declension is regular and small: genitive -ның/-нең, dative -га/-гә/-ка/-кә/-на/-нә, accusative
 * -ны/-не/-н, locative -да/-дә/-та/-тә, ablative -дан/-дән/-тан/-тән, plural -лар/-ләр, possessive
 * -ы/-е/-сы/-се and the oblique forms built on it. The writer has already chosen the allomorph (the
 * Basque finding, c1571ec) — `2000-гә`, `22:30-га`, `13:23:58дә`, `9:51:13-тә` are each the form the
 * SPOKEN numeral takes — so the rule attaches what was typed and derives nothing.
 *
 * ⚠ `-е` AND `-й` ARE ABSENT ON PURPOSE. Both are Russian (`4-е изд.`, `2-й`), this corpus carries
 * Russian bibliography in quantity, and gluing them gave *икее*, *туксане* — a word in neither language.
 * `-ы` is kept because it is a live Tatar possessive; `-е` is its front twin and is the collision, so the
 * front possessive is reachable only in its longer `-се` form. That asymmetry is a real cost and is
 * written down rather than smoothed over.
 */
const CASE_SUFFIX: ReadonlySet<string> = new Set([
    "ның", "нең", "га", "гә", "ка", "кә", "на", "нә",
    "ны", "не", "н", "да", "дә", "та", "тә", "нда", "ндә",
    "дан", "дән", "тан", "тән", "ннан", "ннән",
    "лар", "ләр", "ларда", "ләрдә", "лардан", "ләрдән", "ларны", "ләрне", "ларның", "ләрнең",
    "ы", "сы", "се", "ын", "ен", "ына", "енә", "ында", "ендә", "ыннан", "еннән", "ының", "енең",
]);

/** The ordinal suffixes as a writer types them — the ONLY alternation allowed after a bare space. */
const ORD_SUFFIX = "(?:ынчы|енче|нчы|нче)";

// ---------------------------------------------------------------------------------------------------
// INITIALISMS
// ---------------------------------------------------------------------------------------------------

/**
 * Tatar letter NAMES. The alphabet is Russian Cyrillic plus ⟨ә ө ү җ ң һ⟩; the shared letters keep their
 * Russian names, which is how the alphabet is recited, and the six Tatar-only letters are named by their
 * own sound. The corpus's caps runs are ГӨ ×5, АКШ ×4 (the USA), АО ×4, ТР ×3, ИҮА ×2, СССР ×2, АССР ×2,
 * plus РФ, БАССР, РСФСР, МФМК, ЧТПЗ, ММИ, МТС, ТЭП, ПБУ, ХФӘ — every one of which reached the g2p as a
 * raw consonant cluster (`ТР` → [tr]).
 *
 * ⚠ THE TATAR-ONLY LETTERS THAT ACTUALLY OCCUR ARE ⟨ә ө ү⟩ AND ONLY THOSE. Tallying every letter in
 * every caps run in the retained text: ө ×5, ү ×2, ә ×1, and ZERO of ⟨җ ң һ⟩. Those three are given
 * names for completeness and no instance exercises them — said here rather than left for a reader to
 * assume the whole table is corpus-backed.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    а: "а", б: "бэ", в: "вэ", г: "гэ", д: "дэ", е: "е", ё: "ё", ж: "жэ", җ: "җэ", з: "зэ",
    и: "и", й: "кыска и", к: "ка", л: "эль", м: "эм", н: "эн", ң: "эң", о: "о", ө: "ө",
    п: "пэ", р: "эр", с: "эс", т: "тэ", у: "у", ү: "ү", ф: "эф", х: "ха", һ: "һэ",
    ц: "цэ", ч: "че", ш: "ша", щ: "ща", ы: "ы", э: "э", ә: "ә", ю: "ю", я: "я",
};

/** Tatar phonotactics, for the OOV rule in core/initialisms.ts. */
export const isUnreadableTatar = makeUnreadableTest({
    vowels: /[аәеёиоөуүыэюя]/u,
    legalOnsets: new Set([
        "бл", "бр", "гр", "гл", "др", "кр", "кл", "пл", "пр", "ст", "сп", "ск", "тр", "шк", "шт",
    ]),
    legalCodas: new Set([
        "кт", "нд", "нт", "нк", "рт", "рд", "рс", "лт", "лд", "ст", "шт", "рш", "рк", "лк", "мб",
        "нч", "рч", "йд", "нз",
    ]),
});

export function normalizeTatarInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        // Spelled out despite being pronounceable — the corpus's own runs.
        acronymLetters: new Set(["акш", "ссср", "асср", "басср", "рсфср", "сср", "тр", "рф", "ао", "мтс", "тэп"]),
        isRecorded: () => false,
        isUnreadable: isUnreadableTatar,
    })(text);
}

// ---------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------

/** ⚠ EVERY BOUNDARY IN THIS FILE IS AN EXPLICIT LOOKAROUND, NEVER `\b` — `\b` is ASCII-defined and finds
 *  none against Cyrillic, which is how `core/initialisms.ts` was a total no-op for Russian (trap 1). */
const NOT_LETTER = "(?![\\p{L}\\p{M}])";
const NOT_BEFORE = "(?<![\\p{L}\\p{M}])";
/** The Tatar-Cyrillic letters a written suffix can be spelt with. */
const SFX = "[а-яёәөүҗңһ]";

/**
 * Attach a written suffix to a figure — the ordinal first, then the closed case set. Shared by the
 * hyphenated and glued branches of step 4.
 */
function attach(whole: string, digits: string, rawSuffix: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return whole;
    const suffix = rawSuffix.toLowerCase();
    const ord = ordinalOf(n);
    // ⚠ THE WRITTEN SUFFIX MAY CARRY A CASE ENDING PAST THE ORDINAL'S OWN TAIL — `2005нченең` is
    // *ике мең бишенченең*, the ordinal plus a genitive, and a plain `endsWith` test cannot see that.
    // Splice on the OVERLAP: the longest prefix of what was typed that the ordinal already ends with.
    // Two letters minimum, because a one-letter overlap is always an accident of the vowel.
    if (ord !== undefined)
        for (let k = Math.min(ord.length, suffix.length); k >= 2; k--)
            if (ord.endsWith(suffix.slice(0, k))) return ord + suffix.slice(k);
    if (!CASE_SUFFIX.has(suffix)) return whole;
    const card = cardinal(n);
    if (card === "") return whole;
    // ⚠ A GLUED SUFFIX MUST BRING ITS OWN VOWEL unless the numeral ends in one, or the join is a cluster
    // no Tatar word can carry — the bare accusative `-н` after `өч` would be *өчн* (trap 56: a defect
    // that produces a READING is the worst kind).
    const hasVowel = [...suffix].some((c) => VOWELS.includes(c));
    if (!hasVowel && !VOWELS.includes(card.at(-1)!)) return whole;
    return `${card}${suffix}`;
}

/** Normalize one Tatar input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeTatar(input: string): string {
    let s = input;

    // 0) DIGIT DE-GROUPING, FIRST — a grouping space is otherwise read as a separate number and every
    //    later rule needs the figure whole. This corpus groups with a space: `142 914 мең кеше`,
    //    `17 752 мең км²`, `11 500 км²`, `55 758 006 километр`, `15 000 экз.`, `2 430 км²`. THREE passes,
    //    because adjacent groups share the digit the previous one consumes and `55 758 006` has two.
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
    s = s.replace(/[   ]/gu, " ");

    // 1) MULTI-DOT ABBREVIATIONS, before any single-dot rule.
    //    ⚠ THE ERA MARKERS ARE SOURCED BY THE CORPUS'S OWN GLOSS, in one sentence that gives all four
    //    expansions and both abbreviations at once: "Беренче ел башланганчы бетә торган заман — **безнең
    //    эрага кадәр, б. э. к., яки яңа эрага кадәр, я. э. к.**" — and, for the positive era, "**Безнең
    //    эра (б. э.), яки яңа эра (я. э.)**". Nothing here is authored. The retained text writes the
    //    negative marker four ways — `б.э.к.`, `Б.э.к.`, `б.э.к` (bare, before a dash) and `б. э к.` —
    //    which is why the dots and the spaces are both optional in the pattern.
    //    `һ.б.` = *һәм башкалар* (the Tatar "etc."), `ш.и.` = *шул исәптән* ("including"), both ×5.
    //    `млн.`/`млрд.` are the magnitude abbreviations (`8 млн. т каты`).
    //    The FINAL dot is kept at a sentence end, or the pause is lost outright (trap 10).
    const multi: readonly (readonly [RegExp, string])[] = [
        [new RegExp(`${NOT_BEFORE}б\\s?\\.\\s?э\\s?\\.?\\s?к\\s?\\.?`, "giu"), "безнең эрага кадәр"],
        [new RegExp(`${NOT_BEFORE}я\\s?\\.\\s?э\\s?\\.?\\s?к\\s?\\.?`, "giu"), "яңа эрага кадәр"],
        [new RegExp(`${NOT_BEFORE}б\\s?\\.\\s?э\\s?\\.`, "giu"), "безнең эра"],
        [new RegExp(`${NOT_BEFORE}я\\s?\\.\\s?э\\s?\\.`, "giu"), "яңа эра"],
        [new RegExp(`${NOT_BEFORE}һ\\s?\\.\\s?б\\s?\\.`, "giu"), "һәм башкалар"],
        [new RegExp(`${NOT_BEFORE}ш\\s?\\.\\s?и\\s?\\.`, "giu"), "шул исәптән"],
        [new RegExp(`${NOT_BEFORE}млрд\\s?\\.`, "giu"), "миллиард"],
        [new RegExp(`${NOT_BEFORE}млн\\s?\\.`, "giu"), "миллион"],
    ];
    for (const [re, word] of multi)
        s = s.replace(re, (m0, offset: number, full: string) => {
            const rest = full.slice(offset + m0.length);
            return /^\s*["»)']?\s*$/u.test(rest) ? `${word}.` : word;
        });

    // 2) НОМЕР. The sign was dropped outright (`№ 5. С. 49-52`).
    s = s.replace(/№\s?(?=\d)/gu, "номер ");

    // 3) CLOCK, and the case suffix that may sit on it. The colon is clause punctuation in tatar.ts, so
    //    `22:30` read as *егерме ике , утыз* — a phrase break inside a time. ⚠ THE SUFFIX ATTACHES TO THE
    //    SPOKEN MINUTE, which is why the clock must be worded here rather than left as digits: `22:30-га`
    //    is *егерме ике утызга*, and gluing the written suffix to a DIGIT can never produce that.
    //    ⚠ AND A THIRD FIELD IS A TIMESTAMP, NOT A CLOCK, which this corpus writes with the suffix glued
    //    to the seconds: `13:23:58дә` (the Chernobyl article) and `9:51:13-тә` (the Mars opposition).
    //    Both are claimed; a two-field rule alone would have left the seconds as a stranded number.
    //    Runs BEFORE the ordinal rule so a time is not first claimed as a numeral-plus-suffix.
    const timeSuffix = `(?:\\s?-\\s?|)(${SFX}{1,5})${NOT_LETTER}`;
    s = s.replace(
        new RegExp(`(?<![\\d:.,])([01]?\\d|2[0-4]):([0-5]\\d):([0-5]\\d)(?![\\d:.,])(?:${timeSuffix})?`, "gu"),
        (whole, h: string, mi: string, sec: string, sfx: string | undefined) => {
            const words = [cardinal(Number(h)), cardinal(Number(mi)), cardinal(Number(sec))].join(" ");
            return sfx === undefined ? words : attachToWords(whole, words, sfx);
        },
    );
    s = s.replace(
        new RegExp(`(?<![\\d:.,])([01]?\\d|2[0-4]):\\s?([0-5]\\d)(?![\\d:.,])(?:${timeSuffix})?`, "gu"),
        (whole, h: string, mi: string, sfx: string | undefined) => {
            const mv = Number(mi);
            const words = mv === 0 ? cardinal(Number(h)) : `${cardinal(Number(h))} ${cardinal(mv)}`;
            return sfx === undefined ? words : attachToWords(whole, words, sfx);
        },
    );

    // 4) NUMERAL + WRITTEN SUFFIX — the class this language is defined by, in its three attachments.
    //    ⚠ HYPHENATED AND GLUED TAKE THE FULL CLOSED SET, because the boundary is unambiguous there:
    //    `3-нче`, `2009-нчы`, `19-ынчы`, `2000-гә`, `2005нченең`.
    //    MUST run before the range rule (step 7), which would otherwise eat the hyphen.
    s = s.replace(new RegExp(`(?<![\\d.,/])(\\d+)\\s?-\\s?(${SFX}{1,6})${NOT_LETTER}`, "gu"),
        (whole, digits: string, sfx: string) => attach(whole, digits, sfx));
    s = s.replace(new RegExp(`(?<![\\d.,/])(\\d+)(${SFX}{1,6})${NOT_LETTER}`, "gu"),
        (whole, digits: string, sfx: string) => attach(whole, digits, sfx));

    // 5) SIGNS. `−2.88-гә` uses the true MINUS (U+2212); the corpus's own arithmetic uses `=` and `×`.
    //    Runs before the range rule, which would otherwise read the minus as a span's dash.
    s = s.replace(/(^|(?<!\d)[\s(])[-−–](\d)/gu, "$1минус $2");
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1), NOT A `+`, so no `+` rule can ever match inside it.
    s = s.replace(/±/gu, " плюс минус ");
    s = s.replace(/(^|[\s(])\+\s?(\d)/gu, "$1плюс $2");
    s = s.replace(/(\d)\s?=\s?(?=\d)/gu, "$1 тигез ");
    s = s.replace(/(\d)\s?×\s?(?=\d)/gu, "$1 тапкыр ");

    // 6) DEGREES — and in this corpus that means COORDINATES. `66°30'`, `81°49'`, `77°43'`, `46°22′`,
    //    `19°38'` are latitude and longitude readings, and `90°`, `0°`, `360°` are an angle, a meridian
    //    and a panorama. The degree-and-minute pair is claimed first so the prime is not left stranded
    //    after the degree rule has consumed the sign. Both the typographic ⟨′⟩ and the ASCII ⟨'⟩ occur.
    //    ⚠ AND THE CASE SUFFIX SITS ON THE PRIME — `к.к.нең 41°11'ында` ("at 41°11' of south latitude").
    //    The suffix must be glued to *минут*, not left standing as its own word: an isolated *ында* is a
    //    bound morpheme read aloud as a word, which is the trap-56 shape — a defect that produces a
    //    reading. `\s?` before it, because the corpus writes both `41°11'ында` and `81°49' ында`.
    s = s.replace(new RegExp(`(\\d)\\s?°\\s?(\\d+)\\s?[′']\\s?(${SFX}{1,5})${NOT_LETTER}`, "gu"),
        (whole, deg: string, min: string, sfx: string) => {
            const glued = attachToWords(whole, `${deg} градус ${min} минут`, sfx);
            return glued === whole ? `${deg} градус ${min} минут ${sfx}` : `${glued} `;
        });
    s = s.replace(/(\d)\s?°\s?(\d+)\s?[′']/gu, "$1 градус $2 минут ");
    //    ⚠ THE CELSIUS BRANCH IS INSURANCE, NOT EVIDENCE, AND ITS WORD IS ATTESTED IN THE WRONG SENSE.
    //    Zero of this corpus's degrees are temperatures, and all 28 token hits for `Цельсий` are the
    //    SURNAME — "Магнус Николай Цельсий (Magnus Nicolai Celsius; 1621—1679) — швед математик", and his
    //    sons. That is the Fula `tere` shape, except that here the man IS the one the scale is named for,
    //    so the word is right and only the compound (*Цельсий градусы*, the order ba's corpus glosses) is
    //    a stated assumption. It ships because it is letter-gated and cannot misfire on anything this
    //    corpus contains, and because without it a `°C` loses the sign AND reads the ⟨C⟩ as the ENGLISH
    //    letter name via core/foreign.ts. The assumption is written down rather than left to look measured.
    s = s.replace(/(\d)\s?°\s?[CС](?![\p{L}\p{M}])/gu, "$1 Цельсий градусы");
    s = s.replace(/(\d)\s?°\s?[FФ](?![\p{L}\p{M}])/gu, "$1 Фаренгейт градусы");
    //    WITH A TRAILING SPACE, because the sign is written glued to letters this rule does not claim;
    //    the final space-collapse removes the doubling in the ordinary case.
    s = s.replace(/(\d)\s?°/gu, "$1 градус ");

    // 7) THE SPACED ORDINAL, and ⚠ ONLY THE ORDINAL. `1 нче президенты`, `1917 нче елда`, `1930 нчы
    //    елга`, `1914 – 1917 нче елларда`. Runs AFTER the range rule below would have wanted to, so it is
    //    ordered before it and the range rule is given the leftovers — see step 8.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d+)\\s(${ORD_SUFFIX})${NOT_LETTER}`, "gu"),
        (whole, digits: string, sfx: string) => attach(whole, digits, sfx));

    // 8) NUMERIC RANGES. The dash was dropped outright and the endpoints fused into one run of words —
    //    `1236—1237 елларда` read as one twelve-word number. ⚠ THE DASH IS SPENT ON A PAUSE RATHER THAN A
    //    CONNECTIVE, the same measured refusal ba and kk make: Tatar marks a span with case endings on
    //    BOTH operands (*мең ике йөз утыз алтынчы елдан мең ике йөз утыз җиденче елга кадәр*), which
    //    needs an ablative and a dative this layer would have to derive unaided — the one thing the rest
    //    of this file is built to avoid. A pause separates the endpoints and invents no morpheme.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — `№ 6. С. 34-37.` is how this
    //    corpus ends a citation. Runs AFTER the suffix and sign rules, which have already spent every
    //    hyphen that belongs to a suffix or opens a negative.
    s = s.replace(/(\d)\s?[–—]\s?(?=\d)/gu, "$1, ");
    s = s.replace(/(?<![\d.,])(\d+)\s?-\s?(?=\d)/gu, "$1, ");

    // A padded replacement (` плюс минус `) doubles a space that was already there. Harmless downstream
    // because assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be
    // the one producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}

/**
 * Glue a written suffix onto an already-spelled phrase (a clock reading). Shares the vowel guard with
 * `attach`, but never tries the ordinal branch — a time is not an ordinal.
 */
function attachToWords(whole: string, words: string, rawSuffix: string): string {
    const suffix = rawSuffix.toLowerCase();
    if (!CASE_SUFFIX.has(suffix)) return whole;
    const hasVowel = [...suffix].some((c) => VOWELS.includes(c));
    if (!hasVowel && !VOWELS.includes(words.at(-1)!)) return whole;
    return `${words}${suffix}`;
}
