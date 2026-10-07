import type { ReactNode } from "react";

export type FloorPlanVariant = "base" | "renovation";

type RoomLabelProps = { x: number; y: number; label: string; note?: string; compact?: boolean };

function RoomLabel({ x, y, label, note, compact = false }: RoomLabelProps): ReactNode {
  return (
    <g className={`floor-room-label ${compact ? "compact" : ""}`} transform={`translate(${x} ${y})`}>
      <text className="floor-room-name">{label}</text>
      {note ? <text className="floor-room-note" y={compact ? 175 : 220}>{note}</text> : null}
    </g>
  );
}

function Door({ x, y, rotation = 0, size = 760 }: { x: number; y: number; rotation?: number; size?: number }): ReactNode {
  return (
    <g className="floor-door" transform={`translate(${x} ${y}) rotate(${rotation})`}>
      <line className="floor-door-gap" x1={-35} y1={0} x2={size + 35} y2={0} />
      <line className="floor-door-leaf" x1={0} y1={0} x2={0} y2={size} />
      <path d={`M 0 ${size} A ${size} ${size} 0 0 1 ${size} 0`} />
    </g>
  );
}

function WindowMark({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }): ReactNode {
  const horizontal = y1 === y2;
  return (
    <g className="floor-window">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={horizontal ? x1 : x1 + 65} y1={horizontal ? y1 + 65 : y1} x2={horizontal ? x2 : x2 + 65} y2={horizontal ? y2 + 65 : y2} />
    </g>
  );
}

function HorizontalDimension({ x1, x2, y, label, extensionTo }: { x1: number; x2: number; y: number; label: string; extensionTo?: number }): ReactNode {
  return (
    <g className="floor-dimension horizontal">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 90} x2={x1} y2={y + 90} />
      <line x1={x2} y1={y - 90} x2={x2} y2={y + 90} />
      {extensionTo !== undefined ? <><line className="extension" x1={x1} y1={y + 100} x2={x1} y2={extensionTo} /><line className="extension" x1={x2} y1={y + 100} x2={x2} y2={extensionTo} /></> : null}
      <rect className="floor-dimension-label-bg" x={(x1 + x2) / 2 - 420} y={y - 235} width={840} height={220} rx={70} />
      <text x={(x1 + x2) / 2} y={y - 72}>{label}</text>
    </g>
  );
}

function VerticalDimension({ y1, y2, x, label, extensionTo, labelSide = "right" }: { y1: number; y2: number; x: number; label: string; extensionTo?: number; labelSide?: "left" | "right" }): ReactNode {
  const center = (y1 + y2) / 2;
  const direction = labelSide === "right" ? 1 : -1;
  return (
    <g className="floor-dimension vertical">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 90} y1={y1} x2={x + 90} y2={y1} />
      <line x1={x - 90} y1={y2} x2={x + 90} y2={y2} />
      {extensionTo !== undefined ? <><line className="extension" x1={x - (100 * direction)} y1={y1} x2={extensionTo} y2={y1} /><line className="extension" x1={x - (100 * direction)} y1={y2} x2={extensionTo} y2={y2} /></> : null}
      <g transform={`translate(${x + (130 * direction)} ${center}) rotate(${90 * direction})`}>
        <rect className="floor-dimension-label-bg" x={-420} y={-150} width={840} height={220} rx={70} />
        <text y={5}>{label}</text>
      </g>
    </g>
  );
}

function StairMark(): ReactNode {
  return (
    <g className="floor-stair" transform="translate(11850 8150)">
      <line x1={1050} y1={200} x2={1050} y2={2750} />
      {Array.from({ length: 9 }, (_, index) => {
        const y = 450 + index * 240;
        return <line key={y} x1={350} y1={y} x2={1750} y2={y} />;
      })}
      <polyline points="880,2550 1050,2750 1220,2550" />
    </g>
  );
}

function RenovationBadge({ x, y, number, label }: { x: number; y: number; number: number; label: string }): ReactNode {
  return (
    <g className="floor-renovation-badge" transform={`translate(${x} ${y})`}>
      <circle r={190} />
      <text y={65}>{number}</text>
      <text className="floor-renovation-badge-label" x={260} y={55}>{label}</text>
    </g>
  );
}

