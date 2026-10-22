import { useCallback, useEffect, useRef, useState } from 'react';
import { createDatasetStore } from './storage.mjs';
import { createAnalysisClient } from './client.mjs';
import { defaultRecipe, defaultAnalysis, restoreSettings, validateRecipe, validateAnalysis } from './workbench.mjs';
import { createDataset } from './dataset.mjs';
import { mergeJobResponse } from './lifecycle.mjs';
const terminal = status => ['completed', 'failed', 'cancelled'].includes(status);
export default function useWorkbench() {
  const [dataset, setDataset] = useState(null),
    [recipe, setRecipe] = useState(defaultRecipe),
    [analysis, setAnalysis] = useState(defaultAnalysis),
    [runs, setRuns] = useState([]),
    [health, setHealth] = useState(null),
    [error, setError] = useState(null),
    [dirty, setDirty] = useState(false),
    [active, setActive] = useState(null),
    [saved, setSaved] = useState([]),
    [saveState, setSaveState] = useState(''),
    [clock, setClock] = useState(() => Date.now()),
    [contextId, setContextId] = useState(0);
  const [store] = useState(() => createDatasetStore()),
    [client] = useState(() => createAnalysisClient()),
    scope = useRef(0),
    activeRef = useRef(null),
    saving = useRef(Promise.resolve()),
    loadRequest = useRef(0);
  const refresh = useCallback(async () => {
    try {
      setSaved(await store.list());
    } catch (e) {
      setError(e);
    }
  }, [store]);
  const connect = useCallback(async () => {
    try {
      setHealth(await client.health());
      setError(null);
    } catch (e) {
      setHealth(null);
      setError(e);
    }
  }, [client]);
  const replace = useCallback((next, settings) => {
    if (activeRef.current) throw new Error('CANCEL_ACTIVE_RUN_FIRST');
    const restored = restoreSettings(settings);
    scope.current++;
    setContextId(id => id + 1);
    setDataset(next ? createDataset(next) : null);
    setRecipe(restored.recipe);
    setAnalysis(restored.analysis);
    setRuns(restored.runs);
    setDirty(false);
    setError(null);
  }, []);
  const load = useCallback(async id => {
    const version = scope.current,
      sequence = ++loadRequest.current;
    try {
      const entry = await store.load(id);
      if (version !== scope.current || sequence !== loadRequest.current) return;
      if (!entry) throw new Error('PROJECT_NOT_FOUND');
      replace(entry.dataset, entry.settings);
    } catch (e) {
      setError(e);
    }
  }, [replace, store]);
  useEffect(() => {
    const scopeRef = scope;
    const timer = setTimeout(() => {
      connect();
      refresh();
      try {
        const handoff = sessionStorage.getItem('flavor-analysis-handoff-id');
        if (handoff) {
          sessionStorage.removeItem('flavor-analysis-handoff-id');
          load(handoff);
        }
      } catch (e) {
        setError(e);
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      scopeRef.current++;
      activeRef.current?.controller.abort();
    };
  }, [connect, refresh, load]);
  useEffect(() => {
    if (!dataset) return;
    let live = true;
    const settings = {
      schemaVersion: 1,
      recipe,
      analysis,
      runs
    };
    const timer = setTimeout(() => {
      setSaveState('saving');
      saving.current = saving.current.catch(() => {}).then(() => {
        validateRecipe(recipe);
        validateAnalysis(analysis);
        return store.save(dataset, settings);
      }).then(() => {
        if (live) setSaveState('saved');
      }).catch(e => {
        if (live) {
          setSaveState('failed');
          setError(e);
        }
      });
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [dataset, recipe, analysis, runs, store]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const run = async bound => {
    if (activeRef.current || dirty || !dataset) return;
    const request = structuredClone(bound || {
      dataset,
      recipe,
      analysis
    });
    if (!health?.capabilities?.runtimeReady || !health.capabilities.methods.includes(request.analysis.method)) {
      setError(new Error('ENGINE_NOT_AVAILABLE'));
      return;
    }
    const version = scope.current,
      controller = new AbortController(),
      localId = crypto.randomUUID(),
      createdAt = new Date().toISOString(),
      entry = {
        id: localId,
        status: 'queued',
        createdAt,
        request
      },
      work = {
        controller,
        id: null,
        version,
        request,
        cancelRequested: false
      };
    activeRef.current = work;
    setClock(Date.now());
    setActive(entry);
    setRuns(rs => [...rs, entry]);
    setError(null);
    let currentRun = entry;
    const update = job => {
      if (version !== scope.current || activeRef.current !== work) return;
      const next = mergeJobResponse(currentRun, job);
      if (next === currentRun) return;
      currentRun = next;
      setRuns(rs => rs.map(r => r.id === localId || r.id === work.id ? next : r));
      setActive(terminal(job.status) ? null : next);
    };
    try {
      let job = await client.submit(request, controller.signal);
      work.id = job.id;
      update(job);
      if (work.cancelRequested) {
        job = await client.cancel(work.id);
        update(job);
      }
      while (!terminal(job.status)) {
        await new Promise(resolve => setTimeout(resolve, 600));
        if (controller.signal.aborted) throw new Error('ABORTED');
        job = await client.poll(work.id, controller.signal);
        update(job);
      }
    } catch (e) {
      if (version === scope.current && activeRef.current === work) {
        update({
          id: work.id || localId,
          status: 'interrupted',
          error: {
            code: e.code || e.message
          },
          finishedAt: new Date().toISOString()
        });
        setError(e);
      }
    } finally {
      if (activeRef.current === work) {
        activeRef.current = null;
        if (version === scope.current) setActive(null);
      }
    }
  };
  const cancel = async () => {
    const work = activeRef.current;
    if (!work) return;
    work.cancelRequested = true;
    if (!work.id) return;
    try {
      const job = await client.cancel(work.id);
      mergeJobResponse({id: work.id, status: 'running', request: work.request}, job);
      if (work.version === scope.current && activeRef.current === work) {
        setRuns(rs => rs.map(r => r.id === work.id ? {
          ...r,
          ...job
        } : r));
        if (terminal(job.status)) {
          work.controller.abort();
          activeRef.current = null;
          setActive(null);
        }
      }
    } catch (e) {
      setError(e);
    }
  };
  const editDataset = next => {
    setDataset(next);
    setDirty(false);
  };
  return {
    dataset,
    recipe,
    setRecipe,
    analysis,
    setAnalysis,
    runs,
    health,
    error,
    setError,
    dirty,
    setDirty,
    active,
    saved,
    saveState,
    clock,
    contextId,
    connect,
    refresh,
    replace,
    load,
    run,
    cancel,
    editDataset
  };
}
