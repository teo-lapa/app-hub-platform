/**
 * ORCHESTRATORE SQUADRA RECUPERO CREDITI
 *
 * Coordina i 3 agenti specializzati:
 * 1. Investigatore Societario
 * 2. Analista Fallimenti Fraudolenti
 * 3. Stratega Recupero Crediti
 *
 * Caso: BS Gastro Services AG / LATOUR Holding AG / Balwinder Singh
 * Importo: CHF 120'000 (100'000 capitale + 20'000 spese)
 */

import Anthropic from '@anthropic-ai/sdk';
import { InvestigatoreSocietario } from './investigatore-societario';
import { AnalistaFallimenti } from './analista-fallimenti';
import { StrategaRecupero } from './stratega-recupero';

// Dati completi del caso
export const CASO = {
  nome: 'BS Gastro / NA081',
  creditore: 'LAPA',
  importo: {
    capitale: 100000,
    spese: 20000,
    totale: 120000,
    valuta: 'CHF'
  },

  debitore: {
    societaFallita: {
      nome: 'BS Gastro Services AG',
      uid: 'CHE-227.614.242',
      dataFallimento: new Date('2025-02-24'),
      curatore: 'Konkursamt Aussersihl-Zürich'
    },
    societaNuova: {
      nome: 'LATOUR Holding AG',
      uid: 'CHE-135.688.957',
      dataFondazione: new Date('2019-05-23'),
      sede: 'Bergstrasse 40, 8702 Zollikon',
      attivita: ['NA081 Konradstrasse', 'NA081 Seefeld', 'NA081 Glattbrugg', 'Restaurant Vulkan', 'Hotel Perron 10']
    }
  },

  responsabili: {
    principale: {
      nome: 'Balwinder Singh',
      origine: 'Uerkheim (AG)',
      residenza: 'Zollikon (ZH)',
      indirizzo: 'Bergstrasse 40, 8702 Zollikon',
      ruoloBSGastro: 'Ex Membro CdA (uscito 01.06.2021)',
      ruoloLatour: 'Presidente CdA',
      altreSocieta: [
        { nome: 'Gun + Bal GmbH', uid: 'CHE-114.933.588', ruolo: 'CEO' },
        { nome: 'Gun + Bal Gastro AG', uid: 'CHE-214.379.669', ruolo: 'Presidente CdA' },
        { nome: 'Braclo Management AG', uid: 'CHE-105.133.815', ruolo: 'Membro CdA' },
        { nome: 'Hotel Perron 10 AG', uid: 'CHE-191.255.020', ruolo: 'Membro CdA' }
      ]
    },
    moglie: {
      nome: 'Rupinder Kaur Singh',
      origine: 'Uerkheim (AG)',
      residenza: 'Zollikon (ZH)',
      ruoli: [
        'LATOUR Holding AG - Membro CdA',
        'Gun + Bal GmbH - Geschäftsführerin',
        'Gun + Bal Gastro AG - Membro CdA'
      ]
    },
    uomoDiPaglia: {
      nome: 'Milind Jagdish Bhatt',
      nazionalita: 'Indiana',
      residenza: 'Winterthur (ZH)',
      dataIngressoBSGastro: new Date('2021-06-01'),
      societaFallite: [
        'BS Gastro Services AG - Fallita 24.02.2025',
        'PALOM Investments AG - Fallita 20.05.2025, chiusa 06.06.2025',
        'O\'Tabe GmbH - In liquidazione'
      ]
    }
  },

  prove: {
    trasferimentoAttivita: 'Sito 7030.ch: "Die Latour Holding AG betreibt [...] NA081 Pizzeria & Ristorante"',
    cambioAmministratori: 'SHAB Nr. 103, Publikation 1005199748 del 01.06.2021',
    schemaRipetuto: 'Singh uscito anche da Chalet Horgen, Zest of Asia, 70/30 Gastro'
  },

  contatti: {
    ufficioFallimenti: {
      nome: 'Konkursamt Aussersihl-Zürich',
      indirizzo: 'Wengistrasse 7, 8004 Zürich',
      telefono: '+41 44 412 78 00'
    },
    procura: {
      nome: 'Staatsanwaltschaft I des Kantons Zürich',
      indirizzo: 'Florhofgasse 2, 8090 Zürich',
      telefono: '+41 44 259 89 89'
    },
    registroCommercio: {
      nome: 'Handelsregisteramt des Kantons Zürich',
      indirizzo: 'Schöntalstrasse 5, 8022 Zürich',
      telefono: '+41 43 259 74 00',
      web: 'zh.chregister.ch'
    }
  },

  ristoranti: {
    na081Konrad: { indirizzo: 'Konradstrasse 71, 8005 Zürich', tel: '+41 43 205 27 93' },
    na081Seefeld: { indirizzo: 'Seefeldstrasse 96, 8008 Zürich', tel: '+41 44 202 00 21' },
    na081Glattbrugg: { indirizzo: 'Schaffhauserstrasse 55, 8152 Opfikon', tel: '+41 44 829 20 11', email: 'glattbrugg@na081.ch' },
    vulkan: { indirizzo: 'Klingenstrasse 33, 8005 Zürich', tel: '+41 44 273 76 67' }
  }
};

