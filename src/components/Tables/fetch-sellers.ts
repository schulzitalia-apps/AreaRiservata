// app/(admin)/_components/fetch-sellers.ts

export type Seller = {
  name: string;
  orders: number;          // N° Ordini
  revenues: number;        // €
  avgOrderValue: number;   // €
  reliability: number;     // %
};

export const ITALIAN_REGIONS = [
  "ITALIA",
  "Abruzzo",
  "Basilicata",
  "Calabria",
  "Campania",
  "Emilia-Romagna",
  "Friuli-Venezia Giulia",
  "Lazio",
  "Liguria",
  "Lombardia",
  "Marche",
  "Molise",
  "Piemonte",
  "Puglia",
  "Sardegna",
  "Sicilia",
  "Toscana",
  "Trentino-Alto Adige",
  "Umbria",
  "Valle d'Aosta",
  "Veneto",
] as const;

/* ----------------------------------------------------------------
   Lessico “finestre / serramenti” come tipologie di rivendite/aziende
   (più realistico: officine, opifici, carpenterie, vetrerie, ecc.)
------------------------------------------------------------------ */
const WINDOW_BUSINESS_WORDS = [
  "Serramenti",
  "Infissi",
  "Carpenteria",
  "Carpenterie",
  "Falegnameria",
  "Falegnamerie",
  "Vetreria",
  "Vetrerie",
  "Ferramenta",
  "Metallurgia",
  "Metallurgica",
  "Officina",
  "Officine",
  "Opificio",
  "Opifici",
  "Blindature",
  "Coibentazioni",
  "Isolamenti",
  "Persiane",
  "Tapparelle",
  "Avvolgibili",
  "Oscuranti",
  "Zanzariere",
  "Scorrevoli",
  "Basculanti",
  "Automazioni",
  "PorteFinestre",
  "Chiusure",
  "Facciate",
  "Schermature",
  "Parapetti",
  "Paratie",
  "Bottega",
  "Showroom",
  "Distribuzione",
  "Commerciale",
  "Commercio",
  "Forniture",
  "Fornitura",
  "Soluzioni",
  "Tecnologie",
  "Progetti",
  "Design",
  "Montaggi",
  "Installazioni",
  "Assistenza",
  "Manutenzioni",
  "Service",
  "Industria",
  "Cantieri",
  "Laboratorio",
  "Linea",
  "Prodotti",
  "Produzioni",
  "Componenti",
  "Profili",
  "Alluminio",
  "PVC",
  "LegnoAlluminio",
  "Legno",
  "TaglioTermico",
  "Vetrate",
];

/* ----------------------------------------------------------------
   Regione -> Province (subset coerente con le keyword sotto)
------------------------------------------------------------------ */
const REGION_PROVINCES: Record<string, string[]> = {
  "Abruzzo": ["L'Aquila", "Teramo", "Chieti", "Pescara"],
  "Basilicata": ["Potenza", "Matera"],
  "Calabria": ["Catanzaro", "Cosenza", "Crotone", "Reggio Calabria", "Vibo Valentia"],
  "Campania": ["Napoli", "Salerno", "Avellino", "Benevento", "Caserta"],
  "Emilia-Romagna": [
    "Bologna",
    "Modena",
    "Reggio Emilia",
    "Parma",
    "Piacenza",
    "Ferrara",
    "Forlì-Cesena",
    "Ravenna",
    "Rimini",
  ],
  "Friuli-Venezia Giulia": ["Trieste", "Udine", "Pordenone", "Gorizia"],
  "Lazio": ["Roma", "Frosinone", "Latina", "Rieti", "Viterbo"],
  "Liguria": ["Genova", "Savona", "Imperia", "La Spezia"],
  "Lombardia": [
    "Milano",
    "Bergamo",
    "Brescia",
    "Como",
    "Cremona",
    "Lecco",
    "Lodi",
    "Mantova",
    "Monza e Brianza",
    "Pavia",
    "Sondrio",
    "Varese",
  ],
  "Marche": ["Ancona", "Ascoli Piceno", "Fermo", "Macerata", "Pesaro e Urbino"],
  "Molise": ["Campobasso", "Isernia"],
  "Piemonte": [
    "Torino",
    "Cuneo",
    "Asti",
    "Alessandria",
    "Biella",
    "Novara",
    "Vercelli",
    "Verbano-Cusio-Ossola",
  ],
  "Puglia": ["Bari", "Barletta-Andria-Trani", "Brindisi", "Foggia", "Lecce", "Taranto"],
  "Sardegna": ["Cagliari", "Sassari", "Nuoro", "Oristano", "Sud Sardegna"],
  "Sicilia": [
    "Palermo",
    "Catania",
    "Messina",
    "Agrigento",
    "Caltanissetta",
    "Enna",
    "Ragusa",
    "Siracusa",
    "Trapani",
  ],
  "Toscana": [
    "Firenze",
    "Pisa",
    "Livorno",
    "Lucca",
    "Pistoia",
    "Prato",
    "Arezzo",
    "Grosseto",
    "Massa-Carrara",
    "Siena",
  ],
  "Trentino-Alto Adige": ["Trento", "Bolzano"],
  "Umbria": ["Perugia", "Terni"],
  "Valle d'Aosta": ["Aosta"],
  "Veneto": ["Venezia", "Verona", "Vicenza", "Padova", "Treviso", "Rovigo", "Belluno"],
};

