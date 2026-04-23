import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AuthCardProps {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, description, className, children }: AuthCardProps) {
  return (
    <Card
      className={cn(
        "border-white/10 bg-[#1E3A5F]/90 text-white shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur",
        className,
      )}
    >
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl font-semibold">{title}</CardTitle>
        {description ? <CardDescription className="text-slate-300">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

