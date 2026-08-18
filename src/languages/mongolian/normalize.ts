/**
 * Mongolian / Khalkha (mn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE SOURCING SITUATION, STATED PLAINLY. There is NO FLEURS corpus for Mongolian. The evidence is
 * `tools/corpus/mined/mn.jsonc` (233,098 paragraphs of the mn.wikipedia dump, 452 retained) plus `attest.ts`
 * against mn.wikipedia — WHICH IS THE WIKI THE ARTIFACT WAS MINED FROM, so that is a bigger sample of ONE
 * source and never two. What Mongolian has that Luganda did not is espeak: `dictsource/mn_list` ships a
 * numeral block, a SYMBOL block and a 35-row Cyrillic letter-name block, so several readings below are
 * corroborated by two genuinely independent authorities (espeak and the wiki) rather than one.
 *
 * ⚠ AND THE WIKI STATES TWO OF THEM DEFINITIONALLY, which is the thing a written corpus almost never carries
 * (playbook §5e's Igbo lesson — writers type `$45`, they never write down how they would say it):
 *
 *     `$ тэмдэг нь ам.долларт зориулан хэрэглэгддэг ба мөнгөн дүнгийн урд талд бичигддэг.
 *      Жишээлбэл "$45"-ийг "дөчин таван доллар" ХЭМЭЭН УНШИНА.`      …"is READ AS forty-five dollars"
 *     `Үүнийг ихэвчлэн ХУВИЙН ТЭМДЭГ (%) ашиглан тэмдэглэдэг.`        the % article naming its own sign
 *
 * The first settles both the word AND the position (postposed) for `$`; the second names `%`. Every unit
 * article does the same for its abbreviation in BOTH scripts — `Километр (Тэмдэглэгээ: км, km)`,
 * `Килограмм (тэмдэглэгээ: монгол. кг, англи. kg)`, `Сантиметр (товчоор см)`, `Метр … товчлол нь м` — which
 * is the strongest sourcing a unit table can have: the key and the word in one sentence.
 *
 * ⚠ NO SHARED SYMBOL TIER IS WIRED, AND THAT IS A MEASUREMENT, NOT A DEFAULT. Playbook trap 47 asks whether
 * the tier CAN say it, and for the highest-traffic rule here it cannot: Mongolian glues a CASE SUFFIX to the
 * percent sign (`67%-ийг`, `7.7%-иар`, `86,6 %-нь`), and the reading is not `хувь` plus a token — it is the
 * suffix absorbed into the word's own oblique stem, `хув` + `ийг` → *хувийг*. That is trap 14 (agreement
 * cannot be applied to digits, and the affected operand must become WORDS inside the rule), and `unitPer` /
 * `SymbolData.percent` are invariant strings. The exponent is preposed onto the unit noun as a separate word
 * (`квадрат километр`, `куб метр`), the degree word names no scale, and the ordinal is a whole morphological
 * series — so every rule below is local and the tier would carry one of them.
 *
 * ── WHAT WAS BROKEN, with the whole-corpus count from the artifact's own `counts` block ──────────────────────
 *
 *     1,208,544   → *neɡ , χɔjʊr t͡sʊːŋ naim , …*  ONE number read as three, with two pauses  grouped ×4928
 *     4.2         → *tɵrɵf . χɔjʊr*    a SENTENCE BREAK inside a number                       decimals ×12430
 *     29% нь      → *χɔrəŋ jes n*      the sign silent                                        percent ×3006
 *     $45 · 7,589 $ → the sign silent                                                         currency ×204
 *     1300 м · 10 кг → *… m* / *… kʰɡ*  a bare CONSONANT in the phoneme stream                units ×103
 *     69585 км²   → *… kʰm*   raw key, exponent silent; and `3,780km²` reached the ENGLISH
 *                             fallback as *ˈʊkm skwˈɛɹd* — trap 56's silent class            exponent ×1416
 *     5°С         → *tʰaf s*  the degree silent and Cyrillic ⟨С⟩ read as a bare [s]           degrees ×474
 *     -25°С       → *χɔrəŋ tʰaf s*     THE SIGN DROPPED, so the reading INVERTS               signed-number ×1237
 *     3-р сарын   → *ɢʊrəf r sarəŋ*    the ordinal suffix as a bare [r], on the CARDINAL      ordinal-latin ×2522
 *     Ц.Элбэгдорж → *t͡sʰ . eɮpeɡtɔrt͡ʃ*  a bare [t͡sʰ] plus a spurious SENTENCE BREAK          dotted ×4228
 *     ам.доллар   → *am . tɔɮɮər*      a sentence break inside one word                       abbrev ×40855
 *     ДНБ · ХХК   → *tnp* / *xxkʰ*     vowel-less clusters; and the deep-orthography vowel
 *                                      deletion eats acronym letters — АНУ → *an*, МЭӨ → *me* initialism ×53329
 *
 * ⚠ THE DEEP ORTHOGRAPHY IS WHY THE INITIALISM SEAM MATTERS MORE HERE THAN IN A SIBLING. `mongolian.ts`
 * deletes a word-final short vowel and reduces every non-initial one — correct for words, destructive for a
 * letter run, so an acronym does not merely read as a cluster, it LOSES LETTERS (`АНУ` → [an], `ОХУ` → [ɔχ],
 * `МЭӨ` → [me], `БНХАУ` → [pŋχa]). That is a reading, not a leak, and no counter sees it (trap 56).
 * ⚠ AND IT IS ALSO WHY THE PHONOTACTIC TEST CANNOT CARRY THIS SEAM ALONE HERE, which the first cut assumed
 * and review disproved: `АНУ`, `ОХУ`, `УИХ`, `НҮБ`, `МЭӨ`, `ОУ` are all vowel-bearing and phonotactically
 * LEGAL, so the OOV half passes them through and they kept the readings on that very line. `acronymLetters`
 * is the lexical half and it is populated at step 11 — the seam needs both halves or it closes the acronyms
 * that look broken and leaves the ones that are.
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the count and the check that refused it ────────────────────────
 *
 *   · NO RANGE RULE, AND IT IS THE LARGEST REFUSAL HERE (`ranges` ×24010; 112 digit-hyphen-digit shapes in the
 *     retained text). Mongolian reads a span with the ABLATIVE on the first operand plus `хүртэл`/`хооронд`
 *     — the corpus writes exactly that with a spelled operand (`35-аас доош`, `60-аас дээш`, `0-ээс ялгаатай`,
 *     `1850$ – 1950 $ ХООРОНД хэлбэлзнэ`) — and the ablative allomorph is chosen by the harmony of the SPOKEN
 *     numeral, which does not exist until the numeral is words. That is trap 14 in its pure form, and unlike
 *     the percent case the morphology is SUPPLETIVE, not a stem plus the writer's own suffix: зуу→зуунаас
 *     restores a hidden ⟨н⟩, хорь→хориос drops the ⟨ь⟩, ес→есөөс rounds the linking vowel. Nothing in this
 *     tree attests those forms, so composing them would be inventing morphology, not composing from attested
 *     pieces (the Fula `e teemedere` bar). The refusal is PRICED (trap 53): `1206-1635` reads today as two
 *     juxtaposed cardinals with no connective and no pause, which is neutral — the rule would replace a
 *     missing connective with a possibly-wrong one. `DROP minus` and `DROP exponent` therefore stay RED in
 *     `mine.ts scan`: they are that hyphen, and they are a sourcing gap with a reading still to find.
 *   · NO GENERAL CASE-SUFFIX RULE (`2019-нд`, `5-аас`, `67-ийг`, `1990-ээд` — 24 `-нд`, 5 `-ны`, 5 `-аас`,
 *     4 `-ийг`, 4 `-д`, 4 `-аад`, 3 `-т`, 3 `-ний` in the retained text). Same wall as the range and the same
 *     refusal, with ONE exception carved out below because the writer supplies the whole suffix and the stem
 *     is regular: the percent word. Trap 15 was measured rather than assumed — `grep -oE '[0-9] (нд|ны|ний|
 *     ийн|ийг|аас|ээс|д|т|н|г|р)( |[.,;:]|$)'` beside the glued count returns exactly ONE spaced instance in
 *     452 segments (`6 сарын 10 нд`), against ~60 glued. A spaced arm for a morpheme the corpus spaces once
 *     is a misfire generator (trap 9), so there is none.
 *   · NO PLUS WORD, THOUGH THE WORD IS NOW SOURCED — and that combination is the point. `нэмэх` is attested
 *     ×34/15 on mn.wikipedia in the right paradigm (`нэмэх бета задрал`, `протон (нэмэх цэнэгтэй)`, beside
 *     `хасах` in the same articles). What is not sourced is that it fits ANY of this corpus's `+` senses,
 *     and there are three: a POSITIVE TEMPERATURE (`+41 хэм`, `+37`, `+17-21 хэм`, `+40 O C`), an "over/more
 *     than" (`250000+орчим`, `160 000+ орчим`, `300000+ орчим`, `+100 кг-н аварга` and `+78 кг` — judo weight
 *     CLASSES), and arithmetic (`12 + 16 × 2`, `RPG + FPS`, the GDP identity). `нэмэх` says the first and the
 *     third and not the second. The playbook's asymmetry decides the first: omitting a plus is LOSSLESS and
 *     omitting a minus INVERTS, so the minus below is read and the plus is left. `DROP math-sign` stays RED.
 *   · NO TIMES SIGN, and the refusal is a SENSE check that failed (`×` ×5 — `1000 W × 24 цаг × 365`). `үржих`
 *     is attested ×24/18 and every single example is BIOLOGICAL REPRODUCTION — *өсөж үржих* (grow and
 *     multiply), bacteria, breeding, `үржих үзүүлэлт`. That is the `ilo dollar` / `ki digirii` shape: a green
 *     count and the wrong word. espeak's `mn_list` has no `×` row either.
 *   · NO EQUALS (`=` ×22, of which ~8 are genuine maths). espeak gives `= tentse:` and the corpus gives
 *     `тэнцүү` ×2 — and BOTH of its instances take the comitative on their argument (`1 mol N A -ТЭЙ …
 *     тэнцүү`, `10 их наяд ам.доллар-ТАЙ тэнцэж`), i.e. the operand is case-marked and the verb is final.
 *     There is no invariant infix to emit between two operands. Trap 14 as a reason to decline, the same
 *     conclusion Luganda reached from noun-class concord.
 *   · NO AMPERSAND (`&` ×27, of which 22 are HTML entities `core/markup.ts` decodes above this layer). All
 *     five real ones are inside FOREIGN Latin titles — `Mr. & Mrs. Smith`, `C&C Red Alert`,
 *     `Warcraft: Orc & Humans`, `Global Banking & Finance Review` — so a Mongolian conjunction would be
 *     inserted into an English film title. espeak's `& ampersand` is the English word transliterated and is
 *     not a reading for this slot.
 *   · NO CLOCK (`clock` ×2967; 14 digit-colon-digit in the retained text). Reading them settles it the way it
 *     settled `ilo`, `hil` and `lg`: six are SPORTS TIMES with their result noun already in front
 *     (`1:53.43 амжилт`, `2:26.65 амжилтаар`, `30:05.6 амжилт`, `4:39:51.79`), four are census brackets
 *     (`0-14: 40.8%`, `15-64:56.1%`), and only TWO are a time of day — and both already carry `цагт`
 *     ("at N o'clock") after them, so the hour noun is not missing. A `\d{1,2}:\d{2}` rule would fix 2 and
 *     claim 10. `минут` is never written after a colon anywhere in the retained text.
 *   · NO ERA PHRASE (`era-marker` ×152; `МЭӨ` ×4, `МЭ` ×2, `НТӨ` ×1). Expanding `МЭӨ` to `манай эриний өмнө`
 *     is a fixed phrase, and although the wiki's era article does write it out (×29/20), espeak does not and
 *     the retained text never puts the phrase where the abbreviation stands — so the LETTER reading is taken
 *     and the phrase is not. ⚠ THE EARLIER VERSION OF THIS BULLET REFUSED THE PHRASE ON THE GROUND THAT "the
 *     seam below already stops them reading as [me]", AND EXECUTION CONTRADICTED IT: `МЭӨ` is vowel-bearing
 *     and phonotactically legal, so the OOV test passed it, `acronymLetters` was empty, and `МЭӨ 390 онд`
 *     came out *me …* with the ⟨Ө⟩ deleted — the exact reading the bullet claimed had been closed. It is
 *     closed now because `мэө` and `мэ` are LISTED (see the seam at step 11), not because anything derived
 *     it. A refusal that leans on another rule has to be run against that rule, not asserted.
 *   · NO SCALE NAME. `Цельс`/`Фаренгейт`/`цельсий` are ×0 in every source this tree has. The degree rule
 *     below is not half a match (trap 53) — it emits `хэм`, which is the language's OWN complete rendering of
 *     the slot and names no scale by design: this corpus writes `-15.6 хэм хүйтэн`, `+41 хэм хүртэл`,
 *     `95 хэм хүрдэг` in the very sentences where it elsewhere writes `-25°С`. What IS declined is `°F`
 *     (×2, both parenthetical glosses beside a Celsius figure), because there `хэм` would be a scale claim.
 *   · NO RATE (`rate` ×728; `м/с` ×5, `м3/с` ×2, `km/h` ×0). `Метр/секунд (товчилбол м/с)` names the
 *     abbreviation but not how the slash is SAID, and Mongolian's idiom is a prefixed locative
 *     (*секундэд N метр*), not "A per B" — trap 47 reason 1. The unit step therefore REFUSES A KEY FOLLOWED
 *     BY `/` outright rather than reading the numerator and dropping the denominator (trap 53's whole-match
 *     rule); `116 м³/с` keeps exactly the reading it had.
 *   · NO `kW` (×8, all in one coal-energy paragraph), no `mb` (×1), no `т`/`г`/`га`. `киловатт` is ×0 in
 *     every source. Cyrillic ⟨т⟩ and ⟨г⟩ are declined as one-letter keys on the trap-46 rule: they buy
 *     nothing here (digit-adjacent ×0) and they are two of the commonest letters in the language.
 *   · NO `₮` RULE. `төгрөг` is well attested (×93/16, and its article names the sign: `тэмдэг: ₮`), but the
 *     sign itself is ×0 in the corpus — playbook §5e's rule that a currency name is checked only if its SIGN
 *     is written. Recorded here so the next reader does not re-source it.
 */
