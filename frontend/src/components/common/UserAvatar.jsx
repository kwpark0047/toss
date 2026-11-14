import { useEffect, useState } from 'react';

export default function UserAvatar({ name, imageUrl, className = '', imageClassName = '' }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [imageUrl]);

  return (
    <div
      role="img"
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${className}`}
      aria-label={name ? `${name} 프로필` : '프로필'}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={`h-full w-full object-cover ${imageClassName}`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{name?.trim()?.charAt(0) || '사'}</span>
      )}
    </div>
  );
}
