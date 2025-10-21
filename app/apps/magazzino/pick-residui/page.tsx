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

// ============================================================================
// FUNZIONI RPC
// ============================================================================

async function callKw<T = any>(
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

async function searchRead<T = any>(
  model: string,
  domain: any[],
  fields: string[] = [],
  limit = 0,
  order = ''
): Promise<T[]> {
  return callKw<T[]>(model, 'search_read', [domain], { fields, limit, order });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function orDomain(leaves: any[][]): any[] {
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

export default function PickResiduiPage() {
  // --------------------------------------------------------------------------
  // STATE MANAGEMENT
  // --------------------------------------------------------------------------
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Pronto. Clicca CERCA per caricare i pick residui.');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Dati principali
  const [picks, setPicks] = useState<StockPicking[]>([]);
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [linesByMove, setLinesByMove] = useState<Record<number, number[]>>({});
  const [doneByMove, setDoneByMove] = useState<Record<number, number>>({});
  const [metaByMove, setMetaByMove] = useState<Record<number, StockMove>>({});
  const [lineInfoByMove, setLineInfoByMove] = useState<Record<number, LineInfo[]>>({});
  const [groups, setGroups] = useState<Map<string, GroupData>>(new Map());

  // Quick Add Modal
  const [showModal, setShowModal] = useState(false);
  const [modalOrder, setModalOrder] = useState<SaleOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQty, setSearchQty] = useState(1);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productCache, setProductCache] = useState<Record<string, Product[]>>({});
  const [searching, setSearching] = useState(false);

  // Refs
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

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

  // Focus automatico sul modal
  useEffect(() => {
    if (showModal && modalInputRef.current) {
      setTimeout(() => modalInputRef.current?.focus(), 50);
    }
  }, [showModal]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
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
  // LOAD DATA
  // --------------------------------------------------------------------------

  const handleLoad = async () => {
    setIsLoading(true);
    setStatusMessage('Carico…');

    try {
      const picksData = await searchRead<StockPicking>(
        'stock.picking',
        [
          ['backorder_id', '!=', false],
          ['name', 'ilike', 'PICK'],
          ['state', 'not in', ['done', 'cancel']],
        ],
        ['id', 'name', 'state', 'partner_id', 'driver_id', 'carrier_id', 'sale_id', 'origin', 'group_id'],
        0,
        'name asc'
      );

      if (!picksData.length) {
        setPicks([]);
        setMoves([]);
        setGroups(new Map());
        setStatusMessage('Nessun pick residuo.');
        return;
      }

      const pickIds = picksData.map((p) => p.id);
      const movesData = await searchRead<StockMove>(
        'stock.move',
        [['picking_id', 'in', pickIds]],
        ['id', 'picking_id', 'product_id', 'product_uom_qty', 'location_id', 'location_dest_id', 'product_uom'],
        0,
        'picking_id,id'
      );

      const moveIds = movesData.map((m) => m.id);
      const linesData = moveIds.length
        ? await searchRead<StockMoveLine>(
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
      setStatusMessage(`Caricati ${picksData.length} pick residui`);
    } catch (error: any) {
      setStatusMessage(`Errore: ${error.message}`);
      showToastMessage(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // UPDATE / SAVE FUNCTIONS
  // --------------------------------------------------------------------------

  const updateOne = async (moveId: number, value: number): Promise<void> => {
    try {
      let lineIds = linesByMove[moveId] || [];
      if (lineIds.length) {
        await callKw('stock.move.line', 'write', [[lineIds[0]], { qty_done: value }]);
      } else {
        const m = metaByMove[moveId];
        const vals = {
          move_id: moveId,
          picking_id: m.picking_id[0],
          product_id: m.product_id[0],
          qty_done: value,
          location_id: m.location_id[0],
          location_dest_id: m.location_dest_id[0],
          product_uom_id: m.product_uom[0],
        };
        const newId = await callKw<number>('stock.move.line', 'create', [vals]);
        setLinesByMove((prev) => ({ ...prev, [moveId]: [newId] }));
      }
      setDoneByMove((prev) => ({ ...prev, [moveId]: value }));
    } catch (error: any) {
      showToastMessage(`Errore: ${error.message}`);
      throw error;
    }
  };

  const handleSaveOne = async (moveId: number) => {
    const input = document.getElementById(`done_${moveId}`) as HTMLInputElement;
    if (!input) return;
    const value = Number(input.value || 0);
    await updateOne(moveId, value);
    showToastMessage('Riga aggiornata');
  };

  const handleSaveAll = async () => {
    setIsLoading(true);
    try {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[id^="done_"]');
      for (const input of Array.from(inputs)) {
        const moveId = Number(input.id.replace('done_', ''));
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
        const input = document.getElementById(`done_${id}`) as HTMLInputElement;
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
      const o = await searchRead<SaleOrder>(
        'sale.order',
        [['id', '=', pick.sale_id[0]]],
        ['id', 'name', 'pricelist_id', 'partner_id', 'state'],
        1
      );
      return o && o[0];
    }
    if (pick.origin) {
      const o = await searchRead<SaleOrder>(
        'sale.order',
        [['name', '=', pick.origin]],
        ['id', 'name', 'pricelist_id', 'partner_id', 'state'],
        1
      );
      if (o.length) return o[0];
    }
    if (pick.group_id) {
      const o = await searchRead<SaleOrder>(
        'sale.order',
        [['procurement_group_id', '=', pick.group_id[0]]],
        ['id', 'name', 'pricelist_id', 'partner_id', 'state'],
        1
      );
      if (o.length) return o[0];
    }
    return null;
  };

  const handleOpenQuickAdd = async (pickId: number) => {
    const pick = picks.find((p) => p.id === pickId);
    if (!pick) {
      showToastMessage('PICK non trovato');
      return;
    }
    const order = await ensureOrderForPick(pick);
    if (!order) {
      showToastMessage('Ordine di vendita non trovato per questo PICK');
      return;
    }
    setModalOrder(order);
    setShowModal(true);
    setSearchTerm('');
    setSuggestions([]);
    setSelectedProduct(null);
    setSearchQty(1);
  };

  const superSearch = async (term: string): Promise<Product[]> => {
    const key = term.toLowerCase();
    if (productCache[key]) return productCache[key];

    if (/^[0-9A-Za-z\-\.]{6,}$/.test(term)) {
      const exactLeaves = [
        ['barcode', '=', term],
        ['default_code', '=', term],
      ];
      const exactDomain = ['&', ['sale_ok', '=', true], ...orDomain(exactLeaves)];
      const exact = await searchRead<Product>(
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
      const domain = ['&', ['sale_ok', '=', true], ...orDomain(leaves)];
      const out = await searchRead<Product>(
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

  const handleSearchProduct = async (term: string) => {
    if (term.length < 2) {
      setSuggestions([]);
      setSelectedProduct(null);
      return;
    }

    setSearching(true);
    try {
      const results = await superSearch(term);
      setSuggestions(results);
      if (results.length > 0) {
        setSelectedProduct(results[0]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const getPrice = async (order: SaleOrder, productId: number, qty: number): Promise<number | null> => {
    try {
      const pl = order.pricelist_id ? order.pricelist_id[0] : null;
      if (!pl) return null;

      try {
        const price = await callKw<number>(
          'product.pricelist',
          '_get_product_price',
          [[pl], productId, qty, order.partner_id ? order.partner_id[0] : false],
          {}
        );
        if (typeof price === 'number') return price;
      } catch (_) {}

      return null;
    } catch (_) {
      return null;
    }
  };

  const handleConfirmAdd = async () => {
    if (!selectedProduct || !modalOrder) {
      showToastMessage('Seleziona un prodotto');
      return;
    }

    setIsLoading(true);
    try {
      const pdet = await searchRead<Product>(
        'product.product',
        [['id', '=', selectedProduct.id]],
        ['id', 'name', 'uom_id', 'lst_price', 'product_tmpl_id'],
        1
      );
      const uomId = pdet.length && pdet[0].uom_id ? pdet[0].uom_id[0] : null;
      let price = await getPrice(modalOrder, selectedProduct.id, searchQty);
      if (price == null) price = pdet.length ? Number(pdet[0].lst_price) || 0 : 0;

      const vals: any = {
        order_id: modalOrder.id,
        product_id: selectedProduct.id,
        product_uom_qty: searchQty,
        name: selectedProduct.name || selectedProduct.display_name,
        price_unit: price,
      };
      if (uomId) vals.product_uom = uomId;

      await callKw('sale.order.line', 'create', [vals], {});
      showToastMessage(`Aggiunto ${selectedProduct.display_name || selectedProduct.name} × ${searchQty} a ${modalOrder.name}`);
      setShowModal(false);
    } catch (error: any) {
      showToastMessage('Errore: ordine bloccato o permessi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
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
          <button className="btn slim blue" type="button" onClick={() => handleSaveGroup(key)}>
            SALVA GRUPPO
          </button>
        </div>
        {grp.pickings.map((pick) => renderPicking(pick))}
      </div>
    ));
  };

  const renderPicking = (pick: StockPicking) => {
    const saleName = pick.sale_id ? pick.sale_id[1] : pick.origin || '-';
    const righe = moves.filter((m) => m.picking_id && m.picking_id[0] === pick.id);

    return (
      <div key={pick.id} className="card">
        <div className="pick-head">
          <span className="pill">
            📦 <b>{pick.name}</b>
          </span>
          <span className="pill">
            Cliente: <b>{pick.partner_id ? pick.partner_id[1] : '-'}</b>
          </span>
          <span className="pill">{pick.state}</span>
          <span className="pill">
            🧾 Ordine: <b>{saleName || '-'}</b>
          </span>
          <button
            className="btn slim ghost"
            type="button"
            onClick={() => handleOpenQuickAdd(pick.id)}
            disabled={!saleName || saleName === '-'}
          >
            AGGIUNGI PRODOTTO
          </button>
        </div>
        <div className="list">
          {righe.length === 0 ? (
            <div className="row">
              <span style={{ color: 'var(--muted)' }}>Nessuna riga</span>
            </div>
          ) : (
            righe.map((move) => renderMove(move))
          )}
        </div>
      </div>
    );
  };

  const renderMove = (move: StockMove) => {
    const done = Number(doneByMove[move.id] || 0);
    const plan = Number(move.product_uom_qty || 0);
    const perc = ratio(done, plan).toFixed(0);
    const uom = move.product_uom ? move.product_uom[1] : '-';
    const ubic = bestLocationForMove(move.id);

    return (
      <div key={move.id} className="row" data-move={move.id}>
        <div className="prod">
          {move.product_id[1]}
          <div className="sub">
            U.M.: <b>{uom}</b> — Ubic.: <b>{ubic}</b>
          </div>
        </div>
        <div className="qty">
          Previsto: <b>{plan}</b>
        </div>
        <div>
          Fatto:
          <input
            type="number"
            step="0.01"
            min="0"
            defaultValue={done}
            id={`done_${move.id}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveOne(move.id);
            }}
          />
        </div>
        <div>
          <button className="btn slim green" type="button" onClick={() => handleSaveOne(move.id)}>
            SALVA
          </button>
        </div>
        <div className="status" id={`st_${move.id}`}></div>
        <div className="bar" style={{ gridColumn: '1 / -1' }}>
          <span id={`bar_${move.id}`} style={{ width: `${perc}%` }}></span>
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
          --border: #1f2937;
          --chip: #0b1220;
          --ok: #16a34a;
          --err: #ef4444;
          --accent: #22c55e;
          --accent2: #2563eb;
          --btnText: #052112;
          --btnText2: #eaf2ff;
        }

        [data-theme='light'] {
          --bg: #f6f8fc;
          --text: #0a1628;
          --muted: #5b6a7f;
          --card: #ffffff;
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
          font: 15px/1.5 system-ui, Segoe UI, Arial;
        }

        #app {
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
          [data-theme='light'] #app {
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
          z-index: 5;
          backdrop-filter: blur(8px);
          background: color-mix(in oklab, var(--bg) 80%, transparent);
          border-bottom: 1px solid var(--border);
          padding: 12px 16px;
          margin: 0 -18px 18px;
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .title {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.2px;
          margin-right: auto;
        }

        .btn {
          padding: 12px 16px;
          border: 0;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 800;
          transition: 0.15s transform;
        }

        .btn:active {
          transform: translateY(1px);
        }
        .btn.green {
          background: var(--accent);
          color: var(--btnText);
        }
        .btn.blue {
          background: var(--accent2);
          color: var(--btnText2);
        }
        .btn.ghost {
          background: var(--chip);
          color: var(--muted);
          border: 1px solid var(--border);
        }
        .btn.slim {
          padding: 8px 12px;
          font-size: 12px;
          border-radius: 10px;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .info {
          color: var(--muted);
          font-size: 13px;
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
          padding: 6px 10px;
          border-radius: 999px;
          background: var(--chip);
          border: 1px solid var(--border);
          color: var(--muted);
          font-size: 12px;
        }
        .pill.strong {
          color: var(--text);
        }

        .card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px 14px 10px;
          margin: 10px 0;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }

        .pick-head {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .list .row {
          display: grid;
          grid-template-columns: minmax(280px, 1fr) 120px 160px auto auto;
          gap: 10px;
          align-items: center;
          padding: 10px;
          border: 1px dashed var(--border);
          border-radius: 12px;
          margin: 10px 0;
        }

        .prod {
          font-weight: 800;
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
          width: 140px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: color-mix(in oklab, var(--bg) 92%, white 8%);
          color: var(--text);
          font-weight: 600;
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
          height: 8px;
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

        .qa-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.68);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 1000000;
        }

        .qa-modal.show {
          display: flex;
        }

        .qa-dialog {
          width: 720px;
          max-width: 95vw;
          background: #0b1220;
          color: #e5e7eb;
          border: 1px solid #26314a;
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
        }

        [data-theme='light'] .qa-dialog {
          background: #0b1220;
          color: #e5e7eb;
          border-color: #26314a;
        }

        .qa-head {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid #1f2a44;
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
          border: 1px solid #334061;
          background: #0f172a;
          color: #e5e7eb;
        }

        .qa-search input[type='number'] {
          width: 110px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #334061;
          background: #0f172a;
          color: #e5e7eb;
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
          display: block;
          width: 100%;
          text-align: left;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #2b3755;
          background: #101a33;
          color: #e5e7eb;
          cursor: pointer;
        }

        .qa-sugg:hover,
        .qa-sugg.active {
          border-color: #4f46e5;
          background: #121f3f;
        }

        .qa-sugg .name {
          font-weight: 700;
        }
        .qa-sugg .meta {
          font-size: 12px;
          color: #b6c2da;
        }

        .qa-foot {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid #1f2a44;
        }

        .btn.light {
          background: #1f2a44;
          border-color: #1f2a44;
          color: #e5e7eb;
        }

        .qa-close {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-weight: 700;
          font-size: 20px;
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
        }

        @media (max-width: 768px) {
          body {
            font-size: 13px;
          }
          .btn {
            padding: 8px 10px;
          }
          .btn.slim {
            padding: 5px 9px;
            font-size: 10.5px;
          }
          input[type='number'] {
            width: 110px;
          }
        }
      `}</style>

      <div id="app">
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
            <div className="title">Pick Residui – Edit rapido</div>
            <button className="btn ghost" type="button" onClick={toggleTheme} title="Cambia tema">
              {theme === 'light' ? '☀️ Chiaro' : '🌙 Scuro'}
            </button>
            <button className="btn green" type="button" onClick={handleLoad} disabled={isLoading}>
              {isLoading ? <span className="loading"></span> : 'CERCA'}
            </button>
            <button className="btn blue" type="button" onClick={handleSaveAll} disabled={isLoading}>
              SALVA TUTTO
            </button>
            <div className="info">
              Invio salva la riga • Raggruppo per <b>Autista</b> e <b>Giro</b>
            </div>
          </div>
          {renderGroups()}
        </div>

        <div id="toast" className={`toast ${showToast ? 'show' : ''}`}>
          {toastMessage}
        </div>
      </div>

      {/* Modal Quick Add */}
      <div className={`qa-modal ${showModal ? 'show' : ''}`}>
        <div className="qa-dialog">
          <div className="qa-head">
            <h3>{modalOrder ? `🔎 Aggiungi prodotto a ${modalOrder.name}` : "🔎 Aggiungi prodotto all'ordine"}</h3>
            <button className="qa-close" onClick={() => setShowModal(false)}>
              ✕
            </button>
          </div>
          <div className="qa-body">
            <div className="qa-search">
              <input
                ref={modalInputRef}
                type="text"
                placeholder="Nome, codice interno o barcode…"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                  searchTimerRef.current = setTimeout(() => {
                    handleSearchProduct(e.target.value.trim());
                  }, 160);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selectedProduct) {
                    handleConfirmAdd();
                  }
                }}
              />
              <input
                type="number"
                min="1"
                step="1"
                value={searchQty}
                onChange={(e) => setSearchQty(Math.max(1, parseInt(e.target.value) || 1))}
                title="Quantità"
              />
            </div>
            <div className="qa-suggest">
              {searching && <div style={{ color: '#b6c2da' }}>Ricerca in corso...</div>}
              {!searching && suggestions.length === 0 && searchTerm.length >= 2 && (
                <div style={{ color: '#b6c2da' }}>Nessun risultato</div>
              )}
              {suggestions.map((prod) => {
                const uom = prod.uom_id ? prod.uom_id[1] : '';
                const code = prod.default_code ? ` • Cod.: ${prod.default_code}` : '';
                const bar = prod.barcode ? ` • Barcode: ${prod.barcode}` : '';
                return (
                  <button
                    key={prod.id}
                    type="button"
                    className={`qa-sugg ${selectedProduct?.id === prod.id ? 'active' : ''}`}
                    onClick={() => handleSelectProduct(prod)}
                  >
                    <div className="name">{prod.display_name || prod.name}</div>
                    <div className="meta">
                      {uom}
                      {code}
                      {bar}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="qa-foot">
            <button className="btn light" onClick={() => setShowModal(false)}>
              Annulla
            </button>
            <button className="btn blue" onClick={handleConfirmAdd} disabled={!selectedProduct || isLoading}>
              Conferma
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