import { numberToWords } from "./numbers.ts";
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";

/** Mongolian Cyrillic letters, upper and lower. Used as the "inside a word" guard everywhere below —
 *  `\b` is ASCII-defined and finds NO boundary against Cyrillic, which is how `core/initialisms.ts` was once
 *  a total no-op for Russian (США → [sʂa]). Every boundary here is an explicit lookaround (trap 1). */
const NOT_LETTER = "(?![\\p{L}\\p{M}])";
const NOT_LETTER_BEFORE = "(?<![\\p{L}\\p{M}])";

// ---------------------------------------------------------------------------------------------------
// 1. PERSONAL INITIALS — `Ц.Элбэгдорж`, `Б.Б.Полынов`
// ---------------------------------------------------------------------------------------------------

/**
 * Mongolian writes a personal name as INITIAL-DOT-SURNAME with no space, and it is the dominant shape of the
 * `dotted` cell — 40 instances in 452 retained segments (`Ц.Элбэгдорж` ×3, `Ш.Лувсанвандан` ×2, `А.Дангаасүрэн`,
 * `Л.Эрхэмжамц`, `Б.Б.Полынов`, `В.И.Ликовский` …). Each one costs TWO defects: the lone capital reaches the
 * g2p as a vowel-less consonant (`Ц.Элбэгдорж` → *t͡sʰ . eɮpeɡtɔrt͡ʃ*) and its dot becomes a SENTENCE BREAK
 * inside the name.
 *
 * ⚠ `core/initialisms.ts` CANNOT CLAIM THIS SHAPE, and its own header says so. `INITIAL_RUN` needs two or
 * more initials, so `Б.Б.Полынов` is covered but the far commoner single `Ц.` is not; `LONE_INITIAL` needs
 * SPACES on both sides (`George W. Bush`), which this orthography does not write. The file explicitly invites
 * the language to pre-empt it locally — *"a language that finds this costly can pre-empt it in its own
 * normalize.ts"* — so this runs FIRST and consumes the run before that pass sees it.
 *
 * The guard is the surname: 1–3 initials must be followed by a capital PLUS a lowercase letter. That is what
 * keeps a genuine sentence end out of it — `…байна.Дараа` has a multi-letter word before the dot, and the
 * lookbehind requires the capital to open the token.
 */
