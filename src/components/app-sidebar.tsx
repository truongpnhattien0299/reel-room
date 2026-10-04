"use client";

import { ChevronsUpDownIcon, ImageIcon, LogOutIcon, PlusIcon, ShieldIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ReelMark, Wordmark } from "@/components/brand/reel-mark";
import { NameDialog } from "@/components/folders/name-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { toneFor } from "@/lib/tones";
import { createFolder } from "@/server/actions";
import type { FolderSummary } from "@/server/queries";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

const itemClass =
  "h-10 gap-3 rounded-[10px] px-3 text-[14px] text-sidebar-foreground data-active:font-medium [&_svg]:size-[18px]";

export function AppSidebar({
  rootFolders,
  user,
  isAdmin,
}: {
  rootFolders: FolderSummary[];
  user: { name: string; email: string };
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5 pb-2">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ReelMark />
          <Wordmark />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-4 px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/"}
                  className={itemClass}
                  render={<Link href="/" />}
                >
                  <ImageIcon className={pathname === "/" ? "text-primary" : undefined} />
                  <span>Thư viện</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname.startsWith("/admin")}
                    className={itemClass}
                    render={<Link href="/admin/users" />}
                  >
                    <ShieldIcon
                      className={pathname.startsWith("/admin") ? "text-primary" : undefined}
                    />
                    <span>Quản lý user</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Folder
          </SidebarGroupLabel>
          <SidebarGroupAction
            aria-label="Tạo folder"
            className="top-2.5 right-3 size-7 rounded-lg [&>svg]:size-4"
            onClick={() => setCreating(true)}
          >
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {rootFolders.length === 0 && (
                <li className="px-3 py-1.5 text-[13px] text-muted-foreground">Chưa có folder nào</li>
              )}
              {rootFolders.map((f) => (
                <SidebarMenuItem key={f.id}>
                  <SidebarMenuButton
                    isActive={pathname === `/f/${f.id}`}
                    className={`${itemClass} h-9`}
                    render={<Link href={`/f/${f.id}`} />}
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ background: toneFor(f.id).sky }}
                    />
                    <span className="truncate">{f.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left ring-1 ring-sidebar-border transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: toneFor(user.email).sky }}
            >
              {initials(user.name)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {isAdmin ? "Admin" : user.email}
              </span>
            </span>
            <ChevronsUpDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-56">
            <DropdownMenuItem
              onClick={async () => {
                await authClient.signOut();
                router.replace("/login");
                router.refresh();
              }}
            >
              <LogOutIcon />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      {creating && (
        <NameDialog
          open
          onOpenChange={setCreating}
          title="Tạo folder mới"
          submitLabel="Tạo"
          onSubmit={(name) => createFolder(null, name)}
        />
      )}
    </Sidebar>
  );
}
