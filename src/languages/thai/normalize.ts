/**
 * Thai (th) TEXT NORMALIZATION (#562) — the pre-tokenizer pass that rewrites everything which is not
 * already readable by the Thai g2p into Thai-script words the existing pipeline speaks. Pure text→text;
 * no IPA. Runs inside thai.ts's `text()`, before the tokenizer.
 *
 * THE ONE STRUCTURAL FACT THAT SHAPES EVERY RULE HERE. Thai has no word spaces; the space it does use is
 * a phrase boundary. The Thai tokenizer (`TOKEN` in thai.ts) matches Thai runs, digit runs and clause
 * marks — a SPACE matches nothing, so `assembleClauses` neither pauses on it nor drops anything around
 * it. Probed: `phonemize("ไทย ไทย","th")` → "tʰˈa˧j tʰˈa˧j", one space-joined pair with NO pause mark.
 * That is what makes every rule below safe to emit space-separated words: a space here is a token
 * boundary, never a prosodic break. It also means this file must NEVER emit a clause mark (. , : …),
 * because that WOULD become a pause. Nothing below emits one; the rules only ever consume them.
 *
 * MEASURED OVER THE FLEURS th_th CORPUS, column 3 (1,906 unique utterances):
 *   ๆ maiyamok           351 in 318 utterances (16.7%)  ← the largest single defect in the language
 *   embedded Latin       732 in 301 (15.8%), of which ALL-CAPS initialisms 93 in 79 (4.1%)
 *   Thai unit abbrevs    ~43 (…ม.) + กก. 2, all after a number
 *   ค.ศ. 21 / พ.ศ. 14 / ดร. 6 / ตร. 3 / พ.ย. 1 / ก.พ. 1 / ส.ส. 1 / พรบ. 1
 *   clock + น.           17 (16 written HH.MM with a PERIOD, exactly one with a colon: 23:35)
 *   comma-grouped nums   53 in 41       decimals 41 in 33       % 5 (already correct)  ° 2
 *   ranges with a dash   15             slash 22               Thai digits ๐-๙  ZERO
 *
 * WHAT THE ENGINE PRODUCED BEFORE, probed form by form:
 *   ต่าง ๆ        → "tˈaː˨˩ŋ"                       the reduplication silently DROPPED
 *   ต่างๆ (unspaced) → "tˈaː˨˩ŋaː˧"                 worse — ๆ is inside the Thai block, so the
 *                                                   syllabifier swallowed it as a spurious "aː" syllable
 *   สหรัฐฯ        → "sˈo˨˩ra˨˩tʰˌaː˩˩˦"             ฯ likewise corrupted the WHOLE word's
 *                                                   syllabification (สหรัฐ alone → "sˈa˨˩ha˨˩rˌa˦˥t")
 *   ฯลฯ          → "lˈaː˧"                          garbage
 *   1,234        → "nˈɯ˨˩ŋ , sˈɔː˩˩˦ŋ rˈɔː˦˥j …"   grouping comma read as a CLAUSE PAUSE, and the
 *                                                   number split into "one" + "two hundred thirty-four"
 *   3.5          → "sˈaː˩˩˦m . hˈaː˥˩"              decimal point read as a clause pause
 *   09.30 น.     → "kˈaː˥˩w . sˈaː˩˩˦m sˈi˨˩p nˈa˦˥ʔ ."   pause mid-clock, then นาฬิกา as "naʔ" + pause
 *   220 กม.      → "… kˈo˧m ."                      a nonsense syllable plus a spurious pause
 *   ค.ศ. 1776    → "kʰˈa˦˥ʔ . sˈa˨˩ʔ . …"           two nonsense syllables and two spurious pauses
 *   GPS          → "d͡ʒˈiː pʰˈiː ˈɛs"                ENGLISH phonemes (core/foreign.ts) in a Thai stream
 *   NASA         → "nˈæsə"                          æ, which Thai does not have
 *
 * WHAT IS DELIBERATELY LEFT ALONE, and why (see the commit message for the same list):
 *   • MIXED-CASE Latin (565 tokens / 496 distinct — Provenzano, Super-G, Northern Rock, pH). These are
 *     proper names and English words whose Thai transcription is lexical and unguessable from spelling.
 *     Same call Japanese made: keep the English fallback until there is a sourced loanword lexicon.
 *   • SINGLE Latin letters (52). Tabulated: `x` ×5 is a multiplication sign (6 x 6 ซม., 4x4), n/a/b/g ×8
 *     are Wi-Fi standard suffixes (802.11n), and most of the rest are letters CITED as letters
 *     ("อักษร O", "ออกเสียง r และ rr") or fragments of mixed-case names. No single safe rewrite.
 *   • RANGES `2-3`, `1644-1912` (15). The dash is currently dropped, which merely juxtaposes the two
 *     numbers — not a corruption. Thai says ถึง for a span but ต่อ for a SCORE, and the corpus is 6 spans,
 *     3 scores (5-3, 6-6, 7-2), 2 times, 4 years: no majority large enough to justify a confidently wrong
 *     word in the other third. Left, per the playbook's "a wrong word is worse than a dropped sign".
 *   • ส.ส. (1) and พรบ. (1). ส.ส. is read as Thai LETTER names, which needs the Thai consonant-name
 *     table (กอ ไก่ …) — a data set this file does not have and will not invent for one hit.
 *   • `และ/หรือ` (and/or, ×5) and other Thai-word slashes: the slash is already dropped without a pause.
 *     A blanket `/` → ต่อ would produce "และต่อหรือ". Only the two attested UNIT slashes are rewritten.
 *   • Word-acronym readings (ISIS → ไอซิส, ASUS → เอซุส). Which acronyms Thai reads as a word rather
 *     than as letters is a LEXICAL fact and I have no source for it; letter-spelling is always an
 *     available Thai reading, so it is the safe default for the whole class.
 */
