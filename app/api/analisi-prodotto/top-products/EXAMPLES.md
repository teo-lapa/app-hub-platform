# Top Products API - Esempi di Utilizzo

## 1. cURL

### Esempio Base

```bash
curl "http://localhost:3000/api/analisi-prodotto/top-products?dateFrom=2025-10-01&dateTo=2025-10-31"
```

### Con Headers di Autenticazione

```bash
curl -H "Cookie: your-session-cookie" \
  "http://localhost:3000/api/analisi-prodotto/top-products?dateFrom=2025-10-01&dateTo=2025-10-31"
```

### Output Formattato con jq

```bash
curl "http://localhost:3000/api/analisi-prodotto/top-products?dateFrom=2025-10-01&dateTo=2025-10-31" | jq
```

### Salvare Output in File JSON

```bash
curl "http://localhost:3000/api/analisi-prodotto/top-products?dateFrom=2025-10-01&dateTo=2025-10-31" \
  -o top-products-ottobre-2025.json
```

## 2. JavaScript (Fetch API)

### Esempio Base

```javascript
async function getTopProducts(dateFrom, dateTo) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/analisi-prodotto/top-products?dateFrom=${dateFrom}&dateTo=${dateTo}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching top products:', error);
    throw error;
  }
}

// Uso
const data = await getTopProducts('2025-10-01', '2025-10-31');
console.log('Top Products:', data.products);
console.log('Summary:', data.summary);
```

### Con Error Handling Completo

```javascript
async function getTopProductsWithErrorHandling(dateFrom, dateTo) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/analisi-prodotto/top-products?dateFrom=${dateFrom}&dateTo=${dateTo}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'API returned unsuccessful response');
    }

    return data;
  } catch (error) {
    console.error('Error fetching top products:', error);
    throw error;
  }
}

// Uso con try-catch
try {
  const data = await getTopProductsWithErrorHandling('2025-10-01', '2025-10-31');

  console.log(`Found ${data.summary.totalProducts} products`);
  console.log(`Total Revenue: ${data.summary.totalRevenue.toFixed(2)} CHF`);
  console.log(`Average Margin: ${data.summary.avgMargin.toFixed(2)}%`);

  data.products.forEach((product, index) => {
    console.log(`${index + 1}. ${product.name} - Revenue: ${product.totalRevenue.toFixed(2)} CHF`);
  });
} catch (error) {
  console.error('Failed to fetch top products:', error.message);
}
```

## 3. React Component

### Hook Personalizzato

```typescript
import { useState, useEffect } from 'react';

interface TopProduct {
  id: number;
  name: string;
  uom: string;
  totalQty: number;
  totalRevenue: number;
  orders: number;
  customers: number;
  marginPercent: number;
  avgPrice: number;
  avgCost: number;
}

interface TopProductsData {
  success: boolean;
  products: TopProduct[];
  period: {
    dateFrom: string;
    dateTo: string;
  };
  summary: {
    totalProducts: number;
    totalRevenue: number;
    totalQty: number;
    avgMargin: number;
  };
}

function useTopProducts(dateFrom: string, dateTo: string) {
  const [data, setData] = useState<TopProductsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopProducts() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/analisi-prodotto/top-products?dateFrom=${dateFrom}&dateTo=${dateTo}`
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch top products');
        }

        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (dateFrom && dateTo) {
      fetchTopProducts();
    }
  }, [dateFrom, dateTo]);

  return { data, loading, error };
}

export default useTopProducts;
```

### Componente di Visualizzazione

```typescript
import React from 'react';
import useTopProducts from './useTopProducts';

interface TopProductsProps {
  dateFrom: string;
  dateTo: string;
}

export function TopProducts({ dateFrom, dateTo }: TopProductsProps) {
  const { data, loading, error } = useTopProducts(dateFrom, dateTo);

  if (loading) {
    return <div>Loading top products...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!data || data.products.length === 0) {
    return <div>No products found for the selected period.</div>;
  }

  return (
    <div className="top-products">
      <h2>Top Products</h2>

      <div className="summary">
        <h3>Summary</h3>
        <p>Period: {data.period.dateFrom} to {data.period.dateTo}</p>
        <p>Total Products: {data.summary.totalProducts}</p>
        <p>Total Revenue: {data.summary.totalRevenue.toFixed(2)} CHF</p>
        <p>Average Margin: {data.summary.avgMargin.toFixed(2)}%</p>
      </div>

      <table className="products-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Product Name</th>
            <th>UOM</th>
            <th>Quantity</th>
            <th>Revenue</th>
            <th>Orders</th>
            <th>Customers</th>
            <th>Margin %</th>
          </tr>
        </thead>
        <tbody>
          {data.products.map((product, index) => (
            <tr key={product.id}>
              <td>{index + 1}</td>
              <td>{product.name}</td>
              <td>{product.uom}</td>
              <td>{product.totalQty.toFixed(2)}</td>
              <td>{product.totalRevenue.toFixed(2)} CHF</td>
              <td>{product.orders}</td>
              <td>{product.customers}</td>
              <td className={product.marginPercent >= 0 ? 'positive' : 'negative'}>
                {product.marginPercent.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## 4. Node.js con axios

```javascript
const axios = require('axios');

async function getTopProducts(dateFrom, dateTo) {
  try {
    const response = await axios.get(
      'http://localhost:3000/api/analisi-prodotto/top-products',
      {
        params: {
          dateFrom,
          dateTo
        }
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.data);
      throw new Error(error.response.data.error || 'API request failed');
    } else if (error.request) {
      // Request was made but no response
      console.error('No response received:', error.request);
      throw new Error('No response from server');
    } else {
      // Something else happened
      console.error('Error:', error.message);
      throw error;
    }
  }
}

// Uso
(async () => {
  try {
    const data = await getTopProducts('2025-10-01', '2025-10-31');

    console.log('Summary:', data.summary);
    console.log('\nTop 5 Products:');

    data.products.slice(0, 5).forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Revenue: ${product.totalRevenue.toFixed(2)} CHF`);
      console.log(`   Margin: ${product.marginPercent.toFixed(2)}%`);
    });
  } catch (error) {
    console.error('Failed:', error.message);
  }
})();
```

## 5. Python con requests

```python
import requests
from datetime import datetime, timedelta

