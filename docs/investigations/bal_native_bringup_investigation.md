# Balochi (bal) native bring-up — Southern Balochi, Arabic script

Balochi / بلوچی (bal) — Northwestern Iranian, ~9M speakers (Balochistan across Pakistan, Iran, Afghanistan, + the
Gulf and Turkmenistan). Target: **Southern Balochi** (the Jahani & Korn reference variety), in the **Balochi Arabic
alphabet** (the default script the Baloch use).

## Gate — no machine referee, not aliasable

- **No referee:** nothing on wikipron (`bal`/`bcc`/`bgn`/`bgp`, Arab or Latn), no kaikki page for Balochi or any
  variety, no epitran `bal-Arab`/`bcc-Arab` map.
- **Not aliasable:** Balochi is a distinct NW Iranian language with **retroflex consonants (ʈ ɖ ɽ)** that the fleet's
  Iranian modules (fa/ps/ckb) lack — routing it to any of them would be wrong.
- **ISO macrolanguage:** Southern (bcc), Western/Rakhshani (bgn), Eastern (bgp). We target **Southern** (the best-
  described SWBal. reference; Eastern is the divergent one with aspiration + fricativisation).
- **But well-documented** → authorable the Madurese/Sudanese way, from **Jahani & Korn (2009), "Balochi", in *The
  Iranian Languages*** (CC-unclear, cited not copied): Table 11.1 (Pakistan alphabet), Table 11.6 (SWBal.
  consonants), Table 11.2 (ComBal. vowels).

## The inventory (Southern Balochi, from Jahani & Korn)

- **Consonants:** p b, **t̪ d̪** (dental) vs **ʈ ɖ** (retroflex), t͡ʃ d͡ʒ, k ɡ; s z ʃ ʒ, peripheral f x ɣ, h; m n; r,
  **ɽ** (retroflex tap); l; w j. **No native /q/** (ق→k). Southern Balochi is **unaspirated** (aspiration is an
  Eastern feature). The retroflexes (Indic contact) are the signature that distinguishes Balochi in the fleet.
- **Vowels:** short /a i u/ (unwritten), long /aː iː uː/, mid-long /eː oː/ (no short counterpart), + diphthongs aj/aw.

## The g2p and the honest ceiling

A left-to-right greedy Arabic scan (the ckb pattern): consonant lookup from Table 11.1, the و/ی matres lectionis
(glide [w]/[j] next to a vowel, else the long vowel), ا→[aː], ʿayn/hamza dropped, ں→nasalisation.

**The script is DEFECTIVE for vowels** — a textbook "variant without sufficient vowel-encoding":
1. the **short vowels /a i u/ are UNWRITTEN** (full abjad — گریب *garīb* → ɡriːb, the short a is gone), and
2. **⟨و⟩ conflates /uː/ and /oː/**, **⟨ی⟩ conflates /iː/ and /eː/** (خاموش *xāmōš* → xaːm**uː**ʃ, not xaːm**oː**ʃ).

So the g2p recovers the **consonant backbone + long-vowel positions** but not the short vowels or the o/u–e/i
quality (defaulted و→uː, ی→iː). This is inherent to Arabic-script Balochi, not a fixable engine gap — it is the
honest ⛔ ceiling. (A Roman-Balochi front-end would recover all vowels, but Roman Balochi is a minority orthography
that would not phonemise the script most Balochi text is actually written in.)

## Result & verdict: ⛔ cannot-verify

No independent referee exists, so the check is a **hand-gold on the sourced inventory** (`test/balochi.test.ts`, 10
words): each Arabic-script word's consonant + long-vowel backbone matches the Jahani & Korn value — verifying the
Table 11.1 mapping, the dental/retroflex contrast (ڈاکٹر→ɖaːkʈr, کتاب→kt̪aːb), and the affricates. **10/10.** But the
word-level Arabic spellings are author-supplied (no independent corpus), and the vowel encoding is defective →
**⛔** (fills the retroflex-Iranian census gap; the consonant inventory is sourced and falsifiable, the vowels are
script-limited). Numbers deferred. If a Balochi pronunciation corpus/wikipron ever appears, re-grade.
