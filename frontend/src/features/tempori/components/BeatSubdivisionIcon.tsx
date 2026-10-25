import type { BeatSubdivisionId } from '../utils/beatSubdivision';

interface BeatSubdivisionIconProps {
  subdivisionId: BeatSubdivisionId;
  className?: string;
}

const NOTE = '#1a1d27';

function NoteHead({ x, y }: { x: number; y: number }) {
  return <ellipse cx={x} cy={y} rx={3.2} ry={2.6} fill={NOTE} />;
}

function Stem({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return <line x1={x} y1={y1} x2={x} y2={y2} stroke={NOTE} strokeWidth={1.2} />;
}

function RestGlyph({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M ${x - 2} ${y} q 2 -3 4 0 q -2 3 -4 0`}
      fill="none"
      stroke={NOTE}
      strokeWidth={1}
    />
  );
}

function Beam({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return <line x1={x1} y1={y} x2={x2} y2={y} stroke={NOTE} strokeWidth={2.2} />;
}

function TripletBracket({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <>
      <path
        d={`M ${x1} ${y} Q ${(x1 + x2) / 2} ${y - 4} ${x2} ${y}`}
        fill="none"
        stroke={NOTE}
        strokeWidth={0.8}
      />
      <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle" fontSize={5} fill={NOTE}>
        3
      </text>
    </>
  );
}

function SixteenthGroup({
  positions,
  beamEnd,
}: {
  positions: number[];
  beamEnd: number;
}) {
  return (
    <>
      {positions.map((x) => (
        <g key={x}>
          <NoteHead x={x} y={20} />
          <Stem x={x + 3} y1={8} y2={20} />
        </g>
      ))}
      <Beam x1={positions[0] + 3} x2={beamEnd} y={8} />
      <Beam x1={positions[0] + 3} x2={beamEnd} y={11} />
    </>
  );
}

export default function BeatSubdivisionIcon({ subdivisionId, className }: BeatSubdivisionIconProps) {
  return (
    <svg className={className} viewBox="0 0 40 28" aria-hidden="true" role="img">
      {subdivisionId === 'quarter' && (
        <>
          <NoteHead x={14} y={20} />
          <Stem x={17} y1={8} y2={20} />
        </>
      )}

      {subdivisionId === 'eighth-pair' && (
        <>
          <NoteHead x={10} y={20} />
          <Stem x={13} y1={10} y2={20} />
          <NoteHead x={22} y={20} />
          <Stem x={25} y1={10} y2={20} />
          <Beam x1={13} x2={25} y={10} />
        </>
      )}

      {subdivisionId === 'eighth-rest-eighth' && (
        <>
          <RestGlyph x={10} y={16} />
          <NoteHead x={24} y={20} />
          <Stem x={27} y1={10} y2={20} />
        </>
      )}

      {subdivisionId === 'triplet-three' && (
        <>
          <NoteHead x={8} y={20} />
          <Stem x={11} y1={10} y2={20} />
          <NoteHead x={18} y={20} />
          <Stem x={21} y1={10} y2={20} />
          <NoteHead x={28} y={20} />
          <Stem x={31} y1={10} y2={20} />
          <Beam x1={11} x2={31} y={10} />
          <TripletBracket x1={8} x2={31} y={7} />
        </>
      )}

      {subdivisionId === 'triplet-beam' && (
        <>
          <NoteHead x={8} y={20} />
          <Stem x={11} y1={10} y2={20} />
          <NoteHead x={18} y={20} />
          <Stem x={21} y1={10} y2={20} />
          <NoteHead x={28} y={20} />
          <Stem x={31} y1={10} y2={20} />
          <Beam x1={11} x2={31} y={10} />
        </>
      )}

      {subdivisionId === 'triplet-rest-two' && (
        <>
          <RestGlyph x={8} y={16} />
          <NoteHead x={18} y={20} />
          <Stem x={21} y1={10} y2={20} />
          <NoteHead x={28} y={20} />
          <Stem x={31} y1={10} y2={20} />
          <Beam x1={21} x2={31} y={10} />
          <TripletBracket x1={8} x2={31} y={7} />
        </>
      )}

      {subdivisionId === 'triplet-one-rest-one' && (
        <>
          <NoteHead x={8} y={20} />
          <Stem x={11} y1={10} y2={20} />
          <RestGlyph x={18} y={16} />
          <NoteHead x={28} y={20} />
          <Stem x={31} y1={10} y2={20} />
          <TripletBracket x1={8} x2={31} y={7} />
        </>
      )}

      {subdivisionId === 'triplet-two-rest' && (
        <>
          <NoteHead x={8} y={20} />
          <Stem x={11} y1={10} y2={20} />
          <NoteHead x={18} y={20} />
          <Stem x={21} y1={10} y2={20} />
          <Beam x1={11} x2={21} y={10} />
          <RestGlyph x={28} y={16} />
          <TripletBracket x1={8} x2={31} y={7} />
        </>
      )}

      {subdivisionId === 'sixteenth-four' && <SixteenthGroup positions={[8, 14, 20, 26]} beamEnd={29} />}

      {subdivisionId === 'sixteenth-syncopated' && (
        <>
          <RestGlyph x={8} y={16} />
          <NoteHead x={14} y={20} />
          <Stem x={17} y1={8} y2={20} />
          <RestGlyph x={22} y={16} />
          <NoteHead x={28} y={20} />
          <Stem x={31} y1={8} y2={20} />
          <Beam x1={17} x2={31} y={8} />
          <Beam x1={17} x2={31} y={11} />
        </>
      )}

      {subdivisionId === 'two-sixteenth-eighth' && (
        <>
          <NoteHead x={8} y={20} />
          <Stem x={11} y1={8} y2={20} />
          <NoteHead x={16} y={20} />
          <Stem x={19} y1={8} y2={20} />
          <NoteHead x={26} y={20} />
          <Stem x={29} y1={10} y2={20} />
          <Beam x1={11} x2={29} y={8} />
          <Beam x1={11} x2={29} y={11} />
        </>
      )}

      {subdivisionId === 'eighth-two-sixteenth' && (
        <>
          <NoteHead x={10} y={20} />
          <Stem x={13} y1={10} y2={20} />
          <NoteHead x={22} y={20} />
          <Stem x={25} y1={8} y2={20} />
          <NoteHead x={30} y={20} />
          <Stem x={33} y1={8} y2={20} />
          <Beam x1={13} x2={33} y={8} />
          <Beam x1={25} x2={33} y={11} />
        </>
      )}

      {subdivisionId === 'dotted-eighth-sixteenth' && (
        <>
          <NoteHead x={10} y={20} />
          <circle cx={15} cy={20} r={1} fill={NOTE} />
          <Stem x={13} y1={10} y2={20} />
          <NoteHead x={26} y={20} />
          <Stem x={29} y1={8} y2={20} />
          <Beam x1={13} x2={29} y={8} />
          <Beam x1={29} x2={29} y={11} />
        </>
      )}

      {subdivisionId === 'sixteenth-dotted-eighth' && (
        <>
          <NoteHead x={10} y={20} />
          <Stem x={13} y1={8} y2={20} />
          <NoteHead x={22} y={20} />
          <circle cx={27} cy={20} r={1} fill={NOTE} />
          <Stem x={25} y1={10} y2={20} />
          <Beam x1={13} x2={25} y={8} />
          <Beam x1={13} x2={25} y={11} />
        </>
      )}
    </svg>
  );
}
