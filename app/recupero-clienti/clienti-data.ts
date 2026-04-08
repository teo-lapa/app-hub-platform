// Dati clienti ex-Alessandro — generati da Odoo 2026-04-08
// Fatturato 2026 = gen-apr 2026, Fatturato 2025 = anno intero

export interface ClienteRecupero {
  id: number;
  name: string;
  street: string;
  city: string;
  zip: string;
  phone: string;
  lat: number;
  lng: number;
  fatturato2026: number;
  fatturato2025: number;
  ultimoOrdine: string;
  zona: 'lunedi' | 'mercoledi' | 'giovedi';
  tier: 'A' | 'B' | 'C';
  stato: 'da_contattare' | 'contattato' | 'attivo' | 'perso';
  note: string;
}

// Zona assignment basata su CAP e posizione geografica
// Lunedi = Nord/Winterthur (8400, 8304, 8050, 8052, 8155, 8353, 8180, 8172, 8424, 8422, 8600, 8404, 8153, 8057, 8046, 8355, 8597)
// Mercoledi = ZH Centro/Ovest (8003, 8004, 8005, 8006, 8047, 8048, 8952, 8953, 8800, 8810, 8102, 8103, 8032, 8001, 8134, 8142, 8045, 5637, 6020)
// Giovedi = Lago/Sud-Est (8126, 8835, 8853, 8805, 6300, 6314, 8802, 8803, 8640, 8645, 8330, 8700, 8706, 8340, 8610, 6003)

function getZona(zip: string): 'lunedi' | 'mercoledi' | 'giovedi' {
  const z = zip.replace('CH-', '');
  const lunedi = ['8400', '8304', '8050', '8052', '8155', '8353', '8180', '8172', '8424', '8422', '8600', '8404', '8153', '8057', '8046', '8355', '8597', '8447'];
  const giovedi = ['8126', '8835', '8853', '8805', '6300', '6314', '8802', '8803', '8640', '8645', '8330', '8700', '8706', '8340', '8610', '6003'];
  if (lunedi.includes(z)) return 'lunedi';
  if (giovedi.includes(z)) return 'giovedi';
  return 'mercoledi';
}

function getTier(fatMensile: number): 'A' | 'B' | 'C' {
  if (fatMensile >= 2000) return 'A';
  if (fatMensile >= 500) return 'B';
  return 'C';
}

