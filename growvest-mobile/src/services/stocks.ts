// Full NSE stock universe: Nifty 50 + Nifty Next 50 + Nifty Midcap 100
export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  isActive: boolean;
}

const nameMap: Record<string, string> = {
  RELIANCE: 'Reliance Industries Ltd', TCS: 'Tata Consultancy Services Ltd', HDFCBANK: 'HDFC Bank Ltd',
  INFY: 'Infosys Ltd', HINDUNILVR: 'Hindustan Unilever Ltd', ICICIBANK: 'ICICI Bank Ltd',
  KOTAKBANK: 'Kotak Mahindra Bank Ltd', BHARTIARTL: 'Bharti Airtel Ltd', ITC: 'ITC Ltd',
  SBIN: 'State Bank of India', LT: 'Larsen & Toubro Ltd', AXISBANK: 'Axis Bank Ltd',
  MARUTI: 'Maruti Suzuki India Ltd', BAJFINANCE: 'Bajaj Finance Ltd', HCLTECH: 'HCL Technologies Ltd',
  WIPRO: 'Wipro Ltd', ULTRACEMCO: 'UltraTech Cement Ltd', ADANIPORTS: 'Adani Ports & SEZ Ltd',
  ONGC: 'Oil & Natural Gas Corp Ltd', TATAMOTORS: 'Tata Motors Ltd', SUNPHARMA: 'Sun Pharma Industries Ltd',
  JSWSTEEL: 'JSW Steel Ltd', TATASTEEL: 'Tata Steel Ltd', POWERGRID: 'Power Grid Corp Ltd',
  NTPC: 'NTPC Ltd', TECHM: 'Tech Mahindra Ltd', TITAN: 'Titan Company Ltd',
  NESTLEIND: 'Nestle India Ltd', COALINDIA: 'Coal India Ltd', BAJAJFINSV: 'Bajaj Finserv Ltd',
  'M&M': 'Mahindra & Mahindra Ltd', HDFCLIFE: 'HDFC Life Insurance Ltd', GRASIM: 'Grasim Industries Ltd',
  DRREDDY: "Dr Reddy's Labs Ltd", BRITANNIA: 'Britannia Industries Ltd', EICHERMOT: 'Eicher Motors Ltd',
  BPCL: 'Bharat Petroleum Corp Ltd', CIPLA: 'Cipla Ltd', DIVISLAB: "Divi's Labs Ltd",
  HEROMOTOCO: 'Hero MotoCorp Ltd', 'BAJAJ-AUTO': 'Bajaj Auto Ltd', TATACONSUM: 'Tata Consumer Products Ltd',
  INDUSINDBK: 'IndusInd Bank Ltd', APOLLOHOSP: 'Apollo Hospitals Ltd', LTIM: 'LTIMindtree Ltd',
  ADANIENT: 'Adani Enterprises Ltd', HINDALCO: 'Hindalco Industries Ltd', SHRIRAMFIN: 'Shriram Finance Ltd',
  ASIANPAINT: 'Asian Paints Ltd', SBILIFE: 'SBI Life Insurance Ltd', PIDILITIND: 'Pidilite Industries Ltd',
  ABBOTINDIA: 'Abbott India Ltd', ADANIGREEN: 'Adani Green Energy Ltd', ADANIPOWER: 'Adani Power Ltd',
  AMBUJACEM: 'Ambuja Cements Ltd', ATGL: 'Adani Total Gas Ltd', BANKBARODA: 'Bank of Baroda',
  BEL: 'Bharat Electronics Ltd', BERGEPAINT: 'Berger Paints India Ltd', BOSCHLTD: 'Bosch Ltd',
  CANBK: 'Canara Bank', CHOLAFIN: 'Cholamandalam Finance Ltd', COLPAL: 'Colgate-Palmolive Ltd',
  DABUR: 'Dabur India Ltd', DLF: 'DLF Ltd', GAIL: 'GAIL India Ltd',
  GODREJCP: 'Godrej Consumer Products Ltd', HAL: 'Hindustan Aeronautics Ltd', HAVELLS: 'Havells India Ltd',
  HINDPETRO: 'Hindustan Petroleum Corp Ltd', ICICIGI: 'ICICI Lombard General Insurance', ICICIPRULI: 'ICICI Prudential Life Insurance',
  IGL: 'Indraprastha Gas Ltd', IOC: 'Indian Oil Corp Ltd', IRCTC: 'IRCTC Ltd',
  JIOFIN: 'Jio Financial Services Ltd', JSWENERGY: 'JSW Energy Ltd', LICI: 'Life Insurance Corp',
  LUPIN: 'Lupin Ltd', MARICO: 'Marico Ltd', 'MCDOWELL-N': 'United Spirits Ltd',
  MOTHERSON: 'Samvardhana Motherson Ltd', MUTHOOTFIN: 'Muthoot Finance Ltd', NAUKRI: 'Info Edge (Naukri) Ltd',
  NHPC: 'NHPC Ltd', OBEROIRLTY: 'Oberoi Realty Ltd', OFSS: 'Oracle Financial Services',
  PAGEIND: 'Page Industries Ltd', PFC: 'Power Finance Corp Ltd', PNB: 'Punjab National Bank',
  POLYCAB: 'Polycab India Ltd', RECLTD: 'REC Ltd', SBICARD: 'SBI Cards & Payment Services',
  SIEMENS: 'Siemens Ltd', SRF: 'SRF Ltd', TATAELXSI: 'Tata Elxsi Ltd',
  TORNTPHARM: 'Torrent Pharma Ltd', TRENT: 'Trent Ltd', VEDL: 'Vedanta Ltd', ZOMATO: 'Zomato Ltd',
  AUROPHARMA: 'Aurobindo Pharma Ltd', BALKRISIND: 'Balkrishna Industries Ltd', BATAINDIA: 'Bata India Ltd',
  BHEL: 'Bharat Heavy Electricals Ltd', BIOCON: 'Biocon Ltd', CANFINHOME: 'Can Fin Homes Ltd',
  CONCOR: 'Container Corp of India', COROMANDEL: 'Coromandel International Ltd', CROMPTON: 'Crompton Greaves Consumer',
  CUB: 'City Union Bank Ltd', CUMMINSIND: 'Cummins India Ltd', DEEPAKNTR: 'Deepak Nitrite Ltd',
  DELHIVERY: 'Delhivery Ltd', DIXON: 'Dixon Technologies Ltd', EMAMILTD: 'Emami Ltd',
  ESCORTS: 'Escorts Kubota Ltd', EXIDEIND: 'Exide Industries Ltd', FEDERALBNK: 'Federal Bank Ltd',
  FORTIS: 'Fortis Healthcare Ltd', GMRINFRA: 'GMR Airports Infrastructure', GNFC: 'Gujarat Narmada Valley Fertilizers',
  GODREJPROP: 'Godrej Properties Ltd', GSPL: 'Gujarat State Petronet Ltd', IDBI: 'IDBI Bank Ltd',
  IDEA: 'Vodafone Idea Ltd', IDFCFIRSTB: 'IDFC First Bank Ltd', INDHOTEL: 'Indian Hotels Co Ltd',
  INDUSTOWER: 'Indus Towers Ltd', IRFC: 'Indian Railway Finance Corp', JINDALSTEL: 'Jindal Steel & Power Ltd',
  JUBLFOOD: 'Jubilant FoodWorks Ltd', KALYANKJIL: 'Kalyan Jewellers Ltd', KEI: 'KEI Industries Ltd',
  'L&TFH': 'L&T Finance Ltd', LAURUSLABS: 'Laurus Labs Ltd', LICHSGFIN: 'LIC Housing Finance Ltd',
  LTTS: 'L&T Technology Services Ltd', MANAPPURAM: 'Manappuram Finance Ltd', MFSL: 'Max Financial Services Ltd',
  MGL: 'Mahanagar Gas Ltd', MPHASIS: 'Mphasis Ltd', MRF: 'MRF Ltd',
  'NAM-INDIA': 'Nippon Life India AMC Ltd', NATIONALUM: 'National Aluminium Co Ltd', NAVINFLUOR: 'Navin Fluorine International',
  NMDC: 'NMDC Ltd', PERSISTENT: 'Persistent Systems Ltd', PETRONET: 'Petronet LNG Ltd',
  PIIND: 'PI Industries Ltd', PRESTIGE: 'Prestige Estates Projects Ltd', PVRINOX: 'PVR INOX Ltd',
  RAMCOCEM: 'Ramco Cements Ltd', RATNAMANI: 'Ratnamani Metals & Tubes Ltd', SAIL: 'Steel Authority of India Ltd',
  SONACOMS: 'Sona BLW Precision Forgings', STARHEALTH: 'Star Health Insurance Ltd', SUNDARMFIN: 'Sundaram Finance Ltd',
  SUPREMEIND: 'Supreme Industries Ltd', SYNGENE: 'Syngene International Ltd', TATACHEM: 'Tata Chemicals Ltd',
  TATACOMM: 'Tata Communications Ltd', TATAPOWER: 'Tata Power Co Ltd', THERMAX: 'Thermax Ltd',
  TIINDIA: 'Tube Investments of India Ltd', TIMKEN: 'Timken India Ltd', TORNTPOWER: 'Torrent Power Ltd',
  TVSMOTOR: 'TVS Motor Company Ltd', UBL: 'United Breweries Ltd', UNIONBANK: 'Union Bank of India',
  UPL: 'UPL Ltd', VOLTAS: 'Voltas Ltd', WHIRLPOOL: 'Whirlpool of India Ltd',
  ZEEL: 'Zee Entertainment Ltd', ZYDUSLIFE: 'Zydus Lifesciences Ltd',
};

