/**
 * Hiligaynon / Ilonggo (hil) text normalization — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠⚠ THERE IS NO hil.wikipedia AND NO FLEURS, AND THAT SHAPES EVERYTHING BELOW. `meta`'s sitematrix lists
 * Wikipedias for bcl, ceb, ilo, pag, pam, tl and war and NONE for hil — a 9-million-speaker language with
 * six smaller Philippine neighbours online and itself absent. The whole of written Hiligaynon that this
 * tree can reach is the Wikimedia **Incubator**'s `Wp/hil` (1,929 mainspace pages), extracted from the
 * `incubatorwiki` dump with `wikidump-to-text.py --title-prefix "Wp/hil/"` — the route the hsn run added.
 * Two consequences run through this file:
 *
 *   1. **`attest.ts` CANNOT BE RUN FOR THIS LANGUAGE.** It probes `<lang>.wikipedia.org`. The substitute is
 *      the Incubator's own CirrusSearch (`insource:"…" prefix:Wp/hil/`), and its counts reproduce the dump
 *      exactly — so the dump IS the evidence, and there is no second haystack behind it.
 *   2. **The second source is a DICTIONARY, not a wiki** — Kaufmann, *Visayan-English Dictionary*
 *      (Iloilo, 1934; 23,557 entries, 191,698 Hiligaynon words), the standard reference for this language
 *      and independent of both the corpus and the two referees. Every word this file spends is cited to the
 *      corpus, to Kaufmann, or to both. Where neither has it, the symbol is left unread.
 *
 * ⚠ THE CORPUS IS TEMPLATED, AND THE COUNTS SAY SO RATHER THAN HIDING IT. Wp/hil is human-written, not
 * Lsjbot (so the ceb objection does not apply in full), but ~1,300 of its 3,799 paragraphs are municipality
 * stubs from one mould — *"Ang X ika-duha nga klase sang munisipalidad … May 302.18 kilometro kwadrado ini
 * nga kalaparon … Base sa 2024 census, ini may populasyon nga 14,473."* That template is where the bulk of
 * the `decimals` and `grouped` counts come from. It is still Hiligaynon prose written by Hiligaynon
 * speakers, and it is what the language has.
 *
 * ⚠ AND IT CARRIES TAGALOG. `filter-by-language.py --lang hil` needed a new CONTRAST row (tl + ceb, not
 * English — neither shares a function word with the stock English list) and drops 77 paragraphs, including
 * a whole Tagalog article. Every count below is post-filter.
 *
 * ⚠ HILIGAYNON WRITES THE ENGLISH CONVENTION, like Cebuano: the comma groups thousands (×1,872) and the
 * period marks the decimal (×1,643). Both were clause punctuation, so `14,473` read *napulo kag apat ,
 * apat ka gatos kag kapituan kag tatlo* — the value destroyed by a pause. Those two rules carry 3,515 of
 * the ~3,600 instances this layer touches; everything else here is single digits, quoted honestly.
 *
 * ⚠ WHAT DID NOT SURVIVE RE-MEASUREMENT FROM CEBUANO, the nearest treated sibling. Three rules copied
 * across would each have been wrong:
 *   · the range word. ceb reads `ngadto sa`; that phrase is ×0 in hil, which writes **`hasta`** — and
 *     writes it out BETWEEN DIGITS twenty times (`2016 hasta 2022`), the strongest attestation available.
 *   · the FRACTION rule, twice over — see the refusal below, and note that ceb's `1/2` word `tunga` is in
 *     Hiligaynon the PREPOSITION "in the middle of": all 21 corpus instances are `sa tunga sang X kag Y`
 *     (`sa tunga sang mga atomo`), and the half word is `katunga` (Kaufmann). Copying ceb would have read
 *     every `1/2` as "in the middle".
 *   · `$` → `dolyar`. ceb has ×4 corpus dollars; hil has ZERO `$`, zero `dolyar`, zero `dolar`, in the
 *     corpus, in Kaufmann and in both referees. Declared for hil would be pure invention (trap 37).
 * What DID survive: the English-convention grouping/decimal split, `punto`, `kada`, the closed dotted-
 * abbreviation list, and the `ika-` observation below.
 *
 * ⚠ FRACTIONS ARE DECLINED, AND THE REFUSAL IS A MEASUREMENT (trap 24 — this will keep `review.ts` red).
 * The corpus has TWO `\d/\d` instances and they are in the SAME SENTENCE, by one writer:
 * *"…nagasakop sa duha ka katatlo (2/3) sang sidlangan nga bahin, kag mga kapatagan naman sa katatlo
 * (1/3)…"*. That sentence is very good evidence for what it says — it glosses the digits with the reading,
 * which is the strongest shape attestation takes — but what it establishes is one denominator from one
 * author, and a fraction rule needs a DENOMINATOR SERIES (trap 13: the corpus's instances and the rule's
 * branches are different sets). Kaufmann has 23,557 entries and no `ka-`+numeral fraction paradigm: its
 * fraction words are lexical measures (`kahátì` "the fourth part of a peso", `kwartíyo`, `pulakán`,
 * `katungâ`, `kapíhak`), which do not compose. So a general rule would be inventing the denominators for
 * every value the corpus does not show, which is the Fula `tere` failure. Both corpus instances are
 * PARENTHETICAL GLOSSES of words the sentence has already spoken correctly, so the cost of the refusal is
 * a redundant `duha tatlo` in two places rather than a missing reading — the cheapest possible place to be
 * silent. `katunga` is sourced and available if a later run finds the series.
 *
 * ⚠ ONE SEAM ALREADY WORKS AND IS LEFT ALONE (trap 16), the same one ceb records: `ika-19 nga siglo`
 * already reads *ʔika napulo kag siyam*, because ⟨ika-⟩ is an ordinary Hiligaynon ordinal prefix
 * (Kaufmann: `ikaduhá, (H) Second`; `ikagatús — hundredth`) and the trailing hyphen falls out of the token.
 * ×20 with a digit, ×2,168 spelled out. Only the bound `-ng` variant needs a rule; see step 7.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { tr } from "../../core/provenance.ts";

/**
 * The shared symbol tier. Hiligaynon marks plurality with the particle `mga` and not on the noun, so each
 * CountForms is the single citation form.
 *
 * Sourced by whole-word count on the mined Wp/hil corpus, with Kaufmann beside it (playbook 5e):
 *   kwadrado ×1,661 · kilometro ×1,058 · kag ×2,207 · metro ×25 (Kaufmann `métro, (Sp. metro) Metre`) ·
 *   kada ×17 (Kaufmann `káda, (Sp. cada) Each`) · oras ×2 (Kaufmann `óras, (Sp. hora) Hour; time`) ·
 *   bilyon ×4 · milyon ×3 · libo ×1 (and all three are in the engine's own number data) · piso ×6.
 *
 * ⚠ THE PERCENT SPELLINGS TIE AT ×1 EACH AND THE CORPUS IS THE ONLY ARBITER. `4.4 porsiyento` and
 * `23 porsyento` are both digit-adjacent and both sit in unambiguously Hiligaynon sentences
 * (*ginasakup sang Panay*; *kun sa diin … naghalin*). Kaufmann predates the loan and carries neither — it
 * gives the NATIVE frame instead, `Napúlò sa gatús` ("ten per cent"), which is a different construction
 * (`N sa gatos`) and not a drop-in word. `porsiyento` is taken as the fuller lemma form; `porsyento` is
 * recorded here as its co-equal variant so nobody re-derives this from one hit. ⚠ A web search for this
 * word returns almost entirely TAGALOG dictionaries — the exact substitution that must not be made here —
 * so the two Hiligaynon corpus instances are the whole of the evidence, and they are enough because they
 * are IN THE SLOT.
 *
 * ⚠ `₱` IS DECLARED AND `$` IS NOT, and the asymmetry is the measurement. The corpus's single `₱` is a
 * MENTION — *"simbolo sang kurensiya: ₱; kodigo: PHP"* — but `piso` is attested ×6 including a monetary
 * use (*ang suplay sang piso sa Pilipinas nag-abot 569.2 bilyon*) and Kaufmann carries `písos`, so reading
 * the sign as the word is right and even improves that sentence. `$` occurs ZERO times and no dollar word
 * is attested anywhere; it stays undeclared (see ACCEPTED_SIGN_SILENCE).
 *
 * ⚠ NO CUBE WORD EXISTS AND THE PLAUSIBLE ONE IS A CHISEL HANDLE — trap 37 in its cleanest form. `kubiko`
 * is ×0 in the corpus, and Kaufmann's entry reads `kúbo, (Sp. cubo) The handle of a chisel`. `cubed` is
 * left undeclared, as ceb left it, rather than guessed from the Spanish.
 *
 * ⚠ BARE `m` IS DECLARED, AND TRAP 46 SAYS WHAT THAT COSTS. It buys three corpus readings — `2,465 m`,
 * `905 m` and, via the exponent branch, `4,905 m²` (which needs a head noun in `units` before the measure
 * word can attach at all). The hazard is a dotted designation: `802.11m` would read as eleven metres. The
 * tier's `NOT_VERSION` guard rejects that by seeing the DOT, and it still can here **only because this file
 * runs the tier at step 3, ABOVE the decimal rule at step 5** — the ordering that traps 39 and 46 exist to
 * pin. The `version-dot` cell is empty in this corpus (×0), so today the exposure is theoretical; the guard
 * is what keeps it that way.
 *
 * ⚠ `s` IS NOT DECLARED AS A RATE DENOMINATOR. `segundo` is ×0 in the corpus and absent from Kaufmann's
 * headwords; only `oras` is sourced, so only `h` composes.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["porsiyento"],
    currency: { "₱": ["piso"] },
    magnitudes: ["libo", "milyon", "bilyon", "trilyon"],
    units: { km: ["kilometro"], m: ["metro"], cm: ["sentimetro"], mm: ["milimetro"], kg: ["kilo"] },
    exponentWords: { squared: ["kwadrado"], position: "after" },
    unitPer: "kada",
    rateDenominators: { h: "oras" },
    // `kag` ×2,207 is the commonest word in the corpus and is the engine's own numeral conjunction, so the
    // ampersand needs no separate sourcing. ⚠ Both corpus instances sit inside ENGLISH spans — a company
    // name (`Philippine Telephone and Telegraph Company (PT & T)`) and a school programme
    // (`sekundarya (junior & senior high)`) — so this closes a DROP rather than repairing Hiligaynon prose,
    // and it is spaced on both sides by the tier so `PT & T` stays three tokens (trap 18).
    ampersand: "kag",
});

/**
 * Dotted abbreviations, and the list is SHORT ON PURPOSE.
 *
 * ⚠ TRAP 2 CAUGHT IN THE ACT, exactly as it was on the Cebuano run. A first tabulation of
 * `[A-Z][a-z]{0,4}\.` reported ~110 "abbreviations"; reading them shows the bulk are SENTENCE ENDS —
 * `Panay.` ×8, `Asya.` ×5, `Roxas.` ×3, `Islam.` ×3, `Samar.` ×2, `Luzon.` ×2. The genuine dotted forms are
 * `Inc.` ×5, `Sr.` ×4, `Rev.` ×3, `Jr.` ×3, `Fr.` ×2, `Dr.` ×2 plus a tail of personal initials
 * (`P.` ×7, `U.` ×4, `C.` ×4, `J.` ×3 …), ~20 in all. So the rule is keyed on a CLOSED LIST and never on
 * the shape, and the dot is KEPT so a genuine sentence end is unaffected either way (trap 4).
 *
 * ⚠ EVERY EXPANSION IS SOURCED, AND TWO WERE CUT FOR NOT BEING. Kaufmann carries `doktór`, `ginóo`
 * ("Lord, master; gentleman, Mr"), `gínang` ("Lady, Madam, Mrs"), `propesór`, `sánto` and `pádre`; the
 * corpus carries `padre` ×4, `santo` ×19, `ginang` ×3, `ginoo` ×2, `junior` ×1, `senior` ×1.
 *   · `Rev.` ×3 is NOT expanded — `reberendo` is ×0 in the corpus, ×0 in Kaufmann and ×0 in both referees.
 *     It already reads as a pronounceable token, so the only loss is the spurious pause.
 *   · `Inc.` ×5 is NOT expanded either, for the same reason plus a second one: "Incorporated" is an English
 *     word, and `Inc.` already reads as an ordinary readable syllable. A missing reading, not a wrong one.
 * `Fr.` IS expanded, because it is the one that does not survive being left alone: ⟨f⟩→[p] and ⟨r⟩→[ɾ], so
 * the bare abbreviation reads as the vowel-less cluster [pɾ]. Both instances are `Rev. Fr.` before a
 * priest's name, and `padre` is attested in both sources.
 */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    dr: "Doktor", jr: "Junior", sr: "Senior", st: "Santo", mr: "Ginoo", mrs: "Ginang",
    prof: "Propesor", fr: "Padre",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
