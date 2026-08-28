/**
 * Sylheti / ꠍꠤꠟꠐꠤ ꠘꠣꠉꠞꠤ (syl) text normalization — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ── WHAT THE CORPUS IS ────────────────────────────────────────────────────────────────────────────────
 *
 * `tools/corpus/mined/syl.jsonc`, a syl.wikipedia dump (1523 segments; the 122-segment excerpt tier is what
 * the counts below are measured over unless stated). Three facts about it decide every rule here.
 *
 * ⚠ THE SCRIPT QUESTION, SETTLED BEFORE ANY RULE WAS WRITTEN. Sylheti is widely written in the
 * Bengali-Assamese script, so a rule keyed on Syloti Nagri could have been a silent no-op. It is not:
 * the corpus is 35,930 Syloti Nagri characters against 90 Bengali LETTERS, and reading all 90 splits them
 * into three groups, none of which is "the article is in Bengali script" —
 *   (1) Bengali marks typed INSIDE a Syloti Nagri word (ꠝূꠟ꠆ꠎꠝꠣꠘ, ꠙꠞꠤꠝꠣণꠦ, ꠛꠤꠛꠦꠌꠘꠣꠎ়, ꠀঁꠡ, ꠃৎꠙꠣꠖꠘ),
 *       i.e. slips from a Bengali keyboard — 17 of them the bare nukta ়. STEP 2 repairs these;
 *       ⚠ AND `BN_TO_SYL` HAD A HOLE IN EXACTLY THIS GROUP, found while porting: ৃ U+09C3, the vocalic-R
 *       vowel sign, is inside `BN_LETTER`'s range — so it makes a run "mixed" and the fold runs — but had
 *       no table entry, so it survived the fold, fell outside the word class, and SPLIT THE TOKEN: 7
 *       instances, `ꠙ꠆ꠞꠜৃꠔꠤ` (প্রভৃতি) read `ɸɾɔb t̪i`, which is the same failure `ꠝূꠟ꠆ꠎꠝꠣꠘ` → `mɔ lzɔman`
 *       is cited for below. All 7 fix the value: প্রভৃতি, ব্যবহৃত, পৃথিবী, বৃহত্তম, পথিকৃত — ৃ is [ri]
 *       in every one, so it folds to ꠞꠤ (ra + i-sign), and ঋ, its independent counterpart, with it;
 *   (2) genuine Bengali-script GLOSSES, quoted AS Bengali inside a ꠪ language tag (বাংলাদেশ) — step 2
 *       must NOT touch these, which is why its guard is "a Syloti neighbour in the same token";
 *   (3) `৳` U+09F3, the taka sign — a currency fact, not a script choice. Step 9.
 *
 * ⚠ THE DIGIT QUESTION. Syloti Nagri has NO digit block of its own (U+A800–A82F is letters and poetry
 * marks; U+A830–A83F, Common Indic Number Forms, is ×0 here), so the corpus writes Bengali digits (463)
 * and ASCII (271) side by side. This layer needs no fold: `registry.ts` folds native digits at the single
 * dispatch point for every language but `te`, and its own comment names `syl` as one of the seven engines
 * whose digits used to read as the empty string. Verified: `৫২৬ ꠎꠣꠔꠤ` and `526 ꠎꠣꠔꠤ` are byte-identical.
 * But every pattern below is keyed on `\p{Nd}`, never `\d` and never `[0-9]` — 63% of this corpus's digits
 * are Bengali, so an ASCII-only selector would silently cover a third of it.
 *
 * ⚠ EVERY BOUNDARY IS AN EXPLICIT LOOKAROUND, NEVER `\b`, which is ASCII-defined and finds no boundary at
 * all against Syloti Nagri.
 *
 * ── WHAT IS NOT IN THIS LAYER ─────────────────────────────────────────────────────────────────────────
 *
 * The single largest defect in Sylheti was not a number rule: the corpus's own SENTENCE TERMINATOR
 * (⁕ U+2055, ×476) was undeclared, ꠨ was declared as a full stop while being a comma, and all four Syloti
 * poetry marks were unreachable because they live inside the block the word class claimed. That is
 * `sylheti.jsonc` + the `TOKEN` regex, and it is fixed there — see both files' comments.
 *
 * ── DECLINED, WITH THE COUNTS ─────────────────────────────────────────────────────────────────────────
 *
 *  • MINUS — declined for want of a word, not for want of a defect. The corpus has three GENUINE negatives
 *    (`ꠍꠦꠟꠍꠤꠀꠍ ꠁꠃꠘꠤꠐꠅ -২৭৩.১৫° ꠍꠦ.` and `ꠚꠣꠞꠦꠘꠢꠣꠁꠐ ꠁꠃꠘꠤꠐꠅ -৪৫৯.৬৭° ꠚꠣ.`, absolute zero), so this is the
 *    class where silence INVERTS the meaning and the playbook's "a plus may be dropped, a minus may not"
 *    applies. Nothing attests a word: `attest.ts --lang syl` returns 0/0 for ꠝꠣꠁꠘꠣꠍ, ꠝꠣꠁꠘꠥꠍ, ꠞꠤꠘꠣꠔ꠆ꠝꠇ and
 *    ꠘꠦꠉꠦꠐꠤꠛ; syl.wikipedia's only ꠞꠤꠘ hit is inside an article title; en.wiktionary has no Sylheti entries
 *    at all. A refusal resting on silence needs a dictionary check first (the Igbo lesson) and that check
 *    was run and came back empty. The sign therefore stays UNREAD and `review.ts --lang syl` stays RED on
 *    it — a known-wrong silence does not get to be a green gate.
 *  • THE MATH SIGNS (`=` ×37, `+` ×3, `×` ×6, `>` ×3, `&` ×2). ⚠ THE FIRST DRAFT OF THIS NOTE SAID "ALL
 *    CITATION RESIDUE" AND WAS WRONG — reading every instance instead of counting them found four kinds.
 *    Most of the `=` is residue (`|last1=Lawson`, `|s2cid=144496795`, `|doi=10.1016/…`); but three `+`/`=`
 *    are ORTHOGRAPHIC composition in the script article (`ꠏꠦꠝꠘ ꠔ+ꠤ=ꠔꠤ`, "for example ta + i = ti"), the
 *    `×` is an acronym separator (`ꠝꠦ×ꠅ×ꠍ`) plus the corpus glossing the character itself, the three `>`
 *    are a LANGUAGE-DESCENT chain (`ꠡꠋꠍꠇ꠆ꠞꠤꠔ > ꠝꠣꠉꠗꠤ > ꠍꠤꠟꠐꠤ > ꠛꠣꠋꠟꠣ` — Sanskrit gives Magadhi gives
 *    Sylheti gives Bangla), and there is exactly ONE real equation, a currency conversion
 *    (`1 ꠒꠟꠣꠞ = 84 ꠐꠦꠇꠣ`). No Sylheti word is attested for any of these relations, so none is read. The
 *    full taxonomy and its counts are in `tools/normalization/defects.ts` under `syl`.
 *  • NATIVE ORDINALS — one instance in the whole excerpt tier (`২১ꠡ ꠡꠔꠈꠞ`, "the 21st century"), and the
 *    artifact's `ordinal-native` cell is 0 for want of a term list. One instance is a lead, not a rule.
 *  • UNITS as a tier — `units` and `rate` are both ×0 in the artifact's whole-corpus counts. What the
 *    corpus writes instead is NATIVE dotted abbreviations (ꠝꠤ.ꠉ꠆ꠞꠣ., ꠍꠦ.ꠝꠤ., ꠝꠦ.ꠐꠘ, ꠇꠤ.ꠇ꠆ꠎꠣꠟꠧꠞꠤ), and
 *    step 4 stops those from being read as phrase breaks without inventing a unit vocabulary.
 */
