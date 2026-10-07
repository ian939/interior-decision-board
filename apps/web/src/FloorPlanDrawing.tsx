import type { ReactNode } from "react";

type RoomLabelProps = {
  x: number;
  y: number;
  label: string;
  note?: string;
  compact?: boolean;
};

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
      <line className="floor-door-gap" x1="-35" y1="0" x2={size + 35} y2="0" />
      <line className="floor-door-leaf" x1="0" y1="0" x2="0" y2={size} />
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
      <rect className="floor-dimension-label-bg" x={(x1 + x2) / 2 - 420} y={y - 235} width="840" height="220" rx="70" />
      <text x={(x1 + x2) / 2} y={y - 72}>{label}</text>
    </g>
  );
}

function VerticalDimension({ y1, y2, x, label, extensionTo }: { y1: number; y2: number; x: number; label: string; extensionTo?: number }): ReactNode {
  const center = (y1 + y2) / 2;
  return (
    <g className="floor-dimension vertical">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 90} y1={y1} x2={x + 90} y2={y1} />
      <line x1={x - 90} y1={y2} x2={x + 90} y2={y2} />
      {extensionTo !== undefined ? <><line className="extension" x1={x - 100} y1={y1} x2={extensionTo} y2={y1} /><line className="extension" x1={x - 100} y1={y2} x2={extensionTo} y2={y2} /></> : null}
      <g transform={`translate(${x + 130} ${center}) rotate(90)`}>
        <rect className="floor-dimension-label-bg" x="-420" y="-150" width="840" height="220" rx="70" />
        <text y="5">{label}</text>
      </g>
    </g>
  );
}

