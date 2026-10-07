import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlannerCategory, PlannerItem, PlannerLayout } from "@interior/shared";
import { Check, CircleAlert, Copy, Grid3X3, LoaderCircle, Minus, Move, Plus, RotateCw, Save, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { api } from "./api";

const PLAN_WIDTH = 12_000;
const PLAN_HEIGHT = 12_550;
const PLAN_IMAGE = `${import.meta.env.BASE_URL}project-assets/plans/floorplan-final.png`;
const DRAWING_VIEWBOX = { x: -2_200, y: -1_800, width: 17_450, height: 15_700 } as const;

type FurniturePreset = {
  label: string;
  category: PlannerCategory;
  widthMm: number;
  depthMm: number;
  clearanceMm: number;
  color: string;
  icon: string;
};

const furniturePresets: FurniturePreset[] = [
  { label: "퀸 침대", category: "bed", widthMm: 1_500, depthMm: 2_000, clearanceMm: 600, color: "#94aa9a", icon: "🛏" },
  { label: "킹 침대", category: "bed", widthMm: 1_650, depthMm: 2_000, clearanceMm: 600, color: "#879e8e", icon: "🛏" },
  { label: "슈퍼싱글", category: "bed", widthMm: 1_100, depthMm: 2_000, clearanceMm: 500, color: "#a8b9ab", icon: "🛏" },
  { label: "붙박이장", category: "storage", widthMm: 2_400, depthMm: 600, clearanceMm: 900, color: "#b19b82", icon: "▥" },
  { label: "옷장", category: "storage", widthMm: 1_200, depthMm: 600, clearanceMm: 900, color: "#bea98f", icon: "▥" },
  { label: "3인 소파", category: "seating", widthMm: 2_200, depthMm: 900, clearanceMm: 700, color: "#8f9dac", icon: "▰" },
  { label: "식탁 6인", category: "table", widthMm: 1_800, depthMm: 850, clearanceMm: 900, color: "#c59672", icon: "▤" },
  { label: "식탁 4인", category: "table", widthMm: 1_400, depthMm: 800, clearanceMm: 800, color: "#cda27f", icon: "▤" },
  { label: "TV장", category: "storage", widthMm: 1_800, depthMm: 450, clearanceMm: 300, color: "#9d927f", icon: "▭" },
  { label: "냉장고", category: "appliance", widthMm: 900, depthMm: 850, clearanceMm: 100, color: "#8fa7ad", icon: "▣" },
  { label: "세탁기", category: "appliance", widthMm: 700, depthMm: 750, clearanceMm: 100, color: "#9eb0b4", icon: "◉" },
  { label: "아일랜드", category: "kitchen", widthMm: 1_800, depthMm: 900, clearanceMm: 1_000, color: "#b88968", icon: "▰" },
  { label: "책상", category: "desk", widthMm: 1_400, depthMm: 700, clearanceMm: 700, color: "#b4a27e", icon: "▱" },
  { label: "직접 입력", category: "custom", widthMm: 1_000, depthMm: 1_000, clearanceMm: 600, color: "#a69caf", icon: "+" },
];

const roomGuides = [
  { id: "room-1", label: "방 1", x: 250, y: 1_300, width: 3_400, depth: 3_450 },
  { id: "kitchen", label: "주방", x: 3_750, y: 800, width: 2_750, depth: 2_650 },
  { id: "room-2", label: "방 2", x: 8_650, y: 1_350, width: 2_950, depth: 3_450 },
  { id: "bath-1", label: "화장실 1", x: 300, y: 5_200, width: 1_900, depth: 1_850 },
  { id: "living", label: "거실", x: 3_650, y: 4_700, width: 2_800, depth: 6_300 },
  { id: "room-3", label: "방 3", x: 250, y: 7_050, width: 3_350, depth: 4_200 },
  { id: "bath-2", label: "화장실 2", x: 6_650, y: 4_350, width: 1_950, depth: 1_450 },
  { id: "room-4", label: "방 4", x: 7_050, y: 7_050, width: 2_300, depth: 3_350 },
  { id: "entry", label: "현관", x: 10_100, y: 5_050, width: 1_450, depth: 1_900 },
  { id: "balcony", label: "베란다", x: 1_250, y: 11_150, width: 6_900, depth: 1_300 },
] as const;

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
}

function footprint(item: PlannerItem): { width: number; depth: number } {
  return item.rotation === 90 ? { width: item.depthMm, depth: item.widthMm } : { width: item.widthMm, depth: item.depthMm };
}

