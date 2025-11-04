'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, MagnifyingGlassIcon, UserPlusIcon } from '@heroicons/react/24/outline'

interface Product {
  id: number
  name: string
  stock: number
  supplier: string
  assignedCustomers: Array<{
    customerId: number
    customerName: string
    quantity: number
  }>
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
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null)
  const [quantity, setQuantity] = useState<number>(1)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load pre-order products
      const productsRes = await fetch('/api/smart-ordering-v2/pre-order-products')
      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(data.products || [])
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

  const handleTogglePreOrder = async (productId: number, currentlyPreOrder: boolean) => {
    try {
      const res = await fetch('/api/smart-ordering-v2/toggle-preorder-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, enable: !currentlyPreOrder })
      })

      if (res.ok) {
        await loadData()
      }
    } catch (error) {
      console.error('Error toggling pre-order:', error)
    }
  }

  const handleAssignCustomer = async () => {
    if (!selectedProduct || !selectedCustomer || quantity <= 0) return

    try {
      const res = await fetch('/api/smart-ordering-v2/assign-preorder-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          customerId: selectedCustomer,
          quantity
        })
      })

      if (res.ok) {
        await loadData()
        setShowCustomerModal(false)
        setSelectedProduct(null)
        setSelectedCustomer(null)
        setQuantity(1)
      }
    } catch (error) {
      console.error('Error assigning customer:', error)
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              <div className="text-3xl font-bold text-white">{products.length}</div>
              <div className="text-purple-200 text-sm">Prodotti totali</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-white">Caricamento...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {searchTerm ? 'Nessun prodotto trovato' : 'Nessun prodotto pre-ordine'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-purple-200">Prodotto</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-purple-200">Fornitore</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-purple-200">Stock</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-purple-200">Clienti Assegnati</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-purple-200">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-white font-medium">{product.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-300">{product.supplier}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                          product.stock > 10
                            ? 'bg-green-500/20 text-green-300'
                            : product.stock > 0
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-white">
                          {product.assignedCustomers?.length || 0}
                          {product.assignedCustomers && product.assignedCustomers.length > 0 && (
                            <div className="text-xs text-gray-400 mt-1">
                              Tot: {product.assignedCustomers.reduce((sum, c) => sum + c.quantity, 0)} unità
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedProduct(product)
                              setShowCustomerModal(true)
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-sm rounded-lg transition-all flex items-center gap-2"
                          >
                            <UserPlusIcon className="w-4 h-4" />
                            Assegna
                          </button>
                          <button
                            onClick={() => handleTogglePreOrder(product.id, true)}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm rounded-lg transition-all"
                          >
                            Rimuovi
                          </button>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-purple-500/30">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Assegna Cliente</h2>
              <p className="text-gray-400 text-sm mt-1">{selectedProduct.name}</p>
            </div>

            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Cliente</label>
                <select
                  value={selectedCustomer || ''}
                  onChange={(e) => setSelectedCustomer(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Seleziona un cliente...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.city ? `(${customer.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">Quantità</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {selectedProduct.assignedCustomers && selectedProduct.assignedCustomers.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-purple-200 mb-2">Clienti già assegnati:</h3>
                  <div className="space-y-2">
                    {selectedProduct.assignedCustomers.map((assignment, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                        <span className="text-white">{assignment.customerName}</span>
                        <span className="text-purple-300 font-medium">{assignment.quantity} unità</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3">
              <button
                onClick={() => {
                  setShowCustomerModal(false)
                  setSelectedProduct(null)
                  setSelectedCustomer(null)
                  setQuantity(1)
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleAssignCustomer}
                disabled={!selectedCustomer || quantity <= 0}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assegna Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
