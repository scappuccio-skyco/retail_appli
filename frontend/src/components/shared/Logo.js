import React from 'react';

/**
 * Logo Component - Composant réutilisable pour le logo Retail Performer AI
 * 
 * Variantes disponibles:
 * - header: Logo + texte complet avec "by SKY CO" (pour headers)
 * - footer: Version blanche pour fonds sombres
 * - login: Version centrée pour pages de connexion
 * - icon: Logo seul sans texte
 * - diagnostic: Logo avec fond blanc et ombre (pour formulaires diagnostic)
 * 
 * Tailles: xs, sm, md, lg, xl
 */

const Logo = ({ 
  variant = 'header', 
  size = 'md', 
  className = '',
  showText = true,
  showByline = true 
}) => {
  // Configuration des tailles
  const sizeConfig = {
    xs: {
      icon: 'h-8 sm:h-10',
      iconSquare: 'w-12 h-12',
      title: 'text-sm sm:text-base',
      byline: 'text-xs',
      gap: 'gap-2'
    },
    sm: {
      icon: 'h-10 sm:h-12',
      iconSquare: 'w-16 h-16',
      title: 'text-base',
      byline: 'text-sm',
      gap: 'gap-2'
    },
    md: {
      icon: 'h-12 sm:h-14',
      iconSquare: 'w-20 h-20',
      title: 'text-base sm:text-xl',
      byline: 'text-sm sm:text-base',
      gap: 'gap-2 sm:gap-3'
    },
    lg: {
      icon: 'h-14 sm:h-16',
      iconSquare: 'w-24 h-24',
      title: 'text-lg sm:text-2xl',
      byline: 'text-sm sm:text-base',
      gap: 'gap-3'
    },
    xl: {
      icon: 'h-16 sm:h-20',
      iconSquare: 'w-28 h-28',
      title: 'text-xl sm:text-3xl',
      byline: 'text-base',
      gap: 'gap-3 sm:gap-4'
    }
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  // Rendu selon la variante
  switch (variant) {
    case 'header':
      return (
        <div className={`flex items-center ${currentSize.gap} ${className}`}>
          <img 
            src="/logo-icon.png" 
            alt="Retail Performer AI" 
            className={`${currentSize.icon} w-auto object-contain`} 
          />
          {showText && (
            <div className="flex flex-col">
              <span className={`${currentSize.title} font-bold text-[#1E40AF] leading-tight`}>
                Retail Performer AI
              </span>
              {showByline && (
                <span className={`${currentSize.byline} font-bold`}>
                  by <span className="text-gray-900">SKY</span> <span className="text-[#F97316]">CO</span>
                </span>
              )}
            </div>
          )}
        </div>
      );

    case 'footer':
      return (
        <div className={`flex items-center ${currentSize.gap} ${className}`}>
          <img 
            src="/logo-icon.png" 
            alt="Retail Performer AI" 
            className={`${currentSize.icon} w-auto object-contain`} 
          />
          {showText && (
            <div className="flex flex-col">
              <span className={`${currentSize.title} font-bold text-white leading-tight`}>
                Retail Performer AI
              </span>
              {showByline && (
                <span className={`${currentSize.byline} font-bold`}>
                  by <span className="text-white">SKY</span> <span className="text-[#F97316]">CO</span>
                </span>
              )}
            </div>
          )}
        </div>
      );

    case 'login':
      return (
        <div className={`flex flex-col items-center ${className}`}>
          <img 
            src="/logo-icon.png" 
            alt="Retail Performer AI" 
            className={`${currentSize.icon} object-contain mb-4`}
          />
          {showText && (
            <>
              <h1 className={`${currentSize.title} font-bold text-[#1E40AF]`}>
                Retail Performer AI
              </h1>
              {showByline && (
                <p className={`${currentSize.byline} font-bold`}>
                  by <span className="text-gray-900">SKY</span> <span className="text-[#F97316]">CO</span>
                </p>
              )}
            </>
          )}
        </div>
      );

    case 'icon':
      return (
        <img 
          src="/logo-icon.png" 
          alt="Retail Performer AI" 
          className={`${currentSize.icon} w-auto object-contain ${className}`}
        />
      );

    case 'diagnostic':
      return (
        <img 
          src="/logo-icon.png" 
          alt="Retail Performer" 
          className={`${currentSize.iconSquare} mx-auto mb-4 rounded-xl shadow-md object-contain bg-white p-2 ${className}`}
        />
      );

    case 'dashboard':
      return (
        <div className={`flex items-center ${currentSize.gap} ${className}`}>
          <img 
            src="/logo-icon.png" 
            alt="Retail Performer AI" 
            className={`${currentSize.icon} object-contain`} 
          />
          {showText && (
            <div className="hidden sm:flex flex-col">
              <span className={`${currentSize.title} font-bold text-[#1E40AF] leading-tight`}>
                Retail Performer AI
              </span>
              {showByline && (
                <span className={`${currentSize.byline} font-bold`}>
                  by <span className="text-gray-900">SKY</span> <span className="text-[#F97316]">CO</span>
                </span>
              )}
            </div>
          )}
        </div>
      );

    default:
      return (
        <div className={`flex items-center ${currentSize.gap} ${className}`}>
          <img 
            src="/logo-icon.png" 
            alt="Retail Performer AI" 
            className={`${currentSize.icon} w-auto object-contain`} 
          />
          {showText && (
            <span className={`${currentSize.title} font-bold text-[#1E40AF]`}>
              Retail Performer AI
            </span>
          )}
        </div>
      );
  }
};

export default Logo;
