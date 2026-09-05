# Luganda (lg) native bring-up

Luganda / Oluganda (lg) — Bantu, Great Lakes (JE15); the principal language of Uganda and the most widely spoken
Ugandan language (~11M incl. L2). Latin orthography. This is a fresh bring-up.

**Scope gate — PASSES, but with a WEAK referee.** Standardized Latin orthography + epitran lug-Latn. But: **no
kaikki, no wikipron** Luganda — epitran is the ONLY machine referee, and it is itself RULE-based, so an
epitran-vs-ours comparison is **partly circular** (both g2p the same orthography — the uz precedent). To keep the
bring-up honest, the phonology is grounded INDEPENDENTLY in the **Wikipedia (Luganda)** phonology, and one
deliberate convention divergence from epitran is made (⟨c j⟩ = palatal stops, below).

## Run 1 — the g2p, 99.1% folded (circular)

**Referee.** epitran lug-Latn run on a **1500-word Leipzig wordlist** (`lug_wikipedia_2021_10K`, CC-BY;
lowercase, proper-noun-filtered). epitran output: prenasalised superscripts (nga→ᵑɡa), labialisation (bwe→bʷe),
r→ɾ, y→j.

**g2p** (Chichewa greedy pattern + two code rules), phonology from Wikipedia + the epitran map:
- **5 vowels a e i o u; DOUBLING = LENGTH** (aa→aː …). Length is phonemic (bana 'four' vs baana 'children').
- **PRENASALISATION** (code): ⟨n m⟩ + an obstruent → a place-assimilated superscript nasal (ᵐ/ⁿ/ᵑ), and the
  obstruent is then scanned normally so its **labialisation survives** — ndw → ⁿdʷ (the initial digraph-table
  approach lost this: it grabbed ⟨nd⟩ before the ⟨w⟩). ⟨ng'⟩→ŋ (matched *before* the prenasal rule, so it is the
  velar nasal, not ᵑ+g); ⟨n'⟩→ⁿ (syllabic nasal prefix); ⟨ny⟩→ɲ, ⟨nny⟩→ɲː.
- **VOWEL LENGTHENING before a prenasalised consonant** (code post-step): Buganda→buɡaːⁿda, omuntu→omuːⁿtu (real,
  per Wikipedia; epitran does it too).
- **CONSONANT GEMINATION** (code): a doubled consonant → [Cː] (bbiri→bːiɾi, kitto→kitːo).
- **LABIALISATION** ⟨Cw⟩→Cʷ; ⟨l⟩=l, ⟨r⟩=ɾ (the l/r allophony is already written in the orthography).
- **DELIBERATE DIVERGENCE from epitran:** ⟨c⟩=c, ⟨j⟩=ɟ — the palatal STOPS (Wikipedia; [tʃ]/[dʒ] are allophones
  before front vowels), consistent with our Wolof convention. epitran emits tʃ/dʒ, so the eval folds c~tʃ, ɟ~dʒ.

**Result.** `npx tsx tools/referee-eval/eval.ts lg` → **99.1% folded (1486/1500)**, raw 89.6%. Folds: tie-bar,
c~tʃ, ɟ~dʒ. **This number is inflated by the circular referee** — it largely confirms we implement the same
orthography rules as epitran (plus our deliberate c/ɟ choice), not an independent correctness check.

**The 14-word residual is entirely English/tech LOANWORDS**, not native Luganda: epitran glides a high vowel to a
glide before another vowel (tekinologia→tekinoloɡja, motion→motjon) and devoices final obstruents in loans
(and→ant). Native Luganda is essentially at ceiling vs epitran.

## Verdict: 🔷 single-source + partly-circular

