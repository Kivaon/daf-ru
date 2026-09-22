"use client";

import { useEffect, useRef, useState } from "react";

type TextRect = { left: number; top: number; width: number; height: number };
type WordRect = TextRect & { word: string; line: number };
type PdfJsApi = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (source: { data: Uint8Array }) => { promise: Promise<unknown> };
};

function loadPdfJs() {
  const host = window as typeof window & { pdfjsLib?: PdfJsApi };
  if (host.pdfjsLib) return Promise.resolve(host.pdfjsLib);
  return new Promise<PdfJsApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-pdfjs="true"]');
    const script = existing ?? document.createElement("script");
    const ready = () => host.pdfjsLib ? resolve(host.pdfjsLib) : reject(new Error("PDF.js не запустился"));
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", () => reject(new Error("Не удалось загрузить PDF.js")), { once: true });
    if (!existing) {
      script.src = "/pdf.min.js?v=3";
      script.dataset.pdfjs = "true";
      document.head.appendChild(script);
    }
  });
}

const visualWords = [
  ["גמ׳"],
  ["כל"],
  ["משום", "ה״א", "לוקח", "תנא", "דאי", "צריכי", "לי", "למה", "הני"],
  ["דקא", "מוכר", "אבל", "לקדושה", "לה", "מייתי", "דקא"],
  ["קמ״ל", "ליקנסיה", "אימא", "מקדושה", "לה", "מפקע"],
];

export function PdfDafViewer({ zoom, onSelect, onBlockLocated }: { zoom: number; onSelect: (word: string) => void; onBlockLocated: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [size, setSize] = useState({ width: 644, height: 993 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [textRects, setTextRects] = useState<TextRect[]>([]);
  const [wordRects, setWordRects] = useState<WordRect[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function renderPdf() {
      try {
        setStatus("loading");
        setErrorMessage("");
        const [pdfjsApi, response] = await Promise.all([
          loadPdfJs(),
          fetch("/bekhorot-2a.pdf?v=2", { cache: "no-store", credentials: "same-origin" }),
        ]);
        if (!response.ok) throw new Error(`PDF request failed: ${response.status}`);
        pdfjsApi.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js?v=3";
        const pdfData = new Uint8Array(await response.arrayBuffer());
        const pdf = await pdfjsApi.getDocument({ data: pdfData }).promise as {
          getPage: (pageNumber: number) => Promise<{
            getViewport: (options: { scale: number }) => { width: number; height: number; transform: number[] };
            getTextContent: () => Promise<{ items: Array<Record<string, unknown>> }>;
            render: (options: Record<string, unknown>) => { promise: Promise<void>; cancel: () => void };
          }>;
        };
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: zoom });
        const textContent = await page.getTextContent();
        const items = textContent.items.filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number } => "str" in item);
        const start = items.findIndex((item) => item.str === "ÏÎ" && item.transform[4] > 210 && item.transform[4] < 235 && item.transform[5] > 945);
        const targetItems = start > 0 ? items.slice(start - 1, start + 4) : [];
        if (targetItems.length !== 5 || !targetItems[0].str.includes("Ó‚") || !targetItems[2].str.includes("ÈÎÈ¯ˆ") || !targetItems[4].str.includes("Ï\"Ó˜")) {
          throw new Error("Не найден проверенный текстовый блок на листе");
        }
        const [a, b, c, d, e, f] = viewport.transform;
        const toViewport = (x: number, y: number) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
        const locatedWords = targetItems.flatMap((item, line) => {
          const lineStart = toViewport(item.transform[4], item.transform[5]);
          const lineEnd = toViewport(item.transform[4] + item.width, item.transform[5] + item.height);
          const lineLeft = Math.min(lineStart.x, lineEnd.x);
          const lineTop = Math.min(lineStart.y, lineEnd.y);
          const lineWidth = Math.abs(lineEnd.x - lineStart.x);
          const lineHeight = Math.abs(lineEnd.y - lineStart.y);
          return Array.from(item.str.matchAll(/\S+/g)).map((match, wordIndex) => {
            const from = (match.index ?? 0) / item.str.length;
            const portion = match[0].length / item.str.length;
            return {
              left: lineLeft + lineWidth * from,
              top: lineTop + lineHeight * .23,
              width: Math.max(2, lineWidth * portion),
              height: lineHeight * .62,
              word: visualWords[line]?.[wordIndex] ?? "слово",
              line: line < 2 ? 0 : line - 1,
            };
          });
        });
        const locatedLines = Array.from(new Set(locatedWords.map((word) => word.line))).map((line) => {
          const words = locatedWords.filter((word) => word.line === line);
          const left = Math.min(...words.map((word) => word.left));
          const right = Math.max(...words.map((word) => word.left + word.width));
          const top = Math.min(...words.map((word) => word.top));
          const bottom = Math.max(...words.map((word) => word.top + word.height));
          return { left, top, width: right - left, height: bottom - top };
        });
        if (cancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setSize({ width: viewport.width, height: viewport.height });
        setTextRects(locatedLines);
        setWordRects(locatedWords);

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

  return <div className="pdfStage" style={{ width: size.width, height: size.height }}>
    <canvas ref={canvasRef} aria-label="Оригинальный PDF, Бехорот 2а" />
    {status === "loading" && <div className="pdfStatus">Загружаем оригинальный PDF…</div>}
    {status === "error" && <div className="pdfStatus error">Не удалось открыть PDF.<small>{errorMessage}</small><a href="/bekhorot-2a.pdf">Открыть оригинал</a></div>}
    {status === "ready" && <div className="pdfInteraction" aria-label="Интерактивный слой текста Гемары">
      {textRects.map((rect, index) => <button
        key={index}
        className="textHighlight"
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        onClick={() => onSelect("כל")}
        aria-label={index === 0 ? "Выбрать блок: גמ׳ כל הני למה לי" : "Выбрать текущий блок Гемары"}
      />)}
      {wordRects.map((rect, index) => <button key={`word-${index}`} className="wordHit" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} onClick={() => onSelect(rect.word)} aria-label={`Слово ${rect.word}; блок Бехорот 2а:2–3`} />)}
    </div>}
  </div>;
}
