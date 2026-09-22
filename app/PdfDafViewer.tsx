"use client";

import { useEffect, useRef, useState } from "react";

type TextRect = { left: number; top: number; width: number; height: number };

export function PdfDafViewer({ zoom, onSelect, onBlockLocated }: { zoom: number; onSelect: () => void; onBlockLocated: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [size, setSize] = useState({ width: 644, height: 993 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [textRects, setTextRects] = useState<TextRect[]>([]);

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
        const textContent = await page.getTextContent();
        const items = textContent.items.filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number } => "str" in item);
        const start = items.findIndex((item) => item.str === "ÏÎ" && item.transform[4] > 210 && item.transform[4] < 235 && item.transform[5] > 945);
        const targetItems = start >= 0 ? items.slice(start, start + 4) : [];
        if (targetItems.length !== 4 || !targetItems[1].str.includes("ÈÎÈ¯ˆ") || !targetItems[3].str.includes("Ï\"Ó˜")) {
          throw new Error("Не найден проверенный текстовый блок на листе");
        }
        const [a, b, c, d, e, f] = viewport.transform;
        const toViewport = (x: number, y: number) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
        const locatedRects = targetItems.map((item) => {
          const first = toViewport(item.transform[4], item.transform[5]);
          const second = toViewport(item.transform[4] + item.width, item.transform[5] + item.height);
          return {
            left: Math.min(first.x, second.x) - 1,
            top: Math.min(first.y, second.y) - 1,
            width: Math.abs(second.x - first.x) + 2,
            height: Math.abs(second.y - first.y) + 2,
          };
        });
        if (cancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setSize({ width: viewport.width, height: viewport.height });
        setTextRects(locatedRects);

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
        if (!cancelled) {
          setStatus("ready");
          onBlockLocated();
        }
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
  }, [zoom, onBlockLocated]);

  const marker = textRects.length ? {
    left: Math.min(...textRects.map((rect) => rect.left)) - 13,
    top: Math.min(...textRects.map((rect) => rect.top)) + 2,
  } : null;

  return <div className="pdfStage" style={{ width: size.width, height: size.height }}>
    <canvas ref={canvasRef} aria-label="Оригинальный PDF, Бехорот 2а" />
    {status === "loading" && <div className="pdfStatus">Загружаем оригинальный PDF…</div>}
    {status === "error" && <div className="pdfStatus error">Не удалось открыть PDF.<small>{errorMessage}</small><a href="/bekhorot-2a.pdf">Открыть оригинал</a></div>}
    {status === "ready" && <div className="pdfInteraction" aria-label="Интерактивный слой текста Гемары">
      {textRects.map((rect, index) => <button
        key={index}
        className="textHighlight"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        onClick={onSelect}
        aria-label={index === 0 ? "Выбрать блок: כל הני למה לי" : "Выбрать текущий блок Гемары"}
      />)}
      {marker && <button className="pdfLocation" style={marker} onClick={onSelect} aria-label="Текущее место на листе"><i /></button>}
    </div>}
  </div>;
}
