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
    !m.includes("Envoyer quand même") &&
    !m.includes("Identifier") && 
    !m.includes("Recherche") &&
    !m.includes("Demande de devis") &&
    !m.includes("[Photo") &&
    !m.includes("Comparaison") &&
    !m.includes(data.contactPhone || "___NO_PHONE___") &&
    !m.includes(data.contactName || "___NO_NAME___")
  );

  let detailsText = cleanMessages.join(" | ");

  let productName = estimatedType || "Non spécifié";
  if (data.tags.includes("COURROIE")) productName = "Courroie";
  else if (data.tags.includes("ROULEMENT")) productName = "Roulement";
  else if (data.flowType === "devis") productName = "Devis d'intervention";
  else if (data.flowType === "piece" && data.productType) productName = data.productType;
  
  let formattedDetails = detailsText || "Non spécifiées";

  // Using the exact format from requirements
  let text = `--- DEMANDE CLIENT SNIMOP ---\n\n`;
  text += `Type de demande : ${data.flowType === 'devis' ? 'Devis' : (data.flowType === 'inconnu' ? 'Conseil' : 'Pièce')}\n`;
  text += `Produit : ${productName}\n`;
  text += `Désignation probable : ${probableMatch ? probableMatch : (data.flowType === 'devis' ? "Voir description" : "Non renseignée")}\n`;
  text += `Référence fournie : ${data.reference || "Non renseignée"}\n`;
  text += `Dimensions : ${formattedDetails}\n`;
  text += `Longueur : ${data.tags.includes("COURROIE") ? "A confirmer (" + formattedDetails + ")" : "N/A"}\n`;
  text += `Quantité : ${data.quantity || "Non renseignée"}\n`;
  text += `Application / usage : ${data.application || "Non renseigné"}\n`;
  text += `Photo : ${data.hasPhoto ? "Oui" : "Non"}\n\n`;

  text += `--- COORDONNÉES ---\n\n`;
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
  const normInput = input.toLowerCase().replace(/ /g, '');
  
  let tags: RequestTag[] = ["COURROIE", "TECHNIQUE"];
  let message = "";
  let needsCascade = false;
  let detectedType = "Courroie";

  // Dimensions : largeur x hauteur (Exclusion formelle des 3 dimensions pour éviter les roulements)
  const dimRegex = /(?<!\dx)\b(\d+)[xX*](\d+)\b(?![xX*]\d)/;
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
       message = `La dimension ${width}x${height} correspond au profil probable de votre courroie (profil ${probableProfile}).`;
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
    message += "\nPour éviter toute erreur, merci de nous préciser la longueur (idéalement Li, Le ou Ld si connue) ou la référence complète.\nVous pouvez aussi nous envoyer une photo.";
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
    message = `Les dimensions ${input} correspondent probablement à un roulement type ${likelyType}.`;
  }

  // Suffixes (2RS, ZZ, C3)
  if (normInput.includes('2rs')) {
    message += (message ? " " : "Cela correspond probablement à un ") + "roulement version étanche 2RS.";
  } else if (normInput.includes('zz')) {
    message += (message ? " " : "Cela correspond probablement à un ") + "roulement version avec flasques ZZ.";
  }

  if (message) {
    needsCascade = true;
    message += "\n\nPouvez-vous nous confirmer le type :\n- ouvert\n- 2RS (étanche)\n- ZZ (flasques métal)\n\nQuelle quantité souhaitez-vous ?";
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
  let baseLi = value;
  
  // Normalize given value to internal Li based on profile mapping
  if (profile === "SPA" || profile === "XPA") {
    if (lengthType === "Ld") baseLi = value - 45;
    if (lengthType === "Le") baseLi = value - 63;
  } else if (profile === "SPB" || profile === "XPB") {
    if (lengthType === "Ld") baseLi = value - 60;
    if (lengthType === "Le") baseLi = value - 82;
  } else if (profile === "SPC" || profile === "XPC") {
    if (lengthType === "Ld") baseLi = value - 83;
    if (lengthType === "Le") baseLi = value - 113;
  } else if (profile === "SPZ" || profile === "XPZ") {
    if (lengthType === "Ld") baseLi = value - 37;
    if (lengthType === "Le") baseLi = value - 51;
  } else if (profile === "A" || profile === "4L") {
    if (lengthType === "Ld") baseLi = value - 30;
    if (lengthType === "Le") baseLi = value - 50;
  } else if (profile === "B" || profile === "5L") {
    if (lengthType === "Ld") baseLi = value - 43;
    if (lengthType === "Le") baseLi = value - 69;
  } else if (profile === "C") {
    if (lengthType === "Ld") baseLi = value - 58;
    if (lengthType === "Le") baseLi = value - 88;
  } else if (profile === "Z" || profile === "3L") {
    if (lengthType === "Ld") baseLi = value - 22;
    if (lengthType === "Le") baseLi = value - 38;
  }

  // Cross Equivalent logics base recommendations
  let famProfile = "";
  if (profile === "3L") famProfile = "Z probable";
  if (profile === "4L") famProfile = "A probable";
  if (profile === "5L") famProfile = "B probable";
  if (profile === "XPZ") famProfile = "SPZ / AVX10 selon contexte";
  if (profile === "XPA") famProfile = "SPA / AVX13 probable";
  if (profile === "XPB") famProfile = "SPB / AVX17 probable";
  if (profile === "XPC") famProfile = "SPC probable";

  if (!famProfile) {
     if (profile === "Z") famProfile = "3L selon utilisation";
     if (profile === "A") famProfile = "4L selon utilisation";
     if (profile === "B") famProfile = "5L selon utilisation";
     if (profile === "SPZ") famProfile = "XPZ selon diamètres poulies";
     if (profile === "SPA") famProfile = "XPA (crantée) selon encombrement";
  }

  // Formatting equivalent based on common Ld/Le usage in the industry for that profile
  let targetLw = baseLi; 
  let targetSuffix = "Li";

  if (["SPA", "SPB", "SPC", "SPZ", "XPA", "XPB", "XPC", "XPZ"].includes(profile)) {
    targetSuffix = "Ld";
    if (profile.includes("A")) targetLw = baseLi + 45;
    if (profile.includes("B")) targetLw = baseLi + 60;
    if (profile.includes("C")) targetLw = baseLi + 83;
    if (profile.includes("Z")) targetLw = baseLi + 37;
  }

  const equivalent = `${profile} ${Math.round(targetLw)} ${targetSuffix}`;

  return {
    equivalent,
    message: `Selon les correspondances standards, ${profile} ${value} ${lengthType} correspond probablement à une courroie de même famille.\n\nÉquivalent probable : **${equivalent}**\nFamille proche : **${famProfile}**\n\n⚠️ *Équivalence à confirmer selon la marque, la norme et l'application.*`
  };
};
