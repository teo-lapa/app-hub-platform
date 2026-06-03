import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';
import { injectLangContext } from '@/lib/odoo/user-lang';

const TAG_CATALOGATO = 316;

// Etichette amichevoli per le zone (figlie di WH/Deposito)
function zoneLabel(name: string): string {
  const map: Record<string, string> = {
    'Frigo-01': 'Frigo',
    'Pingu-01': 'Congelatore',
    'Secco-01': 'Secco',
    'Secco Sopra-02': 'Secco Sopra',
  };
  if (map[name]) return map[name];
  // fallback: togli il suffisso "-01"/"-02"
  return name.replace(/-\d+$/, '').trim();
}

async function callKw(odooUrl: string, sessionId: string, model: string, method: string, args: any[], kwargs: any) {
  const res = await fetch(`${odooUrl}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs }, id: 1 }),
  });
  return (await res.json()).result || [];
}

export async function GET(_request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Sessione non valida' }, { status: 401 });
    }
    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    // 1. Trova il deposito (WH/Deposito) per barcode
    const depots = await callKw(odooUrl!, sessionId, 'stock.location', 'search_read',
      [[['barcode', '=', 'deposito']]], injectLangContext({ fields: ['id'], limit: 1 }));
    if (depots.length === 0) {
      return NextResponse.json({ success: false, error: 'Deposito non trovato' }, { status: 404 });
    }
    const depositoId = depots[0].id;

    // 2. Tutte le ubicazioni sotto il deposito (per ricostruire l'albero zona/bin)
    const locs = await callKw(odooUrl!, sessionId, 'stock.location', 'search_read',
      [[['id', 'child_of', depositoId], ['usage', '=', 'internal']]],
      injectLangContext({ fields: ['id', 'name', 'complete_name', 'location_id', 'barcode'], limit: 5000 }));
    const locById = new Map<number, any>();
    const parentOf = new Map<number, number | null>();
    for (const l of locs) {
      locById.set(l.id, l);
      parentOf.set(l.id, l.location_id ? l.location_id[0] : null);
    }
    // zona di un bin = l'antenato che e' figlio diretto del deposito (o il bin stesso)
    const zoneOf = (binId: number): number => {
      let cur: number | null = binId;
      for (let i = 0; i < 20 && cur != null; i++) {
        if (cur === depositoId) return depositoId;
        if (parentOf.get(cur) === depositoId) return cur;
        cur = parentOf.get(cur) ?? null;
      }
      return binId;
    };

    // 3. Giacenze sotto il deposito
    const quants = await callKw(odooUrl!, sessionId, 'stock.quant', 'search_read',
      [[['location_id', 'child_of', depositoId], ['quantity', '>', 0]]],
      injectLangContext({ fields: ['product_id', 'location_id'], limit: 100000 }));
    if (quants.length === 0) {
      return NextResponse.json({ success: true, zones: [] });
    }

    // 4. product.product -> product.template
    const productIds = Array.from(new Set(quants.map((q: any) => q.product_id[0]))) as number[];
    const prods = await callKw(odooUrl!, sessionId, 'product.product', 'read',
      [productIds], injectLangContext({ fields: ['product_tmpl_id'] }));
    const tmplOf = new Map<number, number>();
    for (const p of prods) tmplOf.set(p.id, p.product_tmpl_id[0]);

    // 5. Quali template sono gia' catalogati (tag 316)
    const tmplIds = Array.from(new Set(Array.from(tmplOf.values())));
    const tagged = await callKw(odooUrl!, sessionId, 'product.template', 'search_read',
      [[['id', 'in', tmplIds], ['product_tag_ids', 'in', [TAG_CATALOGATO]]]], { fields: ['id'], limit: 100000 });
    const catalogati = new Set<number>(tagged.map((t: any) => t.id));

    // 6. Conta template distinti DA FARE per bin
    const binDaFare = new Map<number, Set<number>>(); // binId -> set tmplId
    for (const q of quants) {
      const binId = q.location_id[0];
      const tmplId = tmplOf.get(q.product_id[0]);
      if (tmplId == null || catalogati.has(tmplId)) continue;
      if (!binDaFare.has(binId)) binDaFare.set(binId, new Set());
      binDaFare.get(binId)!.add(tmplId);
    }

    // 7. Aggrega per zona
    const zones = new Map<number, { id: number; name: string; label: string; count: number; bins: any[] }>();
    for (const [binId, set] of Array.from(binDaFare.entries())) {
      const count = set.size;
      if (count === 0) continue;
      const zId = zoneOf(binId);
      const zLoc = locById.get(zId);
      if (!zones.has(zId)) {
        zones.set(zId, { id: zId, name: zLoc?.name || '', label: zoneLabel(zLoc?.name || ''), count: 0, bins: [] });
      }
      const zone = zones.get(zId)!;
      const binLoc = locById.get(binId);
      zone.bins.push({ id: binId, name: binLoc?.name || '', barcode: binLoc?.barcode || '', count });
      zone.count += count;
    }

    const result = Array.from(zones.values())
      .map(z => ({ ...z, bins: z.bins.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)) }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ success: true, zones: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
