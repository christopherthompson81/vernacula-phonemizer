# Yoruba and Igbo cardinal numbers — sourcing assessment before building anything

Both languages read every digit in ENGLISH: `1945` → *wˈʌn θˈaᶷzənd nˈaᶦn hˈʌndɹəd fˈɔːɹt̬i fˈaᶦv*. The engines are
fine on words (`ọkan` → ɔ˧kã˧, tones correct); neither has a `numbers.ts`, so the Latin fallback — which for
Yoruba is literally an English phonemizer passed into `createYoruba` — swallows the digits.

⚠ A dropped `%` loses information. This produces FLUENT ENGLISH inside Yoruba speech, which for TTS is worse than
silence. 46M + 31M speakers.

## Run 1 — 2026-08-05 22:00 · a fleet-wide tooling bug found while probing

The first attempt to attest Igbo numerals returned nonsense — every candidate "attested, only 0.2% whole word":

    otu    294 tokens / 129,808 substrings      ← and the header said "⚠ SPACELESS SCRIPT"

Igbo is Latin script with spaces. `corpus-words.ts` decided otherwise because of

    const spaceless = utts0.some((u) => SPACELESS.test(u));

⚠ `some` IS CATASTROPHICALLY THE WRONG QUANTIFIER. One katakana character anywhere in the corpus flips the whole
language into spaceless mode — stripping every space and switching the hit test to substring matching. Igbo tripped
it on 2,472 of 558,991 lines (0.44%), all from a Digimon article quoting デジモン.

**69 of the fleet's 154 mined artifacts contain at least one CJK/SEA character**, so 69 languages were being
measured this way. Any Wikipedia that mentions a Japanese name qualifies. Replaced with `dominantScript` from
scripts.ts, which already answers the right question and derives it from the corpus rather than a table. After the
fix Igbo reads `otu 104,534 tokens` — 355x the previous count.

## Run 2 — 2026-08-05 22:05 · is there a dictionary, as there was for Khmer? No — and that matters

`google/language-resources` has km, and also **jv and su** (54,563 / 42,901 entries, CC BY 4.0, numerals included).
It has **no yo and no ig**. Wikidata labels are thin for Yoruba (1 of 10 integers) though better for Igbo (otu,
abụọ, atọ, anọ, ise, iri). kaikki's Yoruba extract is word→IPA with no glosses. **Igbo has no referee at all** —
wikipron ibo_latn, epitran ibo-Latn and the kaikki Igbo extract are all 404, per its own referee config, which also
records that "the vigesimal numbers are deferred".

⚠ AND I HAD IGBO'S SYSTEM WRONG. I described it as "decimal and much simpler" when recommending this target. Its
own config says vigesimal; both languages are vigesimal with subtraction.

## Run 3 — 2026-08-05 22:10 · openslr.org/86 is not a lexicon, and is valuable anyway

SLR86 is a crowdsourced Yoruba speech corpus, **CC BY-SA 4.0** (ShareAlike — acceptable here; `km-lexicon.tsv`
already derives from CC-BY-SA 3.0 wikipron. NC was the blocker, not SA). No pronunciation lexicon. But
`line_index_{female,male}.tsv` are 283 KB of transcripts, and for a TONAL language that is the interesting part:

| corpus | words | carry a tone mark |
|---|---|---|
| SLR86 transcripts | 31,221 | **70.4%** |
| yo Wikipedia dump | 3,801,752 | 50.7% |

**Zero digits** in 3,583 utterances — every number is spelled out, with tone: méjì ×45, mẹ́ta ×36, mẹ́rin ×14,
mẹ́sàn ×10, mẹ́fà ×10, Ọ̀kan ×8, méje ×8, márùn ×8. Yoruba tone is phonemic, so a numeral mined from the
half-untoned Wikipedia would phonemize wrongly; this settles the orthography for the frequent forms.

It is too small for the higher numerals (ogún ×10, ogójì ×2, ọgọ́ta ×1). Those come from the dump, where the
tone-marked forms ARE attested in quantity: ọgbọ̀n 467, ọgọ́rùn 629, ẹgbẹ̀rún 574, àádọ́ta 285, ogún 949, ogójì 144.
The two sources are complementary — SLR86 for tone on the common forms, the dump for the composition machinery.

## Where this leaves the work

Attested and usable:
  · Igbo units and tens — otu 104,534 · abụọ 57,990 · iri 44,831 · atọ 26,470 · narị 11,804 · ọgụ 5,445 tokens
  · Yoruba counting forms with tone (SLR86) and the tens/particles from the dump (dín "minus", lé "plus", the
    ọgọ́- multiples of 20, the àádọ́- subtractive halves, the -lá series for 11-14)

