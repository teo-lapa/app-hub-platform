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
            <h3>{document.picking_name}</h3>
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
            <button
              className={`${styles.attachmentBtn} ${styles.signatureBtn}`}
              onClick={() => setSelectedAttachment(document.attachments.signature)}
            >
              <span className={styles.icon}>✍️</span>
              <span>Firma</span>
            </button>
          )}
          {hasPhoto && (
            <button
              className={`${styles.attachmentBtn} ${styles.photoBtn}`}
              onClick={() => setSelectedAttachment(document.attachments.photo)}
            >
              <span className={styles.icon}>📸</span>
              <span>Foto</span>
            </button>
          )}
          {hasPayment && (
            <button
              className={`${styles.attachmentBtn} ${styles.paymentBtn}`}
              onClick={() => setSelectedAttachment(document.attachments.payment)}
            >
              <span className={styles.icon}>💰</span>
              <span>Pagamento</span>
            </button>
          )}
          {hasReso && (
            <button
              className={`${styles.attachmentBtn} ${styles.resoBtn}`}
              onClick={() => setSelectedAttachment(document.attachments.reso)}
            >
              <span className={styles.icon}>🔄</span>
              <span>Reso</span>
            </button>
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