/* ----------------------------------------------------------------
   Sigle provinciali -> Nome provincia (per le province che usiamo)
------------------------------------------------------------------ */
const PROVINCE_CODE_TO_NAME: Record<string, string> = {
  // Abruzzo
  "AQ": "L'Aquila", "TE": "Teramo", "CH": "Chieti", "PE": "Pescara",
  // Basilicata
  "PZ": "Potenza", "MT": "Matera",
  // Calabria
  "CZ": "Catanzaro", "CS": "Cosenza", "KR": "Crotone", "RC": "Reggio Calabria", "VV": "Vibo Valentia",
  // Campania
  "NA": "Napoli", "SA": "Salerno", "AV": "Avellino", "BN": "Benevento", "CE": "Caserta",
  // Emilia-Romagna
  "BO": "Bologna", "MO": "Modena", "RE": "Reggio Emilia", "PR": "Parma", "PC": "Piacenza",
  "FE": "Ferrara", "FC": "Forlì-Cesena", "RA": "Ravenna", "RN": "Rimini",
  // Friuli-Venezia Giulia
  "TS": "Trieste", "UD": "Udine", "PN": "Pordenone", "GO": "Gorizia",
  // Lazio
  "RM": "Roma", "FR": "Frosinone", "LT": "Latina", "RI": "Rieti", "VT": "Viterbo",
  // Liguria
  "GE": "Genova", "SV": "Savona", "IM": "Imperia", "SP": "La Spezia",
  // Lombardia
  "MI": "Milano", "BG": "Bergamo", "BS": "Brescia", "CO": "Como", "CR": "Cremona",
  "LC": "Lecco", "LO": "Lodi", "MN": "Mantova", "MB": "Monza e Brianza",
  "PV": "Pavia", "SO": "Sondrio", "VA": "Varese",
  // Marche
  "AN": "Ancona", "AP": "Ascoli Piceno", "FM": "Fermo", "MC": "Macerata", "PU": "Pesaro e Urbino",
  // Molise
  "CB": "Campobasso", "IS": "Isernia",
  // Piemonte
  "TO": "Torino", "CN": "Cuneo", "AT": "Asti", "AL": "Alessandria", "BI": "Biella",
  "NO": "Novara", "VC": "Vercelli", "VB": "Verbano-Cusio-Ossola",
  // Puglia
  "BA": "Bari", "BT": "Barletta-Andria-Trani", "BR": "Brindisi", "FG": "Foggia", "LE": "Lecce", "TA": "Taranto",
  // Sardegna
  "CA": "Cagliari", "SS": "Sassari", "NU": "Nuoro", "OR": "Oristano", "SU": "Sud Sardegna",
  // Sicilia
  "PA": "Palermo", "CT": "Catania", "ME": "Messina", "AG": "Agrigento", "CL": "Caltanissetta",
  "EN": "Enna", "RG": "Ragusa", "SR": "Siracusa", "TP": "Trapani",
  // Toscana
  "FI": "Firenze", "PI": "Pisa", "LI": "Livorno", "LU": "Lucca", "PT": "Pistoia",
  "PO": "Prato", "AR": "Arezzo", "GR": "Grosseto", "MS": "Massa-Carrara", "SI": "Siena",
  // Trentino-Alto Adige
  "TN": "Trento", "BZ": "Bolzano",
  // Umbria
  "PG": "Perugia", "TR": "Terni",
  // Valle d'Aosta
  "AO": "Aosta",
  // Veneto
  "VE": "Venezia", "VR": "Verona", "VI": "Vicenza", "PD": "Padova", "TV": "Treviso", "RO": "Rovigo", "BL": "Belluno",
};

