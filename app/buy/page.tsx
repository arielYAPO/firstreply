import type { Metadata } from "next";
import BuyPage from "@/components/BuyPage";

export const metadata: Metadata = {
  title: "Acheter le pack",
};

export default function Buy() {
  return <BuyPage />;
}
