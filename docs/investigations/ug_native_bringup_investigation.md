# Uyghur (ug) native bring-up

Uyghur / ئۇيغۇرچە (ug) — Turkic, Karluk branch; ~11M speakers, mainly Xinjiang (also Kazakhstan, etc.). Written in
the **Uyghur Arabic alphabet** (Ereb Yéziqi), and also Latin/Cyrillic. This is a fresh bring-up targeting the
Arabic script.

**The key fact:** unlike the Arabic / Persian / Urdu **abjads**, the Uyghur Arabic script is a **full phonemic
alphabet** — it writes ALL EIGHT vowels (with alef-hamza carriers word-initially, bare vowel letters medially). So
there is **no short-vowel restoration** (the wall that makes the abjads hard) — a plain greedy letter→IPA scan
suffices.

**Scope gate — passes strongly.** THREE referees available: **wikipron uig_arab_broad** (PRIMARY, HUMAN, 2673),
epitran uig-Arab (INDEPENDENT), and a 35 MB kaikki Uyghur. Well-resourced.

## Run 1 — the g2p, 98.2% folded

**g2p** (a greedy letter→IPA scan + one code rule), read off wikipron + the epitran map:
- **8 vowels**: ا→ɑ (BACK a), ە→ɛ (front), ې→e, ى→i, و→o, ۆ→ø, ۇ→u, ۈ→y. Vowel harmony (front/back) is WRITTEN in
  the spelling, so no harmony rule is needed. (Note ا→ɑ, not epitran's imprecise "a".)
- **The hamza ئ → ʔ**: word-initial and hiatus vowels are carried by ئ, which is a glottal onset (ئائىت → ʔɑʔit).
- Consonants ⟨چ ج⟩→t͡ʃ d͡ʒ, ⟨غ⟩→ʁ (uvular), ⟨خ⟩→χ, ⟨ق⟩→q, ⟨ڭ⟩→ŋ, ⟨ژ⟩→ʒ, ⟨ھ⟩→h, ⟨ۋ⟩→w (vs و→o vowel).
- **⟨ف⟩ → [p]**: Uyghur natively lacks /f/, so ⟨ف⟩ in loanwords is nativised to [p] (atmosfera → atmospera) — the
  referee marks this. (First pass mapped ف→f and lost ~40 loanwords; fixing to [p] lifted 92.7 → 97.5%.)
- **Word-final STOP DEVOICING** (code): a final voiced stop ⟨ب د گ⟩ → p/t/k (kitab → kitap), but the
  fricatives/affricates do NOT devoice — final z/ʒ/ʁ/d͡ʒ stay voiced (ئاز→ʔɑz, ئاغ→ʔɑʁ). (First pass devoiced all
  obstruents and wrongly turned final z→s; restricting to the stops lifted 97.5 → 98.2%.)

**Result.** `npx tsx tools/referee-eval/eval.ts ug` → **98.2% folded (2627/2674)**, raw 98.2%. The only fold is the
tie-bar (our t͡ʃ d͡ʒ ~ the referee's plain tʃ dʒ). Spot-checks are exact: ئۇيغۇر→ʔujʁur, كىتاب→kitɑp, مەكتەپ→mɛktɛp,
جۇڭگو→d͡ʒuŋɡo; sentence مەن ئۇيغۇرچە سۆزلەيمەن → mɛn ʔujʁurt͡ʃɛ søzlɛjmɛn.

**The ~2% residual is the isolated ALPHABET-LETTER entries** (ئا→ʔɑ vs the referee's bare "a", ئو→ʔo vs o, …) — the
letters themselves as dictionary headwords, where the referee drops the glottal onset. Real words are essentially
at ceiling.

## Verdict: ✅ (single large human referee, near-ceiling)

The output is trustworthy: a fully phonemic script + 98.2% on a 2673-word human referee, checking the full
segmental detail (including the glottal onset and the back/front vowel distinction — not folded away). epitran
uig-Arab independently corroborates the consonant map (it is cruder on vowels — ⟨ا⟩→a not ɑ — and drops the
glottal, so it is a weaker cross-check, not adopted as a scored second referee). Deferred: **numbers** (Turkic
decimal system; a Run-2 candidate). Non-tonal. Gold: `test/uyghur.test.ts`. Floor `ug: 0.97`.
