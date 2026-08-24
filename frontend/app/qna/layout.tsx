import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tanya Jawab",
};

export default function QnaLayout({ children }: LayoutProps<"/qna">) {
  return children;
}
