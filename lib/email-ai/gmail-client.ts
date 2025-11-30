/**
 * Gmail API Client Wrapper
 *
 * Gestisce autenticazione OAuth2, fetch email, parsing e operazioni su Gmail
 */

import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { refreshAccessToken } from '@/lib/auth/google-oauth';
import { sql } from '@vercel/postgres';

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string;

  // Parsed headers
  from: { email: string; name: string };
  to: string[];
  cc?: string[];
  subject: string;
  date: Date;

  // Body
  bodyText?: string;
  bodyHtml?: string;

  // Metadata
  hasAttachments: boolean;
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;

  // Flags
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
}

export interface GmailConnectionConfig {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date;
  connectionId: string;
}

/**
 * Gmail API Client
 */
export class GmailClient {
  private oauth2Client: OAuth2Client;
  private gmail: gmail_v1.Gmail;
  private connectionId: string;
  private refreshToken?: string;

  constructor(config: GmailConnectionConfig) {
    this.connectionId = config.connectionId;
    this.refreshToken = config.refreshToken;

    // Setup OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/email-ai/auth/gmail/callback`
    );

    // Set credentials
    this.oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      expiry_date: config.tokenExpiresAt.getTime()
    });

    // Initialize Gmail API
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    // Auto-refresh token quando scade
    this.oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        console.log('[GmailClient] Token refreshed automatically');
        await this.updateTokenInDatabase(tokens.access_token, tokens.expiry_date || Date.now() + 3600 * 1000);
      }
    });
  }

  /**
   * Aggiorna access token nel database
   */
  private async updateTokenInDatabase(accessToken: string, expiryDate: number): Promise<void> {
    try {
      const expiresAt = new Date(expiryDate);
      await sql`
        UPDATE gmail_connections
        SET access_token = ${accessToken},
            token_expires_at = ${expiresAt.toISOString()},
            updated_at = NOW()
        WHERE id = ${this.connectionId}
      `;
      console.log('[GmailClient] Token updated in database');
    } catch (error) {
      console.error('[GmailClient] Error updating token:', error);
    }
  }

  /**
   * Verifica e refresh token se necessario
   */
  async ensureValidToken(): Promise<void> {
    try {
      const accessToken = await this.oauth2Client.getAccessToken();
      if (!accessToken.token) {
        console.error('[GmailClient] ❌ No valid access token found for connection:', this.connectionId);
        throw new Error('No valid access token');
      }
      console.log('[GmailClient] ✅ Access token is valid');
    } catch (error: any) {
      console.error('[GmailClient] ⚠️ Token validation failed:', error.message);

      // Token scaduto o invalido - prova refresh
      if (this.refreshToken) {
        console.log('[GmailClient] 🔄 Attempting to refresh access token...');
        try {
          const newTokens = await refreshAccessToken(this.refreshToken);
          console.log('[GmailClient] ✅ Access token refreshed successfully');

          this.oauth2Client.setCredentials({
            access_token: newTokens.access_token,
            refresh_token: this.refreshToken
          });

          const expiryDate = Date.now() + newTokens.expires_in * 1000;
          await this.updateTokenInDatabase(newTokens.access_token, expiryDate);
        } catch (refreshError: any) {
          console.error('[GmailClient] ❌ Token refresh failed:', refreshError.message);
          throw new Error(`Failed to refresh access token: ${refreshError.message}`);
        }
      } else {
        console.error('[GmailClient] ❌ No refresh token available for connection:', this.connectionId);
        throw new Error('No refresh token available - user must re-authorize');
      }
    }
  }

  /**
   * Lista messaggi Gmail
   */
  async listMessages(options: {
    maxResults?: number;
    query?: string; // Gmail search query (es: "is:unread", "from:customer@example.com")
    pageToken?: string;
  } = {}): Promise<{ messages: string[]; nextPageToken?: string }> {
    await this.ensureValidToken();

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults: options.maxResults || 10,
      q: options.query || 'is:unread', // Default: solo email non lette
      pageToken: options.pageToken
    });

    const messageIds = response.data.messages?.map(m => m.id!) || [];
    const nextPageToken = response.data.nextPageToken;

    return {
      messages: messageIds,
      nextPageToken: nextPageToken || undefined
    };
  }

  /**
   * Ottieni dettagli messaggio completo
   */
  async getMessage(messageId: string): Promise<GmailMessage> {
    await this.ensureValidToken();

    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full' // full per ottenere headers e body
    });

    const message = response.data;
    if (!message.id || !message.payload) {
      throw new Error('Invalid message response');
    }

    // Parse headers
    const headers = message.payload.headers || [];
    const getHeader = (name: string) =>
      headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const fromHeader = getHeader('from');
    const fromMatch = fromHeader.match(/(?:"?([^"]*)"?\s)?(?:<?([^>]+)>?)/);
    const fromName = fromMatch?.[1]?.trim() || '';
    const fromEmail = fromMatch?.[2]?.trim() || fromHeader;

    const toHeader = getHeader('to');
    const ccHeader = getHeader('cc');

    // Parse body
    const { bodyText, bodyHtml } = this.extractBody(message.payload);

    // Parse attachments
    const attachments = this.extractAttachments(message.payload);

    // Flags
    const labelIds = message.labelIds || [];
    const isRead = !labelIds.includes('UNREAD');
    const isStarred = labelIds.includes('STARRED');
    const isImportant = labelIds.includes('IMPORTANT');

    return {
      id: message.id,
      threadId: message.threadId || '',
      labelIds,
      snippet: message.snippet || '',
      internalDate: message.internalDate || '',

      from: {
        email: fromEmail,
        name: fromName
      },
      to: toHeader ? toHeader.split(',').map(s => s.trim()) : [],
      cc: ccHeader ? ccHeader.split(',').map(s => s.trim()) : undefined,
      subject: getHeader('subject'),
      date: new Date(parseInt(message.internalDate || '0')),

      bodyText,
      bodyHtml,

      hasAttachments: attachments.length > 0,
      attachments,

      isRead,
      isStarred,
      isImportant
    };
  }

  /**
   * Estrae body text e html dal payload
   */
  private extractBody(payload: gmail_v1.Schema$MessagePart): { bodyText?: string; bodyHtml?: string } {
    let bodyText: string | undefined;
    let bodyHtml: string | undefined;

    const findBodyPart = (part: gmail_v1.Schema$MessagePart, mimeType: string): string | undefined => {
      if (part.mimeType === mimeType && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          const found = findBodyPart(subPart, mimeType);
          if (found) return found;
        }
      }

      return undefined;
    };

    // Estrai plain text
    bodyText = findBodyPart(payload, 'text/plain');

    // Estrai HTML
    bodyHtml = findBodyPart(payload, 'text/html');

    // Fallback: se non c'è text/plain ma c'è HTML, usa snippet
    if (!bodyText && payload.body?.data) {
      bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    return { bodyText, bodyHtml };
  }

  /**
   * Estrae attachments dal payload
   */
  private extractAttachments(payload: gmail_v1.Schema$MessagePart): Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }> {
    const attachments: Array<any> = [];

    const findAttachments = (part: gmail_v1.Schema$MessagePart) => {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId
        });
      }

      if (part.parts) {
        part.parts.forEach(findAttachments);
      }
    };

    findAttachments(payload);
    return attachments;
  }

  /**
   * Modifica labels di un messaggio
   */
  async modifyLabels(
    messageId: string,
    addLabelIds: string[] = [],
    removeLabelIds: string[] = []
  ): Promise<void> {
    await this.ensureValidToken();

    await this.gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds,
        removeLabelIds
      }
    });

    console.log(`[GmailClient] Modified labels for message ${messageId}`);
  }

  /**
   * Sposta messaggio in spam
   */
  async moveToSpam(messageId: string): Promise<void> {
    await this.modifyLabels(
      messageId,
      ['SPAM'], // Aggiungi label SPAM
      ['INBOX'] // Rimuovi da INBOX
    );
    console.log(`[GmailClient] Moved message ${messageId} to SPAM`);
  }

  /**
   * Sposta messaggio in archivio (rimuove da INBOX)
   */
  async archive(messageId: string): Promise<void> {
    await this.modifyLabels(
      messageId,
      [],
      ['INBOX']
    );
    console.log(`[GmailClient] Archived message ${messageId}`);
  }

  /**
   * Marca messaggio come letto
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.modifyLabels(
      messageId,
      [],
      ['UNREAD']
    );
  }

  /**
   * Marca messaggio come non letto
   */
  async markAsUnread(messageId: string): Promise<void> {
    await this.modifyLabels(
      messageId,
      ['UNREAD'],
      []
    );
  }

  /**
   * Aggiungi/rimuovi stella
   */
  async toggleStar(messageId: string, starred: boolean): Promise<void> {
    if (starred) {
      await this.modifyLabels(messageId, ['STARRED'], []);
    } else {
      await this.modifyLabels(messageId, [], ['STARRED']);
    }
  }

  /**
   * Ottieni profilo utente Gmail
   */
  async getProfile(): Promise<{
    emailAddress: string;
    messagesTotal: number;
    threadsTotal: number;
  }> {
    await this.ensureValidToken();

    const response = await this.gmail.users.getProfile({
      userId: 'me'
    });

    return {
      emailAddress: response.data.emailAddress || '',
      messagesTotal: response.data.messagesTotal || 0,
      threadsTotal: response.data.threadsTotal || 0
    };
  }

  /**
   * Helper: Crea istanza Gmail Client da connection_id database
   */
  static async fromConnectionId(connectionId: string): Promise<GmailClient> {
    console.log('[GmailClient] Loading connection from database:', connectionId);

    const result = await sql`
      SELECT
        access_token,
        refresh_token,
        token_expires_at
      FROM gmail_connections
      WHERE id = ${connectionId}
        AND sync_enabled = true
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      console.error('[GmailClient] ❌ Connection not found or disabled:', connectionId);
      throw new Error(`Gmail connection not found or disabled: ${connectionId}`);
    }

    const connection = result.rows[0];
    const hasRefreshToken = !!connection.refresh_token;
    const tokenExpiry = new Date(connection.token_expires_at);
    const isExpired = tokenExpiry < new Date();

    console.log('[GmailClient] 📊 Connection details:', {
      connectionId,
      hasRefreshToken,
      tokenExpiry: tokenExpiry.toISOString(),
      isExpired,
      expiresIn: isExpired ? 'expired' : `${Math.round((tokenExpiry.getTime() - Date.now()) / 60000)} minutes`
    });

    if (!hasRefreshToken) {
      console.warn('[GmailClient] ⚠️ WARNING: No refresh token found! User may need to re-authorize.');
    }

    return new GmailClient({
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      tokenExpiresAt: tokenExpiry,
      connectionId
    });
  }

  /**
   * Helper: Crea istanza Gmail Client da gmail_address
   */
  static async fromGmailAddress(gmailAddress: string): Promise<GmailClient> {
    const result = await sql`
      SELECT
        id,
        access_token,
        refresh_token,
        token_expires_at
      FROM gmail_connections
      WHERE gmail_address = ${gmailAddress}
        AND sync_enabled = true
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      throw new Error(`Gmail connection not found for: ${gmailAddress}`);
    }

    const connection = result.rows[0];

    return new GmailClient({
      accessToken: connection.access_token,
      refreshToken: connection.refresh_token,
      tokenExpiresAt: new Date(connection.token_expires_at),
      connectionId: connection.id
    });
  }
}
