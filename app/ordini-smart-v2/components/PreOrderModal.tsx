'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  TruckIcon,
  UserGroupIcon,
  ChartBarIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';

interface PreOrderProduct {
  id: number;
  name: string;
  image_url: string;
  stock: number;
  uom: string;
  supplier_name: string;
  supplier_id: number;
  hasPreOrderTag: boolean;
  assigned_customers: Array<{
    customer_id: number;
    customer_name: string;
    quantity: number;
  }>;
}

interface PreOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PreOrderModal({ isOpen, onClose }: PreOrderModalProps) {
  const [products, setProducts] = useState<PreOrderProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<PreOrderProduct | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPreOrderProducts();
    }
  }, [isOpen]);

  async function loadPreOrderProducts() {
    setLoading(true);
    try {
      const response = await fetch('/api/smart-ordering-v2/pre-order-products');
      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error loading pre-order products:', error);
    } finally {
      setLoading(false);
    }
  }

  async function togglePreOrderTag(productId: number, currentState: boolean) {
    try {
      const response = await fetch('/api/smart-ordering-v2/toggle-preorder-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, enable: !currentState })
      });

      if (response.ok) {
        loadPreOrderProducts(); // Reload
      }
    } catch (error) {
      console.error('Error toggling pre-order tag:', error);
    }
  }

  function getTotalQuantity(product: PreOrderProduct): number {
    return product.assigned_customers.reduce((sum, c) => sum + c.quantity, 0);
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 overflow-auto"
        onClick={onClose}
      >
        <div className="min-h-screen p-6 flex items-start justify-center">
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl shadow-2xl max-w-7xl w-full border border-indigo-400/30"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <CubeIcon className="w-8 h-8 text-indigo-300" />
                    Prodotti Pre-ordine
                  </h2>
                  <p className="text-indigo-200">
                    Gestisci prodotti su ordinazione e assegna ai clienti
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <XMarkIcon className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Products Table */}
            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="text-white text-xl">🔄 Caricamento prodotti...</div>
                </div>
              ) : (
                <>
                  {/* Products Table */}
                  <div className="bg-white/5 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-indigo-800/50">
                        <tr>
                          <th className="text-left p-4 text-indigo-200 text-sm font-semibold">✓</th>
                          <th className="text-left p-4 text-indigo-200 text-sm font-semibold">Prodotto</th>
                          <th className="text-center p-4 text-indigo-200 text-sm font-semibold">Stock</th>
                          <th className="text-left p-4 text-indigo-200 text-sm font-semibold">Fornitore</th>
                          <th className="text-center p-4 text-indigo-200 text-sm font-semibold">Quantità</th>
                          <th className="text-center p-4 text-indigo-200 text-sm font-semibold">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((product) => (
                          <tr
                            key={product.id}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            {/* Checkbox */}
                            <td className="p-4">
                              <input
                                type="checkbox"
                                checked={product.hasPreOrderTag}
                                onChange={() => togglePreOrderTag(product.id, product.hasPreOrderTag)}
                                className="w-5 h-5 cursor-pointer"
                              />
                            </td>

                            {/* Product Image + Name */}
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-12 h-12 rounded-lg object-cover bg-white/10"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white"%3E%3Cpath stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/%3E%3C/svg%3E';
                                  }}
                                />
                                <div className="text-white font-medium">{product.name}</div>
                              </div>
                            </td>

                            {/* Stock */}
                            <td className="p-4 text-center">
                              <div className="text-white font-semibold">{product.stock.toFixed(1)}</div>
                              <div className="text-indigo-300 text-xs">{product.uom}</div>
                            </td>

                            {/* Supplier */}
                            <td className="p-4">
                              <div className="flex items-center gap-2 text-indigo-200">
                                <TruckIcon className="w-4 h-4" />
                                <span>{product.supplier_name}</span>
                              </div>
                            </td>

                            {/* Total Quantity (READ-ONLY) */}
                            <td className="p-4 text-center">
                              <div className="bg-indigo-500/20 border border-indigo-400/30 rounded-lg px-4 py-2 inline-block">
                                <div className="text-white font-bold text-lg">{getTotalQuantity(product)}</div>
                                <div className="text-indigo-300 text-xs">{product.uom}</div>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="p-4">
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={() => {
                                    setSelectedProduct(product);
                                    setShowCustomerModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm font-semibold transition-all flex items-center gap-1"
                                >
                                  <UserGroupIcon className="w-4 h-4" />
                                  Per chi?
                                </button>
                                <button
                                  onClick={() => {/* TODO: Open Analytics */}}
                                  className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm font-semibold transition-all flex items-center gap-1"
                                >
                                  <ChartBarIcon className="w-4 h-4" />
                                  Analisi
                                </button>
                                <button
                                  onClick={() => {/* TODO: Create Orders */}}
                                  disabled={getTotalQuantity(product) === 0}
                                  className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm font-semibold transition-all flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ShoppingCartIcon className="w-4 h-4" />
                                  Ordina
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filteredProducts.length === 0 && (
                      <div className="text-center py-12">
                        <div className="text-white/60 text-lg">Nessun prodotto trovato</div>
                      </div>
                    )}
                  </div>

                  {/* Search Bar - AT THE BOTTOM */}
                  <div className="mt-6 bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-300" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="🔍 Cerca prodotto o fornitore..."
                        className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg"
                      />
                    </div>
                    {searchTerm && (
                      <div className="mt-2 text-sm text-indigo-200">
                        Trovati {filteredProducts.length} prodotti
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Customer Assignment Modal */}
        {showCustomerModal && selectedProduct && (
          <CustomerAssignmentModal
            product={selectedProduct}
            onClose={() => {
              setShowCustomerModal(false);
              setSelectedProduct(null);
            }}
            onSave={() => {
              loadPreOrderProducts(); // Reload after saving
              setShowCustomerModal(false);
              setSelectedProduct(null);
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// Customer Assignment Modal Component
interface CustomerAssignmentModalProps {
  product: PreOrderProduct;
  onClose: () => void;
  onSave: () => void;
}

function CustomerAssignmentModal({ product, onClose, onSave }: CustomerAssignmentModalProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
    // Initialize with existing assignments
    const existing = new Map();
    product.assigned_customers.forEach(c => {
      existing.set(c.customer_id, c.quantity);
    });
    setSelectedCustomers(existing);
  }, []);

  async function loadCustomers() {
    setLoading(true);
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      if (data.success) {
        setCustomers(data.customers);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleQuantityChange(customerId: number, quantity: number) {
    const newMap = new Map(selectedCustomers);
    if (quantity > 0) {
      newMap.set(customerId, quantity);
    } else {
      newMap.delete(customerId);
    }
    setSelectedCustomers(newMap);
  }

  async function handleSave() {
    try {
      const assignments = Array.from(selectedCustomers.entries()).map(([customerId, quantity]) => ({
        customer_id: customerId,
        quantity
      }));

      const response = await fetch('/api/smart-ordering-v2/assign-preorder-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          assignments
        })
      });

      if (response.ok) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving assignments:', error);
    }
  }

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalQuantity = Array.from(selectedCustomers.values()).reduce((sum, qty) => sum + qty, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-gradient-to-br from-purple-800 to-pink-800 rounded-3xl shadow-2xl max-w-3xl w-full border border-purple-400/30 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <UserGroupIcon className="w-6 h-6 text-purple-300" />
                Per chi è questo prodotto?
              </h3>
              <p className="text-purple-200">{product.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-white">Caricamento clienti...</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="bg-white/10 rounded-lg p-4 flex items-center justify-between hover:bg-white/20 transition-all"
                >
                  <div className="flex-1">
                    <div className="text-white font-semibold">{customer.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={selectedCustomers.get(customer.id) || ''}
                      onChange={(e) => handleQuantityChange(customer.id, parseFloat(e.target.value) || 0)}
                      placeholder="Qtà"
                      className="w-24 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <span className="text-purple-200 text-sm">{product.uom}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search Bar - AT THE BOTTOM */}
        <div className="p-6 border-t border-white/10 space-y-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-300" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Cerca cliente..."
              className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Total and Save */}
          <div className="flex items-center justify-between">
            <div className="text-white">
              <span className="text-purple-200">Totale:</span>
              <span className="ml-2 text-2xl font-bold">{totalQuantity.toFixed(1)} {product.uom}</span>
              <span className="ml-2 text-sm text-purple-300">({selectedCustomers.size} clienti)</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all font-semibold"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
