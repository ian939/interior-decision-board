import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  allowedTransitions,
  sourceTypeLabels,
  statusDefinitions,
  statusLabel,
  type CardDetail,
  type CardStatus,
  type CardSummary,
  type DashboardResponse,
  type PreferenceValue,
  type Space,
  type TransitionInput,
  type UserSummary,
  type WorkRequest,
} from "@interior/shared";
import {
  Archive,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Columns3,
  Download,
  ExternalLink,
  FileText,
  Heart,
  Home,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  LogOut,
  Map as MapIcon,
  Menu,
  MessageCircle,
  MinusCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Upload,
  X,
} from "lucide-react";
import { ApiError, api, downloadExport, getToken, mediaUrl, setToken } from "./api";
import { ProjectReferencesView } from "./ProjectReferences";

type View = "board" | "references" | "requests" | "settings";

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function compactDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function LoadingScreen(): ReactNode {
  return (
    <div className="loading-screen">
      <div className="brand-mark large"><Home size={24} /></div>
      <LoaderCircle className="spin" size={22} />
      <span>결정의 집을 여는 중…</span>
    </div>
  );
}

export function App(): ReactNode {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("interior:unauthorized", onUnauthorized);
    return () => window.removeEventListener("interior:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const setup = await api.setupStatus();
        if (!active) return;
        setSetupRequired(setup.setupRequired);
        if (getToken()) {
          const session = await api.me();
          if (active) setUser(session.user);
        }
      } catch {
        // The login screen includes a clear offline state.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen setupRequired={setupRequired} onLogin={setUser} />;
  return (
    <AuthenticatedApp
      user={user}
      onLogout={() => {
        setToken(null);
        setUser(null);
      }}
    />
  );
}

function LoginScreen({ setupRequired, onLogin }: { setupRequired: boolean; onLogin: (user: UserSummary) => void }): ReactNode {
  const [role, setRole] = useState<"owner" | "partner">("owner");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const login = useMutation({
    mutationFn: () => api.login(role, password),
    onSuccess: (session) => {
      setToken(session.token);
      onLogin(session.user);
    },
    onError: (loginError) => setError(readableError(loginError)),
  });

  return (
    <main className="login-page">
      <section className="login-visual" aria-hidden="true">
        <div className="blueprint-grid" />
        <div className="room-plan">
          <div className="plan-room room-a"><span>우리의 취향</span></div>
          <div className="plan-room room-b"><Heart size={30} /></div>
          <div className="plan-room room-c"><span>하나씩<br />결정하는 집</span></div>
          <div className="plan-room room-d" />
        </div>
        <div className="visual-copy">
          <span className="eyebrow">INTERIOR DECISION BOARD</span>
          <h1>흩어진 영감을<br />우리의 결정으로.</h1>
          <p>링크를 모으고, 의견을 나누고, 실제 작업 요청까지 한곳에서 정리합니다.</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="brand-row">
            <div className="brand-mark"><Home size={19} /></div>
            <div><strong>결정의 집</strong><span>우리 둘의 인테리어 보드</span></div>
          </div>
          <div className="login-heading">
            <p>다시 만나서 반가워요</p>
            <h2>누구로 들어갈까요?</h2>
          </div>
          {setupRequired ? (
            <div className="notice error-notice">
              <CircleAlert size={18} />
              <div><strong>초기 설정이 필요합니다</strong><span>서버에 두 사용자 비밀번호를 설정한 뒤 재시작하세요.</span></div>
            </div>
          ) : null}
          <div className="person-selector" role="group" aria-label="사용자 선택">
            <button className={role === "owner" ? "selected" : ""} onClick={() => setRole("owner")}>
              <span className="person-avatar avatar-one">나</span><span>나</span>{role === "owner" && <Check size={16} />}
            </button>
            <button className={role === "partner" ? "selected" : ""} onClick={() => setRole("partner")}>
              <span className="person-avatar avatar-two">배</span><span>배우자</span>{role === "partner" && <Check size={16} />}
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              login.mutate();
            }}
          >
            <label className="field-label" htmlFor="password">비밀번호</label>
            <input
              id="password"
              className="text-input large-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호를 입력하세요"
              disabled={setupRequired}
            />
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button full-button" type="submit" disabled={!password || login.isPending || setupRequired}>
              {login.isPending ? <LoaderCircle className="spin" size={18} /> : null}
              들어가기 <ArrowRight size={18} />
            </button>
          </form>
          <p className="login-footnote">두 사람만의 작은 결정 공간입니다.</p>
        </div>
      </section>
    </main>
  );
}

