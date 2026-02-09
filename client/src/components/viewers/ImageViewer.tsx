import { useState, useEffect } from 'react';
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
    setScale((s) => Math.min(3, s + 0.25));
  };

  const handleZoomOut = () => {
    setFitToScreen(false);
    setScale((s) => Math.max(0.25, s - 0.25));
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleFitToScreen = () => {
    setFitToScreen(true);
    setScale(1);
  };

  // Add keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleRotate();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, scale, fitToScreen]); // Include dependencies for handlers

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between bg-black/50 p-4 text-white backdrop-blur-sm">
        <h2 className="max-w-md truncate text-lg font-medium">{filename}</h2>

        <div className="flex items-center gap-2">
          {/* Zoom gombok */}
          <button
            onClick={handleZoomOut}
            className="rounded p-2 transition-colors hover:bg-white/10"
            title="Kicsinyítés"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="min-w-[60px] px-2 text-center text-sm">
            {fitToScreen ? 'Auto' : `${Math.round(scale * 100)}%`}
          </span>
          <button
            onClick={handleZoomIn}
            className="rounded p-2 transition-colors hover:bg-white/10"
            title="Nagyítás"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          {/* Fit to screen */}
          <button
            onClick={handleFitToScreen}
            className={`ml-2 rounded p-2 transition-colors hover:bg-white/10 ${fitToScreen ? 'bg-white/20' : ''}`}
            title="Képernyőhöz igazítás"
          >
            <Maximize2 className="h-5 w-5" />
          </button>

          {/* Forgatás */}
          <button
            onClick={handleRotate}
            className="rounded p-2 transition-colors hover:bg-white/10"
            title="Forgatás 90°"
          >
            <RotateCw className="h-5 w-5" />
          </button>

          {/* Letöltés */}
          <button
            onClick={handleDownload}
            className="ml-2 rounded p-2 transition-colors hover:bg-white/10"
            title="Letöltés"
          >
            <Download className="h-5 w-5" />
          </button>

          {/* Bezárás */}
          <button
            onClick={onClose}
            className="ml-2 rounded p-2 transition-colors hover:bg-white/10"
            title="Bezárás (ESC)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Kép tartalom */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <img
          src={url}
          alt={filename}
          className="max-h-full max-w-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${fitToScreen ? 1 : scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center',
          }}
          draggable={false}
        />
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs text-white opacity-50 backdrop-blur-sm transition-opacity hover:opacity-100">
        ESC: Bezárás | +/-: Zoom | R: Forgatás
      </div>
    </div>
  );
}
