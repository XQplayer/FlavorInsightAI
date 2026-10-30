import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, CalendarDays, Eye, Users } from 'lucide-react';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import { analyticsEnabled, analyticsReadOnly, fetchAnalyticsSummary, fetchSearchStats, recordVisit, supabase } from '../lib/supabase';

const PANEL_HEIGHT = 240;

const validCount = value => {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
};

export default function SearchInsights({ isEnglish, onSelect }) {
  const panelRef = useRef(null);
  const [width, setWidth] = useState(900);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineReady, setOnlineReady] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total_visits: 0, total_searches: 0, today_searches: 0 });
  const [status, setStatus] = useState(analyticsEnabled ? 'loading' : 'unconfigured');

  useEffect(() => {
    if (window.location.hash !== '#database-activity') return undefined;
    const frame = window.requestAnimationFrame(() => document.getElementById('database-activity')?.scrollIntoView({ block: 'start' }));
    return () => window.cancelAnimationFrame(frame);
  }, [status]);

  useEffect(() => {
    if (!panelRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [items.length]);

  useEffect(() => {
    if (!analyticsEnabled) return undefined;
    let active = true;
    const refresh = () => Promise.allSettled([fetchSearchStats(30), fetchAnalyticsSummary()])
      .then(([searchResult, summaryResult]) => {
        if (!active) return;
        if (summaryResult.status !== 'fulfilled') throw summaryResult.reason;
        const totals = summaryResult.value;
        if (!totals || ['total_visits', 'total_searches', 'today_searches']
          .some(key => totals[key] == null || !Number.isFinite(Number(totals[key])) || Number(totals[key]) < 0)) {
          throw new Error('Analytics summary is incomplete');
        }
        const data = searchResult.status === 'fulfilled' ? searchResult.value : [];
        setItems(Array.isArray(data) ? data.filter(item => item?.cas && validCount(item.search_count) > 0) : []);
        setSummary({
          total_visits: validCount(totals?.total_visits),
          total_searches: validCount(totals?.total_searches),
          today_searches: validCount(totals?.today_searches),
        });
        setStatus('ready');
      })
      .catch(() => { if (active) setStatus('error'); });
    if (!analyticsReadOnly && !sessionStorage.getItem('flavor-visit-recorded')) {
      sessionStorage.setItem('flavor-visit-recorded', 'pending');
      recordVisit()
        .then(recorded => {
          if (!recorded) return;
          sessionStorage.setItem('flavor-visit-recorded', '1');
          refresh();
        })
        .catch(() => sessionStorage.removeItem('flavor-visit-recorded'));
    }
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('flavor-search-recorded', refresh);

    const presenceKey = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const channel = supabase.channel('flavor-threshold-online', { config: { presence: { key: presenceKey } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        const count = Object.values(channel.presenceState()).reduce((sum, presences) => sum + presences.length, 0);
        if (active) {
          setOnlineCount(count);
          setOnlineReady(true);
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED' && !analyticsReadOnly) {
          channel.track({ online_at: new Date().toISOString() })
            .catch(() => { if (active) setOnlineReady(false); });
        }
        if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')) setOnlineReady(false);
      });

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('flavor-search-recorded', refresh);
      supabase.removeChannel(channel);
    };
  }, []);

  const leaves = useMemo(() => {
    if (!items.length) return [];
    const root = hierarchy({ children: items })
      .sum(item => Number(item.search_count || 0))
      .sort((a, b) => b.value - a.value);
    treemap().size([width, PANEL_HEIGHT]).paddingInner(3).round(true).tile(treemapSquarify.ratio(1.2))(root);
    return root.leaves();
  }, [items, width]);

  const maxCount = Math.max(1, ...items.map(item => Number(item.search_count || 0)));

  return (
    <section id="database-activity" className="search-insights" aria-labelledby="search-insights-title" data-status={status}>
      <div className="search-insights-heading">
        <div>
          <span className="search-insights-kicker"><Activity size={15} /> {isEnglish ? 'Research database activity' : '科研数据库动态'}</span>
          <h2 id="search-insights-title">{isEnglish ? 'Visits and compound searches' : '访问与化合物检索统计'}</h2>
          <p>{isEnglish ? 'Real counts from the configured analytics service; refreshed every 30 seconds.' : '仅展示已连接统计服务的真实记录，每 30 秒更新。'}</p>
        </div>
        <span className={`search-insights-state search-insights-state--${status}`} role="status">
          {status === 'ready' ? (isEnglish ? 'Connected' : '已连接')
            : status === 'loading' ? (isEnglish ? 'Connecting' : '连接中')
              : status === 'error' ? (isEnglish ? 'Temporarily unavailable' : '暂不可用')
                : (isEnglish ? 'Not configured' : '未配置')}
        </span>
      </div>

      <div className="search-insights-counters" aria-live="polite">
        <div className="search-insights-metric"><Eye size={18} aria-hidden="true" /><span>{isEnglish ? 'Total visits' : '累计访问'}</span><strong>{status === 'ready' ? summary.total_visits : '—'}</strong></div>
        <div className="search-insights-metric"><Users size={18} aria-hidden="true" /><span>{isEnglish ? 'Viewing this page' : '当前页在线'}</span><strong>{status === 'ready' && onlineReady ? onlineCount : '—'}</strong></div>
        <div className="search-insights-metric"><BarChart3 size={18} aria-hidden="true" /><span>{isEnglish ? 'Total searches' : '累计检索'}</span><strong>{status === 'ready' ? summary.total_searches : '—'}</strong></div>
        <div className="search-insights-metric"><CalendarDays size={18} aria-hidden="true" /><span>{isEnglish ? 'Searches today' : '今日检索'}</span><strong>{status === 'ready' ? summary.today_searches : '—'}</strong></div>
      </div>

      {status !== 'ready' && <p className="search-insights-notice">
        {status === 'unconfigured'
          ? (isEnglish ? 'Online analytics are not configured for this local build. No visit or search totals are inferred.' : '此本地版本尚未配置联网统计；访问量和检索量不会用模拟数字代替。')
          : status === 'loading'
            ? (isEnglish ? 'Checking the analytics service…' : '正在读取统计服务…')
            : (isEnglish ? 'The analytics request failed. The counts will retry automatically.' : '统计请求失败，将自动重试；当前不展示可能过期的数字。')}
      </p>}

      {status === 'ready' && leaves.length > 0 && <div className="search-insights-popular">
        <h3>{isEnglish ? 'Most searched compounds' : '热门检索化合物'}</h3>
        <p>{isEnglish ? 'Tile area represents recorded searches. Select a compound to inspect its records.' : '矩形面积对应已记录的检索次数，点击化合物可查看记录。'}</p>
        <div ref={panelRef} className="compound-treemap" aria-live="polite">
        {leaves.map(leaf => {
          const item = leaf.data;
          const tileWidth = leaf.x1 - leaf.x0;
          const tileHeight = leaf.y1 - leaf.y0;
          const strength = Number(item.search_count || 0) / maxCount;
          const tileFontSize = Math.max(10, Math.min(18, tileWidth / 8.5, tileHeight / 4));
          const tileLightness = 48 - (strength * 14);
          return (
            <button
              type="button"
              key={item.cas}
              className="compound-tile"
              style={{
                left: leaf.x0,
                top: leaf.y0,
                width: tileWidth,
                height: tileHeight,
                '--tile-strength': strength,
                '--tile-font-size': `${tileFontSize}px`,
                '--tile-color': `hsl(218 72% ${tileLightness}%)`,
              }}
              title={`${item.common_name} · CAS ${item.cas}${item.chinese_name ? ` · ${item.chinese_name}` : ''} · ${item.search_count} ${isEnglish ? 'searches' : '次检索'}`}
              onClick={() => onSelect(item)}
            >
              {tileWidth > 72 && tileHeight > 42 && <strong>{item.common_name}</strong>}
              {tileWidth > 150 && tileHeight > 70 && <span>CAS {item.cas}</span>}
              {tileWidth > 110 && tileHeight > 96 && <small>{item.search_count} {isEnglish ? 'searches' : '次检索'}</small>}
            </button>
          );
        })}
        </div>
        <ol className="search-insights-mobile-list">
          {items.slice(0, 5).map(item => <li key={item.cas}>
            <button type="button" onClick={() => onSelect(item)}>
              <span><strong>{item.common_name}</strong><small>CAS {item.cas}</small></span>
              <span>{validCount(item.search_count)} {isEnglish ? 'searches' : '次检索'}</span>
            </button>
          </li>)}
        </ol>
      </div>}
      <p className="search-insights-footnote">{analyticsReadOnly
        ? (isEnglish ? 'Local read-only view of online history; this session does not add visits, searches or online presence.' : '本地只读查看线上历史；当前会话不增加访问、检索或在线人数。')
        : (isEnglish ? 'Visits are recorded once per browser session when the database overview opens. Online presence reflects viewers of this page.' : '访问按浏览器会话进入数据库概览页记录一次；在线人数仅指当前打开此页的客户端。')}</p>
    </section>
  );
}
