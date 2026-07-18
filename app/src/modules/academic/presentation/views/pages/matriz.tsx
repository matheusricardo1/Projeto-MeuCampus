import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, GitBranch, List, RefreshCw, RotateCcw } from 'lucide-react-native';
import { colors, gradients, radii, shadows, spacing, textShadows, typography } from '@/shared/design-system';
import { hapticTap } from '@/shared/haptics';
import { useMatrizCurricular } from '@/modules/academic/presentation/hooks/use-matriz-curricular';
import { ZoomPanCanvas } from '@/modules/academic/presentation/components/zoom-pan-canvas';
import type { MatrizCategoria, MatrizCurricular, MatrizDisciplina } from '@/modules/academic/domain/entities/matriz-curricular';

type ViewMode = 'list' | 'graph';

export function MatrizPage({ bottomInset = 24 }: { bottomInset?: number }) {
    const router = useRouter();
    const { matriz, isLoading, error, reload } = useMatrizCurricular();
    const [mode, setMode] = useState<ViewMode>('list');

    // The graph is a full-screen drill-down (its own back button returns to the
    // matriz overview), so it gets the whole canvas — no hero/toggle above it.
    if (matriz && mode === 'graph') {
        return <MatrizGraphView matriz={matriz} bottomInset={bottomInset} onBack={() => setMode('list')} />;
    }

    return (
        <View style={styles.screen}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <View style={styles.heroTopRow}>
                    <Pressable onPress={() => { hapticTap(); router.back(); }} style={({ pressed }) => [styles.iconButton, pressed ? styles.pressed : null]}>
                        <ArrowLeft color={colors.inverseText} size={18} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.heroEyebrow}>MATRIZ CURRICULAR</Text>
                        <Text numberOfLines={2} style={styles.heroTitle}>{matriz?.curso || 'Seu curso'}</Text>
                    </View>
                </View>

                {matriz ? (
                    <View style={styles.heroChips}>
                        {matriz.versao ? <HeroChip label="Versão" value={matriz.versao} /> : null}
                        {matriz.situacao ? <HeroChip label="Situação" value={matriz.situacao} /> : null}
                        {matriz.turno ? <HeroChip label="Turno" value={matriz.turno} /> : null}
                        <HeroChip label="Disciplinas" value={String(matriz.totalDisciplinas)} />
                    </View>
                ) : null}
            </LinearGradient>

            {matriz ? (
                <View style={styles.toggleRow}>
                    <ToggleButton active={mode === 'list'} icon={<List size={16} color={mode === 'list' ? colors.inverseText : colors.brand} />} label="Lista" onPress={() => { hapticTap(); setMode('list'); }} />
                    <ToggleButton active={mode === 'graph'} icon={<GitBranch size={16} color={mode === 'graph' ? colors.inverseText : colors.brand} />} label="Grafo (obrigatórias)" onPress={() => { hapticTap(); setMode('graph'); }} />
                </View>
            ) : null}

            {isLoading ? (
                <StateView emoji="⏳" title="Carregando a matriz do seu curso" subtitle="A primeira vez baixa e processa o documento no eCampus — pode levar alguns segundos." />
            ) : error ? (
                <StateView emoji="⚠️" title="Não deu para carregar" subtitle={error} onRetry={reload} />
            ) : !matriz ? (
                <StateView emoji="📚" title="Matriz indisponível" subtitle="Não encontramos a matriz do seu curso agora." onRetry={reload} />
            ) : (
                <MatrizListView matriz={matriz} bottomInset={bottomInset} />
            )}
        </View>
    );
}

function HeroChip({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.heroChip}>
            <Text style={styles.heroChipLabel}>{label}</Text>
            <Text style={styles.heroChipValue}>{value}</Text>
        </View>
    );
}

function ToggleButton({ active, icon, label, onPress }: { active: boolean; icon: ReactNode; label: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.toggleButton, active ? styles.toggleButtonActive : null, pressed ? styles.pressed : null]}>
            {icon}
            <Text style={[styles.toggleButtonText, active ? styles.toggleButtonTextActive : null]}>{label}</Text>
        </Pressable>
    );
}