⚠ Honest limits before committing to a compositor:
  1. **Igbo has no referee.** Nothing independent can validate a composed numeral; the only anchor is the
     adjudicated gold in `test/igbo.test.ts` (Emenanjo 1978; Green & Igwe 1963).
  2. **The composition RULES are not attested the way the words are.** The corpus shows that dín and lé exist; it
     does not state which ranges take which. Deriving a 0–999,999 system from 1–12 token attestations of the
     higher forms would be inference dressed as evidence.
  3. Both systems are vigesimal with subtraction, so a partial table is not safely extensible.

The defensible shape is therefore: compose over the range the evidence supports, fall back to DIGIT-BY-DIGIT in the
native units beyond it (an established pattern here — chichewa's compositor does exactly that above 10⁶), and never
emit English again. That converts a confidently-wrong-language reading into a correct-language, unidiomatic one,
which is a strictly better failure and is fully sourceable today.

## Run 4 — 2026-08-05 22:10 · the dump WAS extensive enough, and I was too pessimistic

Run 3 concluded the composition rules "are not attested the way the words are" and proposed a bounded partial
compositor. Challenged on it — the dump is extensive — and testing rather than arguing showed the challenge was
right. The rules ARE attested, as phrases:

| Igbo pattern | reading | hits |
|---|---|---|
| `iri abụọ` | 20 (ten·two) | 7,814 |
| `iri atọ` … `iri itoolu` | 30 … 90 | 3,094 … 774 — the ENTIRE series |
| `iri na abụọ` | 12 (ten and two) | 2,613 |
| `iri na otu` | 11 | 2,056 |
| `puku abụọ` / `narị abụọ` | 2,000 / 200 | 1,099 / 492 |
| `otu narị` / `otu puku` / `otu nde` | 100 / 1,000 / 10⁶ | 1,347 / 1,256 / 479 |
| `nde` / `ijeri` | 10⁶ / 10⁹ | 6,983 whole-word / 1,709 |

⚠ **MAGNITUDE FIRST, and it had to be counted rather than assumed.** One corpus phrase — `otu nde`, "one million" —
looks multiplier-first and would have inverted the whole table. Counting both orders in every magnitude settles it:

    iri abụọ 7,814 : abụọ iri 82      narị abụọ 492 : abụọ narị 10
    puku abụọ 1,099 : abụọ puku 4     nde abụọ 77 : abụọ nde 7     ijeri abụọ 8 : abụọ ijeri 0

11:1 to 275:1. `otu nde` is the irregular MULTIPLIER-1 form, which is why `one` is stored apart from the series.

**And the corpus writes large numbers out in full**, which is how the structure was verified instead of inferred:

    "otu nde, puku narị anọ na otu, narị asatọ na iri asaa na atọ"   = 1,401,873
     1×10⁶       1000×401              800 + 70 + 3

The compositor reproduces that exactly, except that it joins magnitude groups with `na` where the corpus writes a
comma — a comma is not spoken.

⚠ **AND MY "IGBO IS VIGESIMAL, DEFERRED" FRAMING WAS MISLEADING.** The referee config's deferral is about the
TRADITIONAL vigesimal system, and `ọgụ` (a score) is genuinely current at 5,859 whole-word hits. But the decimal
`iri abụọ` outnumbers it 7,814 to 5,859 and is what composes regularly to arbitrary size. Both are Igbo; the
decimal one is what running text uses and what a compositor can be built on. Quoting the deferral as though it
blocked the work was wrong.

**Shipped:** `igbo/numbers.ts` + the manifest table, wired so digits can never reach the `foreign` (English)
fallback again, with digit-by-digit in Igbo units above 10¹² as the floor. `1945` now reads
*otu puku na naɾɪ itoolu na iɾi anɔ na ise*.

**Still open for Igbo:** `1,500` reads *otu , naɾɪ ise* — the grouping comma is not de-grouped, because Igbo has no
`normalize.ts` either. That is the normalization layer's job and is the natural next step; the compositor cannot
fix it, since it never sees the two halves as one number.

**Yoruba remains.** Its machinery is attested but unevenly — `lé` (additive) 598/756, `dín` (subtractive) 80/42,
`méjìlá` 258, `ọ̀kànlá` 3, `ẹ́ẹ́dógún` 0 — so the same phrase-counting method needs to run per form before a
compositor can claim the same footing. SLR86 supplies the tone-marked orthography for units 1-10.
