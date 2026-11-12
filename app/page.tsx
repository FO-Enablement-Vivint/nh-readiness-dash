/**
 * The New Hire "My Readiness" page. Session handling lives in PageGate.
 */
import PageGate from '@/components/PageGate';
import MyReadiness from '@/MyReadiness';

export default function Page() {
  return (
    <PageGate>
      <MyReadiness />
    </PageGate>
  );
}
