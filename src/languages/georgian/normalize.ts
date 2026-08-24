/**
 * Georgian (ka) TEXT NORMALIZATION — pure text→text, run inside the engine's `text()` before tokenization.
 * Rewrites what is not already a pronounceable word into words the existing g2p speaks.
 *
 * ⚠ EVERY COUNT BELOW IS MEASURED over the retained text of `tools/corpus/mined/ka.jsonc` — 453 segments
 * (253 hard + 200 sample) drawn from a **1,025,770-paragraph ka.wikipedia dump**, the largest artifact in the
 * tree. Where the artifact's whole-corpus `counts` block differs it is quoted as "dump-wide". The artifact is
 * dump-sourced, so its `sample` tier carries real proportions.
 *
 * ⚠ WHAT THE ENGINE DID BEFORE — the defect list these rules answer, probed rather than assumed:
 *
 *     5 000        → χutʰi nuli            "FIVE ZERO"; the group split and 000 read as the WORD zero
 *     1 900 000    → ɛɾtʰi t͡sʰχɾaasi nuli   "one nine-hundred zero"      (grouped 41,173 dump-wide)
 *     1,5          → ɛɾtʰi , χutʰi         the decimal separator became a CLAUSE PAUSE   (decimals 54,471)
 *     15:00        → tʰχutʰmɛtʼi , nuli    the colon became a clause pause              (clock 13,912)
 *     100-ზე მეტი  → asi zɛ mɛtʼi          the POSTPOSITION as a free word
 *     2000-მდე     → ɔɾi atʰasi mdɛ        ditto, and the numeral kept its nominative -ი
 *     მე-5         → mɛ χutʰi              the ordinal circumfix's მე as a word + a CARDINAL
 *     25-ე         → ɔt͡sʰdaχutʰi ɛ         cardinal + a bare vowel
 *     8-ჯერ        → ɾva d͡ʒɛɾ              two words where Georgian has one
 *     5 %          → χutʰi                 % DROPPED                                    (percent 17,136)
 *     12 °C        → tʰɔɾmɛtʼi sˈiː        ° dropped, ⟨C⟩ read as the ENGLISH letter     (degrees 2,988)
 *     500 კმ²      → χutʰasi kʼm           ² dropped AND ⟨კმ⟩ into the IPA as /kʼm/      (exponent 28,815)
 *     25 მლრდ.     → …mlɾtʰ .              "billion" as the cluster /mlɾtʰ/ + a false pause
 *     ძვ. წ. 480   → d͡zv . t͡sʼ . …         the era marker as two clusters + two false pauses (6,492)
 *     $25 მილიონი  → ɔt͡sʰdaχutʰi miliɔni   $ DROPPED                                    (currency 1,376)
 *     XVIII საუკუნე→ tʰvɾamɛtʼi saukʼunɛ   a century read as a CARDINAL, not an ordinal
 *     1/3-ს        → ɛɾtʰi sami s          the slash dropped                            (fractions 4,837)
 *     210 ‰ / № 5  → …                     both signs dropped
 *
 * ⚠ GEORGIAN IS UNICASE, so trap 7 (a class narrower than the orthography) does not arise. Trap 1 does:
 * `\b` is ASCII-defined and finds nothing against Mkhedruli. Every boundary here is an explicit lookaround.
 * `\p{Script=Georgian}` also covers Mtavruli (U+1C90–1CBF), which the g2p lowercases.
 *
 * ═══ THE DEFINING RULE: A CASE/POSTPOSITION SUFFIX GLUED TO A FIGURE (trap 14) ═══
 *
 * Georgian is agglutinative with a rich case system, and the corpus writes the ending after the DIGITS with a
 * hyphen: 59 instances in the artifact — `-იან(ი)` ×13, `-მდე` ×9, `-ზე` ×8, `-ე` ×6, `-ს` ×5, `-ის` ×5,
 * `-დან` ×4, `-ჯერ` ×2, `-წლიანი`/`-კაციანი` ×2. **A digit only becomes words in the TOKENIZER**, so gluing
 * or spacing the written ending can never work: as a free token `ზე`/`მდე`/`იან` is a bound morpheme standing
 * alone (`asi zɛ`), which Georgian does not have. The fix is trap 14's: convert the operand to WORDS inside
 * the rule, then attach the ending to the LAST WORD with the right stem alternation.
 *
 * ⚠ AND THE ALTERNATION IS THE POINT, NOT THE CONCATENATION. A Georgian numeral ends in the nominative -ი,
 * which is LOST or changed before an ending: ასი+ზე = ასზე (not *ასიზე), ასი+მდე = ას**ა**მდე,
 * ასი+დან = ას**ი**დან, and the vowel stems რვა/ცხრა truncate before some endings and not others
 * (რვის, რვამდე, რვაჯერ). `attach()` below is that table; it is confirmed by ordinary corpus words that
 * decline the same way — წელი→წლ**ა**მდე (`1906 წლამდე`), ბოლო→ბოლომდე, ქალაქი→ქალაქიდან.
 *
 * ═══ THE NEGATIVE RESULT THAT SHAPED THIS FILE (trap 15, answered NO) ═══
 *
 * Trap 15 says the same bound suffix is also written with a SPACE — count both. Counted: **312 instances of
 * `\d{3,4}` + a spaced year noun** (`2014 წლის` ×10, `1992 წელს` ×4, `1995 წლებში` ×3 …), which is the single
 * most common numeric shape in the corpus. Every one is a fully-spelled, separately-declined NOUN, and a
 * Georgian numeral used attributively before a noun **does not decline** — the noun carries the case. So
 * `2011 წელს` already reads correctly (`ორი ათას თერთმეტი წელს`) and NO RULE IS WRITTEN FOR IT. Writing one
 * would be a pure misfire generator over the corpus's highest-count shape. Georgian's bound-suffix problem is
 * confined to the HYPHENATED form.
 *
 * ═══ THE ORDINAL IS A CIRCUMFIX, AND THE CORPUS WRITES BOTH HALVES (tabulated, not assumed — trap 4) ═══
 *
 * მე-…-ე wraps the numeral. The corpus writes the PREFIX half ×7 (`მე-5`, `მე-13`, `მე-18`, `მე-3` ×2,
 * `მე-12`, `მე-17`) and the SUFFIX half ×6 (`179-ე`, `25-ე`, `24-ე`, `23-ე`, `41-ე`, `20-ე`) — the same
 * category, two spellings, and each writes only one arm of the circumfix. Both are read by `ordinal()`, whose
 * series is attested in ka.wikipedia's own grammar article: *"რიგით რომელი? — პირველი, მეორე, მესამე, მეათე,
 * მეოცე, მეასე და ა.შ."*, plus მეთხუთმეტე ×26/11 and მეთვრამეტე (×2 in this corpus, `მეთვრამეტე საუკუნის`).
 *
 * ═══ SOURCING (§5c/§5e route; espeak DOES NOT SHIP GEORGIAN, so there is no phonetic fallback) ═══
 *
 * Every word emitted below is a token somebody else wrote, with the SENSE read (trap 37 / the Fula lesson).
 * Tiers used: this corpus, `ka.wikipron-kat-narrow.tsv` (20,896 entries), and `attest.ts` against
 * ka.wikipedia (cached in `tools/corpus/attest/ka.jsonc`).
 *
 *   პროცენტი  %   ×29/9   *"პროცენტი (ლათ. per centum — „მეასედი“; აღნიშვნა: %)"* — the article names the
 *                         SIGN; running text postposes it after the figure (*"62 პროცენტი შიიტი"*,
 *                         *"47,7 პროცენტს შეადგენს"*). Also in the referee.
 *   პრომილე   ‰   ×5/3    *"პრომილე (ლათ. per mille — ათასზე) … აღინიშნება ‰ სიმბოლოთი"*, running
 *                         *"36 პრომილე"*, *"8,5 პრომილე"*. Same postposed slot.
 *   გრადუსი   °   ×6/1    the disambiguation page: *"ცელსიუსის გრადუსი — ტემპერატურის საზომი ერთეული"*.
 *   ცელსიუსი  °C          *"ცელსიუსის გრადუსი (სიმბოლო: ° C)"* defines it against the symbol; the
 *                         numeral-adjacent frame is *"34 გრადუსი ცელსიუსი"*, *"24 გრადუსი ცელსიუსი"* — which
 *                         settles the WORD and the ORDER in one hit.
 *   ფარენჰაიტი °F         *"ფარენჰაიტის გრადუსი — ტემპერატურის საზომი ერთეული"*, and *"0 გრადუსი
 *                         ფარენჰაიტის შკალაზე"*. ⚠ ×0 in this corpus — declared for the adversarial
 *                         neighbour of °C (trap 8), on the wiki attestation alone.
 *   დოლარი    $   ×6/6    *"აშშ-ის დოლარი … ვალუტის კოდი USD"*, *"1995 წელს $380 მილიარდზე მეტი დოლარი"* —
 *                         the SIGN and the word in one sentence, and it fixes the position: the currency name
 *                         follows the magnitude in the NOMINATIVE while the case sits on the magnitude.
 *   ევრო      €   ×6/4    *"ევრო (სიმბოლო: €; საბანკო კოდი: EUR)"* — defined against its own sign.
 *   ნომერი    №   ×6/2    *"ატომური ნომერი … ქიმიური ელემენტის რიგითი ნომერი"* — the noun "number".
 *   მინუს     −   ×18/12  *"მინუს 22 გრადუსი ცელსიუსით"*, *"იტანს მინუს 3-5 °C ტემპერატურას"*, and THIS
 *                         corpus spells it in the slot: *"დახრილობა — მინუს 7.2°"*.
 *   პლუს      +   ×12/8   *"„ორს პლუს ორი უდრის ხუთს“ (2 + 2 = 5)"* — the arithmetic infix, quoted beside
 *                         the digits, which also sources `უდრის`.
 *   უდრის     =   ×32/16  *"1 ტონა უდრის 1.000 კილოგრამს"*, *"1 კმ² უდრის:"* — the slot exactly.
 *   კვადრატული ²  ×3      *"1 Mm² აღნიშნავს ერთ კვადრატულ მეგამეტრს"* and *"10¹² მ² (და არა 1 000 000 ×
 *                         კვადრატული მეტრი)"* in THIS corpus; the wiki adds *"კვადრატული კილომეტრი
 *                         (აღნიშვნა: კმ², km²)"*. PREPOSED, and glossed against the symbol.
 *   კუბური    ³   ×6      *"426 კუბური სანტიმეტრი"*, *"79 კუბური ინჩი"* in THIS corpus; the wiki glosses
 *                         *"კუბური მეტრი (აღნიშვნა: მ³, m³)"*.
 *   მილიმეტრი მმ  ×1      the corpus GLOSSES its own abbreviation inside one paragraph: *"შეადგენს 572
 *                         მილიმეტრს, ნალექების მაქსიმუმი მაისში ფიქსიდება (86 მმ)"*.
 *   კილომეტრი კმ  ×9      *"ქარელიდან 18 კილომეტრი"*, *"57კილომეტრით"*, and the wiki's კმ² definition.
 *   სანტიმეტრი სმ ×5      *"400 კუბურ სანტიმეტრს"* beside the corpus's own `სმ³`.
 *   მეტრი     მ           *"მეტრი (ფრანგ. mètre …) — the SI base unit"*; the corpus writes the word
 *                         (*"ზღვის დონიდან 650 მეტრი"*) in the same register as its 18 bare ⟨მ⟩.
 *   საათი/წუთი/წამი      ONE wiki sentence glosses all three abbreviations: *"წუთი (წთ, min), საათი (სთ, h)
 *                         და ასე შემდეგ. 1 წთ = 60 წმ; 1 სთ = 3600 წმ"*. The clock's component frame is
 *                         attested in THIS corpus: *"365 დღე, 5 საათი, 49 წუთი და 12 წამი"* and
 *                         *"20 საათი და 41 წუთი"*.
 *   საათში    /სთ ×1      *"მშპ საათში მუშაობისათვის"* — "per hour"; and the corpus writes density the long
 *                         way, *"1 კვ კმ-ზე 2495,9 ადამიანი ცხოვრობს"*, which is what sources `-ზე` = "per".
 *   ძველი/ახალი წელთაღრიცხვით  ×15/5 and ×11/8 — *"ძველი წელთაღრიცხვით VII საუკუნის დასაწყისში"*, and one
 *                         hit carries the abbreviation AND the expansion together: *"თარიღდება ძვ. წ. I და
 *                         ახალი წელთაღრიცხვით I-IV საუკუნეებით"*.
 *   ეგრეთ წოდებული ე.წ.  ×22/17, every hit the "so-called X" slot.
 *   და ასე შემდეგ  ა.შ.  ×9/9.   მათ შორის  მ.შ.  ×41/13.   დაახლოებით  დაახლ.  ×116/16.
 *
 * ═══ WHAT IS REFUSED, AND WHAT EACH REFUSAL COSTS (trap 53 — a refusal is not neutral) ═══
 *
 *   THE DECIMAL SEPARATOR WORD — the biggest one, and it is `[NONE]`. `sources.ts` reports no `_dpt`, no
 *   manifest word, and espeak does not ship Georgian. `attest.ts` was then pointed at the READING SLOT rather
 *   than at a candidate (trap 40): `ნული მთელი`, `ერთი მთელი`, `ორი მთელი`, `სამი მთელი` — **0 hits each**.
 *   The bare candidates fail on sense, twice over (trap 37): `მთელი` ×19/6 is every time the INTEGER
 *   (*"მთელი რიცხვები"*), and `მძიმე` ×58/9 is every time "heavy" (*"მძიმე როკი"*, *"მძიმე მეტალი"*) —
 *   the punctuation sense exists (*"მახვილისა (') და მძიმის (,)"*) but that is what the MARK IS CALLED, the
 *   wrong register for what a reader says between two figures. So no word is authored.
 *   ⚠ THE REFUSAL IS STILL NOT NEUTRAL, and step 12 prices it: the separator is replaced by a SPACE rather
 *   than left alone, because the defect being fixed is a CLAUSE PAUSE inside a number, which is wrong under
 *   every candidate reading. `1,5` goes from *ɛɾtʰi , χutʰi* to *ɛɾtʰi χutʰi* — two cardinals with no
 *   sentence break, which is what the digits say and adds nothing. 105 + 37 artifact instances, 54,471
 *   dump-wide. The day a Georgian decimal word is sourced, step 12 is one string.
 *
 *   THE RANGE JOINER. 112 artifact instances (`1972-1985`, `1995–2003`, `408 - 355`), 93,177 dump-wide, and
 *   they already read as two juxtaposed cardinals with no false pause — the hyphen is simply not in the
 *   engine's TOKEN. Georgian writes an explicit span when it wants one (`1,5-დან 6 %-მდე`, `1895-დან 1906
 *   წლამდე`, `200-დან 350 მმ-მდე`, `25 °C-იდან … -მდე`), so a bare dash is the writer declining to. No
 *   connective is attested for the bare form; inventing one would put a word into 93k readings on no
 *   evidence. Cost of the refusal: a span is heard as two numbers. Cost of the alternative: an unsourced word
 *   in the highest-count shape in the language. ⚠ AND THE REFUSAL HAS A SECOND JOB — see step 11's guard, which
 *   is what keeps the minus rule off `408 - 355` and off the eight ISBNs (`3-900052-04-2`).
 *
 *   `×` / `x`. 5 artifact instances and they are not one class: `17×11 კმ` and `6.9X3.6 მ` are DIMENSION
 *   crosses (read "by", not "times" — trap 48's Thai finding), `1 000 000 × 1 000 000 მ` is a genuine
 *   multiplication, `1280x1024` is a screen resolution inside a Latin run. One word cannot serve all four and
 *   the sign currently drops silently; a wrong operator word would be confidently wrong instead. Cost: 5
 *   instances stay silent. (`გამრავლებული` ×12/12 is attested and every hit is the ordinary participle
 *   "multiplied/propagated" — *"ფოტოასლებით გამრავლებული"*, copies of a book — never the operator.)
 *
 *   `&`. 9 artifact instances, **every one inside a Latin/foreign run** — `AT&T` ×2, `Simon & Schuster`,
 *   `Vandenhoeck & Ruprecht`, `.40 S&W`, `Artemis & Winkler`, `& Iankoshvili`. Georgian prose does not use
 *   the character; the shared unclaimed-run pass hosts these out. That is a sense-based refusal on the
 *   instances, not silence about the language, so it is entered in `ACCEPTED_SIGN_SILENCE`.
 *
 *   THOUSANDS GROUPED WITH A DOT. `$2.500` and `100.000 რუპიად` (2 instances) are European grouping, but
 *   `240.994x240.994პქ` (2) is a decimal — 2 against 2 is not an argument, so `.`+3 digits stays a decimal.
 *   The comma arm ships: `,`+exactly 3 digits is 7/7 grouping in the artifact (`5,837,213`, `120,000`,
 *   `17,000`, `1,300`, `1,080`, `95,000`, `$4,719` — the last confirmed by the same document writing
 *   `$4719-ს`), against 105/105 decimals for `,`+1–2 digits. A leading `0,` is excluded, which is where a
 *   genuine 3-place Georgian decimal would live.
 *
 *   A BARE `H:MM` WITH NO CLOCK CONTEXT. 11 of the artifact's 12 colon-times carry an explicit context
 *   (`საათზე` ×4, `UTC` ×3, `-ზე` ×2, `დროით`/`დროში`); the twelfth, `8:04`, is a TRACK LENGTH in a
 *   discography and is not a time of day at all. So step 2 requires the context and `8:04` keeps its false
 *   pause — 1 instance, against reading a duration as an hour of the day (the ilo-vs-ceb lesson, trap 55).
 *
 *   A ONE-LETTER UNIT KEY WITH ZERO CORPUS INSTANCES. `ტ` (tonne) is glossed by the wiki (*"აღნიშვნა: ტ, t"*)
 *   and is ×0 digit-adjacent here, while ⟨ტ⟩ is an ordinary Georgian letter — traps 28/46 say declare it only
 *   where it buys something. It buys nothing, so it is not declared. `მ` IS declared: 18 digit-adjacent
 *   instances, every one a genuine metre (elevations, wall dimensions), and Georgian cannot produce the
 *   `802.11m` shape the guard exists for, because a version string is Latin.
 *
 *   `±`, `<`, `>`, `÷` — ×0 in the artifact, and `sources.ts` says the same for each: *"the sign does not
 *   occur in the evidence"*. No Georgian operator word for any of them is attested in any tier this repo has,
 *   and nothing in the corpus would exercise one. `review.ts` reports them DROPPED and is right to; they are
 *   deliberately NOT entered as accepted silences, because an unmeasured class is a TODO, not a decision.
 *
 *   THE `=` PROBE FORM `x = y`, which `review.ts` also reports DROPPED. That is the rule working: the `=` arm
 *   requires a DIGIT after the sign, and every letter-operand `=` in this corpus is something else — `E = mc²`
 *   and `A=Eკ2-Eკ1` are formulas, `Lingua Latina = ლათინური ენა` and `… = Invia est in medicina via sine
 *   lingua Latina` are bibliographic TITLE equivalences, and `JButton ღილაკი = new JButton(…)` is Java source.
 *   Widening to letter operands would add 5 confidently wrong *უდრის* and 0 correct ones.
 *
 *   A BARE `მ.` / `კმ.` WITH ITS OWN DOT (4 instances). Georgian is UNICASE, so nothing distinguishes an
 *   abbreviation dot from a sentence period after a unit — this is trap 4's German `N.` with the one
 *   discriminator removed. Left alone rather than guessed at.
 *
 * ═══ ORDER IS LOAD-BEARING; each step states its coupling ═══
 */
