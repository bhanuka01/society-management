import React from "react";

/**
 * AdssAiIcon
 *
 * Bespoke precision-crafted emblem for ADSS Portal AI Assistant.
 * Blends Data Science network topology (nodes & connections) with a
 * radiant intelligence core, styled with the Linear Acid Lime (#e4f222) accent.
 */
export default function AdssAiIcon({
  size = 20,
  className = "",
  variant = "brand", // 'brand' | 'monochrome' | 'glow'
  animate = false,
  style = {},
}) {
  const accentColor = variant === "monochrome" ? "currentColor" : "#e4f222";
  const mutedColor = variant === "monochrome" ? "currentColor" : "#8a8f98";
  const glowFilter = variant === "glow" ? "drop-shadow(0 0 6px rgba(228, 242, 34, 0.4))" : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`adss-ai-icon ${animate ? "adss-ai-icon--pulse" : ""} ${className}`}
      style={{
        filter: glowFilter,
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    >
      {/* Outer Hexagonal Data Constellation (Muted Data Nodes) */}
      <circle cx="12" cy="2.5" r="1.25" fill={mutedColor} fillOpacity="0.5" />
      <circle cx="20.2" cy="7.25" r="1.25" fill={mutedColor} fillOpacity="0.5" />
      <circle cx="20.2" cy="16.75" r="1.25" fill={mutedColor} fillOpacity="0.5" />
      <circle cx="12" cy="21.5" r="1.25" fill={mutedColor} fillOpacity="0.5" />
      <circle cx="3.8" cy="16.75" r="1.25" fill={mutedColor} fillOpacity="0.5" />
      <circle cx="3.8" cy="7.25" r="1.25" fill={mutedColor} fillOpacity="0.5" />

      {/* Hairline Data Rays Connecting Outer Orbit to Core */}
      <line x1="12" y1="3.75" x2="12" y2="7.5" stroke={mutedColor} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="1.5 1.5" />
      <line x1="12" y1="16.5" x2="12" y2="20.25" stroke={mutedColor} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="1.5 1.5" />
      <line x1="4.8" y1="8" x2="8.5" y2="10.5" stroke={mutedColor} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="1.5 1.5" />
      <line x1="19.2" y1="16" x2="15.5" y2="13.5" stroke={mutedColor} strokeWidth="1" strokeOpacity="0.3" strokeDasharray="1.5 1.5" />

      {/* Core Intelligence Star — Precision 4-point Diamond Nucleus */}
      <path
        d="M12 4.5 C12 8.6 15.4 12 19.5 12 C15.4 12 12 15.4 12 19.5 C12 15.4 8.6 12 4.5 12 C8.6 12 12 8.6 12 4.5 Z"
        fill={accentColor}
      />

      {/* Central Core Singularity Node */}
      <circle cx="12" cy="12" r="1.75" fill="#08090a" />
      <circle cx="12" cy="12" r="0.75" fill="#ffffff" />
    </svg>
  );
}