function StateView({ emoji, title, subtitle, onRetry }: { emoji: string; title: string; subtitle: string; onRetry?: () => void }) {
    return (
        <View style={styles.stateWrap}>
            <Text style={styles.stateEmoji}>{emoji}</Text>
            <Text style={styles.stateTitle}>{title}</Text>
            <Text style={styles.stateSubtitle}>{subtitle}</Text>
            {onRetry ? (
                <Pressable onPress={() => { hapticTap(); onRetry(); }} style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : null]}>
                    <RefreshCw color={colors.inverseText} size={15} />
                    <Text style={styles.retryButtonText}>Tentar de novo</Text>
                </Pressable>
            ) : null}
        </View>
    );
}

// ================================================================ List view

function MatrizListView({ matriz, bottomInset }: { matriz: MatrizCurricular; bottomInset: number }) {
    return (
        <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: bottomInset + spacing[8], gap: spacing[5] }}>
            {matriz.categorias.map((categoria) => (
                <CategoriaBlock key={categoria.nome} categoria={categoria} />
            ))}
        </ScrollView>
    );
}

function CategoriaBlock({ categoria }: { categoria: MatrizCategoria }) {
    const credits = categoria.disciplinas.reduce((sum, d) => sum + (d.creditos ?? 0), 0);
    return (
        <View style={styles.categoriaBlock}>
            <View style={styles.categoriaHeader}>
                <Text style={styles.categoriaTitle}>{categoria.nome}</Text>
                <Text style={styles.categoriaMeta}>{categoria.disciplinas.length} · {credits} créd.</Text>
            </View>
            <View style={{ gap: spacing[2] }}>
                {categoria.disciplinas.map((d) => <DisciplinaCard key={d.codigo + (d.periodo ?? '')} disciplina={d} />)}
            </View>
        </View>
    );
}

function DisciplinaCard({ disciplina }: { disciplina: MatrizDisciplina }) {
    const { cargaHoraria: ch } = disciplina;
    return (
        <View style={styles.card}>
            <View style={styles.cardLeft}>
                {disciplina.periodo ? (
                    <View style={styles.periodBadge}><Text style={styles.periodBadgeText}>{disciplina.periodo}º</Text></View>
                ) : (
                    <View style={[styles.periodBadge, styles.periodBadgeMuted]}><Text style={styles.periodBadgeMutedText}>—</Text></View>
                )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.cardCode}>{disciplina.codigo}</Text>
                <Text style={styles.cardName}>{disciplina.nome}</Text>
                <View style={styles.cardChips}>
                    {disciplina.creditos != null ? <MiniChip text={`${disciplina.creditos} créd`} /> : null}
                    <MiniChip text={`${ch.total}h`} />
                    {disciplina.preRequisitos.length > 0 ? (
                        <MiniChip text={`pré: ${disciplina.preRequisitos.join(', ')}`} tone="warn" />
                    ) : null}
                </View>
            </View>
        </View>
    );
}

function MiniChip({ text, tone }: { text: string; tone?: 'warn' }) {
    return (
        <View style={[styles.miniChip, tone === 'warn' ? styles.miniChipWarn : null]}>
            <Text style={[styles.miniChipText, tone === 'warn' ? styles.miniChipWarnText : null]}>{text}</Text>
        </View>
    );
}

// =============================================================== Graph view
// Layered top-down DAG: each período is a horizontal ROW (1º at the top), and
// pre-requisito arrows flow downward into the disciplinas that depend on them.

const NODE_W = 152;
const NODE_H = 58;
const H_GAP = 16; // between disciplinas of the same período (kept tight)
const V_GAP = 52; // between período rows (vertical) — room for the arrows
const PAD = 16;

// Card palette by category, echoing the reference diagram (beige = obrigatória).
const CARD_FILL = '#EFE2B0';
const CARD_STROKE = '#D9C179';
const CARD_TEXT = '#4A3E12';

interface GraphNode {
    codigo: string;
    nome: string;
    periodo: number;
    x: number;
    y: number;
}

function completedStorageKey(matriz: MatrizCurricular): string {
    return `matriz.completed.${matriz.curso}.${matriz.versao}`;
}

