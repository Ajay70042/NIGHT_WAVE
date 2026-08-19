/** Marquee text — scrolls on hover if content overflows */
import { useRef, useEffect, useState } from "react";

export default function MarqueeText({ text, className = "" }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const check = () => {
      if (containerRef.current && textRef.current) {
        setOverflows(textRef.current.scrollWidth > containerRef.current.offsetWidth);
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text]);

  return (
    <div ref={containerRef} className={`marquee-container ${className}`}>
      <span
        ref={textRef}
        className={`marquee-text${overflows ? " overflowing" : ""}`}
        style={overflows ? { paddingRight: "2rem" } : {}}
      >
        {text}
        {overflows && <span aria-hidden="true" style={{ paddingLeft: "2rem" }}>{text}</span>}
      </span>
    </div>
  );
}
