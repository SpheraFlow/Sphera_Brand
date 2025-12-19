import { useState } from 'react';

interface ImagePreviewProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  onError?: () => void;
}

export default function ImagePreview({ 
  src, 
  alt, 
  className = '', 
  fallback,
  onError 
}: ImagePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleError = () => {
    setLoading(false);
    setError(true);
    if (onError) onError();
  };

  if (error && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        onLoad={() => setLoading(false)}
        onError={handleError}
        style={{ display: loading ? 'none' : 'block' }}
      />
    </div>
  );
}
