export type SwipeState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  offsetX: number;
  revealDelete: boolean;
  markLocalReady: boolean;
};

export const initialSwipeState: SwipeState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  offsetX: 0,
  revealDelete: false,
  markLocalReady: false,
};

export type SwipeAction =
  | { type: "pointer-down"; pointerId: number; x: number; y: number; interactive: boolean }
  | { type: "pointer-move"; pointerId: number; x: number; y: number }
  | { type: "pointer-up" | "pointer-cancel" | "lost-capture"; pointerId: number };

export function reduceSwipe(state: SwipeState, action: SwipeAction): SwipeState {
  if (action.type === "pointer-down") {
    if (action.interactive || state.pointerId !== null) return state;
    return { ...initialSwipeState, pointerId: action.pointerId, startX: action.x, startY: action.y };
  }
  if (state.pointerId !== action.pointerId) return state;
  if (action.type === "pointer-up") {
    if (state.revealDelete) return { ...state, pointerId: null, startX: 0, startY: 0 };
    if (state.markLocalReady) return { ...initialSwipeState, markLocalReady: true };
    return initialSwipeState;
  }
  if (action.type !== "pointer-move") return initialSwipeState;
  const deltaX = action.x - state.startX;
  const deltaY = action.y - state.startY;
  const horizontalIntent = Math.abs(deltaX) >= 72 && Math.abs(deltaX) >= Math.abs(deltaY) * 1.5;
  return {
    ...state,
    offsetX: horizontalIntent ? Math.max(-96, Math.min(96, deltaX)) : 0,
    revealDelete: horizontalIntent && deltaX < 0,
    markLocalReady: horizontalIntent && deltaX > 0,
  };
}

export type ModalFocusTarget = { isConnected: boolean; focus: () => void };

export function handleModalKey(input: {
  key: string;
  shiftKey: boolean;
  activeElement: unknown;
  first: ModalFocusTarget | null;
  last: ModalFocusTarget | null;
  preventDefault: () => void;
  onEscape: () => void;
}) {
  if (input.key === "Escape") {
    input.preventDefault();
    input.onEscape();
    return;
  }
  if (input.key !== "Tab" || !input.first || !input.last) return;
  if (!input.shiftKey && input.activeElement === input.last) {
    input.preventDefault();
    input.first.focus();
  } else if (input.shiftKey && input.activeElement === input.first) {
    input.preventDefault();
    input.last.focus();
  }
}

export function restoreModalFocus(invoker: ModalFocusTarget | null, fallback: ModalFocusTarget | null) {
  const target = invoker?.isConnected ? invoker : fallback?.isConnected ? fallback : null;
  target?.focus();
  return Boolean(target);
}

export function focusMenuSelection(items: Array<ModalFocusTarget | null>, selectedIndex: number) {
  const target = items[selectedIndex]?.isConnected ? items[selectedIndex] : items.find(item => item?.isConnected) ?? null;
  target?.focus();
  return Boolean(target);
}

export function handleMenuKey(input: {
  key: string;
  currentIndex: number;
  itemCount: number;
  focusIndex: (index: number) => void;
  preventDefault: () => void;
  closeAndRestore: () => void;
}) {
  if (input.key === "Escape") {
    input.preventDefault();
    input.closeAndRestore();
    return;
  }
  let next: number | null = null;
  if (input.key === "ArrowDown") next = (input.currentIndex + 1) % input.itemCount;
  if (input.key === "ArrowUp") next = (input.currentIndex - 1 + input.itemCount) % input.itemCount;
  if (input.key === "Home") next = 0;
  if (input.key === "End") next = input.itemCount - 1;
  if (next === null || input.itemCount < 1) return;
  input.preventDefault();
  input.focusIndex(next);
}

type SearchSettlement<T> =
  | { kind: "results"; items: T[] }
  | { kind: "empty" }
  | { kind: "error"; message: string };

type SearchSnapshot<T> = {
  ticket: number;
  loading: boolean;
  items: T[];
  selection: T | null;
  error: string | null;
};

export function createSearchOwnership<T>() {
  let state: SearchSnapshot<T> = { ticket: 0, loading: false, items: [], selection: null, error: null };
  return {
    begin() {
      state = { ticket: state.ticket + 1, loading: true, items: [], selection: null, error: null };
      return state.ticket;
    },
    settle(ticket: number, settlement: SearchSettlement<T>) {
      if (ticket !== state.ticket) return false;
      if (settlement.kind === "results") state = { ...state, loading: false, items: settlement.items, error: null };
      if (settlement.kind === "empty") state = { ...state, loading: false, items: [], error: null };
      if (settlement.kind === "error") state = { ...state, loading: false, items: [], error: settlement.message };
      return true;
    },
    select(item: T | null) {
      state = { ...state, loading: false, items: [], selection: item, error: null };
    },
    snapshot() {
      return { ...state, items: [...state.items] };
    },
  };
}

export function createStartGate<T>(operation: () => Promise<T>) {
  let flight: Promise<T> | null = null;
  let completed: Promise<T> | null = null;
  return {
    start(): Promise<T> {
      if (completed) return completed;
      if (flight) return flight;
      let request: Promise<T>;
      try {
        request = operation();
      } catch (error) {
        request = Promise.reject(error);
      }
      const wrapped = request.then(
        value => {
          completed = wrapped;
          return value;
        },
        error => {
          if (flight === wrapped) flight = null;
          throw error;
        },
      );
      flight = wrapped;
      return flight;
    },
  };
}
