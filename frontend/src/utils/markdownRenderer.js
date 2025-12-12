/**
 * Helper function to render markdown bold text (**text**) as actual bold
 * Used for AI-generated content that contains markdown formatting
 */
export const renderMarkdownBold = (text) => {
  if (!text) return null;
  
  // Handle newlines first - split by newlines
  const lines = text.split('\n');
  
  return lines.map((line, lineIndex) => {
    // Split each line by **text** pattern and render with bold
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    
    const renderedParts = parts.map((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Remove ** and render as bold
        return <strong key={`${lineIndex}-${partIndex}`}>{part.slice(2, -2)}</strong>;
      }
      return <span key={`${lineIndex}-${partIndex}`}>{part}</span>;
    });
    
    // Add line break after each line except the last
    if (lineIndex < lines.length - 1) {
      return (
        <span key={`line-${lineIndex}`}>
          {renderedParts}
          <br />
        </span>
      );
    }
    return <span key={`line-${lineIndex}`}>{renderedParts}</span>;
  });
};

export default renderMarkdownBold;
