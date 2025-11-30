/**
 * Crypto Utilities for Review Manager
 * Cifra/decifra le credenziali sensibili delle piattaforme
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 64;

/**
 * Ottieni la chiave di cifratura dall'environment
 * Se non esiste, genera un warning (dev) o throw error (production)
 */
function getEncryptionKey(): string {
  const key = process.env.RM_ENCRYPTION_KEY;

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RM_ENCRYPTION_KEY non configurata in production! Impossibile cifrare credenziali.');
    }

    // In development, usa una chiave di default (NON SICURA)
    console.warn('⚠️  RM_ENCRYPTION_KEY non configurata! Usando chiave di default (SOLO PER DEV)');
    return 'dev-key-not-secure-change-in-production-min-32-chars-required-for-aes256';
  }

  if (key.length < 32) {
    throw new Error('RM_ENCRYPTION_KEY deve essere lunga almeno 32 caratteri');
  }

  return key;
}

/**
 * Deriva una chiave di 32 byte dalla passphrase usando PBKDF2
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
}

/**
 * Cifra un testo sensibile
 * Ritorna: salt:iv:tag:encrypted (tutto in base64)
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;

  try {
    const passphrase = getEncryptionKey();

    // Genera salt e IV casuali
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Deriva chiave da passphrase
    const key = deriveKey(passphrase, salt);

    // Cifra
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Ottieni tag di autenticazione
    const tag = cipher.getAuthTag();

    // Ritorna: salt:iv:tag:encrypted (tutto base64)
    return [
      salt.toString('base64'),
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted
    ].join(':');
  } catch (error) {
    console.error('Errore cifratura:', error);
    throw new Error('Impossibile cifrare il dato sensibile');
  }
}

/**
 * Decifra un testo cifrato
 * Input: salt:iv:tag:encrypted (base64)
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;

  try {
    const passphrase = getEncryptionKey();

    // Parse componenti
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Formato ciphertext non valido');
    }

    const [saltB64, ivB64, tagB64, encrypted] = parts;

    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');

    // Deriva chiave
    const key = deriveKey(passphrase, salt);

    // Decifra
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Errore decifratura:', error);
    throw new Error('Impossibile decifrare il dato sensibile');
  }
}

/**
 * Genera una chiave di cifratura sicura per .env
 * Ritorna una stringa di 64 caratteri hex (32 byte)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash one-way per verificare integrità senza decifr are
 * Utile per logging/debugging senza esporre credenziali
 */
export function hashForLogging(value: string | null | undefined): string {
  if (!value) return '[null]';

  const hash = crypto.createHash('sha256').update(value).digest('hex');
  return `${hash.substring(0, 8)}...${hash.substring(hash.length - 4)}`;
}
