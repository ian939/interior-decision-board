import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
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
const livingFitVisual = asset("concepts/living-homecafe-fit-v1.png");
const livingFitSource = "https://blog.naver.com/2n1space/223320590826";

const floorPlans = [
  { src: asset("plans/floorplan-renovation-1.png"), alt: "한신무학 아파트 변경 도면 1", label: "변경 도면 1", caption: "가구 배치 실험실 기준 도면 · 정확한 치수는 현장 실측으로 확정", badge: "배치 기준" },
  { src: asset("plans/floorplan-construction.png"), alt: "공사 포인트 1번부터 7번이 표시된 공사 도면", label: "공사 도면", caption: "확장·수납·아일랜드 계획 7개 지점", badge: "포인트 1–7" },
];

const renovationPoints = [
  ["1", "현관 신발장 확장", "붙박이장 설치 · 중문 필요"],
  ["2", "거실 확장", "베란다 방향 공간 확장"],
  ["3", "침실 확장", "분리벽과 드레스룸 구성"],
  ["4", "침실 확장", "분리벽과 드레스룸 구성"],
  ["5", "붙박이장 제거 후 출입문", "기존 수납을 없애고 아래쪽 벽에 문 설치"],
  ["6", "아일랜드 식탁", "주방 작업대와 수납 확장"],
  ["7", "침실 확장", "보일러실 위치변경(주방 옆 베란다로)"],
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

function ImagePreview({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }): ReactNode {
  return (
    <div className="reference-lightbox" role="dialog" aria-modal="true" aria-label={`${alt} 크게 보기`} onClick={onClose}>
      <button className="reference-lightbox-close" onClick={onClose} aria-label="닫기"><X size={21} /></button>
      <img src={src} alt={alt} onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

export function ProjectReferencesView(): ReactNode {
  const [tab, setTab] = useState<ReferenceTab>("plans");
  const [groupId, setGroupId] = useState("all");
  const [selectedSlide, setSelectedSlide] = useState(7);
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);

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
            <div className="plan-heading-actions"><p>도면을 누르면 크게 볼 수 있습니다.</p></div>
          </div>
          <div className="floorplan-grid">
            {floorPlans.map((plan) => <figure className="floorplan-card" key={plan.label}><button onClick={() => setPreview({ src: plan.src, alt: plan.alt })}><img src={plan.src} alt={plan.alt} /><span><Maximize2 size={15} /> 크게 보기</span></button><figcaption><div><strong>{plan.label}</strong><span className="plan-orientation-badge">{plan.badge}</span></div><p>{plan.caption}</p></figcaption></figure>)}
          </div>
          <div className="plan-detail-grid">
            <section className="renovation-points"><div className="reference-card-title"><Ruler size={18} /><div><strong>공사 포인트 7</strong><span>표시 도면 번호와 연결됩니다.</span></div></div>{renovationPoints.map(([number, title, detail]) => <article key={number}><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div></article>)}</section>
            <section className="common-requirements"><span className="reference-overline">COMMON REQUIREMENTS</span><h3>전체 공간 공통 기준</h3><ul><li>가장 작은 방을 제외한 각 침실 붙박이장</li><li>별도 구매 실링팬 설치</li><li>가장 작은 방을 제외한 시스템 에어컨 4대</li><li>정확한 치수와 구조는 현장 실측 후 확정</li></ul></section>
          </div>
        </div>
      ) : null}

      {tab === "concepts" ? (
        <div className="reference-tab-panel">
          <section className="living-fit-study">
            <header className="living-fit-header">
              <div><span className="reference-overline">LIVING FIT STUDY · BLOG REFERENCE</span><h2>TV월플렉스 + 홈카페 거실 적용 검토</h2><p>변경 도면 1의 거실 약 3,250 × 7,700mm에 블로그의 4개 핵심 요소를 배치했습니다.</p></div>
              <span className="living-fit-verdict"><CheckCircle2 size={16} />조건부 가능</span>
            </header>
            <div className="living-fit-hero">
              <button onClick={() => setPreview({ src: livingFitVisual, alt: "현재 거실에 TV월플렉스와 홈카페 구성을 적용한 개념 시각화" })}><img src={livingFitVisual} alt="현재 거실에 TV월플렉스와 홈카페 구성을 적용한 개념 시각화" /><span><Maximize2 size={15} /> 크게 보기</span></button>
              <div className="living-fit-summary">
                <span className="reference-overline">FIT SUMMARY</span>
                <h3>길이는 충분하고, 폭은 실측이 핵심입니다.</h3>
                <p>TV월·통로·테이블·벤치를 폭 방향으로 더하면 약 3,250mm입니다. 현재 도면의 근사 폭과 같아 걸레받이와 가구 제작 오차를 포함한 현장 실측이 필요합니다.</p>
                <dl><div><dt>현재 거실</dt><dd>약 3,250 × 7,700</dd></div><div><dt>필요 핵심 존</dt><dd>약 3,250 × 5,000</dd></div><div><dt>주동선</dt><dd>900–1,200mm</dd></div><div><dt>테이블–벤치</dt><dd>450–500mm</dd></div></dl>
                <a href={livingFitSource} target="_blank" rel="noreferrer">참고 블로그 원문 <ExternalLink size={14} /></a>
              </div>
            </div>
            <div className="living-fit-analysis">
              <div className="living-fit-plan-card">
                <div><span className="reference-overline">TOP VIEW · APPROX.</span><h3>추천 배치와 필요한 공간</h3></div>
                <svg className="living-fit-plan" viewBox="-430 -450 4110 8600" role="img" aria-label="거실 3250 곱하기 7700 밀리미터 안에 TV월, 테이블, 수납벤치, 아일랜드를 배치한 도면">
                  <rect className="living-room-shell" width="3250" height="7700" rx="90" />
                  <rect className="living-zone-island" x="400" y="300" width="1800" height="800" rx="55" />
                  <text x="1300" y="720">아일랜드 홈바 · 1,800×800</text>
                  <rect className="living-main-path" x="0" y="1200" width="3250" height="900" rx="45" />
                  <text x="1625" y="1730">주동선 900mm 이상</text>
                  <rect className="living-zone-tv" x="0" y="2200" width="400" height="3600" rx="35" />
                  <text className="vertical-label" x="205" y="4000" transform="rotate(-90 205 4000)">TV월플렉스 · 깊이 400</text>
                  <rect className="living-zone-table" x="1400" y="2700" width="800" height="2100" rx="40" />
                  <text className="vertical-label" x="1800" y="3750" transform="rotate(-90 1800 3750)">테이블 · 2,100×800</text>
                  <rect className="living-zone-bench" x="2650" y="2400" width="600" height="2700" rx="35" />
                  <text className="vertical-label" x="2950" y="3750" transform="rotate(-90 2950 3750)">수납벤치 · 깊이 600</text>
                  <line className="living-gap-line" x1="2200" y1="5100" x2="2650" y2="5100" /><text className="gap-label" x="2425" y="5360">450</text>
                  <line className="living-gap-line" x1="400" y1="6100" x2="1400" y2="6100" /><text className="gap-label" x="900" y="6360">1,000</text>
                  <text className="living-balcony-label" x="1625" y="6970">발코니 방향 여유 · 채광</text>
                  <line className="living-dimension" x1="0" y1="-190" x2="3250" y2="-190" /><text className="living-dimension-label" x="1625" y="-255">3,250mm</text>
                  <line className="living-dimension" x1="-190" y1="0" x2="-190" y2="7700" /><text className="living-dimension-label" x="-255" y="3850" transform="rotate(-90 -255 3850)">7,700mm</text>
                </svg>
              </div>
              <div className="living-fit-requirements">
                <span className="reference-overline">REQUIRED CLEARANCE</span><h3>이 구성으로 맞추는 조건</h3>
                <ol><li><strong>TV월플렉스</strong><span>폭 3,200–3,600 · 깊이 400mm 이하</span></li><li><strong>홈카페 테이블</strong><span>블로그와 동일한 2,100 × 800mm</span></li><li><strong>수납벤치</strong><span>폭 약 2,700 · 깊이 600mm, 테이블 좌석 겸용</span></li><li><strong>의자 구성</strong><span>벤치 반대편 위주로 두어 길이 방향 통로 확보</span></li><li><strong>실측 확인</strong><span>가용 폭이 3,250mm 미만이면 TV장 깊이 또는 테이블 폭 축소</span></li></ol>
                <div className="living-fit-caution"><strong>판정</strong><p>그대로 복제하기보다 ‘벤치 좌석 + 반대편 의자’로 조정하면 적용 가능성이 높습니다. 정확한 제작 치수는 벽 마감 후 실측으로 확정하세요.</p></div>
              </div>
            </div>
          </section>
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

      {preview ? <ImagePreview src={preview.src} alt={preview.alt} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}
