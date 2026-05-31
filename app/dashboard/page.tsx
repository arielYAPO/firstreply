import type { Metadata } from "next";
import FirstReplyWorkspace from "@/components/FirstReplyWorkspace";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return <FirstReplyWorkspace />;
}
