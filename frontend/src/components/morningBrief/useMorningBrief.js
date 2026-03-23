import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/apiClient';
import { logger } from '../../utils/logger';
import { getSubscriptionErrorMessage } from '../../utils/apiHelpers';
import { useAuth } from '../../contexts';
import { toast } from 'sonner';
import { exportBriefToPDF } from './briefPdfExport';

export default function useMorningBrief({ storeId, storeName, onClose }) {
  const { user } = useAuth();
  const [comments, setComments] = useState('');
  const [objectiveDaily, setObjectiveDaily] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [brief, setBrief] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('new');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [exportingPDF, setExportingPDF] = useState(false);
  const briefContentRef = useRef(null);
  const generateAbortRef = useRef(null);

  const storeParam = storeId ? `?store_id=${storeId}` : '';

  useEffect(() => {
    loadHistory();
    return () => { if (generateAbortRef.current) generateAbortRef.current.abort(); };
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/briefs/morning/history${storeParam}`);
      setHistory(res.data.briefs || []);
    } catch (err) {
      logger.error('Error loading brief history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    if (generateAbortRef.current) generateAbortRef.current.abort();
    generateAbortRef.current = new AbortController();

    setIsLoading(true);
    setBrief(null);
    try {
      const payload = {
        comments: comments.trim() || null,
        objective_daily: objectiveDaily ? Number.parseFloat(objectiveDaily) : null,
      };
      const response = await api.post(`/briefs/morning${storeParam}`, payload, { signal: generateAbortRef.current.signal });
      if (response.data.success) {
        setBrief(response.data);
        toast.success('☕ Brief matinal généré !');
        loadHistory();
      } else {
        toast.error('Erreur lors de la génération');
      }
    } catch (error) {
      if (error.code === 'ERR_CANCELED') return;
      logger.error('Erreur génération brief:', error);
      toast.error(getSubscriptionErrorMessage(error, user?.role) || error.response?.data?.detail || 'Erreur lors de la génération du brief');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBrief = async (briefId) => {
    if (!globalThis.confirm('Êtes-vous sûr de vouloir supprimer ce brief ?')) return;
    try {
      await api.delete(`/briefs/morning/${briefId}${storeParam}`);
      toast.success('Brief supprimé');
      loadHistory();
    } catch (err) {
      logger.error('Error deleting brief:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleCopy = async (briefText) => {
    try {
      await navigator.clipboard.writeText(briefText || brief?.brief);
      setCopied(true);
      toast.success('Brief copié dans le presse-papier !');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleRegenerate = () => {
    setBrief(null);
    handleGenerate();
  };

  const handleClose = () => {
    setComments('');
    setObjectiveDaily('');
    setBrief(null);
    setActiveTab('new');
    onClose();
  };

  const handleExportPDF = (briefData) =>
    exportBriefToPDF(briefData, { storeName, briefContentRef, setExportingPDF });

  return {
    comments, setComments,
    objectiveDaily, setObjectiveDaily,
    isLoading, brief,
    copied, activeTab, setActiveTab,
    history, loadingHistory,
    expandedItems, setExpandedItems,
    exportingPDF, briefContentRef,
    handleGenerate, handleDeleteBrief, handleCopy, handleRegenerate, handleClose,
    handleExportPDF,
  };
}
