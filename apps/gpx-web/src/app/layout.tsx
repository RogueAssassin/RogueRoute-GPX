import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RogueRoute GPX v8",
  description: "Cyber neon GPX route generation with IITC export, strict land routing, and RogueAssassin branding.",
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
