/**
 * ESEMPIO DI INTEGRAZIONE
 *
 * Come utilizzare find-receptions-by-supplier nel workflow di arrivo merce
 */

// ============================================================================
// SCENARIO 1: Ricerca automatica con data fattura
// ============================================================================

async function findReceptionWithInvoiceDate() {
  // Step 1: Parse fattura
  const parseResponse = await fetch('/api/arrivo-merce/parse-invoice', {
    method: 'POST',
    body: formData // con file fattura
  });

  const invoiceData = await parseResponse.json();
  // {
  //   supplier_name: "ACME SRL",
  //   supplier_vat: "IT12345678901",
  //   document_date: "2025-10-14",
  //   document_number: "P09956",
  //   products: [...]
  // }

  // Step 2: Trova fornitore (come fa find-reception)
  const partnersResponse = await fetch('/api/odoo/partners/search', {
    method: 'POST',
    body: JSON.stringify({
      vat: invoiceData.supplier_vat,
      name: invoiceData.supplier_name
    })
  });

  const partners = await partnersResponse.json();
  const supplier = partners[0]; // { id: 12345, name: "ACME SRL", ... }

  // Step 3: NUOVA API - Cerca ricezioni in attesa
  const receptionsResponse = await fetch('/api/arrivo-merce/find-receptions-by-supplier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplier_id: supplier.id,
      document_date: invoiceData.document_date,
      document_number: invoiceData.document_number,
      search_days: 7
    })
  });

  const receptionsData = await receptionsResponse.json();
  // {
  //   found: true,
  //   count: 2,
  //   receptions: [...],
  //   suggested_action: "use_first"
  // }

  // Step 4: Gestisci il risultato basandoti su suggested_action
  switch (receptionsData.suggested_action) {
    case 'use_first':
      // Usa automaticamente la prima ricezione
      const selectedReception = receptionsData.receptions[0];
      console.log('✅ Ricezione trovata automaticamente:', selectedReception.name);

      // Step 5: Carica dettagli completi
      const detailsResponse = await fetch('/api/arrivo-merce/find-reception', {
        method: 'POST',
        body: JSON.stringify({
          supplier_name: invoiceData.supplier_name,
          supplier_vat: invoiceData.supplier_vat,
          document_number: invoiceData.document_number
        })
      });

      const receptionDetails = await detailsResponse.json();
      // { picking: {...}, move_lines: [...] }

      // Step 6: Processa la ricezione
      await processReception(receptionDetails, invoiceData);
      break;

    case 'ask_user':
      // Mostra lista all'utente per selezione manuale
      showReceptionSelectionDialog(receptionsData.receptions);
      break;

    case 'create_manual':
      // Nessuna ricezione trovata, crea manualmente
      showCreateManualReceptionDialog(supplier, invoiceData);
      break;
  }
}

// ============================================================================
// SCENARIO 2: Ricerca senza data fattura (solo fornitore)
// ============================================================================

async function findReceptionBySupplierOnly(supplierId: number) {
  const receptionsResponse = await fetch('/api/arrivo-merce/find-receptions-by-supplier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplier_id: supplierId
      // Nessuna document_date: cerca ultimi 30 giorni
    })
  });

  const data = await receptionsResponse.json();
  // {
  //   found: true,
  //   count: 8,
  //   receptions: [...], // ordinate per scheduled_date DESC
  //   suggested_action: "ask_user"
  // }

  if (data.found) {
    console.log(`📦 Trovate ${data.count} ricezioni in attesa:`);
    data.receptions.forEach((r: any, i: number) => {
      console.log(`  ${i + 1}. ${r.name} - ${r.products_count} prodotti - ${r.scheduled_date}`);
    });
  }
}

// ============================================================================
// SCENARIO 3: UI Component React per selezione ricezione
// ============================================================================

interface ReceptionSelectorProps {
  supplierId: number;
  documentDate?: string;
  documentNumber?: string;
  onReceptionSelected: (receptionId: number) => void;
}

