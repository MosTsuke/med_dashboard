const EXPORT_MIN_WIDTH = 1280;

function buildFilename(hospitalName?: string, period?: { from: string; to: string }) {
  const hospital = hospitalName?.replace(/\s+/g, "-") || "รายงาน";
  const range = period ? `_${period.from}-${period.to}` : "";
  const date = new Date().toISOString().slice(0, 10);
  return `${hospital}${range}_${date}.pdf`;
}

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function addCanvasToPdf(
  pdf: import("jspdf").jsPDF,
  canvas: HTMLCanvasElement,
  margin: number
) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  const imgW_mm = contentW;
  const imgH_mm = (canvas.height * imgW_mm) / canvas.width;

  if (imgH_mm <= contentH) {
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      margin,
      margin,
      imgW_mm,
      imgH_mm
    );
    return;
  }

  const pageHeightPx = Math.floor((contentH / imgH_mm) * canvas.height);
  let srcY = 0;
  let pageIndex = 0;

  while (srcY < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - srcY);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext("2d");
    if (!ctx) break;

    ctx.drawImage(
      canvas,
      0,
      srcY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    const sliceHmm = (sliceHeight / canvas.height) * imgH_mm;

    if (pageIndex > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      slice.toDataURL("image/png"),
      "PNG",
      margin,
      margin,
      imgW_mm,
      sliceHmm
    );

    srcY += sliceHeight;
    pageIndex += 1;
  }
}

export async function exportReportPdf(
  element: HTMLElement,
  options?: { hospitalName?: string; period?: { from: string; to: string } }
) {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  await document.fonts.ready;

  const captureWidth = Math.max(
    element.scrollWidth,
    element.offsetWidth,
    Math.ceil(element.getBoundingClientRect().width),
    EXPORT_MIN_WIDTH
  );

  const prev = {
    width: element.style.width,
    minWidth: element.style.minWidth,
    maxWidth: element.style.maxWidth,
  };

  element.classList.add("pdf-export-layout");
  element.style.width = `${captureWidth}px`;
  element.style.minWidth = `${captureWidth}px`;
  element.style.maxWidth = `${captureWidth}px`;

  await waitForPaint();
  await new Promise((r) => setTimeout(r, 350));

  try {
    const captureHeight = element.scrollHeight;

    const canvas = await html2canvas(element, {
      scale: 2,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      foreignObjectRendering: false,
      onclone: (doc) => {
        const cloned = doc.querySelector(
          "[data-report-export]"
        ) as HTMLElement | null;
        if (!cloned) return;
        cloned.style.width = `${captureWidth}px`;
        cloned.style.minWidth = `${captureWidth}px`;
        cloned.style.maxWidth = `${captureWidth}px`;
      },
    });

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    addCanvasToPdf(pdf, canvas, 8);
    pdf.save(buildFilename(options?.hospitalName, options?.period));
  } finally {
    element.classList.remove("pdf-export-layout");
    element.style.width = prev.width;
    element.style.minWidth = prev.minWidth;
    element.style.maxWidth = prev.maxWidth;
  }
}
