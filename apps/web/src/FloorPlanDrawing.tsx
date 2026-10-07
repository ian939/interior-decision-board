import type { ReactNode } from "react";

type RoomLabelProps = { x: number; y: number; label: string; note?: string; compact?: boolean };

function RoomLabel({ x, y, label, note, compact = false }: RoomLabelProps): ReactNode {
  return <g className={`floor-room-label ${compact ? "compact" : ""}`} transform={`translate(${x} ${y})`}><text className="floor-room-name">{label}</text>{note ? <text className="floor-room-note" y={compact ? 175 : 220}>{note}</text> : null}</g>;
}

function Door({ x, y, rotation = 0, size = 760 }: { x: number; y: number; rotation?: number; size?: number }): ReactNode {
  return <g className="floor-door" transform={`translate(${x} ${y}) rotate(${rotation})`}><line className="floor-door-gap" x1="-35" y1="0" x2={size + 35} y2="0" /><line className="floor-door-leaf" x1="0" y1="0" x2="0" y2={size} /><path d={`M 0 ${size} A ${size} ${size} 0 0 1 ${size} 0`} /></g>;
}

function WindowMark({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }): ReactNode {
  const horizontal = y1 === y2;
  return <g className="floor-window"><line x1={x1} y1={y1} x2={x2} y2={y2} /><line x1={horizontal ? x1 : x1 + 65} y1={horizontal ? y1 + 65 : y1} x2={horizontal ? x2 : x2 + 65} y2={horizontal ? y2 + 65 : y2} /></g>;
}

function HorizontalDimension({ x1, x2, y, label, extensionTo }: { x1: number; x2: number; y: number; label: string; extensionTo?: number }): ReactNode {
  return <g className="floor-dimension horizontal"><line x1={x1} y1={y} x2={x2} y2={y} /><line x1={x1} y1={y - 90} x2={x1} y2={y + 90} /><line x1={x2} y1={y - 90} x2={x2} y2={y + 90} />{extensionTo !== undefined ? <><line className="extension" x1={x1} y1={y + 100} x2={x1} y2={extensionTo} /><line className="extension" x1={x2} y1={y + 100} x2={x2} y2={extensionTo} /></> : null}<rect className="floor-dimension-label-bg" x={(x1 + x2) / 2 - 420} y={y - 235} width="840" height="220" rx="70" /><text x={(x1 + x2) / 2} y={y - 72}>{label}</text></g>;
}

function VerticalDimension({ y1, y2, x, label, extensionTo, labelSide = "right" }: { y1: number; y2: number; x: number; label: string; extensionTo?: number; labelSide?: "left" | "right" }): ReactNode {
  const center = (y1 + y2) / 2;
  const direction = labelSide === "right" ? 1 : -1;
  return <g className="floor-dimension vertical"><line x1={x} y1={y1} x2={x} y2={y2} /><line x1={x - 90} y1={y1} x2={x + 90} y2={y1} /><line x1={x - 90} y1={y2} x2={x + 90} y2={y2} />{extensionTo !== undefined ? <><line className="extension" x1={x - (100 * direction)} y1={y1} x2={extensionTo} y2={y1} /><line className="extension" x1={x - (100 * direction)} y1={y2} x2={extensionTo} y2={y2} /></> : null}<g transform={`translate(${x + (130 * direction)} ${center}) rotate(${90 * direction})`}><rect className="floor-dimension-label-bg" x="-420" y="-150" width="840" height="220" rx="70" /><text y="5">{label}</text></g></g>;
}

function StairMark(): ReactNode {
  return <g className="floor-stair" transform="translate(11850 8150)"><line x1="1050" y1="200" x2="1050" y2="2750" />{Array.from({ length: 9 }, (_, index) => { const y = 450 + index * 240; return <line key={y} x1="350" y1={y} x2="1750" y2={y} />; })}<polyline points="880,2550 1050,2750 1220,2550" /></g>;
}

