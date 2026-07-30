# Sepedi / Northern Sotho (nso) native bring-up

Sepedi / Northern Sotho (nso) — Bantu (Sotho-Tswana, S32); ~5M, official in South Africa. Latin, open CV. Sibling
of the done Setswana (tn) + Sesotho (st).

## Gate — NO referee at all → ⛔ cannot-verify

Sepedi has **no machine referee of any kind**: no wikipron, no kaikki page, no epitran map (worse than Sesotho's 3
kaikki words). Per the user's decision it is authored beyond-referee from standard Sepedi phonology (Ziervogel &
Mokgokong) as a **⛔ cannot-verify** module — a couple of hand examples of the distinctive graphemes, not a verified
gold.

## The analysis

Reuses the shared Sotho-Tswana greedy engine. Sepedi's profile: prominent ⟨š⟩→[ʃ] / ⟨tš⟩→[t͡ʃʼ], ⟨g⟩→[x] /
⟨kg⟩→[kx], the voiceless lateral ⟨hl⟩→[ɬ] and lateral affricate ⟨tl⟩→[t͡ɬʼ], ⟨ny/ng⟩→[ɲ/ŋ]. The plain voiceless
stops are taken as **EJECTIVE** ⟨p t k⟩→[pʼ tʼ kʼ] — the Sotho-Tswana pattern (attested for the sister Sesotho, but
**UNVERIFIED for Sepedi**). No clicks. Vowel height (7-vowel /i e ɛ a ɔ o u/) is unwritten → mid defaults [ɛ ɔ].

## Verdict: ⛔ cannot-verify

No independent referee exists to check any of it; the analysis rests on the grammar + the close Sesotho/Setswana
sisters. The distinctive-grapheme values (š, kg, hl, ejectives) are the confident part; the ejective analysis and
vowel heights are the unverified tail. Gold: `test/sepedi.test.ts` (hand examples). Tone deferred. Re-grade if a
Sepedi pronunciation corpus/wikipron appears.

## Run — cardinal number compositor — 2026-07-29

Question: same digit leak as st. Sepedi is close to Sesotho — is the st compositor reusable?

**Answer: NO, and this was worth checking rather than assuming.** Verified against Northern Sotho sources only:
the stems differ (nso tee / tshela / šupa / seswai / senyane / lesome vs st nngwe / tshelela / supa / robedi /
robong / leshome — five of ten units and the word for "ten"), and the MORPHOLOGY differs — Northern Sotho writes
11–99 and 200–900 CONJUNCTIVELY as one word with the bare stem glued on (lesometee, masomepedi, makgolopedi),
where Sesotho is fully disjunctive with the motso/metso dummy noun and cl.4/cl.6 concord. Nothing was copied.

**Decision: the CITATION / COUNTING series** — the UNISA Northern Sotho course's Video 3 has a speaker recite it
verbatim ("Tee, pedi, tharo, nne, hlano, tšhela, tšhupa, seswai, senyane, lesome, diranta tše lekgolo, diranta tše
makgolopedi"), which is precisely the "reading a figure aloud" register a TTS needs.

Sources: UNISA free online Northern Sotho course, Theme 3 Track 7 + Video 3 (the counting list, the hundreds
series makgolopedi…makgolosenyane, sekete, the cl.8 particle tše); Omniglot "Numbers in Northern Sotho"
(lesometee…lesomesenyane, masomepedi…masomesenyane, the tens+unit compounds); Wiktionary Category:Northern Sotho
numerals corroborates the stem set. Zero = lefeela (DBE 2019 Northern Sotho Wordlist).

Raw findings / judgement calls:
- The UNISA doc is internally inconsistent: its table gives "Tshela / Šupa" while its dialogue gives "tšhela /
  tšhupa". Went with the table forms (they match Omniglot's masometshela / masomešupa and Wiktionary).
- Omniglot writes the tens+unit compounds with a HYPHEN (masomepedi-tee). Emitted as a SPACE: the engine's word
  tokenizer treats a hyphen as a break, so keeping it would either drop a real TTS word boundary or glue two
  numerals into one phonemic word. Documented in the jsonc.
- Omniglot's "thlano"/"seswae" variants normalised to the standard "hlano"/"seswai".
- The per-magnitude-concord trap does NOT bite here: the conjunctive compound glues the BARE stem in all three
  slots (lesome+, masome+, makgolo+ — all attested). Concord only reappears on the disjunctive cl.8 magnitudes
  (dikete/dimilione/dibilione + tše), which is its own table.

Implementation: Pattern B — `src/languages/sepedi/numbers.ts` + a `numbers` block in sepedi.jsonc. Probe CLEAN.
Tests added to test/sepedi.test.ts (including explicit "differs from st" assertions).

**Source-hunt dead ends (kept per the negative-results rule):** languagesandnumbers.com repeatedly
`socket hang up` (never retrievable this session); salanguages.com + sesotho.web.za `ECONNREFUSED`; Quizlet 403;
the Peace Corps *Sepedi* PDF 403. WebFetch's summariser also silently truncated the Omniglot tables on the first
pass — asking for an explicit "N = form" list per numeral was what finally got verbatim rows out of it.
