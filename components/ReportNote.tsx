export const REPORT_BANNER_BG =
  "bg-gradient-to-r from-[#1a4f8a] via-[#1e5a9a] to-[#2563b0]";

export const REPORT_TEXT_COLOR = "text-[#1a4f8a]";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function ReportNote({ children, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${REPORT_TEXT_COLOR} ${className}`}
    >
      {children}
    </span>
  );
}
