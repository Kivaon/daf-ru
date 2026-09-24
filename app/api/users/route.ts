import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { registerAndGetRole } from "../../roles";

export async function GET(){
  const user=await getChatGPTUser(), role=await registerAndGetRole(user);
  if(role!=="admin")return Response.json({error:"Недостаточно прав"},{status:403});
  const rows=(await env.DB.prepare("SELECT user_id AS userId,email,name,role,created_at AS createdAt,updated_at AS updatedAt FROM users ORDER BY created_at DESC").all()).results;
  return Response.json({users:rows});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser(), role=await registerAndGetRole(user);
  if(role!=="admin")return Response.json({error:"Недостаточно прав"},{status:403});
  const body=await request.json() as {userId?:unknown;role?:unknown};
  const userId=typeof body.userId==="string"?body.userId:"", nextRole=body.role;
  if(!userId||(nextRole!=="reader"&&nextRole!=="editor"))return Response.json({error:"Некорректные данные"},{status:400});
  await env.DB.prepare("UPDATE users SET role = ?, updated_at = ? WHERE user_id = ? AND role != 'admin'").bind(nextRole,new Date().toISOString(),userId).run();
  return Response.json({ok:true,userId,role:nextRole});
}
