'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getRestaurantImagePath } from '@/lib/image';
import type { ApiResponse, MatchupResponse } from '@/types/api';
import type { Restaurant } from '@/types/restaurant';

export default function LoadingScreen() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Check if user has seen the loading screen before
    const hasSeenLoading = typeof window !== 'undefined' 
      ? localStorage.getItem('ff_has_seen_loading') === 'true'
      : false;

    if (hasSeenLoading) {
      setShow(false);
      return;
    }

    // Preload restaurant images in the background
    const preloadImages = async () => {
      try {
        // Fetch initial matchup data
        const res = await fetch('/api/matchup?category=value', { cache: 'no-store' });
        const json: ApiResponse<MatchupResponse> = await res.json();
        
        if (json.ok && json.data) {
          const { restaurantA, restaurantB } = json.data;
          
          // Preload images for both restaurants
          const preloadImage = (restaurant: Restaurant) => {
            const imagePath = getRestaurantImagePath(restaurant);
            
            // Use link prefetch for better performance
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'image';
            link.href = imagePath;
            document.head.appendChild(link);
            
            // Also preload using Image component approach (creates image element)
            const img = new window.Image();
            img.src = imagePath;
          };
          
          preloadImage(restaurantA);
          preloadImage(restaurantB);
        }
      } catch (error) {
        // Silently fail - image preloading is not critical
        console.debug('Failed to preload images:', error);
      }
    };

    // Start preloading images
    preloadImages();

    // Show loading screen for 1.5 seconds
    const timer = setTimeout(() => {
      setShow(false);
      // Mark that user has seen the loading screen
      if (typeof window !== 'undefined') {
        localStorage.setItem('ff_has_seen_loading', 'true');
      }
    }, 1100);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#741b3f] flex items-center justify-center"
      data-name="Loading Screen"
      data-node-id="272:7944"
    >
      <div className="flex items-center justify-center">
        <Image
          src="/logos/big_logo.svg"
          alt="Fork Fight"
          width={277}
          height={228}
          priority
          className="w-auto h-auto"
        />
      </div>
    </div>
  );
}

