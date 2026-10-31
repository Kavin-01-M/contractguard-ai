import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowUpRight, FileText, GitBranch, Info } from "lucide-react";
import { api } from "../lib/api";
import type { GraphEdge, GraphNode } from "../types/domain";
import {
  Badge,
  EmptyState,
  PageHeading,
  SeverityBadge,
} from "../components/Primitives";

const color: Record<string, string> = {
  document: "#e8edf7",
  clause: "#edf1f7",
  policy: "#eef5f2",
  obligation: "#e9edff",
  finding: "#fff1e8",
  action: "#f0f5fa",
};
const nodeTitle: Record<string, string> = {
  document: "Document",
  clause: "Contract clause",
  policy: "Policy clause",
  obligation: "Obligation",
  finding: "Finding",
  action: "Recommended action",
};

type FlowNode = Node<{ label: ReactNode }>;

export default function Intelligence() {
  const { data, isLoading } = useQuery({
    queryKey: ["graph"],
    queryFn: api.graph,
  });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [type, setType] = useState("All");
  const [risk, setRisk] = useState("All");
  const [edgeInfo, setEdgeInfo] = useState("");
  const allNodes: GraphNode[] = data?.nodes ?? [];
  const allEdges: GraphEdge[] = data?.edges ?? [];
  const filtered = useMemo(
    () =>
      allNodes.filter(
        (n) =>
          (type === "All" || n.type === type) &&
          (risk === "All" || n.type !== "finding" || n.severity === risk),
      ),
    [allNodes, type, risk],
  );
  const flowNodes: FlowNode[] = useMemo(
    () =>
      filtered.map((n) => {
        const groups = [
          "document",
          "clause",
          "obligation",
          "policy",
          "finding",
          "action",
        ];
        const x = groups.indexOf(n.type) * 255;
        const y =
          filtered
            .filter((other) => other.type === n.type)
            .findIndex((other) => other.id === n.id) * 125;
        return {
          id: n.id,
          position: { x, y },
          data: {
            label: (
              <div className="graph-node-content">
                <span className="graph-node-type">
                  {nodeTitle[n.type] || n.type}
                  {n.is_demo ? " · DEMO" : ""}
                </span>
                <strong>{n.label}</strong>
                {n.severity && (
                  <span
                    className={`graph-severity ${n.severity.toLowerCase()}`}
                  >
                    {n.severity}
                  </span>
                )}
              </div>
            ),
          },
          style: {
            width: 218,
            minHeight: 78,
            border: `1px solid ${n.type === "finding" ? "#f1c5a8" : "#dde4ee"}`,
            background: color[n.type] || "#fff",
            borderRadius: 9,
            boxShadow: "0 2px 8px rgba(20,36,59,.05)",
            padding: 10,
            fontSize: 12,
          },
        };
      }),
    [filtered],
  );
  const flowEdges: Edge[] = useMemo(() => {
    const ids = new Set(filtered.map((n) => n.id));
    return allEdges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: e.label.includes("CONFLICT"),
        style: {
          stroke: e.label.includes("CONFLICT") ? "#cf5e53" : "#9cabc1",
          strokeWidth: 1.5,
        },
        labelStyle: { fontSize: 9, fill: "#64748b" },
        labelBgStyle: { fill: "#fff", fillOpacity: 0.92 },
        type: "smoothstep",
      }));
  }, [allEdges, filtered]);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="CROSS-DOCUMENT ANALYSIS"
        title="Compliance Intelligence"
        description="Stored relationships connect source documents, extracted duties, policy clauses, findings, and follow-up actions."
      />
      <div className="graph-toolbar">
        <div>
          <GitBranch size={16} />
          <strong>{flowNodes.length} nodes</strong>
          <span>·</span>
          <strong>{flowEdges.length} relationships</strong>
          <Badge tone="neutral">Data-backed graph</Badge>
        </div>
        <div className="graph-filters">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="All">All node types</option>
            {Object.entries(nodeTitle).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
          <select value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option>All</option>
            {["Critical", "High", "Medium", "Low"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="graph-layout">
        <div className="graph-canvas">
          {!isLoading && flowNodes.length === 0 ? (
            <EmptyState
              title="No stored relationships yet"
              description="Load synthetic demo data or analyze a contract against an internal policy to create the graph."
            />
          ) : (
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              fitView
              minZoom={0.35}
              maxZoom={1.6}
              onNodeClick={(_, node) => {
                setSelected(allNodes.find((n) => n.id === node.id) || null);
                setEdgeInfo("");
              }}
              onEdgeClick={(_, edge) =>
                setEdgeInfo(
                  allEdges.find((e) => e.id === edge.id)?.explanation ||
                    `Stored relationship: ${edge.label || "link"}.`,
                )
              }
            >
              <Background color="#e8edf4" gap={20} />
              <MiniMap
                nodeColor={(node) =>
                  color[
                    allNodes.find((item) => item.id === node.id)?.type || ""
                  ] || "#dde4ee"
                }
                maskColor="rgba(245,247,250,.7)"
              />
              <Controls />
            </ReactFlow>
          )}
        </div>
        <aside className="graph-inspector">
          <div className="inspector-head">
            <span className="eyebrow">INSPECTOR</span>
            {selected && (
              <button onClick={() => setSelected(null)}>Clear</button>
            )}
          </div>
          {edgeInfo ? (
            <div className="graph-inspector-content">
              <Info size={17} />
              <h3>Relationship rationale</h3>
              <p>{edgeInfo}</p>
              <small>
                Semantic or lexical similarity is a retrieval signal, not proof
                of compliance.
              </small>
            </div>
          ) : selected ? (
            <div className="graph-inspector-content">
              <Badge tone="info">
                {nodeTitle[selected.type] || selected.type}
              </Badge>
              <h3>{selected.label}</h3>
              {selected.severity && (
                <SeverityBadge severity={selected.severity} />
              )}
              <p>
                Click a connected edge to inspect why the relationship was
                stored.
              </p>
              {selected.id.startsWith("finding:") && (
                <Link
                  to={`/findings/${selected.id.slice(8)}`}
                  className="text-link"
                >
                  Open finding evidence <ArrowUpRight size={13} />
                </Link>
              )}
              {selected.id.startsWith("doc:") && (
                <Link
                  to={`/documents/${selected.id.slice(4)}`}
                  className="text-link"
                >
                  <FileText size={14} />
                  Open source document <ArrowUpRight size={13} />
                </Link>
              )}
            </div>
          ) : (
            <div className="graph-inspector-empty">
              <span>
                <Info size={17} />
              </span>
              <b>Select a node or relationship</b>
              <p>
                Inspect document, obligation, policy, finding, or action
                evidence.
              </p>
            </div>
          )}
          <div className="graph-legend">
            <span>NODE TYPES</span>
            {Object.entries(nodeTitle).map(([key, label]) => (
              <div key={key}>
                <i style={{ background: color[key] }} />
                {label}
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div className="graph-footnote">
        The graph is generated from stored records. An absent edge does not
        establish that no relationship exists.
      </div>
    </div>
  );
}
