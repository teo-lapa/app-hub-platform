'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Skill {
  name: string;
  command: string;
  description: string;
  category: string;
  icon: string;
  triggers: string[];
  args?: string;
  auto: boolean;
  autoSchedule?: string;
  location: string;
  multiAgent?: boolean;
}

const skills: Skill[] = [
  {
    name: 'Arrivi Merce',
    command: '/arrivi',
    description: 'Controlla e completa gli arrivi merce (picking incoming) in Odoo. Scarica il PDF fornitore, confronta riga per riga, compila lotti/scadenze/ubicazioni, valida il picking, crea fattura fornitore.',
    category: 'Magazzino',
    icon: '📦',
    triggers: ['arrivi', 'incoming', 'picking input', 'ricevi merce'],
    auto: false,
    location: '~/.claude/skills/arrivi/',
  },
  {
    name: 'Avvocato Aziendale',
    command: '/avvocato',
    description: 'Redige contratti di lavoro (autista, commerciale, ufficio, magazziniere), collaborazioni commerciali B2B, fornitura con fornitori esteri, mandati, agenzia, distribuzione. Basato su diritto svizzero CO.',
    category: 'Legale',
    icon: '⚖️',
    triggers: ['avvocato', 'contratto', 'contratto di lavoro', 'collaborazione commerciale'],
    auto: false,
    location: '~/.claude/skills/avvocato/',
  },
  {
    name: 'Cashflow',
    command: '/cashflow',
    description: 'Flusso di cassa LAPA. Fatture da incassare e da pagare, saldo netto previsto per settimana, proiezione liquidità a 30/60/90 giorni.',
    category: 'Finanza',
    icon: '💰',
    triggers: ['cashflow', 'flusso di cassa', 'liquidità', 'entrate uscite'],
    args: 'giorni proiezione (default: 90)',
    auto: false,
    location: '~/.claude/skills/cashflow/',
  },
  {
    name: 'Cataloga Prodotto',
    command: '/cataloga-prodotto',
    description: 'Cataloga prodotti da foto etichetta/cartone. Estrae info (nome, marca, EAN, peso), crea prodotto in Odoo, genera foto catalogo con Gemini.',
    category: 'Prodotti',
    icon: '📸',
    triggers: ['cataloga', 'cataloga prodotto', 'crea prodotto da foto'],
    args: 'path foto o "bot"',
    auto: false,
    location: '~/.claude/skills/cataloga-prodotto/',
  },
  {
    name: 'Competitor Radar',
    command: '/competitor',
    description: 'Analizza tutti i competitor (social, siti, novità) e genera report con cambiamenti. Multi-agente: website, Instagram, LinkedIn, news, offerte lavoro.',
    category: 'Business',
    icon: '🔍',
    triggers: ['competitor', 'analisi competitor', 'radar competitor'],
    args: 'nome specifico (default: tutti)',
    auto: false,
    location: '~/.claude/skills/competitor/',
    multiAgent: true,
  },
  {
    name: 'Consegne Autisti',
    command: '/consegne-autisti',
    description: 'Report consegne del giorno per autisti. Pick outgoing organizzati per giro, pagamenti allo scarico, urgenze e vincoli orario.',
    category: 'Logistica',
    icon: '🚛',
    triggers: ['consegne', 'consegne autisti', 'giri autisti'],
    args: 'data (default: oggi)',
    auto: false,
    location: '~/.claude/skills/consegne-autisti/',
  },
  {
    name: 'Contabile ItaEmpire',
    command: '/contabile-itaempire',
    description: 'Contabile AI per ItaEmpire S.r.l. Riconciliazione bancaria, analisi IVA, debiti/crediti, bilancio, pulizia contabile. SOLO company 6.',
    category: 'Finanza',
    icon: '🧾',
    triggers: ['contabile', 'contabilità itaempire', 'riconcilia banca'],
    auto: false,
    location: '~/.claude/skills/contabile-itaempire/',
  },
  {
    name: 'Controllo Infrastruttura',
    command: '/controllo',
    description: 'Controllo completo infrastruttura LAPA + attività agenti. Verifica TUTTI i PC, bot, agenti OpenClaw, Docker NAS, sync, sorveglianza, Odoo.',
    category: 'IT',
    icon: '🖥️',
    triggers: ['controllo', 'check', 'funziona tutto', 'stato rete'],
    auto: false,
    location: '~/.claude/skills/controllo/',
    multiAgent: true,
  },
  {
    name: 'Copia Listini',
    command: '/copia-listini',
    description: 'Copia listini prezzi da un prodotto all\'altro. Copia prezzi clienti (fixed) e listini generici ricalcolando markup.',
    category: 'Prodotti',
    icon: '📋',
    triggers: ['copia listini', 'sposta listini', 'copia prezzi'],
    args: 'prodotto A, prodotto B',
    auto: false,
    location: '~/.claude/skills/copia-listini/',
  },
  {
    name: 'Crea Listini',
    command: '/crea-listini',
    description: 'Crea listini generici (pubblico, 0-5m, 5-10m, 10-20m, 20m+) per un prodotto nuovo. Propone 3 opzioni prezzo con proporzioni mediane.',
    category: 'Prodotti',
    icon: '💲',
    triggers: ['crea listini', 'listini prodotto', 'crea prezzi base'],
    args: 'nome prodotto',
    auto: false,
    location: '~/.claude/skills/crea-listini/',
  },
  {
    name: 'Dashboard Aziendale',
    command: '/dashboard',
    description: 'Report completo andamento azienda LAPA. Fatturato, margini, confronto periodi, clienti in calo, crediti scaduti, performance venditori.',
    category: 'Business',
    icon: '📊',
    triggers: ['dashboard', 'come stiamo andando', 'andamento', 'situazione'],
    args: 'mese (default: corrente)',
    auto: false,
    location: '~/.claude/skills/dashboard/',
    multiAgent: true,
  },
  {
    name: 'Dottore Sistemi',
    command: '/dottore',
    description: 'Audit completo agenti AI, comportamento, comunicazione, stato tecnico, proposte miglioramento. Può auditare Odoo, SEO, ordini, rete.',
    category: 'IT',
    icon: '🩺',
    triggers: ['dottore', 'audit agente', 'controlla agente'],
    auto: false,
    location: '~/.claude/skills/dottore/',
  },
  {
    name: 'Email Manager',
    command: '/email',
    description: 'Legge TUTTE le email in arrivo su Odoo, classifica per urgenza, genera report interattivo. Gestione con comandi: dettagli, rispondi, ok, ignora.',
    category: 'Comunicazioni',
    icon: '📧',
    triggers: ['email', 'leggi email', 'mail', 'posta', 'controlla email'],
    args: 'urgenti|oggi|laura|paul|fornitore NOME',
    auto: false,
    location: '~/.claude/skills/email/',
  },
  {
    name: 'Forecast Fatturato',
    command: '/forecast',
    description: 'Previsione fatturato LAPA. Trend 6 mesi, proiezione 3, stagionalità, pipeline bozze, scenario best/worst/realistic.',
    category: 'Finanza',
    icon: '📈',
    triggers: ['forecast', 'previsione', 'proiezione fatturato', 'quanto faremo'],
    args: 'mesi proiezione (default: 3)',
    auto: false,
    location: '~/.claude/skills/forecast/',
    multiAgent: true,
  },
  {
    name: 'Fornitori & Acquisti',
    command: '/fornitori',
    description: 'Analisi fornitori e acquisti. Top fornitori per spesa, confronto prezzi, trend costi, fatture in scadenza, concentrazione rischio.',
    category: 'Acquisti',
    icon: '🏭',
    triggers: ['fornitori', 'acquisti', 'costi fornitori', 'quanto spendiamo'],
    args: 'fornitore specifico (opzionale)',
    auto: false,
    location: '~/.claude/skills/fornitori/',
  },
  {
    name: 'Mancanti Consegne',
    command: '/mancanti',
    description: 'Report prodotti mancanti dai pick del giorno. Analizza pick completati, trova backorder cancellati con prodotti non consegnati.',
    category: 'Logistica',
    icon: '❌',
    triggers: ['mancanti', 'prodotti mancanti', 'cosa manca'],
    args: 'data (default: oggi)',
    auto: false,
    location: '~/.claude/skills/mancanti/',
  },
  {
    name: 'Margini Deep-Dive',
    command: '/margini',
    description: 'Analisi margini per cliente, prodotto, venditore. Trend ultimi 6 mesi. Alert su clienti/prodotti sotto soglia.',
    category: 'Finanza',
    icon: '💹',
    triggers: ['margini', 'analisi margini', 'profittabilità', 'chi rende'],
    args: 'focus: clienti, prodotti, venditori',
    auto: false,
    location: '~/.claude/skills/margini/',
    multiAgent: true,
  },
  {
    name: 'Modifica Prodotto',
    command: '/modifica-prodotto',
    description: 'Modifica prodotti in Odoo. Cerca per nome/barcode/ID, mostra dati attuali, applica modifiche (nome, prezzo, peso, categoria, IVA, UdM, etc).',
    category: 'Prodotti',
    icon: '✏️',
    triggers: ['modifica prodotto', 'cambia prodotto', 'aggiorna prodotto'],
    args: 'cosa modificare. Es: MOZZARELLA peso 0.5',
    auto: false,
    location: '~/.claude/skills/modifica-prodotto/',
  },
  {
    name: 'Perseo SEO/GEO',
    command: '/perseo',
    description: 'Audit SEO, GEO e Bot Optimization. Analizza homepage, schema markup, robots.txt, sitemap, hreflang, Core Web Vitals, AI crawlers.',
    category: 'IT',
    icon: '🌐',
    triggers: ['perseo', 'seo', 'geo', 'audit seo', 'controlla sito'],
    args: 'URL o pagina. Es: lapa.ch',
    auto: false,
    location: '~/.claude/skills/perseo/',
  },
  {
    name: 'P&L Conto Economico',
    command: '/pl',
    description: 'Conto Economico LAPA. Ricavi, costi acquisto, margine lordo, confronto periodi. Quanto rimane in tasca? Dove vanno i soldi?',
    category: 'Finanza',
    icon: '🏦',
    triggers: ['pl', 'p&l', 'conto economico', 'profitti e perdite'],
    args: 'periodo (default: mese corrente)',
    auto: false,
    location: '~/.claude/skills/pl/',
  },
  {
    name: 'Prepara Arrivi',
    command: '/prepara-arrivi',
    description: 'Prepara arrivi del giorno dopo. Controlla documenti fornitore (fattura/DDT), cerca nelle email, manda email se manca.',
    category: 'Magazzino',
    icon: '📬',
    triggers: ['prepara arrivi', 'prepara domani', 'documenti arrivi'],
    args: 'fornitore o data (default: domani)',
    auto: false,
    location: '~/.claude/skills/prepara-arrivi/',
  },
  {
    name: 'Prodotto Perfetto',
    command: '/prodotto-perfetto',
    description: 'Ottimizza prodotto 100% SEO/GEO. Descrizione vendita 4 lingue (IT/DE/FR/EN), specifiche, meta tags, prodotti correlati.',
    category: 'Prodotti',
    icon: '🏆',
    triggers: ['prodotto perfetto', 'ottimizza prodotto', 'scheda perfetta'],
    args: 'nome o ID prodotto',
    auto: false,
    location: '~/.claude/skills/prodotto-perfetto/',
    multiAgent: true,
  },
  {
    name: 'Recruiting Autisti',
    command: '/recruiting',
    description: 'Gestione recruiting autista via WhatsApp Odoo. Screening candidati, controlla risposte, dialoga, aggiorna stato in hr.applicant.',
    category: 'HR',
    icon: '👤',
    triggers: ['recruiting', 'candidati', 'autista screening'],
    args: 'azione: send | check | status',
    auto: false,
    location: '~/.claude/skills/recruiting/',
  },
  {
    name: 'Resi Clienti',
    command: '/resi',
    description: 'Gestione resi. Trova resi non processati, legge foto, identifica prodotti, cerca picking originale, crea WH/RET, valida.',
    category: 'Magazzino',
    icon: '🔄',
    triggers: ['resi', 'fai i resi', 'gestisci resi', 'reso'],
    args: 'data (default: ieri)',
    auto: false,
    location: '~/.claude/skills/resi/',
  },
  {
    name: 'Scadenze Prodotti',
    command: '/scadenze',
    description: 'Controllo scadenze nel frigo. Prodotti scaduti, in scadenza 7/30/60/90 giorni, con ubicazione e lotto. Supporta filtri per zona.',
    category: 'Magazzino',
    icon: '⏰',
    triggers: ['scadenze', 'controllo scadenze', 'cosa scade', 'prodotti scaduti'],
    args: 'zona: frigo, pingu, tutto (default: frigo)',
    auto: false,
    location: '~/.claude/skills/scadenze/',
  },
  {
    name: 'Sistema Prodotto',
    command: '/sistema-prodotto',
    description: 'Sistema/aggiusta prodotti da foto. Legge foto, cerca in Odoo, confronta dati, corregge tutto, rigenera foto catalogo Gemini.',
    category: 'Prodotti',
    icon: '🔧',
    triggers: ['sistema', 'sistema prodotto', 'aggiusta prodotto', 'fix prodotto'],
    args: 'path foto o "bot"',
    auto: false,
    location: '~/.claude/skills/sistema-prodotto/',
  },
  {
    name: 'Solleciti Crediti',
    command: '/solleciti',
    description: 'Gestione crediti e solleciti. Lista clienti con scaduto, testo sollecito personalizzato, suggerisce azione (telefono/email/legale).',
    category: 'Finanza',
    icon: '⚠️',
    triggers: ['solleciti', 'crediti scaduti', 'chi ci deve soldi', 'recupero crediti'],
    args: 'cliente specifico (opzionale)',
    auto: false,
    location: '~/.claude/skills/solleciti/',
  },
  {
    name: 'Stock Guardian',
    command: '/stock-guardian',
    description: 'Analisi scorte multi-agente. Analizza scorte Odoo, crea/aggiorna bozze PO per fornitore con 10 agenti paralleli, report Telegram.',
    category: 'Magazzino',
    icon: '🛡️',
    triggers: ['stock guardian', 'scorte', 'ordini automatici', 'controlla scorte'],
    auto: false,
    location: '~/.claude/skills/stock-guardian/',
    multiAgent: true,
  },
  {
    name: 'Video Prodotti',
    command: '/video-prodotti',
    description: 'Genera video prodotto con Google Flow (Veo 3.1), pubblica su YouTube e collega al prodotto in Odoo. SEO/GEO ottimizzato.',
    category: 'Prodotti',
    icon: '🎬',
    triggers: ['video prodotti', 'genera video', 'crea video prodotto'],
    auto: false,
    location: '~/.claude/skills/video-prodotti/',
  },
  {
    name: 'Weekly Report',
    command: '/weekly',
    description: 'Mini-report settimanale rapido. Fatturato settimana, confronto anno scorso, margine, top clienti, azioni prioritarie.',
    category: 'Business',
    icon: '📅',
    triggers: ['weekly', 'report settimanale', 'come va la settimana', 'recap settimana'],
    args: 'settimana specifica (default: corrente)',
    auto: false,
    location: '~/.claude/skills/weekly/',
  },
];

