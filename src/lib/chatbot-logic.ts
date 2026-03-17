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

  let text = `Bonjour, je souhaite faire une demande auprès de SNIMOP :\n\n`;
  text += `Type : ${data.flowType === 'devis' ? 'dépannage / devis' : 'pièce'}\n`;
  text += `Produit : ${estimatedType || 'autre'}\n`;
  if (probableMatch) text += `Type probable : ${probableMatch}\n`;
  
  // We don't have structured DB fields for these, so we print the labels and inject any context we gathered
  text += `Dimensions : ${detailsText}\n`;
  text += `Longueur : \n`;
  text += `Application : \n`;
  text += `Quantité : \n`;
  text += `Urgence : ${data.tags.includes('URGENT') ? 'Haute' : ''}\n\n`;

  text += `Nom : \n`;
  text += `Société : \n`;
  text += `Téléphone : \n`;
  text += `Email : \n\n`;

  text += `Merci de me recontacter.`;
  
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

export const analyzeBelt = (input: string): { matches: boolean; message: string; tags: RequestTag[]; needsCascade: boolean } => {
  const normInput = input.toLowerCase().replace(/ /g, '');
  
  let tags: RequestTag[] = ["COURROIE", "TECHNIQUE"];
  let message = "";
  let needsCascade = false;

  // Dimensions : largeur x hauteur
  const dimRegex = /(\d+)[xX*](\d+)/;
  const matchDim = normInput.match(dimRegex);

  if (matchDim) {
    const width = parseInt(matchDim[1], 10);
    const height = parseInt(matchDim[2], 10);
    
    if ((width >= 12 && width <= 14) && (height >= 7 && height <= 9)) {
      message = "Les dimensions indiquées correspondent probablement à une courroie trapézoïdale de section A.";
    } else if ((width >= 16 && width <= 18) && (height >= 10 && height <= 12)) {
      message = "Les dimensions indiquées correspondent probablement à une courroie trapézoïdale de section B.";
    } else {
      message = "J'ai bien noté les dimensions. Il s'agit d'une section spécifique.";
    }
  }

  // Profils (SPA, SPB, SPC, XPZ...)
  if (normInput.includes('spa') || normInput.includes('spb') || normInput.includes('spc')) {
    message += (message ? "\n\n" : "") + "Il semble s'agir d'une courroie trapézoïdale étroite (type SP).";
  } else if (normInput.includes('xpz') || normInput.includes('xpa')) {
    message += (message ? "\n\n" : "") + "C'est probablement une courroie crantée (type XP).";
  }

  if (message) {
    needsCascade = true;
    message += "\n\nPour identifier précisément la référence complète, pouvez-vous me préciser :\n- la longueur de la courroie ?\n- s’il y a une référence inscrite dessus ?\n- sur quelle machine elle est utilisée ?\n- et si possible, une photo ?";
    return { matches: true, message, tags, needsCascade };
  }
  
  return { matches: false, message: "", tags: [], needsCascade: false };
};


export const analyzeBearing = (input: string): { matches: boolean; message: string; tags: RequestTag[]; needsCascade: boolean } => {
  const normInput = input.toLowerCase().replace(/ /g, '');
  let tags: RequestTag[] = ["ROULEMENT", "TECHNIQUE"];
  let message = "";
  let needsCascade = false;

  // Dimensions : int x ext x epaisseur
  const dimRegex = /(\d+)[xX*](\d+)[xX*](\d+)/;
  const matchDim = normInput.match(dimRegex);
  
  let likelyType = "";

  if (matchDim) {
    const int = matchDim[1];
    const ext = matchDim[2];
    const ep = matchDim[3];
    
    if (int === "25" && ext === "52" && ep === "15") {
      likelyType = "6205";
    } else if (int === "30" && ext === "72" && ep === "19") {
      likelyType = "6306";
    }
  }
  
  // Try finding strict bearing numbers 
  const numRegex = /(6[023]\d{2}|222\d{2})/;
  const matchNum = input.match(numRegex);
  if (matchNum && !likelyType) {
    likelyType = matchNum[1];
  }

  if (likelyType) {
    message = `Les dimensions ou numéros indiqués correspondent probablement à un roulement type ${likelyType}.`;
  }

  // Suffixes (2RS, ZZ, C3)
  if (normInput.includes('2rs')) {
    message += (message ? "\n" : "") + "S'il est étanche des deux côtés, il peut s'agir de la version 2RS.";
  } else if (normInput.includes('zz')) {
    message += (message ? "\n" : "") + "Avec des flasques métalliques, ce serait un ZZ.";
  } else if (normInput.includes('c3')) {
    message += (message ? "\n" : "") + "J'ai noté le jeu interne C3.";
  }

  if (message) {
    needsCascade = true;
    message += "\n\nPour confirmer la bonne référence et garantir la compatibilité, pouvez-vous me préciser :\n- les dimensions exactes (intérieur / extérieur / largeur) ?\n- s’il est étanche (2RS) ou avec flasques métal (ZZ) ?\n- l’application / votre machine ?\n- et si possible une photo ?";
    return { matches: true, message, tags, needsCascade };
  }
  
  return { matches: false, message: "", tags: [], needsCascade: false };
};
