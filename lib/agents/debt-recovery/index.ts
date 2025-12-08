/**
 * SQUADRA AGENTI RECUPERO CREDITI
 *
 * Sistema multi-agente per recupero crediti e rilevamento frodi fallimentari
 *
 * Caso: BS Gastro Services AG / LATOUR Holding AG
 * Importo: CHF 120'000
 * Responsabile: Balwinder Singh
 */

// Types
export * from './types';

// Agenti
export { InvestigatoreSocietario } from './investigatore-societario';
export { AnalistaFallimenti } from './analista-fallimenti';
export { StrategaRecupero } from './stratega-recupero';

// Orchestratore
export { OrchestratorRecupero, orchestrator, CASO } from './orchestrator-recupero';

/**
 * GUIDA RAPIDA
 *
 * Per usare il sistema:
 *
 * import { orchestrator } from './lib/agents/debt-recovery';
 *
 * // Analisi caso
 * const analisi = await orchestrator.eseguiAnalisi();
 *
 * // Piano d'azione
 * const piano = await orchestrator.getPianoAzione();
 *
 * // Generare documenti
 * const insinuazione = await orchestrator.generaDocumento('insinuazione');
 * const denuncia = await orchestrator.generaDocumento('denuncia');
 * const diffida = await orchestrator.generaDocumento('diffida');
 * const revocatoria = await orchestrator.generaDocumento('revocatoria');
 *
 * // Stato attuale
 * const stato = orchestrator.getStatoAttuale();
 *
 * // Prossimo passo
 * const prossimo = await orchestrator.getProssimoPasso();
 *
 * // Domande generiche
 * const risposta = await orchestrator.elaboraRichiesta("Come faccio a...");
 */
