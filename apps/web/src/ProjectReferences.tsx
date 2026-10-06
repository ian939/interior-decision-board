import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Focus,
  Grid2X2,
  Images,
  Map,
  Maximize2,
  Ruler,
  X,
} from "lucide-react";

type ReferenceTab = "plans" | "concepts" | "brief";

const asset = (path: string): string => `${import.meta.env.BASE_URL}project-assets/${path}`;

const floorPlans = [
  { src: asset("plans/floorplan-base.png"), alt: "한신무학 아파트 기본 평면도", label: "기본 평면도", caption: "41평 참고 도면 · 정확한 치수는 현장 실측으로 확정" },
  { src: asset("plans/floorplan-points.png"), alt: "공사 포인트가 표시된 평면도", label: "공사 포인트 도면", caption: "확장·수납·아일랜드 계획 7개 지점" },
];

const renovationPoints = [
  ["1", "현관 신발장 확장", "붙박이장 설치 · 중문 필요"],
  ["2", "화장실 확장", "샤워룸 추가"],
  ["3", "아일랜드 식탁", "주방 작업대와 수납 확장"],
  ["4", "침실 확장", "주방 옆 침실 공간 재구성"],
  ["5", "기존 붙박이장 분리", "한쪽 옷장 · 반대쪽 화장대"],
  ["6", "침실 확장", "분리벽과 드레스룸 구성"],
  ["7", "거실 확장", "베란다 방향 공간 확장"],
] as const;

const concepts = [
  { src: asset("concepts/entry-bath.png"), title: "현관 · 화장실", description: "밝고 정돈된 화이트톤 현관과 미니멀한 욕실 라인. 간접조명, 벽부 세면대, 샤워 공간 분리." },
  { src: asset("concepts/bedroom-dressing.png"), title: "안방 · 드레스룸", description: "벽면 전체 붙박이장으로 깔끔하게 마감하고 아치형 통로로 드레스룸 진입 동선을 구분." },
  { src: asset("concepts/kitchen-floor.png"), title: "주방 · 바닥재", description: "냉장고 빌트인 장이 포함된 일체형 주방과 타일 형태 강마루. 밝고 개방된 LDK 공간감." },
  { src: asset("concepts/balcony-door.png"), title: "베란다 연결 도어", description: "벽면과 일체화된 히든 도어로 베란다 연결 문의 시각적 간섭을 최소화." },
];

const slideTitles = [
  "현관 팬트리",
  "신발장 · 중문 배치",
  "중문 디자인",
  "욕실 레이아웃",
  "욕실 액세서리",
  "거울장 수납",
  "주방 수전 · 아일랜드 설비",
  "주방 하부장 · 싱크대",
  "주방 디자인 · 마감",
  "냉장고장 · 팬트리",
  "방문 손잡이 · 오토씰",
  "커튼박스 · 액자 몰딩",
  "안방 드레스룸 · 화장대",
  "붙박이장 디테일",
  "거실장 · 홈바",
  "시공 자재 팔레트",
  "조명 계획",
  "콘센트 계획",
];

const briefGroups = [
  { id: "entry", label: "현관·중문", slides: [1, 2, 3], summary: ["하부 110cm를 비운 팬트리와 무턱 접이식 문", "신발장 하부 간접조명·센서등", "패브릭 접합유리와 매립 레일 중문"] },
  { id: "bath", label: "욕실", slides: [4, 5, 6], summary: ["세로형 타일·조적 파티션·간접조명", "청소건과 옷걸이 위치", "다이슨 수납과 콘센트를 포함한 맞춤 거울장"] },
  { id: "kitchen", label: "주방", slides: [7, 8, 9, 10], summary: ["인출식·폭포수 수전과 인덕션 포트필러", "아일랜드 싱크볼·식세기·로봇청소기 직배수", "싱크대 높이 92~94cm와 팬텀화이트·칸스톤 마감"] },
  { id: "doors", label: "방문·커튼", slides: [11, 12], summary: ["지정 방문 손잡이와 오토씰 검토", "20cm 커튼박스·전동커튼 콘센트·액자 몰딩"] },
  { id: "bedroom", label: "안방", slides: [13, 14], summary: ["서랍과 긴 옷 중심 드레스룸", "다이슨 수납·매립 콘센트 화장대", "무몰딩 붙박이장과 숨은 손잡이"] },
  { id: "living", label: "거실", slides: [15], summary: ["거실 한 면을 채우는 수납장", "라운드 마감 홈바와 콘크리트화이트·클레이크림 조합"] },
  { id: "materials", label: "자재", slides: [16], summary: ["디아망 회벽 크림화이트", "마뷸러스 리브 실버문", "발렌블랑·팬텀화이트·칸스톤 에덴"] },
  { id: "electric", label: "조명·전기", slides: [17, 18], summary: ["공간별 주백색·전구색 조명 계획", "커튼박스·아일랜드·거울장·화장대 콘센트"] },
] as const;

