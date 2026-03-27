import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useTerminalStore } from '../../stores/terminalStore';
import { PriceChart } from '../charts/PriceChart';
import { PerformersTable } from '../tables/PerformersTable';
import { SecurityHeader } from './SecurityHeader';
import { MarketOverview } from '../market/MarketOverview';

export function MarketDataPanel() {
  const { activeTicker } = useTerminalStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SecurityHeader />
      <div style={{ flex: 1, minHeight: 0 }}>
        <PanelGroup orientation="horizontal">
          {/* Main Charts */}
          <Panel defaultSize={72} minSize={50}>
            <PanelGroup orientation="vertical">
              {/* Top row: 2 charts */}
              <Panel defaultSize={50} minSize={30}>
                <PanelGroup orientation="horizontal">
                  <Panel defaultSize={50} minSize={30}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)' }}>
                      <div className="panel-header">
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{activeTicker}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>Price Chart</span>
                      </div>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <PriceChart ticker={activeTicker} />
                      </div>
                    </div>
                  </Panel>
                  <PanelResizeHandle style={{ width: 3, background: 'var(--bg-border)', cursor: 'col-resize' }} />
                  <Panel defaultSize={50} minSize={30}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)' }}>
                      <div className="panel-header">
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>NVDA</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>vs SPX</span>
                      </div>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <PriceChart ticker="NVDA" />
                      </div>
                    </div>
                  </Panel>
                </PanelGroup>
              </Panel>
              <PanelResizeHandle style={{ height: 3, background: 'var(--bg-border)', cursor: 'row-resize' }} />
              {/* Bottom row: 2 charts */}
              <Panel defaultSize={50} minSize={30}>
                <PanelGroup orientation="horizontal">
                  <Panel defaultSize={50} minSize={30}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)' }}>
                      <div className="panel-header">
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>MSFT</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>Price Chart</span>
                      </div>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <PriceChart ticker="MSFT" showVolume={false} />
                      </div>
                    </div>
                  </Panel>
                  <PanelResizeHandle style={{ width: 3, background: 'var(--bg-border)', cursor: 'col-resize' }} />
                  <Panel defaultSize={50} minSize={30}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-tertiary)', border: '1px solid var(--bg-border)' }}>
                      <div className="panel-header">
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>SPX</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>S&P 500 Index</span>
                      </div>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <PriceChart ticker="SPX" showVolume={false} />
                      </div>
                    </div>
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle style={{ width: 3, background: 'var(--bg-border)', cursor: 'col-resize' }} />

          {/* Right: Market Overview + Performers */}
          <Panel defaultSize={28} minSize={20}>
            <PanelGroup orientation="vertical">
              <Panel defaultSize={45} minSize={25}>
                <div style={{ height: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', overflow: 'hidden' }}>
                  <MarketOverview />
                </div>
              </Panel>
              <PanelResizeHandle style={{ height: 3, background: 'var(--bg-border)', cursor: 'row-resize' }} />
              <Panel defaultSize={55} minSize={25}>
                <div style={{ height: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--bg-border)', overflow: 'hidden' }}>
                  <PerformersTable />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
