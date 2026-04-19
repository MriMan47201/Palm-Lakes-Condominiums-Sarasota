import { useEffect, useRef } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();

export function emitScrollTop() {
  listeners.forEach((fn) => fn());
}

export function useScrollTopListener(cb: Listener) {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  useEffect(() => {
    const fn = () => cbRef.current();
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
}
