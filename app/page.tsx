import HomeClient from "./HomeClient";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import { registerAndGetRole } from "./roles";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getChatGPTUser();
  const role=await registerAndGetRole(user);
  return <HomeClient user={user?{name:user.displayName,email:user.email,role}:null} signInHref={chatGPTSignInPath("/")} signOutHref={chatGPTSignOutPath("/")} />;
}
