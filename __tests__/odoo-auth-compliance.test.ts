/**
 * TEST DI CONFORMITÀ ODOO_AUTH_SYSTEM.md
 *
 * Questi test DEVONO passare per garantire che il codice
 * rispetti le regole di sicurezza del sistema di autenticazione.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('ODOO Authentication System Compliance', () => {

  describe('🚨 NESSUNA credenziale hardcoded', () => {
    it('lib/odoo-auth.ts NON deve contenere credenziali hardcoded', () => {
      const filePath = path.join(__dirname, '../lib/odoo-auth.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verifica che NON ci siano credenziali
      expect(content).not.toContain('paul@lapa.ch');
      expect(content).not.toContain('lapa201180');
      expect(content).not.toContain('FALLBACK_LOGIN');
      expect(content).not.toContain('FALLBACK_PASSWORD');

      // Verifica che non ci siano fallback con credenziali
      expect(content).not.toMatch(/getOdooLogin.*=.*['"].*['"]/);
      expect(content).not.toMatch(/getOdooPassword.*=.*['"].*['"]/);
    });

    it('lib/odoo/config.ts NON deve avere fallback admin/admin', () => {
      const filePath = path.join(__dirname, '../lib/odoo/config.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verifica che NON ci sia fallback admin/admin
      expect(content).not.toContain("|| 'admin'");
      expect(content).not.toContain('|| "admin"');
      expect(content).not.toContain("|| 'localhost'");
    });

    it('lib/odoo-client.ts deve essere DEPRECATO', () => {
      const filePath = path.join(__dirname, '../lib/odoo-client.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verifica che sia marcato come DEPRECATO
      expect(content).toContain('DEPRECATED');
      expect(content).toContain('NON USARE QUESTO FILE');
    });
  });

  describe('✅ Funzioni di autenticazione conformi', () => {
    it('getOdooSession deve lanciare errore se mancano cookie', () => {
      const filePath = path.join(__dirname, '../lib/odoo-auth.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verifica che lanci errore invece di usare fallback
      expect(content).toContain('throw new Error');
      expect(content).toContain('non autenticato');
    });

    it('callOdoo deve richiedere cookies come parametro', () => {
      const filePath = path.join(__dirname, '../lib/odoo-auth.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verifica firma della funzione
      expect(content).toMatch(/export.*function callOdoo.*cookies.*:/);
    });
  });

  describe('🔒 API Routes devono verificare cookie utente', () => {
    const apiDir = path.join(__dirname, '../app/api/inventory');

    it('Tutte le inventory API devono usare getOdooSession', () => {
      const routeFiles = fs.readdirSync(apiDir, { recursive: true })
        .filter((file: any) => file.endsWith('route.ts'))
        .map((file: any) => path.join(apiDir, file));

      routeFiles.forEach((filePath: string) => {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Verifica import corretto
        expect(content).toContain("from '@/lib/odoo-auth'");
        expect(content).toContain('getOdooSession');

        // Verifica uso di cookies
        expect(content).toContain('cookies()');

        // NON deve usare odoo-client deprecato
        expect(content).not.toContain("from '@/lib/odoo-client'");
      });
    });

    it('Tutte le inventory API devono gestire 401 Unauthorized', () => {
      const routeFiles = fs.readdirSync(apiDir, { recursive: true })
        .filter((file: any) => file.endsWith('route.ts'))
        .map((file: any) => path.join(apiDir, file));

      routeFiles.forEach((filePath: string) => {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Verifica gestione errore 401
        expect(content).toMatch(/status.*401|401.*status/);
        expect(content).toContain('non autenticato');
      });
    });
  });

  describe('📋 Documentazione aggiornata', () => {
    it('ODOO_AUTH_SYSTEM.md deve esistere', () => {
      const filePath = path.join(__dirname, '../ODOO_AUTH_SYSTEM.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('ODOO_AUTH_SYSTEM.md deve contenere le regole chiave', () => {
      const filePath = path.join(__dirname, '../ODOO_AUTH_SYSTEM.md');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Verifica regole fondamentali
      expect(content).toContain('NESSUN FALLBACK');
      expect(content).toContain('NESSUNA CREDENZIALE HARDCODED');
      expect(content).toContain('odoo_session_id');
      expect(content).toContain('401 Unauthorized');
    });
  });
});