function AuthenticatedApp({ user, onLogout }: { user: UserSummary; onLogout: () => void }): ReactNode {
  const [view, setView] = useState<View>("board");
  const [addOpen, setAddOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const initialCard = new URLSearchParams(window.location.search).get("card");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(initialCard);

  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.cards.some((card) => card.aiStatus === "queued" || card.aiStatus === "processing") ? 3_000 : 12_000;
    },
  });

  function openCard(id: string | null): void {
    setSelectedCardId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("card", id);
    else url.searchParams.delete("card");
    window.history.replaceState({}, "", url);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Home size={19} /></div>
          <div><strong>결정의 집</strong><span>우리 둘의 인테리어</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기"><X size={20} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="주요 메뉴">
          <button className={view === "board" ? "active" : ""} onClick={() => { setView("board"); setMobileMenu(false); }}>
            <Columns3 size={19} /><span>의사결정 보드</span><span className="nav-count">{dashboard.data?.cards.length ?? 0}</span>
          </button>
          <button className={view === "references" ? "active" : ""} onClick={() => { setView("references"); setMobileMenu(false); }}>
            <MapIcon size={19} /><span>도면·아이디어</span>
          </button>
          <button className={view === "requests" ? "active" : ""} onClick={() => { setView("requests"); setMobileMenu(false); }}>
            <ClipboardCheck size={19} /><span>반영 요청</span><span className="nav-count">{dashboard.data?.counts.requested ?? 0}</span>
          </button>
          <button className={view === "settings" ? "active" : ""} onClick={() => { setView("settings"); setMobileMenu(false); }}>
            <Settings size={19} /><span>설정</span>
          </button>
        </nav>
        <div className="sidebar-guide">
          <div className="guide-icon"><Bot size={18} /></div>
          <strong>텔레그램에서도</strong>
          <p>봇에게 링크를 보내면<br />결정 필요에 자동 등록돼요.</p>
        </div>
        <div className="sidebar-profile">
          <span className={`person-avatar ${user.role === "owner" ? "avatar-one" : "avatar-two"}`}>{user.name.slice(0, 1)}</span>
          <div><strong>{user.name}</strong><span>인테리어 메이트</span></div>
          <button className="icon-button" onClick={onLogout} title="로그아웃"><LogOut size={17} /></button>
        </div>
      </aside>
      {mobileMenu ? <button className="sidebar-backdrop" onClick={() => setMobileMenu(false)} aria-label="메뉴 닫기" /> : null}

      <main className="main-content">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setMobileMenu(true)} aria-label="메뉴 열기"><Menu size={22} /></button>
          <div className="brand-mark small"><Home size={16} /></div><strong>결정의 집</strong>
          <button className="icon-button" onClick={() => setAddOpen(true)} aria-label="자료 추가"><Plus size={21} /></button>
        </header>

        {view === "board" ? (
          <BoardView
            dashboard={dashboard.data}
            loading={dashboard.isLoading}
            error={dashboard.error}
            onRetry={() => void dashboard.refetch()}
            onOpenCard={openCard}
            onAdd={() => setAddOpen(true)}
          />
        ) : null}
        {view === "references" ? <ProjectReferencesView /> : null}
        {view === "requests" ? <WorkRequestsView onOpenCard={openCard} /> : null}
        {view === "settings" ? <SettingsView user={user} /> : null}
      </main>

      {addOpen ? <AddSourceDialog onClose={() => setAddOpen(false)} onCreated={(id) => { setAddOpen(false); openCard(id); }} /> : null}
      {selectedCardId ? (
        <CardDrawer
          cardId={selectedCardId}
          currentUser={user}
          users={dashboard.data?.users ?? [user]}
          spaces={dashboard.data?.spaces ?? []}
          onClose={() => openCard(null)}
        />
      ) : null}
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }): ReactNode {
  return (
    <div className="page-header">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }): ReactNode {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

function BoardView({
  dashboard,
  loading,
  error,
  onRetry,
  onOpenCard,
  onAdd,
}: {
  dashboard?: DashboardResponse;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onOpenCard: (id: string) => void;
  onAdd: () => void;
}): ReactNode {
  const [search, setSearch] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [mobileStatus, setMobileStatus] = useState<CardStatus>("decision_needed");
  const cards = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (dashboard?.cards ?? []).filter((card) => {
      if (needle && !`${card.title} ${card.summary ?? ""} ${card.topicTags.join(" ")}`.toLowerCase().includes(needle)) return false;
      if (spaceId && !card.spaces.some((space) => space.id === spaceId)) return false;
      if (sourceType && card.sourceType !== sourceType) return false;
      return true;
    });
  }, [dashboard?.cards, search, sourceType, spaceId]);

  if (loading) return <LoadingScreen />;
  if (error || !dashboard) {
    return <div className="content-pad"><EmptyState icon={<CircleAlert />} title="로컬 서버에 연결할 수 없어요" description="PC 서버와 HTTPS 터널이 실행 중인지 확인하세요." action={<button className="secondary-button" onClick={onRetry}><RefreshCw size={16} /> 다시 연결</button>} /></div>;
  }

  return (
    <div className="board-page">
      <div className="content-pad board-top">
        <PageHeader
          eyebrow="OUR HOME, OUR CHOICE"
          title="오늘은 무엇을 결정할까요?"
          description="모아둔 영감을 함께 살펴보고, 우리 집에 맞는 선택으로 바꿔보세요."
          action={<button className="primary-button desktop-only" onClick={onAdd}><Plus size={18} /> 자료 추가</button>}
        />
        <div className="board-summary">
          <div className="summary-main"><span>전체 자료</span><strong>{dashboard.cards.length}</strong><small>개</small></div>
          <div className="summary-divider" />
          <div><span className="status-dot ochre" />결정 필요 <strong>{dashboard.counts.decision_needed}</strong></div>
          <div><span className="status-dot blue" />확인 중 <strong>{dashboard.counts.reviewing}</strong></div>
          <div><span className="status-dot green" />승인 <strong>{dashboard.counts.approved}</strong></div>
          <div><span className="status-dot terracotta" />반영 요청 <strong>{dashboard.counts.requested}</strong></div>
        </div>
        <div className="filter-bar">
          <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목, 요약, 태그 검색" /></label>
          <label className="select-field"><span>공간</span><select value={spaceId} onChange={(event) => setSpaceId(event.target.value)}><option value="">전체 공간</option>{dashboard.spaces.filter((space) => space.active).map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select><ChevronDown size={15} /></label>
          <label className="select-field"><span>출처</span><select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="">전체 출처</option>{Object.entries(sourceTypeLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><ChevronDown size={15} /></label>
          {(search || spaceId || sourceType) ? <button className="text-button" onClick={() => { setSearch(""); setSpaceId(""); setSourceType(""); }}>필터 초기화</button> : null}
        </div>
        <div className="mobile-status-tabs" role="tablist" aria-label="칸반 상태">
          {statusDefinitions.map((status) => <button key={status.id} className={mobileStatus === status.id ? "active" : ""} onClick={() => setMobileStatus(status.id)}><span>{status.label}</span><small>{cards.filter((card) => card.status === status.id).length}</small></button>)}
        </div>
      </div>
      <div className="kanban-scroll">
        <div className="kanban-board">
          {statusDefinitions.map((definition) => {
            const columnCards = cards.filter((card) => card.status === definition.id);
            return (
              <section key={definition.id} className={`kanban-column mobile-${mobileStatus === definition.id ? "visible" : "hidden"}`}>
                <header className="column-header"><div><span className={`status-dot ${definition.color}`} /><strong>{definition.label}</strong><span className="column-count">{columnCards.length}</span></div><button className="icon-button subtle" aria-label={`${definition.label} 메뉴`}><MoreHorizontal size={18} /></button></header>
                <p className="column-description">{definition.description}</p>
                <div className="column-cards">
                  {columnCards.map((card) => <DecisionCard key={card.id} card={card} users={dashboard.users} onClick={() => onOpenCard(card.id)} />)}
                  {columnCards.length === 0 ? <div className="column-empty"><span>비어 있어요</span><small>{definition.id === "decision_needed" ? "새 자료를 추가해보세요" : "카드를 이곳으로 옮겨보세요"}</small></div> : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DecisionCard({ card, users, onClick }: { card: CardSummary; users: UserSummary[]; onClick: () => void }): ReactNode {
  const thumbnail = mediaUrl(card.thumbnailUrl);
  return (
    <article className="decision-card" onClick={onClick} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onClick(); }}>
      {thumbnail ? <div className="card-image"><img src={thumbnail} alt="" loading="lazy" /><span className="source-badge">{sourceTypeLabels[card.sourceType]}</span></div> : <div className={`card-image placeholder source-${card.sourceType}`}><SourceIcon type={card.sourceType} /><span className="source-badge">{sourceTypeLabels[card.sourceType]}</span></div>}
      <div className="card-body">
        <div className="card-meta-row"><span>{compactDate(card.createdAt)}</span>{card.aiStatus === "queued" || card.aiStatus === "processing" ? <span className="ai-working"><LoaderCircle className="spin" size={13} /> AI 정리 중</span> : null}{card.aiStatus === "failed" ? <span className="ai-failed"><CircleAlert size={13} /> 수동 확인</span> : null}</div>
        <h3>{card.title}</h3>
        {card.summary ? <p>{card.summary}</p> : <p className="muted-copy">요약이 아직 없습니다.</p>}
        <div className="chip-row">{card.spaces.map((space) => <span className="chip space-chip" key={space.id}>{space.name}</span>)}{card.topicTags.slice(0, 2).map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>
      </div>
      <footer className="card-footer">
        <div className="preference-people">{users.map((user) => <span key={user.id} className={`mini-person pref-${card.preferences[user.id] ?? "none"}`} title={`${user.name}: ${card.preferences[user.id] ?? "의견 없음"}`}>{user.name.slice(0, 1)}</span>)}</div>
        <div className="card-counters">{card.relatedSourceCount > 0 ? <span><Paperclip size={14} />{card.relatedSourceCount}</span> : null}<span><MessageCircle size={14} />{card.commentCount}</span></div>
      </footer>
    </article>
  );
}

function SourceIcon({ type }: { type: CardSummary["sourceType"] }): ReactNode {
  if (type === "image") return <ImageIcon size={34} />;
  if (type === "file") return <FileText size={34} />;
  if (type === "youtube") return <span className="play-symbol">▶</span>;
  return <Link2 size={34} />;
}

function DialogShell({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }): ReactNode {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal-card ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button></header>
        {children}
      </section>
    </div>
  );
}

function AddSourceDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }): ReactNode {
  const [mode, setMode] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => mode === "url" ? api.addUrl(url, note) : file ? api.addFile(file, note) : Promise.reject(new Error("파일을 선택하세요.")),
    onSuccess: (card) => onCreated(card.id),
    onError: (mutationError) => setError(readableError(mutationError)),
  });
  return (
    <DialogShell title="새 자료 추가" description="링크나 파일을 보내면 결정 필요 칸에서 시작합니다." onClose={onClose}>
      <div className="segmented-control"><button className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}><Link2 size={17} />URL</button><button className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}><Upload size={17} />파일</button></div>
      <form className="modal-form" onSubmit={(event) => { event.preventDefault(); setError(null); mutation.mutate(); }}>
        {mode === "url" ? <><label className="field-label" htmlFor="source-url">원문 URL</label><input id="source-url" className="text-input" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/…" autoFocus /></> : <label className={`file-drop ${file ? "has-file" : ""}`}><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><div className="file-drop-icon">{file ? <Check size={22} /> : <Upload size={22} />}</div><strong>{file ? file.name : "파일을 선택하거나 놓아주세요"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "이미지, PDF, 텍스트, DOCX · 최대 20MB"}</span></label>}
        <label className="field-label" htmlFor="source-note">메모 <span>선택</span></label><textarea id="source-note" className="text-area" value={note} onChange={(event) => setNote(event.target.value)} placeholder="왜 저장했는지, 같이 볼 포인트를 적어두세요." rows={3} />
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>취소</button><button className="primary-button" type="submit" disabled={mutation.isPending || (mode === "url" ? !url : !file)}>{mutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}결정 필요에 추가</button></div>
      </form>
    </DialogShell>
  );
}

function CardDrawer({ cardId, currentUser, users, spaces, onClose }: { cardId: string; currentUser: UserSummary; users: UserSummary[]; spaces: Space[]; onClose: () => void }): ReactNode {
  const queryClient = useQueryClient();
  const cardQuery = useQuery({ queryKey: ["card", cardId], queryFn: () => api.card(cardId), refetchInterval: 5_000 });
  const [error, setError] = useState<string | null>(null);
  const invalidate = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["card", cardId] }), queryClient.invalidateQueries({ queryKey: ["dashboard"] }), queryClient.invalidateQueries({ queryKey: ["work-requests"] })]);
  };
  if (cardQuery.isLoading) return <div className="drawer-backdrop"><aside className="card-drawer"><LoadingScreen /></aside></div>;
  if (!cardQuery.data) return <div className="drawer-backdrop"><aside className="card-drawer"><EmptyState icon={<CircleAlert />} title="카드를 열 수 없어요" description={readableError(cardQuery.error)} action={<button className="secondary-button" onClick={onClose}>닫기</button>} /></aside></div>;
  const card = cardQuery.data;
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="card-drawer" aria-label="카드 상세">
        <header className="drawer-header"><div className={`status-pill status-${card.status}`}><span />{statusLabel(card.status)}</div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={21} /></button></header>
        <div className="drawer-scroll">
          <CardHero card={card} />
          {error ? <div className="notice error-notice"><CircleAlert size={18} /><span>{error}</span><button className="icon-button" onClick={() => setError(null)}><X size={15} /></button></div> : null}
          <PreferencePanel card={card} users={users} currentUser={currentUser} onChange={async (value) => { try { await api.preference(card.id, value); await invalidate(); } catch (mutationError) { setError(readableError(mutationError)); } }} />
          <CardInformation card={card} spaces={spaces} onSaved={invalidate} onError={setError} />
          <TransitionPanel card={card} spaces={spaces} onChanged={invalidate} onError={setError} />
          <RelatedPanel card={card} onChanged={invalidate} onError={setError} />
          <CommentsPanel card={card} onChanged={invalidate} onError={setError} />
          <ActivityPanel card={card} />
        </div>
      </aside>
    </div>
  );
}

