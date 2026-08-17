'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Search' },
  { href: '/prospects', label: 'Top Prospects' },
  { href: '/audits', label: 'Audits' },
  { href: '/demos', label: 'Demos' },
  { href: '/crm', label: 'CRM' },
  { href: '/data', label: 'Data' },
  { href: '/settings', label: 'Settings' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              'whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
              active
                ? 'bg-surface-2 text-ink'
                : 'text-ink-muted hover:bg-surface hover:text-ink',
            ].join(' ')}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
