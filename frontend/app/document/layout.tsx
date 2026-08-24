import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dokumen",
};

export default function DocumentLayout({ children }: LayoutProps<"/document">) {
  return children;
}
