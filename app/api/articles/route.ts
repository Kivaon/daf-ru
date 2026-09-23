import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type Comment = { ref:string; translation:string; explanation:string };
const text = (value:unknown, max=20000) => typeof value === "string" ? value.trim().slice(0,max) : "";
const comments = (value:unknown):Comment[] => Array.isArray(value) ? value.slice(0,50).flatMap((raw) => {
  if (!raw || typeof raw !== "object") return [];
  const item=raw as Record<string,unknown>, ref=text(item.ref,300);
  return ref ? [{ref,translation:text(item.translation),explanation:text(item.explanation)}] : [];
}) : [];

export async function GET(request:Request) {
  if(!await getChatGPTUser()) return Response.json({error:"Требуется вход"},{status:401});
  const url=new URL(request.url), tractate=text(url.searchParams.get("tractate"),100), ref=text(url.searchParams.get("ref"),100);
  if(!tractate||!ref) return Response.json({error:"Не указана реплика"},{status:400});
  const row=await env.DB.prepare("SELECT ref, title, translation, explanation, rashi_json, tosafot_json, provider, created_at, updated_at FROM articles WHERE tractate = ? AND ref = ?").bind(tractate,ref).first<Record<string,string>>();
  if(!row) return Response.json({article:null});
  return Response.json({article:{ref:row.ref,title:row.title,translation:row.translation,explanation:row.explanation,rashi:JSON.parse(row.rashi_json||"[]"),tosafot:JSON.parse(row.tosafot_json||"[]"),provider:row.provider,createdAt:row.created_at,updatedAt:row.updated_at}});
}

export async function POST(request:Request) {
  const user=await getChatGPTUser(); if(!user) return Response.json({error:"Требуется вход"},{status:401});
  const body=await request.json() as Record<string,unknown>;
  const tractate=text(body.tractate,100), ref=text(body.ref,100), title=text(body.title,300), translation=text(body.translation), explanation=text(body.explanation), provider=text(body.provider,40)||"AI";
  if(!tractate||!ref||!title||!translation||!explanation) return Response.json({error:"Заполните заголовок, перевод и объяснение"},{status:400});
  const now=new Date().toISOString(), rashi=comments(body.rashi), tosafot=comments(body.tosafot);
  await env.DB.prepare(`INSERT INTO articles (tractate, ref, title, translation, explanation, rashi_json, tosafot_json, provider, author_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tractate, ref) DO UPDATE SET title=excluded.title, translation=excluded.translation, explanation=excluded.explanation, rashi_json=excluded.rashi_json, tosafot_json=excluded.tosafot_json, provider=excluded.provider, author_user_id=excluded.author_user_id, updated_at=excluded.updated_at`).bind(tractate,ref,title,translation,explanation,JSON.stringify(rashi),JSON.stringify(tosafot),provider,user.userId,now,now).run();
  return Response.json({ok:true,article:{ref,title,translation,explanation,rashi,tosafot,provider,createdAt:now,updatedAt:now}});
}