const INITIALS = new RegExp(`${NOT_LETTER_BEFORE}((?:[А-ЯӨҮЁ]\\.){1,3})(?=[А-ЯӨҮЁ][а-яөүё])`, "gu");

// ---------------------------------------------------------------------------------------------------
// 2. THE ABBREVIATION DOT
// ---------------------------------------------------------------------------------------------------

/**
 * A dot BETWEEN two lowercase Cyrillic letters is an abbreviation dot, never a clause end: `ам.доллар` ×8
 * (American dollar) → *am . tɔɮɮər*, a sentence break inside one word, plus `д.т` ×8, `х.ө` ×4, `г.м` ×2
 * (*гэх мэт*, "etc."), `з.у` ×2, `с.км`, `т.д`. It becomes a SPACE rather than nothing, so the two halves
 * stay two tokens and the reduction rules of `mongolian.ts` treat each as its own word — which is what they
 * are.
 *
 * Case is the whole discriminator, and it is safe in both directions here: a sentence end is followed by a
 * CAPITAL, and step 1 has already taken the initial-plus-surname shape out of the text.
 */
const ABBREV_DOT = /(?<=[а-яөүё])\.(?=[а-яөүё])/gu;

// ---------------------------------------------------------------------------------------------------
// 3. DE-GROUPING — runs before every rule that reads a number
// ---------------------------------------------------------------------------------------------------

/**
 * ⚠ MONGOLIAN WRITES THE COMMA AS BOTH A THOUSANDS SEPARATOR AND A DECIMAL POINT, and the retained text uses
 * both freely. The digit count after the comma is the discriminator, and it is clean:
 *
 *     comma + exactly 3 digits   ×53   `7,589 $` · `4,704.4 км²` · `131,635 км²` · `74,042.37 км²`  GROUPING
 *     comma + 1–2 digits         ×21   `$2,5 тэрбум` · `86,6 %` · `4,5%-ийг` · `11,3м³/с`           DECIMAL
 *     comma + 4 digits           ×2    `1974,1977 онуудад` · `1,1002-1005`                          A LIST
 *
 * The 4-digit row is why the group arm demands EXACTLY three and refuses a fourth: `1974,1977 онуудад` is a
 * comma-separated list of two years, and a loose `\d+,\d+` rule would fuse them into one 8-digit number.
 *
 * The SPACE-grouped arm is measured rather than assumed (trap 22): `[0-9]+ [0-9]{3}(?![0-9])` returns exactly
 * three matches in the retained text — `350 000`, `160 000`, `105 000$` — all genuine groupings and no
 * counter-example, so the arm is admitted with the leading part held to 1–3 digits.
 *
 * ⚠ THE SPACE ARM'S RIGHT-HAND GUARD CARRIES NO `.` OR `,` EITHER, AND THAT IS THE SAME REVIEW FINDING THE
 * UNIT STEP TOOK (and Luganda before it) ARRIVING ON A THIRD ARM. It carried both in the first cut, which
 * made the two arms of ONE step disagree — `GROUP_COMMA` one line above has always been `(?![\d])` — and it
 * declined every CLAUSE-FINAL space-grouped figure: `350 000, 160 000.` came out as
 * *ɢʊrwəŋ t͡sʊːŋ tʰæw tʰeɡ , t͡sʊːŋ t͡ʃar tʰeɡ .* — "three hundred fifty, zero, one hundred sixty, zero",
 * two numbers read as four with a spurious pause in each. The `.`/`,` bought nothing: a decimal on the right
 * (`350 000.5`) is a fractional part of the SAME number and joining the group is exactly right, and a figure
 * on the LEFT of a separator is still rejected by the left anchor, which is untouched. A guard is only free
 * when it rejects something.
 *
 * ⚠ THE LEFT ANCHOR IS KEPT, AND ITS KNOWN COST IS RECORDED RATHER THAN PAID. Because it rejects a digit on
 * the left, a THREE-group figure joins only its first pair: `1 234 567` → `1234 567`. That is ×0 in the
 * retained text (every space-grouped figure here is one group) and the anchor is what holds the arm to the
 * shape that WAS measured — a `\d+` left side would let the arm walk into any digit-space-digit sequence,
 * which this corpus writes for other reasons. Widening it is a change that needs its own measurement, not a
 * tidy-up.
 */
const GROUP_COMMA = /(?<=\d)[,](?=\d{3}(?![\d]))/gu;
const GROUP_SPACE = /(?<![\d.,])(\d{1,3}) (\d{3})(?!\d)/gu;

// ---------------------------------------------------------------------------------------------------
// 4. ORDINALS — `3-р сарын`, `21-р байранд`
// ---------------------------------------------------------------------------------------------------

/**
 * `-р` after a figure is the ORDINAL suffix, an abbreviation of `-дугаар`/`-дүгээр`, and it is the single
 * commonest glued morpheme in the corpus: 72 of the ~130 digit-hyphen-Cyrillic instances. It reads today as a
 * bare [r] appended to the ABSOLUTE cardinal — `3-р сарын` → *ɢʊrəf r sarəŋ* — which is wrong twice over, and
 * `ordinal-latin` is ×2522 corpus-wide.
 *
 * ⚠ NOTHING IS INVENTED: THE SERIES IS ATTESTED IN THIS CORPUS'S OWN TEXT, spelled out beside the figures.
 * `нэгдүгээр` ×5, `хоёрдугаар` ×5, `гуравдугаар` ×2, `дөрөвдүгээр`, `тавдугаар` ×4, `Зургаадугаар` ×2,
 * `долоодугаар`, `аравдугаар` ×2 — and the wiki writes `2 дугаар`, `8 дугаар`, `7 дугаар` with the marker
 * SPACED off the figure, which is the same morpheme without the hyphen.
 *
 * ⚠ AND THE RULE IS COMPOSED, NOT TABULATED (trap 13). Every one of those eight is `absolute cardinal +
 * дугаар/дүгээр`, with the allomorph chosen by the harmony class this manifest ALREADY declares
 * (`backVowels: "аоуяёы"`). Running the rule over the whole numeral inventory reproduces all eight attested
 * spellings and supplies the two the corpus does not happen to write (`найм` → наймдугаар, `ес` → есдүгээр)
 * from the same rule rather than from a guess — the constructive half of trap 8. Above ten it falls out of
 * `numberToWords`, which already renders every word but the last ATTRIBUTIVE, so `13-р` → *арван гуравдугаар*
 * and `21-р` → *хорин нэгдүгээр*: the marker lands on the last word only, which is the branch the corpus's
 * `19-р`, `21-р`, `79-р`, `80-р`, `82-р` exercise and its 1–10 instances do not.
 *
 * ⚠ THE TRAILING LETTERS ARE RE-EMITTED, NOT DROPPED (trap 10). `9-рт` is the ordinal plus the dative, and
 * because the ordinal word ends in `-р` the written suffix glues on with no morphology at all: *есдүгээрт*.
 * That is the one place where a Mongolian case suffix can be handled honestly here, and it is honest only
 * because the stem is vowel-final-plus-⟨р⟩ and the writer supplied the whole suffix.
 *
 * The lookahead demands LOWERCASE after the hyphen, which is what excludes the corpus's list markers
 * (`7-Зургаадугаар`, `1-Москва`, `5-Ан`, `2-Бүс`) — those are a numbered entry, not an ordinal.
 */
const ORDINAL = new RegExp(`(?<![\\d.,\\p{L}\\p{M}])(\\d{1,4})-р(т?)${NOT_LETTER}`, "gu");
const BACK_VOWELS = new RegExp(`[${MANIFEST.backVowels}]`, "u");

