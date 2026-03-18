import { analyzeBelt, analyzeBearing, compareBeltReverse } from './src/lib/chatbot-logic';

console.log("\n=================================");
console.log("1. RECHERCHE COURROIE (SPA, 13x8, longueur)");
console.log("Input: 'Je cherche une courroie SPA Ld 1250 2 pièces'");
console.log(analyzeBelt("Je cherche une courroie SPA Ld 1250 2 pièces").message);
console.log("\nInput: '13x8 1250 lD'");
console.log(analyzeBelt("13x8 1250 lD").message);

console.log("\n=================================");
console.log("2. CAS MÉLANGE (courroie + référence roulement)");
console.log("Input: 'courroie 6204' (Test analyzeBearing)");
console.log(analyzeBearing("courroie 6204")); 
console.log("\nInput: 'courroie 6204' (Test analyzeBelt)");
console.log(analyzeBelt("courroie 6204").message); 

console.log("\n=================================");
console.log("3. CAS CLIENT SANS RÉFÉRENCE (compresseur, voiture, courroie cassée)");
console.log("Input: 'c\\'est pour un compresseur'");
console.log(analyzeBelt("c'est pour un compresseur").message);
console.log("\nInput: 'courroie pour ma voiture'");
console.log(analyzeBelt("courroie pour ma voiture").message);
console.log("\nInput: 'ma courroie est cassée, pas de ref'");
console.log(analyzeBelt("ma courroie est cassée, pas de ref").message);

console.log("\n=================================");
console.log("4. COMPARATEUR EN MODE DIMENSIONS UNIQUEMENT");
console.log("Input: w=13, h=8, length=1250 Ld");
console.log(compareBeltReverse(13, 8, 'Ld', 1250).message);

console.log("\n=================================");
console.log("5. DEMANDE DE DEVIS");
console.log("Le Flow s'exécute dans ChatBot.tsx via setStep(1). Le texte forcé est le suivant :\\nOui, nous pouvons intervenir.\\nPour vous proposer un devis précis, j'ai besoin de :\\n- type d'équipement\\n- problème rencontré\\n- localisation du site\\n- niveau d'urgence.\\n\\nVous pouvez aussi envoyer une photo.");
console.log("=================================\n");
