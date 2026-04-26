'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

interface AIDetectionRadarChartProps {
  lexical: number;
  structural: number;
  tone: number;
  logic: number;
  rhythm: number;
  punctuation: number;
}

export default function AIDetectionRadarChart({
  lexical,
  structural,
  tone,
  logic,
  rhythm,
  punctuation,
}: AIDetectionRadarChartProps) {
  const data = [
    { dimension: 'Lexical', value: lexical, fullMark: 100 },
    { dimension: 'Structural', value: structural, fullMark: 100 },
    { dimension: 'Tone', value: tone, fullMark: 100 },
    { dimension: 'Logic', value: logic, fullMark: 100 },
    { dimension: 'Rhythm', value: rhythm, fullMark: 100 },
    { dimension: 'Punctuation', value: punctuation, fullMark: 100 },
  ];

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#6b7280', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#6b7280', fontSize: 10 }}
          />
          <Radar
            name="Human Score"
            dataKey="value"
            stroke="#18181b"
            fill="#18181b"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