import { renormalize, rewrite } from "../../core/provenance.ts";

/** Syloti Nagri LETTERS and signs — U+A800–A827 plus U+A82C (alternate hasanta). */
const SYL = "\\u{A800}-\\u{A827}\\u{A82C}";
/** A Syloti Nagri letter, as a bare class for use in lookarounds. */
const S = `[${SYL}]`;

/**
 * BENGALI-ASSAMESE → SYLOTI NAGRI, for the mis-typed characters of group (1) above.
 *
 * These are ORTHOGRAPHIC correspondences between two scripts that encode the same Eastern Indo-Aryan
 * phonology, not a transliteration scheme: Syloti Nagri simply has the smaller inventory, so several
 * Bengali letters collapse (ণ/ন → ꠘ; শ/ষ/স → ꠡ; ড়/ঢ় → ꠠ), and the marks Syloti Nagri does not have are
 * DELETED rather than guessed at — the manifest already records ঁ, ঃ and ় as "none in Syloti Nagri".
 * Nothing here is a new word; it is the same word spelled with the wrong keyboard.
 */
const BN_TO_SYL: Readonly<Record<string, string>> = {
    // marks Syloti Nagri does not have
    "়": "", // ় nukta — 17 instances, the commonest slip (ꠛꠤꠛꠦꠌꠘꠣꠎ়)
    "ঁ": "", // ঁ candrabindu (ꠀঁꠡ)
    "ঃ": "", // ঃ visarga
    "ং": "ꠋ", // ং anusvara → ꠋ, which this engine reads as a plain [ŋ]
    "্": "꠆", // ্ virama → ꠆ hasanta
    "ৎ": "ꠔ꠆", // ৎ khanda ta — a bare /t/ (ꠃৎꠙꠣꠖꠘ → ꠃꠔ꠆ꠙꠣꠖꠘ)
    // vocalic R — [ri] in Bengali-Assamese and in Sylheti, and Syloti Nagri writes that as ꠞꠤ. ×7, and
    // this sign was the one member of BN_LETTER's range with no entry here (see group (1) above).
    "ৃ": "ꠞꠤ", "ঋ": "ꠞꠤ",
    // dependent vowel signs
    "া": "ꠣ", "ি": "ꠤ", "ী": "ꠤ", "ু": "ꠥ", "ূ": "ꠥ",
    "ে": "ꠦ", "ৈ": "ꠂ", "ো": "ꠧ", "ৌ": "ꠧ",
    // independent vowels
    "অ": "ꠅ", "আ": "ꠀ", "ই": "ꠁ", "ঈ": "ꠁ", "উ": "ꠃ",
    "ঊ": "ꠃ", "এ": "ꠄ", "ঐ": "ꠂ", "ও": "ꠅ", "ঔ": "ꠅ",
    // consonants
    "ক": "ꠇ", "খ": "ꠈ", "গ": "ꠉ", "ঘ": "ꠊ", "ঙ": "ꠋ",
    "চ": "ꠌ", "ছ": "ꠍ", "জ": "ꠎ", "ঝ": "ꠏ", "ঞ": "ꠘ",
    "ট": "ꠐ", "ঠ": "ꠑ", "ড": "ꠒ", "ঢ": "ꠓ", "ণ": "ꠘ",
    "ত": "ꠔ", "থ": "ꠕ", "দ": "ꠖ", "ধ": "ꠗ", "ন": "ꠘ",
    "প": "ꠙ", "ফ": "ꠚ", "ব": "ꠛ", "ভ": "ꠜ", "ম": "ꠝ",
    "য": "ꠎ", "র": "ꠞ", "ল": "ꠟ", "শ": "ꠡ", "ষ": "ꠡ",
    "স": "ꠡ", "হ": "ꠢ", "ড়": "ꠠ", "ঢ়": "ꠠ", "য়": "ꠄ",
};
/**
 * Bengali-Assamese LETTERS AND MARKS ONLY — U+0980–09E5 plus ৰ ৱ. Deliberately NOT the whole block: the
 * Bengali DIGITS (U+09E6–09EF) are this corpus's ordinary digits and the taka sign U+09F3 is its currency,
 * and neither is a mis-typed letter. Folding them here would fight the registry's digit fold and step 10.
 */
