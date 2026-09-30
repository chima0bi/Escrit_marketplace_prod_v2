import { useEffect, useRef, useState } from 'react';

export default function Reveal({ as = 'div', children, className = '', delay = 0, ...props }) {
  const Element = as;
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <Element ref={ref} {...props} className={`reveal-on-scroll ${visible ? 'is-revealed' : ''} ${className}`} style={{ ...props.style, '--reveal-delay': `${delay}ms` }}>{children}</Element>;
}
