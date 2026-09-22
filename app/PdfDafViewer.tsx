"use client";

import { useEffect, useRef, useState } from "react";
import { CommentaryLink } from "./bekhorot2aCommentary";

export type DafSegment = { id: string; kind: string; text: string };

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

function alignSefariaToPdf(pdfWords: WordRect[], segments: DafSegment[]) {
  const sourceChars: Array<{ char: string; segment: number }> = [];
  segments.forEach((segment, segmentIndex) => {
    const pageStartsTractate = segmentIndex === 0 && segment.id.startsWith("2a:");
    if (!pageStartsTractate && (segmentIndex === 0 || segmentIndex === segments.length - 1)) return;
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
  const matchedWords = segments.map(() => new Set<number>());
  const exact = segments.map(() => 0);
  const totals = segments.map(() => 0);
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
  const validationExact = exact.filter((_, index) => totals[index] > 0);
  const validationTotals = totals.filter((value) => value > 0);
  const exactCharacters = validationExact.reduce((sum, value) => sum + value, 0);
  const totalCharacters = validationTotals.reduce((sum, value) => sum + value, 0);
  const overallRatio = exactCharacters / totalCharacters;
  if (overallRatio < .84) {
    throw new Error(`Сверка текста Гемары: совпало ${Math.round(overallRatio * 100)}% (${exactCharacters} из ${totalCharacters} букв; требуется 84%). Пограничные реплики страницы не учитывались`);
  }
  const blocks: Record<string, LocatedBlock> = {};
  let previousEnd = -1;
  segments.forEach((segment, segmentIndex) => {
    const matched = [...matchedWords[segmentIndex]].sort((a, b) => a - b);
    const boundarySegment = segmentIndex === 0 || segmentIndex === segments.length - 1;
    if (boundarySegment && totals[segmentIndex] === 0) return;
    const requiredRatio = boundarySegment ? .18 : .70;
    const segmentRatio = exact[segmentIndex] / totals[segmentIndex];
    if (boundarySegment && (!matched.length || segmentRatio < requiredRatio)) return;
    if (!matched.length || segmentRatio < requiredRatio) throw new Error(`Реплика ${segment.id}: совпало ${Math.round(segmentRatio * 100)}% текста, требуется 70%`);
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

function alignDiburimToPdf(pdfWords: WordRect[], comments: CommentaryLink[]) {
  if (!comments.length || !pdfWords.length) return {} as Record<string, LocatedBlock>;
  const sourceChars: Array<{ char: string; comment: number }> = [];
  comments.forEach((comment, commentIndex) => editionWords(comment.dibur).forEach((word) =>
    Array.from(word).forEach((char) => sourceChars.push({ char, comment: commentIndex }))));
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
  const matchedWords = comments.map(() => new Set<number>()), exact = comments.map(() => 0), totals = comments.map(() => 0);
  sourceChars.forEach(({ comment }) => totals[comment]++);
  let i = m, j = end;
  while (i > 0) {
    const direction = path[i * width + j];
    if (direction === 0 && j > 0) {
      const source = sourceChars[i - 1], pdf = pdfChars[j - 1];
      matchedWords[source.comment].add(pdf.word);
      if (source.char === pdf.char) exact[source.comment]++;
      i--; j--;
    } else if (direction === 1 || j === 0) i--;
    else j--;
  }
  const blocks: Record<string, LocatedBlock> = {};
  comments.forEach((comment, index) => {
    const matched = [...matchedWords[index]].sort((a, b) => a - b);
    if (!matched.length || exact[index] / totals[index] < .58) return;
    const words = pdfWords.slice(matched[0], matched.at(-1)! + 1);
    const lines = Array.from(new Set(words.map((word) => word.line))).map((line) => {
      const row = words.filter((word) => word.line === line);
      const left = Math.min(...row.map((word) => word.left)), right = Math.max(...row.map((word) => word.left + word.width));
      const top = Math.min(...row.map((word) => word.top)), bottom = Math.max(...row.map((word) => word.top + word.height));
      const fullHeight = bottom - top;
      return { left, top: top + fullHeight * .48, width: right - left, height: fullHeight * .46 };
    });
    blocks[comment.ref] = { words, lines };
  });
  return blocks;
}

function locateDiburInGemara(words: WordRect[], dibur: string) {
  const source = editionWords(dibur).filter((word) => !["גמ", "מתני"].includes(word));
  const target = words.map((word) => normalizeHebrew(word.word));
  let cursor = 0;
  const matchedIndexes: number[] = [];
  source.forEach((sourceWord) => {
    for (let index = cursor; index < target.length; index++) {
      if (target[index] === sourceWord || target[index].endsWith(sourceWord) || sourceWord.endsWith(target[index])) {
        matchedIndexes.push(index); cursor = index + 1; break;
      }
    }
  });
  if (!matchedIndexes.length || matchedIndexes.length / source.length < .5) return null;
  const locatedWords = words.slice(matchedIndexes[0], matchedIndexes.at(-1)! + 1);
  const lines = Array.from(new Set(locatedWords.map((word) => word.line))).map((line) => {
    const row = locatedWords.filter((word) => word.line === line);
    const left = Math.min(...row.map((word) => word.left)), right = Math.max(...row.map((word) => word.left + word.width));
    const top = Math.min(...row.map((word) => word.top)), bottom = Math.max(...row.map((word) => word.top + word.height));
    const fullHeight = bottom - top;
    return { left, top: top + fullHeight * .48, width: right - left, height: fullHeight * .46 };
  });
  return { words: locatedWords, lines };
}

export function PdfDafViewer({ zoom, selectedBlock, onSelect, onBlockLocated, pdfUrl = "/bekhorot-2a.pdf", label = "Бехорот 2а", segments = [], commentary = [] }: {
  zoom: number; selectedBlock: string; onSelect: (blockId: string, word: string) => void; onBlockLocated: (blockId?: string) => void;
  pdfUrl?: string; label?: string; segments?: DafSegment[]; commentary?: CommentaryLink[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [size, setSize] = useState({ width: 644, height: 993 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [alignmentWarning, setAlignmentWarning] = useState("");
  const [blocks, setBlocks] = useState<Record<string, LocatedBlock>>({});
  const [commentaryBlocks, setCommentaryBlocks] = useState<Record<string, LocatedBlock>>({});
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  const [hoveredComment, setHoveredComment] = useState<string | null>(null);
  const [pinnedComment, setPinnedComment] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function renderPdf() {
      try {
        setStatus("loading"); setErrorMessage(""); setAlignmentWarning("");
        const [pdfjsApi, response] = await Promise.all([loadPdfJs(), fetch(pdfUrl, { cache: "force-cache", credentials: "same-origin" })]);
        if (!response.ok) throw new Error(`PDF request failed: ${response.status}`);
        pdfjsApi.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js?v=3";
        const pdf = await pdfjsApi.getDocument({ data: new Uint8Array(await response.arrayBuffer()) }).promise as {
          getPage: (pageNumber: number) => Promise<{
            getViewport: (options: { scale: number }) => { width: number; height: number; transform: number[] };
            getTextContent: () => Promise<{ items: Array<Record<string, unknown>>; styles: Record<string, { fontFamily?: string }> }>;
            render: (options: Record<string, unknown>) => { promise: Promise<void>; cancel: () => void };
          }>;
        };
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: zoom });
        const textContent = await page.getTextContent();
        const items = textContent.items.filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number; fontName: string } => "str" in item && "fontName" in item);
        const [a, b, c, d, e, f] = viewport.transform;
        const toViewport = (x: number, y: number) => ({ x: a * x + c * y + e, y: b * x + d * y + f });
        const makeWords = (filter: (item: typeof items[number]) => boolean) => items
          .filter(filter)
          .flatMap((item) => {
            const p1 = toViewport(item.transform[4], item.transform[5]);
            const p2 = toViewport(item.transform[4] + item.width, item.transform[5] + item.height);
            const left = Math.min(p1.x, p2.x), top = Math.min(p1.y, p2.y), width = Math.abs(p2.x - p1.x), height = Math.abs(p2.y - p1.y);
            return Array.from(item.str.matchAll(/\S+/g)).map((match) => ({
              left: left + width * ((match.index ?? 0) / item.str.length), top,
              width: Math.max(2, width * (match[0].length / item.str.length)), height,
              word: decodeWord(match[0]), line: Math.round(item.transform[5] / 5),
            }));
          })
          .filter((word) => normalizeHebrew(word.word))
          .sort((first, second) => second.line - first.line || second.left - first.left);
        // The Vilna Gemara column is not rectangular: it widens and narrows around
        // Rashi and Tosafot. Identify its typeface first, then retain its real geometry.
        const gemaraFontScores = new Map<string, number>();
        items.forEach((item) => {
          if (item.transform[5] <= 120 || item.transform[5] >= 1080 || item.height < 11.5) return;
          const hebrewLength = normalizeHebrew(decodeWord(item.str)).length;
          if (hebrewLength) gemaraFontScores.set(item.fontName, (gemaraFontScores.get(item.fontName) ?? 0) + hebrewLength);
        });
        const gemaraFont = [...gemaraFontScores].sort((first, second) => second[1] - first[1])[0]?.[0];
        if (!gemaraFont) throw new Error("PDF не содержит распознаваемого слоя текста Гемары");
        const pdfWords = makeWords((item) => item.fontName === gemaraFont && item.transform[5] > 120 && item.transform[5] < 1080);
        const rashiWords = makeWords((item) => item.transform[4] > 400 && item.transform[5] > 120 && item.transform[5] < 1080);
        const tosafotWords = makeWords((item) => item.transform[4] < 212 && item.transform[5] > 120 && item.transform[5] < 1080);
        let locatedBlocks: Record<string, LocatedBlock> = {}, locatedCommentary: Record<string, LocatedBlock> = {}, mappingError = "";
        try {
          locatedBlocks = alignSefariaToPdf(pdfWords, segments);
          locatedCommentary = {
            ...alignDiburimToPdf(rashiWords, commentary.filter((comment) => comment.commentator === "Rashi")),
            ...alignDiburimToPdf(tosafotWords, commentary.filter((comment) => comment.commentator === "Tosafot")),
          };
        } catch (reason) {
          mappingError = reason instanceof Error ? reason.message : String(reason);
        }
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio); canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
        setSize({ width: viewport.width, height: viewport.height }); setBlocks(locatedBlocks); setCommentaryBlocks(locatedCommentary);
        renderTaskRef.current?.cancel();
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas unavailable");
        const task = page.render({ canvas, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
        renderTaskRef.current = task; await task.promise;
        if (!cancelled) { setStatus("ready"); setAlignmentWarning(mappingError); if (!mappingError) onBlockLocated(locatedBlocks[selectedBlock] ? selectedBlock : Object.keys(locatedBlocks)[0]); }
      } catch (error) {
        if (!cancelled && (error as { name?: string }).name !== "RenderingCancelledException") {
          console.error("PDF rendering failed", error); setErrorMessage(error instanceof Error ? error.message : String(error)); setStatus("error");
        }
      }
    }
    renderPdf();
    return () => { cancelled = true; renderTaskRef.current?.cancel(); };
  }, [zoom, onBlockLocated, pdfUrl, segments, commentary]);

  const selected = blocks[selectedBlock];
  const preview = hoveredBlock && hoveredBlock !== selectedBlock ? blocks[hoveredBlock] : null;
  const linkedComments = commentary.filter((comment) => comment.base === selectedBlock);
  const activeComment = hoveredComment ?? pinnedComment;
  const activeCommentary = linkedComments.find((comment) => comment.ref === activeComment);
  const gemaraCue = activeCommentary && selected ? locateDiburInGemara(selected.words, activeCommentary.dibur) : null;
  return <div className="pdfStage" style={{ width: size.width, height: size.height }}>
    <canvas ref={canvasRef} aria-label={`Оригинальный PDF, ${label}`} />
    {status === "loading" && <div className="pdfStatus">Загружаем оригинальный PDF…</div>}
    {status === "error" && <div className="pdfStatus error">Не удалось связать лист с текстом.<small>{errorMessage}</small><a href={pdfUrl}>Открыть оригинал</a></div>}
    {status === "ready" && alignmentWarning && <div className="alignmentWarning">Лист открыт, интерактивная разметка отключена: {alignmentWarning}</div>}
    {status === "ready" && <div className="pdfInteraction" aria-label="Интерактивный слой оригинального листа" data-active-comment={activeComment ?? ""} data-gemara-cue={gemaraCue ? "yes" : "no"}>
      {selected?.lines.map((rect, index) => <span key={`selected-${index}`} className="textHighlight selectedHighlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />)}
      {preview?.lines.map((rect, index) => <span key={`preview-${index}`} className="textHighlight hoverHighlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />)}
      {linkedComments.flatMap((comment) => (commentaryBlocks[comment.ref]?.lines ?? []).map((rect, index) => <span key={`${comment.ref}-${index}`} className={`textHighlight commentaryHighlight ${comment.commentator === "Rashi" ? "rashiPdfHighlight" : "tosafotPdfHighlight"}`} style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />))}
      {gemaraCue?.lines.map((rect, index) => <span key={`gemara-cue-${index}`} className="textHighlight gemaraCueHighlight" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />)}
      {linkedComments.flatMap((comment) => (commentaryBlocks[comment.ref]?.words ?? []).map((rect, index) => <button key={`comment-hit-${comment.ref}-${index}`} className="commentaryHit" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} onPointerEnter={() => setHoveredComment(comment.ref)} onPointerLeave={() => setHoveredComment(null)} onFocus={() => setHoveredComment(comment.ref)} onBlur={() => setHoveredComment(null)} onClick={() => setPinnedComment((current) => current === comment.ref ? null : comment.ref)} aria-label={`${comment.commentator === "Rashi" ? "Раши" : "Тосафот"}: ${comment.dibur}; показать место в Гемаре`} />))}
      {Object.entries(blocks).flatMap(([blockId, block]) => block.words.map((rect, index) => <button key={`${blockId}-${index}`} className="wordHit" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} onPointerEnter={() => setHoveredBlock(blockId)} onPointerLeave={() => setHoveredBlock(null)} onFocus={() => setHoveredBlock(blockId)} onBlur={() => setHoveredBlock(null)} onClick={() => blockId !== selectedBlock && onSelect(blockId, rect.word)} aria-label={`Слово ${rect.word}; реплика ${label} ${blockId}`} />))}
    </div>}
  </div>;
}