const categories = ['Tutte', ...Array.from(new Set(skills.map(s => s.category))).sort()];

export default function SkillsDashboard() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tutte');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  const filtered = skills.filter(s => {
    const matchesCategory = selectedCategory === 'Tutte' || s.category === selectedCategory;
    const matchesSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.command.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.triggers.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const statsByCategory = categories.filter(c => c !== 'Tutte').map(cat => ({
    category: cat,
    count: skills.filter(s => s.category === cat).length,
  }));

  return (
    <div className="min-h-screen-dynamic bg-slate-50 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-white shadow-md rounded-xl mb-4 sm:mb-6 p-3 sm:p-4 md:p-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-xs sm:text-sm md:text-base shrink-0"
              >
                <span>🏠</span>
                <span className="hidden xs:inline">Home</span>
              </button>
              <div className="text-sm sm:text-lg md:text-2xl font-bold text-blue-600 truncate">
                🎯 <span className="hidden sm:inline">Skills Dashboard</span>
                <span className="sm:hidden">Skills</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-full text-xs md:text-sm font-semibold bg-blue-100 text-blue-700 border-2 border-blue-400 shrink-0">
              <span>{skills.length}</span>
              <span className="hidden md:inline">skills totali</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        {/* Stats per categoria */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {statsByCategory.map(({ category, count }) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(selectedCategory === category ? 'Tutte' : category)}
              className={`p-2 sm:p-3 rounded-xl text-center transition-all ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white hover:bg-blue-50 text-slate-700 shadow-sm'
              }`}
            >
              <div className="text-lg sm:text-2xl font-bold">{count}</div>
              <div className="text-[10px] sm:text-xs truncate">{category}</div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4 sm:mb-6">
          <input
            type="text"
            placeholder="Cerca skill per nome, comando, descrizione..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none text-sm sm:text-base bg-white shadow-sm"
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat} {cat !== 'Tutte' && `(${skills.filter(s => s.category === cat).length})`}
            </button>
          ))}
        </div>

        {/* Results count */}
        <div className="text-xs sm:text-sm text-slate-500 mb-3">
          {filtered.length} skill{filtered.length !== 1 ? 's' : ''} trovate
        </div>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((skill) => (
            <div
              key={skill.command}
              onClick={() => setSelectedSkill(selectedSkill?.command === skill.command ? null : skill)}
              className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border-2 ${
                selectedSkill?.command === skill.command ? 'border-blue-500 shadow-md' : 'border-transparent'
              }`}
            >
              <div className="p-3 sm:p-4">
                {/* Card header */}
                <div className="flex items-start gap-3 mb-2">
                  <div className="text-2xl sm:text-3xl">{skill.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm sm:text-base text-slate-800 truncate">{skill.name}</div>
                    <div className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block mt-0.5">
                      {skill.command}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      skill.category === 'Finanza' ? 'bg-green-100 text-green-700' :
                      skill.category === 'Magazzino' ? 'bg-amber-100 text-amber-700' :
                      skill.category === 'Prodotti' ? 'bg-purple-100 text-purple-700' :
                      skill.category === 'Business' ? 'bg-blue-100 text-blue-700' :
                      skill.category === 'Logistica' ? 'bg-orange-100 text-orange-700' :
                      skill.category === 'IT' ? 'bg-slate-100 text-slate-700' :
                      skill.category === 'Comunicazioni' ? 'bg-cyan-100 text-cyan-700' :
                      skill.category === 'HR' ? 'bg-pink-100 text-pink-700' :
                      skill.category === 'Acquisti' ? 'bg-teal-100 text-teal-700' :
                      skill.category === 'Legale' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {skill.category}
                    </span>
                    {skill.multiAgent && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                        Multi-Agent
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mb-2">{skill.description}</p>

                {/* Badges */}
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500">
                  <span className={`px-2 py-0.5 rounded-full ${
                    skill.auto ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {skill.auto ? '⚡ Automatica' : '👆 Manuale'}
                  </span>
                  {skill.args && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[150px]">
                      📝 {skill.args}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {selectedSkill?.command === skill.command && (
                <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50 rounded-b-xl">
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div>
                      <span className="font-semibold text-slate-700">Comando:</span>{' '}
                      <code className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">{skill.command}</code>
                    </div>
                    {skill.args && (
                      <div>
                        <span className="font-semibold text-slate-700">Argomenti:</span>{' '}
                        <span className="text-slate-600">{skill.args}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-slate-700">Esecuzione:</span>{' '}
                      <span className="text-slate-600">{skill.auto ? `Automatica — ${skill.autoSchedule}` : 'Solo manuale'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Posizione:</span>{' '}
                      <code className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">{skill.location}</code>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Trigger keywords:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {skill.triggers.map(t => (
                          <span key={t} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[10px] sm:text-xs">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    {skill.multiAgent && (
                      <div>
                        <span className="font-semibold text-violet-700">🤖 Architettura multi-agente</span>
                      </div>
                    )}
                    <div className="pt-2">
                      <p className="text-slate-600">{skill.description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm sm:text-base">Nessuna skill trovata</div>
          </div>
        )}
      </div>
    </div>
  );
}
