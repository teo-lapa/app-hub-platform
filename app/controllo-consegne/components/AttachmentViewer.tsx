'use client';

import { useState } from 'react';
import { DocumentAttachment } from '../types';
import styles from '../controllo-consegne.module.css';

interface AttachmentViewerProps {
  attachment: DocumentAttachment;
  onClose: () => void;
}

export default function AttachmentViewer({ attachment, onClose }: AttachmentViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Convert base64 to image URL
  const imageUrl = attachment.data && attachment.data.startsWith('data:')
    ? attachment.data
    : attachment.data
      ? `data:image/png;base64,${attachment.data}`
      : '';

  const typeLabels = {
    signature: 'Firma Cliente',
    photo: 'Foto Consegna',
    payment: 'Ricevuta Pagamento',
    reso: 'Foto Reso',
  };

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{typeLabels[attachment.type]}</h3>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.imageContainer}>
          {isLoading && (
            <div className={styles.loader}>Caricamento...</div>
          )}
          <img
            src={imageUrl}
            alt={typeLabels[attachment.type]}
            onLoad={() => setIsLoading(false)}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        </div>

        {attachment.note && (
          <div className={styles.noteSection}>
            <strong>Note:</strong>
            <div dangerouslySetInnerHTML={{ __html: attachment.note }} />
          </div>
        )}

        {attachment.type === 'payment' && (
          <div className={styles.paymentDetails}>
            {(attachment as any).amount && (
              <p><strong>Importo:</strong> €{(attachment as any).amount.toFixed(2)}</p>
            )}
            {(attachment as any).method && (
              <p><strong>Metodo:</strong> {
                (attachment as any).method === 'cash' ? 'Contante' :
                (attachment as any).method === 'card' ? 'Carta' :
                (attachment as any).method === 'bonifico' ? 'Bonifico' : ''
              }</p>
            )}
          </div>
        )}

        <div className={styles.timestamp}>
          {new Date(attachment.timestamp).toLocaleString('it-IT')}
        </div>
      </div>
    </div>
  );
}
