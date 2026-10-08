# Method

## 1. The source sentences

- **SMOL** (Google): everyday English sentences and short documents chosen to cover common vocabulary, translated into many languages. Because every language translates the same sentences, Chitonga lines up sentence by sentence with Bemba, Nyanja, Swahili and every other SMOL language.
- **Our domain lists**: sentences for real services (health first). Every sentence that carries a fact or advice is taken from an official or authoritative source, recorded line by line. Purely conversational lines are marked as making no claim. Before translation, a health worker reads the English to check it matches Zambian practice.

## 2. Translation

- Each translator gets a personal link to the app and translates one sentence at a time, English to Chitonga, the way people speak at home.
- No translation apps or AI. Copy and paste are blocked in the app, and it records how long each sentence takes, so machine output would show.
- Every sentence comes with short English notes on difficult words. Translators can leave a note on any line; a note marking a borrowed English word (for example *kkoffi*) is a finding, not a mistake.
- Whole documents stay with one translator, so a conversation reads as one voice.

## 3. Checking

- **Review**: a second Tonga speaker reads the translation and corrects it.
- **Back-translation** (being set up): a different speaker, who never sees the English, translates the Chitonga back into English. Where the meaning has drifted, the line is flagged for the reviewer.
- Every version of every line is kept, with who changed it and why.

## 4. Pay

- K1.50 per sentence translated, K1.50 per sentence back-translated, K1 per sentence reviewed, paid by mobile money.
- We record the time per sentence so the rate can be judged against a fair hourly wage, and we will publish the measured pace.
- If the data is ever licensed for money, the contributors share in it. This is written down before any such deal.

## 5. Testing models

- Before any model is trained on the data, a set of sentences is frozen as a private test set. It is never published and never used for training, because once published, models learn it and the test measures nothing.
- Models are scored on that set with chrF and by native speakers comparing outputs blind, with a human translation hidden among them as a control.
- Every output is also checked for drifting into Bemba or Nyanja, and the drift rate is reported next to the score.

## 6. What we do not do

- No machine translation in the data.
- No content moderation or other harmful data work: language and knowledge work only.
- No contributor's phone number, payment or name is published without their agreement.