function MatrizGraphView({ matriz, bottomInset, onBack }: { matriz: MatrizCurricular; bottomInset: number; onBack: () => void }) {
    const layout = useMemo(() => buildGraphLayout(matriz), [matriz]);
    const [completed, setCompleted] = useState<Set<string>>(new Set());
    const storageKey = completedStorageKey(matriz);

    useEffect(() => {
        let cancelled = false;
        void AsyncStorage.getItem(storageKey).then((raw) => {
            if (cancelled || !raw) return;
            try {
                const codes = JSON.parse(raw) as string[];
                setCompleted(new Set(codes));
            } catch {
                // ignore malformed storage
            }
        });
        return () => { cancelled = true; };
    }, [storageKey]);

    const toggleCompleted = (codigo: string) => {
        hapticTap();
        setCompleted((current) => {
            const next = new Set(current);
            if (next.has(codigo)) next.delete(codigo);
            else next.add(codigo);
            void AsyncStorage.setItem(storageKey, JSON.stringify([...next]));
            return next;
        });
    };

    const clearCompleted = () => {
        hapticTap();
        setCompleted(new Set());
        void AsyncStorage.removeItem(storageKey);
    };

    return (
        <View style={styles.screen}>
            {layout.nodes.length === 0 ? (
                <StateView emoji="🗺️" title="Sem grafo" subtitle="Não há disciplinas obrigatórias com período para montar o grafo." />
            ) : (
                <>
                    <View style={styles.graphHeader}>
                        <Text numberOfLines={2} style={[styles.graphTitle, { paddingLeft: 68, paddingRight: 68 }]}>Matriz Curricular · {matriz.curso}{matriz.versao ? ` — ${matriz.versao}` : ''}</Text>
                        <Text style={styles.graphHint}>Toque numa matéria para marcar como concluída. Belisque (ou role o mouse) para dar zoom.</Text>
                    </View>

                    <ZoomPanCanvas
                        contentWidth={layout.width}
                        contentHeight={layout.height}
                        minScale={0.15}
                        maxScale={3}
                        onTap={(x, y) => {
                            const hit = layout.nodes.find((n) => x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H);
                            if (hit) toggleCompleted(hit.codigo);
                        }}
                    >
                        <Svg width={layout.width} height={layout.height}>
                            {/* edges */}
                            {layout.edges.map((e, i) => (
                                <Edge key={`e${i}`} points={e.points} />
                            ))}
                            {/* nodes */}
                            {layout.nodes.map((n) => (
                                <GraphNodeView key={n.codigo} node={n} done={completed.has(n.codigo)} />
                            ))}
                        </Svg>
                    </ZoomPanCanvas>

                    {completed.size > 0 ? (
                        <Pressable onPress={clearCompleted} style={({ pressed }) => [styles.graphClearButton, pressed ? styles.pressed : null]}>
                            <RotateCcw color={colors.brandDark} size={14} />
                            <Text style={styles.graphClearButtonText}>{completed.size} concluída{completed.size > 1 ? 's' : ''} · limpar</Text>
                        </Pressable>
                    ) : null}
                </>
            )}

            <Pressable onPress={() => { hapticTap(); onBack(); }} style={({ pressed }) => [styles.graphBackButton, pressed ? styles.pressed : null]}>
                <ArrowLeft color={colors.brandDark} size={20} />
            </Pressable>
        </View>
    );
}

function GraphNodeView({ node, done }: { node: GraphNode; done: boolean }) {
    const lines = wrapLines(toTitleCase(node.nome), 18, 3);
    const cx = node.x + NODE_W / 2;
    const startY = node.y + NODE_H / 2 - ((lines.length - 1) * 11) / 2 + 3.5;
    const badgeCx = node.x + NODE_W - 12;
    const badgeCy = node.y + 12;
    // No touch handler here on purpose: taps are detected centrally by
    // ZoomPanCanvas (onTap, hit-tested against layout.nodes) so an individual
    // card's own responder never competes with the pan/pinch gesture.
    return (
        <G>
            <Rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={10} fill={done ? colors.brandMuted : CARD_FILL} stroke={done ? colors.brand : CARD_STROKE} strokeWidth={done ? 2 : 1.2} opacity={done ? 0.85 : 1} />
            {lines.map((line, i) => (
                <SvgText key={i} x={cx} y={startY + i * 11} fill={done ? colors.textSubtle : CARD_TEXT} fontSize={10} fontWeight="600" textAnchor="middle" textDecoration={done ? 'line-through' : 'none'}>
                    {line}
                </SvgText>
            ))}
            {done ? (
                <>
                    <Circle cx={badgeCx} cy={badgeCy} r={9} fill={colors.brand} />
                    <SvgText x={badgeCx} y={badgeCy + 3.5} fill={colors.inverseText} fontSize={11} fontWeight="900" textAnchor="middle">✓</SvgText>
                </>
            ) : null}
        </G>
    );
}

