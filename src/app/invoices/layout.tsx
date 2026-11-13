import { AuthGuard } from "@/components/layout/AuthGuard";

// Same sign-in and role check as the dashboard, without the sidebar: the invoice fills the tab.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
