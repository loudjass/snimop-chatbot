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
  
  // Extracting likely product type
  let estimatedType = "";
  if (data.flowType === "courroie") estimatedType = "Courroie";
  else if (data.flowType === "roulement") estimatedType = "Roulement";
  else estimatedType = data.flowType || "";

  // Finding some keywords from AI analysis if available, but keeping it as a "Type/Section probable" plain string
  let probableMatch = "";
  if (data.aiAnalysis) {
    if (data.aiAnalysis.includes("section A")) probableMatch = "Section A";
    else if (data.aiAnalysis.includes("section B")) probableMatch = "Section B";
    else if (data.aiAnalysis.includes("6205")) probableMatch = "6205";
    else if (data.aiAnalysis.includes("6306")) probableMatch = "6306";
  }

  // Very basic extraction for the template, relying mostly on the raw messages if we can't parse easily
  // Since we don't have strict entity extraction yet, we'll join the non-command messages 
  // and dump them into a generic "Détails" section, while keeping the requested template structure.
  
  const cleanMessages = userMessages.filter(m => 
    !m.includes("Je n'ai pas toutes les informations") && 
    !m.includes("Envoyer quand même ma demande") &&
    !m.includes("Identifier") && 
    !m.includes("Recherche") &&
    !m.includes("Demande de devis") &&
    !m.includes("[Photo")
  );

  let detailsText = cleanMessages.join(" | ");

  let productName = estimatedType || "[Non spécifié]";
  if (data.tags.includes("COURROIE")) productName = "Courroie";
  else if (data.tags.includes("ROULEMENT")) productName = "Roulement";
  else if (data.flowType === "devis") productName = "Demande de devis";
  
  let formattedDetails = detailsText || "[Non spécifié]";

  let text = `--- DEMANDE CLIENT SNIMOP ---\n\n`;
  text += `Produit : ${productName}\n`;
  text += `Désignation : ${probableMatch ? probableMatch : (data.flowType === 'devis' ? "Devis d'intervention" : formattedDetails)}\n`;
  text += `Dimensions : ${detailsText ? detailsText : "[Non fournies]"}\n`;
  text += `Quantité : [Si fournie]\n`;
  text += `Application : [Si fournie]\n\n`;

  text += `--- COORDONNÉES ---\n\n`;
  text += `Nom : \n`;
  text += `Société : \n`;
  text += `Téléphone : \n\n`;
  text += `Photo : ${data.hasPhoto ? "Oui" : "Non"}`;
  
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
  const normInput = input.toLowerCase().replace(/ /g, '');
  
  let tags: RequestTag[] = ["COURROIE", "TECHNIQUE"];
  let message = "";
  let needsCascade = false;
  let detectedType = "Courroie";

  // Dimensions : largeur x hauteur
  const dimRegex = /(\d+)[xX*](\d+)/;
  const matchDim = normInput.match(dimRegex);

  let probableProfile = "";

  if (matchDim) {
    const width = parseInt(matchDim[1], 10);
    const height = parseInt(matchDim[2], 10);
    
    if ((width >= 12 && width <= 14) && (height >= 7 && height <= 9)) {
      probableProfile = "A ou SPA";
    } else if ((width >= 16 && width <= 18) && (height >= 10 && height <= 12)) {
      probableProfile = "B ou SPB";
    } else if (width === 10 && height === 6) {
      probableProfile = "Z ou SPZ";
    } else if (width === 22 && height === 14) {
      probableProfile = "C ou SPC";
    }
    
    if (probableProfile) {
       message = `La dimension ${width}x${height} correspond au profil probable d'une courroie de type ${probableProfile}.`;
    } else {
       message = `Les dimensions ${width}x${height} correspondent probablement à une section spécifique de courroie.`;
    }
  }

  // Profils explicites
  const profileRegex = /(spz|spa|spb|spc|xpz|xpa|xpb|xpc|t5|t10|at10|8m|14m)/;
  const matchProfile = normInput.match(profileRegex);
  
  if (matchProfile) {
    const p = matchProfile[1].toUpperCase();
    if (p.startsWith('SP') || p.startsWith('XP')) {
      message = `Cela correspond probablement à une courroie trapézoïdale de profil ${p}.`;
    } else {
      message = `Cela correspond probablement à une courroie crantée / synchrone de pas ${p}.`;
    }
  } else if (normInput.match(/^[a-z]\d{2,}/)) {
      // Catch things like A32, B40
      const letterMatch = normInput.match(/^([a-z])(\d{2,})/);
      if (letterMatch) {
         message = `Cela correspond probablement à une courroie trapézoïdale classique type ${letterMatch[1].toUpperCase()}${letterMatch[2]}.`;
      }
  }

  if (message) {
    needsCascade = true;
    message += "\n\nPour éviter toute erreur, merci de nous préciser la longueur (idéalement préciser Li, Le ou Ld si connu) ou la référence complète.\nVous pouvez aussi nous envoyer une photo.";
    return { matches: true, message, tags, needsCascade, detectedType };
  }
  
  return { matches: false, message: "", tags: [], needsCascade: false };
};


