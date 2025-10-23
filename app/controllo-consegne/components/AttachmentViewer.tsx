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

  // Determine file type
  const isPDF = attachment.type === 'signature';
  const mimetype = (attachment as any).mimetype || '';
  const isAudio = mimetype.startsWith('audio/');

  // Convert base64 to appropriate data URL
  const fileUrl = attachment.data && attachment.data.startsWith('data:')
    ? attachment.data
    : attachment.data
      ? isPDF
        ? `data:application/pdf;base64,${attachment.data}`
        : isAudio
          ? `data:${mimetype};base64,${attachment.data}`
          : `data:image/png;base64,${attachment.data}`
      : '';

  const typeLabels = {
    signature: 'Firma Cliente',
    photo: 'Foto Consegna',
    payment: 'Ricevuta Pagamento',
    reso: 'Foto Reso',
    scarico_parziale: 'Scarico Parziale',
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
          {isPDF ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>✍️</div>
              <h3 style={{ color: '#000', marginBottom: '20px' }}>Documento Firmato</h3>
              <a
                href={fileUrl}
                download="firma.pdf"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: '#667eea',
                  color: '#fff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                }}
              >
                📥 Scarica PDF Firmato
              </a>
              <p style={{ marginTop: '20px', color: '#666', fontSize: '0.9rem' }}>
                Clicca per scaricare e visualizzare il documento firmato
              </p>
            </div>
          ) : isAudio ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎤</div>
              <h3 style={{ color: '#000', marginBottom: '20px' }}>Audio Registrato</h3>
              <audio
                controls
                style={{
                  width: '100%',
                  maxWidth: '500px',
                  marginBottom: '20px',
                }}
              >
                <source src={fileUrl} type={mimetype} />
                Il tuo browser non supporta l'audio player.
              </audio>
              <p style={{ marginTop: '20px', color: '#666', fontSize: '0.9rem' }}>
                Clicca play per ascoltare la registrazione
              </p>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className={styles.loader}>Caricamento...</div>
              )}
              <img
                src={fileUrl}
                alt={typeLabels[attachment.type]}
                onLoad={() => setIsLoading(false)}
                style={{ display: isLoading ? 'none' : 'block' }}
              />
            </>
          )}
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

        {attachment.type === 'reso' && (
          <div className={styles.resoDetails}>
            {(attachment as any).reason && (
              <p><strong>Motivo:</strong> {(attachment as any).reason}</p>
            )}
          </div>
        )}

        {attachment.type === 'scarico_parziale' && (
          <div className={styles.resoDetails}>
            {(attachment as any).justification && (
              <p><strong>Giustificazione:</strong> {(attachment as any).justification}</p>
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
