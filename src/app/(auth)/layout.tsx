import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={plusJakartaSans.className}>{children}</div>;
}