const BN_LETTER = "\\u0980-\\u09E5\\u09F0\\u09F1";
/** A run of Syloti Nagri and/or Bengali letters — the token step 3 decides about. */
const MIXED_RUN = new RegExp(`[${SYL}${BN_LETTER}]+`, "gu");
const HAS_SYL = new RegExp(S, "u");
const HAS_BN = new RegExp(`[${BN_LETTER}]`, "u");
/**
 * ꠎ + ় IS THE ONE DIGRAPH, and it needs the vowel sign after it, which is why it cannot live in the
 * single-character table. It is how this corpus renders Bengali য় (ya + nukta) — ꠙꠦꠎ়ꠣꠞꠣ, ꠡꠧꠒꠤꠎ়ꠣꠝ,
 * ꠞꠎ়ꠦꠍꠦ, ꠛꠤꠛꠦꠌꠘꠣꠎ় — a letter Syloti Nagri does not have. In Sylheti it is not a consonant at all but
 * the hiatus glide, so it behaves as a VOWEL CARRIER: dropping the nukta alone would give ꠎ = [z] and read
 * ꠡꠧꠒꠤꠎ়ꠣꠝ as *ʃoɖizam. Fold ꠎ় + vowel-sign to the matching INDEPENDENT vowel, and word-finally delete it:
 * ꠙꠦꠎ়ꠣꠞꠣ → ꠙꠦꠀꠞꠣ (peyara), ꠡꠧꠒꠤꠎ়ꠣꠝ → ꠡꠧꠒꠤꠀꠝ (sodium), ꠞꠎ়ꠦꠍꠦ → ꠞꠄꠍꠦ.
 */
