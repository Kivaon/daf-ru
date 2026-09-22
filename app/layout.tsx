import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://havruta-bekhorot-2a.mffkk78khq.chatgpt.site"),
  title: "Хаврута — Бехорот 2а",
  description: "Интерактивный разбор Талмуда: оригинал, точный перевод и Раши.",
  openGraph: {
    title: "Хаврута — Бехорот 2а",
    description: "Интерактивный разбор Талмуда: оригинал, точный перевод и Раши.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Хаврута — Бехорот 2а",
    description: "Интерактивный разбор Талмуда: оригинал, точный перевод и Раши.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru"><body>{children}</body></html>
  );
}