import { MANIFEST } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";

const N = MANIFEST.numbers;

// ---------------------------------------------------------------------------------------------------
// STEM ALTERNATION — the machinery trap 14 requires, and the thing that makes this layer Georgian.
// ---------------------------------------------------------------------------------------------------

/** A word's declension class, read off its final vowel. Georgian nouns/numerals in -ი carry a nominative
 *  marker that is LOST before every ending; -ა and -ე stems truncate before the "truncating" endings and
 *  keep the vowel before the rest; -ო/-უ (and consonant-final loans) never truncate. */
type Stem = { readonly bare: string; readonly core: string; readonly kind: "i" | "a" | "e" | "o" };

function analyse(word: string): Stem {
    if (word.endsWith("ი")) return { bare: word, core: word.slice(0, -1), kind: "i" };
    if (word.endsWith("ა")) return { bare: word, core: word.slice(0, -1), kind: "a" };
    if (word.endsWith("ე")) return { bare: word, core: word.slice(0, -1), kind: "e" };
    return { bare: word, core: word, kind: "o" };
}

/**
 * The endings the corpus writes after a hyphen, keyed by what is WRITTEN, mapped to the form the WORD takes.
 * The written suffix names the case; the word supplies its own shape — the kk/az lesson, in a language whose
 * alternation is vowel-loss rather than harmony.
 *
 *   ს dat · ის gen · ით ins · მა erg · ად adv · ზე on/at · ში in · იდან~დან from · ამდე~მდე until ·
 *   თან with · ჯერ ×times · იან(ი) -ish (the decade adjective) · ია the copula "is"
 */