function toTitleCase(value: string): string {
    const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'à', 'o']);
    return value.toLocaleLowerCase('pt-BR').replace(/[a-zà-ú]+/gi, (word, index) =>
        index > 0 && small.has(word) ? word : word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
    );
}

function wrapLines(text: string, maxLen: number, maxLines: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        if (!current) current = word;
        else if ((current + ' ' + word).length <= maxLen) current += ' ' + word;
        else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        kept[maxLines - 1] = truncate(kept[maxLines - 1]!, maxLen);
        return kept;
    }
    return lines;
}

/** Pure renderer — all routing decisions already happened in buildGraphLayout,
 *  so this just draws the given point list as a rounded path with an arrowhead
 *  aimed along its final segment. */
function Edge({ points }: { points: Array<[number, number]> }) {
    const path = roundedPathFromPoints(points, 10);
    const [px, py] = points[points.length - 2]!;
    const [tx, ty] = points[points.length - 1]!;
    const arrow = arrowHead(px, py, tx, ty, 9);
    return (
        <>
            <Path d={path} fill="none" stroke={colors.brand} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            <Polygon points={arrow} fill={colors.brand} />
        </>
    );
}

/** Builds an SVG path through `points`, rounding each interior corner with a
 *  small quadratic-bezier arc instead of a sharp right angle. */
function roundedPathFromPoints(points: Array<[number, number]>, radius: number): string {
    if (points.length < 2) return '';
    if (points.length === 2) return `M ${points[0]![0]},${points[0]![1]} L ${points[1]![0]},${points[1]![1]}`;

    let d = `M ${points[0]![0]},${points[0]![1]}`;
    for (let i = 1; i < points.length - 1; i++) {
        const [x0, y0] = points[i - 1]!;
        const [x1, y1] = points[i]!;
        const [x2, y2] = points[i + 1]!;
        const d1 = Math.hypot(x1 - x0, y1 - y0) || 1;
        const d2 = Math.hypot(x2 - x1, y2 - y1) || 1;
        const r = Math.min(radius, d1 / 2, d2 / 2);
        const inX = x1 - ((x1 - x0) / d1) * r;
        const inY = y1 - ((y1 - y0) / d1) * r;
        const outX = x1 + ((x2 - x1) / d2) * r;
        const outY = y1 + ((y2 - y1) / d2) * r;
        d += ` L ${inX},${inY} Q ${x1},${y1} ${outX},${outY}`;
    }
    const last = points[points.length - 1]!;
    d += ` L ${last[0]},${last[1]}`;
    return d;
}

interface GraphLayout {
    nodes: GraphNode[];
    edges: Array<{ from: GraphNode; to: GraphNode; points: Array<[number, number]> }>;
    rows: Array<{ periodo: number; y: number }>;
    width: number;
    height: number;
}

const ROW_MARGIN = 8;       // how far into a row-gap a horizontal jog sits
const EXTERIOR_LANE_GAP = 14; // spacing between stacked exterior (border) lanes

/**
 * Routes every edge into a concrete point list, geometrically guaranteed to
 * never cross a card: every row shares the same y-band across ALL columns
 * (uniform grid), so any horizontal jog placed in the empty gap BETWEEN two
 * rows is card-free for the entire width; likewise every vertical run sits
 * at a column-gap x that no card, in any row, ever occupies. Two routing
 * styles:
 *  - Same-column: a single straight line, no jog.
 *  - Adjacent período (one row apart): an elbow through the gutter beside the
 *    target's column — lanes are assigned per SOURCE NODE (not per source
 *    período), so a one-to-many branch (e.g. one subject feeding three
 *    others) exits as a single shared trunk that only splits at the jog,
 *    matching the "uma origem, vários destinos" rule.
 *  - Long-distance (skips 2+ períodos, e.g. "Tx. Acad. -> TCC"): contoured
 *    along a dedicated lane OUTSIDE every card column, past the right border
 *    of the whole diagram — physically isolated from the interior gutters
 *    local edges use, so it can never cross them either.
 */
