'use client';

import React from 'react';

interface OrderProduct {
  id: number;
  productName: string;
  description: string;
  quantity: number;
  quantityDelivered: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  uom: string;
}

interface OrderProductsTableProps {
  products: OrderProduct[];
  amountUntaxed: number;
  amountTax: number;
  amountTotal: number;
}

export function OrderProductsTable({
  products,
  amountUntaxed,
  amountTax,
  amountTotal,
}: OrderProductsTableProps) {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('it-IT', {
      style: 'currency',
      currency: 'EUR',
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Prodotti Ordinati ({products.length})
        </h3>
      </div>

      {/* Tabella prodotti */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prodotto
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantità
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Consegnato
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prezzo Unit.
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sconto
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subtotale
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {product.productName}
                    </div>
                    {product.description !== product.productName && (
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {product.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="text-sm text-gray-900">
                    {product.quantity} {product.uom}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="inline-flex items-center gap-1">
                    {product.quantityDelivered === product.quantity ? (
                      <>
                        <svg
                          className="w-4 h-4 text-green-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-sm text-green-600 font-medium">
                          {product.quantityDelivered}
                        </span>
                      </>
                    ) : product.quantityDelivered > 0 ? (
                      <span className="text-sm text-orange-600 font-medium">
                        {product.quantityDelivered} / {product.quantity}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">
                        0 / {product.quantity}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="text-sm text-gray-900">
                    {formatCurrency(product.unitPrice)}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  {product.discount > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      -{product.discount}%
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(product.subtotal)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Riepilogo totali */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="max-w-sm ml-auto space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotale (imponibile):</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(amountUntaxed)}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">IVA:</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(amountTax)}
            </span>
          </div>

          <div className="flex justify-between text-base pt-2 border-t border-gray-300">
            <span className="font-semibold text-gray-900">TOTALE:</span>
            <span className="font-bold text-gray-900 text-lg">
              {formatCurrency(amountTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
