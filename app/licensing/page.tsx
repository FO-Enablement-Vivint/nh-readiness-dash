/**
 * The pro's licences and what is pending on each. Session handling lives in
 * PageGate.
 */
import PageGate from '@/components/PageGate';
import Licensing from '@/Licensing';

export default function Page() {
  return (
    <PageGate>
      <Licensing />
    </PageGate>
  );
}