function buildRoutedEdges(
    nodeByCode: Map<string, GraphNode>,
    pairs: Array<[string, string]>,
    rowIndexOf: Map<number, number>,
    rightEdgeX: number
): { edges: Array<{ from: GraphNode; to: GraphNode; points: Array<[number, number]> }>; maxExteriorX: number } {
    const edges: Array<{ from: GraphNode; to: GraphNode; points: Array<[number, number]> }> = [];
    const laneBySourceCode = new Map<string, number>();
    const nextLaneInGap = new Map<number, number>();
    let nextExteriorLane = 0;
    let maxExteriorX = rightEdgeX;

    for (const [preCode, code] of pairs) {
        const source = nodeByCode.get(preCode);
        const target = nodeByCode.get(code);
        if (!source || !target) continue;

        const sx = source.x + NODE_W / 2;
        const sBottom = source.y + NODE_H;
        const tx = target.x + NODE_W / 2;
        const ty = target.y;

        if (source.x === target.x) {
            edges.push({ from: source, to: target, points: [[sx, sBottom], [tx, ty]] });
            continue;
        }

        const sRow = rowIndexOf.get(source.periodo) ?? 0;
        const tRow = rowIndexOf.get(target.periodo) ?? 0;

        if (Math.abs(tRow - sRow) <= 1) {
            if (!laneBySourceCode.has(source.codigo)) {
                const next = nextLaneInGap.get(sRow) ?? 0;
                nextLaneInGap.set(sRow, next + 1);
                laneBySourceCode.set(source.codigo, next);
            }
            const lane = laneBySourceCode.get(source.codigo)!;
            const gutterX = target.x - H_GAP / 2;
            const off = (lane % 6) * 4;
            const yA = sBottom + ROW_MARGIN + off;
            const yB = ty - ROW_MARGIN - off;
            edges.push({ from: source, to: target, points: [[sx, sBottom], [sx, yA], [gutterX, yA], [gutterX, yB], [tx, yB], [tx, ty]] });
        } else {
            nextExteriorLane += 1;
            const exteriorX = rightEdgeX + EXTERIOR_LANE_GAP * nextExteriorLane;
            maxExteriorX = Math.max(maxExteriorX, exteriorX);
            const yA = sBottom + ROW_MARGIN;
            const yB = ty - ROW_MARGIN;
            edges.push({ from: source, to: target, points: [[sx, sBottom], [sx, yA], [exteriorX, yA], [exteriorX, yB], [tx, yB], [tx, ty]] });
        }
    }

    return { edges, maxExteriorX };
}