The g2p is a faithful, Wikipedia-grounded implementation of the Luganda orthography. But the ONLY referee (epitran)
is rule-based, so the 99.1% is a **fidelity** measure, not an independent correctness one — this is the weakest
verification of the recent bring-ups (weaker than Wolof/Bambara, which had human kaikki referees). Deferred:
- **TONE** (3-way H/L/falling) — lexical + unwritten (Wikipedia: "stress and tones are not represented in the
  spelling"), Meeussen's rule etc. No toned lexicon → deferred, the standard Bantu situation.
- **NUMBERS** — deferred (digits pass through).

Gold: `test/luganda.test.ts`. Floor `lg: 0.97`.

## Run 1b — fieldwork cross-check (Leiden phonology sketch)

The user supplied a second reference — a **Luganda phonology sketch** (Leiden University fieldwork course, based on
elicitation with a native Kampala speaker). It CONFIRMS the g2p's core decisions and, importantly, offsets the
circular-epitran weakness by grounding the key choices in a second *independent human* source:

- **⟨c⟩=/c/, ⟨j⟩=/ɟ/ palatal PLOSIVES — doubly confirmed.** §2.2.3–2.2.4 explicitly argue for plosives over
  affricates (the language has no /ʃ ʒ/; the phonemic palatal nasal /ɲ/ makes the palate an active place). So our
  deliberate divergence from epitran's tʃ/dʒ now rests on Wikipedia + this fieldwork sketch, not one source.
- **Prenasalisation + pre-prenasal vowel lengthening** (eembuto→ɛːmbuto, musamvu→musaːmvu, buganda→bugaːnda;
  §1.3, §2.5), **gemination** → [Cː] (omubbi→omubːi; §1.8), **labialisation** ⟨Cw⟩→Cʷ (§1.7), **⟨ng'⟩→ŋ** distinct
  from ⟨ng⟩→ᵑɡ (the speaker insists ŋŋamba, not *nggamba; §2.4.4), **⟨ny⟩→ɲ**, and the **l~r** allophony (written
  in the orthography; §2.7.1) — all as we render them.

**Documented deferrals the sketch reveals** (all allophonic / morphophonemic, and epitran does none of them, so no
eval impact — noted for canonical completeness):
- **/b/→[β] intervocalic spirantisation** (kabaka→kaβaka, okubá→okuβá — the speaker's "it sounds like Spanish");
  blocked by gemination and after a nasal. Prominent and characteristic, but predictable/allophonic → we emit [b]
  (matching epitran).
- **Word-initial vowel lengthening** (V→VV on noun-class prefixes: omuntu→[oː.mu.ⁿtu]) — morphophonemic.
- **Palatalisation glide** (prefix /i/ → [j] before a vowel: ebi-oya→ebjoːja) — epitran's i→j rule, which we skip;
  loanword-dominant in the residual.

**One convention note:** the sketch's Kampala speaker realises the mid vowels as **open-mid [ɛ ɔ]** (⟨e⟩=/ɛ/,
⟨o⟩=/ɔ/); we emit **close-mid e/o**, matching epitran and the standard Luganda literature (Cole, Hyman). In a
5-vowel system with no e/ɛ (or o/ɔ) contrast this is a free transcription choice — not a defect.

**Net:** no code change. The bring-up is validated by an independent human source, and the pivotal c/ɟ decision is
now well-grounded despite the circular machine referee. The verdict is unchanged (🔷 single-source for the *eval*),
but confidence in the g2p is materially higher.

## Run — cardinal number compositor — 2026-07-29

Question: same digit leak. Luganda 1–5 are adjectival with class concord (bbiri ~ abiri ~ bibiri ~ bubiri) — which
series does a bare integer take?

**Decision: the CITATION / COUNTING series** (emu, bbiri, ssatu, nnya, ttaano), i.e. the class-III/VII shape that
the descriptive sources call "the form used when counting". 6–9 (mukaaga, musanvu, munaana, mwenda) are NOUNS and
never inflect.

Sources: Wikivoyage "Luganda phrasebook" §Numbers (1–20, amakumi abiri/asatu/ana/ataano, the single-word tens
nkaaga 60 / nsanvu 70 / kinaana 80 / kyenda 90, kikumi 100, bikumi bibiri 200, lukumi 1 000, nkumi bbiri 2 000,
kakadde kamu 10⁶, akawumbi kamu 10⁹) cross-checked against eggsforeducation.wordpress.com "How to count in
Luganda" and Omniglot.

Raw findings that shaped the code:
- TWO connectives, both attested and NOT interchangeable: `na`/`n'` inside the teens (kkumi n'emu, kkumi na
  bbiri) but `mu` between magnitude components (amakumi abiri mu emu 21; **kikumi mu amakumi abiri mu bbiri** 122;
  **bikumi bibiri mu amakumi abiri mu bbiri** 222 — those last two are verbatim attestations and the composer
  reproduces them exactly).
- 60–90 are SINGLE NOUNS, not `amakumi` multiples. Getting this wrong is the obvious failure mode here.
- Three separate multiplier series are required: cl.6 a- after amakumi, cl.8 bi- after bikumi, cl.14 bu- after
  obukadde/obuwumbi. Kept as three tables.
- Only the ×1 forms of million/billion are attested; the obukadde/obuwumbi + bu- plurals are extrapolated (flagged).
- Luganda's higher unit `omutwalo` (10 000) is deliberately NOT modelled — 10 000 renders as the ordinary decimal
  "nkumi kkumi". Noted in the jsonc.

Implementation: Pattern B — `src/languages/luganda/numbers.ts` + a `numbers` block in luganda.jsonc. Probe CLEAN.
Tests added to test/luganda.test.ts (incl. 60 = nkaaga and the two attested hundreds compounds).

**Source-hunt dead ends (kept per the negative-results rule):** languagesandnumbers.com repeatedly
`socket hang up` (never retrievable this session); salanguages.com + sesotho.web.za `ECONNREFUSED`; Quizlet 403;
the Peace Corps *Sepedi* PDF 403. WebFetch's summariser also silently truncated the Omniglot tables on the first
pass — asking for an explicit "N = form" list per numeral was what finally got verbatim rows out of it.

## Run 5 — 2026-08-28 — ⟨ŋ⟩: the fold, not the drop (#1131, PR #1134)

**Question.** #1131 claims the `NATIVE_CLASS` comment ("the g2p has no rule for it, and drops it outright") is
true of `phonemizeWord` and false of `text()`. Does it reproduce, and what does the shipped path actually say?

Command: `npx tsx -e 'phonemizeWord(w) / phonemize(w,"lg")'` over a ⟨ŋ⟩ word list.

```
ŋŋamba       phonemizeWord aːᵐba     phonemize nːaːᵐba
ng'amba      phonemizeWord ŋaːᵐba    phonemize ŋaːᵐba
ziseŋŋendo   phonemizeWord ziseeːⁿdo phonemize zisenːeːⁿdo
```

Reproduces exactly. The letter is not dropped on the shipped path, it is REPLACED — `makeNativiser` →
`core/hostWord.ts` `UNDECOMPOSABLE` maps ŋ → n — so one phoneme got two readings depending on whether the writer
spelled it ⟨ŋ⟩ or ⟨ng'⟩. **Implication:** the fix is a grapheme row PLUS the class, not either alone; the row
without the class is dead code, because the fold runs first.

**Corpus counts (the reason no golden can see this).** `csharp/goldens/lg.tsv` column 1 carries ZERO literal ⟨ŋ⟩
(the ŋ present in column 2 is IPA output from ⟨ng'⟩). `tools/corpus/mined/lg.jsonc` carries 4; FLEURS lg_ug 2.
So the regenerated golden moved **0 rows** — confirmed by rerunning `gen_parity_goldens.mts lg` — and the pinned
test is the entire instrument. Measured before/after on a `main` worktree rather than inferred:

| word | before | after |
|---|---|---|
| `eŋŋanda` | `enːaːⁿda` | `eŋːaːⁿda` |
| `enkuŋŋaana` | `eːᵑkunːaːna` | `eːᵑkuŋːaːna` |
| `nkuŋŋaana` | `ᵑkunːaːna` | `ᵑkuŋːaːna` |
| `okukuŋŋaanya` | `okukunːaːɲa` | `okukuŋːaːɲa` |
| `ziseŋŋendo` | `zisenːeːⁿdo` | `ziseŋːeːⁿdo` |

All four mined words are real velar-nasal vocabulary that was reading alveolar.

### The regression the fix itself introduced — caught in review, not by any gate

Giving ⟨ŋ⟩ a grapheme row **took away** a reading it used to get for free. While the letter was folded to ⟨n⟩ it
reached the prenasalisation rule, so ⟨ŋk⟩ read `ᵑk`. With a row of its own it stopped triggering that rule:

```
ŋka  ŋka   vs  nka  ᵑka        <- after the row, BEFORE the trigger fix
ŋga  ŋɡa   vs  nga  ᵑɡa
```

That is the *same* one-phoneme-two-readings defect #1131 is about, displaced to the pre-obstruent slot — and
invisible to every instrument here, because the mined corpus carries only ⟨ŋŋ⟩ and no ⟨ŋ⟩+obstruent. **Negative
result worth keeping: a fix that adds an orthographic row must ask what the fold was silently doing for that
letter beforehand.** Resolved by adding ⟨ŋ⟩ to the prenasalisation trigger — conservation of the shipped reading,
not a new linguistic claim. ⟨ŋ⟩ is deliberately NOT added to `prenasalisable`, so ⟨ŋŋ⟩ still falls to gemination.

### Fleet-wide: how general is the under-claim?

`native-inventory.test.ts` measures only the OVER-claim (a listed letter the g2p drops). The under-claim — a
letter the g2p HAS a rule for, sitting outside the class, folded before it arrives — is silent, because a folded
letter still makes sound. Measured across every engine declaring a `NATIVE_CLASS`:

- naive "language mentions the character anywhere": **295** — useless, dominated by the character appearing as an
  IPA *output* value.
- restricted to characters used as *input keys* (jsonc object keys, `c === "x"` comparisons): **29**, in 18
  languages.
- probing 15 of those for the symptom: all 15 fold. **But folding is CORRECT for most** — ⟨ɛ⟩ genuinely is not
  Welsh orthography, and `mto`'s ð turned out to be the *output* of a lenition rule (`ada` → `aða`).

So the probe cannot self-adjudicate: separating "wrongly folded" from "correctly folded" needs per-language
judgement about whether the key is orthographic input or an IPA-side table key. **Confirmed genuine: `ak`.**
`src/languages/akan/akan.ts:114` has `if (c === "ŋ") { out.push("ŋ"); … }` with a comment saying the literal ⟨ŋ⟩
is a deliberate kaikki-sourced passthrough, while `akan.ts:193` `NATIVE_CLASS = "[A-Za-zɛɔƐƆ̃]"` excludes it —
so `phonemize("ŋa","ak")` → `na`, byte-identical to `phonemize("na","ak")`, and that rule is dead on the shipped
path. Filed separately; `ak` IS ported to C# with a golden, so it needs the full TS→golden→C# cycle rather than a
ride-along on this PR.
