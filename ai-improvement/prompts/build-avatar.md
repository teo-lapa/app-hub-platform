# Prompt: Costruisci Avatar Utente

Come creo e aggiorno gli avatar per gli utenti registrati.

---

## Cos'è un Avatar

Un avatar è un **profilo completo** di un utente che permette agli agenti di:
- Parlare in modo personale e amichevole
- Ricordare le sue preferenze
- Fare gli auguri per occasioni importanti
- Chiedere follow-up su cose menzionate
- Comportarsi come un amico, non come un robot

---

## Dove Salvo gli Avatar

File: `avatars/{customer_id}.md`

Esempio: `avatars/1234.md` per il cliente con ID 1234 in Odoo

---

## Template Avatar

```markdown
# Avatar: [Nome Completo]

**Customer ID**: [ID da Odoo]
**Ultimo aggiornamento**: [Data]

---

## Informazioni Base
- **Nome**:
- **Azienda**:
- **Ruolo**:
- **Email**:
- **Telefono**:
- **Canale preferito**: web / whatsapp

---

## Stile di Comunicazione
- **Tono preferito**: formale / informale / amichevole
- **Lingua**: italiano / tedesco / francese / inglese
- **Note**: [Es: usa molto le emoji, va sempre di fretta, ama chiacchierare]

---

## Date Importanti
- **Compleanno**: [Data se nota]
- **Anniversario azienda**: [Data se nota]
- **Altre date**: [Es: fiera a cui partecipa, eventi ricorrenti]

---

## Preferenze Acquisto
- **Prodotti preferiti**: [Lista prodotti che compra spesso]
- **Budget tipico**: [Range se noto]
- **Frequenza ordini**: [Es: ogni settimana, ogni mese]
- **Note**: [Es: ordina sempre il venerdì, vuole consegna mattina]

---

## Cose da Ricordare
[Lista di cose che ha menzionato e che possiamo usare per conversare]

- [Data] - Ha detto che...
- [Data] - Ha menzionato che...

---

## Cose da Chiedere
[Follow-up da fare al prossimo contatto]

- [ ] Chiedere come è andato [evento/cosa menzionata]
- [ ] Ricordare di [cosa promessa]

---

## Storico Interazioni

### [Data] - [Canale]
Breve riassunto della conversazione e note importanti.

### [Data] - [Canale]
...
```

---

## Come Estraggo le Informazioni

Quando leggo una conversazione, cerco:

### Informazioni Personali
- Nome completo (se diverso da quello in Odoo)
- Ruolo in azienda ("sono il responsabile acquisti")
- Eventi personali ("domani è il mio compleanno", "vado in ferie")

### Preferenze
- Come vuole essere trattato ("dammi del tu", "preferisco email")
- Orari preferiti ("chiamami solo al mattino")
- Modalità consegna ("sempre a quest'indirizzo")

### Contesto Business
- Tipo di attività ("abbiamo un ristorante", "siamo un catering")
- Eventi ricorrenti ("ogni sabato abbiamo il buffet")
- Sfide ("abbiamo problemi con i fornitori")

### Cose Personali
- Hobby, interessi
- Famiglia ("mia figlia si sposa")
- Progetti futuri

---

## Esempio di Estrazione

**Conversazione**:
```
User: Ciao, sono Marco. Senti, sabato ho il matrimonio di mia figlia,
      mi servirebbero 5kg di gamberi e 3kg di salmone.
Agent: Ciao Marco! Congratulazioni per il matrimonio! ...
```

**Estrazione per Avatar**:
```markdown
## Cose da Ricordare
- 2026-01-03 - La figlia si sposa, matrimonio sabato 4 gennaio

## Cose da Chiedere
- [ ] Chiedere come è andato il matrimonio della figlia
- [ ] Chiedere se serve altro per eventi futuri
```

---

## Priorità Informazioni

**Alta priorità** (salvo sempre):
- Compleanno
- Eventi familiari importanti
- Preferenze di comunicazione
- Prodotti preferiti

**Media priorità** (salvo se rilevante):
- Hobby e interessi
- Contesto business
- Progetti futuri

**Bassa priorità** (salvo solo se molto specifico):
- Commenti generici
- Opinioni su tempo, politica, etc.

---

## Privacy

- NON salvo informazioni sensibili (salute, finanze personali, etc.)
- Le informazioni sono solo per migliorare il servizio
- Se il cliente chiede di dimenticare qualcosa, lo rimuovo
