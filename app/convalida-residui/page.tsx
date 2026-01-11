'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================================
// INTERFACCE TYPESCRIPT
// ============================================================================

interface StockPicking {
  id: number;
  name: string;
  state: string;
  partner_id: [number, string] | false;
  driver_id: [number, string] | false;
  carrier_id: [number, string] | false;
  sale_id: [number, string] | false;
  origin: string | false;
  group_id: [number, string] | false;
  scheduled_date: string | false;
  backorder_id: [number, string] | false;
}

interface StockMove {
  id: number;
  picking_id: [number, string];
  product_id: [number, string];
  product_uom_qty: number;
  location_id: [number, string];
  location_dest_id: [number, string];
  product_uom: [number, string];
}

interface StockMoveLine {
  id: number;
  move_id: [number, string];
  qty_done: number;
  location_id: [number, string] | false;
  lot_id: [number, string] | false;
}

interface Product {
  id: number;
  display_name?: string;
  name: string;
  default_code?: string | false;
  barcode?: string | false;
  uom_id: [number, string] | false;
  lst_price: number;
  product_tmpl_id?: [number, string];
}

interface SaleOrder {
  id: number;
  name: string;
  pricelist_id: [number, string] | false;
  partner_id: [number, string] | false;
  state: string;
}

interface GroupData {
  driver: string;
  carrier: string;
  pickings: StockPicking[];
}

interface LineInfo {
  qty_done: number;
  location: [number, string] | false;
  lot: [number, string] | false;
}

interface StockQuant {
  id: number;
  product_id: [number, string];
  location_id: [number, string];
  quantity: number;
  inventory_quantity: number;
  lot_id: [number, string] | false;
  reserved_quantity: number;
}

interface ForzaInventarioData {
  productId: number;
  productName: string;
  pickingId: number;
  pickingName: string;
  moveId: number;
  quants: StockQuant[];
  selectedQuantId: number | null;
  selectedLocationId: number | null;
  newQuantity: number;
}

interface SostituzioneData {
  moveId: number;
  pickingId: number;
  pickingName: string;
  originalProductId: number;
  originalProductName: string;
  originalQty: number;
  locationId: number;
  locationDestId: number;
  saleOrderId: number | null;
  saleOrderName: string | null;
}

interface LotInfo {
  id: number;
  name: string;
  expiration_date: string | false;
  use_date: string | false;
}

interface ScadenzaModalData {
  moveId: number;
  pickingId: number;
  productName: string;
  lotId: number;
  lotName: string;
  currentExpiration: string | false;
}

// ============================================================================
// FUNZIONI RPC
// ============================================================================

async function callKwConvalida<T = any>(
  model: string,
  method: string,
  args: any[] = [],
  kwargs: any = {}
): Promise<T> {
  // Usa l'API route del server per gestire autenticazione
  const response = await fetch('/api/odoo/rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      model,
      method,
      args,
      kwargs,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Errore RPC');
  }

  return data.result;
}

