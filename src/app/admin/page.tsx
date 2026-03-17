"use client";

import { useEffect, useState } from "react";
import { getRequests, StoredRequest } from "@/lib/chatbot-logic";
import Link from "next/link";
import { ArrowLeft, Inbox, Tag, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminDashboard() {
  const [requests, setRequests] = useState<StoredRequest[]>([]);

  useEffect(() => {
    setRequests(getRequests().reverse()); // Newest first
  }, []);

  const getTagColor = (tag: string) => {
    switch (tag) {
      case "URGENT": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400";
      case "COURROIE": 
      case "ROULEMENT": return "bg-brand-blue/10 text-brand-blue border-brand-blue/20 dark:bg-brand-blue/20 dark:text-brand-blue-light";
      case "DEVIS": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400";
      case "HORS_STANDARD": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400";
      case "TECHNIQUE": return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400";
      default: return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 lg:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
              <Inbox className="text-brand-blue" />
              Tableau de bord Admin
            </h1>
            <p className="text-slate-500 mt-2">Gestion des demandes générées par le ChatBot SNIMOP</p>
          </div>
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-blue transition-colors px-4 py-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
            <ArrowLeft size={16} />
            Retour à l'accueil
          </Link>
        </header>

        <div className="space-y-6">
          {requests.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <AlertCircle size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">Aucune demande reçue</h3>
              <p className="text-slate-500">Les requêtes du chatbot apparaîtront ici.</p>
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize">
                      Requête de type : {req.flowType}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      <span>{format(new Date(req.createdAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}</span>
                      {req.completionScore !== undefined && (
                        <span className="flex items-center gap-1 font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          Complétude: 
                          <span className={
                            req.completionScore >= 80 ? "text-green-600 dark:text-green-400" : 
                            req.completionScore >= 50 ? "text-orange-500 dark:text-orange-400" : "text-red-500 dark:text-red-400"
                          }>
                            {req.completionScore}%
                          </span>
                        </span>
                      )}
                      {req.hasPhoto && <span className="px-2 py-0.5 bg-blue-50 text-brand-blue rounded text-xs font-medium">📷 Photo incluse</span>}
                    </div>
                  </div>
                  
                  {/* Tags Group */}
                  <div className="flex flex-wrap gap-2">
                    {req.tags?.map((tag) => (
                      <span key={tag} className={`px-3 py-1 text-xs font-bold rounded-full border flex items-center gap-1 ${getTagColor(tag)}`}>
                        <Tag size={12} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {req.aiAnalysis && (
                  <div className="mb-4 p-4 bg-brand-blue/5 dark:bg-brand-blue/10 rounded-xl border border-brand-blue/10">
                    <h4 className="text-xs font-bold uppercase text-brand-blue mb-1 flex items-center gap-1">
                      <AlertCircle size={14} /> Analyse IA (À vérifier)
                    </h4>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{req.aiAnalysis}</p>
                  </div>
                )}
                
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
