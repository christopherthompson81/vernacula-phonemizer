/**
 * Bavarian (bar) text normalization — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the pipeline speaks. Pure text→text, no IPA. Runs inside bavarian.ts's
 * `text()`, before the tokenizer.
 *
 * ⚠ THE EVIDENCE IS THE BAVARIAN SUBSET OF THE ARTIFACT, NOT THE ARTIFACT. `tools/corpus/mined/bar.jsonc`
 * is a bar.wikipedia dump and **24.0% of its uniform sample tier is not Bavarian** — Standard German
 * bibliographies and quotations, plus a little English (measured with
 * `tools/normalization/filter-by-language.py --lang bar`, which grew a `bar` row and a German CONTRAST set
 * for this run: the stock test contrasts the target against ENGLISH, and German shares no function word
 * with the English list, so unmodified it would have scored every German paragraph as Bavarian). That is
 * nearly twice su.wikipedia's 12.9%, and it lands where the playbook says it lands — in the pattern-rich
 * cells a normalizer is written from:
 *
 *     colon "clock"   12 → 3    the Beethoven opus catalogue (`Opus 120: 33 Variationen`), `TWV 32:13`
 *     `u. a.`          6 → 0    entirely German bibliography (`Minga u. a. 2006`)
 *     sign + digit   154 → 32   German-language ISBN hyphens
 *     `&`            107 → 83   and see below — none of the 83 is an ampersand
 *
 * **Every count in this file is over the 246 Bavarian segments**, and where the whole-dump cell count is
 * quoted it is labelled `unfiltered`.
 *
 * ⚠ AND A STANDARD GERMAN WORD MUST NOT STAND IN FOR A BAVARIAN ONE. bar.wikipedia is explicit about this
 * where it matters: its own euro article opens `Da Eiro (amtli: Euro, Symboi: €)` — **`Eiro` is the word
 * and `Euro` is the official/German form**, and a `Euro` probe scores 60 token hits in 20 articles almost
 * all of which are German book titles. Same shape for the clock noun (`A Uah (dt.: Uhr…)`). Every word
 * this file emits was probed on bar.wikipedia with `tools/normalization/attest.ts` and its prose read.
 */
import { MANIFEST } from "./manifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * MONTH NAMES, in the Bavarian spellings, because the ordinal detector fires on the word AFTER the dot and
 * these are what it must recognise. Source: bar.wikipedia's own twelve-month navigation table (reached from
 * `bar.wikipedia.org/wiki/Jenna`, which glosses itself "Jenna oda Jänna … Jänner in Östareich und Südtirol").
 * The corpus writes `Jenna` ×4, `Novemba` ×4, `August` ×4, `Mai` ×3, `Juni` ×3, `Dezemba` ×2, `Oktoba` ×2,
 * `Aprui` ×1, `Feba`, `Julei` — so the alternation carries the variants the corpus uses beside the wiki's
 * table forms rather than picking one and missing the rest.
 */
const MONTHS = "Jenna|Jänna|Jänner|Januar|Feba|Februar|Meaz|März|Aprui|Aprü|April|Mai|Juni|Julei|Juli"
    + "|August|Septemba|September|Oktoba|Oktober|Novemba|November|Dezemba|Dezember";

/**
 * The other nouns that license an ordinal reading. `Joahundat` is the corpus's most frequent one and it has
 * **four spellings in 246 segments** — `Joahundat`, `Joarhundat`, `Joahhundat`, `Jourhundeascht` — which is
 * what having no codified orthography costs a detector, so the pattern is built to tolerate it rather than
 * to enumerate it. `Beziak` (the Vienna districts, ×5) and `Person` (grammatical person in the grammar
 * articles, ×8) are the two other frequent heads; `Lebmsjoar`/`Lebensjoar` and `Buachstob` are the tail.
 */
const ORDINAL_NOUN = `Jo(?:a|ar|our)h+und(?:at|ad|eascht|ert)s?|Jh|Beziak|Person|Lebm?s?joar|Lebensjoar|Buachstob|Auflage`;

/**
 * ⚠ THE LICENSERS ARE THE BAVARIAN ARTICLE AND PREPOSITION FORMS, tabulated the way German's trap-4 rule
 * was — from what actually precedes an `N.` across the 246 Bavarian segments, not from German's list:
 *
 *     am 13 · da 6 · vom 5 · im 4 · de 4 · zum 2 · seitm 2 · Vom 2 · om 2 · bis 2 · ois · dea · ins · ausm
 *
 * `seitm` and `ausm` are fused preposition+article forms German writes apart, and `om` is this corpus's
 * spelling of `am`; a German licenser list would have missed all three.
 */
const LICENSER = new Set([
    "am", "om", "im", "vom", "zum", "beim", "ins", "seitm", "seit", "ausm", "aus", "bis", "nach", "noch",
    "vo", "von", "da", "dea", "de", "des", "dem", "den", "d", "ois", "as", "s",
]);

/** Read from the manifest — see the jsonc, where the evidence lives. */
const ORDINAL = MANIFEST.ordinalStems;

