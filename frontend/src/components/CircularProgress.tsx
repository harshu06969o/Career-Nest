import { cn } from '../lib/cn';

// =============================================================================
// CircularProgress — SVG ring showing a percentage score
// =============================================================================
// Uses a stroke-dasharray trick on a circle path to fill the ring proportionally.
// Coloring adapts: emerald (≥80), amber (≥60), red (<60).
// =============================================================================
interface Props {
  score:  number;   // 0-100
  size?:  number;   // px (default 80)
  stroke?: number;  // stroke width (default 8)
  className?: string;
}

export default function CircularProgress({ score, size = 80, stroke = 8, className }: Props) {
  const radius      = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled      = (score / 100) * circumference;

  const color =
    score >= 80 ? '#10b981'   // emerald
    : score >= 60 ? '#f59e0b' // amber
    : '#ef4444';              // red

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}
         style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={stroke}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {/* Label */}
      <span
        className="absolute text-xs font-bold"
        style={{ color }}
      >
        {score}%
      </span>
    </div>
  );
}
