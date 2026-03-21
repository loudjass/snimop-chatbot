"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PhoneCall, FileText, ChevronRight, Shield, Clock, Wrench } from "lucide-react";
import ChatBot from "@/components/ChatBot";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen relative flex flex-col overflow-x-hidden bg-slate-950">

      {/* ── Industrial background image — darkened for legibility ── */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: "url('/bg-industrial.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundRepeat: "no-repeat",
          opacity: 0.15,
          filter: "blur(2px)",
        }}
      />
      {/* Blue overlay for brand coherence */}
      <div className="absolute inset-0 -z-10 bg-brand-blue/30 mix-blend-overlay" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-950/90" />
      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-slate-950 to-transparent -z-10" />

      <div className="w-full max-w-6xl mx-auto px-4 md:px-8 flex flex-col min-h-screen pb-4">

        {/* ── HEADER ── */}
        <header className="flex items-center justify-between py-5 md:py-7 shrink-0">
          {/* Logo SNIMOP */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center bg-white/90 p-1 rounded-sm">
              <img
                src="/snimop-logo.jpg"
                alt="SNIMOP"
                className="relative h-10 md:h-12 w-auto object-contain"
                style={{ maxWidth: 160, mixBlendMode: 'multiply' }}
              />
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-3 md:gap-6 text-sm font-medium text-slate-400">
            <a
              href="tel:+33607877159"
              className="hidden md:flex items-center gap-2 hover:text-white transition-colors"
            >
              <PhoneCall size={15} /> 06 07 87 71 59
            </a>
            <Link
              href="/admin"
              className="flex items-center gap-2 hover:text-white transition-colors px-3 py-1.5 rounded-full border border-white/10 hover:border-white/30"
            >
              <FileText size={15} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </nav>
        </header>

        {/* ── MAIN CONTENT ── */}
        <div className="flex flex-col lg:flex-row gap-8 md:gap-16 items-start justify-between flex-1">

          {/* Hero text — left side */}
          <div className="lg:w-[44%] pt-4 md:pt-12 shrink-0">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Badge */}
              <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-brand-blue-light bg-brand-blue/10 mb-6 border border-brand-blue/20">
                <span className="flex h-2 w-2 rounded-full bg-green-400 mr-2 animate-pulse" />
                Techniciens disponibles
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight mb-5">
                Un problème technique ?{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue-light to-cyan-300">
                  On s'en occupe.
                </span>
              </h1>

              <p className="text-base md:text-lg text-slate-400 mb-8 max-w-md">
                Décrivez votre besoin. On vous met en contact direct avec le bon technicien SNIMOP — pièce ou intervention.
              </p>

              {/* Key points */}
              <div className="flex flex-col gap-3 mb-10">
                {[
                  { icon: <Wrench size={16} />, text: "Pièces techniques : roulements, courroies, visserie" },
                  { icon: <Shield size={16} />, text: "Interventions terrain : portes, rideaux, portails" },
                  { icon: <Clock size={16} />, text: "Réponse rapide — depuis 1983 à votre service" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                    <span className="text-brand-blue-light shrink-0">{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="hidden lg:flex gap-3">
                <button
                  onClick={() => {
                    const el = document.getElementById("chat-container");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-7 py-3.5 rounded-full bg-brand-orange hover:bg-brand-orange-light text-white font-semibold shadow-xl shadow-brand-orange/30 transition-all active:scale-95 flex items-center gap-2 text-base"
                >
                  Parler à un technicien
                  <ChevronRight size={18} />
                </button>
                <a
                  href="tel:+33607877159"
                  className="px-7 py-3.5 rounded-full border border-white/15 text-white hover:bg-white/5 transition-all text-sm font-medium flex items-center gap-2"
                >
                  <PhoneCall size={16} /> Appel direct
                </a>
              </div>
            </motion.div>
          </div>

          {/* Chatbot — right side */}
          <div id="chat-container" className="w-full lg:w-[480px] flex flex-col min-h-0 flex-1 lg:flex-none">
            <motion.div
              className="h-full flex flex-col"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <ChatBot />

              {/* Contacts Fixes and Info Block */}
              <div className="mt-6 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                <h3 className="text-white font-medium mb-1 text-sm">Nos Contacts Directs</h3>
                <a href="tel:0139358383" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm"><PhoneCall size={14}/> 📞 SNIMOP (Standard) : 01 39 35 83 83</a>
                <a href="https://wa.me/33607877159" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm"><PhoneCall size={14}/> 👨🔧 Pascal (Pièces) : 06 07 87 71 59</a>
                <a href="https://wa.me/33640946757" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm"><PhoneCall size={14}/> 🚧 Alexandre (Intervention) : 06 40 94 67 57</a>
              </div>
            </motion.div>
          </div>


        </div>
      </div>
    </main>
  );
}
