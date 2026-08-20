"use client";

import { LogOut, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ContextMenu, type MenuState } from "./ContextMenu";
import { Avatar } from "./ui";

/** The signed-in user, with a refresh and a way out. */
export function AccountMenu({ onSettings }: { onSettings: () => void }) {
  const store = useStore();
  const [menu, setMenu] = useState<MenuState | null>(null);

  const open = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({
      x: rect.right - 220,
      y: rect.bottom + 6,
      items: [
        { kind: "heading", label: store.me.email || store.me.name },
        {
          label: "Settings",
          icon: <Settings size={13} />,
          onSelect: onSettings,
        },
        {
          label: "Reload the calendar",
          icon: <RefreshCw size={13} />,
          onSelect: () => void store.refresh(),
        },
        { kind: "separator" },
        {
          label: "Sign out",
          icon: <LogOut size={13} />,
          onSelect: () => {
            const form = document.createElement("form");
            form.method = "POST";
            form.action = "/auth/signout";
            document.body.appendChild(form);
            form.submit();
          },
        },
      ],
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Account"
        className="rounded-full p-0.5 transition hover:bg-surface-2"
      >
        <Avatar person={store.me} size={28} />
      </button>
      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}
    </>
  );
}
