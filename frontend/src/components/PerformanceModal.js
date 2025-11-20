import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, TrendingUp, BarChart3, ChevronLeft, ChevronRight, Download, Sparkles, AlertTriangle, Target, Edit3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { unstable_batchedUpdates } from 'react-dom';

export default function PerformanceModal({ 
  isOpen, 
  onClose,
  bilanData,
  kpiEntries,
  user,
  onDataUpdate,
  onRegenerate,
  generatingBilan,
  onEditKPI,
  kpiConfig,
  currentWeekOffset,
  onWeekChange
}) {
  const [activeTab, setActiveTab] = useState('bilan'); // 'bilan' or 'kpi'
  const [displayedKpiCount, setDisplayedKpiCount] = useState(20); // Start with 20 entries
  const contentRef = useRef(null);
  const bilanSectionRef = useRef(null);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [wasGenerating, setWasGenerating] = useState(false);

  // Fonction pour calculer le numéro de semaine ISO
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  // Calculer le numéro de semaine et les dates pour le sélecteur
  const weekInfo = useMemo(() => {
    if (!bilanData?.periode) {
      // Si pas de période, calculer depuis la semaine actuelle
      const now = new Date();
      const weekNum = getWeekNumber(now);
      return { weekNumber: weekNum, dateRange: null };
    }
    
    // Parse la période - plusieurs formats possibles
    // Format 1: "17 nov. au 23 nov." ou "10/11/25 au 16/11/25"
    let match = bilanData.periode.match(/(\d+)[\/\s]+(\w+)[\.\s]+au\s+(\d+)[\/\s]+(\w+)[\.]?/i);
    
    if (!match) {
      const now = new Date();
      return { weekNumber: getWeekNumber(now), dateRange: bilanData.periode };
    }
    
    const [_, startDay, startMonth, endDay, endMonth] = match;
    const currentYear = new Date().getFullYear();
    
    // Créer une date approximative pour calculer le numéro de semaine
    const monthMap = {
      'janv': 0, 'févr': 1, 'mars': 2, 'avr': 3, 'mai': 4, 'juin': 5,
      'juil': 6, 'août': 7, 'sept': 8, 'oct': 9, 'nov': 10, 'déc': 11
    };
    
    const monthIndex = monthMap[startMonth] !== undefined ? monthMap[startMonth] : parseInt(startMonth) - 1;
    const startDate = new Date(currentYear, monthIndex, parseInt(startDay));
    const weekNum = getWeekNumber(startDate);
    
    return {
      weekNumber: weekNum,
      dateRange: `${startDay} au ${endDay} ${endMonth}.`
    };
  }, [bilanData?.periode]);

  // Auto-scroll to bilan section when generation completes
  useEffect(() => {
    // Detect when generation just finished
    if (wasGenerating && !generatingBilan && bilanData?.synthese && bilanSectionRef.current) {
      setTimeout(() => {
        bilanSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
    
    // Track generating state
    if (generatingBilan) {
      setWasGenerating(true);
    } else if (wasGenerating) {
      setWasGenerating(false);
    }
  }, [generatingBilan, bilanData?.synthese]);

  if (!isOpen) return null;

  // Prepare chart data from KPI entries for current week
  const chartData = useMemo(() => {
    if (!kpiEntries || kpiEntries.length === 0) return [];
    
    const now = new Date();
    const offsetDays = (currentWeekOffset || 0) * 7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1) + offsetDays);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    const weekEntries = kpiEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= monday && entryDate <= sunday;
    });
    
    const sortedEntries = weekEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return sortedEntries.map(entry => ({
      date: new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      CA: entry.ca_journalier || 0,
      Ventes: entry.nb_ventes || 0,
      Articles: entry.nb_articles || 0,
      'Panier Moyen': entry.ca_journalier && entry.nb_ventes ? (entry.ca_journalier / entry.nb_ventes).toFixed(2) : 0
    }));
  }, [kpiEntries, currentWeekOffset]);

  // Export to PDF function
  const exportToPDF = async () => {
    if (!contentRef.current || !document.body.contains(contentRef.current)) {
      console.error('Content ref not available');
      return;
    }
    
    unstable_batchedUpdates(() => {
      setExportingPDF(true);
    });
    
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const contentWidth = pdfWidth - (2 * margin);
      const ratio = contentWidth / imgWidth;
      const contentHeight = imgHeight * ratio;
      
      if (contentHeight <= pdfHeight - 20) {
        pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
      } else {
        let remainingHeight = contentHeight;
        let currentY = 0;
        let pageNum = 0;
        
        while (remainingHeight > 0) {
          if (pageNum > 0) pdf.addPage();
          
          const sliceHeight = Math.min(pdfHeight - 20, remainingHeight);
          const sy = (currentY / contentHeight) * imgHeight;
          const sh = (sliceHeight / contentHeight) * imgHeight;
          
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = imgWidth;
          tempCanvas.height = sh;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(canvas, 0, sy, imgWidth, sh, 0, 0, imgWidth, sh);
          
          const sliceImgData = tempCanvas.toDataURL('image/png', 1.0);
          pdf.addImage(sliceImgData, 'PNG', margin, margin, contentWidth, sliceHeight);
          
          currentY += sliceHeight;
          remainingHeight -= sliceHeight;
          pageNum++;
        }
      }
      
      const fileName = `bilan_${bilanData?.periode || 'actuel'}.pdf`.replace(/\s+/g, '_');
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert('Erreur lors de l\'export PDF');
    } finally {
      unstable_batchedUpdates(() => {
        setExportingPDF(false);
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header avec onglets */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-2xl font-bold text-white">📊 Mes Performances</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
          
          {/* Onglets */}
          <div className="border-b border-gray-200 bg-gray-50 pt-2">
            <div className="flex gap-1 px-6">
              <button
                onClick={() => setActiveTab('bilan')}
                className={`px-4 py-2 text-sm font-semibold transition-all rounded-t-lg ${
                  activeTab === 'bilan'
                    ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
                    : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  <span>Mon bilan</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('kpi')}
                className={`px-4 py-2 text-sm font-semibold transition-all rounded-t-lg ${
                  activeTab === 'kpi'
                    ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
                    : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <BarChart3 className="w-4 h-4" />
                  <span>Historique ({kpiEntries?.length || 0})</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('saisie')}
                className={`px-4 py-2 text-sm font-semibold transition-all rounded-t-lg ${
                  activeTab === 'saisie'
                    ? 'bg-orange-300 text-gray-800 shadow-md border-b-4 border-orange-500'
                    : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Edit3 className="w-4 h-4" />
                  <span>Saisir mes chiffres</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Contenu du modal selon l'onglet actif */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'bilan' && (
            <div>
              {/* Boutons d'action avec navigation semaines */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 bg-gray-50 border-b">
                <div className="flex flex-wrap gap-2">
                  {onRegenerate && (
                    <button
                      onClick={onRegenerate}
                      disabled={generatingBilan}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <TrendingUp className={`w-4 h-4 ${generatingBilan ? 'animate-spin' : ''}`} />
                      <span>{generatingBilan ? 'Génération...' : (bilanData?.synthese ? 'Regénérer' : 'Générer')}</span>
                    </button>
                  )}
                  <button
                    onClick={exportToPDF}
                    disabled={exportingPDF}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className={`w-4 h-4 ${exportingPDF ? 'animate-bounce' : ''}`} />
                    <span>{exportingPDF ? 'Export...' : 'PDF'}</span>
                  </button>
                </div>
                
                {/* Navigation semaines - responsive */}
                {onWeekChange && (
                  <div className="flex items-center gap-1 bg-gray-200 rounded-lg px-2 py-2 w-full md:w-auto justify-center">
                    <button
                      onClick={() => onWeekChange(currentWeekOffset - 1)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded transition flex-shrink-0"
                      title="Semaine précédente"
                    >
                      <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <span className="text-xs font-semibold text-gray-700 px-1 min-w-0 text-center flex-1 truncate">
                      {bilanData?.periode || (currentWeekOffset === 0 ? 'Sem. actuelle' : 'Semaines')}
                    </span>
                    <button
                      onClick={() => onWeekChange(currentWeekOffset + 1)}
                      disabled={currentWeekOffset === 0}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded transition disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                      title="Semaine suivante"
                    >
                      <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
              </div>

              {/* Contenu scrollable */}
              <div ref={contentRef} data-pdf-content className="p-6">
                {bilanData ? (
                  <>
                    {/* KPI Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      {bilanData.kpi_resume?.ca_total !== undefined && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs text-blue-600 mb-1">💰 CA</p>
                          <p className="text-lg font-bold text-blue-900">{bilanData.kpi_resume.ca_total.toFixed(0)}€</p>
                        </div>
                      )}
                      {bilanData.kpi_resume?.ventes !== undefined && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs text-green-600 mb-1">🛒 Ventes</p>
                          <p className="text-lg font-bold text-green-900">{bilanData.kpi_resume.ventes}</p>
                        </div>
                      )}
                      {bilanData.kpi_resume?.articles !== undefined && (
                        <div className="bg-orange-50 rounded-lg p-3">
                          <p className="text-xs text-orange-600 mb-1">📦 Articles</p>
                          <p className="text-lg font-bold text-orange-900">{bilanData.kpi_resume.articles}</p>
                        </div>
                      )}
                      {bilanData.kpi_resume?.panier_moyen !== undefined && (
                        <div className="bg-indigo-50 rounded-lg p-3">
                          <p className="text-xs text-indigo-600 mb-1">💳 P. Moyen</p>
                          <p className="text-lg font-bold text-indigo-900">{bilanData.kpi_resume.panier_moyen.toFixed(0)}€</p>
                        </div>
                      )}
                    </div>

                    {/* Charts */}
                    {chartData && chartData.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart3 className="w-5 h-5 text-blue-600" />
                          <h3 className="font-bold text-gray-800">📊 Évolution de la semaine</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {chartData.some(d => d.CA !== undefined) && (
                            <div className="bg-blue-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-blue-900 mb-3">💰 Évolution du CA</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#1e40af' }} stroke="#3b82f6" />
                                  <YAxis tick={{ fontSize: 11, fill: '#1e40af' }} stroke="#3b82f6" />
                                  <Tooltip contentStyle={{ backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '8px' }} />
                                  <Line type="monotone" dataKey="CA" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#1e40af', r: 4 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          
                          {chartData.some(d => d.Articles !== undefined) && (
                            <div className="bg-orange-50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-orange-900 mb-3">📦 Évolution des Articles</h4>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9a3412' }} stroke="#f97316" />
                                  <YAxis tick={{ fontSize: 11, fill: '#9a3412' }} stroke="#f97316" />
                                  <Tooltip contentStyle={{ backgroundColor: '#ffedd5', border: '2px solid #f97316', borderRadius: '8px' }} />
                                  <Bar dataKey="Articles" fill="#f97316" radius={[8, 8, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Animation de génération élaborée */}
                    {generatingBilan && (
                      <div className="bg-white rounded-2xl p-8 max-w-md mx-auto shadow-2xl border-2 border-blue-200">
                        <div className="text-center mb-6">
                          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                            <Sparkles className="w-10 h-10 text-white" />
                          </div>
                          <h3 className="text-2xl font-bold text-gray-800 mb-2">
                            Analyse en cours...
                          </h3>
                          <p className="text-gray-600">
                            L'IA analyse vos performances de la semaine et prépare votre bilan personnalisé
                          </p>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500" 
                            style={{
                              animation: 'progress-slide 2s ease-in-out infinite',
                              backgroundSize: '200% 100%'
                            }}
                          ></div>
                        </div>
                        
                        <div className="mt-4 text-center text-sm text-gray-500">
                          <p>⏱️ Temps estimé : 30-60 secondes</p>
                        </div>
                      </div>
                    )}

                    {/* Analyse IA */}
                    {bilanData.synthese && !generatingBilan && (
                      <div ref={bilanSectionRef} className="space-y-4">
                        <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
                          <div className="flex items-start gap-2 mb-2">
                            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <h3 className="font-bold text-blue-900">💡 Synthèse de la semaine</h3>
                          </div>
                          <p className="text-gray-700 leading-relaxed">{bilanData.synthese}</p>
                        </div>

                        {bilanData.points_forts && bilanData.points_forts.length > 0 && (
                          <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
                            <div className="flex items-center gap-2 mb-3">
                              <TrendingUp className="w-5 h-5 text-green-600" />
                              <h3 className="font-bold text-green-900">👍 Tes points forts</h3>
                            </div>
                            <ul className="space-y-2">
                              {bilanData.points_forts.map((point, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-green-600 mt-1">✓</span>
                                  <span className="text-gray-700">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {bilanData.points_attention && bilanData.points_attention.length > 0 && (
                          <div className="bg-orange-50 rounded-xl p-4 border-l-4 border-orange-500">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-5 h-5 text-orange-600" />
                              <h3 className="font-bold text-orange-900">⚠️ Points à améliorer</h3>
                            </div>
                            <ul className="space-y-2">
                              {bilanData.points_attention.map((point, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-orange-600 mt-1">!</span>
                                  <span className="text-gray-700">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {bilanData.recommandations && bilanData.recommandations.length > 0 && (
                          <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
                            <div className="flex items-center gap-2 mb-3">
                              <Target className="w-5 h-5 text-indigo-600" />
                              <h3 className="font-bold text-indigo-900">🎯 Recommandations personnalisées</h3>
                            </div>
                            <ol className="space-y-2 list-decimal list-inside">
                              {bilanData.recommandations.map((reco, idx) => (
                                <li key={idx} className="text-gray-700">{reco}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {!bilanData.synthese && !generatingBilan && (
                      <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                        <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-4">Aucune analyse IA disponible pour cette semaine</p>
                        {onRegenerate && (
                          <button
                            onClick={onRegenerate}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                          >
                            ✨ Générer l'analyse IA
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Aucun bilan disponible</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'kpi' && (
            <div>
              {/* Contenu avec padding */}
              {kpiEntries && kpiEntries.length > 0 ? (
                <div className="px-6">
                  <div className="space-y-4">
                    {kpiEntries.slice(0, displayedKpiCount).map((entry, index) => {
                      // Calculate days difference
                      const entryDate = new Date(entry.date);
                      const today = new Date();
                      const diffTime = today - entryDate;
                      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                      
                      return (
                        <div 
                          key={index} 
                          onClick={() => {
                            if (onEditKPI) {
                              onEditKPI(entry);
                            } else {
                              alert('Modification KPI non disponible');
                            }
                          }}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-gray-800">{entry.date}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">
                                il y a {diffDays === 0 ? "aujourd'hui" : `${diffDays} jour${diffDays > 1 ? 's' : ''}`}
                              </span>
                              <span className="text-xs text-blue-600 font-medium">✏️ Modifier</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>💰 CA: {entry.ca_journalier || 0}€</div>
                            <div>🛒 Ventes: {entry.nb_ventes || 0}</div>
                            <div>📦 Articles: {entry.nb_articles || 0}</div>
                            <div>🚶 Prospects: {entry.nb_prospects || 0}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Bouton Charger plus */}
                  {displayedKpiCount < kpiEntries.length && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setDisplayedKpiCount(prev => prev + 20)}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                      >
                        Charger plus ({Math.min(20, kpiEntries.length - displayedKpiCount)} entrées supplémentaires)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-6">
                  <p className="text-gray-500">Aucun KPI enregistré pour le moment.</p>
                </div>
              )}
            </div>
          )}

          {/* Onglet Saisie KPI */}
          {activeTab === 'saisie' && (
            <div className="px-6 py-6">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border-2 border-orange-200 mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-orange-600" />
                  Saisir mes chiffres du jour
                </h3>
                <p className="text-sm text-gray-600">
                  Renseignez vos données quotidiennes. Vous pourrez les corriger à tout moment depuis l'onglet "Historique".
                </p>
              </div>

              {/* Formulaire de saisie */}
              <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const data = {
                    date: formData.get('date'),
                    ca_journalier: parseFloat(formData.get('ca_journalier')) || 0,
                    nb_ventes: parseInt(formData.get('nb_ventes')) || 0,
                    nb_prospects: parseInt(formData.get('nb_prospects')) || 0
                  };
                  
                  if (onEditKPI) {
                    onEditKPI(data);
                  }
                }} className="space-y-6">
                  {/* Sélecteur de date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      📅 Date
                    </label>
                    <input
                      type="date"
                      name="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-gray-800 font-medium"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Sélectionnez le jour pour lequel vous souhaitez saisir vos données</p>
                  </div>

                  {/* KPIs en grille - Configuration identique au manager */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CA - Toujours affiché si configuré par le manager */}
                    {(kpiConfig?.seller_track_ca || kpiConfig?.track_ca) && (
                      <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
                        <label className="block text-sm font-semibold text-orange-900 mb-2">
                          💰 Chiffre d'Affaires (€)
                        </label>
                        <input
                          type="number"
                          name="ca_journalier"
                          step="0.01"
                          min="0"
                          placeholder="Ex: 1250.50"
                          className="w-full px-4 py-2 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Ventes - Toujours affiché si configuré */}
                    {(kpiConfig?.seller_track_ventes || kpiConfig?.track_ventes) && (
                      <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                        <label className="block text-sm font-semibold text-green-900 mb-2">
                          🛒 Nombre de Ventes
                        </label>
                        <input
                          type="number"
                          name="nb_ventes"
                          min="0"
                          placeholder="Ex: 15"
                          className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:border-green-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Clients - Toujours affiché si configuré */}
                    {(kpiConfig?.seller_track_clients || kpiConfig?.track_clients) && (
                      <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                        <label className="block text-sm font-semibold text-blue-900 mb-2">
                          👥 Nombre de Clients
                        </label>
                        <input
                          type="number"
                          name="nb_clients"
                          min="0"
                          placeholder="Ex: 12"
                          className="w-full px-4 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Prospects - Toujours affiché si configuré */}
                    {(kpiConfig?.seller_track_prospects || kpiConfig?.track_prospects) && (
                      <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                        <label className="block text-sm font-semibold text-purple-900 mb-2">
                          🚶 Nombre de Prospects
                        </label>
                        <input
                          type="number"
                          name="nb_prospects"
                          min="0"
                          placeholder="Ex: 30"
                          className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Boutons d'action */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold rounded-lg hover:from-orange-700 hover:to-amber-700 transition-all shadow-md hover:shadow-lg"
                    >
                      💾 Enregistrer mes chiffres
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('kpi')}
                      className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
                    >
                      📊 Voir l'historique
                    </button>
                  </div>
                </form>
              </div>

              {/* Aide et conseils */}
              <div className="mt-6 bg-orange-50 rounded-lg p-4 border-l-4 border-orange-400">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-orange-900 mb-1">💡 Astuce</p>
                    <p className="text-sm text-orange-800">
                      Saisissez vos chiffres chaque jour pour suivre vos progrès ! 
                      Pour corriger une saisie, allez dans l'onglet "Historique" et cliquez sur la journée à modifier.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