/** `n` → its Mongolian ordinal word string. The marker goes on the LAST word of the cardinal only; its vowel
 *  harmonises with that word (`гурав` → гуравдугаар, `ес` → есдүгээр), which is the same back/front test the
 *  g2p uses for г/х and for the reduced-vowel quality. */
function ordinalWords(n: number): string | undefined {
    const cardinal = numberToWords(n);
    if (cardinal === "") return undefined; // numberToWords refuses above 2^53 — so does this
    const words = cardinal.split(" ");
    const last = words[words.length - 1]!;
    words[words.length - 1] = last + (BACK_VOWELS.test(last) ? "дугаар" : "дүгээр");
    return words.join(" ");
}

// ---------------------------------------------------------------------------------------------------
// 5. PERCENT — and the one case suffix this layer can honestly read
// ---------------------------------------------------------------------------------------------------

/**
 * `хувь`, POSTPOSED. Two independent sources: espeak's `mn_list` symbol block declares `% xUvi` outright, and
 * mn.wikipedia's own percentage article names the sign with it — `Үүнийг ихэвчлэн ХУВИЙН ТЭМДЭГ (%) ашиглан
 * тэмдэглэдэг`. The slot is confirmed a third time by the corpus writing the word where the symbol would go:
 * `84 орчим ХУВИЙГ эзлэх`, `85 ХУВЬ`, `80 гаруй ХУВЬ`, `74,04 ХУВЬ нь`, `50.9 ХУВИЙГ` — 15 numeral
 * collocations in the retained text, always after the figure. (The bare token is also `Хувь заяа`, "fate";
 * the numeral collocation is what disambiguates it — trap 37.)
 *
 * ⚠ THE SUFFIX ARM IS TRAP 14 SOLVED RATHER THAN DECLINED, and it is the reason this language does not use
 * the shared tier. The corpus glues the case suffix to the SIGN — `67%-ийг` ×2, `46%-ийг`, `35%-ийг`,
 * `3.5%-ийг`, `30%-ийг`, `4,5%-ийг`, `7.7%-иар`, `+0.6%-иар`, `86,6 %-нь` — and the suffix has to end up on
 * the WORD, which does not exist until the sign is read. It works here because `хувь`'s oblique stem is
 * regular: the ⟨ь⟩ drops and the writer's own suffix attaches unchanged, `хув` + `ийг` → *хувийг*,
 * `хув` + `иар` → *хувиар*. Nothing is composed that the writer did not already spell.
 *
 * `-нь` is the separate arm because it is not a case suffix at all — it is the possessive PARTICLE, a
 * free-standing word (espeak's `mn_list` lists `нь` among its clitics), so it takes the citation form and a
 * space: `86,6 %-нь` → *86,6 хувь нь*.
 *
 * ⚠ THE BARE ARM REFUSES A FOLLOWING HYPHEN, WHICH IS TRAP 53 APPLIED TO THIS RULE'S OWN EDGE. The whole
 * suffix inventory the corpus writes is `-ийг` ×6, `-иар` ×2 and `-нь` ×2, and those three have arms. Any
 * OTHER suffix (`%-д`, `%-аас`) would otherwise fall through to the bare arm, which consumes the sign and
 * strands the suffix as a bare consonant beside `хувь` — half a match, and worse than the reading it
 * replaced. Refusing it leaves such a figure exactly as it read before.
 *
 * ⚠ AND THERE IS DELIBERATELY NO REDUNDANCY GUARD HERE, unlike the currency step, BECAUSE THE MEASUREMENT
 * SAYS SO. `%[^.!?]{0,25}хув` returns exactly ONE hit in the retained text and it is a false positive:
 * `ядуурлын түвшин 2.4% байсан бол ядуурлын ХУВЬ …` — the second `хувь` is the ordinary noun "rate" in the
 * next clause, not a restatement of the sign. That is Luganda's review finding #2 (a guard needle that is
 * also an ordinary word of the language) caught before it shipped rather than after.
 */
const PERCENT_SUFFIX = /(\d)\s?%-(и[а-яөүё]+)/gu;
const PERCENT_NI = /(\d)\s?%-нь/gu;
const PERCENT = /(\d)\s?%(?!-)/gu;

// ---------------------------------------------------------------------------------------------------
// 6. CURRENCY
// ---------------------------------------------------------------------------------------------------

/**
 * `$` → `доллар`, POSTPOSED, and both facts come from one sentence in the corpus that is ABOUT the reading
 * rather than merely using it:
 *
 *     `Жишээлбэл "$45"-ийг "дөчин таван доллар" ХЭМЭЭН УНШИНА.`   — "$45" is READ AS "forty-five dollars"
 *
 * espeak's symbol block agrees independently (`$ dOllar`), and `доллар` is ×90/20 on the wiki with the
 * monetary sense read (`Нэг Америк доллар нь 100 центэд хуваагддаг`). The sign is written on BOTH sides of
 * the figure in this corpus — `$45`, `$606,000`, `$22850` before; `7,589 $`, `12,880 $`, `105 000$`,
 * `1900$` after — and the reading is postposed either way.
 *
 * ⚠ THE REDUNDANCY GUARD IS TRAP 12, AND ITS NEEDLE IS WORD-BOUNDED AND CASE-FOLDED — the two ways Luganda's
 * equivalent failed. `$2,5 тэрбум ам.доллар` and `10 их наяд ам.доллартай` state the currency TWICE, once as
 * the sign and once as the word, so the reading must say it ONCE in the position the language puts it: drop
 * the sign, keep the word. The window is the 40 characters after the figure, which is what `тэрбум`/`сая`
 * (a magnitude word) fits inside; the needle matches the inflected forms (`долларт`, `доллартай`,
 * `долларын`) because Mongolian never writes the bare stem in running text, and it is bounded on the LEFT so
 * it cannot fire inside a longer word.
 *
 * `€` gets the same treatment on one instance (`€500.8 тэрбум`): `евро` is ×2 in the retained text and
 * postposed in exactly this slot (`1 евро = 3.4528 литийн ханшаар`). `US$` needs no arm — Latin `US` is
 * outside this engine's TOKEN class and already contributes nothing.
 *
 * ⚠ AND THE `евро` NEEDLE IS AN INFLECTION LIST, NOT A PREFIX, WHICH IS TRAP 12 ARRIVING ANYWAY ON THE ARM
 * THE COMMENT ABOVE THOUGHT IT HAD SAVED. Left-bounding is not enough when the needle is also the language's
 * productive prefix for EUROPE: `Европ` begins with `евро` at a word boundary, so `Төсөв 500 € Европт` matched
 * the guard, DROPPED the sign and emitted no word at all — the sign silently deleted, which is worse than the
 * reading it replaced. A right boundary alone cannot fix it, because the currency itself is case-marked
 * (`еврогийн` ×2). The corpus's `евро` continuations are the discriminator and they are few:
 * `Европын` ×12, `Европ` ×4, `Европт` ×1, `Евроази(йн)` ×2 against `евро` ×2 and `еврогийн` ×2. So the needle
 * matches the WORD `евро` plus an optional CASE SUFFIX and then demands a non-letter — an allowlist of the
 * regular vowel-final paradigm rather than a blocklist of `п`, which would still have claimed `Евроази` and
 * would lose to the next `Евро-` compound. `доллар` needs none of this: it is consonant-final and no
 * Mongolian word begins with it, so anything after it IS a suffix.
 */
/**
 * ⚠ A MAGNITUDE WORD IS PART OF THE QUANTITY, AND THE CURRENCY NAME GOES AFTER THE WHOLE OF IT. Found by
 * READING the corpus diff, not by any counter: the first cut emitted `$15 саяыг` as *арван тав ДОЛЛАР саяыг*
 * — "fifteen dollars million" — which is the id `US$` defect the playbook records under "closing a DROP is
 * not finished until you read the READING", scoring clean on the differential the whole time. This corpus
 * states its own order three times over, in the sign-less form: `$2,5 тэрбум АМ.ДОЛЛАР`, `26,8 тэрбум
 * АМ.ДОЛЛАР`, `10 их наяд АМ.ДОЛЛАРТАЙ` — number, magnitude, then the currency.
 *
 * ⚠ AND A SUFFIXED MAGNITUDE REFUSES THE WHOLE MATCH (trap 53) RATHER THAN TAKING HALF OF IT. When the
 * writer uses the sign, they glue the case to the MAGNITUDE (`$15 саяыг`, `$55 тэрбумд`, `$6 тэрбумд`) —
 * but the corpus's own spelled-out instances put that case on the CURRENCY word (`ам.доллартай`), which is
 * trap 14 again and beyond this layer. So a BARE magnitude gets the reading (`$90.7 тэрбум` →
 * *90.7 тэрбум доллар*, ×4 here) and a suffixed one keeps the reading it already had (×3). Emitting
 * `саяыг доллар` would put the case on the wrong word of a phrase whose order this rule exists to fix.
 */
