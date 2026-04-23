"use client";

import Countdown from "react-countdown";
import { Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PixQrCode({
  pixCode,
  expiresAt,
  amountLabel,
}: {
  pixCode: string;
  expiresAt: Date;
  amountLabel: string;
}) {
  const copyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(pixCode);
      toast.success("PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar o código PIX.");
    }
  };

  return (
    <Card className="border-white/10 bg-[linear-gradient(180deg,#1a3557,#142b47)] text-white">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Pagamento PIX</span>
          <span className="text-[#F5A623]">{amountLabel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mx-auto flex w-full max-w-[224px] items-center justify-center rounded-2xl bg-white p-3 shadow-[0_10px_26px_rgba(0,0,0,0.25)]">
          <QRCodeSVG value={pixCode} size={200} bgColor="#FFFFFF" fgColor="#000000" />
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F2743] p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-300">Codigo copia e cola</p>
          <p className="break-all text-xs text-slate-100">{pixCode}</p>
          <Button
            type="button"
            onClick={copyPixCode}
            className="mt-3 bg-[#F5A623] text-[#0A1628] hover:bg-[#e59a1f]"
          >
            <Copy className="mr-2 h-4 w-4" /> Copiar PIX
          </Button>
        </div>

        <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          Expira em:{" "}
          <Countdown
            date={expiresAt}
            renderer={({ minutes, seconds, completed }) =>
              completed ? "expirado" : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
