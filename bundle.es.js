const equalFn = (a, b) => a === b;
const $PROXY = Symbol("solid-proxy");
const signalOptions = {
  equals: equalFn
};
let runEffects = runQueue;
const NOTPENDING = {};
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var Owner = null;
let Transition = null;
let Listener = null;
let Pending = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
  detachedOwner && (Owner = detachedOwner);
  const listener = Listener,
        owner = Owner,
        root = fn.length === 0 && !false ? UNOWNED : {
    owned: null,
    cleanups: null,
    context: null,
    owner
  };
  Owner = root;
  Listener = null;
  try {
    return runUpdates(() => fn(() => cleanNode(root)), true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    pending: NOTPENDING,
    comparator: options.equals || undefined
  };
  const setter = value => {
    if (typeof value === "function") {
      value = value(s.pending !== NOTPENDING ? s.pending : s.value);
    }
    return writeSignal(s, value);
  };
  return [readSignal.bind(s), setter];
}
function createComputed(fn, value, options) {
  const c = createComputation(fn, value, true, STALE);
  updateComputation(c);
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  updateComputation(c);
}
function createEffect(fn, value, options) {
  runEffects = runUserEffects;
  const c = createComputation(fn, value, false, STALE);
  c.user = true;
  Effects ? Effects.push(c) : queueMicrotask(() => updateComputation(c));
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.pending = NOTPENDING;
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  updateComputation(c);
  return readSignal.bind(c);
}
function batch(fn) {
  if (Pending) return fn();
  let result;
  const q = Pending = [];
  try {
    result = fn();
  } finally {
    Pending = null;
  }
  runUpdates(() => {
    for (let i = 0; i < q.length; i += 1) {
      const data = q[i];
      if (data.pending !== NOTPENDING) {
        const pending = data.pending;
        data.pending = NOTPENDING;
        writeSignal(data, pending);
      }
    }
  }, false);
  return result;
}
function untrack(fn) {
  let result,
      listener = Listener;
  Listener = null;
  result = fn();
  Listener = listener;
  return result;
}
function onMount(fn) {
  createEffect(() => untrack(fn));
}
function onCleanup(fn) {
  if (Owner === null) ;else if (Owner.cleanups === null) Owner.cleanups = [fn];else Owner.cleanups.push(fn);
  return fn;
}
function createContext(defaultValue) {
  const id = Symbol("context");
  return {
    id,
    Provider: createProvider(id),
    defaultValue
  };
}
function useContext(context) {
  return lookup(Owner, context.id) || context.defaultValue;
}
function children(fn) {
  const children = createMemo(fn);
  return createMemo(() => resolveChildren(children()));
}
function readSignal() {
  const runningTransition = Transition ;
  if (this.sources && (this.state || runningTransition )) {
    const updates = Updates;
    Updates = null;
    this.state === STALE || runningTransition  ? updateComputation(this) : lookDownstream(this);
    Updates = updates;
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  return this.value;
}
function writeSignal(node, value, isComp) {
  if (node.comparator) {
    if (node.comparator(node.value, value)) return value;
  }
  if (Pending) {
    if (node.pending === NOTPENDING) Pending.push(node);
    node.pending = value;
    return value;
  }
  let TransitionRunning = false;
  node.value = value;
  if (node.observers && node.observers.length) {
    runUpdates(() => {
      for (let i = 0; i < node.observers.length; i += 1) {
        const o = node.observers[i];
        if (TransitionRunning && Transition.disposed.has(o)) ;
        if (o.pure) Updates.push(o);else Effects.push(o);
        if (o.observers && (TransitionRunning && !o.tState || !TransitionRunning && !o.state)) markUpstream(o);
        if (TransitionRunning) ;else o.state = STALE;
      }
      if (Updates.length > 10e5) {
        Updates = [];
        if (false) ;
        throw new Error();
      }
    }, false);
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const owner = Owner,
        listener = Listener,
        time = ExecCount;
  Listener = Owner = node;
  runComputation(node, node.value, time);
  Listener = listener;
  Owner = owner;
}
function runComputation(node, value, time) {
  let nextValue;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    handleError(err);
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.observers && node.observers.length) {
      writeSignal(node, nextValue);
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state: state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: null,
    pure
  };
  if (Owner === null) ;else if (Owner !== UNOWNED) {
    {
      if (!Owner.owned) Owner.owned = [c];else Owner.owned.push(c);
    }
  }
  return c;
}
function runTop(node) {
  const runningTransition = Transition ;
  if (node.state !== STALE) return node.state = 0;
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (node.state || runningTransition ) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if (node.state === STALE || runningTransition ) {
      updateComputation(node);
    } else if (node.state === PENDING || runningTransition ) {
      const updates = Updates;
      Updates = null;
      lookDownstream(node, ancestors[0]);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;else Effects = [];
  ExecCount++;
  try {
    return fn();
  } catch (err) {
    handleError(err);
  } finally {
    completeUpdates(wait);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  if (Effects.length) batch(() => {
    runEffects(Effects);
    Effects = null;
  });else {
    Effects = null;
  }
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function runUserEffects(queue) {
  let i,
      userLength = 0;
  for (i = 0; i < queue.length; i++) {
    const e = queue[i];
    if (!e.user) runTop(e);else queue[userLength++] = e;
  }
  const resume = queue.length;
  for (i = 0; i < userLength; i++) runTop(queue[i]);
  for (i = resume; i < queue.length; i++) runTop(queue[i]);
}
function lookDownstream(node, ignore) {
  node.state = 0;
  const runningTransition = Transition ;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      if (source.state === STALE || runningTransition ) {
        if (source !== ignore) runTop(source);
      } else if (source.state === PENDING || runningTransition ) lookDownstream(source, ignore);
    }
  }
}
function markUpstream(node) {
  const runningTransition = Transition ;
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (!o.state || runningTransition ) {
      o.state = PENDING;
      if (o.pure) Updates.push(o);else Effects.push(o);
      o.observers && markUpstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(),
            index = node.sourceSlots.pop(),
            obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(),
              s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.owned) {
    for (i = 0; i < node.owned.length; i++) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = 0; i < node.cleanups.length; i++) node.cleanups[i]();
    node.cleanups = null;
  }
  node.state = 0;
  node.context = null;
}
function handleError(err) {
  throw err;
}
function lookup(owner, key) {
  return owner && (owner.context && owner.context[key] !== undefined ? owner.context[key] : owner.owner && lookup(owner.owner, key));
}
function resolveChildren(children) {
  if (typeof children === "function" && !children.length) return resolveChildren(children());
  if (Array.isArray(children)) {
    const results = [];
    for (let i = 0; i < children.length; i++) {
      const result = resolveChildren(children[i]);
      Array.isArray(result) ? results.push.apply(results, result) : results.push(result);
    }
    return results;
  }
  return children;
}
function createProvider(id) {
  return function provider(props) {
    let res;
    createComputed(() => res = untrack(() => {
      Owner.context = {
        [id]: props.value
      };
      return children(() => props.children);
    }));
    return res;
  };
}

const FALLBACK = Symbol("fallback");
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [],
      mapped = [],
      disposers = [],
      len = 0,
      indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [],
        i,
        j;
    return untrack(() => {
      let newLen = newItems.length,
          newIndices,
          newIndicesNext,
          temp,
          tempdisposers,
          tempIndexes,
          start,
          end,
          newEnd,
          item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot(disposer => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      }
      else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++);
        for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === undefined ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== undefined && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        for (j = start; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
function createComponent(Comp, props) {
  return untrack(() => Comp(props));
}
function trueFn() {
  return true;
}
const propTraps = {
  get(_, property, receiver) {
    if (property === $PROXY) return receiver;
    return _.get(property);
  },
  has(_, property) {
    return _.has(property);
  },
  set: trueFn,
  deleteProperty: trueFn,
  getOwnPropertyDescriptor(_, property) {
    return {
      configurable: true,
      enumerable: true,
      get() {
        return _.get(property);
      },
      set: trueFn,
      deleteProperty: trueFn
    };
  },
  ownKeys(_) {
    return _.keys();
  }
};
function resolveSource(s) {
  return typeof s === "function" ? s() : s;
}
function mergeProps(...sources) {
  return new Proxy({
    get(property) {
      for (let i = sources.length - 1; i >= 0; i--) {
        const v = resolveSource(sources[i])[property];
        if (v !== undefined) return v;
      }
    },
    has(property) {
      for (let i = sources.length - 1; i >= 0; i--) {
        if (property in resolveSource(sources[i])) return true;
      }
      return false;
    },
    keys() {
      const keys = [];
      for (let i = 0; i < sources.length; i++) keys.push(...Object.keys(resolveSource(sources[i])));
      return [...new Set(keys)];
    }
  }, propTraps);
}
function splitProps(props, ...keys) {
  const blocked = new Set(keys.flat());
  const descriptors = Object.getOwnPropertyDescriptors(props);
  const res = keys.map(k => {
    const clone = {};
    for (let i = 0; i < k.length; i++) {
      const key = k[i];
      Object.defineProperty(clone, key, descriptors[key] ? descriptors[key] : {
        get() {
          return props[key];
        },
        set() {
          return true;
        }
      });
    }
    return clone;
  });
  res.push(new Proxy({
    get(property) {
      return blocked.has(property) ? undefined : props[property];
    },
    has(property) {
      return blocked.has(property) ? false : property in props;
    },
    keys() {
      return Object.keys(props).filter(k => !blocked.has(k));
    }
  }, propTraps));
  return res;
}

function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback ? fallback : undefined));
}
function Show(props) {
  let strictEqual = false;
  const condition = createMemo(() => props.when, undefined, {
    equals: (a, b) => strictEqual ? a === b : !a === !b
  });
  return createMemo(() => {
    const c = condition();
    if (c) {
      const child = props.children;
      return (strictEqual = typeof child === "function" && child.length > 0) ? untrack(() => child(c)) : child;
    }
    return props.fallback;
  });
}

