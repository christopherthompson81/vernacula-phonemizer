/**
 * Xhosa / isiXhosa (xh) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED over the 1,509 unique cased xh_za FLEURS utterances (column 3 — column 4 is lowercased and
 * stripped of exactly the punctuation this layer exists to read):
 *   concord-prefix + hyphen + digits ×310 over 85 prefixes (ngo- ×62, eziyi- ×30, ye- ×16, ezingama- ×12)
 *   comma-grouped thousands ×28 · space-grouped ×6 · dot decimals ×11 (+1 decimal COMMA, 2,3 miliyoni)
 *   colon clocks ×12 (3 of them written `10: 00` with a SPACE) + dot clocks ×2 (12.00 GMT, 15.00 UTC)
 *   sports times ×3 (4: 41.30, 2: 11.60, 1: 09.02 — must NOT be claimed) · a.m./p.m. ×5
 *   ranges ×13 = 7 ascending spans + 3 scores (5-3, 7-2, 26 - 00) + 1 season (1995-96) + 1 decimal span
 *   currency ×12 signs in 9 lines ($ ×8, ¥ ×3, £ ×1; US$ ×3) · percent ×4
 *   units mm ×8, km ×9, cm ×2, mi ×2, m ×2, km² ×1 · rates km/h ×6, mph ×3, m/s ×1, kph ×1, Mbit/s ×1
 *   degrees ×2 (+30°C, 35°W) · English ordinal suffix ×9 (15th, 16th ×3, 17th-century, 18th, 60th)
 *   dotted abbreviations ×14 (U.S. ×2, U.S ×2, U.S.Geological, B.C.E., Jr. ×4, Mnu. ×3, N.Wayne, St.)
 *   all-caps initialisms ×112 tokens / 74 forms — 102/71 once the era markers and the Roman `II` come out,
 *     which is exactly the mined artifact's own `initialism: 102` cell · era markers ×6 (BCE ×4, BC, B.C.E.)
 *   ampersand ×2 · fraction ×1 · exponent ×1 · slash-as-"or" ×10 · Mbit/s ×1 · sq mi ×3
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   eziyi-3,850    → ɛz̤ˈiːji kʼutʰˈaːtʰu , amakʰˈuːlu …   the grouping comma became a SENTENCE-grade pause
 *   eziyi-12.8     → … iʃˈuːmi nambˈiːni . isib̤ˈɔːz̤ɔ      the decimal dot became a full stop
 *   ngo-1:15 a.m.  → … kʼˈuːɲɛ , iʃˈuːmi nanɬˈaːnu ˈaː . m .   colon pause + two more from a.m.
 *   ngo-12.00 GMT  → … . ikǃˈaːnd̤a ɡ̤mtʼ                   :00 read as *iqanda*, the zero word — "egg"
 *   leUS$30 / i$10 → lˈɛːus amaʃˈuːmi amatʰˈaːtʰu / ˈiː iʃˈuːmi   the $ silently DROPPED (both)
 *   ne-¥2,500      → nˈɛː kʼuɓˈiːni , amakʰˈuːlu amaɬˈaːnu  the ¥ undeclared, so DROPPED
 *   +30°C / 35°W   → amaʃˈuːmi amatʰˈaːtʰu kǀ / … w         ° dropped and C read as a CLICK
 *   480 km/h       → … iikʰilɔmˈiːtʰa h                     the /h as a bare letter
 *   133 m/s        → … m s        · 300 mph → … mpʰ · 35 mm → … mm      raw letters
 *   3,850 km²      → kʼutʰˈaːtʰu , … kʼm                    comma pause, raw km, ² gone
 *   6 500          → isitʰand̤ˈaːtʰu amakʰˈuːlu amaɬˈaːnu    "six five hundred"
 *   18th           → iʃˈuːmi nɛsib̤ˈɔːz̤ɔ tʰ                 the English suffix as [tʰ]
 *   U.S. / B.C.E.  → ˈuː . s . / ɓ . kǀ . ˈɛː .              two and three SENTENCE BREAKS
 *   UMnu. Costello → ˈuːmnu . kǀɔstʼˈɛːllɔ                   the abbreviation dot as a full stop
 *   B&amp;B        → ɓ ɓ                                     the HTML entity dropped
 *   120-160        → ikʰˈuːlu … ikʰˈuːlu …                   no joiner between the endpoints
 *
 * ─── THE NOUN-CLASS CONCORD, measured rather than assumed (playbook trap 14) ───
 *
 * The thing that looks hard in a Bantu language is agreement: a numeral qualifying a noun takes a concord
 * agreeing with that noun's class (*iimizuzu emithathu*, *iinyanga ezintathu*). It does not arise as a
 * rule here, and the reason is orthographic: **Xhosa writes the concord explicitly, hyphenated onto the
 * digits** — `ezingama-3000`, `eziyi-12.8`, `abayi-93%`, `ngo-1957`, `ku-100-200`, `imizuzu emi-3`,
 * `iminyaka engama-250`. 310 occurrences over 85 distinct prefixes. The engine drops the hyphen, emits the
 * prefix as its own word and then the cardinal — i.e. it reads exactly what is written. So the concord is
 * DATA IN THE TEXT, not something to derive, and every rule below leaves its operand as DIGITS so that
 * concord still lands on it (and so the shared symbol tier can still see number–unit adjacency).
 *
 * Trap 15's spaced alternation does not exist in Xhosa: `grep -oPE '[0-9] (na|ne|nga|ku|nge|ye)(?![a-z])'`
 * over the corpus finds 6 hits and every one is a prefix on the FOLLOWING token (`240 ye-km`, `Inombolo-1
 * neye-2`), never a detached suffix on the preceding number. So no spaced alternative is admitted (trap 9).
 *
 * THE ONE RULE THAT NEEDS WORDS IS THE CLOCK, for exactly the trap-14 reason: the minutes take the
 * connective `na-`, a BOUND morpheme that cannot be glued to a digit run. So step 8 converts both operands
 * to words itself, applies the fusion, and claims the a.m./p.m. marker and the timezone in the same match —
 * because after words-ification the shared tier can no longer see them (trap 14's second clause).
 *
 * ─── WORDS I DECLINED TO INVENT ───
 *
 * **No decimal-separator word is asserted.** It is absent from the corpus (`chaphaza` occurs only as the
 * verb *-chaphazela*, ×8), from both xh referees, from `xhosa.jsonc`, from the HSRC Grade 1–3
 * English/isiXhosa maths dictionary (which has *inkqubo yedesimali* for "the decimal system" and nothing
 * for the point), and from isiXhosa Wikipedia — and **espeak-ng has no Xhosa at all**, so there is no
 * `dictsource/xh_list` to read. The rule therefore removes the separator and reads the fractional digits
 * one at a time. The point is not spoken; it was not spoken before either — before, it was a full stop.
 * This is the Fula lesson applied in the negative: a wrong high-traffic word is worse than a missing one.
 *
 * **No era phrase and no letter names.** See the "deliberately not done" list in the PR; both are counted
 * (6 and 102) and both are refusals for want of a source, not for want of a seam. `core/initialisms.ts` needs
 * a `letterName` table; without one its `spellOut` returns undefined and the pass is a NO-OP, so wiring it
 * would change nothing — Swahili's situation verbatim, not Slovak's (trap 16).
 */
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA — every literal here is sourced; see the sourcing table in the PR and Run 3 of the investigation.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The manifest's own connective series (`nanye` … `nethoba`): units 1–9 already have their na- form. */
const NA = MANIFEST.numbers.na;

