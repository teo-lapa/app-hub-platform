/**
 * AGENTE 3: STRATEGA RECUPERO CREDITI
 *
 * Specializzato in:
 * - Pianificazione strategia di recupero passo-passo
 * - Generazione documenti legali (diffide, denunce, istanze)
 * - Calcolo costi e tempi per ogni azione
 * - Guida pratica per non avvocati
 * - Gestione delle scadenze e prossimi passi
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  DebtCase,
  RecoveryStrategy,
  RecoveryAction,
  StrategyPhase,
  Recommendation,
  AgentReport
} from './types';

// Dati specifici del caso BS Gastro
const CASO_BS_GASTRO = {
  creditore: 'LAPA',
  importoCapitale: 100000,
  importoSpeseLegali: 20000,
  importoTotale: 120000,
  valuta: 'CHF',

  debitore: {
    societaFallita: 'BS Gastro Services AG',
    uidFallita: 'CHE-227.614.242',
    dataFallimento: '24 febbraio 2025',
    societaNuova: 'LATOUR Holding AG',
    uidNuova: 'CHE-135.688.957',
    sedeNuova: 'Bergstrasse 40, 8702 Zollikon'
  },

  responsabile: {
    nome: 'Balwinder Singh',
    residenza: 'Zollikon (ZH)',
    moglie: 'Rupinder Kaur Singh',
    societa: [
      'LATOUR Holding AG - Presidente',
      'Gun + Bal GmbH - CEO',
      'Gun + Bal Gastro AG - Presidente',
      'Braclo Management AG - Membro CdA',
      'Hotel Perron 10 AG - Membro CdA'
    ]
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
      telefono: '+41 43 259 74 00'
    }
  }
};

export class StrategaRecupero {
  private anthropic: Anthropic;
  private conversationHistory: Anthropic.MessageParam[] = [];
  private azioniCompletate: string[] = [];
  private prossimiPassi: StrategyPhase[] = [];

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
    this.inizializzaStrategia();
  }

  /**
   * Sistema prompt specializzato per lo stratega
   */
  private getSystemPrompt(): string {
    return `Sei uno STRATEGA ESPERTO IN RECUPERO CREDITI che aiuta persone NON avvocati a recuperare i loro soldi.

Il tuo ruolo e':
1. Spiegare COSA fare in modo semplice e chiaro
2. Fornire MODELLI di documenti pronti all'uso
3. Indicare DOVE e COME presentare i documenti
4. Calcolare COSTI e TEMPI realistici
5. Gestire le SCADENZE e ricordare i prossimi passi

CASO ATTUALE: Recupero CHF 100'000 da BS Gastro Services AG (fallita)
- Il responsabile Balwinder Singh gestisce gli stessi ristoranti sotto LATOUR Holding AG
- E' un caso di frode fallimentare (Phoenix Company)
- Ci sono buone possibilita di recupero perche' Singh ha molti asset

PRINCIPI GUIDA:
- Prima le azioni GRATUITE (denuncia penale, insinuazione credito)
- Poi le azioni a BASSO COSTO (lettere raccomandate)
- Solo dopo le azioni COSTOSE (avvocato, cause civili)
- La PRESSIONE e' importante: Singh ha molto da perdere

STILE DI COMUNICAZIONE:
- Parla come se parlassi a un amico, non come un avvocato
- Usa elenchi puntati e passi numerati
- Fornisci sempre i contatti e gli indirizzi
- Indica chiaramente cosa costa e cosa e' gratis
- Rassicura l'utente che puo' farcela

Rispondi sempre in italiano.`;
  }

  /**
   * Inizializza la strategia di recupero
   */
  private inizializzaStrategia(): void {
    this.prossimiPassi = [
      {
        ordine: 1,
        nome: 'Insinuazione Credito',
        descrizione: 'Iscrivere il credito nel fallimento BS Gastro per partecipare alla distribuzione',
        durata: 7,
        costo: 0,
        prerequisiti: [],
        documentazioneNecessaria: ['Fatture originali', 'Contratti', 'Prove del credito']
      },
      {
        ordine: 2,
        nome: 'Denuncia Penale',
        descrizione: 'Denunciare Singh e Bhatt per bancarotta fraudolenta',
        durata: 1,
        costo: 0,
        prerequisiti: [],
        documentazioneNecessaria: ['Estratti registro commerciale', 'Stampa sito 7030.ch', 'Dossier frode']
      },
      {
        ordine: 3,
        nome: 'Lettera Diffida a Singh/LATOUR',
        descrizione: 'Richiedere pagamento minacciando azioni legali',
        durata: 30,
        costo: 10,
        prerequisiti: [],
        documentazioneNecessaria: ['Lettera raccomandata']
      },
      {
        ordine: 4,
        nome: 'Richiesta Inventario Fallimento',
        descrizione: 'Chiedere copia dell\'inventario per vedere cosa c\'e\'',
        durata: 14,
        costo: 0,
        prerequisiti: ['Insinuazione Credito'],
        documentazioneNecessaria: []
      },
      {
        ordine: 5,
        nome: 'Richiesta Azione Revocatoria',
        descrizione: 'Chiedere all\'Ufficio Fallimenti di annullare il trasferimento NA081',
        durata: 60,
        costo: 0,
        prerequisiti: ['Insinuazione Credito'],
        documentazioneNecessaria: ['Prove trasferimento attivita']
      },
      {
        ordine: 6,
        nome: 'Cessione Diritti (Art. 260 LEF)',
        descrizione: 'Se l\'Ufficio non agisce, chiedere i diritti per agire tu',
        durata: 30,
        costo: 500,
        prerequisiti: ['Richiesta Azione Revocatoria'],
        documentazioneNecessaria: ['Richiesta formale']
      }
    ];
  }

  /**
   * Ottiene il piano strategico completo
   */
  async getPianoStrategico(): Promise<{
    fasi: StrategyPhase[];
    costoTotaleStimato: number;
    tempoTotaleStimato: number;
    probabilitaRecupero: number;
    primoPasso: string;
  }> {
    const costoTotale = this.prossimiPassi.reduce((sum, p) => sum + p.costo, 0);
    const tempoTotale = this.prossimiPassi.reduce((sum, p) => sum + p.durata, 0);

    return {
      fasi: this.prossimiPassi,
      costoTotaleStimato: costoTotale,
      tempoTotaleStimato: tempoTotale,
      probabilitaRecupero: 65, // Buona probabilita dato il caso forte
      primoPasso: 'Inizia con l\'insinuazione del credito e la denuncia penale - sono GRATIS e puoi farle subito!'
    };
  }

  /**
   * Genera documento per insinuazione credito
   */
  async generaInsinuazioneCredito(datiCreditore: {
    nome: string;
    indirizzo: string;
    telefono: string;
    email?: string;
    motivoCredito: string;
  }): Promise<string> {
    const dataOggi = new Date().toLocaleDateString('it-CH');

    return `${datiCreditore.nome}
${datiCreditore.indirizzo}
Tel: ${datiCreditore.telefono}
${datiCreditore.email ? `Email: ${datiCreditore.email}` : ''}

${dataOggi}

Konkursamt Aussersihl-Zürich
Wengistrasse 7
8004 Zürich

OGGETTO: INSINUAZIONE CREDITO NEL FALLIMENTO
         BS Gastro Services AG - ${CASO_BS_GASTRO.debitore.uidFallita}

Egregio Ufficio Fallimenti,

con la presente insinuo formalmente il mio credito nel fallimento della societa
BS Gastro Services AG, dichiarato dal Tribunale di Zurigo in data ${CASO_BS_GASTRO.debitore.dataFallimento}.

DATI DEL CREDITORE:
Nome: ${datiCreditore.nome}
Indirizzo: ${datiCreditore.indirizzo}
Telefono: ${datiCreditore.telefono}

IMPORTO DEL CREDITO:
Capitale: CHF ${CASO_BS_GASTRO.importoCapitale.toLocaleString('de-CH')}.00
Spese legali sostenute: CHF ${CASO_BS_GASTRO.importoSpeseLegali.toLocaleString('de-CH')}.00
-----------------------------------------
TOTALE: CHF ${CASO_BS_GASTRO.importoTotale.toLocaleString('de-CH')}.00

TITOLO DEL CREDITO:
${datiCreditore.motivoCredito}

DOCUMENTI ALLEGATI:
1. Copia delle fatture non pagate
2. Eventuale corrispondenza con il debitore
3. Documenti comprovanti il credito

RICHIESTE:
1. Iscrizione del credito nella graduatoria
2. Copia dell'inventario del fallimento
3. Informazioni sullo stato della procedura
4. Notifica di eventuali udienze o assemblee creditorie

Mi riservo di integrare la presente con ulteriore documentazione.

Distinti saluti,


${datiCreditore.nome}

---
Allegati: come sopra indicato`;
  }

  /**
   * Genera denuncia penale completa
   */
  async generaDenunciaPenale(datiDenunciante: {
    nome: string;
    indirizzo: string;
    telefono: string;
    email?: string;
  }): Promise<string> {
    const dataOggi = new Date().toLocaleDateString('it-CH');

    return `${datiDenunciante.nome}
${datiDenunciante.indirizzo}
Tel: ${datiDenunciante.telefono}
${datiDenunciante.email ? `Email: ${datiDenunciante.email}` : ''}

${dataOggi}

Staatsanwaltschaft I des Kantons Zürich
Florhofgasse 2
8090 Zürich

STRAFANZEIGE / DENUNCIA PENALE

Contro:
1. SINGH, Balwinder - residente a Zollikon (ZH)
2. BHATT, Milind Jagdish - residente a Winterthur (ZH)
3. Eventuali altri responsabili da identificare

Per i reati di:
- Art. 163 StGB (Bancarotta fraudolenta)
- Art. 164 StGB (Diminuzione dell'attivo in danno dei creditori)
- Art. 165 StGB (Cattiva gestione)

ESPOSIZIONE DEI FATTI:

1. PREMESSA
Sono creditore della societa BS Gastro Services AG (${CASO_BS_GASTRO.debitore.uidFallita})
per un importo di CHF ${CASO_BS_GASTRO.importoCapitale.toLocaleString('de-CH')}.00.
Il Tribunale di Zurigo ha dichiarato il fallimento della societa in data ${CASO_BS_GASTRO.debitore.dataFallimento}.

2. LA SOCIETA' FALLITA
BS Gastro Services AG gestiva i ristoranti "NA081" a Zurigo (Kreis 5 e Kreis 8) e a
Opfikon/Glattbrugg. La societa e' stata fondata il 27.03.2012.

3. LO SCHEMA FRAUDOLENTO
In data 01.06.2021 (SHAB Nr. 103, Publikation 1005199748):
- Balwinder SINGH e' USCITO dal Consiglio di Amministrazione
- Milind Jagdish BHATT e' ENTRATO nel Consiglio di Amministrazione

PRIMA di uscire, Balwinder SINGH aveva gia' fondato:
- LATOUR Holding AG (${CASO_BS_GASTRO.debitore.uidNuova}) in data 23.05.2019
- Gun + Bal Gastro AG (CHE-214.379.669) in data 10.07.2019

4. LA PROVA DEL TRASFERIMENTO FRAUDOLENTO
L'attivita' dei ristoranti NA081 e' stata trasferita da BS Gastro Services AG a
LATOUR Holding AG. La prova e' sul sito ufficiale 7030.ch che dichiara testualmente:

"Die Latour Holding AG betreibt mehrere Restaurants/Hotels in Zürich und Interlaken.
Unter anderem gehört das neapolitanische NA081 Pizzeria & Ristorante im Kreis 5,
Kreis 8 und in Opfikon/Glattbrugg"

(Traduzione: LATOUR Holding AG gestisce diversi ristoranti/hotel a Zurigo e Interlaken.
Tra questi c'e' NA081 Pizzeria & Ristorante nel Kreis 5, Kreis 8 e a Opfikon/Glattbrugg)

Questo significa che:
- L'ATTIVITA' (NA081) continua a operare normalmente
- I DEBITI (incluso il mio credito) sono rimasti nella societa' fallita
- I RESPONSABILI (Singh e famiglia) gestiscono l'attivita' senza pagare i creditori

5. L'UOMO DI PAGLIA
Milind Jagdish Bhatt appare essere stato usato come "uomo di paglia":
- E' entrato in BS Gastro esattamente quando Singh e' uscito (01.06.2021)
- TUTTE le societa' dove Bhatt e' amministratore sono fallite:
  * BS Gastro Services AG - FALLITA 24.02.2025
  * PALOM Investments AG - FALLITA 20.05.2025 e chiusa per mancanza attivi
  * O'Tabe GmbH - In liquidazione
- PALOM Investments AG aveva sede allo STESSO indirizzo delle societa' di Singh
  (Klingenstrasse 33, 8005 Zürich)

6. SCHEMA RIPETUTO
Balwinder Singh ha seguito lo stesso schema con altre societa':
- Chalet Horgen GmbH: Singh uscito nel 2020, societa' ceduta
- Zest of Asia GmbH: Singh uscito, societa' ceduta
- 70/30 Gastro AG: Singh uscito, societa' in liquidazione (04.03.2025)

7. CONSEGUENZE PENALI
I fatti sopra descritti integrano i reati di:

Art. 163 StGB (Bancarotta fraudolenta):
Singh ha trasferito l'attivita' NA081 da BS Gastro a LATOUR Holding per sottrarla
ai creditori.

Art. 164 StGB (Diminuzione attivo):
L'avviamento, la clientela, il marchio e l'attivita' operativa sono stati trasferiti
senza corrispettivo adeguato.

Art. 165 StGB (Cattiva gestione):
La societa' e' stata gestita in modo da condurla inevitabilmente al fallimento
a danno dei creditori.

RICHIESTE:
1. Avvio di un procedimento penale contro i responsabili
2. Indagine sui trasferimenti di beni da BS Gastro a LATOUR Holding e altre societa'
3. Accertamento di eventuali pagamenti preferenziali
4. Sequestro conservativo dei beni dei responsabili
5. Informazione sull'andamento del procedimento

PROVE ALLEGATE:
1. Estratto del Registro di Commercio di BS Gastro Services AG
2. Estratto del Registro di Commercio di LATOUR Holding AG
3. Stampa del sito 7030.ch (pagina "Wir sind 7030")
4. Pubblicazione SHAB del cambio CdA (01.06.2021)
5. Le mie fatture non pagate
6. Report investigativo con dettagli su tutte le societa' coinvolte

Mi dichiaro disponibile a fornire ulteriori informazioni, testimoniare e
partecipare come parte civile (Privatkläger) al procedimento.

Distinti saluti,


${datiDenunciante.nome}

---
Allegati: come sopra indicato
---

NOTA: Questa denuncia puo' essere presentata in italiano. L'autorita' provvedera'
alla traduzione se necessario. E' GRATUITA e non richiede avvocato.`;
  }

  /**
   * Genera lettera di diffida a LATOUR Holding
   */
  async generaDiffidaLatour(datiMittente: {
    nome: string;
    indirizzo: string;
    telefono: string;
    motivoCredito: string;
  }): Promise<string> {
    const dataOggi = new Date().toLocaleDateString('it-CH');
    const dataScadenza = new Date();
    dataScadenza.setDate(dataScadenza.getDate() + 30);

    return `RACCOMANDATA CON RICEVUTA DI RITORNO

${datiMittente.nome}
${datiMittente.indirizzo}
Tel: ${datiMittente.telefono}

${dataOggi}

LATOUR Holding AG
Att.ne: Sig. Balwinder Singh, Presidente del CdA
Bergstrasse 40
8702 Zollikon

E per conoscenza:
Gun + Bal GmbH - Klingenstrasse 33, 8005 Zürich
Gun + Bal Gastro AG - Klingenstrasse 33, 8005 Zürich

OGGETTO: FORMALE DIFFIDA - Richiesta pagamento debito BS Gastro Services AG
         Importo: CHF ${CASO_BS_GASTRO.importoTotale.toLocaleString('de-CH')}.00

Egregio Sig. Singh,

mi rivolgo a Lei in qualita' di creditore della societa' BS Gastro Services AG
(${CASO_BS_GASTRO.debitore.uidFallita}), dichiarata fallita dal Tribunale di Zurigo
il ${CASO_BS_GASTRO.debitore.dataFallimento}.

PREMESSA
La societa' BS Gastro Services AG, di cui Lei era membro del Consiglio di
Amministrazione fino al 01.06.2021, mi deve la somma di CHF ${CASO_BS_GASTRO.importoCapitale.toLocaleString('de-CH')}.00
per ${datiMittente.motivoCredito}, oltre a CHF ${CASO_BS_GASTRO.importoSpeseLegali.toLocaleString('de-CH')}.00 di spese legali gia' sostenute.

I FATTI A ME NOTI
Dalle mie ricerche presso i registri pubblici e dalla documentazione disponibile
online risulta che:

1. Lei ha fondato LATOUR Holding AG (${CASO_BS_GASTRO.debitore.uidNuova}) il 23.05.2019,
   mentre era ancora amministratore di BS Gastro Services AG.

2. Lei e' uscito da BS Gastro Services AG il 01.06.2021, lo stesso giorno in cui
   e' entrato Milind Jagdish Bhatt.

3. L'attivita' dei ristoranti NA081, precedentemente gestita da BS Gastro Services AG,
   ora opera sotto LATOUR Holding AG, come dichiarato pubblicamente sul sito 7030.ch:
   "Die Latour Holding AG betreibt [...] das neapolitanische NA081 Pizzeria & Ristorante"

4. BS Gastro Services AG e' fallita lasciando i creditori (tra cui il sottoscritto)
   completamente insoddisfatti.

5. Lei e Sua moglie Rupinder Kaur Singh continuate a gestire l'attivita' NA081
   attraverso LATOUR Holding AG e le societa' collegate.

LA MIA VALUTAZIONE
I fatti sopra esposti configurano, a mio avviso, i reati di cui agli articoli 163
(Bancarotta fraudolenta), 164 (Diminuzione dell'attivo) e 165 (Cattiva gestione)
del Codice Penale Svizzero, nonche' la responsabilita' personale degli organi
ai sensi dell'Art. 754 CO.

LE MIE RICHIESTE
Le chiedo formalmente di:

1. RICONOSCERE il debito di CHF ${CASO_BS_GASTRO.importoTotale.toLocaleString('de-CH')}.00 (capitale + spese)

2. PROPORRE un piano di pagamento ragionevole entro 30 giorni dalla presente

3. IN ALTERNATIVA, fissare un incontro per discutere una soluzione amichevole

TERMINE: ${dataScadenza.toLocaleDateString('it-CH')}

CONSEGUENZE IN CASO DI MANCATO RISCONTRO
In assenza di una risposta positiva entro il termine indicato, mi vedro' costretto a:

1. Presentare DENUNCIA PENALE alla Staatsanwaltschaft I del Canton Zurigo per i
   reati di cui agli articoli 163, 164 e 165 StGB

2. Agire CIVILMENTE per la responsabilita' degli organi ai sensi dell'Art. 754 CO

3. Richiedere all'Ufficio Fallimenti l'esercizio dell'AZIONE REVOCATORIA ai sensi
   degli articoli 285-288 LEF per annullare il trasferimento dell'attivita' NA081

4. Richiedere la CESSIONE DEI DIRITTI ai sensi dell'Art. 260 LEF per agire
   direttamente contro LATOUR Holding AG

5. Segnalare la situazione alle AUTORITA' FISCALI competenti

6. Rendere PUBBLICI i fatti attraverso i canali appropriati

Confido in una Sua risposta sollecita e costruttiva. Un accordo stragiudiziale
sarebbe nell'interesse di entrambe le parti.

Distinti saluti,


${datiMittente.nome}

---
Allegati:
- Riepilogo fatture non pagate
---

ISTRUZIONI PER L'INVIO:
1. Stampa questa lettera
2. Firma a mano dove indicato
3. Allega copia delle fatture
4. Invia come RACCOMANDATA CON RICEVUTA DI RITORNO (Einschreiben mit Rückschein)
5. Conserva la ricevuta come prova

Costo raccomandata: circa CHF 8-10`;
  }

  /**
   * Genera richiesta azione revocatoria
   */
  async generaRichiestaRevocatoria(datiCreditore: {
    nome: string;
    indirizzo: string;
  }): Promise<string> {
    const dataOggi = new Date().toLocaleDateString('it-CH');

    return `${datiCreditore.nome}
${datiCreditore.indirizzo}

${dataOggi}

Konkursamt Aussersihl-Zürich
Wengistrasse 7
8004 Zürich

OGGETTO: RICHIESTA DI ESERCIZIO AZIONE REVOCATORIA
         Art. 285-288 LEF
         Fallimento BS Gastro Services AG (${CASO_BS_GASTRO.debitore.uidFallita})

Egregio Ufficio Fallimenti,

in qualita' di creditore insinuato nel fallimento in oggetto, con la presente
chiedo formalmente che l'Ufficio verifichi e, se del caso, eserciti l'azione
revocatoria ai sensi degli articoli 285-288 LEF.

ELEMENTI DA VERIFICARE:

1. TRASFERIMENTO DELL'ATTIVITA' (Art. 288 LEF)
   L'attivita' dei ristoranti NA081, precedentemente gestita da BS Gastro Services AG,
   risulta ora operare sotto LATOUR Holding AG (${CASO_BS_GASTRO.debitore.uidNuova}).

   La prova e' sul sito ufficiale 7030.ch che dichiara:
   "Die Latour Holding AG betreibt [...] das neapolitanische NA081 Pizzeria & Ristorante
   im Kreis 5, Kreis 8 und in Opfikon/Glattbrugg"

   Chiedo di verificare:
   - Se e quando vi e' stato un trasferimento formale dell'attivita'
   - A quale prezzo e' stato eventualmente effettuato
   - Se il prezzo corrisponde al valore di mercato dell'avviamento

2. TEMPISTICA SOSPETTA (Art. 288 LEF)
   - LATOUR Holding AG fondata il 23.05.2019 (Singh presidente)
   - Singh uscito da BS Gastro il 01.06.2021
   - BS Gastro in liquidazione dal 09.07.2024
   - BS Gastro fallita il 24.02.2025

   Chiedo di verificare se negli ultimi 5 anni ci sono stati trasferimenti di beni,
   clientela, dipendenti o attivita' da BS Gastro a LATOUR Holding o altre societa'
   controllate da Singh.

3. PAGAMENTI PREFERENZIALI (Art. 286 LEF)
   Chiedo di verificare se nell'ultimo anno prima della liquidazione/fallimento
   ci sono stati pagamenti a favore di:
   - LATOUR Holding AG
   - Gun + Bal GmbH
   - Gun + Bal Gastro AG
   - Braclo Management AG
   - Altre societa' collegate a Balwinder Singh

4. COLLEGAMENTO TRA LE SOCIETA'
   Tutte le societa' sono riconducibili a Balwinder Singh e sua moglie Rupinder Kaur Singh:
   - LATOUR Holding AG: Singh presidente, moglie membro CdA
   - Gun + Bal GmbH: Singh CEO, moglie Geschäftsführerin
   - Gun + Bal Gastro AG: Singh presidente, moglie membro CdA

RICHIESTE:
1. Verifica dei trasferimenti sopra indicati
2. Esercizio dell'azione revocatoria se ricorrono i presupposti
3. In caso di inerzia dell'Ufficio, chiedo di essere informato per valutare
   la cessione dei diritti ai sensi dell'Art. 260 LEF

Resto a disposizione per fornire ulteriori informazioni e documentazione.

Distinti saluti,


${datiCreditore.nome}

---
Allegati:
- Stampa pagina 7030.ch "Wir sind 7030"
- Estratti registro commerciale societa' coinvolte`;
  }

  /**
   * Ottiene il prossimo passo consigliato
   */
  async getProssimoPasso(): Promise<{
    azione: string;
    descrizione: string;
    costo: number;
    tempoStimato: string;
    istruzioni: string[];
    contatti: any;
  }> {
    const passoAttuale = this.prossimiPassi.find(p =>
      !this.azioniCompletate.includes(p.nome)
    );

    if (!passoAttuale) {
      return {
        azione: 'Tutte le azioni completate',
        descrizione: 'Hai completato tutte le azioni previste. Ora attendi le risposte.',
        costo: 0,
        tempoStimato: 'Variabile',
        istruzioni: ['Monitora le risposte', 'Contatta periodicamente gli uffici'],
        contatti: CASO_BS_GASTRO.contatti
      };
    }

    let istruzioni: string[] = [];
    let contatti: any = {};

    switch (passoAttuale.nome) {
      case 'Insinuazione Credito':
        istruzioni = [
          '1. Usa il comando "genera insinuazione" per creare la lettera',
          '2. Stampa la lettera e firmala',
          '3. Allega copie delle fatture non pagate',
          '4. Invia per posta ordinaria o consegna a mano',
          '5. Conserva una copia per te'
        ];
        contatti = CASO_BS_GASTRO.contatti.ufficioFallimenti;
        break;

      case 'Denuncia Penale':
        istruzioni = [
          '1. Usa il comando "genera denuncia" per creare il documento',
          '2. Stampa tutte le prove (sito 7030.ch, registri commercio)',
          '3. Vai di persona o invia per posta alla Procura',
          '4. E\' GRATIS e puoi farlo in italiano',
          '5. Chiedi il numero di riferimento della pratica'
        ];
        contatti = CASO_BS_GASTRO.contatti.procura;
        break;

      case 'Lettera Diffida a Singh/LATOUR':
        istruzioni = [
          '1. Usa il comando "genera diffida" per creare la lettera',
          '2. Stampa e firma',
          '3. Invia come RACCOMANDATA CON RICEVUTA DI RITORNO',
          '4. Costo: circa CHF 8-10',
          '5. Aspetta 30 giorni per la risposta'
        ];
        contatti = {
          destinatario: 'LATOUR Holding AG',
          indirizzo: CASO_BS_GASTRO.debitore.sedeNuova,
          attne: 'Balwinder Singh'
        };
        break;

      default:
        istruzioni = ['Segui le istruzioni specifiche per questa azione'];
        contatti = CASO_BS_GASTRO.contatti;
    }

    return {
      azione: passoAttuale.nome,
      descrizione: passoAttuale.descrizione,
      costo: passoAttuale.costo,
      tempoStimato: `${passoAttuale.durata} giorni`,
      istruzioni,
      contatti
    };
  }

  /**
   * Segna un'azione come completata
   */
  segnaCompletata(nomeAzione: string): void {
    if (!this.azioniCompletate.includes(nomeAzione)) {
      this.azioniCompletate.push(nomeAzione);
      console.log(`✅ Azione completata: ${nomeAzione}`);
    }
  }

  /**
   * Chat interattiva
   */
  async chat(message: string): Promise<string> {
    const contextMessage = `Contesto del caso:
- Creditore: ${CASO_BS_GASTRO.creditore}
- Importo: CHF ${CASO_BS_GASTRO.importoTotale.toLocaleString('de-CH')}
- Debitore fallito: ${CASO_BS_GASTRO.debitore.societaFallita}
- Societa nuova: ${CASO_BS_GASTRO.debitore.societaNuova}
- Responsabile: ${CASO_BS_GASTRO.responsabile.nome}
- Azioni completate: ${this.azioniCompletate.join(', ') || 'Nessuna'}

Domanda: ${message}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      temperature: 0.4,
      system: this.getSystemPrompt(),
      messages: [
        ...this.conversationHistory,
        { role: 'user', content: contextMessage }
      ]
    });

    this.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: response.content }
    );

    const textContent = response.content.find(c => c.type === 'text');
    return textContent?.type === 'text' ? textContent.text : 'Nessuna risposta';
  }

  /**
   * Ottiene riepilogo stato attuale
   */
  getStatoAttuale(): {
    azioniCompletate: string[];
    azioniInCorso: string[];
    azioniDaFare: string[];
    costiSostenuti: number;
    prossimaScadenza?: string;
  } {
    const completate = this.azioniCompletate;
    const daFare = this.prossimiPassi
      .filter(p => !completate.includes(p.nome))
      .map(p => p.nome);

    return {
      azioniCompletate: completate,
      azioniInCorso: [],
      azioniDaFare: daFare,
      costiSostenuti: completate.includes('Lettera Diffida a Singh/LATOUR') ? 10 : 0,
      prossimaScadenza: undefined
    };
  }

  resetConversation(): void {
    this.conversationHistory = [];
  }
}
