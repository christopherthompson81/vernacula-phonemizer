# Moroccan Arabic (ary) native bring-up

Moroccan Arabic / الدارجة (Darija) — ~30M+ speakers. The 6th Arabic variety on the shared engine, and the most
divergent Arabic variety of all: a one-file shift table (`moroccan.jsonc`) on the MSA g2p output.

## Data availability (checked up front)

- **wikipron ary_arab broad** — 2,168 human pairs (PRIMARY) — **by far the largest Arabic-variety scrape** on the
  fleet (arz was 590, apc 410). Independent human dialectal IPA.
- No kaikki ary, no epitran ary → single independent referee (a `secondaryGap`).

## The Moroccan fingerprint

Darija's consonant fingerprint is the **opposite of the eastern dialects on ق**:

- **ق KEPT [q]** — the Maghrebi signature. The referee is overwhelmingly q-dominant (375 q vs a handful of g),
  NOT the eastern gilit [ɡ] or urban [ʔ]. So there is **no qaf shift** in `moroccan.jsonc`.
- **ج → [ʒ]** (fricative — referee-dominant 218).
- **Interdentals merge to stops**: ث → [t], ذ → [d] (the ذ→d rule also turns ظ [ðˤ]→[dˤ], since ð is a substring
  of ðˤ). Referee: ث→t (4/4), ذ→d.
- **خ KEPT [x]** (referee x-dominant 150).
- Historical **diphthongs monophthongize** (ay→eː, aw→oː — Darija-variable; some registers raise to iː/uː).

## The deep story: Darija's vowels

The consonant shifts above are the easy part. Darija's real character is a **wholesale short-vowel
restructuring**: MSA short a/i/u collapse to a schwa [ə] or **delete entirely** (kalb→[kəlb], kteb "he wrote"),
producing the heavy consonant clusters Darija is known for. This is not a shift table — it is a lexical/phonotactic
rewrite of the syllable structure, and the MSA diacritizer (which restores MSA vowels) cannot produce it. Same
data-blocked wall as arz/apc, only larger.

## Run — vs the referee

**27.5% folded** (596/2168) — **the highest folded % in the family, on the largest referee**, because Moroccan
KEEPS [q] (so the most common qaf words match without a shift) and the consonant meristers land cleanly. The
residual is the schwa/deletion vowel system described above — a large but honestly-bounded data tail.

## Verdict — 🟡 Reliable (consonants) + large data-blocked vowel tail

The consonant fingerprint (ق kept, ج→ʒ, interdentals→stops) is correct and corroborated on a substantial 2168-word
referee. The vowels (Darija's schwa/deletion system) are the documented ceiling — recoverable only with a Darija
vowel model. Numbers share the MSA composer.
