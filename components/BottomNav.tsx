'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();
  const isSurvey = pathname === '/' || pathname?.startsWith('/game');
  const isFavorites = pathname?.startsWith('/favorites');

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white pb-[env(safe-area-inset-bottom)] h-[80px] flex items-center justify-center gap-16 px-7 shadow-lg"
      aria-label="Main navigation"
    >
      {/* Survey */}
      <Link href="/" aria-label="Survey" aria-current={isSurvey ? 'page' : undefined}
        className="flex flex-col items-center gap-0.5 w-[84px] min-w-[44px] min-h-[44px]">
        <div className="h-[50px] w-full relative">
          <Image src="/icons/survey.svg" alt="" width={84} height={50} className="object-contain" />
        </div>
        <span className={`text-[10px] font-normal text-center leading-normal ${isSurvey ? 'text-[var(--color-magenta)]' : 'text-[var(--color-pink-light)]'}`}>
          Survey
        </span>
      </Link>

      {/* UIUC Favorites */}
      <Link href="/favorites" aria-label="UIUC Favorites" aria-current={isFavorites ? 'page' : undefined}
        className="flex flex-col items-center gap-1.5 w-[84px] min-w-[44px] min-h-[44px]">
        <div className="h-[46px] w-[55px] relative">
          <Image src="/icons/uiuc-favorites.svg" alt="" width={55} height={46} className="object-contain" />
        </div>
        <span className={`text-[10px] font-normal text-center leading-normal ${isFavorites ? 'text-[var(--color-magenta)]' : 'text-[var(--color-pink-light)]'}`}>
          UIUC Favorites
        </span>
      </Link>
    </nav>
  );
}