const ENDINGS: Readonly<Record<string, (s: Stem) => string>> = {
    // NON-TRUNCATING for a/e stems: the ending simply follows the full word (რვას, რვაზე, რვამდე).
    ს: (s) => (s.kind === "i" ? s.core : s.bare) + "ს",
    ზე: (s) => (s.kind === "i" ? s.core : s.bare) + "ზე",
    ში: (s) => (s.kind === "i" ? s.core : s.bare) + "ში",
    მდე: (s) => (s.kind === "i" ? s.core + "ამდე" : s.bare + "მდე"),
    თან: (s) => (s.kind === "i" ? s.core + "თან" : s.bare + "სთან"),
    ჯერ: (s) => (s.kind === "i" ? s.core : s.bare) + "ჯერ",
    // TRUNCATING for a/e stems: the stem vowel drops before the ending (რვის, რვით, რვიდან, რვიანი).
    ის: (s) => (s.kind === "o" ? s.bare + "ს" : s.core + "ის"),
    ით: (s) => (s.kind === "o" ? s.bare + "თი" : s.core + "ით"),
    ად: (s) => s.core + "ად",
    მა: (s) => (s.kind === "i" ? s.core + "მა" : s.core + "მ"),
    იდან: (s) => (s.kind === "o" ? s.bare + "დან" : s.core + "იდან"),
    იან: (s) => s.core + "იან",
    იანი: (s) => s.core + "იანი",
    // THE COPULA. `500 მმ-ია`, `12 °C-ია`, `4.52-ია` — "is N". An i-stem keeps its -ი (ასია); an a-stem
    // simply lengthens (რვაა).
    ია: (s) => s.bare + "ა",
    // A CASE ENDING PLUS THE COPULA, written as one run after the figure — `–2 °Cმდე`, `540 მმ-ის ტოლია`'s
    // neighbour `-5 °C-მდეა`. Two artifact instances; without them the ending fails its right-boundary test
    // and a bare `მდეა` survives as a token, which is the very defect this file exists to remove.
    მდეა: (s) => (s.kind === "i" ? s.core + "ამდეა" : s.bare + "მდეა"),
    ზეა: (s) => (s.kind === "i" ? s.core : s.bare) + "ზეა",
};

/** The written forms the corpus actually uses, longest-first so `იდან` is tried before `დან` and `იანი`
 *  before `იან`. `დან`/`ამდე` are the SAME endings written short after a figure — the writer abbreviates,
 *  the word does not. */