const booleans = ["allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "disabled", "formnovalidate", "hidden", "indeterminate", "ismap", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "seamless", "selected"];
const Properties = new Set(["className", "value", "readOnly", "formNoValidate", "isMap", "noModule", "playsInline", ...booleans]);
const ChildProperties = new Set(["innerHTML", "textContent", "innerText", "children"]);
const Aliases = {
  className: "class",
  htmlFor: "for"
};
const PropAliases = {
  class: "className",
  formnovalidate: "formNoValidate",
  ismap: "isMap",
  nomodule: "noModule",
  playsinline: "playsInline",
  readonly: "readOnly"
};
const DelegatedEvents = new Set(["beforeinput", "click", "dblclick", "focusin", "focusout", "input", "keydown", "keyup", "mousedown", "mousemove", "mouseout", "mouseover", "mouseup", "pointerdown", "pointermove", "pointerout", "pointerover", "pointerup", "touchend", "touchmove", "touchstart"]);
const SVGNamespace = {
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace"
};

function memo$1(fn, equals) {
  return createMemo(fn, undefined, !equals ? {
    equals
  } : undefined);
}

function reconcileArrays$1(parentNode, a, b) {
  let bLength = b.length,
      aEnd = a.length,
      bEnd = bLength,
      aStart = 0,
      bStart = 0,
      after = a[aEnd - 1].nextSibling,
      map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
              sequence = 1,
              t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}

const $$EVENTS = "_$DX_DELEGATE";
function render$1(code, element, init) {
  let disposer;
  createRoot(dispose => {
    disposer = dispose;
    element === document ? code() : insert$1(element, code(), element.firstChild ? null : undefined, init);
  });
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template$1(html, check, isSVG) {
  const t = document.createElement("template");
  t.innerHTML = html;
  let node = t.content.firstChild;
  if (isSVG) node = node.firstChild;
  return node;
}
function delegateEvents(eventNames, document = window.document) {
  const e = document[$$EVENTS] || (document[$$EVENTS] = new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute$1(node, name, value) {
  if (value == null) node.removeAttribute(name);else node.setAttribute(name, value);
}
function setAttributeNS(node, namespace, name, value) {
  if (value == null) node.removeAttributeNS(namespace, name);else node.setAttributeNS(namespace, name, value);
}
function addEventListener(node, name, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`$$${name}`] = handler[0];
      node[`$$${name}Data`] = handler[1];
    } else node[`$$${name}`] = handler;
  } else if (Array.isArray(handler)) {
    node.addEventListener(name, e => handler[0](handler[1], e));
  } else node.addEventListener(name, handler);
}
function classList(node, value, prev = {}) {
  const classKeys = Object.keys(value || {}),
        prevKeys = Object.keys(prev);
  let i, len;
  for (i = 0, len = prevKeys.length; i < len; i++) {
    const key = prevKeys[i];
    if (!key || key === "undefined" || value[key]) continue;
    toggleClassKey(node, key, false);
    delete prev[key];
  }
  for (i = 0, len = classKeys.length; i < len; i++) {
    const key = classKeys[i],
          classValue = !!value[key];
    if (!key || key === "undefined" || prev[key] === classValue || !classValue) continue;
    toggleClassKey(node, key, true);
    prev[key] = classValue;
  }
  return prev;
}
function style(node, value, prev = {}) {
  const nodeStyle = node.style;
  if (value == null || typeof value === "string") return nodeStyle.cssText = value;
  typeof prev === "string" && (prev = {});
  let v, s;
  for (s in prev) {
    value[s] == null && nodeStyle.removeProperty(s);
    delete prev[s];
  }
  for (s in value) {
    v = value[s];
    if (v !== prev[s]) {
      nodeStyle.setProperty(s, v);
      prev[s] = v;
    }
  }
  return prev;
}
function spread(node, accessor, isSVG, skipChildren) {
  if (typeof accessor === "function") {
    createRenderEffect(current => spreadExpression(node, accessor(), current, isSVG, skipChildren));
  } else spreadExpression(node, accessor, undefined, isSVG, skipChildren);
}
function insert$1(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression$1(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression$1(parent, accessor(), current, marker), initial);
}
function assign(node, props, isSVG, skipChildren, prevProps = {}) {
  for (const prop in prevProps) {
    if (!(prop in props)) {
      if (prop === "children") continue;
      assignProp(node, prop, null, prevProps[prop], isSVG);
    }
  }
  for (const prop in props) {
    if (prop === "children") {
      if (!skipChildren) insertExpression$1(node, props.children);
      continue;
    }
    const value = props[prop];
    prevProps[prop] = assignProp(node, prop, value, prevProps[prop], isSVG);
  }
}
function toPropertyName(name) {
  return name.toLowerCase().replace(/-([a-z])/g, (_, w) => w.toUpperCase());
}
function toggleClassKey(node, key, value) {
  const classNames = key.trim().split(/\s+/);
  for (let i = 0, nameLen = classNames.length; i < nameLen; i++) node.classList.toggle(classNames[i], value);
}
function assignProp(node, prop, value, prev, isSVG) {
  let isCE, isProp, isChildProp;
  if (prop === "style") return style(node, value, prev);
  if (prop === "classList") return classList(node, value, prev);
  if (value === prev) return prev;
  if (prop === "ref") {
    value(node);
  } else if (prop.slice(0, 3) === "on:") {
    node.addEventListener(prop.slice(3), value);
  } else if (prop.slice(0, 10) === "oncapture:") {
    node.addEventListener(prop.slice(10), value, true);
  } else if (prop.slice(0, 2) === "on") {
    const name = prop.slice(2).toLowerCase();
    const delegate = DelegatedEvents.has(name);
    addEventListener(node, name, value, delegate);
    delegate && delegateEvents([name]);
  } else if ((isChildProp = ChildProperties.has(prop)) || !isSVG && (PropAliases[prop] || (isProp = Properties.has(prop))) || (isCE = node.nodeName.includes("-"))) {
    if (isCE && !isProp && !isChildProp) node[toPropertyName(prop)] = value;else node[PropAliases[prop] || prop] = value;
  } else {
    const ns = isSVG && prop.indexOf(":") > -1 && SVGNamespace[prop.split(":")[0]];
    if (ns) setAttributeNS(node, ns, prop, value);else setAttribute$1(node, Aliases[prop] || prop, value);
  }
  return value;
}
function eventHandler(e) {
  const key = `$$${e.type}`;
  let node = e.composedPath && e.composedPath()[0] || e.target;
  if (e.target !== node) {
    Object.defineProperty(e, "target", {
      configurable: true,
      value: node
    });
  }
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  while (node !== null) {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== undefined ? handler(data, e) : handler(e);
      if (e.cancelBubble) return;
    }
    node = node.host && node.host !== node && node.host instanceof Node ? node.host : node.parentNode;
  }
}
function spreadExpression(node, props, prevProps = {}, isSVG, skipChildren) {
  if (!skipChildren && "children" in props) {
    createRenderEffect(() => prevProps.children = insertExpression$1(node, props.children, prevProps.children));
  }
  createRenderEffect(() => assign(node, props, isSVG, true, prevProps));
  return prevProps;
}
function insertExpression$1(parent, value, current, marker, unwrapArray) {
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
        multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (t === "number") value = value.toString();
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data = value;
      } else node = document.createTextNode(value);
      current = cleanChildren$1(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    current = cleanChildren$1(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression$1(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    if (normalizeIncomingArray$1(array, value, unwrapArray)) {
      createRenderEffect(() => current = insertExpression$1(parent, array, current, marker, true));
      return () => current;
    }
    if (array.length === 0) {
      cleanChildren$1(parent, current, marker);
    } else if (Array.isArray(current)) {
      if (current.length === 0) {
        appendNodes$1(parent, array, marker);
      } else reconcileArrays$1(parent, current, array);
    } else {
      current && cleanChildren$1(parent, current);
      appendNodes$1(parent, array);
    }
    current = array;
  } else if (value instanceof Node) {
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren$1(parent, current, marker, value);
      cleanChildren$1(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else ;
  return current;
}
function normalizeIncomingArray$1(normalized, array, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
        t;
    if (item instanceof Node) {
      normalized.push(item);
    } else if (item == null || item === true || item === false) ; else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray$1(normalized, item) || dynamic;
    } else if ((t = typeof item) === "string") {
      normalized.push(document.createTextNode(item));
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray$1(normalized, Array.isArray(item) ? item : [item]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else normalized.push(document.createTextNode(item.toString()));
  }
  return dynamic;
}
function appendNodes$1(parent, array, marker) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren$1(parent, current, marker, replacement) {
  if (marker === undefined) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

let e={data:""},t=t=>"object"==typeof window?((t?t.querySelector("#_goober"):window._goober)||Object.assign((t||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:t||e,l=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,a=/\/\*[^]*?\*\/|\s\s+|\n/g,n=(e,t)=>{let r="",l="",a="";for(let o in e){let s=e[o];"@"==o[0]?"i"==o[1]?r=o+" "+s+";":l+="f"==o[1]?n(s,o):o+"{"+n(s,"k"==o[1]?"":t)+"}":"object"==typeof s?l+=n(s,t?t.replace(/([^,])+/g,e=>o.replace(/(^:.*)|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):o):null!=s&&(o=o.replace(/[A-Z]/g,"-$&").toLowerCase(),a+=n.p?n.p(o,s):o+":"+s+";");}return r+(t&&a?t+"{"+a+"}":a)+l},o={},s=e=>{if("object"==typeof e){let t="";for(let r in e)t+=r+s(e[r]);return t}return e},c=(e,t,r,c,i)=>{let u=s(e),p=o[u]||(o[u]=(e=>{let t=0,r=11;for(;t<e.length;)r=101*r+e.charCodeAt(t++)>>>0;return "go"+r})(u));if(!o[p]){let t=u!==e?e:(e=>{let t,r=[{}];for(;t=l.exec(e.replace(a,""));)t[4]?r.shift():t[3]?r.unshift(r[0][t[3]]=r[0][t[3]]||{}):r[0][t[1]]=t[2];return r[0]})(e);o[p]=n(i?{["@keyframes "+p]:t}:t,r?"":"."+p);}return ((e,t,r)=>{-1==t.data.indexOf(e)&&(t.data=r?e+t.data:t.data+e);})(o[p],t,c),p},i=(e,t,r)=>e.reduce((e,l,a)=>{let o=t[a];if(o&&o.call){let e=o(r),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;o=t?"."+t:e&&"object"==typeof e?e.props?"":n(e,""):!1===e?"":e;}return e+l+(null==o?"":o)},"");function u(e){let r=this||{},l=e.call?e(r.p):e;return c(l.unshift?l.raw?i(l,[].slice.call(arguments,1),r.p):l.reduce((e,t)=>Object.assign(e,t&&t.call?t(r.p):t),{}):l,t(r.target),r.g,r.o,r.k)}u.bind({g:1});u.bind({k:1});

const ThemeContext = createContext();
function ThemeProvider(props) {
  return createComponent(ThemeContext.Provider, {
    value: props.theme,
    get children() {
      return props.children;
    }
  });
}
function styled(tag) {
  let _ctx = this || {};
  return (...args) => {
    const Styled = props => {
      const theme = useContext(ThemeContext);
      const withTheme = mergeProps(props, { theme });
      const clone = mergeProps(withTheme, {
        get className() {
          const pClassName = withTheme.className,
            append = "className" in withTheme && /^go[0-9]+/.test(pClassName);
          // Call `css` with the append flag and pass the props
          let className = u.apply(
            { target: _ctx.target, o: append, p: withTheme, g: _ctx.g },
            args
          );
          return [pClassName, className].filter(Boolean).join(" ");
        }
      });
      const [local, newProps] = splitProps(clone, ["as"]);
      const createTag = local.as || tag;
      let el;
      if (typeof createTag === "function") {
        el = createTag(newProps);
      } else {
        el = document.createElement(createTag);
        spread(el, newProps);
      }
      return el;
    };
    Styled.className = props => {
      return untrack(() => {
        return u.apply({ target: _ctx.target, p: props, g: _ctx.g }, args);
      });
    };
    return Styled;
  };
}
function createGlobalStyles() {
  const fn = styled.call({ g: 1 }, "div").apply(null, arguments);
  return function GlobalStyles(props) {
    fn(props);
    return null;
  };
}

function memo(fn, equals) {
  return createMemo(fn, undefined, !equals ? {
    equals
  } : undefined);
}

function reconcileArrays(parentNode, a, b) {
  let bLength = b.length,
      aEnd = a.length,
      bEnd = bLength,
      aStart = 0,
      bStart = 0,
      after = a[aEnd - 1].nextSibling,
      map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart,
              sequence = 1,
              t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}
function template(html, check, isSVG) {
  const t = document.createElement("template");
  t.innerHTML = html;
  let node = t.content.firstChild;
  if (isSVG) node = node.firstChild;
  return node;
}
function setAttribute(node, name, value) {
  if (value == null) node.removeAttribute(name);else node.setAttribute(name, value);
}
function insert(parent, accessor, marker, initial) {
  if (marker !== undefined && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect(current => insertExpression(parent, accessor(), current, marker), initial);
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value,
        multi = marker !== undefined;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (t === "number") value = value.toString();
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data = value;
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    if (normalizeIncomingArray(array, value, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else {
      if (Array.isArray(current)) {
        if (current.length === 0) {
          appendNodes(parent, array, marker);
        } else reconcileArrays(parent, current, array);
      } else if (current == null || current === "") {
        appendNodes(parent, array);
      } else {
        reconcileArrays(parent, multi && current || [parent.firstChild], array);
      }
    }
    current = array;
  } else if (value instanceof Node) {
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else ;
  return current;
}
function normalizeIncomingArray(normalized, array, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i],
        t;
    if (item instanceof Node) {
      normalized.push(item);
    } else if (item == null || item === true || item === false) ; else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item) || dynamic;
    } else if ((t = typeof item) === "string") {
      normalized.push(document.createTextNode(item));
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else normalized.push(document.createTextNode(item.toString()));
  }
  return dynamic;
}
function appendNodes(parent, array, marker) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === undefined) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

const _tmpl$$1$1 = template(`<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 0C7.44772 0 7 0.447715 7 1V7H1C0.447715 7 0 7.44772 0 8C0 8.55228 0.447715 9 1 9H7V15C7 15.5523 7.44772 16 8 16C8.55228 16 9 15.5523 9 15V9H15C15.5523 9 16 8.55228 16 8C16 7.44772 15.5523 7 15 7H9V1C9 0.447715 8.55228 0 8 0Z"></path></svg>`),
      _tmpl$2$1 = template(`<svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M0 1C0 0.447715 0.447715 0 1 0H15C15.5523 0 16 0.447715 16 1C16 1.55228 15.5523 2 15 2H1C0.447715 2 0 1.55228 0 1ZM0 6C0 5.44772 0.447715 5 1 5H15C15.5523 5 16 5.44772 16 6C16 6.55228 15.5523 7 15 7H1C0.447715 7 0 6.55228 0 6ZM1 10C0.447715 10 0 10.4477 0 11C0 11.5523 0.447715 12 1 12H15C15.5523 12 16 11.5523 16 11C16 10.4477 15.5523 10 15 10H1Z"></path></svg>`),
      _tmpl$3 = template(`<svg width="14" height="16" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M0.292893 0.292893C-0.0976311 0.683418 -0.0976311 1.31658 0.292893 1.70711L5.58579 7L0.292893 12.2929C-0.0976309 12.6834 -0.0976309 13.3166 0.292893 13.7071C0.683418 14.0976 1.31658 14.0976 1.70711 13.7071L7 8.41421L12.2929 13.7071C12.6834 14.0976 13.3166 14.0976 13.7071 13.7071C14.0976 13.3166 14.0976 12.6834 13.7071 12.2929L8.41421 7L13.7071 1.70711C14.0976 1.31658 14.0976 0.683418 13.7071 0.292893C13.3166 -0.0976311 12.6834 -0.0976311 12.2929 0.292893L7 5.58579L1.70711 0.292893C1.31658 -0.0976311 0.683418 -0.0976311 0.292893 0.292893Z"></path></svg>`),
      _tmpl$4 = template(`<svg width="4" height="16" viewBox="0 0 4 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 4C3.10457 4 4 3.10457 4 2C4 0.89543 3.10457 0 2 0C0.89543 0 0 0.89543 0 2C0 3.10457 0.89543 4 2 4ZM2 11C3.10457 11 4 10.1046 4 9C4 7.89543 3.10457 7 2 7C0.89543 7 0 7.89543 0 9C0 10.1046 0.89543 11 2 11ZM4 16C4 17.1046 3.10457 18 2 18C0.89543 18 0 17.1046 0 16C0 14.8954 0.89543 14 2 14C3.10457 14 4 14.8954 4 16Z"></path></svg>`),
      _tmpl$5 = template(`<svg width="16" height="16" viewBox="0 0 16 2" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 2C0.447715 2 0 1.55228 0 1C0 0.447715 0.447715 0 1 0H15C15.5523 0 16 0.447715 16 1C16 1.55228 15.5523 2 15 2H1Z"></path></svg>`),
      _tmpl$6 = template(`<svg width="17" height="19" viewBox="0 0 17 19" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.5 15C3.35786 15 0 11.6421 0 7.5C0 3.35786 3.35786 0 7.5 0C11.6421 0 15 3.35786 15 7.5C15 9.48047 14.2324 11.2816 12.9784 12.6222L16.7809 17.3753C17.1259 17.8066 17.056 18.4359 16.6247 18.7809C16.1934 19.1259 15.5641 19.056 15.2191 18.6247L11.4304 13.8888C10.2875 14.5935 8.94124 15 7.5 15ZM7.5 13C10.5376 13 13 10.5376 13 7.5C13 4.46243 10.5376 2 7.5 2C4.46243 2 2 4.46243 2 7.5C2 10.5376 4.46243 13 7.5 13Z"></path></svg>`);

const RevIcon = {
  Plus: ({
    fill
  }) => (() => {
    const _el$ = _tmpl$$1$1.cloneNode(true),
          _el$2 = _el$.firstChild;

    setAttribute(_el$2, "fill", fill);

    return _el$;
  })(),
  Burger: ({
    fill
  }) => (() => {
    const _el$3 = _tmpl$2$1.cloneNode(true),
          _el$4 = _el$3.firstChild;

    setAttribute(_el$4, "fill", fill);

    return _el$3;
  })(),
  Cross: ({
    fill
  }) => (() => {
    const _el$5 = _tmpl$3.cloneNode(true),
          _el$6 = _el$5.firstChild;

    setAttribute(_el$6, "fill", fill);

    return _el$5;
  })(),
  More: ({
    fill
  }) => (() => {
    const _el$7 = _tmpl$4.cloneNode(true),
          _el$8 = _el$7.firstChild;

    setAttribute(_el$8, "fill", fill);

    return _el$7;
  })(),
  Minus: ({
    fill
  }) => (() => {
    const _el$9 = _tmpl$5.cloneNode(true),
          _el$10 = _el$9.firstChild;

    setAttribute(_el$10, "fill", fill);

    return _el$9;
  })(),
  Lens: ({
    fill
  }) => (() => {
    const _el$11 = _tmpl$6.cloneNode(true),
          _el$12 = _el$11.firstChild;

    setAttribute(_el$12, "fill", fill);

    return _el$11;
  })()
};

const Icon = styled('span')`
	height: 20px;
	width: 20px;
	display: flex;
	justify-content: center;
	align-items: center;
`;

const Plus$1 = ({
  fill = '#2c2738',
  onClick
}) => createComponent(Icon, {
  onClick: onClick,

  get children() {
    return createComponent(RevIcon.Plus, {
      fill: fill
    });
  }

});

const Cross$2 = ({
  fill = '#2c2738',
  onClick
}) => createComponent(Icon, {
  onClick: onClick,

  get children() {
    return createComponent(RevIcon.Cross, {
      fill: fill
    });
  }

});

const Minus$1 = ({
  fill = '#2c2738',
  onClick
}) => createComponent(Icon, {
  onClick: onClick,

  get children() {
    return createComponent(RevIcon.Minus, {
      fill: fill
    });
  }

});

const More$1 = ({
  fill = '#2c2738',
  onClick
}) => createComponent(Icon, {
  onClick: onClick,

  get children() {
    return createComponent(RevIcon.More, {
      fill: fill
    });
  }

});

const Burger$1 = ({
  fill = '#2c2738',
  onClick
}) => createComponent(Icon, {
  onClick: onClick,

  get children() {
    return createComponent(RevIcon.Burger, {
      fill: fill
    });
  }

});

const Lens$1 = ({
  fill = '#2c2738',
  onClick
}) => createComponent(Icon, {
  onClick: onClick,

  get children() {
    return createComponent(RevIcon.Lens, {
      fill: fill
    });
  }

});

const Icons = Object.assign({}, {
  Plus: Plus$1,
  Cross: Cross$2,
  Minus: Minus$1,
  More: More$1,
  Burger: Burger$1,
  Lens: Lens$1
});

const calculateFontSize$1 = size => {
  switch (size) {
    case 1:
      return '72px';

    case 2:
      return '64px';

    case 3:
      return '56px';

    case 4:
      return '34px';

    case 5:
      return '28px';

    case 6:
      return '20px';

    default:
      return '20px';
  }
};

const StyledHeading = styled('h1')`
	font-size: ${props => calculateFontSize$1(props.size)};
	font-weight: ${props => props.weight};
  color: ${props => props.theme.colors[props.type]};
`;
const Heading = ({
  size = 1,
  type = 'primary',
  weight = 'normal',
  children
}) => createComponent(StyledHeading, {
  size: size,
  weight: weight,
  type: type,
  children: children
});

const calculateFontSize = size => {
  switch (size) {
    case 1:
      return '16px';

    case 2:
      return '14px';

    default:
      return '16px';
  }
};

const StyledParagraph = styled('p')`
	font-size: ${props => calculateFontSize(props.size)};
	font-weight: ${props => props.weight};
  color: ${props => props.theme.colors[props.type]};
`;
const Paragraph = ({
  size = 1,
  weight = 'normal',
  type = 'primary',
  children
}) => createComponent(StyledParagraph, {
  size: size,
  weight: weight,
  type: type,
  children: children
});

const Label = ({
  type = 'primary',
  children
}) => createComponent(Paragraph, {
  size: 1,
  type: type,
  weight: 'normal',
  children: children
});

const {
  Cross: Cross$1
} = Icons;
const StyledAlert = styled('div')`
	background-color: ${props => props.theme.colors[props.type]};
	box-sizing: border-box;
  box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 24px;
  border-radius: 10px;
	color: ${props => props.theme.colors[props.textColor]};
  font-weight: 400;
	gap: 8px;

	& svg {
		cursor: pointer;
	}
`;
const Alert = ({
  type = 'bright',
  textColor = 'bright',
  iconColor = '#ffffff',
  children
}) => {
  const [getClosed, setClosed] = createSignal(false);
  return createComponent(Show, {
    get when() {
      return !getClosed();
    },

    get children() {
      return createComponent(StyledAlert, {
        type: type,
        textColor: textColor,

        get children() {
          return [createComponent(Paragraph, {
            type: textColor,
            children: children
          }), createComponent(Cross$1, {
            fill: iconColor,
            onClick: () => setClosed(true)
          })];
        }

      });
    }

  });
};

const StyledAvatar$1 = styled('div')`
	height: 56px;
  width: 56px;
  display: flex;
  border-radius: ${props => props.round ? '50%' : '4px'};
  justify-content: center;
  align-items: center;
  font-size: 16px;
  background: ${props => props.theme.colors.muted};
  color: ${props => props.theme.colors.bright};
  font-weight: bold;
`;
const Avatar$1 = ({
  initials,
  round = false
}) => createComponent(StyledAvatar$1, {
  round: round,
  children: initials
});

const getImageUrl = type => `https://storage.googleapis.com/rev-kit-assets/${type}.png`;

const StyledAvatar = styled('div')`
	height: 56px;
	width: 56px;
	border-radius: ${props => props.round ? '50%' : '4px'};
	background-size: cover;
	background-image: ${props => `url(${getImageUrl(props.type)})`};
`;
const DefaultAvatar = ({
  type = 'steven',
  round = false
}) => createComponent(StyledAvatar, {
  type: type,
  round: round
});

const Avatar = Object.assign(Avatar$1, {
  Steven: ({
    round
  }) => createComponent(DefaultAvatar, {
    type: 'steven',
    round: round
  }),
  Mike: ({
    round
  }) => createComponent(DefaultAvatar, {
    type: 'mike',
    round: round
  }),
  Mili: ({
    round
  }) => createComponent(DefaultAvatar, {
    type: 'mili',
    round: round
  }),
  Meg: ({
    round
  }) => createComponent(DefaultAvatar, {
    type: 'meg',
    round: round
  })
});

const StyledButton = styled('button')`
  box-sizing: border-box;
  border: unset;
  border-radius: 3px;
  height: ${props => props.small ? '34px' : '48px'};
  padding: 4px 20px;
  font-size: 14px;
  min-width: 100px;

	&.bright {
			background: ${props => props.theme.colors.bright};
  		color: ${props => props.theme.colors.primary};
  		box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;

			&:hover {
				box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 12px;
			}

			&:active {
				border: 2px solid ${props => props.theme.colors.primary};
  			box-shadow: unset;
			}

			&:disabled {
				background: ${props => props.theme.colors.shade};
  			color: rgba(44, 39, 56, 0.24);
  			box-shadow: unset;
			}
	}

	&.accent {
		background: ${props => props.theme.colors.accent};
		color: ${props => props.theme.colors.bright};

		&:hover {
			box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 12px;
		}

		&:active {
			border: 2px solid ${props => props.theme.colors.primary};
			box-shadow: unset;
		}

		&:disabled {
			background: ${props => props.theme.colors.shade};
			color: rgba(44, 39, 56, 0.24);
			box-shadow: unset;
		}
	}

	&.ghost {
		background: ${props => props.theme.colors.bright};
		color: ${props => props.theme.colors.muted};
		border: 2px solid ${props => props.theme.colors.muted};
		box-shadow: unset;

		&:hover {
			color: ${props => props.theme.colors.accent};
  		border-color: ${props => props.theme.colors.accent};
  		box-shadow: unset;
		}

		&:active {
			color: ${props => props.theme.colors.secondary};
  		border-color: ${props => props.theme.colors.secondary};
		}

		&:disabled {
			background: transparent;
  		color: rgba(44, 39, 56, 0.24);
  		border-color: rgba(44, 39, 56, 0.24);
		}
	}
`;
const Button = ({
  variant = 'accent',
  disabled = false,
  small = false,
  onClick,
  children
}) => createComponent(StyledButton, {
  variant: variant,
  onClick: onClick,
  small: small,
  disabled: disabled,
  className: `${variant}`,
  children: children
});

const StyledSmallCallout = styled('div')`
	width: 100%;
	height: 80%;
	display: inline-flex;
	justify-content: space-between;
	align-items: center;
	background: ${props => props.theme.colors.bright};
	color: ${props => props.theme.colors.primary};
	padding: 24px 20px;
	border-radius: 8px;
	box-shadow: rgba(0, 0, 0, 0.02) 0px 1px 3px 0px, rgba(27, 31, 35, 0.15) 0px 0px 0px 1px;
`;
const ActionsContainer$1 = styled('div')`
	display: inline-flex;
	justify-content: ${props => props.small ? 'flex-end' : 'flex-start'};
	align-items: center;
	gap: 8px;
`;
const StyledLargeCallout = styled('div')`
	width: 100%;
	height: auto;
	min-height: 200px;
	padding: 40px;
	display: flex;
	flex-direction: column;
	background: ${props => props.theme.colors.bright};
	color: ${props => props.theme.colors.primary};
	box-shadow: rgba(0, 0, 0, 0.02) 0px 1px 3px 0px, rgba(27, 31, 35, 0.15) 0px 0px 0px 1px;
	gap: 16px;
	border-radius: 16px;
`;

const SmallCallout = ({
  text,
  actions
}) => createComponent(StyledSmallCallout, {
  get children() {
    return [createComponent(Heading, {
      size: 6,
      children: text
    }), createComponent(ActionsContainer$1, {
      small: true,

      get children() {
        return createComponent(For, {
          each: actions,
          children: action => action
        });
      }

    })];
  }

});

const Callout = ({
  title,
  text,
  actions,
  small = false
}) => createComponent(Show, {
  when: !small,
  fallback: () => createComponent(SmallCallout, {
    text: text,
    actions: actions
  }),

  get children() {
    return createComponent(StyledLargeCallout, {
      get children() {
        return [createComponent(Heading, {
          size: 4,
          children: title
        }), createComponent(Paragraph, {
          children: text
        }), createComponent(ActionsContainer$1, {
          small: small,

          get children() {
            return createComponent(For, {
              each: actions,
              children: action => action
            });
          }

        })];
      }

    });
  }

});

const StyledCard$1 = styled('div')`
	height: fit-content;
  width: 300px;
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  box-shadow: rgba(0, 0, 0, 0.1) 0px 4px 12px;
  border-radius: 24px;
	background: ${props => props.theme.colors.bright};
	gap: 8px;
`;
const Image = styled('div')`
	height: 200px;
	background: ${props => props.src ? `url(${props.src})` : 'unset'};
	background-size: cover;
  border-radius: 16px;
  width: 100%;
`;
const ActionsContainer = styled('div')`
  padding: 8px 0;
  height: auto;
  font-size: 14px;
`;
const BodyContainer = styled('div')`
  height: auto;
  font-size: 14px;
  padding: 8px 0;
`;
const Card = ({
  imageSrc,
  title,
  children,
  actions
}) => {
  return createComponent(StyledCard$1, {
    get children() {
      return [createComponent(Show, {
        when: imageSrc,

        get children() {
          return createComponent(Image, {
            src: imageSrc
          });
        }

      }), createComponent(Heading, {
        size: 5,
        weight: 'bold',
        children: title
      }), createComponent(BodyContainer, {
        children: children
      }), createComponent(ActionsContainer, {
        get children() {
          return createComponent(For, {
            each: actions,
            children: action => action
          });
        }

      })];
    }

  });
};

template(`<label></label>`);
      template(`<h2></h2>`);
      template(`<p></p>`);
styled('div')`
	background-color: ${props => props.backgroundColor};
	color: ${props => props.color};
	height: 240px;
	width: 260px;
	border-radius: 20px;
	padding: 16px 20px;
	box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;
`;
styled('div')`
	display: inline-flex;
	justify-content: flex-end;
	width: 100%;
	height: 60%;
`;

const InputContainer = styled('div')`
	display: inline-flex;
	justify-content: space-between;
	align-items: center;
	height: 52px;
	outline: unset;
	border-radius: 6px;
	background: ${props => props.disabled ? props.theme.colors.shade : props.theme.colors.bright};
	border: 1px solid ${props => props.theme.colors.shade};
	font-size: 16px;
	box-sizing: border-box;
	gap: 16px;
	padding: 0 16px;

	&:focus-within {
		outline: none;
		border: 2px solid ${props => props.theme.colors.accent};
	}
`;
const StyledInput = styled('input')`
	outline: unset;
	background: transparent;
	border: unset;
	font-size: 16px;
	margin: 16px 0;

	&::placeholder {
		color: ${props => props.theme.colors.muted};
	}

	&:disabled, &:disabled::placeholder {
		color: ${props => props.theme.colors.secondary};
	}
`;
const Input = ({
  icon,
  disabled,
  ...rest
}) => createComponent(InputContainer, {
  disabled: disabled,

  get children() {
    return [createComponent(StyledInput, mergeProps({
      disabled: disabled
    }, rest)), createComponent(Show, {
      when: icon,
      children: icon
    })];
  }

});

const StyledTextArea = styled('textarea')`
	outline: unset;
	background: ${props => props.theme.colors.bright};
	border: 1px solid ${props => props.theme.colors.shade};
	font-size: 16px;
	padding: 16px;
	border-radius: 6px;

	&:focus {
		outline: unset;
		border: 2px solid ${props => props.theme.colors.accent};
	}

	&::placeholder {
		color: ${props => props.theme.colors.muted};
	}

	&:disabled, &:disabled::placeholder {
		color: ${props => props.theme.colors.secondary};
		background: ${props => props.theme.colors.shade};
	}
`;
const TextArea = ({
  rows = 4,
  ...rest
}) => createComponent(StyledTextArea, mergeProps({
  rows: rows
}, rest));

const StyledSpace = styled('div')`
	display: inline-flex;
  gap: 8px;
`;
const Space = ({
  children
}) => createComponent(StyledSpace, {
  children: children
});

const {
  Cross: Cross$3
} = Icons;
const ModalWrap = styled('div')`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 5;
  overflow: auto;
  outline: 0;
`;
const ModalDialog = styled('div')`
	box-sizing: border-box;
  background: ${props => props.theme.colors.bright};
  color: ${props => props.theme.colors.primary};
  font-size: 14px;
  line-height: 1.5;
  position: relative;
  top: 100px;
  z-index: 6;
  max-width: 500px;
  width: auto;
  margin: 0 auto;
  border-radius: 16px;
  box-shadow: rgba(0, 0, 0, 0.24) 0px 3px 8px;
  padding: 16px 24px;
`;
const ModalHeader = styled('div')`
	display: inline-flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

	& svg {
		cursor: pointer;
	}
`;
const ModalBody = styled('div')`
	padding: 8px 0;
`;
const ModalActions = styled('div')`
	width: 100%;
  display: inline-flex;
  justify-content: flex-end;
  align-items: center;
`;
const Modal = ({
  visible,
  title,
  onCancel,
  onOk,
  children
}) => createComponent(Show, {
  get when() {
    return visible();
  },

  get children() {
    return createComponent(ModalWrap, {
      get children() {
        return createComponent(ModalDialog, {
          get children() {
            return [createComponent(ModalHeader, {
              get children() {
                return [createComponent(Heading, {
                  size: 5,
                  weight: 'bold',
                  children: title
                }), createComponent(Cross$3, {
                  onClick: onCancel
                })];
              }

            }), createComponent(ModalBody, {
              children: children
            }), createComponent(ModalActions, {
              get children() {
                return createComponent(Space, {
                  get children() {
                    return [createComponent(Button, {
                      variant: "ghost",
                      onClick: onCancel,
                      children: "Cancel"
                    }), createComponent(Button, {
                      onClick: onOk,
                      children: "Action"
                    })];
                  }

                });
              }

            })];
          }

        });
      }

    });
  }

});

const GlobalStyle = createGlobalStyles`
	@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans');

	*,
	*::after,
	*::before {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}
	
	* {
		font-family: 'IBM Plex Sans', sans-serif;
	}

	body {
		background-color: #ebf4f8;
	}

	.tippy-box[data-animation=fade][data-state=hidden] {
		opacity: 0
	}

	[data-tippy-root] {
		max-width: calc(100vw - 10px)
	}

	.tippy-box {
		position: relative;
		background-color: #333;
		color: #fff;
		border-radius: 4px;
		font-size: 14px;
		line-height: 1.4;
		white-space: normal;
		outline: 0;
		transition-property: transform, visibility, opacity
	}

	.tippy-box[data-placement^=top]>.tippy-arrow {
		bottom: 0
	}

	.tippy-box[data-placement^=top]>.tippy-arrow:before {
		bottom: -7px;
		left: 0;
		border-width: 8px 8px 0;
		border-top-color: initial;
		transform-origin: center top
	}

	.tippy-box[data-placement^=bottom]>.tippy-arrow {
		top: 0
	}

	.tippy-box[data-placement^=bottom]>.tippy-arrow:before {
		top: -7px;
		left: 0;
		border-width: 0 8px 8px;
		border-bottom-color: initial;
		transform-origin: center bottom
	}

	.tippy-box[data-placement^=left]>.tippy-arrow {
		right: 0
	}

	.tippy-box[data-placement^=left]>.tippy-arrow:before {
		border-width: 8px 0 8px 8px;
		border-left-color: initial;
		right: -7px;
		transform-origin: center left
	}

	.tippy-box[data-placement^=right]>.tippy-arrow {
		left: 0
	}

	.tippy-box[data-placement^=right]>.tippy-arrow:before {
		left: -7px;
		border-width: 8px 8px 8px 0;
		border-right-color: initial;
		transform-origin: center right
	}

	.tippy-box[data-inertia][data-state=visible] {
		transition-timing-function: cubic-bezier(.54, 1.5, .38, 1.11)
	}

	.tippy-arrow {
		width: 16px;
		height: 16px;
		color: #333
	}

	.tippy-arrow:before {
		content: "";
		position: absolute;
		border-color: transparent;
		border-style: solid
	}

	.tippy-content {
		position: relative;
		padding: 5px 9px;
		z-index: 1
	}

	.tippy-box[data-theme~='accent'] {
		background-color: ${props => props.theme.colors.accent};
		color: ${props => props.theme.colors.bright};
		padding: 7px 10px;
		border-radius: 4px;
	}

	.tippy-box[data-theme~='accent'][data-placement^='top'] > .tippy-arrow::before {
  	border-top-color: ${props => props.theme.colors.accent};
	}

	.tippy-box[data-theme~='accent'][data-placement^='bottom'] > .tippy-arrow::before {
		border-bottom-color: ${props => props.theme.colors.accent};
	}

	.tippy-box[data-theme~='accent'][data-placement^='left'] > .tippy-arrow::before {
		border-left-color: ${props => props.theme.colors.accent};
	}

	.tippy-box[data-theme~='accent'][data-placement^='right'] > .tippy-arrow::before {
		border-right-color: ${props => props.theme.colors.accent};
	}

	.tippy-box[data-theme~='primary'] {
		background-color: ${props => props.theme.colors.primary};
		color: ${props => props.theme.colors.bright};
		padding: 7px 10px;
		border-radius: 4px;
	}

	.tippy-box[data-theme~='primary'][data-placement^='top'] > .tippy-arrow::before {
  	border-top-color: ${props => props.theme.colors.primary};
	}

	.tippy-box[data-theme~='primary'][data-placement^='bottom'] > .tippy-arrow::before {
		border-bottom-color: ${props => props.theme.colors.primary};
	}

	.tippy-box[data-theme~='primary'][data-placement^='left'] > .tippy-arrow::before {
		border-left-color: ${props => props.theme.colors.primary};
	}

	.tippy-box[data-theme~='primary'][data-placement^='right'] > .tippy-arrow::before {
		border-right-color: ${props => props.theme.colors.primary};
	}

	.tippy-box[data-theme~='bright'] {
		background-color: ${props => props.theme.colors.bright};
		color: ${props => props.theme.colors.primary};
		padding: 7px 10px;
		border-radius: 4px;
		box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;
	}

	.tippy-box[data-theme~='bright'][data-placement^='top'] > .tippy-arrow::before {
  	border-top-color: ${props => props.theme.colors.bright};
	}

	.tippy-box[data-theme~='bright'][data-placement^='bottom'] > .tippy-arrow::before {
		border-bottom-color: ${props => props.theme.colors.bright};
	}

	.tippy-box[data-theme~='bright'][data-placement^='left'] > .tippy-arrow::before {
		border-left-color: ${props => props.theme.colors.bright};
	}

	.tippy-box[data-theme~='bright'][data-placement^='right'] > .tippy-arrow::before {
		border-right-color: ${props => props.theme.colors.bright};
	}
`;

const theme$2 = {
  colors: {
    accent: "#0880AE",
    warning: "#F2AC57",
    success: "#14A38B",
    error: "#FF7171",
    primary: "#2C2738",
    secondary: "#756F86",
    muted: "#7C9CBF",
    bright: "#FFFFFF",
    shade: "#DBE2EA",
    tint: "#EBF4F8"
  }
};

const RevKitTheme = props => createComponent(ThemeProvider, {
  theme: theme$2,

  get children() {
    return [createComponent(GlobalStyle, {}), memo(() => props.children)];
  }

});

const StyledSpinner = styled('div')`
	border: 6px solid #f3f3f3;
  border-radius: 50%;
  border-top: 6px solid ${props => props.theme.colors[props.type]};
  border-bottom: 6px solid ${props => props.theme.colors[props.type]};
  border-left: 6px solid ${props => props.theme.colors[props.type]};
  width: 44px;
  height: 44px;
  -webkit-animation: spin 2s linear infinite;
  animation: spin 2s linear infinite;

@-webkit-keyframes spin {
  0% { -webkit-transform: rotate(0deg); }
  100% { -webkit-transform: rotate(360deg); }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
const Spinner = ({
  type = 'accent'
}) => {
  return createComponent(StyledSpinner, {
    type: type
  });
};

const StyledTag = styled('span')`
	display: inline-flex;
	font-size: 14px;
	padding: 8px;
	align-items: center;
	justify-content: space-around;
	min-width: 50px;
	background: ${props => props.theme.colors[props.type]};
	color: ${props => props.theme.colors[props.textColor]};
	box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;
	border-radius: 17px;
`;
const Tag = ({
  type = 'accent',
  textColor = 'bright',
  children
}) => createComponent(StyledTag, {
  type: type,
  textColor: textColor,
  children: children
});

var top = 'top';
var bottom = 'bottom';
var right = 'right';
var left = 'left';
var auto = 'auto';
var basePlacements = [top, bottom, right, left];
var start = 'start';
var end = 'end';
var clippingParents = 'clippingParents';
var viewport = 'viewport';
var popper = 'popper';
var reference = 'reference';
var variationPlacements = /*#__PURE__*/basePlacements.reduce(function (acc, placement) {
  return acc.concat([placement + "-" + start, placement + "-" + end]);
}, []);
var placements = /*#__PURE__*/[].concat(basePlacements, [auto]).reduce(function (acc, placement) {
  return acc.concat([placement, placement + "-" + start, placement + "-" + end]);
}, []); // modifiers that need to read the DOM

var beforeRead = 'beforeRead';
var read = 'read';
var afterRead = 'afterRead'; // pure-logic modifiers

var beforeMain = 'beforeMain';
var main = 'main';
var afterMain = 'afterMain'; // modifier with the purpose to write to the DOM (or write into a framework state)

var beforeWrite = 'beforeWrite';
var write = 'write';
var afterWrite = 'afterWrite';
var modifierPhases = [beforeRead, read, afterRead, beforeMain, main, afterMain, beforeWrite, write, afterWrite];

function getNodeName(element) {
  return element ? (element.nodeName || '').toLowerCase() : null;
}

function getWindow(node) {
  if (node == null) {
    return window;
  }

  if (node.toString() !== '[object Window]') {
    var ownerDocument = node.ownerDocument;
    return ownerDocument ? ownerDocument.defaultView || window : window;
  }

  return node;
}

function isElement$1(node) {
  var OwnElement = getWindow(node).Element;
  return node instanceof OwnElement || node instanceof Element;
}

function isHTMLElement(node) {
  var OwnElement = getWindow(node).HTMLElement;
  return node instanceof OwnElement || node instanceof HTMLElement;
}

function isShadowRoot(node) {
  // IE 11 has no ShadowRoot
  if (typeof ShadowRoot === 'undefined') {
    return false;
  }

  var OwnElement = getWindow(node).ShadowRoot;
  return node instanceof OwnElement || node instanceof ShadowRoot;
}

// and applies them to the HTMLElements such as popper and arrow

function applyStyles(_ref) {
  var state = _ref.state;
  Object.keys(state.elements).forEach(function (name) {
    var style = state.styles[name] || {};
    var attributes = state.attributes[name] || {};
    var element = state.elements[name]; // arrow is optional + virtual elements

    if (!isHTMLElement(element) || !getNodeName(element)) {
      return;
    } // Flow doesn't support to extend this property, but it's the most
    // effective way to apply styles to an HTMLElement
    // $FlowFixMe[cannot-write]


    Object.assign(element.style, style);
    Object.keys(attributes).forEach(function (name) {
      var value = attributes[name];

      if (value === false) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, value === true ? '' : value);
      }
    });
  });
}

function effect$2(_ref2) {
  var state = _ref2.state;
  var initialStyles = {
    popper: {
      position: state.options.strategy,
      left: '0',
      top: '0',
      margin: '0'
    },
    arrow: {
      position: 'absolute'
    },
    reference: {}
  };
  Object.assign(state.elements.popper.style, initialStyles.popper);
  state.styles = initialStyles;

  if (state.elements.arrow) {
    Object.assign(state.elements.arrow.style, initialStyles.arrow);
  }

  return function () {
    Object.keys(state.elements).forEach(function (name) {
      var element = state.elements[name];
      var attributes = state.attributes[name] || {};
      var styleProperties = Object.keys(state.styles.hasOwnProperty(name) ? state.styles[name] : initialStyles[name]); // Set all values to an empty string to unset them

      var style = styleProperties.reduce(function (style, property) {
        style[property] = '';
        return style;
      }, {}); // arrow is optional + virtual elements

      if (!isHTMLElement(element) || !getNodeName(element)) {
        return;
      }

      Object.assign(element.style, style);
      Object.keys(attributes).forEach(function (attribute) {
        element.removeAttribute(attribute);
      });
    });
  };
} // eslint-disable-next-line import/no-unused-modules


var applyStyles$1 = {
  name: 'applyStyles',
  enabled: true,
  phase: 'write',
  fn: applyStyles,
  effect: effect$2,
  requires: ['computeStyles']
};

function getBasePlacement$1(placement) {
  return placement.split('-')[0];
}

var max = Math.max;
var min = Math.min;
var round = Math.round;

function getBoundingClientRect(element, includeScale) {
  if (includeScale === void 0) {
    includeScale = false;
  }

  var rect = element.getBoundingClientRect();
  var scaleX = 1;
  var scaleY = 1;

  if (isHTMLElement(element) && includeScale) {
    var offsetHeight = element.offsetHeight;
    var offsetWidth = element.offsetWidth; // Do not attempt to divide by 0, otherwise we get `Infinity` as scale
    // Fallback to 1 in case both values are `0`

    if (offsetWidth > 0) {
      scaleX = round(rect.width) / offsetWidth || 1;
    }

    if (offsetHeight > 0) {
      scaleY = round(rect.height) / offsetHeight || 1;
    }
  }

  return {
    width: rect.width / scaleX,
    height: rect.height / scaleY,
    top: rect.top / scaleY,
    right: rect.right / scaleX,
    bottom: rect.bottom / scaleY,
    left: rect.left / scaleX,
    x: rect.left / scaleX,
    y: rect.top / scaleY
  };
}

// means it doesn't take into account transforms.

function getLayoutRect(element) {
  var clientRect = getBoundingClientRect(element); // Use the clientRect sizes if it's not been transformed.
  // Fixes https://github.com/popperjs/popper-core/issues/1223

  var width = element.offsetWidth;
  var height = element.offsetHeight;

  if (Math.abs(clientRect.width - width) <= 1) {
    width = clientRect.width;
  }

  if (Math.abs(clientRect.height - height) <= 1) {
    height = clientRect.height;
  }

  return {
    x: element.offsetLeft,
    y: element.offsetTop,
    width: width,
    height: height
  };
}

function contains(parent, child) {
  var rootNode = child.getRootNode && child.getRootNode(); // First, attempt with faster native method

  if (parent.contains(child)) {
    return true;
  } // then fallback to custom implementation with Shadow DOM support
  else if (rootNode && isShadowRoot(rootNode)) {
      var next = child;

      do {
        if (next && parent.isSameNode(next)) {
          return true;
        } // $FlowFixMe[prop-missing]: need a better way to handle this...


        next = next.parentNode || next.host;
      } while (next);
    } // Give up, the result is false


  return false;
}

function getComputedStyle(element) {
  return getWindow(element).getComputedStyle(element);
}

function isTableElement(element) {
  return ['table', 'td', 'th'].indexOf(getNodeName(element)) >= 0;
}

function getDocumentElement(element) {
  // $FlowFixMe[incompatible-return]: assume body is always available
  return ((isElement$1(element) ? element.ownerDocument : // $FlowFixMe[prop-missing]
  element.document) || window.document).documentElement;
}

function getParentNode(element) {
  if (getNodeName(element) === 'html') {
    return element;
  }

  return (// this is a quicker (but less type safe) way to save quite some bytes from the bundle
    // $FlowFixMe[incompatible-return]
    // $FlowFixMe[prop-missing]
    element.assignedSlot || // step into the shadow DOM of the parent of a slotted node
    element.parentNode || ( // DOM Element detected
    isShadowRoot(element) ? element.host : null) || // ShadowRoot detected
    // $FlowFixMe[incompatible-call]: HTMLElement is a Node
    getDocumentElement(element) // fallback

  );
}

function getTrueOffsetParent(element) {
  if (!isHTMLElement(element) || // https://github.com/popperjs/popper-core/issues/837
  getComputedStyle(element).position === 'fixed') {
    return null;
  }

  return element.offsetParent;
} // `.offsetParent` reports `null` for fixed elements, while absolute elements
// return the containing block


function getContainingBlock(element) {
  var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') !== -1;
  var isIE = navigator.userAgent.indexOf('Trident') !== -1;

  if (isIE && isHTMLElement(element)) {
    // In IE 9, 10 and 11 fixed elements containing block is always established by the viewport
    var elementCss = getComputedStyle(element);

    if (elementCss.position === 'fixed') {
      return null;
    }
  }

  var currentNode = getParentNode(element);

  while (isHTMLElement(currentNode) && ['html', 'body'].indexOf(getNodeName(currentNode)) < 0) {
    var css = getComputedStyle(currentNode); // This is non-exhaustive but covers the most common CSS properties that
    // create a containing block.
    // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block

    if (css.transform !== 'none' || css.perspective !== 'none' || css.contain === 'paint' || ['transform', 'perspective'].indexOf(css.willChange) !== -1 || isFirefox && css.willChange === 'filter' || isFirefox && css.filter && css.filter !== 'none') {
      return currentNode;
    } else {
      currentNode = currentNode.parentNode;
    }
  }

  return null;
} // Gets the closest ancestor positioned element. Handles some edge cases,
// such as table ancestors and cross browser bugs.


function getOffsetParent(element) {
  var window = getWindow(element);
  var offsetParent = getTrueOffsetParent(element);

  while (offsetParent && isTableElement(offsetParent) && getComputedStyle(offsetParent).position === 'static') {
    offsetParent = getTrueOffsetParent(offsetParent);
  }

  if (offsetParent && (getNodeName(offsetParent) === 'html' || getNodeName(offsetParent) === 'body' && getComputedStyle(offsetParent).position === 'static')) {
    return window;
  }

  return offsetParent || getContainingBlock(element) || window;
}

function getMainAxisFromPlacement(placement) {
  return ['top', 'bottom'].indexOf(placement) >= 0 ? 'x' : 'y';
}

function within(min$1, value, max$1) {
  return max(min$1, min(value, max$1));
}
function withinMaxClamp(min, value, max) {
  var v = within(min, value, max);
  return v > max ? max : v;
}

function getFreshSideObject() {
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
}

function mergePaddingObject(paddingObject) {
  return Object.assign({}, getFreshSideObject(), paddingObject);
}

function expandToHashMap(value, keys) {
  return keys.reduce(function (hashMap, key) {
    hashMap[key] = value;
    return hashMap;
  }, {});
}

var toPaddingObject = function toPaddingObject(padding, state) {
  padding = typeof padding === 'function' ? padding(Object.assign({}, state.rects, {
    placement: state.placement
  })) : padding;
  return mergePaddingObject(typeof padding !== 'number' ? padding : expandToHashMap(padding, basePlacements));
};

function arrow(_ref) {
  var _state$modifiersData$;

  var state = _ref.state,
      name = _ref.name,
      options = _ref.options;
  var arrowElement = state.elements.arrow;
  var popperOffsets = state.modifiersData.popperOffsets;
  var basePlacement = getBasePlacement$1(state.placement);
  var axis = getMainAxisFromPlacement(basePlacement);
  var isVertical = [left, right].indexOf(basePlacement) >= 0;
  var len = isVertical ? 'height' : 'width';

  if (!arrowElement || !popperOffsets) {
    return;
  }

  var paddingObject = toPaddingObject(options.padding, state);
  var arrowRect = getLayoutRect(arrowElement);
  var minProp = axis === 'y' ? top : left;
  var maxProp = axis === 'y' ? bottom : right;
  var endDiff = state.rects.reference[len] + state.rects.reference[axis] - popperOffsets[axis] - state.rects.popper[len];
  var startDiff = popperOffsets[axis] - state.rects.reference[axis];
  var arrowOffsetParent = getOffsetParent(arrowElement);
  var clientSize = arrowOffsetParent ? axis === 'y' ? arrowOffsetParent.clientHeight || 0 : arrowOffsetParent.clientWidth || 0 : 0;
  var centerToReference = endDiff / 2 - startDiff / 2; // Make sure the arrow doesn't overflow the popper if the center point is
  // outside of the popper bounds

  var min = paddingObject[minProp];
  var max = clientSize - arrowRect[len] - paddingObject[maxProp];
  var center = clientSize / 2 - arrowRect[len] / 2 + centerToReference;
  var offset = within(min, center, max); // Prevents breaking syntax highlighting...

  var axisProp = axis;
  state.modifiersData[name] = (_state$modifiersData$ = {}, _state$modifiersData$[axisProp] = offset, _state$modifiersData$.centerOffset = offset - center, _state$modifiersData$);
}

function effect$1(_ref2) {
  var state = _ref2.state,
      options = _ref2.options;
  var _options$element = options.element,
      arrowElement = _options$element === void 0 ? '[data-popper-arrow]' : _options$element;

  if (arrowElement == null) {
    return;
  } // CSS selector


  if (typeof arrowElement === 'string') {
    arrowElement = state.elements.popper.querySelector(arrowElement);

    if (!arrowElement) {
      return;
    }
  }

  if (!contains(state.elements.popper, arrowElement)) {

    return;
  }

  state.elements.arrow = arrowElement;
} // eslint-disable-next-line import/no-unused-modules


var arrow$1 = {
  name: 'arrow',
  enabled: true,
  phase: 'main',
  fn: arrow,
  effect: effect$1,
  requires: ['popperOffsets'],
  requiresIfExists: ['preventOverflow']
};

function getVariation(placement) {
  return placement.split('-')[1];
}

var unsetSides = {
  top: 'auto',
  right: 'auto',
  bottom: 'auto',
  left: 'auto'
}; // Round the offsets to the nearest suitable subpixel based on the DPR.
// Zooming can change the DPR, but it seems to report a value that will
// cleanly divide the values into the appropriate subpixels.

function roundOffsetsByDPR(_ref) {
  var x = _ref.x,
      y = _ref.y;
  var win = window;
  var dpr = win.devicePixelRatio || 1;
  return {
    x: round(x * dpr) / dpr || 0,
    y: round(y * dpr) / dpr || 0
  };
}

function mapToStyles(_ref2) {
  var _Object$assign2;

  var popper = _ref2.popper,
      popperRect = _ref2.popperRect,
      placement = _ref2.placement,
      variation = _ref2.variation,
      offsets = _ref2.offsets,
      position = _ref2.position,
      gpuAcceleration = _ref2.gpuAcceleration,
      adaptive = _ref2.adaptive,
      roundOffsets = _ref2.roundOffsets,
      isFixed = _ref2.isFixed;
  var _offsets$x = offsets.x,
      x = _offsets$x === void 0 ? 0 : _offsets$x,
      _offsets$y = offsets.y,
      y = _offsets$y === void 0 ? 0 : _offsets$y;

  var _ref3 = typeof roundOffsets === 'function' ? roundOffsets({
    x: x,
    y: y
  }) : {
    x: x,
    y: y
  };

  x = _ref3.x;
  y = _ref3.y;
  var hasX = offsets.hasOwnProperty('x');
  var hasY = offsets.hasOwnProperty('y');
  var sideX = left;
  var sideY = top;
  var win = window;

  if (adaptive) {
    var offsetParent = getOffsetParent(popper);
    var heightProp = 'clientHeight';
    var widthProp = 'clientWidth';

    if (offsetParent === getWindow(popper)) {
      offsetParent = getDocumentElement(popper);

      if (getComputedStyle(offsetParent).position !== 'static' && position === 'absolute') {
        heightProp = 'scrollHeight';
        widthProp = 'scrollWidth';
      }
    } // $FlowFixMe[incompatible-cast]: force type refinement, we compare offsetParent with window above, but Flow doesn't detect it


    offsetParent = offsetParent;

    if (placement === top || (placement === left || placement === right) && variation === end) {
      sideY = bottom;
      var offsetY = isFixed && win.visualViewport ? win.visualViewport.height : // $FlowFixMe[prop-missing]
      offsetParent[heightProp];
      y -= offsetY - popperRect.height;
      y *= gpuAcceleration ? 1 : -1;
    }

    if (placement === left || (placement === top || placement === bottom) && variation === end) {
      sideX = right;
      var offsetX = isFixed && win.visualViewport ? win.visualViewport.width : // $FlowFixMe[prop-missing]
      offsetParent[widthProp];
      x -= offsetX - popperRect.width;
      x *= gpuAcceleration ? 1 : -1;
    }
  }

  var commonStyles = Object.assign({
    position: position
  }, adaptive && unsetSides);

  var _ref4 = roundOffsets === true ? roundOffsetsByDPR({
    x: x,
    y: y
  }) : {
    x: x,
    y: y
  };

  x = _ref4.x;
  y = _ref4.y;

  if (gpuAcceleration) {
    var _Object$assign;

    return Object.assign({}, commonStyles, (_Object$assign = {}, _Object$assign[sideY] = hasY ? '0' : '', _Object$assign[sideX] = hasX ? '0' : '', _Object$assign.transform = (win.devicePixelRatio || 1) <= 1 ? "translate(" + x + "px, " + y + "px)" : "translate3d(" + x + "px, " + y + "px, 0)", _Object$assign));
  }

  return Object.assign({}, commonStyles, (_Object$assign2 = {}, _Object$assign2[sideY] = hasY ? y + "px" : '', _Object$assign2[sideX] = hasX ? x + "px" : '', _Object$assign2.transform = '', _Object$assign2));
}

function computeStyles(_ref5) {
  var state = _ref5.state,
      options = _ref5.options;
  var _options$gpuAccelerat = options.gpuAcceleration,
      gpuAcceleration = _options$gpuAccelerat === void 0 ? true : _options$gpuAccelerat,
      _options$adaptive = options.adaptive,
      adaptive = _options$adaptive === void 0 ? true : _options$adaptive,
      _options$roundOffsets = options.roundOffsets,
      roundOffsets = _options$roundOffsets === void 0 ? true : _options$roundOffsets;

  var commonStyles = {
    placement: getBasePlacement$1(state.placement),
    variation: getVariation(state.placement),
    popper: state.elements.popper,
    popperRect: state.rects.popper,
    gpuAcceleration: gpuAcceleration,
    isFixed: state.options.strategy === 'fixed'
  };

  if (state.modifiersData.popperOffsets != null) {
    state.styles.popper = Object.assign({}, state.styles.popper, mapToStyles(Object.assign({}, commonStyles, {
      offsets: state.modifiersData.popperOffsets,
      position: state.options.strategy,
      adaptive: adaptive,
      roundOffsets: roundOffsets
    })));
  }

  if (state.modifiersData.arrow != null) {
    state.styles.arrow = Object.assign({}, state.styles.arrow, mapToStyles(Object.assign({}, commonStyles, {
      offsets: state.modifiersData.arrow,
      position: 'absolute',
      adaptive: false,
      roundOffsets: roundOffsets
    })));
  }

  state.attributes.popper = Object.assign({}, state.attributes.popper, {
    'data-popper-placement': state.placement
  });
} // eslint-disable-next-line import/no-unused-modules


var computeStyles$1 = {
  name: 'computeStyles',
  enabled: true,
  phase: 'beforeWrite',
  fn: computeStyles,
  data: {}
};

var passive = {
  passive: true
};

function effect(_ref) {
  var state = _ref.state,
      instance = _ref.instance,
      options = _ref.options;
  var _options$scroll = options.scroll,
      scroll = _options$scroll === void 0 ? true : _options$scroll,
      _options$resize = options.resize,
      resize = _options$resize === void 0 ? true : _options$resize;
  var window = getWindow(state.elements.popper);
  var scrollParents = [].concat(state.scrollParents.reference, state.scrollParents.popper);

  if (scroll) {
    scrollParents.forEach(function (scrollParent) {
      scrollParent.addEventListener('scroll', instance.update, passive);
    });
  }

  if (resize) {
    window.addEventListener('resize', instance.update, passive);
  }

  return function () {
    if (scroll) {
      scrollParents.forEach(function (scrollParent) {
        scrollParent.removeEventListener('scroll', instance.update, passive);
      });
    }

    if (resize) {
      window.removeEventListener('resize', instance.update, passive);
    }
  };
} // eslint-disable-next-line import/no-unused-modules


var eventListeners = {
  name: 'eventListeners',
  enabled: true,
  phase: 'write',
  fn: function fn() {},
  effect: effect,
  data: {}
};

var hash$1 = {
  left: 'right',
  right: 'left',
  bottom: 'top',
  top: 'bottom'
};
function getOppositePlacement(placement) {
  return placement.replace(/left|right|bottom|top/g, function (matched) {
    return hash$1[matched];
  });
}

var hash = {
  start: 'end',
  end: 'start'
};
function getOppositeVariationPlacement(placement) {
  return placement.replace(/start|end/g, function (matched) {
    return hash[matched];
  });
}

function getWindowScroll(node) {
  var win = getWindow(node);
  var scrollLeft = win.pageXOffset;
  var scrollTop = win.pageYOffset;
  return {
    scrollLeft: scrollLeft,
    scrollTop: scrollTop
  };
}

function getWindowScrollBarX(element) {
  // If <html> has a CSS width greater than the viewport, then this will be
  // incorrect for RTL.
  // Popper 1 is broken in this case and never had a bug report so let's assume
  // it's not an issue. I don't think anyone ever specifies width on <html>
  // anyway.
  // Browsers where the left scrollbar doesn't cause an issue report `0` for
  // this (e.g. Edge 2019, IE11, Safari)
  return getBoundingClientRect(getDocumentElement(element)).left + getWindowScroll(element).scrollLeft;
}

function getViewportRect(element) {
  var win = getWindow(element);
  var html = getDocumentElement(element);
  var visualViewport = win.visualViewport;
  var width = html.clientWidth;
  var height = html.clientHeight;
  var x = 0;
  var y = 0; // NB: This isn't supported on iOS <= 12. If the keyboard is open, the popper
  // can be obscured underneath it.
  // Also, `html.clientHeight` adds the bottom bar height in Safari iOS, even
  // if it isn't open, so if this isn't available, the popper will be detected
  // to overflow the bottom of the screen too early.

  if (visualViewport) {
    width = visualViewport.width;
    height = visualViewport.height; // Uses Layout Viewport (like Chrome; Safari does not currently)
    // In Chrome, it returns a value very close to 0 (+/-) but contains rounding
    // errors due to floating point numbers, so we need to check precision.
    // Safari returns a number <= 0, usually < -1 when pinch-zoomed
    // Feature detection fails in mobile emulation mode in Chrome.
    // Math.abs(win.innerWidth / visualViewport.scale - visualViewport.width) <
    // 0.001
    // Fallback here: "Not Safari" userAgent

    if (!/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
      x = visualViewport.offsetLeft;
      y = visualViewport.offsetTop;
    }
  }

  return {
    width: width,
    height: height,
    x: x + getWindowScrollBarX(element),
    y: y
  };
}

// of the `<html>` and `<body>` rect bounds if horizontally scrollable

function getDocumentRect(element) {
  var _element$ownerDocumen;

  var html = getDocumentElement(element);
  var winScroll = getWindowScroll(element);
  var body = (_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body;
  var width = max(html.scrollWidth, html.clientWidth, body ? body.scrollWidth : 0, body ? body.clientWidth : 0);
  var height = max(html.scrollHeight, html.clientHeight, body ? body.scrollHeight : 0, body ? body.clientHeight : 0);
  var x = -winScroll.scrollLeft + getWindowScrollBarX(element);
  var y = -winScroll.scrollTop;

  if (getComputedStyle(body || html).direction === 'rtl') {
    x += max(html.clientWidth, body ? body.clientWidth : 0) - width;
  }

  return {
    width: width,
    height: height,
    x: x,
    y: y
  };
}

function isScrollParent(element) {
  // Firefox wants us to check `-x` and `-y` variations as well
  var _getComputedStyle = getComputedStyle(element),
      overflow = _getComputedStyle.overflow,
      overflowX = _getComputedStyle.overflowX,
      overflowY = _getComputedStyle.overflowY;

  return /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX);
}

function getScrollParent(node) {
  if (['html', 'body', '#document'].indexOf(getNodeName(node)) >= 0) {
    // $FlowFixMe[incompatible-return]: assume body is always available
    return node.ownerDocument.body;
  }

  if (isHTMLElement(node) && isScrollParent(node)) {
    return node;
  }

  return getScrollParent(getParentNode(node));
}

/*
given a DOM element, return the list of all scroll parents, up the list of ancesors
until we get to the top window object. This list is what we attach scroll listeners
to, because if any of these parent elements scroll, we'll need to re-calculate the
reference element's position.
*/

function listScrollParents(element, list) {
  var _element$ownerDocumen;

  if (list === void 0) {
    list = [];
  }

  var scrollParent = getScrollParent(element);
  var isBody = scrollParent === ((_element$ownerDocumen = element.ownerDocument) == null ? void 0 : _element$ownerDocumen.body);
  var win = getWindow(scrollParent);
  var target = isBody ? [win].concat(win.visualViewport || [], isScrollParent(scrollParent) ? scrollParent : []) : scrollParent;
  var updatedList = list.concat(target);
  return isBody ? updatedList : // $FlowFixMe[incompatible-call]: isBody tells us target will be an HTMLElement here
  updatedList.concat(listScrollParents(getParentNode(target)));
}

function rectToClientRect(rect) {
  return Object.assign({}, rect, {
    left: rect.x,
    top: rect.y,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height
  });
}

function getInnerBoundingClientRect(element) {
  var rect = getBoundingClientRect(element);
  rect.top = rect.top + element.clientTop;
  rect.left = rect.left + element.clientLeft;
  rect.bottom = rect.top + element.clientHeight;
  rect.right = rect.left + element.clientWidth;
  rect.width = element.clientWidth;
  rect.height = element.clientHeight;
  rect.x = rect.left;
  rect.y = rect.top;
  return rect;
}

function getClientRectFromMixedType(element, clippingParent) {
  return clippingParent === viewport ? rectToClientRect(getViewportRect(element)) : isElement$1(clippingParent) ? getInnerBoundingClientRect(clippingParent) : rectToClientRect(getDocumentRect(getDocumentElement(element)));
} // A "clipping parent" is an overflowable container with the characteristic of
// clipping (or hiding) overflowing elements with a position different from
// `initial`


function getClippingParents(element) {
  var clippingParents = listScrollParents(getParentNode(element));
  var canEscapeClipping = ['absolute', 'fixed'].indexOf(getComputedStyle(element).position) >= 0;
  var clipperElement = canEscapeClipping && isHTMLElement(element) ? getOffsetParent(element) : element;

  if (!isElement$1(clipperElement)) {
    return [];
  } // $FlowFixMe[incompatible-return]: https://github.com/facebook/flow/issues/1414


  return clippingParents.filter(function (clippingParent) {
    return isElement$1(clippingParent) && contains(clippingParent, clipperElement) && getNodeName(clippingParent) !== 'body';
  });
} // Gets the maximum area that the element is visible in due to any number of
// clipping parents


function getClippingRect(element, boundary, rootBoundary) {
  var mainClippingParents = boundary === 'clippingParents' ? getClippingParents(element) : [].concat(boundary);
  var clippingParents = [].concat(mainClippingParents, [rootBoundary]);
  var firstClippingParent = clippingParents[0];
  var clippingRect = clippingParents.reduce(function (accRect, clippingParent) {
    var rect = getClientRectFromMixedType(element, clippingParent);
    accRect.top = max(rect.top, accRect.top);
    accRect.right = min(rect.right, accRect.right);
    accRect.bottom = min(rect.bottom, accRect.bottom);
    accRect.left = max(rect.left, accRect.left);
    return accRect;
  }, getClientRectFromMixedType(element, firstClippingParent));
  clippingRect.width = clippingRect.right - clippingRect.left;
  clippingRect.height = clippingRect.bottom - clippingRect.top;
  clippingRect.x = clippingRect.left;
  clippingRect.y = clippingRect.top;
  return clippingRect;
}

function computeOffsets(_ref) {
  var reference = _ref.reference,
      element = _ref.element,
      placement = _ref.placement;
  var basePlacement = placement ? getBasePlacement$1(placement) : null;
  var variation = placement ? getVariation(placement) : null;
  var commonX = reference.x + reference.width / 2 - element.width / 2;
  var commonY = reference.y + reference.height / 2 - element.height / 2;
  var offsets;

  switch (basePlacement) {
    case top:
      offsets = {
        x: commonX,
        y: reference.y - element.height
      };
      break;

    case bottom:
      offsets = {
        x: commonX,
        y: reference.y + reference.height
      };
      break;

    case right:
      offsets = {
        x: reference.x + reference.width,
        y: commonY
      };
      break;

    case left:
      offsets = {
        x: reference.x - element.width,
        y: commonY
      };
      break;

    default:
      offsets = {
        x: reference.x,
        y: reference.y
      };
  }

  var mainAxis = basePlacement ? getMainAxisFromPlacement(basePlacement) : null;

  if (mainAxis != null) {
    var len = mainAxis === 'y' ? 'height' : 'width';

    switch (variation) {
      case start:
        offsets[mainAxis] = offsets[mainAxis] - (reference[len] / 2 - element[len] / 2);
        break;

      case end:
        offsets[mainAxis] = offsets[mainAxis] + (reference[len] / 2 - element[len] / 2);
        break;
    }
  }

  return offsets;
}

function detectOverflow(state, options) {
  if (options === void 0) {
    options = {};
  }

  var _options = options,
      _options$placement = _options.placement,
      placement = _options$placement === void 0 ? state.placement : _options$placement,
      _options$boundary = _options.boundary,
      boundary = _options$boundary === void 0 ? clippingParents : _options$boundary,
      _options$rootBoundary = _options.rootBoundary,
      rootBoundary = _options$rootBoundary === void 0 ? viewport : _options$rootBoundary,
      _options$elementConte = _options.elementContext,
      elementContext = _options$elementConte === void 0 ? popper : _options$elementConte,
      _options$altBoundary = _options.altBoundary,
      altBoundary = _options$altBoundary === void 0 ? false : _options$altBoundary,
      _options$padding = _options.padding,
      padding = _options$padding === void 0 ? 0 : _options$padding;
  var paddingObject = mergePaddingObject(typeof padding !== 'number' ? padding : expandToHashMap(padding, basePlacements));
  var altContext = elementContext === popper ? reference : popper;
  var popperRect = state.rects.popper;
  var element = state.elements[altBoundary ? altContext : elementContext];
  var clippingClientRect = getClippingRect(isElement$1(element) ? element : element.contextElement || getDocumentElement(state.elements.popper), boundary, rootBoundary);
  var referenceClientRect = getBoundingClientRect(state.elements.reference);
  var popperOffsets = computeOffsets({
    reference: referenceClientRect,
    element: popperRect,
    strategy: 'absolute',
    placement: placement
  });
  var popperClientRect = rectToClientRect(Object.assign({}, popperRect, popperOffsets));
  var elementClientRect = elementContext === popper ? popperClientRect : referenceClientRect; // positive = overflowing the clipping rect
  // 0 or negative = within the clipping rect

  var overflowOffsets = {
    top: clippingClientRect.top - elementClientRect.top + paddingObject.top,
    bottom: elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom,
    left: clippingClientRect.left - elementClientRect.left + paddingObject.left,
    right: elementClientRect.right - clippingClientRect.right + paddingObject.right
  };
  var offsetData = state.modifiersData.offset; // Offsets can be applied only to the popper element

  if (elementContext === popper && offsetData) {
    var offset = offsetData[placement];
    Object.keys(overflowOffsets).forEach(function (key) {
      var multiply = [right, bottom].indexOf(key) >= 0 ? 1 : -1;
      var axis = [top, bottom].indexOf(key) >= 0 ? 'y' : 'x';
      overflowOffsets[key] += offset[axis] * multiply;
    });
  }

  return overflowOffsets;
}

function computeAutoPlacement(state, options) {
  if (options === void 0) {
    options = {};
  }

  var _options = options,
      placement = _options.placement,
      boundary = _options.boundary,
      rootBoundary = _options.rootBoundary,
      padding = _options.padding,
      flipVariations = _options.flipVariations,
      _options$allowedAutoP = _options.allowedAutoPlacements,
      allowedAutoPlacements = _options$allowedAutoP === void 0 ? placements : _options$allowedAutoP;
  var variation = getVariation(placement);
  var placements$1 = variation ? flipVariations ? variationPlacements : variationPlacements.filter(function (placement) {
    return getVariation(placement) === variation;
  }) : basePlacements;
  var allowedPlacements = placements$1.filter(function (placement) {
    return allowedAutoPlacements.indexOf(placement) >= 0;
  });

  if (allowedPlacements.length === 0) {
    allowedPlacements = placements$1;
  } // $FlowFixMe[incompatible-type]: Flow seems to have problems with two array unions...


  var overflows = allowedPlacements.reduce(function (acc, placement) {
    acc[placement] = detectOverflow(state, {
      placement: placement,
      boundary: boundary,
      rootBoundary: rootBoundary,
      padding: padding
    })[getBasePlacement$1(placement)];
    return acc;
  }, {});
  return Object.keys(overflows).sort(function (a, b) {
    return overflows[a] - overflows[b];
  });
}

function getExpandedFallbackPlacements(placement) {
  if (getBasePlacement$1(placement) === auto) {
    return [];
  }

  var oppositePlacement = getOppositePlacement(placement);
  return [getOppositeVariationPlacement(placement), oppositePlacement, getOppositeVariationPlacement(oppositePlacement)];
}

function flip(_ref) {
  var state = _ref.state,
      options = _ref.options,
      name = _ref.name;

  if (state.modifiersData[name]._skip) {
    return;
  }

  var _options$mainAxis = options.mainAxis,
      checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis,
      _options$altAxis = options.altAxis,
      checkAltAxis = _options$altAxis === void 0 ? true : _options$altAxis,
      specifiedFallbackPlacements = options.fallbackPlacements,
      padding = options.padding,
      boundary = options.boundary,
      rootBoundary = options.rootBoundary,
      altBoundary = options.altBoundary,
      _options$flipVariatio = options.flipVariations,
      flipVariations = _options$flipVariatio === void 0 ? true : _options$flipVariatio,
      allowedAutoPlacements = options.allowedAutoPlacements;
  var preferredPlacement = state.options.placement;
  var basePlacement = getBasePlacement$1(preferredPlacement);
  var isBasePlacement = basePlacement === preferredPlacement;
  var fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipVariations ? [getOppositePlacement(preferredPlacement)] : getExpandedFallbackPlacements(preferredPlacement));
  var placements = [preferredPlacement].concat(fallbackPlacements).reduce(function (acc, placement) {
    return acc.concat(getBasePlacement$1(placement) === auto ? computeAutoPlacement(state, {
      placement: placement,
      boundary: boundary,
      rootBoundary: rootBoundary,
      padding: padding,
      flipVariations: flipVariations,
      allowedAutoPlacements: allowedAutoPlacements
    }) : placement);
  }, []);
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var checksMap = new Map();
  var makeFallbackChecks = true;
  var firstFittingPlacement = placements[0];

  for (var i = 0; i < placements.length; i++) {
    var placement = placements[i];

    var _basePlacement = getBasePlacement$1(placement);

    var isStartVariation = getVariation(placement) === start;
    var isVertical = [top, bottom].indexOf(_basePlacement) >= 0;
    var len = isVertical ? 'width' : 'height';
    var overflow = detectOverflow(state, {
      placement: placement,
      boundary: boundary,
      rootBoundary: rootBoundary,
      altBoundary: altBoundary,
      padding: padding
    });
    var mainVariationSide = isVertical ? isStartVariation ? right : left : isStartVariation ? bottom : top;

    if (referenceRect[len] > popperRect[len]) {
      mainVariationSide = getOppositePlacement(mainVariationSide);
    }

    var altVariationSide = getOppositePlacement(mainVariationSide);
    var checks = [];

    if (checkMainAxis) {
      checks.push(overflow[_basePlacement] <= 0);
    }

    if (checkAltAxis) {
      checks.push(overflow[mainVariationSide] <= 0, overflow[altVariationSide] <= 0);
    }

    if (checks.every(function (check) {
      return check;
    })) {
      firstFittingPlacement = placement;
      makeFallbackChecks = false;
      break;
    }

    checksMap.set(placement, checks);
  }

  if (makeFallbackChecks) {
    // `2` may be desired in some cases – research later
    var numberOfChecks = flipVariations ? 3 : 1;

    var _loop = function _loop(_i) {
      var fittingPlacement = placements.find(function (placement) {
        var checks = checksMap.get(placement);

        if (checks) {
          return checks.slice(0, _i).every(function (check) {
            return check;
          });
        }
      });

      if (fittingPlacement) {
        firstFittingPlacement = fittingPlacement;
        return "break";
      }
    };

    for (var _i = numberOfChecks; _i > 0; _i--) {
      var _ret = _loop(_i);

      if (_ret === "break") break;
    }
  }

  if (state.placement !== firstFittingPlacement) {
    state.modifiersData[name]._skip = true;
    state.placement = firstFittingPlacement;
    state.reset = true;
  }
} // eslint-disable-next-line import/no-unused-modules


var flip$1 = {
  name: 'flip',
  enabled: true,
  phase: 'main',
  fn: flip,
  requiresIfExists: ['offset'],
  data: {
    _skip: false
  }
};

function getSideOffsets(overflow, rect, preventedOffsets) {
  if (preventedOffsets === void 0) {
    preventedOffsets = {
      x: 0,
      y: 0
    };
  }

  return {
    top: overflow.top - rect.height - preventedOffsets.y,
    right: overflow.right - rect.width + preventedOffsets.x,
    bottom: overflow.bottom - rect.height + preventedOffsets.y,
    left: overflow.left - rect.width - preventedOffsets.x
  };
}

function isAnySideFullyClipped(overflow) {
  return [top, right, bottom, left].some(function (side) {
    return overflow[side] >= 0;
  });
}

function hide(_ref) {
  var state = _ref.state,
      name = _ref.name;
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var preventedOffsets = state.modifiersData.preventOverflow;
  var referenceOverflow = detectOverflow(state, {
    elementContext: 'reference'
  });
  var popperAltOverflow = detectOverflow(state, {
    altBoundary: true
  });
  var referenceClippingOffsets = getSideOffsets(referenceOverflow, referenceRect);
  var popperEscapeOffsets = getSideOffsets(popperAltOverflow, popperRect, preventedOffsets);
  var isReferenceHidden = isAnySideFullyClipped(referenceClippingOffsets);
  var hasPopperEscaped = isAnySideFullyClipped(popperEscapeOffsets);
  state.modifiersData[name] = {
    referenceClippingOffsets: referenceClippingOffsets,
    popperEscapeOffsets: popperEscapeOffsets,
    isReferenceHidden: isReferenceHidden,
    hasPopperEscaped: hasPopperEscaped
  };
  state.attributes.popper = Object.assign({}, state.attributes.popper, {
    'data-popper-reference-hidden': isReferenceHidden,
    'data-popper-escaped': hasPopperEscaped
  });
} // eslint-disable-next-line import/no-unused-modules


var hide$1 = {
  name: 'hide',
  enabled: true,
  phase: 'main',
  requiresIfExists: ['preventOverflow'],
  fn: hide
};

function distanceAndSkiddingToXY(placement, rects, offset) {
  var basePlacement = getBasePlacement$1(placement);
  var invertDistance = [left, top].indexOf(basePlacement) >= 0 ? -1 : 1;

  var _ref = typeof offset === 'function' ? offset(Object.assign({}, rects, {
    placement: placement
  })) : offset,
      skidding = _ref[0],
      distance = _ref[1];

  skidding = skidding || 0;
  distance = (distance || 0) * invertDistance;
  return [left, right].indexOf(basePlacement) >= 0 ? {
    x: distance,
    y: skidding
  } : {
    x: skidding,
    y: distance
  };
}

function offset(_ref2) {
  var state = _ref2.state,
      options = _ref2.options,
      name = _ref2.name;
  var _options$offset = options.offset,
      offset = _options$offset === void 0 ? [0, 0] : _options$offset;
  var data = placements.reduce(function (acc, placement) {
    acc[placement] = distanceAndSkiddingToXY(placement, state.rects, offset);
    return acc;
  }, {});
  var _data$state$placement = data[state.placement],
      x = _data$state$placement.x,
      y = _data$state$placement.y;

  if (state.modifiersData.popperOffsets != null) {
    state.modifiersData.popperOffsets.x += x;
    state.modifiersData.popperOffsets.y += y;
  }

  state.modifiersData[name] = data;
} // eslint-disable-next-line import/no-unused-modules


var offset$1 = {
  name: 'offset',
  enabled: true,
  phase: 'main',
  requires: ['popperOffsets'],
  fn: offset
};

function popperOffsets(_ref) {
  var state = _ref.state,
      name = _ref.name;
  // Offsets are the actual position the popper needs to have to be
  // properly positioned near its reference element
  // This is the most basic placement, and will be adjusted by
  // the modifiers in the next step
  state.modifiersData[name] = computeOffsets({
    reference: state.rects.reference,
    element: state.rects.popper,
    strategy: 'absolute',
    placement: state.placement
  });
} // eslint-disable-next-line import/no-unused-modules


var popperOffsets$1 = {
  name: 'popperOffsets',
  enabled: true,
  phase: 'read',
  fn: popperOffsets,
  data: {}
};

function getAltAxis(axis) {
  return axis === 'x' ? 'y' : 'x';
}

function preventOverflow(_ref) {
  var state = _ref.state,
      options = _ref.options,
      name = _ref.name;
  var _options$mainAxis = options.mainAxis,
      checkMainAxis = _options$mainAxis === void 0 ? true : _options$mainAxis,
      _options$altAxis = options.altAxis,
      checkAltAxis = _options$altAxis === void 0 ? false : _options$altAxis,
      boundary = options.boundary,
      rootBoundary = options.rootBoundary,
      altBoundary = options.altBoundary,
      padding = options.padding,
      _options$tether = options.tether,
      tether = _options$tether === void 0 ? true : _options$tether,
      _options$tetherOffset = options.tetherOffset,
      tetherOffset = _options$tetherOffset === void 0 ? 0 : _options$tetherOffset;
  var overflow = detectOverflow(state, {
    boundary: boundary,
    rootBoundary: rootBoundary,
    padding: padding,
    altBoundary: altBoundary
  });
  var basePlacement = getBasePlacement$1(state.placement);
  var variation = getVariation(state.placement);
  var isBasePlacement = !variation;
  var mainAxis = getMainAxisFromPlacement(basePlacement);
  var altAxis = getAltAxis(mainAxis);
  var popperOffsets = state.modifiersData.popperOffsets;
  var referenceRect = state.rects.reference;
  var popperRect = state.rects.popper;
  var tetherOffsetValue = typeof tetherOffset === 'function' ? tetherOffset(Object.assign({}, state.rects, {
    placement: state.placement
  })) : tetherOffset;
  var normalizedTetherOffsetValue = typeof tetherOffsetValue === 'number' ? {
    mainAxis: tetherOffsetValue,
    altAxis: tetherOffsetValue
  } : Object.assign({
    mainAxis: 0,
    altAxis: 0
  }, tetherOffsetValue);
  var offsetModifierState = state.modifiersData.offset ? state.modifiersData.offset[state.placement] : null;
  var data = {
    x: 0,
    y: 0
  };

  if (!popperOffsets) {
    return;
  }

  if (checkMainAxis) {
    var _offsetModifierState$;

    var mainSide = mainAxis === 'y' ? top : left;
    var altSide = mainAxis === 'y' ? bottom : right;
    var len = mainAxis === 'y' ? 'height' : 'width';
    var offset = popperOffsets[mainAxis];
    var min$1 = offset + overflow[mainSide];
    var max$1 = offset - overflow[altSide];
    var additive = tether ? -popperRect[len] / 2 : 0;
    var minLen = variation === start ? referenceRect[len] : popperRect[len];
    var maxLen = variation === start ? -popperRect[len] : -referenceRect[len]; // We need to include the arrow in the calculation so the arrow doesn't go
    // outside the reference bounds

    var arrowElement = state.elements.arrow;
    var arrowRect = tether && arrowElement ? getLayoutRect(arrowElement) : {
      width: 0,
      height: 0
    };
    var arrowPaddingObject = state.modifiersData['arrow#persistent'] ? state.modifiersData['arrow#persistent'].padding : getFreshSideObject();
    var arrowPaddingMin = arrowPaddingObject[mainSide];
    var arrowPaddingMax = arrowPaddingObject[altSide]; // If the reference length is smaller than the arrow length, we don't want
    // to include its full size in the calculation. If the reference is small
    // and near the edge of a boundary, the popper can overflow even if the
    // reference is not overflowing as well (e.g. virtual elements with no
    // width or height)

    var arrowLen = within(0, referenceRect[len], arrowRect[len]);
    var minOffset = isBasePlacement ? referenceRect[len] / 2 - additive - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis : minLen - arrowLen - arrowPaddingMin - normalizedTetherOffsetValue.mainAxis;
    var maxOffset = isBasePlacement ? -referenceRect[len] / 2 + additive + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis : maxLen + arrowLen + arrowPaddingMax + normalizedTetherOffsetValue.mainAxis;
    var arrowOffsetParent = state.elements.arrow && getOffsetParent(state.elements.arrow);
    var clientOffset = arrowOffsetParent ? mainAxis === 'y' ? arrowOffsetParent.clientTop || 0 : arrowOffsetParent.clientLeft || 0 : 0;
    var offsetModifierValue = (_offsetModifierState$ = offsetModifierState == null ? void 0 : offsetModifierState[mainAxis]) != null ? _offsetModifierState$ : 0;
    var tetherMin = offset + minOffset - offsetModifierValue - clientOffset;
    var tetherMax = offset + maxOffset - offsetModifierValue;
    var preventedOffset = within(tether ? min(min$1, tetherMin) : min$1, offset, tether ? max(max$1, tetherMax) : max$1);
    popperOffsets[mainAxis] = preventedOffset;
    data[mainAxis] = preventedOffset - offset;
  }

  if (checkAltAxis) {
    var _offsetModifierState$2;

    var _mainSide = mainAxis === 'x' ? top : left;

    var _altSide = mainAxis === 'x' ? bottom : right;

    var _offset = popperOffsets[altAxis];

    var _len = altAxis === 'y' ? 'height' : 'width';

    var _min = _offset + overflow[_mainSide];

    var _max = _offset - overflow[_altSide];

    var isOriginSide = [top, left].indexOf(basePlacement) !== -1;

    var _offsetModifierValue = (_offsetModifierState$2 = offsetModifierState == null ? void 0 : offsetModifierState[altAxis]) != null ? _offsetModifierState$2 : 0;

    var _tetherMin = isOriginSide ? _min : _offset - referenceRect[_len] - popperRect[_len] - _offsetModifierValue + normalizedTetherOffsetValue.altAxis;

    var _tetherMax = isOriginSide ? _offset + referenceRect[_len] + popperRect[_len] - _offsetModifierValue - normalizedTetherOffsetValue.altAxis : _max;

    var _preventedOffset = tether && isOriginSide ? withinMaxClamp(_tetherMin, _offset, _tetherMax) : within(tether ? _tetherMin : _min, _offset, tether ? _tetherMax : _max);

    popperOffsets[altAxis] = _preventedOffset;
    data[altAxis] = _preventedOffset - _offset;
  }

  state.modifiersData[name] = data;
} // eslint-disable-next-line import/no-unused-modules


var preventOverflow$1 = {
  name: 'preventOverflow',
  enabled: true,
  phase: 'main',
  fn: preventOverflow,
  requiresIfExists: ['offset']
};

function getHTMLElementScroll(element) {
  return {
    scrollLeft: element.scrollLeft,
    scrollTop: element.scrollTop
  };
}

function getNodeScroll(node) {
  if (node === getWindow(node) || !isHTMLElement(node)) {
    return getWindowScroll(node);
  } else {
    return getHTMLElementScroll(node);
  }
}

function isElementScaled(element) {
  var rect = element.getBoundingClientRect();
  var scaleX = round(rect.width) / element.offsetWidth || 1;
  var scaleY = round(rect.height) / element.offsetHeight || 1;
  return scaleX !== 1 || scaleY !== 1;
} // Returns the composite rect of an element relative to its offsetParent.
// Composite means it takes into account transforms as well as layout.


function getCompositeRect(elementOrVirtualElement, offsetParent, isFixed) {
  if (isFixed === void 0) {
    isFixed = false;
  }

  var isOffsetParentAnElement = isHTMLElement(offsetParent);
  var offsetParentIsScaled = isHTMLElement(offsetParent) && isElementScaled(offsetParent);
  var documentElement = getDocumentElement(offsetParent);
  var rect = getBoundingClientRect(elementOrVirtualElement, offsetParentIsScaled);
  var scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  var offsets = {
    x: 0,
    y: 0
  };

  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== 'body' || // https://github.com/popperjs/popper-core/issues/1078
    isScrollParent(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }

    if (isHTMLElement(offsetParent)) {
      offsets = getBoundingClientRect(offsetParent, true);
      offsets.x += offsetParent.clientLeft;
      offsets.y += offsetParent.clientTop;
    } else if (documentElement) {
      offsets.x = getWindowScrollBarX(documentElement);
    }
  }

  return {
    x: rect.left + scroll.scrollLeft - offsets.x,
    y: rect.top + scroll.scrollTop - offsets.y,
    width: rect.width,
    height: rect.height
  };
}

function order(modifiers) {
  var map = new Map();
  var visited = new Set();
  var result = [];
  modifiers.forEach(function (modifier) {
    map.set(modifier.name, modifier);
  }); // On visiting object, check for its dependencies and visit them recursively

  function sort(modifier) {
    visited.add(modifier.name);
    var requires = [].concat(modifier.requires || [], modifier.requiresIfExists || []);
    requires.forEach(function (dep) {
      if (!visited.has(dep)) {
        var depModifier = map.get(dep);

        if (depModifier) {
          sort(depModifier);
        }
      }
    });
    result.push(modifier);
  }

  modifiers.forEach(function (modifier) {
    if (!visited.has(modifier.name)) {
      // check for visited object
      sort(modifier);
    }
  });
  return result;
}

function orderModifiers(modifiers) {
  // order based on dependencies
  var orderedModifiers = order(modifiers); // order based on phase

  return modifierPhases.reduce(function (acc, phase) {
    return acc.concat(orderedModifiers.filter(function (modifier) {
      return modifier.phase === phase;
    }));
  }, []);
}

function debounce$1(fn) {
  var pending;
  return function () {
    if (!pending) {
      pending = new Promise(function (resolve) {
        Promise.resolve().then(function () {
          pending = undefined;
          resolve(fn());
        });
      });
    }

    return pending;
  };
}

function mergeByName(modifiers) {
  var merged = modifiers.reduce(function (merged, current) {
    var existing = merged[current.name];
    merged[current.name] = existing ? Object.assign({}, existing, current, {
      options: Object.assign({}, existing.options, current.options),
      data: Object.assign({}, existing.data, current.data)
    }) : current;
    return merged;
  }, {}); // IE11 does not support Object.values

  return Object.keys(merged).map(function (key) {
    return merged[key];
  });
}

var DEFAULT_OPTIONS = {
  placement: 'bottom',
  modifiers: [],
  strategy: 'absolute'
};

function areValidElements() {
  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  return !args.some(function (element) {
    return !(element && typeof element.getBoundingClientRect === 'function');
  });
}

function popperGenerator(generatorOptions) {
  if (generatorOptions === void 0) {
    generatorOptions = {};
  }

  var _generatorOptions = generatorOptions,
      _generatorOptions$def = _generatorOptions.defaultModifiers,
      defaultModifiers = _generatorOptions$def === void 0 ? [] : _generatorOptions$def,
      _generatorOptions$def2 = _generatorOptions.defaultOptions,
      defaultOptions = _generatorOptions$def2 === void 0 ? DEFAULT_OPTIONS : _generatorOptions$def2;
  return function createPopper(reference, popper, options) {
    if (options === void 0) {
      options = defaultOptions;
    }

    var state = {
      placement: 'bottom',
      orderedModifiers: [],
      options: Object.assign({}, DEFAULT_OPTIONS, defaultOptions),
      modifiersData: {},
      elements: {
        reference: reference,
        popper: popper
      },
      attributes: {},
      styles: {}
    };
    var effectCleanupFns = [];
    var isDestroyed = false;
    var instance = {
      state: state,
      setOptions: function setOptions(setOptionsAction) {
        var options = typeof setOptionsAction === 'function' ? setOptionsAction(state.options) : setOptionsAction;
        cleanupModifierEffects();
        state.options = Object.assign({}, defaultOptions, state.options, options);
        state.scrollParents = {
          reference: isElement$1(reference) ? listScrollParents(reference) : reference.contextElement ? listScrollParents(reference.contextElement) : [],
          popper: listScrollParents(popper)
        }; // Orders the modifiers based on their dependencies and `phase`
        // properties

        var orderedModifiers = orderModifiers(mergeByName([].concat(defaultModifiers, state.options.modifiers))); // Strip out disabled modifiers

        state.orderedModifiers = orderedModifiers.filter(function (m) {
          return m.enabled;
        }); // Validate the provided modifiers so that the consumer will get warned

        runModifierEffects();
        return instance.update();
      },
      // Sync update – it will always be executed, even if not necessary. This
      // is useful for low frequency updates where sync behavior simplifies the
      // logic.
      // For high frequency updates (e.g. `resize` and `scroll` events), always
      // prefer the async Popper#update method
      forceUpdate: function forceUpdate() {
        if (isDestroyed) {
          return;
        }

        var _state$elements = state.elements,
            reference = _state$elements.reference,
            popper = _state$elements.popper; // Don't proceed if `reference` or `popper` are not valid elements
        // anymore

        if (!areValidElements(reference, popper)) {

          return;
        } // Store the reference and popper rects to be read by modifiers


        state.rects = {
          reference: getCompositeRect(reference, getOffsetParent(popper), state.options.strategy === 'fixed'),
          popper: getLayoutRect(popper)
        }; // Modifiers have the ability to reset the current update cycle. The
        // most common use case for this is the `flip` modifier changing the
        // placement, which then needs to re-run all the modifiers, because the
        // logic was previously ran for the previous placement and is therefore
        // stale/incorrect

        state.reset = false;
        state.placement = state.options.placement; // On each update cycle, the `modifiersData` property for each modifier
        // is filled with the initial data specified by the modifier. This means
        // it doesn't persist and is fresh on each update.
        // To ensure persistent data, use `${name}#persistent`

        state.orderedModifiers.forEach(function (modifier) {
          return state.modifiersData[modifier.name] = Object.assign({}, modifier.data);
        });

        for (var index = 0; index < state.orderedModifiers.length; index++) {

          if (state.reset === true) {
            state.reset = false;
            index = -1;
            continue;
          }

          var _state$orderedModifie = state.orderedModifiers[index],
              fn = _state$orderedModifie.fn,
              _state$orderedModifie2 = _state$orderedModifie.options,
              _options = _state$orderedModifie2 === void 0 ? {} : _state$orderedModifie2,
              name = _state$orderedModifie.name;

          if (typeof fn === 'function') {
            state = fn({
              state: state,
              options: _options,
              name: name,
              instance: instance
            }) || state;
          }
        }
      },
      // Async and optimistically optimized update – it will not be executed if
      // not necessary (debounced to run at most once-per-tick)
      update: debounce$1(function () {
        return new Promise(function (resolve) {
          instance.forceUpdate();
          resolve(state);
        });
      }),
      destroy: function destroy() {
        cleanupModifierEffects();
        isDestroyed = true;
      }
    };

    if (!areValidElements(reference, popper)) {

      return instance;
    }

    instance.setOptions(options).then(function (state) {
      if (!isDestroyed && options.onFirstUpdate) {
        options.onFirstUpdate(state);
      }
    }); // Modifiers have the ability to execute arbitrary code before the first
    // update cycle runs. They will be executed in the same order as the update
    // cycle. This is useful when a modifier adds some persistent data that
    // other modifiers need to use, but the modifier is run after the dependent
    // one.

    function runModifierEffects() {
      state.orderedModifiers.forEach(function (_ref3) {
        var name = _ref3.name,
            _ref3$options = _ref3.options,
            options = _ref3$options === void 0 ? {} : _ref3$options,
            effect = _ref3.effect;

        if (typeof effect === 'function') {
          var cleanupFn = effect({
            state: state,
            name: name,
            instance: instance,
            options: options
          });

          var noopFn = function noopFn() {};

          effectCleanupFns.push(cleanupFn || noopFn);
        }
      });
    }

    function cleanupModifierEffects() {
      effectCleanupFns.forEach(function (fn) {
        return fn();
      });
      effectCleanupFns = [];
    }

    return instance;
  };
}

var defaultModifiers = [eventListeners, popperOffsets$1, computeStyles$1, applyStyles$1, offset$1, flip$1, preventOverflow$1, arrow$1, hide$1];
var createPopper = /*#__PURE__*/popperGenerator({
  defaultModifiers: defaultModifiers
}); // eslint-disable-next-line import/no-unused-modules

/**!
* tippy.js v6.3.7
* (c) 2017-2021 atomiks
* MIT License
*/
var BOX_CLASS = "tippy-box";
var CONTENT_CLASS = "tippy-content";
var BACKDROP_CLASS = "tippy-backdrop";
var ARROW_CLASS = "tippy-arrow";
var SVG_ARROW_CLASS = "tippy-svg-arrow";
var TOUCH_OPTIONS = {
  passive: true,
  capture: true
};
var TIPPY_DEFAULT_APPEND_TO = function TIPPY_DEFAULT_APPEND_TO() {
  return document.body;
};
function getValueAtIndexOrReturn(value, index, defaultValue) {
  if (Array.isArray(value)) {
    var v = value[index];
    return v == null ? Array.isArray(defaultValue) ? defaultValue[index] : defaultValue : v;
  }

  return value;
}
function isType(value, type) {
  var str = {}.toString.call(value);
  return str.indexOf('[object') === 0 && str.indexOf(type + "]") > -1;
}
function invokeWithArgsOrReturn(value, args) {
  return typeof value === 'function' ? value.apply(void 0, args) : value;
}
function debounce(fn, ms) {
  // Avoid wrapping in `setTimeout` if ms is 0 anyway
  if (ms === 0) {
    return fn;
  }

  var timeout;
  return function (arg) {
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      fn(arg);
    }, ms);
  };
}
function splitBySpaces(value) {
  return value.split(/\s+/).filter(Boolean);
}
function normalizeToArray(value) {
  return [].concat(value);
}
function pushIfUnique(arr, value) {
  if (arr.indexOf(value) === -1) {
    arr.push(value);
  }
}
function unique(arr) {
  return arr.filter(function (item, index) {
    return arr.indexOf(item) === index;
  });
}
function getBasePlacement(placement) {
  return placement.split('-')[0];
}
function arrayFrom(value) {
  return [].slice.call(value);
}
function removeUndefinedProps(obj) {
  return Object.keys(obj).reduce(function (acc, key) {
    if (obj[key] !== undefined) {
      acc[key] = obj[key];
    }

    return acc;
  }, {});
}

function div() {
  return document.createElement('div');
}
function isElement(value) {
  return ['Element', 'Fragment'].some(function (type) {
    return isType(value, type);
  });
}
function isNodeList(value) {
  return isType(value, 'NodeList');
}
function isMouseEvent(value) {
  return isType(value, 'MouseEvent');
}
function isReferenceElement(value) {
  return !!(value && value._tippy && value._tippy.reference === value);
}
function getArrayOfElements(value) {
  if (isElement(value)) {
    return [value];
  }

  if (isNodeList(value)) {
    return arrayFrom(value);
  }

  if (Array.isArray(value)) {
    return value;
  }

  return arrayFrom(document.querySelectorAll(value));
}
function setTransitionDuration(els, value) {
  els.forEach(function (el) {
    if (el) {
      el.style.transitionDuration = value + "ms";
    }
  });
}
function setVisibilityState(els, state) {
  els.forEach(function (el) {
    if (el) {
      el.setAttribute('data-state', state);
    }
  });
}
function getOwnerDocument(elementOrElements) {
  var _element$ownerDocumen;

  var _normalizeToArray = normalizeToArray(elementOrElements),
      element = _normalizeToArray[0]; // Elements created via a <template> have an ownerDocument with no reference to the body


  return element != null && (_element$ownerDocumen = element.ownerDocument) != null && _element$ownerDocumen.body ? element.ownerDocument : document;
}
function isCursorOutsideInteractiveBorder(popperTreeData, event) {
  var clientX = event.clientX,
      clientY = event.clientY;
  return popperTreeData.every(function (_ref) {
    var popperRect = _ref.popperRect,
        popperState = _ref.popperState,
        props = _ref.props;
    var interactiveBorder = props.interactiveBorder;
    var basePlacement = getBasePlacement(popperState.placement);
    var offsetData = popperState.modifiersData.offset;

    if (!offsetData) {
      return true;
    }

    var topDistance = basePlacement === 'bottom' ? offsetData.top.y : 0;
    var bottomDistance = basePlacement === 'top' ? offsetData.bottom.y : 0;
    var leftDistance = basePlacement === 'right' ? offsetData.left.x : 0;
    var rightDistance = basePlacement === 'left' ? offsetData.right.x : 0;
    var exceedsTop = popperRect.top - clientY + topDistance > interactiveBorder;
    var exceedsBottom = clientY - popperRect.bottom - bottomDistance > interactiveBorder;
    var exceedsLeft = popperRect.left - clientX + leftDistance > interactiveBorder;
    var exceedsRight = clientX - popperRect.right - rightDistance > interactiveBorder;
    return exceedsTop || exceedsBottom || exceedsLeft || exceedsRight;
  });
}
function updateTransitionEndListener(box, action, listener) {
  var method = action + "EventListener"; // some browsers apparently support `transition` (unprefixed) but only fire
  // `webkitTransitionEnd`...

  ['transitionend', 'webkitTransitionEnd'].forEach(function (event) {
    box[method](event, listener);
  });
}
/**
 * Compared to xxx.contains, this function works for dom structures with shadow
 * dom
 */

function actualContains(parent, child) {
  var target = child;

  while (target) {
    var _target$getRootNode;

    if (parent.contains(target)) {
      return true;
    }

    target = target.getRootNode == null ? void 0 : (_target$getRootNode = target.getRootNode()) == null ? void 0 : _target$getRootNode.host;
  }

  return false;
}

var currentInput = {
  isTouch: false
};
var lastMouseMoveTime = 0;
/**
 * When a `touchstart` event is fired, it's assumed the user is using touch
 * input. We'll bind a `mousemove` event listener to listen for mouse input in
 * the future. This way, the `isTouch` property is fully dynamic and will handle
 * hybrid devices that use a mix of touch + mouse input.
 */

function onDocumentTouchStart() {
  if (currentInput.isTouch) {
    return;
  }

  currentInput.isTouch = true;

  if (window.performance) {
    document.addEventListener('mousemove', onDocumentMouseMove);
  }
}
/**
 * When two `mousemove` event are fired consecutively within 20ms, it's assumed
 * the user is using mouse input again. `mousemove` can fire on touch devices as
 * well, but very rarely that quickly.
 */

function onDocumentMouseMove() {
  var now = performance.now();

  if (now - lastMouseMoveTime < 20) {
    currentInput.isTouch = false;
    document.removeEventListener('mousemove', onDocumentMouseMove);
  }

  lastMouseMoveTime = now;
}
/**
 * When an element is in focus and has a tippy, leaving the tab/window and
 * returning causes it to show again. For mouse users this is unexpected, but
 * for keyboard use it makes sense.
 * TODO: find a better technique to solve this problem
 */

function onWindowBlur() {
  var activeElement = document.activeElement;

  if (isReferenceElement(activeElement)) {
    var instance = activeElement._tippy;

    if (activeElement.blur && !instance.state.isVisible) {
      activeElement.blur();
    }
  }
}
function bindGlobalEventListeners() {
  document.addEventListener('touchstart', onDocumentTouchStart, TOUCH_OPTIONS);
  window.addEventListener('blur', onWindowBlur);
}

var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
var isIE11 = isBrowser ? // @ts-ignore
!!window.msCrypto : false;

var pluginProps = {
  animateFill: false,
  followCursor: false,
  inlinePositioning: false,
  sticky: false
};
var renderProps = {
  allowHTML: false,
  animation: 'fade',
  arrow: true,
  content: '',
  inertia: false,
  maxWidth: 350,
  role: 'tooltip',
  theme: '',
  zIndex: 9999
};
var defaultProps = Object.assign({
  appendTo: TIPPY_DEFAULT_APPEND_TO,
  aria: {
    content: 'auto',
    expanded: 'auto'
  },
  delay: 0,
  duration: [300, 250],
  getReferenceClientRect: null,
  hideOnClick: true,
  ignoreAttributes: false,
  interactive: false,
  interactiveBorder: 2,
  interactiveDebounce: 0,
  moveTransition: '',
  offset: [0, 10],
  onAfterUpdate: function onAfterUpdate() {},
  onBeforeUpdate: function onBeforeUpdate() {},
  onCreate: function onCreate() {},
  onDestroy: function onDestroy() {},
  onHidden: function onHidden() {},
  onHide: function onHide() {},
  onMount: function onMount() {},
  onShow: function onShow() {},
  onShown: function onShown() {},
  onTrigger: function onTrigger() {},
  onUntrigger: function onUntrigger() {},
  onClickOutside: function onClickOutside() {},
  placement: 'top',
  plugins: [],
  popperOptions: {},
  render: null,
  showOnCreate: false,
  touch: true,
  trigger: 'mouseenter focus',
  triggerTarget: null
}, pluginProps, renderProps);
var defaultKeys = Object.keys(defaultProps);
var setDefaultProps = function setDefaultProps(partialProps) {

  var keys = Object.keys(partialProps);
  keys.forEach(function (key) {
    defaultProps[key] = partialProps[key];
  });
};
function getExtendedPassedProps(passedProps) {
  var plugins = passedProps.plugins || [];
  var pluginProps = plugins.reduce(function (acc, plugin) {
    var name = plugin.name,
        defaultValue = plugin.defaultValue;

    if (name) {
      var _name;

      acc[name] = passedProps[name] !== undefined ? passedProps[name] : (_name = defaultProps[name]) != null ? _name : defaultValue;
    }

    return acc;
  }, {});
  return Object.assign({}, passedProps, pluginProps);
}
function getDataAttributeProps(reference, plugins) {
  var propKeys = plugins ? Object.keys(getExtendedPassedProps(Object.assign({}, defaultProps, {
    plugins: plugins
  }))) : defaultKeys;
  var props = propKeys.reduce(function (acc, key) {
    var valueAsString = (reference.getAttribute("data-tippy-" + key) || '').trim();

    if (!valueAsString) {
      return acc;
    }

    if (key === 'content') {
      acc[key] = valueAsString;
    } else {
      try {
        acc[key] = JSON.parse(valueAsString);
      } catch (e) {
        acc[key] = valueAsString;
      }
    }

    return acc;
  }, {});
  return props;
}
function evaluateProps(reference, props) {
  var out = Object.assign({}, props, {
    content: invokeWithArgsOrReturn(props.content, [reference])
  }, props.ignoreAttributes ? {} : getDataAttributeProps(reference, props.plugins));
  out.aria = Object.assign({}, defaultProps.aria, out.aria);
  out.aria = {
    expanded: out.aria.expanded === 'auto' ? props.interactive : out.aria.expanded,
    content: out.aria.content === 'auto' ? props.interactive ? null : 'describedby' : out.aria.content
  };
  return out;
}

var innerHTML = function innerHTML() {
  return 'innerHTML';
};

function dangerouslySetInnerHTML(element, html) {
  element[innerHTML()] = html;
}

function createArrowElement(value) {
  var arrow = div();

  if (value === true) {
    arrow.className = ARROW_CLASS;
  } else {
    arrow.className = SVG_ARROW_CLASS;

    if (isElement(value)) {
      arrow.appendChild(value);
    } else {
      dangerouslySetInnerHTML(arrow, value);
    }
  }

  return arrow;
}

function setContent(content, props) {
  if (isElement(props.content)) {
    dangerouslySetInnerHTML(content, '');
    content.appendChild(props.content);
  } else if (typeof props.content !== 'function') {
    if (props.allowHTML) {
      dangerouslySetInnerHTML(content, props.content);
    } else {
      content.textContent = props.content;
    }
  }
}
function getChildren(popper) {
  var box = popper.firstElementChild;
  var boxChildren = arrayFrom(box.children);
  return {
    box: box,
    content: boxChildren.find(function (node) {
      return node.classList.contains(CONTENT_CLASS);
    }),
    arrow: boxChildren.find(function (node) {
      return node.classList.contains(ARROW_CLASS) || node.classList.contains(SVG_ARROW_CLASS);
    }),
    backdrop: boxChildren.find(function (node) {
      return node.classList.contains(BACKDROP_CLASS);
    })
  };
}
function render(instance) {
  var popper = div();
  var box = div();
  box.className = BOX_CLASS;
  box.setAttribute('data-state', 'hidden');
  box.setAttribute('tabindex', '-1');
  var content = div();
  content.className = CONTENT_CLASS;
  content.setAttribute('data-state', 'hidden');
  setContent(content, instance.props);
  popper.appendChild(box);
  box.appendChild(content);
  onUpdate(instance.props, instance.props);

  function onUpdate(prevProps, nextProps) {
    var _getChildren = getChildren(popper),
        box = _getChildren.box,
        content = _getChildren.content,
        arrow = _getChildren.arrow;

    if (nextProps.theme) {
      box.setAttribute('data-theme', nextProps.theme);
    } else {
      box.removeAttribute('data-theme');
    }

    if (typeof nextProps.animation === 'string') {
      box.setAttribute('data-animation', nextProps.animation);
    } else {
      box.removeAttribute('data-animation');
    }

    if (nextProps.inertia) {
      box.setAttribute('data-inertia', '');
    } else {
      box.removeAttribute('data-inertia');
    }

    box.style.maxWidth = typeof nextProps.maxWidth === 'number' ? nextProps.maxWidth + "px" : nextProps.maxWidth;

    if (nextProps.role) {
      box.setAttribute('role', nextProps.role);
    } else {
      box.removeAttribute('role');
    }

    if (prevProps.content !== nextProps.content || prevProps.allowHTML !== nextProps.allowHTML) {
      setContent(content, instance.props);
    }

    if (nextProps.arrow) {
      if (!arrow) {
        box.appendChild(createArrowElement(nextProps.arrow));
      } else if (prevProps.arrow !== nextProps.arrow) {
        box.removeChild(arrow);
        box.appendChild(createArrowElement(nextProps.arrow));
      }
    } else if (arrow) {
      box.removeChild(arrow);
    }
  }

  return {
    popper: popper,
    onUpdate: onUpdate
  };
} // Runtime check to identify if the render function is the default one; this
// way we can apply default CSS transitions logic and it can be tree-shaken away

render.$$tippy = true;

var idCounter = 1;
var mouseMoveListeners = []; // Used by `hideAll()`

var mountedInstances = [];
function createTippy(reference, passedProps) {
  var props = evaluateProps(reference, Object.assign({}, defaultProps, getExtendedPassedProps(removeUndefinedProps(passedProps)))); // ===========================================================================
  // 🔒 Private members
  // ===========================================================================

  var showTimeout;
  var hideTimeout;
  var scheduleHideAnimationFrame;
  var isVisibleFromClick = false;
  var didHideDueToDocumentMouseDown = false;
  var didTouchMove = false;
  var ignoreOnFirstUpdate = false;
  var lastTriggerEvent;
  var currentTransitionEndListener;
  var onFirstUpdate;
  var listeners = [];
  var debouncedOnMouseMove = debounce(onMouseMove, props.interactiveDebounce);
  var currentTarget; // ===========================================================================
  // 🔑 Public members
  // ===========================================================================

  var id = idCounter++;
  var popperInstance = null;
  var plugins = unique(props.plugins);
  var state = {
    // Is the instance currently enabled?
    isEnabled: true,
    // Is the tippy currently showing and not transitioning out?
    isVisible: false,
    // Has the instance been destroyed?
    isDestroyed: false,
    // Is the tippy currently mounted to the DOM?
    isMounted: false,
    // Has the tippy finished transitioning in?
    isShown: false
  };
  var instance = {
    // properties
    id: id,
    reference: reference,
    popper: div(),
    popperInstance: popperInstance,
    props: props,
    state: state,
    plugins: plugins,
    // methods
    clearDelayTimeouts: clearDelayTimeouts,
    setProps: setProps,
    setContent: setContent,
    show: show,
    hide: hide,
    hideWithInteractivity: hideWithInteractivity,
    enable: enable,
    disable: disable,
    unmount: unmount,
    destroy: destroy
  }; // TODO: Investigate why this early return causes a TDZ error in the tests —
  // it doesn't seem to happen in the browser

  /* istanbul ignore if */

  if (!props.render) {

    return instance;
  } // ===========================================================================
  // Initial mutations
  // ===========================================================================


  var _props$render = props.render(instance),
      popper = _props$render.popper,
      onUpdate = _props$render.onUpdate;

  popper.setAttribute('data-tippy-root', '');
  popper.id = "tippy-" + instance.id;
  instance.popper = popper;
  reference._tippy = instance;
  popper._tippy = instance;
  var pluginsHooks = plugins.map(function (plugin) {
    return plugin.fn(instance);
  });
  var hasAriaExpanded = reference.hasAttribute('aria-expanded');
  addListeners();
  handleAriaExpandedAttribute();
  handleStyles();
  invokeHook('onCreate', [instance]);

  if (props.showOnCreate) {
    scheduleShow();
  } // Prevent a tippy with a delay from hiding if the cursor left then returned
  // before it started hiding


  popper.addEventListener('mouseenter', function () {
    if (instance.props.interactive && instance.state.isVisible) {
      instance.clearDelayTimeouts();
    }
  });
  popper.addEventListener('mouseleave', function () {
    if (instance.props.interactive && instance.props.trigger.indexOf('mouseenter') >= 0) {
      getDocument().addEventListener('mousemove', debouncedOnMouseMove);
    }
  });
  return instance; // ===========================================================================
  // 🔒 Private methods
  // ===========================================================================

  function getNormalizedTouchSettings() {
    var touch = instance.props.touch;
    return Array.isArray(touch) ? touch : [touch, 0];
  }

  function getIsCustomTouchBehavior() {
    return getNormalizedTouchSettings()[0] === 'hold';
  }

  function getIsDefaultRenderFn() {
    var _instance$props$rende;

    // @ts-ignore
    return !!((_instance$props$rende = instance.props.render) != null && _instance$props$rende.$$tippy);
  }

  function getCurrentTarget() {
    return currentTarget || reference;
  }

  function getDocument() {
    var parent = getCurrentTarget().parentNode;
    return parent ? getOwnerDocument(parent) : document;
  }

  function getDefaultTemplateChildren() {
    return getChildren(popper);
  }

  function getDelay(isShow) {
    // For touch or keyboard input, force `0` delay for UX reasons
    // Also if the instance is mounted but not visible (transitioning out),
    // ignore delay
    if (instance.state.isMounted && !instance.state.isVisible || currentInput.isTouch || lastTriggerEvent && lastTriggerEvent.type === 'focus') {
      return 0;
    }

    return getValueAtIndexOrReturn(instance.props.delay, isShow ? 0 : 1, defaultProps.delay);
  }

  function handleStyles(fromHide) {
    if (fromHide === void 0) {
      fromHide = false;
    }

    popper.style.pointerEvents = instance.props.interactive && !fromHide ? '' : 'none';
    popper.style.zIndex = "" + instance.props.zIndex;
  }

  function invokeHook(hook, args, shouldInvokePropsHook) {
    if (shouldInvokePropsHook === void 0) {
      shouldInvokePropsHook = true;
    }

    pluginsHooks.forEach(function (pluginHooks) {
      if (pluginHooks[hook]) {
        pluginHooks[hook].apply(pluginHooks, args);
      }
    });

    if (shouldInvokePropsHook) {
      var _instance$props;

      (_instance$props = instance.props)[hook].apply(_instance$props, args);
    }
  }

  function handleAriaContentAttribute() {
    var aria = instance.props.aria;

    if (!aria.content) {
      return;
    }

    var attr = "aria-" + aria.content;
    var id = popper.id;
    var nodes = normalizeToArray(instance.props.triggerTarget || reference);
    nodes.forEach(function (node) {
      var currentValue = node.getAttribute(attr);

      if (instance.state.isVisible) {
        node.setAttribute(attr, currentValue ? currentValue + " " + id : id);
      } else {
        var nextValue = currentValue && currentValue.replace(id, '').trim();

        if (nextValue) {
          node.setAttribute(attr, nextValue);
        } else {
          node.removeAttribute(attr);
        }
      }
    });
  }

  function handleAriaExpandedAttribute() {
    if (hasAriaExpanded || !instance.props.aria.expanded) {
      return;
    }

    var nodes = normalizeToArray(instance.props.triggerTarget || reference);
    nodes.forEach(function (node) {
      if (instance.props.interactive) {
        node.setAttribute('aria-expanded', instance.state.isVisible && node === getCurrentTarget() ? 'true' : 'false');
      } else {
        node.removeAttribute('aria-expanded');
      }
    });
  }

  function cleanupInteractiveMouseListeners() {
    getDocument().removeEventListener('mousemove', debouncedOnMouseMove);
    mouseMoveListeners = mouseMoveListeners.filter(function (listener) {
      return listener !== debouncedOnMouseMove;
    });
  }

  function onDocumentPress(event) {
    // Moved finger to scroll instead of an intentional tap outside
    if (currentInput.isTouch) {
      if (didTouchMove || event.type === 'mousedown') {
        return;
      }
    }

    var actualTarget = event.composedPath && event.composedPath()[0] || event.target; // Clicked on interactive popper

    if (instance.props.interactive && actualContains(popper, actualTarget)) {
      return;
    } // Clicked on the event listeners target


    if (normalizeToArray(instance.props.triggerTarget || reference).some(function (el) {
      return actualContains(el, actualTarget);
    })) {
      if (currentInput.isTouch) {
        return;
      }

      if (instance.state.isVisible && instance.props.trigger.indexOf('click') >= 0) {
        return;
      }
    } else {
      invokeHook('onClickOutside', [instance, event]);
    }

    if (instance.props.hideOnClick === true) {
      instance.clearDelayTimeouts();
      instance.hide(); // `mousedown` event is fired right before `focus` if pressing the
      // currentTarget. This lets a tippy with `focus` trigger know that it
      // should not show

      didHideDueToDocumentMouseDown = true;
      setTimeout(function () {
        didHideDueToDocumentMouseDown = false;
      }); // The listener gets added in `scheduleShow()`, but this may be hiding it
      // before it shows, and hide()'s early bail-out behavior can prevent it
      // from being cleaned up

      if (!instance.state.isMounted) {
        removeDocumentPress();
      }
    }
  }

  function onTouchMove() {
    didTouchMove = true;
  }

  function onTouchStart() {
    didTouchMove = false;
  }

  function addDocumentPress() {
    var doc = getDocument();
    doc.addEventListener('mousedown', onDocumentPress, true);
    doc.addEventListener('touchend', onDocumentPress, TOUCH_OPTIONS);
    doc.addEventListener('touchstart', onTouchStart, TOUCH_OPTIONS);
    doc.addEventListener('touchmove', onTouchMove, TOUCH_OPTIONS);
  }

  function removeDocumentPress() {
    var doc = getDocument();
    doc.removeEventListener('mousedown', onDocumentPress, true);
    doc.removeEventListener('touchend', onDocumentPress, TOUCH_OPTIONS);
    doc.removeEventListener('touchstart', onTouchStart, TOUCH_OPTIONS);
    doc.removeEventListener('touchmove', onTouchMove, TOUCH_OPTIONS);
  }

  function onTransitionedOut(duration, callback) {
    onTransitionEnd(duration, function () {
      if (!instance.state.isVisible && popper.parentNode && popper.parentNode.contains(popper)) {
        callback();
      }
    });
  }

  function onTransitionedIn(duration, callback) {
    onTransitionEnd(duration, callback);
  }

  function onTransitionEnd(duration, callback) {
    var box = getDefaultTemplateChildren().box;

    function listener(event) {
      if (event.target === box) {
        updateTransitionEndListener(box, 'remove', listener);
        callback();
      }
    } // Make callback synchronous if duration is 0
    // `transitionend` won't fire otherwise


    if (duration === 0) {
      return callback();
    }

    updateTransitionEndListener(box, 'remove', currentTransitionEndListener);
    updateTransitionEndListener(box, 'add', listener);
    currentTransitionEndListener = listener;
  }

  function on(eventType, handler, options) {
    if (options === void 0) {
      options = false;
    }

    var nodes = normalizeToArray(instance.props.triggerTarget || reference);
    nodes.forEach(function (node) {
      node.addEventListener(eventType, handler, options);
      listeners.push({
        node: node,
        eventType: eventType,
        handler: handler,
        options: options
      });
    });
  }

  function addListeners() {
    if (getIsCustomTouchBehavior()) {
      on('touchstart', onTrigger, {
        passive: true
      });
      on('touchend', onMouseLeave, {
        passive: true
      });
    }

    splitBySpaces(instance.props.trigger).forEach(function (eventType) {
      if (eventType === 'manual') {
        return;
      }

      on(eventType, onTrigger);

      switch (eventType) {
        case 'mouseenter':
          on('mouseleave', onMouseLeave);
          break;

        case 'focus':
          on(isIE11 ? 'focusout' : 'blur', onBlurOrFocusOut);
          break;

        case 'focusin':
          on('focusout', onBlurOrFocusOut);
          break;
      }
    });
  }

  function removeListeners() {
    listeners.forEach(function (_ref) {
      var node = _ref.node,
          eventType = _ref.eventType,
          handler = _ref.handler,
          options = _ref.options;
      node.removeEventListener(eventType, handler, options);
    });
    listeners = [];
  }

  function onTrigger(event) {
    var _lastTriggerEvent;

    var shouldScheduleClickHide = false;

    if (!instance.state.isEnabled || isEventListenerStopped(event) || didHideDueToDocumentMouseDown) {
      return;
    }

    var wasFocused = ((_lastTriggerEvent = lastTriggerEvent) == null ? void 0 : _lastTriggerEvent.type) === 'focus';
    lastTriggerEvent = event;
    currentTarget = event.currentTarget;
    handleAriaExpandedAttribute();

    if (!instance.state.isVisible && isMouseEvent(event)) {
      // If scrolling, `mouseenter` events can be fired if the cursor lands
      // over a new target, but `mousemove` events don't get fired. This
      // causes interactive tooltips to get stuck open until the cursor is
      // moved
      mouseMoveListeners.forEach(function (listener) {
        return listener(event);
      });
    } // Toggle show/hide when clicking click-triggered tooltips


    if (event.type === 'click' && (instance.props.trigger.indexOf('mouseenter') < 0 || isVisibleFromClick) && instance.props.hideOnClick !== false && instance.state.isVisible) {
      shouldScheduleClickHide = true;
    } else {
      scheduleShow(event);
    }

    if (event.type === 'click') {
      isVisibleFromClick = !shouldScheduleClickHide;
    }

    if (shouldScheduleClickHide && !wasFocused) {
      scheduleHide(event);
    }
  }

  function onMouseMove(event) {
    var target = event.target;
    var isCursorOverReferenceOrPopper = getCurrentTarget().contains(target) || popper.contains(target);

    if (event.type === 'mousemove' && isCursorOverReferenceOrPopper) {
      return;
    }

    var popperTreeData = getNestedPopperTree().concat(popper).map(function (popper) {
      var _instance$popperInsta;

      var instance = popper._tippy;
      var state = (_instance$popperInsta = instance.popperInstance) == null ? void 0 : _instance$popperInsta.state;

      if (state) {
        return {
          popperRect: popper.getBoundingClientRect(),
          popperState: state,
          props: props
        };
      }

      return null;
    }).filter(Boolean);

    if (isCursorOutsideInteractiveBorder(popperTreeData, event)) {
      cleanupInteractiveMouseListeners();
      scheduleHide(event);
    }
  }

  function onMouseLeave(event) {
    var shouldBail = isEventListenerStopped(event) || instance.props.trigger.indexOf('click') >= 0 && isVisibleFromClick;

    if (shouldBail) {
      return;
    }

    if (instance.props.interactive) {
      instance.hideWithInteractivity(event);
      return;
    }

    scheduleHide(event);
  }

  function onBlurOrFocusOut(event) {
    if (instance.props.trigger.indexOf('focusin') < 0 && event.target !== getCurrentTarget()) {
      return;
    } // If focus was moved to within the popper


    if (instance.props.interactive && event.relatedTarget && popper.contains(event.relatedTarget)) {
      return;
    }

    scheduleHide(event);
  }

  function isEventListenerStopped(event) {
    return currentInput.isTouch ? getIsCustomTouchBehavior() !== event.type.indexOf('touch') >= 0 : false;
  }

  function createPopperInstance() {
    destroyPopperInstance();
    var _instance$props2 = instance.props,
        popperOptions = _instance$props2.popperOptions,
        placement = _instance$props2.placement,
        offset = _instance$props2.offset,
        getReferenceClientRect = _instance$props2.getReferenceClientRect,
        moveTransition = _instance$props2.moveTransition;
    var arrow = getIsDefaultRenderFn() ? getChildren(popper).arrow : null;
    var computedReference = getReferenceClientRect ? {
      getBoundingClientRect: getReferenceClientRect,
      contextElement: getReferenceClientRect.contextElement || getCurrentTarget()
    } : reference;
    var tippyModifier = {
      name: '$$tippy',
      enabled: true,
      phase: 'beforeWrite',
      requires: ['computeStyles'],
      fn: function fn(_ref2) {
        var state = _ref2.state;

        if (getIsDefaultRenderFn()) {
          var _getDefaultTemplateCh = getDefaultTemplateChildren(),
              box = _getDefaultTemplateCh.box;

          ['placement', 'reference-hidden', 'escaped'].forEach(function (attr) {
            if (attr === 'placement') {
              box.setAttribute('data-placement', state.placement);
            } else {
              if (state.attributes.popper["data-popper-" + attr]) {
                box.setAttribute("data-" + attr, '');
              } else {
                box.removeAttribute("data-" + attr);
              }
            }
          });
          state.attributes.popper = {};
        }
      }
    };
    var modifiers = [{
      name: 'offset',
      options: {
        offset: offset
      }
    }, {
      name: 'preventOverflow',
      options: {
        padding: {
          top: 2,
          bottom: 2,
          left: 5,
          right: 5
        }
      }
    }, {
      name: 'flip',
      options: {
        padding: 5
      }
    }, {
      name: 'computeStyles',
      options: {
        adaptive: !moveTransition
      }
    }, tippyModifier];

    if (getIsDefaultRenderFn() && arrow) {
      modifiers.push({
        name: 'arrow',
        options: {
          element: arrow,
          padding: 3
        }
      });
    }

    modifiers.push.apply(modifiers, (popperOptions == null ? void 0 : popperOptions.modifiers) || []);
    instance.popperInstance = createPopper(computedReference, popper, Object.assign({}, popperOptions, {
      placement: placement,
      onFirstUpdate: onFirstUpdate,
      modifiers: modifiers
    }));
  }

  function destroyPopperInstance() {
    if (instance.popperInstance) {
      instance.popperInstance.destroy();
      instance.popperInstance = null;
    }
  }

  function mount() {
    var appendTo = instance.props.appendTo;
    var parentNode; // By default, we'll append the popper to the triggerTargets's parentNode so
    // it's directly after the reference element so the elements inside the
    // tippy can be tabbed to
    // If there are clipping issues, the user can specify a different appendTo
    // and ensure focus management is handled correctly manually

    var node = getCurrentTarget();

    if (instance.props.interactive && appendTo === TIPPY_DEFAULT_APPEND_TO || appendTo === 'parent') {
      parentNode = node.parentNode;
    } else {
      parentNode = invokeWithArgsOrReturn(appendTo, [node]);
    } // The popper element needs to exist on the DOM before its position can be
    // updated as Popper needs to read its dimensions


    if (!parentNode.contains(popper)) {
      parentNode.appendChild(popper);
    }

    instance.state.isMounted = true;
    createPopperInstance();
  }

  function getNestedPopperTree() {
    return arrayFrom(popper.querySelectorAll('[data-tippy-root]'));
  }

  function scheduleShow(event) {
    instance.clearDelayTimeouts();

    if (event) {
      invokeHook('onTrigger', [instance, event]);
    }

    addDocumentPress();
    var delay = getDelay(true);

    var _getNormalizedTouchSe = getNormalizedTouchSettings(),
        touchValue = _getNormalizedTouchSe[0],
        touchDelay = _getNormalizedTouchSe[1];

    if (currentInput.isTouch && touchValue === 'hold' && touchDelay) {
      delay = touchDelay;
    }

    if (delay) {
      showTimeout = setTimeout(function () {
        instance.show();
      }, delay);
    } else {
      instance.show();
    }
  }

  function scheduleHide(event) {
    instance.clearDelayTimeouts();
    invokeHook('onUntrigger', [instance, event]);

    if (!instance.state.isVisible) {
      removeDocumentPress();
      return;
    } // For interactive tippies, scheduleHide is added to a document.body handler
    // from onMouseLeave so must intercept scheduled hides from mousemove/leave
    // events when trigger contains mouseenter and click, and the tip is
    // currently shown as a result of a click.


    if (instance.props.trigger.indexOf('mouseenter') >= 0 && instance.props.trigger.indexOf('click') >= 0 && ['mouseleave', 'mousemove'].indexOf(event.type) >= 0 && isVisibleFromClick) {
      return;
    }

    var delay = getDelay(false);

    if (delay) {
      hideTimeout = setTimeout(function () {
        if (instance.state.isVisible) {
          instance.hide();
        }
      }, delay);
    } else {
      // Fixes a `transitionend` problem when it fires 1 frame too
      // late sometimes, we don't want hide() to be called.
      scheduleHideAnimationFrame = requestAnimationFrame(function () {
        instance.hide();
      });
    }
  } // ===========================================================================
  // 🔑 Public methods
  // ===========================================================================


  function enable() {
    instance.state.isEnabled = true;
  }

  function disable() {
    // Disabling the instance should also hide it
    // https://github.com/atomiks/tippy.js-react/issues/106
    instance.hide();
    instance.state.isEnabled = false;
  }

  function clearDelayTimeouts() {
    clearTimeout(showTimeout);
    clearTimeout(hideTimeout);
    cancelAnimationFrame(scheduleHideAnimationFrame);
  }

  function setProps(partialProps) {

    if (instance.state.isDestroyed) {
      return;
    }

    invokeHook('onBeforeUpdate', [instance, partialProps]);
    removeListeners();
    var prevProps = instance.props;
    var nextProps = evaluateProps(reference, Object.assign({}, prevProps, removeUndefinedProps(partialProps), {
      ignoreAttributes: true
    }));
    instance.props = nextProps;
    addListeners();

    if (prevProps.interactiveDebounce !== nextProps.interactiveDebounce) {
      cleanupInteractiveMouseListeners();
      debouncedOnMouseMove = debounce(onMouseMove, nextProps.interactiveDebounce);
    } // Ensure stale aria-expanded attributes are removed


    if (prevProps.triggerTarget && !nextProps.triggerTarget) {
      normalizeToArray(prevProps.triggerTarget).forEach(function (node) {
        node.removeAttribute('aria-expanded');
      });
    } else if (nextProps.triggerTarget) {
      reference.removeAttribute('aria-expanded');
    }

    handleAriaExpandedAttribute();
    handleStyles();

    if (onUpdate) {
      onUpdate(prevProps, nextProps);
    }

    if (instance.popperInstance) {
      createPopperInstance(); // Fixes an issue with nested tippies if they are all getting re-rendered,
      // and the nested ones get re-rendered first.
      // https://github.com/atomiks/tippyjs-react/issues/177
      // TODO: find a cleaner / more efficient solution(!)

      getNestedPopperTree().forEach(function (nestedPopper) {
        // React (and other UI libs likely) requires a rAF wrapper as it flushes
        // its work in one
        requestAnimationFrame(nestedPopper._tippy.popperInstance.forceUpdate);
      });
    }

    invokeHook('onAfterUpdate', [instance, partialProps]);
  }

  function setContent(content) {
    instance.setProps({
      content: content
    });
  }

  function show() {


    var isAlreadyVisible = instance.state.isVisible;
    var isDestroyed = instance.state.isDestroyed;
    var isDisabled = !instance.state.isEnabled;
    var isTouchAndTouchDisabled = currentInput.isTouch && !instance.props.touch;
    var duration = getValueAtIndexOrReturn(instance.props.duration, 0, defaultProps.duration);

    if (isAlreadyVisible || isDestroyed || isDisabled || isTouchAndTouchDisabled) {
      return;
    } // Normalize `disabled` behavior across browsers.
    // Firefox allows events on disabled elements, but Chrome doesn't.
    // Using a wrapper element (i.e. <span>) is recommended.


    if (getCurrentTarget().hasAttribute('disabled')) {
      return;
    }

    invokeHook('onShow', [instance], false);

    if (instance.props.onShow(instance) === false) {
      return;
    }

    instance.state.isVisible = true;

    if (getIsDefaultRenderFn()) {
      popper.style.visibility = 'visible';
    }

    handleStyles();
    addDocumentPress();

    if (!instance.state.isMounted) {
      popper.style.transition = 'none';
    } // If flipping to the opposite side after hiding at least once, the
    // animation will use the wrong placement without resetting the duration


    if (getIsDefaultRenderFn()) {
      var _getDefaultTemplateCh2 = getDefaultTemplateChildren(),
          box = _getDefaultTemplateCh2.box,
          content = _getDefaultTemplateCh2.content;

      setTransitionDuration([box, content], 0);
    }

    onFirstUpdate = function onFirstUpdate() {
      var _instance$popperInsta2;

      if (!instance.state.isVisible || ignoreOnFirstUpdate) {
        return;
      }

      ignoreOnFirstUpdate = true; // reflow

      void popper.offsetHeight;
      popper.style.transition = instance.props.moveTransition;

      if (getIsDefaultRenderFn() && instance.props.animation) {
        var _getDefaultTemplateCh3 = getDefaultTemplateChildren(),
            _box = _getDefaultTemplateCh3.box,
            _content = _getDefaultTemplateCh3.content;

        setTransitionDuration([_box, _content], duration);
        setVisibilityState([_box, _content], 'visible');
      }

      handleAriaContentAttribute();
      handleAriaExpandedAttribute();
      pushIfUnique(mountedInstances, instance); // certain modifiers (e.g. `maxSize`) require a second update after the
      // popper has been positioned for the first time

      (_instance$popperInsta2 = instance.popperInstance) == null ? void 0 : _instance$popperInsta2.forceUpdate();
      invokeHook('onMount', [instance]);

      if (instance.props.animation && getIsDefaultRenderFn()) {
        onTransitionedIn(duration, function () {
          instance.state.isShown = true;
          invokeHook('onShown', [instance]);
        });
      }
    };

    mount();
  }

  function hide() {


    var isAlreadyHidden = !instance.state.isVisible;
    var isDestroyed = instance.state.isDestroyed;
    var isDisabled = !instance.state.isEnabled;
    var duration = getValueAtIndexOrReturn(instance.props.duration, 1, defaultProps.duration);

    if (isAlreadyHidden || isDestroyed || isDisabled) {
      return;
    }

    invokeHook('onHide', [instance], false);

    if (instance.props.onHide(instance) === false) {
      return;
    }

    instance.state.isVisible = false;
    instance.state.isShown = false;
    ignoreOnFirstUpdate = false;
    isVisibleFromClick = false;

    if (getIsDefaultRenderFn()) {
      popper.style.visibility = 'hidden';
    }

    cleanupInteractiveMouseListeners();
    removeDocumentPress();
    handleStyles(true);

    if (getIsDefaultRenderFn()) {
      var _getDefaultTemplateCh4 = getDefaultTemplateChildren(),
          box = _getDefaultTemplateCh4.box,
          content = _getDefaultTemplateCh4.content;

      if (instance.props.animation) {
        setTransitionDuration([box, content], duration);
        setVisibilityState([box, content], 'hidden');
      }
    }

    handleAriaContentAttribute();
    handleAriaExpandedAttribute();

    if (instance.props.animation) {
      if (getIsDefaultRenderFn()) {
        onTransitionedOut(duration, instance.unmount);
      }
    } else {
      instance.unmount();
    }
  }

  function hideWithInteractivity(event) {

    getDocument().addEventListener('mousemove', debouncedOnMouseMove);
    pushIfUnique(mouseMoveListeners, debouncedOnMouseMove);
    debouncedOnMouseMove(event);
  }

  function unmount() {

    if (instance.state.isVisible) {
      instance.hide();
    }

    if (!instance.state.isMounted) {
      return;
    }

    destroyPopperInstance(); // If a popper is not interactive, it will be appended outside the popper
    // tree by default. This seems mainly for interactive tippies, but we should
    // find a workaround if possible

    getNestedPopperTree().forEach(function (nestedPopper) {
      nestedPopper._tippy.unmount();
    });

    if (popper.parentNode) {
      popper.parentNode.removeChild(popper);
    }

    mountedInstances = mountedInstances.filter(function (i) {
      return i !== instance;
    });
    instance.state.isMounted = false;
    invokeHook('onHidden', [instance]);
  }

  function destroy() {

    if (instance.state.isDestroyed) {
      return;
    }

    instance.clearDelayTimeouts();
    instance.unmount();
    removeListeners();
    delete reference._tippy;
    instance.state.isDestroyed = true;
    invokeHook('onDestroy', [instance]);
  }
}

function tippy(targets, optionalProps) {
  if (optionalProps === void 0) {
    optionalProps = {};
  }

  var plugins = defaultProps.plugins.concat(optionalProps.plugins || []);

  bindGlobalEventListeners();
  var passedProps = Object.assign({}, optionalProps, {
    plugins: plugins
  });
  var elements = getArrayOfElements(targets);

  var instances = elements.reduce(function (acc, reference) {
    var instance = reference && createTippy(reference, passedProps);

    if (instance) {
      acc.push(instance);
    }

    return acc;
  }, []);
  return isElement(targets) ? instances[0] : instances;
}

tippy.defaultProps = defaultProps;
tippy.setDefaultProps = setDefaultProps;
tippy.currentInput = currentInput;

// every time the popper is destroyed (i.e. a new target), removing the styles
// and causing transitions to break for singletons when the console is open, but
// most notably for non-transform styles being used, `gpuAcceleration: false`.

Object.assign({}, applyStyles$1, {
  effect: function effect(_ref) {
    var state = _ref.state;
    var initialStyles = {
      popper: {
        position: state.options.strategy,
        left: '0',
        top: '0',
        margin: '0'
      },
      arrow: {
        position: 'absolute'
      },
      reference: {}
    };
    Object.assign(state.elements.popper.style, initialStyles.popper);
    state.styles = initialStyles;

    if (state.elements.arrow) {
      Object.assign(state.elements.arrow.style, initialStyles.arrow);
    } // intentionally return no cleanup function
    // return () => { ... }

  }
});

tippy.setDefaultProps({
  render: render
});

const _tmpl$$2 = template(`<div></div>`);
const Tooltip = ({
  type = 'accent',
  title,
  placement = 'auto',
  trigger = 'mouseenter',
  children
}) => {
  let divRef;
  onMount(() => {
    if (divRef) tippy(divRef, {
      content: title,
      theme: type,
      placement: placement,
      trigger: trigger
    });
  });
  return (() => {
    const _el$ = _tmpl$$2.cloneNode(true);

    const _ref$ = divRef;
    typeof _ref$ === "function" ? _ref$(_el$) : divRef = _el$;

    _el$.style.setProperty("width", "fit-content");

    _el$.style.setProperty("height", "fit-content");

    insert(_el$, children);

    return _el$;
  })();
};

const StyledContainer = styled('div')`
  margin-left: auto;
  margin-right: auto;
  width: ${props => props.type === 'full' ? '100%' : '80%'};
  display: ${props => props.flex ? 'flex' : 'block'};
  flex-direction: ${props => props.flexDirection ? props.flexDirection : 'row'};
  justify-content: ${props => props.justifyContent};
  align-items: ${props => props.alignItems};
	gap: ${props => props.gap};
	flex-wrap: ${props => props.flexWrap};
	padding: ${props => props.padding};
`;
const Container = ({
  type,
  flex,
  flexDirection,
  alignItems = 'stretch',
  justifyContent = 'flex-start',
  gap = '0px',
  flexWrap = 'no-wrap',
  padding = '8px 0',
  children
}) => createComponent(StyledContainer, {
  alignItems: alignItems,
  justifyContent: justifyContent,
  type: type,
  flex: flex,
  flexDirection: flexDirection,
  gap: gap,
  flexWrap: flexWrap,
  padding: padding,
  children: children
});

var branding = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSI3MjAiIHZpZXdCb3g9IjAgMCAxNDQwIDcyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KCTxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF8zMF82Mzk4KSI+CgkJPHJlY3Qgd2lkdGg9IjE0NDAiIGhlaWdodD0iNzIwIiBmaWxsPSIjMkMyNzM4IiAvPgoJCTxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTQ0MCAzODJMOTkyIDgzMEgxNDQwVjM4MloiIGZpbGw9IiMxNEEzOEIiIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNDQwIC01MFY3MTBMNjgwIC01MEwxNDQwIC01MFoiIGZpbGw9IiNGMkFDNTciIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik05OTQgMjY0TDY4MCAtNTBIOTk0VjI2NFYyNjRaIiBmaWxsPSIjRDZDRjZFIiAvPgoJCTxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNODM2LjUgMTA2LjVMNjgwIC01MEg5OTNMODM2LjUgMTA2LjVaIiBmaWxsPSIjMTRBMzhCIiAvPgoJCTxyZWN0IHg9IjEyMTgiIHk9Ii01MCIgd2lkdGg9IjIyMiIgaGVpZ2h0PSIyMjIiIGZpbGw9IiNENkNGNkUiIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik05OTYgLTUwSDEyMThWMTcyTDk5NiAtNTBaIiBmaWxsPSIjMkMyNzM4IiAvPgoJCTxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTQ0MCAtNTBWNDkxTDExNjkgMjIwLjVMMTQ0MCAtNTBaIiBmaWxsPSIjRjJBQzU3IiAvPgoJCTxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTE3OCAyODhIMTQ0MFY1NDdMMTE3OCAyODhaIiBmaWxsPSIjRDZDRjZFIiAvPgoJCTxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTI1MC41IDM2N0MxMzIyLjAyIDM2NyAxMzgwIDMwOS4wMjEgMTM4MCAyMzcuNUMxMzgwIDE2NS45NzkgMTMyMi4wMiAxMDggMTI1MC41IDEwOEMxMTc4Ljk4IDEwOCAxMTIxIDE2NS45NzkgMTEyMSAyMzcuNUMxMTIxIDMwOS4wMjEgMTE3OC45OCAzNjcgMTI1MC41IDM2N1oiIGZpbGw9IiNENkNGNkUiIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMjUxIDMwN0MxMjg5LjExIDMwNyAxMzIwIDI3Ni4xMDggMTMyMCAyMzhDMTMyMCAxOTkuODkyIDEyODkuMTEgMTY5IDEyNTEgMTY5QzEyMTIuODkgMTY5IDExODIgMTk5Ljg5MiAxMTgyIDIzOEMxMTgyIDI3Ni4xMDggMTIxMi44OSAzMDcgMTI1MSAzMDdaIiBmaWxsPSIjRjJBQzU3IiAvPgoJCTxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTE1NyAzMjcuOTE1TDEzNDAuMzMgMTQ1QzEzNjQuNDUgMTY4LjUyMSAxMzc5LjQzIDIwMS4zNzUgMTM3OS40MyAyMzcuNzI5QzEzNzkuNDMgMzA5LjI0OSAxMzIxLjQ1IDM2Ny4yMjkgMTI0OS45MyAzNjcuMjI5QzEyMTMuNDcgMzY3LjIyOSAxMTgwLjUzIDM1Mi4xNjIgMTE1NyAzMjcuOTE1SDExNTdaIiBmaWxsPSJ3aGl0ZSIgLz4KCQk8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTExMTAgMTA4QzExMzQuODUgMTA4IDExNTUgODcuODUyOCAxMTU1IDYzQzExNTUgMzguMTQ3MiAxMTM0Ljg1IDE4IDExMTAgMThDMTA4NS4xNSAxOCAxMDY1IDM4LjE0NzIgMTA2NSA2M0MxMDY1IDg3Ljg1MjggMTA4NS4xNSAxMDggMTExMCAxMDhaIiBmaWxsPSIjRDZDRjZFIiAvPgoJCTxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTM0MiA2NjdDMTM3NS42OSA2NjcgMTQwMyA2MzkuNjg5IDE0MDMgNjA2QzE0MDMgNTcyLjMxMSAxMzc1LjY5IDU0NSAxMzQyIDU0NUMxMzA4LjMxIDU0NSAxMjgxIDU3Mi4zMTEgMTI4MSA2MDZDMTI4MSA2MzkuNjg5IDEzMDguMzEgNjY3IDEzNDIgNjY3WiIgZmlsbD0id2hpdGUiIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMjk1Ljk3IDU2NS45N0MxMjg2LjY1IDU3Ni42ODMgMTI4MSA1OTAuNjgyIDEyODEgNjA2QzEyODEgNjM5LjY4OSAxMzA4LjMxIDY2NyAxMzQyIDY2N0MxMzU3LjMyIDY2NyAxMzcxLjMyIDY2MS4zNTQgMTM4Mi4wMyA2NTIuMDNMMTI5NS45NyA1NjUuOTdaIiBmaWxsPSIjMkMyNzM4IiAvPgoJCTxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNLTEgMjQwTDE3MiA0MTNMLTEgNTg2TC0xIDI0MFoiIGZpbGw9IiMxNEEzOEIiIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00NDkgLTUwTC0xLjUgNDAwLjVWLTUwSDQ0OVoiIGZpbGw9IiNENkNGNkUiIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00NDkgLTUwTDE1OSAyNDBWLTUwSDQ0OVoiIGZpbGw9IiNGMkFDNTciIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0zMzguNSAxODFDMzg4LjQ4MiAxODEgNDI5IDE0MC40ODIgNDI5IDkwLjVDNDI5IDQwLjUxODIgMzg4LjQ4MiAwIDMzOC41IDBDMjg4LjUxOCAwIDI0OCA0MC41MTgyIDI0OCA5MC41QzI0OCAxNDAuNDgyIDI4OC41MTggMTgxIDMzOC41IDE4MVoiIGZpbGw9IiNGMkFDNTciIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0zMzguNSAxNDFDMzY2LjM5IDE0MSAzODkgMTE4LjM5IDM4OSA5MC41QzM4OSA2Mi42MDk2IDM2Ni4zOSA0MCAzMzguNSA0MEMzMTAuNjEgNDAgMjg4IDYyLjYwOTYgMjg4IDkwLjVDMjg4IDExOC4zOSAzMTAuNjEgMTQxIDMzOC41IDE0MVoiIGZpbGw9IiNENkNGNkUiIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00MDQgMjcuNzAwOEwyNzUuNzAxIDE1NkMyNTguNjIxIDEzOS41MDEgMjQ4IDExNi4zNTggMjQ4IDkwLjczNDhDMjQ4IDQwLjYyMzQgMjg4LjYyMyAwIDMzOC43MzUgMEMzNjQuMzU4IDAgMzg3LjUwMSAxMC42MjExIDQwNCAyNy43MDA4WiIgZmlsbD0id2hpdGUiIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0tMS41IDI1LjVWLTUwSDE1OVYxODZMLTEuNSAyNS41WiIgZmlsbD0id2hpdGUiIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik03OSAxMzdDOTcuNTUzOCAxMzcgMTEzIDEyMS41NTQgMTEzIDEwM0MxMTMgODMuNDQ2MiA5Ny41NTM4IDY4IDc5IDY4QzU5LjQ0NjIgNjggNDQgODMuNDQ2MiA0NCAxMDNDNDQgMTIxLjU1NCA1OS40NDYyIDEzNyA3OSAxMzdaIiBmaWxsPSIjRjJBQzU3IiAvPgoJCTxwYXRoIGQ9Ik0xMDMyLjU1IDU5My40MDhDMTAzMS4yOCA1OTMuNDA4IDEwMzAuMTQgNTkzLjE5MyAxMDI5LjEyIDU5Mi43NjJDMTAyOC4xMiA1OTIuMzMxIDEwMjcuMjYgNTkxLjcwOCAxMDI2LjU0IDU5MC44OTJDMTAyNS44MyA1OTAuMDc2IDEwMjUuMjkgNTg5LjEwMSAxMDI0LjkgNTg3Ljk2OEMxMDI0LjUyIDU4Ni44MTIgMTAyNC4zMyA1ODUuNTIgMTAyNC4zMyA1ODQuMDkyQzEwMjQuMzMgNTgyLjY2NCAxMDI0LjUyIDU4MS4zODMgMTAyNC45IDU4MC4yNUMxMDI1LjI5IDU3OS4xMTcgMTAyNS44MyA1NzguMTUzIDEwMjYuNTQgNTc3LjM2QzEwMjcuMjYgNTc2LjU0NCAxMDI4LjEyIDU3NS45MjEgMTAyOS4xMiA1NzUuNDlDMTAzMC4xNCA1NzUuMDU5IDEwMzEuMjggNTc0Ljg0NCAxMDMyLjU1IDU3NC44NDRDMTAzMy44MiA1NzQuODQ0IDEwMzQuOTcgNTc1LjA1OSAxMDM1Ljk5IDU3NS40OUMxMDM3LjAxIDU3NS45MjEgMTAzNy44NyA1NzYuNTQ0IDEwMzguNTcgNTc3LjM2QzEwMzkuMyA1NzguMTUzIDEwMzkuODUgNTc5LjExNyAxMDQwLjI0IDU4MC4yNUMxMDQwLjYyIDU4MS4zODMgMTA0MC44MiA1ODIuNjY0IDEwNDAuODIgNTg0LjA5MkMxMDQwLjgyIDU4NS41MiAxMDQwLjYyIDU4Ni44MTIgMTA0MC4yNCA1ODcuOTY4QzEwMzkuODUgNTg5LjEwMSAxMDM5LjMgNTkwLjA3NiAxMDM4LjU3IDU5MC44OTJDMTAzNy44NyA1OTEuNzA4IDEwMzcuMDEgNTkyLjMzMSAxMDM1Ljk5IDU5Mi43NjJDMTAzNC45NyA1OTMuMTkzIDEwMzMuODIgNTkzLjQwOCAxMDMyLjU1IDU5My40MDhaTTEwMzIuNTUgNTg5LjkwNkMxMDMzLjcxIDU4OS45MDYgMTAzNC42MiA1ODkuNTU1IDEwMzUuMjcgNTg4Ljg1MkMxMDM1LjkzIDU4OC4xNDkgMTAzNi4yNiA1ODcuMTE4IDEwMzYuMjYgNTg1Ljc1OFY1ODIuNDZDMTAzNi4yNiA1ODEuMTIzIDEwMzUuOTMgNTgwLjEwMyAxMDM1LjI3IDU3OS40QzEwMzQuNjIgNTc4LjY5NyAxMDMzLjcxIDU3OC4zNDYgMTAzMi41NSA1NzguMzQ2QzEwMzEuNDIgNTc4LjM0NiAxMDMwLjUzIDU3OC42OTcgMTAyOS44NyA1NzkuNEMxMDI5LjIxIDU4MC4xMDMgMTAyOC44OCA1ODEuMTIzIDEwMjguODggNTgyLjQ2VjU4NS43NThDMTAyOC44OCA1ODcuMTE4IDEwMjkuMjEgNTg4LjE0OSAxMDI5Ljg3IDU4OC44NTJDMTAzMC41MyA1ODkuNTU1IDEwMzEuNDIgNTg5LjkwNiAxMDMyLjU1IDU4OS45MDZaTTEwNDQuNjcgNTc1LjI1MkgxMDQ5LjAzVjU3OC4xNzZIMTA0OS4xNkMxMDQ5LjQ4IDU3Ny4xNTYgMTA1MC4wOCA1NzYuMzUxIDEwNTAuOTYgNTc1Ljc2MkMxMDUxLjg1IDU3NS4xNSAxMDUyLjg4IDU3NC44NDQgMTA1NC4wNiA1NzQuODQ0QzEwNTYuMzIgNTc0Ljg0NCAxMDU4LjA1IDU3NS42NDkgMTA1OS4yMyA1NzcuMjU4QzEwNjAuNDMgNTc4Ljg0NSAxMDYxLjAzIDU4MS4xMjMgMTA2MS4wMyA1ODQuMDkyQzEwNjEuMDMgNTg3LjA4NCAxMDYwLjQzIDU4OS4zODUgMTA1OS4yMyA1OTAuOTk0QzEwNTguMDUgNTkyLjYwMyAxMDU2LjMyIDU5My40MDggMTA1NC4wNiA1OTMuNDA4QzEwNTIuODggNTkzLjQwOCAxMDUxLjg1IDU5My4xMDIgMTA1MC45NiA1OTIuNDlDMTA1MC4xIDU5MS44NzggMTA0OS41IDU5MS4wNjIgMTA0OS4xNiA1OTAuMDQySDEwNDkuMDNWNTk5LjhIMTA0NC42N1Y1NzUuMjUyWk0xMDUyLjY2IDU4OS44MDRDMTA1My44IDU4OS44MDQgMTA1NC43MiA1ODkuNDMgMTA1NS40MiA1ODguNjgyQzEwNTYuMTIgNTg3LjkzNCAxMDU2LjQ3IDU4Ni45MjUgMTA1Ni40NyA1ODUuNjU2VjU4Mi41OTZDMTA1Ni40NyA1ODEuMzI3IDEwNTYuMTIgNTgwLjMxOCAxMDU1LjQyIDU3OS41N0MxMDU0LjcyIDU3OC43OTkgMTA1My44IDU3OC40MTQgMTA1Mi42NiA1NzguNDE0QzEwNTEuNjIgNTc4LjQxNCAxMDUwLjc1IDU3OC42NzUgMTA1MC4wNSA1NzkuMTk2QzEwNDkuMzcgNTc5LjcxNyAxMDQ5LjAzIDU4MC40MDkgMTA0OS4wMyA1ODEuMjdWNTg2LjkxNEMxMDQ5LjAzIDU4Ny44NDMgMTA0OS4zNyA1ODguNTU3IDEwNTAuMDUgNTg5LjA1NkMxMDUwLjc1IDU4OS41NTUgMTA1MS42MiA1ODkuODA0IDEwNTIuNjYgNTg5LjgwNFpNMTA3Mi4yMyA1OTMuNDA4QzEwNzAuOTIgNTkzLjQwOCAxMDY5Ljc0IDU5My4xOTMgMTA2OC43IDU5Mi43NjJDMTA2Ny42OCA1OTIuMzA5IDEwNjYuODEgNTkxLjY4NSAxMDY2LjA4IDU5MC44OTJDMTA2NS4zOCA1OTAuMDc2IDEwNjQuODMgNTg5LjEwMSAxMDY0LjQ1IDU4Ny45NjhDMTA2NC4wNiA1ODYuODEyIDEwNjMuODcgNTg1LjUyIDEwNjMuODcgNTg0LjA5MkMxMDYzLjg3IDU4Mi42ODcgMTA2NC4wNSA1ODEuNDE3IDEwNjQuNDEgNTgwLjI4NEMxMDY0LjggNTc5LjE1MSAxMDY1LjM0IDU3OC4xODcgMTA2Ni4wNSA1NzcuMzk0QzEwNjYuNzUgNTc2LjU3OCAxMDY3LjYxIDU3NS45NTUgMTA2OC42MyA1NzUuNTI0QzEwNjkuNjUgNTc1LjA3MSAxMDcwLjgxIDU3NC44NDQgMTA3Mi4xIDU3NC44NDRDMTA3My40OCA1NzQuODQ0IDEwNzQuNjggNTc1LjA4MiAxMDc1LjcgNTc1LjU1OEMxMDc2LjcyIDU3Ni4wMzQgMTA3Ny41NiA1NzYuNjggMTA3OC4yMiA1NzcuNDk2QzEwNzguODggNTc4LjMxMiAxMDc5LjM2IDU3OS4yNjQgMTA3OS42OCA1ODAuMzUyQzEwODAuMDIgNTgxLjQxNyAxMDgwLjE5IDU4Mi41NjIgMTA4MC4xOSA1ODMuNzg2VjU4NS4yMTRIMTA2OC4zOVY1ODUuNjU2QzEwNjguMzkgNTg2Ljk0OCAxMDY4Ljc2IDU4Ny45OTEgMTA2OS40OCA1ODguNzg0QzEwNzAuMjEgNTg5LjU1NSAxMDcxLjI4IDU4OS45NCAxMDcyLjcxIDU4OS45NEMxMDczLjggNTg5Ljk0IDEwNzQuNjggNTg5LjcxMyAxMDc1LjM2IDU4OS4yNkMxMDc2LjA3IDU4OC44MDcgMTA3Ni42OSA1ODguMjI5IDEwNzcuMjMgNTg3LjUyNkwxMDc5LjU4IDU5MC4xNDRDMTA3OC44NSA1OTEuMTY0IDEwNzcuODYgNTkxLjk2OSAxMDc2LjU5IDU5Mi41NThDMTA3NS4zNCA1OTMuMTI1IDEwNzMuODkgNTkzLjQwOCAxMDcyLjIzIDU5My40MDhaTTEwNzIuMTcgNTc4LjEwOEMxMDcxLjAxIDU3OC4xMDggMTA3MC4wOSA1NzguNDkzIDEwNjkuNDEgNTc5LjI2NEMxMDY4LjczIDU4MC4wMzUgMTA2OC4zOSA1ODEuMDMyIDEwNjguMzkgNTgyLjI1NlY1ODIuNTI4SDEwNzUuNjdWNTgyLjIyMkMxMDc1LjY3IDU4MC45OTggMTA3NS4zNiA1ODAuMDEyIDEwNzQuNzUgNTc5LjI2NEMxMDc0LjE2IDU3OC40OTMgMTA3My4zIDU3OC4xMDggMTA3Mi4xNyA1NzguMTA4Wk0xMDg0LjAyIDU5M1Y1NzUuMjUySDEwODguMzdWNTc4LjIxSDEwODguNTRDMTA4OC45IDU3Ny4yNTggMTA4OS40NyA1NzYuNDY1IDEwOTAuMjQgNTc1LjgzQzEwOTEuMDQgNTc1LjE3MyAxMDkyLjEyIDU3NC44NDQgMTA5My41MSA1NzQuODQ0QzEwOTUuMzQgNTc0Ljg0NCAxMDk2Ljc1IDU3NS40NDUgMTA5Ny43MiA1NzYuNjQ2QzEwOTguNyA1NzcuODQ3IDEwOTkuMTggNTc5LjU1OSAxMDk5LjE4IDU4MS43OFY1OTNIMTA5NC44M1Y1ODIuMjIyQzEwOTQuODMgNTgwLjk1MyAxMDk0LjYxIDU4MC4wMDEgMTA5NC4xNSA1NzkuMzY2QzEwOTMuNyA1NzguNzMxIDEwOTIuOTUgNTc4LjQxNCAxMDkxLjkxIDU3OC40MTRDMTA5MS40NSA1NzguNDE0IDEwOTEuMDEgNTc4LjQ4MiAxMDkwLjU4IDU3OC42MThDMTA5MC4xNyA1NzguNzMxIDEwODkuOCA1NzguOTEzIDEwODkuNDYgNTc5LjE2MkMxMDg5LjE0IDU3OS4zODkgMTA4OC44OCA1NzkuNjgzIDEwODguNjggNTgwLjA0NkMxMDg4LjQ3IDU4MC4zODYgMTA4OC4zNyA1ODAuNzk0IDEwODguMzcgNTgxLjI3VjU5M0gxMDg0LjAyWk0xMTE3Ljg2IDU5My40MDhDMTExNi4xNiA1OTMuNDA4IDExMTQuNzMgNTkzLjEyNSAxMTEzLjU3IDU5Mi41NThDMTExMi40MiA1OTEuOTY5IDExMTEuNCA1OTEuMTY0IDExMTAuNTEgNTkwLjE0NEwxMTEzLjE3IDU4Ny41NkMxMTEzLjgyIDU4OC4zMDggMTExNC41NCA1ODguODk3IDExMTUuMzEgNTg5LjMyOEMxMTE2LjEgNTg5Ljc1OSAxMTE3LjAxIDU4OS45NzQgMTExOC4wMyA1ODkuOTc0QzExMTkuMDcgNTg5Ljk3NCAxMTE5LjgyIDU4OS43OTMgMTEyMC4yNyA1ODkuNDNDMTEyMC43NSA1ODkuMDY3IDExMjAuOTkgNTg4LjU2OSAxMTIwLjk5IDU4Ny45MzRDMTEyMC45OSA1ODcuNDEzIDExMjAuODIgNTg3LjAwNSAxMTIwLjQ4IDU4Ni43MUMxMTIwLjE2IDU4Ni4zOTMgMTExOS42IDU4Ni4xNzcgMTExOC44MSA1ODYuMDY0TDExMTcuMDQgNTg1LjgyNkMxMTE1LjExIDU4NS41NzcgMTExMy42NCA1ODUuMDMzIDExMTIuNjIgNTg0LjE5NEMxMTExLjYyIDU4My4zMzMgMTExMS4xMyA1ODIuMDg2IDExMTEuMTMgNTgwLjQ1NEMxMTExLjEzIDU3OS41OTMgMTExMS4yOCA1NzguODIyIDExMTEuNiA1NzguMTQyQzExMTEuOTIgNTc3LjQzOSAxMTEyLjM3IDU3Ni44NSAxMTEyLjk2IDU3Ni4zNzRDMTExMy41NSA1NzUuODc1IDExMTQuMjUgNTc1LjUwMSAxMTE1LjA3IDU3NS4yNTJDMTExNS45MSA1NzQuOTggMTExNi44NCA1NzQuODQ0IDExMTcuODYgNTc0Ljg0NEMxMTE4LjcyIDU3NC44NDQgMTExOS40OCA1NzQuOTEyIDExMjAuMTQgNTc1LjA0OEMxMTIwLjgyIDU3NS4xNjEgMTEyMS40MyA1NzUuMzQzIDExMjEuOTcgNTc1LjU5MkMxMTIyLjUyIDU3NS44MTkgMTEyMy4wMSA1NzYuMTEzIDExMjMuNDcgNTc2LjQ3NkMxMTIzLjkyIDU3Ni44MTYgMTEyNC4zNiA1NzcuMjAxIDExMjQuNzkgNTc3LjYzMkwxMTIyLjI0IDU4MC4xODJDMTEyMS43MiA1NzkuNjM4IDExMjEuMSA1NzkuMTg1IDExMjAuMzcgNTc4LjgyMkMxMTE5LjY1IDU3OC40NTkgMTExOC44NSA1NzguMjc4IDExMTcuOTkgNTc4LjI3OEMxMTE3LjA0IDU3OC4yNzggMTExNi4zNSA1NzguNDQ4IDExMTUuOTIgNTc4Ljc4OEMxMTE1LjUxIDU3OS4xMjggMTExNS4zMSA1NzkuNTcgMTExNS4zMSA1ODAuMTE0QzExMTUuMzEgNTgwLjcwMyAxMTE1LjQ4IDU4MS4xNTcgMTExNS44MiA1ODEuNDc0QzExMTYuMTggNTgxLjc2OSAxMTE2Ljc4IDU4MS45ODQgMTExNy42MiA1ODIuMTJMMTExOS40MiA1ODIuMzU4QzExMjMuMjUgNTgyLjkwMiAxMTI1LjE3IDU4NC42NDcgMTEyNS4xNyA1ODcuNTk0QzExMjUuMTcgNTg4LjQ1NSAxMTI0Ljk5IDU4OS4yNDkgMTEyNC42MiA1ODkuOTc0QzExMjQuMjggNTkwLjY3NyAxMTIzLjggNTkxLjI4OSAxMTIzLjE2IDU5MS44MUMxMTIyLjUzIDU5Mi4zMDkgMTEyMS43NiA1OTIuNzA1IDExMjAuODUgNTkzQzExMTkuOTcgNTkzLjI3MiAxMTE4Ljk3IDU5My40MDggMTExNy44NiA1OTMuNDA4Wk0xMTM2LjA1IDU5My40MDhDMTEzNC43OCA1OTMuNDA4IDExMzMuNjMgNTkzLjE5MyAxMTMyLjYxIDU5Mi43NjJDMTEzMS42MiA1OTIuMzMxIDExMzAuNzYgNTkxLjcwOCAxMTMwLjAzIDU5MC44OTJDMTEyOS4zMyA1OTAuMDc2IDExMjguNzggNTg5LjEwMSAxMTI4LjQgNTg3Ljk2OEMxMTI4LjAxIDU4Ni44MTIgMTEyNy44MiA1ODUuNTIgMTEyNy44MiA1ODQuMDkyQzExMjcuODIgNTgyLjY2NCAxMTI4LjAxIDU4MS4zODMgMTEyOC40IDU4MC4yNUMxMTI4Ljc4IDU3OS4xMTcgMTEyOS4zMyA1NzguMTUzIDExMzAuMDMgNTc3LjM2QzExMzAuNzYgNTc2LjU0NCAxMTMxLjYyIDU3NS45MjEgMTEzMi42MSA1NzUuNDlDMTEzMy42MyA1NzUuMDU5IDExMzQuNzggNTc0Ljg0NCAxMTM2LjA1IDU3NC44NDRDMTEzNy4zMiA1NzQuODQ0IDExMzguNDYgNTc1LjA1OSAxMTM5LjQ4IDU3NS40OUMxMTQwLjUgNTc1LjkyMSAxMTQxLjM2IDU3Ni41NDQgMTE0Mi4wNyA1NzcuMzZDMTE0Mi43OSA1NzguMTUzIDExNDMuMzUgNTc5LjExNyAxMTQzLjczIDU4MC4yNUMxMTQ0LjEyIDU4MS4zODMgMTE0NC4zMSA1ODIuNjY0IDExNDQuMzEgNTg0LjA5MkMxMTQ0LjMxIDU4NS41MiAxMTQ0LjEyIDU4Ni44MTIgMTE0My43MyA1ODcuOTY4QzExNDMuMzUgNTg5LjEwMSAxMTQyLjc5IDU5MC4wNzYgMTE0Mi4wNyA1OTAuODkyQzExNDEuMzYgNTkxLjcwOCAxMTQwLjUgNTkyLjMzMSAxMTM5LjQ4IDU5Mi43NjJDMTEzOC40NiA1OTMuMTkzIDExMzcuMzIgNTkzLjQwOCAxMTM2LjA1IDU5My40MDhaTTExMzYuMDUgNTg5LjkwNkMxMTM3LjIgNTg5LjkwNiAxMTM4LjExIDU4OS41NTUgMTEzOC43NyA1ODguODUyQzExMzkuNDMgNTg4LjE0OSAxMTM5Ljc1IDU4Ny4xMTggMTEzOS43NSA1ODUuNzU4VjU4Mi40NkMxMTM5Ljc1IDU4MS4xMjMgMTEzOS40MyA1ODAuMTAzIDExMzguNzcgNTc5LjRDMTEzOC4xMSA1NzguNjk3IDExMzcuMiA1NzguMzQ2IDExMzYuMDUgNTc4LjM0NkMxMTM0LjkxIDU3OC4zNDYgMTEzNC4wMiA1NzguNjk3IDExMzMuMzYgNTc5LjRDMTEzMi43IDU4MC4xMDMgMTEzMi4zOCA1ODEuMTIzIDExMzIuMzggNTgyLjQ2VjU4NS43NThDMTEzMi4zOCA1ODcuMTE4IDExMzIuNyA1ODguMTQ5IDExMzMuMzYgNTg4Ljg1MkMxMTM0LjAyIDU4OS41NTUgMTEzNC45MSA1ODkuOTA2IDExMzYuMDUgNTg5LjkwNlpNMTE1OC43OCA1OTAuMDQySDExNTguNjFDMTE1OC40NSA1OTAuNDk1IDExNTguMjMgNTkwLjkyNiAxMTU3Ljk2IDU5MS4zMzRDMTE1Ny43MSA1OTEuNzE5IDExNTcuMzggNTkyLjA3MSAxMTU2Ljk3IDU5Mi4zODhDMTE1Ni41OSA1OTIuNzA1IDExNTYuMTEgNTkyLjk1NSAxMTU1LjU1IDU5My4xMzZDMTE1NSA1OTMuMzE3IDExNTQuMzcgNTkzLjQwOCAxMTUzLjY0IDU5My40MDhDMTE1MS44MSA1OTMuNDA4IDExNTAuNCA1OTIuODA3IDExNDkuNDMgNTkxLjYwNkMxMTQ4LjQ1IDU5MC40MDUgMTE0Ny45NiA1ODguNjkzIDExNDcuOTYgNTg2LjQ3MlY1NzUuMjUySDExNTIuMzJWNTg2LjAzQzExNTIuMzIgNTg3LjI1NCAxMTUyLjU1IDU4OC4xOTUgMTE1My4wMyA1ODguODUyQzExNTMuNTEgNTg5LjQ4NyAxMTU0LjI3IDU4OS44MDQgMTE1NS4zMSA1ODkuODA0QzExNTUuNzQgNTg5LjgwNCAxMTU2LjE2IDU4OS43NDcgMTE1Ni41NyA1ODkuNjM0QzExNTcgNTg5LjUyMSAxMTU3LjM3IDU4OS4zNTEgMTE1Ny42OSA1ODkuMTI0QzExNTguMDEgNTg4Ljg3NSAxMTU4LjI3IDU4OC41OCAxMTU4LjQ3IDU4OC4yNEMxMTU4LjY3IDU4Ny44NzcgMTE1OC43OCA1ODcuNDU4IDExNTguNzggNTg2Ljk4MlY1NzUuMjUySDExNjMuMTNWNTkzSDExNTguNzhWNTkwLjA0MlpNMTE2OC4xNiA1OTNWNTc1LjI1MkgxMTcyLjUxVjU3OC45MjRIMTE3Mi42OEMxMTcyLjc5IDU3OC40NDggMTE3Mi45NiA1NzcuOTk1IDExNzMuMTkgNTc3LjU2NEMxMTczLjQ0IDU3Ny4xMTEgMTE3My43NiA1NzYuNzE0IDExNzQuMTQgNTc2LjM3NEMxMTc0LjUzIDU3Ni4wMzQgMTE3NC45OCA1NzUuNzYyIDExNzUuNSA1NzUuNTU4QzExNzYuMDQgNTc1LjM1NCAxMTc2LjY3IDU3NS4yNTIgMTE3Ny4zNyA1NzUuMjUySDExNzguMzJWNTc5LjM2NkgxMTc2Ljk2QzExNzUuNDkgNTc5LjM2NiAxMTc0LjM4IDU3OS41ODEgMTE3My42MyA1ODAuMDEyQzExNzIuODggNTgwLjQ0MyAxMTcyLjUxIDU4MS4xNDUgMTE3Mi41MSA1ODIuMTJWNTkzSDExNjguMTZaTTExODguMzQgNTkzLjQwOEMxMTg3LjAzIDU5My40MDggMTE4NS44NiA1OTMuMTkzIDExODQuODQgNTkyLjc2MkMxMTgzLjgyIDU5Mi4zMzEgMTE4Mi45NiA1OTEuNzA4IDExODIuMjYgNTkwLjg5MkMxMTgxLjU4IDU5MC4wNzYgMTE4MS4wNSA1ODkuMTAxIDExODAuNjkgNTg3Ljk2OEMxMTgwLjMzIDU4Ni44MTIgMTE4MC4xNSA1ODUuNTIgMTE4MC4xNSA1ODQuMDkyQzExODAuMTUgNTgyLjY2NCAxMTgwLjMzIDU4MS4zODMgMTE4MC42OSA1ODAuMjVDMTE4MS4wNSA1NzkuMTE3IDExODEuNTggNTc4LjE1MyAxMTgyLjI2IDU3Ny4zNkMxMTgyLjk2IDU3Ni41NDQgMTE4My44MiA1NzUuOTIxIDExODQuODQgNTc1LjQ5QzExODUuODYgNTc1LjA1OSAxMTg3LjAzIDU3NC44NDQgMTE4OC4zNCA1NzQuODQ0QzExOTAuMTMgNTc0Ljg0NCAxMTkxLjYxIDU3NS4yNDEgMTE5Mi43NiA1NzYuMDM0QzExOTMuOTQgNTc2LjgyNyAxMTk0Ljc5IDU3Ny45MjcgMTE5NS4zMSA1NzkuMzMyTDExOTEuNzQgNTgwLjkzQzExOTEuNTQgNTgwLjE4MiAxMTkxLjE1IDU3OS41NyAxMTkwLjU5IDU3OS4wOTRDMTE5MC4wNCA1NzguNTk1IDExODkuMjkgNTc4LjM0NiAxMTg4LjM0IDU3OC4zNDZDMTE4Ny4xMiA1NzguMzQ2IDExODYuMiA1NzguNzMxIDExODUuNTkgNTc5LjUwMkMxMTg1IDU4MC4yNzMgMTE4NC43IDU4MS4yODEgMTE4NC43IDU4Mi41MjhWNTg1Ljc1OEMxMTg0LjcgNTg3LjAwNSAxMTg1IDU4OC4wMTMgMTE4NS41OSA1ODguNzg0QzExODYuMiA1ODkuNTMyIDExODcuMTIgNTg5LjkwNiAxMTg4LjM0IDU4OS45MDZDMTE4OS4zOCA1ODkuOTA2IDExOTAuMTkgNTg5LjY0NSAxMTkwLjc2IDU4OS4xMjRDMTE5MS4zMiA1ODguNTggMTE5MS43NiA1ODcuOTExIDExOTIuMDggNTg3LjExOEwxMTk1LjQxIDU4OC43MTZDMTE5NC44MiA1OTAuMjggMTE5My45MyA1OTEuNDU5IDExOTIuNzMgNTkyLjI1MkMxMTkxLjUzIDU5My4wMjMgMTE5MC4wNiA1OTMuNDA4IDExODguMzQgNTkzLjQwOFpNMTIwNS43OCA1OTMuNDA4QzEyMDQuNDYgNTkzLjQwOCAxMjAzLjI4IDU5My4xOTMgMTIwMi4yNCA1OTIuNzYyQzEyMDEuMjIgNTkyLjMwOSAxMjAwLjM1IDU5MS42ODUgMTE5OS42MiA1OTAuODkyQzExOTguOTIgNTkwLjA3NiAxMTk4LjM4IDU4OS4xMDEgMTE5Ny45OSA1ODcuOTY4QzExOTcuNjEgNTg2LjgxMiAxMTk3LjQxIDU4NS41MiAxMTk3LjQxIDU4NC4wOTJDMTE5Ny40MSA1ODIuNjg3IDExOTcuNiA1ODEuNDE3IDExOTcuOTYgNTgwLjI4NEMxMTk4LjM0IDU3OS4xNTEgMTE5OC44OSA1NzguMTg3IDExOTkuNTkgNTc3LjM5NEMxMjAwLjI5IDU3Ni41NzggMTIwMS4xNSA1NzUuOTU1IDEyMDIuMTcgNTc1LjUyNEMxMjAzLjE5IDU3NS4wNzEgMTIwNC4zNSA1NzQuODQ0IDEyMDUuNjQgNTc0Ljg0NEMxMjA3LjAyIDU3NC44NDQgMTIwOC4yMyA1NzUuMDgyIDEyMDkuMjUgNTc1LjU1OEMxMjEwLjI3IDU3Ni4wMzQgMTIxMS4xIDU3Ni42OCAxMjExLjc2IDU3Ny40OTZDMTIxMi40MiA1NzguMzEyIDEyMTIuOTEgNTc5LjI2NCAxMjEzLjIyIDU4MC4zNTJDMTIxMy41NiA1ODEuNDE3IDEyMTMuNzMgNTgyLjU2MiAxMjEzLjczIDU4My43ODZWNTg1LjIxNEgxMjAxLjk0VjU4NS42NTZDMTIwMS45NCA1ODYuOTQ4IDEyMDIuMyA1ODcuOTkxIDEyMDMuMDIgNTg4Ljc4NEMxMjAzLjc1IDU4OS41NTUgMTIwNC44MyA1ODkuOTQgMTIwNi4yNSA1ODkuOTRDMTIwNy4zNCA1ODkuOTQgMTIwOC4yMyA1ODkuNzEzIDEyMDguOTEgNTg5LjI2QzEyMDkuNjEgNTg4LjgwNyAxMjEwLjIzIDU4OC4yMjkgMTIxMC43OCA1ODcuNTI2TDEyMTMuMTIgNTkwLjE0NEMxMjEyLjQgNTkxLjE2NCAxMjExLjQgNTkxLjk2OSAxMjEwLjEzIDU5Mi41NThDMTIwOC44OCA1OTMuMTI1IDEyMDcuNDMgNTkzLjQwOCAxMjA1Ljc4IDU5My40MDhaTTEyMDUuNzEgNTc4LjEwOEMxMjA0LjU1IDU3OC4xMDggMTIwMy42NCA1NzguNDkzIDEyMDIuOTYgNTc5LjI2NEMxMjAyLjI4IDU4MC4wMzUgMTIwMS45NCA1ODEuMDMyIDEyMDEuOTQgNTgyLjI1NlY1ODIuNTI4SDEyMDkuMjFWNTgyLjIyMkMxMjA5LjIxIDU4MC45OTggMTIwOC45MSA1ODAuMDEyIDEyMDguMjkgNTc5LjI2NEMxMjA3LjcgNTc4LjQ5MyAxMjA2Ljg0IDU3OC4xMDggMTIwNS43MSA1NzguMTA4WiIgZmlsbD0id2hpdGUiIC8+CgkJPHBhdGggZD0iTTYxMC4xNjYgMzIzLjQwOEM2MDguMTI2IDMyMy40MDggNjA2LjM5MiAzMjMuMDQ1IDYwNC45NjQgMzIyLjMyQzYwMy41NTkgMzIxLjU5NSA2MDIuMzQ2IDMyMC42NDMgNjAxLjMyNiAzMTkuNDY0TDYwNC4zNTIgMzE2LjU0QzYwNS4xNjggMzE3LjQ5MiA2MDYuMDc1IDMxOC4yMTcgNjA3LjA3MiAzMTguNzE2QzYwOC4wOTIgMzE5LjIxNSA2MDkuMjE0IDMxOS40NjQgNjEwLjQzOCAzMTkuNDY0QzYxMS44MjEgMzE5LjQ2NCA2MTIuODYzIDMxOS4xNjkgNjEzLjU2NiAzMTguNThDNjE0LjI2OSAzMTcuOTY4IDYxNC42MiAzMTcuMTUyIDYxNC42MiAzMTYuMTMyQzYxNC42MiAzMTUuMzM5IDYxNC4zOTMgMzE0LjY5MyA2MTMuOTQgMzE0LjE5NEM2MTMuNDg3IDMxMy42OTUgNjEyLjYzNyAzMTMuMzMzIDYxMS4zOSAzMTMuMTA2TDYwOS4xNDYgMzEyLjc2NkM2MDQuNDA5IDMxMi4wMTggNjAyLjA0IDMwOS43MTcgNjAyLjA0IDMwNS44NjRDNjAyLjA0IDMwNC43OTkgNjAyLjIzMyAzMDMuODM1IDYwMi42MTggMzAyLjk3NEM2MDMuMDI2IDMwMi4xMTMgNjAzLjYwNCAzMDEuMzc2IDYwNC4zNTIgMzAwLjc2NEM2MDUuMSAzMDAuMTUyIDYwNS45OTUgMjk5LjY4NyA2MDcuMDM4IDI5OS4zN0M2MDguMTAzIDI5OS4wMyA2MDkuMzA1IDI5OC44NiA2MTAuNjQyIDI5OC44NkM2MTIuNDMzIDI5OC44NiA2MTMuOTk3IDI5OS4xNTUgNjE1LjMzNCAyOTkuNzQ0QzYxNi42NzEgMzAwLjMzMyA2MTcuODE2IDMwMS4yMDYgNjE4Ljc2OCAzMDIuMzYyTDYxNS43MDggMzA1LjI1MkM2MTUuMTE5IDMwNC41MjcgNjE0LjQwNSAzMDMuOTM3IDYxMy41NjYgMzAzLjQ4NEM2MTIuNzI3IDMwMy4wMzEgNjExLjY3MyAzMDIuODA0IDYxMC40MDQgMzAyLjgwNEM2MDkuMTEyIDMwMi44MDQgNjA4LjEzNyAzMDMuMDUzIDYwNy40OCAzMDMuNTUyQzYwNi44NDUgMzA0LjAyOCA2MDYuNTI4IDMwNC43MDggNjA2LjUyOCAzMDUuNTkyQzYwNi41MjggMzA2LjQ5OSA2MDYuNzg5IDMwNy4xNjcgNjA3LjMxIDMwNy41OThDNjA3LjgzMSAzMDguMDI5IDYwOC42NyAzMDguMzQ2IDYwOS44MjYgMzA4LjU1TDYxMi4wMzYgMzA4Ljk1OEM2MTQuNDM5IDMwOS4zODkgNjE2LjIwNyAzMTAuMTU5IDYxNy4zNCAzMTEuMjdDNjE4LjQ5NiAzMTIuMzU4IDYxOS4wNzQgMzEzLjg4OCA2MTkuMDc0IDMxNS44NkM2MTkuMDc0IDMxNi45OTMgNjE4Ljg3IDMxOC4wMjUgNjE4LjQ2MiAzMTguOTU0QzYxOC4wNzcgMzE5Ljg2MSA2MTcuNDk5IDMyMC42NTQgNjE2LjcyOCAzMjEuMzM0QzYxNS45OCAzMjEuOTkxIDYxNS4wNTEgMzIyLjUwMSA2MTMuOTQgMzIyLjg2NEM2MTIuODUyIDMyMy4yMjcgNjExLjU5NCAzMjMuNDA4IDYxMC4xNjYgMzIzLjQwOFpNNjQwLjg4OSAzMjMuNDA4QzYzOS4zMjUgMzIzLjQwOCA2MzcuOTA4IDMyMy4xNDcgNjM2LjYzOSAzMjIuNjI2QzYzNS4zNyAzMjIuMTA1IDYzNC4yODIgMzIxLjMyMyA2MzMuMzc1IDMyMC4yOEM2MzIuNDkxIDMxOS4yMzcgNjMxLjggMzE3Ljk1NyA2MzEuMzAxIDMxNi40MzhDNjMwLjgwMiAzMTQuOTE5IDYzMC41NTMgMzEzLjE1MSA2MzAuNTUzIDMxMS4xMzRDNjMwLjU1MyAzMDkuMTM5IDYzMC44MDIgMzA3LjM4MyA2MzEuMzAxIDMwNS44NjRDNjMxLjggMzA0LjMyMyA2MzIuNDkxIDMwMy4wMzEgNjMzLjM3NSAzMDEuOTg4QzYzNC4yODIgMzAwLjk0NSA2MzUuMzcgMzAwLjE2MyA2MzYuNjM5IDI5OS42NDJDNjM3LjkwOCAyOTkuMTIxIDYzOS4zMjUgMjk4Ljg2IDY0MC44ODkgMjk4Ljg2QzY0Mi40NTMgMjk4Ljg2IDY0My44NyAyOTkuMTIxIDY0NS4xMzkgMjk5LjY0MkM2NDYuNDA4IDMwMC4xNjMgNjQ3LjQ5NiAzMDAuOTQ1IDY0OC40MDMgMzAxLjk4OEM2NDkuMzEgMzAzLjAzMSA2NTAuMDAxIDMwNC4zMjMgNjUwLjQ3NyAzMDUuODY0QzY1MC45NzYgMzA3LjM4MyA2NTEuMjI1IDMwOS4xMzkgNjUxLjIyNSAzMTEuMTM0QzY1MS4yMjUgMzEzLjE1MSA2NTAuOTc2IDMxNC45MTkgNjUwLjQ3NyAzMTYuNDM4QzY1MC4wMDEgMzE3Ljk1NyA2NDkuMzEgMzE5LjIzNyA2NDguNDAzIDMyMC4yOEM2NDcuNDk2IDMyMS4zMjMgNjQ2LjQwOCAzMjIuMTA1IDY0NS4xMzkgMzIyLjYyNkM2NDMuODcgMzIzLjE0NyA2NDIuNDUzIDMyMy40MDggNjQwLjg4OSAzMjMuNDA4Wk02NDAuODg5IDMxOS40M0M2NDIuNTg5IDMxOS40MyA2NDMuOTM4IDMxOC44NjMgNjQ0LjkzNSAzMTcuNzNDNjQ1Ljk1NSAzMTYuNTk3IDY0Ni40NjUgMzE1LjAxIDY0Ni40NjUgMzEyLjk3VjMwOS4yOThDNjQ2LjQ2NSAzMDcuMjU4IDY0NS45NTUgMzA1LjY3MSA2NDQuOTM1IDMwNC41MzhDNjQzLjkzOCAzMDMuNDA1IDY0Mi41ODkgMzAyLjgzOCA2NDAuODg5IDMwMi44MzhDNjM5LjE4OSAzMDIuODM4IDYzNy44MjkgMzAzLjQwNSA2MzYuODA5IDMwNC41MzhDNjM1LjgxMiAzMDUuNjcxIDYzNS4zMTMgMzA3LjI1OCA2MzUuMzEzIDMwOS4yOThWMzEyLjk3QzYzNS4zMTMgMzE1LjAxIDYzNS44MTIgMzE2LjU5NyA2MzYuODA5IDMxNy43M0M2MzcuODI5IDMxOC44NjMgNjM5LjE4OSAzMTkuNDMgNjQwLjg4OSAzMTkuNDNaTTY2My43NzggMzIzVjI5OS4yNjhINjY4LjI2NlYzMTkuMDIySDY3Ny42MTZWMzIzSDY2My43NzhaTTY4OC41MjMgMzIzVjMxOS4zOTZINjkxLjY1MVYzMDIuODcySDY4OC41MjNWMjk5LjI2OEg2OTkuMzAxVjMwMi44NzJINjk2LjEzOVYzMTkuMzk2SDY5OS4zMDFWMzIzSDY4OC41MjNaTTcxMS44ODYgMjk5LjI2OEg3MjAuNTIyQzcyMi4wNjMgMjk5LjI2OCA3MjMuNDU3IDI5OS41MTcgNzI0LjcwNCAzMDAuMDE2QzcyNS45NzMgMzAwLjUxNSA3MjcuMDUgMzAxLjI2MyA3MjcuOTM0IDMwMi4yNkM3MjguODQgMzAzLjIzNSA3MjkuNTMyIDMwNC40NyA3MzAuMDA4IDMwNS45NjZDNzMwLjUwNiAzMDcuNDM5IDczMC43NTYgMzA5LjE2MiA3MzAuNzU2IDMxMS4xMzRDNzMwLjc1NiAzMTMuMTA2IDczMC41MDYgMzE0Ljg0IDczMC4wMDggMzE2LjMzNkM3MjkuNTMyIDMxNy44MDkgNzI4Ljg0IDMxOS4wNDUgNzI3LjkzNCAzMjAuMDQyQzcyNy4wNSAzMjEuMDE3IDcyNS45NzMgMzIxLjc1MyA3MjQuNzA0IDMyMi4yNTJDNzIzLjQ1NyAzMjIuNzUxIDcyMi4wNjMgMzIzIDcyMC41MjIgMzIzSDcxMS44ODZWMjk5LjI2OFpNNzIwLjUyMiAzMTkuMDIyQzcyMi4xOTkgMzE5LjAyMiA3MjMuNTI1IDMxOC41MzUgNzI0LjUgMzE3LjU2QzcyNS40OTcgMzE2LjU2MyA3MjUuOTk2IDMxNS4wNDQgNzI1Ljk5NiAzMTMuMDA0VjMwOS4yNjRDNzI1Ljk5NiAzMDcuMjI0IDcyNS40OTcgMzA1LjcxNyA3MjQuNSAzMDQuNzQyQzcyMy41MjUgMzAzLjc0NSA3MjIuMTk5IDMwMy4yNDYgNzIwLjUyMiAzMDMuMjQ2SDcxNi4zNzRWMzE5LjAyMkg3MjAuNTIyWk03NzIuNDUyIDI5OS4yNjhWMzE2LjMzNkM3NzIuNDUyIDMxNy40MDEgNzcyLjI3MSAzMTguMzY1IDc3MS45MDggMzE5LjIyNkM3NzEuNTY4IDMyMC4wODcgNzcxLjA3IDMyMC44MjQgNzcwLjQxMiAzMjEuNDM2Qzc2OS43NzggMzIyLjA0OCA3NjguOTk2IDMyMi41MjQgNzY4LjA2NiAzMjIuODY0Qzc2Ny4xMzcgMzIzLjIwNCA3NjYuMDk0IDMyMy4zNzQgNzY0LjkzOCAzMjMuMzc0Qzc2Mi43NCAzMjMuMzc0IDc2MS4wMjggMzIyLjgwNyA3NTkuODA0IDMyMS42NzRDNzU4LjU4IDMyMC41MTggNzU3Ljc5OCAzMTguOTg4IDc1Ny40NTggMzE3LjA4NEw3NjEuNjA2IDMxNi4yMzRDNzYxLjgxIDMxNy4yNTQgNzYyLjE3MyAzMTguMDQ3IDc2Mi42OTQgMzE4LjYxNEM3NjMuMjM4IDMxOS4xNTggNzYzLjk3NSAzMTkuNDMgNzY0LjkwNCAzMTkuNDNDNzY1Ljc4OCAzMTkuNDMgNzY2LjUxNCAzMTkuMTU4IDc2Ny4wOCAzMTguNjE0Qzc2Ny42NyAzMTguMDQ3IDc2Ny45NjQgMzE3LjE4NiA3NjcuOTY0IDMxNi4wM1YzMDIuOTRINzYwLjQ4NFYyOTkuMjY4SDc3Mi40NTJaTTc5My4yNjggMzIzLjQwOEM3OTEuMjI4IDMyMy40MDggNzg5LjQ5NCAzMjMuMDQ1IDc4OC4wNjYgMzIyLjMyQzc4Ni42NiAzMjEuNTk1IDc4NS40NDggMzIwLjY0MyA3ODQuNDI4IDMxOS40NjRMNzg3LjQ1NCAzMTYuNTRDNzg4LjI3IDMxNy40OTIgNzg5LjE3NiAzMTguMjE3IDc5MC4xNzQgMzE4LjcxNkM3OTEuMTk0IDMxOS4yMTUgNzkyLjMxNiAzMTkuNDY0IDc5My41NCAzMTkuNDY0Qzc5NC45MjIgMzE5LjQ2NCA3OTUuOTY1IDMxOS4xNjkgNzk2LjY2OCAzMTguNThDNzk3LjM3IDMxNy45NjggNzk3LjcyMiAzMTcuMTUyIDc5Ny43MjIgMzE2LjEzMkM3OTcuNzIyIDMxNS4zMzkgNzk3LjQ5NSAzMTQuNjkzIDc5Ny4wNDIgMzE0LjE5NEM3OTYuNTg4IDMxMy42OTUgNzk1LjczOCAzMTMuMzMzIDc5NC40OTIgMzEzLjEwNkw3OTIuMjQ4IDMxMi43NjZDNzg3LjUxIDMxMi4wMTggNzg1LjE0MiAzMDkuNzE3IDc4NS4xNDIgMzA1Ljg2NEM3ODUuMTQyIDMwNC43OTkgNzg1LjMzNCAzMDMuODM1IDc4NS43MiAzMDIuOTc0Qzc4Ni4xMjggMzAyLjExMyA3ODYuNzA2IDMwMS4zNzYgNzg3LjQ1NCAzMDAuNzY0Qzc4OC4yMDIgMzAwLjE1MiA3ODkuMDk3IDI5OS42ODcgNzkwLjE0IDI5OS4zN0M3OTEuMjA1IDI5OS4wMyA3OTIuNDA2IDI5OC44NiA3OTMuNzQ0IDI5OC44NkM3OTUuNTM0IDI5OC44NiA3OTcuMDk4IDI5OS4xNTUgNzk4LjQzNiAyOTkuNzQ0Qzc5OS43NzMgMzAwLjMzMyA4MDAuOTE4IDMwMS4yMDYgODAxLjg3IDMwMi4zNjJMNzk4LjgxIDMwNS4yNTJDNzk4LjIyIDMwNC41MjcgNzk3LjUwNiAzMDMuOTM3IDc5Ni42NjggMzAzLjQ4NEM3OTUuODI5IDMwMy4wMzEgNzk0Ljc3NSAzMDIuODA0IDc5My41MDYgMzAyLjgwNEM3OTIuMjE0IDMwMi44MDQgNzkxLjIzOSAzMDMuMDUzIDc5MC41ODIgMzAzLjU1MkM3ODkuOTQ3IDMwNC4wMjggNzg5LjYzIDMwNC43MDggNzg5LjYzIDMwNS41OTJDNzg5LjYzIDMwNi40OTkgNzg5Ljg5IDMwNy4xNjcgNzkwLjQxMiAzMDcuNTk4Qzc5MC45MzMgMzA4LjAyOSA3OTEuNzcyIDMwOC4zNDYgNzkyLjkyOCAzMDguNTVMNzk1LjEzOCAzMDguOTU4Qzc5Ny41NCAzMDkuMzg5IDc5OS4zMDggMzEwLjE1OSA4MDAuNDQyIDMxMS4yN0M4MDEuNTk4IDMxMi4zNTggODAyLjE3NiAzMTMuODg4IDgwMi4xNzYgMzE1Ljg2QzgwMi4xNzYgMzE2Ljk5MyA4MDEuOTcyIDMxOC4wMjUgODAxLjU2NCAzMTguOTU0QzgwMS4xNzggMzE5Ljg2MSA4MDAuNiAzMjAuNjU0IDc5OS44MyAzMjEuMzM0Qzc5OS4wODIgMzIxLjk5MSA3OTguMTUyIDMyMi41MDEgNzk3LjA0MiAzMjIuODY0Qzc5NS45NTQgMzIzLjIyNyA3OTQuNjk2IDMyMy40MDggNzkzLjI2OCAzMjMuNDA4WiIgZmlsbD0id2hpdGUiIC8+CgkJPHBhdGggZD0iTTEzMi4yNzYgNTgzLjg1NEgxMzYuNTI2TDE0MC45NDYgNTkzSDE0NS45NDRMMTQxLjA4MiA1ODMuMzQ0QzE0NC4wMDYgNTgyLjM1OCAxNDUuNTAyIDU3OS44NzYgMTQ1LjUwMiA1NzYuNjEyQzE0NS41MDIgNTcyLjEyNCAxNDIuODE2IDU2OS4yNjggMTM4LjQ5OCA1NjkuMjY4SDEyNy43ODhWNTkzSDEzMi4yNzZWNTgzLjg1NFpNMTMyLjI3NiA1ODAuMDhWNTczLjE3OEgxMzguMDU2QzEzOS43OSA1NzMuMTc4IDE0MC44NDQgNTc0LjA5NiAxNDAuODQ0IDU3NS44M1Y1NzcuMzk0QzE0MC44NDQgNTc5LjEyOCAxMzkuNzkgNTgwLjA4IDEzOC4wNTYgNTgwLjA4SDEzMi4yNzZaTTE1Ni43NyA1OTMuNDA4QzE2MC4wNjggNTkzLjQwOCAxNjIuNjUyIDU5Mi4xNSAxNjQuMTE0IDU5MC4xNDRMMTYxLjc2OCA1ODcuNTI2QzE2MC42OCA1ODguOTIgMTU5LjM4OCA1ODkuOTQgMTU3LjI0NiA1ODkuOTRDMTU0LjM5IDU4OS45NCAxNTIuOTI4IDU4OC4yMDYgMTUyLjkyOCA1ODUuNjU2VjU4NS4yMTRIMTY0LjcyNlY1ODMuNzg2QzE2NC43MjYgNTc4LjkyNCAxNjIuMTc2IDU3NC44NDQgMTU2LjYzNCA1NzQuODQ0QzE1MS40MzIgNTc0Ljg0NCAxNDguNDA2IDU3OC40ODIgMTQ4LjQwNiA1ODQuMDkyQzE0OC40MDYgNTg5Ljc3IDE1MS41MzQgNTkzLjQwOCAxNTYuNzcgNTkzLjQwOFpNMTU2LjcwMiA1NzguMTA4QzE1OC45NDYgNTc4LjEwOCAxNjAuMjA0IDU3OS43NzQgMTYwLjIwNCA1ODIuMjIyVjU4Mi41MjhIMTUyLjkyOFY1ODIuMjU2QzE1Mi45MjggNTc5LjgwOCAxNTQuNDI0IDU3OC4xMDggMTU2LjcwMiA1NzguMTA4Wk0xNzcuMjMyIDU5M0wxODMuMTgyIDU3NS4yNTJIMTc5LjAzNEwxNzYuNjIgNTgyLjkwMkwxNzQuODg2IDU4OS4yMjZIMTc0LjY0OEwxNzIuOTE0IDU4Mi45MDJMMTcwLjQzMiA1NzUuMjUySDE2Ni4xNDhMMTcyLjA2NCA1OTNIMTc3LjIzMlpNMTkyLjg1OSA1OTMuNDA4QzE5Ny45NTkgNTkzLjQwOCAyMDEuMTIxIDU4OS44MDQgMjAxLjEyMSA1ODQuMDkyQzIwMS4xMjEgNTc4LjQxNCAxOTcuOTU5IDU3NC44NDQgMTkyLjg1OSA1NzQuODQ0QzE4Ny43OTMgNTc0Ljg0NCAxODQuNjMxIDU3OC40MTQgMTg0LjYzMSA1ODQuMDkyQzE4NC42MzEgNTg5LjgwNCAxODcuNzkzIDU5My40MDggMTkyLjg1OSA1OTMuNDA4Wk0xOTIuODU5IDU4OS45MDZDMTkwLjYxNSA1ODkuOTA2IDE4OS4xODcgNTg4LjQ0NCAxODkuMTg3IDU4NS43NThWNTgyLjQ2QzE4OS4xODcgNTc5LjgwOCAxOTAuNjE1IDU3OC4zNDYgMTkyLjg1OSA1NzguMzQ2QzE5NS4xMzcgNTc4LjM0NiAxOTYuNTY1IDU3OS44MDggMTk2LjU2NSA1ODIuNDZWNTg1Ljc1OEMxOTYuNTY1IDU4OC40NDQgMTk1LjEzNyA1ODkuOTA2IDE5Mi44NTkgNTg5LjkwNlpNMjExLjY3NyA1OTNWNTg5LjUzMkgyMDkuMzMxVjU2Ny44NEgyMDQuOTc5VjU4OC43MTZDMjA0Ljk3OSA1OTEuNDM2IDIwNi4zNzMgNTkzIDIwOS4zMzEgNTkzSDIxMS42NzdaTTIyNS41ODEgNTkzSDIyOS45MzNWNTc1LjI1MkgyMjUuNTgxVjU4Ni45ODJDMjI1LjU4MSA1ODguODg2IDIyMy44NDcgNTg5LjgwNCAyMjIuMTEzIDU4OS44MDRDMjIwLjAzOSA1ODkuODA0IDIxOS4xMjEgNTg4LjQ3OCAyMTkuMTIxIDU4Ni4wM1Y1NzUuMjUySDIxNC43NjlWNTg2LjQ3MkMyMTQuNzY5IDU5MC44OTIgMjE2LjgwOSA1OTMuNDA4IDIyMC40NDcgNTkzLjQwOEMyMjMuMzcxIDU5My40MDggMjI0Ljc5OSA1OTEuODEgMjI1LjQxMSA1OTAuMDQySDIyNS41ODFWNTkzWk0yNDAuNTAzIDU5M0gyNDMuNjMxVjU4OS41MzJIMjQwLjI2NVY1NzguNzJIMjQzLjkwM1Y1NzUuMjUySDI0MC4yNjVWNTcwLjM5SDIzNi4zNTVWNTczLjQxNkMyMzYuMzU1IDU3NC42NCAyMzUuOTQ3IDU3NS4yNTIgMjM0LjY1NSA1NzUuMjUySDIzMy4yOTVWNTc4LjcySDIzNS45MTNWNTg4LjQ3OEMyMzUuOTEzIDU5MS4zNjggMjM3LjUxMSA1OTMgMjQwLjUwMyA1OTNaTTI0OS44NTQgNTcyLjY2OEMyNTEuNjIyIDU3Mi42NjggMjUyLjQwNCA1NzEuNzUgMjUyLjQwNCA1NzAuNDkyVjU2OS44MTJDMjUyLjQwNCA1NjguNTU0IDI1MS42MjIgNTY3LjYzNiAyNDkuODU0IDU2Ny42MzZDMjQ4LjA1MiA1NjcuNjM2IDI0Ny4zMDQgNTY4LjU1NCAyNDcuMzA0IDU2OS44MTJWNTcwLjQ5MkMyNDcuMzA0IDU3MS43NSAyNDguMDUyIDU3Mi42NjggMjQ5Ljg1NCA1NzIuNjY4Wk0yNDcuNjc4IDU5M0gyNTIuMDNWNTc1LjI1MkgyNDcuNjc4VjU5M1pNMjY0LjExMyA1OTMuNDA4QzI2OS4yMTMgNTkzLjQwOCAyNzIuMzc1IDU4OS44MDQgMjcyLjM3NSA1ODQuMDkyQzI3Mi4zNzUgNTc4LjQxNCAyNjkuMjEzIDU3NC44NDQgMjY0LjExMyA1NzQuODQ0QzI1OS4wNDcgNTc0Ljg0NCAyNTUuODg1IDU3OC40MTQgMjU1Ljg4NSA1ODQuMDkyQzI1NS44ODUgNTg5LjgwNCAyNTkuMDQ3IDU5My40MDggMjY0LjExMyA1OTMuNDA4Wk0yNjQuMTEzIDU4OS45MDZDMjYxLjg2OSA1ODkuOTA2IDI2MC40NDEgNTg4LjQ0NCAyNjAuNDQxIDU4NS43NThWNTgyLjQ2QzI2MC40NDEgNTc5LjgwOCAyNjEuODY5IDU3OC4zNDYgMjY0LjExMyA1NzguMzQ2QzI2Ni4zOTEgNTc4LjM0NiAyNjcuODE5IDU3OS44MDggMjY3LjgxOSA1ODIuNDZWNTg1Ljc1OEMyNjcuODE5IDU4OC40NDQgMjY2LjM5MSA1ODkuOTA2IDI2NC4xMTMgNTg5LjkwNlpNMjgwLjU4NSA1OTNWNTgxLjI3QzI4MC41ODUgNTc5LjM2NiAyODIuMzE5IDU3OC40MTQgMjg0LjEyMSA1NzguNDE0QzI4Ni4xOTUgNTc4LjQxNCAyODcuMDQ1IDU3OS43MDYgMjg3LjA0NSA1ODIuMjIyVjU5M0gyOTEuMzk3VjU4MS43OEMyOTEuMzk3IDU3Ny4zNiAyODkuMzU3IDU3NC44NDQgMjg1LjcxOSA1NzQuODQ0QzI4Mi45NjUgNTc0Ljg0NCAyODEuNDY5IDU3Ni4zMDYgMjgwLjc1NSA1NzguMjFIMjgwLjU4NVY1NzUuMjUySDI3Ni4yMzNWNTkzSDI4MC41ODVaTTMwMC42MDcgNTkzLjQwOEMzMDMuMjU5IDU5My40MDggMzA1LjE5NyA1OTIuMjE4IDMwNS43NzUgNTg5Ljk0SDMwNS45NzlDMzA2LjI1MSA1OTEuNzc2IDMwNy40MDcgNTkzIDMwOS4yNzcgNTkzSDMxMS42OTFWNTg5LjUzMkgzMDkuOTIzVjU4MS4xNjhDMzA5LjkyMyA1NzcuMTIyIDMwNy4zNzMgNTc0Ljg0NCAzMDIuNTc5IDU3NC44NDRDMjk5LjAwOSA1NzQuODQ0IDI5Ni45MzUgNTc2LjIwNCAyOTUuNjQzIDU3OC4yNDRMMjk4LjIyNyA1ODAuNTU2QzI5OS4wNzcgNTc5LjMzMiAzMDAuMjMzIDU3OC4zMTIgMzAyLjI3MyA1NzguMzEyQzMwNC41ODUgNTc4LjMxMiAzMDUuNTcxIDU3OS40NjggMzA1LjU3MSA1ODEuNDRWNTgyLjczMkgzMDIuNTQ1QzI5Ny43MTcgNTgyLjczMiAyOTQuOTYzIDU4NC41MzQgMjk0Ljk2MyA1ODguMTcyQzI5NC45NjMgNTkxLjMzNCAyOTcuMDAzIDU5My40MDggMzAwLjYwNyA1OTMuNDA4Wk0zMDIuMDY5IDU5MC4yNDZDMzAwLjM2OSA1OTAuMjQ2IDI5OS4zODMgNTg5LjUzMiAyOTkuMzgzIDU4OC4xMDRWNTg3LjUyNkMyOTkuMzgzIDU4Ni4xMzIgMzAwLjUwNSA1ODUuMzUgMzAyLjc4MyA1ODUuMzVIMzA1LjU3MVY1ODcuNjk2QzMwNS41NzEgNTg5LjM2MiAzMDQuMDA3IDU5MC4yNDYgMzAyLjA2OSA1OTAuMjQ2Wk0zMTkuNTY1IDU5M1Y1ODIuMTJDMzE5LjU2NSA1ODAuMTgyIDMyMS4wOTUgNTc5LjM2NiAzMjQuMDE5IDU3OS4zNjZIMzI1LjM3OVY1NzUuMjUySDMyNC40MjdDMzIxLjYwNSA1NzUuMjUyIDMyMC4xNzcgNTc3LjA1NCAzMTkuNzM1IDU3OC45MjRIMzE5LjU2NVY1NzUuMjUySDMxNS4yMTNWNTkzSDMxOS41NjVaTTMzNi42MTMgNTg0LjYzNkwzMzUuMzg5IDU4OS4xMjRIMzM1LjE4NUwzMzQuMDI5IDU4NC42MzZMMzMwLjkzNSA1NzUuMjUySDMyNi42MTdMMzMyLjk3NSA1OTMuODVMMzMyLjE1OSA1OTYuMzMySDMyOC45NjNWNTk5LjhIMzMxLjU4MUMzMzQuNTA1IDU5OS44IDMzNS43NjMgNTk4LjcxMiAzMzYuNjQ3IDU5Ni4xNjJMMzQzLjc4NyA1NzUuMjUySDMzOS43MDdMMzM2LjYxMyA1ODQuNjM2Wk0zNjUuNzA4IDU5M0gzNzAuMDZWNTY3Ljg0SDM2NS43MDhWNTc4LjE3NkgzNjUuNTM4QzM2NC45MjYgNTc2LjEzNiAzNjIuOTg4IDU3NC44NDQgMzYwLjY0MiA1NzQuODQ0QzM1Ni4xODggNTc0Ljg0NCAzNTMuNzA2IDU3OC4xNzYgMzUzLjcwNiA1ODQuMDkyQzM1My43MDYgNTkwLjA0MiAzNTYuMTg4IDU5My40MDggMzYwLjY0MiA1OTMuNDA4QzM2Mi45ODggNTkzLjQwOCAzNjQuODkyIDU5Mi4wNDggMzY1LjUzOCA1OTAuMDQySDM2NS43MDhWNTkzWk0zNjIuMDM2IDU4OS44MDRDMzU5Ljc5MiA1ODkuODA0IDM1OC4yNjIgNTg4LjE3MiAzNTguMjYyIDU4NS42NTZWNTgyLjU5NkMzNTguMjYyIDU4MC4wOCAzNTkuNzkyIDU3OC40MTQgMzYyLjAzNiA1NzguNDE0QzM2NC4xMSA1NzguNDE0IDM2NS43MDggNTc5LjUzNiAzNjUuNzA4IDU4MS4yN1Y1ODYuOTE0QzM2NS43MDggNTg4Ljc1IDM2NC4xMSA1ODkuODA0IDM2Mi4wMzYgNTg5LjgwNFpNMzgyLjI1MyA1OTMuNDA4QzM4NS41NTEgNTkzLjQwOCAzODguMTM1IDU5Mi4xNSAzODkuNTk3IDU5MC4xNDRMMzg3LjI1MSA1ODcuNTI2QzM4Ni4xNjMgNTg4LjkyIDM4NC44NzEgNTg5Ljk0IDM4Mi43MjkgNTg5Ljk0QzM3OS44NzMgNTg5Ljk0IDM3OC40MTEgNTg4LjIwNiAzNzguNDExIDU4NS42NTZWNTg1LjIxNEgzOTAuMjA5VjU4My43ODZDMzkwLjIwOSA1NzguOTI0IDM4Ny42NTkgNTc0Ljg0NCAzODIuMTE3IDU3NC44NDRDMzc2LjkxNSA1NzQuODQ0IDM3My44ODkgNTc4LjQ4MiAzNzMuODg5IDU4NC4wOTJDMzczLjg4OSA1ODkuNzcgMzc3LjAxNyA1OTMuNDA4IDM4Mi4yNTMgNTkzLjQwOFpNMzgyLjE4NSA1NzguMTA4QzM4NC40MjkgNTc4LjEwOCAzODUuNjg3IDU3OS43NzQgMzg1LjY4NyA1ODIuMjIyVjU4Mi41MjhIMzc4LjQxMVY1ODIuMjU2QzM3OC40MTEgNTc5LjgwOCAzNzkuOTA3IDU3OC4xMDggMzgyLjE4NSA1NzguMTA4Wk0zOTkuODUxIDU5My40MDhDNDA0LjI3MSA1OTMuNDA4IDQwNy4xNjEgNTkxLjAyOCA0MDcuMTYxIDU4Ny41OTRDNDA3LjE2MSA1ODQuNjM2IDQwNS4yOTEgNTgyLjkwMiA0MDEuNDE1IDU4Mi4zNThMMzk5LjYxMyA1ODIuMTJDMzk3Ljk0NyA1ODEuODQ4IDM5Ny4zMDEgNTgxLjMwNCAzOTcuMzAxIDU4MC4xMTRDMzk3LjMwMSA1NzkuMDI2IDM5OC4xMTcgNTc4LjI3OCAzOTkuOTg3IDU3OC4yNzhDNDAxLjcyMSA1NzguMjc4IDQwMy4yMTcgNTc5LjA5NCA0MDQuMjM3IDU4MC4xODJMNDA2Ljc4NyA1NzcuNjMyQzQwNS4wODcgNTc1Ljg2NCA0MDMuMzE5IDU3NC44NDQgMzk5Ljg1MSA1NzQuODQ0QzM5NS44MDUgNTc0Ljg0NCAzOTMuMTE5IDU3Ny4wMiAzOTMuMTE5IDU4MC40NTRDMzkzLjExOSA1ODMuNjg0IDM5NS4yMjcgNTg1LjM1IDM5OS4wMzUgNTg1LjgyNkw0MDAuODAzIDU4Ni4wNjRDNDAyLjM2NyA1ODYuMjY4IDQwMi45NzkgNTg2LjkxNCA0MDIuOTc5IDU4Ny45MzRDNDAyLjk3OSA1ODkuMTkyIDQwMi4wOTUgNTg5Ljk3NCA0MDAuMDIxIDU4OS45NzRDMzk4LjAxNSA1ODkuOTc0IDM5Ni40NTEgNTg5LjA1NiAzOTUuMTU5IDU4Ny41NkwzOTIuNTA3IDU5MC4xNDRDMzk0LjI3NSA1OTIuMTg0IDM5Ni40ODUgNTkzLjQwOCAzOTkuODUxIDU5My40MDhaTTQxMy4xOCA1NzIuNjY4QzQxNC45NDggNTcyLjY2OCA0MTUuNzMgNTcxLjc1IDQxNS43MyA1NzAuNDkyVjU2OS44MTJDNDE1LjczIDU2OC41NTQgNDE0Ljk0OCA1NjcuNjM2IDQxMy4xOCA1NjcuNjM2QzQxMS4zNzggNTY3LjYzNiA0MTAuNjMgNTY4LjU1NCA0MTAuNjMgNTY5LjgxMlY1NzAuNDkyQzQxMC42MyA1NzEuNzUgNDExLjM3OCA1NzIuNjY4IDQxMy4xOCA1NzIuNjY4Wk00MTEuMDA0IDU5M0g0MTUuMzU2VjU3NS4yNTJINDExLjAwNFY1OTNaTTQzNi40MTUgNTk0LjQ5NkM0MzYuNDE1IDU5MS4zIDQzNC41NDUgNTg5LjQzIDQzMC4xOTMgNTg5LjQzSDQyNS40MzNDNDIzLjg2OSA1ODkuNDMgNDIzLjEyMSA1ODguOTg4IDQyMy4xMjEgNTg4LjEwNEM0MjMuMTIxIDU4Ny4zMjIgNDIzLjY5OSA1ODYuODEyIDQyNC4zNzkgNTg2LjUwNkM0MjUuMTYxIDU4Ni43MSA0MjYuMDc5IDU4Ni44MTIgNDI3LjA5OSA1ODYuODEyQzQzMS45MjcgNTg2LjgxMiA0MzQuNDQzIDU4NC40MzIgNDM0LjQ0MyA1ODAuODYyQzQzNC40NDMgNTc4LjY4NiA0MzMuNTI1IDU3Ni45NTIgNDMxLjY4OSA1NzUuOTMyVjU3NS40NTZINDM1LjQ2M1Y1NzIuMTI0SDQzMi43MDlDNDMxLjA3NyA1NzIuMTI0IDQzMC4xOTMgNTcyLjk3NCA0MzAuMTkzIDU3NC43MDhWNTc1LjI4NkM0MjkuMzA5IDU3NC45OCA0MjguMTg3IDU3NC44NDQgNDI3LjA5OSA1NzQuODQ0QzQyMi4zMDUgNTc0Ljg0NCA0MTkuNzU1IDU3Ny4yNTggNDE5Ljc1NSA1ODAuODYyQzQxOS43NTUgNTgzLjIwOCA0MjAuODQzIDU4NS4wNDQgNDIyLjk4NSA1ODYuMDNWNTg2LjE2NkM0MjEuMjg1IDU4Ni41NCA0MTkuNzIxIDU4Ny40NTggNDE5LjcyMSA1ODkuMjk0QzQxOS43MjEgNTkwLjcyMiA0MjAuNTM3IDU5MS44NzggNDIxLjk5OSA1OTIuMjUyVjU5Mi42MjZDNDIwLjAyNyA1OTIuOTMyIDQxOC44MzcgNTk0LjA1NCA0MTguODM3IDU5Ni4wMjZDNDE4LjgzNyA1OTguNjQ0IDQyMS4xMTUgNjAwLjIwOCA0MjcuMDk5IDYwMC4yMDhDNDMzLjg5OSA2MDAuMjA4IDQzNi40MTUgNTk4LjIwMiA0MzYuNDE1IDU5NC40OTZaTTQzMi4zMzUgNTk1LjAwNkM0MzIuMzM1IDU5Ni41MDIgNDMxLjA3NyA1OTcuMjE2IDQyOC4yNTUgNTk3LjIxNkg0MjYuMDc5QzQyMy4zNTkgNTk3LjIxNiA0MjIuMzM5IDU5Ni40IDQyMi4zMzkgNTk1LjA0QzQyMi4zMzkgNTk0LjMyNiA0MjIuNjExIDU5My42OCA0MjMuMjU3IDU5My4yMDRINDI5LjMwOUM0MzEuNTE5IDU5My4yMDQgNDMyLjMzNSA1OTMuODg0IDQzMi4zMzUgNTk1LjAwNlpNNDI3LjA5OSA1ODMuODU0QzQyNS4wMjUgNTgzLjg1NCA0MjMuOTAzIDU4Mi45MDIgNDIzLjkwMyA1ODEuMTM0VjU4MC41NTZDNDIzLjkwMyA1NzguNzU0IDQyNS4wMjUgNTc3LjgzNiA0MjcuMDk5IDU3Ny44MzZDNDI5LjE3MyA1NzcuODM2IDQzMC4yOTUgNTc4Ljc1NCA0MzAuMjk1IDU4MC41NTZWNTgxLjEzNEM0MzAuMjk1IDU4Mi45MDIgNDI5LjE3MyA1ODMuODU0IDQyNy4wOTkgNTgzLjg1NFpNNDQzLjI4IDU5M1Y1ODEuMjdDNDQzLjI4IDU3OS4zNjYgNDQ1LjAxNCA1NzguNDE0IDQ0Ni44MTYgNTc4LjQxNEM0NDguODkgNTc4LjQxNCA0NDkuNzQgNTc5LjcwNiA0NDkuNzQgNTgyLjIyMlY1OTNINDU0LjA5MlY1ODEuNzhDNDU0LjA5MiA1NzcuMzYgNDUyLjA1MiA1NzQuODQ0IDQ0OC40MTQgNTc0Ljg0NEM0NDUuNjYgNTc0Ljg0NCA0NDQuMTY0IDU3Ni4zMDYgNDQzLjQ1IDU3OC4yMUg0NDMuMjhWNTc1LjI1Mkg0MzguOTI4VjU5M0g0NDMuMjhaTTQ3Mi43NjYgNTkzLjQwOEM0NzcuMTg2IDU5My40MDggNDgwLjA3NiA1OTEuMDI4IDQ4MC4wNzYgNTg3LjU5NEM0ODAuMDc2IDU4NC42MzYgNDc4LjIwNiA1ODIuOTAyIDQ3NC4zMyA1ODIuMzU4TDQ3Mi41MjggNTgyLjEyQzQ3MC44NjIgNTgxLjg0OCA0NzAuMjE2IDU4MS4zMDQgNDcwLjIxNiA1ODAuMTE0QzQ3MC4yMTYgNTc5LjAyNiA0NzEuMDMyIDU3OC4yNzggNDcyLjkwMiA1NzguMjc4QzQ3NC42MzYgNTc4LjI3OCA0NzYuMTMyIDU3OS4wOTQgNDc3LjE1MiA1ODAuMTgyTDQ3OS43MDIgNTc3LjYzMkM0NzguMDAyIDU3NS44NjQgNDc2LjIzNCA1NzQuODQ0IDQ3Mi43NjYgNTc0Ljg0NEM0NjguNzIgNTc0Ljg0NCA0NjYuMDM0IDU3Ny4wMiA0NjYuMDM0IDU4MC40NTRDNDY2LjAzNCA1ODMuNjg0IDQ2OC4xNDIgNTg1LjM1IDQ3MS45NSA1ODUuODI2TDQ3My43MTggNTg2LjA2NEM0NzUuMjgyIDU4Ni4yNjggNDc1Ljg5NCA1ODYuOTE0IDQ3NS44OTQgNTg3LjkzNEM0NzUuODk0IDU4OS4xOTIgNDc1LjAxIDU4OS45NzQgNDcyLjkzNiA1ODkuOTc0QzQ3MC45MyA1ODkuOTc0IDQ2OS4zNjYgNTg5LjA1NiA0NjguMDc0IDU4Ny41Nkw0NjUuNDIyIDU5MC4xNDRDNDY3LjE5IDU5Mi4xODQgNDY5LjQgNTkzLjQwOCA0NzIuNzY2IDU5My40MDhaTTQ5MS4zMDYgNTg0LjYzNkw0OTAuMDgyIDU4OS4xMjRINDg5Ljg3OEw0ODguNzIyIDU4NC42MzZMNDg1LjYyOCA1NzUuMjUySDQ4MS4zMUw0ODcuNjY4IDU5My44NUw0ODYuODUyIDU5Ni4zMzJINDgzLjY1NlY1OTkuOEg0ODYuMjc0QzQ4OS4xOTggNTk5LjggNDkwLjQ1NiA1OTguNzEyIDQ5MS4zNCA1OTYuMTYyTDQ5OC40OCA1NzUuMjUySDQ5NC40TDQ5MS4zMDYgNTg0LjYzNlpNNTA2Ljg5OCA1OTMuNDA4QzUxMS4zMTggNTkzLjQwOCA1MTQuMjA4IDU5MS4wMjggNTE0LjIwOCA1ODcuNTk0QzUxNC4yMDggNTg0LjYzNiA1MTIuMzM4IDU4Mi45MDIgNTA4LjQ2MiA1ODIuMzU4TDUwNi42NiA1ODIuMTJDNTA0Ljk5NCA1ODEuODQ4IDUwNC4zNDggNTgxLjMwNCA1MDQuMzQ4IDU4MC4xMTRDNTA0LjM0OCA1NzkuMDI2IDUwNS4xNjQgNTc4LjI3OCA1MDcuMDM0IDU3OC4yNzhDNTA4Ljc2OCA1NzguMjc4IDUxMC4yNjQgNTc5LjA5NCA1MTEuMjg0IDU4MC4xODJMNTEzLjgzNCA1NzcuNjMyQzUxMi4xMzQgNTc1Ljg2NCA1MTAuMzY2IDU3NC44NDQgNTA2Ljg5OCA1NzQuODQ0QzUwMi44NTIgNTc0Ljg0NCA1MDAuMTY2IDU3Ny4wMiA1MDAuMTY2IDU4MC40NTRDNTAwLjE2NiA1ODMuNjg0IDUwMi4yNzQgNTg1LjM1IDUwNi4wODIgNTg1LjgyNkw1MDcuODUgNTg2LjA2NEM1MDkuNDE0IDU4Ni4yNjggNTEwLjAyNiA1ODYuOTE0IDUxMC4wMjYgNTg3LjkzNEM1MTAuMDI2IDU4OS4xOTIgNTA5LjE0MiA1ODkuOTc0IDUwNy4wNjggNTg5Ljk3NEM1MDUuMDYyIDU4OS45NzQgNTAzLjQ5OCA1ODkuMDU2IDUwMi4yMDYgNTg3LjU2TDQ5OS41NTQgNTkwLjE0NEM1MDEuMzIyIDU5Mi4xODQgNTAzLjUzMiA1OTMuNDA4IDUwNi44OTggNTkzLjQwOFpNNTIzLjMyOCA1OTNINTI2LjQ1NlY1ODkuNTMySDUyMy4wOVY1NzguNzJINTI2LjcyOFY1NzUuMjUySDUyMy4wOVY1NzAuMzlINTE5LjE4VjU3My40MTZDNTE5LjE4IDU3NC42NCA1MTguNzcyIDU3NS4yNTIgNTE3LjQ4IDU3NS4yNTJINTE2LjEyVjU3OC43Mkg1MTguNzM4VjU4OC40NzhDNTE4LjczOCA1OTEuMzY4IDUyMC4zMzYgNTkzIDUyMy4zMjggNTkzWk01MzcuNTQ0IDU5My40MDhDNTQwLjg0MiA1OTMuNDA4IDU0My40MjYgNTkyLjE1IDU0NC44ODggNTkwLjE0NEw1NDIuNTQyIDU4Ny41MjZDNTQxLjQ1NCA1ODguOTIgNTQwLjE2MiA1ODkuOTQgNTM4LjAyIDU4OS45NEM1MzUuMTY0IDU4OS45NCA1MzMuNzAyIDU4OC4yMDYgNTMzLjcwMiA1ODUuNjU2VjU4NS4yMTRINTQ1LjVWNTgzLjc4NkM1NDUuNSA1NzguOTI0IDU0Mi45NSA1NzQuODQ0IDUzNy40MDggNTc0Ljg0NEM1MzIuMjA2IDU3NC44NDQgNTI5LjE4IDU3OC40ODIgNTI5LjE4IDU4NC4wOTJDNTI5LjE4IDU4OS43NyA1MzIuMzA4IDU5My40MDggNTM3LjU0NCA1OTMuNDA4Wk01MzcuNDc2IDU3OC4xMDhDNTM5LjcyIDU3OC4xMDggNTQwLjk3OCA1NzkuNzc0IDU0MC45NzggNTgyLjIyMlY1ODIuNTI4SDUzMy43MDJWNTgyLjI1NkM1MzMuNzAyIDU3OS44MDggNTM1LjE5OCA1NzguMTA4IDUzNy40NzYgNTc4LjEwOFpNNTUzLjY4MSA1OTNWNTgxLjI3QzU1My42ODEgNTc5LjM2NiA1NTUuMzEyIDU3OC40MTQgNTU2Ljk3OSA1NzguNDE0QzU1OC45MTcgNTc4LjQxNCA1NTkuODM1IDU3OS42NzIgNTU5LjgzNSA1ODIuMjIyVjU5M0g1NjQuMTg3VjU4MS4yN0M1NjQuMTg3IDU3OS4zNjYgNTY1Ljc4NSA1NzguNDE0IDU2Ny40ODUgNTc4LjQxNEM1NjkuNDIzIDU3OC40MTQgNTcwLjM0MSA1NzkuNjcyIDU3MC4zNDEgNTgyLjIyMlY1OTNINTc0LjY5M1Y1ODEuNzhDNTc0LjY5MyA1NzcuMzYgNTcyLjcyMSA1NzQuODQ0IDU2OS4yNTMgNTc0Ljg0NEM1NjYuNDMxIDU3NC44NDQgNTY0LjQ1OSA1NzYuNDQyIDU2My44MTIgNTc4LjQxNEg1NjMuNzQ1QzU2Mi44OTUgNTc2LjAzNCA1NjEuMDI1IDU3NC44NDQgNTU4LjYxMSA1NzQuODQ0QzU1NS45NTkgNTc0Ljg0NCA1NTQuNTMxIDU3Ni4zNCA1NTMuODUxIDU3OC4yMUg1NTMuNjgxVjU3NS4yNTJINTQ5LjMyOVY1OTNINTUzLjY4MVpNNTg3LjU0NSA1OTNINTkxLjg5N1Y1ODcuNTk0TDU5NC4yNDMgNTg1LjA0NEw1OTguNzk5IDU5M0g2MDMuOTY3TDU5Ny4yMDEgNTgyLjEyTDYwMy4zMjEgNTc1LjI1Mkg1OTguMzkxTDU5NC40MTMgNTc5LjgwOEw1OTIuMDY3IDU4My4wMDRINTkxLjg5N1Y1NjcuODRINTg3LjU0NVY1OTNaTTYwOC44MTMgNTcyLjY2OEM2MTAuNTgxIDU3Mi42NjggNjExLjM2MyA1NzEuNzUgNjExLjM2MyA1NzAuNDkyVjU2OS44MTJDNjExLjM2MyA1NjguNTU0IDYxMC41ODEgNTY3LjYzNiA2MDguODEzIDU2Ny42MzZDNjA3LjAxMSA1NjcuNjM2IDYwNi4yNjMgNTY4LjU1NCA2MDYuMjYzIDU2OS44MTJWNTcwLjQ5MkM2MDYuMjYzIDU3MS43NSA2MDcuMDExIDU3Mi42NjggNjA4LjgxMyA1NzIuNjY4Wk02MDYuNjM3IDU5M0g2MTAuOTg5VjU3NS4yNTJINjA2LjYzN1Y1OTNaTTYyMS41NzYgNTkzSDYyNC43MDRWNTg5LjUzMkg2MjEuMzM4VjU3OC43Mkg2MjQuOTc2VjU3NS4yNTJINjIxLjMzOFY1NzAuMzlINjE3LjQyOFY1NzMuNDE2QzYxNy40MjggNTc0LjY0IDYxNy4wMiA1NzUuMjUyIDYxNS43MjggNTc1LjI1Mkg2MTQuMzY4VjU3OC43Mkg2MTYuOTg2VjU4OC40NzhDNjE2Ljk4NiA1OTEuMzY4IDYxOC41ODQgNTkzIDYyMS41NzYgNTkzWk02MzcuNjcgNTkzSDY0Mi4wMjJWNTc4LjY4Nkg2NDUuNjZWNTc1LjI1Mkg2NDIuMDIyVjU3MS4zMDhINjQ1LjY2VjU2Ny44NEg2NDIuNTY2QzYzOS4zNyA1NjcuODQgNjM3LjY3IDU2OS41NzQgNjM3LjY3IDU3Mi43MDJWNTc1LjI1Mkg2MzUuMDUyVjU3OC42ODZINjM3LjY3VjU5M1pNNjU1LjU3NyA1OTMuNDA4QzY2MC42NzcgNTkzLjQwOCA2NjMuODM5IDU4OS44MDQgNjYzLjgzOSA1ODQuMDkyQzY2My44MzkgNTc4LjQxNCA2NjAuNjc3IDU3NC44NDQgNjU1LjU3NyA1NzQuODQ0QzY1MC41MTEgNTc0Ljg0NCA2NDcuMzQ5IDU3OC40MTQgNjQ3LjM0OSA1ODQuMDkyQzY0Ny4zNDkgNTg5LjgwNCA2NTAuNTExIDU5My40MDggNjU1LjU3NyA1OTMuNDA4Wk02NTUuNTc3IDU4OS45MDZDNjUzLjMzMyA1ODkuOTA2IDY1MS45MDUgNTg4LjQ0NCA2NTEuOTA1IDU4NS43NThWNTgyLjQ2QzY1MS45MDUgNTc5LjgwOCA2NTMuMzMzIDU3OC4zNDYgNjU1LjU3NyA1NzguMzQ2QzY1Ny44NTUgNTc4LjM0NiA2NTkuMjgzIDU3OS44MDggNjU5LjI4MyA1ODIuNDZWNTg1Ljc1OEM2NTkuMjgzIDU4OC40NDQgNjU3Ljg1NSA1ODkuOTA2IDY1NS41NzcgNTg5LjkwNlpNNjcyLjA1IDU5M1Y1ODIuMTJDNjcyLjA1IDU4MC4xODIgNjczLjU4IDU3OS4zNjYgNjc2LjUwNCA1NzkuMzY2SDY3Ny44NjRWNTc1LjI1Mkg2NzYuOTEyQzY3NC4wOSA1NzUuMjUyIDY3Mi42NjIgNTc3LjA1NCA2NzIuMjIgNTc4LjkyNEg2NzIuMDVWNTc1LjI1Mkg2NjcuNjk4VjU5M0g2NzIuMDVaTTEyNy41MTYgNjM3SDEzMS44NjhWNjM0LjA0MkgxMzIuMDA0QzEzMi42ODQgNjM2LjA0OCAxMzQuNTU0IDYzNy40MDggMTM2LjkgNjM3LjQwOEMxNDEuMzg4IDYzNy40MDggMTQzLjg3IDYzNC4wNDIgMTQzLjg3IDYyOC4wOTJDMTQzLjg3IDYyMi4xNzYgMTQxLjM4OCA2MTguODQ0IDEzNi45IDYxOC44NDRDMTM0LjU1NCA2MTguODQ0IDEzMi42NSA2MjAuMTM2IDEzMi4wMDQgNjIyLjE3NkgxMzEuODY4VjYxMS44NEgxMjcuNTE2VjYzN1pNMTM1LjUwNiA2MzMuODA0QzEzMy40MzIgNjMzLjgwNCAxMzEuODY4IDYzMi43NSAxMzEuODY4IDYzMC45MTRWNjI1LjI3QzEzMS44NjggNjIzLjUzNiAxMzMuNDMyIDYyMi40MTQgMTM1LjUwNiA2MjIuNDE0QzEzNy43NSA2MjIuNDE0IDEzOS4zMTQgNjI0LjA4IDEzOS4zMTQgNjI2LjU5NlY2MjkuNjU2QzEzOS4zMTQgNjMyLjE3MiAxMzcuNzUgNjMzLjgwNCAxMzUuNTA2IDYzMy44MDRaTTE1OC41MTEgNjM3SDE2Mi44NjNWNjE5LjI1MkgxNTguNTExVjYzMC45ODJDMTU4LjUxMSA2MzIuODg2IDE1Ni43NzcgNjMzLjgwNCAxNTUuMDQzIDYzMy44MDRDMTUyLjk2OSA2MzMuODA0IDE1Mi4wNTEgNjMyLjQ3OCAxNTIuMDUxIDYzMC4wM1Y2MTkuMjUySDE0Ny42OTlWNjMwLjQ3MkMxNDcuNjk5IDYzNC44OTIgMTQ5LjczOSA2MzcuNDA4IDE1My4zNzcgNjM3LjQwOEMxNTYuMzAxIDYzNy40MDggMTU3LjcyOSA2MzUuODEgMTU4LjM0MSA2MzQuMDQySDE1OC41MTFWNjM3Wk0xNzMuNzA1IDYzNy40MDhDMTc4LjEyNSA2MzcuNDA4IDE4MS4wMTUgNjM1LjAyOCAxODEuMDE1IDYzMS41OTRDMTgxLjAxNSA2MjguNjM2IDE3OS4xNDUgNjI2LjkwMiAxNzUuMjY5IDYyNi4zNThMMTczLjQ2NyA2MjYuMTJDMTcxLjgwMSA2MjUuODQ4IDE3MS4xNTUgNjI1LjMwNCAxNzEuMTU1IDYyNC4xMTRDMTcxLjE1NSA2MjMuMDI2IDE3MS45NzEgNjIyLjI3OCAxNzMuODQxIDYyMi4yNzhDMTc1LjU3NSA2MjIuMjc4IDE3Ny4wNzEgNjIzLjA5NCAxNzguMDkxIDYyNC4xODJMMTgwLjY0MSA2MjEuNjMyQzE3OC45NDEgNjE5Ljg2NCAxNzcuMTczIDYxOC44NDQgMTczLjcwNSA2MTguODQ0QzE2OS42NTkgNjE4Ljg0NCAxNjYuOTczIDYyMS4wMiAxNjYuOTczIDYyNC40NTRDMTY2Ljk3MyA2MjcuNjg0IDE2OS4wODEgNjI5LjM1IDE3Mi44ODkgNjI5LjgyNkwxNzQuNjU3IDYzMC4wNjRDMTc2LjIyMSA2MzAuMjY4IDE3Ni44MzMgNjMwLjkxNCAxNzYuODMzIDYzMS45MzRDMTc2LjgzMyA2MzMuMTkyIDE3NS45NDkgNjMzLjk3NCAxNzMuODc1IDYzMy45NzRDMTcxLjg2OSA2MzMuOTc0IDE3MC4zMDUgNjMzLjA1NiAxNjkuMDEzIDYzMS41NkwxNjYuMzYxIDYzNC4xNDRDMTY4LjEyOSA2MzYuMTg0IDE3MC4zMzkgNjM3LjQwOCAxNzMuNzA1IDYzNy40MDhaTTE5Mi4yNDUgNjI4LjYzNkwxOTEuMDIxIDYzMy4xMjRIMTkwLjgxN0wxODkuNjYxIDYyOC42MzZMMTg2LjU2NyA2MTkuMjUySDE4Mi4yNDlMMTg4LjYwNyA2MzcuODVMMTg3Ljc5MSA2NDAuMzMySDE4NC41OTVWNjQzLjhIMTg3LjIxM0MxOTAuMTM3IDY0My44IDE5MS4zOTUgNjQyLjcxMiAxOTIuMjc5IDY0MC4xNjJMMTk5LjQxOSA2MTkuMjUySDE5NS4zMzlMMTkyLjI0NSA2MjguNjM2Wk0yMjEuMzQxIDYzN0gyMjUuNjkzVjYxMS44NEgyMjEuMzQxVjYyMi4xNzZIMjIxLjE3MUMyMjAuNTU5IDYyMC4xMzYgMjE4LjYyMSA2MTguODQ0IDIxNi4yNzUgNjE4Ljg0NEMyMTEuODIxIDYxOC44NDQgMjA5LjMzOSA2MjIuMTc2IDIwOS4zMzkgNjI4LjA5MkMyMDkuMzM5IDYzNC4wNDIgMjExLjgyMSA2MzcuNDA4IDIxNi4yNzUgNjM3LjQwOEMyMTguNjIxIDYzNy40MDggMjIwLjUyNSA2MzYuMDQ4IDIyMS4xNzEgNjM0LjA0MkgyMjEuMzQxVjYzN1pNMjE3LjY2OSA2MzMuODA0QzIxNS40MjUgNjMzLjgwNCAyMTMuODk1IDYzMi4xNzIgMjEzLjg5NSA2MjkuNjU2VjYyNi41OTZDMjEzLjg5NSA2MjQuMDggMjE1LjQyNSA2MjIuNDE0IDIxNy42NjkgNjIyLjQxNEMyMTkuNzQzIDYyMi40MTQgMjIxLjM0MSA2MjMuNTM2IDIyMS4zNDEgNjI1LjI3VjYzMC45MTRDMjIxLjM0MSA2MzIuNzUgMjE5Ljc0MyA2MzMuODA0IDIxNy42NjkgNjMzLjgwNFpNMjM3Ljg4NSA2MzcuNDA4QzI0MS4xODMgNjM3LjQwOCAyNDMuNzY3IDYzNi4xNSAyNDUuMjI5IDYzNC4xNDRMMjQyLjg4MyA2MzEuNTI2QzI0MS43OTUgNjMyLjkyIDI0MC41MDMgNjMzLjk0IDIzOC4zNjEgNjMzLjk0QzIzNS41MDUgNjMzLjk0IDIzNC4wNDMgNjMyLjIwNiAyMzQuMDQzIDYyOS42NTZWNjI5LjIxNEgyNDUuODQxVjYyNy43ODZDMjQ1Ljg0MSA2MjIuOTI0IDI0My4yOTEgNjE4Ljg0NCAyMzcuNzQ5IDYxOC44NDRDMjMyLjU0NyA2MTguODQ0IDIyOS41MjEgNjIyLjQ4MiAyMjkuNTIxIDYyOC4wOTJDMjI5LjUyMSA2MzMuNzcgMjMyLjY0OSA2MzcuNDA4IDIzNy44ODUgNjM3LjQwOFpNMjM3LjgxNyA2MjIuMTA4QzI0MC4wNjEgNjIyLjEwOCAyNDEuMzE5IDYyMy43NzQgMjQxLjMxOSA2MjYuMjIyVjYyNi41MjhIMjM0LjA0M1Y2MjYuMjU2QzIzNC4wNDMgNjIzLjgwOCAyMzUuNTM5IDYyMi4xMDggMjM3LjgxNyA2MjIuMTA4Wk0yNTUuNDg0IDYzNy40MDhDMjU5LjkwNCA2MzcuNDA4IDI2Mi43OTQgNjM1LjAyOCAyNjIuNzk0IDYzMS41OTRDMjYyLjc5NCA2MjguNjM2IDI2MC45MjQgNjI2LjkwMiAyNTcuMDQ4IDYyNi4zNThMMjU1LjI0NiA2MjYuMTJDMjUzLjU4IDYyNS44NDggMjUyLjkzNCA2MjUuMzA0IDI1Mi45MzQgNjI0LjExNEMyNTIuOTM0IDYyMy4wMjYgMjUzLjc1IDYyMi4yNzggMjU1LjYyIDYyMi4yNzhDMjU3LjM1NCA2MjIuMjc4IDI1OC44NSA2MjMuMDk0IDI1OS44NyA2MjQuMTgyTDI2Mi40MiA2MjEuNjMyQzI2MC43MiA2MTkuODY0IDI1OC45NTIgNjE4Ljg0NCAyNTUuNDg0IDYxOC44NDRDMjUxLjQzOCA2MTguODQ0IDI0OC43NTIgNjIxLjAyIDI0OC43NTIgNjI0LjQ1NEMyNDguNzUyIDYyNy42ODQgMjUwLjg2IDYyOS4zNSAyNTQuNjY4IDYyOS44MjZMMjU2LjQzNiA2MzAuMDY0QzI1OCA2MzAuMjY4IDI1OC42MTIgNjMwLjkxNCAyNTguNjEyIDYzMS45MzRDMjU4LjYxMiA2MzMuMTkyIDI1Ny43MjggNjMzLjk3NCAyNTUuNjU0IDYzMy45NzRDMjUzLjY0OCA2MzMuOTc0IDI1Mi4wODQgNjMzLjA1NiAyNTAuNzkyIDYzMS41NkwyNDguMTQgNjM0LjE0NEMyNDkuOTA4IDYzNi4xODQgMjUyLjExOCA2MzcuNDA4IDI1NS40ODQgNjM3LjQwOFpNMjY4LjgxMyA2MTYuNjY4QzI3MC41ODEgNjE2LjY2OCAyNzEuMzYzIDYxNS43NSAyNzEuMzYzIDYxNC40OTJWNjEzLjgxMkMyNzEuMzYzIDYxMi41NTQgMjcwLjU4MSA2MTEuNjM2IDI2OC44MTMgNjExLjYzNkMyNjcuMDExIDYxMS42MzYgMjY2LjI2MyA2MTIuNTU0IDI2Ni4yNjMgNjEzLjgxMlY2MTQuNDkyQzI2Ni4yNjMgNjE1Ljc1IDI2Ny4wMTEgNjE2LjY2OCAyNjguODEzIDYxNi42NjhaTTI2Ni42MzcgNjM3SDI3MC45ODlWNjE5LjI1MkgyNjYuNjM3VjYzN1pNMjkyLjA0OCA2MzguNDk2QzI5Mi4wNDggNjM1LjMgMjkwLjE3OCA2MzMuNDMgMjg1LjgyNiA2MzMuNDNIMjgxLjA2NkMyNzkuNTAyIDYzMy40MyAyNzguNzU0IDYzMi45ODggMjc4Ljc1NCA2MzIuMTA0QzI3OC43NTQgNjMxLjMyMiAyNzkuMzMyIDYzMC44MTIgMjgwLjAxMiA2MzAuNTA2QzI4MC43OTQgNjMwLjcxIDI4MS43MTIgNjMwLjgxMiAyODIuNzMyIDYzMC44MTJDMjg3LjU2IDYzMC44MTIgMjkwLjA3NiA2MjguNDMyIDI5MC4wNzYgNjI0Ljg2MkMyOTAuMDc2IDYyMi42ODYgMjg5LjE1OCA2MjAuOTUyIDI4Ny4zMjIgNjE5LjkzMlY2MTkuNDU2SDI5MS4wOTZWNjE2LjEyNEgyODguMzQyQzI4Ni43MSA2MTYuMTI0IDI4NS44MjYgNjE2Ljk3NCAyODUuODI2IDYxOC43MDhWNjE5LjI4NkMyODQuOTQyIDYxOC45OCAyODMuODIgNjE4Ljg0NCAyODIuNzMyIDYxOC44NDRDMjc3LjkzOCA2MTguODQ0IDI3NS4zODggNjIxLjI1OCAyNzUuMzg4IDYyNC44NjJDMjc1LjM4OCA2MjcuMjA4IDI3Ni40NzYgNjI5LjA0NCAyNzguNjE4IDYzMC4wM1Y2MzAuMTY2QzI3Ni45MTggNjMwLjU0IDI3NS4zNTQgNjMxLjQ1OCAyNzUuMzU0IDYzMy4yOTRDMjc1LjM1NCA2MzQuNzIyIDI3Ni4xNyA2MzUuODc4IDI3Ny42MzIgNjM2LjI1MlY2MzYuNjI2QzI3NS42NiA2MzYuOTMyIDI3NC40NyA2MzguMDU0IDI3NC40NyA2NDAuMDI2QzI3NC40NyA2NDIuNjQ0IDI3Ni43NDggNjQ0LjIwOCAyODIuNzMyIDY0NC4yMDhDMjg5LjUzMiA2NDQuMjA4IDI5Mi4wNDggNjQyLjIwMiAyOTIuMDQ4IDYzOC40OTZaTTI4Ny45NjggNjM5LjAwNkMyODcuOTY4IDY0MC41MDIgMjg2LjcxIDY0MS4yMTYgMjgzLjg4OCA2NDEuMjE2SDI4MS43MTJDMjc4Ljk5MiA2NDEuMjE2IDI3Ny45NzIgNjQwLjQgMjc3Ljk3MiA2MzkuMDRDMjc3Ljk3MiA2MzguMzI2IDI3OC4yNDQgNjM3LjY4IDI3OC44OSA2MzcuMjA0SDI4NC45NDJDMjg3LjE1MiA2MzcuMjA0IDI4Ny45NjggNjM3Ljg4NCAyODcuOTY4IDYzOS4wMDZaTTI4Mi43MzIgNjI3Ljg1NEMyODAuNjU4IDYyNy44NTQgMjc5LjUzNiA2MjYuOTAyIDI3OS41MzYgNjI1LjEzNFY2MjQuNTU2QzI3OS41MzYgNjIyLjc1NCAyODAuNjU4IDYyMS44MzYgMjgyLjczMiA2MjEuODM2QzI4NC44MDYgNjIxLjgzNiAyODUuOTI4IDYyMi43NTQgMjg1LjkyOCA2MjQuNTU2VjYyNS4xMzRDMjg1LjkyOCA2MjYuOTAyIDI4NC44MDYgNjI3Ljg1NCAyODIuNzMyIDYyNy44NTRaTTI5OC45MTMgNjM3VjYyNS4yN0MyOTguOTEzIDYyMy4zNjYgMzAwLjY0NyA2MjIuNDE0IDMwMi40NDkgNjIyLjQxNEMzMDQuNTIzIDYyMi40MTQgMzA1LjM3MyA2MjMuNzA2IDMwNS4zNzMgNjI2LjIyMlY2MzdIMzA5LjcyNVY2MjUuNzhDMzA5LjcyNSA2MjEuMzYgMzA3LjY4NSA2MTguODQ0IDMwNC4wNDcgNjE4Ljg0NEMzMDEuMjkzIDYxOC44NDQgMjk5Ljc5NyA2MjAuMzA2IDI5OS4wODMgNjIyLjIxSDI5OC45MTNWNjE5LjI1MkgyOTQuNTYxVjYzN0gyOTguOTEzWk0zMjEuNzIzIDYzNy40MDhDMzI1LjAyMSA2MzcuNDA4IDMyNy42MDUgNjM2LjE1IDMyOS4wNjcgNjM0LjE0NEwzMjYuNzIxIDYzMS41MjZDMzI1LjYzMyA2MzIuOTIgMzI0LjM0MSA2MzMuOTQgMzIyLjE5OSA2MzMuOTRDMzE5LjM0MyA2MzMuOTQgMzE3Ljg4MSA2MzIuMjA2IDMxNy44ODEgNjI5LjY1NlY2MjkuMjE0SDMyOS42NzlWNjI3Ljc4NkMzMjkuNjc5IDYyMi45MjQgMzI3LjEyOSA2MTguODQ0IDMyMS41ODcgNjE4Ljg0NEMzMTYuMzg1IDYxOC44NDQgMzEzLjM1OSA2MjIuNDgyIDMxMy4zNTkgNjI4LjA5MkMzMTMuMzU5IDYzMy43NyAzMTYuNDg3IDYzNy40MDggMzIxLjcyMyA2MzcuNDA4Wk0zMjEuNjU1IDYyMi4xMDhDMzIzLjg5OSA2MjIuMTA4IDMyNS4xNTcgNjIzLjc3NCAzMjUuMTU3IDYyNi4yMjJWNjI2LjUyOEgzMTcuODgxVjYyNi4yNTZDMzE3Ljg4MSA2MjMuODA4IDMxOS4zNzcgNjIyLjEwOCAzMjEuNjU1IDYyMi4xMDhaTTMzNy44NiA2MzdWNjI2LjEyQzMzNy44NiA2MjQuMTgyIDMzOS4zOSA2MjMuMzY2IDM0Mi4zMTQgNjIzLjM2NkgzNDMuNjc0VjYxOS4yNTJIMzQyLjcyMkMzMzkuOSA2MTkuMjUyIDMzOC40NzIgNjIxLjA1NCAzMzguMDMgNjIyLjkyNEgzMzcuODZWNjE5LjI1MkgzMzMuNTA4VjYzN0gzMzcuODZaTTM1Mi42NyA2MzcuNDA4QzM1Ny4wOSA2MzcuNDA4IDM1OS45OCA2MzUuMDI4IDM1OS45OCA2MzEuNTk0QzM1OS45OCA2MjguNjM2IDM1OC4xMSA2MjYuOTAyIDM1NC4yMzQgNjI2LjM1OEwzNTIuNDMyIDYyNi4xMkMzNTAuNzY2IDYyNS44NDggMzUwLjEyIDYyNS4zMDQgMzUwLjEyIDYyNC4xMTRDMzUwLjEyIDYyMy4wMjYgMzUwLjkzNiA2MjIuMjc4IDM1Mi44MDYgNjIyLjI3OEMzNTQuNTQgNjIyLjI3OCAzNTYuMDM2IDYyMy4wOTQgMzU3LjA1NiA2MjQuMTgyTDM1OS42MDYgNjIxLjYzMkMzNTcuOTA2IDYxOS44NjQgMzU2LjEzOCA2MTguODQ0IDM1Mi42NyA2MTguODQ0QzM0OC42MjQgNjE4Ljg0NCAzNDUuOTM4IDYyMS4wMiAzNDUuOTM4IDYyNC40NTRDMzQ1LjkzOCA2MjcuNjg0IDM0OC4wNDYgNjI5LjM1IDM1MS44NTQgNjI5LjgyNkwzNTMuNjIyIDYzMC4wNjRDMzU1LjE4NiA2MzAuMjY4IDM1NS43OTggNjMwLjkxNCAzNTUuNzk4IDYzMS45MzRDMzU1Ljc5OCA2MzMuMTkyIDM1NC45MTQgNjMzLjk3NCAzNTIuODQgNjMzLjk3NEMzNTAuODM0IDYzMy45NzQgMzQ5LjI3IDYzMy4wNTYgMzQ3Ljk3OCA2MzEuNTZMMzQ1LjMyNiA2MzQuMTQ0QzM0Ny4wOTQgNjM2LjE4NCAzNDkuMzA0IDYzNy40MDggMzUyLjY3IDYzNy40MDhaIiBmaWxsPSJ3aGl0ZSIgLz4KCQk8cGF0aCBvcGFjaXR5PSIwLjU2IiBkPSJNMTMwLjk5MiA1NDEuNDY4SDEzNC40OTJMMTM4LjEzMiA1NDlIMTQyLjI0OEwxMzguMjQ0IDU0MS4wNDhDMTQwLjY1MiA1NDAuMjM2IDE0MS44ODQgNTM4LjE5MiAxNDEuODg0IDUzNS41MDRDMTQxLjg4NCA1MzEuODA4IDEzOS42NzIgNTI5LjQ1NiAxMzYuMTE2IDUyOS40NTZIMTI3LjI5NlY1NDlIMTMwLjk5MlY1NDEuNDY4Wk0xMzAuOTkyIDUzOC4zNlY1MzIuNjc2SDEzNS43NTJDMTM3LjE4IDUzMi42NzYgMTM4LjA0OCA1MzMuNDMyIDEzOC4wNDggNTM0Ljg2VjUzNi4xNDhDMTM4LjA0OCA1MzcuNTc2IDEzNy4xOCA1MzguMzYgMTM1Ljc1MiA1MzguMzZIMTMwLjk5MlpNMTUxLjE2NCA1NDkuMzM2QzE1My44OCA1NDkuMzM2IDE1Ni4wMDggNTQ4LjMgMTU3LjIxMiA1NDYuNjQ4TDE1NS4yOCA1NDQuNDkyQzE1NC4zODQgNTQ1LjY0IDE1My4zMiA1NDYuNDggMTUxLjU1NiA1NDYuNDhDMTQ5LjIwNCA1NDYuNDggMTQ4IDU0NS4wNTIgMTQ4IDU0Mi45NTJWNTQyLjU4OEgxNTcuNzE2VjU0MS40MTJDMTU3LjcxNiA1MzcuNDA4IDE1NS42MTYgNTM0LjA0OCAxNTEuMDUyIDUzNC4wNDhDMTQ2Ljc2OCA1MzQuMDQ4IDE0NC4yNzYgNTM3LjA0NCAxNDQuMjc2IDU0MS42NjRDMTQ0LjI3NiA1NDYuMzQgMTQ2Ljg1MiA1NDkuMzM2IDE1MS4xNjQgNTQ5LjMzNlpNMTUxLjEwOCA1MzYuNzM2QzE1Mi45NTYgNTM2LjczNiAxNTMuOTkyIDUzOC4xMDggMTUzLjk5MiA1NDAuMTI0VjU0MC4zNzZIMTQ4VjU0MC4xNTJDMTQ4IDUzOC4xMzYgMTQ5LjIzMiA1MzYuNzM2IDE1MS4xMDggNTM2LjczNlpNMTY4LjAxNSA1NDlMMTcyLjkxNSA1MzQuMzg0SDE2OS40OTlMMTY3LjUxMSA1NDAuNjg0TDE2Ni4wODMgNTQ1Ljg5MkgxNjUuODg3TDE2NC40NTkgNTQwLjY4NEwxNjIuNDE1IDUzNC4zODRIMTU4Ljg4N0wxNjMuNzU5IDU0OUgxNjguMDE1Wk0xODcuNDAyIDU0OUgxOTEuNzk4TDE4NC40MzQgNTM3LjYwNEwxOTEuMjM4IDUyOS40NTZIMTg2Ljk4MkwxODIuMTM4IDUzNS40MkwxNzkuMzY2IDUzOS4wODhIMTc5LjIyNlY1MjkuNDU2SDE3NS41M1Y1NDlIMTc5LjIyNlY1NDMuMjMyTDE4MS44MyA1NDAuMTUyTDE4Ny40MDIgNTQ5Wk0xOTYuMDc1IDUzMi4yNTZDMTk3LjUzMSA1MzIuMjU2IDE5OC4xNzUgNTMxLjUgMTk4LjE3NSA1MzAuNDY0VjUyOS45MDRDMTk4LjE3NSA1MjguODY4IDE5Ny41MzEgNTI4LjExMiAxOTYuMDc1IDUyOC4xMTJDMTk0LjU5MSA1MjguMTEyIDE5My45NzUgNTI4Ljg2OCAxOTMuOTc1IDUyOS45MDRWNTMwLjQ2NEMxOTMuOTc1IDUzMS41IDE5NC41OTEgNTMyLjI1NiAxOTYuMDc1IDUzMi4yNTZaTTE5NC4yODMgNTQ5SDE5Ny44NjdWNTM0LjM4NEgxOTQuMjgzVjU0OVpNMjA2LjU4NSA1NDlIMjA5LjE2MVY1NDYuMTQ0SDIwNi4zODlWNTM3LjI0SDIwOS4zODVWNTM0LjM4NEgyMDYuMzg5VjUzMC4zOEgyMDMuMTY5VjUzMi44NzJDMjAzLjE2OSA1MzMuODggMjAyLjgzMyA1MzQuMzg0IDIwMS43NjkgNTM0LjM4NEgyMDAuNjQ5VjUzNy4yNEgyMDIuODA1VjU0NS4yNzZDMjAyLjgwNSA1NDcuNjU2IDIwNC4xMjEgNTQ5IDIwNi41ODUgNTQ5Wk0yMzMuMjg4IDU0Mi4yNTJWNTM4LjY5NkgyMjUuMjhWNTQyLjI1MkgyMzMuMjg4Wk0yNTEuMDAzIDU0OUwyNTMuNDk1IDUzOC42NjhMMjU0Ljc1NSA1MzMuNTE2SDI1NC44MTFMMjU2LjAxNSA1MzguNjY4TDI1OC41MDcgNTQ5SDI2Mi42NzlMMjY3LjM1NSA1MjkuNDU2SDI2My44MjdMMjYxLjgzOSA1MzguODM2TDI2MC42MDcgNTQ0LjgyOEgyNjAuNTIzTDI1OS4xNTEgNTM4LjgzNkwyNTYuOTExIDUyOS40NTZIMjUyLjgyM0wyNTAuNTgzIDUzOC44MzZMMjQ5LjE4MyA1NDQuODI4SDI0OS4wOTlMMjQ3Ljg5NSA1MzguODM2TDI0NS45NjMgNTI5LjQ1NkgyNDIuMjY3TDI0Ni44MDMgNTQ5SDI1MS4wMDNaTTI3NS40NjggNTQ5LjMzNkMyNzguMTg0IDU0OS4zMzYgMjgwLjMxMiA1NDguMyAyODEuNTE2IDU0Ni42NDhMMjc5LjU4NCA1NDQuNDkyQzI3OC42ODggNTQ1LjY0IDI3Ny42MjQgNTQ2LjQ4IDI3NS44NiA1NDYuNDhDMjczLjUwOCA1NDYuNDggMjcyLjMwNCA1NDUuMDUyIDI3Mi4zMDQgNTQyLjk1MlY1NDIuNTg4SDI4Mi4wMlY1NDEuNDEyQzI4Mi4wMiA1MzcuNDA4IDI3OS45MiA1MzQuMDQ4IDI3NS4zNTYgNTM0LjA0OEMyNzEuMDcyIDUzNC4wNDggMjY4LjU4IDUzNy4wNDQgMjY4LjU4IDU0MS42NjRDMjY4LjU4IDU0Ni4zNCAyNzEuMTU2IDU0OS4zMzYgMjc1LjQ2OCA1NDkuMzM2Wk0yNzUuNDEyIDUzNi43MzZDMjc3LjI2IDUzNi43MzYgMjc4LjI5NiA1MzguMTA4IDI3OC4yOTYgNTQwLjEyNFY1NDAuMzc2SDI3Mi4zMDRWNTQwLjE1MkMyNzIuMzA0IDUzOC4xMzYgMjczLjUzNiA1MzYuNzM2IDI3NS40MTIgNTM2LjczNlpNMjg1LjE3NCA1NDlIMjg4Ljc1OFY1NDYuNTY0SDI4OC44N0MyODkuNDMgNTQ4LjIxNiAyOTAuOTcgNTQ5LjMzNiAyOTIuOTAyIDU0OS4zMzZDMjk2LjU5OCA1NDkuMzM2IDI5OC42NDIgNTQ2LjU2NCAyOTguNjQyIDU0MS42NjRDMjk4LjY0MiA1MzYuNzkyIDI5Ni41OTggNTM0LjA0OCAyOTIuOTAyIDUzNC4wNDhDMjkwLjk3IDUzNC4wNDggMjg5LjQwMiA1MzUuMTEyIDI4OC44NyA1MzYuNzkySDI4OC43NThWNTI4LjI4SDI4NS4xNzRWNTQ5Wk0yOTEuNzU0IDU0Ni4zNjhDMjkwLjA0NiA1NDYuMzY4IDI4OC43NTggNTQ1LjUgMjg4Ljc1OCA1NDMuOTg4VjUzOS4zNEMyODguNzU4IDUzNy45MTIgMjkwLjA0NiA1MzYuOTg4IDI5MS43NTQgNTM2Ljk4OEMyOTMuNjAyIDUzNi45ODggMjk0Ljg5IDUzOC4zNiAyOTQuODkgNTQwLjQzMlY1NDIuOTUyQzI5NC44OSA1NDUuMDI0IDI5My42MDIgNTQ2LjM2OCAyOTEuNzU0IDU0Ni4zNjhaTTMwMS45NjMgNTQ5SDMwNS41NDdWNTQ0LjU0OEwzMDcuNDc5IDU0Mi40NDhMMzExLjIzMSA1NDlIMzE1LjQ4N0wzMDkuOTE1IDU0MC4wNEwzMTQuOTU1IDUzNC4zODRIMzEwLjg5NUwzMDcuNjE5IDUzOC4xMzZMMzA1LjY4NyA1NDAuNzY4SDMwNS41NDdWNTI4LjI4SDMwMS45NjNWNTQ5Wk0zMjYuMTQ4IDU0OUgzMjkuNzMyVjUzNC4zODRIMzI2LjE0OFY1NDQuMDQ0QzMyNi4xNDggNTQ1LjYxMiAzMjQuNzIgNTQ2LjM2OCAzMjMuMjkyIDU0Ni4zNjhDMzIxLjU4NCA1NDYuMzY4IDMyMC44MjggNTQ1LjI3NiAzMjAuODI4IDU0My4yNlY1MzQuMzg0SDMxNy4yNDRWNTQzLjYyNEMzMTcuMjQ0IDU0Ny4yNjQgMzE4LjkyNCA1NDkuMzM2IDMyMS45MiA1NDkuMzM2QzMyNC4zMjggNTQ5LjMzNiAzMjUuNTA0IDU0OC4wMiAzMjYuMDA4IDU0Ni41NjRIMzI2LjE0OFY1NDlaTTMzOS4zODkgNTQ5VjU0Ni4xNDRIMzM3LjQ1N1Y1MjguMjhIMzMzLjg3M1Y1NDUuNDcyQzMzMy44NzMgNTQ3LjcxMiAzMzUuMDIxIDU0OSAzMzcuNDU3IDU0OUgzMzkuMzg5Wk0zNDQuNDc3IDU0OS4zMDhDMzQ2LjAxNyA1NDkuMzA4IDM0Ni43MTcgNTQ4LjQ0IDM0Ni43MTcgNTQ3LjI2NFY1NDYuNzZDMzQ2LjcxNyA1NDUuNTU2IDM0Ni4wMTcgNTQ0LjY4OCAzNDQuNDc3IDU0NC42ODhDMzQyLjk2NSA1NDQuNjg4IDM0Mi4yMzcgNTQ1LjU1NiAzNDIuMjM3IDU0Ni43NlY1NDcuMjY0QzM0Mi4yMzcgNTQ4LjQ0IDM0Mi45NjUgNTQ5LjMwOCAzNDQuNDc3IDU0OS4zMDhaTTM1MC45NjggNTQ5SDM1OC4wOEMzNjMuMTc2IDU0OSAzNjYuNTA4IDU0NS43MjQgMzY2LjUwOCA1MzkuMjI4QzM2Ni41MDggNTMyLjczMiAzNjMuMTc2IDUyOS40NTYgMzU4LjA4IDUyOS40NTZIMzUwLjk2OFY1NDlaTTM1NC42NjQgNTQ1LjcyNFY1MzIuNzMySDM1OC4wOEMzNjAuODI0IDUzMi43MzIgMzYyLjU4OCA1MzQuMzU2IDM2Mi41ODggNTM3LjY4OFY1NDAuNzY4QzM2Mi41ODggNTQ0LjEgMzYwLjgyNCA1NDUuNzI0IDM1OC4wOCA1NDUuNzI0SDM1NC42NjRaTTM3NS45NTcgNTQ5LjMzNkMzNzguNjczIDU0OS4zMzYgMzgwLjgwMSA1NDguMyAzODIuMDA1IDU0Ni42NDhMMzgwLjA3MyA1NDQuNDkyQzM3OS4xNzcgNTQ1LjY0IDM3OC4xMTMgNTQ2LjQ4IDM3Ni4zNDkgNTQ2LjQ4QzM3My45OTcgNTQ2LjQ4IDM3Mi43OTMgNTQ1LjA1MiAzNzIuNzkzIDU0Mi45NTJWNTQyLjU4OEgzODIuNTA5VjU0MS40MTJDMzgyLjUwOSA1MzcuNDA4IDM4MC40MDkgNTM0LjA0OCAzNzUuODQ1IDUzNC4wNDhDMzcxLjU2MSA1MzQuMDQ4IDM2OS4wNjkgNTM3LjA0NCAzNjkuMDY5IDU0MS42NjRDMzY5LjA2OSA1NDYuMzQgMzcxLjY0NSA1NDkuMzM2IDM3NS45NTcgNTQ5LjMzNlpNMzc1LjkwMSA1MzYuNzM2QzM3Ny43NDkgNTM2LjczNiAzNzguNzg1IDUzOC4xMDggMzc4Ljc4NSA1NDAuMTI0VjU0MC4zNzZIMzcyLjc5M1Y1NDAuMTUyQzM3Mi43OTMgNTM4LjEzNiAzNzQuMDI1IDUzNi43MzYgMzc1LjkwMSA1MzYuNzM2Wk0zOTAuNDUgNTQ5LjMzNkMzOTQuMDkgNTQ5LjMzNiAzOTYuNDcgNTQ3LjM3NiAzOTYuNDcgNTQ0LjU0OEMzOTYuNDcgNTQyLjExMiAzOTQuOTMgNTQwLjY4NCAzOTEuNzM4IDU0MC4yMzZMMzkwLjI1NCA1NDAuMDRDMzg4Ljg4MiA1MzkuODE2IDM4OC4zNSA1MzkuMzY4IDM4OC4zNSA1MzguMzg4QzM4OC4zNSA1MzcuNDkyIDM4OS4wMjIgNTM2Ljg3NiAzOTAuNTYyIDUzNi44NzZDMzkxLjk5IDUzNi44NzYgMzkzLjIyMiA1MzcuNTQ4IDM5NC4wNjIgNTM4LjQ0NEwzOTYuMTYyIDUzNi4zNDRDMzk0Ljc2MiA1MzQuODg4IDM5My4zMDYgNTM0LjA0OCAzOTAuNDUgNTM0LjA0OEMzODcuMTE4IDUzNC4wNDggMzg0LjkwNiA1MzUuODQgMzg0LjkwNiA1MzguNjY4QzM4NC45MDYgNTQxLjMyOCAzODYuNjQyIDU0Mi43IDM4OS43NzggNTQzLjA5MkwzOTEuMjM0IDU0My4yODhDMzkyLjUyMiA1NDMuNDU2IDM5My4wMjYgNTQzLjk4OCAzOTMuMDI2IDU0NC44MjhDMzkzLjAyNiA1NDUuODY0IDM5Mi4yOTggNTQ2LjUwOCAzOTAuNTkgNTQ2LjUwOEMzODguOTM4IDU0Ni41MDggMzg3LjY1IDU0NS43NTIgMzg2LjU4NiA1NDQuNTJMMzg0LjQwMiA1NDYuNjQ4QzM4NS44NTggNTQ4LjMyOCAzODcuNjc4IDU0OS4zMzYgMzkwLjQ1IDU0OS4zMzZaTTQwMS40MjcgNTMyLjI1NkM0MDIuODgzIDUzMi4yNTYgNDAzLjUyNyA1MzEuNSA0MDMuNTI3IDUzMC40NjRWNTI5LjkwNEM0MDMuNTI3IDUyOC44NjggNDAyLjg4MyA1MjguMTEyIDQwMS40MjcgNTI4LjExMkMzOTkuOTQzIDUyOC4xMTIgMzk5LjMyNyA1MjguODY4IDM5OS4zMjcgNTI5LjkwNFY1MzAuNDY0QzM5OS4zMjcgNTMxLjUgMzk5Ljk0MyA1MzIuMjU2IDQwMS40MjcgNTMyLjI1NlpNMzk5LjYzNSA1NDlINDAzLjIxOVY1MzQuMzg0SDM5OS42MzVWNTQ5Wk00MjAuNTYxIDU1MC4yMzJDNDIwLjU2MSA1NDcuNiA0MTkuMDIxIDU0Ni4wNiA0MTUuNDM3IDU0Ni4wNkg0MTEuNTE3QzQxMC4yMjkgNTQ2LjA2IDQwOS42MTMgNTQ1LjY5NiA0MDkuNjEzIDU0NC45NjhDNDA5LjYxMyA1NDQuMzI0IDQxMC4wODkgNTQzLjkwNCA0MTAuNjQ5IDU0My42NTJDNDExLjI5MyA1NDMuODIgNDEyLjA0OSA1NDMuOTA0IDQxMi44ODkgNTQzLjkwNEM0MTYuODY1IDU0My45MDQgNDE4LjkzNyA1NDEuOTQ0IDQxOC45MzcgNTM5LjAwNEM0MTguOTM3IDUzNy4yMTIgNDE4LjE4MSA1MzUuNzg0IDQxNi42NjkgNTM0Ljk0NFY1MzQuNTUySDQxOS43NzdWNTMxLjgwOEg0MTcuNTA5QzQxNi4xNjUgNTMxLjgwOCA0MTUuNDM3IDUzMi41MDggNDE1LjQzNyA1MzMuOTM2VjUzNC40MTJDNDE0LjcwOSA1MzQuMTYgNDEzLjc4NSA1MzQuMDQ4IDQxMi44ODkgNTM0LjA0OEM0MDguOTQxIDUzNC4wNDggNDA2Ljg0MSA1MzYuMDM2IDQwNi44NDEgNTM5LjAwNEM0MDYuODQxIDU0MC45MzYgNDA3LjczNyA1NDIuNDQ4IDQwOS41MDEgNTQzLjI2VjU0My4zNzJDNDA4LjEwMSA1NDMuNjggNDA2LjgxMyA1NDQuNDM2IDQwNi44MTMgNTQ1Ljk0OEM0MDYuODEzIDU0Ny4xMjQgNDA3LjQ4NSA1NDguMDc2IDQwOC42ODkgNTQ4LjM4NFY1NDguNjkyQzQwNy4wNjUgNTQ4Ljk0NCA0MDYuMDg1IDU0OS44NjggNDA2LjA4NSA1NTEuNDkyQzQwNi4wODUgNTUzLjY0OCA0MDcuOTYxIDU1NC45MzYgNDEyLjg4OSA1NTQuOTM2QzQxOC40ODkgNTU0LjkzNiA0MjAuNTYxIDU1My4yODQgNDIwLjU2MSA1NTAuMjMyWk00MTcuMjAxIDU1MC42NTJDNDE3LjIwMSA1NTEuODg0IDQxNi4xNjUgNTUyLjQ3MiA0MTMuODQxIDU1Mi40NzJINDEyLjA0OUM0MDkuODA5IDU1Mi40NzIgNDA4Ljk2OSA1NTEuOCA0MDguOTY5IDU1MC42OEM0MDguOTY5IDU1MC4wOTIgNDA5LjE5MyA1NDkuNTYgNDA5LjcyNSA1NDkuMTY4SDQxNC43MDlDNDE2LjUyOSA1NDkuMTY4IDQxNy4yMDEgNTQ5LjcyOCA0MTcuMjAxIDU1MC42NTJaTTQxMi44ODkgNTQxLjQ2OEM0MTEuMTgxIDU0MS40NjggNDEwLjI1NyA1NDAuNjg0IDQxMC4yNTcgNTM5LjIyOFY1MzguNzUyQzQxMC4yNTcgNTM3LjI2OCA0MTEuMTgxIDUzNi41MTIgNDEyLjg4OSA1MzYuNTEyQzQxNC41OTcgNTM2LjUxMiA0MTUuNTIxIDUzNy4yNjggNDE1LjUyMSA1MzguNzUyVjUzOS4yMjhDNDE1LjUyMSA1NDAuNjg0IDQxNC41OTcgNTQxLjQ2OCA0MTIuODg5IDU0MS40NjhaTTQyNi4yMTUgNTQ5VjUzOS4zNEM0MjYuMjE1IDUzNy43NzIgNDI3LjY0MyA1MzYuOTg4IDQyOS4xMjcgNTM2Ljk4OEM0MzAuODM1IDUzNi45ODggNDMxLjUzNSA1MzguMDUyIDQzMS41MzUgNTQwLjEyNFY1NDlINDM1LjExOVY1MzkuNzZDNDM1LjExOSA1MzYuMTIgNDMzLjQzOSA1MzQuMDQ4IDQzMC40NDMgNTM0LjA0OEM0MjguMTc1IDUzNC4wNDggNDI2Ljk0MyA1MzUuMjUyIDQyNi4zNTUgNTM2LjgySDQyNi4yMTVWNTM0LjM4NEg0MjIuNjMxVjU0OUg0MjYuMjE1WiIgZmlsbD0id2hpdGUiIC8+CgkJPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00NzAgMzY5LjY4M1YzMzkuODQxSDUwNy45ODdDNDk2LjQyNiAzNzEuODU4IDQ5My44NSAzOTUuMDcgNTAxLjQ2NSA0MTAuOTI5TDUwMS44MTUgNDExLjYxMkM1MTIuOTY3IDQzMi4wNjUgNTMzLjg3IDQzNS4wMzUgNTU3LjEwMiA0MjIuNjE0QzU2NC4zOTkgNDE4LjcxMyA1NjcuMTM0IDQwOS42NjYgNTYzLjIxMiA0MDIuNDA4QzU1OS4yOSAzOTUuMTQ5IDU1MC4xOTUgMzkyLjQyOCA1NDIuODk4IDM5Ni4zMjlDNTMzLjEwMSA0MDEuNTY3IDUzMC41MiA0MDEuNDAxIDUyOC4zODQgMzk3LjczNkM1MjQuNDg0IDM4OC44MTQgNTI4Ljk1IDM2NS42NjYgNTQzLjgxMyAzMzAuNzM3QzU0OCAzMjAuODk5IDU0MC43NCAzMTAgNTMwIDMxMEg0NTVDNDQ2LjcxNiAzMTAgNDQwIDMxNi42OCA0NDAgMzI0LjkyMVYzNjkuNjgzQzQ0MCAzNzcuOTIzIDQ0Ni43MTYgMzg0LjYwNCA0NTUgMzg0LjYwNEM0NjMuMjg0IDM4NC42MDQgNDcwIDM3Ny45MjMgNDcwIDM2OS42ODNaTTQ3NSA0MTVDNDc1IDQyNi4wNDYgNDY2LjA0NiA0MzUgNDU1IDQzNUM0NDMuOTU0IDQzNSA0MzUgNDI2LjA0NiA0MzUgNDE1QzQzNSA0MDMuOTU0IDQ0My45NTQgMzk1IDQ1NSAzOTVDNDY2LjA0NiAzOTUgNDc1IDQwMy45NTQgNDc1IDQxNVoiIGZpbGw9IndoaXRlIiAvPgoJCTxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNjIyLjA3NyA0MTguMTg3SDYwMFYzMzguODVINjIyLjA3N1YzNTYuMDc4SDYyMi44MjJDNjI0LjYxMiAzNDcuMzEzIDYzMC41NzkgMzM4Ljg1IDY0Mi44MTEgMzM4Ljg1SDY0Ni42ODlWMzU5LjcwNEg2NDEuMTdDNjI4LjM0MiAzNTkuNzA0IDYyMi4wNzcgMzYyLjU3NiA2MjIuMDc3IDM3MS43OTRWNDE4LjE4N1pNNjg5LjExMyA0MjBDNjY1LjA5OCA0MjAgNjUxLjUyMyA0MDMuODMgNjUxLjUyMyAzNzguNDQzQzY1MS41MjMgMzUzLjM1NyA2NjQuNjUgMzM3LjAzNyA2ODguMjE4IDMzNy4wMzdDNzE0LjE3MyAzMzcuMDM3IDcyNC42MTUgMzU2LjA3OCA3MjQuNjE1IDM3Ny41MzZWMzg0LjE4NUg2NzQuMzQ2VjM4NS4zOTRDNjc0LjM0NiAzOTUuODIxIDY3OS44NjUgNDAyLjQ3IDY5MS42NDkgNDAyLjQ3QzcwMC44OTcgNDAyLjQ3IDcwNS45NjkgMzk4LjA4OCA3MTAuODkxIDM5Mi45NUw3MjEuOTMgNDA2Ljg1M0M3MTQuOTE5IDQxNS4wMTMgNzAzLjQzMyA0MjAgNjg5LjExMyA0MjBaTTY4OC42NjYgMzUzLjUwOUM2NzkuODY1IDM1My41MDkgNjc0LjM0NiAzNjAuMDA3IDY3NC4zNDYgMzY5LjgyOVYzNzEuMDM4SDcwMS43OTJWMzY5LjY3OEM3MDEuNzkyIDM2MC4wMDcgNjk3LjQ2NiAzNTMuNTA5IDY4OC42NjYgMzUzLjUwOVpNNzc4LjY3MyA0MTguMTg3SDc1Mi40Mkw3MjYuNzYzIDMzOC44NUg3NDguNTQxTDc1OC4yMzcgMzcwLjg4N0w3NjUuNTQ2IDM5OS41OTlINzY2Ljc0TDc3NC4wNDkgMzcwLjg4N0w3ODMuNDQ2IDMzOC44NUg4MDQuMzI5TDc3OC42NzMgNDE4LjE4N1pNODc3LjkzIDQxOC4xODdMODUwLjMzNCAzNzIuMjQ3TDgzNi43NiAzODguODdWNDE4LjE4N0g4MTQuMDg3VjMxMi43MDdIODM2Ljc2VjM2Mi44NzhIODM3LjY1NUw4NTIuNDIzIDM0Mi40NzdMODc1Ljg0MiAzMTIuNzA3SDkwMS40OThMODY2LjQ0NCAzNTYuMDc4TDkwNC42MzEgNDE4LjE4N0g4NzcuOTNaTTkyNC42ODMgMzMwLjM4OEM5MTUuNzMzIDMzMC4zODggOTExLjg1NSAzMjUuNzAzIDkxMS44NTUgMzE5LjM1NlYzMTYuMDMyQzkxMS44NTUgMzA5LjY4NSA5MTUuNzMzIDMwNSA5MjQuNjgzIDMwNUM5MzMuNjMzIDMwNSA5MzcuNTEyIDMwOS42ODUgOTM3LjUxMiAzMTYuMDMyVjMxOS4zNTZDOTM3LjUxMiAzMjUuNzAzIDkzMy42MzMgMzMwLjM4OCA5MjQuNjgzIDMzMC4zODhaTTkxMy42NDMgNDE4LjE4N1YzMzguODVIOTM1LjcxOVY0MTguMTg3SDkxMy42NDNaTTk5My44MDcgNDE4LjE4N0g5ODAuNjhDOTY1LjQ2NSA0MTguMTg3IDk1Ny40MSA0MTAuMTc3IDk1Ny40MSAzOTUuMDY2VjM1Ni4yMjlIOTQ2LjM3MlYzMzguODVIOTUxLjg5MUM5NTcuODU4IDMzOC44NSA5NTkuNjQ4IDMzNS44MjggOTU5LjY0OCAzMzAuMzg4VjMxNy4zOTJIOTc5LjQ4N1YzMzguODVIOTk1VjM1Ni4yMjlIOTc5LjQ4N1Y0MDAuODA4SDk5My44MDdWNDE4LjE4N1oiIGZpbGw9IndoaXRlIiAvPgoJPC9nPgoJPGRlZnM+CgkJPGNsaXBQYXRoIGlkPSJjbGlwMF8zMF82Mzk4Ij4KCQkJPHJlY3Qgd2lkdGg9IjE0NDAiIGhlaWdodD0iNzIwIiBmaWxsPSJ3aGl0ZSIgLz4KCQk8L2NsaXBQYXRoPgoJPC9kZWZzPgo8L3N2Zz4KCQ==";

const theme$1 = {
  colors: {
    accent: '#0880AE',
    warning: '#F2AC57',
    success: '#14A38B',
    error: '#FF7171',
    primary: '#2C2738',
    secondary: '#756F86',
    muted: '#7C9CBF',
    bright: '#FFFFFF',
    shade: '#DBE2EA',
    tint: '#EBF4F8'
  }
};
const StyledLegend = styled('div')`
	margin-left: auto;
  margin-right: auto;
  width: 80%;
  height: 50px;
  border-bottom: 1px solid ${theme$1.colors.shade};
  margin-top: 20px;
`;

const getRank = rank => rank < 10 ? `0${rank}` : `${rank}`;

const Legend = ({
  title,
  rank
}) => createComponent(StyledLegend, {
  get children() {
    return createComponent(Heading, {
      size: 5,
      weight: 'bold',
      type: 'primary',

      get children() {
        return [memo$1(() => getRank(rank)), ". ", title];
      }

    });
  }

});

const ButtonTypeContainer = styled('div')`
	display: flex;
	gap: 8px;
`;
const ButtonsSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  gap: '16px',
  flexWrap: 'wrap',
  flexDirection: 'column',
  justifyContent: 'flex-start',

  get children() {
    return [createComponent(ButtonTypeContainer, {
      get children() {
        return [createComponent(Button, {
          children: "Accent button"
        }), createComponent(Button, {
          variant: 'ghost',
          children: "Ghost button"
        }), createComponent(Button, {
          variant: 'bright',
          children: "Bright button"
        })];
      }

    }), createComponent(ButtonTypeContainer, {
      get children() {
        return [createComponent(Button, {
          disabled: true,
          children: "Accent disabled button"
        }), createComponent(Button, {
          variant: 'ghost',
          disabled: true,
          children: "Ghost disabled button"
        }), createComponent(Button, {
          variant: 'bright',
          disabled: true,
          children: "Bright disabled button"
        })];
      }

    }), createComponent(ButtonTypeContainer, {
      get children() {
        return [createComponent(Button, {
          small: true,
          children: "Accent small button"
        }), createComponent(Button, {
          variant: 'ghost',
          small: true,
          children: "Ghost small button"
        }), createComponent(Button, {
          variant: 'bright',
          small: true,
          children: "Bright small button"
        })];
      }

    }), createComponent(ButtonTypeContainer, {
      get children() {
        return [createComponent(Button, {
          small: true,
          disabled: true,
          children: "Accent disabled small button"
        }), createComponent(Button, {
          variant: 'ghost',
          small: true,
          disabled: true,
          children: "Ghost disabled small button"
        }), createComponent(Button, {
          variant: 'bright',
          small: true,
          disabled: true,
          children: "Bright disabled small button"
        })];
      }

    })];
  }

});

