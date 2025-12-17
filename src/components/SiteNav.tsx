"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/", label: "miR Atlas" },
  { href: "/enrichment", label: "Enrichment" },
  { href: "/trf", label: "tRF Atlas" },
  { href: "/downloads", label: "Downloads" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/85 backdrop-blur">
      <div className="mx-auto w-full max-w-[1400px] px-6 py-3 flex items-center justify-between">
        {/* Left: brand */}
        <Link href="/" className="font-semibold tracking-tight text-gray-900">
          The Human Brain MicroRNA Atlas
        </Link>

        {/* Right: links */}
        <nav className="flex items-center gap-2">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-full px-3 py-1.5 text-sm transition",
                  active
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-100",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