function ImagePreview({ src, alt, mirrored = false, onClose }: { src: string; alt: string; mirrored?: boolean; onClose: () => void }): ReactNode {
  return (
    <div className="reference-lightbox" role="dialog" aria-modal="true" aria-label={`${alt} 크게 보기`} onClick={onClose}>
      <button className="reference-lightbox-close" onClick={onClose} aria-label="닫기"><X size={21} /></button>
      <img className={mirrored ? "mirrored-plan-image" : undefined} src={src} alt={alt} onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

export function ProjectReferencesView(): ReactNode {
  const [tab, setTab] = useState<ReferenceTab>("plans");
  const [groupId, setGroupId] = useState("all");
  const [selectedSlide, setSelectedSlide] = useState(7);
  const [mirroredPlan, setMirroredPlan] = useState(true);
  const [preview, setPreview] = useState<{ src: string; alt: string; mirrored?: boolean } | null>(null);

  const visibleSlides = useMemo(() => {
    if (groupId === "all") return slideTitles.map((_, index) => index + 1);
    return [...(briefGroups.find((group) => group.id === groupId)?.slides ?? [])];
  }, [groupId]);
  const selectedIndex = Math.max(0, visibleSlides.indexOf(selectedSlide));
  const selectedTitle = slideTitles[selectedSlide - 1] ?? "상세 요청";

  function showBrief(slide: number, group = "all"): void {
    setGroupId(group);
    setSelectedSlide(slide);
    setTab("brief");
  }

  function moveSlide(direction: -1 | 1): void {
    const nextIndex = Math.max(0, Math.min(visibleSlides.length - 1, selectedIndex + direction));
    setSelectedSlide(visibleSlides[nextIndex] ?? selectedSlide);
  }

  return (
    <div className="content-pad content-page references-page">
      <div className="page-header">
        <div><span className="eyebrow">PROJECT LIBRARY</span><h1>도면과 기존 아이디어</h1><p>집의 구조와 지금까지 정리한 요구사항을 결정 전에 함께 확인합니다.</p></div>
        <a className="secondary-button reference-source-link" href="https://ian939.github.io/proposal_apt/" target="_blank" rel="noreferrer">원본 제안서 <ExternalLink size={15} /></a>
      </div>

      <section className="reference-project-hero">
        <div>
          <span className="reference-overline">HANSHIN MUHAK · 2026</span>
          <h2>한신무학 아파트 102동 106호</h2>
          <p>41평 · 준공 38년차 · 전체 리모델링</p>
        </div>
        <dl>
          <div><dt>공사 범위</dt><dd>빈집 전체 공사</dd></div>
          <div><dt>예상 일정</dt><dd>2026년 7월–9월</dd></div>
          <div><dt>기준 문서</dt><dd>도면 2종 · 아이디어 18장</dd></div>
        </dl>
      </section>

      <nav className="reference-tabs" aria-label="프로젝트 자료 분류">
        <button className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}><Map size={17} /><span>도면·공사 포인트</span><small>2</small></button>
        <button className={tab === "concepts" ? "active" : ""} onClick={() => setTab("concepts")}><Images size={17} /><span>디자인·아이디어</span><small>12</small></button>
        <button className={tab === "brief" ? "active" : ""} onClick={() => setTab("brief")}><Grid2X2 size={17} /><span>상세 요청서</span><small>18</small></button>
      </nav>

      {tab === "plans" ? (
        <div className="reference-tab-panel">
          <div className="reference-section-heading plan-section-heading">
            <div><span>01 · FLOOR PLAN</span><h2>도면에서 먼저 확인할 것</h2></div>
            <div className="plan-heading-actions">
              <p>도면을 누르면 크게 볼 수 있습니다.</p>
              <div className="plan-orientation-control" role="group" aria-label="도면 방향">
                <button className={mirroredPlan ? "active" : ""} type="button" aria-pressed={mirroredPlan} onClick={() => setMirroredPlan(true)}>실제 방향 · 왼쪽 진입</button>
                <button className={!mirroredPlan ? "active" : ""} type="button" aria-pressed={!mirroredPlan} onClick={() => setMirroredPlan(false)}>원본 방향</button>
              </div>
            </div>
          </div>
          <div className="floorplan-grid">
            {floorPlans.map((plan) => <figure className="floorplan-card" key={plan.label}><button onClick={() => setPreview({ src: plan.src, alt: plan.alt, mirrored: mirroredPlan })}><img className={mirroredPlan ? "mirrored-plan-image" : undefined} src={plan.src} alt={plan.alt} /><span><Maximize2 size={15} /> 크게 보기</span></button><figcaption><div><strong>{plan.label}</strong><span className="plan-orientation-badge">{mirroredPlan ? "좌우 반전 · 현관 왼쪽 진입" : "원본 · 현관 오른쪽 진입"}</span></div><p>{plan.caption}</p></figcaption></figure>)}
          </div>
          <div className="plan-detail-grid">
            <section className="renovation-points"><div className="reference-card-title"><Ruler size={18} /><div><strong>공사 포인트 7</strong><span>표시 도면 번호와 연결됩니다.</span></div></div>{renovationPoints.map(([number, title, detail]) => <article key={number}><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div></article>)}</section>
            <section className="common-requirements"><span className="reference-overline">COMMON REQUIREMENTS</span><h3>전체 공간 공통 기준</h3><ul><li>가장 작은 방을 제외한 각 침실 붙박이장</li><li>별도 구매 실링팬 설치</li><li>가장 작은 방을 제외한 시스템 에어컨 4대</li><li>정확한 치수와 구조는 현장 실측 후 확정</li></ul></section>
          </div>
        </div>
      ) : null}

      {tab === "concepts" ? (
        <div className="reference-tab-panel">
          <section className="faucet-focus">
            <div className="faucet-focus-icon"><Focus size={22} /></div>
            <div><span className="reference-overline">PINNED IDEA · KITCHEN</span><h2>인출식 + 폭포수 모드 주방 수전</h2><p>앞으로 뽑아 쓸 수 있고 폭포수 토수 모드가 있는 모델. 인덕션 뒤에는 냄비에 바로 물을 받을 수 있는 포트필러도 함께 검토합니다.</p><div className="reference-chips"><span>인출식</span><span>폭포수 모드</span><span>포트필러</span><span>별도 구매 공제</span></div></div>
            <button className="primary-button" onClick={() => showBrief(7, "kitchen")}>슬라이드 7 보기 <ArrowRight size={16} /></button>
          </section>
          <div className="reference-section-heading"><div><span>02 · MOOD & MATERIAL</span><h2>희망 디자인 콘셉트</h2></div><p>밝고 담백한 모던 미니멀</p></div>
          <div className="concept-grid">{concepts.map((concept) => <article className="concept-reference-card" key={concept.title}><button onClick={() => setPreview({ src: concept.src, alt: concept.title })}><img src={concept.src} alt={concept.title} /><span><Maximize2 size={15} /></span></button><div><h3>{concept.title}</h3><p>{concept.description}</p></div></article>)}</div>
          <div className="reference-section-heading idea-index-heading"><div><span>03 · EXISTING IDEAS</span><h2>공간별 기존 아이디어</h2></div><p>각 카드를 누르면 원본 슬라이드로 이동합니다.</p></div>
          <div className="idea-group-grid">{briefGroups.map((group) => <button key={group.id} className={group.id === "kitchen" ? "idea-group-card featured" : "idea-group-card"} onClick={() => showBrief(group.slides[0], group.id)}><header><span>{group.label}</span><small>{group.slides.length}장</small></header><ul>{group.summary.map((item) => <li key={item}>{item}</li>)}</ul><footer>상세 보기 <ArrowRight size={14} /></footer></button>)}</div>
        </div>
      ) : null}

      {tab === "brief" ? (
        <div className="reference-tab-panel">
          <div className="reference-section-heading"><div><span>04 · ORIGINAL BRIEF</span><h2>공간별 상세 요청서</h2></div><p>제공된 PPTX 18장을 이미지로 보존했습니다.</p></div>
          <div className="brief-filter-row"><button className={groupId === "all" ? "active" : ""} onClick={() => { setGroupId("all"); setSelectedSlide(1); }}>전체</button>{briefGroups.map((group) => <button key={group.id} className={groupId === group.id ? "active" : ""} onClick={() => { setGroupId(group.id); setSelectedSlide(group.slides[0]); }}>{group.label}</button>)}</div>
          <section className="brief-viewer">
            <header><div><span>SLIDE {String(selectedSlide).padStart(2, "0")} / 18</span><h3>{selectedTitle}</h3></div><button className="icon-button" onClick={() => setPreview({ src: asset(`brief/slide-${String(selectedSlide).padStart(2, "0")}.jpg`), alt: selectedTitle })} aria-label="현재 슬라이드 크게 보기"><Maximize2 size={18} /></button></header>
            <div className="brief-stage"><button className="brief-arrow previous" onClick={() => moveSlide(-1)} disabled={selectedIndex === 0} aria-label="이전 슬라이드"><ChevronLeft size={24} /></button><img src={asset(`brief/slide-${String(selectedSlide).padStart(2, "0")}.jpg`)} alt={`${selectedSlide}번 슬라이드 ${selectedTitle}`} /><button className="brief-arrow next" onClick={() => moveSlide(1)} disabled={selectedIndex === visibleSlides.length - 1} aria-label="다음 슬라이드"><ChevronRight size={24} /></button></div>
            <div className="brief-thumbnails">{visibleSlides.map((slide) => <button className={selectedSlide === slide ? "active" : ""} key={slide} onClick={() => setSelectedSlide(slide)}><img src={asset(`brief/slide-${String(slide).padStart(2, "0")}.jpg`)} alt="" /><span>{String(slide).padStart(2, "0")}</span></button>)}</div>
          </section>
        </div>
      ) : null}

      {preview ? <ImagePreview src={preview.src} alt={preview.alt} mirrored={preview.mirrored} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}