/* ----------------------------------------------------------------
   5 parole per provincia (identità locale)
------------------------------------------------------------------ */
const PROVINCE_KEYWORDS: Record<string, string[]> = {
  // Abruzzo
  "L'Aquila": ["GranSasso", "Bastioni", "Castello", "Zafferano", "Borgo"],
  "Teramo": ["Adriatico", "Fiumi", "Colline", "Gambero", "Duomo"],
  "Chieti": ["Marrucini", "Trabocchi", "Vitigni", "Museo", "Teate"],
  "Pescara": ["DAnnunzio", "Ponte", "Lido", "Marina", "Pineta"],

  // Basilicata
  "Potenza": ["Appennino", "Basento", "CentroStorico", "Scale", "Monti"],
  "Matera": ["Sassi", "Gravina", "Caveoso", "Murgia", "Ipogei"],

  // Calabria
  "Catanzaro": ["DueMari", "Parco", "Ionio", "Tiriolo", "Selezione"],
  "Cosenza": ["Sila", "MAB", "Crati", "Bruzi", "CastelloSvevo"],
  "Crotone": ["CapoColonna", "Marinella", "Tempio", "Promontorio", "Aranci"],
  "Reggio Calabria": ["FataMorgana", "Bronzi", "Aspromonte", "Lungomare", "Bergamotto"],
  "Vibo Valentia": ["CostaDegliDei", "Tropea", "Pizzo", "Castello", "Tonnara"],

  // Campania
  "Napoli": ["Vesuvio", "Partenope", "Spaccanapoli", "Scugnizzo", "Posillipo"],
  "Salerno": ["Costiera", "Arechi", "Luci", "Irno", "Porto"],
  "Avellino": ["Irpinia", "Greco", "Fiano", "Partenio", "Boschi"],
  "Benevento": ["Strega", "Arco", "Sannio", "Traiano", "Falanghina"],
  "Caserta": ["Reggia", "Vanvitelli", "Setificio", "Acquedotto", "Campano"],

  // Emilia-Romagna
  "Bologna": ["Portici", "Dotta", "TorreAsinelli", "Mortadella", "Fiera"],
  "Modena": ["Ghirlandina", "Balsamico", "Motors", "Lambrusco", "Pavarotti"],
  "Reggio Emilia": ["Tricolore", "Pietra", "Mappe", "Parmigiano", "Secchia"],
  "Parma": ["Prosciutto", "Culatello", "Ducale", "Pilotta", "Parco"],
  "Piacenza": ["Gotico", "ValTrebbia", "Salumi", "Po", "Castelli"],
  "Ferrara": ["Estense", "Mura", "Palio", "Delta", "Bicicletta"],
  "Forlì-Cesena": ["Romagna", "Aeroporto", "Tramonto", "Spianata", "Savignano"],
  "Ravenna": ["Mosaici", "Basiliche", "Classe", "Pineta", "PortoCorsini"],
  "Rimini": ["Riviera", "Fellini", "Fiabilandia", "Movida", "ArcoAugusto"],

  // Friuli-Venezia Giulia
  "Trieste": ["Bora", "MoloAudace", "Caffè", "Carso", "CastelloMiramare"],
  "Udine": ["Friulano", "Castello", "Stadio", "Osterie", "Loggia"],
  "Pordenone": ["Naonis", "Comina", "PnBox", "Meduna", "Fiera"],
  "Gorizia": ["Isonzo", "Castello", "Transalpina", "Collio", "Frontiera"],

  // Lazio
  "Roma": ["Colosseo", "Tevere", "Fori", "Castelli", "Lido"],
  "Frosinone": ["Ciociaria", "Ernici", "Sora", "Anagni", "Fiuggi"],
  "Latina": ["Pontino", "Sabaudia", "Circeo", "Sezze", "Terracina"],
  "Rieti": ["Terminillo", "Sabina", "Velino", "Lago", "Piana"],
  "Viterbo": ["Tuscia", "Terme", "Palazzo", "Macchina", "Bagnaccio"],

  // Liguria
  "Genova": ["Lanterna", "Acquario", "Caruggi", "Sampierdarena", "Focaccia"],
  "Savona": ["Fortezza", "CapoNoli", "Vado", "Albissola", "Torrente"],
  "Imperia": ["OliveTaggiasche", "PortoMaurizio", "Oneglia", "BorgoMarina", "Riviera"],
  "La Spezia": ["CinqueTerre", "Golfo", "Arsenale", "Lerici", "Portovenere"],

  // Lombardia
  "Milano": ["Duomo", "Navigli", "Brera", "Isola", "Borsa"],
  "Bergamo": ["CittàAlta", "Donizetti", "Oriocenter", "Orobiche", "Serio"],
  "Brescia": ["Leonessa", "Vittoria", "Franciacorta", "Iseo", "Valtrompia"],
  "Como": ["Lago", "VillaOlmo", "Seta", "Funicolare", "Cernobbio"],
  "Cremona": ["Liuteria", "Torrazzo", "Po", "Violino", "Stradivari"],
  "Lecco": ["Manzoni", "Resegone", "Adda", "Pescarenico", "Valsassina"],
  "Lodi": ["AddaSud", "Tempio", "Risaie", "Cattedrale", "Bipielle"],
  "Mantova": ["Gonzaga", "LagoInferiore", "Sordello", "PalazzoTè", "Anello"],
  "Monza e Brianza": ["Autodromo", "VillaReale", "Parco", "Arengario", "Brianza"],
  "Pavia": ["Ticino", "Certosa", "PonteCoperto", "Torri", "Oltrepò"],
  "Sondrio": ["Valtellina", "Bernina", "Grumello", "Adda", "Terrazzamenti"],
  "Varese": ["SacroMonte", "Lago", "Schiranna", "Velate", "Capolago"],

  // Marche
  "Ancona": ["Conero", "Porto", "Passetto", "Mole", "ForteAltavilla"],
  "Ascoli Piceno": ["Quintana", "OliveAscolane", "Travertino", "Tronto", "CentoTorri"],
  "Fermo": ["Falerone", "Calanchi", "Marina", "Sapori", "MontiSibillini"],
  "Macerata": ["Sferisterio", "Università", "Abbadia", "ValleChienti", "Tolentino"],
  "Pesaro e Urbino": ["Rossini", "Fiorenzuola", "Furlo", "Montefeltro", "Rocche"],

  // Molise
  "Campobasso": ["CastelloMonforte", "Trignina", "Tintilia", "Matrice", "Cipressi"],
  "Isernia": ["Pentri", "Carpinone", "Coriandoli", "Acquedotto", "Volturno"],

  // Piemonte
  "Torino": ["Mole", "Po", "Sabauda", "Lingotto", "Valentino"],
  "Cuneo": ["Langhe", "Alba", "Tartufo", "Stura", "Monviso"],
  "Asti": ["Palio", "Spumante", "Tanaro", "Torre", "Infernot"],
  "Alessandria": ["Bormida", "Cittadella", "Marengo", "Monferrato", "Orti"],
  "Biella": ["Oropa", "Lanificio", "Cervo", "Burcina", "Canestro"],
  "Novara": ["Risaie", "Cupola", "Agogna", "Gorgonzola", "Broletto"],
  "Vercelli": ["Riso", "Sesia", "Basilica", "Eusebiana", "Robbiate"],
  "Verbano-Cusio-Ossola": ["Maggiore", "Orta", "Toce", "Mottarone", "Borromeo"],

  // Puglia
  "Bari": ["Lungomare", "Orecchiette", "Petruzzelli", "Pane", "SanNicola"],
  "Barletta-Andria-Trani": ["Disfida", "CastelDelMonte", "Ulivi", "Sale", "TraniMarina"],
  "Brindisi": ["Porto", "ViaAppia", "Punta", "Aeroporto", "Capestrano"],
  "Foggia": ["Tavoliere", "Gargano", "Peschici", "Manfredonia", "SanSevero"],
  "Lecce": ["Barocco", "Anfiteatro", "SantOronzo", "Cartapesta", "PortaNapoli"],
  "Taranto": ["MarGrande", "Arsenale", "PonteGirevole", "Delfini", "Cheradi"],

  // Sardegna
  "Cagliari": ["Castello", "Poetto", "SellaDelDiavolo", "Molentargius", "Bastione"],
  "Sassari": ["Platamona", "Candida", "Turritana", "Fertilia", "Argentiera"],
  "Nuoro": ["Supramonte", "Gennargentu", "Grazia", "Cannonau", "Orgosolo"],
  "Oristano": ["Arborea", "Sartiglia", "Sinis", "Tharros", "Stagno"],
  "Sud Sardegna": ["Villasimius", "Teulada", "Sulcis", "Carloforte", "Piscinas"],

  // Sicilia
  "Palermo": ["Normanna", "QuattroCanti", "Catalfano", "Mondello", "Cassaro"],
  "Catania": ["Etna", "Ursino", "Acitrezza", "Lava", "Pescheria"],
  "Messina": ["Stretto", "CapoPeloro", "Cavalieri", "Annunziata", "Ganzirri"],
  "Agrigento": ["ValleTempli", "Akragas", "ScalaTurchi", "Kolymbethra", "Biblico"],
  "Caltanissetta": ["Zolfo", "Petilìa", "Pietrarossa", "Salso", "Sicani"],
  "Enna": ["Pergusa", "CastelloLombardia", "CentroSicilia", "Rocca", "Armerina"],
  "Ragusa": ["Ibla", "Modica", "Scicli", "Cava", "Donnafugata"],
  "Siracusa": ["Ortigia", "Aretusa", "Plemmirio", "Neapolis", "Tonnara"],
  "Trapani": ["Saline", "Erice", "Marsala", "Isole", "Mulini"],

  // Toscana
  "Firenze": ["Duomo", "PonteVecchio", "Uffizi", "Oltrarno", "Signoria"],
  "Pisa": ["Torre", "Arno", "Lungarni", "PiazzaMiracoli", "Cisanello"],
  "Livorno": ["TerrazzaMascagni", "Fossi", "Montenero", "Porto", "Quartieri"],
  "Lucca": ["Mura", "Puccini", "Anfiteatro", "Serchio", "Baluardi"],
  "Pistoia": ["Giostra", "Nursery", "Montagna", "Ospedale", "PiazzaDuomo"],
  "Prato": ["Textile", "Datini", "Bisenzio", "Pecci", "Cantonese"],
  "Arezzo": ["GiostraSaracino", "Oro", "Clusone", "Valdarno", "Casentino"],
  "Grosseto": ["Maremma", "Diaccia", "Roselle", "PortoErcole", "Talamone"],
  "Massa-Carrara": ["AlpiApuane", "Cave", "Marmo", "Lardo", "Pontile"],
  "Siena": ["Palio", "Contrade", "Crete", "ValdOrcia", "TorreMangia"],

  // Trentino-Alto Adige
  "Trento": ["CastelloBuonconsiglio", "Adige", "Bondone", "Albere", "Paganella"],
  "Bolzano": ["Talvera", "Walther", "Renon", "Dolomiti", "Mercatini"],

  // Umbria
  "Perugia": ["RoccaPaolina", "FontanaMaggiore", "Minimetro", "Etrusco", "Cioccolato"],
  "Terni": ["CascataMarmore", "Acciaio", "SanValentino", "Nera", "Carsulae"],

  // Valle d'Aosta
  "Aosta": ["MonteBianco", "Pila", "ArcoAugusto", "Cogne", "GranParadiso"],

  // Veneto
  "Venezia": ["Laguna", "Canali", "SanMarco", "Rialto", "Arsenale"],
  "Verona": ["Arena", "Adige", "Juliet", "Lessinia", "Valpolicella"],
  "Vicenza": ["Palladio", "Basilica", "MonteBerico", "Oro", "Torri"],
  "Padova": ["Prato", "Università", "Caffè", "Specola", "SantAntonio"],
  "Treviso": ["Sile", "Cagnan", "Cansiglio", "Mura", "Prosecco"],
  "Rovigo": ["DeltaPo", "Adria", "Villanova", "PalazzoRoverella", "Polesine"],
  "Belluno": ["Dolomiti", "Cadore", "Piave", "Nevegal", "Agordo"],
};

