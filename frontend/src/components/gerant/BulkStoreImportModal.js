import React, { useState, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Download, Info } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Modal d'import massif de magasins via CSV/Excel
 * Fonctionnalité migrée depuis l'espace Enterprise vers Gérant
 */
export default function BulkStoreImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [importMode, setImportMode] = useState('create_or_update');

  // Reset state when modal closes
  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setImportResult(null);
    setImporting(false);
    onClose();
  };

  // Parse CSV file
  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Détection des séparateurs (virgule ou point-virgule)
    const separator = lines[0].includes(';') ? ';' : ',';
    
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
      if (values.length >= 1 && values[0]) {
        const row = {};
        headers.forEach((header, index) => {
          // Mapping des colonnes CSV vers les champs API
          const fieldMap = {
            'nom': 'name',
            'name': 'name',
            'magasin': 'name',
            'location': 'location',
            'ville': 'location',
            'city': 'location',
            'adresse': 'address',
            'address': 'address',
            'telephone': 'phone',
            'phone': 'phone',
            'tel': 'phone',
            'external_id': 'external_id',
            'id_externe': 'external_id',
            'ref': 'external_id'
          };
          const mappedField = fieldMap[header] || header;
          if (values[index]) {
            row[mappedField] = values[index];
          }
        });
        if (row.name) {
          data.push(row);
        }
      }
    }
    return data;
  };

  // Handle file selection
  const handleFile = useCallback((selectedFile) => {
    if (!selectedFile) return;
    
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    const extension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
    
    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(extension)) {
      toast.error('Format non supporté. Utilisez un fichier CSV.');
      return;
    }
    
    // Pour l'instant, on ne supporte que le CSV
    if (extension !== '.csv') {
      toast.error('Seul le format CSV est supporté pour le moment. Exportez votre Excel en CSV.');
      return;
    }
    
    setFile(selectedFile);
    setImportResult(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target.result);
        setParsedData(parsed);
        if (parsed.length === 0) {
          toast.error('Aucune donnée valide trouvée dans le fichier');
        } else {
          toast.success(`${parsed.length} magasin(s) détecté(s)`);
        }
      } catch (error) {
        toast.error('Erreur lors de la lecture du fichier');
        console.error('Parse error:', error);
      }
    };
    reader.readAsText(selectedFile);
  }, []);

  // Drag & Drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  // Execute import
  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error('Aucune donnée à importer');
      return;
    }
    
    setImporting(true);
    setImportResult(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/api/gerant/stores/import-bulk`,
        {
          stores: parsedData,
          mode: importMode
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setImportResult(response.data);
      
      if (response.data.success) {
        toast.success(`Import réussi ! ${response.data.created} créé(s), ${response.data.updated} mis à jour`);
        // Notify parent to refresh stores list
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.warning(`Import partiel: ${response.data.failed} échec(s)`);
      }
    } catch (error) {
      console.error('Import error:', error);
      const message = error.response?.data?.detail || 'Erreur lors de l\'import';
      toast.error(message);
      setImportResult({ success: false, error: message });
    } finally {
      setImporting(false);
    }
  };

  // Download template
  const downloadTemplate = () => {
    const template = 'nom;ville;adresse;telephone;id_externe\nMagasin Paris;Paris;123 rue Example;0123456789;MAG001\nMagasin Lyon;Lyon;456 avenue Test;0987654321;MAG002';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_import_magasins.csv';
    link.click();
    toast.success('Template téléchargé');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Import Massif de Magasins</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">Format attendu : CSV (séparateur ; ou ,)</p>
              <p>Colonnes : <code className="bg-blue-100 px-1 rounded">nom</code>, <code className="bg-blue-100 px-1 rounded">ville</code>, <code className="bg-blue-100 px-1 rounded">adresse</code>, <code className="bg-blue-100 px-1 rounded">telephone</code>, <code className="bg-blue-100 px-1 rounded">id_externe</code> (optionnel)</p>
            </div>
          </div>

          {/* Template download */}
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            <Download className="w-4 h-4" />
            Télécharger le template CSV
          </button>

          {/* Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive 
                ? 'border-emerald-500 bg-emerald-50' 
                : file 
                  ? 'border-emerald-400 bg-emerald-50' 
                  : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {file ? (
              <div className="space-y-2">
                <FileSpreadsheet className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="font-medium text-gray-700">{file.name}</p>
                <p className="text-sm text-emerald-600">{parsedData.length} magasin(s) détecté(s)</p>
                <button
                  onClick={() => {
                    setFile(null);
                    setParsedData([]);
                    setImportResult(null);
                  }}
                  className="text-sm text-gray-500 hover:text-red-500"
                >
                  Changer de fichier
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <p className="font-medium text-gray-700">Glissez votre fichier CSV ici</p>
                  <p className="text-sm text-gray-500">ou</p>
                </div>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFile(e.target.files[0])}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium cursor-pointer transition-colors">
                    Parcourir...
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Preview */}
          {parsedData.length > 0 && !importResult && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-700">Aperçu ({Math.min(5, parsedData.length)} premiers)</h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600">Nom</th>
                      <th className="px-3 py-2 text-left text-gray-600">Ville</th>
                      <th className="px-3 py-2 text-left text-gray-600">Adresse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.location || '-'}</td>
                        <td className="px-3 py-2 text-gray-500 truncate max-w-[150px]">{row.address || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 5 && (
                  <p className="px-3 py-2 text-sm text-gray-500 bg-gray-100">
                    ... et {parsedData.length - 5} autre(s)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Import mode selector */}
          {parsedData.length > 0 && !importResult && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Mode d'import :</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="create_or_update"
                    checked={importMode === 'create_or_update'}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="text-emerald-600"
                  />
                  <span className="text-sm">Créer ou mettre à jour</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="create_only"
                    checked={importMode === 'create_only'}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="text-emerald-600"
                  />
                  <span className="text-sm">Créer uniquement</span>
                </label>
              </div>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className={`rounded-xl p-4 ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                {importResult.success ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-500" />
                )}
                <h3 className={`font-semibold ${importResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {importResult.success ? 'Import réussi !' : 'Import partiel'}
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-emerald-600">{importResult.created}</p>
                  <p className="text-xs text-gray-500">Créé(s)</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                  <p className="text-xs text-gray-500">Mis à jour</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
                  <p className="text-xs text-gray-500">Échec(s)</p>
                </div>
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-3 text-sm text-red-600">
                  <p className="font-medium">Erreurs :</p>
                  <ul className="list-disc list-inside">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err.name}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            {importResult ? 'Fermer' : 'Annuler'}
          </button>
          {!importResult && (
            <button
              onClick={handleImport}
              disabled={parsedData.length === 0 || importing}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
                parsedData.length === 0 || importing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg'
              }`}
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Importer {parsedData.length} magasin(s)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