const WRITTEN: readonly (readonly [string, string])[] = [
    ["იანი", "იანი"], ["იდან", "იდან"], ["ამდე", "მდე"], ["მდეა", "მდეა"], ["იან", "იან"],
    ["დან", "იდან"], ["მდე", "მდე"], ["ზეა", "ზეა"], ["თან", "თან"], ["ჯერ", "ჯერ"],
    ["ის", "ის"], ["ით", "ით"], ["მა", "მა"], ["ად", "ად"], ["ზე", "ზე"], ["ში", "ში"], ["ია", "ია"],
    ["ს", "ს"],
];
const WRITTEN_ALT = WRITTEN.map(([w]) => w).join("|");

/** A Georgian attributive adjective before a case-marked noun drops its own nominative -ი
 *  (კვადრატული კილომეტრი → კვადრატულ კილომეტრზე). Only the two measure adjectives this file emits. */
function truncateAttributive(w: string): string {
    return /(?:ული|ური)$/u.test(w) ? w.slice(0, -1) : w;
}

/**
 * Attach the ending named by `written` to the LAST word of a space-separated phrase, and truncate the
 * attributive adjective in front of it if there is one. `ორი ათასი` + `მდე` → `ორი ათასამდე`;
 * `კვადრატული კილომეტრი` + `ზე` → `კვადრატულ კილომეტრზე`.
 */
function attach(phrase: string, written: string | undefined): string {
    if (written === undefined || written === "") return phrase;
    const key = WRITTEN.find(([w]) => w === written)?.[1];
    const make = key === undefined ? undefined : ENDINGS[key];
    if (make === undefined) return phrase;
    const words = phrase.split(" ");
    const last = words.pop();
    if (last === undefined || last === "") return phrase;
    if (words.length > 0) words[words.length - 1] = truncateAttributive(words[words.length - 1]!);
    return [...words, make(analyse(last))].join(" ");
}

/** The numeral's bare STEM, for the compound-noun writing (`12-წლიანი` → თორმეტწლიანი). */
function stemOf(phrase: string): string {
    const words = phrase.split(" ");
    const last = words.pop()!;
    return [...words, analyse(last).kind === "i" ? analyse(last).core : last].join(" ");
}

// ---------------------------------------------------------------------------------------------------
// ORDINALS — the მე-…-ე circumfix. Composed from the manifest's own cardinal tables, so the vigesimal
// score construction and the hundred truncation are not restated here.
// ---------------------------------------------------------------------------------------------------

/** მე + stem + ე. The strip is uniform across both stem shapes: ორი→მეორე, რვა→მერვე, ცხრა→მეცხრე,
 *  ოცი→მეოცე, ასი→მეასე, ათასი→მეათასე. */
function circumfix(cardinal: string): string {
    return `მე${cardinal.replace(/[ია]$/u, "")}ე`;
}

/** 1–19 → the ordinal. ⚠ ONE is SUPPLETIVE in isolation (პირველი) but regular INSIDE a compound
 *  (ოცდამეერთე, 21st) — the caller says which position it is in. */
function ordSub20(n: number, isolated: boolean): string {
    if (n === 1) return isolated ? "პირველი" : circumfix(N.units[1]!);
    return circumfix(n < 10 ? N.units[n]! : N.teens[n - 10]!);
}

/** 1–99. A round score is ordinalised whole (ოცი→მეოცე, ორმოცი→მეორმოცე); a score compound puts the
 *  circumfix on the REMAINDER only, inside the same word (25 → ოცდა+მეხუთე = ოცდამეხუთე). */
function ordSub100(n: number, isolated: boolean): string {
    if (n < 20) return ordSub20(n, isolated);
    const s = Math.floor(n / 20), r = n - s * 20;
    return r === 0 ? circumfix(N.scores.bare[s]!) : N.scores.comb[s]! + ordSub20(r, false);
}

/** 1–999. The hundred keeps its cardinal COMB form when a remainder follows (179 → ას სამოცდამეცხრამეტე). */
function ordSub1000(n: number, isolated: boolean): string {
    const h = Math.floor(n / 100), r = n % 100;
    if (h === 0) return ordSub100(n, isolated);
    return r === 0 ? circumfix(N.hundreds.bare[h]!) : `${N.hundreds.comb[h]} ${ordSub100(r, false)}`;
}

/**
 * A positive integer → the Georgian ordinal, or `undefined` if this file declines to compose it.
 * ⚠ CAPPED AT 9999 and pinned per BRANCH, not per corpus instance (trap 13): the corpus writes 3, 5, 12, 13,
 * 17, 18, 20, 23, 24, 25, 41 and 179, which exercises the table, the score compound and the hundred head —
 * but never the round score, the round hundred or the thousand, so those have their own tests.
 */
export function ordinalWord(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 9999) return undefined;
    if (n < 1000) return ordSub1000(n, true);
    const th = Math.floor(n / 1000), r = n % 1000;
    const head = th === 1 ? N.magnitudes.thousand.comb : `${numberToWords(th)} ${N.magnitudes.thousand.comb}`;
    return r === 0 ? circumfix(N.magnitudes.thousand.bare) : `${head} ${ordSub1000(r, false)}`;
}

// ---------------------------------------------------------------------------------------------------
// UNIT / SYMBOL VOCABULARY — see the header for the citation of every word.
// ---------------------------------------------------------------------------------------------------

/**
 * Georgian unit abbreviations, longest-first (a 2-letter key must beat the 1-letter ⟨მ⟩). 102 digit-adjacent
 * instances in the artifact — ⟨მმ⟩ ×36, ⟨კმ⟩ ×26, ⟨მ⟩ ×18, ⟨სმ⟩ ×2, ⟨კვტ⟩ ×1.
 *
 * ⚠ THE LATIN SPELLINGS ARE ROBUSTNESS, NOT A MEASURED REPAIR, and the comment says so (trap 22). Digit-
 * adjacent Latin in this corpus is 7 tokens — `8GB`/`25 GB`, `9mm`/`10mm` (gun calibres, which ARE
 * millimetres), `900`/`2100 MHz` — so ⟨km⟩ ×0 here; but this is the corpus's orthography, not the language's
 * vocabulary (trap 38), and a bare `5 km` currently reaches the IPA as the cluster *ˈʊkm* via the English
 * fallback — a pronounceable non-word no leak class can see (trap 56). Only MULTI-LETTER Latin keys are
 * declared: a one-letter Latin key would bite inside the Latin runs this corpus is full of, and it buys
 * nothing measurable (traps 28/46).
 */
const UNITS: readonly (readonly [string, string])[] = [
    ["კვტ", "კილოვატი"], ["მმ", "მილიმეტრი"], ["სმ", "სანტიმეტრი"], ["კმ", "კილომეტრი"],
    ["კგ", "კილოგრამი"], ["წმ", "წამი"], ["წთ", "წუთი"], ["სთ", "საათი"], ["მ", "მეტრი"],
    ["km", "კილომეტრი"], ["mm", "მილიმეტრი"], ["cm", "სანტიმეტრი"], ["kg", "კილოგრამი"],
];
const UNIT_ALT = UNITS.map(([k]) => k).join("|");
const UNIT_WORD = new Map(UNITS.map(([k, w]) => [k, w]));

/** The magnitude abbreviations, which the corpus writes WITH their dot (`$316 მლრდ.`, `4,3 ათ. მეცნიერი`). */
const SCALES: readonly (readonly [string, string])[] = [["მლრდ", "მილიარდი"], ["მლნ", "მილიონი"], ["ათ", "ათასი"]];

const CURRENCY: Readonly<Record<string, string>> = { $: "დოლარი", "€": "ევრო" };

/** A Georgian magnitude word, spelled or abbreviated — used to spot the currency's noun slot. */
const MAG_WORD = "მილიარდ|მილიონ|ათას|მლრდ|მლნ";