const theme = {
  colors: {
    accent: '#0880AE',
    warning: '#F2AC57',
    success: '#14A38B',
    error: '#FF7171',
    primary: '#2C2738',
    secondary: '#756F86',
    muted: '#7C9CBF',
    bright: '#FFFFFF',
    shade: '#DBE2EA',
    tint: '#EBF4F8'
  }
};
const AlertsSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  gap: '16px',
  flexWrap: 'wrap',

  get children() {
    return [createComponent(Alert, {
      type: 'bright',
      textColor: 'accent',

      get iconColor() {
        return theme.colors.accent;
      },

      children: "A bright alert flash for dark backgrounds, which never lose the contrast."
    }), createComponent(Alert, {
      type: 'primary',
      children: "A dark (primary type) alert flash for bright backgrounds, which never lose the contrast."
    }), createComponent(Alert, {
      type: 'success',
      children: "A success alert flash, which never lose the contrast."
    }), createComponent(Alert, {
      type: 'warning',
      children: "A warning alert flash that never sucks."
    }), createComponent(Alert, {
      type: 'error',
      children: "An error alert flash that nobody loves."
    }), createComponent(Alert, {
      type: 'accent',
      children: "An accent alert flash that looks pretty nice."
    })];
  }

});

const CalloutsSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  gap: '16px',
  flexWrap: 'wrap',

  get children() {
    return [createComponent(Callout, {
      title: 'Callout Title',
      text: 'Supportive text for the callout goes here like a pro, which informs and helps users decide what they should do next.',

      get actions() {
        return [createComponent(Button, {
          small: true,
          children: "Action"
        }), createComponent(Button, {
          variant: 'ghost',
          small: true,
          children: " Action"
        })];
      }

    }), createComponent(Callout, {
      text: 'Supportive text for the callout.',

      get actions() {
        return [createComponent(Button, {
          small: true,
          children: "Action"
        }), createComponent(Button, {
          variant: 'ghost',
          small: true,
          children: " Action"
        })];
      },

      small: true
    })];
  }

});

const SpinnerSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  gap: '16px',
  flexWrap: 'wrap',

  get children() {
    return [createComponent(Spinner, {
      type: 'accent'
    }), createComponent(Spinner, {
      type: 'error'
    }), createComponent(Spinner, {
      type: 'warning'
    }), createComponent(Spinner, {
      type: 'success'
    })];
  }

});

const CardsSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  gap: '16px',
  flexWrap: 'wrap',

  get children() {
    return [createComponent(Card, {
      imageSrc: 'https://i.pinimg.com/originals/d4/62/aa/d462aa293e280254708a910f8328eb78.jpg',
      title: "Card title",

      get actions() {
        return [createComponent(Button, {
          variant: 'ghost',
          children: "Action"
        })];
      },

      children: "Supporting description for the card goes here like a breeze."
    }), createComponent(Card, {
      title: "Card title",

      get actions() {
        return [createComponent(Button, {
          variant: 'ghost',
          children: "Action"
        })];
      },

      children: "Supporting description for the card goes here like a breeze."
    })];
  }

});

const _tmpl$$1 = template$1(`<div></div>`);
const types = ['primary', 'accent', 'error', 'success', 'warning', 'secondary', 'muted', 'bright'];
const sizes = [1, 2, 3, 4, 5, 6];
const TypeScaleSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  gap: '16px',
  flexDirection: 'row',
  flexWrap: 'wrap',

  get children() {
    return createComponent(For, {
      each: types,
      children: type => (() => {
        const _el$ = _tmpl$$1.cloneNode(true);

        insert$1(_el$, createComponent(For, {
          each: sizes,
          children: size => createComponent(Heading, {
            size: size,
            type: type,
            children: `Heading x${size}`
          })
        }), null);

        insert$1(_el$, createComponent(Paragraph, {
          type: type,
          children: "Paragraph x1"
        }), null);

        insert$1(_el$, createComponent(Paragraph, {
          size: 2,
          type: type,
          children: "Paragraph x2"
        }), null);

        insert$1(_el$, createComponent(Label, {
          type: type,
          children: "Label"
        }), null);

        return _el$;
      })()
    });
  }

});

const AvatarsSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  flexWrap: 'wrap',
  gap: '8px',

  get children() {
    return [createComponent(Avatar, {
      initials: 'RK'
    }), createComponent(Avatar, {
      initials: 'RK',
      round: true
    }), createComponent(Avatar.Meg, {}), createComponent(Avatar.Meg, {
      round: true
    }), createComponent(Avatar.Mike, {}), createComponent(Avatar.Mike, {
      round: true
    }), createComponent(Avatar.Steven, {}), createComponent(Avatar.Steven, {
      round: true
    }), createComponent(Avatar.Mili, {}), createComponent(Avatar.Mili, {
      round: true
    })];
  }

});

const {
  Cross,
  More,
  Plus,
  Minus,
  Burger,
  Lens
} = Icons;
const IconsSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  gap: '16px',
  flexDirection: 'row',
  flexWrap: 'wrap',

  get children() {
    return [createComponent(Cross, {}), createComponent(More, {}), createComponent(Plus, {}), createComponent(Minus, {}), createComponent(Burger, {}), createComponent(Lens, {})];
  }

});

const StyledCard = styled('div')`
	background-color: ${props => props.backgroundColor};
	height: 240px;
	width: 260px;
	border-radius: 40px;
	padding: 40px;
	box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;
`;
const BlankHeader = styled('div')`
	width: 100%;
	height: 70%;
`;
const ColorCard = ({
  backgroundColor = '#2C2738',
  children
}) => createComponent(StyledCard, {
  backgroundColor: backgroundColor,

  get children() {
    return [createComponent(BlankHeader, {}), children];
  }

});

