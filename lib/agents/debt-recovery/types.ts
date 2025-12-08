/**
 * DEBT RECOVERY AGENTS - Type Definitions
 * Sistema multi-agente per recupero crediti e rilevamento frodi fallimentari
 */

// ============= COMPANY INVESTIGATION TYPES =============

export interface CompanyProfile {
  // Dati base
  ragioneSociale: string;
  partitaIva: string;
  codiceFiscale: string;
  sedeLegale: string;
  dataCostituzione: Date;
  capitaleSociale: number;

  // Struttura societaria
  formaGiuridica: 'SRL' | 'SPA' | 'SRLS' | 'SAS' | 'SNC' | 'DITTA_INDIVIDUALE' | 'COOP' | 'ALTRO';
  soci: Shareholder[];
  amministratori: Administrator[];

  // Stato attuale
  statoAttivita: 'ATTIVA' | 'INATTIVA' | 'SOSPESA' | 'IN_LIQUIDAZIONE' | 'FALLITA' | 'CANCELLATA';
  codiceAteco: string;
  descrizioneAttivita: string;

  // Dati finanziari (ultimi disponibili)
  fatturato?: number;
  utile?: number;
  dipendenti?: number;
  annoRiferimento?: number;
}

export interface Shareholder {
  nome: string;
  codiceFiscale?: string;
  quotaPercentuale: number;
  dataIngresso: Date;
  tipoSocio: 'PERSONA_FISICA' | 'PERSONA_GIURIDICA';
  societaCollegate?: string[]; // Altre societa in cui e socio
}

export interface Administrator {
  nome: string;
  codiceFiscale?: string;
  carica: string;
  dataNomina: Date;
  poteri: string[];
  altreCariche?: OtherPosition[]; // Altre cariche in altre societa
}

export interface OtherPosition {
  societa: string;
  carica: string;
  periodo: string;
}

// ============= FRAUD DETECTION TYPES =============

export interface FraudIndicator {
  id: string;
  tipo: FraudType;
  gravita: 'BASSA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  descrizione: string;
  evidenze: Evidence[];
  dataRilevamento: Date;
  score: number; // 0-100
}

export type FraudType =
  | 'TRASFERIMENTO_FRAUDOLENTO'      // Asset stripping
  | 'SOCIETA_SCHERMO'                // Shell company
  | 'CESSIONE_RAMO_AZIENDA'          // Fraudulent business unit sale
  | 'SVUOTAMENTO_PATRIMONIO'         // Asset depletion
  | 'AMMINISTRATORE_PRESTANOME'      // Nominee director
  | 'CICLO_FATTURE_FALSE'            // False invoice scheme
  | 'BANCAROTTA_FRAUDOLENTA'         // Fraudulent bankruptcy
  | 'DISTRAZIONE_BENI'               // Asset diversion
  | 'PAGAMENTI_PREFERENZIALI'        // Preferential payments
  | 'OCCULTAMENTO_DOCUMENTI'         // Document concealment
  | 'OPERAZIONI_INFRAGRUPPO'         // Related party transactions
  | 'SOTTOCAPITALIZZAZIONE';         // Undercapitalization

export interface Evidence {
  tipo: 'DOCUMENTO' | 'TRANSAZIONE' | 'DICHIARAZIONE' | 'VISURA' | 'BILANCIO' | 'ALTRO';
  descrizione: string;
  fonte: string;
  dataAcquisizione: Date;
  affidabilita: 'ALTA' | 'MEDIA' | 'BASSA';
  allegato?: string; // Path o riferimento
}

export interface FraudPattern {
  nome: string;
  descrizione: string;
  indicatori: string[];
  soglia: number; // Score minimo per attivazione
  azioni: string[];
}

// ============= BANKRUPTCY ANALYSIS TYPES =============

export interface BankruptcyCase {
  // Dati procedura
  tribunale: string;
  numeroProcedura: string;
  dataFallimento: Date;
  curatore: string;

  // Societa fallita
  societa: CompanyProfile;

  // Analisi
  tipologiaFallimento: 'GENUINO' | 'SOSPETTO' | 'FRAUDOLENTO';
  motiviFallimento: string[];
  passivo: number;
  attivo: number;
  percentualeRecupero: number;

  // Red flags
  redFlags: RedFlag[];

  // Timeline sospetta
  timelineEventi: TimelineEvent[];
}

export interface RedFlag {
  tipo: string;
  descrizione: string;
  periodoRiferimento: string;
  gravita: 'BASSA' | 'MEDIA' | 'ALTA';
  documentazione: string[];
}

export interface TimelineEvent {
  data: Date;
  evento: string;
  descrizione: string;
  sospetto: boolean;
  collegamento?: string; // Collegamento ad altri eventi
}

// ============= DEBT RECOVERY TYPES =============

export interface DebtCase {
  id: string;
  creditore: string;
  debitore: CompanyProfile;

  // Dettaglio credito
  importoOriginale: number;
  importoResiduo: number;
  interessi: number;
  speseLegali: number;
  dataScadenza: Date;
  titoloCredito: 'FATTURA' | 'CONTRATTO' | 'TITOLO_ESECUTIVO' | 'DECRETO_INGIUNTIVO' | 'ALTRO';

  // Stato recupero
  stato: DebtStatus;
  strategiaCorrente?: RecoveryStrategy;
  azioniIntraprese: RecoveryAction[];

  // Analisi
  probabilitaRecupero: number; // 0-100
  tempoStimatoRecupero?: number; // giorni
  suggerimenti: string[];

  // Collegamenti
  societaCollegate: LinkedCompany[];
  beniFroibili: SeizableAsset[];
  fraudIndicators: FraudIndicator[];
}

