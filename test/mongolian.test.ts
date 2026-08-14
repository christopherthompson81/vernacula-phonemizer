import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/mongolian/mongolian.ts";
import { normalizeMongolian } from "../src/languages/mongolian/normalize.ts";

// Canonical-IPA goldens for Standard Khalkha Mongolian (mn), Cyrillic. Cyrillic Khalkha is a
// DEEP orthography: only the first-syllable vowel is realised full; a non-initial SHORT vowel reduces to ə or deletes
// word-finally (final vowel drop + epenthesis into the resulting cluster). Signatures: the ASPIRATED-vs-UNASPIRATED
// stop system (б=p т=tʰ), л→ɮ (voiced lateral fricative), back-harmony г→ɢ/х→χ, final н→ŋ, final в→f devoicing,
// doubled vowels → long.
describe("Mongolian (Khalkha) canonical IPA", () => {
    test("consonants: б→p, д→t, т→tʰ, л→ɮ, final н→ŋ, harmony г→ɢ/х→χ", () => {
        expect(phonemizeWord("Монгол")).toBe("mɔŋɢʊɮ"); // back-harmony ɢ, dark ɮ, non-initial о→ʊ
        expect(phonemizeWord("сайн")).toBe("saiŋ"); // diphthong ай, final н→ŋ
        expect(phonemizeWord("ном")).toBe("nɔm"); // о→ɔ
        expect(phonemizeWord("хот")).toBe("χɔtʰ"); // back х→χ, т→tʰ
        expect(phonemizeWord("улс")).toBe("ʊɮs"); // у→ʊ, dark ɮ
    });

    test("front harmony + rounded/soft vowels", () => {
        expect(phonemizeWord("хүн")).toBe("xuŋ"); // front х→x, ү→u, final н→ŋ
        expect(phonemizeWord("өдөр")).toBe("ɵtɵr"); // ө→ɵ, non-initial ө stays round
        expect(phonemizeWord("морь")).toBe("mœr"); // ь fronts о→œ
    });

    test("long vowels (doubled) + final в devoicing + reduction", () => {
        expect(phonemizeWord("сургууль")).toBe("sʊrɢuːɮ"); // уу→uː long, final ь
        expect(phonemizeWord("гурав")).toBe("ɢʊrəf"); // final в→f, non-initial а→ə
    });

    test("deep-orthography reduction: final-vowel deletion", () => {
        expect(phonemizeWord("байна")).toBe("pain"); // б→p, final а deleted
    });

    test("sentence: clause punctuation", () => {
        expect(phonemize("Сайн байна уу?", "mn").trim()).toBe("saiŋ pain ʊː ?"); // уу→ʊː long
    });

    test("loanword (mixed vowel harmony) keeps non-initial vowels full", () => {
        expect(phonemizeWord("Герман")).toBe("ɡermaŋ"); // е(front)+а(back) → loanword: а stays full, not reduced ə
    });

    test("traditional Mongolian script (Mongol bichig) front-end → transliterate → engine", () => {
        expect(phonemizeWord("ᠮᠣᠩᠭᠣᠯ")).toBe("mɔŋɢʊɮ"); // classical mongɣol → монгол → mɔŋɢʊɮ (same as Cyrillic Монгол)
    });

    test("cardinal numbers (absolute/attributive: гурав→гурван, хорь→хорин)", () => {
        expect(phonemize("1","mn").trim()).toBe("neɡ"); // нэг
        expect(phonemize("10","mn").trim()).toBe("arəf"); // арав
        expect(phonemize("25","mn").trim()).toBe("χɔrəŋ tʰaf"); // хорин тав (attr 20 + abs 5)
        expect(phonemize("100","mn").trim()).toBe("t͡sʊː"); // зуу
        expect(phonemize("2000","mn").trim()).toBe("χɔjʊr maŋəɢ"); // хоёр мянга
    });

    test("⟨ъ⟩ keeps the GLIDE of the following iotated letter (томъёо → tʰɔmjɔː), not just a break", () => {
        // Found by the silent-deletion detector: the hard sign is written precisely to say that ⟨ё/я/ю/е⟩
        // after it is [j]+V, and treating it as a bare separator dropped the [j] — `томъёоны → tʰɔmʊʊn`.
        expect(phonemizeWord("томъёоны")).toBe("tʰɔmjʊʊn");
        expect(phonemizeWord("Сахъяа")).toBe("saχjə");
    });

    test("⟨ї⟩ U+0457 is a legacy-codepage ⟨ү⟩ — a vowelless word, not a Ukrainian letter", () => {
        // Pre-Unicode Mongolian fonts borrowed the Ukrainian codepoint for ⟨ү⟩; ×8 in the artifact against
        // ⟨ү⟩ ×2,703, and outside the letter tables it read as nothing: `бїр → pr`, `їр → r`.
        expect(phonemizeWord("бїр")).toBe(phonemizeWord("бүр"));
        expect(phonemizeWord("бїлэг")).toBe(phonemizeWord("бүлэг"));
        expect(phonemizeWord("їр")).toBe("ur");
    });
});