/** Nguni vowel coalescence for the connective `na-` + a vowel-initial noun, read off the manifest's own
 *  `na` series: na+*ithoba* → *nethoba*, na+*isibhozo* → *nesibhozo* (a+i→e), and na+*amashumi* →
 *  *namashumi* (a+a→a). a+u→o completes the standard three-way set. */
const COALESCE: Readonly<Record<string, string>> = { a: "a", e: "e", i: "e", o: "o", u: "o" };

/** Measure nouns. `iikhilomitha`/`iimitha`/`iimayile`/`iikhilogram` are corpus tokens; `iisentimitha` is
 *  the corpus's `ziisentimitha` with its concord stripped and is the HSRC dictionary's *isentimitha*.
 *  `iimilimitha` is COMPOSED — the corpus's own SI pattern (iikhilomitha, ziisentimitha, iimitha) applied
 *  to `mili-`; it is attested in no source and is flagged as such in the PR. */
const UNIT_WORD: Readonly<Record<string, string>> = {
    km: "iikhilomitha", m: "iimitha", cm: "iisentimitha", mm: "iimilimitha",
    mi: "iimayile", kg: "iikhilogram",
};

/** Rate denominators. Both are single ATTESTED words meaning "per hour"/"per second" — the corpus's own
 *  *iikhilomitha ezingama-17,500 ngeyure* and *imayile eziyi-8 ngomzuzwana* — not an "A per B" composition,
 *  which is why rates are resolved here rather than through the shared tier's `unitPer`. */
const PER: Readonly<Record<string, string>> = { h: "ngeyure", u: "ngeyure", s: "ngomzuzwana" };

