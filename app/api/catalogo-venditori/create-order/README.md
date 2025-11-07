# Create Order API Endpoint

## Overview
This endpoint creates a sale.order in Odoo from the cart for the seller catalog feature.

**Endpoint:** `POST /api/catalogo-venditori/create-order`

## Configuration
- **Dynamic:** `force-dynamic` (no caching)
- **Max Duration:** 120 seconds

## Request

### Method
`POST`

### Headers
```
Content-Type: application/json
```

### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | number | Yes | The Odoo partner ID of the customer |
| `deliveryAddressId` | number \| null | No | Optional delivery address (partner child address). If null, uses customer's main address |
| `orderLines` | Array<OrderLine> | Yes | Array of products to order (must have at least 1 item) |
| `notes` | string | No | Optional order notes |

#### OrderLine Structure
```typescript
{
  product_id: number;  // Odoo product.product ID
  quantity: number;    // Must be positive
}
```

### Example Request
```json
{
  "customerId": 123,
  "deliveryAddressId": 456,
  "orderLines": [
    {
      "product_id": 789,
      "quantity": 5
    },
    {
      "product_id": 790,
      "quantity": 2
    }
  ],
  "notes": "Please deliver before Friday"
}
```

## Response

### Success Response (200)
```json
{
  "success": true,
  "message": "Order created successfully",
  "orderId": 12345,
  "orderName": "SO00123",
  "total": 1250.50,
  "itemsCount": 2
}
```

### Error Responses

#### 400 Bad Request
Invalid input data:
```json
{
  "success": false,
  "error": "customerId is required and must be a number"
}
```

```json
{
  "success": false,
  "error": "orderLines must be a non-empty array"
}
```

```json
{
  "success": false,
  "error": "Each order line must have a valid product_id (number)"
}
```

#### 404 Not Found
Customer or product not found:
```json
{
  "success": false,
  "error": "Customer with ID 123 not found"
}
```

```json
{
  "success": false,
  "error": "Product with ID 789 not found"
}
```

```json
{
  "success": false,
  "error": "Delivery address 456 not found or does not belong to customer"
}
```

#### 409 Conflict
Product not available for sale:
```json
{
  "success": false,
  "error": "Product Widget ABC (WID-001) is not available for sale"
}
```

#### 500 Internal Server Error
Server-side error:
```json
{
  "success": false,
  "error": "Error creating order",
  "details": "Stack trace (only in development)"
}
```

## Flow

1. **Input Validation**
   - Validates `customerId` is a number
   - Validates `orderLines` is a non-empty array
   - Validates each order line has valid `product_id` and `quantity`

2. **Customer Validation**
   - Fetches customer partner from Odoo by ID
   - Returns 404 if customer not found

3. **Delivery Address Validation** (if provided)
   - Validates delivery address exists
   - Validates delivery address belongs to the customer (parent_id check)
   - Uses customer's main address if not provided

4. **Product Validation**
   - Validates each product exists in Odoo
   - Checks product is active and available for sale (`sale_ok` flag)
   - Returns 404 if product not found
   - Returns 409 if product not available for sale

5. **Order Creation**
   - Creates `sale.order` in Odoo with:
     - `partner_id`: Customer ID
     - `partner_shipping_id`: Delivery address or customer main address
     - `date_order`: Current timestamp
     - `state`: 'draft' (quotation - requires manual confirmation)
     - `origin`: 'Catalogo Venditori'
     - `note`: Order notes
     - `payment_term_id`: Customer's payment term (if available)

6. **Order Lines Creation**
   - Creates `sale.order.line` for each product
   - Links to the created order
   - Sets product ID and quantity

7. **Chatter Notes** (if notes provided)
   - Posts notes to Odoo Chatter as internal note
   - Formatted with "Note Venditore" header

8. **Response**
   - Returns created order details with ID, name, total, and item count

## Features

- **Comprehensive Input Validation:** Validates all required fields and data types
- **Security:** Validates delivery address belongs to customer
- **Product Availability Check:** Ensures products are active and available for sale
- **Payment Terms:** Automatically applies customer's payment terms
- **Draft Order:** Creates order as draft/quotation (requires manual confirmation)
- **Chatter Integration:** Posts order notes to Odoo Chatter
- **Error Handling:** Detailed error messages with proper HTTP status codes
- **Logging:** Comprehensive console logging for debugging

## Security Notes

- Uses admin session to create orders in Odoo
- Validates delivery address belongs to specified customer
- Does not perform stock validation (order remains as quotation)
- Order must be manually confirmed in Odoo

## Related Files

- **Admin Session:** `lib/odoo/admin-session.ts` - Odoo RPC client
- **Reference:** `app/api/portale-clienti/cart/checkout/route.ts` - Similar order creation pattern

## Usage Example

```typescript
const response = await fetch('/api/catalogo-venditori/create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    customerId: 123,
    deliveryAddressId: null, // Use customer's main address
    orderLines: [
      { product_id: 789, quantity: 5 },
      { product_id: 790, quantity: 2 }
    ],
    notes: 'Rush order - deliver ASAP'
  })
});

const data = await response.json();

if (data.success) {
  console.log('Order created:', data.orderName);
  console.log('Total:', data.total);
} else {
  console.error('Error:', data.error);
}
```

## Testing

To test the endpoint locally:

```bash
curl -X POST http://localhost:3000/api/catalogo-venditori/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 123,
    "deliveryAddressId": null,
    "orderLines": [
      {"product_id": 789, "quantity": 5}
    ],
    "notes": "Test order"
  }'
```
