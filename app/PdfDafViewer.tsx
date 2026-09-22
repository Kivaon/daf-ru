"use client";

import { useEffect, useRef, useState } from "react";

type TextRect = { left: number; top: number; width: number; height: number };
type WordRect = TextRect & { word: string; line: number };
type LocatedBlock = { lines: TextRect[]; words: WordRect[] };
type PdfJsApi = { GlobalWorkerOptions: { workerSrc: string }; getDocument: (source: { data: Uint8Array }) => { promise: Promise<unknown> } };

function loadPdfJs() {
  const host = window as typeof window & { pdfjsLib?: PdfJsApi };
  if (host.pdfjsLib) return Promise.resolve(host.pdfjsLib);
  return new Promise<PdfJsApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-pdfjs="true"]');
    const script = existing ?? document.createElement("script");
    const ready = () => host.pdfjsLib ? resolve(host.pdfjsLib) : reject(new Error("PDF.js не запустился"));
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", () => reject(new Error("Не удалось загрузить PDF.js")), { once: true });
    if (!existing) { script.src = "/pdf.min.js?v=3"; script.dataset.pdfjs = "true"; document.head.appendChild(script); }
  });
}

const glyphs: Record<string, string> = {
  "‡":"א", "·":"ב", "‚":"ג", "„":"ד", "‰":"ה", "Â":"ו", "Ê":"ז", "Á":"ח", "Ë":"ט", "È":"י",
  "Î":"כ", "Í":"ך", "Ï":"ל", "Ó":"מ", "Ì":"ם", "\u0014":"נ", "Ô":"ן", "Ò":"ס", "Ú":"ע", "Ù":"פ",
  "Û":"ף", "ˆ":"צ", "ı":"ץ", "˜":"ק", "¯":"ר", "˘":"ש", "˙":"ת",
};
const decodeWord = (raw: string) => Array.from(raw).map((char) => glyphs[char] ?? char).reverse().join("").replace("'", "׳");

