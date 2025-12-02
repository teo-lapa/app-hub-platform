'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ============= TRANSLATIONS =============
const translations = {
  it: {
    // Header
    title: 'Email AI Monitor',
    subtitle: 'Gmail intelligente con AI',
    settings: 'Impostazioni',
    agent: 'Agent AI',
    dashboard: 'Dashboard',

    // Connection
    connect: 'Connetti Gmail',
    connected: 'Connesso',
    disconnect: 'Disconnetti',
    fetchEmails: 'Fetch Email',
    loading: 'Caricamento...',

    // Filters
    all: 'Tutte',
    urgent: 'Urgenti',
    important: 'Importanti',
    unread: 'Non lette',
    client: 'Clienti',
    supplier: 'Fornitori',
    spam: 'Spam',

    // Email list
    noEmails: 'Nessuna email',
    changeFilter: 'Cambia filtro o fetch nuove email',
    connectToStart: 'Connetti Gmail per iniziare',
    aiWillAnalyze: 'Il sistema analizzerà le tue email con AI',

    // Email detail
    backToList: 'Lista',
    markRead: 'Segna letto',
    markUnread: 'Segna non letto',
    addStar: 'Aggiungi stella',
    removeStar: 'Rimuovi stella',
    archive: 'Archivia',
    moveToSpam: 'Sposta in Spam',
    confirmSpam: 'Spostare in spam?',

    // AI
    aiSummary: 'AI RIASSUNTO',
    generateReply: 'Genera Risposta AI',
    generate: 'Genera',
    generating: 'Generando...',
    copy: 'Copia',
    confidence: 'Confidenza',
    suggestions: 'Suggerimenti',

    // Quick replies
    acknowledge: 'Confermo ricezione',
    thankYou: 'Grazie',
    requestInfo: 'Richiedi info',
    scheduleMeeting: 'Fissiamo call',

    // Settings modal
    settingsTitle: 'Impostazioni Email AI',
    automation: 'Automazione',
    autoClassify: 'Classifica automaticamente urgenza/categoria',
    autoSummarize: 'Genera riassunti automatici',
    autoMoveSpam: 'Sposta spam automaticamente (attenzione!)',
    autoDraftReply: 'Genera bozze risposta automatiche',
    clientDomains: 'Domini Clienti (whitelist priorità alta)',
    supplierDomains: 'Domini Fornitori',
    urgentKeywords: 'Parole Chiave Urgenti',
    spamKeywords: 'Parole Chiave Spam (blacklist)',
    add: 'Aggiungi',
    cancel: 'Annulla',
    saveSettings: 'Salva Impostazioni',
    saving: 'Salvando...',
    settingsSaved: 'Impostazioni salvate!',

    // Agent modal
    agentTitle: 'Agent AI Autonomo',
    agentDescription: "L'Agent AI processa automaticamente le email applicando le regole configurate: classifica urgenza, marca clienti/fornitori, genera risposte e gestisce spam.",
    processed: 'Processate',
    replies: 'Risposte',
    urgentCount: 'Urgenti',
    activeRules: 'Regole Attive',
    ruleClientDomains: 'Marca email da domini clienti come "importante"',
    ruleSupplierDomains: 'Marca email da domini fornitori',
    ruleUrgentKeywords: 'Rileva email urgenti da keywords',
    ruleAutoSpam: 'Auto-sposta spam',
    ruleAutoReply: 'Genera risposte per clienti',
    runAgent: 'Esegui Agent su tutte le email',
    agentRunning: 'Agent in esecuzione...',
    agentNote: "L'agent processerà le ultime 100 email non archiviate",

    // Errors
    tokenExpired: 'Token Gmail Scaduto',
    reconnect: 'Riconnetti',
    errorAction: "Errore nell'esecuzione azione",
    errorGenerate: 'Errore generazione risposta',
    errorSave: 'Errore nel salvataggio',
    errorAgent: 'Errore agent',

    // Badges
    clientBadge: 'Cliente',
    supplierBadge: 'Fornitore',

    // Send Email
    sendEmail: 'Invia Email',
    sending: 'Invio in corso...',
    emailSent: 'Email inviata con successo!',
    errorSend: "Errore nell'invio email",
    editReply: 'Modifica risposta prima di inviare',
    confirmSend: 'Vuoi inviare questa email?',

    // Sync
    sync: 'Sincronizza',
    syncing: 'Sincronizzando...',
    syncComplete: 'Sincronizzazione completata',
    syncRemoved: 'email rimosse (archiviate/risposte)',
    syncUpdated: 'email aggiornate',
    syncTooltip: 'Sincronizza con Gmail (archivia email lette/risposte)',
  },
  en: {
    // Header
    title: 'Email AI Monitor',
    subtitle: 'Smart Gmail with AI',
    settings: 'Settings',
    agent: 'AI Agent',
    dashboard: 'Dashboard',

    // Connection
    connect: 'Connect Gmail',
    connected: 'Connected',
    disconnect: 'Disconnect',
    fetchEmails: 'Fetch Emails',
    loading: 'Loading...',

    // Filters
    all: 'All',
    urgent: 'Urgent',
    important: 'Important',
    unread: 'Unread',
    client: 'Clients',
    supplier: 'Suppliers',
    spam: 'Spam',

    // Email list
    noEmails: 'No emails',
    changeFilter: 'Change filter or fetch new emails',
    connectToStart: 'Connect Gmail to start',
    aiWillAnalyze: 'The system will analyze your emails with AI',

    // Email detail
    backToList: 'List',
    markRead: 'Mark as read',
    markUnread: 'Mark as unread',
    addStar: 'Add star',
    removeStar: 'Remove star',
    archive: 'Archive',
    moveToSpam: 'Move to Spam',
    confirmSpam: 'Move to spam?',

    // AI
    aiSummary: 'AI SUMMARY',
    generateReply: 'Generate AI Reply',
    generate: 'Generate',
    generating: 'Generating...',
    copy: 'Copy',
    confidence: 'Confidence',
    suggestions: 'Suggestions',

    // Quick replies
    acknowledge: 'Acknowledge receipt',
    thankYou: 'Thank you',
    requestInfo: 'Request info',
    scheduleMeeting: 'Schedule call',

    // Settings modal
    settingsTitle: 'Email AI Settings',
    automation: 'Automation',
    autoClassify: 'Auto-classify urgency/category',
    autoSummarize: 'Generate automatic summaries',
    autoMoveSpam: 'Auto-move spam (caution!)',
    autoDraftReply: 'Auto-generate reply drafts',
    clientDomains: 'Client Domains (high priority whitelist)',
    supplierDomains: 'Supplier Domains',
    urgentKeywords: 'Urgent Keywords',
    spamKeywords: 'Spam Keywords (blacklist)',
    add: 'Add',
    cancel: 'Cancel',
    saveSettings: 'Save Settings',
    saving: 'Saving...',
    settingsSaved: 'Settings saved!',

    // Agent modal
    agentTitle: 'Autonomous AI Agent',
    agentDescription: 'The AI Agent automatically processes emails applying configured rules: classifies urgency, marks clients/suppliers, generates replies and manages spam.',
    processed: 'Processed',
    replies: 'Replies',
    urgentCount: 'Urgent',
    activeRules: 'Active Rules',
    ruleClientDomains: 'Mark client domain emails as "important"',
    ruleSupplierDomains: 'Mark supplier domain emails',
    ruleUrgentKeywords: 'Detect urgent emails by keywords',
    ruleAutoSpam: 'Auto-move spam',
    ruleAutoReply: 'Generate replies for clients',
    runAgent: 'Run Agent on all emails',
    agentRunning: 'Agent running...',
    agentNote: 'The agent will process the last 100 non-archived emails',

    // Errors
    tokenExpired: 'Gmail Token Expired',
    reconnect: 'Reconnect',
    errorAction: 'Error executing action',
    errorGenerate: 'Error generating reply',
    errorSave: 'Error saving',
    errorAgent: 'Agent error',

    // Badges
    clientBadge: 'Client',
    supplierBadge: 'Supplier',

    // Send Email
    sendEmail: 'Send Email',
    sending: 'Sending...',
    emailSent: 'Email sent successfully!',
    errorSend: 'Error sending email',
    editReply: 'Edit reply before sending',
    confirmSend: 'Do you want to send this email?',

    // Sync
    sync: 'Sync',
    syncing: 'Syncing...',
    syncComplete: 'Sync completed',
    syncRemoved: 'emails removed (archived/replied)',
    syncUpdated: 'emails updated',
    syncTooltip: 'Sync with Gmail (archive read/replied emails)',
  },
  de: {
    // Header
    title: 'Email AI Monitor',
    subtitle: 'Intelligentes Gmail mit KI',
    settings: 'Einstellungen',
    agent: 'KI-Agent',
    dashboard: 'Dashboard',

    // Connection
    connect: 'Gmail verbinden',
    connected: 'Verbunden',
    disconnect: 'Trennen',
    fetchEmails: 'E-Mails abrufen',
    loading: 'Laden...',

    // Filters
    all: 'Alle',
    urgent: 'Dringend',
    important: 'Wichtig',
    unread: 'Ungelesen',
    client: 'Kunden',
    supplier: 'Lieferanten',
    spam: 'Spam',

    // Email list
    noEmails: 'Keine E-Mails',
    changeFilter: 'Filter ändern oder neue E-Mails abrufen',
    connectToStart: 'Gmail verbinden um zu starten',
    aiWillAnalyze: 'Das System analysiert Ihre E-Mails mit KI',

    // Email detail
    backToList: 'Liste',
    markRead: 'Als gelesen markieren',
    markUnread: 'Als ungelesen markieren',
    addStar: 'Stern hinzufügen',
    removeStar: 'Stern entfernen',
    archive: 'Archivieren',
    moveToSpam: 'In Spam verschieben',
    confirmSpam: 'In Spam verschieben?',

    // AI
    aiSummary: 'KI-ZUSAMMENFASSUNG',
    generateReply: 'KI-Antwort generieren',
    generate: 'Generieren',
    generating: 'Generiere...',
    copy: 'Kopieren',
    confidence: 'Konfidenz',
    suggestions: 'Vorschläge',

    // Quick replies
    acknowledge: 'Empfang bestätigen',
    thankYou: 'Danke',
    requestInfo: 'Info anfordern',
    scheduleMeeting: 'Anruf planen',

    // Settings modal
    settingsTitle: 'Email AI Einstellungen',
    automation: 'Automatisierung',
    autoClassify: 'Dringlichkeit/Kategorie automatisch klassifizieren',
    autoSummarize: 'Automatische Zusammenfassungen generieren',
    autoMoveSpam: 'Spam automatisch verschieben (Vorsicht!)',
    autoDraftReply: 'Antwortentwürfe automatisch generieren',
    clientDomains: 'Kunden-Domains (hohe Priorität)',
    supplierDomains: 'Lieferanten-Domains',
    urgentKeywords: 'Dringende Schlüsselwörter',
    spamKeywords: 'Spam-Schlüsselwörter (Blacklist)',
    add: 'Hinzufügen',
    cancel: 'Abbrechen',
    saveSettings: 'Einstellungen speichern',
    saving: 'Speichere...',
    settingsSaved: 'Einstellungen gespeichert!',

    // Agent modal
    agentTitle: 'Autonomer KI-Agent',
    agentDescription: 'Der KI-Agent verarbeitet E-Mails automatisch nach konfigurierten Regeln: klassifiziert Dringlichkeit, markiert Kunden/Lieferanten, generiert Antworten und verwaltet Spam.',
    processed: 'Verarbeitet',
    replies: 'Antworten',
    urgentCount: 'Dringend',
    activeRules: 'Aktive Regeln',
    ruleClientDomains: 'Kunden-E-Mails als "wichtig" markieren',
    ruleSupplierDomains: 'Lieferanten-E-Mails markieren',
    ruleUrgentKeywords: 'Dringende E-Mails anhand von Schlüsselwörtern erkennen',
    ruleAutoSpam: 'Spam automatisch verschieben',
    ruleAutoReply: 'Antworten für Kunden generieren',
    runAgent: 'Agent auf alle E-Mails ausführen',
    agentRunning: 'Agent läuft...',
    agentNote: 'Der Agent verarbeitet die letzten 100 nicht archivierten E-Mails',

    // Errors
    tokenExpired: 'Gmail-Token abgelaufen',
    reconnect: 'Neu verbinden',
    errorAction: 'Fehler bei der Ausführung',
    errorGenerate: 'Fehler beim Generieren der Antwort',
    errorSave: 'Fehler beim Speichern',
    errorAgent: 'Agent-Fehler',

    // Badges
    clientBadge: 'Kunde',
    supplierBadge: 'Lieferant',

    // Send Email
    sendEmail: 'E-Mail senden',
    sending: 'Wird gesendet...',
    emailSent: 'E-Mail erfolgreich gesendet!',
    errorSend: 'Fehler beim Senden',
    editReply: 'Antwort vor dem Senden bearbeiten',
    confirmSend: 'Möchten Sie diese E-Mail senden?',

    // Sync
    sync: 'Synchronisieren',
    syncing: 'Synchronisiere...',
    syncComplete: 'Synchronisierung abgeschlossen',
    syncRemoved: 'E-Mails entfernt (archiviert/beantwortet)',
    syncUpdated: 'E-Mails aktualisiert',
    syncTooltip: 'Mit Gmail synchronisieren (gelesene/beantwortete E-Mails archivieren)',
  }
};

