'use client';

import Image from 'next/image';

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white pb-[env(safe-area-inset-bottom)] h-[107px] flex items-center justify-center gap-16 px-7 shadow-lg"
      aria-label="Main navigation"
    >
      {/* Survey */}
      <button
        className="flex flex-col items-center gap-0.5 w-[84px] min-w-[44px] min-h-[44px]"
        aria-label="Survey"
      >
        <div className="h-[50px] w-full relative">
          <Image
            src="/icons/survey.svg"
            alt=""
            width={84}
            height={50}
            className="object-contain"
          />
        </div>
        <span className="text-[10px] font-normal text-[var(--color-pink-light)] text-center leading-normal">
          Survey
        </span>
      </button>

      {/* UIUC Favorites */}
      <button
        className="flex flex-col items-center gap-1.5 w-[84px] min-w-[44px] min-h-[44px]"
        aria-label="UIUC Favorites"
      >
        <div className="h-[46px] w-[55px] relative">
          <Image
            src="/icons/uiuc-favorites.svg"
            alt=""
            width={55}
            height={46}
            className="object-contain"
          />
        </div>
        <span className="text-[10px] font-normal text-[var(--color-magenta)] text-center leading-normal">
          UIUC Favorites
        </span>
      </button>
    </nav>
  );
}