const colors = [{
  backgroundColor: '#0880AE',
  label: 'accent',
  labelType: 'bright',
  headingType: 'bright'
}, {
  backgroundColor: '#F2AC57',
  label: 'warning',
  labelType: 'bright',
  headingType: 'bright'
}, {
  backgroundColor: '#14A38B',
  label: 'success',
  labelType: 'bright',
  headingType: 'bright'
}, {
  backgroundColor: '#FF7171',
  label: 'error',
  labelType: 'bright',
  headingType: 'bright'
}, {
  backgroundColor: '#2C2738',
  color: '#ffffff',
  label: 'primary',
  labelType: 'bright',
  headingType: 'bright'
}, {
  backgroundColor: '#FFFFFF',
  label: 'bright',
  labelType: 'primary',
  headingType: 'primary'
}, {
  backgroundColor: '#DBE2EA',
  color: '#2C2738',
  label: 'shade',
  labelType: 'primary',
  headingType: 'primary'
}, {
  backgroundColor: '#EBF4F8',
  label: 'tint',
  labelType: 'primary',
  headingType: 'primary'
}];
const ColorsSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  flexWrap: 'wrap',
  gap: '8px',
  justifyContent: 'space-evenly',

  get children() {
    return createComponent(For, {
      each: colors,
      children: color => createComponent(ColorCard, {
        get backgroundColor() {
          return color.backgroundColor;
        },

        get children() {
          return [createComponent(Label, {
            get type() {
              return color.labelType;
            },

            get children() {
              return color.label;
            }

          }), createComponent(Heading, {
            size: 4,

            get type() {
              return color.headingType;
            },

            get children() {
              return color.backgroundColor;
            }

          })];
        }

      })
    });
  }

});

