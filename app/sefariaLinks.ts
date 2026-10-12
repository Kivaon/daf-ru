// Sefaria refs own semantic association; PDF coordinates never filter sources.
export function sourceText(value:unknown):string{return Array.isArray(value)?value.map(sourceText).join(' '):typeof value==='string'?value.replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').trim():'';}
const order=(page:string,index:number)=>{const m=page.match(/^(\d+)([ab])$/);return m?(Number(m[1])*2+(m[2]==='b'?1:0))*100000+index:NaN;};
export function anchorIncludes(anchor:string,tractate:string,ref:string){
 if(!anchor.startsWith(tractate+' '))return false;
 const m=anchor.slice(tractate.length+1).match(/^(\d+[ab])(?::(\d+))?(?:-(?:(\d+[ab])(?::(\d+))?|(\d+)))?$/);
 const r=ref.match(/^(\d+[ab]):(\d+)$/);if(!m||!r)return false;
 const start=order(m[1],Number(m[2]||0)),end=order(m[3]||m[1],Number(m[4]||m[5]||m[2]||99999)),n=order(r[1],Number(r[2]));return n>=start&&n<=end;
}
export function sourceComments(links:unknown,tractate:string,refs:string[]){
 if(!Array.isArray(links))throw new Error('Sefaria не вернула список комментариев');
 return links.flatMap((link:Record<string,unknown>)=>{
  const commentator=(link.collectiveTitle as {en?:string})?.en;
  if(commentator!=='Rashi'&&commentator!=='Tosafot')return [];
  const text=sourceText(link.he),ref=sourceText(link.ref||link.sourceRef),anchor=String(link.anchorRef||'');
  if(!text||!ref)throw new Error('Sefaria не вернула полный текст комментария '+ref);
  const bold=typeof link.he==='string'?link.he.match(/<b[^>]*>([\s\S]*?)<\/b>/i)?.[1]:undefined;
  const dibur=sourceText(bold||text).split(/\s[-–—]\s/)[0].replace(/:$/,'').trim();
  return refs.filter(base=>anchorIncludes(anchor,tractate,base)).map(base=>({base,commentator:commentator as 'Rashi'|'Tosafot',ref,text,dibur}));
 }).filter((item,index,all)=>all.findIndex(x=>x.base===item.base&&x.ref===item.ref)===index);
}
