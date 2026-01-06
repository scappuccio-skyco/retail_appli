/**
 * Test minimal reproductible pour la génération PDF
 * 
 * Ce fichier teste la génération PDF avec des chaînes simples
 * pour identifier où apparaissent les caractères "&" corrompus.
 * 
 * Usage: Importer dans la console du navigateur et exécuter testPDFGeneration()
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const testPDFGeneration = async () => {
  console.log('=== TEST PDF GENERATION ===');
  
  const testStrings = [
    'Bonjour',
    'réalisé',
    'CA réalisé = 940€'
  ];
  
  // Test 1: Génération directe avec jsPDF.text()
  console.log('\n--- Test 1: jsPDF.text() direct ---');
  const pdf1 = new jsPDF('p', 'mm', 'a4');
  testStrings.forEach((str, idx) => {
    console.log(`Input "${str}"`);
    pdf1.text(str, 10, 20 + idx * 10);
    console.log(`✅ Ajouté au PDF`);
  });
  pdf1.save('test_direct.pdf');
  console.log('✅ PDF 1 sauvegardé: test_direct.pdf');
  
  // Test 2: Génération via DOM snapshot
  console.log('\n--- Test 2: DOM snapshot avec html2canvas ---');
  const testDiv = document.createElement('div');
  testDiv.style.padding = '20px';
  testDiv.style.backgroundColor = '#ffffff';
  testDiv.style.fontFamily = 'Arial, sans-serif';
  testDiv.style.fontSize = '14px';
  
  testStrings.forEach((str, idx) => {
    const p = document.createElement('p');
    p.textContent = str;
    p.style.margin = '10px 0';
    testDiv.appendChild(p);
  });
  
  document.body.appendChild(testDiv);
  
  try {
    const canvas = await html2canvas(testDiv, {
      scale: 2,
      backgroundColor: '#ffffff'
    });
    
    const pdf2 = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    const pageWidth = pdf2.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf2.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    pdf2.save('test_dom_snapshot.pdf');
    
    console.log('✅ PDF 2 sauvegardé: test_dom_snapshot.pdf');
  } catch (error) {
    console.error('❌ Erreur DOM snapshot:', error);
  } finally {
    document.body.removeChild(testDiv);
  }
  
  // Test 3: Vérification des caractères dans les strings
  console.log('\n--- Test 3: Analyse des caractères ---');
  testStrings.forEach(str => {
    const hasAmpersand = str.includes('&');
    const charCodes = Array.from(str).map(c => c.charCodeAt(0));
    console.log(`"${str}": has & = ${hasAmpersand}, charCodes = [${charCodes.join(', ')}]`);
  });
  
  console.log('\n=== FIN DES TESTS ===');
  console.log('Vérifiez les PDFs générés pour voir si des "&" apparaissent');
};

// Export pour utilisation dans la console
if (typeof window !== 'undefined') {
  window.testPDFGeneration = testPDFGeneration;
}