const ModalsSection = () => {
  const [getIsModalVisible, setIsModalVisible] = createSignal(false);
  return createComponent(Container, {
    type: 'fluid',
    flex: true,
    gap: '16px',
    flexWrap: 'wrap',

    get children() {
      return [createComponent(Button, {
        variant: 'ghost',
        small: true,
        onClick: () => setIsModalVisible(true),
        children: "Open modal"
      }), createComponent(Modal, {
        title: 'Modal Title',
        visible: getIsModalVisible,
        onOk: () => setIsModalVisible(false),
        onCancel: () => setIsModalVisible(false),
        children: "Left aligned contextual description for modal."
      })];
    }

  });
};

const TooltipsSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  gap: '16px',
  flexWrap: 'wrap',

  get children() {
    return [createComponent(Tooltip, {
      title: 'Tooltip title',

      get children() {
        return createComponent(Tag, {
          children: "Tooltip auto"
        });
      }

    }), createComponent(Tooltip, {
      title: 'Tooltip title',
      type: 'bright',
      placement: 'right',

      get children() {
        return createComponent(Tag, {
          children: "Tooltip right"
        });
      }

    }), createComponent(Tooltip, {
      title: 'Tooltip title',
      type: 'primary',
      placement: 'left',

      get children() {
        return createComponent(Tag, {
          children: "Tooltip left"
        });
      }

    }), createComponent(Tooltip, {
      title: 'Tooltip title',
      placement: 'bottom',

      get children() {
        return createComponent(Tag, {
          children: "Tooltip bottom"
        });
      }

    })];
  }

});

