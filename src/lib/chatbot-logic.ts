export type RequestTag = 
  | "COURROIE" 
  | "ROULEMENT" 
  | "DEVIS" 
  | "PIECE" 
  | "URGENT" 
  | "TECHNIQUE" 
  | "HORS_STANDARD"
  | "A_VERIFIER";



export interface ChatbotData {
  flowType: string | null;
  productType?: string;
  reference?: string;
  dimensions?: string;
  brand?: string;
  quantity?: string;
  application?: string;
  equipmentType?: string;
  issueDescription?: string;
  location?: string;
  urgency?: string;
  hasPhoto?: boolean;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactCompany?: string;
  tags: RequestTag[];
  aiAnalysis?: string;
  completionScore?: number;
  whatsAppUrl?: string;
}

export interface StoredRequest extends ChatbotData {
  id: string;
  createdAt: string;
  status: "NEW" | "IN_PROGRESS" | "CLOSED";
}

// Store in localStorage for rapid prototyping
export const saveRequest = (data: ChatbotData) => {
  if (typeof window === 'undefined') return;
  const existingStr = localStorage.getItem('snimop_requests');
  const existing: StoredRequest[] = existingStr ? JSON.parse(existingStr) : [];
  
  const newReq: StoredRequest = {
    ...data,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    status: "NEW"
  };
  
  localStorage.setItem('snimop_requests', JSON.stringify([...existing, newReq]));
};

export const getRequests = (): StoredRequest[] => {
  if (typeof window === 'undefined') return [];
  const existingStr = localStorage.getItem('snimop_requests');
  return existingStr ? JSON.parse(existingStr) : [];
};