const MAGNITUDES = [MANIFEST.numbers.thousand, MANIFEST.numbers.million, MANIFEST.numbers.billion, "наяд"];
// Captured as part of the match so it is CONSUMED and re-emitted (trap 10), never copied out of the tail and
// left behind as a second copy. The trailing `[\p{L}\p{M}]*` is what makes a case-marked magnitude VISIBLE to
// the callback, which then refuses.
const MAG = `(?:[  ](?:их[  ])?(?:${MAGNITUDES.join("|")})[\\p{L}\\p{M}]*)?`;

const SAID_CURRENCY = new RegExp(
    `${NOT_LETTER_BEFORE}(?:доллар|евро(?:гийн|гоор|нууд|той|оос|[гдт])?${NOT_LETTER})`, "iu");
/**
 * The redundancy window: the 40 characters after the figure, TRUNCATED AT THE FIRST CLAUSE TERMINATOR. The
 * truncation is what stops a NEW sentence that happens to mention the currency from suppressing this one's
 * sign — a guard that reaches across a full stop is not reading the same statement any more.
 *
 * ⚠ THE TERMINATOR MUST NOT BE THE OPERAND'S OWN DECIMAL POINT, and in the first cut it was — the guard was
 * defeated by the very figure it is guarding. `$2.5 тэрбум ам.доллар` truncated the window at the dot inside
 * `2.5`, so the window was the two characters `$2`, the needle never reached `доллар`, and the currency was
 * said TWICE: *хоёр цэг тав тэрбум ДОЛЛАР ам ДОЛЛАР*. Only the comma-decimal form (`$2,5 тэрбум ам.доллар`)
 * was correct, and the corpus writes 167 dot-decimals against 21 comma-decimals — its `$` figures include
 * `$628.9`, `$90.7`, `$17.4`. A terminator followed by a DIGIT is a decimal point, not a clause end; step 10
 * has not run yet, so the dot is still there to be mistaken for one.
 */
const currencyWindow = (whole: string, off: number): string =>
    whole.slice(off, off + 40).split(/[.!?…](?!\d)/u)[0]!;
const CURRENCY_BEFORE = new RegExp(`([$€])[  ]?(\\d+(?:[.,]\\d+)?)(${MAG})`, "gu");
const CURRENCY_AFTER = new RegExp(`(\\d+(?:[.,]\\d+)?)[  ]?([$€])(${MAG})`, "gu");
const CURRENCY_WORD: Readonly<Record<string, string>> = { $: "доллар", "€": "евро" };
const MAGNITUDE_SUFFIXED = new RegExp(`(?:${MAGNITUDES.join("|")})[\\p{L}\\p{M}]`, "u");

// ---------------------------------------------------------------------------------------------------
// 7. DEGREES
// ---------------------------------------------------------------------------------------------------

/**
 * `хэм`. This corpus writes the WORD in the very sentences where it elsewhere writes the SYMBOL, which is the
 * strongest evidence available for a slot: `-15.6 ХЭМ хүйтэн`, `14.7 ХЭМ дулаан`, `95 ХЭМ хүрдэг`,
 * `+41 ХЭМ хүртэл халж`, `-40 ХЭМ хүртэл хүйтэрдэг`, `16-19 ХЭМ`, `+17-21 ХЭМ` — 8 in the retained text,
 * against `градус` ×2 in the same slot (`1 градус аар нэмэгдэх`, `-37 градус`). `хэм` is taken on the count
 * and `градус` recorded beside it as the attested competitor.
 *
 * ⚠ THE SCALE LETTER IS CONSUMED AND NOT REPLACED, AND THAT IS NOT HALF A MATCH (trap 53). `хэм` is
 * scale-neutral by design — it is what a Mongolian weather sentence says, and the eight attestations above
 * are the same temperatures the symbol form writes with ⟨С⟩. No scale NAME is sourceable (`Цельс`,
 * `цельсий`, `Фаренгейт` are ×0 everywhere), so `°F` — both instances parenthetical glosses beside a Celsius
 * figure — is REFUSED WHOLE rather than read as a bare degree, because there the scale is the content.
 *
 * ⚠ ⟨С⟩ IS CYRILLIC IN FOUR OF THE SIX SCALE-LETTER INSTANCES (U+0421, not U+0043), which is invisible and
 * is exactly why a Latin-only `°C` arm would have read `5°С` as *tʰaf s* and reported clean. Both are in the
 * class.
 *
 * ⚠ THE COORDINATE GUARD IS THE WHOLE RIGHT-HAND SIDE. Six instances in the retained text are latitude and
 * longitude — `47°49'`, `49°10'`, `102°2…`, plus four written with a SUPERSCRIPT ZERO standing in for the
 * sign (`110⁰04¹05¹¹`, the same imported/OCR'd substitution the playbook's sextant article produced) — and a
 * degree there is an ANGLE with its arc-minutes following. A digit after the sign is therefore refused
 * outright. `⁰` is deliberately NOT folded to `°`: it would only turn a refused coordinate into a claimed one.
 */
// The scale class carries BOTH cases of both scripts. Cyrillic ⟨С⟩/⟨с⟩ and Latin ⟨C⟩/⟨c⟩ are visually
// identical and the corpus writes the uppercase pair only (⟨С⟩ ×4, ⟨C⟩ ×2, lowercase ×0) — the lowercase
// members are ROBUSTNESS for plausible input rather than a measured repair (trap 22's discipline), and they
// cost nothing because the trailing guard already demands a LONE letter and neither script has a one-letter
// Mongolian word.
const DEGREE_SCALE = /(\d)\s?°\s?([СсCcFf])(?![\p{L}\p{M}])/gui;
// The bare arm refuses a following DIGIT (a coordinate's arc-minutes — `47°49'` ×6) and a following LONE
// letter (a scale letter the scale arm has just declined — `212 °F`), but not a following WORD: `-18.4°
// хүйтэн` and `15° дулаан` are ordinary temperatures and are 3 of the 5 bare instances. The optional space
// before the digit is unattested here (`° \d` is ×0) and is admitted anyway, because widening a REFUSAL can
// only ever cost a reading, never invent one, and a bisected coordinate is this class's known hazard.
const DEGREE_BARE = /(\d)\s?°(?!\s?\d)(?!\s?\p{L}(?![\p{L}\p{M}]))/gu;

// ---------------------------------------------------------------------------------------------------
// 8. MINUS — read, where the plus is not
// ---------------------------------------------------------------------------------------------------

