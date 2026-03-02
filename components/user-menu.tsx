import { auth, signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

export async function UserMenu() {
  const session = await auth();
  if (!session?.user) return null;

  const initials = session.user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full hover:bg-muted p-1 pr-3 transition-colors">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name ?? "User"}
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            {initials}
          </div>
        )}
        <span className="text-sm font-medium hidden sm:inline">
          {session.user.name}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span>{session.user.name}</span>
          <span className="text-xs text-muted-foreground font-normal">
            {session.user.email}
          </span>
          <Badge variant="secondary" className="w-fit text-xs capitalize">
            {session.user.profileType}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <DropdownMenuItem asChild>
            <button className="w-full cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesion
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
