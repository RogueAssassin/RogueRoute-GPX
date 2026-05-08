import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RogueRoute-GPX",
  description:
    "Cyber Neon Wolf OSRM-first GPX route generation with IITC export, road/path-following geometry, strict land routing, and RogueAssassin branding.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "Inter, Arial, sans-serif",
          margin: 0,
          background:
            "radial-gradient(circle at top, rgba(56,189,248,0.12), transparent 30%), radial-gradient(circle at right, rgba(168,85,247,0.10), transparent 25%), #050816",
          color: "#f8fafc",
        }}
      >
        {children}
      </body>
    </html>
  );
}
