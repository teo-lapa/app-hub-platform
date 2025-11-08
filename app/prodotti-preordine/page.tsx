'use client'

import React, { useState, useEffect } from 'react'
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
  // ✨ NUOVO: Supporto varianti
  hasVariants?: boolean
  variantCount?: number
  variants?: Array<{
    id: number
    name: string
    stock: number
    price: number
    code: string
    assignedCustomers: Array<{
      customerId: number
      customerName: string
      quantity: number
    }>
  }>
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
  parentName?: string | null
}

export default function ProdottiPreordinePage() {
  const router = useRouter()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [togglingProductId, setTogglingProductId] = useState<number | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const [filterMode, setFilterMode] = useState<'preordine' | 'altri'>('preordine')
  const [altriProdottiLoaded, setAltriProdottiLoaded] = useState(false)

  // Customer assignment modal
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [customerAssignments, setCustomerAssignments] = useState<Array<{ customerId: number, quantity: number }>>([])
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')

  // Supplier change modal
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [selectedProductForSupplier, setSelectedProductForSupplier] = useState<Product | null>(null)
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('')

  // Analytics modal
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [analyticsProduct, setAnalyticsProduct] = useState<Product | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  // ✨ NEW: Global order creation loading state
  const [isCreatingAllOrders, setIsCreatingAllOrders] = useState(false)

  // ✨ NEW: Varianti espanse
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)

      // 🚀 OTTIMIZZAZIONE: Carica SOLO prodotti pre-ordine all'avvio
      // Load pre-order products with supplier info
      const preOrderRes = await fetch('/api/smart-ordering-v2/pre-order-products')
      if (preOrderRes.ok) {
        const data = await preOrderRes.json()

        // Build products list with supplier info from pre-order API
        const products: Product[] = (data.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          currentStock: p.currentStock || 0,
          uom: p.uom || 'pz',
          supplier: {
            id: p.supplier?.id || 0,
            name: p.supplier?.name || 'Fornitore sconosciuto'
          },
          isPreOrder: true, // Tutti questi sono pre-ordine
          assignedCustomers: p.assigned_customers || [],
          totalSold3Months: p.totalSold3Months,
          avgDailySales: p.avgDailySales,
          daysOfStock: p.daysOfStock,
          hasVariants: p.hasVariants || false,
          variantCount: p.variantCount || 0,
          variants: p.variants || []
        }))

        setAllProducts(products)
      }

      // Load suppliers list (leggero, solo per dropdown cambio fornitore)
      const suppliersRes = await fetch('/api/smart-ordering-v2/suppliers')
      if (suppliersRes.ok) {
        const data = await suppliersRes.json()
        const suppliersList: Supplier[] = []

        data.suppliers?.forEach((supplier: any) => {
          suppliersList.push({
            id: supplier.id,
            name: supplier.name
          })
        })

        setSuppliers(suppliersList)
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

  // 🆕 Carica "Altri prodotti" solo quando richiesto
  const loadAltriProdotti = async () => {
    if (altriProdottiLoaded) return // Già caricati

    try {
      setLoading(true)

      // Load ALL products from suppliers API
      const suppliersRes = await fetch('/api/smart-ordering-v2/suppliers')
      if (suppliersRes.ok) {
        const data = await suppliersRes.json()

        // Extract all products from all suppliers
        const allProductsFromSuppliers: Product[] = []

        data.suppliers?.forEach((supplier: any) => {
          supplier.products?.forEach((product: any) => {
            allProductsFromSuppliers.push({
              id: product.id,
              name: product.name,
              currentStock: product.currentStock || 0,
              uom: product.uom || 'pz',
              supplier: {
                id: supplier.id,
                name: supplier.name
              },
              isPreOrder: false, // Assumeremo che NON siano pre-ordine
              assignedCustomers: [],
              totalSold3Months: product.totalSold3Months,
              avgDailySales: product.avgDailySales,
              daysOfStock: product.daysOfStock
            })
          })
        })

        // Merge con prodotti pre-ordine esistenti (sovrascrivendoli se presenti)
        setAllProducts(prev => {
          const preOrderIds = new Set(prev.filter(p => p.isPreOrder).map(p => p.id))

          // Filtra prodotti "altri" che NON sono già in pre-ordine
          const altriProdotti = allProductsFromSuppliers.filter(p => !preOrderIds.has(p.id))

          // Merge: mantieni pre-ordine + aggiungi altri
          return [...prev, ...altriProdotti]
        })

        setAltriProdottiLoaded(true)
      }
    } catch (error) {
      console.error('Error loading altri prodotti:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePreOrder = async (productId: number, currentState: boolean) => {
    try {
      setTogglingProductId(productId)

      const res = await fetch('/api/smart-ordering-v2/toggle-preorder-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, enable: !currentState })
      })

      if (res.ok) {
        const data = await res.json()
        // Update local state
        setAllProducts(prev => prev.map(p =>
          p.id === productId ? { ...p, isPreOrder: !currentState } : p
        ))
        console.log(`✅ ${data.message}`)
      } else {
        const error = await res.json()
        console.error('❌ Errore toggle pre-order:', error)
        alert(`Errore: ${error.error || 'Impossibile modificare il tag PRE-ORDINE'}`)
      }
    } catch (error) {
      console.error('❌ Error toggling pre-order:', error)
      alert('Errore di connessione. Riprova.')
    } finally {
      setTogglingProductId(null)
    }
  }

  const openSupplierChange = (product: Product) => {
    setSelectedProductForSupplier(product)
    setShowSupplierModal(true)
  }

  const changeSupplier = async (newSupplierId: number) => {
    if (!selectedProductForSupplier) return

    // TODO: Implement supplier change in Odoo
    console.log(`Change product ${selectedProductForSupplier.id} to supplier ${newSupplierId}`)

    // Update local state
    const newSupplier = suppliers.find(s => s.id === newSupplierId)
    if (newSupplier) {
      setAllProducts(prev => prev.map(p =>
        p.id === selectedProductForSupplier.id ? { ...p, supplier: newSupplier } : p
      ))
    }

    // Close modal
    setShowSupplierModal(false)
    setSelectedProductForSupplier(null)
    setSupplierSearchTerm('')
  }

  const openCustomerAssignment = (product: Product, parentProductId?: number) => {
    // Se è una variante, salva anche l'ID del prodotto parent
    const productWithParent = parentProductId
      ? { ...product, parentProductId }
      : product;

    setSelectedProduct(productWithParent as any)
    setCustomerAssignments(
      (product.assignedCustomers || []).map(a => ({
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
      // Filtra solo assignments validi (quantità > 0)
      // Se tutti sono 0 o vuoti, validAssignments sarà vuoto e cancellerà tutti i clienti
      const validAssignments = customerAssignments.filter(a => a.customerId > 0 && a.quantity > 0);

      // Manda TUTTI in una singola chiamata (anche se array vuoto per cancellare tutto)
      const res = await fetch('/api/smart-ordering-v2/assign-preorder-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          assignments: validAssignments.map(a => ({
            customer_id: a.customerId,
            quantity: a.quantity
          }))
        })
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('Errore salvataggio:', error);
        alert(`Errore: ${error.error || 'Impossibile salvare le assegnazioni'}`);
        return;
      }

      console.log('Assegnazioni salvate con successo!');

      // Recupera nomi clienti per local state
      const savedAssignments = validAssignments.map(a => {
        const customer = customers.find(c => c.id === a.customerId);
        return {
          customerId: a.customerId,
          customerName: customer?.name || 'Cliente sconosciuto',
          quantity: a.quantity
        };
      });

      // Update local state - gestisce sia prodotti che varianti
      const parentId = (selectedProduct as any).parentProductId;

      if (parentId) {
        // È una variante - aggiorna la variante dentro il prodotto parent
        setAllProducts(prev => prev.map(p => {
          if (p.id === parentId && p.variants) {
            return {
              ...p,
              variants: p.variants.map(v =>
                v.id === selectedProduct.id
                  ? { ...v, assignedCustomers: savedAssignments }
                  : v
              )
            };
          }
          return p;
        }))
      } else {
        // È un prodotto normale - aggiorna direttamente
        setAllProducts(prev => prev.map(p =>
          p.id === selectedProduct.id
            ? { ...p, assignedCustomers: savedAssignments }
            : p
        ))
      }

      setShowCustomerModal(false)
      setSelectedProduct(null)
      setCustomerAssignments([])
    } catch (error) {
      console.error('Error saving assignments:', error)
      alert('Errore nel salvataggio delle assegnazioni')
    }
  }

  const openAnalytics = async (product: Product) => {
    setAnalyticsProduct(product)
    setShowAnalyticsModal(true)
    // Analytics data is already loaded with the product
  }

  // ✨ UPDATED: Single product order creation - now uses the same API endpoint
  const createOrder = async (product: Product) => {
    if (!product.isPreOrder || !hasAssignedCustomers(product)) {
      alert('Prodotto deve essere PRE-ORDINE con clienti assegnati')
      return
    }

    try {
      setIsCreatingAllOrders(true)

      // Prepare data - include BOTH main product AND all variants with assignments
      const productsToOrder: any[] = []

      // Add main product if it has assignments
      if (product.assignedCustomers && product.assignedCustomers.length > 0) {
        productsToOrder.push({
          productId: product.id,
          supplierId: product.supplier.id,
          supplierName: product.supplier.name,
          assignments: product.assignedCustomers.map(a => ({
            customerId: a.customerId,
            customerName: a.customerName,
            quantity: a.quantity
          }))
        })
      }

      // ✨ NUOVO: Add all variants that have assignments
      if (product.hasVariants && product.variants) {
        for (const variant of product.variants) {
          if (variant.assignedCustomers && variant.assignedCustomers.length > 0) {
            productsToOrder.push({
              productId: variant.id,  // Use VARIANT ID, not main product ID!
              supplierId: product.supplier.id,
              supplierName: product.supplier.name,
              assignments: variant.assignedCustomers.map(a => ({
                customerId: a.customerId,
                customerName: a.customerName,
                quantity: a.quantity
              }))
            })
          }
        }
      }

      const orderData = {
        products: productsToOrder
      }

      const res = await fetch('/api/smart-ordering-v2/create-all-preorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Errore nella creazione degli ordini')
      }

      const result = await res.json()

      // Show success message with summary
      alert(`✅ Creati ${result.customerQuotesCreated || 0} preventivi clienti, ${result.supplierQuotesCreated || 0} preventivi fornitori`)

      // Clear assignments for this product AND all its variants
      setAllProducts(prev => prev.map(p => {
        if (p.id === product.id) {
          return {
            ...p,
            assignedCustomers: [],
            // ✨ NUOVO: Clear variant assignments too
            variants: p.variants?.map(v => ({ ...v, assignedCustomers: [] }))
          }
        }
        return p
      }))

      // Reload data
      await loadAllData()
    } catch (error) {
      console.error('Error creating order:', error)
      alert(`Errore: ${error instanceof Error ? error.message : 'Impossibile creare gli ordini'}`)
    } finally {
      setIsCreatingAllOrders(false)
    }
  }

  // ✨ NEW: Create all orders for all pre-order products with assignments
  const createAllOrders = async () => {
    // Filter products that are PRE-ORDINE and have assigned customers (including variants)
    const preOrderProducts = allProducts.filter(p => p.isPreOrder && hasAssignedCustomers(p))

    if (preOrderProducts.length === 0) {
      alert('Nessun prodotto PRE-ORDINE con clienti assegnati')
      return
    }

    // Ask for confirmation
    const totalProducts = preOrderProducts.length
    const totalCustomers = preOrderProducts.reduce((sum, p) => sum + p.assignedCustomers.length, 0)

    // Conta anche le varianti con assegnazioni
    let totalVariantsWithAssignments = 0
    let totalCustomersFromVariants = 0
    preOrderProducts.forEach(p => {
      if (p.hasVariants && p.variants) {
        p.variants.forEach(v => {
          if (v.assignedCustomers && v.assignedCustomers.length > 0) {
            totalVariantsWithAssignments++
            totalCustomersFromVariants += v.assignedCustomers.length
          }
        })
      }
    })

    // Messaggio con info varianti se presenti
    let confirmMessage = `Vuoi creare gli ordini per ${totalProducts} prodotti (${totalCustomers} assegnazioni clienti)?`
    if (totalVariantsWithAssignments > 0) {
      confirmMessage = `Vuoi creare gli ordini per ${totalProducts} prodotti (${totalCustomers} assegnazioni clienti) + ${totalVariantsWithAssignments} varianti (${totalCustomersFromVariants} assegnazioni)?`
    }

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setIsCreatingAllOrders(true)

      // Prepare data structure for API - include main products AND all variants
      const productsToOrder: any[] = []

      for (const product of preOrderProducts) {
        // Add main product if it has assignments
        if (product.assignedCustomers && product.assignedCustomers.length > 0) {
          productsToOrder.push({
            productId: product.id,
            supplierId: product.supplier.id,
            supplierName: product.supplier.name,
            assignments: product.assignedCustomers.map(a => ({
              customerId: a.customerId,
              customerName: a.customerName,
              quantity: a.quantity
            }))
          })
        }

        // ✨ NUOVO: Add all variants that have assignments
        if (product.hasVariants && product.variants) {
          for (const variant of product.variants) {
            if (variant.assignedCustomers && variant.assignedCustomers.length > 0) {
              productsToOrder.push({
                productId: variant.id,  // Use VARIANT ID, not main product ID!
                supplierId: product.supplier.id,
                supplierName: product.supplier.name,
                assignments: variant.assignedCustomers.map(a => ({
                  customerId: a.customerId,
                  customerName: a.customerName,
                  quantity: a.quantity
                }))
              })
            }
          }
        }
      }

      const orderData = {
        products: productsToOrder
      }

      // Call API endpoint
      const res = await fetch('/api/smart-ordering-v2/create-all-preorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Errore nella creazione degli ordini')
      }

      const result = await res.json()

      // Show success message with summary
      alert(`✅ Creati ${result.customerQuotesCreated || 0} preventivi clienti, ${result.supplierQuotesCreated || 0} preventivi fornitori`)

      // Clear assignments from local state for processed products
      const processedProductIds = new Set(preOrderProducts.map(p => p.id))
      setAllProducts(prev => prev.map(p =>
        processedProductIds.has(p.id) ? { ...p, assignedCustomers: [] } : p
      ))

      // Reload data
      await loadAllData()
    } catch (error) {
      console.error('Error creating all orders:', error)
      alert(`Errore: ${error instanceof Error ? error.message : 'Impossibile creare gli ordini'}`)
    } finally {
      setIsCreatingAllOrders(false)
    }
  }

  // ✨ NUOVO: Controlla se prodotto ha clienti assegnati (incluse varianti)
  const hasAssignedCustomers = (product: Product) => {
    // Controlla prodotto principale
    if (product.assignedCustomers.length > 0) return true

    // Controlla varianti
    if (product.hasVariants && product.variants) {
      return product.variants.some(v => v.assignedCustomers && v.assignedCustomers.length > 0)
    }

    return false
  }

  const calculateTotalQuantity = (product: Product) => {
    // Quantità del prodotto principale
    let total = product.assignedCustomers.reduce((sum, a) => sum + a.quantity, 0)

    // ✨ NUOVO: Aggiungi quantità di TUTTE le varianti
    if (product.hasVariants && product.variants) {
      product.variants.forEach(variant => {
        if (variant.assignedCustomers && variant.assignedCustomers.length > 0) {
          total += variant.assignedCustomers.reduce((sum, a) => sum + a.quantity, 0)
        }
      })
    }

    return total
  }

  const filteredProducts = allProducts
    .filter(p => {
      // Filtro per modalità (preordine o altri)
      if (filterMode === 'preordine') {
        return p.isPreOrder
      } else {
        return !p.isPreOrder
      }
    })
    .filter(p => {
      // Filtro per ricerca testuale
      return p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
    })

  const filteredCustomers = customers.filter(c => {
    const search = customerSearchTerm.toLowerCase()
    return (
      c.name.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search) ||
      c.phone?.toLowerCase().includes(search) ||
      c.city?.toLowerCase().includes(search)
    )
  })

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-6">
          {/* Mobile: Column layout */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left side: Back button, Title, Create All button */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => router.push('/ordini-smart-v2')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </button>

              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-white truncate">Prodotti Pre-ordine</h1>
                <p className="text-purple-200 text-xs sm:text-sm hidden sm:block">Gestisci prodotti su ordinazione e assegna ai clienti</p>
              </div>

              {/* Stats badge on mobile - shows next to title */}
              <div className="sm:hidden text-right flex-shrink-0">
                <div className="text-xl font-bold text-white">{allProducts.filter(p => p.isPreOrder).length}</div>
                <div className="text-purple-200 text-xs">PRE-ORDINE</div>
              </div>
            </div>

            {/* Right side: Stats (desktop only) */}
            <div className="hidden sm:block text-right">
              <div className="text-3xl font-bold text-white">{allProducts.filter(p => p.isPreOrder).length}</div>
              <div className="text-purple-200 text-sm">Prodotti PRE-ORDINE</div>
            </div>
          </div>

          {/* Global "Create All Orders" Button - Full width on mobile */}
          {allProducts.filter(p => p.isPreOrder && hasAssignedCustomers(p)).length > 0 && (
            <button
              onClick={createAllOrders}
              disabled={isCreatingAllOrders}
              className={`mt-3 w-full sm:w-auto sm:mt-0 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-white text-sm sm:text-lg transition-all shadow-lg ${
                isCreatingAllOrders
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
              }`}
            >
              {isCreatingAllOrders ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm sm:text-base">Creazione...</span>
                </div>
              ) : (
                <span className="block sm:hidden">🚀 ORDINA TUTTO</span>
              )}
              {!isCreatingAllOrders && <span className="hidden sm:block">🚀 CREA TUTTI GLI ORDINI</span>}
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-6">
        <div className="space-y-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca prodotto o fornitore..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 text-sm sm:text-base bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setFilterMode('preordine')}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm sm:text-base transition-all ${
                filterMode === 'preordine'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              📦 Prodotti Pre-ordine ({allProducts.filter(p => p.isPreOrder).length})
            </button>
            <button
              onClick={() => {
                setFilterMode('altri')
                loadAltriProdotti() // Lazy load altri prodotti
              }}
              disabled={loading && !altriProdottiLoaded}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm sm:text-base transition-all ${
                filterMode === 'altri'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              } ${loading && !altriProdottiLoaded ? 'opacity-50 cursor-wait' : ''}`}
            >
              {loading && !altriProdottiLoaded && filterMode === 'altri' ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Caricamento...
                </span>
              ) : (
                `🛍️ Altri Prodotti (${allProducts.filter(p => !p.isPreOrder).length})`
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="max-w-[1800px] mx-auto px-2 sm:px-4 lg:px-8 pb-8">
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-white">Caricamento prodotti...</div>
          ) : (
            <div className="overflow-x-auto">
              {/* Desktop Table - hidden on mobile */}
              <table className="w-full hidden md:table">
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
                    <React.Fragment key={product.id}>
                      <tr className="border-b border-white/10 hover:bg-white/5 transition-colors">
                      {/* PRE-ORDINE Toggle */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center">
                          {togglingProductId === product.id ? (
                            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <input
                              type="checkbox"
                              checked={product.isPreOrder}
                              onChange={() => togglePreOrder(product.id, product.isPreOrder)}
                              className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                          )}
                        </div>
                      </td>

                      {/* Photo */}
                      <td className="px-4 py-4">
                        {imageErrors.has(product.id) ? (
                          <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" className="w-8 h-8">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                          </div>
                        ) : (
                          <img
                            src={`https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com/web/image/product.product/${product.id}/image_128`}
                            alt={product.name}
                            className="w-16 h-16 rounded-lg object-cover bg-white/10"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              setImageErrors(prev => new Set(prev).add(product.id));
                            }}
                          />
                        )}
                      </td>

                      {/* Product Name */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="text-white font-medium">{product.name}</div>
                          {product.hasVariants && (
                            <button
                              onClick={() => setExpandedVariants(prev =>
                                prev.has(product.id)
                                  ? new Set(Array.from(prev).filter(id => id !== product.id))
                                  : new Set([...Array.from(prev), product.id])
                              )}
                              className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded text-xs text-purple-300 transition-colors"
                            >
                              📦 {product.variantCount} Varianti {expandedVariants.has(product.id) ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openSupplierChange(product)}
                          className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-white/20 rounded-lg text-white text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          {product.supplier.name}
                        </button>
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
                          {product.isPreOrder && hasAssignedCustomers(product) && (
                            <button
                              onClick={() => createOrder(product)}
                              disabled={isCreatingAllOrders}
                              className={`px-3 py-1.5 text-white text-sm rounded-lg transition-all font-semibold ${
                                isCreatingAllOrders
                                  ? 'bg-gray-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                              }`}
                            >
                              {isCreatingAllOrders ? '⏳' : '🚀 ORDINA'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ✨ NUOVO: Righe varianti espanse */}
                    {product.hasVariants && expandedVariants.has(product.id) && product.variants && (
                      <>
                        {product.variants.map((variant: any, idx: number) => {
                          const variantTotalQty = variant.assignedCustomers?.reduce((sum: number, a: any) => sum + a.quantity, 0) || 0;

                          return (
                            <tr key={`${product.id}-variant-${variant.id}`} className="bg-purple-900/20 border-b border-white/5">
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 pl-8">
                                <div className="text-sm text-gray-300 flex items-center gap-2">
                                  <span className="text-purple-400">→</span>
                                  {variant.name}
                                  {variant.code && <span className="text-xs text-gray-500">({variant.code})</span>}
                                </div>
                              </td>
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 text-center">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                  variant.stock > 10
                                    ? 'bg-green-500/20 text-green-300'
                                    : variant.stock > 0
                                    ? 'bg-yellow-500/20 text-yellow-300'
                                    : 'bg-red-500/20 text-red-300'
                                }`}>
                                  {variant.stock.toFixed(1)}
                                </span>
                              </td>
                              {/* Clienti Assegnati */}
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => openCustomerAssignment(
                                    { ...product, id: variant.id, name: variant.name, assignedCustomers: variant.assignedCustomers },
                                    product.id
                                  )}
                                  className="w-full px-2 py-1.5 bg-slate-700 hover:bg-slate-600 border border-white/20 rounded-lg text-white text-xs text-left transition-colors"
                                >
                                  {variant.assignedCustomers && variant.assignedCustomers.length > 0 ? (
                                    <div className="space-y-1">
                                      {variant.assignedCustomers.map((a: any, i: number) => {
                                        const customer = customers.find(c => c.id === a.customerId);
                                        return (
                                          <div key={i} className="flex justify-between items-center">
                                            <span className="truncate text-xs">{customer?.name || 'Cliente sconosciuto'}</span>
                                            <span className="ml-2 text-purple-300 font-semibold">({a.quantity})</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-500 italic">Nessun cliente</div>
                                  )}
                                </button>
                              </td>
                              {/* Quantità Totale */}
                              <td className="px-4 py-2 text-center">
                                <span className="text-lg font-bold text-purple-300">
                                  {variantTotalQty}
                                </span>
                              </td>
                              <td className="px-4 py-2"></td>
                            </tr>
                          );
                        })}
                      </>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {/* Mobile Card Layout - shown only on mobile */}
              <div className="md:hidden space-y-4 p-4">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="bg-white/5 rounded-lg border border-white/10 p-4 space-y-3">
                    {/* Header with checkbox and image */}
                    <div className="flex items-start gap-3">
                      {/* PRE-ORDINE Toggle */}
                      <div className="flex-shrink-0 pt-1">
                        {togglingProductId === product.id ? (
                          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <input
                            type="checkbox"
                            checked={product.isPreOrder}
                            onChange={() => togglePreOrder(product.id, product.isPreOrder)}
                            className="w-6 h-6 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                        )}
                      </div>

                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        {imageErrors.has(product.id) ? (
                          <div className="w-20 h-20 rounded-lg bg-white/10 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" className="w-10 h-10">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                          </div>
                        ) : (
                          <img
                            src={`https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com/web/image/product.product/${product.id}/image_128`}
                            alt={product.name}
                            className="w-20 h-20 rounded-lg object-cover bg-white/10"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              setImageErrors(prev => new Set(prev).add(product.id));
                            }}
                          />
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-base mb-2 break-words">{product.name}</div>
                        {product.hasVariants && (
                          <button
                            onClick={() => setExpandedVariants(prev =>
                              prev.has(product.id)
                                ? new Set(Array.from(prev).filter(id => id !== product.id))
                                : new Set([...Array.from(prev), product.id])
                            )}
                            className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded text-sm text-purple-300 transition-colors"
                          >
                            📦 {product.variantCount} Varianti {expandedVariants.has(product.id) ? '▲' : '▼'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Supplier and Stock */}
                    <div className="flex justify-between items-center gap-2 text-sm">
                      <div className="flex-1">
                        <div className="text-gray-400 text-xs mb-1">Fornitore</div>
                        <button
                          onClick={() => openSupplierChange(product)}
                          className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-white/20 rounded-lg text-white text-sm text-left transition-colors"
                        >
                          {product.supplier.name}
                        </button>
                      </div>
                      <div>
                        <div className="text-gray-400 text-xs mb-1 text-center">Stock</div>
                        <span className={`inline-flex px-3 py-2 rounded-full text-sm font-medium ${
                          product.currentStock > 10
                            ? 'bg-green-500/20 text-green-300'
                            : product.currentStock > 0
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {product.currentStock.toFixed(1)} {product.uom}
                        </span>
                      </div>
                    </div>

                    {/* Customers Assigned */}
                    <div>
                      <div className="text-gray-400 text-xs mb-2">Clienti Assegnati</div>
                      <button
                        onClick={() => openCustomerAssignment(product)}
                        className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-white/20 rounded-lg text-white text-sm text-left transition-colors"
                      >
                        {product.assignedCustomers.length > 0 ? (
                          <div className="space-y-1">
                            {product.assignedCustomers.map((a, i) => {
                              const customer = customers.find(c => c.id === a.customerId);
                              return (
                                <div key={i} className="flex justify-between items-center">
                                  <span className="truncate">{customer?.name || 'Cliente sconosciuto'}</span>
                                  <span className="ml-2 text-purple-300 font-semibold">({a.quantity})</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-gray-500 italic text-center">Nessun cliente</div>
                        )}
                      </button>
                    </div>

                    {/* Quantity and Actions */}
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                      <div className="text-center">
                        <div className="text-gray-400 text-xs mb-1">Qtà Totale</div>
                        <span className="text-2xl font-bold text-purple-300">
                          {calculateTotalQuantity(product)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openAnalytics(product)}
                          className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm rounded-lg transition-all whitespace-nowrap"
                        >
                          📊 Analisi
                        </button>
                        {product.isPreOrder && hasAssignedCustomers(product) && (
                          <button
                            onClick={() => createOrder(product)}
                            disabled={isCreatingAllOrders}
                            className={`px-4 py-2 text-white text-sm rounded-lg transition-all font-semibold whitespace-nowrap ${
                              isCreatingAllOrders
                                ? 'bg-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                            }`}
                          >
                            {isCreatingAllOrders ? '⏳' : '🚀 ORDINA'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Variants - Mobile Version */}
                    {product.hasVariants && expandedVariants.has(product.id) && product.variants && (
                      <div className="space-y-2 pt-3 border-t border-white/10">
                        <div className="text-purple-300 text-sm font-semibold mb-2">Varianti:</div>
                        {product.variants.map((variant: any) => {
                          const variantTotalQty = variant.assignedCustomers?.reduce((sum: number, a: any) => sum + a.quantity, 0) || 0;
                          return (
                            <div key={variant.id} className="bg-purple-900/20 rounded-lg p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 text-sm text-gray-300">
                                  <span className="text-purple-400">→</span> {variant.name}
                                </div>
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                                  variant.stock > 10
                                    ? 'bg-green-500/20 text-green-300'
                                    : variant.stock > 0
                                    ? 'bg-yellow-500/20 text-yellow-300'
                                    : 'bg-red-500/20 text-red-300'
                                }`}>
                                  {variant.stock.toFixed(1)}
                                </span>
                              </div>
                              <button
                                onClick={() => openCustomerAssignment(
                                  { ...product, id: variant.id, name: variant.name, assignedCustomers: variant.assignedCustomers },
                                  product.id
                                )}
                                className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-white/20 rounded-lg text-white text-xs text-left transition-colors"
                              >
                                {variant.assignedCustomers && variant.assignedCustomers.length > 0 ? (
                                  <div className="space-y-1">
                                    {variant.assignedCustomers.map((a: any, i: number) => {
                                      const customer = customers.find(c => c.id === a.customerId);
                                      return (
                                        <div key={i} className="flex justify-between items-center">
                                          <span className="truncate">{customer?.name || 'Cliente sconosciuto'}</span>
                                          <span className="ml-2 text-purple-300 font-semibold">({a.quantity})</span>
                                        </div>
                                      );
                                    })}
                                    <div className="text-center pt-2 border-t border-white/10 text-purple-300 font-bold">
                                      Totale: {variantTotalQty}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-gray-500 italic text-center">👥 Assegna clienti</div>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Assignment Modal */}
      {showCustomerModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-slate-800 rounded-none sm:rounded-xl max-w-3xl w-full h-full sm:h-auto sm:max-h-[80vh] overflow-hidden border-0 sm:border border-purple-500/30">
            {/* Header - Mobile optimized */}
            <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start justify-between sm:gap-4 flex-1">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-white">Assegna Clienti</h2>
                  <p className="text-gray-400 text-xs sm:text-sm mt-1 truncate">{selectedProduct.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowCustomerModal(false)
                    setSelectedProduct(null)
                    setCustomerAssignments([])
                    setCustomerSearchTerm('')
                  }}
                  className="text-white/60 hover:text-white transition-colors p-2 sm:hidden"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="flex gap-2 sm:gap-4">
                <button
                  onClick={saveCustomerAssignments}
                  className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-sm rounded-lg transition-all font-semibold min-h-[48px]"
                >
                  💾 Salva
                </button>
                <button
                  onClick={() => {
                    setShowCustomerModal(false)
                    setSelectedProduct(null)
                    setCustomerAssignments([])
                    setCustomerSearchTerm('')
                  }}
                  className="hidden sm:block text-white/60 hover:text-white transition-colors p-2"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto" style={{maxHeight: 'calc(100vh - 140px)'}}>
              {/* Search bar - Mobile optimized */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca cliente..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3 text-sm sm:text-base bg-slate-700 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[48px]"
                />
              </div>

              {/* Selected customers list - Mobile optimized */}
              {customerAssignments.length > 0 && (
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <h3 className="text-xs font-semibold text-purple-300 uppercase tracking-wide">Clienti Selezionati:</h3>
                  {customerAssignments.map((assignment, idx) => {
                    const customer = customers.find(c => c.id === assignment.customerId)
                    return (
                      <div key={idx} className="flex gap-2 items-center bg-slate-700/50 rounded-lg p-3">
                        <div className="flex-1 text-white text-sm min-w-0">
                          <div className="truncate">{customer?.name || 'Cliente sconosciuto'}</div>
                          {customer?.city && <div className="text-gray-400 text-xs mt-0.5">{customer.city}</div>}
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={assignment.quantity || ''}
                          onChange={(e) => updateCustomerAssignment(idx, 'quantity', Number(e.target.value))}
                          placeholder="Qty"
                          className="w-16 sm:w-20 px-2 py-2 bg-slate-600 border border-white/20 rounded text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px]"
                          title="Inserisci 0 per rimuovere il cliente"
                        />
                        <button
                          onClick={() => removeCustomerAssignment(idx)}
                          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded transition-all text-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Available customers list - Mobile optimized */}
              <div className="border-t border-white/10 pt-3">
                <h3 className="text-xs font-semibold text-purple-300 uppercase tracking-wide mb-2">Aggiungi Cliente:</h3>
                <div className="max-h-64 sm:max-h-96 overflow-y-auto space-y-1.5">
                  {filteredCustomers.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      {customerSearchTerm ? 'Nessun cliente trovato' : 'Inizia a digitare per cercare...'}
                    </div>
                  ) : (
                    filteredCustomers.map(customer => {
                      const alreadyAdded = customerAssignments.some(a => a.customerId === customer.id)
                      return (
                        <button
                          key={customer.id}
                          onClick={() => {
                            if (!alreadyAdded) {
                              setCustomerAssignments([...customerAssignments, { customerId: customer.id, quantity: 1 }])
                              setCustomerSearchTerm('')
                            }
                          }}
                          disabled={alreadyAdded}
                          className={`w-full text-left px-4 py-3 rounded-lg transition-all min-h-[56px] ${
                            alreadyAdded
                              ? 'bg-slate-700/30 text-gray-500 cursor-not-allowed'
                              : 'bg-slate-700 hover:bg-slate-600 text-white active:bg-slate-500'
                          }`}
                        >
                          <div className="font-medium text-sm sm:text-base">
                            {customer.name}
                            {customer.parentName && <span className="text-xs text-purple-300 ml-2">({customer.parentName})</span>}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-400 mt-0.5">
                            {[customer.city, customer.email, customer.phone].filter(Boolean).join(' • ')}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="mt-4 p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
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
                  setCustomerSearchTerm('')
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

      {/* Supplier Change Modal */}
      {showSupplierModal && selectedProductForSupplier && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-purple-500/30">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Cambia Fornitore</h2>
                <p className="text-gray-400 text-sm mt-1">{selectedProductForSupplier.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowSupplierModal(false)
                  setSelectedProductForSupplier(null)
                  setSupplierSearchTerm('')
                }}
                className="text-white/60 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Search bar */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca fornitore..."
                  value={supplierSearchTerm}
                  onChange={(e) => setSupplierSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-700 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Current supplier */}
              <div className="p-3 bg-purple-500/20 rounded-lg border border-purple-500/30">
                <div className="text-sm text-purple-300 mb-1">Fornitore Attuale:</div>
                <div className="text-white font-semibold">{selectedProductForSupplier.supplier.name}</div>
              </div>

              {/* Suppliers list */}
              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredSuppliers.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    {supplierSearchTerm ? 'Nessun fornitore trovato' : 'Inizia a digitare per cercare...'}
                  </div>
                ) : (
                  filteredSuppliers.map(supplier => {
                    const isCurrent = supplier.id === selectedProductForSupplier.supplier.id
                    return (
                      <button
                        key={supplier.id}
                        onClick={() => changeSupplier(supplier.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                          isCurrent
                            ? 'bg-purple-500/30 text-white border-2 border-purple-500'
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                        }`}
                      >
                        <div className="font-medium">{supplier.name}</div>
                        {isCurrent && <div className="text-xs text-purple-300 mt-1">✓ Attuale</div>}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex gap-3">
              <button
                onClick={() => {
                  setShowSupplierModal(false)
                  setSelectedProductForSupplier(null)
                  setSupplierSearchTerm('')
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Chiudi
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
                {imageErrors.has(analyticsProduct.id) ? (
                  <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="white" className="w-10 h-10">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                    </svg>
                  </div>
                ) : (
                  <img
                    src={`https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com/web/image/product.product/${analyticsProduct.id}/image_256`}
                    alt={analyticsProduct.name}
                    className="w-20 h-20 rounded-xl object-cover bg-white/10"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      setImageErrors(prev => new Set(prev).add(analyticsProduct.id));
                    }}
                  />
                )}
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
