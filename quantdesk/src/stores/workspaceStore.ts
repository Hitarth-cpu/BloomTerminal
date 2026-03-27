import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace, ComparisonTable } from '../services/api/researchApi';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isGenerating: boolean;
  promptHistory: string[];
  setWorkspaces: (ws: Workspace[]) => void;
  setActiveWorkspace: (id: string | null) => void;
  setGenerating: (v: boolean) => void;
  addPrompt: (p: string) => void;
  updateWorkspaceTable: (id: string, table: ComparisonTable) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: [],
      activeWorkspaceId: null,
      isGenerating: false,
      promptHistory: [],
      setWorkspaces: (workspaces) => set({ workspaces }),
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
      setGenerating: (isGenerating) => set({ isGenerating }),
      addPrompt: (p) => set(s => ({ promptHistory: [p, ...s.promptHistory.slice(0, 49)] })),
      updateWorkspaceTable: (id, table) => set(s => ({
        workspaces: s.workspaces.map(w => w.id === id ? { ...w, table_data: table } : w),
      })),
    }),
    { name: 'workspace-store' },
  ),
);
