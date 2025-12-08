/**
 * AGENTE 1: INVESTIGATORE SOCIETARIO
 *
 * Specializzato in:
 * - Analisi struttura societaria
 * - Identificazione soci e amministratori
 * - Mappatura collegamenti tra societa
 * - Individuazione beni aggredibili
 * - Ricostruzione storico societario
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  CompanyProfile,
  Shareholder,
  Administrator,
  LinkedCompany,
  SeizableAsset,
  InvestigationRequest,
  InvestigationResult,
  AgentMessage,
  AgentReport,
  Evidence,
  DataSource
} from './types';

export class InvestigatoreSocietario {
  private anthropic: Anthropic;
  private conversationHistory: Anthropic.MessageParam[] = [];

  // Database simulato di fonti dati
  private dataSources: DataSource[] = [
    {
      nome: 'Camera di Commercio',
      tipo: 'CAMERA_COMMERCIO',
      descrizione: 'Visure camerali, bilanci depositati, cariche',
      accessoDisponibile: true,
      costoAccesso: 5,
      tempoRisposta: 'immediato'
    },
    {
      nome: 'Agenzia delle Entrate',
      tipo: 'AGENZIA_ENTRATE',
      descrizione: 'Dati fiscali, dichiarazioni, partite IVA',
      accessoDisponibile: true,
      costoAccesso: 0,
      tempoRisposta: '24-48h'
    },
    {
      nome: 'Conservatoria RR.II.',
      tipo: 'CATASTO',
      descrizione: 'Proprieta immobiliari, ipoteche, trascrizioni',
      accessoDisponibile: true,
      costoAccesso: 15,
      tempoRisposta: '2-5 giorni'
    },
    {
      nome: 'PRA',
      tipo: 'PRA',
      descrizione: 'Veicoli intestati, passaggi proprieta',
      accessoDisponibile: true,
      costoAccesso: 10,
      tempoRisposta: 'immediato'
    },
    {
      nome: 'Tribunale Fallimentare',
      tipo: 'TRIBUNALE',
      descrizione: 'Procedure concorsuali, istanze fallimento',
      accessoDisponibile: true,
      costoAccesso: 0,
      tempoRisposta: '3-7 giorni'
    }
  ];

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
  }

  /**
   * Sistema prompt specializzato per l'investigatore
   */
  private getSystemPrompt(): string {
    return `Sei un INVESTIGATORE SOCIETARIO specializzato nel recupero crediti e nell'analisi di frodi fallimentari.

Il tuo ruolo e':
1. ANALIZZARE strutture societarie per identificare:
   - Catene di controllo
   - Soci occulti o prestanome
   - Amministratori collegati ad altre societa
   - Pattern di societa "a grappolo"

2. MAPPARE i collegamenti tra societa per scoprire:
   - Trasferimenti sospetti di asset
   - Societa veicolo o schermo
   - Operazioni infragruppo anomale
   - Cessioni di ramo d'azienda pre-fallimento

3. INDIVIDUARE beni aggredibili:
   - Immobili (anche intestati a terzi collegati)
   - Veicoli
   - Conti correnti
   - Crediti verso terzi
   - Quote societarie

4. RICOSTRUIRE lo storico per evidenziare:
   - Cambi di amministratore sospetti
   - Modifiche statutarie pre-crisi
   - Trasferimenti sede (forum shopping)
   - Variazioni capitale sociale

METODOLOGIA DI INDAGINE:
- Parti sempre dalla visura camerale attuale
- Analizza i bilanci degli ultimi 3-5 anni
- Mappa tutti gli amministratori e soci
- Cerca collegamenti con altre societa
- Verifica eventuali procedure concorsuali passate
- Controlla ipoteche e trascrizioni pregiudizievoli

SEGNALI DI ALLARME (RED FLAGS):
- Societa con capitale minimo (10.000 EUR per SRL)
- Sede presso commercialista/domiciliatario
- Amministratore unico persona fisica senza altri ruoli
- Frequenti cambi di sede o oggetto sociale
- Bilanci non depositati o depositati in ritardo
- Perdite consistenti senza ricapitalizzazione
- Operazioni con parti correlate anomale

Rispondi sempre in modo strutturato, indicando:
- Fonti consultate
- Livello di certezza delle informazioni
- Necessita di ulteriori approfondimenti
- Tempistiche e costi stimati per verifiche aggiuntive`;
  }

  /**
   * Esegue un'investigazione completa su una societa
   */
  async investigaSocieta(request: InvestigationRequest): Promise<InvestigationResult> {
    console.log(`🔍 [Investigatore] Avvio investigazione su: ${request.target}`);

    const userMessage = this.buildInvestigationPrompt(request);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.3,
      system: this.getSystemPrompt(),
      messages: [
        ...this.conversationHistory,
        { role: 'user', content: userMessage }
      ]
    });

    // Salva nella history
    this.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: response.content }
    );

    // Estrai e struttura i risultati
    const textContent = response.content.find(c => c.type === 'text');
    const analysisText = textContent?.type === 'text' ? textContent.text : '';

    // Costruisci il risultato
    const result: InvestigationResult = {
      request,
      dataCompletamento: new Date(),
      profilo: await this.estraiProfiloSocieta(request.target, analysisText),
      collegamenti: await this.identificaCollegamenti(request.target, analysisText),
      fraudIndicators: [],
      beniIndividuati: await this.individuaBeni(request.target, analysisText),
      rischioComplessivo: this.calcolaRischioComplessivo(analysisText),
      sintesi: this.estraiSintesi(analysisText),
      dettagli: { rawAnalysis: analysisText }
    };

    console.log(`✅ [Investigatore] Investigazione completata. Rischio: ${result.rischioComplessivo}%`);

    return result;
  }

  /**
   * Costruisce il prompt per l'investigazione
   */
  private buildInvestigationPrompt(request: InvestigationRequest): string {
    let prompt = `RICHIESTA DI INVESTIGAZIONE SOCIETARIA

TARGET: ${request.target}
TIPO: ${request.tipo}
PROFONDITA: ${request.profonditaAnalisi}
`;

    if (request.focusAree && request.focusAree.length > 0) {
      prompt += `\nAREE DI FOCUS: ${request.focusAree.join(', ')}`;
    }

    if (request.periodoAnalisi) {
      prompt += `\nPERIODO: da ${request.periodoAnalisi.da.toISOString().split('T')[0]} a ${request.periodoAnalisi.a.toISOString().split('T')[0]}`;
    }

    prompt += `

FONTI DATI DISPONIBILI:
${this.dataSources.map(ds => `- ${ds.nome}: ${ds.descrizione} (Costo: €${ds.costoAccesso}, Tempo: ${ds.tempoRisposta})`).join('\n')}

Per favore esegui un'analisi completa e strutturata, identificando:
1. Profilo societario completo
2. Struttura proprietaria e di controllo
3. Amministratori e loro altri ruoli
4. Collegamenti con altre societa
5. Beni potenzialmente aggredibili
6. Red flags e segnali di allarme
7. Raccomandazioni per approfondimenti

Formatta la risposta in modo chiaro con sezioni separate.`;

    return prompt;
  }

  /**
   * Estrae il profilo societario dall'analisi
   */
  private async estraiProfiloSocieta(target: string, analysisText: string): Promise<CompanyProfile> {
    // In produzione, questo interrogherebbe API reali
    // Per ora, generiamo un profilo basato sull'analisi AI
    return {
      ragioneSociale: target,
      partitaIva: target.match(/\d{11}/) ? target : 'DA_VERIFICARE',
      codiceFiscale: 'DA_VERIFICARE',
      sedeLegale: 'DA_VERIFICARE',
      dataCostituzione: new Date(),
      capitaleSociale: 10000,
      formaGiuridica: 'SRL',
      soci: [],
      amministratori: [],
      statoAttivita: 'ATTIVA',
      codiceAteco: 'DA_VERIFICARE',
      descrizioneAttivita: 'DA_VERIFICARE'
    };
  }

  /**
   * Identifica collegamenti con altre societa
   */
  private async identificaCollegamenti(target: string, analysisText: string): Promise<LinkedCompany[]> {
    const collegamenti: LinkedCompany[] = [];

    // Analizza il testo per trovare menzioni di societa collegate
    const societaPattern = /societ[aà]\s+collegat[ae]|collegamento\s+con|stesso\s+amministratore|medesimo\s+socio/gi;

    if (societaPattern.test(analysisText)) {
      // Placeholder - in produzione si estraggono i dati reali
      collegamenti.push({
        societa: 'SOCIETA COLLEGATA DA VERIFICARE',
        partitaIva: 'DA_VERIFICARE',
        tipoCollegamento: 'STESSO_AMMINISTRATORE',
        descrizioneCollegamento: 'Collegamento rilevato dall\'analisi - richiede verifica',
        livelloRischio: 'MEDIO'
      });
    }

    return collegamenti;
  }

  /**
   * Individua beni potenzialmente aggredibili
   */
  private async individuaBeni(target: string, analysisText: string): Promise<SeizableAsset[]> {
    const beni: SeizableAsset[] = [];

    // Pattern per identificare menzioni di beni
    const immobiliPattern = /immobil[ei]|fabbricat[oi]|terreno|propriet[aà]/gi;
    const veicoliPattern = /veicol[oi]|auto|furgon[ei]|mezz[oi]/gi;
    const contiPattern = /conto\s+corrente|deposito|liquidit[aà]/gi;

    if (immobiliPattern.test(analysisText)) {
      beni.push({
        tipo: 'IMMOBILE',
        descrizione: 'Possibili immobili rilevati - verifica Conservatoria necessaria',
        valoreStimato: 0,
        facilePignoramento: false,
        vincoli: ['Da verificare ipoteche e trascrizioni']
      });
    }

    if (veicoliPattern.test(analysisText)) {
      beni.push({
        tipo: 'VEICOLO',
        descrizione: 'Possibili veicoli intestati - verifica PRA necessaria',
        valoreStimato: 0,
        facilePignoramento: true
      });
    }

    if (contiPattern.test(analysisText)) {
      beni.push({
        tipo: 'CONTO_CORRENTE',
        descrizione: 'Possibili conti correnti - verifica bancaria necessaria',
        valoreStimato: 0,
        facilePignoramento: true
      });
    }

    return beni;
  }

  /**
   * Calcola il rischio complessivo basato sull'analisi
   */
  private calcolaRischioComplessivo(analysisText: string): number {
    let rischio = 30; // Base

    // Red flags che aumentano il rischio
    const redFlags = [
      { pattern: /capitale\s+minim[oa]/gi, peso: 10 },
      { pattern: /sede\s+presso\s+commercialista/gi, peso: 15 },
      { pattern: /amministratore\s+unico/gi, peso: 5 },
      { pattern: /perdite?\s+consistenti?/gi, peso: 15 },
      { pattern: /bilanci?\s+non\s+depositat[oi]/gi, peso: 20 },
      { pattern: /cambio?\s+sede/gi, peso: 10 },
      { pattern: /cessione?\s+ramo/gi, peso: 25 },
      { pattern: /procedura?\s+concorsuale/gi, peso: 20 },
      { pattern: /ipotec[ah]/gi, peso: 10 },
      { pattern: /prestanome/gi, peso: 30 },
      { pattern: /fraud[ei]|truffa/gi, peso: 35 }
    ];

    for (const flag of redFlags) {
      if (flag.pattern.test(analysisText)) {
        rischio += flag.peso;
      }
    }

    return Math.min(100, rischio);
  }

  /**
   * Estrae una sintesi dall'analisi
   */
  private estraiSintesi(analysisText: string): string {
    // Cerca sezioni di sintesi o raccomandazioni
    const sintesiMatch = analysisText.match(/sintesi[:\s]*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i);
    const raccomandazioniMatch = analysisText.match(/raccomandazioni?[:\s]*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i);

    if (sintesiMatch) {
      return sintesiMatch[1].trim().substring(0, 500);
    }

    if (raccomandazioniMatch) {
      return raccomandazioniMatch[1].trim().substring(0, 500);
    }

    // Prendi le prime righe come sintesi
    return analysisText.split('\n').slice(0, 5).join('\n').substring(0, 500);
  }

  /**
   * Genera un report strutturato
   */
  async generaReport(result: InvestigationResult): Promise<AgentReport> {
    return {
      agente: 'INVESTIGATORE_SOCIETARIO',
      tipo: 'INVESTIGAZIONE',
      dataCreazione: new Date(),
      caso: result.request.target,
      contenuto: {
        profilo: result.profilo,
        collegamenti: result.collegamenti,
        beni: result.beniIndividuati,
        rischio: result.rischioComplessivo
      },
      raccomandazioni: this.generaRaccomandazioni(result),
      alertLevel: result.rischioComplessivo > 70 ? 'CRITICAL' :
                  result.rischioComplessivo > 40 ? 'WARNING' : 'INFO'
    };
  }

  /**
   * Genera raccomandazioni basate sull'investigazione
   */
  private generaRaccomandazioni(result: InvestigationResult): any[] {
    const raccomandazioni: any[] = [];

    if (result.rischioComplessivo > 70) {
      raccomandazioni.push({
        id: 'REC-001',
        priorita: 1,
        azione: 'Attivare immediatamente misure cautelari',
        motivazione: 'Alto rischio di dissipazione patrimonio',
        costoStimato: 2000
      });
    }

    if (result.collegamenti.length > 0) {
      raccomandazioni.push({
        id: 'REC-002',
        priorita: 2,
        azione: 'Estendere investigazione alle societa collegate',
        motivazione: 'Possibili trasferimenti di asset verso societa correlate',
        costoStimato: 500
      });
    }

    if (result.beniIndividuati.length > 0) {
      raccomandazioni.push({
        id: 'REC-003',
        priorita: 3,
        azione: 'Verificare stato beni presso conservatorie e PRA',
        motivazione: 'Confermare esistenza e pignorabilita dei beni identificati',
        costoStimato: 200
      });
    }

    return raccomandazioni;
  }

  /**
   * Chat interattiva con l'investigatore
   */
  async chat(message: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      temperature: 0.5,
      system: this.getSystemPrompt(),
      messages: [
        ...this.conversationHistory,
        { role: 'user', content: message }
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
   * Reset della conversazione
   */
  resetConversation(): void {
    this.conversationHistory = [];
  }
}
