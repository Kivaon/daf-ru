export type PrintBlock = "original" | "translation" | "explanation" | "rashi" | "tosafot";
export const PRINT_BLOCKS: {key: PrintBlock; label: string}[] = [
  {key:"original",label:"Оригинал"},{key:"translation",label:"Перевод"},
  {key:"explanation",label:"Объяснение"},{key:"rashi",label:"Раши"},{key:"tosafot",label:"Тосафот"},
];
export type PrintSettings = {blocks: Record<PrintBlock,boolean>; order:"articles"|"blocks"; pair:boolean; stamps:boolean; fontSize:number};
export type SavedPrintComment = {ref:string;translation:string;explanation:string};
export type SavedPrintArticle = {ref:string;title:string;translation:string;explanation:string;unitRef?:string;parts?:{ref:string;translation:string}[];rashi:SavedPrintComment[];tosafot:SavedPrintComment[];pages?:{ref:string;rashi:SavedPrintComment[];tosafot:SavedPrintComment[]}[]};
export type PrintSegment = {id:string;text:string};
export type PrintComment = {base:string;commentator:"Rashi"|"Tosafot";ref:string;text:string;dibur?:string};
export type PrintArticle = {ref:string;title:string;parts:{ref:string;original:string;translation:string}[];explanation:string;rashi:(SavedPrintComment & {original:string;base?:string;dibur?:string})[];tosafot:(SavedPrintComment & {original:string;base?:string;dibur?:string})[]};