function ReceptionSelector({
  supplierId,
  documentDate,
  documentNumber,
  onReceptionSelected
}: ReceptionSelectorProps) {
  const [receptions, setReceptions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [suggestedAction, setSuggestedAction] = React.useState<string>('');

  React.useEffect(() => {
    async function searchReceptions() {
      setLoading(true);

      const response = await fetch('/api/arrivo-merce/find-receptions-by-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          document_date: documentDate,
          document_number: documentNumber,
          search_days: 7
        })
      });

      const data = await response.json();

      setReceptions(data.receptions || []);
      setSuggestedAction(data.suggested_action);
      setLoading(false);

      // Auto-select se suggested_action = 'use_first'
      if (data.suggested_action === 'use_first' && data.receptions.length > 0) {
        onReceptionSelected(data.receptions[0].id);
      }
    }

    searchReceptions();
  }, [supplierId, documentDate, documentNumber]);

  if (loading) return <div>Ricerca ricezioni in corso...</div>;

  if (suggestedAction === 'create_manual') {
    return (
      <div>
        <p>❌ Nessuna ricezione in attesa trovata per questo fornitore</p>
        <button onClick={() => createManualReception()}>
          Crea ricezione manuale
        </button>
      </div>
    );
  }

  if (suggestedAction === 'use_first') {
    const reception = receptions[0];
    return (
      <div>
        <p>✅ Ricezione trovata automaticamente!</p>
        <ReceptionCard reception={reception} />
        <button onClick={() => onReceptionSelected(reception.id)}>
          Usa questa ricezione
        </button>
      </div>
    );
  }

  // ask_user: mostra lista per selezione
  return (
    <div>
      <h3>🔍 Trovate {receptions.length} ricezioni in attesa</h3>
      <p>Seleziona quella corretta:</p>
      <div className="receptions-list">
        {receptions.map((reception) => (
          <div
            key={reception.id}
            className="reception-item"
            onClick={() => onReceptionSelected(reception.id)}
          >
            <div className="reception-header">
              <span className="reception-name">{reception.name}</span>
              {reception.origin && (
                <span className="reception-origin">Ordine: {reception.origin}</span>
              )}
            </div>
            <div className="reception-details">
              <span>📅 {reception.scheduled_date || 'Data non definita'}</span>
              <span>📦 {reception.products_count} prodotti</span>
              <span>🔢 Tot: {reception.total_qty} unità</span>
              {reception.date_match_score > 0 && (
                <span className="match-score">
                  Match: {reception.date_match_score}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SCENARIO 4: Workflow completo con error handling
// ============================================================================

async function completeWorkflow(formData: FormData) {
  try {
    // 1. Parse fattura
    console.log('📄 Parsing fattura...');
    const parseRes = await fetch('/api/arrivo-merce/parse-invoice', {
      method: 'POST',
      body: formData
    });

    if (!parseRes.ok) throw new Error('Errore parsing fattura');
    const invoice = await parseRes.json();

    console.log('✅ Fattura parsata:', invoice.document_number);

    // 2. Trova fornitore
    console.log('🏢 Ricerca fornitore...');
    const partnerRes = await fetch('/api/odoo/partners/search', {
      method: 'POST',
      body: JSON.stringify({
        vat: invoice.supplier_vat,
        name: invoice.supplier_name
      })
    });

    if (!partnerRes.ok) throw new Error('Fornitore non trovato');
    const partners = await partnerRes.json();
    const supplier = partners[0];

    console.log('✅ Fornitore trovato:', supplier.name);

    // 3. Cerca ricezioni
    console.log('📦 Ricerca ricezioni...');
    const receptionsRes = await fetch('/api/arrivo-merce/find-receptions-by-supplier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplier_id: supplier.id,
        document_date: invoice.document_date,
        document_number: invoice.document_number,
        search_days: 7
      })
    });

    if (!receptionsRes.ok) throw new Error('Errore ricerca ricezioni');
    const receptionsData = await receptionsRes.json();

    // 4. Gestisci risultato
    if (!receptionsData.found) {
      console.log('❌ Nessuna ricezione trovata');
      // Qui potresti mostrare UI per creazione manuale
      return { status: 'no_reception', invoice, supplier };
    }

    if (receptionsData.suggested_action === 'use_first') {
      console.log('✅ Ricezione automatica:', receptionsData.receptions[0].name);

      // 5. Carica dettagli e processa
      const receptionDetails = await loadReceptionDetails(receptionsData.receptions[0].id);
      const processResult = await processReception(receptionDetails, invoice);

      return {
        status: 'auto_processed',
        reception: receptionsData.receptions[0],
        result: processResult
      };
    }

    if (receptionsData.suggested_action === 'ask_user') {
      console.log(`🤔 Trovate ${receptionsData.count} ricezioni, serve input utente`);
      return {
        status: 'user_selection_required',
        receptions: receptionsData.receptions,
        invoice,
        supplier
      };
    }

  } catch (error) {
    console.error('❌ Errore workflow:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function loadReceptionDetails(receptionId: number) {
  // Carica dettagli completi usando l'ID
  // Potresti dover modificare find-reception per supportare ricerca per ID
  // oppure fare una chiamata diretta a Odoo
  const response = await fetch('/api/odoo/stock/picking/read', {
    method: 'POST',
    body: JSON.stringify({ picking_id: receptionId })
  });

  return response.json();
}

async function processReception(reception: any, invoice: any) {
  const response = await fetch('/api/arrivo-merce/process-reception', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      picking_id: reception.id,
      invoice_products: invoice.products
    })
  });

  return response.json();
}

function showReceptionSelectionDialog(receptions: any[]) {
  // Implementa UI per selezione manuale
  console.log('Mostra dialog con', receptions.length, 'ricezioni');
}

function showCreateManualReceptionDialog(supplier: any, invoice: any) {
  // Implementa UI per creazione manuale
  console.log('Mostra dialog per creazione manuale');
}

function createManualReception() {
  // Implementa creazione manuale
  console.log('Crea nuova ricezione');
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  findReceptionWithInvoiceDate,
  findReceptionBySupplierOnly,
  completeWorkflow,
  ReceptionSelector
};
