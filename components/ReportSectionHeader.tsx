import { LucideIcon } from "lucide-react";
import { REPORT_BANNER_BG } from "@/components/ReportNote";

interface Props {
  title: string;
  icon?: LucideIcon;
}

export default function ReportSectionHeader({ title, icon: Icon }: Props) {
  return (
    <div
      className={`${REPORT_BANNER_BG} rounded-t-xl px-4 py-2.5 flex items-center justify-center gap-2`}
    >
      {Icon && <Icon size={16} className="text-white shrink-0" strokeWidth={2} />}
      <h2 className="text-sm font-semibold text-white text-center">{title}</h2>
    </div>
  );
}