/* ----------------------------------------------------------------
   PRNG deterministico
------------------------------------------------------------------ */
function seededRandom(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ----------------------------------------------------------------
   Helpers: risoluzione input -> province
------------------------------------------------------------------ */
function allProvinces(): string[] {
  const set = new Set<string>();
  Object.values(REGION_PROVINCES).forEach((arr) => arr.forEach((p) => set.add(p)));
  return Array.from(set);
}

function isRegion(input: string) {
  return Object.prototype.hasOwnProperty.call(REGION_PROVINCES, input);
}

function isProvince(input: string) {
  return Object.prototype.hasOwnProperty.call(PROVINCE_KEYWORDS, input);
}

function codeToProvinceMaybe(input: string): string | null {
  const code = input.trim().toUpperCase();
  return PROVINCE_CODE_TO_NAME[code] ?? null;
}

function provincesForInput(inputRaw: string): string[] {
  const input = (inputRaw || "").trim();
  if (input.toUpperCase() === "ITALIA" || input === "") return allProvinces();

  // 1) Sigla provincia (es. "MC") -> provincia
  const byCode = codeToProvinceMaybe(input);
  if (byCode) return [byCode];

  // 2) Nome regione valido
  if (isRegion(input)) return REGION_PROVINCES[input];

  // 3) Nome provincia valido
  if (isProvince(input)) return [input];

  // 4) Case-insensitive
  const byRegionCI =
    Object.keys(REGION_PROVINCES).find((r) => r.toLowerCase() === input.toLowerCase()) ?? null;
  if (byRegionCI) return REGION_PROVINCES[byRegionCI];

  const byProvinceCI =
    Object.keys(PROVINCE_KEYWORDS).find((p) => p.toLowerCase() === input.toLowerCase()) ?? null;
  if (byProvinceCI) return [byProvinceCI];

  // default: tutte
  return allProvinces();
}

/* ----------------------------------------------------------------
   Generazione nomi: <BusinessWord> + <ProvinciaKeyword> + suffisso
------------------------------------------------------------------ */
const LEGAL_SUFFIX = ["S.r.l.", "S.p.A.", "S.a.s.", "S.n.c.", "S.c.a.r.l."];

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function makeSellerName(rnd: () => number, province: string): string {
  const ww = pick(rnd, WINDOW_BUSINESS_WORDS);
  const pwords = PROVINCE_KEYWORDS[province] ?? ["Locale", "Storico", "Artigiani", "Borgo", "Capoluogo"];
  const pw = pick(rnd, pwords);
  const suff = pick(rnd, LEGAL_SUFFIX);
  return `${ww} ${pw} ${suff}`;
}

/* ----------------------------------------------------------------
   Dataset builders
------------------------------------------------------------------ */
function buildDatasetFromProvinces(seedKey: string, provs: string[]): Seller[] {
  const rnd = seededRandom(seedKey);
  const len = 8 + Math.floor(rnd() * 3); // 8..10
  const sellers: Seller[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < len; i++) {
    const province = pick(rnd, provs);

    let name = makeSellerName(rnd, province);
    let guard = 0;
    while (usedNames.has(name) && guard < 10) {
      name = makeSellerName(rnd, province);
      guard++;
    }
    usedNames.add(name);

    const orders = 200 + Math.floor(rnd() * 3500);
    const avg = 20 + Math.floor(rnd() * 480);
    const revenues = Math.round(orders * avg * (0.8 + rnd() * 0.6));
    const reliability = Math.round(70 + rnd() * 30);

    sellers.push({ name, orders, revenues, avgOrderValue: avg, reliability });
  }

  sellers.sort((a, b) => b.orders - a.orders);
  return sellers;
}

/* ----------------------------------------------------------------
   API
------------------------------------------------------------------ */
export async function getTopSellers(regionOrProvince: string): Promise<Seller[]> {
  await new Promise((r) => setTimeout(r, 700)); // simulazione latenza

  const key = (regionOrProvince || "ITALIA").trim();
  const provs = provincesForInput(key);

  const seedKey = `${key.toUpperCase()}::${provs.join("|")}`;
  return buildDatasetFromProvinces(seedKey, provs);
}