export function assemblePrintArticles(segments:PrintSegment[], context:PrintSegment[], comments:PrintComment[], saved:(SavedPrintArticle|null)[]):PrintArticle[] {
  const seen = new Set<string>();
  return segments.flatMap((segment,index) => {
    const article=saved[index];
    const identity=article?.unitRef || segment.id;
    if(seen.has(identity)) return [];
    seen.add(identity);
    const parts=article?.parts?.length ? article.parts.map(part=>({ref:part.ref,original:context.find(s=>s.id===part.ref)?.text||"",translation:part.translation})) : [{ref:segment.id,original:segment.text,translation:article?.translation||""}];
    const refs=new Set(parts.map(p=>p.ref));
    const collect=(kind:"rashi"|"tosafot") => {
      const translations=article?.pages?.length ? article.pages.flatMap(p=>p[kind]||[]) : article?.[kind]||[];
      const originals=comments.filter(c=>refs.has(c.base)&&c.commentator===(kind==="rashi"?"Rashi":"Tosafot"));
      const allRefs=[...new Set([...originals.map(c=>c.ref),...translations.map(c=>c.ref)])];
      return allRefs.map(ref=>({ref,dibur:originals.find(c=>c.ref===ref)?.dibur,base:originals.find(c=>c.ref===ref)?.base||article?.pages?.find(p=>p[kind]?.some(c=>c.ref===ref))?.ref||segment.id,original:originals.find(c=>c.ref===ref)?.text||"",translation:translations.find(c=>c.ref===ref)?.translation||"",explanation:translations.find(c=>c.ref===ref)?.explanation||""}));
    };
    return [{ref:parts.map(p=>p.ref).join(" + "),title:article?.title||`Фрагмент ${index+1}`,parts,explanation:article?.explanation||"",rashi:collect("rashi"),tosafot:collect("tosafot")}];
  });
}

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const missing=(text:string)=>`<p class="missing">${text}</p>`;
const stamp=(ref:string,enabled:boolean)=>enabled?`<span class="stamp" dir="ltr">[${escapeHtml(ref.replace(/(\d+)a/g,"$1а").replace(/(\d+)b/g,"$1б"))}]</span> `:"";
const sentence=(text:string)=>{
  const value=text.trim().replace(/\s+/g," ");
  if(!value)return '<span class="missing">[отсутствует]</span>';
  // Preserve existing punctuation; only separate unpunctuated fragments.
  return escapeHtml(value)+(/[.!?;:׃…][»”"')\]]*$/.test(value)?"":".");
};
function originalComment(text:string,dibur?:string):string {
  const rendered=sentence(text);
  const opening=dibur?.trim().replace(/\s+/g," ");
  if(!opening)return rendered;
  const escaped=escapeHtml(opening), at=rendered.indexOf(escaped);
  return at<0?rendered:rendered.slice(0,at)+`<strong>${escaped}</strong>`+rendered.slice(at+escaped.length);
}
function translatedComment(text:string):string {
  const quoted=text.match(/^\s*[«"](.+?)[»"]\s*([—–\-:]?)\s*/);
  if(quoted){
    const normalized=quoted[1]+(quoted[2]?` ${quoted[2]} `:" ")+text.slice(quoted[0].length);
    return originalComment(normalized,quoted[1]);
  }
  const opening=text.match(/^\s*(.+?)\s+([—–-])\s+/);
  return originalComment(text,opening?.[1]);
}
function inlineBlock(article:PrintArticle,block:"original"|"translation"|"explanation",stamps:boolean):string {
  if(block==="explanation")return stamp(article.ref,stamps)+sentence(article.explanation);
  return article.parts.map(p=>stamp(p.ref,stamps)+sentence(p[block])).join(" ");
}
function flow(articles:PrintArticle[],block:PrintBlock,stamps:boolean):string {
  if(block==="original"||block==="translation"||block==="explanation")return `<p class="flow${block==="original"?' hebrew':''}"${block==="original"?' lang="he" dir="rtl"':''}>${articles.map(a=>inlineBlock(a,block,stamps)).join(" ")}</p>`;
  // Original Hebrew and Russian explanation stay separate for readable directionality.
  return articles.map(a=>a[block].length?a[block].map(c=>`<div class="comment"><p class="flow hebrew" lang="he" dir="rtl">${stamp(c.base||a.ref,stamps)}${originalComment(c.original,c.dibur)}</p><p class="flow">${stamp(c.base||a.ref,stamps)}${translatedComment(c.translation)} (<span class="explanationLabel">Объяснение:</span> <em>${sentence(c.explanation)}</em>)</p></div>`).join(""):"").join("");
}
export function createPrintDocument(label:string,articles:PrintArticle[],settings:PrintSettings):string {
  const available=(a:PrintArticle,key:PrintBlock)=>key!=="rashi"&&key!=="tosafot"||a[key].length>0;
  const blocks=PRINT_BLOCKS.filter(b=>settings.blocks[b.key]&&articles.some(a=>available(a,b.key)));
  const paired=settings.pair&&settings.blocks.translation&&settings.blocks.explanation;
  const elementStamps=settings.stamps&&settings.order==="blocks";
  const heading=(a:PrintArticle)=>`${stamp(a.ref,settings.stamps)}<h3>${escapeHtml(a.title)}</h3>`;
  const groups=blocks.filter(b=>!paired||b.key!=="explanation").map(b=>({key:b.key,label:paired&&b.key==="translation"?"Перевод и объяснение":b.label}));
  const content=(items:PrintArticle[],key:PrintBlock)=>paired&&key==="translation"?`<p class="flow">${items.map(a=>`${inlineBlock(a,"translation",elementStamps)} (<span class="explanationLabel">Объяснение:</span> <em>${sentence(a.explanation)}</em>)`).join(" ")}</p>`:flow(items,key,elementStamps);
  let body="";
  if(blocks.length) {
    if(settings.order==="articles") body=articles.map(a=>{const shown=groups.filter(b=>available(a,b.key));return shown.length?`<article>${heading(a)}${shown.map(b=>`<section><h4>${b.label}</h4>${content([a],b.key)}</section>`).join("")}</article>`:"";}).join("");
    else body=groups.map(b=>`<section class="block"><h2>${b.label}</h2>${content(articles,b.key)}</section>`).join("");
  }
  const title=`Daf-Ru — ${label}`;
  const size=Math.max(12,Math.min(20,settings.fontSize));
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
@page{size:A4;margin:17mm 16mm 19mm;@bottom-left{content:"${escapeHtml(label).replace(/\\/g,"\\\\")}";font:9pt serif}@bottom-right{content:counter(page);font:9pt serif}}
*{box-sizing:border-box}body{margin:0;background:#fff;color:#161616;font:${size}px/1.65 Georgia,"Times New Roman",serif}main{max-width:780px;margin:auto;padding:30px}header{border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px}header p{font:13px/1.5 sans-serif;color:#444}h1{font-size:28px;margin:0 0 8px}h2{font-size:23px;border-bottom:1px solid #aaa;padding-bottom:8px}h3{font-size:19px}h4{font-size:16px}h5{font-size:14px}h2,h3,h4,h5{break-after:avoid;margin:18px 0 8px}h3 small,small{font:12px/1.5 sans-serif;color:#555}p{margin:8px 0 16px;white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}.hebrew{font-family:"Times New Roman",serif;font-size:1.25em;line-height:1.85;text-align:right}article{border-bottom:1px solid #ccc;padding-bottom:20px;margin-bottom:24px}.part,.paired{margin:14px 0}.paired{border-inline-start:2px solid #bbb;padding-inline-start:14px}.comment{margin:18px 0}.stamp{display:inline;unicode-bidi:isolate;white-space:nowrap;font:0.8em/1.5 sans-serif;color:#555}.flow{white-space:normal;text-align:justify}.explanationLabel{font-style:normal;font-weight:normal;color:inherit}.missing{font:italic 13px/1.6 sans-serif;color:#666}footer{border-top:1px solid #aaa;margin-top:24px;padding-top:12px;font:12px/1.5 sans-serif}@media print{main{max-width:none;padding:0}body{background:white}a{color:inherit;text-decoration:none}}@media(max-width:500px){main{padding:18px}}
</style></head><body><main><header><h1>${escapeHtml(title)}</h1><p>${settings.order==="articles"?"По статьям":"По блокам"} · ${blocks.map(b=>b.label).join(" · ")}${paired?" · Перевод и объяснение вместе":""}</p><p>Материалы выбранного листа. Продолжения составных статей включены с указанием ссылок на соседние листы.</p></header>${body||missing(Object.values(settings.blocks).some(Boolean)?"На этом листе нет материалов выбранных блоков.":"Выберите хотя бы один блок.")}<footer>Daf-Ru · ${escapeHtml(label)} · Оригиналы: Sefaria. Переводы и пояснения: база Daf-Ru.<br>Материалы для подготовки к изучению с преподавателем или в хавруте.</footer></main></body></html>`;
}
