import { renderAgentPage } from "../agents/agent-page";

export const dynamic = "force-dynamic";

export default async function SelenePage() {
  return renderAgentPage("selene");
}
