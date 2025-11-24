import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

/**
 * GET /api/customers
 *
 * Carica tutti i clienti attivi da Odoo
 */
export async function GET(request: NextRequest) {
  try {
    // Get session
    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session non trovata - Rifare login'
      }, { status: 401 });
    }

    const rpc = createOdooRPCClient(sessionId);

    // Carica tutti i partner attivi
    // Include: Aziende OR Contatti veri (NO indirizzi delivery/invoice)
    // Stesso filtro usato in /api/clienti/search che funziona correttamente
    const customers = await rpc.searchRead(
      'res.partner',
      [
        ['active', '=', true],
        // Logica OR: Aziende O Contatti veri (NO indirizzi)
        '|',
          ['is_company', '=', true],         // Aziende
          '&',
            ['is_company', '=', false],      // Contatti
            ['type', '=', 'contact'],        // Solo type='contact' (NO delivery/invoice)
      ],
      ['id', 'name', 'email', 'phone', 'city', 'parent_id'],
      1000,
      'name ASC'
    );

    // Se ci sono contatti con parent_id, carichiamo anche i nomi delle aziende
    const parentIds = customers
      .filter((c: any) => c.parent_id && c.parent_id[0])
      .map((c: any) => c.parent_id[0]);

    let parentNames: Record<number, string> = {};
    if (parentIds.length > 0) {
      const parents = await rpc.searchRead(
        'res.partner',
        [['id', 'in', parentIds]],
        ['id', 'name'],
        parentIds.length
      );
      parentNames = parents.reduce((acc: any, p: any) => {
        acc[p.id] = p.name;
        return acc;
      }, {});
    }

    return NextResponse.json({
      success: true,
      customers: customers.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email || null,
        phone: c.phone || null,
        city: c.city || null,
        parentName: c.parent_id && c.parent_id[0] ? parentNames[c.parent_id[0]] : null
      })),
      totalCount: customers.length
    });

  } catch (error: any) {
    console.error('❌ Error loading customers:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
