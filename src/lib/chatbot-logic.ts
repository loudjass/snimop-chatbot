export type RequestTag = 
  | "COURROIE" 
  | "ROULEMENT" 
  | "DEVIS" 
  | "PIECE" 
  | "URGENT" 
  | "TECHNIQUE" 
  | "HORS_STANDARD"
  | "A_VERIFIER"
  | "ALEXANDRE"
  | "PASCALE";



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
  issueType?: string;
  symptoms?: string;
  location?: string;
  urgency?: string;
  hasPhoto?: boolean;
  photoCount?: number;         // v5.2: number of photos uploaded
  photoDataUrls?: string[];   // v5.2: base64 previews for display
  orientation?: "ALEXANDRE" | "PASCALE";
  contactName?: string;
  contactFirstName?: string;
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

// ==========================================
// V5 UX UTILITIES
// ==========================================

/**
 * v5 — Detects whether the first message is requesting a PIECE or an INTERVENTION.
 */
export const detectRequestType = (input: string): "PIECE" | "INTERVENTION" | "UNKNOWN" => {
  const txt = normalizeInput(input).toLowerCase();

  const interventionKeywords = /\bport[e]?\b|\brideau\b|\bvolet\b|\bauto(matisme)?\b|\bbloqué\b|\bbloquée\b|\bbloque\b|\bpann[e]?\b|\bintervention\b|\bchantier\b|\bmotoris\b|\btélécommande\b|\bvérin\b.*\bporte\b|\bsection/;
  if (interventionKeywords.test(txt)) return "INTERVENTION";

  const pieceKeywords = /\broulement\b|\bcourroie\b|\bpalier\b|\bjoint\b|\bvis\b|\bcapteur\b|\bréducteur\b|\bengrenage\b|\bclavette\b|\bécrou\b|\bboulon\b|\bfiltre\b|\bcourroi/;
  if (pieceKeywords.test(txt)) return "PIECE";

  return "UNKNOWN";
};

/**
 * v5 — Detects vague/imprecise inputs that need clarification.
 */
