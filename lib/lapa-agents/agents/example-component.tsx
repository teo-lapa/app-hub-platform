/**
 * ESEMPIO COMPONENTE REACT - Helpdesk Widget
 *
 * Componente Next.js che mostra come integrare l'Helpdesk Agent
 * in un'interfaccia utente per i clienti
 */

'use client';

import { useState, useEffect } from 'react';

interface Ticket {
  id: number;
  name: string;
  stage_name?: string;
  priority: string;
  create_date: string;
}

interface TicketComment {
  id: number;
  body: string;
  author_name?: string;
  date: string;
}

/**
 * Componente principale - Helpdesk Widget
 */
export default function HelpdeskWidget({ customerId }: { customerId: number }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);

  // Carica ticket del cliente
  useEffect(() => {
    loadTickets();
  }, [customerId]);

  async function loadTickets() {
    try {
      setLoading(true);
      const response = await fetch(`/api/helpdesk?customerId=${customerId}`);
      const result = await response.json();

      if (result.success) {
        setTickets(result.tickets || []);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createTicket(subject: string, description: string, priority: string) {
    try {
      setLoading(true);
      const response = await fetch('/api/helpdesk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          customerId,
          subject,
          description,
          priority
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('Ticket creato con successo!');
        setShowCreateForm(false);
        loadTickets();
      } else {
        alert('Errore: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Errore durante la creazione del ticket');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="helpdesk-widget bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">I Miei Ticket di Supporto</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Nuovo Ticket
        </button>
      </div>

      {/* Form creazione ticket */}
      {showCreateForm && (
        <CreateTicketForm
          onSubmit={createTicket}
          onCancel={() => setShowCreateForm(false)}
          loading={loading}
        />
      )}

      {/* Lista ticket */}
      {loading && !showCreateForm ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Caricamento...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Nessun ticket presente.</p>
          <p className="text-sm mt-2">Crea un ticket per richiedere assistenza.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => setSelectedTicket(ticket.id)}
            />
          ))}
        </div>
      )}

      {/* Dettagli ticket selezionato */}
      {selectedTicket && (
        <TicketDetails
          ticketId={selectedTicket}
          customerId={customerId}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}

/**
 * Form per creare nuovo ticket
 */
function CreateTicketForm({
  onSubmit,
  onCancel,
  loading
}: {
  onSubmit: (subject: string, description: string, priority: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) {
      alert('Compila tutti i campi');
      return;
    }
    onSubmit(subject, description, priority);
  };

  return (
    <div className="bg-blue-50 rounded-lg p-6 mb-6 border-2 border-blue-200">
      <h3 className="text-lg font-semibold mb-4">Crea Nuovo Ticket</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Oggetto *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Breve descrizione del problema"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descrizione *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Descrivi in dettaglio il problema o la richiesta"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priorità
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="0">Bassa</option>
            <option value="1">Media</option>
            <option value="2">Alta</option>
            <option value="3">Urgente</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creazione...' : 'Crea Ticket'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Annulla
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Card ticket singolo
 */
function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const priorityColors = {
    '0': 'bg-gray-100 text-gray-700',
    '1': 'bg-blue-100 text-blue-700',
    '2': 'bg-orange-100 text-orange-700',
    '3': 'bg-red-100 text-red-700'
  };

  const priorityLabels = {
    '0': 'Bassa',
    '1': 'Media',
    '2': 'Alta',
    '3': 'Urgente'
  };

  return (
    <div
      onClick={onClick}
      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800">#{ticket.id} - {ticket.name}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[ticket.priority as keyof typeof priorityColors]}`}>
          {priorityLabels[ticket.priority as keyof typeof priorityLabels]}
        </span>
      </div>

      <div className="flex gap-4 text-sm text-gray-600">
        <span>Stage: {ticket.stage_name || 'N/A'}</span>
        <span>Creato: {new Date(ticket.create_date).toLocaleDateString('it-IT')}</span>
      </div>
    </div>
  );
}

/**
 * Dettagli ticket con commenti
 */
function TicketDetails({
  ticketId,
  customerId,
  onClose
}: {
  ticketId: number;
  customerId: number;
  onClose: () => void;
}) {
  const [ticket, setTicket] = useState<any>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTicketDetails();
  }, [ticketId]);

  async function loadTicketDetails() {
    try {
      const response = await fetch('/api/helpdesk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'details',
          ticketId
        })
      });

      const result = await response.json();

      if (result.success) {
        setTicket(result.ticket);
        setComments(result.comments || []);
      }
    } catch (error) {
      console.error('Error loading ticket details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addComment() {
    if (!newComment.trim()) return;

    try {
      const response = await fetch('/api/helpdesk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          ticketId,
          message: newComment,
          internal: false
        })
      });

      const result = await response.json();

      if (result.success) {
        setNewComment('');
        loadTicketDetails();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold">Ticket #{ticketId}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Caricamento...</div>
          ) : (
            <>
              {/* Dettagli ticket */}
              <div className="mb-6">
                <h3 className="font-semibold mb-2">{ticket?.name}</h3>
                <p className="text-gray-600 mb-4">{ticket?.description}</p>
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>Stage: {ticket?.stage_name}</span>
                  <span>Priority: {ticket?.priority}</span>
                </div>
              </div>

              {/* Commenti */}
              <div className="mb-4">
                <h4 className="font-semibold mb-3">Commenti ({comments.length})</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {comments.map(comment => (
                    <div key={comment.id} className="bg-gray-50 rounded p-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">
                          {comment.author_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.date).toLocaleString('it-IT')}
                        </span>
                      </div>
                      <div
                        className="text-sm text-gray-700"
                        dangerouslySetInnerHTML={{ __html: comment.body }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Nuovo commento */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Aggiungi commento
                </label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Scrivi un commento..."
                />
                <button
                  onClick={addComment}
                  className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Invia Commento
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