import { segment } from "./segment.ts";

/** Thai digit words, indexed by value. Single source: thai.ts's cardinal compositor imports this, and
 *  step 7 below spells a decimal's fractional digits one at a time from the same array. */
export const THAI_DIGIT_WORDS: readonly string[] = [
    "ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า",
];

/** Latin letter → its THAI letter name. Thai reads an initialism as these (GPS = จีพีเอส), which is what
 *  keeps it inside the Thai phoneme inventory instead of routing to the English phonemizer. Probed: every
 *  one of the 26 phonemizes to a well-formed Thai syllable (เอฟ → ʔˈeː˨˩p, ดับเบิลยู → dˈa˨˩pbɤ˥˩njˌuː˧). */
const THAI_LETTER_NAME: Readonly<Record<string, string>> = {
    A: "เอ", B: "บี", C: "ซี", D: "ดี", E: "อี", F: "เอฟ", G: "จี",
    H: "เอช", I: "ไอ", J: "เจ", K: "เค", L: "แอล", M: "เอ็ม", N: "เอ็น",
    O: "โอ", P: "พี", Q: "คิว", R: "อาร์", S: "เอส", T: "ที", U: "ยู",
    V: "วี", W: "ดับเบิลยู", X: "เอกซ์", Y: "วาย", Z: "แซด",
};

/**
 * Thai abbreviation → its spoken expansion. ORDER IS LOAD-BEARING: longest key first, so the two-dot
 * forms (ตร.กม.) and the unit-per-unit forms (กม./ชม.) are consumed before the single-dot suffix they
 * end with (กม.) can claim half of them. This is the playbook's "multi-dot abbreviations before
 * single-dot" coupling; here it also covers the `/` composites.
 *
 * `unitOnly` entries are rewritten ONLY when a number is adjacent on the left — the shared symbol tier's
 * rule, applied locally because these are Thai-script abbreviations with an embedded period rather than
 * the ASCII unit suffixes core/normalizeSymbols.ts matches. All 45 unit instances in the corpus follow a
 * number; the guard is what keeps `ม.` from claiming a word-final ม plus a sentence period.
 *
 * A multi-word expansion is written with SPACES between its words (ตาราง กิโลเมตร, not ตารางกิโลเมตร).
 * A space is a free token boundary here (see the header) and it keeps the compound out of the seg-words
 * DAG, which mis-syllabified the fused form: ตารางกิโลเมตร → …mˌeː˧to˧n instead of …mˌeː˦˥t.
 */
