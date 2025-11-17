/**
 * CONTACT SCANNER API - EXAMPLE USAGE
 *
 * Esempi pratici di come utilizzare l'endpoint /api/scan-contatto
 * in diversi scenari.
 */

import type { ContactScanResult } from '@/lib/types/contact-scan';

// ============================================================================
// EXAMPLE 1: Basic Usage - Scan and Extract
// ============================================================================

async function scanBusinessCard(file: File): Promise<ContactScanResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('language', 'it');

  const response = await fetch('/api/scan-contatto', {
    method: 'POST',
    body: formData,
    credentials: 'include' // Important: include cookies for Odoo session
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Scan failed');
  }

  const result = await response.json();
  return result.data;
}

// Usage:
// const result = await scanBusinessCard(fileInput.files[0]);
// console.log('Extracted:', result.extraction.contact.displayName);

// ============================================================================
// EXAMPLE 2: React Component with File Upload
// ============================================================================

/*
import { useState } from 'react';
import { Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function ContactScannerUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContactScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleScan = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-4">
        <label className="block mb-2 font-medium">
          Upload Business Card or Contact Document
        </label>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>

      <button
        onClick={handleScan}
        disabled={!file || loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md
          disabled:bg-gray-400 disabled:cursor-not-allowed
          flex items-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Scanning...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Scan Contact
          </>
        )}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {result && result.status === 'success' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">Contact Scanned Successfully</p>
              <p className="text-sm text-green-700">{result.summary}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium">{result.extraction.contact?.displayName}</span>
            </div>

            {result.extraction.contact?.companyName && (
              <div className="flex justify-between">
                <span className="text-gray-600">Company:</span>
                <span className="font-medium">{result.extraction.contact.companyName}</span>
              </div>
            )}

            {result.extraction.contact?.emails[0] && (
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{result.extraction.contact.emails[0].value}</span>
              </div>
            )}

            {result.extraction.contact?.phones[0] && (
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-medium">{result.extraction.contact.phones[0].value}</span>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t">
              <span className="text-gray-600">Quality Score:</span>
              <span className="font-medium">{result.qualityScore}/100</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Completeness:</span>
              <span className="font-medium">{result.completenessScore}%</span>
            </div>

            {result.odooSync?.partnerId && (
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-600">Odoo Partner ID:</span>
                <span className="font-medium text-blue-600">#{result.odooSync.partnerId}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
*/

// ============================================================================
// EXAMPLE 3: Custom Hook for Contact Scanning
// ============================================================================

/*
import { useState } from 'react';
import type { ContactScanResult } from '@/lib/types/contact-scan';

interface ScanOptions {
  skipEnrichment?: boolean;
  skipValidation?: boolean;
  language?: string;
}

export function useContactScanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContactScanResult | null>(null);
  const [progress, setProgress] = useState(0);

  const scanContact = async (file: File, options?: ScanOptions) => {
    setLoading(true);
    setError(null);
    setProgress(0);

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
      setProgress(10);

      const response = await fetch('/api/scan-contatto', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      setProgress(90);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Scan failed');
      }

      setResult(data.data);
      setProgress(100);

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setResult(null);
    setProgress(0);
  };

  return {
    scanContact,
    loading,
    error,
    result,
    progress,
    reset
  };
}
*/

// Usage:
// const { scanContact, loading, error, result } = useContactScanner();
// await scanContact(file, { language: 'it' });

// ============================================================================
// EXAMPLE 4: Batch Processing Multiple Business Cards
// ============================================================================

async function scanMultipleContacts(files: File[]): Promise<ContactScanResult[]> {
  const results: ContactScanResult[] = [];

  for (const file of files) {
    try {
      const result = await scanBusinessCard(file);
      results.push(result);

      // Optional: delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to scan ${file.name}:`, error);
      // Continue with next file
    }
  }

  return results;
}

// Usage:
// const files = Array.from(fileInput.files);
// const results = await scanMultipleContacts(files);
// console.log(`Scanned ${results.length} contacts`);

