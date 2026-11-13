import { AdminLayoutShell } from "@/components/layout/AdminLayoutShell";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { LoginWelcome } from "@/components/common/WelcomeToast";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <LoginWelcome />
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </AuthGuard>
  );
}