const topSegments = [
  { x1: 0, x2: 3600, label: "3,600" },
  { x1: 3600, x2: 6600, label: "3,000" },
  { x1: 6600, x2: 9000, label: "2,400" },
  { x1: 9000, x2: 12000, label: "3,000" },
];

const leftSegments = [
  { y1: 0, y2: 1200, label: "1,200" },
  { y1: 1200, y2: 4500, label: "3,300" },
  { y1: 4500, y2: 5100, label: "600" },
  { y1: 5100, y2: 6900, label: "1,800" },
  { y1: 6900, y2: 11100, label: "4,200" },
  { y1: 11100, y2: 12550, label: "1,450" },
];

const rightSegments = [
  { y1: 0, y2: 1450, label: "1,450" },
  { y1: 1450, y2: 5050, label: "3,600" },
  { y1: 5050, y2: 5650, label: "600" },
  { y1: 5650, y2: 7350, label: "1,700" },
  { y1: 7350, y2: 10650, label: "3,300" },
  { y1: 10650, y2: 11850, label: "1,200" },
];

const bottomSegments = [
  { x1: 0, x2: 3600, label: "3,600" },
  { x1: 3600, x2: 7200, label: "3,600" },
  { x1: 7200, x2: 9600, label: "2,400" },
];

export function FloorPlanDrawing({ variant = "base" }: { variant?: FloorPlanVariant }): ReactNode {
  const renovated = variant === "renovation";
  const bathTwo = renovated ? { x: 6200, y: 4200, width: 2500, height: 2000 } : { x: 6500, y: 4300, width: 2100, height: 1550 };

  return (
    <g className={`floor-plan-vector ${renovated ? "renovation" : "base"}`} data-plan-variant={variant} aria-hidden="true">
      <rect className="floor-plan-paper" x={-100} y={-100} width={14300} height={12800} />

      <g className="floor-zone-fills">
        <path className="floor-zone living" d="M 2200 4450 H 3600 V 3350 H 6500 V 4250 H 8650 V 4500 H 10150 V 7050 H 9350 V 10550 H 8200 V 11150 H 3600 V 7050 H 2200 Z" />
        {renovated ? <rect className="floor-zone bedroom floor-renovation-expanded" x={0} y={250} width={3600} height={4350} /> : <><rect className="floor-zone balcony" x={0} y={250} width={3600} height={1050} /><rect className="floor-zone bedroom" x={0} y={1300} width={3600} height={3300} /></>}
        <rect className="floor-zone kitchen" x={3600} y={0} width={2900} height={3400} />
        <rect className="floor-zone service" x={6500} y={900} width={2200} height={3400} />
        <rect className="floor-zone balcony" x={8700} y={0} width={3300} height={1300} />
        <rect className="floor-zone bedroom" x={8700} y={1300} width={2900} height={3300} />
        <rect className="floor-zone bath" x={0} y={5000} width={2300} height={2000} />
        <rect className={`floor-zone bath ${renovated ? "floor-renovation-expanded" : ""}`} {...bathTwo} />
        <rect className="floor-zone entry" x={10100} y={5000} width={1500} height={2000} />
        {renovated ? <path className="floor-zone bedroom floor-renovation-expanded" d="M 0 7000 H 3600 V 12550 H 1200 V 11100 H 0 Z" /> : <rect className="floor-zone bedroom" x={0} y={7000} width={3600} height={4100} />}
        <rect className="floor-zone bedroom" x={7000} y={7000} width={2400} height={3500} />
        {renovated ? <><rect className="floor-zone living floor-renovation-expanded" x={3600} y={10500} width={3400} height={2050} /><path className="floor-zone balcony" d="M 7000 10500 H 9400 V 12100 Q 9400 12550 8950 12550 H 7000 Z" /></> : <path className="floor-zone balcony" d="M 1200 11100 H 9400 V 12100 Q 9400 12550 8950 12550 H 1200 Z" />}
        <path className="floor-zone common floor-common-area" d="M 9400 7000 H 14050 V 12000 H 9400 V 10500 H 9350 V 7700 H 9400 Z" />
        {renovated ? <g className="floor-renovation-features">
          <rect className="floor-renovation-storage" x={10600} y={3650} width={1000} height={950} />
          <rect className="floor-renovation-storage" x={2300} y={4650} width={1300} height={850} />
          <line x1={2950} y1={4650} x2={2950} y2={5500} />
          <rect className="floor-renovation-island" x={4950} y={3400} width={1500} height={850} rx={70} />
          <rect className="floor-renovation-dressing" x={0} y={8600} width={3600} height={2500} />
        </g> : null}
      </g>

      <g className="floor-walls">
        {renovated ? <rect className="renovated-wall" x={0} y={250} width={3600} height={4350} /> : <><rect x={0} y={250} width={3600} height={1050} /><rect x={0} y={1300} width={3600} height={3300} /></>}
        <rect x={3600} y={0} width={2900} height={3400} />
        <rect x={6500} y={900} width={2200} height={3400} />
        <rect x={8700} y={0} width={3300} height={1300} />
        <rect x={8700} y={1300} width={2900} height={3300} />
        <rect x={0} y={5000} width={2300} height={2000} />
        <rect className={renovated ? "renovated-wall" : undefined} {...bathTwo} />
        <rect x={10100} y={5000} width={1500} height={2000} />
        {renovated ? <path className="renovated-wall" d="M 0 7000 H 3600 V 12550 H 1200 V 11100 H 0 Z" /> : <rect x={0} y={7000} width={3600} height={4100} />}
        <rect x={7000} y={7000} width={2400} height={3500} />
        {renovated ? <path className="renovated-wall" d="M 3600 12550 H 8950 Q 9400 12550 9400 12100 V 10500 M 7000 10500 H 9400" /> : <path d="M 1200 11100 V 12550 H 8950 Q 9400 12550 9400 12100 V 10500" />}
        <path className="common-wall" d="M 9400 7000 H 14050 V 12000 H 9400 V 10500" />
        <path className="common-wall" d="M 11250 8950 V 12000 M 9400 8950 H 11250" />
        <rect className="common-wall floor-elevator" x={9850} y={9050} width={1150} height={1450} />
      </g>

      <g className="floor-fixtures">
        <rect x={5650} y={260} width={600} height={520} rx={45} /><circle cx={5830} cy={430} r={70} /><circle cx={6050} cy={430} r={70} /><rect x={3710} y={1100} width={300} height={1850} rx={35} />
        <rect x={bathTwo.x + 220} y={bathTwo.y + 180} width={560} height={700} rx={80} /><ellipse cx={bathTwo.x + 500} cy={bathTwo.y + 460} rx={150} ry={190} />
        <rect x={bathTwo.x + 1000} y={bathTwo.y + 180} width={560} height={700} rx={80} /><ellipse cx={bathTwo.x + 1280} cy={bathTwo.y + 460} rx={150} ry={190} />
        {renovated ? <rect className="floor-shower" x={bathTwo.x + 1700} y={bathTwo.y + 180} width={580} height={1500} rx={45} /> : null}
        <rect x={320} y={5300} width={520} height={700} rx={80} /><ellipse cx={580} cy={5600} rx={145} ry={190} /><rect x={1250} y={5250} width={720} height={1150} rx={60} />
        <line x1={10040} y1={9250} x2={10810} y2={10300} /><line x1={10810} y1={9250} x2={10040} y2={10300} /><StairMark />
      </g>

      <g className="floor-windows">
        <WindowMark x1={650} y1={renovated ? 250 : 1300} x2={2650} y2={renovated ? 250 : 1300} />
        <WindowMark x1={9200} y1={1300} x2={11150} y2={1300} />
        <WindowMark x1={600} y1={renovated ? 12550 : 11100} x2={2650} y2={renovated ? 12550 : 11100} />
        <WindowMark x1={4050} y1={renovated ? 12550 : 11100} x2={6100} y2={renovated ? 12550 : 11100} />
        <WindowMark x1={7250} y1={10500} x2={9000} y2={10500} />
      </g>

      <g className="floor-doors">
        <Door x={3600} y={3650} rotation={90} /><Door x={8700} y={3650} rotation={-90} /><Door x={2300} y={5400} rotation={90} size={700} /><Door x={3600} y={7500} rotation={90} /><Door x={7000} y={7550} rotation={90} />
        <Door x={bathTwo.x + bathTwo.width} y={5000} rotation={90} size={650} /><Door x={10100} y={5650} rotation={90} size={720} /><Door x={11600} y={6050} rotation={-90} size={760} /><Door x={9400} y={7250} rotation={90} size={750} /><Door x={11250} y={7250} rotation={90} size={750} />
      </g>

      <g className="floor-room-labels">
        {!renovated ? <RoomLabel x={1800} y={720} label="발코니" compact /> : null}
        <RoomLabel x={1800} y={2850} label={renovated ? "방 1 · 확장" : "방 1"} note="침실" />
        <RoomLabel x={5050} y={1650} label="주방 · 식당" note="설비 위치 확인" /><RoomLabel x={7600} y={2650} label="다용도 · 복도" compact />
        <RoomLabel x={10350} y={720} label="발코니" compact /><RoomLabel x={10150} y={2850} label="방 2" note="침실" /><RoomLabel x={1150} y={5950} label="욕실 1" compact />
        <RoomLabel x={bathTwo.x + bathTwo.width / 2} y={bathTwo.y + 900} label={renovated ? "욕실 2 · 확장" : "욕실 2"} compact /><RoomLabel x={10850} y={5950} label="현관" compact />
        <RoomLabel x={1800} y={renovated ? 7900 : 8950} label={renovated ? "방 3 · 확장" : "방 3"} note="침실" /><RoomLabel x={5100} y={8100} label={renovated ? "거실 · 확장" : "거실"} note="가구 배치 중심" /><RoomLabel x={8200} y={8850} label="방 4" note="침실" />
        <RoomLabel x={renovated ? 8200 : 5250} y={11850} label="발코니" compact /><RoomLabel x={10430} y={8250} label="공용 홀" compact /><RoomLabel x={10425} y={9850} label="승강기" compact /><RoomLabel x={12900} y={11200} label="계단" compact />
        {renovated ? <><RoomLabel x={1800} y={9800} label="드레스룸" compact /><RoomLabel x={5700} y={3850} label="아일랜드" compact /></> : null}
      </g>

      {renovated ? <g className="floor-renovation-badges">
        <RenovationBadge x={11250} y={3900} number={1} label="현관 수납 확장" /><RenovationBadge x={8500} y={4400} number={2} label="욕실 확장" /><RenovationBadge x={6200} y={3500} number={3} label="아일랜드" />
        <RenovationBadge x={350} y={650} number={4} label="침실 확장" /><RenovationBadge x={3350} y={4850} number={5} label="수납 분리" /><RenovationBadge x={3350} y={8750} number={6} label="드레스룸" /><RenovationBadge x={6750} y={11950} number={7} label="거실 확장" />
      </g> : null}

      <HorizontalDimension x1={0} x2={12000} y={-1050} label="세대 폭 12,000 mm" extensionTo={-80} />
      {topSegments.map((segment) => <HorizontalDimension key={segment.x1} {...segment} y={-430} extensionTo={-80} />)}
      <VerticalDimension y1={0} y2={12550} x={-1050} label="전체 12,550 mm" extensionTo={-80} labelSide="left" />
      {leftSegments.map((segment) => <VerticalDimension key={segment.y1} {...segment} x={-430} extensionTo={-80} labelSide="left" />)}
      <HorizontalDimension x1={0} x2={9600} y={13400} label="하부 전면 표기 9,600 mm" extensionTo={12650} />
      {bottomSegments.map((segment) => <HorizontalDimension key={segment.x1} {...segment} y={12850} extensionTo={12600} />)}
      <VerticalDimension y1={0} y2={11850} x={15000} label="우측 전면 표기 11,850 mm" extensionTo={14150} />
      {rightSegments.map((segment) => <VerticalDimension key={segment.y1} {...segment} x={14450} extensionTo={14150} />)}
    </g>
  );
}
