# Tashelhit / Shilha (shi) native bring-up — investigation

Taclḥit, a Berber (Amazigh) language of SW Morocco (the Souss), ~7–9M — one of the largest Berber varieties.

## Run 1 — feasibility + scope

- **Scope gate (Berber's multi-script problem):** Berber has three scripts (Tifinagh, Latin, Arabic). Unlike
  Chittagonian (rejected — no community standard), Berber clears the gate: **Tifinagh is constitutionally official in
  Morocco (IRCAM-standardised)** and the **Berber Latin alphabet** is the academic/community standard. Target = the
  **Latin** orthography (what the referee uses).
- **Referees:** wikipron `shi_latn_broad` (500, segment-tokenized, human) + kaikki `Tashelhit` (724 w/ IPA, 601
  Latin). BUT **both are Wiktionary-derived** (wikipron scrapes Wiktionary; kaikki *is* Wiktionary) → CORRELATED
  single-source-family, not an independent triangulation → **🔷** (two files, one source). No epitran shi.
- **Orthography is near-1:1 phonemic** → a greedy grapheme scan suffices, like Maltese/Māori.

## Run 2 — build + result

Derived the grapheme map by aligning the merged ~670 headwords (RPA char ↔ IPA segment; the wikipron IPA is already
segment-tokenized). Map: a i u, e→ə; b c→ʃ d f g→ɡ h j→ʒ k l m n q r s t w x→χ y→j z; ɣ, ġ→ɣ, š→ʃ, ɛ→ʕ; **emphatics
(pharyngealised, dot-below)** ḍ→dˤ ṭ→tˤ ṣ→sˤ ẓ→zˤ ṛ→rˤ, ḥ→ħ. Two code rules: **labialisation** (C + ⟨ʷ⟩ → Cʷ) and
**gemination** (a doubled consonant → a long [Cː], phonemic in Berber).

First pass 92.8% folded / 97.7% symbol (wikipron). Two fixes off the residual:
- **geminate-emphatic notation:** we emit a long emphatic [Cˤː] (length backbone-stripped → Cˤ) but the referee
  writes it as two segments [CˤCˤ]; a fold `(.)ˤ\1ˤ→$1ˤ` collapses the referee's doubled emphatic to match.
- **labialised gemination:** ⟨ggʷ⟩/⟨kkʷ⟩ = a *geminated labialised* consonant [ɡʷː]/[kʷː], not ɡ+ɡʷ — the gemination
  now compares the BASE consonant (ignoring ʷ/ː) so the two collapse, carrying the labial + length onto one segment.

**Result: 97.4% folded / 99.4% symbol** (wikipron) · **97.8% / 99.5%** (kaikki). The ~2.6% residual is the **lexical
emphatic-spreading tail** — the Latin orthography sometimes doesn't mark a final emphatic [rˤ] the referee has
(akuray→akuraj vs akurˤaj); unpredictable from spelling. **🔷 single-source-family** (both Wiktionary; the Berber-Latin
orthography is deterministic so the converter generalises past the ~600 referee words). **Deferred:** the Tifinagh +
Arabic-script front-ends (the same phonology, different input scripts), lexical emphatic spreading.

## Run 3 — review fix

Review confirmed the engine + honesty framing solid (97.4/97.8 reproduced, 🔷 single-source-family disclosed
everywhere) and caught one real bug — **the recurring `text()`-tokenizer NFC bug** (3rd time this session, after
foochow's precomposed ṳ and hmong's precomposed vowels): the tokenizer ran on RAW input while NFC-normalisation
happened later inside `phonemize()`, so **NFD input** (combining dot-below U+0323) shattered the word and dropped
every emphatic — `text("aḍaṛ")` NFD → `"ad ar"` instead of `"adˤarˤ"`. Invisible to the eval + unit tests because
`phonemizeWord` NFC-normalises first. **Fix:** NFC-normalise the input at the top of `text()` + allow combining
marks (U+0300–036F) in the tokenizer class defensively; added an NFD regression test. **Systemic lesson:** any
converter whose `text()` tokenizer uses a literal grapheme class MUST normalise the input before tokenizing —
`phonemizeWord`/the eval hide the bug by normalising internally.