const ABBREV: readonly { from: string; to: string; unitOnly: boolean }[] = [
    // composites (unit per unit) — the slash IS read, as ต่อ
    { from: "กม./ชม.", to: "กิโลเมตร ต่อ ชั่วโมง", unitOnly: true },
    { from: "ไมล์/ชม.", to: "ไมล์ ต่อ ชั่วโมง", unitOnly: true },
    // two-dot units
    { from: "ตร.กม.", to: "ตาราง กิโลเมตร", unitOnly: true },
    { from: "ตร.มม.", to: "ตาราง มิลลิเมตร", unitOnly: true },
    // one-dot units
    { from: "กม.", to: "กิโลเมตร", unitOnly: true },
    { from: "มม.", to: "มิลลิเมตร", unitOnly: true },
    { from: "ซม.", to: "เซนติเมตร", unitOnly: true },
    { from: "กก.", to: "กิโลกรัม", unitOnly: true },
    { from: "ชม.", to: "ชั่วโมง", unitOnly: true },
    { from: "ม.", to: "เมตร", unitOnly: true },
    // era markers and titles — not units, so no number guard (they PRECEDE their number: ปี ค.ศ. 1776)
    { from: "ค.ศ.", to: "คริสต์ศักราช", unitOnly: false },
    { from: "พ.ศ.", to: "พุทธศักราช", unitOnly: false },
    { from: "พ.ย.", to: "พฤศจิกายน", unitOnly: false },
    { from: "ก.พ.", to: "กุมภาพันธ์", unitOnly: false },
    { from: "ดร.", to: "ดอกเตอร์", unitOnly: false },
];

const esc = (s: string): string => s.replace(/[.$*+?^{}()|[\]\\/]/gu, "\\$&");

/** `\b` is ASCII-defined and matches NOTHING against Thai script — the trap that bit six of the first
 *  thirteen languages. Every left-edge guard in this file is this explicit lookbehind instead. */
const NOT_LETTER_BEFORE = "(?<![\\p{L}\\p{M}])";

const ABBREV_RULES = ABBREV.map((a) => ({
    re: new RegExp(
        (a.unitOnly ? "(?<=\\d\\s?)" : NOT_LETTER_BEFORE) + esc(a.from),
        "gu",
    ),
    to: a.to,
}));

/** Digits of a numeral, spelled one at a time — how Thai reads the fractional part of a decimal
 *  (3.5 = สามจุดห้า; 802.11 = …จุดหนึ่งหนึ่ง, never จุดสิบเอ็ด). */
const spellDigits = (ds: string): string =>
    [...ds].map((d) => THAI_DIGIT_WORDS[Number(d)] ?? d).join(" ");

/** `HH.MM` → the formal Thai clock: `H นาฬิกา M นาที`. Zero minutes are dropped (11.00 น. is
 *  สิบเอ็ดนาฬิกา, not …ศูนย์นาที). Hours/minutes stay as ASCII digit runs so thai.ts's cardinal
 *  compositor pronounces them; `09` → `9` because a leading zero is not spoken. */
const clock = (hh: string, mm: string): string =>
    `${Number(hh)} นาฬิกา` + (Number(mm) === 0 ? "" : ` ${Number(mm)} นาที`);

/**
 * The ordered pass. Each step states the coupling that pins its position.
 */
