/**
 * Abkhaz (ab) VIGESIMAL cardinal number compositor. Returns composed Abkhaz TEXT (space-separated) that
 * abkhaz.ts runs through the g2p, so the IPA stays consistent with the word engine. The numeral tables stay
 * HERE, beside the vigesimal compositor that is their only reader (abkhaz.jsonc carries the letter tables).
 *
 * SOURCE: ab.wikipedia «Иԥсабаратәу ахыԥхьаӡара» (Natural number), whose 0–99 table, hundreds list and thousands
 * list are cited there to Хәарцкиа Ҳ. И. & Џьонуа Б. Гь., «АУРЫС-АԤСУА, АԤСУА-АУРЫС акомпиутертә терминқәа
 * ржәар», Аҟәа 2012. Cross-checked word-for-word against ab.wikipedia's own per-number and year articles across
 * the 21–99, 101–199, 201–999 and 1001–2020 ranges. Zero is from «Аноль».
 *
 * ⚠ THE SCORE CONSTRUCTION (20–99) — the traditional NW-Caucasian base-20 system. The four score words are
 * 20 ҩажәа, 40 ҩынҩажәа (2×20), 60 хынҩажәа (3×20), 80 ԥшьынҩажәа (4×20). An exact multiple of 20 is just that
 * word; anything else is the score's CONNECTIVE form (final -а → -и, "and") plus a SPACE plus the plain 1–19
 * word — so, exactly as in Georgian, the whole 1–19 series INCLUDING THE TEENS attaches into one slot:
 *     30 = 20+10 ҩажәи жәаба      45 = 2×20+5  ҩынҩажәи хәба     67 = 3×20+7  хынҩажәи быжьба
 *     89 = 4×20+9 ԥшьынҩажәи жәба 99 = 4×20+19 ԥшьынҩажәи зеижә
 * ⚠ THERE IS NO "TEN" DIGIT: 50 is ҩынҩажәи жәаба (2×20+10), 70 хынҩажәи жәаба, 90 ԥшьынҩажәи жәаба.
 *
 * ⚠ THE SAME -и CONNECTIVE MARKS A NON-FINAL HUNDRED: 100 шәкы but 101 шәи акы; 200 ҩышә but 201 ҩышәи акы.
 * Stored as bare/comb pairs below. The THOUSAND word does NOT take it (1001 зқьы акы, 2001 ҩнызқь акы).
 *
 * ⚠ THOUSANDS ARE FUSED for a multiplier of 1–10 (зқьы, ҩнызқь, хнызқь … жәанызқь) and for exactly 100
 * (шәнызқь); any other multiplier is spelled out plus the separate word нызқь (20 000 ҩажәа нызқь).
 *
 * ⚠ CITATION FORM / CLASS AGREEMENT — the one real judgment call. Abkhaz numerals agree with the HUMAN vs
 * NON-HUMAN class of what they count: the human series is built with -ҩык/-џьара (аӡәы "one person", ҩыџьа "two
 * people"), the non-human/abstract series is акы, ҩба, хԥа … A bare numeral in a TTS input string has NO counted
 * noun and therefore no class to agree with, so this compositor emits the NON-HUMAN series throughout — which is
 * also the series ab.wikipedia's own number articles use to name the numbers themselves, i.e. the citation form a
 * speaker reads a bare digit string with. Human-class concord would need the noun and is out of scope here.
 *
 * Other judgment calls: 7 is authored быжьба (the year articles and Omniglot) where the dictionary table writes
 * the syncopated бжьба, which also surfaces in the derived 7000 бжьнызқь — both are current, so the fuller stem
 * is used for the standalone numeral and the source's own form for each derived word. 500 is authored хәышә per
 * the hundreds list, though the 555/1500 year articles write the syncopated хәшә(и). 10^6 / 10^9 use the Russian
 * loans миллион / миллиард, attested in running ab.wikipedia text; a count of 1 is read as the bare noun,
 * parallel to зқьы for 1000.
 */