/**
 * DOTTED ABBREVIATIONS, and every expansion is a word the **Bavarian subset itself** spells out elsewhere —
 * composed from attested pieces rather than asserted (the Fula lesson):
 *
 *     z. B.  ×13   → "zum Beispui"        `zum Beispui` ×5 in the same 246 segments
 *     bzw.   ×5    → "beziehungsweise"    spelled out ×2 ("mit 18 beziahungsweis 17 °C", "17,9
 *                                          beziehungsweise 17,1 °C") — both spellings, the ⟨-e⟩ one kept
 *     za.    ×5    → "zirka"              `zirka` ×2 / `ziaka` ×1 ("is zirka 14 km vom … Middlpunkt")
 *     Eihw.  ×5    → "Eihwohna"           `Eihwohna` ×13
 *     Mrd.   ×1    → "Milliardn"          bavarian.jsonc's own `billion.plural`
 *     Mio.   ×0    → "Millionen"          bavarian.jsonc's own `million.plural`; declared for the shape
 *
 * ⚠ `d. h.` (×1) IS DELIBERATELY ABSENT. Its expansion would be "des hoaßt", and while `des` is everywhere,
 * the verb is attested exactly once and in one article's spelling (`hoißt`, "In Bayern hoißt ma dean Sender
 * meisdns oafach as Dritte"). One instance to fix, one article to source it from — a lead, not a finding —
 * so it stays as it reads. `u. a.` is absent because the Bavarian subset has **zero** (all 6 raw hits are
 * German bibliography), and `v. Chr.`/`n. Chr.` because the Bavarian subset has zero era markers at all;
 * bar.wikipedia writes `v. Kr.` ("1000 v. Kr."), whose expansion nothing here sources.
 */
