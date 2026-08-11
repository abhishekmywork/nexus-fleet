import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Application shell — fixed sidebar, sticky header, dynamic main area
 * and footer. All routes rendered through the (dashboard) group inherit
 * this structure.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <TooltipProvider delayDuration={0}>
        <div className="flex min-h-screen w-full">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            <Footer />
          </div>
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