const sectorMap: Record<string, string> = {
  RELIANCE: 'Energy', TCS: 'IT', HDFCBANK: 'Banking', INFY: 'IT', HINDUNILVR: 'FMCG',
  ICICIBANK: 'Banking', KOTAKBANK: 'Banking', BHARTIARTL: 'Telecom', ITC: 'FMCG', SBIN: 'Banking',
  LT: 'Infrastructure', AXISBANK: 'Banking', MARUTI: 'Automobile', BAJFINANCE: 'Finance', HCLTECH: 'IT',
  WIPRO: 'IT', ULTRACEMCO: 'Cement', ADANIPORTS: 'Infrastructure', ONGC: 'Energy', TATAMOTORS: 'Automobile',
  SUNPHARMA: 'Pharma', JSWSTEEL: 'Metals', TATASTEEL: 'Metals', POWERGRID: 'Power', NTPC: 'Power',
  TECHM: 'IT', TITAN: 'Consumer Durables', NESTLEIND: 'FMCG', COALINDIA: 'Mining', BAJAJFINSV: 'Finance',
  'M&M': 'Automobile', HDFCLIFE: 'Insurance', GRASIM: 'Cement', DRREDDY: 'Pharma', BRITANNIA: 'FMCG',
  EICHERMOT: 'Automobile', BPCL: 'Energy', CIPLA: 'Pharma', DIVISLAB: 'Pharma', HEROMOTOCO: 'Automobile',
  'BAJAJ-AUTO': 'Automobile', TATACONSUM: 'FMCG', INDUSINDBK: 'Banking', APOLLOHOSP: 'Healthcare', LTIM: 'IT',
  ADANIENT: 'Infrastructure', HINDALCO: 'Metals', SHRIRAMFIN: 'Finance', ASIANPAINT: 'Consumer Durables', SBILIFE: 'Insurance',
  ABBOTINDIA: 'Healthcare', ADANIGREEN: 'Energy', ADANIPOWER: 'Power', AMBUJACEM: 'Cement', ATGL: 'Energy',
  BANKBARODA: 'Banking', BEL: 'Defence', BERGEPAINT: 'Consumer Durables', BOSCHLTD: 'Automobile', CANBK: 'Banking',
  CHOLAFIN: 'Finance', COLPAL: 'FMCG', DABUR: 'FMCG', DLF: 'Real Estate', GAIL: 'Energy',
  GODREJCP: 'FMCG', HAL: 'Defence', HAVELLS: 'Consumer Durables', HINDPETRO: 'Energy', ICICIGI: 'Insurance',
  ICICIPRULI: 'Insurance', IGL: 'Energy', IOC: 'Energy', IRCTC: 'Travel', JIOFIN: 'Finance',
  JSWENERGY: 'Power', LICI: 'Insurance', LUPIN: 'Pharma', MARICO: 'FMCG', 'MCDOWELL-N': 'FMCG',
  MOTHERSON: 'Automobile', MUTHOOTFIN: 'Finance', NAUKRI: 'IT', NHPC: 'Power', OBEROIRLTY: 'Real Estate',
  OFSS: 'IT', PAGEIND: 'Textile', PFC: 'Finance', PIDILITIND: 'Chemicals', PNB: 'Banking',
  POLYCAB: 'Consumer Durables', RECLTD: 'Finance', SBICARD: 'Finance', SIEMENS: 'Engineering', SRF: 'Chemicals',
  TATAELXSI: 'IT', TORNTPHARM: 'Pharma', TRENT: 'Retail', VEDL: 'Metals', ZOMATO: 'Internet',
  AUROPHARMA: 'Pharma', BALKRISIND: 'Automobile', BATAINDIA: 'Consumer Durables', BHEL: 'Engineering', BIOCON: 'Pharma',
  CANFINHOME: 'Finance', CONCOR: 'Logistics', COROMANDEL: 'Chemicals', CROMPTON: 'Consumer Durables', CUB: 'Banking',
  CUMMINSIND: 'Engineering', DEEPAKNTR: 'Chemicals', DELHIVERY: 'Logistics', DIXON: 'Consumer Durables', EMAMILTD: 'FMCG',
  ESCORTS: 'Automobile', EXIDEIND: 'Automobile', FEDERALBNK: 'Banking', FORTIS: 'Healthcare', GMRINFRA: 'Infrastructure',
  GNFC: 'Chemicals', GODREJPROP: 'Real Estate', GSPL: 'Energy', IDBI: 'Banking', IDEA: 'Telecom',
  IDFCFIRSTB: 'Banking', INDHOTEL: 'Hotels', INDUSTOWER: 'Telecom', IRFC: 'Finance', JINDALSTEL: 'Metals',
  JUBLFOOD: 'FMCG', KALYANKJIL: 'Consumer Durables', KEI: 'Consumer Durables', 'L&TFH': 'Finance', LAURUSLABS: 'Pharma',
  LICHSGFIN: 'Finance', LTTS: 'IT', MANAPPURAM: 'Finance', MFSL: 'Finance', MGL: 'Energy',
  MPHASIS: 'IT', MRF: 'Automobile', 'NAM-INDIA': 'Finance', NATIONALUM: 'Metals', NAVINFLUOR: 'Chemicals',
  NMDC: 'Mining', PERSISTENT: 'IT', PETRONET: 'Energy', PIIND: 'Chemicals', PRESTIGE: 'Real Estate',
  PVRINOX: 'Entertainment', RAMCOCEM: 'Cement', RATNAMANI: 'Metals', SAIL: 'Metals', SONACOMS: 'Automobile',
  STARHEALTH: 'Insurance', SUNDARMFIN: 'Finance', SUPREMEIND: 'Chemicals', SYNGENE: 'Pharma', TATACHEM: 'Chemicals',
  TATACOMM: 'Telecom', TATAPOWER: 'Power', THERMAX: 'Engineering', TIINDIA: 'Engineering', TIMKEN: 'Engineering',
  TORNTPOWER: 'Power', TVSMOTOR: 'Automobile', UBL: 'FMCG', UNIONBANK: 'Banking', UPL: 'Chemicals',
  VOLTAS: 'Consumer Durables', WHIRLPOOL: 'Consumer Durables', ZEEL: 'Media', ZYDUSLIFE: 'Pharma',
};

