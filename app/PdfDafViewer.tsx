"use client";

import { useEffect, useRef, useState } from "react";
import { BEKHOROT_2A_SEGMENTS } from "./bekhorot2a";

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
const normalizeHebrew = (text: string) => text.normalize("NFD").replace(/[\u0591-\u05C7]/g, "").replace(/[^\u05D0-\u05EA]/g, "");

function editionWords(text: string) {
  return text.split(/\s+/).flatMap((word) => {
    const normalized = normalizeHebrew(word);
    if (normalized === "נכרי" || normalized === "גוי") return ["עובד", "כוכבים"];
    if (normalized === "הגוי") return ["העובד", "כוכבים"];
    return normalized ? [normalized] : [];
  });
}

function alignSefariaToPdf(pdfWords: WordRect[]) {
  const sourceChars: Array<{ char: string; segment: number }> = [];
  BEKHOROT_2A_SEGMENTS.forEach((segment, segmentIndex) => {
    editionWords(segment.text).forEach((word) => Array.from(word).forEach((char) => sourceChars.push({ char, segment: segmentIndex })));
  });
  const pdfChars: Array<{ char: string; word: number }> = [];
  pdfWords.forEach((word, wordIndex) => Array.from(normalizeHebrew(word.word)).forEach((char) => pdfChars.push({ char, word: wordIndex })));
  const m = sourceChars.length, n = pdfChars.length, width = n + 1;
  const costs = new Uint16Array((m + 1) * width);
  const path = new Uint8Array((m + 1) * width);
  for (let i = 1; i <= m; i++) { costs[i * width] = i; path[i * width] = 1; }
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const index = i * width + j;
    const diagonal = costs[(i - 1) * width + j - 1] + (sourceChars[i - 1].char === pdfChars[j - 1].char ? 0 : 2);
    const deletion = costs[(i - 1) * width + j] + 1;
    const insertion = costs[index - 1] + 1;
    if (diagonal <= deletion && diagonal <= insertion) { costs[index] = diagonal; path[index] = 0; }
    else if (deletion <= insertion) { costs[index] = deletion; path[index] = 1; }
    else { costs[index] = insertion; path[index] = 2; }
  }
  let end = 0;
  for (let j = 1; j <= n; j++) if (costs[m * width + j] < costs[m * width + end]) end = j;
  const matchedWords = BEKHOROT_2A_SEGMENTS.map(() => new Set<number>());
  const exact = BEKHOROT_2A_SEGMENTS.map(() => 0);
  const totals = BEKHOROT_2A_SEGMENTS.map(() => 0);
  sourceChars.forEach(({ segment }) => totals[segment]++);
  let i = m, j = end;
  while (i > 0) {
    const direction = path[i * width + j];
    if (direction === 0 && j > 0) {
      const source = sourceChars[i - 1], pdf = pdfChars[j - 1];
      matchedWords[source.segment].add(pdf.word);
      if (source.char === pdf.char) exact[source.segment]++;
      i--; j--;
    } else if (direction === 1 || j === 0) i--;
    else j--;
  }
  if (exact.reduce((sum, value) => sum + value, 0) / totals.reduce((sum, value) => sum + value, 0) < .84) {
    throw new Error("Текст листа не прошёл общую сверку с Sefaria");
  }
  const blocks: Record<string, LocatedBlock> = {};
  let previousEnd = -1;
  BEKHOROT_2A_SEGMENTS.forEach((segment, segmentIndex) => {
    const matched = [...matchedWords[segmentIndex]].sort((a, b) => a - b);
    if (!matched.length || exact[segmentIndex] / totals[segmentIndex] < .70) throw new Error(`Реплика Sefaria ${segment.id} не прошла проверку`);
    const first = matched[0], last = matched.at(-1)!;
    if (first <= previousEnd) throw new Error(`Пересечение реплик Sefaria у ${segment.id}`);
    previousEnd = last;
    const words = pdfWords.slice(first, last + 1);
    const lines = Array.from(new Set(words.map((word) => word.line))).map((line) => {
      const row = words.filter((word) => word.line === line);
      const left = Math.min(...row.map((word) => word.left)), right = Math.max(...row.map((word) => word.left + word.width));
      const top = Math.min(...row.map((word) => word.top)), bottom = Math.max(...row.map((word) => word.top + word.height));
      const fullHeight = bottom - top;
      return { left, top: top + fullHeight * .48, width: right - left, height: fullHeight * .46 };
    });
    blocks[segment.id] = { words, lines };
  });
  return blocks;
}

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
        const [a, b, c, d, e, f] = viewport.transform;
        const toViewport = (x: number, y: number) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
        const pdfWords = items
          .filter((item) => item.transform[4] >= 218 && item.transform[4] <= 395 && item.transform[5] > 600 && item.transform[5] < 1080)
          .flatMap((item) => {
            const p1 = toViewport(item.transform[4], item.transform[5]);
            const p2 = toViewport(item.transform[4] + item.width, item.transform[5] + item.height);
            const left = Math.min(p1.x, p2.x), top = Math.min(p1.y, p2.y), width = Math.abs(p2.x - p1.x), height = Math.abs(p2.y - p1.y);
            return Array.from(item.str.matchAll(/\S+/g)).map((match) => ({
              left: left + width * ((match.index ?? 0) / item.str.length), top,
              width: Math.max(2, width * (match[0].length / item.str.length)), height,
              word: decodeWord(match[0]), line: Math.round(item.transform[5] / 2),
            }));
          })
          .filter((word) => normalizeHebrew(word.word))
          .sort((first, second) => second.line - first.line || second.left - first.left);
        const locatedBlocks = alignSefariaToPdf(pdfWords);
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