function CardHero({ card }: { card: CardDetail }): ReactNode {
  const thumbnail = mediaUrl(card.thumbnailUrl);
  const sourceAttachments = card.attachments.filter((attachment) => attachment.kind === "source");
  return <section className="card-hero">{thumbnail ? <div className="hero-image"><img src={thumbnail} alt="" /></div> : <div className={`hero-image placeholder source-${card.sourceType}`}><SourceIcon type={card.sourceType} /></div>}<div className="hero-content"><div className="hero-source"><span>{sourceTypeLabels[card.sourceType]}</span><span>·</span><span>{card.sourceChannel === "telegram" ? "Telegram" : "Web"}</span><span>·</span><span>{dateTime(card.createdAt)}</span></div><h2>{card.title}</h2>{card.summary ? <p>{card.summary}</p> : <p className="muted-copy">{card.aiStatus === "failed" ? "자동 요약에 실패했습니다. 원문을 직접 확인해 주세요." : "자료를 정리하고 있습니다."}</p>}{card.sourceNote ? <blockquote>{card.sourceNote}</blockquote> : null}<div className="hero-actions">{card.sourceUrl ? <a className="secondary-button" href={card.sourceUrl} target="_blank" rel="noreferrer">원문 열기 <ExternalLink size={16} /></a> : null}{card.aiStatus === "queued" || card.aiStatus === "processing" ? <span className="ai-working"><LoaderCircle className="spin" size={14} /> Claude가 정리 중</span> : null}</div>{sourceAttachments.length > 0 ? <div className="source-attachments">{sourceAttachments.map((attachment) => <a key={attachment.id} href={mediaUrl(attachment.url) ?? undefined} target="_blank" rel="noreferrer"><Paperclip size={14} /><span>{attachment.originalName}</span><small>{formatFileSize(attachment.size)}</small><ExternalLink size={13} /></a>)}</div> : null}</div></section>;
}

