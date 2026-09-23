"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PdfDafViewer, DafSegment } from "./PdfDafViewer";
import { CommentaryLink } from "./bekhorot2aCommentary";
import { TRACTATES, tractateBySefaria } from "./talmudCatalog";

const POSITION_KEY = "daf-ru-last-page";
const clean = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
const dibur = (value: string) => (clean(value).split(/\s[-–—]\s/)[0] || clean(value)).replace(/:$/, "").trim();

type GeneratedComment = { ref:string; translation:string; explanation:string };
type GeneratedArticle = {
  ref:string;
  title:string;
  translation:string;
  explanation:string;
  rashi:GeneratedComment[];
  tosafot:GeneratedComment[];
  generatedAt:string;
  provider?:string;
  updatedAt?:string;
};

type SiteTool = {
  name:string;
  description:string;
  inputSchema:Record<string, unknown>;
  annotations?:Record<string, boolean>;
  execute:(input:Record<string, unknown>) => unknown | Promise<unknown>;
};

type ModelContext = { registerTool:(tool:SiteTool, options?:{signal?:AbortSignal})=>Promise<void> };

export default function HomeClient({user}:{user:{name:string;email:string}}) {
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
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticle | null>(null);
  const [siteToolsAvailable, setSiteToolsAvailable] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [draft, setDraft] = useState<GeneratedArticle | null>(null);
  const [editorMessage, setEditorMessage] = useState("");
  const [saving, setSaving] = useState(false);

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
  const selected = useMemo(() => segments.find((item) => item.id === selectedBlock), [segments, selectedBlock]);
  const linked = useMemo(() => comments.filter((item) => item.base === selectedBlock), [comments, selectedBlock]);
  const rashi = useMemo(() => linked.filter((item) => item.commentator === "Rashi"), [linked]);
  const tosafot = useMemo(() => linked.filter((item) => item.commentator === "Tosafot"), [linked]);
  const savedArticle = tractate.sefaria === "Bekhorot" && selectedBlock === "2a:3";
  const activeGeneratedArticle = generatedArticle?.ref === selectedBlock ? generatedArticle : null;
  const pageOptions = Array.from({length:tractate.lastDaf-1},(_,i)=>i+2).flatMap((number) => ["a","b"].filter((amud) => !(number===tractate.lastDaf&&tractate.lastSide==="a"&&amud==="b")).map((amud) => `${number}${amud}`));
  const nearbyStart = Math.max(2, Math.min(daf <= 3 ? 2 : daf - 1, Math.max(2, tractate.lastDaf - 2)));
  const nearbyPages = [nearbyStart,nearbyStart+1,nearbyStart+2].filter((number)=>number<=tractate.lastDaf).flatMap((number)=>["a","b"].filter((amud)=>!(number===tractate.lastDaf&&tractate.lastSide==="a"&&amud==="b")).map((amud)=>`${number}${amud}`));
  const choosePage = (value:string) => { setDaf(Number(value.slice(0,-1))); setSide(value.endsWith("b")?"b":"a"); };

  const captureSelection = () => { const selection=window.getSelection(), text=selection?.toString().trim() || ""; if(text && text.length<80 && /[\u0590-\u05FF]/.test(text)){ const rect=selection?.rangeCount?selection.getRangeAt(0).getBoundingClientRect():null; setPicked({text,x:Math.min(window.innerWidth-170,rect?.left||40),y:(rect?.bottom||90)+8}); } };
  const saveWord = () => { if(!picked)return; const next=words.includes(picked.text)?words:[picked.text,...words]; setWords(next); localStorage.setItem("havruta-dictionary",JSON.stringify(next)); setPicked(null); };
  useEffect(() => {
    if(!selected) return;
    const controller=new AbortController();
    fetch(`/api/articles?tractate=${encodeURIComponent(tractate.sefaria)}&ref=${encodeURIComponent(selectedBlock)}`,{signal:controller.signal})
      .then((response)=>response.ok?response.json():null).then((data)=>{if(data?.article)setGeneratedArticle({...data.article,generatedAt:data.article.updatedAt||data.article.createdAt});})
      .catch(()=>{});
    return ()=>controller.abort();
  },[selected,selectedBlock,tractate.sefaria]);

  const promptForAI = () => selected ? `Ты готовишь учебную статью Daf-Ru на русском языке. Используй только переданные оригиналы, не изменяй и не дополняй их. Дай точный, близкий к тексту перевод и короткое объяснение для начинающего. Для каждого комментария верни отдельный перевод и объяснение. Ответь ТОЛЬКО JSON без markdown по схеме: {"title":"...","translation":"...","explanation":"...","rashi":[{"ref":"...","translation":"...","explanation":"..."}],"tosafot":[{"ref":"...","translation":"...","explanation":"..."}]}\n\nТрактат: ${tractate.ru}\nРеплика: ${selectedBlock}\nГемара: ${selected.text}\nРаши: ${JSON.stringify(rashi.map(x=>({ref:x.ref,original:x.text})))}\nТосафот: ${JSON.stringify(tosafot.map(x=>({ref:x.ref,original:x.text})))}` : "";
  const openEditor = () => { setDraft(activeGeneratedArticle || {ref:selectedBlock,title:"",translation:"",explanation:"",rashi:rashi.map(x=>({ref:x.ref,translation:"",explanation:""})),tosafot:tosafot.map(x=>({ref:x.ref,translation:"",explanation:""})),generatedAt:new Date().toISOString(),provider:"ChatGPT"}); setImportText("");setEditorMessage("");setEditorOpen(true); };
  const copyPrompt = async () => { await navigator.clipboard.writeText(promptForAI()); setEditorMessage("Задание скопировано. Вставьте его в выбранный AI."); };
  const parseImport = () => { try { const raw=JSON.parse(importText) as Record<string,unknown>; setDraft((current)=>({...current!,title:String(raw.title||""),translation:String(raw.translation||""),explanation:String(raw.explanation||""),rashi:Array.isArray(raw.rashi)?raw.rashi as GeneratedComment[]:current!.rashi,tosafot:Array.isArray(raw.tosafot)?raw.tosafot as GeneratedComment[]:current!.tosafot}));setEditorMessage("Ответ разобран. Проверьте и исправьте поля перед сохранением."); } catch { setEditorMessage("Не удалось разобрать JSON. Попросите AI ответить только JSON без оформления."); } };
  const saveArticle = async () => { if(!draft)return; setSaving(true);setEditorMessage(""); try { const response=await fetch("/api/articles",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...draft,tractate:tractate.sefaria,ref:selectedBlock})}); const data=await response.json(); if(!response.ok)throw new Error(data.error||"Ошибка сохранения"); setGeneratedArticle({...data.article,generatedAt:data.article.updatedAt});setEditorOpen(false); } catch(reason){setEditorMessage(reason instanceof Error?reason.message:String(reason));} finally{setSaving(false);} };
  useEffect(() => {
    if (!selected || !blockLocated) return;
    const context = (document as Document & { modelContext?:ModelContext }).modelContext;
    if (typeof context?.registerTool !== "function") { setSiteToolsAvailable(false); return; }
    setSiteToolsAvailable(true);
    const controller = new AbortController();
    const register = async () => {
      await context.registerTool({
        name:"get_selected_talmud_fragment",
        description:"Получить выбранную сейчас реплику Талмуда и связанные с ней оригинальные комментарии Раши и Тосафот из проверенного корпуса Sefaria. Используйте перед созданием русской учебной статьи.",
        inputSchema:{type:"object",properties:{},additionalProperties:false},
        annotations:{readOnlyHint:true},
        execute:async () => ({
          task:"Создайте точный русский перевод и краткое учебное объяснение выбранной реплики. Затем обязательно вызовите show_generated_talmud_article, чтобы показать результат на странице. Не переписывайте и не исправляйте оригиналы: они будут показаны сайтом только из корпуса.",
          tractate:tractate.ru,
          sefariaTractate:tractate.sefaria,
          ref:selectedBlock,
          kind:selected.kind,
          original:selected.text,
          rashi:rashi.map((item)=>({ref:item.ref,original:item.text})),
          tosafot:tosafot.map((item)=>({ref:item.ref,original:item.text})),
          outputRules:{language:"ru",translation:"точный, близкий к оригиналу",explanation:"краткое, понятное начинающему",originals:"никогда не генерировать"},
        }),
      }, {signal:controller.signal});
      await context.registerTool({
        name:"show_generated_talmud_article",
        description:`Показать в Daf-Ru готовые русский перевод и объяснение только для текущей реплики ${selectedBlock}. Оригиналы не принимаются: страница сохраняет оригиналы Sefaria.`,
        inputSchema:{
          type:"object",
          properties:{
            ref:{type:"string",const:selectedBlock,description:"Точный ref текущей реплики"},
            title:{type:"string",description:"Короткий русский заголовок"},
            translation:{type:"string",description:"Точный русский перевод реплики"},
            explanation:{type:"string",description:"Краткое объяснение для начинающего"},
            rashi:{type:"array",items:{type:"object",properties:{ref:{type:"string"},translation:{type:"string"},explanation:{type:"string"}},required:["ref","translation","explanation"],additionalProperties:false}},
            tosafot:{type:"array",items:{type:"object",properties:{ref:{type:"string"},translation:{type:"string"},explanation:{type:"string"}},required:["ref","translation","explanation"],additionalProperties:false}},
          },
          required:["ref","title","translation","explanation","rashi","tosafot"],
          additionalProperties:false,
        },
        annotations:{readOnlyHint:false,idempotentHint:true},
        execute:async (input) => {
          if (input.ref !== selectedBlock) throw new Error(`Ожидалась реплика ${selectedBlock}`);
          const toComments = (value:unknown, allowed:CommentaryLink[]) => Array.isArray(value) ? value.flatMap((entry) => {
            if (!entry || typeof entry !== "object") return [];
            const item = entry as Record<string, unknown>;
            const ref = String(item.ref || "");
            if (!allowed.some((comment)=>comment.ref===ref)) return [];
            return [{ref,translation:String(item.translation || ""),explanation:String(item.explanation || "")}];
          }) : [];
          const article:GeneratedArticle = {
            ref:selectedBlock,
            title:String(input.title || "Разбор реплики"),
            translation:String(input.translation || ""),
            explanation:String(input.explanation || ""),
            rashi:toComments(input.rashi,rashi),
            tosafot:toComments(input.tosafot,tosafot),
            generatedAt:new Date().toISOString(),
          };
          setGeneratedArticle(article);
          return {ok:true,shown:true,ref:selectedBlock,message:"Статья показана справа в Daf-Ru. Оригиналы оставлены без изменений."};
        },
      }, {signal:controller.signal});
    };
    register().catch(() => setSiteToolsAvailable(false));
    return () => controller.abort();
  }, [blockLocated, selected, selectedBlock, tractate, rashi, tosafot]);

  return <main>
    <header className="topbar"><div className="brand"><span className="brandMark">דף</span><span>Daf-Ru</span></div><div className="progress"><span>{tractate.ru}</span><strong>{daf}{side === "a" ? "а" : "б"}</strong><span className="status"><i/> Позиция сохранена</span></div><div className="account"><span title={user.email}>{user.name}</span><button className="iconButton" onClick={()=>setDictionaryOpen(true)} aria-label="Открыть словарь">⌘ <span>Словарь</span>{words.length>0&&<b>{words.length}</b>}</button></div></header>
    <section className="workspace"><aside className="sourcePane dafPane">
      <nav className="dafNavigation compactNavigation" aria-label="Навигация по Талмуду"><button disabled={isFirst} onClick={()=>move(-1)} aria-label="Предыдущая страница">←</button><label><select value={tractateTitle} aria-label="Трактат" onChange={(e)=>{setTractateTitle(e.target.value);setDaf(2);setSide("a");}}>{TRACTATES.map((item)=><option key={item.sefaria} value={item.sefaria}>{item.ru}</option>)}</select></label><label><select value={pageKey} aria-label="Страница" onChange={(e)=>choosePage(e.target.value)}>{pageOptions.map((value)=><option key={value} value={value}>{value.replace("a","а").replace("b","б")}</option>)}</select></label><button disabled={isLast} onClick={()=>move(1)} aria-label="Следующая страница">→</button><div className="zoomControls"><button onClick={()=>setZoom(v=>Math.max(.6,v-.15))} aria-label="Уменьшить">−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(v=>Math.min(1.8,v+.15))} aria-label="Увеличить">+</button></div></nav>
      <div className="dafViewport">{status==="ready"?<PdfDafViewer zoom={zoom} selectedBlock={selectedBlock} onSelect={selectWord} onBlockLocated={located} pdfUrl={pdfUrl} label={label} segments={segments} commentary={comments}/>:<div className={`pageDataStatus ${status}`}>{status==="loading"?"Получаем лист и текст…":<><b>Не удалось загрузить лист</b><small>{error}</small></>}</div>}</div>
      <div className="pageGuide compactGuide"><span>Лист: Shas.org / HebrewBooks · текст и связи: Sefaria</span></div>
    </aside><article className="studyPane" onMouseUp={captureSelection}>
      <div className="studyNavigation"><div><span>{tractate.ru}</span><b>{daf}{side==="a"?"а":"б"}</b></div><nav aria-label="Соседние страницы">{nearbyPages.map((value)=><button key={value} className={value===pageKey?"active":""} disabled={value===pageKey} onClick={()=>choosePage(value)}>{value.replace("a","а").replace("b","б")}</button>)}</nav></div>
      {status!=="ready"||!blockLocated?<div className="studyWaiting"><span>{label}</span><h2>Связываем оригинальный лист с текстом Sefaria…</h2><p>Разбор появится после проверки соответствия реплик странице.</p></div>:<>
      <section className="analysisCard gemaraCard"><button className="editArticleButton" onClick={openEditor}>{activeGeneratedArticle?"Редактировать":"Создать статью"}</button><div className="cardTitle"><span>{savedArticle?"01":"•"}</span><div><small>{selected?.kind.toUpperCase()} · {selectedBlock}</small><h2>{activeGeneratedArticle?.title || (savedArticle?"Почему необходимы оба случая?":"Разбор пока не сохранён")}</h2></div></div>{savedArticle&&!activeGeneratedArticle&&<div className="sourceBadge"><b>DAF-RU</b><span>редакционная версия</span><time>22.09.2026</time></div>}{activeGeneratedArticle&&<div className="sourceBadge aiBadge"><b>AI</b><span>{activeGeneratedArticle.provider||"AI"}</span><time>{new Date(activeGeneratedArticle.generatedAt).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"})}</time></div>}<div className="hebrew" lang="he" dir="rtl">{selected?.text}</div>{activeGeneratedArticle?<><div className="rule"/><h3>Точный перевод</h3><p>{activeGeneratedArticle.translation}</p><div className="explanation"><span>Объяснение</span><p>{activeGeneratedArticle.explanation}</p></div></>:savedArticle?<><div className="rule"/><h3>Точный перевод</h3><p>Они необходимы. Ведь если бы учили только о покупающем, я бы сказал: это потому, что он приводит её к святости. Но продающий, который выводит её из святости, — можно было бы сказать: оштрафуем его. Поэтому сообщается нам, что это не так.</p></>:<div className="explanation"><span>Источник</span><p>Проверенный оригинал из Sefaria. Нажмите «Создать статью».</p></div>}</section>
      {rashi.length>0&&<><div className="commentaryHeading"><span>Раши к этой реплике</span><i>{rashi.length}</i></div>{rashi.map((item)=>{const article=activeGeneratedArticle?.rashi.find((entry)=>entry.ref===item.ref);return <section className="analysisCard sourceCommentCard rashiSourceCard" key={item.ref}><div className="commentMeta"><b>РАШИ</b><span>{item.ref}</span></div><div className="hebrew" lang="he" dir="rtl">{item.text}</div>{article&&<><div className="rule"/><h3>Точный перевод</h3><p>{article.translation}</p><div className="explanation"><span>Объяснение</span><p>{article.explanation}</p></div></>}</section>})}</>}{tosafot.length>0&&<><div className="commentaryHeading tosafotHeading"><span>Тосафот к этой реплике</span><i>{tosafot.length}</i></div>{tosafot.map((item)=>{const article=activeGeneratedArticle?.tosafot.find((entry)=>entry.ref===item.ref);return <section className="analysisCard sourceCommentCard tosafotCard" key={item.ref}><div className="commentMeta"><b>ТОСАФОТ</b><span>{item.ref}</span></div><div className="hebrew" lang="he" dir="rtl">{item.text}</div>{article&&<><div className="rule"/><h3>Точный перевод</h3><p>{article.translation}</p><div className="explanation"><span>Объяснение</span><p>{article.explanation}</p></div></>}</section>})}</>}{linked.length===0&&<div className="noCommentary">Sefaria не связывает с этой репликой комментарии Раши или Тосафот.</div>}</>}
    </article></section>
    {picked&&<button className="saveSelection" style={{left:picked.x,top:picked.y}} onMouseDown={(e)=>e.preventDefault()} onClick={saveWord}>＋ В словарь</button>}
    {dictionaryOpen&&<div className="drawerBackdrop" onClick={()=>setDictionaryOpen(false)}><aside className="drawer" onClick={(e)=>e.stopPropagation()}><div className="drawerHead"><div><small>ЛИЧНАЯ КОЛЛЕКЦИЯ</small><h2>Словарь</h2></div><button onClick={()=>setDictionaryOpen(false)}>×</button></div>{words.length?<div className="wordList">{words.map((word)=><div className="word" key={word}><span dir="rtl">{word}</span><small>{label}</small><button onClick={()=>{const next=words.filter((item)=>item!==word);setWords(next);localStorage.setItem("havruta-dictionary",JSON.stringify(next));}}>Удалить</button></div>)}</div>:<div className="empty"><b>Пока пусто</b><p>Выделите выражение и сохраните его.</p></div>}</aside></div>}
    {editorOpen&&draft&&<div className="editorBackdrop"><section className="articleEditor"><div className="editorHead"><div><small>{tractate.ru} · {selectedBlock}</small><h2>Черновик статьи</h2></div><button onClick={()=>setEditorOpen(false)}>×</button></div><div className="editorSteps"><button onClick={copyPrompt}>1. Скопировать задание для AI</button><select value={draft.provider||"ChatGPT"} onChange={(e)=>setDraft({...draft,provider:e.target.value})}><option>ChatGPT</option><option>Claude</option><option>Gemini</option><option>Другой AI</option></select></div><label className="wideField"><span>2. Вставьте JSON-ответ AI</span><textarea value={importText} onChange={(e)=>setImportText(e.target.value)} placeholder='{"title":"…","translation":"…"}'/><button onClick={parseImport}>Разобрать ответ</button></label><div className="editorFields"><label><span>Заголовок</span><input value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})}/></label><label><span>Точный перевод</span><textarea value={draft.translation} onChange={(e)=>setDraft({...draft,translation:e.target.value})}/></label><label><span>Краткое объяснение</span><textarea value={draft.explanation} onChange={(e)=>setDraft({...draft,explanation:e.target.value})}/></label></div>{draft.rashi.map((item,index)=><div className="commentEdit" key={item.ref}><b>Раши · {item.ref}</b><textarea placeholder="Перевод" value={item.translation} onChange={(e)=>setDraft({...draft,rashi:draft.rashi.map((x,i)=>i===index?{...x,translation:e.target.value}:x)})}/><textarea placeholder="Объяснение" value={item.explanation} onChange={(e)=>setDraft({...draft,rashi:draft.rashi.map((x,i)=>i===index?{...x,explanation:e.target.value}:x)})}/></div>)}{draft.tosafot.map((item,index)=><div className="commentEdit" key={item.ref}><b>Тосафот · {item.ref}</b><textarea placeholder="Перевод" value={item.translation} onChange={(e)=>setDraft({...draft,tosafot:draft.tosafot.map((x,i)=>i===index?{...x,translation:e.target.value}:x)})}/><textarea placeholder="Объяснение" value={item.explanation} onChange={(e)=>setDraft({...draft,tosafot:draft.tosafot.map((x,i)=>i===index?{...x,explanation:e.target.value}:x)})}/></div>)}{editorMessage&&<p className="editorMessage">{editorMessage}</p>}<div className="editorActions"><button onClick={()=>setEditorOpen(false)}>Отмена</button><button className="primary" disabled={saving} onClick={saveArticle}>{saving?"Сохраняем…":"Сохранить статью"}</button></div></section></div>}
  </main>;
}
