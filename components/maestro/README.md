# Maestro AI Chat Widget

Sistema di Chat AI completo per Maestro AI con UI moderna, animazioni fluide e gestione intelligente della conversazione.

## Componenti

### ChatWidget
Widget chat principale con floating button e slide-in panel.

**Caratteristiche:**
- Floating button bottom-right con badge notifiche
- Chat panel slide-in da destra (400px desktop, full screen mobile)
- Auto-scroll ai nuovi messaggi
- Quick action buttons per azioni comuni
- Typing indicator durante risposta AI
- Clear history con conferma
- Dark mode compatible

**Utilizzo:**
```tsx
import { ChatWidget } from '@/components/maestro';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <ChatWidget />
    </>
  );
}
```

### ChatMessage
Componente per visualizzare singoli messaggi con styling role-based.

**Props:**
```typescript
interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
```

**Caratteristiche:**
- Avatar icons (User per utente, Brain per AI)
- Markdown rendering per messaggi AI (bold, lists)
- Timestamp formattato intelligente
- Fade-in animation
- Role-based styling (blu per user, slate per AI)

### ChatInput
Input area con auto-resize e keyboard shortcuts.

**Props:**
```typescript
interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}
```

**Caratteristiche:**
- Textarea auto-resize (max 5 righe)
- Enter per inviare, Shift+Enter per nuova riga
- Character counter con warning visivo
- Send button con loading state
- Helper text con shortcuts

## Hook

### useMaestroChat
Hook principale per gestione chat state.

**API:**
```typescript
interface UseMaestroChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
  isTyping: boolean;
}
```

**Caratteristiche:**
- Gestione conversation history
- Optimistic updates per UX fluida
- localStorage persistence (max 50 messaggi)
- Abort controller per cancellare richieste pending
- Mock AI responses context-aware
- Error handling robusto

**Utilizzo:**
```tsx
const { messages, isLoading, sendMessage, clearHistory, isTyping } = useMaestroChat();
```

## Mock Responses

Attualmente l'hook usa mock responses context-aware basate su keyword detection:

- **"cliente/clienti"** → Info portfolio clienti
- **"route/percorso/consegne"** → Percorso consegne giornaliero
- **"performance/statistiche"** → Statistiche performance
- **"aiuto/help"** → Lista funzionalità disponibili
- **Default** → Suggerimenti su cosa chiedere

## Integrazione API

Per integrare con l'API reale di Maestro AI, modificare `useMaestroChat.ts`:

```typescript
// Sostituire getMockAIResponse con:
async function getAIResponse(
  userMessage: string,
  conversationHistory: ChatMessage[],
  signal: AbortSignal
): Promise<string> {
  const response = await fetch('/api/maestro/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      history: conversationHistory.slice(-10), // Last 10 messages for context
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}
```

## Styling

Il sistema usa Tailwind CSS con design dark-mode-first:

**Colori principali:**
- User message: `bg-blue-600 text-white`
- AI message: `bg-slate-800 text-slate-100 border-slate-700`
- Panel background: `bg-slate-950 border-slate-800`
- Gradients: `from-emerald-500 to-teal-600` per AI avatar

**Animazioni:**
- Slide-in panel: `duration-300 ease-out`
- Message fade-in: `opacity-0 → opacity-100` + `translate-y-2 → translate-y-0`
- Typing dots: `animate-bounce` con stagger delay
- Button interactions: `active:scale-95`

## Responsive Design

- **Desktop (md+)**: 400px width panel, 600px height, bottom-right positioning
- **Mobile**: Full screen overlay, backdrop blur
- **Touch**: Ottimizzato per gesture mobile

## Accessibilità

- Semantic HTML (article, button, etc)
- ARIA labels su tutte le azioni
- Keyboard navigation support
- Screen reader friendly timestamps
- Focus management

## Performance

- Memo sui componenti ChatMessage per evitare re-render
- Lazy loading messaggi (solo ultimi 50 in localStorage)
- Debounced auto-resize textarea
- Virtualization ready (da implementare per >100 messaggi)

## Future Enhancements

1. **Streaming responses** per AI typing effect realistico
2. **Voice input** con Web Speech API
3. **File attachments** per immagini/documenti
4. **Message reactions** (👍👎 feedback)
5. **Conversation threads** per multi-topic chat
6. **Export conversation** come PDF/TXT
7. **Smart suggestions** basate su context
8. **Notification sound** per nuovi messaggi
9. **Unread count** nel badge floating button
10. **Message search** full-text

## Testing

Per testare il widget:

1. Aggiungi `<ChatWidget />` al layout principale
2. Clicca il floating button bottom-right
3. Prova quick actions o scrivi messaggi custom
4. Verifica auto-scroll, typing indicator, markdown rendering
5. Testa responsive su mobile (DevTools)
6. Verifica persistenza (ricarica pagina)

## Troubleshooting

**Panel non si apre:**
- Verifica z-index conflicts
- Check console per errori React

**Messaggi non persistono:**
- Check localStorage quota (max 5MB)
- Verifica STORAGE_KEY non sia in conflitto

**Typing animation lag:**
- Riduci numero messaggi visualizzati
- Implementa virtual scrolling

**Build errors:**
- Verifica Next.js 14+ e React 18+
- Check tsconfig "strict": true compatibility