const MULTI_DOT: readonly (readonly [RegExp, string])[] = [
    [/(?<![\p{L}\p{M}])z\.\s?B\./giu, "zum Beispui"],
];
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    bzw: "beziehungsweise", za: "zirka", ca: "zirka", eihw: "Eihwohna", mrd: "Milliardn", mio: "Millionen",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/**
 * THE SHARED SYMBOL TIER. Every word here was probed on bar.wikipedia and its prose read; the counts are
 * token hits × articles from `tools/corpus/attest/bar.jsonc`.
 *
 * `Prozent` ×128/19 — and the sense is the one wanted: "a Minus vo 23,6 Prozent seit 1998", "86,01 Prozent
 *   Weißn, 6,71 Prozent Afroamerikana". 52 instances in the Bavarian subset, written both glued (`59%`) and
 *   spaced (`2,1 %`), and **every one of them was silently deleted** before this file existed.
 *
 * `Eiro` ×— the euro, and NOT `Euro`: see the file header. "100 Zent san a Eiro", "5-Eiro Banknotn",
 *   "Da Eiro is 1999 eascht amoi ois Buachgejd eihgfiahd worn". The corpus postposes the sign
 *   (`11.709 €`, `21,905 Mrd. €`), which the tier handles in either position.
 * `Dollar` — "Dollar is da Name vo vaschiedne Weahrunga … As Wort Dollar kimmt vom deitschn Woat Taler",
 *   genuine Bavarian prose. The corpus writes it both before (`$3.5 Milliona`, `$ 45.000`) and after
 *   (`41.397 $`, `40.500 $`) the amount.
 * `Pfund` — one corpus instance (`£ 795 plus Steia`) and the ordinary Germanic word; declared because the
 *   sign occurs and a dropped sign is inaudible.
 * ⚠ `¥` IS NOT DECLARED: it does not occur in this corpus, and the playbook's own residue of unsourceable
 *   words is mostly somebody's `yen`. A sign the language never writes needs no word.
 *
 * `Kilometa` — overwhelming, and in exactly the numeric slot: "De Läng vo da Außngrenz is 2009 Kilometa.
 *   Davo foin auf Östareich 366 Kilometa, de Slowakei 515 Kilometa, de Ukraine 103 Kilometa …". ~30 `km`
 *   in the Bavarian subset, all distances, and `km` reached the IPA as the vowel-less cluster [km].
 * `Meta` — the corpus's own "De Moßeihheit is Meta" ("the unit of measure is the metre") and the wiki's
 *   "in zwoa Meta Hächn"; 3 instances (`410,87 m`, `374 m`, `362 m`), all heights.
 *   ⚠ A ONE-LETTER UNIT KEY, so traps 28/46 apply: the tier's `NOT_VERSION` guard rejects a dotted
 *   designation by seeing the DOT, and this file must therefore not spend the dot before the tier runs.
 *   Step 6 below de-groups only `\d\.\d{3}`, so the version dot survives — checked against this corpus's own
 *   dotted designation `8140.43P`, which keeps its dot and is not read as metres.
 * `Quadratkilometa` — a DEFINITIONAL article, which is the strongest kind of citation this route yields:
 *   "=== Quadratkilometa === As Zeichn is km². A Quadratkilometa is a million moi so grouß wia a
 *   Quadratmeta." One sentence gives the squared word, the symbol it spells, the metre form, and the
 *   POSITION — Bavarian fuses the modifier onto the FRONT, so `position: "compound"` and not `before`
 *   (which would give *Quadrat Kilometa) nor `after`. 11 `km²` in the Bavarian subset, exponent dropped.
 * `magnitudes` — the corpus's own, in all the spellings it uses: `10,5 Millionan Einwohna`, `81,8 Mijona
 *   Eihwohna`, `a hoiwe Milliardn Einwohna`, `$3.5 Milliona`, `21,905 Mrd. €` (whose `Mrd.` step 4 expands
 *   first). Declared because without it the currency cannot hop the magnitude and `21,905 Mrd. €` dropped its
 *   `€` outright. No `magnitudeConnective`: Bavarian is Germanic and takes none ("fünf Millionen Dollar"),
 *   which is the case that field exists to exclude.
 *
 * ⚠ NO RATE (`unitPer`/`rateDenominators`), and this is the one place I nearly shipped an unsourced word.
 *   `pro` is attested ("a Bevökarungsdichtn vo 30 Eihwohna pro Quadratkilometa") — but the DENOMINATOR nouns
 *   are not: nothing probed attests `Stund` or `Sekundn` for Bavarian, and the Bavarian subset contains
 *   **zero** `km/h` and **zero** `m/s` (the `rate` cell's 140 is unfiltered, and what the subset does carry is
 *   `U/min`, `KW/106 PS` and `Eihwohna/km²`, none of which is a rate this tier composes). An unsourced word
 *   for an unattested shape buys nothing, so both come out.
 *
 * `Kubik` / `Zantimeta` — the cube word was the last thing sourced and the word-first probes had all missed
 *   it, so the slot was named instead (trap 40): `insource:/Kubikmeta|Kubik|kubisch/` on bar.wikipedia returns
 *   it in nine articles, every one in the numeric slot — "an Rauminhoit vo 2.047.840.000 Kubikmeta" (Cheamsee),
 *   "a mittlern Abfluss vo 175 Kubikmeta in da Sekund" (Isar), "a Hochbehöita mid 25.000 Kubikmeta"
 *   (Soizbuag), "220.000 Kubikmeta Wossa pro Tog", plus `Kubikkilometa` and a DEDICATED `Kubikmeta` article
 *   whose own sentence — "In aan Kubikmeta bassn genau ozöhte 1 Mülliaunan **Kubikzantimeta**" — sources the
 *   centimetre in the same breath, and in the ⟨a⟩ spelling ("finf Zantimeta iwan Bodn" elsewhere), not the
 *   German ⟨e⟩ one. Closes `m³` ×2 (`40.000 m³` retention basins) and `cm³` ×3 (`2.800 cm³` engine capacity).
 *   `mm` stays out: ×0 in the subset and nothing probed for it.
 *
 * `US$` — a COMPOUND KEY, because the tier is letter-bounded on the left so a bare `$` cannot match inside
 *   `US$105&nbsp;Milliona` and that was the last surviving `DROP currency`. Keys are matched longest-first, so
 *   the compound wins over the bare sign; the reading is the plain currency noun, which is what bar.wikipedia
 *   itself calls it ("De wichtigste Dollarweahrung is da US-Dollar").
 *
 * ⚠ NO `ampersand`. In the Bavarian subset **83 of 83 `&` are `&nbsp;`** and there is not one real
 *   ampersand; the only four in the whole artifact are German publisher names (`Königshausen & Neumann`,
 *   `W W Norton & Co`, `Quelle & Meyer`, `Rosa & Karl`). Declaring `und` here would be a rule about German
 *   bibliography attributed to Bavarian. The `&nbsp;` is handled as markup at step 1, where it belongs.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["Prozent"],
    currency: { "€": ["Eiro"], "US$": ["Dollar"], $: ["Dollar"], "£": ["Pfund"] },
    units: { km: ["Kilometa"], m: ["Meta"], cm: ["Zantimeta"] },
    exponentWords: { squared: ["Quadrat"], cubed: ["Kubik"], position: "compound" },
    magnitudes: ["Millionan", "Millionen", "Milliona", "Million", "Mijona", "Milliardn", "Milliarde"],
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Non-negative integer → the Bavarian ordinal, with the ending the governing word takes; `undefined`
 *  wherever the table has no sourced word, which makes the caller decline rather than invent one. */
function ordinalWord(n: number, weak: boolean): string | undefined {
    const stem = ORDINAL[n];
    return stem === undefined ? undefined : `${stem}${weak ? "n" : "e"}`;
}

