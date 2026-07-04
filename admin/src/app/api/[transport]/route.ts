import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { buildKbTree, getKbNode, listKbNodes, searchKb, upsertKbNode } from "@core/kb";
import { requireAgentOrAdmin } from "@/lib/agent-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * MCP endpoint for agents (Claude, Hermes, Codex…): the Collective knowledge
 * base as tools, so the swarm can read and write SOPs without the console UI.
 * Auth: Authorization: Bearer AGENT_API_TOKEN (see Settings).
 */
const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "kb_tree",
      {
        title: "Knowledge base tree",
        description:
          "Full Collective OS knowledge-base tree (folders and docs with ids, titles, visibility). Bodies are omitted — fetch a doc with kb_get.",
        inputSchema: {},
      },
      async () => {
        const nodes = await listKbNodes();
        const strip = (list: ReturnType<typeof buildKbTree>): unknown[] =>
          list.map((n) => ({
            id: n.id,
            kind: n.kind,
            title: n.title,
            visibility: n.visibility,
            children: strip(n.children),
          }));
        return {
          content: [{ type: "text", text: JSON.stringify(strip(buildKbTree(nodes)), null, 2) }],
        };
      }
    );

    server.registerTool(
      "kb_get",
      {
        title: "Read a knowledge-base doc",
        description: "Fetch one KB node by id, including its markdown body.",
        inputSchema: { id: z.string().uuid() },
      },
      async ({ id }) => {
        const node = await getKbNode(id);
        if (!node) return { content: [{ type: "text", text: "Not found" }], isError: true };
        return {
          content: [
            {
              type: "text",
              text: `# ${node.title}\n(id: ${node.id} · ${node.kind} · visibility: ${node.visibility})\n\n${node.body_md}`,
            },
          ],
        };
      }
    );

    server.registerTool(
      "kb_search",
      {
        title: "Search the knowledge base",
        description: "Case-insensitive search over titles and bodies. Returns matching nodes.",
        inputSchema: { query: z.string().min(2) },
      },
      async ({ query }) => {
        const nodes = await searchKb(query);
        return {
          content: [
            {
              type: "text",
              text: nodes.length
                ? nodes.map((n) => `- ${n.title} (id: ${n.id}, ${n.kind}, ${n.visibility})`).join("\n")
                : "No matches.",
            },
          ],
        };
      }
    );

    server.registerTool(
      "kb_upsert",
      {
        title: "Create or update a knowledge-base doc",
        description:
          "Create a doc/folder (omit id) or update one (pass id). Markdown body. visibility: internal | staff | members.",
        inputSchema: {
          id: z.string().uuid().optional(),
          title: z.string().optional(),
          bodyMd: z.string().optional(),
          parentId: z.string().uuid().nullable().optional(),
          kind: z.enum(["folder", "doc"]).optional(),
          visibility: z.enum(["internal", "staff", "members"]).optional(),
        },
      },
      async (input) => {
        const node = await upsertKbNode(input);
        return {
          content: [{ type: "text", text: `Saved "${node.title}" (id: ${node.id})` }],
        };
      }
    );
  },
  {},
  {
    basePath: "/api", // route lives at app/api/[transport] → endpoint is /api/mcp
    maxDuration: 60,
  }
);

async function authed(req: Request) {
  const denied = await requireAgentOrAdmin(req);
  if (denied) return denied;
  return handler(req);
}

export { authed as GET, authed as POST, authed as DELETE };
