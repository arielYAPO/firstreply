import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Démo",
};

export default function DemoTrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