export function FloorPlanDrawing(): ReactNode {
  const topSegments = [{ x1: 0, x2: 3_600, label: "3,600" }, { x1: 3_600, x2: 6_600, label: "3,000" }, { x1: 6_600, x2: 9_000, label: "2,400" }, { x1: 9_000, x2: 12_000, label: "3,000" }];
  const leftSegments = [{ y1: 0, y2: 1_200, label: "1,200" }, { y1: 1_200, y2: 4_500, label: "3,300" }, { y1: 4_500, y2: 5_100, label: "600" }, { y1: 5_100, y2: 6_900, label: "1,800" }, { y1: 6_900, y2: 11_100, label: "4,200" }, { y1: 11_100, y2: 12_550, label: "1,450" }];
  const rightSegments = [{ y1: 0, y2: 1_450, label: "1,450" }, { y1: 1_450, y2: 5_050, label: "3,600" }, { y1: 5_050, y2: 5_650, label: "600" }, { y1: 5_650, y2: 7_350, label: "1,700" }, { y1: 7_350, y2: 10_650, label: "3,300" }, { y1: 10_650, y2: 11_850, label: "1,200" }];
  const bottomSegments = [{ x1: 0, x2: 3_600, label: "3,600" }, { x1: 3_600, x2: 7_200, label: "3,600" }, { x1: 7_200, x2: 9_600, label: "2,400" }];

  return <g className="floor-plan-vector" aria-hidden="true">
    <rect className="floor-plan-paper" x="-100" y="-100" width="14_300" height="12_800" />
    <g className="floor-zone-fills">
      <path className="floor-zone living" d="M 2_200 4_450 H 3_600 V 3_350 H 6_500 V 4_250 H 8_650 V 4_500 H 10_150 V 7_050 H 9_350 V 10_550 H 8_200 V 11_150 H 3_600 V 7_050 H 2_200 Z" />
      <rect className="floor-zone balcony" x="0" y="250" width="3_600" height="1_050" /><rect className="floor-zone bedroom" x="0" y="1_300" width="3_600" height="3_300" />
      <rect className="floor-zone kitchen" x="3_600" y="0" width="2_900" height="3_400" /><rect className="floor-zone service" x="6_500" y="900" width="2_200" height="3_400" />
      <rect className="floor-zone balcony" x="8_700" y="0" width="3_300" height="1_300" /><rect className="floor-zone bedroom" x="8_700" y="1_300" width="2_900" height="3_300" />
      <rect className="floor-zone bath" x="0" y="5_000" width="2_300" height="2_000" /><rect className="floor-zone bath" x="6_500" y="4_300" width="2_100" height="1_550" /><rect className="floor-zone entry" x="10_100" y="5_000" width="1_500" height="2_000" />
      <rect className="floor-zone bedroom" x="0" y="7_000" width="3_600" height="4_100" /><rect className="floor-zone bedroom" x="7_000" y="7_000" width="2_400" height="3_500" />
      <path className="floor-zone balcony" d="M 1_200 11_100 H 9_400 V 12_100 Q 9_400 12_550 8_950 12_550 H 1_200 Z" />
      <path className="floor-zone common floor-common-area" d="M 9_400 7_000 H 14_050 V 12_000 H 9_400 V 10_500 H 9_350 V 7_700 H 9_400 Z" />
    </g>
    <g className="floor-walls">
      <rect x="0" y="250" width="3_600" height="1_050" /><rect x="0" y="1_300" width="3_600" height="3_300" /><rect x="3_600" y="0" width="2_900" height="3_400" /><rect x="6_500" y="900" width="2_200" height="3_400" />
      <rect x="8_700" y="0" width="3_300" height="1_300" /><rect x="8_700" y="1_300" width="2_900" height="3_300" /><rect x="0" y="5_000" width="2_300" height="2_000" /><rect x="6_500" y="4_300" width="2_100" height="1_550" /><rect x="10_100" y="5_000" width="1_500" height="2_000" />
      <rect x="0" y="7_000" width="3_600" height="4_100" /><rect x="7_000" y="7_000" width="2_400" height="3_500" />
      <path d="M 1_200 11_100 V 12_550 H 8_950 Q 9_400 12_550 9_400 12_100 V 10_500" />
      <path className="common-wall" d="M 9_400 7_000 H 14_050 V 12_000 H 9_400 V 10_500" /><path className="common-wall" d="M 11_250 8_950 V 12_000 M 9_400 8_950 H 11_250" /><rect className="common-wall floor-elevator" x="9_850" y="9_050" width="1_150" height="1_450" />
    </g>
    <g className="floor-fixtures">
      <rect x="5_650" y="260" width="600" height="520" rx="45" /><circle cx="5_830" cy="430" r="70" /><circle cx="6_050" cy="430" r="70" /><rect x="3_710" y="1_100" width="300" height="1_850" rx="35" />
      <rect x="6_720" y="4_480" width="560" height="700" rx="80" /><ellipse cx="7_000" cy="4_760" rx="150" ry="190" /><rect x="7_500" y="4_480" width="560" height="700" rx="80" /><ellipse cx="7_780" cy="4_760" rx="150" ry="190" />
      <rect x="320" y="5_300" width="520" height="700" rx="80" /><ellipse cx="580" cy="5_600" rx="145" ry="190" /><rect x="1_250" y="5_250" width="720" height="1_150" rx="60" />
      <line x1="10_040" y1="9_250" x2="10_810" y2="10_300" /><line x1="10_810" y1="9_250" x2="10_040" y2="10_300" /><StairMark />
    </g>
    <g className="floor-windows"><WindowMark x1={650} y1={1_300} x2={2_650} y2={1_300} /><WindowMark x1={9_200} y1={1_300} x2={11_150} y2={1_300} /><WindowMark x1={600} y1={11_100} x2={2_650} y2={11_100} /><WindowMark x1={4_050} y1={11_100} x2={6_100} y2={11_100} /><WindowMark x1={7_250} y1={10_500} x2={9_000} y2={10_500} /></g>
    <g className="floor-doors"><Door x={3_600} y={3_650} rotation={90} /><Door x={8_700} y={3_650} rotation={-90} /><Door x={2_300} y={5_400} rotation={90} size={700} /><Door x={3_600} y={7_500} rotation={90} /><Door x={7_000} y={7_550} rotation={90} /><Door x={8_600} y={5_000} rotation={90} size={650} /><Door x={10_100} y={5_650} rotation={90} size={720} /><Door x={11_600} y={6_050} rotation={-90} size={760} /><Door x={9_400} y={7_250} rotation={90} size={750} /><Door x={11_250} y={7_250} rotation={90} size={750} /></g>
    <g className="floor-room-labels">
      <RoomLabel x={1_800} y={720} label="발코니" compact /><RoomLabel x={1_800} y={2_850} label="방 1" note="침실" /><RoomLabel x={5_050} y={1_650} label="주방 · 식당" note="설비 위치 확인" /><RoomLabel x={7_600} y={2_650} label="다용도 · 복도" compact />
      <RoomLabel x={10_350} y={720} label="발코니" compact /><RoomLabel x={10_150} y={2_850} label="방 2" note="침실" /><RoomLabel x={1_150} y={5_950} label="욕실 1" compact /><RoomLabel x={7_550} y={5_050} label="욕실 2" compact /><RoomLabel x={10_850} y={5_950} label="현관" compact />
      <RoomLabel x={1_800} y={8_950} label="방 3" note="침실" /><RoomLabel x={5_100} y={8_100} label="거실" note="가구 배치 중심" /><RoomLabel x={8_200} y={8_850} label="방 4" note="침실" /><RoomLabel x={5_250} y={11_850} label="발코니" compact />
      <RoomLabel x={10_430} y={8_250} label="공용 홀" compact /><RoomLabel x={10_425} y={9_850} label="승강기" compact /><RoomLabel x={12_900} y={11_200} label="계단" compact />
    </g>
    <HorizontalDimension x1={0} x2={12_000} y={-1_050} label="세대 폭 12,000 mm" extensionTo={-80} />
    {topSegments.map((segment) => <HorizontalDimension key={segment.x1} {...segment} y={-430} extensionTo={-80} />)}
    <VerticalDimension y1={0} y2={12_550} x={-1_050} label="전체 12,550 mm" extensionTo={-80} labelSide="left" />
    {leftSegments.map((segment) => <VerticalDimension key={segment.y1} {...segment} x={-430} extensionTo={-80} labelSide="left" />)}
    <HorizontalDimension x1={0} x2={9_600} y={13_400} label="하부 전면 표기 9,600 mm" extensionTo={12_650} />
    {bottomSegments.map((segment) => <HorizontalDimension key={segment.x1} {...segment} y={12_850} extensionTo={12_600} />)}
    <VerticalDimension y1={0} y2={11_850} x={15_000} label="우측 전면 표기 11,850 mm" extensionTo={14_150} />
    {rightSegments.map((segment) => <VerticalDimension key={segment.y1} {...segment} x={14_450} extensionTo={14_150} />)}
  </g>;
}