/**
 * `хасах`, attested ×33/18 on mn.wikipedia WITH THE SENSE READ, and one of the examples is this rule's exact
 * slot: `…боловч ХАСАХ ТЕМПЕРАТУРТАЙ болсон үед үүснэ` — "when it comes to be at MINUS temperature". The
 * same articles carry the physics paradigm (`бета хасах задрал`, `хасах цэнэгтэй` — negatively charged),
 * and the corpus itself names the sign definitionally: `1 байна (ХАСАХ ТЭМДЭГ)`, glossing a sign bit.
 *
 * The playbook's asymmetry is why this is read and the plus is not: **omitting a plus is lossless and
 * omitting a minus INVERTS.** `-25°С хүрдэг` reads today as *χɔrəŋ tʰaf s* — plus twenty-five — in a sentence
 * about how cold Ulaanbaatar gets.
 *
 * ⚠ THE HYPHEN IS OVERWHELMINGLY NOT A MINUS IN THIS CORPUS, so the rule is narrow on the RIGHT (trap 24 —
 * the right context is the discriminator when the left one is exhausted). Everything that opens a token and
 * precedes digits: `(-2001 он)` a truncated year span · `kmol -1` an EXPONENT · `улсын цолтой бөх -3,` and
 * `манлай уяач -20` a dash standing for "is" in a list · `экспорт -$98,72 тэрбум, импорт — $93,28` a dash
 * paired with an em-dash · `(Экспорт - Импорт)` a subtraction with no operand digits. None has a degree word
 * after it; all seven genuine negatives do (`-25°С`, `-15.6 хэм`, `-40 хэм`, `-1.3 °C`, `-0.7°`, `-18.4°`,
 * `-37 градус`). The window is the figure plus the next 12 characters, which is what `хэм` fits inside after
 * step 7 has rewritten the sign.
 *
 * ⚠ THE EN-DASH IS EXCLUDED DELIBERATELY. `өвлийн сард – 16-19 хэм` has a degree word in range and its dash
 * is a clause dash, not a sign; admitting `–` would claim it.
 *
 * ⚠ U+2212 IS ITS OWN ARM AND NEEDS NO RIGHT CONTEXT. The true minus sign is ×1 in the retained text and it
 * is a genuine negative in a slot the degree guard would never see — `нам доор цэг Айдин нуур (−154 м)`, an
 * elevation below sea level, which inverts a landmark into a mountain if the sign is dropped. Nobody types
 * U+2212 for a range or a list dash.
 */
// The operand is anchored to END IN A DIGIT: once a rule stops re-emitting its match verbatim, a
// `[\d.,]*` tail starts eating the CLAUSE comma that follows a figure — silent data loss the moment the
// rule writes words instead (the Welsh lesson under trap 14).
const MINUS_DEGREE = /(?<![\p{L}\p{M}\d])-(\d+(?:[.,]\d+)?)(?=.{0,12}?(?:хэм|градус))/gu;
const MINUS_TRUE = /(?<![\p{L}\p{M}\d])−(?=\d)/gu;

// ---------------------------------------------------------------------------------------------------
// 9. UNITS AND EXPONENTS — before decimals, which is the ordering that keeps the version guard alive
// ---------------------------------------------------------------------------------------------------

/**
 * ⚠ EVERY KEY AND EVERY WORD COMES FROM THE UNIT'S OWN WIKIPEDIA ARTICLE, WHICH NAMES ITS ABBREVIATION IN
 * BOTH SCRIPTS IN ITS FIRST SENTENCE. That is the key and the word in one place, which is the strongest form
 * this sourcing takes:
 *
 *     `Километр (Тэмдэглэгээ: км, km) нь олон улсын нэгжийн систем (SI)-ийн уртын хэмжүүр`   ×33/19
 *     `Килограмм (тэмдэглэгээ: монгол. кг, англи. kg) нь СИ системийн …`                     ×29/20
 *     `Сантиметр (товчоор см) гэж, СИ системийн уртын хэмжүүрийн үндсэн нэгж`                ×30/20
 *     `Метр гэдэг нь Олон улсын СИ системийн уртыг хэмжих үндсэн нэгж … товчлол нь м`        ×79/20
 *     `миллиметр` ×24/20, in `1 миллиметр=1/1,000 метр`
 *
 * The Cyrillic keys are what this corpus writes after a number (м ×59, км ×35, кг ×16, мм ×8, см ×6); the
 * Latin keys are declared beside them because the same corpus writes `3,780km²`, `12kg`, `0.5kg`, `1cm`, and
 * an undeclared Latin run reaches the ENGLISH foreign fallback — `3,780km²` came out *ˈʊkm skwˈɛɹd*, an
 * English phrase in a Mongolian phoneme string, which no leak class can see (trap 56).
 *
 * ⚠ THE ONE-LETTER ⟨м⟩ KEY IS MEASURED, NOT ASSUMED (trap 46). All 59 digit-adjacent instances in the
 * retained text are METRES — elevations (`602 м өндөрт`, `4399 м өндөр`, `7554 м хүртэл`), depths, widths —
 * or the numerator of a rate, and there is no counter-example at all. Latin bare `m` is NOT declared: it is
 * ×0 digit-adjacent here and the corpus does write `1 mol N A`, so the key would be pure exposure — the
 * "withdraw the key where it buys nothing" half of that trap. Cyrillic ⟨т⟩ and ⟨г⟩ are declined for the same
 * reason and a stronger one: both are ×0 digit-adjacent and both are among the language's commonest letters.
 *
 * ⚠ THE RIGHT-HAND GUARD CARRIES NO `.` OR `,`, AND THAT IS A CORRECTION MADE FROM THE CORPUS DIFF RATHER
 * THAN A STYLE CHOICE. It carried both in the first cut, on the theory that they blocked a dotted version —
 * they do not (the operand anchoring below is what does that, and `802.11m` is rejected by the LEFT edge
 * before the right one is ever consulted), and they declined every CLAUSE-FINAL unit figure instead:
 * `4205 м.`, `610 км,`, `14620 км².`, `150 мм.`, `78 кг,` — **25 instances in 452 retained segments**, each
 * one leaving a bare consonant in the phoneme stream, which is exactly what the step exists to close. This is
 * Luganda's review finding #3 reproduced verbatim on another language; a guard is only free when it rejects
 * something.
 *
 * ⚠ THE OPERAND IS ANCHORED ON BOTH EDGES, NOT GUARDED ON ONE (trap 52). A lookbehind rejects a starting
 * POSITION and the engine simply starts later: `802.11m` rejected at `802` matches `11m` on its own and reads
 * "eleven metres". The number here must BEGIN where the match begins and END where it ends, so a dotted
 * designation cannot be entered from the middle. This is also why this step runs ABOVE the decimal step
 * (trap 39): the guard works by seeing the dot, and the decimal rule spends it.
 *
 * ⚠ A GLUED CASE SUFFIX IS ACCEPTED HERE AND REFUSED BY THE PERCENT ARM, AND THE ASYMMETRY IS DELIBERATE —
 * IT IS THE FALLBACK READINGS THAT ARE ASYMMETRIC, NOT THE MORPHEME. The corpus writes seven of them:
 * `100м-ийн`, `200м-ийн`, `265 км-т`, `4000 м-ээс`, `500 мм-д`, `100 кг-н`, `5кг-с`. Refusing the match, as
 * the percent arm does, would leave a bare CONSONANT CLUSTER in the phoneme stream (`кг` → [kʰɡ]) — the
 * defect this whole step exists to close. The percent sign is SILENT when its arm refuses, so refusing there
 * costs nothing; a unit key is NOISE when this arm refuses, so refusing here costs the reading. Trap 53 asks
 * whether half a match is worse than the reading it replaces, and the two arms get opposite answers from the
 * same question.
 *
 * ⚠ AND WHERE THE UNIT NOUN ENDS IN ⟨р⟩ THE SUFFIX IS GLUED ON, which is the ORDINAL step's mechanism
 * (`9-рт` → есдүгээрт) reused on the same morphological fact and with the same limit: the stem is
 * vowel-final-plus-⟨р⟩, so the writer's own suffix attaches with NO morphology, and the corpus attests the
 * results — `метрийн` ×7, `метртэй` ×2, `метртэйгээ`, `метрээр`, `метрүүдийг`. That is five of the seven
 * (`100 метрийн`, `200 метрийн`, `265 километрт`, `4000 метрээс`, `500 миллиметрд`). `килограмм` is NOT
 * ⟨р⟩-final and its oblique stem is not derivable from anything here — `кг-н` is the genitive the writer
 * wrote for the ABBREVIATION, and `килограммн` is not a word — so those two keep the unit noun and leave the
 * suffix exactly where it already was, stranded, which is the reading they had before the ⟨кг⟩ cluster was
 * closed and no worse.
 *
 * ⚠ A KEY FOLLOWED BY `/` IS REFUSED WHOLE (trap 53). `116 м³/с` and `11,3м³/с` are rates and Mongolian's
 * rate idiom is a prefixed locative, not "A per B" — reading the numerator and dropping `/с` would replace a
 * silent slash with a confidently truncated quantity. They keep the reading they had.
 *
 * ⚠ THE EXPONENT WORD IS PREPOSED ONTO THE UNIT NOUN, and both are sourced with the sense read:
 *   · `куб` ×37/18 — `КУБ МЕТР нь СИ системийн эзэлхүүний нэгж болно. Нэг литр нь 1 КУБ ДЕЦИМЕТРТЭЙ (дм³)
 *     тэнцүү` — definitional, in the slot, and it names `дм³` beside it.
 *   · `квадрат` ×36/18 — the bare token is the SHAPE (`Квадрат гэж дөрвөн тал нь тэнцүү … дүрсийг хэлнэ`) and
 *     the quadratic function, which is trap 37 exactly; the COLLOCATION is what attests it, and mn.wikipedia
 *     carries `Мөн үзэх == КВАДРАТ КИЛОМЕТР` as an article cross-reference. `дөрвөлжин` is the attested
 *     competitor and is recorded rather than chosen: it is ×82/17 bare and every single one of those is
 *     `Дөрвөлжин булш`, a bronze-age SQUARE-GRAVE culture, while its unit use appears only inside the longer
 *     `хавтгай дөрвөлжин километр` ×1 and `ам дөрвөлжин километр` ×1. Same count-versus-sense split that
 *     nearly shipped the wrong Amharic square word.
 *   · ASCII `2`/`3` are in the class beside `²`/`³` because the corpus writes both (`м3/с`, `км2` shapes) and
 *     because leaving an ASCII exponent behind does not leak, it reads as a NUMBER — Igbo's `790 km2` →
 *     "790 kilometres two" (trap 53). They are admitted only when a unit key precedes them, never on a bare
 *     figure.
 */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "км": "километр", "м": "метр", "см": "сантиметр", "мм": "миллиметр", "кг": "килограмм",
    "km": "километр", "cm": "сантиметр", "mm": "миллиметр", "kg": "килограмм",
};
const EXPONENT_WORD: Readonly<Record<string, string>> = { "²": "квадрат", "2": "квадрат", "³": "куб", "3": "куб" };
// Longest key first, so `км` is tried before `м` and `mm` before `m` (there is no bare Latin `m`, but the
// ordering is what makes adding one later safe rather than silently wrong).
const UNIT_KEYS = Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length).join("|");
// The trailing `-суффикс` is CAPTURED so it is consumed and re-emitted (trap 10) rather than left behind to be
// stranded by accident; the callback decides whether it glues onto the unit noun or stays separate.
const UNIT = new RegExp(
    `(?<![\\d.,\\p{L}\\p{M}])(\\d+(?:[.,]\\d+)?)[  ]?(${UNIT_KEYS})([²³23])?(?![\\p{L}\\p{M}\\d/²³])`
    + `(?:-([а-яөүё]+)${NOT_LETTER})?`,
    "gu",
);

