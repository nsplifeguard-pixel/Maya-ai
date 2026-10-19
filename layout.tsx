import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAYA AI — Voice Assistant",
  description: "ผู้ช่วย AI ส่วนตัว สนทนาด้วยเสียงแบบเรียลไทม์",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MAYA AI" }
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}