function overlap(a: { x: number; y: number; width: number; depth: number }, b: { x: number; y: number; width: number; depth: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.depth && a.y + a.depth > b.y;
}

function itemRect(item: PlannerItem): { x: number; y: number; width: number; depth: number } {
  return { x: item.xMm, y: item.yMm, ...footprint(item) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatDimension(value: number): string {
  return value >= 1_000 ? `${(value / 1_000).toFixed(value % 1_000 === 0 ? 1 : 2)}m` : `${Math.round(value)}mm`;
}

function cloneItems(items: PlannerItem[]): PlannerItem[] {
  return items.map((item) => ({ ...item, id: crypto.randomUUID() }));
}

export function SpacePlannerView(): ReactNode {
  const queryClient = useQueryClient();
  const layoutsQuery = useQuery({ queryKey: ["planner-layouts"], queryFn: api.plannerLayouts, refetchOnWindowFocus: false });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showGuides, setShowGuides] = useState(false);
  const [snapMm, setSnapMm] = useState(100);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  function hydrate(layout: PlannerLayout): void {
    setActiveId(layout.id);
    setName(layout.name);
    setItems(layout.items);
    setSelectedId(null);
    setDirty(false);
    setError(null);
  }

  useEffect(() => {
    if (!activeId && layoutsQuery.data?.layouts[0]) hydrate(layoutsQuery.data.layouts[0]);
  }, [activeId, layoutsQuery.data]);

  const updateCache = (layout: PlannerLayout): void => {
    queryClient.setQueryData<{ layouts: PlannerLayout[] }>(["planner-layouts"], (current) => ({
      layouts: current?.layouts.some((item) => item.id === layout.id)
        ? current.layouts.map((item) => item.id === layout.id ? layout : item)
        : [layout, ...(current?.layouts ?? [])],
    }));
  };

  const createLayout = useMutation({
    mutationFn: ({ layoutName, layoutItems }: { layoutName: string; layoutItems: PlannerItem[] }) => api.addPlannerLayout(layoutName, layoutItems),
    onSuccess: (layout) => { updateCache(layout); hydrate(layout); },
    onError: (mutationError) => setError(readableError(mutationError)),
  });
  const saveLayout = useMutation({
    mutationFn: () => {
      if (!activeId) throw new Error("저장할 배치안이 없습니다.");
      return api.updatePlannerLayout(activeId, { name, items });
    },
    onSuccess: (layout) => { updateCache(layout); hydrate(layout); },
    onError: (mutationError) => setError(readableError(mutationError)),
  });
  const deleteLayout = useMutation({
    mutationFn: (id: string) => api.deletePlannerLayout(id),
    onSuccess: (_result, id) => {
      const remaining = (layoutsQuery.data?.layouts ?? []).filter((layout) => layout.id !== id);
      queryClient.setQueryData(["planner-layouts"], { layouts: remaining });
      if (remaining[0]) hydrate(remaining[0]);
      else { setActiveId(null); setName(""); setItems([]); setSelectedId(null); setDirty(false); }
    },
    onError: (mutationError) => setError(readableError(mutationError)),
  });

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const collisionIds = useMemo(() => {
    const result = new Set<string>();
    for (let first = 0; first < items.length; first += 1) {
      for (let second = first + 1; second < items.length; second += 1) {
        const firstItem = items[first];
        const secondItem = items[second];
        if (firstItem && secondItem && overlap(itemRect(firstItem), itemRect(secondItem))) {
          result.add(firstItem.id);
          result.add(secondItem.id);
        }
      }
    }
    return result;
  }, [items]);

  const selectedZone = useMemo(() => {
    if (!selected) return null;
    const rect = itemRect(selected);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.depth / 2;
    return roomGuides.find((zone) => centerX >= zone.x && centerX <= zone.x + zone.width && centerY >= zone.y && centerY <= zone.y + zone.depth) ?? null;
  }, [selected]);

  const selectedIssues = useMemo(() => {
    if (!selected) return [];
    const issues: string[] = [];
    const rect = itemRect(selected);
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > PLAN_WIDTH || rect.y + rect.depth > PLAN_HEIGHT) issues.push("도면 외곽을 벗어납니다.");
    if (collisionIds.has(selected.id)) issues.push("다른 가구와 실제 크기가 겹칩니다.");
    const clearance = selected.clearanceMm;
    const clearanceRect = { x: rect.x - clearance, y: rect.y - clearance, width: rect.width + clearance * 2, depth: rect.depth + clearance * 2 };
    if (items.some((item) => item.id !== selected.id && overlap(clearanceRect, itemRect(item)))) issues.push(`${selected.clearanceMm}mm 통로 여유가 다른 가구와 겹칩니다.`);
    if (!selectedZone) issues.push("공간 가이드 밖입니다. 벽과 겹치지 않는지 도면을 확인하세요.");
    else if (rect.x < selectedZone.x || rect.y < selectedZone.y || rect.x + rect.width > selectedZone.x + selectedZone.width || rect.y + rect.depth > selectedZone.y + selectedZone.depth) issues.push(`${selectedZone.label} 예상 경계에 걸쳐 있습니다.`);
    return issues;
  }, [collisionIds, items, selected, selectedZone]);

  function chooseLayout(id: string): void {
    if (id === activeId) return;
    if (dirty && !window.confirm("저장하지 않은 변경이 있습니다. 다른 배치안으로 이동할까요?")) return;
    const layout = layoutsQuery.data?.layouts.find((item) => item.id === id);
    if (layout) hydrate(layout);
  }

  function createNewLayout(): void {
    const nextNumber = (layoutsQuery.data?.layouts.length ?? 0) + 1;
    createLayout.mutate({ layoutName: `배치안 ${nextNumber}`, layoutItems: [] });
  }

  function duplicateCurrentLayout(): void {
    if (!activeId) return;
    createLayout.mutate({ layoutName: `${name} 복사`, layoutItems: cloneItems(items) });
  }

  function addPreset(preset: FurniturePreset): void {
    if (!activeId) return;
    const offset = (items.length % 7) * 180;
    const next: PlannerItem = {
      id: crypto.randomUUID(),
      label: preset.label,
      category: preset.category,
      xMm: clamp(4_300 + offset, 0, PLAN_WIDTH - preset.widthMm),
      yMm: clamp(5_100 + offset, 0, PLAN_HEIGHT - preset.depthMm),
      widthMm: preset.widthMm,
      depthMm: preset.depthMm,
      rotation: 0,
      clearanceMm: preset.clearanceMm,
      color: preset.color,
    };
    setItems((current) => [...current, next]);
    setSelectedId(next.id);
    setDirty(true);
  }

  function updateSelected(patch: Partial<PlannerItem>): void {
    if (!selectedId) return;
    setItems((current) => current.map((item) => {
      if (item.id !== selectedId) return item;
      const next = { ...item, ...patch };
      const size = footprint(next);
      return { ...next, xMm: clamp(next.xMm, 0, Math.max(0, PLAN_WIDTH - size.width)), yMm: clamp(next.yMm, 0, Math.max(0, PLAN_HEIGHT - size.depth)) };
    }));
    setDirty(true);
  }

  function duplicateSelected(): void {
    if (!selected) return;
    const size = footprint(selected);
    const next = {
      ...selected,
      id: crypto.randomUUID(),
      label: `${selected.label} 복사`,
      xMm: clamp(selected.xMm + 300, 0, Math.max(0, PLAN_WIDTH - size.width)),
      yMm: clamp(selected.yMm + 300, 0, Math.max(0, PLAN_HEIGHT - size.depth)),
    };
    setItems((current) => [...current, next]);
    setSelectedId(next.id);
    setDirty(true);
  }

  function removeSelected(): void {
    if (!selectedId) return;
    setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
    setDirty(true);
  }

  function pointFromEvent(event: ReactPointerEvent<SVGSVGElement | SVGGElement>): { x: number; y: number } | null {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function beginDrag(event: ReactPointerEvent<SVGGElement>, item: PlannerItem): void {
    event.stopPropagation();
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(item.id);
    setDragging({ id: item.id, offsetX: point.x - item.xMm, offsetY: point.y - item.yMm });
  }

  function moveDrag(event: ReactPointerEvent<SVGSVGElement>): void {
    if (!dragging) return;
    const point = pointFromEvent(event);
    const item = items.find((candidate) => candidate.id === dragging.id);
    if (!point || !item) return;
    const size = footprint(item);
    const snap = (value: number): number => Math.round(value / snapMm) * snapMm;
    const xMm = clamp(snap(point.x - dragging.offsetX), 0, Math.max(0, PLAN_WIDTH - size.width));
    const yMm = clamp(snap(point.y - dragging.offsetY), 0, Math.max(0, PLAN_HEIGHT - size.depth));
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, xMm, yMm } : candidate));
    setDirty(true);
  }

  function moveSelectedWithKeyboard(event: KeyboardEvent<SVGGElement>, item: PlannerItem): void {
    const direction = event.key;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(direction)) return;
    event.preventDefault();
    const multiplier = event.shiftKey ? 5 : 1;
    const deltaX = direction === "ArrowLeft" ? -snapMm * multiplier : direction === "ArrowRight" ? snapMm * multiplier : 0;
    const deltaY = direction === "ArrowUp" ? -snapMm * multiplier : direction === "ArrowDown" ? snapMm * multiplier : 0;
    setSelectedId(item.id);
    const size = footprint(item);
    setItems((current) => current.map((candidate) => candidate.id === item.id ? {
      ...candidate,
      xMm: clamp(item.xMm + deltaX, 0, Math.max(0, PLAN_WIDTH - size.width)),
      yMm: clamp(item.yMm + deltaY, 0, Math.max(0, PLAN_HEIGHT - size.depth)),
    } : candidate));
    setDirty(true);
  }

  if (layoutsQuery.isLoading) return <div className="content-pad content-page planner-page"><div className="planner-loading"><LoaderCircle className="spin" size={24} />배치 실험실을 준비하고 있습니다.</div></div>;

  const layouts = layoutsQuery.data?.layouts ?? [];
  return (
    <div className="content-pad content-page planner-page">
      <div className="page-header planner-page-header">
        <div><span className="eyebrow">SPACE PLANNER · 1:1 SCALE</span><h1>가구 배치 실험실</h1><p>도면 외곽 12,000 × 12,550mm를 기준으로 실제 가구 크기와 통로 여유를 비교합니다.</p></div>
        <div className="planner-header-badges"><span><Check size={14} />현관 왼쪽 진입</span><span><CircleAlert size={14} />배치 검토용</span></div>
      </div>

      <div className="planner-disclaimer"><CircleAlert size={18} /><div><strong>실측 도면이 없어 내부 벽 위치는 이미지 기준 근사값입니다.</strong><span>가구 구매와 시공 확정 전에는 현장에서 벽 길이, 문 열림, 콘센트와 몰딩을 다시 측정하세요.</span></div></div>
      {error || layoutsQuery.error ? <div className="notice error-notice planner-error"><CircleAlert size={17} /><span>{error ?? readableError(layoutsQuery.error)}</span><button className="icon-button" onClick={() => setError(null)}>×</button></div> : null}

      {layouts.length === 0 && !activeId ? (
        <section className="planner-first-layout">
          <div className="planner-first-visual"><Grid3X3 size={34} /><span>12,000</span><span>12,550</span></div>
          <span className="eyebrow">START A LAYOUT</span><h2>첫 배치안을 만들어보세요</h2><p>가구를 실제 mm 크기로 올리고, 겹침과 통로 폭을 확인할 수 있습니다.</p>
          <button className="primary-button" onClick={createNewLayout} disabled={createLayout.isPending}>{createLayout.isPending ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}배치안 1 만들기</button>
        </section>
      ) : (
        <>
          <section className="planner-layout-bar">
            <label><span>현재 배치안</span><select value={activeId ?? ""} onChange={(event) => chooseLayout(event.target.value)}>{layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.name}</option>)}</select></label>
            <div className="planner-layout-name"><input className="text-input" value={name} onChange={(event) => { setName(event.target.value); setDirty(true); }} aria-label="배치안 이름" /><span className={dirty ? "unsaved" : "saved"}>{dirty ? "저장 안 됨" : "저장됨"}</span></div>
            <div className="planner-layout-actions"><button className="secondary-button small-button" onClick={createNewLayout} disabled={createLayout.isPending}><Plus size={15} />새 배치안</button><button className="secondary-button small-button" onClick={duplicateCurrentLayout} disabled={createLayout.isPending}><Copy size={15} />A/B 복사</button><button className="primary-button small-button" onClick={() => saveLayout.mutate()} disabled={!dirty || saveLayout.isPending || !name.trim()}>{saveLayout.isPending ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}저장</button><button className="icon-button danger-icon bordered" onClick={() => { if (activeId && window.confirm(`'${name}' 배치안을 삭제할까요?`)) deleteLayout.mutate(activeId); }} aria-label="배치안 삭제"><Trash2 size={16} /></button></div>
          </section>

          <div className="planner-workspace">
            <aside className="planner-library">
              <div className="planner-panel-heading"><div><span>FURNITURE</span><h2>가구·가전</h2></div><small>{furniturePresets.length}종</small></div>
              <p className="planner-panel-copy">누르면 도면 중앙에 실제 크기로 추가됩니다.</p>
              <div className="planner-presets">{furniturePresets.map((preset) => <button key={preset.label} onClick={() => addPreset(preset)}><span className="planner-preset-icon">{preset.icon}</span><span><strong>{preset.label}</strong><small>{preset.widthMm} × {preset.depthMm}</small></span><Plus size={14} /></button>)}</div>
            </aside>

            <main className="planner-canvas-panel">
              <div className="planner-canvas-toolbar">
                <div><button className="icon-button subtle" onClick={() => setZoom((value) => clamp(value - .15, .7, 1.9))} aria-label="축소"><ZoomOut size={17} /></button><span>{Math.round(zoom * 100)}%</span><button className="icon-button subtle" onClick={() => setZoom((value) => clamp(value + .15, .7, 1.9))} aria-label="확대"><ZoomIn size={17} /></button></div>
                <div><button className={showGrid ? "active" : ""} onClick={() => setShowGrid((value) => !value)}><Grid3X3 size={15} />500mm 격자</button><button className={showGuides ? "active" : ""} onClick={() => setShowGuides((value) => !value)}><Move size={15} />공간 가이드</button><label>스냅<select value={snapMm} onChange={(event) => setSnapMm(Number(event.target.value))}><option value={50}>50mm</option><option value={100}>100mm</option><option value={300}>300mm</option></select></label></div>
              </div>
              <div className="planner-canvas-scroll">
                <svg
                  ref={svgRef}
                  className="planner-canvas"
                  viewBox={`${DRAWING_VIEWBOX.x} ${DRAWING_VIEWBOX.y} ${DRAWING_VIEWBOX.width} ${DRAWING_VIEWBOX.height}`}
                  style={{ width: `${zoom * 100}%`, minWidth: `${720 * zoom}px` }}
                  onPointerMove={moveDrag}
                  onPointerUp={() => setDragging(null)}
                  onPointerCancel={() => setDragging(null)}
                  onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}
                  role="img"
                  aria-label="실제 치수 가구 배치 도면"
                >
                  <defs>
                    <clipPath id="plan-clip"><rect width={PLAN_WIDTH} height={PLAN_HEIGHT} /></clipPath>
                    <pattern id="planner-small-grid" width="500" height="500" patternUnits="userSpaceOnUse"><path d="M 500 0 L 0 0 0 500" fill="none" stroke="#789081" strokeWidth="10" opacity=".22" /></pattern>
                    <pattern id="planner-large-grid" width="1000" height="1000" patternUnits="userSpaceOnUse"><rect width="1000" height="1000" fill="url(#planner-small-grid)" /><path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#526b59" strokeWidth="16" opacity=".24" /></pattern>
                  </defs>
                  <g className="planner-final-plan"><image href={PLAN_IMAGE} x={-3650} y={-1895} width={19590} height={16937} preserveAspectRatio="none" /></g>
                  <g clipPath="url(#plan-clip)">
                    {showGrid ? <rect width={PLAN_WIDTH} height={PLAN_HEIGHT} fill="url(#planner-large-grid)" /> : null}
                    {showGuides ? roomGuides.map((zone) => <g className="planner-room-guide" key={zone.id}><rect x={zone.x} y={zone.y} width={zone.width} height={zone.depth} rx="70" /><text x={zone.x + 100} y={zone.y + 260}>{zone.label} · 근사</text></g>) : null}
                    {items.map((item) => {
                      const size = footprint(item);
                      const isSelected = item.id === selectedId;
                      const colliding = collisionIds.has(item.id);
                      const clearance = item.clearanceMm;
                      return <g key={item.id} className={`planner-item ${isSelected ? "selected" : ""} ${colliding ? "colliding" : ""}`} role="button" tabIndex={0} aria-label={`${item.label} ${item.widthMm} 곱하기 ${item.depthMm} 밀리미터`} onPointerDown={(event) => beginDrag(event, item)} onKeyDown={(event) => moveSelectedWithKeyboard(event, item)}>
                        {isSelected && item.clearanceMm > 0 ? <rect className="planner-clearance" x={item.xMm - clearance} y={item.yMm - clearance} width={size.width + clearance * 2} height={size.depth + clearance * 2} rx="70" /> : null}
                        <rect className="planner-item-body" x={item.xMm} y={item.yMm} width={size.width} height={size.depth} rx="80" fill={item.color} />
                        <text className="planner-item-label" x={item.xMm + size.width / 2} y={item.yMm + size.depth / 2 - 35}>{item.label}</text>
                        <text className="planner-item-size" x={item.xMm + size.width / 2} y={item.yMm + size.depth / 2 + 180}>{item.widthMm}×{item.depthMm}</text>
                      </g>;
                    })}
                    <g className="planner-scale" transform="translate(430 11960)"><line x1="0" x2="1000" y1="0" y2="0" /><line x1="0" x2="0" y1="-70" y2="70" /><line x1="1000" x2="1000" y1="-70" y2="70" /><text x="500" y="-110">1,000mm</text></g>
                  </g>
                </svg>
              </div>
              <div className="planner-canvas-foot"><span><i className="legend-item" />가구 실크기</span><span><i className="legend-clearance" />선택 가구 통로</span><span><i className="legend-collision" />겹침</span><small>확정한 최종 평면도 한 장을 기준으로 가구 배치를 검토합니다.</small></div>
            </main>

            <aside className="planner-inspector">
              <div className="planner-panel-heading"><div><span>INSPECTOR</span><h2>치수와 배치</h2></div></div>
              {selected ? <>
                <label className="planner-field"><span>이름</span><input className="text-input" value={selected.label} onChange={(event) => updateSelected({ label: event.target.value.slice(0, 80) || "가구" })} /></label>
                <div className="planner-dimension-grid"><label className="planner-field"><span>가로 W</span><div><input type="number" value={selected.widthMm} min="100" max="12000" step="50" onChange={(event) => updateSelected({ widthMm: clamp(Number(event.target.value), 100, PLAN_WIDTH) })} /><small>mm</small></div></label><label className="planner-field"><span>세로 D</span><div><input type="number" value={selected.depthMm} min="100" max="12550" step="50" onChange={(event) => updateSelected({ depthMm: clamp(Number(event.target.value), 100, PLAN_HEIGHT) })} /><small>mm</small></div></label></div>
                <div className="planner-dimension-grid"><label className="planner-field"><span>X 위치</span><div><input type="number" value={Math.round(selected.xMm)} min="0" max="12000" step={snapMm} onChange={(event) => updateSelected({ xMm: Number(event.target.value) })} /><small>mm</small></div></label><label className="planner-field"><span>Y 위치</span><div><input type="number" value={Math.round(selected.yMm)} min="0" max="12550" step={snapMm} onChange={(event) => updateSelected({ yMm: Number(event.target.value) })} /><small>mm</small></div></label></div>
                <label className="planner-field"><span>사방 통로 여유</span><div><input type="number" value={selected.clearanceMm} min="0" max="3000" step="100" onChange={(event) => updateSelected({ clearanceMm: clamp(Number(event.target.value), 0, 3_000) })} /><small>mm</small></div></label>
                <div className="planner-selected-summary"><div><span>현재 차지 크기</span><strong>{formatDimension(footprint(selected).width)} × {formatDimension(footprint(selected).depth)}</strong></div><div><span>예상 공간</span><strong>{selectedZone?.label ?? "가이드 밖"}</strong></div></div>
                {selectedIssues.length ? <div className="planner-issues">{selectedIssues.map((issue) => <div key={issue}><CircleAlert size={15} /><span>{issue}</span></div>)}</div> : <div className="planner-fit"><Check size={16} /><span>현재 배치에서 겹침이 발견되지 않았습니다.</span></div>}
                <div className="planner-item-actions"><button className="secondary-button" onClick={() => updateSelected({ rotation: selected.rotation === 0 ? 90 : 0 })}><RotateCw size={16} />90° 회전</button><button className="secondary-button" onClick={duplicateSelected}><Copy size={16} />복사</button><button className="text-button danger-text" onClick={removeSelected}><Trash2 size={15} />가구 삭제</button></div>
              </> : <div className="planner-inspector-empty"><Move size={24} /><strong>가구를 선택하세요</strong><p>도면의 가구를 누르면 정확한 크기, 위치, 회전과 통로 여유를 조정할 수 있습니다.</p><ul><li>드래그: 위치 이동</li><li>방향키: {snapMm}mm 이동</li><li>Shift + 방향키: {snapMm * 5}mm 이동</li></ul></div>}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
