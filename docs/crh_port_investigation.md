# Crimean Tatar (crh) — C# port investigation

Chronological log of the runs behind the crh port.

## Run 1 — 2026-08-30 ~05:10 — scope, and the two hazards audited first

    wc -l src/languages/crimeantatar/*.ts data/languages/crimeantatar/crimeantatar.jsonc
        102 crimeantatar.ts · 200 normalize.ts · 58 numbers.ts · 31 crimeantatar.jsonc

A compact port. The alphabet is Turkish-based Latin and highly phonemic — no digraphs, since ⟨ç ş ñ ğ⟩ are
single letters — so the g2p is a left-to-right grapheme scan with three rules on top: the ⟨v⟩→[w]
post-vocalic coda, gemination, and word-final (oxytone) stress. `Registry.cs` already routed
`case "crh": return Create("crimeantatar")`, and `csharp/goldens/crh.tsv` exists.

⚠ **TWO HAZARDS, BOTH SILENT, AUDITED BEFORE A LINE WAS WRITTEN:**

**1. The Turkish-style dotless-I casing.** The TS does this before the generic lowercase:

    word.normalize("NFC").replace(/İ/gu, "i").replace(/I/gu, "ı")

and the reason is the whole point of the rule: a plain `toLowerCase()` maps capital ⟨I⟩ to *dotted* ⟨i⟩=[i]
when Crimean Tatar wants *dotless* ⟨ı⟩=[ɯ] — the wrong vowel, in well-formed output, for every capitalised
back-vowel word (`Qırım`, `QIRIM`). So the whole path — NFC, the two replaces, then the lowercase — was
swept against node over the alphabet in **both cases**:

    THE CASING PATH MATCHES JS ON ALL 64 ALPHABET LETTERS (both cases)

**2. The degree rule's `[CСcс]` class**, which mixes the Latin and Cyrillic ⟨C⟩ in both cases — they render
identically, and a class carrying only one leaves the other to be read as a bare letter. Checked by
codepoint (C U+0043 · С U+0421 · c U+0063 · с U+0441) and spelled as `\u` escapes in the C# so the pair is
legible at the call site.

## Run 2 — 2026-08-30 ~05:35 — build + parity: 200/200 on the first run

    dotnet build csharp/Vernacula.Phonemizer          clean
    dotnet run --project csharp/tools/parity -- crh   crh  OK  200 rows

## Run 3 — 2026-08-30 ~05:45 — mechanical comparison

    regexes   TS 29 / C# 27, matched 24

The three that did not match textually are the same two substitutions: the C# hoists `[CСcс]` into a
`SCALE_C` const (verified equal by codepoint above) and names the coordinate tuple's fields differently in
the interpolation. No pattern differs.

Then the tables:

    UNITS (0–9)                        MATCH
    TENS (keyed by the ROUND value)    MATCH
    HUNDRED · THOUSAND · MILLION · BILLION   MATCH
    COORDS (ORDER MATTERS)             MATCH

## Run 4 — 2026-08-30 ~05:55 — the tests, pinned to the reference

`CrimeanTatarTests.cs` is the portable half of `test/crimeantatar.test.ts` — 42 cases: the dotless-I
casing in both directions, the vowel inventory and the q/k and ğ/g contrasts, the ⟨v⟩ rule in all three
positions (coda, intervocalic, onset), gemination, all three range dashes against the minus rule, the
three de-grouping conventions, the decimal that is spent rather than spoken, the percent and degree
suffixes, the Cyrillic ⟨С⟩, the era marker and the four compass coordinates.

    dotnet test --filter "FullyQualifiedName~CrimeanTatar"   42/42 on the first run
    all 40 hard-coded expectations re-run against the TypeScript engine directly:
        ALL TEST EXPECTATIONS AGREE WITH THE TS ENGINE

## Run 5 — 2026-08-30 ~06:05 — the differentials

Both references built the way `gen_parity_goldens.mts` builds one — one process, `clearForeignOov()` once,
rows in order, async (the `bpy` lesson) — with foreign Latin runs in the haystack (the `ba` one).

The generated set walks the axes this language is defined by: the **casing path** (every word emitted
lowercase, UPPERCASE, capitalised and alternating, so the dotless-I rule is exercised from all four), the
⟨v⟩ rule built explicitly in its three positions, generated geminates, the four separator conventions, both
scale letters in both cases, the percent and degree case suffixes, the coordinate abbreviations with and
without their following noun, and the numeral boundaries.

    mined corpus  tools/corpus/mined/crh.jsonc → 390 texts     0 differ, 0 throws
    generated     10,000 rows                                  0 differ, 0 throws

## Run 6 — 2026-08-30 ~06:15 — the full gates

    dotnet test (full suite)     3,385 pass, 0 fail  (42 Crimean Tatar + 1 manifest mapping)
    parity, fleet                148 languages byte-identical, 29,105 rows, 0 differ, 0 BLOCKED
    provenance crh               3,524/3,524 tokens mapped (100%)
    ipaspans crh                 0 spans wrong
    poison crh                   0 sites
    typescript                   unchanged

## Read for correctness — filed, not fixed

- **The manifest's vowel set is named `CYR_VOWEL` in the TS**, a name inherited from the sibling Turkic
  engines — Crimean Tatar is written in Latin and always has been. The C# calls it `VOWEL` and says why in
  a comment, rather than carrying a name that describes the wrong script.
- **`numberToWords` returns an ARRAY**, not a joined string, because the engine phonemizes each word
  separately. Ported as `List<string>`; the shape is load-bearing.
- **The `⟨v⟩` rule reads its neighbours from the LETTER string, not the phoneme string** — `chars[i-1]` and
  `chars[i+1]` are orthographic. That matters because ⟨â⟩ is a vowel letter mapping to [a], so the coda
  test sees the spelling the writer typed rather than the phone the scan produced. Mirrored exactly.
