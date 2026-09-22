"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PdfDafViewer, DafSegment } from "./PdfDafViewer";
import { CommentaryLink } from "./bekhorot2aCommentary";
import { TRACTATES, tractateBySefaria } from "./talmudCatalog";

const POSITION_KEY = "daf-ru-last-page";
const clean = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
const dibur = (value: string) => (clean(value).split(/\s[-–—]\s/)[0] || clean(value)).replace(/:$/, "").trim();

export default function HomeClient() {
  const [tractateTitle, setTractateTitle] = useState("Bekhorot");
  const [daf, setDaf] = useState(2);
  const [side, setSide] = useState<"a" | "b">("a");
  const [restored, setRestored] = useState(false);
  const [segments, setSegments] = useState<DafSegment[]>([]);
  const [comments, setComments] = useState<CommentaryLink[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [selectedBlock, setSelectedBlock] = useState("2a:3");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [blockLocated, setBlockLocated] = useState(false);
  const [zoom, setZoom] = useState(1.5);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [picked, setPicked] = useState<{ text:string; x:number; y:number } | null>(null);

  const tractate = useMemo(() => tractateBySefaria(tractateTitle), [tractateTitle]);
  const pageKey = `${daf}${side}`;
  const label = `${tractate.ru} ${daf}${side === "a" ? "а" : "б"}`;
  const pdfUrl = `/api/daf-pdf?masechta=${tractate.shas}&daf=${daf}&amud=${side}`;
  const isFirst = daf === 2 && side === "a";
  const isLast = daf === tractate.lastDaf && side === tractate.lastSide;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
      if (saved && TRACTATES.some((item) => item.sefaria === saved.tractate)) {
        const item = tractateBySefaria(saved.tractate);
        if (Number.isInteger(saved.daf) && saved.daf >= 2 && saved.daf <= item.lastDaf && (saved.side === "a" || saved.side === "b")) {
          setTractateTitle(saved.tractate); setDaf(saved.daf); setSide(saved.daf === item.lastDaf && item.lastSide === "a" ? "a" : saved.side);
        }
      }
      setWords(JSON.parse(localStorage.getItem("havruta-dictionary") || "[]"));
    } catch { /* ignore invalid local state */ }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    localStorage.setItem(POSITION_KEY, JSON.stringify({ tractate:tractateTitle, daf, side, savedAt:new Date().toISOString() }));
  }, [restored, tractateTitle, daf, side]);

  useEffect(() => {
    if (!restored) return;
    const controller = new AbortController();
    (async () => {
      setStatus("loading"); setError(""); setBlockLocated(false); setComments([]); setSelectedWord(null);
      try {
        const ref = `${tractate.sefaria}.${pageKey}`;
        const [textResponse, linksResponse] = await Promise.all([
          fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}/he/Wikisource_Talmud_Bavli?context=0&commentary=0`, { signal:controller.signal }),
          fetch(`https://www.sefaria.org/api/links/${encodeURIComponent(ref)}?with_text=1`, { signal:controller.signal }),
        ]);
        if (!textResponse.ok) throw new Error("Sefaria не вернула текст листа");
        const data = await textResponse.json() as { he?:string[] };
        const nextSegments = (data.he || []).map((text, index) => ({ id:`${pageKey}:${index + 1}`, kind:/^(מתני|מַתְנִי)/.test(clean(text)) ? "Мишна" : "Гемара", text:clean(text) })).filter((item) => item.text);
        if (!nextSegments.length) throw new Error("В Sefaria не найдены реплики листа");
        let nextComments: CommentaryLink[] = [];
        if (linksResponse.ok) {
          const links = await linksResponse.json() as Array<Record<string, unknown>>;
          nextComments = links.flatMap((link) => {
            const commentator = (link.collectiveTitle as { en?:string } | undefined)?.en;
            const match = String(link.anchorRef || "").match(/(\d+[ab]):(\d+)/i);
            const text = clean(String(link.he || ""));
            if ((commentator !== "Rashi" && commentator !== "Tosafot") || !match || !text) return [];
            return [{ base:`${match[1]}:${match[2]}`, commentator, ref:String(link.ref || link.sourceRef || ""), text, dibur:dibur(String(link.he || "")) } as CommentaryLink];
          });
        }
        if (controller.signal.aborted) return;
        setSegments(nextSegments); setComments(nextComments);
        const preferred = tractate.sefaria === "Bekhorot" && pageKey === "2a" ? "2a:3" : nextSegments[0].id;
        setSelectedBlock(nextSegments.some((item) => item.id === preferred) ? preferred : nextSegments[0].id);
        setStatus("ready");
      } catch (reason) {
        if (!controller.signal.aborted) { setStatus("error"); setError(reason instanceof Error ? reason.message : String(reason)); }
      }
    })();
    return () => controller.abort();
  }, [restored, tractate, pageKey]);

  const move = (direction:-1|1) => {
    if (direction < 0) { if (isFirst) return; if (side === "b") setSide("a"); else { setDaf((value) => value - 1); setSide("b"); } }
    else { if (isLast) return; if (side === "a") setSide("b"); else { setDaf((value) => value + 1); setSide("a"); } }
  };
  const selectWord = useCallback((blockId:string, word:string) => { setSelectedBlock(blockId); setSelectedWord(word); }, []);
  const located = useCallback((locatedBlock?:string) => { if(locatedBlock)setSelectedBlock(locatedBlock); setBlockLocated(true); }, []);
  const selected = segments.find((item) => item.id === selectedBlock);
  const linked = comments.filter((item) => item.base === selectedBlock);
  const rashi = linked.filter((item) => item.commentator === "Rashi");
  const tosafot = linked.filter((item) => item.commentator === "Tosafot");
  const savedArticle = tractate.sefaria === "Bekhorot" && selectedBlock === "2a:3";
  const pageOptions = Array.from({length:tractate.lastDaf-1},(_,i)=>i+2).flatMap((number) => ["a","b"].filter((amud) => !(number===tractate.lastDaf&&tractate.lastSide==="a"&&amud==="b")).map((amud) => `${number}${amud}`));
  const nearbyStart = Math.max(2, Math.min(daf <= 3 ? 2 : daf - 1, Math.max(2, tractate.lastDaf - 2)));
  const nearbyPages = [nearbyStart,nearbyStart+1,nearbyStart+2].filter((number)=>number<=tractate.lastDaf).flatMap((number)=>["a","b"].filter((amud)=>!(number===tractate.lastDaf&&tractate.lastSide==="a"&&amud==="b")).map((amud)=>`${number}${amud}`));
  const choosePage = (value:string) => { setDaf(Number(value.slice(0,-1))); setSide(value.endsWith("b")?"b":"a"); };

  const captureSelection = () => { const selection=window.getSelection(), text=selection?.toString().trim() || ""; if(text && text.length<80 && /[\u0590-\u05FF]/.test(text)){ const rect=selection?.rangeCount?selection.getRangeAt(0).getBoundingClientRect():null; setPicked({text,x:Math.min(window.innerWidth-170,rect?.left||40),y:(rect?.bottom||90)+8}); } };
  const saveWord = () => { if(!picked)return; const next=words.includes(picked.text)?words:[picked.text,...words]; setWords(next); localStorage.setItem("havruta-dictionary",JSON.stringify(next)); setPicked(null); };

  return <main>
    <header className="topbar"><div className="brand"><span className="brandMark">דף</span><span>Daf-Ru</span></div><div className="progress"><span>{tractate.ru}</span><strong>{daf}{side === "a" ? "а" : "б"}</strong><span className="status"><i/> Позиция сохранена</span></div><button className="iconButton" onClick={()=>setDictionaryOpen(true)} aria-label="Открыть словарь">⌘ <span>Словарь</span>{words.length>0&&<b>{words.length}</b>}</button></header>
    <section className="workspace"><aside className="sourcePane dafPane">
      <nav className="dafNavigation compactNavigation" aria-label="Навигация по Талмуду"><button disabled={isFirst} onClick={()=>move(-1)} aria-label="Предыдущая страница">←</button><label><select value={tractateTitle} aria-label="Трактат" onChange={(e)=>{setTractateTitle(e.target.value);setDaf(2);setSide("a");}}>{TRACTATES.map((item)=><option key={item.sefaria} value={item.sefaria}>{item.ru}</option>)}</select></label><label><select value={pageKey} aria-label="Страница" onChange={(e)=>choosePage(e.target.value)}>{pageOptions.map((value)=><option key={value} value={value}>{value.replace("a","а").replace("b","б")}</option>)}</select></label><button disabled={isLast} onClick={()=>move(1)} aria-label="Следующая страница">→</button><div className="zoomControls"><button onClick={()=>setZoom(v=>Math.max(.6,v-.15))} aria-label="Уменьшить">−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(v=>Math.min(1.8,v+.15))} aria-label="Увеличить">+</button></div></nav>
      <div className="dafViewport">{status==="ready"?<PdfDafViewer zoom={zoom} selectedBlock={selectedBlock} onSelect={selectWord} onBlockLocated={located} pdfUrl={pdfUrl} label={label} segments={segments} commentary={comments}/>:<div className={`pageDataStatus ${status}`}>{status==="loading"?"Получаем лист и текст…":<><b>Не удалось загрузить лист</b><small>{error}</small></>}</div>}</div>
      <div className="pageGuide compactGuide"><span>Лист: Shas.org / HebrewBooks · текст и связи: Sefaria</span></div>
    </aside><article className="studyPane" onMouseUp={captureSelection}>
      <div className="studyNavigation"><div><span>{tractate.ru}</span><b>{daf}{side==="a"?"а":"б"}</b></div><nav aria-label="Соседние страницы">{nearbyPages.map((value)=><button key={value} className={value===pageKey?"active":""} disabled={value===pageKey} onClick={()=>choosePage(value)}>{value.replace("a","а").replace("b","б")}</button>)}</nav></div>
      {status!=="ready"||!blockLocated?<div className="studyWaiting"><span>{label}</span><h2>Связываем оригинальный лист с текстом Sefaria…</h2><p>Разбор появится после проверки соответствия реплик странице.</p></div>:<>
      <section className="analysisCard gemaraCard"><div className="cardTitle"><span>{savedArticle?"01":"•"}</span><div><small>{selected?.kind.toUpperCase()} · {selectedBlock}</small><h2>{savedArticle?"Почему необходимы оба случая?":"Разбор пока не сохранён"}</h2></div></div>{savedArticle&&<div className="sourceBadge"><b>DAF-RU</b><span>редакционная версия</span><time>22.09.2026</time></div>}<div className="hebrew" lang="he" dir="rtl">{selected?.text}</div>{savedArticle?<><div className="rule"/><h3>Точный перевод</h3><p>Они необходимы. Ведь если бы учили только о покупающем, я бы сказал: это потому, что он приводит её к святости. Но продающий, который выводит её из святости, — можно было бы сказать: оштрафуем его. Поэтому сообщается нам, что это не так.</p></>:<div className="explanation"><span>Источник</span><p>Проверенный оригинал из Sefaria. Перевод и объяснение пока не сохранены.</p></div>}</section>
      {rashi.length>0&&<><div className="commentaryHeading"><span>Раши к этой реплике</span><i>{rashi.length}</i></div>{rashi.map((item)=><section className="analysisCard sourceCommentCard rashiSourceCard" key={item.ref}><div className="commentMeta"><b>РАШИ</b><span>{item.ref}</span></div><div className="hebrew" lang="he" dir="rtl">{item.text}</div></section>)}</>}{tosafot.length>0&&<><div className="commentaryHeading tosafotHeading"><span>Тосафот к этой реплике</span><i>{tosafot.length}</i></div>{tosafot.map((item)=><section className="analysisCard sourceCommentCard tosafotCard" key={item.ref}><div className="commentMeta"><b>ТОСАФОТ</b><span>{item.ref}</span></div><div className="hebrew" lang="he" dir="rtl">{item.text}</div></section>)}</>}{linked.length===0&&<div className="noCommentary">Sefaria не связывает с этой репликой комментарии Раши или Тосафот.</div>}</>}
    </article></section>
    {picked&&<button className="saveSelection" style={{left:picked.x,top:picked.y}} onMouseDown={(e)=>e.preventDefault()} onClick={saveWord}>＋ В словарь</button>}
    {dictionaryOpen&&<div className="drawerBackdrop" onClick={()=>setDictionaryOpen(false)}><aside className="drawer" onClick={(e)=>e.stopPropagation()}><div className="drawerHead"><div><small>ЛИЧНАЯ КОЛЛЕКЦИЯ</small><h2>Словарь</h2></div><button onClick={()=>setDictionaryOpen(false)}>×</button></div>{words.length?<div className="wordList">{words.map((word)=><div className="word" key={word}><span dir="rtl">{word}</span><small>{label}</small><button onClick={()=>{const next=words.filter((item)=>item!==word);setWords(next);localStorage.setItem("havruta-dictionary",JSON.stringify(next));}}>Удалить</button></div>)}</div>:<div className="empty"><b>Пока пусто</b><p>Выделите выражение и сохраните его.</p></div>}</aside></div>}
  </main>;
}
