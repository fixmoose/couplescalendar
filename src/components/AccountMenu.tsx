"use client";

import clsx from "clsx";
import { LogOut, RefreshCw, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ContextMenu, type MenuState } from "./ContextMenu";
import { Avatar } from "./ui";

/** The signed-in user, with a refresh and a way out. */
export function AccountMenu({
  onSettings,
  onTrash,
}: {
  onSettings: () => void;
  onTrash: () => void;
}) {
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
          label:
            store.myPresence === "active"
              ? "You are in the calendar"
              : "You are away — click anything to come back",
          icon: (
            <span
              className={clsx(
                "h-2.5 w-2.5 rounded-full",
                store.myPresence === "active" ? "bg-[#3f9142]" : "bg-[#dc9a15]",
              )}
            />
          ),
          disabled: true,
          onSelect: () => {},
        },
        { kind: "separator" },
        {
          label: "Settings",
          icon: <Settings size={13} />,
          onSelect: onSettings,
        },
        {
          label: "Recently deleted",
          icon: <Trash2 size={13} />,
          onSelect: onTrash,
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
        <Avatar person={store.me} size={28} status={store.myPresence} />
      </button>
      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}
    </>
  );
}
