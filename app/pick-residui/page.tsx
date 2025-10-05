'use client';

import { useState, useEffect } from 'react';
import { Package, Home, Save, Search, Plus, X, Loader2, Sun, Moon } from 'lucide-react';
import Link from 'next/link';

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
  display_name: string;
  name: string;
  default_code: string | false;
  barcode: string | false;
  uom_id: [number, string] | false;
  lst_price: number;
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

export default function PickResiduiPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<StockPicking[]>([]);
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [linesByMove, setLinesByMove] = useState<Record<number, number[]>>({});
  const [doneByMove, setDoneByMove] = useState<Record<number, number>>({});
  const [metaByMove, setMetaByMove] = useState<Record<number, StockMove>>({});
  const [lineInfoByMove, setLineInfoByMove] = useState<Record<number, any[]>>({});
  const [groups, setGroups] = useState<Map<string, GroupData>>(new Map());
  const [editValues, setEditValues] = useState<Record<number, number>>({});

  // Modal Quick Add
  const [showModal, setShowModal] = useState(false);
  const [modalOrder, setModalOrder] = useState<SaleOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQty, setProductQty] = useState(1);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('lapa_theme');
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lapa_theme', theme);
  }, [theme]);

  const callKw = async (model: string, method: string, args: any[] = [], kwargs: any = {}) => {
    const response = await fetch(`/web/dataset/call_kw/${model}/${method}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method, args, kwargs },
        id: Date.now(),
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.data?.message || data.error.message);
    }
    return data.result;
  };

  const searchRead = async (model: string, domain: any[], fields: string[] = [], limit = 0, order = '') => {
    return callKw(model, 'search_read', [domain], { fields, limit, order });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const picksData: StockPicking[] = await searchRead(
        'stock.picking',
        [['backorder_id', '!=', false], ['name', 'ilike', 'PICK'], ['state', 'not in', ['done', 'cancel']]],
        ['id', 'name', 'state', 'partner_id', 'driver_id', 'carrier_id', 'sale_id', 'origin', 'group_id'],
        0,
        'name asc'
      );

      if (!picksData.length) {
        setPicks([]);
        setMoves([]);
        setGroups(new Map());
        return;
      }

      const pickIds = picksData.map(p => p.id);
      const movesData: StockMove[] = await searchRead(
        'stock.move',
        [['picking_id', 'in', pickIds]],
        ['id', 'picking_id', 'product_id', 'product_uom_qty', 'location_id', 'location_dest_id', 'product_uom'],
        0,
        'picking_id,id'
      );

      const moveIds = movesData.map(m => m.id);
      const linesData: StockMoveLine[] = moveIds.length
        ? await searchRead('stock.move.line', [['move_id', 'in', moveIds]], ['id', 'move_id', 'qty_done', 'location_id', 'lot_id'], 0)
        : [];

      const newDoneByMove: Record<number, number> = {};
      const newLinesByMove: Record<number, number[]> = {};
      const newLineInfoByMove: Record<number, any[]> = {};

      linesData.forEach(l => {
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
      movesData.forEach(m => {
        newMetaByMove[m.id] = m;
      });

      const newGroups = new Map<string, GroupData>();
      const label = (x: [number, string] | false, prefix: string) => (x && x[1] ? x[1] : `${prefix} -`);

      for (const p of picksData) {
        const driver = label(p.driver_id, 'Autista');
        const giro = label(p.carrier_id, 'Giro');
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

      // Initialize edit values
      const newEditValues: Record<number, number> = {};
      movesData.forEach(m => {
        newEditValues[m.id] = newDoneByMove[m.id] || 0;
      });
      setEditValues(newEditValues);
    } catch (error: any) {
      alert('Errore: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOne = async (moveId: number, value: number) => {
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
        const newId = await callKw('stock.move.line', 'create', [vals]);
        setLinesByMove(prev => ({ ...prev, [moveId]: [newId] }));
      }
      setDoneByMove(prev => ({ ...prev, [moveId]: value }));
      setEditValues(prev => ({ ...prev, [moveId]: value }));
    } catch (error: any) {
      alert('Errore: ' + error.message);
      throw error;
    }
  };

  const saveOne = async (moveId: number) => {
    const value = editValues[moveId] || 0;
    await updateOne(moveId, value);
  };

  const saveAll = async () => {
    setLoading(true);
    try {
      for (const moveId in editValues) {
        await updateOne(Number(moveId), editValues[moveId]);
      }
      alert('Tutte le righe salvate!');
    } finally {
      setLoading(false);
    }
  };

  const saveGroup = async (key: string) => {
    const grp = groups.get(key);
    if (!grp) return;

    setLoading(true);
    try {
      const ids: number[] = [];
      for (const p of grp.pickings) {
        moves.filter(m => m.picking_id && m.picking_id[0] === p.id).forEach(m => ids.push(m.id));
      }
      for (const id of ids) {
        const val = editValues[id] || doneByMove[id] || 0;
        await updateOne(id, val);
      }
      alert(`Gruppo salvato: ${grp.driver} • ${grp.carrier}`);
    } finally {
      setLoading(false);
    }
  };

  const bestLocationForMove = (moveId: number) => {
    const arr = lineInfoByMove[moveId] || [];
    if (arr.length) {
      arr.sort((a, b) => (b.qty_done || 0) - (a.qty_done || 0));
      const top = arr[0];
      let txt = top.location ? top.location[1] : '-';
      if (top.lot) txt += ' - ' + top.lot[1];
      return txt;
    }
    const m = metaByMove[moveId];
    return m && m.location_id ? m.location_id[1] : '-';
  };

  const ratio = (done: number, plan: number) => {
    if (!plan) return 0;
    return Math.max(0, Math.min(100, (done / plan) * 100));
  };

  // Quick Add Functions
  const ensureOrderForPick = async (pick: StockPicking): Promise<SaleOrder | null> => {
    if (pick.sale_id) {
      const o = await searchRead('sale.order', [['id', '=', pick.sale_id[0]]], ['id', 'name', 'pricelist_id', 'partner_id', 'state'], 1);
      return o && o[0];
    }
    if (pick.origin) {
      const o = await searchRead('sale.order', [['name', '=', pick.origin]], ['id', 'name', 'pricelist_id', 'partner_id', 'state'], 1);
      if (o.length) return o[0];
    }
    if (pick.group_id) {
      const o = await searchRead('sale.order', [['procurement_group_id', '=', pick.group_id[0]]], ['id', 'name', 'pricelist_id', 'partner_id', 'state'], 1);
      if (o.length) return o[0];
    }
    return null;
  };

  const openQuickAddForPick = async (pickId: number) => {
    const pick = picks.find(p => p.id === pickId);
    if (!pick) {
      alert('PICK non trovato');
      return;
    }
    const order = await ensureOrderForPick(pick);
    if (!order) {
      alert('Ordine di vendita non trovato per questo PICK');
      return;
    }
    setModalOrder(order);
    setShowModal(true);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedProduct(null);
    setProductQty(1);
  };

  const orDomain = (leaves: any[]) => {
    if (!leaves || !leaves.length) return [];
    if (leaves.length === 1) return leaves[0];
    const out = [];
    for (let i = 0; i < leaves.length - 1; i++) out.push('|');
    leaves.forEach(l => out.push(l));
    return out;
  };

  const superSearch = async (term: string): Promise<Product[]> => {
    if (/^[0-9A-Za-z\-\.]{6,}$/.test(term)) {
      const exactLeaves = [['barcode', '=', term], ['default_code', '=', term]];
      const exactDomain = ['&', ['sale_ok', '=', true], ...orDomain(exactLeaves)];
      const exact = await searchRead('product.product', exactDomain, ['id', 'display_name', 'name', 'default_code', 'barcode', 'uom_id', 'lst_price'], 20);
      if (exact.length) return exact;
    }

    try {
      const leaves = [['name', 'ilike', term], ['default_code', 'ilike', term], ['barcode', 'ilike', term]];
      const domain = ['&', ['sale_ok', '=', true], ...orDomain(leaves)];
      const out = await searchRead('product.product', domain, ['id', 'display_name', 'name', 'default_code', 'barcode', 'uom_id', 'lst_price'], 20);
      return out;
    } catch (e) {
      return [];
    }
  };

  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      setSelectedProduct(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await superSearch(searchTerm);
        setSearchResults(results);
        if (results.length > 0) {
          setSelectedProduct(results[0]);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const getPrice = async (order: SaleOrder, productId: number, qty: number) => {
    try {
      const pl = order.pricelist_id ? order.pricelist_id[0] : null;
      if (!pl) return null;

      try {
        const price = await callKw('product.pricelist', '_get_product_price', [[pl], productId, qty, order.partner_id ? order.partner_id[0] : false], {});
        if (typeof price === 'number') return price;
      } catch (_) {}

      return null;
    } catch (_) {
      return null;
    }
  };

  const confirmAdd = async () => {
    if (!selectedProduct || !modalOrder) {
      alert('Seleziona un prodotto');
      return;
    }

    setLoading(true);
    try {
      const pdet = await searchRead('product.product', [['id', '=', selectedProduct.id]], ['id', 'name', 'uom_id', 'lst_price', 'product_tmpl_id'], 1);
      const uomId = pdet.length && pdet[0].uom_id ? pdet[0].uom_id[0] : null;
      let price = await getPrice(modalOrder, selectedProduct.id, productQty);
      if (price == null) price = pdet.length ? Number(pdet[0].lst_price) || 0 : 0;

      const vals: any = {
        order_id: modalOrder.id,
        product_id: selectedProduct.id,
        product_uom_qty: productQty,
        name: selectedProduct.name || selectedProduct.display_name,
        price_unit: price,
      };
      if (uomId) vals.product_uom = uomId;

      await callKw('sale.order.line', 'create', [vals], {});
      alert(`Aggiunto ${selectedProduct.display_name} × ${productQty} a ${modalOrder.name}`);
      setShowModal(false);
    } catch (error: any) {
      alert('Errore: ordine bloccato o permessi');
    } finally {
      setLoading(false);
    }
  };

  const bgClass = theme === 'light'
    ? 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
    : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900';

  const cardClass = theme === 'light'
    ? 'bg-white border-slate-200'
    : 'bg-slate-800/40 border-slate-600/50';

  const textClass = theme === 'light' ? 'text-slate-900' : 'text-white';
  const mutedClass = theme === 'light' ? 'text-slate-600' : 'text-slate-400';

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {/* Header */}
      <div className={`sticky top-0 z-10 backdrop-blur-sm ${theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-900/80 border-slate-700'} border-b`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Link href="/" className={`flex items-center gap-2 px-3 py-2 rounded-lg ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200' : 'bg-slate-800/50 hover:bg-slate-700/50'} transition-colors`}>
                <Home className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-r from-red-500 to-rose-600 p-2 rounded-lg">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <h1 className={`text-xl font-bold ${textClass}`}>Pick Residui – Edit rapido</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={`p-2 rounded-lg ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200' : 'bg-slate-800/50 hover:bg-slate-700/50'}`}
              >
                {theme === 'light' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                onClick={loadData}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'CERCA'}
              </button>
              <button
                onClick={saveAll}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                SALVA TUTTO
              </button>
            </div>
          </div>
          <div className={`text-sm ${mutedClass} mt-2`}>
            Invio salva la riga • Raggruppo per <b>Autista</b> e <b>Giro</b>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {groups.size === 0 && !loading && (
          <div className={`${cardClass} border rounded-xl p-6 text-center`}>
            <p className={mutedClass}>Pronto. Clicca CERCA per caricare i pick residui.</p>
          </div>
        )}

        {Array.from(groups.entries()).map(([key, grp]) => (
          <div key={key} className="mb-6">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${theme === 'light' ? 'bg-slate-100 text-slate-800' : 'bg-slate-700/50 text-white'}`}>
                👤 {grp.driver}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${theme === 'light' ? 'bg-slate-100 text-slate-800' : 'bg-slate-700/50 text-white'}`}>
                🧭 {grp.carrier}
              </span>
              <button
                onClick={() => saveGroup(key)}
                className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm font-semibold hover:bg-blue-600 transition-colors"
              >
                SALVA GRUPPO
              </button>
            </div>

            {grp.pickings.map(p => {
              const saleName = p.sale_id ? p.sale_id[1] : p.origin || '-';
              const righe = moves.filter(m => m.picking_id && m.picking_id[0] === p.id);

              return (
                <div key={p.id} className={`${cardClass} border rounded-xl p-4 mb-4`}>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-700/50'}`}>
                      📦 <b>{p.name}</b>
                    </span>
                    <span className={`px-2 py-1 rounded-lg text-xs ${mutedClass}`}>
                      Cliente: <b>{p.partner_id ? p.partner_id[1] : '-'}</b>
                    </span>
                    <span className={`px-2 py-1 rounded-lg text-xs ${mutedClass}`}>{p.state}</span>
                    <span className={`px-2 py-1 rounded-lg text-xs ${mutedClass}`}>
                      🧾 Ordine: <b>{saleName}</b>
                    </span>
                    <button
                      onClick={() => openQuickAddForPick(p.id)}
                      disabled={!saleName || saleName === '-'}
                      className="px-3 py-1 bg-slate-500 text-white rounded-lg text-xs font-semibold hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      AGGIUNGI PRODOTTO
                    </button>
                  </div>

                  <div className="space-y-3">
                    {righe.length === 0 ? (
                      <div className={mutedClass}>Nessuna riga</div>
                    ) : (
                      righe.map(m => {
                        const done = doneByMove[m.id] || 0;
                        const plan = m.product_uom_qty || 0;
                        const perc = ratio(done, plan);
                        const uom = m.product_uom ? m.product_uom[1] : '-';
                        const ubic = bestLocationForMove(m.id);

                        return (
                          <div key={m.id} className={`border ${theme === 'light' ? 'border-slate-200' : 'border-slate-600'} rounded-lg p-3 space-y-2`}>
                            <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,auto,auto] gap-3 items-center">
                              <div>
                                <div className={`font-bold ${textClass}`}>{m.product_id[1]}</div>
                                <div className={`text-sm ${mutedClass}`}>
                                  U.M.: <b>{uom}</b> — Ubic.: <b>{ubic}</b>
                                </div>
                              </div>
                              <div className={mutedClass}>
                                Previsto: <b>{plan}</b>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={mutedClass}>Fatto:</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editValues[m.id] ?? done}
                                  onChange={(e) => setEditValues(prev => ({ ...prev, [m.id]: Number(e.target.value) }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveOne(m.id);
                                  }}
                                  className={`w-32 px-3 py-1 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-700 border-slate-600'} ${textClass} font-semibold`}
                                />
                              </div>
                              <button
                                onClick={() => saveOne(m.id)}
                                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-colors"
                              >
                                SALVA
                              </button>
                            </div>
                            <div className={`h-2 rounded-full overflow-hidden ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-700'}`}>
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-300"
                                style={{ width: `${perc}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Modal Quick Add */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-2xl ${theme === 'light' ? 'bg-white' : 'bg-slate-800'} rounded-xl border ${theme === 'light' ? 'border-slate-200' : 'border-slate-600'} shadow-2xl`}>
            <div className={`flex items-center justify-between p-4 border-b ${theme === 'light' ? 'border-slate-200' : 'border-slate-600'}`}>
              <h3 className={`text-lg font-bold ${textClass}`}>
                🔎 Aggiungi prodotto a {modalOrder?.name}
              </h3>
              <button onClick={() => setShowModal(false)} className={mutedClass}>
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-4">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 ${mutedClass}`} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nome, codice interno o barcode…"
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-700 border-slate-600'} ${textClass}`}
                    autoFocus
                  />
                </div>
                <input
                  type="number"
                  value={productQty}
                  onChange={(e) => setProductQty(Math.max(1, Number(e.target.value)))}
                  min="1"
                  step="1"
                  className={`w-24 px-3 py-2 rounded-lg border ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-slate-700 border-slate-600'} ${textClass}`}
                />
              </div>

              <div className="max-h-96 overflow-auto space-y-2">
                {searching && <div className={mutedClass}>Ricerca in corso...</div>}
                {!searching && searchResults.length === 0 && searchTerm.length >= 2 && (
                  <div className={mutedClass}>Nessun risultato</div>
                )}
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedProduct?.id === p.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : theme === 'light'
                        ? 'border-slate-200 hover:border-blue-300'
                        : 'border-slate-600 hover:border-blue-500'
                    }`}
                  >
                    <div className={`font-bold ${textClass}`}>{p.display_name || p.name}</div>
                    <div className={`text-sm ${mutedClass}`}>
                      {p.uom_id ? p.uom_id[1] : ''}
                      {p.default_code ? ` • Cod.: ${p.default_code}` : ''}
                      {p.barcode ? ` • Barcode: ${p.barcode}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className={`flex justify-end gap-2 p-4 border-t ${theme === 'light' ? 'border-slate-200' : 'border-slate-600'}`}>
              <button
                onClick={() => setShowModal(false)}
                className={`px-4 py-2 rounded-lg ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200' : 'bg-slate-700 hover:bg-slate-600'} ${textClass}`}
              >
                Annulla
              </button>
              <button
                onClick={confirmAdd}
                disabled={!selectedProduct || loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
