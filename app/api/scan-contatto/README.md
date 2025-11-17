# Contact Scanner API

API endpoint per scansionare biglietti da visita e documenti contenenti informazioni di contatto, estrarre dati strutturati e salvarli in Odoo.

## Endpoint

### POST /api/scan-contatto

Scansiona un documento e restituisce i dati del contatto estratti, validati e mappati per Odoo.

**Request Format**: `multipart/form-data`

**Request Parameters**:
- `file` (required): File da scansionare (PDF, PNG, JPG, JPEG)
- `skipEnrichment` (optional): `true` per saltare l'enrichment con API esterne
- `skipValidation` (optional): `true` per saltare la validazione
- `skipMapping` (optional): `true` per saltare il mapping a Odoo
- `language` (optional): Lingua del documento (default: `it`)

**Constraints**:
- Max file size: 10MB
- Supported formats: PDF, PNG, JPG, JPEG
- Timeout: 60 seconds

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "scanId": "uuid",
    "status": "success",
    "startedAt": "2024-01-01T12:00:00.000Z",
    "completedAt": "2024-01-01T12:00:05.000Z",
    "duration": 5000,

    "extraction": {
      "status": "success",
      "contact": {
        "displayName": "Mario Rossi",
        "firstName": "Mario",
        "lastName": "Rossi",
        "companyName": "Acme Corp",
        "jobTitle": "CEO",
        "emails": [
          {
            "value": "mario.rossi@acme.com",
            "type": "work",
            "confidence": "high",
            "source": "ocr"
          }
        ],
        "phones": [
          {
            "value": "+39 123 456 7890",
            "formatted": "+39 123 456 7890",
            "type": "mobile",
            "countryCode": "IT",
            "confidence": "high",
            "source": "ocr"
          }
        ],
        "address": {
          "fullAddress": "Via Roma 123, 20100 Milano, Italy",
          "street": "Via Roma 123",
          "city": "Milano",
          "postalCode": "20100",
          "country": "Italy",
          "confidence": "high",
          "source": "ocr"
        },
        "taxIdentifier": {
          "vatId": "IT12345678901",
          "confidence": "high",
          "source": "ocr"
        },
        "website": "https://acme.com",
        "extractedAt": "2024-01-01T12:00:01.000Z"
      }
    },

    "enrichment": {
      "status": "success",
      "data": {
        "enrichmentScore": 85,
        "enrichedAt": "2024-01-01T12:00:03.000Z",
        "sources": [...]
      }
    },

    "validation": {
      "status": "success",
      "result": {
        "isValid": true,
        "errors": [],
        "warnings": []
      }
    },

    "mapping": {
      "status": "success",
      "result": {
        "odooData": {
          "name": "Mario Rossi",
          "isCompany": false,
          "email": "mario.rossi@acme.com",
          "mobile": "+39 123 456 7890",
          "street": "Via Roma 123",
          "city": "Milano",
          "zip": "20100",
          "vat": "IT12345678901",
          "website": "https://acme.com"
        },
        "overallFillPercentage": 85,
        "hasRequiredFields": true,
        "missingRequiredFields": []
      }
    },

    "odooSync": {
      "status": "success",
      "partnerId": 12345,
      "syncedAt": "2024-01-01T12:00:05.000Z"
    },

    "qualityScore": 92,
    "completenessScore": 85,
    "confidenceScore": 88,
    "readyForSync": true,

    "summary": "Successfully scanned and saved Mario Rossi to Odoo (Partner #12345) - 85% complete",
    "warnings": [],
    "errors": [],

    "extractedFields": ["displayName", "firstName", "lastName", "companyName", "emails", "phones", "address", "taxIdentifier"],
    "enrichedFields": ["companyInfo", "socialMedia"],
    "failedFields": []
  },
  "meta": {
    "requestId": "uuid",
    "duration": 5000,
    "timestamp": "2024-01-01T12:00:05.000Z"
  }
}
```

**Error Responses**:

400 Bad Request:
```json
{
  "error": "File obbligatorio",
  "code": "MISSING_FILE",
  "requestId": "uuid",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

401 Unauthorized:
```json
{
  "error": "Sessione non valida",
  "code": "UNAUTHORIZED",
  "requestId": "uuid",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

413 Payload Too Large:
```json
{
  "error": "File troppo grande. Massimo 10MB",
  "code": "FILE_TOO_LARGE",
  "maxSize": 10485760,
  "actualSize": 15000000,
  "requestId": "uuid",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

415 Unsupported Media Type:
```json
{
  "error": "Tipo di file non supportato: image/gif. Tipi supportati: PDF, PNG, JPG",
  "code": "UNSUPPORTED_FILE_TYPE",
  "supportedTypes": ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
  "actualType": "image/gif",
  "requestId": "uuid",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

500 Internal Server Error:
```json
{
  "error": "Errore durante la scansione del contatto",
  "code": "SCAN_ERROR",
  "requestId": "uuid",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### GET /api/scan-contatto

Health check endpoint per verificare che il servizio sia attivo.

**Success Response (200 OK)**:
```json
{
  "service": "Contact Scanner API",
  "status": "healthy",
  "version": "1.0.0",
  "supportedFormats": ["PDF", "PNG", "JPG", "JPEG"],
  "maxFileSize": "10MB",
  "features": {
    "ocr": true,
    "enrichment": true,
    "validation": true,
    "odooMapping": true,
    "odooSync": true
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Usage Examples

### JavaScript/Fetch

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('language', 'it');

const response = await fetch('/api/scan-contatto', {
  method: 'POST',
  body: formData,
  credentials: 'include' // Include cookies for authentication
});

const result = await response.json();

if (result.success) {
  console.log('Contact scanned:', result.data.extraction.contact.displayName);
  console.log('Quality score:', result.data.qualityScore);

  if (result.data.odooSync?.partnerId) {
    console.log('Saved to Odoo as Partner #', result.data.odooSync.partnerId);
  }
} else {
  console.error('Scan failed:', result.error);
}
```

### React Hook

```typescript
import { useState } from 'react';
import type { ContactScanResult } from '@/lib/types/contact-scan';

export function useContactScanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContactScanResult | null>(null);

  const scanContact = async (file: File, options?: {
    skipEnrichment?: boolean;
    skipValidation?: boolean;
    language?: string;
  }) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    if (options?.skipEnrichment) {
      formData.append('skipEnrichment', 'true');
    }
    if (options?.skipValidation) {
      formData.append('skipValidation', 'true');
    }
    if (options?.language) {
      formData.append('language', options.language);
    }

    try {
      const response = await fetch('/api/scan-contatto', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Scan failed');
      }

      setResult(data.data);
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { scanContact, loading, error, result };
}
```

### cURL

```bash
curl -X POST http://localhost:3000/api/scan-contatto \
  -H "Cookie: odoo_session_id=YOUR_SESSION" \
  -F "file=@business-card.jpg" \
  -F "language=it"
```

## Processing Pipeline

The contact scanner follows a multi-stage pipeline:

1. **Extraction** (required)
   - OCR with Claude Vision API
   - Structured data parsing
   - Confidence scoring

2. **Enrichment** (optional, can be skipped)
   - External API integration
   - Company data enrichment
   - Social media lookup

3. **Validation** (optional, can be skipped)
   - Email format validation
   - Phone number validation
   - VAT ID format check

4. **Mapping** (optional, can be skipped)
   - Map to Odoo partner format
   - Field mapping with confidence
   - Completeness scoring

5. **Odoo Sync** (optional, requires autoSaveToOdoo)
   - Check for existing partner
   - Create or update in Odoo
   - Return partner ID

## Quality Metrics

The API returns three quality scores:

- **Quality Score** (0-100): Overall data quality based on extracted fields
- **Completeness Score** (0-100): Percentage of Odoo fields filled
- **Confidence Score** (0-100): Average confidence across all extracted fields

## Error Handling

All errors follow this structure:
```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "requestId": "uuid",
  "timestamp": "ISO 8601 timestamp",
  "details": "Stack trace (only in development)"
}
```

## Authentication

This endpoint requires authentication via Odoo session cookie (`odoo_session_id`).

Ensure you're logged in before calling this endpoint.

## Configuration

Required environment variables:
- `ANTHROPIC_API_KEY`: Claude API key for OCR

Optional environment variables:
- `ODOO_URL`: Odoo instance URL
- `ODOO_DB`: Odoo database name

## Rate Limiting

- Max file size: 10MB
- Max request timeout: 60 seconds
- Recommended: Max 10 concurrent requests per user

## See Also

- [Contact Scan Types](../../../lib/types/contact-scan.ts)
- [Contact Scanner Service](../../../lib/services/contact-scanner.ts)
- [APPHUB Complete Guide](../../../APPHUB_COMPLETE_GUIDE.md)
