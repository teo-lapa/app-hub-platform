/**
 * LAPA WINE — i18n strings condivise tra le pagine cliente al tavolo
 *   /chat   /wines   /confirm   (e splash via /page.tsx)
 *
 * La lingua è persistita in sessionStorage `lapa-wine-lang-{slug}-{tavolo}`.
 * Il pulsante (in tutte le pagine) cicla IT → DE → EN → FR → IT.
 */

export type Lang = 'it' | 'de' | 'en' | 'fr';
export const LANG_CYCLE: Lang[] = ['it', 'de', 'en', 'fr'];
export const SR_LOCALE: Record<Lang, string> = { it: 'it-IT', de: 'de-DE', en: 'en-US', fr: 'fr-FR' };
export const LANG_KEY_BASE = 'lapa-wine-lang';

export interface ChatStrings {
  sommelier: string;
  tableLabel: (n: string) => string;
  cartaVini: string;
  greet: (name: string) => string;
  thinking: string;
  online: string;
  placeholderWrite: string;
  placeholderListening: string;
  errorOffline: (e: string) => string;
  photoReady: string;
  photoRemove: string;
  photoFallbackUserText: string;
  speechNotSupported: string;
  back: string;
  audioRecord: string;
  audioStop: string;
  cameraTake: string;
  send: string;
  quickReplies: string[];
  // Wines list
  winesTitle: string;
  loadingCarta: string;
  noWinesInCategory: string;
  filterAll: string;
  filterBollicine: string;
  filterBianchi: string;
  filterRossi: string;
  filterDolci: string;
  filterGrappe: string;
  groupBollicine: string;
  groupBianchi: string;
  groupRosati: string;
  groupRossi: string;
  groupDolci: string;
  groupPassiti: string;
  groupGrappe: string;
  groupDistillati: string;
  groupAltro: string;
  // Story sheet
  storyHeader: string;
  notesHeader: string;
  pairingsHeader: string;
  serviceHeader: string;
  serviceTemp: (c: number) => string;
  serviceDecant: (m: number) => string;
  // Buttons
  loPrendo: string;
  chiudi: string;
  glassUnit: string; // "al bicchiere"
  bottleUnit: string; // "bottiglia"
  glassPriceCad: (p: number) => string; // "CHF 17 cad."
  bottlePriceCad: (p: number) => string;
  // Confirm page
  selectionPrompt: string;
  glassRowLabel: string;
  bottleRowLabel: string;
  totalLabel: string;
  sendToWaiterEmpty: string;
  sendToWaiterCount: (n: number) => string; // "Manda al cameriere · 3 pz"
  orderSent: string;
  phase1: string;
  phase1Label: string;
  phase2: string;
  phase2Label: string;
  addAnother: string;
  goodMeal: string;
  qtyAdd: (label: string) => string;
  qtyRemove: (label: string) => string;
}