// ---------------------------------------------------------------------------------------------------
// 10. THE DECIMAL POINT — last, because every guard above needs the separator intact
// ---------------------------------------------------------------------------------------------------

/**
 * `цэг`. espeak's `mn_list` gives it TWICE and from the two different directions that matter — `_dpt tseg`
 * is the decimal-point slot specifically (a statement about how the separator is SPOKEN, which is the thing
 * a written corpus cannot supply) and `_. tseg` is the character's name. mn.wikipedia corroborates the sense
 * definitionally: `Цэг (.) — нь цэг таслал юм` names the character, and `Гурван фазын цэг` (triple point),
 * `Саланги цэг` (isolated vertex) show it is the ordinary word for a point.
 *
 * ⚠ THE VERSION/DATE GUARD IS THE `(?![\d.,])` ON BOTH EDGES. `2000.4.19` is a DATE in this corpus and
 * `3.2.` a section number; a loose `\d+[.,]\d+` would read the first as "2000 point 4 point 19". Requiring
 * no separator on either flank leaves both untouched — and by then de-grouping has already removed the
 * thousands commas, so what remains between two digit runs really is a decimal point (167 dot-decimals and
 * 21 comma-decimals in the retained text).
 *
 * ⚠ THE COMMA ARM IS CAPPED AT TWO FRACTIONAL DIGITS AND THE DOT ARM IS NOT, WHICH IS THE SAME MEASUREMENT
 * THAT SPLIT DE-GROUPING and is the more important half of it. The first cut used one pattern for both
 * separators and the corpus diff caught it: `1974,1977 онуудад` is a comma-separated LIST OF TWO YEARS, and
 * it read as *мянга есөн зуун далан дөрөв ЦЭГ мянга есөн зуун далан долоо* — one number where the text has
 * two, and a clause pause deleted. Every genuine comma decimal in the retained text has one or two digits
 * after it (×16 and ×5); the three-digit case is a thousands group and has already gone; four is a list.
 * The dot arm needs no such cap (`3.4528` is a real exchange rate) because a dot is never a group separator
 * in this corpus.
 */
const DECIMAL_DOT = /(?<![\d.,])(\d+)\.(\d+)(?![\d.,])/gu;
const DECIMAL_COMMA = /(?<![\d.,])(\d+),(\d{1,2})(?![\d.,])/gu;

// ---------------------------------------------------------------------------------------------------
// 11. INITIALISMS — the shared seam, wired
// ---------------------------------------------------------------------------------------------------

/**
 * Mongolian phonotactics for the OOV half of `core/initialisms.ts`.
 *
 * Khalkha has no native initial cluster — a word begins C-V or V — and the onsets listed are the RUSSIAN-LOAN
 * inventory the written language has absorbed (программ, трактор, спорт, план), which is what stops an
 * ordinary caps-set headword being spelled letter by letter. The coda set is the native one: Mongolian ends a
 * word in two consonants routinely (морд, гурв, харш, найрт), and the epenthesis rule in `mongolian.ts`
 * exists precisely because those clusters are real.
 *
 * ⚠ ONE SHARED-FILE DEFECT REPORTED AND DELIBERATELY NOT EDITED HERE, because a core change must not land as
 * a side effect of one language's commit. `makeUnreadableTest`'s signal 2 breaks a 3+ consonant run only
 * when the run contains an ASCII `[lr]`, so Cyrillic ⟨л⟩/⟨р⟩ never satisfy the exemption and it is switched
 * OFF for the whole script — the same family as trap 1's `\b`. It applies equally to ky, ru, uk and tg.
 * ⚠ AND IT IS LIVE, NOT LATENT. Measured over the retained text's 6491 Cyrillic word types: 859 carry a 3+
 * consonant run, the ASCII exemption fires on exactly 0 of them, and a Cyrillic ⟨л⟩/⟨р⟩ exemption would fire
 * on 525 — so the signal is running with its brake disconnected. One of those FIRES IN THE RETAINED TEXT —
 * `ХӨГЖЛИЙН`, an ordinary word (genitive of "development") inside a
 * shouted programme title in an otherwise lowercase paragraph, is spelled out as
 * *хэ ө гэ жэ эл и хагас и эн* because ⟨гжл⟩ has no ASCII liquid in it. That is a false positive shipping
 * today, and the fix belongs in `core/initialisms.ts` where every Cyrillic language gets it at once.
 */
export const isUnreadableMongolian = makeUnreadableTest({
    vowels: /[аеёиоөуүыэюя]/u,
    legalOnsets: new Set([
        "бл", "бр", "гл", "гр", "др", "кл", "кр", "пл", "пр", "сл", "см", "сп", "ст", "тр",
        "фл", "фр", "хл", "хр", "зв", "св", "тв", "дв", "сн", "шт", "шк", "шп", "гв",
    ]),
    legalCodas: new Set([
        "рт", "рд", "рм", "рн", "рс", "рх", "рг", "рз", "рш", "рч", "рв", "рь",
        "нт", "нд", "нч", "нз", "нс", "нх", "нг",
        "лт", "лд", "лз", "лс", "лх", "лг", "лж", "ль",
        "ст", "шт", "фт", "хт", "гт", "йт", "йл", "йн", "йм", "йх", "вь", "мь", "нь", "хь",
    ]),
});