def get_top_products(date_from, date_to):
    """
    Fetch top products from API

    Args:
        date_from (str): Start date in YYYY-MM-DD format
        date_to (str): End date in YYYY-MM-DD format

    Returns:
        dict: API response data
    """
    url = "http://localhost:3000/api/analisi-prodotto/top-products"
    params = {
        "dateFrom": date_from,
        "dateTo": date_to
    }

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()

        data = response.json()

        if not data.get('success'):
            raise Exception(data.get('error', 'API request failed'))

        return data
    except requests.exceptions.RequestException as e:
        print(f"Error fetching top products: {e}")
        raise

# Uso
if __name__ == "__main__":
    # Ottobre 2025
    date_from = "2025-10-01"
    date_to = "2025-10-31"

    try:
        data = get_top_products(date_from, date_to)

        print(f"Summary:")
        print(f"  Total Products: {data['summary']['totalProducts']}")
        print(f"  Total Revenue: {data['summary']['totalRevenue']:.2f} CHF")
        print(f"  Average Margin: {data['summary']['avgMargin']:.2f}%")

        print(f"\nTop 5 Products:")
        for i, product in enumerate(data['products'][:5], 1):
            print(f"{i}. {product['name']}")
            print(f"   Revenue: {product['totalRevenue']:.2f} CHF")
            print(f"   Margin: {product['marginPercent']:.2f}%")
    except Exception as e:
        print(f"Failed: {e}")
```

## 6. Excel/VBA

```vba
Function GetTopProducts(dateFrom As String, dateTo As String) As Object
    Dim url As String
    Dim http As Object
    Dim response As String

    url = "http://localhost:3000/api/analisi-prodotto/top-products" & _
          "?dateFrom=" & dateFrom & "&dateTo=" & dateTo

    Set http = CreateObject("MSXML2.XMLHTTP")

    http.Open "GET", url, False
    http.send

    response = http.responseText

    ' Parse JSON response
    Dim json As Object
    Set json = JsonConverter.ParseJson(response)

    Set GetTopProducts = json
End Function

' Uso in una Sub
Sub LoadTopProducts()
    Dim data As Object
    Dim products As Collection
    Dim product As Object
    Dim ws As Worksheet
    Dim row As Long

    Set data = GetTopProducts("2025-10-01", "2025-10-31")
    Set products = data("products")
    Set ws = ThisWorkbook.Sheets("TopProducts")

    ' Clear existing data
    ws.Cells.Clear

    ' Headers
    ws.Range("A1").Value = "Rank"
    ws.Range("B1").Value = "Product Name"
    ws.Range("C1").Value = "UOM"
    ws.Range("D1").Value = "Quantity"
    ws.Range("E1").Value = "Revenue"
    ws.Range("F1").Value = "Margin %"

    ' Data
    row = 2
    For Each product In products
        ws.Cells(row, 1).Value = row - 1
        ws.Cells(row, 2).Value = product("name")
        ws.Cells(row, 3).Value = product("uom")
        ws.Cells(row, 4).Value = product("totalQty")
        ws.Cells(row, 5).Value = product("totalRevenue")
        ws.Cells(row, 6).Value = product("marginPercent")
        row = row + 1
    Next product

    MsgBox "Top products loaded successfully!", vbInformation
End Sub
```

## 7. Postman Collection

```json
{
  "info": {
    "name": "Top Products API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Top Products - Ottobre 2025",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "http://localhost:3000/api/analisi-prodotto/top-products?dateFrom=2025-10-01&dateTo=2025-10-31",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "analisi-prodotto", "top-products"],
          "query": [
            {
              "key": "dateFrom",
              "value": "2025-10-01"
            },
            {
              "key": "dateTo",
              "value": "2025-10-31"
            }
          ]
        }
      }
    },
    {
      "name": "Get Top Products - Ultimi 6 Mesi",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "http://localhost:3000/api/analisi-prodotto/top-products?dateFrom={{sixMonthsAgo}}&dateTo={{today}}",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "analisi-prodotto", "top-products"],
          "query": [
            {
              "key": "dateFrom",
              "value": "{{sixMonthsAgo}}"
            },
            {
              "key": "dateTo",
              "value": "{{today}}"
            }
          ]
        }
      }
    }
  ]
}
```
