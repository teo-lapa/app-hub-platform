# Miglioramenti: Orders Agent

**File**: `/lib/lapa-agents/agents/orders-agent.ts`
**Ruolo**: Gestione ordini, carrello, storico acquisti

---

## Stato Attuale

L'agente ordini:
- Cerca ordini in Odoo (sale.order)
- Gestisce carrello (aggiungi, rimuovi, conferma)
- Mostra storico ordini
- Calcola prezzi B2B/B2C

---

## Miglioramenti da Fare

### TODO

- [ ] Suggerire prodotti basati su acquisti precedenti
- [ ] Ricordare prodotti preferiti dell'utente
- [ ] Proporre riordino automatico per prodotti ricorrenti
- [ ] Migliorare messaggio quando ordine non trovato

---

## Miglioramenti Fatti

(Nessuno ancora - progetto appena iniziato)

---

## Note e Osservazioni

### Risposte da Migliorare

| Situazione | Risposta Attuale | Risposta Ideale |
|------------|------------------|-----------------|
| Errore carrello | "Si è verificato un errore con il carrello. Riprova o contatta il supporto." | Spiegare meglio l'errore, provare a recuperare automaticamente, offrire alternative |

### Bug da Investigare

- **2026-01-02**: Cliente Paul (ID 11) ha avuto errore "Si è verificato un errore con il carrello" quando ha provato ad ordinare FRIARIELLI DI CAMPO. Verificare i log per capire la causa.

### Funzionalità Mancanti

| Richiesta utente | Cosa manca |
|------------------|------------|
| | |

---

## Log Modifiche al Codice

### YYYY-MM-DD - Titolo
**Modifica**: [Descrizione]
**Righe**: [Numeri riga modificate]
**Motivo**: [Perché]