const industryMap: Record<string, string> = {
  RELIANCE: 'Oil & Gas Refining', TCS: 'IT Services', HDFCBANK: 'Private Banking', INFY: 'IT Services',
  HINDUNILVR: 'Personal Care', ICICIBANK: 'Private Banking', KOTAKBANK: 'Private Banking', BHARTIARTL: 'Telecom Services',
  ITC: 'Cigarettes & FMCG', SBIN: 'Public Banking', LT: 'EPC & Construction', AXISBANK: 'Private Banking',
  MARUTI: 'Passenger Vehicles', BAJFINANCE: 'Consumer Finance', HCLTECH: 'IT Services', WIPRO: 'IT Services',
  ULTRACEMCO: 'Cement Manufacturing', ADANIPORTS: 'Port Services', ONGC: 'Oil Exploration', TATAMOTORS: 'Commercial Vehicles',
  SUNPHARMA: 'Pharma Manufacturing', JSWSTEEL: 'Steel Manufacturing', TATASTEEL: 'Steel Manufacturing', POWERGRID: 'Power Transmission',
  NTPC: 'Power Generation', TECHM: 'IT Services', TITAN: 'Jewellery & Watches', NESTLEIND: 'Packaged Foods',
  COALINDIA: 'Coal Mining', BAJAJFINSV: 'Financial Services', 'M&M': 'Auto & Farm Equipment', HDFCLIFE: 'Life Insurance',
  GRASIM: 'Cement & Textiles', DRREDDY: 'Pharma Manufacturing', BRITANNIA: 'Packaged Foods', EICHERMOT: 'Two-Wheelers',
  BPCL: 'Oil Marketing', CIPLA: 'Pharma Manufacturing', DIVISLAB: 'API Manufacturing', HEROMOTOCO: 'Two-Wheelers',
  'BAJAJ-AUTO': 'Two & Three-Wheelers', TATACONSUM: 'Foods & Beverages', INDUSINDBK: 'Private Banking',
  APOLLOHOSP: 'Hospitals', LTIM: 'IT Services', ADANIENT: 'Conglomerate', HINDALCO: 'Aluminium & Copper',
  SHRIRAMFIN: 'Vehicle Finance', ASIANPAINT: 'Decorative Paints', SBILIFE: 'Life Insurance',
  HAL: 'Aerospace & Defence', BEL: 'Defence Electronics', ZOMATO: 'Food Delivery', DLF: 'Real Estate',
  SIEMENS: 'Industrial Automation', NAUKRI: 'Online Recruitment', TRENT: 'Retail Fashion',
};