export function PdfDafViewer({ zoom, selectedBlock, onSelect, onBlockLocated }: {
  zoom: number; selectedBlock: string; onSelect: (blockId: string, word: string) => void; onBlockLocated: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [size, setSize] = useState({ width: 644, height: 993 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [blocks, setBlocks] = useState<Record<string, LocatedBlock>>({});
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function renderPdf() {
      try {
        setStatus("loading"); setErrorMessage("");
        const [pdfjsApi, response] = await Promise.all([loadPdfJs(), fetch("/bekhorot-2a.pdf?v=2", { cache: "no-store", credentials: "same-origin" })]);
        if (!response.ok) throw new Error(`PDF request failed: ${response.status}`);
        pdfjsApi.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js?v=3";
        const pdf = await pdfjsApi.getDocument({ data: new Uint8Array(await response.arrayBuffer()) }).promise as {
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
        if (start < 1) throw new Error("Не найден проверенный текстовый блок на листе");
        const [a, b, c, d, e, f] = viewport.transform;
        const toViewport = (x: number, y: number) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
        const locate = (parts: Array<{ item: typeof items[number]; take?: number[] }>): LocatedBlock => {
          const baselines: number[] = [];
          const words = parts.flatMap(({ item, take }) => {
            let line = baselines.findIndex((baseline) => Math.abs(baseline - item.transform[5]) < 2);
            if (line < 0) { baselines.push(item.transform[5]); line = baselines.length - 1; }
            const p1 = toViewport(item.transform[4], item.transform[5]);
            const p2 = toViewport(item.transform[4] + item.width, item.transform[5] + item.height);
            const left = Math.min(p1.x, p2.x), top = Math.min(p1.y, p2.y), width = Math.abs(p2.x - p1.x), height = Math.abs(p2.y - p1.y);
            return Array.from(item.str.matchAll(/\S+/g)).flatMap((match, wordIndex) => !take || take.includes(wordIndex) ? [{
              left: left + width * ((match.index ?? 0) / item.str.length), top,
              width: Math.max(2, width * (match[0].length / item.str.length)), height,
              word: decodeWord(match[0]), line,
            }] : []);
          });
          const lines = Array.from(new Set(words.map((word) => word.line))).map((line) => {
            const row = words.filter((word) => word.line === line);
            const left = Math.min(...row.map((word) => word.left)), right = Math.max(...row.map((word) => word.left + word.width));
            const top = Math.min(...row.map((word) => word.top)), bottom = Math.max(...row.map((word) => word.top + word.height));
            const fullHeight = bottom - top;
            return { left, top: top + fullHeight * .48, width: right - left, height: fullHeight * .46 };
          });
          return { lines, words };
        };
        const part = (offset: number, take?: number[]) => ({ item: items[start + offset], take });
        const mishnahParts = items
          .filter((item) => item.transform[4] >= 218 && item.transform[4] <= 395 && item.transform[5] < 1080 && (
            item.transform[5] > 965 || (item.transform[5] > 945 && item.transform[4] >= 250)
          ))
          .map((item) => ({ item }));
        const locatedBlocks = {
          "2a:1": locate(mishnahParts),
          "2a:2": locate([part(-1), part(0), part(1, [6, 7, 8])]),
          "2a:3": locate([part(1, [0, 1, 2, 3, 4, 5]), part(2), part(3)]),
          "2a:4": locate([6, 8, 10, 12, 13].map((offset) => part(offset))),
          "2a:5": locate([part(14), part(15, [6, 7])]),
          "2a:6": locate([part(15, [0, 1, 2, 3, 4, 5]), part(16), part(17), part(18)]),
          "2a:7": locate([part(20), part(21)]),
          "2a:8": locate([part(23), part(24), part(25), part(26), part(27, [1, 2, 3, 4, 5, 6, 7])]),
          "2a:9": locate([part(27, [0]), part(28)]),
          "2a:10": locate([part(29), part(30)]),
          "2a:11": locate([part(31), part(32, [5, 6])]),
          "2a:12": locate([part(32, [0, 1, 2, 3, 4]), part(33), part(34), part(35), part(37), part(38)]),
        };
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
        setSize({ width: viewport.width, height: viewport.height }); setBlocks(locatedBlocks);
        renderTaskRef.current?.cancel();
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas unavailable");
        const task = page.render({ canvas, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        renderTaskRef.current = task; await task.promise;
        if (!cancelled) { setStatus("ready"); onBlockLocated(); }
      } catch (error) {
        if (!cancelled && (error as { name?: string }).name !== "RenderingCancelledException") {
          console.error("PDF rendering failed", error); setErrorMessage(error instanceof Error ? error.message : String(error)); setStatus("error");
        }
      }
    }
    renderPdf();
    return () => { cancelled = true; renderTaskRef.current?.cancel(); };
  }, [zoom, onBlockLocated]);

  const selected = blocks[selectedBlock];
  const preview = hoveredBlock && hoveredBlock !== selectedBlock ? blocks[hoveredBlock] : null;
  return <div className="pdfStage" style={{ width: size.width, height: size.height }}>
    <canvas ref={canvasRef} aria-label="Оригинальный PDF, Бехорот 2а" />
    {status === "loading" && <div className="pdfStatus">Загружаем оригинальный PDF…</div>}
    {status === "error" && <div className="pdfStatus error">Не удалось открыть PDF.<small>{errorMessage}</small><a href="/bekhorot-2a.pdf">Открыть оригинал</a></div>}
    {status === "ready" && <div className="pdfInteraction" aria-label="Интерактивный слой текста Гемары">
      {selected?.lines.map((rect, index) => <span key={`selected-${index}`} className="textHighlight selectedHighlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />)}
      {preview?.lines.map((rect, index) => <span key={`preview-${index}`} className="textHighlight hoverHighlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />)}
      {Object.entries(blocks).flatMap(([blockId, block]) => block.words.map((rect, index) => <button key={`${blockId}-${index}`} className="wordHit" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} onPointerEnter={() => setHoveredBlock(blockId)} onPointerLeave={() => setHoveredBlock(null)} onFocus={() => setHoveredBlock(blockId)} onBlur={() => setHoveredBlock(null)} onClick={() => blockId !== selectedBlock && onSelect(blockId, rect.word)} aria-label={`Слово ${rect.word}; реплика Бехорот ${blockId}`} />))}
    </div>}
  </div>;
}