/** Currency, for the DECIMAL path only (an integer amount is the shared tier's — see xhosa.ts). Keys must
 *  match the tier's declaration or a decimal and an integer would read differently. */
const CUR_WORD: Readonly<Record<string, string>> = {
    "US$": "iidola zaseMelika", "AUD$": "iidola", "$": "iidola", "£": "iiponti", "¥": "iiyeni",
};

/** Magnitude words as the corpus writes them, longest first (`yezigidi` ×9, `izigidi` ×4, `bhiliyoni`,
 *  `miliyoni`). Shared with xhosa.ts's `magnitudes`; kept identical so the decimal and integer paths agree. */
/** …plus `million`, which the corpus writes UNTRANSLATED in its one archipelago sentence (`2.2 million
 *  km2`). Without it the magnitude sits between the number and the unit, the tier's adjacency fails and
 *  `km2` reached the IPA as raw letters — the gap the Luxembourgish run measured and correctly declined to
 *  fix in core; here it is one declared string. */
export const MAGNITUDES: readonly string[] = [
    "yezigidi", "zezigidi", "izigidi", "bhiliyoni", "miliyoni", "million",
];
const MAG_ALT = [...MAGNITUDES].sort((a, b) => b.length - a.length).join("|");

/** Compass points for a bare degree (`35°W` is a LONGITUDE, not a temperature). Every one is a corpus
 *  morpheme: *entshona yeMontana*, *emantla-mpuma*, *kumzantsi ntshona*, *nasempuma Atlantic*. */
const COMPASS: Readonly<Record<string, string>> = {
    N: "emantla", S: "emazantsi", E: "empuma", W: "entshona",
};

/** a.m./p.m. `kusasa` is the corpus's own clock marker (*ngentsimbi ye 9:30 kusasa*) and the HSRC
 *  dictionary's gloss (*am – amaxesha akusasa*); `emva kwemini` is corpus-verbatim (*ngoLwesithathu emva
 *  kwemini*) and is literally *post meridiem*, so it is right for every p.m. hour rather than only the
 *  three (8:30, 9:19, 10:08 p.m.) the corpus happens to contain — trap 8. */
const AM = "kusasa";
const PM = "emva kwemini";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** `na-` prefixed to a numeral's words, with the coalescence above. Units 1–9 come from the manifest's own
 *  `na` series rather than being derived, because those forms are suppletive (`kunye` → `nanye`). */
function connective(n: number): string {
    if (n < 10) return NA[n] ?? numberToWords(n);
    const parts = numberToWords(n).split(" ");
    const head = parts[0]!;
    const v = COALESCE[head[0]!.toLowerCase()];
    parts[0] = v === undefined ? `na ${head}` : `n${v}${head.slice(1)}`;
    return parts.join(" ");
}

/** An hour and its minutes as Xhosa words. `:00` emits the hour alone — the alternative is the manifest's
 *  zero word `iqanda` ("egg"), which is what `12.00 GMT` read before. */
function clockWords(h: number, m: number): string {
    return m === 0 ? numberToWords(h) : `${numberToWords(h)} ${connective(m)}`;
}

/** The digits of a fractional part, spaced so the number path speaks them one at a time. Reading `34` as a
 *  number would say *amashumi amathathu nane* — "thirty-four" — which is a different quantity. */
const spell = (int: string, frac: string): string => `${int} ${[...frac].join(" ")}`;

/** Is a word appearing anywhere in the ~40 characters before this offset? Used for the trap-12 redundancy
 *  guard on `amaqondo`: the corpus's one Celsius reading already says it (*amaqondo angaphezulu kwe
 *  +30°C*), so emitting it again would double the noun. */
