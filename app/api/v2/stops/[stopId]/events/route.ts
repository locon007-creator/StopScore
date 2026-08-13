import { workflowHttpHandlers } from "../../../../../v2/server/http-runtime";

type RouteContext = { params: Promise<{ stopId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { stopId } = await context.params;
  return workflowHttpHandlers.postStopEvent(request, stopId);
}
