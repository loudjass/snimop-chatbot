"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Search, FileText, Wrench, PhoneCall, ChevronRight } from "lucide-react";
import ChatBot from "@/components/ChatBot";
import Link from "next/link";

type RequestType = "parts" | "quote" | "advice" | "callback" | null;

export default function Home() {
  const [selectedType, setSelectedType] = useState<RequestType>(null);
  
  return (
    <main className="min-h-screen relative flex flex-col pt-6 md:pt-12 overflow-x-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-b from-brand-blue/10 to-transparent -z-10" />
      <div className="absolute top-0 inset-x-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 -z-10 mix-blend-overlay h-[500px]" />

      <div className="w-full max-w-5xl mx-auto px-4 md:px-8 flex flex-col h-[100svh] md:h-auto pb-4 md:pb-0">
        {/* Header section */}
        <header className="flex items-center justify-between mb-8 md:mb-16 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-blue flex items-center justify-center text-white shadow-xl shadow-brand-blue/20 shrink-0">
              <Wrench size={22} />
            </div>
            <span className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">SNIMOP</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-2 hover:text-brand-blue transition-colors cursor-pointer"><PhoneCall size={16} /> Contact</span>
            <Link href="/admin" className="flex items-center gap-2 hover:text-brand-blue transition-colors cursor-pointer"><FileText size={16} /> Admin</Link>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row gap-6 md:gap-12 items-start justify-between flex-1 min-h-0">
          
          {/* Hero text */}
          <div className="lg:w-1/2 pt-2 md:pt-8 shrink-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center rounded-full px-3 py-1 text-xs md:text-sm font-medium text-brand-blue bg-blue-50 dark:bg-brand-blue/10 dark:text-brand-blue-light mb-4 md:mb-6 border border-blue-100 dark:border-brand-blue/20">
                <span className="flex h-2 w-2 rounded-full bg-brand-blue mr-2 animate-pulse"></span>
                Assistant Intelligent SNIMOP
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white leading-tight mb-4 md:mb-6">
                En quoi pouvons-nous vous <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-blue-light">aider aujourd'hui ?</span>
              </h1>
              <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 mb-6 md:mb-8 max-w-lg hidden sm:block">
                Notre assistant virtuel est là pour qualifier votre besoin rapidement et vous mettre en relation avec le bon expert SNIMOP.
              </p>
              
              <div className="hidden lg:flex gap-4">
                <button 
                  onClick={() => {
                    const el = document.getElementById("chat-container");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-6 py-3 rounded-full bg-brand-orange hover:bg-brand-orange-light text-white font-medium shadow-lg shadow-brand-orange/20 transition-all active:scale-95">
                  Démarrer le Chat
                </button>
              </div>
            </motion.div>
          </div>

          {/* Chatbot Container */}
          <div id="chat-container" className="w-full lg:w-[480px] h-full flex flex-col justify-end min-h-0">
            <motion.div 
              className="h-full flex flex-col"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <ChatBot />
            </motion.div>
          </div>

        </div>
      </div>
    </main>
  );
}
