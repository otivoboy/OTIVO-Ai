import React from 'react';

export const DeepSearchIcon: React.FC<{ size?: number }> = ({ size = 28 }) => {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <style>{`
        .icon-wrapper {
            position: relative;
            width: 100%;
            height: 100%;
            animation: fast-spin 1.5s linear infinite;
        }

        .deep-search-svg {
            width: 100%;
            height: 100%;
            fill: none;
            stroke-width: 3; 
            stroke-linecap: round;
        }

        .glow-line {
            animation: color-cycle 2s linear infinite;
        }

        .meridian {
            transform-origin: center;
            animation: 
                rapid-rearrange 0.5s ease-in-out infinite,
                color-cycle 2s linear infinite;
        }

        .m1 { animation-delay: 0s, 0s; }
        .m2 { animation-delay: -0.15s, -0.5s; }
        .m3 { animation-delay: -0.3s, -1s; }

        @keyframes color-cycle {
            0%, 100% { stroke: #ffffff; filter: drop-shadow(0 0 1px #ffffff); }
            33% { stroke: #00d2ff; filter: drop-shadow(0 0 2px #00d2ff); }
            66% { stroke: #3fffcf; filter: drop-shadow(0 0 2px #3fffcf); }
        }

        @keyframes rapid-rearrange {
            0%, 100% { transform: scaleX(1); opacity: 0.4; }
            50% { transform: scaleX(-1); opacity: 1; }
        }

        @keyframes fast-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .aura {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(0, 210, 255, 0.15) 0%, transparent 70%);
            filter: blur(8px);
            z-index: -1;
            animation: pulse-aura 3s ease-in-out infinite;
        }

        @keyframes pulse-aura {
            0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>
      <div className="icon-wrapper">
        <div className="aura"></div>
        <svg viewBox="0 0 100 100" className="deep-search-svg">
            <circle className="glow-line" cx="50" cy="50" r="45" opacity="0.3" strokeWidth="2" />
            <line className="glow-line" x1="5" y1="50" x2="95" y2="50" opacity="0.8" />
            <line className="glow-line" x1="50" y1="5" x2="50" y2="95" opacity="0.8" />
            <ellipse className="meridian m1" cx="50" cy="50" rx="38" ry="45" />
            <ellipse className="meridian m2" cx="50" cy="50" rx="22" ry="45" />
            <ellipse className="meridian m3" cx="50" cy="50" rx="8" ry="45" />
        </svg>
      </div>
    </div>
  );
};