function buildGraphLayout(matriz: MatrizCurricular): GraphLayout {
    const obrigatorias = matriz.categorias.find((c) => c.nome.toUpperCase().includes('OBRIGAT'))?.disciplinas ?? [];
    const withPeriod = obrigatorias.filter((d) => d.periodo != null) as Array<MatrizDisciplina & { periodo: number }>;

    const byPeriod = new Map<number, Array<MatrizDisciplina & { periodo: number }>>();
    for (const d of withPeriod) {
        const list = byPeriod.get(d.periodo) ?? [];
        list.push(d);
        byPeriod.set(d.periodo, list);
    }
    const periodos = [...byPeriod.keys()].sort((a, b) => a - b);

    const nodeByCode = new Map<string, GraphNode>();
    const codeToSlot = new Map<string, number>();
    const nodes: GraphNode[] = [];
    const rows: Array<{ periodo: number; y: number }> = [];
    const slotW = NODE_W + H_GAP;
    let nextFreshSlot = 0;

    periodos.forEach((p, rowIndex) => {
        const y = PAD + rowIndex * (NODE_H + V_GAP);
        rows.push({ periodo: p, y });

        // Sugiyama-style column assignment: each disciplina wants the same
        // column (slot) as its pre-requisito, so a chain like "Cálculo I ->
        // Cálculo II" stays in one straight vertical track, exactly like the
        // reference diagram. Disciplinas with no known pre-requisito slot get
        // a brand-new column. Conflicts (two disciplinas wanting the same
        // slot) resolve by scanning outward for the nearest free slot.
        const wanted = byPeriod.get(p)!.map((d, index) => {
            const preSlots = d.preRequisitos
                .map((pr) => codeToSlot.get(pr))
                .filter((s): s is number => s != null);
            const desired = preSlots.length
                ? Math.round(preSlots.reduce((a, b) => a + b, 0) / preSlots.length)
                : nextFreshSlot++;
            return { d, desired, index };
        });

        const taken = new Set<number>();
        const placed = wanted
            .slice()
            .sort((a, b) => a.desired - b.desired || a.index - b.index)
            .map((entry) => {
                let slot = entry.desired;
                if (slot < 0) slot = 0;
                let step = 0;
                while (taken.has(slot)) {
                    step += 1;
                    slot = entry.desired + (step % 2 === 1 ? Math.ceil(step / 2) : -Math.ceil(step / 2));
                    if (slot < 0) slot = entry.desired + step;
                }
                taken.add(slot);
                return { ...entry, slot };
            });

        for (const { d, slot } of placed) {
            const node: GraphNode = {
                codigo: d.codigo,
                nome: d.nome,
                periodo: p,
                x: PAD + slot * slotW,
                y
            };
            nodes.push(node);
            nodeByCode.set(d.codigo, node);
            codeToSlot.set(d.codigo, slot);
        }
    });

    // Normalize x so the leftmost used column starts at PAD (slot assignment
    // above can start negative-ish / sparse when chains diverge left).
    const minX = nodes.length ? Math.min(...nodes.map((n) => n.x)) : PAD;
    const shift = PAD - minX;
    if (shift !== 0) {
        for (const n of nodes) n.x += shift;
    }

    const pairs: Array<[string, string]> = [];
    for (const d of withPeriod) {
        for (const pre of d.preRequisitos) {
            pairs.push([pre, d.codigo]);
        }
    }

    const rowIndexOf = new Map<number, number>(rows.map((r, i) => [r.periodo, i]));
    const rightEdgeX = nodes.length ? Math.max(...nodes.map((n) => n.x)) + NODE_W : PAD;
    const { edges, maxExteriorX } = buildRoutedEdges(nodeByCode, pairs, rowIndexOf, rightEdgeX);

    const width = Math.max(rightEdgeX, maxExteriorX) + PAD;
    const height = periodos.length > 0 ? PAD + periodos.length * (NODE_H + V_GAP) - V_GAP + PAD : PAD;
    return { nodes, edges, rows, width, height };
}

function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): string {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const a1 = angle + Math.PI - Math.PI / 7;
    const a2 = angle + Math.PI + Math.PI / 7;
    const p1 = `${x2},${y2}`;
    const p2 = `${x2 + size * Math.cos(a1)},${y2 + size * Math.sin(a1)}`;
    const p3 = `${x2 + size * Math.cos(a2)},${y2 + size * Math.sin(a2)}`;
    return `${p1} ${p2} ${p3}`;
}

function truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