const GEO = "\\p{Script=Georgian}";
/** Trap 1: never `\b`. A Georgian word edge, spelled out. */
const NOT_LETTER_BEFORE = "(?<![\\p{L}\\p{M}])";
const NOT_LETTER_AFTER = "(?![\\p{L}\\p{M}])";

/** Compose the cardinal for a written figure that may still carry its decimal separator. Returns the
 *  phrase and, separately, whether it had a fractional tail (the ending attaches to the TAIL's last word). */
function figureToWords(fig: string): string {
    const parts = fig.split(/[.,]/u);
    return parts.map((p) => (p === "" ? "" : numberToWords(Number(p)))).filter((p) => p !== "").join(" ");
}

// ---------------------------------------------------------------------------------------------------
// THE RULES
// ---------------------------------------------------------------------------------------------------

/** Normalize one Georgian input string. Pure text→text; every word emitted is phonemized by the g2p
 *  downstream, so no spelling reaches the phoneme sink (trap 6). */
export function normalizeGeorgian(input: string): string {
    let s = input;

    // 0) FOLD THE MASCULINE ORDINAL INDICATOR onto the degree sign. `41,5º განედსა და 41,5º გრძედზე` —
    //    U+00BA standing in for U+00B0 in a coordinate, the same substitution hi found (trap 25). This is
    //    the artifact scan's one `LEAK RAWMARK`. A FOLD of one character, never NFKC (trap 36).
    s = s.replace(/º/gu, "°");

    // 1) DE-GROUP, FIRST OF ALL. The engine's TOKEN is `\d+`, so a space- or comma-grouped thousand splits
    //    into separate numbers and the grouping comma reads as a CLAUSE PAUSE — `5 000` came out
    //    *χutʰi nuli*, "five zero". This must precede every rule that reads a number or a pause.
    //    Space grouping ×45 in the artifact (`5 000`, `83 500`, `1 900 000`), run twice for two groups.
    for (let i = 0; i < 2; i++) s = s.replace(/(?<=\d)[ \u00a0\u202f\u2009](\d{3})(?!\d)/gu, "$1");
    //    Comma grouping ×7, all English-style imports; `,`+1–2 digits (×105) is the decimal and is NOT
    //    touched. A leading `0,` is excluded — that is where a genuine 3-place Georgian decimal would be.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d.,])/gu, (_m, head: string, rest: string) =>
        head + rest.replace(/,/gu, ""));

    // 2) SIGNS — AND THEY RUN HERE, ABOVE EVERYTHING THAT SPENDS A DEGREE SIGN OR A UNIT (trap 39).
    //    The first version put them last and the minus VANISHED on every one of its nine true instances:
    //    the guard is "a sign before a figure that is followed by °", and by then step 5 had already turned
    //    `- 32 °C` into `ოცდათორმეტი გრადუსი ცელსიუსი` — no `°` left to reject or accept. Same for `(-28 მ)`,
    //    whose unit had been consumed. A guard cannot live downstream of the rule that rewrites its evidence.
    //    SIGNS. ⚠ THE MINUS IS TRAP 24's SHAPE, MEASURED — a loose rule would eat the corpus's ranges and
    //     its eight ISBNs. Counted over the artifact:
    //         U+2212 `−`                                    ×3  — every one a true negative (`−500/400 = −2`)
    //         `(` immediately + `-` + digits                ×2  — `(-28 მ)`, `(-33 °C)`, both true
    //         start/space + `-`/`–` + digits + a degree     ×9  — every one a temperature minimum
    //         digit + `-` + digits + a degree (a RANGE)     ×2  — `(3-5 °C)`, `(23-28 °C)`, correctly excluded
    //     An opening bracket cannot be the value-introducing dash that generates the false positives
    //     (`მაქსიმუმი – 760 მმ`, `მაჩვენებელს - 400 კუბურ სანტიმეტრს`), which is what separates the two.
    //     Omitting a plus is lossless; omitting a minus INVERTS — so the arms are not symmetrical.
    s = s.replace(/−/gu, " მინუს ");
    s = s.replace(/\((-)(?=\s?\d)/gu, "( მინუს ");
    s = s.replace(/(^|[\s(])[-–](?=\s?\d[\d.,]*\s?°)/gu, "$1მინუს ");
    //     ⚠ AND A SECOND, WIDER ARM, MEASURED THE SAME WAY: a sign GLUED to its figure (no space between
    //     them) after a space, a bracket or the string start. 14 artifact instances, **12 true and 2 false**,
    //     and the two false ones are `(1627 –1628)` / `(2014 –2017)` — year ranges whose dash happens to be
    //     spaced on the left and glued on the right. `(?<!\d\s)` removes exactly those and nothing else. The
    //     gain over the degree arm alone is the elevation `-28 მეტრიდან`, whose unit is SPELLED so no `°`
    //     guard could see it, and a bare `-5`, which is what makes the class readable rather than
    //     shape-specific. The corpus's remaining false-positive class — a value-introducing dash
    //     (`მაქსიმუმი – 760 მმ`, `მაჩვენებელს - 400 კუბურ სანტიმეტრს`) — is SPACED after the sign, every time.
    s = s.replace(/(^|[\s(])(?<!\d\s)[-–](?=\d)/gu, "$1მინუს ");
    //     THE PLUS. ×8: five are `+24,4 °C` (a temperature) and three `(63+33 წევრი)` (a seat SUM) — and the
    //     attesting sentence covers the second exactly, *"„ორს პლუს ორი უდრის ხუთს“ (2 + 2 = 5)"*.
    s = s.replace(/(^|[\s(])\+\s?(?=\d)/gu, "$1პლუს ");
    s = s.replace(/(?<=\d)\s?\+\s?(?=\d)/gu, " პლუს ");
    //     `=`, from the same sentence, and the frame is confirmed on its own: *"1 ტონა უდრის 1.000
    //     კილოგრამს"*, *"1 კმ² უდრის:"*. ⚠ THE RIGHT SIDE IS THE DISCRIMINATOR, not the left. Requiring a
    //     digit on the RIGHT admits the corpus's `1900/400 = 4`, `−500/400 = −2` and `დღე = 365.2425 დღე`,
    //     and excludes every counter-example it has: `E = mc²`, `A=Eკ2-Eკ1` (letter operands) and the two
    //     bibliographic TITLE equivalences `Lingua Latina = ლათინური ენა`, `… = Invia est in medicina …`,
    //     which have no digit after the sign. Left context is a digit or a Georgian letter, so the sign is
    //     not claimed out of a Latin run.
    s = s.replace(/(?<=[\d\p{Script=Georgian}])\s*=\s*(?=(?:მინუს\s+)?\d)/gu, " უდრის ");
    //     `№`, preposed. One instance (`ქუჩა № 37`), and the sign was dropped outright.
    s = s.replace(/№\s?(?=\d)/gu, "ნომერი ");


    // 3) THE CLOCK, BEFORE anything that reads a bare number or a pause — `15:00` read *tʰχutʰmɛtʼi , nuli*,
    //    the colon becoming a sentence break. The component frame is this corpus's own:
    //    *"365 დღე, 5 საათი, 49 წუთი და 12 წამი"* and *"20 საათი და 41 წუთი"*.
    //
    //    ⚠ A CONTEXT IS REQUIRED for the 2-field form, measured rather than assumed: 11 of the artifact's 12
    //    colon-times carry `საათზე` / `UTC` / `-ზე` / `დროით`, and the twelfth (`8:04`) is a TRACK LENGTH.
    //    A 3-field `h:mm:ss` is unambiguous enough to stand alone.
    //
    //    ⚠ THE FOLLOWING `საათ…` IS CONSUMED AND ITS CASE MOVED TO THE LAST COMPONENT (trap 12: say it once,
    //    in the position the language puts it; trap 10: put back what you consume — the CASE is what carried
    //    meaning, and it is re-emitted). `15:00 საათზე` → *თხუთმეტი საათზე*, which is exactly the Georgian.
    s = s.replace(
        new RegExp(`(?<![\\d:.,])(\\d{1,2}):([0-5]\\d)(?::([0-5]\\d))?(?![\\d:])` +
            `(?:\\s*-?(${WRITTEN_ALT})${NOT_LETTER_AFTER})?` +
            `(?:\\s+(საათ(?:${WRITTEN_ALT})?)${NOT_LETTER_AFTER})?`, "gu"),
        (m0, h: string, mi: string, se: string | undefined, sfx: string | undefined, hourWord: string | undefined) => {
            const hv = Number(h), mv = Number(mi);
            if (hv > 23) return m0;
            // THE CONTEXT TEST, and it is what the MATCH ITSELF captured: a third field, a glued case
            // ending, or the following `საათ…`. A bare `H:MM` with none of these is left alone — `8:04` in
            // the artifact is a track length, not a time of day. (`UTC` is the fourth context and is the
            // separate arm below, because the zone name must survive the rewrite unchanged.)
            if (se === undefined && sfx === undefined && hourWord === undefined) return m0;
            const ending = sfx ?? (hourWord === undefined ? undefined : hourWord.slice("საათ".length) || undefined);
            const parts: string[] = [`${numberToWords(hv)} საათი`];
            if (mv !== 0 || se !== undefined) parts.push(`${numberToWords(mv)} წუთი`);
            if (se !== undefined) parts.push(`${numberToWords(Number(se))} წამი`);
            const joined = parts.length === 1 ? parts[0]!
                : `${parts.slice(0, -1).join(", ")} და ${parts[parts.length - 1]}`;
            return attach(joined, ending);
        });
    //    3b) THE TIMEZONE ARM. `04:35 UTC`, `01:46:40 UTC`, `06:39:42 UTC` — the zone name is the context,
    //        and it stays as written (the shared foreign-run pass reads it).
    s = s.replace(/(?<![\d:.,])(\d{1,2}):([0-5]\d)(?![\d:])(?=\s*(?:UTC|GMT))/gu,
        (m0, h: string, mi: string) => (Number(h) > 23 ? m0
            : `${numberToWords(Number(h))} საათი და ${numberToWords(Number(mi))} წუთი`));

    // 4) ORDINALS. Both halves of the circumfix, and the CENTURY.
    //    4a) `მე-N` — the prefix half, ×7. Guarded on the left so the 1sg pronoun მე cannot start a match
    //        from inside a word.
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}მე-(\\d{1,4})(?![\\d.,])`, "gu"), (m0, d: string) =>
        ordinalWord(Number(d)) ?? m0);
    //    4b) `N-ე` — the suffix half, ×6 (`179-ე`, `25-ე`, `41-ე`).
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d{1,4})-ე${NOT_LETTER_AFTER}`, "gu"), (m0, d: string) =>
        ordinalWord(Number(d)) ?? m0);
    //    4b′) `1-ლი` — the ONE ordinal is suppletive (პირველი) and so is its abbreviation: Georgian writes
    //        the last SYLLABLE, `-ლი`, where every other ordinal writes `-ე`. ×0 in this corpus and shipped
    //        anyway, because it is the adversarial neighbour of the rule above (trap 8) and the shape is not
    //        derivable from it — `1-ე` would be a different (and wrong) word.
    s = s.replace(new RegExp(`(?<![\\d.,])1-ლი${NOT_LETTER_AFTER}`, "gu"), "პირველი");
    //    4b″) A SINGLE-LETTER ROMAN CENTURY, WHICH THE SHARED PASS DELIBERATELY DOES NOT CONVERT.
    //        `core/roman.ts` returns any one-letter token unchanged — "single letters are never worth the
    //        risk (I, V, X, C, D, M, L)", its own comment — which is right for the fleet and leaves ⟨V⟩ ×4
    //        and ⟨X⟩ ×1 in this corpus reading as the ENGLISH LETTER NAMES *vˈiː* and *ˈɛks* through the
    //        foreign-run host: a defect that produces a plausible reading, which no leak class sees
    //        (trap 56). The century noun is the disambiguator the shared pass cannot have, because it is
    //        language-specific — so this is handled HERE rather than by widening core (58 roman centuries
    //        in the artifact; the other 53 are multi-letter and are digits by the time this file runs).
    //        Restricted to I/V/X: L/C/D/M before a century noun is not a real century, and ⟨C⟩ in
    //        particular is the Celsius letter ×75 in this corpus.
    s = s.replace(/(?<![\p{L}\p{M}])([IVX])(?![\p{L}\p{M}])(\s+)(?=საუკუნ|ათასწლეულ)/gu,
        (m0, r: string, sp: string) => {
            const n = { I: 1, V: 5, X: 10 }[r];
            const ord = n === undefined ? undefined : ordinalWord(n);
            return ord === undefined ? m0 : ord + sp;
        });

    //    4c) THE CENTURY / MILLENNIUM. 63 artifact instances, and by the time this file runs they are
    //        DIGITS: `ka` is not in `ROMAN_NATIVE`, so `registry.ts` has already turned `XVIII` into `18`
    //        (verified through the real phonemizer — `XVIII საუკუნე` → *tʰvɾamɛtʼi saukʼunɛ*). Georgian
    //        reads a century as an ORDINAL, which this corpus states in words twice: *"მეთვრამეტე საუკუნის
    //        პირველი მახასიათებელია"*, *"მეთვრამეტე საუკუნეში"*; and it writes the digit form the same way
    //        once, `20-ე საუკუნე`. Capped at 21 so an ordinary count (`2 საუკუნის განმავლობაში`) is out of
    //        range only where it plausibly is one — the artifact has no such counter-example.
    s = s.replace(/(?<![\d.,\p{L}\p{M}])(\d{1,2})(?=\s+(?:საუკუნ|ათასწლეულ))/gu, (m0, d: string) => {
        const n = Number(d);
        return n >= 1 && n <= 21 ? ordinalWord(n) ?? m0 : m0;
    });

    // 5) DEGREES, before the general suffix rule so `°C-მდე` / `°C-ია` attach to ცელსიუსი and not to a bare
    //    figure. The frame is the attested one: *"34 გრადუსი ცელსიუსი"* — the scale name FOLLOWS the degree
    //    noun. ⚠ ⟨C⟩ was reaching the IPA as the ENGLISH letter *sˈiː*, so this is a wrong reading being
    //    replaced, not merely a silence (trap 56).
    const DEG = `(?:\\s*-?(${WRITTEN_ALT})${NOT_LETTER_AFTER})?`;
    s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s?°\\s?C${DEG}`, "gui"), (_m, d: string, sfx: string | undefined) =>
        attach(`${figureToWords(d)} გრადუსი ცელსიუსი`, sfx));
    s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s?°\\s?F${DEG}`, "gui"), (_m, d: string, sfx: string | undefined) =>
        attach(`${figureToWords(d)} გრადუსი ფარენჰაიტი`, sfx));
    //    A BARE degree — the coordinate/declination form (`41,5° განედსა`, `მინუს 7.2°`), ×3 after step 0.
    s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s?°${DEG}`, "gu"), (_m, d: string, sfx: string | undefined) =>
        attach(`${figureToWords(d)} გრადუსი`, sfx));

    // 6) PERCENT AND PER MILLE, postposed, with the ending attaching to the WORD — 100 artifact instances
    //    and five of them carry one (`82%-ით`, `98 %-მა`, `4 %-ს`, `54 %-ის`). Reading the ending as its own
    //    token gave *…itʰ*, a bound morpheme standing alone. Both signs were DROPPED outright before this.
    s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s?%${DEG}`, "gu"), (_m, d: string, sfx: string | undefined) =>
        attach(`${figureToWords(d)} პროცენტი`, sfx));
    s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s?‰${DEG}`, "gu"), (_m, d: string, sfx: string | undefined) =>
        attach(`${figureToWords(d)} პრომილე`, sfx));
    //    A `%` WITH NO FIGURE BESIDE IT is still the word, and it is the artifact's last surviving percent
    //    drop: `ერთობლივი ეროვნული პროდუქტი: სტრუქტურა (%)` — a table header naming the unit. One instance,
    //    and it is the only bare `%` in the corpus, so the arm cannot misfire on anything counted.
    //    No lookbehind is needed or wanted: the digit-adjacent arm above has already consumed every `%` that
    //    has a figure, so whatever is left here is bare by construction.
    s = s.replace(new RegExp(`%${DEG}`, "gu"), (_m, sfx: string | undefined) => attach("პროცენტი", sfx));

    // 7) UNITS. Ordered longest-key-first, and the COMPOSED forms before the bare ones — `კვ. კმ` must not
    //    be read as ⟨კვ⟩ plus ⟨კმ⟩, and `კმ²` must not be read as ⟨კმ⟩ with the exponent dropped (which is
    //    what happened: `500 კმ²` → *χutʰasi kʼm*, the ² gone and the abbreviation in the IPA raw).
    //
    //    ⚠ THE MEASURE WORD IS PREPOSED, which is what the corpus's own gloss says: *"1 Mm² აღნიშნავს ერთ
    //    კვადრატულ მეგამეტრს"* and *"10¹² მ² (და არა 1 000 000 × კვადრატული მეტრი)"*, *"426 კუბური
    //    სანტიმეტრი"*. And it is an ADJECTIVE, so it truncates when the noun takes an ending — `attach()`
    //    does that (`1 კმ²-ზე` → *ერთი კვადრატულ კილომეტრზე*).
    //
    //    7a) `კვ. კმ` / `კვ კმ` — the spelled-out square, ×3 (`69 700 კვ. კმ-ს`, `1 კვ კმ-ზე`, `2919 კვ.კმ-ს`).
    s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s?კვ\\.?\\s?(${UNIT_ALT})${DEG}`, "gu"),
        (_m, d: string, u: string, sfx: string | undefined) =>
            attach(`${figureToWords(d)} კვადრატული ${UNIT_WORD.get(u)}`, sfx));
    //    7b) THE RATE, and it must run BEFORE the exponent — `კაცი/კმ²`'s denominator is itself an exponent,
    //        so letting 6c spend the ² first leaves the slash with nothing a rate rule can recognise
    //        (trap 39: a guard's evidence has a lifetime).
    //        Georgian's "per" with a unit is the unit in `-ში` / `-ზე`, which this corpus sources on its own
    //        by writing the density BOTH ways: *"1 კვ კმ-ზე 2495,9 ადამიანი ცხოვრობს"* beside `კაცი/კმ²` ×7.
    //        *"მშპ საათში მუშაობისათვის"* gives the speed form.
    //        ⚠ `კვტ/სთ` IS NOT A RATE — a kilowatt-HOUR is a product, not "kilowatts per hour" — so it gets
    //        its own compound key, tried first (trap 44: a slashed key outranks the rate path).
    s = s.replace(/(?<![\p{L}\p{M}])კვტ\s?\/\s?სთ(?![\p{L}\p{M}])/gu, "კილოვატ საათი");
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}(${UNIT_ALT})\\s?\\/\\s?(${UNIT_ALT})${NOT_LETTER_AFTER}`, "gu"),
        (_m, a: string, b: string) => `${UNIT_WORD.get(a)} ${attach(UNIT_WORD.get(b)!, b === "სთ" ? "ში" : "ზე")}`);
    s = s.replace(new RegExp(`(${GEO}+)\\s?\\/\\s?(${UNIT_ALT})([²³])?${NOT_LETTER_AFTER}`, "gu"),
        (_m, head: string, u: string, ex: string | undefined) => {
            const noun = ex === undefined ? UNIT_WORD.get(u)! : `${ex === "²" ? "კვადრატული" : "კუბური"} ${UNIT_WORD.get(u)}`;
            return `${head} ${attach(noun, "ზე")}`;
        });
    //    7c) THE EXPONENT, ² and ³ — 31 artifact instances (`კმ²` ×25, `სმ³` ×2, `მ²`), 28,815 dump-wide.
    //        ⚠ TWO ARMS, BECAUSE `\s?` ON AN OPTIONAL OPERAND EATS THE WORD BOUNDARY. Written as one rule
    //        with `(\d…)?\s?`, the corpus's `98 კაცი კმ²-ზე` matched from the SPACE before ⟨კმ⟩ and the
    //        replacement did not put it back — *კაციკვადრატულ კილომეტრზე*, two words fused into one, caught
    //        by reading the corpus diff and by nothing else (trap 10: re-emit what you consume).
    const exponentNoun = (u: string, ex: string): string =>
        `${ex === "²" ? "კვადრატული" : "კუბური"} ${UNIT_WORD.get(u)}`;
    s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s?${NOT_LETTER_BEFORE}(${UNIT_ALT})([²³])${DEG}`, "gu"),
        (_m, d: string, u: string, ex: string, sfx: string | undefined) =>
            attach(`${figureToWords(d)} ${exponentNoun(u, ex)}`, sfx));
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}(${UNIT_ALT})([²³])${DEG}`, "gu"),
        (_m, u: string, ex: string, sfx: string | undefined) => attach(exponentNoun(u, ex), sfx));
    //    7d) THE PLAIN UNIT. 102 artifact instances, ⟨მმ⟩ ×36 and ⟨კმ⟩ ×26 the bulk of them. Before this,
    //        every one reached the IPA as a raw consonant cluster (/kʼm/, /sm/) — pronounceable garbage,
    //        which no leak class sees (trap 56).
    s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s?${NOT_LETTER_BEFORE}(${UNIT_ALT})${DEG}${NOT_LETTER_AFTER}`, "gu"),
        (_m, d: string, u: string, sfx: string | undefined) => attach(`${figureToWords(d)} ${UNIT_WORD.get(u)}`, sfx));
    //    7e) THE MAGNITUDE ABBREVIATIONS, with their own dot consumed — `$316 მლრდ.` read *mlɾtʰ* plus a
    //        false clause pause. The dot belongs to the abbreviation; when a sentence also ends there
    //        Georgian writes only that one dot and this loses the pause (`($24 მლრდ.).` keeps its outer one).
    for (const [abbr, word] of SCALES)
        s = s.replace(new RegExp(`(?<=\\d)\\s?${NOT_LETTER_BEFORE}${abbr}\\.?${DEG}${NOT_LETTER_AFTER}`, "gu"),
            (_m, sfx: string | undefined) => ` ${attach(word, sfx)}`);

    // 8) CURRENCY, postposed after the magnitude in the NOMINATIVE — which is the frame the attesting
    //    sentence itself uses: *"1995 წელს $380 მილიარდზე მეტი დოლარი"*, the case on the magnitude and the
    //    currency name plain after it. 25 artifact instances, `$` ×23 and `€` ×2; the sign was dropped
    //    outright (`$25 მილიონი` → *ოცდახუთი მილიონი*, the dollar gone).
    //    ⚠ REDUNDANCY SUPPRESSION (trap 12): `$5 მილიარდი დოლარის დახმარება` writes the sign AND the word.
    //    Say it once — drop the sign and keep the words the language already put there.
    for (const [sign, word] of Object.entries(CURRENCY)) {
        const S = sign.replace(/[$]/gu, "\\$");
        const stem = word.replace(/[ია]$/u, ""); // დოლარი → დოლარ, ევრო → ევრო: matches any inflected form
        s = s.replace(new RegExp(`${S}\\s?(\\d[\\d.,]*)((?:\\s+(?:${MAG_WORD})${GEO}*)?)` +
            `(?:\\s*-?(${WRITTEN_ALT})${NOT_LETTER_AFTER})?`, "gu"),
            (m0: string, d: string, mag: string, sfx: string | undefined, offset: number, whole: string) => {
                const head = `${figureToWords(d)}${mag}`;
                // ⚠ ALREADY SAID (trap 12). `$5 მილიარდი დოლარის დახმარება` writes the sign AND the word;
                // the reading must say it once, in the position the language put it — so drop the sign and
                // let the existing word stand. Looked up in the text AFTER the match, which is where a
                // redundant currency noun sits.
                const after = whole.slice(offset + m0.length);
                if (new RegExp(`^\\s*${stem}`, "u").test(after)) return head;
                return attach(`${head} ${word}`, sfx);
            });
        //    …and the POSTPOSED sign, `860 $.` — one instance, and the only shape where the figure leads.
        s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s${S}(?!\\d)`, "gu"), (_m, d: string) => `${figureToWords(d)} ${word}`);
    }

    // 9) ERA MARKERS AND DOTTED ABBREVIATIONS. Multi-dot before single-dot, and each in two arms — before a
    //    WORD the dot is consumed, before punctuation or a clause end it becomes one period, so no sentence
    //    pause is lost (the kk shape). `ძვ. წ. 480` read *d͡zv . t͡sʼ .* — two consonant clusters and two
    //    false pauses. 55 artifact instances; era markers alone are 6,492 dump-wide.
    const ABBREV: readonly (readonly [string, string])[] = [
        ["ძვ\\.\\s?წ\\.", "ძველი წელთაღრიცხვით"],
        ["ახ\\.\\s?წ\\.", "ახალი წელთაღრიცხვით"],
        ["ე\\.\\s?წ\\.", "ეგრეთ წოდებული"],
        ["ა\\.\\s?შ\\.", "ასე შემდეგ"],
        ["მ\\.\\s?შ\\.", "მათ შორის"],
        ["დაახლ\\.", "დაახლოებით"],
        ["სხვ\\.", "სხვა"],
        ["წწ\\.", "წლები"],
    ];
    for (const [pat, expansion] of ABBREV) {
        // ⚠ `\s*`, NOT `\s+`, AND THE SPACE IS RE-EMITTED. The corpus writes `549/546-დაახლ.ძვ.წ. 480` with
        // no space after the abbreviation's dot, and a `\s+` arm matched neither that nor the punctuation
        // arm — so `დაახლ.` survived as the cluster /daaχl/ plus a false pause, which is the defect.
        s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}${pat}\\s*(?=[\\p{L}\\d])`, "gu"), `${expansion} `);
        s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}${pat}(?=\\s*(?:[.,;:!?»)\\]]|$))`, "gu"), `${expansion}.`);
    }

    // 10) FRACTIONS. `1/3-ს`, `1/3-ზე` — the slash was dropped and the digits read in order (*ერთი სამი*).
    //    Georgian reads the denominator as an ordinal in -ედ: მესამედი, მეხუთედი, მეათედი, მეასედი — and the
    //    top of that series is attested in exactly the definitional slot (*"მთელის მეასედი ნაწილი"* for %,
    //    *"მთელის მეათასედი ნაწილი"* / *"პროცენტის მეათედი ნაწილი"* for ‰), so the series is composed from
    //    `ordinalWord`'s own stem rather than tabulated. ⚠ `1/2` IS SUPPLETIVE — ნახევარი, not *მეორედი*.
    //    ⚠ TABULATE BEFORE RULING (trap 4), because the SLASH IS MOSTLY NOT A FRACTION HERE. All ten
    //    artifact instances read: `1/3` ×2 (the only fractions), `21/22 მარტი` / `8/9 იანვარი` /
    //    `16/17 ივლისი` (DATE alternatives — old-style vs new-style calendar), `549/546-დაახლ.ძვ.წ.` and
    //    `180/190-ძვ.წ.` (YEAR spans), `1900/400 = 4` and `−500/400 = −2` (DIVISIONS in a leap-year
    //    formula), `1/2006` (a journal issue). A ceb-shaped "digits on both sides" rule would have fixed 2
    //    and broken 6 (trap 55). Three guards, each removing one class and measured to zero false
    //    positives here: numerator < denominator ≤ 100 (kills the year spans and the issue number), and a
    //    following MONTH NAME is excluded (kills the date alternatives).
    //    AFTER the rate rules, so a unit slash is already spent (trap 39).
    const MONTHS = "იანვ|თებერვ|მარტ|აპრილ|მაის|ივნის|ივლის|აგვისტ|სექტემბ|ოქტომბ|ნოემბ|დეკემბ";
    //    ⚠ AND IT CLAIMS ITS OWN ENDING. Both corpus instances carry one (`1/3-ს`, `1/3-ზე`); leaving it to
    //    step 10 is not an option, because by then the operand is WORDS and step 10 only matches digits —
    //    the ending would survive as the free token *s*, which is the defect, not the fix.
    s = s.replace(new RegExp(`(?<![\\d.,/])(\\d{1,3})\\s?\\/\\s?(\\d{1,3})(?![\\d.,/])(?!\\s*(?:${MONTHS}))${DEG}`, "gu"),
        (m0, a: string, b: string, sfx: string | undefined) => {
            const num = Number(a), den = Number(b);
            if (num < 1 || den < 2 || den > 100 || num >= den) return m0;
            if (den === 2) return attach("ნახევარი", sfx); // the numerator can only be 1 under `num < den`
            const ord = ordinalWord(den);
            if (ord === undefined) return m0;
            // მეხუთე → მეხუთედი. ⚠ THE DERIVATION IS VALIDATED, not asserted: run on 10 and 100 it
            // reproduces მეათედი and მეასედი, which are the two forms ka.wikipedia states independently
            // as the readings of ‰ and % — so the composition is checked where the answer is known
            // before being used where it is not.
            return attach(`${numberToWords(num)} ${ord.replace(/ე$/u, "ედი")}`, sfx);
        });

    // 11) THE GENERAL GLUED SUFFIX ON A BARE FIGURE — the rest of trap 14, after every symbol rule has had
    //     its chance to claim its own ending. `2000-მდე` → ორ ათასამდე, `100-ზე` → ასზე, `90-იან` →
    //     ოთხმოცდაათიან, `8-ჯერ` → რვაჯერ, `4.52-ია` → …ორმოცდათორმეტია.
    //     ⚠ THE OPERAND MUST BEGIN AND END IN A DIGIT and may not be letter-preceded — otherwise `ლბ1-ის`
    //     (a fossil's catalogue number) and `S60-ზე` would be read as quantities, and a trailing separator
    //     would be swallowed (trap 14's Welsh hazard).
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}(?<![\\d.,])(\\d[\\d.,]*\\d|\\d)-(${WRITTEN_ALT})${NOT_LETTER_AFTER}`, "gu"),
        (m0, d: string, sfx: string) => {
            const words = figureToWords(d);
            return words === "" ? m0 : attach(words, sfx);
        });
    //     11b) THE COMPOUND NOUN WRITING — `12-წლიანი` (12-year), `120,000-კაციანი` (120,000-person). The
    //          numeral FUSES with the noun in Georgian, so the hyphen is a word-internal boundary and the
    //          numeral appears as its bare stem (თორმეტწლიანი). Restricted to an `-იან-` derivative, which
    //          is what keeps it off `549/546-დაახლ.ძვ.წ. 480` — four artifact hyphens that look like a
    //          suffix and are a RANGE DASH in front of an abbreviation (trap 2: read the instances).
    s = s.replace(new RegExp(`${NOT_LETTER_BEFORE}(?<![\\d.,])(\\d+)-(${GEO}{2,}იან[ია]?)${NOT_LETTER_AFTER}`, "gu"),
        (m0, d: string, tail: string) => {
            const words = numberToWords(Number(d));
            return words === "" ? m0 : `${stemOf(words)}${tail}`;
        });

    // 12) THE DECIMAL SEPARATOR — LAST, so that every rule above still sees the number ADJACENT to its unit
    //     (the playbook's "units before decimals" coupling), and so that step 10 could attach an ending to
    //     `4.52-ია`. ⚠ NO WORD IS EMITTED: see the header — the reading is unsourceable and the two
    //     candidates fail on sense. What is removed is the CLAUSE PAUSE, which is wrong under every
    //     candidate reading, and nothing is put in its place.
    s = s.replace(/(?<=\d)[.,](?=\d)/gu, " ");

    return s;
}
