'use client';

import { useState } from 'react';
import { DeliveryDocument } from '../types';
import AttachmentViewer from './AttachmentViewer';
import styles from '../controllo-consegne.module.css';

interface DocumentCardProps {
  document: DeliveryDocument;
}

export default function DocumentCard({ document }: DocumentCardProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<any>(null);

  const hasSignature = !!document.attachments.signature;
  const hasPhoto = !!document.attachments.photo;
  const hasPayment = !!document.attachments.payment;
  const hasReso = !!document.attachments.reso;

  const formatTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className={styles.documentCard}>
        <div className={styles.cardHeader}>
          <div className={styles.orderInfo}>
            <h3>
              {document.sale_id ? (
                <a
                  href={`${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${document.sale_id}&model=sale.order&view_type=form`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#667eea',
                    textDecoration: 'none',
                    transition: 'color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.color = '#5568d3'}
                  onMouseOut={(e) => e.currentTarget.style.color = '#667eea'}
                >
                  {document.picking_name} 🔗
                </a>
              ) : (
                <span>{document.picking_name}</span>
              )}
            </h3>
            <span className={styles.time}>{formatTime(document.completion_time)}</span>
          </div>
          <div className={styles.badges}>
            {hasSignature && <span className={styles.badge} title="Firma">✍️</span>}
            {hasPhoto && <span className={styles.badge} title="Foto">📸</span>}
            {hasPayment && <span className={styles.badge} title="Pagamento">💰</span>}
            {hasReso && <span className={styles.badge} title="Reso">🔄</span>}
          </div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.infoRow}>
            <span className={styles.label}>Cliente:</span>
            <span className={styles.value}>{document.customer_name}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Autista:</span>
            <span className={styles.value}>{document.driver_name}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Veicolo:</span>
            <span className={styles.value}>{document.vehicle}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Indirizzo:</span>
            <span className={styles.value}>{document.delivery_address}</span>
          </div>
        </div>

        <div className={styles.attachmentsGrid}>
          {hasSignature && (
            <div className={styles.attachmentSection}>
              <button
                className={`${styles.attachmentBtn} ${styles.signatureBtn}`}
                onClick={() => setSelectedAttachment(document.attachments.signature)}
              >
                <span className={styles.icon}>✍️</span>
                <span>Firma</span>
              </button>
              {(document.attachments.signature as any)?.note && (
                <div className={styles.attachmentInfo} dangerouslySetInnerHTML={{ __html: (document.attachments.signature as any).note }} />
              )}
            </div>
          )}
          {hasPhoto && (
            <div className={styles.attachmentSection}>
              <button
                className={`${styles.attachmentBtn} ${styles.photoBtn}`}
                onClick={() => setSelectedAttachment(document.attachments.photo)}
              >
                <span className={styles.icon}>📸</span>
                <span>Foto</span>
              </button>
              {(document.attachments.photo as any)?.note && (
                <div className={styles.attachmentInfo} dangerouslySetInnerHTML={{ __html: (document.attachments.photo as any).note }} />
              )}
            </div>
          )}
          {hasPayment && (
            <div className={styles.attachmentSection}>
              <button
                className={`${styles.attachmentBtn} ${styles.paymentBtn}`}
                onClick={() => setSelectedAttachment(document.attachments.payment)}
              >
                <span className={styles.icon}>💰</span>
                <span>Pagamento</span>
              </button>
              {(document.attachments.payment as any)?.note && (
                <div className={styles.attachmentInfo} dangerouslySetInnerHTML={{ __html: (document.attachments.payment as any).note }} />
              )}
            </div>
          )}
          {hasReso && (
            <div className={styles.resoSection}>
              <button
                className={`${styles.attachmentBtn} ${styles.resoBtn}`}
                onClick={() => setSelectedAttachment(document.attachments.reso)}
              >
                <span className={styles.icon}>🔄</span>
                <span>Reso</span>
              </button>
              {(document.attachments.reso as any)?.note && (
                <div className={styles.resoInfo} dangerouslySetInnerHTML={{ __html: (document.attachments.reso as any).note }} />
              )}
            </div>
          )}
        </div>
      </div>

      {selectedAttachment && (
        <AttachmentViewer
          attachment={selectedAttachment}
          onClose={() => setSelectedAttachment(null)}
        />
      )}
    </>
  );
}