const preferenceOptions: Array<{ value: PreferenceValue; label: string; icon: ReactNode }> = [
  { value: "like", label: "좋아요", icon: <ThumbsUp size={17} /> },
  { value: "dislike", label: "별로예요", icon: <ThumbsDown size={17} /> },
  { value: "hold", label: "보류", icon: <MinusCircle size={17} /> },
];

function PreferencePanel({ card, users, currentUser, onChange }: { card: CardDetail; users: UserSummary[]; currentUser: UserSummary; onChange: (value: PreferenceValue | null) => Promise<void> }): ReactNode {
  const current = card.preferences[currentUser.id];
  return <section className="detail-section preference-panel"><div className="section-heading"><div><span className="section-kicker">QUICK OPINION</span><h3>나는 어떻게 생각하나요?</h3></div><div className="couple-opinions">{users.map((user) => <span key={user.id} className={`mini-person pref-${card.preferences[user.id] ?? "none"}`} title={`${user.name}: ${card.preferences[user.id] ?? "미정"}`}>{user.name.slice(0, 1)}</span>)}</div></div><div className="preference-buttons">{preferenceOptions.map((option) => <button key={option.value} className={current === option.value ? `active pref-${option.value}` : ""} onClick={() => void onChange(current === option.value ? null : option.value)}>{option.icon}{option.label}</button>)}</div></section>;
}

