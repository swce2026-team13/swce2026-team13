"use client";
import { useId, type ReactNode, type SVGProps } from "react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: number;
};

function Svg({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

// 선 아이콘은 글자 색을 따름
function Line({ d, ...props }: IconProps & { d: string }) {
  return (
    <Svg {...props}>
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 채움 아이콘은 그라데이션 색을 그대로 씀. 한 화면에 여러 개 있어도 id가 겹치지 않게 함
function Filled({
  children,
  ...props
}: IconProps & { children: (fill: string, stroke: string) => ReactNode }) {
  const id = `icon${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <Svg {...props}>
      <g strokeLinecap="round" strokeLinejoin="round">
        {children(`url(#${id}-fill)`, `url(#${id}-stroke)`)}
      </g>
      <defs>
        <linearGradient id={`${id}-fill`} x1="5" y1="4" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="#DCE9FF" />
        </linearGradient>
        <linearGradient id={`${id}-stroke`} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5B9BFF" />
          <stop offset="1" stopColor="#1F55E0" />
        </linearGradient>
      </defs>
    </Svg>
  );
}

export const BackIcon = (props: IconProps) => (
  <Line d="M14.5 18.5L8 12L14.5 5.5M8 12H20" {...props} />
);

export const CloseIcon = (props: IconProps) => (
  <Line d="M6.5 6.5L17.5 17.5M17.5 6.5L6.5 17.5" {...props} />
);

export const ArrowRightIcon = (props: IconProps) => (
  <Line d="M4 12H19M13 18L19 12L13 6" {...props} />
);

export const CheckIcon = (props: IconProps) => (
  <Line d="M5 12L9.5 16.5L19 7" {...props} />
);

export const ChevronDownIcon = (props: IconProps) => (
  <Line d="M6 9L12 15L18 9" {...props} />
);

export const ChevronRightIcon = (props: IconProps) => (
  <Line d="M9 18L15 12L9 6" {...props} />
);

export const SearchIcon = (props: IconProps) => (
  <Line
    d="M10.5 17C14.0899 17 17 14.0899 17 10.5C17 6.91015 14.0899 4 10.5 4C6.91015 4 4 6.91015 4 10.5C4 14.0899 6.91015 17 10.5 17ZM15.5 15.5L20 20"
    {...props}
  />
);

export const BuildingIcon = (props: IconProps) => (
  <Filled {...props}>
    {(fill, stroke) => (
      <>
        <path d="M3.5 21V8H11V21" fill={fill} />
        <path d="M3.5 21V8H11V21" stroke={stroke} strokeWidth={1.4} />
        <path d="M11 21V3.5H20.5V21H11Z" fill={fill} stroke={stroke} strokeWidth={1.4} />
        <path
          d="M2 21.5H22M6.5 11.5H8M6.5 15.5H8M14.5 7H17M14.5 11H17M14.5 15H17M15 21V18H17V21"
          stroke={stroke}
          strokeWidth={1.4}
        />
      </>
    )}
  </Filled>
);

export const CameraIcon = (props: IconProps) => (
  <Filled {...props}>
    {(fill, stroke) => (
      <>
        <path
          d="M8 5L9.5 3H14.5L16 5H19C19.5304 5 20.0391 5.21071 20.4142 5.58579C20.7893 5.96086 21 6.46957 21 7V18C21 18.5304 20.7893 19.0391 20.4142 19.4142C20.0391 19.7893 19.5304 20 19 20H5C4.46957 20 3.96086 19.7893 3.58579 19.4142C3.21071 19.0391 3 18.5304 3 18V7C3 6.46957 3.21071 5.96086 3.58579 5.58579C3.96086 5.21071 4.46957 5 5 5H8Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={1.4}
        />
        <path
          d="M12 16.5C14.2091 16.5 16 14.7091 16 12.5C16 10.2909 14.2091 8.5 12 8.5C9.79086 8.5 8 10.2909 8 12.5C8 14.7091 9.79086 16.5 12 16.5Z"
          fill="white"
          stroke={stroke}
          strokeWidth={1.4}
        />
        <path
          d="M12 10C12.663 10 13.2989 10.2634 13.7678 10.7322C14.2366 11.2011 14.5 11.837 14.5 12.5"
          stroke={stroke}
          strokeWidth={1.1}
        />
        <path d="M17.5 8H18.1" stroke={stroke} strokeWidth={1.4} />
      </>
    )}
  </Filled>
);

export const ClassroomIcon = (props: IconProps) => (
  <Filled {...props}>
    {(fill, stroke) => (
      <>
        <path d="M4 5H20V16H4V5Z" fill={fill} stroke={stroke} strokeWidth={1.4} />
        <path
          d="M2.5 4H21.5M12 16V21M8 21L12 17L16 21M7.5 8.5H16.5M7.5 12H13"
          stroke={stroke}
          strokeWidth={1.4}
        />
        <path d="M15.5 11.5H16.5" stroke={stroke} strokeWidth={2} />
      </>
    )}
  </Filled>
);

export const CoffeeIcon = (props: IconProps) => (
  <Filled {...props}>
    {(fill, stroke) => (
      <>
        <path
          d="M4 8H16V15C16 16.3261 15.4732 17.5979 14.5355 18.5355C13.5979 19.4732 12.3261 20 11 20H9C7.67392 20 6.40215 19.4732 5.46447 18.5355C4.52678 17.5979 4 16.3261 4 15V8Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={1.4}
        />
        <path
          d="M16 9H18C18.7956 9 19.5587 9.31607 20.1213 9.87868C20.6839 10.4413 21 11.2044 21 12C21 12.7956 20.6839 13.5587 20.1213 14.1213C19.5587 14.6839 18.7956 15 18 15H16M7 3V5M11 3V5M3 21H19"
          stroke={stroke}
          strokeWidth={1.4}
        />
      </>
    )}
  </Filled>
);

export const DiningIcon = (props: IconProps) => (
  <Filled {...props}>
    {(fill, stroke) => (
      <>
        <path
          d="M12 18.5C15.5899 18.5 18.5 15.5899 18.5 12C18.5 8.41015 15.5899 5.5 12 5.5C8.41015 5.5 5.5 8.41015 5.5 12C5.5 15.5899 8.41015 18.5 12 18.5Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={1.2}
        />
        <path
          d="M3 3V8C3 8.53043 3.21071 9.03914 3.58579 9.41421C3.96086 9.78929 4.46957 10 5 10C5.53043 10 6.03914 9.78929 6.41421 9.41421C6.78929 9.03914 7 8.53043 7 8V3M5 3V21M21 11H18C18 7.8 18.7 4.5 21 3V21"
          stroke={stroke}
          strokeWidth={1.4}
        />
      </>
    )}
  </Filled>
);

export const ElevatorIcon = (props: IconProps) => (
  <Filled {...props}>
    {(fill, stroke) => (
      <>
        <path
          d="M18 3H6C4.34315 3 3 4.34315 3 6V18C3 19.6569 4.34315 21 6 21H18C19.6569 21 21 19.6569 21 18V6C21 4.34315 19.6569 3 18 3Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={1.4}
        />
        <path
          d="M12 3V21M10 10L8 8L6 10M8 8V16M18 14L16 16L14 14M16 16V8"
          stroke={stroke}
          strokeWidth={1.4}
        />
      </>
    )}
  </Filled>
);

export const MapIcon = (props: IconProps) => (
  <Filled {...props}>
    {(fill, stroke) => (
      <>
        <path d="M3 5L9 3L15 5L21 3V19L15 21L9 19L3 21V5Z" fill={fill} stroke={stroke} strokeWidth={1.4} />
        <path d="M9 3V19M15 5V21" stroke={stroke} strokeWidth={1.4} />
        <path d="M11 9L13 8L14 10L12 13L11 9Z" fill={stroke} stroke={stroke} strokeWidth={0.7} />
      </>
    )}
  </Filled>
);

export const MessageIcon = (props: IconProps) => (
  <Filled {...props}>
    {(fill, stroke) => (
      <>
        <path
          d="M5 4H19C19.5304 4 20.0391 4.21071 20.4142 4.58579C20.7893 4.96086 21 5.46957 21 6V16C21 16.5304 20.7893 17.0391 20.4142 17.4142C20.0391 17.7893 19.5304 18 19 18H9L4 21V18H3V6C3 5.46957 3.21071 4.96086 3.58579 4.58579C3.96086 4.21071 4.46957 4 5 4Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={1.4}
        />
        <path d="M7 9H17M7 13H13" stroke={stroke} strokeWidth={1.4} />
      </>
    )}
  </Filled>
);

export const StoreIcon = (props: IconProps) => (
  <Filled {...props}>
    {(fill, stroke) => (
      <>
        <path d="M4 10V21H20V10H4Z" fill={fill} stroke={stroke} strokeWidth={1.4} />
        <path d="M3 10L5 4H19L21 10" fill={fill} />
        <path d="M3 10L5 4H19L21 10" stroke={stroke} strokeWidth={1.4} />
        <path
          d="M3 10C3 10.7956 3.31607 11.5587 3.87868 12.1213C4.44129 12.6839 5.20435 13 6 13C6.79565 13 7.55871 12.6839 8.12132 12.1213C8.68393 11.5587 9 10.7956 9 10M9 10C9 10.7956 9.31607 11.5587 9.87868 12.1213C10.4413 12.6839 11.2044 13 12 13C12.7956 13 13.5587 12.6839 14.1213 12.1213C14.6839 11.5587 15 10.7956 15 10M9 10V4M15 10C15 10.7956 15.3161 11.5587 15.8787 12.1213C16.4413 12.6839 17.2044 13 18 13C18.7956 13 19.5587 12.6839 20.1213 12.1213C20.6839 11.5587 21 10.7956 21 10M15 10V4M9 21V15H15V21"
          stroke={stroke}
          strokeWidth={1.4}
        />
      </>
    )}
  </Filled>
);

export const TapIcon = (props: IconProps) => (
  <Line
    d="M10 13V5.5C10 4.67 10.67 4 11.5 4C12.33 4 13 4.67 13 5.5V11L17.2 11.9C18.3 12.15 19 13.2 18.8 14.3L18 18.5C17.7 20 16.4 21 14.9 21H12.5C11.5 21 10.6 20.5 10 19.7L6.6 15.2C6.1 14.5 6.2 13.6 6.8 13.1C7.4 12.6 8.3 12.6 8.9 13.2L10 14.3M7.5 7.5C7.5 5 9.3 2.8 11.5 2.8C13.7 2.8 15.5 5 15.5 7.5"
    {...props}
  />
);

export const PinIcon = (props: IconProps) => (
  <Line
    d="M12 21C12 21 19 14.8 19 9.5C19 5.6 15.9 3 12 3C8.1 3 5 5.6 5 9.5C5 14.8 12 21 12 21ZM12 12C13.38 12 14.5 10.88 14.5 9.5C14.5 8.12 13.38 7 12 7C10.62 7 9.5 8.12 9.5 9.5C9.5 10.88 10.62 12 12 12Z"
    {...props}
  />
);

// 홈 바로 찾기 카드용 단색 아이콘
export const BuildingSolidIcon = (props: IconProps) => (
  <Svg {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 3H18C18.55 3 19 3.45 19 4V20H20.25C20.66 20 21 20.34 21 20.75C21 21.16 20.66 21.5 20.25 21.5H3.75C3.34 21.5 3 21.16 3 20.75C3 20.34 3.34 20 3.75 20H5V4C5 3.45 5.45 3 6 3ZM8 6.5V9.5H10.75V6.5H8ZM13.25 6.5V9.5H16V6.5H13.25ZM8 11.5V14.5H10.75V11.5H8ZM13.25 11.5V14.5H16V11.5H13.25ZM10.25 16.5V20H13.75V16.5H10.25Z"
      fill="currentColor"
    />
  </Svg>
);

export const CupSolidIcon = (props: IconProps) => (
  <Svg {...props}>
    <path
      d="M4 10H16V15.5C16 18.26 13.76 20.5 11 20.5H9C6.24 20.5 4 18.26 4 15.5V10ZM16 11.25H17.5C19.16 11.25 20.5 12.59 20.5 14.25C20.5 15.91 19.16 17.25 17.5 17.25H15.6C15.87 16.78 16 16.25 16 15.7V15.75H17.5C18.33 15.75 19 15.08 19 14.25C19 13.42 18.33 12.75 17.5 12.75H16V11.25Z"
      fill="currentColor"
    />
    <path
      d="M7.5 7.5C7.5 6.5 8.5 6.25 8.5 5.25C8.5 4.5 8 4 8 4M11.5 7.5C11.5 6.5 12.5 6.25 12.5 5.25C12.5 4.5 12 4 12 4"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

export const SwapIcon = (props: IconProps) => (
  <Line d="M4 8H19M15 4L19 8L15 12M20 16H5M9 12L5 16L9 20" {...props} />
);

// 홈·대화 검색창의 장식용 돋보기(연한 렌즈 + 파란 테두리, 진한 손잡이)
export const SearchLensIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="10.5" cy="10.5" r="6" fill="#E1E9F7" stroke="#2860ED" strokeWidth={2} />
    <path d="M15 15L19.5 19.5" stroke="#174FD6" strokeWidth={3.2} strokeLinecap="round" />
  </Svg>
);

// 이용 안내 「알아두세요」 아이콘. 색은 글자 색을 따름
export const ShieldIcon = (props: IconProps) => (
  <Line d="M12 3L19 6V11.5C19 15.6 16.1 19.3 12 20.5C7.9 19.3 5 15.6 5 11.5V6L12 3ZM9 12L11 14L15 10" {...props} />
);

export const FoldedMapIcon = (props: IconProps) => (
  <Line d="M3 6.5L9 4L15 6.5L21 4V17.5L15 20L9 17.5L3 20V6.5ZM9 4V17.5M15 6.5V20" {...props} />
);

export const AlertCircleIcon = (props: IconProps) => (
  <Line d="M12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21ZM12 7.5V13M12 16.5H12.01" {...props} />
);