const YA_NUKTA = /(?:ꠎ|\u09AF)\u09BC([ꠣꠤꠥꠦꠧ]?)/gu;
const INDEPENDENT: Readonly<Record<string, string>> = { "ꠣ": "ꠀ", "ꠤ": "ꠁ", "ꠥ": "ꠃ", "ꠦ": "ꠄ", "ꠧ": "ꠅ", "": "" };

/** Format/zero-width characters that split a Syloti token in two. */
const ZERO_WIDTH = /[​‌‍‎‏⁠﻿]/gu;

/** A number, possibly with a decimal point, anchored to END in a digit (never eating a clause comma). */
const NUM = "\\p{Nd}(?:[\\p{Nd}.]*\\p{Nd})?";
/** Bengali → ASCII digit value, for the range rule's comparison only. */
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const numValue = (s: string): number =>
    Number([...s].map((c) => (BN_DIGITS.includes(c) ? String(BN_DIGITS.indexOf(c)) : c)).join(""));

/**
 * THE SOURCED WORDS. Each is recorded with what attests it, because this is the half no gate can check.
 *
 * ꠖꠡꠝꠤꠇ  DECIMAL POINT. syl.wikipedia ×2 in 2 independent articles, and one of them is the slot itself:
 *          `১০০ ꠉ꠆ꠞꠣꠝ ꠛꠦꠟꠚꠁꠔ … ৯ ꠖꠡꠝꠤꠇ ৭ ꠡꠞ꠆ꠇꠞꠣ` — "9 POINT 7 [grams] of sugar", digit-word-digit. The
 *          other is definitional — `ꠖꠡꠝꠤꠇ ꠡꠁꠋꠇꠣ ꠚꠖ꠆ꠖꠔꠤꠔ ১০ ꠐꠣ ꠚꠔꠤꠇ ꠀꠍꠦ- ০, ১, ২, …` ("the DECIMAL number
 *          system has 10 digits: 0, 1, 2, …"), which is exactly the shape the Igbo lesson says to look for
 *          when a symbol's spoken form is absent from running text.
 * ꠡꠔꠣꠋꠡ   PERCENT. syl.wikipedia ×3 in 3 articles; ONE is digit-adjacent and in the percent sense —
 *          `1974 ꠡꠘꠞ ꠞꠤꠙꠥꠐ ꠅ ꠖꠦꠈꠣ ꠎꠣꠄ 4 ꠡꠔꠣꠋꠡ ꠙꠣꠀꠠꠤ ꠝꠣꠁ꠆ꠡꠦ …` ("the 1974 report says 4 PERCENT of hill
 *          people…"). ⚠ THE BARE COUNT MEASURES SOMETHING ELSE (trap 37): the other two are the
 *          "portion/share" sense with no numeral (`ꠝꠥꠟ ꠜꠥꠈꠘ꠆ꠒꠞ ꠡꠔꠣꠋꠡ ꠅꠘ꠆ꠌꠟ`), so the COLLOCATION count is
 *          1, not 3, and that is stated rather than rounded up. ⚠ AND THE SENTENCE IS SYLHETI, NOT QUOTED
 *          BENGALI (trap 34, checked on morphology not script): it carries the Sylheti ablative ꠕꠘꠦ
 *          (`ꠍꠤꠟꠐ-ꠘꠣꠉꠞꠤꠕꠘꠦ`, where Bengali writes থেকে), the locative ꠅ and the verb form ꠝꠣꠔꠂꠘ. Every
 *          competing spelling probed is ×0 on the wiki: ꠡꠔꠈꠞꠣ, ꠙꠞ꠆ꠍꠦꠘ꠆ꠐ, ꠙꠣꠞꠍꠦꠘ꠆ꠐ, ꠙꠞ꠆ꠡꠦꠘ꠆ꠐ, ꠙꠣꠞꠍꠦꠘ꠆ꠔ.
 * ꠐꠦꠈꠣ    TAKA. The strongest of the four: in the CORPUS in the sign's own slot (`ꠅꠁꠟꠦ ৳১ ꠨ ৳২ ꠀꠞ ৳৫
 *          ꠐꠦꠈꠣꠞ ꠘꠧꠐ`, "৳1, ৳2 and ৳5 taka notes"; `৳১-ꠞ ꠜꠣꠉꠞ ꠜꠣꠉ`) and defined by the article that is
 *          its own name — `ꠐꠦꠈꠣ (ꠝꠥꠖ꠆ꠞꠣ ꠙ꠆ꠞꠔꠤꠇ ꠪ ৳ ॥ ꠛ꠆ꠎꠣꠋꠇ ꠇꠧꠒ ꠪ BDT)`, "Taka (currency symbol: ৳;
 *          bank code: BDT)". syl.wikipedia ×16 across 8 articles. Position is settled by the same
 *          evidence: `৩০ ꠔꠘꠦ 600 ꠐꠦꠈꠣ` puts the numeral BEFORE the word.
 * ꠒꠤꠉ꠆ꠞꠤ  DEGREE. In the corpus in the exact slot — `ꠎꠦꠈꠐꠣ ꠔꠣꠚꠉꠔꠤꠛꠤꠖ꠆ꠖꠣꠔ ০ ꠒꠤꠉ꠆ꠞꠤ ꠇꠦꠟꠜꠤꠘ ꠈꠅꠀ ꠅꠄ`,
 *          "which is called 0 DEGREES Kelvin". ⚠ STATED LIMIT, and it is trap 37 again: the bare word is
 *          polysemous and the LOSING sense outnumbers the winner on the wiki (6 of 8 hits are the academic
 *          degree — ꠒꠤꠉ꠆ꠞꠤ ꠇꠟꠦꠎ "Degree College", ꠒꠤꠉ꠆ꠞꠤ ꠙꠣꠡ ꠈꠞꠁꠘ "passed his degree"). The
 *          digit-adjacent collocation is 1, and it is the right sense.
 * ꠍꠦꠟꠍꠤꠀꠍ / ꠚꠣꠞꠦꠘꠢꠣꠁꠐ  CELSIUS / FAHRENHEIT. The best kind of evidence there is: the corpus GLOSSES ITS
 *          OWN ABBREVIATION, both scale names appearing in full in the same articles as the abbreviated
 *          forms they expand — `০°–১০০° ꠍꠦꠟꠍꠤꠀꠍ` and `০° ꠍꠦꠟꠍꠤꠀꠍ ꠔꠣꠚꠝꠣꠔ꠆ꠞꠣ` beside `১৮°ꠍꠦ.`, and
 *          `ꠚꠣꠞꠦꠘꠢꠣꠁꠐ ꠁꠃꠘꠤꠐꠅ -৪৫৯.৬৭° ꠚꠣ.` — the full name and its abbreviation in ONE sentence. This
 *          refutes `sources.ts`'s `[NONE] scale-names` for syl, which reads code and not the corpus.
 * ꠔꠘꠦ     RANGE CONNECTIVE ("from…"). Attested BETWEEN two numeric operands twice, in two independent
 *          sources: the corpus's `৫০% ꠔꠘꠦ ৯০%` and the wiki's `৩০ ꠔꠘꠦ 600 ꠐꠦꠈꠣ`. ⚠ PART OF SPEECH
 *          CHECKED, not just the word (the Fula `hakkunde` lesson): ꠔꠘꠦ is an ablative postposition
 *          attaching to the LEFT operand, so `N ꠔꠘꠦ M` is the shape the language actually writes, not a
 *          preposition governing both.
 */
