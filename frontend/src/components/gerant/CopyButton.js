import React, { useState, useRef, useEffect } from 'react';
import { Copy, CheckCircle } from 'lucide-react';

const CopyButton = ({ text, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Create textarea for copying
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setCopied(true);
        timeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Copy failed:', err);
      try {
        document.body.removeChild(textArea);
      } catch (e) {
        // Already removed
      }
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={className || "flex-shrink-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"}
    >
      {copied ? (
        <>
          <CheckCircle className="h-4 w-4" />
          Copié !
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          Copier
        </>
      )}
    </button>
  );
};

export default CopyButton;
