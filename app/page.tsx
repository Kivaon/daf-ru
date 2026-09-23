import HomeClient from "./HomeClient";
import { requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireChatGPTUser("/");
  return <HomeClient user={{ name:user.displayName, email:user.email }} />;
}
