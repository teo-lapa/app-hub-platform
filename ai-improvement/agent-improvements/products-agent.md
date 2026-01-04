# Miglioramenti: Products Agent

**File**: `/lib/lapa-agents/agents/products-agent.ts`
**Ruolo**: Ricerca prodotti, prezzi, disponibilità

---

## Stato Attuale

L'agente prodotti:
- Cerca prodotti con RAG (semantic search)
- Mostra prezzi (B2B/B2C)
- Verifica disponibilità
- Suggerisce prodotti simili

---

## Miglioramenti da Fare

### TODO

- [ ] Usare storico acquisti utente per prioritizzare risultati
- [ ] Suggerire abbinamenti ("con il salmone va bene il...")
- [ ] Gestire meglio "non trovato" con alternative
- [ ] Aggiungere info su ricette (già parzialmente presente)

---

## Miglioramenti Fatti

(Nessuno ancora - progetto appena iniziato)

---

## Note e Osservazioni

### Prodotti Difficili da Trovare

| Come chiede l'utente | Prodotto reale | Soluzione |
|---------------------|----------------|-----------|
| "guanciale" | ? | Verificare se esiste nel catalogo. Cliente MIHAI NITA lo cercava per carbonara/pizza. |

### Ricette da Aggiungere

| Ricetta | Ingredienti da associare |
|---------|-------------------------|
| | |

---

## Log Modifiche al Codice

### YYYY-MM-DD - Titolo
**Modifica**: [Descrizione]
**Righe**: [Numeri riga modificate]
**Motivo**: [Perché]