const FormSection = () => createComponent(Container, {
  type: 'fluid',
  flex: true,
  gap: '16px',
  flexDirection: 'row',
  flexWrap: 'wrap',

  get children() {
    return [createComponent(Input, {}), createComponent(Input, {
      value: "Value"
    }), createComponent(Input, {
      placeholder: "Placeholder"
    }), createComponent(Input, {
      value: "Disabled",
      disabled: true
    }), createComponent(Input, {
      placeholder: "With icon",

      get icon() {
        return createComponent(Icons.Lens, {});
      }

    }), createComponent(TextArea, {}), createComponent(TextArea, {
      value: "Value"
    }), createComponent(TextArea, {
      placeholder: "Placeholder"
    }), createComponent(TextArea, {
      placeholder: "Disabled",
      disabled: true
    })];
  }

});

const _tmpl$ = template$1(`<img alt="RevkitUI" width="100%">`),
      _tmpl$2 = template$1(`<div></div>`);

const App = () => {
  return (() => {
    const _el$ = _tmpl$2.cloneNode(true);

    _el$.style.setProperty("height", "80%");

    insert$1(_el$, createComponent(Container, {
      type: 'full',
      padding: '0',

      get children() {
        const _el$2 = _tmpl$.cloneNode(true);

        setAttribute$1(_el$2, "src", branding);

        return _el$2;
      }

    }), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Colors",
      rank: 1
    }), null);

    insert$1(_el$, createComponent(ColorsSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Icons",
      rank: 2
    }), null);

    insert$1(_el$, createComponent(IconsSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Form",
      rank: 3
    }), null);

    insert$1(_el$, createComponent(FormSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Buttons",
      rank: 5
    }), null);

    insert$1(_el$, createComponent(ButtonsSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Avatars",
      rank: 6
    }), null);

    insert$1(_el$, createComponent(AvatarsSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Type Scale",
      rank: 7
    }), null);

    insert$1(_el$, createComponent(TypeScaleSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Cards",
      rank: 8
    }), null);

    insert$1(_el$, createComponent(CardsSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Alerts",
      rank: 9
    }), null);

    insert$1(_el$, createComponent(AlertsSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Spinners",
      rank: 10
    }), null);

    insert$1(_el$, createComponent(SpinnerSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Callouts",
      rank: 11
    }), null);

    insert$1(_el$, createComponent(CalloutsSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Modals",
      rank: 12
    }), null);

    insert$1(_el$, createComponent(ModalsSection, {}), null);

    insert$1(_el$, createComponent(Legend, {
      title: "Tooltips",
      rank: 13
    }), null);

    insert$1(_el$, createComponent(TooltipsSection, {}), null);

    return _el$;
  })();
};

render$1(() => createComponent(RevKitTheme, {
  get children() {
    return createComponent(App, {});
  }

}), document.getElementById('root'));
