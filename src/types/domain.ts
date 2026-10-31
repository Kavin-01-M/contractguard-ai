export type Severity = "Critical" | "High" | "Medium" | "Low";
export type TaskStatus =
  | "Open"
  | "In Progress"
  | "Awaiting Review"
  | "Resolved";
export interface Citation {
  id?: string;
  document_id?: string;
  document_name: string;
  role: "contract" | "policy";
  quote: string;
  page_number: number | null;
  section: string | null;
  explanation: string;
}
export interface Obligation {
  id: string;
  description: string;
  responsible_party: string;
  required_action: string;
  action_object: string;
  trigger_event: string;
  deadline_duration: number | null;
  deadline_unit: string | null;
  absolute_deadline: string | null;
  category: string;
  consequence: string | null;
  document_id: string;
  document_name: string;
  source_page: number | null;
  source_section: string | null;
  exact_quote: string;
  confidence: number;
  review_status: string;
  is_demo: boolean;
}
export interface DocumentRecord {
  id: string;
  file_name: string;
  document_type: string;
  mime_type: string;
  upload_date: string;
  processing_status: string;
  extraction_status: string;
  page_count: number | null;
  version: number;
  organization_id: string;
  is_demo: boolean;
  text_length: number;
  extracted_text?: string;
  clauses?: Array<{
    id: string;
    text: string;
    page_number: number | null;
    section: string | null;
    is_policy: boolean;
  }>;
  obligations?: Obligation[];
}
export interface Finding {
  id: string;
  category: string;
  title: string;
  explanation: string;
  severity: Severity;
  score: number;
  confidence: number;
  status: string;
  suggested_action: string;
  assigned_owner: string;
  created_at: string;
  is_demo: boolean;
  obligation?: Obligation | null;
  citations: Citation[];
}
export interface Deadline {
  id: string;
  title: string;
  obligation_id: string;
  due_date: string | null;
  trigger_date: string | null;
  reminder_days: number;
  owner: string;
  status: string;
  document_name: string;
  quote: string;
  source_section: string | null;
  is_demo: boolean;
}
export interface Task {
  id: string;
  finding_id: string | null;
  title: string;
  description: string;
  owner: string;
  due_date: string | null;
  priority: Severity;
  status: TaskStatus;
  comments: Array<{ author: string; text: string; at: string }>;
  resolution_notes: string | null;
  created_at: string;
}
export interface AuditEvent {
  id: string;
  actor_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
export interface GraphNode {
  id: string;
  type: string;
  label: string;
  is_demo?: boolean;
  severity?: Severity;
  document_type?: string;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  explanation?: string;
}
export interface Bootstrap {
  organization: { id: string; name: string };
  user: { open_id: string; name: string; email?: string; demo: boolean };
  summary: {
    contracts_analyzed: number;
    obligations: number;
    open_findings: number;
    high_risks: number;
    upcoming_deadlines: number;
    awaiting_review: number;
  };
  risk_distribution: Array<{ name: string; value: number }>;
  obligations_by_category: Array<{ name: string; value: number }>;
  deadlines: Deadline[];
  recent_findings: Finding[];
  recent_documents: DocumentRecord[];
  recent_activity: AuditEvent[];
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    created_at: string;
  }>;
  demo_mode: boolean;
  has_data: boolean;
}
