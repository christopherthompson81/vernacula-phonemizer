/**
 * CONCEPT SOURCING — ask what a language CALLS a thing, instead of guessing a word and probing for it.
 *
 * WHY THIS EXISTS. Every sourcing avenue the sweep had reads TEXT and asks "does this word occur?" — the FLEURS
 * corpus, the referees, espeak's dictsource, `attest.ts` against Wikipedia. That works when you already have a
 * candidate. It fails completely when you do not, and it fails WORSE than silently: the #586 Phase 1 findings
 * left five Indic languages dropping the `+` in `UTC+1`, and a substring search for plausible words returned
 *
 *   gu ધન ×167 · ml ധന ×119 · ne धन ×84 · ta மேலும் ×161
 *
 * every one of which is a different sense — gu's ધન is SAGITTARIUS ("આકાશગંગા ધન તારામંડળ"), ml's is FINANCE,
 * ne's is WEALTH, ta's means "moreover". Token-matched, all five corpora attest a plus word ZERO times. A
 * word-first search had nothing to offer but five confidently wrong answers.
 *
 * ── THE INVERSION ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Wikidata holds one ITEM per concept with labels in hundreds of languages, and Wikipedia's interlanguage
 * links give the same thing as an article TITLE. So name the concept once, in English, and let each language
 * supply its own term. Two independent expressions of it, both carrying provenance you can cite: a QID and an
 * article.
 *
 * Demonstrated on the arithmetic operations, which is where the sweep was stuck:
 *
 *          addition    subtraction   multiplication   division
 *   hi     जोड़         घटाना          गुणा             भाग
 *   ta     கூட்டல்      கழித்தல்       பெருக்கல்         வகுத்தல்
 *   kn     ಸಂಕಲನ       ವ್ಯವಕಲನ        ಗುಣಾಕಾರ          ಭಾಗಾಕಾರ
 *   yue    加           減             乘                除
 *
 * THREE INDEPENDENT ROUTES AGREED, which is why this is worth a tool. `hi`'s row is exactly what was read by
 * hand out of the अंकगणित article for #610; `ta`'s is exactly the title behind en:Plus_and_minus_signs's
 * interlanguage link; `yue`'s 加 and 乘 are exactly the words chosen for Mandarin from zh.wikipedia prose. None
 * of those three routes knew about the others.
 *
 * ⚠ A CONCEPT LABEL IS A CANDIDATE, NOT A READING, and this is the same wall `attest.ts` warns about one step
 * earlier. Wikidata gives the OPERATION's name; what a reader says BETWEEN two operands can be a different
 * word. Hindi is the worked example: `जोड़` is addition and `धन` is the plus SIGN, and only the second belongs
 * in `-5`/`+5`. `गुणा` happens to be both. So take the label as a sourced candidate and then check the sense —
 * `attest.ts` against the language's own wiki is the natural next step, and the label finally gives it
 * something to probe.
 *
 * ⚠ LABELS NEED LIGHT CLEANING. Some carry a disambiguator (`ne भाग (गणित)`) and some a nominalising affix
 * (`th การบวก`, where the bare verb `บวก` is what the article title uses). Both are printed as-is rather than
 * stripped, because deciding which part is the word is a judgement about that language.
 *
 * Usage:
 *   npx tsx tools/normalization/concept.ts --items Q32043,Q40754 --langs hi,ta,kn
 *   npx tsx tools/normalization/concept.ts --search "plus sign"        # find the QID first
 *   npx tsx tools/normalization/concept.ts --items Q32043 --langs hi,ta --titles   # also the article titles
 */
const argv = process.argv.slice(2);
const arg = (n: string): string | undefined => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? undefined : argv[i + 1];
};
const has = (n: string): boolean => argv.includes(`--${n}`);

const UA = "vernacula-phonemizer-concept-probe/0.1 (https://github.com/christopherthompson81/vernacula-phonemizer)";

async function api(host: string, params: Record<string, string>): Promise<any> {
    const u = new URL(`https://${host}/w/api.php`);
    for (const [k, v] of Object.entries({ format: "json", ...params })) u.searchParams.set(k, v);
    // A User-Agent is REQUIRED, as it is for every other probe here: without one the API returns non-JSON and
    // the failure reads as "this concept has no label in that language" — a manufactured confident negative.
    const r = await fetch(u, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${host}`);
    return r.json();
}

const search = arg("search");
if (search !== undefined) {
    const j = await api("www.wikidata.org", {
        action: "wbsearchentities", search, language: "en", limit: "8",
    });
    console.log(`\n── wikidata items for ${JSON.stringify(search)} ──\n`);
    for (const r of j?.search ?? []) {
        console.log(`  ${String(r.id).padEnd(12)} ${String(r.label ?? "").padEnd(28)} ${String(r.description ?? "").slice(0, 64)}`);
    }
    console.log(`\n  Pass the QID to --items. Prefer the OPERATION ("addition") over the SYMBOL ("plus sign"):`);
    console.log(`  the symbol items are widely filled with the bare character, which says nothing.\n`);
    process.exit(0);
}

const items = (arg("items") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const langs = (arg("langs") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (items.length === 0 || langs.length === 0) {
    console.error("usage: --items Q32043,Q40754 --langs hi,ta,kn [--titles]   |   --search \"plus sign\"");
    process.exit(2);
}

const ent = await api("www.wikidata.org", {
    action: "wbgetentities", ids: items.join("|"),
    props: "labels|sitelinks", languages: langs.join("|"),
});

/** English label for the column heading, fetched separately so the table is readable. */
const head = await api("www.wikidata.org", {
    action: "wbgetentities", ids: items.join("|"), props: "labels", languages: "en",
});

const W = 22;
const names = items.map((q) => String(head?.entities?.[q]?.labels?.en?.value ?? q));
console.log(`\n── what each language CALLS these concepts ──\n`);
console.log(`  ${"".padEnd(5)}${names.map((n) => n.slice(0, W - 1).padEnd(W)).join("")}`);
for (const l of langs) {
    let row = `  ${l.padEnd(5)}`;
    for (const q of items) {
        const label = ent?.entities?.[q]?.labels?.[l]?.value as string | undefined;
        row += (label ?? "—").padEnd(W);
    }
    console.log(row);
}

if (has("titles")) {
    // The interlanguage link is the SECOND independent expression of the same term, and it is the one that
    // comes with prose attached — hand the title to `attest.ts`, or read the article for how it glosses the
    // notation (this is how hi's धन was settled, from पूर्णांक).
    console.log(`\n── and the article title in each wiki (an independent second expression) ──\n`);
    for (const q of items) {
        console.log(`  ${q} (${String(head?.entities?.[q]?.labels?.en?.value ?? "")})`);
        for (const l of langs) {
            const t = ent?.entities?.[q]?.sitelinks?.[`${l}wiki`]?.title as string | undefined;
            console.log(`     ${l.padEnd(5)}${t ?? "— no article"}`);
        }
    }
}

console.log(`\n  ⚠ A LABEL IS A CANDIDATE, NOT A READING. Wikidata names the OPERATION; what a reader says`);
console.log(`  BETWEEN two operands can differ — Hindi's जोड़ is addition, धन is the plus SIGN, and only the`);
console.log(`  second belongs in "+5". Check the sense with attest.ts, which now has something to probe.\n`);
