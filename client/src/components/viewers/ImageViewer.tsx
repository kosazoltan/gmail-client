import { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from 'lucide-react';

interface ImageViewerProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export function ImageViewer({ url, filename, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [fitToScreen, setFitToScreen] = useState<boolean>(true);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const handleZoomIn = () => {
    setFitToScreen(false);
    setScale(s => Math.min(3, s + 0.25));
  };

  const handleZoomOut = () => {
    setFitToScreen(false);
    setScale(s => Math.max(0.25, s - 0.25));
  };

  const handleRotate = () => {
    setRotation(r => (r + 90) % 360);
  };

  const handleFitToScreen = () => {
    setFitToScreen(true);
    setScale(1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm text-white">
        <h2 className="text-lg font-medium truncate max-w-md">{filename}</h2>

        <div className="flex items-center gap-2">
          {/* Zoom gombok */}
          <button
            onClick={handleZoomOut}
            className="p-2 rounded hover:bg-white/10 transition-colors"
            title="Kicsinyítés"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-sm px-2 min-w-[60px] text-center">
            {fitToScreen ? 'Auto' : `${Math.round(scale * 100)}%`}
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 rounded hover:bg-white/10 transition-colors"
            title="Nagyítás"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          {/* Fit to screen */}
          <button
            onClick={handleFitToScreen}
            className={`p-2 rounded hover:bg-white/10 transition-colors ml-2 ${fitToScreen ? 'bg-white/20' : ''}`}
            title="Képernyőhöz igazítás"
          >
            <Maximize2 className="h-5 w-5" />
          </button>

          {/* Forgatás */}
          <button
            onClick={handleRotate}
            className="p-2 rounded hover:bg-white/10 transition-colors"
            title="Forgatás 90°"
          >
            <RotateCw className="h-5 w-5" />
          </button>

          {/* Letöltés */}
          <button
            onClick={handleDownload}
            className="p-2 rounded hover:bg-white/10 transition-colors ml-2"
            title="Letöltés"
          >
            <Download className="h-5 w-5" />
          </button>

          {/* Bezárás */}
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-white/10 transition-colors ml-2"
            title="Bezárás (ESC)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Kép tartalom */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <img
          src={url}
          alt={filename}
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${fitToScreen ? 1 : scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center',
          }}
          draggable={false}
        />
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full opacity-50 hover:opacity-100 transition-opacity">
        ESC: Bezárás | +/-: Zoom | R: Forgatás
      </div>
    </div>
  );
}
