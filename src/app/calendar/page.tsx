import { redirect } from "next/navigation";
import { CalendarApp } from "@/components/CalendarApp";
import { PostLoginRedirect } from "@/components/PostLoginRedirect";
import { StoreProvider } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <StoreProvider>
      <PostLoginRedirect />
      <CalendarApp />
    </StoreProvider>
  );
}
