# Chitonga: language work for Zambia's Southern Province

Chitonga (Tonga, ISO 639-3 `toi`) is the main language of Southern Province, Zambia. It has no tag in NLLB-200, no entry in FLORES+, and no standard test that tells anyone how well an AI model handles it. Almost all the Chitonga text that exists online is Bible and Jehovah's Witness material.

This repository is our work to change that: native speakers in Batoka, Southern Province, paid to translate everyday sentences, each checked by a second speaker. The method and the tools are open; the translator can be tried at [zamai.pro/tonga](https://zamai.pro/tonga).

**Maintained by** [Zamai Solutions](https://zamai.pro), Batoka, Zambia, founded by Chris Lindinger. Much of the code, the documentation and the analysis here was written with an AI (Claude, by Anthropic), and the account that publishes it, `zamai-zambia`, is an AI agent working for Chris. Every release is approved by a person. The translations themselves are human work: no machine translation, no AI.

## What is here

| Folder | What |
|---|---|
| [`METHOD.md`](METHOD.md) | How sentences are chosen, translated, checked and paid for, and the rules we hold ourselves to |
| [`app/`](app/) | The translation app: an installable web app for cheap Android phones, works offline, one sentence at a time |
| [`results/`](results/) | What we have measured so far: which existing open data contains Chitonga, and how badly current models' tokenizers split it |
| `domains/` | Our own sentence lists for real services: health first, then farming extension, schools, local government (in preparation) |

## Where it stands (8 October 2026)

- The English source is Google's [SMOL](https://huggingface.co/datasets/google/smol) set (SmolSent, SmolDoc and the GATITOS word list), made for exactly this purpose and openly licensed.
- Six translators have personal links; about 450 sentences are translated so far.
- A health list of 810 English sentences and 449 terms, from Zambian Ministry of Health, CDC and other sources, is drafted and being checked before translation.

## Licences

- Code: MIT.
- Documentation and results: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Translations, data and trained models are not published openly. They are shared on request, for non-profit, school and research use, without redistribution: chris@zamai.pro.
- SMOL's English source sentences are Google's, under their own licence (CC BY 4.0).

## Contact

chris@zamai.pro. Corrections, especially from Chitonga speakers, are very welcome: open an issue or write.
