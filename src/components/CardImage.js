import React, { useState, useEffect } from 'react';

function CardImage({ imagePath, alt, onError, className = '' }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      if (!imagePath) {
        setLoading(false);
        return;
      }

      // Если это уже data URL или http URL, используем напрямую
      if (
        imagePath.startsWith('data:') ||
        imagePath.startsWith('http://') ||
        imagePath.startsWith('https://')
      ) {
        setImageSrc(imagePath);
        setLoading(false);
        return;
      }

      // Для локальных путей Cards/ - загружаем как base64
      const normalizedPath = imagePath.replace(/\\/g, '/');
      if (normalizedPath.startsWith('Cards/')) {
        try {
          const result = await window.electronAPI.getImageAsBase64(normalizedPath);
          if (result.success) {
            setImageSrc(result.dataUrl);
          } else {
            console.error('Error loading image:', result.error);
            if (onError) onError();
          }
        } catch (e) {
          console.error('Error loading image:', e);
          if (onError) onError();
        }
      } else {
        setImageSrc(imagePath);
      }

      setLoading(false);
    };

    loadImage();
  }, [imagePath, onError]);

  if (loading) {
    return <div className="image-loading">⏳</div>;
  }

  if (!imageSrc) {
    return null;
  }

  return (
    <img
      className={className}
      src={imageSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.target.style.display = 'none';
        if (onError) onError();
      }}
    />
  );
}

export default CardImage;
