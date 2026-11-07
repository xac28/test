'use client';

import { useRef } from 'react';

/** Native audio element; the first play of a page view counts one listen. */
export function PodcastPlayer({ id, src, className = '' }: { id: string; src: string; className?: string }) {
  const counted = useRef(false);
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio
      controls
      preload="none"
      src={src}
      data-testid="podcast-audio"
      className={`w-full ${className}`}
      onPlay={() => {
        if (counted.current) return;
        counted.current = true;
        fetch(`/api/podcast/${id}/play`, { method: 'POST' }).catch(() => {});
      }}
    />
  );
}
