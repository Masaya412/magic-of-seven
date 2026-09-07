import type { Metadata } from "next";
import ChakraProvider from "@/providers/ChakraProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "7つの魔法",
  description: "7種類の魔法カードで競うローカル対戦カードゲーム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <ChakraProvider>{children}</ChakraProvider>
      </body>
    </html>
  );
}
