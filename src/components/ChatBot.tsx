"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Search, FileText, Wrench, PhoneCall, ChevronRight, User, Send, ArrowLeft, Camera, Settings, CircleDashed, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { analyzeBelt, analyzeBearing, analyzeGeneral, compareBelt, ChatbotData, RequestTag, saveRequest, generateWhatsAppLink, calculateCompletionScore } from "@/lib/chatbot-logic";

export type FlowCategory = "home" | "courroie" | "roulement" | "inconnu" | "devis" | "piece" | "compare";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  options?: { id: string; label: string; action: () => void; icon?: React.ReactNode }[];
  isCustomUI?: "comparator";
}

export default function ChatBot() {
  const [currentFlow, setCurrentFlow] = useState<FlowCategory>("home");
  const [step, setStep] = useState<number>(0);
  const [requestData, setRequestData] = useState<ChatbotData>({
    flowType: null,
    tags: []
  });
  
  // Belt Comparator State
  const [compProfile, setCompProfile] = useState("SPA");
  const [compLengthType, setCompLengthType] = useState("Li");
  const [compValue, setCompValue] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initialMessage: Message = {
    id: "initial",
    sender: "bot",
    text: "Bonjour ! Je suis l'assistant virtuel de SNIMOP. Comment puis-je vous aider aujourd'hui ?",
    options: [
      { id: "courroie", label: "Identifier ma courroie", action: () => startFlow("courroie"), icon: <CircleDashed size={16} /> },
      { id: "compare", label: "Comparer / convertir ma courroie", action: () => startFlow("compare"), icon: <Settings size={16} /> },
      { id: "roulement", label: "Identifier mon roulement", action: () => startFlow("roulement"), icon: <Settings size={16} /> },
      { id: "inconnu", label: "Je ne connais pas la référence", action: () => startFlow("inconnu"), icon: <Search size={16} /> },
      { id: "devis", label: "Demande de devis intervention", action: () => startFlow("devis"), icon: <FileText size={16} /> },
      { id: "piece", label: "Recherche de pièce", action: () => startFlow("piece"), icon: <Wrench size={16} /> },
    ]
  };

  const [cascadePending, setCascadePending] = useState(false);

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

  const addMessage = (sender: "bot" | "user", text: string, options?: Message["options"], isCustomUI?: "comparator") => {
    setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), sender, text, options, isCustomUI }]);
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
        nextText = "Parfait. Connaissez-vous les dimensions du roulement (diamètre interne x externe x épaisseur) ou avez-vous une référence inscrite dessus ?";
      } else if (flowId === "inconnu") {
        addTag("HORS_STANDARD");
        nextText = "Pas de problème. Guider nos clients est notre métier. Pouvez-vous me décrire la pièce ou son utilité ? Vous pouvez aussi envoyer une photo si besoin.";
      } else if (flowId === "devis") {
        addTag("DEVIS");
        nextText = "Oui, nous pouvons intervenir. Dans la plupart des cas, un diagnostic est nécessaire pour identifier précisément la panne. Quel est le type d’équipement et le problème rencontré ?";
      } else if (flowId === "piece") {
        addTag("PIECE");
        nextText = "Entendu. Quel est le type de produit, la marque ou la référence que vous recherchez ?";
      }
      
      addMessage("bot", nextText);
    }, 600);
  };

  const resetFlow = () => {
    setCurrentFlow("home");
    setStep(0);
    setCascadePending(false);
    setMessages([
      {
        id: Date.now().toString(),
        sender: "bot",
        text: "Comment puis-je vous aider d'autre ?",
        options: initialMessage.options
      }
    ]);
  };

  const handlePhotoUpload = () => {
    addMessage("user", "[Photo envoyée 📷]");
    setRequestData(prev => ({ ...prev, hasPhoto: true }));
    
    setTimeout(() => {
      addMessage("bot", "Merci pour la photo, elle a bien été ajoutée à votre dossier d'analyse.");
      advanceFlow("[Photo]");
    }, 1000);
  };

  const handleFastMode = () => {
    addMessage("user", "Je n'ai pas toutes les informations");
    advanceFlow("[FAST_MODE]");
  };

  const handleForceSend = () => {
    addMessage("user", "Envoyer quand même ma demande");
    advanceFlow("[FORCE_SEND]");
  };

  const finalizeRequest = () => {
    setTimeout(() => {
      const uMsgs = messagesRef.current.filter(m => m.sender === "user" && m.id !== "initial").map(m => m.text);
      const finalData = {
         ...requestData,
         completionScore: calculateCompletionScore(requestData, uMsgs),
         whatsAppUrl: generateWhatsAppLink(requestData, uMsgs)
      };

      addMessage("bot", "Parfait, votre demande est prête.\nNous pouvons vous envoyer une solution rapidement.\n\nVous pouvez l’envoyer directement via WhatsApp ci-dessous.", [
        { id: "whatsapp", label: "Envoyer ma demande par WhatsApp", action: () => window.open(finalData.whatsAppUrl, "_blank"), icon: <PhoneCall size={16} className="text-green-500" /> }
      ]);
      
      saveRequest(finalData);
    }, 800);
  };

  const advanceFlow = (input: string) => {
    const current = step;

    // Contact info extraction (used when waiting for coords)
    const extractContacts = (text: string) => {
      let extracted = { name: "", phone: "", company: "" };
      const lines = text.split('\n');
      
      // Smart extraction if single line
      if (lines.length === 1) {
         // Phone extraction
         const phoneMatch = text.match(/(\+33|0)[ \-.]?[1-9]([ \-.]?[0-9]{2}){4}/);
         if (phoneMatch) extracted.phone = phoneMatch[0];
         
         const withoutPhone = text.replace(extracted.phone, "").trim();
         const words = withoutPhone.split(" ").filter(w => w.length > 0);
         
         // Assuming last word is company or if it's all caps like SNIMOP
         if (words.length > 0) {
            const potentialCompanyIndex = words.findIndex(w => w === w.toUpperCase() && w.length > 2);
            if (potentialCompanyIndex !== -1) {
               extracted.company = words[potentialCompanyIndex];
               words.splice(potentialCompanyIndex, 1);
            } else {
               extracted.company = words.pop() || "";
            }
            extracted.name = words.join(" ");
         }
      } else {
         // Very basic multi-line fallback matching exact prompt layout
         lines.forEach(l => {
            if (l.toLowerCase().includes("nom")) extracted.name = l.split(":")[1]?.trim() || "";
            if (l.toLowerCase().includes("société") || l.toLowerCase().includes("societe")) extracted.company = l.split(":")[1]?.trim() || "";
            if (l.toLowerCase().includes("tel") || l.toLowerCase().includes("téléphone")) extracted.phone = l.split(":")[1]?.trim() || "";
         });
      }
      return extracted;
    };

    setTimeout(() => {
      // Priority Check: Cascade follow-up logic
      if (cascadePending) {
        setCascadePending(false);
        if (input === "[FAST_MODE]" || input === "[FORCE_SEND]") {
           addMessage("bot", "Ces informations sont importantes pour garantir la compatibilité. Nous allons tout de même l'ajouter à votre dossier.");
        } else if (input.length < 5 && !requestData.hasPhoto && !input.includes("Photo")) {
           addMessage("bot", "C'est noté. Si vous n'avez pas toutes les données, l'équipe regardera avec ces éléments.");
        } else {
           addMessage("bot", `Très bien, ${input.length < 20 ? input : "merci pour cette précision"}, c'est noté.`);
        }
        
        setTimeout(() => {
          if (currentFlow === "courroie") {
             addMessage("bot", "Quelle quantité vous faut-il et à quoi sert cette courroie (application) ?");
          } else if (currentFlow === "roulement") {
             addMessage("bot", "Quelle est l'application ou la machine de destination ?");
          } else if (currentFlow === "inconnu" || currentFlow === "piece") {
             addMessage("bot", "Quelle quantité souhaitez-vous et avez-vous d'autres précisions techniques ?");
          } else {
             addMessage("bot", "Merci de compléter vos coordonnées :\nNom :\nSociété :\nTéléphone :");
             setStep(current + 1);
          }
        }, 800);
        return;
      }

      setStep(current + 1);

      if (currentFlow === "courroie") {
        if (current === 1) {
          const analysis = analyzeBelt(input);
          if (analysis.matches) {
            analysis.tags.forEach(addTag);
            setRequestData(prev => ({ ...prev, aiAnalysis: analysis.message }));
            if (analysis.needsCascade) {
               setCascadePending(true);
               addMessage("bot", analysis.message, [
                 { id: "fastmode", label: "Je n'ai pas toutes les informations", action: () => handleFastMode(), icon: <Zap size={16} className="text-brand-orange" /> },
                 { id: "force_send", label: "Envoyer quand même ma demande", action: () => handleForceSend(), icon: <Send size={16} className="text-brand-blue" /> }
               ]);
            } else {
               addMessage("bot", analysis.message);
               setTimeout(() => addMessage("bot", "Quelle quantité vous faut-il et à quoi sert cette courroie (application) ?"), 800);
            }
          } else {
            addMessage("bot", "Je n'ai pas pu identifier formellement la courroie avec ces dimensions. L'équipe technique l'analysera.");
            setTimeout(() => addMessage("bot", "Quelle quantité vous faut-il et à quoi sert cette courroie (application) ?"), 800);
          }
        } else if (current === 2) {
           addMessage("bot", "Merci de compléter vos coordonnées :\nNom :\nSociété :\nTéléphone :");
        } else if (current === 3) {
           const contacts = extractContacts(input);
           if (!contacts.phone) {
             addMessage("bot", "Il nous manque encore le numéro de téléphone pour finaliser votre demande. Pourriez-vous nous le fournir ?");
             setStep(current - 1);
             return;
           }
           setRequestData(prev => ({ ...prev, contactName: contacts.name, contactCompany: contacts.company, contactPhone: contacts.phone }));
           finalizeRequest();
        }
      } 
      
      else if (currentFlow === "roulement") {
        if (current === 1) {
          const analysis = analyzeBearing(input);
          if (analysis.matches) {
            analysis.tags.forEach(addTag);
            setRequestData(prev => ({ ...prev, aiAnalysis: analysis.message }));
            if (analysis.needsCascade) {
               setCascadePending(true);
               addMessage("bot", analysis.message, [
                 { id: "fastmode", label: "Je n'ai pas toutes les informations", action: () => handleFastMode(), icon: <Zap size={16} className="text-brand-orange" /> },
                 { id: "force_send", label: "Envoyer quand même ma demande", action: () => handleForceSend(), icon: <Send size={16} className="text-brand-blue" /> }
               ]);
            } else {
               addMessage("bot", analysis.message);
               setTimeout(() => addMessage("bot", "Quelle est l'application ou la machine de destination ?"), 800);
            }
          } else {
            addMessage("bot", "C'est noté. Notre équipe cherchera la correspondance exacte.");
            setTimeout(() => addMessage("bot", "Quelle est l'application ou la machine de destination ?"), 800);
          }
        } else if (current === 2) {
          addMessage("bot", "Merci de compléter vos coordonnées :\nNom :\nSociété :\nTéléphone :");
        } else if (current === 3) {
           const contacts = extractContacts(input);
           if (!contacts.phone) {
             addMessage("bot", "Il nous manque encore le numéro de téléphone pour finaliser votre demande. Pourriez-vous nous le fournir ?");
             setStep(current - 1);
             return;
           }
           setRequestData(prev => ({ ...prev, contactName: contacts.name, contactCompany: contacts.company, contactPhone: contacts.phone }));
           finalizeRequest();
        }
      }

      else if (currentFlow === "devis") {
        if (current === 1) {
          addMessage("bot", "Merci pour ces précisions. Dans quel contexte l'équipement est-il utilisé et quelle est l'urgence ? (Vous pouvez aussi nous envoyer une photo du problème ou de la plaque signalétique)");
          addTag("URGENT");
        } else if (current === 2) {
          addMessage("bot", "C'est noté. Afin d'éditer un devis et de vous recontacter avec une proposition propre, merci de compléter vos coordonnées :\nNom :\nSociété :\nTéléphone :");
        } else if (current === 3) {
           const contacts = extractContacts(input);
           if (!contacts.phone) {
             addMessage("bot", "Il nous manque encore le numéro de téléphone pour finaliser votre demande. Pourriez-vous nous le fournir ?");
             setStep(current - 1);
             return;
           }
           setRequestData(prev => ({ ...prev, contactName: contacts.name, contactCompany: contacts.company, contactPhone: contacts.phone }));
           finalizeRequest();
        }
      }

      else if (currentFlow === "inconnu" || currentFlow === "piece") {
        if (current === 1) {
          let analysis = analyzeBelt(input);
          if (!analysis.matches) {
            analysis = analyzeBearing(input);
            if (!analysis.matches) {
              analysis = analyzeGeneral(input);
            }
          }

          if (analysis.matches) {
            analysis.tags.forEach(addTag);
            setRequestData(prev => ({ ...prev, aiAnalysis: analysis.message, productType: analysis.detectedType }));
            if (analysis.needsCascade) {
               setCascadePending(true);
               addMessage("bot", analysis.message, [
                 { id: "fastmode", label: "Je n'ai pas toutes les informations", action: () => handleFastMode(), icon: <Zap size={16} className="text-brand-orange" /> },
                 { id: "force_send", label: "Envoyer quand même ma demande", action: () => handleForceSend(), icon: <Send size={16} className="text-brand-blue" /> }
               ]);
            } else {
               addMessage("bot", analysis.message);
               setTimeout(() => addMessage("bot", "Quelle quantité souhaitez-vous et avez-vous d'autres précisions techniques ?"), 800);
            }
          } else {
             addMessage("bot", "Pour éviter toute erreur, pouvez-vous nous préciser l'utilisation ou nous fournir une photo de la pièce ?");
             setCascadePending(true);
          }
        } else if (current === 2) {
          addMessage("bot", "Merci de compléter vos coordonnées :\nNom :\nSociété :\nTéléphone :");
        } else if (current === 3) {
           const contacts = extractContacts(input);
           if (!contacts.phone) {
             addMessage("bot", "Il nous manque encore le numéro de téléphone pour finaliser votre demande. Pourriez-vous nous le fournir ?");
             setStep(current - 1);
             return;
           }
           setRequestData(prev => ({ ...prev, contactName: contacts.name, contactCompany: contacts.company, contactPhone: contacts.phone }));
           finalizeRequest();
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

    const result = compareBelt(compProfile, compLengthType, val);
    
    // Inject the simulated thought process from the user into chat history
    addMessage("user", `Comparaison : ${compProfile} ${val} ${compLengthType}`);
    
    // Give the bot's calculated response
    setTimeout(() => {
      addMessage("bot", result.message);
      
      // Follow up with normal flow integration
      setTimeout(() => {
        addTag("COURROIE");
        setRequestData(prev => ({ 
           ...prev, 
           flowType: "courroie", 
           aiAnalysis: `Comparaison : ${compProfile} ${val} ${compLengthType} -> Equivalent : ${result.equivalent}`,
           dimensions: `${compValue} ${compLengthType}`
        }));
        setCurrentFlow("courroie");
        setStep(2);
        addMessage("bot", "Si vous souhaitez commander ou demander un prix pour cette courroie équivalente, quelle quantité vous faut-il et à quoi sert-elle (application) ?");
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
        {currentFlow !== "home" && (
          <button 
            onClick={resetFlow}
            className="text-white/80 hover:text-white transition-colors flex items-center gap-1 text-xs md:text-sm bg-black/10 px-3 py-2 rounded-full hover:bg-black/20 shrink-0 min-h-[44px]"
          >
            <ArrowLeft size={14} /> Retour
          </button>
        )}
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
                     <div className="grid grid-cols-2 gap-3">
                       <label className="flex flex-col text-sm font-semibold text-slate-700 dark:text-slate-300">
                         Profil (Section)
                         <select 
                           value={compProfile} 
                           onChange={e => setCompProfile(e.target.value)}
                           className="mt-1 p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                         >
                            <option value="A">A / 13x8</option>
                            <option value="B">B / 17x11</option>
                            <option value="C">C / 22x14</option>
                            <option value="Z">Z / 10x6</option>
                            <option value="SPA">SPA</option>
                            <option value="SPB">SPB</option>
                            <option value="SPC">SPC</option>
                            <option value="SPZ">SPZ</option>
                            <option value="XPA">XPA</option>
                            <option value="XPB">XPB</option>
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
                       disabled={!compValue}
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
        <form onSubmit={handleSubmit} className="flex gap-2 relative items-center">
          <label
            htmlFor="photo-upload"
            title="Prendre une photo"
            className={cn(
              "min-w-[48px] h-[48px] rounded-full flex items-center justify-center transition-colors shrink-0 shadow-sm relative overflow-hidden",
              currentFlow === "home" 
                ? "text-slate-400 bg-slate-100 dark:bg-slate-800 opacity-50 cursor-not-allowed"
                : "text-slate-600 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer active:scale-95"
            )}
          >
            <input 
                id="photo-upload"
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                disabled={currentFlow === "home"}
                onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                        handlePhotoUpload();
                    }
                }}
            />
            <Camera size={22} />
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