export function normalizeThai(input: string): string {
    let s = input;

    // ── 1. Thai digits ๐-๙ → ASCII ────────────────────────────────────────────────────────────────
    // FIRST, so every numeric rule below sees one representation. ZERO occurrences in the th_th corpus
    // (checked before writing it) — kept because real Thai text does use them and the number path in
    // thai.ts only accepts ASCII, so an unfolded ๐-๙ would be dropped outright by the tokenizer.
    s = s.replace(/[๐-๙]/gu, (c) => String(c.codePointAt(0)! - 0x0e50));

    // ── 2. ฯลฯ (et cetera) ───────────────────────────────────────────────────────────────────────
    // BEFORE step 3, which is what turns the ๆ this expands to into a real repetition, and BEFORE
    // step 4, which deletes a bare ฯ. Read และอื่น ๆ. Corpus ×2. Was: "lˈaː˧".
    s = s.replace(/ฯลฯ/gu, "และอื่น ๆ");

    // ── 3. ๆ maiyamok = repeat the preceding WORD ─────────────────────────────────────────────────
    // AFTER step 2. The antecedent is a word, not "everything since the last space" — Thai writes no
    // word spaces, so สิ่งต่าง ๆ must repeat ต่าง and not สิ่งต่าง. segment() (the same DAG the g2p
    // already runs on every token) supplies the boundary. Tabulated over all 351: ต่าง ×111, อื่น ×81,
    // ใด ×15, เล็ก ×12, เด็ก ×10 …, and 326 are written with a space before ๆ, 25 without.
    //
    // The last segmented token is repeated WHOLE. A further "split a compound and repeat only its tail"
    // pass was measured and rejected: it recovers 22 (คนอื่น→อื่น, ช่วงแรก→แรก) but shatters 6 into
    // non-words (บ่อย→อย ×4, แปลก→ลก ×2). Repeating คนอื่น twice is verbose; repeating อย is wrong.
    s = s.replace(/([ก-ๅ็-๎]*)\s*ๆ/gu, (_m, run: string) => {
        if (run === "") return ""; // no Thai antecedent — drop the mark rather than invent one
        const seg = segment(run);
        return `${run} ${seg[seg.length - 1]!}`;
    });

    // ── 4. ฯ paiyannoi (abbreviation mark) ────────────────────────────────────────────────────────
    // AFTER step 2. สหรัฐฯ (×10, "the US") is read exactly as สหรัฐ; the mark itself is silent. It sits
    // in the Thai block, so leaving it corrupts the host word's syllabification (see the header).
    s = s.replace(/ฯ/gu, "");

    // ── 5. de-group thousands ─────────────────────────────────────────────────────────────────────
    // FIRST among the numeric rules: otherwise the grouping comma is clause punctuation and the number
    // is read in two halves with a pause between them. Exactly-three-digit blocks only.
    s = s.replace(/(?<=\d),(?=\d{3}(?!\d))/gu, "");

    // ── 6. clock ─────────────────────────────────────────────────────────────────────────────────
    // BEFORE step 7 (times before decimals — Thai writes the clock with a PERIOD, 09.30 น., so the
    // decimal rule would otherwise claim all 16 of them) and BEFORE step 8 (which would eat the น.
    // that is the ONLY thing distinguishing a clock from a decimal here: 802.11n and 6.34 นิ้ว and
    // 3.50 เมตร are decimals, 09.30 น. is a time). น. = นาฬิกา, the formal register FLEURS is written in.
    // Range first, so the leading time of `22.00-23.00 น.` — which carries no น. of its own — is
    // recognised; ถึง is unambiguous there because the corpus instance is inside ระหว่าง ("between").
    s = s.replace(
        /(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})\s*น\./gu,
        (_m, h1: string, m1: string, h2: string, m2: string) =>
            `${clock(h1, m1)} ถึง ${clock(h2, m2)}`,
    );
    s = s.replace(
        /(\d{1,2})[.:](\d{2})\s*น\./gu,
        (_m, hh: string, mm: string) => clock(hh, mm),
    );
    s = s.replace(/(\d{1,2})\s*น\./gu, (_m, hh: string) => `${Number(hh)} นาฬิกา`);

    // ── 7. decimals ──────────────────────────────────────────────────────────────────────────────
    // AFTER step 6. The point is จุด and the fractional digits are spelled ONE AT A TIME.
    s = s.replace(
        /(\d)\.(\d+)/gu,
        (_m, last: string, frac: string) => `${last} จุด ${spellDigits(frac)}`,
    );

    // ── 8. Thai abbreviations (units, eras, titles) ──────────────────────────────────────────────
    // AFTER steps 5-7: the unit guard is "a digit immediately to the left", and de-grouping (3,850 →
    // 3850) is what makes that digit adjacent, while the clock and decimal rules have already removed
    // every period that is NOT an abbreviation dot. Applied longest-key-first (see ABBREV).
    for (const { re, to } of ABBREV_RULES) s = s.replace(re, to);

    // ── 8b. the plus sign → บวก, SOURCED FROM THE CORPUS'S OWN AUDIO ─────────────────────────────
    // The corpus's two instances are `ตามเวลาท้องถิ่น (UTC+1)`, and the sign was DROPPED outright:
    // `(UTC+1)` read *jˈuː tʰˈiː sˈiː nˈɯŋ* — "U T C one", with nothing where the plus was.
    //
    // ⚠ THREE TEXT TIERS FAILED ON THIS WORD BEFORE THE AUDIO SETTLED IT, and each failed differently:
    //   · `concept.ts` returns the BARE CHARACTER `+` as Thai's own label for "plus sign"
    //   · `attest.ts` on ลบ returns the ADJECTIVE "negative" — การป้อนกลับทางลบ, negative feedback — not the
    //     operator; คูณ and บวก returned zero hits in the wiki haystack
    //   · Cohere-transcribe renders Thai audio as VIETNAMESE-looking nonsense, and Whisper transcribes Thai
    //     accurately but RE-ORTHOGRAPHIZES, emitting `UTC + 1` and `11.00 น.` — it hands the glyph back
    //   · MMS-1b-all (tha adapter) is accurate too and also emits the sign, `utc.1`; on control languages it
    //     silently DROPPED a demonstrably spoken plus (hi's प्लस, ta's பிளஸ்), so a character in its output
    //     is not evidence a word was said
    //
    // What answers it is a PHONEME recognizer — facebook/wav2vec2-xlsr-53-espeak-cv-ft, whose 392-token
    // vocabulary contains no `+` at all, so it physically cannot echo the orthography back. Both th_za
    // speakers, 2 of 2:
    //     … t ɔ ŋ k i5 n  j uː t iː s i5   b ʊ k   l i5 ŋ  t i5 w aɪ h ɑu5 s …
    //     … t ɑu5 ŋ t i5 n  j u5 t i5 s i5  b ʊ k   n ŋ    t i5 w aɪ t h ɑu5 s …
    // `j uː t iː s i5` is ยูทีซี, `b ʊ k` is บวก, and `n ŋ`/`l i5 ŋ` is หนึ่ง — "UTC บวก หนึ่ง". The engine
    // already reads บวก as bˈua˨˩k and หนึ่ง as nˈɯ˨˩ŋ, matching the decode, so no new lexical data is needed.
    // The method was validated on hi, where a text ASR had already given the answer: 4 of 4, including
    // reproducing the SILENCE before a temperature, which shows it does not invent the word either.
    //
    // BEFORE the degree rule, which is the ordering coupling zu's `[+]?` taught: a rule that consumes the
    // sign's operand must not get there first. Thai's degree rule does not match the sign today, so this is
    // insurance rather than a fix. `+30°C` has ZERO corpus instances here (unlike most of the fleet — th_th
    // does not carry the Montevideo sentence), so that arm is the arbitrary-text case #584 argues for: a
    // dropped sign is inaudible, which is the one outcome that cannot be right.
    s = s.replace(/\s*\+\s*(?=\d)/gu, " บวก ");

    // ── 9. degree sign ───────────────────────────────────────────────────────────────────────────
    // °C before a bare ° (else the C is left behind and routes to the English phonemizer as "sˈiː").
    s = s.replace(/\s*°\s*C(?![A-Za-z])/gu, " องศาเซลเซียส");
    s = s.replace(/\s*°/gu, " องศา");

    // ── 10. all-caps Latin initialisms → Thai letter names ───────────────────────────────────────
    // LAST of the Latin-facing rules, and deliberately narrow: the run must be flanked by neither a
    // letter nor a digit, which excludes A1GP and H5N1 (where the caps are part of a mixed token) while
    // still catching XDR-TB as two initialisms. Roman numerals cannot collide here — th is not in
    // registry.ts's ROMAN_NATIVE, so `III` has already become `3` before text() runs.
    s = s.replace(/(?<![A-Za-z0-9])[A-Z]{2,6}(?![A-Za-z0-9])/gu, (run) =>
        [...run].map((c) => THAI_LETTER_NAME[c]!).join(" "),
    );

    return s;
}