function CardInformation({ card, spaces, onSaved, onError }: { card: CardDetail; spaces: Space[]; onSaved: () => Promise<void>; onError: (error: string) => void }): ReactNode {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(() => card.spaces.map((space) => space.id));
  const mutation = useMutation({ mutationFn: () => api.updateCard(card.id, { spaceIds: selected }), onSuccess: async () => { setEditing(false); await onSaved(); }, onError: (error) => onError(readableError(error)) });
  useEffect(() => setSelected(card.spaces.map((space) => space.id)), [card.spaces]);
  return <section className="detail-section"><div className="section-heading"><div><span className="section-kicker">CLASSIFICATION</span><h3>공간과 주제</h3></div><button className="text-button" onClick={() => setEditing((value) => !value)}>{editing ? "취소" : "공간 수정"}</button></div>{editing ? <><div className="space-grid">{spaces.filter((space) => space.active && !space.isUnassigned).map((space) => <label key={space.id} className={selected.includes(space.id) ? "selected" : ""}><input type="checkbox" checked={selected.includes(space.id)} onChange={() => setSelected((current) => current.includes(space.id) ? current.filter((id) => id !== space.id) : [...current, space.id])} />{space.name}<Check size={14} /></label>)}</div><button className="secondary-button save-space" onClick={() => mutation.mutate()} disabled={mutation.isPending}>저장</button></> : <div className="detail-chips">{card.spaces.length ? card.spaces.map((space) => <span className="chip space-chip" key={space.id}>{space.name}</span>) : <span className="empty-inline">확인 중으로 옮길 때 공간을 정합니다.</span>}{card.topicTags.map((tag) => <span className="chip" key={tag}>{tag}</span>)}</div>}</section>;
}