// ── TEXT NORMALIZATION (src/languages/mongolian/normalize.ts) ────────────────────────────────────────────
//
// ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13). The corpus writes `-р`
// after 1–10 and after the teens; both come from the SAME composition, so one case from each side of every
// lookup/fallback boundary is pinned, and where a branch is one the corpus does NOT exercise the case is
// chosen deliberately (the composed 8 and 9 ordinals, the tens ordinal, the refused `°F`, the refused
// suffixed magnitude, the four-digit comma).
describe("Mongolian text normalization", () => {
    test("ordinals: the attested 1–10 table, the composed pair, and the compositional path above ten", () => {
        // The corpus spells eight of these out beside its figures (нэгдүгээр ×5, хоёрдугаар ×5,
        // гуравдугаар ×2, дөрөвдүгээр, тавдугаар ×4, Зургаадугаар ×2, долоодугаар, аравдугаар ×2) and the
        // rule reproduces all eight from `cardinal + дугаар/дүгээр` under the manifest's own harmony set.
        expect(normalizeMongolian("1-р сар")).toBe("нэгдүгээр сар");
        expect(normalizeMongolian("3-р сарын")).toBe("гуравдугаар сарын");
        expect(normalizeMongolian("5-р байр")).toBe("тавдугаар байр");
        expect(normalizeMongolian("10-р сарын")).toBe("аравдугаар сарын");
        // The two the corpus never writes, supplied by the same rule rather than by a table lookup.
        expect(normalizeMongolian("8-р сар")).toBe("наймдугаар сар");
        expect(normalizeMongolian("9-р сар")).toBe("есдүгээр сар");
        // Above ten the marker lands on the LAST word only; the rest stay attributive via numberToWords.
        expect(normalizeMongolian("13-р зуун")).toBe("арван гуравдугаар зуун");
        expect(normalizeMongolian("21-р байранд")).toBe("хорин нэгдүгээр байранд");
        expect(normalizeMongolian("20-р зуун")).toBe("хорьдугаар зуун"); // the TENS branch, ×0 in the corpus
        // The ordinal word ends in ⟨р⟩, so a further case suffix glues on with no morphology at all.
        expect(normalizeMongolian("9-рт")).toBe("есдүгээрт");
        // A capitalized head after the hyphen is a numbered LIST ENTRY, not an ordinal (`7-Зургаадугаар`).
        expect(normalizeMongolian("1-Москва")).toBe("1-Москва");
    });

    test("percent: the bare sign, the two attested suffixes absorbed into the stem, and the refusal", () => {
        expect(normalizeMongolian("29% нь")).toBe("29 хувь нь");
        expect(normalizeMongolian("5 %")).toBe("5 хувь");
        // Trap 14 solved rather than declined: `хувь`'s oblique stem is `хув-` and takes the WRITER'S suffix.
        expect(normalizeMongolian("67%-ийг")).toBe("67 хувийг");
        expect(normalizeMongolian("7.7%-иар")).toBe("7 цэг 7 хувиар");
        // `-нь` is the possessive PARTICLE, a free word — citation form plus a space, not the stem.
        expect(normalizeMongolian("86,6 %-нь")).toBe("86 цэг 6 хувь нь");
        // Any OTHER suffix refuses the WHOLE match (trap 53) rather than stranding it beside `хувь`.
        expect(normalizeMongolian("5%-д")).toBe("5%-д");
    });

    test("units and exponents: the measure word is preposed, the rate is refused whole", () => {
        expect(normalizeMongolian("1300 м өндөртэй")).toBe("1300 метр өндөртэй");
        expect(normalizeMongolian("10 кг")).toBe("10 килограмм");
        expect(normalizeMongolian("1кг нүүрс")).toBe("1 килограмм нүүрс"); // glued, no space
        expect(normalizeMongolian("69585 км²")).toBe("69585 квадрат километр");
        expect(normalizeMongolian("3 м³")).toBe("3 куб метр");
        expect(normalizeMongolian("5 м2")).toBe("5 квадрат метр"); // the ASCII exponent, trap 53's ig defect
        // A CLAUSE-FINAL figure must still read — the guard that declined these cost 25 instances.
        expect(normalizeMongolian("4205 м.")).toBe("4205 метр.");
        expect(normalizeMongolian("610 км,")).toBe("610 километр,");
        // A rate is refused WHOLE: Mongolian's idiom is a prefixed locative, not "A per B".
        expect(normalizeMongolian("116 м³/с")).toBe("116 м³/с");
        // Latin keys, because an undeclared Latin run reaches the ENGLISH fallback (`km²` → *ˈʊkm skwˈɛɹd*).
        expect(normalizeMongolian("3780km²")).toBe("3780 квадрат километр");
        // Bare Latin `m` is deliberately NOT a key, so a mole stays a mole (trap 46's withdrawn key).
        expect(normalizeMongolian("1 mol")).toBe("1 mol");
    });

    test("currency: postposed, magnitude-aware, and redundancy-guarded", () => {
        expect(normalizeMongolian("$45")).toBe("45 доллар"); // the wiki states this reading definitionally
        expect(normalizeMongolian("3,500 $ ноогдоно")).toBe("3500 доллар ноогдоно"); // sign on the right
        // The magnitude is part of the QUANTITY — the id `US$` defect, found by reading the corpus diff.
        expect(normalizeMongolian("$90.7 тэрбум")).toBe("90 цэг 7 тэрбум доллар");
        // …and a CASE-MARKED magnitude refuses the whole match, because the case belongs on `доллар`.
        expect(normalizeMongolian("$15 саяыг")).toBe("$15 саяыг");
        // Trap 12: the sentence says it twice, so the reading says it once, in the word.
        expect(normalizeMongolian("$2,5 тэрбум ам.доллар")).toBe("2 цэг 5 тэрбум ам доллар");
    });

    test("degrees and the minus: the scale-neutral word, the refused °F, the coordinate guard", () => {
        expect(normalizeMongolian("5°С")).toBe("5 хэм"); // ⟨С⟩ here is CYRILLIC U+0421, ×4 in the corpus
        expect(normalizeMongolian("100 °C")).toBe("100 хэм"); // and Latin ⟨C⟩ U+0043, ×2
        expect(normalizeMongolian("15° дулаан")).toBe("15 хэм дулаан"); // bare sign before a WORD
        expect(normalizeMongolian("212 °F")).toBe("212 °F"); // no scale name is sourceable — refuse it whole
        expect(normalizeMongolian("47°49'")).toBe("47°49'"); // a COORDINATE, not a temperature
        // Omitting a plus is lossless; omitting a minus INVERTS. So the minus is read and the plus is not.
        expect(normalizeMongolian("-25°С хүрдэг")).toBe("хасах 25 хэм хүрдэг");
        expect(normalizeMongolian("-37 градус")).toBe("хасах 37 градус");
        expect(normalizeMongolian("(−154 м)")).toBe("(хасах 154 метр)"); // U+2212 needs no right context
        expect(normalizeMongolian("+41 хэм")).toBe("+41 хэм"); // the plus is DELIBERATELY left
        // A hyphen that is a RANGE, a designation or a list dash must not become a sign.
        expect(normalizeMongolian("1206-1635")).toBe("1206-1635");
        expect(normalizeMongolian("улсын цолтой бөх -3, манлай уяач -20")).toBe("улсын цолтой бөх -3, манлай уяач -20");
    });

    test("separators: the comma is both a group and a decimal, and a list is neither", () => {
        expect(normalizeMongolian("1,208,544")).toBe("1208544"); // ×3 digits → grouping
        expect(normalizeMongolian("105 000")).toBe("105000"); // the space-grouped arm, ×3 in the corpus
        expect(normalizeMongolian("$2,5")).toBe("2 цэг 5 доллар"); // ×1 digit → decimal
        expect(normalizeMongolian("4,704.4 км²")).toBe("4704 цэг 4 квадрат километр"); // both, in one figure
        expect(normalizeMongolian("3.4528 литийн")).toBe("3 цэг 4528 литийн"); // the dot arm takes any length
        // ⚠ ×4 digits after a comma is a LIST OF TWO YEARS. The first cut read this as one decimal and
        // deleted the clause pause — caught by the corpus diff, not by any probe.
        expect(normalizeMongolian("1974,1977 онуудад")).toBe("1974,1977 онуудад");
        // A dotted DATE keeps its dots; the guard is the separator on either flank.
        expect(normalizeMongolian("2000.4.19")).toBe("2000.4.19");
    });

    test("dots and initials: an abbreviation dot is not a sentence end", () => {
        expect(normalizeMongolian("ам.доллар")).toBe("ам доллар");
        expect(normalizeMongolian("Ц.Элбэгдорж")).toBe("цэ Элбэгдорж");
        expect(normalizeMongolian("Б.Б.Полынов")).toBe("бэ бэ Полынов");
        // A real sentence end survives: the lookbehind wants a LONE capital opening the token.
        expect(normalizeMongolian("Улс. Дараа нь")).toBe("Улс. Дараа нь");
    });

    test("initialisms: the seam spells what the deep orthography would otherwise EAT", () => {
        // Not merely unreadable clusters — mongolian.ts deletes a word-final short vowel, so an acronym came
        // out SHORTER than it went in. `ДНБ` → [tnp], `ХХК` → [xxkʰ], `ЗХУ` → [t͡sχʊ].
        expect(normalizeMongolian("ДНБ")).toBe("дэ эн бэ");
        expect(normalizeMongolian("ХХК")).toBe("хэ хэ ка");
        expect(normalizeMongolian("ЗХУ-ын")).toBe("зэ хэ у-ын");
        // ⚠ THE REFEREE ITSELF CORROBORATES THE LETTER NAMES: mn.wiktionary transcribes ХДХВ as
        // `xeː.teː.xeː.ˈweː` — хэ дэ хэ вэ — which is a third source for four of the 33 espeak-derived
        // spellings, and the ONLY one of 1,463 referee tokens this layer alters.
        expect(phonemize("ХДХВ", "mn").trim()).toBe("xe te xe we");
        // A caps-set ordinary WORD and a pronounceable acronym are left alone by the phonotactic test.
        expect(normalizeMongolian("МОНГОЛ")).toBe("МОНГОЛ");
        expect(normalizeMongolian("ЮНЕСКО")).toBe("ЮНЕСКО");
    });

    // ── REVIEW FINDINGS. Each pins the BRANCH (trap 13): the shape that was wrong AND the neighbour that
    // was right, so a future "simplification" that collapses the two fails here rather than in a corpus diff.

    test("review 1: a phonotactically LEGAL acronym is a lexical fact, not an OOV one", () => {
        // Every one of these passes `isUnreadableMongolian` — vowel-bearing, legal onset and coda — so with
        // `acronymLetters` empty the seam handed them straight back and the deep orthography ATE the letters:
        // АНУ → [an], ОХУ → [ɔχ], МЭӨ → [me], ОУ → [ɔ]. ~38 retained instances, the corpus's second-largest cell.
        expect(normalizeMongolian("АНУ")).toBe("а эн у");
        expect(normalizeMongolian("ОХУ")).toBe("о хэ у");
        expect(normalizeMongolian("УИХ-ын тогтоол")).toBe("у и хэ-ын тогтоол");
        expect(normalizeMongolian("НҮБ")).toBe("эн ү бэ");
        expect(normalizeMongolian("ОУ-ын")).toBe("о у-ын");
        expect(phonemize("АНУ", "mn").trim()).toBe("a eŋ ʊ"); // was [an] — the ⟨У⟩ silently gone
        // ⚠ AND THE ERA MARKER, whose refusal at the header USED TO REST ON THIS SEAM ALREADY CLOSING IT.
        // It did not: `МЭӨ 390 онд` read as *me …*. The claim is true only because `мэө` is now listed.
        expect(normalizeMongolian("МЭӨ 390 онд")).toBe("эм э ө 390 онд");
        expect(normalizeMongolian("МЭ 200 он")).toBe("эм э 200 он");
        // THE REFUSED BRANCH. The criterion is an expansion written beside the acronym; these have none
        // (МУ, УБ) or are pronounceable acronyms said as WORDS (ДОХ = AIDS, МИАТ the airline).
        expect(normalizeMongolian("МУ-д оршин")).toBe("МУ-д оршин");
        expect(normalizeMongolian("УБ-ын бүсэд")).toBe("УБ-ын бүсэд");
        expect(normalizeMongolian("ДОХ")).toBe("ДОХ");
        expect(normalizeMongolian("МИАТ")).toBe("МИАТ");
    });

    test("review 2: the `евро` needle is the WORD plus a case suffix, never a prefix", () => {
        // `Европ` begins with `евро` at a word boundary, so a left-bounded needle matched inside it and the
        // trap-12 guard DELETED the sign with no word emitted — the exact failure the guard was written to
        // avoid, arriving one language later.
        expect(normalizeMongolian("Төсөв 500 € Европт")).toBe("Төсөв 500 евро Европт");
        expect(normalizeMongolian("500 € Евроазийн")).toBe("500 евро Евроазийн");
        // THE GUARDED BRANCH still guards: a case-marked `евро` in the window is the same statement said
        // twice, so the sign goes and the word stays.
        expect(normalizeMongolian("500 € еврогийн ханш")).toBe("500 еврогийн ханш");
        expect(normalizeMongolian("$2 тэрбум ам.доллар")).toBe("2 тэрбум ам доллар");
    });

    test("review 3: the space-grouping arm's right guard carries no `.` or `,` either", () => {
        // `GROUP_COMMA` one line above has always been `(?![\\d])`; the two arms of one step disagreed, and
        // this arm declined every clause-final grouped figure — two numbers read as four, with a pause in each.
        expect(normalizeMongolian("350 000, 160 000.")).toBe("350000, 160000.");
        expect(normalizeMongolian("105 000$ болно.")).toBe("105000 доллар болно.");
        // A decimal on the right is the same number's fractional part, so joining is right there too.
        expect(normalizeMongolian("350 000.5")).toBe("350000 цэг 5");
        // THE LEFT ANCHOR IS UNCHANGED and its cost is recorded, not paid: a three-group figure (×0 here)
        // joins only its first pair.
        expect(normalizeMongolian("1 234 567")).toBe("1234 567");
    });

    test("review 4: the currency window is not truncated by the operand's own decimal point", () => {
        // The guard was defeated by the figure it guards: the window collapsed to `$2`, the needle never
        // reached `доллар`, and the currency was said TWICE. The corpus writes 167 dot-decimals to 21 commas.
        expect(normalizeMongolian("$2.5 тэрбум ам.доллар")).toBe("2 цэг 5 тэрбум ам доллар");
        expect(normalizeMongolian("$2,5 тэрбум ам.доллар")).toBe("2 цэг 5 тэрбум ам доллар");
        // THE TRUNCATION BRANCH survives: a terminator NOT followed by a digit still ends the window, so a
        // new sentence that happens to mention the currency cannot suppress this one's sign.
        expect(normalizeMongolian("$45 байв. Доллар нь")).toBe("45 доллар байв. Доллар нь");
        // And a bare dot-decimal with no word in the window still reads the sign.
        expect(normalizeMongolian("$90.7 тэрбум")).toBe("90 цэг 7 тэрбум доллар");
    });

    test("review 5: the °F refusal is case-folded, because the class it reads from is", () => {
        // `f` is in `DEGREE_SCALE` as robustness; a case-sensitive `=== \"F\"` let it through to a confident
        // CELSIUS reading of a FAHRENHEIT figure while the uppercase twin was correctly refused.
        expect(normalizeMongolian("5°f")).toBe("5°f");
        expect(normalizeMongolian("5°F")).toBe("5°F");
        // The scales that ARE read — and ⟨С⟩ is Cyrillic U+0421 in four of the corpus's six instances.
        expect(normalizeMongolian("5°С")).toBe("5 хэм"); // Cyrillic С
        expect(normalizeMongolian("5°C")).toBe("5 хэм"); // Latin C
        expect(normalizeMongolian("5°c")).toBe("5 хэм");
    });

    test("review 6: a glued case suffix is ACCEPTED by the unit arm, and refused by the percent arm", () => {
        // The asymmetry is the FALLBACK, not the morpheme: refusing here would leave a bare [kʰɡ] cluster,
        // which is the defect the step exists to close, while a refused percent sign is merely silent.
        // A ⟨р⟩-final unit noun takes the writer's own suffix with no morphology — the ordinal step's
        // mechanism, and the corpus attests the results (`метрийн` ×7, `метртэй` ×2, `метрээр`).
        expect(normalizeMongolian("265 км-т")).toBe("265 километрт");
        expect(normalizeMongolian("100м-ийн")).toBe("100 метрийн");
        expect(normalizeMongolian("4000 м-ээс")).toBe("4000 метрээс");
        // `килограмм` is not ⟨р⟩-final and `килограммн` is not a word, so the suffix STAYS where it was.
        expect(normalizeMongolian("100 кг-н")).toBe("100 килограмм-н");
        // The percent arm keeps the opposite policy on the same shape, and still does.
        expect(normalizeMongolian("5%-д")).toBe("5%-д");
        expect(normalizeMongolian("5%-ийг")).toBe("5 хувийг");
    });

    test("the whole pipeline, through phonemize", () => {
        expect(phonemize("3-р сарын 29% нь", "mn").trim()).toBe("ɢʊrəwtʊɢaːr sarəŋ χɔrəŋ jes χuw n");
        expect(phonemize("Дундаж температур нь -25°С", "mn").trim()).toBe("tʊntət͡ʃ tʰempʰeratʰʊr n χasəχ χɔrəŋ tʰaf xem");
    });
});
