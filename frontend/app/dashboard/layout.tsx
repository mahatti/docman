import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dasbor",
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return children;
}