type Language = 'it' | 'en' | 'de';

interface Email {
  id: string;
  gmail_message_id: string;
  sender_email: string;
  sender_name: string | null;
  subject: string;
  snippet: string;
  body_text?: string;
  ai_summary: string | null;
  ai_draft_reply?: string | null;
  urgency_level: 'urgent' | 'important' | 'normal' | 'low';
  is_spam: boolean;
  is_client: boolean;
  is_supplier: boolean;
  is_read: boolean;
  is_starred: boolean;
  email_category: string;
  ai_sentiment: string;
  ai_keywords: string[];
  user_tags: string[];
  received_date: string;
  has_attachments: boolean;
}

interface Settings {
  client_domains: string[];
  supplier_domains: string[];
  urgent_keywords: string[];
  spam_keywords: string[];
  auto_classify: boolean;
  auto_summarize: boolean;
  auto_move_spam: boolean;
  auto_draft_reply: boolean;
}

interface ReplyDraft {
  draftReply: string;
  tone: string;
  suggestions: string[];
  confidence: number;
}

export default function EmailAIMonitorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Core state
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingNew, setFetchingNew] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [connectionId, setConnectionId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [requiresReauth, setRequiresReauth] = useState(false);
  const [authError, setAuthError] = useState<string>('');

  // UI State
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAgent, setShowAgent] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Settings State
  const [settings, setSettings] = useState<Settings>({
    client_domains: [],
    supplier_domains: [],
    urgent_keywords: ['urgente', 'fattura', 'pagamento', 'scadenza'],
    spam_keywords: ['offerta', 'promozione', 'sconto', 'newsletter'],
    auto_classify: true,
    auto_summarize: true,
    auto_move_spam: false,
    auto_draft_reply: false
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  // Reply State
  const [generatingReply, setGeneratingReply] = useState(false);
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);
  const [editableReply, setEditableReply] = useState<string>('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Agent State
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentStats, setAgentStats] = useState<any>(null);

  // Sync State
  const [syncing, setSyncing] = useState(false);

  // Language State
  const [lang, setLang] = useState<Language>('it');
  const t = translations[lang];

  // ============= INIT =============
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (success === 'gmail_connected') {
      alert('Gmail connesso con successo!');
      window.history.replaceState({}, '', '/email-ai-monitor');
      setTimeout(() => checkConnection(), 100);
      return;
    }

    if (error === 'refresh_token_missing') {
      const errorMsg = message || 'Devi prima revocare l\'accesso a questa app su Google e poi riconnetterti.';
      alert(`AZIONE RICHIESTA:\n\n${decodeURIComponent(errorMsg)}\n\n1. Vai su https://myaccount.google.com/permissions\n2. Trova "App Hub Platform" e clicca "Rimuovi accesso"\n3. Torna qui e clicca "Connetti Gmail"`);
      window.history.replaceState({}, '', '/email-ai-monitor');
      return;
    }

    if (error) {
      const errorMsg = message ? decodeURIComponent(message) : error;
      alert(`Errore: ${errorMsg}`);
      window.history.replaceState({}, '', '/email-ai-monitor');
    }

    checkConnection();
  }, [searchParams]);

  // Auto-sync on initial load, then fetch
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  useEffect(() => {
    const loadEmails = async () => {
      if (!connectionId) return;

      // Do sync only on initial load (not on filter change)
      if (!initialSyncDone) {
        try {
          setSyncing(true);
          const syncResponse = await fetch('/api/email-ai/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId })
          });
          await syncResponse.json();
          setInitialSyncDone(true);
        } catch (e) {
          console.error('Initial sync failed:', e);
        } finally {
          setSyncing(false);
        }
      }

      fetchEmails();
      fetchSettings();
    };

    loadEmails();
  }, [filter, connectionId]);

  // ============= CONNECTION =============
  const checkConnection = async () => {
    try {
      const match = document.cookie.match(/(?:^|;\s*)gmail_connection_id=([^;]*)/);
      if (match && match[1]) {
        const id = decodeURIComponent(match[1]);
        setConnectionId(id);
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const connectGmail = () => {
    window.location.href = '/api/email-ai/auth/gmail';
  };

  const disconnectGmail = async () => {
    if (!confirm('Sei sicuro di voler disconnettere Gmail?')) return;

    try {
      await fetch('/api/email-ai/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId })
      });

      setConnectionId('');
      setIsConnected(false);
      setEmails([]);
    } catch (error) {
      alert('Errore durante disconnessione');
    }
  };

  // ============= FETCH EMAILS =============
  const fetchEmails = async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/email-ai/inbox?connectionId=${connectionId}&filter=${filter}&limit=50`
      );
      const data = await response.json();
      setEmails(data.emails || []);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNewEmails = async () => {
    if (!connectionId) return;
    setFetchingNew(true);
    setRequiresReauth(false);
    setAuthError('');

    try {
      const response = await fetch('/api/email-ai/fetch-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          maxResults: 20,
          query: 'is:unread'
        })
      });

      const data = await response.json();

      if (response.status === 401 && data.requiresReauth) {
        setRequiresReauth(true);
        setAuthError(data.error || 'Token Gmail scaduto');
        return;
      }

      if (!response.ok) throw new Error(data.error);

      alert(`Processate ${data.processed} nuove email!`);
      fetchEmails();
    } catch (error: any) {
      alert(`Errore: ${error.message}`);
    } finally {
      setFetchingNew(false);
    }
  };

  // ============= SETTINGS =============
  const fetchSettings = async () => {
    if (!connectionId) return;
    try {
      const response = await fetch(`/api/email-ai/settings?connectionId=${connectionId}`);
      const data = await response.json();
      if (data.settings) {
        setSettings({
          client_domains: data.settings.client_domains || [],
          supplier_domains: data.settings.supplier_domains || [],
          urgent_keywords: data.settings.urgent_keywords || [],
          spam_keywords: data.settings.spam_keywords || [],
          auto_classify: data.settings.auto_classify ?? true,
          auto_summarize: data.settings.auto_summarize ?? true,
          auto_move_spam: data.settings.auto_move_spam ?? false,
          auto_draft_reply: data.settings.auto_draft_reply ?? false
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await fetch('/api/email-ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          clientDomains: settings.client_domains,
          supplierDomains: settings.supplier_domains,
          urgentKeywords: settings.urgent_keywords,
          spamKeywords: settings.spam_keywords,
          autoClassify: settings.auto_classify,
          autoSummarize: settings.auto_summarize,
          autoMoveSpam: settings.auto_move_spam,
          autoDraftReply: settings.auto_draft_reply
        })
      });

      if (!response.ok) throw new Error('Failed to save settings');
      alert('Impostazioni salvate!');
    } catch (error) {
      alert('Errore nel salvataggio');
    } finally {
      setSettingsLoading(false);
    }
  };

  const addToList = (list: keyof Settings, value: string) => {
    if (!value.trim()) return;
    const currentList = settings[list] as string[];
    if (!currentList.includes(value.trim())) {
      setSettings({
        ...settings,
        [list]: [...currentList, value.trim()]
      });
    }
    setNewDomain('');
    setNewKeyword('');
  };

  const removeFromList = (list: keyof Settings, value: string) => {
    const currentList = settings[list] as string[];
    setSettings({
      ...settings,
      [list]: currentList.filter(item => item !== value)
    });
  };

  // ============= QUICK ACTIONS =============
  const executeAction = async (emailId: string, action: string, extra?: any) => {
    setActionLoading(`${emailId}-${action}`);
    try {
      const response = await fetch('/api/email-ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          emailId,
          action,
          ...extra
        })
      });

      if (!response.ok) throw new Error('Action failed');

      // Update local state
      if (action === 'archive' || action === 'moveToSpam') {
        // Rimuovi email dalla lista immediatamente
        setEmails(prev => prev.filter(e => e.id !== emailId));
        // Deseleziona se era selezionata
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(null);
        }
      } else {
        // Aggiorna stato locale per altre azioni
        setEmails(prev => prev.map(e => {
          if (e.id !== emailId) return e;

          switch (action) {
            case 'markRead': return { ...e, is_read: true };
            case 'markUnread': return { ...e, is_read: false };
            case 'star': return { ...e, is_starred: true };
            case 'unstar': return { ...e, is_starred: false };
            default: return e;
          }
        }));

        // Aggiorna anche selectedEmail se è quella modificata
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(prev => {
            if (!prev) return null;
            switch (action) {
              case 'markRead': return { ...prev, is_read: true };
              case 'markUnread': return { ...prev, is_read: false };
              case 'star': return { ...prev, is_starred: true };
              case 'unstar': return { ...prev, is_starred: false };
              default: return prev;
            }
          });
        }
      }
    } catch (error) {
      alert('Errore nell\'esecuzione azione');
    } finally {
      setActionLoading(null);
    }
  };

  // ============= AI REPLY =============
  const generateReply = async (email: Email) => {
    setGeneratingReply(true);
    setReplyDraft(null);

    try {
      const response = await fetch('/api/email-ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: email.id })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setReplyDraft(data.reply);
      setEditableReply(data.reply.draftReply);
    } catch (error: any) {
      alert(`Errore generazione risposta: ${error.message}`);
    } finally {
      setGeneratingReply(false);
    }
  };

  const generateQuickReply = async (email: Email, type: string) => {
    setGeneratingReply(true);
    try {
      const response = await fetch('/api/email-ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: email.id,
          quickReplyType: type
        })
      });

      const data = await response.json();
      if (data.reply) {
        setReplyDraft(data.reply);
        setEditableReply(data.reply.draftReply);
      }
    } catch (error) {
      alert('Errore generazione risposta rapida');
    } finally {
      setGeneratingReply(false);
    }
  };

  // ============= SEND EMAIL =============
  const sendEmail = async (email: Email) => {
    if (!editableReply.trim()) {
      alert(t.editReply);
      return;
    }

    if (!confirm(t.confirmSend)) return;

    setSendingEmail(true);
    try {
      const response = await fetch('/api/email-ai/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          emailId: email.id,
          to: email.sender_email,
          subject: email.subject,
          body: editableReply,
          isReply: true
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || data.details);

      alert(t.emailSent);
      setEditableReply('');
      setReplyDraft(null);

      // Rimuovi email dalla lista dopo risposta (opzionale - archivia)
      setEmails(prev => prev.filter(e => e.id !== email.id));
      setSelectedEmail(null);
    } catch (error: any) {
      alert(`${t.errorSend}: ${error.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

  // ============= SYNC =============
  const syncEmails = async () => {
    if (!connectionId || syncing) return;
    setSyncing(true);
    try {
      const response = await fetch('/api/email-ai/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.requiresReauth) {
          alert(t.tokenExpired || 'Token expired, please reconnect');
          return;
        }
        throw new Error(data.error || 'Sync failed');
      }

      // Se ci sono cambiamenti, aggiorna la lista
      if (data.removed > 0 || data.updated > 0) {
        await fetchEmails();
      }

      // Mostra risultato
      if (data.removed > 0 || data.replied > 0) {
        console.log(`[SYNC] ${t.syncRemoved}: ${data.removed}, ${t.syncUpdated}: ${data.updated}`);
      }
    } catch (error: any) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  // ============= AGENT =============
  const runAgent = async () => {
    setAgentRunning(true);
    try {
      const response = await fetch('/api/email-ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          processAll: true
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      alert(`Agent completato!\n\nEmail processate: ${data.summary?.total || 0}\nRegole applicate: ${data.summary?.rulesMatched || 0}\nRisposte generate: ${data.summary?.repliesGenerated || 0}`);

      fetchEmails();
      fetchAgentStats();
    } catch (error: any) {
      alert(`Errore agent: ${error.message}`);
    } finally {
      setAgentRunning(false);
    }
  };

  const fetchAgentStats = async () => {
    if (!connectionId) return;
    try {
      const response = await fetch(`/api/email-ai/agent?connectionId=${connectionId}&action=stats`);
      const data = await response.json();
      if (data.stats) {
        setAgentStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching agent stats:', error);
    }
  };

  useEffect(() => {
    if (showAgent && connectionId) {
      fetchAgentStats();
    }
  }, [showAgent, connectionId]);

  // ============= HELPERS =============
  const getUrgencyBadge = (urgency: string) => {
    const badges: Record<string, string> = {
      urgent: 'bg-red-500 text-white',
      important: 'bg-orange-500 text-white',
      normal: 'bg-blue-500 text-white',
      low: 'bg-gray-400 text-white'
    };
    return badges[urgency] || badges.normal;
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      sales: '💼', support: '🆘', invoice: '💸', order: '📦',
      delivery: '🚚', marketing: '📢', newsletter: '📰',
      notification: '🔔', other: '📧'
    };
    return icons[category] || icons.other;
  };

  // ============= RENDER =============
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span>📧</span> {t.title}
              </h1>
              <p className="text-gray-400 text-sm">{t.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Language Selector */}
              <div className="flex bg-white/10 rounded-lg overflow-hidden">
                {(['it', 'en', 'de'] as Language[]).map(l => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-2 py-1 text-xs font-bold transition ${
                      lang === l ? 'bg-blue-500 text-white' : 'hover:bg-white/10'
                    }`}
                  >
                    {l === 'it' ? '🇮🇹' : l === 'en' ? '🇬🇧' : '🇩🇪'}
                  </button>
                ))}
              </div>

              {isConnected && (
                <>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition flex items-center gap-2"
                  >
                    <span>⚙️</span> {t.settings}
                  </button>
                  <button
                    onClick={() => setShowAgent(true)}
                    className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500 rounded-lg font-medium transition flex items-center gap-2"
                  >
                    <span>🤖</span> {t.agent}
                  </button>
                </>
              )}
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition"
              >
                ← {t.dashboard}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Reauth Warning */}
        {requiresReauth && (
          <div className="mb-6 bg-red-500/20 border-2 border-red-500 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-red-300">{t.tokenExpired}</h3>
                <p className="text-sm text-gray-300">{authError}</p>
              </div>
              <button
                onClick={connectGmail}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-bold"
              >
                {t.reconnect}
              </button>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!isConnected ? (
              <button
                onClick={connectGmail}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold"
              >
                🔗 {t.connect}
              </button>
            ) : (
              <>
                <div className="px-3 py-1.5 bg-green-500/20 border border-green-500 rounded-lg text-sm">
                  ✅ {t.connected}
                </div>
                <button
                  onClick={fetchNewEmails}
                  disabled={fetchingNew}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 rounded-lg font-medium transition"
                >
                  {fetchingNew ? `⏳ ${t.loading}` : `🔄 ${t.fetchEmails}`}
                </button>
                <button
                  onClick={syncEmails}
                  disabled={syncing}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-600 rounded-lg font-medium transition"
                  title={t.syncTooltip || 'Sync with Gmail'}
                >
                  {syncing ? `⏳ ${t.syncing}` : `🔄 ${t.sync}`}
                </button>
                <button
                  onClick={disconnectGmail}
                  className="px-3 py-1.5 bg-red-500/20 border border-red-500 hover:bg-red-500/30 rounded-lg text-sm text-red-300"
                >
                  {t.disconnect}
                </button>
              </>
            )}
          </div>

          {/* Filters */}
          {isConnected && (
            <div className="flex flex-wrap gap-1">
              {(['all', 'urgent', 'important', 'unread', 'client', 'supplier', 'spam'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filter === f
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {t[f]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Email List */}
          <div className={`flex-1 ${selectedEmail ? 'hidden lg:block lg:w-1/2' : ''}`}>
            {loading ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">⏳</div>
                <div>{t.loading}</div>
              </div>
            ) : !isConnected ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">📧</div>
                <div className="text-xl mb-2">{t.connectToStart}</div>
                <p className="text-gray-400 text-sm">{t.aiWillAnalyze}</p>
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">✅</div>
                <div className="text-xl mb-2">{t.noEmails}</div>
                <p className="text-gray-400 text-sm">{t.changeFilter}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {emails.map(email => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:bg-white/15 transition cursor-pointer ${
                      selectedEmail?.id === email.id ? 'ring-2 ring-blue-500' : ''
                    } ${!email.is_read ? 'border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span>{getCategoryIcon(email.email_category)}</span>
                          <span className={`font-medium truncate ${!email.is_read ? 'font-bold' : ''}`}>
                            {email.sender_name || email.sender_email}
                          </span>
                          {email.is_starred && <span>⭐</span>}
                        </div>
                        <div className={`text-sm truncate ${!email.is_read ? 'font-semibold' : 'text-gray-300'}`}>
                          {email.subject}
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-1">
                          {email.ai_summary || email.snippet}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getUrgencyBadge(email.urgency_level)}`}>
                          {email.urgency_level.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(email.received_date).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </div>

                    {/* Quick Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {email.is_client && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-xs">{t.clientBadge}</span>
                      )}
                      {email.is_supplier && (
                        <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">{t.supplierBadge}</span>
                      )}
                      {email.has_attachments && (
                        <span className="px-1.5 py-0.5 bg-gray-500/20 text-gray-300 rounded text-xs">📎</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email Detail */}
          {selectedEmail && (
            <div className="flex-1 lg:w-1/2 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
              {/* Detail Header */}
              <div className="p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="lg:hidden px-3 py-1 bg-white/10 rounded text-sm"
                  >
                    ← {t.backToList}
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => executeAction(selectedEmail.id, selectedEmail.is_read ? 'markUnread' : 'markRead')}
                      disabled={actionLoading === `${selectedEmail.id}-markRead`}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded transition"
                      title={selectedEmail.is_read ? t.markUnread : t.markRead}
                    >
                      {selectedEmail.is_read ? '📭' : '📬'}
                    </button>
                    <button
                      onClick={() => executeAction(selectedEmail.id, selectedEmail.is_starred ? 'unstar' : 'star')}
                      disabled={actionLoading?.startsWith(selectedEmail.id)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded transition"
                      title={selectedEmail.is_starred ? t.removeStar : t.addStar}
                    >
                      {selectedEmail.is_starred ? '⭐' : '☆'}
                    </button>
                    <button
                      onClick={() => executeAction(selectedEmail.id, 'archive')}
                      disabled={actionLoading?.startsWith(selectedEmail.id)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded transition"
                      title={t.archive}
                    >
                      📥
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t.confirmSpam)) {
                          executeAction(selectedEmail.id, 'moveToSpam');
                        }
                      }}
                      disabled={actionLoading?.startsWith(selectedEmail.id)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded transition"
                      title={t.moveToSpam}
                    >
                      🚫
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-lg">
                    {(selectedEmail.sender_name || selectedEmail.sender_email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">{selectedEmail.sender_name || selectedEmail.sender_email}</div>
                    <div className="text-sm text-gray-400">{selectedEmail.sender_email}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getUrgencyBadge(selectedEmail.urgency_level)}`}>
                    {selectedEmail.urgency_level.toUpperCase()}
                  </span>
                </div>

                <h2 className="text-lg font-semibold mt-3">{selectedEmail.subject}</h2>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(selectedEmail.received_date).toLocaleString('it-IT')}
                </div>
              </div>

              {/* AI Summary */}
              {selectedEmail.ai_summary && (
                <div className="p-3 bg-blue-500/10 border-b border-white/10">
                  <div className="text-xs text-blue-300 font-bold mb-1">✨ {t.aiSummary}</div>
                  <div className="text-sm">{selectedEmail.ai_summary}</div>
                </div>
              )}

              {/* Email Body */}
              <div className="p-4 max-h-[300px] overflow-y-auto">
                <div className="text-sm whitespace-pre-wrap">
                  {selectedEmail.body_text || selectedEmail.snippet}
                </div>
              </div>

              {/* AI Reply Section */}
              <div className="p-4 border-t border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">🤖 {t.generateReply}</h3>
                  <button
                    onClick={() => generateReply(selectedEmail)}
                    disabled={generatingReply}
                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 rounded text-sm font-medium"
                  >
                    {generatingReply ? `⏳ ${t.generating}` : `✨ ${t.generate}`}
                  </button>
                </div>

                {/* Quick Reply Buttons */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {[
                    { type: 'acknowledge', label: t.acknowledge },
                    { type: 'thank_you', label: t.thankYou },
                    { type: 'more_info', label: t.requestInfo },
                    { type: 'schedule_meeting', label: t.scheduleMeeting }
                  ].map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => generateQuickReply(selectedEmail, type)}
                      disabled={generatingReply}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Reply Draft - Editable */}
                {replyDraft && (
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                          {replyDraft.tone}
                        </span>
                        <span className="text-xs text-gray-400">
                          {t.confidence}: {replyDraft.confidence}%
                        </span>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(editableReply)}
                        className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded"
                      >
                        📋 {t.copy}
                      </button>
                    </div>

                    {/* Editable Textarea */}
                    <textarea
                      value={editableReply}
                      onChange={(e) => setEditableReply(e.target.value)}
                      className="w-full h-32 bg-black/30 rounded p-3 text-sm resize-none border border-white/20 focus:border-blue-500 focus:outline-none"
                      placeholder={t.editReply}
                    />

                    {/* Send Button */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-xs text-gray-400">
                        A: {selectedEmail.sender_email}
                      </div>
                      <button
                        onClick={() => sendEmail(selectedEmail)}
                        disabled={sendingEmail || !editableReply.trim()}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 rounded font-bold text-sm flex items-center gap-2"
                      >
                        {sendingEmail ? (
                          <>⏳ {t.sending}</>
                        ) : (
                          <>📤 {t.sendEmail}</>
                        )}
                      </button>
                    </div>

                    {replyDraft.suggestions?.length > 0 && (
                      <div className="mt-3 text-xs text-gray-400 border-t border-white/10 pt-2">
                        <strong>{t.suggestions}:</strong>
                        <ul className="mt-1 list-disc list-inside">
                          {replyDraft.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Keywords */}
              {selectedEmail.ai_keywords?.length > 0 && (
                <div className="p-3 border-t border-white/10">
                  <div className="flex flex-wrap gap-1">
                    {selectedEmail.ai_keywords.map(kw => (
                      <span key={kw} className="px-2 py-0.5 bg-white/10 rounded text-xs">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold">⚙️ {t.settingsTitle}</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-white/10 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Auto Options */}
              <div>
                <h3 className="font-bold mb-3">{t.automation}</h3>
                <div className="space-y-2">
                  {[
                    { key: 'auto_classify', label: t.autoClassify },
                    { key: 'auto_summarize', label: t.autoSummarize },
                    { key: 'auto_move_spam', label: t.autoMoveSpam },
                    { key: 'auto_draft_reply', label: t.autoDraftReply }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings[key as keyof Settings] as boolean}
                        onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Client Domains */}
              <div>
                <h3 className="font-bold mb-3">{t.clientDomains}</h3>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="es. cliente.it"
                    className="flex-1 px-3 py-2 bg-white/10 rounded border border-white/20 text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && addToList('client_domains', newDomain)}
                  />
                  <button
                    onClick={() => addToList('client_domains', newDomain)}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded text-sm font-medium"
                  >
                    + {t.add}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {settings.client_domains.map(domain => (
                    <span key={domain} className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs flex items-center gap-1">
                      {domain}
                      <button onClick={() => removeFromList('client_domains', domain)} className="hover:text-white">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Supplier Domains */}
              <div>
                <h3 className="font-bold mb-3">{t.supplierDomains}</h3>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="es. fornitore.com"
                    className="flex-1 px-3 py-2 bg-white/10 rounded border border-white/20 text-sm"
                  />
                  <button
                    onClick={() => addToList('supplier_domains', newDomain)}
                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded text-sm font-medium"
                  >
                    + {t.add}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {settings.supplier_domains.map(domain => (
                    <span key={domain} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs flex items-center gap-1">
                      {domain}
                      <button onClick={() => removeFromList('supplier_domains', domain)} className="hover:text-white">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Urgent Keywords */}
              <div>
                <h3 className="font-bold mb-3">{t.urgentKeywords}</h3>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="es. urgente, scadenza"
                    className="flex-1 px-3 py-2 bg-white/10 rounded border border-white/20 text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && addToList('urgent_keywords', newKeyword)}
                  />
                  <button
                    onClick={() => addToList('urgent_keywords', newKeyword)}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded text-sm font-medium"
                  >
                    + {t.add}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {settings.urgent_keywords.map(kw => (
                    <span key={kw} className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs flex items-center gap-1">
                      {kw}
                      <button onClick={() => removeFromList('urgent_keywords', kw)} className="hover:text-white">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Spam Keywords */}
              <div>
                <h3 className="font-bold mb-3">{t.spamKeywords}</h3>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="es. offerta, promozione"
                    className="flex-1 px-3 py-2 bg-white/10 rounded border border-white/20 text-sm"
                  />
                  <button
                    onClick={() => addToList('spam_keywords', newKeyword)}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded text-sm font-medium"
                  >
                    + {t.add}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {settings.spam_keywords.map(kw => (
                    <span key={kw} className="px-2 py-1 bg-red-500/20 text-red-300 rounded text-xs flex items-center gap-1">
                      {kw}
                      <button onClick={() => removeFromList('spam_keywords', kw)} className="hover:text-white">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded font-medium"
              >
                {t.cancel}
              </button>
              <button
                onClick={saveSettings}
                disabled={settingsLoading}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 rounded font-bold"
              >
                {settingsLoading ? t.saving : `💾 ${t.saveSettings}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Modal */}
      {showAgent && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-xl w-full">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold">🤖 {t.agentTitle}</h2>
              <button
                onClick={() => setShowAgent(false)}
                className="p-2 hover:bg-white/10 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-300 mb-6">
                {t.agentDescription}
              </p>

              {/* Stats */}
              {agentStats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/10 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{agentStats.totalProcessed}</div>
                    <div className="text-xs text-gray-400">{t.processed}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{agentStats.repliesGenerated}</div>
                    <div className="text-xs text-gray-400">{t.replies}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{agentStats.rulesTriggered?.['auto-urgent'] || 0}</div>
                    <div className="text-xs text-gray-400">{t.urgentCount}</div>
                  </div>
                </div>
              )}

              {/* Rules Summary */}
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <h4 className="font-bold mb-2">{t.activeRules}:</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>✅ {t.ruleClientDomains}</li>
                  <li>✅ {t.ruleSupplierDomains}</li>
                  <li>✅ {t.ruleUrgentKeywords}</li>
                  {settings.auto_move_spam && <li>✅ {t.ruleAutoSpam}</li>}
                  {settings.auto_draft_reply && <li>✅ {t.ruleAutoReply}</li>}
                </ul>
              </div>

              <button
                onClick={runAgent}
                disabled={agentRunning}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-600 rounded-lg font-bold text-lg transition"
              >
                {agentRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚡</span> {t.agentRunning}
                  </span>
                ) : (
                  <span>🚀 {t.runAgent}</span>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center mt-3">
                {t.agentNote}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
