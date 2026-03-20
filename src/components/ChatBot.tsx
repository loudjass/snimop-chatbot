"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Search, FileText, Wrench, PhoneCall, ChevronRight, User, Send, ArrowLeft, Camera, Settings, CircleDashed, Zap, UserCheck, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeBelt, analyzeBearing, analyzeGeneral, analyzeSymptoms, compareBelt, compareBeltReverse, normalizeInput, parseLocationUrgency, smartSplitContact, detectRequestType, isVagueInput, isNonTechnicalClient, buildCleanSummary, ChatbotData, RequestTag, saveRequest, generateWhatsAppLink, calculateCompletionScore } from "@/lib/chatbot-logic";

export type FlowCategory = "home" | "courroie" | "roulement" | "inconnu" | "devis" | "piece" | "compare";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  options?: { id: string; label: string; action: () => void; icon?: React.ReactNode }[];
  isCustomUI?: "comparator";
  photoDataUrl?: string; // v5.2: inline photo preview
}

export default function ChatBot() {
  const [currentFlow, setCurrentFlow] = useState<FlowCategory>("home");
  const [step, setStep] = useState<number>(0);
  const [requestData, setRequestData] = useState<ChatbotData>({
    flowType: null,
    tags: []
  });
  
  // Accumulated context across all user turns
  const [accumulatedContext, setAccumulatedContext] = useState<string>("");
  
  // v5.2: Photo file input ref for real file capture
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoDataUrls, setPhotoDataUrls] = useState<string[]>([]);
  
  // Belt Comparator State
  const [compMode, setCompMode] = useState<"classic"|"reverse">("classic");
  const [compProfile, setCompProfile] = useState("SPA");
  const [compWidth, setCompWidth] = useState("");
  const [compHeight, setCompHeight] = useState("");
  const [compLengthType, setCompLengthType] = useState("Li");
  const [compValue, setCompValue] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initialMessage: Message = {
    id: "initial",
    sender: "bot",
    text: "Bonjour ! Je suis l'assistant technique de SNIMOP. Comment puis-je vous aider aujourd'hui ?",
    options: [
      { id: "courroie", label: "Identifier ma courroie", action: () => startFlow("courroie"), icon: <CircleDashed size={16} /> },
      { id: "compare", label: "Comparer / convertir ma courroie", action: () => startFlow("compare"), icon: <Settings size={16} /> },
      { id: "roulement", label: "Identifier mon roulement", action: () => startFlow("roulement"), icon: <Settings size={16} /> },
      { id: "inconnu", label: "Je ne sais pas ce que c'est", action: () => startFlow("inconnu"), icon: <Search size={16} /> },
      { id: "devis", label: "Demande de devis intervention", action: () => startFlow("devis"), icon: <FileText size={16} /> },
      { id: "piece", label: "Recherche de pièce technique", action: () => startFlow("piece"), icon: <Wrench size={16} /> },
    ]
  };

  const [cascadePending, setCascadePending] = useState(false);
  const [awaitingField, setAwaitingField] = useState<"phone" | "email" | null>(null);

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const messagesRef = useRef(messages);
  const [inputValue, setInputValue] = useState("");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    messagesRef.current = messages;
  }, [messages]);

  const addMessage = (sender: "bot" | "user", text: string, options?: Message["options"], isCustomUI?: "comparator", photoDataUrl?: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), sender, text, options, isCustomUI, photoDataUrl }]);
  };

  const addTag = (tag: RequestTag) => {
    setRequestData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag]
    }));
  };

  const startFlow = (flowId: FlowCategory | "compare") => {
    const option = messages[messages.length - 1].options?.find(o => o.id === flowId);
    if (!option) return;

    addMessage("user", option.label);
    setCurrentFlow(flowId);
    setStep(1);
    setCascadePending(false);
    setAwaitingField(null);
    setAccumulatedContext("");
    
    setRequestData({ flowType: flowId, tags: [] });

    setTimeout(() => {
      let nextText = "";
      if (flowId === "compare") {
        addMessage("bot", "Sélectionnez votre profil, le type de longueur et entrez la valeur pour voir l'équivalence :", undefined, "comparator");
        return;
      }
      
      if (flowId === "courroie") {
        addTag("COURROIE");
        nextText = "Très bien. Pouvez-vous me donner les dimensions de votre courroie (largeur, hauteur, longueur) ou sa référence si vous la connaissez ?";
      } else if (flowId === "roulement") {
        addTag("ROULEMENT");
        nextText = "Parfait. Connaissez-vous les dimensions du roulement (diamètre interne × externe × épaisseur) ou avez-vous une référence inscrite dessus ?";
      } else if (flowId === "inconnu") {
        addTag("HORS_STANDARD");
        nextText = "Pas de problème. Décrivez la pièce ou dites-moi ce qu'elle fait. Est-ce qu'elle tourne ? Y a-t-il un bruit ?";
      } else if (flowId === "devis") {
        addTag("DEVIS");
        addTag("ALEXANDRE");
        // v5.3: start with the problem, not equipment
        setRequestData(prev => ({ ...prev, orientation: "ALEXANDRE" }));
        nextText = "Quel est le problème ? (ex : porte bloquée, rideau qui ne remonte plus, moteur en panne...)";
      } else if (flowId === "piece") {
        addTag("PIECE");
        addTag("PASCALE");
        nextText = "Entendu. Quel est le type de produit, la marque ou la référence que vous recherchez ?";
      }
      
      addMessage("bot", nextText);
    }, 600);
  };

  const resetFlow = () => {
    setCurrentFlow("home");
    setStep(0);
    setCascadePending(false);
    setAwaitingField(null);
    setAccumulatedContext("");
    setMessages([
      {
        id: Date.now().toString(),
        sender: "bot",
        text: "Comment puis-je vous aider ?",
        options: initialMessage.options
      }
    ]);
  };

  // v5.2: Real photo handler — uses FileReader to store base64
  const handlePhotoUpload = useCallback((file?: File) => {
    const processFile = (f: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPhotoDataUrls(prev => [...prev, dataUrl]);
        setRequestData(prev => ({
          ...prev,
          hasPhoto: true,
          photoCount: (prev.photoCount || 0) + 1,
          photoDataUrls: [...(prev.photoDataUrls || []), dataUrl]
        }));
        addMessage("user", "📷 Photo envoyée", undefined, undefined, dataUrl);
        setTimeout(() => advanceFlow("[Photo]"), 600);
      };
      reader.readAsDataURL(f);
    };

    if (file) {
      processFile(file);
    } else if (photoInputRef.current?.files?.[0]) {
      processFile(photoInputRef.current.files[0]);
      // Reset so same file can be re-selected
      photoInputRef.current.value = "";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFastMode = () => {
    addMessage("user", "Je n'ai pas les infos précises");
    advanceFlow("[FAST_MODE]");
  };

  const handleForceSend = () => {
    addMessage("user", "Envoyer quand même ma demande");
    advanceFlow("[FORCE_SEND]");
  };

  // ==========================================
  // CONTACT EXTRACTION — v4 uses smartSplitContact from lib
  // ==========================================
  const extractContacts = (text: string) => smartSplitContact(text);

  // ==========================================
  // ORIENTATION LABEL
  // ==========================================
  const getOrientationMessage = (data: ChatbotData): string => {
    if (data.flowType === "devis" || data.tags.includes("ALEXANDRE")) {
      return "\n\n→ Votre demande sera traitée par **Alexandre** (équipe terrain / interventions).";
    }
    return "\n\n→ Votre demande sera traitée par **Pascale** (technique / fournitures).";
  };

  // ==========================================
  // FINALIZE REQUEST — v5 clean summary + v5.2 callback + v5.3 photo note
  // ==========================================
  const finalizeRequest = (extraData?: Partial<ChatbotData>) => {
    setTimeout(() => {
      const uMsgs = messagesRef.current.filter(m => m.sender === "user" && m.id !== "initial").map(m => m.text);
      const mergedData = { ...requestData, ...extraData };
      const finalData = {
         ...mergedData,
         photoDataUrls,
         photoCount: photoDataUrls.length || (mergedData.hasPhoto ? 1 : 0),
         completionScore: calculateCompletionScore(mergedData, uMsgs),
         whatsAppUrl: generateWhatsAppLink({ ...mergedData, photoCount: photoDataUrls.length }, uMsgs)
      };

      const summary = buildCleanSummary(finalData);
      
      // v5.3: add photo note if client uploaded photos
      const photoNote = photoDataUrls.length > 0
        ? `\n\n📸 **Pensez à joindre votre photo dans WhatsApp** après ouverture pour un traitement plus rapide.`
        : "";

      addMessage("bot", `${summary}${photoNote}\n\nPrêt ? Envoyez-la directement via WhatsApp.`, [
        { id: "whatsapp", label: "Envoyer par WhatsApp 📲", action: () => window.open(finalData.whatsAppUrl, "_blank"), icon: <PhoneCall size={16} className="text-green-500" /> },
        { id: "callback", label: "Demander à être rappelé", action: () => {
          addMessage("user", "Je souhaite être rappelé");
          setTimeout(() => addMessage("bot", "Quel est le meilleur moment pour vous rappeler ?\n_(ex : ce matin, cet après-midi, demain matin)_"), 500);
        }, icon: <PhoneCall size={16} className="text-brand-blue" /> }
      ]);
      
      saveRequest(finalData);
    }, 800);
  };

  // ==========================================
  // ADVANCE FLOW — v3 multi-turn logic
  // ==========================================
  const advanceFlow = (input: string) => {
    const current = step;

    // Accumulate context
    if (input !== "[FAST_MODE]" && input !== "[FORCE_SEND]" && !input.startsWith("[Photo")) {
      setAccumulatedContext(prev => prev + " " + input);
    }

    setTimeout(() => {

      // ---- AWAITING SPECIFIC FIELD ----
      if (awaitingField === "phone") {
        const phoneMatch = input.match(/(\+33|0)[ \-.]?[1-9]([ \-.]?[0-9]{2}){4}/);
        if (!phoneMatch) {
          addMessage("bot", "Je n'arrive pas à identifier un numéro de téléphone valide. Pouvez-vous le saisir de nouveau ? (ex: 06 12 34 56 78)");
          return;
        }
        setRequestData(prev => ({ ...prev, contactPhone: phoneMatch[0] }));
        setAwaitingField("email");
        addMessage("bot", "Merci. Et votre adresse e-mail pour que nous puissions vous envoyer le devis ?");
        return;
      }

      if (awaitingField === "email") {
        const emailMatch = input.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        const hasEmail = !!emailMatch;
        setRequestData(prev => ({ ...prev, contactEmail: hasEmail ? emailMatch![0] : undefined }));
        finalizeRequest({ contactEmail: hasEmail ? emailMatch![0] : undefined });
        setAwaitingField(null);
        return;
      }

      // ---- CASCADE FOLLOW-UP ----
      if (cascadePending) {
        setCascadePending(false);

        // v5: no filler — go directly to next question
        if (input === "[FAST_MODE]" || input === "[FORCE_SEND]") {
          // fall through to contact collection
        } else if (input.startsWith("[Photo]")) {
          // photo received — continue asking next question
        }

        setTimeout(() => {
          const isIntervention = requestData.orientation === "ALEXANDRE" || requestData.tags?.includes("ALEXANDRE");
          if (isIntervention) {
            // v5 fix: NEVER ask quantity for interventions
            addMessage("bot", "Où se trouve le site d'intervention ?");
          } else if (currentFlow === "courroie" || currentFlow === "roulement" || currentFlow === "inconnu" || currentFlow === "piece") {
            addMessage("bot", "Sur quelle machine ou équipement est-elle montée ?");
          } else {
            addMessage("bot", "Où se trouve le site ?");
          }
          setStep(current + 1);
        }, 500);
        return;
      }

      setStep(current + 1);

      // ==========================================
      // COURROIE FLOW — v5
      // ==========================================
      if (currentFlow === "courroie") {
        if (current === 1) {
          const normInput = normalizeInput(input);

          // v5: vague or non-tech detection
          if (isVagueInput(input)) {
            addMessage("bot", "Pouvez-vous préciser le problème ?\n_(ex : courroie cassée, qui patine, qui saute, usure...)_");
            setStep(current); // don't advance
            return;
          }
          if (isNonTechnicalClient(input)) {
            addMessage("bot", "Pas de problème. La courroie est la bande qui tourne autour des poulies sur votre machine.\n\nAvez-vous une référence inscrite dessus ? (ex: SPA 1250, 17×1320...)\n_Sinon, une photo suffit._", [
              { id: "photo", label: "Envoyer une photo 📷", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
            ]);
            return;
          }

          const analysis = analyzeBelt(normInput);
          if (analysis.matches) {
            analysis.tags.forEach(addTag);
            setRequestData(prev => ({ ...prev, aiAnalysis: analysis.message, orientation: "PASCALE" }));
            if (analysis.needsCascade) {
               setCascadePending(true);
               addMessage("bot", analysis.message, [
                 { id: "fastmode", label: "Je n'ai pas les infos précises", action: () => handleFastMode(), icon: <Zap size={16} className="text-brand-orange" /> },
                 { id: "photo", label: "Envoyer une photo", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
               ]);
            } else {
               addMessage("bot", analysis.message);
               setTimeout(() => addMessage("bot", "Quelle quantité vous en faut-il ?"), 500);
            }
          } else {
            addMessage("bot", "Référence non trouvée. Avez-vous la **largeur** de la courroie ou son **périmètre** ?\n_Sinon, une photo aide beaucoup._", [
              { id: "photo", label: "Envoyer une photo 📷", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
            ]);
          }
        } else if (current === 2) {
           setRequestData(prev => ({ ...prev, quantity: input }));
           addMessage("bot", "Sur quelle machine est-elle montée ?");
        } else if (current === 3) {
           setRequestData(prev => ({ ...prev, application: input }));
           addMessage("bot", "Votre nom et numéro de téléphone ?");
        } else if (current === 4) {
           const contacts = smartSplitContact(input);
           setRequestData(prev => ({ ...prev, contactName: contacts.name, contactCompany: contacts.company, contactPhone: contacts.phone }));
           if (!contacts.phone) {
             setAwaitingField("phone");
             addMessage("bot", "Numéro de téléphone ? (ex: 06 12 34 56 78)");
             return;
           }
           setAwaitingField("email");
           addMessage("bot", "Email ? (optionnel, pour recevoir le devis)");
        }
      } 
      
      // ==========================================
      // ROULEMENT FLOW — v5
      // ==========================================
      else if (currentFlow === "roulement") {
        if (current === 1) {
          const normInput = normalizeInput(input);

          // v5: non-tech detection
          if (isNonTechnicalClient(input)) {
            addMessage("bot", "Un roulement c'est la pièce ronde avec des billes ou des rouleaux dedans, montée sur un axe.\n\nAvez-vous une référence gravée dessus ? (ex: 6205, UC204...)\n_Sinon, une photo suffit._", [
              { id: "photo", label: "Envoyer une photo 📷", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
            ]);
            return;
          }

          const fullCtx = accumulatedContext + " " + normInput;
          let analysis = analyzeBearing(fullCtx);
          if (!analysis.matches) analysis = analyzeBearing(normInput);

          if (analysis.matches) {
            analysis.tags.forEach(addTag);
            setRequestData(prev => ({ ...prev, aiAnalysis: analysis.message, orientation: "PASCALE" }));
            if (analysis.needsCascade) {
               setCascadePending(true);
               addMessage("bot", analysis.message, [
                 { id: "fastmode", label: "Je n'ai pas les infos précises", action: () => handleFastMode(), icon: <Zap size={16} className="text-brand-orange" /> },
                 { id: "photo", label: "Envoyer une photo", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
               ]);
            } else {
               addMessage("bot", analysis.message);
               setTimeout(() => addMessage("bot", "Quelle quantité vous en faut-il ?"), 500);
            }
          } else {
            addMessage("bot", "Référence non reconnue.\n\nAvez-vous les dimensions : **Ø intérieur × Ø extérieur × épaisseur** ? (ex : 25 × 52 × 15)\n_Sinon, une photo de la bague aide._", [
              { id: "photo", label: "Envoyer une photo 📷", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
            ]);
          }
        } else if (current === 2) {
          setRequestData(prev => ({ ...prev, quantity: input }));
          addMessage("bot", "Sur quelle machine est-il monté ?");
        } else if (current === 3) {
          setRequestData(prev => ({ ...prev, application: input }));
          addMessage("bot", "Votre nom et numéro de téléphone ?");
        } else if (current === 4) {
           const contacts = smartSplitContact(input);
           setRequestData(prev => ({ ...prev, contactName: contacts.name, contactCompany: contacts.company, contactPhone: contacts.phone }));
           if (!contacts.phone) {
             setAwaitingField("phone");
             addMessage("bot", "Numéro de téléphone ? (ex: 06 12 34 56 78)");
             return;
           }
           setAwaitingField("email");
           addMessage("bot", "Email ? (optionnel)");
        }
      }

      // ==========================================
      // DEVIS / INTERVENTION FLOW — v5.3 reordered : problem → urgency → location → equipment → contacts
      // ==========================================
      else if (currentFlow === "devis") {
        if (current === 1) {
          // Turn 1: What is the problem?
          if (isVagueInput(input)) {
            addMessage("bot", "Pouvez-vous préciser ?\n_(ex : ne s'ouvre plus, bruit, blocage, télécommande morte...)_");
            setStep(current);
            return;
          }
          const normIssue = normalizeInput(input);
          setRequestData(prev => ({ ...prev, issueDescription: normIssue, symptoms: normIssue, orientation: "ALEXANDRE" }));
          addTag("ALEXANDRE");
          if (/urgent|arrêt|bloqué|bloquée|sécurité|immédiat/i.test(input)) {
            addTag("URGENT");
            // Already urgent — skip urgency turn
            setRequestData(prev => ({ ...prev, urgency: "Intervention immédiate" }));
            addMessage("bot", "Où se trouve le site ?");
            setStep(current + 2); // skip turn 2 (urgency already known)
            return;
          }
          addMessage("bot", "C'est urgent ? Ou pouvons-nous planifier ?");
        } else if (current === 2) {
          // Turn 2: Urgency
          const urgency = normalizeInput(input);
          setRequestData(prev => ({ ...prev, urgency }));
          if (/immédiat|urgent|stop|arrêt|bloqu/i.test(input)) addTag("URGENT");
          addMessage("bot", "Où se trouve le site ?");
        } else if (current === 3) {
          // Turn 3: Location
          const parsed = parseLocationUrgency(input);
          setRequestData(prev => ({ ...prev, location: parsed.location || input }));
          addMessage("bot", "Quel type d'équipement ? (porte, rideau, volet, machine...)");
        } else if (current === 4) {
          // Turn 4: Equipment type
          const normEquipment = normalizeInput(input);
          setRequestData(prev => ({ ...prev, equipmentType: normEquipment }));
          addMessage("bot", "Votre nom et téléphone ?");
        } else if (current === 5) {
          // Turn 5: Contact
          const contacts = smartSplitContact(input);
          setRequestData(prev => ({ ...prev, contactName: contacts.name, contactCompany: contacts.company, contactPhone: contacts.phone }));
          if (!contacts.phone) {
            setAwaitingField("phone");
            addMessage("bot", "Numéro de téléphone ? (ex: 06 12 34 56 78)");
            return;
          }
          setAwaitingField("email");
          addMessage("bot", "Email ? (pour la confirmation)");
        }
      }

      // ==========================================
      // INCONNU / PIECE FLOW — v5 smart routing
      // ==========================================
      else if (currentFlow === "inconnu" || currentFlow === "piece") {
        if (current === 1) {
          const normInput = normalizeInput(input);

          // v5: non-technical client mode
          if (isNonTechnicalClient(input)) {
            addMessage("bot", "Pas de souci, on va trouver ensemble.\n\nEst-ce que la pièce **tourne** ? (ex : roue, axe, tambour, ventilateur)", [
              { id: "photo", label: "Je préfère envoyer une photo 📷", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
            ]);
            setCascadePending(true);
            return;
          }

          // v5: vague input → ask for clarification
          if (isVagueInput(input)) {
            addMessage("bot", "Pouvez-vous préciser un peu ?\n_(ex : ne s'ouvre plus, fait du bruit, tourne mal, est bloqué...)_");
            setStep(current); // don't advance
            return;
          }

          // v5: auto-detect PIECE vs INTERVENTION
          const reqType = detectRequestType(normInput);

          if (reqType === "INTERVENTION") {
            // v5: offer devis vs renseignement FIRST
            setRequestData(prev => ({ ...prev, issueDescription: normInput }));
            addMessage("bot", "Souhaitez-vous :", [
              { id: "devis_interv", label: "🛠 Un devis d'intervention (on envoie quelqu'un)", action: () => {
                addMessage("user", "Devis d'intervention");
                setCurrentFlow("devis");
                setRequestData(prev => ({ ...prev, flowType: "devis", orientation: "ALEXANDRE", equipmentType: normInput }));
                addTag("DEVIS"); addTag("ALEXANDRE");
                setTimeout(() => addMessage("bot", "Quel est le problème exactement ?"), 500);
              }, icon: <HardHat size={16} className="text-brand-orange" /> },
              { id: "renseign", label: "💡 Juste un renseignement", action: () => {
                addMessage("user", "Renseignement technique");
                addTag("TECHNIQUE");
                setTimeout(() => addMessage("bot", "Bien sûr. Qu'est-ce qui se passe exactement avec cet équipement ?"), 500);
              }, icon: <Search size={16} className="text-brand-blue" /> }
            ]);
            return;
          }

          // v5 priority: run symptom engine FIRST (roulement before courroie for bruit+rotation)
          const symptomsFirst = analyzeSymptoms(accumulatedContext + " " + normInput);
          if (symptomsFirst.suggestedType === "ROULEMENT" && symptomsFirst.confidence !== "LOW") {
            const bearingAnalysis = analyzeBearing(normInput);
            if (bearingAnalysis.matches) {
              bearingAnalysis.tags.forEach(addTag);
              setRequestData(prev => ({ ...prev, aiAnalysis: bearingAnalysis.message, productType: bearingAnalysis.detectedType, orientation: "PASCALE" }));
              if (bearingAnalysis.needsCascade) {
                 setCascadePending(true);
                 addMessage("bot", bearingAnalysis.message, [
                   { id: "fastmode", label: "Je n'ai pas les infos précises", action: () => handleFastMode(), icon: <Zap size={16} className="text-brand-orange" /> },
                   { id: "photo", label: "Envoyer une photo", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
                 ]);
              } else {
                 addMessage("bot", bearingAnalysis.message);
                 setTimeout(() => addMessage("bot", "Quelle quantité vous en faut-il ?"), 500);
              }
              return;
            } else {
              addTag("ROULEMENT"); addTag("PASCALE");
              setRequestData(prev => ({ ...prev, orientation: "PASCALE" }));
              addMessage("bot", `${symptomsFirst.hypothesis}\n\n${symptomsFirst.nextQuestion}\n_Ou envoyez une photo si plus simple._`, [
                { id: "photo", label: "Envoyer une photo 📷", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
              ]);
              setCascadePending(true);
              return;
            }
          }

          // Standard analysis: belt > bearing > general
          let analysis = analyzeBelt(normInput);
          if (!analysis.matches) analysis = analyzeBearing(normInput);
          if (!analysis.matches) analysis = analyzeGeneral(normInput);

          if (analysis.matches) {
            analysis.tags.forEach(addTag);
            setRequestData(prev => ({ ...prev, aiAnalysis: analysis.message, productType: analysis.detectedType, orientation: "PASCALE" }));
            if (analysis.needsCascade) {
               setCascadePending(true);
               addMessage("bot", analysis.message, [
                 { id: "fastmode", label: "Je n'ai pas les infos précises", action: () => handleFastMode(), icon: <Zap size={16} className="text-brand-orange" /> },
                 { id: "photo", label: "Envoyer une photo", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
               ]);
            } else {
               addMessage("bot", analysis.message);
               setTimeout(() => addMessage("bot", "Quelle quantité vous en faut-il ?"), 500);
            }
          } else {
            // No match — symptom engine
            const symptomsResult = analyzeSymptoms(normInput);
            if (symptomsResult.hypothesis) {
              const isInterv = symptomsResult.suggestedType === "DEVIS";
              if (symptomsResult.suggestedType) addTag(symptomsResult.suggestedType);
              if (isInterv) { addTag("ALEXANDRE"); setRequestData(prev => ({ ...prev, orientation: "ALEXANDRE" })); }
              else { addTag("PASCALE"); setRequestData(prev => ({ ...prev, orientation: "PASCALE" })); }

              addMessage("bot", `${symptomsResult.hypothesis}\n\n${symptomsResult.nextQuestion}\n_Vous pouvez aussi envoyer une photo._`, [
                { id: "photo", label: "Envoyer une photo 📷", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
              ]);
              setCascadePending(true);
            } else {
              // Total fallback: offer photo + basic questions
              addMessage("bot", "Pour trouver la bonne pièce, j'ai besoin de savoir :\n\nEst-ce que ça **tourne** ? Y a-t-il un **bruit** ou **échauffement** ?", [
                { id: "photo", label: "Plus simple avec une photo 📷", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
              ]);
              setCascadePending(true);
            }
          }
        } else if (current === 2) {
          const normInput2 = normalizeInput(input);
          const fullCtx = accumulatedContext + " " + normInput2;

          // v5: re-check INTERVENTION on turn 2 if it came through fallback
          const reqType2 = detectRequestType(normInput2);
          if (reqType2 === "INTERVENTION" && !requestData.orientation) {
            setRequestData(prev => ({ ...prev, issueDescription: normInput2 }));
            addMessage("bot", "Souhaitez-vous :", [
              { id: "devis_interv", label: "🛠 Devis d'intervention", action: () => {
                addMessage("user", "Devis d'intervention");
                setCurrentFlow("devis");
                setRequestData(prev => ({ ...prev, flowType: "devis", orientation: "ALEXANDRE" }));
                addTag("DEVIS"); addTag("ALEXANDRE");
                setTimeout(() => addMessage("bot", "Quel est le problème exactement ?"), 500);
              }, icon: <HardHat size={16} className="text-brand-orange" /> },
              { id: "renseign", label: "💡 Renseignement", action: () => {
                addMessage("user", "Renseignement");
                addTag("TECHNIQUE");
                setTimeout(() => addMessage("bot", "Qu'est-ce qui se passe exactement ?"), 500);
              }, icon: <Search size={16} className="text-brand-blue" /> }
            ]);
            return;
          }

          let analysis2 = analyzeBelt(fullCtx);
          if (!analysis2.matches) analysis2 = analyzeBearing(fullCtx);
          if (!analysis2.matches) analysis2 = analyzeGeneral(fullCtx);

          if (analysis2.matches) {
            analysis2.tags.forEach(addTag);
            setRequestData(prev => ({ ...prev, aiAnalysis: analysis2.message, productType: analysis2.detectedType }));
            if (analysis2.needsCascade) {
               setCascadePending(true);
               addMessage("bot", analysis2.message, [
                 { id: "fastmode", label: "Je n'ai pas les infos précises", action: () => handleFastMode(), icon: <Zap size={16} className="text-brand-orange" /> },
                 { id: "photo", label: "Envoyer une photo", action: () => handlePhotoUpload(), icon: <Camera size={16} /> }
               ]);
            } else {
               addMessage("bot", analysis2.message);
               setTimeout(() => addMessage("bot", "Quelle quantité vous en faut-il ?"), 500);
            }
          } else {
            const symptomsResult2 = analyzeSymptoms(fullCtx);
            if (symptomsResult2.hypothesis) {
              addMessage("bot", `${symptomsResult2.hypothesis}\n\n${symptomsResult2.nextQuestion}`);
              setCascadePending(true);
            } else {
              addMessage("bot", "Notre équipe prendra en charge votre demande.\n\nQuelle quantité vous en faut-il ?");
            }
          }
        } else if (current === 3) {
          setRequestData(prev => ({ ...prev, quantity: input }));
          addMessage("bot", "Sur quelle machine est-elle montée ?");
        } else if (current === 4) {
          setRequestData(prev => ({ ...prev, application: input }));
          addMessage("bot", "Votre nom et téléphone ?");
        } else if (current === 5) {
           const contacts = smartSplitContact(input);
           setRequestData(prev => ({ ...prev, contactName: contacts.name, contactCompany: contacts.company, contactPhone: contacts.phone }));
           if (!contacts.phone) {
             setAwaitingField("phone");
             addMessage("bot", "Numéro de téléphone ? (ex: 06 12 34 56 78)");
             return;
           }
           setAwaitingField("email");
           addMessage("bot", "Email ? (optionnel)");
        }
      }
      
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    addMessage("user", inputValue);
    const savedInput = inputValue;
    setInputValue("");

    advanceFlow(savedInput);
  };

  const handleComparatorSubmit = () => {
    const val = parseFloat(compValue);
    if (!val || isNaN(val)) return;

    let result;
    let userInputMsg = "";
    let aiEquivStr = "";

    if (compMode === "classic") {
       result = compareBelt(compProfile, compLengthType, val);
       userInputMsg = `Comparaison : ${compProfile} ${val} ${compLengthType}`;
       aiEquivStr = result.equivalent;
    } else {
       const w = parseFloat(compWidth);
       const h = parseFloat(compHeight);
       if (!w || !h || isNaN(w) || isNaN(h)) return;
       result = compareBeltReverse(w, h, compLengthType, val);
       userInputMsg = `Recherche inversée : ${w}x${h} mm - ${val} ${compLengthType}`;
       aiEquivStr = result.equivalent;
    }
    
    addMessage("user", userInputMsg);
    
    setTimeout(() => {
      addMessage("bot", result.message);
      
      setTimeout(() => {
        addTag("COURROIE");
        setRequestData(prev => ({ 
           ...prev, 
           flowType: "courroie", 
           orientation: "PASCALE",
           aiAnalysis: `${userInputMsg} -> Equivalent : ${aiEquivStr}`,
           dimensions: aiEquivStr
        }));
        setCurrentFlow("courroie");
        setStep(2);
        addMessage("bot", "Si vous souhaitez commander ou demander un prix pour cette courroie, quelle quantité vous faut-il et sur quelle machine est-elle montée ?");
      }, 1500);
      
    }, 600);
  };

  return (
    <div className="bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[85vh] md:h-[650px] w-full rounded-2xl md:rounded-3xl overflow-hidden">
      {/* Chat Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-brand-blue to-brand-blue-light text-white flex items-center justify-between z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg leading-tight">Assistant Tech SNIMOP</h3>
            <p className="text-blue-100 text-xs flex items-center gap-1 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-400"></span> En ligne
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Orientation badge */}
          {currentFlow === "devis" && (
            <span className="text-xs bg-orange-500/30 text-orange-100 px-2 py-1 rounded-full flex items-center gap-1 shrink-0">
              <HardHat size={12} /> Alexandre
            </span>
          )}
          {(currentFlow === "courroie" || currentFlow === "roulement" || currentFlow === "piece" || currentFlow === "compare") && (
            <span className="text-xs bg-blue-400/30 text-blue-100 px-2 py-1 rounded-full flex items-center gap-1 shrink-0">
              <UserCheck size={12} /> Pascale
            </span>
          )}
          {currentFlow !== "home" && (
            <button 
              onClick={resetFlow}
              className="text-white/80 hover:text-white transition-colors flex items-center gap-1 text-xs md:text-sm bg-black/10 px-3 py-2 rounded-full hover:bg-black/20 shrink-0 min-h-[44px]"
            >
              <ArrowLeft size={14} /> Retour
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto flex flex-col gap-5">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn("flex gap-3", message.sender === "user" ? "flex-row-reverse" : "")}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                message.sender === "bot" 
                  ? "bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20" 
                  : "bg-brand-orange text-white"
              )}>
                {message.sender === "bot" ? <Bot size={16} /> : <User size={16} />}
              </div>
              
              <div className={cn(
                "max-w-[85%] rounded-2xl shadow-sm border p-4 text-sm md:text-base",
                message.sender === "user"
                  ? "bg-brand-blue text-white rounded-tr-sm border-transparent"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-sm border-slate-100 dark:border-slate-700 font-medium leading-relaxed"
              )}>
                <p className="whitespace-pre-wrap">{message.text}</p>
                
                {/* v5.2: Photo preview for user uploads */}
                {message.photoDataUrl && (
                  <div className="mt-2">
                    <img
                      src={message.photoDataUrl}
                      alt="Photo envoyée"
                      className="max-w-[200px] max-h-[200px] rounded-xl object-cover border-2 border-white/30 shadow-md"
                    />
                  </div>
                )}
                
                {/* Options display */}
                {message.options && message.sender === "bot" && (
                  <div className="space-y-2 mt-4">
                    {message.options.map((option) => (
                      <button 
                        key={option.id}
                        onClick={option.action}
                        className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-brand-blue hover:bg-blue-50 dark:border-slate-700 dark:hover:border-brand-blue dark:hover:bg-brand-blue/10 transition-colors flex items-center justify-between group text-slate-700 dark:text-slate-300"
                      >
                        <span className="flex items-center gap-3">
                          {option.icon && <span className="text-brand-blue/80 dark:text-brand-blue-light">{option.icon}</span>}
                          {option.label}
                        </span>
                        <ChevronRight size={16} className="text-slate-400 group-hover:text-brand-blue" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom Comparator UI */}
                {message.isCustomUI === "comparator" && message.sender === "bot" && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-700 flex flex-col gap-4">
                     
                     <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
                        <button onClick={() => setCompMode("classic")} className={cn("flex-1 py-1.5 text-sm font-medium rounded-md", compMode === "classic" ? "bg-white dark:bg-slate-700 shadow text-brand-blue" : "text-slate-500 hover:text-slate-700")}>Profil Connu</button>
                        <button onClick={() => setCompMode("reverse")} className={cn("flex-1 py-1.5 text-sm font-medium rounded-md", compMode === "reverse" ? "bg-white dark:bg-slate-700 shadow text-brand-orange" : "text-slate-500 hover:text-slate-700")}>Dimension 📏</button>
                     </div>

                     {compMode === "classic" ? (
                       <div className="grid grid-cols-2 gap-3">
                         <label className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-300">
                           Profil (Section)
                           <select 
                             value={compProfile} 
                             onChange={e => setCompProfile(e.target.value)}
                             className="mt-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                           >
                              <option value="A">A / 4L / 13x8</option>
                              <option value="AX">AX</option>
                              <option value="B">B / 5L / 17x11</option>
                              <option value="BX">BX</option>
                              <option value="C">C / 22x14</option>
                              <option value="CX">CX</option>
                              <option value="Z">Z / 3L / 10x6</option>
                              <option value="SPA">SPA</option>
                              <option value="SPB">SPB</option>
                              <option value="SPC">SPC</option>
                              <option value="SPZ">SPZ</option>
                              <option value="XPA">XPA</option>
                              <option value="XPB">XPB</option>
                              <option value="XPC">XPC</option>
                              <option value="XPZ">XPZ</option>
                           </select>
                         </label>
                         <label className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-300">
                           Type Longueur
                           <select 
                             value={compLengthType} 
                             onChange={e => setCompLengthType(e.target.value)}
                             className="mt-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                           >
                              <option value="Li">Li (intérieure)</option>
                              <option value="Le">Le (extérieure)</option>
                              <option value="Ld">Ld (primitive)</option>
                           </select>
                         </label>
                       </div>
                     ) : (
                       <div className="grid grid-cols-2 gap-3">
                         <label className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-300">
                           Largeur (mm)
                           <input type="number" placeholder="ex: 13" value={compWidth} onChange={e => setCompWidth(e.target.value)} className="mt-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"/>
                         </label>
                         <label className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-300">
                           Hauteur (mm)
                           <input type="number" placeholder="ex: 8" value={compHeight} onChange={e => setCompHeight(e.target.value)} className="mt-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"/>
                         </label>
                         <label className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-300 col-span-2">
                           Type Longueur
                           <select 
                             value={compLengthType} 
                             onChange={e => setCompLengthType(e.target.value)}
                             className="mt-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                           >
                              <option value="Li">Li (intérieure)</option>
                              <option value="Le">Le (extérieure)</option>
                              <option value="Ld">Ld (primitive)</option>
                           </select>
                         </label>
                       </div>
                     )}

                     <label className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-300">
                         Valeur (mm)
                         <input 
                           type="number"
                           placeholder="Ex: 1250"
                           value={compValue}
                           onChange={e => setCompValue(e.target.value)}
                           className="mt-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                         />
                     </label>

                     <button 
                       onClick={handleComparatorSubmit}
                       disabled={!compValue || (compMode === "reverse" && (!compWidth || !compHeight))}
                       className="w-full mt-2 py-3 rounded-lg bg-brand-blue text-white font-medium hover:bg-brand-blue-light transition-colors disabled:opacity-50"
                     >
                       Calculer l'équivalence
                     </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
        {/* v5.2: Fast-exit quick send bar */}
        {currentFlow !== "home" && step === 1 && (
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                addMessage("bot", "Pas de problème. Laissez-moi votre numéro et on vous rappelle rapidement.");
                setAwaitingField("phone");
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-brand-blue transition-colors flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700"
            >
              <PhoneCall size={12} /> Aller plus vite ? Laissez votre numéro
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 relative items-center">
          {/* v5.2: Real photo input with FileReader */}
          <input
            ref={photoInputRef}
            id="photo-upload"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={currentFlow === "home"}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handlePhotoUpload(e.target.files[0]);
              }
            }}
          />
          <label
            htmlFor="photo-upload"
            title="Envoyer une photo"
            className={cn(
              "min-w-[48px] h-[48px] rounded-full flex items-center justify-center transition-colors shrink-0 shadow-sm cursor-pointer",
              currentFlow === "home"
                ? "text-slate-400 bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed pointer-events-none"
                : photoDataUrls.length > 0
                  ? "text-white bg-brand-blue hover:bg-brand-blue/90 active:scale-95"
                  : "text-slate-600 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95"
            )}
          >
            <Camera size={22} />
            {photoDataUrls.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-orange text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {photoDataUrls.length}
              </span>
            )}
          </label>
          
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={currentFlow === "home" ? "Sélectionnez une option ci-dessus..." : "Tapez votre message..."}
            disabled={currentFlow === "home"}
            className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-full px-5 h-[48px] focus:outline-none focus:ring-2 focus:ring-brand-blue/50 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium"
          />
          <button
            type="submit"
            disabled={currentFlow === "home" || !inputValue.trim()}
            className="min-w-[48px] h-[48px] rounded-full bg-brand-orange text-white flex items-center justify-center hover:bg-brand-orange-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 active:scale-95"
          >
            <Send size={20} className="translate-x-[1px] translate-y-[-1px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
