import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PanResponder, Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent, type PanResponderGestureState } from 'react-native';

interface ZoomPanCanvasProps {
    contentWidth: number;
    contentHeight: number;
    minScale?: number;
    maxScale?: number;
    /** Called once the viewport is measured and an initial fit-to-screen scale
     *  is applied, so callers can adjust chrome (e.g. hide a "fit" hint). */
    children: ReactNode;
}

interface Transform {
    scale: number;
    x: number;
    y: number;
}

const DEFAULT_MIN_SCALE = 0.3;
const DEFAULT_MAX_SCALE = 3;

/**
 * A pan + pinch-zoom viewport for arbitrary (SVG) content, built on plain
 * touch/mouse primitives instead of a gesture library — deliberately simple
 * so it behaves the same (and stays debuggable) across native and web:
 *  - Native (iOS/Android): two-finger pinch to zoom, one-finger drag to pan.
 *  - Web: mouse wheel to zoom (centered on the cursor), click-drag to pan.
 * Starts fit-to-screen (the whole content visible) once the viewport is
 * measured, and always clamps scale/translate so content can't get lost.
 */
export function ZoomPanCanvas({ contentWidth, contentHeight, minScale = DEFAULT_MIN_SCALE, maxScale = DEFAULT_MAX_SCALE, children }: ZoomPanCanvasProps) {
    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
    const didFitRef = useRef(false);

    // Live gesture state (refs so touch handlers always read the latest
    // values without re-subscribing the responder on every render).
    const transformRef = useRef(transform);
    transformRef.current = transform;
    const pinchRef = useRef<{ startDistance: number; startScale: number; midpoint: { x: number; y: number }; startX: number; startY: number } | null>(null);
    const panStartRef = useRef<{ x: number; y: number } | null>(null);

    const clamp = (t: Transform, vpWidth: number, vpHeight: number): Transform => {
        const scale = Math.min(maxScale, Math.max(minScale, t.scale));
        const scaledW = contentWidth * scale;
        const scaledH = contentHeight * scale;
        // Allow the content to be dragged until its edge reaches the viewport
        // edge (no further) — if content is smaller than the viewport on an
        // axis, center it on that axis instead of letting it float freely.
        const minX = Math.min(0, vpWidth - scaledW);
        const maxX = Math.max(0, vpWidth - scaledW);
        const minY = Math.min(0, vpHeight - scaledH);
        const maxY = Math.max(0, vpHeight - scaledH);
        const x = scaledW <= vpWidth ? (vpWidth - scaledW) / 2 : Math.min(maxX, Math.max(minX, t.x));
        const y = scaledH <= vpHeight ? (vpHeight - scaledH) / 2 : Math.min(maxY, Math.max(minY, t.y));
        return { scale, x, y };
    };

    const fitToScreen = (vpWidth: number, vpHeight: number): Transform => {
        if (contentWidth <= 0 || contentHeight <= 0 || vpWidth <= 0 || vpHeight <= 0) {
            return { scale: 1, x: 0, y: 0 };
        }
        const scale = Math.min(1, vpWidth / contentWidth, vpHeight / contentHeight);
        const x = (vpWidth - contentWidth * scale) / 2;
        const y = (vpHeight - contentHeight * scale) / 2;
        return { scale, x, y };
    };

    const onLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        setViewport({ width, height });
        if (!didFitRef.current && width > 0 && height > 0) {
            didFitRef.current = true;
            setTransform(fitToScreen(width, height));
        }
    };

    const distance = (touches: GestureResponderEvent['nativeEvent']['touches']): number => {
        const [a, b] = touches;
        if (!a || !b) return 0;
        return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
    };

    const midpointOf = (touches: GestureResponderEvent['nativeEvent']['touches']): { x: number; y: number } => {
        const [a, b] = touches;
        if (!a || !b) return { x: 0, y: 0 };
        return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
    };

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event: GestureResponderEvent) => {
            const touches = event.nativeEvent.touches;
            if (touches.length >= 2) {
                pinchRef.current = {
                    startDistance: distance(touches) || 1,
                    startScale: transformRef.current.scale,
                    midpoint: midpointOf(touches),
                    startX: transformRef.current.x,
                    startY: transformRef.current.y
                };
                panStartRef.current = null;
            } else {
                panStartRef.current = { x: transformRef.current.x, y: transformRef.current.y };
                pinchRef.current = null;
            }
        },
        onPanResponderMove: (event: GestureResponderEvent, gesture: PanResponderGestureState) => {
            const touches = event.nativeEvent.touches;

            if (touches.length >= 2) {
                if (!pinchRef.current || panStartRef.current) {
                    pinchRef.current = {
                        startDistance: distance(touches) || 1,
                        startScale: transformRef.current.scale,
                        midpoint: midpointOf(touches),
                        startX: transformRef.current.x,
                        startY: transformRef.current.y
                    };
                    panStartRef.current = null;
                }
                const pinch = pinchRef.current;
                const currentDistance = distance(touches) || 1;
                const rawScale = pinch.startScale * (currentDistance / pinch.startDistance);
                const scale = Math.min(maxScale, Math.max(minScale, rawScale));
                // Keep the pinch midpoint anchored on screen as the content scales.
                const scaleRatio = scale / pinch.startScale;
                const x = pinch.midpoint.x - (pinch.midpoint.x - pinch.startX) * scaleRatio;
                const y = pinch.midpoint.y - (pinch.midpoint.y - pinch.startY) * scaleRatio;
                setTransform(clamp({ scale, x, y }, viewport.width, viewport.height));
                return;
            }

            if (panStartRef.current) {
                const x = panStartRef.current.x + gesture.dx;
                const y = panStartRef.current.y + gesture.dy;
                setTransform((current) => clamp({ scale: current.scale, x, y }, viewport.width, viewport.height));
            }
        },
        onPanResponderRelease: () => {
            pinchRef.current = null;
            panStartRef.current = null;
        },
        onPanResponderTerminate: () => {
            pinchRef.current = null;
            panStartRef.current = null;
        }
    }), [viewport.width, viewport.height, contentWidth, contentHeight, minScale, maxScale]);

    // Web: mouse wheel zoom (centered on the cursor) + click-drag pan, using
    // native DOM events since RN's touch responder system doesn't cover wheel.
    const webHandlersRef = useRef<{ onWheel?: (e: any) => void; onMouseDown?: (e: any) => void }>({});
    if (Platform.OS === 'web') {
        webHandlersRef.current.onWheel = (event: any) => {
            event.preventDefault?.();
            const rect = event.currentTarget?.getBoundingClientRect?.();
            const cursorX = rect ? event.clientX - rect.left : viewport.width / 2;
            const cursorY = rect ? event.clientY - rect.top : viewport.height / 2;
            const current = transformRef.current;
            const factor = Math.exp(-event.deltaY * 0.0015);
            const scale = Math.min(maxScale, Math.max(minScale, current.scale * factor));
            const scaleRatio = scale / current.scale;
            const x = cursorX - (cursorX - current.x) * scaleRatio;
            const y = cursorY - (cursorY - current.y) * scaleRatio;
            setTransform(clamp({ scale, x, y }, viewport.width, viewport.height));
        };
        webHandlersRef.current.onMouseDown = (downEvent: any) => {
            downEvent.preventDefault?.();
            const start = transformRef.current;
            const startX = downEvent.clientX;
            const startY = downEvent.clientY;
            const onMove = (moveEvent: any) => {
                const x = start.x + (moveEvent.clientX - startX);
                const y = start.y + (moveEvent.clientY - startY);
                setTransform((c) => clamp({ scale: c.scale, x, y }, viewport.width, viewport.height));
            };
            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        };
    }

    return (
        <View
            onLayout={onLayout}
            style={styles.viewport}
            {...(Platform.OS === 'web' ? { onWheel: webHandlersRef.current.onWheel, onMouseDown: webHandlersRef.current.onMouseDown } as any : panResponder.panHandlers)}
        >
            <View
                style={{
                    width: contentWidth,
                    height: contentHeight,
                    // Anchor scale at the content's own top-left (0,0) instead
                    // of its center (the platform default) — this is what
                    // makes the translateX/Y + scale combo above match the
                    // "zoom to point" math (clamp/wheel/pinch handlers) exactly.
                    transformOrigin: '0 0',
                    transform: [
                        { translateX: transform.x },
                        { translateY: transform.y },
                        { scale: transform.scale }
                    ]
                } as any}
            >
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    viewport: {
        flex: 1,
        overflow: 'hidden'
    }
});