function TransitionPanel({ card, spaces, onChanged, onError }: { card: CardDetail; spaces: Space[]; onChanged: () => Promise<void>; onError: (error: string) => void }): ReactNode {
  const [target, setTarget] = useState<CardStatus | null>(null);
  const [reason, setReason] = useState("");
  const [spaceIds, setSpaceIds] = useState(card.spaces.map((space) => space.id));
  const [requestTitle, setRequestTitle] = useState(card.title);
  const [requestBody, setRequestBody] = useState(card.summary ?? "");
  const draft = useMutation({ mutationFn: () => api.workRequestDraft(card.id), onSuccess: (result) => setRequestBody(result.content), onError: (error) => onError(readableError(error)) });
  const transition = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("이동할 상태를 선택하세요.");
      const input: TransitionInput = { status: target };
      if (target === "reviewing") input.spaceIds = spaceIds;
      if (reason.trim()) input.reason = reason;
      if (target === "requested") { input.workRequestTitle = requestTitle; input.workRequestBody = requestBody; }
      return api.transition(card.id, input);
    },
    onSuccess: async () => { setTarget(null); setReason(""); await onChanged(); },
    onError: (error) => onError(readableError(error)),
  });
  const targets = allowedTransitions[card.status];
  return <section className="detail-section transition-section"><div className="section-heading"><div><span className="section-kicker">NEXT DECISION</span><h3>다음 상태로 이동</h3></div></div><div className="transition-options">{targets.map((status) => <button key={status} className={target === status ? "active" : ""} onClick={() => setTarget(status)}><span className={`status-dot ${statusDefinitions.find((item) => item.id === status)?.color}`} />{statusLabel(status)}<ArrowRight size={15} /></button>)}</div>{target ? <div className="transition-form">{target === "reviewing" ? <><label className="field-label">검토할 공간 <span>필수</span></label><div className="space-grid compact">{spaces.filter((space) => space.active && !space.isUnassigned).map((space) => <label key={space.id} className={spaceIds.includes(space.id) ? "selected" : ""}><input type="checkbox" checked={spaceIds.includes(space.id)} onChange={() => setSpaceIds((current) => current.includes(space.id) ? current.filter((id) => id !== space.id) : [...current, space.id])} />{space.name}<Check size={14} /></label>)}</div></> : null}{target === "supplement" || target === "dropped" || target === "approved" || (target === "reviewing" && card.status === "approved") ? <><label className="field-label" htmlFor="transition-reason">{target === "supplement" ? "무엇을 더 확인할까요?" : target === "dropped" ? "드롭하는 이유" : target === "approved" ? "승인 메모 (선택)" : "승인을 되돌리는 이유 (선택)"}</label><textarea id="transition-reason" className="text-area" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></> : null}{target === "requested" ? <><div className="request-draft-row"><label className="field-label">업체에 전달할 요청</label><button className="text-button" onClick={() => draft.mutate()} disabled={draft.isPending}>{draft.isPending ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}AI 초안</button></div><input className="text-input" value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder="요청 제목" /><textarea className="text-area" rows={5} value={requestBody} onChange={(event) => setRequestBody(event.target.value)} placeholder="구체적인 작업 요청 내용을 적어주세요." /></> : null}<div className="transition-actions"><button className="secondary-button" onClick={() => setTarget(null)}>취소</button><button className="primary-button" onClick={() => transition.mutate()} disabled={transition.isPending}>{transition.isPending ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{statusLabel(target)}로 이동</button></div></div> : null}</section>;
}

function RelatedPanel({ card, onChanged, onError }: { card: CardDetail; onChanged: () => Promise<void>; onError: (error: string) => void }): ReactNode {
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const addUrl = useMutation({ mutationFn: () => api.addRelatedUrl(card.id, url), onSuccess: async () => { setUrl(""); await onChanged(); }, onError: (error) => onError(readableError(error)) });
  const addFile = useMutation({ mutationFn: (file: File) => api.addRelatedFile(card.id, file), onSuccess: onChanged, onError: (error) => onError(readableError(error)) });
  const compare = useMutation({ mutationFn: () => api.compare(card.id), onSuccess: async () => { await onChanged(); }, onError: (error) => onError(readableError(error)) });
  return <section className="detail-section"><div className="section-heading"><div><span className="section-kicker">SUPPLEMENT</span><h3>보완 자료와 비교</h3></div>{card.relatedSources.length > 0 ? <button className="secondary-button small-button" onClick={() => compare.mutate()} disabled={compare.isPending}>{compare.isPending ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}비교 초안</button> : null}</div>{card.supplementRequest ? <div className="supplement-question"><CircleAlert size={16} /><span>{card.supplementRequest}</span></div> : null}<div className="related-list">{card.relatedSources.map((source) => <article key={source.id} className="related-item">{mediaUrl(source.thumbnailUrl) ? <img src={mediaUrl(source.thumbnailUrl)!} alt="" /> : <div className="related-placeholder"><SourceIcon type={source.sourceType} /></div>}<div><span>{sourceTypeLabels[source.sourceType]}</span><strong>{source.title}</strong><p>{source.summary ?? (source.aiStatus === "queued" || source.aiStatus === "processing" ? "자료를 정리하는 중입니다." : "요약 없음")}</p></div>{source.url ? <a href={source.url} target="_blank" rel="noreferrer" aria-label="원문 열기"><ExternalLink size={16} /></a> : null}</article>)}</div>{card.comparison ? <div className="comparison-box"><div><Sparkles size={16} /><strong>AI 비교 초안</strong><span>{dateTime(card.comparison.createdAt)}</span></div><div className="comparison-content">{card.comparison.content}</div></div> : null}<div className="related-add"><input className="text-input" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="비교할 URL 붙여넣기" /><button className="secondary-button" onClick={() => addUrl.mutate()} disabled={!url || addUrl.isPending}><Link2 size={16} />추가</button><input ref={fileRef} type="file" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) addFile.mutate(file); event.currentTarget.value = ""; }} /><button className="icon-button bordered" onClick={() => fileRef.current?.click()} title="파일 첨부"><Paperclip size={17} /></button></div></section>;
}