/** Normalize one Bavarian input string. Pure text→text. */
export function normalizeBavarian(input: string): string {
    let s = input;

    // 1) ⚠ `&nbsp;` → A SPACE, FIRST, AND THIS IS THE LARGEST SINGLE DEFECT IN THE LANGUAGE. The dump-to-text
    //    kept the HTML entity, and bar.wikipedia writes it between a number and its unit constantly:
    //    `67&nbsp;km`, `3757&nbsp;km`, `-13&nbsp;°C`, `48°&nbsp;45′`. **83 of the 246 Bavarian segments carry
    //    one** (`ampersand` 12,230 unfiltered). Unhandled the engine's TOKEN sees `nbsp` as a Latin word run
    //    and PHONEMIZES IT — `67&nbsp;km` read as *simɑseçt͡sɡ̥ **nb̥sb̥** , km* — a spelling in the phoneme
    //    stream plus a spurious comma pause from the `;`.
    //    ⚠⚠ AND IT MUST BE FIRST BECAUSE IT BLINDS EVERY GUARD DOWNSTREAM OF IT. My first `°C` count over the
    //    Bavarian subset was ZERO; the true count is 11, and the difference is that the corpus writes
    //    `-13&nbsp;°C` and no pattern expecting a space or nothing can match across six intervening letters.
    //    Trap 49's shape (an injected sequence makes downstream guards misfire) arriving as markup rather than
    //    as mojibake, and trap 27's (a guard that assumes a space).
    //    A SPACE, never deletion: `67&nbsp;km` must stay two tokens (trap 26 — substitute, do not delete).
    s = s.replace(/&nbsp;|&#160;| /gu, " ");

    // 2) MULTI-DOT ABBREVIATIONS, before the single-dot rule so no interior dot survives as a phrase break,
    //    and before the ordinal rule so `z. B.` can never be mistaken for anything numeric. `z. B.` ×13 read
    //    as the two letters plus two sentence breaks: *t͡s . b̥ .*
    for (const [re, word] of MULTI_DOT) s = s.replace(re, word);

    // 3) ORDINALS — the largest LANGUAGE defect (71 `N.` in the Bavarian subset; `ordinal-latin` 17,226
    //    unfiltered), and playbook trap 4 in its original German form: a numeral plus a bare period that a
    //    regex cannot tell from a sentence end. Unhandled every one reads as a cardinal followed by a PAUSE
    //    — "am 10. November" → *ɑm t͡seɑ **.** nofemb̥ɐ*.
    //
    //    ⚠ THE DETECTOR IS BUILT FROM WHAT SURROUNDS `N.` IN THIS CORPUS, tabulated, not from German's list:
    //      AFTER   Person 8 · Beziak 5 · Jenna 4 · August 4 · Novemba 4 · Joahundat 4 · Joarhundat 3 · Mai 3
    //              Juni 3 · Dezemba 2 · Oktoba 2 · Lebmsjoar 2 · Aprui 1 · Buachstob 1
    //      BEFORE  am 13 · da 6 · vom 5 · im 4 · de 4 · zum 2 · seitm 2 · om 2 · bis 2 · ois · dea · ins · ausm
    //      NEITHER **5 with nothing after them, and `ISBN` ×3 / `Noch` / `Nochn` / `Kritisiat` / `An` / `Seit`
    //              after them — the sentence-final periods, which must NOT be claimed.**
    //    So the rule fires on the FOLLOWING word being a month or an ordinal noun, or on a PRECEDING licenser
    //    plus a capitalised noun. `2005. ISBN` fails both (ISBN is not an ordinal noun and `2005` has no
    //    licenser before it), and a segment-final `N.` has no following word at all. Zero sentence-final
    //    pauses are lost — the check German's rule states, re-run here.
    //
    //    ⚠ AND IT DECLINES WHEREVER THE WORD IS UNSOURCED. `ORDINAL` holds only the five values read in
    //    bar.wikipedia prose; everything else returns the match untouched, because this language's ordinals
    //    are NOT derivable from its own cardinal table (see the note on `ORDINAL`).
    //    The ending follows the governing word the way German's two-form rule does: a preposition/dative
    //    licenser takes the weak **-n** (`am easchtn Jenna`), a bare or `de`/`da` licenser the **-e**.
    //
    //    ⚠ AND WHEN THE LICENSER IS A BARE ARTICLE, THE PREPOSITION IN FRONT OF IT DECIDES — a one-word
    //    lookbehind gets this wrong a third of the time here. `da` is both the masculine nominative article
    //    and the feminine dative one, and the corpus writes it both ways with an ordinal:
    //        da zwoate Buachstob · da zehnte Buachstob · da zwanzigste Buachstob      → -e
    //        bei da drittn grossn Erweitarung · vo da 1. Person · in da 2. Person     → -n
    //    Counted over the 246 Bavarian segments, the two-word left context of an `N.` is `vo da` ×3, `in da`
    //    ×2 and `bei da` ×1 against `um de` ×2 and `aa de` ×2 — so five of the eleven article-licensed cases
    //    take a governing preposition and were reading with the wrong ending. `um` is deliberately NOT in the
    //    set: it governs the accusative and both of its instances take -e ("um de dritte Person Singular").
    const ARTICLE = new Set(["da", "de", "dea", "des", "dem", "den", "d"]);
    const WEAK_N = new Set(["am", "om", "im", "vom", "zum", "beim", "ins", "seitm", "seit", "ausm", "aus", "bis", "nach", "noch", "vo", "von", "dem", "den"]);
    const GOVERNS_WEAK = new Set(["vo", "von", "in", "bei", "mid", "mit", "zu", "af", "auf", "an", "aus", "noch", "nach", "seit"]);
    const ORD_RE = new RegExp(`(?:(\\p{L}+)(\\s+))?(?:(\\p{L}+)(\\s+))?(?<!\\p{Nd})(\\d{1,4})\\.(?=\\s+(\\p{L}+))`, "gu");
    s = s.replace(ORD_RE, (whole, pre2: string | undefined, sp2: string | undefined,
        prev: string | undefined, sp: string | undefined, digits: string, next: string) => {
        // Only ONE preceding word was captured when the match starts mid-sentence with a single word; shift.
        let p1 = prev, s1 = sp, p2 = pre2, s2 = sp2;
        if (p1 === undefined) { p1 = p2; s1 = s2; p2 = undefined; s2 = undefined; }
        const licensed = new RegExp(`^(?:${MONTHS}|${ORDINAL_NOUN})$`, "u").test(next)
            || (p1 !== undefined && LICENSER.has(p1.toLowerCase()) && /^\p{Lu}/u.test(next));
        if (!licensed) return whole;
        const low = p1?.toLowerCase();
        const weak = low !== undefined
            && (WEAK_N.has(low) || (ARTICLE.has(low) && p2 !== undefined && GOVERNS_WEAK.has(p2.toLowerCase())));
        const word = ordinalWord(Number(digits), weak);
        return word === undefined ? whole : `${p2 ?? ""}${s2 ?? ""}${p1 ?? ""}${s1 ?? ""}${word}`;
    });

    // 4) SINGLE-DOT ABBREVIATIONS. The dot is consumed while the sentence continues, so it cannot become a
    //    phrase break; at a phrase end it is kept, because there it really is the sentence end. AFTER the
    //    ordinal rule so `2005. ISBN` has already been declined rather than half-rewritten.
    //    ⚠ THE CONTINUATION LOOKAHEAD ADMITS A CURRENCY SIGN as well as a letter or digit, because the corpus's
    //    one `Mrd.` is `21,905 Mrd. €` — a letters-or-digits lookahead matched neither arm, so the abbreviation
    //    fell through unexpanded AND took the `€` with it (the tier needs `Milliardn` as a magnitude to hop).
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\p{Nd}\\p{Sc}])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 5) CLOCK, COLON FORM ONLY, and it is claimed on a thin but clean count. The Bavarian subset has
    //    **3 colon shapes and only 1 is a clock** — the other two are geometry: `Seitnvoöitnis 39:15:36
    //    (gkiazt: 13:5:12)`, a triangle's side ratio. bar.wikipedia's radio schedules supply the rest
    //    (`5:00-9:00 Uhr`, `9:00-12:00 Uhr`); `clock` is 518 unfiltered.
    //    The hour/minute guard rejects BOTH ratios on its own (`39` is not an hour, `5:` is not two minutes),
    //    and the trailing `(?!:\p{Nd})` is belt-and-braces against a third field — the `sports-time` cell's
    //    lesson that `4:41.30` is not a clock. `Uhr` is the corpus's own word in the time slot
    //    ("freitags vo 5 bis 2 Uhr"), even though the INSTRUMENT is `Uah` ("A Uah (dt.: Uhr, engl.: clock)").
    //    ⚠ NO DOT-FORM CLOCK. `11.00 Uhr` would collide head-on with the thousands grouping at step 6, which
    //    is 56 instances against zero attested dot-clocks — Danish declined the same shape for the same
    //    reason and the arithmetic here is even more lopsided.
    //
    //    ⚠⚠ THE LOOKBEHIND MUST EXCLUDE A COLON, NOT ONLY A DIGIT, and reading the output is what caught it.
    //    With `(?<!\p{Nd})` alone the rule RESTARTED INSIDE the ratio: rejected at `39`, the engine retried and
    //    matched `15:36`, so `Seitnvoöitnis 39:15:36` read "…neinadreißg , fuchzea UHR sechsadreißg". A guard
    //    that stops a match beginning at the FRONT of a run does not stop one beginning in the MIDDLE — the
    //    same lesson trap 28 records for `802.11g`, where a lookahead alone let the match restart at `11g`.
    const CLOCK = "(?<![\\p{Nd}:])([01]?\\d|2[0-3]):([0-5]\\d)(?![:.]?\\p{Nd})";
    const clockWords = (h: string, min: string, uhr: string): string => {
        const head = `${numberToWords(Number(h))}${uhr}`;
        return Number(min) === 0 ? head : `${head} ${numberToWords(Number(min))}`;
    };
    //    ⚠ THE RANGE IS CLAIMED FIRST — trap 14's ordering rule, "order by who needs words first". The hyphen
    //    between two clocks stops being punctuation the moment the clocks become WORDS: `5:00-9:00 Uhr`
    //    rewrote to `fimf Uhr-nein Uhr`, and this engine's TOKEN admits `-` INSIDE a word run
    //    (`hostWordRun(["Latin"], "'-")`), so `Uhr-nein` FUSED into one token and read *uɐ̯nɑɛ̯n*. The joiner is
    //    the corpus's own `bis`, which it writes in exactly this slot — "freitags vo 5 bis 2 Uhr", "18 bis 20",
    //    "0 bis –4 Grad Celsius", "−1 bis −2 °C", "10 bis 20 Prozent".
    s = s.replace(new RegExp(`${CLOCK}\\s*[-–—]\\s*${CLOCK}(\\s*Uhr)?`, "gu"),
        (_m, h1: string, m1: string, h2: string, m2: string, uhr?: string) =>
            `${clockWords(h1, m1, "")} bis ${clockWords(h2, m2, uhr ?? " Uhr")}`);
    s = s.replace(new RegExp(`${CLOCK}(\\s*Uhr)?`, "gu"),
        (_m, h: string, min: string, uhr?: string) => clockWords(h, min, uhr ?? " Uhr"));

    // 6) PERIOD-GROUPED THOUSANDS (56), before anything reads a bare number. The period is
    //    `clausePunctuation`, so `30.528 km²` read as *d̥rɑɛ̯sɡ̥ **.** fimf hund̥ɑd̥ ɔxd̥ɑt͡sʋɔnt͡sɡ̥* — a
    //    SENTENCE BREAK inside a number, and the magnitude lost with it. Exactly three digits and no more,
    //    repeated for the multi-group case (`4.324.782 km²`).
    //    ⚠ AFTER the clock (a dot form would have been eaten) and BEFORE the tier, whose `NOT_VERSION` guard
    //    needs the dot of `8140.43P` to still be there — traps 39 and 46. `.43` is two digits, so this rule
    //    cannot touch it, which is the whole reason the group size is pinned at exactly three.
    let prev: string;
    do {
        prev = s;
        s = s.replace(/(\p{Nd})\.(\p{Nd}{3})(?!\p{Nd})/gu, "$1$2");
    } while (s !== prev);
    // 6b) SPACE-GROUPED THOUSANDS (2: `549 000 €` and `43 000 €`, both in one municipality's finance
    //     paragraph). Small, but the reading is *fimfhundadneinafiazg **nul*** — the group read as a separate
    //     numeral. Same three-digit discipline as the dot form, which is what stops it claiming two numbers
    //     that merely stand next to each other.
    do {
        prev = s;
        s = s.replace(/(?<!\p{Nd})(\p{Nd}{1,3})[ \u00a0\u202f\u2009](\p{Nd}{3})(?!\p{Nd})/gu, "$1$2");  // space, NBSP, NNBSP, thin space
    } while (s !== prev);

    // 7) DEGREES, before the unit rules so the scale letter is not left to the Latin fallback, and before
    //    the sign rule so `−20 °C` still has its `°C` visible when the sign is judged. 11 in the Bavarian
    //    subset are TEMPERATURES (`-13 °C`, `8,2 °C`, `−1 bis −2 °C`) and 11 are COORDINATES or geometric
    //    angles (`47°16′15″`, `90°-Winkl`, `360°`, `19,2° Ost`) — the bare-degree arm reads both.
    //    `Grad` ×37/20 ("unta Nui Grad foin", "1 Grad is untateit in sechzg Minutn") and `Celsius` ×35/20
    //    ("0 bis –4 Grad Celsius", "middlara Frost: –4 bis –10 Grad Celsius"): the collocation is attested,
    //    not just the modifier (trap 37). ℃/℉ are folded first — one code point meaning what `°C` means.
    //    ⚠ The arc-minute and arc-second of a coordinate are LEFT UNREAD. `47°16′15″` has no sourced Bavarian
    //    word for ′/″ anywhere probed, and reading the degree while dropping the minute is the honest state.
    s = s.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    s = s.replace(/(\p{Nd})\s*°\s*C(?![\p{L}\p{M}])/gui, "$1 Grad Celsius");
    s = s.replace(/(\p{Nd})\s*°\s*F(?![\p{L}\p{M}])/gui, "$1 Grad Fahrenheit");
    //    ⚠ THE COMPOUND HYPHEN IS CONSUMED, and reading the output is what caught this too. `90°-Winkl` is a
    //    German-style compound ("a 90-degree angle"), and this engine's TOKEN admits `-` inside a word run, so
    //    emitting `90 Grad-Winkl` FUSED the two into one token: *ɡ̥rɑd̥ʋiŋɡ̥l*, where before the rule existed
    //    they were two clean words. Same cause as the clock range above, and the same class of hazard trap 14
    //    names — a rule that turns digits into WORDS changes what the tokenizer does with the punctuation next
    //    to them. 2 instances (`90°-Winkl`, `90°-Drehung`).
    s = s.replace(/(\p{Nd})\s*°\s*[-–—](?=\p{L})/gu, "$1 Grad ");
    s = s.replace(/(\p{Nd})\s*°/gu, "$1 Grad");

    // 8) THE SIGNS, AND ONLY IN THE DEGREE SLOT — the narrow arm, arrived at the way trap 24 says to arrive
    //    at one: by tabulating the counter-examples first. Of 32 sign+digit shapes in the Bavarian subset:
    //      RANGES        `5 - 8`, `6-9`, `10.–23.`, `1961 -1990`, `za. 208.000 Eihw. - 2011`
    //      ISBN          `3-86520-078-8`, `3-406-39771-9`, `3-7073-0606-2`
    //      DESIGNATIONS  `PS-10 Euro II`, `Anibal/PS-10`
    //      REAL SIGNS    `−45,9 Grad Celsius`, `-13 °C`, `−20 °C`, `+15 °C`, `+12 °C`, `+25 °C`, `−1 bis −2 °C`
    //    **Every real sign is followed by a degree word and no counter-example is**, so the degree lookahead
    //    separates them with zero false positives — the same discriminator Hindi reached from the opposite
    //    direction. A general `(^|\s)[-−–](\d)` rule would have read `1961 -1990` as *minus 1990*.
    //    Runs AFTER step 7, so the degree word is already there to look for.
    //    `minus` ×19/15, and the senses are exactly right: "unta minus 15 Grod" (a signed temperature),
    //    "Moi via, minus 10%" (the arithmetic operator), and "kauna mit an Minus nix aunfaunga … des
    //    Vuazeichn" (the SIGN itself, named as such). ⚠ `plus` ×45/18 is attested by COUNT and its examples
    //    are all `Adblock Plus`, a software product — trap 37's shape. It is kept anyway, on the corpus's own
    //    `£ 795 plus Steia` and because this corpus pairs the two signs in one sentence
    //    (`bei -13 °C im Winta und +15 °C im Summa`): omitting the plus there loses the contrast the author
    //    wrote. The playbook's audio tier says a measurement plus is often unvoiced — that is a fact about
    //    readers, not a licence to delete a character the author typed.
    //    ⚠⚠ AND THE LOOKAHEAD MUST REACH ACROSS A RANGE JOINER, or the FIRST operand of a signed range keeps
    //    its sign silent while the second gets one — `−1 bis −2 °C` read as "−1 bis MINUS zwoa Grad Celsius",
    //    because only the second number has a degree word directly after it. That is the worst possible
    //    half-fix: **omitting a plus is lossless and omitting a minus INVERTS**, so a rule that reads one end
    //    of a temperature range and not the other produces a span from positive one to minus two. Three
    //    corpus sentences take this shape and both joiners are the corpus's own — `−1 bis −2 °C` and, in the
    //    climate tables, `-0,5 beziehungsweise -1,4 °C` / `18 beziahungsweis 17 °C`.
    const JOINER = "(?:bis|beziehungsweise|beziahungsweis)";
    const NUM = "\\p{Nd}[\\p{Nd},.]*";
    const DEGREE_AHEAD = `(?=\\s*${NUM}(?:\\s+${JOINER}\\s+[-−–+]?\\s*${NUM})?\\s+Grad)`;
    s = s.replace(new RegExp(`(^|[\\s(])[-−–]${DEGREE_AHEAD}`, "gu"), "$1minus ");
    s = s.replace(new RegExp(`(^|[\\s(])\\+${DEGREE_AHEAD}`, "gu"), "$1plus ");
    // ⚠ ± IS A SINGLE CHARACTER (U+00B1) and no `+` rule can ever match inside it; unread it is dropped in
    //    silence. Zero instances in this corpus — robustness for plausible input, not a measured repair, and
    //    both words come from the rules above rather than from anywhere new.
    s = s.replace(/±/gu, " plus minus ");

    // 9) FRACTIONS, NARROWLY. The Bavarian subset has **one** real fraction — `des hod 2/3 da
    //    Soizproduktion entsprochn` — against two shapes a German-style `\d{1,3}/\d{1,3}` rule would have
    //    claimed wrongly: `im Winta 469/470` (a year range) and `Santana 300/350` (a model designation).
    //    Two false positives against one true one is why the operands are capped at two digits and the
    //    denominator at the three values this language sources:
    //      2  `hoib`   — "rund a hoiwe Milliardn Einwohna", "de Hoibinsl Peloponnes"
    //      3  `Driddl` — "Etwoa zwoa Driddl vo d' Eihwohna sand gebirtige Liachtnstoana"
    //      4  `Viadl`  — "Viadl noch zwejfe", "entfoid guad aa Viadl auf Tiaf- und Higllända"
    //    Anything else returns unchanged. `1938/39`, `2016/17` and `38/2007` are all excluded by the digit
    //    caps, which is what keeps the year-range shape out.
    //    ⚠ A NUMERATOR OF 1 TAKES THE ARTICLE, NOT THE CITATION NUMERAL, and the corpus diff is what showed it:
    //    `wer oan Stich håt 1/3` came out *oans Driddl*, where `oans` is the counting form ("one!") and what
    //    the language writes here is the indefinite article `a` — "a hoiwe Milliardn Einwohna", "A
    //    Quadratkilometa is a million moi so grouß", "Etwoa zwoa Driddl". German makes the same distinction
    //    (*ein* halb, never *eins* halb); it is only visible in a fraction because nothing else puts a bare 1
    //    in front of a noun.
    const DENOM: Readonly<Record<number, string>> = { 2: "hoib", 3: "Driddl", 4: "Viadl" };
    s = s.replace(/(?<!\p{Nd})(\p{Nd}{1,2})\/(\p{Nd})(?!\p{Nd})/gu, (m0, a: string, b: string) => {
        const noun = DENOM[Number(b)];
        if (noun === undefined) return m0;
        return `${Number(a) === 1 ? "a" : numberToWords(Number(a))} ${noun}`;
    });

    // 9b) NUMERIC RANGES → the corpus's own joiner `bis`, which it writes between two numbers constantly in
    //     the spelled form ("18 bis 20", "10 bis 20 Prozent", "−1 bis −2 °C", "vo 5 bis 2 Uhr", "bis zu drei").
    //     Unhandled a range reads as two bare numerals with nothing between them.
    //
    //     ⚠ THE DISCRIMINATOR IS THAT A RANGE ASCENDS, and it was arrived at the way trap 24 says to arrive at
    //     one — by enumerating the counter-examples rather than by feel. Eight candidate shapes in the
    //     Bavarian subset:
    //       TRUE   `Beziak 5 - 8` · `in 6-9` · `1961 -1990` · `2003-2004` · `1863–1952` · `1465–1472` ·
    //              `1472–1474`   — district and year ranges, all ascending
    //       FALSE  `ÖNORM B 8115-2` — an Austrian STANDARD's part number, and the only counter-example
    //     `2 < 8115`, so requiring the second operand to exceed the first keeps all seven and rejects the one.
    //     ⚠ AND THE CHAIN GUARDS ARE WHAT KEEP ISBNs OUT, which the ordering test alone would not: in
    //     `3-86520-078-8` the pair `3-86520` ascends. A dash on either side of the pair disqualifies it, so
    //     every link of a hyphen chain is rejected — the same shape Danish uses, and the reason this rule can
    //     sit in a corpus whose largest hyphen population is German-language ISBNs.
    //     ⚠ Runs AFTER the ordinal rule, so `10.–23.` (an ordinal range) has already been seen and declined by
    //     both — the dot after the first operand stops this pattern too.
    s = s.replace(/(?<![-–—\p{Nd}])(\p{Nd}{1,4})\s?[-–—]\s?(\p{Nd}{1,4})(?![-–—\p{Nd}])/gu,
        (m0, a: string, b: string) => (Number(b) > Number(a) ? `${a} bis ${b}` : m0));

    // 10) THE SHARED SYMBOL TIER, LAST — percent, currency, units, the exponent and the rate. It matches on
    //     number-adjacency, so it must run after every rule that rewrites a number's neighbourhood (the
    //     degree sign, the grouping dot) and after nothing that would spend the dot it needs for
    //     `NOT_VERSION`. See the note on `SYMBOLS` for what each word is sourced from.
    s = SYMBOLS(s);

    // ── DELIBERATELY NOT DONE, each with the count that says so ─────────────────────────────────────────
    //
    // THE DECIMAL COMMA (79 in the Bavarian subset, `decimals` 13,651 unfiltered) — the largest unclaimed
    // class in this language, and a refusal rather than an omission. German's word is `Komma`. For Bavarian:
    //   · `Komma` scores 24 token hits in 19 bar.wikipedia articles and **not one is the punctuation mark**.
    //     Every example is the VERB: "do komma genau segn" (there we can see), "Heitzutog komma am Gleis
    //     grod noc wandan", "zu Schadn komma", "der Dreißgjährige Kriag komma is". A healthy count and the
    //     wrong word — the Fula `tere` failure caught in the act, in exactly the highest-traffic slot.
    //   · `insource:/[0-9] Komma [0-9]/` on bar.wikipedia returns **zero hits** — no spoken decimal is
    //     written out anywhere on the wiki.
    //   · bar.wiktionary has no `Komma` entry (404), so the dictionary check the playbook requires before
    //     accepting a silence-based refusal was run and came back empty.
    //   · And the homograph is not incidental: emitting `zeah komma fimf` produces a sequence that IS a
    //     Bavarian phrase, pronounced identically, meaning "ten come five".
    // A wrong percent word is worse than a dropped sign because it is confidently wrong; the same holds a
    // fortiori for the decimal point. Left unread — `10,5` keeps reading as *t͡seɑ , fimf*, which is a
    // spurious pause and is at least not a spurious WORD.
    //
    // `=` `<` `>` (12 in the Bavarian subset) — and this is a real divergence from German, which reads all
    // three. **Not one of the twelve is arithmetic.** They are metalinguistic notation, which is what a
    // dialect wiki's articles are largely about:
    //     `Lautwandlregl ei > oa`            a sound-change arrow
    //     `da- (< der-)`, `magy (< ugrisch`  derivation arrows
    //     `bei dem = beim`, `(= nach)`, `(= in)`, `ius = es Recht`, `ys = schnej`   glossing equals
    // Reading `<` as "kleaner ois" would be confidently wrong 12 times out of 12. Porting German's step 6b
    // here is the shape of error this whole layer exists to avoid, so the signs stay unread and `mine.ts
    // scan` keeps reporting `DROP math-sign` — a red gate that is correct (trap 24).
    //
    // INITIALISMS (`initialism` 28,563 unfiltered) — structurally blocked, not deferred.
    // `tools/normalization/sources.ts --lang bar` reports `letter-names [NONE] espeak does not ship this
    // language at all`, and `core/initialisms.ts` is a NO-OP without a letter-name table. Bavarian letter
    // names are not the German ones by assumption and nothing in this tree records them. Trap 16 says check
    // whether the seam exists before declaring the class out of scope: it exists, and the DATA does not.
    //
    // THE YEAR READING (`year` 67,053 unfiltered) — `1989` reads as *dausnd nein hundad neinaåchtzg*
    // ("one-thousand nine hundred…") where the Germanic convention is "neunzehnhundert…". ⚠ Measured before
    // assuming: **German does the same** — `phonemize("1989", "de")` gives *ˈaɪ̯ntaʊ̯zənt nˈɔʏ̯nhʊndɐt…* — so
    // this is the fleet's status quo for the closest treated sibling and not a Bavarian defect. Making bar
    // diverge from de on a number-reading convention, with nothing sourcing the Bavarian form, would be
    // inventing. Recorded so the next reader can re-run it in one command.
    //
    // ERA MARKERS (`era-marker` 264 unfiltered, **0 in the Bavarian subset**) — every raw hit is German
    // bibliography (`Halle a. S. 2012`). bar.wikipedia writes `v. Kr.` rather than `v. Chr.`, and nothing
    // probed sources the expansion, so the class is left alone.
    return s;
}
