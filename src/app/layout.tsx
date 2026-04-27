import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Toaster } from "sonner";
import { AuthTokenProvider } from "@/components/auth/AuthTokenProvider";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: {
    default: "Ventu Suli",
    template: "%s | Ventu Suli",
  },
  description: "Ventu Suli - Plataforma para gestao de assessorias esportivas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={sora.className}>
        <AuthTokenProvider>
          {children}
          <Toaster
            richColors
            position="top-right"
            closeButton
            expand
            duration={3200}
            visibleToasts={4}
            toastOptions={{
              className: "border border-white/10 bg-[#10243d] text-slate-100",
            }}
          />
        </AuthTokenProvider>
      </body>
    </html>
  );
}
