import { Dashboard } from "@/components/Dashboard";
import { paypalConfigured } from "@/lib/paypal/env";

export default function Home() {
  return <Dashboard paypalConnected={paypalConfigured()} />;
}