// ============================================================================
// EXAMPLE 5: Extract Only (Skip Odoo Sync)
// ============================================================================

async function extractContactOnly(file: File): Promise<ContactScanResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('skipMapping', 'true'); // Skip Odoo mapping

  const response = await fetch('/api/scan-contatto', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Scan failed');
  }

  const result = await response.json();
  return result.data;
}

// Usage:
// const result = await extractContactOnly(file);
// console.log('Extracted contact:', result.extraction.contact);
// // No Odoo mapping/sync performed

// ============================================================================
// EXAMPLE 6: Fast Scan (Skip Everything Optional)
// ============================================================================

async function fastScan(file: File): Promise<ContactScanResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('skipEnrichment', 'true');
  formData.append('skipValidation', 'true');

  const response = await fetch('/api/scan-contatto', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Scan failed');
  }

  const result = await response.json();
  return result.data;
}

// Usage:
// const result = await fastScan(file); // Fastest, only extraction + mapping

// ============================================================================
// EXAMPLE 7: Health Check
// ============================================================================

async function checkServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/scan-contatto', {
      method: 'GET'
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}

// Usage:
// const isHealthy = await checkServiceHealth();
// if (!isHealthy) {
//   console.error('Contact Scanner service is unavailable');
// }

// ============================================================================
// EXAMPLE 8: Error Handling with Retry
// ============================================================================

async function scanWithRetry(
  file: File,
  maxRetries: number = 3
): Promise<ContactScanResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Scan attempt ${attempt}/${maxRetries}`);
      return await scanBusinessCard(file);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`Attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        // Exponential backoff
        const delayMs = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

// Usage:
// try {
//   const result = await scanWithRetry(file, 3);
//   console.log('Success after retry:', result);
// } catch (error) {
//   console.error('Failed after all retries:', error);
// }

// ============================================================================
// EXAMPLE 9: Type-Safe Result Processing
// ============================================================================

function processSuccessfulScan(result: ContactScanResult) {
  if (result.status !== 'success') {
    console.warn('Scan was not fully successful:', result.status);
    return;
  }

  // Type-safe access to extracted contact
  const contact = result.extraction.contact;

  if (!contact) {
    console.error('No contact extracted');
    return;
  }

  console.log('Contact Information:');
  console.log('  Name:', contact.displayName);
  console.log('  Company:', contact.companyName || 'N/A');
  console.log('  Job Title:', contact.jobTitle || 'N/A');

  if (contact.emails.length > 0) {
    console.log('  Emails:');
    contact.emails.forEach((email, i) => {
      console.log(`    ${i + 1}. ${email.value} (${email.type}, confidence: ${email.confidence})`);
    });
  }

  if (contact.phones.length > 0) {
    console.log('  Phones:');
    contact.phones.forEach((phone, i) => {
      console.log(`    ${i + 1}. ${phone.value} (${phone.type}, confidence: ${phone.confidence})`);
    });
  }

  if (contact.address) {
    console.log('  Address:', contact.address.fullAddress);
  }

  // Check Odoo sync
  if (result.odooSync?.status === 'success') {
    console.log('  Odoo Partner ID:', result.odooSync.partnerId);
  }

  // Quality metrics
  console.log('\nQuality Metrics:');
  console.log('  Quality Score:', result.qualityScore, '/100');
  console.log('  Completeness:', result.completenessScore, '%');
  console.log('  Confidence:', result.confidenceScore, '/100');

  // Warnings
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(warning => console.log('  -', warning));
  }
}

// Usage:
// const result = await scanBusinessCard(file);
// processSuccessfulScan(result);

// ============================================================================
// EXPORT FOR TESTING
// ============================================================================

export {
  scanBusinessCard,
  scanMultipleContacts,
  extractContactOnly,
  fastScan,
  checkServiceHealth,
  scanWithRetry,
  processSuccessfulScan
};
