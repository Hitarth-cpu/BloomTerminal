import { EarningsTable } from '../../components/financials/EarningsTable';

export default function EarningsPage() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <EarningsTable />
    </div>
  );
}