const DECIMAL_WORD = "ꠖꠡꠝꠤꠇ";
const PERCENT_WORD = "ꠡꠔꠣꠋꠡ";
const CURRENCY_WORD = "ꠐꠦꠈꠣ";
const DEGREE_WORD = "ꠒꠤꠉ꠆ꠞꠤ";
const RANGE_WORD = "ꠔꠘꠦ";
/** The degree SCALE abbreviations the corpus writes, with the full form it writes them beside. */
const SCALE: Readonly<Record<string, string>> = { "ꠍꠦ": "ꠍꠦꠟꠍꠤꠀꠍ", "ꠚꠣ": "ꠚꠣꠞꠦꠘꠢꠣꠁꠐ" };

/**
 * Fold the Bengali-Assamese characters of a MIXED token into Syloti Nagri.
 *
 * ⚠ THE GUARD IS THE WHOLE RULE. Folding unconditionally would transliterate the corpus's genuine
 * Bengali-script glosses (`বাংলাদেশ`, and a quoted Bengali sentence about scripture) into Syloti Nagri and
 * read them with Sylheti phonology, instead of leaving them for the script router — a confidently wrong
 * reading replacing a correct one. So a Bengali character is folded only when the letter run it sits in
 * ALSO contains a Syloti Nagri character, which is exactly the "wrong keyboard" case and never the
 * "quoted in another script" case.
 */
