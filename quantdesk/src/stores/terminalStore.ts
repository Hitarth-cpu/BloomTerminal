import { create } from 'zustand';
import type { ActiveModule, TimeRange } from '../types';

interface TerminalState {
  activeModule: ActiveModule;
  activeTicker: string;
  timeRange: TimeRange;
  activePanel: string;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  askbOpen: boolean;
  ibChatOpen: boolean;
  alerts: { id: string; message: string; severity: 'CRITICAL' | 'WARNING' | 'INFO'; timestamp: number }[];

  setActiveModule: (m: ActiveModule) => void;
  setActiveTicker: (t: string) => void;
  setTimeRange: (r: TimeRange) => void;
  setActivePanel: (p: string) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  toggleAskb: () => void;
  toggleIbChat: () => void;
  addAlert: (msg: string, severity?: 'CRITICAL' | 'WARNING' | 'INFO') => void;
  dismissAlert: (id: string) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  activeModule: 'markets',
  activeTicker: 'AAPL',
  timeRange: '1Y',
  activePanel: 'market-data',
  sidebarCollapsed: false,
  rightPanelOpen: true,
  askbOpen: false,
  ibChatOpen: false,
  alerts: [],

  setActiveModule: (activeModule) => set({ activeModule }),
  setActiveTicker: (activeTicker) => set({ activeTicker }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setActivePanel: (activePanel) => set({ activePanel }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleAskb: () => set((s) => ({ askbOpen: !s.askbOpen })),
  toggleIbChat: () => set((s) => ({ ibChatOpen: !s.ibChatOpen })),
  addAlert: (message, severity = 'INFO') => set((s) => ({
    alerts: [{ id: Date.now().toString(), message, severity, timestamp: Date.now() }, ...s.alerts].slice(0, 20),
  })),
  dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter(a => a.id !== id) })),
}));
