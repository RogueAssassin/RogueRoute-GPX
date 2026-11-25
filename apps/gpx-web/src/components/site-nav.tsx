"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Route builder" },
  { href: "/maps", label: "Map status" },
  { href: "/maps/download", label: "Find a map" },
  { href: "/admin", label: "Admin" },
];

/** Tabs across the top of every page. */
export default function SiteNav() {
  const pathname = usePathname() ?? "/";
  // The most specific link that matches is the current page (/maps/download, not /maps).
  const current = LINKS.filter((link) => (link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="site-nav" aria-label="Site">
      <a className="site-nav-brand" href="/">
        <img src="/favicon.svg" alt="" width={22} height={22} />
        RogueRoute GPX
      </a>
      <ul>
        {LINKS.map((link) => (
          <li key={link.href}>
            <a href={link.href} className={current === link.href ? "is-current" : undefined} aria-current={current === link.href ? "page" : undefined}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
