import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { ArrowLeft, GitBranch, List, RefreshCw } from 'lucide-react-native';
import { colors, gradients, radii, shadows, spacing, textShadows, typography } from '@/shared/design-system';
import { hapticTap } from '@/shared/haptics';
import { useMatrizCurricular } from '@/modules/academic/presentation/hooks/use-matriz-curricular';
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

const NODE_W = 148;
const NODE_H = 50;
const H_GAP = 22; // between disciplinas of the same período (horizontal)
const V_GAP = 50; // between período rows (vertical) — room for the arrows
const PAD = 20;
const LABEL_W = 42; // left gutter for the "Nº" período label

interface GraphNode {
    codigo: string;
    nome: string;
    periodo: number;
    x: number;
    y: number;
}

function MatrizGraphView({ matriz, bottomInset, onBack }: { matriz: MatrizCurricular; bottomInset: number; onBack: () => void }) {
    const layout = useMemo(() => buildGraphLayout(matriz), [matriz]);

    return (
        <View style={styles.screen}>
            {layout.nodes.length === 0 ? (
                <StateView emoji="🗺️" title="Sem grafo" subtitle="Não há disciplinas obrigatórias com período para montar o grafo." />
            ) : (
                <ScrollView contentContainerStyle={{ paddingTop: 64, paddingBottom: bottomInset + spacing[8] }}>
                    <Text style={[styles.graphHint, { paddingLeft: 68 }]}>Cada linha é um período (1º no topo); as setas descem do pré-requisito para a disciplina que depende dele.</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ padding: spacing[2] }}>
                        <Svg width={layout.width} height={layout.height}>
                            {/* período row labels (left gutter) */}
                            {layout.rows.map((row) => (
                                <SvgText key={`r${row.periodo}`} x={PAD} y={row.y + NODE_H / 2 + 4} fill={colors.brand} fontSize={13} fontWeight="700" textAnchor="start">
                                    {`${row.periodo}º`}
                                </SvgText>
                            ))}
                            {/* edges */}
                            {layout.edges.map((e, i) => (
                                <Edge key={`e${i}`} from={e.from} to={e.to} />
                            ))}
                            {/* nodes */}
                            {layout.nodes.map((n) => (
                                <GraphNodeView key={n.codigo} node={n} />
                            ))}
                        </Svg>
                    </ScrollView>
                </ScrollView>
            )}

            <Pressable onPress={() => { hapticTap(); onBack(); }} style={({ pressed }) => [styles.graphBackButton, pressed ? styles.pressed : null]}>
                <ArrowLeft color={colors.brandDark} size={20} />
            </Pressable>
        </View>
    );
}

function GraphNodeView({ node }: { node: GraphNode }) {
    return (
        <>
            <Rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={10} fill={colors.brandSubtle} stroke={colors.brand} strokeWidth={1.5} />
            <SvgText x={node.x + NODE_W / 2} y={node.y + 20} fill={colors.brandDark} fontSize={12.5} fontWeight="800" textAnchor="middle">
                {node.codigo}
            </SvgText>
            <SvgText x={node.x + NODE_W / 2} y={node.y + 36} fill={colors.textMuted} fontSize={9} textAnchor="middle">
                {truncate(node.nome, 24)}
            </SvgText>
        </>
    );
}

function Edge({ from, to }: { from: GraphNode; to: GraphNode }) {
    // Downward flow: from the pre-requisito's bottom-center to the top-center of
    // the disciplina that depends on it.
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H;
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y;
    const arrow = arrowHead(x1, y1, x2, y2, 7);
    return (
        <>
            <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.borderStrong} strokeWidth={1.5} />
            <Polygon points={arrow} fill={colors.brand} />
        </>
    );
}

function buildGraphLayout(matriz: MatrizCurricular): {
    nodes: GraphNode[];
    edges: Array<{ from: GraphNode; to: GraphNode }>;
    rows: Array<{ periodo: number; y: number }>;
    width: number;
    height: number;
} {
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
    const nodes: GraphNode[] = [];
    const rows: Array<{ periodo: number; y: number }> = [];
    periodos.forEach((p, rowIndex) => {
        const y = PAD + rowIndex * (NODE_H + V_GAP);
        rows.push({ periodo: p, y });
        byPeriod.get(p)!.forEach((d, index) => {
            const node: GraphNode = {
                codigo: d.codigo,
                nome: d.nome,
                periodo: p,
                x: PAD + LABEL_W + index * (NODE_W + H_GAP),
                y
            };
            nodes.push(node);
            nodeByCode.set(d.codigo, node);
        });
    });

    const edges: Array<{ from: GraphNode; to: GraphNode }> = [];
    for (const d of withPeriod) {
        const target = nodeByCode.get(d.codigo);
        if (!target) continue;
        for (const pre of d.preRequisitos) {
            const source = nodeByCode.get(pre);
            if (source) edges.push({ from: source, to: target });
        }
    }

    const maxRowLen = Math.max(1, ...periodos.map((p) => byPeriod.get(p)!.length));
    const width = PAD + LABEL_W + maxRowLen * (NODE_W + H_GAP) - H_GAP + PAD;
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
    graphHint: { color: colors.textMuted, fontFamily: typography.body.fontFamily, fontSize: 12.5, paddingHorizontal: spacing[4], paddingTop: spacing[1], paddingBottom: spacing[2] },
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
