"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DROPDOWN_NAV_CONTENT_CLASS,
  DROPDOWN_NAV_ITEM_CLASS,
} from "@/components/ui/menu-item-styles";

/** Theme toggle (Light/Dark/System) — extracted from the old Navbar's inline ModeToggle. */
export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          className="h-8 w-8 sm:h-9 sm:w-9 focus-visible:outline-none focus:outline-none focus-visible:ring-0 focus:ring-0"
        >
          <Sun className="h-4 w-4 sm:h-[1.1rem] sm:w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 sm:h-[1.1rem] sm:w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={`w-40 ${DROPDOWN_NAV_CONTENT_CLASS}`}
      >
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={DROPDOWN_NAV_ITEM_CLASS}
        >
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={DROPDOWN_NAV_ITEM_CLASS}
        >
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={DROPDOWN_NAV_ITEM_CLASS}
        >
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
