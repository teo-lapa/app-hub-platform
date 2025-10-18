'use client';

import { useState, useEffect } from 'react';
import { DeliveryDocument, AttachmentType } from './types';
import DocumentCard from './components/DocumentCard';
import styles from './controllo-consegne.module.css';

export default function ControlloConsegnePage() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [activeFilter, setActiveFilter] = useState<AttachmentType | 'all'>('all');
  const [documents, setDocuments] = useState<DeliveryDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents when date or filter changes
  useEffect(() => {
    fetchDocuments();
  }, [selectedDate, activeFilter]);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/controllo-consegne/list?date=${selectedDate}&type=${activeFilter}`
      );

      if (!response.ok) {
        throw new Error('Errore nel caricamento dei documenti');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err: any) {
      setError(err.message || 'Errore di connessione');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // Group documents by driver
  const groupedByDriver = documents.reduce((acc, doc) => {
    const driver = doc.driver_name;
    if (!acc[driver]) {
      acc[driver] = [];
    }
    acc[driver].push(doc);
    return acc;
  }, {} as Record<string, DeliveryDocument[]>);

  const filterButtons = [
    { type: 'all' as const, label: 'Tutti', icon: '📋' },
    { type: 'signature' as const, label: 'Firma', icon: '✍️' },
    { type: 'photo' as const, label: 'Foto', icon: '📸' },
    { type: 'payment' as const, label: 'Pagamento', icon: '💰' },
    { type: 'reso' as const, label: 'Reso', icon: '🔄' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <a href="/" className={styles.homeBtn}>
            ← Home
          </a>
          <div className={styles.headerTitle}>
            <h1>Controllo Consegne</h1>
            <p>Visualizza documenti di consegna completati</p>
          </div>
        </div>
      </header>

      <div className={styles.filters}>
        <div className={styles.dateFilter}>
          <label htmlFor="date-picker">📅 Data:</label>
          <input
            id="date-picker"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className={styles.dateInput}
          />
        </div>

        <div className={styles.typeFilters}>
          {filterButtons.map((btn) => (
            <button
              key={btn.type}
              className={`${styles.filterBtn} ${
                activeFilter === btn.type ? styles.active : ''
              }`}
              onClick={() => setActiveFilter(btn.type)}
            >
              <span className={styles.filterIcon}>{btn.icon}</span>
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {loading && (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Caricamento documenti...</p>
          </div>
        )}

        {error && (
          <div className={styles.errorState}>
            <p>❌ {error}</p>
            <button onClick={fetchDocuments} className={styles.retryBtn}>
              Riprova
            </button>
          </div>
        )}

        {!loading && !error && documents.length === 0 && (
          <div className={styles.emptyState}>
            <p>📭 Nessun documento trovato per questa data e filtro</p>
          </div>
        )}

        {!loading && !error && documents.length > 0 && (
          <div className={styles.documentsContainer}>
            <div className={styles.statsBar}>
              <span>
                📊 <strong>{documents.length}</strong> documenti trovati
              </span>
              <span>
                🚚 <strong>{Object.keys(groupedByDriver).length}</strong> autisti
              </span>
            </div>

            {Object.entries(groupedByDriver).map(([driver, docs]) => (
              <div key={driver} className={styles.driverSection}>
                <div className={styles.driverHeader}>
                  <h2>👤 {driver}</h2>
                  <span className={styles.count}>{docs.length} consegne</span>
                </div>
                <div className={styles.documentsList}>
                  {docs.map((doc) => (
                    <DocumentCard key={doc.id} document={doc} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
