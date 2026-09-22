"use client";

import { useEffect, useRef, useState } from "react";

const highlightLines = [
  { left: 25.7, top: 19.35, width: 3.5, height: 1.55 },
  { left: 25.7, top: 20.62, width: 27.9, height: 1.55 },
  { left: 25.7, top: 21.9, width: 27.9, height: 1.55 },
  { left: 25.7, top: 23.18, width: 27.9, height: 1.55 },
];

export function PdfDafViewer({ zoom, onSelect }: { zoom: number; onSelect: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [size, setSize] = useState({ width: 644, height: 993 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderPdf() {
      try {
        setStatus("loading");
        setErrorMessage("");
        const [pdfjs, response] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.mjs"),
          fetch("/bekhorot-2a.pdf?v=2", { cache: "no-store", credentials: "same-origin" }),
        ]);
        if (!response.ok) throw new Error(`PDF request failed: ${response.status}`);
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs?v=2";
        const pdfData = new Uint8Array(await response.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: zoom });
        if (cancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setSize({ width: viewport.width, height: viewport.height });

        renderTaskRef.current?.cancel();
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas unavailable");
        const task = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        renderTaskRef.current = task;
        await task.promise;
        if (!cancelled) setStatus("ready");
      } catch (error) {
        if (!cancelled && (error as { name?: string }).name !== "RenderingCancelledException") {
          console.error("PDF rendering failed", error);
          setErrorMessage(error instanceof Error ? error.message : String(error));
          setStatus("error");
        }
      }
    }

    renderPdf();
    return () => { cancelled = true; renderTaskRef.current?.cancel(); };
  }, [zoom]);

  return <div className="pdfStage" style={{ width: size.width, height: size.height }}>
    <canvas ref={canvasRef} aria-label="Оригинальный PDF, Бехорот 2а" />
    {status === "loading" && <div className="pdfStatus">Загружаем оригинальный PDF…</div>}
    {status === "error" && <div className="pdfStatus error">Не удалось открыть PDF.<small>{errorMessage}</small><a href="/bekhorot-2a.pdf">Открыть оригинал</a></div>}
    {status === "ready" && <div className="pdfInteraction" aria-label="Интерактивный слой текста Гемары">
      {highlightLines.map((line, index) => <button
        key={index}
        className="textHighlight"
        style={{ left: `${line.left}%`, top: `${line.top}%`, width: `${line.width}%`, height: `${line.height}%` }}
        onClick={onSelect}
        aria-label={index === 0 ? "Выбрать блок: כל הני למה לי" : "Выбрать текущий блок Гемары"}
      />)}
      <button className="pdfLocation" style={{ left: "23.8%", top: "20.45%" }} onClick={onSelect} aria-label="Текущее место на листе"><i /><span>Мы здесь</span></button>
    </div>}
  </div>;
}