/** 0–19, the plain series that attaches after a score's -и connective. */
const SUB20 = [
    "аноль", "акы", "ҩба", "хԥа", "ԥшьба", "хәба", "фба", "быжьба", "ааба", "жәба",
    "жәаба", "жәеиза", "жәаҩа", "жәаха", "жәиԥшь", "жәохә", "жәаф", "жәибжь", "жәаа", "зеижә",
];
/** Score words indexed by the score count 1–4 (= 20, 40, 60, 80); index 0 is unused padding.
 *  `COMB` is the connective form (final -а → -и) used when a 1–19 remainder follows. */
const SCORE_BARE = ["", "ҩажәа", "ҩынҩажәа", "хынҩажәа", "ԥшьынҩажәа"];
const SCORE_COMB = ["", "ҩажәи", "ҩынҩажәи", "хынҩажәи", "ԥшьынҩажәи"];
/** Round hundreds indexed by the hundreds digit 1–9; `COMB` again takes the -и connective (шәкы → шәи акы). */
const HUND_BARE = ["", "шәкы", "ҩышә", "хышә", "ԥшьышә", "хәышә", "фышә", "быжьшәы", "аашәы", "жәшәы"];
const HUND_COMB = ["", "шәи", "ҩышәи", "хышәи", "ԥшьышәи", "хәышәи", "фышәи", "быжьшәи", "аашәи", "жәшәи"];
/** FUSED thousands for a multiplier of 1–10 (index = the multiplier). */
const THOUSAND_FUSED = [
    "", "зқьы", "ҩнызқь", "хнызқь", "ԥшьнызқь", "хәнызқь",
    "фнызқь", "бжьнызқь", "аанызқь", "жәнызқь", "жәанызқь",
];
const THOUSAND_HUNDRED = "шәнызқь"; // 100 000, likewise fused
const THOUSAND_WORD = "нызқь"; // the separate word used with any other multiplier
const MILLION = "миллион";
const MILLIARD = "миллиард";

/** 0–99 → Abkhaz text. 20–99 is score·20 + remainder, the score in its -и connective form. */
function sub100(n: number): string {
    if (n < 20) return SUB20[n]!;
    const s = Math.floor(n / 20), // 1–4 → ҩажә / ҩынҩажә / хынҩажә / ԥшьынҩажә
        r = n - s * 20; // 0–19
    return r === 0 ? SCORE_BARE[s]! : `${SCORE_COMB[s]} ${SUB20[r]}`;
}

/** 0–999 → Abkhaz text. The round hundred takes its -и connective iff a sub-hundred remainder follows. */
function sub1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return sub100(n);
    return r === 0 ? HUND_BARE[h]! : `${HUND_COMB[h]} ${sub100(r)}`;
}

/** A thousands group: fused for a multiplier of 1–10 and for 100, otherwise multiplier + нызқь. */
function thousands(count: number): string {
    if (count <= 10) return THOUSAND_FUSED[count]!;
    if (count === 100) return THOUSAND_HUNDRED;
    return `${sub1000(count)} ${THOUSAND_WORD}`;
}

/** Read a raw digit STRING digit-by-digit — the fallback beyond the миллиард group (n ≥ 10^12). */
export function readDigits(digits: string): string {
    return digits
        .split("")
        .map((d) => SUB20[Number(d)] ?? d)
        .join(" ");
}

/** A non-negative integer (< 10^12) → space-separated Abkhaz cardinal words. */
export function numberToWords(n: number): string {
    if (n < 0 || !Number.isFinite(n)) return "";
    n = Math.floor(n);
    if (n === 0) return SUB20[0]!; // аноль
    if (n >= 1e12) return readDigits(String(n));
    const parts: string[] = [];
    const bil = Math.floor(n / 1e9);
    n %= 1e9;
    if (bil) parts.push(bil === 1 ? MILLIARD : `${sub1000(bil)} ${MILLIARD}`);
    const mil = Math.floor(n / 1e6);
    n %= 1e6;
    if (mil) parts.push(mil === 1 ? MILLION : `${sub1000(mil)} ${MILLION}`);
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(thousands(th));
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
