import { useRef, useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

const NAV_H = 60; // height of the fixed nav bar

export function VideoScrollHero({
  videoSrc = "/hero-video.mp4",
  enableAnimations = true,
  className = "",
  startScale = 0.22,
  title = "Your crops,\nwatched from space",
  subtitle = "AI-powered crop health monitoring for Indian farmers. Detect disease, track vegetation, forecast stress before damage is done.",
}) {
  const containerRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(0); // 0 → 1

  useEffect(() => {
    if (!enableAnimations || shouldReduceMotion) return;

    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollHeight = containerRef.current.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      setProgress(Math.min(scrolled / scrollHeight, 1));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [enableAnimations, shouldReduceMotion]);

  const shouldAnimate = enableAnimations && !shouldReduceMotion;
  const scale  = shouldAnimate ? startScale + progress * (1 - startScale) : 1;
  const radius = Math.round(18 * (1 - progress));

  // fade in over the first 20% of scroll, stay fully visible after
  const textOpacity = shouldAnimate ? Math.min(progress / 0.2, 1) : 1;

  return (
    <div style={{ position: "relative" }} className={className}>
      {/*
        300vh tall scroll container.
        overflow must NOT be set here — that would break position:sticky.
        The parent page wrapper must also have no overflow set.
      */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          height: "300vh",
          background: "linear-gradient(160deg,#1b5e20 0%,#2e7d32 60%,#1a3a1a 100%)",
        }}
      >
        {/* grid texture */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.055, pointerEvents: "none",
          backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }} />

        {/*
          Sticky viewport frame.
          top: NAV_H keeps the sticky area below the fixed nav bar.
          height: calc(100vh - NAV_H) fills the rest of the screen.
          No overflow: hidden — that would also break inner sticky children.
        */}
        <div style={{
          position: "sticky",
          top: NAV_H,
          width: "100%",
          height: `calc(100vh - ${NAV_H}px)`,
          zIndex: 10,
        }}>
          {/*
            Absolute-centered wrapper.
            translate(-50%,-50%) + scale is more reliable than flexbox
            for full-screen expand animations.
          */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "100%",
            height: "100%",
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: "center center",
            transition: "transform 0.05s linear",
            willChange: "transform",
          }}>
            <video
              autoPlay loop muted playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                borderRadius: radius,
                boxShadow: progress < 0.9 ? "0 28px 70px rgba(0,0,0,0.55)" : "none",
                transition: "border-radius 0.05s linear, box-shadow 0.05s linear",
              }}
            >
              <source src={videoSrc} type="video/mp4" />
            </video>

            {/* dark overlay across full video for text legibility */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none",
              background: "rgba(0,0,0,0.38)",
              transition: "border-radius 0.05s linear",
            }} />

            {/* text — centered, fades + slides in on scroll */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              paddingLeft: 32, paddingRight: 32,
              opacity: textOpacity,
              transform: `translateY(${(1 - textOpacity) * 28}px)`,
              transition: "opacity 0.08s linear, transform 0.08s linear",
            }}>
              <div style={{ textAlign: "center", color: "#fff", maxWidth: 700 }}>
                <h1 style={{
                  fontSize: "clamp(32px,5vw,64px)", fontWeight: 900,
                  lineHeight: 1.1, letterSpacing: "-1.5px", margin: "0 0 16px",
                }}>
                  {title.split("\n").map((line, i) => (
                    <span key={i}>
                      {i === 1 ? <span style={{ color: "#69f0ae" }}>{line}</span> : line}
                      {i < title.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </h1>

                <p style={{ fontSize: 17, color: "rgba(67,160,71,0.85)", lineHeight: 1.65, margin: 0 }}>
                  {subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