export const isVagueInput = (input: string): boolean => {
  const txt = input.toLowerCase().trim();
  if (txt.length < 15 && /^(ça|ca|c'est|il|elle)?\s*(ne\s+)?(marche|fonc|tourne|bouge|répond|démarre|ouvre|ferme)\s*(plus|pas)?\s*\.?$/i.test(txt)) return true;
  if (/^(j'ai\s+un\s+)?(problème|souci|soucis|truc|truc qui|pb)\s*\.?$/i.test(txt)) return true;
  if (/^(c'est\s+)?(bloqué?e?|cassé?e?|en panne|mort|hs|hors service)\s*\.?$/i.test(txt)) return true;
  return false;
};

/**
 * v5 — Detects a non-technical client who doesn't know what they need.
 */
export const isNonTechnicalClient = (input: string): boolean => {
  const txt = input.toLowerCase();
  return /je (ne |n')?(sais|connais|comprends) pas|j'y connais rien|c'est quoi|kesako|je sais pas|aucune idée|jamais vu|je ne sais/i.test(txt);
};

/**
 * v5 — Builds a clean end-of-journey summary without empty "Non renseigné" lines.
 */
export const buildCleanSummary = (data: ChatbotData): string => {
  const lines: string[] = ["✅ **Votre demande :**\n"];

  if (data.flowType === "devis") {
    if (data.equipmentType) lines.push(`🔧 Équipement : ${data.equipmentType}`);
    if (data.issueDescription) lines.push(`⚠️ Problème : ${data.issueDescription}`);
    if (data.location) lines.push(`📍 Lieu : ${data.location}`);
    if (data.urgency) lines.push(`⏱ Urgence : ${data.urgency}`);
  } else {
    if (data.productType) lines.push(`📦 Pièce : ${data.productType}`);
    if (data.reference) lines.push(`🏷 Référence : ${data.reference}`);
    if (data.dimensions) lines.push(`📐 Dimensions : ${data.dimensions}`);
    if (data.quantity) lines.push(`🔢 Quantité : ${data.quantity}`);
    if (data.application) lines.push(`🏭 Machine : ${data.application}`);
  }

  if (data.hasPhoto) lines.push(`📷 Photo : jointe`);

  if (data.contactName || data.contactPhone) {
    lines.push("");
    lines.push(`👤 Contact : ${[data.contactName, data.contactCompany, data.contactPhone].filter(Boolean).join(" — ")}`);
  }

  const oriented = data.orientation === "ALEXANDRE" ? "Alexandre (intervention terrain)" : "Pascale (pièces / fournitures)";
  lines.push(`\n→ Votre demande sera traitée par **${oriented}**.`);

  return lines.join("\n");
};

// ==========================================
// V4 UTILITIES — Normalization & Parsing
// ==========================================

/**
 * v4 — Nettoyage intelligent : corrects common French typos before analysis.
 */
export const normalizeInput = (input: string): string => {
  let out = input;
  // Equipment corrections
  out = out.replace(/\bsectionel+e?\b/gi, "sectionnelle");
  out = out.replace(/\bsectionnele\b/gi, "sectionnelle");
  out = out.replace(/\bbloqu[eé]r\b/gi, "bloquée");
  out = out.replace(/\bimmedia[t]?\b/gi, "immédiat");
  out = out.replace(/\bimediat\b/gi, "immédiat");
  out = out.replace(/\bimmediat\b/gi, "immédiat");
  out = out.replace(/\bpannée\b/gi, "panne");
  out = out.replace(/\broulement[s]?\b/gi, (m) => m); // keep
  out = out.replace(/\bcourroi[e]?\b/gi, "courroie");
  out = out.replace(/\bvibrasion\b/gi, "vibration");
  out = out.replace(/\béchauffemen[t]?\b/gi, "échauffement");
  out = out.replace(/\bchaufage\b/gi, "chauffage");
  out = out.replace(/\bvolet[s]?\s+roulant[s]?\b/gi, "volet roulant");
  return out;
};

/**
 * v4 — Parses a combined localisation + urgency string.
 * Ex: "paris urgence fort imediat" → { location: "Paris", urgency: "Intervention immédiate" }
 */
export const parseLocationUrgency = (input: string): { location: string; urgency: string } => {
  const normalized = normalizeInput(input).toLowerCase();

  // Urgency keywords — ordered from most to least critical
  const urgencyMap: { pattern: RegExp; label: string }[] = [
    { pattern: /immédiat|immediat|critique|arrêt\s+de\s+prod|bloqué|urgence\s+absolue/, label: "Intervention immédiate" },
    { pattern: /urgent|fort|rapide|demi.journée|demi journée|aujourd'hui|auj/, label: "Urgence — intervention rapide" },
    { pattern: /normal|semaine|standard|pas\s+urgent/, label: "Normale — sous 48–72h" },
  ];

  let urgency = "";
  for (const { pattern, label } of urgencyMap) {
    if (pattern.test(normalized)) {
      urgency = label;
      break;
    }
  }

  // Strip urgency words to isolate location
  let locationRaw = input
    .replace(/\b(urgence|urgent|fort|imediat|immédiat|immediat|critique|rapide|normal|standard|demi.journée|aujourd'hui|auj|intervention|bloqué|bloquee)\b/gi, "")
    .trim();

  // Capitalize first letter of each word
  const location = locationRaw
    .split(" ")
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return { location: location || "Non renseigné", urgency: urgency || input };
};

/**
 * v4 — Smart contact split for single-line inputs like "janicot snimop".
 * Returns an object with name, company, phone, email.
 */
export const smartSplitContact = (text: string): { name: string; phone: string; company: string; email: string } => {
  let extracted = { name: "", phone: "", company: "", email: "" };

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) extracted.email = emailMatch[0];

  // Phone (French)
  const phoneMatch = text.match(/(\+33|0)[ \-.]?[1-9]([ \-.]?[0-9]{2}){4}/);
  if (phoneMatch) extracted.phone = phoneMatch[0];

  const stripped = text
    .replace(extracted.email, "")
    .replace(extracted.phone, "")
    .trim();

  const lines = stripped.split("\n");

  if (lines.length > 1) {
    // Multi-line structured input
    lines.forEach(l => {
      const lLow = l.toLowerCase();
      const val = l.split(":")[1]?.trim() || "";
      if (lLow.match(/^nom|^prénom|^prenom/)) extracted.name = val;
      if (lLow.match(/^soci[eé]t[eé]|^entreprise|^soc\s*:/)) extracted.company = val;
      if (lLow.match(/^t[eé]l|^phone/)) extracted.phone = val || extracted.phone;
      if (lLow.match(/^e?mail/)) extracted.email = val || extracted.email;
    });
  } else {
    // Single-line — "janicot snimop" or "Jean Dupont SNIMOP 0606060606"
    const words = stripped.split(/\s+/).filter(w => w.length > 0);

    // Find company: all-uppercase word of length > 2 that isn't a French common word
    const commonWords = new Set(["ET", "DE", "DU", "LA", "LE", "LES", "UN", "UNE", "AU", "AUX"]);
    const companyIndex = words.findIndex(
      w => w === w.toUpperCase() && w.length > 2 && /^[A-Z]/.test(w) && !commonWords.has(w)
    );

    if (companyIndex !== -1) {
      extracted.company = words[companyIndex];
      words.splice(companyIndex, 1);
    } else if (words.length > 2) {
      // Last word assumed to be company if no phone/email pattern
      extracted.company = words.pop() || "";
    }

    // Remaining words = name — capitalize properly
    extracted.name = words
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return extracted;
};

// ==========================================
// V5.5 ROUTING — Pascal vs Alexandre
// ==========================================

export const ROUTING = {
  PASCAL: {
    name: "Pascal",
    whatsapp: "33607877159",
    email: "info@snimop.fr",
    scope: "Pièces / Fourniture"
  },
  ALEXANDRE: {
    name: "Alexandre",
    whatsapp: "33640946757",            // +33 6 40 94 67 57
    email: "ajanicot@snimop.fr",
    scope: "Chantier / Intervention"
  }
} as const;

/**
 * v5.5 — Generates a mailto: link routed to the right contact.
 */
export const generateEmailLink = (data: ChatbotData, userMessages: string[]): string => {
  const route = data.orientation === "ALEXANDRE" ? ROUTING.ALEXANDRE : ROUTING.PASCAL;
  const subject = encodeURIComponent("Demande SNIMOP — " + (data.flowType === "devis" ? "Intervention" : "Pièce"));

  const lines: string[] = [];
  if (data.flowType === "devis") {
    if (data.issueDescription) lines.push(`Problème : ${data.issueDescription}`);
    if (data.urgency)          lines.push(`Urgence : ${data.urgency}`);
    if (data.location)         lines.push(`Lieu : ${data.location}`);
    if (data.equipmentType)    lines.push(`Équipement : ${data.equipmentType}`);
  } else {
    if (data.productType)  lines.push(`Pièce : ${data.productType}`);
    if (data.reference)    lines.push(`Référence : ${data.reference}`);
    if (data.dimensions)   lines.push(`Dimensions : ${data.dimensions}`);
    if (data.quantity)     lines.push(`Quantité : ${data.quantity}`);
    if (data.application)  lines.push(`Machine : ${data.application}`);
  }

  if (data.contactName)  lines.push(`\nContact : ${data.contactName}`);
  if (data.contactPhone) lines.push(`Tél : ${data.contactPhone}`);
  if (data.contactEmail) lines.push(`Email : ${data.contactEmail}`);
  if (data.photoCount && data.photoCount > 0) lines.push(`\n📸 ${data.photoCount} photo(s) — joindre directement sur WhatsApp`);

  const body = encodeURIComponent(lines.join("\n"));
  return `mailto:${route.email}?subject=${subject}&body=${body}`;
};

/**
 * v5.5 — Extracts structured info from a free-text sentence.
 * Ex: "Mon rideau métallique est bloqué" → { equipmentType: "rideau métallique", issueDescription: "bloqué" }
 */
export const extractInfoFromSentence = (input: string): Partial<ChatbotData> => {
  const norm = normalizeInput(input).toLowerCase();
  const result: Partial<ChatbotData> = {};

  // Equipment type extraction
  const equipConf: [RegExp, string][] = [
    [/rideau m[ée]tallique/, "rideau métallique"],
    [/rideau\b/, "rideau"],
    [/porte (automatique|coulissante|rapide|sectionnelle|basculante)/, "porte automatique"],
    [/porte\b/, "porte"],
    [/portail\b/, "portail"],
    [/volet\b/, "volet"],
    [/barrière\b/, "barrière"],
    [/compresseur\b/, "compresseur"],
    [/moteur\b/, "moteur"],
    [/convoyeur\b/, "convoyeur"],
    [/machine\b/, "machine"],
  ];
  for (const [re, label] of equipConf) {
    if (re.test(norm)) { result.equipmentType = label; break; }
  }

  // Problem extraction
  const problemConf: [RegExp, string][] = [
    [/bloqu[eé]/, "bloqué"],
    [/ne (s['']ouvre|monte|descend|ferme|démarre|fonctionne) plus/, "ne fonctionne plus"],
    [/ne (marche|tourne) plus/, "ne fonctionne plus"],
    [/en panne/, "en panne"],
    [/bruit (anormal|fort|bizarre|grincement)/, "bruit anormal"],
    [/fait du bruit/, "bruit anormal"],
    [/cassé/, "cassé"],
    [/déchiré/, "déchiré"],
    [/usé/, "usé"],
    [/patin[e]/, "patinage"],
  ];
  for (const [re, label] of problemConf) {
    if (re.test(norm)) { result.issueDescription = label; result.symptoms = label; break; }
  }

  // Urgency keywords
  if (/urgent|imm[ée]diat|arrêt|bloqu|production (arrêtée|stop)/.test(norm)) {
    result.urgency = "Intervention immédiate";
  }

  return result;
};

/**
 * v5.5 — Expert belt equivalence and type analysis.
 */
export interface BeltExpertResult {
  beltType: "trapezoidale" | "dentee" | "poly-v" | "plate" | "speciale" | "auto" | "unknown";
  equivalent?: string;
  warning?: string;
  message: string;
}

export const getBeltExpertAnalysis = (input: string): BeltExpertResult => {
  const norm = normalizeInput(input).toLowerCase();
  const inp = input.toUpperCase();

  // Dentée / synchrone — NO equivalence
  if (/HTD|XL\b|L\b|H\b|XH\b|T5\b|T10\b|AT5|AT10|3M|5M|8M|14M|synchro|crantée|dentée/i.test(input)) {
    return {
      beltType: "dentee",
      message: "Courroie dentée — référence exacte obligatoire.\nPas d'équivalence possible (pas, nombre de dents, largeur sont critiques).\n_Envoyez une photo ou la référence complète._",
      warning: "Aucune équivalence — référence exacte"
    };
  }

  // Poly-V — same profile only
  if (/PJ|PK|PL|PM|PH/i.test(input)) {
    return {
      beltType: "poly-v",
      message: "Courroie Poly-V — équivalence uniquement dans le même profil.\nConversion PJ ↔ PK : interdit (géométrie incompatible).\n_Précisez le profil, la longueur et le nombre de nervures._",
      warning: "Même profil uniquement"
    };
  }

  // SPA / A equivalence
  const spaMatch = inp.match(/SPA\s*(\d+)/);
  if (spaMatch) {
    const ld = parseInt(spaMatch[1]);
    const liApprox = ld - 45;
    const laApprox = ld + 18;
    return {
      beltType: "trapezoidale",
      equivalent: `A ${liApprox}`,
      message: `Courroie SPA ${ld}\n\n↔ Équivalent possible : **A ${liApprox}** (Li)\n\n⚠️ SPA et A sont proches mais non identiques. Conserver le profil d'origine sauf validation technique.\nLd ≈ ${ld} mm — Li ≈ ${liApprox} mm — La ≈ ${laApprox} mm\n_Compatible dans la plupart des cas, à vérifier selon poulies._`,
      warning: "Profils proches, non identiques"
    };
  }

  // SPB / B equivalence
  const spbMatch = inp.match(/SPB\s*(\d+)/);
  if (spbMatch) {
    const ld = parseInt(spbMatch[1]);
    const liApprox = ld - 45;
    return {
      beltType: "trapezoidale",
      equivalent: `B ${liApprox}`,
      message: `Courroie SPB ${ld}\n\n↔ Équivalent possible : **B ${liApprox}** (Li)\n\n⚠️ SPB et B sont proches mais non identiques. Conserver le profil d'origine sauf validation technique.\n_Compatible dans la plupart des cas, à vérifier selon poulies._`,
      warning: "Profils proches, non identiques"
    };
  }

  // SPC / C equivalence
  const spcMatch = inp.match(/SPC\s*(\d+)/);
  if (spcMatch) {
    const ld = parseInt(spcMatch[1]);
    const liApprox = ld - 45;
    return {
      beltType: "trapezoidale",
      equivalent: `C ${liApprox}`,
      message: `Courroie SPC ${ld}\n\n↔ Équivalent possible : **C ${liApprox}** (Li)\n\n⚠️ Conserver le profil d'origine sauf validation technique.\n_Compatible dans la plupart des cas, à vérifier selon poulies._`,
      warning: "Profils proches, non identiques"
    };
  }

  // SPZ / Z equivalence
  const spzMatch = inp.match(/SPZ\s*(\d+)/);
  if (spzMatch) {
    const ld = parseInt(spzMatch[1]);
    const liApprox = ld - 45;
    return {
      beltType: "trapezoidale",
      equivalent: `Z ${liApprox}`,
      message: `Courroie SPZ ${ld}\n\n↔ Équivalent possible : **Z ${liApprox}** (Li)\n\n⚠️ Conserver le profil d'origine sauf validation technique.`,
      warning: "Profils proches, non identiques"
    };
  }

  // A/B/C/Z → SPA/SPB/SPC/SPZ reverse
  const classicMatch = inp.match(/\b([ABCZ])\s*(\d+)\b/);
  if (classicMatch) {
    const profile = classicMatch[1];
    const li = parseInt(classicMatch[2]);
    const spProfile = profile === "Z" ? "SPZ" : `SP${profile}`;
    const ldApprox = li + 45;
    return {
      beltType: "trapezoidale",
      equivalent: `${spProfile} ${ldApprox}`,
      message: `Courroie ${profile} ${li}\n\n↔ Équivalent possible : **${spProfile} ${ldApprox}** (Ld)\n\n⚠️ Profils proches mais non identiques. Vérifier selon poulies.\n_Tolérance ±5 mm selon fabricant._`,
      warning: "Profils proches, non identiques"
    };
  }

  // Flat belt — ask for dimensions
  if (/plate|flat|plat/i.test(input)) {
    return {
      beltType: "plate",
      message: "Courroie plate — indiquez les dimensions :\n- Largeur (mm)\n- Épaisseur (mm)\n- Longueur (mm)\n\n_Une photo ou les dimensions précises permettent d'éviter une erreur._"
    };
  }

  // Auto belts (brand equiv OK)
  if (/auto|alternateur|distribution|accessoire/i.test(input)) {
    return {
      beltType: "auto",
      message: "Courroie auto — équivalence par marque possible.\nDonnez la référence d'origine ou le véhicule + motorisation."
    };
  }

  return {
    beltType: "unknown",
    message: "Pour trouver la bonne courroie, indiquez la **référence** ou les **dimensions** (largeur × hauteur × longueur).\n_Une photo permet d'éviter une erreur._"
  };
};

// ==========================================
// V3/V4 WHATSAPP FORMAT — 11 fields
// ==========================================

export const generateWhatsAppLink = (data: ChatbotData, userMessages: string[]): string => {
  const number = process.env.NEXT_PUBLIC_SNIMOP_WHATSAPP_NUMBER || "33607877159"; 
  
  // Determine request type
  const reqType = 
    data.flowType === 'devis' ? 'Devis intervention' :
    data.flowType === 'courroie' ? 'Pièce — Courroie' :
    data.flowType === 'roulement' ? 'Pièce — Roulement' :
    data.flowType === 'compare' ? 'Technique — Comparaison courroie' :
    data.flowType === 'inconnu' ? 'Conseil / Identification' :
    data.flowType === 'piece' ? 'Recherche de pièce' :
    'Non renseigné';

  // Remove UI-only messages
  const cleanMessages = userMessages.filter(m => 
    !m.includes("Je n'ai pas toutes les informations") && 
    !m.includes("Envoyer quand même") &&
    !m.includes("Identifier") && 
    !m.includes("Recherche") &&
    !m.includes("Demande de devis") &&
    !m.includes("[Photo") &&
    !m.includes("Comparaison") &&
    !m.includes("Recherche inversée") &&
    !(data.contactPhone && m.includes(data.contactPhone)) &&
    !(data.contactName && m.includes(data.contactName)) &&
    !(data.contactCompany && m.includes(data.contactCompany))
  );

  const fullText = cleanMessages.join(" ");

  // Parse dimensions for belts
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
    }
  } else if (data.tags.includes("ROULEMENT")) {
    const dimMatch = fullText.match(/\b(\d+)[xX*](\d+)[xX*](\d+)\b/);
    if (dimMatch) parsedDimensions = `${dimMatch[1]}x${dimMatch[2]}x${dimMatch[3]}`;
    const numMatch = fullText.match(/\b(6[023]\d{2}|22[23]\d{2}|30[23]\d{2}|32[02]\d{2})\b/);
    if (numMatch && !parsedDimensions) parsedDimensions = numMatch[1];
    
    const qtyMatch = fullText.match(/\b(\d+)\s*(p[iieè]{1,2}ce?s?|qt[ée]|unit[ée]s?)\b/i);
    if (qtyMatch) parsedQuantity = qtyMatch[1];
  }

  // Detect orientation
  const orientedTo = data.orientation === "ALEXANDRE" ? "Alexandre (terrain / intervention)" :
                     data.orientation === "PASCALE" ? "Pascale (technique / fournitures)" :
                     data.flowType === "devis" ? "Alexandre (terrain / intervention)" :
                     "Pascale (technique / fournitures)";

  // Piece / besoin field
  const pieceBesoin = parsedDimensions || data.reference || data.productType || data.issueDescription || "Non renseigné";
  const pieceFull = parsedLength ? `${pieceBesoin} — Longueur ${parsedLength}` : pieceBesoin;

  // Build v3 format
  let text = `— DEMANDE CLIENT SNIMOP —\n\n`;
  text += `Type : ${reqType}\n`;
  text += `Équipement : ${data.equipmentType || "Non renseigné"}\n`;
  text += `Pièce / besoin : ${pieceFull}\n`;
  text += `Problème : ${data.issueDescription || "Non renseigné"}\n`;
  text += `Symptômes : ${data.symptoms || "Non renseigné"}\n`;
  text += `Application : ${data.application || "Non renseigné"}\n`;
  text += `Localisation : ${data.location || "Non renseigné"}\n`;
  text += `Urgence : ${data.urgency || "Non renseigné"}\n`;
  text += `Photo : ${data.hasPhoto ? "Oui" : "Non"}\n`;
  text += `Quantité : ${parsedQuantity || "Non renseignée"}\n`;
  text += `→ ${orientedTo}\n\n`;

  text += `— COORDONNÉES —\n`;
  text += `Nom : ${data.contactName || "Non renseigné"}\n`;
  text += `Société : ${data.contactCompany || "Non renseignée"}\n`;
  text += `Téléphone : ${data.contactPhone || "Non renseigné"}\n`;
  text += `Email : ${data.contactEmail || "Non renseigné"}\n`;
  
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

export const calculateCompletionScore = (data: ChatbotData, userMessages: string[]): number => {
  let score = 30; // base score for starting
  if (data.tags.length > 0) score += 10;
  if (data.aiAnalysis) score += 15;
  if (data.hasPhoto) score += 15;
  if (data.symptoms) score += 5;
  if (data.location) score += 5;
  if (data.urgency) score += 5;
  if (data.contactEmail) score += 5;
  
  const cleanMessages = userMessages.filter(m => 
    !m.includes("Je n'ai pas toutes les informations") &&
    !m.includes("Identifier") &&
    !m.includes("Recherche") &&
    !m.includes("Demande de devis")
  );

  const totalLength = cleanMessages.join(" ").length;
  if (totalLength > 15) score += 5;
  if (totalLength > 40) score += 5;

  return Math.min(score, 100);
};

// ==========================================
// SYMPTOM ACCUMULATION ENGINE
// ==========================================

export const analyzeSymptoms = (accumulatedContext: string): {
  hypothesis: string;
  suggestedType: "COURROIE" | "ROULEMENT" | "DEVIS" | "PIECE" | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  nextQuestion: string;
} => {
  // v4: normalize before analysis to catch typos
  const ctx = normalizeInput(accumulatedContext).toLowerCase();

  // Extended symptom flags
  const tourne = ctx.includes("tourne") || ctx.includes("rotation") || ctx.includes("axe") || ctx.includes("rotat");
  const bruit = ctx.includes("bruit") || ctx.includes("grince") || ctx.includes("claque") || ctx.includes("craque") || ctx.includes("couine");
  const chauffe = ctx.includes("chauffe") || ctx.includes("chaud") || ctx.includes("échauffement") || ctx.includes("chaleur");
  const vibre = ctx.includes("vibr");
  const patine = ctx.includes("patine") || ctx.includes("glisse") || ctx.includes("slip");
  const casse = ctx.includes("cassé") || ctx.includes("cassée") || ctx.includes("coupée") || ctx.includes("rompue");
  const poulie = ctx.includes("poulie") || ctx.includes("compresseur") || ctx.includes("courroi");
  const porte = ctx.includes("porte") || ctx.includes("rideau") || ctx.includes("volet") || ctx.includes("barrière") || ctx.includes("automatisme") || ctx.includes("motorisation") || ctx.includes("sectionnel") || ctx.includes("sectionnelle");
  const intervention = ctx.includes("panne") || ctx.includes("répara") || ctx.includes("interven") || ctx.includes("chantier") || ctx.includes("install");

  // ──────────────────────────────────────────────────
  // PRIORITY 1 : Intervention terrain → Alexandre
  // ──────────────────────────────────────────────────
  if (porte || (intervention && !tourne && !poulie)) {
    return {
      hypothesis: "C'est clairement une demande d'**intervention terrain** (porte, rideau, automatisme) — on va l'orienter vers **Alexandre**.",
      suggestedType: "DEVIS",
      confidence: "HIGH",
      nextQuestion: "Quel est le type exact d'équipement (porte sectionnelle, rideau métallique, volet roulant...) et qu'est-ce qui se passe ?"
    };
  }

  // ──────────────────────────────────────────────────
  // PRIORITY 2 (v4 correction) : Rotation + bruit → ROULEMENT AVANT courroie
  // ──────────────────────────────────────────────────
  if (tourne && bruit && chauffe) {
    return {
      hypothesis: "**Rotation + bruit + échauffement** — dans ce cas, c'est souvent un **roulement grippé ou usé**. Probabilité élevée.",
      suggestedType: "ROULEMENT",
      confidence: "HIGH",
      nextQuestion: "Avez-vous la référence gravée sur la bague ou les dimensions (int × ext × épaisseur) ?"
    };
  }

  if (tourne && bruit) {
    return {
      hypothesis: "**Rotation + bruit** — dans ce cas, c'est généralement un **roulement en fin de vie**. C'est la cause la plus fréquente.",
      suggestedType: "ROULEMENT",
      confidence: "HIGH",
      nextQuestion: "Est-ce que ça chauffe aussi ? Et avez-vous la référence ou les dimensions ?"
    };
  }

  if (tourne && (chauffe || vibre)) {
    return {
      hypothesis: "**Rotation + " + (chauffe ? "échauffement" : "vibration") + "** — dans ce cas, c'est souvent un **roulement défectueux** ou un désalignement.",
      suggestedType: "ROULEMENT",
      confidence: "MEDIUM",
      nextQuestion: "Y a-t-il un bruit associé ? Et avez-vous la référence ou les dimensions ?"
    };
  }

  // ──────────────────────────────────────────────────
  // PRIORITY 3 : Belt clear symptoms
  // ──────────────────────────────────────────────────
  if (patine || casse) {
    return {
      hypothesis: "**" + (patine ? "Patinage" : "Casse") + "** — dans ce cas, c'est la **courroie** qui est en cause.",
      suggestedType: "COURROIE",
      confidence: "HIGH",
      nextQuestion: "Avez-vous la largeur, une référence ou la longueur de la courroie ?"
    };
  }

  if (poulie) {
    return {
      hypothesis: "Contexte **poulie / compresseur / courroie** — dans ce cas on part sur une **courroie** à identifier.",
      suggestedType: "COURROIE",
      confidence: "HIGH",
      nextQuestion: "Avez-vous la section ou les dimensions de la courroie (largeur × hauteur) ?"
    };
  }

  // ──────────────────────────────────────────────────
  // PRIORITY 4 : Vibration ou bruit seul
  // ──────────────────────────────────────────────────
  if (vibre && !tourne) {
    return {
      hypothesis: "Une **vibration anormale** peut venir d'un roulement usé, d'un balourd ou d'un désalignement.",
      suggestedType: "ROULEMENT",
      confidence: "LOW",
      nextQuestion: "Est-ce que la pièce tourne ? La vibration est-elle présente uniquement sous charge ?"
    };
  }

  if (bruit && !tourne) {
    return {
      hypothesis: "Un **bruit** sans rotation identifiée — ça peut être un frottement, un jeu mécanique, ou une courroie qui claque.",
      suggestedType: "ROULEMENT",
      confidence: "MEDIUM",
      nextQuestion: "Est-ce que la pièce tourne ou est-ce un bruit en mouvement linéaire ?"
    };
  }

  // Fallback
  return {
    hypothesis: "",
    suggestedType: null,
    confidence: "LOW",
    nextQuestion: "Est-ce que la pièce tourne ? Y a-t-il un bruit ou un échauffement ?"
  };
};

// ==========================================
// BUSINESS LOGIC & REGEX PARSING
// ==========================================

export const analyzeBelt = (input: string): { matches: boolean; message: string; tags: RequestTag[]; needsCascade: boolean; detectedType?: string } => {
  const rawInputLow = input.toLowerCase();
  
  let tags: RequestTag[] = ["COURROIE", "TECHNIQUE"];
  let needsCascade = false;
  let detectedType = "Courroie";

  const isCourroieContext = rawInputLow.includes("courroi") || rawInputLow.includes("compresseur") || rawInputLow.includes("voiture") || rawInputLow.includes("poulie") || rawInputLow.includes("ventilateur") || rawInputLow.includes("cassée") || rawInputLow.includes("cassé") || rawInputLow.includes("patine") || rawInputLow.includes("glisse") || rawInputLow.includes("bruit") || rawInputLow.includes("vibration");

  // Symptoms
  let symptomMsg = "";
  let solutionMsg = "";
  let fallbackProp = "";
  if (rawInputLow.includes("patine") || rawInputLow.includes("glisse")) {
     symptomMsg = "Vous mentionnez une courroie qui patine. Cela indique souvent une tension insuffisante, une usure avancée (courroie glacée) ou un mauvais alignement.";
     solutionMsg = "Dans ce genre de cas récurrent, passer sur un profil cranté offre une bien meilleure adhérence et résistance à la flexion.";
     fallbackProp = "Je vous recommande de vous orienter vers un modèle cranté (type XPZ ou XPA selon vos poulies) pour stopper ce patinage.";
  } else if (rawInputLow.includes("compresseur")) {
     symptomMsg = "Vous recherchez une courroie pour un compresseur, ce type d'équipement demande généralement une section trapézoïdale pour encaisser les à-coups.";
     solutionMsg = "Pour un usage intensif, nous recommandons une version crantée (type XPZ, AX, BX) qui dissipe l'échauffement et transmet plus de puissance.";
     fallbackProp = "Dans ce cas, je vous recommande de partir sur une courroie crantée type XPZ ou AX, plus adaptée aux compresseurs. Nous pourrons affiner la référence exacte avec la longueur.";
  } else if (rawInputLow.includes("petite poulie") || rawInputLow.includes("petit diamètre") || rawInputLow.includes("petit diametre")) {
     symptomMsg = "Vous mentionnez une poulie de petit diamètre. Cela génère une très forte contrainte de flexion sur le dos de la courroie.";
     solutionMsg = "Il est fortement recommandé d'utiliser une courroie crantée pour épouser la courbure sans s'échauffer ni se cisailler prématurément.";
     fallbackProp = "Vous pouvez vous orienter vers un profil cranté (XPZ, XPA ou AX) pour maximiser la durée de vie sur ce diamètre.";
  } else if (rawInputLow.includes("bruit") || rawInputLow.includes("vibration")) {
     symptomMsg = "Vous rencontrez un souci de bruit ou de vibration. C'est souvent lié à l'usure de la courroie mais pas uniquement.";
     solutionMsg = "Je vous conseille de vérifier le jeu dans vos roulements, l'alignement des poulies et la tension de la courroie avant le remontage neuf.";
     fallbackProp = "Je peux tout à fait vous proposer une courroie de remplacement standard pour éliminer l'usure de l'équation. Nous affinerons la référence exacte avec vos cotes.";
  } else if (rawInputLow.includes("cassée") || rawInputLow.includes("pas de reference") || rawInputLow.includes("pas de ref") || rawInputLow.includes("plus de reference") || rawInputLow.includes("illisible")) {
     symptomMsg = "Vous n'avez plus la courroie d'origine ou la référence n'est plus lisible.";
     solutionMsg = "Utilisez cette méthode simple : prenez une cordelette ou un mètre ruban souple, et faites le tour complet des poulies **en restant bien au fond de la gorge** pour mesurer la longueur primitive.";
     fallbackProp = "À partir de cette mesure et de la largeur de la poulie, je vous orienterai précisément vers la bonne référence (profil A, B, Z...).";
  }

  // Dimensions : largeur x hauteur 
  const dimRegex = /(?<!\d\s*[xX*]\s*)\b(\d+)\s*[xX*]\s*(\d+)\b(?!\s*[xX*]\s*\d)/;
  const matchDim = rawInputLow.match(dimRegex);

  // Profils explicites type A, B, C, SPZ, XPZ, AX, 3L...
  const profileRegex = /\b(spz|spa|spb|spc|xpz|xpa|xpb|xpc|t5|t10|at10|8m|14m|ax|bx|cx|dx|3l|4l|5l)\b/i;
  let matchProfile = rawInputLow.match(profileRegex);

  // Pour les profils à une lettre (A, B, C, Z, E)
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
  let expectedProfileFromDim = "";

  if (matchDim) {
    const width = parseInt(matchDim[1], 10);
    const height = parseInt(matchDim[2], 10);
    
    if (width === 13 && height === 8) expectedProfileFromDim = "A";
    else if (width === 13 && height === 10) expectedProfileFromDim = "SPA";
    else if (width === 17 && height === 11) expectedProfileFromDim = "B";
    else if ((width === 16 && height === 13) || (width === 17 && height === 14)) expectedProfileFromDim = "SPB";
    else if (width === 10 && height === 6) expectedProfileFromDim = "Z";
    else if (width === 10 && height === 8) expectedProfileFromDim = "SPZ";
    else if (width === 22 && height === 14) expectedProfileFromDim = "C";
    else if (width === 22 && height === 18) expectedProfileFromDim = "SPC";

    probableProfile = expectedProfileFromDim;
  } 
  
  let explicitProfile = "";
  if (matchProfile) {
    explicitProfile = matchProfile[1].toUpperCase();
  } else if (letterMatch && ['a','b','c','z'].includes(letterMatch[1])) {
    explicitProfile = letterMatch[1].toUpperCase();
    if (!lengthStr) lengthStr = letterMatch[2];
  }

  // Detect Mismatch between Dimensions and Profile
  if (expectedProfileFromDim && explicitProfile) {
     if (expectedProfileFromDim !== explicitProfile && expectedProfileFromDim.replace('X','') !== explicitProfile.replace('X','')) {
        const getDimensionsOfProfile = (profile: string) => {
           switch(profile.replace('X','')) {
              case "A": return "13x8";
              case "SPA": return "13x10";
              case "B": return "17x11";
              case "SPB": return "16x13";
              case "Z": return "10x6";
              case "SPZ": return "10x8";
              case "C": return "22x14";
              case "SPC": return "22x18";
              default: return "inconnue";
           }
        };

        let actualProfileDims = getDimensionsOfProfile(explicitProfile);
        let correctionMsg = `Attention, une section **${matchDim![1]}x${matchDim![2]}** correspond à un profil **${expectedProfileFromDim}** et non **${explicitProfile}**.\n\nLe profil **${explicitProfile}** est en **${actualProfileDims}**.\nJe vous recommande donc de vérifier la section avant de valider.`;
        
         let struct = `1. 🔍 Diagnostic\n${symptomMsg || "Recherche de courroie avec incohérence technique."}\n\n`;
         struct += `2. 🛠 Solution\n${correctionMsg}\n\n`;
         struct += `3. 📦 Proposition\nJe vous recommande de vérifier si le marquage lu est bien **${explicitProfile}** ou si la section mesurée est réellement **${matchDim![1]}x${matchDim![2]}**, car ces deux informations ne correspondent pas au même profil.\n\n`;
         struct += `4. ❓ Question utile\nLaquelle des deux informations avez-vous lue directement sur la courroie ?`;
         
        needsCascade = true;
        return { matches: true, message: struct, tags, needsCascade, detectedType };
     } else {
        probableProfile = explicitProfile;
     }
  } else if (explicitProfile) {
     probableProfile = explicitProfile;
  }

  // Construction of 4-block if data exists
  if (probableProfile) {
     let diag = symptomMsg || `Vous recherchez une courroie profil **${probableProfile}**.`;
     let sol = solutionMsg || "Ce profil est un standard de l'industrie. Je peux vous orienter vers un modèle adapté.";
     let prop = "";
     let q = "";

     if (lengthStr) {
        let val = parseInt(lengthStr, 10);
        let lType = lengthType ? lengthType : "Ld";
        if (lType.toLowerCase() === "l") lType = "Ld";
        
        lType = lType.charAt(0).toUpperCase() + lType.slice(1).toLowerCase();
        if (lType === "") lType = "Ld";

        let converted = compareBelt(probableProfile.replace("X",""), lType, val);
        const matchConv = converted.message.match(/→ Li : \*\*\d+\*\*\n→ Le : \*\*\d+\*\*\n→ Ld : \*\*\d+\*\*/);
        
        prop = `✅ Je peux vous proposer une référence compatible.\nRéférence recommandée : **${probableProfile} ${val} ${lType}**\n*(Équivalence : ${matchConv ? matchConv[0].replace(/\n/g, " | ") : ""})*`;
        if (qtyStr) {
           prop += `\nQuantité enregistrée : ${qtyStr}`;
           q = "Pour me confirmer cette compatibilité, pouvez-vous m'indiquer la machine sur laquelle elle sera montée ?";
        } else {
           q = "Afin de m'assurer que ce profil passera correctement, sur quel type de machine ou équipement est-elle montée ?";
        }
        needsCascade = true;
     } else {
        if (matchDim && !explicitProfile) {
           prop = `Les dimensions ${matchDim[1]}x${matchDim[2]} désignent généralement le profil **${probableProfile}**.\n*(Équivalence conditionnelle)*`;
        } else {
           prop = `Le profil **${probableProfile}** est repéré. Nous allons finaliser la référence ensemble.`;
        }
        q = "Avez-vous la longueur précise de votre courroie (Ld, Li ou extérieure) ?";
        needsCascade = true;
     }

     let struct2 = `1. 🔍 Diagnostic\n${diag}\n\n`;
     struct2 += `2. 🛠 Solution\n${sol}\n\n`;
     struct2 += `3. 📦 Proposition\n${prop}\n\n`;
     struct2 += `4. ❓ Question utile\n${q}`;

     return { matches: true, message: struct2, tags, needsCascade, detectedType };
  }

  // If context but no strict dims:
  if (isCourroieContext) {
     let diag = symptomMsg || "Sans information précise, il est difficile de définir exactement le profil.";
     let sol = solutionMsg || "Dans la plupart des cas, il s'agit d'une courroie trapézoïdale standard (type A, SPA ou SPZ selon la largeur).";
     let prop = fallbackProp || "Je peux vous proposer l'une de ces gammes classiques dès que nous avons les mesures. C'est la solution la plus fiable.";
     let q = "Pouvez-vous me donner la largeur ou la longueur de la courroie ?";

     let struct3 = `1. 🔍 Diagnostic\n${diag}\n\n`;
     struct3 += `2. 🛠 Solution\n${sol}\n\n`;
     struct3 += `3. 📦 Proposition\n${prop}\n\n`;
     struct3 += `4. ❓ Question utile\n${q}`;

     needsCascade = true;
     return { matches: true, message: struct3, tags, needsCascade, detectedType };
  }

  return { matches: false, message: "", tags: [], needsCascade: false };
};


// ==========================================
// BEARING ANALYSIS — v3 4-BLOCK FORMAT
// ==========================================

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

  // Symptom context
  const hasBruit = rawInputLow.includes("bruit") || rawInputLow.includes("grince");
  const hasChauffe = rawInputLow.includes("chauffe") || rawInputLow.includes("chaud");
  const hasVibre = rawInputLow.includes("vibr");
  const hasTourne = rawInputLow.includes("tourne") || rawInputLow.includes("axe") || rawInputLow.includes("rotation");

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
  
  // Try finding strict bearing numbers
  const numRegex = /(6[023]\d{2}|22[23]\d{2}|30[23]\d{2}|32[02]\d{2})/;
  const matchNum = input.match(numRegex);
  if (matchNum && !likelyType) {
    likelyType = matchNum[1];
  }

  if (likelyType) {
    let suffixText = "";
    if (rawInputLow.includes('2rs') || rawInputLow.includes('ddu') || rawInputLow.includes('llu')) {
       suffixText = " en version **étanche** (2RS / DDU / LLU).";
    } else if (rawInputLow.includes('zz')) {
       suffixText = " en version **flasques métal** (ZZ).";
    }

    const diagText = hasBruit || hasChauffe
      ? `Vous recherchez un roulement **${likelyType}**${suffixText}. Les symptômes mentionnés (${hasBruit ? "bruit " : ""}${hasChauffe ? "échauffement " : ""}${hasVibre ? "vibration" : ""}) confirment l'usure du roulement en place.`
      : `Vous recherchez un roulement **${likelyType}**${suffixText}.`;

    const solText = suffixText
      ? `Nous pouvons vous proposer 3 gammes : économique (ZEN / générique), standard (NTN / SNR) ou premium (SKF / FAG).`
      : `Souhaitez-vous une version étanche (2RS), flasque métal (ZZ) ou ouverte ?\nNous proposons 3 gammes : économique, standard ou premium.`;

    const propText = `✅ Référence identifiée : **${likelyType}**.\nNous pouvons vous faire une proposition rapide selon votre gamme souhaitée.`;

    const qText = suffixText
      ? "Quelle quantité souhaitez-vous ?"
      : "Quel type de protection souhaitez-vous (2RS, ZZ, ouvert) et quelle quantité ?";

    message = `1. 🔍 Diagnostic\n${diagText}\n\n2. 🛠 Solution\n${solText}\n\n3. 📦 Proposition\n${propText}\n\n4. ❓ Question utile\n${qText}`;
    needsCascade = true;
    return { matches: true, message, tags, needsCascade, detectedType };
  }

  // Handle incoherent refs
  if (input.match(/\b([A-Z]*\d{5,}[A-Z]*)\b/)) {
     message = `1. 🔍 Diagnostic\nCette référence ne correspond pas à un standard roulement connu.\n\n2. 🛠 Solution\nNous pouvons rechercher un équivalent à partir des dimensions de la pièce.\n\n3. 📦 Proposition\nUne comparaison par cotes (int × ext × épaisseur) nous permettra de trouver la correspondance exacte.\n\n4. ❓ Question utile\nPouvez-vous nous donner les dimensions gravées ou mesurées (intérieur × extérieur × épaisseur) ?`;
     needsCascade = true;
     return { matches: true, message, tags, needsCascade, detectedType };
  }

  // Palier detection
  if (rawInputLow.match(/ucp|ucf|ucfl|uct|ucfc|insert uc|palier/)) {
    let palierType = "";
    if (rawInputLow.match(/arbre 20|20\s*mm/)) palierType = "série 204 (alésage 20 mm)";
    else if (rawInputLow.match(/arbre 25|25\s*mm/) || rawInputLow.match(/205/)) palierType = "série 205 (alésage 25 mm)";
    
    const diagP = palierType
      ? `Vous recherchez un palier **${palierType}**. Il est interchangeable toutes marques.`
      : "Vous recherchez un **palier** (support de roulement).";
    
    message = `1. 🔍 Diagnostic\n${diagP}\n\n2. 🛠 Solution\nPour éviter toute erreur, le type de corps est important : semelle (UCP), bride carrée (UCF), ovale (UCFL).\n\n3. 📦 Proposition\nNous pouvons vous proposer ce palier en gamme économique ou marque (SKF, SNR, NTN).\n\n4. ❓ Question utile\nS'agit-il d'un palier semelle (UCP), bride carrée (UCF) ou ovale (UCFL) ? Quelle quantité ?`;
    needsCascade = true;
    detectedType = "Palier";
    return { matches: true, message, tags, needsCascade, detectedType };
  }

  // Symptom-based bearing detection
  if (hasTourne && (hasBruit || hasChauffe || hasVibre)) {
    const symptoms = [hasBruit && "bruit", hasChauffe && "échauffement", hasVibre && "vibration"].filter(Boolean).join(", ");
    message = `1. 🔍 Diagnostic\nLes symptômes détectés (**${symptoms}** sur une pièce en rotation) correspondent très souvent à un **roulement usé ou défectueux**.\n\n2. 🛠 Solution\nLe roulement est la pièce tournante la plus sujette à l'usure dans ce type de cas. Il est possible qu'un palier soit également en cause si la pièce est supportée par un corps de palier.\n\n3. 📦 Proposition\nNous pouvons identifier le roulement exact dès que vous nous communiquez les dimensions ou la référence.\n\n4. ❓ Question utile\nPouvez-vous relever la référence gravée sur la bague du roulement, ou mesurer son diamètre intérieur, extérieur et épaisseur ?`;
    needsCascade = true;
    return { matches: true, message, tags, needsCascade, detectedType };
  }

  if (rawInputLow.includes("roulement")) {
    message = `1. 🔍 Diagnostic\nVous souhaitez identifier ou remplacer un **roulement**.\n\n2. 🛠 Solution\nLa référence est généralement gravée sur la bague extérieure. Si elle est illisible, les 3 dimensions suffisent.\n\n3. 📦 Proposition\nNous proposons toutes gammes (économique, standard, premium) avec livraison rapide.\n\n4. ❓ Question utile\nPouvez-vous nous donner la référence gravée ou les dimensions (intérieur × extérieur × épaisseur) ?`;
    needsCascade = true;
    return { matches: true, message, tags, needsCascade, detectedType };
  }
  
  return { matches: false, message: "", tags: [], needsCascade: false };
};

export const analyzeGeneral = (input: string): { matches: boolean; message: string; tags: RequestTag[]; needsCascade: boolean; detectedType?: string } => {
  const normInput = input.toLowerCase();
  
  if (normInput.match(/ucp|ucf|ucfl|uct|ucfc|insert uc|palier/)) {
    return analyzeBearing(input);
  }

  if (normInput.match(/chc|th|tf|btr|six pans creux|inox|8\.8|10\.9|12\.9|m[68]0?|vis|visserie/)) {
    return {
      matches: true,
      message: "1. 🔍 Diagnostic\nCela correspond probablement à de la **visserie** ou fixation.\n\n2. 🛠 Solution\nPour éviter toute erreur, merci de nous préciser :\n- le diamètre (M6, M8, M10…)\n- la longueur\n- le type de tête (CHC, TH, TF…)\n- la matière ou classe (inox, 8.8...) si utile.\n\n3. 📦 Proposition\nNous disposons d'un large stock de visserie standard et inox. Envoyez-nous une photo si besoin.\n\n4. ❓ Question utile\nQuel est le diamètre et la longueur de la vis recherchée ?",
      tags: ["PIECE", "TECHNIQUE"],
      needsCascade: true,
      detectedType: "Visserie"
    };
  }
  
  if (normInput.match(/accouplement|flector|étoile|moyeu|rotex|hrc|n-eupex/)) {
    return {
      matches: true,
      message: "1. 🔍 Diagnostic\nCela correspond probablement à un **accouplement** élastique.\n\n2. 🛠 Solution\nPour éviter toute erreur, merci de nous préciser la marque, les diamètres d'arbre et la taille de l'accouplement.\n\n3. 📦 Proposition\nNous pouvons proposer des pièces d'origine ou équivalentes selon votre besoin.\n\n4. ❓ Question utile\nAvez-vous la marque et la taille de l'accouplement, ou pouvez-vous envoyer une photo des moyeux ?",
      tags: ["PIECE", "TECHNIQUE"],
      needsCascade: true,
      detectedType: "Accouplement"
    };
  }
  
  if (normInput.match(/pneumatique|verin|distributeur|raccord|festo|smc|électrovanne/)) {
    return {
      matches: true,
      message: "1. 🔍 Diagnostic\nCela correspond probablement à un **composant pneumatique** (vérin, distributeur, raccord).\n\n2. 🛠 Solution\nLa marque et la référence exacte sur l'étiquette sont indispensables pour un approvisionnement fiable.\n\n3. 📦 Proposition\nNous travaillons avec les principaux fournisseurs (Festo, SMC, Parker). Envoyez-nous la plaque signalétique.\n\n4. ❓ Question utile\nQuelle est la marque et la référence visible sur la pièce ?",
      tags: ["PIECE", "TECHNIQUE"],
      needsCascade: true,
      detectedType: "Pneumatique"
    };
  }

  if (normInput.match(/filtre|filtration|cartouche|élément filtrant|hydraulique|air/)) {
    return {
      matches: true,
      message: "1. 🔍 Diagnostic\nCela correspond probablement à un **élément de filtration** (air, huile ou hydraulique).\n\n2. 🛠 Solution\nLes dimensions exactes ou la référence de la cartouche sont indispensables pour garantir la bonne cote.\n\n3. 📦 Proposition\nNous pouvons proposer des éléments d'origine ou équivalents selon votre machine.\n\n4. ❓ Question utile\nS'agit-il d'un filtre à air, à huile ou hydraulique ? Avez-vous la référence ou les dimensions ?",
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

  const map = conversions[profile] || {liToLd: 30, liToLe: 50};

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
  
  const converted = compareBelt(mainProfile, lengthType, value);
  const convParts = converted.message.match(/→ Li : \*\*\d+\*\*\n→ Le : \*\*\d+\*\*\n→ Ld : \*\*\d+\*\*/);
  const convText = convParts ? `\n\nConversions probables pour le profil ${mainProfile} :\n${convParts[0]}\n` : "";

  let resultMsg = `[Identification probable]\nSaisie : **${width}x${height} mm** - **${value} ${lengthType}**\n\n→ Profil le plus probable : **${mainProfile}**\nProfils proches (crantés / US) : **${others}**${convText}\n\n⚠️ *Les dimensions seules peuvent correspondre à plusieurs profils, une confirmation est recommandée.*`;

  return {
    equivalent: `${mainProfile} ${Math.round(value)} ${lengthType}`,
    message: resultMsg
  };
};
