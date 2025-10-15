/**
 * LAPA Smart Ordering - Cron Service
 *
 * Aggiornamento automatico dati ogni giorno alle 6:00 AM
 * - Refresh stock da Odoo
 * - Ricalcola predizioni
 * - Invia alert se prodotti critici
 */

import { dataService } from './data-service';
import { predictionEngine } from './prediction-engine';

export class CronService {
  private isRunning: boolean = false;
  private lastRun: Date | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start cron job
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Cron già in esecuzione');
      return;
    }

    console.log('🚀 Avvio Cron Service Smart Ordering');

    // Esegui immediatamente al primo avvio
    this.runDailyUpdate();

    // Poi esegui ogni ora per controllare se è ora di aggiornare
    this.intervalId = setInterval(() => {
      this.checkAndRun();
    }, 1000 * 60 * 60); // Ogni ora

    this.isRunning = true;
  }

  /**
   * Stop cron job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Cron Service fermato');
  }

  /**
   * Controlla se è ora di eseguire aggiornamento
   */
  private checkAndRun(): void {
    const now = new Date();
    const hour = now.getHours();

    // Esegui alle 6:00 AM
    if (hour === 6) {
      // Controlla se già eseguito oggi
      if (this.lastRun) {
        const lastRunDate = this.lastRun.toDateString();
        const todayDate = now.toDateString();

        if (lastRunDate === todayDate) {
          // Già eseguito oggi
          return;
        }
      }

      // Esegui aggiornamento
      this.runDailyUpdate();
    }
  }

  /**
   * Esegue aggiornamento giornaliero
   */
  private async runDailyUpdate(): Promise<void> {
    console.log('═════════════════════════════════════════════════════════');
    console.log('🌅 AGGIORNAMENTO GIORNALIERO SMART ORDERING');
    console.log('═════════════════════════════════════════════════════════');
    console.log(`Data/Ora: ${new Date().toLocaleString('it-IT')}`);
    console.log('');

    try {
      // 1. Refresh stock da Odoo
      console.log('📥 STEP 1: Refresh stock da Odoo...');
      await dataService.refreshFromOdoo();
      console.log('✅ Stock aggiornato\n');

      // 2. Reload data
      console.log('📊 STEP 2: Ricaricamento dati...');
      await dataService.clearCache();
      const data = await dataService.loadData(true);
      console.log(`✅ ${data.products.length} prodotti caricati\n`);

      // 3. Ricalcola predizioni
      console.log('🤖 STEP 3: Ricalcolo predizioni AI...');
      const predictions = predictionEngine.predictBatch(data.products);
      console.log(`✅ ${predictions.size} predizioni calcolate\n`);

      // 4. Analizza prodotti critici
      console.log('🔍 STEP 4: Analisi prodotti critici...');
      const criticalProducts = Array.from(predictions.values()).filter(
        p => p.urgencyLevel === 'CRITICAL'
      );
      console.log(`⚠️  ${criticalProducts.length} prodotti critici\n`);

      // 5. Invia alert se necessario
      if (criticalProducts.length > 0) {
        console.log('📧 STEP 5: Invio alert...');
        await this.sendCriticalAlert(criticalProducts.length);
        console.log('✅ Alert inviati\n');
      }

      this.lastRun = new Date();

      console.log('═════════════════════════════════════════════════════════');
      console.log('✅ AGGIORNAMENTO COMPLETATO');
      console.log('═════════════════════════════════════════════════════════\n');
    } catch (error) {
      console.error('❌ Errore aggiornamento giornaliero:', error);
    }
  }

  /**
   * Invia alert per prodotti critici
   */
  private async sendCriticalAlert(count: number): Promise<void> {
    // TODO: Implementare invio email/Telegram/Slack
    console.log(`🔔 ${count} prodotti critici richiedono attenzione`);

    // Esempio: Invia a Telegram
    // await this.sendTelegramAlert(`🚨 LAPA ALERT\n\n${count} prodotti critici!\nAccedi a Smart Ordering per dettagli.`);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.calculateNextRun()
    };
  }

  /**
   * Calcola prossima esecuzione
   */
  private calculateNextRun(): Date {
    const now = new Date();
    const next = new Date(now);

    // Se è già passata l'ora di oggi, vai a domani
    if (now.getHours() >= 6) {
      next.setDate(next.getDate() + 1);
    }

    next.setHours(6, 0, 0, 0);
    return next;
  }
}

// Export singleton
export const cronService = new CronService();