/**
 * Spell an unreadable all-caps run with Mongolian letter names. `ДНБ` → *дэ эн бэ*, `ХХК` → *хэ хэ ка*,
 * `ЗХУ` → *зэ хэ у*, `МЭӨ` → *эм э ө*.
 *
 * ⚠ THE STAKE IS HIGHER HERE THAN IN A SHALLOW ORTHOGRAPHY, and it is why this seam is wired rather than
 * deferred. `mongolian.ts` deletes a word-final short vowel and reduces every non-initial one, so an acronym
 * does not merely come out as an unreadable cluster — it comes out SHORTER THAN IT WENT IN. Measured on this
 * corpus's own acronyms before the change: `АНУ` → [an] (the ⟨У⟩ gone), `ОХУ` → [ɔχ], `МЭӨ` → [me],
 * `БНХАУ` → [pŋχa], `ДНБ` → [tnp], `ХХК` → [xxkʰ], `УИХ` → [ʊəx]. `initialism` is this corpus's second-largest
 * cell at 53,329 occurrences.
 *
 * ⚠ AND THE OOV TEST ALONE DOES NOT CLOSE THAT LIST — IT CLOSES SEVENTEEN OF THEM AND LEAVES THE COMMONEST
 * SIX OPEN, which is the review finding that put `acronymLetters` here. Every acronym above with a VOWEL in
 * a legal position passes `isUnreadableMongolian` and is handed straight back: with the list empty, `АНУ`
 * (×15), `ОХУ` (×6), `УИХ` (×6), `НҮБ` (×4), `МЭӨ` (×4) and `ОУ` (×3) — ~38 retained instances against the
 * 17 the phonotactic test claimed — kept exactly the destroyed readings this comment cites as the reason the
 * seam exists. The first cut argued the empty list was the conservative direction; it is not, because in
 * THIS orthography the fallback is not a word reading, it is a shorter string. `mongolian.jsonc` carries the
 * seven forms, the criterion that admitted them (the expansion written beside the acronym — `товчоор АНУ`,
 * `товчоор ОХУ`, `товч. НҮБ`), and the tokens that criterion REFUSES (`МУ`, `УБ`, `ДОХ`, `МИАТ`, `МАН`).
 *
 * `isRecorded` is `false`: this tree has no Mongolian pronunciation dictionary, so the decision rests on that
 * list plus the OOV test — the position Kyrgyz and Tajik are in, and the position Russian is in with a
 * fifteen-entry list of its own. The retained text's all-caps WORDS (`МОНГОЛ`, `ДЭЭД`, `ХҮН`, `ЫН`,
 * `ГУРАВ`, `ДАРГА`) are correctly left alone by the phonotactic test.
 *
 * ⚠ ORDERING, verified rather than assumed (trap 16). Roman numerals are all-caps runs too, and `mn` is NOT
 * in `registry.ts`'s `ROMAN_NATIVE`, so `core/roman.ts` has already turned `XIX` into `19` before `text()` is
 * entered — probed end-to-end: `XIX зууны` → *арван ес зуун*, not the letter names. This pass therefore runs
 * last, after the abbreviation dot has been spent and after step 1 has taken the personal initials.
 */
const LETTER_NAME = MANIFEST.letterNames;
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);
const spellInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l],
    acronymLetters: ACRONYM_LETTERS,
    isRecorded: () => false,
    isUnreadable: isUnreadableMongolian,
});

// ---------------------------------------------------------------------------------------------------

/**
 * Normalize Mongolian text before tokenization. The steps are ORDER-DEPENDENT and each coupling is stated at
 * the step; the three that would break silently if moved are:
 *
 *   · DE-GROUPING (3) above everything that reads a number, or a grouping comma is read as clause punctuation.
 *   · UNITS (9) above DECIMALS (10), because the unit step's version guard works by SEEING THE DOT and the
 *     decimal step spends it — trap 39, which was latent in `ckb`/`fa` until a one-letter key exposed it.
 *   · INITIALISMS (11) last, after the abbreviation dot (2) and the personal initials (1), or `ам.доллар`
 *     and `Ц.Э` become caps runs to spell out.
 */
export function normalizeMongolian(input: string): string {
    let s = input;

    // 1. Personal initials, before the dot rule and before the caps run — `Ц.Элбэгдорж` → `цэ Элбэгдорж`.
    s = s.replace(INITIALS, (_m, run: string) =>
        [...run.matchAll(/[А-ЯӨҮЁ]/gu)].map((c) => LETTER_NAME[c[0]!.toLowerCase()] ?? c[0]!).join(" ") + " ");

    // 2. An abbreviation dot between two lowercase letters is not a clause end.
    s = s.replace(ABBREV_DOT, " ");

    // 3. De-grouping.
    s = s.replace(GROUP_COMMA, "").replace(GROUP_SPACE, "$1$2");

    // 4. Ordinals. Above the percent and unit steps only because nothing else spends a hyphen before a ⟨р⟩.
    s = s.replace(ORDINAL, (m, digits: string, tail: string) => {
        const words = ordinalWords(Number(digits));
        return words === undefined ? m : `${words}${tail}`;
    });

    // 5. Percent — the suffixed arms first, or the bare arm consumes the sign and strands the suffix.
    s = s.replace(PERCENT_SUFFIX, "$1 хув$2").replace(PERCENT_NI, "$1 хувь нь").replace(PERCENT, "$1 хувь");

    // 6. Currency. The sign is DROPPED, not read, where the word is already said within the window (trap 12);
    //    a MAGNITUDE word after the figure takes the currency name to the far side of it, or refuses the
    //    match outright when it is itself case-marked.
    const currency = (m: string, num: string, sign: string, mag: string, off: number, whole: string): string => {
        if (MAGNITUDE_SUFFIXED.test(mag)) return m; // trap 53 — refuse the whole match, not half of it
        if (SAID_CURRENCY.test(currencyWindow(whole, off))) return num + mag; // trap 12 — say it once, in the word
        return `${num}${mag} ${CURRENCY_WORD[sign]!}`;
    };
    s = s.replace(CURRENCY_BEFORE, (m, sign: string, num: string, mag: string, off: number, whole: string) =>
        currency(m, num, sign, mag, off, whole));
    s = s.replace(CURRENCY_AFTER, (m, num: string, sign: string, mag: string, off: number, whole: string) =>
        currency(m, num, sign, mag, off, whole));

    // 7. Degrees, scale arm first so the bare arm cannot re-claim what it declined. `°F` is refused WHOLE —
    //    no scale name is sourceable, so a bare `хэм` there would be a scale claim, not a neutral reading.
    //    The refusal is CASE-FOLDED, because the class that reaches it is: `f` is in `DEGREE_SCALE` as
    //    robustness, so a case-sensitive `=== "F"` let `5°f` through to a confident CELSIUS reading (`5 хэм`)
    //    while `5°F` was correctly refused — a guard admitting exactly what it was written to reject.
    s = s.replace(DEGREE_SCALE, (m, digit: string, scale: string) =>
        (scale.toUpperCase() === "F" ? m : `${digit} хэм`));
    s = s.replace(DEGREE_BARE, "$1 хэм");

    // 8. Minus. After step 7, so the degree arm can key on the emitted `хэм` as well as on `градус`.
    s = s.replace(MINUS_DEGREE, "хасах $1").replace(MINUS_TRUE, "хасах ");

    // 9. Units and exponents, with the measure word preposed onto the unit noun. A glued case suffix is
    //    ACCEPTED rather than refused (the percent arm's opposite call, and the reason is at the step):
    //    it glues onto a ⟨р⟩-final unit noun with no morphology (`265 км-т` → *265 километрт*, the ordinal
    //    step's mechanism), and stays where it was on any other, which is no worse than before.
    s = s.replace(UNIT, (_m, num: string, key: string, exp: string | undefined, suffix: string | undefined) => {
        const unit = UNIT_WORD[key]!;
        const measure = exp === undefined ? unit : `${EXPONENT_WORD[exp]!} ${unit}`;
        if (suffix === undefined) return `${num} ${measure}`;
        return unit.endsWith("р") ? `${num} ${measure}${suffix}` : `${num} ${measure}-${suffix}`;
    });

    // 10. The decimal point.
    s = s.replace(DECIMAL_DOT, "$1 цэг $2").replace(DECIMAL_COMMA, "$1 цэг $2");

    // 11. The shared initialism seam.
    return spellInitialisms(s);
}
