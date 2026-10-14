export type Mode = 'DEBUG' | 'DEV' | 'CREATE';

export interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  logo?: string | null;
  screenshot?: string | null;
  timestamp: number;
  description?: string;
  messages?: ChatMessage[];
}

export interface ProjectFile {
  name: string;
  path: string;
  content: string;
  type: 'file' | 'directory';
  encoding?: 'base64';
  children?: ProjectFile[];
}

export interface DebugIssue {
  id: string;
  file: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
  action?: 'replace' | 'insert' | 'delete';
  target?: string;
  replacement?: string;
  oldCode?: string;
  newCode?: string;
  startLine?: number;
  endLine?: number;
  status: 'pending' | 'applied' | 'rejected';
}

export interface AnalysisResult {
  framework: string;
  packageManager: string;
  issues: DebugIssue[];
  structure: ProjectFile[];
}

export interface AIFileChange {
  path: string;
  content: string;
}

export interface Attachment {
  name: string;
  type: string;
  data: string; // base64 for images/videos, text for documents
  url?: string; // for previewing
}

export type AgentState = 'IDLE' | 'DREAMING' | 'BLUEPRINTING' | 'COOKING' | 'TASTING' | 'VERIFYING';

export interface ImplementationStep {
  id: number;
  task: string;
  tool: 'npm_install' | 'write_file' | 'edit_file' | 'shell_exec' | 'read_file' | 'search';
  status: 'todo' | 'pending' | 'completed' | 'failed' | 'in_progress';
}

export interface ConflictDetection {
  file: string;
  issue: string;
  resolution: string;
}

export interface MasterImplementationPlan {
  project_id: string;
  phase: 'Blueprinting' | 'Executing' | 'Validation';
  objectives: string[];
  architecture_summary: string;
  conflict_detection?: ConflictDetection[];
  implementation_steps: ImplementationStep[];
  validation: string;
  impact_report?: {
    category: string;
    action: string;
  }[];
}

export interface Activity {
  id: string;
  type: 'thought' | 'read' | 'write' | 'command' | 'search' | 'analysis';
  label: string;
  content?: string;
  duration?: number;
  status: 'pending' | 'completed' | 'failed';
  path?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestions?: DebugIssue[];
  changes?: AIFileChange[];
  attachment?: Attachment;
  failedImagePrompt?: string;
  imageFileName?: string;
  isGeneratingImage?: boolean;
  imagePrompt?: string;
  imageUrl?: string;
  commands?: string[];
  plan?: string;
  executableCode?: string;
  executionResult?: string;
  feedback?: 'positive' | 'negative';
  researchSources?: { title: string; link: string; snippet?: string }[];
  integrityCheck?: {
    status: 'checking' | 'passed' | 'failed';
    items: { label: string; passed: boolean; details?: string }[];
  };
  thought?: string;
  activeTool?: { type: string; label: string };
  agentState?: AgentState;
  thoughtDuration?: number;
  isStreaming?: boolean;
  activities?: Activity[];
  userPrompt?: string;
  implementationPlan?: string;
  mip?: MasterImplementationPlan;
  blueprint?: {
    plans: {
      id: 'A' | 'B' | 'C';
      title: string;
      description: string;
      architecture: string;
      design_language: string;
      external_apis: { name: string; protocol: string; endpoint: string }[];
      file_tree: any;
      steps: string[];
    }[];
    selectedPlanId?: 'A' | 'B' | 'C';
  };
}
export interface DocumentInfo {
  id: string;
  title: string;
  content: string;
  type: 'md' | 'pdf';
  timestamp: Date;
}
