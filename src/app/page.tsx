import { CalendarApp } from "@/components/CalendarApp";
import { StoreProvider } from "@/lib/store";

export default function Home() {
  return (
    <StoreProvider>
      <CalendarApp />
    </StoreProvider>
  );
}
