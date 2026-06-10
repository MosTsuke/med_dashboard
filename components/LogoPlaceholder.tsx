"use client";

import { useEffect, useState } from "react";

interface Props {
  src?: string;
  size?: number;
}

export default function LogoPlaceholder({ src, size = 64 }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        className="rounded-full object-cover shrink-0 border-2 border-gray-200"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="rounded-full border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="text-xs font-medium text-gray-400">Logo</span>
    </div>
  );
}
