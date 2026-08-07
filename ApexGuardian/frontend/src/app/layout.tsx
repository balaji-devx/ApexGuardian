import type { Metadata } from "next";
import "./globals.css";
import { NavigationProvider } from "@/context/NavigationContext";

export const metadata: Metadata = {
  title: "Apex Guardian - AI Navigation Engine",
  description: "AI-powered predictive navigation engine for Bengaluru",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full overflow-hidden">
      <body className="h-full w-full overflow-hidden bg-slate-900 text-slate-900 antialiased">
        <NavigationProvider>
          {children}
        </NavigationProvider>
      </body>
    </html>
  );
}