export type DebtStatus =
  | 'NUOVO'
  | 'IN_ANALISI'
  | 'TRATTATIVA'
  | 'AZIONE_LEGALE'
  | 'ESECUZIONE'
  | 'RECUPERATO_PARZIALE'
  | 'RECUPERATO_TOTALE'
  | 'INESIGIBILE'
  | 'PRESCRITTO';

export interface RecoveryStrategy {
  tipo: 'STRAGIUDIZIALE' | 'GIUDIZIALE' | 'ESECUTIVA' | 'CONCORSUALE' | 'MISTA';
  descrizione: string;
  fasi: StrategyPhase[];
  costiStimati: number;
  tempoStimato: number; // giorni
  probabilitaSuccesso: number;
}

export interface StrategyPhase {
  ordine: number;
  nome: string;
  descrizione: string;
  durata: number; // giorni
  costo: number;
  prerequisiti: string[];
  documentazioneNecessaria: string[];
}

export interface RecoveryAction {
  id: string;
  data: Date;
  tipo: 'SOLLECITO' | 'DIFFIDA' | 'DECRETO_INGIUNTIVO' | 'PIGNORAMENTO' | 'AZIONE_REVOCATORIA' | 'COSTITUZIONE_PARTE_CIVILE' | 'ALTRO';
  descrizione: string;
  esito?: string;
  costoSostenuto: number;
  documentazione: string[];
}

export interface LinkedCompany {
  societa: string;
  partitaIva: string;
  tipoCollegamento: 'STESSO_AMMINISTRATORE' | 'STESSO_SOCIO' | 'CESSIONE_RAMO' | 'GRUPPO_SOCIETARIO' | 'OPERAZIONI_SOSPETTE';
  descrizioneCollegamento: string;
  livelloRischio: 'BASSO' | 'MEDIO' | 'ALTO';
}

export interface SeizableAsset {
  tipo: 'IMMOBILE' | 'VEICOLO' | 'CONTO_CORRENTE' | 'CREDITO' | 'QUOTA_SOCIETARIA' | 'BREVETTO' | 'MARCHIO' | 'ALTRO';
  descrizione: string;
  valoreStimato: number;
  localizzazione?: string;
  vincoli?: string[];
  facilePignoramento: boolean;
}

// ============= AGENT COMMUNICATION TYPES =============

export interface AgentMessage {
  from: DebtRecoveryAgentType;
  to: DebtRecoveryAgentType | 'ALL';
  tipo: 'RICHIESTA' | 'RISPOSTA' | 'ALERT' | 'REPORT';
  contenuto: any;
  priorita: 'BASSA' | 'NORMALE' | 'ALTA' | 'URGENTE';
  timestamp: Date;
  correlationId?: string;
}

export type DebtRecoveryAgentType =
  | 'ORCHESTRATOR'
  | 'INVESTIGATORE_SOCIETARIO'
  | 'ANALISTA_FALLIMENTI'
  | 'STRATEGA_RECUPERO';

export interface AgentReport {
  agente: DebtRecoveryAgentType;
  tipo: 'INVESTIGAZIONE' | 'ANALISI_FRODE' | 'STRATEGIA' | 'SINTESI';
  dataCreazione: Date;
  caso: string;
  contenuto: any;
  raccomandazioni: Recommendation[];
  alertLevel: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface Recommendation {
  id: string;
  priorita: number;
  azione: string;
  motivazione: string;
  termineConsigliato?: Date;
  costoStimato?: number;
  probabilitaSuccesso?: number;
}

// ============= INVESTIGATION REQUEST/RESPONSE =============

export interface InvestigationRequest {
  tipo: 'SOCIETA' | 'PERSONA' | 'TRANSAZIONE' | 'GRUPPO';
  target: string; // P.IVA, CF, o identificativo
  profonditaAnalisi: 'BASE' | 'STANDARD' | 'APPROFONDITA';
  focusAree?: ('PATRIMONIO' | 'COLLEGAMENTI' | 'STORICO' | 'FRODI')[];
  periodoAnalisi?: {
    da: Date;
    a: Date;
  };
}

export interface InvestigationResult {
  request: InvestigationRequest;
  dataCompletamento: Date;
  profilo?: CompanyProfile;
  collegamenti: LinkedCompany[];
  fraudIndicators: FraudIndicator[];
  beniIndividuati: SeizableAsset[];
  rischioComplessivo: number; // 0-100
  sintesi: string;
  dettagli: any;
}

// ============= DATABASE SOURCES =============

export interface DataSource {
  nome: string;
  tipo: 'CAMERA_COMMERCIO' | 'AGENZIA_ENTRATE' | 'CATASTO' | 'PRA' | 'TRIBUNALE' | 'BANCA_DATI_PRIVATA' | 'ALTRO';
  descrizione: string;
  accessoDisponibile: boolean;
  costoAccesso?: number;
  tempoRisposta?: string;
}

// ============= CONFIGURATION =============

export interface DebtRecoveryConfig {
  // Soglie di allerta
  soglieFrode: {
    scoreMinimoAllerta: number;
    scoreMinimoAzione: number;
  };

  // Parametri analisi
  periodoAnalisiDefault: number; // mesi
  profonditaCollegamentiMax: number; // livelli di collegamento

  // Costi stimati
  costiMedi: {
    sollecito: number;
    diffida: number;
    decretoIngiuntivo: number;
    pignoramento: number;
    azioneRevocatoria: number;
  };

  // Tempistiche
  tempisticheMedie: {
    decretoIngiuntivo: number; // giorni
    pignoramento: number;
    azioneRevocatoria: number;
  };
}