function saidBefore(full: string, offset: number, word: string): boolean {
    return full.slice(Math.max(0, offset - 40), offset).includes(word);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Normalize one Xhosa input string. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeXhosa(input: string): string {
    let s = input;

    // 1) HTML ENTITY, then the bare ampersand → `kunye` ("and", ×195 in the corpus; the HSRC dictionary
    //    also glosses *plus* as *kunye*). The entity must go first or `&amp;` would become
    //    "kunye amp ;". The corpus's two instances are `iiB&amp;B` and `Arts & Sciences`; before this the
    //    entity was dropped outright and `B&amp;B` read as two bare consonants.
    s = s.replace(/&amp;/giu, "&").replace(/&/gu, " kunye ");

    // 2) DOTTED CAPITAL RUNS → the bare letters, BEFORE anything else reads an interior dot as a phrase
    //    break (playbook ordering: multi-dot abbreviations before single-dot). `U.S.` ×2, `U.S` ×2,
    //    `U.S.Geological` ×1, `B.C.E.` ×1 — nine sentence-grade pauses between them.
    //    THE FINAL DOT IS KEPT WHEN THE SENTENCE VISIBLY ENDS (the Swahili `expandDotted` lesson): the
    //    corpus's `…yase U.S.` at end of input would otherwise lose its sentence break. Three cases,
    //    disambiguated by what follows: a letter with NO space is a glued word (`U.S.Geological` → "US
    //    Geological"); a space then a capital, or end of input, is a sentence end (keep the dot); anything
    //    else is mid-sentence (drop it).
    s = s.replace(/(?<![\p{L}\p{M}])(?:\p{Lu}\.){2,}/gu, (run, off: number, full: string) => {
        const letters = run.replace(/\./gu, "");
        const rest = full.slice(off + run.length);
        if (/^[\p{L}\p{M}]/u.test(rest)) return `${letters} `; // glued next word
        return rest === "" || /^[  ]+\p{Lu}/u.test(rest) ? `${letters}.` : letters;
    });
    //    `U.S House` — one dot, so the run above cannot claim it.
    s = s.replace(/(?<![\p{L}\p{M}])(\p{Lu})\.(\p{Lu})(?![\p{L}\p{M}])/gu, "$1$2");
    //    `uN.Wayne Hale Jr.` — a personal initial glued to the name; the dot was a full stop. The
    //    lookbehind excludes only an UPPERCASE letter, not any letter: the corpus writes this one with the
    //    Xhosa subject prefix glued on front (`uN.Wayne`), so a `(?<![\p{L}\p{M}])` guard — which is what
    //    core/initialisms.ts's LONE_INITIAL uses — declined it. The dangerous shape (a sentence ending in a
    //    lone capital before a new one) is still excluded, because the lookahead requires the next capital
    //    to be GLUED to the dot with no space.
    s = s.replace(/(?<![\p{Lu}\p{M}])(\p{Lu})\.(?=\p{Lu}\p{Ll})/gu, "$1 ");

    // 3) ABBREVIATIONS whose expansion the corpus supplies itself. `Mnu.` → `Mnumzana`, from the corpus's
    //    own *U Mnumzana u Reid*; ×2 (`UMnu.`, `Mnu.`) plus one dotless `uMnu`. Requires a following
    //    capitalised name so the token cannot be claimed inside anything else (trap 2).
    //    `Jr.` ×4 has no Xhosa reading to give it, so only its DOT is removed, and only when a lowercase
    //    word follows — i.e. when the sentence visibly continues (both corpus instances do). `St.` ×1 is
    //    deliberately untouched: it is an English place name (St James Gate), as in the Swahili layer.
    s = s.replace(/(?<![\p{L}\p{M}])(u?)Mnu\.?(?=[  ]\p{Lu})/giu, "$1Mnumzana");
    s = s.replace(/(?<![\p{L}\p{M}])Jr\.(?=[  ]\p{Ll})/gu, "Jr");

    // 4) THOUSANDS DE-GROUPING, before anything else numeric (playbook ordering rule #1): the grouping
    //    comma was read as clause punctuation and the tail as a separate number, so `3,850` came out
    //    *kuthathu , amakhulu asibhozo amashumi amahlanu* and `11,000` ended in *iqanda* ("egg"). ×28.
    //    Exactly three digits per block, which is what keeps the corpus's decimal comma (`2,3 miliyoni`)
    //    and its date comma (`Novemba 26,2008` — a FOUR-digit tail) out of this rule.
    //    THE TRAILING GUARD IS `(?![\d]|,\d)`, NOT `(?![\d.,])`, and the corpus diff is what said so: with
    //    the wider guard a grouped number followed by a CLAUSE comma or a sentence period declined to
    //    de-group — `ne-¥130,000, yaye` and `nayi-2,207.` both did — and the leftover comma was then read
    //    as a decimal separator by step 6, so `¥130,000` came out *ikhulu amashumi amathathu iqanda iqanda
    //    iqanda iiyeni*: "one hundred and thirty zero zero zero yen". The guard only needs to stop a
    //    PARTIAL grouped match (`1,234` inside `1,234,5`), which is exactly `,\d`.
    s = s.replace(/(?<![\d.,])(\d{1,3})(?:,\d{3})+(?![\d]|,\d)/gu, (whole) => whole.replace(/,/gu, ""));
    //    SPACE grouping ×6 (`6 500`, `10 000`, `55 000`). The shared tier's `NUM` already understands it,
    //    but the TOKEN does not, so `6 500` read "six five hundred". Blocks of exactly three digits, or
    //    "30 9" would fuse two unrelated numbers.
    s = s.replace(/(?<![\d.,])(\d{1,3})((?:[  ]\d{3})+)(?![\d])/gu,
        (whole) => whole.replace(/[  ]/gu, ""));

    // 5) THE CURRENCY SIGN, PRISED OFF ITS CONCORD PREFIX. This is the drop the playbook names: the shared
    //    tier is letter-bounded on the left, deliberately, so a sign written INSIDE a word cannot match —
    //    and Xhosa glues its concord straight onto the sign (`leUS$30`, `i$10`). Both signs were silently
    //    swallowed. A compound key cannot fix `i$`, because `i` is a Xhosa noun prefix and not a currency
    //    code, so the split belongs here and the compound key (`US$`) belongs in the tier. ALSO joins the
    //    spaced code form `US $ 14.7` so that same key matches it. BEFORE step 6, which needs to know
    //    which sign it is looking at.
    //    THE SPLIT MUST RUN BEFORE THE JOIN, and getting it the other way round silently undid the join:
    //    the split's own lookbehind is any letter, so it fires again on the `S` of a freshly joined `US$`
    //    and re-inserts the space, leaving `i-US $14.7` for the tier to match as a bare `$`. Running the
    //    split first means both spellings converge on `US$` and the compound key wins.
    s = s.replace(/(?<=[\p{L}\p{M}])(?=(?:US|AUD)?[$£¥€][  ]?\d)/gu, " ");
    s = s.replace(/(?<![\p{L}\p{M}])(US|AUD)[  ]+(?=[$£¥€][  ]?\d)/gu, "$1");

    // 6) A DECIMAL CARRYING A CURRENCY SIGN OR A UNIT must claim it here — trap 14's second clause. Step 12
    //    turns `14.7` into `14 7`, which destroys the number adjacency the shared tier matches on, so
    //    `US$ 14.7 yezigidi` would have read *14 iidola zaseMelika 7 yezigidi* with the noun inside the
    //    number. Three instances: `US$ 14.7 yezigidi`, `$2.3 bhiliyoni`, `3.50 m`.
    //    A COMMA IS A DECIMAL SEPARATOR ONLY WITH A 1–2 DIGIT TAIL — the same discipline step 14 uses, and
    //    it belongs here too: without it these two rules ate a grouped thousand that step 4 had declined.
    const decimal = (sep: string, frac: string): boolean => sep === "." || frac.length <= 2;
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}])(US\\$|AUD\\$|[$£¥])[  ]?(\\d+)([.,])(\\d+)((?:[  ](?:${MAG_ALT}))?)`, "gu"),
        (whole, sym: string, int: string, sep: string, frac: string, mag: string) =>
            decimal(sep, frac)
                ? `${spell(int, frac)}${mag} ${CUR_WORD[sym] ?? ""}`.replace(/[  ]+$/u, "")
                : whole);
    s = s.replace(/(?<![\d.,])(\d+)([.,])(\d+)[  ]?(km|mm|cm|kg|mi|m)(?![\p{L}\p{M}'’ʼ])/gu,
        (whole, int: string, sep: string, frac: string, u: string) =>
            decimal(sep, frac) ? `${spell(int, frac)} ${UNIT_WORD[u]!}` : whole);

    // 7) A DECIMAL RANGE, before the plain range rule and before step 12. The plain rule's lookbehind
    //    blocks a digit that follows a dot, so `4.2-3.9 yezigidi zeminyaka` — the corpus's one decimal span
    //    — matched nothing, and step 12 would then have spelled both sides out with the hyphen dropped and
    //    no joiner at all (the Hausa run shipped exactly that bug once). NOT ascending-gated: this one
    //    counts backwards in time (4.2 to 3.9 million years ago) and a decimal pair is never a score.
    s = s.replace(/(?<![\d.,])(\d+\.\d+)[  ]?[-–][  ]?(\d+\.\d+)(?![\d.])/gu, "$1 ukuya ku $2");

    // 8) THE CLOCK, colon form ×12 — and the one rule that must produce WORDS (trap 14). The minutes take
    //    the connective `na-`, a bound morpheme: `9:30` is *ithoba namashumi amathathu*, and `na` cannot be
    //    glued to a digit run because the digits do not become words until the tokenizer, downstream of
    //    every rule here. So both operands are converted here and the fusion applied (see `connective`).
    //    Three corpus clocks are written with a SPACE after the colon (`10: 00`, `11: 00`, `8: 30`), hence
    //    `[  ]?`. `:00` emits the hour alone — otherwise the zero reads *iqanda*, "egg".
    //    A SPORTS TIME IS NOT A CLOCK: the corpus's `4: 41.30`, `2: 11.60` and `1: 09.02` are paces, and
    //    the trailing `(?![:.\d])` is what declines them (a third field). Verified: none is claimed.
    //    The a.m./p.m. marker is consumed in the SAME match, because after words-ification nothing
    //    downstream can associate it with the time — and its own dots were two more sentence breaks.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):[  ]?([0-5]\d)(?![:.\d])(?:[  ]*([AaPp])\.?[Mm]\.?)?/gu,
        (whole, h: string, m: string, ap: string | undefined) => {
            const hv = Number(h), mv = Number(m);
            if (hv > 23 || mv > 59) return whole;
            const marker = ap === undefined ? "" : ap.toLowerCase() === "p" ? ` ${PM}` : ` ${AM}`;
            return `${clockWords(hv, mv)}${marker}`;
        });

    // 9) THE CLOCK, DOT form before a timezone — `12.00 GMT`, `15.00 UTC` ×2. The dot is otherwise a
    //    decimal; a two-digit minute field plus a timezone name is what marks it as a time. AFTER step 8
    //    (no overlap, but the coupling is the same one) and BEFORE step 12, which would otherwise read
    //    `15.00` as *ishumi nanhlanu iqanda iqanda*.
    s = s.replace(/(?<![\d.,])(\d{1,2})\.([0-5]\d)(?![.\d])[  ]*(UTC|GMT)/gu,
        (whole, h: string, m: string, tz: string) => {
            const hv = Number(h);
            return hv > 23 ? whole : `${clockWords(hv, Number(m))} ${tz}`;
        });

    // 10) RANGES → `ukuya ku` ("going to"), which is the corpus's own span idiom (`ukuya ku` ×4,
    //     `ukuya ku-` ×2, `ukuya kutsho kwi-` ×2, and `ofikelela ku-100-200` writes the very prefix).
    //     ASCENDING ONLY, measured: of the 13 `N-N` shapes, 7 ascending ones are genuine spans
    //     (100-200, 120-160, 1418 – 1450, 1469-1539, 1644-1912, 1894-1895, 35-40, 56-64) and the rest are
    //     ice-hockey/tennis scores (5-3, 7-2, `26 - 00`) plus the season 1995-96, which read as a bare
    //     juxtaposition and must keep it. Both operands stay DIGITS, so the following unit is still
    //     adjacent for step 11 and for the tier (`56-64 km/h`). AFTER de-grouping, so a grouped endpoint is
    //     already one run of digits; BEFORE step 11 for that adjacency.
    s = s.replace(/(?<![\d.,])(\d+)[  ]?[-–][  ]?(\d+)(?![\d.,])/gu,
        (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} ukuya ku ${b}` : whole));

    // 11) RATES ×11. Resolved locally rather than through the tier's `unitPer` because Xhosa's denominator
    //     is a SINGLE attested word, not an "A per B" composition: `ngeyure` ×6 and `ngomzuzwana` ×2 both
    //     appear in the corpus beside a number (*iikhilomitha ezingama-17,500 ngeyure*). Covers the glued,
    //     spaced and spaced-slash spellings the corpus writes (`160km/h`, `480 km/h`, `83 km / h`, `133
    //     m/s`) plus `mph` ×3 and `kph` ×1. Numbers stay DIGITS. BEFORE step 12, which would break the
    //     adjacency.
    s = s.replace(/(?<![\d.,])(\d+)[  ]?(km|mi|m)[  ]*\/[  ]*(h|u|s)(?![\p{L}\p{M}])/giu,
        (whole, n: string, u: string, d: string) => {
            const head = UNIT_WORD[u.toLowerCase()], per = PER[d.toLowerCase()];
            return head === undefined || per === undefined ? whole : `${n} ${head} ${per}`;
        });
    s = s.replace(/(?<![\d.,])(\d+)[  ]?(mph|kph)(?![\p{L}\p{M}])/giu,
        (_m, n: string, u: string) =>
            `${n} ${u.toLowerCase() === "kph" ? UNIT_WORD["km"]! : UNIT_WORD["mi"]!} ${PER["h"]!}`);

    // 12) DEGREES ×2 — `+30°C` (temperature) and `35°W` (a longitude). The ° was dropped and the scale
    //     letter read as a phoneme: `C` came out as the CLICK [kǀ], because ⟨c⟩ is a click in Xhosa
    //     orthography. That is also why NO scale name is emitted — "Celsius" spelled in Xhosa would read
    //     its C as a click, and no Xhosa spelling of it is attested anywhere (the HSRC dictionary has no
    //     Celsius entry). `amaqondo` is the corpus's own degree word.
    //     TRAP 12: the corpus's one Celsius sentence ALREADY says it — *amaqondo angaphezulu kwe +30°C* —
    //     so a second `amaqondo` would double the noun. Suppressed when the word precedes.
    //     BEFORE step 13, which needs the digits intact.
    //     `F` is claimed alongside `C` although the corpus has no Fahrenheit — trap 8: the adversarial
    //     neighbour of an attested rule. Without it, `30°F` fell through every branch here (the bare-degree
    //     rule's trailing guard rejects a letter) and lost the ° while the F reached the g2p raw.
    //     THE SIGN IS CLAIMED HERE TOO, and asymmetrically. A leading `+` on a temperature is a POSITIVITY
    //     marker, and the corpus's one instance — *amaqondo angaphezulu kwe +30°C* — already says it in
    //     words (*angaphezulu*, "above"), so saying it again would double the meaning: trap 12, and the
    //     reason the artifact scan's residual `DROP math-sign ×1` is that sentence and is permissible.
    //     A leading `-` is a real negative and IS read (0 corpus instances; trap 8's adversarial
    //     neighbour), because otherwise step 14's minus rule could not see it — the ° rewrite has already
    //     separated the sign from its digits by then.
    //     THE SIGN CAPTURE IS LETTER-GUARDED, and it has to be: Xhosa's concord hyphen looks exactly like a
    //     minus. Unguarded, `kwi-30°C` — an ordinary Xhosa spelling — read *kwi thabatha amaqondo 30*,
    //     "in minus thirty degrees". Same family as trap 1: the pattern was wider than the orthography.
    s = s.replace(/(?<![\p{L}\p{M}\d])([+-])?(\d+)[  ]?°[  ]?[CF](?![\p{L}\p{M}])/gu,
        (_m, sign: string | undefined, n: string, off: number, full: string) => {
            const body = saidBefore(full, off, "maqondo") ? n : `amaqondo ${n}`;
            return sign === "-" ? `thabatha ${body}` : body;
        });
    s = s.replace(/(\d+)[  ]?°[  ]?([NSEW])(?![\p{L}\p{M}])/gu, (_m, n: string, c: string, off: number, full: string) =>
        `${saidBefore(full, off, "maqondo") ? n : `amaqondo ${n}`} ${COMPASS[c]!}`);
    s = s.replace(/(\d+)[  ]?[°º](?![\p{L}\p{M}])/gu, (_m, n: string, off: number, full: string) =>
        saidBefore(full, off, "maqondo") ? n : `amaqondo ${n}`);

    // 13) THE ENGLISH ORDINAL SUFFIX ×9 (`15th`, `16th` ×3, `17th`, `17th-century`, `18th`, `60th`). Every
    //     one already carries its Xhosa concord in the text — *ngesenturi ye 16th*, *nge 15th senturi*,
    //     *yakhe ye 60th*, *yango 17th-century* — so the Latin suffix is redundant orthography, and it was
    //     reaching the phoneme stream as a bare [tʰ]. Stripping it is the whole fix; no ordinal morphology
    //     is invented (Xhosa's is written, and is written here). Case-insensitive (trap 7).
    s = s.replace(/(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1");

    // 14) RELATIONAL AND ARITHMETIC SIGNS. `=` `<` `>` `×` `÷` have ZERO corpus instances and are read
    //     anyway, for the reason #584 gives and the lb and cs layers take: a phonemizer is handed arbitrary
    //     text, and a dropped sign is INAUDIBLE — the one outcome that cannot be right. Every word comes
    //     from the HSRC English/isiXhosa maths dictionary's own entry for that SYMBOL, and most are corpus
    //     tokens too: *ngaphantsi kuna-* (< , its entry reads "Isimboli/uphawu < luthetha encinane…";
    //     corpus ×13 + `kuna` ×16), *ingaphezulu kuna-* (>, corpus ×24), *phinda-phinda* (×, the corpus's
    //     own *esiphindaphindwe*), *yahlula* (÷), *Lilingana ne-* (=), *dibanisa* (+, corpus ×8),
    //     *thabatha* (−, corpus ×6). AFTER step 10, so no range dash reaches here.
    //
    //     THE TWO SIGNED-NUMBER GUARDS ARE MEASURED, not stylistic:
    //     · `+` is read only BETWEEN two operands (`UTC+1`, `4+4`). The corpus's other instance is
    //       `amaqondo angaphezulu kwe +30°C` — a POSITIVITY marker, redundant with the sentence's own
    //       *angaphezulu* ("above"), which is trap 12 exactly: the correct reading is byte-identical with
    //       and without the sign, so it stays unread and the artifact scan's residual `DROP math-sign ×1`
    //       is that sentence.
    //       ⚠ THAT SILENCE IS NOW SOURCED, NOT MERELY ARGUED, and the reason for it has changed. It used to
    //       rest on "Xhosa has no attested positivity word"; the word IS now known — `plas`, see below — so
    //       absence is no longer the argument. What survives is the redundancy, and it is confirmed by the
    //       recordings: BOTH xh_za speakers of the Montevideo sentence produce no plus phones at all
    //       (`…a n a p e z u l u k w e t e t i…`), while all three of the UTC sentence do. Same language,
    //       same sign, two positions, and the readers themselves make the distinction.
    //     · `-` is read only where it cannot be a compound hyphen or a stray dash: nothing alphanumeric
    //       before it, AND not a space that itself follows a word. The corpus's one ` -N` is
    //       `ebhudla kangange -40 mph`, where the English original reads "winds blowing at 40 mph" — a
    //       stray hyphen, not a negative, so reading it as *thabatha* would be confidently wrong (the
    //       Burmese `DROP minus` precedent). Measured: the guarded pattern matches 0 corpus instances.
    s = s.replace(/[  ]*[=≈][  ]*/gu, " lilingana ne ");
    s = s.replace(/[  ]*<[  ]*/gu, " ngaphantsi kuna ");
    s = s.replace(/[  ]*>[  ]*/gu, " ngaphezulu kuna ");
    s = s.replace(/(\d)[  ]*×[  ]*(?=\d)/gu, "$1 phindaphinda ");
    s = s.replace(/[  ]*÷[  ]*/gu, " yahlula ");
    //     ⚠ `+` BETWEEN OPERANDS IS `plas`, NOT `dibanisa`, AND THE CORPUS'S OWN AUDIO IS WHY. `dibanisa` is
    //     the HSRC dictionary's ADDITION OPERATOR and it is a correct gloss of the symbol; it is not what a
    //     reader says in `UTC+1`. All THREE xh_za speakers of that sentence say the English loan — decoded
    //     with facebook/wav2vec2-xlsr-53-espeak-cv-ft (a PHONEME recognizer, so its vocabulary contains no
    //     `+` and no digits and it physically cannot echo the orthography back):
    //         j u t i s i  p l a s  w a n   ·   j u tʃ i s i  b l a s  w a n   ·   j u s t i s i  p l a s  w a n
    //     The method was validated on hi, where the answer was already known from a text ASR: it reproduced
    //     `p l a s e k` / `p l e s w a n` for the offset and NO plus phones for the temperature, 4 of 4.
    //     `plas` and not `plus`: the attested vowel is [a], and this orthography is phonemic, so `plus` would
    //     read pʼlˈuːs. ⚠ The conventional isiXhosa spelling of the loan is UNSOURCED — this spelling is
    //     chosen to reproduce the attested PHONES, which is what this layer exists to feed.
    s = s.replace(/(?<=[\p{L}\d])\+(?=\d)/gu, " plas ");
    //     A LEADING `+` is read too — the degree rule at step 12 has already claimed the one instance where
    //     it would double the sentence's own words, so what reaches here is the arbitrary-text case, and
    //     #584's rule applies: a dropped sign is inaudible.
    s = s.replace(/(?<![\p{L}\p{M}\d])\+[  ]?(?=\d)/gu, "plas ");
    s = s.replace(/(?<![\p{L}\p{M}\d])(?<![\p{L}\p{M}][  ])[-−](?=\d)/gu, "thabatha ");

    // 15) DECIMALS ×11, LAST of the numeric rules — steps 6 to 12 all need the number intact. The dot was
    //     reaching `clausePunctuation` and becoming a SENTENCE BREAK inside a number. The fractional digits
    //     are spaced apart so the number path speaks them one at a time; reading `34` as a number would say
    //     *amashumi amathathu nane*, a different quantity. NO separator word is emitted — see the header:
    //     none is attested in any source this repo or espeak has, and espeak has no Xhosa at all.
    //     Also claims the corpus's ONE decimal comma (`eziyi-2,3 miliyoni`), restricted to a 1–2 digit
    //     tail so the date comma `Novemba 26,2008` cannot be swallowed, and `802.11n`, whose dot was a
    //     full stop too.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d])/gu, (_m, int: string, frac: string) => spell(int, frac));
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (_m, int: string, frac: string) => spell(int, frac));

    // A padded replacement (` kunye `, `letters `) doubles a space that was already there and can leave one
    // at an edge. SLOT-GAP is a corpus-diff defect class; this pass must not feed it.
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
