import { AdminLayoutShell } from "@/components/layout/AdminLayoutShell";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { LoginWelcome } from "@/components/common/WelcomeToast";
import { InvoicePrintDialog } from "@/components/common/InvoicePrintDialog";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <LoginWelcome />
      <AdminLayoutShell>{children}</AdminLayoutShell>
      <InvoicePrintDialog />
    </AuthGuard>
  );
}
