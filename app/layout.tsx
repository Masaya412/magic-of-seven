import type { Metadata } from "next";
import ChakraProvider from "@/providers/ChakraProvider";

export const metadata: Metadata = {
  title: "7つの魔法",
  description: "7種類の魔法カードで競うローカル対戦カードゲーム",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>
        <ChakraProvider>{children}</ChakraProvider>
      </body>
    </html>
  );
}