const allSymbols = [
  // Nifty 50
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'HINDUNILVR', 'ICICIBANK', 'KOTAKBANK', 'BHARTIARTL', 'ITC', 'SBIN',
  'LT', 'AXISBANK', 'MARUTI', 'BAJFINANCE', 'HCLTECH', 'WIPRO', 'ULTRACEMCO', 'ADANIPORTS', 'ONGC', 'TATAMOTORS',
  'SUNPHARMA', 'JSWSTEEL', 'TATASTEEL', 'POWERGRID', 'NTPC', 'TECHM', 'TITAN', 'NESTLEIND', 'COALINDIA', 'BAJAJFINSV',
  'M&M', 'HDFCLIFE', 'GRASIM', 'DRREDDY', 'BRITANNIA', 'EICHERMOT', 'BPCL', 'CIPLA', 'DIVISLAB', 'HEROMOTOCO',
  'BAJAJ-AUTO', 'TATACONSUM', 'INDUSINDBK', 'APOLLOHOSP', 'LTIM', 'ADANIENT', 'HINDALCO', 'SHRIRAMFIN', 'ASIANPAINT', 'SBILIFE',
  // Nifty Next 50
  'ABBOTINDIA', 'ADANIGREEN', 'ADANIPOWER', 'AMBUJACEM', 'ATGL', 'BANKBARODA', 'BEL', 'BERGEPAINT', 'BOSCHLTD', 'CANBK',
  'CHOLAFIN', 'COLPAL', 'DABUR', 'DLF', 'GAIL', 'GODREJCP', 'HAL', 'HAVELLS', 'HINDPETRO', 'ICICIGI',
  'ICICIPRULI', 'IGL', 'IOC', 'IRCTC', 'JIOFIN', 'JSWENERGY', 'LICI', 'LUPIN', 'MARICO', 'MCDOWELL-N',
  'MOTHERSON', 'MUTHOOTFIN', 'NAUKRI', 'NHPC', 'OBEROIRLTY', 'OFSS', 'PAGEIND', 'PFC', 'PIDILITIND', 'PNB',
  'POLYCAB', 'RECLTD', 'SBICARD', 'SIEMENS', 'SRF', 'TATAELXSI', 'TORNTPHARM', 'TRENT', 'VEDL', 'ZOMATO',
  // Nifty Midcap 100
  'AUROPHARMA', 'BALKRISIND', 'BATAINDIA', 'BHEL', 'BIOCON', 'CANFINHOME', 'CONCOR', 'COROMANDEL', 'CROMPTON', 'CUB',
  'CUMMINSIND', 'DEEPAKNTR', 'DELHIVERY', 'DIXON', 'EMAMILTD', 'ESCORTS', 'EXIDEIND', 'FEDERALBNK', 'FORTIS', 'GMRINFRA',
  'GNFC', 'GODREJPROP', 'GSPL', 'IDBI', 'IDEA', 'IDFCFIRSTB', 'INDHOTEL', 'INDUSTOWER', 'IRFC', 'JINDALSTEL',
  'JUBLFOOD', 'KALYANKJIL', 'KEI', 'L&TFH', 'LAURUSLABS', 'LICHSGFIN', 'LTTS', 'MANAPPURAM', 'MFSL', 'MGL',
  'MOTHERSON', 'MPHASIS', 'MRF', 'NAM-INDIA', 'NATIONALUM', 'NAVINFLUOR', 'NMDC', 'PERSISTENT', 'PETRONET', 'PIIND',
  'PRESTIGE', 'PVRINOX', 'RAMCOCEM', 'RATNAMANI', 'SAIL', 'SONACOMS', 'STARHEALTH', 'SUNDARMFIN', 'SUPREMEIND', 'SYNGENE',
  'TATACHEM', 'TATACOMM', 'TATAPOWER', 'THERMAX', 'TIINDIA', 'TIMKEN', 'TORNTPOWER', 'TVSMOTOR', 'UBL', 'UNIONBANK',
  'UPL', 'VOLTAS', 'WHIRLPOOL', 'ZEEL', 'ZYDUSLIFE',
];

function buildStockList(): StockInfo[] {
  const seen = new Set<string>();
  const stocks: StockInfo[] = [];
  for (const sym of allSymbols) {
    if (seen.has(sym)) continue;
    seen.add(sym);
    stocks.push({
      symbol: sym,
      name: nameMap[sym] || sym,
      sector: sectorMap[sym] || '',
      industry: industryMap[sym] || '',
      isActive: true,
    });
  }
  return stocks;
}

export const NSE_STOCKS: StockInfo[] = buildStockList();

export function getUniqueSectors(stocks: StockInfo[]): string[] {
  return [...new Set(stocks.map(s => s.sector).filter(Boolean))].sort();
}

export function searchStocks(stocks: StockInfo[], query: string): StockInfo[] {
  const q = query.toLowerCase();
  return stocks.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
}