export function normalizeHiligaynon(input: string): string {
    let s = input;

    // ── 1. DE-GROUP THOUSANDS — FIRST, and the biggest defect this layer repairs ─────────────────────────
    // ×1,872, every one comma-grouped (`may populasyon nga 14,473`, `3,389 ka barangay`). `,` is clause
    // punctuation and the TOKEN splits on `\d+`, so the value was read as two numbers with a pause between
    // them, and `6,000` came out *anum , sero*.
    // ⚠ EXACTLY THREE DIGITS PER GROUP, so the ×1,643 decimals survive. The trailing guard rejects only a
    // following DIGIT, so a grouped number followed by its decimal point still de-groups — which the corpus
    // needs: `4,428.81 kilometro kwadrado`, `1,821.42`, `12,706 km²`.
    // ⚠ AND THE PERIOD-THOUSANDS FORM IS DELIBERATELY NOT HANDLED. It occurs exactly ONCE — `populasyon nga
    // 17.865 ka pumuluyo`, in an article about a GERMAN town, i.e. the source's own imported convention —
    // against 1,643 period-decimals. Claiming it would need a rule that cannot tell the two apart. Step 5's
    // two-digit cap means this one instance falls through untouched rather than being read as a decimal.
    s = tr(s, /(?<![\d.,])([1-9]\d{0,2}(?:,\d{3})+)(?!\d)/gu, (m) => m.replaceAll(",", ""));

    // ── 2. CLOCK — BEFORE the tier and before the decimal rule ───────────────────────────────────────────
    // ×1: `halin Sabado sa alas-5:00 sang aga tubtob sa Domingo`. The colon is clause punctuation, so it
    // read *ʔalas lima , sero* — a pause plus a spurious "sero" for the empty minutes.
    // ⚠ THE `alas` MARKER IS REQUIRED, NOT OPTIONAL, AND IT IS THE WHOLE POINT OF THIS RULE. The corpus's
    // only other `\d{1,2}:\d{2}` matches are `ISO 20715:2023` ×2 — a standard's number, where an unguarded
    // clock rule would match `15:20` inside it. Guarding on `alas`/`ala`/`las` (the Spanish-derived hour
    // frame Hiligaynon uses; Kaufmann `Sa las ónse. At eleven.`) means this rule fixes 1 instance and breaks
    // 0, where the ceb-shaped bare-colon rule would have fixed 1 and broken 2.
    // ⚠ THE MINUTES JOIN WITH `kag`, which is how Hiligaynon builds every compound numeral — the same
    // ×2,207 conjunction the ampersand spends, so it needs no separate sourcing. On the hour they drop out.
    // ⚠ THE REGISTER IS A KNOWN, MEASURED RESIDUAL. Kaufmann's clock idiom takes the SPANISH numeral —
    // `Sa las ónse`, "at eleven" — so a Hiligaynon reader says *alas singko*, not the native *alas lima*
    // this emits. Reading it right needs a sourced Spanish 1–12 set for hil, which neither the corpus (×1
    // clock, and it writes the digit) nor Kaufmann's headword list supplies as a paradigm. One instance,
    // recorded rather than guessed; what this rule does fix is the false pause and the phantom "sero".
    s = tr(s,
        /(?<=(?:a?las)[- ])(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/giu,
        (_m, h: string, min: string) => (Number(min) === 0 ? `${Number(h)}` : `${Number(h)} kag ${Number(min)}`),
    );

    // ── 3. THE SHARED TIER — percent, ₱, units, the squared word, rates, `&` ─────────────────────────────
    // ⚠ AFTER DE-GROUPING, or `12,706 km²` is seen as `706 km²`. ⚠ BEFORE THE DECIMAL RULE — the playbook's
    // "units before decimals" coupling: the tier matches a unit only when a NUMBER is adjacent, and
    // rewriting `4.4` to `4 punto 4` destroys that adjacency. It is ALSO what keeps `NOT_VERSION` armed for
    // the one-letter `m` key (traps 39 and 46), since that guard works by seeing a dot the decimal rule
    // would otherwise have spent.
    s = SYMBOLS(s);

    // ── 4. RANGES → `hasta` — BEFORE the decimal rule ────────────────────────────────────────────────────
    // ×10 unwritten, against ×20 where the corpus writes `hasta` out between the digits itself
    // (`2016 hasta 2022`, `6,000 hasta 7,000`, `2 hasta 3`) and ×13 `tubtob` / ×7 `asta` beside it. The
    // dash was simply dropped, leaving two numbers abutting with no connective — and for a YEAR SPAN
    // (`(1910-1912)`, `1967-1972`, `c. 1303–1213 BC`) that is the commonest shape.
    // ⚠ THE OPERANDS ACCEPT A DECIMAL, WHICH IS WHY THIS RUNS ABOVE STEP 5. `3.5–3.8 bilyon ka tinúig` is a
    // real corpus range; with the decimal rule first the text reads `3 punto 5–3 punto 8` and this rule
    // would claim `5–3`, emitting *lima hasta tatlo* — a backwards span inside a number. Ordered this way
    // it yields `3.5 hasta 3.8` and step 5 then reads both operands.
    // ⚠ THE THREE GUARDS THE su/so/ceb RUNS PAID FOR, carried rather than re-earned: do not double a
    // connective the text already wrote, do not claim a HYPHEN CHAIN (an identifier, not a span), and
    // require digits on BOTH sides — which is also what keeps this rule off `ika-19`, where the hyphen has
    // a LETTER on its left.
    s = tr(s,
        /(?<!\b(?:hasta|asta|tubtob|tubtub|halin sa|halin)\s)(?<![\d.,\p{L}-])(\d[\d,]*(?:\.\d+)?)\s?[-–]\s?(\d[\d,]*(?:\.\d+)?)(?![\d,-]|\.\d)/gu,
        "$1 hasta $2",
    );

    // ── 5. DECIMALS → `punto` ───────────────────────────────────────────────────────────────────────────
    // ×1,643, every one previously a clause pause mid-number (`May 302.18 kilometro kwadrado` →
    // *…duha . napulo kag walo…*).
    // ⚠ THE WORD IS DICTIONARY-SOURCED, NOT INFERRED, and that is a real difference from the sibling.
    // Kaufmann: `púnto, (Sp. punto) Point, full stop, period; tone, tune, pitch, key, clef.` — the
    // punctuation sense, in Hiligaynon, from the standard reference for this language. (Cebuano ships the
    // same word on the weaker "a written corpus cannot say how a SYMBOL is spoken" argument; hil does not
    // have to.) The corpus's one `punto` is *pinakamataas nga punto*, the highest POINT of Negros — the same
    // sense in a different application, so it corroborates rather than contradicts.
    // ⚠ ONE OR TWO FRACTIONAL DIGITS ONLY, and the cap is measured: the corpus has 398 one-digit and 1,244
    // two-digit fractional parts and exactly ONE three-digit — which is the German-town period-THOUSANDS
    // instance from step 1. So the cap admits every real decimal and refuses the one number that is not one.
    // ⚠ The fractional part is read DIGIT BY DIGIT, which is what a decimal is.
    s = tr(s, /(\d)\.(\d{1,2})(?![\d.,])/gu, (_m, a: string, b: string) => `${a} punto ${[...b].join(" ")}`);

    // ── 6. DOTTED ABBREVIATIONS — closed list, see DOTTED_ABBREV ─────────────────────────────────────────
    s = tr(s, new RegExp(`\\b(${ABBREV_ALT})\\.`, "giu"), (m0, ab: string) => {
            // ⚠ THE MISS BRANCH IS REACHABLE (#1122): the pattern is built from this table's own
            // keys but carries `i`+`u`, so JS's fold widens it and a near-miss matches while its
            // key is absent. The `!` here made `String.replace` stringify `undefined`.
            const w = DOTTED_ABBREV[ab.toLowerCase()];
            return w === undefined ? m0 : `${w}`;
        });

    // ── 7. THE ORDINAL'S BOUND LINKER — `ika-5ng` → `ika-5 nga` ──────────────────────────────────────────
    // ×2 (`ika-5ng Gobernador`, `ika-2ng`), and this is trap 14/15: a linker glued to the DIGITS cannot
    // become a word, because at this point there is no word for it to attach to. The tokenizer reads the
    // stranded `ng` as its own token and the g2p gives it [ŋ] — a bare consonant emitted as a whole word,
    // *ʔika lima ŋ*. Detached into the language's own linker `nga` it reads *ʔika lima nga*, which is what
    // `ika-lima nga` (×2,168 spelled out) already reads as. The bare `ika-N` form needs nothing (see the
    // header): it is ×20 and already correct.
    s = tr(s, /(?<![\p{L}\p{M}])(ika-\d+)ng(?![\p{L}\p{M}])/giu, "$1 nga");

    // ── 8. `sg` → `sang` — THE CORPUS'S OWN SHORTHAND FOR THE GENITIVE PARTICLE ───────────────────────────
    // ×6, and it is this artifact's ENTIRE raw-ASCII-Latin leak: `sg` has no vowel, so it can never be a
    // Hiligaynon word, and it reached the IPA as the bare cluster the letters spell. ⚠ NO OTHER GATE IN THE
    // REPO CAN SEE THIS. `sg` is Latin letters in a Latin-script language: DIGIT hunts digits, RAWMARK hunts
    // punctuation, and a two-letter run looks exactly like a word to everything else.
    //
    // ⚠ THE EXPANSION IS NOT A GUESS AND IT IS NOT `sing`. Hiligaynon has TWO particles that could abbreviate
    // to these letters — `sang` (genitive/definite, and the past-time marker) and `sing` (indefinite) — so
    // the reading was decided by reading all six in their slots, not by picking the commoner word:
    //     `sa tunga sg tuig 1431 kag 1442`      · `Republika sg Pilipinas`
    //     `Pila ka mga paktorya sg panit`       · `ang pagtulu-ohan sg sining simbahan`
    //     `sa edad sg 25 años`                  · `ini nga barrio guin tagaan sg diretso`
    // Every one is the "of / of the" slot, which is `sang`; not one is the indefinite `sing`. And the
    // artifact writes `sang` ×324 in that same slot against `sg` ×6, including the identical collocation in
    // full — `sentro sang negosyo` beside `paktorya sg panit`. So this substitutes one of the corpus's OWN
    // commonest words, not a word brought in from outside: the strongest evidence available for a language
    // whose only referee is a 1934 dictionary and for which `attest.ts` cannot be run at all (no hil wiki of
    // any kind exists — the corpus is the Wikimedia Incubator's Wp/hil).
    //
    // ⚠ LOWER CASE ONLY, AND BOUNDED AGAINST DOT, SLASH, COLON AND HYPHEN. `SG`/`Sg` are ×0 here, and upper
    // case is where the collisions live: `zh-sg` (a MediaWiki language-conversion variant tag — it is a real
    // raw-Latin hit in ANOTHER language's artifact in this same batch, wuu's), a `.sg` domain, and an `sg:`
    // interwiki prefix. Matching the shape case-insensitively would claim all three.
    s = tr(s, /(?<![\p{L}\p{M}\p{Nd}.:/-])sg(?![\p{L}\p{M}\p{Nd}.:/-])/gu, "sang");

    return s;
}
