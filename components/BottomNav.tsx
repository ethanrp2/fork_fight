'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();
  const isSurvey = pathname === '/' || pathname?.startsWith('/game');
  const isMyFavorites = pathname?.startsWith('/my-favorites');
  const isFavorites = pathname?.startsWith('/favorites') && !isMyFavorites;

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white pb-[env(safe-area-inset-bottom)] h-[80px] flex items-center justify-center gap-16 px-7 shadow-lg"
      aria-label="Main navigation"
    >
      {/* Survey */}
      <Link href="/" aria-label="Survey" aria-current={isSurvey ? 'page' : undefined}
        className="flex flex-col items-center gap-0.5 w-[84px] min-w-[44px] min-h-[44px]">
        <div className="h-[50px] w-full relative" style={isSurvey ? { filter: 'brightness(0)' } : {}}>
          <Image src="/icons/survey.svg" alt="" width={84} height={50} className="object-contain" />
        </div>
        <span className={`text-[10px] font-normal text-center leading-normal ${isSurvey ? 'text-[#222222]' : 'text-[#741B3F]'}`}>
          Survey
        </span>
      </Link>

      {/* My Favorites */}
      <Link href="/my-favorites" aria-label="My Favorites" aria-current={isMyFavorites ? 'page' : undefined}
        className="flex flex-col items-center gap-2 w-[84px] min-w-[44px] min-h-[44px]">
        <div className={`h-[38px] w-[32px] relative ${isMyFavorites ? 'text-[#222222]' : 'text-[#741B3F]'}`}>
          <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_429_310)">
              <path d="M26.2066 10.1905C26.2066 15.7841 21.5961 20.381 15.9999 20.381C10.4037 20.381 5.79321 15.7778 5.79321 10.1905C5.79321 6.51429 7.96173 3.90476 8.43868 3.37778C8.86476 2.90159 11.5802 0 15.9999 0C19.9617 0 22.5182 2.33651 23.0587 2.85714C23.4466 3.23175 26.2066 6.05714 26.2066 10.1905Z" fill="currentColor"/>
              <path d="M29.8378 38C31.1924 38 32.1971 36.7746 31.9618 35.4413C30.6518 27.8222 24 22.0254 15.9936 22.0254C7.98728 22.0254 1.34817 27.8159 0.031795 35.4349C-0.19714 36.7682 0.80127 37.9936 2.1558 37.9936H29.8315L29.8378 38Z" fill="currentColor"/>
            </g>
            <defs>
              <clipPath id="clip0_429_310">
                <rect width="32" height="38" fill="white"/>
              </clipPath>
            </defs>
          </svg>
        </div>
        <span className={`text-[10px] font-normal text-center leading-normal ${isMyFavorites ? 'text-[#222222]' : 'text-[#741B3F]'}`}>
          My Favorites
        </span>
      </Link>

      {/* UIUC Favorites */}
      <Link href="/favorites" aria-label="UIUC Favorites" aria-current={isFavorites ? 'page' : undefined}
        className="flex flex-col items-center gap-1.5 w-[84px] min-w-[44px] min-h-[44px]">
        <div className="h-[46px] w-[55px] relative" style={isFavorites ? { filter: 'brightness(0)' } : {}}>
          <Image src="/icons/uiuc-favorites.svg" alt="" width={55} height={46} className="object-contain" />
        </div>
        <span className={`text-[10px] font-normal text-center leading-normal ${isFavorites ? 'text-[#222222]' : 'text-[#741B3F]'}`}>
          UIUC Favorites
        </span>
      </Link>
    </nav>
  );
}