const styles = StyleSheet.create({
    screen: { backgroundColor: colors.canvas, flex: 1 },
    hero: {
        borderBottomLeftRadius: radii.lg + 14,
        borderBottomRightRadius: radii.lg + 14,
        gap: spacing[4],
        paddingBottom: spacing[5],
        paddingHorizontal: spacing[4],
        paddingTop: spacing[6],
        ...shadows.elevated
    },
    heroTopRow: { alignItems: 'center', flexDirection: 'row', gap: spacing[3] },
    iconButton: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderColor: 'rgba(255,255,255,0.24)',
        borderRadius: radii.pill,
        borderWidth: 1,
        height: 40,
        justifyContent: 'center',
        width: 40
    },
    heroEyebrow: { color: 'rgba(255,255,255,0.75)', fontFamily: typography.eyebrow.fontFamily, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
    heroTitle: { color: colors.inverseText, fontFamily: typography.title.fontFamily, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 2, ...textShadows.heroOnBrand },
    heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    heroChip: {
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderColor: 'rgba(255,255,255,0.22)',
        borderRadius: radii.md,
        borderWidth: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2]
    },
    heroChipLabel: { color: 'rgba(255,255,255,0.7)', fontFamily: typography.label.fontFamily, fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase' },
    heroChipValue: { color: colors.inverseText, fontFamily: typography.label.fontFamily, fontSize: 13, fontWeight: '800' },
    toggleRow: { flexDirection: 'row', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
    toggleButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: spacing[2],
        justifyContent: 'center',
        paddingVertical: spacing[3]
    },
    toggleButtonActive: { backgroundColor: colors.brand, borderColor: colors.brand },
    toggleButtonText: { color: colors.brand, fontFamily: typography.label.fontFamily, fontSize: 13, fontWeight: '800' },
    toggleButtonTextActive: { color: colors.inverseText },
    // list
    categoriaBlock: { gap: spacing[3] },
    categoriaHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    categoriaTitle: { color: colors.brandDark, fontFamily: typography.title.fontFamily, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
    categoriaMeta: { color: colors.textSubtle, fontFamily: typography.label.fontFamily, fontSize: 12, fontWeight: '700' },
    card: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing[3],
        padding: spacing[3],
        ...shadows.elevated
    },
    cardLeft: { alignItems: 'center', justifyContent: 'center' },
    periodBadge: { alignItems: 'center', backgroundColor: colors.brand, borderRadius: radii.md, height: 34, justifyContent: 'center', width: 34 },
    periodBadgeMuted: { backgroundColor: colors.brandSubtle },
    periodBadgeText: { color: colors.inverseText, fontFamily: typography.label.fontFamily, fontSize: 13, fontWeight: '800' },
    periodBadgeMutedText: { color: colors.textSubtle, fontFamily: typography.label.fontFamily, fontSize: 13, fontWeight: '800' },
    cardCode: { color: colors.brand, fontFamily: typography.label.fontFamily, fontSize: 12, fontWeight: '800' },
    cardName: { color: colors.text, fontFamily: typography.body.fontFamily, fontSize: 14, fontWeight: '600', lineHeight: 18 },
    cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: 2 },
    miniChip: { backgroundColor: colors.brandSubtle, borderRadius: radii.sm, paddingHorizontal: spacing[2], paddingVertical: 2 },
    miniChipText: { color: colors.brandDark, fontFamily: typography.label.fontFamily, fontSize: 11, fontWeight: '700' },
    miniChipWarn: { backgroundColor: colors.warningSubtle },
    miniChipWarnText: { color: colors.warning },
    // graph
    graphHeader: { paddingBottom: spacing[2], paddingTop: 64 },
    graphTitle: { color: colors.brandDark, fontFamily: typography.title.fontFamily, fontSize: 16, fontWeight: '800', paddingHorizontal: spacing[4] },
    graphHint: { color: colors.textMuted, fontFamily: typography.body.fontFamily, fontSize: 12.5, paddingHorizontal: spacing[4], paddingTop: spacing[1] },
    graphClearButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        bottom: spacing[4],
        elevation: 6,
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2],
        position: 'absolute',
        right: spacing[4],
        shadowColor: '#0B3D32',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        zIndex: 10
    },
    graphClearButtonText: { color: colors.brandDark, fontFamily: typography.label.fontFamily, fontSize: 12, fontWeight: '700' },
    graphBackButton: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        elevation: 6,
        height: 44,
        justifyContent: 'center',
        left: spacing[4],
        position: 'absolute',
        shadowColor: '#0B3D32',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        top: spacing[3],
        width: 44,
        zIndex: 10
    },
    // states
    stateWrap: { alignItems: 'center', gap: spacing[3], justifyContent: 'center', padding: spacing[8] },
    stateEmoji: { fontSize: 46 },
    stateTitle: { color: colors.brandDark, fontFamily: typography.title.fontFamily, fontSize: 17, fontWeight: '800', textAlign: 'center' },
    stateSubtitle: { color: colors.textMuted, fontFamily: typography.body.fontFamily, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    retryButton: {
        alignItems: 'center',
        backgroundColor: colors.brand,
        borderRadius: radii.pill,
        flexDirection: 'row',
        gap: spacing[2],
        marginTop: spacing[2],
        paddingHorizontal: spacing[5],
        paddingVertical: spacing[3]
    },
    retryButtonText: { color: colors.inverseText, fontFamily: typography.label.fontFamily, fontSize: 14, fontWeight: '800' },
    pressed: { opacity: 0.7 }
});
