import InvoiceViewerView from "@/features/order/components/InvoiceViewerView";

export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <InvoiceViewerView orderId={orderId} />;
}