function CommentsPanel({ card, onChanged, onError }: { card: CardDetail; onChanged: () => Promise<void>; onError: (error: string) => void }): ReactNode {
  const [body, setBody] = useState("");
  const mutation = useMutation({ mutationFn: () => api.comment(card.id, body), onSuccess: async () => { setBody(""); await onChanged(); }, onError: (error) => onError(readableError(error)) });
  return <section className="detail-section"><div className="section-heading"><div><span className="section-kicker">CONVERSATION</span><h3>우리의 이야기 <small>{card.comments.length}</small></h3></div></div><div className="comment-list">{card.comments.map((comment) => <article className="comment" key={comment.id}><span className={`person-avatar small ${comment.author.role === "owner" ? "avatar-one" : "avatar-two"}`}>{comment.author.name.slice(0, 1)}</span><div><header><strong>{comment.author.name}</strong><time>{dateTime(comment.createdAt)}</time></header><p>{comment.body}</p></div></article>)}{card.comments.length === 0 ? <p className="empty-inline">첫 의견을 남겨보세요.</p> : null}</div><form className="comment-form" onSubmit={(event) => { event.preventDefault(); if (body.trim()) mutation.mutate(); }}><textarea className="text-area" rows={2} value={body} onChange={(event) => setBody(event.target.value)} placeholder="이 자료에 대한 생각을 남겨주세요." /><button className="primary-button" type="submit" disabled={!body.trim() || mutation.isPending}>등록</button></form></section>;
}

function ActivityPanel({ card }: { card: CardDetail }): ReactNode {
  return <section className="detail-section activity-section"><div className="section-heading"><div><span className="section-kicker">HISTORY</span><h3>결정 기록</h3></div></div><div className="timeline">{card.activities.map((activity) => <div className="timeline-item" key={activity.id}><span className="timeline-dot" /><div><p><strong>{activity.actor?.name ?? "시스템"}</strong> · {activity.detail ?? activity.action}</p><time>{dateTime(activity.createdAt)}</time></div></div>)}</div></section>;
}

function WorkRequestsView({ onOpenCard }: { onOpenCard: (id: string) => void }): ReactNode {
  const queryClient = useQueryClient();
  const work = useQuery({ queryKey: ["work-requests"], queryFn: api.workRequests });
  const update = useMutation({ mutationFn: ({ id, completed }: { id: string; completed: boolean }) => api.updateWorkRequest(id, { completed }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["work-requests"] }) });
  const [exportError, setExportError] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const result = new Map<string, WorkRequest[]>();
    for (const item of work.data?.items ?? []) {
      const key = item.spaces.map((space) => space.name).join(", ") || "공간 미지정";
      result.set(key, [...(result.get(key) ?? []), item]);
    }
    return result;
  }, [work.data]);
  return <div className="content-pad content-page"><PageHeader eyebrow="HANDOFF LIST" title="반영 요청" description="승인한 아이디어를 실제 인테리어 작업 목록으로 정리했습니다." action={<div className="header-actions"><button className="secondary-button" onClick={() => void downloadExport("csv").catch((error) => setExportError(readableError(error)))}><Download size={16} />CSV</button><button className="secondary-button" onClick={() => void downloadExport("markdown").catch((error) => setExportError(readableError(error)))}><Download size={16} />Markdown</button></div>} />{exportError ? <p className="form-error">{exportError}</p> : null}{work.isLoading ? <LoadingScreen /> : grouped.size === 0 ? <EmptyState icon={<ClipboardCheck />} title="아직 반영 요청이 없어요" description="승인된 카드를 반영 요청으로 옮기면 공간별 목록이 만들어집니다." /> : <div className="request-groups">{[...grouped.entries()].map(([space, items]) => <section className="request-group" key={space}><header><div><span className="room-icon"><Home size={17} /></span><h2>{space}</h2><span>{items.length}</span></div><small>{items.filter((item) => item.completed).length}/{items.length} 완료</small></header><div className="request-list">{items.map((item) => <article className={item.completed ? "completed" : ""} key={item.id}><button className="request-check" onClick={() => update.mutate({ id: item.id, completed: !item.completed })}>{item.completed ? <CheckCircle2 size={22} /> : <span />}</button><div onClick={() => onOpenCard(item.cardId)} role="button" tabIndex={0}><h3>{item.title}</h3><p>{item.body}</p><footer><span>{dateTime(item.updatedAt)}</span>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>참고 원문 <ExternalLink size={13} /></a> : null}</footer></div></article>)}</div></section>)}</div>}</div>;
}

