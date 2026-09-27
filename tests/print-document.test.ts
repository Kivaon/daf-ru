import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePrintArticles, createPrintDocument, PRINT_BLOCKS } from '../app/printDocument.ts';
import type { PrintArticle, PrintSettings, SavedPrintArticle } from '../app/printDocument.ts';
const articles:PrintArticle[]=[1,2].map(n=>({ref:`2a:${n}`,title:`Article ${n}`,parts:[{ref:`2a:${n}`,original:`ORIGINAL_${n}`,translation:`TRANSLATION_${n}`}],explanation:`EXPLANATION_${n}`,rashi:[{ref:`Rashi ${n}`,original:`RASHI_${n}`,translation:'comment translation',explanation:'comment explanation'}],tosafot:[{ref:`Tosafot ${n}`,original:`TOSAFOT_${n}`,translation:'',explanation:''}]}));
const defaults:PrintSettings={blocks:{original:true,translation:true,explanation:true,rashi:true,tosafot:true},order:'articles',pair:true,stamps:true,fontSize:16};
test('every block combination respects independent visibility in both orders and pairing modes',()=>{
 for(let mask=0;mask<32;mask++)for(const order of ['articles','blocks'] as const)for(const pair of [true,false]){
 const blocks=Object.fromEntries(PRINT_BLOCKS.map((b,i)=>[b.key,!!(mask&(1<<i))])) as PrintSettings['blocks'];
 const html=createPrintDocument('Бехорот 2а',articles,{...defaults,blocks,order,pair});
 for(const block of PRINT_BLOCKS)for(const n of [1,2])assert.equal(html.includes(`${block.key.toUpperCase()}_${n}`),blocks[block.key]);
 }
});
test('block order pairs translations with their explanations only when enabled',()=>{
 const paired=createPrintDocument('Бехорот 2а',articles,{...defaults,order:'blocks'});
 assert.ok(paired.indexOf('TRANSLATION_1')<paired.indexOf('EXPLANATION_1'));
 assert.ok(paired.indexOf('EXPLANATION_1')<paired.indexOf('TRANSLATION_2'));
 const separate=createPrintDocument('Бехорот 2а',articles,{...defaults,order:'blocks',pair:false});
 assert.ok(separate.indexOf('TRANSLATION_2')<separate.indexOf('EXPLANATION_1'));
});
test('stamps use only the short reference and can all be removed',()=>{
 const html=createPrintDocument('Бехорот 2а',articles,defaults);
 assert.match(html,/<span class="stamp" dir="ltr">\[2а:1\]<\/span>/);
 assert.doesNotMatch(html,/<span class="stamp"[^>]*>Бехорот/);
 assert.doesNotMatch(createPrintDocument('Бехорот 2а',articles,{...defaults,stamps:false}),/class="stamp"/);
});
test('saved text is escaped and missing data is explicit',()=>{
 const html=createPrintDocument('test',[{...articles[0],explanation:'<script>alert(1)</script>',parts:[{ref:'2a:1',original:'',translation:''}]}],defaults);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/\[отсутствует\]/);
});
test('spanning articles are emitted once, retaining part and commentary association',()=>{
 const segment=[{id:'2a:1',text:'first'},{id:'2a:2',text:'second'}];
 const saved:SavedPrintArticle={ref:'2a:1',title:'unit',unitRef:'unit-id',translation:'whole',explanation:'explanation',rashi:[],tosafot:[],parts:[{ref:'2a:1',translation:'one'},{ref:'2a:2',translation:'two'}],pages:[{ref:'2a:1',rashi:[],tosafot:[]},{ref:'2a:2',rashi:[{ref:'r2',translation:'r-two',explanation:''}],tosafot:[]}]};
 const result=assemblePrintArticles(segment,segment,[{base:'2a:2',commentator:'Rashi',ref:'r2',text:'rashi-original'}],[saved,saved]);
 assert.equal(result.length,1);assert.equal(result[0].parts[1].original,'second');assert.equal(result[0].parts[1].translation,'two');assert.equal(result[0].rashi[0].translation,'r-two');
});

test('untranslated articles retain their original and use the agreed missing marker',()=>{
 const built=assemblePrintArticles([{id:'2a:3',text:'ORIGINAL_UNTRANSLATED'}],[{id:'2a:3',text:'ORIGINAL_UNTRANSLATED'}],[{base:'2a:3',commentator:'Rashi',ref:'r',text:'RASHI_ORIGINAL'}],[null]);
 const html=createPrintDocument('Бехорот 2а',built,defaults);
 assert.match(html,/ORIGINAL_UNTRANSLATED/);assert.match(html,/RASHI_ORIGINAL/);assert.ok((html.match(/\[отсутствует\]/g)||[]).length>=4);
});

test('block mode flows homogeneous fragments without repeated article headings',()=>{
 const html=createPrintDocument('Бехорот 2а',articles,{...defaults,order:'blocks',pair:false});
 assert.doesNotMatch(html,/<h3>/);assert.doesNotMatch(html,/<article>/);
 assert.match(html,/ORIGINAL_1\. <span class="stamp" dir="ltr">\[2а:2\]<\/span> ORIGINAL_2\./);
 assert.match(html,/TRANSLATION_1\. <span class="stamp" dir="ltr">\[2а:2\]<\/span> TRANSLATION_2\./);
});

test('paired explanations use parentheses, plain label and italic explanation text',()=>{
 const html=createPrintDocument('Бехорот 2а',articles,{...defaults,stamps:false});
 assert.match(html,/\(<span class="explanationLabel">Объяснение:<\/span> <em>EXPLANATION_1\.<\/em>\)/);
 assert.match(html,/explanationLabel\{font-style:normal;font-weight:normal/);
 const unpaired=createPrintDocument('Бехорот 2а',[{...articles[0],rashi:[],tosafot:[]}],{...defaults,pair:false});
 assert.doesNotMatch(unpaired,/<em>EXPLANATION_1/);
});