export function FloorPlanDrawing(): ReactNode {
  const topSegments = [
    { x1: 0, x2: 3_600, label: "3,600" },
    { x1: 3_600, x2: 6_600, label: "3,000" },
    { x1: 6_600, x2: 9_000, label: "2,400" },
    { x1: 9_000, x2: 12_000, label: "3,000" },
  ];
  const rightSegments = [
    { y1: 0, y2: 1_200, label: "1,200" },
    { y1: 1_200, y2: 4_500, label: "3,300" },
    { y1: 4_500, y2: 5_100, label: "600" },
    { y1: 5_100, y2: 6_900, label: "1,800" },
    { y1: 6_900, y2: 11_100, label: "4,200" },
    { y1: 11_100, y2: 12_550, label: "1,450" },
  ];

  return (
    <g className="floor-plan-vector" aria-hidden="true">
      <rect className="floor-plan-paper" width="12000" height="12550" />

      <g className="floor-zone-fills">
        <rect className="floor-zone balcony" x="0" y="0" width="3300" height="1300" />
        <rect className="floor-zone bedroom" x="0" y="1300" width="3600" height="3300" />
        <rect className="floor-zone bath" x="0" y="5000" width="2300" height="2000" />
        <rect className="floor-zone bedroom" x="0" y="7000" width="3600" height="4100" />
        <rect className="floor-zone kitchen" x="3600" y="0" width="2900" height="3400" />
        <rect className="floor-zone service" x="6500" y="1300" width="2200" height="3000" />
        <rect className="floor-zone bath" x="6500" y="4300" width="2100" height="1500" />
        <rect className="floor-zone balcony" x="8700" y="0" width="3300" height="1300" />
        <rect className="floor-zone bedroom" x="8700" y="1300" width="3300" height="3300" />
        <path className="floor-zone living" d="M 3600 3400 H 6500 V 4600 H 10100 V 7000 H 6500 V 11100 H 3600 V 7000 H 2300 V 4600 H 3600 Z" />
        <rect className="floor-zone entry" x="10100" y="5000" width="1500" height="2000" />
        <rect className="floor-zone bedroom" x="7000" y="7000" width="2400" height="3500" />
        <rect className="floor-zone balcony" x="1200" y="11100" width="7000" height="1450" />
        <rect className="floor-zone common" x="9400" y="7000" width="2600" height="4100" />
      </g>

      <g className="floor-walls">
        <rect x="0" y="0" width="3300" height="1300" />
        <rect x="0" y="1300" width="3600" height="3300" />
        <rect x="0" y="5000" width="2300" height="2000" />
        <rect x="0" y="7000" width="3600" height="4100" />
        <rect x="3600" y="0" width="2900" height="3400" />
        <rect x="6500" y="1300" width="2200" height="3000" />
        <rect x="6500" y="4300" width="2100" height="1500" />
        <rect x="8700" y="0" width="3300" height="1300" />
        <rect x="8700" y="1300" width="3300" height="3300" />
        <path d="M 3600 3400 H 6500 V 4600 H 10100 V 7000 H 6500 V 11100 H 3600 V 7000 H 2300 V 4600 H 3600 Z" />
        <rect x="10100" y="5000" width="1500" height="2000" />
        <rect x="7000" y="7000" width="2400" height="3500" />
        <rect x="1200" y="11100" width="7000" height="1450" />
        <rect className="common-wall" x="9400" y="7000" width="2600" height="4100" />
      </g>

      <g className="floor-fixtures">
        <rect x="5730" y="350" width="520" height="650" rx="45" />
        <circle cx="5900" cy="520" r="70" /><circle cx="6080" cy="520" r="70" />
        <rect x="6720" y="4550" width="520" height="700" rx="80" />
        <ellipse cx="6980" cy="4850" rx="145" ry="190" />
        <rect x="340" y="5350" width="520" height="700" rx="80" />
        <ellipse cx="600" cy="5650" rx="145" ry="190" />
        <rect x="1250" y="5300" width="720" height="1150" rx="60" />
        <path d="M 9750 7550 h 1050 v 2500 h -1050 z" />
        <line x1="9920" y1="7850" x2="10720" y2="9750" />
        <line x1="10720" y1="7850" x2="9920" y2="9750" />
      </g>

      <g className="floor-windows">
        <WindowMark x1={650} y1={1_300} x2={2_650} y2={1_300} />
        <WindowMark x1={9_250} y1={1_300} x2={11_350} y2={1_300} />
        <WindowMark x1={600} y1={11_100} x2={2_650} y2={11_100} />
        <WindowMark x1={4_050} y1={11_100} x2={6_100} y2={11_100} />
        <WindowMark x1={7_300} y1={10_500} x2={9_050} y2={10_500} />
      </g>

      <g className="floor-doors">
        <Door x={3_600} y={3_700} rotation={90} />
        <Door x={8_700} y={3_650} rotation={-90} />
        <Door x={2_300} y={5_450} rotation={90} size={700} />
        <Door x={3_600} y={7_550} rotation={90} />
        <Door x={7_000} y={7_600} rotation={90} />
        <Door x={8_600} y={5_000} rotation={90} size={650} />
        <Door x={10_100} y={5_650} rotation={90} size={720} />
        <Door x={11_600} y={6_100} rotation={-90} size={760} />
      </g>

      <g className="floor-room-labels">
        <RoomLabel x={1_650} y={620} label="베란다" compact />
        <RoomLabel x={1_800} y={2_820} label="방 1" note="침실" />
        <RoomLabel x={1_150} y={5_950} label="화장실 1" compact />
        <RoomLabel x={1_800} y={8_900} label="방 3" note="침실" />
        <RoomLabel x={5_050} y={1_620} label="주방 · 식당" note="설비 위치 확인" />
        <RoomLabel x={7_600} y={2_640} label="다용도 · 복도" compact />
        <RoomLabel x={7_550} y={5_030} label="화장실 2" compact />
        <RoomLabel x={10_350} y={620} label="베란다" compact />
        <RoomLabel x={10_350} y={2_820} label="방 2" note="침실" />
        <RoomLabel x={5_050} y={8_000} label="거실" note="가구 배치 중심" />
        <RoomLabel x={10_850} y={5_950} label="현관" compact />
        <RoomLabel x={8_200} y={8_800} label="방 4" note="침실" />
        <RoomLabel x={4_700} y={11_810} label="베란다" compact />
        <RoomLabel x={10_700} y={9_000} label="공용부" note="계단 · 엘리베이터" compact />
      </g>

      <HorizontalDimension x1={0} x2={12_000} y={-1_050} label="전체 12,000 mm" extensionTo={-80} />
      {topSegments.map((segment) => <HorizontalDimension key={segment.x1} {...segment} y={-430} extensionTo={-80} />)}
      <VerticalDimension y1={0} y2={12_550} x={13_250} label="전체 12,550 mm" extensionTo={12_080} />
      {rightSegments.map((segment) => <VerticalDimension key={segment.y1} {...segment} x={12_620} extensionTo={12_080} />)}
      <HorizontalDimension x1={0} x2={9_800} y={13_400} label="하부 도면 표기 9,800 mm" extensionTo={12_650} />
      <VerticalDimension y1={0} y2={11_850} x={-1_000} label="좌측 도면 표기 11,850 mm" extensionTo={-80} />
    </g>
  );
}
