import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  return Response.json({
    user: user
      ? { displayName: user.displayName, email: user.email }
      : null,
  });
}
