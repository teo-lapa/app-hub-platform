/**
 * API SPESE - Creazione Spesa in Odoo
 *
 * POST /api/spese/submit
 * - Crea hr.expense in Odoo
 * - Allega foto scontrino
 * - Imposta stato "Da inviare" → poi "Inviata" (approvata automaticamente)
 *
 * GET /api/spese/submit?action=categories
 * - Lista le categorie spese disponibili (product.product con can_be_expensed=true)
 *
 * GET /api/spese/submit?action=my-expenses
 * - Lista le spese dell'utente corrente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

// Mapping categorie AI → nomi prodotti in Odoo (per LAPA)
// Le categorie vengono riconosciute da Gemini e mappate ai prodotti Odoo
const CATEGORY_MAPPING: Record<string, string[]> = {
  'carburante': ['Carburante Lapa', 'Carburante', 'Gasolio', 'Benzina'],
  'cibo': ['Pranzo / viaggi Lapa', 'Pranzo', 'Pasti', 'Ristorante'],
  'trasporto': ['Pranzo / viaggi Lapa', 'Trasporti', 'Viaggi'],
  'alloggio': ['Pranzo / viaggi Lapa', 'Alloggio', 'Hotel'],
  'materiale': ['Spese varie Lapa', 'Spese Varie', 'Materiale'],
  'altro': ['Spese varie Lapa', 'Spese Varie']
};

// Funzione per trovare la categoria Odoo migliore
function getCategorySearchTerms(aiCategory: string): string[] {
  return CATEGORY_MAPPING[aiCategory] || CATEGORY_MAPPING['altro'];
}

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!cookies) {
      return NextResponse.json({ error: 'Autenticazione Odoo fallita' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'categories';

    if (action === 'categories') {
      // Lista categorie spese disponibili
      console.log('📂 [SPESE-SUBMIT] Caricamento categorie spese...');

      const products = await callOdoo(cookies, 'product.product', 'search_read', [], {
        domain: [['can_be_expensed', '=', true]],
        fields: ['id', 'name', 'standard_price', 'default_code'],
        order: 'name'
      });

      console.log(`✅ [SPESE-SUBMIT] Trovate ${products.length} categorie spese`);

      return NextResponse.json({
        success: true,
        categories: products.map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.default_code || '',
          defaultPrice: p.standard_price || 0
        }))
      });
    }

    if (action === 'my-expenses') {
      // Lista spese dell'utente corrente
      console.log('📋 [SPESE-SUBMIT] Caricamento spese utente...');

      // Prima trova l'employee_id dell'utente corrente
      const employees = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
        domain: [['user_id', '=', uid]],
        fields: ['id', 'name'],
        limit: 1
      });

      if (!employees || employees.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Dipendente non trovato per questo utente'
        }, { status: 404 });
      }

      const employeeId = employees[0].id;

      // Carica le spese del dipendente
      const expenses = await callOdoo(cookies, 'hr.expense', 'search_read', [], {
        domain: [['employee_id', '=', employeeId]],
        fields: [
          'id', 'name', 'date', 'total_amount', 'state',
          'product_id', 'payment_mode', 'description'
        ],
        order: 'date desc',
        limit: 50
      });

      return NextResponse.json({
        success: true,
        employee: employees[0],
        expenses: expenses.map((e: any) => ({
          id: e.id,
          name: e.name,
          date: e.date,
          amount: e.total_amount,
          state: e.state,
          category: e.product_id ? e.product_id[1] : 'N/A',
          paymentMode: e.payment_mode,
          description: e.description
        }))
      });
    }

    if (action === 'employee') {
      // Ritorna info dipendente corrente
      const employees = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
        domain: [['user_id', '=', uid]],
        fields: ['id', 'name', 'work_email', 'department_id', 'company_id'],
        limit: 1
      });

      if (!employees || employees.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Dipendente non trovato'
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        employee: employees[0]
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Azione non riconosciuta',
      availableActions: ['categories', 'my-expenses', 'employee']
    }, { status: 400 });

  } catch (error: any) {
    console.error('❌ [SPESE-SUBMIT] GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('💰 [SPESE-SUBMIT] Creazione nuova spesa...');

    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!cookies) {
      return NextResponse.json({ error: 'Autenticazione Odoo fallita' }, { status: 401 });
    }

    const body = await request.json();
    const {
      // Dati obbligatori
      totalAmount,
      date,
      categoryId, // product.product ID
      categoryName, // Nome categoria (fallback per cercare)

      // Dati opzionali
      description,
      storeName,
      vatAmount,
      items, // Array prodotti dallo scontrino

      // Immagine scontrino
      imageBase64,
      imageMimeType,

      // Opzioni
      paymentMode = 'company_account', // 'company_account' = carta azienda, 'own_account' = soldi propri
      note
    } = body;

    // Validazione
    if (!totalAmount || !date) {
      return NextResponse.json({
        success: false,
        error: 'totalAmount e date sono obbligatori'
      }, { status: 400 });
    }

    // 1. Trova l'employee_id dell'utente corrente
    console.log('👤 [SPESE-SUBMIT] Ricerca dipendente per UID:', uid);

    const employees = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
      domain: [['user_id', '=', uid]],
      fields: ['id', 'name', 'company_id'],
      limit: 1
    });

    if (!employees || employees.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Dipendente non trovato per questo utente. Contatta l\'amministratore.'
      }, { status: 404 });
    }

    const employee = employees[0];
    console.log('✅ [SPESE-SUBMIT] Dipendente trovato:', employee.name);

    // 2. Trova o determina la categoria spesa (product.product)
    // IMPORTANTE: Filtra per company_id per evitare errori multi-company
    const companyId = employee.company_id ? employee.company_id[0] : false;
    let productId = categoryId;

    // Ottieni i termini di ricerca basati sulla categoria AI
    const searchTerms = getCategorySearchTerms(categoryName || 'altro');
    console.log('🔍 [SPESE-SUBMIT] Categoria AI:', categoryName, '→ Cerco:', searchTerms);

    if (!productId) {
      // Cerca il prodotto giusto provando ogni termine in ordine di priorità
      for (const searchTerm of searchTerms) {
        const products = await callOdoo(cookies, 'product.product', 'search_read', [], {
          domain: [
            ['can_be_expensed', '=', true],
            ['name', 'ilike', searchTerm],
            '|',
            ['company_id', '=', companyId],
            ['company_id', '=', false]
          ],
          fields: ['id', 'name', 'company_id'],
          limit: 1
        });

        if (products && products.length > 0) {
          productId = products[0].id;
          console.log('✅ [SPESE-SUBMIT] Categoria trovata:', products[0].name, '(cercato:', searchTerm, ')');
          break;
        }
      }
    }

    if (!productId) {
      // Fallback finale: prendi qualsiasi categoria spese disponibile
      const fallbackProducts = await callOdoo(cookies, 'product.product', 'search_read', [], {
        domain: [
          ['can_be_expensed', '=', true],
          '|',
          ['company_id', '=', companyId],
          ['company_id', '=', false]
        ],
        fields: ['id', 'name', 'company_id'],
        limit: 1
      });

      if (fallbackProducts && fallbackProducts.length > 0) {
        productId = fallbackProducts[0].id;
        console.log('⚠️ [SPESE-SUBMIT] Usando categoria fallback:', fallbackProducts[0].name);
      } else {
        return NextResponse.json({
          success: false,
          error: `Nessuna categoria spese configurata in Odoo per l'azienda ${employee.company_id ? employee.company_id[1] : 'N/A'}`
        }, { status: 400 });
      }
    }

    console.log('📦 [SPESE-SUBMIT] Usando product_id:', productId, 'per company_id:', companyId);

    // 3. Costruisci la descrizione completa
    let fullDescription = storeName || '';

    if (items && items.length > 0) {
      fullDescription += '\n\n**DETTAGLIO PRODOTTI:**\n';
      fullDescription += '-'.repeat(30) + '\n';
      fullDescription += items.map((item: any) =>
        `- ${item.description}: ${item.totalPrice?.toFixed(2) || '?'} CHF`
      ).join('\n');
    }

    if (vatAmount) {
      fullDescription += `\n\nIVA: CHF ${vatAmount.toFixed(2)}`;
    }

    if (note) {
      fullDescription += `\n\nNota: ${note}`;
    }

    // 4. Crea la spesa in Odoo
    const expenseData: any = {
      name: `${storeName || 'Spesa'} - CHF ${totalAmount.toFixed(2)}`,
      employee_id: employee.id,
      product_id: productId,
      total_amount: totalAmount,
      date: date,
      payment_mode: paymentMode,
      description: fullDescription,
      company_id: employee.company_id ? employee.company_id[0] : false
    };

    console.log('📝 [SPESE-SUBMIT] Creazione spesa:', expenseData);

    const expenseId = await callOdoo(cookies, 'hr.expense', 'create', [expenseData]);

    if (!expenseId) {
      return NextResponse.json({
        success: false,
        error: 'Errore creazione spesa in Odoo'
      }, { status: 500 });
    }

    console.log('✅ [SPESE-SUBMIT] Spesa creata con ID:', expenseId);

    // 5. Allega l'immagine dello scontrino
    let attachmentId = null;
    if (imageBase64) {
      console.log('📎 [SPESE-SUBMIT] Allegamento immagine scontrino...');

      const extension = imageMimeType?.includes('png') ? 'png' :
                       imageMimeType?.includes('gif') ? 'gif' : 'jpg';

      attachmentId = await callOdoo(cookies, 'ir.attachment', 'create', [{
        name: `Scontrino_${date}_${expenseId}.${extension}`,
        type: 'binary',
        datas: imageBase64,
        res_model: 'hr.expense',
        res_id: expenseId,
        mimetype: imageMimeType || 'image/jpeg'
      }]);

      console.log('✅ [SPESE-SUBMIT] Allegato creato con ID:', attachmentId);
    }

    // 6. Invia la spesa per approvazione (cambia stato da "draft" a "reported")
    // In Odoo, per inviare una spesa bisogna creare un expense.sheet
    console.log('📤 [SPESE-SUBMIT] Creazione nota spese e invio...');

    try {
      // Crea un expense.sheet (nota spese) con questa singola spesa
      const sheetId = await callOdoo(cookies, 'hr.expense.sheet', 'create', [{
        name: `Nota Spese ${date} - ${employee.name}`,
        employee_id: employee.id,
        expense_line_ids: [[6, 0, [expenseId]]], // Collega la spesa
        company_id: employee.company_id ? employee.company_id[0] : false
      }]);

      console.log('✅ [SPESE-SUBMIT] Nota spese creata con ID:', sheetId);

      // Invia la nota spese per approvazione
      await callOdoo(cookies, 'hr.expense.sheet', 'action_submit_sheet', [[sheetId]]);
      console.log('✅ [SPESE-SUBMIT] Nota spese inviata per approvazione');

      // Se payment_mode è 'company_account' (carta azienda), approva automaticamente
      if (paymentMode === 'company_account') {
        try {
          await callOdoo(cookies, 'hr.expense.sheet', 'approve_expense_sheets', [[sheetId]]);
          console.log('✅ [SPESE-SUBMIT] Nota spese approvata automaticamente (carta azienda)');
        } catch (approveError: any) {
          console.warn('⚠️ [SPESE-SUBMIT] Approvazione automatica fallita (potrebbe richiedere permessi):', approveError.message);
        }
      }

    } catch (sheetError: any) {
      console.warn('⚠️ [SPESE-SUBMIT] Creazione nota spese fallita:', sheetError.message);
      // La spesa è comunque stata creata, solo non è stata inviata
    }

    // 7. Leggi la spesa creata per conferma
    const createdExpense = await callOdoo(cookies, 'hr.expense', 'search_read', [], {
      domain: [['id', '=', expenseId]],
      fields: ['id', 'name', 'date', 'total_amount', 'state', 'product_id', 'payment_mode']
    });

    return NextResponse.json({
      success: true,
      message: 'Spesa creata e inviata con successo!',
      expense: {
        id: expenseId,
        name: createdExpense[0]?.name,
        date: createdExpense[0]?.date,
        amount: createdExpense[0]?.total_amount,
        state: createdExpense[0]?.state,
        category: createdExpense[0]?.product_id?.[1]
      },
      attachmentId
    });

  } catch (error: any) {
    console.error('❌ [SPESE-SUBMIT] POST Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore creazione spesa: ' + error.message
    }, { status: 500 });
  }
}
