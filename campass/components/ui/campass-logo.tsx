import { Outfit } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["800"],
});

type CampassLogoProps = {
  size?: number;
  animated?: boolean;
  ariaHidden?: boolean;
  className?: string;
};

export function CampassLogo({
  size = 36,
  animated = false,
  ariaHidden = false,
  className = "",
}: CampassLogoProps) {
  return (
    <svg
      viewBox="16 16.5 68 68"
      width={size}
      height={size}
      className={className}
      role={ariaHidden ? undefined : "img"}
      aria-label={ariaHidden ? undefined : "CAMPASS 로고"}
      aria-hidden={ariaHidden || undefined}
    >
      <circle
        cx="50"
        cy="50.5"
        r="24.5"
        fill="#ffffff"
        stroke="#0060fc"
        strokeWidth="4.8"
      />

      <circle
        cx="50"
        cy="50.5"
        r="19.6"
        fill="none"
        stroke="#0060fc"
        strokeOpacity="0.35"
        strokeWidth="0.9"
      />

      <g
        stroke="#0060fc"
        strokeOpacity="0.6"
        strokeLinecap="round"
        strokeWidth="1.5"
      >
        <path d="M64.07 36.43L65.77 34.73" />
        <path d="M64.07 64.57L65.77 66.27" />
        <path d="M35.93 64.57L34.23 66.27" />
        <path d="M35.93 36.43L34.23 34.73" />
      </g>

      <text
        x="50"
        y="33.6"
        textAnchor="middle"
        fontFamily="Outfit, sans-serif"
        fontSize="6.2"
        fontWeight="800"
        fill="#0060fc"
      >
        N
      </text>

      <g
        stroke="#0060fc"
        strokeWidth="3.8"
        strokeLinecap="round"
      >
        <path d="M50 20.5v5.5" />
        <path d="M50 75v5.5" />
        <path d="M19.5 50.5h5.5" />
        <path d="M75 50.5h5.5" />
      </g>

      <g className={animated ? "campass-logo-needle animated" : "campass-logo-needle"}>
        <polygon
          points="63.4,37.1 45.8,46.3 54.2,54.7"
          fill="#0060fc"
        />

        <polygon
          points="36.6,63.9 45.8,46.3 54.2,54.7"
          fill="#9cc0ff"
        />

        <circle
          cx="50"
          cy="50.5"
          r="3.4"
          fill="#ffffff"
          stroke="#0060fc"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}



type CampassWordmarkProps = {
  size?: number;
  className?: string;
};

export function CampassWordmark({
  size = 25,
  className = "",
}: CampassWordmarkProps) {
  return (
    <span
      className={`${outfit.className} campass-wordmark ${className}`}
      style={{ fontSize: `${size}px` }}
      aria-label="CAMPASS"
    >
      <span className="campass-wordmark-cam">CAM</span>
      <span className="campass-wordmark-pass">PASS</span>
    </span>
  );
}