function foldStrayBengali(s: string): string {
    return rewrite(s, MIXED_RUN, (run) =>
        HAS_SYL.test(run) && HAS_BN.test(run)
            ? [...run.replace(YA_NUKTA, (_m, v: string) => INDEPENDENT[v] ?? "")]
                .map((c) => BN_TO_SYL[c] ?? c).join("")
            : run);
}

/** Sylheti text → text the tokenizer can read. Numbered; the ordering couplings are stated at each step. */
export function normalizeSylheti(input: string): string {
    // 1. NFC FIRST. Bengali-Assamese has composition exclusions (য়/ড়/ঢ় exist precomposed AND as base +
    //    nukta) and step 2 matches Bengali literals, so without this the fold would catch about half its
    //    instances and the failure would be invisible — the two forms render identically.
    let s = renormalize(input, "NFC");

    // 2. Zero-width formatting characters. 17 in the artifact, and they are not cosmetic: `ꠖꠇ꠆‌ꠈꠤꠘ`
    //    carries a ZWNJ mid-word, which splits one Syloti token into two. BEFORE step 3, whose guard asks
    //    whether a Bengali character has a Syloti neighbour — a zero-width character between them is not a
    //    boundary and must not read as one.
    s = rewrite(s, ZERO_WIDTH, "");

    // 3. Stray Bengali-Assamese characters inside a Syloti word (see `foldStrayBengali`). BEFORE every
    //    rule below, because a Bengali digit sign or nukta sitting inside an operand would otherwise make
    //    the operand fail its own pattern.
    s = foldStrayBengali(s);

    // 4. DOTTED NATIVE ABBREVIATIONS, and the playbook's "multi-dot before single-dot" coupling is the
    //    whole design here. 51 of the corpus's dots follow a Syloti letter and they are abbreviations —
    //    ꠝꠤ.ꠉ꠆ꠞꠣ. (milligram), ꠍꠦ.ꠝꠤ. (centimetre), ꠝꠦ.ꠐꠘ (metric ton), ꠇꠤ.ꠇ꠆ꠎꠣꠟꠧꠞꠤ, ꠐꠤ.ꠐꠤ., ꠄꠘ.ꠄꠁꠌ.ꠄꠍ —
    //    and each interior dot was reaching the output as a CLAUSE PAUSE, so `২৫ ꠝꠤ.ꠉ꠆ꠞꠣ.` read
    //    `ɸɔsiʃ mi . ɡɾa .`, three pauses inside one word.
    //    ⚠ THE TRAILING DOT IS CLAIMED ONLY FOR A TOKEN THAT ALREADY HAD AN INTERIOR ONE, and that
    //    restraint is measured, not stylistic. Tabulating what surrounds every dot in the corpus (the
    //    German `N.` method) gives 51 abbreviation dots against exactly 4 that end a sentence — three real
    //    sentence-final periods (`… ꠈꠦꠁꠞ ꠅꠁꠛꠅ.`, `… ꠀꠍꠦ.`, `… ꠡꠘ꠆ꠣꠘ.`) and one abbreviation that happens
    //    to sit before a ⁕. A rule claiming any trailing dot after a short Syloti run would have deleted
    //    those three pauses. Single-dot abbreviations (ꠒꠣ. "Dr.", ꠝꠦ., ꠞ.) therefore keep their spurious
    //    pause: separating them from a sentence end needs evidence this corpus does not carry.
    s = rewrite(s, new RegExp(`(?:${S}+\\.)+${S}+\\.?`, "gu"), (m) => m.replace(/\./gu, ""));

    // 5. DE-GROUPING FIRST among the number rules — a grouping comma is otherwise read as clause
    //    punctuation, and `১,০০,০০০` read as `ex , ʃunːo , ʃunːo`: two pauses and the quantity destroyed.
    //    ⚠ THE CORPUS USES BOTH GROUPINGS, which is why the group size is 2 OR 3 rather than 3: Indic
    //    2-2-3 (`১,০০,০০০`, `১৯,৬০০`, `২,৬০০`) and Western (`২২,২২৪,২৮২`, one instance). Deleting the
    //    separator is right for both, because `renderNumber` reads the whole integer and `indicNumberWords`
    //    supplies the lakh/crore grouping from the VALUE, never from the writing.
    for (let prev = ""; prev !== s; ) {
        prev = s;
        s = rewrite(s, /(\p{Nd})(?<!(?<!\p{Nd})0),(?=\p{Nd}{2,3}(?!\p{Nd}))/gu, "$1");
    }

    // 6. RANGES, and this step is pinned between two others. AFTER de-grouping, or `১৯,৬০০-২০,০০০` matches
    //    only its last three digits; BEFORE the decimal rule, or `৩.৯-৫.৫` has had a word inserted into
    //    both operands and no longer looks like a range at all.
    //    ⚠ THE ASCENDING GUARD IS WHAT MAKES THIS SAFE, and it is measured. Every hyphen/dash between two
    //    numbers in the artifact, classified: 16 are genuine ranges and ALL 16 ascend (`১০-১৪ ꠍꠦ.ꠝꠤ.`,
    //    `১২-২৬ ꠉ꠆ꠞꠣꠝ`, `১৯৬০০-২০০০০ ꠛꠍꠞ`, `1500-1650 ꠡꠘ`, `১৯০৪-১৯৭১`, `১৪৫০-১৫০০ ꠈ꠆ꠞꠤ:`); 5 are not
    //    ranges and NONE ascends — two football scores (`3-3 ꠉꠂꠟꠦ`, `4-2 ꠛꠦꠛꠗꠣꠘꠦ`), a URL fragment
    //    (`volume=5-1&pages=`) and two lifespans whose operands are a year and a day-of-month
    //    (`১৫ ꠅꠇ꠆ꠐꠧꠛꠞ ১৯২৬ – ২৫ ꠎꠥꠘ ১৯৮৪`). 16/16 kept, 5/5 rejected, on one property of the numbers
    //    themselves. A score read as "three to three" would be confidently wrong, which is the reading
    //    this guard exists to refuse.
    s = rewrite(s, new RegExp(`(?<![\\p{Nd}.,])(${NUM})\\s*[-–—]\\s*(${NUM})(?![\\p{Nd}.,])`, "gu"),
        (m, a: string, b: string) => (numValue(b) > numValue(a) ? `${a} ${RANGE_WORD} ${b}` : m));

    // 7. DEGREES, before the decimal rule for the shared tier's "units before decimals" reason — the scale
    //    name is matched by its adjacency to a NUMBER, and a decimal rewrite destroys that adjacency
    //    (`-২৭৩.১৫° ꠍꠦ.` would become `২৭৩ ꠖꠡꠝꠤꠇ ১৫° ꠍꠦ.`, where the operand no longer ends the number).
    //    The scale ABBREVIATION is consumed here, dot and all, which is also why step 4 could leave a
    //    single trailing dot alone: `ꠍꠦ.`/`ꠚꠣ.` never reach it.
    //    ⚠ THE LATIN `°C`/`°F` ARM IS PROBING THE ADVERSARIAL NEIGHBOUR, not covering a corpus instance:
    //    this corpus writes the scale in Syloti Nagri (`°ꠍꠦ`, `°ꠚꠣ`) and once as a bare Latin `° R`
    //    (Rankine), so `°C` is ×0 here. It costs nothing — the two scale words are already sourced — and
    //    it also catches the ℃/℉ that `registry.ts` folds to `°C`/`°F` before any engine sees them, which
    //    52 languages were losing whole. Zero corpus instances is not evidence of correctness.
    s = rewrite(s, new RegExp(`(\\p{Nd})\\s*°\\s*(ꠍꠦ|ꠚꠣ)\\.?(?!${S})`, "gu"),
        (_m, n: string, sc: string) => `${n} ${DEGREE_WORD} ${SCALE[sc.toUpperCase()]}`);
    s = rewrite(s, /(\p{Nd})\s*°\s*([CF])(?![\p{L}\p{M}])/gui,
        (_m, n: string, sc: string) => `${n} ${DEGREE_WORD} ${sc.toUpperCase() === "C" ? SCALE["ꠍꠦ"] : SCALE["ꠚꠣ"]}`);
    s = rewrite(s, /(\p{Nd})\s*°/gu, `$1 ${DEGREE_WORD}`);

    // 8. DECIMAL POINT. ⚠ THE GUARD REJECTS A DOI/URL, which is the only other digit.digit shape here:
    //    `10.1177/0261927X03261223` and `10.1016/j.langsci.2018.06.010` are citation residue, and a
    //    fractional part followed by another dot or a slash is never a decimal, and NEITHER IS ONE THAT
    //    ALREADY HAS A DOT BEFORE IT — the lookahead alone let `…2018.06.010` through on its LAST dot,
    //    because nothing follows `010`. Both directions are needed, exactly as `NOT_VERSION` needs both.
    s = rewrite(s, /(?<!\.\p{Nd}*)(\p{Nd})\.(?=\p{Nd})(?!\p{Nd}*[./])/gu, `$1 ${DECIMAL_WORD} `);

    // 9. PERCENT — postposed, which is the position its one attested collocation writes (`4 ꠡꠔꠣꠋꠡ`).
    //    ⚠ THE SECOND ARM IS FOR A `%` WITH NO OPERAND, and it is not a widening for an unattested shape:
    //    the corpus writes `ꠄꠡꠤꠀ ꠖꠥꠘꠤꠀꠞ % ꠀꠞ ꠎꠝꠤꠘꠞ % ꠎꠥꠠꠤꠀ ꠀꠍꠦ` — a sentence whose figures never came
    //    through the wikitext. The number is lost either way; the WORD is not, and a `%` is a percent
    //    whether or not its quantity survived. Two instances, both in that sentence, and it was the last
    //    `DROP percent` the artifact scan had left.
    s = rewrite(s, /(\p{Nd})\s*%/gu, `$1 ${PERCENT_WORD}`);
    s = rewrite(s, /%/gu, ` ${PERCENT_WORD} `);

    // 10. TAKA. ⚠ THE SIGN IS DROPPED WHERE THE WORD IS ALREADY THERE (trap 12: a redundant symbol is a
    //     permissible drop, and the language-idiomatic position is the one to keep). The corpus's own
    //     sentence is the case — `ꠅꠁꠟꠦ ৳১ ꠨ ৳২ ꠀꠞ ৳৫ ꠐꠦꠈꠣꠞ ꠘꠧꠐ` states the currency once for three
    //     amounts, so the first two get the word and the third keeps the one already written. Numeral
    //     BEFORE the word, per `৩০ ꠔꠘꠦ 600 ꠐꠦꠈꠣ`.
    s = rewrite(s, /৳\s*(\p{Nd}+)(?![^\p{Nd}]{0,3}ꠐꠦꠈꠣ)/gu, `$1 ${CURRENCY_WORD}`);
    s = rewrite(s, /৳\s*(\p{Nd}+)/gu, "$1");
    //     A BARE ৳ with no amount is the article's own gloss of the symbol (`ꠝꠥꠖ꠆ꠞꠣ ꠙ꠆ꠞꠔꠤꠇ ꠪ ৳`,
    //     "currency symbol: ৳") — naming the sign, so the word IS the reading there.
    s = rewrite(s, /৳(?![^\p{Nd}]{0,3}ꠐꠦꠈꠣ)/gu, ` ${CURRENCY_WORD} `);
    s = rewrite(s, /৳/gu, "");

    return s;
}
