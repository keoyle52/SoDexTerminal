import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { ChartPanel } from '../chart/ChartPanel';
import { OrderBookPanel } from '../orderbook/OrderBookPanel';
import { OrderForm } from '../trading/OrderForm';
import { PortfolioPanel } from '../portfolio/PortfolioPanel';
import { OpenOrdersTable } from '../orders/OpenOrdersTable';
import { RiskPanel } from '../risk/RiskPanel';
import { useSettingsStore } from '../../store/settingsStore';
import { GripVertical } from 'lucide-react';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'chart', x: 0, y: 0, w: 9, h: 10, minW: 6, minH: 8 },
    { i: 'orderbook', x: 9, y: 0, w: 3, h: 10, minW: 2, minH: 5 },
    { i: 'orderform', x: 12, y: 0, w: 3, h: 14, minW: 2, minH: 10 },
    { i: 'portfolio', x: 0, y: 10, w: 4, h: 4, minW: 3, minH: 3 },
    { i: 'orders', x: 4, y: 10, w: 8, h: 4, minW: 4, minH: 3 },
  ],
  md: [
    { i: 'chart', x: 0, y: 0, w: 7, h: 9 },
    { i: 'orderbook', x: 7, y: 0, w: 3, h: 5 },
    { i: 'orderform', x: 7, y: 5, w: 3, h: 11 },
    { i: 'portfolio', x: 0, y: 9, w: 3, h: 7 },
    { i: 'orders', x: 3, y: 9, w: 4, h: 7 },
  ]
};

export const Terminal: React.FC = () => {
  const { gridLayout, updateLayout } = useSettingsStore();

  const handleLayoutChange = (layout: any) => {
    updateLayout(layout);
  };

  const currentLayouts = gridLayout && gridLayout.length > 0 ? { lg: gridLayout, md: gridLayout } : DEFAULT_LAYOUTS;

  const PanelWrapper = ({ id, children }: { id: string, children: React.ReactNode }) => (
    <div key={id} className="flex flex-col bg-[#111318] border border-[#1e2028] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden relative group transition-all duration-300 hover:border-[#4285f4]/30">
      <div className="absolute top-0 right-0 h-10 w-10 cursor-grab active:cursor-grabbing drag-handle z-[100] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
        <div className="p-1.5 bg-[#4285f4]/10 rounded-lg border border-[#4285f4]/20 shadow-[0_0_10px_rgba(66,133,244,0.2)]">
          <GripVertical size={14} className="text-[#4285f4]" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );

  return (
    <div className="flex-1 w-full flex flex-col bg-[#0a0b0d] overflow-x-hidden min-h-[calc(100vh-56px)] select-none">
      
      {/* Risk Panel Global Control Bar */}
      <div className="w-full px-6 pt-5 pb-2 max-w-[2400px] mx-auto hidden lg:block animate-in fade-in slide-in-from-top-4 duration-700">
        <RiskPanel />
      </div>

      <div className="w-full h-full flex-1 px-4 pb-6 max-w-[2400px] mx-auto z-10 relative">
        <ResponsiveGridLayout
          className="layout"
          layouts={currentLayouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 15, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={50}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          margin={[16, 16]}
          useCSSTransforms={true}
          resizeHandle={
            <div className="react-resizable-handle react-resizable-handle-se absolute bottom-1.5 right-1.5 w-3 h-3 cursor-se-resize flex items-end justify-end opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all duration-300">
              <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-[#4285f4] rounded-br-[1px]" />
            </div>
          }
        >
          <div key="chart">
            <PanelWrapper id="chart">
              <ChartPanel />
            </PanelWrapper>
          </div>

          <div key="orderbook">
            <PanelWrapper id="orderbook">
              <OrderBookPanel />
            </PanelWrapper>
          </div>

          <div key="orderform">
            <PanelWrapper id="orderform">
              <OrderForm />
            </PanelWrapper>
          </div>

          <div key="portfolio">
            <PanelWrapper id="portfolio">
              <PortfolioPanel />
            </PanelWrapper>
          </div>

          <div key="orders">
            <PanelWrapper id="orders">
              <OpenOrdersTable />
            </PanelWrapper>
          </div>
        </ResponsiveGridLayout>
      </div>

      <style>{`
        .react-resizable-handle::after {
          content: none !important;
        }
        .react-grid-placeholder {
          background: rgba(66, 133, 244, 0.05) !important;
          border-radius: 12px !important;
          border: 2px dashed rgba(66, 133, 244, 0.2) !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};
