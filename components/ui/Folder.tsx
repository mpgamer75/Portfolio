'use client';
import { useState, useEffect } from 'react';

// Fonction utilitaire pour assombrir la couleur
const darkenColor = (hex: string, percent: number) => {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color
      .split('')
      .map(c => c + c)
      .join('');
  }
  const num = parseInt(color, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

interface FolderProps {
  color?: string;
  size?: number;
  items?: React.ReactNode[];
  className?: string;
}

const Folder = ({ color = '#9CA3AF', size = 1, items = [], className = '' }: FolderProps) => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const maxItems = 5;
  const papers = items.slice(0, maxItems);
  while (papers.length < maxItems) {
    papers.push(null);
  }

  const [open, setOpen] = useState(false);
  const [paperOffsets, setPaperOffsets] = useState(Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })));

  const folderBackColor = darkenColor(color, 0.08);
  const paper1 = darkenColor('#ffffff', 0.1);
  const paper2 = darkenColor('#ffffff', 0.05);
  const paper3 = '#ffffff';
  const paper4 = darkenColor('#ffffff', 0.08);
  const paper5 = darkenColor('#ffffff', 0.03);

  const handleClick = () => {
    setOpen(prev => !prev);
    if (open) {
      setPaperOffsets(Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })));
    }
  };

  const handlePaperMouseMove = (e: React.MouseEvent, index: number) => {
    if (!open || isMobile) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const offsetX = (e.clientX - centerX) * 0.15;
    const offsetY = (e.clientY - centerY) * 0.15;
    setPaperOffsets(prev => {
      const newOffsets = [...prev];
      newOffsets[index] = { x: offsetX, y: offsetY };
      return newOffsets;
    });
  };

  const handlePaperMouseLeave = (index: number) => {
    if (isMobile) return;
    setPaperOffsets(prev => {
      const newOffsets = [...prev];
      newOffsets[index] = { x: 0, y: 0 };
      return newOffsets;
    });
  };

  const folderStyle = {
    '--folder-color': color,
    '--folder-back-color': folderBackColor,
    '--paper-1': paper1,
    '--paper-2': paper2,
    '--paper-3': paper3,
    '--paper-4': paper4,
    '--paper-5': paper5,
  };

  const scaleStyle = { transform: `scale(${size})` };

  const getOpenTransform = (index: number) => {
    if (isMobile) {
      switch (index) {
        case 0: return 'translate(-120%, -80%) rotate(-15deg)';
        case 1: return 'translate(-40%, -90%) rotate(-5deg)';
        case 2: return 'translate(40%, -90%) rotate(5deg)';
        case 3: return 'translate(120%, -80%) rotate(15deg)';
        case 4: return 'translate(0%, -70%) rotate(0deg)';
        default: return '';
      }
    }
    
    switch (index) {
      case 0: return 'translate(-150%, -100%) rotate(-20deg)';
      case 1: return 'translate(-50%, -120%) rotate(-5deg)';
      case 2: return 'translate(50%, -120%) rotate(5deg)';
      case 3: return 'translate(150%, -100%) rotate(20deg)';
      case 4: return 'translate(0%, -80%) rotate(0deg)';
      default: return '';
    }
  };

  return (
    <div style={scaleStyle} className={className}>
      <div
        className={`group relative transition-all ${isMobile ? 'duration-150' : 'duration-200'} ease-in cursor-pointer ${
          !open ? 'hover:-translate-y-2 hover:scale-105' : ''
        }`}
        style={{
          ...folderStyle,
          transform: open ? 'translateY(-8px)' : undefined,
          filter: isMobile
            ? 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6)) drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4))'
            : 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))',
        }}
        onClick={handleClick}
        role="button"
        aria-label={open ? 'Close folder' : 'Open folder to view projects'}
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <div
          className={`relative w-[100px] h-[80px] rounded-tl-0 rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px] ${
            isMobile ? 'ring-2 ring-white/20' : ''
          } ${!open ? 'group-hover:ring-2 group-hover:ring-white/30' : ''}`}
          style={{
            backgroundColor: 'var(--folder-back-color)',
          }}
        >
          <span
            className="absolute z-0 bottom-[98%] left-0 w-[30px] h-[10px] rounded-tl-[5px] rounded-tr-[5px] rounded-bl-0 rounded-br-0"
            style={{ backgroundColor: 'var(--folder-back-color)' }}
          ></span>
          {papers.map((item, i) => {
            let sizeClasses = '';
            if (i === 0) sizeClasses = open ? 'w-[70%] h-[80%]' : 'w-[70%] h-[80%]';
            if (i === 1) sizeClasses = open ? 'w-[80%] h-[80%]' : 'w-[80%] h-[70%]';
            if (i === 2) sizeClasses = open ? 'w-[90%] h-[80%]' : 'w-[90%] h-[60%]';
            if (i === 3) sizeClasses = open ? 'w-[80%] h-[80%]' : 'w-[80%] h-[50%]';
            if (i === 4) sizeClasses = open ? 'w-[70%] h-[80%]' : 'w-[70%] h-[40%]';

            const transformStyle = open
              ? isMobile 
                ? getOpenTransform(i)
                : `${getOpenTransform(i)} translate(${paperOffsets[i].x}px, ${paperOffsets[i].y}px)`
              : undefined;

            const getPaperColor = (index: number) => {
              switch (index) {
                case 0: return 'var(--paper-1)';
                case 1: return 'var(--paper-2)';
                case 2: return 'var(--paper-3)';
                case 3: return 'var(--paper-4)';
                case 4: return 'var(--paper-5)';
                default: return 'var(--paper-3)';
              }
            }

            return (
              <div
                key={i}
                onMouseMove={e => handlePaperMouseMove(e, i)}
                onMouseLeave={() => handlePaperMouseLeave(i)}
                className={`absolute z-20 bottom-[10%] left-1/2 transition-all ${isMobile ? 'duration-150' : 'duration-300'} ease-in-out ${
                  !open ? 'transform -translate-x-1/2 translate-y-[10%] group-hover:translate-y-0' : isMobile ? '' : 'hover:scale-110'
                } ${sizeClasses} ${isMobile && open ? 'ring-1 ring-white/30' : ''}`}
                style={{
                  ...(!open ? {} : { transform: transformStyle }),
                  backgroundColor: getPaperColor(i),
                  borderRadius: '10px',
                  willChange: open && !isMobile ? 'transform' : 'auto',
                  boxShadow: isMobile && open 
                    ? '0 2px 8px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.3)' 
                    : 'none',
                }}
              >
                {item}
              </div>
            );
          })}
          <div
            className={`absolute z-30 w-full h-full origin-bottom transition-all ${isMobile ? 'duration-150' : 'duration-300'} ease-in-out ${
              !open ? 'group-hover:[transform:skew(15deg)_scaleY(0.6)]' : ''
            }`}
            style={{
              backgroundColor: 'var(--folder-color)',
              borderRadius: '5px 10px 10px 10px',
              ...(open && { transform: 'skew(15deg) scaleY(0.6)' }),
            }}
          ></div>
          <div
            className={`absolute z-30 w-full h-full origin-bottom transition-all ${isMobile ? 'duration-150' : 'duration-300'} ease-in-out ${
              !open ? 'group-hover:[transform:skew(-15deg)_scaleY(0.6)]' : ''
            }`}
            style={{
              backgroundColor: 'var(--folder-color)',
              borderRadius: '5px 10px 10px 10px',
              ...(open && { transform: 'skew(-15deg) scaleY(0.6)' }),
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default Folder;