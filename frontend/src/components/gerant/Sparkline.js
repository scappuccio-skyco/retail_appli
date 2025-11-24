import React from 'react';

const Sparkline = ({ data, width = 100, height = 30, color = '#f97316' }) => {
  if (!data || data.length === 0) {
    return <div style={{ width, height }} className="bg-gray-100 rounded" />;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  // Générer les points du path SVG
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Ligne de base */}
      <line
        x1="0"
        y1={height}
        x2={width}
        y2={height}
        stroke="#e5e7eb"
        strokeWidth="1"
      />
      
      {/* Courbe */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Points */}
      {data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="2"
            fill={color}
          />
        );
      })}
      
      {/* Dernier point plus gros */}
      {data.length > 0 && (
        <circle
          cx={(data.length - 1) / (data.length - 1) * width}
          cy={height - ((data[data.length - 1] - min) / range) * height}
          r="3"
          fill={color}
          stroke="white"
          strokeWidth="1"
        />
      )}
    </svg>
  );
};

export default Sparkline;
