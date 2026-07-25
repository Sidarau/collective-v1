import { renderAgentPage } from "../agents/agent-page";

export const dynamic = "force-dynamic";

export default async function CollectaPage() {
  return renderAgentPage("collecta");
}
