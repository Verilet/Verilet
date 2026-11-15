import type { ReactNode } from 'react';
import { useInView } from '../lib/useInView';

/** Fades its content up the first time it scrolls into view. */
export default function Reveal({ children }: { children: ReactNode }) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div className="reveal" ref={ref} data-shown={inView ? 'true' : 'false'}>
      {children}
    </div>
  );
}