export const I18N: Record<Lang, ChatStrings> = {
  it: {
    sommelier: 'Sommelier',
    tableLabel: (n) => `Tavolo ${n}`,
    cartaVini: 'Carta vini',
    greet: (name) => `Buonasera, sono il sommelier di ${name}. Cosa stai mangiando stasera? Te lo abbino al vino giusto.`,
    thinking: 'Sto pensando…',
    online: 'In linea',
    placeholderWrite: 'Scrivi o detta al sommelier',
    placeholderListening: 'Ti ascolto…',
    errorOffline: (e) => `Mi spiace, sono momentaneamente offline (${e}). Riprova tra un secondo.`,
    photoReady: 'foto del piatto pronta',
    photoRemove: 'Rimuovi foto',
    photoFallbackUserText: 'Ecco la foto del piatto al tavolo. Cosa mi consigli?',
    speechNotSupported: 'Il dettato vocale non è supportato su questo browser. Usa Chrome o Safari.',
    back: 'Indietro',
    audioRecord: 'Detta vocale',
    audioStop: 'Ferma registrazione',
    cameraTake: 'Foto del piatto',
    send: 'Invia',
    quickReplies: ['🥩 Carne', '🐟 Pesce', '🍝 Pasta o risotto', '🍕 Pizza', '🥗 Vegetariano', '🧀 Salumi e formaggi', '🍰 Dessert', '🍷 Solo un calice', '🥃 Una grappa per chiudere'],
    winesTitle: 'Carta vini',
    loadingCarta: 'Carico la carta…',
    noWinesInCategory: 'Nessun vino in questa categoria.',
    filterAll: 'Tutti',
    filterBollicine: 'Bollicine',
    filterBianchi: 'Bianchi',
    filterRossi: 'Rossi',
    filterDolci: 'Dolci',
    filterGrappe: 'Grappe',
    groupBollicine: 'Bollicine',
    groupBianchi: 'Bianchi',
    groupRosati: 'Rosati',
    groupRossi: 'Rossi',
    groupDolci: 'Dolci',
    groupPassiti: 'Passiti',
    groupGrappe: 'Grappe',
    groupDistillati: 'Distillati',
    groupAltro: 'Altro',
    storyHeader: 'Storia',
    notesHeader: 'Note',
    pairingsHeader: 'Si abbina con',
    serviceHeader: 'Servizio',
    serviceTemp: (c) => `Temperatura ${c}°C`,
    serviceDecant: (m) => ` · decantazione ${m} min`,
    loPrendo: 'Lo prendo',
    chiudi: 'Chiudi',
    glassUnit: 'al bicchiere',
    bottleUnit: 'bottiglia',
    glassPriceCad: (p) => `CHF ${p} cad.`,
    bottlePriceCad: (p) => `CHF ${p} cad.`,
    selectionPrompt: 'Quanti calici e quante bottiglie volete al tavolo?',
    glassRowLabel: 'Al bicchiere',
    bottleRowLabel: 'Bottiglia',
    totalLabel: 'Totale',
    sendToWaiterEmpty: 'Aggiungi almeno un calice',
    sendToWaiterCount: (n) => `Manda al cameriere · ${n} pz`,
    orderSent: 'Comanda inviata',
    phase1: 'fase 1',
    phase1Label: 'Aperto',
    phase2: 'fase 2',
    phase2Label: 'In arrivo',
    addAnother: '+ Aggiungi altri calici o vini',
    goodMeal: 'Buona cena.',
    qtyAdd: (l) => `Aggiungi un ${l.toLowerCase()}`,
    qtyRemove: (l) => `Rimuovi un ${l.toLowerCase()}`,
  },
  de: {
    sommelier: 'Sommelier',
    tableLabel: (n) => `Tisch ${n}`,
    cartaVini: 'Weinkarte',
    greet: (name) => `Guten Abend, ich bin der Sommelier von ${name}. Was essen Sie heute Abend? Ich finde Ihnen den passenden Wein.`,
    thinking: 'Ich überlege…',
    online: 'Online',
    placeholderWrite: 'Schreiben oder diktieren',
    placeholderListening: 'Ich höre zu…',
    errorOffline: (e) => `Entschuldigung, ich bin gerade offline (${e}). Versuchen Sie es gleich nochmal.`,
    photoReady: 'Foto bereit',
    photoRemove: 'Foto entfernen',
    photoFallbackUserText: 'Hier ist das Foto des Gerichts. Was empfehlen Sie?',
    speechNotSupported: 'Spracheingabe wird in diesem Browser nicht unterstützt. Verwenden Sie Chrome oder Safari.',
    back: 'Zurück',
    audioRecord: 'Sprachaufnahme',
    audioStop: 'Aufnahme beenden',
    cameraTake: 'Foto des Gerichts',
    send: 'Senden',
    quickReplies: ['🥩 Fleisch', '🐟 Fisch', '🍝 Pasta oder Risotto', '🍕 Pizza', '🥗 Vegetarisch', '🧀 Wurst und Käse', '🍰 Dessert', '🍷 Nur ein Glas', '🥃 Ein Grappa zum Abschluss'],
    winesTitle: 'Weinkarte',
    loadingCarta: 'Karte wird geladen…',
    noWinesInCategory: 'Keine Weine in dieser Kategorie.',
    filterAll: 'Alle',
    filterBollicine: 'Schaumweine',
    filterBianchi: 'Weisse',
    filterRossi: 'Rote',
    filterDolci: 'Süsse',
    filterGrappe: 'Grappa',
    groupBollicine: 'Schaumweine',
    groupBianchi: 'Weisse',
    groupRosati: 'Rosé',
    groupRossi: 'Rote',
    groupDolci: 'Süsse',
    groupPassiti: 'Passito',
    groupGrappe: 'Grappa',
    groupDistillati: 'Destillate',
    groupAltro: 'Andere',
    storyHeader: 'Geschichte',
    notesHeader: 'Noten',
    pairingsHeader: 'Passt zu',
    serviceHeader: 'Service',
    serviceTemp: (c) => `Temperatur ${c}°C`,
    serviceDecant: (m) => ` · Dekantieren ${m} Min.`,
    loPrendo: 'Ich nehme es',
    chiudi: 'Schliessen',
    glassUnit: 'Im Glas',
    bottleUnit: 'Flasche',
    glassPriceCad: (p) => `CHF ${p} pro Stück`,
    bottlePriceCad: (p) => `CHF ${p} pro Stück`,
    selectionPrompt: 'Wie viele Gläser und Flaschen für den Tisch?',
    glassRowLabel: 'Im Glas',
    bottleRowLabel: 'Flasche',
    totalLabel: 'Total',
    sendToWaiterEmpty: 'Mindestens ein Glas wählen',
    sendToWaiterCount: (n) => `An den Kellner · ${n} Stück`,
    orderSent: 'Bestellung gesendet',
    phase1: 'Phase 1',
    phase1Label: 'Geöffnet',
    phase2: 'Phase 2',
    phase2Label: 'Unterwegs',
    addAnother: '+ Weitere Gläser oder Weine',
    goodMeal: 'Guten Appetit.',
    qtyAdd: (l) => `Ein ${l} hinzufügen`,
    qtyRemove: (l) => `Ein ${l} entfernen`,
  },
  en: {
    sommelier: 'Sommelier',
    tableLabel: (n) => `Table ${n}`,
    cartaVini: 'Wine list',
    greet: (name) => `Good evening, I'm ${name}'s sommelier. What are you eating tonight? I'll match it with the right wine.`,
    thinking: 'Thinking…',
    online: 'Online',
    placeholderWrite: 'Type or dictate to the sommelier',
    placeholderListening: 'Listening…',
    errorOffline: (e) => `Sorry, I'm momentarily offline (${e}). Try again in a second.`,
    photoReady: 'photo ready',
    photoRemove: 'Remove photo',
    photoFallbackUserText: "Here's the photo of the dish at the table. What do you suggest?",
    speechNotSupported: 'Voice dictation is not supported on this browser. Use Chrome or Safari.',
    back: 'Back',
    audioRecord: 'Voice dictation',
    audioStop: 'Stop recording',
    cameraTake: 'Photo of the dish',
    send: 'Send',
    quickReplies: ['🥩 Meat', '🐟 Fish', '🍝 Pasta or risotto', '🍕 Pizza', '🥗 Vegetarian', '🧀 Cured meats & cheese', '🍰 Dessert', '🍷 Just a glass', '🥃 A grappa to close'],
    winesTitle: 'Wine list',
    loadingCarta: 'Loading the list…',
    noWinesInCategory: 'No wines in this category.',
    filterAll: 'All',
    filterBollicine: 'Sparkling',
    filterBianchi: 'Whites',
    filterRossi: 'Reds',
    filterDolci: 'Sweet',
    filterGrappe: 'Grappa',
    groupBollicine: 'Sparkling',
    groupBianchi: 'Whites',
    groupRosati: 'Rosé',
    groupRossi: 'Reds',
    groupDolci: 'Sweet',
    groupPassiti: 'Passito',
    groupGrappe: 'Grappa',
    groupDistillati: 'Spirits',
    groupAltro: 'Other',
    storyHeader: 'Story',
    notesHeader: 'Notes',
    pairingsHeader: 'Pairs with',
    serviceHeader: 'Service',
    serviceTemp: (c) => `Temperature ${c}°C`,
    serviceDecant: (m) => ` · decant ${m} min`,
    loPrendo: "I'll have it",
    chiudi: 'Close',
    glassUnit: 'by the glass',
    bottleUnit: 'bottle',
    glassPriceCad: (p) => `CHF ${p} each`,
    bottlePriceCad: (p) => `CHF ${p} each`,
    selectionPrompt: 'How many glasses and bottles for the table?',
    glassRowLabel: 'By the glass',
    bottleRowLabel: 'Bottle',
    totalLabel: 'Total',
    sendToWaiterEmpty: 'Add at least one glass',
    sendToWaiterCount: (n) => `Send to waiter · ${n} pcs`,
    orderSent: 'Order sent',
    phase1: 'phase 1',
    phase1Label: 'Opened',
    phase2: 'phase 2',
    phase2Label: 'On its way',
    addAnother: '+ Add more glasses or wines',
    goodMeal: 'Enjoy your meal.',
    qtyAdd: (l) => `Add a ${l.toLowerCase()}`,
    qtyRemove: (l) => `Remove a ${l.toLowerCase()}`,
  },
  fr: {
    sommelier: 'Sommelier',
    tableLabel: (n) => `Table ${n}`,
    cartaVini: 'Carte des vins',
    greet: (name) => `Bonsoir, je suis le sommelier de ${name}. Que mangez-vous ce soir ? Je vous trouve le vin qu'il faut.`,
    thinking: 'Je réfléchis…',
    online: 'En ligne',
    placeholderWrite: 'Écrivez ou dictez au sommelier',
    placeholderListening: 'Je vous écoute…',
    errorOffline: (e) => `Désolé, je suis momentanément hors ligne (${e}). Réessayez dans un instant.`,
    photoReady: 'photo prête',
    photoRemove: 'Retirer la photo',
    photoFallbackUserText: 'Voici la photo du plat à table. Que conseillez-vous ?',
    speechNotSupported: "La dictée vocale n'est pas supportée sur ce navigateur. Utilisez Chrome ou Safari.",
    back: 'Retour',
    audioRecord: 'Dictée vocale',
    audioStop: "Arrêter l'enregistrement",
    cameraTake: 'Photo du plat',
    send: 'Envoyer',
    quickReplies: ['🥩 Viande', '🐟 Poisson', '🍝 Pâtes ou risotto', '🍕 Pizza', '🥗 Végétarien', '🧀 Charcuterie et fromages', '🍰 Dessert', '🍷 Juste un verre', '🥃 Une grappa pour finir'],
    winesTitle: 'Carte des vins',
    loadingCarta: 'Chargement de la carte…',
    noWinesInCategory: 'Aucun vin dans cette catégorie.',
    filterAll: 'Tous',
    filterBollicine: 'Effervescents',
    filterBianchi: 'Blancs',
    filterRossi: 'Rouges',
    filterDolci: 'Doux',
    filterGrappe: 'Grappa',
    groupBollicine: 'Effervescents',
    groupBianchi: 'Blancs',
    groupRosati: 'Rosés',
    groupRossi: 'Rouges',
    groupDolci: 'Doux',
    groupPassiti: 'Passito',
    groupGrappe: 'Grappa',
    groupDistillati: 'Eaux-de-vie',
    groupAltro: 'Autres',
    storyHeader: 'Histoire',
    notesHeader: 'Notes',
    pairingsHeader: 'Se marie avec',
    serviceHeader: 'Service',
    serviceTemp: (c) => `Température ${c}°C`,
    serviceDecant: (m) => ` · décanter ${m} min`,
    loPrendo: 'Je le prends',
    chiudi: 'Fermer',
    glassUnit: 'au verre',
    bottleUnit: 'bouteille',
    glassPriceCad: (p) => `CHF ${p} pièce`,
    bottlePriceCad: (p) => `CHF ${p} pièce`,
    selectionPrompt: 'Combien de verres et de bouteilles pour la table ?',
    glassRowLabel: 'Au verre',
    bottleRowLabel: 'Bouteille',
    totalLabel: 'Total',
    sendToWaiterEmpty: 'Ajoutez au moins un verre',
    sendToWaiterCount: (n) => `Envoyer au serveur · ${n} pcs`,
    orderSent: 'Commande envoyée',
    phase1: 'phase 1',
    phase1Label: 'Ouverte',
    phase2: 'phase 2',
    phase2Label: 'En route',
    addAnother: '+ Ajouter verres ou vins',
    goodMeal: 'Bon repas.',
    qtyAdd: (l) => `Ajouter un ${l.toLowerCase()}`,
    qtyRemove: (l) => `Retirer un ${l.toLowerCase()}`,
  },
};

export function readSavedLang(slug: string, tavolo: string): Lang {
  if (typeof window === 'undefined') return 'it';
  try {
    const v = sessionStorage.getItem(`${LANG_KEY_BASE}-${slug}-${tavolo}`);
    if (v && (LANG_CYCLE as string[]).includes(v)) return v as Lang;
  } catch {}
  return 'it';
}

export function writeSavedLang(slug: string, tavolo: string, lang: Lang): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${LANG_KEY_BASE}-${slug}-${tavolo}`, lang);
  } catch {}
}

export function nextLang(curr: Lang): Lang {
  const i = LANG_CYCLE.indexOf(curr);
  return LANG_CYCLE[(i + 1) % LANG_CYCLE.length];
}