async function searchReadConvalida<T = any>(
  model: string,
  domain: any[],
  fields: string[] = [],
  limit = 0,
  order = ''
): Promise<T[]> {
  return callKwConvalida<T[]>(model, 'search_read', [domain], { fields, limit, order });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function orDomainConvalida(leaves: any[][]): any[] {
  if (!leaves || !leaves.length) return [];
  if (leaves.length === 1) return leaves[0];
  const out: any[] = [];
  for (let i = 0; i < leaves.length - 1; i++) out.push('|');
  leaves.forEach((l) => out.push(l));
  return out;
}

// ============================================================================
// COMPONENTE PRINCIPALE
// ============================================================================

export default function ConvalidaResiduiPage() {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Pronto. Clicca CERCA per caricare i pick.');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Filtro per data: 'oggi' | 'ieri' | 'domani' | 'tutti'
  const [dateFilter, setDateFilter] = useState<'oggi' | 'ieri' | 'domani' | 'tutti'>('oggi');
  // Filtro per tipo: 'tutti' | 'residui' | 'attesa'
  const [typeFilter, setTypeFilter] = useState<'tutti' | 'residui' | 'attesa'>('tutti');

  // Dati principali
  const [picks, setPicks] = useState<StockPicking[]>([]);
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [linesByMove, setLinesByMove] = useState<Record<number, number[]>>({});
  const [doneByMove, setDoneByMove] = useState<Record<number, number>>({});
  const [metaByMove, setMetaByMove] = useState<Record<number, StockMove>>({});
  const [lineInfoByMove, setLineInfoByMove] = useState<Record<number, LineInfo[]>>({});
  const [groups, setGroups] = useState<Map<string, GroupData>>(new Map());

  // Info prodotti: disponibilità e arrivi
  const [productStock, setProductStock] = useState<Record<number, Array<{location: string, qty: number, reserved: number}>>>({});
  const [productIncoming, setProductIncoming] = useState<Record<number, Array<{name: string, qty: number, date: string}>>>({});
  const [productReservations, setProductReservations] = useState<Record<number, Array<{customer: string, qty: number, picking: string}>>>({});

  const [productCache, setProductCache] = useState<Record<string, Product[]>>({});

  // Forza Inventario Modal
  const [showForzaModal, setShowForzaModal] = useState(false);
  const [forzaData, setForzaData] = useState<ForzaInventarioData | null>(null);
  const [forzaLoading, setForzaLoading] = useState(false);

  // Correggi Scadenza Modal
  const [showScadenzaModal, setShowScadenzaModal] = useState(false);
  const [scadenzaData, setScadenzaData] = useState<ScadenzaModalData | null>(null);
  const [newExpirationDate, setNewExpirationDate] = useState('');
  const [scadenzaLoading, setScadenzaLoading] = useState(false);

  // Sostituzione Prodotto Modal
  const [showSostituzioneModal, setShowSostituzioneModal] = useState(false);
  const [sostituzioneData, setSostituzioneData] = useState<SostituzioneData | null>(null);
  const [sostituzioneSearch, setSostituzioneSearch] = useState('');
  const [sostituzioneSuggestions, setSostituzioneSuggestions] = useState<Product[]>([]);
  const [selectedSostituto, setSelectedSostituto] = useState<Product | null>(null);
  const [sostituzioneQty, setSostituzioneQty] = useState(0);
  const [sostituzioneLoading, setSostituzioneLoading] = useState(false);

  // Convalida Picking
  const [convalidaLoading, setConvalidaLoading] = useState<number | null>(null);

  // Refs
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sostituzioneInputRef = useRef<HTMLInputElement>(null);
  const sostituzioneSearchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------------------------
  // EFFECTS
  // --------------------------------------------------------------------------

  // Inizializzazione tema
  useEffect(() => {
    const stored = localStorage.getItem('lapa_theme') as 'light' | 'dark' | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  // Focus automatico sul modal sostituzione
  useEffect(() => {
    if (showSostituzioneModal && sostituzioneInputRef.current) {
      setTimeout(() => sostituzioneInputRef.current?.focus(), 50);
    }
  }, [showSostituzioneModal]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (sostituzioneSearchTimerRef.current) clearTimeout(sostituzioneSearchTimerRef.current);
    };
  }, []);

  // --------------------------------------------------------------------------
  // UTILITY FUNCTIONS
  // --------------------------------------------------------------------------

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('lapa_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const showToastMessage = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 1600);
  };

  const ratio = (done: number, plan: number): number => {
    if (!plan) return 0;
    return Math.max(0, Math.min(100, (done / plan) * 100));
  };

  const getLabel = (value: [number, string] | false, prefix: string): string => {
    return value && value[1] ? value[1] : `${prefix} -`;
  };

  const bestLocationForMove = (moveId: number): string => {
    const arr = lineInfoByMove[moveId] || [];
    if (arr.length) {
      const sorted = [...arr].sort((a, b) => (b.qty_done || 0) - (a.qty_done || 0));
      const top = sorted[0];
      let txt = top.location ? top.location[1] : '-';
      if (top.lot) txt += ' - ' + top.lot[1];
      return txt;
    }
    const m = metaByMove[moveId];
    return m && m.location_id ? m.location_id[1] : '-';
  };

  // --------------------------------------------------------------------------
  // HELPER: Calcola date per filtro
  // --------------------------------------------------------------------------

  const getDateRange = (filter: 'oggi' | 'ieri' | 'domani' | 'tutti'): { start: string; end: string } | null => {
    if (filter === 'tutti') return null;

    const now = new Date();
    let targetDate: Date;

    switch (filter) {
      case 'ieri':
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() - 1);
        break;
      case 'domani':
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 1);
        break;
      case 'oggi':
      default:
        targetDate = now;
        break;
    }

    // Inizio e fine giornata (UTC per Odoo)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return {
      start: startOfDay.toISOString().replace('T', ' ').slice(0, 19),
      end: endOfDay.toISOString().replace('T', ' ').slice(0, 19),
    };
  };

  // --------------------------------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------------------------------

  const handleLoad = async () => {
    setIsLoading(true);
    setStatusMessage('Carico…');

    try {
      // Costruisci domain base
      const domain: any[] = [
        ['name', 'ilike', 'PICK'],
        ['state', 'not in', ['done', 'cancel']],
      ];

      // Filtro per tipo: residui (backorder) o in attesa (confirmed/waiting)
      if (typeFilter === 'residui') {
        domain.push(['backorder_id', '!=', false]);
      } else if (typeFilter === 'attesa') {
        domain.push(['backorder_id', '=', false]);
        domain.push(['state', 'in', ['confirmed', 'waiting', 'assigned']]);
      }
      // 'tutti' = non aggiunge filtri aggiuntivi

      // Filtro per data
      const dateRange = getDateRange(dateFilter);
      if (dateRange) {
        domain.push(['scheduled_date', '>=', dateRange.start]);
        domain.push(['scheduled_date', '<=', dateRange.end]);
      }

      const picksData = await searchReadConvalida<StockPicking>(
        'stock.picking',
        domain,
        ['id', 'name', 'state', 'partner_id', 'driver_id', 'carrier_id', 'sale_id', 'origin', 'group_id', 'scheduled_date', 'backorder_id'],
        0,
        'scheduled_date asc, name asc'
      );

      const dateLabel = dateFilter === 'tutti' ? '' : ` per ${dateFilter}`;
      const typeLabel = typeFilter === 'tutti' ? '' : (typeFilter === 'residui' ? ' (residui)' : ' (in attesa)');

      if (!picksData.length) {
        setPicks([]);
        setMoves([]);
        setGroups(new Map());
        setStatusMessage(`Nessun pick trovato${dateLabel}${typeLabel}.`);
        return;
      }

      const pickIds = picksData.map((p) => p.id);
      const movesData = await searchReadConvalida<StockMove>(
        'stock.move',
        [['picking_id', 'in', pickIds]],
        ['id', 'picking_id', 'product_id', 'product_uom_qty', 'location_id', 'location_dest_id', 'product_uom'],
        0,
        'picking_id,id'
      );

      const moveIds = movesData.map((m) => m.id);
      const linesData = moveIds.length
        ? await searchReadConvalida<StockMoveLine>(
            'stock.move.line',
            [['move_id', 'in', moveIds]],
            ['id', 'move_id', 'qty_done', 'location_id', 'lot_id'],
            0
          )
        : [];

      const newDoneByMove: Record<number, number> = {};
      const newLinesByMove: Record<number, number[]> = {};
      const newLineInfoByMove: Record<number, LineInfo[]> = {};

      linesData.forEach((l) => {
        const mid = l.move_id && l.move_id[0];
        if (mid) {
          newDoneByMove[mid] = (newDoneByMove[mid] || 0) + Number(l.qty_done || 0);
          if (!newLinesByMove[mid]) newLinesByMove[mid] = [];
          newLinesByMove[mid].push(l.id);
          if (!newLineInfoByMove[mid]) newLineInfoByMove[mid] = [];
          newLineInfoByMove[mid].push({
            qty_done: Number(l.qty_done || 0),
            location: l.location_id,
            lot: l.lot_id,
          });
        }
      });

      const newMetaByMove: Record<number, StockMove> = {};
      movesData.forEach((m) => {
        newMetaByMove[m.id] = m;
      });

      const newGroups = new Map<string, GroupData>();
      for (const p of picksData) {
        const driver = getLabel(p.driver_id, 'Autista');
        const giro = getLabel(p.carrier_id, 'Giro');
        const key = `${driver}||${giro}`;
        if (!newGroups.has(key)) {
          newGroups.set(key, { driver, carrier: giro, pickings: [] });
        }
        newGroups.get(key)!.pickings.push(p);
      }

      setPicks(picksData);
      setMoves(movesData);
      setLinesByMove(newLinesByMove);
      setDoneByMove(newDoneByMove);
      setMetaByMove(newMetaByMove);
      setLineInfoByMove(newLineInfoByMove);
      setGroups(newGroups);
      setStatusMessage(`Caricati ${picksData.length} pick${dateLabel}${typeLabel}`);

      // Carica info prodotti (stock e arrivi) in background
      loadProductsInfo(movesData);
    } catch (error: any) {
      setStatusMessage(`Errore: ${error.message}`);
      showToastMessage(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Carica disponibilità e arrivi per i prodotti
  const loadProductsInfo = async (movesData: StockMove[]) => {
    try {
      const productIds = Array.from(new Set(movesData.map(m => m.product_id[0])));
      console.log('🔍 Caricamento info per prodotti:', productIds);

      // 1. Carica stock per ubicazione (solo ubicazioni interne) CON reserved_quantity
      const quants = await searchReadConvalida<any>(
        'stock.quant',
        [
          ['product_id', 'in', productIds],
          ['quantity', '>', 0],
          ['location_id.usage', '=', 'internal']
        ],
        ['product_id', 'location_id', 'quantity', 'reserved_quantity'],
        0
      );
      console.log('📦 Quants trovati:', quants.length);

      const stockByProduct: Record<number, Array<{location: string, qty: number, reserved: number}>> = {};
      quants.forEach((q: any) => {
        const productId = q.product_id[0];
        if (!stockByProduct[productId]) stockByProduct[productId] = [];
        stockByProduct[productId].push({
          location: q.location_id[1],
          qty: q.quantity,
          reserved: q.reserved_quantity || 0
        });
      });

      // 2. Carica arrivi in corso (stock.move in entrata, non done/cancel)
      const incomingMoves = await searchReadConvalida<any>(
        'stock.move',
        [
          ['product_id', 'in', productIds],
          ['state', 'not in', ['done', 'cancel']],
          ['picking_code', '=', 'incoming'] // Solo arrivi
        ],
        ['product_id', 'picking_id', 'product_uom_qty', 'date'],
        0
      );

      const incomingByProduct: Record<number, Array<{name: string, qty: number, date: string}>> = {};
      incomingMoves.forEach((m: any) => {
        const productId = m.product_id[0];
        if (!incomingByProduct[productId]) incomingByProduct[productId] = [];
        incomingByProduct[productId].push({
          name: m.picking_id ? m.picking_id[1] : 'Arrivo',
          qty: m.product_uom_qty,
          date: m.date || ''
        });
      });

      // 3. Carica prenotazioni (stock.move in stato assigned = riservato)
      const reservedMoves = await searchReadConvalida<any>(
        'stock.move',
        [
          ['product_id', 'in', productIds],
          ['state', '=', 'assigned'],  // assigned = riservato/disponibile
          ['picking_code', '=', 'outgoing']  // Solo uscite (non arrivi)
        ],
        ['product_id', 'picking_id', 'product_uom_qty'],
        0
      );

      // Carica info picking per ottenere i clienti
      const pickingIdsForReservations = Array.from(new Set(
        reservedMoves
          .filter((r: any) => r.picking_id)
          .map((r: any) => r.picking_id[0])
      ));

      const pickingsForReservations = pickingIdsForReservations.length > 0
        ? await searchReadConvalida<any>(
            'stock.picking',
            [['id', 'in', pickingIdsForReservations]],
            ['id', 'name', 'partner_id'],
            0
          )
        : [];

      const pickingMap = new Map(
        pickingsForReservations.map((p: any) => [
          p.id,
          {
            name: p.name,
            customer: p.partner_id ? p.partner_id[1] : 'N/A'
          }
        ])
      );

      const reservationsByProduct: Record<number, Array<{customer: string, qty: number, picking: string}>> = {};
      reservedMoves.forEach((r: any) => {
        const productId = r.product_id[0];
        const pickingId = r.picking_id ? r.picking_id[0] : null;
        const pickingInfo = pickingId ? pickingMap.get(pickingId) : null;

        if (!reservationsByProduct[productId]) reservationsByProduct[productId] = [];
        reservationsByProduct[productId].push({
          customer: pickingInfo?.customer || 'N/A',
          qty: r.product_uom_qty,
          picking: pickingInfo?.name || r.picking_id ? r.picking_id[1] : 'N/A'
        });
      });

      console.log('✅ Stock by product:', stockByProduct);
      console.log('✅ Incoming by product:', incomingByProduct);
      console.log('✅ Reservations by product:', reservationsByProduct);

      setProductStock(stockByProduct);
      setProductIncoming(incomingByProduct);
      setProductReservations(reservationsByProduct);

    } catch (error) {
      console.error('❌ Errore caricamento info prodotti:', error);
    }
  };

  // --------------------------------------------------------------------------
  // UPDATE / SAVE FUNCTIONS
  // --------------------------------------------------------------------------

  const updateOne = async (moveId: number, value: number): Promise<void> => {
    try {
      const m = metaByMove[moveId];
      const oldValue = doneByMove[moveId] || 0;

      let lineIds = linesByMove[moveId] || [];
      if (lineIds.length) {
        await callKwConvalida('stock.move.line', 'write', [[lineIds[0]], { qty_done: value }]);
      } else {
        const vals = {
          move_id: moveId,
          picking_id: m.picking_id[0],
          product_id: m.product_id[0],
          qty_done: value,
          location_id: m.location_id[0],
          location_dest_id: m.location_dest_id[0],
          product_uom_id: m.product_uom[0],
        };
        const newId = await callKwConvalida<number>('stock.move.line', 'create', [vals]);
        setLinesByMove((prev) => ({ ...prev, [moveId]: [newId] }));
      }
      setDoneByMove((prev) => ({ ...prev, [moveId]: value }));

      // Traccia nel chatter del picking
      await logToChatter(m.picking_id[0], m.product_id[1], oldValue, value);

    } catch (error: any) {
      showToastMessage(`Errore: ${error.message}`);
      throw error;
    }
  };

  // Tracciamento nel chatter del picking
  const logToChatter = async (pickingId: number, productName: string, oldQty: number, newQty: number) => {
    try {
      const userName = 'Operatore'; // Potresti passare il nome utente vero se disponibile
      const timestamp = new Date().toLocaleString('it-IT');

      const message = `
        <p><strong>✏️ Modifica quantità residui</strong></p>
        <ul>
          <li><strong>Prodotto:</strong> ${productName}</li>
          <li><strong>Da:</strong> ${oldQty} → <strong>A:</strong> ${newQty}</li>
          <li><strong>Modificato da:</strong> ${userName}</li>
          <li><strong>Data:</strong> ${timestamp}</li>
        </ul>
      `;

      await callKwConvalida('stock.picking', 'message_post', [[pickingId]], {
        body: message,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note'
      });
    } catch (error) {
      console.error('Errore log chatter:', error);
      // Non bloccare l'operazione se il log fallisce
    }
  };

  const handleSaveOne = async (moveId: number) => {
    const input = document.getElementById(`convalida_done_${moveId}`) as HTMLInputElement;
    if (!input) return;
    const value = Number(input.value || 0);
    await updateOne(moveId, value);
    showToastMessage('Riga aggiornata');
  };

  const handleSaveAll = async () => {
    setIsLoading(true);
    try {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[id^="convalida_done_"]');
      for (const input of Array.from(inputs)) {
        const moveId = Number(input.id.replace('convalida_done_', ''));
        const value = Number(input.value || 0);
        await updateOne(moveId, value);
      }
      showToastMessage('Tutte le righe salvate');
    } catch (error: any) {
      showToastMessage(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGroup = async (key: string) => {
    const grp = groups.get(key);
    if (!grp) return;

    setIsLoading(true);
    try {
      const ids: number[] = [];
      for (const p of grp.pickings) {
        moves.filter((m) => m.picking_id && m.picking_id[0] === p.id).forEach((m) => ids.push(m.id));
      }
      for (const id of ids) {
        const input = document.getElementById(`convalida_done_${id}`) as HTMLInputElement;
        const val = input ? Number(input.value || 0) : Number(doneByMove[id] || 0);
        await updateOne(id, val);
      }
      showToastMessage(`Gruppo salvato: ${grp.driver} • ${grp.carrier}`);
    } catch (error: any) {
      showToastMessage(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // QUICK ADD FUNCTIONS
  // --------------------------------------------------------------------------

  const ensureOrderForPick = async (pick: StockPicking): Promise<SaleOrder | null> => {
    if (pick.sale_id) {
      const o = await searchReadConvalida<SaleOrder>(
        'sale.order',
        [['id', '=', pick.sale_id[0]]],
        ['id', 'name', 'pricelist_id', 'partner_id', 'state'],
        1
      );
      return o && o[0];
    }
    if (pick.origin) {
      const o = await searchReadConvalida<SaleOrder>(
        'sale.order',
        [['name', '=', pick.origin]],
        ['id', 'name', 'pricelist_id', 'partner_id', 'state'],
        1
      );
      if (o.length) return o[0];
    }
    if (pick.group_id) {
      const o = await searchReadConvalida<SaleOrder>(
        'sale.order',
        [['procurement_group_id', '=', pick.group_id[0]]],
        ['id', 'name', 'pricelist_id', 'partner_id', 'state'],
        1
      );
      if (o.length) return o[0];
    }
    return null;
  };

  const handleConvalidaPicking = async (pick: StockPicking) => {
    const pickMoves = moves.filter(m => m.picking_id[0] === pick.id);
    if (pickMoves.length === 0) {
      setStatusMessage('Nessun movimento da convalidare');
      return;
    }
    
    const allDone = pickMoves.every(m => (doneByMove[m.id] || 0) > 0);
    if (!allDone) {
      if (!confirm('Alcuni prodotti hanno quantita 0. Convalidare comunque? Verra creato un backorder.')) {
        return;
      }
    }
    
    setConvalidaLoading(pick.id);
    try {
      const result = await callKwConvalida('stock.picking', 'button_validate', [[pick.id]], {});
      
      if (result && typeof result === 'object' && result.res_model === 'stock.backorder.confirmation') {
        await callKwConvalida('stock.backorder.confirmation', 'process', [[result.res_id]], {});
      }
      
      await callKwConvalida('stock.picking', 'message_post', [[pick.id]], {
        body: '<p><strong>Picking convalidato</strong> tramite App Convalida Residui</p>',
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note'
      });
      
      setToastMessage('Picking ' + pick.name + ' convalidato!');
      setShowToast(true);
      await handleLoad();
    } catch (e) {
      setStatusMessage('Errore: ' + (e as Error).message);
    }
    setConvalidaLoading(null);
  };

  const superSearch = async (term: string): Promise<Product[]> => {
    const key = term.toLowerCase();
    if (productCache[key]) return productCache[key];

    if (/^[0-9A-Za-z\-\.]{6,}$/.test(term)) {
      const exactLeaves = [
        ['barcode', '=', term],
        ['default_code', '=', term],
      ];
      const exactDomain = ['&', ['sale_ok', '=', true], ...orDomainConvalida(exactLeaves)];
      const exact = await searchReadConvalida<Product>(
        'product.product',
        exactDomain,
        ['id', 'display_name', 'name', 'default_code', 'barcode', 'uom_id', 'lst_price'],
        20
      );
      if (exact.length) {
        setProductCache((prev) => ({ ...prev, [key]: exact }));
        return exact;
      }
    }

    try {
      const leaves = [
        ['name', 'ilike', term],
        ['default_code', 'ilike', term],
        ['barcode', 'ilike', term],
      ];
      const domain = ['&', ['sale_ok', '=', true], ...orDomainConvalida(leaves)];
      const out = await searchReadConvalida<Product>(
        'product.product',
        domain,
        ['id', 'display_name', 'name', 'default_code', 'barcode', 'uom_id', 'lst_price'],
        20
      );
      setProductCache((prev) => ({ ...prev, [key]: out }));
      return out;
    } catch (e) {
      return [];
    }
  };

  // --------------------------------------------------------------------------
  // FORZA INVENTARIO FUNCTIONS
  // --------------------------------------------------------------------------

  const handleOpenForzaInventario = async (move: StockMove, pick: StockPicking) => {
    setForzaLoading(true);
    try {
      const productId = move.product_id[0];
      const productName = move.product_id[1];
      const locationId = move.location_id[0];

      // Cerca quant esistente per questo prodotto e ubicazione
      const quants = await searchReadConvalida<StockQuant>(
        'stock.quant',
        [
          ['product_id', '=', productId],
          ['location_id.usage', '=', 'internal']
        ],
        ['id', 'product_id', 'location_id', 'quantity', 'inventory_quantity', 'lot_id', 'reserved_quantity'],
        0
      );

      // Se non ci sono quant, cerca tutte le ubicazioni interne disponibili
      let availableQuants = quants;
      if (quants.length === 0) {
        // Crea un quant "virtuale" per mostrare le info
        availableQuants = [{
          id: 0,
          product_id: move.product_id,
          location_id: move.location_id,
          quantity: 0,
          inventory_quantity: 0,
          lot_id: false,
          reserved_quantity: 0
        }];
      }

      setForzaData({
        productId,
        productName,
        pickingId: pick.id,
        pickingName: pick.name,
        moveId: move.id,
        quants: availableQuants,
        selectedQuantId: availableQuants.length > 0 ? availableQuants[0].id : null,
        selectedLocationId: availableQuants.length > 0 ? availableQuants[0].location_id[0] : locationId,
        newQuantity: availableQuants.length > 0 ? availableQuants[0].quantity : 0
      });
      setShowForzaModal(true);
    } catch (error: any) {
      showToastMessage(`Errore: ${error.message}`);
    } finally {
      setForzaLoading(false);
    }
  };

  const handleConfirmForzaInventario = async () => {
    if (!forzaData) return;

    setForzaLoading(true);
    try {
      const { productId, productName, pickingId, pickingName, selectedQuantId, selectedLocationId, newQuantity, quants } = forzaData;
      const selectedQuant = quants.find(q => q.id === selectedQuantId);
      const oldQuantity = selectedQuant ? selectedQuant.quantity : 0;

      if (selectedQuantId && selectedQuantId > 0) {
        // Aggiorna il quant esistente
        await callKwConvalida('stock.quant', 'write', [[selectedQuantId], {
          inventory_quantity: newQuantity,
          inventory_date: new Date().toISOString().slice(0, 10)
        }], {});

        // Applica l'inventario
        await callKwConvalida('stock.quant', 'action_apply_inventory', [[selectedQuantId]], {});
      } else {
        // Se non esiste un quant, dobbiamo crearlo tramite un aggiustamento inventario
        // Prima cerchiamo o creiamo un quant
        const newQuants = await searchReadConvalida<StockQuant>(
          'stock.quant',
          [
            ['product_id', '=', productId],
            ['location_id', '=', selectedLocationId]
          ],
          ['id'],
          1
        );

        let quantId: number;
        if (newQuants.length > 0) {
          quantId = newQuants[0].id;
        } else {
          // Crea un nuovo quant
          quantId = await callKwConvalida<number>('stock.quant', 'create', [{
            product_id: productId,
            location_id: selectedLocationId,
            quantity: 0,
            inventory_quantity: newQuantity
          }], {});
        }

        // Imposta la quantita' inventario
        await callKwConvalida('stock.quant', 'write', [[quantId], {
          inventory_quantity: newQuantity,
          inventory_date: new Date().toISOString().slice(0, 10)
        }], {});

        // Applica
        await callKwConvalida('stock.quant', 'action_apply_inventory', [[quantId]], {});
      }

      // Traccia nel chatter del picking
      const timestamp = new Date().toLocaleString('it-IT');
      const locationName = selectedQuant ? selectedQuant.location_id[1] : 'Ubicazione';
      const message = `
        <p><strong>📦 Forza Inventario eseguito</strong></p>
        <ul>
          <li><strong>Prodotto:</strong> ${productName}</li>
          <li><strong>Ubicazione:</strong> ${locationName}</li>
          <li><strong>Quantita' precedente:</strong> ${oldQuantity}</li>
          <li><strong>Nuova quantita':</strong> ${newQuantity}</li>
          <li><strong>Data:</strong> ${timestamp}</li>
        </ul>
      `;

      await callKwConvalida('stock.picking', 'message_post', [[pickingId]], {
        body: message,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note'
      });

      showToastMessage(`Inventario forzato: ${productName} = ${newQuantity}`);
      setShowForzaModal(false);
      setForzaData(null);

      // Ricarica i dati per aggiornare le disponibilita'
      handleLoad();
    } catch (error: any) {
      showToastMessage(`Errore: ${error.message}`);
    } finally {
      setForzaLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // CORREGGI SCADENZA FUNCTIONS
  // --------------------------------------------------------------------------

  const handleOpenScadenza = async (move: StockMove, lotInfo: [number, string], pick: StockPicking) => {
    const lots = await searchReadConvalida('stock.production.lot', [['id', '=', lotInfo[0]]], ['id', 'name', 'expiration_date', 'use_date'], 1);
    const lot = lots[0];
    setScadenzaData({
      moveId: move.id,
      pickingId: pick.id,
      productName: move.product_id[1],
      lotId: lot.id,
      lotName: lot.name,
      currentExpiration: lot.expiration_date
    });
    setNewExpirationDate(lot.expiration_date ? lot.expiration_date.split(' ')[0] : '');
    setShowScadenzaModal(true);
  };

  const handleConfirmScadenza = async () => {
    if (!scadenzaData || !newExpirationDate) return;
    setScadenzaLoading(true);
    try {
      await callKwConvalida('stock.production.lot', 'write', [[scadenzaData.lotId], { expiration_date: newExpirationDate }], {});
      await callKwConvalida('stock.picking', 'message_post', [[scadenzaData.pickingId]], {
        body: `<p>📅 <strong>Scadenza corretta</strong></p><p>Prodotto: ${scadenzaData.productName}<br/>Lotto: ${scadenzaData.lotName}<br/>Vecchia scadenza: ${scadenzaData.currentExpiration || 'N/A'}<br/>Nuova scadenza: ${newExpirationDate}</p>`,
        message_type: 'comment', subtype_xmlid: 'mail.mt_note'
      });
      setToastMessage(`Scadenza aggiornata per lotto ${scadenzaData.lotName}`);
      setShowToast(true);
      setShowScadenzaModal(false);
    } catch (e) { setStatusMessage('Errore: ' + (e as Error).message); }
    setScadenzaLoading(false);
  };

  // --------------------------------------------------------------------------
  // SOSTITUZIONE PRODOTTO FUNCTIONS
  // --------------------------------------------------------------------------

  const handleOpenSostituzione = (move: StockMove, pick: StockPicking) => {
    setSostituzioneData({
      moveId: move.id,
      pickingId: pick.id,
      pickingName: pick.name,
      originalProductId: move.product_id[0],
      originalProductName: move.product_id[1],
      originalQty: move.product_uom_qty,
      locationId: move.location_id[0],
      locationDestId: move.location_dest_id[0],
      saleOrderId: pick.sale_id ? pick.sale_id[0] : null,
      saleOrderName: pick.sale_id ? pick.sale_id[1] : null
    });
    setSostituzioneQty(move.product_uom_qty);
    setSelectedSostituto(null);
    setSostituzioneSearch('');
    setSostituzioneSuggestions([]);
    setShowSostituzioneModal(true);
  };

  // Apre il modal sostituzione con i prodotti alternativi già caricati
  const handleOpenAlternativa = async (move: StockMove, pick: StockPicking) => {
    setSostituzioneData({
      moveId: move.id,
      pickingId: pick.id,
      pickingName: pick.name,
      originalProductId: move.product_id[0],
      originalProductName: move.product_id[1],
      originalQty: move.product_uom_qty,
      locationId: move.location_id[0],
      locationDestId: move.location_dest_id[0],
      saleOrderId: pick.sale_id ? pick.sale_id[0] : null,
      saleOrderName: pick.sale_id ? pick.sale_id[1] : null
    });
    setSostituzioneQty(move.product_uom_qty);
    setSelectedSostituto(null);
    setSostituzioneSearch('ALTERNATIVE');
    setSostituzioneSuggestions([]);
    setShowSostituzioneModal(true);

    // Carica i prodotti alternativi da product.template
    setSostituzioneLoading(true);
    try {
      // Prima otteniamo il product.template dal product.product
      const productData = await searchReadConvalida<{ product_tmpl_id: [number, string] }>(
        'product.product',
        [['id', '=', move.product_id[0]]],
        ['product_tmpl_id'],
        1
      );

      if (productData.length > 0 && productData[0].product_tmpl_id) {
        const templateId = productData[0].product_tmpl_id[0];

        // Ora otteniamo i prodotti alternativi dal template
        const templateData = await searchReadConvalida<{ alternative_product_ids: number[] }>(
          'product.template',
          [['id', '=', templateId]],
          ['alternative_product_ids'],
          1
        );

        if (templateData.length > 0 && templateData[0].alternative_product_ids && templateData[0].alternative_product_ids.length > 0) {
          // Carichiamo i dettagli dei prodotti alternativi (sono product.template, dobbiamo prendere i product.product)
          const alternativeProducts = await searchReadConvalida<Product>(
            'product.product',
            [['product_tmpl_id', 'in', templateData[0].alternative_product_ids]],
            ['id', 'name', 'display_name', 'default_code', 'barcode', 'uom_id', 'lst_price'],
            100
          );

          setSostituzioneSuggestions(alternativeProducts);
          if (alternativeProducts.length > 0) {
            setSelectedSostituto(alternativeProducts[0]);
          }
        } else {
          showToastMessage('Nessun prodotto alternativo configurato per questo prodotto');
        }
      }
    } catch (error: any) {
      console.error('Errore caricamento alternative:', error);
      showToastMessage(`Errore: ${error.message}`);
    } finally {
      setSostituzioneLoading(false);
    }
  };

  const handleSearchSostituto = async (term: string) => {
    if (term.length < 2) {
      setSostituzioneSuggestions([]);
      setSelectedSostituto(null);
      return;
    }

    setSostituzioneLoading(true);
    try {
      const results = await superSearch(term);
      setSostituzioneSuggestions(results);
      if (results.length > 0) {
        setSelectedSostituto(results[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSostituzioneLoading(false);
    }
  };

  const handleConfirmSostituzione = async () => {
    if (!selectedSostituto || !sostituzioneData) {
      showToastMessage('Seleziona un prodotto sostitutivo');
      return;
    }

    if (!sostituzioneData.saleOrderId) {
      showToastMessage('Ordine di vendita non trovato per questo picking');
      return;
    }

    setSostituzioneLoading(true);
    try {
      // Ottieni dettagli prodotto per UOM
      const pdet = await searchReadConvalida<Product>(
        'product.product',
        [['id', '=', selectedSostituto.id]],
        ['id', 'name', 'uom_id', 'product_tmpl_id'],
        1
      );
      const uomId = pdet.length && pdet[0].uom_id ? pdet[0].uom_id[0] : null;

      // Crea riga ordine di vendita (come AGGIUNGI PRODOTTO)
      const vals: any = {
        order_id: sostituzioneData.saleOrderId,
        product_id: selectedSostituto.id,
        product_uom_qty: sostituzioneQty,
      };
      if (uomId) vals.product_uom = uomId;

      const newLineId = await callKwConvalida<number>('sale.order.line', 'create', [vals], {});

      // Ricalcola prezzo dal listino
      try {
        await callKwConvalida('sale.order.line', '_compute_price_unit', [[newLineId]]);
      } catch (e) {
        try {
          await callKwConvalida('sale.order.line', 'product_uom_change', [[newLineId]]);
        } catch (e2) {
          console.log('Fallback: price will be computed by Odoo on save');
        }
      }

      // Traccia nel chatter del picking
      const timestamp = new Date().toLocaleString('it-IT');
      const message = `
        <p><strong>🔄 Sostituzione Prodotto</strong></p>
        <ul>
          <li><strong>Prodotto originale (mancante):</strong> ${sostituzioneData.originalProductName}</li>
          <li><strong>Quantità richiesta:</strong> ${sostituzioneData.originalQty}</li>
          <li><strong>Prodotto sostitutivo:</strong> ${selectedSostituto.name}</li>
          <li><strong>Quantità sostitutiva:</strong> ${sostituzioneQty}</li>
          <li><strong>Data:</strong> ${timestamp}</li>
        </ul>
        <p><em>Aggiunto all'ordine ${sostituzioneData.saleOrderName}</em></p>
      `;

      await callKwConvalida('stock.picking', 'message_post', [[sostituzioneData.pickingId]], {
        body: message,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note'
      });

      showToastMessage(`Sostituzione: ${sostituzioneData.originalProductName} → ${selectedSostituto.name} (aggiunto a ${sostituzioneData.saleOrderName})`);
      setShowSostituzioneModal(false);
      setSostituzioneData(null);
      setSelectedSostituto(null);
      setSostituzioneSearch('');
      setSostituzioneSuggestions([]);

      // Ricarica i dati
      handleLoad();
    } catch (error: any) {
      showToastMessage(`Errore: ${error.message}`);
    } finally {
      setSostituzioneLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // RENDER HELPERS
  // --------------------------------------------------------------------------

  const renderGroups = () => {
    if (groups.size === 0 && !isLoading) {
      return (
        <div className="card">
          <p style={{ color: 'var(--muted)' }}>{statusMessage}</p>
        </div>
      );
    }

    return Array.from(groups.entries()).map(([key, grp]) => (
      <div key={key} className="group">
        <div className="ghead">
          <span className="pill strong">👤 {grp.driver}</span>
          <span className="pill strong">🧭 {grp.carrier}</span>
        </div>
        {grp.pickings.map((pick) => renderPicking(pick))}
      </div>
    ));
  };

  const renderPicking = (pick: StockPicking) => {
    const saleName = pick.sale_id ? pick.sale_id[1] : pick.origin || '-';
    const righe = moves.filter((m) => m.picking_id && m.picking_id[0] === pick.id);

    // Formatta data di consegna
    const deliveryDate = pick.scheduled_date
      ? new Date(pick.scheduled_date).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      : '-';

    // Stato pick con icona e colore
    const stateInfo = {
      assigned: { label: 'Pronto', icon: '✅', color: '#16a34a' },
      confirmed: { label: 'In Attesa', icon: '⏳', color: '#f59e0b' },
      waiting: { label: 'In Attesa', icon: '⏳', color: '#f59e0b' },
      draft: { label: 'Bozza', icon: '📝', color: '#6b7280' },
    }[pick.state] || { label: pick.state, icon: '❓', color: '#6b7280' };

    // Verifica se è un residuo (backorder)
    const isBackorder = pick.backorder_id !== false;

    return (
      <div key={pick.id} className="card">
        <div className="pick-head">
          <span className="pill">
            📦 <b>{pick.name}</b>
          </span>
          {isBackorder && (
            <span className="pill" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}>
              🔄 Residuo
            </span>
          )}
          <span className="pill" style={{ background: `${stateInfo.color}20`, color: stateInfo.color, borderColor: stateInfo.color }}>
            {stateInfo.icon} {stateInfo.label}
          </span>
          <span className="pill">
            Cliente: <b>{pick.partner_id ? pick.partner_id[1] : '-'}</b>
          </span>
          <span className="pill">
            📅 Consegna: <b>{deliveryDate}</b>
          </span>
          <span className="pill">
            🧾 Ordine: <b>{saleName || '-'}</b>
          </span>
          <button
            onClick={() => handleConvalidaPicking(pick)}
            disabled={convalidaLoading === pick.id}
            style={{
              background: 'var(--ok)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 15,
              fontWeight: 700,
              cursor: convalidaLoading === pick.id ? 'wait' : 'pointer',
              marginLeft: 'auto',
              minHeight: 44
            }}
          >
            {convalidaLoading === pick.id ? 'Convalida...' : 'CONVALIDA'}
          </button>
        </div>
        <div className="list">
          {righe.length === 0 ? (
            <div className="row">
              <span style={{ color: 'var(--muted)' }}>Nessuna riga</span>
            </div>
          ) : (
            righe.map((move) => renderMove(move, pick))
          )}
        </div>
      </div>
    );
  };

  const renderMove = (move: StockMove, pick: StockPicking) => {
    const done = Number(doneByMove[move.id] || 0);
    const plan = Number(move.product_uom_qty || 0);
    const perc = ratio(done, plan).toFixed(0);
    const uom = move.product_uom ? move.product_uom[1] : '-';
    const ubic = bestLocationForMove(move.id);

    // Info prodotto: stock, arrivi e prenotazioni
    const productId = move.product_id[0];
    const stock = productStock[productId] || [];
    const incoming = productIncoming[productId] || [];
    const reservations = productReservations[productId] || [];

    // Calcola stock totale disponibile (libero = qty - reserved)
    const totalAvailable = stock.reduce((sum, s) => sum + Math.max(0, s.qty - s.reserved), 0);
    const hasStock = totalAvailable > 0;

    // Valore originale per confronto
    const originalDone = doneByMove[move.id] || 0;

    // Ottieni info lotto dal move
    const lineInfos = lineInfoByMove[move.id] || [];
    const lotInfo = lineInfos.length > 0 && lineInfos[0].lot ? lineInfos[0].lot : null;

    return (
      <div key={move.id} className="row" data-move={move.id}>
        <div className="prod">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>{move.product_id[1]}</span>
            <span style={{
              display: 'inline-block',
              background: 'var(--chip)',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--accent)'
            }}>
              {uom}
            </span>
          </div>
          <div className="sub">
            Ubic.: <b>{ubic}</b>
          </div>

          {/* Disponibilità ubicazioni - formato compatto */}
          {stock.length > 0 && (
            <div className="sub" style={{ marginTop: '6px', color: 'var(--accent)', fontSize: '12px' }}>
              {stock.map((s, i) => {
                const available = s.qty - s.reserved;
                const shortLocation = s.location.split('/').pop() || s.location;
                // Trova il cliente che ha riservato (se presente)
                const reservedCustomer = reservations.length > 0 ? reservations.map(r => r.customer).join(', ') : '';
                return (
                  <div key={i} style={{ marginBottom: i < stock.length - 1 ? '2px' : 0 }}>
                    📍 <b>{shortLocation}</b>
                    <span style={{ color: 'var(--muted)' }}> | </span>
                    Giac: <b>{s.qty}</b> {uom}
                    {available > 0 && (
                      <>
                        <span style={{ color: 'var(--muted)' }}> | </span>
                        <span style={{ color: '#16a34a' }}>Libero: <b>{available.toFixed(1)}</b> {uom}</span>
                      </>
                    )}
                    {s.reserved > 0 && (
                      <>
                        <span style={{ color: 'var(--muted)' }}> | </span>
                        <span style={{ color: '#f59e0b' }}>Ris: <b>{s.reserved}</b> {uom}</span>
                        {reservedCustomer && <span style={{ color: '#f59e0b' }}> ({reservedCustomer})</span>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Arrivi in corso - formato compatto */}
          {incoming.length > 0 && (() => {
            const totalQty = incoming.reduce((sum, inc) => sum + inc.qty, 0);
            const dates = [...new Set(incoming.map(inc => inc.date).filter(Boolean))];
            const formattedDates = dates.map(d => new Date(d).toLocaleDateString('it-IT')).join(', ');
            return (
              <div className="sub" style={{ marginTop: '4px', color: '#f59e0b', fontSize: '12px' }}>
                🚚 <b>{totalQty}</b> {uom} {formattedDates && `- ${formattedDates}`}
              </div>
            );
          })()}
        </div>
        <div className="qty">
          Previsto: <b>{plan}</b>
        </div>

        {/* Selezione ubicazione */}
        {stock.length > 1 && (
          <div style={{ marginTop: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--muted)' }}>📍 Preleva da: </label>
            <select
              style={{
                background: 'var(--card)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '13px',
                marginLeft: '8px'
              }}
              defaultValue=""
              onChange={(e) => {
                // Salva la selezione in un ref o state se necessario
                console.log('Ubicazione selezionata:', e.target.value);
              }}
            >
              <option value="">-- Seleziona ubicazione --</option>
              {stock.map((s, i) => {
                const available = Math.max(0, s.qty - s.reserved);
                return (
                  <option key={i} value={s.location} disabled={available <= 0}>
                    {s.location} (Libero: {available.toFixed(1)} {uom})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div>
          Fatto:
          <input
            type="number"
            step="0.01"
            min="0"
            defaultValue={done}
            id={`convalida_done_${move.id}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveOne(move.id);
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button
            className="btn slim green"
            type="button"
            onClick={() => handleSaveOne(move.id)}
            id={`convalida_save_${move.id}`}
            style={{ fontSize: '10px', padding: '4px 8px' }}
          >
            SALVA
          </button>
          <button
            className="btn slim orange"
            type="button"
            onClick={() => handleOpenForzaInventario(move, pick)}
            disabled={forzaLoading || hasStock}
            title={hasStock ? 'Stock disponibile - non serve forzare' : 'Forza quantita inventario'}
            style={{ fontSize: '10px', padding: '4px 8px' }}
          >
            {forzaLoading ? '...' : '📦 FORZA'}
          </button>
          <button
            className="btn slim purple"
            type="button"
            onClick={() => handleOpenSostituzione(move, pick)}
            disabled={sostituzioneLoading}
            title="Sostituisci prodotto"
            style={{ fontSize: '10px', padding: '4px 8px' }}
          >
            {sostituzioneLoading ? '...' : '🔄 SOSTITUISCI'}
          </button>
          <button
            className="btn slim teal"
            type="button"
            onClick={() => handleOpenAlternativa(move, pick)}
            disabled={sostituzioneLoading}
            title="Mostra prodotti alternativi configurati"
            style={{ fontSize: '10px', padding: '4px 8px', background: '#14b8a6', borderColor: '#0d9488' }}
          >
            {sostituzioneLoading ? '...' : '🔀 ALTERNATIVA'}
          </button>
          {lotInfo && (
            <button
              className="btn slim blue"
              type="button"
              onClick={() => handleOpenScadenza(move, lotInfo, pick)}
              disabled={scadenzaLoading}
              title="Correggi scadenza lotto"
              style={{ fontSize: '10px', padding: '4px 8px' }}
            >
              {scadenzaLoading ? '...' : '📅 SCADENZA'}
            </button>
          )}
        </div>
        <div className="status" id={`convalida_st_${move.id}`}></div>
        <div className="bar" style={{ gridColumn: '1 / -1' }}>
          <span id={`convalida_bar_${move.id}`} style={{ width: `${perc}%` }}></span>
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER PRINCIPALE
  // --------------------------------------------------------------------------

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: #0b1220;
          --text: #e5e7eb;
          --muted: #94a3b8;
          --card: #0f172a;
          --card-alt: #131d2e;
          --border: #1f2937;
          --chip: #0b1220;
          --ok: #16a34a;
          --err: #ef4444;
          --accent: #22c55e;
          --accent2: #2563eb;
          --btnText: #052112;
          --btnText2: #eaf2ff;
          --orange: #f97316;
          --blue: #3b82f6;
          --purple: #8b5cf6;
          --green: #22c55e;
        }

        [data-theme='light'] {
          /* Light theme */
          --bg: #f6f8fc;
          --text: #0a1628;
          --muted: #5b6a7f;
          --card: #ffffff;
          --card-alt: #f8fafc;
          --border: #e5e9f2;
          --chip: #eef3fb;
          --accent: #0ea5e9;
          --accent2: #7c3aed;
          --btnText: #04212b;
          --btnText2: #f1eaff;
        }

        html,
        body {
          height: 100%;
        }
        body {
          margin: 0;
          background: var(--bg);
          color: var(--text);
          font: 16px/1.5 system-ui, Segoe UI, Arial;
        }

        #convalida-app {
          position: fixed;
          inset: 0;
          z-index: 999999;
          overflow: auto;
          background: radial-gradient(1200px 800px at 20% -10%, #111827 0%, var(--bg) 55%, var(--bg) 100%);
        }

        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @media (prefers-reduced-motion: no-preference) {
          [data-theme='light'] #convalida-app {
            background: linear-gradient(120deg, #e6f3ff 0%, #fff5f9 40%, #f5f7ff 70%, #eaf9ff 100%);
            background-size: 200% 200%;
            animation: gradientShift 18s ease infinite;
          }
        }

        * {
          box-sizing: border-box;
        }
        .wrap {
          max-width: 1200px;
          margin: 22px auto;
          padding: 0 18px 40px;
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          background: color-mix(in oklab, var(--bg) 80%, transparent);
          border-bottom: 1px solid var(--border);
          padding: 12px 16px;
          margin: 0 -18px 18px;
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .title {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.2px;
          margin-right: auto;
        }

        .btn {
          min-height: 44px;
          padding: 12px 18px;
          border: 0;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 700;
          font-size: 15px;
          transition: all 0.15s ease;
          touch-action: manipulation;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn:active {
          transform: translateY(1px);
        }
        .btn.green {
          background: var(--accent);
          color: var(--btnText);
        }
        .btn.blue {
          background: var(--blue);
          color: white;
        }
        .btn.orange {
          background: var(--orange);
          color: white;
        }
        .btn.purple {
          background: var(--purple);
          color: white;
        }
        .btn.ghost {
          background: var(--chip);
          color: var(--muted);
          border: 1px solid var(--border);
        }
        .btn.slim {
          min-height: 40px;
          padding: 10px 14px;
          font-size: 13px;
          border-radius: 10px;
        }
        .btn.slim.green {
          background: var(--green);
          color: white;
        }
        .btn.slim.blue {
          background: var(--blue);
          color: white;
        }
        .btn.slim.orange {
          background: var(--orange);
          color: white;
        }
        .btn.slim.purple {
          background: var(--purple);
          color: white;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .info {
          color: var(--muted);
          font-size: 13px;
        }

        .filters-bar {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
          padding: 12px 0;
          margin-bottom: 8px;
          border-bottom: 1px solid var(--border);
        }

        .filter-group {
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: wrap;
        }

        .filter-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--muted);
          margin-right: 4px;
        }

        .btn.filter-btn {
          min-height: 40px;
          padding: 10px 16px;
          font-size: 14px;
          border-radius: 8px;
          background: var(--chip);
          color: var(--muted);
          border: 1px solid var(--border);
          transition: all 0.15s;
        }

        .btn.filter-btn:hover {
          border-color: var(--accent);
          color: var(--text);
        }

        .btn.filter-btn.active {
          background: var(--accent);
          color: var(--btnText);
          border-color: var(--accent);
          font-weight: 700;
        }

        .group {
          margin: 18px 0;
        }
        .ghead {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 36px;
          padding: 8px 14px;
          border-radius: 999px;
          background: var(--chip);
          border: 1px solid var(--border);
          color: var(--muted);
          font-size: 14px;
        }
        .pill.strong {
          color: var(--text);
        }

        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          margin: 12px 0;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .card:nth-child(even) {
          background: var(--card-alt);
        }

        .pick-head {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
        }

        .list .row {
          display: grid;
          grid-template-columns: minmax(280px, 1fr) 120px 160px auto auto;
          gap: 10px;
          align-items: center;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          margin: 12px 0;
          border-left: 4px solid var(--accent);
        }

        .prod {
          font-weight: 700;
          font-size: 15px;
          color: var(--text);
        }

        [data-theme='light'] .prod {
          color: #09121d;
        }

        .sub {
          font-size: 12px;
          color: var(--muted);
          margin-top: 4px;
        }

        .qty {
          color: var(--text);
        }

        input[type='number'] {
          width: 100%;
          max-width: 140px;
          min-height: 48px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 2px solid var(--border);
          background: color-mix(in oklab, var(--bg) 92%, white 8%);
          color: var(--text);
          font-weight: 700;
          font-size: 18px;
          text-align: center;
        }

        input[type='number']:focus {
          outline: none;
          border-color: var(--accent);
        }

        .status {
          font-size: 12px;
        }
        .ok {
          color: var(--ok);
        }
        .err {
          color: var(--err);
        }
        .muted {
          color: var(--muted);
        }

        .bar {
          height: 10px;
          background: color-mix(in oklab, var(--bg) 85%, white 15%);
          border-radius: 999px;
          overflow: hidden;
        }

        .bar > span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, var(--accent), #16a34a);
          width: 0%;
          transition: width 0.3s ease;
        }

        .toast {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 10;
          background: var(--card);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 10px 14px;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          opacity: 0;
          transform: translateY(6px);
          transition: 0.2s;
        }

        .toast.show {
          opacity: 1;
          transform: translateY(0);
        }

        .loading {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          animation: spin 1s linear infinite;
          display: inline-block;
          vertical-align: -3px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .qa-modal-convalida {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.68);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 1000000;
        }

        .qa-modal-convalida.show {
          display: flex;
        }

        .qa-dialog {
          width: 720px;
          max-width: 95vw;
          background: #f8fafc;
          color: #0f172a;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
        }

        [data-theme='light'] .qa-dialog {
          background: #f8fafc;
          color: #0f172a;
          border-color: #cbd5e1;
        }

        .qa-head {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 14px 14px 0 0;
        }

        .qa-head h3 {
          margin: 0;
          font-size: 18px;
          flex: 1;
        }

        .qa-body {
          padding: 14px 16px;
        }

        .qa-search {
          display: flex;
          gap: 8px;
        }

        .qa-search input[type='text'] {
          flex: 1;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
        }

        .qa-search input[type='number'] {
          width: 110px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
        }

        .qa-suggest {
          margin-top: 12px;
          max-height: 50vh;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .qa-sugg {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          text-align: left;
          padding: 14px 16px;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          background: #ffffff;
          color: #0f172a;
          cursor: pointer;
          transition: all 0.15s;
          gap: 16px;
        }

        .qa-sugg:hover,
        .qa-sugg.active {
          border-color: #3b82f6;
          background: #eff6ff;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
        }

        .qa-sugg .prod-info {
          flex: 1;
          min-width: 0;
        }

        .qa-sugg .name {
          font-weight: 700;
          font-size: 15px;
          margin-bottom: 4px;
        }
        .qa-sugg .meta {
          font-size: 12px;
          color: #64748b;
        }
        .qa-sugg .stock-info {
          flex-shrink: 0;
          text-align: right;
          padding: 8px 12px;
          background: #f0fdf4;
          border-radius: 8px;
        }
        .qa-sugg .stock-available {
          color: #16a34a;
          font-weight: 700;
          font-size: 14px;
          white-space: nowrap;
        }

        input[type='number']:focus {
          outline: none;
          border-color: var(--accent);
        }
        .qa-sugg .stock-incoming {
          color: #f59e0b;
          font-weight: 600;
        }

        .qa-foot {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 0 0 14px 14px;
        }

        .btn.light {
          background: #e2e8f0;
          border-color: #cbd5e1;
          color: #475569;
        }

        .qa-close {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-weight: 700;
          font-size: 20px;
        }
        .qa-close:hover {
          color: #0f172a;
        }

        /* TABLET OPTIMIZATION (768px - 1024px) */
        @media (min-width: 768px) and (max-width: 1024px) {
          .wrap {
            padding: 0 12px 24px;
          }
          .title {
            font-size: 16px;
          }
          .topbar {
            gap: 8px;
            padding: 10px 12px;
          }
          .btn {
            min-height: 38px;
            padding: 8px 12px;
            font-size: 12px;
          }
          .btn.slim {
            min-height: 32px;
            padding: 6px 10px;
            font-size: 11px;
          }
          .btn.filter-btn {
            padding: 4px 8px;
            font-size: 10px;
            min-height: 28px;
          }
          .filters-bar {
            gap: 8px;
            padding: 8px 0;
          }
          .filter-group {
            gap: 3px;
          }
          .filter-label {
            font-size: 10px;
          }
          .pill {
            font-size: 10px;
            padding: 4px 8px;
          }
          .card {
            padding: 10px;
          }
          .pick-head {
            gap: 6px;
            flex-wrap: wrap;
          }
          .pick-head button {
            min-height: 36px;
            padding: 8px 14px;
            font-size: 12px;
          }
          .ghead {
            gap: 6px;
          }
          .ghead .pill {
            font-size: 11px;
          }
          .list .row {
            grid-template-columns: 1fr auto auto;
            gap: 8px;
            padding: 10px;
          }
          .row .prod {
            grid-column: 1 / -1;
            font-size: 12px;
          }
          .row .bar {
            grid-column: 1 / -1;
            height: 8px;
          }
          .row .sub {
            font-size: 11px;
          }
          .row .info {
            font-size: 10px;
          }
          .row .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            justify-content: flex-end;
          }
          .row .actions .btn.slim {
            min-height: 30px;
            padding: 5px 8px;
            font-size: 10px;
          }
          input[type='number'] {
            width: 70px;
            min-height: 36px;
            padding: 8px 10px;
            font-size: 14px;
          }
          select {
            min-height: 36px;
            padding: 6px 10px;
            font-size: 11px;
          }
          .qa-dialog {
            width: 95vw;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
          }
          .qa-body {
            flex: 1;
            overflow-y: auto;
            max-height: calc(85vh - 140px);
          }
          .qa-foot {
            flex-shrink: 0;
          }
          .qa-suggest {
            max-height: 30vh;
          }
        }

        @media (max-width: 1024px) {
          .wrap {
            padding: 0 10px 24px;
          }
          .title {
            font-size: 18px;
          }
          .list .row {
            grid-template-columns: 1fr 1fr;
          }
          .row .prod,
          .row .bar {
            grid-column: 1 / -1;
          }
          .qa-dialog {
            width: 95vw;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
          }
          .qa-body {
            flex: 1;
            overflow-y: auto;
            max-height: calc(85vh - 140px);
          }
          .qa-foot {
            flex-shrink: 0;
          }
          .qa-suggest {
            max-height: 30vh;
          }
        }

        @media (max-width: 768px) {
          body {
            font-size: 14px;
          }
          .btn {
            min-height: 36px;
            padding: 8px 12px;
            font-size: 12px;
          }
          .btn.slim {
            min-height: 30px;
            padding: 6px 10px;
            font-size: 10px;
          }
          .btn.filter-btn {
            padding: 4px 8px;
            font-size: 10px;
            min-height: 26px;
          }
          .filters-bar {
            gap: 6px;
            padding: 6px 0;
          }
          .filter-group {
            gap: 3px;
          }
          .filter-label {
            font-size: 10px;
          }
          input[type='number'] {
            width: 60px;
            padding: 8px;
            min-height: 34px;
          }
          .topbar {
            gap: 6px;
            padding: 8px 10px;
          }
          .title {
            font-size: 14px;
          }
          .pill {
            font-size: 9px;
            padding: 3px 6px;
          }
          .pick-head {
            gap: 4px;
          }
          .ghead {
            gap: 4px;
          }
          .info {
            font-size: 10px;
          }
          .list .row {
            gap: 8px;
            padding: 10px;
          }
          .prod {
            font-size: 11px;
          }
          .sub {
            font-size: 10px;
          }
          .bar {
            height: 6px;
          }
        }

        /* Mobile improvements - tablet/phone */
        @media (max-width: 768px) {
          .ghead {
            flex-direction: column;
            gap: 6px;
            align-items: flex-start;
          }
          .card {
            padding: 10px;
          }
          .pick-head {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
          }
          .pick-head .pill {
            font-size: 10px;
            padding: 4px 8px;
          }
          .pick-head button {
            min-height: 36px;
            padding: 8px 16px;
            font-size: 12px;
            flex-shrink: 0;
          }
          /* Modal compatto per tablet */
          .qa-dialog {
            width: 100% !important;
            max-width: 100% !important;
            max-height: 85vh;
            border-radius: 12px;
            margin: 10px;
          }
          .qa-head {
            padding: 12px 16px;
          }
          .qa-head h3 {
            font-size: 16px;
          }
          .qa-body {
            padding: 12px 16px;
            max-height: calc(85vh - 160px);
            overflow-y: auto;
          }
          .qa-search {
            flex-direction: column;
            gap: 8px;
          }
          .qa-search input {
            width: 100% !important;
            font-size: 14px;
            padding: 10px 12px;
            min-height: 40px;
          }
          .qa-suggest {
            max-height: 25vh;
          }
          .qa-sugg {
            padding: 10px 12px;
          }
          .qa-sugg .name {
            font-size: 12px;
          }
          .qa-sugg .meta {
            font-size: 10px;
          }
          .qa-sugg .stock-info {
            font-size: 10px;
          }
          .qa-foot {
            padding: 12px 16px;
            gap: 8px;
            position: sticky;
            bottom: 0;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
          }
          .qa-foot button {
            min-height: 40px;
            font-size: 13px;
            padding: 10px 16px;
          }
          select {
            width: 100%;
            padding: 8px 10px;
            min-height: 36px;
            font-size: 12px;
          }
          /* Pulsanti azioni riga compatti */
          .btn.slim {
            min-height: 32px !important;
            padding: 6px 10px !important;
            font-size: 10px !important;
          }
          /* Input quantità compatto */
          input[type='number'] {
            width: 60px !important;
            min-height: 36px !important;
            padding: 6px 8px !important;
            font-size: 14px !important;
          }
        }

        @media (max-width: 380px) {
          .title {
            font-size: 16px;
          }
          .pill {
            font-size: 11px;
            padding: 6px 10px;
          }
        }
      `}</style>

      <div id="convalida-app">
        <div className="wrap">
          <div className="topbar">
            <a
              href="/dashboard"
              className="btn ghost"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
              }}
              title="Torna alla dashboard"
            >
              🏠 Home
            </a>
            <div className="title">Convalida Residui</div>
            <button className="btn ghost" type="button" onClick={toggleTheme} title="Cambia tema">
              {theme === 'light' ? '☀️ Chiaro' : '🌙 Scuro'}
            </button>
            <button className="btn green" type="button" onClick={handleLoad} disabled={isLoading}>
              {isLoading ? <span className="loading"></span> : 'CERCA'}
            </button>
          </div>

          {/* Filtri per data e tipo */}
          <div className="filters-bar">
            <div className="filter-group">
              <span className="filter-label">📅 Data:</span>
              <button
                className={`btn filter-btn ${dateFilter === 'ieri' ? 'active' : ''}`}
                onClick={() => setDateFilter('ieri')}
              >
                Ieri
              </button>
              <button
                className={`btn filter-btn ${dateFilter === 'oggi' ? 'active' : ''}`}
                onClick={() => setDateFilter('oggi')}
              >
                Oggi
              </button>
              <button
                className={`btn filter-btn ${dateFilter === 'domani' ? 'active' : ''}`}
                onClick={() => setDateFilter('domani')}
              >
                Domani
              </button>
              <button
                className={`btn filter-btn ${dateFilter === 'tutti' ? 'active' : ''}`}
                onClick={() => setDateFilter('tutti')}
              >
                Tutti
              </button>
            </div>
            <div className="filter-group">
              <span className="filter-label">📦 Tipo:</span>
              <button
                className={`btn filter-btn ${typeFilter === 'tutti' ? 'active' : ''}`}
                onClick={() => setTypeFilter('tutti')}
              >
                Tutti
              </button>
              <button
                className={`btn filter-btn ${typeFilter === 'attesa' ? 'active' : ''}`}
                onClick={() => setTypeFilter('attesa')}
              >
                In Attesa
              </button>
              <button
                className={`btn filter-btn ${typeFilter === 'residui' ? 'active' : ''}`}
                onClick={() => setTypeFilter('residui')}
              >
                Residui
              </button>
            </div>
            <div className="info">
              Invio salva la riga • Raggruppo per <b>Autista</b> e <b>Giro</b>
            </div>
          </div>
          {renderGroups()}
        </div>

        <div id="convalida-toast" className={`toast ${showToast ? 'show' : ''}`}>
          {toastMessage}
        </div>
      </div>

      {/* Modal Forza Inventario */}
      <div className={`qa-modal-convalida ${showForzaModal ? 'show' : ''}`}>
        <div className="qa-dialog" style={{ width: '560px' }}>
          <div className="qa-head">
            <h3>📦 Forza Inventario</h3>
            <button className="qa-close" onClick={() => { setShowForzaModal(false); setForzaData(null); }}>
              ✕
            </button>
          </div>
          <div className="qa-body">
            {forzaData && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Prodotto</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    {forzaData.productName}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Picking</div>
                  <div style={{ fontSize: '14px', color: '#0f172a' }}>
                    {forzaData.pickingName}
                  </div>
                </div>

                {forzaData.quants.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                      Seleziona ubicazione e quantita' attuale
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {forzaData.quants.map((quant) => (
                        <button
                          key={quant.id || `loc-${quant.location_id[0]}`}
                          type="button"
                          onClick={() => setForzaData({
                            ...forzaData,
                            selectedQuantId: quant.id,
                            selectedLocationId: quant.location_id[0],
                            newQuantity: quant.quantity
                          })}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px',
                            borderRadius: '10px',
                            border: forzaData.selectedQuantId === quant.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                            background: forzaData.selectedQuantId === quant.id ? '#eff6ff' : '#ffffff',
                            color: '#0f172a',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontWeight: '600' }}>{quant.location_id[1]}</div>
                          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                            Quantita' attuale: <b style={{ color: '#16a34a' }}>{quant.quantity}</b>
                            {quant.reserved_quantity > 0 && (
                              <span style={{ color: '#f59e0b', marginLeft: '8px' }}>
                                (Riservato: {quant.reserved_quantity})
                              </span>
                            )}
                            {quant.lot_id && (
                              <span style={{ marginLeft: '8px' }}>
                                Lotto: {quant.lot_id[1]}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                    Nuova quantita' da forzare
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={forzaData.newQuantity}
                    onChange={(e) => setForzaData({
                      ...forzaData,
                      newQuantity: parseFloat(e.target.value) || 0
                    })}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}
                  />
                </div>

                <div style={{
                  padding: '12px',
                  background: '#fef3c7',
                  borderRadius: '10px',
                  border: '1px solid #fcd34d',
                  color: '#92400e',
                  fontSize: '13px'
                }}>
                  <strong>Attenzione:</strong> Questa operazione modifichera' direttamente la quantita'
                  in magazzino e verra' tracciata nel chatter del picking.
                </div>
              </>
            )}
          </div>
          <div className="qa-foot">
            <button className="btn light" onClick={() => { setShowForzaModal(false); setForzaData(null); }}>
              Annulla
            </button>
            <button
              className="btn green"
              onClick={handleConfirmForzaInventario}
              disabled={!forzaData || forzaLoading}
            >
              {forzaLoading ? 'Salvataggio...' : 'Conferma Forza Inventario'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Sostituzione Prodotto */}
      <div className={`qa-modal-convalida ${showSostituzioneModal ? 'show' : ''}`}>
        <div className="qa-dialog" style={{ width: '720px' }}>
          <div className="qa-head">
            <h3>🔄 Sostituisci Prodotto</h3>
            <button className="qa-close" onClick={() => {
              setShowSostituzioneModal(false);
              setSostituzioneData(null);
              setSelectedSostituto(null);
              setSostituzioneSearch('');
              setSostituzioneSuggestions([]);
            }}>
              ✕
            </button>
          </div>
          <div className="qa-body">
            {sostituzioneData && (
              <>
                {/* Info prodotto originale */}
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: '#fee2e2',
                  borderRadius: '10px',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px', fontWeight: '600' }}>
                    Prodotto da sostituire
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#7f1d1d' }}>
                    {sostituzioneData.originalProductName}
                  </div>
                  <div style={{ fontSize: '13px', color: '#991b1b', marginTop: '4px' }}>
                    Picking: <b>{sostituzioneData.pickingName}</b> • Quantità: <b>{sostituzioneData.originalQty}</b>
                  </div>
                </div>

                {/* Ricerca prodotto sostitutivo */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                    Cerca prodotto sostitutivo
                  </div>
                  <div className="qa-search">
                    <input
                      ref={sostituzioneInputRef}
                      type="text"
                      placeholder="Nome, codice interno o barcode..."
                      value={sostituzioneSearch}
                      onChange={(e) => {
                        setSostituzioneSearch(e.target.value);
                        if (sostituzioneSearchTimerRef.current) clearTimeout(sostituzioneSearchTimerRef.current);
                        sostituzioneSearchTimerRef.current = setTimeout(() => {
                          handleSearchSostituto(e.target.value.trim());
                        }, 160);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && selectedSostituto) {
                          handleConfirmSostituzione();
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Lista suggerimenti */}
                <div className="qa-suggest" style={{ maxHeight: '250px' }}>
                  {sostituzioneLoading && <div style={{ color: '#b6c2da' }}>Ricerca in corso...</div>}
                  {!sostituzioneLoading && sostituzioneSuggestions.length === 0 && sostituzioneSearch.length >= 2 && (
                    <div style={{ color: '#b6c2da' }}>Nessun risultato</div>
                  )}
                  {sostituzioneSuggestions.map((prod) => {
                    const uom = prod.uom_id ? prod.uom_id[1] : '';
                    const code = prod.default_code ? ` • Cod.: ${prod.default_code}` : '';
                    const bar = prod.barcode ? ` • Barcode: ${prod.barcode}` : '';
                    const stock = productStock[prod.id] || [];

                    return (
                      <button
                        key={prod.id}
                        type="button"
                        className={`qa-sugg ${selectedSostituto?.id === prod.id ? 'active' : ''}`}
                        onClick={() => setSelectedSostituto(prod)}
                      >
                        <div className="prod-info">
                          <div className="name">{prod.display_name || prod.name}</div>
                          <div className="meta">
                            {uom}{code}{bar}
                          </div>
                        </div>
                        {stock.length > 0 && (
                          <div className="stock-info">
                            <span className="stock-available">
                              📍 {stock.reduce((sum, s) => sum + s.qty, 0).toFixed(1)} {uom}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Prodotto selezionato e quantità */}
                {selectedSostituto && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: '#dcfce7',
                    borderRadius: '10px',
                    border: '1px solid #bbf7d0'
                  }}>
                    <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px', fontWeight: '600' }}>
                      Prodotto sostitutivo selezionato
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#14532d' }}>
                      {selectedSostituto.display_name || selectedSostituto.name}
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '14px', color: '#166534' }}>Quantità:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={sostituzioneQty}
                        onChange={(e) => setSostituzioneQty(parseFloat(e.target.value) || 0)}
                        style={{
                          width: '120px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #86efac',
                          background: '#ffffff',
                          color: '#14532d',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}
                      />
                      <span style={{ fontSize: '13px', color: '#166534' }}>
                        {selectedSostituto.uom_id ? selectedSostituto.uom_id[1] : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* Avviso */}
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: '#fef3c7',
                  borderRadius: '10px',
                  border: '1px solid #fcd34d',
                  color: '#92400e',
                  fontSize: '13px'
                }}>
                  <strong>Attenzione:</strong> Questa operazione creerà un nuovo movimento con il prodotto
                  sostitutivo e annullerà il movimento originale. La sostituzione verrà tracciata nel chatter del picking.
                </div>
              </>
            )}
          </div>
          <div className="qa-foot">
            <button className="btn light" onClick={() => {
              setShowSostituzioneModal(false);
              setSostituzioneData(null);
              setSelectedSostituto(null);
              setSostituzioneSearch('');
              setSostituzioneSuggestions([]);
            }}>
              Annulla
            </button>
            <button
              className="btn blue"
              onClick={handleConfirmSostituzione}
              disabled={!selectedSostituto || !sostituzioneData || sostituzioneLoading || sostituzioneQty <= 0}
            >
              {sostituzioneLoading ? 'Sostituzione in corso...' : 'Conferma Sostituzione'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Correggi Scadenza */}
      <div className={`qa-modal-convalida ${showScadenzaModal ? 'show' : ''}`}>
        <div className="qa-dialog" style={{ width: '480px' }}>
          <div className="qa-head">
            <h3>📅 Correggi Scadenza</h3>
            <button className="qa-close" onClick={() => { setShowScadenzaModal(false); setScadenzaData(null); }}>
              ✕
            </button>
          </div>
          <div className="qa-body">
            {scadenzaData && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Prodotto</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    {scadenzaData.productName}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Lotto</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                    {scadenzaData.lotName}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Scadenza attuale</div>
                  <div style={{ fontSize: '14px', color: scadenzaData.currentExpiration ? '#0f172a' : '#94a3b8' }}>
                    {scadenzaData.currentExpiration || 'Non impostata'}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                    Nuova scadenza
                  </div>
                  <input
                    type="date"
                    value={newExpirationDate}
                    onChange={(e) => setNewExpirationDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}
                  />
                </div>

                <div style={{
                  padding: '12px',
                  background: '#dbeafe',
                  borderRadius: '10px',
                  border: '1px solid #93c5fd',
                  color: '#1e40af',
                  fontSize: '13px'
                }}>
                  <strong>Nota:</strong> Questa operazione aggiornera' la data di scadenza del lotto
                  e verra' tracciata nel chatter del picking.
                </div>
              </>
            )}
          </div>
          <div className="qa-foot">
            <button className="btn light" onClick={() => { setShowScadenzaModal(false); setScadenzaData(null); }}>
              Annulla
            </button>
            <button
              className="btn blue"
              onClick={handleConfirmScadenza}
              disabled={!scadenzaData || !newExpirationDate || scadenzaLoading}
            >
              {scadenzaLoading ? 'Salvataggio...' : 'Conferma'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
