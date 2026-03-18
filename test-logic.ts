import { analyzeBelt, analyzeBearing, compareBeltReverse } from './src/lib/chatbot-logic';

console.log("\n=================================");
console.log("1. RECHERCHE COURROIE (SPA, 13x8, longueur)");
console.log("Input: 'Je cherche une courroie SPA Ld 1250 2 pièces'");
console.log(analyzeBelt("Je cherche une courroie SPA Ld 1250 2 pièces").message);

console.log("\nInput: '13x8 1250 lD'");
console.log(analyzeBelt("13x8 1250 lD").message);

console.log("\n=================================");
console.log("2. INCOHÉRENCE (13x8 SPA)");
console.log("Input: '13x8 SPA'");
console.log(analyzeBelt("13x8 SPA").message);

console.log("\n=================================");
console.log("3. SYMPTÔMES & DIAGNOSTICS");
console.log("Input: 'ma courroie de compresseur patine'");
console.log(analyzeBelt("ma courroie de compresseur patine").message);

console.log("\nInput: 'j'ai une petite poulie, la courroie A40 pète souvent'");
console.log(analyzeBelt("j'ai une petite poulie, la courroie A40 pète souvent").message);

console.log("\nInput: 'courroie cassée'");
console.log(analyzeBelt("courroie cassée").message);

console.log("\nInput: 'gros bruit sur axe fendu'");
console.log(analyzeBelt("gros bruit sur axe fendu").message);