export const analyzeBearing = (input: string): { matches: boolean; message: string; tags: RequestTag[]; needsCascade: boolean; detectedType?: string } => {
  const normInput = input.toLowerCase().replace(/ /g, '');
  let tags: RequestTag[] = ["ROULEMENT", "TECHNIQUE"];
  let message = "";
  let needsCascade = false;
  let detectedType = "Roulement";

  // Dimensions : int x ext x epaisseur
  const dimRegex = /(\d+)[xX*](\d+)[xX*](\d+)/;
  const matchDim = normInput.match(dimRegex);
  
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
    message = `Cela correspond probablement à un roulement type ${likelyType}.`;
  }

  // Suffixes (2RS, ZZ, C3)
  if (normInput.includes('2rs')) {
    message += (message ? " " : "") + "(version étanche 2RS probable).";
  } else if (normInput.includes('zz')) {
    message += (message ? " " : "") + "(version avec flasques ZZ probable).";
  }

  if (message) {
    needsCascade = true;
    message += "\n\nPour éviter toute erreur, merci de nous confirmer s'il s'agit d'un modèle ouvert, 2RS ou ZZ, ainsi que la quantité souhaitée.\nVous pouvez aussi nous envoyer une photo.";
    return { matches: true, message, tags, needsCascade, detectedType };
  }
  
  return { matches: false, message: "", tags: [], needsCascade: false };
};

export const analyzeGeneral = (input: string): { matches: boolean; message: string; tags: RequestTag[]; needsCascade: boolean; detectedType?: string } => {
  const normInput = input.toLowerCase();
  
  if (normInput.match(/ucp|ucf|ucfl|uct|insert uc|palier/)) {
    let msg = "Cela correspond probablement à un palier.";
    if (normInput.match(/arbre 25|25\s*mm/)) {
      msg = "D'après le diamètre d'arbre de 25mm, cela correspond probablement à la série 205.";
    }
    return {
      matches: true,
      message: msg + "\n\nPour éviter toute erreur, merci de nous préciser s'il s'agit d'un palier semelle (UCP), à bride carrée (UCF), ovale (UCFL), ou de nous envoyer une photo.",
      tags: ["PIECE", "TECHNIQUE"],
      needsCascade: true,
      detectedType: "Palier"
    };
  }

  if (normInput.match(/chc|th|tf|btr|six pans creux|inox|8\.8|10\.9|12\.9|m[68]0?|vis|visserie/)) {
    return {
      matches: true,
      message: "Cela correspond probablement à de la visserie.\n\nPour éviter toute erreur, merci de nous préciser :\n- le diamètre (M6, M8, M10…)\n- la longueur\n- le type de tête (CHC, TH, TF…)\n- la matière ou classe (inox, 8.8...) si utile.\nVous pouvez aussi nous envoyer une photo.",
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
  // Conversions basiques de courroies
  // SPA -> Ld = Li + 45 / Le = Li + 63
  // SPB -> Ld = Li + 60 / Le = Li + 82
  // SPZ -> Ld = Li + 37 / Le = Li + 51
  // A -> Ld = Li + 30 / Le = Li + 50
  // B -> Ld = Li + 43 / Le = Li + 69

  let baseLi = value;
  
  // Normalize to Li conceptually for internal match if they passed Ld or Le
  if (profile === "SPA") {
    if (lengthType === "Ld") baseLi = value - 45;
    if (lengthType === "Le") baseLi = value - 63;
  } else if (profile === "SPB") {
    if (lengthType === "Ld") baseLi = value - 60;
    if (lengthType === "Le") baseLi = value - 82;
  } else if (profile === "SPZ") {
    if (lengthType === "Ld") baseLi = value - 37;
    if (lengthType === "Le") baseLi = value - 51;
  } else if (profile === "A") {
    if (lengthType === "Ld") baseLi = value - 30;
    if (lengthType === "Le") baseLi = value - 50;
  } else if (profile === "B") {
    if (lengthType === "Ld") baseLi = value - 43;
    if (lengthType === "Le") baseLi = value - 69;
  }

  // Create formatting back for probable matching
  let probableLw = baseLi; // Ld / Lw
  if (profile === "SPA") probableLw = baseLi + 45;
  if (profile === "SPB") probableLw = baseLi + 60;
  if (profile === "SPZ") probableLw = baseLi + 37;
  if (profile === "A") probableLw = baseLi + 30;
  if (profile === "B") probableLw = baseLi + 43;

  const resultStr = `${profile} ${Math.round(probableLw)} Ld (primitive)`;
  const equivalent = resultStr;

  return {
    equivalent,
    message: `Selon les données standards, cela équivaut probablement à une courroie **${equivalent}**.\n\n⚠️ *Équivalence à confirmer selon la marque, la norme et votre application.*`
  };
};
