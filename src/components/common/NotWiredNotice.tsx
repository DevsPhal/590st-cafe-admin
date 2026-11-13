import { PlugZap } from "lucide-react";

//notice for not wired feature
export function NotWiredNotice({
  feature,
  detail,
}: {
  feature: string;
  detail?: string;
}) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <PlugZap className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm">
        <p className="font-semibold">
          {feature} is not wired to the API — the data below is placeholder.
        </p>
        <p className="mt-1 text-amber-800">
          {detail ??
            `The Coffee-Shop-API exposes no ${feature.toLowerCase()} endpoints, so there is nothing to read or write yet. This screen becomes live once the backend grows them.`}
        </p>
      </div>
    </div>
  );
}
