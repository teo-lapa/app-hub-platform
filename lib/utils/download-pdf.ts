/**
 * Utility per download PDF documenti
 *
 * Uso:
 * - import { downloadOrderPDF, downloadDeliveryPDF, downloadInvoicePDF } from '@/lib/utils/download-pdf'
 * - await downloadOrderPDF(orderId)
 */

export async function downloadOrderPDF(orderId: number): Promise<void> {
  try {
    const response = await fetch(`/api/portale-clienti/orders/${orderId}/pdf`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Errore durante il download del PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Prova a estrarre nome file dal Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `Ordine_${orderId}.pdf`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Errore download PDF ordine:', error);
    throw error;
  }
}

export async function downloadDeliveryPDF(deliveryId: number): Promise<void> {
  try {
    const response = await fetch(`/api/portale-clienti/deliveries/${deliveryId}/pdf`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Errore durante il download del PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `Consegna_${deliveryId}.pdf`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Errore download PDF consegna:', error);
    throw error;
  }
}

export async function downloadInvoicePDF(invoiceId: number): Promise<void> {
  try {
    const response = await fetch(`/api/portale-clienti/invoices/${invoiceId}/pdf`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Errore durante il download del PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `Fattura_${invoiceId}.pdf`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Errore download PDF fattura:', error);
    throw error;
  }
}

/**
 * Download generico PDF (per situazioni custom)
 */
export async function downloadPDF(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Errore durante il download del PDF');
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Errore download PDF:', error);
    throw error;
  }
}