export const generateWhatsAppLink = (data: ChatbotData, userMessages: string[]): string => {
  const number = process.env.NEXT_PUBLIC_SNIMOP_WHATSAPP_NUMBER || "33607877159"; 
  
  let estimatedType = "";
  if (data.flowType === "courroie") estimatedType = "Courroie";
  else if (data.flowType === "roulement") estimatedType = "Roulement";
  else estimatedType = data.flowType || "";

  // Remove coords and UI commands from the messages to create a pure technical string
  const cleanMessages = userMessages.filter(m => 
    !m.includes("Je n'ai pas toutes les informations") && 
    !m.includes("Envoyer quand même") &&
    !m.includes("Identifier") && 
    !m.includes("Recherche") &&
    !m.includes("Demande de devis") &&
    !m.includes("[Photo") &&
    !m.includes("Comparaison") &&
    !(data.contactPhone && m.includes(data.contactPhone)) &&
    !(data.contactName && m.includes(data.contactName)) &&
    !(data.contactCompany && m.includes(data.contactCompany))
  );

  const fullText = cleanMessages.join(" ");

  let productName = estimatedType || "Non renseigné";
  if (data.tags.includes("COURROIE")) productName = "Courroie";
  else if (data.tags.includes("ROULEMENT")) productName = "Roulement";
  else if (data.flowType === "devis") productName = "Devis";
  else if (data.flowType === "piece" && data.productType) productName = data.productType;

  // Strict Parsing Variables
  let parsedDimensions = data.dimensions || "";
  let parsedLength = "";
  let parsedQuantity = data.quantity || "";

  if (data.tags.includes("COURROIE")) {
    const dimMatch = fullText.match(/\b(\d+)[xX*](\d+)\b/);
    if (dimMatch) {
       parsedDimensions = `${dimMatch[1]}x${dimMatch[2]}`;
    } else {
       const profileMatch = fullText.match(/\b(spz|spa|spb|spc|xpz|xpa|xpb|xpc|t5|t10|at10|8m|14m|ax|bx|cx|dx|[a-e]|3l|4l|5l)\b/i);
       if (profileMatch) parsedDimensions = profileMatch[1].toUpperCase();
    }
    
    const lengthMatch = fullText.match(/\b(li|le|ld)?\s*(\d{3,})\s*(li|le|ld)?\b/i);
    if (lengthMatch) {
       const prefix = lengthMatch[1] ? lengthMatch[1].toUpperCase() + " " : "";
       const suffix = lengthMatch[3] ? " " + lengthMatch[3].toUpperCase() : "";
       parsedLength = `${prefix}${lengthMatch[2]}${suffix}`.trim();
    }
    
    const qtyMatch = fullText.match(/\b(\d+)\s*(p[iieè]{1,2}ce?s?|qt[ée]|unit[ée]s?)\b/i);
    if (qtyMatch) {
       parsedQuantity = qtyMatch[1];
    } else {
       const possibleNumbers = fullText.match(/\b(\d{1,2})\b/g);
       if (possibleNumbers) {
          const cleanNumbers = possibleNumbers.filter(n => !(dimMatch && (n === dimMatch[1] || n === dimMatch[2])));
          if (cleanNumbers.length > 0) parsedQuantity = cleanNumbers[cleanNumbers.length - 1];
       }
    }
  } else if (data.tags.includes("ROULEMENT")) {
    const dimMatch = fullText.match(/\b(\d+)[xX*](\d+)[xX*](\d+)\b/);
    if (dimMatch) parsedDimensions = `${dimMatch[1]}x${dimMatch[2]}x${dimMatch[3]}`;
    const numMatch = fullText.match(/\b(6[023]\d{2}|22[23]\d{2}|30[23]\d{2}|32[02]\d{2})\b/);
    if (numMatch && !parsedDimensions) parsedDimensions = numMatch[1];
    
    const qtyMatch = fullText.match(/\b(\d+)\s*(p[iieè]{1,2}ce?s?|qt[ée]|unit[ée]s?)\b/i);
    if (qtyMatch) parsedQuantity = qtyMatch[1];
    else {
       const possibleNumbers = fullText.match(/\b(\d{1,2})\b/g);
       if (possibleNumbers) {
          const cleanNumbers = possibleNumbers.filter(n => !(dimMatch && (n === dimMatch[1] || n === dimMatch[2] || n === dimMatch[3])));
          if (cleanNumbers.length > 0) parsedQuantity = cleanNumbers[cleanNumbers.length - 1];
       }
    }
  }

  const reqType = data.flowType === 'devis' ? 'Devis' : (data.flowType === 'inconnu' ? 'Conseil' : 'Pièce');

  let text = `— DEMANDE CLIENT SNIMOP —\n\n`;
  text += `Type : ${reqType}\n`;
  text += `Produit : ${productName}\n\n`;
  
  if (parsedDimensions || data.reference) {
     if (data.reference && !parsedDimensions) text += `Référence : ${data.reference}\n`;
     if (parsedDimensions) text += `Dimensions : ${parsedDimensions}\n`;
  } else if (!data.tags.includes("COURROIE") && !data.tags.includes("ROULEMENT")) {
     text += `Informations : ${fullText || "Non renseignées"}\n`;
  }
  
  if (data.tags.includes("COURROIE")) {
     text += `Longueur : ${parsedLength || "Non renseignée"}\n`;
  }
  
  text += `Quantité : ${parsedQuantity || "Non renseignée"}\n\n`;
  text += `Application : ${data.application || "Non renseigné"}\n`;
  text += `Photo : ${data.hasPhoto ? "Oui" : "Non"}\n\n`;

  text += `— COORDONNÉES —\n`;
  text += `Nom : ${data.contactName || "Non renseigné"}\n`;
  text += `Société : ${data.contactCompany || "Non renseignée"}\n`;
  text += `Téléphone : ${data.contactPhone || "Non renseigné"}\n`;
  
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

export const calculateCompletionScore = (data: ChatbotData, userMessages: string[]): number => {
  let score = 30; // base score for starting
  if (data.tags.length > 0) score += 10;
  if (data.aiAnalysis) score += 20;
  if (data.hasPhoto) score += 20;
  
  const cleanMessages = userMessages.filter(m => 
    !m.includes("Je n'ai pas toutes les informations") && 
    !m.includes("Identifier") && 
    !m.includes("Recherche") &&
    !m.includes("Demande de devis")
  );

  const totalLength = cleanMessages.join(" ").length;
  if (totalLength > 15) score += 10;
  if (totalLength > 40) score += 10; // more details means higher score

  return Math.min(score, 100);
};

// ==========================================
// BUSINESS LOGIC & REGEX PARSING
// ==========================================

export const analyzeBelt = (input: string): { matches: boolean; message: string; tags: RequestTag[]; needsCascade: boolean; detectedType?: string } => {
  const rawInputLow = input.toLowerCase();
  
  let tags: RequestTag[] = ["COURROIE", "TECHNIQUE"];
  let message = "";
  let needsCascade = false;
  let detectedType = "Courroie";

  const isCourroieContext = rawInputLow.includes("courroi") || rawInputLow.includes("compresseur") || rawInputLow.includes("voiture") || rawInputLow.includes("poulie") || rawInputLow.includes("ventilateur") || rawInputLow.includes("cassée") || rawInputLow.includes("cassé") || rawInputLow.includes("cassé");

  // Dimensions : largeur x hauteur 
  const dimRegex = /(?<!\d\s*[xX*]\s*)\b(\d+)\s*[xX*]\s*(\d+)\b(?!\s*[xX*]\s*\d)/;
  const matchDim = rawInputLow.match(dimRegex);

  // Profils explicites type A, B, C, SPZ, XPZ, AX, 3L...
  const profileRegex = /\b(spz|spa|spb|spc|xpz|xpa|xpb|xpc|t5|t10|at10|8m|14m|ax|bx|cx|dx|3l|4l|5l)\b/i;
  let matchProfile = rawInputLow.match(profileRegex);

  // Pour les profils à une lettre (A, B, C, Z, E), on sécurise contre les apostrophes ("c'est") ou les "a"
  const singleLetterRegex = /(?:profil|section|type|courroie)\s+([a-ez])\b/i;
  const matchSingleLetter = rawInputLow.match(singleLetterRegex);
  if (!matchProfile && matchSingleLetter) {
      matchProfile = matchSingleLetter;
  }

  // Catch things like A50, B60 directly
  const letterMatch = rawInputLow.match(/\b([a-z])\s*(\d{2,})\b/i);
  
  // Length
  const lengthMatch = rawInputLow.match(/\b(li|le|ld|la)?\s*(\d{3,})\s*(li|le|ld|la)?\b/i);
  let lengthStr = "";
  let lengthType = "";
  if (lengthMatch) {
     lengthStr = lengthMatch[2];
     lengthType = lengthMatch[1] || lengthMatch[3] || "";
  }

  // Quantity
  const qtyMatch = rawInputLow.match(/\b(\d+)\s*(p[iieè]{1,2}ce?s?|qt[ée]?|unit[ée]s?)\b/i) || rawInputLow.match(/qt[ée]?\s*(\d+)/i) || rawInputLow.match(/quantit[ée]\s*(\d+)/i);
  let qtyStr = "";
  if (qtyMatch) qtyStr = qtyMatch[1];

  let probableProfile = "";

  if (matchDim) {
    const width = parseInt(matchDim[1], 10);
    const height = parseInt(matchDim[2], 10);
    
    if (width === 13 && height === 8) probableProfile = "A";
    else if (width === 13 && height === 10) probableProfile = "SPA";
    else if (width === 17 && height === 11) probableProfile = "B";
    else if ((width === 16 && height === 13) || (width === 17 && height === 14)) probableProfile = "SPB";
    else if (width === 10 && height === 6) probableProfile = "Z";
    else if (width === 10 && height === 8) probableProfile = "SPZ";
    else if (width === 22 && height === 14) probableProfile = "C";
    else if (width === 22 && height === 18) probableProfile = "SPC";
  } else if (matchProfile) {
    probableProfile = matchProfile[1].toUpperCase();
  } else if (letterMatch && ['a','b','c','z'].includes(letterMatch[1])) {
    probableProfile = letterMatch[1].toUpperCase();
    lengthStr = letterMatch[2]; // implicit length
  }

  // If we have a full identification:
  if (probableProfile && lengthStr) {
     const lenPart = lengthType ? `${lengthType.toUpperCase()} ${lengthStr}` : `${lengthStr}`;
     const dimText = matchDim ? ` section ${matchDim[1]}x${matchDim[2]}` : ``;
     const finalProfileText = matchDim ? ` profil ${probableProfile}` : ` profil ${probableProfile}`;
     const dimDesc = dimText + finalProfileText;
     const qtyText = qtyStr ? `, quantité ${qtyStr}` : "";
     
     message = `Vous recherchez : une courroie trapézoïdale${dimDesc} longueur ${lenPart} mm${qtyText}.`;
     
     if (!qtyStr) {
         needsCascade = true;
         message += "\n\nQuelle quantité souhaitez-vous ?";
     }
     return { matches: true, message, tags, needsCascade, detectedType };
  }

  // If only dimensions or profile
  if (probableProfile) {
    message = `D’après vos dimensions, cela correspond probablement à une courroie profil ${probableProfile}.`;
    
    if (probableProfile === "A") message += "\nProfils proches possibles : SPA, 4L.";
    else if (probableProfile === "B") message += "\nProfils proches possibles : SPB, 5L.";
    else if (probableProfile === "Z") message += "\nProfils proches possibles : SPZ, 3L.";
    
    message += "\nSouhaitez-vous que je vous propose un modèle compatible ? Pouvez-vous préciser la longueur (idéalement Li, Le ou Ld) ?";
    needsCascade = true;
    return { matches: true, message, tags, needsCascade, detectedType };
  }

  // If context but no strict dims:
  if (isCourroieContext) {
     if (rawInputLow.includes("compresseur")) {
        message = "Dans ce type d’application, il s’agit généralement d’une courroie trapézoïdale ou poly-V.\nPouvez-vous me donner la largeur ou la longueur ?";
     } else if (rawInputLow.includes("voiture") || rawInputLow.includes("auto")) {
        message = "Dans le domaine automobile, il s'agit généralement d'une courroie d'accessoire (poly-V) ou de distribution (crantée).\nPouvez-vous me donner une largeur ou une référence ?";
     } else if (rawInputLow.includes("cassée") || rawInputLow.includes("pas de ref") || rawInputLow.includes("inconnu") || rawInputLow.includes("plus de reference") || rawInputLow.includes("illisible")) {
        message = "Vous pouvez utiliser une corde ou un mètre souple : \nfaites le tour complet des poulies en fond de gorge pour obtenir une longueur approximative.\n\nPouvez-vous me donner cette mesure ?";
     } else {
        message = "Vous recherchez une courroie.\nVous pouvez mesurer avec une corde en faisant le tour des poulies (en fond de gorge) pour obtenir une longueur approximative.\nPouvez-vous me donner cette mesure ou une référence ?";
     }
     needsCascade = true;
     return { matches: true, message, tags, needsCascade, detectedType };
  }

  return { matches: false, message: "", tags: [], needsCascade: false };
};


export const analyzeBearing = (input: string): { matches: boolean; message: string; tags: RequestTag[]; needsCascade: boolean; detectedType?: string } => {
  const rawInputLow = input.toLowerCase();

  // If belt prioritized
  if (rawInputLow.includes("courroi") || rawInputLow.includes("compresseur") || rawInputLow.includes("poulie") || rawInputLow.includes("cassée")) {
     return { matches: false, message: "", tags: [], needsCascade: false };
  }

  let tags: RequestTag[] = ["ROULEMENT", "TECHNIQUE"];
  let message = "";
  let needsCascade = false;
  let detectedType = "Roulement";

  // Dimensions : int x ext x epaisseur
  const dimRegex = /\b(\d+)\s*[xX*]\s*(\d+)\s*[xX*]\s*(\d+)\b/;
  const matchDim = rawInputLow.match(dimRegex);
  
  let likelyType = "";

  if (matchDim) {
    const int = matchDim[1];
    const ext = matchDim[2];
    const ep = matchDim[3];
    
    if (int === "12" && ext === "32" && ep === "10") likelyType = "6201";
    else if (int === "15" && ext === "35" && ep === "11") likelyType = "6202";
    else if (int === "17" && ext === "40" && ep === "12") likelyType = "6203";
    else if (int === "20" && ext === "47" && ep === "14") likelyType = "6204";
    else if (int === "25" && ext === "52" && ep === "15") likelyType = "6205";
    else if (int === "30" && ext === "62" && ep === "16") likelyType = "6206";
    else if (int === "35" && ext === "72" && ep === "17") likelyType = "6207";
    else if (int === "40" && ext === "80" && ep === "18") likelyType = "6208";
    else if (int === "30" && ext === "72" && ep === "19") likelyType = "6306";
  }
  
  // Try finding strict bearing numbers if no dimensions matched
  const numRegex = /(6[023]\d{2}|22[23]\d{2}|30[23]\d{2}|32[02]\d{2})/;
  const matchNum = input.match(numRegex);
  if (matchNum && !likelyType) {
    likelyType = matchNum[1];
  }

  if (likelyType) {
    let baseFormat = `Vous recherchez un roulement ${likelyType}.`;
    
    // Suffx parsing
    let suffixText = "";
    if (rawInputLow.includes('2rs') || rawInputLow.includes('ddu') || rawInputLow.includes('llu')) {
       suffixText = " en version étanche (2RS / DDU / LLU).";
    } else if (rawInputLow.includes('zz')) {
       suffixText = " en version avec flasques métal (ZZ).";
    }

    if (suffixText) {
       message = baseFormat.replace(".", suffixText) + "\n\nNous pouvons vous proposer 3 gammes : économique (ZEN / générique), standard (NTN / SNR) ou premium (SKF / FAG).\n\nQuelle quantité souhaitez-vous ?";
    } else {
       message = baseFormat + "\n\nSouhaitez-vous une version étanche (2RS), flasque métal (ZZ) ou ouverte ?\n\nNous pouvons vous proposer 3 gammes : économique, standard ou premium.\n\nQuelle quantité souhaitez-vous ?";
    }
    
    needsCascade = true;
    return { matches: true, message, tags, needsCascade, detectedType };
  }

  // Handle incoherent refs
  if (input.match(/\b([A-Z]*\d{5,}[A-Z]*)\b/)) {
     message = "Cette référence ne correspond pas à un standard connu, mais nous pouvons vous proposer un équivalent.\nPourriez-vous nous donner les dimensions (intérieur x extérieur x épaisseur) ?";
     needsCascade = true;
     return { matches: true, message, tags, needsCascade, detectedType };
  }

  if (rawInputLow.includes("bruit sur axe") || rawInputLow.includes("roulement")) {
      message = "Dans ce type d’application, il s’agit généralement d’une usure du roulement.\nVous pouvez nous fournir les dimensions (intérieur x extérieur x épaisseur) ou la référence gravée sur la bague ?";
      needsCascade = true;
      return { matches: true, message, tags, needsCascade, detectedType };
  }
  
  return { matches: false, message: "", tags: [], needsCascade: false };
};

export const analyzeGeneral = (input: string): { matches: boolean; message: string; tags: RequestTag[]; needsCascade: boolean; detectedType?: string } => {
  const normInput = input.toLowerCase();
  
  if (normInput.match(/ucp|ucf|ucfl|uct|ucfc|insert uc|palier/)) {
    let msg = "Vous recherchez un palier.";
    if (normInput.match(/arbre 20|20\s*mm/)) {
      msg = "Vous recherchez un palier série 204 (alésage 20 mm). Il est interchangeable toutes marques.";
    } else if (normInput.match(/arbre 25|25\s*mm/) || normInput.match(/205/)) {
      msg = "Vous recherchez un palier série 205 (alésage 25 mm). Il est interchangeable toutes marques.";
    } else {
      msg = "Vous recherchez un palier.";
    }
    return {
      matches: true,
      message: msg + "\n\nPour éviter toute erreur, merci de nous préciser s'il s'agit d'un palier semelle (UCP), à bride carrée (UCF), ovale (UCFL), ou de nous envoyer une photo.\n\nQuelle quantité souhaitez-vous ?",
      tags: ["PIECE", "TECHNIQUE"],
      needsCascade: true,
      detectedType: "Palier"
    };
  }

  if (normInput.match(/chc|th|tf|btr|six pans creux|inox|8\.8|10\.9|12\.9|m[68]0?|vis|visserie/)) {
    return {
      matches: true,
      message: "[Identification probable]\nCela correspond probablement à de la visserie.\n\nPour éviter toute erreur, merci de nous préciser :\n- le diamètre (M6, M8, M10…)\n- la longueur\n- le type de tête (CHC, TH, TF…)\n- la matière ou classe (inox, 8.8...) si utile.\nVous pouvez aussi nous envoyer une photo.",
      tags: ["PIECE", "TECHNIQUE"],
      needsCascade: true,
      detectedType: "Visserie"
    };
  }
  
  if (normInput.match(/accouplement|flector|étoile|moyeu|rotex|hrc|n-eupex/)) {
    return {
      matches: true,
      message: "Cela correspond probablement à un accouplement.\n\nPour éviter toute erreur, merci de nous préciser la marque de l'accouplement, les diamètres de l'arbre, ou de nous envoyer des photos des moyeux et/ou du flector central.",
      tags: ["PIECE", "TECHNIQUE"],
      needsCascade: true,
      detectedType: "Accouplement"
    };
  }
  
  if (normInput.match(/pneumatique|verin|distributeur|raccord|festo|smc|électrovanne/)) {
    return {
      matches: true,
      message: "Cela correspond probablement à un composant pneumatique.\n\nPour éviter toute erreur, merci de nous préciser la marque, la référence exacte présente sur l'étiquette, ou la fonction de la pièce (taille des filetages/orifices).\nVous pouvez par ailleurs nous envoyer la photo de la plaque signalétique.",
      tags: ["PIECE", "TECHNIQUE"],
      needsCascade: true,
      detectedType: "Pneumatique"
    };
  }

  if (normInput.match(/filtre|filtration|cartouche|élément filtrant|hydraulique|air/)) {
    return {
      matches: true,
      message: "Cela correspond probablement à un élément de filtration.\n\nPour éviter toute erreur, merci de nous préciser s'il s'agit d'un filtre à air, à huile, ou hydraulique. Les dimensions exactes ou la référence de la machine/cartouche nous sont indispensables.",
      tags: ["PIECE", "TECHNIQUE"],
      needsCascade: true,
      detectedType: "Filtre"
    };
  }

  return { matches: false, message: "", tags: [], needsCascade: false };
};

export const compareBelt = (profile: string, lengthType: string, value: number): {  message: string, equivalent: string } => {
  let li = 0, le = 0, ld = 0;
  
  // Standard conversion constants by profile
  const conversions: Record<string, {liToLd: number, liToLe: number}> = {
    "SPA": {liToLd: 45, liToLe: 63},
    "XPA": {liToLd: 45, liToLe: 63},
    "SPB": {liToLd: 60, liToLe: 82},
    "XPB": {liToLd: 60, liToLe: 82},
    "SPC": {liToLd: 83, liToLe: 113},
    "XPC": {liToLd: 83, liToLe: 113},
    "SPZ": {liToLd: 37, liToLe: 51},
    "XPZ": {liToLd: 37, liToLe: 51},
    "A": {liToLd: 30, liToLe: 50},
    "AX": {liToLd: 30, liToLe: 50},
    "4L": {liToLd: 30, liToLe: 50},
    "B": {liToLd: 43, liToLe: 69},
    "BX": {liToLd: 43, liToLe: 69},
    "5L": {liToLd: 43, liToLe: 69},
    "C": {liToLd: 58, liToLe: 88},
    "Z": {liToLd: 22, liToLe: 38},
    "3L": {liToLd: 22, liToLe: 38},
  };

  const map = conversions[profile] || {liToLd: 30, liToLe: 50}; // Default fallback

  // Calculate Li, Le, Ld from given input
  if (lengthType === "Li") {
    li = value;
    ld = value + map.liToLd;
    le = value + map.liToLe;
  } else if (lengthType === "Ld") {
    ld = value;
    li = value - map.liToLd;
    le = li + map.liToLe;
  } else if (lengthType === "Le") {
    le = value;
    li = value - map.liToLe;
    ld = li + map.liToLd;
  }

  let famProfile = "";
  let warning = "⚠️ *équivalence possible sous réserve.*";
  
  if (profile === "3L") famProfile = "Z (équivalence possible sous réserve)";
  if (profile === "Z") famProfile = "3L (équivalence à confirmer selon la poulie)";
  
  if (profile === "4L") famProfile = "A (équivalence possible sous réserve)";
  if (profile === "A") famProfile = "SPZ (équivalence à confirmer selon la poulie, SPZ ≠ A direct)";
  if (profile === "AX") famProfile = "A crantée (équivalence possible sous réserve)";

  if (profile === "5L") famProfile = "B (équivalence possible sous réserve)";
  if (profile === "B") famProfile = "SPB (équivalence à confirmer selon la poulie, SPB ≠ B direct)";
  if (profile === "BX") famProfile = "B crantée (équivalence possible sous réserve)";

  if (profile === "C") famProfile = "SPC (équivalence à confirmer selon la poulie)";

  if (profile === "XPZ") famProfile = "SPZ crantée (AVX10 automobile est différent - équivalence à confirmer)";
  if (profile === "XPA") famProfile = "SPA crantée (AVX13 automobile est différent - équivalence à confirmer)";
  if (profile === "XPB") famProfile = "SPB crantée (AVX17 automobile est différent - équivalence à confirmer)";
  if (profile === "XPC") famProfile = "SPC crantée (équivalence possible sous réserve)";

  if (!famProfile) famProfile = `${profile} (Standard)`;

  const targetSuffix = ["SPA", "SPB", "SPC", "SPZ", "XPA", "XPB", "XPC", "XPZ", "A", "B", "C", "Z", "AX", "BX"].includes(profile) ? "Li" : "Ld";
  const refLength = targetSuffix === "Li" ? li : ld;
  
  const equivalent = `${profile} ${Math.round(refLength)} ${targetSuffix}`;

  return {
    equivalent,
    message: `[À confirmer]\nProfil : **${profile}**\nSaisie : **${value} ${lengthType}**\n\n→ Li : **${Math.round(li)}**\n→ Le : **${Math.round(le)}**\n→ Ld : **${Math.round(ld)}**\n\n→ équivalent : **${famProfile}**\n\n${warning}`
  };
};

export const compareBeltReverse = (width: number, height: number, lengthType: string, value: number): { message: string, equivalent: string } => {
  let probableProfiles: string[] = [];

  if (width === 13 && height === 8) probableProfiles = ["A", "4L", "AX"];
  else if (width === 13 && height === 10) probableProfiles = ["SPA", "XPA"];
  else if (width === 17 && height === 11) probableProfiles = ["B", "5L", "BX"];
  else if ((width === 16 && height === 13) || (width === 17 && height === 14)) probableProfiles = ["SPB", "XPB"];
  else if (width === 10 && height === 6) probableProfiles = ["Z", "3L", "ZX"];
  else if (width === 10 && height === 8) probableProfiles = ["SPZ", "XPZ"];
  else if (width === 22 && height === 14) probableProfiles = ["C", "CX"];
  else if (width === 22 && height === 18) probableProfiles = ["SPC", "XPC"];

  if (probableProfiles.length === 0) {
     return {
       equivalent: "",
       message: `[À confirmer]\nSaisie : **${width}x${height} mm** - **${value} ${lengthType}**\n\nAucun profil standard direct trouvé pour ces dimensions.\n\n⚠️ *Les dimensions seules peuvent correspondre à plusieurs profils, une confirmation avec une marque ou l'application est recommandée.*`
     };
  }

  const mainProfile = probableProfiles[0];
  const others = probableProfiles.slice(1).join(", ");
  
  // Reuse existing logic to calculate Ld, Li, Le for the main profile
  const converted = compareBelt(mainProfile, lengthType, value);
  const convParts = converted.message.match(/→ Li : \*\*\d+\*\*\n→ Le : \*\*\d+\*\*\n→ Ld : \*\*\d+\*\*/);
  const convText = convParts ? `\n\nConversions probables pour le profil ${mainProfile} :\n${convParts[0]}\n` : "";

  let resultMsg = `[Identification probable]\nSaisie : **${width}x${height} mm** - **${value} ${lengthType}**\n\n→ Profil le plus probable : **${mainProfile}**\nProfils proches (crantés / US) : **${others}**${convText}\n\n⚠️ *Les dimensions seules peuvent correspondre à plusieurs profils, une confirmation est recommandée.*`;

  return {
    equivalent: `${mainProfile} ${Math.round(value)} ${lengthType}`,
    message: resultMsg
  };
};
