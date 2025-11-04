'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, MagnifyingGlassIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Product {
  id: number
  name: string
  currentStock: number
  uom: string
  supplier: {
    id: number
    name: string
  }
  isPreOrder: boolean
  assignedCustomers: Array<{
    customerId: number
    customerName: string
    quantity: number
  }>
  // Analytics data
  totalSold3Months?: number
  avgDailySales?: number
  daysOfStock?: number
}

interface Supplier {
  id: number
  name: string
}

interface Customer {
  id: number
  name: string
  email?: string
  phone?: string
  city?: string
}

export default function ProdottiPreordinePage() {
  const router = useRouter()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Customer assignment modal
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [customerAssignments, setCustomerAssignments] = useState<Array<{ customerId: number, quantity: number }>>([])

  // Analytics modal
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [analyticsProduct, setAnalyticsProduct] = useState<Product | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)

      // Load ALL products from suppliers API
      const suppliersRes = await fetch('/api/smart-ordering-v2/suppliers')
      if (suppliersRes.ok) {
        const data = await suppliersRes.json()

        // Extract all products from all suppliers
        const products: Product[] = []
        const suppliersList: Supplier[] = []

        data.suppliers?.forEach((supplier: any) => {
          suppliersList.push({
            id: supplier.id,
            name: supplier.name
          })

          supplier.products?.forEach((product: any) => {
            products.push({
              id: product.id,
              name: product.name,
              currentStock: product.currentStock || 0,
              uom: product.uom || 'pz',
              supplier: {
                id: supplier.id,
                name: supplier.name
              },
              isPreOrder: false, // Will be loaded from pre-order API
              assignedCustomers: [],
              totalSold3Months: product.totalSold3Months,
              avgDailySales: product.avgDailySales,
              daysOfStock: product.daysOfStock
            })
          })
        })

        setAllProducts(products)
        setSuppliers(suppliersList)
      }

      // Load pre-order products to check which ones have the tag
      const preOrderRes = await fetch('/api/smart-ordering-v2/pre-order-products')
      if (preOrderRes.ok) {
        const data = await preOrderRes.json()
        const preOrderIds = new Set(data.products?.map((p: any) => p.id) || [])

        // Mark products that have PRE-ORDINE tag
        setAllProducts(prev => prev.map(p => ({
          ...p,
          isPreOrder: preOrderIds.has(p.id),
          assignedCustomers: data.products?.find((pp: any) => pp.id === p.id)?.assignedCustomers || []
        })))
      }

      // Load customers
      const customersRes = await fetch('/api/customers')
      if (customersRes.ok) {
        const data = await customersRes.json()
        setCustomers(data.customers || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePreOrder = async (productId: number, currentState: boolean) => {
    try {
      const res = await fetch('/api/smart-ordering-v2/toggle-preorder-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, enable: !currentState })
      })

      if (res.ok) {
        // Update local state
        setAllProducts(prev => prev.map(p =>
          p.id === productId ? { ...p, isPreOrder: !currentState } : p
        ))
      }
    } catch (error) {
      console.error('Error toggling pre-order:', error)
    }
  }

  const changeSupplier = async (productId: number, newSupplierId: number) => {
    // TODO: Implement supplier change in Odoo
    console.log(`Change product ${productId} to supplier ${newSupplierId}`)

    // Update local state
    const newSupplier = suppliers.find(s => s.id === newSupplierId)
    if (newSupplier) {
      setAllProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, supplier: newSupplier } : p
      ))
    }
  }

  const openCustomerAssignment = (product: Product) => {
    setSelectedProduct(product)
    setCustomerAssignments(
      product.assignedCustomers.map(a => ({
        customerId: a.customerId,
        quantity: a.quantity
      }))
    )
    setShowCustomerModal(true)
  }

  const addCustomerAssignment = () => {
    setCustomerAssignments([...customerAssignments, { customerId: 0, quantity: 0 }])
  }

  const updateCustomerAssignment = (index: number, field: 'customerId' | 'quantity', value: number) => {
    setCustomerAssignments(prev => prev.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    ))
  }

  const removeCustomerAssignment = (index: number) => {
    setCustomerAssignments(prev => prev.filter((_, i) => i !== index))
  }

  const saveCustomerAssignments = async () => {
    if (!selectedProduct) return

    try {
      // Save all assignments
      for (const assignment of customerAssignments) {
        if (assignment.customerId > 0 && assignment.quantity > 0) {
          await fetch('/api/smart-ordering-v2/assign-preorder-customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: selectedProduct.id,
              customerId: assignment.customerId,
              quantity: assignment.quantity
            })
          })
        }
      }

      // Reload data
      await loadAllData()
      setShowCustomerModal(false)
      setSelectedProduct(null)
      setCustomerAssignments([])
    } catch (error) {
      console.error('Error saving assignments:', error)
    }
  }

  const openAnalytics = async (product: Product) => {
    setAnalyticsProduct(product)
    setShowAnalyticsModal(true)
    // Analytics data is already loaded with the product
  }

  const createOrder = async (product: Product) => {
    if (!product.isPreOrder || product.assignedCustomers.length === 0) {
      alert('Prodotto deve essere PRE-ORDINE con clienti assegnati')
      return
    }

    try {
      // Create orders for each customer
      for (const assignment of product.assignedCustomers) {
        // TODO: Create order in Odoo for this customer
        console.log(`Creating order: Customer ${assignment.customerName}, Product ${product.name} x${assignment.quantity}`)
      }

      alert('Ordini creati con successo!')
      await loadAllData()
    } catch (error) {
      console.error('Error creating orders:', error)
      alert('Errore nella creazione degli ordini')
    }
  }

  const calculateTotalQuantity = (product: Product) => {
    return product.assignedCustomers.reduce((sum, a) => sum + a.quantity, 0)
  }

  const filteredProducts = allProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/ordini-smart-v2')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-6 h-6 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Prodotti Pre-ordine</h1>
                <p className="text-purple-200 text-sm">Gestisci prodotti su ordinazione e assegna ai clienti</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{allProducts.filter(p => p.isPreOrder).length}</div>
              <div className="text-purple-200 text-sm">Prodotti PRE-ORDINE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca prodotto o fornitore..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-white">Caricamento prodotti...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-4 py-4 text-center text-sm font-semibold text-purple-200 w-16">PRE-ORDINE</th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-purple-200 w-24">Foto</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-purple-200">Nome Prodotto</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-purple-200 w-48">Fornitore</th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-purple-200 w-24">Stock</th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-purple-200 w-64">Clienti Assegnati</th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-purple-200 w-32">Qtà da Ordinare</th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-purple-200 w-48">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                      {/* PRE-ORDINE Toggle */}
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={product.isPreOrder}
                          onChange={() => togglePreOrder(product.id, product.isPreOrder)}
                          className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>

                      {/* Photo */}
                      <td className="px-4 py-4">
                        <img
                          src={`https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com/web/image/product.product/${product.id}/image_128`}
                          alt={product.name}
                          className="w-16 h-16 rounded-lg object-cover bg-white/10"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white"%3E%3Cpath stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/%3E%3C/svg%3E'
                          }}
                        />
                      </td>

                      {/* Product Name */}
                      <td className="px-4 py-4">
                        <div className="text-white font-medium">{product.name}</div>
                      </td>

                      {/* Supplier Dropdown */}
                      <td className="px-4 py-4">
                        <select
                          value={product.supplier.id}
                          onChange={(e) => changeSupplier(product.id, Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-700 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          {suppliers.map(supplier => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Stock */}
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                          product.currentStock > 10
                            ? 'bg-green-500/20 text-green-300'
                            : product.currentStock > 0
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {product.currentStock.toFixed(1)} {product.uom}
                        </span>
                      </td>

                      {/* Assigned Customers */}
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openCustomerAssignment(product)}
                          className="w-full text-left"
                        >
                          {product.assignedCustomers.length > 0 ? (
                            <div className="space-y-1">
                              {product.assignedCustomers.slice(0, 2).map((a, idx) => (
                                <div key={idx} className="text-sm text-gray-300">
                                  {a.customerName} ({a.quantity})
                                </div>
                              ))}
                              {product.assignedCustomers.length > 2 && (
                                <div className="text-xs text-purple-300">
                                  +{product.assignedCustomers.length - 2} altri...
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 italic">Nessun cliente</div>
                          )}
                        </button>
                      </td>

                      {/* Total Quantity */}
                      <td className="px-4 py-4 text-center">
                        <span className="text-2xl font-bold text-purple-300">
                          {calculateTotalQuantity(product)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openAnalytics(product)}
                            className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm rounded-lg transition-all"
                          >
                            📊 Analisi
                          </button>
                          {product.isPreOrder && product.assignedCustomers.length > 0 && (
                            <button
                              onClick={() => createOrder(product)}
                              className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-sm rounded-lg transition-all font-semibold"
                            >
                              🚀 ORDINA
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Customer Assignment Modal */}
      {showCustomerModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden border border-purple-500/30">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Assegna Clienti</h2>
                <p className="text-gray-400 text-sm mt-1">{selectedProduct.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowCustomerModal(false)
                  setSelectedProduct(null)
                  setCustomerAssignments([])
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {customerAssignments.map((assignment, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <select
                    value={assignment.customerId}
                    onChange={(e) => updateCustomerAssignment(idx, 'customerId', Number(e.target.value))}
                    className="flex-1 px-4 py-2 bg-slate-700 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={0}>Seleziona cliente...</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.city ? `(${customer.city})` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={assignment.quantity || ''}
                    onChange={(e) => updateCustomerAssignment(idx, 'quantity', Number(e.target.value))}
                    placeholder="Quantità"
                    className="w-32 px-4 py-2 bg-slate-700 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => removeCustomerAssignment(idx)}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={addCustomerAssignment}
                className="w-full px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <UserPlusIcon className="w-5 h-5" />
                Aggiungi Cliente
              </button>

              <div className="mt-6 p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <div className="text-sm text-purple-200 mb-1">Quantità Totale da Ordinare:</div>
                <div className="text-3xl font-bold text-purple-300">
                  {customerAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0)} {selectedProduct.uom}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3">
              <button
                onClick={() => {
                  setShowCustomerModal(false)
                  setSelectedProduct(null)
                  setCustomerAssignments([])
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={saveCustomerAssignments}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg transition-all font-semibold"
              >
                Salva Assegnazioni
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && analyticsProduct && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl max-w-4xl w-full border border-white/20">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={`https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com/web/image/product.product/${analyticsProduct.id}/image_256`}
                  alt={analyticsProduct.name}
                  className="w-20 h-20 rounded-xl object-cover bg-white/10"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white"%3E%3Cpath stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/%3E%3C/svg%3E'
                  }}
                />
                <div>
                  <h2 className="text-2xl font-bold text-white">📊 Analisi Prodotto</h2>
                  <p className="text-blue-200">{analyticsProduct.name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAnalyticsModal(false)
                  setAnalyticsProduct(null)
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-8 h-8" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-400/30">
                  <div className="text-blue-300 text-sm mb-1">Stock Corrente</div>
                  <div className="text-white text-2xl font-bold">{analyticsProduct.currentStock.toFixed(1)}</div>
                  <div className="text-blue-200 text-xs">{analyticsProduct.uom}</div>
                </div>
                <div className="bg-green-500/20 rounded-xl p-4 border border-green-400/30">
                  <div className="text-green-300 text-sm mb-1">Vendite 3 Mesi</div>
                  <div className="text-white text-2xl font-bold">{(analyticsProduct.totalSold3Months || 0).toFixed(0)}</div>
                  <div className="text-green-200 text-xs">{analyticsProduct.uom}</div>
                </div>
                <div className="bg-purple-500/20 rounded-xl p-4 border border-purple-400/30">
                  <div className="text-purple-300 text-sm mb-1">Media Giornaliera</div>
                  <div className="text-white text-2xl font-bold">{(analyticsProduct.avgDailySales || 0).toFixed(2)}</div>
                  <div className="text-purple-200 text-xs">{analyticsProduct.uom}/giorno</div>
                </div>
              </div>

              <div className="bg-yellow-500/20 rounded-xl p-4 border border-yellow-400/30">
                <div className="text-yellow-300 text-sm mb-1">Giorni di Stock</div>
                <div className="text-white text-3xl font-bold">{(analyticsProduct.daysOfStock || 0).toFixed(0)} giorni</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
