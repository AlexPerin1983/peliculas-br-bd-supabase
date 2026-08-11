import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type RefObject
} from 'react';
import {
    moveMenuItemToIndex,
    normalizeMenuOrder,
    type MenuTabId
} from '../lib/menuPreferences';

interface UseMenuDragReorderOptions {
    order: readonly MenuTabId[];
    enabled: boolean;
    onCommit: (order: MenuTabId[]) => void;
    onAnnounce: (message: string) => void;
    getItemLabel: (tabId: MenuTabId) => string;
    scrollRef: RefObject<HTMLElement | null>;
    onAutoScroll?: () => void;
}

interface DragSession {
    pointerId: number;
    tabId: MenuTabId;
    originalOrder: MenuTabId[];
    lastClientY: number;
    handle: HTMLElement;
}

const ordersMatch = (left: readonly MenuTabId[], right: readonly MenuTabId[]) =>
    left.length === right.length && left.every((tabId, index) => tabId === right[index]);

export const useMenuDragReorder = ({
    order,
    enabled,
    onCommit,
    onAnnounce,
    getItemLabel,
    scrollRef,
    onAutoScroll
}: UseMenuDragReorderOptions) => {
    const normalizedOrder = useMemo(() => normalizeMenuOrder(order), [order]);
    const [draftOrder, setDraftOrder] = useState<MenuTabId[] | null>(null);
    const [draggingTabId, setDraggingTabId] = useState<MenuTabId | null>(null);
    const draftOrderRef = useRef<MenuTabId[] | null>(null);
    const dragSessionRef = useRef<DragSession | null>(null);
    const rowElementsRef = useRef(new Map<MenuTabId, HTMLElement>());
    const autoScrollFrameRef = useRef<number | null>(null);

    const stopAutoScroll = useCallback(() => {
        if (autoScrollFrameRef.current === null) return;
        window.cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
    }, []);

    const registerRow = useCallback((tabId: MenuTabId, node: HTMLElement | null) => {
        if (node) {
            rowElementsRef.current.set(tabId, node);
        } else {
            rowElementsRef.current.delete(tabId);
        }
    }, []);

    const updateDraftForPointer = useCallback((clientY: number) => {
        const session = dragSessionRef.current;
        const currentOrder = draftOrderRef.current;
        if (!session || !currentOrder) return;

        let insertionIndex = 0;
        currentOrder.forEach(tabId => {
            if (tabId === session.tabId) return;
            const row = rowElementsRef.current.get(tabId);
            if (!row) return;

            const rect = row.getBoundingClientRect();
            if (clientY > rect.top + rect.height / 2) insertionIndex += 1;
        });

        const nextOrder = moveMenuItemToIndex(currentOrder, session.tabId, insertionIndex);
        if (ordersMatch(currentOrder, nextOrder)) return;

        draftOrderRef.current = nextOrder;
        setDraftOrder(nextOrder);
    }, []);

    const startAutoScroll = useCallback(() => {
        if (autoScrollFrameRef.current !== null) return;

        const tick = () => {
            const session = dragSessionRef.current;
            const scrollElement = scrollRef.current;
            if (!session || !scrollElement) {
                autoScrollFrameRef.current = null;
                return;
            }

            const rect = scrollElement.getBoundingClientRect();
            const edgeSize = Math.min(48, rect.height / 3);
            let velocity = 0;

            if (edgeSize > 0 && session.lastClientY < rect.top + edgeSize) {
                velocity = -Math.ceil(((rect.top + edgeSize - session.lastClientY) / edgeSize) * 12);
            } else if (edgeSize > 0 && session.lastClientY > rect.bottom - edgeSize) {
                velocity = Math.ceil(((session.lastClientY - (rect.bottom - edgeSize)) / edgeSize) * 12);
            }

            if (velocity === 0) {
                autoScrollFrameRef.current = null;
                return;
            }

            const maxScrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
            const nextScrollTop = Math.max(0, Math.min(maxScrollTop, scrollElement.scrollTop + velocity));

            if (nextScrollTop !== scrollElement.scrollTop) {
                scrollElement.scrollTop = nextScrollTop;
                updateDraftForPointer(session.lastClientY);
                onAutoScroll?.();
            } else {
                autoScrollFrameRef.current = null;
                return;
            }

            autoScrollFrameRef.current = window.requestAnimationFrame(tick);
        };

        autoScrollFrameRef.current = window.requestAnimationFrame(tick);
    }, [onAutoScroll, scrollRef, updateDraftForPointer]);

    const releasePointerCapture = useCallback((session: DragSession) => {
        try {
            if (
                typeof session.handle.releasePointerCapture === 'function'
                && (
                    typeof session.handle.hasPointerCapture !== 'function'
                    || session.handle.hasPointerCapture(session.pointerId)
                )
            ) {
                session.handle.releasePointerCapture(session.pointerId);
            }
        } catch {
            // O navegador pode liberar a captura automaticamente ao encerrar o gesto.
        }
    }, []);

    const clearDrag = useCallback((announceCancellation: boolean) => {
        const session = dragSessionRef.current;
        if (!session) return false;

        stopAutoScroll();
        releasePointerCapture(session);
        dragSessionRef.current = null;
        draftOrderRef.current = null;
        setDraftOrder(null);
        setDraggingTabId(null);

        if (announceCancellation) {
            onAnnounce(`Organização de ${getItemLabel(session.tabId)} cancelada.`);
        }

        return true;
    }, [getItemLabel, onAnnounce, releasePointerCapture, stopAutoScroll]);

    const handlePointerDown = useCallback((
        event: ReactPointerEvent<HTMLElement>,
        tabId: MenuTabId
    ) => {
        if (!enabled || event.isPrimary === false) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();

        const snapshot = [...normalizedOrder];
        dragSessionRef.current = {
            pointerId: event.pointerId,
            tabId,
            originalOrder: snapshot,
            lastClientY: event.clientY,
            handle: event.currentTarget
        };
        draftOrderRef.current = snapshot;
        setDraftOrder(snapshot);
        setDraggingTabId(tabId);
        onAnnounce(`${getItemLabel(tabId)} selecionado para organizar.`);

        try {
            event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
            // O gesto ainda funciona sem captura em navegadores mais antigos.
        }
    }, [enabled, getItemLabel, normalizedOrder, onAnnounce]);

    const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) return;

        event.preventDefault();
        event.stopPropagation();
        session.lastClientY = event.clientY;
        updateDraftForPointer(event.clientY);
        startAutoScroll();
    }, [startAutoScroll, updateDraftForPointer]);

    const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) return;

        event.preventDefault();
        event.stopPropagation();
        stopAutoScroll();

        const finalOrder = draftOrderRef.current ?? session.originalOrder;
        const finalPosition = finalOrder.indexOf(session.tabId) + 1;
        const didMove = !ordersMatch(session.originalOrder, finalOrder);

        releasePointerCapture(session);
        dragSessionRef.current = null;
        draftOrderRef.current = null;

        if (didMove) onCommit(finalOrder);
        setDraftOrder(null);
        setDraggingTabId(null);
        onAnnounce(
            `${getItemLabel(session.tabId)}: posição ${finalPosition} de ${finalOrder.length}.`
        );
    }, [getItemLabel, onAnnounce, onCommit, releasePointerCapture, stopAutoScroll]);

    const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) return;
        event.stopPropagation();
        clearDrag(true);
    }, [clearDrag]);

    const cancelDrag = useCallback(() => clearDrag(true), [clearDrag]);

    useEffect(() => {
        if (!enabled) clearDrag(false);
    }, [clearDrag, enabled]);

    useEffect(() => () => {
        stopAutoScroll();
        dragSessionRef.current = null;
    }, [stopAutoScroll]);

    return {
        displayOrder: draftOrder ?? normalizedOrder,
        draggingTabId,
        registerRow,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handlePointerCancel,
        cancelDrag
    };
};
