import { getD1Database } from "../../../db";
import { getChatGPTUser } from "../../chatgpt-auth";
import { D1WorkdayRepository } from "./d1-workday-repository";
import { createWorkflowHttpHandlers } from "./http";

export const workflowHttpHandlers = createWorkflowHttpHandlers({
  authenticate: async () => {
    const user = await getChatGPTUser();
    return user ? { email: user.email } : null;
  },
  createRepository: async () => new D1WorkdayRepository(await getD1Database()),
});