function SettingsView({ user }: { user: UserSummary }): ReactNode {
  const queryClient = useQueryClient();
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 10_000 });
  const spaces = useQuery({ queryKey: ["spaces"], queryFn: api.spaces });
  const [newSpace, setNewSpace] = useState("");
  const add = useMutation({ mutationFn: () => api.addSpace(newSpace), onSuccess: async () => { setNewSpace(""); await queryClient.invalidateQueries({ queryKey: ["spaces"] }); await queryClient.invalidateQueries({ queryKey: ["dashboard"] }); } });
  const toggle = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => api.updateSpace(id, { active }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["spaces"] }); await queryClient.invalidateQueries({ queryKey: ["dashboard"] }); } });
  return <div className="content-pad content-page settings-page"><PageHeader eyebrow="SETTINGS" title="우리 집 설정" description="공간 이름과 로컬 서비스 연결 상태를 관리합니다." /><div className="settings-grid"><section className="settings-card"><div className="settings-card-header"><div className="settings-icon"><Home size={19} /></div><div><h2>공간</h2><p>카드를 확인 중으로 옮길 때 선택할 공간입니다.</p></div></div><div className="space-settings-list">{spaces.data?.spaces.map((space) => <div key={space.id}><span className={!space.active ? "inactive" : ""}>{space.name}{space.isUnassigned ? <small>기본</small> : null}</span><button className={`toggle ${space.active ? "on" : ""}`} onClick={() => toggle.mutate({ id: space.id, active: !space.active })} aria-label={`${space.name} ${space.active ? "숨기기" : "표시"}`}><span /></button></div>)}</div><form className="inline-add" onSubmit={(event) => { event.preventDefault(); if (newSpace.trim()) add.mutate(); }}><input className="text-input" value={newSpace} onChange={(event) => setNewSpace(event.target.value)} placeholder="새 공간 이름" /><button className="secondary-button" type="submit" disabled={!newSpace.trim()}><Plus size={16} />추가</button></form></section><section className="settings-card"><div className="settings-card-header"><div className="settings-icon"><Bot size={19} /></div><div><h2>자동화 상태</h2><p>로컬 PC에서 실행 중인 서비스입니다.</p></div></div><div className="status-list"><StatusRow label="로컬 API" ok={health.data?.ok === true} detail={health.data?.ok ? "정상 연결" : "연결 확인 중"} /><StatusRow label="Claude 작업 큐" ok={(health.data?.queue.failed ?? 0) === 0} detail={`대기 ${health.data?.queue.queued ?? 0} · 처리 ${health.data?.queue.processing ?? 0} · 실패 ${health.data?.queue.failed ?? 0}`} /><StatusRow label="텔레그램 봇" ok={health.data?.telegramConfigured === true} detail={health.data?.telegramConfigured ? "토큰 연결됨" : "토큰 설정 필요"} /></div></section><section className="settings-card"><div className="settings-card-header"><div className="settings-icon"><Settings size={19} /></div><div><h2>내 계정</h2><p>현재 로그인한 사용자입니다.</p></div></div><div className="account-summary"><span className={`person-avatar ${user.role === "owner" ? "avatar-one" : "avatar-two"}`}>{user.name.slice(0, 1)}</span><div><strong>{user.name}</strong><span>{user.role === "owner" ? "본인" : "배우자"} 계정</span></div></div><div className="notice"><CircleAlert size={17} /><span>비밀번호 변경은 현재 로컬 서버 설정으로 관리합니다. 운영 배포 후 웹 변경 기능을 추가할 수 있습니다.</span></div></section><section className="settings-card"><div className="settings-card-header"><div className="settings-icon"><Archive size={19} /></div><div><h2>데이터 보호</h2><p>데이터는 이 PC의 로컬 저장소에 있습니다.</p></div></div><ul className="plain-list"><li><Check size={15} />SQLite 데이터베이스</li><li><Check size={15} />업로드 파일 로컬 보관</li><li><Check size={15} />공개 GitHub 저장소와 분리</li></ul><p className="settings-hint">자동 백업 스크립트는 배포 설정 단계에서 PC 시작 작업과 함께 등록합니다.</p></section></div></div>;
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }): ReactNode {
  return <div><span className={`connection-dot ${ok ? "ok" : "waiting"}`} /><div><strong>{label}</strong><span>{detail}</span></div><span className={`status-word ${ok ? "ok" : "waiting"}`}>{ok ? "정상" : "확인 필요"}</span></div>;
}
