#!/usr/bin/env python3
"""
Script pour créer une version du StoreKPIModal avec un graphique consolidé
"""

# Lire le fichier original
with open('/app/frontend/src/components/StoreKPIModal.js', 'r') as f:
    content = f.read()

# Trouver le bloc de graphiques à remplacer (ligne 955 à 1145 environ)
# On cherche le début : {/* Charts */}
# Et la fin : </div>\n                  )}\n                </div>

start_marker = "              {/* Charts */}"
end_marker = """                  </div>
                  )}
                </div>
              ) : ("""

# Nouveau contenu avec un seul graphique consolidé
new_charts_content = """              {/* Graphique Consolidé */}
              {historicalData.length > 0 ? (
                <div className="space-y-6">
                  {/* Single Consolidated Chart with all KPIs */}
                  <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                    <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      📊 Vue Consolidée des KPI - Toutes les métriques
                    </h4>
                    <ResponsiveContainer width="100%" height={500}>
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }}
                          interval={viewMode === 'week' ? 0 : viewMode === 'month' ? 2 : 0}
                          angle={-45}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', padding: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="line"
                        />
                        
                        {/* CA Lines */}
                        {visibleCharts.ca && (
                          <>
                            <Line type="monotone" dataKey="total_ca" name="💰 CA Total (€)" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="seller_ca" name="💰 CA Vendeurs (€)" stroke="#a78bfa" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="5 5" />
                          </>
                        )}
                        
                        {/* Ventes Lines */}
                        {visibleCharts.ventes && (
                          <>
                            <Line type="monotone" dataKey="total_ventes" name="🛒 Ventes Totales" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="seller_ventes" name="🛒 Ventes Vendeurs" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="5 5" />
                          </>
                        )}
                        
                        {/* Panier Moyen */}
                        {visibleCharts.panierMoyen && (
                          <Line type="monotone" dataKey="panier_moyen" name="🛍️ Panier Moyen (€)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                        )}
                        
                        {/* Taux Transformation */}
                        {visibleCharts.tauxTransformation && (
                          <Line type="monotone" dataKey="taux_transformation" name="📈 Taux Transformation (%)" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                        )}
                        
                        {/* Indice Vente */}
                        {visibleCharts.indiceVente && (
                          <Line type="monotone" dataKey="indice_vente" name="📊 Indice Vente" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                        )}
                        
                        {/* Articles */}
                        {visibleCharts.articles && (
                          <Line type="monotone" dataKey="total_articles" name="📦 Articles Vendus" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 3 }} />
                        )}
                        
                        {/* Clients */}
                        {visibleCharts.clients && (
                          <Line type="monotone" dataKey="total_clients" name="👥 Clients Servis" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 3 }} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : ("""

# Faire le remplacement
if start_marker in content:
    start_idx = content.index(start_marker)
    end_idx = content.index(end_marker, start_idx)
    
    new_content = content[:start_idx] + new_charts_content + content[end_idx:]
    
    # Sauvegarder
    with open('/app/frontend/src/components/StoreKPIModal.js', 'w') as f:
        f.write(new_content)
    
    print("✅ Fichier modifié avec succès!")
    print("   - Graphiques séparés remplacés par un graphique consolidé")
    print("   - Toutes les métriques dans un seul graphique")
    print("   - Possibilité de filtrer via les boutons existants")
else:
    print("❌ Marqueurs non trouvés")