export const clientiAlessandro = [
  // TIER A — Top clients (>2K/mese)
  { id: 6309, name: "Maliqi Systemgastronomie AG", street: "Richtiplatz 4", city: "Wallisellen", zip: "8304", phone: "+41 76 214 43 09", lat: 47.410061, lng: 8.594879, fatturato2026: 16502, fatturato2025: 80359, ultimoOrdine: "2026-03-26", zona: 'lunedi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 9540, name: "Proprius GMBH", street: "Zollstrasse 80", city: "Zürich", zip: "8005", phone: "", lat: 47.381223, lng: 8.531682, fatturato2026: 14460, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 5807, name: "Marina Gastro AG Osteria Vista", street: "Hafenstrasse 4", city: "Lachen", zip: "8853", phone: "+41 78 849 14 43", lat: 47.19354, lng: 8.85167, fatturato2026: 11300, fatturato2025: 27025, ultimoOrdine: "2026-03-31", zona: 'giovedi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 8708, name: "Rössli Ristorante la Perla (Cricri)", street: "Steiggasse 1", city: "Winterthur", zip: "8400", phone: "+41 52 212 55 66", lat: 47.497835, lng: 8.727841, fatturato2026: 10850, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 1175, name: "BRANDY'S PIZZA GMBH", street: "Doerflistrasse 117", city: "Zürich", zip: "8050", phone: "+41 78 652 27 72", lat: 47.4109083, lng: 8.547028, fatturato2026: 9723, fatturato2025: 26162, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 5298, name: "TERZOANGOLO GMBH", street: "Birmensdorferstrasse 169", city: "Zürich", zip: "8003", phone: "+41 41 218 68 16", lat: 47.370253, lng: 8.518223, fatturato2026: 10328, fatturato2025: 32635, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 885, name: "PRIMOGUSTO GMBH", street: "Hotzesetrasse 65", city: "Zürich", zip: "8006", phone: "", lat: 47.391997, lng: 8.539119, fatturato2026: 9175, fatturato2025: 28506, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 7098, name: "Gastronoah GmbH", street: "Rheinfallstrasse 11", city: "Dachsen", zip: "8447", phone: "+41 43 818 64 84", lat: 47.6701759, lng: 8.6129108, fatturato2026: 8461, fatturato2025: 30635, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 8656, name: "Grandin Trattoria Pizzeria", street: "Tobelmülistrasse 1", city: "Zumikon", zip: "8126", phone: "+41 44 918 22 98", lat: 47.323425, lng: 8.63106, fatturato2026: 7825, fatturato2025: 24115, ultimoOrdine: "2026-03-31", zona: 'giovedi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 8291, name: "Imperial Food AG", street: "Gschwaderstrasse 71b", city: "Uster", zip: "8610", phone: "+41 44 362 49 11", lat: 47.3617045, lng: 8.7170456, fatturato2026: 7345, fatturato2025: 24042, ultimoOrdine: "2026-03-31", zona: 'giovedi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 9979, name: "CREAM HOUSE A. Fonso", street: "Mandacherstrasse 56", city: "Niederhasli", zip: "8155", phone: "", lat: 47.364845, lng: 8.623445, fatturato2026: 6747, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 6051, name: "Franco Martorelli Rest. La Vista", street: "Feusisgartenstrasse 21", city: "Feusisberg", zip: "8835", phone: "+41 76 603 67 40", lat: 47.186997, lng: 8.755774, fatturato2026: 5856, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'giovedi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 900, name: "EMMA'S CAFE' GMBH", street: "Birchstrasse 271", city: "Zürich", zip: "8052", phone: "", lat: 47.420232, lng: 8.538206, fatturato2026: 5292, fatturato2025: 0, ultimoOrdine: "2026-04-06", zona: 'lunedi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 7974, name: "MVP Gastro AG", street: "Freilagerstrasse 53", city: "Zürich", zip: "8047", phone: "", lat: 47.379833, lng: 8.489449, fatturato2026: 4564, fatturato2025: 20848, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'A', stato: 'da_contattare', note: '' },
  { id: 10136, name: "DGD Gastro GmbH", street: "Loostrasse 19", city: "Rüschlikon", zip: "8803", phone: "", lat: 47.305441, lng: 8.543917, fatturato2026: 4490, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'giovedi', tier: 'A', stato: 'da_contattare', note: '' },
  // TIER B — Medium clients (500-2K/mese)
  { id: 5693, name: "Bontempi Bella Vita KLG", street: "Kirchgasse 4", city: "Elgg", zip: "8353", phone: "", lat: 47.489282, lng: 8.867621, fatturato2026: 3942, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 862, name: "CAFE ARCADE ZUERICH GMBH", street: "Birmensdorferstrasse 67", city: "Zürich", zip: "8004", phone: "", lat: 47.371106, lng: 8.524443, fatturato2026: 3200, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 852, name: "BELLA STREGA AG", street: "Rebhaldenstrasse 12", city: "Unterengstringen", zip: "8103", phone: "+41 44 542 65 45", lat: 47.4159553, lng: 8.4499428, fatturato2026: 3020, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 7388, name: "LaTo GmbH", street: "Dorfstrasse 48", city: "Richterswil", zip: "8805", phone: "+41 76 336 06 82", lat: 47.207759, lng: 8.705185, fatturato2026: 2429, fatturato2025: 0, ultimoOrdine: "2026-03-26", zona: 'giovedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 8875, name: "WinCoGast GmbH", street: "Rychenbergstrasse 208c", city: "Winterthur", zip: "8404", phone: "+49 1522 8031055", lat: 47.502918, lng: 8.746705, fatturato2026: 2748, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 7648, name: "Osteria da Francesco Cipolla", street: "Bahnhofstrasse 29", city: "Thalwil", zip: "8800", phone: "+41 78 798 96 08", lat: 47.2983, lng: 8.562295, fatturato2026: 2202, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 7629, name: "AnaMiRa GmbH", street: "Uetlibergstrasse 30", city: "Zürich", zip: "8045", phone: "", lat: 47.364205, lng: 8.520445, fatturato2026: 2118, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 5012, name: "CASA DI GIANLUCA GMBH", street: "Seestrasse 36", city: "Pfäffikon", zip: "8330", phone: "", lat: 47.366264, lng: 8.781485, fatturato2026: 2903, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'giovedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 7455, name: "Viva La Mamma GmbH", street: "Beckenhofstrasse 58", city: "Zürich", zip: "8006", phone: "", lat: 47.386704, lng: 8.540413, fatturato2026: 0, fatturato2025: 0, ultimoOrdine: "", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: 'Non in fatture 2026 ma rank alto' },
  { id: 877, name: "CEMINI GMBH", street: "Wattstrasse 7", city: "Zürich", zip: "8050", phone: "", lat: 47.413084, lng: 8.545191, fatturato2026: 1827, fatturato2025: 0, ultimoOrdine: "2026-02-28", zona: 'lunedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 1869, name: "LE DELIZIE DI MARCELLA", street: "Webereistrasse 4", city: "Dietikon", zip: "8953", phone: "+41 76 734 75 71", lat: 47.409735, lng: 8.403956, fatturato2026: 1274, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 7086, name: "Restaurant Linde Donatiello", street: "Dorfstrasse 33", city: "Pfungen", zip: "8422", phone: "", lat: 47.513607, lng: 8.64092, fatturato2026: 1738, fatturato2025: 0, ultimoOrdine: "2026-04-07", zona: 'lunedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 13445, name: "Rössli Beinwil Giulio Rossini", street: "Mitteldorf 7", city: "Beinwil (Freiamt)", zip: "5637", phone: "+41 56 668 10 40", lat: 47.23042, lng: 8.345499, fatturato2026: 2351, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 10322, name: "Fratelli Positano GmbH", street: "Fedenstrasse 32", city: "Emmen", zip: "6020", phone: "", lat: 47.068774, lng: 8.279753, fatturato2026: 3221, fatturato2025: 0, ultimoOrdine: "2026-04-04", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 953, name: "IL TRIANGOLO DEL GUSTO", street: "Am Wasser 1", city: "Dübendorf", zip: "8600", phone: "+41 44 599 11 03", lat: 47.404128, lng: 8.604805, fatturato2026: 2426, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 971, name: "RISTORANTE LA SCALA AG", street: "Marktgasse 23", city: "Rapperswil-Jona", zip: "8640", phone: "", lat: 47.226077, lng: 8.814744, fatturato2026: 925, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'giovedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 8870, name: "Kramer Gastronomie AG", street: "Alte Landstrasse 24", city: "Horgen", zip: "8810", phone: "+41 44 406 85 85", lat: 47.260311, lng: 8.597099, fatturato2026: 1640, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 986, name: "MG GASTROBETRIEBE AG", street: "Freiestrasse 213", city: "Zürich", zip: "8032", phone: "", lat: 47.360877, lng: 8.566581, fatturato2026: 1922, fatturato2025: 0, ultimoOrdine: "2026-02-28", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 5083, name: "Casa Gourmet GmbH", street: "Leuengasse 22", city: "Uitikon Waldegg", zip: "8142", phone: "", lat: 47.366166, lng: 8.460208, fatturato2026: 1515, fatturato2025: 0, ultimoOrdine: "2026-01-31", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 2352, name: "MIRABELLO GASTRO GMBH", street: "St. Galler Str. 165", city: "Jona", zip: "8645", phone: "", lat: 47.230564, lng: 8.853056, fatturato2026: 1592, fatturato2025: 0, ultimoOrdine: "2026-02-28", zona: 'giovedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 7524, name: "Pizzeria G&M GmbH", street: "Birchstrasse 147", city: "Zürich", zip: "8050", phone: "", lat: 47.410939, lng: 8.537677, fatturato2026: 1801, fatturato2025: 0, ultimoOrdine: "2026-02-28", zona: 'lunedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 8660, name: "Thach Gastro GmbH", street: "Militärstrasse 84", city: "Zürich", zip: "8004", phone: "", lat: 47.378712, lng: 8.529852, fatturato2026: 1135, fatturato2025: 0, ultimoOrdine: "2026-02-28", zona: 'mercoledi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 10223, name: "Gastro-Embrach GmbH", street: "Bahnstrasse 5", city: "Embrach", zip: "8424", phone: "+41 43 266 66 53", lat: 47.503, lng: 8.594, fatturato2026: 1473, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'B', stato: 'da_contattare', note: '' },
  { id: 854, name: "BOTTEGA DEI SAPORI MIGLIO", street: "Neuweg 4", city: "Dübendorf", zip: "8600", phone: "+41 44 821 25 09", lat: 47.396317, lng: 8.61338, fatturato2026: 1374, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'B', stato: 'da_contattare', note: '' },
  // TIER C — Small clients (<500/mese)
  { id: 8574, name: "MILLE DELIZIE", street: "Gotthardstrasse 35", city: "Thalwil", zip: "8800", phone: "", lat: 47.296153, lng: 8.562772, fatturato2026: 1508, fatturato2025: 0, ultimoOrdine: "2026-03-27", zona: 'mercoledi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 8702, name: "Tuscany Italian Kitchen GmbH", street: "Alte Landstrasse 192", city: "Unterägeri", zip: "6314", phone: "", lat: 47.141011, lng: 8.573154, fatturato2026: 1050, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'giovedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 9958, name: "Tennis Club Meilen", street: "Auf der Hurnen 66", city: "Meilen", zip: "8706", phone: "+41 77 921 47 98", lat: 47.273333, lng: 8.643112, fatturato2026: 1427, fatturato2025: 0, ultimoOrdine: "2026-03-21", zona: 'giovedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 5778, name: "ZUMA FOOD GMBH", street: "Frankenstrasse 6a", city: "Luzern", zip: "6003", phone: "", lat: 47.049266, lng: 8.30838, fatturato2026: 856, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'giovedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 5228, name: "lick n'love GmbH", street: "Mandachstrasse 54/56", city: "Niederhasli", zip: "8155", phone: "+41 78 480 05 82", lat: 47.4801704, lng: 8.4904938, fatturato2026: 1515, fatturato2025: 0, ultimoOrdine: "2026-03-19", zona: 'lunedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 2888, name: "LA ROMAGNOLA CENTRO", street: "Feldstrasse 57", city: "Winterthur", zip: "8400", phone: "+41 78 222 46 72", lat: 47.504369, lng: 8.720904, fatturato2026: 992, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 6381, name: "Locanda Trivisano GmbH", street: "Stadthausstrasse 121", city: "Winterthur", zip: "8400", phone: "", lat: 47.499695, lng: 8.726124, fatturato2026: 662, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'lunedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 8039, name: "Gusto e Tradizione StreetFood", street: "Brunnenwiesliweg 8", city: "Horgen", zip: "8810", phone: "", lat: 47.260376, lng: 8.592271, fatturato2026: 847, fatturato2025: 0, ultimoOrdine: "2026-03-18", zona: 'mercoledi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 2274, name: "LA FONTANA UNO GMBH", street: "Zugerstrasse 12", city: "Horgen", zip: "8810", phone: "+41 44 725 83 80", lat: 47.2596726, lng: 8.597964, fatturato2026: 337, fatturato2025: 0, ultimoOrdine: "2026-01-31", zona: 'mercoledi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 1176, name: "Rist. Gusto Mediterraneo", street: "Kaiserstuhlstrasse 54", city: "Niederglatt", zip: "8172", phone: "", lat: 47.493757, lng: 8.497309, fatturato2026: 364, fatturato2025: 0, ultimoOrdine: "2026-03-26", zona: 'lunedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 1153, name: "PIZZERIA PIAZZA AYDIN YASAR", street: "Wehntalerstrasse 546", city: "Zürich", zip: "8046", phone: "+41 44 500 20 44", lat: 47.41945, lng: 8.506053, fatturato2026: 440, fatturato2025: 0, ultimoOrdine: "2026-02-28", zona: 'lunedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 14621, name: "LIBERA GLUTEN FREE", street: "Badenerstrasse 298", city: "Zürich", zip: "8004", phone: "", lat: 47.375, lng: 8.524, fatturato2026: 496, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'mercoledi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 9142, name: "Pagano Raffaele (MamaMaria)", street: "Bahnhofstrasse 6", city: "Rümlang", zip: "8153", phone: "+41 76 739 89 60", lat: 47.451, lng: 8.526, fatturato2026: 634, fatturato2025: 0, ultimoOrdine: "2026-04-02", zona: 'lunedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 6744, name: "Gennaro Savarese", street: "Herrengasse 9", city: "Lachen", zip: "8853", phone: "", lat: 47.192306, lng: 8.852147, fatturato2026: 1204, fatturato2025: 0, ultimoOrdine: "2026-02-25", zona: 'giovedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 13648, name: "Bear Street Bakery GmbH", street: "Titlistrasse 31", city: "Zürich", zip: "8032", phone: "", lat: 47.372, lng: 8.539, fatturato2026: 432, fatturato2025: 0, ultimoOrdine: "2026-02-28", zona: 'mercoledi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 12877, name: "Sarcinelli GmbH", street: "Lorenweg 29", city: "Uster", zip: "8610", phone: "+41 77 420 62 42", lat: 47.35, lng: 8.72, fatturato2026: 403, fatturato2025: 0, ultimoOrdine: "2026-03-31", zona: 'giovedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 10187, name: "Di Stefano Giuseppe", street: "Winterthurerstrasse 28", city: "Bülach", zip: "8180", phone: "+41 76 778 13 55", lat: 47.5199324, lng: 8.5442259, fatturato2026: 127, fatturato2025: 0, ultimoOrdine: "2026-02-19", zona: 'lunedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 3010, name: "Burro Concept GmbH", street: "Suterweg 3", city: "Horgen", zip: "8810", phone: "", lat: 47.255064, lng: 8.615077, fatturato2026: 940, fatturato2025: 0, ultimoOrdine: "2026-01-15", zona: 'mercoledi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 12898, name: "Mastro Alfonso GmbH", street: "Lauriedhofweg 19", city: "Zug", zip: "6300", phone: "+41 41 783 00 02", lat: 47.166, lng: 8.515, fatturato2026: 92, fatturato2025: 0, ultimoOrdine: "2026-01-31", zona: 'giovedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 3102, name: "Gioie Salentine GmbH", street: "Morgentalstrasse 35", city: "Aadorf", zip: "8355", phone: "", lat: 47.493723, lng: 8.894655, fatturato2026: 167, fatturato2025: 0, ultimoOrdine: "2026-02-28", zona: 'lunedi', tier: 'C', stato: 'da_contattare', note: '' },
  { id: 835, name: "AL DENTE GASTRO AG", street: "Thurgauerstrasse 117", city: "Glattbrugg Opfikon", zip: "8152", phone: "+41 43 211 35 91", lat: 47.424176, lng: 8.558707, fatturato2026: 0, fatturato2025: 21511, ultimoOrdine: "", zona: 'lunedi', tier: 'C', stato: 'da_contattare', note: 'Solo fatturato 2025, fermo nel 2026' },
  { id: 9383, name: "Cigro GmbH", street: "Käferholzstrasse 36", city: "Zürich", zip: "8057", phone: "+41 44 767 05 01", lat: 47.401353, lng: 8.532282, fatturato2026: 0, fatturato2025: 0, ultimoOrdine: "", zona: 'lunedi', tier: 'C', stato: 'da_contattare', note: '' },
].sort((a, b) => b.fatturato2026 - a.fatturato2026) as ClienteRecupero[];

export const zoneConfig = {
  lunedi: { label: 'Lunedì', subtitle: 'Nord / Winterthur', color: '#3B82F6' },
  mercoledi: { label: 'Mercoledì', subtitle: 'ZH Centro / Ovest', color: '#22C55E' },
  giovedi: { label: 'Giovedì', subtitle: 'Lago / Sud-Est', color: '#EF4444' },
};

export const tierConfig = {
  A: { label: 'Top', color: '#F59E0B', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  B: { label: 'Medio', color: '#3B82F6', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  C: { label: 'Piccolo', color: '#6B7280', bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
};