export class OrchestratorRecupero {
  private anthropic: Anthropic;
  private investigatore: InvestigatoreSocietario;
  private analista: AnalistaFallimenti;
  private stratega: StrategaRecupero;

  // Stato del caso
  private statoAzioni: Map<string, 'da_fare' | 'in_corso' | 'completata'> = new Map();
  private documentiGenerati: string[] = [];
  private noteUtente: string[] = [];

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });

    this.investigatore = new InvestigatoreSocietario();
    this.analista = new AnalistaFallimenti();
    this.stratega = new StrategaRecupero();

    // Inizializza stato azioni
    this.inizializzaAzioni();
  }

  private inizializzaAzioni(): void {
    const azioni = [
      'insinuazione_credito',
      'denuncia_penale',
      'diffida_latour',
      'richiesta_inventario',
      'richiesta_revocatoria',
      'cessione_diritti',
      'azione_civile'
    ];

    azioni.forEach(a => this.statoAzioni.set(a, 'da_fare'));
  }

  /**
   * Sistema prompt principale dell'orchestratore
   */
  private getSystemPrompt(): string {
    return `Sei l'ASSISTENTE LEGALE PRINCIPALE per il recupero di CHF 120'000 da BS Gastro Services AG.

CASO IN SINTESI:
- Creditore: ${CASO.creditore}
- Importo: CHF ${CASO.importo.totale.toLocaleString('de-CH')}
- Societa fallita: ${CASO.debitore.societaFallita.nome} (fallita ${CASO.debitore.societaFallita.dataFallimento.toLocaleDateString('it-CH')})
- Responsabile: ${CASO.responsabili.principale.nome} (ora presidente di ${CASO.debitore.societaNuova.nome})
- Schema: Phoenix Company - l'attivita NA081 continua sotto LATOUR Holding

HAI 3 AGENTI SPECIALIZZATI:
1. INVESTIGATORE: Analizza societa, trova collegamenti, individua beni
2. ANALISTA FRODI: Identifica pattern fraudolenti, prepara denuncia penale
3. STRATEGA: Pianifica azioni, genera documenti, guida passo-passo

IL TUO RUOLO:
- Coordinare i 3 agenti
- Rispondere alle domande in modo CHIARO e PRATICO
- Generare documenti PRONTI ALL'USO
- Indicare ESATTAMENTE cosa fare, dove andare, cosa dire
- Ricordare scadenze e prossimi passi

PRINCIPI:
1. Prima le azioni GRATUITE (denuncia, insinuazione)
2. Poi le azioni ECONOMICHE (raccomandate)
3. Solo dopo le azioni COSTOSE
4. Singh ha MOLTO da perdere - la pressione funziona
5. Il caso e' FORTE - 95/100 punteggio frode

STILE:
- Parla in italiano semplice
- Usa elenchi e passi numerati
- Dai sempre indirizzi e contatti
- Indica chiaramente i costi
- Rassicura: SI PUO' FARE senza avvocato

Rispondi sempre in modo pratico e concreto.`;
  }

  /**
   * Elabora una richiesta dell'utente
   */
  async elaboraRichiesta(richiesta: string): Promise<string> {
    // Analizza il tipo di richiesta
    const richiestaLower = richiesta.toLowerCase();

    // Richieste di documenti
    if (richiestaLower.includes('insinuazione') || richiestaLower.includes('credito') && richiestaLower.includes('genera')) {
      return await this.generaDocumento('insinuazione');
    }

    if (richiestaLower.includes('denuncia') && (richiestaLower.includes('genera') || richiestaLower.includes('scrivi'))) {
      return await this.generaDocumento('denuncia');
    }

    if (richiestaLower.includes('diffida') && (richiestaLower.includes('genera') || richiestaLower.includes('scrivi'))) {
      return await this.generaDocumento('diffida');
    }

    if (richiestaLower.includes('revocatoria') && (richiestaLower.includes('genera') || richiestaLower.includes('richiesta'))) {
      return await this.generaDocumento('revocatoria');
    }

    // Richieste di analisi
    if (richiestaLower.includes('analizza') || richiestaLower.includes('analisi')) {
      return await this.eseguiAnalisi();
    }

    // Richieste di stato
    if (richiestaLower.includes('stato') || richiestaLower.includes('situazione') || richiestaLower.includes('dove siamo')) {
      return this.getStatoAttuale();
    }

    // Richieste di piano
    if (richiestaLower.includes('piano') || richiestaLower.includes('strategia') || richiestaLower.includes('cosa devo fare')) {
      return await this.getPianoAzione();
    }

    // Richieste di prossimo passo
    if (richiestaLower.includes('prossimo') || richiestaLower.includes('adesso') || richiestaLower.includes('ora')) {
      return await this.getProssimoPasso();
    }

    // Domande generiche - usa AI
    return await this.rispondiDomanda(richiesta);
  }

  /**
   * Genera un documento specifico
   */
  async generaDocumento(tipo: 'insinuazione' | 'denuncia' | 'diffida' | 'revocatoria'): Promise<string> {
    const datiCreditore = {
      nome: '[INSERISCI IL TUO NOME]',
      indirizzo: '[INSERISCI IL TUO INDIRIZZO]',
      telefono: '[INSERISCI IL TUO TELEFONO]',
      email: '[INSERISCI LA TUA EMAIL - opzionale]',
      motivoCredito: '[DESCRIVI BREVEMENTE PERCHE TI DEVONO I SOLDI - es: forniture, prestito, ecc.]'
    };

    let documento = '';
    let istruzioni = '';

    switch (tipo) {
      case 'insinuazione':
        documento = await this.stratega.generaInsinuazioneCredito(datiCreditore);
        istruzioni = `
ISTRUZIONI PER L'INSINUAZIONE CREDITO:

1. COMPILA i campi tra parentesi quadre con i tuoi dati
2. STAMPA la lettera
3. FIRMA a mano dove indicato
4. ALLEGA:
   - Copie delle fatture non pagate
   - Eventuali contratti
   - Prove del credito

5. INVIA a:
   ${CASO.contatti.ufficioFallimenti.nome}
   ${CASO.contatti.ufficioFallimenti.indirizzo}
   Tel: ${CASO.contatti.ufficioFallimenti.telefono}

6. Puoi inviare per posta normale o consegnare a mano
7. CONSERVA una copia per te

COSTO: GRATUITO
TEMPO: Circa 2-4 settimane per la risposta

---
IMPORTANTE: Fallo SUBITO per non perdere i termini!
`;
        this.documentiGenerati.push('insinuazione_credito');
        break;

      case 'denuncia':
        documento = await this.stratega.generaDenunciaPenale(datiCreditore);
        istruzioni = `
ISTRUZIONI PER LA DENUNCIA PENALE:

1. COMPILA i campi tra parentesi quadre con i tuoi dati
2. STAMPA la denuncia
3. STAMPA LE PROVE:
   - Vai su 7030.ch/wir-sind-7030/ e stampa la pagina
   - Vai su zh.chregister.ch e stampa gli estratti di:
     * BS Gastro Services AG
     * LATOUR Holding AG
   - Stampa le tue fatture non pagate

4. FIRMA la denuncia a mano
5. PORTA TUTTO a:
   ${CASO.contatti.procura.nome}
   ${CASO.contatti.procura.indirizzo}
   Tel: ${CASO.contatti.procura.telefono}

6. Puoi andare di persona (meglio) o inviare per posta
7. CHIEDI il numero di riferimento della pratica
8. Puoi presentarla in ITALIANO

COSTO: GRATUITO
TEMPO: 3-6 mesi per una decisione preliminare

---
IMPORTANTE: Non hai bisogno di avvocato per la denuncia penale!
`;
        this.documentiGenerati.push('denuncia_penale');
        break;

      case 'diffida':
        documento = await this.stratega.generaDiffidaLatour(datiCreditore);
        istruzioni = `
ISTRUZIONI PER LA LETTERA DI DIFFIDA:

1. COMPILA i campi tra parentesi quadre con i tuoi dati
2. STAMPA la lettera
3. FIRMA a mano dove indicato
4. ALLEGA copia delle fatture

5. INVIA come RACCOMANDATA CON RICEVUTA DI RITORNO a:
   LATOUR Holding AG
   Att.ne: Sig. Balwinder Singh
   Bergstrasse 40
   8702 Zollikon

6. Alla posta chiedi: "Einschreiben mit Rückschein" (raccomandata A/R)
7. CONSERVA la ricevuta di spedizione

COSTO: CHF 8-10 (raccomandata)
TEMPO DI ATTESA: 30 giorni per la risposta

---
NOTA: Questa lettera crea PRESSIONE su Singh.
Se non risponde, hai la prova che hai tentato una soluzione amichevole.
`;
        this.documentiGenerati.push('diffida_latour');
        break;

      case 'revocatoria':
        documento = await this.stratega.generaRichiestaRevocatoria(datiCreditore);
        istruzioni = `
ISTRUZIONI PER LA RICHIESTA DI AZIONE REVOCATORIA:

1. COMPILA i campi con i tuoi dati
2. STAMPA la richiesta
3. ALLEGA:
   - Stampa della pagina 7030.ch
   - Estratti registro commerciale

4. INVIA a:
   ${CASO.contatti.ufficioFallimenti.nome}
   ${CASO.contatti.ufficioFallimenti.indirizzo}

PREREQUISITO: Devi aver gia insinuato il credito nel fallimento!

COSTO: GRATUITO
TEMPO: 2-6 mesi

---
NOTA: L'azione revocatoria puo annullare il trasferimento di NA081
a LATOUR Holding e riportare l'attivita nella massa fallimentare.
`;
        this.documentiGenerati.push('richiesta_revocatoria');
        break;
    }

    return `${documento}

${'='.repeat(80)}
${istruzioni}`;
  }

  /**
   * Esegue analisi completa del caso
   */
  async eseguiAnalisi(): Promise<string> {
    // Carica caso nell'analista
    await this.analista.caricaCasoBSGastro();

    // Analizza
    const analisi = await this.analista.analizzaCaso();

    return `
ANALISI COMPLETA DEL CASO BS GASTRO / LATOUR HOLDING
${'='.repeat(60)}

PUNTEGGIO FRODE: ${analisi.punteggioFrode}/100 - ${analisi.punteggioFrode >= 80 ? 'CASO MOLTO FORTE' : 'CASO FORTE'}

PATTERN DI FRODE IDENTIFICATI:
${analisi.patternIdentificati.map(p => `- ${p}`).join('\n')}

INDICATORI DI FRODE:
${analisi.fraudIndicators.map(f => `
[${f.gravita}] ${f.tipo}
${f.descrizione}
Score: ${f.score}/100
`).join('\n')}

AZIONI CONSIGLIATE (in ordine di priorita):
${analisi.azioniConsigliate.map((a, i) => `
${i + 1}. ${a.azione}
   Motivazione: ${a.motivazione}
   Costo: ${a.costoStimato === 0 ? 'GRATIS' : `CHF ${a.costoStimato}`}
   Probabilita successo: ${a.probabilitaSuccesso}%
`).join('\n')}

SINTESI:
${analisi.sintesi}

${'='.repeat(60)}
CONCLUSIONE: Il caso e' molto forte. Singh ha commesso una frode evidente
e ci sono buone possibilita di recupero attraverso pressione legale.
`;
  }

  /**
   * Ottiene lo stato attuale del caso
   */
  getStatoAttuale(): string {
    const completate = Array.from(this.statoAzioni.entries())
      .filter(([, stato]) => stato === 'completata')
      .map(([azione]) => azione);

    const inCorso = Array.from(this.statoAzioni.entries())
      .filter(([, stato]) => stato === 'in_corso')
      .map(([azione]) => azione);

    const daFare = Array.from(this.statoAzioni.entries())
      .filter(([, stato]) => stato === 'da_fare')
      .map(([azione]) => azione);

    return `
STATO ATTUALE DEL CASO
${'='.repeat(60)}

CASO: Recupero CHF ${CASO.importo.totale.toLocaleString('de-CH')} da BS Gastro / Singh

AZIONI COMPLETATE: ${completate.length > 0 ? '\n' + completate.map(a => `  ✅ ${a}`).join('\n') : 'Nessuna ancora'}

AZIONI IN CORSO: ${inCorso.length > 0 ? '\n' + inCorso.map(a => `  🔄 ${a}`).join('\n') : 'Nessuna'}

AZIONI DA FARE: ${daFare.length > 0 ? '\n' + daFare.map(a => `  ⬜ ${a}`).join('\n') : 'Tutte completate!'}

DOCUMENTI GENERATI: ${this.documentiGenerati.length > 0 ? '\n' + this.documentiGenerati.map(d => `  📄 ${d}`).join('\n') : 'Nessuno ancora'}

${'='.repeat(60)}
Digita "prossimo passo" per sapere cosa fare adesso.
`;
  }

  /**
   * Ottiene il piano d'azione completo
   */
  async getPianoAzione(): Promise<string> {
    const piano = await this.stratega.getPianoStrategico();

    return `
PIANO D'AZIONE - RECUPERO CHF ${CASO.importo.totale.toLocaleString('de-CH')}
${'='.repeat(60)}

FASE 1: AZIONI IMMEDIATE (GRATIS)
${'─'.repeat(40)}
1. INSINUAZIONE CREDITO nel fallimento BS Gastro
   - Cosa: Iscrivere il tuo credito per partecipare alla distribuzione
   - Dove: ${CASO.contatti.ufficioFallimenti.nome}
   - Costo: GRATIS
   - Tempo: 1 settimana per preparare, 2-4 settimane risposta
   - Comando: "genera insinuazione"

2. DENUNCIA PENALE alla Procura di Zurigo
   - Cosa: Denunciare Singh e Bhatt per bancarotta fraudolenta
   - Dove: ${CASO.contatti.procura.nome}
   - Costo: GRATIS
   - Tempo: 1 giorno per preparare, 3-6 mesi per decisione
   - Comando: "genera denuncia"

FASE 2: AZIONI A BASSO COSTO
${'─'.repeat(40)}
3. LETTERA DI DIFFIDA a Singh/LATOUR
   - Cosa: Richiedere pagamento minacciando azioni
   - Dove: LATOUR Holding AG, Bergstrasse 40, 8702 Zollikon
   - Costo: CHF 10 (raccomandata)
   - Tempo: 30 giorni per risposta
   - Comando: "genera diffida"

4. RICHIESTA INVENTARIO fallimento
   - Cosa: Vedere cosa c'e' nella massa fallimentare
   - Dove: Ufficio Fallimenti (stesso della insinuazione)
   - Costo: GRATIS
   - Tempo: 2-4 settimane

FASE 3: AZIONI AVANZATE
${'─'.repeat(40)}
5. RICHIESTA AZIONE REVOCATORIA
   - Cosa: Chiedere di annullare trasferimento NA081
   - Dove: Ufficio Fallimenti
   - Costo: GRATIS
   - Comando: "genera revocatoria"

6. CESSIONE DIRITTI (Art. 260 LEF)
   - Cosa: Ottenere i diritti per agire tu contro LATOUR
   - Costo: CHF 500 circa
   - Solo se l'Ufficio non agisce

${'='.repeat(60)}
COSTO TOTALE STIMATO: CHF ${piano.costoTotaleStimato} (+ eventuali CHF 500 per cessione)
TEMPO TOTALE STIMATO: ${piano.tempoTotaleStimato} giorni
PROBABILITA' RECUPERO: ${piano.probabilitaRecupero}%

CONSIGLIO: ${piano.primoPasso}
`;
  }

  /**
   * Ottiene il prossimo passo da fare
   */
  async getProssimoPasso(): Promise<string> {
    const passo = await this.stratega.getProssimoPasso();

    return `
PROSSIMO PASSO DA FARE
${'='.repeat(60)}

AZIONE: ${passo.azione}
${'─'.repeat(40)}
${passo.descrizione}

COSTO: ${passo.costo === 0 ? 'GRATUITO' : `CHF ${passo.costo}`}
TEMPO: ${passo.tempoStimato}

ISTRUZIONI:
${passo.istruzioni.map(i => i).join('\n')}

CONTATTI:
${typeof passo.contatti === 'object' && passo.contatti !== null ?
  Object.entries(passo.contatti).map(([k, v]) =>
    typeof v === 'object' && v !== null ? `${k}:\n  ${Object.entries(v).map(([k2, v2]) => `${k2}: ${v2}`).join('\n  ')}` : `${k}: ${v}`
  ).join('\n') :
  passo.contatti
}

${'='.repeat(60)}
Per generare il documento, digita: "genera ${passo.azione.toLowerCase().split(' ')[0]}"
`;
  }

  /**
   * Risponde a domande generiche
   */
  async rispondiDomanda(domanda: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      temperature: 0.4,
      system: this.getSystemPrompt(),
      messages: [{ role: 'user', content: domanda }]
    });

    const textContent = response.content.find(c => c.type === 'text');
    return textContent?.type === 'text' ? textContent.text : 'Non ho capito la domanda.';
  }

  /**
   * Segna un'azione come completata
   */
  segnaCompletata(azione: string): void {
    if (this.statoAzioni.has(azione)) {
      this.statoAzioni.set(azione, 'completata');
      this.stratega.segnaCompletata(azione);
    }
  }

  /**
   * Aggiunge una nota dell'utente
   */
  aggiungiNota(nota: string): void {
    this.noteUtente.push(`[${new Date().toLocaleDateString('it-CH')}] ${nota}`);
  }

  /**
   * Ottiene tutte le informazioni del caso
   */
  getInfoCaso(): typeof CASO {
    return CASO;
  }
}

// Export singleton per uso diretto
export const orchestrator = new OrchestratorRecupero();
